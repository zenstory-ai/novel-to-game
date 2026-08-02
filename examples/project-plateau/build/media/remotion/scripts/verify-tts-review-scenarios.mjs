import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

import {evaluateAudio, inspectAudio} from './audio-qa.mjs';
import {FISH_TTS_ENDPOINT} from './fish-tts-client.mjs';
import {
  hydrateScenarioCandidates,
  scenarioContractSha256,
  scenarioCoverageChecks,
} from './tts-casting.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repositoryRoot = path.resolve(root, '../../../../..');
const scope = process.argv.includes('--matrix') ? 'qa-matrix' : 'project-trial';
const outputDir = path.join(root, 'out', 'tts-review-scenarios', scope);
const configText = await readFile(path.join(root, 'tts-review-scenarios.json'), 'utf8');
const config = JSON.parse(configText);
const scenarios = await hydrateScenarioCandidates(config.scenarios, {repositoryRoot});
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(
      `NOT_RUN tts_review_scenarios.${scope}: no generated manifest; ` +
        'run the matching generation command with a rotated credential.',
    );
    process.exit(2);
  }
  throw error;
}
const reviewed = [];
const contractChecks = [
  {
    id: 'manifest_schema',
    passed: manifest.schemaVersion === 3,
    evidence: `${manifest.schemaVersion} == 3`,
  },
  {
    id: 'scenario_contract_sha256',
    passed: manifest.scenarioContractSha256 === scenarioContractSha256(config, scenarios),
    evidence: 'generated samples use the current provider config and owner-authored audition contracts',
  },
  ...scenarioCoverageChecks({scope, scenarios, manifest}),
];

