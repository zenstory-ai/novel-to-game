# Source Bible: *Frankenstein; or, The Modern Prometheus*

## Source scope and evidence rules

The analysis reads the complete text in `source/frankenstein.txt` (Project Gutenberg #84),
verified as the **1831 revised edition**: four framing letters plus 24 continuous chapters,
no volume divisions, and Elizabeth Lavenza as an adopted Milanese orphan rather than
Victor's cousin. Edition markers, completeness and the licence boundary are in
`source/SOURCE.md`.

Citation conventions used throughout the pipeline:

- Numbered chapters are cited as `chapter N`. Every claim in this file was grepped back
  to the source and checked against the chapter's line range, not merely "found somewhere
  in the book".
- Walton's frame is cited as `Letter 1`–`Letter 4`. The letters are **not** numbered
  chapters and must never be cited as though they were.
- Walton's closing journal ("Walton, *in continuation*", dated August 26th to September
  12th) is printed inside chapter 24 in this edition, so material from the ship's final
  days is cited as chapter 24.
- Quotations keep Shelley's spelling and punctuation, including `dæmon`, `Chamounix`,
  `Mont Salêve` and `Secheron`.

Two art-direction constraints bind before any design begins, and they are restated here
because they are the most likely accidental contamination: the flat head, neck electrodes
and green pallor are Universal's copyrighted 1931 make-up, not Shelley's creature; and
recent screen adaptations, including the 2025 Netflix film, are off-limits as visual
reference. Everything visual in this file comes from the 1831 text.

This stage establishes the factual layer only. It does not choose a genre, a player
character, a loop or an interface.

## World identity

The novel is not a chase with a monster in it. It is a nested set of testimonies — Walton
transcribes Victor, Victor quotes the creature, the creature reads Victor's own laboratory
journal back at him — in which almost every decisive action is an act of **information
management** rather than force. Bodies are assembled from scarce material with named
provenance; the result cannot be previewed, cannot be undone, and immediately becomes an
independent agent. From that point the book runs on secrecy, credibility, correspondence,
observation and negotiated terms.

Direct violence is available to exactly one party and is elective. Victor springs at the
creature and is simply eluded: "Remember, thou hast made me more powerful than thyself; my
height is superior to thine, my joints more supple" (chapter 10). The creature could tear
Felix "limb from limb, as the lion rends the antelope" and refrains (chapter 15). Victor
fires one pistol at a window and misses (chapter 23). Nothing in 24 chapters is resolved by
a fight. What is resolved — Justine's conviction, the contract on the sea of ice, the
destruction of the female, the pursuit across the ice — is resolved by evidence, terms,
disclosure and provisioning.

The book's second structural fact is that the creature is created **wordless and
sighted-against**. It opens its eyes, makes "inarticulate sounds", and reaches out a hand
"seemingly to detain me" (chapter 5); speech is acquired later by eavesdropping on someone
else's lessons (chapter 12, chapter 13). Anyone with working eyes rejects it on sight
before dialogue can begin; the single documented exception is the blind old man
(chapter 12, chapter 15). Appearance is an auto-fail channel and voice is a negotiable one.

## Full-book coverage

Coverage count: source 24 chapters / 24 succeeded / 0 failed. Walton's four framing letters
are covered in prose below the table, since they are the outer frame rather than numbered
chapters.

| Chapters | What changes in the source | Pace | What it contributes to design |
|---|---|---|---|
| chapter 1-2 | Caroline is rescued from Beaufort's ruin; Elizabeth is taken from a peasant cottage on Como and presented to Victor as "a pretty present"; Agrippa is found at a weather-forced inn stop and dismissed by the father without argument; the Belrive oak is reduced to "thin ribbons of wood" and a visiting philosopher explains galvanism | slow, domestic, no threat | Rescue creates a possession claim; unexplained refutation entrenches belief instead of removing it; one bystander conversation permanently reroutes a knowledge track |
| chapter 3-4 | Elizabeth's scarlet fever kills Caroline, whose deathbed joins Victor's and Elizabeth's hands; at Ingolstadt Krempe voids Victor's prior reading, Waldman accepts him and gates the laboratory machines on proficiency; two years later the charnel-houses yield the discovery, the eight-foot specification, months of collecting, and the top-floor workshop | rising, single-threaded, entirely preparatory | The complete build rule set: animation solved separately from assembly, three named material suppliers, scale as a speed trade, secrecy purchased with architecture, health and correspondence as the running cost |
| chapter 5-6 | Animation at one in the morning by a nearly burnt-out candle; instant revulsion; the room abandoned; the creature at the bed curtain, then gone; months of nervous fever with Clerval nursing and concealing; Elizabeth's letter arrives after lying unopened; apparatus removed, apartment changed, oriental languages substituted; winter roads close the route home | one spike, then a long trough | An irreversible commit whose real outcome is hidden until motion; first hostility as a consequence of abandonment; avoidance as a mechanic that works until the post arrives |
| chapter 7-8 | William is strangled at Plainpalais and the miniature is gone; a lightning flash identifies the creature, a second finds it on the face of Mont Salêve; Victor reasons himself into silence; servants take the miniature to a magistrate; Justine is tried at eleven, the ballots come back all black, she confesses a lie under threat of excommunication, and dies on the morrow | the book's tightest pressure block | Credibility as a resource already spent; a court that runs on circumstantial weight and an unarguable ballot; advocacy that converts sympathy for the speaker into indignation against the accused |
| chapter 9-10 | The household moves to Belrive to escape the ten o'clock gate closure; night boat, repeated suicide temptation, dependents as the only restraint; Chamounix, Montanvert climbed deliberately without a guide, two hours across the sea of ice, the confrontation, force refused, a hearing granted until sunset | release, then the first true reversal | Asymmetric force; hearing-before-judgement claimed as law; the sublime as a morale resource that reliably decays; the narration changes hands to the antagonist |
| chapter 11-12 | Senses arrive undifferentiated and separate over moons; fire is derived by experiment and then lost because the procedure was not learned; shepherd and village both fail on sight alone; the hovel is built as a sealed hide with one observation chink; the blind man is identified as the exception; anonymous night labour is credited to a "good spirit"; first four words; the pool | slow, systemic — the densest rule block in the book | Perception, concealment, observation, language and anonymous influence all as separately costed procedures rather than growth |
| chapter 13-14 | Safie arrives veiled on horseback; her lessons are overheard ("about twenty words at the first lesson"); Volney supplies history and the human valuation formula, which the creature applies to himself and scores zero on; the De Lacey history is learned — unjust sentence, the grated prison window, forged passports, confiscation and perpetual exile, then the Turk's betrayal | steady, expository, weakest as action | Learning as an eavesdropped resource with a strictly negative emotional yield; institutions that punish a just rescue; documents and interpreters as the things that move where bodies cannot |
| chapter 15-16 | A portmanteau yields three books; Victor's own four-month laboratory journal is deciphered and later handed over on-screen; the entry window is engineered and taken, and voice alone nearly wins the blind man; the walkers return, the creature is beaten and the cottage burnt after the moon sets; a drowning girl is saved and answered with a gunshot; a boy names his father and is strangled; the miniature is planted on a sleeper; the demand is stated | the hinge of the whole book | Two judgement channels, only one winnable; exposure deletes the node rather than lowering a meter; visible benevolence converting to injury; identity disclosure, not proximity, re-pricing a target |
| chapter 17-19 | The demand is restated as a right, argued, escalated once, and closed as a bilateral contract with an exile clause and a monitoring clause; Victor buys distance with a cover story and accepts an attached companion; the Rhine, London's letters of introduction, the northern tour, and finally a wave-beaten Orkney rock with five inhabitants and three huts, where the second build proceeds "in cold blood" | argument, then long logistics | A contract no third party can enforce and neither side can verify; secrecy priced in miles and rent; the same act costing more without the first time's mania |
| chapter 20-21 | The unfinished female is audited for consequences, then torn up in front of the client; "You are my creator, but I am your master"; the wedding-night threat; the remains sunk four miles out under cloud; a northeast wind drives Victor to Ireland into a murder investigation, Clerval's body is used as an interrogation instrument, and only proof of location defeats the charge | reversal and immediate punishment | Escalation priced to the specific breach; destroyed work as incriminating matter requiring disposal; an alibi as the only answer circumstantial evidence accepts |
| chapter 22-23 | Victor's true confession is filed as delirium; Elizabeth offers to release him; the wedding is fixed at ten days; he carries pistols and sweeps the inn's passages while Elizabeth is strangled in the room he left; the shot misses, the nets fail, most companions decide the figure was fancy; Alphonse dies, Victor is confined for months, and the magistrate declines to act | the threat resolves on the wrong referent | A threat honoured to the letter against the target the reader misidentified; truth-telling that costs sanity standing; an institution that half believes and still refuses |
| chapter 24 | The oath at the family tomb is answered by a laugh; the pursuit runs down the Rhone, by ship to the Black Sea, across Tartary and Russia, sustained by inscriptions and a dead hare the quarry leaves to keep the pursuer alive; sledge, dogs and provisions are procured, exchanged and consumed; the ground sea splits the ice at the moment of interception; aboard the ship Victor edits Walton's notes, refuses the method, and dies; the creature is found over the coffin, states its own case, declares a funeral pile, and leaves alive on an ice raft | long chase, then a two-voice ending | The antagonist maintaining the protagonist's resources to prolong the pursuit; provisioning as the only Arctic system; and an ending staged as a hearing, not a fight |

