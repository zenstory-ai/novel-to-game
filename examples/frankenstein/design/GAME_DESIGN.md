# GAME_DESIGN · *Frankenstein* — **The Hovel**

Inputs: `analysis/SOURCE_BIBLE.md`, `PRODUCT_BRIEF.md`, `concepts/CONCEPT.md`. Every claim about
the novel is cited by chapter (1831 revised edition, Project Gutenberg #84). Interface language,
platform, rating, session length and player structure are inherited from the brief and are not
re-argued. No filenames, symbols or storage keys appear here; determinism and persistence are
stated as rule requirements and left to `BUILD_BRIEF`.

Numbers in this document are the design's own commitments. They are written to be recomputed
against the finished engine, and every threshold below carries its arithmetic.

---

## 1. One-page experience definition and player promise

**Identity.** You are the creature — eight feet, wordless, living in a hovel built against the
back wall of a cottage you may never enter (chapter 11). By the day you knock, an entire
revolution of the seasons will have passed since you woke into life (chapter 15).

**Core action.** Cross a dark yard carrying something that belongs to someone else's life, and
get back inside before anyone with working eyes is awake.

**World response.** The cottage answers in the room, never in a number: the pile at the door
grows, the fire is built higher, Felix stops walking to the wood and turns the garden instead,
a fourth plate appears — or two plates appear, and the food goes in front of the blind man while
the two younger cottagers keep none back for themselves (chapter 12: "several times they placed
food before the old man when they reserved none for themselves"). The novel states this as a
habit of both of them; concentrating it on Agatha in any single frame is this design's.

**Target feeling.** The specific dread of first light, and the specific ache of knowing that
the only person in the world who could hear you out is the one who cannot see you (chapter 15).

**The promise, in one sentence.** Keep this family alive through the end of a winter without
ever once being seen, and spend whatever is left of each night stealing the words you will
need at their door — because you will knock, and it will end the way it ends.

---

## 2. Genre landing and benchmark principles

Primary genre: real-time top-down stealth, vision-cone lane, non-violent social-stealth
subtype. There is no secondary genre; the resource layer is a support system, not a second game.

| Benchmark | Borrowed | Deliberately not borrowed |
|---|---|---|
| *Shadow Tactics: Blades of the Shogun* | The drawn vision cone as the **entire** information model. The player plans against perception they can see, never against a hidden roll | The assassin toolkit, bodies, a squad of specialists, quicksave scrubbing, mission scale |
| *Untitled Goose Game* | A complete game whose only system is NPC perception and reaction to your presence, with no combat verb anywhere | Comedy, mischief, the sandbox to-do list, and above all **the shoo-and-reset**: here the world does not restore itself |
| *Hitman: World of Assassination* | Opportunity as a **configuration**, not a timer: the way in is three people leaving the house at once (chapter 15), and the player must produce and recognise it | Disguises, the assassination fantasy, mission stories, retry-the-level structure |

Deliberately not borrowed from the lane as a whole, and this is a decision, not an omission:
**no pause, no slow-motion, no plan mode.** The stealth-strategy lane's convention is that you
stop time and compose a solution. That convention would dissolve the one thing this adaptation
is for — a night you committed to at dusk and must now live through. There is no allocation
screen and nothing is spent in advance: the plan lives in the player's head, formed while
reading the yard through the chink at dusk, and the only thing the game holds you to is that a
begun carry cannot be abandoned for free. That is a discipline, not a commitment mechanic, and
this document does not dress it up as one. Accessibility is answered instead in section 12.

Also deliberately not borrowed: an alert meter. Alert states exist (section 6) but a sighting
is not on that scale. It is a separate, terminal event, because that is what the book does
(chapter 16).

---

## 3. Experience pillars

Three, in priority order. When scope is cut, cut from the bottom.

| Pillar | Observable playtest evidence | Failure phenomenon that vetoes it |
|---|---|---|
| **1. Judgement runs on two channels and only one is winnable.** Any sighted person delivers an instant verdict (chapter 11: the shepherd shrieks and runs, the village drives him off with stones); the blind man argues with him as a person (chapter 15: "there is something in your words which persuades me that you are sincere") | An unguided player routes carries behind the woodpile and the sty wall, breaks off a carry when a taper lights, and — without being told — begins treating the old man's chair as the destination | The player treats a sighting as a recoverable alert: waits it out, comes back tomorrow, run continues. That is generic stealth, not this book |
| **2. Only invisible work lands, and nobody ever thanks you.** Months of night labour produce the words "good spirit, wonderful" and nothing else (chapter 12); a rescue performed in daylight is answered with a musket ball (chapter 16) | At the dawn of night 4 the player can point through the chink at what changed — a bigger fire, four plates, Felix indoors — and can say what it cost them in minutes | The household's state appears anywhere as a bar, a number or a score popup; or the room on night 7 looks like the room on night 1 |
| **3. Every night is one budget across sinks you cannot all fund, and the night is getting shorter.** Nocturnal rambles are "considerably shortened by the late setting and early rising of the sun" (chapter 13) | Two players finish with visibly different households and visibly different door scenes, and each can name what they gave up | A nightly routine exists that funds everything; or the door scene plays out the same regardless of what was banked |

---

## 4. Two-layer loop and mastery type

**Short loop (5–30 s).**

```text
read the yard (who is awake, where the cone is)
  -> choose a route and commit
  -> carry / gather / listen
  -> the world answers in an object: the pile at the door, the heap on your straw, a word scratched into the plank
  -> the moon arc advances
```

Ordinary player: crosses the yard in a straight line, aborts at the first cone, loses a minute
and gains nothing. Skilled player: routes behind the woodpile and along the sty wall, starts
the carry from the outhouse side so the return leg never enters Agatha's circuit, and arrives
back with the dawn margin intact — same minutes spent, one more chore fitted.

**Long loop (1–5 min: one whole night).**

```text
dusk: read the room through the chink (plates, fire, whether the tools are on the nail)
  -> decide, in your head, which of the five sinks tonight funds
  -> execute under a shrinking clock, with cones live only inside scheduled windows
  -> first light forces you back into the hovel
  -> dawn: read the consequence in the room, and in what Felix does with his day
```

Ordinary player: does whatever chore is nearest. Skilled player: reads the pile at the door
before spending, and knows that tonight's load is not for tonight — it decides whether the family
is well enough on day 6 to walk far on day 8, which is the difference between five slots at the
door and three.

**Mastery type: (a) one-off knowledge, with one renewable element.** Routines, cone paths,
windows and thresholds are fixed and RNG-free, so route knowledge is learned once and carries
into a second run — which is precisely the declared replay hook: the same night budget buys
more language when you stop wasting minutes. The renewable element is the door: which walk
occurs, on which day, and how many exchanges long it is, are re-derived every run from the
household state that run produced. You cannot memorise the door scene; you have to read the
house you built.

Playing well is visibly rewarded and not merely faster: more exchanges reached at the door, a
different closing line from De Lacey, a different flight, a different thing carried away.

---

## 5. Genre minimum contract

Only fields that change a player decision.

| Field | Rule |
|---|---|
| Input | Direct spatial movement, mouse-primary with full keyboard alternative. One context action (take / put down / listen / knock). No menus during a night. No dexterity requirement: nothing demands a reaction under 2 seconds, every cone is avoidable at walking speed |
| Time | Continuous. One night = 8 to 14 **night-minutes**; one night-minute = 8 real seconds. No pause, no slow-motion, no rewind |
| Visible information | Every cone is drawn while its owner is awake. Routines are fixed and repeat. The night clock is a moon arc. Your own gathered food is a heap on the straw. Words known are scratches on a plank |
| Hidden information | **The household's condition is never displayed.** Firing, Store and the household's unease are readable only as objects: the pile at the door, the plates and the size of the fire through the chink, the turned beds, the taper left burning, the stick by the chair |
| Commitment point | The night's spend is committed by walking, not by confirming. Once a carry begins it cannot be teleported home; abandoning a load drops it where it lies and it is found at dawn |
| Randomness | **None in the simulation.** Routines, windows, cone paths, thresholds and consequences are deterministic. The seed governs ambience only (which bird, which air on the guitar, the pig's grunts). The simulation advances on a fixed 60 Hz tick, and identical tick-indexed input yields identical state at every tick; rendering is not asserted frame by frame |
| Failure | Being seen by any sighted cottager ends the run at once and cannot be undone inside that run (chapter 16). **A sighting is not on the unease ladder and does not decay** — there is no waiting it out and no second attempt. Unease is a separate, recoverable thing and it does decay (section 6.2) |
| Recovery | Near-misses are recoverable and cost nights, not the run (section 6, unease) |
| Persistence | Nothing carries between runs. There is no save, no meta-progression, no unlock. The only thing that persists is what the player has learned |

---

## 6. World rules, state, and the systems that are actually needed

Systems budget: **one core, two supporting.** Remove either supporting system and the core loop
still stands; remove the core and there is no game.

- **Core — the household's attention.** Vision cones, scheduled waking windows, scripted
  routines, the household's unease, and the two-channel judgement rule.
- **Support A — the night budget.** One source, five sinks.
- **Support B — the household's winter.** Firing, Store, and their feedback into the routines
  the core system runs.

### 6.1 Rules as observable cause and effect

| Rule | What the player sees | Source |
|---|---|---|
| Anyone sighted who sees you ends everything | The cone whitens, your shadow falls across the person, the frame holds two seconds, and at the next dawn the landlord is in the lane asking Felix whether he has considered that he will be obliged to pay three months' rent and to lose the produce of his garden — and Felix answers that it is utterly useless | chapter 16 for the lane; the generalisation to *any* sighting is this design's, see section 17 |
| The blind man does not carry a cone | On night 1 the old man walks in front of the boarded window with no cone drawn while Agatha, six feet away, has one. Nothing says why | chapter 12, chapter 15 |
| Voice is negotiable where appearance is not | At the door he answers "Come in" without knowing what has knocked, and he keeps answering for as long as you can speak | chapter 15 |
| Invisible work is credited to nobody | Agatha stops in the doorway with her hand on the latch and looks at the wood. Felix comes and looks. Neither goes to the forest that day | chapter 12 |
| Freeing Felix's day is visible in what he does with it | He does not go to the forest; he repairs the cottage, turns the garden, and reads to the old man and Agatha | chapter 12 |
| …and it costs you night | A warm, provided household sits up later. The moon arc is one minute shorter the following night | **invented** — nothing ties their bedtime to their fuel; this is the tax that stops carrying from being free (section 17) |
| Taking from their store is legible as their hunger | The morning after any take, one fewer plate is set through the chink | chapter 12 |
| Frightening them closes the way in | At the third alarm Felix sits by the window all night with the stick, and the long country walk does not happen on its day | **invented** — the novel records the opposite reaction to months of night activity (section 17) |
| The night gets shorter as the season turns | The moon arc is drawn shorter each night from night 3, and the snow is gone from the path on night 5 | chapter 13 for the shortened rambles; the relocation of a spring phenomenon into this compressed winter is this design's (section 17) |
| Force is available and is never used | Holding the context action next to Felix as he raises the stick shows the creature's hand open and then lower. No button is greyed out; the refusal is performed | chapter 15 |

### 6.2 Resources — every field has a consumption point and at least one rule read point

| Field | What it measures | Source | Sink | Read points (rule that reads it) |
|---|---|---|---|---|
| **Night minutes** | how much dark you have | night length: 14, 14, 13, 12, 11, 10, 9, 8 by night, minus the Firing penalty | the five sinks below | dawn deadline; every action's cost; the lesson window's fixed position |
| **Firing** (their fuel) | how many days they can keep a fire without Felix walking to the wood | player carry, +1 per load (4 min); Felix adds +1 on any day he goes | household burns 1 per day | ≥2 at dawn → Felix stays home (routine change, cone layout change, night −1); ≥4 → night −2 and lesson window +1; 0 at two consecutive dawns → unease +1 |
| **Store** (their food) | how far they are from want | winter days +2; thaw days +3, or +4 if Felix is free | household eats 3 per day; each take −1 | ≤2 → the two-plate scene fires and Agatha rises early; 0 at three consecutive dawns → the family leaves for want and the run ends without a door; **the value at dawn of day 6 selects which walk occurs** |
| **Unease** | how badly you have frightened them | +1 per outer-band clip, dropped load, garden footprint, or being outside at first light | −1 per incident-free night | 1 → extra yard pass at dusk; 2 → the taper burns all night and Felix wakes at 55% of the night; 3 → Felix at the window all night **and the walk slips one day and loses 2 slots** |
| **Own food** | whether you can work | forage +6 (3 min, near wood — the portmanteau lies at the same edge and is found once) or take +6 (1 min, Store −1) | 3 per night | 0 at the moment of a carry → carry costs 5 minutes instead of 4 |
| **Words** | what you can understand and say | listening at the chink +2 per 2 min (first 16 words only, then +1 per 2 min; doubled on frost nights when Felix reads aloud); the lesson +20 on night 4 and +16 thereafter; the portmanteau +8 once | none — words are never spent | ≥44 → you understand the walk being planned and lose no slot noticing it; 40 / 52 / 62 / 72 / 80 → the five door exchanges; ≥62 → the journal of the four months becomes decipherable |

**Six fields, and no seventh.** There is no affection, reputation or trust meter anywhere in this
design. Unease **is** a suspicion ladder and this document does not pretend otherwise — the rule
it must obey is that it is never *displayed*: it appears only as the taper, the stick, the extra
pass and the slipped walk. A numeric or bar readout of any of the six fields appearing in the
build is a defect. Unease is also the one system here that the novel does not supply; its
provenance is settled in section 17.

**Unease, fully specified.** Three rules that the ladder above leaves open, and each one changes
a tension-target outcome, so they are fixed here rather than left to the build:

1. The Firing trigger fires **once per unbroken run of zero dawns**, not once per zero dawn. A
   line that never carries sits at Firing 0 for the whole slice and takes +1 for it, not +6.
2. A Firing-0 dawn is **not an incident**. Unease can decay through it, so the ladder measures
   what you did in the yard, not how poor the household is.
3. The walk-slip **latches**. The first time unease reaches 3, the walk moves to day 9 and loses
   two slots for the rest of the run; later decay softens the routines but does not restore the
   walk. Felix sitting up all night is what latches, and he does not un-sit.

**Garden is not a field.** An earlier draft carried it as state, and it failed its own test: its
only source was a thaw day with Felix free, its only read was the turned beds, and it had no
sink — so it was a rename of Firing ≥ 2, the same defect section 7 removes from the walk gate.
The beds are now drawn directly from the count of thaw days on which Felix was free, and the
flight line reads "the produce of the garden" when that count is 3.

### 6.3 The night's shape

**Ordering convention, stated once because every number in section 7 depends on it.** A day runs
**dawn → daylight → night**. The night that closes day N is night N and it ends at dawn N+1, so a
load carried on night N first shows in Felix's day on day **N+1**. Read the reference line any
other way and every Firing dawn, every penalty and the Store trace all come out wrong.

**Light is not sight.** A lit window, a taper or the fire throws light into the yard and none of
it is a cone. Cones belong to waking people only, which is what makes an empty plate mean an
empty plate. An earlier draft gave the all-night taper its own static cone; it was cut, because a
cone with no owner breaks the one promise the information model rests on.

A night of length **L** night-minutes runs in three parts, and cones exist only where stated.

| Part | Minutes | Who is awake | What is safe |
|---|---|---|---|
| Retiring window | 0 → 5 (6 at Firing ≥ 4) | Agatha closes the sty and the milk-house; Felix at the door. Two moving cones near the cottage. **This is when the evening reading and, from night 4, Safie's lesson happen** | The far map: the near wood and its edge. The cottage side is closed |
| Deep night | 5 → L−2 | Nobody, unless unease ≥ 2, in which case Felix wakes for 2 minutes at 55% of the night, announced by a taper lighting 20 real-seconds ahead | Everything |
| Dawn window | L−2 → L | The sky band brightens at L−2. At L Felix opens the door with a wide cone across the yard. Agatha's dawn circuit runs too, **unless the water was drawn and (before the thaw) the path cleared** | The hovel, and only the hovel |

This is the whole reason the lesson costs what it costs: the lesson occupies the one window in
which the far map is free and the near map is not. Attending it forfeits the night's wood
carry on any night shorter than 10 minutes.

### 6.4 The optional synergy, and the worse route for players who never find it

Walking through the sty drives the pig. The pig grunts; a grunt at night is a pig, so **unease
does not rise** — but the nearest sighted cottager's retiring circuit bends toward the sty for
two minutes.

What that buys is precise, and it is not "both": the lesson occupies minutes 0–5 and costs 5,
the carry costs 4, and 9 minutes do not fit in a 5-minute window on any night. What the drive
does is open the **cottage side of the map during the window's tail**. Without the pig the
earliest survivable carry starts at minute 5; with it, the circuit is bent away and the carry
can start at minute 3 and run to 7. The payoff is **two night-minutes moved out of deep night**,
which on nights 6 and 7 is the difference between a listen block fitting and not fitting.

The player who never finds it has a worse but entirely viable route: skip the carry on the two
shortest nights, accept that Felix goes to the wood on those days, and finish with Store one
lower — a 3-slot walk instead of a 5-slot one, and two exchanges fewer at the door. Nothing is
locked; the whole scene still plays.

### 6.5 The holding, in numbers

The two preceding sections state costs in night-minutes. Those costs are **not free constants** —
they are properties of a layout, and the layout is fixed here so that the build cannot invent one
that makes section 7 come out differently. Every figure below is on the 1280×800 holding plate,
origin top-left, and the walked routes are polylines, not straight lines.

**Walk speed: 290 px per night-minute** (= 36.3 px per real second at 8 s to the night-minute).
The creature is 26 px tall on this plate, so he covers about 1.4 of his own heights per second —
a long stride at a walk, which is what eight feet at walking pace should read as. Carrying does
not change speed; it changes silhouette and sound.

**Landmarks.**

| Landmark | Position | Notes |
|---|---|---|
| Hovel mouth (**H**, the origin of every route) | (630, 265) | the loose-plank wall, opening north away from the cottage door |
| Cottage footprint | (550, 300) – (730, 410) | 180 × 110, matching the art document's scale figure |
| Cottage door, and the pile | (700, 425) | the pile of log-ends stands against the door jamb |
| Sty | (520, 240) | west-adjacent to the hovel (chapter 11) |
| Pool | (640, 195) | north-adjacent to the hovel (chapter 11) |
| Milk-house | (710, 252) | east-adjacent; this is why a take is cheap |
| Well | (470, 300) | west, clear of the cottage |
| Outhouse | (310, 485) | south-west; Felix leaves cut wood here |
| Woodpile | (480, 430) | mid-yard, the cover the skilled route uses |
| Garden beds | (850, 480) | east, worked only by Felix and only on a free thaw day |
| Near wood, edge | (200, 215) | forage, and where the portmanteau lies |
| Lane gate | (640, 545) | the path from the door apron runs to it, 135 px |

**The two traversal-costed actions, with their arithmetic.** These are charged at what the
creature actually walks, so a bad route costs more than the table says. The figures below are the
**designed** route — the one the skilled player finds.

| Action | Designed route | Length | ÷ 290 | Charged |
|---|---|---|---|---|
| **Carry** | H → (520,268) → (470,320) → (450,400) → (400,450) → outhouse (**432**) → (440,470) → (490,445) → (600,455) → (680,435) → the door (**402**) → (760,400) → (790,340) → (750,285) → (690,262) → H (**324**) | **1,158 px** | 3.99 | **4** |
| **Forage** | H → (540,240) → (400,225) → (280,218) → near wood edge, and back | **869 px** | 3.00 | **3** |

**The flat-charge actions.** These are debited at their stated cost on completion, because the
held work dominates the walk. Each is listed with the walk it contains, so the charge is
checkable rather than asserted.

| Action | Round trip from H | Walk | Hold | Charged |
|---|---|---|---|---|
| **Water** (the well) | 328 px | 1.13 | 0.87 | **2** |
| **Path** (H → the door apron, the 135 px to the lane gate cleared down and back, and home) | 919 px | 3.17 | 0 | **3** |
| **Take** (the milk-house) | 162 px | 0.56 | 0.44 | **1** |
| **Listen / lesson / journal** (at the chink) | 0 — the chink is the hovel's own wall | 0 | full | **2 / 5 / 4** |

**Tolerance band.** A tension target may be asserted against a run whose traversal totals fall
within **±10%** of the designed routes above. Outside that band the run was not the designed
route and the target is measuring the route, not the rule.

**Cottager waypoints, by routine variant.** Cones exist only while their owner is awake, and
only along these paths. Eight variants, each keyed to state read at the previous dawn.

| Variant | Fires when | Who | Waypoints |
|---|---|---|---|
| Retiring (baseline) | every night, minutes 0–5 | Agatha | door (700,425) → sty (520,240) → milk-house (710,252) → door |
| Retiring (baseline) | every night, minutes 0–5 | Felix | door (700,425), stationary, facing the yard |
| Retiring, late | Firing ≥ 2 at dawn | both | same paths, window shifted +1 minute, night length −1 |
| Retiring, bent | the pig was driven this night | Agatha | door → **sty, held two minutes** → milk-house → door |
| Dawn circuit | every dawn, unless the water was drawn | Agatha | door → well (470,300) → door |
| Dawn circuit, early | Store ≤ 2 at dawn | Agatha | fires 1 minute before L−2, then the baseline circuit as well |
| Felix wakes | unease ≥ 2 | Felix | at 55% of L: door → woodpile (480,430) → door, two minutes, taper lit 20 real-seconds ahead |
| Felix at the window | unease reached 3 (latched) | Felix | stationary at the cottage's south window, cone across the yard, all night |

**The blind man is the ninth path and carries no cone.** De Lacey walks at noon in front of the
boarded window, **supported on Felix's or Agatha's arm** (chapter 11, line 3365: "the old man
walked before the cottage in the sun for a few minutes, leaning on the arm of the youth";
chapter 12, line 3549: "The old man, leaning on his son, walked each day at noon"). That he is
always escorted is the whole teaching rule: the one day nobody is on his arm is the day the way
in exists.

---

## 7. Numeric budget table

Slice budget: **eight night-slots**, of which **7 are played** in both healthy bands (the walk is
on day 8, so night 8 never runs) and 8 in the errand band. Base night minutes for nights 1–7 =
14+14+13+12+11+10+9 = **83**, less 4–5 minutes of Firing penalty → **78–79 usable**.

Real-time reckoning, stated as a floor rather than an estimate:

| Segment | Real time |
|---|---|
| Nights, at 8 s per night-minute | 79 × 8 s = 10 min 32 s |
| Cold open through the first dawn | 1 min 15 s |
| Seven dawn reads at the chink | 1 min 45 s |
| The walk, the yard in daylight, the door | 2 min 30 s |
| The flight, the dark day, the wait for the moon, the fire | 1 min 30 s |
| **Floor** | **≈ 17 min 30 s** |

That floor assumes a player who never stops to read the room, never re-routes mid-yard and never
loses a carry. It is the lower bound, not the expectation. A first run that reads the chink at
dusk, aborts two or three carries and re-plans lands at **22–28 minutes**, inside the brief's
20–30 window; a player who is decisively faster than the floor is a signal that the night budget
is too loose, and is covered by T7.

**The five sinks, named once.** (1) **the carry** — their fuel; (2) **the chores** — the path
while snow lies, and the water; (3) **the chink** — listening, and from night 4 the lesson;
(4) **your own food** — forage, or take; (5) **the journal**. Every cost in this section belongs
to exactly one of them.

Scarcity ratio on the reference line below: 79 usable minutes against 109 minutes of
everything the player would want to do on those nights = **0.72**. Below 1 by design; the
pillar is that you cannot fund all five sinks.

| Threshold | Value inside the budget | Arithmetic |
|---|---|---|
| Felix's day is freed | Firing ≥ 2 at dawn | Start 0, burn 1/day. Carry on nights 1 and 2 → 1 at dawn 2 (Felix goes, +1, burn 1 → 1), 2 at dawn 3 → free. **One load a night from night 2 onward holds him at home.** |
| Household enters visible want | Store ≤ 2 | Start 6, winter net −1/day → dawn 2: 5, dawn 3: 4, dawn 4: 3, **dawn 5: 2**. Unavoidable; the winter is not survivable by chores alone. What the player controls is what happens after the thaw |
| Household recovers | Store 3 at dawn 6 | Thaw day 5 with Felix free: +1 → 3. Every subsequent free day +1; every day Felix walks to the wood, +0 |
| Household leaves for want | Store 0 at three consecutive dawns | Pure theft (4 takes, no carries): 6 → 4 → 2 → 1 → 0 (dawn 5) → 0 (dawn 6) → 0 (dawn 7) → **family gone at dawn 7, before any walk.** Theft is affordable at 2 takes, fatal at 4 |
| The long walk (5 slots, day 8) | Store 3 at dawn 6 | Requires carries on nights 1–4 and no takes: 6 → 5 → 4 → 3 → 2 at dawn 5, then thaw day 5 with Felix free → **3.** This is the ceiling; see the correction below |
| The short walk (3 slots, day 8) | Store 2 at dawn 6 | Any line with no carries: the four winter days take Store to 2 and a thaw day without Felix free adds nothing |
| The errand (2 slots, day 9) | Store ≤ 1 at dawn 6 | Any line with ≥ 1 take on top of no carries |
| Vocabulary for the deepest exchange | Words ≥ 80 by the walk | Reference line: listening 14 (capped at 16) + lessons on nights 4, 5, 6, 7 = 20+16+16+16 = 68 → **82** |
| Vocabulary to notice the walk without cost | Words ≥ 44 | Listening 14 + lesson 1 (20) + lesson 2 (16) = 50 by dawn 6 |
| Journal decipherable | Words ≥ 62 and 4 spare minutes | Reference line crosses 62 after night 6 (cumulative 2, 6, 14, 34, 50, 66, 82) and holds **3** spare minutes across the whole run — one short of the four the journal costs. Reading it therefore means dropping a listen or a water draw, which costs either the 80-word gate or a cone-free dawn. **The journal costs the fifth exchange.** This is the intended sacrifice, not an oversight |

**Correction recorded here rather than buried.** Two earlier drafts of this gate were wrong and
the reasoning is kept so the next person does not restore them.

*First draft:* a six-slot walk at Store ≥ 5. Unreachable — the winter is four days of forced
decline from a start of 6, so Store is 2 at dawn 5 on every line, and the thaw supplies at most
one surplus day before dawn 6. Store cannot exceed 3 at dawn 6, ever.

*Second draft:* discriminate the long walk from the short one by **Garden ≥ 1**. This is not a
second condition at all: Garden ≥ 1 requires Felix free on thaw day 5, which requires Firing ≥ 2
at dawn 5, which requires carries on nights 1–4 — exactly what puts Store at 3. The two tests
fire and fail together, so the table had four rows and three reachable states, and the "choice"
between them was not a choice. A gate whose two conditions are the same condition is a defect,
not depth.

**Final table.** One signal, three reachable bands, and the walk is always on day 8 unless the
household is too poor to undertake it at all:

| Store at dawn of day 6 | The walk | Slots |
|---|---|---|
| 3 | day 8, a long country walk to the far village | 5 |
| 2 | day 8, a shorter walk | 3 |
| ≤ 1 | day 9, an errand only; Agatha stays in the yard | 2 |
| 0 at three consecutive dawns | none — they are already gone for want | run ends without a door |

Because the walk is on day 8 in the two healthy bands, **nights 1–7 are played** and four
lessons are available in every run that keeps the family. This is deliberate: the slice's length
does not swing with playstyle, so the provider and the student play runs of the same duration and
differ in what they have at the end, not in how long they got. The errand band is the one
exception — it adds night 8 — and it is a failure state the player caused.

The ceiling is therefore: 5 slots, four lessons, and exchange 5 — the novel's own scene, cut off
mid-exchange as it is in chapter 15, though the novel's collapse comes on its eleventh turn and
this one comes on the sixth (section 17). It requires Store 3 **and** Words ≥ 80, and the
reference line below shows those two demands very nearly do not fit in the same run.

### Reference line, night by night (the pass-line path)

| Night | Base | Firing penalty | Usable | Spend | Words |
|---|---|---|---|---|---|
| 1 | 14 | 0 | 14 | forage 3, carry 4, path 3, water 2, listen 2 | +2 |
| 2 | 14 | 0 | 14 | carry 4, path 3, water 2, listen 2, listen 2 | +4 |
| 3 | 13 | −1 | 12 | forage 3, carry 4, listen 2, listen 2 (Felix read aloud, doubled) | +8 |
| 4 | 12 | −1 | 11 | lesson 5, carry 4, water 2 | +20 |
| 5 | 11 | −1 | 10 | lesson 5, forage 3, water 2 | +16 |
| 6 | 10 | 0 | 10 | lesson 5, carry 4 (1 spare) | +16 |
| 7 | 9 | −1 | 8 | lesson 5, forage 3 | +16 |

Usable total 79; spend 76; **slack 3 minutes across the whole run.** Words 82 against a gate of
80. **Five loads carried** (nights 1, 2, 3, 4 and 6), so the fifth exchange is unlocked — it
needs one carry, not five.

Firing, computed under the ordering convention of section 6.3 and traced at every dawn:

| | dawn 1 | dawn 2 | dawn 3 | dawn 4 | dawn 5 | dawn 6 | dawn 7 | dawn 8 |
|---|---|---|---|---|---|---|---|---|
| **Firing** | 0 | 1 | 2 | 2 | 2 | 1 | 2 | 1 |
| Felix's day | wood | wood | free | free | free | wood | free | — |
| **Store** | 6 | 5 | 4 | 3 | 2 | **3** | 3 | 4 |

Store 3 at dawn 6 → the day-8 walk at 5 slots → **exchange 5, cut off in the middle of the
next one.**

**What the pile can and cannot tell you.** The pile at the door is Firing exactly — one engraved
course of log-ends per point, 0 to 4 — and it is a **dawn** read, where it moves: 0, 1, 2, 2, 2,
1, 2, 1 across this run. At **dusk** it is nearly flat by construction, because the day's burn
cancels the night's carry: 0, 1, 1, 1, 1, 1, 1. So the pile alone cannot distinguish this line
from a much worse one at the moment the player is deciding, and the design does not pretend it
can. The dusk read that carries the information is **the tools on the nail** — present means
Felix stayed home today, gone means he walked to the wood — which is the direct, visible
consequence of Firing ≥ 2 at that dawn. Pile for the level, tools for the trend; the build must
ship both or pillar 2 has no channel.

**Store's only channel is the board.** Store maps to the plate count and to nothing else:

| Store | On the board through the chink |
|---|---|
| ≥ 5 | four plates |
| 3–4 | three plates |
| ≤ 2 | two plates, and the two-plate scene fires |

Safie's presence is carried on the figure layer, where she already lives, not by the plate count.
A take is a **one-morning override**: the dawn after any take shows one fewer plate than Store
alone would give, for that dawn only. Three signals on one object was an earlier draft and it
made the board unreadable.

Two things about this line are worth stating plainly, because they are the design's answer to
"is the best case reachable but expensive":

- It clears the exchange-5 gate by **2 words** and closes the budget with **3 spare minutes out
  of 79** — a 3.8% margin. Spend those three minutes on anything else, including the four
  minutes the journal costs, and the fifth exchange is gone.
- It is **not** the most generous line, and generosity past this point is actively punished. Add
  a carry on night 5: night 5 has 10 usable minutes and already spends all ten on lesson, forage
  and water, so the carry can only come out of the lesson. Store at dawn 6 does **not** move —
  day 5's freedom was already decided by Firing at dawn 5, which night 5's carry is too late to
  affect — so the walk band is unchanged at 3, and the run simply loses 16 words, finishing at 66
  and exchange 3. The extra load changes nothing for the family and costs two exchanges. Nothing
  warns you, because the household cannot tell the difference and there is no interface that
  could.

Order matters inside a night: on nights 3, 5 and 7 the creature's own food reaches 0 at dusk,
so the forage must come **before** the carry or the carry costs 5 minutes instead of 4 and the
night no longer closes. Eating before you work is a real micro-decision and it is not signposted.

---

## 8. Decision-depth example

**Situation: night 6, minute 0.** Base 10, Firing 1 at dawn 6 so no penalty, 10 minutes usable.
The lesson window is live (minutes 0–5). The near wood is the only safe ground during that
window, so **lesson and wood carry are mutually exclusive tonight.**

Five available action sets, and what each costs and yields:

| # | Action set | Minutes | Words | Firing | Own food | Store |
|---|---|---|---|---|---|---|
| 1 | Lesson (5) + water (2) + listen (2) | 9 | +17 | — | — | — |
| 2 | Lesson (5) + take (1) + listen (2) | 8 | +17 | — | +6 | −1 |
| 3 | Carry (4) + forage (3) + water (2) | 9 | — | +1 | +6 | — |
| 4 | Carry (4) + take (1) + listen (2) + water (2) | 9 | +1 | +1 | +6 | −1 |
| 5 | Listen all night (10) | 10 | +5 | — | — | — |

Both state dimensions are readable in the world, not on a HUD: **Firing** is the height of the
pile at the cottage door; **Words** is the count of scratches on the plank.

| State (both player-readable) | Best set | Why it flips |
|---|---|---|
| Pile at the door is two loads high (Firing 2), scratches short of the third gate (Words 66) | **1** | Felix is already free; the marginal load buys nothing this week. +16 crosses 72 and buys the fourth exchange |
| **Pile at the door is empty (Firing 0)**, same Words 66 | **3** | A second empty dawn pushes unease to 3, and at unease 3 the walk slips and loses two slots. Words are worthless if the way in closes. **This is the flip: the best action changes on a variable that has nothing to do with the reward the lesson pays** |
| Pile two high, Words 66, **and your straw is bare (Own food 0)** | **2** | The carry would cost 5 minutes and no longer fits behind the lesson; the take costs 1 and fits. It costs the household one day's food, which will show as one fewer plate — and set 2 is still better than starving into a slower night |
| Pile empty, Words 84 (all door gates met) | **3** | Every remaining word is dead weight. The only axis still moving is the household's condition, which sets the walk |
| Unease already at 2 (a taper burns all night) | **1** | Felix wakes at 55% of the night and the yard is under a cone for two minutes; a carry begun at minute 5 lands inside it. Sitting through the lesson is both safe and productive |

No set wins across more than 40% of these states. Set 5 never wins and is present as the
obvious-but-wrong option a first-time player will reach for.

---

## 9. Genre-fidelity go/no-go

| Question | Verdict | Implementation-verifiable evidence |
|---|---|---|
| ① Is the world also using the core system against the player? | **go** | Cottager routines and cone schedules are functions of the previous dawn's state, not a fixed loop: at Firing ≥ 2 the household retires later and the night is one minute shorter; at unease 2 Felix wakes at 55% of the night and walks a cone across the yard; at Store ≤ 2 Agatha rises before dawn and adds a circuit; drawing the water removes her dawn circuit entirely. Verify by running two nights with identical player input and only Firing differing (1 vs 2) and asserting the cone schedules differ |
| ② Does every non-tutorial beat contain a real choice? | **go** | From night 4 onward the lesson window and the far map occupy the same minutes, so no action set funds both vocabulary and fuel on any night of 10 minutes or fewer. Verify by asserting that no single repeated nightly script simultaneously maximises Words and Store across nights 4–7 |
| ③ Does the signature fantasy live on a repeatable core verb? | **go** | The fantasy — invisible provision — is performed by the carry, repeated 0–7 times per run, and the carry is the only thing in the game that raises Firing. No cutscene, item or dialogue produces it. Verify by asserting Firing never changes on a frame in which the player is not carrying or Felix is not returning from the wood |
| ④ Does the headline system offer non-dominated options? | **go** | Provider-forward maximises the household and is capped at exchange 3 by vocabulary; Student maximises vocabulary and is capped at exchange 3 by slots and locked out of exchange 5 entirely (see below); the balanced line reaches exchange 5. Verify with the three baseline scripts on one seed |

On the exchange-5 lock: the fifth exchange is the creature saying *"I have, unknown to them,
been for many months in the habits of daily kindness towards them"* (chapter 15). It is
unavailable at any vocabulary if the player never carried a load. The game will not let him
say it if it is not true. That is the mechanism by which the third pillar is enforced at the
one moment the player cares about.

---

## 10. Level pacing

### Beat 1 — Teach (nights 1–2)

**Cold open / first 60 seconds.**

| Time | On screen | Player |
|---|---|---|
| 0:00 | Black, then one ragged aperture: a whitewashed room, very bare, a small fire, an old man with his head on his hands, a girl sewing at his feet (chapter 11). No HUD. One prompt, four words, at the bottom edge | **Holds to keep watching — the first meaningful action, at second 0** |
| 0:06 | The old man takes up the guitar | holds |
| 0:14 | The young man comes back **bearing a load of wood on his shoulders**, and the girl meets him at the door and helps him off with it (chapter 11) | **holds — the game's only verb, demonstrated once, by the man whose day you are about to free** |
| 0:18 | The taper goes out. The view pulls back into a top-down plan: the hovel, a wall of loose planks, the yard beyond | movement enabled |
| 0:22 | — | Removes a plank and steps out. **The moon arc appears in the corner — the first and only permanent HUD element, revealed by need** |
| 0:26 | The yard. Moonlight. A load of cut wood lying by the outhouse where Felix left it | Picks it up |
| 0:26–0:58 | The carry. Agatha's cone is drawn, moving, on the milk-house path | Routes behind the woodpile |
| 1:05 | First light. Forced back inside | — |
| 1:12 | The chink lights. **Agatha opens the door and stops with her hand still on the latch.** She says something. Felix comes and looks. He does not take his tools out that day | Watches |

Nothing has been explained. No term has been defined. The rule was taught by a woman stopping
in a doorway.

Known by the end of beat 1: the chink, the yard, the carry, dawn as a deadline, that some people
have cones and one does not.

### Beat 2 — Variation (nights 3–4)

New pressure: **Safie arrives before night 4 — veiled, on horseback, with a guide** (chapter 13
for all three details; in the novel she arrives in daylight, on a rest day, mid-guitar, and this
design moves the arrival to the dusk the player can watch). The lesson window opens — a new sink
taking half of a shrinking night. On the
first lesson the chink glows amber and, if the player watches even one minute, a word rises out
of the frame and lodges as a scratch on the plank. The currency is seen being minted.

**Mechanical cost of ignoring it:** vocabulary stalls. Below 44 words the player will not
understand the walk being planned and loses a slot at the door; below 40 they cannot say
anything at all when they get there. This is not narrated. The plank simply stops filling.

Also introduced: the night shortens for the first time (chapter 13), and Felix, freed, reads
aloud in the evening — which doubles what listening is worth on frost nights.

### Beat 3 — Combination (nights 5–6)

The thaw. Snow gone from the path, so the path chore disappears and only the water remains.
The garden opens — but only Felix works it, and only on days he is free. Now Firing, Store and Words are one coupled problem: keeping Felix home buys their recovery, costs you a
night-minute, lengthens the lesson, and moves which walk you are going to get.

**Signature moment: the dawn-5 chink view.** A fire built high, **two** plates on the board, and
outside in the same frame the pile at the door two courses deep. Identity, action and world in
one still — and the still is not a reward.

An earlier draft asked for four plates *and* a high fire together. That frame cannot occur: four
plates needs Store ≥ 5, which happens only at dawns 1 and 2, and a high fire needs Firing ≥ 2,
which starts at dawn 3. The traces in section 7 never intersect. **The frame does not exist by
construction, and that is the design working, not a gap in it** — the winter takes the table
whatever you do, and the only place your four nights of carrying can show is the hearth. The
beds arrive at dawn 6, by which time the fire has gone small again. There is no dawn on which
everything is good at once.

**Optional synergy available here:** the pig (section 6.4).

### Beat 4 — Test (night 7, and the walk)

Nine base minutes, one penalty, eight usable. Almost nothing fits. Prompts stop entirely. The
player must (a) hear the walk being planned and know what it means, (b) have kept unease at or
below 2, and (c) have already decided, back on nights 1–4, which walk they were building — the
band was fixed at dawn 6 and night 7 cannot change it. Night 7 is therefore the one night with
no strategic decision left in it, only execution: the last lesson, and getting home.

Tension targets for this beat are in section 10.1.

### Beat 5 — Fate (the door, and after)

The three go out. The servants are at a neighbouring fair. The old man is alone at his own
desire (chapter 15).

The entry is real-time and spatial, not a menu. Crossing the yard in daylight is the only
daylight the game contains. Knocking within the first 15 seconds costs one slot to De Lacey's
wariness at a stranger arriving the instant his children left; waiting costs one slot per 30
seconds. The exchanges run in the text's order and are gated as in section 6.2. Whatever
exchange is in progress when the walk ends, the door opens.

Then Felix, and the stick, and the creature's hand opening and lowering (chapter 15). At the
next dawn, from the hovel, the lane: Felix and another man. **The other man does the asking** —
whether Felix has considered that he will be obliged to pay three months' rent and to lose the
produce of his garden, and that he should take some days to consider. Felix answers "take
possession of your tenement and let me fly from this place" (chapter 16). The cottage is dark
for a whole day.

**The last input in the game is the first verb the game taught.** Chapter 16: he waits "with
forced impatience until the moon had sunk" before he lights the branch. The player holds
position and watches the moon arc complete, exactly as they held to watch through the chink in
second zero. Then the screen goes to the fire's light.

### 10.1 Measurable tension targets

Every target is bound to an explicit baseline script and the fixed seed `hovel-01`, and every
interval is declared here, before anyone runs it.

**The scripts.**

- **A — The Provider.** Every night: forage if the straw is bare, then carry, then path (while
  snow lies), then water, then listen with anything left. Never attends a lesson. Never takes
  from the store. Attempts the entry whenever the household leaves.
- **B — The Student.** Never carries, never clears the path, never draws water. Forages
  honestly. Attends every lesson in full. Listens at the chink with every remaining minute.
- **C — Mixed.** Runs A on odd nights and B on even nights.
- **D — The Blunderer.** Walks a fixed circuit through the yard with no regard for cones,
  never attends a lesson, never carries.

| # | Target | Declared interval | Script(s) | Settles |
|---|---|---|---|---|
| **T1** | **Two materially different playstyles must produce observably different endings.** | On `hovel-01`, A and B must differ on **at least 4 of 5** recorded end-state fields (exchange reached, De Lacey's closing line, what the creature carries away, the household's condition at flight, how many slots the walk ran). Specifically: **A reaches exchange 0** — 14 words, below the 40-word gate, so he is admitted, sits, and cannot answer — with Store 5, three turned beds and a 5-slot walk; **B reaches exchange 3** with ~99 words, Store 2, no turned beds and a 3-slot walk, and is locked out of exchange 5 for having carried nothing. Both figures are computed in this document, not guessed: A spends every night on chores and banks listening minutes only when the chore list is short, B never carries so takes no Firing night-penalty and plays seven full-length nights. If both reach the same exchange, or the epilogue's household line is word-identical, the fixed ending is reading as fated and pillar 3 has failed | A vs B | **Risk 1** |
| **T2** | Neither axis may be won for free | Words(A) ≤ 0.20 × Words(B) — predicted A ≤ 16, B ≥ 96 — **and** Store(B) at flight ≤ 0.40 × Store(A) — predicted B ≤ 2, A ≥ 5. Neither script may lead on both | A vs B | pillar 3 |
| **T3** | The half-competent player lands between | C's Words **and** C's Store at flight must both lie strictly between A's and B's. Predicted Words 60–72, Store 3–4, exchange 2–3 | C | non-monotonicity is a bug |
| **T4** | No dead end, and the cones are live | All four scripts must terminate in an ending on 5 seeds. **D must be sighted on at least 4 of 5 seeds**, and each sighting must end the run within one second with the seen-ending | A, B, C, D | pillar 1 |
| **T5** | The optional synergy is real | A script that attempts the wood carry inside the retiring window **without** driving the pig must abort or be sighted on ≥ 3 of nights 4–7. The same script **with** the pig drive must complete it on ≥ 3 of those 4 nights | two variants of C | emergence, not decoration |
| **T6a** | The household's schedule is a function of what you did, not a fixed loop | Run the reference line twice on `hovel-01`, identical except that the second clips the outer band on nights 1, 2 and 3 (unease reaches 3 and latches). The second run must show **an extra yard pass on night 2, a taper burning all night from night 3, and Felix at the window on night 4**. These three are the assertion; they are schedule changes with no other possible cause | reference line, ±unease | go/no-go ① |
| **T6b** | The consequence outlives the cause | In the same second run the walk must slip from day 8 to **day 9 and run 3 slots instead of 5**, even though unease has decayed back to 1 by dawn 6 — that is the latch. Assert on **slots**, not on the exchange: the slipped run plays night 8, banks a fourth-and-a-half lesson, and finishes with **98 words against the reference line's 82**. Vocabulary goes *up* and the ending still drops to exchange 3, because 3 slots cap it. An assertion phrased on the exchange alone cannot tell the latch from the cap and proves nothing | reference line, ±unease | go/no-go ① |
| **T7** | The best case is reachable and expensive | The balanced line (section 7) must reach exchange 5 with total slack ≤ 5 night-minutes across the run. If slack exceeds 5, the budget is loose and the third pillar is not being enforced | scripted balanced line | numeric method |

Targets are asserted against the finished engine's own constants, recomputed from this document
rather than read out of the implementation. First-time failure rate and "is it fun" are not
assertable and are left to human playtest.

---

## 11. First-screen focus and disclosure state

First frame contains exactly one thing: **the chink.** No HUD, no title card over the image,
no menu behind it.

| Element | Initial state | Reveal trigger |
|---|---|---|
| The chink frame | the only thing on screen | frame 1 |
| Top-down plan of the holding | absent | the taper goes out, ~18 s |
| Moon arc (night clock) | hidden | first step outside the hovel. **Permanent thereafter — this is the game's declared stake and is exempt from the overload rule** |
| Vision cones | not drawn | drawn per-cottager whenever that cottager is awake; first seen at the retiring window of night 1 |
| Word tally (scratches on a plank) | hidden | the first word learned |
| Your gathered food (heap on the straw) | hidden while zero | first forage |
| The pool | on the plan, unremarked | standing on it under moonlight fires the reflection once (chapter 12). Ambient only — it writes nothing to persistent state and is degradable |
| The journal of the four months | a bundle on the straw, not interactable | Words ≥ 62 |
| The three books | absent | the portmanteau is found at the near wood's edge (chapter 15) |
| Advance notice of the walk | none | Words ≥ 44, on the night before |

No panel is collapsible because there are no panels. The household's condition has no interface
element of any kind, at any time — it is read from plates, fire, pile, beds, taper and stick.

---

## 12. Feedback and failure

**Every core verb closes inside one beat.** Pick up a load and the creature's silhouette changes
shape and the walk slows audibly; put it down at the door and the pile grows by a visible course
of wood; listen at the chink and a scratch is added to the plank as the word is heard, not after.

**Being seen.** The cone whitens. The creature's own shadow falls across the person who saw him.
The frame holds for two seconds with no UI. Then the epilogue begins. There is no retry button
on that frame; the run plays out to its ending and restart is offered afterward.

**What failure tells you.** The card names what happened in the world's terms and what could be
different, without naming a system:

> Agatha came out for the pail at first light. The water had not been drawn.

> Felix woke and went to the door. A taper had been burning in that room for two nights.

> You were still in the garden when the sky went grey. The beds hold a print the length of a
> forearm.

**Recoverable failure.** Clipping an outer band, dropping a load, or being caught outside at
first light without being in a line of sight costs a night, not the run: unease rises, the
household's routine hardens, and the way in gets later. Unease decays by one per incident-free
night, so recovery is possible and is paid for in whole nights.

**No dead end.** Every state reachable inside a run has an ending. A household that leaves for
want ends the run without a door; a run in which the player never understands a word ends at a
door in silence; a run in which the player is seen ends at once. All four are endings, none is
a soft lock.

---

## 13. Social presence assumptions

Single-player, offline, no accounts, no leaderboards, no multiplayer — in the slice and in the
intended product. Social presence lives entirely in shareable moments, and all of the following
are unverified assumptions listed for later human playtest:

- The most likely screenshot is **the dawn after the first carry**: a woman stopped in a doorway
  with her hand on the latch, and a pile of wood. Assumption: it reads without a caption.
- The most likely thing said out loud is **"I fed them all winter and when I finally got to
  speak to him I had nothing to say."** Assumption: this is more repeatable than any number.
- The most likely argument between two players is **whether to steal**, because the cost is
  visible on the table the next morning and the saving is exactly two minutes.
- No achievements, no share button, no run codes. If human playtest shows players screenshotting
  the chink unprompted, exporting the framed chink view becomes a next-version item, not this one.

---

## 14. Playtest question, scope, non-goals, acceptance, and minimum play-through

### The one playtest question

The largest design assumption is **that the household's improvement is legible through the chink
with no meter of any kind.** If it is not, the loop degrades into fetch quests with cones.

Minimum playable segment to test it: nights 1–4 only, two builds on the same seed — one in which
the script carries every night, one in which it carries nothing. Unguided player, no explanation.

Observation, not opinion: at the dawn of night 4, ask the player to describe the room. Record
whether they name a difference (fire, plates, Felix indoors, the pile) without being prompted,
and whether they can say what it cost them. **Trigger for change:** if fewer than half name a
difference, the fix is to widen the room's visible deltas — a fourth plate, a taller fire, Felix
at the table instead of absent — and never to add a readout.

Second question, from the concept stage: does a first-time player work out that the old man is
approachable, and then plan an entry out of an observed routine, rather than knocking on night 1
and treating refusal as a retry? Logged: time of first approach to the door, whether a lesson was
attended first, whether the player ever tries a second approach after being seen.

### Non-goals

Combat, weapons, a kill verb, any resolvable fight. Gore. Daylight play, except the single entry.
Menus as a primary input. Meta-progression, unlocks, currency, saves. A pause, slow-motion or
plan mode. An affection, trust, suspicion or reputation meter. Any household state displayed as
a number or bar. Victor as an on-screen character. Geneva, William, Justine, the framing of an
innocent, the vivisection. The burning of the cottage as anything but a held wait and a light.
Giving the creature a name. Calling the creature "Frankenstein". Localisation in this slice.

### Acceptance

- First meaningful action inside 3 seconds; first movement inside 20; first world response
  (Agatha in the doorway) inside 90.
- Core mechanic cannot be ignored: there is no path to any door exchange that does not pass
  through the cone system.
- Levels escalate by new information and new combination, not by more of the same: night 4 adds
  a sink, night 5 changes the map's chores and opens the household's feedback, night 7 removes
  prompts.
- Deleting either supporting system leaves a coherent stealth loop; deleting the core leaves
  nothing.
- The decision-depth table's flip holds against the finished engine, and no action set wins in
  more than 60% of the sampled states.
- All four genre-fidelity rows are **go** with the stated evidence reproducible.
- All eight tension targets measured and inside their declared intervals.
- The simulation contains no random draw, and advances on a fixed 60 Hz tick: identical
  tick-indexed input reproduces identical state at every tick. Rendering is not asserted frame
  by frame.
- Traversal totals for a scripted run fall within ±10% of section 6.5's designed routes;
  outside that band the script is measuring its own routing, not the rule.
- The household's condition appears nowhere as a number, bar, icon or floating text.
- At least three persistent player choices are read back in later player-visible text
  (section 15).

### Minimum play-through verification path

Title → chink cold open → first carry → dawn, Agatha in the doorway → nights 2–3, path and water,
Felix freed and reading aloud → night 4, Safie arrives, first lesson, the plank fills → night 5,
the thaw, the beds turned → night 6, the walk planned in the room and understood → the walk on
day 8 → the door, the exchanges the run earned → Felix, the stick, the withheld hand → the
next dawn, the lane, the landlord → the dark cottage → the wait for the moon to set → the fire →
restart from night 1 with nothing carried over.

---

## 15. Character content tiers and the upgrade gate

| Tier | Character | Minimum delivered | Narrative echo written to persistent state and read back |
|---|---|---|---|
| **Core route** | **Old De Lacey** | Multi-stage relationship built entirely without contact: the guitar heard through the wall (chapter 11), the evening reading, the six exchanges at the door, and his closing line. His own want is his own: "it will afford me true pleasure to be in any way serviceable to a human creature" (chapter 15). What happens after the door is **the creature's inference, not a reported scene** — "It was apparent that my conversation had interested the father in my behalf" (chapter 16) — and the epilogue states it as an inference | The fifth exchange exists only if the player carried wood; his closing line differs depending on whether he was told anything true before Felix opened the door |
| **Support line** | **Felix** | Want: the household intact and his father safe (chapter 15, chapter 16). One consequential player choice: whether to free his day. Persistent attitude via unease. Downstream echo: his line to the landlord at the end | If unease ever reached 3, his line to the landlord names the nights he sat up |
| **Support line** | **Agatha** | Want: the old man fed before herself — a habit the novel gives to **both** younger cottagers ("several times they placed food before the old man when they reserved none for themselves", chapter 12); staging it as hers alone is this design's. Her astonishment at the wood is the game's first reward; her dawn circuit is removed by the drawn water; she is the hand that sets the board | The morning after any take, one fewer plate. If takes ≥ 3, the flight line says they went with nothing put by |
| **Support line** | **Safie** | Want: the language (chapter 13). She *is* the lesson: her repetitions are the words the player banks | If the player attended fewer than two lessons, the epilogue's line about what he could say is the shortest variant |
| **Ambience** | The pig, the cow, the landlord's man, the two countrymen in the lane (chapter 16) | Identity, position, one recognisable reaction each | — |

**Upgrade gate.** No support line is promoted to a core route without playtest evidence that
players are attending to it. Specifically, Safie will not receive her own approach channel and
Felix will not receive a reconciliation branch on the strength of designer enthusiasm; the
promotion condition is that unguided players spend measurable night-minutes on that character's
window when a cheaper option exists.

**Narrative echoes** (four, against a required three):

1. **Labour** → the fifth exchange at the door, and De Lacey's answer to it.
2. **Theft** → the plate count at every subsequent dawn, and the flight line.
3. **The journal of the four months** → read or unread changes the epilogue's closing line and
   whether the creature leaves with a destination at all (chapter 16: "You had mentioned Geneva").
4. **Unease** → De Lacey asks "Who is there?" twice, warily, and Felix's line to the landlord
   changes.

A fifth echo — the pool, and the creature's own account of his face (chapter 12) — was cut. It
is the one whose trigger a player may never hit, so it bought the least, and its plate is the
hardest image in the set. The journal echo was proposed for cutting alongside it and is kept
instead: it is load-bearing, because section 7 makes reading the journal the sacrifice that
costs the fifth exchange, and an echo-less journal would be pure cost with no payoff.

Two players who spend identical night-minutes and make opposite ethical choices must not reach a
word-identical ending. That is asserted by T1.

---

## 16. Audience, culture, language scope, copy voice, and the anti-slop standard

**Audience.** Mid-core Western players who already buy stealth and systemic indies. Decision
density is moderate and continuous, never menu-dense. Onboarding is by consequence and short
diegetic prompts; the game contains no tutorial screen, no glossary and no lore quiz. Period
vocabulary from the text — *the hovel*, *the cottage*, *the chink*, *firing*, *the milk-house*,
*the sty*, *the three books*, *the journal of the four months* — is retained and explained by
consequence on first use, never glossed.

**Language scope.** English only at launch, LTR, Western market. No localisation in this slice,
and no string is written assuming one. No player-visible string exceeds 90 characters except the
six door exchanges and the epilogue's three lines.

**Register.** The creature is the viewpoint, and his register in the novel is formal, precise and
self-accusing — he states his own case against himself as fact and does not plead in his own
narration. All player-visible prose follows him: first person, past tense, sparse, period, no
irony. This is the "restrained and hard" register of the craft table, not a light one, and the
comedy of the nearest benchmark is explicitly not imported.

**Character voice cards** — one line each, recording only what changes actual lines:

| Character | Speaks to do what | Sentence shape | Never |
|---|---|---|---|
| **The creature** (viewpoint; speaks only at the door and in the epilogue) | To be heard out before being judged, which he claims as a right (chapter 10) | Formal, exact, turns every accusation inward; states the worst thing about himself as a fact and moves on | Never jokes, never whines, never uses a modern contraction, never names himself |
| **Old De Lacey** | To be useful to whoever is in front of him, sight unseen | Short, courteous, asks a question then offers before he is asked | Never comments on how anyone looks; never raises his voice |
| **Felix** | To settle the matter and protect his father | Brief, decisive; under fear he gives orders | Never explains himself to a stranger; never says his father's condition aloud in his hearing |
| **Agatha** | Almost never speaks in the player's hearing; her voice is a sound through a wall | When she does speak it is to the old man, and it is about food or the fire | Never addresses the yard, never calls out |
| **Safie** | To learn | Repetition. Her whole voice in the slice is a learner saying the nouns the player is banking | Never speaks a full sentence in English |
| **The landlord's man** | Business | Rent, produce, days to consider (chapter 16) | Never expresses sympathy |

**Anti-AI-slop standard the build stage must follow.** Every player-visible string is checked
against all of it.

1. No "not X, but Y" constructions, in any variant.
2. No omniscient explanation. Cut "little did he know", "which meant that", "the reason was",
   "in that moment he realised". Write only what the creature can see from where he is.
3. No summary or moral at the end of a night, a scene or the run. Close on an action or an
   image; the meaning stays inside the picture.
4. Emotion is externalised into body and object, never named. Not "she was astonished" — she
   stops in the doorway with her hand still on the latch.
5. No stacked description: an action is not written three times as occurrence, perception and
   reaction. One continuous pass.
6. Adverb budget: no more than two `-ly` intensifiers per hundred words of player-visible text.
7. No all-purpose modifier clauses: "with a hint of", "in a voice that brooked no argument",
   "something like relief".
8. No literary tics: "a flicker of", "as if", "seemed to", "a wave of".
9. Dialogue carries subtext, never exposition. No character explains a rule of the game to
   another character, and nobody narrates their own motive.
10. Punctuation is calibrated to the register, not flattened: the em dash is permitted in its
    period parenthetical sense, since this is 1790s prose, and is **not** permitted as a modern
    trailing hesitation beat. Rules 2 and 8 hold regardless of register.

**UI has a temperature.** Buttons are verbs with a stance — *keep watching*, *put it down and
go*, *knock* — never *OK / Cancel / Continue*. Prompts speak in the world's terms: not
"insufficient vocabulary", but nothing at all — the plank is short and the player can see it.

**Numbers never appear in player-visible text.** No "+1 firewood", no "Words: 64", no timer in
digits. The pile at the door is the number. The moon arc is the clock. The scratches are the
vocabulary. If a number appears anywhere on screen in the build, it is a defect against this
section.

---

## 17. Adaptation boundary

Adapting chapters 11–16, from the hovel to the door, to prove the book's own recurring structure:
*observe a party you cannot approach → derive their rules from repeated observation → act for
them invisibly → be seen → lose the whole node, not a fraction of its goodwill.*

- **Immutable.** The creature is wordless at the start and acquires language only by overhearing
  instruction meant for someone else (chapter 12, chapter 13). Every sighted human rejects him on
  sight; the blind man is the only exception and that channel is destroyed by being seen
  (chapter 12, chapter 15, chapter 16). Being seen inside the cottage costs the family the
  tenancy, and the landlord's terms are three months' rent and the produce of the garden
  (chapter 16); that a *single yard sighting* carries the same cost is this design's
  extrapolation, recorded below. Invisible labour is credited to a "good spirit" and to nobody
  (chapter 12). Force is available and is refused (chapter 15). Shelley's description of the creature; never the 1931 make-up; never
  "Frankenstein" as his name.
- **Adaptable.** How long the observation lasts and how many chores are performed (the bible marks
  this adaptable). The season is compressed so that a winter's want, a thaw and Safie's arrival
  fall inside eight night-slots, of which seven are normally played; in the novel these events
  span more than a year (chapter 12 through chapter 15). The shortening night is a **spring**
  phenomenon in the text (chapter 13, after the snow is gone and two months after Safie arrives)
  and this design relocates it into the compressed winter, which also puts Safie before the thaw
  rather than well after it.

  **The largest liberty is not the season — it is the clock.** In the novel the creature's *days*
  are the study time and Safie's instruction is a **daytime** event ("The next morning Felix went
  out to his work, and after the usual occupations of Agatha were finished, the Arabian sat at
  the feet of the old man", chapter 13), while his *nights* are for labour and forage ("When they
  had retired to rest, if there was any moon or the night was star-light, I went into the woods
  and collected my own food and fuel for the cottage", chapter 12). Nothing competes. This design
  moves the lesson into the retiring window, and **that move is what manufactures the night
  budget's scarcity** — the whole basis of pillar 3 and of go/no-go ②. Evening listening at the
  chink is textual (chapter 11); only the lesson is relocated.

  The door scene is **compressed from roughly eleven turn-pairs in chapter 15 to six**, kept in
  the text's order. The French/German pair and the two thanks-turns are the merges; the collapse
  comes on the eleventh turn in the novel and on the sixth here, so the cut-off point is this
  design's, not the chapter's. Their word gates (40/52/62/72/80) and the slot economy around
  them are wholly invented.
- **Open — declared inventions, so a later pass cannot re-derive them.**
  - **Unease, entire.** No chapter supports it. What the novel actually records as the
    household's reaction to months of unexplained night activity is the **inverse**: Felix "found
    his store always replenished by an invisible hand" to his "**perpetual astonishment**"
    (chapter 12), and they "utter the words *good spirit, wonderful*". Nobody sits up, nobody
    leaves a taper burning, nobody hardens a routine, nobody postpones anything. The 0–3 ladder
    with decay is stealth-genre furniture and is kept because the game needs a recoverable
    failure, not because the book has one.
  - **The night-minute tax on a warm household.** Nothing ties their bedtime to their fuel; on
    the poorest night in the book they simply "extinguished their lights and retired"
    (chapter 11). It exists to stop carrying from being free.
  - **The generalisation of the sighting.** Chapter 16 supports flight after the creature was
    seen *inside the cottage, clinging to De Lacey's knees*, and Felix's stated reason is his
    father's danger and his wife's and sister's horror. The novel's other sightings delete
    nothing — the shepherd flees his own hut (chapter 11) and the village drives him off with
    stones, and both stay put. Extending it to any sighting by any sighted cottager on any night
    is this design's decision.
  - **De Lacey's later advocacy.** The novel gives only the creature's own inference — "It was
    apparent that my conversation had interested the father in my behalf" (chapter 16). There is
    no reported argument, and section 15 uses the inference instead.
  - **The pig.** Chapter 11 supplies a **sty** ("surrounded on the sides which were exposed by a
    pig sty and a clear pool of water"), not an animal. No pig appears anywhere in the novel. The
    animal and the distraction it enables are both invented. The cow is textual (chapter 12).
  - **All numbers.** The one figure the text supplies is *not* the anchor an earlier draft took
    it for. The full sentence is: "**The stranger** learned about twenty words at the first
    lesson; **most of them, indeed, were those which I had before understood**, but I profited by
    the others" (chapter 13). Twenty is **Safie's gross yield**; the creature's own gain from
    lesson 1 is explicitly a minority remainder. This design's +20 at lesson 1 takes the
    learner's number and gives it to the eavesdropper — a deliberate and now-labelled invention,
    kept because the first lesson should feel like the currency being minted. Everything else in
    section 7 is invented and labelled as such.

The novel is public domain; the visual language is rebuilt from the 1831 text and from
period-appropriate public-domain research only, never from any film.
