# Changelog

All notable changes to NovelToGame are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
release dates use YYYY-MM-DD.

Sections use the six Keep a Changelog categories. A change that starts refusing
input which previously passed belongs under `Changed`, not `Fixed`.

## [Unreleased]

## [0.6.1] - 2026-10-20

### Changed

- `novel-to-game` now says exactly where `director` stops: the concept, what to cut after the whitebox playtest (where a target player can be brought in), and the visual targets only when a target pack is made.
- Each rule now appears once inside its skill. game-build keeps its design boundary in `SKILL.md` and its required-asset failure rule in the build brief contract, and the Blender, sprite, media, voice and playable-model references no longer repeat them. game-qa keeps "exactly six checks" and the evidence-layer rule only in the QA contract. novel-game-analyze states the full-coverage rule four times instead of six; its cast roster and per-fact table are now described as lookups for later stages, not as "handoff gate" baselines that no skill defines. The orchestrator states the low-risk/high-risk intake rule three times instead of five, and its pipeline contract drops three paragraphs that game-build already owns or that no longer apply. Six negations of rules that never existed are gone. Skills shrink from 1126 to 1106 lines with no intended behaviour change ([decision note](.agents/notes/implemented/simplification/2026-10-20-skill-intra-duplication-cleanup.md)). No blind A/B (maintainer decision, 2026-10-20).
- The three example games drop defensive code that could never fire: fallbacks on state that is always initialised, nested runtime freezes, eleven copies of one GLB loader, explanation strings nobody reads, and empty catches around Web Audio synthesis. Storage, save, network and browser-capability boundaries are unchanged ([decision note](.agents/notes/implemented/simplification/2026-10-20-example-code-defensive-cleanup.md)).
- ClawHub packages in this release: `game-art-direction` 1.2.1, `game-build` 1.2.1, `game-concept` 1.2.1, `game-qa` 1.0.2, `novel-game-analyze` 1.0.1, `novel-to-game` 1.1.2; `game-world-design` stays at 1.1.1.

### Removed

- The example planning docs and both READMEs say each caveat once: the "no modern adaptations" rule stays in each source note and art direction, what automation cannot judge stays in `qa/verification.json` and the README FAQ, and revision logs are gone from the Journey to the West build brief and the Jin Ping Mei and Project Plateau briefs ([decision note](.agents/notes/implemented/simplification/2026-10-20-example-docs-drop-repeats-and-revision-logs.md)).
- Removed the data-source section from the Jin Ping Mei game design appendix (internal database, collection names and book IDs); its writing rules and character voices are unchanged ([decision note](.agents/notes/implemented/bug-fix/2026-10-20-example-docs-match-code-and-drop-corpus-sources.md)).

### Fixed

- Example docs now agree with each other and with the games: Journey to the West counts ten story segments, rejects its second direction against the 45–90 minute brief, and records which brief values the user decided and how each image batch was made; Jin Ping Mei names the no-lamp ending as the game does and calls itself a romance ADV throughout; Project Plateau names one brook, describes the compatibility message small screens actually get, and drops undefined internal codes. README's install heading now matches its `npx skills` commands, and `quick`'s stopping rule is stated once. `docs/production-delivery.md` explains how to run the deployment observation and `docs/source-release.md` how to verify a ClawHub release ([decision note](.agents/notes/implemented/simplification/2026-10-20-example-docs-drop-repeats-and-revision-logs.md)).
- The Journey to the West game design no longer contains function names, data keys, storage keys or test paths, and now matches the game: repeating a command retargets the nearest living enemy, the boss's charged strike always hits the lowest-HP ally, the second Rakshasi fight totals 2070 enemy HP, skill names match the data, the menus sit in the bottom-right bar and Settings, the final battle has one demon general, and auto-battle only basic-attacks in boss fights. Its second pillar is the command-turn feel chosen in the concept again. Art direction now describes the battle lines as they render.
- Decision notes now state current facts: the 1300-line skill budget, the removed README link-order check, which score belonged to which arm in the design-drift A/B, and links from superseded deployment notes to the note that replaced them. The 2026-10-19 notes no longer list skipping the A/B as a design alternative, and the 0.6.0 changelog marks the four untested changes in their own entries.
- The release policy now checks `kimi.plugin.json`, so its version can no longer drift from `VERSION` unnoticed.

