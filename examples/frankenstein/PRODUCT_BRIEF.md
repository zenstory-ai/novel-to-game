# PRODUCT_BRIEF · *Frankenstein; or, The Modern Prometheus*

> Requirements-intake output. Locks the product frame; downstream stages inherit it and may
> not silently rewrite it. Source: `source/frankenstein.txt` (Project Gutenberg #84, 1831
> revised edition). Facts about the novel are cited by chapter throughout, per
> `example.json` (`"language": "en"`, 24 chapters, four framing letters).
>
> **No user was available to confirm these values** — this brief was produced inside an
> automated pipeline run. Every row is therefore a *reasoned proposal*, and the whole
> document is listed under "Unconfirmed assumptions" at the bottom. Challenge any row there.

## The eleven dimensions

| # | Dimension | Locked value |
|---|---|---|
| 1 | Platform & form (incl. performance budget) | Web, open-and-play, no backend. Desktop landscape; target viewport 1280×800, minimum 1280×720. Mouse-primary with full keyboard alternative. Performance budget: local first paint ≤ 2 s, total assets ≤ 25 MB, ≥ 60 FPS target and ≥ 30 FPS floor at target viewport (real-time simulation, so the floor is load-bearing, not cosmetic) |
| 2 | Target market & interface language | Western market (US / UK / EU); interface English. Fixed by the hard rule *source language → market*: the novel is English, so all benchmarks are Western-market titles |
| 3 | Genre + benchmarks | **Real-time top-down stealth — the "vision-cone / stealth strategy" lane — in its non-violent, social-stealth subtype.** Closed jointly with the concept stage in this same pass; the two rejected lanes and the full verified benchmark matrix are in `concepts/CONCEPT.md`. Benchmarks: *Untitled Goose Game*, *Shadow Tactics: Blades of the Shogun*, *Hitman: World of Assassination* (see matrix below) |
| 4 | Art style | 2D hand-drawn in the register of late-18th-century copperplate engraving and aquatint: ink hatching, laid-paper ground, one warm candle/hearth accent against night blues. Top-down cottage plan for play, one framed interior plate for the chink view, one Shelley-faithful creature portrait at the pool (chapter 12). **Explicitly not** the 1931 Universal make-up and not any recent screen adaptation (see `source/SOURCE.md`) |
| 5 | Content rating / NSFW | All-ages (≈ ESRB E10+ / PEGI 7). Thematically dark, no gore, no on-screen violence, no player kill verb. The novel's killings, the vivisection (chapter 4) and the framing of Justine (chapter 16) stay outside the playable slice and are never rewarded player actions |
| 6 | Core fantasy | You are the thing everyone screams at. From a hole in the wall you learn one poor family's whole day by heart and keep them fed and warm through a winter they never know you touched — and what you dread is not them but daylight, right up to the minute you knock while the one man who cannot see you is alone in the house, and he answers you like a person |
| 7 | Session length & structure | 20–30 minute single-player slice: eight playable nights on the household's chore circuit plus one daytime entry attempt and an epilogue card. One continuous run, no meta-progression; a stated replay hook (a second run buys more language from the same night budget) |
| 8 | Publishing / monetisation | Free web slice, self-published as a pipeline example. No purchases, ads, gacha or accounts. `N/A` beyond that |
| 9 | Engine (two layers) | **Prototype (this deliverable): zero-build native ES modules + Canvas 2D, no dependencies, no build step** — a handcrafted map with scripted NPC waypoints needs no engine, and a build step would break the repo's one-pass constraint. **Production direction:** Phaser (MIT; Phaser 4 released 10 Apr 2026, stable 4.1.0 as of 30 Apr 2026) or Godot 4.x web export (MIT; WebGL 2.0, Godot 4.6.3 stable as of June 2026) — both verified by web search this pass |
| 10 | Player structure & social form | Single-player, offline, no accounts, no leaderboards, no multiplayer — in the slice *and* in the intended finished product. Social play is not part of the core fantasy: the fantasy is being unable to be seen by anyone |
| 11 | Audience profile | Mid-core Western players who already buy stealth and systemic indies; all genders; primary motivation immersion + mastery of a small legible system, secondary motivation narrative. Decision density is moderate and continuous rather than menu-dense; onboarding is by consequence and short diegetic prompts, never a tutorial wall or a lore quiz |

Additional locked items (not one of the eleven, but under the same no-silent-rewrite protection):

- **Player identity and slice:** the creature, chapters 11–16 — from waking in the forest to
  the door of the De Lacey cottage. Victor appears only as a found document (the journal of
  the four months, chapter 15) and in the epilogue.
