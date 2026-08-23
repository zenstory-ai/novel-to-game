---
name: game-concept
description: "Design game concepts from a novel. From SOURCE_BIBLE and PRODUCT_BRIEF, generate three genuinely different directions on the dimensions still unlocked, then pick the most worthwhile playable prototype using hard vetoes and explicit trade-offs. Use for what game should this novel become, compare game concepts, choose a game direction for this book, decide whether this novel should become an interactive story. 小说游戏概念设计。根据 SOURCE_BIBLE 与 PRODUCT_BRIEF 在未锁定维度上生成三个真正不同的方案，用硬否决和关键取舍选择最值得做的可玩原型。用于判断小说适合做成什么游戏、该不该做成互动叙事、比较游戏方案等需求。"
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

先例只用于解释玩法为什么可识别：选一个最接近核心动词与循环的主要玩法先例，必要时再补一个解决
独立问题的辅助先例。写清借用的动词/循环/结构与明确不借的内容，不要求销量数字、固定名单或为每个
方向重复市场研究。外部事实只有在会改变选择且可能变化时才核实。

互动叙事是成熟玩法，不因以阅读和对白承载就降低标准；它的动词可以是读局面、追问、比对信息、
表态、隐瞒、交出与承担回响。先例提供语法，原作规则负责改变动作对象、顺序、代价和世界回应，
不能只做 IP 换皮。

概念还要判断验证形态：可用成熟交互语法表达时说明“已有语法 + 原作如何改变它”；核心依赖实时手感、
空间、视线、物理或独特操作时明确走自定义灰盒。不要把文本原型当所有体验的统一前置层，也不要因有
模板可用就让模板替原作决定玩法。

## 三个方向

先列 brief 的锁定维度和仍开放的维度。三个方向必须在至少三项开放维度上真正不同，例如玩家身份、
子类型、核心循环、压力来源、原作选段、空间/镜头、成长关系或美术方向；已锁的主玩法不可偷换，
未锁的核心循环可以正面比较。

每个概念卡只回答：

- `player_job`：玩家以什么身份长期做哪份工作，想获得什么独特幻想；
- `recurring_job_loop`：这份工作每个周期反复做什么；
- 主类型、`experienceProfile`、主要玩法先例，以及本作借什么/不借什么；
- 3–5 个核心动词、循环、压力、失败和世界响应；
- `signature_command`：只有当自然语言表达本身能体现该身份时，写 `id`、`label` 与候选 `intents`；
  不合适时明确 `N/A`，不得给所有游戏统一添加聊天框；
- `resistance_chain`：谁或什么会阻止、拒绝、扭曲或泄露玩家的安排；
- `advancement_ladder`：玩家在探索、成长、成熟阶段分别新学会什么、新能组合什么；
- 原作独有的规则或情感/伦理张力怎样被玩家亲手 enact，而不是留在过场；
- 一张能同时看出身份、动作与世界特征的招牌画面；
- 最小验证切片、最大风险，以及什么观察结果会否决该方向。

## 选择

先按 concept-method 的硬否决逐个淘汰，不计算总分。再比较原作适配、玩家能动性、可读性、文化
准确性、传播画面和完成风险。`quick` 自动选证据最强的方向；`director` 给出推荐后等待用户决定。

## 输出

生成一个 `concepts/CONCEPT.md`，只含：

1. brief 锁定值与开放维度；
2. 三条体验支柱，各配可观察现象和失败现象；
3. 紧凑先例说明；
4. 三个概念卡；
5. 硬否决结果、关键取舍、推荐与选择状态；
6. 选定方向的 `experienceProfile`、玩家能动性合同、不可妥协体验承诺，以及五项独立交接字段：
   `player_job`、`recurring_job_loop`、`signature_command`（或 `N/A`）、`resistance_chain`、
   `advancement_ladder`；
7. 最小验证问题与开放问题。

`narrative-led` 或 `hybrid` 的叙事层还要选择一种分支结构语法并说明内容预算。概念不得写伤害公式、
具体百分比、敌人血量、代码结构或逐场脚本；交接前确认选定方向可在 brief 范围内做成完整切片。
