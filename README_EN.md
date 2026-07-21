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

## Worked Example — Journey to the West

[Journey to the West](examples/journey-to-the-west/) runs the whole pipeline end
to end: from the full 100-chapter public-domain Chinese text to **三借芭蕉扇 (Three
Borrowings of the Banana Fan)** — a playable turn-based command RPG in the tradition
of 《梦幻西游》/《问道》.

**Play it: [xiyouji.vibecoco.ai](https://xiyouji.vibecoco.ai)**

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
treasures, all in an original Ming-dynasty woodblock style. Hovering a command
previews its **damage range, five-element multiplier and hit chance**; turn order
is a visual timeline; and a counter-element hit stamps a three-character seal
(金克木) on the target — a turn-based game should lay its numbers out rather than
make you guess. The code was produced by driving Kimi K3 and the art by
gpt-image-2, and it self-verifies: 199 engine assertions plus a 78-assertion
Playwright walkthrough (including a full keyboard-only run and both 1280×800 and
1920×1080 viewports), zero console errors.

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

## Complete example — Jin Ping Mei

The [Jin Ping Mei](examples/jin-ping-mei/) example runs the same pipeline into a
completely different genre: from the public-domain 100-chapter 崇祯本 recension to
*Two Ledgers*, a turn-based household-politics strategy game.

**Play it: [jinpingmei.vibecoco.ai](https://jinpingmei.vibecoco.ai)**

![Title screen](examples/jin-ping-mei/screenshots/title.jpg)

| Act II — you rank sixth | Chapter 79 — the visible ledger is wiped |
|---|---|
| ![Board](examples/jin-ping-mei/screenshots/board.jpg) | ![Clearing](examples/jin-ping-mei/screenshots/clearing.jpg) |

You play 孟玉楼, who marries into the 西门 household with her own dowry. The most
prominent thing on screen is a gold **rank table** of the six wives, reshuffled
every festival turn, forever telling you to climb. Folded into the bottom-left
corner is an ink-black **hidden ledger** — private silver, favours owed to you,
and ways out. It never appears on the leaderboard and is never given a total.

Of the six actions, only 藏 (*hoard*) feeds the hidden ledger — and on the
leaderboard, hoarding always looks like a wasted turn. Then chapter 79 arrives,
西门庆 dies, rank and face and favour are struck out, the leaderboard is removed
from the interface entirely, and the ending scores **only** the ledger you were
ignoring — while stating outright that your best-ever rank contributed nothing.
The novel's own preface says it is written as a warning, not an encouragement;
here the mechanics say it instead of a narrator.

Favour is not an abstract score. It has a body: **whose courtyard the master
sleeps in tonight**. On the cutaway, exactly one window is lit and the rest are
dark. You can spend an action and silver to contest the night — at the cost of
耗 (*depletion*), a figure that never appears on any leaderboard. Whoever spends
years competing for favour is already ill by the time the household is divided.
Contesting raises the visible ledger and raises depletion, and feeds the hidden
ledger not at all: that asymmetry is the whole design.

Roughly 60–90 minutes: 24 festival turns, three acts, five endings. Includes an
imperfect-information servant rumour network (rumours carry a confidence tier and
may be false), a scheme system with progress and named accomplices, callers who
turn up unannounced and force you to answer on the spot, six rival AI agents with
their own goals, and 21 original Ming-dynasty illustrations plus a cutaway of the
compound rendered in three states — with sky and ambient particles tracking all
24 solar terms — so the household's decline is directly legible. Code produced by
driving Kimi K3, art by gpt-image-2, with 85 engine assertions and a 45-assertion
Playwright walkthrough, zero console errors, byte-reproducible under a fixed seed.

> **Rated mature (17+).** Desire is the engine of the source novel; strip it out
> and household politics is just bookkeeping. So this adaptation writes eroticism
> as **a currency of power**: nights granted, favour lost, and what contesting
> them costs. The prose follows the elliptical manner of late-Ming domestic
> fiction — lamps, watch-drums, seating order, the scent of clothes — and the
> camera always stops at the moment the bed-curtain falls. **No sexual act is
> described, there is no explicit dialogue, and every figure is fully clothed.**
> The text in the repository remains a reproducibly generated expurgated edition
> (see [`source/SOURCE.md`](examples/jin-ping-mei/source/SOURCE.md)); the explicit
> passages of the original are not adapted.

<details>
<summary>Show the example's output tree</summary>

```text
examples/jin-ping-mei/
├── source/金瓶梅.txt + SOURCE.md   # Public-domain 崇祯本 (expurgated) + reproducible expurgate.py
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
