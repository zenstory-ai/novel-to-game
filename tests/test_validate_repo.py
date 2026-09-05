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
    OUTPUT_LANGUAGE_RULE,
    REFERENCE_LINE_BUDGET,
    SKILL_MD_LINE_BUDGET,
    SKILL_TOTAL_LINE_BUDGET,
    parse_numeral,
    read_manifest,
    validate_qa,
    validate_readme_example_order,
    validate_skill,
    validate_skill_budget,
    visible_directories,
)


def rewrite_json(path: Path, mutate) -> None:
    value = json.loads(path.read_text(encoding="utf-8"))
    mutate(value)
    path.write_text(json.dumps(value), encoding="utf-8")


def make_skill(root: Path, description: str, body: str) -> Path:
    skill = root / "demo"
    (skill / "agents").mkdir(parents=True)
    (skill / "SKILL.md").write_text(
        f"---\nname: demo\ndescription: {description}\n---\n# Demo\n\n{body}\n",
        encoding="utf-8",
    )
    (skill / "agents/openai.yaml").write_text(
        'interface:\n  default_prompt: "Use $demo."\n', encoding="utf-8"
    )
    return skill


def make_verification_fixture(root: Path) -> Path:
    project = root / "project"
    shutil.copytree(ROOT / "tests/fixtures/minimal-evidence", project)
    result = subprocess.run(
        [sys.executable, "verify.py"],
        cwd=project,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    return project


class RepositoryValidationTests(unittest.TestCase):
    def test_minimal_qa_rejects_a_broken_verification_record(self) -> None:
        cases = {
            "checks.restart": lambda v: v["checks"].pop("restart"),
            "checks must contain exactly": lambda v: v["checks"].update(performance="PASS"),
            "unknown fields": lambda v: v.update(legacyField="removed"),
            "status must PASS": lambda v: v.update(status="FAIL"),
            "completeRun.evidence is required": lambda v: v["completeRun"].pop("evidence"),
            "limitations[0].reason": lambda v: v.update(
                limitations=[{"scope": "restart", "reason": ""}]
            ),
        }
        for expected, mutate in cases.items():
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as temporary:
                example = make_verification_fixture(Path(temporary))
                rewrite_json(example / "qa/verification.json", mutate)
                issues = validate_qa(example)
                self.assertTrue(any(expected in issue for issue in issues), issues)

    def test_minimal_qa_rejects_placeholder_or_unbound_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = make_verification_fixture(Path(temporary))
            evidence = example / "qa/evidence/run.json"

            evidence.write_text("complete run captured\n", encoding="utf-8")
            self.assertTrue(any("invalid JSON" in issue for issue in validate_qa(example)))

            evidence.write_text("", encoding="utf-8")
            self.assertTrue(any("must not be empty" in issue for issue in validate_qa(example)))

            evidence.unlink()
            self.assertTrue(
                any("completeRun.evidence does not exist" in issue for issue in validate_qa(example))
            )

        with tempfile.TemporaryDirectory() as temporary:
            example = make_verification_fixture(Path(temporary))

            def unbind(run: dict) -> None:
                del run["observations"]["input"]
                run["observations"]["outcome"]["state"] = {"terminal": "other"}

            rewrite_json(example / "qa/evidence/run.json", unbind)
            issues = validate_qa(example)
            self.assertTrue(any("observations must contain exactly" in issue for issue in issues), issues)
            self.assertTrue(any("must record completeRun.terminal" in issue for issue in issues), issues)

    def test_minimal_evidence_fixture_runs_one_complete_verification(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            project = make_verification_fixture(Path(temporary))
            self.assertEqual(validate_qa(project), [])

    def test_readme_example_link_order_must_match_between_languages(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "README.md").write_text("[A](examples/a/) [B](examples/b/)", encoding="utf-8")
            (root / "README_ZH.md").write_text("[乙](examples/b/) [甲](examples/a/)", encoding="utf-8")
            issues = validate_readme_example_order(root)
            self.assertTrue(any("example link order must match" in issue for issue in issues), issues)

    def test_vercel_deploy_never_re_enters_the_project_root_directory(self) -> None:
        """每个 Vercel 项目自己拥有 Root Directory；在 app 目录里跑会把同一段路径追加两次。"""
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        self.assertNotIn("working-directory:", workflow)
        for name in sorted(visible_directories(ROOT / "examples")):
            if (ROOT / "examples" / name / "build/app").is_dir():
                self.assertIn(f"examples/{name}/build/app/**", workflow)

    def test_skill_validator_rejects_a_broken_skill(self) -> None:
        cases = (
            ("unresolved TODO", "demo", "TODO"),
            ("broken link", "demo", "[missing](references/missing.md)"),
            ("link leaves skill", "demo", "[other](../other.md)"),
            ("description must lead with English", "中文开头的描述", OUTPUT_LANGUAGE_RULE),
            ("missing the output-language rule", "An English-first description.", "没有语言规则。"),
        )
        for expected, description, body in cases:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                (root / "other.md").write_text("# Other\n", encoding="utf-8")
                issues = validate_skill(make_skill(root, description, body))
                self.assertTrue(any(expected in issue for issue in issues), issues)

    def test_numeral_parsing_covers_every_declared_kind(self) -> None:
        self.assertEqual(parse_numeral("一百", "chinese"), 100)
        self.assertEqual(parse_numeral("三十七", "chinese"), 37)
        self.assertEqual(parse_numeral("24", "arabic"), 24)
        self.assertEqual(parse_numeral("XXIV", "roman"), 24)
        self.assertEqual(parse_numeral("iv", "roman"), 4)

    def test_manifest_validator_rejects_a_bad_manifest(self) -> None:
        manifest = {
            "language": "en",
            "source": {"chapters": 24, "headingPattern": "^Chapter ([0-9]+)$", "numeral": "arabic"},
            "coverageHeading": "Full-book coverage",
            "citationPattern": "chapter ([0-9]+)",
            "targetFinish": "graybox",
        }
        with tempfile.TemporaryDirectory() as temporary:
            example = Path(temporary) / "demo"
            example.mkdir()
            path = example / EXAMPLE_MANIFEST

            self.assertTrue(any(EXAMPLE_MANIFEST in issue for issue in read_manifest(example)[1]))

            path.write_text("{not json", encoding="utf-8")
            self.assertTrue(any("invalid JSON" in issue for issue in read_manifest(example)[1]))

            path.write_text(json.dumps(manifest), encoding="utf-8")
            self.assertEqual(read_manifest(example), (manifest, []))

            manifest["provenance"] = {"license": "public-domain"}
            path.write_text(json.dumps(manifest), encoding="utf-8")
            self.assertEqual(read_manifest(example), (manifest, []))

            rewrite_json(path, lambda m: m["source"].update(numeral="hex"))
            self.assertTrue(any("numeral must be one of" in issue for issue in read_manifest(example)[1]))

            rewrite_json(path, lambda m: m["source"].update(headingPattern="^Chapter ([0-9+$"))
            self.assertTrue(any("headingPattern" in issue for issue in read_manifest(example)[1]))

    def test_visible_directories_skips_agent_state_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "journey-to-the-west").mkdir()
            (root / ".omc").mkdir()
            (root / "notes.md").write_text("", encoding="utf-8")
            self.assertEqual(visible_directories(root), {"journey-to-the-west"})

    def test_skill_budget_rejects_growth_past_the_ceilings(self) -> None:
        """预算要真的撑住：单文件超重与总量超重各报一条。"""
        with tempfile.TemporaryDirectory() as temporary:
            skills_root = Path(temporary)
            lean = skills_root / "lean"
            lean.mkdir()
            (lean / "SKILL.md").write_text("x\n" * 10, encoding="utf-8")
            self.assertEqual(validate_skill_budget(skills_root), [])

            (lean / "SKILL.md").write_text("x\n" * (SKILL_MD_LINE_BUDGET + 1), encoding="utf-8")
            self.assertTrue(any("SKILL.md budget" in issue for issue in validate_skill_budget(skills_root)))

            (lean / "references").mkdir()
            (lean / "references/deep.md").write_text("x\n" * (REFERENCE_LINE_BUDGET + 1), encoding="utf-8")
            self.assertTrue(any("reference budget" in issue for issue in validate_skill_budget(skills_root)))

            bulk = skills_root / "bulk"
            (bulk / "references").mkdir(parents=True)
            for index in range(SKILL_TOTAL_LINE_BUDGET // REFERENCE_LINE_BUDGET + 1):
                (bulk / f"references/part{index}.md").write_text(
                    "x\n" * REFERENCE_LINE_BUDGET, encoding="utf-8"
                )
            self.assertTrue(any("total budget" in issue for issue in validate_skill_budget(skills_root)))

    def test_runtime_markdown_headings_match_the_declared_language(self) -> None:
        """技能与 references 恒为简体中文；示例按自己 manifest 声明的语言判。"""
        cjk = re.compile(r"[㐀-鿿]")
        roots = [ROOT / "skills"]
        for name in sorted(visible_directories(ROOT / "examples")):
            manifest, issues = read_manifest(ROOT / "examples" / name)
            self.assertEqual(issues, [])
            if str(manifest["language"]).startswith("zh"):
                roots.append(ROOT / "examples" / name)

        violations = [
            f"{markdown.relative_to(ROOT)}:{line_number}: {line}"
            for root in roots
            for markdown in root.rglob("*.md")
            if not any(part.startswith(".") for part in markdown.relative_to(ROOT).parts)
            for line_number, line in enumerate(
                markdown.read_text(encoding="utf-8").splitlines(), start=1
            )
            if line.startswith("#") and not cjk.search(line)
        ]
        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
