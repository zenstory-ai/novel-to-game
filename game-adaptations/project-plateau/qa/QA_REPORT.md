# Project Plateau QA report

## Verdict

**Local automated build handoff: PASS. Public release: NO-GO.**

The authoritative run completed every registered suite, a same-run input-only
Strong path from clean field order through result and restart, and 22 direct
state/browser/visual checkpoints. No local blocker, uncaught browser error,
external runtime host, failed deterministic outcome or budget regression was
observed.

Release remains closed because first-time player/perception records, independent
anatomy/motion/composition review, a complete non-colour route pass, and public
anonymous-host loading have not run. These are evidence gaps, not inferred
passes.

## Authoritative run

| Field | Observed |
|---|---|
| Source commit | `565e2f6c20f1aafe99fc098a73c09f2e5432a720` |
| App fingerprint | `e99883ce0a14f31782ac0dc6a91bd38f7e9869d86279d11ca04b5171a59af69d` |
| Install | [`npm ci`](evidence/install.log) — 24 packages, 0 vulnerabilities |
| Verify | `npm run verify` |
| Result | exit `0`; 7/7 suites; 16/16 commands |
| Duration | `462634 ms` |
| Log | [`evidence/verify.log`](evidence/verify.log) |
| Structured handoff | [`verification.json`](verification.json) |
| Suite discovery | 15 registered pass/fail files; 2 explicit non-suite tools; 0 orphan |

`capture_demo_clip.py` is recorded as a delivery-media tool rather than a test;
`verify.py` is the orchestrator and would recurse if registered as its own
suite. Any new Python or JavaScript file under `build/app/test/` that is neither
registered nor explicitly classified now fails with `ORPHANED_TEST_SUITE
major`.

## Environment and budgets

| Surface | Environment | Result |
|---|---|---|
| Runtime | Node.js `v25.9.0`; npm `11.12.1`; Python `3.14.5` | PASS |
| Browser | Google Chrome `150.0.7871.187` | PASS |
| Viewports | target `1440×900`; minimum `1280×720` | PASS |
| Target heaviest state | median `120.5 FPS`; 1% low `106.4 FPS` | PASS vs `45/30` |
| Minimum heaviest state | median `120.5 FPS`; 1% low `107.5 FPS` | PASS vs `45/30` |
| Built payload | `602904` raw bytes; `154906` gzip bytes | PASS vs `50/20 MiB` |
| First local no-cache frame | `2217.3 ms` at simulated 25 Mbps | PASS vs `8000 ms` locally |
| Runtime requests | only `127.0.0.1:4173`; no external host | PASS |

The loading measurement uses Chrome DevTools throttling against local Vite. It
does not prove public-host DNS, TLS, CDN or cold-cache behavior.

## Suite discovery and execution

| Suite | Discovered files or surfaces | Same-run result |
|---|---|---|
| `unit:simulation` | four `test/*.test.js` files, 35 assertions | PASS |
| `build:production` | `index.html`, `src/`, `public/` | PASS; Vite production build |
| `browser:checkpoint-history` | `qa_s0.py`–`qa_s7.py`, `qa_s9.py` | PASS; 9/9 commands |
| `browser:complete-run` | `qa_s8.py` | PASS; Strong/Mixed/Panic by keyboard/mouse |
| `browser:current-visual` | `qa_s10.py` | PASS; current glade/plates/non-colour frame |
| `qa:design-invariants` | `qa/check_design_invariants.py` | PASS; 9/9 design-derived checks |
| `repo:contract` | validator and repository unit discovery | PASS; 7 skills, 22 tests |

## Complete run

The `s8-strong-input-only` record is one normal-speed browser path. It does not
invoke `teleportForTest` or `advanceTimeForTest`.

