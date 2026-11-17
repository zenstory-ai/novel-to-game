# 微信小游戏、抖音小游戏与 TapTap 构建规范

仅在目标平台为微信小游戏、抖音小游戏或 TapTap 时使用。

## 运行时与包目录

- **微信（`wx`）与抖音（`tt`）小游戏**：无 DOM / BOM 单画布沙盒，无 `document`、HTML 与 CSS，严禁拿网页 DOM 冒充。微信含 `game.js`、`game.json` 与 `"compileType": "game"` 的 `project.config.json`；抖音配 `project.tt.json`。首次 `createCanvas()` 返回唯一上屏主画布；界面用 Canvas 2D / WebGL（配 `weapp-adapter` 或 `three-platformize`）或原生引擎导出，兼顾触屏与 PC 小游戏缩放。画布同排文字与热区名签须按 `measureText` 限宽折行并避开人物面部。
- **TapTap**：**H5 小游戏**打成根目录含 `index.html` 的 `.zip`（`≤ 20 MB`），包名及内部路径只用 `[A-Za-z0-9_.-]`（禁中文与空格）；**客户端（Android / PC）**用原生导出或 Capacitor。凡上架 TapTap 的版本（含无版号 H5 与免费/广告版）均须先走 TapTap 登录取 `userIdentifier`，再初始化防沉迷实名与未成年人时段/时长拦截；无版号版本禁含任何内购充值。

## 包体上限与分包

- **微信**：主包 `≤ 4 MB`，单个独立分包 `≤ 4 MB`，`game.json` 的 `subpackages` 整包 `≤ 30 MB`（`openDataContext` 禁入分包）。
- **抖音**：主包 `≤ 4 MB`，`game.json` 配 `subPackages` 整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包键名大小写不同，按平台各自生成 `game.json`，不混写重复键。
- 主包只放启动代码与首场必需轻资源；后续章节、立绘与音视频拆入带 `game.js` 入口的分包（`loadSubpackage`）或远程 HTTPS 按需加载并配降级方案。`test` 或 `verify` 实测磁盘主包与总包字节数，超限判败，并扫描微信/抖音代码无残留 DOM 调用。

## 平台接口与审核必查项

- 视口（微信优先 `wx.getWindowInfo()`，回退 `getSystemInfoSync()`）、安全区与胶囊 `getMenuButtonBoundingClientRect()`、存储、切后台静音、分享、抖音录屏 `tt.getGameRecorderManager()`、激励视频与 TapSDK 收进单层适配模块，业务不直调 `wx.*` / `tt.*`。
- **右上角胶囊与安全区**：按 `safeArea` 与胶囊矩形内缩顶栏 HUD，暂停、返回、跳过、任务与资源栏一律避开胶囊区。
- **抖音侧边栏复访**：启动调 `tt.checkScene({ scene: "sidebar" })`，不支持时隐藏入口；支持时设主界面常驻入口与弹窗，进入前按钮显示「去侧边栏」（`tt.navigateToScene({ scene: "sidebar" })`），在 `tt.getLaunchOptionsSync()` 与 `tt.onShow` 两处检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后切为「领取奖励」并写档防重领。
- **激励视频**：仅在 `isEnded === true` 时发奖；中途关闭、无填充或失败时退回原选择点，不卡死主线、不误发奖。

## 本地工具与调试页

除 `$PATH` 外一并探测应用目录（如 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`；未登录或 `touristappid` 仅支持本地 `open`，`preview` / `upload` 需登录正式 AppID）。无可用实机工具且简报批准替代环境时，除完整平台包外另配共用画布入口的浏览器调试页（禁另写 DOM 界面；`createImage` 返回原生 `Image`，禁包 `Proxy` 防 `drawImage` 报错），绘出胶囊遮挡框并提供激励视频完成/关闭及抖音侧边栏冷/热进入开关，`targetRuntime`、`testedRuntime` 与实测体积分开记入 `BUILD_BRIEF.md`。
