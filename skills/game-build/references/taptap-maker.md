# TapTap 制造构建规范

仅在目标为 TapTap 制造（TapTap Maker，`maker.taptap.cn`）时使用。

## 引擎架构与工程内文档

- **UrhoX + Lua 5.4 纯代码工程**：无网页 DOM，也不是微信 `wx.*` 沙盒，**严禁拿网页或 H5 JavaScript 代码冒充**。入口为 `scripts/` 下的 `main.lua`，界面优先用 `.ui.json`（`UI.Panel`、`UI.Sprite`、LuaTween），项目配置在 `.project/project.json`，本地绑定见 `.maker-mcp/config.json`。
- **只以工程内文档为准**：先检查本机 `@taptap/maker`（`taptap-maker` CLI 或插件）与会话 Maker MCP，可显式传 `target_dir` 调 `maker_status_lite` 或读 `maker://status`；初始化跑 `taptap-maker init`，仅新建项目加 `--create`。**写代码前必先读工程内的 `CLAUDE.md`、`urhox-libs/` 与 `engine-docs/`（含 `engine-docs/recipes/sdk.md`）**——Maker 无公网文档，**严禁搜微信或 H5 的 `tap.*` JavaScript 接口写进 Lua**。缺开发包时跑 `taptap-maker dev-kit update`，默认不提交进 Maker Git。

## 资源 `.meta` 与图片尺寸

- 资源放入 `assets/{image,audio,video,model}`，同目录配官方工具生成的同名 `.meta`（24 位 URL-safe Base64 UUID），严禁手编 UUID 或复制其他文件的 `.meta`。
- 无损压缩用 `taptap-maker image compress`（输出新副本）；单图长边超 `2048 px`（尤其超 `4096 px`）易撑满显存，须按实际显示尺寸控制大小。

## 本地预览、积分确认与云端构建

- **本地预览与验收**：调用本机共享 UrhoX Runtime 执行 `taptap-maker preview`（`start`、`refresh`、`logs --tail`、`validate`、`stop`，副本 `.maker-preview/source` 入 `.gitignore`），配合 `run-lua-validate` 检查截图与日志；窗口打开或返回 `COMPLETED` 不等于玩法合格，**本地预览绝不授权提交、推送或云端构建**。
- **扣积分须经用户同意**：通过画布或 MCP 生成图片、视频、音频、配音或 3D 模型会扣积分，**须先经用户明确同意**（CLI 传 `--allow-paid`；配音试听与 3D 多视图由用户挑定后才调 `confirm_character_voice` 或 `continue`）。任务异常先查原状态，不盲目重发扣费请求。
- **Git 与云端构建**：远端只接收 `main` 分支，不建功能分支或直接跑 `git push`；同步走 `taptap-maker git sync`（遇云端「塔拉拉」锁冲突时提示用户先在网页端提交，严禁删锁或死循环重试）。仅在用户明确要求提交、构建或出测试码时调 `maker_build_current_directory` 或 `generate_test_qrcode`。

## 0 分成广告与缺失环境处理

- **激励广告**：云存档、排行榜、联机与防沉迷由平台内置提供。接广告先调 `get_ad_config` 同步 `.project/settings.json` 的 `@runtime.ad`（缺 `app_id` 调一次 `generate_test_qrcode` 重试；`ad.status` 不为 `1` 时提示前往 `ad.url` 激活），再按 `engine-docs/recipes/sdk.md` 调 `sdk:ShowRewardVideoAd`，**仅在 `result.success == true` 时发奖**。
- **缺少本地工具时**：未装 `taptap-maker` / UrhoX Runtime 或未绑账号时，严禁拿普通网页冒充工程；只用简报批准的替代原型，并将未跑的 UrhoX Runtime、云端构建与真机广告记入 `limitations`。
