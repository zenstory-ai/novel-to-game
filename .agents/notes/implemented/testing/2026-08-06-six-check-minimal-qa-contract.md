# Agent Note: QA 只有一条证据路径：qa/verification.json 六项检查、一次完整运行

Status: implemented

## Problem

2026-08-02 到 08-04 之间，示例 QA 长成了发布门禁：release-gates.json、来源与视觉指纹、公共主机探测、发布层级、感知评审记录，校验器随之膨胀到两千多行。这些门禁证明的是"发布材料自洽"，不回答"游戏能不能玩"；必需的合并校验因此又慢又长，而绿灯照样挡不住不可玩的切片。

## Decision

每个示例的 `qa/verification.json` 是唯一机器事实源，schema v3，顶层字段 must 恰好是 `schemaVersion`、`status`、`verify`、`completeRun`、`checks`、`limitations`；`checks` must 恰好六键 `launch`/`render`/`input`/`coreLoop`/`outcome`/`restart`，值只取 `NOT_RUN`/`FAIL`/`PASS`。提交到 main 的记录 must 整体 `PASS` 且六项全部 `PASS`。

- `verify.command` 是一条权威命令（可选 `suites`），`exitCode` must 为 0；它无论成败都原子重写本文件，旧 PASS never 在失败复跑后幸存，也 never 拼接不同运行的成功。
- `completeRun.evidence` 指向工作区内非空 JSON（schema 1）：`runId` 等于 `completeRun.id`，含 `environment`、`inputTrace` 与恰好六键的 `observations`；`render.visual` must 指向工作区内画面文件；`outcome.state` 与 `restart.state` 分别记录 `completeRun.terminal` 与 `completeRun.restart`。
- `targetFinish` 只描述成色，never 改变六项，也 never 生成第七道门；连续 3D、语音、生成媒体只在实际采用时做回归，失败映射回既有键或 limitation。
- 主观趣味、平衡、权利合规、真人试玩不由本契约判定，只能写成 `{scope, reason}` 的 limitation。
- `tests/fixtures/minimal-evidence/` 用无依赖的 CPython 程序跑出一份合规记录，证明契约不预设浏览器。

来源：91351f1、bb3aa64、cd0e163、45d2c3c (#15，六键核心集落地日，即文件名日期)、6c450da (#20)、edbb962 (#28)、58e0ae4 (#44)

## Alternatives considered

- **release-gates.json + 指纹 + 公共主机探测（2026-08-02 至 08-04 实际落地）** — 最强理由：元数据互相一致仍可能藏着过期字节，指纹能抓到（cd0e163）。否决原因：它们不决定游戏是否能玩，把 QA 变成发布与来源审计（45d2c3c："they do not determine whether the game works"）。
- **smoke / delivery / release 三档 assurance profile（45d2c3c 落地一天）** — 最强理由：不同发布强度需要不同的检查集合。否决原因：等级表把"完成"变成可协商的层级，#20 删掉这根强度轴，六项成为唯一检查集合；成色轴 `targetFinish`（cd0e163 起已存在）原样保留，两者从来不是同一根轴。
- **用先前各阶段的绿色日志拼报告** — 最强理由：省一次完整跑。否决原因：拼接不能证明同一源版本的一次交接，也抓不到无人执行的孤儿测试（2652f98、b8d95e1）。

## Consequences

- 收益：合并校验一次跑完，不需要浏览器长设置；任何示例的"可玩"含义完全一致。
- 代价：六项之外的质量（可读性、趣味）没有机器门，Frankenstein 示例正是自动化全绿仍被下架（见 [frankenstein-hovel-example](../../rejected/feature/2026-07-29-frankenstein-hovel-example.md)）；证据 JSON 与 `verify` 入口由每个示例自己维护。
- 重访信号：出现第七个通用检查的需求时，先问它能否映射进六键或 limitation；答不上来再考虑改契约。
