# HY3D stylized pterodactyl experiment

## Disposition

- The stylized image-to-3D direction is accepted for the pterodactyl focal asset.
- The generated mesh keeps a continuous wing membrane, readable long beak,
  crest, torso, feet and tail in front, rear and side views. It no longer reads
  as the procedural paper-bird fallback.
- The 30K delivery mesh is visually indistinguishable from the 50K candidate at
  the review distance (`0.811` full-frame RGB RMS) and preserves the wing edge.
- The source has no skeleton or authored animation. Three shared runtime morph
  targets (`wingUp`, `wingDown`, `diveFold`) restore the required flight states;
  this is sufficient for the current orbit/dive slice, not for production
  locomotion or close-contact animation.

## Generation record

- Service: Tencent Hunyuan 3D internal deployment
- Mode: `image2ModelV3.5`
- Input: original stylized low-poly pterodactyl reference
- Source mesh: `499956` triangles with 4K PBR textures
- Generation cost observed during this experiment: one internal allowance
  (`99` to `98`)

The raw 49 MB source and intermediate meshes are intentionally not committed.
Only the compressed delivery asset and source-bound visual evidence remain in
the project.

## Delivery asset

- Runtime path: `app/public/assets/pterodactyl-hy3d-v35-stylized.glb`
- Delivery mesh: `30496` triangles, `29878` vertices
- Delivery textures: three `1024x1024` WebP PBR maps
- File size: `1327456` bytes (`974909` bytes with gzip-9)
- SHA256: `e55fb8979f4349e8887943395ca58979dc417fd30f7df2fe438062161c620113`
- Validator: no errors; one missing-precomputed-tangent warning
- Shared runtime estimate: about `19 MiB` GPU memory after textures, mesh and
  generated morph buffers

One cached template supplies all three pterodactyls. Geometry, material and
textures are shared; only transforms and morph influence arrays are per animal.
The asset is requested once after first interaction and does not block the cold
title frame.

## Evidence

- `reference.png`: accepted style-controlled input
- `hy3d-preview.png`: service preview
- `render-contact-sheet-30k.png`: 30K front/rear/left/right inspection
- `render-geometry-30k-vs-50k.png`: geometry reduction comparison
- `../hy3d-creatures-v4/contact-sheet-orbits.jpg`: live WebGL creature orbits
- `../hy3d-creatures-v4/contact-sheet-motion.jpg`: live flight/dive sequence
- `../hy3d-creatures-runtime-v1/lazy-loading.json`: request-count and fallback
  transition proof
- `../hy3d-creatures-runtime-v1/package.json`: package measurements

## Scope decision

HY3D is retained for anatomy-critical focal creatures. It is not expanded to
trees, rocks or route dressing in this pass: those assets already satisfy the
authored silhouette and placement grammar, while generated replacements would
multiply textures, materials and grounding risk without the same visible gain.
