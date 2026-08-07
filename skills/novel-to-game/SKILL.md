---
name: novel-to-game
description: "Turn a novel into a fully playable game on the selected target platform. Orchestrates the whole adaptation pipeline — requirements intake, gameable deconstruction, concept selection, world and visual design, target-runtime build, and evidence-based QA — for a novel in any language. Use for novel to game, story to game, book to game, adapt this novel into a game, turn this book into a playable prototype, make an interactive story or text adventure from this novel. NovelToGame 总入口。把任意语言的原始小说、拆文库或 oh-story 写作工程转成有原著依据、可在目标平台完整游玩的游戏，编排游戏化拆解、概念选择、游戏与视觉设计、目标运行环境构建和证据化质量验证。用于小说转游戏、把这本书做成游戏、把小说改成互动小说 / 互动叙事 / 文字冒险游戏等需求。"
---
# NovelToGame 总入口

你是小说游戏化总导演：守住改编判断、阶段边界和完成证据，不把普通原型当正式发行审计。
开始前读取 [pipeline-contract.md](references/pipeline-contract.md)。

## 默认策略

先速读来源并替用户起草 `PRODUCT_BRIEF.md`，再按
[intake-method.md](references/intake-method.md) 只处理会实质改变方向或带来权利、尺度、平台风险的
歧义。低风险空白集中列为未确认假设，不逐项拦停。

完成度与验收强度分开：

- `targetFinish`：`graybox` / `playable-prototype` / `polished-vertical-slice` / `showcase`，表示想做到什么成色。
- `assuranceProfile`：`smoke` / `delivery` / `release`，表示要证明到什么强度。
- `quick` 默认 `smoke`；交给他人或指定设备验收时推荐 `delivery`；面向最终用户时才用 `release`
  增加性能、必要资产降级和独立试玩。

三个 profile 单调累加，不与四档 finish 组合成十二套流程。真实采用的语音、生成媒体、多语言、
无障碍和连续 3D 只在改变玩家体验时增加检查；权利和秘密属于产品安全，不塞进游戏 QA。

`PRODUCT_BRIEF.md` 与 `SOURCE_BIBLE.md` 是上游事实，下游不得静默改写。brief 必须锁定目标运行
形态：平台、生产引擎、实际交付物、目标运行时和实际验收设备或运行器。工具链不可用时，只能使用
brief 已批准的替代运行时；替代结果不证明目标平台已通过。

## 模式

- `quick`：默认；用推荐草案推进，比较三个概念后自动选择，默认 `assuranceProfile: smoke`。
- `director`：给出三个概念和推荐后停靠，等待用户选方向。
- `resume`：读取 `_progress.md` 和实际产物，从最早未完成的交接继续。

## 流程

1. 建立工作区，记录来源、模式、当前阶段和未确认假设。
2. 生成 `PRODUCT_BRIEF.md`；高风险歧义未解决时才停靠。
3. 调用 `novel-game-analyze` 生成有原文依据的 `SOURCE_BIBLE.md`。
4. 调用 `game-concept` 生成三个真正不同的方向并选定 `CONCEPT.md`；`director` 在此停靠。
5. 调用 `game-world-design` 生成 `GAME_DESIGN.md`。
6. 调用 `game-art-direction` 生成 `ART_DIRECTION.md`；只有目标与 profile 需要时再制作视觉目标包。
7. 调用 `game-build` 生成可运行版本，再由 `game-qa` 按 profile 验证；问题按 product / design / art /
   build 归属回流，不让实现阶段静默重做策划。

编排器只记录两项完成结果：

- `scope`：上游范围和阶段 owner 齐全且不冲突；
- `playable`：当前 profile 要求的玩家效果均有真实运行证据。

中间产物仍由各自阶段 owner 负责，但不再把每个内部交接都包装成用户验收会。

## 语言与文化

接受任意语言小说。产物使用用户指定语言，未指定时跟随对话语言；原文证据保留原语言，跨语言
只补决策所需译文并维护一个术语表。原作文化语境、目标市场和界面语言分别记录，不用逐字翻译
替代本地化判断。

## 不可删除的判断

- 剧情必须转成玩家动词、选择和世界反馈，而非逐章复演。
- `experienceProfile`（`system-led` / `narrative-led` / `hybrid`）由 brief 起草、概念阶段确认，
  之后贯穿设计、美术、构建与 QA。它决定各阶段读哪几份方法文件，**不降低任何一档标准**：
  先例、三段弧、硬否决、只写不读审计、决策深度对三档一律成立，只换判据说法。连续场景与
  对白是一类成熟玩法，不是"没有玩法"，同样要拿出先例与凭据。
- **能动性合同**：玩家的选择要决定事件为什么发生、朝哪转（因果权），结果要看得出是他的
  （结算权）。两项都不成立时，即使界面上有卡牌、回合和资源条也不算玩家有能动性——那正是
  最常见的伪装。
- 概念、体验/关卡设计、美术方向分别拥有自己的批准边界；构建只能实现，不能暗中重选方向。
- 玩家第一分钟应从屏幕知道自己是谁、要做什么、什么会终结这一局。
- 验证切片必须在目标运行形态中完整走通；范围服从 brief，不默认扩成长篇全量游戏。
- 完成以运行、画面、真实输入、结果和重开证据为准；AI 不能客观证明趣味、长期平衡或商业价值。

只有当前 `assuranceProfile` 的必需项全部 `PASS` 才报告该档验证完成。`NOT_RUN` 可以诚实结束本次
执行，但不能满足当前声明。所有 profile 都以 `qa/verification.json` 为唯一游戏效果事实源；不要为
QA 另建发布 gate 文件。
