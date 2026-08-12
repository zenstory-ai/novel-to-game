#!/usr/bin/env python3
"""Dependency-free structural validation for the NovelToGame skill set."""

from __future__ import annotations

import argparse
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
MANIFEST_ALLOWED = MANIFEST_REQUIRED | {"title"}
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
    "speed",
    "steps",
}
QA_CHECK_FIELDS = {"status", "evidence"}
QA_LIMITATION_FIELDS = {"scope", "reason"}
MACHINE_QA_FIELDS = {"command", "exitCode", "completeRun", "checks"}
MACHINE_COMPLETE_RUN_FIELDS = {"terminal", "restart"}
GATE_STATUSES = {"NOT_RUN", "FAIL", "PASS"}
VISUAL_RUBRIC_FIELDS = {
    "focus",
    "silhouette",
    "depth",
    "materialLine",
    "lightColor",
    "hud",
    "motionFeedback",
    "artifacts",
    "failureExamples",
}
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
# Allowed but not required — legacy examples may predate coverage tracking, while
# richer examples may keep a build asset ledger beside the frozen build brief.
OPTIONAL_PLANNING_FILES = {
    "analysis/_coverage.md",
    "build/asset-ledger.json",
    "build/source-inputs.json",
    "design/VISUAL_TARGETS.md",
}
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
FIELD_RE = re.compile(r"^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
CHAPTER_HEADING_RE = re.compile(r"^\s*第([〇零○一二三四五六七八九十百]+)回\s+(.+?)\s*$")
CHAPTER_CITATION_RE = re.compile(r"第(\d{1,3})(?:\s*[-–—至]\s*(\d{1,3}))?回")
LEVEL_TWO_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
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
VALIDATION_IGNORED_DIRECTORIES = {
    "node_modules",
    "dist",
    "coverage",
    "__pycache__",
}


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


def validation_json_files(root: Path) -> list[Path]:
    """Return authored JSON while excluding local state and generated trees."""
    return sorted(
        path
        for path in root.rglob("*.json")
        if not any(
            part.startswith(".") or part in VALIDATION_IGNORED_DIRECTORIES
            for part in path.relative_to(root).parts[:-1]
        )
    )


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


ROMAN_VALUES = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}


def parse_roman_number(value: str) -> int:
    total, previous = 0, 0
    for character in reversed(value.lower()):
        current = ROMAN_VALUES[character]
        total += current if current >= previous else -current
        previous = max(previous, current)
    return total


def parse_numeral(value: str, kind: str) -> int:
    if kind == "arabic":
        return int(value)
    if kind == "roman":
        return parse_roman_number(value)
    return parse_chinese_number(value)


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


def extract_chapters(
    source: Path, pattern: re.Pattern[str] | None = None, numeral: str = "chinese"
) -> list[tuple[int, str, int]]:
    heading = pattern or CHAPTER_HEADING_RE
    chapters: list[tuple[int, str, int]] = []
    for line_number, line in enumerate(
        source.read_text(encoding="utf-8").splitlines(), start=1
    ):
        match = heading.match(line)
        if match:
            title = match.group(2) if match.lastindex and match.lastindex >= 2 else ""
            chapters.append((parse_numeral(match.group(1), numeral), title, line_number))
    return chapters


def markdown_section(text: str, heading: str) -> str | None:
    matches = list(LEVEL_TWO_HEADING_RE.finditer(text))
    for index, match in enumerate(matches):
        if match.group(1) != heading:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        return text[match.end() : end].strip()
    return None


def chapter_citation_coverage(
    text: str, pattern: re.Pattern[str] | None = None
) -> set[int]:
    coverage: set[int] = set()
    for match in (pattern or CHAPTER_CITATION_RE).finditer(text):
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if first <= last:
            coverage.update(range(first, last + 1))
    return coverage


