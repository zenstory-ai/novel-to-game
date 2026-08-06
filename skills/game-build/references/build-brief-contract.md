# 构建说明契约

构建说明只约束产品边界、实际运行方式和证明方式；不要规定实现模型能从环境正确决定的类、着色器、
框架或文件拆分。

```text
# 成品目标
targetFinish: [逐字继承 PRODUCT_BRIEF]
assuranceProfile: [smoke / delivery / release，逐字继承]
publicationTier: [当前准备对外声明的等级]
[目标平台、目标交付物、受众、切片时长、视口/朝向/输入、分级、联网边界]

# 必读设计
[GAME_DESIGN.md, ART_DIRECTION.md]

# 必须保真
- 玩家承诺与核心幻想
- 3–5 个核心动词及各自输入、可观察状态变化
- 会改变结果的规则、三段弧结束标记
- 每个界面/模式的招牌时刻
- 第一故事分钟上屏文本：我是谁、要什么、什么会终结这一局
- 界面语言、人物声口和禁用句式

# 范围
[必须包含；明确排除；最终范围差异]

# 运行与验证
toolchain:
  targetPlatform: [批准平台]
  targetRuntime: [计划交付和发布的运行环境]
  testedRuntime: [本次实际启动的运行环境]
  engine: [实际引擎/框架]
  engineVersion: [实际版本或 NOT_AVAILABLE: 原因]
  runtimeVersion: [实际版本或 NOT_AVAILABLE: 原因]
  packageManager: [name@version；无则 none]
commands:
  install: [命令；无需安装写 NONE]
  buildOrExport: [命令；无需单独构建写 NONE]
  start: [命令]
  verify: [一条权威验证命令]
verification:
  completeRun: qa/verification.json#completeRun

# 当前限制
[scope / reason / blocksProfiles；testedRuntime 与 targetRuntime 不同时列目标独有未测试项]
```

## 默认完成证据

所有 profile 共用：

- 启动成功；
- 非空且变化的真实渲染；
- 真实输入改变状态；
- 核心循环完成；
- 一个设计结果可达；
- restart 回到定义初态。

用一条完整路径和最少语义 checkpoint 证明，不保存逐点击截图。状态、runtime、visual 各证明自己的
层，证据在工作区相对路径，不能只留临时目录。

`delivery` 再记录目标运行时、目标显示模式和首次上手；`release` 再检查目标设备性能、必要资产失败
降级和独立试玩。源码身份、公网投递和营销材料不进入游戏构建 QA。

## 条件台账

### 视觉与必需资产

高于 graybox 时，只列批准的焦点资产与招牌时刻：资产键、生产状态、工作区证据、剩余问题。必需
运行期资产失败必须阻断或进入明确非发布错误界面；不得静默切程序化/灰盒替身后继续宣称通过。
可降级项须预先写 fallback behavior，并证明 coreAction/state/result/readableFeedback/restart 五项保持。

### 连续 3D

仅采用连续 3D 时写：输入控制权、相机/移动前向、失焦归零；会改变路线的
`visibleAnchor / colliderShape / sourceOfTruth / solidPolicy`；固定子步或 swept 策略、滑动和解穿透。
不要把渲染帧率或一条成功路线当碰撞证明。

### 动态媒体

仅含视频、关键帧演出或生成资产时写动态媒体台账：每镜边界、参考职责、请求/响应、任务 ID、本地
输出与 hash。可重建 raw trace/中间编码不作为长期证据。

### 语音资产台账

语音策略非 `none` 时逐句记录：`line_id`、角色/旁白、`casting_id`、语言、台词、字幕键、音色权利、
发布门禁/可降级、静音/缺音 fallback。构建完成回写供应商类别、模型/音色来源、去密钥
`request_sha256`、最终文件与 SHA256、时长/格式和真实生成状态。未合成写 `NOT_RUN: 原因`；每个
角色独立选角，不得只按语言复用通用音色。

## 权威验证

verify 可以组合现有游戏效果脚本，但必须一次真实运行；在 `qa/verification.json` 回写实际 command、
exit code 和仍未覆盖的目标平台项。失败输出用于修复，默认不长期提交冗长日志或 suite registry。

预算、时间或调用上限只会留下 NOT_RUN/FAIL、延期或降低 publication tier，不会替代证据。构建阶段
不得假装完成 QA 的独立评审，也不得用降低公开措辞反向抬高实际 finish。
