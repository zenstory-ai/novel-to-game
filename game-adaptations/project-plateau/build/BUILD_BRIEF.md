# Build Brief · Project Plateau

## Finished-product target

Build a free, anonymous, single-player desktop web vertical slice for English-
speaking players who already understand first-person controls. One compact run
lasts 1–3 minutes: leave Fort Challenger, read the plateau, make a limited
photographic record of living iguanodons, respond to a pterodactyl, return with
the surviving plates, receive a result and restart.

The target is landscape `1440×900`, with `1280×720` as the minimum supported
viewport. The heaviest real state must measure a median of at least 45 FPS and
a 1% low of at least 30 FPS. Initial compressed payload must be at most 20 MB,
full on-demand payload at most 50 MB, and no-cache time to interactive at most
8 seconds on a 25 Mbps connection. P0 input is keyboard and mouse. Mobile and
touch are not P0.

The game must look and behave like a real-time first-person 3D survival
adventure within 30 seconds. It is not a page-to-page story, a dialogue game,
an arena shooter, a camera sandbox or an open-world promise.

## Required design sources

- `../design/GAME_DESIGN.md`
- `../design/ART_DIRECTION.md`
- Product boundaries: `../PRODUCT_BRIEF.md`
- Source and rights provenance: `../source/SOURCE.md`

If this brief and a required design source conflict, stop that implementation
choice and reconcile the artifact. Implementation may not silently redesign
the concept, experience/level design or art direction.

## Fidelity requirements

### Core loop and world rules

Preserve this deterministic loop:

```text
leave relative safety
  -> read a world signal
  -> choose observation position and timing
  -> spend a glass plate during a live two-second commitment
  -> read the wildlife response
  -> evade through cover/route or spend a limited shot
  -> reach Fort with the surviving record
  -> resolve the physical plates
  -> restart cleanly
```

- One core system: exposed photographic proof.
- Two support systems: wildlife awareness; route/cover/limited defense.
- Initial budget: 180 seconds, four plates, two rifle cartridges, awareness
  state 0–3 and one recoverable body margin.
- A plate earns 0, 1 or 2 evidence cues from visible framing conditions. At
  most seven evidence points are authored across the four plates.
- Alive results are No record (0), Insufficient (1–3), Corroborating (4–5) and
  Strong (6–7). A second unblocked hit or deadline expiry outside Fort fails
  the run. Leaving the navigable space returns the player to stable ground.
- Dense canopy interrupts a dive but obstructs photography. Open basalt
  improves scale/framing and exposes the player. A timely shot interrupts one
  dive, consumes one cartridge and makes the direct brook return worse.
- P0 has no outcome-changing randomness. Pause and focus loss freeze input,
  world time and pending consumption. Restart restores one clean initial state.

### Same-play verb checklist

Each line below is verbatim from the approved game design. Each verb must be
performed by the player in the same complete run and change the named
observable state.

| Required verb | Input in the slice | Observable state change |
|---|---|---|
| Traverse first-person connected terrain between relative safety and an objective space. | `WASD`, mouse look, `Shift` sprint and `C` crouch across continuous collision geometry. | World position, route landmark relation, exposure and remaining light change. |
| Observe or search the environment for route, objective and threat information. | Aim/gaze at a trace and press `E`; otherwise look/listen in the world. | A concrete field observation, route fact, behavior window or threat cue becomes available. |
| Commit to an exposed objective interaction while the threat state can change. | Hold right mouse to raise the camera, compose, then press left mouse to release the shutter. | One plate is spent after a two-second live commitment and receives a physical 0/1/2-cue preview while awareness can advance. |
| Evade through cover or route choice, or spend a limited defensive response. | Move/crouch beneath canopy or raise/fire the rifle with `F`/left mouse before contact. | A dive breaks, awareness de-escalates, or one cartridge is spent and the brook response flag changes. |
| Reach relative safety with the acquired objective state intact. | Cross either committed return route and enter the Fort gate. | Active play ends; only surviving plates are placed and resolved into one result band. |

No cutscene, instruction card or test-only state change may substitute for one
of these inputs.

### Three-part action arc

| Phase | Newly usable verb(s) | Newly reachable space | Observable phase-end marker |
|---|---|---|---|
| Explore | `examine` joins movement and looking; the player can identify track direction and the brook's return relation. | Fort threshold → brook trail → covered observation blind. | The first glass plate is exposed and its concrete framing defect appears. |
| Develop | `choose observation position`, `hold frame` and `wait for behavior` join the loop; plate results begin to compound into a field record. | The route forks between a canopy overlook and an exposed basalt shelf, then opens onto the iguanodon glade. | Adult and juvenile behavior is recorded or missed; the pterodactyl shifts from distant call to visible watch/search. |
| Mature | `read threat state`, `use defensive shot`, `choose return route` and `extract` become necessary combinations. | The return fork opens a long covered thorn route and a short exposed creek route back to Fort Challenger. | The Fort gate closes behind the player and the recovered plates are read into one result. |

