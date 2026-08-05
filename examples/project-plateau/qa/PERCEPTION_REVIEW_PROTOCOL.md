# Project Plateau independent perception review protocol

## Current visual promotion candidate

The current candidate is the HY3D creature pass bound to source fingerprint
`1d883375e0f5a07919df4948f569334b7d42ee191f21fbbbd306203ad66f2b1c` and
manifest SHA256
`bb46775a878a397b093778cf4272aa8ae7b284e8214ce9d0420a7f415eb34d6a`.
Inspect the target, orbit and motion contact sheets indexed by
`../build/evidence/visual-sota/hy3d-creatures-v23/manifest.json`. The independent
review must use those bound pixels rather than implementation-owner notes or a
newer unbound build.

Save the source-bound result at
`evidence/perception/hy3d-v23-independent-review.md`. A source or evidence hash
mismatch invalidates the review rather than silently promoting a newer build.

## Reviewer and scope

Use one reviewer who did not implement the current family, threat, camera or
glade presentation. Record their relevant 3D, animation, illustration or game
art experience and any prior exposure to this project. The review covers
anatomy readability, motion distinction, composition and non-colour usability;
it does not certify scientific reconstruction, fun or commercial art quality.

The reviewer must run the build at the source commit named in
[`verification.json`](verification.json), then inspect the live states that
produced these tracked frames:

- [`01-clear-family-sightline`](../build/evidence/s10/01-clear-family-sightline.jpg)
- [`02-young-play-silver-frame`](../build/evidence/s10/02-young-play-silver-frame.jpg)
- [`03-branch-pull-silver-frame`](../build/evidence/s10/03-branch-pull-silver-frame.jpg)
- [`04-achromatopsia-attack`](../build/evidence/s10/04-achromatopsia-attack.jpg)
- [`05-strong-plate-board`](../build/evidence/s10/05-strong-plate-board.jpg)
- the two complete technical vision routes indexed by
  [`../build/evidence/s8/report.json`](../build/evidence/s8/report.json)
- the twelve additional review checkpoints indexed by
  [`../build/evidence/s10/report.json`](../build/evidence/s10/report.json)
- the continuous Strong delivery take described by
  [`../build/media/clip/manifest.json`](../build/media/clip/manifest.json)

Tracked images are navigation aids. Final findings must cite a live run or a
new reviewer capture from the same commit. The existing Chromium-emulated route
and checkpoint matrix prepares the review and does not supply its verdict.

## Review passes

### 1. Family and equipment readability

At the clear glade and both behavior commitments, answer with `PASS`, `FAIL` or
`UNCERTAIN` and one frame-level reason:

- Can the reviewer count two adults and three young without reading the HUD?
- Do adult/young scale, neck, underside, forelimb, hindlimb, head and thumb
  spike read as one coherent animal rather than merged primitives?
- Are young play and adult branch-pull distinct before the plate label appears?
- Does the period camera read as an operable field camera with bellows, ground
  glass, rails and lens, and does it leave the captured plate view unobstructed?
- Do any silhouettes, shadows or intersections create an apparent extra limb,
  detached part or duplicate animal?

### 2. Threat motion and player response

Observe distant, watch, search and attack in motion at normal speed:

- Can the reviewer order the four pressure states from movement, silhouette
  and sound without a threat meter?
- Does the final dive create a readable moment to retreat under cover or raise
  the rifle?
- Does the canopy pull-up look like the threat breaking away rather than
  disappearing or colliding with foliage?
- Do young play, branch pull and threat motion remain distinct during camera
  commitment, pause/resume and restart?

### 3. Composition and evidence continuity

- From the main approach, are the family and red basalt readable in the same
  sightline without a dense central tree wall?
- Do the frame edges provide cover and depth while leaving the evidence subject
  clear at `1440×900` and `1280×720`?
- Does every recovered plate preserve the view captured during that commitment,
  including its subject, angle and framing defect?
- Do HUD, captions, order/result panels and transient feedback avoid covering
  the current subject, route cue or defensive cue?
- Does restart clear every recovered image and return a visually fresh order?

### 4. Colour-vision routes

Use Chrome's vision-deficiency emulation or an equivalent documented tool.
Record tool/version and mode in every capture.

1. Complete one unassisted Strong route in full colour and one in
   achromatopsia at `1440×900`, including order, glade, attack/cover, result and
   restart.
2. At minimum capture order, glade, attack/defense and result checkpoints in
   protanopia, deuteranopia and tritanopia.
3. For every mode, check objective text, plate state, remaining resources,
   route choice, threat state and result band using shape, position, icon,
   motion or text without relying on hue alone.

One isolated filtered screenshot does not pass this route gate.

## Severity and exit rule

- `blocker`: a supported run cannot continue or a required subject/state is
  absent from the live build.
- `major`: family count/behavior, threat state, route cue, plate continuity or
  non-colour decision cannot be read reliably, though an alternate path exists.
- `minor`: local polish problem that does not change a decision or result.

The independent perception gate passes with zero blocker/major findings after
retest. Every finding needs a frame or timestamp, expected observation, actual
observation, owner (`art`, `design` or `build`), disposition and retest link.

Save the signed/contextualized review at
`qa/evidence/perception/independent-review.md` and captures beneath the same
directory. `QA_REPORT.md` must link the raw review and list unresolved findings;
an owner-authored summary cannot substitute for it.