# Skill weight budget.
#
# Prompt files only ever grow: adding a rule always reads as diligence and removing
# one always reads as risk, so nothing ever comes out and the model's attention gets
# spread thinner every iteration. A ceiling converts that silent ratchet into a
# deliberate choice — to add a rule you either cut one, or you raise the number here
# in a diff someone has to justify.
#
# These are attention budgets, not style limits. Raising them is allowed; raising
# them without saying why in the commit message is the thing to catch in review.
SKILL_TOTAL_LINE_BUDGET = 3100
SKILL_MD_LINE_BUDGET = 170
REFERENCE_LINE_BUDGET = 250


def markdown_line_count(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def validate_skill_budget(skills_root: Path) -> list[str]:
    issues: list[str] = []
    total = 0
    for markdown in sorted(skills_root.rglob("*.md")):
        lines = markdown_line_count(markdown)
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
    elif not description[:1].isascii() or not description[:1].isalpha():
        # The description is what an agent routes an English request against, and what a
        # plugin directory shows as listing copy with no README_EN fallback.
        issues.append(f"{skill_dir.name}: description must lead with English")
    if skill_dir.name != ORCHESTRATOR_SKILL and OUTPUT_LANGUAGE_RULE not in text:
        issues.append(f"{skill_dir.name}: missing the output-language rule")
    if "TODO" in text:
        issues.append(f"{skill_dir.name}: unresolved TODO")

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
            try:
                resolved.relative_to(skill_dir.resolve())
            except ValueError:
                issues.append(
                    f"{markdown.relative_to(skill_dir)}: link leaves skill: {target}"
                )
                continue
            if not resolved.exists():
                issues.append(
                    f"{markdown.relative_to(skill_dir)}: broken link: {target}"
                )
    return issues


def read_manifest(example_dir: Path) -> tuple[dict[str, object] | None, list[str]]:
    """读示例自述文件。返回 (manifest, issues)；manifest 为 None 表示不可用。"""
    path = example_dir / EXAMPLE_MANIFEST
    if not path.is_file():
        return None, [f"{example_dir.name}: missing {EXAMPLE_MANIFEST}"]
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return None, [f"{example_dir.name}/{EXAMPLE_MANIFEST}: invalid JSON: {error}"]
    if not isinstance(manifest, dict):
        return None, [f"{example_dir.name}/{EXAMPLE_MANIFEST}: must be an object"]

    issues: list[str] = []
    missing = MANIFEST_REQUIRED - manifest.keys()
    if missing:
        issues.append(
            f"{example_dir.name}/{EXAMPLE_MANIFEST}: missing {sorted(missing)}"
        )
    unknown = manifest.keys() - MANIFEST_ALLOWED
    if unknown:
        issues.append(
            f"{example_dir.name}/{EXAMPLE_MANIFEST}: unsupported fields {sorted(unknown)}"
        )
    if manifest.get("targetFinish") not in TARGET_FINISHES:
        issues.append(
            f"{example_dir.name}/{EXAMPLE_MANIFEST}: targetFinish must be one of "
            f"{sorted(TARGET_FINISHES)}"
        )
    source = manifest.get("source")
    if not isinstance(source, dict):
        issues.append(f"{example_dir.name}/{EXAMPLE_MANIFEST}: source must be an object")
    else:
        source_missing = SOURCE_REQUIRED - source.keys()
        if source_missing:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: source missing {sorted(source_missing)}"
            )
        if source.get("numeral") not in NUMERAL_KINDS:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: numeral must be one of {sorted(NUMERAL_KINDS)}"
            )
    for key in ("headingPattern",):
        raw = (source or {}).get(key) if isinstance(source, dict) else None
        if isinstance(raw, str):
            try:
                re.compile(raw)
            except re.error as error:
                issues.append(f"{example_dir.name}/{EXAMPLE_MANIFEST}: {key}: {error}")
    raw_citation = manifest.get("citationPattern")
    if isinstance(raw_citation, str):
        try:
            re.compile(raw_citation)
        except re.error as error:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: citationPattern: {error}"
            )
    return (None if issues else manifest), issues


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


