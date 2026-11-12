# Agent Note: 收敛策划为 game-design（7→5）、将 game-qa 改为新玩家实机盲玩并赋予 game-build 宿主环境弹性

Status: implemented

## Problem

1. **策划三阶段拆成三个独立 skill 带来不必要的跨包调度与目录冗余**：`game-concept`、`game-world-design`、`game-art-direction` 同属编码前的纯文档策划环节，共享同一套原著考据、语言与文化尺度约束（均不写业务代码与供应商配置）。拆成三个独立 skill 后，编排器需跨三个包重复交接相同约束，单独提问“这本小说怎么设计成游戏”的用户也难以判断该调哪一个入口。
2. **既有 `game-qa` 混杂白盒规则断言与实机验收，缺少隔离源码与策划案的初见盲玩流程**：旧版 `game-qa` 同时承担编写规则正反向断言（`test-design-method.md`）与运行 `verify` 命令，导致同一会话往往先读透源码、剧本分支与 `GAME_DESIGN.md` 再跑测试，把“知情开发者的内部验证”当成玩家体验验收——首屏指代不明、必经热区被字幕遮挡、手机窄屏按钮挤出视口、过场字幕未读完抢切等真实劝退问题在自动化脚本里全绿放行。
3. **`game-build` 对本机与宿主环境的立体渲染及三维生成能力缺少主动探测与组合指引**：当宿主环境可调用混元 3D（Hunyuan3D）等图/文生 3D 模型、本机装有 Blender（CLI/Python/MCP）或适合用 Three.js 搭建主光/天光/雾效箱庭时，旧版说明未引导 Agent 先盘点环境能力并因地制宜组合路线，容易退回单调的平面静态界面或把工具使用写得过于生硬。

## Decision

1. **合并三项策划 skill 为分阶段自治的 `skills/game-design/`，全仓收敛为 5 个 skill**：
   - 保留 `novel-to-game`、`novel-game-analyze`、`game-design`、`game-build`、`game-qa` 五个一级目录（更新 `EXPECTED_SKILLS`、`.claude/skills/` 符号链接、四份插件清单、`.release/policy.json` 与 `.clawhub/publish.json`）。
   - `game-design` 内部严格按阶段一（`concepts/CONCEPT.md`，不写数值表或逐场脚本）、阶段二（`design/GAME_DESIGN.md`）与阶段三（`design/ART_DIRECTION.md`）分步产出三份独立文档，完整保留 [planning-owner-separation](2026-07-18-planning-owner-separation.md) 的三文档独立边界、白盒试玩处于阶段二与阶段三之间的编排顺序、`director` 模式停靠点，以及 6 份按需参考文件（`concept-method.md`、`world-design-method.md`、`numeric-design-method.md`、`narrative-design-method.md`、`interactive-film-method.md`、`art-direction-method.md`）。
