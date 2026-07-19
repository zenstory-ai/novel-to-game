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
- Write runtime skills, references, and examples in Simplified Chinese. Keep
  English only for literal filenames, commands, code fields, status/mode values,
  and proper names. Keep `README.md` Chinese (the default) and `README_EN.md` English for SEO.
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
