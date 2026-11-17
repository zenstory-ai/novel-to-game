# 微信小游戏、抖音小游戏与 TapTap 案例及去 AI 味依据 · 2026-11-17

本页整理网页社区、官方文档与 GitHub 开源仓库中关于微信小游戏、抖音小游戏与 TapTap 独立游戏的代表作品、变现方式、工程硬坑与「去 AI 味（AI deslop）」经验，说明哪些规则写进运行时技能、哪些留给开发者在仓库外处理。运行时构建规范见 [minigame-and-taptap.md](../../skills/game-build/references/minigame-and-taptap.md)；常规构建不加载本页。

## 一、七类跑通市场的小说与叙事改编形态

### 1. 中式民俗/历史推理解谜 + 分档提示或试玩买断

- **代表案例**：《纸嫁衣》系列、《山河旅探》（奥秘之家）。
- **改编与设计要点**：谜题直接长在原作礼俗、时代技艺与证词逻辑里——如《纸嫁衣》靠烧纸互通阴阳、八字风水推进机关，《山河旅探》靠清末民初现场勘验与证词指谬破案，不硬塞脱离背景的密码锁或滑块拼图。
- **三端发行与变现**：
  - **TapTap 口碑冷启动**：《山河旅探》采用「前章免费试玩 + 一次性买断解锁完整版」，在情绪悬念最高处收束试玩章；《纸嫁衣》早期在 TapTap 拿到 9.2–9.6 分口碑，再借社区考据与二创扩散。
  - **微信/抖音小游戏泛用户扩圈**：《纸嫁衣》小游戏版免下载即点即玩，右上角设两档提示（「方向线索 → 完整解法或跳过繁琐小机关」）接激励视频，既救卡关流失又完成变现。
  - **反面教训**：《纸嫁衣》后期续作因广告穿插过密被玩家嘲为「广告模拟器」，宣发立绘与实机画面落差被批「买家秀与卖家秀」，导致 TapTap 评分明显下滑。

### 2. 桌面卡牌调度 + 倒计时生死局

- **代表案例**：《苏丹的游戏》、《王权》（Reigns）、《堆叠大陆》（Stacklands）。
- **改编与设计要点**：朝堂权谋、末日求生、宗门经营或欠债限期类小说，不必写成冗长的纯文字对话树。把随从、银两、证物、秘密与义务做成实体卡牌，用限时销卡（如《苏丹的游戏》7 日内必须折断杀戮、奢靡、征服或纵欲卡）或四维权衡状态机（《王权》），逼玩家在倒计时下调配人手并承担具体伤痕与人情债。

### 3. 竖屏短局肉鸽三选一构筑

