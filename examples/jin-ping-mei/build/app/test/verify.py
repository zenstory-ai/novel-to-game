#!/usr/bin/env python3
"""运行《风月总账》一条完整路径，并以 fail-closed 方式写回六键事实。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
EVIDENCE = PROJECT / "qa/evidence/browser/evidence-normal.json"
VERIFICATION = PROJECT / "qa/verification.json"
REPORT = PROJECT / "qa/QA_REPORT.md"
COMMAND = "python3 test/verify.py"
EVIDENCE_PATH = "qa/evidence/browser/evidence-normal.json"
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")
TERMINAL = "exclusive-ending"
RESTART = "day-1-opening"


def atomic_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def atomic_text(path: Path, value: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def qa_record(exit_code: int, checks: dict[str, str]) -> dict[str, object]:
    return {
        "command": COMMAND,
        "exitCode": exit_code,
        "completeRun": {
            "terminal": TERMINAL if exit_code == 0 else "FAIL",
            "restart": RESTART if exit_code == 0 else "FAIL",
        },
        "checks": checks,
    }


def verification_record(
    exit_code: int,
    suites: list[dict[str, object]],
    checks: dict[str, str],
) -> dict[str, object]:
    status = "PASS" if exit_code == 0 else "FAIL"
    return {
        "schemaVersion": 2,
        "status": status,
        "verify": {
            "command": COMMAND,
            "exitCode": exit_code,
            "suites": suites,
        },
        "completeRun": {
            "id": "jin-ping-mei-current-complete-run",
            "cleanContext": exit_code == 0,
            "terminal": TERMINAL if exit_code == 0 else "FAIL",
            "restart": RESTART if exit_code == 0 else "FAIL",
            "evidence": EVIDENCE_PATH,
        },
        "checks": {
            name: {"status": checks[name], "evidence": [EVIDENCE_PATH]}
            for name in CHECK_NAMES
        },
        "limitations": [
            {
                "scope": "tested runtime",
                "reason": (
                    "The recorded run used local Chromium automation; other browsers "
                    "and device classes were not exercised."
                ),
            }
        ],
    }


def report_text(exit_code: int, reason: str) -> str:
    status = "PASS" if exit_code == 0 else "FAIL"
    return f"""# 《风月总账》QA 报告

`status: {status}`

## 结论与证据

机器事实源为 `qa/verification.json`，常速完整路径记录为
`qa/evidence/browser/evidence-normal.json`。本次结论：{reason}

实际运行命令（在 `build/app/`）：

```bash
{COMMAND}
```

## 限制

记录来自本地 Chromium 自动化，未覆盖其他浏览器和设备。自动化不证明主观趣味、节奏、长期平衡、
商业价值、成人内容适配性或权利合规。
"""


def write_results(
    exit_code: int,
    suites: list[dict[str, object]],
    checks: dict[str, str],
    evidence: dict[str, object],
    reason: str,
) -> None:
    evidence["qa"] = qa_record(exit_code, checks)
    evidence["suites"] = suites
    if exit_code:
        evidence["failure"] = reason
    else:
        evidence.pop("failure", None)
    atomic_json(EVIDENCE, evidence)
    atomic_json(VERIFICATION, verification_record(exit_code, suites, checks))
    atomic_text(REPORT, report_text(exit_code, reason))


def run_suite(
    identifier: str,
    command: tuple[str, ...],
    env: dict[str, str] | None = None,
) -> dict[str, object]:
    started = time.monotonic()
    result = subprocess.run(command, cwd=APP, env=env)
    elapsed_ms = round((time.monotonic() - started) * 1000)
    display = " ".join("python3" if part == sys.executable else part for part in command)
    print(f"[{identifier}] {display}: exit {result.returncode} ({elapsed_ms}ms)")
    return {
        "id": identifier,
        "executed": True,
        "passed": result.returncode == 0,
        "exitCode": result.returncode,
    }


def main() -> int:
    failed_checks = {name: "FAIL" for name in CHECK_NAMES}
    # Revoke prior success before every invocation, including invalid arguments.
    write_results(
        1,
        [],
        failed_checks,
        {},
        "authoritative verification started but did not complete",
    )
    if len(sys.argv) != 1:
        print(f"usage: {COMMAND}", file=sys.stderr)
        write_results(2, [], failed_checks, {}, "invalid verification arguments")
        return 2

    suites: list[dict[str, object]] = []

    try:
        with tempfile.TemporaryDirectory(prefix="jpm-qa-") as shots:
            slow_env = os.environ.copy()
            slow_env["JPM_QA_SHOTS"] = shots
            slow_env["QA_SLOW"] = "1"
            suites.append(
                run_suite("browser:complete-run", (sys.executable, "test/qa_browser.py"), slow_env)
            )

            staged_evidence = Path(shots) / "evidence-normal.json"
            if not staged_evidence.is_file():
                write_results(
                    1,
                    suites,
                    failed_checks,
                    {},
                    "normal-speed evidence was not produced",
                )
                print("authoritative verification: FAIL (normal-speed evidence missing)")
                return 1

            evidence = json.loads(staged_evidence.read_text(encoding="utf-8"))
            if not isinstance(evidence, dict):
                raise ValueError("normal-speed evidence must be a JSON object")
            raw_checks = evidence.get("minimalChecks")
            checks = {
                name: "PASS"
                if isinstance(raw_checks, dict) and raw_checks.get(name) is True
                else "FAIL"
                for name in CHECK_NAMES
            }
            exit_code = 0 if set(checks.values()) == {"PASS"} else 1
            reason = (
                "六项最小完整路径通过。"
                if exit_code == 0
                else "六项最小完整路径未全部通过。"
            )
            write_results(exit_code, suites, checks, evidence, reason)
            if exit_code:
                print("authoritative verification: FAIL")
                return exit_code
    except Exception as error:
        write_results(
            1,
            suites,
            failed_checks,
            {},
            f"verification wrapper error: {error}",
        )
        print(f"authoritative verification: FAIL ({error})", file=sys.stderr)
        return 1

    print("authoritative verification: PASS (1/1 suite)")
    print(f"completeRun={TERMINAL} restart={RESTART} evidence={EVIDENCE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
