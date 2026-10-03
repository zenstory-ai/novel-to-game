# Agent Note: 三个公开示例按对标品类整体重做，而不是在原结构上继续加系统

Status: implemented

## Problem

三个示例都通过六项检查，但所有者试玩后判断“不够具有游玩吸引力”：《西游记》只有一串战斗关卡，没有《梦幻西游》
玩家默认存在的场景行走、NPC 任务和日常；《金瓶梅》是二十日账目模拟，阅读路径铺满内部术语，人物不“在场”；
Project Plateau 平光、单色地表、相机过高，一局 1–3 分钟。继续在原结构上加规则只会让账更深、关卡更多，
不会让它们看起来像各自品类的一款游戏。

## Decision

- 《西游记》对标《梦幻西游》：保留指令回合战斗，外面补齐可点击行走的场景图、NPC 与任务标记、任务追踪与
  自动寻路、小地图、聊天频道、可重复的封妖令日常、成长/商店/装备/召唤兽面板和愤怒特技。
- 《金瓶梅》对标主流 galgame：退役二十日账目引擎，改为共通线 → 心意开门 → 五条个人线（16 个结局）的 ADV，
  配齐立绘差分与标准 ADV 操作；原著命数在结局后单独翻页呈现，关系可选、命运不改。
- Project Plateau 提升三维质感（低角度主光、天空即环境光、AgX/AO/雾、Blender 烘焙地表、草地、人眼视高）
  并加深拍照循环（掩体带、按实时取景评级、长焦、可读的翼龙俯冲、剑龙、300 秒光照）。
- 每款都先做“四视角试玩评审 → 合并清单 → 实现 → 两名独立验证 → 修复”，再按更新后的 skills 逐条审计并
  做“两分钟理解”新手判定；只修有证据的 blocker/major。
- 验证仍是一条权威命令、六项检查；《西游记》删除与 `data.js` 重复的第二数值事实源
  （`qa/design-contract.json` 与其检查脚本）。

来源：本分支（feat/example-playability-overhaul）

## Alternatives considered

- **在原结构上逐项加深（更多战斗、更多账目回读）** — 最强理由：保留已验证的大量内容。否决原因：问题在外壳与
  呈现，不在内容量；《金瓶梅》的三万行账目越深，阅读体验越像对账。
- **为每个示例新增专项 QA（外壳清单检查、截图比对）** — 否决原因：违反“六项一跑”的最小证据规则；外壳与成色
  属于试玩判断，写成限制项与审计记录，不写成新的门。
- **只换美术不动玩法** — 否决原因：Plateau 的平光与《西游记》的无场景都是结构问题，换皮不解决“像 demo”。

## Consequences

- 收益：三张随手截图都像各自品类的游戏；skills 的外壳规则有了仓内范例（见
  [genre-shell-and-first-minute](2026-10-02-genre-shell-and-first-minute.md)）。
- 代价：《金瓶梅》单周目缩短到约 20–30 分钟，旧的二十日内容与其回放证据整体删除；浏览器完整路径只覆盖月娘良缘，
  其余结局只由脚本证明可达。Plateau 的帧时间只在高负载机器上测过。
- 重访信号：真人试玩仍报告“像 demo”或“不知道下一步做什么”时，先查对应品类外壳是否缺项，再考虑加内容。

## Verification

`python3 test/verify.py`（西游记）、`python3 test/verify_visual.py --write-evidence` 与 `node test/lint_script.mjs`
（金瓶梅）、`npm test && npm run build && npm run verify`（Plateau）均通过，`qa/verification.json` 六项 PASS；
`python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests` 通过。
