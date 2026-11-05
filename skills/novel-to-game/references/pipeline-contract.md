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

按需增补 `_coverage.md`、视觉目标图、资产台账和运行证据目录。所有自动化状态只取 `NOT_RUN`、`FAIL` 或 `PASS`；`NOT_RUN` 代表尚无运行证据，不能算作验收通过。

## 阶段职责与完成检查

概念选型、体验与关卡设计、美术方向分别由 `CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 的负责人掌管；构建阶段不得私自改写。总入口只核对以下两项：

| 检查 | 成立条件 |
|---|---|
| `scope` | `PRODUCT_BRIEF.md`、`SOURCE_BIBLE.md` 与三份设计文档齐全，且项目范围、原著事实、目标运行形态、`targetFinish` 与 `experienceProfile` 前后一致 |
| `playable` | `qa/verification.json` 的 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项均有真实运行证据且全部为 `PASS` |

`_progress.md` 只记录原著来源、运行模式、当前阶段、未确认假设、返工记录、预算复盘结论和这两项核对结果；详细测试状态统一留在 `qa/verification.json`，不复制多份状态表。

## 证据分工

构建阶段负责实现可运行版本并提供一键验证入口；QA 阶段负责排查问题并在修复后复跑，最终写入 `qa/verification.json` 的结果必须来自同一次完整运行，不得拿历史 `PASS` 拼凑。机器 QA 结论不强制要求真人试玩、逐项人工审批或另写第二份测试报告。

白盒试玩用于在量产前校准设计，不列入最终六项 QA 门禁。试玩反馈至少记录出错位置、玩家输入、预期与实际表现的差异、受影响的状态/动作/知识/回响节点及负责环节；修改后用相同的初始状态与操作序列复查（涉及随机性时固定 `seed`）。

白盒试玩还要检验玩家真正愿意反复体验的核心乐趣点。`director` 模式下可在此停靠，请用户邀一位目标玩家上手试玩；若无真人试玩，则另起一个未读过设计文档与源码的独立 Agent 会话，仅凭画面和正常输入试玩。概念与设计阶段写下的剧情、对白和关卡体量按试玩结论调整，把偏离核心乐趣的原著枝节压成简短过场或直接删去。

## 预算与范围复盘

`PRODUCT_BRIEF.md` 记录本次制作可用的模型额度、工时或费用上限。在白盒试玩结束、正式生产完成约一半必做内容时各复盘一次，对比剩余预算与待做范围；一旦单次任务耗时或消耗持续攀升，或多路任务频繁改动同一批文件，说明工程复杂度已逼近预算上限。此时立即停止加内容，按玩家实际可见的收益缩减或降级：把少量核心内容做扎实远胜于铺满占位，打磨优先投给常驻界面与主角，其次才是外围场景。每次删减同步写进 `PRODUCT_BRIEF.md` 的明确非目标。

预算或工具耗尽只会留下 `NOT_RUN` / `FAIL`、缩小范围或延期，绝不能直接标为 `PASS`。

## 断点续做与问题回流

QA 发现的问题按职责归属退回修复：

- product：退回修订 `PRODUCT_BRIEF.md`；
- design / art：先修订已批准的设计或美术文档，再重做受影响部分；
- build：修复代码实现并复跑同一条验证路径。

一旦出现游戏品类特征难以辨认、体验流程断裂或核心卖点未在画面上兑现，应立即停止细枝末节的修补，按上述归属从根源返工。只有当修复需要改动 `PRODUCT_BRIEF.md`、已批准的 `CONCEPT.md`、产品范围或预算上限时，才提请用户裁决。
