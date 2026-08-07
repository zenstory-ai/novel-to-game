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
    "assuranceProfile",
    "demonstratedTier",
    "language",
    "source",
    "coverageHeading",
    "citationPattern",
    "publicationTier",
    "targetFinish",
}
SOURCE_REQUIRED = {"chapters", "headingPattern", "numeral"}
NUMERAL_KINDS = {"chinese", "arabic", "roman"}
PUBLICATION_TIERS = {
    "graybox",
    "playable-prototype",
    "polished-vertical-slice",
    "showcase",
}
FINISH_RANK = {
    tier: index
    for index, tier in enumerate(
        ("graybox", "playable-prototype", "polished-vertical-slice", "showcase")
    )
}
ASSURANCE_PROFILES = {"smoke", "delivery", "release"}
CORE_ASSURANCE_CHECKS = {
    "launch",
    "render",
    "input",
    "coreLoop",
    "outcome",
    "restart",
}
DELIVERY_ASSURANCE_CHECKS = {
    "targetRuntime",
    "targetDisplay",
    "onboarding",
}
RELEASE_ASSURANCE_CHECKS = {
    "performance",
    "requiredAssets",
    "independentPlaytest",
}
GATE_STATUSES = {"NOT_RUN", "FAIL", "PASS"}
FORBIDDEN_QA_METADATA = {
    "publichost",
    "releaseaudit",
    "releasegates",
    "sourcecommit",
    "sourceinputmanifest",
    "visualevidencemanifests",
}
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
        "语音资产台账",
        "request_sha256",
    ),
    "skills/game-build/SKILL.md": (
        "权威验证命令",
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
        "qa/verification.json",
        "clean start",
        "玩家可感知",
        "连续 3D",
        "静音/缺音",
    ),
    "skills/game-qa/references/qa-contract.md": (
        "目标运行环境",
        "NOT_RUN: reason",
        "同一次 complete run",
        "玩家实际体验",
        "损坏文件",
        "静音和缺音",
        # Narrative-track assertions. Without these, a text-driven build can pass QA
        # while its branches are unreachable and its flags are never read.
        "分支可达",
        "旗标被消费",
        "未选事实不串线",
        "人物知识边界",
        "回响存在",
        "结局区分",
    ),
    # --- Cross-genre rigor and the narrative track ------------------------------
    # Everything below has been deleted wholesale at least once by a refactor that
    # meant to help interactive fiction and instead removed the standards for every
    # genre. These markers make that class of regression fail the build instead of
    # passing silently. Each rule must keep BOTH its system-track form and its
    # narrative-track form: the fix for a text game is never to lower the bar for an
    # RPG, and never to exempt a text game from a bar an RPG has to clear.
    "skills/game-concept/references/concept-method.md": (
        "硬否决",
        "无先例",
        "无弧线",
        "因果权",
        "结算权",
        "能动性造假",
        "互动叙事这条线",
        "主干加瓶颈",
    ),
    "skills/game-concept/SKILL.md": (
        "同玩法",
        "三段弧",
        "experienceProfile",
        "成熟打法包含互动叙事",
        "能动性合同",
    ),
    "skills/game-world-design/SKILL.md": (
        "三段弧",
        "只写不读",
        "数值预算表",
        "决策深度示例",
        "品类保真",
        "能动性合同",
        "叙事承载附件",
        "narrative-design-method.md",
        "dialogue-design-method.md",
        "game-writing-craft.md",
    ),
    "skills/game-world-design/references/narrative-design-method.md": (
        "因果权",
        "结算权",
        "可跟随性四问",
        "巧合有方向性",
        "写入 → 第一次读取 → 延迟读取 → 玩家感知",
        "前提装置",
    ),
    "skills/game-world-design/references/dialogue-design-method.md": (
        "交换说话者测试",
        "世界事实",
        "未决推断",
        "禁科普嘴",
    ),
    "skills/game-world-design/references/numeric-design-method.md": (
        "只写不读",
        "隐藏旗标",
        "限制行动广度",
    ),
    "skills/game-world-design/references/world-design-method.md": (
        "血墙",
        "叙事承载时的对应说法",
    ),
    "skills/game-world-design/references/game-writing-craft.md": (
        "深度限知",
        "系统腔",
    ),
    "skills/novel-to-game/references/intake-benchmark-reference.md": (
        "互动叙事",
        "已核实",
        "主干加瓶颈",
    ),
    "skills/novel-game-analyze/references/gameability-protocol.md": (
        "知识权限图",
        "铺垫与回收表",
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
    for field in ("publicationTier", "demonstratedTier", "targetFinish"):
        if manifest.get(field) not in PUBLICATION_TIERS:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: {field} must be one of "
                f"{sorted(PUBLICATION_TIERS)}"
            )
    publication = manifest.get("publicationTier")
    demonstrated = manifest.get("demonstratedTier")
    target = manifest.get("targetFinish")
    if all(value in FINISH_RANK for value in (publication, demonstrated, target)):
        if FINISH_RANK[publication] > FINISH_RANK[demonstrated]:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: publicationTier exceeds demonstratedTier"
            )
        if FINISH_RANK[demonstrated] > FINISH_RANK[target]:
            issues.append(
                f"{example_dir.name}/{EXAMPLE_MANIFEST}: demonstratedTier exceeds targetFinish"
            )
    if manifest.get("assuranceProfile") not in ASSURANCE_PROFILES:
        issues.append(
            f"{example_dir.name}/{EXAMPLE_MANIFEST}: assuranceProfile must be one of "
            f"{sorted(ASSURANCE_PROFILES)}"
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


def _forbidden_qa_metadata(value: object, path: str = "") -> list[str]:
    issues: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            normalized = re.sub(r"[^a-z0-9]", "", key.lower())
            if (
                normalized in FORBIDDEN_QA_METADATA
                or "fingerprint" in normalized
                or normalized.endswith("sha256")
            ):
                issues.append(child_path)
            issues.extend(_forbidden_qa_metadata(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            issues.extend(_forbidden_qa_metadata(child, f"{path}[{index}]"))
    return issues


def validate_assurance(
    example_dir: Path,
    profile: str,
) -> list[str]:
    """Validate the compact, player-effect-only assurance contract.

    Every profile uses schema v2 and cumulatively checks player-visible effects.
    """
    label = f"{example_dir.name}/qa/verification.json"
    issues: list[str] = []
    if profile not in ASSURANCE_PROFILES:
        return [f"{example_dir.name}: unknown assurance profile {profile!r}"]

    verification_path = example_dir / "qa/verification.json"
    verification, verification_issues = _read_json_object(verification_path, label)
    issues.extend(verification_issues)
    if verification is None:
        return issues

    if (example_dir / "qa/release-gates.json").exists():
        issues.append(f"{example_dir.name}/qa/release-gates.json: separate QA gate files are not allowed")
    for path in _forbidden_qa_metadata(verification):
        issues.append(f"{label}: {path} is not player-effect QA metadata")

    schema_version = verification.get("schemaVersion")
    if schema_version != 2:
        issues.append(f"{label}: assurance requires schemaVersion 2")
        return issues

    if verification.get("assuranceProfile") != profile:
        issues.append(f"{label}: assuranceProfile must match example.json")
    status = verification.get("status")
    if status not in GATE_STATUSES:
        issues.append(f"{label}: status must be one of {sorted(GATE_STATUSES)}")
    elif status != "PASS":
        issues.append(f"{label}: status must PASS for the current assurance profile")

    verify = verification.get("verify")
    if not isinstance(verify, dict):
        issues.append(f"{label}: verify must be an object")
    else:
        if not isinstance(verify.get("command"), str) or not verify["command"].strip():
            issues.append(f"{label}: verify.command must be non-empty")
        if verify.get("exitCode") != 0:
            issues.append(f"{label}: verify.exitCode must be 0")

    complete_run = verification.get("completeRun")
    if not isinstance(complete_run, dict):
        issues.append(f"{label}: completeRun must be an object")
    else:
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
    required = set(CORE_ASSURANCE_CHECKS)
    if profile in {"delivery", "release"}:
        required.update(DELIVERY_ASSURANCE_CHECKS)
    if profile == "release":
        required.update(RELEASE_ASSURANCE_CHECKS)
    for name in sorted(required):
        check = checks.get(name)
        if not isinstance(check, dict):
            issues.append(f"{label}: checks.{name} must be an object")
            continue
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

    # Checks beyond the required set are how a project records its own concept promises
    # (narrative-led builds add branch reachability, flag consumption, and so on). They
    # were previously ignored entirely, so a declared check could sit at FAIL while the
    # file still claimed an overall PASS. Anything declared has to bind.
    for name in sorted(set(checks) - required):
        check = checks.get(name)
        if not isinstance(check, dict):
            issues.append(f"{label}: checks.{name} must be an object")
            continue
        check_status = check.get("status")
        if check_status not in GATE_STATUSES:
            issues.append(
                f"{label}: checks.{name}.status must be one of {sorted(GATE_STATUSES)}"
            )
        elif check_status == "FAIL" and status == "PASS":
            issues.append(
                f"{label}: checks.{name} is FAIL, so the overall status cannot PASS"
            )
        evidence = check.get("evidence")
        if check_status == "PASS" and (not isinstance(evidence, list) or not evidence):
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
            for key in ("scope", "reason"):
                if not isinstance(limitation.get(key), str) or not limitation[key].strip():
                    issues.append(f"{label}: {field}.{key} must be non-empty")
            blocks = limitation.get("blocksProfiles")
            if not isinstance(blocks, list) or any(
                value not in ASSURANCE_PROFILES for value in blocks
            ):
                issues.append(
                    f"{label}: {field}.blocksProfiles must contain assurance profiles"
                )
            elif status == "PASS" and profile in blocks:
                issues.append(f"{label}: {field} blocks current profile {profile}")

    return issues


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
                f"{example_dir.name}/{relative}: targetFinish must match example.json"
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
                    f"{example_dir.name}/{relative}: targetFinish must match example.json"
                )
    return issues


def _validate_build_finish_states(
    example_dir: Path,
    publication_tier: object,
    demonstrated_tier: object,
) -> list[str]:
    path = example_dir / "build/BUILD_BRIEF.md"
    if not path.is_file():
        return [f"{example_dir.name}/build/BUILD_BRIEF.md: missing finish states"]
    text = path.read_text(encoding="utf-8")
    issues: list[str] = []
    for field, expected_value in (
        ("publicationTier", publication_tier),
        ("demonstratedTier", demonstrated_tier),
    ):
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
            issues.append(f"{label}: {field} must match example.json")
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


def validate_example(example_dir: Path) -> list[str]:
    manifest, issues = read_manifest(example_dir)
    if manifest is None:
        return issues
    assurance_profile = str(manifest["assuranceProfile"])
    target_finish = str(manifest["targetFinish"])
    demonstrated_tier = str(manifest["demonstratedTier"])
    publication_tier = str(manifest["publicationTier"])
    issues.extend(
        _validate_target_finish_inheritance(
            example_dir, target_finish, demonstrated_tier
        )
    )
    issues.extend(
        _validate_build_finish_states(
            example_dir, publication_tier, demonstrated_tier
        )
    )
    issues.extend(validate_assurance(example_dir, assurance_profile))
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


# A marker string proves a rule was not deleted. It does not prove the rule still bites:
# a refactor can keep every heading and hollow out the body. These checks assert on the
# *shape* of the highest-value rules, so "narrative projects may skip this" fails the build
# the same way deleting the section does.
# Phrases that GRANT an exemption. Deliberately not the bare word 豁免 — the rules
# legitimately use it to deny one ("文学契合度不构成豁免"), and a substring check cannot
# tell the two apart.
ESCAPE_HATCH_PHRASES = (
    "豁免本条",
    "可以豁免",
    "本条豁免",
    "可跳过",
    "可略过",
    "不适用本条",
    "无需提供",
    "自行判断",
    "不强制取证",
    "写个大概",
    # Self-attestation: the rule survives as a sentence but stops being falsifiable.
    "自己把握",
    "自行把握",
    "团队自己",
    "就满足本条",
    "不必照搬",
)
# Blocklists are enumerable and therefore evadable. Where a rule's whole value is one
# falsifiable predicate, assert that the predicate itself is still there: a paraphrase
# into "the team confirms an arc exists" has to delete these words to succeed, whereas
# it can dodge any phrase list. Keyed by veto name -> words the test cannot lose.
VETO_FALSIFIABLE_PREDICATES = {
    "无弧线": ("可达空间", ("从头到尾不变", "与第一拍相同")),
    "无先例": ("已发行", ("≥2", ">=2")),
}
# The narrative track is an alternative judging criterion, never an exemption. Every place
# that introduces one must say what replaces the system-track criterion.
NARRATIVE_SWITCH_MARKERS = ("**叙事主导取**", "叙事主导形态")
NARRATIVE_SWITCH_REQUIRED = ("换成", "改取", "同判", "同样", "同一", "取其一")
# GAME_DESIGN checklist items whose criterion differs by track. Binding the check to the
# item — rather than to a character window after a marker — is what stops an exemption from
# hiding a few sentences away, and makes deleting the narrative clause fail like any other
# deleted rule. Keyed by the item's leading text so renumbering does not silently disarm it.
TRACK_SPLIT_CHECKLIST_ITEMS = (
    "三段弧",
    "世界规则与状态",
    "数值预算表",
    "决策深度示例",
    "品类保真",
    "关卡节拍",
)
NUMBERED_ITEM_RE = re.compile(r"^(\d+)\.\s", re.MULTILINE)


def _numbered_items(section: str) -> list[str]:
    """Split a markdown ordered list into one string per item, continuations included."""
    boundaries = [match.start() for match in NUMBERED_ITEM_RE.finditer(section)]
    if not boundaries:
        return []
    boundaries.append(len(section))
    return [
        section[boundaries[index] : boundaries[index + 1]]
        for index in range(len(boundaries) - 1)
    ]


def validate_rule_shape(root: Path) -> list[str]:
    """Reject hollowed-out rules that still contain their marker strings.

    A marker proves a rule was not deleted; it does not prove the rule still bites.

    Scope, stated honestly so nobody over-trusts this: these checks catch the shapes a
    hollowing regression has actually taken here — granting an exemption in recognizable
    words, and dropping a track's clause from a checklist item. They cannot catch a
    paraphrase that keeps the marker while turning a falsifiable test into a
    self-attestation ("团队确认弧线成立即可"), because that needs a reader, not a
    substring. A determined author can always evade a phrase list. Treat this as a floor
    against silent drift; the real gate is the design-stage acceptance checklist and human
    review of the diff.
    """
    issues: list[str] = []

    design_path = "skills/game-world-design/SKILL.md"
    design = root / design_path
    if design.is_file():
        output_section = markdown_section(design.read_text(encoding="utf-8"), "输出")
        if output_section is None:
            issues.append(f"{design_path}: missing 输出 checklist")
        else:
            items = _numbered_items(output_section)
            for name in TRACK_SPLIT_CHECKLIST_ITEMS:
                body = next((item for item in items if name in item[:40]), None)
                if body is None:
                    issues.append(
                        f"{design_path}: 输出 checklist is missing the {name!r} item"
                    )
                    continue
                if not any(marker in body for marker in NARRATIVE_SWITCH_MARKERS):
                    issues.append(
                        f"{design_path}: checklist item {name!r} must state its "
                        "narrative-track form, not only the system-track one"
                    )
                elif not any(word in body for word in NARRATIVE_SWITCH_REQUIRED):
                    issues.append(
                        f"{design_path}: checklist item {name!r} must name the "
                        "replacing criterion, not merely announce a switch"
                    )
                for phrase in ESCAPE_HATCH_PHRASES:
                    if phrase in body:
                        issues.append(
                            f"{design_path}: checklist item {name!r} must not grant "
                            f"an exemption ({phrase!r})"
                        )

    # Hard vetoes are the concept gate. An exempted veto is a deleted veto.
    method_path = "skills/game-concept/references/concept-method.md"
    method = root / method_path
    if method.is_file():
        veto_section = markdown_section(method.read_text(encoding="utf-8"), "硬否决")
        if veto_section is None:
            issues.append(f"{method_path}: missing 硬否决 section")
        else:
            for phrase in ESCAPE_HATCH_PHRASES:
                if phrase in veto_section:
                    issues.append(
                        f"{method_path}: 硬否决 must not grant an exemption ({phrase!r})"
                    )
            for veto, (required, alternatives) in VETO_FALSIFIABLE_PREDICATES.items():
                bullet = next(
                    (
                        item
                        for item in veto_section.split("\n- ")
                        if item.strip().removeprefix("- ").startswith(f"**{veto}**")
                    ),
                    None,
                )
                if bullet is None:
                    issues.append(f"{method_path}: 硬否决 is missing the {veto!r} veto")
                    continue
                if required not in bullet or not any(
                    alternative in bullet for alternative in alternatives
                ):
                    issues.append(
                        f"{method_path}: the {veto!r} veto lost its falsifiable test "
                        f"(needs {required!r} plus one of {alternatives!r})"
                    )

    # The precedent table exists to supply citable evidence. A bare 已核实 substring is
    # satisfied forever by the file's own disclaimer sentence, so assert the tag form.
    benchmark = root / "skills/novel-to-game/references/intake-benchmark-reference.md"
    if benchmark.is_file():
        tagged = benchmark.read_text(encoding="utf-8").count("·**已核实**")
        if tagged < 5:
            issues.append(
                "skills/novel-to-game/references/intake-benchmark-reference.md: "
                f"expected at least 5 '·**已核实**' tagged figures, found {tagged}"
            )
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

    examples_root = root / "examples"
    actual_examples = visible_directories(examples_root)
    if not actual_examples:
        issues.append("repository: no examples found")
    for name in sorted(actual_examples):
        example_dir = examples_root / name
        issues.extend(validate_example(example_dir))
    issues.extend(validate_readme_publication_claims(root))

    for json_file in validation_json_files(root):
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            issues.append(f"{json_file.relative_to(root)}: invalid JSON: {error}")

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    issues.extend(validate_agent_adapters(root, version))
    issues.extend(validate_minimal_evidence_contract(root))
    issues.extend(validate_rule_shape(root))
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
