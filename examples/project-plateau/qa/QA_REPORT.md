# Project Plateau QA report

`targetFinish: playable-prototype`
`assuranceProfile: smoke`
`status: PASS`

## Decision

The current local browser candidate passes the smallest playable-proof contract:
it launches and renders; real keyboard/mouse input completes the core route,
reaches a Strong field record, and restarts from a clean state. The run also
exercises the exposed accessibility settings because they directly change the
player's experience.

## Current evidence

| Concern | Evidence |
|---|---|
| Authoritative command | `qa/verification.json` |
| Complete run and restart | `build/evidence/current-run/report.json` and seven embedded semantic checkpoints |

## Limitations

- Independent first-time-player comprehension is not run and blocks delivery or release.
- Automation cannot determine subjective anatomy, composition, motion quality,
  comfort, fun, or balance.

## Re-run

From `build/app/`, run `npm ci && npm run verify`. The verifier regenerates the
current route and decision. Per-click captures, raw performance
traces, generated dependencies, and superseded review rounds are not retained.
