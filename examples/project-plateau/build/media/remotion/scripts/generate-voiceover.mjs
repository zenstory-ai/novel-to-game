import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const publicDir = path.join(root, 'public');
const config = JSON.parse(await readFile(path.join(root, 'voiceover.json'), 'utf8'));
const apiKey = process.env.FISH_API_KEY;
const reuseSource = process.argv.includes('--reuse-source');
const source = path.join(publicDir, 'voiceover-source.mp3');
const sourceMetadataPath = path.join(publicDir, 'voiceover-source.json');
const output = path.join(publicDir, 'voiceover.wav');
const textSha256 = createHash('sha256').update(config.text).digest('hex');
const configuredReferenceId = config.voice?.reference_id;
const referenceId = process.env.FISH_REFERENCE_ID || configuredReferenceId;
const referenceSha256 = referenceId
  ? createHash('sha256').update(referenceId).digest('hex')
  : null;

if (!reuseSource && !apiKey) {
  throw new Error('FISH_API_KEY is required. Pass it through the environment; never add it to this repository.');
}

await mkdir(publicDir, {recursive: true});

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

let sourceMetadata;
if (!reuseSource) {
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model: config.model,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.text()).slice(0, 500);
    throw new Error(`Fish Audio TTS failed with HTTP ${response.status}: ${error}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1024) throw new Error('Fish Audio returned an unexpectedly small response.');
  await writeFile(source, audio, {mode: 0o600});
  sourceMetadata = {
    schemaVersion: 2,
    model: config.model,
    textSha256,
    sourceSha256: createHash('sha256').update(audio).digest('hex'),
    referenceSha256,
    reference: process.env.FISH_REFERENCE_ID
      ? 'environment-provided-reference'
      : configuredReferenceId
        ? 'configured-public-reference'
        : 'provider-default',
  };
  await writeFile(sourceMetadataPath, `${JSON.stringify(sourceMetadata, null, 2)}\n`, {mode: 0o600});
} else {
  const [sourceAudio, rawMetadata] = await Promise.all([
    readFile(source),
    readFile(sourceMetadataPath, 'utf8'),
  ]);
  sourceMetadata = JSON.parse(rawMetadata);
  const sourceSha256 = createHash('sha256').update(sourceAudio).digest('hex');
  if (
    sourceMetadata.model !== config.model ||
    sourceMetadata.textSha256 !== textSha256 ||
    sourceMetadata.sourceSha256 !== sourceSha256 ||
    sourceMetadata.referenceSha256 !== referenceSha256
  ) {
    throw new Error('The ignored Fish Audio source does not match the current model, script, or recorded hash.');
  }
  console.log('Reusing the existing ignored Fish Audio source file.');
}

const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', source],
  {encoding: 'utf8'},
);
if (probe.status !== 0) throw new Error(`Could not probe generated voiceover: ${probe.stderr}`);

const sourceDuration = Number(probe.stdout.trim());
if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
  throw new Error(`Invalid generated voiceover duration: ${probe.stdout.trim()}`);
}

// Preserve the model's requested prosody. Only accelerate as a safety valve when
// a generated take would overrun the visual CTA; never stretch a short take to
// fill the timeline, which makes speech sound slow and artificially aged.
const speed = Math.max(1, sourceDuration / config.mix.maximum_seconds);
if (speed > 2) {
  throw new Error(
    `Generated voiceover cannot be fit cleanly: ${sourceDuration.toFixed(2)}s → ${config.mix.maximum_seconds.toFixed(2)}s`,
  );
}

const filters = [];
if (Math.abs(speed - 1) > 0.001) filters.push(`atempo=${speed.toFixed(6)}`);
filters.push('highpass=f=70');
filters.push(`loudnorm=I=${config.mix.target_lufs}:TP=${config.mix.true_peak_db}:LRA=7`);

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
    filters.join(','),
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

console.log(`Generated voiceover.wav (${Number(finalProbe.stdout).toFixed(2)}s, ${normalized.length} bytes)`);
console.log(`Voiceover sha256 ${createHash('sha256').update(normalized).digest('hex')}`);
console.log(`Voice model ${config.voice?.name || sourceMetadata.reference}`);
