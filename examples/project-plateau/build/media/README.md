# Project Plateau media pack

This pack is derived from the same local WebGL build and input-only Strong path
used by the current complete-run evidence. It contains no generated concept art and no
substitute render.

## Tracked artifacts

| Artifact | Purpose | Evidence boundary |
|---|---|---|
| `project-plateau-github.jpg` | 1280×640 repository/share card | Crop and resize of a retained current-run browser frame only |
| `RELEASE_COPY.md` | English copy and alt text tied to the captured build | Does not claim public hosting or independent approval |
| `remotion/` | Reproducible 36-second English launch-video project | Wraps the full 30-second capture with captions, CTA, Fish Audio narration and original procedural sound |

The reproducible `clip/` directory is ignored by Git. Raw takes, encodes, marks,
manifests and contact sheets are delivery-media intermediates, not game QA evidence.

## Reproduce

```bash
cd examples/project-plateau/build/app
npm run build
python3 ../media/scripts/capture_demo_clip.py
```

To re-encode the existing local raw take without replaying the route:

```bash
python3 ../media/scripts/capture_demo_clip.py --reuse-raw
```

The capture performs one continuous input-only Strong-result run at `1280×800`:
field order, traversal, two observation sites, four committed plates, two
limited defensive shots, exposed extraction and the final result all happen through real
browser input. The delivery versions use disclosed cuts between segments from
that same take and measured per-segment speed changes so the camera commitment,
winged dive, first rifle response, branch proof and result remain legible. They use no teleport,
direct time advance, fabricated state, substitute render or synthetic frame. The
30-second and 15-second encodes are H.264 High Profile, `yuv420p`, progressive,
30 FPS, square-pixel, fast-start MP4s with exact 30/15-second durations, a
non-black first frame and no audio track.

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

- `build/evidence/current-run/report.json` remains the uncut timing and traversal
  authority; the edited delivery clips are not timing evidence.
- The current-run report proves browser states and player-visible effects; it
  does not prove subjective visual quality.
- The captioned launch video adds claims and motion graphics around the recorded
  run; it does not upgrade the run into independent QA evidence.
