# NovelToGame

> Turn any novel into a playable web game.

NovelToGame is an open-source skill set that turns novels into playable web
games, for Claude Code, Codex, and Kimi Code. It reads the source for what is
actually playable, picks a strong adaptation direction, designs the world and
the on-screen experience, then hands a bounded build brief to a coding agent and
checks that the result runs.

[中文](README.md)

## Why It Exists

Hand a novel to a model and ask for a game, and you usually get a generic reskin.
NovelToGame solves the hard part: turning the book's own world, map, factions, quests, items, and drama into
player verbs and a core loop, deciding what game it should become, and driving
that all the way to a playable prototype.

## Pipeline

One orchestrator first frames the product, then drives six specialist stages,
from raw text to a verified, playable prototype.

```mermaid
flowchart LR
    classDef io fill:#fce4ec,color:#333,stroke:#e57373,stroke-width:1px
    classDef orch fill:#eef2ff,color:#1e1b4b,stroke:#6366f1,stroke-width:1px

    novel["📖 novel"]:::io --> orch["novel-to-game"]:::orch
    orch --> intake --> analyze --> concept --> world --> art --> build --> qa --> game["🎮 playable game"]:::io
    qa -.->|fails| build
```

`intake` is the first gate: before deconstructing anything, pin down the product frame with the user — **platform (client / web / mini-program), genre and benchmark titles (found in the market that matches the novel's language), art style, content rating / NSFW, core fantasy** — and lock it into `PRODUCT_BRIEF.md`, which every downstream stage must honor and may not silently rewrite.

## Skills

| Skill | Purpose |
|---|---|
| `novel-to-game` | Orchestrate the pipeline: first a requirements intake that locks `PRODUCT_BRIEF` (platform / genre + benchmarks / art style / rating / core fantasy), then quick or director mode |
| `novel-game-analyze` | Extract canon, verbs, systems, spaces, agents, and signature moments into a source bible |
| `game-concept` | Propose, reject, and choose between three genuinely different games |
| `game-world-design` | Define player experience, world behavior, systems, levels, and the playable prototype |
| `game-art-direction` | Define visual pillars, camera, world grammar, HUD, feedback, and signature frames |
| `game-build` | Produce the build brief and drive an implementation agent to a verified build |
| `game-qa` | Verify startup, rendering, interaction, state transitions, completion, and restart |

## Install With Agent Skills

Install all seven skills for the CLI you use:

| Agent CLI | Install command | Invoke |
|---|---|---|
| Claude Code | `npx skills add worldwonderer/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add worldwonderer/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add worldwonderer/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

To install all three adapters at once, repeat `-a`:

```bash
npx skills add worldwonderer/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

Cloning the repository also enables project-local discovery in all three CLIs.

## Native Plugin Install

Claude Code:

```text
/plugin marketplace add worldwonderer/novel-to-game
/plugin install novel-to-game@novel-to-game-skills
/novel-to-game:novel-to-game quick
```

Codex:

```bash
codex plugin marketplace add worldwonderer/novel-to-game
codex plugin add novel-to-game@novel-to-game-skills
```

Kimi Code 0.27 or newer:

```text
/plugins install https://github.com/worldwonderer/novel-to-game
/reload
/skill:novel-to-game quick
```

## Quick Start

```text
Turn this novel into a complete 15-minute web game with novel-to-game quick.
The player should enter the world as an original character rather than replay
the protagonist's exact plot.
```

`quick` is the default and auto-selects the best-evidenced concept. Use
`director` when you want to pick between three concept directions before world
design begins.

## Output

Each run creates a compact adaptation workspace:

```text
game-adaptations/<project>/
  PRODUCT_BRIEF.md
  analysis/SOURCE_BIBLE.md
  concepts/CONCEPT.md
  design/GAME_DESIGN.md
  design/ART_DIRECTION.md
  build/BUILD_BRIEF.md
  build/app/
  qa/QA_REPORT.md
  _progress.md
```

## Worked Example — Journey to the West

**三借芭蕉扇 (Three Borrowings of the Banana Fan)** — a turn-based command RPG in the 《梦幻西游》 tradition, distilled from the full 100-chapter public-domain text. **Play it: [xiyouji.vibecoco.ai](https://xiyouji.vibecoco.ai)**

![Title screen](examples/journey-to-the-west/screenshots/title.jpg)

<details>
<summary>Show the example's output tree</summary>

```text
examples/journey-to-the-west/
├── source/西游记.txt + SOURCE.md   # Full 100-chapter public-domain source + provenance
├── PRODUCT_BRIEF.md                # Requirements intake: platform / genre + benchmarks / art / rating / fantasy
├── analysis/SOURCE_BIBLE.md        # Gameable canon: rules, verbs, spaces, agents, signature moments
├── concepts/CONCEPT.md             # Three materially different concepts, with the chosen one
├── design/GAME_DESIGN.md           # Systems: turn order, 五行, skills, pet, formations, forms, boss
├── design/ART_DIRECTION.md         # Woodblock visual identity, battle staging, HUD, signature frames
├── build/BUILD_BRIEF.md            # Provider-neutral, bounded brief handed to the coding agent
└── build/app/                      # The built, playable game — see build/app/RUN.md to run it
```

</details>

## Complete example — Jin Ping Mei

*Two Ledgers* — a turn-based household-politics game from the public-domain 崇祯本: a visible rank table and a hidden ledger of private silver pull against each other, until 西门庆 dies at chapter 79 and the visible one is struck out. **Rated mature (17+); eroticism as a currency of power, written elliptically, nothing explicit.** **Play it: [jinpingmei.vibecoco.ai](https://jinpingmei.vibecoco.ai)**

![Title screen](examples/jin-ping-mei/screenshots/title.jpg)

<details>
<summary>Show the example's output tree</summary>

```text
examples/jin-ping-mei/
├── source/金瓶梅.txt + SOURCE.md   # Public-domain 崇祯本 (expurgated) + reproducible expurgate.py
├── PRODUCT_BRIEF.md                # Requirements intake: web · Chinese · household-politics vs 熹妃传/恋与 · adult
├── analysis/SOURCE_BIBLE.md        # Gameable canon: rank vs favour, private capital, information, calendar
├── concepts/CONCEPT.md             # Three materially different concepts, with hard vetoes
├── design/GAME_DESIGN.md           # Systems: two ledgers, five actions, suspicion, five endings
├── design/ART_DIRECTION.md         # Illustration style, compound cutaway, functional colour, signature frames
├── build/BUILD_BRIEF.md            # Provider-neutral, bounded brief handed to the coding agent
└── build/app/                      # The built, playable game — see build/app/RUN.md to run it
```

</details>

## Acknowledgments

[linux.do](https://linux.do)
