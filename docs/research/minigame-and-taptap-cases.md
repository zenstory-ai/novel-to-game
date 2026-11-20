# 微信小游戏、抖音小游戏与 TapTap 制造案例及去 AI 味依据 · 2026-11-18

本页梳理社区复盘、官方文档与 GitHub 开源仓库里关于微信小游戏、抖音小游戏与 **TapTap 制造（TapTap Maker）**的代表作品、变现边界、常见硬坑与清理「AI 味」的做法，说明哪些规则收进运行时技能、哪些留给开发者在仓库外完成。运行时构建规范分别见 [wechat-and-douyin-minigame.md](../../skills/game-build/references/wechat-and-douyin-minigame.md) 与 [taptap-maker.md](../../skills/game-build/references/taptap-maker.md)；常规构建不加载本页。

## 一、小游戏平台上跑通的七类小说改编玩法

### 1. TapTap 制造（TapTap Maker）短局事件模拟器与 0 分成激励广告

- **平台特点**：[**TapTap 制造**](https://maker.taptap.cn)（TapTap Maker）是心动 / TapTap 推出的对话与代码驱动的游戏创作及即玩平台，底层采用自研 **UrhoX 引擎 + Lua 5.4** 纯代码架构，由平台统一提供云存档、排行榜、联机与实名防沉迷服务，并打通小游戏**激励视频广告变现（平台 0 分成，广告收益 100% 归创作者）**，无版号的个人创作者即可直接上架获得收益。
- **热门题材与案例**：在 TapTap 制造与即玩榜单上，最贴合小说改编的作品多采用「强冲突开局 + 随机事件或肉鸽抉择 + 轻度数值养成」的短局模拟器形态，例如历史官场题材《崇祯直聘：明末官场沉浮模拟器》、《古玩人生》，以及重生、末世、开店、修仙等网文向生存经营模拟器。
- **变现与品类边界**：0 分成激励广告在节奏快、单局短、重玩性高的轻度策略与事件模拟器上转化顺畅；慢热的长篇纯文字跑团或沉浸式长叙事若在剧情高潮硬插广告会直接劝退玩家，广告入口应严格收束在失手重来、线索提示或番外解锁。

### 2. 天赋词条抽选 + 一屏命数判词卡

- **代表案例**：[`VickScarlet/lifeRestart`](https://github.com/VickScarlet/lifeRestart)（《人生重开模拟器》，及接入生成模型的社区衍生版 [`chnjames/life-restart-ai`](https://github.com/chnjames/life-restart-ai)）。
- **借鉴要点**：开局抽选互斥或联动词条 → 按岁数或回合推进条件事件 → 终局把整局关键因果凝成一张反差鲜明的命数判词卡。极轻包体即可跑通，结算卡天然适合转发到微信群、TapTap 社区或抖音评论区晒图。

### 3. 中式民俗/历史推理解谜 + 分档激励提示

- **代表案例**：《纸嫁衣》系列、《山河旅探》（奥秘之家）。
- **改编要点**：谜题直接长在原著礼俗、时代器物与证词漏洞里——如《纸嫁衣》借烧纸通阴阳、八字风水破机关，《山河旅探》靠清末民初现场勘验与证词指谬断案，不硬塞脱离背景的密码锁或滑块拼图。
- **变现与前车之鉴**：《纸嫁衣》小游戏版点开即玩，右上角设两档激励视频提示（「方向线索 → 完整解法或跳过繁琐小机关」），既救卡关流失又带来稳定收益；但后期续作因广告过密被玩家嘲为「广告模拟器」，宣传立绘与实机画面落差过大也拉低了口碑。

### 4. 桌面卡牌调度 + 倒计时生死局

- **代表案例**：《苏丹的游戏》、《王权》（Reigns）、《堆叠大陆》（Stacklands）。
- **改编要点**：朝堂权谋、末日求生、宗门经营或限期还债类小说，不必写成冗长的纯文字对话树。把随从、银两、证物、秘密与义务做成桌面实体卡牌，靠限时销卡（如《苏丹的游戏》限 7 日折断杀戮、奢靡、征服或纵欲卡）或四项指标此消彼长的左右抉择（《王权》），逼玩家在倒计时下调配人手并承担具体的伤痕与人情债。

### 5. 竖屏短局肉鸽三选一构筑

- **代表案例**：《向僵尸开炮》，以及开源微信小游戏 [`nick938/wechat-miniGame`](https://github.com/nick938/wechat-miniGame)（合成 + 塔防 + 肉鸽三选一 + 开放数据域好友排行）、[`IcedSoul/minigame-everyday`](https://github.com/IcedSoul/minigame-everyday)（用 Phaser 3 / Cocos Creator 复刻收纳解谜、路径解谜与塔防肉鸽的双端工程）。
- **改编要点**：玄幻斗法、渡劫守山、妖潮围城桥段适合拆成 **3–5 分钟一局**的竖屏防守或突围，把原著法宝、阵法、灵根相克做成局内能打出配合的技能三选一构筑，比单纯堆叠攻击力数字耐玩得多。

### 6. 高频寻宝/开箱短循环 + 境界成长

- **代表案例**：《寻道大千》、《道友来挖宝》，以及开源修仙项目 [`ChurchTao/Daoyou`](https://github.com/ChurchTao/Daoyou)（《万界道友》，TypeScript 水墨风，含境界、灵根、功法、命格、炼丹炼器与时间轴回合战，兼容微信小游戏与网页）、[`setube/vue-xiuxiangame`](https://github.com/setube/vue-xiuxiangame)（《我的文字修仙全靠刷》）。
- **借鉴与技术边界**：单机或轻量改编可借「一铲一揭示、见好就收或涉险深挖」的 2–4 分钟短循环（如本仓《西游记》示例的火脉残图），砍掉跨服充值榜。技术上要注意：`setube/vue-xiuxiangame` 依赖 Vue 与 Element Plus DOM 组件，无法直接跑在无 DOM 的微信/抖音小游戏沙盒或 UrhoX+Lua 的 TapTap 制造环境里。

### 7. 前 15 秒反常悬念 + 短视频挂载与分包影游

- **代表案例**：《隐秘的档案》、《文字来找茬》、《沙威玛传奇》、《盛世天下》（小程序与多端版），以及开源文游工具 [`Shanyin-ai/Story-to-game`](https://github.com/Shanyin-ai/Story-to-game)、[`meathill/mui-gamebook`](https://github.com/meathill/mui-gamebook)。
- **借鉴要点**：抖音「游戏发行人计划」与短视频左下角挂载靠开局 10–15 秒直接抛出反常画面与生死规矩（《隐秘的档案》）或手忙脚乱的翻车现场（《沙威玛传奇》），并在过关或翻车节点接入 `tt.getGameRecorderManager()` 方便玩家一键发录屏；叙事或影游搬上小游戏时，视频与配音必须拆入分包或远程按需加载，并保留末帧定格降级。

> **个人开发者三端发布门槛与资质要求**：
> - **微信小游戏 · 个人主体**：用个人身份证注册，**微信认证费 30 元/年**（企业主体 300 元/年），免游戏版号；需提交同名《计算机软件著作权登记证书》或电子版权、手写签名的《游戏自审自查报告》并完成小程序 ICP 备案。**严禁任何内购充值**，仅允许纯免费或流量主 IAA 广告，且只开放休闲益智、推理解谜、策略卡牌等轻量类目，禁重度联网角色扮演、棋牌捕鱼与玩家自由聊天。流量主需累计满 `500 UV` 或开通游戏圈活跃互动才能申请 `adUnitId`——首版提审时 `adUnitId` 为空，代码必须自动隐藏「看视频」字样或改为局内限次免费，否则审核员点到打不开的废广告按钮会直接按「功能异常」打回。
> - **抖音小游戏 · 个人主体**：用个人身份证与银行卡实名入驻抖音开放平台，**免 300 元企业认证费**，休闲类纯广告同样免版号，需同名软著、手写签名自审报告与平台协助备案；严禁任何内购代码，新游上线与版本更新**必审「侧边栏复访」领奖流程**。
> - **TapTap 制造 · 个人创作者**：免费入驻与发布，免版号与公司主体，云存档、排行榜、联机与实名防沉迷由平台统一提供，**激励视频广告平台 0 分成（收益 100% 归创作者）**。
> - **关于社区晒收入的说明**：社区里「单款小游戏日入过万 / 月入数万」多为头部爆款个案，实际收益高度依赖首屏留存、广告完播率与复玩率；技能不得把接通广告接口说成稳赚或已满足提审上线条件。

---

## 二、开源工具链与六个高频开发/提审坑

对照[微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)、[抖音小游戏开发文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction)、[TapTap 制造官网](https://maker.taptap.cn)及官方仓库 [`taptap/instant-games-open-mcp`](https://github.com/taptap/instant-games-open-mcp)、[`taptap/awesome-urhox-games`](https://github.com/taptap/awesome-urhox-games)，生成这三端游戏时最容易栽在以下六处：

1. **把「TapTap 制造」当成普通网页，或靠网页搜索瞎写接口**：
   - **真实架构**：TapTap 制造（`@taptap/maker`）底层是 **UrhoX 引擎 + Lua 5.4**，**不是 HTML/JS 网页**。入口为 `scripts/` 下的 `main.lua`，界面用 `.ui.json`，资源旁配官方生成的 24 位 URL-safe Base64 UUID `.meta` 文件，本地绑定在 `.maker-mcp/config.json`。官方仓库 [`taptap/instant-games-open-mcp`](https://github.com/taptap/instant-games-open-mcp) 由三部分协同：`taptap-maker` CLI 负责初始化、鉴权、克隆与本地 UrhoX Runtime 预览，Maker MCP 负责状态查询、生图/音视频/3D 代理与 `maker_build_current_directory` 云端构建，工程内开发包提供 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/`。社区另有 [`taptap/awesome-urhox-games`](https://github.com/taptap/awesome-urhox-games)、[`AndroidSix/TapMakerWork`](https://github.com/AndroidSix/TapMakerWork) 与 [`2624111503-bot/tap-maker-ui-generator`](https://github.com/2624111503-bot/tap-maker-ui-generator)。
   - **防错要点**：Maker 引擎与 SDK 没有公网文档，**接口写法一律以工程内的 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/recipes/sdk.md` 为准**——去网上搜只会搜出微信小游戏或 TapTap H5 的 JavaScript `tap.*` 代码，写进 Lua 必崩。调生成工具会扣平台积分，必须先经用户明确同意（CLI 传 `--allow-paid`，配音试听与 3D 多视图由用户挑定后再确认）；远端只接收 `main` 分支，本地跑 `taptap-maker preview` 绝不能自动触发推送或云端构建；接 0 分成激励广告先调 `get_ad_config` 同步 `.project/settings.json` 的 `@runtime.ad`，再调 `sdk:ShowRewardVideoAd`，且只在 `result.success == true` 时发奖。
2. **拿 DOM 网页冒充微信/抖音小游戏**：微信（`wx`）与抖音（`tt`）跑在无 DOM、无 BOM 的 JavaScript 沙盒里，没有 `index.html`、`document` 与 CSS；微信工程含 `game.js`、`game.json` 与 `"compileType": "game"` 的 `project.config.json`，抖音配 `project.tt.json`，首次调用 `createCanvas()` 返回唯一上屏主画布，微信视口优先读 `wx.getWindowInfo()`。常用开源方案有原生 Canvas 2D、[`wechat-miniprogram/minigame-canvas-engine`](https://github.com/wechat-miniprogram/minigame-canvas-engine)、[`theajack/wx-minigame-ts`](https://github.com/theajack/wx-minigame-ts)、[`finscn/weapp-adapter`](https://github.com/finscn/weapp-adapter)、[`wechat-miniprogram/minigame-demo`](https://github.com/wechat-miniprogram/minigame-demo)、[`wechat-miniprogram/minigame-lockstep-demo`](https://github.com/wechat-miniprogram/minigame-lockstep-demo)、[`deepkolos/three-platformize`](https://github.com/deepkolos/three-platformize) / [`deepkolos/platformize`](https://github.com/deepkolos/platformize)、[`godothub/godot-minigame`](https://github.com/godothub/godot-minigame)、[`wechat-miniprogram/minigame-unity-webgl-transform`](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform) 与异常监控 [`lizhiyao/sentry-miniapp`](https://github.com/lizhiyao/sentry-miniapp)。
3. **主包超 4 MB 或双端分包键名混写**：微信小游戏主包 `≤ 4 MB`、单个独立分包 `≤ 4 MB`、`game.json` 配 `subpackages` 时整包合计 `≤ 30 MB`，且 `openDataContext` 禁入分包；抖音小游戏主包 `≤ 4 MB`、`game.json` 配 `subPackages` 时整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包键名大小写不同，必须按目标平台分别生成 `game.json`，并在测试脚本里实测磁盘字节数。
4. **右上角系统胶囊挡住交互按钮**：微信与抖音右上角常驻系统胶囊按钮（菜单与关闭），位置由 `getMenuButtonBoundingClientRect()` 返回。把暂停、跳过、返回、任务或资源栏放在右上角，真机上根本点不到，提审也会直接打回。
5. **漏做抖音「侧边栏复访」三步审核流**：① 启动时调用 `tt.checkScene({ scene: "sidebar" })`，不支持则隐藏入口；② 支持时在主界面设常驻入口与引导弹窗，进入前按钮显示「去侧边栏」并调用 `tt.navigateToScene({ scene: "sidebar" })`；③ 在冷启动的 `tt.getLaunchOptionsSync()` 与热切回的 `tt.onShow` 两处同时检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后切换为「领取奖励」并写存档防止重复领奖。
6. **漏查应用目录里的 CLI，或没装工具时拿网页糊弄**：macOS 上微信开发者工具 CLI 常在 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 而未加入 `$PATH`，未扫码登录或用 `touristappid` 时仅可本地 `open`。本机缺少微信/抖音真机预览或未装 `taptap-maker` / UrhoX Runtime 时，只能使用简报事先批准的替代环境（例如共用同一画布入口、原生 `Image` 不包 `Proxy` 的小游戏浏览器调试页），并在 `BUILD_BRIEF.md` 与 `qa/verification.json` 里如实记下未验证范围。

---

## 三、玩家最反感的四类「AI 味」与对应约束

综合 TapTap 制造社区、微信/抖音评论区、X 独立开发复盘与 indienova 讨论，最容易让玩家一眼看出廉价生成感并划走的问题集中在四类：

1. **不分年代乱套霓虹毛玻璃界面，同屏画风割裂**：不管古风、民俗还是年代写实题材，一律用深蓝黑底配紫青霓虹渐变、毛玻璃圆角悬浮卡、系统无衬线黑体，拿 Emoji 或单个汉字/字母当图标；同屏立绘的线稿粗细、上色与色温各画各的；宣传封面精修华丽，点进去却是简陋色块。
   - **落进技能的规则**：`art-direction-method.md` 要求界面底纹、边框与字体取材自作品时代的器物（宣纸账册、木牌漆器、旧报刊档案），古风、民俗与写实题材禁用深蓝紫青霓虹渐变、毛玻璃悬浮卡与整屏泛黄滤镜；同屏资产统一画风，标题门面页与商店图须和实机画面保持同一水准。
2. **生图穿帮、牌匾乱码字与假透明棋盘格底**：立绘带着没抠净的灰白棋盘格底或白边锯齿、六指多关节、五官错位、牌匾书卷上印着近似汉字的乱码、古装混入现代拉链口袋，或者直接把平视半身立绘缩小贴在俯视地面上冒充跑图小人。
   - **落进技能的规则**：`game-build/SKILL.md` 要求生图与三维资产入包前逐件检查透明通道、手部五官、牌匾字迹与服饰年代，不合格直接重出或裁切，绝不带病上屏；`blind-playtest-method.md` 在首轮盲玩中逐项排查这类穿帮。
3. **假选项凑数与场外广告批注**：摆出三个选项，点哪个都接同一句台词；不管什么小说都硬挂「体力 / 理智 / 好感度 +5」数值条；或者在人物对话选项上直接标「（推荐）」「【看广告稳过】」。
   - **落进技能的规则**：`concept-method.md` 与 `player-copy-polish.md` 禁止把结果毫无差别的寒暄拆成假选项，激励提示必须与剧情对话拆开并改用符合世界观的求助措辞。
4. **套话复述与跨时代热梗**：满屏十来字一断的电报体碎句、「不是 A，而是 B」套路句、「命运的齿轮开始转动 / 空气仿佛凝固 / 眼中闪过一丝不易察觉的情绪」、同一意思换词连说两遍，或古人张口现代网络热梗。
   - **落进技能的规则**：`player-copy-polish.md` 把审校范围扩至结算卡、分享语与提示弹窗，一并清理这类套话、排比腔与跨时代流行语。

---

## 四、写进运行时技能与留在仓库外的边界

- **写进运行时技能**：
  - `novel-to-game`：锁定目标平台、开发者主体、包形式与体积上限、变现方式、Maker 积分扣费确认及本地替代测试环境许可。
  - `game-design`：短局快入戏与结算卡、激励广告不改写原著因果、空广告位降级、右上角胶囊避让、首包与分包拆分、禁用脱离时代的霓虹毛玻璃界面。
  - `game-build`：按需加载 `wechat-and-douyin-minigame.md` 或 `taptap-maker.md`、生图透明底与乱码穿帮核验、上屏文字审校。
  - `game-qa`：胶囊遮挡、双端视口、空广告位与广告中断、侧边栏冷/热进入、假选项与生图穿帮盲测，以及未跑 UrhoX Runtime 或云端构建时的 `limitations` 记录。
- **留在仓库外**：平台账号注册、软著与 ICP 备案办证流程、买量投流与达人分佣后台操作、通用商业引擎的基础安装教程。