**Letters 1–4 (Walton's frame).** The frame is not a prologue that can be dropped: it
establishes the transcription chain that every later "fact" travels through, and it
supplies the Arctic rule set that chapter 24 spends. Walton writes to one fixed absent
recipient, Mrs. Saville, and sends letters out only when a carrier happens to be going
the right way (Letter 1, Letter 3). He admits a competence ceiling — self-educated, "more
illiterate than many schoolboys of fifteen" (Letter 2) — and then resolves to record the
stranger's account "as nearly as possible in his own words", downgrading to notes when
duty interferes (Letter 4). Ice functions as a gate rather than terrain: it closes on the
ship, removes the ability to pursue, then breaks by itself hours later; darkness suspends
movement even when the way is open; the sighting of the gigantic sledge driver happens
only inside a cleared interval of fog, at half a mile, through telescopes (Letter 4).
Freezing has an ordered revival protocol, access to the informant is rationed by the
captain one question at a time, and the confession cannot be requested — two days of
kindness get nothing, and it is Walton's own boast that one man's life is a small price
for knowledge that triggers the offer of the tale (Letter 4). Command runs on affection
rather than force, and morale is an obligation the leader pays from his own supply
(Letter 1, Letter 2).

## World rules that trace to the text

| Rule | Source fact | Evidence |
|---|---|---|
| Animation and assembly are separate capabilities, and only one is solved | Victor already possesses "the capacity of bestowing animation"; preparing a frame "with all its intricacies of fibres, muscles, and veins" is the remaining work | chapter 4 |
| Knowledge of life is bought only through death | "To examine the causes of life, we must first have recourse to death"; anatomy is insufficient, so days and nights are spent in vaults and charnel-houses | chapter 4 |
| Materials have named provenance and are admitted to be inadequate | Bones from charnel-houses; "The dissecting room and the slaughter-house furnished many of my materials"; living animals tortured; materials "hardly appeared adequate" before work begins | chapter 4 |
| Scale is a build-time trade, not a flourish | Small parts hinder speed, so "contrary to my first intention" the being is made "about eight feet in height, and proportionably large" | chapter 4 |
| The aesthetic specification fails on animation | Features "selected as beautiful" become horror once the muscles and joints are "rendered capable of motion" | chapter 5 |
| Instrument access is gated on proficiency | Waldman promises the use of his machines only "when I should have advanced far enough in the science not to derange their mechanism" | chapter 3 |
| Secrecy is architectural and is charged to the body nightly | Work happens in "a solitary chamber, or rather cell, at the top of the house, and separated from all the other apartments by a gallery and staircase"; pale cheek, emaciation, a nightly slow fever, and the fall of a leaf startling him | chapter 4 |
| Silence is itself a report, and it is read against you | The father's standing condition: "You must pardon me if I regard any interruption in your correspondence as a proof that your other duties are equally neglected" | chapter 4 |
| Appearance is an absolute verdict; voice is negotiable | Shepherd flees, village drives him off with stones, Agatha faints and Safie runs; but "My voice, although harsh, had nothing terrible in it", and the blind man argues with him as a person | chapter 11, chapter 12, chapter 15 |
| Exposure deletes content rather than lowering a meter | One sighting costs the De Laceys three months' rent, the garden's produce and the tenancy; "I never saw any of the family of De Lacey more" | chapter 16 |
| Visible benevolence does not accrue credit | Months of invisible firewood and cleared paths produce the label "good spirit, wonderful"; dragging a drowning girl from a river in daylight produces a musket ball in the shoulder | chapter 12, chapter 16 |
| The creature outclasses humans at movement and is impassive to cold | It scales the "nearly perpendicular ascent of Mont Salêve" inside one storm, bounds over the crevices Victor skirts, descends the glacier faster than "the flight of an eagle", and names the north as ground "to which I am impassive" | chapter 7, chapter 10, chapter 17, chapter 24 |
| The kill method is invariant and legible, and it frames the creator | Strangulation leaving finger-marks: "the print of the murder's finger was on his neck" (William), "the black mark of fingers on his neck" (Clerval), the same mark on Elizabeth | chapter 7, chapter 21, chapter 23 |
| Evidence can be planted, and legal knowledge is used offensively | The miniature is taken from the dead boy and tucked into a sleeping woman's dress: "The crime had its source in her; be hers the punishment", credited to "the lessons of Felix and the sanguinary laws of man" | chapter 16 |
| Credibility is spent before it is needed, and truth-telling costs sanity standing | Victor's documented nervous fever would "give an air of delirium to a tale otherwise so utterly improbable"; his accurate confessions are filed as delirium and earn months in a solitary cell | chapter 7, chapter 22, chapter 23 |
| Confession would not have discharged the guilt even if believed | "I was absent when it was committed, and such a declaration would have been considered as the ravings of a madman and would not have exculpated her who suffered through me" | chapter 8 |
| Courts run on circumstantial weight, on performed composure, and on an unarguable ballot | Justine's disordered answers are "adduced as a proof of her guilt", she must work her mind up to an appearance of courage, and the resolution is "The ballots had been thrown; they were all black" | chapter 7, chapter 8 |
| Confession outranks all other evidence in the household's belief model, and can be extracted by religious pressure | Elizabeth says nothing could shake her but his own confession; Justine: "I did confess, but I confessed a lie... He threatened excommunication and hell fire" | chapter 8 |
| Only verified location answers circumstantial evidence | The grand jury rejects the bill "on its being proved that I was on the Orkney Islands" at the hour the body was found | chapter 21 |
| The relationship is a bilateral contract with a penalty clause, and no third party can enforce it | "Do your duty towards me, and I will do mine towards you"; consent given "on your solemn oath to quit Europe for ever", against "while they exist you shall never behold me again", plus a monitoring clause on the build's progress | chapter 10, chapter 17 |
| Retaliation is priced to the breach, and a pending threat buys no peace in the interval | The female is destroyed, so the companion and then the bride are destroyed; Victor notes the creature "did not consider that threat as binding him to peace in the meantime" | chapter 20, chapter 21, chapter 22, chapter 23 |
| The antagonist maintains the protagonist's resources to keep the pursuit alive | Marks left on bark and stone, plus a dead hare, because he "feared that if I lost all trace of him I should despair and die" | chapter 24 |
| Distance is scheduled, tiered and seasonal | Diligence, cabriolet, horse then hired mule for rugged roads, Rhine boat, sea passage, sledge and dogs; winter roads "deemed impassable" hold a journey until spring; Geneva's gates shut at ten and the lake is the only bypass; the ice releases the ship only on September 9th, with the southward passage free on the 11th | chapter 6, chapter 9, chapter 19, chapter 24 |
| The method is contraband and is withheld from every asker | Victor refuses Walton outright; the creature intends to burn his own body so its remains "may afford no light to any curious and unhallowed wretch who would create such another" | chapter 4, chapter 24 |
| The record is editable and contested | Victor corrects and augments Walton's notes so that "a mutilated one should not go down to posterity" — the account the reader receives has been revised by its subject | chapter 24, Letter 4 |

## Player verbs the text supplies

Repeatable actions with choice, feedback and observable consequences. The performer is
named because several verbs belong to only one party.

| Verb | Performed by | What it changes | Evidence |
|---|---|---|---|
| Specify a build before building it (organism type, then stature) | Victor | Fixes permanent properties of the result; stated as a reversible decision taken before work starts | chapter 4 |
| Collect and arrange materials as a distinct phase, by source | Victor | Consumes months; different suppliers yield different matter, including animal | chapter 4 |
| Observe decay over time in vaults and charnel-houses | Victor | Converts death into the knowledge anatomy cannot supply | chapter 4 |
| Procure from a prescribed book or instrument list; present letters of introduction | Victor | Buys knowledge and access that cannot be reached any other way | chapter 3, chapter 19 |
| Attend, or deliberately skip, a scheduled lecture | Victor | Chooses a teacher's policy toward your existing knowledge | chapter 3 |
| Infuse life | Victor | One-shot, irreversible, result unpreviewable | chapter 5 |
| Conceal — refuse to name what happened, then keep paying for it | Victor | Each new silence is cheaper than breaking the older one, and transfers cost onto third parties | chapter 5, chapter 7, chapter 8, chapter 9 |
| Write, defer or dread a letter; wait for one | Victor, Elizabeth, Alphonse, Walton | The only channel between separated parties, slow and one-directional at sea; handwriting itself is the proof of state | chapter 4, chapter 6, chapter 19, Letter 3 |
| Testify, or refuse an answer when asked to your face | Victor, Elizabeth, the character witnesses | Advocacy can backfire; withheld answers are a selectable option with consequences | chapter 8 |
| Sanitise a site: pack instruments, weight remains, wait for cloud, sink at distance | Victor | Removes incriminating matter at the cost of time and exposure to weather | chapter 20 |
| Sweep a building; arm and carry; fire once and miss | Victor | Defensive preparation that is answered by attacking the space he is not in | chapter 22, chapter 23 |
| Provision, re-provision and manage a team | Victor, the creature | Sledge, dogs, furs and food consumed and countable; three weeks judged by provision spent; a sledge convertible into oars | chapter 24 |
| Observe a household through a chink and infer motives | the creature | Understanding another agent costs elapsed observed days; "perpetual attention and time explained to me many appearances" | chapter 12 |
| Experiment on a phenomenon and derive a rule, with injury as feedback | the creature | Hand burned in embers; fuel, drying, fanning and cooking derived one at a time | chapter 11 |
| Seal and unseal a hide; move only at night | the creature | Concealment as a maintained structure with a deliberate exit route | chapter 11, chapter 15, chapter 16 |
| Perform anonymous labour for a household | the creature | Changes their schedule and their store without producing contact or credit | chapter 12 |
| Steal from a visible store — or abstain and absorb the cost yourself | the creature | Extraction is zero-sum and legible as their hunger | chapter 12 |
| Eavesdrop on a lesson intended for someone else | the creature | The only vocabulary source that works; unaided attempts fail | chapter 12, chapter 13 |
| Read a found document and convert it into knowledge and grievance | the creature | Three books supply moral vocabulary; Victor's journal supplies an origin, a named defendant and a description of his own body | chapter 15 |
| Wait for a household configuration, then present a cover identity | the creature | Access windows are configurations, not timers; "I am a traveller in want of a little rest" | chapter 15 |
| Withhold force you certainly possess, and register the withholding | the creature | Violence is a spent decision with a stated reason, never a loss of control | chapter 15 |
| Demand, argue, offer terms, threaten, swear | the creature | Runs all five inside one negotiation and closes a contract | chapter 16, chapter 17 |
| Plant an object on a sleeper | the creature | Converts a crime into someone else's conviction | chapter 16 |
| Leave inscriptions and food for your pursuer | the creature | Sustains and steers a chase you are winning | chapter 24 |
| Transcribe another person's spoken account, or downgrade to notes | Walton | Fidelity is a resource that degrades under duty pressure | Letter 4 |
| Ration access to a fragile informant, one question at a time | Walton | The single question that gets through produces the frame's key fact | Letter 4 |
| Scan during a cleared interval and track until lost; post or delegate a watch | Walton | Sight is weather-gated and instrument-extended | Letter 4 |
| Revive a freezing body by protocol | Walton's crew | Wrong order costs: taken below he faints, so air, brandy, blankets, stove, then soup | Letter 4 |
| Hire a crew member on the strength of a story told about him | Walton | Officers are acquired by knowing their histories, not by pay | Letter 2 |

Verbs the text does **not** supply, and that would therefore be downstream invention:
melee combat that resolves, pursuit that catches the creature, surgery or medicine that
repairs it, and any interface by which Victor commands, recalls or reconfigures what he
made.

## Spaces

| Space | Function | Threshold or risk | Evidence |
|---|---|---|---|
| Geneva house and the Belrive campagne, "rather more than a league from the city" | Domestic baseline everything else is scored against; Belrive is chosen specifically to escape the ten o'clock gate | City gates shut at ten and cannot be reopened; the lake is the only bypass | chapter 2, chapter 9 |
| The blasted oak at Belrive, twenty yards from the house | Site of the galvanism lesson; a permanent mark of the force the build needs | — | chapter 2 |
| Ingolstadt: lecture room, Waldman's laboratory, Victor's lodging | Public knowledge dispensary, gated sanctioned workshop, private half of student life | Machines can be "deranged" by an unqualified hand | chapter 3 |
| Vaults, charnel-houses, the dissecting room, the slaughter-house | The three material suppliers plus the decay-observation space | Days and nights spent among "every object the most insupportable to the delicacy of the human feelings" | chapter 4 |
| The top-floor cell, reached by a gallery and staircase | Workshop of the first build; secrecy expressed as floorplan | Isolation from every other apartment is the whole point | chapter 4 |
| Plainpalais and Mont Salêve | Evening walking-ground where William dies; the near-perpendicular exit route that proves terrain rules differ | Sighting is possible only by lightning flash | chapter 7 |
| The court at Geneva and the prison chamber | Trial space with a live crowd mood and an out-of-sight ballot; the confrontation room with straw and manacles | The verdict is not persuadable once the ballots are thrown | chapter 8 |
| Chamounix, Montanvert, the sea of ice, the mountain hut | Tiered ascent, then a traversal field almost a league wide crossed in two hours, then the hearing room | One snow ravine where "even speaking in a loud voice" can draw destruction; mist must clear before descending | chapter 9, chapter 10 |
| The hovel against the De Lacey cottage, and the cottage interior | The creature's base: too low to sit upright, warmed by the cottage chimney, lit through the pig sty, one almost imperceptible chink; and the single room where he is spoken to kindly | Planks must be removable; the cottage is entered only in a specific household configuration | chapter 11, chapter 15 |
| The chore circuit — garden, milk-house, well, wood, pig sty, and a clear pool | Where anonymous labour and foraging happen, and where the pool serves as the only mirror | Spring lengthens the day and shortens the usable night | chapter 11, chapter 12 |
| London and the northern tour: Windsor, Oxford, Matlock, Cumberland, Perth | Where the second build's missing knowledge and materials are obtained | Access requires letters of introduction; a spoken place-name can close a stop | chapter 19 |
| The remotest Orkney: a wave-beaten rock, five inhabitants, three huts, one vacant | The second workshop, chosen because its neighbours are too worn by want to be curious | Water, bread and vegetables come five miles from the mainland; isolation must be bought | chapter 19 |
| The Irish harbour town, Kirwin's house, the prison, the assize town a hundred miles off | The legal machinery that turns an arrival into a murder charge | Papers on your person leak your identity and network; language gates comprehension | chapter 20, chapter 21 |
| The lake passage to Evian and the inn's passages and bridal chamber | The wedding journey and the room Victor is not in when it matters | Corners that "might afford a retreat" are the thing he inspects | chapter 22, chapter 23 |
| The pursuit corridor: Rhone, Mediterranean, Black Sea, Tartary and Russia, then the Frozen Ocean | The chase, sustained by settlements for resupply and intelligence | Rivers are avoided by the quarry because population collects there; the ground sea can split the board at the moment of interception | chapter 24 |
| Walton's ship — deck, cabin, kitchen stove, and the cabin window onto the ice raft | Rescue station, interview room, sickroom, coffin room, and the exit | Sea-room is taken away and returned by the ice on its own schedule | Letter 4, chapter 24 |

## Character will

- **Victor Frankenstein** wants the hidden causes behind appearances and then to be the
  origin of a species that owes him gratitude (chapter 2, chapter 4). After animation he
  wants only to remain uncredited as the cause, and pays in other people's lives for it
  (chapter 7, chapter 8). He states his own legality test for research — a study that
  weakens the affections "is certainly unlawful" (chapter 4) — and then fails it. Dying, he
  audits his conduct and finds it not blamable, his duty to the creature outweighed by his
  duty to his species (chapter 24).
- **The creature** wants, in order: to be attended to (chapter 5); to be heard before being
  condemned, as a legal right (chapter 10); sensory and linguistic competence (chapter 11,
  chapter 12); admission to the cottagers' company (chapter 15); a companion "of the same
  species" with "the same defects", claimed as a right (chapter 16, chapter 17); refused,
  exactly equivalent deprivation; then Victor kept alive to suffer (chapter 24); finally his
  own extinction with no successor made from his remains (chapter 24). He supplies a causal
  theory of himself — "I am malicious because I am miserable", "My vices are the children of
  a forced solitude" — which makes the contract a hypothesis under test (chapter 17).
- **Elizabeth Lavenza** wants confirmation in Victor's own handwriting (chapter 6), Justine
  acquitted (chapter 8), a world where appearance can still be trusted (chapter 9), and the
  marriage only as "the dictate of your own free choice", offering to release him
  (chapter 22). She is the one character who acts on belief in innocence, and is punished
  for it.
- **Alphonse Frankenstein** wants his son's attention accounted for on a schedule
  (chapter 4), the family consoled without vengeance, and the laws trusted (chapter 7,
  chapter 9) — which is exactly what makes Justine's conviction unstoppable. He classifies
  Victor's true confession as delirium (chapter 22).
- **Henry Clerval** wants recorded heroism and a route to India (chapter 2, chapter 18). He
  never presses Victor for the secret and manages the family's information for them
  (chapter 5), which makes him a benevolent amplifier of the concealment.
- **Justine Moritz** wants her innocence acknowledged by the people who love her, and then,
  condemned, wants absolution more than the truth on record (chapter 8).
- **The De Laceys** want the household intact and the blind father cared for; Felix applies
  force on sight and then abandons a tenancy rather than stay (chapter 15, chapter 16). Old
  De Lacey wants "in any way [to be] serviceable to a human creature" and is the only
  character who evaluates the creature by argument (chapter 15).
- **Safie** wants not to be returned to Turkey and "immured within the walls of a harem",
  and acts on it with her own jewels and money across a country whose language she does not
  speak (chapter 14).
- **Institutions** want closure they can defend: the judges would rather ten innocent
  suffer than one guilty escape (chapter 8); the confessor wants a confession and threatens
  hell fire to get one (chapter 8); Kirwin wants correct process and, once the evidence
  turns, supplies a physician, a nurse and a defence (chapter 21); the Genevan magistrate
  half believes the deposition and refuses to act because "Who can follow an animal which
  can traverse the sea of ice...?" (chapter 23).
- **Robert Walton** wants glory, a discovery of "inestimable benefit... on all mankind",
  and one friend "to approve or amend my plans" (Letter 1, Letter 2). He wants his crew
  alive, and consents to turn south when the deputation demands it (chapter 24).

## Player identity candidates

No `PRODUCT_BRIEF.md` exists for this example yet, so the player character is **not**
locked and the protagonist is not assumed to be the player. Each candidate below is
recorded only for the action and decision space the text demonstrably gives it. This is a
capability audit, not a choice.

| Candidate | Action space the text supports | Decisions the text puts in its hands | Evidence |
|---|---|---|---|
| Victor (protagonist) | Specify, source, assemble, animate, destroy; procure books, instruments and introductions; conceal, lie, write or defer letters; testify or stay silent; dispose of evidence; arm, patrol, provision, pursue | What to build and at what scale; whether to disclose, and to whom; whether to honour the contract; where to work and how far from the people who love him; how to read a threat's referent | chapter 4, chapter 7, chapter 8, chapter 17, chapter 20, chapter 24 |
| The creature (second narrator) | Observe, infer, forage, experiment, build and maintain a hide, labour anonymously, learn language by eavesdropping, read found documents, choose an approach channel, withhold force, demand, argue, contract, plant evidence, leave marks for a pursuer | Whether to steal from a poor household or absorb the cost; when to attempt an approach and through which channel; whether to use force it certainly has; whether to frame an innocent; whether to take fear when it cannot get love | chapter 11, chapter 12, chapter 13, chapter 15, chapter 16, chapter 17, chapter 24 |
| Walton (observer / transcriber) | Write to one fixed recipient, transcribe or downgrade to notes, ration access to an informant, post or delegate a watch, scan in a cleared interval, revive a freezing body, hire on reputation, hold or turn a ship | How faithfully the account is recorded; who may question the informant and about what; whether to disclose his own ambition; whether to keep the crew's promise or the voyage | Letter 1, Letter 2, Letter 4, chapter 24 |
| Original character (not in the text) | The text supports a plausible slot with real verbs: a servant, turnkey, nurse, market-woman, character witness, servant who finds evidence, or an incurious Orkney islander — all of them act on their own initiative and change outcomes | Whether to carry found evidence to a magistrate, whether to speak up for the accused, whether to be curious about the neighbour on the rock — each is an actual hinge in the source | chapter 7, chapter 8, chapter 19, chapter 21 |
| Faction / settlement | Households and communities act as units: the De Lacey household (schedule, store, tenancy, flight), the Geneva court and crowd (evidence, composure, ballot, indignation), Walton's crew (morale, deputation, requisition) | Whether to admit a stranger, whether to keep a tenancy after exposure, whether to convict, whether to sail on | chapter 8, chapter 15, chapter 16, chapter 24 |

## Roster (baseline for downstream gates)

Every entry below is fixed by the text. Downstream artifacts must compare against this
table before killing, sparing or relocating anyone; discrepancies come back here to be
corrected rather than being rewritten locally.

| Name | Role / position | Fate in the text | Evidence |
|---|---|---|---|
| Victor Frankenstein | Creator; Genevan, from a family long distinguished in the republic's public offices (his father "had filled several public situations with honour"; William calls him "a syndic"); student at Ingolstadt | Dies aboard Walton's ship, having reviewed his conduct and found it "not blamable" | chapter 1, chapter 3, chapter 16, chapter 24 |
| The creature | Made by Victor; unnamed throughout, about eight feet | Leaves alive on an ice raft, "lost in darkness and distance", having declared an intention to burn himself | chapter 4, chapter 24 |
| Elizabeth Lavenza | Adopted Milanese orphan, "my more than sister", later wife | Strangled at the inn at Evian on the wedding night | chapter 1, chapter 23 |
| Caroline Beaufort Frankenstein | Victor's mother | Dies of scarlet fever caught nursing Elizabeth, after joining Victor's and Elizabeth's hands | chapter 1, chapter 3 |
| Alphonse Frankenstein | Father; former public servant | Dies in Victor's arms within days of Elizabeth's murder | chapter 7, chapter 23 |
| William Frankenstein | Youngest brother, a child | Strangled at Plainpalais; the miniature taken from his body | chapter 7, chapter 16 |
| Ernest Frankenstein | Second brother, sixteen at the time of the letter; wants foreign service | Alive at chapter 23 ("My father and Ernest yet lived"); the text says nothing further about him | chapter 6, chapter 23 |
| Justine Moritz | Servant taken into the household as a family member | Convicted on an all-black ballot after a false confession, executed the next day | chapter 6, chapter 8 |
| Henry Clerval | Victor's single close friend, a merchant's son | Strangled in England after the female is destroyed; body found on the sands | chapter 2, chapter 21 |
| Robert Walton | Arctic captain; the outer narrator | Alive; turns south, having lost his friend | Letter 1, chapter 24 |
| Mrs. Saville (Margaret) | Walton's sister in England; sole recipient | Never speaks; receives everything | Letter 1 |
| M. Waldman | Professor of chemistry; takes Victor as a disciple and gates the machines | No further fate stated after chapter 6 | chapter 3, chapter 6 |
| M. Krempe | Professor of natural philosophy; voids Victor's prior reading | No further fate stated after chapter 6 | chapter 3, chapter 6 |
| Old De Lacey | Blind French exile; the only character who hears the creature out | Flees the cottage; "I never saw any of the family of De Lacey more" | chapter 12, chapter 16 |
| Felix De Lacey | Son; freed Safie's father and was ruined for it | Flees with the family, forfeiting rent and garden | chapter 14, chapter 16 |
| Agatha De Lacey | Daughter | Flees with the family | chapter 12, chapter 16 |
| Safie | Daughter of the Turkish merchant; reaches the cottage alone | Present at the cottage when the family flees; no later fate stated | chapter 13, chapter 16 |
| The half-finished female | The second build, commissioned under contract | Torn to pieces unfinished; remains sunk at sea. Her appearance is never described | chapter 20 |
| Mr. Kirwin | Irish magistrate | Alive; arranges Victor's defence | chapter 20, chapter 21 |

## Systems the text actually operates

These are the candidates that recur with inputs, costs and observable consequences, as
opposed to one-off set pieces:

1. **Provenance and scarcity in a build.** Three named suppliers, admitted-inadequate
   stock, a stature decision derived from part size, and a result whose appearance is only
   resolved at animation (chapter 4, chapter 5).
2. **Secrecy with compounding interest.** Architectural concealment, nocturnal work, a
   cover story, a lie to buy travel, and each new silence forced by an older one
   (chapter 4, chapter 7, chapter 8, chapter 18).
3. **Credibility as a separate, spendable stock.** Illness, prior ravings and improbability
   remove the option of being believed, independently of whether you are telling the truth
   (chapter 7, chapter 22, chapter 23).
4. **Correspondence.** Slow, opportunistic, per-character information state; letters that
   sit unopened; silence read as neglect; third parties concealing on your behalf
   (chapter 4, chapter 5, chapter 6, chapter 19, Letter 3).
5. **Observation and inference.** Motives are never told, only inferred from repeated
   observed days, through a fixed vantage, under light and season constraints (chapter 12).
6. **Language acquisition in a fixed order,** gated on an available teaching event and
   quantified in words per lesson (chapter 12, chapter 13).
7. **Contract without an enforcer.** Bilateral clauses, a delivery trigger, a monitoring
   clause, unverifiable compliance on both sides, and retaliation priced to the breach
   (chapter 10, chapter 17, chapter 20).
8. **Institutional process.** Autonomous evidence discovery by servants, depositions,
   performed composure, an unarguable ballot, alibi as the only defeater, and a magistrate
   who can decline (chapter 7, chapter 8, chapter 21, chapter 23).
9. **Provisioning under travel constraints.** Seasonal passability, gate hours, tiered
   transport, and Arctic supply measured in provisions consumed and dogs lost (chapter 6,
   chapter 9, chapter 24).

One-shot set pieces that must not be mistaken for loops: the animation itself (chapter 5),
the destruction of the female (chapter 20), the wedding night (chapter 23), and the meeting
over the coffin (chapter 24).

## Repeatable structures

Victor's recurring shape, which the book runs four times (the first build, the trial, the
second build, the pursuit):

