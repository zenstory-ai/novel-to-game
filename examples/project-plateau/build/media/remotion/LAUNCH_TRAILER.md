# Project Plateau Remotion launch trailer — 2026-08-04

## Recorded inputs

- Same-route gameplay clip SHA-256: `30537adb7cc2c3721a597f3914efb96b2c9ff1e5854cb16a2314922e18698c78`
- Normalized narration SHA-256: `d2df95402739af4d27db7bf0a3ef376282677248b1b1c13fdbf91c49c24482a4`
- Result still SHA-256: `1bbdf73b5843026beb38789e386be6993b7260593baa5af6cbd86313c26b0fb0`
- Procedural soundtrack SHA-256: `60f5d90f999122c9b158f00c47eec519f2e4f54736fc28d95e285abb1356e2f7`

The gameplay source is the input-only Strong-result route with multi-axis movement and eased mouse turns. The edit
uses disclosed cuts at natural 1x playback and does not replace gameplay with staged state.

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

- GitHub delivery SHA-256: `e828677ad727c9f6cd568980f517998f5948d56ae5382b4a7717aecee71e9a98`
- GitHub delivery bytes: `9,324,323`

Public attachment:
<https://github.com/user-attachments/assets/27819247-4e4d-4bf0-8f0f-43d4125c4d45>

This record establishes reproducible inputs and encoding facts only. It does not certify narration naturalness,
rights clearance, subjective fun or publication quality.
