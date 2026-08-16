# Build Brief · Project Plateau

targetFinish: playable-prototype

## Finished-product target

Build a self-contained desktop WebGL2 prototype in English. One real-input run must
leave Fort Challenger, photograph a prehistoric family, survive the ecosystem response,
return with a designed evidence result and restart cleanly within the approved 1–3
minute session.

The build implements the approved `GAME_DESIGN.md` and `ART_DIRECTION.md`; it must not
replace the non-lethal scout fantasy with combat, crafting, a cinematic or a dashboard.

## Required sources

- `../PRODUCT_BRIEF.md`: platform, runtime, audience, finish and non-goals.
- `../analysis/SOURCE_BIBLE.md`: source facts and adaptation boundaries.
- `../concepts/CONCEPT.md`: selected proof-before-dark promise.
- `../design/GAME_DESIGN.md`: loop, state, level and outcomes.
- `../design/ART_DIRECTION.md`: visual, motion, audio and feedback grammar.
- `asset-ledger.json`: current non-code runtime assets and their local sources.

## Runtime and controls

- Local Three.js/Vite application; no CDN, account, backend, analytics or runtime asset
  fetch outside the repository.
- Landscape desktop browser, target `1440×900`, minimum `1280×720`.
- Keyboard/mouse: movement, look, sprint, crouch, examine, camera raise/shutter, rifle,
  pause and restart.
- Focus loss and pause freeze input, world time and pending consumption.
- Reduced motion, 100–150% text, captions and separate audio controls remain usable.

## Must implement

1. One continuous Fort → brook → observation fork → glade → two return routes → Fort
   space with readable landmarks, cover and collision.
2. Four physical plates whose two-axis live camera direction, exposure stability, captured
   obstruction, scale and distinct behaviour determine the visible record; empty, edge, clear
   and smeared frames remain legible while recording stays live and exposed. Crouching before
   the shutter braces the camera without removing exposure risk.
3. Readable iguanodon routine/young-play/branch-pull/alarm windows and pterodactyl
   distant/watch/search/attack states. Family behaviours and the optional committed-dive plate
   require distinct timing and framing, not repeated shutters in one zone.
4. Canopy cover, one recoverable contact, two rifle cartridges and the downstream cost
   of firing.
5. A 180-second light budget, four alive result bands, deadline/contact failure and one
   clean restart state.
6. Edge HUD, contextual prompts, physical result review, captions and accessibility
   settings using the approved expedition-field voice.

The representative Strong path records brook and basalt scale, reads the family, aims at
young play, crouches under cover to widen the dive, returns for the later branch pull, returns
without firing and reaches the Strong field record. An off-subject frame and a duplicate
behaviour must score lower. A second Strong route may replace one family angle with a stable
committed-dive plate, but must leave only a short camera-to-rifle response window. A fired-shot
route must change later threat or route state.

## Required runtime assets

The playable candidate needs the connected route, field camera, plate case, period
rifle, adult/young family, pterodactyl, functional light, UI and directional audio.
Their states and local source files belong in `asset-ledger.json`. Extra flora, markings,
rookery population, volumetric humidity and secondary result animation are degradable.

Focal tool or creature load failure blocks the candidate; it must not silently pass with
an invisible substitute. Generated or licensed assets remain local and follow the rights
boundary recorded in the ledger.

## Implementation freedom

Module boundaries, shaders, geometry production, state representation and optimisation
are implementation choices. Prefer existing utilities and original procedural geometry;
do not add services or dependencies merely to reproduce a reference image. Exact package
versions are owned by `package.json` and its lockfile, not duplicated here.

Visible route anchors and solid collision must agree. Fixed-step collision needs stable
sliding, depenetration, diagonal movement and world boundaries. Creature state changes
remain spatially continuous; camera previews must preserve the frame actually captured.

## Scope exclusions

No full plateau, central lake, cave village, factions, London hearing, crafting, needs,
loot, progression, multiple weapons, killing, trophies, boss fight, dialogue choices,
mobile/touch controls, multiplayer, backend, monetization or modern adaptation assets.

## Run and verification

```bash
cd examples/project-plateau/build/app
npm ci
npm run start -- --host 127.0.0.1
npm run verify
```

`npm run verify` is the single authoritative acceptance command. It executes one normal
complete path and atomically writes:

- `../../qa/verification.json`: schema-v3 decision with launch, render, input, core loop,
  designed outcome and restart;
- `../evidence/current-run/report.json`: environment, input trace and three representative
  checkpoints from that same run.

Project-specific unit tests remain diagnostic regression for adopted systems; they do not
create a second acceptance matrix. PASS proves the six effects only in the recorded local
desktop browser. It does not prove subjective visual quality, comfort, fun, balance,
rights clearance, public hosting or other browsers, GPUs and devices.
