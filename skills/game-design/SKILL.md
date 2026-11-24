---
name: game-design
description: "Choose a playable gameplay concept, design world rules, systems, levels, and branching narrative, and set visual and audio direction. Turns SOURCE_BIBLE and PRODUCT_BRIEF into separate CONCEPT, GAME_DESIGN, and ART_DIRECTION specs stage by stage without writing code. Use when deciding what game a novel should become, comparing gameplay directions, writing a game design spec, designing branching story or interactive film scenes, or setting art direction. 游戏策划与美术方向：基于 SOURCE_BIBLE 与 PRODUCT_BRIEF 分阶段产出玩法选型（CONCEPT）、世界与叙事设计（GAME_DESIGN）及美术视听方案（ART_DIRECTION），覆盖改编方向比选、系统与关卡设计、互动叙事与影游分镜、视觉与音效定调。"
---
# 游戏策划与美术方向

负责把原著拆书转化为可施工方案的三份设计文档：`concepts/CONCEPT.md`（概念选型，不写数值表或逐场台词）、`design/GAME_DESIGN.md`（玩法、系统与叙事）、`design/ART_DIRECTION.md`（美术与视听）。三份文档分阶段产出、各管各的决定：下游沿用上游已锁定的边界，遇到范围或原著事实冲突时退回上游修订；缺少本阶段必需的上游文件时直接停下说明缺口，不替上游补写。全程只写设计，不写代码、源码文件名、存储键名或供应商配置。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。原著语言、文化背景、目标市场与界面语言分开考虑，不用千篇一律的流行元素冲淡原著自身的时代气息。

## 阶段一：概念选型（`concepts/CONCEPT.md`）

输入 `SOURCE_BIBLE.md` 与 `PRODUCT_BRIEF.md`；先读 [concept-method.md](references/concept-method.md)。

玩法方向或改编段落尚未锁定时，只对比真正存在取舍差异的方向与可玩切片；用户已指定方向或只剩唯一合理方向时，写明依据后直接剖析它的头号风险，不硬凑陪跑方案。经过一票否决筛查后，`quick` 自动选定证据最扎实的方案，`director` 给出推荐并等用户拍板。

`CONCEPT.md` 写清：

1. `PRODUCT_BRIEF.md` 已锁定的条目与仍待定的部分；
2. 核心体验目标，以及做成与做砸时在画面和操作上分别是什么样；
3. 候选概念：品类、`experienceProfile`、参考先例的借用与舍弃、玩家身份与核心循环、压力与失败后果、原著冲突如何变成玩家亲手做的操作与抉择、招牌画面、头号风险及推翻判据；
4. 一票否决筛查结果、核心取舍与选定状态；
5. 选定方向里玩家的选择如何改写走向、世界如何把后果落到实处、不可妥协的底线（`narrative-led` 或 `hybrid` 另写分支结构与内容体量预算）。

## 阶段二：玩法、系统与叙事（`design/GAME_DESIGN.md`）

输入 `SOURCE_BIBLE.md`、已选定的 `CONCEPT.md` 与 `PRODUCT_BRIEF.md`；先读 [world-design-method.md](references/world-design-method.md)。以人物交锋与分支走向为主时读 [narrative-design-method.md](references/narrative-design-method.md)；做「选择后播放剧情短片」的互动影游时再读 [interactive-film-method.md](references/interactive-film-method.md)。

`GAME_DESIGN.md` 规则优先用表格，同一件事只写一处，覆盖：

1. **体验与核心循环**：玩家身份、目标情绪、`experienceProfile`、核心动作与循环、参考先例，以及原著设定如何改变操作对象、出手顺序、代价与世界反馈；
2. **世界规则与进程**：可见与隐藏信息、行动顺序、随机因素、跨场保留的状态及后文呼应点、局势演进与结局触发条件；
3. **决策与关卡节拍**：关键局面逼玩家权衡什么，选择如何改写走向，世界如何兑现后果；
4. **反馈、失败与重开**（启用激励广告或抖音侧边栏复访时，写明触发位置、奖励上限及无广告时的替代路径）；
5. **叙事**（仅在以叙事为主时）：场景主线、人物动机与筹码、知情边界、后文回响、分支汇流与结局回收；
6. **语言、文化与内容尺度**；
7. **第一分钟与通关路径**：开局玩家看到什么，首 30 秒凭什么场景视觉焦点与首次操作的即时反馈明白自己是谁、下一步做什么（小游戏须在前 30 秒进入首个冲突或抉择；不靠大段开场人物名册旁白或纯文字帮助弹窗开局）；给出一条从初态到结局的完整路径（涉及随机时固定 `seed`）；
8. **范围**：可玩范围、明确不做的事项，以及一旦出现就必须回头改设计的失败迹象。

灰盒试玩或盲玩退回设计偏差时，只做局部修订：改出错的规则，重走原失败路径与相邻分支，不推翻重写整份文档。

## 阶段三：美术与视听（`design/ART_DIRECTION.md`）

输入 `GAME_DESIGN.md` 与 `PRODUCT_BRIEF.md`；跑完整流程时排在灰盒试玩校准玩法之后，只出策划案时直接接在阶段二后面。先读 [art-direction-method.md](references/art-direction-method.md)。视听表现服务于已定规则，不拿参考图反过来改机制；参考只借构图、色光、材质与信息层级，不照搬他作的角色、地图、界面与资产。

`ART_DIRECTION.md` 写清：

1. `targetFinish` 与界定本作画风「对味」与「出戏」的视觉准则；
2. 镜头、透视与比例，以及主角、目标、威胁、奖励与地标各自的识别特征；
3. 传达规则状态的色光、材质与动效，含不依赖颜色的提示与低动效替代方案；
4. HUD 布局、主视野保护区、常驻信息清单与移出常驻（改用视觉信号或按需检视）的裁减项、明确禁画的冗余面板与说明墙、异形屏与小游戏右上角胶囊避让区、信息层级与操作反馈（叙事项目写人物站位如何体现亲疏尊卑，对话框如何兼顾阅读、回看、跳过与快进）；
5. 覆盖核心循环、失败与结局的关键游戏画面；
6. 声音方向：曲风、功能音效与配乐边界；角色配音仅在确有体验价值时启用，纯字幕与静音状态必须能完整通关；
7. 资产清单（区分必需与可降级、首包与分包或远程加载、原创与外部授权）及待验证的视觉风险。
