# Run Project Plateau

Requirements: Node.js `>=22.12.0`, npm, and a desktop browser with WebGL2.

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

The command runs eight current suites: unit, production build, one complete browser
run, controller, motion, collision, entry, and loading. It writes `../../qa/verification.json`
and the semantic current-run evidence under
`../evidence/current-run/`.

Historical numbered checkpoint scripts are intentionally not part of the active
package surface. The controller suite uses a deterministic pointer-lock shim;
native OS/browser pointer-lock acquisition remains a manual smoke item.
