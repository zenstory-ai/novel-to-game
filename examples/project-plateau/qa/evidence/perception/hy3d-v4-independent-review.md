# HY3D v4 Independent Visual Review

**Disposition: FAIL — 78/100**

## Evidence binding

- Source fingerprint: `66fac75814e21b4ee41ceae71cd08e6817a58b7fab4779e0c67cf468b46332a1` — matches `manifest.json`.
- Manifest SHA256: `71f204c2a003d318c7cea937ccec7b4675235cf7f8d4fa8b7a4cafa06b089b44` — matches `manifest.sha256`.
- Reviewed independently against `design/VISUAL_TARGETS.md`.
- Actually inspected all four contact sheets, relevant raw frames, state/browser evidence and performance/manifest records.
- No implementation-owner review was used as judgment evidence.

## Eight-category non-compensating rubric

| Category | Score | Result | Pixel evidence | Automatic failure |
|---|---:|---|---|---|
| Creature anatomy and identity | **21/25** | **FAIL** | HY3D Iguanodon is a major improvement: no duck-like muzzle, tail is continuous, limbs have organic volume and feet/hands are distinguishable. However, the hand lacks a clearly readable Iguanodon thumb spike in `orbit-iguanodon-000/090.jpg`; the front quarter reads as a generic robust ornithopod at thumbnail distance. Pterodactyl head, crest, wing finger, membrane and feet survive all orbit angles. | **No** |
| Creature material and surface | **9/10** | **FAIL** | Iguanodon has warm/cool underside separation, directional striping, skin variation and shaped highlights; pterodactyl membrane has translucent warm/cool variation and structured edges. Remaining issue: animal rendering is materially much richer than the flat low-poly terrain, producing an imported-asset/composite mismatch rather than one unified stylized-naturalist finish. | **No** |
| Environment form and depth | **10/15** | **FAIL** | Brook, canopy, glade, basalt and family form distinct layers. The brook remains flat parallel colour strips; trees and ground plants are visibly modular; basalt towers are repeated extruded pillars. HY3D creatures intensify the fidelity mismatch with this environment. | **No** |
| Lighting, atmosphere and colour | **11/15** | **FAIL** | Warm animals/ground, cool mountains and distance desaturation now provide clear warm-cool separation. Humidity is visible, but the large vertical cyan bands in the sky read as repeated screen-space curtains rather than naturally layered aerial moisture; local canopy fill and focused glade light remain weak. | **No** |
| Camera and signature composition | **13/15** | **FAIL** | Six signature compositions preserve their subjects and protection areas. VT-03 reads strongly with complete family silhouettes; VT-04 gives the threat clear sky space. VT-02 still allows the distant family/basalt and multiple plaques to compete with the footprint’s first read. | **No** |
| Motion and behaviour | **5/10** | **FAIL** | `contact-sheet-motion.jpg` shows pterodactyl displacement, but young-play and branch-pull frames contain almost no readable family pose, weight, head, tail or foot-state change. Branch-pull is not visually distinguishable through anatomical action; attack frames show only small threat displacement/pose change rather than a clear search-to-dive sequence. | **No**, but full-credit motion is not demonstrated. |
| Expedition tools and UI integration | **4/5** | **FAIL** | Camera and rifle share mahogany, brass, ivory and dark-metal grammar. Brown serif plaques are less debug-like than earlier candidates and remain near edges. They are still floating screen-space captions rather than fully diegetic field annotations. | **No** |
| Runtime delivery and accessibility | **5/5** | **PASS** | Raw `vt06-minimum-150-text-reduced-motion.jpg` shows complete left controls, camera prompt and right narration inside safe margins with no overlap; the contact-sheet crop is not representative of the raw frame. World, family, threat and tool remain visible. Manifest reports no console/external-request errors and performance passes target/minimum viewports. | **No** |

## Six visual targets

- **VT-01 — PASS**  
  The silver-black plate now has a credible layered metal edge, dark glass, basalt/forest silhouette and a clearly readable wing shadow. Title/menu remain in the right lane at both viewports.

- **VT-02 — FAIL**  
  The three-toed depression reads as a footprint rather than an arrow, but it is not the strongest first read; low contrast, flat brook bands, distant HY3D animals and multiple plaques compete with it.

- **VT-03 — FAIL**  
  Adult/young anatomy and monochrome readability are much improved and the frame protects the family, but the supplied young-play and branch-pull sequences do not visibly demonstrate their named behaviours.

- **VT-04 — FAIL**  
  Pterodactyl membrane thickness, wing structure and folded/attack silhouette pass in stills. The three-frame sequence does not establish a clearly continuous search-to-attack path or meaningful shadow progression.

- **VT-05 — PASS**  
  All four plates are materially seated within one physical ivory/dark frame. They are visually distinct: track/canopy, basalt/family scale, young-play with frontal wing, branch-pull with a different wing position and family layout.

- **VT-06 — PASS**  
  Both ordinary 1280×720 and 150% text/reduced-motion raw frames preserve route, family, threat, tool and complete text within safe margins.

## Previous 63/100 issues

- Iguanodon duck muzzle: **resolved**.
- Tube limbs: **resolved**.
- Creature material: **substantially resolved**, but fidelity integration remains.
- Humid atmosphere: **improved, not fully resolved**; vertical curtain bands look synthetic.
- Motion differences: **not resolved**.
- 150% text clipping: **resolved in the raw frame**.
- Silver-black plate: **resolved**.
- Plate 3/4 distinction: **resolved**.

## Executable blockers

1. Give the Iguanodon hand a clearly readable thumb spike and stronger species-specific hand silhouette at gameplay distance.
2. Make young-play visibly alter the juvenile’s spine, head, tail, weight and planted feet across the three frames.
3. Make branch-pull show anatomical contact, neck/shoulder effort, branch deflection and release—not merely a state label.
4. Expand the pterodactyl sequence into visibly different search, fold/dive and attack poses with continuous screen-space movement and shadow evidence.
5. Replace the repeated vertical humidity curtains with irregular distance-layered mist concentrated around canopy, brook and basalt depth planes.
6. Raise brook, tree and basalt material/form fidelity enough that HY3D creatures no longer look composited into a lower-fidelity world.
7. Increase VT-02 footprint contrast/contact detail and reduce nearby plaque competition so the three-toed print becomes the immediate first read.

**Non-compensating conclusion:** only runtime/accessibility reaches full category credit. With seven categories below full and VT-02/03/04 failing, this candidate cannot receive `100/100`.

