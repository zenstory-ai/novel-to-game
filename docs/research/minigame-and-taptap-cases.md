# 微信小游戏、抖音小游戏与 TapTap 案例及去 AI 味依据 · 2026-11-17

本页整理网页社区、官方文档与 GitHub 开源仓库中关于微信小游戏、抖音小游戏与 TapTap 独立游戏的代表作品、变现方式、工程硬坑与去「AI 味（AI slop）」经验，说明哪些规则写进运行时技能、哪些留给开发者在仓库外处理。运行时构建规范见 [minigame-and-taptap.md](../../skills/game-build/references/minigame-and-taptap.md)；常规构建不加载本页。

## 一、七类跑通市场的小说与叙事改编形态

### 1. 中式民俗/历史推理解谜 + 分档提示或试玩买断

- **代表案例**：《纸嫁衣》系列、《山河旅探》（奥秘之家）。
- **改编与设计要点**：谜题直接长在原作礼俗、时代技艺与证词逻辑里——如《纸嫁衣》靠烧纸互通阴阳、八字风水推进机关，《山河旅探》靠清末民初现场勘验与证词指谬破案，不硬塞脱离背景的密码锁或滑块拼图。
- **三端发行与变现**：
  - **TapTap 试玩买断**：《山河旅探》采用「前章免费试玩 + 一次性买断完整版」，在悬念最高处收束试玩章；《纸嫁衣》早期在 TapTap 拿到 9.2–9.6 分评价，靠玩家考据与实况视频传开。
  - **微信/抖音小游戏免下载广告变现**：《纸嫁衣》小游戏版即点即玩，右上角设两档提示（「方向线索 → 完整解法或跳过繁琐小机关」）接激励视频，既救卡关流失又带来广告收入。
  - **反面教训**：《纸嫁衣》后期续作因广告穿插过密被玩家嘲为「广告模拟器」，商店立绘与实机画面落差被批「买家秀与卖家秀」，TapTap 评分明显下滑。

### 2. 桌面卡牌调度 + 倒计时生死局

- **代表案例**：《苏丹的游戏》、《王权》（Reigns）、《堆叠大陆》（Stacklands）。
- **改编与设计要点**：朝堂权谋、末日求生、宗门经营或欠债限期类小说，不必写成冗长的纯文字对话树。把随从、银两、证物、秘密与义务做成实体卡牌，用限时销卡（如《苏丹的游戏》7 日内必须折断杀戮、奢靡、征服或纵欲卡）或四维权衡状态机（《王权》），逼玩家在倒计时下调配人手并承担具体伤痕与人情债。

### 3. 竖屏短局肉鸽三选一构筑

