# 质量验证契约

本契约只规定“下什么验收结论需要提供什么运行证据”；至于用哪套测试框架、开什么调试接口或怎么组织测试代码，由项目自行决定。

## 状态与事实源

检查状态只取 `NOT_RUN`、`FAIL` 或 `PASS`：未跑过测试不能算通过，报错后走兜底分支也不算成功过关。

`qa/verification.json` 采用 schema v3，顶层只允许使用以下字段，且 `checks` 必须且只能包含六个固定键：

```json
{
  "schemaVersion": 3,
  "status": "PASS",
  "verify": {"command": "<权威命令>", "exitCode": 0},
  "completeRun": {
    "id": "main-path",
    "cleanContext": true,
    "terminal": "designed-outcome",
    "restart": "initial-state",
    "evidence": "qa/evidence/run.json"
  },
  "checks": {
    "launch": "PASS", "render": "PASS", "input": "PASS",
    "coreLoop": "PASS", "outcome": "PASS", "restart": "PASS"
  },
  "limitations": [
    {"scope": "target device", "reason": "not available"}
  ]
}
```

`completeRun.evidence` 必须指向工作区内非空的 JSON 观察记录文件。该文件只保存实机运行采集到的客观事实，不重复抄写 `command`、`exitCode` 或六项 `PASS`/`FAIL` 结论：顶层固定包含 `schemaVersion: 1`、与 `completeRun.id` 一致的 `runId`、非空的 `environment` 对象、非空的 `inputTrace` 步骤数组，以及恰好包含六个同名键的 `observations` 对象。每条观察记录必须包含非空 `id`、实际执行的 `inputs` 数组和非空 `state` 快照；其中 `render.visual` 必须指向工作区内非空的真实画面截图，`outcome.state` 与 `restart.state` 必须分别包含 `completeRun.terminal` 和 `completeRun.restart` 声明的终态与初态值（其余观察项也可按需附带同次运行的截图路径）。

权威验证命令无论跑通还是失败，都必须整份覆盖重写 `qa/verification.json`，严禁在复跑失败后残留上一次的 `PASS`。项目专项回归套件统一记在 `verify.suites` 或证据文件中；一旦某条专项回归失败并破坏了六项基础能力之一，必须同步将对应的 `checks` 键标为 `FAIL`。

## 最小可玩闭环

单次权威验证运行必须同时证明以下六件事：

1. `launch`：游戏在实际 `testedRuntime` 中正常启动，无阻断性报错；
2. `render`：画面真实渲染非空，且随时间推进或玩家操作发生可见变化；
3. `input`：真实输入事件能触发可观察的游戏状态变化；
4. `coreLoop`：核心玩法循环完整跑通；
5. `outcome`：至少完整达成一个设计结局；
6. `restart`：触发重开后干净回到初始状态。

以上操作步骤、状态快照和画面截图必须产自同一次完整运行（`completeRun`）；光有静态截图不能证明底层隐藏状态正确，光靠导出内存状态 JSON 也不能证明屏幕上真的画出了画面。当目标运行环境（`targetRuntime`）与实际测试环境（`testedRuntime`）不同时，必须把目标平台独有的输入外设、安装包构建、真机性能和硬件特性写入 `limitations`；在替代环境中跑通不能代表目标平台已验证通过。

## 条件检查与边界

连续 3D 空间、多语言切换、无障碍辅助、角色配音、动态视频或生成式资产，仅在游戏实际采用了对应特性时才运行专项检查。QA 始终只检验玩家在屏幕上能否正常看到、听到、操作并走完核心流程，不跨界去审计上游供应商 API 请求日志、宣发物料或资产生成身份。

只有 `PRODUCT_BRIEF.md` 或资产台账预先批准的降级回落方案（fallback）才允许放行，且降级后仍须实测证明核心操作、状态流转、结局达成、可读反馈和重开全部正常。报错后勉强没崩仍属 `FAIL`；单元测试替身（Mock/Stub）只证明局部逻辑层；占位图只反映当前完成度；历史运行截图只代表旧版本——任何一层都不能越界冒充当前版本的实机通关证据。

本契约不强制要求真人试玩、人工逐条审阅或另写长篇 QA 报告。至于游戏好不好玩、数值是否耐玩、沉浸感强不强、抉择有无分量、版权是否合规及是否具备商业发行水准，均无法靠自动化脚本给出确定性证明；若需开展此类评估应另立专项任务（如新玩家体验诊断），不混入本契约的机器 `PASS` 判定。
