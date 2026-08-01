import {mkdir, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const output = path.join(root, 'out', 'review');
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});

const frames = [
  [45, '01-opener.png'],
  [150, '02-explore.png'],
  [330, '03-commit.png'],
  [510, '04-observe.png'],
  [750, '05-return.png'],
  [930, '06-proof.png'],
  [1030, '07-closing.png'],
];

for (const [frame, name] of frames) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'remotion',
      'still',
      'src/index.jsx',
      'ProjectPlateauPromo',
      path.join(output, name),
      `--frame=${frame}`,
      '--image-format=png',
      '--overwrite',
    ],
    {cwd: root, stdio: 'inherit'},
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
