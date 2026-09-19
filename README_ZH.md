<!-- Last synced with README.md: 2026-09-18 -->

<p align="center">
  <img src="https://zenstory.ai/brand/zenstory-ai-mark.svg" alt="" width="76" height="76">
</p>

<h1 align="center">NovelToGame</h1>

<p align="center">
  <b>有原著依据的小说改编游戏工作流：改编设计、面向指定运行环境的游戏构建，以及基于运行证据的 QA。</b>
</p>

<p align="center">
  <a href="https://zenstory.ai/zh/novel-to-game"><b>项目主页</b></a>
  &nbsp;·&nbsp;
  <a href="#安装"><b>安装</b></a>
  &nbsp;·&nbsp;
  <a href="#看看它的输出"><b>看看它的输出</b></a>
  &nbsp;·&nbsp;
  <a href="README.md"><b>English</b></a>
</p>

<p align="center">
  <a href="https://github.com/zenstory-ai/novel-to-game/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/zenstory-ai/novel-to-game?style=flat-square&color=22D3EE&logo=github&logoColor=white&label=Stars"></a>
  <a href="https://github.com/zenstory-ai/novel-to-game/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/zenstory-ai/novel-to-game?style=flat-square&color=081431&label=Release"></a>
  <img alt="Skills 7" src="https://img.shields.io/badge/Skills-7-081431?style=flat-square">
  <a href="https://github.com/zenstory-ai/novel-to-game/actions/workflows/validate.yml"><img alt="Validate" src="https://img.shields.io/github/actions/workflow/status/zenstory-ai/novel-to-game/validate.yml?style=flat-square&label=Validate"></a>
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/License-MIT-1F6FEB?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/zenstory-ai/novel-to-game/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/badge/GitHub%20Discussions-181717?style=for-the-badge&logo=github&logoColor=white"></a>
  <a href="https://github.com/zenstory-ai/novel-to-game/issues"><img alt="GitHub Issues" src="https://img.shields.io/badge/GitHub%20Issues-181717?style=for-the-badge&logo=github&logoColor=white"></a>
</p>

NovelToGame 是装进你已在用的编码 Agent（Claude Code、Codex、Kimi Code）的七个开源 skills。把一本小说交给它——如果已有想法，再加上目标平台或引擎。它会读完整本书，选一个站得住的游戏方向，设计世界和画面，在简报锁定的运行环境里构建，并用一次有记录的运行证明这个版本能玩。你拿到的是一款达到你所要求成色的可玩构建，加上它背后的设计文档。下面三个公开示例现在就能在浏览器里打开，无需安装。

## 在线试玩

每款游戏都链到它背后的改编工作区：原文来源、概念与被否决的方向、游戏与美术方向、可运行源码，以及来自可玩路径的 QA 记录。

### 西游记 · 三借芭蕉扇

