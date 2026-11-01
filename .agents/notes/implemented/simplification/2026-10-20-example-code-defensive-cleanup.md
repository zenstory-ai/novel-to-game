# Agent Note: Example code and repo scripts drop dead defensive code

Status: implemented

## Problem

2026-10-20 的只读审计发现，示例游戏代码里堆了大量不会触发的防御层：Project Plateau 的嵌套 `Object.freeze`（运行时冻结、无任何 `isFrozen` 断言）、11 份逐字相同的 GLB 加载器、写成运行时数据却没人读的说明字符串、对必然初始化的玩家状态的兜底，以及两份相同的运行错误界面；西游记对 `newCampaign()` 读档时已补齐的顶层字段反复写 `?? 默认值`。仓库脚本里则有一个真实缺口：`kimi.plugin.json` 的版本号不在 `.release/policy.json` 的 `versionFiles` 里，发布控制器查不到它和 `VERSION` 漂移。这些代码让读者以为存在并不存在的失败路径，也让新示例照抄同样的样式。

## Decision

只删“写代码的人能证明不会触发”的防御，保留真实边界（存储、存档、网络、浏览器能力、three.js 材质数组），每个示例一个提交，验证保持全绿。

- **Project Plateau**：只保留导出常量表顶层的 `Object.freeze`（删掉 392 处嵌套与运行时冻结，保留 88 处）；11 个加载器改为共用 `src/cached-gltf.js`，各模块只剩三行包装，测试接口不变；`world-asset-visuals.js` 不再自己缓存 promise（`main.js` 的 `ensureHy3dVisuals` 已做一次性缓存并在失败时重置，各模板加载器也各自缓存）；两份运行错误界面合成 `showRuntimeError`；删掉 `world-terrain.js` / `world-vegetation.js` 两个纯转导出文件；`createPlayerState()` 已初始化的 `velocity`、`groundY`、`verticalOffset`、`verticalVelocity`、`grounded`、`frameEvidence`、`familyAlarmSeconds` 不再兜底；86 条从未被源码、测试或 QA 脚本读取的说明字符串（如 `brook-hydrology.js` 各 profile 的 `model`、`evidenceBoundary`）删除，另删 5 条把常量与自身字面量比对的同义反复断言。
- **西游记**：`newCampaign()` 与 `SAVE_VERSION` 移到无 DOM 的 `progress.js` 并导出，node 测试改用真实形状建档；删除顶层字段上的兜底，稀疏的按单位键（`pendingPoints[key]`、`items[key]`、宠物的 `levels[key]`）保留；`makeUnit()` 必设的 `sp`、`summonCount` 去掉三处兜底；`audio.js` 删掉包住 Web Audio 节点合成的 5 个空 catch；删掉恒真的 `|| true` 断言。
- **金瓶梅**：`audio.js` 删掉 3 个包住节点合成的空 catch；`unlock()` 与 `store.js` 的边界处理保留。
- **仓库脚本**：`kimi.plugin.json` 加入 `.release/policy.json` 的 `versionFiles` 与 `requiredPaths`；`validate_repo.py` 删去 citationPattern 真空通过分支（模式一次不匹配时覆盖集合为空，覆盖不符先报错；缺来源圣经时缺产物先报错，它永远不是唯一失败）；部署回执去掉与 `kind`、`providerGate`、`customDomainSourceBinding` 重复的 `note` 文本字段。

## Alternatives considered

- **删掉可选资源的程序化后备（`world-asset-visuals.js` 的 `onLoadFailure`）** — 最强理由：资源都随站点打包，正常不会加载失败，后备几何是常驻的额外代码。保留原因：`build/asset-ledger.json` 为每项资源登记了 `fallback`，这是设计契约而不是防御代码；删掉会把“缺一张图仍可玩”改成“整局报错”，属于行为变更。
- **删除 `EXPECTED_SKILLS`，改从 `.clawhub/publish.json` 或 `.release/policy.json` 推导** — 最强理由：同一份技能清单写了三遍。保留原因：这两个文件在 `excludePaths` 里，不进源码归档；`EXPECTED_SKILLS` 是归档内唯一的副本，也是防止误增删技能目录的守卫。
- **一并修 `publish-clawhub.yml` 的三处不会失败的检查和 `release.yml` 的重复 permissions** — 最强理由：同属审计点名的死代码。暂缓原因：两份工作流与 oh-story-claudecode、drama-skills 逐字相同（只差固定 SHA），是组织模板；单仓改动会制造漂移，应在模板处一次改完。
- **把 Plateau 写入 `userData` 的标签（`energyModel`、`collisionRole` 等）也删掉** — 最强理由：同样是写成数据的说明。暂缓原因：这些标签有测试读取，`collisionRole` 还承载“非实体”语义并在地貌测试里作为不变量检查；要删需逐项改测试，超出本批。

## Consequences

- Plateau 净减约 330 行（`src/` 与测试合计）；常量表的嵌套对象不再冻结，误改共享常量不会再抛 TypeError，靠代码审查发现。
- 西游记读档仍按 `newCampaign()` 补齐缺失的顶层字段，因此运行时代码可以直接读这些字段；若以后新增嵌套字段，需要同时提升 `SAVE_VERSION` 或扩展补齐逻辑。
- 移除空 catch 后，Web Audio 节点合成中的异常会冒到调用处，而不是被静默吞掉。
- 部署回执 JSON 少一个 `note` 字段；结构化字段不变。
- 组织模板工作流的清理留作后续。

## Verification

西游记 `npm test` 253 通过 0 失败，`python3 test/verify.py` PASS；金瓶梅 `npm run verify:model` 与 `python3 test/verify_visual.py` PASS；Plateau `npm test` 169 通过 0 失败，`npm run verify` 三次中一次 PASS，两次在最后一段“沿荆棘带退回营地”超时（`qa_complete_run.py:276`）；未改动的 origin/main 在同一处同样超时，属既有的实时移动不稳定，不由本次改动引入；仓库 `python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests -v` 通过。验证重写的 QA 证据只有浏览器版本、端口、截图字节和构建大小变化，仓库校验不检查证据新鲜度，因此未重新提交证据。
