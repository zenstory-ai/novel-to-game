---
name: game-qa
description: "Verify a game with evidence on its selected target runtime. Launch the actual build and prove real rendering, input, the core loop, at least one designed outcome, restart, and explicit limitations without dressing subjective fun up as a certain verdict. Use for test a generated game, QA a game build, check whether the game is fully playable, or verify the build. 游戏证据化质量验证。在选定的目标运行环境中启动实际构建，证明真实渲染、输入、核心循环、至少一个设计结果、重开和明确限制，不把主观趣味包装成确定性结论。用于测试生成游戏、检查游戏能否完整游玩或验证构建。"
---
# 游戏质量验证

验证当前候选能否完成最小可玩闭环，不把自动化结果包装成趣味、平衡、权利或发布质量结论。

读取 [qa-contract.md](references/qa-contract.md) 定判据，按
[test-design-method.md](references/test-design-method.md) 设计最少但有区分力的检查。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 唯一必需合同

每个候选都必须用真实运行证据覆盖：`launch`、`render`、`input`、`coreLoop`、`outcome`、`restart`。
`targetFinish` 描述成色，不改变这组六项。`checks` 恰好只含六键；项目回归与诊断只能映射回其中
一项、写入 `verify.suites` / evidence，或作为 limitation，不得生成第七道门。

## 执行

1. 读取 `targetRuntime`、`testedRuntime` 和权威 verify；与 PRODUCT_BRIEF/BUILD_BRIEF 冲突时先报错，
   不由 QA 猜值。
2. 独立运行权威 verify，记录 command、exit code、环境和实际失败。
3. 在 `testedRuntime` 从 `clean start → 核心动作 → 设计结果 → restart` 走一条完整路径，证明画面
   非空且变化、真实输入改变状态、结果可达、重开恢复定义的初态。
4. 对照 GAME_DESIGN 中会改变结果的不变量和三段弧结束标记；只验证批准的设计承诺，不遍历所有
   代码路径。
5. 替代运行时只证明实际覆盖；目标独有输入、打包、性能和设备行为写 limitation。
6. 对游戏实际采用的连续 3D、多语言、无障碍、媒体或语音，可运行项目回归诊断；若失败确实破坏
   六项之一就映射到该项，否则只进入 suites/evidence/limitation，不建立额外 gate。
7. 记录 limitation 和问题的 product/design/art/build 归属。趣味、长期平衡、留存和商业价值只能写成
   未验证风险，不给确定性 PASS。

优先使用已有可观察状态；只有无法判断结果时才增加最小测试钩子。不要为了 QA 重构游戏或强制某种
框架、测试库或调试接口。

## 输出

- `qa/verification.json`：唯一机器事实源，包含三态 status、权威命令、complete run、六项 checks 和
  limitations；
- `qa/QA_REPORT.md`：从机器事实生成的简短摘要，说明环境、命令、结论和未测试范围。

状态只取 `NOT_RUN` / `FAIL` / `PASS`。缺口写结构化 limitation，不发明 `PASS_WITH_GAPS`；未运行或
失败的必需项不能满足整体 PASS。
