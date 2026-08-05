# Project Plateau QA report

`targetFinish: playable-prototype`

## Release status

- Authoritative runtime QA: **PASS**
- Independent visual review: **PASS**
- Visual promotion: **PASS**
- Demonstrated/publication tier: `playable-prototype`
- Current public-host proof: **HISTORICAL / NOT_CURRENT**

Historical published preview: <https://plateau.vibecoco.ai>. It is not bound to
the current candidate.

The current local candidate is bound to app fingerprint
`578d03cbfbcbe66ac192ac1bcb808d3e215b14d1d6759d63d2b3012bbc22ee6f`.
The independent read-only review recorded 0 blockers and 0 majors and is bound
to release manifest SHA256
`1c30ba33aec7d5a48cb1aa7a7b3570b2460806eab5d6a282ba66a140ce56475d`.
See [`evidence/independent-visual-review-2026-08-04.md`](evidence/independent-visual-review-2026-08-04.md).

## Authoritative run

| Field | Result |
|---|---|
| Command | `cd build/app && npm run verify` |
| Exit | `0` |
| Suites | `12/12` PASS |
| Commands | `23/23` PASS |
| Registry | 33 pass/fail files; 2 explicit non-suite tools; 0 orphan |
| Duration | `605109 ms` |
| Direct checkpoints | 41 |
| Complete run | `s8-strong-input-only` |
| Structured record | [`verification.json`](verification.json) |
| Content-bound log | [`evidence/verify.log`](evidence/verify.log) |

The same invocation ran unit tests, production build, S0–S10 browser paths,
controller, motion, collision, entry conversion, loading, current visual QA,
design invariants, repository validation and all repository unit tests.

## Current release evidence

| Surface | Evidence-backed result |
|---|---|
| Controller | Camera-relative WASD, mouse look signs/clamps, acceleration, lifecycle hold release and pointer-lock denial state PASS. Browser controller QA uses a deterministic pointer-lock shim. Native OS/browser pointer-lock acquisition remains `NOT_RUN` in automation. |
| Jump | Space-bar ballistic jump, landing on the shared heightfield, action restrictions and airborne collision PASS. |
| Collision | Shared visual/collider layout, fixed substeps, no tunnelling, sliding, depenetration, tall-solid airborne contact and browser route matrix PASS. |
| Loading | Boot loader and required HY3D asset loader remain visible until the first ready field state; black-screen entry regression PASS. |
| Entry conversion | Desktop WebGL2 enters the interactive build. Touch, small viewport, social in-app browser or missing WebGL2 receives a local 15-second gameplay preview instead of a renderer dead end. |
| HY3D tools | One integrated camera-and-hands asset and one integrated rifle-and-hands asset; missing required assets fail closed rather than showing procedural tool substitutes. |
| Creatures | Shared HY3D Iguanodon family and pterodactyl flock retain morph-driven action. The attack uses a continuous dive/pull-up path, stable up reference, bilateral wing motion and a moving ground shadow. |
| Terrain | Shared multi-scale heightfield, grounded trees, sparse dark root-cluster ferns, no repeated marker-like ground-cover layer. |
| Visual review | VT01–VT06, dual viewports, title/family/dive frames and continuous watch→bank→dive→pull-up evidence PASS with 0 blocker / 0 major. |

## Budgets

| Measurement | Result |
|---|---|
| Built payload | `6,660,269` raw / `4,792,819` gzip bytes; PASS vs 50/20 MiB budgets |
| Local 25 Mbps first no-cache frame | `3397.9 ms`; PASS vs `8000 ms` |
| S7 `1440×900` | `59.9` median / `39.5` 1% low FPS |
| S7 `1280×720` | `59.9` median / `38.6` 1% low FPS |
| Visual suite `1440×900` | `59.9` median / `37.9` 1% low FPS |
| Visual suite `1280×720` | `59.9` median / `38.2` 1% low FPS |
| Render policy | DPR ≤ `1.25`; active/title/paused/hidden caps `60/30/15/4 FPS`; FXAA; four-sample GTAO; no persistent drawing buffer |
| Runtime hosts | local origin only; zero external runtime requests |

## Evidence boundaries

- Automated checks do not prove subjective fun, balance, scientific
  reconstruction, audio mix or first-time premise comprehension.
- The retained public-host run is bound to an older source fingerprint and does
  not prove deployment of this candidate.
- Chrome automation proves the controller contract through the deterministic
  browser shim; native pointer-lock acquisition remains an explicit gap.
- Local throttling is not public-host cold-cache evidence.
- Three protocol-complete first-time player records and independent live
  colour-cue route review remain open evidence requests, not hidden PASS claims.

## Reproduce

```bash
cd examples/project-plateau/build/app
npm ci
npm run verify
```
