---
name: game-build
description: "Build a risk-matched whitebox or the approved production game for its target runtime. Turn GAME_DESIGN, and ART_DIRECTION when production begins, into a minimal BUILD_BRIEF and a runnable candidate that can be iterated with replayable evidence. Use for prototype the riskiest design question, implement the approved game design, or turn this design into a running game. 游戏构建执行。先针对头号设计风险搭建白盒原型，或在正式生产时将已批准的 GAME_DESIGN 与 ART_DIRECTION 提炼为精简的 BUILD_BRIEF，在目标运行环境中实现可运行版本并用可复现的实机记录迭代。用于验证高风险设计问题、构建游戏原型或实现已批准的设计方案。"
---
# 游戏构建执行

守住已批准的体验设计边界（正式生产阶段同时守住已批准的美术方向），驱动代码实现产出真实可玩的构建版本，不在构建阶段私自重做概念选型、关卡设计或美术方向。

读取 [build-brief-contract.md](references/build-brief-contract.md)。白盒阶段必须已有 `GAME_DESIGN.md`，正式生产阶段还必须已有 `ART_DIRECTION.md`；若发现上游产品或设计决策缺失，退回对应负责环节补齐，不在 `BUILD_BRIEF.md` 里临时拍脑袋发明。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 目标与自由

严格按 `PRODUCT_BRIEF.md` 锁定的目标平台、生产引擎、运行环境、显示与输入方式、项目范围、内容分级和联网边界交付。当目标工具链在当前环境不可用时，不得擅自改做成网页版顶替；只有在 `PRODUCT_BRIEF.md` 明确批准了替代运行环境时才可使用，且必须分别记清 `targetRuntime`、`testedRuntime` 与尚未覆盖的目标平台特性。

正式生产阶段继承 `ART_DIRECTION.md` 的视觉约束与已批准的目标图，并在实机运行画面中逐项核验核心资产。当正式生产需要新绘位图且项目内无合适现成素材时，直接调用当前环境的图像生成工具（在 Codex 环境中优先使用内置 ImageGen）；已有的成套图标与适合用代码绘制的简洁几何图形可继续复用。生成的成品文件必须落盘保存到项目目录并接入真实游戏界面，不得拿文字徽章、Emoji 或未执行的生成提示词冒充已完工美术；白盒阶段的临时占位图须明确标明阶段属性。

`BUILD_BRIEF.md` 只提炼产品边界、必须保真的核心体验事实、启动与验证命令以及完成证据，具体代码组织方式交由实现模型自主决定。

构建前先声明 `buildStage: whitebox|production` 与 `buildPath: template|custom`。只有在成熟交互模板能够完整保留原著独有的动作、代价和世界反馈时，才可走 `template`；凡是核心体验依赖实时操作手感、空间走位、视线遮挡、物理碰撞或现有模板覆盖不了的独创动词，一律走 `custom`。白盒阶段同样必须选用能真实检验最大设计风险的交互形态，绝不能把所有项目都降级成纯文字选项游戏。

若当前会话具备代码与资产实现能力则直接动手构建，否则调用其他可用的实现工具；若确实没有任何可用实现途径，如实报告阻塞原因并交付构建说明文档，绝不谎称可玩版本已生成。调用外部工具时，切勿上传与当前原型无关的受版权保护原著全文。

## 按需读取专项规范

- 选用 Blender 制作或修改可编辑 3D 资产时，读取 [blender-asset-workflow.md](references/blender-asset-workflow.md)（不要一见 3D 项目就默认绑定 Blender 或强装 MCP 插件）。
- 涉及生成式自由输入、人物知情权限、事件回放、存档迁移或 `signature_command` 时，读取 [playable-model-contract.md](references/playable-model-contract.md) 的对应章节。
- 语音策略非 `none` 时，读取 [tts-production-contract.md](references/tts-production-contract.md)。
- 实际采用动态媒体（视频短片、生成式音乐或音效）时，读取 [generative-media-pipeline.md](references/generative-media-pipeline.md)；需要在玩家选择后播放剧情过场（互动影游）时，再读 [cutscene-production.md](references/cutscene-production.md)。
- 2.5D 角色或物件需要多朝向、多动作且造型高度一致的序列帧时，读取 [baked-sprite-workflow.md](references/baked-sprite-workflow.md)。

## 共同构建循环

1. **按阶段落地可玩版本**：`whitebox` 阶段只实现验证核心设计风险所需的真实输入、状态流转与界面反馈；`production` 阶段先打通「启动游戏 → 核心操作 → 达成设计结局 → 重开回到初始状态」的完整闭环。
2. **兑现设计状态与规则**：完整实现当前阶段涉及的 `GAME_DESIGN.md` 状态、动作与结算结果；若接入生成式模型，模型只负责解析输入和润色反馈文本，状态变更的唯一提交权归属确定性规则引擎。启用 `signature_command` 时同步落实专项规范中的专属校验边界。
3. **固定复现路径与卡点排查**：保留能稳定复现问题的初始状态与输入序列（涉及随机因素时固定 `seed`），修改后重跑原失败路径及相邻分支反例。若同一个操作手感或画面表现问题连续两次修改仍未见效，立即停止盲目试错，先查阅同类成熟商业作品处理该问题的公开技术分享（开发者演讲、技术复盘或开源实现），吃透底层原理后再动手实现。
4. **回写工具链与对齐文档**：在 `BUILD_BRIEF.md` 中如实回写实际使用的工具链、安装/构建/启动命令及版本号（无法获取的版本填 `NOT_AVAILABLE: 原因`，严禁臆测）。若实机实现与 `GAME_DESIGN.md`、`ART_DIRECTION.md` 的描述出现偏差，必须退回对应负责环节修订文档，或在 `BUILD_BRIEF.md` 中明确标出冲突，绝不留下描述与实机表现脱节的过期文档。

`whitebox` 阶段执行完第 4 步后，按 [build-brief-contract.md](references/build-brief-contract.md)「完成证据」运行最精简的风险检查并交回设计负责人；待设计局部修订后重跑受影响路径，直至核心风险验证完毕或该概念方向被正式否决。

`production` 阶段继续往下执行：

5. 提供一条权威验证命令（`verify`）与最小可观察状态接口，使 `game-qa` 能在单次运行中一气呵成走完 `clean start → 核心动作 → 设计结果 → restart`。
6. 运行开发自检与启动冒烟测试，清零构建报错、控制台阻断异常、资源加载失败与运行时崩溃；因使用替代运行环境而无法覆盖的目标平台专属输入、真机性能、安装包打包或硬件特性，如实记入 `limitations`。
7. 兑现 `PRODUCT_BRIEF.md` 锁定的 `targetFinish`；高完成度打磨集中在已批准的核心焦点资产与关键游戏时刻上，不搞脱离实机体验的纸面合规审查。凡是配有批准目标图的界面与核心资产，必须在目标视口尺寸下截取实机运行画面，与目标图并排逐项比对布局、比例、字体、色光与前后层级差异并做修正；若连续两轮调整仍无明显改善则果断停手，将剩余差异如实记入 `BUILD_BRIEF.md` 的限制说明，绝不篡改目标图去迁就实现缺陷。
8. 将构建产物移交 `game-qa`；问题排查、重跑测试与验收结果覆盖规则见「完成证据」。

## 输出

产出 `build/BUILD_BRIEF.md` 与可运行的游戏工程；`production` 阶段还须交付一键权威验证入口。调试截图、录屏与原始日志只保留定位问题所必需的最小集合。
