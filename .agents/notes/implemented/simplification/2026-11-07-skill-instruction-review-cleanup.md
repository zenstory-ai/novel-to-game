# Agent Note: 四轮全量审查并清理 skills 中的面向人类/培训指令、低频场景、空泛套话与残留重复

Status: implemented

## Problem

在 [2026-10-20-skill-intra-duplication-cleanup.md](2026-10-20-skill-intra-duplication-cleanup.md) 与 [2026-11-05-skill-and-example-prose-polish.md](2026-11-05-skill-and-example-prose-polish.md) 完成句法润色后，对 `skills/` 全部 31 份文件（7 份 `SKILL.md`、17 份 `references/*.md`、7 份 `agents/openai.yaml`）连续执行四轮逐行审查与两轮质量防回退复核，发现三类深层结构性冗余：

- **面向人类/培训的指令与已退役的单项目低频设定贯穿全管线。**
  - **面向人类或培训教材的表述**：`novel-to-game`（`SKILL.md` 与 `pipeline-contract.md`）要求 Agent 在会话中“请用户邀一位目标玩家上手试玩，观察并记录其停顿、误点与跳过”；`game-build/SKILL.md` 要求“吃透开发者演讲、技术复盘与底层原理”；`generative-media-pipeline.md` 要求生成音频“最终以人耳试听为准”；`interactive-film-method.md` 列出 6 部商业影游作品作为参考书单；`concept-method.md`、`art-direction-method.md`、`cutscene-production.md` 与 `test-design-method.md` 含有面向新人的教学导语与事后穿帮讲义。
  - **已退役或单次项目的低频特设机制**：PR #38（`dabdb36`）为已退役的 2026 年 8 月旧版《金瓶梅》20 日账本引擎专门引入的 `signature_command`（`id / label / intents / slots / validators / commit`）、丫鬟跑腿代办（“发号施令、委托与代办”“下令不等于办成”）、延期发作回响与实时 LLM 自由聊天，散落在全部 7 个 skill 的 11 份文件中；此外还有 v0.2 已废弃的原著哈希/字节数反例、银杏树 UV 与顶点色风摆权重、模糊测试与线上局部热修 Patch 事件日志迁移、五行属性图标特例等单次补丁遗留。
- **模糊、大差不差、无决策指导意义的套话。** 如“不预先偏置任何单一游戏类型”“不按字数或形式主义打分评判文档，只看内容是否扎实可用”“不替实现层做无意义的微操，但要把体验底线焊死”“用行业通用术语沟通”“代码能跑不等于游戏可玩，按钮能点也不等于核心体验成立”等口号与修辞铺垫，不改变前沿模型的任何输出决策。
- **尚未删净的 skill 内部与跨参考文件重复。**
  - 各 `SKILL.md` 的「默认策略 / 输入 / 职责边界 / 流程 / 完成检查」反复重述同一份上游文档名单、只读边界与下游归属；
  - `novel-to-game` 的 `intake-method.md` 与 `pipeline-contract.md` 重复 `targetRuntime / testedRuntime` 与 `game-build` / `game-qa` 的内部证据分工；
  - `novel-game-analyze` 的 `SKILL.md` 与 `gameability-protocol.md` 多次重复原文位置引用、改编边界四标签，且在逐章取证表之后又在分层汇总重复“1. 章节层”；
  - `game-world-design` 的 `narrative-design-method.md`、`numeric-design-method.md` 末尾「交付检查」完全复述正文的规则条目，且 `interactive-film-method.md` 第一条与第三条重复定义过场的“起 → 承转动作 → 末帧定格”；
  - `game-art-direction` 的 `SKILL.md` 与 `art-direction-method.md` 重复视口可读性检查、视觉目标包隔离废稿规则与必需/可降级资产分类；
  - `game-build` 的 `SKILL.md`、`baked-sprite-workflow.md`、`generative-media-pipeline.md` 与 `tts-production-contract.md` 多处重复成品落盘到工作区（禁拿云端任务链接充当资产）、禁传无关原著全文与 API 密钥隔离；
  - `game-qa` 的 `SKILL.md`、`qa-contract.md` 与 `test-design-method.md` 重复六项闭环定义、证据分层与正向/反例/回归断言规则。

