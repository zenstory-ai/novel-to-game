# Agent Note: 构建发现实现与设计文档的事实出入时，交回 owner 或在 BUILD_BRIEF 标明冲突

Status: implemented

## Problem

v0.5.0 的三个示例重做后，按更新后的 skills 逐条审计，三款都把“设计文档描述已不存在的东西”判为 major：
《西游记》ART_DIRECTION 写“当前切片未接声音”而构建已有完整程序化 BGM 与音效，CONCEPT 仍把已实现的梦幻外壳列为
“明确不借”；《金瓶梅》`_progress.md` 与 SOURCE_BIBLE 仍描述已退役的二十日账目模拟。`game-build` 的构建循环只要求
回写工具链与命令，没有任何一步要求处理实现与设计文档之间的事实出入，于是文档在多轮构建后静默漂移。

## Decision

`game-build/SKILL.md` 共同构建循环第 4 步追加：实际候选与 GAME_DESIGN、ART_DIRECTION 的事实描述不符时，
交回对应 owner 修订或在 BUILD_BRIEF 标明冲突，不留下描述已不存在的玩法、表现或声音的文档。构建仍不得自行
改写设计决定；这条只要求“出入可见”，裁决仍归设计 owner。

ClawHub 包随之更新：`game-build` 1.1.0，`novel-to-game` 1.0.2 改为依赖 `game-build@1.1.0`。

## Alternatives considered

- **在 `narrative-design-method` 补回“屏幕文案用人物口吻，不把内部状态名或账目术语直接显示给玩家”** —
  最强理由：《金瓶梅》正是叙事主导项目里账目术语上屏的反例，而 v0.5.0 把这句随外壳规则一起限定到了
  system-led/hybrid。否决原因：恋爱 ADV fixture 每组 n=8 盲评 7.33 对 6.92（sd 0.47 / 0.46），
  buildability −0.92、agency −0.55，三名评委同向；未通过。这是同一 fixture 上第四次出现“叙事方法多一句、
  可实现性就下降”，叙事层的屏幕文案问题暂由既有“不必把完整账目铺到每个选择界面”承担。
- **让构建阶段直接改写设计文档使其与实现一致** — 否决原因：违反“构建不得静默重做设计”的 owner 分离；
  删掉未实现的设计要求会把“没做”伪装成“不需要”。
- **新增文档一致性校验脚本** — 否决原因：违反 CLAUDE.md 的验证预算；出入由构建者在交付时声明，审计在试玩时发现。

## Consequences

- 收益：设计文档与实际构建的偏离在交付时就被声明，下游审计与 README 不再引用过期描述。
- 代价：BUILD_BRIEF 可能多出一段冲突说明；构建者仍需自己注意到出入，规则不保证发现。
- 重访信号：若后续审计仍频繁报出文档漂移，考虑在 `game-qa` 的限制项里显式记录“文档与构建出入”，而不是加门。

## Verification

代表性调用（与 v0.5.0 相同的盲评流程：Sonnet 无工具生成，Opus/Sonnet/Codex 盲评）：构造一个 production 第 4 步
现场——声音与战斗界面已与 ART_DIRECTION 不符、某张可行走地图未按 GAME_DESIGN 实现——新旧 `game-build` 各生成 4 份
交付。四项二值判据（声音出入、界面出入、地图出入是否交回 owner 或标冲突、是否未擅自改设计）两组均满分，说明
现场写得足够明显时旧版也会处理；整体交付质量 7.08 对 8.25，偏向新版。判定为“未检出回退，交付更清楚”，
不声称它能让构建者主动发现隐蔽的出入。

`python3 scripts/validate_repo.py`、`python3 -m unittest discover -s tests -v` 与中央
`clawhub_release.py validate` 通过。
