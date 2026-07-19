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
EXPECTED_EXAMPLES = {"journey-to-the-west"}
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


def extract_chapters(source: Path) -> list[tuple[int, str, int]]:
    chapters: list[tuple[int, str, int]] = []
    for line_number, line in enumerate(
        source.read_text(encoding="utf-8").splitlines(), start=1
    ):
        match = CHAPTER_HEADING_RE.match(line)
        if match:
            chapters.append(
                (parse_chinese_number(match.group(1)), match.group(2), line_number)
            )
    return chapters


def markdown_section(text: str, heading: str) -> str | None:
    matches = list(LEVEL_TWO_HEADING_RE.finditer(text))
    for index, match in enumerate(matches):
        if match.group(1) != heading:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        return text[match.end() : end].strip()
    return None


def chapter_citation_coverage(text: str) -> set[int]:
    coverage: set[int] = set()
    for match in CHAPTER_CITATION_RE.finditer(text):
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
    if not frontmatter.get("description"):
        issues.append(f"{skill_dir.name}: missing description")
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


def validate_example(example_dir: Path) -> list[str]:
    issues: list[str] = []
    actual_planning_files = {
        path.relative_to(example_dir).as_posix()
        for directory in ("analysis", "concepts", "design", "build")
        if (example_dir / directory).is_dir()
        for path in (example_dir / directory).iterdir()
        if path.is_file()
    }
    if actual_planning_files != EXAMPLE_PLANNING_FILES:
        issues.append(
            f"{example_dir.name}: planning artifact mismatch; "
            f"missing={sorted(EXAMPLE_PLANNING_FILES - actual_planning_files)} "
            f"extra={sorted(actual_planning_files - EXAMPLE_PLANNING_FILES)}"
        )

    source_dir = example_dir / "source"
    if not (source_dir / "SOURCE.md").is_file():
        issues.append(f"{example_dir.name}: missing source/SOURCE.md")
    source_texts = sorted(source_dir.glob("*.txt")) if source_dir.is_dir() else []
    if len(source_texts) != 1:
        issues.append(f"{example_dir.name}: expected exactly one source text")
        return issues

    chapters = extract_chapters(source_texts[0])
    chapter_numbers = [chapter[0] for chapter in chapters]
    if chapter_numbers != list(range(1, 101)):
        issues.append(
            f"{example_dir.name}: source must contain consecutive chapters 1-100"
        )
        return issues

    known_chapters = set(chapter_numbers)
    source_bible = example_dir / "analysis/SOURCE_BIBLE.md"
    if source_bible.is_file():
        coverage_section = markdown_section(
            source_bible.read_text(encoding="utf-8"), "全书覆盖"
        )
        if coverage_section is None:
            issues.append(f"{example_dir.name}: source bible missing full-book coverage")
        else:
            coverage = chapter_citation_coverage(coverage_section)
            missing = known_chapters - coverage
            extra = coverage - known_chapters
            if missing or extra:
                issues.append(
                    f"{example_dir.name}: source bible chapter coverage mismatch; "
                    f"missing={sorted(missing)} extra={sorted(extra)}"
                )

    for relative_path in sorted(EXAMPLE_PLANNING_FILES & actual_planning_files):
        markdown = example_dir / relative_path
        for match in CHAPTER_CITATION_RE.finditer(markdown.read_text(encoding="utf-8")):
            first = int(match.group(1))
            last = int(match.group(2) or first)
            if first > last or any(
                chapter not in known_chapters for chapter in range(first, last + 1)
            ):
                issues.append(
                    f"{example_dir.name}: invalid chapter citation "
                    f"{match.group(0)} in {relative_path}"
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
    for required in ("README.md", "README_EN.md", "LICENSE", "AGENTS.md", "VERSION"):
        if not (root / required).is_file():
            issues.append(f"repository: missing {required}")

    skills_root = root / "skills"
    actual = {path.name for path in skills_root.iterdir() if path.is_dir()}
    if actual != EXPECTED_SKILLS:
        issues.append(
            "repository: skill set mismatch; "
            f"missing={sorted(EXPECTED_SKILLS - actual)} extra={sorted(actual - EXPECTED_SKILLS)}"
        )
    for name in sorted(EXPECTED_SKILLS & actual):
        issues.extend(validate_skill(skills_root / name))

    examples_root = root / "examples"
    actual_examples = {path.name for path in examples_root.iterdir() if path.is_dir()}
    if actual_examples != EXPECTED_EXAMPLES:
        issues.append(
            "repository: example set mismatch; "
            f"missing={sorted(EXPECTED_EXAMPLES - actual_examples)} "
            f"extra={sorted(actual_examples - EXPECTED_EXAMPLES)}"
        )
    for name in sorted(EXPECTED_EXAMPLES & actual_examples):
        issues.extend(validate_example(examples_root / name))

    for json_file in root.rglob("*.json"):
        try:
            json.loads(json_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            issues.append(f"{json_file.relative_to(root)}: invalid JSON: {error}")

    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    issues.extend(validate_agent_adapters(root, version))
    return issues


def main() -> int:
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
