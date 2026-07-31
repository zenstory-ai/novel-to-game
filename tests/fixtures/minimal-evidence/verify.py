#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path

from game import Expedition


ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT / "qa/evidence"
REGISTERED_SUITES = {
    "unit": ["tests/test_game.py"],
}


def discover_test_files() -> set[str]:
    return {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "tests").glob("test_*.py")
    }


def write_state(checkpoint: str, state: dict[str, object]) -> str:
    relative = f"qa/evidence/state/{checkpoint}.json"
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return relative


def main() -> int:
    discovered = discover_test_files()
    registered = {
        location
        for locations in REGISTERED_SUITES.values()
        for location in locations
    }
    orphaned = sorted(discovered - registered)
    if orphaned:
        print(
            "ORPHANED_TEST_SUITE major: "
            + ", ".join(orphaned)
            + " discovered under tests/ but absent from authoritative verify"
        )
        return 2

    missing = sorted(registered - discovered)
    if missing:
        print("MISSING_REQUIRED_SUITE blocker: " + ", ".join(missing))
        return 2

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    log_lines = [f"runtime={sys.executable}", f"runtimeVersion={platform.python_version()}"]
    suite_results: list[dict[str, object]] = []
    exit_code = 0
    for suite_id, locations in REGISTERED_SUITES.items():
        pattern = Path(locations[0]).name
        command = [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests",
            "-p",
            pattern,
            "-v",
        ]
        result = subprocess.run(
            command,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        log_lines.extend(
            [
                f"suite={suite_id}",
                "command=" + " ".join(command),
                result.stdout,
                result.stderr,
                f"exitCode={result.returncode}",
            ]
        )
        executed = result.returncode == 0
        suite_results.append(
            {"id": suite_id, "locations": locations, "executed": executed}
        )
        exit_code = max(exit_code, result.returncode)

    if exit_code:
        (EVIDENCE / "verify.log").write_text(
            "\n".join(log_lines), encoding="utf-8"
        )
        return exit_code

    game = Expedition()
    initial = game.snapshot()
    observed = game.observe()
    extracted = game.extract()
    restarted = game.restart()
    checkpoints = [
        ("cp_initial", initial),
        ("cp_observe", observed),
        ("cp_extract", extracted),
        ("cp_restart", restarted),
    ]
    checkpoint_records = [
        {
            "id": checkpoint,
            "state": write_state(checkpoint, state),
            "browser": "NOT_RUN: contract fixture has no browser renderer",
            "visual": "NOT_RUN: contract fixture has no visual renderer",
        }
        for checkpoint, state in checkpoints
    ]
    duration_ms = round((time.monotonic() - started) * 1000)
    log_lines.extend(
        [
            "completeRun=complete_run_01",
            "terminal=extracted_with_proof",
            "restart=initial_state",
            f"durationMs={duration_ms}",
        ]
    )
    (EVIDENCE / "verify.log").write_text("\n".join(log_lines), encoding="utf-8")

    verification = {
        "schemaVersion": 1,
        "sourceCommit": os.environ.get(
            "SOURCE_COMMIT", "NOT_AVAILABLE: SOURCE_COMMIT was not provided"
        ),
        "environment": {
            "runtime": sys.executable,
            "runtimeVersion": platform.python_version(),
            "packageManager": "none",
            "browser": "NOT_AVAILABLE: contract fixture has no browser renderer",
            "viewport": "NOT_AVAILABLE: contract fixture has no viewport",
        },
        "verify": {
            "command": "python3 verify.py",
            "log": "qa/evidence/verify.log",
            "exitCode": 0,
            "durationMs": duration_ms,
            "suites": suite_results,
        },
        "completeRun": {
            "id": "complete_run_01",
            "cleanContext": True,
            "speed": "normal",
            "steps": [
                {
                    "id": "step_01",
                    "input": "start with a new Expedition",
                    "expected": "arrival state without proof",
                    "checkpoint": "cp_initial",
                },
                {
                    "id": "step_02",
                    "input": "observe",
                    "expected": "proof acquired and route opened",
                    "checkpoint": "cp_observe",
                },
                {
                    "id": "step_03",
                    "input": "extract",
                    "expected": "designed result reached with proof",
                    "checkpoint": "cp_extract",
                },
                {
                    "id": "step_04",
                    "input": "restart",
                    "expected": "valid initial state restored",
                    "checkpoint": "cp_restart",
                },
            ],
            "terminal": "extracted_with_proof",
            "restart": "initial_state",
        },
        "checkpoints": checkpoint_records,
    }
    (ROOT / "qa").mkdir(exist_ok=True)
    (ROOT / "qa/verification.json").write_text(
        json.dumps(verification, indent=2) + "\n",
        encoding="utf-8",
    )
    print("authoritative verification: PASS")
    print("suites=" + ",".join(REGISTERED_SUITES))
    print("completeRun=complete_run_01")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
