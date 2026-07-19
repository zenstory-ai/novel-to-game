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
NovelToGame solves the hard part: turning the book's own rules and drama into
player verbs and a core loop, deciding what game it should become, and driving
that all the way to a playable prototype.

## Pipeline

One orchestrator drives six specialist stages, from raw text to a verified,
playable prototype.

```mermaid
flowchart LR
    classDef io fill:#fce4ec,color:#333,stroke:#e57373,stroke-width:1px
    classDef orch fill:#eef2ff,color:#1e1b4b,stroke:#6366f1,stroke-width:1px

    novel["📖 novel"]:::io --> orch["novel-to-game"]:::orch
    orch --> analyze --> concept --> world --> art --> build --> qa --> game["🎮 playable game"]:::io
    qa -.->|fails| build
```

## Skills

| Skill | Purpose |
|---|---|
| `novel-to-game` | Orchestrate the complete pipeline in quick or director mode |
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
  analysis/SOURCE_BIBLE.md
  concepts/CONCEPT.md
  design/GAME_DESIGN.md
  design/ART_DIRECTION.md
  build/BUILD_BRIEF.md
  build/app/
  qa/QA_REPORT.md
  _progress.md
```

The build is model-neutral: any capable model implements the same approved
design — the brief, not the model, is what carries the game.

## Worked Example — Journey to the West

[Journey to the West](examples/journey-to-the-west/) runs the whole pipeline end
to end: from the full 100-chapter public-domain Chinese text to **三借芭蕉扇 (Three
Borrowings of the Banana Fan)** — a playable turn-based command RPG in the tradition
of 《梦幻西游》/《问道》. Built and verified, not just planned.

![Title screen](examples/journey-to-the-west/screenshots/title.jpg)

| Multi-foe command battle | Underwater heist (碧波潭) |
|---|---|
| ![Battle](examples/journey-to-the-west/screenshots/battle.jpg) | ![Heist](examples/journey-to-the-west/screenshots/bibotan.jpg) |

![Growth panel](examples/journey-to-the-west/screenshots/hero-panel.jpg)

A ~45–90 minute single-player campaign covering the source's chapters 59–61 as
nine playable beats — from 罗刹女 and 灵吉's wind-quelling pill, through the
玉面公主 fight and the 碧波潭 crab-form heist (where you take 辟水金睛兽 as a
summonable pet), to the 众神 siege, 牛魔王's white-bull true form, and the
three-stage true fan that quenches the fire. It carries the instantly recognizable
回合制西游 grammar — speed-ordered turns, a command menu, five-element (五行)
counters, summon pets, formations, 悟空's seventy-two transformations — plus
level-up point allocation, skill mastery, story-drop gear and rule-based
treasures, all in an original Ming-dynasty woodblock style. The code was produced
by driving Kimi K3 and the art by gpt-image-2, and it self-verifies: 146 engine
assertions plus a Playwright walkthrough, zero console errors.

<details>
<summary>Show the example's output tree</summary>

```text
examples/journey-to-the-west/
├── source/西游记.txt + SOURCE.md   # Full 100-chapter public-domain source + provenance
├── analysis/SOURCE_BIBLE.md        # Gameable canon: rules, verbs, spaces, agents, signature moments
├── concepts/CONCEPT.md             # Three materially different concepts, with the chosen one
├── design/GAME_DESIGN.md           # Systems: turn order, 五行, skills, pet, formations, forms, boss
├── design/ART_DIRECTION.md         # Woodblock visual identity, battle staging, HUD, signature frames
├── build/BUILD_BRIEF.md            # Provider-neutral, bounded brief handed to the coding agent
└── build/app/                      # The built, playable game — see build/app/RUN.md to run it
```

</details>

## Acknowledgments

[linux.do](https://linux.do)

## License

MIT
