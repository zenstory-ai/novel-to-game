# Project Plateau 证据留存策略

## 目标

在不破坏发布证据链的前提下控制 `build/evidence/` 体积。保留能证明当前候选版本、历史关卡结论和独立视觉复核的最小集合；可复现但未被任何权威清单引用的中间图、旧版对照图和重复命令日志可以删除。

## 权威根与传递保护

以下文档是保护根：

- `qa/release-gates.json`
- `qa/verification.json`
- `qa/QA_REPORT.md`
- `build/asset-ledger.json`
- `build/evidence/s*/report.json`

根文档引用的证据，以及被引用 JSON 继续引用的图片、视频、状态快照和浏览器快照，全部属于**传递保护资源**。任何清理都不得删除它们。发布清单、视觉 manifest 或阶段 report 的引用必须先更新并通过仓库验证，之后旧资源才可能成为候选。

## 文件格式

- 静态浏览器证据默认使用质量 `84` 的 JPEG；需要透明通道或像素无损比较时才使用 PNG。
- 动态节奏使用一个未剪辑的 Playwright WebM，并配套四张质量受控 JPEG 相位样本。manifest 必须记录路径、字节数和 SHA-256。
- 普通 S0–S10 截图已是 JPEG，不因本策略重新编码，避免无意义的哈希漂移。

## 安全清理流程

在 `examples/project-plateau/` 运行：

```bash
python3 build/app/test/evidence_retention --json
```

该命令默认为 dry-run，只列出没有被权威根传递引用的候选。本轮清理前盘点为 328 个文件、15,291,179 字节；安全删除 18 个未引用文件（当时合计 2,445,566 字节），包括旧视觉对照图和已被统一 `qa/evidence/verify.log` 取代的重复 `verify-s*.log`。最终全量验证后共有 310 个文件、12,851,860 字节，全部受传递保护，候选为零。任何权威根缺失、JSON 损坏、传递引用缺失或证据目录 symlink 都会以非零状态阻断 dry-run 与 apply。

确认 dry-run 清单后才可执行：

```bash
python3 build/app/test/evidence_retention --apply --json
cd ../..
python3 scripts/validate_repo.py
python3 -m unittest discover -s tests -v
```

`--apply` 只删除同一轮 dry-run 规则判定的未引用文件。不要手工使用目录级 `rm -rf`。如需删除受保护资源，应先在单独变更中更新权威清单、重新采集证据并验证所有哈希。

## 保留周期

- 当前发布候选绑定的资源：永久保留，直到后继候选完整替代且验证通过。
- S0–S10 阶段 report 及其传递证据：保留，用于审计设计和输入路径。
- 未引用的旧版视觉对照与重复日志：在一个已通过 CI 的 PR 中即可删除。
- 本地原始录屏和宣传编码：不进入 Git；只提交轻量、hash-bound 的动态 QA WebM。
