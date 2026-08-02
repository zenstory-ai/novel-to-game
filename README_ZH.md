# NovelToGame

> 把任何语言的小说，改编成有原著依据、可完整游玩的游戏。

[![Validate](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml/badge.svg)](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml) [![Latest release](https://img.shields.io/github/v/release/worldwonderer/novel-to-game?display_name=tag&sort=semver)](https://github.com/worldwonderer/novel-to-game/releases/latest) [![License](https://img.shields.io/github/license/worldwonderer/novel-to-game)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/worldwonderer/novel-to-game?style=flat&logo=github)](https://github.com/worldwonderer/novel-to-game/stargazers)

NovelToGame 是一套面向 Claude Code、Codex 和 Kimi Code 的开源 Agent Skills。它把小说游戏化改编拆成一条职责清晰的流程：拆解原著、选择概念、设计世界与美术、完成构建，并在目标运行环境中实际验证。

小说可以使用任何语言，生成内容使用用户指定的语言。构建和 QA 始终以选定的平台或引擎为准，不会为了实现方便换成更容易的替代环境。

[English](README.md) · [在线试玩](#在线试玩) · [快速开始](#快速开始) · [工作流](#工作流) · [Skills](#skills) · [产物](#产物) · [参与贡献](#参与贡献)

## 在线试玩

### Project Plateau · 精选 3D 案例

这是一款由柯南·道尔《失落的世界》改编而来的实时**第一人称 3D 野外摄影游戏**。玩家穿过连通的高原，观察共同生活的禽龙家庭，在空中威胁下拍完四张玻璃底片，再带着幸存的影像返回。

#### 36 秒演示

https://github.com/user-attachments/assets/4d0b501e-09be-49b6-9070-c605afce3fae

**[浏览器直接试玩，无需安装](https://plateau.vibecoco.ai)** · **[查看完整改编案例](examples/project-plateau/)** · [反馈体验](https://github.com/worldwonderer/novel-to-game/discussions/7)

### 更多可玩改编

| [《西游记》· 三借芭蕉扇](examples/journey-to-the-west/) | [《金瓶梅》· 风月总账](examples/jin-ping-mei/) |
|---|---|
| [![《三借芭蕉扇》标题画面](examples/journey-to-the-west/screenshots/title.jpg)](https://xiyouji.vibecoco.ai) | [![《风月总账》标题画面](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai) |
| 回合制系统 RPG：五行、阵型、变化、携宠与多阶段 Boss | 18+ 六日关系策略游戏：角色意志、资源与人情债，以及三种结局 |
| **[浏览器试玩](https://xiyouji.vibecoco.ai)** | **[浏览器试玩](https://jinpingmei.vibecoco.ai)** |

每个完整案例都包含原文依据、产品约束、游戏化拆解、概念与设计决策、可运行源码和 QA 证据。

## 为什么用 NovelToGame

只给模型一句“把这本书做成游戏”，很容易得到通用玩法换皮或可点击的剧情摘要。NovelToGame 让关键决策各有负责人，并保留从原著到成品的判断依据：

- **基于原著做改编**：从文本中提取有原文依据的规则、空间、角色意志、冲突和视觉锚点；
- **真正完成游戏设计**：把原著证据转成玩家动作、系统、关卡、反馈、失败与结果；
- **面向目标环境构建**：严格按照批准的平台或引擎实现，避免实现阶段悄悄重做策划；
- **克制地选用语音**：只在构建期合成已经批准的关键台词，保留字幕与静音降级，默认不向 TTS 供应商发送整本小说；
- **用运行证据做 QA**：验证启动、输入、状态变化、完整流程、结果、重开和目标设备或显示模式。

## 快速开始

### 1. 安装七个 Skills

| Agent CLI | 安装命令 | 调用方式 |
|---|---|---|
| Claude Code | `npx skills add worldwonderer/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add worldwonderer/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add worldwonderer/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

在同一台机器上为三个 CLI 安装适配器：

```bash
npx skills add worldwonderer/novel-to-game -g -y -s '*' \
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

`quick` 适合直接交给 Agent 完成：确认需求后，它会比较三种把小说做成游戏的方案，选出最值得实现的一种，再继续完成设计、构建和 QA。想先看过这三种方案并亲自决定做哪一种，就用 `director`。

<details>
<summary><strong>使用原生插件安装</strong></summary>

#### Claude Code

```text
/plugin marketplace add worldwonderer/novel-to-game
/plugin install novel-to-game@novel-to-game-skills
/novel-to-game:novel-to-game quick
```

#### Codex

```bash
codex plugin marketplace add worldwonderer/novel-to-game
codex plugin add novel-to-game@novel-to-game-skills
```

#### Kimi Code 0.27 或更高版本

```text
/plugins install https://github.com/worldwonderer/novel-to-game
/reload
/skill:novel-to-game quick
```

</details>

## 工作流

总入口先锁定 `PRODUCT_BRIEF.md`，再让改编任务依次进入六个职责独立的阶段。QA 未通过时返回构建阶段继续修复，直到运行证据满足门槛。

```text
小说 → 游戏化拆解 → 游戏概念 → 世界设计 → 美术方向 → 构建 ⇄ QA → 可玩游戏
```

游戏概念、体验与关卡设计、美术方向分别接受独立评审。构建面向选定的运行环境，QA 也在同一环境中用实际运行证据完成验证。美术方向选用语音时，构建期 TTS 仍是可选且不绑定供应商的能力；发布前须有逐句权利、请求指纹、本地音频、字幕、失败降级、解码与响度证据，以及人工试听记录。

## Skills

| Skill | 职责 |
|---|---|
| [`novel-to-game`](skills/novel-to-game/) | 确认需求、选择模式、编排阶段并恢复中断进度 |
| [`novel-game-analyze`](skills/novel-game-analyze/) | 提取有引证的规则、动作、空间、角色、系统和名场面 |
| [`game-concept`](skills/game-concept/) | 生成三个真正不同的方向，排除不合格方案后选出一个 |
| [`game-world-design`](skills/game-world-design/) | 定义玩家承诺、核心循环、世界响应、系统、关卡、失败与结果 |
| [`game-art-direction`](skills/game-art-direction/) | 定义镜头、构图、视觉语法、色光材质、HUD、动效与声音 |
| [`game-build`](skills/game-build/) | 压缩批准后的构建说明，驱动实现直到游戏可以完整游玩 |
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
  qa/QA_REPORT.md
  _progress.md
```

核心设计文档不绑定某个模型或游戏引擎；批准后的目标运行环境决定实际实现与 QA 环境。

## 参与贡献

欢迎提交可复现的 Bug、有证据支持的 Skill 能力缺口，以及能展示独特改编方法的示例提案。请阅读 [贡献指南](CONTRIBUTING.md)，并使用仓库提供的 Issue 与 PR 模板。

## 许可证

NovelToGame 使用 [MIT License](LICENSE)。

## 致谢

感谢 [linux.do](https://linux.do) 社区提供早期反馈与支持。
