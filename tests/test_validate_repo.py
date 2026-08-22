from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import hashlib
import importlib.util
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_repo import (  # noqa: E402
    EXAMPLE_MANIFEST,
    REFERENCE_LINE_BUDGET,
    SKILL_MD_LINE_BUDGET,
    SKILL_TOTAL_LINE_BUDGET,
    validate_skill_budget,
    EXAMPLE_PLANNING_FILES,
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
    validate_readme_example_order,
    validate_repository,
    validate_qa,
    validate_skill,
    validation_json_files,
    visible_directories,
)


class RepositoryValidationTests(unittest.TestCase):
    def load_script(self, relative: str, name: str):
        spec = importlib.util.spec_from_file_location(name, ROOT / relative)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        self.addCleanup(sys.modules.pop, name, None)
        spec.loader.exec_module(module)
        return module

    def make_compact_verification_fixture(self, root: Path) -> Path:
        example = root / "examples/demo"
        (example / "qa/evidence").mkdir(parents=True)
        (example / "build/app").mkdir(parents=True)
        (example / "build/app/index.html").write_text(
            "<!doctype html><title>fixture</title>\n", encoding="utf-8"
        )
        visual = example / "qa/evidence/frame.ppm"
        visual.write_text("P3\n1 1\n255\n0 0 0\n", encoding="utf-8")
        evidence = example / "qa/evidence/run.json"
        evidence.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "runId": "fixture-complete-run",
                    "environment": {"runtime": "fixture"},
                    "inputTrace": ["launch", "observe", "finish", "restart"],
                    "observations": {
                        "launch": {
                            "id": "launch",
                            "inputs": ["launch fixture"],
                            "state": {"phase": "initial"},
                        },
                        "render": {
                            "id": "render",
                            "inputs": ["capture frame"],
                            "state": {"frame": "visible"},
                            "visual": "qa/evidence/frame.ppm",
                        },
                        "input": {
                            "id": "input",
                            "inputs": ["observe"],
                            "state": {"accepted": True},
                        },
                        "coreLoop": {
                            "id": "core-loop",
                            "inputs": ["finish route"],
                            "state": {"phase": "complete"},
                        },
                        "outcome": {
                            "id": "outcome",
                            "inputs": ["finish route"],
                            "state": {"terminal": "fixture-outcome"},
                        },
                        "restart": {
                            "id": "restart",
                            "inputs": ["restart fixture"],
                            "state": {"restart": "fixture-initial-state"},
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        checks = {
            name: "PASS"
            for name in (
                "launch",
                "render",
                "input",
                "coreLoop",
                "outcome",
                "restart",
            )
        }
        (example / "qa/verification.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 3,
                    "status": "PASS",
                    "verify": {
                        "command": "fixture verify",
                        "exitCode": 0,
                    },
                    "completeRun": {
                        "id": "fixture-complete-run",
                        "cleanContext": True,
                        "terminal": "fixture-outcome",
                        "restart": "fixture-initial-state",
                        "evidence": "qa/evidence/run.json",
                    },
                    "checks": checks,
                    "limitations": [],
                }
            ),
            encoding="utf-8",
        )
        return example

    def test_minimal_qa_accepts_the_six_playable_checks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            self.assertEqual(validate_qa(example), [])

    def test_minimal_qa_rejects_a_missing_playable_check(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            del verification["checks"]["restart"]
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("checks.restart" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_an_extra_check(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            verification["checks"]["performance"] = "PASS"
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("checks must contain exactly" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_unknown_top_level_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            verification["legacyField"] = "removed"
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("unknown fields" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_placeholder_or_non_json_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            evidence = example / "qa/evidence/run.json"
            evidence.write_text("complete run captured\n", encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("invalid JSON" in issue for issue in issues), issues)

            evidence.write_text("", encoding="utf-8")
            issues = validate_qa(example)
            self.assertTrue(any("must not be empty" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_non_integer_zero_exit_codes(self) -> None:
        for fake_zero in (False, 0.0, "0"):
            with self.subTest(exit_code=fake_zero), tempfile.TemporaryDirectory() as temporary:
                example = self.make_compact_verification_fixture(Path(temporary))
                verification_path = example / "qa/verification.json"
                verification = json.loads(
                    verification_path.read_text(encoding="utf-8")
                )
                verification["verify"]["exitCode"] = fake_zero
                verification_path.write_text(
                    json.dumps(verification), encoding="utf-8"
                )

                issues = validate_qa(example)

                self.assertTrue(
                    any("verify.exitCode must be integer 0" in issue for issue in issues),
                    issues,
                )

    def test_minimal_qa_rejects_missing_complete_run_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            (example / "qa/evidence/run.json").unlink()

            issues = validate_qa(example)

            self.assertTrue(any("completeRun.evidence does not exist" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_unbound_or_incomplete_observations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/evidence/run.json"
            evidence = json.loads(path.read_text(encoding="utf-8"))
            del evidence["observations"]["input"]
            evidence["observations"]["outcome"]["state"] = {"terminal": "other"}
            path.write_text(json.dumps(evidence), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("observations must contain exactly" in issue for issue in issues), issues)
            self.assertTrue(any("must record completeRun.terminal" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_fake_status_and_bad_limitation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            verification["status"] = "PASS_WITH_GAPS"
            verification["limitations"] = [
                {
                    "scope": "restart",
                    "reason": "not exercised",
                }
            ]
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("status" in issue for issue in issues), issues)

            verification["status"] = "PASS"
            verification["limitations"][0]["reason"] = ""
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_qa(example)
            self.assertTrue(any("limitations[0].reason" in issue for issue in issues), issues)

    def test_minimal_qa_requires_pass_and_complete_run_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))

            verification["status"] = "FAIL"
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_qa(example)
            self.assertTrue(any("status must PASS" in issue for issue in issues), issues)

            verification["status"] = "PASS"
            verification["completeRun"].pop("evidence")
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_qa(example)
            self.assertTrue(any("completeRun.evidence is required" in issue for issue in issues), issues)

    def test_authoritative_wrappers_replace_stale_pass_on_suite_failure(self) -> None:
        scripts = (
            (
                "examples/journey-to-the-west/build/app/test/verify.py",
                "journey_verify_failure_test",
                "EVIDENCE",
            ),
            (
                "examples/project-plateau/build/app/test/verify.py",
                "plateau_verify_failure_test",
                "REPORT",
            ),
        )
        for relative, name, evidence_name in scripts:
            with self.subTest(script=relative), tempfile.TemporaryDirectory() as temporary:
                module = self.load_script(relative, name)
                root = Path(temporary)
                evidence = root / "evidence.json"
                setattr(module, evidence_name, evidence)
                if evidence_name == "REPORT":
                    module.PROJECT = root
                module.VERIFICATION = root / "verification.json"
                evidence.write_text('{"stale":true}\n', encoding="utf-8")
                module.VERIFICATION.write_text(
                    '{"status":"PASS","verify":{"exitCode":0}}\n',
                    encoding="utf-8",
                )
                output = io.StringIO()
                with (
                    mock.patch.object(module.sys, "argv", ["verify.py"]),
                    mock.patch.object(
                        module.subprocess,
                        "run",
                        return_value=mock.Mock(returncode=9),
                    ),
                    redirect_stdout(output),
                    redirect_stderr(output),
                ):
                    self.assertEqual(module.main(), 1)

                verification = json.loads(
                    module.VERIFICATION.read_text(encoding="utf-8")
                )
                self.assertEqual(verification["schemaVersion"], 3)
                self.assertEqual(verification["status"], "FAIL")
                self.assertEqual(verification["verify"]["exitCode"], 1)
                self.assertEqual(set(verification["checks"].values()), {"FAIL"})
                self.assertFalse((root / "QA_REPORT.md").exists())

    def test_readme_example_link_order_must_match_between_languages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "README.md").write_text(
                "[A](examples/a/) [B](examples/b/)", encoding="utf-8"
            )
            (root / "README_ZH.md").write_text(
                "[乙](examples/b/) [甲](examples/a/)", encoding="utf-8"
            )
            issues = validate_readme_example_order(root)
            self.assertTrue(any("example link order must match" in issue for issue in issues), issues)

    def test_repository_contract_is_valid(self) -> None:
        self.assertEqual(validate_repository(ROOT), [])

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

    def test_minimal_evidence_fixture_runs_one_complete_verification(self) -> None:
        fixture = ROOT / "tests/fixtures/minimal-evidence"
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary) / "project"
            shutil.copytree(fixture, project)
            result = subprocess.run(
                [sys.executable, "verify.py"],
                cwd=project,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            verification = json.loads(
                (project / "qa/verification.json").read_text(encoding="utf-8")
            )
            self.assertEqual(validate_qa(project), [])
            self.assertEqual(verification["schemaVersion"], 3)
            self.assertEqual(
                set(verification["checks"]),
                {"launch", "render", "input", "coreLoop", "outcome", "restart"},
            )
            complete_run = verification["completeRun"]
            self.assertTrue(complete_run["cleanContext"])
            self.assertEqual(complete_run["terminal"], "extracted_with_proof")
            self.assertEqual(complete_run["restart"], "initial_state")
            evidence = project / complete_run["evidence"]
            self.assertTrue(evidence.is_file())
            run = json.loads(evidence.read_text(encoding="utf-8"))
            self.assertEqual(
                run["observations"]["outcome"]["state"]["outcome"],
                "extracted_with_proof",
            )
            self.assertEqual(
                run["observations"]["restart"]["state"]["phase"],
                "arrival",
            )

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
                # Coverage state and a build asset ledger are valid supporting
                # artifacts, but legacy examples may not contain either one.
                self.assertEqual(actual - OPTIONAL_PLANNING_FILES, EXAMPLE_PLANNING_FILES)
                line_counts = {
                    relative: len((example / relative).read_text(encoding="utf-8").splitlines())
                    for relative in EXAMPLE_PLANNING_FILES
                }
                self.assertLessEqual(max(line_counts.values()), 500, line_counts)
                self.assertLessEqual(sum(line_counts.values()), 1200, line_counts)

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

    def test_asset_ledgers_reference_existing_sources_and_evidence(self) -> None:
        missing_targets = []
        ledgers = sorted(
            ledger
            for parent in (ROOT / "game-adaptations", ROOT / "examples")
            for ledger in parent.glob("*/build/asset-ledger.json")
        )
        for ledger in ledgers:
            data = json.loads(ledger.read_text(encoding="utf-8"))
            for entry in data.get("entries", []):
                for field in ("source", "evidence"):
                    for target in entry.get(field, []):
                        if "://" in target:
                            continue
                        if not (ledger.parent / target).is_file():
                            missing_targets.append(
                                f"{ledger.relative_to(ROOT)}:{entry.get('key')} "
                                f"{field} -> {target}"
                            )

        self.assertEqual([], missing_targets)

    def test_generated_plateau_assets_keep_minimal_provenance(self) -> None:
        ledger = json.loads(
            (ROOT / "examples/project-plateau/build/asset-ledger.json").read_text(
                encoding="utf-8"
            )
        )
        generated = [
            entry
            for entry in ledger["entries"]
            if "Project-generated" in entry.get("rights", "")
        ]

        self.assertEqual(4, len(generated))
        self.assertTrue(
            all(isinstance(entry.get("provenance"), str) and entry["provenance"].strip()
                for entry in generated)
        )

    def test_plateau_machine_evidence_stays_compact(self) -> None:
        build = ROOT / "examples/project-plateau/build"
        report_path = build / "evidence/current-run/report.json"
        report_text = report_path.read_text(encoding="utf-8")
        report = json.loads(report_text)
        self.assertEqual(
            {"schemaVersion", "runId", "environment", "inputTrace", "observations"},
            set(report),
        )
        self.assertEqual(
            {"launch", "render", "input", "coreLoop", "outcome", "restart"},
            set(report["observations"]),
        )
        self.assertLessEqual(len(report["inputTrace"]), 15)
        self.assertTrue(all(isinstance(item, str) for item in report["inputTrace"]))
        visuals = {
            observation["visual"]
            for observation in report["observations"].values()
            if "visual" in observation
        }
        self.assertLessEqual(len(visuals), 3)
        self.assertLessEqual(report_text.count("\n"), 260)

    def test_plateau_world_is_split_by_responsibility(self) -> None:
        source = ROOT / "examples/project-plateau/build/app/src"
        budgets = {
            "world.js": 250,
            "world-snapshot.js": 150,
            "world-animation.js": 780,
            "world-asset-visuals.js": 350,
            "world-subjects.js": 600,
            "world-landmarks.js": 600,
            "world-rendering.js": 200,
            "vegetation-rendering.js": 950,
            "vegetation-textures.js": 350,
            "vegetation-leaf-materials.js": 200,
            "deadwood-rendering.js": 300,
            "rock-rendering.js": 150,
            "rock-geometry.js": 600,
            "rock-materials.js": 420,
            "rock-placement.js": 120,
            "world-terrain.js": 10,
            "terrain-surface.js": 850,
            "route-and-brook.js": 750,
            "world-vegetation.js": 10,
            "authored-vegetation.js": 550,
            "environment-density.js": 650,
            "riparian-cover.js": 320,
            "world-geology.js": 800,
            "terrain-material-textures.js": 450,
            "brook-material.js": 900,
            "brook-scene-capture.js": 600,
        }
        contents = {}
        for name, maximum_lines in budgets.items():
            with self.subTest(name=name):
                contents[name] = (source / name).read_text(encoding="utf-8")
                self.assertLessEqual(contents[name].count("\n"), maximum_lines)

        self.assertIn("from './world-rendering.js'", contents["world-subjects.js"])
        self.assertIn("from './world-rendering.js'", contents["world-landmarks.js"])
        self.assertIn("from './vegetation-rendering.js'", contents["world-animation.js"])
        self.assertIn("from './rock-rendering.js'", contents["world.js"])
        self.assertIn("from './world-terrain.js'", contents["world.js"])
        self.assertIn("from './world-vegetation.js'", contents["world.js"])
        self.assertIn("from './world-geology.js'", contents["world.js"])
        self.assertIn("from './brook-material.js'", contents["world.js"])
        self.assertIn("from './brook-scene-capture.js'", contents["world.js"])
        self.assertIn("from './world-subjects.js'", contents["world.js"])
        self.assertIn("from './world-landmarks.js'", contents["world.js"])
        self.assertIn("from './world-snapshot.js'", contents["world.js"])
        self.assertIn("from './world-asset-visuals.js'", contents["world.js"])
        self.assertIn("from './world-animation.js'", contents["world.js"])
        self.assertIn("export function createWorldAnimationController", contents["world-animation.js"])
        self.assertIn("export function createWorldAssetVisualLoader", contents["world-asset-visuals.js"])
        self.assertIn("export async function loadOptionalAssetVisual", contents["world-asset-visuals.js"])
        self.assertIn("from './terrain-surface.js'", contents["world-terrain.js"])
        self.assertIn("from './route-and-brook.js'", contents["world-terrain.js"])
        self.assertIn("from './terrain-material-textures.js'", contents["terrain-surface.js"])
        self.assertIn("from './brook-material.js'", contents["route-and-brook.js"])
        self.assertIn("from './vegetation-textures.js'", contents["vegetation-rendering.js"])
        self.assertIn("from './vegetation-leaf-materials.js'", contents["vegetation-rendering.js"])
        self.assertIn("from './vegetation-leaf-materials.js'", contents["world-animation.js"])
        self.assertIn("from './deadwood-rendering.js'", contents["route-and-brook.js"])
        self.assertIn("from './rock-geometry.js'", contents["rock-rendering.js"])
        self.assertIn("from './rock-materials.js'", contents["rock-rendering.js"])
        self.assertIn("from './rock-placement.js'", contents["rock-rendering.js"])
        self.assertIn("from './authored-vegetation.js'", contents["world-vegetation.js"])
        self.assertIn("from './environment-density.js'", contents["world-vegetation.js"])
        self.assertIn("from './riparian-cover.js'", contents["world-vegetation.js"])
        self.assertIn("from './deadwood-rendering.js'", contents["environment-density.js"])
        self.assertIn("from './vegetation-textures.js'", contents["riparian-cover.js"])
        self.assertFalse((source / "terrain-water-rendering.js").exists())
        self.assertIn("export function createWorld(", contents["world.js"])
        for name in budgets.keys() - {"world.js"}:
            self.assertNotIn("from './world.js'", contents[name])
            self.assertNotIn("export function createWorld(", contents[name])

    def test_plateau_generators_share_one_glb_exporter(self) -> None:
        scripts = ROOT / "examples/project-plateau/build/app/scripts"
        helper = (scripts / "gltf-export.mjs").read_text(encoding="utf-8")
        generators = sorted(scripts.glob("generate-*.mjs"))
        self.assertEqual(7, len(generators))
        self.assertIn("class NodeFileReader", helper)
        self.assertIn("export async function writeBinaryGlb", helper)
        self.assertIn("export function triangleCount", helper)
        total_lines = helper.count("\n")
        for path in generators:
            with self.subTest(path=path.name):
                source = path.read_text(encoding="utf-8")
                total_lines += source.count("\n")
                self.assertIn("from './gltf-export.mjs'", source)
                self.assertIn("writeBinaryGlb(root, OUTPUT)", source)
                self.assertNotIn("class NodeFileReader", source)
                self.assertNotIn("GLTFExporter", source)
                self.assertNotIn("writeFile(", source)
        self.assertLessEqual(total_lines, 4000)

    def test_plateau_atmosphere_is_split_by_responsibility(self) -> None:
        source = ROOT / "examples/project-plateau/build/app/src"
        budgets = {
            "atmosphere.js": 100,
            "atmosphere-sky.js": 700,
            "atmosphere-ridges.js": 950,
            "atmosphere-mist.js": 120,
        }
        contents = {}
        for name, maximum_lines in budgets.items():
            with self.subTest(name=name):
                contents[name] = (source / name).read_text(encoding="utf-8")
                self.assertLessEqual(contents[name].count("\n"), maximum_lines)

        coordinator = contents["atmosphere.js"]
        self.assertIn("from './atmosphere-sky.js'", coordinator)
        self.assertIn("from './atmosphere-ridges.js'", coordinator)
        self.assertIn("from './atmosphere-mist.js'", coordinator)
        self.assertIn("export function createAtmosphere", coordinator)
        for name in budgets.keys() - {"atmosphere.js"}:
            self.assertNotIn("from './atmosphere.js'", contents[name])
            self.assertNotIn("export function createAtmosphere", contents[name])

    def test_plateau_main_delegates_rendering_setup(self) -> None:
        source = ROOT / "examples/project-plateau/build/app/src"
        budgets = {
            "main.js": 1050,
            "field-lighting.js": 100,
            "field-postprocessing.js": 160,
            "viewmodel.js": 100,
        }
        contents = {}
        for name, maximum_lines in budgets.items():
            with self.subTest(name=name):
                contents[name] = (source / name).read_text(encoding="utf-8")
                self.assertLessEqual(contents[name].count("\n"), maximum_lines)

        main = contents["main.js"]
        self.assertIn("from './field-lighting.js'", main)
        self.assertIn("from './field-postprocessing.js'", main)
        self.assertIn("from './viewmodel.js'", main)
        self.assertNotIn("three/addons/postprocessing", main)
        for dead_state in (
            "pointerLockStatus",
            "pointerLockError",
            "plateCaptureStatus",
            "plateCaptureDurationMs",
            "plateCaptureError",
        ):
            self.assertNotIn(dead_state, main)
        for name in budgets.keys() - {"main.js"}:
            self.assertNotIn("from './main.js'", contents[name])

    def test_plateau_simulation_delegates_physics(self) -> None:
        source = ROOT / "examples/project-plateau/build/app/src"
        simulation = (source / "simulation.js").read_text(encoding="utf-8")
        movement = (source / "simulation-movement.js").read_text(encoding="utf-8")

        self.assertLessEqual(simulation.count("\n"), 800)
        self.assertLessEqual(movement.count("\n"), 450)
        self.assertIn("from './simulation-movement.js'", simulation)
        self.assertIn("export function integrateMovement", movement)
        self.assertIn("export function resolveObstacleStep", movement)
        self.assertIn("export function collisionContractSnapshot", movement)
        self.assertNotIn("from './collision-layout.js'", simulation)
        self.assertNotIn("from './simulation.js'", movement)

    def test_journey_battle_ui_splits_event_animation(self) -> None:
        source = ROOT / "examples/journey-to-the-west/build/app/js"
        battle_ui = (source / "battle_ui.js").read_text(encoding="utf-8")
        commands = (source / "battle_commands.js").read_text(encoding="utf-8")
        animator = (source / "battle_animator.js").read_text(encoding="utf-8")
        self.assertLessEqual(battle_ui.count("\n"), 650)
        self.assertLessEqual(commands.count("\n"), 600)
        self.assertLessEqual(animator.count("\n"), 650)
        self.assertIn("from './battle_animator.js'", battle_ui)
        self.assertIn("from './battle_commands.js'", battle_ui)
        self.assertIn("export async function runBattleScreen", battle_ui)
        self.assertIn("export function createBattleCommands", commands)
        self.assertIn("export function createBattleAnimator", animator)
        self.assertNotIn("from './battle_ui.js'", commands)
        self.assertNotIn("from './battle_ui.js'", animator)
        self.assertNotIn("executeRound", commands)
        self.assertNotIn("executeRound", animator)

    def test_journey_stylesheet_cascade_is_locked(self) -> None:
        app = ROOT / "examples/journey-to-the-west/build/app"
        stylesheets = (
            app / "css/style.css",
            app / "css/battle.css",
            app / "css/presentation.css",
        )
        self.assertEqual(
            "2b29b225592d1a5468769b1e8457084446febed3633d9d2bba7e5d9b2de5eebe",
            hashlib.sha256(b"".join(path.read_bytes() for path in stylesheets)).hexdigest(),
        )
        for stylesheet, line_budget in zip(stylesheets, (450, 550, 300), strict=True):
            with self.subTest(stylesheet=stylesheet.name):
                self.assertLessEqual(len(stylesheet.read_text(encoding="utf-8").splitlines()), line_budget)

        index = (app / "index.html").read_text(encoding="utf-8")
        links = tuple(f'css/{path.name}' for path in stylesheets)
        self.assertEqual(tuple(sorted(index.index(link) for link in links)), tuple(index.index(link) for link in links))

    def test_journey_design_contract_is_independent_and_executable(self) -> None:
        project = ROOT / "examples/journey-to-the-west"
        verifier = project / "qa/verify_design_contract.mjs"
        source = verifier.read_text(encoding="utf-8")

        self.assertNotIn("battle.mjs", source)
        result = subprocess.run(
            ["node", str(verifier)],
            cwd=project,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_example_verification_does_not_repeat_the_complete_run_as_a_suite(self) -> None:
        for path in (ROOT / "examples").glob("*/qa/verification.json"):
            with self.subTest(path=path):
                verification = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual({"command", "exitCode"}, set(verification["verify"]))

    def test_example_run_evidence_does_not_duplicate_qa_verdicts(self) -> None:
        evidence_paths = (
            ROOT / "examples/jin-ping-mei/qa/evidence/run.json",
            ROOT / "examples/journey-to-the-west/qa/evidence/automated.json",
            ROOT / "examples/project-plateau/build/evidence/current-run/report.json",
        )
        verdict_fields = {
            "status",
            "verify",
            "completeRun",
            "checks",
            "suites",
            "minimalChecks",
            "passed",
            "failed",
        }
        for path in evidence_paths:
            with self.subTest(path=path):
                evidence = json.loads(path.read_text(encoding="utf-8"))
                self.assertTrue(verdict_fields.isdisjoint(evidence))
                self.assertEqual(
                    {"schemaVersion", "runId", "environment", "inputTrace", "observations"},
                    set(evidence),
                )

        jin_ping_mei = json.loads(evidence_paths[0].read_text(encoding="utf-8"))
        journey = json.loads(evidence_paths[1].read_text(encoding="utf-8"))
        self.assertLessEqual(
            len({
                item["visual"]
                for item in jin_ping_mei["observations"].values()
                if "visual" in item
            }),
            3,
        )
        self.assertLessEqual(
            len({
                item["visual"]
                for item in journey["observations"].values()
                if "visual" in item
            }),
            3,
        )

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

    def test_skill_budget_rejects_growth_past_the_ceilings(self) -> None:
        """预算要真的撑住：单文件超重与总量超重各报一条。"""
        with tempfile.TemporaryDirectory() as temporary:
            skills_root = Path(temporary)
            lean = skills_root / "lean"
            lean.mkdir()
            (lean / "SKILL.md").write_text("x\n" * 10, encoding="utf-8")
            self.assertEqual(validate_skill_budget(skills_root), [])

            (lean / "SKILL.md").write_text(
                "x\n" * (SKILL_MD_LINE_BUDGET + 1), encoding="utf-8"
            )
            self.assertTrue(
                any(
                    "SKILL.md budget" in issue
                    for issue in validate_skill_budget(skills_root)
                )
            )

            (lean / "references").mkdir()
            (lean / "references/deep.md").write_text(
                "x\n" * (REFERENCE_LINE_BUDGET + 1), encoding="utf-8"
            )
            self.assertTrue(
                any(
                    "reference budget" in issue
                    for issue in validate_skill_budget(skills_root)
                )
            )

            bulk = skills_root / "bulk"
            (bulk / "references").mkdir(parents=True)
            for index in range(SKILL_TOTAL_LINE_BUDGET // REFERENCE_LINE_BUDGET + 1):
                (bulk / f"references/part{index}.md").write_text(
                    "x\n" * REFERENCE_LINE_BUDGET, encoding="utf-8"
                )
            self.assertTrue(
                any(
                    "total budget" in issue
                    for issue in validate_skill_budget(skills_root)
                )
            )

    def test_shipped_skills_stay_inside_the_budget(self) -> None:
        self.assertEqual(validate_skill_budget(ROOT / "skills"), [])

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
