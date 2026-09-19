# Agent Note: README 用真实产出说话，并回答读者问过的问题

Status: implemented

## Problem

#58 把 README 排成给人看的顺序，#59 统一了 masthead，但正文仍然全是**说明文字**：读者看到的是「提取有原文依据的规则、空间、角色意志」「验证启动、渲染、输入、核心循环」这类描述，看不到任何一份 skill 写出来的文件长什么样，也看不到 QA 记录到底写了什么、没写什么。同组织的 oh-story-claudecode（#434）和 drama-skills（#173）在 2026-09-18 用真实产出替换说明文字并加了常见问题，效果明显。本仓库的三个示例目录里有完整的 `SOURCE_BIBLE` / `CONCEPT` / `GAME_DESIGN` / `ART_DIRECTION` / `BUILD_BRIEF` / `qa/verification.json`，全部可以直接节选。另一方面，读者在 Discussion #17 提出的「互动叙事被做成卡牌、回合和数值面板」是这个仓库最有代表性的失败反馈，README 没有一处回答它。

## Decision

两份 README 在 #58/#59 的骨架上改三处，其余章节保留：

1. **顶部一段话先说这是什么**（装进已在用的编码 Agent 的七个开源 skills），再说交给它一本小说会发生什么，交付物写「达到你所要求成色的可玩构建」而不是「可玩的游戏」：`targetFinish` 有四档，三张卡片上的示例都是「可玩原型」。**「这是什么」改成五条加粗要点**，替换原来的两段简介加「为什么用 NovelToGame」五条：每个设计决定引用原著（四种边界标签；只承诺硬规则、关键角色目标、转折结局和标志性锚点带章回，与 `novel-game-analyze/SKILL.md` 一致）、游戏形态是有记录的决定（三条硬否决举例）、面向简报锁定的运行环境构建（简报是「Agent 最先起草的一页需求单」，`quick` 模式下只在阻断项上停下等用户裁决；工具链缺失不得改做网页）、QA 是一次真实运行六项检查加如实写下的限制、语音默认关闭且默认在构建期生成（运行时合成须经简报批准）。第二屏「这是什么」的开头不再重复首段的「七个 skills」句。正文不再用未定义的 owner / intake / limitation 裸词：阶段各自负责一份文档，「开始前的需求确认」，「限制项（limitation）」。
2. **新增「看看它的输出」**，三个短小节，标题写读者会看到什么（设计文档长什么样 / 一个选择怎样被后文记住 / QA 记录承认自己没测什么），每段摘自树内文件并链接原文：
   - 《西游记》：芭蕉扇这一条规则穿过 `SOURCE_BIBLE`（钉到第 59–61 回的事实表，原表 11 行节选 3 行）→ `CONCEPT`（三个方向的硬否决结果；扇子的正反规则压进引言，不再重复引用）→ `GAME_DESIGN`（三段效果表和「三扇何时开」，收尾段落完整引用）→ `ART_DIRECTION`（三段改写背景，末尾标「…」）→ `qa/verification.json`（终态 `ending: 三借芭蕉扇 · 完` 与六项 PASS，逐键一行原样引用）；
   - 《金瓶梅》：核心句、支柱表的三行（可观察证据 / 否决现象）、GAME_DESIGN 禁止「按完选项只回一句话就散场」的两条（英文版完整译出，含「成熟关系还会触发一次由女主发起的黄昏邀约」），以及 QA 记录第一条限制项「快速路径……只到达一个失稳结局」；
   - Project Plateau：概念的三方向裁决（引言里点名 A · Proof Before Dark / B · Fire Across the Lake / C · The Eighteenth Cave 各是什么）与证伪条件（含末句「`GAME_DESIGN.md` 必须定义这条因果链」，不再静默截断）、`report.json` 的输入轨迹、BUILD_BRIEF 写明 PASS 不证明什么，以及 PRODUCT_BRIEF 记录实测 55.2 秒推翻 5–8 分钟单局、把边界压到 1–3 分钟。八行状态表在第一轮审稿后删去：它讲的是设计状态而不是 PASS，且对没玩过的人不可读。
   节选惯例：中文文档在中文 README 原样引用，在英文 README 译出并标 translated；英文文档反之，标（译）；JSON 两边都原样；省略以「…」标出；表格注明原表行数与节选行数。三个小节各对应一个示例，顺序与「在线试玩」一致，满足 `validate_repo.py` 对示例链接顺序的检查。
