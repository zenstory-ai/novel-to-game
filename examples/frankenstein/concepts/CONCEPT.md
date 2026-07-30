# Game Concept · *Frankenstein* — **The Hovel**

Inputs: `analysis/SOURCE_BIBLE.md` and `PRODUCT_BRIEF.md`. Every claim about the novel is
cited by chapter (1831 revised edition, Project Gutenberg #84). Product frame inherited from
the brief and not re-argued here; the one dimension the brief deliberately left to this
stage — the specific genre — is closed at the end of this document and written back.

## 1. Product definition

| Item | Decision |
|---|---|
| Primary genre | Real-time top-down stealth ("stealth strategy" / vision-cone lane) |
| Subtype | Non-violent social stealth around a single household; no combat verb exists |
| Player identity | The creature, chapters 11–16 — wordless at the start (chapter 5), rejected on sight by every sighted human (chapter 11), able to learn language only by overhearing lessons meant for someone else (chapter 13) |
| View / presentation | Top-down plan of the cottage, garden, wood and chore circuit at night, plus one framed interior view through the chink in the boarded window (chapter 11) |
| Primary input | Direct spatial movement and carrying, mouse-primary with keyboard alternative — **not** menu selection |
| Time model | Continuous night clock; days are skipped in the hovel because the creature sleeps while the cottagers are dispersed (chapter 12) |
| Platform | Web, desktop landscape ≥ 1280×800, single-player, no backend |
| Source cultural context | English Romantic-era novel set in 1790s Switzerland, Germany and France; the cottage is a French exile household in Germany (chapter 14) |
| Target market | Western (US / UK / EU), English interface |
| Target player | Mid-core Western players who already buy stealth and systemic indies; readable without having read Shelley |
| Session | 20–30 minutes: eight playable nights + one daytime entry attempt + epilogue |
| Explicit non-genre | Not survival horror, not gothic action, not a visual novel, not a turn-based tactics or resource-management game |

**The pitch.** You are eight feet tall, you have no name and no words, and the first three
people who ever saw you screamed, fainted or threw stones (chapter 11). You live in a hovel
against the wall of a cottage, watching a poor family through a crack in a boarded window.
You cannot meet them. You *can* cut their firewood while they sleep, clear the snow off the
path to the milk-house and draw their water, and let them believe it was a good spirit
(chapter 12). And you can stand at the crack during someone else's language lesson and steal
enough words to say one sentence at their door (chapter 13). The whole game is the arithmetic
of a single winter night — watch, or work, or feed yourself, or learn — spent toward one
irreversible moment: knocking while the blind man is alone (chapter 15).

## 2. Experience pillars

| Pillar | Observable playtest evidence | Failure phenomenon that vetoes it |
|---|---|---|
| **Sight is an auto-fail, and the only person you can talk to is the one who cannot see you.** Anyone with working eyes ends the relationship on sight (chapter 11, chapter 15); old De Lacey is the single documented exception (chapter 12, chapter 15) | An unguided player routes carries behind the woodpile and the wall, breaks off a carry when Agatha turns toward the door, and — without being told — starts treating De Lacey's chair as the destination | The player treats being seen as a recoverable alert: waits it out, returns next night, and the run continues roughly as before. That is generic stealth, not this book |
| **Only invisible work lands. Their winter visibly improves and nobody ever thanks you.** The wood pile, the cleared path and the drawn water are credited to "an invisible hand" and to a "good spirit, wonderful" (chapter 12); benevolence performed in sight gets a musket ball instead (chapter 16) | After three nights the player can point through the chink at what changed — a bigger fire, food on the table, Felix indoors repairing instead of out cutting wood (chapter 12) — and can say what it cost them in that night's minutes | The chink view on night eight looks like night one, or the labour pays out as an affection meter / score popup instead of as a changed household |
| **Every night is one budget across four sinks you cannot all fund.** Observe the household, work for them, forage for yourself, or attend the lesson — and the night itself gets shorter as spring comes (chapter 13) | Two players produce visibly different runs and can each name what they gave up; at the door, one has the words for a request and the other does not | A dominant nightly routine exists that funds everything, or the door scene plays out identically regardless of how many words were bought |

## 3. Benchmark matrix

Web-searched this pass. **Rows marked "recalled, unverified" may not be used as grounds for
a decision.** The two shipped examples in this repo tagged every benchmark row as unverified;
this one does not repeat that.

| Role | Benchmark | Verification status | Proven principle | How it becomes this novel's rule | Explicitly not borrowed |
|---|---|---|---|---|---|
| Core action | *Untitled Goose Game* (House House / Panic, 2019; Win/Mac/Switch, later PS4/XB1) | **Verified** — Wikipedia (mechanics, D.I.C.E. Game of the Year 2019); Forbes / Engadget / VGChartz (1 M+ copies within ~3 months) | An entire, award-winning game can run on nothing but NPC perception and reaction to your presence, with no combat verb at all | The same absence of a combat verb, but inverted in intent: the goose wants to be a nuisance, the creature wants to be admitted. Perception is the only system either game has | Comedy and mischief tone; sandbox to-do lists; the "shooed away and try again" reset; co-op; its flat-vector art |
| World response | *Shadow Tactics: Blades of the Shogun* (Mimimi / Daedalic, 2016; Metacritic 85 across PC/PS4/XB1) | **Verified** — Wikipedia (vision cones, alarms deploying more patrols, scores) | A drawn vision cone as the *complete* information model: the player plans against visible perception rather than against hidden dice | Each cottager carries a drawn cone tied to their scripted routine; De Lacey carries none, which is how a first-time player discovers the blindness rule without being told | Killing, bodies, and the assassin toolkit; a team of specialists with abilities; quicksave-scrubbed set-piece missions; isometric production scale |
| Level structure | *Hitman: World of Assassination* (IO Interactive) | **Partially verified** — mechanics corroborated across multiple guides and press pieces this pass; no first-party design source obtained | NPC routines generate opportunity windows; the skill is reading a routine and waiting for a configuration rather than reacting fast | Chapter 15's entry window is exactly a configuration, not a timer: the three walkers gone on a long walk, the servants at a neighbouring fair, the blind man alone by his own wish. The player must observe it into existence | Disguises, assassination, the sandbox scale, mission stories, and the retry-the-level structure |
| Market context (genre currency) | *Metal Gear Solid Δ: Snake Eater* (Konami, 28 Aug 2025); *Assassin's Creed Shadows* (Ubisoft, Mar 2025) | **Verified** — Konami release plus PC Gamer / Gematsu / Push Square (1 M units within ~a day); multiple outlets (~2.4 M in two months, among 2025's best-selling new releases) | Stealth is a genre Western players are currently buying at scale, not an obscure-but-clever pick | Used only as evidence that the lane has currency in this market | Everything else — budget, scale, tone and every mechanic |
| Counter-example (the obvious lane) | *The Blood of Dawnwalker* (Rebel Wolves / Bandai Namco, 3 Sep 2026) | **Verified** — Wikipedia, Xbox Wire hands-on, publisher site (open-world dark-fantasy action RPG, 14th-century Carpathia) | The gothic-monster action lane is occupied by ex-Witcher-3 budgets | Confirms that "gothic monster action" is the obvious reading and is not winnable by a one-pass web slice | Nothing is borrowed |
| Alternative-lane evidence (direction 2) | *Backpack Battles* (PlayWithFurcifer / IndieArk; early access Mar 2024, 1.0 Jun 2025) | **Verified** — Wikipedia; SteamSpy via search (500 K–1 M owners; ~8.9/10 from ~14.8 K reviews) | Spatial fitting inside a bounded container can carry a whole strategy layer | Cited under direction 2 only, and not adopted | Auto-battler combat, PvP, roguelike economy — none of it survives into the chosen direction |

