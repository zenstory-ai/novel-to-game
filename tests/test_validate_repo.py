from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import hashlib
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
        evidence = example / "qa/evidence/run.json"
        evidence.write_text(
            json.dumps(
                {
                    "qa": {
                        "command": "fixture verify",
                        "exitCode": 0,
                        "completeRun": {
                            "terminal": "fixture-outcome",
                            "restart": "fixture-initial-state",
                        },
                        "checks": {
                            name: "PASS"
                            for name in (
                                "launch",
                                "render",
                                "input",
                                "coreLoop",
                                "outcome",
                                "restart",
                            )
                        },
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )
        checks = {
            name: {"status": "PASS", "evidence": ["qa/evidence/run.json"]}
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
                    "schemaVersion": 2,
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
            verification["checks"]["performance"] = {
                "status": "PASS",
                "evidence": ["qa/evidence/run.json"],
            }
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

    def test_minimal_qa_binds_machine_evidence_to_the_claim(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            evidence_path = example / "qa/evidence/run.json"
            evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
            evidence["qa"]["command"] = "different command"
            evidence["qa"]["completeRun"]["restart"] = "different restart"
            del evidence["qa"]["checks"]["outcome"]
            evidence_path.write_text(json.dumps(evidence), encoding="utf-8")

            issues = validate_qa(example)

            self.assertTrue(any("qa.command must match" in issue for issue in issues), issues)
            self.assertTrue(any("qa.completeRun.restart must match" in issue for issue in issues), issues)
            self.assertTrue(any("qa.checks must contain exactly" in issue for issue in issues), issues)

    def test_minimal_qa_rejects_non_integer_zero_exit_codes(self) -> None:
        for fake_zero in (False, 0.0, "0"):
            with self.subTest(exit_code=fake_zero), tempfile.TemporaryDirectory() as temporary:
                example = self.make_compact_verification_fixture(Path(temporary))
                verification_path = example / "qa/verification.json"
                evidence_path = example / "qa/evidence/run.json"
                verification = json.loads(
                    verification_path.read_text(encoding="utf-8")
                )
                evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
                verification["verify"]["exitCode"] = fake_zero
                evidence["qa"]["exitCode"] = fake_zero
                verification_path.write_text(
                    json.dumps(verification), encoding="utf-8"
                )
                evidence_path.write_text(json.dumps(evidence), encoding="utf-8")

                issues = validate_qa(example)

                self.assertTrue(
                    any("verify.exitCode must be integer 0" in issue for issue in issues),
                    issues,
                )

    def test_minimal_qa_rejects_non_json_machine_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            (example / "qa/evidence/run.json").write_text(
                "not evidence", encoding="utf-8"
            )

            issues = validate_qa(example)

            self.assertTrue(any("machine evidence must be valid JSON" in issue for issue in issues), issues)

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
                "examples/jin-ping-mei/build/app/test/verify.py",
                "jin_verify_failure_test",
            ),
            (
                "examples/journey-to-the-west/build/app/test/verify.py",
                "journey_verify_failure_test",
            ),
        )
        for relative, name in scripts:
            with self.subTest(script=relative), tempfile.TemporaryDirectory() as temporary:
                module = self.load_script(relative, name)
                root = Path(temporary)
                module.EVIDENCE = root / "evidence.json"
                module.VERIFICATION = root / "verification.json"
                module.REPORT = root / "QA_REPORT.md"
                module.EVIDENCE.write_text('{"qa":{"exitCode":0}}\n', encoding="utf-8")
                module.VERIFICATION.write_text(
                    '{"status":"PASS","verify":{"exitCode":0}}\n',
                    encoding="utf-8",
                )
                module.run_suite = mock.Mock(return_value={
                    "id": "browser:complete-run",
                    "executed": True,
                    "passed": False,
                    "exitCode": 9,
                })
                output = io.StringIO()
                with (
                    mock.patch.object(module.sys, "argv", ["verify.py"]),
                    redirect_stdout(output),
                    redirect_stderr(output),
                ):
                    self.assertEqual(module.main(), 1)

                evidence = json.loads(module.EVIDENCE.read_text(encoding="utf-8"))
                verification = json.loads(
                    module.VERIFICATION.read_text(encoding="utf-8")
                )
                self.assertEqual(evidence["qa"]["exitCode"], 1)
                self.assertEqual(set(evidence["qa"]["checks"].values()), {"FAIL"})
                self.assertEqual(verification["status"], "FAIL")
                self.assertEqual(verification["verify"]["exitCode"], 1)

    def test_plateau_wrapper_replaces_stale_pass_on_suite_failure(self) -> None:
        module = self.load_script(
            "examples/project-plateau/build/app/test/verify.py",
            "plateau_verify_failure_test",
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            module.PROJECT = root
            module.BUILD = root / "build"
            module.VERIFICATION = root / "qa/verification.json"
            module.REPORT = root / "qa/QA_REPORT.md"
            module.SUITES = (
                module.Suite(
                    "fixture:failure",
                    ("fixture",),
                    (("fixture-command",),),
                    root,
                ),
            )
            module.command_output = mock.Mock(return_value=(9, "fixture failure"))
            module.VERIFICATION.parent.mkdir(parents=True)
            module.VERIFICATION.write_text(
                '{"status":"PASS","verify":{"exitCode":0}}\n',
                encoding="utf-8",
            )
            output = io.StringIO()
            with (
                mock.patch.object(module.sys, "argv", ["verify.py"]),
                redirect_stdout(output),
                redirect_stderr(output),
            ):
                self.assertEqual(module.main(), 1)

            evidence = json.loads(
                (module.BUILD / "evidence/current-run/report.json").read_text(
                    encoding="utf-8"
                )
            )
            verification = json.loads(
                module.VERIFICATION.read_text(encoding="utf-8")
            )
            self.assertEqual(evidence["qa"]["exitCode"], 1)
            self.assertEqual(set(evidence["qa"]["checks"].values()), {"FAIL"})
            self.assertEqual(verification["status"], "FAIL")
            self.assertEqual(verification["verify"]["exitCode"], 1)

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
            self.assertEqual(verification["schemaVersion"], 2)
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
            self.assertEqual(run["states"]["outcome"]["outcome"], "extracted_with_proof")
            self.assertEqual(run["states"]["restart"], run["states"]["initial"])

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

    def test_plateau_machine_evidence_matches_runtime_fingerprint(self) -> None:
        build = ROOT / "examples/project-plateau/build"
        app = build / "app"
        report = json.loads(
            (build / "evidence/current-run/report.json").read_text(encoding="utf-8")
        )
        source = report.get("runtimeSource")
        self.assertIsInstance(source, dict)
        self.assertEqual(
            "interactive inputs: index/package manifests, src and public assets; "
            "generated conversion-preview outputs excluded",
            source.get("scope"),
        )

        excluded_prefix = "public/media/project-plateau-preview"
        paths = [app / "index.html", app / "package.json", app / "package-lock.json"]
        paths += sorted((app / "public").rglob("*"))
        paths += sorted((app / "src").rglob("*"))
        digest = hashlib.sha256()
        for path in paths:
            if not path.is_file():
                continue
            relative = path.relative_to(app).as_posix()
            if relative.startswith(excluded_prefix):
                continue
            digest.update(relative.encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
        self.assertEqual(digest.hexdigest(), source.get("sha256"))

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
