#!/usr/bin/env python3
"""运行《三借芭蕉扇》一条完整路径，并原子写回六键结论。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import sys


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
QA = PROJECT / "qa"
EVIDENCE = QA / "evidence" / "automated.json"
VERIFICATION = QA / "verification.json"
REPORT = QA / "QA_REPORT.md"
COMMAND = "python3 test/verify.py"
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")
TERMINAL = "ending: 三借芭蕉扇 · 完"
RESTART = "btn-restart -> title: 西游记 · 三借芭蕉扇 (new campaign)"


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


def evidence_payload(
    exit_code: int,
    checks: dict[str, str],
    suites: list[dict[str, object]],
    reason: str,
    value: dict[str, object] | None = None,
) -> dict[str, object]:
    value = dict(value or {})
    value["qa"] = {
        "command": COMMAND,
        "exitCode": exit_code,
        "completeRun": {
            "terminal": TERMINAL if exit_code == 0 else "NOT_RUN",
            "restart": RESTART if exit_code == 0 else "NOT_RUN",
        },
        "checks": checks,
    }
    value["suites"] = suites
    if exit_code:
        value["failure"] = reason
    else:
        value.pop("failure", None)
    return value


def verification_payload(
    exit_code: int,
    checks: dict[str, str],
    suites: list[dict[str, object]],
) -> dict[str, object]:
    status = "PASS" if exit_code == 0 else "FAIL"
    verification: dict[str, object] = {
        "schemaVersion": 2,
        "status": status,
        "verify": {"command": COMMAND, "exitCode": exit_code, "suites": suites},
        "completeRun": {
            "id": "journey-to-the-west-current-complete-run",
            "cleanContext": exit_code == 0,
            "terminal": TERMINAL if exit_code == 0 else "NOT_RUN",
            "restart": RESTART if exit_code == 0 else "NOT_RUN",
            "evidence": "qa/evidence/automated.json",
        },
        "checks": {
            name: {"status": checks[name], "evidence": ["qa/evidence/automated.json"]}
            for name in CHECK_NAMES
        },
        "limitations": [
            {
                "scope": "tested runtime",
                "reason": (
                    "The recorded browser run used local Chromium automation; other "
                    "browsers and device classes were not exercised."
                ),
            }
        ],
    }
    return verification


def report_text(exit_code: int, reason: str) -> str:
    status = "PASS" if exit_code == 0 else "FAIL"
    return f"""# 《三借芭蕉扇》QA 报告

`status: {status}`

## 结论与证据

机器事实源为 `qa/verification.json`，完整路径汇总为
`qa/evidence/automated.json`。本次结论：{reason}

实际运行命令（在 `build/app/`）：

```bash
{COMMAND}
```

## 限制

记录来自本地 Chromium 自动化，未覆盖其他浏览器和设备。自动化不证明主观趣味、节奏、长期平衡
或视觉完成度。
"""


def write_results(
    exit_code: int,
    checks: dict[str, str],
    suites: list[dict[str, object]],
    reason: str,
    evidence: dict[str, object] | None = None,
) -> None:
    atomic_json(EVIDENCE, evidence_payload(exit_code, checks, suites, reason, evidence))
    atomic_json(VERIFICATION, verification_payload(exit_code, checks, suites))
    atomic_text(REPORT, report_text(exit_code, reason))


def run_suite(
    identifier: str, command: tuple[str, ...], env: dict[str, str] | None = None
) -> dict[str, object]:
    shown = " ".join("python3" if part == sys.executable else part for part in command)
    print(f"[{identifier}] {shown}", flush=True)
    try:
        result = subprocess.run(command, cwd=APP, env=env)
        code = result.returncode
    except OSError as error:
        print(f"{identifier}: {error}", file=sys.stderr)
        code = 127
    return {"id": identifier, "executed": True, "passed": code == 0, "exitCode": code}


def main() -> int:
    failed_checks = {name: "FAIL" for name in CHECK_NAMES}
    write_results(
        1,
        failed_checks,
        [],
        "authoritative verification started but did not complete",
    )
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        write_results(2, failed_checks, [], "invalid verification arguments")
        return 2

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        browser_port = listener.getsockname()[1]
    browser_env = os.environ.copy()
    browser_env["BASE_URL"] = f"http://127.0.0.1:{browser_port}"
    suites = [run_suite(
        "browser:complete-run",
        (sys.executable, "test/qa_browser.py"),
        browser_env,
    )]
    try:
        evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        evidence = {}
    if not isinstance(evidence, dict):
        evidence = {}
    raw_checks = evidence.get("minimalChecks") if isinstance(evidence, dict) else None
    checks = {
        name: "PASS"
        if isinstance(raw_checks, dict) and raw_checks.get(name) is True
        else "FAIL"
        for name in CHECK_NAMES
    }
    exit_code = 0 if set(checks.values()) == {"PASS"} else 1
    reason = "六项最小完整路径通过。" if exit_code == 0 else "六项最小完整路径未全部通过。"
    write_results(exit_code, checks, suites, reason, evidence)
    print(f"authoritative verification: {'PASS' if exit_code == 0 else 'FAIL'}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
