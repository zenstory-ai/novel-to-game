---
name: game-build
description: "Build a risk-matched whitebox or the approved production game by adapting to the host environment's available rendering stacks, 3D/2D generators, and modeling tools. Turn GAME_DESIGN and ART_DIRECTION into a concise BUILD_BRIEF and a runnable game candidate with deterministic self-checks. Use for prototype the riskiest design question, implement the approved game design, or turn this design into a running 2D, 2.5D, or 3D game. 游戏构建执行。结合本机与宿主环境实际可用的渲染栈与生成/建模工具（如 Three.js、混元 3D 等 3D 模型、Blender、2D/音视频工具），先针对头号设计风险搭建白盒原型，或将已批准的 GAME_DESIGN 与 ART_DIRECTION 实现为可运行游戏并配齐自检。用于验证核心设计风险、构建游戏原型或实现正式可玩版本。"
---
# 游戏构建执行

承接已批准的体验设计与美术方向，结合当前机器与会话的真实能力实现可玩版本（白盒阶段须有 `GAME_DESIGN.md`，正式生产阶段还须有 `ART_DIRECTION.md`；上游决策缺失时退回 `game-design` 补齐，不在 `BUILD_BRIEF.md` 里暗自重做设计）。先读 [build-brief-contract.md](references/build-brief-contract.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 环境探测、技术选型与发挥空间

动手前先盘点本机与宿主环境实际能调动的运行时、渲染库、命令行、MCP 与生成服务，因地制宜选定最出效果的实现路线，给足技术与表现发挥空间，不生硬套用单一模板：

- **渲染栈与运行环境**：在 `PRODUCT_BRIEF.md` 批准的目标平台内自由选用契合作品气质的技术栈。例如浏览器端做立体箱庭、棋盘沙盘、空间探索或光影演出时，可直接使用 **Three.js** 等主流 3D 渲染库搭建主光、天光、雾效与镜头调度；做俯视彩绘地图、卡牌或横版玩法时可用 2D Canvas / WebGL 渲染；桌面与移动端若本机已备齐 Godot、Unity 等引擎工具链则直接原生构建。目标工具链确实缺失时不得擅自改做网页版顶替，只走 `PRODUCT_BRIEF.md` 已批准的替代环境，并如实分记 `targetRuntime`、`testedRuntime` 与未覆盖特性（当前环境完全无法构建时，如实说明阻塞原因并仅交付 `BUILD_BRIEF.md`）。
- **三维资产与空间表现组合**：做 3D 或 2.5D 项目时，先探测环境内能否调用 **混元 3D（Hunyuan3D）等图生 3D / 文生 3D 模型或接口**、本机是否装有 **Blender**（CLI、Python 脚本或 MCP）及网格转换工具。能调用 3D 生成模型时，适合以批准的角色或关键器物设定图生成带贴图网格（如 `.glb`），再按需配合 Blender 校准比例、脚底轴心、减面或动作绑定后接入 Three.js / 目标引擎；本机仅有 Blender 时可用脚本生成风格化低多边形或建筑模型；若外部建模与生成服务皆不可用，也可直接用 Three.js 程序化几何体、受光材质或分层景深立绘（2.5D 立体剧场）做出空间层次，不必退回单调的平面表单。
- **图像、音视频与程序化混搭**：结合宿主可用的生图、视频生成与语音合成工具，把生成预算优先投向主角、核心地标、高潮 CG 与关键剧情过场；成套图标、UI 装饰、粒子动效与环境音效可灵活搭配矢量绘制、着色器及 Web Audio / 引擎合成器共同完成。所有成品资产落盘到项目工作区并接入真实画面（白盒临时占位须标明阶段属性，正式版不留未执行的提示词或坏链充数；调用外部工具只传当前资产所需描述与参考图，不外传原著全文，也不将密钥写入仓库）。

构建前声明 `buildStage: whitebox|production` 与 `buildPath: template|custom`：成熟模板能完整保留原著独有的动作、代价和世界反馈时可走 `template`；核心乐趣仰仗实时手感、空间走位、立体视角、物理碰撞或独创动词时走 `custom`，白盒阶段用最轻的几何体或占位素材把真实交互跑通，不把空间与动作玩法一律压成纯文字选项。

按项目实际用到的能力读取可选参考：
- 3D 生成模型、Blender 与 Three.js 等空间资产联调：[blender-asset-workflow.md](references/blender-asset-workflow.md)；
- 2.5D 多朝向/多动作序列帧烘焙：[baked-sprite-workflow.md](references/baked-sprite-workflow.md)；
- 生成式自由输入、知情权限、事件回放或存档迁移：[playable-model-contract.md](references/playable-model-contract.md)；
- 角色配音：[tts-production-contract.md](references/tts-production-contract.md)；
- 动态视频、生成式音乐或音效：[generative-media-pipeline.md](references/generative-media-pipeline.md)；选择后播放剧情过场（互动影游）再读 [cutscene-production.md](references/cutscene-production.md)。

## 构建循环

1. **实现状态与交互**：`whitebox` 只实现验证头号设计风险所需的真实输入、状态流转与核心反馈；`production` 完整实现 `GAME_DESIGN.md` 的状态、动作、分支与结局闭环。
2. **固定复现与排障**：保留能稳定复现问题的初态与输入序列（涉及随机时固定 `seed`），修改后重跑原失败路径及相邻分支反例；同一手感或表现问题连续两次修改未果时，先检索成熟开源做法理清机制再改。
3. **回写工具链与对齐设计**：在 `BUILD_BRIEF.md` 如实回写实际选用的渲染栈、工具链、版本号与运行命令（无法获取的版本填 `NOT_AVAILABLE: 原因`）；实现与设计/美术文档存在偏差时，退回 `game-design` 修订或在 `BUILD_BRIEF.md` 记明冲突。

`whitebox` 执行完第 3 步后运行最窄风险检查并交回总入口组织试玩校准；`production` 继续执行：

4. **配齐规则自测与权威 `verify` 入口**：针对核心规则、数值门槛与分支汇流编写正反向自测断言并接入权威 `verify` 命令，运行冒烟自检清零启动报错、控制台阻断异常、资源加载失败与崩溃。
5. **实机视口校准后移交盲玩**：对配有批准目标图的界面与核心资产，在目标视口下截实机图与目标图并排比对布局、比例、色光与层级并修正（连续两轮无改善则停手记入 `limitations`，不篡改目标图迁就缺陷），最后移交 `game-qa` 做独立新玩家盲玩验收。
