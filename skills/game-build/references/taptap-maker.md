# TapTap 制造构建规范

仅在目标为 **TapTap 制造（TapTap Maker，`maker.taptap.cn`）** 时使用。

## 引擎与工程内真相源

- **UrhoX + Lua 5.4 纯代码架构**：无网页 DOM，亦非 `wx.*` 沙盒，**禁拿网页或 H5 JS 冒充 Maker 工程**。入口为 `scripts/` 下的 `main.lua`，界面优先用 `.ui.json`（`UI.Panel`、`UI.Sprite`、LuaTween），身份在 `.project/project.json`，本地绑定为 `.maker-mcp/config.json`。
- **工程内文档是唯一 API 真相源**：探测 `@taptap/maker`（`taptap-maker` CLI 或插件）与会话 MCP（`maker_status_lite` 显式传 `target_dir`，或读 `maker://status`）。初始化走 `taptap-maker init`（仅新建项目加 `--create`）。**动代码前必先读工程内 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/`（含 `engine-docs/recipes/sdk.md`）**，参照 `examples/` 与 `templates/` 实现——Maker 无公网引擎文档，**严禁网页搜索照搬微信或 H5 的 `tap.*` JS 接口写进 Lua**。缺开发包跑 `taptap-maker dev-kit update`；dev-kit 默认不入 Maker Git。

## 资源 `.meta` 与显存

- 资源入 `assets/{image,audio,video,model}`，配官方生成器产出的同名 `.meta`（24 位 URL-safe Base64 UUID），禁手写 UUID 或复制他处 `.meta`。
- 无损压缩用 `taptap-maker image compress`（写新副本）；单图长边超 `2048 px`（尤忌 `4096 px`）拉高显存风险。

## 预览、积分门禁与云构建

- **本地预览与验收**：用共享 UrhoX Runtime（`taptap-maker preview install/start/refresh/logs --tail/validate/stop --target-dir <PROJECT> --json`，副本 `.maker-preview/source` 入 `.gitignore`）配 `run-lua-validate` 校验截图与日志；窗口启动或 `COMPLETED` 不等于玩法通过，**本地预览绝不授权提交、推送或云构建**。
- **积分门禁**：画布或 MCP 生图、视频、音配、3D 扣积分，**须用户明确授权**（CLI 传 `--allow-paid`；配音试听与 3D 多视图须用户挑定后才 `confirm_character_voice` 或 `continue`）。异常先查原任务，不盲目重提。
- **Git 与云构建**：远端只收 `main` 分支（禁建功能分支或裸跑 `git push`）；拉取走 `taptap-maker git sync`（遇云端「塔拉拉」锁冲突提示用户先在网页提交，禁删锁或死循环）。仅用户明确要求提交/构建/出测试码时调 `maker_build_current_directory` 或 `generate_test_qrcode`。

## 0 分成广告与无本地环境边界

- **激励广告**：云存档、排行榜、联机与防沉迷由平台托管。接广告先调 `get_ad_config` 同步 `.project/settings.json` 的 `@runtime.ad`（缺 `app_id` 时调一次 `generate_test_qrcode` 重试；`ad.status` 不为 `1` 提示 `ad.url` 待激活），再按 `engine-docs/recipes/sdk.md` 调 `sdk:ShowRewardVideoAd`，**仅在 `result.success == true` 时发奖**。
- **无本地环境时**：未装 `taptap-maker` / UrhoX Runtime 或未绑定账号时，禁拿网页冒充 Maker 工程；只走简报批准的替代原型，并在 `BUILD_BRIEF.md` 与 `qa/verification.json` 的 `limitations` 写明未跑 UrhoX Runtime、云构建与真机广告。
