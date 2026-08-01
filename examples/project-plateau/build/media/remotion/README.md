# Project Plateau launch video

This Remotion project turns the verified 30-second Strong-route capture into a
36-second English launch video. The full continuous gameplay clip remains
visible between a three-second premise card and a three-second call to action.
Only captions, framing, motion graphics, a Fish Audio synthetic English
narration and an original procedural sound bed are added; the gameplay itself
is not cut or substituted.

## Storyboard

| Time | Purpose | On-screen claim |
|---|---|---|
| 00:00–00:02.5 | Hook | A novel became a playable world. |
| 00:02.5–00:07 | Explore | Cross a connected plateau. |
| 00:07–00:12.5 | Commit | Expose four physical glass plates. |
| 00:12.5–00:19.5 | Observe | Read a living dinosaur family. |
| 00:19.5–00:28.5 | Return | Survive the open sky. |
| 00:28.5–00:32.5 | Prove | Bring home what survived. |
| 00:31.6–00:36 | CTA | Play the build; explore and star the repository. |

The video is caption-complete and remains understandable when social platforms
autoplay it muted. The generated sound bed is deterministic and uses no third-
party audio asset. The synthetic narration is explicitly provider-generated;
it is not presented as a human speaker or cloned real person.

## Generate the narration

`voiceover.json` is the public narration and delivery configuration. The
generator calls Fish Audio's `POST /v1/tts` using the `s2.1-pro-free` model,
the public `Energetic Male` voice model and a 1.14 prosody-speed setting, then
loudness-normalizes the response locally. Short takes retain their generated
tempo; only an overlong take is accelerated enough to meet the 30.8-second
ceiling. This avoids the slow, artificially aged sound caused by stretching a
short take across the timeline. The API key is read only from the process
environment. The ignored source MP3 and normalized WAV must never be committed.
An ignored metadata sidecar records the model, script hash, source hash and a
hash of the selected reference—never the API key—so `voiceover:remix` cannot
silently reuse stale audio.

```bash
FISH_API_KEY=... npm run voiceover
```

To test a different voice model you have the rights to, override the configured
public voice with `FISH_REFERENCE_ID`. If only the local timing or mix
configuration changes, reuse the ignored response without another API request:

```bash
npm run voiceover:remix
```

Fish Audio model behavior and service terms can change independently of this
repository. Review <https://docs.fish.audio/features/text-to-speech> and
<https://fish.audio/terms> before a new public render.

## Render

The ignored input MP4 must first exist at `../clip/project-plateau-30s.mp4`. If
it does not, regenerate it using the parent media-pack instructions.

```bash
npm install
FISH_API_KEY=... npm run voiceover
npm run render:frames
npm run render
npm run verify
npm run compress:github
npm run verify:github
```

The final delivery file is
`out/project-plateau-promo-36s.mp4`. Review stills are written to `out/review/`.
All of these derived files are ignored by Git.

`compress:github` keeps the 1920×1080 H.264 delivery format and uses a slow
two-pass encode rather than reducing resolution. It writes
`out/project-plateau-promo-36s-github.mp4` and fails if the result exceeds the
10,000,000-byte upload ceiling. The 19 MB master remains untouched.

The render command normalizes the final MP4 to H.264 High Profile, 30 FPS,
`yuv420p`, BT.709 limited range, AAC stereo and fast-start. This extra delivery
pass avoids the full-range `yuvj420p` flag produced by the browser render on
some hosts and trims the AAC tail to exactly 36 seconds.

`npm run assets` copies the evidence-bound gameplay input and Strong-result
frame into the local Remotion public directory, synthesizes the soundtrack and
requires the ignored normalized narration. It prints hashes for all prepared
assets so a render can be tied back to its inputs.

## Claim boundary

- The gameplay segment is the existing uniformly compressed input-only Strong
  run; it is delivery footage, not authoritative traversal timing evidence.
- Motion graphics describe repository artifacts and observable player actions.
- The narration was generated with Fish Audio `s2.1-pro-free` and its public
  `Energetic Male` model (`802e3bc2b27e49c2995d23ef70e6ac89`), described by
  Fish Audio as a young promotional voice. It is not a private voice clone or a
  claimed real-person identity.
- The video does not claim independent visual approval or deterministic fun.
- The public URL and repository URL must receive anonymous link checks again at
  publication time.

## Remotion license

This project pins Remotion 4.0.503. Remotion uses its own license: individuals,
non-profits and for-profit organizations with up to three employees are eligible
for the free license; larger for-profit organizations need a company license.
Review <https://github.com/remotion-dev/remotion/blob/main/LICENSE.md> before
reusing the project under a different organization.
