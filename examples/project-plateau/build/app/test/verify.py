#!/usr/bin/env python3
"""Run one complete Project Plateau path and write the six-key evidence handoff."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
import sys
import time


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
PROJECT = BUILD.parent
REPO = BUILD.parents[2]
QA = PROJECT / "qa"
VERIFICATION = QA / "verification.json"
REPORT = QA / "QA_REPORT.md"
CORE_CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")


@dataclass(frozen=True)
class Suite:
    identifier: str
    locations: tuple[str, ...]
    commands: tuple[tuple[str, ...], ...]
    cwd: Path


SUITES = (
    Suite(
        "browser:complete-run",
        ("test/qa_complete_run.py",),
        ((sys.executable, "test/qa_complete_run.py"),),
        APP,
    ),
)


def command_output(command: tuple[str, ...], cwd: Path) -> tuple[int, str]:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    output = result.stdout
    if result.stderr:
        output += ("\n" if output else "") + result.stderr
    return result.returncode, output.rstrip()


def display_command(command: tuple[str, ...], cwd: Path) -> str:
    parts = []
    for part in command:
        if part == sys.executable:
            parts.append("python3")
            continue
        path = Path(part)
        if path.is_absolute():
            try:
                parts.append(path.relative_to(cwd).as_posix())
            except ValueError:
                parts.append(path.name)
            continue
        parts.append(part)
    return " ".join(parts)


def project_path(path: Path) -> str:
    return path.relative_to(PROJECT).as_posix()


def load_complete_run_report() -> dict[str, object]:
    return json.loads(
        (BUILD / "evidence/current-run/report.json").read_text(encoding="utf-8")
    )


def write_json_atomic(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def write_text_atomic(path: Path, value: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def current_checkpoints(identifiers: set[str] | None = None) -> list[dict[str, object]]:
    report = load_complete_run_report()
    records = []
    for checkpoint in report["checkpoints"]:
        if identifiers is not None and checkpoint["id"] not in identifiers:
            continue
        record = dict(checkpoint)
        record["id"] = f"current:{checkpoint['id']}"
        records.append(record)
    return records


def write_verification(
    *,
    exit_code: int,
    suite_results: list[dict[str, object]],
    checks: dict[str, str],
) -> None:
    run_report = BUILD / "evidence/current-run/report.json"
    evidence = project_path(run_report)
    verification: dict[str, object] = {
        "schemaVersion": 2,
        "status": "PASS" if exit_code == 0 else "FAIL",
        "verify": {
            "command": "npm run verify",
            "exitCode": exit_code,
            "suites": suite_results,
        },
        "completeRun": {
            "id": "current-strong-input-only",
            "cleanContext": exit_code == 0,
            "speed": "normal",
            "evidence": evidence,
            "terminal": "strong-field-record" if exit_code == 0 else "NOT_RUN",
            "restart": "clean-field-order" if exit_code == 0 else "NOT_RUN",
        },
        "checks": {
            name: {"status": checks[name], "evidence": [evidence]}
            for name in CORE_CHECKS
        },
        "limitations": [
            {
                "scope": "tested runtime",
                "reason": (
                    "The recorded run used local desktop Chromium with software-controlled "
                    "input; other browsers, GPUs and devices were not exercised."
                ),
            },
        ],
    }
    machine_qa = {
        "command": "npm run verify",
        "exitCode": exit_code,
        "completeRun": {
            "terminal": "strong-field-record" if exit_code == 0 else "NOT_RUN",
            "restart": "clean-field-order" if exit_code == 0 else "NOT_RUN",
        },
        "checks": checks,
    }
    if exit_code == 0:
        complete_ids = {
            "00-clean-field-order",
            "01-strong-brook-frame",
            "03-strong-glade-frames",
            "04-strong-covered-return",
            "05-strong-input-result",
            "06-strong-clean-restart",
        }
        checkpoints = current_checkpoints(complete_ids)
        available = {record["id"] for record in checkpoints}
        expected_complete = {f"current:{identifier}" for identifier in complete_ids}
        assert expected_complete <= available, sorted(expected_complete - available)
        verification["completeRun"]["steps"] = [
            {
                "id": "step_01",
                "input": "Enter the basin",
                "expected": "clean 180-second field order",
                "checkpoint": "current:00-clean-field-order",
            },
            {
                "id": "step_02",
                "input": "W, E, raise camera and expose the brook plate",
                "expected": "traversal and first physical proof",
                "checkpoint": "current:01-strong-brook-frame",
            },
            {
                "id": "step_03",
                "input": "use cover, reach the glade and expose both behavior plates",
                "expected": "seven evidence points across four plates",
                "checkpoint": "current:03-strong-glade-frames",
            },
            {
                "id": "step_04",
                "input": "retreat under cover until the dive widens",
                "expected": "covered return route and retained body margin",
                "checkpoint": "current:04-strong-covered-return",
            },
            {
                "id": "step_05",
                "input": "follow the covered return to Fort",
                "expected": "Strong field record with all captured views",
                "checkpoint": "current:05-strong-input-result",
            },
            {
                "id": "step_06",
                "input": "Take the route again",
                "expected": "clean field order with no spent resource or travelled distance",
                "checkpoint": "current:06-strong-clean-restart",
            },
        ]
        report = load_complete_run_report()
    else:
        report = {
            "stage": "current-complete-run",
            "limitations": [
                "The authoritative verification command failed; prior PASS evidence was replaced."
            ],
        }
    report["qa"] = machine_qa
    write_json_atomic(run_report, report)
    write_json_atomic(VERIFICATION, verification)
    status = "PASS" if exit_code == 0 else "FAIL"
    reason = (
        "The six-key complete path passed."
        if exit_code == 0
        else "The six-key complete path did not finish."
    )
    write_text_atomic(
        REPORT,
        f"""# Project Plateau QA report

