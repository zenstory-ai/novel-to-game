# 重制计划完成度审计

> 2026-07-26 复审注：本审计早于现行 qa 契约。文中引用的 `/tmp/jpm_qa/` 与 `.omx` 路径
> 均已失效、视为无证据；「视觉方向符合 PROVED 94/100」的聚合分裁决已在
> `qa/QA_REPORT.md` 降级为 `NOT_RUN`，以该报告为准。

审计对象：`.omx/plans/jinpingmei-male-harem-redesign.md`。
审计日期：2026-07-25。
状态词：`PROVED` 表示当前证据直接证明；`PARTIAL` 表示实现存在但体验结论仍缺目标玩家证据；
`NOT_RUN` 表示计划规定的验证尚未执行。

## 产品身份与核心循环

| 要求 | 状态 | 权威证据 |
|---|---|---|
| 玩家由孟玉楼改为西门庆，男性主观视角 | `PROVED` | 标题、开场和浏览器“你是西门庆”断言；旧 `jpm_save_v1` 注入隔离 |
| 白日经营 → 宅中插曲 → 黄昏拜访 → 夜间决定 → 次晨来人 | `PROVED` | `engine.js` phase 状态机；三条浏览器完整路径 |
| 外账、人物 `qing/yu/du`、总账分层 | `PROVED` | `newGame()` 状态 schema、关系边界测试、真实 HUD |
| 专一、平衡、权谋三种打法均能在 6 日收束 | `PROVED` | `ledger.mjs` 三条极端策略，结局分别为 `exclusive/balanced/intrigue` |
| 没有一个白天动作通吃全部路线 | `PROVED` | 四种白天动作路线亲和矩阵；`ledger/office/listen/banquet` 解锁集合不同 |
| 白天所得能改变当夜选项 | `PROVED` | 金莲终段要求当日 `listen`；月娘和瓶儿有不同白天动作门槛 |
| 人物秘密能解决后续经营压力 | `PROVED` | `shop_fraud`／`merchant_route` 等由人物线写入，`office` 消费并改变势、银、暴露 |
| 至少一个选择延迟两回合后兑现 | `PROVED` | 第 1 日尊重月娘，第 3 日 `yue_delayed`；截图 `qa/evidence/browser/safe/04_delayed_yue_morning.jpg` |
| 嫉妒只来自可见行为 | `PROVED` | 历史写入公开院门，事件明确说“花园角门”；状态与截图双证据 |

## 三名女主路线最低合同

| 要求 | 月娘 | 金莲 | 瓶儿 | 状态 |
|---|---|---|---|---|
| 初见钩子 | 正堂主账 | 正堂接酒 | 私院先问人或钱 | `PROVED` |
| 至少两个非色情性格／利益选择 | 账、承诺、共治 | 消息、对质、公开兑现 | 账本、保护、财产边界 | `PROVED` |
| 公开宴席选择 | 主中秋席 | 第一杯／公开承诺 | 当席护账 | `PROVED` |
| 交叉角色事件 | 限制偏宠、压席 | 用瓶儿钱做脸、挑战正堂 | 财产引来金莲与正堂反应 | `PROVED` |
| 暧昧近景 → 前奏 → 关系终段 | 65%近景 + 2 场景 | 65%近景 + 2 场景 | 65%近景 + 2 场景 | `PROVED` |
| 理解型路线结果 | 共掌一宅 | 火里同谋 | 同箱共命 | `PROVED` |
| 拒绝／停止／冷却 | 失约锁线 | 空诺／失约锁线 | 只取钱／泄密锁线 | `PROVED` |
| 亲密后主动次晨行为 | `yue_help` | `pan_claim` | `pinger_help` | `PROVED` |

瓶儿“只取钱”路径已在真实浏览器中实际选择 `leave`：流程继续、成人册页未误解锁、选择写入
历史。不是只检查按钮存在。

## 三条宅中短线

| 要求 | 玉楼 | 雪娥 | 娇儿 | 状态 |
|---|---|---|---|---|
| 场内物件发动 | 名帖 | 空米袋／后仓木箱 | 描金匣 | `PROVED` |
| 两项真实选择 | 递话／不让沾手 | 查后仓／赔短账 | 买底价／扣匣子 | `PROVED` |
| 改变外账或秘密 | `power/meng_favor` | `silver/house/kitchen_witness` | `silver/exposure/collector_price` | `PROVED` |
| 结算回读态度 | `regard` → 三档文本 | `regard` → 三档文本 | `regard` → 三档文本 | `PROVED` |
| 真实立绘与双视口 | `household_meng_yulou.png` | `household_sun_xuee.png` | `household_li_jiaoer.png` | `PROVED` |
| 不混入成人场景 | 不在 `HEROINE_IDS`／`SCENES.participants` | 同左 | 同左 | `PROVED` |

这三段增加宅中人物密度，但没有夜访、专属近景或册页，不能称为三条新完整女主路线。

## 成人内容、场景册与安全

