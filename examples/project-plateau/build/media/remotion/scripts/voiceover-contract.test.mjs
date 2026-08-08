import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNormalizationPlan,
  buildVoiceoverRequestContract,
  evaluateVoiceoverProvenance,
  resolveVoiceoverReference,
  sha256,
} from './voiceover-contract.mjs';

const config = {
  model: 's2.1-pro-free',
  language: 'en-US',
  text: 'A short test line.',
  delivery: {format: 'mp3', sample_rate: 44100, mp3_bitrate: 192, temperature: 0.7, top_p: 0.7, speed: 1},
  mix: {maximum_seconds: 8, target_lufs: -16, true_peak_db: -2},
};

test('voiceover provenance binds the provider response to the normalized asset', () => {
  const requestContract = buildVoiceoverRequestContract(config, 'reference-a');
  const sourceSha256 = sha256('source-audio');
  const normalizedSha256 = sha256('normalized-audio');
  const plan = buildNormalizationPlan(config, 4, sourceSha256);
  const metadata = {
    schemaVersion: 4,
    provider: 'fish-audio',
    endpoint: requestContract.endpoint,
    model: config.model,
    textSha256: requestContract.textSha256,
    requestSha256: requestContract.requestSha256,
    sourceSha256,
    referenceSha256: requestContract.referenceSha256,
    normalizedSha256,
    normalizationSha256: plan.normalizationSha256,
  };
  assert.equal(
    evaluateVoiceoverProvenance({
      metadata,
      config,
      requestContract,
      sourceSha256,
      normalizedSha256,
      normalizationSha256: plan.normalizationSha256,
    }).status,
    'RECORDED',
  );
  // Every recorded field must be load-bearing: breaking any one of them alone has to invalidate the
  // record, and the failing check has to name that field.
  for (const field of Object.keys(metadata)) {
    const result = evaluateVoiceoverProvenance({
      metadata: {...metadata, [field]: field === 'schemaVersion' ? 0 : sha256(`tampered-${field}`)},
      config,
      requestContract,
      sourceSha256,
      normalizedSha256,
      normalizationSha256: plan.normalizationSha256,
    });
    assert.equal(result.status, 'INVALID', `${field} is not bound`);
    assert.equal(result.checks.find((check) => check.id === field).passed, false);
  }
});

test('the normalization plan compresses an overlong take and refuses an unfittable one', () => {
  const sourceSha256 = sha256('source-audio');
  const asIs = buildNormalizationPlan(config, 4, sourceSha256);
  assert.equal(asIs.speed, 1);
  assert.ok(!asIs.filters.some((filter) => filter.startsWith('atempo=')));

  // config.mix.maximum_seconds is 8, so a 12s take must be sped up by exactly 1.5x.
  const compressed = buildNormalizationPlan(config, 12, sourceSha256);
  assert.equal(compressed.speed, 1.5);
  assert.equal(compressed.filters[0], 'atempo=1.500000');
  assert.notEqual(compressed.normalizationSha256, asIs.normalizationSha256);

  assert.throws(() => buildNormalizationPlan(config, 20, sourceSha256), /cannot be fit cleanly/);
  // ffprobe reports success with empty stdout when it cannot read a duration, and Number('') is 0.
  for (const bad of [0, -1, Number.NaN]) {
    assert.throws(() => buildNormalizationPlan(config, bad, sourceSha256), /Invalid generated voiceover duration/);
  }
});

test('an environment reference is only labelled an override when it differs from the committed one', () => {
  const configured = {voice: {reference_id: 'public-voice'}};
  assert.equal(
    resolveVoiceoverReference(configured, {FISH_REFERENCE_ID: 'public-voice'}).referenceSource,
    'configured-public-reference',
  );
  assert.equal(
    resolveVoiceoverReference(configured, {FISH_REFERENCE_ID: 'other-voice'}).referenceSource,
    'environment-provided-reference',
  );
  assert.equal(resolveVoiceoverReference(configured, {}).referenceSource, 'configured-public-reference');
  assert.equal(resolveVoiceoverReference({}, {}).referenceSource, 'provider-default');
  assert.equal(resolveVoiceoverReference({}, {}).referenceSha256, null);
});
