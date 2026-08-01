from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_repo import (  # noqa: E402
    EXAMPLE_MANIFEST,
    EXAMPLE_PLANNING_FILES,
    MINIMAL_EVIDENCE_REQUIREMENTS,
    OPTIONAL_PLANNING_FILES,
    EXPECTED_SKILLS,
    ORCHESTRATOR_SKILL,
    OUTPUT_LANGUAGE_RULE,
    PLUGIN_MANIFESTS,
    chapter_citation_coverage,
    extract_chapters,
    manifest_skill_root,
    markdown_section,
    parse_frontmatter,
    parse_numeral,
    read_manifest,
    validate_example,
    validate_minimal_evidence_contract,
    validate_repository,
    validate_skill,
    validation_json_files,
    visible_directories,
)


class RepositoryValidationTests(unittest.TestCase):
    def test_repository_contract_is_valid(self) -> None:
        self.assertEqual(validate_repository(ROOT), [])

    def test_community_contribution_surface_is_complete(self) -> None:
        required_markers = {
            "CONTRIBUTING.md": [
                "python3 scripts/validate_repo.py",
                "python3 -m unittest discover -s tests -v",
                "source and asset provenance",
                "NOT_RUN: <reason>",
            ],
            ".github/ISSUE_TEMPLATE/config.yml": [
                "blank_issues_enabled: false",
                "/discussions",
            ],
            ".github/ISSUE_TEMPLATE/bug_report.yml": [
                "Minimal reproduction",
                "Environment",
                "Evidence",
            ],
            ".github/ISSUE_TEMPLATE/skill_gap.yml": [
                "Reusable adaptation judgment",
                "Acceptance evidence",
                "Scope boundaries",
            ],
            ".github/ISSUE_TEMPLATE/example_proposal.yml": [
                "Rights and redistribution",
                "Distinct learning value",
                "Complete vertical slice",
                "Evidence plan",
            ],
            ".github/pull_request_template.md": [
                "Source and asset provenance",
                "Risks and untested scope",
                "README.md` and `README_EN.md",
            ],
        }
        for relative_path, markers in required_markers.items():
            with self.subTest(path=relative_path):
                content = (ROOT / relative_path).read_text(encoding="utf-8")
                for marker in markers:
                    self.assertIn(marker, content)

    def test_skill_validator_rejects_todo_and_broken_link(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            skill = Path(temporary) / "demo"
            (skill / "agents").mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: demo\ndescription: demo\n---\n"
                "# Demo\n\nTODO\n\n[missing](references/missing.md)\n",
                encoding="utf-8",
            )
            (skill / "agents/openai.yaml").write_text(
                'interface:\n  default_prompt: "Use $demo."\n', encoding="utf-8"
            )
            issues = validate_skill(skill)
            self.assertTrue(any("unresolved TODO" in issue for issue in issues))
            self.assertTrue(any("broken link" in issue for issue in issues))

    def test_skill_validator_rejects_cross_skill_link(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = root / "demo"
            other = root / "other.md"
            (skill / "agents").mkdir(parents=True)
            other.write_text("# Other\n", encoding="utf-8")
            (skill / "SKILL.md").write_text(
                "---\nname: demo\ndescription: demo\n---\n"
                "# Demo\n\n[other](../other.md)\n",
                encoding="utf-8",
            )
            (skill / "agents/openai.yaml").write_text(
                'interface:\n  default_prompt: "Use $demo."\n', encoding="utf-8"
            )
            self.assertTrue(
                any("link leaves skill" in issue for issue in validate_skill(skill))
            )

    def test_minimal_evidence_contract_rejects_each_missing_marker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative_path, markers in MINIMAL_EVIDENCE_REQUIREMENTS.items():
                path = root / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("\n".join(markers), encoding="utf-8")

            self.assertEqual(validate_minimal_evidence_contract(root), [])

            cases = {
                "target runtime": (
                    "skills/game-build/references/build-brief-contract.md",
                    "targetRuntime:",
                ),
                "tested runtime": (
                    "skills/game-build/references/build-brief-contract.md",
                    "testedRuntime:",
                ),
                "runtime version": (
                    "skills/game-build/references/build-brief-contract.md",
                    "runtimeVersion:",
                ),
                "authoritative verify": (
                    "skills/game-build/references/build-brief-contract.md",
                    "verify:",
                ),
                "orphaned suite severity": (
                    "skills/game-qa/SKILL.md",
                    "ORPHANED_TEST_SUITE",
                ),
                "evidence channel boundary": (
                    "skills/game-qa/references/qa-contract.md",
                    "NOT_RUN: reason",
                ),
                "platform-aware QA": (
                    "skills/game-qa/references/qa-contract.md",
                    "目标运行环境",
                ),
            }
            for label, (relative_path, marker) in cases.items():
                path = root / relative_path
                original = path.read_text(encoding="utf-8")
                path.write_text(original.replace(marker, ""), encoding="utf-8")
                with self.subTest(requirement=label):
                    issues = validate_minimal_evidence_contract(root)
                    self.assertTrue(
                        any(marker in issue for issue in issues), issues
                    )
                path.write_text(original, encoding="utf-8")

    def test_minimal_evidence_fixture_runs_one_complete_verification(self) -> None:
        fixture = ROOT / "tests/fixtures/minimal-evidence"
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary) / "project"
            shutil.copytree(fixture, project)
            environment = os.environ.copy()
            environment["SOURCE_COMMIT"] = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            result = subprocess.run(
                [sys.executable, "verify.py"],
                cwd=project,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            verification = json.loads(
                (project / "qa/verification.json").read_text(encoding="utf-8")
            )
            self.assertEqual(verification["sourceCommit"], environment["SOURCE_COMMIT"])
            recorded_environment = verification["environment"]
            self.assertEqual(
                recorded_environment["targetPlatform"], "desktop command line"
            )
            self.assertEqual(
                recorded_environment["targetRuntime"],
                "CPython command-line process",
            )
            self.assertEqual(
                recorded_environment["testedRuntime"],
                recorded_environment["targetRuntime"],
            )
            self.assertEqual(verification["verify"]["exitCode"], 0)
            self.assertTrue(
                all(suite["executed"] for suite in verification["verify"]["suites"])
            )
            complete_run = verification["completeRun"]
            self.assertTrue(complete_run["cleanContext"])
            self.assertEqual(complete_run["terminal"], "extracted_with_proof")
            self.assertEqual(complete_run["restart"], "initial_state")
            self.assertGreaterEqual(len(complete_run["steps"]), 3)
            self.assertTrue((project / verification["verify"]["log"]).is_file())
            checkpoint_ids = {
                checkpoint["id"] for checkpoint in verification["checkpoints"]
            }
            self.assertEqual(
                {step["checkpoint"] for step in complete_run["steps"]},
                checkpoint_ids,
            )

            for checkpoint in verification["checkpoints"]:
                self.assertNotIn("browser", checkpoint)
                for channel in ("state", "runtime", "visual"):
                    evidence = checkpoint[channel]
                    if evidence.startswith("NOT_RUN: "):
                        self.assertGreater(len(evidence.removeprefix("NOT_RUN: ")), 0)
                    else:
                        self.assertTrue((project / evidence).is_file(), evidence)

    def test_minimal_evidence_fixture_reports_an_orphaned_suite(self) -> None:
        fixture = ROOT / "tests/fixtures/minimal-evidence"
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary) / "project"
            shutil.copytree(fixture, project)
            orphan = project / "tests/test_orphan.py"
            orphan.write_text(
                "import unittest\n\n"
                "class OrphanTest(unittest.TestCase):\n"
                "    def test_unregistered(self):\n"
                "        self.assertTrue(True)\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, "verify.py"],
                cwd=project,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ORPHANED_TEST_SUITE", result.stdout + result.stderr)

    def test_native_plugins_expose_one_shared_skill_bundle(self) -> None:
        for relative_path in PLUGIN_MANIFESTS:
            manifest = json.loads((ROOT / relative_path).read_text(encoding="utf-8"))
            skill_root = manifest_skill_root(manifest)
            self.assertIsNotNone(skill_root)
            exposed = {
                path.name
                for path in (ROOT / str(skill_root)).iterdir()
                if path.is_dir()
            }
            self.assertEqual(exposed, EXPECTED_SKILLS)

        marketplace = json.loads(
            (ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8")
        )
        self.assertEqual(len(marketplace["plugins"]), 1)
        self.assertEqual(marketplace["plugins"][0]["name"], "novel-to-game")

    def test_repo_local_discovery_resolves_the_same_skill_set(self) -> None:
        generic_root = (ROOT / ".agents/skills").resolve()
        self.assertEqual(generic_root, (ROOT / "skills").resolve())

        claude_root = ROOT / ".claude/skills"
        self.assertEqual({path.name for path in claude_root.iterdir()}, EXPECTED_SKILLS)
        for link in claude_root.iterdir():
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.resolve().parent, (ROOT / "skills").resolve())

    def test_examples_use_compact_planning_artifacts(self) -> None:
        examples = visible_directories(ROOT / "examples")
        self.assertTrue(examples, "no examples found")

        for name in sorted(examples):
            example = ROOT / "examples" / name
            with self.subTest(example=name):
                # 逐个目录判存在:缺目录是"这个阶段还没跑"的正常中间态,应当汇报成
                # 缺哪几份文件,而不是让 iterdir 抛 FileNotFoundError——那条报错既不
                # 说明缺什么,也盖住了同一个示例其他目录的问题。
                actual = {
                    path.relative_to(example).as_posix()
                    for directory in ("analysis", "concepts", "design", "build")
                    if (example / directory).is_dir()
                    for path in (example / directory).iterdir()
                    if path.is_file()
                }
                # `analysis/_coverage.md` is contract-required but the two older
                # examples predate the rule: allowed, not demanded.
                self.assertEqual(actual - OPTIONAL_PLANNING_FILES, EXAMPLE_PLANNING_FILES)

    def test_example_source_and_citations_are_structurally_valid(self) -> None:
        for name in sorted(visible_directories(ROOT / "examples")):
            example = ROOT / "examples" / name
            with self.subTest(example=name):
                manifest, issues = read_manifest(example)
                self.assertEqual(issues, [])
                spec = manifest["source"]
                source = next((example / "source").glob("*.txt"))
                chapters = extract_chapters(
                    source, re.compile(spec["headingPattern"]), spec["numeral"]
                )

                self.assertEqual(
                    [chapter[0] for chapter in chapters],
                    list(range(1, int(spec["chapters"]) + 1)),
                )
                # 回目标题是章回体的惯例，不是通例：英文原著常见「Chapter 5」无标题。
                # 只有当 headingPattern 显式捕获了标题组时才要求每章有标题。
                if re.compile(spec["headingPattern"]).groups >= 2:
                    self.assertTrue(all(chapter[1].strip() for chapter in chapters))
                self.assertEqual(
                    [chapter[2] for chapter in chapters],
                    sorted(chapter[2] for chapter in chapters),
                )
                self.assertEqual(validate_example(example), [])

    def test_example_source_bible_accounts_for_every_source_chapter(self) -> None:
        for name in sorted(visible_directories(ROOT / "examples")):
            example = ROOT / "examples" / name
            with self.subTest(example=name):
                manifest, issues = read_manifest(example)
                self.assertEqual(issues, [])
                spec = manifest["source"]
                source = next((example / "source").glob("*.txt"))
                known_chapters = {
                    number
                    for number, _, _ in extract_chapters(
                        source, re.compile(spec["headingPattern"]), spec["numeral"]
                    )
                }
                source_bible = (example / "analysis/SOURCE_BIBLE.md").read_text(
                    encoding="utf-8"
                )

                coverage_section = markdown_section(
                    source_bible, manifest["coverageHeading"]
                )
                self.assertIsNotNone(coverage_section)
                self.assertEqual(
                    chapter_citation_coverage(
                        coverage_section or "", re.compile(manifest["citationPattern"])
                    ),
                    known_chapters,
                )

    def test_numeral_parsing_covers_every_declared_kind(self) -> None:
        self.assertEqual(parse_numeral("一百", "chinese"), 100)
        self.assertEqual(parse_numeral("三十七", "chinese"), 37)
        self.assertEqual(parse_numeral("24", "arabic"), 24)
        self.assertEqual(parse_numeral("XXIV", "roman"), 24)
        self.assertEqual(parse_numeral("iv", "roman"), 4)

    def test_manifest_validator_rejects_a_bad_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = Path(temporary) / "demo"
            example.mkdir()
            self.assertTrue(any(EXAMPLE_MANIFEST in issue for issue in read_manifest(example)[1]))
            (example / EXAMPLE_MANIFEST).write_text("{not json", encoding="utf-8")
            self.assertTrue(any("invalid JSON" in issue for issue in read_manifest(example)[1]))
            (example / EXAMPLE_MANIFEST).write_text(
                json.dumps({
                    "language": "en",
                    "source": {"chapters": 24, "headingPattern": "^Chapter ([0-9]+)$", "numeral": "hex"},
                    "coverageHeading": "Full-book coverage",
                    "citationPattern": "chapter ([0-9]+)",
                }),
                encoding="utf-8",
            )
            self.assertTrue(any("numeral must be one of" in issue for issue in read_manifest(example)[1]))
            (example / EXAMPLE_MANIFEST).write_text(
                json.dumps({
                    "language": "en",
                    "source": {"chapters": 24, "headingPattern": "^Chapter ([0-9+$", "numeral": "arabic"},
                    "coverageHeading": "Full-book coverage",
                    "citationPattern": "chapter ([0-9]+)",
                }),
                encoding="utf-8",
            )
            self.assertTrue(any("headingPattern" in issue for issue in read_manifest(example)[1]))

    def test_visible_directories_skips_agent_state_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "journey-to-the-west").mkdir()
            (root / ".omc").mkdir()
            (root / "notes.md").write_text("", encoding="utf-8")
            self.assertEqual(visible_directories(root), {"journey-to-the-west"})

    def test_repository_json_scan_skips_generated_dependency_trees(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "build").mkdir()
            (root / "build/asset-ledger.json").write_text("{}", encoding="utf-8")
            (root / "build/app/node_modules/package/dist").mkdir(parents=True)
            (root / "build/app/node_modules/package/dist/metadata.json").write_text(
                "not repository json", encoding="utf-8"
            )
            (root / "build/app/dist").mkdir(parents=True)
            (root / "build/app/dist/chunk.json").write_text(
                "generated output", encoding="utf-8"
            )
            (root / ".omx/state").mkdir(parents=True)
            (root / ".omx/state/runtime.json").write_text(
                "operator state", encoding="utf-8"
            )

            self.assertEqual(
                [path.relative_to(root).as_posix() for path in validation_json_files(root)],
                ["build/asset-ledger.json"],
            )

    def test_every_skill_description_leads_with_english(self) -> None:
        for name in sorted(EXPECTED_SKILLS):
            with self.subTest(skill=name):
                description = parse_frontmatter(
                    (ROOT / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
                )["description"]
                self.assertTrue(
                    description[0].isascii() and description[0].isalpha(),
                    f"{name}: description must lead with English, got {description[:24]!r}",
                )

    def test_downstream_skills_restate_the_output_language_rule(self) -> None:
        for name in sorted(EXPECTED_SKILLS - {ORCHESTRATOR_SKILL}):
            with self.subTest(skill=name):
                body = (ROOT / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn(OUTPUT_LANGUAGE_RULE, body)

    def test_plugin_manifest_descriptions_lead_with_english(self) -> None:
        for relative_path in sorted(PLUGIN_MANIFESTS):
            with self.subTest(manifest=relative_path):
                manifest = json.loads(
                    (ROOT / relative_path).read_text(encoding="utf-8")
                )
                self.assertTrue(manifest["description"][0].isascii())

        marketplace = json.loads(
            (ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8")
        )
        self.assertTrue(marketplace["metadata"]["description"][0].isascii())
        self.assertTrue(marketplace["plugins"][0]["description"][0].isascii())

    def test_public_product_copy_does_not_limit_the_pipeline_to_web_games(self) -> None:
        surfaces = {
            "README.md": (ROOT / "README.md").read_text(encoding="utf-8"),
            "README_EN.md": (ROOT / "README_EN.md").read_text(encoding="utf-8"),
        }
        for relative_path in sorted(PLUGIN_MANIFESTS):
            manifest = json.loads((ROOT / relative_path).read_text(encoding="utf-8"))
            surfaces[f"{relative_path}:description"] = manifest["description"]
        marketplace = json.loads(
            (ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8")
        )
        surfaces["marketplace:metadata"] = marketplace["metadata"]["description"]
        surfaces["marketplace:plugin"] = marketplace["plugins"][0]["description"]
        for name in ("novel-to-game", "game-build", "game-qa"):
            skill = ROOT / "skills" / name
            surfaces[f"{name}:description"] = parse_frontmatter(
                (skill / "SKILL.md").read_text(encoding="utf-8")
            )["description"]
            surfaces[f"{name}:default_prompt"] = (
                skill / "agents" / "openai.yaml"
            ).read_text(encoding="utf-8")

        web_only_phrases = ("playable web game", "web game prototype", "网页游戏")
        for surface, copy in surfaces.items():
            with self.subTest(surface=surface):
                lowered = copy.lower()
                for phrase in web_only_phrases:
                    self.assertNotIn(phrase, lowered)

    def test_in_development_asset_ledgers_reference_existing_evidence(self) -> None:
        missing_evidence = []
        ledgers = sorted(
            (ROOT / "game-adaptations").glob("*/build/asset-ledger.json")
        )
        for ledger in ledgers:
            data = json.loads(ledger.read_text(encoding="utf-8"))
            for entry in data.get("entries", []):
                for target in entry.get("evidence", []):
                    if "://" in target:
                        continue
                    if not (ledger.parent / target).is_file():
                        missing_evidence.append(
                            f"{ledger.relative_to(ROOT)}:{entry.get('key')} -> {target}"
                        )

        self.assertEqual([], missing_evidence)

    def test_runtime_pipeline_follows_the_selected_target_platform(self) -> None:
        expected_markers = {
            "skills/novel-to-game/SKILL.md": "目标运行形态",
            "skills/novel-to-game/references/intake-method.md": "目标交付运行时",
            "skills/game-build/references/build-brief-contract.md": "targetRuntime:",
            "skills/game-qa/references/qa-contract.md": "目标运行环境",
        }
        for relative_path, marker in expected_markers.items():
            with self.subTest(path=relative_path):
                content = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn(marker, content)

    def test_chinese_readme_avoids_stock_contrast_and_awkward_example_copy(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"不是[^。\n]{0,80}[，,]?\s*而是", readme))
        self.assertNotIn("活体家庭取景", readme)
        self.assertIn("## 在线试玩", readme)
        self.assertNotIn("## 先玩游戏", readme)

        canonical_demo = "https://plateau.vibecoco.ai"
        public_preview_docs = {
            "README.md": readme,
            "README_EN.md": (ROOT / "README_EN.md").read_text(encoding="utf-8"),
            "RUN.md": (
                ROOT / "game-adaptations/project-plateau/build/app/RUN.md"
            ).read_text(encoding="utf-8"),
            "QA_REPORT.md": (
                ROOT / "game-adaptations/project-plateau/qa/QA_REPORT.md"
            ).read_text(encoding="utf-8"),
        }
        for name, content in public_preview_docs.items():
            with self.subTest(public_preview_doc=name):
                self.assertIn(canonical_demo, content)
                self.assertNotIn("https://project-plateau.vercel.app", content)

    def test_skill_validator_rejects_chinese_first_description(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            skill = Path(temporary) / "demo"
            (skill / "agents").mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                f"---\nname: demo\ndescription: \u4e2d\u6587\u5f00\u5934\u7684\u63cf\u8ff0\n---\n"
                f"# Demo\n\n{OUTPUT_LANGUAGE_RULE}\n",
                encoding="utf-8",
            )
            (skill / "agents/openai.yaml").write_text(
                'interface:\n  default_prompt: "Use $demo."\n', encoding="utf-8"
            )
            self.assertTrue(
                any(
                    "description must lead with English" in issue
                    for issue in validate_skill(skill)
                )
            )

    def test_skill_validator_rejects_missing_output_language_rule(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            skill = Path(temporary) / "demo"
            (skill / "agents").mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: demo\ndescription: An English-first description.\n---\n"
                "# Demo\n\n\u6ca1\u6709\u8bed\u8a00\u89c4\u5219\u3002\n",
                encoding="utf-8",
            )
            (skill / "agents/openai.yaml").write_text(
                'interface:\n  default_prompt: "Use $demo."\n', encoding="utf-8"
            )
            self.assertTrue(
                any(
                    "missing the output-language rule" in issue
                    for issue in validate_skill(skill)
                )
            )

    def test_runtime_markdown_headings_match_the_declared_language(self) -> None:
        """\u6280\u80fd\u4e0e references \u6052\u4e3a\u7b80\u4f53\u4e2d\u6587\uff1b\u793a\u4f8b\u6309\u81ea\u5df1 manifest \u58f0\u660e\u7684\u8bed\u8a00\u5224\u3002"""
        cjk = re.compile(r"[\u3400-\u9fff]")
        markdown_files = [
            path
            for path in (ROOT / "skills").rglob("*.md")
            if not any(part.startswith(".") for part in path.relative_to(ROOT).parts)
        ]
        for name in sorted(visible_directories(ROOT / "examples")):
            manifest, issues = read_manifest(ROOT / "examples" / name)
            self.assertEqual(issues, [])
            if not str(manifest["language"]).startswith("zh"):
                continue
            markdown_files.extend(
                path
                for path in (ROOT / "examples" / name).rglob("*.md")
                if not any(part.startswith(".") for part in path.relative_to(ROOT).parts)
            )

        violations: list[str] = []
        for markdown in markdown_files:
            for line_number, line in enumerate(
                markdown.read_text(encoding="utf-8").splitlines(), start=1
            ):
                if line.startswith("#") and not cjk.search(line):
                    violations.append(
                        f"{markdown.relative_to(ROOT)}:{line_number}: {line}"
                    )

        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
