import {rm, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const input = path.join(root, 'out', 'project-plateau-promo-36s.mp4');
const output = path.join(root, 'out', 'project-plateau-promo-36s-github.mp4');
const passlog = path.join(root, 'out', '.github-h264-pass');

await stat(input).catch(() => {
  throw new Error(`Missing master render: ${input}\nRun npm run render first.`);
});

const videoArgs = [
  '-vf',
  'scale=in_range=auto:out_range=tv,format=yuv420p',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-tune',
  'film',
  '-b:v',
  '1900k',
  '-profile:v',
  'high',
  '-level:v',
  '4.1',
  '-pix_fmt',
  'yuv420p',
  '-color_range',
  'tv',
  '-colorspace',
  'bt709',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-t',
  '36',
  '-passlogfile',
  passlog,
];

const run = (args) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Two-pass H.264 spends the fixed GitHub byte budget where the moving foliage
// and gameplay need it most, while keeping the original 1080p frame size.
run(['-i', input, '-map', '0:v:0', ...videoArgs, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
run([
  '-i',
  input,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0?',
  ...videoArgs,
  '-pass',
  '2',
  '-c:a',
  'aac',
  '-b:a',
  '160k',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-movflags',
  '+faststart',
  output,
]);

await Promise.all([
  rm(`${passlog}-0.log`, {force: true}),
  rm(`${passlog}-0.log.mbtree`, {force: true}),
]);

const {size} = await stat(output);
if (size > 10_000_000) {
  throw new Error(`GitHub delivery is ${(size / 1_000_000).toFixed(2)} MB; expected at most 10.00 MB.`);
}

console.log(`Compressed ${output} (${(size / 1_000_000).toFixed(2)} MB)`);
