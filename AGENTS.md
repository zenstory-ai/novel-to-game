# NovelToGame Engineering Guide

NovelToGame is a skills-first repository. Its product is adaptation judgment
and reusable workflow knowledge, not a bundled game engine.

## Rules

- Assume frontier models already know mainstream game and frontend frameworks.
- Treat game concept, experience/level design, and art direction as separate
  planning owners; do not let implementation silently redesign them.
- Add instructions only when they encode adaptation know-how, a necessary
  handoff contract, or evidence-based QA.
- Keep `SKILL.md` procedural and concise. Put optional depth in one-level
  `references/` files.
- Keep every skill self-contained. Do not create runtime cross-skill file
  dependencies; invoke another skill by name instead.
- Do not bind the core design artifacts to Kimi, Claude, or one framework.
- Keep provider comparisons out of runtime skills; model capabilities change.
- Language scope is bounded per surface, not global:
  - **Skill bodies and `references/`**: Simplified Chinese, always. This is prose the
    agent reads at runtime; keeping it in one language avoids a bilingual layer that
    would have to be kept in sync through every contract refactor.
  - **Frontmatter `description`, the four plugin manifests, and `agents/openai.yaml`
    interface fields**: English first, Chinese after. These are what an agent routes an
    English request against and what a plugin directory shows as listing copy with no
    README fallback. `scripts/validate_repo.py` enforces the English-first rule.
  - **Examples**: each example declares its own artifact language in its
    `example.json`, and its planning artifacts, source provenance and in-game UI text
    follow that declaration. `tests/test_validate_repo.py` only requires Chinese
    headings for examples that declare a `zh*` language.
  - **README**: `README.md` English (the default), `README_ZH.md` Chinese, both kept
    structurally identical.
- Treat repository language and generated-project language separately. Accept
  novels in any language; generated artifacts follow the user's requested
  language, or the conversation language when unspecified. Do not duplicate
  every artifact bilingually unless requested.
- Preserve source-language quotations and culturally specific concepts. When
  source and output languages differ, translate only what decisions require and
  keep one terminology table instead of flattening concepts into foreign tropes.
- Require evidence for QA claims: command output, state snapshots, screenshots,
  or recorded play paths.
- Do not describe subjective fun or balance as deterministically verified.
- Do not add dependencies without an explicit product need.

## Verification

Run before reporting completion:

```bash
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

## Decision notes

Non-trivial changes (behavior, architecture, cross-skill contracts, process or
tooling, testing strategy, on-disk formats) must leave a note in
`.agents/notes/{proposed,implemented,rejected}/{feature,bug-fix,simplification,architecture,process,testing}/yyyy-mm-dd-topic.md`,
dated by the commit where the decision first appeared, following the DeepSeek
Harness agent-notes convention
(https://github.com/czm15053/write-notes-like-deepseek). Notes are written in
Chinese with English section headers.

- Search `.agents/notes/` for the owning note first. Update facts in place when
  the decision stands; open a new note that links to the old one when the
  decision itself reverses. Never rewrite `## Decision` into its opposite, and
  leave a `rejected/` note frozen at what was true when it was rejected.
- New ideas start in `proposed/` and move to `implemented/` in the same commit
  as the code. Mechanical edits (formatting, renames, version bumps,
  behavior-neutral patches) and deleting verification code that stopped earning
  its keep need no note.
- A note opens with `# Agent Note: <title>`, a blank line, `Status: <state>`.
  Sections are `## Problem`, `## Decision` (present tense) or `## Proposal`,
  `## Alternatives considered` (real options only, strongest argument first),
  and `## Consequences` (`## Risks` in `proposed/` and `rejected/`). Close with
  a `来源：` commit list, a `## Verification` paragraph, or both, so a reader can
  check the note against history. The rules above are summaries; the notes hold
  the why.
- No `INDEX.md`; the folder is the state.
