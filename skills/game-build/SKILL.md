---
name: game-build
description: "Build the game for its approved target runtime. Compress GAME_DESIGN and ART_DIRECTION into a minimal BUILD_BRIEF, hand it to the current coding agent or another strong model to implement a fully playable build, and iterate against real runs and captured evidence. Use for implement the approved game design, build the game prototype, turn this design into a running game. 游戏构建执行。把批准后的 GAME_DESIGN 与 ART_DIRECTION 压缩成最小 BUILD_BRIEF，交给当前编码智能体或其他强模型，在选定的目标运行环境中实现可完整游玩的版本，并通过真实运行和证据迭代。用于把批准的游戏方案实现成可运行游戏。"
---
# 游戏构建执行

保护已批准的游戏设计并驱动强模型完成，不用教程限制模型本来就会的实现能力。

读取 [build-brief-contract.md](references/build-brief-contract.md)。必须已有
`GAME_DESIGN.md` 和 `ART_DIRECTION.md`；缺少产品决策时回到设计阶段。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

可玩交付跟随 `PRODUCT_BRIEF.md` 锁定的目标平台、生产引擎与交付运行时：可以是 PC 可执行
文件、引擎工程内可运行关卡、移动设备或模拟器构建、小程序开发者工具构建，也可以是网页。
分辨率与朝向、单局时长、控制方式、包体、分级和离线/联网边界都按目标平台执行。

目标工具链在当前环境可用时，直接用生产引擎构建并在目标运行时验证。工具链不可用时，不得
自动改做网页版本；先读取 `PRODUCT_BRIEF.md` 是否批准了**替代验证运行时**。获批的替代版本要在
`BUILD_BRIEF.md` 分开记录 `targetRuntime` 与 `testedRuntime`，并把无法证明的目标平台输入、性能、
打包与发布项标为 `NOT_RUN`。实现模型可在这些边界内决定架构、文件拆分、渲染和资产管线。

## 构建说明

只固定：成品目标、核心体验、类型契约中会改变结果的不变量、视觉锚点、原型范围、
非目标和完成证据。框架、架构、文件拆分、渲染技术和资产制作由实现模型根据环境决定。
`BUILD_BRIEF.md` 必须逐字继承 `targetFinish`，索引 `VISUAL_TARGETS.md` 的目标帧与发布门禁资产键，
并声明当前渲染、镜头、动画、FX 和资产管线的能力差距；不能表达目标时，先做一个代表场景 spike，
通过后才向全部签名时刻推广，不由实现阶段重选美术方向。
同时记录当前候选实际发布输入的 `sourceFingerprint`（64 位小写 SHA-256 十六进制串）；输入变化即重算，不能用
旧 commit ID 或旧 PASS 证明 dirty / 当前候选。

同时固定首发界面语言和已批准的其他语言。玩家可见文案必须集中、可替换，不把文字
烙进图片；第一版只实现策划明确要求的语言，不擅自扩大本地化范围。

把 `GAME_DESIGN.md` 定的**文案声口与去AI味标准**写进构建说明，要求实现模型照它写所有
玩家可见文本（标题、引导、按钮、提示、事件、对话、结算、结局）。文案是核心体验面，
晦涩、书面、AI 腔的文本第一屏就让玩家出戏——它和玩法、美术一样是完成标准，不是收尾附属。
若 `GAME_DESIGN.md` 未定义声口标准，视为缺产品决策，回设计阶段补齐（最低含各角色声口
一句 + 禁用 AI 腔句式清单）后再开工，不得留白施工。

当前会话能编码时直接实现；需要外部模型服务时发送同一份批准设计。外部模型服务
不可用时只交付完整构建说明，不声称游戏已经生成。不要发送与原型无关的完整受版权
保护原文。

`ART_DIRECTION.md` 的语音策略不是 `none` 时，再读取
[tts-production-contract.md](references/tts-production-contract.md)。TTS 默认在构建期生成、验证后
作为本地资产随包交付；核心合同只锁台词、权利、证据与降级，不锁供应商。运行时远程合成只有在
`PRODUCT_BRIEF.md` 已批准联网与外部文本处理时才可采用，且密钥只能留在受信服务端。

可复用技法见 [production-techniques.md](references/production-techniques.md)：灰盒先行 +
皮肤层（资产可替换）、可复现的种子随机、把实现模型当导演对象驱动、多视角试玩 → 设计期
品类保真门、手感打磨(juice) 清单（按类型取用、动效可关）、批量资产受管子流程（视觉键
清单 + 一致性审查），以及行为保护式文案重构与存档迁移。