[![积雷山决战中敌我阵列完整留在木刻舞台，下方轻绢指令台与人物画面彼此分离](examples/journey-to-the-west/screenshots/hero.jpg)](https://xiyouji.vibecoco.ai)

**一扇吹出五万里。这口气，一回合一回合打回来。**

你指挥孙悟空一行三借芭蕉扇：算五行、循火脉残图寻宝、在收手与深入之间下注、排阵型、变形取巧硬闯不进的地方，把一个正面打不过的牛魔王，打成落在火焰山上的一场雨。

**[浏览器试玩](https://xiyouji.vibecoco.ai)** · [改编工作区](examples/journey-to-the-west/) · 设计估时 45–90 分钟 · 全年龄 · 可玩原型

### 金瓶梅 · 风月总账

[![西门宅中五人隔着总账看向玩家](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai)

**今夜进谁的门，明早谁来敲你的门。**

二十日，五处院门。平衡银钱、官势、声名、见光与宅门损耗，守住每个人亲口说出的规矩，让不同院门在真实危局中建立互信，最后面对一笔由所有选择和记忆共同写成的总账。

**[浏览器试玩](https://jinpingmei.vibecoco.ai)** · [改编工作区](examples/jin-ping-mei/) · 设计估时 60–90 分钟 · 18+ · 可玩原型

### Project Plateau · 失落的世界 · 3D

这是一款由柯南·道尔《失落的世界》改编而来的实时**第一人称 3D 野外摄影游戏**。玩家穿过连通的高原，观察共同生活的禽龙家庭，在空中威胁下拍完四张玻璃底片，再带着幸存的影像返回。

桌面浏览器可完整试玩，其他设备可直接观看 15 秒实机预览。

https://github.com/user-attachments/assets/27819247-4e4d-4bf0-8f0f-43d4125c4d45

**[浏览器直接试玩，无需安装](https://plateau.vibecoco.ai)** · [改编工作区](examples/project-plateau/) · [反馈体验](https://github.com/zenstory-ai/novel-to-game/discussions/7) · 设计估时 1–3 分钟一局 · 桌面 WebGL2 · 可玩原型

## 这是什么

不需要 GPU，没有托管服务，也不内置游戏引擎：这套 skills 用的就是你把它装进哪个 Agent、那个 Agent 的模型。只给模型一句“把这本书做成游戏”，得到的通常是换皮或可点击的剧情摘要，所以工作被拆成几个阶段：一个阶段负责一份文档，每个决定都要有证据：

- **每个设计决定都引用原著。** 拆解阶段读完全书，写出 `SOURCE_BIBLE`：硬规则、关键角色目标、转折结局和标志性锚点都标注章回或文件位置，改编边界表每行带证据位置。原作事实分为 `immutable`、`adaptable`、`open`、`conflicted` 四种边界；原著没有定义的部分标为设计发明，不会被悄悄写成事实。
- **游戏形态是一个有记录的决定，不是默认值。** 概念阶段比较真实的替代方向，用具名的硬否决淘汰不合格方向（核心循环与原作中心张力无关；删掉专有名词后只剩通用模板；玩家只是花资源放行既定剧情）。概念、世界设计与美术方向分别由不同阶段写进各自的文档，构建阶段不得静默重做。
- **面向简报锁定的运行环境构建。** 产品简报（Agent 最先起草的一页需求单；`quick` 模式下只在平台、权利、尺度等阻断项上停下等你裁决）锁定平台、引擎、目标运行时和实际可用的测试运行时。工具链缺失时不得悄悄改做网页。设计文档是不绑定引擎的 Markdown，归你所有。
- **QA 是一次真实运行、六项检查和如实写下的限制。** 构建在测试运行时里真正启动，一次完整运行证明 `launch`、`render`、`input`、`coreLoop`、`outcome`、`restart` 六项。趣味、平衡、其他浏览器和权利只写成限制项（limitation），不写成 PASS。
- **语音默认关闭，默认在构建期生成。** 除非美术方向选用语音，没有任何台词会发给语音合成服务；运行时合成须经产品简报明确批准；小说和设计文档从不上传。

互动叙事是一等赛道：连续场景、对白、证词与关键选择可以承载整个游戏，但要满足与系统玩法同样的能动性和证据要求。

## 安装

前提：你已经在用 Claude Code、Codex 或 Kimi Code，终端能运行 `npx`（Node.js）。

| Agent CLI | 安装命令 | 调用方式 |
|---|---|---|
| Claude Code | `npx skills add zenstory-ai/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add zenstory-ai/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add zenstory-ai/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

`-g` 表示全局安装，对所有目录生效；去掉它则只装进当前目录。**升级时再跑一遍同一条命令，或运行 `npx skills update`。**

<details>
<summary><strong>三个 CLI 一次装齐，或使用原生插件安装</strong></summary>

在同一台机器上为三个 CLI 安装适配器：

```bash
npx skills add zenstory-ai/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

克隆仓库后，三种 CLI 均可直接发现项目内的 Skills。

#### Claude Code

```text
/plugin marketplace add zenstory-ai/novel-to-game
/plugin install novel-to-game@novel-to-game-skills
/novel-to-game:novel-to-game quick
```

#### Codex

```bash
codex plugin marketplace add zenstory-ai/novel-to-game
codex plugin add novel-to-game@novel-to-game-skills
```

#### Kimi Code 0.27 或更高版本

```text
/plugins install https://github.com/zenstory-ai/novel-to-game
/reload
/skill:novel-to-game quick
```

</details>

> 变更见 [CHANGELOG.md](CHANGELOG.md) 与 [Releases](https://github.com/zenstory-ai/novel-to-game/releases)。仓库已从 `worldwonderer/novel-to-game` 迁至 `zenstory-ai/novel-to-game`，旧文档里的安装与 marketplace 命令已失效，以上面的命令为准。

## 看看它的输出

下面每段节选都摘自本仓库的文件；两个中文示例的文档是简体中文，原样引用，Project Plateau 的文档是英文，此处译成中文并标注（译），原文均有链接。省略处以“…”标出。

### 设计文档长什么样

在[《西游记》](examples/journey-to-the-west/)里，芭蕉扇（铁扇公主罗刹女的法宝，她是牛魔王之妻）先在 [`analysis/SOURCE_BIBLE.md`](examples/journey-to-the-west/analysis/SOURCE_BIBLE.md) 中成为一条条钉到回目的事实（原表 11 行，节选 3 行）：

```markdown
| 事实 | 证据 |
|---|---|
| 真扇一扇息火、二扇生风、三扇下雨；罗刹女先用扇把悟空吹走，悟空求得灵吉菩萨定风丹后返回 | 第59回 |
| 悟空化虫入腹迫使罗刹女交扇，但拿到的是假扇；假扇连续三次使火势升高 | 第59回 |
…
| 牛魔王也会七十二变，化作八戒骗回真扇；悟空因得意而没有细察 | 第61回 |
```

[`concepts/CONCEPT.md`](examples/journey-to-the-west/concepts/CONCEPT.md) 把扇子变成一条正反两面的规则——假扇助火、真扇三段翻盘——并记下另外两个方向死在哪条否决上：

```markdown
硬否决检查结果（每方向一行）：

- 方向一·三借芭蕉扇：通过（六条均未触发）。
- 方向二·西行驿路：触发第 2 条风险——切片时长内关系积累退化为事件按钮与数值条，
  无可重复取舍——淘汰。
- 方向三·二心：触发第 3 条——真假之辨在原著由如来收束，玩家核心张力无法转成可靠
  机制（需虚构原著不存在的破绽）——淘汰。
```

[`design/GAME_DESIGN.md`](examples/journey-to-the-west/design/GAME_DESIGN.md) 给三段各写明效果与持续回合，并说明为什么“三扇何时开”是决战的核心决策：

```markdown
| 次序 | 效果（敌方全体，无视五行） | 原著对应 |
|---|---|---|
| 一扇·息火 | 清除敌方增益（保留我方所加的破防/眩晕/破绽），敌方攻击 −30%（3 回合） | 一扇息火 |
| 二扇·生风 | 全队速度 +30%（3 回合），抢下整条行动队列的先手 | 二扇生风 |
| 三扇·落雨 | 全队持续回血（每次行动回 8% 最大体力，3 回合）；敌方防御 −25% 且**露出破绽（受伤 +60%）**，均 3 回合 | 三扇下雨 |

三段既是战力曲线，也是「三借芭蕉扇」的仪式：先压制敌方攻势、再抢速、后开破绽窗口集火，
配合携宠与变化拿下白牛真身。落雨的破绽期是决战唯一的速决窗口——白牛真身每回合狂暴叠攻，
拖下去必被反杀，所以「三扇何时开」是决战的核心决策。
```

[`design/ART_DIRECTION.md`](examples/journey-to-the-west/design/ART_DIRECTION.md) 让每一扇改写整张背景，而不是闪一个图标：

```markdown
- **真扇三段 · 世界重印**：真扇是 BOSS 战翻盘关键，逐段改写火焰山这张风景——
  一息火：清敌增益、敌军减攻，朱红火层落为骨白余热；
  二生风：全队加速，青白风纹扫过、清去浮灰；
  三落雨：全队持续回血、敌军破防并显露破绽，深蓝雨点落在余火之上。
  …
```

而 [`qa/verification.json`](examples/journey-to-the-west/qa/verification.json) 记录了真实浏览器跑到这个结局并重开的那次运行：

```json
"completeRun": {
  "id": "journey-to-the-west-main-path",
  "cleanContext": true,
  "terminal": "ending: 三借芭蕉扇 · 完",
  "restart": "new campaign title",
  "evidence": "qa/evidence/automated.json"
},
"checks": {
  "launch": "PASS",
  "render": "PASS",
  "input": "PASS",
  "coreLoop": "PASS",
  "outcome": "PASS",
  "restart": "PASS"
},
```

### 一个选择怎样被后文记住

[《金瓶梅》](examples/jin-ping-mei/)是关系与宅门经营的示例。它的 [`concepts/CONCEPT.md`](examples/jin-ping-mei/concepts/CONCEPT.md) 用一句话写下承诺，并为每根体验支柱写明可观察证据和会否决它的现象（原表 5 行，节选 3 行）：

```markdown
核心句：**今夜进谁的门，明早谁拿着昨夜的证据来找你。**
…
| 支柱 | 可观察证据 | 否决现象 |
| --- | --- | --- |
| 五人都能主动改变局面 | 五名女主各有八段路线、独立拒绝和外部能力 | 只换名字、立绘或好感数 |
…
| 成人内容由同意与关系赢得 | 邀请、继续／停止、再次确认、次晨回响 | 用银钱、名分、免罚换亲密 |
| 经营与关系互相提供动作 | 五人的能力分别解决账、谎、货、门路和实物证据 | 最优玩法是避开人物内容 |
```

[`design/GAME_DESIGN.md`](examples/jin-ping-mei/design/GAME_DESIGN.md) 随后禁止“按完选项只回一句话就散场”：

```markdown
- 路线选择必须产生本人回应、旁院回应、玩家处置与至少两日后的旧话追账；旧话回来时连续演出“本人逐字复述→旁院说明外溢代价→玩家兑现／重写／否认→双院结果”四拍，每拍可续读。成熟关系还会触发一次由女主发起的黄昏邀约。
- 次晨优先由被冷落或掌握具体证据的人发起，不生成无来源妒意。
```

这款游戏的 QA 记录对“怎么玩的”写得很坦白。[`qa/verification.json`](examples/jin-ping-mei/qa/verification.json) 六项全部 PASS，第一条限制项是：

```json
{
  "scope": "路径覆盖",
  "reason": "快速路径在每屏选择第一项可行主动作，只到达一个失稳结局；没有穷举其他选项或结局。"
}
```

设计文档自己也划了同一条线：自动化只证明内容存在、可达、可读且状态后果真实；主观吸引力、节奏与平衡不由机器下结论。

### QA 记录承认自己没测什么

[Project Plateau](examples/project-plateau/) 是 3D 示例，文档为英文。它的概念比较了三个各自锚定章节的方向——A · Proof Before Dark（野外观察与带着受损证据返回）、B · Fire Across the Lake（沿溪到湖、逃离追踪的猎食者）、C · The Eighteenth Cave（背着证据的洞穴下降）——并写下胜出方向应被放弃的条件，见 [`concepts/CONCEPT.md`](examples/project-plateau/concepts/CONCEPT.md)（译）：

```markdown
三个方向都支持可重复的玩家决策和有边界的原型。方向 A 胜出，
因为它把整个改编承诺——侦察、记录、生存、带回——
装进一个可读的白昼画面里，而 B 把游戏收窄成追逐，C 收窄成路线判读。
…
若位置或时机无法产生肉眼可见更好的底片，或者拍摄从不改变之后的路线或防御决定，
则选定方向被证伪。`GAME_DESIGN.md` 必须定义这条因果链，并保住不致命的侦察幻想。
```

`npm run verify` 用键鼠事件驱动真实构建，在同一次运行里写出输入轨迹和 `qa/verification.json`。[`build/evidence/current-run/report.json`](examples/project-plateau/build/evidence/current-run/report.json) 里的输入轨迹就是整次远征：

```json
"inputTrace": [
  "KeyW: reach the brook",
  "Right Mouse + Left Mouse: record the brook",
  "KeyW: reach the basalt shelf",
  "Right Mouse + Left Mouse: record basalt scale",
  "KeyA: enter canopy cover",
  "hold KeyC under cover: let the attack widen",
  "KeyW: reach the glade",
  "Right Mouse + Left Mouse: record young at play",
  …
  "KeyS: return to Fort"
],
```

[`build/BUILD_BRIEF.md`](examples/project-plateau/build/BUILD_BRIEF.md) 则写明这个 PASS 到底意味着什么（译）：

```markdown
…
PASS 只在记录下来的本地桌面浏览器里证明这六项效果。
它不证明主观画面质量、舒适度、趣味、平衡、
已清权、公网托管，也不证明其他浏览器、GPU 和设备。
```

证据也会反过来砍产品。产品简报记录了第一次实测跑完整条路线只用了 55.2 秒，推翻了原计划的 5–8 分钟单局，于是产品边界被压到 1–3 分钟一局，而不是往路线里塞等待（见 [`PRODUCT_BRIEF.md`](examples/project-plateau/PRODUCT_BRIEF.md)）。

## 第一条请求

把小说文件、目录或链接交给 Agent，然后复制下面任意一条请求，改一改就能用。

**做一款有原创路线的系统玩法游戏：**

```text
用 novel-to-game quick 把这本小说改编成一款可完整游玩的游戏。
请根据原著推荐目标平台、类型和引擎，并把首个版本控制在 15 分钟左右。
让玩家以原创角色的身份进入世界，走一条穿过原作冲突的新路线。
```

**做互动小说 / 互动叙事**（这会锁定 `narrative-led` 体验档案，让概念、设计与 QA 都按连续场景、人物对白、证词和关键选择来判，而不是套用回合、卡牌和资源条）：

```text
用 novel-to-game quick 把这本小说改编成一款互动叙事游戏。
体验以连续场景、人物对白、证词与关键选择承载；数值只作为隐藏的剧情因果标签，不做常驻数值面板。
关键选择要改变后续场景、人物态度和结局，并在后文被点名回读。
```

**只要设计说明，先不构建：**

```text
使用我获准改编的原文，为目标引擎规划一个小范围的玩法设计切片。
控制选择与结果的数量；写清每项的证据、代价、可见变化，以及后续场景如何使用其状态。
标明允许新增的设定与待决问题。只交付设计说明，不构建、不运行 QA，也不声称运行成品已经完成。
```

`quick` 是默认模式：Agent 先用合理默认值起草产品简报，只追问会改变方向或涉及安全的选择，比较有效替代后继续设计、构建和 QA。想自己选概念时用 `director`：Agent 会在概念阶段停下，给出候选和推荐；你已明确选定方向时不再停靠。

## 工作流

```text
小说 → 游戏化拆解 → 游戏概念 → 世界设计 → 风险白盒 ↺ → 美术方向 → 正式构建 → QA → 可玩游戏
```

世界设计完成后，先用白盒（不要求最终美术的粗略构建）只验证最大的一个设计风险，再进入完整美术生产：叙事因果可以用文本验证，实时操作、空间、物理或镜头不能；观察结果交回设计阶段。正式构建面向批准的运行环境，并准备一条权威验证命令。QA 可以诊断、修复和复跑，但最终记录把六项检查绑定到同一次完整运行；发现的问题按产品、设计、美术、构建各自的文档归属回流。

## Skills

| Skill | 职责 |
|---|---|
| [`novel-to-game`](skills/novel-to-game/) | 确认需求、选择模式、编排阶段并恢复中断进度 |
| [`novel-game-analyze`](skills/novel-game-analyze/) | 提取有引证的规则、动作、空间、角色、系统和名场面 |
| [`game-concept`](skills/game-concept/) | 比较有效替代，排除不合格方案，选择或验证方向 |
| [`game-world-design`](skills/game-world-design/) | 定义玩家承诺、核心循环、世界响应、系统、关卡、失败与结果 |
| [`game-art-direction`](skills/game-art-direction/) | 定义镜头、构图、视觉语法、色光材质、HUD、动效与声音 |
| [`game-build`](skills/game-build/) | 先做与风险匹配的白盒，再在不重做策划的前提下实现正式候选 |
| [`game-qa`](skills/game-qa/) | 用命令、状态、截图和实际游玩路径验证构建，不夸大主观结论 |

## 产物

每次运行都会创建一个紧凑、自包含的改编工作区：

```text
game-adaptations/<project>/
  PRODUCT_BRIEF.md
  analysis/SOURCE_BIBLE.md
  concepts/CONCEPT.md
  design/GAME_DESIGN.md
  design/ART_DIRECTION.md
  build/BUILD_BRIEF.md
  build/app/
  qa/verification.json
  _progress.md
```

设计文档是你自己持有的、不绑定引擎的 Markdown；你批准的目标运行环境决定实际实现与 QA 环境。

## 常见问题

### 我要的是互动叙事，结果拿到卡牌、回合和数值面板。怎样才能得到场景、对白和关键选择？

在请求里说出来，就像上面第二条示例那样。这会在产品简报里锁定 `experienceProfile: narrative-led`，并贯穿概念、设计、美术、构建和 QA。设计方法把每个关键选择记成实际言行、即时反应和一条持久事实及其后文读取点，而不是隐藏总分。这条赛道是在一位读者于 [Discussion #17](https://github.com/zenstory-ai/novel-to-game/discussions/17) 里给我们看到正是这种失败之后补上的；见 [`game-concept`](skills/game-concept/SKILL.md) 与[叙事设计方法](skills/game-world-design/references/narrative-design-method.md)。

### 完整跑一次要多久、花多少钱？

不止一句提示词的事。Agent 要读完整本小说、写五份设计文档、构建并跑 QA，每个阶段都是一次独立的 skill 调用，所以一次完整运行很长，可能跨多次会话（金瓶梅示例的进度文件里有两个不同日期的条目）。token 费用按你所用编码 Agent 的计费；除非美术方向选用图片或语音生成（见下面 GPU 一条），不产生其他费用。公开示例的进度文件没有记录耗时和 token 数，所以这里不给具体数字。

### 会话中途断了，能接着做吗？

能。用 `novel-to-game resume` 开始，它是 `quick`、`director` 之外的第三种模式。它读取 `_progress.md` 和实际存在的文档，找出最后一个真正完成的阶段，从那里继续；测试结果只从 `qa/verification.json` 读取。见[流程契约](skills/novel-to-game/references/pipeline-contract.md)。

### 它面向哪个引擎或平台构建？我的工具链缺失时会不会退回网页？

由你决定，并由产品简报锁定：平台、生产引擎、目标运行时，以及实际可用的测试运行时。目标工具链不可用时，构建不得自动改做网页；只能使用简报里已批准的替代运行时，并分开记录 `targetRuntime`、`testedRuntime` 和未覆盖项。QA 把替代运行视为从不证明目标平台已通过。三个公开示例都是浏览器游戏（两个零依赖静态应用和一个 Three.js + Vite 构建），是因为它们的简报锁定了这样，不是因为这是默认值。目前没有任何公开示例面向原生引擎或主机；Godot、Unity 或移动端构建取决于你环境里的工具链，并按同样方式记录，未测到的部分写成限制项。见 [`game-build`](skills/game-build/SKILL.md) 与 [QA 契约](skills/game-qa/references/qa-contract.md)。

### 需要 GPU 或自己的模型吗？图片和语音的钱谁出？

不需要 GPU，也不需要单独的模型：拆解、设计和代码都由你已在用的编码 Agent 的模型完成。外部服务是可选项。生成图片只在美术方向选择它时使用，工具在你的环境里按能力、许可与费用核实后选择（金瓶梅示例在 `build/art/generated-art.json` 里记录了全部 41 张图由 Codex 内置的图像工具生成）。语音默认关闭，除非美术方向选用；默认在构建期生成为本地资产，只发送逐句台词与必要读音，从不上传小说和设计文档。付费服务是 Agent 开始前会停下来问你的问题之一。见[语音资产生产合同](skills/game-build/references/tts-production-contract.md)。

### 怎么知道它做出来的游戏真的能跑？QA 里的 PASS 是什么意思？

它证明一条权威命令在测试运行时里的一次完整运行展示了六件事：构建启动了、画面非空且会变化、真实输入改变了状态、核心循环完整执行、至少到达一个设计结果、重开回到初态。状态只有 `NOT_RUN`、`FAIL`、`PASS` 三种；未验证不是通过，每次复跑都会覆盖旧的 PASS。每个缺口都写成带范围（scope）和原因（reason）的限制项。它不证明趣味、平衡、沉浸、其他浏览器或设备、权利与发布质量，也不要求真人试玩。见 [QA 契约](skills/game-qa/references/qa-contract.md)。

### 我的小说是一种语言，游戏能用另一种语言吗？

可以。接受任意语言的小说；产物使用你指定的语言，未指定时跟随对话语言。引文和原文证据保留原语言，只翻译决策需要的部分，并维护一张统一术语表（人名、地名、物件、规则）。语域、称呼、人物声口和文化概念沿用原作；礼制、宗教和叙事惯例不替换成另一种文化的类型标签。原文语言不决定界面语言，两者在简报里分别记录。见 [`novel-game-analyze`](skills/novel-game-analyze/SKILL.md)。

### 我没有版权的小说能改编吗？

这套 skills 不替你清权，QA 也不认证权利。版权、资产授权和真实人物属于 Agent 开始前必须停下来问的问题；简报记录合规边界，`SOURCE_BIBLE` 记录版本、覆盖范围和授权边界；依赖复制其他游戏受保护的角色、地图、界面或文本的概念会被硬否决。公开示例使用 Project Gutenberg 文本，并在各自的 `source/SOURCE.md` 里记录权利状态，包括金瓶梅示例为什么只收录删节本。

### 能只要设计文档、不构建吗？

能。用上面第三条请求。每个策划 skill 都停在自己的文档：概念不写代码和数值表，世界设计不写文件名和测试，美术方向把资产生产留给构建阶段。即使进入构建，白盒也只证明选中的最大风险，不产生 QA 结论；六项检查只来自正式构建。

## 延伸阅读

- [小说改游戏入门](https://zenstory.ai/zh/novel-to-game/quick-start)——限定首次改编：分开记录获准使用的原文事实、作者批准的新增设定与待决问题，缩小第一版范围。
- [有后果的选择指南](https://zenstory.ai/zh/novel-to-game/meaningful-choices)——写清每个玩家选项的证据、代价与可见结果，并指出后续哪个场景读取这项状态。
- [NovelToGame 与 story-to-game 类工具的区别](docs/novel-to-game-vs-story-to-game-tools.md)（英文）——三种工具形态和设计文档归谁所有。
- [Blender 资产反馈记录](docs/research/blender-asset-feedback.md)——为什么 Blender 只是 `game-build` 里的条件入口而不是默认项，以及一次单资产实验证明了什么、没证明什么。

## 参与贡献

欢迎提交可复现的 Bug、有证据支持的 Skill 能力缺口，以及能展示独特改编方法的示例提案。请使用 [Issues](https://github.com/zenstory-ai/novel-to-game/issues/new/choose) 里的结构化表单，并阅读[贡献指南](CONTRIBUTING.md)了解必跑的检查与权利规则；问题与早期想法请到 [Discussions](https://github.com/zenstory-ai/novel-to-game/discussions)。

<a href="https://github.com/zenstory-ai/novel-to-game/graphs/contributors"><img alt="Contributors" src="https://contrib.rocks/image?repo=zenstory-ai/novel-to-game"></a>

## 许可证

NovelToGame 使用 [MIT License](LICENSE)。

## 致谢

感谢 [linux.do](https://linux.do) 社区提供早期反馈与支持。

## ZenStory AI 项目

本项目由 [ZenStory AI](https://zenstory.ai/zh) 维护——一组开源、面向 agent 的故事创作、改编与生产工具（GitHub 组织：[zenstory-ai](https://github.com/zenstory-ai)）。同组织项目：

| 项目 | 用途 |
| --- | --- |
| [oh-story-claudecode](https://github.com/zenstory-ai/oh-story-claudecode) | 网文写作 skill 包：扫榜、拆文、写作、去AI味、封面图 |
| [drama-skills](https://github.com/zenstory-ai/drama-skills) | AI 短剧 / 漫剧创作 skill 合集：剧本、资产、分镜、图片/视频提示词、独立审查 |
| [novel-to-game](https://github.com/zenstory-ai/novel-to-game) | 面向原著改编、指定运行环境构建与运行证据 QA 的 agent skills（本仓库） |
| [video-recap-skills](https://github.com/zenstory-ai/video-recap-skills) | 从支持的视频文件生成中文解说成片，并可选导出可编辑的剪映/CapCut 草稿 |
| [oh-story-dsh](https://github.com/zenstory-ai/oh-story-dsh) | DeepSeek Harness 社区插件，提供小说、短剧、游戏和视频解说工作台 |
| [zenstory](https://github.com/zenstory-ai/zenstory) | 对话即创作的 AI 小说写作工作台（[app.zenstory.ai](https://app.zenstory.ai)） |
