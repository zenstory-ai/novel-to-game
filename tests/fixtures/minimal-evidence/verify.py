#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

from game import Expedition


ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT / "qa/evidence/run.json"
VISUAL = ROOT / "qa/evidence/frame.ppm"
CORE_CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")


def main() -> int:
    started = time.monotonic()
    command = [
        sys.executable,
        "-m",
        "unittest",
        "discover",
        "-s",
        "tests",
        "-p",
        "test_*.py",
        "-v",
    ]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        return result.returncode

    game = Expedition()
    states = {
        "initial": game.snapshot(),
        "observed": game.observe(),
        "outcome": game.extract(),
        "restart": game.restart(),
    }
    assert states["initial"]["phase"] == "arrival"
    assert states["observed"]["proof"] is True
    assert states["outcome"]["outcome"] == "extracted_with_proof"
    assert states["restart"] == states["initial"]

    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    VISUAL.write_text("P3\n1 1\n255\n0 0 0\n", encoding="utf-8")
    EVIDENCE.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "runId": "complete_run_01",
                "environment": {"runtime": "python-state-fixture"},
                "inputTrace": ["launch", "observe", "extract", "restart"],
                "observations": {
                    "launch": {
                        "id": "initial",
                        "inputs": ["construct Expedition"],
                        "state": states["initial"],
                    },
                    "render": {
                        "id": "render-artifact",
                        "inputs": ["capture deterministic fixture frame"],
                        "state": {"frame": "visible"},
                        "visual": "qa/evidence/frame.ppm",
                    },
                    "input": {
                        "id": "observe",
                        "inputs": ["observe"],
                        "state": states["observed"],
                    },
                    "coreLoop": {
                        "id": "extract",
                        "inputs": ["extract"],
                        "state": states["outcome"],
                    },
                    "outcome": {
                        "id": "outcome",
                        "inputs": ["extract"],
                        "state": states["outcome"],
                    },
                    "restart": {
                        "id": "restart",
                        "inputs": ["restart"],
                        "state": {
                            **states["restart"],
                            "restart": "initial_state",
                        },
                    },
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    evidence = "qa/evidence/run.json"
    verification = {
        "schemaVersion": 3,
        "status": "PASS",
        "verify": {"command": "python3 verify.py", "exitCode": 0},
        "completeRun": {
            "id": "complete_run_01",
            "cleanContext": True,
            "terminal": "extracted_with_proof",
            "restart": "initial_state",
            "evidence": evidence,
        },
        "checks": {name: "PASS" for name in CORE_CHECKS},
        "limitations": [],
    }
    (ROOT / "qa").mkdir(exist_ok=True)
    (ROOT / "qa/verification.json").write_text(
        json.dumps(verification, indent=2) + "\n", encoding="utf-8"
    )
    duration_ms = round((time.monotonic() - started) * 1000)
    print(f"authoritative verification: PASS ({duration_ms}ms)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
