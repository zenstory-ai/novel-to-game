---
name: game-qa
description: "Blind-playtest and verify a game on its target runtime as a first-time player without reading source code. Run an isolated first-time playthrough first to uncover onboarding, guidance, interaction, pacing, and mobile viewport issues, then reconcile against design specs and write one complete-run verification record. Use for blind playtest a generated game, QA a game build as a new player, audit first-run playability, or verify a game build. 游戏实机盲玩与运行验收。先以未读源码与设计文档的新玩家身份在目标运行环境中从头盲玩，排查上手引导、操作流程、视听节奏与视口适配问题，再对照设计规范核实定性，并用单次完整通关记录生成验收文件。用于新玩家视角盲测游戏、诊断实机体验问题或验收构建版本。"
---
# 游戏实机盲玩与运行验收

以第一次打开游戏的玩家身份完成实机盲玩与通关验收。不读源码，不替构建阶段补测试，也不把跑通说成好玩、数值平衡、版权合规或达到上线水准。先读 [blind-playtest-method.md](references/blind-playtest-method.md) 与 [qa-contract.md](references/qa-contract.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 流程

在没有参与编码的独立会话中执行。任何 `targetFinish` 都要跑通 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项检查与从头盲玩；`graybox` 只免检最终美术与配音成色。

1. **隔离**：首轮盲玩结束前，不读游戏源码、剧本数据、测试脚本、内部状态，也不读 `SOURCE_BIBLE.md`、`CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md`、`_progress.md`、以前的 `qa/playtest-report.md` 与提交历史。只从 `BUILD_BRIEF.md` 的 `# 运行` 一节取启动命令与运行环境，从 `PRODUCT_BRIEF.md` 取视口与分级边界；两者矛盾时报错退回。
2. **第一轮 · 盲玩**：在全新浏览器或窗口会话中从标题页启动，只凭屏幕画面、声音与正常输入玩到至少一个设计结局，并实测刷新后的存档恢复、重开回初态与手机窄屏的关键路径。不注入存档，不调内部接口，不看隐藏 DOM 或内存变量。
3. **第二轮 · 核对与验证**：盲玩结束后才读设计文档与完整的 `BUILD_BRIEF.md`，把首轮的困惑分成「实现或引导缺陷」与「设计有意的边界」；再在 `testedRuntime` 运行 `BUILD_BRIEF.md` 声明的端到端 `verify` 命令。
4. **交付**：诊断报告 `qa/playtest-report.md` 与唯一的机器可读验收记录 `qa/verification.json`，没覆盖到的范围如实记入 `limitations`。盲玩证实存在 `P0` 阻断时，即使脚本绕过界面跑通，对应检查与顶层 `status` 也记 `FAIL`。`P0`、`P1` 与核心体验问题按 `product` / `design` / `art` / `build` 归属退回，从根源修复。
