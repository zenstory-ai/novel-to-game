# 微信小游戏与抖音小游戏构建规范

仅在目标为微信小游戏（`wx`）或抖音小游戏（`tt`）时使用。

## 运行时与个人主体单机边界

- **无 DOM 单画布沙盒**：无 `document`、HTML 与 CSS，严禁拿网页 DOM 冒充。微信含 `game.js`、`game.json` 与 `"compileType": "game"` 的 `project.config.json`；抖音配 `project.tt.json`。首次 `createCanvas()` 返回唯一上屏主画布；界面用 Canvas 2D、WebGL（配 `weapp-adapter` 或 `three-platformize`）或原生导出，兼顾触屏与 PC 小游戏缩放。画布同排文字与热区名签须按 `measureText` 限宽折行并避开人物面部。
- **个人主体零后端默认**：个人开发者（微信 30 元认证、抖音个人实名入驻）禁含任何内购充值代码；除简报另批外，默认做**纯本地单机包**——存档走本地 `Storage`、资源走主包与本地分包，不依赖自购服务器或额外备案的外部 HTTPS 域名。

## 包体上限与分包

- **微信**：主包 `≤ 4 MB`，单个独立分包 `≤ 4 MB`，`game.json` 的 `subpackages` 整包 `≤ 30 MB`（`openDataContext` 禁入分包）。
- **抖音**：主包 `≤ 4 MB`，`game.json` 配 `subPackages` 整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包键名大小写不同，按平台各自生成 `game.json`，不混写重复键。
- 主包只放启动代码与首场轻资源；后续章节、立绘与音视频拆入带 `game.js` 入口的本地分包（`loadSubpackage`）并配降级方案。`test` 或 `verify` 实测磁盘主包与总包字节数，超限判败，并扫描代码无残留未适配 DOM 调用。

## 平台接口与审核必查项

- 视口（微信优先 `wx.getWindowInfo()`，回退 `getSystemInfoSync()`）、安全区与胶囊 `getMenuButtonBoundingClientRect()`、存储、切后台静音、分享 `shareAppMessage`、抖音录屏 `tt.getGameRecorderManager()` 与激励视频 `createRewardedVideoAd` 收进单层适配模块，业务不散调 `wx.*` / `tt.*`。
- **右上角胶囊与安全区**：按 `safeArea` 与胶囊矩形内缩顶栏 HUD，暂停、返回、跳过、任务与资源栏一律避开胶囊区。
- **抖音侧边栏复访**：启动调 `tt.checkScene({ scene: "sidebar" })`，不支持时隐藏入口；支持时设主界面常驻入口与弹窗，进入前按钮显示「去侧边栏」（`tt.navigateToScene({ scene: "sidebar" })`），在 `tt.getLaunchOptionsSync()` 与 `tt.onShow` 两处检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后切为「领取奖励」并写档防重领。
- **首审无广告位开关与激励容错**：微信流量主满 `500 UV`（或游戏圈互动）才下发 `adUnitId`。`adUnitId` 为空时自动隐藏「看视频」文案并切为局内限次免费提示/直接重来，**严禁留着点不开的废广告按钮提审（首审会因功能异常打回）**；已配置时仅在 `isEnded === true` 发奖，中途关闭或失败退回原选择点。

## 本地工具与调试页

除 `$PATH` 外一并探测应用目录（如 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`；未登录或 `touristappid` 仅可本地 `open`，真机 `preview`/`upload` 需登录正式 AppID）。无可用实机预览且简报批准替代环境时，另配共用画布入口的浏览器调试页（禁另写 DOM；`createImage` 返回原生 `Image`，禁包 `Proxy` 防 `drawImage` 报错），绘出胶囊框并提供「空 `adUnitId` 首审态 / 激励看完 / 关闭」及抖音侧边栏冷/热进入开关，`targetRuntime`、`testedRuntime` 与实测体积分开记入 `BUILD_BRIEF.md`。
