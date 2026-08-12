# 生成媒体生产线：imagegen 图片 → Seedance 2.0 视频

> 用途：ART_DIRECTION 已定稿、BUILD_BRIEF 含动态媒体（视频过场 / 环境循环 / 关键帧驱动
> 演出）时的**默认执行链与证据流程**。本文含供应商接口事实（模型 ID、端点、字段），
> 属快变信息——开工前必须按文末《快变信息复核义务》刷新官方文档，不得把本文当长期权威。

核心纪律只有一条：**已有可用图片时，不允许退回纯文生视频重新发明人物和场景。**
视频的任务是把已定稿的角色身份、造型、场景地理、色板和材质"演"出来，不是再创作一遍。

## 一、默认生产链与分工

```text
ART_DIRECTION / STYLE_LOCK
        ↓
Codex imagegen / gpt-image-2
        ↓
选定角色身份图、造型图、场景图、镜头关键帧
        ↓
Seedance 2.0 图生视频 / 多模态参考生视频
        ↓
下载视频与尾帧，检查漂移和镜头边界
        ↓
接入游戏状态机，并保留静帧 / 低动效 fallback
```

分工：art direction 锁风格与连续性事实（谁是谁、在哪、什么状态），build 逐镜生产并留证，
QA 对照参考图与镜头边界证伪。任何一层都不借"生成"越权：视频模型不改写身份与地理，
build 不改写玩法，QA 不把"好看"写成通过。

**整条链不可用时不阻塞构建**：执行环境没有图片生成 skill、没有 `ARK_API_KEY`，或视频接口
整体不可用时，按 ART_DIRECTION 里该条动态媒体登记的 fallback（静帧 / 低动效版本）交付，
把它标为**待产**并写进构建完成记录——节拍与结果一个不丢即算达标。缺视频不是必需项，
缺 fallback 才是。

## 二、最小生产包（生成第一条视频前必须先建）

缺任一项不得开工——没有这些，漂移发生时无法归因、无法复验：

- `build/media/STYLE_LOCK.md`：一段逐字复用的风格描述（年代 / 媒介 / 笔法 / 色板 / 光线 /
  颗粒），每条图片与视频提示词都带它或带由它审出的典范参考图。
- `build/media/CHARACTER_SHEET.md`：每个出场角色的**持久身份**（脸、体型、发式、标志器物）
  与**临时造型**（服装、伤势、湿污、年龄态）分列，附各自参考图路径。
- `build/media/LOCATION_SHEET.md`：每个场景的**固定地理**（布局、地标、材质）与**临时视图**
  （时段、天气、灯光、季节）分列，附各自参考图路径。
- `build/media/SHOT_MANIFEST.jsonl`：每镜一行（格式见第七节），是生产与 QA 共用的台账。
- `build/media/evidence/<shot_key>/`：每镜一个证据目录，收请求、响应、任务 ID、本地输出
  与哈希（见第七节）。

## 三、参考图职责：谁能控制什么

参考图不是"给模型看看"，是**带权限的契约**。每张参考图传入时必须声明两个列表：

- `may_control`：这张图允许锁定的事实（如 `["face", "hair", "body_type"]`）。
- `must_not_control`：这张图不得影响的事实（如 `["costume", "location", "palette"]`）。

事实按三层分离，各归各的参考图，不混传：

| 层 | 持久事实（身份图锁） | 临时事实（造型 / 视图 / 状态图锁） |
|---|---|---|
| Character / Look | 脸、体型、发式、标志器物 | 服装、伤势、湿污、年龄态 |
| Location / View | 布局、地标、材质、地理关系 | 时段、天气、灯光、季节 |
| Prop / State | 形制、材质、破损底色 | 持有者、开 / 关、当前破损度 |

越权即缺陷，与好不好看无关：身份图不能顺带改服装与场景；造型图不能改脸；场景图不能
引入人物；构图图（关键帧）不能改写故事状态。

**状态变化必须登记**：任何影响持久或临时事实的剧情变化（换装、受伤、搬家、道具易手），
在 `SHOT_MANIFEST.jsonl` 里记一条：

- `before` / `after`：变化前后的事实值；
- `source`：变化的设计依据（GAME_DESIGN / 原作章节）；
- `effective_range`：从哪镜起生效；
- `affected_bindings`：受影响的参考图绑定（哪张身份 / 造型 / 场景图要换）。

