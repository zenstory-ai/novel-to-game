<p align="center">
  <img src="https://zenstory.ai/brand/zenstory-ai-mark.svg" alt="" width="76" height="76">
</p>

<h1 align="center">NovelToGame</h1>

<p align="center">
  <b>A source-grounded novel-to-game workflow: adaptation design, target-runtime builds, and evidence-based QA.</b>
</p>

<p align="center">
  <a href="https://zenstory.ai/novel-to-game"><b>Project page</b></a>
  &nbsp;·&nbsp;
  <a href="#install"><b>Install</b></a>
  &nbsp;·&nbsp;
  <a href="#see-what-it-produces"><b>See what it produces</b></a>
  &nbsp;·&nbsp;
  <a href="README_ZH.md"><b>中文</b></a>
</p>

<p align="center">
  <a href="https://github.com/zenstory-ai/novel-to-game/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/zenstory-ai/novel-to-game?style=flat-square&color=22D3EE&logo=github&logoColor=white&label=Stars"></a>
  <a href="https://github.com/zenstory-ai/novel-to-game/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/zenstory-ai/novel-to-game?style=flat-square&color=081431&label=Release"></a>
  <img alt="Skills 7" src="https://img.shields.io/badge/Skills-7-081431?style=flat-square">
  <a href="https://github.com/zenstory-ai/novel-to-game/actions/workflows/validate.yml"><img alt="Validate" src="https://img.shields.io/github/actions/workflow/status/zenstory-ai/novel-to-game/validate.yml?style=flat-square&label=Validate"></a>
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/License-MIT-1F6FEB?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/zenstory-ai/novel-to-game/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/badge/GitHub%20Discussions-181717?style=for-the-badge&logo=github&logoColor=white"></a>
  <a href="https://github.com/zenstory-ai/novel-to-game/issues"><img alt="GitHub Issues" src="https://img.shields.io/badge/GitHub%20Issues-181717?style=for-the-badge&logo=github&logoColor=white"></a>
</p>

NovelToGame is seven open-source skills for the coding agent you already use (Claude Code, Codex, or Kimi Code). Give it a novel and, if you have one in mind, a target platform or engine. It reads the whole book, chooses a game direction it can defend, designs the world and the look, builds for the runtime the brief locks, and proves the build plays in one recorded run. You get a playable build at the finish level you asked for, plus the design documents behind it. The three public examples below play in a browser right now, no install.

## Play Online

Each game links to the adaptation workspace behind it: source provenance, the concept and the directions it rejected, game and art direction, runnable source, and the QA record from the playable path.

### Journey to the West · Three Borrowings of the Banana Fan

