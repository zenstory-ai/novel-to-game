# Run Project Plateau

Requirements: Node.js `>=22.12.0`, npm and a desktop browser with WebGL2.

```bash
npm ci
npm run start -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. Runtime code, assets, fonts and effects are local;
the app has no analytics or CDN dependency.

## Controls

- Move/look: `WASD` / mouse
- Sprint/crouch/jump: `Shift` / `C` / `Space`
- Examine ground traces: `E`; a clear, still view reads the family automatically
- Camera: hold right mouse or `Q`, then left mouse or `Space` to expose a plate
- Rifle: hold `F`, then left mouse to fire
- Drop the case: hold `G`
- Pause: `P`; `Esc` releases pointer lock and pauses safely; the pause card opens the field kit
  (settings), and `Esc` or a click outside closes it. `Ctrl` is not a game key.

Losing focus releases transient movement and tool holds without cancelling a
shutter exposure already in flight.

## Regenerating Blender assets

Blender 5.2 (headless) rebuilds the baked ground layers and the stegosaurus:

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
$BLENDER -b --factory-startup -P scripts/blender/bake_ground_textures.py -- public/assets/ground 1024
$BLENDER -b --factory-startup -P scripts/blender/build_stegosaurus.py -- public/assets/stegosaurus-v1.glb
$BLENDER -b --factory-startup -P scripts/blender/build_cliff_ring.py -- public/assets/cliff-ring-v1.glb
```

## Entry behavior

Supported desktop WebGL2 environments enter the game. Touch-only, small-screen,
or WebGL2-unavailable environments receive a concise compatibility message.

## Verification

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
npm run verify
```

The command builds `dist/`, serves it with `vite preview` and runs one complete browser path
against that build. It writes `../../qa/verification.json` and the semantic
current-run evidence under `../evidence/current-run/`. The evidence records the tested
local Chromium environment; it does not claim coverage of other browsers, GPUs or devices.
Repository CI checks structure, unit tests and the production build; it does not refresh
this local browser evidence.