- **Camera:** top-down plan of the cottage, garden, wood and chore circuit, plus one framed
  interior view through the chink (chapter 11).

## Benchmark matrix (one principle each)

Full matrix with per-row verification status, sources and exclusions is in
`concepts/CONCEPT.md`. Condensed here:

| Benchmark | Market | The one principle borrowed | Verification |
|---|---|---|---|
| *Untitled Goose Game* (House House / Panic, 2019) | Western indie, 1 M+ copies in ~3 months, D.I.C.E. Game of the Year | A complete game whose only system is *NPC perception and reaction to your presence* — no combat verb anywhere | Verified (Wikipedia; Forbes / Engadget on sales) |
| *Shadow Tactics: Blades of the Shogun* (Mimimi / Daedalic, 2016, Metacritic 85) | Western PC/console | The drawn **vision cone** as the entire information model: the player plans against visible perception, not against dice | Verified (Wikipedia) |
| *Hitman: World of Assassination* (IO Interactive) | Western PC/console | NPC routines generate **opportunity windows**; waiting for a configuration *is* the skill | Partially verified (multiple guide/press sources; no first-party citation obtained) |

Genre currency in this market, verified this pass: *Metal Gear Solid Δ: Snake Eater* passed
1 million units within about a day of its 28 Aug 2025 launch (Konami release plus PC Gamer /
Gematsu), and *Assassin's Creed Shadows* was among 2025's best-selling new releases (~2.4 M
in two months). Stealth is a lane Western players currently buy, not a clever obscurity.

## Explicit non-goals

Combat, weapons, a kill verb or any resolvable fight (nothing in 24 chapters is settled by
force — chapter 10, chapter 15, chapter 23); gore; open world; multiplayer or backend;
gacha, energy or daily loops; branches that reverse the novel (the De Lacey channel is
destroyed either way — chapter 16); giving the creature a proper name; calling the creature
"Frankenstein"; menu-driven discrete-turn play as the primary input (see below).

## Portfolio constraint on this example

This is the pipeline's third worked example and its first English one. The two shipped
examples (西游记, 金瓶梅) are, stripped of theme, the same machine: menu selection, discrete
time, numbers and state in the foreground. A third example in that shape would weaken the
product claim that the pipeline derives *different kinds of game* from different books.
This brief therefore treats **input modality and time model as a selection criterion with
real weight** — the chosen direction must move at least two of: direct manipulation,
spatial reasoning, continuous pressure, physical constraint. It is a weighted criterion,
not a veto: the concept stage was required to carry one honest menu-driven control
direction and compare against it (`concepts/CONCEPT.md`, direction 3).

## Compliance notes

- The 1831 text is public domain (US, UK, EU). The **1931 Universal make-up** — flat head,
  neck electrodes, green pallor — is separately copyrighted and off-limits; the creature is
  drawn from Shelley (chapter 5): yellow translucent skin over working muscle and vessels,
  lustrous black hair, watery eyes in dun-white sockets, straight black lips, eight feet
  (chapter 4). Recent screen adaptations, including the 2025 film, are off-limits as visual
  reference.
- All-ages rating constrains the slice, not the source. Chapters 11–16 contain the novel's
  cottage material; the boy's murder and the planting of the miniature (chapter 16) fall
  after the slice and appear, if at all, as authored epilogue text — never as verbs.
- No real persons; no minors in any intimate or sexualised context (there are none in the
  slice at all).
- Period vocabulary from the text (*the hovel*, *the cottage*, *the chink*, *the three
  books*, *the journal of the four months*) is retained per the bible's terminology table;
  it is explained by consequence on first use, not glossed.

## Unconfirmed assumptions

- **All eleven rows are unconfirmed by a human.** No interactive confirmation step ran in
  this pipeline pass; the values are derived from the source, the repo's portfolio need and
  the stated hard limits.
- Genre popularity (row 3) is evidenced by sales and awards for *neighbouring* titles, not
  by data on the exact subtype "non-violent real-time stealth around one household". No
  market data exists for that intersection; the honest claim is that the *lane* sells in
  this market and the *subtype* has one acclaimed proof point (*Untitled Goose Game*).
- The *Hitman* row is only partially verified — mechanics corroborated across secondary
  guides and press, no first-party design source obtained.
- 20–30 minutes (row 7) is an estimate; nothing has been timed with a real player.
- Performance budget (row 1) is proposed, not measured. Real-time vision cones in Canvas 2D
  at 1280×800 have not been profiled.
- Audience profile (row 11) is reasoned from the benchmark set, not validated with players.
