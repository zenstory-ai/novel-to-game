# Turning a novel into a playable game: NovelToGame compared with story-to-game builders

NovelToGame (`zenstory-ai/novel-to-game`, MIT, 5 agent skills for Claude Code, Codex and Kimi Code) is not a game engine and not a hosted generator. It is a design-and-build pipeline that runs inside your coding agent: it extracts cited evidence from the novel into a `SOURCE_BIBLE`, compares concepts, writes `GAME_DESIGN` and `ART_DIRECTION`, builds by adapting to the rendering stacks and asset tools available in your environment, and ends with first-player blind playtesting plus one complete-run QA receipt on the actual build. Two public adaptations are playable in a browser today: a turn-based RPG and a romance ADV.

## Three shapes of tool

| Shape | Example | What you get | Where the design lives |
|---|---|---|---|
| Desktop engine with a story-to-game feature | [Summer Engine Story-to-Game](https://www.summerengine.com/story-to-game), a Godot 4 compatible engine | An editable, exportable game project; the user chooses the genre | In project scenes and scripts |
| Single-purpose open-source script | Various "Story-to-game" repositories on GitHub | A generated game in one fixed format | In the script's template |
| Agent skill pipeline | NovelToGame | Source-cited design documents plus a build for the engine or platform you approve, plus a QA record | In Markdown files you own, engine-independent |

Engine-based generators and template scripts have their own production workflows; check the supported formats and editing tools before choosing one. NovelToGame makes the game shape an explicit design decision and keeps the design documents independent of any single model or engine.

## The pipeline

```text
Novel → Source analysis → Concept → World design → Risk-matched whitebox ↺ → Art direction → Production build → QA → Playable game
```

| Skill | Responsibility |
|---|---|
| `novel-to-game` | Confirm requirements, lock `PRODUCT_BRIEF.md`, orchestrate handoffs, recover progress |
| `novel-game-analyze` | Extract rules, player verbs, spaces, character will, systems and visual anchors with citations into `SOURCE_BIBLE.md` |
| `game-design` | Stage-own concept selection (`CONCEPT.md`), world/system/narrative design (`GAME_DESIGN.md`), and visual/audio direction (`ART_DIRECTION.md`) |
| `game-build` | Probe host rendering stacks and 3D/2D/audio tools to build a risk-matched whitebox or the approved production game with rule self-checks |
| `game-qa` | Blind-playtest as a first-time player from cold start, reconcile against design specs, and record one complete-run receipt |

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

A one-line "turn this book into a game" prompt usually produces a reskin or a clickable plot summary. The analysis skill cites the text for hard rules, key character goals, turning points, endings and signature anchors, so later design decisions can be traced back to their source evidence. Additions the author approves are labelled as additions; open questions stay open rather than being filled in silently.

## What "evidence-based QA" means

QA does not claim whether the game is subjectively fun. It first runs an isolated blind playtest from the title screen as a first-time player without reading source code or design specs (`qa/playtest-report.md`), then reconciles findings against the design documents and records, in one complete execution on the tested runtime, that the build starts, renders, accepts input, runs the core loop, reaches at least one designed outcome, restarts, and states its limitations in `qa/verification.json`. Subjective impressions are separated from reproducible facts.

## Public examples

- Journey to the West, Three Borrowings of the Banana Fan: a Fantasy Westward Journey-style turn-based RPG with walkable scene maps, NPC quests and command-turn battles, design estimate 45 to 90 minutes, [play](https://xiyouji.vibecoco.ai), [case study](../examples/journey-to-the-west/)
- Jin Ping Mei, Ledger of Desire: galgame-style romance ADV with five heroine routes and 16 endings, 18+, [play](https://jinpingmei.vibecoco.ai), [case study](../examples/jin-ping-mei/)

Each case study links source provenance, concept trade-offs, design and art direction, runnable source, and the QA evidence.

## Limits

- The runtime is your choice and your responsibility; the skills build for the approved target, they do not ship an engine.
- Optional voice synthesises only selected high-value lines at build time; the whole novel is never sent to a TTS provider by default.
- Use material you own or are authorised to adapt.

## Start

```bash
npx skills add zenstory-ai/novel-to-game -g -y -a claude-code -s '*'
```

For Codex or Kimi Code, replace `claude-code` with `codex` or `kimi-code-cli`.

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