| 要求 | 状态 | 权威证据 |
|---|---|---|
| 18+ 年龄门，确认前不显示成人 CG | `PROVED` | 首屏 DOM 与截图断言 |
| 只允许三名明确成年角色参与成人节点 | `PROVED` | 独立白名单、每个 scene participants 静态扫描 |
| 未成年名字、ID、资产键不进成人数据 | `PROVED` | 场景数据独立词表扫描 |
| 关系、意愿、玩家选择共同门控，不靠 RNG | `PROVED` | 三路线前置矩阵；同 seed 复现；路线门槛不调用随机 |
| 6 张人物路线 CG + 1 张群体 CG，资产键唯一 | `PROVED` | 7 个 `scene_id`、文件存在、尺寸、浏览器自然宽高及缺图失败测试 |
| 每个亲密节点改变至少两项后续状态 | `PROVED` | 前奏改变情／欲／耗；终段改变关系、总账、秘密、他人妒意 |
| 场景有次晨回响 | `PROVED` | 三名女主各自主动事件及后续嫉妒链 |
| 场景册永久保存，重开不丢 | `PROVED` | `GALLERY_KEY` 与跨重开浏览器断言 |
| 场景册可重看，重看不重复改状态 | `PROVED` | 全屏重看前后周目快照严格一致 |
| README 与 18+ 证据隔离 | `PROVED` | 安全／成人导出清单分目录；README 静态扫描 |
| 成人画面和文案强度符合目标受众 | `PARTIAL` | 资产与 18+ 路径存在；“是否够明确、够性感”必须由阶段 4 玩家评分，自动化不能证明 |

## 文案、美术、声音与可访问性

| 要求 | 状态 | 权威证据 |
|---|---|---|
| 古典白话底子、自然口语、短按钮 | `PROVED` | 主按钮 ≤10 字；36 个深线选项、三段短线和结局已按 `oh-story-claudecode` 规范重写 |
| 六人不同声口 | `PROVED` | 月娘／金莲／瓶儿／玉楼／雪娥／娇儿声口标记与场内物件静态断言 |
| 禁止指定 AI 腔与策划术语 | `PROVED` | 高危句式、重复“兑现”与玩家界面说明书用语机器扫描 0 命中 |
| 对话人物占画面 55%–70% | `PROVED` | 三路线每次近景 bounding box 均为 0.65 |
| 宅院只作 Hub，关键关系切近景／CG | `PROVED` | opening/day 使用宅院；visit/night/scene 使用人物专属资产 |
| 中秋三人签名帧 | `PROVED` | `banquet_conflict` 真实触发；安全截图与视觉裁决 |
| 核心动作、状态、转场、解锁、收束有声音层 | `PROVED` | `audio.js` 场景与 SFX 映射；真实 UI 静音切换和跨页持久化 |
| 色彩带文字／形状冗余 | `PROVED` | 三条关系卡具有不同字形标记、固定位置和文字等级 |
| 键盘与降运动 | `PROVED` | Tab 聚焦、Escape 分层关闭、`prefers-reduced-motion` |
| 最小视口文字可读 | `PROVED` | 1280×800：功能标签 13px、正文 14px、人物原因 12px |
| 视觉方向符合 | `PROVED` | visual-verdict iteration 6：94/100、`pass` |

声音存在性与持久化已证明；音色情绪是否符合目标玩家仍属于人工感受，不包装成确定性结论。

## 技术、性能和证据

| 要求 | 状态 | 权威证据 |
|---|---|---|
| 1280×800 与 1920×1080 不遮挡关键选择 | `PROVED` | 双视口主界面、关系栏、舞台、顶栏 bounding box |
| 本地首屏低于 2 秒 | `PROVED` | 最新浏览器基线约 99.3 ms |
| 交互保持 30 FPS 以上 | `PROVED` | 24 帧采样平均帧间隔约 8.3 ms |
| 包体低于 25 MB | `PROVED` | 运行目录 6.0 MB；纯引擎递归大小断言 |
| 控制台与关键资源零错误 | `PROVED` | 真实浏览器 console/pageerror/requestfailed/HTTP 监听均为 0 |
| 发布模式缺关键 CG 时失败 | `PROVED` | 拦截 `pinger/explicit.webp` 后出现 `#asset-error` |
| 新旧存档隔离与迁移 | `PROVED` | `v3` 补齐宅中人迁入 `v4`；`jpm_save_v1` 旧键仍隔离 |
| 场景册与周目存档分离 | `PROVED` | 重开清周目、7 页仍保留 |
| 最小测试钩子 | `PROVED` | `window.__game` 仅暴露状态、动作和资产报告，没有改数值捷径 |
| 仓库规定命令通过 | `PROVED` | `validate_repo.py` 通过；Python 单元测试 9/9 |

当前自动证据为纯引擎 46/46、真实 Chromium 130/130、视觉 94/100。

## 仍未跨过的阶段四硬门

| 要求 | 状态 | 所需证据 |
|---|---|---|
| 6–8 名目标成年中文玩家无讲解试玩 | `NOT_RUN` | `qa/evidence/playtest/P01.json` 等逐人文件 |
| 单局实际时长 20–30 分钟 | `NOT_RUN` | 真人开始／结束时间，不用 `fast=1` |
| 15–20 分钟内赢得首个关系终段 | `NOT_RUN` | 逐人时间点与路径 |
| 五项主观问卷中位数均 ≥4 | `NOT_RUN` | 完整样本评分 |
| ≥75% 能复述两名女主不同目标 | `NOT_RUN` | 开放回答原文 |
| ≥60% 主动想看另一条路线或重开 | `NOT_RUN` | 无提醒行为／原话 |
| 无主角身份误认 | `NOT_RUN` | 两分钟回答 |
| 成人、嫉妒、经营没有一项被多数人判为脱节 | `NOT_RUN` | 逐人问卷与原话 |

执行协议和逐人格式已经落在 `PLAYTEST_PROTOCOL.md` 与
`evidence/playtest-template.json`。在这些真人证据出现之前，本审计结论只能是：

```text
工程与可观察体验合同：PASS
目标玩家硬门：NOT_RUN
总体计划：BLOCKED_ON_EXTERNAL_PLAYTEST
```
