# Agent Note: 语言范围按 surface 划分，不设全仓单一语言

Status: implemented

## Problem

仓库同时面向两类读者：运行时读 skill 正文的 Agent，以及用英文提问、在插件目录里按 description 路由的用户与 CLI。全仓一种语言两头都伤：全中文时，英文请求路由不到任何 skill，插件目录展示的 listing copy 没有 README 兜底；全双语时，每次契约重构都要同步两份运行时散文。README 的默认语言也曾在中英之间来回改过一次。

## Decision

语言边界按 surface 逐条锁定，写在 `AGENTS.md`，由 `scripts/validate_repo.py` 与 `tests/test_validate_repo.py` 机械执行：

- skill 正文与 `references/`：must 始终简体中文。测试扫描 `skills/**/*.md` 的每个标题行，不含 CJK 即失败。
- frontmatter `description`、三个插件 manifest 与 marketplace 的 description：must 英文在前、中文在后，校验器用首字符是否 ASCII 字母判定（`leads_with_english`）。`agents/openai.yaml` 接口字段同样英文在前，但只靠约定：校验器对它只检查文件存在与默认 prompt 出现 `$<skill-name>`。
- 示例：由各自 `example.json` 的 `language` 声明；只有声明 `zh*` 的示例才要求中文标题，英文示例 project-plateau 不受此检查。
- README：`README.md` 英文为默认入口，`README_ZH.md` 中文镜像，两者的示例链接顺序 must 一致（`validate_readme_example_order`）。
- 产物语言与仓库语言分离：每个非编排 skill 的 `SKILL.md` must 原样包含 `OUTPUT_LANGUAGE_RULE` 那句话——跨 skill 链接被拒，规则无法引用编排器（见 [single-skill-bundle](2026-07-18-single-skill-bundle-self-contained-skills.md)）。

never 在 skill 正文里维护中英双份。文件名、命令、代码字段、状态值、专有名词在任何 surface 保持原文。

来源：958056a、ac5b933、cf05311、7e75f9d、bfbb3c1、212f7e2、6c450da (#20)、58e0ae4 (#44)

## Alternatives considered

- **全仓统一简体中文（首版规则）** — 最强理由：一种语言最省同步成本，README 已有英文版做门面。否决原因：路由发生在 description 上而不是 README 上，中文优先的 description 让整个 bundle 对英文请求不可见（7e75f9d）。
- **中文 README 作为默认入口（`README.md` 中文 + `README_EN.md`）** — 2026-07-19 落地（ac5b933），理由是示例与作者语境都是中文。2026-08-01 随 Project Plateau 公开发布改回英文默认（212f7e2）：公开入口面向英文读者，且校验器只认一组固定文件名，来回改名意味着校验器跟着改（cf05311 即为此修补）。
- **skill 正文双语** — 最强理由：英文 Agent 读中文散文有理解损耗。否决原因：运行时散文是每次契约重构都要动的文件，双语层必须同步两份（7e75f9d 明确拒绝）。

## Consequences

- 收益：英文路由与中文运行时并存而互不干扰；哪个 surface 用什么语言可以被脚本判定，不靠评审记忆。
- 代价：每个 skill 都要原样复制一句产物语言规则；新增 surface（例如新的 CLI manifest）必须同时加进 `PLUGIN_MANIFESTS` 与英文优先检查，否则落在规则之外。
