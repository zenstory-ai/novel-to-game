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

这是一条自动化或代理可执行的运行验证，不要求真人试玩、主观评分或逐项人工批准。需要真人研究时
另立产品研究任务，不得把它变成当前候选 PASS 的隐藏前置条件。

## 执行

1. 读取 `targetRuntime`、`testedRuntime` 和权威 verify；与 PRODUCT_BRIEF/BUILD_BRIEF 冲突时先报错，
   不由 QA 猜值。
2. 只运行一次权威 verify：它在 testedRuntime 从 clean start → 核心动作 → 设计结果 → restart
   完成整条路径，并记录 command、exit code、环境、六项结果、最小证据和实际失败。
3. 对照 GAME_DESIGN 中会改变结果的不变量和三段弧结束标记；只验证批准的设计承诺，不遍历所有
   代码路径。
4. 若候选有可执行模型、事件日志或 patch，由同一权威 verify 内嵌项目回归，不由 QA 另跑第二条命令：
   同版本同初态/seed/输入得到同一终态，非法动作不提交，未选分支不污染，角色与玩家不读取未获知事实；
   patch 只改变声明节点并重放受影响路径。若有 `signature_command`，还验证规范化候选的确定性提交、
   否定/含混/冲突输入不误命中、执行阻力可拒绝或部分完成、实际结果与反馈一致、到期事项准时且只触发
   一次；谈话不得越权提交效果或泄露知识。失败按影响映射到 `coreLoop` / `outcome` / `restart` 或写
   limitation，不新增 checks。
5. 记录 limitation 和问题的 product/design/art/build 归属。趣味、长期平衡、留存和商业价值只能写成
   未验证风险，不给确定性 PASS。

优先使用已有可观察状态；只有无法判断结果时才增加最小测试钩子。不要为了 QA 重构游戏或强制某种
框架、测试库或调试接口。

## 输出

- `qa/verification.json`：唯一 QA 事实源，包含三态 status、权威命令、complete run、六项 checks、
  一条证据路径和 limitations。证据文件保留运行细节，不再复制一份 `qa` 结论对象，也不再生成
  重复的人工可读 QA 报告。

状态只取 `NOT_RUN` / `FAIL` / `PASS`。缺口写结构化 limitation，不发明 `PASS_WITH_GAPS`；未运行或
失败的必需项不能满足整体 PASS。
