# Project Plateau QA report

`status: PASS`

## Decision and evidence

`qa/verification.json` is the machine record and
`build/evidence/current-run/report.json` contains the complete path. The six-key complete path passed.

Run from `build/app/`:

```bash
npm run verify
```

## Limitations

The recorded run used local desktop Chromium with software-controlled input. Other browsers, GPUs and devices were
not exercised. Automation does not determine subjective anatomy, composition, comfort, fun, balance, rights clearance
or publication quality.
