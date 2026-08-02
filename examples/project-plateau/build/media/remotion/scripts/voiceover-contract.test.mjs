import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNormalizationPlan,
  buildVoiceoverRequestContract,
  evaluateVoiceoverProvenance,
  evaluateVoiceoverRelease,
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

test('technical audio cannot become release-approved without hash-bound rights and listening evidence', () => {
  const referenceSha256 = sha256('reference-a');
  const sourceSha256 = sha256('source-audio');
  const normalizedSha256 = sha256('normalized-audio');
  assert.equal(
    evaluateVoiceoverRelease({
      review: {
        schemaVersion: 1,
        releaseStatus: 'BLOCKED',
        rights: {status: 'NOT_RUN'},
        listening: {status: 'NOT_RUN'},
      },
      referenceSha256,
      sourceSha256,
      normalizedSha256,
    }).status,
    'BLOCKED',
  );
  assert.equal(
    evaluateVoiceoverRelease({
      review: {
        schemaVersion: 1,
        releaseStatus: 'APPROVED',
        rights: {status: 'APPROVED', evidence: 'asset-ledger.json#voice', approvedReferenceSha256: referenceSha256},
        listening: {
          status: 'APPROVED',
          reviewer: 'human-reviewer',
          reviewedAt: '2026-08-01T00:00:00Z',
          approvedSourceSha256: sourceSha256,
          approvedNormalizedSha256: normalizedSha256,
        },
      },
      referenceSha256,
      sourceSha256,
      normalizedSha256,
    }).status,
    'APPROVED',
  );
  // `releaseStatus: 'APPROVED'` must never be self-certifying: hold it fixed and break one piece of
  // evidence at a time. Without this the whole gate can be replaced by `review.releaseStatus ===
  // 'APPROVED'` and the suite still passes.
  const approved = {
    schemaVersion: 1,
    releaseStatus: 'APPROVED',
    rights: {status: 'APPROVED', evidence: 'asset-ledger.json#voice', approvedReferenceSha256: referenceSha256},
    listening: {
      status: 'APPROVED',
      reviewer: 'human-reviewer',
      reviewedAt: '2026-08-01T00:00:00Z',
      approvedSourceSha256: sourceSha256,
      approvedNormalizedSha256: normalizedSha256,
    },
  };
  const mutations = [
    ['review_schema', {schemaVersion: 0}],
    ['review_release_status', {releaseStatus: 'BLOCKED'}],
    ['rights_approved', {rights: {...approved.rights, status: 'NOT_RUN'}}],
    ['rights_approved', {rights: {...approved.rights, evidence: null}}],
    ['rights_approved', {rights: {...approved.rights, approvedReferenceSha256: sha256('other-voice')}}],
    ['listening_approved', {listening: {...approved.listening, status: 'NOT_RUN'}}],
    ['listening_approved', {listening: {...approved.listening, reviewer: null}}],
    ['listening_approved', {listening: {...approved.listening, reviewedAt: null}}],
    ['listening_approved', {listening: {...approved.listening, approvedSourceSha256: sha256('other-take')}}],
    ['listening_approved', {listening: {...approved.listening, approvedNormalizedSha256: sha256('other-mix')}}],
  ];
  for (const [checkId, patch] of mutations) {
    const result = evaluateVoiceoverRelease({
      review: {...approved, ...patch},
      referenceSha256,
      sourceSha256,
      normalizedSha256,
    });
    const label = JSON.stringify(patch);
    assert.equal(result.status, 'BLOCKED', `release survived ${label}`);
    assert.equal(result.checks.find((check) => check.id === checkId).passed, false, `${checkId} ignored ${label}`);
  }
});
