---
name: game-design
description: "Select a playable game concept, design world rules, systems, levels, and branching narrative, and define visual and audio art direction. Turns SOURCE_BIBLE and PRODUCT_BRIEF into CONCEPT, GAME_DESIGN, and ART_DIRECTION as separate stage-by-stage design documents without writing implementation code. Use for what game should this novel become, compare game concepts, choose a game direction, design the game world and levels, write the game design document, design branching story or interactive film scenes, set the art direction, or define the visual style. 游戏策划与美术方向。基于 SOURCE_BIBLE 与 PRODUCT_BRIEF 分阶段完成概念选型（CONCEPT）、体验与世界设计（GAME_DESIGN）及美术与视听方向（ART_DIRECTION），用于判断小说适合做成什么游戏、比较改编方案、设计玩法关卡与互动叙事分支、制定视觉风格与关键游戏画面等需求。"
---
# 游戏策划与美术方向

掌管从原著事实到可构建方案的三份文档：`concepts/CONCEPT.md`（概念选型，不写数值表或逐场脚本）、`design/GAME_DESIGN.md`（体验、系统与叙事）、`design/ART_DIRECTION.md`（美术与视听）。三份分阶段产出，各管各的决定：下游沿用上游已锁定的约束，遇到范围或原著事实冲突时退回上游修订；缺少该阶段必需的上游文件时停下说明缺口，不替上游补写。全程只写设计，不写代码、文件名、存储键名或供应商配置。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。原著语言、文化背景、发行市场和界面语言分开处理，不用泛化的流行符号替代原著自身的时代气质。

## 阶段一：概念选型（`concepts/CONCEPT.md`）

输入 `SOURCE_BIBLE.md` 与 `PRODUCT_BRIEF.md`；读 [concept-method.md](references/concept-method.md)。

玩法方向或改编段落尚未锁定时，只比较真正存在取舍差异的方向与可玩切片；用户已指定方向或只剩一个合理方向时，写明依据后直接剖析它的核心风险，不凑陪跑方案。通过一票否决筛查后，`quick` 自动选定证据最扎实的方案，`director` 给出推荐并等用户拍板。

`CONCEPT.md` 写清：

1. `PRODUCT_BRIEF.md` 已锁定的值与仍开放的维度；
2. 核心体验目标，以及兑现与落空时各自看得见的表现；
3. 候选概念：品类、`experienceProfile`、对标先例的借用与舍弃、玩家身份与核心循环、压力与失败后果、原著冲突如何变成玩家亲手做的操作与抉择、招牌画面、头号风险及推翻判据；
4. 淘汰项核查结果、核心取舍与选定状态；
5. 选定方向里玩家的选择如何改写走向、世界如何兑现后果、不可妥协的底线（`narrative-led` 或 `hybrid` 另写分支结构与内容体量预算）。

## 阶段二：体验、系统与叙事（`design/GAME_DESIGN.md`）

输入 `SOURCE_BIBLE.md`、已选定的 `CONCEPT.md` 与 `PRODUCT_BRIEF.md`；读 [world-design-method.md](references/world-design-method.md)。以对白交锋与分支走向为主时读 [narrative-design-method.md](references/narrative-design-method.md)；做「选择后播放剧情过场」的互动影游时再读 [interactive-film-method.md](references/interactive-film-method.md)。

`GAME_DESIGN.md` 规则优先用表格，同一件事只写一处，覆盖：

1. **体验与核心循环**：玩家身份、目标情绪、`experienceProfile`、核心动作与循环、对标先例，以及原著设定如何改变动作的对象、顺序、代价与世界反馈；
2. **世界规则与进程**：可见与隐藏信息、行动顺序、随机因素、跨场保留的状态及后文呼应处、局势演进与结局触发；
3. **决策与关卡节拍**：关键局面逼玩家权衡什么，选择如何改写走向，世界如何兑现后果；
4. **反馈、失败与重开**；
5. **叙事**（仅在以叙事为主时）：场景主线、人物动机与筹码、知情边界、后续回响、分支汇流与结局回收；
6. **语言、文化与内容尺度**；
7. **第一分钟与通关路径**：开局玩家看到什么、凭什么知道自己是谁和要做什么；一条从初态到结局的完整路径（涉及随机时固定 `seed`）；
8. **范围**：可玩范围、明确不做的事项，以及一旦出现就须回头改设计的失败现象。

试玩或盲玩退回设计偏差时，在本阶段做局部修订：改出错的规则，重走原失败路径与相邻分支，不推翻重写整份设计。

## 阶段三：美术与视听（`design/ART_DIRECTION.md`）

输入 `GAME_DESIGN.md` 与 `PRODUCT_BRIEF.md`；全流程里在灰盒试玩校准玩法之后执行，只要策划案时可直接接在阶段二后面。读 [art-direction-method.md](references/art-direction-method.md)。视听表现服务于已定规则，不拿参考图反过来改机制；参考只借构图、色光、材质与信息层级，不照搬他作的角色、地图、界面与资产。

`ART_DIRECTION.md` 写清：

1. `targetFinish` 与区分「像本作」和「不像本作」的视觉原则；
2. 镜头、透视与比例，以及主角、目标、威胁、奖励与地标各自的识别特征；
3. 传达规则状态的色光、材质与动效，含不依赖颜色的提示与低动效替代；
4. HUD 布局、信息层级与操作反馈（叙事项目写人物站位如何体现亲疏与高低，对话框如何兼顾阅读、回看、跳过与快进）；
5. 覆盖核心循环、失败与结局的关键游戏画面；
6. 声音方向：风格、功能音效与配乐边界；角色配音仅在确有体验价值时启用，纯字幕与静音必须可玩；
7. 资产清单（必需与可降级、原创与授权边界）与待验证的视觉风险。
