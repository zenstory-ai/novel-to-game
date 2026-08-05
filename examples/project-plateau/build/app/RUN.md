# Run Project Plateau

Requirements: Node.js `>=22.12.0`, npm, and a desktop browser with WebGL2 for
the interactive 3D build.

```bash
npm ci
npm run start -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. The app is self-contained: runtime code, HY3D
assets, preview video, fonts and effects are served locally with no analytics or
CDN requests.

Historical published preview: <https://plateau.vibecoco.ai>. Its retained QA
record is not current-fingerprint release evidence.

## Controls

- Move: `WASD`
- Look: mouse
- Sprint: `Shift`
- Crouch: `C`
- Jump: `Space`
- Examine: `E`
- Raise camera: hold right mouse; expose plate: left mouse
- Raise rifle: hold `F`; fire: left mouse
- Pause / release pointer lock: `Esc`

Movement follows the current camera heading. Jump is unavailable while
crouching, paused or holding a tool. Losing focus releases transient movement
and tool holds without cancelling a shutter exposure already in flight.

## Entry behavior

Supported desktop WebGL2 environments enter the interactive game. Touch-only,
small-screen, social in-app or WebGL2-unavailable environments receive the
local 15-second gameplay preview and links to other playable examples rather
than a renderer error page.

## Verification

Quick checks:

```bash
npm test
npm run build
npm run test:controller
npm run test:collision
npm run test:entry
npm run test:loading
npm run test:motion
```

Authoritative release handoff:

```bash
npm run verify
```

The authoritative command discovers every registered JavaScript/Python suite,
runs 12 suites and 23 commands, and writes:

- `../../qa/verification.json`
- `../../qa/evidence/verify.log`
- browser screenshots/state under `../evidence/`

The current successful handoff is bound to source fingerprint
`578d03cbfbcbe66ac192ac1bcb808d3e215b14d1d6759d63d2b3012bbc22ee6f`.
It passed unit, build, S0–S10 browser, controller, motion, collision, entry,
loading, visual, design-invariant and repository-contract suites.

The browser controller suite uses a deterministic pointer-lock shim so mouse
look can be proven in automation. Native OS/browser pointer-lock acquisition is
not claimed by that shim and remains a manual smoke item.
