# Agent Note: 示例用 example.json 自述来源结构，校验器只核对自述是否属实

Status: implemented

## Problem

校验器曾硬编码两个示例名和一条中文「第X回」标题正则，仓库在结构上只容得下中文章回体原著；加一个英文示例得先改校验器。校验器的职责是核对示例说的对不对，不是规定示例能是什么。

## Decision

每个 `examples/<name>/` must 带 `example.json`，必填 `language`、`targetFinish`、`coverageHeading`、`citationPattern` 与 `source{chapters, headingPattern, numeral}`；`numeral` 取 `chinese`/`arabic`/`roman`，`targetFinish` 取 `graybox`/`playable-prototype`/`polished-vertical-slice`/`showcase`；其余项目自有字段（如 `title`）允许。校验器按声明工作：

- `source/*.txt` 按 `headingPattern` 与 `numeral` 解析，must 得到 1..chapters 连续章节；可跨多个文本文件。
- `analysis/SOURCE_BIBLE.md` 的 `coverageHeading` 节 must 引用且仅引用这些章节。
- `citationPattern` 在五份策划产物里 must 至少命中一次，否则判失败——避免逐条引用检查在模式不匹配时真空通过。
- `PRODUCT_BRIEF.md`、`design/ART_DIRECTION.md`、`build/BUILD_BRIEF.md`（及可选的 `design/VISUAL_TARGETS.md`）各 must 写 `targetFinish:`；校验的是值不是行数——文件里出现的值去重后 must 恰好等于 manifest 声明的那一个。
- 五份策划文件 must 存在（SOURCE_BIBLE、CONCEPT、GAME_DESIGN、ART_DIRECTION、BUILD_BRIEF），目录里多出的项目文件不算错。
- 中文标题检查不在校验器里，而在 `tests/test_validate_repo.py`，它同样读 manifest：只对 `language` 以 `zh` 开头的示例生效。

示例集合不再由校验器枚举：加减示例不需要改脚本（Frankenstein 下架时校验器零改动）。

来源：bfbb3c1、817b741、45d2c3c、6c450da (#20)、58e0ae4 (#44)

## Alternatives considered

- **校验器硬编码 `EXPECTED_EXAMPLES` 与章回正则（首版做法）** — 最强理由：最简单，两个示例长得一样。否决原因：结构上排斥非中文原著，每个新示例都要改校验器（bfbb3c1）。
- **把 `analysis/_coverage.md` 列为必需文件** — 最强理由：流程契约要求它。否决原因：两个更早的示例先于该规则，强制会追溯判失败；改为允许不强制（bfbb3c1），#44 进一步放开为"多出的文件不算错"。

## Consequences

- 收益：英文、罗马数字章节的 project-plateau 与中文章回体示例用同一校验器；示例的语言、来源结构、成色是它自己声明的可核对事实。
- 代价：声明错了，校验也会"正确地"通过声明——`headingPattern` 写宽了，章节数对上即过；正则本身只做可编译检查。
- 相关：`qa/verification.json` 的检查见 [six-check-minimal-qa-contract](../testing/2026-08-06-six-check-minimal-qa-contract.md)，`targetFinish` 只影响成色，不改 QA 六项。
