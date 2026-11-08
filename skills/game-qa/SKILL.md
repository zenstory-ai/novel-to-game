---
name: game-qa
description: "Verify a game with evidence on its selected target runtime. Launch the actual build and prove real rendering, input, the core loop, at least one designed outcome, restart, and explicit limitations without dressing subjective fun up as a certain verdict. Use for test a generated game, QA a game build, check whether the game is fully playable, or verify the build. 游戏实机运行验收。在选定的目标运行环境中启动游戏，验证真实画面渲染、操作输入、核心循环、至少一个设计结局、重新开始及已知限制，不把主观好玩程度包装成确定性结论。用于测试生成的游戏、检查游戏能否完整通关或验收构建版本。"
---
# 游戏实机运行验收

通过实机运行记录验证当前构建版本能否走通最小可玩闭环，不把自动化测试通过包装成“好玩、数值平衡、版权合规或达到上线水准”的定论。

先读 [qa-contract.md](references/qa-contract.md) 明确验收标准，再按 [test-design-method.md](references/test-design-method.md) 设计精简且有区分度的验证用例。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 执行与输出

任何构建版本都必须通过实机运行跑通 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项检查（`targetFinish` 只代表视觉与制作完成度，不增减这六项基础门禁）：

1. 读取 `BUILD_BRIEF.md` 中的 `targetRuntime`、`testedRuntime` 和权威 `verify` 命令；若与 `PRODUCT_BRIEF.md` 前后矛盾，立即报错退回。
2. 在 `testedRuntime` 中运行权威 `verify` 命令（含项目专项回归），从纯净初始状态（`clean start`）连续走完「核心动作 → 达成设计结局 → 重开回到初始状态」；排查期间允许做单点诊断、修复和重跑，但最终写入 `qa/verification.json` 的六项结果必须来自同一次完整运行（`completeRun`）。优先读取游戏已有的可见状态与 DOM/画面输出，仅在外部完全无法观测关键结果时才添加最小测试钩子。
3. 产出 `qa/verification.json` 作为唯一的实机验收记录文件（字段要求与记录格式见 [qa-contract.md](references/qa-contract.md)）：未覆盖的测试盲区写入结构化 `limitations` 数组（不生造 `PASS_WITH_GAPS` 等折中状态），任一必测项为 `NOT_RUN` 或 `FAIL` 时顶层状态不得标为 `PASS`；暴露的问题按 product / design / art / build 职责归属指派回对应环节。
