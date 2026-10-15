# Agent Note: 金瓶梅示例文案规则归位与当前内容边界校正

Status: implemented

## Problem

当前《金瓶梅》示例已按 [galgame 重做决定](../../implemented/feature/2026-10-02-examples-rebuilt-on-benchmark-genres.md) 交付，但 `source/SOURCE.md` 仍描述旧版“不改编也不暗示情色内容”的范围，与现行产品简报、美术方向和游戏设计中的 18+ 恋爱 ADV、玩家选择与可关闭成人画面不一致。

`analysis/SOURCE_BIBLE.md` 的“后宫文案语料参考”附录混有历史采样依据、落笔规则、人物声口和场景验收。这些内容服务于游戏文案设计，混放在原作事实层，违反既有 [策划 owner 分离决定](../../implemented/architecture/2026-07-18-planning-owner-separation.md)，也让读者难以区分原著证据与设计取舍。

## Decision

- 将该附录整段原样迁到 `design/GAME_DESIGN.md`，连同历史采样来源上下文保留，不查询数据库、不复制语料、不改声口或示例；更新当前引用并仅保留一份正文。
- `SOURCE_BIBLE.md` 保留原著事实、引用、覆盖和改编边界；原位置用准确链接指向设计附录。
- `source/SOURCE.md` 的当前改编说明只对齐既定产品边界，不修改原著、删节处理、历史计数、授权说明或游戏内容。
- 双语 README 对照当前 skill 契约收紧“所有设计决定都有原著引证”“无需 GPU”“没有其他费用”等过度承诺，不改变工作流或增加验收要求。

## Alternatives considered

- 保留附录原位置：既有引用不需要更新，读者也能在一个文件内找到人物资料；但会继续把游戏写作指令放在上游事实层，故不采用。
- 删除附录：能直接缩短事实层文档；但会丢失现有的采样上下文、人物声口与可追溯设计依据，故采用原样迁移。

## Consequences

原著事实与游戏文案设计各有明确归属，1923 字符的附录只保留一份，采样来源、人物声口和全部示例原样保留。迁移需要同步当前引用；本次未重跑游戏浏览器路径，既有 QA 记录保持不变。

同时按仓内源文本修正《西游记》牛魔王化八戒的证据回目（第61回），按现有游戏数据修正文档先白牛现形、再触发众神助战的顺序；去除当前设计中已不适用的固定“1核心+2支持”系统预算。Project Plateau 的场景计数只修文字。

工具对比页依据 [Summer Engine 官方 Story-to-Game 页](https://www.summerengine.com/story-to-game) 校正为兼容 Godot4 的桌面引擎，可选择游戏类型、编辑和导出工程，不再误写成托管视觉小说生成器。运行时 skill 不增加供应商推荐。

## Verification

实施前已读取上述两篇旧笔记及 `2026-10-03-build-writes-back-design-drift.md`；本次维持原决定，仅纠正文档归属与既定行为的描述。使用 `/Users/pitechen/.local/bin/python3.12` 运行 `scripts/validate_repo.py` 与 `-m unittest discover -s tests -v`，7个skill验证和15项测试通过；`git diff --check` 通过。64份当前Markdown均按五步顺序审阅，77个完整代码围栏、11条基线badcase行、七份skill frontmatter均保持，双语README标题层级一致，本地链接可达；游戏代码、JSON、资产、真实QA产物和旧笔记未改。
