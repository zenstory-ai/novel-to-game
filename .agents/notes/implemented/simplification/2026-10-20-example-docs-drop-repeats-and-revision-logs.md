# Agent Note: 示例文档与 README 去掉重复声明和改稿记录，修正前后不一

Status: implemented

## Problem

2026-10-20 按 prose-gap-polish 标准做的只读审计估计，三个示例的策划文档有 15–40% 是赘述，README 约 15%，
`docs/production-delivery.md` 约一半。[example-docs-match-code-and-drop-corpus-sources](../bug-fix/2026-10-20-example-docs-match-code-and-drop-corpus-sources.md)
已处理《西游记》GAME_DESIGN 的实现符号和数据源泄露，其余问题分三类：

- **同一句声明在多份文件里重复。** 《西游记》「不复刻现代影视」出现在 SOURCE、SOURCE_BIBLE（两处）、
  GAME_DESIGN、ART_DIRECTION（两处）、BUILD_BRIEF（三处）；「自动化不证明趣味」一类的话在三个示例的
  `_progress`、CONCEPT、BUILD_BRIEF、ART_DIRECTION、GAME_DESIGN、SOURCE_BIBLE 和 README 里各说一遍，而
  `qa/verification.json` 的 limitations 才是这件事的事实源。
- **改稿记录写进了交付文档。** 《西游记》BUILD_BRIEF 后半部分是四轮打磨日志（19MB→3.8MB、初版只列三战），
  PRODUCT_BRIEF 写着旧 3.8MB 上限为何不再适用；《金瓶梅》的「二十日账务模拟退役」在 PRODUCT_BRIEF、
  `_progress`、CONCEPT 和两份 README 里各讲一次，SOURCE.md 用一段讲词表第一版怎么失败；Project Plateau
  PRODUCT_BRIEF 的时长实测段夹着未定义的 D15、S0、Mixed/Panic。
- **前后不一。** 《西游记》CONCEPT 说「九段桥段」却列出十段，方向二的淘汰理由按 15–22 分钟切片写而 brief
  锁的是 45–90 分钟，PRODUCT_BRIEF 一边记录用户与作者的决定一边说「全部取值未经确认」，ASSET_NOTES 第一节
  称「非 CLI 生成」、后两节写 `codex exec`，又说「蟭蟟虫原 PNG 未改」而末节新做了蟭蟟虫形态图；《金瓶梅》
  `_progress` 写「无人等灯」而游戏内是「无人留灯」，类型在 galgame、恋爱 ADV、后宫之间摇摆；Project
  Plateau ART_DIRECTION 说小屏可播放实机录屏而 RUN.md 与 `entry-mode.js` 只给兼容提示，同一条水在文档里
  时而 brook 时而 creek，SOURCE_BIBLE 还留着已作废的五到八分钟路线；README 的 `### ClawHub` 标题下其实是
  `npx skills` 命令，`quick` 何时停下有四种说法，英文 FAQ 的替代运行时一句比中文版多一层防御。

## Decision

- **一条声明只留一处。** 《西游记》「不借现代改编」只留 `source/SOURCE.md` 的授权边界和 ART_DIRECTION 人物条；
  「自动化证明不了什么」以各例 `qa/verification.json` 的 limitations 为准（《西游记》另留 RUN.md「已知边界」），
  `_progress`、CONCEPT、BUILD_BRIEF、ART_DIRECTION、GAME_DESIGN、SOURCE_BIBLE 里的同类句删去；README 只在
  「QA 里的 PASS 是什么意思」一条 FAQ 里说。真正待答的问题改写成开放问题，例如《西游记》CONCEPT 改问
  「未读原著的玩家能否只凭战斗后果理解相克与真扇」。
- **交付文档写现状，不写改稿史。** 《西游记》BUILD_BRIEF 删去打磨、范围对照与三轮交付日志，完成证据一节
  补上判定口径、`npm test` 的合同和截图来源；资产与部署细节指向 RUN.md 与 ASSET_NOTES。只有理由仍在支撑
  当前选择时才保留一句历史：《金瓶梅》CONCEPT「为什么是恋爱 ADV」、Project Plateau PRODUCT_BRIEF 的两次
  时长调整（改用白话，删掉内部代号）。