批准方向含实时生成式 3D 生物资产时，再读取
[generated-3d-creature-pipeline.md](references/generated-3d-creature-pipeline.md)。它规定先做一个
代表资产的方向停损试验，再处理母版压缩、共享延迟加载、无骨骼动作恢复、空间原点与证据门；
不把某个供应商或一组固定面数写成跨项目默认。焦点资产抬高完成度后，先补环境材质、接地、
光照和重量感，并用局部视觉技术修复签名帧；不能把创意案例使用的框架误当作质感来源而直接迁移。

BUILD_BRIEF 含动态媒体（视频过场 / 环境循环 / 关键帧驱动演出）时，默认生产链为
**Codex `imagegen`（`gpt-image-2`）产角色 / 场景 / 关键帧图 → Seedance 2.0 图生视频 /
多模态参考生视频**，已有可用图片不得退回纯文生视频。完整生产线（最小生产包、参考图
职责、API 提交轮询下载、逐镜证据与连续性门）见
[generative-media-pipeline.md](references/generative-media-pipeline.md)。

## 完成循环

1. 用灰盒实现最小但完整的核心循环，先验证规则和范围；显式写 `grayboxReady`，状态只取
   `NOT_RUN` / `FAIL` / `PASS`；达到 PASS 时记录核心循环、
   输入、结果、重开与真实运行证据，但不得据此给 playable 及以上写 `gate:build pass`。
2. 从实际环境回写目标平台、生产引擎、实际运行器及其版本、包管理器；网页项目再记录浏览器
   版本。记录 install / build / start / export 命令，再从 manifest scripts、CI workflow、测试目录
   与 BUILD_BRIEF runner 声明中发现 suite，给 required suite 稳定 ID。未知值写
   `NOT_AVAILABLE: 原因`，不猜版本。
3. 定义并实际运行一条**权威验证命令**，把完整输出保存到 `qa/evidence/verify.log`。该次 log 必须
   能证明每个 required suite 被调用，并在 `qa/verification.json` 逐项记 `executed: true`；发现
   已存在的 suite 未被命令调用时，先修 verify 再交付，不能用手工补跑冒充一次通过。
4. 用同一 source commit 从 `clean start → 核心动作 → 设计结果 → restart` 跑一条最小完整路径，
   把步骤与 checkpoint 写进 `qa/verification.json`。每个 checkpoint 分别登记 state、runtime、
   visual 相对路径；已有网页项目可用 `browser` 作为 `runtime` 的兼容字段。取不到就写
   `NOT_RUN: 原因`，不让截图证明隐藏状态，也不让状态值证明画面。
   对第一 / 第三人称连续控制，另设不可被完整路线替代的 `controller-contract`：从目标输入设备
   取得视角控制权，产生真实朝向变化，核对相机前向与移动前向，再覆盖失焦、暂停、恢复、输入
   拒绝和释放事件丢失。网页的 pointer lock、手柄锁定或触控捕获失败不得静默继续；自动化运行器
   不支持真实锁定时可用显式标记的确定性 shim 验跨层事件，但目标浏览器 / 设备实测仍写
   `NOT_RUN`，不能据 shim 宣称目标输入已通过。
   对连续 3D 移动再建立独立碰撞合同：可见实体与 collider 共用或可追溯到同一布局真值；记录
   哪些可见物明确为 non-solid；模拟内部使用固定子步或 swept 检测而不是依赖渲染帧率；逐类覆盖
   正向、反向、斜向、角点、最大允许 `delta`、滑动、解穿透和世界边界。浏览器证据至少实际接触
   每类会改变路线的 collider，并保存接触前后位置，不能只用“最终到达结果”替代。
5. 在 `testedRuntime` 启动真实游戏，修复构建失败、运行日志错误、资源失败和崩溃。
   对 `focalReleaseAssets` 中运行期加载的必需资产，加载 / 解码失败必须阻断对应状态或进入明确的
   非发布错误界面；不得静默换成灰盒 / 程序化物件后仍把同一候选记为 PASS。只有 ledger 明确列入
   `degradableReleaseAssets` 且 fallback 五项保持合同成立时，才允许降级继续。