## [0.6.0] - 2026-10-19

### Added

- game-build gains an opt-in route for 2.5D characters that need consistent multi-direction, multi-action sprites: generate a 3D model from the approved character target, auto-rig it, render every direction and action through the game's own camera and light, then pack an atlas and check turns, foot sliding and pivot jitter in the real game view ([decision note](.agents/notes/implemented/feature/2026-10-19-baked-sprite-workflow.md)). Shipped without blind A/B.
- A source-bound release workflow: a stable `vX.Y.Z` tag on green `main` publishes an append-only source archive, verifies it anonymously, and hands the exact tag and commit to the ClawHub workflow; pull requests and manual runs only validate ([docs/source-release.md](docs/source-release.md)).
- A read-only, manually triggered deployment observation that ties the exact `main` commit's CI to the latest Vercel production deployment of each example and to its public origin, without deployment credentials ([docs/production-delivery.md](docs/production-delivery.md)).
- `CLAUDE.md` imports `AGENTS.md`, so Claude Code loads the repository contract.

### Changed

- game-build now hands a factual mismatch between the built candidate and GAME_DESIGN or ART_DIRECTION back to the owning stage, or marks it as a conflict in BUILD_BRIEF, instead of leaving documents that describe play, presentation or sound that no longer exists. A companion sentence restoring the on-screen-text rule for narrative-led designs lost its blind A/B (7.33 vs 6.92, eight samples per arm) and was not shipped; see the [decision note](.agents/notes/implemented/process/2026-10-03-build-writes-back-design-drift.md).
- The brief now records a production budget, and the pipeline reviews remaining budget against remaining scope twice, after the whitebox playtest and once about half the production must-haves are done. Rising per-task cost or parallel agents repeatedly editing the same files mean the project is near its ceiling: stop adding content, cut by what the player actually sees, and polish the always-on-screen interface and player character before scenes. The whitebox playtest now asks what players keep coming back to, and the story, dialogue and level budget set during concept and design is revised against that answer; `director` mode can pause there for a real target player. Concept selection also weighs content cost, favouring content that scales by recombination over a bespoke scene per chapter ([decision note](.agents/notes/implemented/process/2026-10-19-budget-rescope-and-whitebox-fun-check.md)). Shipped without blind A/B.
- Visual targets come as about three distinct original candidates per identity anchor, key moment and main screen; `director` mode pauses for the user's pick, `quick` mode picks against the written criteria, and batch asset production starts only after the pick. In production, game-build compares runtime screenshots side by side with each approved target, fixes the listed differences, and stops after two rounds without improvement, recording what remains in BUILD_BRIEF ([decision note](.agents/notes/implemented/feature/2026-10-19-visual-target-pick-and-runtime-match.md)). Shipped without blind A/B.
- When the same feel or presentation problem survives two fixes, game-build stops trying new variations and first looks up how shipped games solved it in public talks, postmortems or open-source code ([decision note](.agents/notes/implemented/process/2026-10-19-build-stuck-research-escalation.md)). Shipped without blind A/B.
- ClawHub pull-request validation runs offline against pinned central controls, and remote writers fail closed.
- ClawHub packages in this release: `game-art-direction` 1.2.0, `game-build` 1.2.0, `game-concept` 1.2.0, `game-qa` 1.0.1, `game-world-design` 1.1.1, `novel-to-game` 1.1.0; `novel-game-analyze` stays at 1.0.0.

### Removed

- Removed the Actions CLI deployer (`deploy.yml`); native Vercel Git integration is now the single production producer for the three examples, gated on the `repository` and ClawHub inventory checks.

