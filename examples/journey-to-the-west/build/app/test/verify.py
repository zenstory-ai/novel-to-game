#!/usr/bin/env python3
"""运行《三借芭蕉扇》一条完整路径，并写回六键结论。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import sys


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
EVIDENCE = PROJECT / "qa/evidence/automated.json"
VERIFICATION = PROJECT / "qa/verification.json"
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")


def atomic_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def write_verification(passed: bool) -> None:
    status = "PASS" if passed else "FAIL"
    atomic_json(
        VERIFICATION,
        {
            "schemaVersion": 3,
            "status": status,
            "verify": {
                "command": "python3 test/verify.py",
                "exitCode": 0 if passed else 1,
            },
            "completeRun": {
                "id": "journey-to-the-west-main-path",
                "cleanContext": passed,
                "terminal": "ending: 三借芭蕉扇 · 完" if passed else "NOT_RUN",
                "restart": "new campaign title" if passed else "NOT_RUN",
                "evidence": "qa/evidence/automated.json",
            },
            "checks": {name: status for name in CHECKS},
            "limitations": [
                {
                    "scope": "visual regression coverage",
                    "reason": (
                        "The complete campaign uses accelerated presentation on desktop. "
                        "The separate visual_browser.py regression exercises normal-speed "
                        "first-round input at 1440x900 and 390x844, including reduced motion. "
                        "A complete mobile campaign and all normal-speed cinematics were not recorded."
                    ),
                },
                {
                    "scope": "tested runtime",
                    "reason": (
                        "The run used local Chromium automation; other browsers and "
                        "device classes were not exercised."
                    ),
                },
                {
                    "scope": "treasure branches",
                    "reason": (
                        "The complete browser run exercised Wukong's successful deep route. "
                        "Safe settlement, forced retreat, Bajie, and Sha Seng are covered by "
                        "deterministic rule tests rather than separate browser runs."
                    ),
                },
                {
                    "scope": "input coverage",
                    "reason": (
                        "The complete campaign run used mixed mouse and keyboard input. The "
                        "new treasure route was exercised keyboard-only; a keyboard-only run "
                        "of the entire campaign was not recorded."
                    ),
                },
            ],
        },
    )


def main() -> int:
    atomic_json(EVIDENCE, {"checkpoint": "verification did not complete"})
    write_verification(False)
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        return 2
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    environment = os.environ.copy()
    environment["BASE_URL"] = f"http://127.0.0.1:{port}"
    result = subprocess.run(
        [sys.executable, "test/qa_browser.py"], cwd=APP, env=environment
    )
    passed = result.returncode == 0
    write_verification(passed)
    print(f"authoritative verification: {'PASS' if passed else 'FAIL'}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
