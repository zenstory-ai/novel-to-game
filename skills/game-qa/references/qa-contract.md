# 通关验收规范

规定机器可读验收文件 `qa/verification.json` 的结构与判定标准。状态只取 `NOT_RUN`、`FAIL` 或 `PASS`：没实跑过不算通过，报错后靠保底分支绕过也不算通过。

## 验收记录格式

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

`completeRun.evidence` 指向工作区内同一次完整通关的观察记录（JSON，只存实测事实，不重复抄写命令与 `PASS` / `FAIL`）：顶层含 `schemaVersion: 1`、与 `completeRun.id` 一致的 `runId`、非空的 `environment`、非空的 `inputTrace` 步骤数组，以及恰好含六个同名键的 `observations`。每条观察含非空的 `id`、实际执行的 `inputs` 与非空的 `state` 快照；`render.visual` 指向工作区内的真实画面截图，`outcome.state` 与 `restart.state` 分别包含 `completeRun.terminal` 与 `completeRun.restart` 声明的值——光有截图证明不了底层状态，光有状态 JSON 也证明不了屏幕上真画了出来。

验证命令无论成败都整份重写 `qa/verification.json`，不留旧 `PASS`。专项回归记在 `verify.suites` 或证据文件里；专项回归破坏了六项之一，或盲玩证实存在 `P0` 阻断（如脚本绕过了画面上被挡死的按钮）时，对应的 `checks` 键与顶层 `status` 记 `FAIL`。

## 六项必测链路与边界

单次 `completeRun` 连续证明：`launch`（在 `testedRuntime` 正常启动且无阻断报错）、`render`（画面非空，并随时间或输入发生看得见的变化）、`input`（真实操作触发可观测的状态变更）、`coreLoop`（核心玩法循环跑通）、`outcome`（到达至少一个设计结局）、`restart`（重开后干净回到初态）。任何 `targetFinish` 都不增减这六项。

`targetRuntime` 与 `testedRuntime` 不同时（如用共用画布调试页测微信/抖音小游戏，或在替代环境测未绑定 UrhoX Runtime 的 TapTap 制造工程），目标平台独有的真机或 Runtime 预览、云端构建、外设与性能、正式广告位开通，以及个人主体认证、同名软著、自审报告与 ICP 备案等上线资质一律记入 `limitations`：替代环境跑通不代表目标真机已验证或可直接提审上线。降级运行只在采用预先批准的方案且实测全程跑通时才算通过；测试假数据、占位图与历史截图都不能冒充当前版本的通关记录。QA 只检验玩家看到的画面、声音、操作与通关流程，不回查上游资产是怎么生成的。