```text
a private commitment is made and hidden
  -> the work is paid for in health, correspondence and distance from anyone who loves you
  -> the result becomes an independent agent you cannot recall
  -> disclosure is considered and is priced out by credibility already spent
  -> a third party absorbs the consequence
  -> the silence gets more expensive to break, so it is kept
```

The creature's recurring shape, which the book runs three times (the village, the
cottagers, Victor):

```text
observe a party you cannot yet approach, at a cost in time and concealment
  -> derive their rules, needs and schedule from repeated observation
  -> act for them invisibly, or prepare an approach through the one channel that isn't sight
  -> be seen
  -> lose the whole node, not a fraction of its goodwill
  -> convert the loss into a stated claim on someone accountable
```

Skill difference between a careless and a careful player, if these structures are used,
lives in: whether a household's configuration is read before an approach is attempted;
whether the channel chosen is sight-independent; whether a document is kept as evidence;
whether a threat's referent and timing are parsed correctly; and whether credibility is
preserved for the one moment it is needed.

## Cultural and period context

Not decoration — each of these changes what a player could plausibly attempt.

- **Genevan justice.** Victor's father "had filled several public situations with honour",
  William identifies his father as "a syndic" as his only leverage, and the criminal court
  resolves guilt by a ballot of judges rather than by argument (chapter 1, chapter 8,
  chapter 16). Downstream must not substitute a modern police procedural.