2. **将 `game-qa` 重构为两轮「新玩家实机盲玩 + 规范核对与单次完整运行凭证」，规则自测断言归口 `game-build`**：
   - 第一轮盲玩结束前严禁读取游戏源码、剧本数据、测试脚本、`SOURCE_BIBLE.md`、`CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 或内部状态快照，只从 `PRODUCT_BRIEF.md` 与 `BUILD_BRIEF.md` 读取启动入口与运行环境；在仓库外建立带时间戳的独立运行目录，命令显式携带字面路径与独立浏览器会话标识，从标题页冷启动走完首屏五秒理解、第一分钟引导、主线推进与连续行走路线、视听节奏与面板容错、刷新重进读档与重开清零、手机窄屏（如 `390×844`）回访六步旅程，边玩边记出声思考日志与 `0–4` 摩擦分。
   - 第二轮才读取 `GAME_DESIGN.md` 与 `ART_DIRECTION.md` 区分「实现/引导缺陷」与「设计有意如此的边界」，产出精简的 `qa/playtest-report.md`（区分可复现事实、画像主观体感、`偶现`、`本轮未复现` 与 `观察`），并运行权威 `verify` 命令整份重写 `qa/verification.json`（沿用 [six-check-minimal-qa-contract](../testing/2026-08-06-six-check-minimal-qa-contract.md) 的 schema v3 六键格式；若首轮盲玩证实存在 `P0` 阻断，即便脚本绕过界面跑通，对应 `checks` 键仍须标 `FAIL`）。
   - 针对核心规则、数值门槛、分支汇流、存档迁移、互动影游静态分支穷举及生成式输入四类反例的正反向断言统一归入 `game-build` 正式构建第 4 步，接入权威 `verify` 入口。
3. **在 `game-build` 增加宿主环境探测与弹性技术路线指引**：
   - 构建前先盘点宿主实际可用的渲染库（如浏览器端用 Three.js 做立体箱庭与光影调度、2D Canvas/WebGL 做彩绘地图与横版玩法，桌面/移动端用已安装的 Godot/Unity 原生构建；目标原生工具链缺失时仍严禁擅自改做网页版顶替）、三维生成与建模工具（探测混元 3D / Hunyuan3D 等图/文生 3D 服务与 Blender CLI/Python/MCP，支持生图转 `.glb`、Blender 修整轴心减面与 Three.js 联调，外部三维工具均缺失时提供程序化几何体或 2.5D 分层景深剧场路线）以及生图、视频与语音工具，给出搭配空间且不在运行时技能中做供应商优劣排名。
4. **加强校验器对多行块标量描述的防呆检查**：`scripts/validate_repo.py` 显式拒绝 YAML 多行块标量（`|`、`>` 等）的 `description`，确保路由与插件摘要始终为单行英文起首字符串。

## Alternatives considered

- **一步激进合并为 2 个 skill（如仅留策划编排 + 构建验收）** — 最强理由：目录最少、维护面极小。否决原因：游戏品类与引擎发散度极高，`novel-game-analyze`（纯原著取证，禁提前发明玩法）、`game-build`（写代码与产资产）和 `game-qa`（必须隔离构建上下文做零先验盲玩）与策划设计存在硬性的上下文隔离与读写职责边界；压成 2 个 skill 会破坏盲玩隔离并把所有参考塞进单一目录。
- **把 `CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 顺带合并成单份大策划案** — 最强理由：少写两份文件。否决原因：全流程中白盒原型插在 `GAME_DESIGN.md` 与 `ART_DIRECTION.md` 之间用于低成本验证头号风险，且 `director` 模式需在概念选型后先停靠拍板再展开世界规则；保留三份独立阶段文档才能守住渐进收敛与返工归属。
- **修改 `qa/verification.json` schema 增加盲玩专用顶层字段** — 最强理由：机器文件直接承载摩擦分与 `P0–P3` 列表。否决原因：schema v3 的六键最小机器凭证已是全仓示例与测试夹具的稳定契约；用人类可读的 `qa/playtest-report.md` 承载盲玩旅程与分级证据，同时规定盲玩证实的 `P0` 阻断直接令 `qa/verification.json` 对应 `checks` 判 `FAIL`，既兼容既有校验器又堵住了脚本绕过 UI 假绿的漏洞。

## Consequences

- 收益：策划入口统一为 `game-design`，全仓 23 份技能与参考文档保持在约 590 行（远低于 1300 行预算）；`game-qa` 真正以新玩家冷启动盲玩检验上手与视口体验；`game-build` 能主动利用本机 Three.js、混元 3D、Blender 等能力做出更有空间层次的作品。
- 代价：`.clawhub/publish.json` 下架原三项独立策划入口并新增 `worldwonderer/game-design@1.0.0`（中央目录已同步登记，工作流升级至对应不可变控制提交 `f3d67fd4492b68372514de683fb089161efe1d58`），同时升级 `game-build@1.4.0`、`game-qa@1.1.0`、`novel-to-game@1.2.0`。

## Verification

- `uv run --python 3.12 python scripts/validate_repo.py`（5 skills 通过）
- `uv run --python 3.12 python -m unittest discover -s tests -v`（15 项测试全部通过）
- `uv run --python 3.12 python <controls>/scripts/clawhub_release.py validate --manifest .clawhub/publish.json --repo-root . --base-ref <base>`
- 两个公开示例构建目录各自的模型与系统测试（`npm run verify:model`、`npm test`）全部通过。
