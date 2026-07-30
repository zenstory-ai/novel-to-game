# BUILD_BRIEF · *Frankenstein* — **The Hovel**

This brief fixes the product, the invariants that change outcomes, and how completion is proved.
Framework, architecture, file layout, rendering technique and asset production are yours.

---

## Product target

A **web** vertical slice, open-and-play, **no backend, no build step**. Desktop **landscape**;
target viewport **1280×800**, minimum **1280×720**. **Mouse-primary with a full keyboard
alternative** — every action reachable by keyboard alone.

**Session:** 20–30 minutes, single continuous run. Eight night-slots (seven normally played),
one daytime entry, one epilogue card. No meta-progression, no save, no unlock.

**Performance budget, copied verbatim from `PRODUCT_BRIEF.md` dimension 1:** local first paint
≤ 2 s, total assets ≤ 25 MB, ≥ 60 FPS target and ≥ 30 FPS floor at target viewport. The floor is
load-bearing, not cosmetic — this is a real-time simulation.

**Rating:** all-ages (≈ ESRB E10+ / PEGI 7). No gore, no on-screen violence, no player kill verb.

**Interface language: English only.** Every player-visible string lives in one replaceable place.
No text baked into images. Do not add a second language.

---

## Required reading

- `design/GAME_DESIGN.md` — the rules, the numbers, and §6.5 **the holding in numbers**, which is
  the authority on every coordinate, the walk speed and every route length.
- `design/ART_DIRECTION.md` — the visual language, the signature moments, the asset register.

Both were revised against two adversarial audits. Where either document says a thing is
**invented** rather than derived from the novel, that label is deliberate; do not "restore" a
chapter citation for it.

---

## Must be faithful

### The core loop, in one line

Cross a dark yard carrying something that belongs to someone else's life, and get back inside
before anyone with working eyes is awake.

### Invariants that change outcomes

These are the ones a wrong implementation silently breaks. Everything else is yours.

1. **Two-channel judgement.** Any sighted cottager who sees you ends the run at once — no alert
   decay, no waiting it out, no retry inside the run. The blind man carries **no cone**, ever.
2. **Cones exist only while their owner is awake**, and only along the waypoints in
   `GAME_DESIGN` §6.5. **Light is not sight**: a lit window, a taper or the fire throws light and
   never a cone. An empty plate must mean an empty plate.
3. **Ordering convention.** A day runs dawn → daylight → night. The night that closes day N is
   night N and ends at dawn N+1; a load carried on night N first shows in Felix's day on day N+1.
   Every number in `GAME_DESIGN` §7 depends on this. Implement any other reading and the whole
   numeric layer is wrong while still appearing to run.
4. **Action costs.** Carry and forage are **traversal-costed** at 290 px per night-minute — a bad
   route genuinely costs more. Water, path, take, listen, lesson and journal are **flat charges**
   debited on completion. §6.5 gives the designed route for each.
5. **Six state fields, no seventh.** Night minutes, Firing, Store, unease, own food, Words.
   There is no Garden field, and no affection, reputation, suspicion or trust meter.
6. **No number, bar, icon or floating readout of household state, anywhere, at any time.**
   The pile at the door **is** Firing. The plate count **is** Store. The scratches on the plank
   **are** Words. The moon arc is the clock. If a digit describing household state appears on
   screen, that is a defect against this brief.
7. **Unease is fully specified in §6.2** — the Firing trigger fires once per unbroken run of zero
   dawns; a Firing-0 dawn is not an incident; the walk-slip **latches**. All three matter.
8. **Determinism.** No random draw in the simulation. Fixed **60 Hz** tick; identical
   tick-indexed input reproduces identical state at every tick. The seed governs ambience only.
   Rendering is not asserted frame by frame.
9. **No pause, no slow-motion, no plan mode, no menus during a night.** There is no dusk
   allocation screen; the plan lives in the player's head.

### Signature moments — all nine, each from real play

Copy the beat tables and protection rectangles from `ART_DIRECTION`. Each must be reachable from
a real run and captured as one clean evidence frame.

