# Project Plateau first-time playtest protocol

## Purpose and claim boundary

This protocol collects the independent first-time evidence required by
[`QA_REPORT.md`](QA_REPORT.md). It tests whether a new player can recognize and
perform the scout → proof → survive → extract loop in the current build. It
does not turn opinions about fun, balance or commercial appeal into automated
facts.

Use at least three participants who have not played this build and have not
read its planning or QA files. Record prior knowledge of *The Lost World* and
first-person controls; familiarity is context, not an exclusion. Obtain consent
before recording screen, voice or quotations, assign anonymous IDs `P01`–`P03`,
and collect no unnecessary personal data.

## Fixed environment

- Follow [`../build/app/RUN.md`](../build/app/RUN.md) from a clean install.
- Use desktop keyboard and mouse at `1440×900`; repeat any layout finding at
  the supported `1280×720` minimum.
- Start each participant in a new browser profile or clean context with no
  saved settings, storage, cache or prior run.
- Use the normal clock and real input. Disable QA placement, teleport, direct
  time advancement, walkthroughs and injected saves.
- Record browser/OS versions, source commit, app fingerprint, viewport and
  whether the run was local or on the later public host.
- Capture one continuous screen recording or timestamped observer log from the
  title through result and one attempted restart. Preserve participant speech
  verbatim where consent permits.

## Observer script

Read only this line before play:

> Please play until you reach a result. Say what you are trying to do and what
> in the game led you to that decision. I will not explain the controls or the
> world while you play.

Do not name the genre, scout/proof/extract loop, safer route, wildlife states or
camera-quality rules. When a participant asks for help, record the time and
exact question. Reply once with “Try what seems most likely from the screen.”
If they remain stuck for 90 seconds, end the unassisted segment before offering
help; all later evidence is coached and must be labelled.

## What to record before asking opinion

| Observation | Required record |
|---|---|
| First meaningful action | Seconds from gaining control to the first examine or camera action; mark whether it was within 30 and 90 seconds |
| Route reading | The first world cue used to reach the glade and the cue used to relocate Fort |
| Proof decision | Whether position or timing changed after a weak plate, with the triggering screen/audio cue |
| Threat reading | Participant's words for distant, watch, search and attack states; cue that changed their route or defensive choice |
| Defense | Whether cover preceded ammunition; if a shot came first, what made it appear cheaper or safer |
| Outcome | Time to result, result band/cause, and whether the participant could act on the next-run cue |
| Restart | Whether “Take the route again” produced a fresh order without observer instruction |

End the unassisted run at the first result, failure, 15-minute limit or technical
blocker. Ask these questions in order without correcting the answers:

1. Who were you, and what were you trying to bring back?
2. What could end the run?
3. What kind of game was this? What actions did you repeat most?
4. How did you decide where to go and which return route to take?
5. What made one photograph stronger than another?
6. What was the flying animal doing in the states you noticed?
7. What did cover and the rifle each do for you?
8. From the result screen alone, what happened to the evidence and what would
   you change next time?
9. Would you start another run now? Why or why not? This answer is subjective
   context and does not determine PASS.

## Release thresholds

The first-time gate passes only when all of the following are supported by raw
participant records:

- at least two of three participants identify a real-time first-person 3D
  action/exploration game and do not describe the experience solely as a text
  adventure or visual novel;
- at least two of three can restate scout/document/survive/extract in their own
  words and name the run-ending pressure;
- at least two of three perform a meaningful examine or camera action within
  90 seconds; retain the stricter 30-second design target as a reported metric;
- at least two of three reach a designed result within 15 minutes without
  coaching and can restart from it;
- at least two of three use world, animal or sound cues to explain a route
  choice, and connect position/timing with plate quality;
- at least two of three understand that cover creates safety and a rifle shot
  buys an escape window rather than supporting creature clearing;
- no participant encounters a reproducible build blocker, unrecoverable input
  failure or unreadable supported-viewport state.

A failed threshold remains a finding. Route it to product, design or build in
`QA_REPORT.md`; do not average it away or replace it with the deterministic S8
path.

## Evidence record

Save one file per participant as
`qa/evidence/playtest/P01.md` through `P03.md`. Each file must contain:

```text
participant: P01
consent: screen / voice / quotation / none
prior_context: novel familiarity; first-person-control familiarity
source_commit: <sha>
app_fingerprint: <sha256>
environment: <OS; browser; viewport; local or public URL>
unassisted_window: <start/end timestamps>
first_meaningful_action_seconds: <number or NOT_REACHED>
result_seconds: <number or NOT_REACHED>
result: <band/cause or NOT_REACHED>
restart: <PASS / FAIL / NOT_RUN>
observer_events: <timestamped actions, questions and any coaching boundary>
post_run_answers: <verbatim answers 1–9>
technical_findings: <IDs or none>
```

After all three files exist, add a threshold table to `QA_REPORT.md` that links
each decision to the raw records. A summary without those files is not evidence.
