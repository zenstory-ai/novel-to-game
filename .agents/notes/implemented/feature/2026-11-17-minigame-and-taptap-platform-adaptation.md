# Agent Note: 支持微信小游戏、抖音小游戏与 TapTap 平台适配，并补齐视觉与交互去 AI 味检查

Status: implemented

## Problem

越来越多用户希望把小说改编游戏发布到微信小游戏、抖音小游戏与 TapTap（含 TapTap H5 小游戏及 Android/PC 客户端包）并接入激励广告或试玩买断变现，同时玩家对廉价生成痕迹（AI slop）极为敏感。既有五项技能在三处存在缺口：

1. **需求确认未区分包形式、版号资质边界与本地替代测试环境**：`novel-to-game` 原先只笼统锁定平台与运行时。面对「做成微信/抖音小游戏」或「上 TapTap」，既未区分无 DOM 单画布小游戏包、TapTap `≤ 20 MB` H5 `.zip`（要求根目录 `index.html` 且包内路径仅限 ASCII 字符）与客户端包，也未写明国内无版号主体只能走纯广告或免费试玩、不得开内购；本机缺少已登录的官方实机预览工具时，`game-build` 要么停工，要么误建成普通 DOM 网页，导入小游戏工具即因缺少 `document` 报错。
2. **策划与美术缺少短局节奏、广告不伤主线因果、右上角胶囊避让及界面时代感约束**：`concept-method.md` 原先一律把广告与计费列为舍弃项，与用户明确要求的激励提示或序章试玩买断冲突；同时缺少微信/抖音右上角固定胶囊按钮（`getMenuButtonBoundingClientRect()`）避让区、抖音审核必查的「侧边栏复访」三步流程、围绕 `4 MB` 主包上限拆分首包与分包资产的要求，以及针对深蓝紫青霓虹毛玻璃悬浮卡、同屏画风割裂与「精修封面配简陋实机」的禁令。
3. **构建与盲玩缺少包体与平台细节校验、生图穿帮拦截及假选项清理**：主包超 `4 MB`、微信 `subpackages` 与抖音 `subPackages` 混写、TapTap 漏接「先 TapTap 登录取 `userIdentifier` 再跑防沉迷拦截」、抖音侧边栏漏检 `getLaunchOptionsSync()` 冷启动、激励视频中途关闭卡死，以及生图带灰白棋盘格假透明底、多指畸变、牌匾书卷乱码字、假选项充数、结算卡残留套话，都是实机差评和审核打回的高发问题。

## Decision

1. **整理七类市场案例、开源适配栈与去 AI 味依据至 `docs/research/minigame-and-taptap-cases.md`**：涵盖民俗/历史推理解谜（《纸嫁衣》《山河旅探》）、桌面卡牌限时生死局（《苏丹的游戏》《王权》《堆叠大陆》）、竖屏短局肉鸽三选一（《向僵尸开炮》及 `nick938/wechat-miniGame`、`IcedSoul/minigame-everyday`）、高频寻宝与修仙成长（《道友来挖宝》及 `ChurchTao/Daoyou`、`setube/vue-xiuxiangame` 的画布与 DOM 架构边界）、词条抽选与判词卡（`VickScarlet/lifeRestart`）、短视频挂载反常悬念（《隐秘的档案》《沙威玛传奇》）及买断制视觉小说/互动影游（《饿殍：明末千里行》《烟火》《飞越13号房》《盛世天下》），把可核验的仓库/官方文档事实与社区个人收入晒单分开陈述。
2. **在 `novel-to-game` 需求确认阶段锁清包形式、变现边界与共用画布调试页**：`PRODUCT_BRIEF.md` 锁定包形式与体积上限、变现方式（免费、激励广告或试玩买断/内购；国内无版号主体只走纯广告或免费，不开内购；存在分岔时停下请用户拍板），并在本机无可用官方工具时写明是否允许用共用画布入口的本地浏览器调试页作 `testedRuntime`。
3. **在 `game-design` 补齐小游戏、TapTap 与视觉/分支去 AI 味规范**：
   - `concept-method.md` 改为舍弃「简报未要求的广告与计费」，补充微信/抖音 1–3 分钟短局快入戏加一屏结算卡、激励广告只给重来/提示/体力/番外而不锁死原著主线真相、TapTap 优先机制咬合与无弹窗广告的选型判断，并禁拆毫无后果的假选项。
   - `SKILL.md` 与 `world-design-method.md` 要求小游戏前 30 秒进入首个冲突或抉择，写明激励广告、试玩解锁与抖音侧边栏复访的触发位置与奖励上限，拉起失败或中途关闭时直接回到刚才的选择点；带文字交代的限时抉择留足读字时间，按住或连点从首次按下起算计时。
   - `SKILL.md` 与 `art-direction-method.md` 要求界面底纹、边框与字形取材自作品时代器物，古风、民俗与写实题材禁用深蓝紫青霓虹渐变、毛玻璃圆角悬浮卡及整屏泛黄滤镜，统一同屏画风并对齐封面与实机水准，避让右上角胶囊与异形屏安全区，拆分首包与分包资产。