**Why the chosen direction is not a budget clone of the closest acclaimed game.** The nearest
neighbour is *Untitled Goose Game*: top-down, non-violent, one small settlement, NPCs who
react to being near you. Three differences are structural, not cosmetic. (a) *Direction of
the goal*: the goose's fun is being seen and causing a scene; here being seen is the failure,
and the win condition is to **stop hiding on purpose** — you are sneaking toward disclosure,
not away from it. (b) *Persistence of failure*: the goose is shooed off and the world resets;
here one sighting takes the whole node permanently — "I never saw any of the family of De
Lacey more" (chapter 16) — so the game deletes content rather than lowering a meter. (c) *The
economy underneath*: the goose has no resource; here every night is a real budget split
between the household's winter (chapter 12) and your own vocabulary (chapter 13), and the two
compete. If the answer to this question had been "same loop, sadder theme", the honest move
would have been direction 2; it is not.

## 4. The three directions

All three sit inside the locked frame (web, English, all-ages, single-player, no combat).
They differ on player identity, core verb, time model, pressure source, book segment and
camera — six unlocked dimensions, well past the required three. Directions 1 and 2 sit
outside the menu-driven discrete-turn shape the repo has already shipped twice; direction 3
sits squarely inside it as an honest control.

---

### Direction 1 — **The Hovel** (recommended)

**Genre / subtype.** Real-time top-down stealth, non-violent, single household.

