# Project Plateau launch video

This Remotion project turns the recorded 30-second Strong-result gameplay route into a 36-second English launch
video. The edit uses disclosed cuts between natural-speed gameplay segments; it does not accelerate traversal or
slow action beats. The source take includes multi-axis movement and eased mouse turns rather than a fixed forward/
backward route. Captions and the procedural sound bed keep the sequence understandable without narration.

## Generate narration

`voiceover.json` is the public narration and audio configuration. The generator reads `FISH_API_KEY` from the
process environment, writes ignored source and normalized audio files, and records a secret-free request fingerprint.
Calls use bounded timeout and retry behavior; the output must pass format, decode, duration, signal, clipping, loudness
and provenance checks.

```bash
FISH_API_KEY=... npm run voiceover
npm run verify:voiceover
npm run test:tts
```

To use a different voice reference, set `FISH_REFERENCE_ID`. The caller remains responsible for ensuring the selected
service and voice may be used; this repository does not certify rights clearance. Naturalness, casting preference and
publication rights are not machine-proven by `verify:voiceover`.

If only timing or mix settings changed, `npm run voiceover:remix` may reuse the ignored source when its recorded
request and source hashes still match. API keys, private provider responses and generated audio are never committed.

## Render

The ignored gameplay input must exist at `../clip/project-plateau-30s.mp4`; regenerate it with the parent media-pack
instructions when absent.

```bash
npm install
npm run voiceover
npm run verify:voiceover
npm run render
npm run verify
npm run compress:github
npm run verify:github
```

`npm run render` verifies the audio and provenance facts, prepares assets, renders the master and finalizes the output.
Derived MP4 files remain ignored. `compress:github` creates a 1920×1080 H.264 copy below the configured upload limit
without changing the master.

## Claim boundary

- The gameplay segment is a disclosed same-route edit, not authoritative traversal-timing evidence.
- Motion graphics describe repository artifacts and observable player actions.
- The narration is provider-generated and is not presented as a human speaker or real-person identity.
- The video does not prove subjective fun, rights clearance or publication quality.

## Remotion license

This project pins Remotion 4.0.503. Review the upstream Remotion license before reusing it under another organization.
