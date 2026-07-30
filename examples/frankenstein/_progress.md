# Progress

> `qa` gate not passed: the slice is **completable by either input scheme** — full eight-night
> campaigns reach the `door` ending at exchange 5 and restart clean, one all-keyboard and one
> all-mouse — **all four designed endings (`door`, `seen`, `want`, `silence`) are played end to
> end**, **every release-gated asset ships** (6 plates, 2 Caslon faces, 12 audio cues), and the
> suite is now green at **both** game speeds: 333 passed / 0 failed accelerated, 333 passed / 0 failed at normal speed.
> Still not a release build: onboarding comprehension and a human playtest need a person, and the
> signature-frame pass needs re-judging by eye now that the holding plate is drawn.
> Not a release build.

- Source: Project Gutenberg, *Frankenstein; or, The Modern Prometheus* (1818), public domain
- Mode: `quick`
- Chosen concept: `The Hovel` — the creature's year at the chink, chapters XI–XVI
- Current stage: `qa`
- Completed: `intake`, `analyze`, `concept`, `design`, `art`, `build`
- Coverage: `analysis/_coverage.md` (source 24 / succeeded 24 / failed 0)
- gate:analyze pass
- gate:concept pass
- gate:design pass
- gate:art pass
- gate:build pass
- gate:qa fail(0 `blocker`, 0 open `major` — all 7 closed: F1 every release-gated asset present
  (6 plates, 2 Caslon faces, 12 audio cues); F6 the mouse click path was dead in three places and
  is now wired, proved by an all-mouse campaign; F7 `wedge` was never exported so every frame of
  the `seen` phase threw; F12 `plate/hovel` regenerated to §7.1's composition; F15 the holding
  plate was never drawn and now is, gated two-sided at pixel level; F16 the suite could not go
  green at normal speed because a QA stand point sat on an obstacle's push-out face; F20 a hotspot
  click never performed its action when the creature started from a standstill.
  3 `minor` open: F4 the cold open's authored 23 s hold before the first interactive verb;
  F13 the aperture still reads as a torn mount rather than prised boards, deliberately deferred;
  F11's stated remainder in the cold slot's upper band. The gate stays `fail` only because the two
  human judgements and the signature-frame re-judgement are outstanding — nothing automated is red)
- Reflow record: 2026-07-28 first independent QA. 1 `blocker` found and fixed —
  `step()`'s `title` case never called `engine.tick()`, so `phaseTick` stayed 0, `titleBeat`
  stayed 0, and the title text and all three verbs were never drawn; the first screen was two
  blank shapes with no way in. Also fixed 2 `minor` occlusion defects (title crossing the
  platemark; the prompt band covering the tally plank and food heap). 2026-07-29 human playtest
  reflow (QA round 6, F17/F18/F19, all fixed): the title reveal's 4.5 s dead click window cut to
  ~1.6 s with click-to-reveal and hover focus; the options plate's rows became real click
  targets with a mouse-reachable way back (was a mouse trap); the cold open's 23 s hold now
  plays its §10 beats — dim aperture that lights under the hold, guitar at 0:06, Felix with the
  load at 0:14, taper out and pull-back at 0:18, the plank lifting at 0:22 — with a progress
  rule, instead of a frozen picture. 2026-07-30 round 7: the holding plate drawn to §16.3 (F15);
  the normal-speed failure diagnosed as geometric, not a missing `* SPEED` (F16); and the queued
  hotspot action found dead from a standstill and fixed (F20). `QA_ONLY` added so one pass can be
  re-run without paying for the whole suite — it writes `-partial` evidence and is never a
  release gate.
- Evidence: `qa/evidence/automated.json` (333 passed / 0 failed at normal speed, 0 console errors, 0 failed requests, 0 external request domains, build 1.56 MB), `qa/evidence/browser/` 51 frames,
  `qa/evidence/qa_browser_last.log` (accelerated) and `qa/evidence/qa_browser_slow.log`
  (normal speed), `node qa/design_invariants.mjs` all sections hold
- Verified path: the full campaign — boot → title → cold open → nights 1–7 (2 carries, 4 lessons,
  96 words) → the day-8 long walk → the door → five exchanges → ending `door` → epilogue →
  `afterRun` → restart. Played through the real input path, no state injection. Reproduced at
  both game speeds (`?fast=1` and `QA_SLOW=1`), so timing evidence is valid. The whole campaign
  also runs **mouse-only** — no keyboard at any point: title verb, about card, options toggle,
  chink, cold slot, click-to-move, the three carry hotspots, four lesson starts, the knock, five
  exchanges, epilogue and restart, all by click. The other three endings each have their own
  pass. Determinism confirmed under a fixed seed.
- Not verified: no clean-context onboarding judgement; no human playtest; the signature-frame
  pass needs re-judging against the drawn holding plate (M3 and M9 failed on the flat yard that
  F15 replaced — see `qa/evidence/signature-frames.md`, *Re-judgement pending*); the cleared-path
  stipple and the bed furrows are not pixel-gated, because they only exist from night 5 and the
  campaign keeps the creature indoors on nights 5–7
- Assets: `plate/hovel` regenerated 2026-07-28 to §7.1's composition (one warm chink, left of
  centre; the earlier plate put it right of centre at 1.4% width — F12). All 6 release-gated
  plates generated 2026-07-28 (`plate/paper|title|room|hovel|door|fire`), sized to draw size and
  shipped as WebP — 17 MB PNG → 1.4 MB. Both Caslon faces ship as self-hosted woff2 Latin-1
  subsets and all twelve §13.5 audio cues are procedural WebAudio, so **every release-gated asset
  is present**; total build 1.56 MB against a 25 MB budget. Assets enter through `src/skin.js`;
  a key that fails to load still draws a grey box with its key name and the run continues. The 9
  degradable keys remain on their named lesser expression.
- Licence: `public_domain_source`; the two Caslon faces are `OFL-1.1` (licence text ships at
  `build/app/assets/font/OFL.txt`)
- Updated: 2026-07-30
