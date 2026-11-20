# 微信小游戏与抖音小游戏构建规范

仅在目标为微信小游戏（`wx`）或抖音小游戏（`tt`）时使用。

## 运行时与个人主体约束

- **无 DOM 单画布沙盒**：无 `document`、HTML 与 CSS，严禁拿网页 DOM 冒充。微信含 `game.js`、`game.json` 及 `"compileType": "game"` 的 `project.config.json`；抖音含 `project.tt.json`。首次 `createCanvas()` 返回唯一上屏主画布；界面用 Canvas 2D、WebGL（配 `weapp-adapter` 或 `three-platformize`）或原生小游戏导出，兼顾触屏与 PC 小游戏缩放。同排文字与热区名签按 `measureText` 限宽换行并避开人物面部，立绘与图标保持原图比例不拉伸。
- **个人主体与纯单机默认**：个人开发者（微信认证 30 元/年、抖音个人实名入驻）严禁含内购充值代码；除简报另有批准外，默认做成**纯本地单机包**——存档走本地 `Storage`，资源走主包与本地分包，不依赖自建服务器或备案域名。

## 包体上限与分包

- **微信**：主包 `≤ 4 MB`，单个独立分包 `≤ 4 MB`，`game.json` 配 `subpackages` 时整包 `≤ 30 MB`（`openDataContext` 禁入分包）。
- **抖音**：主包 `≤ 4 MB`，`game.json` 配 `subPackages` 时整包 `≤ 20 MB`（不分包 `≤ 16 MB`）。两端分包键名大小写不同，须按平台分别生成 `game.json`，不混写重复键。
- 主包只放启动代码与首场轻资源；后续章节、立绘与音视频拆入带 `game.js` 入口的本地分包（`loadSubpackage`）并配加载降级。`test` 或 `verify` 实测磁盘主包与整包字节数，超限判失败，并扫描代码确保无残留 DOM 调用。

## 平台接口与提审必查项

- 视口（微信优先 `wx.getWindowInfo()`，回退 `getSystemInfoSync()`）、安全区与胶囊 `getMenuButtonBoundingClientRect()`、存储、切后台静音、分享 `shareAppMessage`、抖音录屏 `tt.getGameRecorderManager()` 与激励视频 `createRewardedVideoAd` 统一封装进单层适配模块，业务代码不直接散调 `wx.*` / `tt.*`。
- **右上角胶囊与安全区**：按 `safeArea` 与胶囊矩形内缩顶栏 HUD，暂停、返回、跳过、任务与资源栏一律避开右上角胶囊区。
- **抖音侧边栏复访**：启动调 `tt.checkScene({ scene: "sidebar" })`，不支持时隐藏入口；支持时在主界面设常驻入口与弹窗，进入前按钮显示「去侧边栏」（`tt.navigateToScene({ scene: "sidebar" })`），在 `tt.getLaunchOptionsSync()` 与 `tt.onShow` 两处检测 `launch_from === "homepage" && location === "sidebar_card"`，命中后改为「领取奖励」并写档防重领。
- **激励广告与空广告位**：微信流量主满 `500 UV` 或游戏圈互动达标才下发 `adUnitId`。为空时自动隐藏「看视频」字样，改为局内限次免费提示或直接重来，**严禁留着点不开的废广告按钮提审**，否则首审按功能异常打回；已配置时仅在 `isEnded === true` 发奖，中途关闭或拉起失败退回原选择点。

## 本地工具与调试页

除 `$PATH` 外一并检查应用目录（如 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`）；未登录或 `touristappid` 仅可本地 `open`，真机 `preview` 与 `upload` 需正式 AppID。无真机预览且简报批准替代环境时，配共用画布入口的浏览器调试页，不另写 DOM，`createImage` 返回原生 `Image` 且不包 `Proxy` 以免 `drawImage` 报错；页内画出右上角胶囊框，提供空广告位、激励视频看完与中途关闭、抖音侧边栏冷启动与热切回开关，将 `targetRuntime`、`testedRuntime` 与实测体积分开记入 `BUILD_BRIEF.md`。
