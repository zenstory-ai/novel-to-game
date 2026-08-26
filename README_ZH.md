# NovelToGame

> 把任何语言的小说，改编成有原著依据、可完整游玩的游戏。

[![Validate](https://github.com/zenstory-ai/novel-to-game/actions/workflows/validate.yml/badge.svg)](https://github.com/zenstory-ai/novel-to-game/actions/workflows/validate.yml) [![Latest release](https://img.shields.io/github/v/release/zenstory-ai/novel-to-game?display_name=tag&sort=semver)](https://github.com/zenstory-ai/novel-to-game/releases/latest) [![License](https://img.shields.io/github/license/zenstory-ai/novel-to-game)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/zenstory-ai/novel-to-game?style=flat&logo=github)](https://github.com/zenstory-ai/novel-to-game/stargazers)

NovelToGame 是一套面向 Claude Code、Codex 和 Kimi Code 的开源 Agent Skills。它把小说游戏化改编拆成一条职责清晰的流程：拆解原著、选择概念、设计世界与美术、完成构建，并在目标运行环境中实际验证。

小说可以使用任何语言，生成内容使用用户指定的语言。构建和 QA 始终以选定的平台或引擎为准，不会为了实现方便换成更容易的替代环境。

[English](README.md) · [在线试玩](#在线试玩) · [快速开始](#快速开始) · [工作流](#工作流) · [Skills](#skills) · [产物](#产物) · [参与贡献](#参与贡献)

## 在线试玩

三款可玩的改编，都可以直接在浏览器里打开，每一款都链到对应的改编案例：原文依据、概念取舍、游戏与美术方向、可运行源码，以及来自实际游玩流程的证据。

### 西游记 · 三借芭蕉扇

[![积雷山决战中敌我阵列完整留在木刻舞台，下方轻绢指令台与人物画面彼此分离](examples/journey-to-the-west/screenshots/hero.jpg)](https://xiyouji.vibecoco.ai)

**一扇吹出五万里。这口气，一回合一回合打回来。**

你指挥孙悟空一行三借芭蕉扇：算五行、循火脉残图寻宝、在收手与深入之间下注、排阵型、变形取巧硬闯不进的地方，把一个正面打不过的牛魔王，打成落在火焰山上的一场雨。

**[浏览器试玩](https://xiyouji.vibecoco.ai)** · [查看改编案例](examples/journey-to-the-west/) · 设计估时 45–90 分钟 · 全年龄 · 可玩原型

### 金瓶梅 · 风月总账

[![西门宅中五人隔着总账看向玩家](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai)

**今夜进谁的门，明早谁来敲你的门。**

二十日，五处院门。平衡银钱、官势、声名、见光与宅门损耗，守住每个人亲口说出的规矩，让不同院门在真实危局中建立互信，最后面对一笔由所有选择和记忆共同写成的总账。

**[浏览器试玩](https://jinpingmei.vibecoco.ai)** · [查看改编案例](examples/jin-ping-mei/) · 设计估时 60–90 分钟 · 18+ · 可玩原型

### Project Plateau · 失落的世界 · 3D

这是一款由柯南·道尔《失落的世界》改编而来的实时**第一人称 3D 野外摄影游戏**。玩家穿过连通的高原，观察共同生活的禽龙家庭，在空中威胁下拍完四张玻璃底片，再带着幸存的影像返回。

桌面浏览器可完整试玩，其他设备可直接观看 15 秒实机预览。

https://github.com/user-attachments/assets/27819247-4e4d-4bf0-8f0f-43d4125c4d45

**[浏览器直接试玩，无需安装](https://plateau.vibecoco.ai)** · [查看改编案例](examples/project-plateau/) · [反馈体验](https://github.com/zenstory-ai/novel-to-game/discussions/7) · 1–3 分钟一局 · 桌面 WebGL2 · 可玩原型

## 为什么用 NovelToGame

只给模型一句“把这本书做成游戏”，很容易得到通用玩法换皮或可点击的剧情摘要。NovelToGame 让关键决策各有负责人，并保留从原著到成品的判断依据：

- **基于原著做改编**：从文本中提取有原文依据的规则、空间、角色意志、冲突和视觉锚点；
- **真正完成游戏设计**：把原著证据转成玩家动作、系统、关卡、反馈、失败与结果；
- **面向目标环境构建**：严格按照批准的平台或引擎实现，避免实现阶段悄悄重做策划；
- **克制地选用语音**：只在构建期合成选定的关键台词，保留字幕与静音降级，默认不向 TTS 供应商发送整本小说；
- **用运行证据做 QA**：在实际测试环境中验证启动、渲染、输入、核心循环、一个结果、重开和明确限制。

## 快速开始

### 1. 安装七个 Skills

| Agent CLI | 安装命令 | 调用方式 |
|---|---|---|
| Claude Code | `npx skills add zenstory-ai/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add zenstory-ai/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add zenstory-ai/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

在同一台机器上为三个 CLI 安装适配器：

```bash
npx skills add zenstory-ai/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

克隆仓库后，三种 CLI 均可直接发现项目内的 Skills。

### 2. 开始一次改编

把小说文件、目录或链接交给 Agent：

```text
用 novel-to-game quick 把这本小说改编成一款可完整游玩的游戏。
请根据题材推荐目标平台、类型和引擎，并把首个版本控制在 15 分钟左右。
玩家以原创角色的身份进入世界，不要逐段复演原作剧情。
```

想要**互动小说 / 互动叙事**而不是系统玩法时，直接说出来——这会锁定 `narrative-led` 体验档案，让概念、设计与 QA 都按连续场景、人物对白、证词和关键选择来判，而不是套用回合、卡牌和资源条：

```text
用 novel-to-game quick 把这本小说改编成一款互动叙事游戏。
体验以连续场景、人物对白、证词与关键选择承载；数值只作为隐藏的剧情因果标签，不做常驻数值面板。
关键选择要改变后续场景、人物态度和结局，并在后文被点名回读。
```

叙事主导**不降低任何标准**：同样要有可识别的玩法先例、三段弧和硬否决；只是判据换成“新的可问
对象、新的质证手段、因先前行为改变的人物态度”这类说法。

`quick` 是低门槛默认模式：Agent 先给出合理草案，只追问会改变产品方向或涉及安全的选择，再比较三个概念并继续设计、构建和 QA。每个项目只运行一次最小 QA 路径：真实启动、渲染、输入、完整循环、一个结果、重开和明确限制；不要求真人试玩或另写审批报告。想自己选择概念时使用 `director`。

<details>
<summary><strong>使用原生插件安装</strong></summary>

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

## 工作流

总入口先锁定 `PRODUCT_BRIEF.md`，再让改编任务进入职责独立的决策阶段。概念、体验/关卡与美术方向继续分别负责。世界设计完成后，先用与风险匹配的白盒验证最难的因果、系统、空间或操作问题，再开始美术生产；观察结果交回设计 owner，不新增一道 QA 门。

```text
小说 → 游戏化拆解 → 游戏概念 → 世界设计 → 风险白盒 ↺ → 美术方向 → 正式构建 → QA → 可玩游戏
```

白盒只运行足以暴露声明风险的最窄模型/回放检查。正式构建面向选定的运行环境并准备一条权威验证入口，QA 只运行一次，用实际运行证据记录六项最小玩家效果。只有实际采用的能力才运行对应回归检查；不要求真人试玩门禁或重复 QA 报告。源码身份、公网托管、营销、权利、主观趣味和发布质量不由这份机器记录证明。

## Skills

| Skill | 职责 |
|---|---|
| [`novel-to-game`](skills/novel-to-game/) | 确认需求、选择模式、编排阶段并恢复中断进度 |
| [`novel-game-analyze`](skills/novel-game-analyze/) | 提取有引证的规则、动作、空间、角色、系统和名场面 |
| [`game-concept`](skills/game-concept/) | 生成三个真正不同的方向，排除不合格方案后选出一个 |
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

核心设计文档不绑定某个模型或游戏引擎；批准后的目标运行环境决定实际实现与 QA 环境。

## 参与贡献

欢迎提交可复现的 Bug、有证据支持的 Skill 能力缺口，以及能展示独特改编方法的示例提案。请阅读 [贡献指南](CONTRIBUTING.md)，并使用仓库提供的 Issue 与 PR 模板。

## 许可证

NovelToGame 使用 [MIT License](LICENSE)。

## 致谢

感谢 [linux.do](https://linux.do) 社区提供早期反馈与支持。
