# 质量验证契约

本契约只规定什么结论需要什么证据。测试框架、调试接口和实现结构由项目决定。

## Profile 与状态

状态只取 `NOT_RUN` / `FAIL` / `PASS`。机器记录里使用 `NOT_RUN`；人读表格可写
`NOT_RUN: reason`。未验证不是通过，graceful failure 也不是 fallback。

三档只增加会改变玩家实际体验的检查：

| profile | 必需检查 |
|---|---|
| smoke | launch、render、input、coreLoop、outcome、restart |
| delivery | smoke + targetRuntime、targetDisplay、onboarding |
| release | delivery + 目标设备性能、必要资产失败降级和独立试玩 |

`targetFinish` 只描述成色，不改变公式。公网、发布身份、仓库提交和营销材料不属于游戏效果 QA。

## 默认事实源

`qa/verification.json` schema v2 至少包含：

```json
{
  "schemaVersion": 2,
  "assuranceProfile": "smoke",
  "status": "PASS",
  "checks": {
    "launch": {"status": "PASS", "evidence": ["qa/evidence/run.json"]}
  },
  "verify": {
    "command": "<权威命令>",
    "exitCode": 0
  },
  "completeRun": {
    "id": "main-path",
    "cleanContext": true,
    "terminal": "designed-outcome",
    "restart": "initial-state",
    "evidence": "qa/evidence/run.json"
  },
  "limitations": [
    {"scope": "target device", "reason": "not available", "blocksProfiles": ["delivery", "release"]}
  ]
}
```

`verification.json` 只记录权威命令、一次完整路径、六个核心结果和必要限制。不要加入源码指纹、
证据哈希、能力清单、公网探测或发布门禁。对无障碍、语言、音频、3D 控制等模式，仅当它们确实
改变玩家看到、听到或操作到的效果时，才增加对应检查。

## 最小可玩闭环

一次权威运行至少证明：

1. 候选在实际 `testedRuntime` 启动，无阻断错误；
2. 画面非空且会随时间或操作变化；
3. 真实输入引起可观察状态变化；
4. 核心循环完整执行；
5. 至少一个设计结果可达；
6. restart 回到定义初态。

步骤、状态和画面必须属于同一次 complete run；截图不能证明隐藏状态，
状态 dump 不能证明真实画面。证据落在工作区持久路径，不引用临时目录。

目标运行环境与实际测试环境不同时，把目标独有输入、打包、性能和设备行为写 limitation。替代版本
不能证明目标平台已通过。

## 按 experienceProfile 增加断言

六项核心检查的**名称与 schema 不变**（`coreLoop` 仍是机器键名），变的是它在本项目里指什么。
`coreLoop` 读作"玩家反复经历的那个闭环"：系统主导取动作 → 反馈 → 状态变化；叙事主导取
场景 → 介入 → 人物与世界回应 → 下一场，两者都必须完整跑通并到达设计结果。

`BUILD_BRIEF` 的 `experienceProfile`（逐字继承 `GAME_DESIGN` 第 1 节）为 `narrative-led` 或
`hybrid` 时，在核心六项之外补以下断言。它们都是**可复核**检查——走同一条路径、读同一段
产出应得到同一结论——但其中几项要读文本作语义判断（例如"未选事实有没有出现在后续台词
里"），不是比大小那种机械断言。判断依据要写进证据，不能只留一个 PASS。

这些断言记进 `verification.json` 的 `checks`，与六项核心检查同级，键名固定用下表左列。
**任何被写进 `checks` 的项处于 `FAIL` 时，整体 `status` 都不得为 `PASS`**——附加断言不是
可选装饰。

| 机器键名 | 断言 |
|---|---|
| `branchReachability` | 分支可达 |
| `flagConsumption` | 旗标被消费 |
| `branchIsolation` | 未选事实不串线 |
| `characterKnowledge` | 人物知识边界 |
| `delayedEcho` | 回响存在 |
| `endingDistinction` | 结局区分 |

- **分支可达**（`branchReachability`）：GAME_DESIGN 声明的每条主要路径与每个结局都能从
  clean start 实际走到；走不到的写 FAIL，不写"内容未完成"。
- **旗标被消费**（`flagConsumption`）：每个持久旗标存在至少一个实际读取点，且该读取点在某条路径上真的触发。
  只写不读的旗标按缺陷报告，归属 design 或 build。
- **未选事实不串线**（`branchIsolation`）：对关键分支走正向与反向两条路径，断言未选择的行为没有出现在后续
  文本、人物台词或可用行动里。这是"人物说明逻辑混乱"最常见的成因。
- **人物知识边界**（`characterKnowledge`）：人物在某场使用的信息，必须是他在该场之前已经获得的。用知识表逐条
  对照，越界即 FAIL。
- **回响存在**（`delayedEcho`）：GAME_DESIGN 声明的每处延迟回响，在满足条件的路径上确实出现在玩家可见
  文本里，且点名玩家做过的具体事。
- **结局区分**（`endingDistinction`）：两条做出不同关键选择的路径，不得到达字字相同的结局文本。

以下结论**不能**由这些断言得出，只能来自独立文案审查或目标玩家试玩：台词自然度、人物
魅力、沉浸、选择重量、主观节奏。作者、设计者或构建所有者的自检只标 provisional。

## 影响游戏效果的条件检查

### 连续 3D

连续 3D 游戏检查取得输入控制权、真实朝向变化、相机与移动前向一致、失焦/
暂停/恢复归零，以及会改变路线的 collider 与可见布局可追溯。确定性 shim 只证明覆盖层，不能替代
目标设备的真实输入锁定。

### 多语言与无障碍

只测试游戏里实际提供的模式。检查字体、截断、阅读顺序、关键玩法信息、颜色替代、可关闭动效和
输入可操作性。没有玩家入口的模式不制造空门。

### 语音与 TTS

只检查玩家实际听到的语音、字幕同步、静音和缺音降级。模拟损坏文件、静音和缺音，确认核心状态、
结果、反馈和重开仍可理解。生成流程、供应商请求和营销旁白不进入游戏效果 QA。

### 生成媒体与 3D 资产

只检查媒体或 3D 资产在游戏里是否正确加载、显示、运动，以及失败后玩家是否仍能理解并完成核心
流程。生成请求、任务 ID、仓库 provenance 和发布清单不进入游戏效果 QA。

## Fallback 边界

只有 brief/ledger 预先批准的 fallback 才能继续，并证明核心动作、状态、结果、可读反馈和 restart
五项仍成立。以下概念不得混用：

- graceful failure：安全失败，仍是 FAIL；
- test substitute：只证明测试层，目标层写 limitation；
- placeholder/graybox：是 finish 事实；
- historical evidence：只说明旧候选。

## QA_REPORT 与人工试玩

`QA_REPORT.md` 从机器事实生成，至少写环境、实际命令、通过/失败、limitations、未测试范围和问题
归属。不要复制发布审计、源码身份或资产台账。

`PLAYTEST_PROTOCOL.md` 只承接机器不能确定的体验问题：第一分钟是否理解、核心幻想是否真的形成
场面、节奏与手感。记录观察者、路径和原话，不把少量试玩包装成普遍结论。