The phase-end markers enable the next row. A counter increase alone cannot
stand in for the new verb or space.

### Signature moments and triggers

| Moment | Required playable trigger |
|---|---|
| **The plate breathes** — title / main menu | Cold load before `Enter the basin`; monochrome plate precedes a living route view. |
| **Three toes cross the water** — exploration | First control handoff at the sunlit track; examination reveals the second print and field note. |
| **Family in the silver frame** — core camera action | A composed glade frame includes young, adult scale, red basalt and the entering threat shadow during commitment. |
| **Open water, folded wings** — return pressure | Search becomes attack at the covered-thorn / exposed-creek fork while route and limited-response options remain readable. |
| **Field card over a held breath** — pause / controls | Pause during a meaningful live threat state; exact route, threat and resources remain visible beside the card. |
| **What reached camp** — strong result | A 6–7 point intact record crosses the Fort gate and hands place its physical plates before the result line. |
| **The second pass** — failure | A second unblocked contact holds the actionable cause frame before the failure card and restart action. |

Each moment must be reachable from ordinary inputs in the shipped build. The
exact beat timing, focus-protection rectangle and intentional-overlay rule live
in `ART_DIRECTION.md` and are screenshot gates, not optional inspiration.

### Falsifiable visual assertions

- The first controllable frame has one primary focus: a sunlit three-toed track
  crossing the dark brook edge. No objective arrow, minimap or lore panel may
  compete with it.
- The living world uses humid green, basalt red and late amber; glass plates use
  silver-black values with an ivory physical edge. The world is not sepia.
- Route, objective and threat remain distinguishable by shape and motion in
  grayscale: brook/open arch; heavy adult/young family; narrow membrane-wing
  threat. Colour alone never carries a rule.
- Camera-raised composition protects the central subject/threat corridor
  `x 22%–76%, y 13%–69%`; only physical framing brackets may overlap it.
- The busiest return frame protects `x 31%–82%, y 5%–67%`; plate/watch/chamber
  state remains at the edges.
- Player tools occupy the lower frame without hiding the walking route. The
  camera reads as mahogany rectangle + black bellows + brass detail; the rifle
  remains absent until danger and visually subordinate thereafter.
- Functional Latin labels are at least 11 px at the minimum viewport; body and
  result copy are at least 13 px. Text scale to 150% preserves the route view.
- Reduced motion removes head bob, FOV kick, shake and travelling UI, but keeps
  timings, silhouettes, directional audio and consequences.
- Modern adaptation imagery, glossy theme-park jungle, stock-photoreal collage,
  neon survival HUD, trophy framing, gore and conquest language are failures.

### Required asset keys and transition ledger

Every key below is a release gate. A functional graybox may temporarily occupy
the key during S0–S3, but the key cannot pass final build completion until its
declared states, real-view evidence and rights entry exist in
`asset-ledger.json`.

| Asset key | Required states / functions | Allowed transition state |
|---|---|---|
| `world.connected_route` | Fort, brook blind, canopy/basalt fork, glade, covered return and exposed creek with collision, cover and landmarks. | Readable primitive geometry with final topology. |
| `tool.field_camera` | Folded, raised, plate inserted, shutter commitment and preview. | Original primitive mahogany/brass/bellows blockout. |
| `tool.plate_case` | Four unexposed slots, exact 0/1/2-cue plates and cracked/missing states. | Geometric tabs and crack marks. |
| `tool.period_rifle` | Hidden, raised, two/one/zero chamber states, timely report/recoil. | Simple original silhouette without modern attachments. |
| `subject.iguanodon_family` | Two-adult/three-young read; graze, young play, branch pull and withdrawal. | One adult + one young base reused by scale/pose, never a capsule-only final. |
| `threat.pterodactyl` | Distant, watch, search, attack, shadow, cover pull-up and rifle shear-away. | Original authored silhouette poses plus shadow track. |
| `ui.field_system` | Order, contextual prompts, plate rail/preview, watch, chambers, captions, pause, results and failure. | Plain CSS geometry with approved palette/type hierarchy. |
| `light.functional_arc` | Late afternoon through deadline; subject, route, threat and Fort stay readable. | Directional + hemisphere light and depth fog. |
| `audio.core_world` | Traverse/examine/camera/glass, four threat states, cover, rifle/callback, Fort/result/failure. | Original Web Audio synthesis/local recordings with no remote fetch. |
| `accessibility.presentation` | Reduced motion, 100–150% text, captions, grayscale/non-colour redundancy, music/ambience/effects controls. | Functional settings with unstyled native controls during foundation only. |

