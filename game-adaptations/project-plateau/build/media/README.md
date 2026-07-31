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

The reproducible but derived `raw_take.webm`, `project-plateau-30s.mp4` and
`project-plateau-15s.mp4` files are intentionally ignored by Git. Their hashes
and full probe records remain in the manifest so a regenerated delivery file can
be compared exactly.

## Reproduce

```bash
cd game-adaptations/project-plateau/build/app
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

## Claim boundary

- `build/evidence/s8/report.json` remains the timing and traversal authority;
  the time-compressed clips are not timing evidence.
- S10 proves browser states, image provenance and gross composition floors; it
  does not prove subjective visual quality.
- Public-host loading, independent visual review and first-time player records
  remain separate gates.
