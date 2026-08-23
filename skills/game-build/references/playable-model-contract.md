# 可执行改编模型合同

可执行模型只保存当前候选运行时必须消费的因果语义，不复制策划理由、美术方向或整份内容库。若项目
已有代码原生状态机、对话引擎、规则表或引擎场景图，可直接把它声明为模型；不要为了文件名再造一份
平行 JSON/YAML。独立数据文件只有在运行时实际加载，或作为测试合同逐项对照实现时才存在。

## 选择原型与构建路径

先按最大风险选白盒：

| 风险 | 最小可用形态 | 不能据此证明 |
|---|---|---|
| 知识、承诺、分支回响 | 文本/场景状态沙箱 | 操作手感、空间与镜头 |
| 资源、门槛、策略反制 | 回合状态板或桌面沙箱 | 实时节奏与物理 |
| 两层互相读写 | 场景叙事 + 最小系统 | 未实现层的完整质量 |
| 走位、视线、相机、物理 | 目标引擎灰盒 | 最终美术完成度 |

`template` 表示已有交互语法能直接承载核心动词；记录模板提供什么、原作改变什么、何时必须退出模板。
`custom` 表示核心动作依赖模板没有的操作或世界规则。路径只决定复用方式，不决定题材或成色。

## 最小语义面

按项目需要定义，不要求所有字段：

```text
version: content / rules / save schema
state: stable id / type / initial / visibility / invariant / source anchor
action: id / actor / preconditions / costs / effects / observers / reveals / consumes
event: action / before+after summary / witnesses / seed use / future callback
knowledge: world fact / player knows / character knows or believes / open question
commitment: who promised what / to whom / when it becomes irreversible / later reader
validation path: initial state / seed / inputs / expected state / expected feedback
```

只对会改变玩家决策或产生泄密风险的事实维护知识权限；普通环境事实无需多层心智模型。事件账本保留
“发生过什么”，关系或资源保留“现在是什么”；只存终值无法解释回响，只存事件也不适合即时载入。

## 裁决边界

规则器唯一提交时间、资源、位置、物件归属、知识、承诺、胜负和事件。生成模型可解释自由输入、提出
合法动作候选、写对白或根据已确认结果组织表达，但不能直接改最终状态。输出需先通过 schema、前置、
数值范围、知识权限、原作边界和分支污染检查。

表现层只读取已提交语义。同一个事件可渲染为文字、镜头、动画或 3D 交互，但换表现不能更改原因、
观察者、物件归属、知识披露或后续回读。

## 身份专属命令（按需）

只有 GAME_DESIGN 选择 `signature_command` 时实现，并逐字继承其 `id / label / intents / slots /
validators / commit` 六组结构；各组的具体条目数量服从项目。输入解析器把角色化表述变成有限候选，
不拥有结算权；候选按项目需要携带 intent、执行人、对象、物件、地点、可见范围、期限等槽位。schema、前置、资源、
执行人可用性、空间权限、人物知识、冲突承诺和原作边界任一失败时返回结构化澄清/拒绝，状态保持不变。

规则器再输出执行轨迹与实际结果：每一阻力环节说明通过、拒绝或部分完成，提交资源/物件/知识/关系，
创建证物、见证与到期事项；叙述器只把这些已确认事实写成场面。否定、条件和互斥表达不得靠关键词猜成
相反动作。若使用在线模型解析，日志保存 parser version、规范化候选与验证结果；确定性回放从候选开始，
不再次请求模型。

私人谈话若会改变主线，也走同一边界：模型只提出 `facts / promises / permissions / refusals / witnesses`
候选，规则器验证后写入事件账。不得让自由 `effects`、原始聊天摘要或忠诚估值直接成为权威状态。

## 到期事项

延期后果记录 source action、due/trigger、携带的执行人/物件/见证/承诺、status、重新上桌方式和结清事件。
到期时必须形成当前可见压力、机会或再次裁决；载入/回放不得提前触发、重复触发或让已结事项复活。

## Snapshot、事件日志与回放

- snapshot 服务快速载入，带内容/规则/存档版本；event log 服务定位、重演与测试。
- 同一版本、初态、seed 和规范化动作输入序列必须得到同一终态与事件顺序；在线生成表达不进入裁决 hash。
- 回滚模式由设计声明：自由重选、固定历史仅回看、或明确不可逆节点。渲染和 UI 回调不得偷偷改状态。
- 节点 id、变量语义、行动效果、知识权限改变时提供迁移，或明确拒绝旧存档/日志；不得静默重解释。

## 反馈与局部 patch

反馈记录 `issue → observation → expected/actual → node → owner → patch → replay`。自然语言负责表达复杂
偏差，标签负责聚类，结构化修改只触及被定位节点。patch 声明基础规则版本、目标节点、预期差异、
存档兼容性和受影响路径；修改后重放原失败路径及一条相邻反例，确认声明外状态没有变化。

白盒只回答被模拟的风险是否暴露、规则是否可执行和结果为何发生。选择是否困难、角色是否吸引人、
节奏是否愿意重玩仍需真人研究，不写成确定性 PASS。
