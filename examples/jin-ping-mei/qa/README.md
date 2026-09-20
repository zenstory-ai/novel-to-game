# QA 证据说明

本 example 的当前权威 QA 命令是：

```bash
cd examples/jin-ping-mei/build/app
python3 test/verify_visual.py --write-evidence
```

命令开始时先把 `verification.json` 原子写为未运行的失败态，完整路径成功后才原子更新
`verification.json` 与严格 schema-v1 `evidence/run.json`。浏览器由脚本自启临时本地服务；全部推进使用
Playwright `locator.click` 且不使用 `force`，DOM 只负责读取下一项可见可行控件的 selector。

当前路径覆盖年龄门、五院标题、五档标题／首日布局、首日真实夜访与选择后章，再以每屏第一项可行
主动作快速到达一个第二十日失稳结局并换 seed 重开。只保留标题、首日、夜访和结局四张代表图；该路径不
穷举其他结局，不复测全键盘或五档完整二十日矩阵，也不证明主观吸引力。

仓内另提供一条不依赖浏览器的可执行改编合同：

```bash
node examples/jin-ping-mei/qa/verify_playable_model.mjs
```

它对照 `playable-model.json` 与实际 `data.js` / `engine.js`，验证两种正堂起手的差异、三拍回响、非空
回调载荷、证物来源与消费边界、同 seed 确定性、存档重演与分支污染拒绝。它不调用第 5/15/20 日、
结局、一月笺或命数消费者，是设计回归，不冒充上面的真实渲染、输入或完整二十日证据。
