import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

import {requestFishTts} from './fish-tts-client.mjs';
import {
  VOICEOVER_METADATA_SCHEMA,
  buildNormalizationPlan,
  buildVoiceoverRequestContract,
  resolveVoiceoverReference,
  sha256,
} from './voiceover-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const publicDir = path.join(root, 'public');
const config = JSON.parse(await readFile(path.join(root, 'voiceover.json'), 'utf8'));
const apiKey = process.env.FISH_API_KEY;
const reuseSource = process.argv.includes('--reuse-source');
const source = path.join(publicDir, 'voiceover-source.mp3');
const sourceMetadataPath = path.join(publicDir, 'voiceover-source.json');
const output = path.join(publicDir, 'voiceover.wav');
const {referenceId, referenceSha256, referenceSource} = resolveVoiceoverReference(config);
const requestContract = buildVoiceoverRequestContract(config, referenceId);

if (!reuseSource && !apiKey) {
  throw new Error('FISH_API_KEY is required. Pass it through the environment; never add it to this repository.');
}

await mkdir(publicDir, {recursive: true});

let sourceMetadata;
if (!reuseSource) {
  const result = await requestFishTts({
    apiKey,
    endpoint: requestContract.endpoint,
    model: config.model,
    body: requestContract.body,
    timeoutMs: config.request?.timeout_ms ?? 60_000,
    maxAttempts: config.request?.max_attempts ?? 3,
  });
  const {audio} = result;
  await writeFile(source, audio, {mode: 0o600});
  sourceMetadata = {
    schemaVersion: VOICEOVER_METADATA_SCHEMA,
    provider: 'fish-audio',
    endpoint: requestContract.endpoint,
    model: config.model,
    textSha256: requestContract.textSha256,
    requestSha256: requestContract.requestSha256,
    sourceSha256: sha256(audio),
    referenceSha256,
    attempts: result.attempts,
    contentType: result.contentType,
    reference: referenceSource,
  };
} else {
  const [sourceAudio, rawMetadata] = await Promise.all([
    readFile(source),
    readFile(sourceMetadataPath, 'utf8'),
  ]);
  sourceMetadata = JSON.parse(rawMetadata);
  const sourceSha256 = sha256(sourceAudio);
  if (
    sourceMetadata.schemaVersion !== VOICEOVER_METADATA_SCHEMA ||
    sourceMetadata.provider !== 'fish-audio' ||
    sourceMetadata.endpoint !== requestContract.endpoint ||
    sourceMetadata.model !== config.model ||
    sourceMetadata.textSha256 !== requestContract.textSha256 ||
    sourceMetadata.requestSha256 !== requestContract.requestSha256 ||
    sourceMetadata.sourceSha256 !== sourceSha256 ||
    sourceMetadata.referenceSha256 !== referenceSha256
  ) {
    throw new Error(
      'The ignored Fish Audio source does not match the current request contract. Regenerate it with a safe rotated environment credential; legacy sidecars are not silently trusted.',
    );
  }
  console.log('Reusing the existing ignored Fish Audio source file.');
}

const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', source],
  {encoding: 'utf8'},
);
if (probe.status !== 0) throw new Error(`Could not probe generated voiceover: ${probe.stderr}`);

// Preserve the model's requested prosody. Only accelerate as a safety valve when
// a generated take would overrun the visual CTA; never stretch a short take to
// fill the timeline, which makes speech sound slow and artificially aged.
const sourceDuration = Number(probe.stdout.trim());
const normalizationPlan = buildNormalizationPlan(config, sourceDuration, sourceMetadata.sourceSha256);

const transcode = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-af',
    normalizationPlan.filters.join(','),
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    output,
  ],
  {encoding: 'utf8'},
);
if (transcode.status !== 0) throw new Error(`Could not normalize voiceover: ${transcode.stderr}`);

const normalized = await readFile(output);
const finalProbe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output],
  {encoding: 'utf8'},
);
if (finalProbe.status !== 0) throw new Error(`Could not probe normalized voiceover: ${finalProbe.stderr}`);

sourceMetadata = {
  ...sourceMetadata,
  schemaVersion: VOICEOVER_METADATA_SCHEMA,
  normalizedSha256: sha256(normalized),
  normalizationSha256: normalizationPlan.normalizationSha256,
  normalizedDurationSeconds: Number(Number(finalProbe.stdout).toFixed(4)),
};
await writeFile(sourceMetadataPath, `${JSON.stringify(sourceMetadata, null, 2)}\n`, {mode: 0o600});

console.log(`Generated voiceover.wav (${Number(finalProbe.stdout).toFixed(2)}s, ${normalized.length} bytes)`);
console.log(`Voiceover sha256 ${sourceMetadata.normalizedSha256}`);
console.log(`Voice model ${config.voice?.name || sourceMetadata.reference}`);
