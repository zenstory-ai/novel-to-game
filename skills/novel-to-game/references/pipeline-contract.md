# 流程契约

## 最小工作区

```text
game-adaptations/{project}/
├── PRODUCT_BRIEF.md
├── analysis/
│   ├── SOURCE_BIBLE.md
│   └── _coverage.md
├── concepts/CONCEPT.md
├── design/
│   ├── GAME_DESIGN.md
│   ├── ART_DIRECTION.md
│   ├── VISUAL_TARGETS.md
│   └── visual-targets/
├── build/
│   ├── BUILD_BRIEF.md
│   └── app/
├── qa/
│   ├── QA_REPORT.md
│   ├── release-gates.json
│   └── evidence/
└── _progress.md
```

不要提前创建空文件。`_progress.md` 记录：来源、模式（只取 `quick` / `director` / `resume`）、
选择的概念、当前/已完成阶段、`gate:` 结果行、回流记录（原因与修订文件）、阻塞证据和更新
时间。阶段字段与 `gate:` 行共用同一词表：`intake` / `analyze` / `concept` / `design` / `art` /
`build` / `qa`，整条流程完成记 `done`；打磨、玩家测试轮次等自由备注另起「备注」行，不占
阶段字段。分析批次状态（边界表、每批成功/失败计数）不写入 `_progress.md`，由拆解阶段存于
自含的 `analysis/_coverage.md`，`_progress.md` 只记一行指针（路径 + 来源 N / 成功 N / 失败 N）。

`resume` 三步：读 `_progress.md` → 按交接门表逐阶段核对实际产物（含 `gate:` 行）→ 回到
最早未过门的阶段续跑。

全部阶段状态只取 `NOT_RUN` / `FAIL` / `PASS`。`NOT_RUN` 表示尚无证据，可以结束当前执行，
但不能满足声明等级；时间、预算或工具耗尽只触发延期、降低 publication tier 或保持未完成，
不得自动转换为 `PASS`。四级 `targetFinish` 由 `PRODUCT_BRIEF.md` 唯一锁定，严格矩阵如下：

| 等级 | 视觉缺口 | 必需通过项 |
|---|---|---|
| `graybox` | 唯一允许视觉 `NOT_RUN`、未关闭视觉 major 和灰盒资产的等级 | `grayboxReady: PASS`；只声明规则、范围和可达性 |
| `playable-prototype` | 不允许 blocker/major；焦点发布门禁资产不得为灰盒 | `visualPromotion: PASS`；`focalReleaseAssets` 全部通过；`degradableReleaseAssets` 逐项有不丢核心体验的有效 fallback；目标帧证据与必需独立视觉评审 `PASS` |
| `polished-vertical-slice` | 不允许 blocker/major、发布门禁灰盒或必需项 `NOT_RUN` | playable 全部条件 + 所有 release-gate 资产、全部目标帧、目标视口与性能 `PASS` |
| `showcase` | 与 polished 相同，且不允许发布事实不一致 | polished 全部条件 + 仓库发布清单和公开文案一致 |

等级顺序固定为 `graybox < playable-prototype < polished-vertical-slice < showcase`。`targetFinish`
是批准目标上限，`demonstratedTier` 是证据实际证明的等级，`publicationTier` 是对外声明等级，必须
满足 `publicationTier <= demonstratedTier <= targetFinish`；不得用降低公开措辞反向抬高证据等级。

`sourceFingerprint` 是当前候选的权威身份（对实际发布输入按稳定清单计算的 64 位小写 SHA-256 十六进制串），
commit 只作历史定位。工作区 / 构建输入已偏离该 commit 时，不得复用 commit ID 把旧 PASS 贴到
当前候选；公开托管 PASS 也必须记录相同 fingerprint，否则只能标“历史结果 / 非当前候选”。

## 最小交接门

下表是十一个产品维度的**唯一权威清单**；其他文件一律引用本表，不再另行枚举。

