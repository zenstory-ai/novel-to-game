---
name: game-design
description: "Select a playable game concept, design world rules, systems, levels, and branching narrative, and define visual and audio art direction. Turns SOURCE_BIBLE and PRODUCT_BRIEF into CONCEPT, GAME_DESIGN, and ART_DIRECTION as distinct stage-owned specifications without writing implementation code. Use for what game should this novel become, compare game concepts, choose a game direction, design the game world and levels, write the game design document, design branching story or interactive film scenes, set the art direction, or define the visual style. 游戏策划与美术方向。基于 SOURCE_BIBLE 与 PRODUCT_BRIEF 分阶段完成概念选型（CONCEPT）、体验与世界设计（GAME_DESIGN）及美术与视听方向（ART_DIRECTION），用于判断小说适合做成什么游戏、比较改编方案、设计玩法关卡与互动叙事分支、制定视觉风格与关键游戏画面等需求。"
---
# 游戏策划与美术方向

统一掌管从原著事实到可构建方案的三份策划文档：`concepts/CONCEPT.md`（概念选型，不写数值表或逐场脚本）、`design/GAME_DESIGN.md`（体验、系统与叙事设计）与 `design/ART_DIRECTION.md`（美术与视听方向），全程不写业务代码、代码文件名、存储键名、着色器、模型拓扑或供应商接口配置。三份文档按阶段分步产出、职责边界独立；下游阶段直接沿用上游已锁定的约束，遇到范围或原著事实冲突时退回上游修订，不私自改值。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。原著语言、文化背景、目标发行市场和界面语言分开处理，不用泛化的流行刻板符号替代原著自身的时代气质。

可按总入口编排或用户指令单独执行任一阶段，也可在纯策划模式下依序走完三份文档；缺少对应阶段必需的上游文件时立即停止并说明缺口，不越权替上游补写。

## 阶段一：概念选型（`concepts/CONCEPT.md`）

输入必须包含 `SOURCE_BIBLE.md` 与 `PRODUCT_BRIEF.md`；读取 [concept-method.md](references/concept-method.md)。

仅在玩法方向尚未锁定时，围绕仍开放且真正存在取舍差异的方向横向对比；若用户已指定方向或仅存唯一合理方向，写明依据后直接剖析其核心风险与白盒验证形态，不凑陪跑方案。同步敲定白盒形态：可复用成熟品类交互时写明借用机制与原著改写规则；核心乐趣仰仗实时手感、空间走位、立体视角、物理反馈或独创动词时采用定制白盒（`custom`），不把纯文字原型当成所有品类的通用前置步骤。对照硬否决筛除不合格方案后，`quick` 模式自动选定证据最扎实的方案，`director` 模式给出推荐意见并停下等待用户拍板。

产出 `concepts/CONCEPT.md`（确认可在预算与范围内做完完整可玩版本）：
1. `PRODUCT_BRIEF.md` 已锁定值与仍开放的维度；
2. 核心体验承诺，以及兑现成功与失败时的可见表现；
3. 候选概念卡：主品类、`experienceProfile`、对标先例的借用与舍弃、玩家角色身份与核心循环、压力来源与执行阻力、失败后果、世界反馈、原著冲突的操作化体现、招牌画面、最小验证片段、头号设计风险及推翻判据；
4. 硬否决筛查结果、核心取舍、推荐方案与当前选定状态；
5. 选定方向的玩家因果权与结算权保障、不可妥协底线、最小验证问题与待解问题（`narrative-led` 或 `hybrid` 叙事层另需选定分支结构并说明内容体量预算）。

## 阶段二：体验、系统与叙事设计（`design/GAME_DESIGN.md`）

