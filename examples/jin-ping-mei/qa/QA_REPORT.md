# 《金瓶梅·风月总账》质量验证报告

## 裁决

- 自动化工程验收：`PASS`
- `blocker`：0
- `major`：0
- `minor`：0
- 阶段 4 目标玩家硬门：`NOT_RUN`
- 可交付称谓：**可运行垂直切片**
- 禁止声称：已经证明“好玩”“性感”、长期平衡、留存或适合扩成完整流程

自动化结论只说明当前 3 条成人深线 + 3 条宅中短线／6 回合切片可启动、可完成、可拒绝、
可重开，设计要求的关系闭环与关键画面可观察。是否值得继续玩只能由目标成年玩家试玩回答。

重制计划逐条状态与证据映射见 `qa/COMPLETION_AUDIT.md`。

## 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-07-25 |
| 页面 | `http://127.0.0.1:5173/?seed=42&fast=1` |
| 运行形态 | 原生 ES Module + DOM，无构建步骤 |
| 浏览器 | Playwright Chromium |
| 目标视口 | `1280×800`、`1920×1080` |
| 界面语言 | 简体中文 |
| 内容分级 | 18+；仅成年白名单 |

## 命令与结果

```bash
cd examples/jin-ping-mei/build/app
node test/ledger.mjs
# 结果：46 通过，0 失败

python3 test/qa_browser.py
# 结果：130 通过，0 失败
# 控制台错误：0；关键资源失败：0
```

机器可读摘要落在 `qa/evidence/automated.json`。浏览器逐步截图与当次运行的原始摘要落在
`/tmp/jpm_qa/`；该临时目录含 18+ 内部截图，不进入 README。

## 关键不变量

| 检查 | 结果 | 证据 |
|---|---|---|
| 确认成年前无 CG 进入 DOM | 通过 | `safe/01_age_gate.png`、浏览器断言 |
| 开场明确“你是西门庆” | 通过 | `safe/02_title.png` |
| 首个有意义选择写入公开历史 | 通过 | `safe/03_opening_choice_done.png`、状态断言 |
| 白天资源能改变当夜可用选择 | 通过 | 纯引擎前置测试、三条浏览器路线 |
| 女主秘密能反哺后续经营 | 通过 | `merchant_route` 的写入与消费断言 |
| 每名女主路线、拒绝和人物结果可达 | 通过 | 月娘／金莲／瓶儿完整路径断言 |
| 三名女主亲密后各有主动次晨回响 | 通过 | `yue_help`、`pan_claim`、`pinger_help` 浏览器路径 |
| `今夜就到这里` 始终可选 | 通过 | 每次夜间节点浏览器断言 |
| 三名宅中人各有一段两选一事件 | 通过 | 玉楼／雪娥／娇儿状态测试与三张真实浏览器截图 |
| 宅中秘密能进入后续办差 | 通过 | `meng_favor`、`kitchen_witness`、`collector_price` 写入与消费 |
| 宅中人态度进入结算 | 通过 | `householdResults` 三人回读断言 |
| v3 存档可迁入 v4 | 通过 | 迁移单元测试与本地存储键检查 |
| 玩家可见文案不露策划术语 | 通过 | AI 高危句式、UI 术语与六人声口静态门禁 |
| 真实拒绝路径可继续且不误解锁 | 通过 | 瓶儿只取钱 → 锁定原因 → `leave` → 次晨 |
| 亲密后至少两项状态改变且有次晨回响 | 通过 | 场景效果、`morning` 状态与关系边界测试 |
| 嫉妒来自可见痕迹 | 通过 | `safe/09_jealousy_chain.png`；文本点名“花园角门” |
| 两回合延迟后果可见 | 通过 | `safe/04_delayed_yue_morning.png` |
| 中秋三人群体冲突真实触发 | 通过 | `safe/06_banquet_conflict.png` |
| 3 种策略各有不同收束 | 通过 | 纯引擎极端策略测试 |
| 7 个唯一 `scene_id` 全可达、全入册 | 通过 | schema、资产、浏览器图库断言 |
| 重开清周目但保留场景册 | 通过 | 浏览器重开与 `localStorage` 断言 |
| 场景册可重看且不重复结算 | 通过 | 全屏重看前后周目快照严格一致 |
| 旧孟玉楼存档隔离 | 通过 | `jpm_save_v1` 注入后仍为 version 4 |
| 缺关键 CG 失败而非灰盒回退 | 通过 | 资产加载器与缺失资产测试 |
| 同 seed + 同选择可复现 | 通过 | 纯引擎快照比较 |
| 目标视口无关键遮挡或溢出 | 通过 | 双视口 bounding box 断言 |
| 首屏、帧率、包体达到预算 | 通过 | 99.3 ms、8.3 ms 平均帧间隔、6.0 MB |
| 最小视口文字达到可读地板 | 通过 | 功能标签 13px、正文 14px、人物原因 12px |
| 键盘与降运动路径 | 通过 | Tab 聚焦、`prefers-reduced-motion` 断言 |
| 静音持久化 | 通过 | UI 切换后新页面仍读取 `jpm_mute` |
| 控制台与关键资源 | 通过 | 0 错误、0 失败、0 HTTP 4xx/5xx |

