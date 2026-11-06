# 实机验收说明

唯一权威验证命令（使用真实 Chromium + Playwright，自动拉起临时本地服务）：

```bash
cd examples/jin-ping-mei/build/app
python3 test/verify_visual.py --write-evidence
```

单次完整通关路径：年龄确认界面（确认前不加载任何成人资源）→ 动态标题页 → 在设置中将文字显示速度调为瞬间 → 开始游戏 →
通过鼠标点击与回车键推进剧情 → 走完共通线六章（途中验证快速存档、快速读档回到同一句台词、鼠标滚轮呼出历史回看）→ 分岔夜选择吴月娘 →
走完月娘个人线 → 达成「良缘」结局画面 → 翻看原著命数页 → 返回标题页 → 点击重新开始并回到序章首句。验证通过后自动生成 `verification.json`、
`evidence/run.json`、`evidence/ending.jpg` 以及 `../screenshots/title.jpg`、`../screenshots/adv.jpg`。

CI 还会运行 `npm run verify:model`（即 `test/lint_script.mjs`，无需启动浏览器）：静态检查全部剧本跳转与媒体资源登记是否完整，并穷举所有选项组合，确认十六个结局全部可达、不存在死胡同。
