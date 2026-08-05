# Project Plateau build devlog

## 2026-08-04 · Release visual and power pass

- Rebuilt the Fort tents, fire and smoke; grounded route ribbons, ferns, tree
  roots and tilted-basalt details; removed the white water glow, dead-black
  canopy faces and rectangular branch artifacts; rebalanced ambient, rim,
  subject and basalt fill while keeping one directional shadow logic.
- Increased the visible pterodactyl flap cadence and added fixed-transform
  `wingUp` / neutral / `wingDown` evidence. Independent read-only review found
  zero blockers and zero majors and returned PASS / GO.
- Capped Retina DPR at 1.25 and active rendering near 60 FPS across 60–165 Hz
  displays; title/pause/hidden cadence is 30/15/4 FPS. FXAA replaces SMAA,
  GTAO samples are reduced to four, the browser chooses the GPU, and the
  persistent drawing buffer is disabled while synchronous plate capture remains
  verified.
- The authoritative `npm run verify` passed 7/7 suites and 17 commands for app
  fingerprint `a33f6d0439f7efb26e2437beff4ed334851cd0cd94b321e7918387061adfd454`.
  The source-bound visual suite measured 59.9 FPS median with 39.4/38.9 FPS
  1%-low at 1440×900 / 1280×720, above the 45/30 budget.

## 2026-08-03 · Review-debt closeout

- Current `npm run verify` passes 7/7 suites and 17/17 commands against
  fingerprint `1b0ae821…`, including deterministic dual-viewport JPEG capture
  and a hash-bound uncut watch → bank → dive → pull-up take.
- Independent reviewer `/root/visual_verdict_round1` made no implementation
  edits and passes the approved target at playable-prototype: 93/100,
  0 blockers and 0 majors. All six prior visual minors are closed.
- Publication validation is split into bounded identity, verification, visual
  and asset helpers. A dry-run-first retention tool protects every transitively
  referenced resource before removing superseded evidence; missing roots,
  malformed manifests and symlinks fail closed.
- Authoritative verification stages its self-check in a hidden candidate and
  atomically publishes only measured results. The structured record content-binds
  its log by SHA-256, and motion evidence must decode with the expected codec,
  dimensions and duration rather than merely resemble WebM/JPEG signatures.
- S2 and S4 no longer race cosmetic flight timing or an active contact timer;
  their paths assert the authored cover/de-escalation state before continuing.
  S3 and S8 likewise wait on observed pause/attack/cover state instead of
  relying on machine-speed timing.
- Nine focal release assets now pass. Audio remains degradable through its
  tested authored-caption and visual/state fallback; no polished/showcase claim
  is made.

## 2026-08-02 · Visual review-2 candidate

- Replaced the first rejected spike's ellipsoid/cone family with smoother
  torso masses, bent load-bearing limbs, distinct hands/feet/thumb accents,
  lifted segmented tails and warm underside response.
- Rebuilt the aerial threat around broad connected membrane surfaces, a compact
  torso, jaw and eyes; fixed review poses keep both search and dive silhouettes
  inside the supported frames.
- Separated wet soil, water, basalt, skin, membrane and vegetation through
  roughness, clearcoat, sheen, transmission and vertex colour rather than one
  shared standard response.
- Reduced title and field-HUD area/opacity while retaining existing text,
  controls and accessibility settings.
- Added `npm run capture:visual`, registered in the authoritative visual suite.
  It freezes animation at 4.25 seconds, captures title/family/dive at both
  supported viewports, hashes the three target SVGs and every image, and emits
  a contact sheet plus machine-readable manifest.
- No release status changed: the replacement still awaits independent re-review.

## 2026-08-02 · Representative visual promotion spike

- Locked `targetFinish: playable-prototype` and added three original visual
  composition diagrams plus a frame-level rejection rubric.
- Preserved the S10 baseline before changing the representative glade; captured
  the regenerated candidate from the same seed, camera, viewport and state.
- Replaced cone fern repetition with authored fan geometry, introduced terrain
  colour response and near/mid/far environmental layers, fractured the basalt
  profile, grounded family limb/foot anatomy, and added pterodactyl wing spars
  and head detail. No dependency, input, state transition or outcome changed.
- `npm run verify` passed all 7/7 suites. Current visual-state performance was
  120.5 median FPS / 107.5 1% low across 240 frames at 1440×900, with no console
  errors or external hosts.
- This is technical evidence, not independent aesthetic approval. Review is
  `NOT_RUN`, four affected release-gate ledger entries remain false, and the
  release manifest remains `playable-prototype`.

Project Plateau is an English reference adaptation of Arthur Conan Doyle's
*The Lost World*. It is a compact first-person 3D field-photography game: cross
a connected plateau, collect photographic proof on four glass plates, survive
the return route, and bring the surviving record back to Fort Challenger.

It is retained under `examples/` with runnable source, provenance, planning
artifacts and playable-prototype release evidence. Evidence-qualified first-time
play records and production audio review remain optional future depth rather
than claims inferred from automation.

## 1. Start with the source's playable argument

The [source record](source/SOURCE.md) fixes the exact public-domain text and its
rights boundary. The [source bible](analysis/SOURCE_BIBLE.md) then accounts for
all sixteen chapters instead of extracting a few visual motifs.