## 三项主观但可观察裁决

### 首次上手：`PASS`

年龄确认后第一屏同时给出“你是西门庆”“今夜进谁的门，明早谁来敲你的门”，进入后无需词典
即可在正堂二选一。首个选择立即改变人物账并写进公开历史。自动化能证明路径与反馈存在；
未以此替代新人实际理解度访谈。

### 核心幻想演出：`PASS`

三位成年女主在标题与路线近景中直接看向玩家；玩家选择一人后，从白天筹码进入人物回应、
亲密节点，天亮后再面对其他人的嫉妒或索取。第2–4日另有玉楼、雪娥、娇儿三段短线，
第五天三人同场公开追问玩家。这套体验不只靠 `qing/yu/du` 数字运转，还有角色近景、
路线 CG、群体冲突、声音与后果场面。

### 招牌帧符合：`PASS`

视觉裁决第 6 轮为 94/100。标题、人物近景、次晨、中秋宴、三张宅中人页面、场景册重看与
结算共享晚明册页／工笔套印语言；
中秋帧中三条视线、账册、酒杯与钥匙在 `1280×800` 均可读。角色近景占舞台宽度
55%–70%，公开截图不包含关系终段 CG。

## 证据清单

公开安全证据：

- `screenshots/title.jpg`
- `screenshots/household.jpg`
- `screenshots/morning.jpg`
- `screenshots/banquet.jpg`
- `screenshots/ending.jpg`
- `/tmp/jpm_qa/safe/01_age_gate.png`
- `/tmp/jpm_qa/safe/02_title.png`
- `/tmp/jpm_qa/safe/03_opening_choice_done.png`
- `/tmp/jpm_qa/safe/04_delayed_yue_morning.png`
- `/tmp/jpm_qa/safe/06_banquet_conflict.png`
- `/tmp/jpm_qa/safe/07_exclusive_ending.png`
- `/tmp/jpm_qa/safe/08_gallery_after_yue.png`
- `/tmp/jpm_qa/safe/09_jealousy_chain.png`
- `/tmp/jpm_qa/safe/household_meng_yulou.png`
- `/tmp/jpm_qa/safe/household_sun_xuee.png`
- `/tmp/jpm_qa/safe/household_li_jiaoer.png`

内部 18+ 证据：

- `/tmp/jpm_qa/adult/`

视觉裁决状态：

- `.omx/state/jinpingmei/ralph-progress.json`

## 未测试范围与硬门

尚未执行 6–8 名目标成年中文玩家、每人 20–30 分钟的无讲解试玩，因此以下问题保持未知：

- 玩家是否真的感到自己是后宫关系的男性中心；
- 是否主动想继续推进至少一位女主；
- 是否感到成人内容是通过选择赢得，而非随机弹出；
- 是否能复述至少两名女主不同的目标；
- 是否能从一句话分清玉楼、雪娥、娇儿，并愿意把其中一条升成长线；
- 是否感到白天经营与夜间关系彼此有用；
- 成人画面与文案是否达到目标受众预期的强度。

扩展前必须满足：

1. 上述五项 1–5 分问卷中位数均不低于 4；
2. 至少 75% 玩家能复述两名女主的不同目标；
3. 至少 60% 玩家结束后主动想看另一条路线或重开；
4. 没有玩家把主角误认成孟玉楼或女性角色；
5. 成人内容、嫉妒、经营三者没有一项被多数玩家判为与其他系统无关。

执行步骤、非诱导话术和逐人证据格式见 `qa/PLAYTEST_PROTOCOL.md` 与
`qa/evidence/playtest-template.json`。

硬门未过前，不把三条宅中短线升级为完整夜访路线，不增加回合、数值条或 CG 数量。