**One-line hook.** Keep a family alive all winter without ever being seen, and spend what is
left of each night stealing the words you will need at their door.

**Player identity and fantasy.** The creature, chapters 11–16. The fantasy is not power; it
is the specific dread of daylight (chapter 13: the nocturnal rambles "considerably shortened
by the late setting and early rising of the sun") and the specific ache of the one channel
that is not sight — "My voice, although harsh, had nothing terrible in it" (chapter 15).

**Core verbs.** Watch through the chink (chapter 11). Move at night and stay out of every
sighted cottager's cone (chapter 11). Carry — firewood to the door, snow off the path to the
milk-house, water from the well (chapter 12). Take or abstain: the household's store is
finite and visible, and stealing from it shows up as their hunger, so the alternative is a
longer forage in the wood (chapter 12). Attend a lesson at the chink and bank vocabulary
(chapter 13). Knock — once, ever (chapter 15).

**Loop.** Night opens → the household's routine plays out on a scripted circuit you can watch
or work around → you spend the night's minutes across four sinks → dawn forces you into the
hovel and the daytime is skipped (chapter 12) → the room you see through the chink next night
reflects what you did. Repeat until you call the entry window.

**Pressure.** Continuous and stacked: the night clock, moonlight as a visibility variable
(chapter 12 has the creature working only when there is "moon or the night was star-light"),
the season shortening the usable night (chapter 13), the family's store draining (chapter 12
names one cow that "gave very little during the winter"), and every sighted cottager's cone.

**The rule conversion that makes this book and not a generic stealth game.** Three rules, all
textual, none of them standard stealth grammar: (i) *judgement runs on two channels and only
one is winnable* — appearance is an instant verdict from anyone sighted, voice is negotiable,
so the entire approach problem is finding the sight-independent channel (chapter 11,
chapter 15); (ii) *exposure deletes the node* — one sighting costs the family three months'
rent, the garden and the tenancy, and they are gone for good (chapter 16); (iii) *good acts
accrue no credit while visible* — invisible labour is credited to a "good spirit"
(chapter 12) and a visible rescue is answered with a musket ball (chapter 16). Delete the
proper nouns and these three rules still produce a game no other stealth game plays.

**The repeatable verb that performs the fantasy.** The nightly circuit itself: *watch, then
carry, under a constraint that forbids ever being seen doing either.* No finisher, no
one-shot item, no cutscene does the work.

**Closest benchmark and the one thing borrowed.** *Shadow Tactics* — the drawn vision cone as
the whole information model. Nothing else from it.

**Signature screen.** The chink: a dark, ragged aperture cut out of the frame, and inside it a
warm whitewashed room — a blind man's head resting on his hands beside a small fire, a girl
sewing at his feet, a guitar taken up (chapter 11). Outside, in the same image, a growing pile
of cut wood at the cottage door (chapter 12). Identity, action and world in one still.

**Minimum verification slice.** Eight nights plus the entry, 20–30 minutes. It must prove:
that a player discovers the blindness rule by observation rather than by being told; that the
household's state change is legible through the chink; and that the four-way night budget
produces visibly different runs. **Not in the slice:** the journey to Geneva, William, Justine,
Victor as a character, the burning of the cottage as a player verb, and any combat.

**Biggest risk.** If invisible labour has no legible effect in the room, the loop degrades
into fetch-quests with cones. Mitigation is a design requirement, not a text fix: the
household's improvement must be *seen*, never reported.

**Replay hook (second run differs observably).** Schedule knowledge persists in the player's
head, so the same night budget buys more vocabulary; the door scene contains lines that only
exist above a vocabulary threshold. Second run, De Lacey hears a different sentence.

**Computability check** (so the numeric stage has something to compute, per
`numeric-design-method.md`): the primary resource is *night minutes* — one source (the length
of the night, shrinking with season), four sinks (observation, labour, forage, lesson).
Read points already exist for every derived stock: vocabulary gates which lines are available
at the door; the household store gates whether the family stays or leaves for want; the
household's alarm level gates cone width and routine changes. No write-only meters are
proposed. Actual numbers belong to `GAME_DESIGN`, not here.

---

### Direction 2 — **Eight Feet**

**Genre / subtype.** Direct-manipulation spatial assembly puzzle under a decay clock — drag,
fit, and commit — with a one-shot reveal.

**Player identity.** Victor, chapters 3–5, with a coda on the Orkney rock (chapter 20).