`status: {status}`

## Decision and evidence

`qa/verification.json` is the machine record and
`build/evidence/current-run/report.json` contains the complete path. {reason}

Run from `build/app/`:

```bash
npm run verify
```

## Limitations

The recorded run used local desktop Chromium with software-controlled input. Other browsers, GPUs and devices were
not exercised. Automation does not determine subjective anatomy, composition, comfort, fun, balance, rights clearance
or publication quality.
""",
    )


def main() -> int:
    failed_checks = {name: "FAIL" for name in CORE_CHECKS}
    write_verification(exit_code=1, suite_results=[], checks=failed_checks)
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        write_verification(exit_code=2, suite_results=[], checks=failed_checks)
        return 2
    suite_results: list[dict[str, object]] = []
    for suite in SUITES:
        suite_passed = True
        for command in suite.commands:
            command_started = time.monotonic()
            code, output = command_output(command, suite.cwd)
            elapsed_ms = round((time.monotonic() - command_started) * 1000)
            command_text = display_command(command, suite.cwd)
            print(f"[{suite.identifier}] {command_text}: exit {code} ({elapsed_ms}ms)")
            if code != 0:
                if output:
                    print(output)
                suite_passed = False
                break
        if not suite_passed:
            suite_results.append(
                {"id": suite.identifier, "executed": True, "passed": False}
            )
        else:
            suite_results.append(
                {"id": suite.identifier, "executed": True, "passed": True}
            )
    try:
        raw_checks = load_complete_run_report().get("minimalChecks")
    except (FileNotFoundError, json.JSONDecodeError):
        raw_checks = None
    checks = {
        name: "PASS"
        if isinstance(raw_checks, dict) and raw_checks.get(name) is True
        else "FAIL"
        for name in CORE_CHECKS
    }
    suites_passed = bool(suite_results) and all(
        result.get("passed") is True for result in suite_results
    )
    exit_code = 0 if suites_passed and set(checks.values()) == {"PASS"} else 1
    write_verification(exit_code=exit_code, suite_results=suite_results, checks=checks)
    if exit_code:
        print("authoritative verification: FAIL")
        return exit_code
    print(f"authoritative verification: PASS ({len(SUITES)}/{len(SUITES)} suites)")
    print(f"completeRun=strong-input-only evidence={project_path(VERIFICATION)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
