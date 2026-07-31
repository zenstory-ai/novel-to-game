# PRODUCT BRIEF · Project Plateau

> Intake artifact. These product boundaries are protected upstream facts; downstream stages may not silently rewrite them.

## Eleven locked dimensions

| # | Dimension | Locked value |
|---:|---|---|
| 1 | Platform, viewport, performance | Free desktop web vertical slice; landscape; target `1440×900`, minimum `1280×720`; keyboard and mouse. At the heaviest real state: median `>=45 FPS`, 1% low `>=30`; initial compressed payload `<=20 MB`, full on-demand payload `<=50 MB`, no-cache TTI `<=8 s` at 25 Mbps. Mobile and touch are not P0. |
| 2 | Target market and interface language | International English-speaking release; planning artifacts and launch UI are English. The source is also English, so no parallel translation layer is needed. |
| 3 | Genre, precedents, spatial form | Real-time first-person 3D connected-zone survival adventure with limited defensive action—not an arena shooter or walking simulator. It borrows mature verbs from the precedent matrix below. |
| 4 | Product-level art style | Stylized expedition naturalism: readable 1890s field equipment, monumental basalt and vegetation silhouettes, humid atmospheric depth, restrained danger rather than gore. Exact camera, palette, materials, creature grammar, and signature frames remain owned by ART_DIRECTION. |
| 5 | Rating / NSFW | Teen-equivalent: peril and creature attacks, no gore, dismemberment, sexual content, or modern franchise imagery. |
| 6 | Core fantasy | **You are the expedition's forward scout: cross an impossible plateau, document a living prehistoric world, survive its threats, and extract with proof.** The player must perform scout / document / survive / extract rather than receive them as narration. |
| 7 | Session length and structure | One 5–8 minute complete run: enter → read the space → obtain proof → survive route pressure → extract or fail → restart. Expansion to 8–12 minutes is allowed only after the complete primitive run and performance gates pass. |
| 8 | Release / business | Open-source repository example and free anonymous web demo; no account, ads, monetization, analytics SDK, or backend. |
| 9 | Engine, production and prototype | Web-native 3D. P0 implementation uses local npm assets with Three.js `0.185.1` and Vite `8.2.0`; no CDN runtime dependency. WebGL2 is the compatibility floor. Raw WebGL is rejected for schedule risk; Babylon.js is the fallback only if the S0 collision/input spike fails. |
| 10 | Player and social structure | Single-player only; no login, leaderboard, asynchronous ghosts, simulated multiplayer, or network state. |
| 11 | Audience | Players and developers who know first-person 3D controls but need not know the novel. They should recognize action/exploration within 30 seconds and understand the scout/proof/extract premise from the screen alone. |

## Precedent matrix

These are gameplay precedents, not visual or IP licenses. No names, creatures, audio, UI art, maps, or fiction are copied.

| Released precedent | Verified product source | One transferable rule |
|---|---|---|
| *The Long Dark* | [Hinterland product page](https://www.hinterland.com/creations/the-long-dark) | First-person route-finding makes the environment itself the primary survival problem; landmarks and exposure carry more weight than combat. |
| *Subnautica* | [Unknown Worlds games page](https://unknownworlds.com/en/games) | Enter an unknown ecosystem to observe, gather knowledge, and survive; wonder and danger share the same exploration route. |
| *Alien: Isolation* | [Steam product page](https://store.steampowered.com/app/214490/Alien_Isolation/) | A persistent threat is primarily evaded and outsmarted; a defensive tool buys space but does not turn the loop into clearing enemies. |

Shared core verbs and loop structure: **traverse → observe/document → read threat → evade or spend limited defense → choose route → extract**.

## Explicit non-goals

- A true open world, vehicle or racing system, multiplayer, crafting tree, base building, progression tree, multiple weapons, or a full-novel campaign.
- Page-to-page navigation, dialogue-choice presentation, prerendered footage, or text panels masquerading as 3D play.
- Modern film/game creature designs, logos, music, dialogue, actor likenesses, or promotional art.
- Killing every threat as the optimal or zero-cost path.

## Source and rights boundary

The adaptation uses Arthur Conan Doyle's 1912 novel as distributed in Project Gutenberg eBook #139. The catalog marks it public domain in the USA; users and distributors outside the USA must check local law. Project Gutenberg's license and trademark terms remain in the downloaded source file. Only the plain text and facts evidenced from it may inform the adaptation.

## Confirmed decisions and recorded assumptions

The user explicitly requested an English 3D example in an FPS, racing, or open-world shape to counter the impression of a text-only toolkit. The accepted execution plan selected the bounded first-person connected-zone direction, English UI, real 3D, and a complete 5–8 minute slice.

The following implementation-level choices are recorded assumptions, not additional user promises: Three.js/Vite as the S0 candidate; the three precedent rules above; stylized expedition naturalism; Teen-equivalent presentation; desktop keyboard/mouse audience. A failed technical or perception gate may return here for an explicit revision, but downstream work may not silently change them.
