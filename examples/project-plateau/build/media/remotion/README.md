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
An ignored metadata sidecar records the complete request fingerprint, source
hash and a hash of the selected reference—never the API key—so
`voiceover:remix` cannot silently reuse stale audio. Calls have a bounded
timeout and bounded retry for rate limits and recoverable service errors. A
successful response is accepted only when its media type and file signature
match the requested audio format.

```bash
FISH_API_KEY=... \
FISH_VOICE_RIGHTS_ATTESTED=1 \
npm run voiceover
```

To test a different voice model you have the rights to, override the configured
public voice with `FISH_REFERENCE_ID` and set
`FISH_VOICE_RIGHTS_ATTESTED=1`. If only the local timing or mix
configuration changes, reuse the ignored response without another API request:

```bash
FISH_VOICE_RIGHTS_ATTESTED=1 npm run voiceover:remix
```

Generation writes a schema-4 ignored sidecar that binds the provider request,
source MP3, normalization plan and final WAV hashes. `npm run
verify:voiceover` returns `AUTOMATED_PASS` only when those links and the audio
measurements agree. It does not mean the take may be released.

Fish Audio model behavior and service terms can change independently of this
repository. Review <https://docs.fish.audio/features/text-to-speech> and
<https://fish.audio/terms> before a new public render.

## Restrained three-project voice trial

`tts-review-scenarios.json` deliberately selects only one high-value voice
moment per game. Project Plateau reuses its existing launch narration;
*Jin Ping Mei* tests one post-input Wu Yueniang boundary line, and *Journey to
the West* tests the first Luosha confrontation. These are ignored review
samples, not approved runtime assets. The tool sends only the selected
line—never the novel, source bible or design documents—and requires an
explicitly rights-attested voice reference.

```bash
FISH_API_KEY=... \
FISH_REFERENCE_ID_JPM_YUENIANG=... \
FISH_REFERENCE_ID_XIYOU_LUOSHA=... \
FISH_VOICE_RIGHTS_ATTESTED=1 \
npm run tts:trials
npm run verify:voiceover
npm run verify:tts-trials
```

The two character candidates are owned by their respective
`design/VOICE_AUDITION.json` files. Both keep runtime adoption at `none`; the
Project Plateau tool supplies provider bindings but cannot silently redesign
either game.

Run `npm run tts:matrix` only for a deliberate QA pass. It adds short and long
speech, English and Chinese, emotion transitions, pause/laughter, names and
numbers. It does not add those lines to any game. Generated files and their
private manifest stay under ignored `out/tts-review-scenarios/`.

```bash
FISH_API_KEY=... \
FISH_REFERENCE_ID=... \
FISH_REFERENCE_ID_ZH=... \
FISH_VOICE_RIGHTS_ATTESTED=1 \
npm run tts:matrix
npm run verify:tts-matrix
```

`npm run verify:voiceover` and `npm run verify:tts-trials` prove file decode,
format, bitrate, duration, audible signal, clipping, true peak and edge silence;
the normalized release narration also has a project loudness target. They cannot
prove pronunciation, intelligibility, acting or creative fit. Automated reports
use `AUTOMATED_PASS`, while release remains `BLOCKED` until
`voiceover-review.json` records hash-bound rights and human listening approval.
After review, copy the exact reference, source and normalized hashes from local
`out/voiceover-qa.json` into the approval fields, retain the rights evidence
locator and reviewer identity, set `releaseStatus` to `APPROVED`, then run
`npm run verify:voiceover:release`.
Run `npm run test:tts` to exercise request fingerprints, bounded retries,
timeouts, response validation, secret redaction, disclosure/response-size
limits, and the audio-analysis failure gates without making a provider call.

## Render

The ignored input MP4 must first exist at `../clip/project-plateau-30s.mp4`. If
it does not, regenerate it using the parent media-pack instructions.

```bash
npm install
FISH_API_KEY=... FISH_VOICE_RIGHTS_ATTESTED=1 npm run voiceover
npm run verify:voiceover
npm run render:frames
npm run render
npm run verify
npm run compress:github
npm run verify:github
```

`npm run render` starts with `verify:voiceover:release` and refuses to render
while `voiceover-review.json` is `BLOCKED`, either review is `NOT_RUN`, the
approval refers to different audio hashes or rights evidence is absent. Preview
frames remain available for review without
claiming release approval.

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
