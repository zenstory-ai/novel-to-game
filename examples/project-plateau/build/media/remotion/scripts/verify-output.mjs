import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const githubDelivery = process.argv.includes('--github');
const output = path.join(
  root,
  'out',
  githubDelivery ? 'project-plateau-promo-36s-github.mp4' : 'project-plateau-promo-36s.mp4',
);
const maximumBytes = githubDelivery ? 10_000_000 : 25_000_000;
const probe = spawnSync(
  'ffprobe',
  [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt,color_range,color_space,field_order,sample_rate,channels',
    '-of',
    'json',
    output,
  ],
  {encoding: 'utf8'},
);

if (probe.status !== 0) {
  console.error(probe.stderr || `Could not probe ${output}`);
  process.exit(probe.status ?? 1);
}

const result = JSON.parse(probe.stdout);
const video = result.streams.find((stream) => stream.codec_type === 'video');
const audio = result.streams.find((stream) => stream.codec_type === 'audio');
const duration = Number(result.format.duration);
const bytes = await readFile(output);
const moov = bytes.indexOf(Buffer.from('moov'));
const mdat = bytes.indexOf(Buffer.from('mdat'));
const volumeProbe = spawnSync(
  'ffmpeg',
  ['-hide_banner', '-i', output, '-af', 'volumedetect', '-f', 'null', '-'],
  {encoding: 'utf8'},
);
if (volumeProbe.status !== 0) {
  console.error(volumeProbe.stderr || `Could not measure audio levels for ${output}`);
  process.exit(volumeProbe.status ?? 1);
}
const meanVolume = Number(volumeProbe.stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1]);
const maxVolume = Number(volumeProbe.stderr.match(/max_volume:\s*(-?[0-9.]+) dB/)?.[1]);
const checks = [
  ['duration is 36 seconds', Math.abs(duration - 36) <= 0.05],
  ['video codec is H.264', video?.codec_name === 'h264'],
  ['H.264 profile is High', video?.profile === 'High'],
  ['dimensions are 1920x1080', video?.width === 1920 && video?.height === 1080],
  ['frame rate is 30 fps', video?.r_frame_rate === '30/1'],
  ['pixel format is yuv420p', video?.pix_fmt === 'yuv420p'],
  ['colour is BT.709 limited range', video?.color_range === 'tv' && video?.color_space === 'bt709'],
  ['scan is progressive', video?.field_order === 'progressive'],
  ['audio codec is AAC', audio?.codec_name === 'aac'],
  ['audio is 48 kHz stereo', audio?.sample_rate === '48000' && audio?.channels === 2],
  ['mix loudness is usable', meanVolume >= -26 && meanVolume <= -14],
  ['mix has headroom without being faint', maxVolume >= -10 && maxVolume <= -1],
  ['MP4 is fast-start', moov > 0 && mdat > 0 && moov < mdat],
  [`file is at most ${githubDelivery ? '10' : '25'} MB`, bytes.length <= maximumBytes],
];

for (const [label, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
if (checks.some(([, pass]) => !pass)) process.exit(1);

console.log(`PASS  sha256 ${createHash('sha256').update(bytes).digest('hex')}`);
console.log(`PASS  file size ${(bytes.length / 1_000_000).toFixed(2)} MB`);
console.log(`PASS  mix ${meanVolume.toFixed(1)} dB mean / ${maxVolume.toFixed(1)} dB peak`);