## Decision

- **清退全部面向人类/培训的指令与单项目低频机制。**
  - 将 `novel-to-game` 白盒试玩改为“另起一个未读过设计文档与源码的独立 Agent 会话仅凭画面和正常输入试玩”；删去开发者演讲学习、人耳试听、商业影游书单与教学讲义式铺垫；将 `cutscene-production.md` 的穿帮排查讲义直接前置为提示词硬约束（纯背景空镜防双胞胎重影、具体眉眼动作禁字面颜色词防变色、核心器物写明形制材质）。
  - 从全部 7 个 skill 主干清退 `signature_command` 与跑腿代办特例，仅在按需读取的 `playable-model-contract.md` 保留「生成模型与规则的边界」及延期发作事项的数据结构。
  - 删去 v0.2 哈希/字节数否定句、银杏树风摆顶点色、模糊测试与局部热修 Patch 迁移，并将五行属性、右置小地图、刷怪点、`「她记下了」`、`「先看清脸色再开口」` 等单项目字面词泛化为通用规则。
- **砍掉全部空泛口号与常识性套话，同时逐条对照历史盲评 A/B、场景测试与 `git diff HEAD` 做两轮防回退复核。**
  - 对照 [2026-10-02-genre-shell-and-first-minute.md](../feature/2026-10-02-genre-shell-and-first-minute.md)、`537a46d`（#64）、[2026-10-19-budget-rescope-and-whitebox-fun-check.md](../process/2026-10-19-budget-rescope-and-whitebox-fun-check.md)、[2026-11-01-stage-boundaries-and-evidence-reuse.md](2026-11-01-stage-boundaries-and-evidence-reuse.md)、[2026-11-01-overworld-grounding.md](../feature/2026-11-01-overworld-grounding.md)、[2026-11-01-illustrated-ui-and-text-density.md](../feature/2026-11-01-illustrated-ui-and-text-density.md)、[2026-11-01-unified-game-panels.md](../feature/2026-11-01-unified-game-panels.md)、[2026-11-02-readable-shared-map-geometry.md](../architecture/2026-11-02-readable-shared-map-geometry.md)、[2026-11-03-battle-dialogue-feedback.md](../feature/2026-11-03-battle-dialogue-feedback.md) 与 [2026-11-04-interactive-film-skill-guidance.md](../architecture/2026-11-04-interactive-film-skill-guidance.md)，完整保留全部承重锚点与防失真护栏：
    1. `concept-method.md` 与 `world-design-method.md` 各自独立保有一致的四项品类基础外壳定义，且明确保留“不得拿‘不改变核心决策’为由裁剪外壳；无需为外壳另写复杂规则，只需把通关路径经过的外壳操作写进可执行切片合同”；
    2. `world-design-method.md` 保有 #64 盲评验证不可删的三处防膨胀边界，并在 `numeric-design-method.md` 保留“具体历史优先用布尔/枚举记录事件本身、不默认折算成笼统好感总分”及“单线推进、不可再生资源或纯统计数字并非设计缺陷”，在 `narrative-design-method.md` 保留“不必给每场戏硬套统一字段模板或固定台词字数”及正反向路径走读；
    3. `art-direction-method.md` 保有“应当一眼像该品类的成熟游戏，而不像粗糙的技术演示”对比锚点、DPR 底图分辨率规则、完整场景目标图校准剪纸感物件、按队伍成员与操作层级分块排布面板、文字主导作品守住文学质感（精简界面废话不等于一刀切掉精彩剧情和核心规则）、克制关系局部图标加短签，以及互动影游口型/音色代表片测试与纯字幕回落规范；
    4. `interactive-film-method.md` 与 `cutscene-production.md` 保留窗口宽高比变化时热区随底图坐标同步换算（禁按屏幕绝对像素写死）、口型音色测试回落、有效提示词跨片段同步更新及相邻字幕阅读时间间隔；
    5. `gameability-protocol.md` 保留逐章取证表的「节奏与感受」行（与 `SOURCE_BIBLE.md` 全书覆盖要求对齐）、已有拆文资料完全覆盖方可复用的前置条件，以及“原著由秘密/谎言推动时才梳理知情范围与伏笔回收，无此类结构不硬凑表格”；
    6. `game-build` 明确区分“构建期生成的成品资产必须落盘工作区”与 `tts-production-contract.md` 中“已批准的运行时实时合成语音”，保留 `NOT_AVAILABLE: 原因` 版本号防臆测、白盒占位图阶段标注、`playable-model-contract.md` 的三层知情模型、表现层只读不反向改因果及在线模型自由措辞不参与权威状态比对；
    7. `game-qa` 在 `SKILL.md` 直接点明六项门禁键名与 `completeRun` 单次完整运行要求，并在 `test-design-method.md` 保留生成式叙事四类反例断言（篡改原著事实、违背在场承诺、私自改写已提交行动、向不在场角色泄密）及地图重绘后旧档遗留坐标实体交互核验。
