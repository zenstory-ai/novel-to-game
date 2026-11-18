# Agent Note: 支持微信小游戏、抖音小游戏与 TapTap 制造（TapTap Maker）适配，并补齐去 AI 味检查

Status: implemented

## Problem

越来越多用户希望把小说改编游戏发布到微信小游戏、抖音小游戏与 **TapTap 制造（TapTap Maker，`maker.taptap.cn`）**，借助激励视频广告（其中 TapTap 制造实行平台 0 分成，广告收益全额归创作者）变现；同时玩家对廉价生成痕迹（AI slop）极为敏感。既有五项技能在三处存在缺口：

1. **需求确认未区分微信/抖音无 DOM 单画布沙盒与 TapTap 制造 UrhoX+Lua 工程的架构差异**：微信/抖音小游戏运行在无 DOM/CSS 的单画布 JavaScript 沙盒（`game.js` + `game.json`），而 **TapTap 制造**底层是自研 **UrhoX + Lua 5.4** 纯代码引擎（配 `@taptap/maker` CLI、Maker MCP 与工程内 `CLAUDE.md` / `urhox-libs/` / `engine-docs/` 文档），两者都不是普通 HTML/DOM 网页。若不在简报阶段锁清包形式、无版号禁内购边界、Maker 积分生成门禁与替代测试环境许可，极易拿普通网页冒充目标工程，导入目标环境根本无法运行。
2. **策划与美术缺少短局高重玩节奏、激励广告不伤主线因果、右上角胶囊避让及界面时代感约束**：`concept-method.md` 原先一律把广告与计费列为舍弃项，与用户明确要求的激励提示或 TapTap 制造 0 分成广告冲突；同时缺少微信/抖音右上角固定胶囊按钮（`getMenuButtonBoundingClientRect()`）避让区、抖音审核必查的「侧边栏复访」三步流程、围绕 `4 MB` 主包上限拆分首包与分包资产的要求，以及针对深蓝紫青霓虹毛玻璃悬浮卡、同屏画风割裂与「精修封面配简陋实机」的禁令。
3. **构建与盲玩缺少各平台专属校验、付费生成与云构建门禁及生图穿帮拦截**：TapTap 制造未读工程内 `CLAUDE.md` / `urhox-libs/` / `engine-docs/` 就网页搜索照搬微信或 H5 的 `tap.*` JavaScript 接口、手写 `.meta` UUID、未经授权扣积分调生成工具、在非 `main` 分支操作或把本地预览当远端 `push` 构建；微信 `subpackages` 与抖音 `subPackages` 混写、主包超 `4 MB`、抖音侧边栏漏检 `getLaunchOptionsSync()` 冷启动；以及生图带灰白棋盘格假透明底、多指畸变、牌匾书卷乱码字、假选项充数、结算卡残留套话，都是实机差评和审核打回的高发问题。

## Decision

