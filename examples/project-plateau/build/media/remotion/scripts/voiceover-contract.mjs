import {createHash} from 'node:crypto';

import {FISH_TTS_ENDPOINT, requestFingerprint} from './fish-tts-client.mjs';

export const VOICEOVER_METADATA_SCHEMA = 4;
export const VOICEOVER_REVIEW_SCHEMA = 1;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function resolveVoiceoverReference(config, environment = process.env) {
  const configuredReferenceId = config.voice?.reference_id;
  const environmentReferenceId = environment.FISH_REFERENCE_ID;
  const referenceId = environmentReferenceId || configuredReferenceId;
  // Only claim an environment override when the value actually differs from the committed one;
  // otherwise re-verifying a take would require the same variable to still be exported.
  const overridesConfigured =
    Boolean(environmentReferenceId) && environmentReferenceId !== configuredReferenceId;
  return {
    referenceId,
    referenceSha256: referenceId ? sha256(referenceId) : null,
    referenceSource: overridesConfigured
      ? 'environment-provided-reference'
      : configuredReferenceId
        ? 'configured-public-reference'
        : 'provider-default',
  };
}

export function buildVoiceoverRequestContract(config, referenceId) {
  const body = {
    text: config.text,
    format: config.delivery.format,
    sample_rate: config.delivery.sample_rate,
    mp3_bitrate: config.delivery.mp3_bitrate,
    temperature: config.delivery.temperature,
    top_p: config.delivery.top_p,
    latency: 'normal',
    normalize: true,
    prosody: {
      speed: config.delivery.speed,
      volume: 0,
      normalize_loudness: true,
    },
  };
  if (referenceId) body.reference_id = referenceId;
  return {
    endpoint: FISH_TTS_ENDPOINT,
    body,
    textSha256: sha256(config.text),
    referenceSha256: referenceId ? sha256(referenceId) : null,
    requestSha256: requestFingerprint({
      endpoint: FISH_TTS_ENDPOINT,
      model: config.model,
      body,
      context: {language: config.language},
    }),
  };
}

export function buildNormalizationPlan(config, sourceDurationSeconds, sourceSha256) {
  const measuredDuration = Number(Number(sourceDurationSeconds).toFixed(4));
  if (!Number.isFinite(measuredDuration) || measuredDuration <= 0) {
    throw new Error(`Invalid generated voiceover duration: ${sourceDurationSeconds}`);
  }
  const speed = Math.max(1, measuredDuration / config.mix.maximum_seconds);
  if (speed > 2) {
    throw new Error(
      `Generated voiceover cannot be fit cleanly: ${measuredDuration.toFixed(2)}s → ` +
        `${config.mix.maximum_seconds.toFixed(2)}s`,
    );
  }
  const filters = [];
  if (Math.abs(speed - 1) > 0.001) filters.push(`atempo=${speed.toFixed(6)}`);
  filters.push('highpass=f=70');
  filters.push(`loudnorm=I=${config.mix.target_lufs}:TP=${config.mix.true_peak_db}:LRA=7`);
  const contract = {
    version: 1,
    sourceSha256,
    sourceDurationSeconds: measuredDuration,
    maximumSeconds: config.mix.maximum_seconds,
    filters,
    output: {codec: 'pcm_s16le', sampleRate: 48000, channels: 2},
  };
  return {
    speed,
    filters,
    normalizationSha256: sha256(JSON.stringify(contract)),
  };
}

export function evaluateVoiceoverProvenance({
  metadata,
  config,
  requestContract,
  sourceSha256,
  normalizedSha256,
  normalizationSha256,
}) {
  const expected = {
    schemaVersion: VOICEOVER_METADATA_SCHEMA,
    provider: 'fish-audio',
    endpoint: requestContract.endpoint,
    model: config.model,
    textSha256: requestContract.textSha256,
    requestSha256: requestContract.requestSha256,
    sourceSha256,
    referenceSha256: requestContract.referenceSha256,
    normalizedSha256,
    normalizationSha256,
  };
  const checks = Object.entries(expected).map(([field, value]) => ({
    id: field,
    passed: metadata?.[field] === value,
    evidence: `${metadata?.[field] ?? 'missing'} == ${value ?? 'null'}`,
  }));
  return {status: checks.every((check) => check.passed) ? 'RECORDED' : 'INVALID', checks};
}

export function evaluateVoiceoverRelease({review, referenceSha256, sourceSha256, normalizedSha256}) {
  const checks = [
    {
      id: 'review_schema',
      passed: review?.schemaVersion === VOICEOVER_REVIEW_SCHEMA,
      evidence: `${review?.schemaVersion ?? 'missing'} == ${VOICEOVER_REVIEW_SCHEMA}`,
    },
    {
      id: 'review_release_status',
      passed: review?.releaseStatus === 'APPROVED',
      evidence: review?.releaseStatus || 'missing',
    },
    {
      id: 'rights_approved',
      passed:
        review?.rights?.status === 'APPROVED' &&
        Boolean(review.rights.evidence) &&
        review.rights.approvedReferenceSha256 === referenceSha256,
      evidence: review?.rights?.status || 'missing',
    },
    {
      id: 'listening_approved',
      passed:
        review?.listening?.status === 'APPROVED' &&
        Boolean(review.listening.reviewer) &&
        Boolean(review.listening.reviewedAt) &&
        review.listening.approvedSourceSha256 === sourceSha256 &&
        review.listening.approvedNormalizedSha256 === normalizedSha256,
      evidence: review?.listening?.status || 'missing',
    },
  ];
  return {status: checks.every((check) => check.passed) ? 'APPROVED' : 'BLOCKED', checks};
}
