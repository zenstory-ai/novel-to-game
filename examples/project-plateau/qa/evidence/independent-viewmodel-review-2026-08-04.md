# Project Plateau · integrated viewmodel review · 2026-08-04

## Independence and candidate binding

Reviewer: `/root/plateau_visual_release_review` (`vision`, read-only).

The reviewer did not participate in the current implementation or evidence
generation. This viewmodel-only review is bound to:

- source fingerprint `39c3b4e7ba3181594487ce184cf946539c554ab463ac358c0b5234014f36d2b8`;
- `build/evidence/visual-targets/manifest.json` SHA256
  `bf9d9cf15ff738d7051a6a690417dc8916870856242cd7199b90e1daf00aa44f`;
- `vt02-first-controllable-track.jpg`, `vt02-track-examined.jpg` and
  `vt04-attack-defense.jpg` from that manifest.

## Verdict

**PASS for the integrated camera-and-hands and rifle-and-hands viewmodels.**

The prior VT-02 major is closed. The v3 camera hands no longer show long fused
digits, forked or extra digits, a palm melted into the camera, floating tool
weight, or hard sleeve truncation. The two frames retain the same stable grip.
The rifle regression check also passes: both hands support the weapon, cuffs
remain continuous, the gun stays subordinate in the lower-right frame and does
not obscure the threat corridor.

## Remaining minor

The right glove and the camera's right-side shadow are close in value, so their
local separation could be stronger. The left thumb/index region remains
intentionally faceted but reads as a normal low-poly glove grip rather than
malformed anatomy. Tool-follow motion is covered by the separate motion suite,
not inferred from these still frames.

This record closes only the integrated viewmodel defect. It does not replace a
full-candidate VT01–VT06 independent review.
