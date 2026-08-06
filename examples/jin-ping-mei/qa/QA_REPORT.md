# 《风月总账》QA 报告

`targetFinish: playable-prototype`
`assuranceProfile: smoke`
`status: PASS`

## 结论

当前仓库只声明**18+ 灰盒可玩闭环**。真实浏览器路径覆盖成年确认、六日关系决策、延迟后果、
结果、重开和场景册；核心 smoke 六项通过。它不把自动化测试包装成视觉发布审计或真人趣味结论。

机器事实源：`qa/verification.json`。常速浏览器记录写入
`qa/evidence/browser/evidence-normal.json`。逐步截图按需重建，
不再长期提交；README 只使用 `screenshots/` 下 5 张精选安全画面。

## Smoke 检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 启动、渲染和输入 | PASS | 常速浏览器记录 |
| 六日核心循环与结果 | PASS | 同上 |
| 延迟后果与群体冲突 | PASS | 同上 |
| 重开与场景册 | PASS | 同上 |
| 1280×800 / 1920×1080 | PASS | 浏览器记录 |
| 系统减少动效模式 | PASS | 常速浏览器记录 |
| 控制台、资源和外部请求 | PASS | 浏览器记录 |

## 限制与安全

- `publicationTier` 仍为 `graybox`；本报告只判断当前游戏效果，不承担发布审计。
- 18+ 内部画面不是公开案例资产；不进入 README、发布清单或仓库精选截图。
- 自动化不证明真人首次理解、趣味、节奏、长期平衡或商业价值。

## 复跑

在 `build/app/` 运行：

```bash
node test/ledger.mjs && python3 test/qa_browser.py && QA_SLOW=1 python3 test/qa_browser.py
```
