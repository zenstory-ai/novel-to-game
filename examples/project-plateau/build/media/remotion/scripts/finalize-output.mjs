import {rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const intermediate = path.join(root, 'out', 'project-plateau-promo-36s-remotion.mp4');
const output = path.join(root, 'out', 'project-plateau-promo-36s.mp4');

const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    intermediate,
    '-vf',
    'scale=in_range=auto:out_range=tv,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
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
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-t',
    '36',
    '-movflags',
    '+faststart',
    output,
  ],
  {cwd: root, stdio: 'inherit'},
);

if (result.status !== 0) process.exit(result.status ?? 1);
await rm(intermediate);
console.log(`Finalized ${output}`);