Degradable assets stay optional and must use the fallbacks in
`ART_DIRECTION.md`: extra family markings, rookery population, small flora,
volumetric humidity, Fort dressing, full distant gunshot responder, live title
loop, detailed plate chemistry and secondary result-hand motion.

### Dynamic media and continuity ledger

All dynamic media is real-time or state-driven; no prerendered sequence is
required. `STYLE_LOCK`, `CHARACTER_SHEET` and `LOCATION_SHEET` are controlled by
`ART_DIRECTION.md`. If generated reference media is introduced, record request,
response, task ID, local output, SHA-256, rights decision and declared
`may_control` / `must_not_control` scope under
`media/evidence/<shot_key>/`. Generated output is reference until accepted
into the asset ledger; it never enters through a CDN.

| Dynamic key | Experience role and fallback | Start boundary | End boundary |
|---|---|---|---|
| `media.title_world` | Establish plate-to-living-world identity; fallback is one approved static gameplay view. | Brook/gingko view, no hands, late-afternoon light, water/insects active. | Same light/weather/audio phase under field order; still no hands. |
| `media.connected_route` | Deliver all five verbs under free look; no non-interactive fallback. | Field order clears on the sunlit track with clean initial resources. | Fort submission or declared failure with exact current resources. |
| `media.plate_exposure` | Preserve live commitment and material proof; reduced-motion fallback is a static raise/preview with identical timing. | Position/gaze/subject pose and selected plate are preserved. | Plate spent; preview matches visible conditions; threat/world advanced by two seconds. |
| `media.threat_states` | Carry awareness and response; fallback is authored poses/shadow path plus full audio timing. | Prior awareness, route, shot history and cover relation. | Next exact awareness/contact/de-escalation state without teleport or reset. |
| `media.family_behavior` | Supply the behavior evidence window; fallback reuses one adult/young base with full required events. | Current family pose and player observation relation. | Graze/play/branch-pull/withdraw event persists into plate grading. |
| `media.result_review` | Read back physical action history; fallback is a static board revealing exact plates in order. | Player alive at Fort with exact surviving case. | Only intact plates placed; result matches point/action history. |
| `media.failure` | Hold cause, then expose one corrective action; fallback direct-cuts after cause audio. | Threat direction, nearest cover, body/plate/light state visible. | Last frame remains under card; only restart resets state. |

Persistent versus temporary creature, tool, route and plate facts follow the
fact-separation table in `ART_DIRECTION.md`. A reference may control only the
named subject's persistent shape/material fact, never other characters, state,
geography, camera, outcome or copied modern artwork.

### State-dependent performance rules

- Pterodactyl silhouette and audio progress through distant → watch → search →
  attack; the numerical state is never shown.
- Under canopy the threat pulls up or passes overhead; it never clips through
  foliage or hovers in place. A timely shot shears the current dive away and
  records the downstream brook response.
- Iguanodon young play near adults; one adult pulls down a branch; the family
  withdraws. It never displays enemy health, target outline or reward hit pose.
- The plate preview preserves the exact local renderer view at commitment and
  pairs it with the frame's obstruction, scale and behavior flags. A crack
  removes that exact plate's cues and recovered image.
- Remaining light changes sky value, shadow length, watch state and deadline,
  never a full-screen danger tint.
- Results place only surviving plates, then show result copy. Failure preserves
  the last actionable world relation beneath the cause card.

### Interface language and writing voice

All shipped UI is English and centralized in a replaceable text module. The
voice is a **restrained expedition field report**: clipped field orders,
concrete observations with visible uncertainty, then physical evidence before
judgment in results.

Never write fake archaic speech, slurs, grandstanding, omniscient explanation,
emotion labels, modern memes, generic `Objective updated`, symmetrical slogans,
“not A but B” constructions, stacked adjectives, generic uplift, praise,
certain species claims the image cannot support, or claims that London now
believes. Prompts name actions; feedback names physical consequences.

### First-minute on-screen copy

These strings and order are exact:

| Screen / trigger | Player-visible text |
|---|---|
| Opening order heading | `FIELD ORDER // FORWARD SCOUT` |
| Opening order goal | `Photograph living proof. Return to Fort Challenger before sundown.` |
| Opening order condition | `A sighting without the plate will not survive London.` |
| First controllable view | `Move [WASD] · Look [Mouse]` |
| Track interaction range | `Examine the track [E]` |
| Track inspected | `Three toes. Fresh. The brook runs back to camp.` |
| First covered herd view | `Raise camera [Right Mouse]` |
| Camera raised | `Hold steady. Release the shutter [Left Mouse]` |
| First partial plate | `PARTIAL — foliage hides the flank.` |