The selected prototype concentrates on a chain established across Chapters 4,
10–12, and 16:

1. a sighting begins as a disputed claim;
2. observation can become a fragile physical record;
3. wildlife and terrain make the return consequential;
4. evidence only matters if it survives extraction.

That chain produced the player promise **scout → document → survive →
extract**. The game rewards readable observation and preservation. The rifle is
a scarce way to recover a route; it is not a creature-clearing progression
system.

## 2. Keep planning ownership separate

Each planning stage had one decision owner:

- [Product brief](PRODUCT_BRIEF.md): platform, audience, runtime, scope, and
  session boundary;
- [Source bible](analysis/SOURCE_BIBLE.md): textual evidence, world rules,
  spaces, actions, and adaptation risks;
- [Concept selection](concepts/CONCEPT.md): three source-grounded directions
  and the reason `Proof Before Dark` won;
- [Game design](design/GAME_DESIGN.md): the connected route, proof system,
  threat response, outcomes, and restart loop;
- [Art direction](design/ART_DIRECTION.md): camera, composition, world and tool
  grammar, feedback, motion, sound, and accessibility cues;
- [Build brief](build/BUILD_BRIEF.md): the frozen implementation and evidence
  contract.

This separation prevents implementation convenience from silently changing the
adaptation. A scope change must return to the owning artifact and record the
reason.

## 3. Choose the runtime for this adaptation

This project selected Three.js, Vite, and WebGL2 because a linkable desktop 3D
slice makes its camera, traversal, and visual evidence easy to inspect. That is
a Project Plateau delivery choice. NovelToGame can target a PC client, mobile
app, mini game, web build, or a project in the selected game engine; build and
QA follow the runtime locked in each product brief.

The current implementation is self-contained at
[`build/app/`](build/app/). It makes no external runtime request and uses
procedural geometry plus locally synthesized audio. Provenance and unfinished
release gates remain visible in the [asset ledger](build/asset-ledger.json).

## 4. Let real play revise the paper estimate

The first product estimate allowed a 5–8 minute route and 420 seconds of light.
The first normal-speed, input-only Strong path crossed the complete route in
55.2 seconds and returned with most of that allowance unused. The estimate was
padding the run on paper.

The product and game-design owners therefore revised the contract to a 1–3
minute run and a 180-second light budget. The route kept its decisions; no empty
walking or artificial wait was added to satisfy the earlier estimate. Current
Strong, Mixed, and Panic paths exercise different proof, defense, return, and
failure consequences under the revised budget.

## 5. Make one command own the handoff

During implementation, separately green test scripts could have hidden an
unregistered suite. The verifier now discovers runnable files, rejects orphaned
suites, executes every registered suite in one invocation, and writes a
structured handoff.

The current authoritative local run records:

- **7/7 suites** and **16/16 commands**;
- **41** linked state, browser, and rendered-image checkpoints;
- **10/10** design-derived invariants;
- complete input-only Strong, Mixed, and Panic paths;
- complete full-colour and achromatopsia Strong paths;
- order, glade, attack/defense, and result checkpoints under protanopia,
  deuteranopia, and tritanopia;
- zero uncaught browser errors and zero external runtime hosts.

The [QA report](qa/QA_REPORT.md),
[structured handoff](qa/verification.json), and
[design-invariant audit](qa/evidence/design-invariants.md) preserve the exact
source commit, environment, measurements, paths, and claim boundaries.

Reproduce it from `examples/project-plateau/build/app/`:

```bash
npm ci
npm run verify
```

## 6. Keep the publication boundary honest

Automation establishes deterministic state, input, lifecycle, performance, and
gross visual floors. It cannot establish first-time comprehension, subjective
comfort, anatomy quality, composition quality, or colour-cue readability.

The published build loads over anonymous HTTPS and completes the same
keyboard/mouse Strong, Mixed, Panic, achromatopsia, result, and restart paths.
The compact [public-host record](qa/evidence/public-host/report.json) preserves
the deployment, source fingerprint, full input trace, route metrics, console and
request-host checks, plus clean-start/result/restart frames.

First-time observations are now collected in the
[public playtest discussion](https://github.com/worldwonderer/novel-to-game/discussions/7).
A reply is treated as candidate evidence until it contains the environment,
timestamps, observed path, result, and uncoached post-run answers required by
the playtest protocol.

The separate
[independent visual-review discussion](https://github.com/worldwonderer/novel-to-game/discussions/8)
keeps reviewer recruitment away from first-time participants, who must not read
the anatomy, motion, composition, or colour-cue checklist before their run.

On 2026-08-01 the maintainer reported three successful informal first-time
sessions and accepted the project for publication as a repository example.
Those sessions did not retain the raw environment, timestamps, observed path,
result, and uncoached answers required by the protocol, so the report does not
retroactively mark the first-time criteria as verified.

The following evidence-qualified gates therefore remain open after publication:

- three raw first-time sessions using the
  [playtest protocol](qa/PLAYTEST_PROTOCOL.md);
- an independent frame-level review using the
  [perception protocol](qa/PERCEPTION_REVIEW_PROTOCOL.md);

Those human-review gates remain explicit in the [QA report](qa/QA_REPORT.md).
Publication is a maintainer product decision with disclosed evidence gaps, not
a claim that the missing subjective reviews passed.
