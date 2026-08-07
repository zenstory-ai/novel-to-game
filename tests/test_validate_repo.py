from __future__ import annotations

import json
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
    validate_readme_publication_claims,
    validate_rule_shape,
    validate_repository,
    validate_assurance,
    validate_skill,
    validation_json_files,
    visible_directories,
)


class RepositoryValidationTests(unittest.TestCase):
    def make_compact_verification_fixture(
        self, root: Path, *, profile: str = "smoke"
    ) -> Path:
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
                    "command": "fixture verify",
                    "exitCode": 0,
                    "completeRun": {
                        "terminal": "fixture-outcome",
                        "restart": "fixture-initial-state",
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
        if profile in {"delivery", "release"}:
            checks.update(
                {
                    name: {
                        "status": "PASS",
                        "evidence": ["qa/evidence/run.json"],
                    }
                    for name in ("targetRuntime", "targetDisplay", "onboarding")
                }
            )
        if profile == "release":
            checks.update(
                {
                    name: {
                        "status": "PASS",
                        "evidence": ["qa/evidence/run.json"],
                    }
                    for name in (
                        "performance",
                        "requiredAssets",
                        "independentPlaytest",
                    )
                }
            )
        (example / "qa/verification.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 2,
                    "assuranceProfile": profile,
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

    def test_smoke_assurance_accepts_only_the_six_playable_checks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            self.assertEqual(validate_assurance(example, "smoke"), [])

    def test_smoke_assurance_rejects_a_missing_playable_check(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            del verification["checks"]["restart"]
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_assurance(example, "smoke")

            self.assertTrue(any("checks.restart" in issue for issue in issues), issues)

    def test_delivery_assurance_monotonically_adds_handoff_checks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(
                Path(temporary), profile="delivery"
            )
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            del verification["checks"]["onboarding"]
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_assurance(example, "delivery")

            self.assertTrue(any("checks.onboarding" in issue for issue in issues), issues)

    def test_release_assurance_adds_only_player_effect_checks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(
                Path(temporary), profile="release"
            )
            self.assertEqual(validate_assurance(example, "release"), [])

            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            del verification["checks"]["performance"]
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_assurance(example, "release")
            self.assertTrue(any("checks.performance" in issue for issue in issues), issues)

    def test_assurance_rejects_publication_identity_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            verification["source_fingerprint"] = "unused"
            verification["public-host"] = {"status": "PASS"}
            verification["release-gates"] = {"status": "PASS"}
            verification["verify"]["logSha256"] = "unused"
            path.write_text(json.dumps(verification), encoding="utf-8")
            (example / "qa/release-gates.json").write_text("{}", encoding="utf-8")

            issues = validate_assurance(example, "smoke")

            self.assertTrue(any("source_fingerprint" in issue for issue in issues), issues)
            self.assertTrue(any("public-host" in issue for issue in issues), issues)
            self.assertTrue(any("release-gates" in issue for issue in issues), issues)
            self.assertTrue(any("logSha256" in issue for issue in issues), issues)
            self.assertTrue(any("separate QA gate files" in issue for issue in issues), issues)

    def test_compact_assurance_rejects_blocking_limitations_and_fake_statuses(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))
            verification["status"] = "PASS_WITH_GAPS"
            verification["limitations"] = [
                {
                    "scope": "restart",
                    "reason": "not exercised",
                    "blocksProfiles": ["smoke"],
                }
            ]
            path.write_text(json.dumps(verification), encoding="utf-8")

            issues = validate_assurance(example, "smoke")

            self.assertTrue(any("status" in issue for issue in issues), issues)

            verification["status"] = "PASS"
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_assurance(example, "smoke")
            self.assertTrue(any("blocks current profile" in issue for issue in issues), issues)

    def test_compact_assurance_requires_pass_and_complete_run_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_compact_verification_fixture(Path(temporary))
            path = example / "qa/verification.json"
            verification = json.loads(path.read_text(encoding="utf-8"))

            verification["status"] = "FAIL"
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_assurance(example, "smoke")
            self.assertTrue(any("status must PASS" in issue for issue in issues), issues)

            verification["status"] = "PASS"
            verification["completeRun"].pop("evidence")
            path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_assurance(example, "smoke")
            self.assertTrue(any("completeRun.evidence is required" in issue for issue in issues), issues)

    def test_readme_featured_claim_must_point_to_showcase(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "examples/demo").mkdir(parents=True)
            (root / "examples/demo/example.json").write_text(
                json.dumps({"publicationTier": "playable-prototype"})
            )
            (root / "README.md").write_text(
                "## Play Online\n\n### Demo · Featured\n[Case](examples/demo/)\n", encoding="utf-8"
            )
            (root / "README_ZH.md").write_text(
                "## 在线试玩\n\n### Demo · 精选\n[案例](examples/demo/)\n", encoding="utf-8"
            )
            issues = validate_readme_publication_claims(root)
            self.assertTrue(any("README.md" in issue and "showcase" in issue for issue in issues), issues)
            self.assertTrue(any("README_ZH.md" in issue and "showcase" in issue for issue in issues), issues)

    def test_readme_example_link_order_must_match_between_languages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "README.md").write_text(
                "[A](examples/a/) [B](examples/b/)", encoding="utf-8"
            )
            (root / "README_ZH.md").write_text(
                "[乙](examples/b/) [甲](examples/a/)", encoding="utf-8"
            )
            issues = validate_readme_publication_claims(root)
            self.assertTrue(any("example link order must match" in issue for issue in issues), issues)

    def test_readme_public_listing_must_use_manifest_tier_label(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "examples/demo").mkdir(parents=True)
            (root / "examples/demo/example.json").write_text(
                json.dumps({"publicationTier": "graybox"}), encoding="utf-8"
            )
            (root / "README.md").write_text(
                "## Play Online\n\n### Demo · Playable prototype\n[Case](examples/demo/)\n",
                encoding="utf-8",
            )
            (root / "README_ZH.md").write_text(
                "## 在线试玩\n\n### Demo · 可玩原型\n[案例](examples/demo/)\n",
                encoding="utf-8",
            )
            issues = validate_readme_publication_claims(root)
            self.assertTrue(any("must be labelled graybox" in issue for issue in issues), issues)

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
                "README.md` and `README_ZH.md",
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
                "player-visible QA boundary": (
                    "skills/game-qa/SKILL.md",
                    "玩家可感知",
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
            self.assertEqual(validate_assurance(project, "smoke"), [])
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

    def test_public_product_copy_does_not_limit_the_pipeline_to_web_games(self) -> None:
        surfaces = {
            "README.md": (ROOT / "README.md").read_text(encoding="utf-8"),
            "README_ZH.md": (ROOT / "README_ZH.md").read_text(encoding="utf-8"),
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

    def test_asset_ledgers_reference_existing_evidence(self) -> None:
        missing_evidence = []
        ledgers = sorted(
            ledger
            for parent in (ROOT / "game-adaptations", ROOT / "examples")
            for ledger in parent.glob("*/build/asset-ledger.json")
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

    def test_tts_contract_stays_provider_neutral_and_minimizes_source_disclosure(self) -> None:
        contract = (
            ROOT / "skills/game-build/references/tts-production-contract.md"
        ).read_text(encoding="utf-8")
        self.assertNotIn("Fish Audio", contract)
        self.assertNotIn("s2.1", contract)
        self.assertIn("不上传完整小说", contract)
        self.assertIn("运行时不需要网络或密钥", contract)
        self.assertIn("人工试听", contract)

        decision_method = (
            ROOT / "skills/game-art-direction/references/art-direction-method.md"
        ).read_text(encoding="utf-8")
        for marker in (
            "硬否决",
            "增量价值",
            "触发窗口",
            "最小覆盖原则",
            "宣传资产不自动变成游戏内资产",
            "运行时动态",
            "角色级选角",
            "性别呈现",
        ):
            self.assertIn(marker, decision_method)
        self.assertNotIn("Fish Audio", decision_method)

    def test_fish_audio_trials_are_sparse_and_never_release_assets_by_default(self) -> None:
        config = json.loads(
            (
                ROOT
                / "examples/project-plateau/build/media/remotion/tts-review-scenarios.json"
            ).read_text(encoding="utf-8")
        )
        policy = config["policy"]
        self.assertEqual(policy["maximumSelectedLinesPerGame"], 1)
        self.assertFalse(policy["generatedFilesAreReleaseAssets"])
        self.assertTrue(policy["humanListeningRequiredBeforeIntegration"])

        trials = []
        for configured in config["scenarios"]:
            if configured["scope"] != "project-trial":
                continue
            trial = dict(configured)
            if candidate_ref := trial.get("candidate_ref"):
                for owned_field in (
                    "language",
                    "speaker",
                    "voice_profile",
                    "text",
                    "source_ref",
                    "player_action",
                    "incremental_value",
                    "trigger_window",
                    "expected_repeats",
                    "muted_result",
                    "rights_status",
                    "reason",
                ):
                    self.assertNotIn(owned_field, configured)
                candidate_document = json.loads(
                    (ROOT / candidate_ref).read_text(encoding="utf-8")
                )
                self.assertEqual(
                    candidate_document["status"],
                    "AUDITION_APPROVED_NOT_RUNTIME_ADOPTED",
                )
                self.assertEqual(candidate_document["runtimeVoiceStrategy"], "none")
                # The ownership fence runs both ways: an audition document must not be able to
                # rescope, recast or re-bound the trial the provider config declared.
                for provider_field in (
                    "scope",
                    "source",
                    "reference_env",
                    "file",
                    "metadata_file",
                    "minimum_seconds",
                    "maximum_seconds",
                    "candidate_ref",
                ):
                    self.assertNotIn(provider_field, candidate_document["candidate"])
                art_direction = (
                    ROOT / candidate_ref
                ).with_name("ART_DIRECTION.md").read_text(encoding="utf-8")
                self.assertIn("VOICE_AUDITION.json", art_direction)
                self.assertIn("不等于", art_direction)
                trial.update(candidate_document["candidate"])
            trials.append(trial)
        self.assertEqual(
            {item["project"] for item in trials},
            {"project-plateau", "jin-ping-mei", "journey-to-the-west"},
        )
        counts: dict[str, int] = {}
        for trial in trials:
            counts[trial["project"]] = counts.get(trial["project"], 0) + 1
            self.assertNotIn("source/", str(trial))
            self.assertIn("source_ref", trial)
            self.assertIn("speaker", trial)
            profile = trial["voice_profile"]
            for field in (
                "casting_id",
                "role",
                "gender_presentation",
                "age_presentation",
                "delivery",
                "must_not_sound_like",
            ):
                self.assertTrue(profile[field])
            source_path = ROOT / trial["source_ref"].split("#", 1)[0]
            self.assertTrue(source_path.is_file(), source_path)
            if trial["source"] == "generate":
                self.assertRegex(trial["reference_env"], r"^FISH_REFERENCE_ID_[A-Z0-9_]+$")
                spoken_text = re.sub(r"^\[[^]]+\]\s*", "", trial["text"])
                self.assertIn(spoken_text, source_path.read_text(encoding="utf-8"))
            elif source_path.suffix == ".json":
                source_voice = json.loads(source_path.read_text(encoding="utf-8"))["voice"]
                self.assertEqual(trial["speaker"], source_voice["speaker"])
                for field in ("casting_id", "role", "gender_presentation", "age_presentation"):
                    self.assertEqual(profile[field], source_voice[field])
        self.assertTrue(all(count == 1 for count in counts.values()))
        generated = [trial for trial in trials if trial["source"] == "generate"]
        self.assertEqual(len(generated), len({trial["reference_env"] for trial in generated}))
        self.assertEqual(len(trials), len({trial["voice_profile"]["casting_id"] for trial in trials}))
        gender_presentations = {
            trial["voice_profile"]["gender_presentation"] for trial in trials
        }
        self.assertTrue({"male", "女性"}.issubset(gender_presentations))

        jin_ping_mei = next(
            item for item in trials if item["project"] == "jin-ping-mei"
        )
        self.assertIn("yueniang", jin_ping_mei["id"])
        self.assertNotIn("title", jin_ping_mei["id"])

        matrix_ids = {
            item["id"] for item in config["scenarios"] if item["scope"] == "qa-matrix"
        }
        self.assertTrue(
            {
                "qa-en-short-bark",
                "qa-zh-short-bark",
                "qa-emotion-transition",
                "qa-pause-and-laughter",
                "qa-names-and-numbers",
                "qa-long-continuity",
            }.issubset(matrix_ids)
        )

    def test_review_scenario_generator_attests_rights_and_records_requests(self) -> None:
        # The adapter's own guards (timeout, bounded retry, Retry-After, redirect refusal, response
        # validation, streaming size limit, secret redaction) are asserted behaviourally in
        # scripts/fish-tts-client.test.mjs, which runs in the same CI job. Only this generator has no
        # JS test of its own, so its two runtime gates are checked here.
        generator = (
            ROOT
            / "examples/project-plateau/build/media/remotion/scripts/generate-tts-review-scenarios.mjs"
        ).read_text(encoding="utf-8")
        self.assertIn("FISH_VOICE_RIGHTS_ATTESTED", generator)
        self.assertIn("requestSha256", generator)

    def test_voiceover_release_is_hash_bound_and_fail_closed(self) -> None:
        remotion = ROOT / "examples/project-plateau/build/media/remotion"
        package = json.loads((remotion / "package.json").read_text(encoding="utf-8"))
        self.assertTrue(
            package["scripts"]["render"].startswith("npm run verify:voiceover:release")
        )
        for suite in (
            "fish-tts-client.test.mjs",
            "audio-qa.test.mjs",
            "tts-casting.test.mjs",
            "voiceover-contract.test.mjs",
        ):
            self.assertIn(suite, package["scripts"]["test:tts"])

        review = json.loads(
            (remotion / "voiceover-review.json").read_text(encoding="utf-8")
        )
        self.assertEqual(review["releaseStatus"], "APPROVED")
        self.assertEqual(review["rights"]["status"], "APPROVED")
        self.assertEqual(review["listening"]["status"], "APPROVED")
        rights_evidence = review["rights"]["evidence"].split("#", maxsplit=1)[0]
        self.assertTrue(
            (ROOT / "examples/project-plateau" / rights_evidence).is_file()
        )
        self.assertRegex(
            review["rights"]["approvedReferenceSha256"], r"^[0-9a-f]{64}$"
        )
        self.assertTrue(review["listening"]["reviewer"])
        self.assertTrue(review["listening"]["reviewedAt"])
        self.assertRegex(
            review["listening"]["approvedSourceSha256"], r"^[0-9a-f]{64}$"
        )
        self.assertRegex(
            review["listening"]["approvedNormalizedSha256"], r"^[0-9a-f]{64}$"
        )
        evidence_text = (
            ROOT / "examples/project-plateau" / rights_evidence
        ).read_text(encoding="utf-8")
        for approved_hash in (
            review["rights"]["approvedReferenceSha256"],
            review["listening"]["approvedSourceSha256"],
            review["listening"]["approvedNormalizedSha256"],
        ):
            self.assertIn(approved_hash, evidence_text)

        verifier = (remotion / "scripts/verify-voiceover.mjs").read_text(
            encoding="utf-8"
        )
        for marker in (
            "normalizedSha256",
            "normalizationSha256",
            "evaluateVoiceoverRelease",
            "releaseMode",
        ):
            self.assertIn(marker, verifier)

    def test_readme_defaults_to_english_with_a_chinese_counterpart(self) -> None:
        english = (ROOT / "README.md").read_text(encoding="utf-8")
        chinese = (ROOT / "README_ZH.md").read_text(encoding="utf-8")

        self.assertIn(
            "> Turn a novel in any language into a source-grounded, fully playable game.",
            english,
        )
        self.assertIn("[中文](README_ZH.md)", english)
        self.assertIn("> 把任何语言的小说，改编成有原著依据、可完整游玩的游戏。", chinese)
        self.assertIn("[English](README.md)", chinese)
        self.assertFalse((ROOT / "README_EN.md").exists())

    def test_chinese_readme_avoids_stock_contrast_and_awkward_example_copy(self) -> None:
        readme = (ROOT / "README_ZH.md").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"不是[^。\n]{0,80}[，,]?\s*而是", readme))
        self.assertNotIn("活体家庭取景", readme)
        self.assertIn("## 在线试玩", readme)
        self.assertNotIn("## 先玩游戏", readme)

        canonical_demo = "https://plateau.vibecoco.ai"
        public_preview_docs = {
            "README_ZH.md": readme,
            "README.md": (ROOT / "README.md").read_text(encoding="utf-8"),
            "RUN.md": (
                ROOT / "examples/project-plateau/build/app/RUN.md"
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


class NarrativeTrackTests(unittest.TestCase):
    """The narrative track must be additive.

    Discussion #17 reported that interactive-fiction targets degenerate into card,
    round and resource gameplay. The fix is a second track with its own equally hard
    judging criteria -- not a softer bar for everyone. These tests pin both halves of
    that bargain: the cross-genre rigor stays, and the narrative track exists.
    """

    def test_cross_genre_rigor_survives_in_concept_and_design(self) -> None:
        """Rules that a previous narrative-first refactor deleted for every genre."""
        concept_skill = (ROOT / "skills/game-concept/SKILL.md").read_text(
            encoding="utf-8"
        )
        concept_method = (
            ROOT / "skills/game-concept/references/concept-method.md"
        ).read_text(encoding="utf-8")
        design_skill = (ROOT / "skills/game-world-design/SKILL.md").read_text(
            encoding="utf-8"
        )

        for marker in ("同玩法", "三段弧"):
            self.assertIn(marker, concept_skill)
        for marker in ("硬否决", "无先例", "无弧线"):
            self.assertIn(marker, concept_method)
        for marker in (
            "三段弧",
            "只写不读",
            "数值预算表",
            "决策深度示例",
            "品类保真",
        ):
            self.assertIn(marker, design_skill)

    def test_interactive_fiction_is_not_vetoed_for_being_text(self) -> None:
        """The old veto #1 rejected any concept whose player mainly reads dialogue.

        That single line forced every novel adaptation to bolt on cards or resources
        to survive concept selection. The veto must target consequence-free choice,
        not the presentation medium.
        """
        concept_method = (
            ROOT / "skills/game-concept/references/concept-method.md"
        ).read_text(encoding="utf-8")
        self.assertNotIn("玩家主要阅读对白或沿固定剧情点击", concept_method)
        self.assertIn("不是承载媒介", concept_method)
        self.assertIn("都不是本条的判据", concept_method)

    def test_agency_contract_is_stated_across_the_pipeline(self) -> None:
        """Causal rights + settlement rights: the gate against 'agency == a resource UI'."""
        for relative_path in (
            "skills/novel-to-game/SKILL.md",
            "skills/game-concept/references/concept-method.md",
            "skills/game-world-design/references/narrative-design-method.md",
        ):
            with self.subTest(path=relative_path):
                content = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn("因果权", content)
                self.assertIn("结算权", content)

    def test_narrative_methods_are_reachable_from_the_design_skill(self) -> None:
        """A craft file nothing links to is a craft file nothing reads."""
        design_skill = (ROOT / "skills/game-world-design/SKILL.md").read_text(
            encoding="utf-8"
        )
        references = ROOT / "skills/game-world-design/references"
        for name in (
            "narrative-design-method.md",
            "dialogue-design-method.md",
            "game-writing-craft.md",
            "numeric-design-method.md",
            "world-design-method.md",
        ):
            with self.subTest(reference=name):
                self.assertTrue((references / name).is_file())
                self.assertIn(name, design_skill)

    def test_hidden_state_rules_prefer_consequence_over_locked_content(self) -> None:
        """Discussion #17 asked for variables as hidden causal tags, not stat panels."""
        numeric = (
            ROOT / "skills/game-world-design/references/numeric-design-method.md"
        ).read_text(encoding="utf-8")
        narrative = (
            ROOT / "skills/game-world-design/references/narrative-design-method.md"
        ).read_text(encoding="utf-8")
        self.assertIn("隐藏旗标", numeric)
        self.assertIn("限制行动广度", numeric)
        self.assertIn("写入 → 第一次读取 → 延迟读取 → 玩家感知", narrative)

    def test_qa_asserts_branch_reachability_and_no_crossover(self) -> None:
        """Complaint #5 in Discussion #17 was characters bleeding across branches."""
        contract = (ROOT / "skills/game-qa/references/qa-contract.md").read_text(
            encoding="utf-8"
        )
        for marker in (
            "分支可达",
            "旗标被消费",
            "未选事实不串线",
            "人物知识边界",
            "结局区分",
        ):
            self.assertIn(marker, contract)

    def test_qa_keeps_the_schema_v2_core_check_names(self) -> None:
        """Renaming coreLoop without touching the validator breaks every example."""
        contract = (ROOT / "skills/game-qa/references/qa-contract.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("coreLoop", contract)
        self.assertIn("schema v2", contract)
        # validate_repo.py hard-requires schemaVersion 2; the prose must not tell
        # generated projects to emit a version the repository validator rejects.
        self.assertNotIn("schemaVersion: 3", contract)
        self.assertNotIn("schema v3", contract)
        self.assertIn("coreLoop", (ROOT / "skills/game-qa/SKILL.md").read_text(
            encoding="utf-8"
        ))

    def test_interactive_fiction_precedents_carry_sourced_figures(self) -> None:
        """Same-gameplay precedents need a sourced number, narrative track included."""
        benchmark = (
            ROOT / "skills/novel-to-game/references/intake-benchmark-reference.md"
        ).read_text(encoding="utf-8")
        self.assertIn("互动叙事", benchmark)
        # Assert the tag form, not the bare word: the file's own disclaimer sentence
        # ("这张表凭通用知识整理，不是已核实的定论") satisfies a substring check forever,
        # so `assertIn("已核实", ...)` cannot fail and proves nothing.
        self.assertGreaterEqual(benchmark.count("·**已核实**"), 5)
        for precedent in ("隐形守护者", "山河旅探", "逆转裁判"):
            with self.subTest(precedent=precedent):
                self.assertIn(precedent, benchmark)
        # Unverified figures must stay explicitly unusable as evidence.
        self.assertIn("未能核实", benchmark)


class RuleShapeTests(unittest.TestCase):
    """Marker strings catch `rm`; these catch `sed`.

    A refactor can keep every heading and marker while hollowing the body -- e.g.
    "narrative-led projects may skip this section". That is the same regression as
    deletion and must fail the same way.
    """

    def _hollow(
        self, relative_path: str, old: str, new: str, *, count: int = 1
    ) -> list[str]:
        """Copy the skills tree, degrade one rule, and report what the guard says."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(ROOT / "skills", root / "skills")
            target = root / relative_path
            text = target.read_text(encoding="utf-8")
            self.assertIn(old, text, f"anchor missing in {relative_path}")
            target.write_text(text.replace(old, new, count), encoding="utf-8")
            return validate_rule_shape(root)

    def test_current_tree_has_no_hollowed_rules(self) -> None:
        self.assertEqual(validate_rule_shape(ROOT), [])

    def test_exempting_a_hard_veto_is_rejected(self) -> None:
        issues = self._hollow(
            "skills/game-concept/references/concept-method.md",
            "- **无弧线**：",
            "- **无弧线**：叙事主导豁免本条，只要文本量在增加即可。",
        )
        self.assertTrue(
            any("硬否决" in issue and "豁免本条" in issue for issue in issues), issues
        )

    def test_denying_an_exemption_is_not_flagged(self) -> None:
        """`文学契合度不构成豁免` denies an exemption and must stay legal."""
        method = (
            ROOT / "skills/game-concept/references/concept-method.md"
        ).read_text(encoding="utf-8")
        self.assertIn("不构成豁免", method)
        self.assertEqual(validate_rule_shape(ROOT), [])

    def test_narrative_switch_must_name_its_replacement(self) -> None:
        issues = self._hollow(
            "skills/game-world-design/SKILL.md",
            "**叙事主导取**：换成隐藏状态预算表",
            "**叙事主导取**：叙事主导可跳过。",
        )
        self.assertTrue(any("数值预算表" in issue for issue in issues), issues)

    def test_deleting_a_narrative_clause_fails_like_deleting_the_rule(self) -> None:
        """Positional evasion: drop the clause and put the exemption far from any marker.

        The earlier window-based guard missed this, which defeated its own stated goal
        of treating hollowing the same way as deletion.
        """
        design = (ROOT / "skills/game-world-design/SKILL.md").read_text(encoding="utf-8")
        start = design.index("9. 数值预算表——")
        end = design.index("10. 决策深度示例")
        padding = "备注：本节的目的是让门槛可演算，避免出现无法达成的档位。" * 4
        issues = self._hollow(
            "skills/game-world-design/SKILL.md",
            design[start:end],
            "9. 数值预算表——凡被门槛引用的数值，写出起始值并演算一条及格线路径。"
            + padding
            + "\n   叙事主导时这一节不必产出任何表格。\n",
        )
        self.assertTrue(
            any("数值预算表" in issue and "narrative-track" in issue for issue in issues),
            issues,
        )

    def test_paraphrasing_a_veto_into_self_attestation_is_rejected(self) -> None:
        """A phrase list is evadable; the veto's falsifiable predicate is not."""
        method = (
            ROOT / "skills/game-concept/references/concept-method.md"
        ).read_text(encoding="utf-8")
        start = method.index("- **无弧线**：")
        end = method.index("- **能动性造假**：")
        issues = self._hollow(
            "skills/game-concept/references/concept-method.md",
            method[start:end],
            "- **无弧线**：叙事主导只要方向文档写明确认存在成长弧线并给出一句理由，"
            "即视为成立；\n",
        )
        self.assertTrue(
            any("无弧线" in issue and "falsifiable" in issue for issue in issues), issues
        )

    def test_decoy_required_word_does_not_satisfy_the_switch(self) -> None:
        """`同样` used as "equally important" must not pass as "judged the same way"."""
        design = (ROOT / "skills/game-world-design/SKILL.md").read_text(encoding="utf-8")
        start = design.index("13. 关卡节拍——")
        end = design.index("14. 首屏焦点")
        issues = self._hollow(
            "skills/game-world-design/SKILL.md",
            design[start:end],
            "13. 关卡节拍——五拍齐全。**叙事主导取**：同样重要的是节奏感，"
            "具体安排团队自己把握就好，不必照搬上面五拍的结构。\n",
        )
        self.assertTrue(any("关卡节拍" in issue for issue in issues), issues)

    def test_verified_figures_need_the_tag_form_not_the_bare_word(self) -> None:
        benchmark_path = (
            "skills/novel-to-game/references/intake-benchmark-reference.md"
        )
        # Strip every tag, the way a lazy refactor would -- the bare-word check the
        # reviewer defeated could not see this at all.
        issues = self._hollow(benchmark_path, "·**已核实**", "·凭记忆", count=-1)
        self.assertTrue(any("已核实" in issue for issue in issues), issues)


class DeclaredCheckBindingTests(unittest.TestCase):
    """A check a project declares must bind, or declaring it is theatre.

    Narrative-led builds record extra assertions (branch reachability, flag
    consumption, ...). Before this, only the profile's required set was inspected,
    so one of those could sit at FAIL under an overall PASS.
    """

    def _fixture(self, root: Path, extra: dict) -> Path:
        helper = RepositoryValidationTests()
        example = helper.make_compact_verification_fixture(root)
        path = example / "qa/verification.json"
        verification = json.loads(path.read_text(encoding="utf-8"))
        verification["checks"].update(extra)
        path.write_text(json.dumps(verification), encoding="utf-8")
        return example

    def test_failing_narrative_assertion_blocks_overall_pass(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            example = self._fixture(
                Path(tmp),
                {"branchReachability": {"status": "FAIL", "evidence": []}},
            )
            issues = validate_assurance(example, "smoke")
            self.assertTrue(
                any("branchReachability" in issue and "FAIL" in issue for issue in issues),
                issues,
            )

    def test_passing_narrative_assertion_still_needs_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            example = self._fixture(
                Path(tmp), {"flagConsumption": {"status": "PASS", "evidence": []}}
            )
            issues = validate_assurance(example, "smoke")
            self.assertTrue(
                any("flagConsumption" in issue and "evidence" in issue for issue in issues),
                issues,
            )

    def test_well_formed_narrative_assertions_are_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            example = self._fixture(
                Path(tmp),
                {
                    "branchIsolation": {
                        "status": "PASS",
                        "evidence": ["qa/evidence/run.json"],
                    }
                },
            )
            self.assertEqual(validate_assurance(example, "smoke"), [])

    def test_contract_documents_the_machine_key_names(self) -> None:
        contract = (ROOT / "skills/game-qa/references/qa-contract.md").read_text(
            encoding="utf-8"
        )
        for key in (
            "branchReachability",
            "flagConsumption",
            "branchIsolation",
            "characterKnowledge",
            "delayedEcho",
            "endingDistinction",
        ):
            with self.subTest(key=key):
                self.assertIn(key, contract)


if __name__ == "__main__":
    unittest.main()
