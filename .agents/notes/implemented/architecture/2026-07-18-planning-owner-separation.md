# Agent Note: 概念、体验/关卡、美术方向三类 owner 分离，上游事实不可静默改写

Status: implemented

## Problem

最贵的改编错误发生在写代码之前：平台、类型、画风、分级这些框架决定被每个下游阶段各自默认，金瓶梅首版把"文学向、无露骨"一路默认到构建才发现不是用户要的；SOURCE_BIBLE 里混入过状态键、日程表、试玩计划这类下游发明，概念卡里塞过伤害公式与调参百分比，实现阶段随手就能改掉策划。

## Decision

工作区固定为 `PRODUCT_BRIEF.md` → `analysis/SOURCE_BIBLE.md` → `concepts/CONCEPT.md` → `design/GAME_DESIGN.md` + `design/ART_DIRECTION.md` → `build/BUILD_BRIEF.md` + `build/app/` → `qa/verification.json`，外加 `_progress.md`。

- `PRODUCT_BRIEF.md` 与 `SOURCE_BIBLE.md` 是上游事实：brief 由 intake 先锁平台、引擎、交付物、目标运行时与实际测试运行时、分级、语言；下游 never 静默改写。
- 概念、体验/关卡设计、美术方向分别由 `CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 的 owner 负责；`game-build` never 静默重设计它们。SOURCE_BIBLE 只写带章节引用的原作事实；调参数字只住在 GAME_DESIGN。
- QA 发现按 owner 回流：product 回 brief；design/art 修批准文档后重建受影响范围；build 修实现并复跑同一验证路径。
- 编排器只记录两项完成检查：`scope`（brief、bible、三份设计交接存在且不冲突）与 `playable`（六项 QA 证据齐全，见 [six-check-minimal-qa-contract](../testing/2026-08-06-six-check-minimal-qa-contract.md)）；`_progress.md` never 复制 QA 明细。
- 工具链不可用时只能用 brief 已批准的替代运行时，替代结果 never 证明目标平台已通过。

来源：958056a、15c6663、70ee654 (#2)、1f9ba53、45d2c3c、6c450da (#20)

## Alternatives considered

- **让下游阶段按需默认框架决定（首版流程的实际状态）** — 最强理由：少一次用户停靠，quick 模式更顺。否决原因：金瓶梅返工证明默认值会一路带到构建；intake 改为"告知默认再确认"，只在会实质改方向或带来权利/尺度/平台风险的歧义上停靠（15c6663）。
- **所有原型一律在浏览器里做** — 最强理由：最便宜、最好自动化。否决原因：掩盖目标平台的输入、打包、性能与设备风险；平台与运行时是产品决定，下游不得为了方便替换（1f9ba53）。
- **把整份 GAME_DESIGN 再抄成一份 JSON/YAML 可执行模型** — 否决原因：无人读取的副本只制造第二个事实源；可执行模型 must 被候选运行时消费或作为测试合同逐项对照（pipeline-contract）。

## Consequences

- 收益：任何阶段的争议都有唯一 owner 文件可改，实现层不能把策划问题吞掉；`resume` 能从最早不成立的检查继续。
- 代价：三份设计文档与 brief 的字段（`targetFinish`、`experienceProfile`、运行时）必须保持一致，校验器只机械核对 `targetFinish`，其余靠 QA 在冲突时报错；早期工作区缺 `experienceProfile` 只允许补记一次，不得据此重做概念。
