# Project Plateau build devlog

Project Plateau is an English reference adaptation of Arthur Conan Doyle's
*The Lost World*. It is a compact first-person 3D field-photography game: cross
a connected plateau, collect photographic proof on four glass plates, survive
the return route, and bring the surviving record back to Fort Challenger.

It remains under `game-adaptations/` while independent playtests and perception
review are open. The anonymous public-host check has passed. Released projects move into
`examples/` only with their runnable source, provenance, planning artifacts,
and completed release evidence.

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

Reproduce it from `game-adaptations/project-plateau/build/app/`:

```bash
npm ci
npm run verify
```

## 6. Keep the release boundary honest

Automation establishes deterministic state, input, lifecycle, performance, and
gross visual floors. It cannot establish first-time comprehension, subjective
comfort, anatomy quality, composition quality, or colour-cue readability.

The public preview now loads over anonymous HTTPS and completes the same
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

The public release remains closed until the repository contains:

- three raw first-time sessions using the
  [playtest protocol](qa/PLAYTEST_PROTOCOL.md);
- an independent frame-level review using the
  [perception protocol](qa/PERCEPTION_REVIEW_PROTOCOL.md);

Those human-review gates remain `NOT_RUN` in the [QA report](qa/QA_REPORT.md).
The current files are a reviewable public development build, not a claim that
the release has passed.
