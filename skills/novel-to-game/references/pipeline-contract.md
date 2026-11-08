# 流程规范

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

按需增补 `_coverage.md`、视觉目标图、资产台账和实机运行记录目录。所有自动化状态只取 `NOT_RUN`、`FAIL` 或 `PASS`；`NOT_RUN` 代表尚未完成实机验证，不能算作验收通过。

## 阶段职责与完成检查

`PRODUCT_BRIEF.md` 与 `SOURCE_BIBLE.md` 是上游事实依据；概念选型、体验与关卡设计、美术方向分别由 `CONCEPT.md`、`GAME_DESIGN.md`、`ART_DIRECTION.md` 的负责人掌管，构建阶段不得私自改写。总入口只核对以下两项：

| 检查 | 成立条件 |
|---|---|
| `scope` | `PRODUCT_BRIEF.md`、`SOURCE_BIBLE.md` 与三份设计文档齐全，且项目范围、原著事实、目标运行形态、`targetFinish` 与 `experienceProfile` 前后一致 |
| `playable` | `qa/verification.json` 的 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项均有实机运行记录且全部为 `PASS` |

`_progress.md` 只记录原著来源、运行模式、当前阶段、未确认假设、返工记录、预算复盘结论和这两项核对结果；详细测试状态统一留在 `qa/verification.json`，不复制多份状态表。

## 白盒校准、预算复盘与问题退回修复

白盒试玩用于在量产前校准设计并检验玩家真正愿意反复体验的核心乐趣点，不列入最终六项 QA 门禁。试玩时另起一个未读过设计文档与源码的独立 Agent 会话，仅凭画面和正常输入试玩（`director` 模式下在此停靠等待用户拍板内容取舍），如实记录出错位置、玩家输入、预期与实际差异及负责环节，修改后用相同初态与操作序列复查（涉及随机性时固定 `seed`）；概念与设计阶段写下的剧情、对白和关卡体量按试玩结论调整，把偏离核心乐趣的原著枝节压成简短过场或直接删去。

在白盒试玩结束、正式生产完成约一半必做内容时各复盘一次，对比 `PRODUCT_BRIEF.md` 的预算上限与剩余范围；一旦单次任务耗时或消耗持续攀升，或多路任务频繁改动同一批文件，立即停止加内容，优先保住常驻主界面、主角交互与核心循环，缩减外围场景与次要分支，并将删减项同步记入 `PRODUCT_BRIEF.md` 的明确非目标（预算或工具耗尽时只能缩小范围或如实保留 `NOT_RUN` / `FAIL`）。

QA 或试玩暴露的问题按职责归属退回修复：

- product：退回修订 `PRODUCT_BRIEF.md`；
- design / art：先修订已批准的 `GAME_DESIGN.md` 或 `ART_DIRECTION.md`，再重做受影响部分；
- build：修复代码实现并复跑同一条验证路径。

一旦出现游戏品类特征难以辨认、体验流程断裂或核心卖点未在画面上兑现，应立即停止细枝末节的修补，按上述归属从根源返工；只有当修复需要改动 `PRODUCT_BRIEF.md`、已批准的 `CONCEPT.md`、产品范围或预算上限时，才提请用户裁决。
