---
name: game-concept
description: "Design game concepts from a novel. From SOURCE_BIBLE and PRODUCT_BRIEF, compare meaningful alternatives on the dimensions still unlocked, then select a playable direction using hard vetoes and explicit trade-offs. Use for what game should this novel become, compare game concepts, choose a game direction for this book, decide whether this novel should become an interactive story. 小说游戏概念设计。根据 SOURCE_BIBLE 与 PRODUCT_BRIEF 对比尚未确定维度上的可行方案，通过硬性淘汰与关键取舍选定可玩方向。用于判断小说适合做成什么游戏、该不该做成互动叙事、比较游戏方案等需求。"
---
# 游戏概念设计

决定把原著做成什么游戏，不写代码、数值表或逐场关卡脚本。

读取 [concept-method.md](references/concept-method.md)。输入必须包含 `SOURCE_BIBLE.md` 与 `PRODUCT_BRIEF.md`；缺任一份即停止并说明缺口，不越权替上游补写。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 决策与比较

直接沿用 `PRODUCT_BRIEF.md` 已锁定的约束（若与原著明显冲突则退回总入口修订，不私自改值）；原著语言、文化背景、目标市场和界面语言分开处理。概念阶段还需敲定白盒验证形态：可复用成熟品类交互时写明「借用哪套成熟交互 + 原著如何改写其规则」，核心体验依赖实时操作手感、空间走位、视线遮挡、物理反馈或独创操作时明确采用定制白盒（`custom`），不把纯文字原型当成所有品类的通用前置步骤。

仅在玩法方向尚未锁定时，围绕仍开放且真正存在取舍差异的方向做对比，不硬凑方案数量；若用户已指定方向或只存在唯一合理方向，写明依据后直接剖析该方向的设计风险与白盒验证形态，不再虚设陪跑方案。对照 [concept-method.md](references/concept-method.md) 的硬否决筛除不合格方案并按五项依据做出取舍：`quick` 模式自动选定证据最扎实的方案；`director` 模式给出推荐意见并停下等待用户拍板。

## 输出

生成一份 `concepts/CONCEPT.md`，包含：

1. `PRODUCT_BRIEF.md` 已锁定值与仍开放的维度；
2. 核心体验承诺，以及兑现成功与失败时的可见表现；
3. 候选概念卡：主品类、`experienceProfile`、对标先例的借用与舍弃、玩家角色身份与核心动作循环、压力来源与执行阻力、失败后果、世界反馈、原著冲突如何通过玩家操作体现、招牌画面、最小验证片段、最大设计风险及推翻该方向的观察判据；
4. 硬否决筛查结果、核心取舍、推荐方案与当前选定状态；
5. 选定方向的玩家能动性保障、不可妥协的体验底线、最小验证问题与待解问题（`narrative-led` 或 `hybrid` 项目的叙事层还需选定一种分支结构并说明内容体量预算）。

交接前确认选定方向可在 `PRODUCT_BRIEF.md` 限定的预算和范围内做完完整可玩版本。