**每镜维护两个边界**：`start_boundary`（开场时谁在哪、目光向哪、左右手与持物、服装、
光线、环境底声）与 `end_boundary`（镜头结束时同一张清单）。下一镜的 `start_boundary`
必须接续上一镜的 `end_boundary`，接续不上就是断镜，不论单镜多漂亮。

## 四、图片生产：Codex `imagegen`（默认 `gpt-image-2`）

- **正常任务优先调用本机 `imagegen` skill 的内置路径**（本仓库不自带图片生成脚本，用的是
  执行环境已装的那个 skill）；只有用户显式要求 CLI / API / 模型控制时，才改走该 skill 自带的
  命令行入口（需 `OPENAI_API_KEY`），其子命令一般为 `generate` / `edit` / `generate-batch`，
  默认模型 `gpt-image-2`——具体入口路径与子命令名以执行环境里那份 skill 为准，不要照抄本文。
- 质量选择：草稿与快速迭代用 `--quality low` / `--size 1024x1024`；定稿、身份敏感编辑与
  高分辨率用 `--quality high`。**`gpt-image-2` 的编辑输入固定高保真，不传
  `--input-fidelity`**；要 4K 风格构图用 `--size 3840x2160`（横）/ `2160x3840`（竖）。
- 产物必须**复制进工作区**（默认落在 `$CODEX_HOME` 下不算项目资产），不得覆盖已有资产，
  需要替换时用旁系版本名（`hero-v2.png`）。
- 参考图条件化时提示词**只写差量**（角度、动作、状态、光照），不逐字重描外观——重描会
  与参考图争夺条件、稀释一致性。纯文本生成时反过来：风格锁**逐字重复**进每条提示词。

图片提示词模板（每行一个事实域，差量部分按镜改）：

```text
[STYLE_LOCK 全文或典范图说明]
主体：[角色名]，[身份锚点一句]；[本镜临时造型]
场景：[场景名]，[地理锚点一句]；[本镜时段 / 天气 / 灯光]
构图：[镜头距离与角度]；[功能区预留：UI 空区 / 扣底轮廓]
禁止：[本图 must_not_control 的事实域，逐条列]
```

## 五、视频生产：Seedance 2.0（火山引擎 Ark）

已核实的默认调用面（2026-07 官方文档快照，开工前必须复核）：

- Model ID：`doubao-seedance-2-0-260128`
- 创建任务：`POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`
- 查询任务：`GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}`
- 鉴权：环境变量 `ARK_API_KEY`（`Authorization: Bearer $ARK_API_KEY`），只从环境读，
  **不写入任何证据文件**。

**两种连续性模式，按镜头任务二选一，不混用**：

1. **多参考图模式**（`reference_image`）：身份图 + 造型图 + 场景图一起传入，各自带
   第三节的职责声明；模型按参考合成画面。适合角色 / 场景已定型、镜头构图自由的镜。
2. **严格首尾帧模式**（`first_frame` / `last_frame`）：先用 imagegen 产出首帧（需要时
   加尾帧），视频只负责两帧之间的运动。适合镜头边界必须逐像素接续的镜（动作衔接、
   推拉摇移的起落幅）。**首尾帧与 `reference_image` 互斥**——同传会让模型在两类条件
   间摇摆，身份与构图都漂；该互斥规则属快变信息，开工前按官方文档复核。

视频提示词模板（在参考图 / 首尾帧之外只写**运动与镜头**，不重描外观）：

```text
[STYLE_LOCK 一句缩写，若已传参考图可省]
运动：[谁做什么，按拍序写 2-4 拍；每拍一个可观察动作]
镜头：[固定 / 推 / 拉 / 摇 / 移，方向与幅度；无运镜写"固定镜头"]
节奏：[时长内的快慢分配；情绪转折点在第几拍]
禁止：[不得新增的人物 / 道具；不得改变的服装 / 地理 / 色板，逐条列]
```

执行规矩：

- **先 `720p` 验证，确认无漂移后再生成 `1080p` 最终版**——漂移在 720p 返工的成本是
  1080p 的一半以下。
- 不传当前不支持的参数：`seed`、`camera_fixed`（传了不报错也不生效，会给人"可控"的
  错觉；支持矩阵以官方文档为准）。
- **真人脸限制**：参考图含真实人脸须有授权；请求体与参考图有大小上限（以官方文档
  为准，超限先本地压缩再传）。