- **Religious pressure as an evidentiary force.** Justine is a Roman Catholic whose
  confessor threatens excommunication and hell fire to obtain a confession, and the
  household treats confession as outranking all other evidence (chapter 8).
- **Natural philosophy versus alchemy.** Agrippa, Paracelsus and Albertus Magnus are a live
  option in 1790s adolescence; galvanism arrives as new, astonishing and explanatory
  (chapter 2). Krempe voids the old reading, Waldman revalues it as foundations
  (chapter 3). The build is science in its own period's terms, not magic and not
  engineering.
- **Ancien-régime injustice.** A Turkish merchant is condemned on a sentence widely
  believed to rest on his religion and wealth; the family who rescue him lose fortune and
  country by verdict (chapter 14).
- **Shelley's orientalism.** Safie's arc is framed as flight from being "immured within the
  walls of a harem" and from "an independence of spirit forbidden to the female followers of
  Muhammad" (chapter 14). This is the period text's framing, recorded here as a source fact;
  it is not a set of world rules to reproduce uncritically.
- **The sublime as a named psychological instrument.** Mountains and lakes are repeatedly
  used to subdue grief, and the effect is repeatedly reported as gone by morning
  (chapter 9, chapter 10).
- **Communication and travel.** Letters, diligences, cabriolets, hired mules, passports and
  letters of introduction are the entire connective tissue; nothing is instantaneous and
  nothing is broadcast.

