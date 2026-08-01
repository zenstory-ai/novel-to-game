import {copyFile, mkdir, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const media = path.resolve(root, '..');
const publicDir = path.join(root, 'public');

const inputs = [
  {
    source: path.join(media, 'clip', 'project-plateau-30s.mp4'),
    target: path.join(publicDir, 'gameplay.mp4'),
    label: 'continuous 30-second Strong route',
  },
  {
    source: path.resolve(media, '..', 'evidence', 's8', '05-strong-input-result.jpg'),
    target: path.join(publicDir, 'result.jpg'),
    label: 'Strong result browser frame',
  },
];

const sha256 = async (file) => {
  const data = await import('node:fs').then(({readFileSync}) => readFileSync(file));
  return createHash('sha256').update(data).digest('hex');
};

await mkdir(publicDir, {recursive: true});

for (const input of inputs) {
  try {
    await stat(input.source);
  } catch {
    throw new Error(
      `Missing ${input.label}: ${input.source}\n` +
        'Regenerate the gameplay media from build/app before rendering the launch video.',
    );
  }
  await copyFile(input.source, input.target);
  console.log(`Prepared ${path.basename(input.target)} (${await sha256(input.target)})`);
}

const sampleRate = 48000;
const seconds = 36;
const channels = 2;
const samples = sampleRate * seconds;
const dataBytes = samples * channels * 2;
const wav = Buffer.alloc(44 + dataBytes);

wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataBytes, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(channels, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channels * 2, 28);
wav.writeUInt16LE(channels * 2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataBytes, 40);

const chimes = [0.25, 3, 7.5, 13, 20, 29, 33];
let noise = 0;
let seed = 0x5f3759df;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  noise = noise * 0.988 + (random() * 2 - 1) * 0.012;
  const fadeIn = Math.min(1, t / 1.5);
  const fadeOut = Math.min(1, (seconds - t) / 1.8);
  const bed =
    Math.sin(Math.PI * 2 * 55 * t) * 0.07 +
    Math.sin(Math.PI * 2 * 82.5 * t + 0.4) * 0.045 +
    Math.sin(Math.PI * 2 * 110 * t + Math.sin(t * 0.23) * 0.7) * 0.025;
  let accentLeft = 0;
  let accentRight = 0;
  for (let c = 0; c < chimes.length; c += 1) {
    const dt = t - chimes[c];
    if (dt >= 0 && dt < 2.2) {
      const env = Math.exp(-dt * 2.25);
      const base = 220 * (1 + (c % 3) * 0.25);
      accentLeft += Math.sin(Math.PI * 2 * base * dt) * env * 0.095;
      accentRight += Math.sin(Math.PI * 2 * (base * 1.005) * dt + 0.35) * env * 0.095;
    }
  }
  const pulsePhase = t % 1.5;
  const pulse = Math.sin(Math.PI * 2 * 58 * pulsePhase) * Math.exp(-pulsePhase * 10) * 0.045;
  const master = fadeIn * fadeOut;
  const left = Math.max(-1, Math.min(1, (bed + noise * 0.025 + pulse + accentLeft) * master));
  const right = Math.max(-1, Math.min(1, (bed + noise * 0.022 + pulse + accentRight) * master));
  const offset = 44 + i * 4;
  wav.writeInt16LE(Math.round(left * 32767), offset);
  wav.writeInt16LE(Math.round(right * 32767), offset + 2);
}

const soundtrack = path.join(publicDir, 'soundtrack.wav');
await writeFile(soundtrack, wav);
console.log(`Prepared soundtrack.wav (${await sha256(soundtrack)})`);

const voiceover = path.join(publicDir, 'voiceover.wav');
try {
  await stat(voiceover);
} catch {
  throw new Error(
    `Missing generated voiceover: ${voiceover}\n` +
      'Run FISH_API_KEY=... npm run voiceover before rendering. The key must remain outside the repository.',
  );
}
console.log(`Prepared voiceover.wav (${await sha256(voiceover)})`);