- **结果不是资产**：返回的视频 URL 约 24 小时有效、任务记录约保留 7 天——必须当场
  下载进 `build/media/evidence/<shot_key>/` 并记哈希，临时 URL 不得进游戏、不得当证据。

## 六、提交、轮询与下载

流程固定，但**字段名、参考图 role 枚举、状态枚举和分辨率参数怎么传，开工前按第九节复核官方
文档，不照抄记忆值**：向创建任务端点提交提示词与参考图 / 首帧（Authorization: Bearer
$ARK_API_KEY，密钥只从环境读，不进任何证据文件），先要 720p；请求体形如 {model,
content:[{type:"text", text:"<提示词> --resolution 720p"}, {type:"image_url",
image_url:{url:"data:…"}, role:"first_frame"}]}；用返回的任务 ID 轮询到终态；到终态后把第七节
要求的证据落进 build/media/evidence/<shot_key>/，并当场下载视频与尾帧记 SHA256（结果 URL 约
24 小时失效）。

失败处理：failed / 审核拒绝 / 超时（分钟级上限，以官方建议为准）都把完整去密钥响应落进
证据目录，标记该镜**待产**，继续下一镜。

## 七、逐镜证据与连续性门

`SHOT_MANIFEST.jsonl` 每镜一行，字段（JSON 示例，可被 `jq` 逐行解析）：

```json
{"shot_key": "s03-yard-reveal", "mode": "first_last_frame", "references": [{"path": "build/media/ref/hero-id.png", "duty": "character", "may_control": ["face", "hair"], "must_not_control": ["costume", "location"]}], "start_boundary": "院门内，目光向井，左手空，右手提桶，晨光，环境底声=风", "end_boundary": "井边，目光向镜头，桶已放下，晨光不变", "prompt": "...", "request": "evidence/s03-yard-reveal/request.json", "response": "evidence/s03-yard-reveal/response.json", "task_id": "cgt-…", "outputs": {"video": "evidence/s03-yard-reveal/s03-yard-reveal.mp4", "sha256": "…"}, "state_changes": [{"before": "桶在手", "after": "桶在井边", "source": "GAME_DESIGN §7", "effective_range": "s03 起", "affected_bindings": ["prop/bucket"]}]}
```

连续性门（交给 QA 逐项证伪，详见 game-qa 的契约）：

- **漂移检查**：视频首帧、中间帧、尾帧逐帧对照输入参考图——人物身份、造型、场景地理、
  色板、材质逐项核对；无依据新增人物、道具或"双胞胎"（同镜两个主角）记缺陷。
- **边界检查**：上一镜 `end_boundary` 与下一镜 `start_boundary` 的位置、目光、左右手、
  持物、服装、光线、环境底声逐项比对，接不上记断镜。
- **证据链**：去密钥请求、完整响应、任务 ID、本地视频与 SHA256 齐全才算这镜存在；
  临时 URL、供应商页面截图、"返回了尾帧"这句话本身都不能证明连续性。

## 八、接入游戏

视频进游戏走状态机接入与静帧 / 低动效 fallback，原则与 Three.js 后端选择、资源释放
一并见 [production-techniques.md](production-techniques.md) 的生成媒体接入节；资产台账
字段进 BUILD_BRIEF，见 [build-brief-contract.md](build-brief-contract.md)。

## 九、快变信息复核义务

以下为快变信息，本文只是 2026-07 的快照，**实际开工前必须重新核实官方文档**：

- Model ID 与模型列表（遇无效 ID 先刷新官方模型列表，**不得猜测替代值**）；
- 请求字段、响应字段与任务状态枚举、参考图角色枚举、首尾帧与多参考的互斥规则、`seed` / `camera_fixed` 支持矩阵；
- 请求体与参考图大小上限、真人脸审核策略、价格与限流；
- 结果 URL 时效与任务记录保留期。

Seedance 2.0 的 4K 输出为 H.265 / 10bit——目标运行环境的解码兼容性未验证前，4K 不得进入
游戏主线（720p / 1080p 的 H.264 产物是当前安全档）。

官方资料入口：模型页 <https://seed.bytedance.com/en/seedance2_0>；模型列表
<https://www.volcengine.com/docs/82379/1330310>；创建任务
<https://www.volcengine.com/docs/82379/1520757>；查询任务
<https://www.volcengine.com/docs/82379/1521309>；提示词指南
<https://www.volcengine.com/docs/82379/2222480>。