1. **整理市场案例、开源工具链与去 AI 味依据至 `docs/research/minigame-and-taptap-cases.md`**：涵盖 **TapTap 制造（TapTap Maker）**短局模拟器与 0 分成激励广告闭环（《崇祯直聘：明末官场沉浮模拟器》《古玩人生》及 [`taptap/instant-games-open-mcp`](https://github.com/taptap/instant-games-open-mcp)、[`taptap/awesome-urhox-games`](https://github.com/taptap/awesome-urhox-games)、[`AndroidSix/TapMakerWork`](https://github.com/AndroidSix/TapMakerWork)）、词条抽选与判词卡（`VickScarlet/lifeRestart`）、民俗/历史推理解谜（《纸嫁衣》《山河旅探》）、桌面卡牌限时生死局（《苏丹的游戏》《王权》《堆叠大陆》）、竖屏短局肉鸽三选一（《向僵尸开炮》及 `nick938/wechat-miniGame`、`IcedSoul/minigame-everyday`）、高频寻宝与修仙成长（`ChurchTao/Daoyou`、`setube/vue-xiuxiangame`）及短视频挂载与分包影游（《隐秘的档案》《盛世天下》），分开陈述可核验的仓库/官方文档事实与社区收入个案。
2. **在 `novel-to-game` 需求确认阶段锁清目标包形式、变现边界、付费门禁与本地替代环境**：`PRODUCT_BRIEF.md` 锁定微信/抖音无 DOM 小游戏包或 TapTap 制造 UrhoX+Lua 工程、体积上限、变现方式（国内无版号主体只走纯广告或免费，不开内购）及付费服务授权（含 Maker 积分生成），并在本机缺少真机预览或本地 UrhoX Runtime 时写明是否允许批准的替代测试环境。
3. **在 `game-design` 补齐短局高重玩选型、胶囊避让与视觉/分支去 AI 味规范**：
   - `concept-method.md` 改为舍弃「简报未要求的广告与计费」，面向微信小游戏、抖音小游戏与 **TapTap 制造**优先选 1–3 分钟短局、高重玩且带一屏结算卡的方案，激励广告只用于失手重来、提示、体力或番外而不锁死原著真相，不在长剧情高潮硬插广告，并禁拆毫无后果的假选项。
   - `SKILL.md` 与 `world-design-method.md` 要求小游戏前 30 秒进入首个冲突或抉择，写明激励广告、试玩解锁与抖音侧边栏复访的触发位置与奖励上限，拉起失败或中途关闭时直接回到刚才的选择点；带文字交代的限时抉择留足读字时间，按住或连点从首次按下起算计时。
   - `SKILL.md` 与 `art-direction-method.md` 要求界面底纹、边框与字形取材自作品时代器物，古风、民俗与写实题材禁用深蓝紫青霓虹渐变、毛玻璃圆角悬浮卡及整屏泛黄滤镜，统一同屏画风并对齐封面与实机水准，避让右上角胶囊与异形屏安全区，拆分首包与分包资产。
4. **在 `game-build` 按技术栈拆分为两份按需参考，强化生图与文案审校，并同步 `game-qa`**：
   - `references/wechat-and-douyin-minigame.md`（仅微信/抖音小游戏加载）：规定无 DOM 单画布目录结构、个人开发者（微信 30 元认证、抖音个人实名入驻）零内购纯本地单机默认（免自购服务器与外部备案域名）、微信 `subpackages`（主包与独立分包各 `≤ 4 MB`、合计 `≤ 30 MB`）与抖音 `subPackages`（主包 `≤ 4 MB`、合计 `≤ 20 MB`）分平台生成与磁盘体积实测、单层平台接口封装（微信优先 `wx.getWindowInfo()`）、右上角胶囊避让、抖音侧边栏复访三步审核流、**首版未满 `500 UV` 空 `adUnitId` 自动收起广告文案防首审驳回开关**与激励视频 `isEnded` 判定，以及探测 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 与共用画布调试页（`createImage` 禁包 `Proxy`）。
   - `references/taptap-maker.md`（仅 TapTap 制造项目加载）：规定 UrhoX + Lua 5.4（`scripts/` 下 `main.lua` + `.ui.json` + 官方 24 位 UUID `.meta`）、`taptap-maker` CLI + Maker MCP + **工程内 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/` 为唯一 API 真相源（禁网页搜索照搬微信或 H5 的 `tap.*` JS 接口）**、`taptap-maker preview` 共享 UrhoX Runtime 与 `run-lua-validate` 验收（绝不自动触发 `push` 或云构建）、`--allow-paid` 积分授权门禁、远端仅收 `main` 分支与 `taptap-maker git sync` 冲突处理，以及 `get_ad_config` 同步 `@runtime.ad` + `sdk:ShowRewardVideoAd`（`result.success == true` 发奖）的 0 分成广告流程。
   - `game-build/SKILL.md` 要求生图与三维资产入包前逐件剔除灰白棋盘格假透明底、白边锯齿、多指与五官畸变、牌匾书卷乱码字及跨时代服饰；`player-copy-polish.md` 将审校扩至结算卡、分享语与提示弹窗。
   - `game-qa` 在盲玩与 `qa-contract.md` 中核查假分支、生图穿帮、科技毛玻璃违和面板、胶囊遮挡、广告中断与侧边栏回访，并将未执行的真机预览、本地 UrhoX Runtime、远端云构建、真实广告 SDK 与软著/备案/版号如实记入 `limitations`。
   - 为容纳两份按需平台参考（单次构建最多加载其中一份，常规网页/桌面项目均不加载）且不删减 [frontier-model-skill-slimming](../simplification/2026-11-14-frontier-model-skill-slimming.md) 已验证的既有规则，将 `scripts/validate_repo.py` 的 `SKILL_TOTAL_CHAR_BUDGET` 从 `26000` 上调至 `30000`（单份 `SKILL.md ≤ 3600` 与单份 `reference ≤ 2000` 上限不变）。

## Alternatives considered

- **同时混入传统 TapTap H5 `.zip` 与 Android/PC 客户端 TapSDK 打包规范** — 最强理由：覆盖整个 TapTap 生态。否决原因：用户明确聚焦 **TapTap 制造**这一 AI 原生即玩创作平台；把传统 H5 WebView `.zip` 与客户端 TapSDK 混在同一参考里既占用预算，又容易诱导模型把 H5 JavaScript `tap.*` 接口误写进 TapTap 制造的 UrhoX Lua 工程。
- **把微信/抖音小游戏与 TapTap 制造塞进同一份 2,000 字参考文件** — 最强理由：少一份文件。否决原因：前者是无 DOM JavaScript 画布沙盒，后者是 UrhoX + Lua + Maker MCP + `.meta` UUID 体系，拆成两份按需文件可让单次构建少读无关平台细节，并完整保留 `engine-docs/` 真相源与 `--allow-paid` 积分门禁等关键约束。
- **单独新建第六个平台发布 skill** — 最强理由：隔离平台细节。否决原因：包形式锁定、短局节奏、胶囊避让、引擎构建和盲玩验收分别归属现有五个阶段，事后补救会导致推倒重来。

## Consequences

- 收益：面向微信小游戏、抖音小游戏或 TapTap 制造开发时，从简报锁定、短局与 0 分成激励广告设计，到各自真实运行时构建验收均边界清晰、互不串台；非小游戏项目同样受益于生图穿帮核验与去套话审校。
- 代价：`skills/` 总字符数由 `24,262` 增至 `29,736`（低于 `30,000` 上限，且两份平台参考均为条件按需加载）；微信扫码真机上传、`taptap-maker` 账号绑定与远端云构建及资质备案仍需开发者在仓库外完成。

## Verification

- `python3 scripts/validate_repo.py`（5 skills 通过，单文件与总字符预算全部合规）
- `python3 -m unittest discover -s tests -v`（17 项测试全部通过，含仓库全量校验与文档相对链接存在性断言）
- ClawHub 清单离线锁更新与校验通过（`game-build@1.7.0`、`game-design@1.2.0`、`game-qa@1.3.0`、`novel-to-game@1.4.0`）
- 对照官方仓库 `taptap/instant-games-open-mcp`（`docs/MAKER.md`、`docs/MAKER_LOCAL_PREVIEW.md`、`docs/MAKER_RESOURCE_META_WORKFLOW.md`、`skills/taptap-maker-local`、`packages/dsh-maker/skills/taptap-ads`）与 `taptap/awesome-urhox-games` 逐项核实 UrhoX + Lua、`taptap-maker` CLI、Maker MCP 与 `sdk:ShowRewardVideoAd` 广告契约；并在本地忽略的实验目录用 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 验证微信小游戏工程打开与自动化端口行为。
