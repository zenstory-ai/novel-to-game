---
name: game-world-design
description: "Design game experience, systems, and levels. Converge the chosen concept into one GAME_DESIGN defining the player promise, core loop, how the world responds, the systems actually needed, level pacing, feedback, failure, and a fully playable prototype. Use for design the game world, deepen the gameplay and levels, write the game design document, design the branching story structure, scenes, dialogue and consequences. 游戏体验、系统与关卡策划。把选定概念收束为一份 GAME_DESIGN，定义玩家承诺、核心循环、世界响应、必要系统、关卡节奏、反馈、失败和可完整游玩的原型。用于设计游戏世界、深化玩法和关卡、设计互动叙事的场景对白与分支因果等需求。"
---
# 游戏体验与世界设计

把选定概念变成可实现的玩家体验，不写世界观百科、工程方案或美术方向。

输入必须包含 `SOURCE_BIBLE.md`、已选择的 `CONCEPT.md` 和 `PRODUCT_BRIEF.md`。读取
[world-design-method.md](references/world-design-method.md)；确有资源、门槛或难度时再读
[numeric-design-method.md](references/numeric-design-method.md)。

`narrative-led` 或 `hybrid` 的叙事层同读
[narrative-design-method.md](references/narrative-design-method.md) 与
[dialogue-design-method.md](references/dialogue-design-method.md)。需要玩家可见文案时按
[game-writing-craft.md](references/game-writing-craft.md) 统一声口，不为所有项目强制写长篇对白。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 设计原则

- 保护 CONCEPT 的玩家承诺、`experienceProfile` 和不可妥协项；发现范围冲突时回上游修订。
- 最小切片默认 10–30 分钟且不超过 brief 时长；系统预算、因果句式与关卡节拍按 world-design-method。
- 不写文件名、函数、存储键、测试脚本、着色器或资产管线；实现结构由构建阶段决定。

## 输出合同

生成一个 `design/GAME_DESIGN.md`，保持紧凑并包含：

1. **体验与循环合同**：玩家身份、承诺、目标感受、`experienceProfile`、首分钟目标、3–5 个核心动词、
   短/长循环和主要玩法先例，以及原作如何改变动作对象、顺序、代价和世界回应；
2. **世界规则与成长**：玩家可见/隐藏信息、行动顺序、随机性、资源或持久状态及其读取点；探索、成长、
   成熟阶段新增的参与手段、可达空间或局面，以及可观察结束标记；
3. **决策与关卡节拍**：用一个场景证明最优选择会随局面翻转并写清因果权与结算权；说明路线、地标、
   压力、教学、组合和检验如何制造选择；
4. **反馈、失败与重开**：输入反馈、状态变化、失败原因、下次可改之处和定义初态；
5. **叙事附件**：仅在叙事实际承载体验时写场景脊柱、人物议程、知识/证词边界、持久回响、
   分支汇流和结局回收；否则写 N/A；
6. **语言、文化与交接边界**：界面语言、术语、阅读顺序、内容尺度，以及交给美术和构建的玩家效果；
7. **可执行切片合同**：最大设计风险、与风险匹配的原型形态、最小状态面、关键动作的前置/效果/观察者、
   会被后续读取的事件，以及固定初态、seed、输入序列、预期状态与反馈；若概念选择了
   `signature_command`，固定 `id / label / intents / slots / validators / commit` 六组最小结构，再追加
   澄清与拒绝条件、委托执行链、实际结果、证物/知情变化和到期回响；
8. **验证切片**：范围、明确非目标、完整路径和会触发设计修改的观察结果。

规则优先用短表表达，不复制成平行 JSON、go/no-go 表或第二份验收矩阵。

## 完成检查

按 world-design-method 反向走读可执行闭环、世界回响、三段弧、重放与范围；存在叙事或专属命令时，
再按对应方法检查知识、分支、人物行动、解析候选与实际执行没有串线。只交付设计合同，不替实现选技术，
也不把趣味或平衡写成确定性 PASS。

输出交回总入口，不自行推进美术、构建或 QA。