3. **新增「常见问题」九条**，答案压到读者实际问的那件事加一条树内链接：互动叙事变成卡牌回合（#17 → `narrative-led`）、完整跑一次要多久花多少（如实写「示例进度文件没有记录耗时和 token 数，不给具体数字」）、中断后 `resume`、引擎由简报锁定且不退回网页（补一句「目前没有任何公开示例面向原生引擎或主机」）、GPU / 图片 / 语音谁出钱（金瓶梅 41 张图由 Codex 内置图像工具生成，`generated-art.json` 有记录）、怎么知道做出来的游戏真的能跑、原文与产物语言、没有版权的小说、只要设计文档。`quick` / `director` 的解释只留在「第一条请求」末尾一处；「能否在 Codex / Kimi 用」与安装表完全重复，不进 FAQ。
4. 安装段前补前提（已在用三种 CLI 之一、终端能跑 `npx`）和「升级时再跑一遍同一条命令，或运行 `npx skills update`」，安装表本身不动；表后加一条引用块说明仓库已从 `worldwonderer` 迁到 `zenstory-ai`、旧命令失效——这是 CHANGELOG 0.3.1 已记录的事实。不手写「最新版本 vX.Y.Z」：Release 徽章是实时的。「Kimi Code 0.27 或更高版本」这一标题保留原文：树内没有证据，但本机 Kimi Code CLI 正是 0.27.0，官方文档记录了 `/plugins install <GitHub URL>` 与 `/reload` 的用法；审稿 agent 用 GitHub 上 `MoonshotAI/kimi-cli`（1.x，`kimi migrate` 命令称之为 legacy）的 CHANGELOG 断言 0.27 不成立，是把两条产品线混为一谈。
5. masthead 导航的两个正文锚点改为「安装 · 看看它的输出」（原为「在线试玩 · 快速开始」）：在线试玩就在 masthead 下方一屏，不需要锚点；安装是读者第二个要找的东西；「看看它的输出」是这次的新内容。三个「查看改编案例」链接改名「改编工作区」，因为 `examples/<slug>/` 下没有 README，链接落在目录列表上，「案例」是名不副实的承诺。「参与贡献」段补 Issues 表单入口与 contrib.rocks 贡献者图。西游记英文卡片补上「排阵型」（中文原有、英文缺失的动词）；Plateau 卡片的「1–3 分钟」与另两张一样标「设计估时」。
6. README_ZH 逐段同步，顶部加 `<!-- Last synced with README.md: 2026-09-18 -->`。两份文件各 32 个二至四级标题、40 个代码围栏，示例链接顺序一致；中文示例请求的第一条改成与英文同义（「请根据原著推荐……走一条穿过原作冲突的新路线」）。

## Alternatives considered

- **像 oh-story 那样在顶部放一段真实录屏**。最强理由：视频比截图更能在十秒内说明项目。被否：本仓库的真实产出就是三款能玩的游戏，「在线试玩」已经在首屏，比终端录屏更直接；完整跑一次流程要数小时，录屏与 demo 同步是另一项工作。Plateau 的 15 秒实机预览保留在原位。
- **只加 FAQ，不加产出节选**。最强理由：FAQ 直接回答 #17，节选让 README 从 232 行涨到 400 多行。被否：两个姊妹仓库的效果正来自用真实文件替换说明文字；行数增长集中在代码块，正文散文反而比原来短。
- **为三个示例各写一份 README 作为「案例」落地页**。最强理由：「查看改编案例」链接就能名副其实。被否：三份新文件、每份都要遵守示例自身的语言声明，超出这次 README 改动的范围；先把链接名改成与实际一致，落地页留作后续。审稿 agent 建议至少把 Plateau 的链接指到 `_progress.md`（英文、19 行）：未采纳，三张卡片的链接形态应一致。
- **把「看看它的输出」做成六段完整版**。被否：drama-skills 的维护者已经把同类段落压成三个短小节，理由是对初学者太重；本仓库直接按三段写，并在第一轮审稿后再删掉两个最弱的节选（概念里的扇子要点与 GAME_DESIGN 表重复；Plateau 状态表离题）。
- **导航保留三个正文锚点（在线试玩 · 安装 · 看看它的输出）**。最强理由：安装与第一条请求现在离顶部更远。被否：#59 定下的 masthead 是「项目主页 · 两个正文锚点 · 另一种语言」，六个仓库一致；改成「安装 · 看看它的输出」既守住格式又让安装一键可达。

## Consequences

- 收益：读者不用装就能看到原著的一条规则怎样穿过五份文档、一个选择怎样被后文回读、一份 QA 记录怎样写明自己没测什么；#17 那类问题在 README 有了带出处的答案；中英两份内容一致。
- 代价：README 英文 232→420 行、中文 231→421 行；节选引用了示例文件的具体内容，示例改写时要跟着改（`validate_repo.py` 不检查节选是否仍与来源一致）。
- 未做：没有给示例目录补 README；没有录制流程视频；没有为 README 新增测试；「跑多久、花多少」只能如实说没有记录。

## Verification

