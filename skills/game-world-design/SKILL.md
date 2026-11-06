---
name: game-world-design
description: "Design game experience, systems, and levels. Converge the chosen concept into one GAME_DESIGN defining the player promise, core loop, how the world responds, the systems actually needed, level pacing, feedback, failure, and the specification for a complete playable slice. Use for design the game world, deepen the gameplay and levels, write the game design document, design the branching story structure, scenes, dialogue and consequences. 游戏体验、系统与关卡策划。将选定概念收束为一份 GAME_DESIGN，定义核心体验目标、玩法循环、世界反馈、必要系统、关卡节奏、操作反馈、失败重开及可供构建的完整可玩范围。用于设计游戏世界、深化玩法和关卡、设计互动叙事的场景对白与分支因果等需求。"
---
# 游戏体验与世界设计

把选定的概念收束为可落地的玩家体验设计，不写空泛的世界观设定集、代码架构方案或美术设定稿。

输入必须包含 `SOURCE_BIBLE.md`、已选定的 `CONCEPT.md` 和 `PRODUCT_BRIEF.md`。先读 [world-design-method.md](references/world-design-method.md)；涉及资源消耗、数值门槛或难度曲线时，再读 [numeric-design-method.md](references/numeric-design-method.md)。

当剧情分支与人物交锋实际承载核心体验时，读取 [narrative-design-method.md](references/narrative-design-method.md)（非叙事主导项目不必硬写长篇对白）。若玩家做出选择后需要播放一段演绎后果的剧情过场（即文字冒险与短剧结合的互动影游），再读 [interactive-film-method.md](references/interactive-film-method.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 设计原则

- 守住 `CONCEPT.md` 确定的核心体验目标、`experienceProfile` 和不可妥协的体验底线；若发现范围冲突，退回上游修订。
- 试玩时长与系统数量服从 `PRODUCT_BRIEF.md`，以验证核心设计风险为准，不硬套固定时长或系统数量。
- 不写代码文件名、函数名、存储键名、测试脚本、着色器或资产生产管线；具体工程结构留给构建阶段决定。

## 输出结构

生成一份紧凑的 `design/GAME_DESIGN.md`，包含以下八节：

1. **体验与核心循环**：玩家扮演身份、核心体验目标、目标情绪、`experienceProfile`、核心动作与循环、主要玩法对标先例，以及原著设定如何改变动作对象、先后顺序、行动代价和世界反馈；
2. **世界规则与进程**：玩家可见信息与隐藏信息、行动顺序、随机因素、资源或持久状态及其后续读取点；符合本项目特质的局势演进、能力变化或真相认知推进，以及清晰的通关/结局触发标记（不强套千篇一律的养成阶段）；
3. **决策与关卡节拍**：关键局面如何迫使玩家行动或权衡取舍，玩家拥有怎样的因果权与结算权；
4. **反馈、失败与重开**：操作即时反馈、状态变化表现、失败触发原因、重来时的改进空间，以及重开后的初始状态定义；
5. **叙事附件**：仅在叙事实际承载核心体验时编写（含场景主线、人物动机与筹码、知情与证词边界、持久回响、分支汇流条件与结局回收），否则填 `N/A`；
6. **语言、文化与交接边界**：界面语言、专有术语、阅读动线、内容尺度，以及交接给美术和构建阶段需兑现的玩家体验效果；
7. **最小可运行规则与复现路径**：最大设计风险、匹配的白盒原型形态、最小状态集、动作前置条件与效果，以及可复现的初始状态、输入序列、预期终态与反馈（涉及随机性时固定 `seed`；涉及信息差或历史回读时补齐观察者与事件记录；若 `CONCEPT.md` 启用了 `signature_command`，按方法「身份专属命令与延期回响」补齐六组结构）；
8. **验证范围与通关路径**：可玩范围、明确非目标、一条完整通关路径，以及一旦出现就必须回头修改设计的失败现象。

规则优先用紧凑表格表达，不重复抄写成平行的 JSON、准入检查表或第二份验收矩阵。

## 完成检查

对照 [world-design-method.md](references/world-design-method.md) 正向与反向走读可执行闭环、世界回响、推进节奏、重放一致性与范围边界；包含叙事分支或身份专属命令时，再按对应方法核查人物知情范围、分支汇流、角色行动、意图解析候选与实际结算之间有无串线。只交付设计方案，不替构建阶段选技术栈，也不把主观好玩或数值平衡包装成确定性 `PASS`。

完成后将 `design/GAME_DESIGN.md` 交回总入口，不越权自行启动美术、构建或 QA。
