# Contributing / 参与贡献

Thank you for improving NovelToGame. This repository ships adaptation judgment
and reusable agent workflows rather than a bundled game engine. The most useful
contributions make a decision clearer, make a failure reproducible, or add
evidence that a generated game actually works.

感谢你参与改进 NovelToGame。本仓库提供的是小说改游戏的策划经验与可复用的 Agent
工作流，不捆绑特定游戏引擎。我们最欢迎能理清改编决策、复现具体故障，或用实机运行
结果验证游戏的贡献。

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

提交问题请优先使用 Bug、Skill Gap 或 Example Proposal 表单；尚在构思阶段的疑问与想法请发到
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

动手修改前请先搜索是否已有同类问题，写清用户可见的故障表现或待解决的改编取舍，并核实文本、图像、
音频与模型的版权与许可状态。切勿提交密钥、私有提示词、未公开书稿或未获授权的素材。

## Repository contracts / 仓库规范

The rules a change must respect (self-contained skills, language scope per
surface, evidence for QA claims, no dependency without a product need, decision
notes) live in [`AGENTS.md`](AGENTS.md). Read it once before editing; this file
does not restate it.

修改前请先通读 [`AGENTS.md`](AGENTS.md)，仓库各项规范统一在该文档维护。

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

每个 PR 都必须运行上述两条校验命令，并针对改动内容补充最直接的验证结果。
无法运行的检查项必须注明 `NOT_RUN: <reason>`，未运行的检查不能算作通过。

## Pull requests / 拉取请求

- Keep the diff small and explain **why** the change is needed.
- Link the issue when one exists and list the exact files or surfaces changed.
- Include command output, evidence paths, and known gaps.
- Record source and asset provenance for any new example material.
- Preserve existing behavior unless the pull request explicitly changes its
  contract and updates tests and documentation together.
- Respond to review by updating the same evidence rather than opening a second,
  overlapping pull request.

请保持改动精简易读，说明改动原因，并附上命令输出、验证文件路径、素材版权来源以及
尚未验证的范围。
