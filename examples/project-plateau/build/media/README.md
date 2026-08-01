# Project Plateau media pack

This pack is derived from the same local WebGL build and input-only Strong path
used by the S8 traversal evidence. It contains no generated concept art and no
substitute render.

## Tracked artifacts

| Artifact | Purpose | Evidence boundary |
|---|---|---|
| `project-plateau-github.jpg` | 1280×640 repository/share card | Crop and resize of the real S10 browser frame only |
| `clip/contact-sheet.jpg` | Ten-frame review of the 30-second delivery encode | One frame every three seconds |
| `clip/marks.json` | Every input/state beat in the continuous source take | Includes raw hash, source window and console/request audit |
| `clip/manifest.json` | Measured MP4 properties and hashes | Includes all 14 delivery checks for both encodes |
| `RELEASE_COPY.md` | English copy and alt text tied to the captured build | Does not claim public hosting or independent approval |
| `remotion/` | Reproducible 36-second English launch-video project | Wraps the full 30-second capture with captions, CTA, Fish Audio narration and original procedural sound |

The reproducible but derived `raw_take.webm`, `project-plateau-30s.mp4` and
`project-plateau-15s.mp4` files are intentionally ignored by Git. Their hashes
and full probe records remain in the manifest so a regenerated delivery file can
be compared exactly.

## Reproduce

```bash
cd examples/project-plateau/build/app
npm run build
python3 test/capture_demo_clip.py
```

To re-encode the existing local raw take without replaying the route:

```bash
python3 test/capture_demo_clip.py --reuse-raw
```

The capture performs one continuous input-only Strong run at `1280×800`. Both
delivery versions apply only uniform time compression over that uncut window:
no teleport, direct time advance, state splice or synthetic frame. The
30-second and 15-second encodes are H.264 High Profile, `yuv420p`, progressive,
30 FPS, square-pixel, fast-start MP4s with a non-black first frame and no audio
track.

To render the captioned 1920×1080 launch version:

```bash
cd examples/project-plateau/build/media/remotion
npm install
npm run render:frames
npm run render
npm run verify
```

The Remotion source is tracked; prepared inputs, review frames and output MP4s
are ignored derived artifacts. Its delivery command emits H.264 `yuv420p`
BT.709 limited-range video with AAC stereo and fast-start metadata.

The narration script/model/mix configuration and environment-only credential
boundary are tracked in `remotion/voiceover.json` and `remotion/README.md`.
Neither the Fish Audio credential nor generated voice files belong in Git.
The Remotion project also produces a two-pass 1080p H.264 GitHub delivery under
10,000,000 bytes without replacing the higher-bitrate local master.

## Claim boundary

- `build/evidence/s8/report.json` remains the timing and traversal authority;
  the time-compressed clips are not timing evidence.
- S10 proves browser states, image provenance and gross composition floors; it
  does not prove subjective visual quality.
- Public-host loading is recorded separately; independent visual review and
  protocol-level first-time player records remain open evidence gates after
  example publication.
- The captioned launch video adds claims and motion graphics around the recorded
  run; it does not upgrade the run into independent QA evidence.
