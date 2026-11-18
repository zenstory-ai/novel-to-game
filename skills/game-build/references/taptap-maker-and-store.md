# TapTap 制造与 TapTap 商店构建规范

仅在目标为 TapTap 制造（TapTap Maker）、TapTap H5 小游戏或客户端包时使用。三者引擎与工具链不同，按简报锁定通道执行，禁混用。

## 1. TapTap 制造（TapTap Maker，`maker.taptap.cn`）

- **引擎与目录**：基于 **UrhoX + Lua 5.4** 纯代码引擎（非网页 DOM，亦非 `wx.*` 沙盒，禁拿网页冒充）。入口为 `scripts/` 下的 `main.lua`，界面优先用 `.ui.json`（`UI.Panel`、`UI.Sprite`、LuaTween），身份在 `.project/project.json`，本地绑定为 `.maker-mcp/config.json`。
- **CLI + Maker MCP + 开发包**：探测 `@taptap/maker`（`taptap-maker` CLI 或客户端插件）与会话 MCP（`maker://status` / `maker_status_lite`）。初始化走 `taptap-maker init`；克隆后**必先读工程内 `CLAUDE.md` 与 `urhox-libs/`**，参照 `examples/` 与 `templates/` 实现，禁臆造 API。缺失时跑 `taptap-maker dev-kit update`；dev-kit 默认不提交进 Maker Git。
- **资源 `.meta` 与尺寸**：资源入 `assets/{image,audio,video,model}`，配官方生成器产出的同名 `.meta`（24 位 URL-safe Base64 UUID），禁手写 UUID 或复制他处 `.meta`。无损压缩用 `taptap-maker image compress`（写新副本）；单图长边超 `2048 px`（尤忌 `4096 px`）拉高显存风险。
- **预览、积分门禁与云构建分离**：本地用共享 UrhoX Runtime（`taptap-maker preview install/start/refresh/logs --tail/validate/stop`，副本 `.maker-preview/source`）及工程 `run-lua-validate` 验收；窗口启动或 `COMPLETED` 不等于玩法通过，**本地预览与测试绝不授权 `commit`、`push` 或远端构建**。画布或 MCP 生图/视频/音配/3D（配音试听须用户挑定后才 `confirm_character_voice`）扣积分，**须用户明确授权**（CLI 传 `--allow-paid`），异常先查原任务不盲目重提。仅当用户明确要求提交/构建/出测试码时调 `maker_build_current_directory` 或 `generate_test_qrcode`。
- **0 分成激励广告**：云存档、排行榜、联机与防沉迷由平台托管。接广告先读 `maker://ads-integration-guide`，调 `get_ad_config` 对齐远端与本地 `@runtime.ad` 并做真机码验证；**禁与 H5 Open API MCP 混用**。

## 2. TapTap H5 小游戏与客户端包

- **TapTap H5 小游戏**：客户端 WebView 运行，打成根含 `index.html` 的 `.zip`（`≤ 20 MB`），包名及内部路径只用 `[A-Za-z0-9_.-]`（禁中文与空格）。可配 `@taptap/instant-games-open-mcp`（OAuth 扫码）上传并管排行榜、云存档与 H5 广告位（不与 Maker MCP 混用）。
- **TapTap 客户端包（Android / PC）**：原生导出或 Capacitor 封装（常用于试玩序章 + 买断完整版）；须先接 TapTap 登录取 `userIdentifier`，再初始化实名防沉迷与未成年人时段/时长拦截，无版号版本禁含内购充值。

## 3. 缺失本地环境时的边界

未装 `taptap-maker` / UrhoX Runtime 或未绑定账号时，禁拿网页冒充已构建的 Maker 工程；只走简报批准的替代原型，并在 `BUILD_BRIEF.md` 与 `qa/verification.json` 的 `limitations` 写明未跑的 UrhoX Runtime、云构建与真机广告验证。