## Visual and sound anchors

All from the 1831 text.

- **The creature's body.** "His yellow skin scarcely covered the work of muscles and
  arteries beneath; his hair was of a lustrous black, and flowing; his teeth of a pearly
  whiteness", set against "watery eyes, that seemed almost of the same colour as the
  dun-white sockets in which they were set, his shrivelled complexion and straight black
  lips" — translucency over working anatomy, on a proportioned eight-foot frame
  (chapter 4, chapter 5). At the end, one vast hand "in colour and apparent texture like
  that of a mummy" (chapter 24).
- **The animation, lit wrong.** One in the morning, rain "pattered dismally against the
  panes", a candle "nearly burnt out", and the dull yellow eye opening "by the glimmer of
  the half-extinguished light" (chapter 5).
- **The bedside visit.** Dim yellow moonlight through shutters, the bed curtain held up,
  inarticulate sound, a grin, one hand stretched out (chapter 5).
- **The blasted oak.** Not a scorched trunk: a tree "entirely reduced to thin ribbons of
  wood" (chapter 2).
- **The workshop.** A top-of-house cell past a gallery and staircase, the moon on midnight
  labour, eyeballs "starting from their sockets" (chapter 4).
- **The storm sighting.** Lightning on the summit of Mont Blanc, the lake "like a vast sheet
  of fire", then pitchy darkness; a figure fixed by one flash, then found hanging among the
  rocks of Mont Salêve (chapter 7).
