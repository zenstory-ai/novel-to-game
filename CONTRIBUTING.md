# Contributing / 参与贡献

Thank you for contributing to NovelToGame. This repository provides adaptation
guidance and reusable agent workflows—not a bundled game engine. The most
helpful contributions clarify an adaptation trade-off, make a failure
reproducible, or prove with runtime evidence that a generated game works.

感谢参与改进 NovelToGame。本仓库提供的是小说改游戏的策划判断与可复用 Agent 工作流，
不包含游戏引擎。我们最欢迎能把改编取舍讲透、稳定复现问题，或补齐通关实测证据的贡献。

## Choose the right contribution / 选择贡献类型

- **Bug report:** a skill, plugin adapter, validator, example, or documented
  command behaves differently from its contract.
- **Skill gap:** the workflow misses an adaptation decision or produces a
  repeatable failure that belongs in reusable guidance.
- **Example proposal:** a source-grounded game covering a new genre, interaction
  style, language, or QA setup.
- **Pull request:** a focused change with its own verification and provenance.

Use the structured issue forms instead of opening a blank issue. Questions and
early ideas belong in [GitHub Discussions](https://github.com/zenstory-ai/novel-to-game/discussions).

反馈问题请优先填写 Bug、Skill Gap 或 Example Proposal 表单；尚在讨论阶段的想法与疑问请发到
[Discussions](https://github.com/zenstory-ai/novel-to-game/discussions)。

## Before changing files / 修改前

1. Search existing issues and pull requests for the same problem.
2. State the user-visible failure or adaptation trade-off before proposing a fix.
3. Use only source text and media you are authorized to redistribute. Link the
   authoritative source and record its license or public-domain status.
4. Never commit credentials, private prompts, unpublished manuscripts, or
   unlicensed third-party assets.
5. Do not add a dependency unless an explicit product need cannot be met with
   existing tools.

动手前请先搜索是否已有同类问题，写清用户可见的故障现象或改编取舍，并核实文本、图像、
音频与模型的授权或许可状态。切勿提交密钥、私有提示词、未公开书稿或未获授权的素材。

## Repository contracts / 仓库规范

All repository rules—self-contained skills, per-surface language boundaries,
evidence-backed QA, zero unnecessary dependencies, and decision notes—live in
[`AGENTS.md`](AGENTS.md). Read it before editing; this guide does not duplicate it.

仓库各项规范统一在 [`AGENTS.md`](AGENTS.md) 维护，修改前请先通读。

## Verification / 验证

Run the repository checks from the root directory before opening a pull request:

```bash
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

Include the most direct evidence for the behavior you changed:

| Change | Required additional evidence |
|---|---|
| Skill or reference | A representative invocation or fixture when prose changes behavior |
| Plugin manifest | Parse/install/discovery check for every affected adapter |
| Example planning artifact | Source citation and artifact-chain link audit |
| Example build | Its declared lint/typecheck/tests/build plus a complete-run record |
| Visual or interaction claim | Real browser screenshot, state snapshot, or recorded input path |

If a check cannot run, record `NOT_RUN: <reason>` in the pull request. A skipped
check is never a pass. Do not substitute prose or mocks for live runtime
evidence when claiming real rendering, input, state updates, outcomes, or
restart behavior.

每个 PR 都必须先跑通上述两条校验命令，并针对改动点附上最直接的实测证据。无法运行的检查必须注明
`NOT_RUN: <reason>`，未跑过的检查不能算通过。

## Pull requests / 提交 PR

- Keep the diff focused and explain **why** the change is needed.
- Link the issue if one exists and list the exact files or surfaces touched.
- Include command output, evidence paths, and untested scope.
- Record source and asset provenance for any new example material.
- Preserve existing behavior unless the pull request intentionally updates a
  contract alongside its tests and docs.
- Address review feedback on the same pull request instead of opening a
  duplicate one.

请保持改动聚焦易读，写明改动原因、命令输出、证据路径、素材版权来源以及未验证范围。
