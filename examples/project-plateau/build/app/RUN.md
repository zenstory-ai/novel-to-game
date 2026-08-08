# Run Project Plateau

Requirements: Node.js `>=22.12.0`, npm, Python 3 with Playwright, and a desktop
Chromium browser with WebGL2.

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

```bash
npm ci
npm run start -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. Runtime code, HY3D assets, preview video, fonts
and effects are local; the app has no analytics or CDN dependency.

Historical published preview: <https://plateau.vibecoco.ai>. Availability is
checked separately and does not prove that the host serves the current local
fingerprint.

## Controls

- Move/look: `WASD` / mouse
- Sprint/crouch/jump: `Shift` / `C` / `Space`
- Examine: `E`
- Camera: hold right mouse, then left mouse to expose a plate
- Rifle: hold `F`, then left mouse to fire
- Pause or release pointer lock: `Esc`

Losing focus releases transient movement and tool holds without cancelling a
shutter exposure already in flight.

## Entry behavior

Supported desktop WebGL2 environments enter the game. Touch-only, small-screen,
social in-app, or WebGL2-unavailable environments receive the local 15-second
preview instead of a renderer error.

## Verification

```bash
npm run verify
```

The command runs one complete browser path. It writes `../../qa/verification.json` and the semantic
current-run evidence under `../evidence/current-run/`. The evidence records the tested
local Chromium environment; it does not claim coverage of other browsers, GPUs or devices.
Repository CI checks structure, unit tests and the production build; it does not refresh
this local browser evidence.