- **The verdict as an object.** "The ballots had been thrown; they were all black"
  (chapter 8). The prison chamber: straw, manacles, a head resting on knees (chapter 8).
- **The sea of ice.** A vast river of ice "rising like the waves of a troubled sea...
  interspersed by rifts that sink deep", Mont Blanc above in awful majesty, and a tall
  figure advancing "with superhuman speed" over the crevices the climber skirted
  (chapter 10). Two hands laid over the creator's eyes: "thus I take from thee a sight which
  you abhor" (chapter 10).
- **The chink.** A whitewashed room "very bare of furniture", a blind man's head on his
  hands beside a small fire, a girl sewing at his feet, a guitar taken up — framed by one
  almost imperceptible gap in a boarded window, from a hovel lit through a pig sty
  (chapter 11).
- **The morning after invisible work.** A great pile of wood at the door, snow cleared from
  the path to the milk-house, and Agatha astonished (chapter 12). The first white flower
  from beneath the snow, carried indoors in the middle of want (chapter 12).
- **The reflection.** A transparent pool, and the recoil (chapter 12).
- **The burning.** A lighted dry branch, eyes fixed on the western horizon until the moon's
  orb sinks, then flames that "licked it with their forked and destroying tongues"
  (chapter 16).
- **The Orkney hut.** Two rooms of "the most miserable penury", thatch fallen in, walls
  unplastered, door off its hinges, on a rock whose "high sides were continually beaten upon
  by the waves"; a stony evening beach and the roaring of the ocean (chapter 19).
