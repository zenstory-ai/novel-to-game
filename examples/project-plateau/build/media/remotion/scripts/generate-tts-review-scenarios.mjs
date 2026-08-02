import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

import {FISH_TTS_ENDPOINT, requestFingerprint, requestFishTts} from './fish-tts-client.mjs';
import {
  hydrateScenarioCandidates,
  resolveScenarioReference,
  scenarioContractSha256,
  validateProjectTrialCasting,
} from './tts-casting.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repositoryRoot = path.resolve(root, '../../../../..');
const configText = await readFile(path.join(root, 'tts-review-scenarios.json'), 'utf8');
const config = JSON.parse(configText);
const scenarios = await hydrateScenarioCandidates(config.scenarios, {repositoryRoot});
const scope = process.argv.includes('--matrix') ? 'qa-matrix' : 'project-trial';
const outputDir = path.join(root, 'out', 'tts-review-scenarios', scope);
const apiKey = process.env.FISH_API_KEY;
const selectedScenarios = scenarios.filter((item) => item.scope === scope);

if (!apiKey) throw new Error('FISH_API_KEY is required through the environment; a key pasted into chat must be rotated, not reused.');
if (process.env.FISH_VOICE_RIGHTS_ATTESTED !== '1') {
  throw new Error('Set FISH_VOICE_RIGHTS_ATTESTED=1 to attest that the selected review voice may be used.');
}
validateProjectTrialCasting(scenarios);
const preparedScenarios = selectedScenarios.map((scenario) => ({
  scenario,
  reference: scenario.source === 'generate' ? resolveScenarioReference({scenario}) : null,
}));

await mkdir(outputDir, {recursive: true, mode: 0o700});
const results = [];
const failures = [];

for (const {scenario, reference} of preparedScenarios) {
  try {
    if (scenario.source === 'existing-file') {
      const target = path.resolve(root, scenario.file);
      const metadataTarget = path.resolve(root, scenario.metadata_file);
      if (!target.startsWith(`${root}${path.sep}`) || !metadataTarget.startsWith(`${root}${path.sep}`)) {
        throw new Error(`${scenario.id}: existing trial path leaves the Remotion workspace.`);
      }
      const [audio, metadataText] = await Promise.all([readFile(target), readFile(metadataTarget, 'utf8')]);
      const metadata = JSON.parse(metadataText);
      const audioSha256 = createHash('sha256').update(audio).digest('hex');
      if (metadata.schemaVersion !== 4 || metadata.sourceSha256 !== audioSha256) {
        throw new Error(`${scenario.id}: existing narration is not bound to a valid schema-4 provenance record.`);
      }
      results.push({
        id: scenario.id,
        status: 'EXISTING_NOT_APPROVED',
        project: scenario.project,
        language: scenario.language,
        speaker: scenario.speaker,
        voiceProfile: scenario.voice_profile,
        file: path.relative(root, target),
        provider: metadata.provider,
        endpoint: metadata.endpoint,
        model: metadata.model,
        textSha256: metadata.textSha256,
        requestSha256: metadata.requestSha256,
        audioSha256,
        referenceSha256: metadata.referenceSha256,
        attempts: metadata.attempts,
        contentType: metadata.contentType,
        minimumSeconds: scenario.minimum_seconds,
        maximumSeconds: scenario.maximum_seconds,
        reference: metadata.reference,
        referenceEnv: null,
      });
      console.log(`Recorded existing ${scenario.id} (${audio.length} bytes).`);
      continue;
    }

    const {referenceId, referenceEnv} = reference;
    const body = {
      text: scenario.text,
      reference_id: referenceId,
      format: config.defaults.format,
      sample_rate: config.defaults.sample_rate,
      mp3_bitrate: config.defaults.mp3_bitrate,
      temperature: config.defaults.temperature,
      top_p: config.defaults.top_p,
      latency: 'normal',
      normalize: true,
      prosody: {speed: config.defaults.speed, volume: 0, normalize_loudness: true},
    };
    const result = await requestFishTts({
      apiKey,
      model: config.defaults.model,
      body,
      timeoutMs: 60_000,
      maxAttempts: 3,
    });
    const target = path.join(outputDir, `${scenario.id}.mp3`);
    await writeFile(target, result.audio, {mode: 0o600});
    results.push({
      id: scenario.id,
      status: 'GENERATED_NOT_APPROVED',
      project: scenario.project || null,
      language: scenario.language,
      speaker: scenario.speaker || null,
      voiceProfile: scenario.voice_profile || null,
      file: path.relative(root, target),
      provider: 'fish-audio',
      endpoint: FISH_TTS_ENDPOINT,
      model: config.defaults.model,
      textSha256: createHash('sha256').update(scenario.text).digest('hex'),
      requestSha256: requestFingerprint({
        model: config.defaults.model,
        body,
        context: {language: scenario.language},
      }),
      audioSha256: createHash('sha256').update(result.audio).digest('hex'),
      referenceSha256: createHash('sha256').update(referenceId).digest('hex'),
      attempts: result.attempts,
      contentType: result.contentType,
      minimumSeconds: scenario.minimum_seconds,
      maximumSeconds: scenario.maximum_seconds,
      reference: 'environment-provided-rights-attested-reference',
      referenceEnv,
    });
    console.log(`Generated ${scenario.id} (${result.audio.length} bytes, ${result.attempts} attempt(s)).`);
  } catch (error) {
    failures.push({id: scenario.id, status: 'FAILED', reason: error.message});
    console.error(`FAILED ${scenario.id}: ${error.message}`);
  }
}

const manifest = {
  schemaVersion: 3,
  scenarioContractSha256: scenarioContractSha256(config, scenarios),
  status: failures.length ? (results.length ? 'PARTIAL' : 'FAILED') : 'GENERATED_NOT_APPROVED',
  scope,
  expectedScenarioIds: selectedScenarios.map((scenario) => scenario.id).sort(),
  policy: config.policy,
  results,
  failures,
  manualListening: {status: 'NOT_RUN', reason: 'Run verification, then record a human listening review before integration.'},
};
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
console.log(`Wrote ${results.length} review sample(s) to ${outputDir}.`);
if (failures.length) process.exitCode = 1;
