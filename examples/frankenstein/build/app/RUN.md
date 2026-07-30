# Frankenstein · The Hovel — running and verifying

A year at the chink, compressed into eight nights. You are the creature behind the
De Lacey cottage: you listen to a family you cannot be seen by, learn their words a
few at a time, leave firewood at their door before dawn, and finally decide whether
to knock while the old blind man is alone. Being seen ends the run.

Adapted from the 1831 public-domain text, chapters XI–XVI. Nothing here derives from
any film. Native ES Module + Canvas 2D, zero build, zero runtime dependencies.

## Starting

```bash
cd examples/frankenstein/build/app
python3 -m http.server 5199
```

Then open:

```text
http://127.0.0.1:5199/
```

Reproducible run, and the accelerated clock the automated passes use:

```text
http://127.0.0.1:5199/?seed=42
http://127.0.0.1:5199/?seed=42&fast=1
```

`?seed=42` fixes every random draw, so the same inputs give the same night.
`&fast=1` compresses a night-minute from 8 s to 1 s — useful for self-testing, but
**timing evidence taken under it is invalid** (`qa/QA_REPORT.md`).

Target viewport `1280×800`, minimum `1280×720`. Desktop landscape only.

## Controls

Mouse and keyboard each complete the whole game on their own.

| | Keyboard | Mouse |
|---|---|---|
| Move | arrows or `WASD` | click a spot in the yard |
| Context action | `E` or `Space` | click the object (walks there, then acts) |
| Hold (listen, the cold open, the door) | hold `E` / `Space` / `Enter` | hold the button down |
| Lift the plank / step out | `X` | click the hovel mouth |
| Drop what you carry | `Q` | — |
| The journal | `J` | click the bundle |
| Advance a card | `Enter` | click the card's button |
| Menus | arrows or `W`/`S`, then `Enter` | click the row |

`Sound and text` on the title plate carries text size, ink weight, sound and the
speech murmur. Options persist; sound unlocks on your first real input, as browser
autoplay policy requires.

## A run

```text
title → the cold open (a held scene) → eight nights → the walk → the door → an ending → the epilogue
```

- **In the hovel.** Listen at the chink to bank words. From night 4 a lesson window
  opens — the one place words arrive in bulk. What the family says is glossed only in
  the words you actually know, so early speech is mostly gaps.
- **In the yard.** Step out once the retiring window closes. Carry a load from the
  outhouse to the door to raise **Firing** (the pile at their door is the read-out —
  one course per point), draw water, clear the path, take from the milk-house, forage
  at the wood's edge. Every waking cottager casts a hatched **cone**; walking into one
  ends the run. An empty plate means nobody is awake.
- **The plates.** Two fixed screens and no camera: *the holding* in plan for all night
  play, and *the chink* in elevation for the reads that bracket each night. The yard's
  ground says what you did — snow is blank paper, a path you cleared is stippled, and
  from night 5 the beds are thawed earth, ruled into furrows if Felix had a free day.
- **The door.** Up to five exchanges, each gated on the words you have banked
  (40 / 52 / 62 / 72 / 80), on a real-time clock of 30 s a slot. How many slots you get
  is what the winter's work bought: leave their store at 3 by dawn 6 and the old man is
  alone for five, at 2 for three, at 1 or 0 for two — and letting the clock run out is
  the `silence` ending. You may only say words you have learned; the rest is silence,
  and silence is an answer too.
- **Four endings**, all reachable: `door` (you are heard out), `seen` (you are seen —
  terminal), `want` (three dawns at an empty store and the family leaves), `silence`
  (the clock runs out at the door).

## Self-testing

```bash
cd examples/frankenstein
node qa/design_invariants.mjs        # engine invariants, 10 sections, no browser
python3 qa/qa_browser.py            # real Chromium, accelerated
QA_SLOW=1 python3 qa/qa_browser.py  # normal speed; only this run's timing evidence counts
QA_ONLY=want,silence python3 qa/qa_browser.py   # named passes only, for iteration
```

- `qa/design_invariants.mjs` runs the engine in Node and checks the rules against
  `design/GAME_DESIGN.md`'s numbers — thresholds, cone geometry, the walk notice
  distance, and same-seed determinism.
- `qa/qa_browser.py` drives eleven passes in a real browser: a keyboard campaign and a
  mouse campaign each playing eight nights to the `door` ending and restarting, the
  other three endings played to their cards, the holding plate and the hovel plate
  gated at pixel level, the card layout gated over every string in `STRINGS`, a font
  gate proving both Caslon faces really render, and an audio gate driving all twelve
  cues from real state. Evidence lands in `qa/evidence/browser/` as JPEG — never a
  system temp directory, which the QA contract treats as no evidence at all.
- `QA_ONLY` is for iterating on one pass. It writes `-partial` evidence, stamps the
  summary `partial: true`, and is never a release gate; only a full run writes
  `qa/evidence/browser/` and `automated.json`.

Repository-level checks, from the repo root:

```bash
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests
```

## Structure

```text
index.html              entry; the canvas is #plate
src/
  main.js               phases, input, the scene shell, the window.__game test hook
  render.js             the whole drawn layer: plates, the holding plan, the chink,
                        cards, and the engraving helpers (hatch / det / plankBreak)
  skin.js               keyed asset layer: plates and fonts load and swap in, and a
                        key that never resolves draws a labelled grey box instead
  strings.js            every player-visible string
  audio.js              twelve procedural WebAudio cues; no audio files
  engine/
    constants.js        landmarks, obstacles, reaches, routes, the plate size
    rng.js              seeded RNG; every random draw in the sim goes through it
    schedule.js         the cottagers' night, and the cones it produces
    sim.js              the rules: movement, actions, words, Firing, being seen
    state.js            state shape, and a run's initial state
assets/
  plate_*.webp          six release-gated plates
  font/*.woff2          Libre Caslon Text and Display, self-hosted subsets, OFL.txt
```

Total build 1.56 MB against a 25 MB budget.

## Known boundaries

- The cold open asks for ~23 s of held input before the first interactive verb. That
  is an authored beat, and `?fast=1` does not shorten it (`QA_REPORT.md` F4).
- No human has played this to a verdict: onboarding comprehension and a playtest are
  the two gates `qa/QA_REPORT.md` leaves open, and `qa/PLAYTEST_PROTOCOL.md` is the
  protocol for closing them. Automation shows the slice runs and completes; it cannot
  show that the arc lands, and `PRODUCT_BRIEF.md` row 7's 20–30 minutes is an estimate
  nobody has timed with a real player.
- Desktop landscape only; no mobile or portrait layout.
- Save/restore is not implemented — a run is one sitting, and restart begins a new one.