| 阶段 | 交接前必须成立 |
|---|---|
| `intake` 需求 | 十一个产品维度——①平台+性能预算+目标/最低分辨率+窗口/朝向+输入设备、②目标市场与界面语言、③游戏类型+对标（含 ≥2 款同玩法先例及共有的核心动词与循环结构）+ 空间形态（2D 界面 / 2D 空间 / 3D 空间；取 2D 界面须有用户显式确认与一句理由）、④美术画风+`targetFinish`+2–4 个逐项注明借鉴维度/来源/授权边界的视觉参照+3–5 条可否决反例+投入边界+未达目标处置、⑤内容分级/NSFW、⑥核心幻想、⑦单局时长与结构、⑧发行/商业化、⑨游戏引擎+目标交付运行时+可选替代验证运行时、⑩玩家结构+社交形态、⑪受众画像——各有取值；未定维度记 `N/A`，`N/A` 也是锁定值，下游不得自行补默认；用户确认或未确认假设已醒目记录；`PRODUCT_BRIEF.md` 存在 |
| `analyze` 拆解 | 全书/指定范围覆盖集合完整且无失败缺口；核心原作事实有证据，玩家动作、空间、角色和独特锚点明确；原文语言与策划语言或界面语言不同时，角色/地名/物件/规则四类统一术语表必须已在 SOURCE_BIBLE 产出，否则不过门 |
| `concept` 概念 | 三个方案真正不同，无硬否决，选择明确；选定方向已写明与哪 ≥2 款已发行游戏**同玩法**并逐条列出共有的核心动词与循环结构（各附一条可核实的“玩过的人很多”凭据），且三段弧三期齐全 |
| `design` 游戏设计 | 核心循环、世界响应、关卡节奏、范围和结果完整；三段弧逐期列出本期新增的可用动词与可达空间，并各带一个可观察的结束标记，任一格留空即未完成；核心幻想已写成玩家看得到的屏幕文本，不只是 brief 里的一行 |
| `art` 美术方向 | `ART_DIRECTION.md` 与 `VISUAL_TARGETS.md` 都逐字继承 `targetFinish`；视觉语言、可读反馈和每个交互界面 / 模式各有招牌时刻；非 graybox 还须有工作区内 `visual-targets/` 证据，至少覆盖标题/首屏、主要探索或核心循环、最高压力/结果三类目标视图，逐类含原创 style frame / 构图草图 / 批准 paint-over、具名量表、失败例、来源/生成方式/权利/路径及哈希。缺图时非 graybox 的 art 状态只能 `NOT_RUN`/`FAIL` |
| `build` 构建 | `targetFinish` 与 brief 一致；显式 `grayboxReady: PASS` 的核心循环、输入、结果、重开有证据；声明高于 graybox 时还须 `visualPromotion: PASS`，逐帧零 blocker/major、对应等级要求的 release-gate 资产 `releaseGatePassed: true` 且有真实证据、目标视口与性能预算按等级通过 |
| `qa` 质量验证 | `QA_REPORT.md` 与 `qa/release-gates.json` 都逐字继承 `targetFinish`；除 graybox 外零 `blocker`/`major`、必需项无 `NOT_RUN`，核心动作、结果、重开、逐帧视觉裁决、独立 reviewer 与发布资产有工作区证据；`focalReleaseAssets` 与 `degradableReleaseAssets` 互斥且并集覆盖 ledger 全部 release-gate 键，可降级项有结构化 fallback 与证据；release / public-host 证据绑定同一 `sourceFingerprint`；满足 `publicationTier <= demonstratedTier <= targetFinish` |

过门留痕由总入口（编排器）执行，不交给刚产出该文档的阶段自查：按上表核对该阶段行——
涉及名册的按名册逐项比对（见下）——结果一行记入 `_progress.md`：`gate:<阶段> pass` 或
`gate:<阶段> fail(一句原因)`；`NOT_RUN` 记作 `gate:<阶段> fail(NOT_RUN: 原因)`。阶段取上表词表；
未记 pass 不得进入下一阶段，fail 打回产出阶段。`grayboxReady: PASS` 不能为 playable 及以上生成
`gate:build pass`，QA 也不能用自动像素检查、总分或实现方自评替代独立视觉裁决。

