# 构建说明规范

`BUILD_BRIEF.md` 只提炼产品边界、必须保真的核心体验、实际运行命令与验收记录，不硬性规定实现模型可自主决定的内部代码结构。按以下骨架填写本项目涉及的条目，不适用处无需硬凑系统：

```text
# 目标与设计
targetFinish: [继承 PRODUCT_BRIEF]
buildStage: [whitebox | production]
buildPath: [template | custom]
[平台、交付物、受众、范围、视口/输入、分级、联网边界]
[whitebox 读取 GAME_DESIGN；production 追加 ART_DIRECTION]

# 必须保真
experienceProfile: [继承 GAME_DESIGN]
[核心体验目标、核心动作及看得见的局面变化、会改变结果的规则和结束标记]
[产物语言与原作身份；叙事实际采用时记录路径、历史读取点和知识边界]
[production 继承关键游戏时刻、视觉约束与批准目标图]

# 最小实现与复现
[最大风险、原型形态、复用语法及脱离条件]
[运行时消费的状态、动作、前置、效果与不变量]
[初态、输入路径、预期结果；随机性相关时固定 seed]
[仅在采用生成式输入、知情权限、事件回放或存档迁移时追加对应规则说明]

# 运行
toolchain:
  targetPlatform: [批准平台]
  targetRuntime: [计划交付环境]
  testedRuntime: [本次实际启动环境]
  engine: [实际引擎/框架]
  engineVersion: [版本或 NOT_AVAILABLE: 原因]
  runtimeVersion: [版本或 NOT_AVAILABLE: 原因]
  packageManager: [name@version；无则 none]
commands:
  install: [命令；无需安装写 NONE]
  buildOrExport: [命令；无需单独构建写 NONE]
  start: [命令]
  modelCheck: [whitebox 的最窄风险检查；production 可写 NONE]
  verify: [production 权威命令；whitebox 写 NOT_APPLICABLE]
verification:
  owner: [whitebox 为 design owner；production 为 game-qa]
  evidence: [工作区相对路径]

# 限制
[实际范围差异、未测试项与原因；替代运行时不证明目标平台]
```

## 完成证据与空间交接

`whitebox` 阶段只聚焦验证头号设计风险，留存可复现的实机观察结果反馈给 `GAME_DESIGN.md`，不要求实装最终美术、跑通全流程或生成 `qa/verification.json`。

`production` 阶段的构建者需对照 `GAME_DESIGN.md` 中改变局势走向的数值门槛、结局条件、分支汇流、信息保密边界与存档迁移编写正反向自测断言（若接入生成式自由输入，同步构造篡改原著事实、违背在场承诺、私自改写已提交行动、向不在场角色泄密四类反例断言，并验证否定句、缺失槽位与矛盾指令会触发追问或拒绝而非误判），连同单次完整运行冒烟检查一并接入权威 `verify` 命令，连续证明启动成功、画面真实渲染、真实输入生效、核心循环跑通、达成至少一个设计结局及重开回到初始状态。所有实机运行记录保存在项目工作区内；构建者只负责提供验证入口与内部规则回归，不得预填 `PASS`，最终 `qa/verification.json` 必须由 `game-qa` 在盲玩验收与单次完整运行后整份重写覆盖（复跑失败时严禁残留旧 `PASS` 或拼凑多次运行结果）。必需资产加载失败时必须显式报错；可降级资产切换为预设替代方案后需验证核心体验依然成立。

凡是包含角色连续行走的场景，场景底图、逻辑世界尺寸、可行走边界、角色脚底锚点、交互热区与小地图必须共用同一套空间坐标（底图图像像素尺寸与逻辑世界尺寸分别记清；连续 3D 空间还需记清角色控制权归属、相机与移动朝向基准、窗口失焦时的输入归零处理及碰撞体积）。设置地形阻挡时，优先让画面可见的道路边界与底层通行判定共用同一套多边形几何，并由场景摆件轮廓直接生成碰撞阻挡；桥面宽度、水岸边缘与脚底碰撞半径放在一起联调，重绘或扩充地图后同步校准道路网格、阻挡物与触发点并妥善迁移旧档实体坐标。寻路路径必须从角色当前真实坐标起算并沿合法道路走完（同行随从同样沿合法道路移动），严禁在寻路或绕障失败时用穿墙直线或闪现瞬移兜底。