[![Wukong's party and the Bull Demon King's formation remain fully visible above a separate light-silk command tray on the Jilei Mountain stage](examples/journey-to-the-west/screenshots/hero.jpg)](https://xiyouji.vibecoco.ai)

**One wave of a fan blew you fifty thousand li. Take the mountain back one turn at a time.**

Command Wukong's party through the three borrowings of the Banana-Leaf Fan: read the five-element wheel, follow a fire-vein treasure map, decide when to press deeper or bank the haul, set your formation, transform your way in where force will not work, and turn a demon king who outclasses you into a rainstorm over the Mountain of Flames.

**[Play in browser](https://xiyouji.vibecoco.ai)** · [Adaptation workspace](examples/journey-to-the-west/) · design estimate: 45–90 min · all ages · playable prototype

### Jin Ping Mei · Ledger of Desire

[![Five women of the Ximen household face the player across the household ledger](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai)

**Choose whose door you enter tonight. Find out whose door knocks in the morning.**

Twenty days, five courtyards. Keep silver, influence, reputation, exposure, and household strain in balance; respect each woman's terms; build trust through shared crises; and face a final ledger shaped by what everyone chose and remembers.

**[Play in browser](https://jinpingmei.vibecoco.ai)** · [Adaptation workspace](examples/jin-ping-mei/) · design estimate: 60–90 min · 18+ · playable prototype

### Project Plateau · The Lost World · 3D

A real-time **first-person 3D field-photography game** adapted from Arthur Conan Doyle's *The Lost World*. Cross a connected plateau, observe a living Iguanodon family, expose four glass plates under aerial pressure, and return with the views that survived.

Play the full expedition on desktop, or watch the 15-second gameplay preview on other devices.

https://github.com/user-attachments/assets/27819247-4e4d-4bf0-8f0f-43d4125c4d45

**[Play in your browser — no install](https://plateau.vibecoco.ai)** · [Adaptation workspace](examples/project-plateau/) · [Share feedback](https://github.com/zenstory-ai/novel-to-game/discussions/7) · design estimate: 1–3 min · desktop WebGL2 · playable prototype

## What it is

There is no GPU, no hosted service, and no bundled engine: the skills run on the model of whichever agent you installed them into. A one-line "turn this book into a game" prompt usually yields a reskin or a clickable plot summary, so the work is split into stages. Each stage owns one document, and every decision in it has to cite evidence:

- **Every design decision cites the novel.** Analysis reads the whole book and writes a `SOURCE_BIBLE` where every hard rule, key character goal, turning point and ending, and signature anchor carries its chapter or file location, and every adaptation-boundary row cites its evidence. Source facts are labelled `immutable`, `adaptable`, `open`, or `conflicted`; anything the novel does not define is marked a design invention, never smuggled in as fact.
- **The game shape is a documented decision, not a default.** The concept stage compares real alternatives and kills directions with named hard vetoes (the core loop ignores the novel's central tension; strip the proper nouns and a generic template remains; the player only spends resources to release a fixed plot). Concept, world design, and art direction are written by different stages into different documents, and the build may not quietly redesign them.
- **Built for the runtime the brief locks.** The product brief, the one-page requirements sheet the agent drafts first (in `quick` it stops for your decision only on blocking items such as platform, rights, or adult content), locks platform, engine, target runtime, and the runtime actually available for testing. A missing toolchain may not silently become a web build. The design documents are engine-independent Markdown you own.
- **QA is one real run, six checks, and honest limitations.** The build is launched on the tested runtime and one complete execution proves `launch`, `render`, `input`, `coreLoop`, `outcome`, and `restart`. Fun, balance, other browsers, and rights are written as limitations, never as PASS.
- **Voice is opt-in and generated at build time by default.** No line goes to a text-to-speech provider unless art direction chooses voice; runtime synthesis needs the product brief's explicit approval, and the novel and design documents are never uploaded.

Interactive fiction is a first-class track: continuous scenes, dialogue, testimony, and key choices can carry the whole game, held to the same agency and evidence requirements as a systems game.

## Install

Prerequisite: you already use Claude Code, Codex, or Kimi Code, and `npx` (Node.js) runs in your terminal.

| Agent CLI | Install | Invoke |
|---|---|---|
| Claude Code | `npx skills add zenstory-ai/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add zenstory-ai/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add zenstory-ai/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

`-g` installs globally for every directory; drop it to install into the current directory only. **To update, run the same command again, or `npx skills update`.**

<details>
<summary><strong>All three CLIs at once, or native plugin installation</strong></summary>

Install adapters for all three CLIs on the same machine:

```bash
npx skills add zenstory-ai/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

Cloning the repository also enables project-local skill discovery in all three CLIs.

#### Claude Code

```text
/plugin marketplace add zenstory-ai/novel-to-game
/plugin install novel-to-game@novel-to-game-skills
/novel-to-game:novel-to-game quick
```

#### Codex

```bash
codex plugin marketplace add zenstory-ai/novel-to-game
codex plugin add novel-to-game@novel-to-game-skills
```

#### Kimi Code 0.27 or newer

```text
/plugins install https://github.com/zenstory-ai/novel-to-game
/reload
/skill:novel-to-game quick
```

</details>

> Changes are in [CHANGELOG.md](CHANGELOG.md) and [Releases](https://github.com/zenstory-ai/novel-to-game/releases). The repository moved from `worldwonderer/novel-to-game` to `zenstory-ai/novel-to-game`; install and marketplace commands from older docs no longer resolve, and the commands above are current.

## See what it produces

Every excerpt below is copied from a file in this repository; the two Chinese examples keep their documents in Simplified Chinese, so those excerpts are translated here and marked as such, with the originals linked. Cuts are marked with "…".

### What the design documents look like

In [Journey to the West](examples/journey-to-the-west/), the Banana-Leaf Fan (owned by Rakshasi, the Bull Demon King's wife) enters the analysis as facts pinned to chapters, in [`analysis/SOURCE_BIBLE.md`](examples/journey-to-the-west/analysis/SOURCE_BIBLE.md) (translated; 3 of the table's 11 rows):

```markdown
| Fact | Evidence |
|---|---|
| The true fan quells fire with one wave, raises wind with two, brings rain with three; Rakshasi first blows Wukong away with it, and he returns after obtaining the wind-fixing pill from Bodhisattva Lingji | Chapter 59 |
| Wukong turns into an insect and enters her belly to force the fan out of her, but receives a fake; the fake fan raises the flames three times in a row | Chapter 59 |
…
| The Bull Demon King also commands the seventy-two transformations; disguised as Bajie he tricks the true fan back, and Wukong, flushed with success, does not look closely | Chapter 61 |
```

[`concepts/CONCEPT.md`](examples/journey-to-the-west/concepts/CONCEPT.md) turns the fan into a two-sided rule, the fake fan feeding the fire and the true fan's three waves turning the boss fight, and records which rival directions died, and on which veto (translated):

```markdown
Hard-veto results (one line per direction):

- Direction 1 · Three Borrowings of the Banana Fan: passes (none of the six triggered).
- Direction 2 · The Westward Post Road: triggers item 2 — within the slice length, relationship building decays into event buttons and stat bars with no repeatable trade-off — eliminated.
- Direction 3 · Two Hearts: triggers item 3 — in the novel the true and the false are told apart by the Buddha, so the player's core tension cannot become a reliable mechanic (it would need a tell the novel does not contain) — eliminated.
```

[`design/GAME_DESIGN.md`](examples/journey-to-the-west/design/GAME_DESIGN.md) gives each wave exact effects and durations, and says why the timing of the third wave is the final battle's core decision (translated):

```markdown
| Order | Effect (all enemies, ignores the five elements) | Source |
|---|---|---|
| First wave · Quell fire | Clears enemy buffs (keeps the guard-break / stun / exposure our side applied); enemy attack −30% (3 turns) | One wave quells fire |
| Second wave · Raise wind | Whole party speed +30% (3 turns), seizing the head of the action queue | Two waves raise wind |
| Third wave · Bring rain | Party heals over time (8% max stamina per action, 3 turns); enemy defence −25% and **exposed (damage taken +60%)**, all for 3 turns | Three waves bring rain |

The three stages are both a power curve and the ritual of the "three borrowings": first suppress the enemy's offence, then seize the initiative, then open the exposure window and focus fire,
taking down the White Bull's true form with your companion beast and transformations. The rain's exposure window is the only chance for a quick kill in the final battle: the White Bull's true form stacks frenzy every turn,
and dragging it out means you will be killed in turn, so "when to open the third wave" is the core decision of the finale.
```

[`design/ART_DIRECTION.md`](examples/journey-to-the-west/design/ART_DIRECTION.md) makes each wave rewrite the backdrop rather than flash an icon (translated):

```markdown
- **Three waves of the true fan · reprinting the world**: the true fan is the turnaround of the boss fight, and each wave rewrites the Flame Mountain landscape —
  first wave, quell fire: enemy buffs cleared, enemy attack reduced, the vermilion fire layer sinks to bone-white afterglow;
  second wave, raise wind: whole party faster, blue-white wind lines sweep across and clear the floating ash;
  third wave, bring rain: party heals over time, enemy guard broken and exposed, deep-blue raindrops fall on the embers.
  …
```

And [`qa/verification.json`](examples/journey-to-the-west/qa/verification.json) records the real browser run that reached that ending and started over:

```json
"completeRun": {
  "id": "journey-to-the-west-main-path",
  "cleanContext": true,
  "terminal": "ending: 三借芭蕉扇 · 完",
  "restart": "new campaign title",
  "evidence": "qa/evidence/automated.json"
},
"checks": {
  "launch": "PASS",
  "render": "PASS",
  "input": "PASS",
  "coreLoop": "PASS",
  "outcome": "PASS",
  "restart": "PASS"
},
```

### How a choice is written so the game remembers it

[Jin Ping Mei](examples/jin-ping-mei/) is the relationship-and-household example. Its [`concepts/CONCEPT.md`](examples/jin-ping-mei/concepts/CONCEPT.md) states the promise in one sentence and, for each experience pillar, the observable evidence and the symptom that would kill it (translated; 3 of 5 pillar rows):

```markdown
Core sentence: **Whose door you enter tonight, and who comes to you in the morning holding last night's evidence.**
…
| Pillar | Observable evidence | Veto symptom |
| --- | --- | --- |
| All five women can change the situation on their own | Each has eight route segments, her own refusals and an outside capability | Only names, portraits or affection numbers are swapped |
…
| Adult content is earned through consent and relationship | Invitation, continue / stop, re-confirmation, next-morning echo | Intimacy bought with silver, status or immunity from punishment |
| Management and relationships supply each other's actions | Each of the five women's abilities handles one thing: accounts, lies, goods, connections, or physical evidence | The optimal play is to skip the character content |
```

[`design/GAME_DESIGN.md`](examples/jin-ping-mei/design/GAME_DESIGN.md) then forbids the "pick an option, get a line, scene over" pattern (translated):

```markdown
- A route choice must produce her own reply, a reply from a neighbouring courtyard, the player's handling of it, and, at least two days later, the old words coming back to be settled. When they come back, four beats play in order — she repeats them word for word → the neighbouring courtyard names the cost that spilled over → the player honours, rewrites, or denies them → the outcome in both courtyards — and each beat can be opened and read in full. A mature relationship also triggers one dusk invitation that she initiates.
- The next morning's first scene belongs to whoever was neglected or holds concrete evidence; no jealousy appears without a source.
```

The QA record for this game is candid about how it was played. In [`qa/verification.json`](examples/jin-ping-mei/qa/verification.json), all six checks pass and the first limitation reads:

```json
{
  "scope": "路径覆盖",
  "reason": "快速路径在每屏选择第一项可行主动作，只到达一个失稳结局；没有穷举其他选项或结局。"
}
```

That is: the fast path picked the first feasible main action on every screen and reached one unstable ending; other options and endings were not exhausted. The design document itself draws the same line: the machine only proves that content exists, is reachable and readable, and that state consequences are real; subjective appeal, pacing, and balance are not settled by automation.

### What the QA record admits it did not test

[Project Plateau](examples/project-plateau/) is the 3D example, and its documents are in English. Its concept compared three directions, each anchored to a chapter slice: A · Proof Before Dark (field observation and returning with damaged proof), B · Fire Across the Lake (following the brook to the lake and escaping a tracking predator), and C · The Eighteenth Cave (a proof-carrying descent). It also wrote down the condition under which the winner should be abandoned, in [`concepts/CONCEPT.md`](examples/project-plateau/concepts/CONCEPT.md):

```markdown
All three support repeatable player decisions and bounded prototypes. Direction A wins
because it carries the whole adaptation promise—scout, document, survive and extract—
in one readable daylight frame, while B narrows the game to pursuit and C narrows it to
route interpretation.
…
The selected direction is falsified if position or timing cannot create a visibly better
plate, or if recording never changes a later route or defense decision. `GAME_DESIGN.md`
must define that causal chain and preserve the non-lethal scout fantasy.
```

`npm run verify` drives the real build with keyboard and mouse events and writes the input trace and `qa/verification.json` in the same run. The trace in [`build/evidence/current-run/report.json`](examples/project-plateau/build/evidence/current-run/report.json) is the whole expedition:

```json
"inputTrace": [
  "KeyW: reach the brook",
  "Right Mouse + Left Mouse: record the brook",
  "KeyW: reach the basalt shelf",
  "Right Mouse + Left Mouse: record basalt scale",
  "KeyA: enter canopy cover",
  "hold KeyC under cover: let the attack widen",
  "KeyW: reach the glade",
  "Right Mouse + Left Mouse: record young at play",
  …
  "KeyS: return to Fort"
],
```

And [`build/BUILD_BRIEF.md`](examples/project-plateau/build/BUILD_BRIEF.md) says exactly what that PASS means:

```markdown
…
PASS proves the six effects only in the recorded local
desktop browser. It does not prove subjective visual quality, comfort, fun, balance,
rights clearance, public hosting or other browsers, GPUs and devices.
```

Evidence also cuts the other way. The product brief records that the first measured run crossed the whole route in 55.2 seconds, which falsified the planned 5–8 minute session, so the product boundary was cut to a 1–3 minute run instead of padding the route with waits ([`PRODUCT_BRIEF.md`](examples/project-plateau/PRODUCT_BRIEF.md)).

## Your first request

Give the agent a novel file, directory, or link, then copy one of these requests and adjust it.

**A systems game with a new playable route:**

```text
Use novel-to-game quick to adapt this novel into a fully playable game.
Recommend the target platform, genre, and engine from the source, and keep the first build to about 15 minutes.
Let the player enter the world as an original character with a new playable route through its conflict.
```

**An interactive story** (this locks the `narrative-led` experience profile, so concept, design, and QA judge continuous scenes, character dialogue, testimony, and key choices instead of rounds, cards, and resource bars):

```text
Use novel-to-game quick to adapt this novel into an interactive story.
Carry the experience with continuous scenes, character dialogue, testimony, and key choices.
Keep variables as hidden causal tags rather than a visible stat panel.
Key choices must change later scenes, character attitudes, and the ending, and be named back in later text.
```

**Design notes only, no build yet:**

```text
Using my authorized source, plan one small gameplay-design slice for my target engine.
Keep the choices and outcomes bounded; show each option's evidence, cost, visible effect, and where a later scene uses its state.
Label allowed additions and unresolved questions. Deliver design notes only—do not build, run QA, or claim a finished runtime.
```

`quick` is the default: the agent drafts a product brief with sensible defaults, asks only about choices that materially change direction or touch safety, compares meaningful alternatives, and continues through design, build, and QA. Choose `director` when you want to pick the concept yourself; the agent stops at the concept stage with candidates and a recommendation, unless you have already named a direction.

## Workflow

```text
Novel → Source analysis → Concept → World design → Risk-matched whitebox ↺ → Art direction → Production build → QA → Playable game
```

After world design, a whitebox (a rough build without final art) tests only the single largest design risk before full art production: narrative causality can be checked in text, but real-time control, space, physics, or camera cannot, and what it shows goes back to the design stage. The production build targets the approved runtime and prepares one authoritative verification command. QA may diagnose, fix, and rerun, but the final record binds all six checks to the same complete run; findings flow back to the product, design, art, or build document that owns them.

## Skills

| Skill | Responsibility |
|---|---|
| [`novel-to-game`](skills/novel-to-game/) | Confirm requirements, choose a mode, orchestrate stage handoffs, and recover progress |
| [`novel-game-analyze`](skills/novel-game-analyze/) | Extract cited rules, verbs, spaces, agents, systems, and signature moments |
| [`game-concept`](skills/game-concept/) | Compare meaningful alternatives, reject invalid options, and select or validate a direction |
| [`game-world-design`](skills/game-world-design/) | Define the player promise, core loop, world response, systems, levels, failure, and outcomes |
| [`game-art-direction`](skills/game-art-direction/) | Define camera, composition, visual grammar, colour, light, materials, HUD, motion, and sound |
| [`game-build`](skills/game-build/) | Build a risk-matched whitebox, then implement the approved production candidate without redesigning it |
| [`game-qa`](skills/game-qa/) | Verify commands, states, screenshots, and real play paths without overstating subjective results |

## Artifacts

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
  qa/verification.json
  _progress.md
```

The design documents are engine-agnostic Markdown you own. The target runtime you approve determines the implementation and QA environment.

## FAQ

### I asked for an interactive story and got cards, rounds, and a stat panel. How do I get scenes, dialogue, and key choices instead?

Say so in the request, as the second example above does. That locks `experienceProfile: narrative-led` in the product brief, and the profile carries through concept, design, art, build, and QA. The design method records each key choice as concrete words and deeds, an immediate reaction, and a persistent fact with the later scene that reads it, not a hidden score. This track was added after a reader showed us exactly this failure in [Discussion #17](https://github.com/zenstory-ai/novel-to-game/discussions/17); see [`game-concept`](skills/game-concept/SKILL.md) and the [narrative design method](skills/game-world-design/references/narrative-design-method.md) (both in Chinese).

### How long does a full run take, and what does it cost?

Longer than one prompt. The agent reads the whole novel, writes five design documents, builds, and runs QA, and each stage is a separate skill call, so a full run is long and may span more than one session (the Jin Ping Mei example's progress file carries entries from two different days). Token spend is whatever your coding agent bills; nothing else is paid unless art direction opts into image or voice generation (see the GPU question below). The public examples' progress files do not record wall-clock time or token counts, so this README does not quote a number.

### The session ended halfway. Can it continue?

Yes. Start with `novel-to-game resume`, the third mode beside `quick` and `director`. It reads `_progress.md` and the documents that actually exist, works out the last stage that was genuinely finished, and continues from there; test results are only ever read from `qa/verification.json`. See the [pipeline contract](skills/novel-to-game/references/pipeline-contract.md) (Chinese).

### Which engine or platform does it build for? Will it fall back to a web page if my toolchain is missing?

You choose, and the product brief locks it: platform, production engine, target runtime, and the runtime actually available for testing. The build may not switch to a web page when the target toolchain is unavailable; only a substitute runtime already approved in the brief may be used, and then `targetRuntime`, `testedRuntime`, and the uncovered items are recorded separately. QA treats a substitute run as never proving the target platform. The three public examples are all browser games (two dependency-free static apps and one Three.js + Vite build) because that is what their briefs locked, not because it is the default. No public example yet targets a native engine or console; a Godot, Unity, or mobile build depends on the toolchain present in your environment and is recorded the same way, with anything untested written as a limitation. See [`game-build`](skills/game-build/SKILL.md) and the [QA contract](skills/game-qa/references/qa-contract.md) (both in Chinese).

### Do I need a GPU or my own model? Who pays for images and voice?

No GPU and no separate model: analysis, design, and code are written by the model of the coding agent you already use. External services are opt-in. Generated images are used only when art direction selects them, with the tool chosen in your environment after checking capability, licence, and cost (the Jin Ping Mei example records all 41 of its images as generated with Codex's built-in image tool, in `build/art/generated-art.json`). Voice is off unless art direction chooses it; the default is build-time generation into local assets, only the per-line dialogue and any pronunciation notes are sent, and the novel and design documents are never uploaded. Paid services are one of the things the agent stops to ask about before it starts. See the [TTS production contract](skills/game-build/references/tts-production-contract.md) (Chinese).

### How do I know the game it built actually runs? What does the QA PASS mean?

It proves that one authoritative command, in one complete run on the tested runtime, showed six things: the build launched, rendered a non-empty frame that changes, changed state on real input, completed the core loop, reached at least one designed outcome, and restarted to the initial state. Status is only `NOT_RUN`, `FAIL`, or `PASS`; unverified is not a pass, and an old PASS is overwritten by every rerun. Every gap is written as a limitation with a scope and a reason. It does not prove fun, balance, immersion, other browsers or devices, rights, or release quality, and it does not require a human playtest. See the [QA contract](skills/game-qa/references/qa-contract.md) (Chinese).

### My novel is in one language. Can the game be in another?

Yes. Novels in any language are accepted; artifacts use the language you ask for, or the conversation language if you do not say. Quotations and textual evidence stay in the original language, only what a decision needs is translated, and one terminology table holds names, places, objects, and rules. Register, forms of address, character voice, and cultural concepts are kept; rites, religion, and narrative conventions are not swapped for another culture's genre labels. Source language does not decide the interface language; the brief records them separately. See [`novel-game-analyze`](skills/novel-game-analyze/SKILL.md) (Chinese).

### Can I adapt a novel I do not own the rights to?

The skills do not clear rights for you, and QA does not certify them. Copyright, asset licensing, and real persons are among the questions the agent must stop and ask about before it starts; the brief records the compliance boundary and `SOURCE_BIBLE` records the edition, coverage, and authorisation boundary; a concept that depends on another game's protected characters, maps, interface, or text is a hard veto. The public examples use Project Gutenberg texts and record the rights status in each `source/SOURCE.md`, including why the Jin Ping Mei example ships an expurgated text.

### Can I get design documents without a build?

Yes. Use the third request above. Each planning skill stops at its document: the concept writes no code or numeric tables, world design writes no file names or tests, and art direction leaves asset production to the build. Even when you do build, the whitebox proves only the selected top risk and produces no QA verdict; the six checks come only from the production build.

## Further reading

- [Quick-start guide](https://zenstory.ai/novel-to-game/quick-start) — scope a first adaptation: separate authorized source facts, author-approved additions, and open questions, and keep the first slice small.
- [Meaningful-choice guide](https://zenstory.ai/novel-to-game/meaningful-choices) — give each player option evidence, cost, and a visible outcome, and name the later scene that reads its state.
- [NovelToGame compared with story-to-game builders](docs/novel-to-game-vs-story-to-game-tools.md) — the three shapes of tool and where the design documents live.
- [Blender asset feedback](docs/research/blender-asset-feedback.md) (Chinese) — why Blender is a conditional entry in `game-build`, not a default, and what one single-asset experiment did and did not prove.

## Contributing

Reproducible bugs, skill gaps backed by evidence, and example proposals that demonstrate a distinct adaptation lesson are welcome. Use the structured forms in [Issues](https://github.com/zenstory-ai/novel-to-game/issues/new/choose) and read the [contribution guide](CONTRIBUTING.md) for the required checks and the rights rule; questions and early ideas go to [Discussions](https://github.com/zenstory-ai/novel-to-game/discussions).

<a href="https://github.com/zenstory-ai/novel-to-game/graphs/contributors"><img alt="Contributors" src="https://contrib.rocks/image?repo=zenstory-ai/novel-to-game"></a>

## License

NovelToGame is released under the [MIT License](LICENSE).

## Acknowledgments

Thanks to the [linux.do](https://linux.do) community for early feedback and support.

## Part of ZenStory AI

This project is maintained by [ZenStory AI](https://zenstory.ai) — open-source, agent-native tools for creating, adapting and producing stories (GitHub org: [zenstory-ai](https://github.com/zenstory-ai)). Sibling projects:

| Project | What it does |
| --- | --- |
| [oh-story-claudecode](https://github.com/zenstory-ai/oh-story-claudecode) | Web-fiction writing skill pack: chart scanning, deconstruction, drafting, de-AI-flavor, covers |
| [drama-skills](https://github.com/zenstory-ai/drama-skills) | AI short-drama / motion-comic suite: scripts, assets, storyboards, image & video prompts, review |
| [novel-to-game](https://github.com/zenstory-ai/novel-to-game) | Agent skills for source-grounded novel adaptation, target-runtime builds, and evidence-based QA (this repo) |
| [video-recap-skills](https://github.com/zenstory-ai/video-recap-skills) | Create Chinese-narration recaps from supported video files, with optional editable JianYing/CapCut draft export |
| [oh-story-dsh](https://github.com/zenstory-ai/oh-story-dsh) | Community DeepSeek Harness plugin with novel, short-drama, game and video-recap workbenches |
| [zenstory](https://github.com/zenstory-ai/zenstory) | Chat-to-create AI novel-writing workbench ([app.zenstory.ai](https://app.zenstory.ai)) |