- **The inspection at the casement.** "I saw by the light of the moon the dæmon at the
  casement. A ghastly grin wrinkled his lips as he gazed on me, where I sat fulfilling the
  task which he had allotted to me" (chapter 20). Then the scattered remains on the
  workshop floor at daybreak (chapter 20), and the gurgling sound of the basket sinking
  (chapter 20).
- **The bridal chamber.** Elizabeth "thrown across the bed, her head hanging down", pale
  yellow moonlight in a room whose windows had been darkened, shutters thrown back, and a
  grinning figure at the window pointing at the corpse (chapter 23).
- **The trail and the taunts.** "The print of his huge step on the white plain", and words
  cut in bark and stone: "My reign is not yet over"; "Prepare! Your toils only begin; wrap
  yourself in furs and provide food" (chapter 24).
- **The interception failing.** A dark speck on the dusky plain resolving into a sledge,
  then the ground sea, ice splitting "with a tremendous and overwhelming sound", and a
  shrinking floe (chapter 24).
- **The frame's images.** The imagined pole where "the sun is for ever visible... diffusing
  a perpetual splendour" (Letter 1); the ship shut in with "scarcely leaving her the
  sea-room in which she floated" inside a very thick fog (Letter 4); the two o'clock reveal
  of "vast and irregular plains of ice, which seemed to have no end" (Letter 4); the low
  carriage on a dog sledge driven by a shape of a man of gigantic stature, tracked by
  telescope until lost (Letter 4); the revival by the kitchen stove chimney (Letter 4).
- **Sound.** A guitar playing "several mournful but sweet airs" in a cottage (chapter 15);
  the rumbling thunder of a falling avalanche (chapter 9); a fiendish laugh echoed by the
  mountains at the tomb (chapter 24); the ground sea and the roaring of splitting ice
  (chapter 24, Letter 4).

## Unified terminology

Source and artifacts are both English, so this table fixes **which of Shelley's terms the
game uses** and which common outside terms are forbidden because they come from film or
from later usage rather than from this text.

| Category | Term the game uses | Text basis | Do not use |
|---|---|---|---|
| Character | **the creature** (narration), with *wretch*, *dæmon*, *fiend*, *monster*, *being* available as in-fiction epithets spoken by characters | All of these appear; the being is never named | Any invented proper name; "Adam" as a name — it is only an analogy the creature draws against himself (chapter 10, chapter 15) |
| Character | **Frankenstein** = Victor, and only Victor | Even the creature says "Farewell, Frankenstein!" to the dead man (chapter 24) | "Frankenstein" as the creature's name |
| Character | **Victor Frankenstein**, **Elizabeth Lavenza**, **Henry Clerval**, **Justine Moritz**, **Alphonse**, **Caroline Beaufort**, **William**, **Ernest**, **Robert Walton**, **Mrs. Saville**, **M. Waldman**, **M. Krempe**, **De Lacey / Felix / Agatha**, **Safie**, **Mr. Kirwin** | Spellings as printed | "Waldmann", "Clervel", "Sophie" |
| Character | No assistant character exists | The text is silent; Victor works alone throughout both builds | "Igor", "Fritz", any lab assistant |
| Place | **Ingolstadt**, **Geneva**, **Belrive**, **Plainpalais**, **Mont Salêve**, **Secheron**, **Chamounix**, **Montanvert**, **the sources of the Arveiron**, **Evian**, **the Orkneys** | Spellings as printed | "Chamonix", "Sécheron", "Mont Salève" |
| Place | **the sea of ice** | The text's own phrase for the glacier | "Mer de Glace" (never appears in this text) |
| Place | **the hovel** (the creature's hide) and **the cottage** (the De Laceys') | chapter 11 | "the shed", "the cabin" |
| Object | **the instruments of life** — the unnamed apparatus of animation | chapter 5 | Lightning rods, levers, a raised slab, any switch-throwing |
| Object | **the miniature of Caroline Frankenstein** — the single object that convicts whoever holds it | chapter 7, chapter 8, chapter 16 | "locket" as a different object |
| Object | **the journal of the four months** — Victor's own build record, held and produced by the creature | chapter 15 | "the diary", "the blueprints" (it directs endeavours, it is not a plan) |
| Object | **the half-finished female** | chapter 20 | "the bride", "Frankenstein's bride" (a film construction; the text never names or describes her) |
| Object | **the three books** — *Paradise Lost*, a volume of *Plutarch's Lives*, the *Sorrows of Werter* | chapter 15 | Any substituted reading list |
| Rule term | **galvanism** | chapter 2 | "electricity" as a synonym for the animation method; the text never says how it was done |
| Rule term | **charnel-house**, **dissecting room**, **slaughter-house** | chapter 4 | "graveyard robbery" as the sole sourcing verb |
| Rule term | **the compact / the conditions / my oath** — the creature's contract vocabulary | chapter 10, chapter 17 | "quest", "deal" as flippant reskins |
| Rule term | **syndic**, **assizes**, **the ballots**, **absolution**, **excommunication**, **letters of introduction**, **diligence**, **cabriolet**, **laudanum** | chapter 8, chapter 16, chapter 19, chapter 21 | Modern equivalents that erase the period process; explain by consequence on first use instead |

## Where the text is silent

These are design space, not facts. Anything placed here must be labelled as invention
downstream.

- **The method.** Victor refuses to state it, twice, and says the steps that led to it were
  obliterated in his own memory; the creature intends to burn his body so nothing can be
  reconstructed (chapter 4, chapter 24). There is no procedure, no reagent list, no
  equipment description beyond "the instruments of life" and unnamed "chemical instruments".