输入必须包含 `SOURCE_BIBLE.md`、已选定的 `CONCEPT.md` 与 `PRODUCT_BRIEF.md`。先读 [world-design-method.md](references/world-design-method.md)；涉及资源消耗、属性门槛或难度曲线时读 [numeric-design-method.md](references/numeric-design-method.md)；对白交锋与分支因果承载核心体验时读 [narrative-design-method.md](references/narrative-design-method.md)；选择后播放剧情过场（互动影游）时再读 [interactive-film-method.md](references/interactive-film-method.md)。

生成紧凑的 `design/GAME_DESIGN.md`（规则优先用表格表达，不重复抄写平行 JSON 或检查表），包含八节：
1. **体验与核心循环**：玩家身份、体验目标、目标情绪、`experienceProfile`、核心动作与循环、对标先例，以及原著设定如何改变动作对象、先后顺序、代价和世界反馈；
2. **世界规则与进程**：可见与隐藏信息、行动顺序、随机因素、持久状态及后续读取点、局势演进与通关/结局触发标记；
3. **决策与关卡节拍**：关键局面如何迫使玩家权衡取舍，玩家拥有怎样的因果权与结算权；
4. **反馈、失败与重开**：即时反馈、状态变化表现、失败原因、重来改进空间及重开初态定义；
5. **叙事附件**：仅在叙事实际承载核心体验时编写（场景主线、人物动机与筹码、知情与证词边界、持久回响、分支汇流与结局回收），否则填 `N/A`；
6. **语言、文化与交接边界**：界面语言、专有术语、阅读动线、内容尺度及交接给美术与构建需兑现的体验效果；
7. **最小可运行规则与复现路径**：头号设计风险、匹配的白盒形态、最小状态集、动作前置与效果，以及固定 `seed` 下的初态、输入序列与预期终态（涉信息差时补齐观察者与事件记录）；
8. **验证范围与通关路径**：可玩范围、明确非目标、一条完整通关路径，以及一旦出现就须回头改设计的失败现象。

对照所读方法正向与反向走读可执行闭环、世界回响与重放一致性；白盒试测或实机盲玩退回设计偏差时，亦在本阶段做局部校准修订。

## 阶段三：美术与视听方向（`design/ART_DIRECTION.md`）

输入必须包含 `GAME_DESIGN.md` 与 `PRODUCT_BRIEF.md`（全流程中通常在白盒校准玩法后执行；仅索要策划案时可直接衔接阶段二）；读取 [art-direction-method.md](references/art-direction-method.md)。视觉与声音表现服务于已定玩法规则，不拿参考图反过来改写机制；视觉参考只借鉴已声明的构图、色光、材质或信息层级，不得照搬他作的角色、地图、界面与美术资产。

生成 `design/ART_DIRECTION.md`（交付前在目标视口下核查关键时刻在带真实 UI 的游戏画面中成立，且完整覆盖核心循环、失败与结局）：
1. **`targetFinish` 与核心视觉原则**：确立区分“符合本作”与“偏离本作”的审美准绳；
2. **镜头构图与视觉语言**：为主角、目标点、威胁、奖励和地标建立机位、透视比例、剪影轮廓、疏密规则与标志性识别特征；
3. **服务玩法的色光、材质与动效**：准确传达规则已裁决的状态，提供不依赖颜色的图形提示、低动效替代方案与充足对比度；
4. **HUD 布局与操作反馈**：明确首屏重心、信息层级、阅读动线、单屏字数上限、即时与结算反馈（叙事及混合项目写明人物站位如何外化关系，以及对话框如何兼顾阅读、回看、跳过与快进）；
5. **关键游戏时刻**：围绕核心循环或视觉风险最高的场次写清操作、压力、焦点与前后画面变化（按参考文档条件决定是否产出 `design/VISUAL_TARGETS.md` 及目标样张，`director` 模式请用户挑定）；
6. **声音方向**：设定声音风格、功能音效层级和配乐边界；仅在确有独特体验价值时启用角色配音，全程保证纯字幕与静音可玩；
7. **资产清单与视觉风险**：区分必需资产与可降级资产、原创与授权边界，以及待验证的视觉风险。