6. **前提与品类自查（排在美术打磨之前）**：灰盒能完整游玩时，先起一个不给任何策划 / 构建
   文档的干净上下文子代理，只喂常速冷启动第一分钟按序截取的画面，让它回答四问：我是什么 /
   我要什么 / 什么会终结这一局 / 这是哪一类游戏（我主要在反复做什么、像我玩过的哪款游戏）。
   前三问任一答不出，或第四问的答案既不与 BUILD_BRIEF「同玩法动词清单」重合、也不出现
   `CONCEPT.md` 选定方向的子类型或同玩法先例作品名（后者是 QA「前提传达门」的判据，成品
   画面上会按它复跑），回设计改，不进美术打磨——打磨只能
   把已经成立的东西变好看，救不了没人看得懂的东西。逐字回答落 `build/evidence/`，交 QA 复跑。
7. 核心规则走通后进入 `visualPromotion`，其状态只取 `NOT_RUN` / `FAIL` / `PASS`：先按 `VISUAL_TARGETS.md` 在代表场景做 spike，用固定种子、
   状态、机位和视口保存同机位 before/after contact sheet；逐项记录问题编号、严重度、处置和复验。
   代表场景无视觉 blocker/major 后，才把获批系统推广到全部签名时刻。
   有连续镜头、实时阴影、LOD 或角色动画时，contact sheet 之外还必须保存常速的静止、直行、扫视
   和最重状态帧序列；检查静止 shimmer、阴影闪烁、LOD pop、足滑 / 漂浮、时序重影与离散
   longtask。只看单帧不得判动态视觉通过。
8. 对照目标包量表逐帧复核全部签名时刻；每个 release-gate 资产键写 `status`、
   `releaseGatePassed`、`evidence`、`remaining`；status 为非空生产状态，passed 为布尔值，evidence
   为非空且按 ledger 目录解析后全部真实存在的相对路径，passed=true 时 remaining 必须明确无剩余。
   同时把所有 `tier: release-gate` 键恰好分入互斥的 `focalReleaseAssets` 或
   `degradableReleaseAssets`；后者逐键写结构化 fallback：behavior、五项 preserved 布尔值
   （coreAction / state / result / readableFeedback / restart）和工作区内真实 evidence，缺一不可。
   停止条件只有：逐帧零 blocker/major、目标等级要求的发布资产通过（playable 为全部 focal
   通过且 degradable fallback 有效；polished/showcase 为全部通过）、目标视口与性能预算通过。
   时间 / 调用上限可以停止执行，但只能留下 `NOT_RUN`/`FAIL`
   或降低经批准的 publication tier，不能判 `PASS`。
9. 操作核心路径、设计要求的结果和重开；根据证据修复并重复权威验证与完整路径。图像生成失败
   可保留 `grayboxReady: PASS`，但最高可声明等级受剩余灰盒资产限制。只有 graybox 可携带视觉 major、
   `NOT_RUN` 或灰盒资产；playable 起必须零 blocker/major、焦点发布资产和必需视觉证据通过。

游戏必须提供一种可重复核心路径和足够的可观察状态，但具体使用命令行参数、启动配置、
测试接口或自动演示由实现模型决定。

## 输出

生成 `build/BUILD_BRIEF.md`、实际游戏和最小 `qa/verification.json`。BUILD_BRIEF 首部显式逐字
继承 `targetFinish`，并记录满足 `publicationTier <= demonstratedTier <= targetFinish` 的两个实际
等级；还记录
`grayboxReady` 与 `visualPromotion` 的 `NOT_RUN` / `FAIL` / `PASS` 状态，并以资产账本和逐帧证据
支持最高可声明等级。构建说明在完成后补充
实际工具链、运行命令、权威验证结果与已知
限制。构建证据（测试输出、证据帧、招牌帧、导出清单）必须落在工作区内 qa/evidence/ 或
build 目录下的持久路径（本阶段默认 `build/evidence/`），BUILD_BRIEF 用相对路径引用，
不得只留在系统临时目录。**这一条要落到生成的测试脚本本身**：脚本里的截图 / 输出目录
默认值必须是工作区内的相对路径（可用环境变量覆盖），不能默认写 `/tmp`——写测试脚本时
默认临时目录太顺手，实测两个示例都在这里犯过同一个错，而 qa 契约把临时目录路径视为
无证据，对应检查项一律不得记通过。截图存 JPEG 而非 PNG：同一批画面 PNG 七十多兆、
JPEG 十兆量级，判读不受影响。成人向内部验收截图放在项目内不进 README / 公开清单的子目录，
并在导出清单标注。实现若降级任何「必须提供」项，必须写进构建完成记录的已知限制并回
设计确认，不得静默省略。只有可运行路径和构建证据存在时才交回总入口进入质量验证，
不自行调用下一阶段。
