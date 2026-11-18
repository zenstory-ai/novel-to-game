# 微信小游戏、抖音小游戏与 TapTap 制造案例及去 AI 味依据 · 2026-11-18

本页整理网页社区、官方文档与 GitHub 开源仓库中关于微信小游戏、抖音小游戏与 **TapTap 制造（TapTap Maker）**的代表作品、变现方式、工程硬坑与去「AI 味（AI slop）」经验，说明哪些规则写进运行时技能、哪些留给开发者在仓库外处理。运行时构建规范分别见 [wechat-and-douyin-minigame.md](../../skills/game-build/references/wechat-and-douyin-minigame.md) 与 [taptap-maker.md](../../skills/game-build/references/taptap-maker.md)；常规构建不加载本页。

## 一、跑通市场的小说与叙事改编形态

### 1. TapTap 制造（TapTap Maker）短局事件模拟器与 0 分成激励广告

- **平台特点**：[**TapTap 制造**](https://maker.taptap.cn)（TapTap Maker）是心动 / TapTap 推出的对话与代码驱动游戏创作及即玩平台，底层采用自研 **UrhoX 引擎 + Lua 5.4** 纯代码架构，由平台统一提供云存档、排行榜、联机与实名防沉迷服务，并打通小游戏 **激励视频广告变现（平台实行 0 分成，广告收益 100% 归创作者）**，无版号个人创作者即可直接上架获取收益。
- **热门题材与案例**：在 TapTap 制造与即玩榜单中，最契合小说改编的作品集中在「强冲突开局 + 随机事件或肉鸽抉择 + 轻度数值养成」的模拟器形态，如历史官场题材《崇祯直聘：明末官场沉浮模拟器》、《古玩人生》，以及结合重生、末世、开店、修仙等网文题材的生存经营模拟器。
- **变现与品类边界**：0 分成激励广告在节奏快、单局短、重玩性高的轻度策略与事件模拟器上转化顺畅；若是节奏慢、强沉浸的长篇纯文字跑团或慢热长叙事，在剧情高潮硬插广告会破坏阅读体验，应把广告入口严格限定在失手重来、线索提示或番外解锁。

### 2. 天赋词条抽选 + 一屏命数判词卡

- **代表案例**：[`VickScarlet/lifeRestart`](https://github.com/VickScarlet/lifeRestart)（《人生重开模拟器》，及结合生成模型的社区衍生版 [`chnjames/life-restart-ai`](https://github.com/chnjames/life-restart-ai)）。
- **借鉴要点**：开局抽选互斥或联动词条 → 按岁数/回合推进条件事件 → 结尾把整局关键因果浓缩成一张反差鲜明的命数判词卡。极轻包体即可跑通，结算卡适合直接转发到微信群、TapTap 社区或抖音评论区晒图。

### 3. 中式民俗/历史推理解谜 + 分档激励提示

- **代表案例**：《纸嫁衣》系列、《山河旅探》（奥秘之家）。
- **改编与设计要点**：谜题直接长在原作礼俗、时代技艺与证词逻辑里——如《纸嫁衣》靠烧纸互通阴阳、八字风水推进机关，《山河旅探》靠清末民初现场勘验与证词指谬破案，不硬塞脱离背景的密码锁或滑块拼图。
- **小游戏变现与反面教训**：《纸嫁衣》小游戏版即点即玩，右上角设两档提示（「方向线索 → 完整解法或跳过繁琐小机关」）接激励视频，既救卡关流失又带来广告收入；但后期续作因广告过密被嘲为「广告模拟器」，宣传立绘与实机画面落差过大导致口碑下滑。

### 4. 桌面卡牌调度 + 倒计时生死局

- **代表案例**：《苏丹的游戏》、《王权》（Reigns）、《堆叠大陆》（Stacklands）。
- **改编与设计要点**：朝堂权谋、末日求生、宗门经营或欠债限期类小说，不必写成冗长的纯文字对话树。把随从、银两、证物、秘密与义务做成实体卡牌，用限时销卡（如《苏丹的游戏》7 日内必须折断杀戮、奢靡、征服或纵欲卡）或四维权衡状态机（《王权》），逼玩家在倒计时下调配人手并承担具体伤痕与人情债。

### 5. 竖屏短局肉鸽三选一构筑

- **代表案例**：《向僵尸开炮》，以及 GitHub 开源微信小游戏 [`nick938/wechat-miniGame`](https://github.com/nick938/wechat-miniGame)（合成 + 塔防 + 肉鸽三选一 + 开放数据域好友排行）、[`IcedSoul/minigame-everyday`](https://github.com/IcedSoul/minigame-everyday)（Phaser 3 / Cocos Creator 复刻收纳解谜、路径解谜与塔防肉鸽的双端工程）。
- **改编与设计要点**：玄幻斗法、渡劫守山、妖潮围城桥段适合拆成 **3–5 分钟一局**的竖屏防守或突围，把原著法宝、阵法、灵根相克做成局内看得见联动变化的技能三选一构筑，比单纯累加攻击力数字耐玩得多。

### 6. 高频寻宝/开箱短循环 + 境界成长

- **代表案例**：《寻道大千》《道友来挖宝》，以及开源修仙项目 [`ChurchTao/Daoyou`](https://github.com/ChurchTao/Daoyou)（《万界道友》，TypeScript 水墨风，含境界、灵根、功法、命格、炼丹炼器与时间轴回合战斗，兼容微信小游戏与网页）、[`setube/vue-xiuxiangame`](https://github.com/setube/vue-xiuxiangame)（《我的文字修仙全靠刷》）。
- **借鉴与工程边界**：单机或轻量改编可借「一铲一揭示、见好就收或深入涉险」的 2–4 分钟短循环（如本仓《西游记》示例的火脉残图），舍弃跨服充值排行榜。工程上需注意：`setube/vue-xiuxiangame` 依赖 Vue 与 Element Plus DOM 组件，不能直接跑在无 DOM 的微信/抖音小游戏沙盒或 UrhoX+Lua 的 TapTap 制造环境里。

### 7. 前 15 秒反常悬念 + 短视频挂载与分包影游

- **代表案例**：《隐秘的档案》《文字来找茬》《沙威玛传奇》《盛世天下》（小程序与多端版），以及开源文游工具 [`Shanyin-ai/Story-to-game`](https://github.com/Shanyin-ai/Story-to-game)、[`meathill/mui-gamebook`](https://github.com/meathill/mui-gamebook)。
- **借鉴要点**：抖音「游戏发行人计划」与短视频左下角挂载靠开局 10–15 秒直接摆出违和场景与生死规矩（《隐秘的档案》）或高节奏翻车现场（《沙威玛传奇》），并在通关或翻车时刻接 `tt.getGameRecorderManager()` 方便玩家一键发出录屏；叙事或影游移入小游戏时，视频与配音须拆入分包或远程按需加载并保留末帧定格降级。

> **个人开发者三端低成本发布与资质底账**：
> - **微信小游戏（个人主体）**：个人身份证注册，**微信认证费 30 元/年**（企业主体为 300 元/年），免游戏版号；需提交同名《计算机软件著作权登记证书》（或电子版权）、手写签名《游戏自审自查报告》并完成小程序 ICP 备案；**严禁任何内购充值（仅限纯免费或流量主 IAA 广告）**，类目仅开放休闲益智、推理解谜、策略卡牌等轻量类目（禁重度联网角色扮演、棋牌捕鱼与玩家自由聊天）；流量主广告需**累计满 `500 UV`（或开通内置游戏圈活跃互动）**后才能申请 `adUnitId`——因此首版提审时代码中 `adUnitId` 为空，必须自动隐藏「看视频」字样或切为局内限次免费，否则审核员点击未开通的废广告按钮会直接以「功能异常」驳回。
> - **抖音小游戏（个人主体）**：抖音开放平台个人身份证与个人银行卡实名入驻（**免 300 元企业认证费**），免版号（休闲类纯广告），同样需同名软著、手写签名自审报告与平台协助备案；严禁任何内购代码，新游及更新版本**强制必审「侧边栏复访」领奖流程**。
> - **TapTap 制造（个人创作者）**：免费入驻与发布，无需版号与公司主体，云存档、排行榜、联机与实名防沉迷由平台统一提供，**激励视频广告平台 0 分成（收益 100% 归创作者）**。
> - **社区收入案例的事实边界**：社区里「单款小游戏日入过万 / 月入数万」属于头部或个别创作者案例，真实收益受开局留存、完播率与重玩率影响很大；技能不得把跑通广告接口写成稳赚或可直接提审上线。

---

## 二、GitHub 开源工具链与六项平台实机/审核硬坑

对照[微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)、[抖音小游戏开发文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction)、[TapTap 制造官网](https://maker.taptap.cn)及官方开源仓库 [`taptap/instant-games-open-mcp`](https://github.com/taptap/instant-games-open-mcp)、[`taptap/awesome-urhox-games`](https://github.com/taptap/awesome-urhox-games)，生成上述三端游戏时最常栽在六处：

1. **把「TapTap 制造」误做成网页 H5，或靠网页搜索瞎写接口**：
   - **真实架构**：TapTap 制造（`@taptap/maker`）底层是 **UrhoX 引擎 + Lua 5.4**（入口为 `scripts/` 下的 `main.lua`，界面 `.ui.json`，资源旁配官方生成的 24 位 URL-safe Base64 UUID `.meta` 文件，本地绑定标记为 `.maker-mcp/config.json`），**不是 HTML/JS 网页**。官方仓库 [`taptap/instant-games-open-mcp`](https://github.com/taptap/instant-games-open-mcp) 由 `taptap-maker` CLI（初始化、鉴权、克隆、本地 UrhoX Runtime 预览）、Maker MCP（状态查询、生图音视频 3D 代理、`maker_build_current_directory` 提交云端构建）与工程内开发包（`CLAUDE.md`、`urhox-libs/`、`engine-docs/`）配合工作，社区另有 [`taptap/awesome-urhox-games`](https://github.com/taptap/awesome-urhox-games)、[`AndroidSix/TapMakerWork`](https://github.com/AndroidSix/TapMakerWork) 与 [`2624111503-bot/tap-maker-ui-generator`](https://github.com/2624111503-bot/tap-maker-ui-generator)。
   - **防错规则**：Maker 引擎与 SDK 无公网官方文档，**接口写法只以工程内的 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/recipes/sdk.md` 为准**——网页搜索只会搜到微信小游戏或 TapTap H5 的 JavaScript `tap.*` 代码，写进 Lua 直接报错；调用生成工具会扣平台积分，须先取得用户明确同意（CLI 传 `--allow-paid`，配音试听与 3D 多视图须由用户挑定确认）；远端只收 `main` 分支，本地 `taptap-maker preview` 绝不自动触发推送或云端构建；接 0 分成激励广告须先调 `get_ad_config` 同步 `.project/settings.json` 的 `@runtime.ad`，再调 `sdk:ShowRewardVideoAd` 并仅在 `result.success == true` 时发奖。
2. **拿 DOM 网页冒充微信/抖音小游戏**：微信（`wx`）与抖音（`tt`）运行在无 DOM、无 BOM 的 JavaScript 沙盒里，没有 `index.html`、`document` 与 CSS；微信目录含 `game.js` + `game.json` + `project.config.json`（`"compileType": "game"`），抖音配 `project.tt.json`，首次 `createCanvas()` 生成唯一上屏主画布，视口在微信端优先读 `wx.getWindowInfo()`。开源适配常用原生 Canvas 2D、[`wechat-miniprogram/minigame-canvas-engine`](https://github.com/wechat-miniprogram/minigame-canvas-engine)、[`theajack/wx-minigame-ts`](https://github.com/theajack/wx-minigame-ts)、[`finscn/weapp-adapter`](https://github.com/finscn/weapp-adapter)、[`wechat-miniprogram/minigame-demo`](https://github.com/wechat-miniprogram/minigame-demo)、[`wechat-miniprogram/minigame-lockstep-demo`](https://github.com/wechat-miniprogram/minigame-lockstep-demo)、[`deepkolos/three-platformize`](https://github.com/deepkolos/three-platformize) / [`deepkolos/platformize`](https://github.com/deepkolos/platformize)、[`godothub/godot-minigame`](https://github.com/godothub/godot-minigame)、[`wechat-miniprogram/minigame-unity-webgl-transform`](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform) 及监控 [`lizhiyao/sentry-miniapp`](https://github.com/lizhiyao/sentry-miniapp)。
3. **首包超 4 MB 或双端分包字段混写**：微信小游戏主包 `≤ 4 MB`、独立分包单个 `≤ 4 MB`、`game.json` 的 `subpackages` 整包合计 `≤ 30 MB`（`openDataContext` 禁入分包）；抖音小游戏主包 `≤ 4 MB`、`game.json` 配 `subPackages` 时整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包键名大小写不同，须按目标平台生成各自的 `game.json` 并在自测脚本里实测磁盘字节数。
4. **右上角系统胶囊压住核心按钮**：微信与抖音右上角常驻原生胶囊按钮（菜单与关闭），坐标由 `getMenuButtonBoundingClientRect()` 返回。把暂停、跳过、返回、任务或资源栏画在右上角，真机点不到且审核直接打回。
5. **抖音「侧边栏复访」三步审核要求缺漏**：① 启动调 `tt.checkScene({ scene: "sidebar" })`，不支持时隐藏入口；② 支持时设主界面常驻入口与引导弹窗，进入前按钮显示「去侧边栏」（`tt.navigateToScene({ scene: "sidebar" })`）；③ 在 `tt.getLaunchOptionsSync()`（冷启动）与 `tt.onShow`（热切回）两处同时检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后切换为「领取奖励」并写档防重领。
6. **漏探本机应用目录 CLI，或无实机工具时拿网页冒充**：macOS 微信开发者工具 CLI 常装在 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 而未入 `$PATH`（未扫码登录或用 `touristappid` 仅支持本地 `open`）。缺少微信/抖音真机预览或未安装绑定 `taptap-maker` / UrhoX Runtime 时，只可走简报批准的替代环境（如共用画布入口、原生 `Image` 不包 `Proxy` 的小游戏浏览器调试页），并在 `BUILD_BRIEF.md` 与 `qa/verification.json` 如实列出未验证限制。

---

## 三、四类常见「AI 味（AI Slop）」问题与对应约束

在 TapTap 制造社区、微信/抖音评论区、X 独立开发复盘与 indienova 讨论中，玩家一眼看出廉价生成痕迹并直接划走，主要集中在四类问题：

1. **脱离时代背景的霓虹毛玻璃界面与画风拼贴**：不管古风、民俗还是历史题材，一律套深蓝黑底配紫青霓虹渐变、毛玻璃圆角悬浮卡、系统默认无衬线黑体，拿 Emoji 或单个汉字/字母充当图标；同屏角色线稿粗细、上色手法和色温各异；封面精修华丽，进游戏却是粗糙色块。
   - **写入技能的约束**：`art-direction-method.md` 规定界面材质、边框与字形须取材自作品时代的器物（宣纸账册、木牌漆器、旧报刊档案），古风、民俗与写实题材禁用深蓝紫青霓虹渐变、毛玻璃悬浮卡与整屏泛黄滤镜；同屏资产统一画风，门面页与商店图须和实机画面保持同一水准。
2. **生图穿帮、牌匾乱码字与假透明棋盘格底**：立绘带未抠净的灰白棋盘格假透明底或白边锯齿、六指多关节、左右眼错位、牌匾书卷上印着无法辨认的伪汉字乱码、古装混入现代拉链口袋，或直接把平视半身立绘缩小贴在俯视地面上当跑图小人。
   - **写入技能的约束**：`game-build/SKILL.md` 要求生图与三维资产入包前逐件核验透明通道、手部五官、牌匾字迹与服饰年代，不合格直接重出或裁切，不带病上屏；`blind-playtest-method.md` 在首轮盲玩中逐项排查此类穿帮。
3. **假选项与场外广告批注**：三个看似不同的选项点完都接同一句台词；无论什么小说都硬挂「体力 / 理智 / 好感度 +5」数值条；或在剧情对话选项上直接贴「（推荐）」「【看广告稳过】」。
   - **写入技能的约束**：`concept-method.md` 与 `player-copy-polish.md` 严禁把结果一致的寒暄拆成假选项凑数，激励提示与剧情表态分开呈现且改用世界内求助措辞。
4. **套话复述与年代出戏热梗**：满屏十来字一断的电报体碎句、「不是 A，而是 B」套路句、「命运的齿轮开始转动 / 空气仿佛凝固 / 眼中闪过一丝不易察觉的情绪」、同一意思换词反复说，或古人张口现代网络热梗。
   - **写入技能的约束**：`player-copy-polish.md` 将审校范围扩至结算卡、分享语与提示弹窗，统一清理上述套话、套路排比与跨时代流行语。

---

## 四、写入运行时技能与留在仓库外的分工

- **写入运行时技能**：`novel-to-game`（锁定目标平台、开发者主体、包形式与体积上限、变现方式、Maker 积分扣费确认与本地替代环境许可）、`game-design`（短局高重玩快入戏、激励广告不改写原著因果、无广告位时的替代路径、右上角胶囊避让区、首包/分包拆分与禁用脱离时代的霓虹毛玻璃界面）、`game-build`（按需加载 `wechat-and-douyin-minigame.md` 或 `taptap-maker.md`、生图透明底与乱码穿帮核验、上屏文字审校）、`game-qa`（胶囊遮挡、双视口、无广告位与广告中断、侧边栏冷/热进入、假选项与画面穿帮盲测，以及未绑定 UrhoX Runtime / 云端构建的 `limitations` 记录）。
- **不写入运行时技能**：平台账号注册、软著与 ICP 备案办证步骤、买量投流与达人分佣后台操作、特定商业引擎的基础安装教程。
