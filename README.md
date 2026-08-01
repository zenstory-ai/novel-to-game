# NovelToGame

> Turn a novel in any language into a source-grounded, fully playable game.

[![Validate](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml/badge.svg)](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f766e.svg)](LICENSE)

NovelToGame is an open-source Agent Skills toolkit for Claude Code, Codex, and Kimi Code. It turns a source's rules, spaces, characters, and conflicts into player verbs, systems, levels, and a verifiable complete run.

It accepts novels in any language, writes artifacts in the requested language, and builds for the chosen runtime—web, native, mobile, or a selected game engine—without silently switching to an easier substitute.

[中文](README_ZH.md) · [Play Online](#play-online) · [Quick Start](#quick-start) · [Install](#install) · [Artifacts](#output) · [Contributing](CONTRIBUTING.md)

## Play Online

### Featured · Project Plateau: Proof Before Dark

*The Lost World* becomes a real-time **first-person 3D field-photography game**: cross a connected plateau, observe a living Iguanodon family, expose four glass plates under aerial pressure, and return with the views that survived.

#### 36-second launch video

https://github.com/user-attachments/assets/4d0b501e-09be-49b6-9070-c605afce3fae

**[Play in your browser — no install](https://plateau.vibecoco.ai)** · **[See how it was adapted](examples/project-plateau/)** · [Share feedback](https://github.com/worldwonderer/novel-to-game/discussions/7)

### More playable adaptations

| Journey to the West · Three Borrowings of the Banana Fan | Jin Ping Mei · Ledger of Desire |
|---|---|
| [![Three Borrowings title screen](examples/journey-to-the-west/screenshots/title.jpg)](https://xiyouji.vibecoco.ai) | [![Ledger of Desire title screen](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai) |
| Turn-based systems RPG: elements, formations, transformations, companion, and multi-stage boss | 18+ relationship strategy game: six-day schedule, character agency, resource and social debts, and three endings |
| **[Play](https://xiyouji.vibecoco.ai)** · [Case study](examples/journey-to-the-west/) | **[Play](https://jinpingmei.vibecoco.ai)** · [Case study](examples/jin-ping-mei/) |

All three released examples include source provenance, product constraints, adaptation analysis, concept selection, world and art direction, a build brief, and runnable source.

## Quick Start

After installation, give the agent a novel file, directory, or link:

```text
Use novel-to-game quick to adapt this novel into a fully playable game.
Recommend the target platform, genre, and engine from the source, and keep the first build to about 15 minutes.
Let the player enter the world as an original character with a new playable route through its conflict.
```

`quick` automatically selects the direction with the strongest source evidence and the clearest path to a complete game. Use `director` when you want to choose between three concepts before world design begins.

## What It Solves

Ask a model to “make this book into a game” and the result is often a generic reskin or a clickable plot summary. NovelToGame separates the work that requires real adaptation judgment:

- **Lock product boundaries first:** platform, genre, target experience, art, rating, engine, and non-negotiable requirements;
- **Find playable evidence in the source:** rules, verbs, spaces, character agency, systems, and key visual elements;
- **Give concept, level design, and art separate ownership:** implementation may not silently redesign them;
- **Finish with real execution evidence:** startup, input, state changes, complete run, outcome, restart, and target display or device.

## Install

### Agent Skills

Install all seven skills for the CLI you use:

| Agent CLI | Install command | Invoke |
|---|---|---|
| Claude Code | `npx skills add worldwonderer/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add worldwonderer/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add worldwonderer/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

Install all three adapters at once:

```bash
npx skills add worldwonderer/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

Cloning the repository also enables project-local discovery in all three CLIs.

### Native Plugins

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

## Pipeline

The orchestrator confirms `PRODUCT_BRIEF.md`, then runs six stages with separate ownership. Failed QA returns to the build for another repair pass until the evidence clears the gate.

```mermaid
flowchart LR
    classDef io fill:#fce4ec,color:#333,stroke:#e57373,stroke-width:1px
    classDef orch fill:#eef2ff,color:#1e1b4b,stroke:#6366f1,stroke-width:1px

    novel["📖 novel"]:::io --> orch["novel-to-game"]:::orch
    orch --> intake --> analyze --> concept --> world --> art --> build --> qa --> game["🎮 playable game"]:::io
    qa -.->|fails| build
```

Requirements lock the platform, delivery runtime, genre and verified benchmarks, art direction, content rating, core fantasy, and engine. Downstream stages must honor those boundaries instead of switching to an easier game during implementation.

## Seven Skills

| Skill | Purpose |
|---|---|
| `novel-to-game` | Orchestrate requirements, mode selection, stage handoffs, and progress recovery |
| `novel-game-analyze` | Extract cited rules, verbs, spaces, agents, systems, and signature moments |
| `game-concept` | Generate three materially different directions, reject invalid options, and choose one |
| `game-world-design` | Define the target player experience, core loop, world response, systems, levels, failure, and outcomes |
| `game-art-direction` | Define camera, composition, visual grammar, colour, light, materials, HUD, motion, and sound |
| `game-build` | Compress a build brief and drive a coding agent to a fully playable implementation |
| `game-qa` | Verify with commands, states, screenshots, and real play paths without pretending subjective certainty |

## Output

Each run creates a compact, self-contained adaptation workspace:

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

Core design documents do not depend on one model, platform, or game engine. The build stage selects an implementation for the approved target platform.

## Contributing

Reproducible bugs, evidenced skill gaps, and example proposals with a distinct
adaptation lesson are welcome. Read the [contribution guide](CONTRIBUTING.md)
and use the repository's structured issue and pull request templates.

## Acknowledgments

[linux.do](https://linux.do)
