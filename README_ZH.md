# NovelToGame

> 把任何语言的小说，改编成有原著依据、可完整游玩的游戏。

[![Validate](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml/badge.svg)](https://github.com/worldwonderer/novel-to-game/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f766e.svg)](LICENSE)

NovelToGame 是一套面向 Claude Code、Codex 和 Kimi Code 的开源 Agent Skills。它把小说中的规则、空间、人物与冲突，转成玩家动作、系统、关卡和可验证的完整流程。

它接受任何语言的小说，按用户指定的语言生成产物，并严格针对选定的网页、原生端、移动端或游戏引擎进行构建和验证，不会为了实现方便偷换运行环境。

[English](README.md) · [在线试玩](#在线试玩) · [快速开始](#快速开始) · [安装](#安装) · [查看产出](#产出) · [参与贡献](CONTRIBUTING.md)

## 在线试玩

### 主展示例 · Project Plateau: Proof Before Dark

《失落的世界》被改编成一款实时**第一人称 3D 野外摄影游戏**：穿过连通的高原，观察共同生活的禽龙家庭，在空中威胁下拍完四张玻璃底片，再带着幸存的影像返回。

#### 36 秒发布视频

https://github.com/user-attachments/assets/4d0b501e-09be-49b6-9070-c605afce3fae

**[浏览器直接试玩，无需安装](https://plateau.vibecoco.ai)** · **[看它如何从小说改编而来](examples/project-plateau/)** · [反馈体验](https://github.com/worldwonderer/novel-to-game/discussions/7)

### 更多可玩改编

| 《西游记》· 三借芭蕉扇 | 《金瓶梅》· 风月总账 |
|---|---|
| [![《三借芭蕉扇》标题画面](examples/journey-to-the-west/screenshots/title.jpg)](https://xiyouji.vibecoco.ai) | [![《风月总账》标题画面](examples/jin-ping-mei/screenshots/title.jpg)](https://jinpingmei.vibecoco.ai) |
| 回合制系统 RPG：五行、阵型、变化、携宠与多阶段 Boss | 18+ 关系策略游戏：六日日程、角色意志、资源与人情债、三种结局 |
| **[试玩](https://xiyouji.vibecoco.ai)** · [完整案例](examples/journey-to-the-west/) | **[试玩](https://jinpingmei.vibecoco.ai)** · [完整案例](examples/jin-ping-mei/) |

三份已发布示例都包含原著来源、产品约束、游戏化拆解、方案选择、世界与美术设计、构建说明以及可运行源码。

## 快速开始

安装后，把小说文件、目录或链接交给 Agent：

```text
用 novel-to-game quick 把这本小说改编成一款可完整游玩的游戏。
请根据题材推荐目标平台、类型和引擎，并把首个版本控制在 15 分钟左右。
玩家以原创身份进入世界，不要逐段复演原作剧情。
```

`quick` 会自动选择最有原著依据、也最适合做成完整游戏的方向；想在世界设计之前从三个方案里亲自选择，就使用 `director`。

## 它解决什么

直接让模型“把这本书做成游戏”，经常只会得到换皮玩法或可点击的剧情摘要。NovelToGame 把最需要判断力的工作拆成几个明确阶段：

- **先锁产品边界**：平台、类型、目标体验、画风、分级、引擎和不可改写的要求；
- **再找可玩的原著证据**：规则、动作、空间、角色意志、系统与关键视觉元素；
- **让概念、关卡和美术各自负责**：实现阶段不能静默重做策划；
- **以真实运行收尾**：启动、输入、状态变化、完整流程、结果、重开和目标分辨率或设备都必须留下证据。

## 安装

### Agent Skills

为你使用的 CLI 安装全部七个技能：

| Agent CLI | 安装命令 | 调用方式 |
|---|---|---|
| Claude Code | `npx skills add worldwonderer/novel-to-game -g -y -a claude-code -s '*'` | `/novel-to-game` |
| Codex | `npx skills add worldwonderer/novel-to-game -g -y -a codex -s '*'` | `$novel-to-game` |
| Kimi Code | `npx skills add worldwonderer/novel-to-game -g -y -a kimi-code-cli -s '*'` | `/skill:novel-to-game` |

同时安装三端：

```bash
npx skills add worldwonderer/novel-to-game -g -y -s '*' \
  -a claude-code -a codex -a kimi-code-cli
```

克隆仓库后，三端也能发现项目内的七个技能。

### 原生插件

Claude Code：

```text
/plugin marketplace add worldwonderer/novel-to-game
/plugin install novel-to-game@novel-to-game-skills
/novel-to-game:novel-to-game quick
```

Codex：

```bash
codex plugin marketplace add worldwonderer/novel-to-game
codex plugin add novel-to-game@novel-to-game-skills
```

Kimi Code 0.27 或更高版本：

```text
/plugins install https://github.com/worldwonderer/novel-to-game
/reload
/skill:novel-to-game quick
```

## 流程

总入口先确认 `PRODUCT_BRIEF.md`，再串起六个职责分离的阶段；验证失败后会回到构建阶段继续修复，直到证据满足门槛。

```mermaid
flowchart LR
    classDef io fill:#fce4ec,color:#333,stroke:#e57373,stroke-width:1px
    classDef orch fill:#eef2ff,color:#1e1b4b,stroke:#6366f1,stroke-width:1px

    novel["📖 小说"]:::io --> orch["novel-to-game"]:::orch
    orch --> 需求 --> 分析 --> 概念 --> 世界设计 --> 美术 --> 构建 --> 验证 --> game["🎮 可玩游戏"]:::io
    验证 -.->|未通过| 构建
```

需求阶段会锁定平台、实际交付方式、游戏类型与对标、美术方向、内容分级、核心幻想和引擎。下游必须遵守这些边界，不能在实现时悄悄换成更容易做的游戏。

## 七个技能

| 技能 | 职责 |
|---|---|
| `novel-to-game` | 总入口：需求确认、模式选择、阶段编排与进度恢复 |
| `novel-game-analyze` | 提取规则、动作、空间、角色、系统与名场面，形成有引证的设定集 |
| `game-concept` | 生成三个真正不同的方向，排除不合格方案后选出一个 |
| `game-world-design` | 定义玩家体验目标、核心循环、世界响应、系统、关卡、失败与结果 |
| `game-art-direction` | 定义镜头、构图、视觉语法、色光材质、HUD、动效与声音 |
| `game-build` | 压缩构建说明，驱动编码智能体实现可完整游玩的原型 |
| `game-qa` | 用命令、状态、截图与实际游玩路径验证构建，不伪装主观结论 |

## 产出

每次运行创建一个紧凑、自包含的改编工作区：

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

核心设计文档不绑定某个模型、平台或游戏引擎；构建阶段会按照已批准的目标平台选择合适实现。

## 参与贡献

欢迎提交可复现的 Bug、有证据的 Skill 能力缺口和具有新改编价值的示例提案。
请先阅读 [贡献指南](CONTRIBUTING.md)，并使用仓库的结构化 Issue 与 PR 模板。

## 致谢

[linux.do](https://linux.do)
