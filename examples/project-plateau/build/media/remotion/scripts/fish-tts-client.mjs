import {createHash} from 'node:crypto';

export const FISH_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';
export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
export const MAXIMUM_TEXT_UTF8_BYTES = 32_000;
export const MAXIMUM_AUDIO_BYTES = 64 * 1024 * 1024;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function requestFingerprint({endpoint = FISH_TTS_ENDPOINT, model, body, context = {}}) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize({provider: 'fish-audio', endpoint, model, context, body})))
    .digest('hex');
}

function redact(value, secret) {
  const text = String(value ?? '');
  return secret ? text.split(secret).join('[REDACTED]') : text;
}

function retryAfterMs(header, now = Date.now()) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function retryDelayMs({attempt, retryAfter, baseDelayMs = 500, maxDelayMs = 8000}) {
  const providerDelay = retryAfterMs(retryAfter);
  if (providerDelay !== null) return Math.min(maxDelayMs, providerDelay);
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

function hasExpectedSignature(audio, format) {
  if (format === 'mp3') {
    return (
      audio.subarray(0, 3).toString('ascii') === 'ID3' ||
      (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)
    );
  }
  if (format === 'wav') {
    return audio.subarray(0, 4).toString('ascii') === 'RIFF' && audio.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  if (format === 'opus') return audio.subarray(0, 4).toString('ascii') === 'OggS';
  return false;
}

export function validateAudioResponse({audio, contentType, format, maximumAudioBytes = MAXIMUM_AUDIO_BYTES}) {
  if (!Buffer.isBuffer(audio) || audio.length < 1024) {
    throw new Error('Fish Audio returned an unexpectedly small response.');
  }
  if (audio.length > maximumAudioBytes) throw new Error('Fish Audio returned an unexpectedly large response.');
  const normalizedType = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (normalizedType && !normalizedType.startsWith('audio/') && normalizedType !== 'application/octet-stream') {
    throw new Error(`Fish Audio returned a non-audio content type: ${normalizedType}`);
  }
  if (!hasExpectedSignature(audio, format)) {
    throw new Error(`Fish Audio response does not match the requested ${format} file signature.`);
  }
}

const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readResponseWithLimit(response, maximumAudioBytes) {
  if (!response.body?.getReader) {
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length > maximumAudioBytes) {
      throw new Error('Fish Audio returned an unexpectedly large response.');
    }
    return audio;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumAudioBytes) {
      await reader.cancel('response exceeded maximumAudioBytes');
      throw new Error('Fish Audio returned an unexpectedly large response.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function requestFishTts({
  apiKey,
  model,
  body,
  endpoint = FISH_TTS_ENDPOINT,
  fetchImpl = fetch,
  sleep = defaultSleep,
  timeoutMs = 60_000,
  maxAttempts = 3,
  baseDelayMs = 500,
  maxDelayMs = 8000,
  maximumAudioBytes = MAXIMUM_AUDIO_BYTES,
}) {
  if (!apiKey) throw new Error('FISH_API_KEY is required.');
  if (typeof model !== 'string' || !model.trim()) throw new Error('TTS model is required.');
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== 'https:' || endpointUrl.hostname !== 'api.fish.audio') {
    throw new Error('Fish Audio credentials may only be sent to https://api.fish.audio.');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be a positive integer.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive.');
  if (!Number.isFinite(maximumAudioBytes) || maximumAudioBytes < 1024) {
    throw new Error('maximumAudioBytes must be at least 1024.');
  }
  if (!body || typeof body.text !== 'string' || !body.text.trim()) throw new Error('TTS text must be a non-empty string.');
  if (!['mp3', 'wav', 'opus'].includes(body.format)) throw new Error('TTS format must be mp3, wav, or opus.');
  if (Buffer.byteLength(body.text, 'utf8') > MAXIMUM_TEXT_UTF8_BYTES) {
    throw new Error(`TTS text exceeds the per-request ${MAXIMUM_TEXT_UTF8_BYTES}-byte safety limit.`);
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          model,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      lastError = new Error(`Fish Audio request failed before a response: ${redact(error?.message, apiKey)}`);
      if (attempt === maxAttempts) break;
      await sleep(retryDelayMs({attempt, baseDelayMs, maxDelayMs}));
      continue;
    }

    if (!response.ok) {
      // Provider bodies can echo unpublished text. Keep only the status in logs.
      await response.body?.cancel();
      lastError = new Error(`Fish Audio TTS failed with HTTP ${response.status}; provider response omitted.`);
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts) break;
      await sleep(
        retryDelayMs({
          attempt,
          retryAfter: response.headers.get('retry-after'),
          baseDelayMs,
          maxDelayMs,
        }),
      );
      continue;
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maximumAudioBytes) {
      await response.body?.cancel();
      throw new Error('Fish Audio declared an unexpectedly large response.');
    }
    const audio = await readResponseWithLimit(response, maximumAudioBytes);
    const contentType = response.headers.get('content-type');
    validateAudioResponse({audio, contentType, format: body.format, maximumAudioBytes});
    return {audio, attempts: attempt, contentType: contentType || 'not-reported'};
  }

  throw lastError || new Error('Fish Audio TTS failed without a response.');
}
