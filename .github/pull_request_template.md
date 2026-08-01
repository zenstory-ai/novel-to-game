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

- [ ] The change is bounded and the description explains why it is needed.
- [ ] Skill bodies and references remain Simplified Chinese; routing and listing copy remain English-first, then Chinese.
- [ ] Each skill stays self-contained and examples follow their declared artifact language.
- [ ] Source quotations, terminology, and culturally specific concepts are preserved where decisions require them.
- [ ] New source text and assets have an explicit redistribution basis; no credential, private prompt, or private manuscript is included.
- [ ] No dependency was added without an explicit product need.
- [ ] Repository validation and unit tests pass, or every missing check is marked `NOT_RUN: <reason>`.
- [ ] Runtime claims include direct evidence; subjective claims remain clearly subjective.
- [ ] `README.md` and `README_ZH.md` remain structurally aligned when either changes.
