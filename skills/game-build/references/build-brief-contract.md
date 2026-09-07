# 构建说明契约

只压缩产品边界、必须保真的体验、实际运行方式与证据；不规定实现模型能自行决定的技术结构。
以下是交接骨架，按项目填相关内容，不为空白补造系统。

```text
# 目标与设计
targetFinish: [继承 PRODUCT_BRIEF]
buildStage: [whitebox | production]
buildPath: [template | custom]
[平台、交付物、受众、范围、视口/输入、分级、联网边界]
[whitebox 读取 GAME_DESIGN；production 追加 ART_DIRECTION]

# 必须保真
experienceProfile: [继承 GAME_DESIGN]
[玩家承诺、核心动作及可观察变化、会改变结果的规则和结束标记]
[产物语言与原作身份；叙事实际采用时记录路径、历史读取点和知识边界]
[production 继承关键游戏时刻、视觉约束与批准目标图]

# 最小实现与复现
[最大风险、原型形态、复用语法及脱离条件]
[运行时消费的状态、动作、前置、效果与不变量]
[初态、输入路径、预期结果；随机性相关时固定 seed]
[仅在采用生成式输入、知识权限、事件回放、存档迁移或专属命令时追加对应可执行模型合同]
signature_command: [N/A，或继承 id / label / intents / slots / validators / commit]

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

## 完成证据

whitebox 只证明选中的最大风险，保留可复现的实际观察并定位回 GAME_DESIGN；
不要求最终美术、完整产品路径或 `qa/verification.json`，不进入六项 QA 结论。

production 的权威 verify 必须在同一次完整运行中证明启动、真实渲染、真实输入、核心循环、
至少一个设计结果与重开。证据留在工作区，不只保存在临时目录。
构建者准备入口，不预填 PASS；game-qa 记录实际命令、退出码和结果。

允许定向检查、修复和复跑；最终 `qa/verification.json` 原子替换为当前完整运行结果，
失败不得残留旧 PASS，也不能拼接不同版本或不同运行的六项成功。
有事件、知识权限或 patch 时，将其相关回归纳入项目验证，不另设顶层通用门禁。

## 按需交接

- 视觉：只列批准的焦点资产、生产状态、运行中证据和剩余问题，继承 ART_DIRECTION，不重新裁决风格。
  必需资产失败须明确报错；可降级项采用预先定义的替代，并验证玩家效果仍成立。
- 连续 3D：记录控制权、相机/移动前向、失焦归零，以及改变路线的布局与碰撞边界；
  帧率或一条成功路线不证明碰撞正确。
- 动态媒体/语音：记录实际资产、来源、运行文件、字幕/静音/缺音替代与生成状态，
  不把生成请求或营销旁白当成游戏运行证据。

预算或工具缺口只能产生明确限制、NOT_RUN/FAIL 或经批准的范围调整，不能替代证据。
