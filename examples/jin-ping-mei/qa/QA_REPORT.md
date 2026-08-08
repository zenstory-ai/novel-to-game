# 《风月总账》QA 报告

`status: PASS`

## 结论与证据

机器事实源为 `qa/verification.json`，常速完整路径记录为
`qa/evidence/browser/evidence-normal.json`。本次结论：六项最小完整路径通过。

实际运行命令（在 `build/app/`）：

```bash
python3 test/verify.py
```

## 限制

记录来自本地 Chromium 自动化，未覆盖其他浏览器和设备。自动化不证明主观趣味、节奏、长期平衡、
商业价值、成人内容适配性或权利合规。
