---
name: game-build
description: "Build a risk-matched whitebox or the approved production game for its target runtime. Turn GAME_DESIGN, and ART_DIRECTION when production begins, into a minimal BUILD_BRIEF and a runnable candidate that can be iterated with replayable evidence. Use for prototype the riskiest design question, implement the approved game design, or turn this design into a running game. 游戏构建执行。先针对头号设计风险搭建白盒原型，或在正式生产时将已批准的 GAME_DESIGN 与 ART_DIRECTION 提炼为精简的 BUILD_BRIEF，在目标运行环境中实现可运行版本并用可复现的实机记录迭代。用于验证高风险设计问题、构建游戏原型或实现已批准的设计方案。"
---
# 游戏构建执行

守住已批准的体验设计与美术方向边界，产出真实可玩的构建版本（白盒阶段须有 `GAME_DESIGN.md`，正式生产阶段还须有 `ART_DIRECTION.md`；上游决策缺失时退回补齐，不在 `BUILD_BRIEF.md` 里私自发明或重做设计）。先读 [build-brief-contract.md](references/build-brief-contract.md)。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 目标、路径与按需规范

严格按 `PRODUCT_BRIEF.md` 锁定的平台、引擎、运行环境、视口/输入、范围、分级和联网边界交付；目标工具链不可用时不得擅自改做网页版顶替，仅在 `PRODUCT_BRIEF.md` 明确批准替代运行环境时才可使用，并分别记清 `targetRuntime`、`testedRuntime` 与未覆盖特性。

构建前声明 `buildStage: whitebox|production` 与 `buildPath: template|custom`：仅当成熟模板能完整保留原著独有的动作、代价和世界反馈时才走 `template`；核心体验依赖实时手感、空间走位、视线遮挡、物理碰撞或独创动词时一律走 `custom`（白盒同样必须选用能真实检验最大风险的交互形态，绝不把所有项目降级为纯文字选项）。

正式生产阶段继承 `ART_DIRECTION.md` 与批准目标图：缺少现成位图素材时直接调用当前环境的图像生成工具（Codex 环境优先用内置 ImageGen），已有成套图标与适合代码绘制的简洁几何图形可复用；构建期生成的成品资产必须落盘到项目工作区并接入真实界面，严禁拿文字徽章、Emoji、未执行的提示词或云端任务链接冒充完工资产（白盒阶段的临时占位图须明确标明阶段属性；调用外部工具时只传当前资产所需输入，不上传无关的原著全文，也不把 API 密钥写进仓库）。当前会话无任何可用实现途径时，如实报告阻塞原因并仅交付 `BUILD_BRIEF.md`。

按项目实际用到的能力读取可选参考：
- Blender 可编辑 3D 资产：[blender-asset-workflow.md](references/blender-asset-workflow.md)（不为 3D 项目默认绑定 Blender 或强装 MCP）；
- 2.5D 多朝向/多动作序列帧烘焙：[baked-sprite-workflow.md](references/baked-sprite-workflow.md)；
- 生成式自由输入、知情权限、事件回放或存档迁移：[playable-model-contract.md](references/playable-model-contract.md)；
- 角色配音：[tts-production-contract.md](references/tts-production-contract.md)；
- 动态视频、生成式音乐或音效：[generative-media-pipeline.md](references/generative-media-pipeline.md)；选择后播放剧情过场（互动影游）再读 [cutscene-production.md](references/cutscene-production.md)。

## 构建循环

1. **落地状态与规则**：`whitebox` 只实现验证头号设计风险所需的真实输入、状态流转与反馈；`production` 完整实现 `GAME_DESIGN.md` 的状态、动作与结局闭环。
2. **固定复现与排障**：保留能稳定复现问题的初态与输入序列（涉及随机时固定 `seed`），修改后重跑原失败路径及相邻分支反例；同一手感或表现问题连续两次修改未果时，先检索成熟开源做法理清机制再改。
3. **回写工具链与对齐文档**：在 `BUILD_BRIEF.md` 如实回写实际工具链、版本号与命令（无法获取的版本填 `NOT_AVAILABLE: 原因`，严禁臆测）；若实现与设计/美术文档存在偏差，退回对应环节修订或在 `BUILD_BRIEF.md` 标明冲突。

`whitebox` 执行完第 3 步后运行最窄风险检查并交回设计负责人迭代；`production` 继续执行：

4. 提供权威 `verify` 命令与最小可观察状态接口，并运行冒烟自检清零构建报错、控制台阻断异常、资源加载失败与崩溃。
5. 对配有批准目标图的界面与核心资产，在目标视口下截实机图与目标图并排比对布局、比例、字体、色光与层级并修正（连续两轮无改善则停手记入 `limitations`，绝不篡改目标图迁就缺陷），最后移交 `game-qa`。
