#!/usr/bin/env python3
"""Check approved design expectations without importing implementation constants."""

from __future__ import annotations

import json
from pathlib import Path


PROJECT = Path(__file__).resolve().parent.parent
EVIDENCE = PROJECT / "build/evidence"
OUTPUT = PROJECT / "qa/evidence/design-invariants.md"


def load(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    s7 = load(EVIDENCE / "s7/report.json")
    s8 = load(EVIDENCE / "s8/report.json")
    s10 = load(EVIDENCE / "s10/report.json")
    strong_state = load(EVIDENCE / "s8/state/05-strong-input-result.json")
    mixed_state = load(EVIDENCE / "s8/state/09-mixed-input-result.json")
    panic_state = load(EVIDENCE / "s8/state/12-panic-input-failure.json")
    restart_states = [
        load(EVIDENCE / f"s8/state/{name}.json")
        for name in (
            "06-strong-clean-restart",
            "10-mixed-clean-restart",
            "13-panic-clean-restart",
        )
    ]

    checks: list[dict[str, object]] = []

    def check(identifier: str, expectation: str, actual: object, passed: bool, evidence: str) -> None:
        checks.append(
            {
                "id": identifier,
                "expectation": expectation,
                "actual": actual,
                "passed": bool(passed),
                "evidence": evidence,
            }
        )

    source_fingerprints = {
        s7["source"]["sha256"], s8["source"]["sha256"], s10["source"]["sha256"]
    }
    check(
        "same-source",
        "S7, S8 and S10 describe one current build fingerprint",
        sorted(source_fingerprints),
        len(source_fingerprints) == 1,
        "build/evidence/s7/report.json; s8/report.json; s10/report.json",
    )

    verbs = set(s8["verbEvidenceMatrix"])
    expected_verbs = {
        "traverse",
        "observe",
        "commitExposedObjective",
        "evadeOrDefend",
        "reachRelativeSafety",
    }
    check(
        "same-play-verbs",
        "All five approved same-play verbs have direct path evidence",
        sorted(verbs),
        verbs == expected_verbs,
        "build/evidence/s8/report.json#verbEvidenceMatrix",
    )

    strong = s8["pathMetrics"]["Strong"]
    strong_result = strong["result"]
    strong_player = strong_state["player"]
    strong_pass = (
        strong_result["band"] == "strong-field-record"
        and 6 <= strong_result["evidence"] <= 7
        and strong_player["bodyMargin"] == 1
        and strong_player["shotCount"] == 0
        and strong_player["cartridges"] >= 1
        and strong["route"] == "covered"
        and 30 <= strong["remainingLight"] <= 120
    )
    check(
        "strong-reference",
        "Strong returns 6-7 evidence through cover with body margin, no shot and 30-120 seconds",
        {
            "band": strong_result["band"],
            "evidence": strong_result["evidence"],
            "bodyMargin": strong_player["bodyMargin"],
            "shotCount": strong_player["shotCount"],
            "cartridges": strong_player["cartridges"],
            "route": strong["route"],
            "remainingLight": strong["remainingLight"],
        },
        strong_pass,
        "build/evidence/s8/state/05-strong-input-result.json",
    )

    mixed = s8["pathMetrics"]["Mixed"]
    mixed_result = mixed["result"]
    mixed_player = mixed_state["player"]
    mixed_pass = (
        mixed_result["band"] == "corroborating-record"
        and 4 <= mixed_result["evidence"] <= 5
        and mixed_result["survivingPlates"] >= 2
        and mixed_player["shotCount"] == 1
        and mixed["route"] == "exposed"
        and bool(mixed_result["gunshotCallback"])
    )
    check(
        "mixed-reference",
        "Mixed preserves 4-5 evidence, at least two plates and the one-shot brook callback",
        {
            "band": mixed_result["band"],
            "evidence": mixed_result["evidence"],
            "survivingPlates": mixed_result["survivingPlates"],
            "shotCount": mixed_player["shotCount"],
            "route": mixed["route"],
            "callback": mixed_result["gunshotCallback"],
        },
        mixed_pass,
        "build/evidence/s8/state/09-mixed-input-result.json",
    )

    panic = s8["pathMetrics"]["Panic"]
    panic_player = panic_state["player"]
    panic_result = panic["result"]
    panic_pass = (
        panic_result["kind"] == "failure"
        and panic_player["failureCause"] == "second-unblocked-strike"
        and panic_player["contactCount"] == 2
        and panic_player["shotCount"] == 2
    )
    check(
        "panic-reference",
        "Panic spends both rounds, takes two contacts and cannot reach a strong result",
        {
            "result": panic_result,
            "failureCause": panic_player["failureCause"],
            "contactCount": panic_player["contactCount"],
            "shotCount": panic_player["shotCount"],
        },
        panic_pass,
        "build/evidence/s8/state/12-panic-input-failure.json",
    )

    clean_restarts = all(
        state["mode"] == "order"
        and state["player"]["remainingLight"] == 180
        and state["player"]["distanceTravelled"] == 0
        and all(
            plate["status"] == "unexposed"
            and plate["points"] == 0
            and plate["frameKey"] is None
            for plate in state["player"]["plates"]
        )
        for state in restart_states
    )
    check(
        "terminal-restarts",
        "Strong, Mixed and Panic each return to a clean 180-second field order",
        [
            {
                "mode": state["mode"],
                "remainingLight": state["player"]["remainingLight"],
                "distanceTravelled": state["player"]["distanceTravelled"],
                "plateStatuses": [plate["status"] for plate in state["player"]["plates"]],
            }
            for state in restart_states
        ],
        clean_restarts,
        "build/evidence/s8/state/{06-strong,10-mixed,13-panic}-clean-restart.json",
    )

    s8_checks = s8["checks"]
    browser_clean = not s8_checks["consoleErrors"] and not s8_checks["externalHosts"]
    check(
        "input-and-network-boundary",
        "Reference paths use input rather than state/time shortcuts and make no external request",
        {
            "noTeleportOrDirectTimeAdvance": s8_checks["noTeleportOrDirectTimeAdvance"],
            "consoleErrors": s8_checks["consoleErrors"],
            "externalHosts": s8_checks["externalHosts"],
        },
        s8_checks["noTeleportOrDirectTimeAdvance"] and browser_clean,
        "build/evidence/s8/report.json#checks",
    )

    payload = s7["payload"]
    loading = s7["loading"]["firstNoCacheNavigation"]
    target_perf = s7["performance"]["targetViewport"]
    minimum_perf = s7["performance"]["minimumViewport"]
    budget_pass = (
        payload["gzipBytes"] <= 20 * 1024 * 1024
        and payload["rawBytes"] <= 50 * 1024 * 1024
        and loading["timeToFirstFrameMs"] <= 8000
        and target_perf["medianFps"] >= 45
        and target_perf["onePercentLowFps"] >= 30
        and minimum_perf["medianFps"] >= 45
        and minimum_perf["onePercentLowFps"] >= 30
    )
    check(
        "performance-budget",
        "Both viewports meet 45/30 FPS and local 25 Mbps loading/payload budgets",
        {
            "gzipBytes": payload["gzipBytes"],
            "rawBytes": payload["rawBytes"],
            "timeToFirstFrameMs": loading["timeToFirstFrameMs"],
            "targetFps": [target_perf["medianFps"], target_perf["onePercentLowFps"]],
            "minimumFps": [minimum_perf["medianFps"], minimum_perf["onePercentLowFps"]],
        },
        budget_pass,
        "build/evidence/s7/report.json#loading,payload,performance",
    )

    visual_checks = s10["checks"]
    required_visual = {
        "protectedGladeSightline",
        "familyAndBasaltShareSunLane",
        "allFiveSubjectsCastShadows",
        "observationNoteClearsBeforeHeroFrame",
        "focusRegionPixelFloor",
        "youngPlayAndBranchPullRemainDistinct",
        "achromatopsiaAttackRetainsShapeAndToolState",
        "strongBoardUsesFourCapturedViews",
        "restartClearsCapturedViews",
    }
    visual_pass = all(visual_checks[name] for name in required_visual)
    visual_pass = visual_pass and not visual_checks["consoleErrors"] and not visual_checks["externalHosts"]
    check(
        "visual-checkpoint-floor",
        "Current visual checkpoints meet the approved objective composition and state floors",
        {name: visual_checks[name] for name in sorted(required_visual)},
        visual_pass,
        "build/evidence/s10/report.json#checks",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Project Plateau design-invariant audit",
        "",
        f"Source fingerprint: `{next(iter(source_fingerprints)) if len(source_fingerprints) == 1 else 'MISMATCH'}`",
        "",
        "This QA-side table is derived from the approved product and game-design thresholds. It does not import implementation constants and does not claim subjective fun, balance, anatomy, motion or composition quality.",
        "",
        "| ID | Result | Approved expectation | Observed | Evidence |",
        "|---|---|---|---|---|",
    ]
    for item in checks:
        result = "PASS" if item["passed"] else "FAIL"
        observed = json.dumps(item["actual"], ensure_ascii=False, separators=(",", ":"))
        lines.append(
            f"| `{item['id']}` | **{result}** | {item['expectation']} | `{observed}` | `{item['evidence']}` |"
        )
    lines.extend(
        [
            "",
            "## Boundaries",
            "",
            "- Automated invariants establish deterministic state, input-path, loading, performance and gross visual floors only.",
            "- Independent first-time premise/genre comprehension, anatomy, motion and composition review remain NOT_RUN.",
            "- The achromatopsia evidence covers one busy attack frame, not the complete route or every colour-vision mode.",
            "- Local throttling is not public-host cold-load evidence.",
            "",
        ]
    )
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    failed = [item["id"] for item in checks if not item["passed"]]
    if failed:
        print("DESIGN_INVARIANT_FAILURE major: " + ", ".join(failed))
        return 1
    print(f"design invariants: PASS ({len(checks)}/{len(checks)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