def _compact_evidence_issue(
    example_dir: Path, raw: object, field: str
) -> str | None:
    label = f"{example_dir.name}/qa/verification.json"
    if not isinstance(raw, str) or not raw.strip():
        return f"{label}: {field} must be a non-empty workspace path"
    candidate = Path(raw)
    if candidate.is_absolute() or "://" in raw:
        return f"{label}: {field} must be workspace-local: {raw}"
    resolved = (example_dir / candidate).resolve()
    try:
        resolved.relative_to(example_dir.resolve())
    except ValueError:
        return f"{label}: {field} leaves the example workspace: {raw}"
    if not resolved.is_file():
        return f"{label}: {field} does not exist: {raw}"
    return None


def validate_qa(example_dir: Path) -> list[str]:
    """Validate the single minimal, player-effect QA contract."""
    label = f"{example_dir.name}/qa/verification.json"
    issues: list[str] = []

    verification_path = example_dir / "qa/verification.json"
    verification, verification_issues = _read_json_object(verification_path, label)
    issues.extend(verification_issues)
    if verification is None:
        return issues

    unknown = set(verification) - QA_TOP_LEVEL_FIELDS
    if unknown:
        issues.append(f"{label}: unknown fields {sorted(unknown)}")

    schema_version = verification.get("schemaVersion")
    if schema_version != 2:
        issues.append(f"{label}: minimal QA requires schemaVersion 2")
        return issues

    status = verification.get("status")
    if status not in GATE_STATUSES:
        issues.append(f"{label}: status must be one of {sorted(GATE_STATUSES)}")
    elif status != "PASS":
        issues.append(f"{label}: status must PASS for the current QA record")

    verify = verification.get("verify")
    if not isinstance(verify, dict):
        issues.append(f"{label}: verify must be an object")
    else:
        unknown = set(verify) - QA_VERIFY_FIELDS
        if unknown:
            issues.append(f"{label}: verify has unknown fields {sorted(unknown)}")
        if not isinstance(verify.get("command"), str) or not verify["command"].strip():
            issues.append(f"{label}: verify.command must be non-empty")
        exit_code = verify.get("exitCode")
        if type(exit_code) is not int or exit_code != 0:
            issues.append(f"{label}: verify.exitCode must be integer 0")

    complete_run = verification.get("completeRun")
    run_evidence: object = None
    if not isinstance(complete_run, dict):
        issues.append(f"{label}: completeRun must be an object")
    else:
        unknown = set(complete_run) - QA_COMPLETE_RUN_FIELDS
        if unknown:
            issues.append(
                f"{label}: completeRun has unknown fields {sorted(unknown)}"
            )
        if complete_run.get("cleanContext") is not True:
            issues.append(f"{label}: completeRun.cleanContext must be true")
        for field in ("id", "terminal", "restart"):
            if not isinstance(complete_run.get(field), str) or not complete_run[field].strip():
                issues.append(f"{label}: completeRun.{field} must be non-empty")
        run_evidence = complete_run.get("evidence")
        if run_evidence is None:
            issues.append(f"{label}: completeRun.evidence is required")
        else:
            issue = _compact_evidence_issue(
                example_dir, run_evidence, "completeRun.evidence"
            )
            if issue:
                issues.append(issue)

    checks = verification.get("checks")
    if not isinstance(checks, dict):
        issues.append(f"{label}: checks must be an object")
        checks = {}
    required = set(MINIMAL_QA_CHECKS)
    if set(checks) != required:
        issues.append(
            f"{label}: checks must contain exactly {sorted(required)}; "
            f"found {sorted(checks)}"
        )
    for name in sorted(required):
        check = checks.get(name)
        if not isinstance(check, dict):
            issues.append(f"{label}: checks.{name} must be an object")
            continue
        unknown = set(check) - QA_CHECK_FIELDS
        if unknown:
            issues.append(
                f"{label}: checks.{name} has unknown fields {sorted(unknown)}"
            )
        check_status = check.get("status")
        if check_status not in GATE_STATUSES:
            issues.append(
                f"{label}: checks.{name}.status must be one of {sorted(GATE_STATUSES)}"
            )
        if status == "PASS" and check_status != "PASS":
            issues.append(f"{label}: checks.{name} must PASS for overall PASS")
        evidence = check.get("evidence")
        if check_status == "PASS" and (
            not isinstance(evidence, list) or not evidence
        ):
            issues.append(f"{label}: checks.{name}.evidence must not be empty")
        elif isinstance(evidence, list):
            for index, raw in enumerate(evidence):
                issue = _compact_evidence_issue(
                    example_dir, raw, f"checks.{name}.evidence[{index}]"
                )
                if issue:
                    issues.append(issue)

    limitations = verification.get("limitations")
    if not isinstance(limitations, list):
        issues.append(f"{label}: limitations must be a list")
    else:
        for index, limitation in enumerate(limitations):
            field = f"limitations[{index}]"
            if not isinstance(limitation, dict):
                issues.append(f"{label}: {field} must be an object")
                continue
            unknown = set(limitation) - QA_LIMITATION_FIELDS
            if unknown:
                issues.append(
                    f"{label}: {field} has unknown fields {sorted(unknown)}"
                )
            for key in ("scope", "reason"):
                if not isinstance(limitation.get(key), str) or not limitation[key].strip():
                    issues.append(f"{label}: {field}.{key} must be non-empty")

    if isinstance(run_evidence, str) and not _compact_evidence_issue(
        example_dir, run_evidence, "completeRun.evidence"
    ):
        for name in sorted(required):
            check = checks.get(name)
            if isinstance(check, dict) and check.get("evidence") != [run_evidence]:
                issues.append(
                    f"{label}: checks.{name}.evidence must equal "
                    "[completeRun.evidence]"
                )

        evidence_path = example_dir / run_evidence
        try:
            machine_evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            issues.append(
                f"{label}: machine evidence must be valid JSON: {run_evidence}"
            )
            machine_evidence = None
        if not isinstance(machine_evidence, dict):
            if machine_evidence is not None:
                issues.append(f"{label}: machine evidence must be an object")
        else:
            machine_qa = machine_evidence.get("qa")
            if not isinstance(machine_qa, dict):
                issues.append(f"{label}: machine evidence.qa must be an object")
            else:
                unknown = set(machine_qa) - MACHINE_QA_FIELDS
                if unknown:
                    issues.append(
                        f"{label}: machine evidence.qa has unknown fields "
                        f"{sorted(unknown)}"
                    )
                if isinstance(verify, dict):
                    if machine_qa.get("command") != verify.get("command"):
                        issues.append(
                            f"{label}: machine evidence qa.command must match verify.command"
                        )
                    machine_exit_code = machine_qa.get("exitCode")
                    if type(machine_exit_code) is not int:
                        issues.append(
                            f"{label}: machine evidence qa.exitCode must be an integer"
                        )
                    elif machine_exit_code != verify.get("exitCode"):
                        issues.append(
                            f"{label}: machine evidence qa.exitCode must match verify.exitCode"
                        )
                machine_run = machine_qa.get("completeRun")
                if not isinstance(machine_run, dict):
                    issues.append(
                        f"{label}: machine evidence.qa.completeRun must be an object"
                    )
                else:
                    unknown = set(machine_run) - MACHINE_COMPLETE_RUN_FIELDS
                    if unknown:
                        issues.append(
                            f"{label}: machine evidence.qa.completeRun has unknown fields "
                            f"{sorted(unknown)}"
                        )
                    if isinstance(complete_run, dict):
                        for field in ("terminal", "restart"):
                            if machine_run.get(field) != complete_run.get(field):
                                issues.append(
                                    f"{label}: machine evidence qa.completeRun.{field} "
                                    f"must match completeRun.{field}"
                                )
                machine_checks = machine_qa.get("checks")
                if not isinstance(machine_checks, dict):
                    issues.append(
                        f"{label}: machine evidence.qa.checks must be an object"
                    )
                elif set(machine_checks) != required:
                    issues.append(
                        f"{label}: machine evidence qa.checks must contain exactly "
                        f"{sorted(required)}"
                    )
                else:
                    for name in sorted(required):
                        if machine_checks.get(name) != "PASS":
                            issues.append(
                                f"{label}: machine evidence qa.checks.{name} must PASS"
                            )

    return issues


