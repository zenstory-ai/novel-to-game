#!/usr/bin/env python3
"""Run Project Plateau's one complete path and write schema-v3 verification."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
PROJECT = BUILD.parent
REPORT = BUILD / "evidence/current-run/report.json"
VERIFICATION = PROJECT / "qa/verification.json"
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")


def write_json_atomic(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def write_verification(passed: bool) -> None:
    status = "PASS" if passed else "FAIL"
    write_json_atomic(
        VERIFICATION,
        {
            "schemaVersion": 3,
            "status": status,
            "verify": {
                "command": "npm run verify",
                "exitCode": 0 if passed else 1,
            },
            "completeRun": {
                "id": "project-plateau-main-path",
                "cleanContext": passed,
                "evidence": REPORT.relative_to(PROJECT).as_posix(),
                "terminal": "strong-field-record" if passed else "NOT_RUN",
                "restart": "clean-field-order" if passed else "NOT_RUN",
            },
            "checks": {name: status for name in CHECKS},
            "limitations": [
                {
                    "scope": "tested runtime",
                    "reason": (
                        "The run used local desktop Chromium; other browsers, GPUs "
                        "and devices were not exercised."
                    ),
                }
            ],
        },
    )


def main() -> int:
    write_json_atomic(
        REPORT,
        {
            "stage": "current-complete-run",
            "failure": "The current verification has not completed.",
        },
    )
    write_verification(False)
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        return 2
    result = subprocess.run(
        [sys.executable, "test/qa_complete_run.py"], cwd=APP, text=True
    )
    passed = result.returncode == 0
    write_verification(passed)
    if not passed:
        print("authoritative verification: FAIL")
        return 1
    print("authoritative verification: PASS")
    print(f"completeRun={REPORT.relative_to(PROJECT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
