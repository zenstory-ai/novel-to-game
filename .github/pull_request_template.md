## Why / 为什么

<!-- State the user-visible failure, adaptation decision, or evidence gap. -->

## Scope / 范围

<!-- List the skills, manifests, examples, docs, or tooling changed. Note what intentionally remains unchanged. -->

## Evidence / 证据

```text
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

<!-- Add exact command results and paths to runtime/state/browser/visual evidence. Use NOT_RUN: <reason> for every required check that could not run. -->

## Source and asset provenance / 来源与素材出处

<!-- For new example material, link the authoritative source and state the licence/public-domain basis for text, images, audio, fonts, and models. Otherwise write Not applicable. -->

## Risks and untested scope / 风险与未验证范围

<!-- Be explicit. Do not turn subjective fun, balance, visual quality, or adaptation quality into a deterministic PASS. -->

## Checklist / 检查清单

- [ ] The description says why the change is needed and what it deliberately leaves alone.
- [ ] `python3 scripts/validate_repo.py` and the unit tests pass, or every missing check is listed as `NOT_RUN: <reason>`.
- [ ] Runtime claims point at direct evidence; subjective claims stay subjective. Repository contracts are in `AGENTS.md`.