def _validate_target_finish_inheritance(
    example_dir: Path, target_finish: object
) -> list[str]:
    issues: list[str] = []
    for relative in (
        "PRODUCT_BRIEF.md",
        "design/ART_DIRECTION.md",
        "build/BUILD_BRIEF.md",
    ):
        path = example_dir / relative
        if not path.is_file():
            issues.append(f"{example_dir.name}/{relative}: missing targetFinish source")
            continue
        values = re.findall(
            r"^\s*`?targetFinish:\s*([a-z-]+)`?\s*$",
            path.read_text(encoding="utf-8"),
            flags=re.MULTILINE,
        )
        unique = set(values)
        if not values:
            issues.append(f"{example_dir.name}/{relative}: missing canonical targetFinish")
        elif len(unique) != 1:
            issues.append(
                f"{example_dir.name}/{relative}: conflicting targetFinish values {sorted(unique)}"
            )
        elif next(iter(unique)) != target_finish:
            issues.append(
                f"{example_dir.name}/{relative}: targetFinish must match example.json"
            )
    visual_targets = example_dir / "design/VISUAL_TARGETS.md"
    if visual_targets.is_file():
        relative = "design/VISUAL_TARGETS.md"
        values = re.findall(
            r"^\s*`?targetFinish:\s*([a-z-]+)`?\s*$",
            visual_targets.read_text(encoding="utf-8"),
            flags=re.MULTILINE,
        )
        unique = set(values)
        if not values:
            issues.append(
                f"{example_dir.name}/{relative}: missing canonical targetFinish"
            )
        elif len(unique) != 1:
            issues.append(
                f"{example_dir.name}/{relative}: conflicting targetFinish values "
                f"{sorted(unique)}"
            )
        elif next(iter(unique)) != target_finish:
            issues.append(
                f"{example_dir.name}/{relative}: targetFinish must match example.json"
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
    target_finish = str(manifest["targetFinish"])
    issues.extend(_validate_target_finish_inheritance(example_dir, target_finish))
    issues.extend(validate_qa(example_dir))
    actual_planning_files = {
        path.relative_to(example_dir).as_posix()
        for directory in ("analysis", "concepts", "design", "build")
        if (example_dir / directory).is_dir()
        for path in (example_dir / directory).iterdir()
        if path.is_file()
    }
    # Coverage state and an asset ledger are valid supporting artifacts, but neither is
    # universal across the legacy examples. Ignore them when grading the five compact
    # planning handoffs instead of rejecting a richer, otherwise compliant example.
    graded_planning_files = actual_planning_files - OPTIONAL_PLANNING_FILES
    if graded_planning_files != EXAMPLE_PLANNING_FILES:
        issues.append(
            f"{example_dir.name}: planning artifact mismatch; "
            f"missing={sorted(EXAMPLE_PLANNING_FILES - graded_planning_files)} "
            f"extra={sorted(graded_planning_files - EXAMPLE_PLANNING_FILES)}"
        )

    source_dir = example_dir / "source"
    if not (source_dir / "SOURCE.md").is_file():
        issues.append(f"{example_dir.name}: missing source/SOURCE.md")
    source_texts = sorted(source_dir.glob("*.txt")) if source_dir.is_dir() else []
    if len(source_texts) != 1:
        issues.append(f"{example_dir.name}: expected exactly one source text")
        return issues

    source_spec = manifest["source"]
    expected_chapters = int(source_spec["chapters"])
    heading = re.compile(str(source_spec["headingPattern"]))
    numeral = str(source_spec["numeral"])
    chapters = extract_chapters(source_texts[0], heading, numeral)
    chapter_numbers = [chapter[0] for chapter in chapters]
    if chapter_numbers != list(range(1, expected_chapters + 1)):
        issues.append(
            f"{example_dir.name}: source must contain consecutive chapters "
            f"1-{expected_chapters}, found {len(chapter_numbers)}"
        )
        return issues

    known_chapters = set(chapter_numbers)
    source_bible = example_dir / "analysis/SOURCE_BIBLE.md"
    if source_bible.is_file():
        coverage_section = markdown_section(
            source_bible.read_text(encoding="utf-8"), str(manifest["coverageHeading"])
        )
        if coverage_section is None:
            issues.append(f"{example_dir.name}: source bible missing full-book coverage")
        else:
            citation = re.compile(str(manifest["citationPattern"]))
            coverage = chapter_citation_coverage(coverage_section, citation)
            missing = known_chapters - coverage
            extra = coverage - known_chapters
            if missing or extra:
                issues.append(
                    f"{example_dir.name}: source bible chapter coverage mismatch; "
                    f"missing={sorted(missing)} extra={sorted(extra)}"
                )

    citation = re.compile(str(manifest["citationPattern"]))
    # 引用格式随语言变。若 citationPattern 在整个示例的策划产物里一次都不匹配,
    # 下面的逐条校验就会「真空通过」——保证悄悄消失而不是变红。这里只要求全例
    # 至少命中一次(不要求每份文档都引章节:美术方向讲视觉，本来就不引)。
    citation_hits = 0
    for relative_path in sorted(EXAMPLE_PLANNING_FILES & actual_planning_files):
        markdown = example_dir / relative_path
        body = markdown.read_text(encoding="utf-8")
        citation_hits += len(citation.findall(body))
        for match in citation.finditer(body):
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


def manifest_skill_root(manifest: dict[str, object]) -> str | None:
    skills = manifest.get("skills")
    if isinstance(skills, str):
        return skills.rstrip("/")
    if isinstance(skills, list) and len(skills) == 1 and isinstance(skills[0], str):
        return skills[0].rstrip("/")
    return None


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
        path = root / relative_path
        if not path.is_file():
            issues.append(f"repository: missing {relative_path}")
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if manifest.get("name") != "novel-to-game":
            issues.append(f"{relative_path}: plugin name must be novel-to-game")
        if manifest.get("version") != version:
            issues.append(f"{relative_path}: version does not match VERSION")
        if manifest_skill_root(manifest) != "./skills":
            issues.append(
                f"{relative_path}: plugin must expose the complete ./skills bundle"
            )

    marketplace_path = root / ".claude-plugin/marketplace.json"
    if not marketplace_path.is_file():
        issues.append("repository: missing .claude-plugin/marketplace.json")
    else:
        marketplace = json.loads(marketplace_path.read_text(encoding="utf-8"))
        plugins = marketplace.get("plugins")
        if not isinstance(plugins, list) or len(plugins) != 1:
            issues.append(
                "repository: marketplace must expose exactly one bundle plugin"
            )
        else:
            plugin = plugins[0]
            if not isinstance(plugin, dict):
                issues.append("repository: marketplace plugin entry must be an object")
            else:
                expected = {
                    "name": "novel-to-game",
                    "source": "./",
                    "version": version,
                }
                if any(plugin.get(key) != value for key, value in expected.items()):
                    issues.append(
                        "repository: marketplace bundle name, source, or version is invalid"
                    )
        metadata = marketplace.get("metadata")
        if not isinstance(metadata, dict) or metadata.get("version") != version:
            issues.append(
                "repository: marketplace metadata version does not match VERSION"
            )

    if (root / "reasonix-plugin.json").exists():
        issues.append("repository: Reasonix adapter is outside the supported CLI set")
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
        example_dir = examples_root / name
        issues.extend(validate_example(example_dir))
    issues.extend(validate_readme_example_order(root))

    for json_file in validation_json_files(root):
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            issues.append(f"{json_file.relative_to(root)}: invalid JSON: {error}")

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    issues.extend(validate_agent_adapters(root, version))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    issues = validate_repository(root)
    if issues:
        for issue in issues:
            print(f"FAIL: {issue}")
        print(f"Validation failed with {len(issues)} issue(s).")
        return 1
    print(f"Validation passed: {len(EXPECTED_SKILLS)} skills checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
