---
name: game-qa
description: "Verify a game with evidence on its selected target runtime. Launch the actual build and check logs, real rendering, input and state changes, the core loop, designed outcomes, restart, target display modes, interface language, first-time onboarding, and whether the core fantasy is actually performed — without dressing subjective fun up as a certain verdict. Use for test a generated game, QA a game build, check whether the game is fully playable, verify the build, check that story branches are reachable and choices are consumed. 游戏证据化质量验证。在选定的目标运行环境中启动实际构建，检查日志、真实画面、输入与状态变化、核心循环、设计要求的结果、重开、目标显示模式、界面语言、首次上手与核心幻想是否真正出现，不把主观趣味包装成确定性结论。用于测试生成游戏、检查游戏能否完整游玩、验证叙事分支与选择后果等需求。"
---
# 游戏质量验证

验证当前候选是否达到 `PRODUCT_BRIEF.md` 的 `assuranceProfile`，不把普通试玩原型默认升级为
发布审计，也不给“好玩”伪造客观分数。

读取 [qa-contract.md](references/qa-contract.md) 定判据，按
[test-design-method.md](references/test-design-method.md) 设计最少但有区分力的检查。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 一条判定公式

`required = profile 累加的玩家可感知检查`

- `smoke`：启动、变化的渲染、真实输入、核心循环、设计结果、重开。
- `delivery`：smoke + 目标运行时、目标显示模式、首次上手。
- `release`：delivery + 目标设备性能、必要资产失败降级和独立试玩。

不为 finish/`assuranceProfile` 组合另写分支——那说的是**证据强度**。`experienceProfile`
（体验承载）是另一个字段，它不改变必需检查的档位，只决定在必需项之外还要追踪哪些设计
承诺，见下文同名小节。公网、提交身份、证据哈希、生成任务和营销材料不影响游戏效果，
不进入本 QA。

## 执行

1. 读取 `assuranceProfile`、`targetRuntime`、`testedRuntime` 和权威 verify；它们与
   PRODUCT_BRIEF/BUILD_BRIEF 冲突时先报错，不由 QA 猜值。
2. 独立运行权威 verify，记录 command、exit code、环境和实际失败。
3. 在 `testedRuntime` 启动真实候选，从 `clean start → 核心动作 → 设计结果 → restart` 走一条完整
   路径。证明画面非空且变化、真实输入改变状态、结果可达、重开恢复定义的初态。
4. 对照 GAME_DESIGN 中会改变结果的不变量和三段弧结束标记；只验证设计承诺，不遍历所有代码路径。
5. `delivery` 及以上再检查目标显示模式、第一分钟上手和目标运行时差异。替代运行时只证明实际覆盖
   层，目标独有输入、性能、打包与设备项写 limitation；阻断当前 profile 时不能 PASS。
6. 只检查玩家实际能用到的条件效果：
   - 连续 3D：输入控制权、朝向/移动一致性、失焦归零，以及 collider 与可见布局的关键边界；
   - 多语言/无障碍：切换游戏内实际模式，检查关键玩法信息可读可用；
   - 媒体与语音：检查实际加载、播放、字幕、静音/缺音和失败降级。
7. 记录 limitation 和问题的 product/design/art/build 归属；趣味、长期平衡、留存与商业价值
   只写观察，不给确定性 PASS。

优先使用已有可观察状态；只有无法判断结果时才增加最小测试钩子。不要为了 QA 重构游戏或强制某种
框架、测试库或调试接口。

## 按 experienceProfile 追踪

从 `BUILD_BRIEF` 读取 `experienceProfile`（它逐字继承 `GAME_DESIGN` 第 1 节）；与 GAME_DESIGN
冲突时按第 1 步的规则先报错，不由 QA 猜值。`narrative-led` 或 `hybrid` 时，除核心六项外还要
按 qa-contract.md「按 experienceProfile 增加断言」验证：分支可达、旗标被消费、未选事实
不串线、人物知识边界、回响存在、结局区分。关键分支走正向与反向两条路径取证。

`coreLoop` 的机器键名与 schema 不变；叙事主导时它指"场景 → 介入 → 人物与世界回应 →
下一场"这个闭环，同样要求完整跑通并到达设计结果。

台词自然度、人物魅力、沉浸与选择重量不由这些断言证明，写入 `PLAYTEST_PROTOCOL.md`
交给独立审查或目标玩家；所有者自检只标 provisional。

## 输出

默认只写：

- `qa/verification.json`：机器事实源，只含 `assuranceProfile`、三态 status、权威命令、complete run、
  游戏效果 checks 和 limitations；
- `qa/QA_REPORT.md`：由 verification 生成的人读摘要，说明环境、命令、结论、缺口和未测试范围；
- `qa/PLAYTEST_PROTOCOL.md`：只有确实需要人工感受判断时才创建。

状态只取 `NOT_RUN` / `FAIL` / `PASS`。缺口写结构化 limitation，不发明 `PASS_WITH_GAPS`；若
`blocksProfiles` 包含当前 profile，整体不得 PASS。把裁决与一句原因交回总入口。
