---
name: game-concept
description: "Design game concepts from a novel. From SOURCE_BIBLE and PRODUCT_BRIEF, compare meaningful alternatives on the dimensions still unlocked, then select a playable direction using hard vetoes and explicit trade-offs. Use for what game should this novel become, compare game concepts, choose a game direction for this book, decide whether this novel should become an interactive story. 小说游戏概念设计。根据 SOURCE_BIBLE 与 PRODUCT_BRIEF 比较未锁定维度上的有效替代方案，用硬否决和关键取舍选择可玩方向。用于判断小说适合做成什么游戏、该不该做成互动叙事、比较游戏方案等需求。"
---
# 游戏概念设计

决定把原著做成什么游戏，不写代码、数值表或逐场关卡脚本。

读取 [concept-method.md](references/concept-method.md)。输入必须包含 `SOURCE_BIBLE.md` 与 `PRODUCT_BRIEF.md`；缺任一份即停止并说明缺口，不越权替上游补写。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 决策边界

直接沿用 `PRODUCT_BRIEF.md` 已锁定的平台、输入方式、目标受众、分级、时长、目标市场和明确非目标；若发现上述约束与原著明显冲突，退回总入口修订，不在概念阶段私自改值。原著语言、文化背景、目标发行市场和界面语言分开处理，不拿其中一项强推另一项。

互动叙事是成熟的游戏品类，不因以文本阅读和对白抉择为主就降低可玩性标准；玩家的核心动作同样包括审视局势、追问、比对线索、表态、隐瞒、交出证物并承担后续连锁反应。

概念阶段还需敲定白盒验证形态：可复用成熟品类交互时，写明「借用哪套成熟交互 + 原著如何改写其规则」；若核心体验高度依赖实时操作手感、空间走位、视线遮挡、物理反馈或独创操作，则明确采用定制白盒（`custom`）。不要把纯文字原型当成所有品类的通用前置步骤，也不要为了套现成模板而削足适履。

## 比较范围

先列出 `PRODUCT_BRIEF.md` 已锁定的维度和仍开放的维度，只围绕真正存在取舍差异的方向做对比，不硬凑方案数量或对比维度。仅在玩法方向尚未锁定时比较可行方案；若用户已指定方向或只存在唯一合理方向，写明依据后直接转向剖析该方向的设计风险，不再虚设陪跑方案。

## 选择

先对照 [concept-method.md](references/concept-method.md) 的「硬否决」逐一筛除不合格方案（不搞加权打分），再按其中的比较维度做出取舍。`quick` 模式自动选定证据最扎实的方案；`director` 模式针对尚未锁定的方向给出推荐意见并停下等待用户拍板。

## 输出

生成一份 `concepts/CONCEPT.md`，包含：

1. `PRODUCT_BRIEF.md` 已锁定值与仍开放的维度；
2. 核心体验承诺，以及兑现成功与失败时的可见表现；
3. 简明对标先例说明；
4. 候选概念卡：主品类、`experienceProfile`、借用与舍弃的对标设计、核心动作与循环、压力来源、失败后果、世界响应；写明玩家角色身份如何驱动反复行动、面临什么执行阻力并触发哪些可见变化；`signature_command` 按方法「身份专属命令」填写具体定义或 `N/A`；最后写明原著冲突如何通过玩家操作体现、招牌画面、最小验证切片、最大设计风险及推翻该方向的观察判据；
5. 硬否决筛查结果、核心取舍、推荐方案与当前选定状态；
6. 选定方向的玩家能动性合同与不可妥协的体验底线；
7. 最小验证问题与待解开放问题。

`narrative-led` 或 `hybrid` 项目的叙事层还需选定一种分支结构并说明内容体量预算。交接前确认选定方向可在 `PRODUCT_BRIEF.md` 限定的预算和范围内做完完整可玩切片。