### Fixed

- Polished all seven skills and the current docs, clarifying the scope of requirements intake and source evidence; both READMEs now describe capability in terms of actual hardware, cost and six-check QA records. The Jin Ping Mei example's copy rules and character voices moved unchanged into its game design, its source notes keep only facts and accurate links, and its established 18+ display boundary was corrected; Journey to the West's cited chapters, battle order and counts were fixed against the source text and the current implementation. All bad cases, paired examples, source texts, game code and real QA records are kept.
- The `game-world-design` description and Codex default prompt now promise a `GAME_DESIGN` with a buildable slice specification; the prototype itself stays with `game-build`.
- Journey to the West's concept and build brief now list the white-bull phase before the gods' gated assist, matching the game design and the build.

## [0.5.0] - 2026-10-02

### Changed

- Inherited the genre shell along with a borrowed genre: the concept method no longer lets a "not borrowed" list drop the parts players use to recognise the genre (entering the world, objective guidance, progression and reasons to return, reading and control conveniences), and system-led or hybrid world designs now carry a short shell table (implemented / degraded / not done, with reasons) plus what the first minute shows. Art direction gains a genre-quality bar measured against mainstream screenshots of the same genre (not applied at `targetFinish: graybox`), with 3D finish built in the order light → materials and ground → geometry. Narrative-led designs are exempt from the shell table after blind A/B showed it crowding out their buildability; the evidence is in the decision note.
- Character routes in narrative design now aim each key choice at that character's own wound or agenda rather than a reply that would please anyone, and show relationship progress through reactions, forms of address, places that open and things entrusted instead of on-screen numbers. Blind A/B on an ADV fixture scored 7.40 vs 7.18 for the previous wording (four samples per arm); the evidence is in the [decision note](.agents/notes/implemented/feature/2026-10-02-genre-shell-and-first-minute.md).
- Rebuilt Journey to the West as a Fantasy Westward Journey-style RPG: the command-turn battles now sit inside four painted click-to-walk scene maps with NPC quests marked "!" and "?", a quest tracker with auto-path, a minimap, chat channels, a repeatable demon-bounty daily, experience, silver, shops, gear, skill study, a pet panel, rage stunts and form sprites for the seventy-two transformations.
- Rebuilt Jin Ping Mei from a 20-day household-ledger simulation into a galgame-style romance ADV: a common route, an affection-gated door choice, five heroine routes with 16 endings, standing sprites with expressions, auto / read-only skip / backlog / hide / quick save / thumbnail saves / rollback, a CG gallery, scene replay, music room, ending flowchart and a fixed page of each heroine's fate in the novel. Age gating and adult-CG consent gating are kept.
- Overhauled the Project Plateau look (a low western sun, AgX tone mapping, ambient occlusion, bloom and a colour grade, Blender-baked ground textures, dense grass, a 1.8 m eye height and a distant cliff ring) and deepened its photo loop: a thorn-arch cover band with a blind, plates graded from what the live camera framed with stamps and a line from Summerlee, a long lens, a pterodactyl that circles before it dives, an optional stegosaurus at the brook, and 300 seconds of light for a 5–10 minute visit.
- ClawHub packages for the three changed skills move to 1.1.0 (`game-art-direction`, `game-concept`, `game-world-design`) with refreshed `packageDigest` locks, and `novel-to-game` 1.0.1 pins those companions at 1.1.0.
- The README shows the rebuilt examples with new screenshots, a new 15-second gameplay video captured from the Project Plateau build, and fresh excerpts.

### Removed

- Removed the Journey to the West design contract (`qa/design-contract.json`) and its checker (`qa/verify_design_contract.mjs`): a duplicate numeric source of truth beside the game's own data files.
- Removed the Jin Ping Mei playable-model contract (`qa/playable-model.json`) and its checker (`qa/verify_playable_model.mjs`) together with the 20-day engine they described, and its `visual-reconstruction-*` evidence images; `npm run verify:model` now runs the script linter (`test/lint_script.mjs`), which proves every ending reachable.
- Removed the Project Plateau overhead cloud field (`src/overhead-cloud-field.js`) with `overhead-cloud-field.test.js` and `atmosphere.test.js`; the painted sky and low sun replace it.

