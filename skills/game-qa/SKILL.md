---
name: game-qa
description: "Verify a game with evidence on its selected target runtime. Launch the actual build and prove real rendering, input, the core loop, at least one designed outcome, restart, and explicit limitations without dressing subjective fun up as a certain verdict. Use for test a generated game, QA a game build, check whether the game is fully playable, or verify the build. 游戏实机质量验证。在选定的目标运行环境中启动实际构建，证明真实渲染、输入、核心循环、至少一个设计结果、重开和明确限制，不把主观趣味包装成确定性结论。用于测试生成游戏、检查游戏能否完整游玩或验证构建。"
---
# 游戏质量验证

用实机运行证据验证当前构建版本能否走通最小可玩闭环，不把自动化测试通过包装成“好玩、数值平衡、版权合规或达到上线水准”的定论。

先读 [qa-contract.md](references/qa-contract.md) 明确验收标准，再按 [test-design-method.md](references/test-design-method.md) 设计精简且有区分度的验证用例。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 唯一必需合同

任何构建版本都必须用真实运行证据跑通以下六项检查：`launch`、`render`、`input`、`coreLoop`、`outcome`、`restart`。`targetFinish` 只代表视觉与制作完成度，不增减这六项基础门禁。

## 执行

1. 读取 `BUILD_BRIEF.md` 中的 `targetRuntime`、`testedRuntime` 和权威 `verify` 命令；若与 `PRODUCT_BRIEF.md` 或 `BUILD_BRIEF.md` 前后矛盾，立即报错退回，不由 QA 自行猜测填补。
2. 在 `testedRuntime` 中运行权威 `verify` 命令：从纯净初始状态（`clean start`）出发，依次走完「核心动作 → 达成设计结局 → 重开回到初始状态」整条路径，如实记录执行的命令、退出码、运行环境、六项检查结果、最小运行证据和暴露的实际故障。
3. 对照 `GAME_DESIGN.md` 中会改变结局走向的硬规则和通关标记，只验证已批准的设计承诺，不追求走遍每一行底层代码分支。
4. 若项目包含可执行改编模型、事件日志、热修补丁或 `signature_command`，按 [test-design-method.md](references/test-design-method.md) 的对应要求把回归用例并入权威 `verify` 命令；排查期间允许做单点诊断、修复和重跑，但最终写入 `qa/verification.json` 的六项证据必须来自同一次完整运行。任何专项回归失败均需映射到上述六项检查或记入 `limitations`。
5. 如实记录未覆盖的限制项（`limitations`），并将发现的问题按 product / design / art / build 职责归属指派回对应环节。

验证时优先读取游戏已有的可见状态与 DOM/画面输出；只有在外部完全无法观测关键结果时，才添加最小化的测试钩子。

## 输出

- `qa/verification.json`：唯一的 QA 验收事实源（字段规格与证据要求见 [qa-contract.md](references/qa-contract.md)）。

尚未覆盖的测试盲区统一写入结构化的 `limitations` 数组，绝不生造 `PASS_WITH_GAPS` 之类的折中状态；只要有任一必测项未运行（`NOT_RUN`）或失败（`FAIL`），顶层状态就不得标为 `PASS`。