- **Per-part provenance.** The text names three supplier types and one act of vivisection
  (chapter 4). It never itemises which part came from where, never names a donor, and never
  attaches a trait to a part. Any part-by-part build sheet is downstream invention.
- **The creature's face beyond the given description.** Nothing about a flat skull,
  fastenings, sutures or bolts. Those are film.
- **The female's appearance and mind.** She is "half-finished" and never described. Her
  hypothetical refusal of the compact is Victor's speculation, not a stated fact
  (chapter 20).
- **Whether the creature can be killed.** Never tested. He is shot in the shoulder and heals
  by waiting weeks with the ball still in him (chapter 16); nets and boats fail (chapter 23);
  he leaves alive (chapter 24). His declared funeral pile is intention, never shown.
- **Any numbers a system would need.** No stats, no thresholds, no durations of combat, no
  costs in currency beyond "a competent fortune" and unnamed sums. Stated quantities are
  only these: eight feet; twenty words at the first lesson — **Safie's** yield, not the
  creature's, and the distinction matters to anyone pricing a lesson ("The stranger learned about
  twenty words at the first lesson; most of them, indeed, were those which I had before
  understood, but I profited by the others", chapter 13); five inhabitants and three huts;
  five miles to the mainland; four miles offshore; a league of ice crossed in two hours;
  three weeks judged by provisions consumed; ten days to the wedding; two months in fever;
  three months' imprisonment; September 9th and the 11th.
- **Ernest's fate**, the De Laceys' and Safie's fate after they flee, and what became of
  Waldman and Krempe.
- **How the creature learned to write**, beyond having "procured writing implements" during
  his residence in the hovel and holding copies of Safie's letters (chapter 14).
- **Any mechanism by which the creator can command, recall, alter or repair what he made.**
  The text offers none, at any point.

## Adaptation boundaries

| Item | Boundary type | Evidence |
|---|---|---|
| Roster identities, positions and fates exactly as tabled above | immutable | see roster table |
| The creature is created wordless, is rejected on sight by every sighted human, and acquires language by eavesdropping | immutable | chapter 5, chapter 11, chapter 12, chapter 13 |
| The blind man is the only human who engages it as a person, and that channel is destroyed by being seen | immutable | chapter 12, chapter 15, chapter 16 |
| Victor holds the animating capacity before the body exists; assembly, not the spark, is the work | immutable | chapter 4 |
| Eight feet, proportionably large, chosen as a speed trade-off | immutable | chapter 4 |
| Shelley's creature description (yellow translucent skin over working muscle and vessels, lustrous black hair, watery eyes in dun-white sockets, straight black lips) | immutable | chapter 5 |
| Materials come from charnel-houses, the dissecting room and the slaughter-house, with living animals tortured; stock is admitted inadequate | immutable | chapter 4 |
| The method is never disclosed to anyone, including the reader | immutable | chapter 4, chapter 24 |
| Justine is convicted and executed on circumstantial evidence plus a coerced false confession, while Victor stays silent | immutable | chapter 8 |
| The contract: a companion of the same species in exchange for permanent exile, closed by oath, with a monitoring clause and no enforcer | immutable | chapter 17 |
| The female is destroyed unfinished, in the creature's sight, and the retaliation takes Clerval and then Elizabeth | immutable | chapter 20, chapter 21, chapter 23 |
| "I shall be with you on your wedding-night" is honoured against Elizabeth, not against Victor | immutable | chapter 20, chapter 23 |
| Force never resolves anything: Victor's attacks fail or miss, and the creature's superiority is elective | immutable | chapter 10, chapter 15, chapter 23 |
| The strangulation signature — finger-marks on the neck — on every kill | immutable | chapter 7, chapter 21, chapter 23 |
| The creature outlives Victor and departs alive across the ice | immutable | chapter 24 |
| Testimony reaches the reader through Walton's transcription, corrected and augmented by Victor | immutable | Letter 4, chapter 24 |
| Travel durations, distances and the number of stops on any itinerary | adaptable | chapter 18, chapter 19, chapter 24 |
| Which specific letters arrive when, and how much of an illness a third party conceals | adaptable | chapter 5, chapter 6, chapter 19 |
| How long the creature observes the cottagers, and how many chores he performs | adaptable | chapter 12 |
| Vivisection and the child's murder — retained as world facts and stated causes, never as rewarded actions | adaptable | chapter 4, chapter 16 |
| Shelley's framing of Safie's flight from the harem — retained as period text, not extended into a system | adaptable | chapter 14 |
| The court's procedural detail beyond ballot, witnesses, composure and alibi | adaptable | chapter 8, chapter 21 |
| Any per-part build sheet, trait table, numeric cost, meter or score | open | text silent; see "Where the text is silent" |
| The female's appearance, mind and voice | open | chapter 20, text silent |
| The interface through which the creature's grievances are presented, if any | open | text silent |
| Whether a player may see the animated result before committing to it | open | chapter 5 establishes only that Victor could not |
| The creature's death or survival after it leaves the ship | open | chapter 24 declares intent, shows nothing |
| Victor's dying verdict — "my duties with regard to my own species had greater claims" and his conduct "not blamable" — against his own earlier admission that he is "not in deed, but in effect, the true murderer" | conflicted | chapter 9, chapter 24 |
| Elizabeth's kinship: the 1831 text makes her an unrelated Milanese orphan, yet chapter 18 retains the 1818 line "I love my cousin tenderly and sincerely" | conflicted | chapter 1, chapter 18 |
| The creature's self-account — "I was benevolent and good; misery made me a fiend" — against his own premeditated framing of Justine and his stated pleasure at creating desolation | conflicted | chapter 10, chapter 16 |

## Risks

- **Visual contamination is the largest risk.** The 1931 make-up, bolts, a flat skull, a
  lightning-rod laboratory, a raised slab, a thrown switch and the line "It's alive" are all
  from film, not from this text. The book's only laboratory lighting is a nearly burnt-out
  candle and rain on the panes (chapter 5), and its only lightning strike destroys an oak
  (chapter 2). Recent screen adaptations, including the 2025 film, are off-limits as
  reference.
- **Naming.** Calling the creature "Frankenstein" contradicts the text and the roster.
- **Mistaking the set pieces for the systems.** The animation, the wedding night and the
  coffin scene are each single events. Anything presented as a loop must be traceable to
  the recurring structures above.
- **Handling of the child's murder, the vivisection, the coerced confession and the framing
  of Justine.** All four are load-bearing source facts and must remain causes with visible
  consequences rather than rewarded player actions.
- **Importing a combat model.** Nothing in 24 chapters supports one, and the text
  explicitly rules pursuit and force out by Victor's own reasoning (chapter 17, chapter 23).
- **Public domain is not a licence for everything adjacent.** The novel is free; particular
  later designs, names and images attached to it are not.
