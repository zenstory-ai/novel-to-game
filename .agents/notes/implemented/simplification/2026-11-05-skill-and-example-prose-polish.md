# Agent Note: 使用 prose-gap-polish 精修全部 skills 并润色双示例游戏内文案与策划文档

Status: implemented

## Problem

按 `prose-gap-polish` 五步规范对 `skills/` 全部 24 份文件（7 份 `SKILL.md` 与 17 份 `references/*.md`）以及《西游记》《金瓶梅》两个示例的游戏内文案、策划文档做全面审查，存在四类问题：

- **电报体短碎句与“不是……而是……”套路句密集。** `skills/` 中大量列表项与规则说明依赖“不是 A，而是 B”否定句式和分号堆叠的短碎句；两个示例的 `SOURCE_BIBLE.md`、`CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 同样多处以“不是……而是……”铺垫后再给正向定义。
- **元说明、同义反复与括号罗列稀释关键规则。** `skills/` 多处括号枚举已由规则本身覆盖的例子，或在列表外再用散文重复表格已锁定的合同字段；总行数刚好卡在 1300 行上限（`1300/1300`），没有余量。
- **示例游戏内存在策划腔、系统词外露与语体违和。**
  - 《西游记》的技能、特技、法宝说明（`js/data.js`）和火脉残图的探路者提示（`js/treasure.js`、`js/treasure_ui.js`）夹杂“物理单体高伤”“稳定单体”等策划表缩写与生硬机制句，缺乏古典神魔 RPG 的招式与器物感。
  - 《金瓶梅》的分岔院门提示与菜单说明（`js/main.js`、`js/menus.js`）直接向玩家暴露“好感还不够”“好感不够”“好感够的”等底层数值词，违背 `GAME_DESIGN.md`“好感不上屏、台词只写动作与物件”的体验合同；部分互动提示（`@look`、`@hold`）与个别现代口语（“了不起”“动过一个很坏的念头”“手劲儿还行”）缺乏明代世情白话与互动影游质感。
- **策划文档与实机代码存在信息/逻辑断点。**
  - 《西游记》`design/GAME_DESIGN.md` 第 81 行仍写“「八戒」出现时真八戒正跟在队尾——识破的线索就在画面上”，而首轮产品审计（`F03`）早已将代码改为真八戒留在师父身旁看管行李、悟空独自下山凭师父嘱咐识破假八戒。
  - 《金瓶梅》`design/GAME_DESIGN.md` 第 119 行将 `r:人物` 记忆印写为“某某记下了这句话／某某没再看你”，而 `js/main.js` 实际渲染为“某某会记得这句话／某某心里冷了几分”；`_progress.md` 仍停留在升级为互动影游前的旧描述。

## Decision

- **对 `skills/` 全部 24 份 Markdown 执行五步精修。** 合并电报体短碎句，将“不是 A，而是 B”改写为直接正向陈述，删去不增加行为边界的元说明与冗余括号举例，消除指代与修饰边界歧义，同时百分之百保留全部跨阶段合同字段、硬否决条件、六键 QA 证据要求及 6 份下游 `SKILL.md` 的 `OUTPUT_LANGUAGE_RULE`。`skills/` 总行数从 1300 行降至 994 行。
- **润色《西游记》与《金瓶梅》的游戏内文案。**
  - 《西游记》：将 `js/data.js` 的招式、愤怒特技、七十二变、法宝说明及 `js/treasure.js`、`js/treasure_ui.js` 的火脉寻宝提示改写为地道、可读性高的章回风回合制 RPG 文案，严格保留全部数值与测试断言子串。
  - 《金瓶梅》：将 `js/main.js` 与 `js/menus.js` 中外露的“好感”提示统一替换为“心意未到，这扇门今夜没有为你留灯”“这扇门今夜没留灯，门闩已经落下了”等院门与灯火意象；润色 `index.html`、`js/story/common2.js`、`js/story/common3.js`、`js/story/dates.js`、`js/story/xuee.js`、`js/story/index.js` 中的非过场提示与对白（如以第十九回“盯着房梁上的白绫，差点就寻了短见”替换现代口语“动过一个很坏的念头”），不改动任何已烘焙进预渲染过场视频（`@cut ... @cut off`）的字幕句数与配音台词。
- **修补双示例策划文档的逻辑断点并精简套路句。**
  - 修正《西游记》`design/GAME_DESIGN.md` 中假八戒识破线索的描述，与 `js/hub.js`、`js/text.js` 及 `qa_story_audit.py` 对齐。
  - 修正《金瓶梅》`design/GAME_DESIGN.md` 中记忆印文案说明与 `_progress.md` 的互动影游现状，与 `js/main.js` 对齐。
  - 清理两套示例文档中的“不是……而是……”套路句与电报体碎句。
- **同步更新 `.clawhub/publish.json`。** 7 个 skill 版本号各升一档补丁版本并重新锁定 `packageDigest`。

## Alternatives considered

- **连同《金瓶梅》`@cut ... @cut off` 内部的台词一并改写** — 最强理由：统一润色全剧本的每一句台词。否决原因：58 段预渲染过场视频已将人物口型、配音与 `CUT[id].cues` 时间轴烘焙进 `.mp4`，改动过场内部台词会导致音画与字幕脱节或破坏 `lint_script.mjs` 的字幕句数校验。
- **只润色 `skills/`，不动示例游戏代码中的文案** — 最强理由：避免触碰示例的自动化测试断言。否决原因：用户明确要求充分 review 西游记和金瓶梅的所有文案并润色成地道、有游戏质感的文字；只要核对测试合同并在改后跑通全部回归，就能兼顾文学质感与测试稳定性。

## Consequences

- 收益：`skills/` 总行数从 1300 行降至 994 行，留出 306 行安全余量，且规则密度与可读性显著提升；两款示例游戏的招式/法宝/院门/交互提示消除了策划腔与系统词外露；文档与实机代码一致。
- 代价：7 个 skill 的内容摘要全部更新，需同步升级 `.clawhub/publish.json` 的补丁版本号。

## Verification

- `python3 scripts/validate_repo.py`
- `python3 -m unittest discover -s tests -v`
- `(cd examples/journey-to-the-west/build/app && npm test)`
- `(cd examples/jin-ping-mei/build/app && npm run verify:model)`
- `python3 /Users/pite/makemoney/zenstory-ai-dotgithub/scripts/clawhub_release.py validate --root . --manifest .clawhub/publish.json`
- `python3 /Users/pite/makemoney/zenstory-ai-dotgithub/scripts/source_release.py check --root . --policy /Users/pite/makemoney/zenstory-ai-dotgithub/clawhub-sources.json`
