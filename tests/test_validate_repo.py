from __future__ import annotations

import json
import hashlib
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
    validate_publication,
    validate_readme_publication_claims,
    validate_repository,
    validate_skill,
    validation_json_files,
    visible_directories,
)


class RepositoryValidationTests(unittest.TestCase):
    def make_publication_fixture(
        self, root: Path, *, tier: str = "showcase", target: str | None = None
    ) -> Path:
        example = root / "examples/demo"
        (example / "qa").mkdir(parents=True)
        (example / "build").mkdir()
        (example / "design").mkdir()
        target = target or tier
        (example / "example.json").write_text(
            json.dumps({"publicationTier": tier}), encoding="utf-8"
        )
        (example / "_progress.md").write_text(
            "\n".join(
                f"- gate:{gate} pass"
                for gate in ("intake", "analyze", "concept", "design", "art", "build", "qa")
            )
            + "\n",
            encoding="utf-8",
        )
        for relative in ("PRODUCT_BRIEF.md", "design/ART_DIRECTION.md"):
            (example / relative).write_text(f"targetFinish: {target}\n", encoding="utf-8")
        (example / "design/VISUAL_TARGETS.md").write_text(
            f"targetFinish: {target}\n", encoding="utf-8"
        )
        (example / "qa/QA_REPORT.md").write_text(
            f"targetFinish: {target}\n", encoding="utf-8"
        )
        (example / "build/BUILD_BRIEF.md").write_text(
            f"targetFinish: {target}\n"
            f"publicationTier: {tier}\n"
            f"demonstratedTier: {tier}\n"
            "grayboxReady: PASS\n"
            "visualPromotion: PASS\n",
            encoding="utf-8",
        )
        for relative in (
            "qa/evidence/complete-run.json",
            "qa/evidence/frame.png",
            "qa/evidence/state.json",
            "qa/evidence/browser.json",
            "qa/evidence/review.md",
            "qa/evidence/promotion.md",
            "qa/evidence/target.svg",
            "qa/evidence/verify.log",
            "build/evidence/hero.png",
        ):
            path = example / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("evidence", encoding="utf-8")
        source_input = example / "build/candidate.bin"
        source_input.write_bytes(b"candidate")
        digest = hashlib.sha256()
        digest.update(b"candidate.bin\0candidate\0")
        source_fingerprint = digest.hexdigest()
        source_manifest = example / "build/source-inputs.json"
        source_manifest.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "basePath": "build",
                    "sourceFingerprint": source_fingerprint,
                    "inputs": [
                        {
                            "path": "candidate.bin",
                            "sha256": hashlib.sha256(source_input.read_bytes()).hexdigest(),
                            "bytes": source_input.stat().st_size,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        source_manifest_hash = hashlib.sha256(source_manifest.read_bytes()).hexdigest()
        verification = example / "qa/verification.json"
        verification.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "sourceCommit": None,
                    "sourceFingerprint": source_fingerprint,
                    "verify": {
                        "command": "run authoritative verification",
                        "log": "qa/evidence/verify.log",
                        "logSha256": hashlib.sha256(
                            (example / "qa/evidence/verify.log").read_bytes()
                        ).hexdigest(),
                        "exitCode": 0,
                        "durationMs": 1,
                        "suites": [
                            {
                                "id": "authoritative",
                                "locations": ["test/basic.js"],
                                "executed": True,
                                "passed": True,
                                "commands": [
                                    {
                                        "command": "run tests",
                                        "exitCode": 0,
                                        "durationMs": 1,
                                    }
                                ],
                            }
                        ],
                        "registry": {
                            "discovered": ["test/basic.js"],
                            "registered": ["test/basic.js"],
                            "excluded": {},
                            "problems": [],
                        },
                    },
                    "completeRun": {
                        "id": "complete-run",
                        "cleanContext": True,
                        "steps": [
                            {
                                "id": "step-1",
                                "input": "start, act, finish, restart",
                                "expected": "complete loop",
                                "checkpoint": "complete-run:result",
                            }
                        ],
                        "terminal": "result",
                        "restart": "clean-start",
                    },
                    "checkpoints": [
                        {
                            "id": "complete-run:result",
                            "state": "qa/evidence/state.json",
                            "browser": "qa/evidence/browser.json",
                            "visual": "qa/evidence/frame.png",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        visual_manifest = example / "qa/evidence/visual-manifest.json"
        frame = example / "qa/evidence/frame.png"
        target_asset = example / "qa/evidence/target.svg"
        visual_manifest.write_text(
            json.dumps(
                {
                    "sourceFingerprint": source_fingerprint,
                    "captures": [
                        {
                            "path": "qa/evidence/frame.png",
                            "sha256": hashlib.sha256(frame.read_bytes()).hexdigest(),
                            "bytes": frame.stat().st_size,
                        }
                    ],
                    "contactSheet": {
                        "path": "qa/evidence/frame.png",
                        "sha256": hashlib.sha256(frame.read_bytes()).hexdigest(),
                        "bytes": frame.stat().st_size,
                    },
                    "targets": [
                        {
                            "id": "signature",
                            "path": "qa/evidence/target.svg",
                            "sha256": hashlib.sha256(target_asset.read_bytes()).hexdigest(),
                            "bytes": target_asset.stat().st_size,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        visual_manifest_hash = hashlib.sha256(visual_manifest.read_bytes()).hexdigest()
        (example / "build/asset-ledger.json").write_text(
            json.dumps(
                {
                    "entries": [
                        {
                            "key": "hero",
                            "tier": "release-gate",
                            "status": "production",
                            "releaseGatePassed": True,
                            "evidence": ["evidence/hero.png"],
                            "remaining": "none",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        (example / "qa/release-gates.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "sourceCommit": None,
                    "evidenceCommit": None,
                    "sourceFingerprint": source_fingerprint,
                    "sourceInputManifest": {
                        "path": "build/source-inputs.json",
                        "sha256": source_manifest_hash,
                    },
                    "visualEvidenceManifests": [
                        {
                            "path": "qa/evidence/visual-manifest.json",
                            "sha256": visual_manifest_hash,
                        }
                    ],
                    "targetFinish": target,
                    "publicationTier": tier,
                    "demonstratedTier": tier,
                    "pipelineGates": {
                        "intake": "PASS",
                        "analyze": "PASS",
                        "concept": "PASS",
                        "design": "PASS",
                        "art": "PASS",
                        "build": "PASS",
                        "qa": "PASS",
                    },
                    "grayboxReady": {
                        "status": "PASS",
                        "evidence": ["qa/evidence/complete-run.json"],
                    },
                    "visualPromotion": {
                        "status": "PASS",
                        "evidence": ["qa/evidence/promotion.md"],
                    },
                    "visualFrames": [
                        {
                            "id": "signature",
                            "status": "PASS",
                            "operationPath": "Start a run and reach the signature frame.",
                            "evidence": ["qa/evidence/frame.png"],
                            "rubric": {
                                "focus": "PASS",
                                "silhouette": "PASS",
                                "depth": "PASS",
                                "materialLine": "PASS",
                                "lightColor": "PASS",
                                "hud": "PASS",
                                "motionFeedback": "PASS",
                                "artifacts": "PASS",
                                "failureExamples": "PASS",
                            },
                        }
                    ],
                    "visualReview": {
                        "required": True,
                        "status": "PASS",
                        "reviewer": "independent-reviewer",
                        "independence": "Did not implement the build",
                        "evidence": "qa/evidence/review.md",
                        "reviewedSourceFingerprint": source_fingerprint,
                        "reviewedManifestSha256": visual_manifest_hash,
                    },
                    "focalReleaseAssets": ["hero"],
                    "degradableReleaseAssets": [],
                    "unresolvedDefects": [],
                }
            ),
            encoding="utf-8",
        )
        return example

    def test_showcase_publication_requires_progress_gates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary))
            (example / "_progress.md").write_text(
                "- gate:art pass\n- gate:qa pass\n", encoding="utf-8"
            )
            issues = validate_publication(example, "showcase")
            self.assertTrue(any("_progress.md: missing unambiguous gate:build pass" in issue for issue in issues), issues)

    def test_showcase_publication_requires_release_gate_assets_to_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary))
            ledger = json.loads((example / "build/asset-ledger.json").read_text())
            ledger["entries"][0]["releaseGatePassed"] = False
            (example / "build/asset-ledger.json").write_text(json.dumps(ledger))
            issues = validate_publication(example, "showcase")
            self.assertTrue(any("asset-ledger.json: hero.releaseGatePassed must be true" in issue for issue in issues), issues)

    def test_showcase_publication_rejects_not_run_required_visual_review(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary))
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["visualReview"]["status"] = "NOT_RUN"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "showcase")
            self.assertTrue(any("visualReview.status must be PASS" in issue for issue in issues), issues)

    def test_showcase_publication_requires_matching_release_manifest_tier(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary))
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["publicationTier"] = "playable-prototype"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "showcase")
            self.assertTrue(any("publicationTier must match example.json" in issue for issue in issues), issues)

    def test_playable_publication_rejects_release_fingerprint_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["sourceFingerprint"] = "0" * 64
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("sourceFingerprint must match qa/verification.json" in issue for issue in issues), issues)

    def test_non_graybox_recomputes_current_workspace_app_fingerprint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            app = example / "build/app"
            (app / "src").mkdir(parents=True)
            (app / "index.html").write_text("candidate", encoding="utf-8")
            (app / "src/main.js").write_text("console.log('changed')", encoding="utf-8")
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(
                any("current workspace app fingerprint" in issue for issue in issues),
                issues,
            )

    def test_non_graybox_requires_recursive_source_input_manifest(self) -> None:
        mutations = {
            "missing_binding": lambda example, release, manifest: release.pop(
                "sourceInputManifest"
            ),
            "empty_inputs": lambda example, release, manifest: manifest.update(
                {"inputs": []}
            ),
            "tampered_input": lambda example, release, manifest: (
                example / "build/candidate.bin"
            ).write_bytes(b"tampered"),
        }
        for label, mutate in mutations.items():
            with self.subTest(case=label), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                release_path = example / "qa/release-gates.json"
                manifest_path = example / "build/source-inputs.json"
                release = json.loads(release_path.read_text(encoding="utf-8"))
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                mutate(example, release, manifest)
                if label == "empty_inputs":
                    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                    release["sourceInputManifest"]["sha256"] = hashlib.sha256(
                        manifest_path.read_bytes()
                    ).hexdigest()
                release_path.write_text(json.dumps(release), encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any("sourceInputManifest" in issue for issue in issues), issues)

    def test_non_graybox_requires_structured_successful_verification(self) -> None:
        mutations = {
            "missing_verify": lambda value: value.pop("verify"),
            "failed_verify": lambda value: value["verify"].update({"exitCode": 1}),
            "invalid_log_hash": lambda value: value["verify"].update(
                {"logSha256": "0" * 64}
            ),
            "nan_duration": lambda value: value["verify"].update(
                {"durationMs": float("nan")}
            ),
            "empty_suites": lambda value: value["verify"].update({"suites": []}),
            "duplicate_suites": lambda value: value["verify"]["suites"].append(
                dict(value["verify"]["suites"][0])
            ),
            "unexecuted_suite": lambda value: value["verify"]["suites"][0].update(
                {"executed": False}
            ),
            "failed_command": lambda value: value["verify"]["suites"][0][
                "commands"
            ][0].update({"exitCode": 1}),
            "infinite_command_duration": lambda value: value["verify"]["suites"][0][
                "commands"
            ][0].update({"durationMs": float("inf")}),
            "missing_complete_run": lambda value: value.pop("completeRun"),
            "missing_checkpoints": lambda value: value.pop("checkpoints"),
            "unbound_step": lambda value: value["completeRun"]["steps"][0].update(
                {"checkpoint": "missing"}
            ),
            "missing_evidence": lambda value: value["checkpoints"][0].update(
                {"visual": "qa/evidence/missing.png"}
            ),
            "registry_problem": lambda value: value["verify"]["registry"][
                "problems"
            ].append("orphan"),
            "registry_mismatch": lambda value: value["verify"]["registry"].update(
                {"discovered": ["test/basic.js", "test/orphan.js"]}
            ),
            "empty_registry": lambda value: value["verify"]["registry"].update(
                {"discovered": [], "registered": []}
            ),
            "registered_not_covered": lambda value: value["verify"]["registry"].update(
                {
                    "discovered": ["test/basic.js", "test/missed.js"],
                    "registered": ["test/basic.js", "test/missed.js"],
                }
            ),
            "empty_exclusion_reason": lambda value: value["verify"]["registry"].update(
                {
                    "discovered": ["test/basic.js", "test/excluded.py"],
                    "excluded": {"test/excluded.py": ""},
                }
            ),
        }
        for label, mutate in mutations.items():
            with self.subTest(case=label), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                path = example / "qa/verification.json"
                verification = json.loads(path.read_text(encoding="utf-8"))
                mutate(verification)
                path.write_text(json.dumps(verification), encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(
                    any("qa/verification.json" in issue for issue in issues), issues
                )

    def test_hidden_verification_candidate_does_not_replace_authoritative_record(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            authoritative_path = example / "qa/verification.json"
            authoritative = json.loads(authoritative_path.read_text(encoding="utf-8"))
            candidate_path = example / "qa/.verification-candidate.json"
            candidate_path.write_text(json.dumps(authoritative), encoding="utf-8")
            authoritative["verify"]["exitCode"] = 1
            authoritative_path.write_text(json.dumps(authoritative), encoding="utf-8")

            failed = validate_publication(example, "playable-prototype")
            self.assertTrue(
                any("verify.exitCode must be 0" in issue for issue in failed), failed
            )
            staged = validate_publication(
                example,
                "playable-prototype",
                verification_candidate=candidate_path,
            )
            self.assertFalse(
                any("verify.exitCode must be 0" in issue for issue in staged), staged
            )
            self.assertEqual(
                json.loads(authoritative_path.read_text(encoding="utf-8"))["verify"][
                    "exitCode"
                ],
                1,
            )

    def test_authoritative_verification_log_is_content_bound(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            (example / "qa/evidence/verify.log").write_text(
                "tampered after verification\n", encoding="utf-8"
            )
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(
                any("verify.logSha256 does not match verify.log" in issue for issue in issues),
                issues,
            )

    def test_web_verification_registry_must_match_actual_test_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            test_dir = example / "build/app/test"
            test_dir.mkdir(parents=True)
            (test_dir / "injected.py").write_text("pass\n", encoding="utf-8")
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(
                any("registry.discovered does not match build/app/test files" in issue for issue in issues),
                issues,
            )

    def test_visual_manifest_recursively_binds_referenced_files(self) -> None:
        for relative in ("qa/evidence/frame.png", "qa/evidence/target.svg"):
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                (example / relative).write_text("tampered", encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(
                    any(
                        "visualEvidenceManifests[0]" in issue and relative in issue
                        for issue in issues
                    ),
                    issues,
                )

    def test_visual_manifest_binds_ordered_motion_cadence(self) -> None:
        def replace_video_with_bound_non_media(
            example: Path, manifest: dict[str, object]
        ) -> None:
            video = example / "qa/evidence/cadence.webm"
            video.write_bytes(b"not media")
            binding = manifest["motionCadence"]["video"]
            binding["sha256"] = hashlib.sha256(video.read_bytes()).hexdigest()
            binding["bytes"] = video.stat().st_size

        def truncate_video_with_consistent_binding(
            example: Path, manifest: dict[str, object]
        ) -> None:
            video = example / "qa/evidence/cadence.webm"
            payload = video.read_bytes()
            video.write_bytes(payload[: len(payload) // 10])
            binding = manifest["motionCadence"]["video"]
            binding["sha256"] = hashlib.sha256(video.read_bytes()).hexdigest()
            binding["bytes"] = video.stat().st_size

        mutations = {
            "valid": lambda _example, _manifest: None,
            "tampered_video": lambda example, manifest: (
                example / "qa/evidence/cadence.webm"
            ).write_bytes(b"tampered"),
            "wrong_phase_order": lambda _example, manifest: manifest["motionCadence"][
                "samples"
            ].reverse(),
            "console_error": lambda _example, manifest: manifest["motionCadence"].update(
                {"consoleErrors": ["render failed"]}
            ),
            "hash_consistent_non_media": replace_video_with_bound_non_media,
            "hash_consistent_truncated_video": truncate_video_with_consistent_binding,
            "decodable_video_too_short": lambda _example, manifest: (
                manifest["motionCadence"].update({"authoredCycleSeconds": 999}),
                manifest["motionCadence"]["transitions"][-1].update(
                    {"atMs": 999000}
                ),
            ),
            "wrong_threat_mapping": lambda _example, manifest: manifest[
                "motionCadence"
            ]["samples"][0].update({"threatState": "attack"}),
        }
        for label, mutate in mutations.items():
            with self.subTest(case=label), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                video = example / "qa/evidence/cadence.webm"
                source_motion = (
                    ROOT
                    / "examples/project-plateau/build/evidence/visual-upgrade/generated/motion"
                )
                shutil.copyfile(source_motion / "watch-bank-dive-pull-up.webm", video)
                samples = []
                for index, phase in enumerate(("watch", "bank", "dive", "pull-up")):
                    path = example / f"qa/evidence/{phase}.jpg"
                    shutil.copyfile(source_motion / f"{phase}.jpg", path)
                    samples.append(
                        {
                            "phase": phase,
                            "rendererSeconds": index * 0.8,
                            "threatState": "watch" if index == 0 else "attack",
                            "rendererResponse": "orbit",
                            "path": f"qa/evidence/{phase}.jpg",
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                            "bytes": path.stat().st_size,
                        }
                    )
                manifest_path = example / "qa/evidence/visual-manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest["motionCadence"] = {
                    "authoredCycleSeconds": 3.2,
                    "transitions": [
                        {
                            "phase": "watch",
                            "atMs": 0,
                            "threatState": "watch",
                            "rendererResponse": "orbit",
                        },
                        {
                            "phase": "bank-dive-pull-up-cycle",
                            "atMs": 200,
                            "threatState": "attack",
                            "rendererResponse": "orbit",
                        },
                        {
                            "phase": "cycle-complete",
                            "atMs": 3400,
                            "threatState": "attack",
                            "rendererResponse": "orbit",
                        },
                    ],
                    "video": {
                        "path": "qa/evidence/cadence.webm",
                        "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
                        "bytes": video.stat().st_size,
                    },
                    "samples": samples,
                    "consoleErrors": [],
                }
                mutate(example, manifest)
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
                release_path = example / "qa/release-gates.json"
                release = json.loads(release_path.read_text(encoding="utf-8"))
                release["visualEvidenceManifests"][0]["sha256"] = manifest_hash
                release["visualReview"]["reviewedManifestSha256"] = manifest_hash
                release_path.write_text(json.dumps(release), encoding="utf-8")

                issues = validate_publication(example, "playable-prototype")
                motion_issues = [issue for issue in issues if "motionCadence" in issue]
                if label == "valid":
                    self.assertEqual(motion_issues, [])
                else:
                    self.assertTrue(motion_issues, issues)

    def test_non_graybox_visual_manifest_requires_non_empty_resources(self) -> None:
        for field in ("captures", "targets"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                manifest_path = example / "qa/evidence/visual-manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest[field] = []
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
                release_path = example / "qa/release-gates.json"
                release = json.loads(release_path.read_text(encoding="utf-8"))
                release["visualEvidenceManifests"][0]["sha256"] = manifest_hash
                release["visualReview"]["reviewedManifestSha256"] = manifest_hash
                release_path.write_text(json.dumps(release), encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(
                    any(f"visualEvidenceManifests[0].{field} must not be empty" in issue for issue in issues),
                    issues,
                )

    def test_visual_frames_must_bind_verified_runtime_resources_and_target_ids(self) -> None:
        mutations = {
            "unhashed_frame": lambda release: release["visualFrames"][0].update(
                {"evidence": ["qa/evidence/review.md"]}
            ),
            "target_as_runtime_frame": lambda release: release["visualFrames"][0].update(
                {"evidence": ["qa/evidence/target.svg"]}
            ),
            "wrong_target_id": lambda release: release["visualFrames"][0].update(
                {"id": "not-the-target"}
            ),
        }
        for label, mutate in mutations.items():
            with self.subTest(case=label), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                release_path = example / "qa/release-gates.json"
                release = json.loads(release_path.read_text(encoding="utf-8"))
                mutate(release)
                release_path.write_text(json.dumps(release), encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(
                    any("visualFrames" in issue and ("verified" in issue or "target" in issue) for issue in issues),
                    issues,
                )

    def test_visual_review_must_bind_current_source_and_verified_manifest(self) -> None:
        mutations = {
            "reviewedSourceFingerprint": "0" * 64,
            "reviewedManifestSha256": "0" * 64,
        }
        for field, value in mutations.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(
                    Path(temporary), tier="playable-prototype"
                )
                release_path = example / "qa/release-gates.json"
                release = json.loads(release_path.read_text(encoding="utf-8"))
                release["visualReview"][field] = value
                release_path.write_text(json.dumps(release), encoding="utf-8")
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any(f"visualReview.{field}" in issue for issue in issues), issues)

    def test_verification_source_commit_must_bind_its_app_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            example = self.make_publication_fixture(
                root, tier="playable-prototype"
            )
            app = example / "build/app"
            app.mkdir()
            (app / "index.html").write_text("committed app", encoding="utf-8")
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            subprocess.run(
                ["git", "config", "user.email", "qa@example.invalid"],
                cwd=root,
                check=True,
            )
            subprocess.run(["git", "config", "user.name", "QA"], cwd=root, check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "commit", "-qm", "candidate"], cwd=root, check=True)
            commit = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            verification_path = example / "qa/verification.json"
            verification = json.loads(verification_path.read_text(encoding="utf-8"))
            verification["sourceCommit"] = commit
            verification_path.write_text(json.dumps(verification), encoding="utf-8")
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(
                any(
                    "qa/verification.json: sourceCommit fingerprint does not match"
                    in issue
                    for issue in issues
                ),
                issues,
            )

    def test_playable_visual_manifest_requires_embedded_source_fingerprint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            manifest = example / "qa/evidence/visual-manifest.json"
            manifest.write_text(json.dumps({"captures": []}), encoding="utf-8")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["visualEvidenceManifests"][0]["sha256"] = hashlib.sha256(
                manifest.read_bytes()
            ).hexdigest()
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("sourceFingerprint is required above graybox" in issue for issue in issues), issues)

    def test_playable_publication_rejects_stale_commit_with_current_fingerprint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            example = self.make_publication_fixture(root, tier="playable-prototype")
            app = example / "build/app"
            app.mkdir()
            (app / "index.html").write_text("old", encoding="utf-8")
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.email", "qa@example.invalid"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.name", "QA"], cwd=root, check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "commit", "-qm", "old candidate"], cwd=root, check=True)
            old_commit = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=root, check=True, capture_output=True, text=True
            ).stdout.strip()
            (app / "index.html").write_text("current", encoding="utf-8")
            digest = hashlib.sha256()
            digest.update(b"index.html\0current\0")
            current_fingerprint = digest.hexdigest()
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["sourceCommit"] = old_commit
            release["sourceFingerprint"] = current_fingerprint
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            (example / "qa/verification.json").write_text(
                json.dumps({"sourceFingerprint": current_fingerprint}), encoding="utf-8"
            )
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("sourceCommit fingerprint does not match" in issue for issue in issues), issues)

    def test_graybox_and_playable_prototype_may_record_open_visual_work(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for tier in ("graybox",):
                example = self.make_publication_fixture(root / tier, tier=tier)
                release = json.loads((example / "qa/release-gates.json").read_text())
                release["sourceCommit"] = None
                release["evidenceCommit"] = None
                release["pipelineGates"]["art"] = "NOT_RUN"
                release["visualReview"]["status"] = "NOT_RUN"
                release["unresolvedDefects"] = [
                    {"id": "V1", "severity": "major", "status": "OPEN", "summary": "open"}
                ]
                (example / "qa/release-gates.json").write_text(json.dumps(release))
                self.assertEqual(validate_publication(example, tier), [])

    def test_playable_prototype_rejects_open_major(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["unresolvedDefects"] = [
                {"id": "V1", "severity": "major", "status": "OPEN", "summary": "bad"}
            ]
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            self.assertTrue(any("open major" in issue for issue in validate_publication(example, "playable-prototype")))

    def test_playable_prototype_requires_every_pipeline_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["pipelineGates"]["concept"] = "NOT_RUN"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("pipelineGates.concept must be PASS" in issue for issue in issues), issues)

    def test_progress_gate_parser_rejects_conflicting_anchored_statuses(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            with (example / "_progress.md").open("a", encoding="utf-8") as progress:
                progress.write("A note mentions gate:qa fail but is not a gate record.\n")
                progress.write("- gate:qa fail (new verdict)\n")
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("conflicting statuses" in issue for issue in issues), issues)

    def test_publication_tiers_must_follow_target_and_demonstrated_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="showcase", target="playable-prototype")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["demonstratedTier"] = "graybox"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "showcase")
            self.assertTrue(any("publicationTier exceeds targetFinish" in issue for issue in issues), issues)
            self.assertTrue(any("publicationTier exceeds demonstratedTier" in issue for issue in issues), issues)

    def test_demonstrated_tier_cannot_claim_playable_proof_under_graybox_publication(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="graybox", target="playable-prototype"
            )
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["demonstratedTier"] = "playable-prototype"
            release["visualReview"]["status"] = "NOT_RUN"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("visualReview.status must be PASS" in issue for issue in issues), issues)

    def test_target_finish_must_be_inherited_without_conflicts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="graybox", target="playable-prototype")
            (example / "design/ART_DIRECTION.md").write_text(
                "targetFinish: playable-prototype\ntargetFinish: showcase\n", encoding="utf-8"
            )
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("ART_DIRECTION.md: conflicting targetFinish" in issue for issue in issues), issues)

    def test_playable_prototype_requires_visual_frame_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["visualFrames"][0]["evidence"] = ["qa/evidence/missing.png"]
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("visualFrames[0].evidence" in issue and "does not exist" in issue for issue in issues), issues)

    def test_visual_frame_requires_operation_path_and_complete_rubric(self) -> None:
        for field in ("operationPath", "rubric"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(Path(temporary), tier="graybox")
                release = json.loads((example / "qa/release-gates.json").read_text())
                release["visualFrames"][0].pop(field)
                (example / "qa/release-gates.json").write_text(json.dumps(release))
                issues = validate_publication(example, "graybox")
                self.assertTrue(any(f"visualFrames[0].{field}" in issue for issue in issues), issues)

    def test_every_publication_tier_requires_graybox_ready_proof(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="graybox")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["grayboxReady"]["evidence"] = []
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("grayboxReady.evidence must not be empty" in issue for issue in issues), issues)

    def test_playable_prototype_requires_visual_promotion_proof(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["visualPromotion"]["evidence"] = []
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("visualPromotion.evidence must not be empty" in issue for issue in issues), issues)

    def test_playable_prototype_requires_review_identity_independence_and_evidence(self) -> None:
        mutations = {
            "reviewer": None,
            "independence": "",
            "evidence": "qa/evidence/missing-review.md",
        }
        for field, value in mutations.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
                release = json.loads((example / "qa/release-gates.json").read_text())
                release["visualReview"][field] = value
                (example / "qa/release-gates.json").write_text(json.dumps(release))
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any(f"visualReview.{field}" in issue for issue in issues), issues)

    def test_playable_prototype_requires_review_to_be_required_and_passed(self) -> None:
        for field, value in (("required", False), ("status", "NOT_RUN")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
                release = json.loads((example / "qa/release-gates.json").read_text())
                release["visualReview"][field] = value
                (example / "qa/release-gates.json").write_text(json.dumps(release))
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any(f"visualReview.{field} must be" in issue for issue in issues), issues)

    def test_release_evidence_cannot_escape_example_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["visualReview"]["evidence"] = "../../outside.md"
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("visualReview.evidence leaves the example workspace" in issue for issue in issues), issues)

    def test_playable_prototype_requires_focal_release_asset_proof(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            ledger = json.loads((example / "build/asset-ledger.json").read_text())
            ledger["entries"][0]["evidence"] = []
            (example / "build/asset-ledger.json").write_text(json.dumps(ledger))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("hero.evidence must not be empty" in issue for issue in issues), issues)

    def test_playable_prototype_rejects_unclassified_release_gate_asset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            ledger = json.loads((example / "build/asset-ledger.json").read_text())
            ledger["entries"].append(
                {
                    "key": "hidden-graybox",
                    "tier": "release-gate",
                    "status": "functional-graybox",
                    "releaseGatePassed": False,
                    "evidence": ["evidence/hero.png"],
                    "remaining": "visual promotion",
                }
            )
            (example / "build/asset-ledger.json").write_text(json.dumps(ledger))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("unclassified release-gate asset hidden-graybox" in issue for issue in issues), issues)

    def test_visual_targets_inherits_target_finish_when_present(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="graybox")
            (example / "design/VISUAL_TARGETS.md").write_text(
                "targetFinish: showcase\n", encoding="utf-8"
            )
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("VISUAL_TARGETS.md: targetFinish must match" in issue for issue in issues), issues)

    def test_qa_report_inherits_target_finish_without_conflicts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="graybox")
            (example / "qa/QA_REPORT.md").write_text(
                "targetFinish: graybox\ntargetFinish: showcase\n", encoding="utf-8"
            )
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("QA_REPORT.md: conflicting targetFinish" in issue for issue in issues), issues)

    def test_build_brief_release_states_must_match_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="graybox")
            brief = example / "build/BUILD_BRIEF.md"
            brief.write_text(
                brief.read_text().replace("visualPromotion: PASS", "visualPromotion: FAIL"),
                encoding="utf-8",
            )
            issues = validate_publication(example, "graybox")
            self.assertTrue(any("BUILD_BRIEF.md: visualPromotion must match" in issue for issue in issues), issues)

    def test_release_gate_ledger_requires_status_remaining_and_existing_evidence(self) -> None:
        mutations = {
            "status": None,
            "remaining": None,
            "evidence": ["evidence/missing.png"],
        }
        for field, value in mutations.items():
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
                ledger = json.loads((example / "build/asset-ledger.json").read_text())
                ledger["entries"][0][field] = value
                (example / "build/asset-ledger.json").write_text(json.dumps(ledger))
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any(f".{field}" in issue for issue in issues), issues)

    def test_degradable_asset_requires_structured_fallback_proof(self) -> None:
        mutations = {
            "missing": None,
            "empty_behavior": {
                "behavior": "",
                "preserved": {key: True for key in ("coreAction", "state", "result", "readableFeedback", "restart")},
                "evidence": ["evidence/hero.png"],
            },
            "bad_path": {
                "behavior": "Use readable authored feedback.",
                "preserved": {key: True for key in ("coreAction", "state", "result", "readableFeedback", "restart")},
                "evidence": ["evidence/missing-fallback.png"],
            },
        }
        for label, fallback in mutations.items():
            with self.subTest(case=label), tempfile.TemporaryDirectory() as temporary:
                example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
                release = json.loads((example / "qa/release-gates.json").read_text())
                release["focalReleaseAssets"] = []
                release["degradableReleaseAssets"] = ["hero"]
                (example / "qa/release-gates.json").write_text(json.dumps(release))
                ledger = json.loads((example / "build/asset-ledger.json").read_text())
                if fallback is None:
                    ledger["entries"][0].pop("fallback", None)
                else:
                    ledger["entries"][0]["fallback"] = fallback
                (example / "build/asset-ledger.json").write_text(json.dumps(ledger))
                issues = validate_publication(example, "playable-prototype")
                self.assertTrue(any("hero.fallback" in issue for issue in issues), issues)

    def test_playable_allows_failed_degradable_asset_with_valid_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(
                Path(temporary), tier="playable-prototype"
            )
            release_path = example / "qa/release-gates.json"
            release = json.loads(release_path.read_text(encoding="utf-8"))
            release["focalReleaseAssets"] = ["hero"]
            release["degradableReleaseAssets"] = ["audio"]
            release_path.write_text(json.dumps(release), encoding="utf-8")
            ledger_path = example / "build/asset-ledger.json"
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            ledger["entries"].append(
                {
                    "key": "audio",
                    "tier": "release-gate",
                    "status": "fallback",
                    "releaseGatePassed": False,
                    "remaining": "production asset unavailable",
                    "evidence": ["evidence/hero.png"],
                    "fallback": {
                        "behavior": "Use readable authored feedback.",
                        "preserved": {
                            key: True
                            for key in (
                                "coreAction",
                                "state",
                                "result",
                                "readableFeedback",
                                "restart",
                            )
                        },
                        "evidence": ["evidence/hero.png"],
                    },
                }
            )
            ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
            self.assertEqual(validate_publication(example, "playable-prototype"), [])

    def test_current_public_host_pass_requires_release_fingerprint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            example = self.make_publication_fixture(Path(temporary), tier="playable-prototype")
            report = example / "qa/evidence/public-host.json"
            report.write_text(
                json.dumps({"source": {"sha256": "a" * 64}}), encoding="utf-8"
            )
            release = json.loads((example / "qa/release-gates.json").read_text())
            release["publicHost"] = {
                "status": "PASS",
                "evidence": "qa/evidence/public-host.json",
                "sourceFingerprint": "a" * 64,
            }
            (example / "qa/release-gates.json").write_text(json.dumps(release))
            issues = validate_publication(example, "playable-prototype")
            self.assertTrue(any("publicHost PASS fingerprint must match release sourceFingerprint" in issue for issue in issues), issues)

    def test_non_current_public_hosts_remain_evidence_bound(self) -> None:
        for status in ("HISTORICAL", "NOT_CURRENT"):
            for failure in ("missing_evidence", "fingerprint_mismatch"):
                with (
                    self.subTest(public_host_status=status, failure=failure),
                    tempfile.TemporaryDirectory() as temporary,
                ):
                    example = self.make_publication_fixture(
                        Path(temporary), tier="playable-prototype"
                    )
                    evidence = "qa/evidence/public-host.json"
                    if failure == "fingerprint_mismatch":
                        (example / evidence).write_text(
                            json.dumps({"source": {"sha256": "a" * 64}}),
                            encoding="utf-8",
                        )
                    release_path = example / "qa/release-gates.json"
                    release = json.loads(release_path.read_text(encoding="utf-8"))
                    release["publicHost"] = {
                        "status": status,
                        "evidence": evidence,
                        "sourceFingerprint": "b" * 64,
                    }
                    release_path.write_text(json.dumps(release), encoding="utf-8")

                    issues = validate_publication(example, "playable-prototype")

                    expected = (
                        "publicHost.evidence does not exist"
                        if failure == "missing_evidence"
                        else "publicHost.sourceFingerprint must match deployed report"
                    )
                    self.assertTrue(any(expected in issue for issue in issues), issues)

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

    def test_historical_public_host_status_does_not_dictate_readme_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            example = root / "examples/demo"
            (example / "qa").mkdir(parents=True)
            (example / "example.json").write_text(
                json.dumps({"publicationTier": "playable-prototype"}),
                encoding="utf-8",
            )
            (root / "README.md").write_text(
                "## Play Online\n\n### Demo · Playable prototype\n"
                "[Play online](https://demo.example) · [Case](examples/demo/)\n",
                encoding="utf-8",
            )
            (root / "README_ZH.md").write_text(
                "## 在线试玩\n\n### Demo · 可玩原型\n"
                "[在线试玩](https://demo.example) · [案例](examples/demo/)\n",
                encoding="utf-8",
            )

            for status in ("HISTORICAL", "NOT_CURRENT"):
                with self.subTest(public_host_status=status):
                    (example / "qa/release-gates.json").write_text(
                        json.dumps({"publicHost": {"status": status}}),
                        encoding="utf-8",
                    )
                    self.assertEqual(validate_readme_publication_claims(root), [])

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

        workflow = (ROOT / ".github/workflows/validate.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("npm run test:tts", workflow)

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
            "QA_REPORT.md": (
                ROOT / "examples/project-plateau/qa/QA_REPORT.md"
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
