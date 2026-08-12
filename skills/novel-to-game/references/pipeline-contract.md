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
├── qa/QA_REPORT.md
└── _progress.md
```

按需增加 `_coverage.md`、视觉目标、资产账本和最小证据目录。所有机器状态只取 `NOT_RUN` / `FAIL` /
`PASS`；`NOT_RUN` 表示没有证据，不能满足完成声明。

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

`qa/verification.json` 是唯一机器事实源。schema v2 只写整体状态、权威命令、一次 complete run、
六项游戏效果 checks 和包含 `scope` / `reason` 的 limitations。目标运行环境与实际环境不同就如实
记录，不能用替代运行结果冒充目标平台通过。

`targetFinish` 描述成色，不改变最小 QA。预算或工具耗尽只会留下 `NOT_RUN` / `FAIL`、缩小范围或
延期，不会生成 PASS。主观趣味、平衡、权利合规和发布质量不由机器事实确定。

## resume 与回流

`resume` 读取 `_progress.md` 和实际产物，从最早未成立的完成检查继续。QA 发现按 owner 回流：

- product：回 `PRODUCT_BRIEF.md`；
- design/art：修订批准文档后重建受影响范围；
- build：修实现并复跑同一验证路径。

品类认不出、体验弧不存在、核心前提未上屏不是小缺陷；停止打磨并请求产品裁决。
