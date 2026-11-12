---
name: game-qa
description: "Blind-playtest and verify a game on its target runtime as a first-time player without reading source code. Run an isolated zero-knowledge playthrough first to uncover onboarding, guidance, interaction, pacing, and mobile viewport issues, then reconcile against design specs and record one complete-run verification receipt. Use for blind playtest a generated game, QA a game build as a new player, audit first-run playability, or verify a game build. 游戏实机盲玩与运行验收。先以未读源码与设计文档的新玩家身份在目标运行环境中从头盲玩，排查上手引导、交互动线、视听节奏与视口适配问题，再对照设计规范核实定性，并用单次完整通关记录生成验收凭证。用于新玩家视角盲测游戏、诊断实机体验问题或验收构建版本。"
---
# 游戏实机盲玩与运行验收

站在第一次打开游戏的真实玩家视角完成实机盲玩与通关验收，不做源码走读、不审查内部函数、也不替构建阶段补写单元测试，更不把跑通测试包装成“好玩、数值平衡、版权合规或达到商业上线水准”的定论。开始前先读 [blind-playtest-method.md](references/blind-playtest-method.md) 与 [qa-contract.md](references/qa-contract.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 两轮验收流程

优先在未参与编码的独立会话中执行。任何构建版本都必须跑通 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项实机检查与首轮冷启动盲玩（`targetFinish` 只代表视觉与制作完成度，不增减六项基础检查；`graybox` 同样执行冷启动盲玩，只免检最终美术与配音成色）：

1. **首轮隔离与开跑准备**：**首轮盲玩结束前，严禁读取游戏源码、剧本数据、测试脚本、`SOURCE_BIBLE.md`、`CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md`、`BUILD_BRIEF.md` 的 `# 必须保真 / # 最小实现与复现` 小节或内部状态快照**；只提取 `BUILD_BRIEF.md` `# 运行` 小节的启动命令、`targetRuntime`、`testedRuntime` 以及 `PRODUCT_BRIEF.md` 的视口与分级边界（两者前后矛盾时立即报错退回）。在仓库外建立独立的运行记录目录，每条命令显式传入字面路径与独立会话标识，避免跨命令丢失环境变量或串用浏览器存档。
2. **第一轮 · 新玩家实机盲玩**：按 [blind-playtest-method.md](references/blind-playtest-method.md) 从标题页纯净启动（绝不注入测试存档、调用内部跳过接口或偷看隐藏 DOM/内存变量），仅凭屏幕可见画面、声音表现与正常输入推进到至少一个设计结局，并实测刷新/重进后的存档恢复、重开回初态以及手机窄屏（如 `390×844`）关键路径。随步骤同步截取画面、收集控制台与请求报错，并用玩家口吻实时写下带时间戳的**出声思考日志**（含首屏五秒理解、每阶段 `0–4` 摩擦分、惊喜时刻与流失时刻）。
3. **第二轮 · 规范核对与权威验证**：首轮盲玩完整结束后，才读取 `GAME_DESIGN.md`、`ART_DIRECTION.md`、`PRODUCT_BRIEF.md` 与完整 `BUILD_BRIEF.md` 核对首轮记录的困惑，分清“功能缺陷或引导缺失”与“设计有意如此的规则边界”；随后在 `testedRuntime` 中运行 `BUILD_BRIEF.md` 声明的权威 `verify` 命令，核验从纯净初态到设计结局再重开的单次完整运行闭环。
4. **交付诊断报告与验收记录**：
   - 按 [blind-playtest-method.md](references/blind-playtest-method.md) 产出盲玩诊断报告 `qa/playtest-report.md`（过程连拍与原始日志留在仓库外运行目录，工作区 `qa/` 只存精简报告与证明问题的关键截图，严禁出现密码、令牌或 Cookie）。
   - 按 [qa-contract.md](references/qa-contract.md) 生成唯一的机器验收凭证 `qa/verification.json`，未覆盖范围如实记入 `limitations`。**若首轮盲玩证实存在 `P0` 阻断（如必经按钮被遮挡无法点击、主线死胡同、崩溃白屏），即便自动化脚本绕过界面跑通，对应 `checks` 项与顶层 `status` 均须标为 `FAIL`**；暴露的 `P0`/`P1` 及核心体验问题按 `product` / `design` / `art` / `build` 职责归属退回对应环节从根源修复。
