import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAXIMUM_TEXT_UTF8_BYTES,
  requestFingerprint,
  requestFishTts,
  retryDelayMs,
  validateAudioResponse,
} from './fish-tts-client.mjs';

function mp3Fixture() {
  const audio = Buffer.alloc(2048);
  audio[0] = 0xff;
  audio[1] = 0xfb;
  return audio;
}

function response(status, body, headers = {}) {
  return new Response(body, {status, headers});
}

test('request fingerprint is stable across object key order and covers delivery changes', () => {
  const first = requestFingerprint({
    model: 's2.1-pro-free',
    body: {text: 'hello', format: 'mp3', prosody: {speed: 1, volume: 0}},
  });
  const reordered = requestFingerprint({
    body: {prosody: {volume: 0, speed: 1}, format: 'mp3', text: 'hello'},
    model: 's2.1-pro-free',
  });
  const changed = requestFingerprint({
    model: 's2.1-pro-free',
    body: {text: 'hello', format: 'mp3', prosody: {speed: 1.1, volume: 0}},
  });
  const changedLanguage = requestFingerprint({
    model: 's2.1-pro-free',
    context: {language: 'zh-Hans'},
    body: {text: 'hello', format: 'mp3', prosody: {speed: 1, volume: 0}},
  });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.notEqual(first, changedLanguage);
});

test('audio validation rejects error bodies disguised as success', () => {
  assert.throws(
    () =>
      validateAudioResponse({
        audio: Buffer.from(JSON.stringify({error: 'out of credits'}).padEnd(2048)),
        contentType: 'application/json',
        format: 'mp3',
      }),
    /non-audio content type/,
  );
  assert.throws(
    () =>
      validateAudioResponse({
        audio: Buffer.alloc(2048),
        contentType: 'audio/mpeg',
        format: 'mp3',
      }),
    /file signature/,
  );
});

test('audio validation accepts WAV and Opus signatures from binary responses', () => {
  const wav = Buffer.alloc(2048);
  wav.write('RIFF', 0);
  wav.write('WAVE', 8);
  const opus = Buffer.alloc(2048);
  opus.write('OggS', 0);
  assert.doesNotThrow(() => validateAudioResponse({audio: wav, contentType: 'audio/wav', format: 'wav'}));
  assert.doesNotThrow(() =>
    validateAudioResponse({audio: opus, contentType: 'application/octet-stream', format: 'opus'}),
  );
});

test('retry delay honors Retry-After and stays bounded', () => {
  assert.equal(retryDelayMs({attempt: 1, retryAfter: '2', maxDelayMs: 8000}), 2000);
  assert.equal(retryDelayMs({attempt: 8, baseDelayMs: 500, maxDelayMs: 8000}), 8000);
});

test('429 and recoverable 5xx responses retry before returning valid audio', async () => {
  const statuses = [429, 503, 200];
  const delays = [];
  const result = await requestFishTts({
    apiKey: 'test-secret',
    model: 's2.1-pro-free',
    body: {text: 'hello', format: 'mp3'},
    fetchImpl: async () => {
      const status = statuses.shift();
      return status === 200
        ? response(200, mp3Fixture(), {'content-type': 'audio/mpeg'})
        : response(status, `retry ${status}`, {'retry-after': '0'});
    },
    sleep: async (delay) => delays.push(delay),
  });
  assert.equal(result.attempts, 3);
  assert.deepEqual(delays, [0, 0]);
  assert.equal(result.audio.length, 2048);
});

test('authentication failures do not retry or reveal the secret', async () => {
  let calls = 0;
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () => {
        calls += 1;
        return response(401, 'token test-secret is invalid');
      },
      sleep: async () => assert.fail('401 must not retry'),
    }),
    (error) => {
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, /test-secret/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('invalid requests fail once and requests always receive a timeout signal', async () => {
  let calls = 0;
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: 'bad request fixture', format: 'mp3'},
      fetchImpl: async (_endpoint, options) => {
        calls += 1;
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.redirect, 'error');
        return response(400, 'text must not be empty');
      },
      sleep: async () => assert.fail('400 must not retry'),
      timeoutMs: 25,
    }),
    /HTTP 400/,
  );
  assert.equal(calls, 1);
});

test('missing credentials fail before a network request', async () => {
  await assert.rejects(
    requestFishTts({
      apiKey: '',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () => assert.fail('request must not be sent'),
    }),
    /FISH_API_KEY is required/,
  );
});

test('credentials cannot be redirected to a different host', async () => {
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      endpoint: 'https://example.com/collect',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () => assert.fail('credential must not be sent'),
    }),
    /only be sent to https:\/\/api\.fish\.audio/,
  );
});

test('whole-document sized requests fail before disclosure', async () => {
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: '文'.repeat(MAXIMUM_TEXT_UTF8_BYTES), format: 'mp3'},
      fetchImpl: async () => assert.fail('oversized text must not be sent'),
    }),
    /per-request .* safety limit/,
  );
});

test('declared oversized audio is rejected before buffering the body', async () => {
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () =>
        response(200, mp3Fixture(), {
          'content-type': 'audio/mpeg',
          'content-length': '4096',
        }),
      maximumAudioBytes: 2048,
    }),
    /declared an unexpectedly large response/,
  );
});

test('chunked audio is cancelled as soon as actual bytes exceed the response limit', async () => {
  let cancelled = false;
  let chunk = 0;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk === 0 ? mp3Fixture() : Buffer.alloc(2048));
      chunk += 1;
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () => response(200, stream, {'content-type': 'audio/mpeg'}),
      maximumAudioBytes: 2048,
    }),
    /unexpectedly large response/,
  );
  assert.equal(cancelled, true);
});

test('network failures retry only up to the configured attempt limit', async () => {
  let calls = 0;
  await assert.rejects(
    requestFishTts({
      apiKey: 'test-secret',
      model: 's2.1-pro-free',
      body: {text: 'hello', format: 'mp3'},
      fetchImpl: async () => {
        calls += 1;
        throw new Error('socket closed while sending Bearer test-secret');
      },
      sleep: async () => {},
      maxAttempts: 2,
    }),
    (error) => {
      assert.match(error.message, /socket closed/);
      // A transport error can echo the outgoing Authorization header back at us.
      assert.doesNotMatch(error.message, /test-secret/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
  assert.equal(calls, 2);
});