| Moment | Trigger condition |
|---|---|
| **M1 · Title** — *One lit window* | Application start, before any input |
| **M2 · Cold open** — *The chink* | Frame 1 of a new run; the player holds to keep watching |
| **M3 · The yard** — *The carry* | The first time a load is picked up (night 1) |
| **M4 · The hovel at dawn** — *The read* | Any dawn, viewed through the slot. **Dawn 5 is the one `GAME_DESIGN` §14's playtest measures** |
| **M5 · The lesson at the chink** — *The minting* | Attending the first lesson (night 4) |
| **M6 · First light** (transition) | The dawn window forcing the player back inside |
| **M7 · The door, day 8** (climax) | The walk occurs and the player knocks |
| **M8 · Being seen** (failure) | Any sighted cottager's cone reaching the creature |
| **M9 · The moon sets, and the fire** (result) | The epilogue's final held wait |

### Falsifiable visual assertions

A screenshot must be able to disprove each of these.

- **Ground:** laid paper `#e9e0cb`, plate tone `#d6c9ae`. Engraving ink `#2a2119` for every
  primary line and all body text; secondary line `#5a4c3c`.
- **Night:** wash deep `#161e2e`, mid `#2c3a52`, moonlit snow `#c6cfdb`.
- **Cone wash `#93a8c6` and nothing else in the game uses that value.** Outer band 18%, inner band
  30%, a hard 1.5 px ink boundary; **outer band single-direction hatch, inner band cross-hatch**
  — the two bands must be distinguishable without colour.
- **Being seen:** the wedge flips to flat paper `#e9e0cb` with the hatch **removed**. The hatch
  vanishing is the signal, plus the creature's shadow across the person, plus a 2 s frame hold.
- **Amber is restricted:** hearth `#d8913f`, taper flame `#f0cd82` (the taper and only the taper).
- **`#a83218` appears exactly once in the entire game — the final frame.** Any earlier appearance
  is a defect.
- **Scale on the holding plate:** cottage footprint ≈180 px wide at (550,300)–(730,410); creature
  ≈26 px tall in plan; a cottager ≈16 px. De Lacey is a **0.55 mass fused to a 0.62 mass** — the
  only two-figure silhouette on the plate, because he never walks alone.
- **Transient text triplets** (§10.3): every class carries core colour + stroke-or-backing + a
  named verification frame. **T-b, the minted word, takes both** a 2 px `#2a2119` stroke and a
  soft `#161e2e` backing ellipse at 40%, because it crosses the brightest region of the busiest
  frame.

### Release-gated asset keys — missing means the build fails

`plate/paper`, `plate/title`, `plate/room`, `plate/hovel`, `plate/door`, `plate/fire`,
`font/caslon-text`, `font/caslon-display` (Libre Caslon, OFL, subset), and the release-gated
audio set in §13.5. **Six images, two fonts, one audio set.**

`plate/room` is the empty whitewashed room with **no people and no state** — every figure and
every state object is drawn on it in Canvas. It is Risk 3's stage; a grey box there and the
game's central claim has nowhere to happen.

Nine further keys are **degradable** (§16.2) and each has a named lesser expression. A key that
is neither gated nor degradable is not a key. Any degrade actually taken goes in the completion
record with its reason, and is not silently omitted.

### Performance rules that follow state

- The **fire scales with Firing**: small at ≤ 1, built high at ≥ 2. This is the same signal in
  the visual and audio layers and it is what §14's playtest measures at dawn.
- The **pile at the door is Firing exactly** — one engraved course of log-ends per point, 0–4 —
  and it is a **dawn** read. At dusk it is nearly flat by construction; the dusk read that
  carries information is **the tools on the nail**. Ship both.
- The **board carries Store alone**: ≥5 → four plates; 3–4 → three; ≤2 → two, and the two-plate
  scene fires. Safie's presence lives on the figure layer. A take is a **one-dawn override** of
  one fewer plate.
- `ART_DIRECTION` §7.3 is marked **derived, not authored**. If you change a number in
  `GAME_DESIGN` §7, regenerate that section rather than patching it.

### Copy voice, and the anti-slop standard

Write every player-visible string against `GAME_DESIGN` §16 — the six character voice cards and
all ten banned constructions. The register is the creature's: first person, past tense, sparse,
period, no irony, never a modern contraction, never a joke, and he never names himself.

