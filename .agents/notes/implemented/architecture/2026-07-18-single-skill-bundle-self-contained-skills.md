# Agent Note: 七个 skill 打成一个 bundle，skills/ 是唯一内容源，skill 之间不许文件依赖

Status: implemented

## Problem

Claude Code、Codex、Kimi Code 的发现、插件与调用契约各不相同；编排器 `novel-to-game` 依赖六个下游 skill。若按 CLI 各维护一份 skill 副本，内容会分叉；若按 skill 分别发布，装了编排器却可能装不齐下游。

## Decision

- `skills/` 是唯一内容源，固定七个目录（`EXPECTED_SKILLS`）。CLI 适配层只做指向：`.agents/skills -> ../skills` 相对符号链接；`.claude/skills/<name> -> ../../skills/<name>` 逐个链接；`.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`、`kimi.plugin.json` 三个 manifest 的 `skills` must 是字符串 `./skills` 或 `./skills/`（三份现状都写后者；单元素列表自 #44 起不再接受）；`.claude-plugin/marketplace.json` must 恰好暴露一个 `source: "./"` 的 bundle。三个插件 manifest 与 marketplace 里那个 bundle 条目的 `name` 固定 `novel-to-game`（marketplace 自身顶层 `name` 是 `novel-to-game-skills`）；四份的 `version` must 等于 `VERSION` 文件。
- 每个 skill 自包含：Markdown 链接 never 离开本 skill 目录（`link leaves skill` 即失败），也不能断链；需要其他 skill 时按裸名调用（编排器写「调用 `game-concept`」）；README 里的 `/novel-to-game`、`$novel-to-game`、`/skill:novel-to-game` 是三个 CLI 各自的用户入口命令。`agents/openai.yaml` 的默认 prompt must 出现 `$<skill-name>`。
- 自包含的直接推论：编排器持有的产物语言规则无法被引用，每个下游 `SKILL.md` must 逐字重述 `OUTPUT_LANGUAGE_RULE`（见 [language-scope-per-surface](2026-07-29-language-scope-per-surface.md)）。
- 验证入口固定为 `python3 scripts/validate_repo.py` 与 `python3 -m unittest discover -s tests -v`，两者不依赖第三方包。

来源：958056a、7e75f9d、91351f1、58e0ae4 (#44)

## Alternatives considered

- **七个 skill 分别发布为可独立安装的插件** — 最强理由：用户可只装需要的阶段。否决原因：编排器失去六个下游依赖的闭包，单装 `novel-to-game` 得到一个调不动任何阶段的入口（958056a 明确拒绝）。
- **给 bundle 增加通用验证框架作为运行时** — 最强理由：build 与 QA 的交接可以由框架统一实现。否决原因：产品是交接契约与改编判断，不是再捆一个运行时；且会引入跨 skill 运行时文件依赖（91351f1 明确拒绝）。
- **接入第四个 CLI（Reasonix）** — 曾有一条"仓库根不得出现 `reasonix-plugin.json`"的守卫，#44 作为死代码删除；仓库历史里未见真正接入过第四个 CLI，只能确认支持集就是三个。

## Consequences

- 收益：任何 CLI 装到的都是同一份七 skill 内容；符号链接与 manifest 的正确性由校验器保证，不靠手工核对。
- 代价：同一条规则若多个 skill 都需要，只能各抄一份，靠行数预算（见 [skill-line-budget](../process/2026-08-11-skill-line-budget.md)）压制复制膨胀；新增 skill 要同时改 `EXPECTED_SKILLS`、`.claude/skills` 链接与 README。
- 例外：`examples/` 不是 skill，不受自包含约束。
