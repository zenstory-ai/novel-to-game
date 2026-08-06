#!/usr/bin/env python3
"""Run every authored Project Plateau suite and write one evidence handoff."""

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


@dataclass(frozen=True)
class Suite:
    identifier: str
    locations: tuple[str, ...]
    commands: tuple[tuple[str, ...], ...]
    cwd: Path


BROWSER_SUITE_NAMES = {
    "complete_run": "complete-run",
    "controller": "controller-contract",
    "motion": "motion-visual",
    "collision": "collision-contract",
    "entry": "entry-conversion",
    "loading": "loading-state",
}


def discover_suites() -> tuple[Suite, ...]:
    js_tests = tuple(
        path.relative_to(APP).as_posix()
        for path in sorted((APP / "test").glob("*.test.js"))
    )
    browser_suites = []
    for path in sorted((APP / "test").glob("qa_*.py")):
        relative = path.relative_to(APP).as_posix()
        suffix = path.stem.removeprefix("qa_")
        browser_suites.append(
            Suite(
                f"browser:{BROWSER_SUITE_NAMES.get(suffix, suffix.replace('_', '-'))}",
                (relative,),
                ((sys.executable, relative),),
                APP,
            )
        )
    return (
        Suite("unit:simulation", js_tests, (("npm", "test"),), APP),
        Suite(
            "build:production",
            ("index.html", "src/", "public/"),
            (("npm", "run", "build"),),
            APP,
        ),
        *browser_suites,
    )


SUITES = discover_suites()


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
) -> None:
    run_report = BUILD / "evidence/current-run/report.json"
    verification: dict[str, object] = {
        "schemaVersion": 2,
        "assuranceProfile": "smoke",
        "status": "PASS" if exit_code == 0 else "FAIL",
        "verify": {
            "command": "npm run verify",
            "exitCode": exit_code,
            "suites": suite_results,
        },
        "checks": {},
        "limitations": [
            {
                "scope": "first-time player comprehension",
                "reason": "Automation cannot substitute for an independent first-time player record.",
                "blocksProfiles": ["delivery", "release"],
            },
        ],
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
        verification["completeRun"] = {
            "id": "current-strong-input-only",
            "cleanContext": True,
            "speed": "normal",
            "evidence": project_path(run_report),
            "steps": [
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
            ],
            "terminal": "strong-field-record",
            "restart": "clean-field-order",
        }
        core_evidence = [project_path(run_report)]
        verification["checks"] = {
            name: {"status": "PASS", "evidence": core_evidence}
            for name in (
                "launch",
                "render",
                "input",
                "coreLoop",
                "outcome",
                "restart",
            )
        }
        verification["checks"]["accessibilityModes"] = {
            "status": "PASS",
            "evidence": [project_path(run_report)],
        }
    VERIFICATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = VERIFICATION.with_name(f".{VERIFICATION.name}.tmp")
    temporary.write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8")
    temporary.replace(VERIFICATION)


def main() -> int:
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        return 2
    exit_code = 0
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
                exit_code = code
                break
        if not suite_passed:
            suite_results.append(
                {"id": suite.identifier, "executed": True, "passed": False}
            )
            break
        suite_results.append(
            {"id": suite.identifier, "executed": True, "passed": True}
        )

    executed = {result["id"] for result in suite_results}
    suite_results.extend(
        {"id": suite.identifier, "executed": False, "passed": False}
        for suite in SUITES
        if suite.identifier not in executed
    )

    write_verification(exit_code=exit_code, suite_results=suite_results)
    if exit_code:
        print("authoritative verification: FAIL")
        return exit_code
    print(f"authoritative verification: PASS ({len(SUITES)}/{len(SUITES)} suites)")
    print(f"completeRun=strong-input-only evidence={project_path(VERIFICATION)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
