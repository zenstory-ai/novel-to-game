# 微信小游戏、抖音小游戏与 TapTap 构建规范

仅在 `PRODUCT_BRIEF.md` 将目标定为微信小游戏、抖音小游戏或 TapTap（H5 小游戏或客户端包）时使用。

## 运行时与包目录

- **微信（`wx`）与抖音（`tt`）小游戏**：运行在无 DOM、无 BOM 的单画布沙盒，无 `document`、HTML 与 CSS，严禁拿网页 DOM 冒充小游戏包。目录须含 `game.js`、`game.json` 及工具配置（声明 `"compileType": "game"` 的 `project.config.json`）。首次 `wx.createCanvas()` / `tt.createCanvas()` 返回唯一上屏主画布，后续均为离屏画布；界面统一用 Canvas 2D、WebGL（如 PixiJS、配 `weapp-adapter` 或 `three-platformize` 的 Three.js）或 Cocos / Godot 原生导出实现，兼容触屏与 PC 小游戏键鼠缩放。画布文字无自动流式避让，同排文案与热区名签须按 `measureText` 限宽折行并避开人物面部，防窄屏撞字。
- **TapTap**：**H5 小游戏**运行于客户端 WebView，可用标准 Web / Canvas / WebGL 并打成单体 `.zip`；**客户端（Android / PC）**用原生导出或 Capacitor 封装，预留 TapSDK 登录与实名防沉迷入口。

## 包体上限与分包校验

- **微信小游戏**：主包 `≤ 4 MB`，`game.json` 的 `subpackages` 合计 `≤ 30 MB`。
- **抖音小游戏**：主包 `≤ 4 MB`，`game.json` 配 `subPackages` 时整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。
- **TapTap H5 小游戏**：上传 `.zip` 包体 `≤ 20 MB`。
- 主包只放启动代码、必需图集与首场极轻资源；后续章节、高清立绘、长音频与视频拆入分包（`loadSubpackage`）或远程 HTTPS 按需加载，失败时切回批准的降级态。`test` 或 `verify` 须实测磁盘主包与总包字节数，超限判败，并扫描微信/抖音业务代码确保不残留未适配的 DOM 调用。

## 平台接口封装与必接能力

- 把画布视口、安全区与胶囊坐标 `getMenuButtonBoundingClientRect()`、存储 `getStorageSync` / `setStorageSync`、音频 `createInnerAudioContext` 与切后台暂停、分享 `shareAppMessage`、抖音录屏 `tt.getGameRecorderManager()`、激励视频 `createRewardedVideoAd` 及 TapSDK 登录防沉迷装进一层适配模块，业务规则不散调 `wx.*` / `tt.*`。
- **右上角胶囊与安全区**：启动及窗口变化时读取 `safeArea` 与胶囊矩形，动态下移或内缩顶栏 HUD，绝不把暂停、返回、跳过、任务追踪或资源栏画在胶囊遮挡区。
- **抖音侧边栏复访（必接审核项）**：主界面设常驻入口与引导弹窗，先调 `tt.checkScene({ scene: "sidebar" })` 校验可用，点击调 `tt.navigateToScene({ scene: "sidebar" })`，并在 `tt.onShow` 命中 `launch_from === "homepage" && location === "sidebar_card"` 时发奖、写档防重领。
- **广告与解锁容错**：激励视频仅在 `isEnded === true` 时发奖；中途关闭、无填充或拉起失败时恢复原界面与原决策态，不卡死主线、不误发奖励。

## 本地浏览器调试页

本机有目标导出链或开发者工具 CLI 时直接实跑；缺失且简报批准本地替代环境时，除完整小游戏或 TapTap 包目录外，另配一个共用画布入口与模拟接口的浏览器调试页（禁另写 DOM 界面；`createImage` 须返回原生 `Image`，勿包 `Proxy` 以免 `drawImage` 报错），按胶囊坐标绘出右上角遮挡框，并提供激励视频「看完 / 中途关闭」与抖音「侧边栏复访」开关，供灰盒、`verify` 与 `game-qa` 实测。`BUILD_BRIEF.md` 分开写明 `targetRuntime`、`testedRuntime` 与实测包体体积。