for (const item of manifest.results || []) {
  let metrics;
  let evaluation;
  try {
    const scenario = scenarios.find((candidate) => candidate.id === item.id);
    if (!scenario || scenario.scope !== scope) throw new Error('manifest result is not part of the selected scope');
    const target = path.resolve(root, item.file);
    const expectedExistingTarget = scenario.source === 'existing-file' ? path.resolve(root, scenario.file) : null;
    if (
      scenario.source === 'existing-file'
        ? target !== expectedExistingTarget
        : !target.startsWith(`${outputDir}${path.sep}`)
    ) {
      throw new Error('audio path does not match the configured review location');
    }
    metrics = await inspectAudio(target);
    evaluation = evaluateAudio(metrics, {
      codec: 'mp3',
      sampleRate: 44100,
      bitrate: config.defaults.mp3_bitrate * 1000,
      bitrateTolerance: 4000,
      minimumSeconds: item.minimumSeconds,
      maximumSeconds: item.maximumSeconds,
      minimumActiveRatio: 0.03,
      maximumClippedRatio: 0.0001,
      maximumTruePeakDbfs: -0.1,
      maximumEdgeSilenceSeconds: 1.5,
    });
    const expectedFile =
      scenario.source === 'existing-file'
        ? scenario.file
        : path.posix.join('out', 'tts-review-scenarios', scope, `${scenario.id}.mp3`);
    evaluation.checks.push(
      {
        id: 'scenario_identity',
        passed:
          item.project === (scenario.project || null) &&
          item.language === scenario.language &&
          item.speaker === (scenario.speaker || null) &&
          JSON.stringify(item.voiceProfile) === JSON.stringify(scenario.voice_profile || null),
        evidence: `${item.project || 'qa'} / ${item.language || 'missing'} / ${item.speaker || 'no-speaker'}`,
      },
      {
        id: 'provider_contract',
        passed:
          item.provider === 'fish-audio' &&
          item.endpoint === FISH_TTS_ENDPOINT &&
          item.model === config.defaults.model,
        evidence: `${item.provider || 'missing'} / ${item.model || 'missing'}`,
      },
      {
        id: 'scenario_file',
        passed: item.file === expectedFile,
        evidence: `${item.file || 'missing'} == ${expectedFile}`,
      },
      {
        id: 'duration_contract',
        passed:
          item.minimumSeconds === scenario.minimum_seconds &&
          item.maximumSeconds === scenario.maximum_seconds,
        evidence: `${item.minimumSeconds}–${item.maximumSeconds}s`,
      },
    );
    if (scenario.source === 'generate') {
      evaluation.checks.push({
        id: 'text_sha256',
        passed: item.textSha256 === createHash('sha256').update(scenario.text).digest('hex'),
        evidence: item.textSha256 || 'missing',
      });
    } else {
      const metadata = JSON.parse(await readFile(path.resolve(root, scenario.metadata_file), 'utf8'));
      // Bind the recorded text hash to the narration script itself. The manifest copies textSha256
      // out of this sidecar, so comparing the two back to each other proves nothing about the
      // script that is actually shipped.
      const scriptPath = path.resolve(repositoryRoot, scenario.source_ref || '');
      if (!scenario.source_ref || !scriptPath.startsWith(`${repositoryRoot}${path.sep}`)) {
        throw new Error('existing trial needs a repository-relative source_ref for its narration script');
      }
      const script = JSON.parse(await readFile(scriptPath, 'utf8'));
      const scriptTextSha256 = createHash('sha256').update(String(script.text ?? '')).digest('hex');
      evaluation.checks.push({
        id: 'existing_provenance',
        passed:
          metadata.schemaVersion === 4 &&
          metadata.sourceSha256 === metrics.sha256 &&
          item.textSha256 === metadata.textSha256 &&
          item.requestSha256 === metadata.requestSha256 &&
          item.referenceSha256 === metadata.referenceSha256 &&
          metadata.textSha256 === scriptTextSha256,
        evidence:
          `schema ${metadata.schemaVersion}; source ${metadata.sourceSha256 || 'missing'}; ` +
          `script ${scriptTextSha256} == recorded ${metadata.textSha256 || 'missing'}`,
      });
    }
    if (scenario?.scope === 'project-trial') {
      evaluation.checks.push({
        id: 'speaker_casting',
        passed:
          item.speaker === scenario.speaker &&
          JSON.stringify(item.voiceProfile) === JSON.stringify(scenario.voice_profile),
        evidence: `${item.speaker || 'missing'} -> ${scenario.voice_profile?.casting_id || 'missing'}`,
      });
      if (scenario.source === 'generate') {
        evaluation.checks.push({
          id: 'scenario_voice_reference',
          passed: item.referenceEnv === scenario.reference_env,
          evidence: `${item.referenceEnv || 'missing'} == ${scenario.reference_env || 'missing'}`,
        });
      }
    }
    evaluation.checks.push({
      id: 'recorded_audio_sha256',
      passed: metrics.sha256 === item.audioSha256,
      evidence: `${metrics.sha256} == ${item.audioSha256}`,
    });
    evaluation.passed = evaluation.checks.every((check) => check.passed);
  } catch (error) {
    metrics = null;
    evaluation = {
      passed: false,
      checks: [{id: 'decode', passed: false, evidence: error.message}],
    };
  }
  reviewed.push({...item, metrics, evaluation});
  for (const check of evaluation.checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${item.id}.${check.id}: ${check.evidence}`);
  }
}

if (manifest.scope === 'project-trial') {
  const referenceHashes = (manifest.results || []).map((item) => item.referenceSha256);
  contractChecks.push({
    id: 'distinct_character_references',
    passed:
      referenceHashes.length > 0 &&
      referenceHashes.every(Boolean) &&
      new Set(referenceHashes).size === referenceHashes.length,
    evidence:
      `${new Set(referenceHashes.filter(Boolean)).size} distinct reference(s) for ` +
      `${referenceHashes.length} audition(s)`,
  });
}

for (const check of contractChecks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} contract.${check.id}: ${check.evidence}`);
}

const automatedPassed =
  !manifest.failures?.length &&
  contractChecks.every((check) => check.passed) &&
  reviewed.length > 0 &&
  reviewed.every((item) => item.evaluation.passed);
const report = {
  schemaVersion: 2,
  status: automatedPassed ? 'AUTOMATED_PASS' : 'FAIL',
  automatedStatus: automatedPassed ? 'PASS' : 'FAIL',
  releaseStatus: 'BLOCKED',
  scope: manifest.scope,
  scenarios: reviewed,
  contractChecks,
  generationFailures: manifest.failures || [],
  manualListening: manifest.manualListening,
};
await mkdir(outputDir, {recursive: true});
await writeFile(path.join(outputDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`NOT_RUN manual_listening: ${report.manualListening.reason}`);
console.log(`${report.status} ${scope}; release ${report.releaseStatus}`);
if (!automatedPassed) process.exitCode = 1;
