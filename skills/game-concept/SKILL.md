---
name: game-concept
description: "Design game concepts from a novel. From SOURCE_BIBLE and PRODUCT_BRIEF, compare meaningful alternatives on the dimensions still unlocked, then select a playable direction using hard vetoes and explicit trade-offs. Use for what game should this novel become, compare game concepts, choose a game direction for this book, decide whether this novel should become an interactive story. 小说游戏概念设计。根据 SOURCE_BIBLE 与 PRODUCT_BRIEF 比较未锁定维度上的有效替代方案，用硬否决和关键取舍选择可玩方向。用于判断小说适合做成什么游戏、该不该做成互动叙事、比较游戏方案等需求。"
---
# 游戏概念设计

决定做成什么游戏，不写代码、数值表或逐场关卡脚本。

读取 [concept-method.md](references/concept-method.md)。输入必须包含 `SOURCE_BIBLE.md` 与
`PRODUCT_BRIEF.md`；缺任一项就停止并说明缺口，不代替上游补写。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 决策边界

直接继承 brief 已锁的平台、输入、受众、分级、时长、目标市场和非目标；发现它们与原作明显冲突
时回总入口修订，不在概念阶段静默改值。原作语言、文化语境、目标市场和界面语言分别处理，不从
其中一个自动推出另一个。

互动叙事是成熟玩法，不因以阅读和对白承载就降低标准；它的动词可以是读局面、追问、比对信息、
表态、隐瞒、交出与承担回响。先例提供语法，原作规则负责改变动作对象、顺序、代价和世界回应，
不能只做 IP 换皮。

概念还要判断验证形态：可用成熟交互语法表达时说明“已有语法 + 原作如何改变它”；核心依赖实时手感、
空间、视线、物理或独特操作时明确走自定义灰盒。不要把文本原型当所有体验的统一前置层，也不要因有
模板可用就让模板替原作决定玩法。

## 比较范围

先列 brief 的锁定维度和仍开放的维度，只比较能揭示真实取舍的方向，不凑概念数量或差异维度。
仅在方向仍开放时考察可信替代；用户已选定方向或不存在有效替代时说明原因，改为验证该方向的风险，
不重开选择。

## 选择

先按 concept-method 的硬否决逐个淘汰，不计算总分，再按其比较维度选择。`quick` 自动选证据最强的
方向；`director` 只对尚未决定的方向给出推荐并等待用户选择。

## 输出

生成一个 `concepts/CONCEPT.md`，只含：

1. brief 锁定值与开放维度；
2. 体验承诺及其可观察现象和失败现象；
3. 紧凑先例说明；
4. 候选概念卡：主类型、`experienceProfile`、借用/拒绝的玩法先例、核心动作与循环、压力、失败、
   世界响应；说明玩家身份如何形成反复行动、执行阻力与可观察变化，不要求独立的固定键名。
   仅当自然语言能体现玩家身份时写 `signature_command` 的 `id`、`label` 与候选 `intents`，否则写 `N/A`；
   最后说明原作张力如何由玩家亲手 enact、招牌画面、最小验证切片、最大风险
   和否决观察；
5. 硬否决结果、关键取舍、推荐与选择状态；
6. 选定方向的玩家能动性合同、不可妥协体验承诺；
7. 最小验证问题与开放问题。

`narrative-led` 或 `hybrid` 的叙事层还要选择一种分支结构语法并说明内容预算。交接前确认选定方向
可在 brief 范围内做成完整切片。
