# 构建说明契约

构建说明只约束产品和证明方式：

```text
# 成品目标
[目标平台、目标交付物、受众、时长和完整体验；逐字抄入 PRODUCT_BRIEF.md 声明的目标视口 / 朝向 /
最小分辨率，以及首屏加载 / 总包体上限 / 目标帧率的性能预算；性能预算为 N/A 时，回总入口
把推荐值以未确认假设写入 PRODUCT_BRIEF.md 后再抄入本 brief，不得在本层就地发明]

# 必读设计
[GAME_DESIGN.md, ART_DIRECTION.md]

# 必须保真
[核心循环、世界规则、视觉风格]
- 招牌时刻：逐条抄入 ART_DIRECTION 每个界面 / 模式的时刻名 + 一行触发条件
- 可证伪视觉断言：抄入可被截图直接证伪的规格（底材 / 基色、人物占比、飘字位置）
- 美术必备资产键清单：逐键抄入 ART_DIRECTION 标注「必须提供」的资产（含表情 / 状态
  套图），每键注明允许的过渡态与待产登记去向
- 动态媒体台账（含视频 / 关键帧驱动演出时必填）：风格锁 STYLE_LOCK 去向、每张参考图的
  职责声明（may_control / must_not_control）、每镜 start_boundary / end_boundary、
  请求与响应、任务 ID、本地输出与哈希的落盘路径（默认 `build/media/evidence/<shot_key>/`）
- 随状态变化的表演规则：表情、距离、构图随可读状态如何变化，逐条列出
- 界面语言与文案声口：人物声口一句概括 + 禁用句式清单，抄自 GAME_DESIGN.md
- 语音资产台账（ART_DIRECTION 语音策略非 `none` 时必填）：逐句记录 `line_id`、角色 / 旁白、
  `casting_id`、性别呈现 / 年龄感、触发状态、语言、逐字台词、字幕键、音色权利、发布门禁 / 可降级、
  静音 / 缺音 fallback；每个角色绑定独立选角，不得只按语言复用通用音色。构建
  完成后回写供应商、模型、音色来源、去密钥请求指纹 `request_sha256`、原始 / 最终文件与
  SHA256、时长、格式、采样率、声道、响度检查和真实生成状态。未实际合成写 `NOT_RUN: 原因`，
  不得用配置文件冒充音频
- 前提上屏文案（必填）：玩家在第一分钟看到的**逐字文本**——我是什么、我要什么、什么会
  终结这一局，以及它们各自出现在哪一屏。抄的是 GAME_DESIGN 已写好的屏幕文本，不是
  PRODUCT_BRIEF 的核心幻想那一行；brief 的措辞是给团队读的，不是给玩家读的
- 同玩法动词清单（必填）：逐字抄 GAME_DESIGN「类型落地与对标原则」里那 3-5 个来自同玩法
  先例的核心动词，每个后面写它在切片里怎么输入、改变哪个可观察状态。少实现一个就是范围
  变化，必须写进「最终范围对照」并回设计确认，不得静默省略——QA 逐个动词要证据
- 三段弧（必填）：逐字抄 GAME_DESIGN「三段弧」表三行——每期新增的可用动词与可达空间、
  一个可观察的结束标记。这三行是要实现的差集，不是背景说明：标记之前不可用，标记之后
  可用且用得上
- 社交表现假设：抄自 GAME_DESIGN，切片按该假设呈现（纯单人 / AI 假多人 / 占位异步榜）

# 范围
[必须包含；明确排除]

# 实现自由
根据当前环境自行选择最能实现已批准设计的技术方案。依赖、脚本、字体、图片、音频和导出设置
必须在仓库或引擎工程中可复现；远程运行依赖只有在 PRODUCT_BRIEF 明确批准联网能力时可用，
并写明离线或服务失效时的行为。网页项目使用 Phaser / Three / inkjs 等库时把依赖锁定并随项目
交付，不挂未锁版本的 CDN 标签或 import map。

# 工具链与权威验证
toolchain:
  targetPlatform: [PRODUCT_BRIEF 锁定的平台]
  targetRuntime: [计划交付和发布的运行环境]
  testedRuntime: [本次实际启动验证的运行环境；与 targetRuntime 不同时写批准依据]
  engine: [实际引擎或框架]
  engineVersion: [实际版本；不可取得时写 NOT_AVAILABLE: 原因]
  runtime: [实际 runtime；不可取得时写 NOT_AVAILABLE: 原因]
  runtimeVersion: [实际版本；不可取得时写 NOT_AVAILABLE: 原因]
  packageManager: [name@version；无包管理器写 none]
  browser: [仅网页项目填写实际浏览器与版本；其他平台写 N/A]
commands:
  install: [实际命令；无需安装写 NONE]
  buildOrExport: [构建或导出命令；无需单独构建写 NONE]
  start: [实际命令]
  verify: [一条权威验证命令]
verification:
  suites: [稳定 suite id 列表]
  completeRun: qa/verification.json#completeRun
  evidenceIndex: qa/verification.json#checkpoints

# 完成证据
[如何运行；必须走通的动作、结果、重开；在目标分辨率 / 窗口模式 / 朝向 / 设备下实测；核对性能预算
（首屏 / 包体 / 帧率）未超；权威验证的实际 command、exit code、duration、environment、log，
以及每个 required suite 是否在该次 log 中被调用；testedRuntime 与 targetRuntime 不同时，逐项
列出目标平台仍为 NOT_RUN 的输入、性能、打包、设备和发布门]
```

不要粘贴完整小说，也不要规定模型可以从环境正确决定的框架、类、着色器或资产
管线；但存储键、测试脚本名等对外可见实现符号由本 brief 统一命名，GAME_DESIGN 不含
实现符号。构建完成后在同一文件记录真实运行命令、已执行验证和当前限制，并附「最终范围
对照」：逐条回写实际交付相对 # 范围 与 GAME_DESIGN 的增删差异；范围变化同步更新
# 范围 并注明日期，后续质量验证以回写后的范围为准。`verify` 可以组合现有脚本，但必须一次
真实运行覆盖声明的 required suites；不能把多个从未一起运行过的绿色结果拼成一次通过。
