---
name: novel-to-game
description: "Turn a novel into a fully playable game on the selected target platform. Orchestrates the whole adaptation pipeline — requirements intake, gameable deconstruction, concept selection, world and visual design, target-runtime build, and evidence-based QA — for a novel in any language. Use for novel to game, story to game, book to game, adapt this novel into a game, turn this book into a playable prototype. NovelToGame 总入口。把任意语言的原始小说、拆文库或 oh-story 写作工程转成有原著依据、可在目标平台完整游玩的游戏，编排游戏化拆解、概念选择、游戏与视觉设计、目标运行环境构建和证据化质量验证。用于小说转游戏、把这本书做成游戏等需求。"
---
# NovelToGame 总入口

你是小说游戏化总导演：守住改编判断、阶段边界和完成证据，不教授编码模型已经掌握
的工程知识。

开始前读取 [pipeline-contract.md](references/pipeline-contract.md)。

## 第一步：需求 intake（不可跳过）

用户第一次给出小说时，**先框定产品，再进拆解**。十一个产品维度（唯一权威清单见
[pipeline-contract.md](references/pipeline-contract.md) 交接门表）一旦让下游各阶段各自默认，
做到一半才暴露，返工极贵。按 [intake-method.md](references/intake-method.md) 做这一步：速读原作、替
用户填一份推荐草案、请他确认或改（离散选择用 AskUserQuestion，推荐项在前），锁进
`PRODUCT_BRIEF.md`。仅在 intake-method 列出的全自动条件下才按默认推进，且把每条标为
未确认假设列出。

`PRODUCT_BRIEF.md` 是与 `SOURCE_BIBLE.md` 并列的上游事实，进入"不得下游静默改写"的保护
范围（见 [pipeline-contract.md](references/pipeline-contract.md)）。其中必须锁定**目标运行形态**：
平台、生产引擎、实际交付物和验收设备或运行器。网页、PC 客户端、移动 App、小程序、引擎工程
和设备构建都可以成为交付形态，构建阶段按这里的选择执行。当前环境缺少目标工具链时，只能使用
`PRODUCT_BRIEF.md` 已显式批准的替代验证运行时；替代版本只证明它实际覆盖的玩法，不代表目标
平台已经通过。

第 4 维同时锁定画风与 `targetFinish`（`graybox` / `playable-prototype` /
`polished-vertical-slice` / `showcase`）、带借鉴维度与权利边界的视觉参照、可否决反例、投入边界
和未达目标处置。该值由 art、build、QA 逐字继承；全自动默认也只能列作未确认假设，不能由下游
把灰盒静默升级成 polished 或 showcase。

等级顺序固定为 `graybox < playable-prototype < polished-vertical-slice < showcase`。只有 graybox
可保留视觉 `NOT_RUN`、visual major 或灰盒资产；从 playable 起必须零 blocker/major、焦点发布
资产晋级且必需视觉证据与独立评审通过。最终始终满足
`publicationTier <= demonstratedTier <= targetFinish`。

## 模式

- `quick`：默认。比较三个概念后自动选择并完成整条流程。
- `director`：给出三个概念和推荐后停靠，等待用户选择。
- `resume`：读 `_progress.md`，按交接门表核对实际产物，从最早未过门的阶段继续。

三种模式都必须先完成 intake 确认停靠；`quick` 只免去概念阶段的停靠，不免 intake。

## 输入路由

优先复用信息最完整的来源：已有 NovelToGame 工作区、oh-story 写作工程、拆文库，
最后才是原始小说。结构化资产缺什么补什么，不为统一格式重新拆书。

## 语言与文化

接受任意语言的小说。策划产物使用用户指定语言；未指定时跟随对话语言，不默认生成
中英双份。原文证据保留原语言，跨语言时只补必要译文，并在 `SOURCE_BIBLE.md` 维护统一
术语。分别记录原作文化语境、目标玩家市场和游戏界面语言，不把本地化简化成逐字翻译。

游戏界面语言由目标玩家决定，首版至少锁定一种主语言；需要多语言时把支持范围写进
设计和构建说明，所有玩家可见文案必须可替换。

## 流程

1. 创建工作区并在 `_progress.md` 记录来源、模式和当前阶段。
2. 做需求 intake 这一步，生成 `PRODUCT_BRIEF.md`（见上）；未确认假设记入 `_progress.md`。
3. 调用 `novel-game-analyze` 生成有必要证据的 `SOURCE_BIBLE.md`。
4. 调用 `game-concept`，在 `PRODUCT_BRIEF` 框定的平台/类型/画风/分级内生成并选择
   `CONCEPT.md`；`director` 在这里停靠。
5. 调用 `game-world-design` 生成 `GAME_DESIGN.md`。
6. 调用 `game-art-direction` 生成 `ART_DIRECTION.md`；非 graybox 还须生成可审的视觉目标包。
7. 调用 `game-build` 先使 `grayboxReady: PASS`，再按 `targetFinish` 使 `visualPromotion: PASS`
   状态；用 `game-qa` 独立验证。`blocker`/`major` 按
   `QA_REPORT.md` 发现与回流表的归属阶段回流（build → `game-build` 修复；design →
   `game-world-design` 修订设计后重建回归；product → 回 intake 显式修订
   `PRODUCT_BRIEF.md`），规则见 pipeline-contract 质量回流一节。其中**品类认不出 / 无弧线 /
   前提未上屏**三类不进回环上限，也不得作为未解决问题上报：停下来问用户，附裁决者的逐字
   回答、要改的那一层（概念 / 设计 / 构建）和两个选项（改这一版 / 回 concept 换方向）。

每步产物落盘后，由本 skill（编排器，而非刚产出文档的阶段）按 pipeline-contract 的过门
留痕规则核对并记 `gate:` 行，未过门不进下一阶段。

## 不可删除的判断

- 剧情必须转成玩家动词、选择和世界反馈，而非逐章复演。
- 玩法取自已被大量玩家玩过的成熟打法，小说只做 IP 皮：核心动词与循环结构必须与 ≥2 款
  已发行游戏同玩法，创新落在世界、人物、剧情、题材与美术，发明新机制是非目标。
- 玩家必须在第一分钟内从**屏幕上**知道我是什么、我要什么、什么会终结这一局；核心幻想
  锁在 brief 里而从未上屏，等于没交付。
- 设计收敛到一个能证明核心幻想、并在目标运行形态中可完整游玩的验证切片，时长服从
  `PRODUCT_BRIEF` 锁定的单局时长（默认 10-30 分钟）；brief 时长更长时，切片只做
  全量体验中已声明的一段，不默认做全量。
- 实现模型在 `PRODUCT_BRIEF` 锁定的生产引擎、目标运行时和可选替代运行时内自由选择其余技术，不能静默改变
  批准的体验与视觉风格。
- 完成必须以运行、输入、画面、结果和重开证据为准。
- AI 不能客观证明趣味、长期平衡或商业价值。

只有 `QA_REPORT.md` 无 `blocker`/`major`、`qa/release-gates.json` 对目标等级的必需项全部
`PASS` 且可运行路径明确时，才报告相应等级完成。`NOT_RUN` 可以诚实结束本次执行，但不能满足
声明等级。
