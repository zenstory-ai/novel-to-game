---
name: game-qa
description: "Blind-playtest and verify a game on its target runtime as a first-time player without reading source code. Runs an isolated cold-start playthrough to catch onboarding, interaction, pacing, and mobile viewport issues, checks findings against the design specs, and writes a complete-run verification record. Use to blind-playtest a game build as a new player, audit first-run playability, or run end-to-end game QA. 游戏盲玩与通关验收：先以未读源码和策划案的新玩家身份从头盲玩，排查上手引导、交互卡点、视听穿帮与手机视口问题，再对照策划案区分缺陷与设计边界，并实跑生成单次完整通关的验收记录。"
---
# 游戏盲玩与通关验收

以第一次点开游戏的新玩家视角完成盲玩与通关验收。不读源码，不替构建阶段补写测试，也不把跑通流程说成好玩、数值平衡、版权合规或已达上线水准。先读 [blind-playtest-method.md](references/blind-playtest-method.md) 与 [qa-contract.md](references/qa-contract.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 流程

在与编码隔离的独立会话中执行。无论哪种 `targetFinish`，都必须跑完从头盲玩与 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项检查；`graybox` 仅免检最终美术与配音成色。

1. **冷启动隔离**：首轮盲玩结束前，严禁读取游戏源码、剧本数据、测试脚本、内部状态，也严禁读取 `SOURCE_BIBLE.md`、`CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md`、`_progress.md`、过往的 `qa/playtest-report.md` 及提交记录。只从 `BUILD_BRIEF.md` 的 `# 运行` 一节读取启动命令与运行环境，从 `PRODUCT_BRIEF.md` 读取视口与分级要求；两处矛盾时直接报错退回。
2. **第一轮 · 新玩家盲玩**：在全新浏览器或窗口会话中从标题页启动，全靠屏幕画面、声音与正常操作打通至少一个设计结局，并实测刷新后的存档恢复、重开回初态及手机窄屏下的关键路径。不注入存档，不调内部接口，也不偷看隐藏 DOM 或内存变量。
3. **第二轮 · 对照核实与端到端验证**：盲玩跑完后才读取全套设计文档与完整 `BUILD_BRIEF.md`，把首轮遇到的卡点拆清为「实现或引导缺陷」与「设计有意的边界」；随后在 `testedRuntime` 执行 `BUILD_BRIEF.md` 声明的端到端 `verify` 命令。
4. **交付**：输出盲玩诊断报告 `qa/playtest-report.md` 与机器可读验收记录 `qa/verification.json`，未实测的范围如实写入 `limitations`。只要盲玩证实存在 `P0` 阻断，哪怕自动化脚本绕开界面跑通，对应检查项与顶层 `status` 也一律记 `FAIL`。`P0`、`P1` 及核心体验硬伤按 `product` / `design` / `art` / `build` 归属退回，从源头修复。
