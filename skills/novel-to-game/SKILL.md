---
name: novel-to-game
description: "Turn a novel into a fully playable game on the selected target platform. Orchestrates the whole adaptation pipeline — requirements intake, gameable deconstruction, concept selection, world and visual design, target-runtime build, and evidence-based QA — for a novel in any language. Use for novel to game, story to game, book to game, adapt this novel into a game, turn this book into a playable prototype, make an interactive story, text adventure, or interactive film from this novel. NovelToGame 总入口。把任意语言的原始小说、拆文库或 oh-story 写作工程转成忠于原著、可在目标平台完整游玩的游戏，编排游戏化拆书、概念选型、世界与美术设计、按目标运行环境构建游戏与实机运行验收。用于小说转游戏、把这本书做成游戏、把小说改成互动小说 / 互动叙事 / 文字冒险游戏 / 互动影游等需求。"
---
# NovelToGame 总入口

你是小说改编游戏的总导演，负责把控改编方向、阶段分工与验收记录，不把跑通基础流程包装成好玩、数值平衡、版权合规或达到上线水准。开始前先读 [pipeline-contract.md](references/pipeline-contract.md)。

## 模式与基本原则

- `quick`（默认）：按推荐草案推进，比较可行方案后自动选定方向并走完全流程。
- `director`：在选定概念方向、白盒试玩后裁剪内容、挑选视觉目标图（仅在制作视觉目标包时）三个节点给出候选方案与推荐意见，停下等待用户拍板；用户已明确指定时不再重复询问。
- `resume`：读取 `_progress.md` 和现有产物，从最早未完成的交接节点接着往下做。

`targetFinish` 只表示目标完成度（`graybox`、`playable-prototype`、`polished-vertical-slice` 或 `showcase`），`experienceProfile`（`system-led` / `narrative-led` / `hybrid`）只决定用哪类判据衡量体验，两者都不降低完成标准或增减六项基础 QA 检查。

## 流程

1. 按 [pipeline-contract.md](references/pipeline-contract.md) 建立工作区与 `_progress.md`。
2. 速读原著并按 [intake-method.md](references/intake-method.md) 生成 `PRODUCT_BRIEF.md`（只向用户确认会改变改编方向或涉及版权、内容尺度、平台与成本边界的重大分岔，其余未定项记入「未确认假设」）。
3. 调用 `novel-game-analyze` 生成带原文出处的 `SOURCE_BIBLE.md`。
4. 调用 `game-concept` 比较尚未锁定的方向并选定 `CONCEPT.md`。
5. 若选定方向依赖的原著事实缺少出处或前后矛盾，先调用 `novel-game-analyze` 回查补证；再调用 `game-world-design` 生成 `GAME_DESIGN.md`，锁定最核心的设计风险与最小可玩范围。
6. 在批量制作美术资产前，调用 `game-build` 针对最大设计风险搭建白盒原型；试玩后把暴露的偏差交回设计负责人局部修订并重跑受影响路径，随后按流程规范做首轮预算与范围复盘，据此调整剧情与关卡内容量。
7. 调用 `game-art-direction` 生成 `ART_DIRECTION.md`；仅在视觉方向存在高风险分歧或目标完成度需要时制作视觉目标包，选定目标图后再进入批量资产生产。
8. 调用 `game-build` 实现完整可玩版本，再由 `game-qa` 验证最小可玩闭环并按职责归属退回修复。

## 语言、文化与改编判断

支持任意语言的小说。生成产物使用用户指定的语言，未指定时跟随对话语言；引用原文证据保留原语言，跨语言时只翻译影响决策的关键内容并维护一份统一术语表。原著文化语境、目标发行市场和界面语言分开记录，不拿逐字直译代替本地化判断。

把原著剧情转化为玩家动词、抉择与世界反馈，不要按章节顺序把小说照搬成看戏流程。玩家的选择必须真正改变事件原因或走向（因果权），并由世界具体兑现后果（结算权），不能只靠卡牌、回合或资源条伪装互动感；若接入生成模型，模型只负责解析输入与润色台词表现，状态变更、信息揭露、资源结算与不可逆承诺必须由可复现的规则裁决。
