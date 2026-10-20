# Agent Note: 删去 skill 内部重复规则与对不存在规则的否定

Status: implemented

## Problem

2026-10-20 按 prose-gap-polish 标准对 `skills/` 做只读审计，发现同一条规则在同一个 skill 内反复出现，
另有几处否定句针对的是仓库里从未存在的规则。这些句子不增加行为约束，只稀释真正的边界：

- `game-build`：“构建不重新裁决设计”除 `SKILL.md` 开头外，又在 `baked-sprite-workflow.md`、
  `blender-asset-workflow.md`（两处）、`generative-media-pipeline.md` 和 `build-brief-contract.md` 重复；
  “必需资产失败须明确报错”在四份按需参考里重复了 `build-brief-contract.md` 的同一句；
  `playable-model-contract.md` 与 `tts-production-contract.md` 重复“主观感受不写成机器 PASS”，
  而 `build-brief-contract.md` 已规定构建者不预填 PASS。
- `game-qa`：“不新增 QA 门”除 `qa-contract.md`“`checks` 恰好只含六键”外又出现四次；
  “各证据层不互相冒充”在 `test-design-method.md` 重复了 `qa-contract.md` 的同一句；
  `SKILL.md` 与 `qa-contract.md` 都说测试框架和调试接口由项目决定。
- `novel-game-analyze`：全书覆盖规则出现六次；`gameability-protocol.md` 开头一句与 `SKILL.md` 第 7 行
  几乎相同；人物名册和逐事实表写成“下游交接门的比对基准”，但没有任何下游 skill 读取或定义交接门。
- `novel-to-game`：“低风险写假设、高风险才停靠”出现五次；`pipeline-contract.md` 有三段属于
  `game-build` 或已过时——可执行模型的存在条件与归属（`playable-model-contract.md` 已有，且其中“早期
  白盒候选只在需要时增加”与流程第 6 步“必做白盒”矛盾）、旧工作区补记 `experienceProfile`、存档/日志迁移。
- 否定不存在的规则：`game-art-direction`“不为每个界面凑数”、`game-concept`“不要求独立的固定键名”、
  `novel-game-analyze`“不必机械附带置信度对象”、`blender-asset-workflow.md`“不要求两套并存”、
  `playable-model-contract.md`“不要求同时维护两套存储”、`tts-production-contract.md`“不新增强制真人听审”。

## Decision

每条规则在所属 skill 内只保留一处，保留位置是该 skill 每次必读的文件：

- `game-build` 保留 `SKILL.md` 第 7–8、11 行的设计边界和 `build-brief-contract.md` 的必需资产失败规则；
  按需参考删去重复句。`generative-media-pipeline.md` 只留“改变视角、位置或空间关系的交互不能用视频伪装”。
- `game-qa` 保留 `qa-contract.md` 的六键 schema 与证据分层句，其余位置删去“不新增门”与证据分层的重复。
- `novel-game-analyze` 保留 `SKILL.md`「输入」的全量门禁、协议第一节的覆盖方法与第五节的交付检查，
  删去管道和输出两处重复；人物名册与逐事实表改写为
  “供下游回查”，触发方式不变。
- `novel-to-game` 保留 `SKILL.md`「默认策略」和 `intake-method.md` 默认动作 3–4 与输出阻断项；
  删去 `pipeline-contract.md` 的三段。
- 删去上列六处对不存在规则的否定。

跨 skill 的重复（例如 `game-qa` 与 `novel-to-game` 都说不把趣味写成确定性结论）按自包含规则保留。
`game-world-design` 不动：#64（537a46d）对它做过同类精简，盲评精简组 6.38 对对照组 6.84 后回退。

## Alternatives considered

- **把逐事实表接进 `novel-to-game` 第 4 步，让概念选定后显式回调 `novel-game-analyze`** — 最强理由：
  目前没有任何 skill 触发“二次进入”，这张表可能从不生成。否决原因：这会新增一步流程，改变行为，
  超出本批“行为不变”的范围；留作后续单独决定。
- **按审计估计删到约 70–90 行** — 最强理由：审计按整条规则估算体量。否决原因：多数重复是折行段落中的
  分句，删去后按行计只省约 20 行；为凑行数继续删会碰到只出现一次的规则。

## Consequences

- 收益：`skills/` 从 1126 行降到 1106 行，字数降得更多；每条规则在每个 skill 内有唯一出处，后续修订只改一处。
- 代价：只读按需参考（如 Blender、语音）的实现者要回 `build-brief-contract.md` 才能看到必需资产失败规则；
  该文件由 `SKILL.md` 指定必读，正常路径不受影响。
- 未做：逐事实表的触发方式、`game-world-design` 的措辞、跨 skill 的重复。

## Verification

`python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests -v` 通过。盲评 A/B：待维护者决定。
