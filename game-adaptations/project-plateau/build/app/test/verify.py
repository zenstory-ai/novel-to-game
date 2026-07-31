#!/usr/bin/env python3
"""Run every authored Project Plateau suite and write one evidence handoff."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
import time


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
PROJECT = BUILD.parent
REPO = BUILD.parents[2]
QA = PROJECT / "qa"
QA_EVIDENCE = QA / "evidence"
LOG = QA_EVIDENCE / "verify.log"
VERIFICATION = QA / "verification.json"


@dataclass(frozen=True)
class Suite:
    identifier: str
    locations: tuple[str, ...]
    commands: tuple[tuple[str, ...], ...]
    cwd: Path


JS_TESTS = (
    "test/audio.test.js",
    "test/foundation.test.js",
    "test/settings.test.js",
    "test/simulation.test.js",
)
HISTORY_QA = tuple(f"test/qa_s{stage}.py" for stage in range(8)) + ("test/qa_s9.py",)
COMPLETE_RUN_QA = ("test/qa_s8.py",)
CURRENT_VISUAL_QA = ("test/qa_s10.py",)
EXCLUDED_TEST_TOOLS = {
    "test/capture_demo_clip.py": "reproducible delivery-media recorder, not a pass/fail test suite",
    "test/verify.py": "authoritative suite orchestrator; registering it would recurse",
}
EXPECTED_TEST_SCRIPTS = {
    "test": "test/*.test.js",
    "test:browser": "test/qa_s0.py",
    **{f"test:s{stage}": f"test/qa_s{stage}.py" for stage in range(1, 11)},
}

SUITES = (
    Suite("unit:simulation", JS_TESTS, (("npm", "test"),), APP),
    Suite("build:production", ("index.html", "src/", "public/"), (("npm", "run", "build"),), APP),
    Suite(
        "browser:checkpoint-history",
        HISTORY_QA,
        tuple((sys.executable, location) for location in HISTORY_QA),
        APP,
    ),
    Suite(
        "browser:complete-run",
        COMPLETE_RUN_QA,
        ((sys.executable, COMPLETE_RUN_QA[0]),),
        APP,
    ),
    Suite(
        "browser:current-visual",
        CURRENT_VISUAL_QA,
        ((sys.executable, CURRENT_VISUAL_QA[0]),),
        APP,
    ),
    Suite(
        "qa:design-invariants",
        ("qa/check_design_invariants.py",),
        ((sys.executable, str(QA / "check_design_invariants.py")),),
        PROJECT,
    ),
    Suite(
        "repo:contract",
        ("scripts/validate_repo.py", "tests/"),
        (
            (sys.executable, "scripts/validate_repo.py"),
            (sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"),
        ),
        REPO,
    ),
)


def app_fingerprint() -> str:
    digest = hashlib.sha256()
    paths = [APP / "index.html", APP / "package.json", APP / "package-lock.json"]
    paths += sorted((APP / "public").rglob("*")) + sorted((APP / "src").rglob("*"))
    for path in paths:
        if path.is_file():
            digest.update(path.relative_to(APP).as_posix().encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
    return digest.hexdigest()


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


def display_cwd(cwd: Path) -> str:
    return "." if cwd == REPO else cwd.relative_to(REPO).as_posix()


def git_head() -> str:
    return subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=REPO, check=True, capture_output=True, text=True
    ).stdout.strip()


def audit_registry() -> dict[str, object]:
    discovered = {
        path.relative_to(APP).as_posix()
        for path in (APP / "test").iterdir()
        if path.is_file() and path.suffix in {".py", ".js"}
    }
    registered = set(JS_TESTS + HISTORY_QA + COMPLETE_RUN_QA + CURRENT_VISUAL_QA)
    excluded = set(EXCLUDED_TEST_TOOLS)
    orphaned = sorted(discovered - registered - excluded)
    missing = sorted((registered | excluded) - discovered)

    package = json.loads((APP / "package.json").read_text(encoding="utf-8"))
    scripts = package["scripts"]
    discovered_scripts = {name for name in scripts if name == "test" or name.startswith("test:")}
    orphaned_scripts = sorted(discovered_scripts - set(EXPECTED_TEST_SCRIPTS))
    missing_scripts = sorted(set(EXPECTED_TEST_SCRIPTS) - discovered_scripts)
    mismatched_scripts = sorted(
        name
        for name, location in EXPECTED_TEST_SCRIPTS.items()
        if name in scripts and location not in scripts[name]
    )
    problems = []
    if orphaned:
        problems.append("ORPHANED_TEST_SUITE major: " + ", ".join(orphaned))
    if missing:
        problems.append("MISSING_REGISTERED_SUITE blocker: " + ", ".join(missing))
    if orphaned_scripts:
        problems.append("ORPHANED_TEST_SCRIPT major: " + ", ".join(orphaned_scripts))
    if missing_scripts:
        problems.append("MISSING_TEST_SCRIPT blocker: " + ", ".join(missing_scripts))
    if mismatched_scripts:
        problems.append("MISMATCHED_TEST_SCRIPT major: " + ", ".join(mismatched_scripts))
    return {
        "discovered": sorted(discovered),
        "registered": sorted(registered),
        "excluded": EXCLUDED_TEST_TOOLS,
        "packageScripts": {name: scripts[name] for name in sorted(discovered_scripts)},
        "problems": problems,
    }


def project_path(path: Path) -> str:
    return path.relative_to(PROJECT).as_posix()


def load_report(stage: str) -> dict[str, object]:
    return json.loads((BUILD / f"evidence/{stage}/report.json").read_text(encoding="utf-8"))


def prefixed_checkpoints(stage: str, identifiers: set[str] | None = None) -> list[dict[str, object]]:
    report = load_report(stage)
    records = []
    for checkpoint in report["checkpoints"]:
        if identifiers is not None and checkpoint["id"] not in identifiers:
            continue
        record = dict(checkpoint)
        record["id"] = f"{stage}:{checkpoint['id']}"
        records.append(record)
    return records


def environment() -> dict[str, object]:
    node_code, node = command_output(("node", "--version"), APP)
    npm_code, npm = command_output(("npm", "--version"), APP)
    chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if chrome.exists():
        chrome_code, browser = command_output((str(chrome), "--version"), APP)
    else:
        chrome_code, browser = 0, "Playwright Chromium"
    assert node_code == npm_code == chrome_code == 0
    return {
        "runtime": "Node.js",
        "runtimeVersion": node,
        "packageManager": f"npm@{npm}",
        "pythonVersion": platform.python_version(),
        "browser": browser.strip(),
        "targetViewport": [1440, 900],
        "minimumViewport": [1280, 720],
    }


def write_verification(
    *,
    source_commit: str,
    fingerprint: str,
    environment_record: dict[str, object],
    started: float,
    registry: dict[str, object],
    suite_results: list[dict[str, object]],
    exit_code: int,
) -> None:
    duration_ms = round((time.monotonic() - started) * 1000)
    verification: dict[str, object] = {
        "schemaVersion": 1,
        "sourceCommit": source_commit,
        "sourceFingerprint": fingerprint,
        "environment": environment_record,
        "verify": {
            "command": "npm run verify",
            "log": "qa/evidence/verify.log",
            "exitCode": exit_code,
            "durationMs": duration_ms,
            "suites": suite_results,
            "registry": registry,
        },
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
        checkpoints = prefixed_checkpoints("s8")
        checkpoints += prefixed_checkpoints(
            "s7", {"02-settings-150-minimum", "10-heavy-state-target"}
        )
        checkpoints += prefixed_checkpoints("s10")
        available = {record["id"] for record in checkpoints}
        expected_complete = {f"s8:{identifier}" for identifier in complete_ids}
        assert expected_complete <= available, sorted(expected_complete - available)
        verification["completeRun"] = {
            "id": "s8-strong-input-only",
            "cleanContext": True,
            "speed": "normal",
            "steps": [
                {
                    "id": "step_01",
                    "input": "Enter the basin",
                    "expected": "clean 180-second field order",
                    "checkpoint": "s8:00-clean-field-order",
                },
                {
                    "id": "step_02",
                    "input": "W, E, raise camera and expose the brook plate",
                    "expected": "traversal and first physical proof",
                    "checkpoint": "s8:01-strong-brook-frame",
                },
                {
                    "id": "step_03",
                    "input": "use cover, reach the glade and expose both behavior plates",
                    "expected": "seven evidence points across four plates",
                    "checkpoint": "s8:03-strong-glade-frames",
                },
                {
                    "id": "step_04",
                    "input": "retreat under cover until the dive widens",
                    "expected": "covered return route and retained body margin",
                    "checkpoint": "s8:04-strong-covered-return",
                },
                {
                    "id": "step_05",
                    "input": "follow the covered return to Fort",
                    "expected": "Strong field record with all captured views",
                    "checkpoint": "s8:05-strong-input-result",
                },
                {
                    "id": "step_06",
                    "input": "Take the route again",
                    "expected": "clean field order with no spent resource or travelled distance",
                    "checkpoint": "s8:06-strong-clean-restart",
                },
            ],
            "terminal": "strong-field-record",
            "restart": "clean-field-order",
        }
        verification["checkpoints"] = checkpoints
        verification["claimBoundaries"] = [
            "Automated paths are not first-time human navigation or premise-comprehension evidence.",
            "Pixel and state checks do not prove subjective composition, anatomy, motion, fun or balance.",
            "Local 25 Mbps throttling is not public-host cold-loading evidence.",
            "One achromatopsia attack frame is not a complete colour-vision route matrix.",
        ]
    VERIFICATION.parent.mkdir(parents=True, exist_ok=True)
    VERIFICATION.write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-only", action="store_true", help="check suite discovery without executing suites")
    args = parser.parse_args()
    registry = audit_registry()
    for problem in registry["problems"]:
        print(problem)
    if registry["problems"]:
        return 2
    print(
        f"suite registry: PASS ({len(registry['registered'])} registered, "
        f"{len(registry['excluded'])} explicit non-suite tools)"
    )
    if args.audit_only:
        for suite in SUITES:
            print(f"suite={suite.identifier} locations={','.join(suite.locations)}")
        return 0

    QA_EVIDENCE.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    source_commit = git_head()
    fingerprint = app_fingerprint()
    environment_record = environment()
    log_lines = [
        "command=npm run verify",
        f"sourceCommit={source_commit}",
        f"sourceFingerprint={fingerprint}",
        f"runtime={environment_record['runtime']}",
        f"runtimeVersion={environment_record['runtimeVersion']}",
        f"packageManager={environment_record['packageManager']}",
        f"pythonVersion={environment_record['pythonVersion']}",
        f"browser={environment_record['browser']}",
        "registered=" + ",".join(registry["registered"]),
        "excluded=" + json.dumps(registry["excluded"], sort_keys=True),
    ]
    suite_results: list[dict[str, object]] = []
    exit_code = 0
    for suite in SUITES:
        command_records = []
        suite_passed = True
        for command in suite.commands:
            command_started = time.monotonic()
            code, output = command_output(command, suite.cwd)
            elapsed_ms = round((time.monotonic() - command_started) * 1000)
            command_text = display_command(command, suite.cwd)
            print(f"[{suite.identifier}] {command_text}: exit {code} ({elapsed_ms}ms)")
            log_lines.extend(
                [
                    f"suite={suite.identifier}",
                    f"cwd={display_cwd(suite.cwd)}",
                    f"command={command_text}",
                    output,
                    f"exitCode={code}",
                    f"durationMs={elapsed_ms}",
                ]
            )
            command_records.append(
                {"command": command_text, "exitCode": code, "durationMs": elapsed_ms}
            )
            if code != 0:
                suite_passed = False
                exit_code = code
                break
        suite_results.append(
            {
                "id": suite.identifier,
                "locations": list(suite.locations),
                "executed": True,
                "passed": suite_passed,
                "commands": command_records,
            }
        )
        if not suite_passed:
            break
    executed_ids = {result["id"] for result in suite_results}
    for suite in SUITES:
        if suite.identifier not in executed_ids:
            suite_results.append(
                {
                    "id": suite.identifier,
                    "locations": list(suite.locations),
                    "executed": False,
                    "passed": False,
                    "commands": [],
                }
            )

    duration_ms = round((time.monotonic() - started) * 1000)
    log_lines.extend([f"authoritativeExitCode={exit_code}", f"authoritativeDurationMs={duration_ms}"])
    LOG.write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    write_verification(
        source_commit=source_commit,
        fingerprint=fingerprint,
        environment_record=environment_record,
        started=started,
        registry=registry,
        suite_results=suite_results,
        exit_code=exit_code,
    )
    if exit_code:
        print(f"authoritative verification: FAIL ({project_path(LOG)})")
        return exit_code
    print(f"authoritative verification: PASS ({len(SUITES)}/{len(SUITES)} suites)")
    print(f"completeRun=s8-strong-input-only evidence={project_path(VERIFICATION)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