The order clears on movement or after six seconds. No lore paragraph, threat
meter, secondary objective or settings panel competes with this sequence.

### Social presentation

Pure single-player. There is no login, leaderboard, ghost, co-op partner,
simulated teammate or network state. The off-route expedition supplies context
only; no AI ally performs a verb. Results are local and never compared.

## Scope

### Must include

- One continuous first-person 3D route from Fort through brook, observation
  fork and glade to two return paths and back to Fort.
- Movement/look/sprint/crouch, examine, camera composition/commitment, four
  physical plates, four readable awareness states, cover, two defensive shots,
  recoverable contact, both failure modes, four alive result bands and restart.
- Deterministic Strong, Mixed and Panic reference paths, including a strong
  no-shot route and a fired-shot downstream response.
- Exact first-minute and result/failure copy, edge HUD, pause/focus lifecycle,
  captions and reduced-motion/text/audio settings.
- All ten release-gate asset keys, seven signature moments and real performance,
  payload, console, request-host and complete-run evidence.

### Explicitly excluded

A true open world; complete plateau; approach journey, central lake, cave
village, factions or London hearing; crafting, needs, loot inventory, base or
progression; multiple weapons, killing, trophies or boss fights; dialogue
choices or cinematic retelling; multiple proof species; mobile/touch,
multiplayer, backend, account, analytics or monetization; modern adaptation
imagery, likenesses, audio, UI or creature designs.

## Implementation freedom

Use the product-approved WebGL2 stack: local npm assets with Three.js `0.185.1`
and Vite `8.2.0`. Raw WebGL is out for schedule risk; Babylon.js is a fallback
only if the S0 collision/input spike demonstrably fails. Architecture, module
boundaries, shaders and asset-production details remain implementation choices.

The slice must be self-contained. Runtime scripts, fonts, images, models and
audio use repository-relative/local package paths. No CDN, remote font, remote
image, analytics call or other runtime network dependency is allowed. Prefer
procedural/original geometry and Web Audio where it satisfies the art gate;
record every non-code asset in `asset-ledger.json`.

## Toolchain and authoritative verification

This block records the implementation environment at brief freeze. Build
completion must update it from the exact final environment and authoritative
run rather than preserving stale expectations.

```yaml
toolchain:
  runtime: Node.js
  runtimeVersion: v25.9.0
  packageManager: npm@11.12.1
  browser: Google Chrome 150.0.7871.187
commands:
  install: npm ci
  start: npm run start -- --host 127.0.0.1
  verify: npm run verify
verification:
  suites:
    - unit:simulation
    - browser:complete-run
    - repo:contract
  completeRun: ../qa/verification.json#completeRun
  evidenceIndex: ../qa/verification.json#checkpoints
```

`npm run verify` is the single authoritative command. It must discover runnable
test suites before invoking all three stable IDs and fail with
`ORPHANED_TEST_SUITE major` if an authored suite is not registered. Manually
running green suites separately is diagnostic only and cannot satisfy the
handoff.

## Completion evidence

The build is complete only after the authoritative command exits zero from a
clean install and writes its full output to `../qa/evidence/verify.log`.
`../qa/verification.json` must record command, exit code, duration,
environment, source commit, every suite with `executed: true`, and one same-
commit clean start → core actions → designed result → restart path.

Each checkpoint records three independent workspace-relative channels:

1. state evidence (exact world/resource/result snapshot),
2. browser evidence (input, console, request hosts, viewport and performance),
3. visual JPEG evidence (the real rendered state, not concept art).

Required paths include Strong/no-shot, Mixed/shot/callback, Panic, recoverable
plate-breaking contact, pause and focus loss during camera/dive, every terminal
restart and all five same-play verbs. Capture all seven signature moments at
`1440×900`, repeat required legibility/complete-run checks at `1280×720`, and
measure the heaviest real state against FPS, TTI and payload budgets. Any
unavailable channel is `NOT_RUN: reason`, never inferred from another channel.

Build completion must append a **Final scope reconciliation** here: for every
must-include and excluded item, record delivered, deliberately revised or not
delivered; date every scope change and link the approving design revision.
Unknown limitations remain explicit. Visual polish, subjective fun and balance
are not claimed by automated verification.

## Final scope reconciliation

`NOT_RUN: implementation has not yet begun. This section is updated only from
the completed authoritative build and evidence set.`
