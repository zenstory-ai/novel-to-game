# Agent Note: 成熟品类的外壳随类型继承，系统主导项目在设计里写清“外壳表”与第一分钟

Status: implemented

## Problem

三个示例都能通过六项检查，但试玩吸引力不足：《西游记》借了《梦幻西游》的战斗语法，却在 CONCEPT 里把
“师门与 MMO 长线养成、装备打造”写进“明确不借”，结果只有一串战斗关卡，没有场景行走、NPC 任务、任务追踪
和日常环，玩家第一眼就把它当成 demo。《金瓶梅》把内部账目术语（口径、封线、副签、总索引）直接铺在阅读路径上。
Project Plateau 平光、单色地表、相机过高，三维质感像玩具。根因在 skills：只要求“借声明的维度”和
“每个系统必须改变核心决策”，没有任何一条要求补齐玩家判断“这是一款该类游戏”所依赖的外壳，
外壳便利（任务追踪、自动寻路、存档）反而会被“删除后体验不变就删减”误裁。

## Decision

- `game-concept/references/concept-method.md`：借用成熟品类时，外壳（进入世界、目标指引、成长回访、阅读与操作便利）
  随类型继承；拒绝项只排除商业化、社交、长线数值或受保护素材。
- `game-world-design/references/world-design-method.md` 新增「品类外壳与第一分钟」，**仅用于 `system-led` 或 `hybrid`**：
  在体验合同里用一张短表把外壳标为实现 / 降级 / 不做与理由，切片缩小内容量不砍外壳，外壳不按“改变核心决策”裁剪；
  外壳操作只写进可执行切片合同的完整路径，不另写规则；第一分钟给出招牌画面与熟悉的指引。
- `game-world-design/references/narrative-design-method.md`：人物路线的关键选择针对该人物自己的心结或议程，
  关系进展优先由人物反应、称呼、可进入的场所与可托付的事呈现，而不是屏幕数值（《金瓶梅》重做的经验）。
- `game-art-direction/references/art-direction-method.md` 新增「品类成色」：以同品类主流作品实机截图为标尺；
  三维质感按光照层次与色调 → 材质分层与地表 → 几何细节的顺序投入。同文件删去与 SKILL.md 重复的语音一句。

来源：本分支（feat/example-playability-overhaul）

## Alternatives considered

- **对所有 `experienceProfile` 一律要求外壳表（v1–v3 实测）** — 最强理由：《金瓶梅》的问题同样是“像 demo”。
  否决原因：生成长度近似固定，叙事项目多出的外壳表挤掉了世界规则与可执行合同，盲评 buildability 连续下降；
  阅读便利（回看、跳过、存档）本已由 `game-art-direction` 的对白区要求承担。
- **在 art-direction 里把恋爱 ADV 的立绘差分、自动播放、带缩略图存档写成清单（v3）** — 否决原因：盲评持平略降。
- **把 Plateau 的三维经验（主光不在相机背后、按玩家视高判断尺度、天空与环境光同源）写进「品类成色」（第二轮）** —
  否决原因：盲评 7.40 对 7.28，未见改进；按“加一条先删一条”的预算规则不加。
- **只改示例、不改 skills** — 否决原因：同样的“只借一条”会在下一本书上重演。

## Consequences

- 收益：系统主导项目的 GAME_DESIGN 会显式交代场景行走、任务追踪、日常环等外壳，构建阶段不再只做战斗关卡。
- 代价：叙事主导项目没有得到新的外壳约束，《金瓶梅》式的 ADV 外壳仍依赖 art-direction 的对白区一句和构建者经验。
- 重访信号：若叙事项目再次交出缺回看/存档/立绘差分的构建，先在 art-direction 的叙事层要求上做 A/B，而不是回到 world-design。

## Verification

盲评 A/B（虚构 fixture：回合制 RPG《灯笼渡》、恋爱 ADV《梧桐巷的四个夏天》、第一人称 3D《雾林采标人》；
Sonnet 无工具生成，Opus/Sonnet/Codex 三名盲评，五轴 1–10）：

- world-design · RPG：对照 6.71 / 7.07，实验 7.13 / 7.31（两轮均胜，attraction +0.7~+1.1，buildability 未降）。
- world-design · ADV（限定 `system-led`/`hybrid` 后）：实验 7.29；对照两次独立抽样 7.47 与 6.84（合并 7.16），
  组间抽样差大于实验差，判定“未检出回退”。
- art-direction · 3D：7.44 对 7.44（attraction +0.33），未检出回退。
- concept · RPG：6.91 对 7.04（14 胜 9 负），未检出回退。
- 第二轮 narrative-design · ADV（每组 n=4，对照取已含第一轮改动的 HEAD）：7.18 对 7.40，fidelity +0.58，组内 sd 由 0.69 降到 0.37。

只报告“未检出回退 / 改进”，不把主观趣味写成确定结论。