**Core verb.** Drag a part out of a supply crate and fit it onto an armature. Parts have real
footprints and attachment points; stock comes from three named suppliers and is admitted to
be inadequate before work starts (chapter 4). Because coarse stock will not fit a normal
frame, the only way to make the pieces work together is to enlarge the armature — which is
chapter 4's decision, reached by the player's hands rather than told to them: "As the
minuteness of the parts formed a great hindrance to my speed, I resolved, contrary to my
first intention, to make the being of a gigantic stature."

**Pressure.** Continuous decay on unplaced parts (chapter 4's vaults and charnel-houses), the
candle burning down (chapter 5: "my candle was nearly burnt out"), and a nightly health cost
(chapter 4). The commit is irreversible and the result cannot be previewed: features
"selected as beautiful" become horror only once they move (chapter 5).

**Closest benchmark and the one thing borrowed.** *Backpack Battles* — spatial fitting inside
a bounded container as a real strategy layer. Its combat, PvP and economy are not borrowed.

**Signature screen.** An engraved anatomical plate half-covered by the parts you have actually
placed, a candle stub, and the empty regions your stock cannot fill.

**Why it was not chosen.** Three reasons, in order of weight. (a) *The derivation is thinner
than it looks*: the bible is explicit that per-part provenance and any part→trait table are
**downstream invention** — the text names three supplier types and never itemises a single
part — so the game's most attractive feature would be largely invented, and the pipeline's
whole claim is derivation. (b) *The ethical settlement drifts back to text*: after the fitting
puzzle, the moral weight lands in what the creature reads back from the journal (chapter 15),
which is a reading interface — the exact failure mode this example exists to avoid. (c) *Art
and rating risk*: an all-ages, non-gory depiction of assembling a human body is the hardest
brief in this whole set to hand a generative image model, and the failure mode is either gore
or the forbidden 1931 silhouette.

**What would have made it the pick.** If the audit-and-dismantle coda (chapter 20 — tearing
up the half-finished female while the client watches through the casement, then packing the
remains into a weighted basket) could be shown to carry the ethics *by hand* rather than by
text. It plausibly can; it is the best fallback if direction 1 fails playtest.

---

### Direction 3 — **The Sea of Ice** (honest menu-driven control)

**Genre / subtype.** Discrete-turn expedition and provisioning, menu-selected — deliberately
the same machine shape as the two shipped examples in this repo.

**Player identity.** Victor, chapter 24: the pursuit from the family tomb to the Frozen Ocean.

**Core verb.** Allocate, per march-turn: provisions, dogs, furs, rest; read the quarry's marks
and choose a route. Settlements resupply and give intelligence (chapter 24's seashore hamlet).
The genuinely unusual system is that **your quarry maintains your supplies** — he leaves marks
cut into bark and stone, and once a dead hare, because he "feared that if I lost all trace of
him I should despair and die" (chapter 24). The resource economy has an antagonist-controlled
input, which is a real design idea and belongs to no benchmark.

**Closest benchmark and the one thing borrowed.** *The Banner Saga* (Stoic, 2014) — a caravan
whose supplies are consumed per day and whose depletion kills members. Its combat, world and
art are not borrowed. Verification: mechanics corroborated by the official game wiki and
contemporary reviews this pass; sales figures not obtained.

**Signature screen.** A dark speck resolving on the dusky plain from an ice summit, one dog
just dead beside the sledge (chapter 24).

**Hard-veto and comparison outcome.** It passes all six hard vetoes. It loses on two grounds.
First, it repeats the shipped shape exactly — menu input, discrete turns, numbers in the
foreground — which is the one thing this example was commissioned not to do. Second, its
terminal state is fixed by the text: the ground sea splits the ice at the moment of
interception and the quarry is never caught (chapter 24), so the strongest decision the loop
can offer is *pacing toward a foregone conclusion*, and the antagonist's resupply mechanic
actively removes the scarcity pressure that would make pacing tense. It is a real game; it is
not this example's job.

---

## 5. Comparison, hard-veto check and selection

Hard-veto results, one line each (checked against the six vetoes in `concept-method.md`):

- **Direction 1 · The Hovel** — passes all six. Not a reading game (continuous spatial loop);
  has repeatable action, pressure, trade-offs and state change; the book's central tension
  (rejection on sight) *is* the loop rather than narration; not a reskin (the three rules
  above survive removal of proper nouns); needs no open world, server or production art
  volume; borrows no protected characters, maps, UI or assets.
- **Direction 2 · Eight Feet** — passes all six, with a standing warning on veto 3: the
  ethical tension migrates into a reading interface after the build ends unless the
  dismantling coda is made to carry it by hand.
- **Direction 3 · The Sea of Ice** — passes all six. Eliminated by comparison, not by veto:
  it duplicates the shipped machine shape, and the text fixes its outcome so its decisions
  reduce to pacing.

Comparison on the method's six axes:

| Axis | 1 · The Hovel | 2 · Eight Feet | 3 · Sea of Ice |
|---|---|---|---|
| Fit to the source's rules | Strongest — chapters 11–16 are the densest rule block in the book, and every verb is cited | Medium — the headline mechanic requires inventing per-part provenance the text refuses to supply | Strong on provisioning, thin elsewhere |
| Enacting the source's ethics | The player performs the whole tension: help invisibly, be destroyed by being seen | Migrates to a reading interface after the build | The moral weight is retrospective and narrated |
| Player agency | Continuous, four-way budget, one irreversible call | Real but front-loaded into one commit | Pacing decisions toward a fixed end |
| Visual communication | One still (the chink) shows identity, action and world | Strong but rating-risky | Weak — a map and a supply panel |
| Cultural fit | Reads without Shelley; no false modern analogy needed | Same | Same |
| Completion risk (one pass, zero build) | Medium — cones, scripted routines and a day clock are the work; no pathfinding search needed on a handcrafted map | Low-medium — but the art brief is the risk | Low |

**Selected: Direction 1 — The Hovel.** It is the only one of the three whose core loop *is*
the novel's central tension rather than a container for it, and it moves three of the four
axes the repo has not yet demonstrated (direct spatial manipulation, spatial reasoning,
continuous pressure). This closes `PRODUCT_BRIEF.md` row 3.

**A note on the direction proposed before this stage.** An earlier round favoured a
"constrained build → moral audit" expressed as a spec-review-turned-deposition. On reading
the book, two things sink it as this example's pick: its input is menus and its settlement is
text, which would make this the pipeline's third text-and-numbers example; and the build
sheet it depends on is invention, because the text names three supplier types and never
attaches a trait to a part (chapter 4; see the bible's "Where the text is silent"). Its good
half — that the creature holds the maker's own record and reads it back (chapter 15) — is
preserved here as a found object the player carries out of the cottage.

## 6. Non-negotiables

Experience-level commitments only. Any tuning number appearing here is a defect.

- The creature is never named and is never called Frankenstein; his appearance is Shelley's
  (chapter 5) and never the 1931 make-up.
- No combat, no weapon, no kill verb, no gore. The creature's canonical strength exists only
  as something *withheld* — the text records him refraining when he could have torn Felix
  "limb from limb, as the lion rends the antelope" (chapter 15) — and withholding must be a
  visible, acknowledged action, never a locked-out button.
- Being seen by a sighted human is never recoverable inside a run.
- The blind man is the only human who engages the creature as a person, and the interface
  never tells him what the creature looks like.
- The household's winter is legible in the room through the chink, never as a meter.
- The De Lacey channel is destroyed at the end of the slice, as in chapter 16. The run's
  variance lives in how far into the conversation the player got, how the family enters its
  flight, and what the creature carries away — never in whether they stay.
- Language is only ever acquired by overhearing instruction meant for someone else
  (chapter 13). There is no study button.
- Daylight is never playable.
- Anonymous labour never produces thanks, credit or affection points — only a changed
  household and, at most, the words "good spirit" overheard (chapter 12).
- The novel's killings, the vivisection and the framing of an innocent stay outside the
  playable slice and are never rewarded actions.

## 7. Minimum verification question

Does a first-time player, with no instructions, work out that the blind man is approachable
and then *plan an entry window* out of an observed routine — rather than knocking on night
one and treating the refusal as a retry? Method: unguided playtest, logging the timing of the
first knock, whether a lesson was attended first, and whether the player ever repeats an
approach after being seen. If players treat the door as retryable, pillar 1 has failed and
the fix is in the design, not in more tutorial text.

## 8. Open questions

- Whether drawn vision cones stay readable over engraved ink hatching at 1280×800, or whether
  the art direction must give the cones their own value range.
- Whether the fixed ending reads as *fated* or merely as *unfair*. The novel's outcome is
  immutable; only playtest can say whether the framing carries it.
- Whether eight nights is enough for the household's improvement to be legible, and what the
  night budget's scarcity ratio should be — a numeric-stage question, not a concept one.
- Whether a slow-motion or pause affordance (standard in the stealth-strategy lane) is needed
  for accessibility without dissolving the continuous pressure. Deferred to `GAME_DESIGN`.
- The *Hitman* benchmark row is only partially verified; if its opportunity-window model is
  materially different from the secondary sources' description, the level-structure principle
  needs re-sourcing.
- No market data exists for this exact subtype. The lane's currency is verified; the
  intersection "non-violent real-time stealth around one household" rests on a single
  acclaimed proof point (*Untitled Goose Game*).