多人、持久后端、资产流水线和额外章节，凡未在 `PRODUCT_BRIEF` 的玩家结构 / 社交形态里
显式确认过的，都属于新的范围决定，不得静默加入；已确认为核心幻想一部分的社交 / 联机，
其在切片里的真实范围或替代验证方式必须由 intake 锁定。替代验证不能证明联网体验已经交付。
`PRODUCT_BRIEF` 记录的
全部产品维度（含 `N/A`）都不是范围决定而是 intake 已锁定的产品事实，下游要改同样回
`PRODUCT_BRIEF.md` 显式改。

## 质量回流

QA 的 `blocker`/`major` 按 `QA_REPORT.md` 发现与回流表的归属阶段回流，不一律回构建打补丁：

- 归 `build`：调用 `game-build` 修复实现。
- 归 `design`：调用 `game-world-design` 修订 `GAME_DESIGN.md`（涉及视觉时连带修订
  `ART_DIRECTION.md`），再重建受影响部分并回归验证。
- 视觉发现按同一规则归属；若目标包或核心视觉原则本身不足，回 art/design，若实现偏离已批准
  目标则回 build。除 graybox 外，任一未关闭视觉 blocker/major 或必需独立视觉评审 `NOT_RUN`
  都阻止 `gate:qa pass`。
- **「没有可交付的游戏」类发现不进回环上限**：品类认不出、无弧线、前提未上屏——这三类
  说明的不是某处待打磨，而是这一版还不成立。它们不受设计回环一轮上限约束，也不得作为
  「未解决问题」上报了事：**停下来问用户**，带上裁决者的逐字回答与要改的那一层
  （概念 / 设计 / 构建），由用户决定改还是换方向。
- 归 `product`：产品框架本身错了，回 intake 显式修订 `PRODUCT_BRIEF.md`，再按交接门表
  向下重走受影响阶段。

设计与产品回环各最多一轮；一轮后仍未解决的，如实记录为未解决问题上报，不得为过门降低
判据，也不得由构建静默重设计。每次回环在 `_progress.md` 记回流记录（原因与修订文件）。

## 上游事实不得在下游静默改写

有两份上游事实：`PRODUCT_BRIEF.md`（intake 锁定的全部产品维度，清单以交接门表为唯一
权威）与 `SOURCE_BIBLE.md`（原作事实）。两者都常在下游被**悄悄替换成更好用的版本**。

`PRODUCT_BRIEF.md` 侧：说好的小程序做成了重端体量、说好的像素改成了写实3D、成人向被下游
悄悄收回全年龄、对标的那条原则实现时换成了另一款游戏的做法——每步看着合理，合起来就不是
用户点头的那个产品了。概念阶段的产品定义必须**继承** `PRODUCT_BRIEF`，不重猜；美术方向的
画风、构建的目标形态都按它来。

`SOURCE_BIBLE.md` 侧：标为不可变的原作事实（人物名册与次序、身份等级、既定结局、
世界规则），到了概念、设计、美术和构建阶段常会被替换：漏掉
一个不起眼但确有名分的角色、把没有名分的角色提进正式序列、把原著中固定的排序做成
每回合重算的动态数值。每一步看着都合理，合起来就不再是这本书了。

因此每道交接门都要**按名册逐项比对**，而不是只看新文档是否自洽：

- 上游列为不可变的角色是否**全部**出现在下游，身份与次序一致；
- 下游新增的角色是否在上游有依据，其身份是否被抬高；
- 上游写明"固定不变"的规则，下游有没有改成可变数值；
- 实现产物与策划文档冲突时，**先回上游查谁对**——实现有时反而更忠实，此时要改的
  是文档，不是代码。

这类偏移不会报错，只会在读过原著的人打开时暴露。

## 语言与文化契约

- 原文语言、策划产物语言、目标玩家市场、首发界面语言分别记录，不把四者混为一谈。
- 原文证据保留原语言；跨语言策划使用统一术语，不重复生成整套双语文档。
- 对标研究同时解释玩法可迁移性和文化适用性，不拿另一市场的成功直接证明本地接受度。
- 多语言界面属于明确的产品范围。构建说明列出支持语言，质量验证逐一检查文本完整、
  字体可显示、布局不溢出且关键玩法信息不因翻译丢失。
