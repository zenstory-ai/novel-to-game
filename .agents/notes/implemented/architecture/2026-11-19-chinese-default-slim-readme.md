# Agent Note: README 改以中文为默认入口并精简非核心章节

Status: implemented

## Problem

`zenstory-ai` 组织下其余主力仓库（`oh-story-claudecode`、`drama-skills`、`video-recap-skills`）均以简体中文 `README.md` 为默认入口，唯独本仓库仍停留在 212f7e2 设定的英文默认（`README.md` + `README_ZH.md`，见 [language-scope-per-surface](2026-07-29-language-scope-per-surface.md)）。同时，两份 README 经过多轮扩写已累积至 410 余行：包含 9 段示例节选、10 道与前文大量重叠的 FAQ，以及独立的 Skills、产物、延伸阅读、参与贡献与许可证章节，拉长了阅读动线。

## Decision

翻转 [language-scope-per-surface](2026-07-29-language-scope-per-surface.md) 中 README surface 的默认语言，并在保留组织统一居中 masthead（见 [readme-masthead](../process/2026-09-16-readme-masthead.md)）的前提下收束正文结构：

- `README.md` 改为简体中文默认入口，`README_EN.md` 为结构一致的英文镜像（顶部保留 `Last synced` 注释），删除 `README_ZH.md`。`AGENTS.md`、`.release/policy.json`、`scripts/validate_repo.py` 与 `tests/test_validate_repo.py` 同步切换至 `README.md` + `README_EN.md`。
- 其余 surface 的语言边界保持不变：skill 正文与 `references/` 恒为简体中文；frontmatter `description`、插件清单与 `agents/openai.yaml` 接口字段继续英文起首。
- 保留居中 masthead、在线试玩、这是什么、安装、看看它的输出、怎么用、工作流（合并 Skills 与主要产出三列表）、精简后的 4 条常见问题、仅保留单条 `<https://linux.do>` 地址的致谢，以及置于末尾的 ZenStory AI 项目表；删去独立的延伸阅读、参与贡献与许可证章节，压缩示例节选与重复 FAQ，并清理从英文直译遗留的生僻词与公文/套路句式。

## Alternatives considered

- **维持英文 `README.md` + `README_ZH.md`（212f7e2）** — 最强理由：海外访客无需点一次语言切换，也不必改动校验器与发布策略中的文件名。否决原因：插件目录与 Agent 英文路由依赖的是 manifest 与 frontmatter `description`（仍保持英文优先），而非 GitHub 仓库主页；与同组织其余仓库统一为中文默认更符合主力读者语境。
- **把头部 masthead 一并压成纯 Markdown 单行导航** — 最强理由：进一步减少首屏行数。否决原因：破坏 `zenstory-ai` 六个仓库统一的首屏品牌标识、徽章色板与社区入口（[readme-masthead](../process/2026-09-16-readme-masthead.md)）。

## Consequences

- 收益：与组织其余仓库统一为中文默认，正文由 417 行压缩至约 280 行，保留完整试玩、真实产物节选与核心 FAQ 的同时去掉重复章节与尾注噪音。
- 代价：外部指向旧 `README_ZH.md` 的书签会失效；后续改动 README 时仍需同步 `README.md` 与 `README_EN.md` 的结构。

## Verification

`python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests -v` 通过；核对 `README.md` 与 `README_EN.md` 标题层级、代码围栏数、本地链接与页内锚点一致，且保留的示例节选与 `examples/` 原文件逐行一致。
