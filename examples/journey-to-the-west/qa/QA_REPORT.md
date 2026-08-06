# 《三借芭蕉扇》QA 报告

`targetFinish: playable-prototype`
`assuranceProfile: smoke`
`status: PASS`

## 结论

当前仓库只声明**灰盒可玩闭环**，不声明已经达到可玩原型的视觉完成度。真实浏览器路径可从标题
进入序幕，完成三段战斗与选择，抵达结局，并覆盖再玩/读档；核心 smoke 六项通过。

机器事实源：`qa/verification.json`。浏览器汇总：`qa/evidence/automated.json`。逐点击截图由
`build/app/test/qa_browser.py` 按需重建，不再作为长期 Git 证据。

## Smoke 检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 启动与真实渲染 | PASS | `qa/evidence/automated.json` |
| 真实输入与状态变化 | PASS | 同上 |
| 标题到结局的核心循环 | PASS | 同上 |
| 设计结果、再玩与读档 | PASS | 同上 |
| 重开 | PASS | 同上 |
| 控制台/外部请求 | PASS | 同上 |

## 限制

- `publicationTier` 仍为 `graybox`；历史视觉复审发现的招牌帧与遮挡问题没有被 smoke 结论掩盖。
- 本报告只判断当前游戏效果，不承担发布审计。
- 首次真人理解、趣味、节奏与长期平衡未由自动化证明。

## 复跑

在 `build/app/` 运行：

```bash
node test/battle.mjs && python3 test/qa_browser.py
```

该命令重新生成浏览器汇总和本地逐步截图；提交时只保留汇总与 README 使用的 4 张精选截图。
