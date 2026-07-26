# 设计不变量静态对照（2026-07-26 复审）

方法：从 `design/GAME_DESIGN.md` 抄出期望值，逐项对照 `build/app/js/engine.js` 与
`build/app/js/data.js` 的常量与分支，不经由实现方测试套件。门槛为设计修订值
（回流记录见 `_progress.md`）。

## 起始值

| 期望（GAME_DESIGN §4） | 引擎实况 | 结论 |
|---|---|---|
| `silver` 180 / `power` 2 / `repute` 3 / `house` 65 / `exposure` 0 / `strain` 0 | `engine.js` 初始 resources 同值 | 一致 |
| `qing` 8（月娘 10）、`yu` 6（金莲 10）、`du` 0 | `makeRel` + 初始化覆写同值 | 一致 |

## 白日与夜间结算

| 期望 | 引擎实况 | 结论 |
|---|---|---|
| 翻账 +35（同箱 +60、第6日再 +20） | `ledger` 分支 `35 + 25(pinger_same_chest) + 20(day6)` | 一致 |
| 走官面：有口风递掉、势+1、露+12；无口风银−30、势+1、露+4 | `office` 分支同值（第3日另 +45 银） | 一致 |
| 问口风：得当日口风、露+7 | `listen` 分支同值 | 一致 |
| 整席面：银−35、声+1、宅+3 | `banquet` 分支同值 | 一致 |
| 夜话 qing+8/yu+6/du−5；前奏 qing+7/yu+10/du−4、strain+3 | `chooseNight` 同值 | 一致 |
| 明确场景：月娘 qing+10/house+8/strain+8；金莲 qing+9/yu+9/strain+12/exposure+6；瓶儿 qing+12/house+4/strain+8 | `chooseNight` explicit 分支同值 | 一致 |
| 明确当夜另两人各 du+14（场景 +9 ＋ 冷落 +5） | `chooseNight` 循环 du+9，`advanceAfterNight` 冷落 +5（离开夜 +2） | 一致 |

## CG 门槛

| 期望 | 引擎实况 | 结论 |
|---|---|---|
| `yue_prelude` qing≥28 && repute≥3 | 一致 | 一致 |
| `yue_explicit` qing≥55 && kept_yue_word && house≥50 && 未失信 && 当日翻账/整席面 | 一致 | 一致 |
| `pan_prelude` qing≥25 && yu≥40 | 一致 | 一致 |
| `pan_explicit` qing≥40 && yu≥60 && 接过/还过酒 && 未失信 && 当日问口风 | 一致 | 一致 |
| `pinger_prelude` qing≥35 && pinger_route | 一致 | 一致 |
| `pinger_explicit` qing≥55 && protected_pinger && 未泄事 && 当日翻账/走官面 | 一致 | 一致 |

## 收束

| 期望 | 引擎实况 | 结论 |
|---|---|---|
| 平衡：三人 qing≥30 且 du<70、house≥45、三杯同斟 | `determineEnding` balanced 分支同条件 | 一致 |
| 专一：最高者 qing≥60 且其明确场景解锁、他人 qing<50 | exclusive 分支同条件 | 一致 |
| 权谋：递秘密≥2 且（power≥4 或 silver≥250）且 exposure≥25 | intrigue 分支同条件 | 一致 |
| 「宅门未稳」指出哪条承诺/路线被关闭 | `ENDINGS.unstable` 为固定文案，无指认 | **漂移（发现 F4）** |

## 破裂

| 期望 | 引擎实况 | 结论 |
|---|---|---|
| 公开越过两次或 `house<30` → 路线冷却一天（GAME_DESIGN §7 各线第 6 条） | 单次失信旗标（`broken_*_word` 等）永久锁明确场景；无 `house<30` 触发、无「冷却一天」机制 | **漂移（发现 F1）** |

## 只写不读审计

| 字段 | 写入点 | 读取点 | 结论 |
|---|---|---|---|
| `strain` | 前奏 +3、明确 +8~+12 | 无（HUD 常驻「耗」条） | **只写不读（发现 F2）** |
| `exposure` | 问口风/走官面/明确场景 | 仅权谋收束达成条件 ≥25，无负向读取 | **代价语义未兑现（发现 F3）** |
| `qing`/`yu`/`du`/`house`/`silver`/`power` | 各结算点 | 门槛、收束、事件触发均有读取 | 通过 |
| 事件 flag（`kept_*`、`pinger_route` 等） | 路线选择 | 门槛与晨间事件消费 | 通过 |
