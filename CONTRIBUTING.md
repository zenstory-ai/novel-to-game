# Contributing / 参与贡献

Thank you for improving NovelToGame. This repository ships adaptation judgment
and reusable agent workflows rather than a bundled game engine. The most useful
contributions make a decision clearer, make a failure reproducible, or add
evidence that a generated game actually works.

感谢你帮助改进 NovelToGame。这个仓库的核心产品是改编判断与可复用 Agent
工作流，而不是内置游戏引擎。优先提交能让决策更清楚、失败可复现或运行
结果有证据的改进。

## Choose the right contribution / 选择贡献类型

- **Bug report:** a skill, plugin adapter, validator, example, or documented
  command behaves differently from its contract.
- **Skill gap:** the current workflow misses an adaptation decision or produces
  a predictable failure that belongs in reusable guidance.
- **Example proposal:** a source-grounded game that can demonstrate a materially
  new genre, interaction model, language, or evidence pattern.
- **Pull request:** a bounded change with its own verification and provenance.

Use the structured issue forms instead of a blank issue. Questions and early
ideas belong in [GitHub Discussions](https://github.com/zenstory-ai/novel-to-game/discussions).

请优先使用 Bug、Skill Gap 或 Example Proposal 表单；尚未成形的问题与想法放到
[Discussions](https://github.com/zenstory-ai/novel-to-game/discussions)。

## Before changing files / 修改前

1. Search existing issues and pull requests for the same problem.
2. State the user-visible failure or adaptation decision before proposing an
   implementation.
3. Use only source text and media that may legally be redistributed. Link the
   authoritative source and record its licence or public-domain status.
4. Never commit credentials, private prompts, unpublished manuscripts, or
   third-party copyrighted assets without permission.
5. Do not add a dependency unless the contribution has an explicit product
   need that existing tools cannot meet.

开始前请先搜索重复问题，说清用户可见的失败或改编决策，并确认文本、图像、
音频与模型的权利。不要提交密钥、私有提示词、未公开稿件或未授权素材。

## Repository contracts / 仓库契约

- Keep each skill self-contained. Invoke another skill by name; do not create a
  runtime file dependency across skills.
- Keep `SKILL.md` procedural and compact. Put optional depth in one-level
  `references/` files.
- Skill bodies and `references/` use Simplified Chinese. Skill frontmatter,
  plugin listing copy, and `agents/openai.yaml` interface fields lead with
  English and then Chinese.
- Example artifacts follow the language declared in their `example.json`.
- Preserve source-language quotations and culturally specific terms. When the
  output language differs, maintain one terminology table instead of replacing
  concepts with generic genre tropes.
- Keep `README.md` and `README_ZH.md` structurally aligned.
- Do not describe subjective fun, balance, visual quality, or adaptation quality
  as deterministically verified.

修改 Skill 时必须保持自包含、简体中文运行正文和英文优先的入口描述；修改
示例时必须遵守 `example.json` 的语言、来源、权利与证据边界。

## Verification / 验证

Every pull request must run the repository checks from the repository root:

```bash
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

Add the narrowest evidence that proves the changed behavior as well:

| Change | Required additional evidence |
|---|---|
| Skill or reference | A representative invocation or fixture when prose changes behavior |
| Plugin manifest | Parse/install/discovery check for every affected adapter |
| Example planning artifact | Source citation and artifact-chain link audit |
| Example build | Its declared lint/typecheck/tests/build plus a complete-run record |
| Visual or interaction claim | Real browser screenshot, state snapshot, or recorded input path |

If a check cannot run, write `NOT_RUN: <reason>` in the pull request. A missing
check is not a pass. Do not replace runtime evidence with prose or a mock when
the claim concerns real rendering, input, state change, result, or restart.

每个 PR 都必须运行上述两条仓库命令，并为改动的行为补充最小、直接的证据。
无法运行的检查必须写明 `NOT_RUN: <reason>`，不能当作通过。

## Pull requests / 拉取请求

- Keep the diff small and explain **why** the change is needed.
- Link the issue when one exists and list the exact files or surfaces changed.
- Include command output, evidence paths, and known gaps.
- Record source and asset provenance for any new example material.
- Preserve existing behavior unless the pull request explicitly changes its
  contract and updates tests and documentation together.
- Respond to review by updating the same evidence rather than opening a second,
  overlapping pull request.

请保持 diff 小而可审查，解释“为什么”，附上命令输出、证据路径、来源权利和
已知未验证范围。