## [0.4.0] - 2026-09-21

### Added

- Added an opt-in Blender asset route to game-build: a short reference covering isolated scene export, target-loader semantic checks and in-game feedback, with a research note on the cases it draws from. Blender is not the runtime and the MCP server stays optional ([#49](https://github.com/zenstory-ai/novel-to-game/pull/49)).

### Changed

- Polished all three examples together: Jin Ping Mei rebuilt its title, opening and night-visit presentation and rewrote route copy; Journey to the West replaced 17 character assets with transparent illustrations and refreshed six environments; Project Plateau added river terraces, bars and canopy layers and waits for loaded assets before reporting readiness. Gameplay rules, save contracts and age gating are unchanged, and the QA evidence was re-recorded ([#46](https://github.com/zenstory-ai/novel-to-game/pull/46)).
- Simplified all seven skills by removing generic tutorials, fixed quotas and duplicate instructions, and separated causal reenactment from strategic trade-offs and source-level verification from player-visible discoverability testing ([#48](https://github.com/zenstory-ai/novel-to-game/pull/48)).
- Trimmed the hedges that game-qa, game-art-direction, game-build and the orchestrator each repeated inside one skill ("subjective fun is not a machine PASS" stated up to four times per skill, "do not stitch old PASSes" twice), and dropped two negations of rules that no longer exist ("do not mandate mid-high brightness or forbid scrolling", "do not allot each screen a fixed number of signature moments"). Each surviving rule lives once, in the file that owns it. The same trim was tried on game-world-design and reverted: blind A/B scored it 6.38 vs 6.84 with the slimmed arm winning 6 of 27 pairings, so those hedges stay.
- Removed the rules that each skill stated twice, once in its `SKILL.md` and again in the reference that skill already reads (29 lines across six skills), and made the art-direction identity calibration rule live only in its method file, where the two copies had drifted into different wordings. Blind A/B on an invented novel (three samples per arm for `game-concept` and `game-art-direction`, three judges: Opus, Sonnet, Codex) scored the slimmed skills 7.13 vs 6.87 and 7.27 vs 7.00, winning 34 of 54 pairwise placements; no regression detected at this sample size.
- Lowered the skills line budget from 1900 to 1300 so the current package size (about 1120 lines) becomes the ceiling instead of a distant target; the budget is the forcing function and a wide gap lets rules accumulate unnoticed.
- The Journey to the West example now records normal-speed cinematics, mobile viewports and reduced motion as a plain limitation of its one authoritative run instead of pointing at a second browser harness.
- Restored the bright title screen of the Jin Ping Mei example: the title-screen override added in [#46](https://github.com/zenstory-ai/novel-to-game/pull/46) for a since-withdrawn group portrait was still dimming the original cover on desktop and, on phones, still pinning the copy to the bottom and hiding the five-woman cast strip. Both the desktop and the mobile parts of that override were removed, the title screen is back on its original light rules at every breakpoint, and the README and QA title screenshots were re-recorded.

### Removed

- Removed the second QA harnesses that had grown beside each example's one authoritative command: the Jin Ping Mei readability checker and its unit test, the Journey to the West visual-refresh browser script, and the `test:complete-run` alias that duplicated `npm run verify` in Project Plateau.
- Removed historical evidence that described superseded candidates rather than the current run: the Jin Ping Mei visual-review and readability screenshots with their README section, and the Journey to the West visual-refresh screenshot set.
- Removed the README example-link-order check and the Vercel workflow test from the repository validator; both measured delivery rather than whether a game plays.
- Removed dead code from the example apps: twelve exports nothing imported (including three Project Plateau terrain profile constants that only described themselves), 31 Jin Ping Mei CSS rules for class names no script or markup emits, and a Project Plateau test that asserted the app shell carried no promotional media, which is a delivery check.
- Removed 22 Project Plateau unit tests and the constant-echo assertions inside 24 more (204 → 182 tests): asset size and SHA-256 fingerprints, budgets recomputed from their own constants, frozen profiles compared with the literals they were copied from, and a grep for remote URLs. Each remaining test fails only when behaviour changes. The `sha256` fields nothing read and two helpers only tests called went with them.
- Removed 73 optional-chaining and nullish-coalescing guards in the Jin Ping Mei engine where the save validator or the engine's own factories already make the value total; a differential replay over 14 seeded playthroughs produced identical state digests before and after. One guard that turned a bad heroine id into state corruption when removed was kept.
- Repository contracts now live only in `AGENTS.md`; `CONTRIBUTING.md` points there instead of restating them, and the pull request checklist shrinks from ten items to three.

## [0.3.1] - 2026-09-04

### Added

- Added default-brightness adjudication and historical-style calibration to art direction, with the matching production rules in the build brief ([#41](https://github.com/zenstory-ai/novel-to-game/pull/41)).

### Changed

- Refreshed both Chinese examples with a brighter neo-guofeng presentation, separated illustration from narrative UI, preserved authored character proportions on portrait mobile viewports, and updated the README screenshots ([#41](https://github.com/zenstory-ai/novel-to-game/pull/41)).
- Migrated the repository namespace to `zenstory-ai`; marketplace and install commands from earlier documentation no longer resolve.
- Collapsed the repository validator's QA schema checks into shared object and field helpers, folded the duplicated `targetFinish` inheritance and JSON-loading paths, and moved the English-first check for plugin manifest descriptions into the validator ([#44](https://github.com/zenstory-ai/novel-to-game/pull/44)).
- Plugin manifests must now declare `skills` as the `./skills` string; the single-element list form is no longer accepted. Example manifests and planning directories accept additional project-owned metadata, and chapter coverage may span multiple source text files ([#44](https://github.com/zenstory-ai/novel-to-game/pull/44)).
- Trimmed within-skill restatements so each rule lives once per skill, in either its `SKILL.md` or the reference that skill already reads, and tightened the prompt line budgets to the resulting package size ([#44](https://github.com/zenstory-ai/novel-to-game/pull/44)).

### Fixed

- Fixed Vercel deployments failing before upload: the CLI ran from each app directory and appended an already-applied Root Directory a second time. Deploys now run from the repository root ([#42](https://github.com/zenstory-ai/novel-to-game/pull/42)).

### Removed

- Removed dead validator code: an unused constant, unreachable regex defaults, the Reasonix guard, the repository-wide JSON scan, and argument parsing with no arguments ([#44](https://github.com/zenstory-ai/novel-to-game/pull/44)).
- Removed the tests that locked example-app internals or re-ran checks already covered by the validator's authoritative command. The minimal evidence fixture owns one executable path, and the Jin Ping Mei playable-model verifier runs in CI from its own example lane ([#44](https://github.com/zenstory-ai/novel-to-game/pull/44)).

## [0.3.0] - 2026-08-23

### Added

- Added a risk-matched whitebox stage and handoff contract between world design and art production, with replayable snapshots, event logs, knowledge boundaries, callbacks, and local patch verification ([#38](https://github.com/zenstory-ai/novel-to-game/pull/38)).
- Added an optional identity-specific `signature_command` contract. Concepts now state the player's job, recurring work loop, resistance chain, and advancement ladder; when adopted, the contract requires finite intents to pass deterministic validation and commit rules instead of granting generated text state authority ([#38](https://github.com/zenstory-ai/novel-to-game/pull/38)).
- Added a lightweight executable-model oracle for the Jin Ping Mei example, covering two distinct openings, three aftermath beats, knowledge provenance, deterministic replay, valid save reconstruction, and branch-pollution rejection ([#38](https://github.com/zenstory-ai/novel-to-game/pull/38)).
- Added the Journey to the West fire-vein treasure route and made tactical choices affect later combat state and outcomes ([#29](https://github.com/zenstory-ai/novel-to-game/pull/29), [#36](https://github.com/zenstory-ai/novel-to-game/pull/36)).
- Expanded the adult Jin Ping Mei example into a five-heroine, twenty-day relationship and household-management route with cross-courtyard cooperation, evidence, delayed reckonings, and explicit refusal boundaries ([#30](https://github.com/zenstory-ai/novel-to-game/pull/30), [#34](https://github.com/zenstory-ai/novel-to-game/pull/34), [#35](https://github.com/zenstory-ai/novel-to-game/pull/35)).
- Added player-led field observation and a field journal to Project Plateau, alongside stronger environment, threat, and evidence feedback ([#31](https://github.com/zenstory-ai/novel-to-game/pull/31), [#37](https://github.com/zenstory-ai/novel-to-game/pull/37)).

### Changed

- Made interactive fiction a first-class adaptation track while preserving the same agency and consequence requirements as system-led games ([#19](https://github.com/zenstory-ai/novel-to-game/pull/19)).
- Reduced QA to one evidence-backed path with exactly six player-visible checks; capability-specific regressions stay inside that path instead of creating parallel release gates ([#15](https://github.com/zenstory-ai/novel-to-game/pull/15), [#20](https://github.com/zenstory-ai/novel-to-game/pull/20)).
- Slimmed skill entry points, moved conditional depth into one-level references, added size budgets, and split oversized example modules by responsibility ([#27](https://github.com/zenstory-ai/novel-to-game/pull/27), [#28](https://github.com/zenstory-ai/novel-to-game/pull/28)).
- Strengthened all three playable examples so choices change concrete state, available actions, evidence, or later outcomes rather than only presentation ([#24](https://github.com/zenstory-ai/novel-to-game/pull/24), [#36](https://github.com/zenstory-ai/novel-to-game/pull/36), [#37](https://github.com/zenstory-ai/novel-to-game/pull/37)).

### Fixed

- Fixed Project Plateau exposure settlement and improved route readability without presenting deterministic automation as proof of subjective visual quality ([#32](https://github.com/zenstory-ai/novel-to-game/pull/32)).
- Removed duplicated QA reports, stale evidence surfaces, and redundant generated artifacts while retaining the authoritative runnable evidence path ([#15](https://github.com/zenstory-ai/novel-to-game/pull/15), [#25](https://github.com/zenstory-ai/novel-to-game/pull/25), [#28](https://github.com/zenstory-ai/novel-to-game/pull/28)).

### Validation boundaries

- The repository validator and 47 unit tests cover package, language, skill-budget, evidence, and example contracts.
- The Jin Ping Mei lightweight model verifier proves non-empty callback payloads but does not invoke all downstream callback consumers.
- No current example ships a runtime `signature_command` parser in v0.3.0; it is an adaptation and implementation contract, not a bundled universal parser or a requirement for every game.
- Automated checks do not prove subjective fun, long-term balance, broad device compatibility, commercial value, or rights beyond the recorded source and asset provenance.

## [0.2.0] - 2026-08-05

- Published Project Plateau as the complete English source-to-design-to-build-to-QA example.
- Established target-runtime delivery and the Minimal Evidence contract.
- Kept explicit limitations for native pointer lock, first-time human play, and subjective visual review.

## [0.1.0] - 2026-07-31

- Published the seven-skill source-grounded adaptation pipeline.
- Shipped the first playable Journey to the West and Jin Ping Mei examples.
- Added native plugin manifests and Agent Skills installation for the supported coding-agent surfaces.

[Unreleased]: https://github.com/zenstory-ai/novel-to-game/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/zenstory-ai/novel-to-game/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/zenstory-ai/novel-to-game/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zenstory-ai/novel-to-game/releases/tag/v0.1.0
