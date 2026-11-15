---
name: game-build
description: "Build the approved game design into a complete, runnable game using the local environment's available rendering stacks, 3D/2D generators, and modeling tools. Turn GAME_DESIGN and ART_DIRECTION into a playable graybox first, then the finished game with rule regressions, one end-to-end verify command, and a concise BUILD_BRIEF. Use for implement the approved game design, prototype the riskiest design question, or turn this design into a running 2D, 2.5D, or 3D game. 游戏构建执行。结合本机与当前运行环境实际可用的渲染栈与生成/建模工具（如 Three.js、图生 3D 模型、Blender、2D/音视频工具），把已批准的 GAME_DESIGN 与 ART_DIRECTION 先做成可玩通的灰盒，再实现为完整可运行的游戏并配齐规则回归与端到端验证命令。用于验证核心设计风险、构建游戏原型或实现正式可玩版本。"
---
# 游戏构建执行

把已批准的 `GAME_DESIGN.md` 与 `ART_DIRECTION.md` 实现为目标平台上可完整游玩的游戏。架构、框架、数据结构、渲染方式与测试组织都由你决定，不设模板。灰盒只需要 `GAME_DESIGN.md`，接入美术之前须有 `ART_DIRECTION.md`；上游决定缺失或与实现冲突时退回 `game-design` 修订，不在代码或 `BUILD_BRIEF.md` 里暗自重做设计。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 环境与选型

动手前盘点本机与会话实际能调用的运行时、渲染库、命令行、MCP 与生成服务（生图、图生 3D、Blender、视频、音乐、语音），在 `PRODUCT_BRIEF.md` 批准的平台内选最能兑现作品气质的路线：核心乐趣在空间、手感或镜头上的，就做成真正的 2D、2.5D 或 3D 画面，不压成文字选项。目标工具链缺失时不擅自改做网页版，只走简报已批准的替代环境，并分开记录 `targetRuntime` 与 `testedRuntime`；完全无法构建时说明阻塞原因，只交付 `BUILD_BRIEF.md`。

生成预算优先投向主角、核心地标与关键演出。成品资源保存到工作区并接进真实画面，正式版不留占位图、坏链或没执行的提示词。调用外部工具只传当前资产需要的描述与参考图，不外传原著全文，密钥不进仓库。用到视频过场、生成音乐音效或配音时读 [generative-media.md](references/generative-media.md)。

## 构建顺序

1. **先灰盒玩通**：用最轻的占位把核心循环做到能从初态玩到结局——灰盒同样用真实的空间与操作，不以文字原型代替——交给未读设计与源码的独立会话从头试玩。看不懂、玩不通或核心乐趣不成立就先修（属于设计的问题退回 `game-design`），不带着这些问题投入美术。`targetFinish: graybox` 时灰盒即交付，跳过第 2 步的美术量产。
2. **完整实现并打磨**：实现 `GAME_DESIGN.md` 的全部状态、动作、分支与结局，接入美术、演出与声音；在目标视口亲手玩，看实机截图修到位；有批准目标图的界面与目标图并排比对，连续两轮无改善就停手记入限制，不改目标图迁就实现。必需资产加载失败要显式报错；可降级资产切到替代方案后，核心体验仍须成立。
3. **审校上屏文字**：按 [player-copy-polish.md](references/player-copy-polish.md) 通查所有玩家看得见的文案。
4. **自测与验证入口**：为会改变结果的规则、数值门槛、分支汇流与结局条件写回归；提供一条端到端 `verify` 命令，从全新初始状态用真实操作连续跑通启动、渲染、输入、核心循环、到达设计结局与重开回初态（即 `game-qa` 的六项检查，记录格式由它规定）。命令支持指定结果输出路径，无论成败都整份重写，不残留旧 `PASS`，也不预填结果；构建自测把自测记录写到 `qa/` 之外，正式的 `qa/verification.json` 只由 `game-qa` 在盲玩之后运行同一条命令写入。
5. **写 `BUILD_BRIEF.md`**（骨架见 [build-brief-contract.md](references/build-brief-contract.md)），移交 `game-qa` 做独立盲玩验收。

## 按需规则

- **接入玩家自由打字输入**：模型只把玩家的表述解析成预设的几种标准动作，或把已结算的事实润色成台词；时间、资源、位置、物品、知情、承诺与胜负一律由固定规则判定。解析结果先过前置条件、在场与知情范围、原著硬边界的校验，不通过就追问或拒绝，不因关键词命中把否定句判成相反的行动；模型生成的摘要或好感估值不写入正式状态。回放与校验从标准动作跑起，不重新调用模型；为否定句、缺失对象、篡改原著事实、向不在场角色泄密各写一条回归。
- **存档**：节点、状态含义或结算规则变更后，迁移旧档或明确拦截并提示不兼容，不静默读取。
- **连续行走的场景**：底图、可走区域、角色脚底锚点、交互热区与小地图共用一套坐标，画面上的道路、桥面、水岸与建筑边界和通行判定逐处对齐，重绘地图后同步校准阻挡、触发点与旧档坐标；寻路从角色当前位置沿合法道路走完，寻路失败时不得直接穿墙或瞬移敷衍过去。
- **Blender MCP**：配置了不代表连得上，修改前先读一次场景确认；它有本机执行权限，本地端口不暴露公网，不运行来源不明资产包里的脚本。
