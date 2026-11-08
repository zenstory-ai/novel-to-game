---
name: novel-game-analyze
description: "Deconstruct a novel for game adaptation. Compress a raw novel, deconstruction library, or writing project into a SOURCE_BIBLE with cited textual evidence, extracting world rules, player verbs, spaces, character will, systems, and visual anchors — without inventing a genre yet. Use for gameable book analysis, analyze a novel for game adaptation, extract game systems from a book. 游戏化拆书。把原始小说、拆文库或写作工程压缩成有必要原文证据的 SOURCE_BIBLE，提取世界规则、玩家动词、空间、角色意志、系统和视觉锚点，不提前发明游戏类型。用于游戏化拆书、分析小说的游戏改编基础等需求。"
---
# 小说游戏化拆解

提炼游戏设计所需的原著事实与原文依据，不做文学鉴赏，也不在此阶段敲定游戏类型。

读取 [gameability-protocol.md](references/gameability-protocol.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

支持任意语言的原著。引用保留原文；当文档语言或游戏界面语言与原文不同时，附上必要译文并建立角色名、地名、器物和核心规则的统一术语表；原著中的礼制、宗教与叙事传统保留原有文化内涵，不替换成异域奇幻或现代类型标签。

## 输入

优先复用现有的写作工程或已覆盖**全书**的拆文产物，只针对缺失证据回查原文；只有拿到纯文本原著时才从头运行全书拆解。若已有分析只覆盖开篇几章或局部速览，只能辅助判断开局，不能代表读完了全书；除非用户明确限定只改编某一卷或某几章，否则来源未覆盖全书前不得进入概念设计。若已有 `PRODUCT_BRIEF.md`，按其内容分级、核心代入感与已锁定玩法排定取证优先级；对已锁定玩法需要但原著未成体系描写的机制，在「设计空白」中标明「原著无现成体系，属下游设计发明」。

## 输出

生成 `analysis/SOURCE_BIBLE.md`（只记有原文依据的原著事实，不得反向混入下游玩法、可玩范围、界面或代码结构），优先用紧凑表格包含：

1. **来源范围与全书覆盖**：底本版本、章节范围、缺失部分，并按连续章节区间列出开篇、中段、结局及跨段回收的关键变化、节奏起伏、反例与游戏化意义（表头写明总章节数与成功提取数）；
2. **世界特质、运行模型与原著事实**：世界硬规则、关键角色目标、玩家身份候选依据（已锁定时只验证该身份的可执行动作空间）、可玩动词、空间与角色能动性、重大转折结局及视听锚点（均须注明章节或文件位置，推演内容标为「推断」或「开放设计空间」）；
3. **改编边界与人物名册**：使用 `条目 | 边界类型 | 证据位置` 表格，边界类型只取 `immutable`（不可改）、`adaptable`（可调适）、`open`（原著留白）、`conflicted`（原文矛盾）；涉及名分、座次、品级或固定队伍序列的作品，必须附人物名册表（`姓名 | 身份/次序 | 结局 | 证据位置`）；
4. **文化语境、术语表（跨语言必填）、改编风险与设计空白**。

概念方向选定后，若所依赖的关键因果、人物外貌或时空方位缺少出处或前后冲突，针对性回查原文并更新 `SOURCE_BIBLE.md`（可用 `事实 | 证据位置 | 边界类型` 表格列出补证结果；原著未交代的服饰、兵器、体型或位置统一标为「原文未明确」）。
