# Art Direction · Project Plateau

`targetFinish: playable-prototype`

## Creative position

**Field-plate naturalism** is a stylized first-person 3D world built from broad,
readable botanical masses, mineral silhouettes and tactile expedition tools.
Late-afternoon colour makes the living plateau inviting enough to approach;
monochrome glass-plate feedback turns the same view into evidence the player
must carry. The contrast between saturated living world and fragile black-
silver record is the project's visual signature.

This direction serves the approved proof loop. It does not add a larger world,
new creature roster, cinematic story or hunting fantasy. It retains the locked
stylized expedition naturalism, desktop landscape framing, Teen-equivalent
peril and real-time first-person 3D.

## Visual principles and rejection rules

| Principle | What it requires | Reject when |
|---|---|---|
| **The route reads before the HUD.** | Brook sheen/sound, canopy shape, smoke and red basalt create a world-space hierarchy. | Progress depends on a glowing trail, minimap, floating waypoint or indistinct repeated foliage. |
| **Every clean view costs open sky.** | Dense leaves protect the player and interrupt the subject; open basalt reveals scale and exposes the player to the aerial silhouette. | The prettiest framing position is also unconditionally safest, or cover is cosmetic. |
| **Living colour becomes physical proof.** | The real-time scene is humid green/red/amber; plate previews are silver-black, edged and materially crackable. | Evidence is a generic progress bar, collectible icon or full-colour screenshot detached from the camera object. |
| **Scale is compositional, not numerical.** | Human hands, tree trunks, young/adult grouping, red cliff and shadow span establish size in the frame. | A floating distance number or giant creature fills the frame without a comparison anchor. |
| **Peril stays readable and restrained.** | Threat is shown through gaze, shadow, wing posture, sound and route compression; impacts are forceful without gore. | Darkness, shake, bloom, particles or rapid cuts hide the decision, or the creature reads as a target to farm. |

Reverse style rules: no glossy theme-park jungle, toy-like low-poly diorama,
photoreal asset-store collage, brown colonial-adventure nostalgia, neon
survival HUD, modern military gun language, Jurassic-franchise imitation,
sepia filter over the whole world, or pseudo-documentary text covering play.

## Reference research and rights boundary

References answer material/anatomy questions; none is a source of reusable
modern game or film assets.

