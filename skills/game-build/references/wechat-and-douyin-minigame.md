# 微信小游戏与抖音小游戏构建规范

仅在 `PRODUCT_BRIEF.md` 将目标定为微信小游戏（`wx`）或抖音小游戏（`tt`）时使用。

## 运行时与包目录

- 运行在无 DOM、无 BOM 的单画布 JavaScript 沙盒，无 `document`、HTML 与 CSS，严禁拿网页 DOM 冒充小游戏包。
- 微信工程须含 `game.js`、`game.json` 与声明 `"compileType": "game"` 的 `project.config.json`；抖音工程配 `project.tt.json`。
- 首次调用 `createCanvas()` 返回唯一上屏主画布，后续均为离屏画布；界面统一用 Canvas 2D、WebGL（配 `weapp-adapter` 或 `three-platformize`）或 Cocos / Godot 原生导出实现，兼容触屏与 PC 小游戏键鼠缩放。画布同排文字与热区名签须按 `measureText` 限宽折行并避开人物面部，防窄屏撞字。

## 包体上限与分包

- **微信小游戏**：主包 `≤ 4 MB`，单个独立分包 `≤ 4 MB`，`game.json` 的 `subpackages` 整包合计 `≤ 30 MB`（`openDataContext` 禁入分包）。
- **抖音小游戏**：主包 `≤ 4 MB`，`game.json` 配 `subPackages` 整包合计 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包字段大小写不同，按目标平台各自生成干净的 `game.json`，不混写重复键。
- 主包只放启动代码与首场必需极轻资源；后续章节、立绘与音视频拆入带 `game.js` 入口的分包（`loadSubpackage`）或远程 HTTPS 按需加载并配降级方案。`test` 或 `verify` 须实测磁盘主包与总包字节数，超限判败，并扫描业务代码确保不残留未适配的 DOM 调用。

## 平台接口与审核必查项

- 视口（微信优先 `wx.getWindowInfo()`，回退 `getSystemInfoSync()`）、安全区与胶囊坐标 `getMenuButtonBoundingClientRect()`、本地存储、切后台暂停音频、分享 `shareAppMessage`、抖音录屏 `tt.getGameRecorderManager()` 与激励视频 `createRewardedVideoAd` 统一收进单层适配模块，业务规则不散调 `wx.*` / `tt.*`。
- **右上角胶囊与安全区**：启动及窗口变化时按 `safeArea` 与胶囊矩形内缩顶栏 HUD，暂停、返回、跳过、任务与资源栏一律避开胶囊遮挡区。
- **抖音侧边栏复访**：启动时调 `tt.checkScene({ scene: "sidebar" })`，不支持或失败时隐藏入口；支持时在主界面设常驻入口与引导弹窗，进入前按钮显示「去侧边栏」并调 `tt.navigateToScene({ scene: "sidebar" })`，同时在 `tt.getLaunchOptionsSync()`（冷启动）与 `tt.onShow`（热切回）检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后按钮切为「领取奖励」，领完写档防重领。
- **激励视频容错**：仅在 `isEnded === true` 时发奖；中途关闭、无填充或拉起失败时退回原选择点，不卡死主线、不误发奖励。

## 本地工具探测与调试页

除 `$PATH` 外一并检查本机应用目录（如 macOS `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`；未扫码登录或用 `touristappid` 仅支持本地 `open`，真机 `preview` / `upload` 需登录正式小游戏 AppID）。无可用实机预览且简报批准本地替代环境时，除完整小游戏包外另配共用画布入口与模拟接口的浏览器调试页（禁另写 DOM 界面；`createImage` 返回原生 `Image`，禁包 `Proxy` 防 `drawImage` 报错），绘出胶囊遮挡框并提供激励视频完成/关闭及抖音侧边栏冷/热进入开关，`targetRuntime`、`testedRuntime` 与实测体积分开记入 `BUILD_BRIEF.md`。
