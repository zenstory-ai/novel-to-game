#!/usr/bin/env python3
"""Dependency-free structural validation for the NovelToGame skill set."""

from __future__ import annotations

import argparse
import json
import hashlib
import math
import os
import re
import subprocess
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
REPO_ROOT = Path(__file__).resolve().parents[1]
VERIFICATION_CANDIDATE_ENV = "NOVEL_TO_GAME_VERIFICATION_CANDIDATE"
EXAMPLE_MANIFEST = "example.json"
# 示例的原著结构因语言而异（回目写法、章数、覆盖节标题、引用格式），
# 不能写死在校验器里，否则仓库结构上只容得下中文章回体原著。
# 每个示例用 example.json 自述这些取值，校验器只校验「自述得对不对」。
MANIFEST_REQUIRED = {
    "language",
    "source",
    "coverageHeading",
    "citationPattern",
    "publicationTier",
}
SOURCE_REQUIRED = {"chapters", "headingPattern", "numeral"}
NUMERAL_KINDS = {"chinese", "arabic", "roman"}
PUBLICATION_TIERS = {
    "graybox",
    "playable-prototype",
    "polished-vertical-slice",
    "showcase",
}
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
# These markers protect the small handoff contract between game-build and game-qa.
# The repository validator checks only its own skill prose; it does not impose a
# framework, schema package, or runtime dependency on generated projects.
MINIMAL_EVIDENCE_REQUIREMENTS = {
    "skills/game-art-direction/SKILL.md": (
        "语音策略",
        "采用门禁",
        "静音 / 缺音降级",
        "音色权利",
    ),
    "skills/game-art-direction/references/art-direction-method.md": (
        "硬否决",
        "增量价值",
        "触发窗口",
        "最小覆盖原则",
        "角色级选角",
        "宣传资产不自动变成游戏内资产",
    ),
    "skills/game-build/references/build-brief-contract.md": (
        "targetRuntime:",
        "testedRuntime:",
        "runtimeVersion:",
        "verify:",
        "completeRun: qa/verification.json#completeRun",
        "evidenceIndex: qa/verification.json#checkpoints",
        "语音资产台账",
        "request_sha256",
    ),
    "skills/game-build/SKILL.md": (
        "权威验证命令",
        "verify.log",
        "executed: true",
        "clean start",
        "tts-production-contract.md",
        "服务端",
    ),
    "skills/game-build/references/tts-production-contract.md": (
        "采用决策交接",
        "决定=采用",
        "构建期优先",
        "最小发送",
        "Retry-After",
        "请求指纹",
        "NOT_RUN: 原因",
        "人工试听",
        "不得只按语言选一个",
    ),
    "skills/game-qa/SKILL.md": (
        "ORPHANED_TEST_SUITE",
        "qa/verification.json",
        "discovered from",
        "clean start",
        "语音与 TTS",
    ),
    "skills/game-qa/references/qa-contract.md": (
        "目标运行环境",
        "suite | discovered from | files | runner | observed in verify | result",
        "NOT_RUN: reason",
        "同一个 complete-run step",
        "同一个 source commit",
        "API 密钥",
        "人工试听",
        "说话人与选角",
        "损坏文件",
        "采用范围",
        "scope drift",
    ),
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
    "design/VOICE_AUDITION.json",
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
    if manifest.get("publicationTier") not in PUBLICATION_TIERS:
        issues.append(
            f"{example_dir.name}/{EXAMPLE_MANIFEST}: publicationTier must be one of "
            f"{sorted(PUBLICATION_TIERS)}"
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


def _workspace_evidence_issue(
    example_dir: Path, raw: object, field: str
) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return f"{example_dir.name}/qa/release-gates.json: {field} must be a non-empty path"
    candidate = Path(raw)
    if candidate.is_absolute() or "://" in raw:
        return f"{example_dir.name}/qa/release-gates.json: {field} must be workspace-local: {raw}"
    resolved = (example_dir / candidate).resolve()
    try:
        resolved.relative_to(example_dir.resolve())
    except ValueError:
        return f"{example_dir.name}/qa/release-gates.json: {field} leaves the example workspace: {raw}"
    if not resolved.is_file():
        return f"{example_dir.name}/qa/release-gates.json: {field} does not exist: {raw}"
    return None


def _validate_evidence_list(
    example_dir: Path,
    value: object,
    field: str,
    *,
    required: bool,
) -> list[str]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    if not isinstance(value, list):
        return [f"{prefix}: {field} must be an array"]
    if required and not value:
        return [f"{prefix}: {field} must not be empty"]
    issues: list[str] = []
    for index, raw in enumerate(value):
        issue = _workspace_evidence_issue(example_dir, raw, f"{field}[{index}]")
        if issue:
            issues.append(issue)
    return issues


def _progress_gate_statuses(path: Path) -> dict[str, set[str]]:
    statuses: dict[str, set[str]] = {}
    if not path.is_file():
        return statuses
    pattern = re.compile(
        r"^\s*(?:[-*]\s*)?`?gate:(intake|analyze|concept|design|art|build|qa)"
        r"\s+(NOT_RUN|FAIL|PASS)(?=`|\s|\(|\[|—|–|-|$)",
        re.IGNORECASE | re.MULTILINE,
    )
    for gate, status in pattern.findall(path.read_text(encoding="utf-8")):
        statuses.setdefault(gate.lower(), set()).add(status.upper())
    return statuses


def _validate_target_finish_inheritance(
    example_dir: Path, target_finish: object, demonstrated_tier: object
) -> list[str]:
    issues: list[str] = []
    for relative in (
        "PRODUCT_BRIEF.md",
        "design/ART_DIRECTION.md",
        "build/BUILD_BRIEF.md",
        "qa/QA_REPORT.md",
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
                f"{example_dir.name}/{relative}: targetFinish must match qa/release-gates.json"
            )
    visual_targets = example_dir / "design/VISUAL_TARGETS.md"
    if visual_targets.is_file() or demonstrated_tier != "graybox":
        relative = "design/VISUAL_TARGETS.md"
        if not visual_targets.is_file():
            issues.append(
                f"{example_dir.name}/{relative}: required above demonstrated graybox"
            )
        else:
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
                    f"{example_dir.name}/{relative}: targetFinish must match "
                    "qa/release-gates.json"
                )
    return issues


def _validate_build_release_states(
    example_dir: Path,
    publication_tier: object,
    demonstrated_tier: object,
    graybox_status: object,
    promotion_status: object,
) -> list[str]:
    path = example_dir / "build/BUILD_BRIEF.md"
    if not path.is_file():
        return [f"{example_dir.name}/build/BUILD_BRIEF.md: missing release states"]
    text = path.read_text(encoding="utf-8")
    expected = {
        "publicationTier": publication_tier,
        "demonstratedTier": demonstrated_tier,
        "grayboxReady": graybox_status,
        "visualPromotion": promotion_status,
    }
    issues: list[str] = []
    for field, expected_value in expected.items():
        values = re.findall(
            rf"^\s*`?{field}:\s*([A-Za-z_-]+)`?\s*$", text, flags=re.MULTILINE
        )
        unique = set(values)
        label = f"{example_dir.name}/build/BUILD_BRIEF.md"
        if not values:
            issues.append(f"{label}: missing canonical {field}")
        elif len(unique) != 1:
            issues.append(f"{label}: conflicting {field} values {sorted(unique)}")
        elif next(iter(unique)) != expected_value:
            issues.append(f"{label}: {field} must match qa/release-gates.json")
    return issues


def _git_commit_app_fingerprint(example_dir: Path, commit: str) -> str | None:
    """Reproduce the app fingerprint from committed bytes when Git can expose them."""
    root_result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=example_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if root_result.returncode != 0:
        return None
    root = Path(root_result.stdout.strip()).resolve()
    app = (example_dir / "build/app").resolve()
    try:
        app_relative = app.relative_to(root).as_posix()
    except ValueError:
        return None
    tree_result = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", commit, "--", app_relative],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if tree_result.returncode != 0:
        return None
    selected_by_relative: dict[str, str] = {}
    for repository_path in tree_result.stdout.splitlines():
        relative = Path(repository_path).relative_to(app_relative).as_posix()
        if relative in {"index.html", "package.json", "package-lock.json"} or relative.startswith(
            ("public/", "src/")
        ):
            selected_by_relative[relative] = repository_path
    if not selected_by_relative:
        return None
    ordered_relative = [
        relative
        for relative in ("index.html", "package.json", "package-lock.json")
        if relative in selected_by_relative
    ]
    ordered_relative += sorted(
        relative
        for relative in selected_by_relative
        if relative.startswith(("public/", "src/"))
    )
    digest = hashlib.sha256()
    for relative in ordered_relative:
        repository_path = selected_by_relative[relative]
        blob = subprocess.run(
            ["git", "show", f"{commit}:{repository_path}"],
            cwd=root,
            capture_output=True,
            check=False,
        )
        if blob.returncode != 0:
            return None
        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update(blob.stdout)
        digest.update(b"\0")
    return digest.hexdigest()


def _workspace_app_fingerprint(example_dir: Path) -> str | None:
    """Reproduce a web app's publishable-input fingerprint from workspace bytes."""
    app = example_dir / "build/app"
    if not app.is_dir():
        return None
    paths = [app / "index.html", app / "package.json", app / "package-lock.json"]
    paths += sorted((app / "public").rglob("*")) + sorted((app / "src").rglob("*"))
    digest = hashlib.sha256()
    found = False
    for path in paths:
        if not path.is_file():
            continue
        found = True
        digest.update(path.relative_to(app).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest() if found else None


def _validate_verification(
    example_dir: Path,
    verification: dict[str, object],
    source_fingerprint: object,
) -> list[str]:
    """Fail closed on incomplete or stale non-graybox authoritative verification."""
    label = f"{example_dir.name}/qa/verification.json"
    issues: list[str] = []
    verify = verification.get("verify")
    if not isinstance(verify, dict):
        return [f"{label}: verify must be an object"]
    if not isinstance(verify.get("command"), str) or not verify["command"].strip():
        issues.append(f"{label}: verify.command must be a non-empty string")
    log_issue = _workspace_evidence_issue(example_dir, verify.get("log"), "verify.log")
    if log_issue:
        issues.append(log_issue.replace("qa/release-gates.json", "qa/verification.json"))
    expected_log_hash = verify.get("logSha256")
    if not isinstance(expected_log_hash, str) or not re.fullmatch(
        r"[0-9a-f]{64}", expected_log_hash
    ):
        issues.append(f"{label}: verify.logSha256 must be a lowercase sha256")
    elif not log_issue:
        log_path = example_dir / str(verify["log"])
        if hashlib.sha256(log_path.read_bytes()).hexdigest() != expected_log_hash:
            issues.append(f"{label}: verify.logSha256 does not match verify.log")
    if verify.get("exitCode") != 0:
        issues.append(f"{label}: verify.exitCode must be 0")
    duration = verify.get("durationMs")
    if (
        not isinstance(duration, (int, float))
        or isinstance(duration, bool)
        or not math.isfinite(duration)
        or duration < 0
    ):
        issues.append(f"{label}: verify.durationMs must be a non-negative number")

    suites = verify.get("suites")
    if not isinstance(suites, list) or not suites:
        issues.append(f"{label}: verify.suites must be a non-empty array")
        suites = []
    suite_ids: set[str] = set()
    covered_locations: set[str] = set()
    for index, suite in enumerate(suites):
        field = f"verify.suites[{index}]"
        if not isinstance(suite, dict):
            issues.append(f"{label}: {field} must be an object")
            continue
        suite_id = suite.get("id")
        if not isinstance(suite_id, str) or not suite_id.strip():
            issues.append(f"{label}: {field}.id must be a non-empty string")
        elif suite_id in suite_ids:
            issues.append(f"{label}: {field}.id duplicates {suite_id}")
        else:
            suite_ids.add(suite_id)
        if suite.get("executed") is not True:
            issues.append(f"{label}: {field}.executed must be true")
        if suite.get("passed") is not True:
            issues.append(f"{label}: {field}.passed must be true")
        locations = suite.get("locations")
        if not isinstance(locations, list) or any(
            not isinstance(location, str) or not location.strip()
            for location in locations
        ):
            issues.append(f"{label}: {field}.locations must be an array of paths")
        elif suite.get("executed") is True and suite.get("passed") is True:
            covered_locations.update(locations)
        commands = suite.get("commands")
        if not isinstance(commands, list) or not commands:
            issues.append(f"{label}: {field}.commands must be a non-empty array")
            continue
        for command_index, command in enumerate(commands):
            command_field = f"{field}.commands[{command_index}]"
            if not isinstance(command, dict):
                issues.append(f"{label}: {command_field} must be an object")
                continue
            if not isinstance(command.get("command"), str) or not command["command"].strip():
                issues.append(f"{label}: {command_field}.command must be a non-empty string")
            if command.get("exitCode") != 0:
                issues.append(f"{label}: {command_field}.exitCode must be 0")
            command_duration = command.get("durationMs")
            if (
                not isinstance(command_duration, (int, float))
                or isinstance(command_duration, bool)
                or not math.isfinite(command_duration)
                or command_duration < 0
            ):
                issues.append(
                    f"{label}: {command_field}.durationMs must be a non-negative number"
                )

    registry = verify.get("registry")
    if not isinstance(registry, dict):
        issues.append(f"{label}: verify.registry must be an object")
    else:
        registry_sets: dict[str, set[str]] = {}
        for field in ("discovered", "registered"):
            value = registry.get(field)
            if not isinstance(value, list) or not value or any(
                not isinstance(item, str) or not item.strip() for item in value
            ):
                issues.append(
                    f"{label}: verify.registry.{field} must be a non-empty array of paths"
                )
                registry_sets[field] = set()
            elif len(value) != len(set(value)):
                issues.append(f"{label}: verify.registry.{field} must not contain duplicates")
                registry_sets[field] = set(value)
            else:
                registry_sets[field] = set(value)
        excluded = registry.get("excluded")
        if not isinstance(excluded, dict):
            issues.append(f"{label}: verify.registry.excluded must be an object")
            excluded_paths: set[str] = set()
        else:
            excluded_paths = set()
            for path, reason in excluded.items():
                if not isinstance(path, str) or not path.strip():
                    issues.append(f"{label}: verify.registry.excluded keys must be paths")
                else:
                    excluded_paths.add(path)
                if not isinstance(reason, str) or not reason.strip():
                    issues.append(
                        f"{label}: verify.registry.excluded[{path!r}] must have a non-empty reason"
                    )
        problems = registry.get("problems")
        if not isinstance(problems, list):
            issues.append(f"{label}: verify.registry.problems must be an array")
        elif problems:
            issues.append(f"{label}: verify.registry.problems must be empty")
        discovered = registry_sets.get("discovered", set())
        registered = registry_sets.get("registered", set())
        if discovered != registered | excluded_paths:
            issues.append(
                f"{label}: verify.registry.discovered must equal registered plus excluded"
            )
        uncovered = registered - covered_locations
        if uncovered:
            issues.append(
                f"{label}: verify.registry.registered paths lack executed/passed suite coverage: "
                f"{sorted(uncovered)}"
            )
        test_dir = example_dir / "build/app/test"
        if test_dir.is_dir():
            actual = {
                path.relative_to(example_dir / "build/app").as_posix()
                for path in test_dir.iterdir()
                if path.is_file() and path.suffix in {".py", ".js"}
            }
            if discovered != actual:
                issues.append(
                    f"{label}: verify.registry.discovered does not match build/app/test files"
                )

    checkpoints = verification.get("checkpoints")
    if not isinstance(checkpoints, list) or not checkpoints:
        issues.append(f"{label}: checkpoints must be a non-empty array")
        checkpoints = []
    checkpoint_ids: set[str] = set()
    for index, checkpoint in enumerate(checkpoints):
        field = f"checkpoints[{index}]"
        if not isinstance(checkpoint, dict):
            issues.append(f"{label}: {field} must be an object")
            continue
        checkpoint_id = checkpoint.get("id")
        if not isinstance(checkpoint_id, str) or not checkpoint_id.strip():
            issues.append(f"{label}: {field}.id must be a non-empty string")
        elif checkpoint_id in checkpoint_ids:
            issues.append(f"{label}: {field}.id duplicates {checkpoint_id}")
        else:
            checkpoint_ids.add(checkpoint_id)
        channels = [key for key in ("state", "runtime", "browser", "visual") if key in checkpoint]
        if not channels:
            issues.append(f"{label}: {field} must contain an evidence path")
        for channel in channels:
            path_issue = _workspace_evidence_issue(
                example_dir, checkpoint.get(channel), f"{field}.{channel}"
            )
            if path_issue:
                issues.append(path_issue.replace("qa/release-gates.json", "qa/verification.json"))

    complete_run = verification.get("completeRun")
    if not isinstance(complete_run, dict):
        issues.append(f"{label}: completeRun must be an object")
    else:
        if not isinstance(complete_run.get("id"), str) or not complete_run["id"].strip():
            issues.append(f"{label}: completeRun.id must be a non-empty string")
        if complete_run.get("cleanContext") is not True:
            issues.append(f"{label}: completeRun.cleanContext must be true")
        for field in ("terminal", "restart"):
            if not isinstance(complete_run.get(field), str) or not complete_run[field].strip():
                issues.append(f"{label}: completeRun.{field} must be a non-empty string")
        steps = complete_run.get("steps")
        if not isinstance(steps, list) or not steps:
            issues.append(f"{label}: completeRun.steps must be a non-empty array")
        else:
            step_ids: set[str] = set()
            for index, step in enumerate(steps):
                field = f"completeRun.steps[{index}]"
                if not isinstance(step, dict):
                    issues.append(f"{label}: {field} must be an object")
                    continue
                step_id = step.get("id")
                if not isinstance(step_id, str) or not step_id.strip():
                    issues.append(f"{label}: {field}.id must be a non-empty string")
                elif step_id in step_ids:
                    issues.append(f"{label}: {field}.id duplicates {step_id}")
                else:
                    step_ids.add(step_id)
                for text_field in ("input", "expected", "checkpoint"):
                    if not isinstance(step.get(text_field), str) or not step[text_field].strip():
                        issues.append(f"{label}: {field}.{text_field} must be a non-empty string")
                if isinstance(step.get("checkpoint"), str) and step["checkpoint"] not in checkpoint_ids:
                    issues.append(f"{label}: {field}.checkpoint is not present in checkpoints")

    verification_commit = verification.get("sourceCommit")
    if verification_commit is not None:
        if not isinstance(verification_commit, str) or not re.fullmatch(
            r"[0-9a-f]{40}", verification_commit
        ):
            issues.append(f"{label}: sourceCommit must be a full lowercase commit ID or null")
        else:
            committed = _git_commit_app_fingerprint(example_dir, verification_commit)
            if committed is None:
                issues.append(f"{label}: sourceCommit app fingerprint could not be verified")
            elif committed != source_fingerprint:
                issues.append(f"{label}: sourceCommit fingerprint does not match sourceFingerprint")
    return issues


def _validate_manifest_resource(
    example_dir: Path, resource: object, field: str
) -> tuple[list[str], bool]:
    """Validate one example-root-relative path/hash/optional-byte binding."""
    prefix = f"{example_dir.name}/qa/release-gates.json"
    if not isinstance(resource, dict):
        return [f"{prefix}: {field} must be an object"], False
    path_issue = _workspace_evidence_issue(example_dir, resource.get("path"), f"{field}.path")
    if path_issue:
        return [path_issue], False
    raw_path = str(resource["path"])
    expected_hash = resource.get("sha256")
    if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
        return [f"{prefix}: {field}.sha256 must be a lowercase sha256"], False
    path = example_dir / raw_path
    issues: list[str] = []
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected_hash:
        issues.append(f"{prefix}: {field}.sha256 does not match referenced file {raw_path}")
    if "bytes" in resource:
        byte_count = resource.get("bytes")
        if not isinstance(byte_count, int) or isinstance(byte_count, bool) or byte_count < 0:
            issues.append(f"{prefix}: {field}.bytes must be a non-negative integer")
        elif byte_count != path.stat().st_size:
            issues.append(f"{prefix}: {field}.bytes does not match referenced file {raw_path}")
    return issues, not issues


def _probe_media(path: Path) -> tuple[dict[str, object] | None, str | None]:
    """Decode media metadata with the repository's existing ffprobe toolchain."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=codec_name,width,height:format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as error:
        return None, f"ffprobe is unavailable: {error}"
    if result.returncode != 0:
        return None, result.stderr.strip() or "ffprobe could not decode the resource"
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        return None, f"ffprobe returned invalid JSON: {error}"
    if not isinstance(payload, dict):
        return None, "ffprobe result must be an object"
    return payload, None


def _fully_decode_media(path: Path) -> str | None:
    """Reject streams whose container metadata survives but payload is corrupt."""
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-map",
                "0:v:0",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except OSError as error:
        return f"ffmpeg is unavailable: {error}"
    except subprocess.TimeoutExpired:
        return "ffmpeg did not finish within 30 seconds"
    errors = result.stderr.strip()
    if result.returncode != 0 or errors:
        return errors.splitlines()[0] if errors else "ffmpeg could not decode the resource"
    return None


def _validate_motion_cadence(
    example_dir: Path, cadence: object, field: str
) -> tuple[list[str], bool, set[str]]:
    """Validate an uncut motion take plus ordered, deterministic phase samples."""
    prefix = f"{example_dir.name}/qa/release-gates.json"
    if not isinstance(cadence, dict):
        return [f"{prefix}: {field} must be an object"], False, set()

    issues: list[str] = []
    paths: set[str] = set()
    cycle = cadence.get("authoredCycleSeconds")
    if (
        not isinstance(cycle, (int, float))
        or isinstance(cycle, bool)
        or not math.isfinite(cycle)
        or cycle <= 0
    ):
        issues.append(f"{prefix}: {field}.authoredCycleSeconds must be a positive number")

    transitions = cadence.get("transitions")
    transition_times: list[float] = []
    if not isinstance(transitions, list) or len(transitions) < 3:
        issues.append(f"{prefix}: {field}.transitions must contain at least three records")
    else:
        expected_transition_phases = [
            "watch",
            "bank-dive-pull-up-cycle",
            "cycle-complete",
        ]
        actual_transition_phases = [
            transition.get("phase") if isinstance(transition, dict) else None
            for transition in transitions
        ]
        if actual_transition_phases != expected_transition_phases:
            issues.append(
                f"{prefix}: {field}.transitions phases must be "
                f"{expected_transition_phases} in order"
            )
        for index, transition in enumerate(transitions):
            transition_field = f"{field}.transitions[{index}]"
            if not isinstance(transition, dict):
                issues.append(f"{prefix}: {transition_field} must be an object")
                continue
            for text_field in ("phase", "threatState", "rendererResponse"):
                value = transition.get(text_field)
                if not isinstance(value, str) or not value.strip():
                    issues.append(
                        f"{prefix}: {transition_field}.{text_field} must be a non-empty string"
                    )
            at_ms = transition.get("atMs")
            if (
                not isinstance(at_ms, (int, float))
                or isinstance(at_ms, bool)
                or not math.isfinite(at_ms)
                or at_ms < 0
            ):
                issues.append(f"{prefix}: {transition_field}.atMs must be non-negative")
            else:
                transition_times.append(float(at_ms))
        if any(
            later <= earlier
            for earlier, later in zip(transition_times, transition_times[1:])
        ):
            issues.append(
                f"{prefix}: {field}.transitions must use strictly increasing atMs values"
            )
        if (
            transition_times
            and isinstance(cycle, (int, float))
            and not isinstance(cycle, bool)
            and math.isfinite(cycle)
            and transition_times[-1] - transition_times[0] < cycle * 1000
        ):
            issues.append(f"{prefix}: {field}.transitions do not cover one authored cycle")

    video = cadence.get("video")
    video_issues, video_valid = _validate_manifest_resource(
        example_dir, video, f"{field}.video"
    )
    issues.extend(video_issues)
    if video_valid and isinstance(video, dict):
        video_path = str(video["path"])
        paths.add(video_path)
        video_bytes = (example_dir / video_path).read_bytes()
        if not video_path.endswith(".webm") or not video_bytes.startswith(
            b"\x1a\x45\xdf\xa3"
        ):
            issues.append(
                f"{prefix}: {field}.video must be an EBML WebM resource"
            )
        video_probe, probe_error = _probe_media(example_dir / video_path)
        if probe_error:
            issues.append(f"{prefix}: {field}.video is not decodable: {probe_error}")
        elif video_probe is not None:
            streams = video_probe.get("streams")
            stream = streams[0] if isinstance(streams, list) and streams else None
            if not isinstance(stream, dict) or stream.get("codec_name") not in {
                "vp8",
                "vp9",
                "av1",
            }:
                issues.append(f"{prefix}: {field}.video must contain a WebM video stream")
            else:
                width = stream.get("width")
                height = stream.get("height")
                if (
                    not isinstance(width, int)
                    or not isinstance(height, int)
                    or width < 640
                    or height < 360
                ):
                    issues.append(
                        f"{prefix}: {field}.video dimensions must be at least 640x360"
                    )
            format_record = video_probe.get("format")
            try:
                duration = float(format_record["duration"])
            except (KeyError, TypeError, ValueError):
                duration = 0
            required_duration = max(
                float(cycle) if isinstance(cycle, (int, float)) else 0,
                transition_times[-1] / 1000 if transition_times else 0,
            )
            if duration < required_duration:
                issues.append(
                    f"{prefix}: {field}.video duration {duration:g}s is shorter "
                    f"than the required {required_duration:g}s cadence"
                )
        decode_error = _fully_decode_media(example_dir / video_path)
        if decode_error:
            issues.append(
                f"{prefix}: {field}.video fails full-frame decoding: {decode_error}"
            )

    samples = cadence.get("samples")
    expected_phases = ["watch", "bank", "dive", "pull-up"]
    if not isinstance(samples, list):
        issues.append(f"{prefix}: {field}.samples must be an array")
        samples = []
    actual_phases = [
        sample.get("phase") if isinstance(sample, dict) else None for sample in samples
    ]
    if actual_phases != expected_phases:
        issues.append(
            f"{prefix}: {field}.samples phases must be {expected_phases} in order"
        )
    renderer_times: list[float] = []
    sample_hashes: list[str] = []
    sample_dimensions: list[tuple[int, int]] = []
    expected_threat_states = ["watch", "attack", "attack", "attack"]
    for index, sample in enumerate(samples):
        sample_field = f"{field}.samples[{index}]"
        if not isinstance(sample, dict):
            issues.append(f"{prefix}: {sample_field} must be an object")
            continue
        for text_field in ("threatState", "rendererResponse"):
            value = sample.get(text_field)
            if not isinstance(value, str) or not value.strip():
                issues.append(
                    f"{prefix}: {sample_field}.{text_field} must be a non-empty string"
                )
        seconds = sample.get("rendererSeconds")
        if (
            not isinstance(seconds, (int, float))
            or isinstance(seconds, bool)
            or not math.isfinite(seconds)
            or seconds < 0
        ):
            issues.append(
                f"{prefix}: {sample_field}.rendererSeconds must be non-negative"
            )
        else:
            renderer_times.append(float(seconds))
        resource_issues, resource_valid = _validate_manifest_resource(
            example_dir, sample, sample_field
        )
        issues.extend(resource_issues)
        if resource_valid:
            sample_path = str(sample["path"])
            paths.add(sample_path)
            sample_hashes.append(str(sample["sha256"]))
            sample_bytes = (example_dir / sample_path).read_bytes()
            if (
                not sample_path.endswith((".jpg", ".jpeg"))
                or not sample_bytes.startswith(b"\xff\xd8")
                or not sample_bytes.endswith(b"\xff\xd9")
            ):
                issues.append(
                    f"{prefix}: {sample_field} must be a complete JPEG resource"
                )
            sample_probe, probe_error = _probe_media(example_dir / sample_path)
            if probe_error:
                issues.append(
                    f"{prefix}: {sample_field} is not a decodable JPEG: {probe_error}"
                )
            elif sample_probe is not None:
                streams = sample_probe.get("streams")
                stream = streams[0] if isinstance(streams, list) and streams else None
                if not isinstance(stream, dict) or stream.get("codec_name") != "mjpeg":
                    issues.append(f"{prefix}: {sample_field} must decode as JPEG")
                else:
                    width = stream.get("width")
                    height = stream.get("height")
                    if isinstance(width, int) and isinstance(height, int):
                        sample_dimensions.append((width, height))
                    else:
                        issues.append(
                            f"{prefix}: {sample_field} must expose pixel dimensions"
                        )
            decode_error = _fully_decode_media(example_dir / sample_path)
            if decode_error:
                issues.append(
                    f"{prefix}: {sample_field} fails full-frame decoding: {decode_error}"
                )
        if index < len(expected_threat_states) and sample.get(
            "threatState"
        ) != expected_threat_states[index]:
            issues.append(
                f"{prefix}: {sample_field}.threatState must be "
                f"{expected_threat_states[index]}"
            )
    if any(
        later <= earlier for earlier, later in zip(renderer_times, renderer_times[1:])
    ):
        issues.append(
            f"{prefix}: {field}.samples must use strictly increasing rendererSeconds values"
        )
    if len(sample_hashes) == len(samples) and len(set(sample_hashes)) != len(sample_hashes):
        issues.append(f"{prefix}: {field}.samples must bind distinct phase images")
    if sample_dimensions and (
        len(sample_dimensions) != len(samples)
        or len(set(sample_dimensions)) != 1
        or sample_dimensions[0][0] < 640
        or sample_dimensions[0][1] < 360
    ):
        issues.append(
            f"{prefix}: {field}.samples must share dimensions of at least 640x360"
        )
    if cadence.get("consoleErrors") != []:
        issues.append(f"{prefix}: {field}.consoleErrors must be empty")
    return issues, not issues, paths


def _source_input_order(path: str) -> tuple[int, str]:
    priority = {"index.html": 0, "package.json": 1, "package-lock.json": 2}
    return priority.get(path, 3), path


def _validate_source_input_manifest(
    example_dir: Path, binding: object, source_fingerprint: object
) -> list[str]:
    """Validate and recompute a runtime-neutral canonical candidate identity."""
    prefix = f"{example_dir.name}/qa/release-gates.json"
    field = "sourceInputManifest"
    resource_issues, binding_valid = _validate_manifest_resource(
        example_dir, binding, field
    )
    issues = list(resource_issues)
    if not binding_valid or not isinstance(binding, dict):
        return issues
    manifest_path = example_dir / str(binding["path"])
    manifest, manifest_issues = _read_json_object(manifest_path, f"{prefix}: {field}.path")
    issues.extend(manifest_issues)
    if manifest is None:
        return issues
    if manifest.get("schemaVersion") != 1:
        issues.append(f"{prefix}: {field}.schemaVersion must be 1")
    base_raw = manifest.get("basePath")
    if not isinstance(base_raw, str) or not base_raw.strip():
        issues.append(f"{prefix}: {field}.basePath must be a non-empty path")
        return issues
    base_candidate = Path(base_raw)
    base = (example_dir / base_candidate).resolve()
    try:
        base.relative_to(example_dir.resolve())
    except ValueError:
        issues.append(f"{prefix}: {field}.basePath leaves the example workspace")
        return issues
    if base_candidate.is_absolute() or "://" in base_raw:
        issues.append(f"{prefix}: {field}.basePath must be workspace-local")
        return issues
    if not base.is_dir():
        issues.append(f"{prefix}: {field}.basePath does not exist: {base_raw}")
        return issues
    inputs = manifest.get("inputs")
    if not isinstance(inputs, list) or not inputs:
        issues.append(f"{prefix}: {field}.inputs must be a non-empty array")
        return issues
    paths: list[str] = []
    input_files: list[Path | None] = []
    for index, item in enumerate(inputs):
        item_field = f"{field}.inputs[{index}]"
        if not isinstance(item, dict):
            issues.append(f"{prefix}: {item_field} must be an object")
            input_files.append(None)
            continue
        raw_path = item.get("path")
        if not isinstance(raw_path, str) or not raw_path.strip():
            issues.append(f"{prefix}: {item_field}.path must be a non-empty path")
            input_files.append(None)
            continue
        candidate = Path(raw_path)
        resolved = (base / candidate).resolve()
        try:
            resolved.relative_to(base)
        except ValueError:
            issues.append(f"{prefix}: {item_field}.path leaves sourceInputManifest.basePath")
            input_files.append(None)
            continue
        if candidate.is_absolute() or "://" in raw_path:
            issues.append(f"{prefix}: {item_field}.path must be workspace-local")
            input_files.append(None)
            continue
        paths.append(candidate.as_posix())
        if not resolved.is_file():
            issues.append(f"{prefix}: {item_field}.path does not exist: {raw_path}")
            input_files.append(None)
            continue
        expected_hash = item.get("sha256")
        if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
            issues.append(f"{prefix}: {item_field}.sha256 must be a lowercase sha256")
        elif hashlib.sha256(resolved.read_bytes()).hexdigest() != expected_hash:
            issues.append(f"{prefix}: {item_field}.sha256 does not match {raw_path}")
        byte_count = item.get("bytes")
        if not isinstance(byte_count, int) or isinstance(byte_count, bool) or byte_count < 0:
            issues.append(f"{prefix}: {item_field}.bytes must be a non-negative integer")
        elif byte_count != resolved.stat().st_size:
            issues.append(f"{prefix}: {item_field}.bytes does not match {raw_path}")
        input_files.append(resolved)
    if len(paths) != len(set(paths)):
        issues.append(f"{prefix}: {field}.inputs paths must be unique")
    if paths != sorted(paths, key=_source_input_order):
        issues.append(f"{prefix}: {field}.inputs must use canonical path order")
    if len(input_files) == len(inputs) and all(path is not None for path in input_files):
        digest = hashlib.sha256()
        for relative, path in zip(paths, input_files):
            assert path is not None
            digest.update(relative.encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
        recomputed = digest.hexdigest()
        if manifest.get("sourceFingerprint") != recomputed:
            issues.append(f"{prefix}: {field}.sourceFingerprint does not match canonical inputs")
        if source_fingerprint != recomputed:
            issues.append(f"{prefix}: {field}.sourceFingerprint must match release sourceFingerprint")
    return issues


def _validate_asset_ledger(
    example_dir: Path,
) -> tuple[dict[str, dict[str, object]], list[str]]:
    path = example_dir / "build/asset-ledger.json"
    ledger, issues = _read_json_object(path, f"{example_dir.name}/build/asset-ledger.json")
    entries_by_key: dict[str, dict[str, object]] = {}
    if ledger is None:
        return entries_by_key, issues
    entries = ledger.get("entries")
    if not isinstance(entries, list):
        return entries_by_key, issues + [
            f"{example_dir.name}/build/asset-ledger.json: entries must be an array"
        ]
    for index, entry in enumerate(entries):
        label = f"{example_dir.name}/build/asset-ledger.json: entries[{index}]"
        if not isinstance(entry, dict):
            issues.append(f"{label} must be an object")
            continue
        key = entry.get("key")
        if not isinstance(key, str) or not key.strip():
            issues.append(f"{label}.key must be a non-empty string")
            continue
        if key in entries_by_key:
            issues.append(f"{label}.key duplicates {key}")
        entries_by_key[key] = entry
        if not isinstance(entry.get("status"), str) or not entry["status"].strip():
            issues.append(f"{label}.status must be a non-empty string")
        if not isinstance(entry.get("releaseGatePassed"), bool):
            issues.append(f"{label}.releaseGatePassed must be boolean")
        evidence = entry.get("evidence")
        if not isinstance(evidence, list):
            issues.append(f"{label}.evidence must be an array")
        else:
            for evidence_index, raw in enumerate(evidence):
                if not isinstance(raw, str) or not raw.strip():
                    issues.append(f"{label}.evidence[{evidence_index}] must be a path")
                    continue
                candidate = Path(raw)
                resolved = (path.parent / candidate).resolve()
                try:
                    resolved.relative_to(example_dir.resolve())
                except ValueError:
                    issues.append(f"{label}.evidence[{evidence_index}] leaves workspace: {raw}")
                    continue
                if candidate.is_absolute() or "://" in raw:
                    issues.append(f"{label}.evidence[{evidence_index}] must be workspace-local: {raw}")
                elif not resolved.is_file():
                    issues.append(f"{label}.evidence[{evidence_index}] does not exist: {raw}")
        if not isinstance(entry.get("remaining"), str):
            issues.append(f"{label}.remaining must be a string")
        if entry.get("tier") == "release-gate" and isinstance(evidence, list) and not evidence:
            issues.append(f"{label}.evidence must not be empty")
        if entry.get("releaseGatePassed") is True and isinstance(
            entry.get("remaining"), str
        ):
            normalized_remaining = entry["remaining"].strip().lower()
            if normalized_remaining not in {"", "none", "nothing", "n/a", "无", "无剩余"}:
                issues.append(f"{label}.remaining must be empty/none when passed")
    return entries_by_key, issues


def _validate_visual_frames(
    example_dir: Path, release: dict[str, object]
) -> tuple[list[object], set[str], list[str]]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    frames = release.get("visualFrames")
    if not isinstance(frames, list):
        issues.append(f"{prefix}: visualFrames must be an array")
        frames = []
    frame_ids: set[str] = set()
    for index, frame in enumerate(frames):
        field = f"visualFrames[{index}]"
        if not isinstance(frame, dict):
            issues.append(f"{prefix}: {field} must be an object")
            continue
        frame_id = frame.get("id")
        if not isinstance(frame_id, str) or not frame_id.strip():
            issues.append(f"{prefix}: {field}.id must be a non-empty string")
        elif frame_id in frame_ids:
            issues.append(f"{prefix}: {field}.id duplicates {frame_id}")
        else:
            frame_ids.add(frame_id)
        if frame.get("status") not in GATE_STATUSES:
            issues.append(
                f"{prefix}: {field}.status must be one of {sorted(GATE_STATUSES)}"
            )
        issues.extend(
            _validate_evidence_list(
                example_dir,
                frame.get("evidence"),
                f"{field}.evidence",
                required=True,
            )
        )
        operation_path = frame.get("operationPath")
        if not isinstance(operation_path, str) or not operation_path.strip():
            issues.append(
                f"{prefix}: {field}.operationPath must be a non-empty string"
            )
        rubric = frame.get("rubric")
        if not isinstance(rubric, dict):
            issues.append(f"{prefix}: {field}.rubric must be an object")
            continue
        missing_rubric = VISUAL_RUBRIC_FIELDS - rubric.keys()
        extra_rubric = rubric.keys() - VISUAL_RUBRIC_FIELDS
        if missing_rubric:
            issues.append(f"{prefix}: {field}.rubric missing {sorted(missing_rubric)}")
        if extra_rubric:
            issues.append(
                f"{prefix}: {field}.rubric has unknown keys {sorted(extra_rubric)}"
            )
        for dimension in VISUAL_RUBRIC_FIELDS & rubric.keys():
            if rubric[dimension] not in GATE_STATUSES:
                issues.append(
                    f"{prefix}: {field}.rubric.{dimension} must be one of "
                    f"{sorted(GATE_STATUSES)}"
                )
    return frames, frame_ids, issues


def _validate_visual_review(
    example_dir: Path, release: dict[str, object]
) -> tuple[dict[str, object], list[str]]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    review = release.get("visualReview")
    if not isinstance(review, dict):
        issues.append(f"{prefix}: visualReview must be an object")
        review = {}
    if not isinstance(review.get("required"), bool):
        issues.append(f"{prefix}: visualReview.required must be boolean")
    if review.get("status") not in GATE_STATUSES:
        issues.append(
            f"{prefix}: visualReview.status must be one of {sorted(GATE_STATUSES)}"
        )
    if review.get("evidence") is not None:
        evidence_issue = _workspace_evidence_issue(
            example_dir, review.get("evidence"), "visualReview.evidence"
        )
        if evidence_issue:
            issues.append(evidence_issue)
    if review.get("status") in {"PASS", "FAIL"}:
        for field in ("reviewer", "independence"):
            value = review.get(field)
            if not isinstance(value, str) or not value.strip():
                issues.append(
                    f"{prefix}: visualReview.{field} is required for completed review"
                )
        if review.get("evidence") is None:
            issues.append(
                f"{prefix}: visualReview.evidence is required for completed review"
            )
        for field in ("reviewedSourceFingerprint", "reviewedManifestSha256"):
            value = review.get(field)
            if value is not None and not (
                isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value)
            ):
                issues.append(
                    f"{prefix}: visualReview.{field} must be a lowercase sha256"
                )
    return review, issues


def _validate_release_asset_keys(
    example_dir: Path, release: dict[str, object]
) -> tuple[list[str], list[str], list[str]]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    focal_assets = release.get("focalReleaseAssets")
    if not isinstance(focal_assets, list) or any(
        not isinstance(key, str) or not key.strip() for key in focal_assets
    ):
        issues.append(
            f"{prefix}: focalReleaseAssets must be an array of non-empty keys"
        )
        focal_assets = []
    elif len(set(focal_assets)) != len(focal_assets):
        issues.append(f"{prefix}: focalReleaseAssets must not contain duplicates")
    degradable_assets = release.get("degradableReleaseAssets")
    if not isinstance(degradable_assets, list) or any(
        not isinstance(key, str) or not key.strip() for key in degradable_assets
    ):
        issues.append(
            f"{prefix}: degradableReleaseAssets must be an array of non-empty keys"
        )
        degradable_assets = []
    elif len(set(degradable_assets)) != len(degradable_assets):
        issues.append(
            f"{prefix}: degradableReleaseAssets must not contain duplicates"
        )
    overlap = set(focal_assets) & set(degradable_assets)
    if overlap:
        issues.append(
            f"{prefix}: release assets cannot be both focal and degradable: "
            f"{sorted(overlap)}"
        )
    return focal_assets, degradable_assets, issues


def _validate_release_identity(
    example_dir: Path,
    release: dict[str, object],
    verification_candidate: Path | None = None,
) -> tuple[object, dict[str, object] | None, list[str]]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    source_commit = release.get("sourceCommit")
    evidence_commit = release.get("evidenceCommit")
    commits = (("sourceCommit", source_commit), ("evidenceCommit", evidence_commit))
    for field, value in commits:
        if value is not None and (not isinstance(value, str) or not value.strip()):
            issues.append(f"{prefix}: {field} must be a non-empty string or null")
    for field, value in commits:
        if value is None:
            continue
        if not re.fullmatch(r"[0-9a-f]{40}", value):
            issues.append(f"{prefix}: {field} must be a full lowercase commit ID or null")
            continue
        result = subprocess.run(
            ["git", "cat-file", "-e", f"{value}^{{commit}}"],
            cwd=example_dir,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            issues.append(f"{prefix}: {field} does not identify a repository commit")
            continue
        committed_fingerprint = _git_commit_app_fingerprint(example_dir, value)
        if (
            committed_fingerprint is not None
            and release.get("sourceFingerprint") is not None
            and committed_fingerprint != release.get("sourceFingerprint")
        ):
            issues.append(
                f"{prefix}: {field} fingerprint does not match release sourceFingerprint"
            )

    source_fingerprint = release.get("sourceFingerprint")
    if source_fingerprint is not None and not (
        isinstance(source_fingerprint, str)
        and re.fullmatch(r"[0-9a-f]{64}", source_fingerprint)
    ):
        issues.append(
            f"{prefix}: sourceFingerprint must be a lowercase sha256 or null"
        )
    verification_path = verification_candidate or example_dir / "qa/verification.json"
    verification: dict[str, object] | None = None
    if verification_path.is_file():
        verification, verification_issues = _read_json_object(
            verification_path, f"{example_dir.name}/qa/verification.json"
        )
        issues.extend(verification_issues)
    if (
        verification is not None
        and source_fingerprint != verification.get("sourceFingerprint")
    ):
        issues.append(f"{prefix}: sourceFingerprint must match qa/verification.json")
    return source_fingerprint, verification, issues


def _validate_visual_evidence_manifests(
    example_dir: Path,
    release: dict[str, object],
    evidence_tier: object,
    source_fingerprint: object,
) -> tuple[list[object], list[str], set[str], set[str], set[str], list[str]]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    visual_manifests = release.get("visualEvidenceManifests")
    if not isinstance(visual_manifests, list):
        issues.append(f"{prefix}: visualEvidenceManifests must be an array")
        visual_manifests = []
    unbound_manifests: list[str] = []
    verified_manifest_hashes: set[str] = set()
    verified_runtime_paths: set[str] = set()
    verified_target_ids: set[str] = set()
    for index, binding in enumerate(visual_manifests):
        field = f"visualEvidenceManifests[{index}]"
        binding_valid = True
        manifest_runtime_paths: set[str] = set()
        manifest_target_ids: set[str] = set()
        if not isinstance(binding, dict):
            issues.append(f"{prefix}: {field} must be an object")
            continue
        raw_path = binding.get("path")
        path_issue = _workspace_evidence_issue(
            example_dir, raw_path, f"{field}.path"
        )
        if path_issue:
            issues.append(path_issue)
            continue
        expected_hash = binding.get("sha256")
        if not isinstance(expected_hash, str) or not re.fullmatch(
            r"[0-9a-f]{64}", expected_hash
        ):
            issues.append(f"{prefix}: {field}.sha256 must be a lowercase sha256")
            continue
        manifest_path = example_dir / str(raw_path)
        actual_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        if expected_hash != actual_hash:
            issues.append(
                f"{prefix}: {field}.sha256 does not match the manifest file"
            )
            binding_valid = False
        manifest, manifest_issues = _read_json_object(
            manifest_path, f"{prefix}: {field}.path"
        )
        issues.extend(manifest_issues)
        if manifest_issues:
            binding_valid = False
        if manifest is None:
            continue

        manifest_fingerprint = manifest.get("sourceFingerprint")
        if manifest_fingerprint is None:
            unbound_manifests.append(field)
            binding_valid = False
        elif not (
            isinstance(manifest_fingerprint, str)
            and re.fullmatch(r"[0-9a-f]{64}", manifest_fingerprint)
        ):
            issues.append(
                f"{prefix}: {field}.sourceFingerprint must be a lowercase sha256"
            )
            binding_valid = False
        elif manifest_fingerprint != source_fingerprint:
            issues.append(
                f"{prefix}: {field}.sourceFingerprint must match release sourceFingerprint"
            )
            binding_valid = False

        captures = manifest.get("captures")
        if not isinstance(captures, list) or not captures:
            issues.append(f"{prefix}: {field}.captures must not be empty")
            binding_valid = False
        else:
            for resource_index, resource in enumerate(captures):
                resource_issues, resource_valid = _validate_manifest_resource(
                    example_dir,
                    resource,
                    f"{field}.captures[{resource_index}]",
                )
                issues.extend(resource_issues)
                binding_valid = binding_valid and resource_valid
                if resource_valid and isinstance(resource, dict):
                    manifest_runtime_paths.add(str(resource["path"]))

        if "contactSheet" not in manifest and evidence_tier != "graybox":
            issues.append(f"{prefix}: {field}.contactSheet is required above graybox")
            binding_valid = False
        elif "contactSheet" in manifest:
            contact_sheet = manifest.get("contactSheet")
            resource_issues, resource_valid = _validate_manifest_resource(
                example_dir, contact_sheet, f"{field}.contactSheet"
            )
            issues.extend(resource_issues)
            binding_valid = binding_valid and resource_valid
            if resource_valid and isinstance(contact_sheet, dict):
                manifest_runtime_paths.add(str(contact_sheet["path"]))

        targets = manifest.get("targets")
        if targets is not None:
            if not isinstance(targets, list) or not targets:
                issues.append(f"{prefix}: {field}.targets must not be empty")
                binding_valid = False
            else:
                for resource_index, resource in enumerate(targets):
                    target_field = f"{field}.targets[{resource_index}]"
                    target_id = (
                        resource.get("id") if isinstance(resource, dict) else None
                    )
                    if not isinstance(target_id, str) or not target_id.strip():
                        issues.append(
                            f"{prefix}: {target_field}.id must be a non-empty string"
                        )
                        binding_valid = False
                    elif target_id in manifest_target_ids:
                        issues.append(
                            f"{prefix}: {target_field}.id duplicates {target_id}"
                        )
                        binding_valid = False
                    else:
                        manifest_target_ids.add(target_id)
                    resource_issues, resource_valid = _validate_manifest_resource(
                        example_dir, resource, target_field
                    )
                    issues.extend(resource_issues)
                    binding_valid = binding_valid and resource_valid
        elif evidence_tier != "graybox":
            issues.append(f"{prefix}: {field}.targets are required above graybox")
            binding_valid = False

        if "motionCadence" in manifest:
            cadence_issues, cadence_valid, cadence_paths = _validate_motion_cadence(
                example_dir, manifest.get("motionCadence"), f"{field}.motionCadence"
            )
            issues.extend(cadence_issues)
            binding_valid = binding_valid and cadence_valid
            if cadence_valid:
                manifest_runtime_paths.update(cadence_paths)
        if "targetHashes" in manifest:
            issues.append(
                f"{prefix}: {field}.targetHashes is unverified legacy metadata; "
                "use structured targets path/sha256 records"
            )
            binding_valid = False

        if not binding_valid:
            continue
        overlap = verified_target_ids & manifest_target_ids
        if overlap:
            issues.append(
                f"{prefix}: verified visual target ids must be unique: "
                f"{sorted(overlap)}"
            )
            continue
        verified_manifest_hashes.add(expected_hash)
        verified_runtime_paths.update(manifest_runtime_paths)
        verified_target_ids.update(manifest_target_ids)
    return (
        visual_manifests,
        unbound_manifests,
        verified_manifest_hashes,
        verified_runtime_paths,
        verified_target_ids,
        issues,
    )


def _validate_public_host(
    example_dir: Path,
    release: dict[str, object],
    source_fingerprint: object,
) -> list[str]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    public_host = release.get("publicHost")
    if public_host is None:
        return []
    if not isinstance(public_host, dict):
        return [f"{prefix}: publicHost must be an object"]

    issues: list[str] = []
    status = public_host.get("status")
    if status not in {"PASS", "HISTORICAL", "NOT_CURRENT"}:
        issues.append(
            f"{prefix}: publicHost.status must be PASS, HISTORICAL, or NOT_CURRENT"
        )
    raw_path = public_host.get("evidence")
    path_issue = _workspace_evidence_issue(
        example_dir, raw_path, "publicHost.evidence"
    )
    if path_issue:
        issues.append(path_issue)
        return issues
    report, report_issues = _read_json_object(
        example_dir / str(raw_path), f"{prefix}: publicHost.evidence"
    )
    issues.extend(report_issues)
    if report is None:
        return issues
    report_source = report.get("source")
    report_fingerprint = report.get("sourceFingerprint")
    if report_fingerprint is None and isinstance(report_source, dict):
        report_fingerprint = report_source.get("sha256")
    if public_host.get("sourceFingerprint") != report_fingerprint:
        issues.append(
            f"{prefix}: publicHost.sourceFingerprint must match deployed report"
        )
    if status == "PASS" and report_fingerprint != source_fingerprint:
        issues.append(
            f"{prefix}: publicHost PASS fingerprint must match release sourceFingerprint"
        )
    return issues


def _validate_promoted_visuals(
    example_dir: Path,
    frames: list[object],
    frame_ids: set[str],
    review: dict[str, object],
    defects: list[object],
    source_fingerprint: object,
    verified_manifest_hashes: set[str],
    verified_runtime_paths: set[str],
    verified_target_ids: set[str],
) -> list[str]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    issues: list[str] = []
    if not frames:
        issues.append(f"{prefix}: visualFrames must not be empty")
    for index, frame in enumerate(frames):
        if isinstance(frame, dict) and frame.get("status") != "PASS":
            issues.append(f"{prefix}: visualFrames[{index}].status must be PASS")
        if isinstance(frame, dict) and isinstance(frame.get("rubric"), dict):
            for dimension in VISUAL_RUBRIC_FIELDS:
                if frame["rubric"].get(dimension) != "PASS":
                    issues.append(
                        f"{prefix}: visualFrames[{index}].rubric.{dimension} "
                        "must be PASS"
                    )
        if isinstance(frame, dict) and isinstance(frame.get("evidence"), list):
            for evidence_index, raw in enumerate(frame["evidence"]):
                if raw not in verified_runtime_paths:
                    issues.append(
                        f"{prefix}: visualFrames[{index}].evidence[{evidence_index}] "
                        "must reference a verified capture or contactSheet"
                    )
    if frame_ids != verified_target_ids:
        issues.append(
            f"{prefix}: visualFrames ids must exactly match verified visual target ids"
        )
    if review.get("required") is not True:
        issues.append(f"{prefix}: visualReview.required must be true")
    if review.get("status") != "PASS":
        issues.append(f"{prefix}: visualReview.status must be PASS")
    for field in ("reviewer", "independence"):
        value = review.get(field)
        if not isinstance(value, str) or not value.strip():
            issues.append(f"{prefix}: visualReview.{field} is required")
    if review.get("evidence") is None:
        issues.append(f"{prefix}: visualReview.evidence is required")
    if review.get("reviewedSourceFingerprint") != source_fingerprint:
        issues.append(
            f"{prefix}: visualReview.reviewedSourceFingerprint must match release "
            "sourceFingerprint"
        )
    reviewed_manifest_hash = review.get("reviewedManifestSha256")
    if reviewed_manifest_hash not in verified_manifest_hashes:
        issues.append(
            f"{prefix}: visualReview.reviewedManifestSha256 must identify a verified "
            "visualEvidenceManifests sha256"
        )
    for index, defect in enumerate(defects):
        if (
            isinstance(defect, dict)
            and defect.get("status") == "OPEN"
            and defect.get("severity") in {"blocker", "major"}
        ):
            issues.append(
                f"{prefix}: unresolvedDefects[{index}] has open "
                f"{defect.get('severity')}"
            )
    return issues


def _validate_degradable_asset(
    example_dir: Path, key: str, entry: dict[str, object]
) -> list[str]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    if entry.get("tier") != "release-gate":
        return [f"{prefix}: degradable release asset {key} must use tier release-gate"]

    issues: list[str] = []
    fallback = entry.get("fallback")
    ledger_label = f"{example_dir.name}/build/asset-ledger.json: {key}.fallback"
    if not isinstance(fallback, dict):
        return [f"{ledger_label} must be an object"]
    behavior = fallback.get("behavior")
    if not isinstance(behavior, str) or not behavior.strip():
        issues.append(f"{ledger_label}.behavior must be a non-empty string")
    dimensions = {
        "coreAction",
        "state",
        "result",
        "readableFeedback",
        "restart",
    }
    preserved = fallback.get("preserved")
    if not isinstance(preserved, dict) or set(preserved) != dimensions:
        issues.append(
            f"{ledger_label}.preserved must contain exactly {sorted(dimensions)}"
        )
    elif any(preserved[dimension] is not True for dimension in dimensions):
        issues.append(f"{ledger_label}.preserved must set every dimension true")
    fallback_evidence = fallback.get("evidence")
    if not isinstance(fallback_evidence, list) or not fallback_evidence:
        issues.append(f"{ledger_label}.evidence must be a non-empty array")
        return issues
    for index, raw in enumerate(fallback_evidence):
        if not isinstance(raw, str) or not raw.strip():
            issues.append(f"{ledger_label}.evidence[{index}] must be a path")
            continue
        candidate = Path(raw)
        resolved = (example_dir / "build" / candidate).resolve()
        try:
            resolved.relative_to(example_dir.resolve())
        except ValueError:
            issues.append(
                f"{ledger_label}.evidence[{index}] leaves workspace: {raw}"
            )
            continue
        if candidate.is_absolute() or "://" in raw:
            issues.append(
                f"{ledger_label}.evidence[{index}] must be workspace-local: {raw}"
            )
        elif not resolved.is_file():
            issues.append(f"{ledger_label}.evidence[{index}] does not exist: {raw}")
    return issues


def _validate_promoted_assets(
    example_dir: Path,
    evidence_tier: object,
    focal_assets: list[str],
    degradable_assets: list[str],
    ledger_entries: dict[str, dict[str, object]],
) -> list[str]:
    prefix = f"{example_dir.name}/qa/release-gates.json"
    ledger_prefix = f"{example_dir.name}/build/asset-ledger.json"
    issues: list[str] = []
    if not focal_assets:
        issues.append(f"{prefix}: focalReleaseAssets must not be empty")
    for key in focal_assets:
        entry = ledger_entries.get(key)
        if entry is None:
            issues.append(
                f"{prefix}: focal release asset {key} is missing from asset ledger"
            )
            continue
        if entry.get("tier") != "release-gate":
            issues.append(
                f"{prefix}: focal release asset {key} must use tier release-gate"
            )
        if entry.get("releaseGatePassed") is not True:
            issues.append(f"{ledger_prefix}: {key}.releaseGatePassed must be true")
        if not entry.get("evidence"):
            issues.append(f"{ledger_prefix}: {key}.evidence must not be empty")

    classified_assets = set(focal_assets) | set(degradable_assets)
    for key, entry in ledger_entries.items():
        if entry.get("tier") == "release-gate" and key not in classified_assets:
            issues.append(f"{prefix}: unclassified release-gate asset {key}")
    for key in degradable_assets:
        entry = ledger_entries.get(key)
        if entry is None:
            issues.append(
                f"{prefix}: degradable release asset {key} is missing from asset ledger"
            )
            continue
        issues.extend(_validate_degradable_asset(example_dir, key, entry))

    if evidence_tier in {"polished-vertical-slice", "showcase"}:
        release_entries = [
            entry
            for entry in ledger_entries.values()
            if entry.get("tier") == "release-gate"
        ]
        if not release_entries:
            issues.append(f"{ledger_prefix}: no release-gate entries")
        for entry in release_entries:
            if entry.get("releaseGatePassed") is not True:
                issues.append(
                    f"{ledger_prefix}: "
                    f"{entry.get('key', '<unknown>')}.releaseGatePassed must be true"
                )
    return issues


def validate_publication(
    example_dir: Path,
    publication_tier: str,
    verification_candidate: Path | None = None,
) -> list[str]:
    """Validate ordered publication claims against retained, workspace-local proof."""
    issues: list[str] = []
    prefix = f"{example_dir.name}/qa/release-gates.json"
    release, release_issues = _read_json_object(
        example_dir / "qa/release-gates.json", prefix
    )
    issues.extend(release_issues)
    if release is None:
        return issues

    required = {
        "schemaVersion",
        "sourceCommit",
        "evidenceCommit",
        "sourceFingerprint",
        "visualEvidenceManifests",
        "targetFinish",
        "publicationTier",
        "demonstratedTier",
        "pipelineGates",
        "grayboxReady",
        "visualPromotion",
        "visualFrames",
        "visualReview",
        "focalReleaseAssets",
        "degradableReleaseAssets",
        "unresolvedDefects",
    }
    missing = required - release.keys()
    if missing:
        issues.append(f"{prefix}: missing {sorted(missing)}")
    if release.get("schemaVersion") != 1:
        issues.append(f"{prefix}: schemaVersion must be 1")

    target_finish = release.get("targetFinish")
    demonstrated_tier = release.get("demonstratedTier")
    recorded_publication = release.get("publicationTier")
    for field, value in (
        ("targetFinish", target_finish),
        ("publicationTier", recorded_publication),
        ("demonstratedTier", demonstrated_tier),
    ):
        if value not in PUBLICATION_TIERS:
            issues.append(f"{prefix}: {field} must be one of {sorted(PUBLICATION_TIERS)}")
    if recorded_publication != publication_tier:
        issues.append(f"{prefix}: publicationTier must match example.json")
    rank = {tier: index for index, tier in enumerate((
        "graybox", "playable-prototype", "polished-vertical-slice", "showcase"
    ))}
    if recorded_publication in rank and target_finish in rank:
        if rank[recorded_publication] > rank[target_finish]:
            issues.append(f"{prefix}: publicationTier exceeds targetFinish")
    if recorded_publication in rank and demonstrated_tier in rank:
        if rank[recorded_publication] > rank[demonstrated_tier]:
            issues.append(f"{prefix}: publicationTier exceeds demonstratedTier")
    if demonstrated_tier in rank and target_finish in rank:
        if rank[demonstrated_tier] > rank[target_finish]:
            issues.append(f"{prefix}: demonstratedTier exceeds targetFinish")
    issues.extend(
        _validate_target_finish_inheritance(
            example_dir, target_finish, demonstrated_tier
        )
    )

    all_gates = ("intake", "analyze", "concept", "design", "art", "build", "qa")
    gates = release.get("pipelineGates")
    if not isinstance(gates, dict):
        issues.append(f"{prefix}: pipelineGates must be an object")
        gates = {}
    for gate in all_gates:
        if gates.get(gate) not in GATE_STATUSES:
            issues.append(f"{prefix}: pipelineGates.{gate} must be one of {sorted(GATE_STATUSES)}")
    extra_gates = set(gates) - set(all_gates)
    if extra_gates:
        issues.append(f"{prefix}: pipelineGates has unknown keys {sorted(extra_gates)}")

    graybox_ready = release.get("grayboxReady")
    if not isinstance(graybox_ready, dict):
        issues.append(f"{prefix}: grayboxReady must be an object")
        graybox_ready = {}
    if graybox_ready.get("status") not in GATE_STATUSES:
        issues.append(
            f"{prefix}: grayboxReady.status must be one of {sorted(GATE_STATUSES)}"
        )
    issues.extend(
        _validate_evidence_list(
            example_dir,
            graybox_ready.get("evidence"),
            "grayboxReady.evidence",
            required=True,
        )
    )
    if graybox_ready.get("status") != "PASS":
        issues.append(f"{prefix}: grayboxReady.status must be PASS")

    promotion = release.get("visualPromotion")
    if not isinstance(promotion, dict):
        issues.append(f"{prefix}: visualPromotion must be an object")
        promotion = {}
    if promotion.get("status") not in GATE_STATUSES:
        issues.append(f"{prefix}: visualPromotion.status must be one of {sorted(GATE_STATUSES)}")
    issues.extend(_validate_evidence_list(
        example_dir, promotion.get("evidence"), "visualPromotion.evidence", required=False
    ))
    issues.extend(
        _validate_build_release_states(
            example_dir,
            recorded_publication,
            demonstrated_tier,
            graybox_ready.get("status"),
            promotion.get("status"),
        )
    )

    frames, frame_ids, frame_issues = _validate_visual_frames(example_dir, release)
    issues.extend(frame_issues)
    review, review_issues = _validate_visual_review(example_dir, release)
    issues.extend(review_issues)

    defects = release.get("unresolvedDefects")
    if not isinstance(defects, list):
        issues.append(f"{prefix}: unresolvedDefects must be an array")
        defects = []
    defect_ids: set[str] = set()
    for index, defect in enumerate(defects):
        field = f"unresolvedDefects[{index}]"
        if not isinstance(defect, dict):
            issues.append(f"{prefix}: {field} must be an object")
            continue
        defect_id = defect.get("id")
        if not isinstance(defect_id, str) or not defect_id.strip():
            issues.append(f"{prefix}: {field}.id must be a non-empty string")
        elif defect_id in defect_ids:
            issues.append(f"{prefix}: {field}.id duplicates {defect_id}")
        else:
            defect_ids.add(defect_id)
        if defect.get("severity") not in {"blocker", "major", "minor"}:
            issues.append(f"{prefix}: {field}.severity must be blocker, major, or minor")
        if defect.get("status") not in {"OPEN", "CLOSED"}:
            issues.append(f"{prefix}: {field}.status must be OPEN or CLOSED")
        if not isinstance(defect.get("summary"), str) or not defect["summary"].strip():
            issues.append(f"{prefix}: {field}.summary must be a non-empty string")
        if "owner" in defect and defect.get("owner") not in {
            "build",
            "design",
            "product",
        }:
            issues.append(f"{prefix}: {field}.owner must be build, design, or product")
        if "evidence" in defect:
            issues.extend(
                _validate_evidence_list(
                    example_dir,
                    defect.get("evidence"),
                    f"{field}.evidence",
                    required=defect.get("status") == "CLOSED",
                )
            )
        elif defect.get("status") == "CLOSED":
            issues.append(f"{prefix}: {field}.evidence is required when CLOSED")

    focal_assets, degradable_assets, asset_key_issues = _validate_release_asset_keys(
        example_dir, release
    )
    issues.extend(asset_key_issues)
    source_fingerprint, verification, identity_issues = _validate_release_identity(
        example_dir, release, verification_candidate
    )
    issues.extend(identity_issues)

    evidence_tier = (
        demonstrated_tier
        if demonstrated_tier in PUBLICATION_TIERS
        else publication_tier
    )
    (
        visual_manifests,
        unbound_visual_manifests,
        verified_visual_manifest_hashes,
        verified_visual_runtime_paths,
        verified_target_ids,
        visual_manifest_issues,
    ) = _validate_visual_evidence_manifests(
        example_dir, release, evidence_tier, source_fingerprint
    )
    issues.extend(visual_manifest_issues)
    issues.extend(_validate_public_host(example_dir, release, source_fingerprint))

    if evidence_tier != "graybox":
        if "sourceInputManifest" not in release:
            issues.append(f"{prefix}: sourceInputManifest is required above graybox")
        else:
            issues.extend(
                _validate_source_input_manifest(
                    example_dir, release.get("sourceInputManifest"), source_fingerprint
                )
            )
        for field in unbound_visual_manifests:
            issues.append(
                f"{prefix}: {field}.sourceFingerprint is required above graybox"
            )
        if verification is not None:
            issues.extend(
                _validate_verification(example_dir, verification, source_fingerprint)
            )
        workspace_fingerprint = _workspace_app_fingerprint(example_dir)
        if (
            workspace_fingerprint is not None
            and workspace_fingerprint != source_fingerprint
        ):
            issues.append(
                f"{prefix}: current workspace app fingerprint does not match sourceFingerprint"
            )
    ledger_entries: dict[str, dict[str, object]] = {}
    ledger_path = example_dir / "build/asset-ledger.json"
    if ledger_path.is_file() or evidence_tier != "graybox":
        ledger_entries, ledger_issues = _validate_asset_ledger(example_dir)
        issues.extend(ledger_issues)

    progress_statuses = _progress_gate_statuses(example_dir / "_progress.md")
    for gate, statuses in progress_statuses.items():
        if len(statuses) > 1:
            issues.append(
                f"{example_dir.name}/_progress.md: gate:{gate} has conflicting statuses {sorted(statuses)}"
            )

    if promotion.get("status") == "PASS":
        issues.extend(_validate_evidence_list(
            example_dir,
            promotion.get("evidence"),
            "visualPromotion.evidence",
            required=True,
        ))

    if evidence_tier == "graybox":
        return issues

    for gate in all_gates:
        statuses = progress_statuses.get(gate, set())
        if statuses != {"PASS"}:
            issues.append(f"{example_dir.name}/_progress.md: missing unambiguous gate:{gate} pass")
        if gates.get(gate) != "PASS":
            issues.append(f"{prefix}: pipelineGates.{gate} must be PASS")
    if not source_fingerprint:
        issues.append(f"{prefix}: non-graybox tier requires sourceFingerprint")
    if verification is None:
        issues.append(f"{prefix}: non-graybox tier requires qa/verification.json")
    if not visual_manifests:
        issues.append(f"{prefix}: non-graybox tier requires visualEvidenceManifests")
    if promotion.get("status") != "PASS":
        issues.append(f"{prefix}: visualPromotion.status must be PASS")
    issues.extend(_validate_evidence_list(
        example_dir, promotion.get("evidence"), "visualPromotion.evidence", required=True
    ))
    issues.extend(
        _validate_promoted_visuals(
            example_dir,
            frames,
            frame_ids,
            review,
            defects,
            source_fingerprint,
            verified_visual_manifest_hashes,
            verified_visual_runtime_paths,
            verified_target_ids,
        )
    )
    issues.extend(
        _validate_promoted_assets(
            example_dir,
            evidence_tier,
            focal_assets,
            degradable_assets,
            ledger_entries,
        )
    )
    return issues

def validate_readme_publication_claims(root: Path) -> list[str]:
    """Keep public Featured/精选 claims aligned with example publication tiers."""
    issues: list[str] = []
    readme_slugs: dict[str, list[str]] = {}
    labels = {
        "README.md": {
            "graybox": ("graybox",),
            "playable-prototype": ("playable prototype",),
            "polished-vertical-slice": ("polished vertical slice",),
            "showcase": ("showcase", "featured"),
        },
        "README_ZH.md": {
            "graybox": ("灰盒",),
            "playable-prototype": ("可玩原型",),
            "polished-vertical-slice": ("精修垂直切片",),
            "showcase": ("精选", "展示"),
        },
    }
    for filename, marker in (("README.md", "featured"), ("README_ZH.md", "精选")):
        path = root / filename
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        readme_slugs[filename] = list(
            dict.fromkeys(re.findall(r"examples/([^/)]+)/?", text))
        )
        listing_match = re.search(
            r"^## (?:Play Online|在线试玩)\s*$\n(.*?)(?=^##\s|\Z)",
            text,
            flags=re.MULTILINE | re.DOTALL,
        )
        listing = listing_match.group(1) if listing_match else ""
        sections = re.split(r"(?=^###\s)", listing, flags=re.MULTILINE)
        for section in sections:
            heading = section.splitlines()[0] if section.splitlines() else ""
            section_slugs = list(dict.fromkeys(re.findall(r"examples/([^/)]+)/?", section)))
            if listing:
                for slug in section_slugs:
                    manifest, manifest_issues = _read_json_object(
                        root / "examples" / slug / EXAMPLE_MANIFEST,
                        f"examples/{slug}/{EXAMPLE_MANIFEST}",
                    )
                    issues.extend(manifest_issues)
                    if manifest is None:
                        continue
                    tier = manifest.get("publicationTier")
                    expected = labels[filename].get(str(tier), ())
                    if expected and not any(token in section.lower() for token in expected):
                        issues.append(
                            f"{filename}: public example {slug} must be labelled {tier}"
                        )
            if marker not in heading.lower():
                continue
            match = re.search(r"examples/([^/)]+)/?", section)
            if not match:
                issues.append(f"{filename}: Featured/精选 section has no example link")
                continue
            slug = match.group(1)
            manifest_path = root / "examples" / slug / EXAMPLE_MANIFEST
            manifest, manifest_issues = _read_json_object(
                manifest_path, f"examples/{slug}/{EXAMPLE_MANIFEST}"
            )
            issues.extend(manifest_issues)
            if manifest is not None and manifest.get("publicationTier") != "showcase":
                issues.append(
                    f"{filename}: Featured/精选 example {slug} must have publicationTier showcase"
                )
    if (
        "README.md" in readme_slugs
        and "README_ZH.md" in readme_slugs
        and readme_slugs["README.md"] != readme_slugs["README_ZH.md"]
    ):
        issues.append(
            "README.md and README_ZH.md: example link order must match; "
            f"english={readme_slugs['README.md']} chinese={readme_slugs['README_ZH.md']}"
        )
    return issues


def validate_example(
    example_dir: Path, verification_candidate: Path | None = None
) -> list[str]:
    if verification_candidate is None:
        raw_candidate = os.environ.get(VERIFICATION_CANDIDATE_ENV)
        if raw_candidate:
            environment_candidate = Path(raw_candidate)
            if not environment_candidate.is_absolute():
                environment_candidate = REPO_ROOT / environment_candidate
            environment_candidate = environment_candidate.resolve()
            expected_candidate = (
                example_dir / "qa/.verification-candidate.json"
            ).resolve()
            if (
                environment_candidate == expected_candidate
                and environment_candidate.is_file()
            ):
                verification_candidate = environment_candidate
    manifest, issues = read_manifest(example_dir)
    if manifest is None:
        return issues
    issues.extend(
        validate_publication(
            example_dir, str(manifest["publicationTier"]), verification_candidate
        )
    )
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


def validate_minimal_evidence_contract(root: Path) -> list[str]:
    """Guard the build/QA evidence handoff without parsing generated projects."""
    issues: list[str] = []
    for relative_path, markers in MINIMAL_EVIDENCE_REQUIREMENTS.items():
        path = root / relative_path
        if not path.is_file():
            issues.append(f"repository: missing evidence contract file {relative_path}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                issues.append(
                    f"{relative_path}: missing minimal evidence marker {marker!r}"
                )
    return issues


def validate_repository(
    root: Path, verification_candidate: Path | None = None
) -> list[str]:
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

    examples_root = root / "examples"
    actual_examples = visible_directories(examples_root)
    if not actual_examples:
        issues.append("repository: no examples found")
    for name in sorted(actual_examples):
        example_dir = examples_root / name
        candidate = (
            verification_candidate
            if verification_candidate is not None
            and verification_candidate.parent == example_dir / "qa"
            else None
        )
        issues.extend(validate_example(example_dir, candidate))
    issues.extend(validate_readme_publication_claims(root))

    for json_file in validation_json_files(root):
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            issues.append(f"{json_file.relative_to(root)}: invalid JSON: {error}")

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    issues.extend(validate_agent_adapters(root, version))
    issues.extend(validate_minimal_evidence_contract(root))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verification-candidate",
        type=Path,
        help="validate one hidden staged verification record before atomic publication",
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    candidate = args.verification_candidate
    if candidate is not None:
        candidate = candidate.resolve()
        try:
            relative = candidate.relative_to(root)
        except ValueError:
            print("FAIL: verification candidate must remain inside the repository")
            return 1
        if (
            len(relative.parts) != 4
            or relative.parts[0] != "examples"
            or relative.parts[2:] != ("qa", ".verification-candidate.json")
            or not candidate.is_file()
        ):
            print(
                "FAIL: verification candidate must be an existing "
                "examples/<slug>/qa/.verification-candidate.json"
            )
            return 1
    issues = validate_repository(root, candidate)
    if issues:
        for issue in issues:
            print(f"FAIL: {issue}")
        print(f"Validation failed with {len(issues)} issue(s).")
        return 1
    print(f"Validation passed: {len(EXPECTED_SKILLS)} skills checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
