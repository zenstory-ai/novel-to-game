---
name: game-build
description: "Build a risk-matched whitebox or the approved production game for its target runtime. Turn GAME_DESIGN, and ART_DIRECTION when production begins, into a minimal BUILD_BRIEF and a runnable candidate that can be iterated with replayable evidence. Use for prototype the riskiest design question, implement the approved game design, or turn this design into a running game. 游戏构建执行。先按最大风险做白盒，或在正式生产时把批准后的 GAME_DESIGN 与 ART_DIRECTION 压缩成最小 BUILD_BRIEF，在目标运行环境中实现可运行候选并用可回放证据迭代。用于验证高风险设计问题、构建游戏原型或实现批准方案。"
---
# 游戏构建执行

保护已批准的体验边界；正式生产时再保护已批准的美术边界。驱动实现模型完成真实可玩的候选，不在
构建阶段重新做概念、关卡或美术方向。

读取 [build-brief-contract.md](references/build-brief-contract.md) 与
[playable-model-contract.md](references/playable-model-contract.md)。白盒阶段必须已有 `GAME_DESIGN.md`；
完整候选还必须已有 `ART_DIRECTION.md`。缺产品决定时回对应 owner，不在 BUILD_BRIEF 就地发明。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 目标与自由

按 PRODUCT_BRIEF 锁定的平台、生产引擎、目标运行时、显示/输入、范围、分级和联网边界交付。
目标工具链不可用时不得自动改做网页；只有 brief 已批准替代运行时才可使用，并分开记录
`targetRuntime`、`testedRuntime` 与未覆盖项。

正式生产继承美术方向的明度边界。非低照度题材不得在实现阶段擅自用全局黑罩、暗角、降曝光或低对比
小字制造“电影感”；夜景也要保留人物、器物、行动与结果可读性。确需偏暗的界面只按已批准范围实现，
并保留方向中约定的亮度或高对比 fallback。

时代题材的高风险画风先接入一张实际目标图并在目标视口确认，再批量生产。目标图已批准后，后续资产
必须继承同一时代世界、表现媒介、人物成熟度、身份锚点、光色和文本留白；不得把“当代审美”擅自实现成
现代服装／棚拍，也不得把“古风”擅自实现成古画旧化。用户否决方向时停止扩批，替换运行引用并清理被
否决资产，不能让旧图、试验图和批准图混在同一发布包。

BUILD_BRIEF 只压缩产品边界、必须保真的体验事实、运行方式与完成证据，实现细节交给实现模型。

先声明 `buildStage: whitebox|production` 与 `buildPath: template|custom`。已有交互语法只有在能保留原作
独有动作、代价和世界回应时才采用；实时手感、空间、视线、物理或模板覆盖不了的核心动词走 custom。
白盒也必须选择能验证最大风险的形态，不能把所有项目降成文游。

当前会话能编码时直接实现；外部模型不可用时只交付构建说明，不声称游戏已生成。不要发送与原型
无关的完整受版权保护原文。

## 按能力读取可选合同

- 语音策略不是 `none` 时读取 [tts-production-contract.md](references/tts-production-contract.md)。TTS
  优先构建期生成成本地资产；运行时远程合成须在 brief 批准，密钥只留受信服务端。
- 实际采用动态媒体时读取 [generative-media-pipeline.md](references/generative-media-pipeline.md)。已有批准
  参考图时以图约束；工具与模型按当前环境选择，不写成跨项目默认。

## 共同构建循环

1. 先实现一个最小但完整的核心循环：启动、真实输入、状态变化、结果和重开。范围不足时修范围，
   不先堆审计材料。
2. 先集中实现最小状态面与规则裁决器，再接表现层。模型可解释自由输入、提出候选动作或根据已提交结果
   写对白；只有规则器能提交资源、位置、知识、承诺、物件归属、胜负与事件日志。
   设计含 `signature_command` 时，先逐字继承 `id / label / intents / slots / validators / commit`，管线固定为
   “表述 → 有版本的候选结构 → schema/前置/知识/承诺验证
   → 执行阻力 → 确定性提交 → 叙述”；含混、冲突或越界候选返回澄清/拒绝且不提交，不能让关键词命中
   或模型 `effects` 直接改状态。
3. 固定内容/规则/存档版本、初态、seed 与输入序列；事件日志记录 action、观察者和前后状态摘要。专属
   命令还记录解析器版本、规范化候选、验证结果、执行轨迹和到期事项；回放消费已记录候选，不重新调用
   在线模型。试玩反馈定位到节点，局部 patch 后重放失败路径和相邻反例，不让未选分支进入历史。
4. 回写实际工具链、install/build/start 命令和版本；未知值写 `NOT_AVAILABLE: 原因`，不猜。

`whitebox` 到此只运行最窄的模型/回放检查与启动 smoke，输出结构化观察并交回 design owner；不调用
`game-qa`，不写或覆盖 `qa/verification.json`，也不把白盒通过冒充生产候选完成。设计修订后重放受影响
路径，直到最大风险已被实际暴露或当前方向被否决。

`production` 继续：

5. 提供一条权威验证命令和最小可观察状态，使 `game-qa` 能一次走完
   `clean start → 核心动作 → 设计结果 → restart`；构建阶段不预写 QA 结论或重复跑完整验收。
6. 运行最窄的开发检查与启动 smoke，修复构建失败、阻断日志、资源失败和崩溃；替代运行时未覆盖的
   目标平台输入、性能、打包或设备项写入 limitation。
7. 达到 brief 的 `targetFinish`；更高完成度只处理已批准的焦点资产和招牌时刻，不制造与可玩闭环
   无关的发布审计。
8. 交给 `game-qa` 只运行一次权威命令并写最终事实。时间、预算或生成调用用尽只会留下
   FAIL/NOT_RUN，不会生成 PASS。

连续 3D、语音、生成媒体、多语言与无障碍仅在实际采用时增加项目自己的回归检查。必需异步资产
加载或解码失败不得静默换灰盒仍宣称通过；可继续的 fallback 条件见 build-brief-contract.md。

## 输出

生成 `build/BUILD_BRIEF.md` 与实际候选；production 还生成权威验证入口。构建不生成最终 QA 结论。
截图、录制与 raw trace 只保留调试所需的最小集合；`game-qa` 是 production 完整路径与
`qa/verification.json` 的唯一 owner。
