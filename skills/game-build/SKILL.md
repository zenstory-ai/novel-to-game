---
name: game-build
description: "Build an approved game spec into a complete, runnable game using the rendering libraries, mini-game or TapTap Maker toolchains, modeling tools, and media generators available locally. Turns GAME_DESIGN and ART_DIRECTION into a playable graybox first, then the finished build with rule regressions, an end-to-end verify command, and BUILD_BRIEF. Use to implement an approved game spec, graybox core gameplay, or build a 2D, 2.5D, 3D, WeChat/Douyin mini-game, or TapTap Maker game. 游戏构建执行：调用本机可用的渲染库、微信/抖音小游戏或 TapTap 制造工具链及建模/生成工具（Three.js、UrhoX+Lua、Blender、图生 3D、2D 画布与音视频工具等），把已定稿的 GAME_DESIGN 与 ART_DIRECTION 先做成可玩灰盒，再完成目标平台正式构建、游戏内文案审校、规则回归与端到端验证脚本。"
---
# 游戏构建执行

把已批准的 `GAME_DESIGN.md` 与 `ART_DIRECTION.md` 做成目标平台上可完整游玩的游戏。代码架构、框架、数据结构、渲染方式与测试组织均由你自主决定，不设固定模板。灰盒只需 `GAME_DESIGN.md`，铺正式美术前须有 `ART_DIRECTION.md`；上游决定缺失或与实现冲突时退回 `game-design` 修订，不在代码或 `BUILD_BRIEF.md` 里私自改设计。

产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。

## 环境与选型

动手前先检查本机与当前会话实际可调用的运行时、渲染库、命令行工具、MCP 与生成服务（生图、图生 3D、Blender、视频、音乐、配音），在 `PRODUCT_BRIEF.md` 批准的平台内选最能做出作品味道的技术方案：核心乐趣在空间探索、操作手感或镜头调度上的，就做成真正的 2D、2.5D 或 3D 画面，不偷懒压成纯文字选项。目标工具链缺失时不擅自改做普通网页，只用简报事先批准的替代环境，并分开记清 `targetRuntime` 与 `testedRuntime`；完全无法构建时写明阻塞原因，只交付 `BUILD_BRIEF.md`。

生成额度优先花在主角、核心地标与关键演出上。成品资源存入工作区并接进实机画面，正式版不留占位图、坏链接或未执行的提示词。调外部生成服务只传当前资产所需的描述与参考图，绝不外传原著全文，密钥不入库。涉及视频过场、生成音乐音效或配音时读 [generative-media.md](references/generative-media.md)；构建微信或抖音小游戏时读 [wechat-and-douyin-minigame.md](references/wechat-and-douyin-minigame.md)；构建 TapTap 制造（TapTap Maker）工程时读 [taptap-maker.md](references/taptap-maker.md)。

## 构建顺序

1. **先灰盒跑通**：用最轻的占位资源把核心循环做成能从开局打到结局的灰盒（保留真实空间与操作，不用文字原型顶替），并用语义色与清晰剪影区分主角、目标、威胁与可交互物；交给没读过策划案与源码的独立会话试玩，同步做「去字可玩检验」——先实际隐藏教学与目标文案，在无字状态下排查主次视觉元素是否抢焦、仅靠画面结构与操作反馈能否大体看懂核心循环，确认后再补精炼短签与桌面必需的内联键帽。看不懂、玩不通或核心乐趣立不住就先补视觉与交互信号或退回 `game-design` 修订，不靠堆解释文字找补，也不带着硬伤量产美术。`targetFinish: graybox` 时灰盒即交付物，跳过第 2 步的美术量产。
2. **完整实现与打磨**：实现 `GAME_DESIGN.md` 的全部状态、动作、分支与结局，接入美术、演出与音效；生图与三维资产入包前逐件核验，筛掉灰白棋盘格假透明底、白边锯齿、多指与五官畸变、牌匾书卷乱码字及跨时代服饰，不合格就重出或裁切，绝不带病上屏；在目标视口亲手试玩、对照实机截图修到位；有已定视觉目标图的界面与目标图并排比对，连续两轮无明显改善就停手记入限制，不篡改目标图迁就实现。必需资产加载失败须显式报错；可降级资产切到备选方案后，核心体验仍须完整。
3. **审校上屏文字**：对照 [player-copy-polish.md](references/player-copy-polish.md) 通查所有玩家可见文字，删去说明书式长注与跨控件复述、压实文案密度。
4. **自测与验证入口**：为改变结果的规则、数值门槛、分支汇流与结局条件补齐回归测试；提供一条端到端 `verify` 命令，从全新初始状态用真实操作连续跑完启动、渲染、输入、核心循环、到达设计结局与重开回初态（对应 `game-qa` 的六项检查，记录格式从其规范）。该命令须支持指定输出路径，无论成败都整份重写，不残留旧 `PASS`，也不预填结果；构建期自测输出到 `qa/` 目录之外，正式的 `qa/verification.json` 只由 `game-qa` 在盲玩结束后调用同一命令生成。
5. **编写 `BUILD_BRIEF.md`**（结构见 [build-brief-contract.md](references/build-brief-contract.md)），移交 `game-qa` 执行独立盲玩验收。

## 按需规则

- **接入玩家自由打字输入**：模型只负责把玩家原话解析成预设的几种标准动作，或把已结算的结果润色成台词；时间、资源、位置、物品、知情、承诺与胜负一律由固定规则判定。解析结果先过前置条件、在场人物、知情范围与原著硬边界校验，不过关就反问或驳回，不因命中关键词把否定句判成相反动作；模型生成的摘要或好感估值一律不写入正式状态。回放与自动验证直接从标准动作跑起，不重调模型；为否定句、缺失对象、篡改原著事实、向不在场角色泄密各写一条回归测试。
- **存档兼容**：节点、状态字段或结算规则改动后，要么自动迁移旧档，要么明确拦截并提示存档不兼容，不作提示直接读取错位数据一律禁止。
- **连续行走场景**：底图、可行走区域、角色脚底锚点、交互热区与小地图共用同一套坐标，画面上的道路、桥面、水岸与建筑边缘同通行判定逐处对齐，重绘地图后同步校准阻挡、触发点与旧档坐标；寻路从当前位置沿合法道路走完，寻路失败时严禁穿墙或瞬移糊弄过去。
- **Blender MCP**：有配置不等于连得上，改场景前先读一次当前场景确认连通；它具备本机代码执行权限，严禁把本地端口暴露到公网，也不运行来源不明资产包里的脚本。