Buttons are verbs with a stance — *keep watching*, *put it down and go*, *knock* — never
*OK / Cancel / Continue*. Prompts speak in the world's terms; where the player lacks vocabulary
the game says **nothing at all**, because the plank is short and they can see it.

### Social presence

**Pure single-player, offline.** No accounts, no leaderboards, no multiplayer, no fake-multiplayer
presence, no placeholder async board. The core fantasy is being unable to be seen by anyone.

---

## Scope

**Must include.** The eight night-slots with the shrinking clock; the cone and routine system with
all eight variants of §6.5; carry, forage, path, water, listen, lesson, take and journal; the
household's winter (Firing, Store) with the routine feedback; unease with its three specified
rules; the pig drive; the day-8 walk in its three bands; the door scene with six gated exchanges;
the four endings; the epilogue with its four narrative echoes; M1–M9; a restart path.

**Explicitly excluded.** Combat, any kill verb, gore. Daylight play except the single entry.
Menus as primary input. Meta-progression, unlocks, currency, saves. Pause, slow-motion, plan mode.
Any household-state readout. Victor on screen. Geneva, William, Justine, the vivisection. A name
for the creature, and the word "Frankenstein" as his name. Localisation. **The far wood** — it was
cut; the portmanteau lies at the near wood's edge (200, 215).

---

## Implementation freedom

Choose whatever best realises the approved design in this environment. Engine layer is locked by
`PRODUCT_BRIEF` dimension 9 only as far as: **zero-build native ES modules + Canvas 2D, no
dependencies, no build step.** Everything inside that — module split, rendering approach, data
shape, how the engraved renderer is built — is yours.

**Names this brief fixes, because they are visible outside the code:**

| Symbol | Value |
|---|---|
| URL parameter, seed | `?seed=<string>`, default `hovel-01` |
| URL parameter, viewport probe | `?fast=1` may accelerate the clock **for tests only**; it must not be reachable from the UI |
| Test hook, global | `window.__game` exposing current state, the tick index, and the active cone set |
| Storage key, options only | `hovel.options` — readability and reduced-motion only. **There is no save key; nothing about a run persists.** |
| Node-level test script | `qa/design_invariants.mjs` |
| Browser-level test script | `qa/playthrough.py` |
| Evidence directory | `build/evidence/` — **workspace-relative, never `/tmp`** |

---

## Completion evidence

Record all of this back into this file when the build is done, together with a **final scope
reconciliation**: line by line, what was actually delivered against `# Scope` and against
`GAME_DESIGN`, with additions and omissions named and dated.

1. **How to run** — the exact command, from a clean checkout.
2. **Zero console errors** and zero failed resource loads across a full run.
3. **The core path walked with real input**: cold open → first carry → dawn read → night 4 lesson
   → the thaw → the walk → the door → an ending → restart. Both mouse and keyboard-only.
4. **Determinism reproduced once**: same seed and same tick-indexed input yields identical state.
5. **The numeric layer checked against the design, not against itself.** `qa/design_invariants.mjs`
   must transcribe its expectations from `GAME_DESIGN` §6.2, §6.5 and §7 and import only the
   engine — never the engine's own test suite, and never a constant shared with it.
6. **Traversal within tolerance**: a scripted run's carry and forage totals land within **±10%**
   of §6.5's designed routes. Outside that band the script is measuring its own routing.
7. **The nine signature frames**, each triggered from real play, each one clean evidence frame in
   `build/evidence/`, **JPEG not PNG**.
8. **At target viewport and at minimum resolution**: no occlusion, no overflow, every control
   operable, functional text at or above its floor size.
9. **Performance budget checked and not exceeded** — and measured so it can fail: **bytes
   transferred before the first interactive frame** (not directory size), total asset weight, and
   the frame rate sampled **during real-time play at target viewport**, not on a static screen.
   A budget that cannot fail has not been checked.
10. **Any "must provide" item that was degraded** is listed here as a known limitation and taken
    back to design — never silently omitted.

Do not call the QA stage yourself. Hand back once a runnable path and this evidence exist.
