# BUILD_BRIEF · 金瓶梅·风月总账（galgame 版）

`targetFinish: playable-prototype`

## 目标

把 `design/GAME_DESIGN.md` 的共通线＋五条个人线做成浏览器里可完整游玩的 ADV：零构建原生 ES Module，
`python3 -m http.server` 即可运行；对标主流 galgame 的阅读外壳。

## 架构

| 文件 | 职责 |
|---|---|
| `js/adv.js` | 行式剧本解析器与解释器（纯逻辑，浏览器与 node 共用）：标签、说话、立绘、背景、CG、选项、条件、好感、分岔、结局、命数、回想区段、存读档快照 |
| `js/story/*.js` | 剧本正文（共通线三份、五条路线、五场出门）与人物／场景／CG／曲目／结局／命数登记 |
| `js/main.js` | 年龄门、标题、主循环（打字机、自动、快进只跳已读、隐藏、快存快读、上一选项、章节卡、结局卡、命数页）与输入防误触 |
| `js/menus.js` | 回看记录、36 格存读档、设置、系统菜单与心意、鉴赏（CG／回想／音乐／结局流程图） |
| `js/stage.js` | 背景交叉淡入、立绘进出场与差分、说话人高亮、天气、成人 CG 门控、存档缩略图合成 |
| `js/store.js` | localStorage：设置、跨周目解锁与已读、存档槽；全部容错 |
| `js/audio.js` · `js/petals.js` | 程序化丝竹 BGM／音效；标题花瓣与视差 |

剧本语法写在 `js/adv.js` 顶部注释。加一场戏只改 `js/story/`，不碰引擎。

## 必须保持

- 年龄门在一切画面之前；确认前不请求任何成人 CG。成人 CG 只在良缘夜「留下」之后出现，设置可关，缩略图不截。
- 结局后必有原著命数页，按 SOURCE_BIBLE 人物名册写固定去处。
- 每个选择都有人物当场反应；不显示数值。
- 已读追踪：快进默认只跳已读。

## 运行与验证

```bash
cd examples/jin-ping-mei/build/app
python3 -m http.server 5173            # 打开 http://127.0.0.1:5173/
python3 test/verify_visual.py --write-evidence   # 唯一权威完整路径
npm run verify:model                   # CI 无浏览器检查：剧本连通、资源登记、16 个结局穷举可达
```

## 限制

- 浏览器完整路径只走月娘良缘一条；其余结局只由剧本穷举证明可达。
- 只在 1440×900 Chromium 验证；窄屏有响应式样式但未纳入权威运行。
- 无配音；音乐为程序化合成。
