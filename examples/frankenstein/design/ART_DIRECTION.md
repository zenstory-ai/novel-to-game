# ART_DIRECTION · *Frankenstein* — **The Hovel**

Inputs: `design/GAME_DESIGN.md`, `PRODUCT_BRIEF.md` (art style and platform locked at intake),
`concepts/CONCEPT.md`, `analysis/SOURCE_BIBLE.md`, `source/SOURCE.md` (licence boundary, binding).
Interface language is English and is locked by the brief; the Latin font floor applies, not the CJK one.
Every claim about the novel is cited by chapter, and where the line matters, by line number
(1831 revised edition, Project Gutenberg #84). **A visual element with no textual basis is marked
invented rather than given a decorative chapter number** — an earlier draft hung chapter 11 on a
staff De Lacey does not carry and on a pig the novel does not contain, and both are corrected in
§4.1 and §4.3.

This document does not re-argue the design. Where it takes a position that costs the build
something — cut systems, cut assets, a refused effect — the cost is stated in the same line.

**Two things are declared up front because the shipped examples in this repo got them wrong.**

1. **This slice ships sound.** Section 13 is a shipping specification, not a reservation for later.
   The 西游记 example shipped a full audio layer while its ART_DIRECTION said sound was not
   connected; that is a documented defect and it is not repeated here. If the build ships without
   the release-gated audio in §13, this document is wrong and must be corrected here rather than
   silently diverged from.
2. **The system count is held down on purpose.** One Canvas 2D renderer and a small generated set
   whose size is stated in **§16 and only there**. Everything else — the whole of night play, every
   figure at both scales, every cone, every piece of state, every transition — is drawn in code,
   and **that code, not the image bill, is this document's schedule risk** (§15.2). What was cut,
   and why, is in §16.4.

---

## 1. Visual position, in one paragraph

**A plate from an eighteenth-century book, and the player is looking through the hole in it.**
The whole game is printed: warm brown-black copperplate line on cream laid paper, forms built
from crosshatch and stipple, the night laid over the line as a cold indigo aquatint wash, and
one warm light in the world — theirs. Night play is a top-down engraved *plan* of the holding,
the convention a period surveyor or an architectural plate would have used, so the cottage,
the sty, the pool, the garden and the wood read as a drawing rather than as a game map. Twice
a night the plan is put away and the game becomes one framed interior: the ragged chink in the
boarded window (chapter 11), with the room behind it. Everything the player is allowed to know
is inside one of those two pictures. Nothing is on top of them.

The register is the creature's own: formal, exact, self-accusing, never ironic. The palette is
cold, and the only reason it ever gets warm is that someone else lit a fire.

---

## 2. Core visual principles

Five. Each is written so it can kill a proposal, and each is followed by what it kills.

### P1 — Everything the game knows is an object in the room or the yard.

The household's fuel is the height of the pile at the door. Their food is the number of plates
on the board. Your vocabulary is a row of scratches on a plank. Your own food is a heap on the
straw. Their fear is a taper left burning and a stick against a chair.

*Kills:* any bar, meter, percentage, counter, icon tray, minimap, objective list, floating
marker, or tooltip carrying state. Kills a "household condition" panel in any collapsed or
expanded form. The single exemption is the moon arc, which is the sky and is the game's declared
stake (`GAME_DESIGN` §11).

### P2 — The night is printed cold, and the only warm light in the world is theirs.

The night wash is indigo over ink. Amber exists in three places: through the chink, through a
lit window, and in the last frame. The creature is never lit. If warm light is falling on him,
he is inside someone's sight and the run is about to end.

*Kills:* a lantern, a torch, rim light on the player, a "stealth vision" tint, glow on
interactables, coloured ability effects, a moonlight bloom, lens flare, any light source the
1790s could not produce.

### P3 — We never see his face except in water.

Shelley describes him (chapter 5) and the game honours the description in exactly one image:
the transparent pool (chapter 12). Everywhere else he is a mass, a pair of hands, a shadow.
The verdict on his appearance is shown **on other people** — the cone whitening, the shriek,
the stick — and by his own shadow falling across the person who saw him.

*Kills:* a portrait on the title screen, a character bust, a face in the failure card, a
close-up at the door, concept-art hero shots, and — structurally — any route by which the 1931
make-up or a recent film's design could enter the project, because there is nowhere for a face
to go.

### P4 — The room changes and nothing announces the change.

One camera into the room, one composition, and state expressed as substitution inside it. A
higher fire, a fourth plate, Felix at the table instead of gone, his tools back on their nail.
Cross-fade, never cut, never highlight.

*Kills:* a "the household improved" toast, an arrow or ring pointing at what changed, a
before/after split, a chapter card summarising the week, and any camera move that would prevent
two nights' plates from dissolving into one another.

### P5 — Perception is drawn as hatching, and red is reserved.

A vision cone is a wedge of engraved hatch with a hard ink boundary. Its two bands differ by
hatch *direction and density*, not by hue. The palette contains no red at all until chapter 16's
fire; the last frame is the first red in the game.

*Kills:* red or orange cones, an alert colour ramp, a yellow "searching" state, any use of hue
as the sole carrier of danger, and the reflex of making the dangerous thing the brightest thing.

### The inverse list, stated plainly

No gothic-castle iconography, lightning, laboratory apparatus, skulls, ravens, cobwebs, green
skin, sutures, bolts, or flat crania. No fog volumes. No particle weather during play. No screen
shake, ever. No parallax. No blood. No modern sans-serif anywhere. No emoji, no glyph icons
standing in for words. No paper-doll damage states — there is no damage. No sword, axe, or tool
held as a weapon; Felix's tools are Felix's work.

---

## 3. Camera, composition, focus order, occlusion

### 3.1 Two fixed screens, no free camera

A night uses exactly **two fixed, non-scrolling screens**: *the holding* in plan at 1280×800
(hovel, yard, cottage in plan, sty, pool, well, milk-house, outhouse, woodpile, garden beds, path,
lane gate, near wood edge) for all night play, and *the chink* in elevation (§3.4) for the two
reads that bracket every night. Nothing scrolls, nothing follows, the camera never moves during a
night, and there is no second night plate: the whole holding is on screen at once, always.

This is a scope decision as much as a compositional one. A following camera at this scale would
require the player to trust off-screen cones, and being seen is terminal (chapter 16), so
off-screen threat is not acceptable. It also removes a scroll system, a culling system and a
minimap from the build. **This decision is kept unchanged**; the audits confirmed it, and it is
the cheapest true thing in the document.

The far wood was a third plate in an earlier draft and is **cut**. The portmanteau now lies at the
near wood's edge — `GAME_DESIGN` §6.5 puts it at (200, 215) with the forage — so there is no lane
transition, no plate swap, no second ground palette, and no second forage verb. The far forage was
strictly dominated anyway (5 minutes against 3) and appears zero times on the reference line.

Scale on the holding plate: the cottage footprint is ≈180 px wide (`GAME_DESIGN` §6.5 fixes it at
(550,300)–(730,410), which is exactly that), the creature ≈26 px tall in plan, a cottager ≈16 px.
**Every landmark position in this document is `GAME_DESIGN` §6.5's, not this document's.** If a
composition here and a coordinate there disagree, §6.5 wins and this document is the file that is
wrong. The whole holding fits with a 6% margin of paper on every side, and the margin is real
paper — the plate has a visible platemark, and the game is inside it.

### 3.2 Focus order on the holding plate

1. **The creature.** The darkest continuous mass on a plate whose ground is moonlit snow. He is
   the only object drawn in solid ink.
2. **Live cones.** The only hatched wedges. They exist only while their owner is awake
   (`GAME_DESIGN` §6.3), so an empty plate means an empty plate.
3. **Actionable objects.** Anything the player can take, put down, draw, clear or listen at is
   drawn as a **closed contour with a cast contact shadow**. Scenery is open outline with no
   shadow. This is the entire "can I interact" language: no prompts hover in the world, no
   outlines pulse. The distinction is texture and shadow, not colour, and it survives greyscale.
4. **The moon arc**, top-right margin.
5. **The plan itself** — walls in section, roof cut away, hatched to the period convention.

### 3.3 Occlusion tolerance: zero

Nothing occludes the creature or a cone by more than a line. The cottage roof is cut away.
Trees in the near wood are canopy *outlines*, not fills; the creature is fully visible through
them. The sty wall and the woodpile — the two objects the design expects the player to route
behind (`GAME_DESIGN` §6.5 names the woodpile at (480,430) as "the cover the skilled route uses")
— are drawn in section at knee height, so they break a cone without hiding the player from the
player.

Cover is therefore communicated by **where the cone stops**, not by where the player disappears.
This is the correct reading of the *Shadow Tactics* principle the brief borrowed: plan against
perception you can see.

### 3.4 The other camera

The chink view is a fixed elevation, and it is the only elevation in the game other than the
door scene. It never pans, never zooms during a night, and its composition is identical on every
night of every run (P4). One push is permitted, once, in the cold open.

---

## 4. Shape, scale, density, landmark grammar

### 4.1 Scale ladder

| Thing | Height, creature = 1.0 | Textual basis |
|---|---|---|
| The creature | 1.00 (eight feet) | chapter 4, line 1419: "about eight feet in height, and proportionably large" |
| Felix, Agatha, Safie | 0.62 | — |
| Old De Lacey (bowed, walking on Felix's or Agatha's arm) | 0.55 | chapter 11 line 3365, chapter 12 line 3549 |
| The cow | 0.70 | chapter 12 |
| The pig | 0.45 | **invented** — chapter 11 gives a *sty*, not an animal; see `GAME_DESIGN` §17 |
| A load of cut wood on the shoulder | 0.35 | chapter 11 |
| The hovel's interior height | 0.72 — he can sit upright in it only with difficulty | chapter 11 line 3277 |

The last row is load-bearing. The hovel is drawn so that the roof crosses the frame *below* the
top of his shoulders in every interior view. His size is never stated; it is the reason the
ceiling is where it is.

### 4.2 Silhouette rules

- **The creature:** one unbroken vertical mass, no gaps, black hair reading as an irregular
  dark crown wider than the shoulders (chapter 5, "lustrous black, and flowing"), a forward
  stoop, arms long enough to break the body's outline below the hip line. Carrying changes the
  silhouette: the load sits on the shoulder and squares the mass off (chapter 11, Felix carries
  it the same way — the player is imitating a man he watched).
- **Cottagers:** compact, with a triangular lower mass (skirt, coat) and a single held prop.
- Every figure is legible at 40% of its drawn size. Faces are never a distinguishing feature at
  any scale, in accordance with P3 and with the plan camera.

### 4.3 Signature props, and what happens to them

Per character, one object that identifies them at plan scale, and one change to it that carries
story without a line of text.

| Character | Prop | Its change, and what it tells the player |
|---|---|---|
| **Felix** | His tools | **Hanging on the cottage wall = his day is free** (Firing ≥ 2). Gone from the nail = he walked to the wood. This is the only read-out of the design's most important threshold, and it is a nail with or without tools on it (chapter 12) |
| **Agatha** | The pail | Carried full from the milk-house on her circuit; **absent from her hand at dawn if the water was drawn**, which is exactly the state in which her dawn circuit does not run (`GAME_DESIGN` §6.3) |
| **Old De Lacey** | The arm he walks on, and the guitar | **There is no staff in the novel** — the word does not occur in the text. He is the only figure who never walks alone: "the old man walked before the cottage in the sun for a few minutes, leaning on the arm of the youth" (chapter 11 line 3365), "The old man, leaning on his son, walked each day at noon" (chapter 12 line 3549). At plan scale he is a 0.55 mass **fused to a 0.62 mass**, the only two-figure silhouette on the plate, and he carries no cone. The one day nobody is on his arm is the day of the walk, and that is the way in. The guitar is indoors and is his alone. Nothing labels any of this |
| **Safie** | The black veil | Thrown up on arrival (chapter 13) and never worn again; thereafter she is the only figure with a solid black head-mass |
| **The creature** | The plank | The loose plank of his own wall (chapter 11): removed to go out, replaced to come home. It is the game's first and last verb |

### 4.4 Density

Detail is spent where a decision is made and nowhere else. The open ground south and west of the
cottage — roughly (380,380) to (700,470), the stretch the carry route crosses between the outhouse
and the door — is the emptiest region on the plate, because it is where the player is exposed and
where a cone must be read against nothing. The wood edge, the sty and the woodpile are dense,
because they are where routes are chosen. There is no
decorative filler: if a thing is drawn on the holding plate, it is either a landmark, an
obstacle, an actionable object, or a person.

Ground is distinguished by hatch, not tint. **Three hatch types, and no fourth** — an earlier
draft had six, which is six hatch generators, six masks and six seasonal transitions for a plate
that only ever needs to answer *is this snow, did I clear it, has it thawed*:

| Surface | Rendering | Reads as |
|---|---|---|
| Snow | Blank paper, chain lines showing | Untouched, bright, and the reason moonlight matters |
| Cleared path (the door apron to the lane gate, and to the milk-house) | Fine stipple | Work you did, still there in the morning |
| Thawed earth (from night 5) | Broken horizontal line; **with the furrow flag set**, the broken lines become ruled parallel furrows | The season turning (chapter 12, chapter 13); furrows mean Felix had a free thaw day and turned the beds |

**The furrow flag is a flag, not a fourth hatch.** It is set per garden-bed rect from the count of
thaw days on which Felix was free (`GAME_DESIGN` §6.2 — Garden is not a state field), and it costs
one boolean and a line-spacing change in the same generator. Thawed earth is also **the only
surface that records a footprint**, which is where the forearm-length print in the failure card
lands (`GAME_DESIGN` §12).

The cottage interior in plan is not a ground type: it is flat plate tone with the walls in section
and a ruled hearth square, drawn once and never varied.

Snow does **not** record footprints, because the design contains no tracking system and the art
must not sell one. This is listed as a live risk in §17.

### 4.5 Landmarks, legible at thumbnail

Positions are `GAME_DESIGN` §6.5's; the job here is that each is identifiable as a 20 px thumbnail.
The cottage at (550,300)–(730,410), the only ruled rectilinear plan. The hovel at (630,265), a
lean-to trapezoid against its back wall, opening north. The sty at (520,240), a small curved-walled
square. The pool at (640,195), the only pure unhatched white ellipse on the plate. The woodpile at
(480,430), mid-yard and the one piece of cover in open ground. The well at (470,300). The
milk-house at (710,252). The outhouse at (310,485). The garden beds at (850,480), the only
furrowable surface. The near wood edge at (200,215), a broken canopy outline, and the portmanteau
lies in it. The lane gate at (640,545), south of the door apron — **a landmark, not an exit**: the
lane is where the landlord stands at the end, and walking to it does nothing during a night.

---

## 5. The creature

### 5.1 What he is made of, in the one image where it is visible

The pool (chapter 12). Drawn from Shelley and nothing else (chapter 5): yellow skin that
scarcely covers the work of the muscles and arteries beneath, so the plate renders him as
**translucency over anatomy** — the aquatint laid thin, with the engraved line of vessel and
muscle showing *through* the wash rather than beside it. Lustrous black hair, flowing. Teeth of
a pearly whiteness. Watery eyes nearly the same colour as the dun-white sockets they sit in.
Straight black lips. Shrivelled complexion. Eight feet.

The composition is the recoil, not the portrait: the water holds the face, the frame holds his
shoulder and the back of his head in the near foreground, and the reflection is the only part in
focus. He starts back (chapter 12) and the water takes the face away in rings. The image exists
for roughly 2.5 seconds and then the pool is water again, for the rest of the run.

**It is ambient, and it is degradable.** The pool carries no narrative echo — `GAME_DESIGN` §15 cut
that echo, and this document has moved `plate/pool` off the release gate to §16.2 with a named
degrade: the recoil and the rings in Canvas, his shoulder and the back of his head in silhouette,
no face. A player may never stand there, and the build must not be blocked on an image for a moment
that may not happen.

**The forbidden set, restated because this is the image where it would enter.** No flat cranium.
No neck electrodes or bolts. No green or grey-green skin. No visible stitching, staples or
seams. No lab coat, no shackles, no scars laid out as a diagram. The 1931 Universal make-up is a
separately copyrighted design (`source/SOURCE.md`) and is out; recent screen adaptations,
including the 2025 film, are out as reference at any strength. Period anatomical engraving —
écorché plates, Cheselden, Albinus and their contemporaries — is public-domain research material
and is the correct place to look for how a translucent skin over working muscle was drawn by
people who drew it from life.

### 5.2 Everywhere else

Plan view: a dark mass (§4.2). At the door: his hands, the doorway's light on the floor in front
of him, and — in the one beat that matters — his open hand, raised and then lowered (chapter 15),
seen from behind and below so that Felix's face carries the scene and the creature's does not.
Being seen: his own shadow, cast by their light, falling across the person who saw him.

---

## 6. Material, light and colour, all of it functional

### 6.1 Palette

| Role | Hex | Where it is allowed |
|---|---|---|
| Laid paper | `#e9e0cb` | The ground of every plate; the margin; all interface backings |
| Plate tone | `#d6c9ae` | Platemark, card backings, the paper's own shadow |
| Engraving ink | `#2a2119` | Every primary line; all body text |
| Secondary line | `#5a4c3c` | Scenery outline, unknown speech, disabled affordances |
| Night wash, deep | `#161e2e` | The night over the whole plate, and the hovel's interior |
| Night wash, mid | `#2c3a52` | Sky band before dawn; the yard's aquatint |
| Moonlit snow | `#c6cfdb` | Snow, the moon arc, the pool |
| Cone wash | `#93a8c6` | Vision cones only. Nothing else in the game uses this value |
| Hearth amber | `#d8913f` | The chink, a lit window, firelight on a floor |
| Taper flame | `#f0cd82` | The taper, and only the taper |
| Reserved red | `#a83218` | **The final frame only.** Its first appearance in the game is the fire (chapter 16) |

### 6.2 Function, and its non-colour redundancy

Colour-blind readability is not a mode; it is the default, because every functional colour below
carries a shape, texture, count or position that reads without it.

| Function | Colour / material | Non-colour redundancy |
|---|---|---|
| A cottager is awake and sighted | Cone wash `#93a8c6`, outer band 18%, inner band 30% | A hard 1.5 px ink boundary; **outer band single-direction hatch, inner band cross-hatch**; the wedge shape itself |
| You have been seen | The wedge flips to flat paper `#e9e0cb`, hatch removed | The hatch *vanishing* is the signal; plus the creature's shadow across the person; plus a 2 s frame hold in which nothing else moves |
| An outer-band clip (recoverable) | No colour change | The hatch briefly doubles in density and the cottager's step falters and half-turns |
| This object can be acted on | No colour | Closed contour + cast contact shadow (§3.2) |
| Their fuel (Firing) | — | Courses of engraved log-ends at the door: 0, 1, 2, 3, 4 — **one course per point of Firing, and it is a dawn read** (§7.3). At dusk the pile is nearly flat and the read that carries the trend is the tools on the nail |
| Their food (Store) | — | Plates on the board: **≥5 → four, 3–4 → three, ≤2 → two**. The board carries Store and nothing else; Safie is on the figure layer, and a take is a one-dawn override of one fewer plate (`GAME_DESIGN` §7) |
| Their fear (unease) | Taper flame `#f0cd82` | The taper is an object on the sill; the stick is an object against the chair; Felix's chair is moved to the window |
| Felix's day is free | — | Tools on the nail, or not (§4.3) |
| Your vocabulary | — | Scratches on the plank, grouped in fives, five groups to a row |
| Your own food | — | The height of the heap on the straw |
| Time left tonight | Moonlit snow `#c6cfdb` | The arc's remaining length is a physical length; at L−2 the remaining segment switches to stipple **and** the sky band begins to lighten |
| The garden is theirs again | — | Turned beds: the thawed-earth hatch becomes ruled furrows, visible from the yard. Drawn from the count of thaw days on which Felix was free — there is no Garden field (`GAME_DESIGN` §6.2) |

Nothing in this table is a hue-only signal. A greyscale screenshot of any frame in this game
still answers: who is awake, where their sight reaches, how much night is left, how the
household is doing.

### 6.3 Light

Three light situations, and no others.

- **Moon on snow.** The night wash sits over the whole plate; the snow is left as paper. Contrast
  is high and flat. There is no falloff and no shadow except the short contact shadows on
  actionable objects. This is the light the design already made a rule (chapter 12: he works
  when there is "any moon or the night was star-light").
- **Their light.** Amber, always leaking from a fixed opening — the chink, a window, the door
  standing open at dawn. It is drawn as a hard-edged wedge on the ground, because a boarded window
  makes hard edges, and because a wedge of their light on the ground rhymes with a cone.

  **Light is not sight, and the wedge is not a cone.** This is stated flatly because the rhyme
  invites the opposite reading, and because `GAME_DESIGN` §6.3 fixes the rule: cones belong to
  waking people only, so an empty plate means an empty plate. A light wedge has no owner. Standing
  in one is not a sighting, does not raise unease, and ends nothing. The two are told apart by the
  thing that separates every signal in this game — **material, not hue**: a cone is hatched, with a
  1.5 px ink boundary and two bands; a light wedge is flat amber wash with a soft edge and no
  hatch at all. An earlier draft gave the all-night taper its own static cone. It is cut, in both
  documents. The wedge is a mood object and it is degradable to nothing.
- **First light.** Not a colour shift — a *drain*. The night wash loses opacity from the top edge
  down over the last two night-minutes until the plate is nearly bare paper. Dawn is the picture
  becoming legible, which is the exact thing he is afraid of.

### 6.4 Material

Paper is the substrate of the entire game and is never hidden: chain lines every 24 px, laid
lines at 1 px, a slight cockle at the plate edge. It is baked once into an offscreen canvas and
composited a single time per frame (§17 covers the performance risk). Ink has a very slight
bleed at line ends. The aquatint wash is grainy, not smooth — a stipple mask, not a gradient.

---

## 7. The chink, and the room across the eight nights

This section is the art answer to the concept stage's **Risk 3**: if invisible labour has no
legible effect in the room, the loop degrades into fetch quests with cones. The room must carry
it, with no meter anywhere.

### 7.1 The frame

The signature frame of this game is **the inside of the hovel**, not the room. Composition:

- The lower two-thirds are near-black `#161e2e`: straw, the plank wall, the roof crossing the
  frame low (§4.1).
- Left of centre, a **ragged aperture** — the chink in the boarded window (chapter 11) — occupying
  about 34% of the frame's width and 40% of its height, warm, and inside it the whitewashed room.
- Lower right, a narrow cold slot where the loose plank sits, through which a strip of the yard is
  visible: the corner of the cottage and **the pile of cut wood at the door**.
- On the straw in the near foreground: the heap of his own gathered food, and the plank with the
  scratches on it.

One frame therefore contains: who he is (the ceiling is too low for him), what he is doing
(watching a room he may not enter), what he has done (the pile, outside, in the cold), and
everything the design refuses to put in a HUD. **The hovel interior is the read-out screen.**
It is entered twice a night — at dusk to decide, at dawn to see what it bought. **The two reads
carry different things and neither is a summary of the other**: at dusk, the tools on the nail and
Felix's stool, and a fire and a pile that say nothing; at dawn, the fire, the pile, the board and
Felix again, all of them moved by the night just played. §7.3 derives both.

### 7.2 One room plate, and every figure in Canvas

**Scope cut, taken deliberately.** An earlier draft specified five generated room plates keyed to
occupancy (the three / Felix at home / Safie with Felix out / Safie with Felix home / hardened).
That is five images that must agree with each other to the pixel across a cross-fade, from a
generator that cannot be asked to hold a figure still, and it is a fixed menu of five occupancies
in a design whose occupancy is combinatorial. **This document's own R3 fallback is now the plan:**

> **One generated image: `room/empty`.** The whitewashed room, seen through the ragged aperture.
> A hearth with no fire in it, a board with nothing on it, the boarded window from inside, a
> plain table and a stool, a bare nail-and-plaster wall. **No people, no fire, no plates, no
> objects that carry state.** It is the stage and nothing else.

Every figure and every stateful object is drawn in Canvas 2D on top of it, at the same engraved
line weight as the plan. Four consequences, all of them good and one of them a real cost:

- Occupancy becomes **combinatorial for free**. Four figures with three attitudes each is one
  draw list, not eighty-one images.
- The pixel-registration risk is **deleted**, not mitigated. Nothing has to line up with anything
  because there is only one plate under everything.
- §15.3 already required Canvas contact shadows and the amber integration layer for any separately
  generated element, so the compositing cost was already budgeted.
- **The cost:** every cottager needs a Canvas figure at elevation scale — a seated 0.62 mass with
  a held prop, readable at 3 attitudes — and those figures are now the hardest drawing in the game
  after the creature. That is the trade: image risk exchanged for code risk, knowingly.

**The figure layer.** Same camera, same framing, same figure positions, cross-faded between states
(P4). Position is fixed per character; only attitude and presence vary.

| Figure | Position in frame | Attitudes | Selected by |
|---|---|---|---|
| **De Lacey** | Chair by the hearth, always present | head on his hands in a disconsolate attitude (chapter 11) / guitar across his knee / **head lifted and turned toward the door** | the third only at unease ≥ 2 |
| **Agatha** | At his feet, or at the board, always present | sewing at his feet (chapter 11) / at the board / at the fire with Safie | Safie's presence |
| **Felix** | Table, stage left | **absent — his stool empty** / at the table with the book open, reading to the old man and Agatha (chapter 12) / **chair pulled to the window, his back to the fire** | absent if he walked to the wood that day; at the window **at unease 3 only**, which overrides the other two and latches (`GAME_DESIGN` §6.2) |
| **Safie** | At the board, or at the fire | absent / seated at the board / at the fire | present from night 4 (chapter 13). **This is where Safie is carried — never on the plate count** |

**The stateful objects**, all Canvas, all on the same layer:

| Object | States | Reads |
|---|---|---|
| **The fire** | **small** (Firing ≤ 1) / **built high** (Firing ≥ 2). An engraved flame cluster whose *size* is a real size, not a brightness | Firing is what is *banked*, so a household at 0 still has a fire — they burned what came in today. That is exactly chapter 11's "a small fire" (line 3330) with nothing put by, which is the night-1 state, and it is why the low state is small rather than dead. **The fire is a dawn read** — see below |
| **The board** | 2 / 3 / 4 plates | **Store alone**: ≥5 → four, 3–4 → three, ≤2 → two and the two-plate scene. A take is a one-dawn override of one fewer plate. Nothing else touches the board (`GAME_DESIGN` §7) |
| **A bundle of firing inside the door** | present / absent | Firing ≥ 2 |
| **The taper on the sill** | lit / unlit | Unease ≥ 2. It is a taper, not a light source with a cone (§6.3) |
| **The stick against the chair** | present / absent | Unease 3 |
| **The first white flower on the board** | present / absent | The thaw (chapter 12) — degradable, §16.2 |

Plus one amber light-integration layer whose intensity and reach are re-derived from the fire's
size, so that no figure sits in the room under lighting the room does not have. With one plate and
everything else in code this is a single composite pass, not a per-element correction.

**The dawn-fire question, settled.** An earlier draft fixed the fire at embers at every dawn
whatever the Firing, while the signature moment M4 showed it built high at dawn, and §13.2 makes
the hearth's level the second, non-visual channel for Firing. Both cannot ship. **The dawn fire
scales with Firing and the dusk fire does not**, for a reason that is arithmetic rather than
taste:

- At **dusk**, Firing on the reference line is 0, 1, 1, 1, 1, 1, 1 — the day's burn cancels the
  night's carry, so the dusk fire is small on six nights out of seven no matter how well the
  player plays. A signal that flat is not a signal. **What discriminates at dusk is the tools on
  the nail and whether Felix is at the table.**
- At **dawn**, Firing is 0, 1, 2, 2, 2, 1, 2, 1 — it moves, and it moves *because of what the
  player did last night*. Banked fuel means a fire built high in the morning; an empty pile means
  the same small fire they have had all winter. So the
  dawn fire is the room's loudest delta, at exactly the read §7.1 calls "seeing what it bought",
  where M4 is staged, where §13.2 puts the hearth channel, and where `GAME_DESIGN` §14 asks the
  player to describe the room. All four now agree.

**Felix's tools are not in this list.** They hang on a nail beside the cottage door, *outside*,
where the player passes them every night (§4.3), and they say the same thing his stool says. He
takes them down at dawn on a wood day and hangs them back at the next dawn, so the nail and the
stool agree at both reads and each read is about a different day: **at dusk they report the day
that just ended; at dawn, after the door opens, he either takes the tools and goes or comes back
in and sits to the book, which reports the day the player's carry has just bought.** The Firing
threshold is therefore readable from the yard before the player commits the night's spend, and it
is readable again the next morning as its consequence.

### 7.3 What changes, read by read — **derived, not authored**

> **This section is generated from `GAME_DESIGN` §7 and must be regenerated, not patched, if §7
> changes.** Its only inputs are the reference line's two traces and the three mappings below.
> Nothing in the tables was decided here. An earlier draft wrote these columns by hand and three
> rows contradicted the line they claimed to illustrate.

**Inputs, copied from `GAME_DESIGN` §7:**

| | dawn 1 | dawn 2 | dawn 3 | dawn 4 | dawn 5 | dawn 6 | dawn 7 | dawn 8 |
|---|---|---|---|---|---|---|---|---|
| **Firing** | 0 | 1 | 2 | 2 | 2 | 1 | 2 | 1 |
| **Store** | 6 | 5 | 4 | 3 | 2 | 3 | 3 | 4 |
| Felix's day | wood | wood | free | free | free | wood | free | *the walk* |

Carries on nights 1, 2, 3, 4 and 6. No takes, so no board override. Unease 0 throughout.

**Mappings, and there are only three:** fire and pile from Firing (**small at ≤1, built high at
≥2**; one engraved course of log-ends per point, 0 to 4); board from Store (≥5 → four, 3–4 → three,
≤2 → two and the scene); tools from whether Felix walked that day.

**Derived once, here:** Firing at dusk of night N = Firing(dawn N) + 1 if Felix walked on day N,
minus the day's burn = **0, 1, 1, 1, 1, 1, 1**. That flatness is the whole reason the two reads
carry different things.

**The dusk read — the deciding read.** The fire column is deliberately dull; it is printed so the
build cannot mistake it for a signal.

| Dusk of night | Fire (Firing at dusk) | Tools on the nail | Felix | Safie | Board | Pile at the door, through the plank slot | Also visible |
|---|---|---|---|---|---|---|---|
| 1 | small (0) | bare | stool empty | — | 4 | none | The load Felix left by the outhouse. **This is the cold open's room** (chapter 11, M2) |
| 2 | small (1) | bare | stool empty | — | 4 | 1 course | — |
| 3 | small (1) | **on the nail** | **at the table, reading aloud** (chapter 12) | — | 3 | 1 course | Listening is doubled tonight because he is reading |
| 4 | small (1) | on the nail | at the table | **arrives, veil thrown up** (chapter 13) | 3 | 1 course | Safie on horseback, with a guide |
| 5 | small (1) | on the nail | at the table | at the board | **2** | 1 course | The thaw: snow gone from the path. **The beds turned, visible from the yard.** The first white flower on the board |
| 6 | small (1) | bare | stool empty | at the fire | 3 | 1 course | — |
| 7 | small (1) | on the nail | at the table | at the board | 3 | 1 course | The walk is planned in the room, legible at Words ≥ 44 |

**The dawn read — what it bought.** The door opens first and Felix's wide cone crosses the yard
(`GAME_DESIGN` §6.3); then he either takes the tools from the nail and goes to the wood, or comes
back in and sits to the book. Four things move here, and all four are consequences of the night
just played — which is why `GAME_DESIGN` §14's playtest names exactly these: **the fire, the
plates, Felix indoors, the pile.**

| Dawn | Closes night | Fire (Firing at dawn) | Board | Pile at the door | Felix, once the door has opened | Also visible |
|---|---|---|---|---|---|---|
| 2 | 1 | small (1) | 4 | 1 course | takes the tools, goes to the wood | **Agatha opens the door and stops with her hand still on the latch** |
| 3 | 2 | **built high** (2) | 3 | 2 courses | **comes back in, to the book** | A bundle of firing inside the door. The board drops to three on the dawn the hearth first goes high — the first time the two reads point opposite ways |
| 4 | 3 | built high (2) | 3 | 2 courses | comes back in | — |
| 5 | 4 | built high (2) | **2 — the two-plate scene: the two younger cottagers set food before the old man and keep none for themselves** (chapter 12, lines 3440–3441: "several times they placed food before the old man when they reserved none for themselves" — habitual and plural in the novel; staging it as one visible act on one dawn is this design's compression) | 2 courses | comes back in | Safie in the room. **This is the dawn `GAME_DESIGN` §14 asks the player to describe** |
| 6 | 5 | **small again** (1) | 3 | 1 course | takes the tools, goes | The bundle inside the door is gone |
| 7 | 6 | built high (2) | 3 | 2 courses | comes back in | — |
| 8 | 7 | small (1) | 3 | 1 course | goes out with the other two — this is the walk | The last room read of the run |

In the errand band the household never recovers, so night 8 is played and every dawn from 5 onward
shows two plates and a small hearth that is never once built high. There is no separate art for it;
it is the same two tables with worse numbers, which is the point.

Two things about this progression are worth saying out loud, because they are the reason the room
can carry the design without a meter.

**The best night looks worst.** On the reference line the two-plate scene lands at dawn 5 — the
dawn the fire is built high and the pile at the door is two courses deep. The player is looking at
the most provided room of the run and at two plates for four people at the same time. That is the
design's own arithmetic (Store is 2 at dawn 5 on every line, `GAME_DESIGN` §7), and the art's job
is to let both facts sit in one frame instead of resolving them.

**And the fire tells on you.** At dawn 6 the fire is small again, because the load on night 5 was
never carried and Firing fell back to 1. Nothing says so. The player who is reading the room
notices that the fire went down two mornings before the walk, and the player who is not does not.
This is the whole method of §7 in one overlay.

**What the pile cannot do, stated so the build does not oversell it.** The pile is Firing exactly,
and at dusk Firing is 1 on six nights out of seven. The pile therefore **does not discriminate at
the moment the player is deciding** — it discriminates at dawn, where it moves 1, 2, 2, 2, 1, 2, 1.
Any build, screenshot or brief that presents the dusk pile as the read on the household's trend is
wrong. **The dusk read's whole discriminating power is the nail and Felix's stool.** The dusk board
does fall — 4, 4, 3, 3, 2 — but it falls that way on every line until dawn 6, so at dusk it reports
the season and not the player. The fire and the pile report the player, and they only move at dawn.

**The failing line must look failed.** A run that never carries sits at Firing 0 for the whole
slice: **a small fire at every single read, dusk and dawn, never once built high**, a bare nail at
every dusk, Felix's stool empty every night, no bundle inside the door ever, and a board that falls
4, 4, 3, 3, 2 and then stays at two because no thaw day is ever free. Night 7 is night 1 plus Safie
and two fewer plates. Pillar 2's veto
condition ("the room on night 7 looks like the room on night 1") is *nearly* true for the player
who did nothing — and the part that is not true is the household getting worse, which is the
correct thing for that player to be shown. If it is ever true for a player who carried, the art has
failed, and the fix is to widen the deltas — a fourth plate, a taller fire, Felix at the table —
never to add a read-out (`GAME_DESIGN` §14).

**The unease line.** It overrides the figure layer regardless of how well provided the household
is, and it has the design's own two rungs, not one (`GAME_DESIGN` §6.2). At **unease 2**: the taper
lit on the sill and De Lacey's head lifted and turned toward the door. At **unease 3**, additionally
and permanently: Felix's chair pulled to the window with his back to the fire, and the stick against
the chair. A player who fed them well and frightened them badly sees a warm room with a man sitting
up in it, which is the correct picture of what they did.

### 7.4 The one thing the chink never does

It never shows the family reacting to the player. Agatha stops in a doorway and looks at wood
(chapter 12); nobody looks toward the boarded window, at any point, on any night, until the
run ends. There is no acknowledgement to draw, because there is none in the book.

---

## 8. Interface

### 8.1 What exists

Four elements. That is the complete list.

1. **The moon arc** — top-right margin, `x 78%–97%, y 3%–14%`. A silver arc with a travelling
   engraved disc. Permanent from the first step outside the hovel; declared as the game's stake
   and exempt from the overload rule (`GAME_DESIGN` §11).
2. **The prompt band** — `y 88%–96%`, full width, centred. One short diegetic line at a time, on
   a paper strip. Empty most of the time.
3. **Cards** — failure, ending, and the after-run screen. These replace the world; they do not
   overlay it.
4. **The door plate** — the subtitle plate during the one conversation, `y 74%–94%`.

There are no panels, so there is no collapse rule; §11 of `GAME_DESIGN` already records that no
panel exists. First-screen visual focus is unambiguous at every moment: frame 1 is the chink and
nothing else; during a night it is the creature; at the door it is De Lacey's head.

### 8.2 Reserved zones and z-order

| Zone | Rectangle | Notes |
|---|---|---|
| Moon arc | `x 78%–97%, y 3%–14%` | Permanent. Nothing else ever enters it |
| Prompt band | `x 0%–100%, y 88%–96%` | Transient. Never overlaps the moon arc |
| Minted-word lane (hovel view only) | `x 52%–64%, y 26%–70%` | Rises along the aperture's right edge; never crosses a figure inside the aperture |
| Door subtitle plate | `x 12%–88%, y 74%–94%` | Paper backing at 92% |
| Card | `x 22%–78%, y 30%–70%` | Intentional overlay: **yes** — the world is gone behind it |

z-order: world < their light < cones < contact shadows < the creature < prompt band < door plate
< cards < viewport-fallback notice.

### 8.3 Depth that is not sold

The build must not add, because the mechanic does not exist:

- **No noise rings, no sound indicator, no "heard you" state.** There is no hearing system.
- **No detection meter, no alert bar, no last-known-position marker.** A sighting is terminal and
  is not on a scale (`GAME_DESIGN` §2).
- **No crouch/stand indicator, no stance icon.** There is no stance.
- **No route preview line, no path ghost, no plan mode.** No pause, no slow motion.
- **No minimap.** The plate is the map.
- **No inventory.** He carries one thing at a time and you can see what it is.
- **No affection, trust, suspicion or reputation display**, because no such field exists
  (`GAME_DESIGN` §6.2) and drawing one would be a defect against the design as well as this
  document.

### 8.4 Buttons

Only the title, the options plate and the after-run screen contain buttons. They are verbs with a
stance (`GAME_DESIGN` §16): **Begin the winter** · **Sound and text** · **The book this came
from** · **Go back to the first night**. No *OK*, no *Cancel*, no *Continue*, no *Play*. Buttons
are letterpress: ink on paper, a 2 px downward impression on press, and a very slight ink spread
on the pressed state. Keyboard focus is a 1.5 px ink rule under the word, never a coloured
outline.

### 8.5 Options, and accessibility that costs nothing

Reachable from the title and the after-run screen only — there is no pause, by design. Three
controls, persisted:

- **Text size:** 100% / 125% / 150%.
- **Ink weight:** normal / heavy. Heavy adds 1 px to every functional boundary (cone edges,
  actionable contours) and lifts cone fill by 8%. It changes no state and reveals no information.
- **Sound:** master, and a separate toggle for the speech murmur (§13.4).

Plus `prefers-reduced-motion`, honoured automatically and overridable here (§10.5).

### 8.6 Viewport fallback

Target 1280×800, minimum 1280×720 (brief row 1). Below that, or in portrait, the game does not
reflow: it prints a paper card in the centre — *This plate wants a wider window* — with the
required size stated beneath it. No mobile layout is designed, claimed or half-built.

---

## 9. Typography and language

Interface language is English, LTR, Western market; no localisation in this slice, and no string
is written assuming one (`GAME_DESIGN` §16). **The Latin font floor applies** (functional labels
≥ 11 px, body ≥ 13 px), not the CJK floor.

**Faces.** Libre Caslon Text (SIL OFL 1.1) for body, dialogue and prompts; Libre Caslon Display
(SIL OFL 1.1) for the title and cards. Caslon is the period's own English text face and needs no
argument beyond that. Self-hosted woff2, subset to Latin-1, ~40 KB each; fallback stack
`Georgia, 'Times New Roman', serif`. No other family ships. **No sans-serif appears anywhere in
this game**, including in debug overlays that might reach a screenshot.

**Sizes at 1280×800, before the text-size multiplier.**

| Class | Size | Floor it must never cross |
|---|---|---|
| Prompt band | 15 px | 11 px |
| Overheard speech / door subtitles | 18 px | 13 px |
| Card body (failure, ending) | 22 px | 13 px |
| Card first line, title plate | 30 px | — |
| Menu verbs | 19 px | 11 px |

**Setting.** Single column, left-aligned, ragged right — never justified, because justified text
at this measure opens rivers and this game's paper already has texture in it. Measure ≤ 62
characters. Leading 1.5. Small caps for the two card headers that exist, never for body. Old-style
figures are available in the face and are never used, because no number appears on screen at any
point (`GAME_DESIGN` §16).

**Reading order.** Every text surface is one block in one place. There is no scanning task in this
game and no screen on which the eye must choose between two text regions.

**Cultural boundary.** The setting is a French exile household in Germany — "They found a miserable
asylum in the cottage in Germany" (chapter 14, line 3934). **No date appears anywhere in the
novel**; the late-eighteenth-century dress, tools and printing this document draws from are the
design's dating, not the book's, and an earlier draft cited a chapter for it. Period vocabulary
from the text is kept and explained by consequence, never glossed:
*the hovel*, *the cottage*, *the chink*, *firing*, *the milk-house*, *the sty*, *the outhouse*,
*the three books*, *the journal of the four months*. Forbidden as visual or verbal shorthand:
Victorian gothic (this is sixty years early), Halloween iconography, mad-science signage, Latin
mottoes, alchemical sigils, anything that would make the plate look like a horror poster instead
of a book plate. The creature is never named and is never called Frankenstein; *Frankenstein*
appears on screen exactly once, on the title plate, as the book's title.

---

## 10. Motion and transition specification

Per core verb from `GAME_DESIGN` §5 and §12: what a press looks like, how results are graded,
where transient text goes, and which transition fires.

### 10.1 The verbs

| Verb | Press / confirm | Result grading | Transient text | State transition |
|---|---|---|---|---|
| **Move** | The mass leans before it travels: 90 ms of lean, then motion. Release plants the near foot | Snow (broad, slow), cleared path (quicker), thawed earth (heavier), straw (silent) — grading is in footfall cadence and sound, not speed | none | none |
| **Take a load** | The silhouette squares off over 160 ms as the load goes on the shoulder; walk cadence drops ~15% | Full load only. There is no partial carry | none | none |
| **Put it down at the door** | Two-frame set-down, 220 ms | **The pile grows by one visible course.** The course lands with weight — 3 px settle over 120 ms. The *real* grade arrives a whole day later, as tools on the nail | none | none |
| **Drop a load (abandoned)** | Immediate release, no animation flourish | The load lies where it fell and is drawn there until dawn, then it is gone and unease has risen | none | none |
| **Forage** | Hands into the frame at the wood edge, 400 ms, three repetitions | The heap on the straw grows visibly at the next hovel view | none | none — the near wood edge is on the holding plate, and there is no second plate to swap to (§3.1) |
| **Take from their store** | The same hand animation, 400 ms, at the cottage's store | The consequence is one fewer plate tomorrow. Nothing acknowledges it now | none | none |
| **Draw water / clear the path** | A held action: the creature is stationary and the moon arc visibly advances during it | The path's hatch changes from blank paper to stipple, permanently for that night | none | none |
| **Listen at the chink** | The aperture grows from 34% to 46% of frame width over 240 ms; the murmur opens up | **A word is minted**: one scratch is added to the plank *as it is heard*, not after | **T-b**, §10.3 | Hovel view |
| **Attend the lesson** | As listening, plus the amber lifts 20% | Words arrive in a run, one scratch at a time, paced to Safie's repetitions | **T-b** | Hovel view |
| **Knock** | Three raps. The frame does not move. 1.4 s of nothing | *"Who is there? Come in."* (chapter 15) | **T-e** | The one cut in the game, plan → elevation |
| **Withhold (hold the context action beside Felix)** | The hand opens, rises, holds for 700 ms, and lowers (chapter 15) | Not a failure, not a reward, not a button greyed out. The refusal is performed | none | none |
| **Hold position (the last input)** | Nothing moves except the moon arc | The arc completes. Then the fire | none | To the final frame |

### 10.2 Danger, graded in three

The danger verb is the one that needs a ladder, and it has exactly three rungs:

1. **Near miss** — inside the cone's reach but not its bands. The hatch densifies for 200 ms and
   relaxes. No state change, no sound sting, no text. The player learns the shape of the wedge.
2. **Outer-band clip** — unease +1. The cottager's step falters, they half-turn, the cone sweeps
   back across its own path once, and a single dry sound (a foot stopping) plays. Recoverable,
   and it costs a night, not the run.
3. **Inner band — seen.** Terminal. §14, M8.

### 10.3 Transient text: the required triplets

Every class of transient text, with core colour, stroke or backing, and the frame it must be
verified against.

| Class | Core | Stroke / backing | Verification frame |
|---|---|---|---|
| **T-a · Action prompt** | `#2a2119` | Paper strip `#e9e0cb` at 88%, 1 px ink rule top and bottom | **M3 beat 4** — the creature carrying a load past a live cone that crosses the woodpile's hatching on moonlit snow. Busiest mid-tone cool frame in the game |
| **T-b · A minted word** | `#e9e0cb` | **Both**: 2 px `#2a2119` stroke *and* a soft `#161e2e` backing ellipse at 40%. It is the only text that crosses the brightest region of the busiest frame, so it takes both | **M5 beat 3** — the chink at full amber with the room at its fullest. Busiest mid-tone warm frame in the game |
| **T-c · Overheard speech** | `#2a2119` | Paper strip at 90%, 1 px ink rule | **M5 beat 5** |
| **T-d · Card** | `#2a2119` | Full paper plate; the world is replaced, not overlaid | **M8 beat 5** |
| **T-e · Door exchange** | `#2a2119` | Paper plate at 92%, `y 74%–94%` | **M7 beat 6** — firelight behind De Lacey, daylight through the open door behind the player. Highest-key frame in the game |

**Overheard speech and the vocabulary rule.** Speech the family utters is rendered subject to what
the player has banked: known words print normally; unknown words print as an engraved wavy rule
of the same length in `#5a4c3c`. This is a rendering rule applied to strings the design already
has — it adds no system and no state. The creature's own narration on cards is always legible,
because that is him telling it afterwards (chapter 11 onward, the whole inner frame). If playtest
finds the wavy rule reads as a font failure rather than as incomprehension, §17 records the
degrade.

Transient text travels in its reserved lane (§8.2) and never crosses a face or a cone's apex.

### 10.4 Transitions

| From → to | Transition | Duration | Restraint |
|---|---|---|---|
| Hovel (dusk) → yard | The plank is lifted out of the near foreground; the cold slot widens into the plan | 700 ms | The player's own hands do it. No fade |
| Yard → hovel (dawn, forced) | The night wash drains from the top edge; at bare paper the frame irises to the chink | 1600 ms | Nothing else moves. Movement is disabled at the start of it, not at the end |
| Night → night | **Plate turn**: the whole screen is a printed plate; it lifts at one corner and the next settles | 480 ms | Once per night. Never used for anything smaller. **Degradable to a 200 ms cross-fade** |
| Plan → the door (day 8) | The only hard cut in the game | 0 ms | It is a cut because he has stopped hiding |
| Anything → seen | Everything freezes except the cone whitening | 2000 ms hold | §14, M8 |
| Anything → card | The world is replaced by paper and the type presses in with a 90 ms ink spread | 340 ms | No motion behind the card. There is nothing behind the card |

### 10.5 Reduced motion

Under `prefers-reduced-motion`, or when the player sets it: plate turns become 120 ms
cross-dissolves; the aperture does not grow on listen (it changes size instantly); the minted word
appears at the plank without travelling; the dawn drain runs at the same duration but as a single
step at −50% and then to zero; the ink spread on cards is skipped; the lean-before-move is
removed.

**Preserved in every case, because they carry information and are not decoration:** the 2-second
seen-hold, the cone hatch change on a near miss and a clip, the pile settling by a course, the
moon arc's advance, and every duration that a player could be timing against. Reduced motion
never removes a beat and never removes a result.

---

## 11. Feedback hierarchy

| Event | Visual | Sound (§13) | Weight |
|---|---|---|---|
| Input received | Lean before travel; contour on an actionable object | Footfall on the correct surface | 1 — lowest |
| Core action lands (a load put down) | One course added to the pile, settling | Wood settling on wood | 2 |
| Reward (the household changed) | **The fire is higher and the pile is a course taller at the next dawn read** (§7.3) | The hearth bed is louder | 3 — delivered late, once a day |
| Word minted | One scratch on the plank | One scratch, dry | 2 |
| Danger, near miss | Hatch densifies 200 ms | — | 1 |
| Danger, clip (unease +1) | Step falters, cone sweeps back | A foot stopping | 3 |
| Warning (unease 2, Felix will wake) | A taper is struck, 20 real-seconds ahead | The strike and flare | 4 |
| Failure, terminal | Cone whitens; his shadow falls across them; 2 s hold | Everything stops except one held tone that is the room going quiet | 5 — highest, and used once |
| The ending | The moon sets; the fire | Wind, then fire | 5 |

Nothing in this game gets weight 5 twice, and nothing gets weight 4 more than three times a run.

---

## 12. Every mode is a non-combat mode, and the one moment force exists

The method asks for direction across combat and non-combat modes. **This game has no combat mode**
— no weapon, no kill verb, no resolvable fight (`GAME_DESIGN` §14). Every mode in Appendix A.2 is
therefore a non-combat mode, and this section exists so that the absence is a stated position
rather than a silence a later pass fills in.

The consequence for the art is not just subtraction. Three things follow.

**No visual vocabulary of threat-to-others exists anywhere.** The creature never holds an
implement in a way that reads as a weapon. Felix's tools are Felix's work and are drawn hanging on
a nail (§4.3); when the creature carries them at night he carries them the way Felix carries them,
across the shoulder with a load. There is no combat pose, no readied stance, no target reticle, no
threat indicator on any figure — including on the eight-foot one.

**The stick is the only implement raised at anyone, and it is raised at the player.** Felix strikes
with it (chapter 15). It is drawn as a stick — a piece of the household — and the frame does not
dramatise it: no impact flash, no shake (§2, inverse list), no red. It lands once, on the floor,
audibly (§13.3), and it is not shown landing on a body.

**Force is available and is refused, and the refusal is performed, not disabled.** The novel is
explicit that he could have torn Felix limb from limb and did not (chapter 15). The art delivers
this as an animation the player triggers and watches complete: hold the context action beside
Felix and the hand opens, rises, holds 700 ms, and lowers (§10.1, M7 beat 9). **No button is
greyed out and no message says the action is unavailable** — a disabled affordance would tell the
player the game forbade it, when the point is that he refused. The camera sits behind and below him
so Felix's face carries the scene and the creature's does not (P3).

This is the whole of the direction for force in this game, and it is one animation long.

---

## 13. Sound and music direction — **what this slice ships**

### 13.1 The rule the whole sound world obeys

**Everything you hear is something the creature could hear from where he is, made by an object
that is in the fiction.** There is no score, no stinger, no swell, no drone that is not a room
tone. When he is in the hovel, everything is heard through a wall or through straw: low-passed
at ~900 Hz with a short, dry reflection. When he is in the yard, the same sources are open and
the reflection is the yard's. When he is finally in the room (chapter 15), for the only time in
the game, sound is dry, close and unfiltered — and the change is how the player knows the wall
is gone.

Cultural basis: the only instrument in the book's cottage is De Lacey's — "an instrument"
producing "sounds sweeter than the voice of the thrush or the nightingale" (chapter 11), later
named a guitar, playing "several mournful but sweet airs" (chapter 15). It is the game's only
melodic material and the only thing that could be called music. It is played by a character, in
a room, for his daughter, and it stops when he stops.

### 13.2 Implementation, stated honestly

**No audio files ship.** Everything is synthesised in WebAudio at runtime — consistent with the
zero-build, no-dependency, ≤25 MB brief, and with the design's rule that the seed governs
ambience only (`GAME_DESIGN` §5).

- **The guitar:** Karplus–Strong plucked string, gut-string parameters (fast damping, low
  brightness), playing **one authored minor-mode air** — a single phrase of eight to twelve notes,
  the same one every night. **Scope cut, taken deliberately:** an earlier draft specified a seeded
  phrase set, which is a small composition task plus a selector plus a variation problem, for a
  sound the player hears through a wall. One air, repeated, is also closer to a blind man playing
  the thing he knows than a soundtrack is (chapter 15: "several mournful but sweet airs" is the
  novel's plural, and this document is knowingly narrower than the novel here). What is seeded is
  the *hour* he takes it up, not the material.
- **Wood, latch, scratch, footfall:** short filtered noise bursts with authored envelopes.
- **The hearth:** band-limited noise at 80–1200 Hz with a slow crackle generator. **Its level
  follows the fire that is actually burning** (§7.2) — so it is flat across every dusk and it is
  loud at a dawn where Firing ≥ 2. A household with a high morning fire is audibly warmer through
  the wall. This is a second, non-visual channel for the thing Risk 3 says must be legible, and it
  peaks at the same read the visual does; the two do not disagree.
- **The taper:** a struck flare — one short bright transient plus a rising noise tail. This is the
  game's warning sound and it is the only bright transient in the palette.
- **Wind:** two filtered noise layers, one for the wood and one for the yard; the second rises for
  the last two night-minutes and is how dawn is heard before it is seen.
- **One bird:** which species is seeded (`GAME_DESIGN` §5). It sings at first light and nowhere
  else, so a bird is not a nice detail, it is the sound of the deadline.

### 13.3 Per-event sound forms

| Event | Form | Layer |
|---|---|---|
| Footfall | Four surfaces: deep snow (soft, broad), cleared path (grit), thawed earth (damp), straw (dry) | Continuous, low |
| Load on the shoulder | One low wooden knock and a shift of weight | Action |
| Load put down at the door | Wood settling on wood, three impacts, decaying | Action, and the game's reward sound |
| Drawing water | The well chain, then the pail's rim | Action |
| Clearing the path | Iron on frozen ground, repeated | Action |
| The pig, driven | Grunts and straw. **A grunt at night is a pig** — the sound is the reason the synergy is safe (`GAME_DESIGN` §6.4) | Ambience, load-bearing |
| The cow | One bell, once a night, at the milk-house | Ambience |
| The hearth | Continuous, level = Firing | State |
| Speech through the wall | §13.4 | State |
| The guitar | De Lacey, at his own hours | Diegetic music |
| Felix reading aloud | The murmur, in a regular measure, on frost nights (chapter 12) — the rhythm is how the player recognises a doubled listen | State |
| The taper struck | Bright transient + tail | **Warning** |
| Agatha's hand on the latch | One latch, then silence held for 1.5 s | The first reward in the game |
| Seen | Everything cuts. One held room tone under the 2-second freeze | Terminal |
| The knock | Three raps on wood, from outside; then "Come in" | Climax |
| Felix's stick | One impact on the floor, not on a body | Climax |
| The end | Wind rising, then fire | Result |

**No recorded human voice ships.** There is no voice acting and none is planned for this slice.

### 13.4 Speech, and why it is not words

The family's speech is a **wordless formant murmur**: a pulse source through two bandpass filters
with **one length-parameterised pitch-and-amplitude contour** — a declining phrase with a slight
lift at 70% of its length, stretched or compressed to the utterance's duration, with the speaker's
formant pair setting the range. **Scope cut, taken deliberately:** an earlier draft authored a
contour per utterance, which is an authoring task proportional to the script and pays nothing,
because the player is hearing it through a wall and the *text* is what carries meaning. One
contour, four formant pairs, one length parameter. It has cadence, gender range and enough
emotional shape to be speech, and no phonemes. This is not a compromise — it is the book's own
sequence. He
hears "articulate sounds" long before he knows they are words (chapter 12), and the sound never
changes as he learns; the *text* becomes legible while the murmur stays exactly the same. The
player experiences the acquisition of language as a change in themselves rather than a change in
the world.

Degrade path if the murmur reads as an artefact rather than as speech: drop it entirely, keep the
room tone and the text. Recorded speech is not the fallback, in any form.

### 13.5 What is release-gated and what is not

Release-gated (their absence is a build failure): the four footfalls, the load-down, the latch,
the hearth bed at **its two levels** (§7.2: small, built high), the taper strike, the dawn bird,
the wind, and the guitar. These
carry state or carry a beat and there is no visual substitute for any of them.

Degradable: the murmur (→ silence + text), the cow bell (→ omit), the pig's straw layer (→ grunts
only), and wind layers beyond one (→ one). The guitar's phrase variety is not on this list because
it was cut before the gate, not degraded at it (§13.2).

---

## 14. Signature moments

Nine, one per distinct interface or mode. Every one is a real frame the game produces from a real
state, with a before→after, a beat sheet, and a protected region.

One mode does not get its own moment and this is deliberate, not a gap: **the options plate** is
the same interface as the title (M1) with different verbs.

**Beats are run by one generic runner.** Every beat below is a `{duration, draw}` pair fed to a
single sequencer — a list, an elapsed time, and a draw call per beat. **Scope cut, taken
deliberately:** an earlier draft implied a bespoke implementation per named beat, which is where a
third of a build budget goes. There is one runner, and the beat sheets below are its data. Beats
whose only content is a transition — M1 beats 1–4 and M9's paper-burn — are **degradable to
cross-fades of the same total duration**, and are marked as such where they occur.

---

### M1 · Title — *One lit window*

An engraved plate of the cottage at night, seen from the wood's edge: snow, the wood's outline, the
cottage in elevation with **one lit window**, and in the near bottom-left corner the dark lean-to
of the hovel. No figure. No creature. The only warm thing in a cold plate is a room you are not
in — which is the whole game, before a word of it is explained. Title in the platemark margin
below.

**Beats 1–4 are pure transition and are degradable**: if the build is short, print the finished
plate and cross-fade the amber up over 1500 ms. Beats 5 and 6 are not degradable — they are the
title and the verbs.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | Blank cream plate, platemark only | 0–300 ms | Static |
| 2 | The engraving prints: line only — wood, cottage, snow — wiping left to right as if pulled off a plate | 300–900 ms | Static |
| 3 | The aquatint night wash settles over the line | 900–1300 ms | Static |
| 4 | The single window goes amber | 1300–1500 ms | Static |
| 5 | *Frankenstein; or, The Modern Prometheus* letterpresses into the lower margin, then **The Hovel · chapters XI–XVI** beneath it | 1500–1900 ms | Static |
| 6 | Three verbs fade up in the margin. The guitar's first phrase begins, muffled, as though through a wall | 1900–2600 ms | Static |

Protected region: `x 34%–72%, y 26%–66%` (the lit window and the hovel's corner).
**Intentional overlay: no** — the title and verbs live in the margin below `y 74%`.

---

### M2 · Cold open — *The chink*

The first frame of the game contains one thing (`GAME_DESIGN` §11). The player's first meaningful
action is to keep watching, at second zero, and the only prompt is four words at the bottom edge.
Timings follow `GAME_DESIGN` §10 exactly.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | Black. Then the chink prints itself: a ragged aperture, warm; inside it the whitewashed room, very bare, a small fire, an old man with his head on his hands, a girl sewing at his feet (chapter 11) | 0:00–0:06 | Static. Aperture at 34% frame width, off-centre left |
| 2 | The old man takes up the guitar. The first air, close, because the chink is open | 0:06–0:14 | A 2% push toward the aperture across the whole beat |
| 3 | **Felix comes back bearing a load of wood on his shoulders, and Agatha meets him at the door and helps him off with it** (chapter 11). The game's only verb, demonstrated once, by the man whose day the player is about to free | 0:14–0:18 | Static |
| 4 | The taper goes out. Only the small fire is left. The frame widens: straw, planks, the roof crossing low. We were in the hovel the whole time | 0:18–0:22 (3500 ms) | The aperture plate scales to 40% and cross-dissolves into the top-down plan. **Not a rotation** — no 3D move is attempted in Canvas 2D and none is asked for |
| 5 | A hand enters the bottom of the frame and lifts a plank away. A cold slot of yard opens | 0:22 | Static; the plan settles |
| 6 | The moon arc prints into the top-right margin as the first step lands in the yard | 0:22–0:24 | Static |
| 7 | The load of cut wood lying by the outhouse where Felix left it. Agatha's cone sweeps the milk-house path | 0:26–0:58 | Play |
| 8 | First light: the night wash drains from the top edge | 1:05 | Forced return |
| 9 | The chink lights. **Agatha opens the door and stops with her hand still on the latch.** She says something. Felix comes and looks. He does not take his tools out that day | 1:12 | Hovel read; static |

Protected region: `x 16%–52%, y 22%–66%` (the aperture).
**Intentional overlay: no** — the four-word prompt sits in the band at `y 88%–96%`.

---

### M3 · The yard — *The carry* (core action)

Moonlit snow. The creature crosses the open ground between the outhouse and the cottage door with
a load squared on his shoulder, and Agatha's cone is live on the milk-house path, its inner band
crossing the line he would have walked. He is behind the woodpile, which breaks the wedge at
knee height without hiding him from the player. The pile at the door already has two courses on
it. The moon arc is a third gone.

Before → after: the cone's outer band sweeps toward him and he stops moving. The hatch densifies.
It sweeps off. He goes.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | The creature leans, then travels; snow footfall | 90 ms lean, then continuous | Static plate |
| 2 | Agatha's cone begins its sweep from the milk-house | 1200 ms | Static |
| 3 | The outer band's boundary crosses his position. Hatch density doubles | 200 ms | Static |
| 4 | He stops. Prompt: *put it down and go* — the game's only advice, offered once | held | Static. **T-a verification frame** |
| 5 | The cone sweeps back off him; hatch relaxes | 300 ms | Static |
| 6 | He travels; the load goes down at the door; the pile grows by one course and settles 3 px | 220 ms + 120 ms | Static |

Protected region: `x 30%–70%, y 34%–72%` (the creature and the live cone).
**Intentional overlay: no.**

---

### M4 · The hovel at dawn — *The read*

The game's signature still (§7.1). The frame is the hovel's interior: near-black straw and plank,
the ragged aperture left of centre with the room inside it, the cold slot lower right with the
pile at the door showing through, and in the near foreground his own heap of food and the plank of
scratches. **The frame this moment is specified against is dawn 5 of the reference line** (§7.3),
which is also the dawn `GAME_DESIGN` §14 asks the player to describe: the fire **built high**,
Safie and Agatha at the board, De Lacey by the hearth, **two plates**, and outside in the same
frame **two courses at the door**. Felix has opened the door, left the tools on their nail, and come
back in to the book — at this dawn his day is free, and it is free because of last night's load.

Identity, action and world in one still, with no interface in it, and the room's best fire sitting
next to the run's worst board.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | The night wash finishes draining; the plan irises down to the aperture | 1600 ms | Iris |
| 2 | The hovel interior settles. Straw, planks, the low roof | 200 ms | Static |
| 3 | The chink lights — the taper inside is lit for the morning | 400 ms | Static |
| 4 | The room cross-fades from last dawn's state to this one. **Fire and board move together, in one dissolve** | 900 ms | Cross-fade, **never a cut** |
| 5 | Through the slot, once only, at dawn 2: Agatha opens the door and stops with her hand on the latch. The latch sound. Silence held. At every later dawn the door simply opens and Felix's wide cone crosses the yard | 1500 ms | Static |
| 6 | Nothing happens next. The player is left in it until they move | held | Static |

Protected region: `x 14%–50%, y 20%–64%` (the aperture and the room in it).
**Intentional overlay: no.**

---

### M5 · The lesson at the chink — *The minting*

Night 4. Safie has arrived, unveiled, and is repeating nouns after Agatha (chapter 13). The
aperture is at its widest and its warmest, with the room at its fullest — the brightest and
busiest frame the game ever draws. A word rises out of the frame along the aperture's right edge and
lodges as a scratch on the plank in the foreground. **The currency is seen being minted**, once,
and then the effect is never explained again.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | The aperture grows from 34% to 46% of frame width; amber lifts 20%; the murmur opens up | 240 ms | Static frame, aperture scales |
| 2 | Safie repeats. The murmur takes on the shape of a single short utterance | 900 ms | Static |
| 3 | The word rises out of the aperture in the reserved lane | 700 ms | Static. **T-b verification frame** |
| 4 | It reaches the plank and becomes a scratch. Dry scratch sound | 180 ms | Static |
| 5 | Agatha speaks, and the player reads what they can: the known words print, the rest are wavy rules | held | Static. **T-c verification frame** |
| 6 | The moon arc has moved further than the player expected | — | Static |

Protected region: `x 12%–52%, y 18%–68%` (the aperture); the word lane at `x 52%–64%` is adjacent
to it and never enters it.
**Intentional overlay: no.**

---

### M6 · First light (transition)

The most feared frame in the game and the one with the least in it. The night wash drains from the
top edge, the plate becomes readable, and the creature is in the open with two night-minutes gone.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | The sky band at the plate's top edge lightens; the moon arc's remaining segment turns to stipple | 400 ms | Static |
| 2 | One bird | 600 ms | Static |
| 3 | The night wash drains top-down; snow goes to bare paper; the creature is the only dark thing left | 1200 ms | Static |
| 4 | Felix opens the door; a wide cone crosses the yard | 500 ms | Static |
| 5 | Either the hovel takes him, or M8 | — | Iris to hovel, or freeze |

Protected region: `x 20%–80%, y 30%–70%` (the yard the player must cross).
**Intentional overlay: no.** No text appears during this transition at all.

---

### M7 · The door, day 8 (climax)

The only daylight in the game, and the only elevation other than the chink. He crosses the yard
in daylight, knocks, and is told to come in by a man who cannot see him (chapter 15). Inside: the
room from the doorway, at eye level, for the first and last time — De Lacey by the fire with his
head turning toward a voice, the guitar set aside, and behind him the window onto the lane.

The pressure is not a timer readout. **It is the window.** As the exchanges run, the light through
the open door behind the player lengthens across the floor, and in the last exchange a figure
appears in the window on the lane. The player watches the ending arrive over De Lacey's shoulder
while he is still being kind to them.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | Plan view, daylight. The three go out at the gate. The plate has no night wash on it for the first time | 2000 ms | Static plan |
| 2 | He crosses the yard. Nothing is hidden. No cone exists on this plate | ~6000 ms | Static plan |
| 3 | Three raps. The frame holds | 1400 ms | Static plan |
| 4 | *"Who is there? Come in."* | 900 ms | **Hard cut** to elevation — the only cut in the game |
| 5 | The room from the doorway. De Lacey's head turns toward the voice. Firelight on him; daylight from behind the player laid across the floor | 1200 ms | Static elevation |
| 6 | The exchanges the run earned, one at a time on the door plate. Between each, the daylight on the floor lengthens by a measured step | per exchange | Static. **T-e verification frame** |
| 7 | A figure crosses the window on the lane | 500 ms | Static; no zoom, no music |
| 8 | The door opens. Agatha faints, Safie runs, Felix darts forward with the stick | 1600 ms | Static |
| 9 | From behind and below: the creature's hand opens, rises, holds, and lowers (chapter 15) | 700 ms hold | Static. His face is not in frame |

Protected region: `x 26%–66%, y 22%–62%` (De Lacey's head and the fire behind him).
**Intentional overlay: no** — the exchange plate is at `y 74%–94%`.

---

### M8 · Being seen (failure)

The one frame the whole game is built to avoid. It is not dramatic; it is quiet and it is over.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | The cone's inner band reaches him. **The hatch vanishes** and the wedge goes to flat paper | 120 ms | Static |
| 2 | All sound cuts to a single held room tone | 0 ms | — |
| 3 | His own shadow, cast by their light, falls across the person who saw him | 200 ms | Static |
| 4 | The frame holds. Nothing moves. No interface, no button, no prompt | 2000 ms | Freeze |
| 5 | The world is replaced by paper and the card presses in: *Agatha came out for the pail at first light. The water had not been drawn.* | 340 ms | To card. **T-d verification frame** |
| 6 | The epilogue begins. There is no retry on this frame; the run plays out to its ending (`GAME_DESIGN` §12) | — | — |

Protected region: `x 30%–72%, y 28%–70%` (the person, the whitened wedge, and his shadow).
**Intentional overlay: no** at beats 1–4; the card at beat 5 is `x 22%–78%, y 30%–70%`,
**intentional overlay: yes.**

---

### M9 · The moon sets, and the fire (result)

The last input in the game is the first verb it taught: hold, and watch (`GAME_DESIGN` §10).
He waits with forced impatience until the moon has sunk (chapter 16). The player holds position
and watches the arc complete, exactly as they held to watch through the chink at second zero.

| Beat | Who enters / what moves | Duration | Camera / transition |
|---|---|---|---|
| 1 | Dawn after the door. From the hovel's slot: the lane. Felix and another man. Three months' rent, the produce of the garden (chapter 16) | ~8000 ms | Static hovel view |
| 2 | The cottage is dark for a whole day. The chink shows nothing at all — no plate, no figures, no fire, a dark aperture (chapter 16: "The inside of the cottage was dark, and I heard no motion"). It is the first time the aperture has been the darkest thing in the frame | 3000 ms | Static; no plate turn |
| 3 | Night. The plan, with no cones on it anywhere, for the first time | 2000 ms | Static |
| 4 | He holds. The moon arc runs down. Wind rises from the wood | up to 20 s, player-held | Static |
| 5 | The arc completes. Part of the orb is hidden; it sinks | 1200 ms | Static |
| 6 | **`#a83218`** — the first red in the game. The straw and heath go up; the wind fans it; the plate is consumed from its own edges inward, as paper burns | 2600 ms | The plate burns rather than fades |
| 7 | Cream paper. The three closing lines, in the variants the run earned (`GAME_DESIGN` §15) | held | Card |

Protected region: `x 24%–76%, y 26%–74%` (the cottage and the fire).
**Intentional overlay: yes** at beat 7 — the closing lines are deliberately centred on the burnt
plate, which is the one time in this game that a centred overlay is the intended composition.

---

## 15. Direction for generated assets

### 15.1 The style anchor, to be repeated verbatim in every prompt

> Late-eighteenth-century copperplate line engraving with aquatint wash, printed in warm
> brown-black ink on cream laid paper with visible chain lines; forms built from crosshatching
> and stipple only; no airbrush gradients, no photographic texture, no digital painting; a single
> warm hearth-amber accent against a cold indigo night wash; visible platemark at the edge.

Repeated **word for word** in every prompt, not paraphrased and not stated once for a batch. Every
plate additionally repeats its own light sentence — for `plate/room`: *"the only light comes from
an empty hearth at the left of the room; the whitewashed wall takes a faint warm amber falloff
from that direction."* The falloff is deliberately faint, because the Canvas fire and the amber
integration layer (§7.2) drive the room's actual brightness and cannot subtract light the plate
already baked in.

### 15.2 Why this style, in terms of failure modes

The style was chosen partly because of how it fails.

- **Over-rendering** lands on "a very detailed old engraving", which is still on style.
- **Under-rendering** lands on "a sparse line drawing", which is also on style.
- **Colour drift** is bounded, because the palette is one ink and one accent; a model that
  wanders produces a warmer or cooler brown, not a wrong picture.
- **Anatomical failure** — the classic generative weakness — is least damaging here, because the
  figures are small, seen from behind or above, faceless by principle (P3), and identified by
  prop and silhouette rather than by face (§4.3).
- **Composition failure** is contained by the fact that **fifteen images are generated in total,
  six of them release-gated** (§16, the one place the count is stated), that none of them contains
  a figure whose position has to agree with another image's, and that every one can be regenerated
  without disturbing anything else.

Anything the model does badly, Canvas 2D draws instead. The division in §16 is drawn along exactly
that line.

**The honest sentence about that count.** The low image count is not a saving — it is a transfer.
It is bought by drawing the playfield in code: the entire holding plate, every figure at both
scales, every cone, every piece of state and every transition are Canvas 2D (§16.3). **The code
cost of the engraved renderer is this document's schedule risk; the image count is not.** Fifteen
low-entropy brown-ink-on-cream plates at 1280×800 will land in the low hundreds of KB each and the
whole set comfortably inside the 25 MB budget, which is the least interesting fact in this
document. What should be watched in the build is the size of the drawing code, and the cuts in
§7.2, §4.4, §13.2, §13.4 and §14 exist to hold it down.

### 15.3 Rules for the generated set

- **One composition, no states.** There is a **single** room plate (§7.2) and it is empty — no
  figures, no fire, no plates, nothing that carries state. Nothing has to cross-dissolve cleanly
  against another generated image, because no second generated image of the room exists.
- **Reserve the functional space.** The room plate leaves the aperture's ragged edge to the
  compositor: it is generated as a full room, and the hovel's dark foreground and the aperture
  mask are drawn in Canvas over it. No plate contains its own frame.
- **Figures sit in the room's light.** Any element generated separately from a plate ships with a
  contact shadow drawn in Canvas along the plate's light direction, plus the amber integration
  layer (§7.2). A figure with even frontal lighting pasted into a firelit room is a defect.
- **No text is ever baked into an image.** Every word on screen is set by the interface layer.
- **Every asset enters through a visual key.** A missing key renders a grey box with its key name
  and the build continues. Image generation never blocks the build; if a plate cannot be produced,
  its key is marked pending and the game still runs.

### 15.4 Forbidden prompt tokens

Never appear in any prompt, in any form, including as negatives where a negative would still
condition the result: *Frankenstein's monster*, *Boris Karloff*, *Universal*, *1931*, *Hammer*,
*Netflix*, *Del Toro*, *Branagh*, any film, actor, studio or year after 1900; *bolts*, *neck
electrodes*, *flat head*, *green skin*, *stitches*, *zombie*, *Halloween*, *laboratory*,
*Tesla coil*, *gothic castle*, *horror movie poster*. The creature's prompt is built only from
chapter 5's own words.

---

## 16. Asset register

Every entry sits in exactly one tier.

> **The generated-asset count is stated here and nowhere else.** **6 release-gated images + 9
> degradable images = 15 generated images**, plus 2 font files and the audio set of §13.5, which
> ships as synthesis code and not as files. Any other number appearing in this document, in a
> brief derived from it, or in a build report is wrong and this table is right. The count fell from
> 20 by two cuts recorded below: four room plates (§7.2) and the far-wood plate (§3.1). See §15.2
> for why the low count is not the good news it looks like.

### 16.1 Release gate — missing means the build fails (6 images, 2 fonts, the audio set)

| Key | What | Why it cannot degrade |
|---|---|---|
| `plate/paper` | The laid-paper ground tile, cream, chain lines | Without it there is no style; every surface uses it |
| `plate/title` | The cottage at night from the wood's edge, one lit window | M1 has no substitute; it is the first frame anyone sees |
| `plate/room` | **The empty whitewashed room** — hearth with no fire, bare board, boarded window from inside, table, stool, bare wall. No people, no state | **This is Risk 3's stage.** Every figure and every state object is drawn on it in Canvas (§7.2). A grey box here and the game's central claim has nowhere to happen |
| `plate/hovel` | The hovel interior base: straw, planks, low roof, the slot | The read-out screen (§7.1) |
| `plate/door` | The room from the doorway, elevation, De Lacey by the fire | M7 |
| `plate/fire` | The final frame | M9, and the only red in the game |
| `font/caslon-text`, `font/caslon-display` | Libre Caslon, OFL, subset | No sans-serif substitute is acceptable |
| `audio/*` release-gated set | §13.5 | Each carries state or a beat |

### 16.2 Degradable — ships with a named lesser expression (9 images)

| Key | Degrade to |
|---|---|
| `plate/pool` (the reflection, chapter 12, Shelley's description) | **The recoil and the rings in Canvas** — his shoulder and the back of his head in silhouette against the pool, the water taking the face away in rings, and **no face at all**. The moment still plays and P3 still holds |
| `plate/lane` (Felix, the landlord's man, the two countrymen) | The plan view of the lane drawn in Canvas at plan scale, two figures, plus the epilogue text |
| `element/safie-arrival` (horse, guide, veil thrown up) | Two figures at the door in plan view; no horse; the veil survives as her head-mass |
| `element/portmanteau` | An outline object at the near wood's edge and one line of text |
| `element/books` | One line of text |
| `element/journal` | Text on paper ground; no engraved facsimile |
| `element/flower` (the first white flower, chapter 12) | Omitted from the board |
| `element/cow` | Omitted; the bell remains |
| `element/pig` | A small plan shape; grunts remain, because the synergy depends on the sound and not the drawing |
| Figure attitudes beyond those listed in §7.2 | Omitted. State is read from objects, not from faces or poses |
| `audio` degradable set | §13.5 |

**Why `plate/pool` came off the gate.** It was release-gated in an earlier draft, and that was
wrong three times over: it is the hardest image in the set, it is the only one where the licence
boundary is actively tested, and it is content a player may never trigger. Gating a one-pass build
on an optional image the generator may refuse is how a build becomes a blocked build. The old
justification — "a grey box here is worse than not shipping the pool" — is an argument for a named
degrade, which is now written above, not for a gate.

### 16.3 Drawn in Canvas 2D, not generated

The entire holding plate (walls in section, three hatched ground types, trees in outline, the pool,
the sty, the well, the woodpile, the path, the lane gate); every figure at plan scale **and every
figure at room scale, in every attitude**; every vision cone and both its bands; every light wedge;
the moon arc; the fire clusters; the pile courses; the plates on the board; the taper and the
stick; the bundle inside the door; the tally plank and its scratches; the food heap; the aperture
mask; the platemark; all text; all transitions.

**This list is the schedule.** It grew when the room plates were cut, and that trade was taken
knowingly (§7.2): four generation risks exchanged for one drawing task.

### 16.4 What was cut, and why

Stated so a later pass does not restore them as improvements:

- **The far-wood plate**, its cross-dissolve transition, its ground palette, its asset key and the
  far forage verb (§3.1). The portmanteau moved to the near wood's edge. The far forage cost 5
  minutes against the near wood's 3 and was never worth taking.
- **Four of the five room plates** (§7.2). One empty room, every figure in Canvas.
- **Three of the six ground-hatch types** (§4.4). Snow, cleared path, thawed earth with a furrow
  flag.
- **The guitar phrase set** (§13.2) and **per-utterance murmur contours** (§13.4).
- **Per-beat bespoke implementation** (§14). One `{duration, draw}` runner.
- **The taper's window cone.** A cone with no owner (§6.3).
- **A separate map or overview screen** — one fixed night plate makes it redundant.
- **Falling snow during play** — moving particles compete with cone hatching for the same visual
  channel, and cone legibility is the game. Snow falls in the title plate only.
- **Per-character portraits and expression differentials** — §7.2 reads state from objects, and
  faces are excluded by P3 in any case.
- **A scrolling or following camera**, with its culling and its off-screen threat.
- **Screen shake, of any amplitude, anywhere.**
- **Parallax layers.**
- **A day-time exploration mode.** Daylight happens once, on day 8.
- **Any second interior.** There is one room and one hovel.

---

## 17. Originality boundary, and the risks that must be verified in a real run

### 17.1 Boundary

The 1831 text is public domain in the US, UK and EU (`source/SOURCE.md`). Everything visual in
this document derives from that text, cited by chapter.

The **1931 Universal make-up design is separately copyrighted and is out** — flat cranium, neck
electrodes, green pallor, and everything that reads as a citation of them. **Recent screen
adaptations, including the 2025 film, are out as reference at any strength**, including as
negative prompts and including as mood boards, because their creature designs are their own
protected works even where they also claim fidelity to the novel.

In: period public-domain research material — eighteenth-century copperplate and aquatint
technique, anatomical écorché engraving, Alpine and Northern European landscape plates, cottage
interior genre prints, and the period's own architectural plan conventions. These supply
technique, composition, light and material. They do not supply a character.

The benchmark games named in the brief supply an **interaction principle only** — a drawn vision
cone as the whole information model (*Shadow Tactics*), a game with no combat verb (*Untitled
Goose Game*), an opportunity as a configuration (*Hitman*). None of their art, UI, assets,
palettes or character designs is referenced, and this document's visual language shares nothing
with any of them.

### 17.2 Risks, each with the test that would settle it

| # | Risk | Test | If it fails |
|---|---|---|---|
| R1 | **Cone hatching over ground hatching may not separate** at 1280×800. **Resolved here as a method, not deferred to a screenshot** — see below | Screenshot at 1280×720 of a cone crossing the woodpile and the wood edge simultaneously, in greyscale | Give cones their own value range and accept a flatter ground. That is the named fallback and it is acceptable |
| R2 | **The room's deltas may not read.** The whole of Risk 3 rests on §7.3 | `GAME_DESIGN` §14's playtest: at dawn 5 (the dawn of night 4), ask the player to describe the room. Fewer than half naming a difference unprompted = failure | Widen the deltas — a taller fire, a fourth plate where Store allows one, Felix's stool. **Never add a read-out** |
| R3 | ~~The five room plates may not cross-dissolve.~~ **Closed by cutting to one empty room plate** (§7.2). There is no second generated image of the room, so there is nothing to drift against and nothing to register | — | — |
| R4 | **The creature may be unreadable at plan scale**, since P3 removes the face | Thumbnail the holding plate to 25% and ask what the player is | Increase the scale ratio to 1.8:1 and widen the hair mass. Do not add an indicator or a marker |
| R5 | **The tally plank may stop being countable** past ~60 scratches (the reference line reaches 82) | Render 82 scratches at 1280×800 and count them from a screenshot | Group in fives, five groups to a row — already specified; if still unreadable, change the plank's aspect, never add a number |
| R6 | **The unknown-speech wavy rule may read as a font failure** rather than as incomprehension | Show a first-time player an utterance that is 70% unknown | Degrade to a single engraved rule of the utterance's length, with no per-word segmentation |
| R7 | **Per-frame compositing may cost frames.** The performance floor is load-bearing (brief row 1: ≥ 30 FPS). **R1 and R7 are the same risk** and are settled by the same method below | Profile at 1280×800 with four cones live | The grain is baked once into an offscreen canvas and composited once per frame; if it still costs, bake it into the plate images and drop the runtime layer |
| R8 | **The door scene may become a visual novel** — the exact failure mode this whole example exists to avoid | Watch a player through M7 and record whether they look at the window on the lane | The lengthening daylight and the figure in the window are the mitigation; if they do not land, shorten the exchanges rather than adding text |
| R9 | **Snow does not record footprints**, and stealth-literate players may expect it to | Ask a player after night 2 whether they think they left tracks | State nothing in-game. If players are routing against imagined tracks, the fix is a design decision, not an art one, and it belongs back in `GAME_DESIGN` |
| R10 | **The murmur may read as an artefact** | Play M5 to a player with no context | Degrade per §13.4: silence and text. Never recorded speech |

**R1 and R7, settled here as a method.** They were written as two risks and they are one. An
earlier draft's R1 mitigation was "lighten the ground under a cone by 15%", which means
re-compositing a clipped region of the ground under every live cone every frame — precisely the
per-frame cost R7 is about, with up to four cones live. The method is this instead, and the build
should implement it from the start rather than after a screenshot:

1. Draw the ground **twice**, into two offscreen canvases: `ground/full` at the specified hatch
   density, and `ground/reduced` at the same geometry with hatch density at 60%. Both are static
   for the night; both are drawn once when the night's season state changes, not per frame.
2. Each frame, blit `ground/full` once.
3. For each live cone: set the wedge as a clip path, blit the same rectangle from
   `ground/reduced`, fill the wedge with the cone wash `#93a8c6` at its band opacity, and stroke
   the 1.5 px ink boundary. Inner and outer bands are two clips off the same source.

That is two static offscreen canvases and N clipped blits per frame, with no per-pixel work in
JavaScript and no re-hatching. It gives the cone a genuinely lighter ground to sit on, which is
what R1 needed, at a cost R7 can afford. **Named fallback, unchanged:** give cones their own value
range and accept a flatter ground everywhere.

Beyond R1/R7, none of these is settled by this document. Each is written so that a QA run can
settle it with a screenshot or a single logged observation.

---

## Appendix A · `GAME_DESIGN` coverage table

Every level, mode, unit and system in `GAME_DESIGN` with the section of this document that
directs it. An item here without a section is an incomplete delivery.

### A.1 Levels and beats

| `GAME_DESIGN` item | Directed in |
|---|---|
| Beat 1 — Teach, nights 1–2 (§10) | §7.3 (dusk 1–2, dawn 2–3), M2, M3, M4 |
| Cold open, first 60 seconds (§10) | M2 |
| Beat 2 — Variation, nights 3–4, Safie arrives, the lesson opens (§10) | §4.3 (the veil), §7.2 (the figure layer), §7.3 (dusk 3–4, dawn 4–5), M5, §16.2 (`element/safie-arrival`) |
| Beat 3 — Combination, nights 5–6, the thaw, the garden (§10) | §4.4 (thawed earth, the furrow flag), §7.2 (the flower), §7.3 (dusk 5–6, dawn 6–7), M4 |
| Beat 4 — Test, night 7, prompts stop (§10) | §7.3 (dusk 7, dawn 8), §8.1 (empty prompt band), M6 |
| Beat 5 — Fate, the walk and the door (§10) | M7 |
| The epilogue: the lane, the landlord, the dark cottage, the moon-set wait, the fire (§10) | M9, §16.2 (`plate/lane`), §6.1 (reserved red) |
| The errand band, day 9, night 8 (§7) | §7.3 (the errand-band note) |
| Ending: family leaves for want (§7, §12) | §7.3 (the errand-band note), M9 beats 1–2 with the door omitted |
| Ending: the silent door (§12) | M7 with T-e rendering wavy rules only (§10.3) |
| Ending: seen (§12) | M8 |

### A.2 Modes and interfaces

| Item | Directed in |
|---|---|
| Title / main menu | M1, §8.4 |
| Options plate | §8.5; interface identical to M1 — declared, not omitted |
| Chink cold open | M2 |
| Hovel read, dusk and dawn | §7.1, §7.2, §7.3, M4 |
| Yard, top-down night play | §3.1–§3.3, §4, M3 |
| Chink listening | §10.1, M5 |
| The lesson | M5 |
| Dawn window / first light | §6.3, §10.4, M6 |
| Day-8 daylight crossing | M7 beats 1–3 |
| The door and the exchanges | M7 beats 4–7, §10.3 (T-e) |
| Felix, the stick, the withheld hand | M7 beats 8–9, §10.1 |
| Being seen + failure card | M8, §10.3 (T-d) |
| After-run screen / restart | §8.4, §8.5, M9 beat 7 |
| Viewport too small / wrong orientation | §8.6 |

### A.3 Characters and units

| Item | Directed in |
|---|---|
| The creature (player) | §4.1, §4.2, §5, P3 |
| Old De Lacey | §4.1, §4.3 (the arm he walks on), §7.2 (the figure layer), M7 |
| Felix | §4.3 (the tools), §7.2 (the figure layer), M7 |
| Agatha | §4.3 (the pail), §7.2 (the figure layer), M4 beat 5 |
| Safie | §4.3 (the veil), §7.2 (the figure layer — never the plate count), M5 |
| The pig | §4.1 (invented), §13.3, §16.2 |
| The cow | §4.1, §13.3, §16.2 |
| The landlord's man, the two countrymen | §16.2 (`plate/lane`), M9 beat 1 |
| Safie's guide and horse | §16.2 (`element/safie-arrival`) |

### A.4 Systems and state

| Item | Directed in |
|---|---|
| Vision cones, two bands | §6.2, §10.2, P5, R1's method in §17.2 |
| Waking windows and routines | §3.2, §6.3 (light is not sight), §7.2 (the figure layer), §13.3 (the taper) |
| Unease 0–3 | §6.2, §7.2 (the figure layer, the taper, the stick), §7.3 (the unease line), §10.2 |
| Night minutes / the moon arc | §6.2, §8.1, §8.2 |
| Firing → the pile at the door | §6.2, §7.1, §7.3 (**a dawn read**), §10.1 |
| Firing ≥ 2 → Felix's day freed | §4.3 (tools on the nail — **a dusk read**), §7.3 |
| Firing → the fire in the hearth | §7.2 (the dawn-fire question, settled), §7.3, §13.2 |
| Store → plates on the board | §6.2, §7.2, §7.3 |
| Turned beds (from the count of free thaw days; **not a state field**) | §4.4 (the furrow flag), §6.2, §7.3 |
| Own food → the heap on the straw | §6.2, §7.1 |
| Words → scratches on the plank | §6.2, §7.1, §10.1, R5 |
| The two-plate scene (chapter 12) | §7.3, **dawn 5** |
| The taper and the stick | §6.2, §7.2, §13.3 |
| The pool reflection | §5.1, §16.2 (**degradable, not gated**) |
| The journal of the four months | §16.2 |
| The three books / the portmanteau (at the near wood's edge) | §3.1, §16.2 |
| The pig-drive synergy | §4.1, §13.3 |
| Season: snow → thaw | §4.4, §7.3 |
| The water, the well, the path, the milk-house, the outhouse, the sty | §4.4, §4.5, §10.1, §13.3 |
| Determinism / seeded ambience | §13.2 |
| No number, bar or meter anywhere | P1, §8.3, §9 |

### A.5 Contract items

| Required by the method | Where |
|---|---|
| 3–5 core visual principles with inverse principles | §2 |
| Camera, focus order, occlusion, silhouette separation | §3, §4.2 |
| Shape / scale / density / landmark grammar | §4 |
| Functional colour, light, material with non-colour redundancy | §6 |
| Feedback hierarchy and minimal interface | §8, §11 |
| Combat and non-combat modes both covered | §12 — there is no combat mode, stated as a position, with the one force moment directed |
| Withholding force is a performed action, not a disabled button | §12, §10.1, M7 beat 9 |
| First-screen single focus and panel rules | §8.1 |
| No undelivered tactical depth | §8.3 |
| Motion and transition spec, per verb | §10 |
| Transient-text triplets (core + stroke/backing + verification frame) | §10.3 |
| Reduced-motion path | §10.5 |
| Sound and music direction, first-class | §13 |
| Typography, density, reading order, Latin font floor | §9 |
| A signature moment per interface/mode, with beat sheet and protected region | §14, M1–M9 |
| Asset register in two tiers, each entry in exactly one | §16.1, §16.2 |
| Originality boundary and unverified visual risks | §17 |
| Coverage table | This appendix |