| Step | Input and expected change | State | Browser | Visual |
|---|---|---|---|---|
| Clean start | Enter the basin; receive a fresh 180-second field order | [`00`](../build/evidence/s8/state/00-clean-field-order.json) | [`00`](../build/evidence/s8/browser/00-clean-field-order.json) | [`00`](../build/evidence/s8/00-clean-field-order.jpg) |
| First proof | Walk to brook, examine, raise camera, expose plate | [`01`](../build/evidence/s8/state/01-strong-brook-frame.json) | [`01`](../build/evidence/s8/browser/01-strong-brook-frame.json) | [`01`](../build/evidence/s8/01-strong-brook-frame.jpg) |
| Full proof | Use cover, reach glade, expose young-play and branch-pull plates | [`03`](../build/evidence/s8/state/03-strong-glade-frames.json) | [`03`](../build/evidence/s8/browser/03-strong-glade-frames.json) | [`03`](../build/evidence/s8/03-strong-glade-frames.jpg) |
| Threat response | Retreat under cover until the final dive widens | [`04`](../build/evidence/s8/state/04-strong-covered-return.json) | [`04`](../build/evidence/s8/browser/04-strong-covered-return.json) | [`04`](../build/evidence/s8/04-strong-covered-return.jpg) |
| Result | Follow the covered return to Fort with four surviving views | [`05`](../build/evidence/s8/state/05-strong-input-result.json) | [`05`](../build/evidence/s8/browser/05-strong-input-result.json) | [`05`](../build/evidence/s8/05-strong-input-result.jpg) |
| Restart | Choose “Take the route again”; restore unexposed plates and zero travel | [`06`](../build/evidence/s8/state/06-strong-clean-restart.json) | [`06`](../build/evidence/s8/browser/06-strong-clean-restart.json) | [`06`](../build/evidence/s8/06-strong-clean-restart.jpg) |

Observed Strong result: 7 evidence, 4 surviving plates, covered return, no shot,
body margin retained, 100.339 seconds remaining. Mixed reached corroborating
evidence 4 with three plates, one shot and the brook callback. Panic spent both
rounds and failed on the second unblocked strike. Each terminal state has its
own clean restart checkpoint.

## Independent design checks

[`evidence/design-invariants.md`](evidence/design-invariants.md) derives nine
expectations from `PRODUCT_BRIEF.md` and `GAME_DESIGN.md` rather than importing
runtime constants. It independently checks the common source fingerprint, five
verbs, Strong/Mixed/Panic bands, three terminal restarts, the input/network
boundary, both viewport budgets, and current visual floors: **9/9 PASS**.

This establishes deterministic agreement with the approved thresholds. It does
not make the implementation author independent, and it cannot answer first-time
comprehension or subjective visual questions.

## Evidence boundaries and open gates

| Gate | Status | Severity before public release | Required next evidence |
|---|---|---|---|
| Three first-time players recognize 3D action/exploration and not a text/VN presentation | NOT_RUN | major | Three raw sessions using [`PLAYTEST_PROTOCOL.md`](PLAYTEST_PROTOCOL.md); at least two meet the stated threshold |
| First meaningful interaction within 90 seconds and result within 15 minutes | NOT_RUN | major | Timestamped, uncoached player records using the same protocol |
| Players can restate scout/proof/extract rather than “shoot dinosaurs” | NOT_RUN | major | Verbatim post-run answers linked to each raw session |
| Independent anatomy, motion and composition review | NOT_RUN | major | [`PERCEPTION_REVIEW_PROTOCOL.md`](PERCEPTION_REVIEW_PROTOCOL.md), reviewer context, frame-level findings and disposition |
| Complete route under non-colour/colour-vision modes | NOT_RUN | major | Full-colour + achromatopsia routes and the three specified checkpoint sets; one isolated attack screenshot is insufficient |
| Anonymous public HTTPS load, play, result and restart | NOT_RUN | release-blocking | Public URL, cold-load/browser log and clean-context smoke |
| Platform upload/transcode for short media | NOT_RUN | release-blocking for that attachment | Uploaded file hash and playback check |

No subjective fun, balance, audio-mix, anatomy, motion or composition claim is
marked PASS. Numeric image floors only catch gross occlusion, flat exposure or
missing state.

## Reproduce

From `game-adaptations/project-plateau/build/app/`:

```bash
npm ci
npm run verify
```

The command rewrites the stage evidence, design-invariant audit, authoritative
log and structured handoff. A passing run requires every suite and command to
execute in that invocation.
