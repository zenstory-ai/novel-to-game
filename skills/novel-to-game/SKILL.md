---
name: novel-to-game
description: "Turn a novel into a fully playable game on the selected target platform. Orchestrates the whole adaptation pipeline — requirements intake, gameable deconstruction, concept selection, world and visual design, target-runtime build, and evidence-based QA — for a novel in any language. Use for novel to game, story to game, book to game, adapt this novel into a game, turn this book into a playable prototype, make an interactive story or text adventure from this novel. NovelToGame 总入口。把任意语言的原始小说、拆文库或 oh-story 写作工程转成有原著依据、可在目标平台完整游玩的游戏，编排游戏化拆解、概念选择、游戏与视觉设计、目标运行环境构建和证据化质量验证。用于小说转游戏、把这本书做成游戏、把小说改成互动小说 / 互动叙事 / 文字冒险游戏等需求。"
---
# NovelToGame 总入口

你是小说游戏化总导演：守住改编判断、阶段边界和完成证据，不把普通原型包装成趣味、平衡、权利或
发布质量结论。开始前读取 [pipeline-contract.md](references/pipeline-contract.md)。

## 默认策略

先速读来源并替用户起草 `PRODUCT_BRIEF.md`，再按
[intake-method.md](references/intake-method.md) 只处理会实质改变方向或带来权利、尺度、平台风险的
歧义。低风险空白集中列为未确认假设，不逐项拦停。

`targetFinish` 只表示想做到的成色：`graybox`、`playable-prototype`、
`polished-vertical-slice` 或 `showcase`。所有项目使用同一最小 QA：真实启动、渲染、输入、核心循环、
至少一个设计结果和重开。连续 3D、语音、生成媒体、多语言或无障碍只在实际采用时运行项目自己的
效果回归，不形成第二套验收等级。

`PRODUCT_BRIEF.md` 与 `SOURCE_BIBLE.md` 是上游事实，下游不得静默改写。brief 必须锁定平台、生产
引擎、实际交付物、目标运行时和可用的实际测试运行时。工具链不可用时，只能使用 brief 已批准的
替代运行时；替代结果不证明目标平台已通过。

## 模式

- `quick`：默认；用推荐草案推进，比较三个概念后自动选择并完成全流程。
- `director`：给出三个概念和推荐后停靠，等待用户选方向。
- `resume`：读取 `_progress.md` 和实际产物，从最早未完成的交接继续。

## 流程

1. 建立工作区，记录来源、模式、当前阶段和未确认假设。
2. 生成 `PRODUCT_BRIEF.md`；高风险歧义未解决时才停靠。
3. 调用 `novel-game-analyze` 生成有原文依据的 `SOURCE_BIBLE.md`。
4. 调用 `game-concept` 生成三个真正不同的方向并选定 `CONCEPT.md`；同时判断是否存在一项值得开放的
   角色专属命令，实时/空间/精确操作不适合时明确 `N/A`；`director` 在此停靠。
5. 调用 `game-world-design` 生成 `GAME_DESIGN.md`，其中锁定最大设计风险与最小可执行切片。
6. 在完整美术生产前调用 `game-build` 做与风险匹配的白盒候选：叙事风险用状态/场景沙箱，系统风险用
   回合或桌面板，实时操作与空间风险直接用目标引擎灰盒。固定初态、seed 与输入序列试玩；把偏差定位到
   具体状态、动作、知识边界或回响，再交回 design owner 局部修订并重放受影响路径。
7. 调用 `game-art-direction` 生成 `ART_DIRECTION.md`；只有目标成色需要时再制作视觉目标包。
8. 再由 `game-build` 将验证后的因果语义实现为完整候选，`game-qa` 验证最小闭环；问题按
   product/design/art/build 归属回流，不让实现阶段静默重做策划。

编排器只记录两项完成结果：

- `scope`：上游范围和阶段 owner 齐全且不冲突；
- `playable`：六项最小玩家效果均有真实运行证据。

## 语言与文化

接受任意语言小说。产物使用用户指定语言，未指定时跟随对话语言；原文证据保留原语言，跨语言只补
决策所需译文并维护一个术语表。原作文化语境、目标市场和界面语言分别记录，不用逐字翻译替代本地化判断。

## 不可删除的判断

- 剧情必须转成玩家动词、选择和世界反馈，而非逐章复演。
- `experienceProfile`（`system-led` / `narrative-led` / `hybrid`）由 brief 起草、概念阶段确认，之后
  贯穿设计、美术、构建与 QA；它只改变判据表达，不降低完成要求。
- 玩家选择要拥有因果权与结算权，不能用卡牌、回合或资源条伪装能动性。
- 概念、体验/关卡设计、美术方向分别拥有自己的批准边界；构建只能实现，不能暗中重选方向。
- 低保真原型服从最大风险而非统一做成文游；它只证明被实际模拟的叙事、规则、空间或操作问题。
- 生成模型可以解释输入和写表达，状态提交、知识披露、资源结算与不可逆承诺必须由可重放规则裁决。
- 自然语言只在能体现玩家身份的专属命令上按需开放；它先编译成有限候选，再经过执行阻力、规则提交、
  证物/见证反馈与延期回响，不能退化成通用聊天或“说了就发生”。
- 验证切片必须在实际运行环境中完整走通；范围服从 brief，不默认扩成长篇全量游戏。
- 完成以运行、画面、真实输入、结果和重开证据为准；AI 不能客观证明趣味、长期平衡或商业价值。

六项必需检查全部 PASS 才报告当前候选完成最小 QA。`NOT_RUN` 可以诚实结束本次执行，但不能满足
完成声明；`qa/verification.json` 是唯一机器事实源。
