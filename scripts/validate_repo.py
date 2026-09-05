#!/usr/bin/env python3
"""Dependency-free structural validation for the NovelToGame skill set."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


EXPECTED_SKILLS = {
    "game-art-direction",
    "novel-to-game",
    "novel-game-analyze",
    "game-concept",
    "game-world-design",
    "game-build",
    "game-qa",
}
EXAMPLE_MANIFEST = "example.json"
# 示例的原著结构因语言而异（回目写法、章数、覆盖节标题、引用格式），
# 不能写死在校验器里，否则仓库结构上只容得下中文章回体原著。
# 每个示例用 example.json 自述这些取值，校验器只校验「自述得对不对」。
MANIFEST_REQUIRED = {
    "language",
    "source",
    "coverageHeading",
    "citationPattern",
    "targetFinish",
}
SOURCE_REQUIRED = {"chapters", "headingPattern", "numeral"}
NUMERAL_KINDS = {"chinese", "arabic", "roman"}
TARGET_FINISHES = {
    "graybox",
    "playable-prototype",
    "polished-vertical-slice",
    "showcase",
}
MINIMAL_QA_CHECKS = {
    "launch",
    "render",
    "input",
    "coreLoop",
    "outcome",
    "restart",
}
QA_TOP_LEVEL_FIELDS = {
    "schemaVersion",
    "status",
    "verify",
    "completeRun",
    "checks",
    "limitations",
}
QA_VERIFY_FIELDS = {"command", "exitCode", "suites"}
QA_COMPLETE_RUN_FIELDS = {
    "id",
    "cleanContext",
    "terminal",
    "restart",
    "evidence",
}
QA_LIMITATION_FIELDS = {"scope", "reason"}
QA_EVIDENCE_FIELDS = {
    "schemaVersion",
    "runId",
    "environment",
    "inputTrace",
    "observations",
}
QA_OBSERVATION_FIELDS = {"id", "inputs", "state", "visual"}
# The orchestrator owns the pipeline-wide language rule; every downstream skill has to
# restate it, because cross-skill links are rejected and skills must stay self-contained.
ORCHESTRATOR_SKILL = "novel-to-game"
OUTPUT_LANGUAGE_RULE = (
    "产物语言由 `PRODUCT_BRIEF.md` 锁定；未锁定时跟随对话语言，不默认产出中文。"
)
PLUGIN_MANIFESTS = {
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    "kimi.plugin.json",
}
EXAMPLE_PLANNING_FILES = {
    "analysis/SOURCE_BIBLE.md",
    "concepts/CONCEPT.md",
    "design/GAME_DESIGN.md",
    "design/ART_DIRECTION.md",
    "build/BUILD_BRIEF.md",
}
TARGET_FINISH_SOURCES = (
    "PRODUCT_BRIEF.md",
    "design/ART_DIRECTION.md",
    "build/BUILD_BRIEF.md",
)
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
FIELD_RE = re.compile(r"^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
LEVEL_TWO_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
TARGET_FINISH_RE = re.compile(r"^\s*`?targetFinish:\s*([a-z-]+)`?\s*$", re.MULTILINE)
CHINESE_DIGITS = {
    "〇": 0,
    "零": 0,
    "○": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}
ROMAN_VALUES = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}


def visible_directories(parent: Path) -> set[str]:
    """Directory names under `parent`, skipping dotted agent/tooling state dirs.

    `.omc/` and friends are gitignored but still present in a maintainer's working
    copy, so enumerating raw `iterdir()` made the documented verification command
    fail locally while CI (a clean checkout) stayed green.
    """
    return {
        path.name
        for path in parent.iterdir()
        if path.is_dir() and not path.name.startswith(".")
    }


def parse_frontmatter(text: str) -> dict[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        field = FIELD_RE.match(line)
        if field:
            values[field.group(1)] = field.group(2).strip().strip('"')
    return values


def leads_with_english(text: str) -> bool:
    # The description is what an agent routes an English request against, and what a
    # plugin directory shows as listing copy with no README_EN fallback.
    return text[:1].isascii() and text[:1].isalpha()


def parse_roman_number(value: str) -> int:
    total, previous = 0, 0
    for character in reversed(value.lower()):
        current = ROMAN_VALUES[character]
        total += current if current >= previous else -current
        previous = max(previous, current)
    return total


def parse_chinese_number(value: str) -> int:
    if all(character in CHINESE_DIGITS for character in value):
        return int("".join(str(CHINESE_DIGITS[character]) for character in value))

    total = 0
    current = 0
    for character in value:
        if character in CHINESE_DIGITS:
            current = CHINESE_DIGITS[character]
        elif character == "十":
            total += (current or 1) * 10
            current = 0
        elif character == "百":
            total += (current or 1) * 100
            current = 0
        else:
            raise ValueError(f"unsupported Chinese numeral: {value}")
    return total + current


def parse_numeral(value: str, kind: str) -> int:
    if kind == "arabic":
        return int(value)
    if kind == "roman":
        return parse_roman_number(value)
    if kind == "chinese":
        return parse_chinese_number(value)
    raise ValueError(f"unsupported numeral kind: {kind}")


def extract_chapter_numbers(
    sources: list[Path], heading: re.Pattern[str], numeral: str
) -> list[int]:
    chapters: list[int] = []
    for source in sources:
        for line in source.read_text(encoding="utf-8").splitlines():
            match = heading.match(line)
            if match:
                chapters.append(parse_numeral(match.group(1), numeral))
    return chapters


def markdown_section(text: str, heading: str) -> str | None:
    matches = list(LEVEL_TWO_HEADING_RE.finditer(text))
    for index, match in enumerate(matches):
        if match.group(1) != heading:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        return text[match.end() : end].strip()
    return None


def chapter_citation_coverage(text: str, pattern: re.Pattern[str]) -> set[int]:
    coverage: set[int] = set()
    for match in pattern.finditer(text):
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if first <= last:
            coverage.update(range(first, last + 1))
    return coverage


# Attention budgets keep new runtime guidance from silently accumulating.
SKILL_TOTAL_LINE_BUDGET = 1900
SKILL_MD_LINE_BUDGET = 100
REFERENCE_LINE_BUDGET = 150


def validate_skill_budget(skills_root: Path) -> list[str]:
    issues: list[str] = []
    total = 0
    for markdown in sorted(skills_root.rglob("*.md")):
        lines = len(markdown.read_text(encoding="utf-8").splitlines())
        total += lines
        relative = markdown.relative_to(skills_root)
        if markdown.name == "SKILL.md":
            if lines > SKILL_MD_LINE_BUDGET:
                issues.append(
                    f"skills/{relative}: {lines} lines exceeds the {SKILL_MD_LINE_BUDGET}-line "
                    "SKILL.md budget; move depth into references/ or cut a rule"
                )
        elif lines > REFERENCE_LINE_BUDGET:
            issues.append(
                f"skills/{relative}: {lines} lines exceeds the {REFERENCE_LINE_BUDGET}-line "
                "reference budget; split the file or cut a rule"
            )
    if total > SKILL_TOTAL_LINE_BUDGET:
        issues.append(
            f"skills: {total} lines exceeds the {SKILL_TOTAL_LINE_BUDGET}-line total budget "
            f"by {total - SKILL_TOTAL_LINE_BUDGET}; cut an equivalent amount, or raise "
            "SKILL_TOTAL_LINE_BUDGET in scripts/validate_repo.py and say why in the commit"
        )
    return issues


def validate_skill(skill_dir: Path) -> list[str]:
    issues: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return [f"{skill_dir.name}: missing SKILL.md"]

    text = skill_md.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(text)
    if frontmatter.get("name") != skill_dir.name:
        issues.append(f"{skill_dir.name}: frontmatter name does not match directory")
    description = frontmatter.get("description")
    if not description:
        issues.append(f"{skill_dir.name}: missing description")
    elif not leads_with_english(description):
        issues.append(f"{skill_dir.name}: description must lead with English")
    if skill_dir.name != ORCHESTRATOR_SKILL and OUTPUT_LANGUAGE_RULE not in text:
        issues.append(f"{skill_dir.name}: missing the output-language rule")

    metadata = skill_dir / "agents/openai.yaml"
    if not metadata.is_file():
        issues.append(f"{skill_dir.name}: missing agents/openai.yaml")
    elif f"${skill_dir.name}" not in metadata.read_text(encoding="utf-8"):
        issues.append(f"{skill_dir.name}: default prompt must name ${skill_dir.name}")

    for markdown in skill_dir.rglob("*.md"):
        body = markdown.read_text(encoding="utf-8")
        if "TODO" in body:
            issues.append(f"{markdown.relative_to(skill_dir)}: unresolved TODO")
        for raw_target in LINK_RE.findall(body):
            target = raw_target.split("#", 1)[0].strip()
            if not target or "://" in target or target.startswith(("#", "mailto:")):
                continue
            resolved = (markdown.parent / target).resolve()
            if not resolved.is_relative_to(skill_dir.resolve()):
                issues.append(
                    f"{markdown.relative_to(skill_dir)}: link leaves skill: {target}"
                )
            elif not resolved.exists():
                issues.append(
                    f"{markdown.relative_to(skill_dir)}: broken link: {target}"
                )
    return issues


def _read_json_object(path: Path, label: str) -> tuple[dict[str, object] | None, list[str]]:
    if not path.is_file():
        return None, [f"{label}: missing file"]
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return None, [f"{label}: invalid JSON: {error}"]
    if not isinstance(value, dict):
        return None, [f"{label}: must be an object"]
    return value, []


def _object(
    value: object,
    label: str,
    issues: list[str],
    *,
    exactly: set[str] | None = None,
    within: set[str] | None = None,
) -> dict[str, object] | None:
    """Require an object whose keys are exactly `exactly` or a subset of `within`."""
    if not isinstance(value, dict):
        issues.append(f"{label} must be an object")
        return None
    if exactly is not None and set(value) != exactly:
        issues.append(
            f"{label} must contain exactly {sorted(exactly)}; found {sorted(value)}"
        )
    if within is not None and set(value) - within:
        issues.append(f"{label} has unknown fields {sorted(set(value) - within)}")
    return value


def _blank(value: object) -> bool:
    return not isinstance(value, str) or not value.strip()


def _not_steps(value: object) -> bool:
    return not isinstance(value, list) or not value or any(_blank(item) for item in value)


def read_manifest(example_dir: Path) -> tuple[dict[str, object] | None, list[str]]:
    """读示例自述文件。返回 (manifest, issues)；manifest 为 None 表示不可用。"""
    label = f"{example_dir.name}/{EXAMPLE_MANIFEST}"
    manifest, issues = _read_json_object(example_dir / EXAMPLE_MANIFEST, label)
    if manifest is None:
        return None, issues
    missing = MANIFEST_REQUIRED - manifest.keys()
    if missing:
        issues.append(f"{label}: missing {sorted(missing)}")
    if manifest.get("targetFinish") not in TARGET_FINISHES:
        issues.append(f"{label}: targetFinish must be one of {sorted(TARGET_FINISHES)}")
    source = _object(manifest.get("source"), f"{label}: source", issues)
    if source is None:
        return None, issues
    source_missing = SOURCE_REQUIRED - source.keys()
    if source_missing:
        issues.append(f"{label}: source missing {sorted(source_missing)}")
    if source.get("numeral") not in NUMERAL_KINDS:
        issues.append(f"{label}: numeral must be one of {sorted(NUMERAL_KINDS)}")
    for owner, key in ((source, "headingPattern"), (manifest, "citationPattern")):
        pattern = owner.get(key)
        if isinstance(pattern, str):
            try:
                re.compile(pattern)
            except re.error as error:
                issues.append(f"{label}: {key}: {error}")
    return (None if issues else manifest), issues


def _workspace_file_issue(example_dir: Path, raw: object, field: str) -> str | None:
    if _blank(raw):
        return f"{field} must be a non-empty workspace path"
    resolved = (example_dir / str(raw)).resolve()
    if not resolved.is_relative_to(example_dir.resolve()):
        return f"{field} leaves the example workspace: {raw}"
    if not resolved.is_file():
        return f"{field} does not exist: {raw}"
    if resolved.stat().st_size == 0:
        return f"{field} must not be empty: {raw}"
    return None


def _contains_json_value(value: object, expected: object) -> bool:
    if value == expected:
        return True
    if isinstance(value, dict):
        return any(_contains_json_value(item, expected) for item in value.values())
    if isinstance(value, list):
        return any(_contains_json_value(item, expected) for item in value)
    return False


def _validate_complete_run_evidence(
    example_dir: Path, complete_run: dict[str, object]
) -> list[str]:
    label = f"{example_dir.name}/qa/verification.json"
    field = "completeRun.evidence"
    raw_path = complete_run.get("evidence")
    if raw_path is None:
        return [f"{label}: {field} is required"]
    issue = _workspace_file_issue(example_dir, raw_path, field)
    if issue:
        return [f"{label}: {issue}"]
    evidence, issues = _read_json_object(example_dir / str(raw_path), f"{label}: {field}")
    if evidence is None:
        return issues

    _object(evidence, f"{label}: {field}", issues, exactly=QA_EVIDENCE_FIELDS)
    if evidence.get("schemaVersion") != 1:
        issues.append(f"{label}: {field}.schemaVersion must be 1")
    if evidence.get("runId") != complete_run.get("id"):
        issues.append(f"{label}: {field}.runId must match completeRun.id")
    environment = _object(evidence.get("environment"), f"{label}: {field}.environment", issues)
    if environment is not None and not environment:
        issues.append(f"{label}: {field}.environment must be non-empty")
    if _not_steps(evidence.get("inputTrace")):
        issues.append(f"{label}: {field}.inputTrace must contain non-empty steps")

    observations = _object(
        evidence.get("observations"),
        f"{label}: {field}.observations",
        issues,
        exactly=MINIMAL_QA_CHECKS,
    )
    if observations is None:
        return issues
    for name in sorted(MINIMAL_QA_CHECKS):
        observation_field = f"{field}.observations.{name}"
        observation = _object(
            observations.get(name),
            f"{label}: {observation_field}",
            issues,
            within=QA_OBSERVATION_FIELDS,
        )
        if observation is None:
            continue
        if _blank(observation.get("id")):
            issues.append(f"{label}: {observation_field}.id must be non-empty")
        if _not_steps(observation.get("inputs")):
            issues.append(f"{label}: {observation_field}.inputs must contain steps")
        state = _object(observation.get("state"), f"{label}: {observation_field}.state", issues)
        if state is not None and not state:
            issues.append(f"{label}: {observation_field}.state must be non-empty")
        visual = observation.get("visual")
        if visual is None and name == "render":
            issues.append(f"{label}: {observation_field}.visual is required")
        elif visual is not None:
            visual_issue = _workspace_file_issue(
                example_dir, visual, f"{observation_field}.visual"
            )
            if visual_issue:
                issues.append(f"{label}: {visual_issue}")

    for name, key in (("outcome", "terminal"), ("restart", "restart")):
        expected = complete_run.get(key)
        observation = observations.get(name)
        state = observation.get("state") if isinstance(observation, dict) else None
        if isinstance(expected, str) and not _contains_json_value(state, expected):
            issues.append(f"{label}: {name} observation must record completeRun.{key}")
    return issues


def validate_qa(example_dir: Path) -> list[str]:
    """Validate the single minimal, player-effect QA contract."""
    label = f"{example_dir.name}/qa/verification.json"
    verification, issues = _read_json_object(example_dir / "qa/verification.json", label)
    if verification is None:
        return issues

    _object(verification, label, issues, within=QA_TOP_LEVEL_FIELDS)
    if verification.get("schemaVersion") != 3:
        issues.append(f"{label}: minimal QA requires schemaVersion 3")
        return issues

    status = verification.get("status")
    if status != "PASS":
        issues.append(f"{label}: status must PASS for the current QA record")

    verify = _object(verification.get("verify"), f"{label}: verify", issues, within=QA_VERIFY_FIELDS)
    if verify is not None:
        if _blank(verify.get("command")):
            issues.append(f"{label}: verify.command must be non-empty")
        if verify.get("exitCode") != 0:
            issues.append(f"{label}: verify.exitCode must be 0")

    complete_run = _object(
        verification.get("completeRun"),
        f"{label}: completeRun",
        issues,
        within=QA_COMPLETE_RUN_FIELDS,
    )
    if complete_run is not None:
        if complete_run.get("cleanContext") is not True:
            issues.append(f"{label}: completeRun.cleanContext must be true")
        for key in ("id", "terminal", "restart"):
            if _blank(complete_run.get(key)):
                issues.append(f"{label}: completeRun.{key} must be non-empty")
        issues.extend(_validate_complete_run_evidence(example_dir, complete_run))

    checks = _object(
        verification.get("checks"), f"{label}: checks", issues, exactly=MINIMAL_QA_CHECKS
    )
    if checks is not None:
        for name in sorted(MINIMAL_QA_CHECKS):
            if checks.get(name) != "PASS":
                issues.append(f"{label}: checks.{name} must PASS for overall PASS")

    limitations = verification.get("limitations")
    if not isinstance(limitations, list):
        issues.append(f"{label}: limitations must be a list")
    else:
        for index, raw_limitation in enumerate(limitations):
            field = f"limitations[{index}]"
            limitation = _object(
                raw_limitation, f"{label}: {field}", issues, exactly=QA_LIMITATION_FIELDS
            )
            for key in sorted(QA_LIMITATION_FIELDS):
                if limitation is not None and _blank(limitation.get(key)):
                    issues.append(f"{label}: {field}.{key} must be non-empty")
    return issues


def _validate_target_finish_inheritance(
    example_dir: Path, target_finish: str
) -> list[str]:
    issues: list[str] = []
    optional = "design/VISUAL_TARGETS.md"
    for relative in (*TARGET_FINISH_SOURCES, optional):
        path = example_dir / relative
        if not path.is_file():
            if relative != optional:
                issues.append(f"{example_dir.name}/{relative}: missing targetFinish source")
            continue
        values = set(TARGET_FINISH_RE.findall(path.read_text(encoding="utf-8")))
        if values != {target_finish}:
            issues.append(
                f"{example_dir.name}/{relative}: targetFinish must be exactly "
                f"{target_finish}, found {sorted(values)}"
            )
    return issues


def validate_readme_example_order(root: Path) -> list[str]:
    """Keep the bilingual README example listings structurally aligned."""
    readme_slugs: dict[str, list[str]] = {}
    for filename in ("README.md", "README_ZH.md"):
        path = root / filename
        if path.is_file():
            readme_slugs[filename] = list(
                dict.fromkeys(re.findall(r"examples/([^/)]+)/?", path.read_text(encoding="utf-8")))
            )
    if (
        "README.md" in readme_slugs
        and "README_ZH.md" in readme_slugs
        and readme_slugs["README.md"] != readme_slugs["README_ZH.md"]
    ):
        return [
            "README.md and README_ZH.md: example link order must match; "
            f"english={readme_slugs['README.md']} chinese={readme_slugs['README_ZH.md']}"
        ]
    return []


def validate_example(example_dir: Path) -> list[str]:
    manifest, issues = read_manifest(example_dir)
    if manifest is None:
        return issues
    issues.extend(
        _validate_target_finish_inheritance(example_dir, str(manifest["targetFinish"]))
    )
    issues.extend(validate_qa(example_dir))
    actual_planning_files = {
        path.relative_to(example_dir).as_posix()
        for directory in ("analysis", "concepts", "design", "build")
        if (example_dir / directory).is_dir()
        for path in (example_dir / directory).iterdir()
        if path.is_file()
    }
    missing_planning_files = EXAMPLE_PLANNING_FILES - actual_planning_files
    if missing_planning_files:
        issues.append(
            f"{example_dir.name}: missing planning artifacts "
            f"{sorted(missing_planning_files)}"
        )

    source_dir = example_dir / "source"
    if not (source_dir / "SOURCE.md").is_file():
        issues.append(f"{example_dir.name}: missing source/SOURCE.md")
    source_texts = sorted(source_dir.glob("*.txt")) if source_dir.is_dir() else []
    if not source_texts:
        issues.append(f"{example_dir.name}: missing source text")
        return issues

    source_spec = manifest["source"]
    expected_chapters = int(str(source_spec["chapters"]))
    heading = re.compile(str(source_spec["headingPattern"]))
    chapter_numbers = extract_chapter_numbers(
        source_texts, heading, str(source_spec["numeral"])
    )
    if chapter_numbers != list(range(1, expected_chapters + 1)):
        issues.append(
            f"{example_dir.name}: source must contain consecutive chapters "
            f"1-{expected_chapters}, found {len(chapter_numbers)}"
        )
        return issues

    known_chapters = set(chapter_numbers)
    citation = re.compile(str(manifest["citationPattern"]))
    source_bible = example_dir / "analysis/SOURCE_BIBLE.md"
    if source_bible.is_file():
        coverage_section = markdown_section(
            source_bible.read_text(encoding="utf-8"), str(manifest["coverageHeading"])
        )
        if coverage_section is None:
            issues.append(f"{example_dir.name}: source bible missing full-book coverage")
        else:
            coverage = chapter_citation_coverage(coverage_section, citation)
            missing = known_chapters - coverage
            extra = coverage - known_chapters
            if missing or extra:
                issues.append(
                    f"{example_dir.name}: source bible chapter coverage mismatch; "
                    f"missing={sorted(missing)} extra={sorted(extra)}"
                )

    # 引用格式随语言变。若 citationPattern 在整个示例的策划产物里一次都不匹配,
    # 下面的逐条校验就会「真空通过」——保证悄悄消失而不是变红。这里只要求全例
    # 至少命中一次(不要求每份文档都引章节:美术方向讲视觉，本来就不引)。
    citation_hits = 0
    for relative_path in sorted(EXAMPLE_PLANNING_FILES & actual_planning_files):
        body = (example_dir / relative_path).read_text(encoding="utf-8")
        for match in citation.finditer(body):
            citation_hits += 1
            first = int(match.group(1))
            last = int(match.group(2) or first)
            if first > last or any(
                chapter not in known_chapters for chapter in range(first, last + 1)
            ):
                issues.append(
                    f"{example_dir.name}: invalid chapter citation "
                    f"{match.group(0)} in {relative_path}"
                )
    if citation_hits == 0:
        issues.append(
            f"{example_dir.name}: citationPattern matches nothing in any planning "
            f"artifact; the chapter-citation check would pass vacuously"
        )
    return issues


def validate_agent_adapters(root: Path, version: str) -> list[str]:
    issues: list[str] = []

    agents_link = root / ".agents/skills"
    if not agents_link.is_symlink() or agents_link.readlink().as_posix() != "../skills":
        issues.append(
            "repository: .agents/skills must be a relative symlink to ../skills"
        )

    claude_skills = root / ".claude/skills"
    actual_claude_entries = (
        {path.name for path in claude_skills.iterdir()}
        if claude_skills.is_dir()
        else set()
    )
    if actual_claude_entries != EXPECTED_SKILLS:
        issues.append(
            "repository: Claude project skill set mismatch; "
            f"missing={sorted(EXPECTED_SKILLS - actual_claude_entries)} "
            f"extra={sorted(actual_claude_entries - EXPECTED_SKILLS)}"
        )
    for name in sorted(EXPECTED_SKILLS & actual_claude_entries):
        link = claude_skills / name
        expected_target = f"../../skills/{name}"
        if not link.is_symlink() or link.readlink().as_posix() != expected_target:
            issues.append(
                f"repository: .claude/skills/{name} must link to {expected_target}"
            )

    for relative_path in sorted(PLUGIN_MANIFESTS):
        manifest, manifest_issues = _read_json_object(root / relative_path, relative_path)
        issues.extend(manifest_issues)
        if manifest is None:
            continue
        if manifest.get("name") != "novel-to-game":
            issues.append(f"{relative_path}: plugin name must be novel-to-game")
        if manifest.get("version") != version:
            issues.append(f"{relative_path}: version does not match VERSION")
        if not leads_with_english(str(manifest.get("description", ""))):
            issues.append(f"{relative_path}: description must lead with English")
        if manifest.get("skills") not in {"./skills", "./skills/"}:
            issues.append(
                f"{relative_path}: plugin must expose the complete ./skills bundle"
            )

    marketplace_path = ".claude-plugin/marketplace.json"
    marketplace, marketplace_issues = _read_json_object(root / marketplace_path, marketplace_path)
    issues.extend(marketplace_issues)
    if marketplace is not None:
        plugins = marketplace.get("plugins")
        plugin = plugins[0] if isinstance(plugins, list) and len(plugins) == 1 else None
        if not isinstance(plugin, dict):
            issues.append(f"{marketplace_path}: must expose exactly one bundle plugin")
        else:
            expected = {"name": "novel-to-game", "source": "./", "version": version}
            if {key: plugin.get(key) for key in expected} != expected:
                issues.append(
                    f"{marketplace_path}: bundle name, source, or version is invalid"
                )
            if not leads_with_english(str(plugin.get("description", ""))):
                issues.append(f"{marketplace_path}: plugin description must lead with English")
        metadata = marketplace.get("metadata")
        if not isinstance(metadata, dict) or metadata.get("version") != version:
            issues.append(f"{marketplace_path}: metadata version does not match VERSION")
        elif not leads_with_english(str(metadata.get("description", ""))):
            issues.append(f"{marketplace_path}: metadata description must lead with English")
    return issues


def validate_repository(root: Path) -> list[str]:
    issues: list[str] = []
    for required in ("README.md", "README_ZH.md", "LICENSE", "AGENTS.md", "VERSION"):
        if not (root / required).is_file():
            issues.append(f"repository: missing {required}")

    skills_root = root / "skills"
    actual = visible_directories(skills_root)
    if actual != EXPECTED_SKILLS:
        issues.append(
            "repository: skill set mismatch; "
            f"missing={sorted(EXPECTED_SKILLS - actual)} extra={sorted(actual - EXPECTED_SKILLS)}"
        )
    for name in sorted(EXPECTED_SKILLS & actual):
        issues.extend(validate_skill(skills_root / name))
    issues.extend(validate_skill_budget(skills_root))

    examples_root = root / "examples"
    actual_examples = visible_directories(examples_root)
    if not actual_examples:
        issues.append("repository: no examples found")
    for name in sorted(actual_examples):
        issues.extend(validate_example(examples_root / name))
    issues.extend(validate_readme_example_order(root))

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    issues.extend(validate_agent_adapters(root, version))
    return issues


def main() -> int:
    issues = validate_repository(Path(__file__).resolve().parents[1])
    if issues:
        for issue in issues:
            print(f"FAIL: {issue}")
        print(f"Validation failed with {len(issues)} issue(s).")
        return 1
    print(f"Validation passed: {len(EXPECTED_SKILLS)} skills checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
