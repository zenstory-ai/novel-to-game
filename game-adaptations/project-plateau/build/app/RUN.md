# Run the current build foundation

Requirements: Node.js `>=22.12.0`, npm and a desktop browser with WebGL2.

```bash
npm ci
npm run start -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. The local Vite server supplies all runtime code;
the page does not request a CDN, remote font, image, audio file or analytics
endpoint.

Run the quick renderer baseline with:

```bash
npm run verify:s0
```

Run controller, collision, pause/focus, restart and a continuous ten-minute
browser smoke with:

```bash
SMOKE_SECONDS=600 npm run verify:s1
```

Run the connected-zone and four-state primitive threat checkpoint with:

```bash
npm run verify:s2
```

Run the observation, exposed-proof, recoverable-contact and limited-defense
checkpoint with:

```bash
npm run verify:s3
```

Run the primitive complete-loop checkpoint—Strong-band covered return, both
terminal failures and clean restart from every terminal—with:

```bash
npm run verify:s4
```

Run the route/outcome matrix with all four alive bands, Strong/Mixed/Panic,
exposed-case versus noisy-creek consequences and the minimum viewport with:

```bash
npm run verify:s5
```

Run the field-feedback checkpoint with the bellows camera, membrane-wing threat,
covered-route pull-up, local Web Audio cues, captions, channel controls and
distinct result/failure sound states with:

```bash
npm run verify:s6
```

The browser check uses Python Playwright and the locally installed Google Chrome
when available. It saves JPEGs, timings, render counters and a JSON report under
the corresponding `../evidence/s*/` directory. S3 through S6 write separate
state and browser JSON records for every visual checkpoint.

This is an S6 foundation, not the completed game. It proves the approved local
Three.js/Vite/WebGL2 stack, real-time scene density, title/order handoff,
viewport support, player controller, foundation collision, lifecycle and
performance baseline, plus connected zone history and four primitive threat
states. It also proves examination without premature scoring, a slowed camera,
a live two-second shutter commitment, deterministic plate grades, proof-driven
awareness, one recoverable plate-breaking contact and a timely one-cartridge
defensive interruption. The same state can now continue through a committed
covered/exposed return, Fort submission, one of four evidence bands, timeout or
second-contact failure, and a clean field-order restart. S4 browser evidence
captures one Strong-band proof → covered return → result → restart path plus
both terminal failures. It uses QA-only walking/time compression and therefore
does not replace final uncompressed reference paths, audio, route consequence
coverage, production art or the authoritative verification handoff. S5 adds
all four alive result bands, the no-shot Strong line, a shot/callback Mixed
line, an explicit Panic failure, the 28/12/18-second route-cost matrix, a
visible brook-brush response and a five-verb evidence index. Those paths still
use QA-only walking compression. S6 replaces the camera and aerial-threat
silhouettes with more recognizable procedural structures, frames the covered
route with physical arches and a visible pull-up response, and adds lazy local
Web Audio, captions, three independent volume controls, cue-state inspection
and clean per-run audio reset. Its browser evidence proves that audio nodes and
cues run without console or remote-host errors; it does not claim subjective
mix quality. Final asset polish, persisted settings and uncompressed reference
runs remain open.
