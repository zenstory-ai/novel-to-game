# Changelog

All notable changes to NovelToGame are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
release dates use YYYY-MM-DD.

Sections use the six Keep a Changelog categories. A change that starts refusing
input which previously passed belongs under `Changed`, not `Fixed`.

## [Unreleased]

### Changed

- Collapsed the repository validator's hand-written QA schema checks into shared object/field helpers, folded the duplicated `targetFinish` inheritance and JSON-loading paths, and moved the English-first check for plugin manifest descriptions into the validator. Plugin manifests must now declare `skills` as the `./skills` string; the single-element list form is no longer accepted. Example manifests and planning directories now permit additional project-owned metadata and supporting artifacts, and chapter coverage can span multiple source text files.
- Trimmed within-skill restatements so each rule lives once per skill, in either its `SKILL.md` or the reference that skill already reads, and tightened prompt line budgets around the resulting package size.

### Removed

- Removed dead validator code (an unused constant, unreachable regex defaults, the Reasonix guard, the repository-wide JSON scan, and argument parsing with no arguments) and the tests that locked example-app internals (module line budgets, import edges, stylesheet hashes, asset-ledger provenance) or re-ran checks already covered by the validator's authoritative command. The minimal evidence fixture now owns one executable path instead of duplicating its state assertions in a nested unit suite, and the Jin Ping Mei playable-model verifier runs in CI from its own example lane.

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

[Unreleased]: https://github.com/zenstory-ai/novel-to-game/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/zenstory-ai/novel-to-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zenstory-ai/novel-to-game/releases/tag/v0.1.0