- **以成品为真值修正不一致。** 桥段按 GAME_DESIGN 的战役顺序计为十段（六段战斗）；ASSET_NOTES 说明
  `insect.png` 只用于化虫入腹的飞入动画、`form_chongzi.webp` 是 2026-10 新做的形态立绘，生成方式统一为
  内置图像工具（2026-10 两批经 `codex exec` 调用）；《金瓶梅》统一用游戏内的「无人留灯」，类型统一为
  「恋爱 ADV」，galgame 只作对标与结构说明，文案附录改名「文案声口参考」；Plateau 文档里的水统一叫 brook，
  只在 GAME_DESIGN 注明游戏内文本称其为 open creek，小屏行为按 `entry-mode.js` 写成兼容提示，渲染一节改用
  美术语言并删去管线术语与世界坐标。
- **README 两份同改。** `quick` 的停靠条件按 `intake-method.md` 的清单只写在「第一条请求」末尾，其余位置删去
  或指回；安装小节改名「每个 Agent 一条命令」，ClawHub 改为表后一句上架说明；删去「candid / admits /
  says exactly」一类自夸；《金瓶梅》与 Plateau 的节选随来源同步（Plateau 的 BUILD_BRIEF 节选随来源句删除，
  改引 `tested runtime` 与剑龙两条限制项）；英文 FAQ 的替代运行时一句与中文对齐。两份 README 仍各 33 个
  标题、42 个代码围栏。
- **`docs/` 写操作方法。** `production-delivery.md` 保留「Deployment Checks 只拦推广、不拦构建」这一事实，
  补上触发与下载只读观察的命令和失败条件；`source-release.md` 补「验证 ClawHub」一节：读发布运行的
  `clawhub-report.json`，再对每个 slug 跑 `npx clawhub inspect` 与 `.clawhub/publish.json` 的版本对照，并给出
  同一 tag 的重新派发命令。

## Alternatives considered

- **每份文档各留一句免责，只删重复的第二、三句** — 最强理由：读者可能只打开其中一份文件，就看不到
  「自动化证明不了趣味」。否决原因：PRODUCT_BRIEF、CONCEPT、BUILD_BRIEF 都不是 QA 结论的事实源，各写一句
  只会在 QA 记录更新时彼此过期；读者要找 QA 覆盖范围，`qa/verification.json` 是 README 和 BUILD_BRIEF 都
  指向的唯一位置。
- **把改稿记录挪到单独的 `HISTORY.md`** — 最强理由：保住每轮打磨的取舍。否决原因：这些内容已经在 git
  历史和 CHANGELOG 里，另立文件又多一份要同步的状态；仍影响当前判断的几条已经并进现状描述。
- **《金瓶梅》统一叫 galgame** — 最强理由：产品负责人的裁决原话是对标 galgame。否决原因：中文读者对
  「恋爱 ADV」更不易误读，「后宫」则暗示同时攻略，而本作一周目只走一条个人线；galgame 保留为对标词。

## Consequences

- 收益：三个示例每份文档只讲自己负责的事，读者不必在多份文件里比对哪句是最新的；README 的 QA 边界、
  `quick` 停靠条件各只有一个出处；`docs/` 能照着操作。
- 代价：单独打开 PRODUCT_BRIEF 或 CONCEPT 的读者要跳到 `qa/verification.json` 才能看到测试覆盖；
  BUILD_BRIEF 不再记录资产瘦身前后的体积对比，要看 git 历史。
- 未做：示例游戏代码与 QA 证据不改；《西游记》GAME_DESIGN 只删了一句重复声明，其他部分属于上一批。

## Verification

逐项对照成品核实：`examples/journey-to-the-west/design/GAME_DESIGN.md` 的战役顺序（十段，六段战斗）、
`build/app/js/battle_animator.js` 与 `assets.js` 对 `insect.png` 的唯一用途、`git log` 中 `units/*.webp`
与 `form_chongzi.webp` 的日期；`examples/jin-ping-mei/build/app/js/story/index.js` 的结局标题「无人留灯」；
`examples/project-plateau/build/app/src/entry-mode.js` 的兼容判定与 `simulation.js`、`field-journal.js`
里的 `exposed-creek` / open creek；`scripts/deployment_receipt.py` 的失败条件与
`.github/workflows/deployment-readiness.yml` 的输入和制品名。README 节选与来源逐字比对；两份 README
标题与代码围栏数一致。`python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests -v` 通过。
