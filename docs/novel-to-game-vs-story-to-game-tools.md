# Turning a novel into a playable game: NovelToGame compared with story-to-game builders

**Short answer:** NovelToGame (`zenstory-ai/novel-to-game`, MIT, 7 agent skills for Claude Code, Codex and Kimi Code) is not a game engine and not a hosted generator. It is a design-and-build pipeline that runs inside your coding agent: it extracts cited evidence from the novel into a `SOURCE_BIBLE`, compares concepts, writes `GAME_DESIGN` and `ART_DIRECTION`, builds for the runtime you choose, and ends with evidence-based QA that launches the actual build. Three public adaptations are playable in a browser today, including a first-person WebGL2 3D game.

This page is for people comparing "story to game" options. It describes what this repo does and, where a competitor is named, only what that competitor states publicly.

## Three shapes of tool

| Shape | Example | What you get | Where the design lives |
|---|---|---|---|
| Hosted engine with a story-to-game feature | Summer Engine's Story-to-Game (a Godot 4 compatible visual-novel builder, per its site) | A visual novel built inside that engine from your story | Inside the product |
| Single-purpose open-source script | Various "Story-to-game" repositories on GitHub | A generated game in one fixed format | In the script's template |
| Agent skill pipeline | NovelToGame | Source-cited design documents plus a build for the engine or platform you approve, plus a QA record | In Markdown files you own, engine-independent |

The first two decide the game shape for you. NovelToGame makes the shape a documented decision with a named owner, and keeps the design documents independent of any single model or engine.

## The pipeline

```text
Novel → Source analysis → Concept → World design → Risk-matched whitebox ↺ → Art direction → Production build → QA → Playable game
```

| Skill | Responsibility |
|---|---|
| `novel-to-game` | Confirm requirements, lock `PRODUCT_BRIEF.md`, orchestrate handoffs, recover progress |
| `novel-game-analyze` | Extract rules, player verbs, spaces, character will, systems and visual anchors with citations into `SOURCE_BIBLE.md` |
| `game-concept` | Compare meaningful alternatives, apply hard vetoes, select a playable direction |
| `game-world-design` | Player promise, core loop, world response, systems, level pacing, failure and outcomes |
| `game-art-direction` | Camera, composition, visual grammar, colour, light, HUD, motion, sound |
| `game-build` | A risk-matched whitebox first, then the approved production candidate, without redesigning it |
| `game-qa` | Launch the real build and prove rendering, input, core loop, one designed outcome, restart and explicit limitations |

Each run creates one workspace:

```text
game-adaptations/<project>/
  PRODUCT_BRIEF.md
  analysis/SOURCE_BIBLE.md
  concepts/CONCEPT.md
  design/GAME_DESIGN.md
  design/ART_DIRECTION.md
  build/BUILD_BRIEF.md
  build/app/
  qa/verification.json
  _progress.md
```

## What "source-grounded" means

A one-line "turn this book into a game" prompt usually produces a reskin or a clickable plot summary. The analysis skill instead cites the text for every rule, space and character motive it extracts, so a later design decision can be traced back to a passage. Additions the author approves are labelled as additions; open questions stay open rather than being filled in silently.

## What "evidence-based QA" means

QA does not ask whether the game is fun. It launches the build on the selected runtime and records, in one complete execution, that it starts, renders, accepts input, runs the core loop, reaches at least one designed outcome, restarts, and states its limitations. The record is `qa/verification.json` with screenshots. Subjective quality is reported as observation, not verdict.

## Public examples

- Journey to the West, Three Borrowings of the Banana Fan: turn-based, 45 to 90 minutes, [play](https://xiyouji.vibecoco.ai), [case study](../examples/journey-to-the-west/)
- Jin Ping Mei, Ledger of Desire: household-management narrative, 18+, [play](https://jinpingmei.vibecoco.ai), [case study](../examples/jin-ping-mei/)
- Project Plateau, The Lost World: first-person 3D field photography, desktop WebGL2, [play](https://plateau.vibecoco.ai), [case study](../examples/project-plateau/)

Each case study links source provenance, concept trade-offs, design and art direction, runnable source, and the QA evidence.

## Limits

- The runtime is your choice and your responsibility; the skills build for the approved target, they do not ship an engine.
- Optional voice synthesises only selected high-value lines at build time; the whole novel is never sent to a TTS provider by default.
- Use material you own or are authorised to adapt.

## Start

```bash
npx skills add zenstory-ai/novel-to-game -y -g
```

Planning-only first brief, no build:

```text
Using my authorized source, plan one small gameplay-design slice for my target engine.
Keep the choices and outcomes bounded; show each option's evidence, cost, visible effect, and where a later scene uses its state.
Label allowed additions and unresolved questions. Deliver design notes only. Do not build, run QA, or claim a finished runtime.
```

## Related

- Repository: https://github.com/zenstory-ai/novel-to-game (formerly `worldwonderer/novel-to-game`; old links redirect)
- Site guides: https://zenstory.ai/novel-to-game/quick-start , https://zenstory.ai/novel-to-game/meaningful-choices
- Sibling packs: web-fiction writing (`oh-story-claudecode`), short drama (`drama-skills`), video recap (`video-recap-skills`)
