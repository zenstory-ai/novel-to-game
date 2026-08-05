# Visual Targets · Project Plateau

targetFinish: playable-prototype

## Purpose

This file is a pre-implementation visual acceptance target. It does not record
the disposition of the current candidate. Build and QA evidence must remain in
`build/evidence/` and `qa/` rather than being written back into this target.

The user-requested `100` is treated as a strict review ceiling, not as a claim
that subjective visual quality can be measured with scientific certainty. A
candidate receives `100/100` only when every target below passes in the same
source-bound review set, no category is compensated by another, and an
independent visual reviewer records no blocking defect.

## Target finish

- Product style: stylized expedition naturalism.
- Target runtime: desktop WebGL2, `1440×900`; minimum `1280×720`.
- Target presentation: a premium independent-game vertical slice whose focal
  creatures, expedition tools and signature frames no longer read as graybox,
  toy primitives or an asset-store collage.
- Reference boundary: original generated references, public-domain source
  facts and separately recorded redistribution-compatible assets only.

## 100-point non-compensating rubric

| Category | Points | Full-credit evidence | Automatic failure |
|---|---:|---|---|
| Creature anatomy and identity | 25 | Adult/young Iguanodon and pterodactyl silhouettes read at gameplay distance and thumbnail size; head, hand, foot, tail and wing structure survive a close frame and one orbit view. | Sphere/capsule head, duck-like muzzle, bead eyes, straight tube limbs, floating feet, dragging tail, bird/bat threat, visible interpenetration, or recognisable modern-franchise copy. |
| Creature material and surface | 10 | Slate animals have broad matte planes, warm underside separation, sparse scale accents and a narrow wet mineral sheen under the approved light. | Flat single-colour clay, glossy plastic/crocodile tile, texture noise replacing form, or unreadable eye/mouth planes. |
| Environment form and depth | 15 | Brook, canopy, glade, basalt and Fort form distinct depth layers with purposeful density and clear world-space route anchors. | Repeated cone/cylinder forest, flat empty ground, unscaled monolith wall, route readable only from text, or foreground blocking the signature subject. |
| Lighting, atmosphere and colour | 15 | Warm side light, cool canopy fill, humid aerial depth and one controlled glade sun lane separate route, family and threat without clipping or full-screen tint. | Uniform amber wash, crushed canopy, blank sky, flat ambient light, uncontrolled bloom, sepia world or colour-only state communication. |
| Camera and signature composition | 15 | All six target frames preserve their focus-protection rectangles, scale anchors and intentional overlays at target and minimum viewport. | Subject joints cropped/occluded, horizon/tool blocking route, UI over focal corridor, extreme lens distortion or inconsistent camera continuity. |
| Motion and behaviour | 10 | Family actions originate from named anatomical pivots; weight reaches grounded feet; tail/head counter-motion and pterodactyl state changes are spatially continuous. | Whole-creature sine bob as primary animation, skating feet, disconnected joints, hovering threat, foliage clipping or motion that hides decisions. |
| Expedition tools and UI integration | 5 | Camera, plate case, rifle and field UI share mahogany/brass/ivory/charcoal material grammar and remain subordinate to the world. | Debug-label presentation, generic modern weapon read, opaque central panels or competing prompts. |
| Runtime delivery and accessibility | 5 | Heaviest real state meets the Product Brief performance/payload targets; no console/resource errors; minimum viewport, 150% text, reduced motion and grayscale remain usable. | Required runtime target missed, broken asset request, visual feature disabled under normal settings, or accessibility mode destroys the focal hierarchy. |

Every row must receive full credit for `100/100`. Partial scores are diagnostic
only and cannot authorize the final quality claim.

## Approved target frames

### VT-01 · The plate breathes

- State: cold title load before interaction.
- Viewport: `1440×900`; repeat at `1280×720`.
- First read: a physical silver-black plate containing a legible living-world
  silhouette; title/menu remains in the right reading lane.
- Required upgrade: layered humidity, readable basalt/gingko/wing depth and a
  materially credible plate edge; no flat amber panorama.
- Protection: `x 8%–61%, y 8%–88%`; no intentional overlay.

### VT-02 · Three toes cross the water

- State: first controllable view and track examination.
- First read: sunlit three-toed print against silver brook and dark fern roof.
- Required upgrade: ground/stone/water material separation, convincing contact
  shadows and vegetation scale; no cone scatter or route arrow.

### VT-03 · Family in the silver frame

- State: camera-raised young-play and branch-pull moments.
- First read: complete adult and young silhouettes with red basalt scale anchor;
  pterodactyl enters as secondary pressure.
- Required upgrade: focal adult/young models pass the creature rows above,
  anatomy remains readable in the monochrome plate, and the field camera does
  not cover the subject.
- Protection: `x 22%–76%, y 13%–69%`; only physical frame brackets may overlap.

### VT-04 · Open water, folded wings

- State: search-to-attack at the covered-thorn/exposed-creek fork.
- First read: the dive corridor, then cover/response option.
- Required upgrade: membrane thickness and fold state are legible; wing motion
  and shadow stay spatially continuous; the threat does not read as a paper bird.
- Protection: `x 31%–82%, y 5%–67%`.

### VT-05 · What reached camp

- State: Strong result with four surviving plates.
- First read: physical recovered plate sequence before the verdict copy.
- Required upgrade: plate images are visually distinct, materially seated and
  integrated with the live Fort light rather than floating screenshots.

### VT-06 · Minimum viewport field state

- State: ordinary field play at `1280×720`, repeated with `150%` text and
  reduced motion.
- First read: route/creature/threat remains visible before edge UI.
- Required upgrade: no clipping, focal loss, oversized prompt or hidden tool state.

## Review bundle contract

One candidate review bundle must contain:

1. all six target frames from one current source fingerprint;
2. reference-view and orbit-view creature renders;
3. state and browser snapshots for each runtime frame;
4. a manifest that hashes every target, capture and contact sheet;
5. target and minimum viewport performance samples from the heaviest real state;
6. an independent review bound to the source fingerprint and evidence manifest.

Changing a target, focal asset, source byte, capture or contact sheet invalidates
the prior disposition. Hash integrity proves evidence identity, not subjective
quality; the reviewer must still inspect the actual pixels and motion path.
