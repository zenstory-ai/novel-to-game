---
name: game-build
description: "Build the game for its approved target runtime. Compress GAME_DESIGN and ART_DIRECTION into a minimal BUILD_BRIEF, hand it to the current coding agent or another strong model to implement a fully playable build, and iterate against real runs and captured evidence. Use for implement the approved game design, build the game prototype, turn this design into a running game. 游戏构建执行。把批准后的 GAME_DESIGN 与 ART_DIRECTION 压缩成最小 BUILD_BRIEF，交给当前编码智能体或其他强模型，在选定的目标运行环境中实现可完整游玩的版本，并通过真实运行和证据迭代。用于把批准的游戏方案实现成可运行游戏。"
---
# 游戏构建执行

保护已批准的体验和美术边界，驱动实现模型完成真实可玩的候选；不在构建阶段重新做概念、关卡或
美术方向。

读取 [build-brief-contract.md](references/build-brief-contract.md)。必须已有 `GAME_DESIGN.md` 与
`ART_DIRECTION.md`；缺产品决定时回对应 owner，不在 BUILD_BRIEF 就地发明。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 目标与自由

按 PRODUCT_BRIEF 锁定的平台、生产引擎、目标运行时、显示/输入、范围、分级和联网边界交付。
目标工具链不可用时不得自动改做网页；只有 brief 已批准替代运行时才可使用，并分开记录
`targetRuntime`、`testedRuntime` 与未覆盖项。

BUILD_BRIEF 只压缩产品边界、必须保真的体验事实、运行方式与完成证据，实现细节交给实现模型。

当前会话能编码时直接实现；外部模型不可用时只交付构建说明，不声称游戏已生成。不要发送与原型
无关的完整受版权保护原文。

## 按能力读取可选合同

- 语音策略不是 `none` 时读取 [tts-production-contract.md](references/tts-production-contract.md)。TTS
  优先构建期生成成本地资产；运行时远程合成须在 brief 批准，密钥只留受信服务端。
- 实际采用动态媒体时读取 [generative-media-pipeline.md](references/generative-media-pipeline.md)。已有批准
  参考图时以图约束；工具与模型按当前环境选择，不写成跨项目默认。

## 最小完成循环

1. 先实现一个最小但完整的核心循环：启动、真实输入、状态变化、结果和重开。范围不足时修范围，
   不先堆审计材料。
2. 回写实际工具链、install/build/start 命令和版本；未知值写 `NOT_AVAILABLE: 原因`，不猜。
3. 提供一条权威验证命令和最小可观察状态，使 `game-qa` 能一次走完
   `clean start → 核心动作 → 设计结果 → restart`；构建阶段不预写 QA 结论或重复跑完整验收。
4. 运行最窄的开发检查与启动 smoke，修复构建失败、阻断日志、资源失败和崩溃；替代运行时未覆盖的
   目标平台输入、性能、打包或设备项写入 limitation。
5. 达到 brief 的 `targetFinish`；更高完成度只处理已批准的焦点资产和招牌时刻，不制造与可玩闭环
   无关的发布审计。
6. 交给 `game-qa` 只运行一次权威命令并写最终事实。时间、预算或生成调用用尽只会留下
   FAIL/NOT_RUN，不会生成 PASS。

连续 3D、语音、生成媒体、多语言与无障碍仅在实际采用时增加项目自己的回归检查。必需异步资产
加载或解码失败不得静默换灰盒仍宣称通过；可继续的 fallback 条件见 build-brief-contract.md。

## 输出

生成 `build/BUILD_BRIEF.md`、实际游戏和权威验证入口，不生成最终 QA 结论。截图、录制与 raw trace
只保留调试所需的最小集合；`game-qa` 是完整路径与 `qa/verification.json` 的唯一 owner。
