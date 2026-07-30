# 进度

- 来源：Project Gutenberg eBook #52200《金瓶梅》崇祯本百回足本
- 原文状态：已收录并验证第一回至第一百回；仓库内为 `expurgate.py` 可复现生成的删节洁本
- 模式：`quick`
- 选择概念：`《金瓶梅·风月总账》男性第一人称成人后宫关系模拟`
- 玩家角色：西门庆
- 当前阶段：`qa`
- 已完成：`analyze`、`concept`、`design`、`art`、`build`、`qa`
- gate:qa pass(2026-07-28 F1/F2 两条 major 已修复并加断言，证据改落工作区内 qa/evidence/；
  裁决沿革 2026-07-25 PASS(作废) → 07-26 FAIL → 07-28 PASS，见 qa/QA_REPORT.md)
- 回流记录：build→design 门槛调参（yue_prelude qing≥35→28、pan_explicit yu≥65→60、
  权谋收束 exposure≥35→25），设计按六日可达性复核采纳，修订落 `design/GAME_DESIGN.md`
  §4.5/6/7；qa 复审发现 F1/F4 归 `build`、F2/F3 归 `design`
- 2026-07-28 回流完成：F1（破裂规则改为逐人计数 + 一天冷却，house 跌破三线同冷）与
  F2（`strain` 获得读取点：≥30 锁当日「走官面/整席面」，休息之夜 −6 回落）已修复；
  `SAVE_VERSION` 4 → 5 并加 v3→v5、v4→v5 迁移断言。F3（`exposure` 无负向读取点）与
  F4（「宅门未稳」固定文案）仍为 `minor` 已知缺口
- 分析覆盖：`analysis/SOURCE_BIBLE.md` 全书覆盖（来源 100 回／成功 100／失败 0）
- 构建状态：`playable_slice`（3 条成人深线 + 3 条宅中短线、6 天完整循环、三种收束）
- 美术状态：`slice_done`（6 张人物路线 CG + 1 张中秋群体冲突 CG；README 只用安全截图）
- 文案状态：已按去 AI 味规范重写运行时可见文本；月娘、金莲、瓶儿、玉楼、雪娥、娇儿
  各有独立声口
- 自动证据：`qa/QA_REPORT.md`、`qa/evidence/automated.json`、
  `qa/evidence/design-invariants.md`；浏览器证据已从 `/tmp/jpm_qa/` 改落工作区内
  `qa/evidence/browser/`（安全帧入库；18+ 内部验收帧按 game-build 契约放受限子目录
  并经 .gitignore 排除，可由 `python3 build/app/test/qa_browser.py` 复跑重建）
- 引擎自测：`node build/app/test/ledger.mjs` 52 项通过；
  浏览器：`python3 build/app/test/qa_browser.py` 130 项通过 / 控制台 0 报错 / 资源 0 失败
- 人工证据：第 1 轮线上反馈确认“好很多”，指出文案有 AI 味、宅中角色与内容需扩充；
  尚缺完整 6–8 人记录，未跨过完整六深线／18–24 回合扩展硬门
- 授权状态：原作 `public_domain_source`；新 CG 为本次生成资产
- 内容分级：`adult_18plus`（仅成年白名单；年龄门；关系与明确意愿门控；可随时停止）
- 备注：历史模式曾自记为 `direct-build`（构建先行、策划回填），已并入词表值 `quick`；
  原「当前阶段 `target-player-test-round-2`」「已完成 `world-design`/`art-direction`/
  `automated-qa`」等自创词一并改由本备注行留档
- 备注：`build` 之前各阶段完成于过门机制引入前，不补记当时并未发生的 `gate:` 行
- 下一步：F1/F2 已回流完成，自动化门已过。剩余 F3（`exposure` 无负向读取点）与
  F4（「宅门未稳」固定文案）为 `minor`，不阻断；上线第 2 轮玩家测试，按
  `qa/PLAYTEST_PROTOCOL.md`（西游记侧已交付同类协议）记录玩家对六人声口、
  三段宅中事件和三条深线的原话
- 更新时间：2026-07-28
