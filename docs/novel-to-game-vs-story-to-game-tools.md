# Turning a novel into a playable game: NovelToGame compared with story-to-game builders

NovelToGame (`zenstory-ai/novel-to-game`, MIT, five agent skills for Claude Code, Codex, and Kimi Code) runs inside your coding agent without bundling a standalone engine or hosted generator. Give it a novel: it maps the full book with chapter citations into `SOURCE_BIBLE`, compares gameplay concepts, writes separate `GAME_DESIGN` and `ART_DIRECTION` specs, builds the game with the rendering libraries and asset tools on your machine, and finishes with a new-player blind playtest plus an end-to-end verification run on the live build. Two public adaptations run directly in the browser today: a turn-based RPG and an interactive-film romance.

## Three shapes of tool

| Shape | Example | What you get | Where the design lives |
|---|---|---|---|
| Desktop engine with a story-to-game feature | [Summer Engine Story-to-Game](https://www.summerengine.com/story-to-game), a Godot 4-compatible engine | An editable, exportable game project in the genre you pick | In project scenes and scripts |
| Single-purpose open-source script | Various "story-to-game" repositories on GitHub | A generated game in one fixed format | In the script's template |
| Agent skill pipeline | NovelToGame | Cited design specs, a runnable build for your chosen platform or engine, and a blind-playtest QA record | In engine-independent Markdown files you own |

Engine-bound generators and template scripts suit teams already committed to one format—check their export targets and editing workflow first. NovelToGame treats gameplay selection as an explicit upfront step and keeps every design spec independent of any single model, engine, or host platform (supporting web, desktop, mobile, WeChat/Douyin mini-games, and TapTap Maker).

## The pipeline

```text
Novel → Source analysis → Concept → World design → Graybox playtest ↺ → Art direction → Full build → QA → Playable game
```

| Skill | Responsibility |
|---|---|
| `novel-to-game` | Confirm scope, lock `PRODUCT_BRIEF.md`, coordinate stage handoffs, and resume interrupted runs |
| `novel-game-analyze` | Read the full book and record main arcs, key conflict scenes, character relationships, secrets, world rules, and adaptation boundaries with citations in `SOURCE_BIBLE.md` |
| `game-design` | Step through gameplay selection (`CONCEPT.md`), world/system/narrative design (`GAME_DESIGN.md`), and visual/audio direction (`ART_DIRECTION.md`) as separate stage specs |
| `game-build` | Check local rendering, modeling, and media tools, turn the settled design into a playable graybox first and then the full build, polish in-game copy, and wire rule regressions plus an end-to-end verify command |
| `game-qa` | Cold-start blind-playtest from the title screen as a new player, check findings against the specs, and write one complete-run verification record |

Each run creates one self-contained workspace:

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

A one-line "turn this book into a game" prompt usually yields a generic reskin or a clickable plot summary. `novel-game-analyze` cites specific chapters for world rules, character agendas, turning points, endings, and signature spaces and props so downstream design choices trace back to the text. Approved inventions are labeled as new additions, and open questions stay explicit instead of being filled in silently.

## What "evidence-based QA" means

`game-qa` never claims deterministic proof that a game is subjectively fun. First, an isolated session blind-playtests from the title screen as a first-time player without reading source code or specs (`qa/playtest-report.md`), separating subjective impressions from reproducible defects. Next, it checks the build against the specs and runs one complete playthrough on the tested runtime to record `launch`, `render`, `input`, `coreLoop`, `outcome`, `restart`, and `limitations` in `qa/verification.json`.

## Public examples

- **Journey to the West · Three Borrowings of the Banana Fan** — a *Fantasy Westward Journey*-style turn-based RPG with four painted maps, NPC quests, and command-turn battles (~45–90 min): [play](https://xiyouji.vibecoco.ai) · [workspace](../examples/journey-to-the-west/)
- **Jin Ping Mei · Ledger of Desire** — an interactive-film romance with voiced post-choice cutscenes, five heroine routes, and 16 endings (18+): [play](https://jinpingmei.vibecoco.ai) · [workspace](../examples/jin-ping-mei/)

Each workspace includes source provenance, concept trade-offs, game and art specs, runnable code, and full QA records.

## Limits

- Platform and runtime remain your choice: the skills build for the target you approve and do not bundle a game engine.
- Optional voice generation synthesizes only approved lines at build time; the full novel text is never sent to external media providers.
- Use source material you own or are authorized to adapt.

## Start

```bash
npx skills add zenstory-ai/novel-to-game -g -y -a claude-code -s '*'
```

For Codex or Kimi Code, replace `claude-code` with `codex` or `kimi-code-cli`.

Planning-only prompt (design specs only, no code):

```text
Using my authorized source, plan one compact playable slice for my target engine.
Keep the branches and endings bounded; show each option's basis, cost, visible outcome, and which later scene follows up on it.
Mark new additions and open questions clearly. Deliver design specs only—do not write code, run QA, or claim a finished build.
```

## Related

- Repository: https://github.com/zenstory-ai/novel-to-game (formerly `worldwonderer/novel-to-game`; old links redirect)
- Site guides: https://zenstory.ai/novel-to-game/quick-start , https://zenstory.ai/novel-to-game/meaningful-choices
- Sibling packs: web-fiction writing (`oh-story-claudecode`), short drama (`drama-skills`), video recap (`video-recap-skills`)
