---
name: game-build
description: "Build the game for its approved target runtime. Compress GAME_DESIGN and ART_DIRECTION into a minimal BUILD_BRIEF, hand it to the current coding agent or another strong model to implement a fully playable build, and iterate against real runs and captured evidence. Use for implement the approved game design, build the game prototype, turn this design into a running game. 游戏构建执行。把批准后的 GAME_DESIGN 与 ART_DIRECTION 压缩成最小 BUILD_BRIEF，交给当前编码智能体或其他强模型，在选定的目标运行环境中实现可完整游玩的版本，并通过真实运行和证据迭代。用于把批准的游戏方案实现成可运行游戏。"
---
# 游戏构建执行

保护已批准的体验和美术边界，驱动实现模型完成真实可玩的候选；不规定它已经掌握的框架知识，也
不在构建阶段重新做概念、关卡或美术方向。

读取 [build-brief-contract.md](references/build-brief-contract.md)。必须已有 `GAME_DESIGN.md` 与
`ART_DIRECTION.md`；缺产品决定时回对应 owner，不在 BUILD_BRIEF 就地发明。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 目标与自由

按 PRODUCT_BRIEF 锁定的平台、生产引擎、目标运行时、显示/输入、范围、分级和联网边界交付。
目标工具链不可用时，不得自动改做网页；只有 brief 已批准替代运行时才可使用，并分开记录
`targetRuntime` / `testedRuntime` 和未覆盖项。

BUILD_BRIEF 只压缩：玩家承诺、核心循环、会改变结果的不变量、招牌时刻、范围/非目标、运行方式、
`targetFinish`、`assuranceProfile` 和完成证据。架构、文件拆分、渲染技术与资产管线由实现模型决定。

当前会话能编码时直接实现；外部模型不可用时只交付构建说明，不声称游戏已生成。不要发送与原型
无关的完整受版权保护原文。

## 按能力读取可选合同

- 语音策略不是 `none` 时读取 [tts-production-contract.md](references/tts-production-contract.md)。TTS
  优先构建期生成成本地资产；运行时远程合成须在 brief 批准，密钥只留受信服务端。
- 有动态媒体台账时读取 [generative-media-pipeline.md](references/generative-media-pipeline.md)。已有批准
  参考图时以图约束，不把供应商写成跨项目默认。
- 批准实时生成式 3D 生物时读取
  [generated-3d-creature-pipeline.md](references/generated-3d-creature-pipeline.md)，先做一个代表资产 spike。
- 常规生产技法按需读取 [production-techniques.md](references/production-techniques.md)，不要全部变成
  当前项目门禁。

## 最小完成循环

1. 先实现一个最小但完整的核心循环：启动、真实输入、状态变化、结果和重开。范围不足时修范围，
   不先堆视觉审计。
2. 回写实际工具链、install/build/start 命令和版本；未知值写 `NOT_AVAILABLE: 原因`，不猜。
3. 定义并运行一条**权威验证命令**，在 `qa/verification.json` 记录 command 和 exit code。完整运行
   路径的结果证据比保存冗长测试日志更重要；失败输出只用于修复，不默认长期提交。
4. 从 `clean start → 核心动作 → 设计结果 → restart` 跑一条完整路径，用最少语义 checkpoint 记录
   状态、runtime 和必要画面。取不到写 limitation，不用截图证明隐藏状态。
5. 在 `testedRuntime` 启动真实游戏，修复构建失败、阻断日志、资源失败和崩溃；替代运行时未覆盖的
   目标平台输入/性能/打包项保持 NOT_RUN。
6. 达到 brief 的 `targetFinish`：graybox 允许明确视觉缺口；更高 finish 只处理批准的焦点资产和招牌
   时刻。不要在构建交接里额外制造源码指纹、公网投递或评审证据。
7. 复跑权威命令和完整路径，更新当前限制。时间、预算或生成调用用尽只会留下 FAIL/NOT_RUN 或
   降低公开声明，不会生成 PASS。

连续 3D、语音、生成媒体、多语言与无障碍仅在实际采用时增加相应检查。必需异步资产加载/解码
失败不得静默换灰盒仍宣称通过；只有 ledger 预先批准且保持核心动作、状态、结果、可读反馈与重开的
fallback 才能继续。

## 输出

生成 `build/BUILD_BRIEF.md`、实际游戏和紧凑 `qa/verification.json`。证据必须在工作区持久路径；
截图、录制与 raw trace 只保留当前声明引用的最小集合，可重建中间产物不长期提交。BUILD_BRIEF
完成后回写实际命令、验证结果、limitations 与最终范围差异；范围变化回设计确认。

`smoke` 只要求六项可玩闭环；`delivery` 累加目标运行时/显示/上手；`release` 累加目标设备性能、
必要资产失败降级和独立试玩。构建阶段不自行写最终 QA 结论，只把候选和事实交给 `game-qa`。