- **彻底收束 skill 内部与参考文件间的重复。**
  - 每条规则在所属 skill 内只出现一次；合并 `intake-method.md` 产品框架表为紧凑 8 行；严格保留 6 份下游 `SKILL.md` 的 `OUTPUT_LANGUAGE_RULE` 原文、全部中文小节标题、双语 frontmatter 与 `agents/openai.yaml`、6 键 `qa/verification.json` 合同，以及 24 份文件的完整路径。
- **同步更新 `.clawhub/publish.json`。** 7 个 skill 补丁版本号各升一档并重新锁定 `packageDigest`。

## Alternatives considered

- **不对照历史盲评 A/B 与逐行 diff 记录，无差别压到最低行数（570 行）** — 最强理由：再多省 15 行。否决原因：两轮质量复核发现，过度压缩会漏掉 `gameability-protocol.md` 逐章「节奏与感受」字段、`numeric-design-method.md`“不把具体承诺折算为笼统好感分”、`art-direction-method.md` 文字主导作品文学质感保护与 DPR 底图清晰度、`interactive-film-method.md` 热区相对坐标换算与口型回落、`playable-model-contract.md` 三层知情模型与自由措辞豁免等关键防失真护栏；恢复这 15 行承重锚点（定格在 585 行）可在减重 41.1% 的同时确保零质量损伤。
- **直接删除 `playable-model-contract.md`、`baked-sprite-workflow.md` 或 `blender-asset-workflow.md` 等按需参考文件** — 最强理由：减少 `skills/` 下的文件数量。否决原因：`README.md`、`README_ZH.md` 与架构文档明确列出了 7 个 skill 及其 17 份按需参考文件；保留文件并将按需合同压缩到 7–15 行的精炼硬约束，既不污染常规上下文，又保持仓库公开目录结构稳定。

## Consequences

- 收益：经过四轮清理与两轮质量防回退复核，`skills/` 全部 24 份 Markdown 文件从 **994 行**精简至 **585 行**（净减 **409 行 / -41.1%**，较 1300 行预算上限缩减 **55.0%**），彻底清除了面向人类/培训的指令、单项目遗留设定、空泛套话与内部重复，同时 100% 守住历史盲评 A/B、场景测试与实机审计沉淀的全部承重质量规则。
- 代价：7 个 skill 的打包摘要变更，需同步更新 `.clawhub/publish.json` 的版本号与 `packageDigest`。

## Verification

- `python3 scripts/validate_repo.py`
- `python3 -m unittest discover -s tests -v`
- `python3 /Users/pite/makemoney/zenstory-ai-dotgithub/scripts/clawhub_release.py validate --manifest .clawhub/publish.json --repo-root . --base-ref "$(git rev-parse HEAD)"`
