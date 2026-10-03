# QA 证据说明

唯一权威命令（真实 Chromium + Playwright，自启临时本地服务）：

```bash
cd examples/jin-ping-mei/build/app
python3 test/verify_visual.py --write-evidence
```

一条完整路径：年龄门（确认前零成人资源请求）→ 动画标题 → 设置里把文字速度调到瞬间 → 开始游戏 →
鼠标点击与回车推进 → 共通线六章（途中快存、快读回到同一句、滚轮打开回看）→ 分岔夜选月娘 →
月娘线 → 良缘结局卡 → 原著命数页 → 回标题 → 重新开始回到序章第一句。成功后写 `verification.json`、
`evidence/run.json`、`evidence/ending.jpg` 与 `../screenshots/title.jpg`、`../screenshots/adv.jpg`。

CI 另跑 `npm run verify:model`（`test/lint_script.mjs`，无浏览器）：剧本跳转与资源登记完整，穷举全部选择后十六个结局都可达。
它不证明渲染或输入，只防止剧本改动造成死路。
