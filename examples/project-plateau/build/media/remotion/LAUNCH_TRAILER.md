# Project Plateau Remotion launch trailer — 2026-08-04

## Recorded inputs

- Same-route gameplay clip SHA-256: `ce51fc981b4eb583cf055072ebdc5400194d764b0f166cb2ad885de2a7a702f1`
- Normalized narration SHA-256: `2a41922dea508c50535aa1e0240111d2b8ead9a64239cd197844e12384d0ec29`
- Result still SHA-256: `6a019870eeedea97b82ca6b54424123fcc41286d4118c11748a59abd8cc080af`
- Procedural soundtrack SHA-256: `60f5d90f999122c9b158f00c47eec519f2e4f54736fc28d95e285abb1356e2f7`

The gameplay source is the input-only Strong-result route. The edit discloses cuts and speed changes and does not
replace gameplay with staged state.

## Reproduction

Run from this directory:

```text
npm run verify:voiceover
npm run render
npm run verify
npm run compress:github
npm run verify:github
```

The resulting files are 36 seconds at 1920×1080 and 30 FPS, using H.264, `yuv420p`, AAC 48 kHz stereo and fast-start
MP4 layout. The GitHub copy stays below 10,000,000 bytes.

Public attachment:
<https://github.com/user-attachments/assets/edde9933-c932-4bd9-9b4c-4587bbc516f7>

This record establishes reproducible inputs and encoding facts only. It does not certify narration naturalness,
rights clearance, subjective fun or publication quality.
