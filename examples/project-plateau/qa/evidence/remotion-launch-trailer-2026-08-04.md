# Project Plateau Remotion launch trailer — 2026-08-04

## Release inputs

- Same-take gameplay clip SHA-256: `ce51fc981b4eb583cf055072ebdc5400194d764b0f166cb2ad885de2a7a702f1`
- Approved normalized narration SHA-256: `2a41922dea508c50535aa1e0240111d2b8ead9a64239cd197844e12384d0ec29`
- Narration approval: [voiceover-approval-2026-08-04.md](voiceover-approval-2026-08-04.md)
- Result still SHA-256: `6a019870eeedea97b82ca6b54424123fcc41286d4118c11748a59abd8cc080af`
- Procedural soundtrack SHA-256: `60f5d90f999122c9b158f00c47eec519f2e4f54736fc28d95e285abb1356e2f7`

The gameplay source is the current input-only Strong-result route. The Remotion
edit discloses its cuts and speed changes and does not replace gameplay with a
staged animation.

## Verified delivery

Commands run from `examples/project-plateau/build/media/remotion`:

```text
npm run verify:voiceover:release  PASS
npm run render                    PASS
npm run verify                    PASS
npm run compress:github           PASS
npm run verify:github             PASS
```

| Delivery | SHA-256 | Size | Result |
|---|---|---:|---|
| 36-second master | `e0763cc8ec855d626a98d413108f926951cfa4c180ff517f765476d771b66dbb` | 17.26 MB | PASS |
| GitHub attachment | `21b69b6ce1b2cd588b83ef2248157754f369a372f67f3aae0c75fc183dc0d23d` | 9,332,274 bytes | PASS |

Both deliveries are exactly 36.000 seconds at 1920×1080 and 30 FPS. They use
H.264 High Profile, progressive `yuv420p`, BT.709 limited range, AAC 48 kHz
stereo, fast-start MP4 layout, and retain measured mix headroom. The GitHub
delivery stays below the 10,000,000-byte upload ceiling.

## Publication binding

README attachment:
<https://github.com/user-attachments/assets/edde9933-c932-4bd9-9b4c-4587bbc516f7>

The uploaded asset was downloaded through the authenticated GitHub endpoint and
its SHA-256 matched the local GitHub delivery exactly. GitHub's Markdown API,
evaluated in `worldwonderer/novel-to-game` context, rendered the canonical URL as
a native video player rather than a plain download link.

An eight-frame contact sheet was inspected after final encoding and showed the
intended source hook, connected-plateau entry, glass-plate recording, dinosaur
family observation, defensive aerial response, covered return, Strong-result
proof, and repository call to action. This sampled visual check complements—but
does not claim to replace—watching the whole motion cadence.
