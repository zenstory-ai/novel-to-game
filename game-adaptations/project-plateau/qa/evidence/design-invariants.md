# Project Plateau design-invariant audit

Source fingerprint: `e99883ce0a14f31782ac0dc6a91bd38f7e9869d86279d11ca04b5171a59af69d`

This QA-side table is derived from the approved product and game-design thresholds. It does not import implementation constants and does not claim subjective fun, balance, anatomy, motion or composition quality.

| ID | Result | Approved expectation | Observed | Evidence |
|---|---|---|---|---|
| `same-source` | **PASS** | S7, S8 and S10 describe one current build fingerprint | `["e99883ce0a14f31782ac0dc6a91bd38f7e9869d86279d11ca04b5171a59af69d"]` | `build/evidence/s7/report.json; s8/report.json; s10/report.json` |
| `same-play-verbs` | **PASS** | All five approved same-play verbs have direct path evidence | `["commitExposedObjective","evadeOrDefend","observe","reachRelativeSafety","traverse"]` | `build/evidence/s8/report.json#verbEvidenceMatrix` |
| `strong-reference` | **PASS** | Strong returns 6-7 evidence through cover with body margin, no shot and 30-120 seconds | `{"band":"strong-field-record","evidence":7,"bodyMargin":1,"shotCount":0,"cartridges":2,"route":"covered","remainingLight":100.339}` | `build/evidence/s8/state/05-strong-input-result.json` |
| `mixed-reference` | **PASS** | Mixed preserves 4-5 evidence, at least two plates and the one-shot brook callback | `{"band":"corroborating-record","evidence":4,"survivingPlates":3,"shotCount":1,"route":"exposed","callback":"The report carried. Something answered by the brook."}` | `build/evidence/s8/state/09-mixed-input-result.json` |
| `panic-reference` | **PASS** | Panic spends both rounds, takes two contacts and cannot reach a strong result | `{"result":{"kind":"failure","cause":"second-unblocked-strike","title":"The second pass","copy":"The second pass found you in open ground.","cue":"Break the dive under the trees, or fire before contact."},"failureCause":"second-unblocked-strike","contactCount":2,"shotCount":2}` | `build/evidence/s8/state/12-panic-input-failure.json` |
| `terminal-restarts` | **PASS** | Strong, Mixed and Panic each return to a clean 180-second field order | `[{"mode":"order","remainingLight":180,"distanceTravelled":0,"plateStatuses":["unexposed","unexposed","unexposed","unexposed"]},{"mode":"order","remainingLight":180,"distanceTravelled":0,"plateStatuses":["unexposed","unexposed","unexposed","unexposed"]},{"mode":"order","remainingLight":180,"distanceTravelled":0,"plateStatuses":["unexposed","unexposed","unexposed","unexposed"]}]` | `build/evidence/s8/state/{06-strong,10-mixed,13-panic}-clean-restart.json` |
| `input-and-network-boundary` | **PASS** | Reference paths use input rather than state/time shortcuts and make no external request | `{"noTeleportOrDirectTimeAdvance":true,"consoleErrors":[],"externalHosts":[]}` | `build/evidence/s8/report.json#checks` |
| `performance-budget` | **PASS** | Both viewports meet 45/30 FPS and local 25 Mbps loading/payload budgets | `{"gzipBytes":154906,"rawBytes":602904,"timeToFirstFrameMs":2217.3,"targetFps":[120.5,106.4],"minimumFps":[120.5,107.5]}` | `build/evidence/s7/report.json#loading,payload,performance` |
| `visual-checkpoint-floor` | **PASS** | Current visual checkpoints meet the approved objective composition and state floors | `{"achromatopsiaAttackRetainsShapeAndToolState":true,"allFiveSubjectsCastShadows":true,"familyAndBasaltShareSunLane":true,"focusRegionPixelFloor":true,"observationNoteClearsBeforeHeroFrame":true,"protectedGladeSightline":true,"restartClearsCapturedViews":true,"strongBoardUsesFourCapturedViews":true,"youngPlayAndBranchPullRemainDistinct":true}` | `build/evidence/s10/report.json#checks` |

## Boundaries

- Automated invariants establish deterministic state, input-path, loading, performance and gross visual floors only.
- Independent first-time premise/genre comprehension, anatomy, motion and composition review remain NOT_RUN.
- The achromatopsia evidence covers one busy attack frame, not the complete route or every colour-vision mode.
- Local throttling is not public-host cold-load evidence.