| Reference | Used for | May inform | Must not control / rights handling |
|---|---|---|---|
| 1912 novel text, Project Gutenberg eBook #139 | Source identity, spaces, slate-coloured iguanodons, red cliffs, gingko camp, glade, pterodactyl rookery, field notes and fragile proof. | Source-grounded silhouettes, materials, behaviour and terminology. | Later illustrations and adaptations are excluded. The recorded text is public domain in the USA; distribution elsewhere requires local review. |
| [Smithsonian Hare Patent Field Camera](https://www.si.edu/object/camera-aerial-hare-patent-field%3Anasm_A19830206000) | Plate-camera object grammar. | Wooden box, black bellows, brass fittings, glass trays and leather case. | Smithsonian marks the media public domain, but the final camera is an original simplified design rather than a traced asset. |
| [Science Museum Group field-camera collection](https://collection.sciencemuseumgroup.org.uk/search/object_type/field-camera) | Period range and repeated construction features. | Folding bellows, dark slides, rails, tripod fittings, mahogany/brass/leather vocabulary. | Catalogue data may be used under its stated terms; collection images are research-only unless individually licensed. Do not copy maker marks or exact product geometry. |
| [Library of Congress: Herbert G. Ponting and camera](https://www.loc.gov/pictures/item/2009633374/) | Human/camera scale and expedition handling near 1910. | Tripod/camera relationship and the physical effort of field photography. | The item says no known publication restrictions; it is contextual reference, not a face, costume or frame to reproduce. |
| [Natural History Museum: Iguanodon](https://www.nhm.ac.uk/discover/dino-directory/Iguanodon.html) and [changing reconstructions](https://www.nhm.ac.uk/discover/the-discovery-of-iguanodon.html) | Contemporary anatomy guardrail and the history of uncertainty. | Large herbivore, possible two/four-legged movement, hand/thumb-spike structure, and avoidance of the obsolete tail-dragging mount. | Do not copy museum palaeoart or claim the game reconstruction is definitive. The source's name remains a field label. |
| [Natural History Museum pterosaur overview](https://www.nhm.ac.uk/discover/the-truth-about-pterosaurs.html) | Wing and locomotion guardrail. | Membrane from arm toward ankle, elongated wing digit, light structure, soar/flap contrast and non-dinosaur distinction. | Do not copy a pictured species or artwork. The novel does not establish a precise species, colour or call. |

Any shipped texture, model, sound or font must be original, public domain or
recorded under a redistribution-compatible licence. A source page being
viewable does not grant asset reuse. Real faces, modern adaptation designs,
logos, dialogue, music and promotional imagery remain prohibited.

## Camera, composition and focus order

### First-person camera contract

- Landscape desktop view, approximately 90° horizontal field of view at 16:9;
  user FOV adjustment remains available without revealing culled geometry.
- Eye line sits below an adult iguanodon's shoulder mass and above the young,
  so scale appears through looking up and across rather than extreme lens
  distortion.
- Walking carries only a low, slow vertical rhythm. Sprint increases peripheral
  motion and tool movement, never the horizon roll. Crouch lowers the fern gap
  into a useful photographic slit.
- Camera-raise moves the physical field camera into view; the world does not cut
  to a detached photo mode. Peripheral vision narrows, movement slows and the
  threat can continue acting.
- No depth-of-field blur hides a route or threat. Mild focus falloff may live
  inside the plate preview only.
- Screen shake is reserved for one contact or rifle discharge, under 180 ms,
  and has a no-shake reduced-motion alternative.

### Focal order by state

| State | First | Second | Third | UI ceiling |
|---|---|---|---|---|
| Exploration | Route landmark or fresh trace | Distant subject silhouette | Aerial shadow / open sky | One contextual prompt; other panels folded. |
| Camera raised | Complete subject + scale edge inside frame | Occlusion/stability marks | Threat silhouette outside or crossing the frame | Plate rail and remaining-light hand only. |
| Threat search | Wing/gaze direction | Nearest cover mouth | Return landmark | No textual threat label. |
| Committed dive | Dive corridor | Cover or rifle silhouette | Plate case/body state | Cartridge marks only when the rifle is raised. |
| Result | Physical recovered plate | Its recorded strength/defect | Overall field-record band | One action: take the route again. |

### Occlusion tolerances

- Route landmarks remain at least half-visible from every decision node and
  recur in sound or silhouette when foliage closes.
- A partial teaching frame may hide roughly one third of the animal; a strong
  silhouette frame shows head, torso, feet and tail connection with no branch
  crossing the outline's main joints.
- Cover may occlude the pterodactyl body, but its moving shadow, wing cadence and
  call direction remain readable. The decision cannot depend on a single tiny
  airborne pixel.
- First-person tools never cover the lower-centre route opening while walking.
  When raised, the camera may cover that area because committing to a frame is
  the intended cost.

## Shape, scale and density grammar

### World shapes

| Element | Shape grammar | Scale grammar | Density rule |
|---|---|---|---|
| Red basalt | Tall fractured planes, vertical seams and flat mineral shelves. | Always paired with tree trunks or animal silhouettes. | Sparse, bold faces at decisions; no pebble noise over the route. |
| Protective vegetation | Interlocking arches, broad fern fans and thorn diagonals that form a dark roof. | Leaves overlap the player's hands and animal feet. | Dense only where it supplies cover or hides a branch; simplified elsewhere. |
| Exposed route | V-shaped opening toward amber sky, low ground cover and readable creek ribbon. | Long shadow and open vertical clearance imply aerial reach. | Low prop density; the risk is legibility, not clutter. |
| Brook / Fort line | Silver broken ribbon, pale stones, smoke column and giant gingko crown. | Repeats from near texture to distant landmark. | One of these anchors is readable at every return decision. |
| Rookery distance | Blue-clay bowl and small orbiting wing marks beyond trees. | Kept distant; gliding silhouettes scale against the red wall. | Suggest population with a few timed silhouettes, not a particle swarm. |

### Player and tool silhouette

The player is identified through **hands + field camera + plate case**, not a
visible body or portrait. The camera is a compact original folding form: dark
mahogany rectangle, shallow black bellows, warm brass corner/rail and one
side-mounted dark slide. The case is a flatter leather rectangle with four
visible slot tabs. The rifle is long, narrow and visually subordinate; it enters
only under danger, never as the default centre silhouette.

Tool states remain recognizable in peripheral view:

- camera folded: clean rectangular mass below the horizon;
- camera ready: bellows diamond and circular lens centred on the subject;
- plate selected: one ivory-edged tab protrudes;
- case damaged: sharp diagonal crack on the exact tab plus missing glass sound;
- rifle empty: open/broken chamber silhouette, not just a red counter.

### Iguanodon family grammar

- Two adults form long, heavy horizontal masses; three young repeat the form at
  clearly smaller scale. Production may reuse one adult and one young base with
  size/pose variation, but the family grouping must read as two plus three.
- Slate skin uses large matte planes, muted warmer underside and sparse broken
  scale accents. Wet sunlight produces a narrow mineral sheen, not crocodile
  gloss over the whole body.
- Semi-quadrupedal weight and an un-dragged tail respect current anatomy
  guardrails. Upright reaching and short two-legged movement may echo the text
  without locking the animal in a kangaroo pose.
- Young play in short, heavy arcs around the adults. One adult pulls a branch
  downward; the crash and family withdrawal are source-grounded behaviour
  anchors.
- Thumb/hand form remains readable in the strong side frame but is not enlarged
  into a weapon motif. The family never displays enemy health, targeting outline
  or hit reaction reward.

### Pterodactyl threat grammar

- A narrow head, compact torso and long membrane triangle create a silhouette
  unlike a bird or bat. The outline is an original field interpretation, not a
  named modern screen creature.
- Distant state: broad level wing line and slow orbit.
- Watch: head/gaze turn and one wingbeat interruption.
- Search: banked crescent, shortening circle and faster alternating shadow.
- Attack: wings partially fold into a spear-like diagonal; the dive corridor is
  apparent before contact.
- Membrane is desaturated clay-gray with warmer translucent edge against sun.
  Danger is carried by silhouette/velocity/call as well as hue.
- Under canopy it must pull up or glance away; it does not clip through leaves
  or hover like a turret.

## Functional colour, light and material

### Palette

| Function | Primary colour | Non-colour redundancy | Use boundary |
|---|---|---|---|
| Navigable living route | wet fern `#3F6A43` against deep canopy `#193C2B` | Repeating brook ribbon, open arch and moving leaf edges. | Never paint a solid green trail. |
| Source landmark / exposure | basalt red `#8B3F2F` and amber sky `#F2D08B` | Vertical fracture silhouette and open V-shaped sky. | Red indicates geology/exposure, not generic danger. |
| Relative safety / Fort | canvas ivory `#E8DFC7` and smoke gray `#C7CEC7` | Thorn-ring circle, vertical smoke and gingko crown. | No glowing safe-zone bubble. |
| Camera / evidence affordance | brass `#B08B4F`, plate ivory `#F1E8D0`, emulsion charcoal `#202724` | Rectangle/tab/plate-notch shapes and fixed screen position. | Brass does not turn every interactable into gold loot. |
| Immediate danger | oxidized vermilion `#C24B34` | Folded-wing spear shape, tightening cadence and chevron crack motif. | Never rely on red alone; no red enemy outline. |
| Time pressure | sunset amber moving toward dusk blue `#243947` | Pocket-watch hand, lengthening shadows and evening insect bed. | Avoid a full-screen tint that corrupts evidence colour. |

Palette checks include grayscale and red/green colour-vision simulations. Every
functional state remains legible through shape, motion, text or position.

### Light arc

The run begins with side-lit late afternoon: warm sky, cool canopy, crisp track
and a red cliff break. The glade receives one broad sun lane that can hold the
family and basalt in the same exposure. Remaining light shifts shadow length
and sky value gradually; it never jumps to night during a decision. The Fort
smoke stays pale against both green and dusk-blue backgrounds.

Camera preview simulates a glass-plate negative/positive proof object rather
than tinting the world sepia: charcoal-silver values, slightly soft edge falloff,
one physical border and clear cracks. No film grain or chemical bloom may hide
the grading cue.

### Materials

- **Expedition:** dry canvas, worn leather, dark mahogany, tarnished brass,
  glass and rope; edge wear follows handling, not random grunge.
- **Plateau:** matte red basalt, damp dark bark, broad waxy fern, fibrous thorn,
  blue mineral clay and silver water.
- **Animals:** large low-frequency skin planes with selective fine texture only
  near the camera; no uniform reptile tile material.
- **Interface:** cream field card, charcoal ink, brass rules and glass-slot
  shapes. It behaves like an instrument/report layer, not a leather scrapbook
  full of paragraphs.

## HUD and interaction feedback

The HUD occupies the edges and never sells inventory, health or tactical depth
the design does not contain.

| Element | Position | Visual form | Disclosure |
|---|---|---|---|
| Context prompt | lower-left feedback band | System sans, short action + key inside dark translucent strip. | Appears only in interaction range; fades after the action is learned. |
| Plate rail | lower-right | Four horizontal ivory tabs with unexposed dot, exposed notch pair or diagonal crack. | Hidden until camera first raises; persistent thereafter. |
| Remaining-light watch | upper-right | Small brass hand/arc; exact time opens as a compact watch face. | Revealed after first plate or manual check. |
| Cartridge state | lower-centre-right near rifle | Two chamber silhouettes. | Visible only while rifle is active or a dive commits. |
| Sound caption | lower-centre, above prompt band | Bracketed concrete sound phrase with direction arrow. | Accessibility option; never overlaps the central subject. |
| Plate preview | right-side inspection lane | Physical monochrome plate, one short label and zero/one/two notches. | Appears after exposure, then collapses to the rail. |
| Result board | centred lower two-thirds after action ends | Recovered plates on an ivory light board; record band beneath. | Terminal state only. |

Functional Latin labels never render below 11 px at minimum viewport; body and
result copy never below 13 px. Display serif is a Georgia-like system serif for
field orders/headings; functional copy uses the platform system sans. Required
information never depends on handwriting or italic. Text scaling up to 150%
must retain route visibility and reflow the plate/result panels.

## Motion and transition specification

### Core verb motion table

| Verbatim core verb | Press / confirmation feedback | Result grades | Transient copy motion | State transition / restraint |
|---|---|---|---|---|
| Traverse first-person connected terrain between relative safety and an objective space. | Foot contact, low tool counter-motion and vegetation yielding on contact; sprint adds forward tool tuck. | Clear path / obstructed / recoverable boundary. | Boundary cue rises 12 px in the lower-left band over 180 ms, holds 900 ms, fades 180 ms. | No cuts. Boundary recovery eases to last stable ground over 250 ms; reduced motion cuts directly without camera translation. |
| Observe or search the environment for route, objective and threat information. | Gaze dwell tightens a small neutral bracket; confirm produces hand/eye settle and object-local response. | Trace seen / contextual relation learned / insufficient view. | Field note wipes left-to-right over 140 ms, holds 1.4 s, fades without travelling across the subject. | World remains live. No zoom punch. Reduced motion uses an instant bracket and static note. |
| Commit to an exposed objective interaction while the threat state can change. | Camera rises in 180 ms; focus breath stabilizes; shutter snaps in 80 ms, followed by plate-slide and the two-second locked exposure posture. | Zero: fogged/occluded plate; one: complete silhouette or scale; two: clarity/context plus living behaviour. | Plate label stamps onto the right inspection lane in 120 ms; the physical plate enters over 220 ms, holds 1.2 s, then slots down over 200 ms. | Saturated world continues behind the plate; no freeze. Reduced motion replaces travel with a static plate cut and keeps timing/audio. |
| Evade through cover or route choice, or spend a limited defensive response. | Cover entry darkens upper canopy and widens wing sound; rifle press raises weapon, timely fire gives one short recoil and creature shear-away. | Cover breaks line / shot interrupts / mistimed contact. | No success word. Contact cause appears only after impact in the lower feedback band. | Dive motion stays spatially continuous. Reduced motion removes FOV kick and shake, keeps silhouette, directional audio and result pose. |
| Reach relative safety with the acquired objective state intact. | Thorn gate enters foreground; hands place the case; world action ceases before plates are revealed. | No record / insufficient / corroborating / strong. | Result title fades on after the last physical plate settles; no score burst or confetti. | 300 ms exposure crossfade from live Fort light to plate board. Reduced motion uses a direct cut after the gate sound. |

### Additional state transitions

- **Awareness change:** no screen tint or label. Distant → watch adds one head
  snap/call; watch → search tightens orbit and shadow cadence over one pass;
  search → attack folds wings and narrows the sound cone.
- **Plate crack:** 70 ms glass impulse, one diagonal fracture appears from impact
  edge, plate preview loses its notches after the crack. Screen does not shatter.
- **Recoverable contact:** one 120 ms directional displacement, 180 ms settle,
  torn-sleeve/body cue, then control. No blood overlay.
- **Second contact / failure:** impact silhouette holds for 90 ms, sound cuts,
  image drops to charcoal over 220 ms, exact cause card appears after 150 ms.
- **Pause:** world freezes and desaturates slightly over 120 ms; a compact field
  card enters from the left in 160 ms. Resume removes it in reverse without a
  countdown. Reduced motion cuts both states.
- **Focus loss:** identical to pause but labelled `PAUSED — WINDOW INACTIVE`; no
  input echo occurs on return.

### Transient text contrast triples

| Category | Core colour | Outline / backing | Required verification frame |
|---|---|---|---|
| Context action prompt | ivory `#F1E8D0` | charcoal `#17201D` strip at 82% opacity, 1 px ivory keyline | Brook blind: mixed silver water, red stone and mid-green fern. |
| Field observation note | charcoal `#17201D` | warm paper `#F1E8D0` at 94% opacity, 1 px brass left rule | Basalt shelf: amber sky behind slate animal and bright brass camera edge. |
| Plate grade / defect | charcoal `#202724` | opaque plate ivory `#F1E8D0`, double-notch icon or crack shape | Camera frame during branch-pull behaviour with pterodactyl shadow crossing. |
| Sound caption | ivory `#F1E8D0` | deep dusk `#182B33` pill at 88%, directional wedge | Return fork at dusk with moving foliage and water highlights. |
| Failure cause | ivory `#FFF6DF` | deep oxblood `#4B2524` rectangular card, 2 px charcoal edge | Most visually busy contact frame: open creek, wing/body, broken plate and muzzle flash absent. |
| Final result band | charcoal `#17201D` | opaque light-board cream `#E8DFC7`, brass divider plus plate icons | Four recovered plates over mixed grayscale imagery and warm Fort background. |
| Field-order title card | ivory `#F1E8D0` | charcoal `#17201D` at 96% with brass hairline | Title loop's red cliff, green canopy, smoke and moving wing silhouette. |

Threat intent/state labels are forbidden in P0. If a later build introduces
one, it must use the sound-caption triple and the same busiest return-fork
verification frame; a single-colour halo is insufficient.

## Sound and music direction

Sound shares the world's material vocabulary: water, foliage, leather, wood,
brass, glass, canvas, breath, wing membrane and period mechanical action. It
does not use electronic scanner beeps, modern weapon sweeteners, tribalized
“jungle” percussion or borrowed franchise motifs.

| Event / layer | Timbre source and form | Functional hierarchy | Visual/world coherence |
|---|---|---|---|
| Traverse | Soft boot/soil/stone set, leather case creak, fern brush, brook in a stable directional bed. | Brook direction and cover density sit above decorative insects; footsteps never mask a threat call. | Materials match the visible surface and carried case. |
| Examine | One close cloth/leather settle, fingertip/stone contact and pencil-on-card scratch. | Confirms input below threat cues but above ambience. | Field-report action, no magical discovery chime. |
| Camera raise / shutter | Wood/brass hinge, shallow bellows breath, mechanical shutter, dark-slide click and glass seat. | Signature action; distinct start, commit and completion sounds make the two-second exposure readable. | Derived from the physical camera construction, not a modern SLR. |
| Plate grade | Dry paper/plate reveal; one soft brass tick per earned cue. Zero grade has a dull slide and no tick. | Quiet but unmistakable; never celebratory. | Matches notch icons and monochrome plate. |
| Plate crack / body contact | Sharp glass crack at the case side, leather impact, breath loss and brief low-frequency wing rush. | Above every layer except rifle; exact side and severity are directional. | No gore or full-screen shatter. |
| Awareness: distant / watch / search / attack | Wide intermittent call and slow membrane wash → single close answer → tightening alternating wing passes → narrow descending rush with a short pre-contact air cut. | Highest continuous decision information. Captions expose direction and cadence, not a numeric state. | Motion and sound state change together. |
| Enter / remain in cover | High frequencies damp slightly; leaf strikes become close; aerial pass widens and moves overhead. | Confirms that cover changed reach without a `SAFE` sound. | Acoustic occlusion follows visible canopy. |
| Rifle | Dry mechanical raise, one restrained period-rifle report, short terrain echo, distant answer near brook. | Loudest single event; no kill-confirm sting. | Deferred answer carries the source rule that gunfire travels. |
| Return / result | Fort canvas, thorn gate and case latch; plates placed one at a time; a low bowed-string dyad resolves only after the result band appears. | Releases danger, then lets plate sounds carry evaluation. | No fanfare, choir or heroic march. |
| Failure | Contact/timeout cause remains audible; ambience cuts to a narrow brook or wind remnant, then one low wood knock under the card. | Cause precedes UI; restart is sonically clean. | Avoids horror sting and moralizing music. |

Music is sparse. Title/menu uses a low chamber texture—bowed cello/viola,
breath-like harmonium and occasional struck wood—chosen for an early-twentieth-
century expedition room rather than an invented South American ethnic colour.
Exploration runs mostly on diegetic sound; a two-note low string pressure layer
may enter only at search and withdraw under cover. The glade behaviour window
uses no “wonder” swell until after the shutter; the animal remains the focus.
Music off leaves every core rule readable. Separate music, ambience, effects
and caption controls are required.

## Signature moments by interface and mode

Every moment below is achievable in the real game state. None is a concept
poster or prerendered substitute for play.

### Moment 1 — Title / main menu: “The plate breathes”

The first focus is a monochrome glass plate showing a red-cliff-shaped negative
silhouette. Living colour slowly appears behind it: green canopy, pale Fort
smoke and one distant wing. Menu actions sit in the dark right margin: `Enter
the basin`, `Settings`, `Credits`.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Black field; glass edge catches one brass line. | 180 ms | Static, centre-left. |
| 2 | Plate slides upward; negative cliff and tree appear. | 320 ms | No camera move. |
| 3 | Live colour world resolves behind the plate; smoke rises and wing crosses once. | 900 ms | Very slow 1% forward drift; disabled under reduced motion. |
| 4 | Title and three menu actions fade in. | 240 ms | Focus remains on plate, then reading moves right. |

- Focus protection: `x 8%–61%, y 8%–88%`
- Intentional overlay: **no**; title/menu occupies `x 67%–94%`.

### Moment 2 — Exploration: “Three toes cross the water”

At control handoff, a fresh three-toed print catches the only direct sun beside
the silver brook. The print points through dark ferns toward a distant moving
slate mass; the red cliff and smoke anchor return and objective depth.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Field-order card clears; track holds still, water moves. | 220 ms | First-person control begins without a cut. |
| 2 | Player steps closer; smaller parallel print becomes visible. | player-paced | Natural head movement only. |
| 3 | Examine confirm; fern edge yields and distant young crosses the gap. | 600 ms | Gaze remains player-controlled. |
| 4 | Concrete field note appears in lower-left band. | 1.4 s hold | No zoom or focus blur. |

- Focus protection: `x 26%–67%, y 38%–82%`
- Intentional overlay: **no**; feedback stays below/left of the print.

### Moment 3 — Core camera action: “Family in the silver frame”

Crouched under a broad fern, the player frames young animals playing beside two
adults. One adult's flank crosses red basalt for scale. The field camera fills
the lower third; a pterodactyl shadow begins to enter the upper-right before the
shutter commits.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Camera rises; bellows opens; subject remains live. | 180 ms | Physical tool enters, no mode cut. |
| 2 | Young completes one heavy play arc; stability settles. | 500–900 ms | Player adjusts frame. |
| 3 | Shadow tip enters; player releases shutter. | 80 ms input | Two-second posture lock begins. |
| 4 | Adult turns toward the shadow; nearest wing call answers. | 550 ms | World continues around camera. |
| 5 | Strong plate preview enters right lane with two notches. | 1.2 s hold | Preview never covers family/threat corridor. |

- Focus protection: `x 22%–76%, y 13%–69%`
- Intentional overlay: **yes**, but only the camera's own framing brackets;
  transient copy remains outside the rectangle.

### Moment 4 — Return pressure: “Open water, folded wings”

At the return fork, Fort smoke is visible beyond a short open creek. The
pterodactyl folds into a diagonal dive above the water; the left side closes
into a thorn arch. Plate tabs, watch hand and the rifle's two chamber marks make
the decision readable without an action wheel.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Tight circling shadow crosses creek; wing cadence accelerates. | 420 ms | Player retains look control. |
| 2 | Threat folds into dive; thorn leaves react to its air. | 360 ms | No shake; corridor becomes clear. |
| 3A | Player enters cover; wing opens and passes overhead. | 700 ms | Upper frame darkens naturally. |
| 3B | Or rifle rises and fires; wing shears across the creek. | 180 + 600 ms | One restrained recoil, then immediate route control. |
| 4 | If fired, distant brook brush answers before the player reaches it. | 900 ms later | Sound/motion, no text label. |

- Focus protection: `x 31%–82%, y 5%–67%`
- Intentional overlay: **no**; cartridge marks remain below-right.

### Moment 5 — Pause / controls: “Field card over a held breath”

The exact live frame freezes and loses a little saturation; a narrow field card
on the left shows controls and current physical plates. The threat silhouette,
route opening and remaining-light hand remain visible on the right.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | World/audio freeze; ambience ducks but does not restart. | instant | Camera fixed at input boundary. |
| 2 | Saturation eases down; field card slides from left. | 120 / 160 ms | No blur. |
| 3 | Resume removes card and restores sound from the same sample phase. | 160 ms | No countdown or input replay. |

- Focus protection: `x 44%–94%, y 5%–87%`
- Intentional overlay: **no**; pause card occupies `x 3%–39%`.

### Moment 6 — Strong result: “What reached camp”

First-person hands place intact plates one at a time on a warm light board.
Their silver-black images show flank/scale, young-at-play and branch-pull
behaviour. Fort colour remains softly visible at the outer edge; the strong
result arrives only after physical evidence is present.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Thorn gate closes; case enters the table plane. | 420 ms | Continuous first-person move to fixed board view. |
| 2 | Each intact plate settles; cracked slots remain empty/broken. | 260 ms each | No montage cut. |
| 3 | Notches/defect labels appear beside their own plates. | 180 ms | Local overlays only. |
| 4 | Overall result line and restart action fade in. | 240 ms | Background stays still; no confetti. |

- Focus protection: `x 15%–85%, y 14%–72%`
- Intentional overlay: **yes** for plate-local labels only; result line stays
  below `y 76%`.

### Moment 7 — Failure: “The second pass”

The folded wing crosses open sky, the case edge strikes the ground and sound
drops before the charcoal cause card arrives. The last readable world cue—the
unentered thorn arch—remains faintly visible behind the card so the failure
points back to an actionable choice.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---:|---|---:|---|
| 1 | Threat crosses protection corridor; impact moves view once. | 120 ms | Directional displacement, no spin. |
| 2 | Plate crack and breath; image holds on case/cover relation. | 90 ms | Freeze only after consequence is visible. |
| 3 | Image falls to charcoal; cause card appears. | 220 + 150 ms | Reduced motion direct-cuts after impact audio. |
| 4 | `Take the route again` becomes active. | 180 ms | One clear action. |

- Focus protection: `x 23%–78%, y 10%–74%`
- Intentional overlay: **yes** after the evidence frame holds; card uses the
  declared failure triple.

## Dynamic media and continuity direction

Real-time 3D, environment loops and short state-driven sequences are dynamic
media. They remain interactive except at explicitly bounded result/failure
beats.

### Dynamic-media role table

| Dynamic media | Experience role | Duration / rhythm | State position | Fallback | Class |
|---|---|---|---|---|---|
| Title live-world loop | Establish plate-to-living-world identity before play. | 8–12 s seamless loop; one smoke rise and one distant wing crossing. | Title / menu only. | Static colour scene behind the plate; title/menu timing unchanged. | Degradable |
| Connected real-time route | Deliver every core verb and spatial decision under free look. | Full 1–3 minute run; no authored camera cuts or empty travel added to stretch duration. | Active play. | None; a non-interactive substitute fails the product. | Release gate |
| Plate-exposure sequence | Make commitment, grading and material proof continuous. | 180 ms raise, player-paced settle, 80 ms shutter, two-second commitment, preview. | Camera action. | Reduced-motion static raise/preview with identical lock and world-state timing. | Release gate |
| Pterodactyl state motion | Expose distant/watch/search/attack and cover/rifle response. | Multi-second continuous cycles; dive must telegraph before contact. | Development/test beats. | Simpler authored silhouette poses and shadow track with full audio/state timing. | Release gate |
| Iguanodon behaviour loop | Supply living evidence windows and wonder without a cutscene. | Grazing base loop plus young play and branch-pull events, each with readable anticipation/recovery. | Glade combination beat. | One adult + one young with pose/scale reuse; behaviour events remain. | Release gate |
| Result plate review | Read back physical action history without leaving first-person continuity. | 0.4 s gate, 0.26 s per plate, result after last. | Terminal success/partial. | Static board with all exact plates already placed; result order unchanged. | Degradable |
| Failure transition | Preserve cause frame, then expose actionable copy. | Under 0.6 s before readable card. | Terminal failure. | Direct cut to card after cause audio; last world frame remains as background. | Degradable |

### Video / generation reference package

No mandatory prerendered video is planned. If image or motion generation assists
original assets, the package below controls facts without selecting a provider.

| Package part | Required content |
|---|---|
| `STYLE_LOCK` | `Stylized expedition naturalism, circa 1912 material culture; broad matte botanical masses; fractured red basalt; slate herbivore silhouettes; humid amber side light and cool green canopy; tactile mahogany, black bellows, tarnished brass, leather and glass; restrained danger; no modern franchise language, glossy theme-park finish, photoreal collage, neon UI, gore or sepia world filter.` |
| `CHARACTER_SHEET` | Player hands/tool scale; one adult and one young iguanodon turnaround with neutral/grazing/play/branch-pull poses; pterodactyl distant/watch/search/dive silhouettes with membrane structure; no human faces. |
| `LOCATION_SHEET` | Fort/gingko/smoke, brook blind, canopy overlook, basalt shelf, glade, covered return, exposed creek and distant rookery; same geography in late-afternoon and near-deadline light. |

For text-only generation, repeat the style lock verbatim. For reference-image
conditioning, approve one original canonical sheet and prompt only deltas.
Generated output is reference until its rights, consistency and in-engine
readability are recorded.

### Fact separation and reference permissions

| Subject | Persistent fact | Temporary state | Reference may control | Reference must not control |
|---|---|---|---|---|
| Player tools | Camera mahogany/brass/bellows silhouette; four-slot leather case; subordinate period rifle. | Camera folded/raised, selected plate, cracked slot, rifle chamber state. | Object proportion and material response. | Player face/body, unrelated costume, landscape or tool ownership changes. |
| Iguanodon adult | Heavy horizontal herbivore, slate planes, semi-quadrupedal stance, readable hand/tail. | Grazing, branch pull, alert, withdraw; light/wetness. | Anatomy guardrail and persistent proportions. | Exact museum artwork, pterodactyl design, world palette or a fixed pose. |
| Iguanodon young | Adult family grammar at smaller scale with quicker heavy arcs. | Play, pause, withdraw. | Size ratio and shared identity. | Adult damage/state, scene layout or cute mascot exaggeration. |
| Pterodactyl | Narrow head, compact body, membrane triangle and elongated wing structure. | Four awareness poses, distance, light and cover response. | Persistent silhouette/anatomy. | Iguanodon anatomy, camera design, landscape or copied modern species styling. |
| Fort / route | Fixed node relations, red cliff, brook, gingko, glade and two return paths. | Light remaining, smoke motion, broken foliage and shot-response brush. | Geography/material hierarchy. | Creatures, player state or a different route topology. |
| Glass plate | Ivory-edged rectangle, silver-black emulsion and physical notch/crack language. | Unexposed, zero/one/two cue, cracked. | Object form and state legibility. | Living-world colour, creature anatomy or result outcome. |

### Camera and continuity boundaries

| Sequence | Start boundary | End boundary |
|---|---|---|
| Title → field order | Live background faces the brook/gingko; no player hands; late-afternoon light; water/insects present. | Same light/weather and ambient phase; order card covers frame; still no hands. |
| Field order → control | Camera faces the sunlit track; tool folded below frame; four plates/two rounds; no threat awareness. | Identical gaze and light; hands enter only after first movement input; ambient audio never restarts. |
| Exploration → camera raised | Player position/gaze/subject pose preserved; right hand below frame; selected plate known. | Same world time/pose progression; camera occupies lower third; plate tab visible; threat continues from prior state. |
| Shutter → plate preview | Camera raised; both hands on tool; selected plate inserted; threat and herd positions live. | Camera still raised; exposed plate appears in right lane; exact herd/threat positions have advanced by the commitment duration. |
| Glade → return fork | Case contains the exact exposed/cracked plates; awareness, shot history, light and body margin persist. | Same states; Fort smoke/route geometry visible; rifle remains in its prior lowered/raised state. |
| Fort gate → result | Surviving player carries the exact case; current light/shot history; Fort ambience. | First-person hands place only intact plates; result reads exact points and action-history callback; no unexplained repaired plate. |
| Contact → failure | Threat direction, nearest unused cover, plate/body state and current light visible. | Last frame retains those facts under the card; restart alone resets them. |

## Asset gates and degradations

Every item belongs to exactly one tier.

### Release-gate assets

Missing any item below means the visual build cannot claim the complete slice:

| Asset group | Required visual/sonic function | Rights / originality boundary |
|---|---|---|
| Connected collision-readable environment | Fort, brook blind, canopy/basalt fork, glade and both returns with the declared landmarks, cover and sight lines. | Original geometry/materials; source text and licensed factual references only. |
| Player field-camera set | Folded/raised tool, plate insertion, four case slots, glass plate and crack states. | Original object derived from generic period construction; no copied maker marks/product mesh. |
| Iguanodon family set | Two-adult/three-young read, grazing, young play, branch pull and withdrawal. | Original reconstruction; modern museum art is anatomy research only. |
| Pterodactyl pressure set | Four silhouette/motion states, shadow, dive, cover pull-up and rifle shear-away. | Original unspecified pterosaur; no modern adaptation creature. |
| Core HUD / result set | Field order, prompts, plate rail/previews, watch, chamber marks, captions, pause, result and failure in all states. | System fonts or separately ledgered fonts; original icons/layout. |
| Functional light states | Late-afternoon start through deadline with subject, route, threat and Fort legible at target viewports. | Original lighting; no baked third-party sky without licence. |
| Core material/sound set | Camera, glass, leather, rifle, brook, cover, footsteps, four threat states, impact, Fort and results. | Original recording/synthesis or redistribution-compatible source with ledger. |
| Accessibility states | Reduced motion, text scale, sound captions and non-colour state redundancy. | Original UI/state assets. |

### Degradable assets

| Asset | Preferred expression | Fallback that preserves play |
|---|---|---|
| Extra family variation | Unique adult/young markings and pose offsets. | Reuse one adult/young base with scale, side and timing variation. |
| Distant rookery population | Several independent orbit silhouettes and blue-clay depth. | Two looping distant silhouettes plus one shadow source. |
| Small flora / insects | White-yellow flowers, bees, fern tips and restrained particles. | Static colour clusters and one ambient insect layer; route edges remain clean. |
| Volumetric humidity | Layered amber shafts and cool distance haze. | Depth fog plus one broad sun plane; no missing gameplay cue. |
| Fort dressing | Canvas bundles, notebook, rope, crates and camp wear. | Thorn ring, smoke, gingko, light board and camera case only. |
| Distant terrestrial answer after gunshot | Moving brush plus partial low silhouette. | Directional call, brush displacement and added crossing delay; no full model. |
| Title environment loop | Live smoke/water/wing movement. | Static approved gameplay view behind moving glass plate/menu. |
| Detailed plate chemistry | Subtle emulsion edge and exposure bloom. | Flat silver-black image with cue notches and physical crack. |
| Secondary result hand motion | Individual placement/finger adjustment. | Plates already arranged on the same board, revealed in order. |

Generated imagery or animation may fail without blocking the build only for the
degradable tier. A release-gate asset may begin as a readable graybox, but the
gate remains failed until its required function, originality record and real-
view evidence exist.

## Visual risks and evidence gates

| Risk | Earliest falsifiable check | Fail condition | Direction response |
|---|---|---|---|
| The example still reads as text-forward | First public gameplay frame at 1440×900 and thumbnail crop. | Camera, animal, threat and route cannot be understood without reading the field note. | Reduce copy/overlay, widen subject/route silhouette and recapture; do not add explanatory text. |
| Creature looks like a modern franchise copy or generic stock dinosaur | Silhouette sheet review before textured model. | Reviewers identify a specific modern adaptation or the target/threat cannot be separated at thumbnail size. | Rework proportions/material/pose from source + museum facts; preserve original reference record. |
| Dense foliage hides decisions or tanks performance | Heaviest glade/return state in real renderer. | Route/cover/threat are unreadable or the product performance floor is missed. | Delete small foliage, merge visual masses and preserve decision-bearing edges first. |
| Plate grades look arbitrary | Zero/one/two preview comparison without labels, then with labels. | Testers cannot match grade to visible obstruction/scale/behaviour. | Strengthen silhouette/notch/crop differences; do not solve with larger score text. |
| Pterodactyl state depends on colour or audio alone | Grayscale, muted-audio and captioned runs. | Watch/search/attack cannot be ordered from silhouette/motion plus available accessibility channel. | Increase pose/cadence/shadow differences and caption direction. |
| Camera motion causes discomfort | Walking, camera raise, rifle and impact with motion options. | Horizon roll, persistent bob or FOV kick obscures target/route or remains under reduced motion. | Remove optional movement; retain positional/sound consequence. |
| Period styling romanticizes colonial conquest | Title, copy, result and reward review. | Trophy, rifle, khaki portraiture or conquest language becomes the aspirational focal point. | Re-centre camera/plates/ecology, subordinate weapon and remove triumphalist copy/music. |

The art gate passes only when real screenshots/video demonstrate all five
same-play verbs, every release-gate state, the busy-frame contrast triples and
the seven signature moments at target viewport. Concept art alone cannot pass
the gate.

## Coverage appendix

This table accounts for every level space, interaction mode, unit and terminal
state in the approved game design.

| Game-design item | Art-direction coverage |
|---|---|
| Title / main menu | Signature moment 1; HUD typography; title dynamic-media role. |
| Opening field order / first control | First-minute premise treatment; camera/focus contract; signature moment 2; continuity boundaries. |
| Fort Challenger | World shape/material grammar; level asset gate; result moment and boundaries. |
| Brook blind / three-toed track | Route grammar; exploration focus; signature moment 2; traverse/examine motion and sound. |
| Canopy overlook | Protective vegetation, occlusion tolerance, cover colour/light and level coverage. |
| Basalt shelf | Exposure shape/light, scale composition, plate grading and visual-risk checks. |
| Iguanodon glade | Family grammar; signature moment 3; behaviour dynamic-media row; asset gate. |
| Distant rookery sightline | Rookery world grammar; pterodactyl palette; degradable population fallback. |
| Covered thorn return | Cover grammar, awareness motion/audio, route moment 4 and level asset gate. |
| Exposed creek return | Exposure grammar, decision HUD, rifle feedback, moment 4 and shot-response fallback. |
| First-person player / camera / plate case / rifle | Tool silhouette; material table; core motion/sound; release-gate player set. |
| Iguanodon adults and young | Family shape/motion/material; fact separation; dynamic-media and release-gate rows. |
| Pterodactyl distant/watch/search/attack | Threat grammar; motion/audio; moment 4; dynamic-media and release-gate rows. |
| Examine interaction | Core verb motion, sound, prompt triple and exploration moment. |
| Camera exposure / zero-one-two plate results | Core verb motion, plate colour/material, moment 3, preview HUD and contrast triple. |
| Wildlife awareness / cover | Threat grammar, state transition, sound hierarchy, accessibility redundancy. |
| Rifle interruption / gunshot callback | Tool hierarchy, motion/sound, return moment and distant-answer fallback. |
| Plate crack / recoverable contact | State transition, sound, exact HUD change and failure risk frame. |
| Pause / focus loss | Signature moment 5, pause transition, continuity and disclosure. |
| No record / insufficient / corroborating / strong results | Result HUD, plate grades, motion/sound and signature moment 6. |
| Second hit / timeout / boundary recovery | Feedback hierarchy, failure transition and signature moment 7. |
| Restart | Result/failure moments and continuity reset boundary. |
| Reduced motion / text scale / captions / colour redundancy | Camera/motion fallbacks, contrast triples, HUD rules and release-gate accessibility set. |
