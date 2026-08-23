# 流程契约

## 最小工作区

```text
game-adaptations/{project}/
├── PRODUCT_BRIEF.md
├── analysis/SOURCE_BIBLE.md
├── concepts/CONCEPT.md
├── design/GAME_DESIGN.md
├── design/ART_DIRECTION.md
├── build/BUILD_BRIEF.md
├── build/app/
├── qa/verification.json
└── _progress.md
```

按需增加 `_coverage.md`、视觉目标、资产账本和最小证据目录。所有机器状态只取 `NOT_RUN` / `FAIL` /
`PASS`；`NOT_RUN` 表示没有证据，不能满足完成声明。

早期白盒候选、可执行模型、事件日志、回放与 patch 只在项目实际需要时增加。可执行模型必须被当前
候选运行时消费，或作为测试合同逐项对照实际规则；不能把整份 `GAME_DESIGN.md` 再抄成一份无人读取的
JSON/YAML。设计理由仍由 `GAME_DESIGN.md` 拥有，运行状态与动作由实现拥有，实际发生记录由事件日志拥有。

## 阶段 owner 与完成检查

概念、体验/关卡设计、美术方向分别由 `CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 的 owner
负责；构建不得静默改写它们。编排器只检查：

| 检查 | 成立条件 |
|---|---|
| `scope` | brief、source bible 和三份设计交接存在；范围、原作事实、目标运行形态、`targetFinish` 与 `experienceProfile` 不冲突 |
| `playable` | `qa/verification.json` 的 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 均有真实运行证据 |

`_progress.md` 只记录来源、模式、当前阶段、未确认假设、回流和这两项结果。详细测试状态留在
`qa/verification.json`，不要复制到多份状态表。

早期工作区缺少 `experienceProfile` 时，`resume` 按现有 `CONCEPT.md` 补记一次并继续；不得据此重做
已批准概念。

## 证据角色

`qa/verification.json` 是唯一 QA 事实源。schema v3 只写整体状态、权威命令、一次 complete run、
六项游戏效果 checks 和包含 `scope` / `reason` 的 limitations。目标运行环境与实际环境不同就如实
记录，不能用替代运行结果冒充目标平台通过。

构建只准备候选与 verify 入口，QA 只运行一次完整路径；不要求真人试玩、逐项人工批准、重复机器
证据对象或第二份 QA 报告。

白盒试玩是设计回流，不是第七道顶层 QA 门。反馈至少记录观察位置、玩家输入、预期与实际差异、受影响
的状态/动作/知识/回响节点和 owner；修订后固定同一初态、规则版本、seed 与输入序列重放受影响路径。
若节点 id、变量语义、动作效果或知识权限改变，必须迁移旧存档/日志或明确拒绝兼容，不能静默解释成新历史。

`targetFinish` 描述成色，不改变最小 QA。预算或工具耗尽只会留下 `NOT_RUN` / `FAIL`、缩小范围或
延期，不会生成 PASS。主观趣味、平衡、权利合规和发布质量不由机器事实确定。

## resume 与回流

`resume` 读取 `_progress.md` 和实际产物，从最早未成立的完成检查继续。QA 发现按 owner 回流：

- product：回 `PRODUCT_BRIEF.md`；
- design/art：修订批准文档后重建受影响范围；
- build：修实现并复跑同一验证路径。

品类认不出、体验弧不存在、核心前提未上屏不是小缺陷；停止打磨并请求产品裁决。
