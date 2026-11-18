# TapTap 制造构建规范

仅在目标为 TapTap 制造（TapTap Maker，`maker.taptap.cn`）时使用。

## 引擎与工程内文档

- **UrhoX + Lua 5.4 纯代码架构**：无网页 DOM，亦非微信 `wx.*` 沙盒，**严禁拿网页或 H5 JavaScript 代码冒充**。入口为 `scripts/` 下的 `main.lua`，界面优先用 `.ui.json`（`UI.Panel`、`UI.Sprite`、LuaTween），身份在 `.project/project.json`，本地绑定为 `.maker-mcp/config.json`。
- **只以工程内文档为接口依据**：探测本机 `@taptap/maker`（`taptap-maker` CLI 或插件）与会话 Maker MCP（调 `maker_status_lite` 显式传 `target_dir`，或读 `maker://status`）。初始化走 `taptap-maker init`（仅新建项目加 `--create`）。**动代码前必先读工程内的 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/`（含 `engine-docs/recipes/sdk.md`）**——Maker 无公网引擎文档，**严禁网页搜索把微信或 H5 的 `tap.*` JavaScript 接口写进 Lua**。缺本地开发包时跑 `taptap-maker dev-kit update`；开发包默认不提交进 Maker Git。

## 资源 `.meta` 与图片尺寸

- 资源放入 `assets/{image,audio,video,model}`，旁配官方生成器产出的同名 `.meta`（24 位 URL-safe Base64 UUID），严禁手写 UUID 或复制其他文件的 `.meta`。
- 无损压缩用 `taptap-maker image compress`（输出新副本）；单图长边超 `2048 px`（尤其超 `4096 px`）易占满显存，须按实际用途控制尺寸。

## 本地预览、扣费确认与云端构建

- **本地预览与验收**：用本机共享 UrhoX Runtime 执行 `taptap-maker preview`（`start`、`refresh`、`logs --tail`、`validate`、`stop`，副本 `.maker-preview/source` 入 `.gitignore`），配合 `run-lua-validate` 校验截图与日志；窗口启动或返回 `COMPLETED` 不等于玩法通过，**本地预览绝不授权提交、推送或云端构建**。
- **消耗积分须经用户同意**：调用画布或 MCP 生成图片、视频、音频、配音或 3D 模型会扣积分，**须先经用户明确同意**（CLI 传 `--allow-paid`；配音试听与 3D 多视图须由用户挑定后才调 `confirm_character_voice` 或 `continue`）。异常先查原任务状态，不盲目重提请求。
- **Git 与云端构建**：远端只收 `main` 分支（禁建功能分支或裸跑 `git push`）；拉取走 `taptap-maker git sync`（遇云端「塔拉拉」锁冲突时提示用户先在网页端提交，禁删锁或死循环重试）。仅在用户明确要求提交、构建或出测试码时调 `maker_build_current_directory` 或 `generate_test_qrcode`。

## 0 分成广告与缺失环境边界

- **激励广告**：云存档、排行榜、联机与防沉迷由平台统一提供。接广告先调 `get_ad_config` 同步 `.project/settings.json` 的 `@runtime.ad`（缺 `app_id` 调一次 `generate_test_qrcode` 重试；`ad.status` 不为 `1` 提示 `ad.url` 待激活），再按 `engine-docs/recipes/sdk.md` 调 `sdk:ShowRewardVideoAd`，**仅在 `result.success == true` 时发奖**。
- **缺少本地环境时**：未装 `taptap-maker` / UrhoX Runtime 或未绑定账号时，不得拿网页冒充工程；只走简报批准的替代原型，并将未跑的 UrhoX Runtime、云端构建与真机广告记入 `limitations`。