- **代表案例**：《向僵尸开炮》，以及 GitHub 开源微信小游戏 [`nick938/wechat-miniGame`](https://github.com/nick938/wechat-miniGame)（合成 + 塔防 + 肉鸽三选一 + 开放数据域好友排行）、[`IcedSoul/minigame-everyday`](https://github.com/IcedSoul/minigame-everyday)（Phaser 3 / Cocos Creator 复刻收纳解谜、路径解谜与塔防肉鸽的双端工程）。
- **改编与设计要点**：玄幻斗法、渡劫守山、妖潮围城桥段适合拆成 **3–5 分钟一局**的竖屏防守或突围，把原著法宝、阵法、灵根相克做成局内看得见联动变化的技能三选一构筑，比单纯堆叠攻击力数字更有复玩度。

### 4. 高频寻宝/开箱短循环 + 境界成长

- **代表案例**：《寻道大千》《道友来挖宝》，以及开源修仙项目 [`ChurchTao/Daoyou`](https://github.com/ChurchTao/Daoyou)（《万界道友》，TypeScript 水墨风，含境界、灵根、功法、命格、炼丹炼器与时间轴回合战斗，兼容微信小游戏与网页）、[`setube/vue-xiuxiangame`](https://github.com/setube/vue-xiuxiangame)（《我的文字修仙全靠刷》）。
- **借鉴与工程边界**：单机或轻量改编可借「一铲一揭示、见好就收或深入涉险」的 2–4 分钟短循环（如本仓《西游记》示例的火脉残图），舍弃跨服逼氪排行榜。工程上需注意：`setube/vue-xiuxiangame` 依赖 Vue 与 Element Plus DOM 组件，适合网页、TapTap H5 WebView 或封装安装包，不能直接跑在无 DOM 的微信/抖音小游戏沙盒里；原生小游戏须像 `ChurchTao/Daoyou` 或 `IcedSoul/minigame-everyday` 一样走画布渲染。

### 5. 天赋词条抽选 + 一屏命数判词裂变

- **代表案例**：[`VickScarlet/lifeRestart`](https://github.com/VickScarlet/lifeRestart)（《人生重开模拟器》，及结合生成模型的社区衍生版 [`chnjames/life-restart-ai`](https://github.com/chnjames/life-restart-ai)）。
- **借鉴要点**：开局抽选互斥或联动词条 → 按岁数/回合推进条件事件 → 结尾把整局关键因果浓缩成一张高反差的「命数总结/判词卡」。2 MB 内极轻包体即可跑通，结算卡自带微信群转发与抖音评论区晒图属性。

### 6. 前 15 秒反常悬念 + 短视频挂载/直播节目效果

- **代表案例**：《隐秘的档案》《文字来找茬》《躺平发育》《沙威玛传奇》。
- **借鉴要点**：抖音「游戏发行人计划」与短视频左下角挂载能带起自然量，靠的是画面自带围观与二创张力——要么开局 10–15 秒直接摆出违和场景与生死规矩（《隐秘的档案》），要么用高节奏操作制造手忙脚乱的翻车喜剧感（《沙威玛传奇》），并在通关或翻车时刻接 `tt.getGameRecorderManager()` 方便玩家一键发出录屏。

### 7. 本土历史/悬疑视觉小说与互动影游

- **代表案例**：《饿殍：明末千里行》《烟火》《三伏》《飞越13号房》《盛世天下》（小程序与多端版），以及开源文游工具 [`Shanyin-ai/Story-to-game`](https://github.com/Shanyin-ai/Story-to-game)、[`meathill/mui-gamebook`](https://github.com/meathill/mui-gamebook)。
- **借鉴要点**：纯叙事作品无需硬塞卡牌或养成面板，只要抉择直指人物心结与时代处境、情绪高潮绝不强插广告，凭「免费试玩序章 + 一次性买断解锁」同样能在 TapTap 拿到 9 分以上口碑与可观销量；移入小游戏时，视频与配音须拆入分包或远程按需加载，并保留末帧定格配字幕的降级路径。

> **关于社区收入案例的口径边界**：国内个人主体无版号时，在微信与抖音通常只能走纯 IAA 广告变现或免费试玩（须具备软件著作权并按平台规定完成备案），无法开通内购虚拟支付。社区中「单人配 AI 几天上线日入数千」属于幸存者自述，真实收益取决于前三十秒留存、完播率与内容带量能力；技能不得把跑通广告接口写成稳赚或已达上线水准。

---

## 二、GitHub 开源适配栈与五项高频实机/提审硬坑

对照[微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)、[抖音小游戏开发文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction)与 [TapTap 开发者文档](https://developer.taptap.cn/docs/sdk/)，编码 Agent 生成上述平台游戏时最常栽在五处：

1. **拿 DOM 网页冒充微信/抖音小游戏**：微信（`wx`）与抖音（`tt`）小游戏运行在无 DOM、无 BOM 的 JavaScript 沙盒里，没有 `index.html`、`document.createElement('div')` 与 CSS，入口固定为 `game.js` + `game.json` + `project.config.json`（`"compileType": "game"`），首次调用 `wx.createCanvas()` / `tt.createCanvas()` 生成唯一上屏主画布。开源项目或直接用原生 Canvas 2D、[`wechat-miniprogram/minigame-canvas-engine`](https://github.com/wechat-miniprogram/minigame-canvas-engine)、[`theajack/wx-minigame-ts`](https://github.com/theajack/wx-minigame-ts)，或借助 [`finscn/weapp-adapter`](https://github.com/finscn/weapp-adapter)、[`wechat-miniprogram/minigame-demo`](https://github.com/wechat-miniprogram/minigame-demo)、[`wechat-miniprogram/minigame-lockstep-demo`](https://github.com/wechat-miniprogram/minigame-lockstep-demo)（PixiJS）、[`deepkolos/three-platformize`](https://github.com/deepkolos/three-platformize) / [`deepkolos/platformize`](https://github.com/deepkolos/platformize)（Three.js 与 PixiJS 适配），或经 Cocos Creator、[`godothub/godot-minigame`](https://github.com/godothub/godot-minigame)、[`wechat-miniprogram/minigame-unity-webgl-transform`](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform) 导出，线上监控常用 [`lizhiyao/sentry-miniapp`](https://github.com/lizhiyao/sentry-miniapp)。TapTap 则分 **H5 小游戏（WebView 容器，`.zip ≤ 20 MB`）** 与 **客户端包（原生导出或 [`ionic-team/capacitor`](https://github.com/ionic-team/capacitor) 封装，接 [`taptap/TapSDK-Unity`](https://github.com/taptap/TapSDK-Unity) / TapSDK 登录与实名防沉迷）** 两种形态。
2. **首包超 4 MB 无法上传**：微信小游戏主包上限 `4 MB`、分包合计上限 `30 MB`；抖音小游戏主包上限 `4 MB`、配置 `subPackages` 时整包上限 `20 MB`（不分包 `16 MB`）；TapTap H5 小游戏 `.zip` 上限 `20 MB`。不在自测脚本里实测磁盘体积，接完美术音视频后极易超限返工。
3. **右上角系统胶囊压住核心按钮**：微信与抖音右上角常驻原生胶囊按钮（菜单与关闭），坐标由 `getMenuButtonBoundingClientRect()` 返回。把暂停、跳过、返回、任务追踪或资源栏画在右上角，真机点不到且机审直接打回。
4. **抖音漏接强制必审的「侧边栏复访」**：抖音要求所有新上架及更新的小游戏在主界面设常驻入口与视觉引导弹窗，经 `tt.checkScene` 校验后调用 `tt.navigateToScene({ scene: "sidebar" })`，并在 `tt.onShow` 识别 `launch_from === "homepage" && location === "sidebar_card"` 后发放奖励、写入存档防止重复领取。
5. **本机无开发者工具时退回写 DOM 网页或直接停工**：稳妥做法是交付真实的小游戏或 TapTap 包目录，同时提供一个直接运行同一套无 DOM 画布入口与平台模拟接口的本地浏览器调试页，在右上角绘出模拟胶囊遮挡框，并提供激励视频「看完 / 中途关闭」与抖音「侧边栏回访」测试开关，在 `BUILD_BRIEF.md` 与 `qa/verification.json` 中分开记录 `targetRuntime`、`testedRuntime` 及未验证限制。

---

## 三、社区痛批的四大「AI 味（AI Slop）」重灾区与根治措施

在 TapTap 差评区、X 独立开发复盘与 indienova 讨论中，玩家一眼判出廉价「AI 味」并划走，主要集中在四类问题：

1. **科技模板 UI 与画风拼贴**：不管古风、民俗还是历史题材，一律套深蓝黑底配紫青霓虹渐变、毛玻璃圆角悬浮卡、系统默认无衬线黑体，拿 Emoji 或单个文字充当图标；同屏角色线稿粗细、上色流派和色温各异；宣传封面精修华丽，进游戏却是粗糙色块（「封面诈骗」）。
   - **写入技能的约束**：`art-direction-method.md` 规定界面材质、色板与字形须取材自作品时代的实物（宣纸、木牌、账册、旧档案），古风/民俗/写实题材禁用科技霓虹渐变、毛玻璃卡片与泛黄塑料滤镜；同屏资产统一画风，门面图与实机保持同一水准。
2. **生图穿帮与假透明棋盘格底**：立绘带未抠净的灰白棋盘格假透明底或白边锯齿、六指多关节、左右眼错位、古装混入现代拉链口袋，或直接把平视半身立绘缩小贴在俯视地面上当跑图角色。
   - **写入技能的约束**：`game-build/SKILL.md` 要求生图与模型资产入包前逐件核验透明通道、手部五官与服饰年代，穿帮图直接重出或裁切，绝不带病上屏；`blind-playtest-method.md` 在首轮盲玩中专门排查此类画面穿帮。
3. **假选项与无脑数值条套皮**：三个看似不同的选项点完都接同一句万能台词；无论什么小说都硬挂「体力 / 理智 / 好感度 +5」面板；或在剧情选项上直接贴「（推荐）」「【看视频稳过】」等场外标签。
   - **写入技能的约束**：`concept-method.md` 与 `player-copy-polish.md` 严禁把结果一致的寒暄拆成假选项充数，激励提示与剧情表态分开呈现且改用世界内措辞。
4. **大模型套话与年代出戏热梗**：满屏电报体短碎句、「不是 A，而是 B」机械对比、「命运的齿轮开始转动 / 空气仿佛凝固 / 眼中闪过一丝不易察觉的情绪」、同一意思车轱辘复述，或古人张口现代网络热梗。
   - **写入技能的约束**：`player-copy-polish.md` 将审校范围扩至结算总结卡、分享文案与提示弹窗，统一清理上述套话、机械排比与跨时代流行语。

---

## 四、写入运行时技能与留在仓库外的分工

- **写入运行时技能**：`novel-to-game`（锁定包形态、包体上限、商业化模式与本地浏览器调试页许可）、`game-design`（短局快入戏、商业化不伤主线因果、右上角胶囊安全区、首包/分包拆分与去科技模板皮）、`game-build`（按需加载 `minigame-and-taptap.md`、生图透明底与穿帮核验、去 AI 味文案审校）、`game-qa`（胶囊遮挡、双视口、广告中断、假选项与画面穿帮盲测）。
- **不写入运行时技能**：平台账号注册、软著与 ICP 备案办证步骤、买量投流与达人分佣后台操作、特定商业引擎的基础安装说明。
