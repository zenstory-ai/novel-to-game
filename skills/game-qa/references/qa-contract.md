# 实机验收规范

规定机器可读验收文件 `qa/verification.json` 的格式。状态只取 `NOT_RUN`、`FAIL` 或 `PASS`：没跑过不算通过，报错后靠保底分支绕过也不算通过。

## 记录文件

`qa/verification.json` 采用 schema v3，顶层只用下列字段，`checks` 必须且只能包含六个固定键：

```json
{
  "schemaVersion": 3,
  "status": "PASS",
  "verify": {"command": "<验证命令>", "exitCode": 0},
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

`completeRun.evidence` 指向工作区内同一次完整运行的观察记录（JSON，只存采集到的事实，不重复抄写命令与 `PASS` / `FAIL`）：顶层为 `schemaVersion: 1`、与 `completeRun.id` 一致的 `runId`、非空的 `environment`、非空的 `inputTrace` 步骤数组，以及恰好含六个同名键的 `observations`。每条观察含非空的 `id`、实际执行的 `inputs` 与非空的 `state` 快照；`render.visual` 指向工作区内的真实画面截图，`outcome.state` 与 `restart.state` 分别包含 `completeRun.terminal` 与 `completeRun.restart` 声明的值——只有截图证明不了底层状态，只有状态 JSON 也证明不了屏幕上真的画了出来。

验证命令无论成败都整份重写 `qa/verification.json`，不残留旧 `PASS`。专项回归记在 `verify.suites` 或证据文件里；专项回归破坏了六项之一，或盲玩证实存在 `P0` 阻断（例如脚本绕过了被遮挡的按钮）时，对应的 `checks` 键与顶层 `status` 记 `FAIL`。

## 六项必测流程与边界

单次 `completeRun` 连续证明：`launch`（在 `testedRuntime` 启动且无阻断报错）、`render`（画面非空，并随时间或操作发生看得见的变化）、`input`（真实输入触发可观察的状态变化）、`coreLoop`（核心循环跑通）、`outcome`（到达至少一个设计结局）、`restart`（重开后干净回到初态）。`targetFinish` 不增减这六项。

`targetRuntime` 与 `testedRuntime` 不同时，目标平台独有的外设、安装包、真机性能与硬件特性记入 `limitations`：在替代环境跑通不代表目标平台已验证。降级运行只有在采用预先批准的方案且实测全程跑通时才算通过；测试假数据、占位图与历史截图都不能冒充当前版本的通关记录。QA 只检验玩家一侧的视听、操作与通关流程，不审计上游的资产生成过程。
