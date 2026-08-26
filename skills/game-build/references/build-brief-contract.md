# 构建说明契约

构建说明只约束产品边界、实际运行方式和证明方式；不要规定实现模型能从环境正确决定的类、着色器、
框架或文件拆分。

```text
# 成品目标
targetFinish: [逐字继承 PRODUCT_BRIEF]
buildStage: [whitebox | production]
buildPath: [template | custom]
[目标平台、目标交付物、受众、切片时长、视口/朝向/输入、分级、联网边界]

# 必读设计
- whitebox: [GAME_DESIGN.md]
- production: [GAME_DESIGN.md, ART_DIRECTION.md]

# 必须保真
- 玩家承诺与核心幻想
- experienceProfile: [逐字继承 GAME_DESIGN]
- 3–5 个核心动词及各自输入、可观察状态变化
- 会改变结果的规则、三段弧结束标记
- 界面语言、人物声口和禁用句式
- 叙事项目追加主要路径、结局条件、持久旗标读取点和人物知识边界
- production 追加：每个界面/模式的招牌时刻、HUD 层级、主游玩面板的单焦点阅读边界与美术禁区

# 可执行模型（两阶段都需要）
- 最大风险与原型形态；采用 template 时列语法与脱离条件，custom 时列不可被模板替代的核心动词
- 运行时真正消费的最小状态、动作、前置、效果、观察者/知识更新、事件和不变量
- signature_command: [N/A，或 id / label / intents / slots / validators / commit；具体数量服从项目]
- 到期事项与谈话回灌（实际采用时）：来源、due/trigger、携带事实、重新上桌、结清；谈话只提交已验证结构
- contentRevision / rulesRevision / saveSchemaVersion / seed
- snapshot 用于载入，event log 用于定位与重放；两者不能互相冒充
- 固定验证路径：初态摘要、输入序列、预期终态/反馈、相邻反例
- 反馈 patch：issue id、owner、目标节点、兼容性、受影响路径与重放结果

# 范围
[必须包含；明确排除；最终范围差异]

# 运行与验证
toolchain:
  targetPlatform: [批准平台]
  targetRuntime: [计划交付的运行环境]
  testedRuntime: [本次实际启动的运行环境]
  engine: [实际引擎/框架]
  engineVersion: [实际版本或 NOT_AVAILABLE: 原因]
  runtimeVersion: [实际版本或 NOT_AVAILABLE: 原因]
  packageManager: [name@version；无则 none]
commands:
  install: [命令；无需安装写 NONE]
  buildOrExport: [命令；无需单独构建写 NONE]
  start: [命令]
  modelCheck: [whitebox 的最窄模型/回放检查；production 可写 NONE]
  verify: [production 的一条权威验证命令；whitebox 写 NOT_APPLICABLE]
verification:
  owner: [whitebox 为 design owner；production 为 game-qa]
  evidence: [whitebox 的结构化观察，或 production 完整运行生成的工作区相对路径]

# 当前限制
[scope / reason；testedRuntime 与 targetRuntime 不同时列目标独有未测试项]
```

## 最小完成证据

whitebox 只证明被选中的最大风险：规则/场景模型能启动，固定路径可运行与重放，偏差能定位回
GAME_DESIGN；不要求 ART_DIRECTION、最终 HUD、完整路径或 `qa/verification.json`，也不进入六项 QA 结论。

production 的权威 verify 必须能在一次完整路径中证明：启动成功、非空且变化的真实渲染、真实输入改变状态、核心
循环完成、至少一个设计结果可达、restart 回到定义初态。构建阶段只准备入口和可观察状态；由
`game-qa` 实际运行一次并写结论。证据使用工作区相对路径，不能只留临时目录或逐点击截图。

可执行模型、事件日志或 patch 存在时，verify 还应在项目回归中证明同版本同 seed/输入可重放、非法
前置不提交、未选择分支不污染、未见证者不引用秘密，以及 patch 声明外的状态不变。这些诊断映射回
六项玩家效果或写 limitation，不新增顶层 QA gate。

测试环境与目标运行环境不同时，这六项只声明实际覆盖；源码身份、公网、营销、主观趣味、权利
判断和完成度声明不进入这六项机器事实。

## 条件台账

### 视觉与必需资产

只列批准的焦点资产与招牌时刻：资产键、生产状态、工作区证据和剩余问题。必需运行期资产失败必须
阻断或进入明确错误界面；可降级项须预先写 fallback，并证明核心动作、状态、结果、可读反馈和重开
仍成立。

同时继承 `ART_DIRECTION.md` 的明度边界。非低照度题材检查首屏、核心循环、夜景和结果页，禁止用
未经批准的全局黑罩、暗角、降曝光或灰色小字替代气氛设计；夜景至少能辨认人物轮廓与朝向、关键器物、
行动目标、正文／选项和结果信号。批准的暗调界面须保留约定的亮度或高对比 fallback，并在目标视口
用实际交互画面验证，而不是只验静态海报。

时代题材另列目标图批准状态和三轴合同：世界时代、表现媒介、人物理想化程度。未批准前只生产最小
样张；批准后批量资产必须引用目标图与身份母版，并继承光色、构图和文本留白。若用户否决样张，构建
立即停止同方向扩批，替换所有运行引用并从发布目录清掉旧图、试验图和未引用变体。

### 连续 3D

采用连续 3D 时记录输入控制权、相机/移动前向、失焦归零，以及会改变路线的可见布局与 collider
边界。不要把渲染帧率或一条成功路线当碰撞证明。

### 动态媒体与语音

只记录游戏实际采用的媒体或语音资产、来源、运行文件、字幕/静音/缺音 fallback 和生成状态。密钥
不入库；未生成写 `NOT_RUN: 原因`。生成请求、营销旁白和可重建中间文件不作为最小 QA 证据。

## 权威验证

verify 可以组合现有游戏效果脚本，但最终 QA 只运行一次；由 `game-qa` 在 `qa/verification.json`
回写实际 command、exit code、完整路径、六项结果和当前限制。构建者不得预填 PASS 或另跑一套平行
验收。预算、时间或调用上限只会留下 NOT_RUN/FAIL、延期或缩小范围，不会替代证据。
