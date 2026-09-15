# Agent Note: Frankenstein《The Hovel》英文示例入库

Status: rejected — 自动化全绿但真人试玩看不懂也不会玩，示例的全部职责就是让没参与构建的人读懂

## Problem

仓库需要一个非中文原著的示例来证明 `example.json` 自述机制（见 [example-self-description-manifest](../../implemented/architecture/2026-07-29-example-self-description-manifest.md)）不是纸面能力，也需要一个第三种类型的可玩切片。

## Proposal

2026-07-29 合入 `examples/frankenstein/`：《Frankenstein》XI–XVI 章改编的潜行切片"The Hovel"，`example.json` 声明 24 个阿拉伯数字章节、英文覆盖标题与引用格式；Canvas 2D 手绘院落、四个可达结局、333 条浏览器断言在两种游戏速度下全部通过，0 控制台错误，引擎不变量覆盖十个段落。

## Alternatives considered

- **保留在 main、后续迭代修复可读性** — 最强理由：工作量与证据都在，自动化没有一项是红的。否决原因：合入当天仓库所有者试玩，既说不出游戏是什么也不知道怎么操作；示例是给没建过它的人看的，这一条不成立时其余指标不作数（817b741）。
- **修改校验器把可读性做成机器门** — 否决原因：可读性不是断言能覆盖的量；QA 契约明确不宣称真人试玩与主观质量（见 [six-check-minimal-qa-contract](../../implemented/testing/2026-08-06-six-check-minimal-qa-contract.md)）。

最终做法：`git revert` 掉合并（817b741），全部工作与试玩裁决保留在 `frankenstein-example-shelved` 分支（fb2522b）；校验器零改动。重新入库是"revert 这次 revert"，不是重做。

## Risks

- 最有用的教训：333 条断言证明切片能运行、能完成、内部自洽，证明不了它可读。自动化全绿 never 等于可发布示例；QA 报告每轮都写了"清洁语境理解"与"首次上手"两道门未跑，未跑的门不是收尾小事。
- 重提条件（分支头已列出）：23 秒无动作的冷开场、从不交代"你是谁/你要什么"、三个无标签的叙事读数、俯视图里始终不成形的人物——四项都要修，且 must 先过一次没参与构建的人的试玩。
- 同一事件催生的规则变化（3c80b24）：核心循环 must 与至少两款很多人玩过的成品游戏同构，新意只放在 IP、故事、内容、主题与美术；原型层不再默认最扁平的形态。此规则现在住在 `game-concept` 与 `novel-to-game` 的 intake 里。

来源：827fb80、817b741、fb2522b、3c80b24