- **代表案例**：《向僵尸开炮》，以及 GitHub 开源微信小游戏 [`nick938/wechat-miniGame`](https://github.com/nick938/wechat-miniGame)（合成 + 塔防 + 肉鸽三选一 + 开放数据域好友排行）、[`IcedSoul/minigame-everyday`](https://github.com/IcedSoul/minigame-everyday)（Phaser 3 / Cocos Creator 复刻收纳解谜、路径解谜与塔防肉鸽的双端工程）。
- **改编与设计要点**：玄幻斗法、渡劫守山、妖潮围城桥段适合拆成 **3–5 分钟一局**的竖屏防守或突围，把原著法宝、阵法、灵根相克做成局内看得见联动变化的技能三选一构筑，比单纯累加攻击力数字耐玩得多。

### 4. 高频寻宝/开箱短循环 + 境界成长

- **代表案例**：《寻道大千》《道友来挖宝》，以及开源修仙项目 [`ChurchTao/Daoyou`](https://github.com/ChurchTao/Daoyou)（《万界道友》，TypeScript 水墨风，含境界、灵根、功法、命格、炼丹炼器与时间轴回合战斗，兼容微信小游戏与网页）、[`setube/vue-xiuxiangame`](https://github.com/setube/vue-xiuxiangame)（《我的文字修仙全靠刷》）。
- **借鉴与工程边界**：单机或轻量改编可借「一铲一揭示、见好就收或深入涉险」的 2–4 分钟短循环（如本仓《西游记》示例的火脉残图），舍弃跨服充值排行榜。工程上需注意：`setube/vue-xiuxiangame` 依赖 Vue 与 Element Plus DOM 组件，适合网页、TapTap H5 WebView 或封装安装包，不能直接跑在无 DOM 的微信/抖音小游戏沙盒里；原生小游戏须像 `ChurchTao/Daoyou` 或 `IcedSoul/minigame-everyday` 一样走画布渲染。

### 5. 天赋词条抽选 + 一屏命数判词卡

- **代表案例**：[`VickScarlet/lifeRestart`](https://github.com/VickScarlet/lifeRestart)（《人生重开模拟器》，及结合生成模型的社区衍生版 [`chnjames/life-restart-ai`](https://github.com/chnjames/life-restart-ai)）。
- **借鉴要点**：开局抽选互斥或联动词条 → 按岁数/回合推进条件事件 → 结尾把整局关键因果浓缩成一张反差鲜明的命数判词卡。2 MB 内极轻包体即可跑通，结算卡适合直接转发到微信群或发在抖音评论区晒图。

### 6. 前 15 秒反常悬念 + 短视频挂载与录屏分享

- **代表案例**：《隐秘的档案》《文字来找茬》《躺平发育》《沙威玛传奇》。
- **借鉴要点**：抖音「游戏发行人计划」与短视频左下角挂载能带起自然访问，靠的是画面让人看五秒就想试或跟着拍视频——要么开局 10–15 秒直接摆出违和场景与生死规矩（《隐秘的档案》），要么用高节奏操作制造手忙脚乱的翻车现场（《沙威玛传奇》），并在通关或翻车时刻接 `tt.getGameRecorderManager()` 方便玩家一键发出录屏。

### 7. 本土历史/悬疑视觉小说与互动影游

- **代表案例**：《饿殍：明末千里行》《烟火》《三伏》《飞越13号房》《盛世天下》（小程序与多端版），以及开源文游工具 [`Shanyin-ai/Story-to-game`](https://github.com/Shanyin-ai/Story-to-game)、[`meathill/mui-gamebook`](https://github.com/meathill/mui-gamebook)。
- **借鉴要点**：纯叙事作品无需硬塞卡牌或养成面板，只要抉择直指人物心结与时代处境、情绪高潮不插广告，凭「免费试玩序章 + 一次性买断完整篇」同样能在 TapTap 拿到 9 分以上评价与可观销量；移入小游戏时，视频与配音须拆入分包或远程按需加载，并保留末帧定格配字幕的降级路径。

> **关于社区收入案例的事实边界**：国内无版号主体在微信、抖音与 TapTap 通常只能走纯激励广告或免费试玩（须按平台要求具备软件著作权并完成备案），不得接入任何内购虚拟支付。社区里「单人配 AI 几天上线日入数千」属于个别开发者的单方晒单，真实收益受前三十秒留存、完播率与内容带量影响极大；技能不得把跑通广告接口写成稳赚或可直接提审上线。

---

## 二、GitHub 开源适配栈与五项平台实机/审核硬坑

对照[微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)、[抖音小游戏开发文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction)与 [TapTap 开发者文档](https://developer.taptap.cn/docs/sdk/)，生成上述平台游戏时最常栽在五处：

1. **拿 DOM 网页冒充微信/抖音小游戏，或漏掉 TapTap H5 路径与防沉迷硬要求**：
   - **微信（`wx`）与抖音（`tt`）**：运行在无 DOM、无 BOM 的 JavaScript 沙盒里，没有 `index.html`、`document.createElement('div')` 与 CSS；微信目录固定为 `game.js` + `game.json` + `project.config.json`（`"compileType": "game"`），抖音配 `project.tt.json`，首次调用 `createCanvas()` 生成唯一上屏主画布，视口在微信端优先读 `wx.getWindowInfo()`（`wx.getSystemInfoSync` 已标记废弃）。开源项目或直接用原生 Canvas 2D、[`wechat-miniprogram/minigame-canvas-engine`](https://github.com/wechat-miniprogram/minigame-canvas-engine)、[`theajack/wx-minigame-ts`](https://github.com/theajack/wx-minigame-ts)，或借助 [`finscn/weapp-adapter`](https://github.com/finscn/weapp-adapter)、[`wechat-miniprogram/minigame-demo`](https://github.com/wechat-miniprogram/minigame-demo)、[`wechat-miniprogram/minigame-lockstep-demo`](https://github.com/wechat-miniprogram/minigame-lockstep-demo)（PixiJS）、[`deepkolos/three-platformize`](https://github.com/deepkolos/three-platformize) / [`deepkolos/platformize`](https://github.com/deepkolos/platformize)（Three.js 与 PixiJS 适配），或经 Cocos Creator、[`godothub/godot-minigame`](https://github.com/godothub/godot-minigame)、[`wechat-miniprogram/minigame-unity-webgl-transform`](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform) 导出，线上监控常用 [`lizhiyao/sentry-miniapp`](https://github.com/lizhiyao/sentry-miniapp)。
   - **TapTap**：分 **H5 小游戏**（WebView 容器，`.zip ≤ 20 MB`，根目录须含 `index.html`，且压缩包名与包内文件、目录路径只用 `[A-Za-z0-9_.-]`，含中文或空格会导致线上解压解析失败）与 **客户端包**（原生导出或 [`ionic-team/capacitor`](https://github.com/ionic-team/capacitor) 封装）。凡上架 TapTap 的游戏（含无版号 H5 小游戏与免费/广告版）均须先接 [`taptap/TapSDK-Unity`](https://github.com/taptap/TapSDK-Unity) / TapSDK 登录取得 `userIdentifier`，再初始化实名与防沉迷合规认证并响应未成年人时段/时长拦截回调；无版号版本严禁含任何内购充值。
2. **首包超 4 MB 或双端分包字段混写**：微信小游戏主包上限 `4 MB`、单个独立分包上限 `4 MB`、`game.json` 的 `subpackages` 整包合计上限 `30 MB`（`openDataContext` 不可放入分包）；抖音小游戏主包上限 `4 MB`、`game.json` 配置 `subPackages` 时整包上限 `20 MB`（不分包 `16 MB`）。两端分包键名大小写不同，须按目标平台生成各自的 `game.json`（每个分包目录含独立 `game.js` 入口），并在自测脚本里实测磁盘体积。
3. **右上角系统胶囊压住核心按钮**：微信与抖音右上角常驻原生胶囊按钮（菜单与关闭），坐标由 `getMenuButtonBoundingClientRect()` 返回。把暂停、跳过、返回、任务追踪或资源栏画在右上角，真机点不到且审核直接打回。
4. **抖音「侧边栏复访」三步审核要求缺漏**：抖音要求新上架及更新的小游戏：① 启动时调用 `tt.checkScene({ scene: "sidebar" })`，不支持或失败时隐藏入口（避免非抖音或旧版客户端残留废按钮）；② 支持时在主界面设常驻入口与引导弹窗，进入前按钮显示「去侧边栏」并调 `tt.navigateToScene({ scene: "sidebar" })`；③ 同时在 `tt.getLaunchOptionsSync()`（从侧边栏冷启动）与 `tt.onShow`（从侧边栏热切回）两处检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后弹窗按钮切换为「领取奖励」，领完写档防重复领取。只监听 `tt.onShow` 会漏判冷启动，审核必被打回。
5. **漏探本机应用目录 CLI，或无实机工具时退回写 DOM 网页**：macOS 上的微信开发者工具 CLI 常装在 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 而未加入 `$PATH`（且未扫码登录或使用 `touristappid` 时仅支持本地 `open`，真机 `preview` / `upload` 需登录正式小游戏 AppID）。无可用实机环境且简报批准本地替代环境时，应交付真实平台包目录，同时配一个共用同一套无 DOM 画布入口与平台模拟接口的浏览器调试页（`createImage` 返回原生 `Image` 实例而非 `Proxy`），绘出右上角模拟胶囊框并提供激励视频完成/中途关闭与抖音侧边栏冷/热进入测试开关，在 `BUILD_BRIEF.md` 与 `qa/verification.json` 中分开记录 `targetRuntime`、`testedRuntime` 及未验证限制。

---

## 三、四类常见「AI 味（AI Slop）」问题与对应约束

在 TapTap 评价区、X 独立开发复盘与 indienova 讨论中，玩家一眼看出廉价生成痕迹并直接关闭游戏，主要集中在四类问题：

1. **脱离时代背景的霓虹毛玻璃界面与画风拼贴**：不管古风、民俗还是历史题材，一律套深蓝黑底配紫青霓虹渐变、毛玻璃圆角悬浮卡、系统默认无衬线黑体，拿 Emoji 或单个汉字/字母充当图标；同屏角色线稿粗细、上色手法和色温各异；商店宣传图精修华丽，进游戏却是粗糙色块。
   - **写入技能的约束**：`art-direction-method.md` 规定界面材质、边框与字形须取材自作品时代的器物（宣纸账册、木牌漆器、旧报刊档案），古风、民俗与写实题材禁用深蓝紫青霓虹渐变、毛玻璃悬浮卡与整屏泛黄滤镜；同屏资产统一画风，门面页与商店图须和实机画面保持同一水准。
2. **生图穿帮、牌匾乱码字与假透明棋盘格底**：立绘带未抠净的灰白棋盘格假透明底或白边锯齿、六指多关节、左右眼错位、牌匾书卷上印着无法辨认的伪汉字乱码、古装混入现代拉链口袋，或直接把平视半身立绘缩小贴在俯视地面上当跑图小人。
   - **写入技能的约束**：`game-build/SKILL.md` 要求生图与三维资产入包前逐件核验透明通道、手部五官、牌匾字迹与服饰年代，不合格直接重出或裁切，不带病上屏；`blind-playtest-method.md` 在首轮盲玩中逐项排查此类穿帮。
3. **假选项与场外广告批注**：三个看似不同的选项点完都接同一句台词；无论什么小说都硬挂「体力 / 理智 / 好感度 +5」数值条；或在剧情对话选项上直接贴「（推荐）」「【看广告稳过】」。
   - **写入技能的约束**：`concept-method.md` 与 `player-copy-polish.md` 严禁把结果一致的寒暄拆成假选项凑数，激励提示与剧情表态分开呈现且改用世界内求助措辞。
4. **套话复述与年代出戏热梗**：满屏十来字一断的电报体碎句、「不是 A，而是 B」套路句、「命运的齿轮开始转动 / 空气仿佛凝固 / 眼中闪过一丝不易察觉的情绪」、同一意思换词反复说，或古人张口现代网络热梗。
   - **写入技能的约束**：`player-copy-polish.md` 将审校范围扩至结算卡、分享语与提示弹窗，统一清理上述套话、套路排比与跨时代流行语。

---

## 四、写入运行时技能与留在仓库外的分工

- **写入运行时技能**：`novel-to-game`（锁定包形式、体积上限、变现方式与本地浏览器调试页许可）、`game-design`（短局快入戏、广告与解锁不改写原著因果、右上角胶囊避让区、首包/分包拆分与禁用脱离时代的霓虹毛玻璃界面）、`game-build`（按需加载 `minigame-and-taptap.md`、生图透明底与乱码穿帮核验、上屏文字审校）、`game-qa`（胶囊遮挡、双视口、广告中断、侧边栏冷/热进入、假选项与画面穿帮盲测）。
- **不写入运行时技能**：平台账号注册、软著与 ICP 备案办证步骤、买量投流与达人分佣后台操作、特定商业引擎的基础安装教程。