4. **在 `game-build` 新增按需参考 `references/minigame-and-taptap.md`，强化生图与文案审校，并同步 `game-qa`**：
   - 仅在目标为微信小游戏、抖音小游戏或 TapTap 时加载 `minigame-and-taptap.md`，规定无 DOM 单画布目录结构、TapTap H5 `.zip ≤ 20 MB`（根含 `index.html` 且路径仅限 `[A-Za-z0-9_.-]`）及全端先 TapTap 登录再防沉迷合规要求、微信 `subpackages`（主包与独立分包各 `≤ 4 MB`、合计 `≤ 30 MB`）与抖音 `subPackages`（主包 `≤ 4 MB`、合计 `≤ 20 MB`）分平台生成与磁盘体积实测、单层平台接口封装（微信优先 `wx.getWindowInfo()`）、右上角胶囊避让、抖音侧边栏复访三步审核流（`checkScene` 不支持即隐藏、`getLaunchOptionsSync` 与 `onShow` 双端检测 `sidebar_card`、「去侧边栏 / 领取奖励」双态按钮）、激励视频 `isEnded` 判定，以及探测 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 等本机应用目录 CLI 与共用画布调试页（`createImage` 禁包 `Proxy`）。
   - `game-build/SKILL.md` 要求生图与三维资产入包前逐件剔除灰白棋盘格假透明底、白边锯齿、多指与五官畸变、牌匾书卷乱码字及跨时代服饰；`player-copy-polish.md` 将审校扩至结算卡、分享语与提示弹窗，清理套话复述、二元对比套句、常见套话、跨时代热梗、假选项与选项上的「【看广告稳过】」等场外批注。
   - `game-qa` 在首轮盲玩与 `qa-contract.md` 中核查假分支、生图穿帮、科技毛玻璃违和面板、胶囊遮挡、双视口缩放、广告中断与侧边栏冷/热回访领奖，并将真机预览、真实 SDK 与软著/备案/版号如实记入 `limitations`。
   - 为容纳新增的按需平台参考与去 AI 味检查且不删减 [frontier-model-skill-slimming](../simplification/2026-11-14-frontier-model-skill-slimming.md) 已验证的既有规则，将 `scripts/validate_repo.py` 的 `SKILL_TOTAL_CHAR_BUDGET` 从 `26000` 上调至 `28000`（单份 `SKILL.md ≤ 3600` 与单份 `reference ≤ 2000` 上限不变）。

## Alternatives considered

- **单独新建第六个 `minigame-publish` skill** — 最强理由：把所有小游戏与 TapTap 细节隔离在一个新包里。否决原因：体积上限、短局节奏、胶囊避让、无 DOM 构建和盲玩遮挡检查分别归属需求、策划、美术、构建与验收五个阶段；事后挂第六个 skill 会让前序阶段先做出 DOM 网页、40 MB 单包或右上角按钮，只能推倒重来。
- **把微信/抖音/TapTap 规范直接塞进 `game-build/SKILL.md` 正文** — 最强理由：少一份参考文件。否决原因：纯网页或桌面单机项目每次都会白白读取近两千字的平台接口细则，违背 `AGENTS.md`「`SKILL.md` 保持精简、可选深度放入一级 `references/`」的原则。
- **无可用真机预览工具时直接输出普通 HTML/DOM 网页代替** — 最强理由：浏览器直接能跑。否决原因：微信与抖音小游戏没有 DOM/CSS，普通网页导入官方工具立即崩溃；交付真实无 DOM 小游戏包并配共用画布入口的浏览器调试页，既不拿网页冒充目标平台，又能在本地完成灰盒与盲玩。

## Consequences

- 收益：面向微信小游戏、抖音小游戏与 TapTap 开发时，从简报锁定、短局与变现边界、胶囊避让与分包规划，到无 DOM 包构建、生图与文案去 AI 味及本地调试页盲玩全部衔接顺畅；非小游戏项目同样受益于生图穿帮核验、界面材质时代感与假选项清理。
- 代价：`skills/` 总字符数由 `24,262` 增至 `27,701`（低于 `28,000` 上限，且常规非小游戏项目不加载 `minigame-and-taptap.md`）；扫码登录后的真机预览上传、真实广告/TapSDK 联调与软著、备案、版号仍需开发者在仓库外完成。

## Verification

- `python3 scripts/validate_repo.py`（5 skills 通过，单文件与总字符预算全部合规）
- `python3 -m unittest discover -s tests -v`（17 项测试全部通过，含仓库全量校验与文档相对链接存在性断言）
- ClawHub 清单离线锁更新与校验通过（`game-build@1.7.0`、`game-design@1.2.0`、`game-qa@1.3.0`、`novel-to-game@1.4.0`）
- 在已忽略的本地实验目录用《聊斋志异·画皮》构建无 DOM 单画布小游戏原型，通过本机 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 实测 `open` 与 `auto`（`touristappid` 未登录态可正常识别并打开 `"compileType": "game"` 工程，真机 `preview` 因无正式小游戏 AppID 权限报 `pages is not iterable`），并跑过独立子会话灰盒盲玩（实验目录不纳入提交），据此校准了应用目录 CLI 探测、分平台生成 `game.json`、画布 `measureText` 防撞字、`createImage` 禁包 `Proxy` 及限时/连点从首次按下起算计时等细则。