- `python3 scripts/validate_repo.py` 通过（7 skills）；`python3 -m unittest discover -s tests` 11 项通过。
- 两份 README 各 42 个本地链接逐一解析到存在的文件；页内锚点 `#install` / `#see-what-it-produces` 与 `#安装` / `#看看它的输出` 各对应实际标题（GitHub 的 `/markdown` 接口不输出标题 id，slug 按 GitHub 规则手工核对，推送后再点一次）；新增外链 contrib.rocks 200、Discussion #17 200、Releases 200、Issues 表单入口对匿名请求 302 转登录；既有外链除 linux.do 反爬 403 外全部 200，Plateau 视频资产匿名 302。
- 中英结构对照：32 个标题、40 个代码围栏、示例链接顺序（journey-to-the-west → jin-ping-mei → project-plateau）一致；#58 决策记录列出的禁用短语 grep 为空。
- 节选逐字比对（脚本）：中文 README 里全部非「（译）」节选、两份 README 里的三段 JSON，逐行按顺序在来源文件中找到；`checks` 六键恢复逐键一行后与 `verification.json` 逐行一致。
- 两份 README 经 GitHub `/markdown` 接口渲染：代码围栏成对，围栏内表格按字面显示，围栏外 3 张表格、`<details>` 块与 user-attachments 视频嵌入正常。
- 第一轮独立对抗核对 7 个 agent（逐字节选、中译英、英译中、事实主张、中英对照、读者视角、渲染与决定反驳），报出 15 个 blocker、36 个 should_fix、36 个 nit。blocker 去重后是四处：西游记事实表原表行数写成 8（实为 11）；Plateau 状态表「bracing」误译成「据枪」；BUILD_BRIEF「rights clearance」误译成「权利清晰」（应为「已清权」）；金瓶梅 GAME_DESIGN 那条英译漏了末句且未标「…」。should_fix 采纳的：删未定义术语（owner / intake / limitation / 白盒 / 简报）、补「跑多久花多少」与「没有原生引擎示例」两处如实说明、`SOURCE_BIBLE` 只承诺硬规则等带章回、`director`「选定后不再停靠」改回原文语义、金瓶梅 41 张图的出处说法只指金瓶梅、白盒「在完整美术生产前」而非「任何美术之前」、Plateau 三方向点名、删两个最弱节选、FAQ 去掉与安装表和「第一条请求」重复的两条、导航加回安装、语音要点回到首屏、`npx skills update`。未采纳的：给 Plateau 单独指向 `_progress.md`（见上）；删除 `Last synced` 注释（与两个姊妹仓库保持一致）；压缩 ZenStory 项目表（组织级约定）；把「Kimi Code 0.27」改成 1.25（审稿混淆了产品线，见 Decision 第 4 条）。
- 第二轮独立核对 4 个 agent（改动段落的节选保真、新主张反驳、中英对照、读者复读）：4 个 blocker、10 个 should_fix、20 个 nit。blocker：语音要点写成「只在构建期生成」，而 `tts-production-contract.md:7` 允许简报批准的运行时合成，改为「默认在构建期生成」；中文第一条示例请求上一轮漏改，与英文不同义，已改；Plateau 概念节选静默截掉末句「`GAME_DESIGN.md` must define that causal chain…」，已补全（中文译出）。should_fix 全部采纳：简报「由你批准」在 `quick` 下过强，改为只在阻断项停靠；白盒「不带美术」改「不要求最终美术」；「跑多久」一条把「几次会话」改成「可能跨多次会话」并注明依据是金瓶梅进度文件的两个日期；金瓶梅支柱表中段省略补「…」；第二屏开头与首段重复的「七个 skills」句删去。nit 采纳：「avoid the characters」改「skip the character content」（原文「避开人物内容」）；B 方向注释去掉原文没有的「夜里」；「章回」补「或文件位置」（拆文库、写作工程也是合法来源）；`resume` 答案去掉「两项完成检查」「第二份状态表」这类内部词；`director` 补「已明确选定方向时不再停靠」；BUILD_BRIEF 节选起于句中，前置「…」；「rendered a changing frame」补「non-empty」；两处「(Chinese)」改「(both in Chinese)」；首段「are open in a browser」改「play in a browser」；「writes both records」改成写明是输入轨迹与 `qa/verification.json`；「the pet」改「your companion beast」。未采纳：把「可玩构建」写成「达到简报所锁成色的可玩游戏（三个示例都选了 playable-prototype）」——首段改为「达到你所要求成色的可玩构建」已足够。修完后重跑上述全部机械检查：验证器与 11 项测试通过，42 个本地链接与 4 个页内锚点解析，中英各 32 个标题、40 个代码围栏，节选逐字比对 0 处不一致，GitHub 渲染正常。
