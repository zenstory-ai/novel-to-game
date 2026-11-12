# 实机验收规范

本规范规定机器可读验收凭证 `qa/verification.json` 的记录格式；新玩家视角的体验诊断见 [blind-playtest-method.md](blind-playtest-method.md)。测试框架与内部自测组织由构建阶段自行决定，`targetFinish` 只代表视觉与制作完成度，不增减六项基础检查。

## 状态与记录文件

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

`completeRun.evidence` 必须指向工作区内非空的 JSON 观察记录文件（只存同次完整运行采集到的客观事实，不重复抄写 `command`、`exitCode` 或 `PASS`/`FAIL`）：顶层固定包含 `schemaVersion: 1`、与 `completeRun.id` 一致的 `runId`、非空 `environment`、非空 `inputTrace` 步骤数组，以及恰好包含六个同名键的 `observations` 对象。每条观察记录含非空 `id`、实际执行的 `inputs` 数组和非空 `state` 快照；其中 `render.visual` 必须指向工作区内非空的真实画面截图，`outcome.state` 与 `restart.state` 必须分别包含 `completeRun.terminal` 和 `completeRun.restart` 声明的终态与初态值（光有静态截图不能证明底层状态正确，光导出状态 JSON 也不能证明屏幕真实绘出画面）。

权威验证命令无论成败都必须整份重写覆盖 `qa/verification.json`，严禁复跑失败后残留旧 `PASS`。专项回归套件记在 `verify.suites` 或证据文件中；若专项回归失败破坏了六项基础能力之一，或首轮新玩家实机盲玩证实存在 `P0` 阻断（如脚本绕过被遮挡按钮或死胡同而假绿），必须同步将对应 `checks` 键与顶层 `status` 标为 `FAIL`。

## 六项闭环与边界

单次 `completeRun` 必须连续证明：`launch`（在 `testedRuntime` 正常启动无阻断报错）、`render`（画面非空且随时间或操作发生肉眼可见的画面变化）、`input`（真实输入触发可观察状态变化）、`coreLoop`（核心玩法循环跑通）、`outcome`（至少达成一个设计结局）、`restart`（重开后干净回到初始状态）。当 `targetRuntime` 与 `testedRuntime` 不同时，必须将目标平台独有的外设、安装包、真机性能与硬件特性记入 `limitations`（在替代环境中跑通不能代表目标平台已验证通过）。

连续 3D 空间、多语言、无障碍、配音或动态视频仅在实际采用时运行专项检查；QA 只检验玩家侧的视听、交互与闭环，不跨界审计上游供应商请求日志或资产生成身份。仅预先批准的降级方案（fallback）且实测闭环正常时才允许放行；报错后勉强没崩仍属 `FAIL`，单元替身（Mock/Stub）、占位图或历史运行截图均不得冒充当前版本的实机通关记录。
