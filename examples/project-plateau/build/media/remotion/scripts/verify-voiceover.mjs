import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

import {evaluateAudio, inspectAudio} from './audio-qa.mjs';
import {
  buildNormalizationPlan,
  buildVoiceoverRequestContract,
  evaluateVoiceoverProvenance,
  sha256,
} from './voiceover-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const config = JSON.parse(await readFile(path.join(root, 'voiceover.json'), 'utf8'));
const sourcePath = path.join(root, 'public', 'voiceover-source.mp3');
const normalizedPath = path.join(root, 'public', 'voiceover.wav');
const metadataPath = path.join(root, 'public', 'voiceover-source.json');
const outputPath = path.join(root, 'out', 'voiceover-qa.json');

// The generated audio is ignored by Git, so a clean checkout has nothing to inspect. Report that as
// NOT_RUN instead of letting ffprobe fail with a stack trace that reads like a broken toolchain.
for (const target of [sourcePath, normalizedPath]) {
  try {
    await stat(target);
  } catch {
    console.error(
      `NOT_RUN voiceover: ${path.relative(root, target)} is absent; ` +
        'run `FISH_API_KEY=… npm run voiceover` first.',
    );
    process.exit(2);
  }
}

const [source, normalized] = await Promise.all([inspectAudio(sourcePath), inspectAudio(normalizedPath)]);
const sourceEvaluation = evaluateAudio(source, {
  codec: 'mp3',
  sampleRate: config.delivery.sample_rate,
  bitrate: config.delivery.mp3_bitrate * 1000,
  bitrateTolerance: 4000,
  minimumSeconds: 1,
  minimumActiveRatio: 0.03,
  maximumClippedRatio: 0.0001,
});
const normalizedEvaluation = evaluateAudio(normalized, {
  codec: 'pcm_s16le',
  sampleRate: 48000,
  channels: 2,
  minimumSeconds: 1,
  maximumSeconds: config.mix.maximum_seconds + 0.05,
  minimumActiveRatio: 0.03,
  maximumClippedRatio: 0.0001,
  targetLufs: config.mix.target_lufs,
  lufsTolerance: 1,
  maximumTruePeakDbfs: config.mix.true_peak_db + 0.1,
  maximumEdgeSilenceSeconds: 1,
});

let metadata;
try {
  metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
} catch (error) {
  metadata = {readError: error.code || error.message};
}
// Resolve the recorded reference by evidence, not by the free-text `reference` label the sidecar
// carries: the label is not itself hash-bound, so trusting it turns a missing environment variable
// into two opaque hash mismatches that read like tampering.
const referenceCandidates = [
  {id: process.env.FISH_REFERENCE_ID, origin: 'FISH_REFERENCE_ID'},
  {id: config.voice?.reference_id, origin: 'voiceover.json voice.reference_id'},
  {id: undefined, origin: 'provider default'},
];
const matchedReference = referenceCandidates.findIndex(
  (candidate) => (candidate.id ? sha256(candidate.id) : null) === metadata.referenceSha256,
);
const referenceId =
  matchedReference < 0 ? config.voice?.reference_id : referenceCandidates[matchedReference].id;
const requestContract = buildVoiceoverRequestContract(config, referenceId);
// A source too long to fit even at 2x cannot have produced this WAV under this config. Record that
// as a failed check rather than throwing, so out/voiceover-qa.json is still written for review.
let normalizationPlan;
let normalizationPlanError = null;
try {
  normalizationPlan = buildNormalizationPlan(config, source.durationSeconds, source.sha256);
} catch (error) {
  normalizationPlanError = error.message;
  normalizationPlan = {speed: 1, filters: [], normalizationSha256: null};
}
const provenance = evaluateVoiceoverProvenance({
  metadata,
  config,
  requestContract,
  sourceSha256: source.sha256,
  normalizedSha256: normalized.sha256,
  normalizationSha256: normalizationPlan.normalizationSha256,
});
// Compare against the duration the normalization plan asked for, not against the raw source: the
// plan deliberately time-compresses an overlong take by up to 2x, so a raw-source tolerance would
// reject exactly the takes the safety valve exists to rescue.
const plannedDurationSeconds = Number((source.durationSeconds / normalizationPlan.speed).toFixed(4));
const crossChecks = [
  {
    id: 'normalization_plan_is_buildable',
    passed: normalizationPlanError === null,
    evidence: normalizationPlanError || `${normalizationPlan.speed.toFixed(6)}x tempo plan`,
  },
  {
    id: 'source_and_normalized_duration_are_consistent',
    passed: Math.abs(normalized.durationSeconds - plannedDurationSeconds) <= 0.25,
    evidence:
      `${normalized.durationSeconds}s normalized; ${plannedDurationSeconds}s planned from ` +
      `${source.durationSeconds}s at ${normalizationPlan.speed.toFixed(6)}x`,
  },
  {
    id: 'recorded_reference_is_resolvable',
    passed: matchedReference >= 0,
    evidence:
      matchedReference >= 0
        ? `recorded reference resolved from ${referenceCandidates[matchedReference].origin}`
        : `recorded referenceSha256 ${metadata.referenceSha256 ?? 'missing'} matches neither ` +
          'FISH_REFERENCE_ID nor voiceover.json voice.reference_id; export the variable used at generation time',
  },
];
const automatedPassed =
  sourceEvaluation.passed &&
  normalizedEvaluation.passed &&
  provenance.status === 'RECORDED' &&
  crossChecks.every((item) => item.passed);
const report = {
  schemaVersion: 2,
  status: automatedPassed ? 'PASS' : 'FAIL',
  scope: 'automated decode, format, bitrate, duration, signal, clipping, loudness, true-peak, edge-silence and provenance checks',
  source: {...source, evaluation: sourceEvaluation},
  normalized: {...normalized, evaluation: normalizedEvaluation},
  crossChecks,
  provenance,
  limitations: [
    'Naturalness, casting preference and publication rights are not machine-proven by this report.',
  ],
};

await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

for (const [name, evaluation] of [
  ['source', sourceEvaluation],
  ['normalized', normalizedEvaluation],
]) {
  for (const check of evaluation.checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${name}.${check.id}: ${check.evidence}`);
  }
}
for (const check of crossChecks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.id}: ${check.evidence}`);
for (const check of provenance.checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} provenance.${check.id}: ${check.evidence}`);
}
console.log(`${report.status} voiceover`);
console.log(`Wrote ${outputPath}`);

if (!automatedPassed) process.exitCode = 1;
