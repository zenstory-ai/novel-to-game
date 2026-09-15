# Agent Note: skill 散文设行数预算，加一条规则先删一条

Status: implemented

## Problem

Prompt 文件只增不减：加规则读起来像尽职，删规则读起来像冒险，于是每次迭代都在稀释模型注意力。2026-07-24 的 occam trim 只删了 13 行且没有留下机制，到 08-11 七个 skill 已到 3192 行，大部分是 `SKILL.md` 与自家 `references/` 的重复。

## Decision

`scripts/validate_repo.py` 的 `validate_skill_budget` 对 `skills/**/*.md` 计行：`SKILL.md` 单文件 ≤ `SKILL_MD_LINE_BUDGET`（100），reference ≤ `REFERENCE_LINE_BUDGET`（150），全部合计 ≤ `SKILL_TOTAL_LINE_BUDGET`（1900）。超限即校验失败，错误信息直接指示"删等量内容，或在本文件提高常量并在 commit 里说明理由"。

- 数字不是机制，机制是数字住在一个必须被 diff 的文件里：加规则 must 删规则或显式提高常量；允许提高，never 静默漂过。
- 一条规则在一个 skill 里只住一处：要么 `SKILL.md`，要么该 skill 已读取的 reference。
- 改 skill 等于改模型行为，"读起来还行"不算验证；#27 用同一虚构小说前提做盲评 A/B（6 样本、4 评委、5 维度）确认裁剪无回归后才合并。
- 预算随裁剪收紧：#27 定 3100/170/250，#44 再删重复后收到 1900/100/150。

来源：ce42b4a、45f3083 (#27)、58e0ae4 (#44)、35a1bee (#48)

## Alternatives considered

- **一次砍到 20%** — 最强理由：更大幅度才能明显释放注意力。否决原因：逐 skill 审计提出 91 处删除，对抗评审保住 43 处为承重规则，强行超越评审是拿实测安全换一个数字（#27）。
- **只凭对抗评审合并裁剪，不做 A/B** — 最强理由：评审已逐条辩护。否决原因：评审只能说规则看起来冗余，只有输出对比能说行为没变（#27）。
- **无机制的定期人工精简（ce42b4a）** — 最强理由：不需要改校验器。否决原因：实际只删了 13 行，棘轮很快转回去。

## Consequences

- 收益：每次增长都是被评审看见的决定；`skills/` 总量有上限，Agent 读取成本可预期。
- 代价：自包含要求（见 [single-skill-bundle](../architecture/2026-07-18-single-skill-bundle-self-contained-skills.md)）让必要的跨 skill 重述也计入预算，作者要在"再抄一次"与"删别的"之间取舍；A/B 是 n=3/arm 的粗筛，抓不到细微退化。
- 明确保留、不因预算而删的：反 slop 禁语表、能动性契约、叙事轨规则、产物语言规则——它们各自对应仓库真实踩过的失败。
