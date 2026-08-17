#!/usr/bin/env python3
"""重跑五人二十日浏览器路径，并对证据字段逐项 fail-closed 校验。"""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import parse_qs, urlparse


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
EVIDENCE = PROJECT / "qa/evidence/browser/evidence-normal.json"
VERIFICATION = PROJECT / "qa/verification.json"
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")
HEROINES = {"wu_yueniang", "pan_jinlian", "li_pinger", "meng_yulou", "sun_xuee"}
ROUTE_PREFIX = {"wu_yueniang": "yue_", "pan_jinlian": "pan_", "li_pinger": "pinger_", "meng_yulou": "meng_", "sun_xuee": "xuee_"}
ACCORD_CHOICE = {"wu_yueniang": "accord_order", "pan_jinlian": "accord_truth", "li_pinger": "accord_safety", "meng_yulou": "accord_grace", "sun_xuee": "accord_hearth"}
SCENE_ASSET_KEYS = {
    "cg/yue/prelude", "cg/yue/explicit", "cg/pan/prelude", "cg/pan/explicit",
    "cg/pinger/prelude", "cg/pinger/explicit", "cg/meng/prelude", "cg/meng/explicit",
    "cg/xuee/prelude", "cg/xuee/explicit", "cg/group/public_day5",
    "cg/group/public_day10", "cg/group/public_day15", "cg/group/inner_court_accord",
    "cg/group/inner_court_afterglow",
}
DOOR_ASSET_KEYS = {"heroine/yue", "heroine/pan", "heroine/pinger", "heroine/meng", "heroine/xuee"}
REQUIRED_SHOTS = {
    "age-gate",
    "five-door-hub",
    "day-1",
    "day-10",
    "day-19",
    "day-20",
    "day-20-coalition-gate",
    "five-accord-scene",
    "adult-five-afterglow",
    "terminal-1280",
    "terminal-1920",
    "restart-gallery",
}


def atomic_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def validate_evidence(value: object) -> list[str]:
    errors: list[str] = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    if not isinstance(value, dict):
        return ["evidence root must be an object"]
    require(set(value) == {"schemaVersion", "runId", "environment", "inputTrace", "observations"}, "evidence top-level fields do not match the repository contract")
    require(value.get("schemaVersion") == 1, "schemaVersion must be 1")
    require(value.get("runId") == "jin-ping-mei-five-house-twenty-day-main-path", "runId mismatch")

    environment = value.get("environment")
    require(isinstance(environment, dict), "environment missing")
    environment = environment if isinstance(environment, dict) else {}
    require(environment.get("normalSpeedRun") is True, "normalSpeedRun must be true")
    require(isinstance(environment.get("durationMs"), int) and environment.get("durationMs", 0) > 0, "durationMs must be positive")
    browser = environment.get("browser")
    require(isinstance(browser, dict) and browser.get("name") == "Chromium" and bool(browser.get("version")), "browser/version missing")
    url = environment.get("url")
    if isinstance(url, str):
        query = parse_qs(urlparse(url).query)
        require(query.get("seed") == ["42"], "authoritative URL must use seed=42")
        require("fast" not in query, "authoritative URL must not include fast")
    else:
        require(False, "URL missing")

    trace = value.get("inputTrace")
    require(isinstance(trace, list) and len(trace) >= 80, "ordered input trace is incomplete")
    if isinstance(trace, list):
        require(all(isinstance(row, str) and "Enter" in row for row in trace), "input trace contains non-Enter activation")

    observations = value.get("observations")
    require(isinstance(observations, dict) and set(observations) == set(CHECKS), "six observations are required")
    observations = observations if isinstance(observations, dict) else {}
    for name in CHECKS:
        row = observations.get(name)
        require(isinstance(row, dict) and bool(row.get("id")) and bool(row.get("inputs")) and isinstance(row.get("state"), dict), f"observation {name} is incomplete")

    launch = observations.get("launch", {}).get("state", {})
    require(launch.get("adultContentAbsentBeforeConfirmation") is True and launch.get("ageNoNeverExposesAdultDom") is True and launch.get("titleVisible") is True, "age gate adult-content boundary failed")

    input_state = observations.get("input", {}).get("state", {})
    require(input_state.get("mode") == "keyboard-only Enter activation", "input mode is not keyboard-only")
    reload_evidence = input_state.get("midpointReload")
    require(isinstance(reload_evidence, dict) and reload_evidence.get("day") == 10 and reload_evidence.get("match") is True and reload_evidence.get("beforeSerializedStateHash") == reload_evidence.get("afterSerializedStateHash"), "midpoint reload proof failed")
    require(input_state.get("corruptSave") == {"continueDisabled": True, "saveRemoved": True, "titleVisible": True}, "corrupt-save rejection proof failed")

    core = observations.get("coreLoop", {}).get("state", {})
    days = core.get("dayTrace")
    require(isinstance(days, list) and len(days) == 20, "dayTrace must contain 20 rows")
    if isinstance(days, list) and len(days) == 20:
        require([row.get("day") for row in days] == list(range(1, 21)), "dayTrace day order must be 1..20")
        require(len({row.get("pressureId") for row in days}) == 20, "pressure IDs must be unique")
        require(len({row.get("pressureTextHash") for row in days}) == 20, "pressure text hashes must be unique")
        require(all(row.get("phase") == "day" and bool(row.get("pressureText")) for row in days), "dayTrace contains missing copy/phase")
    routes = core.get("routeTrace")
    require(isinstance(routes, list) and {row.get("heroine") for row in routes} == HEROINES, "route trace must touch all five heroines")
    if isinstance(routes, list):
        require(len({row.get("choice") for row in routes}) == len(routes), "route choices must be distinct authored steps")
        for heroine in HEROINES:
            rows = [row for row in routes if row.get("heroine") == heroine]
            require(len(rows) >= 3 and all(bool(row.get("characterSpecificConsequence")) for row in rows), f"missing route coverage/consequence for {heroine}")
            require(rows[0].get("choice") == ACCORD_CHOICE[heroine], f"first route choice must establish {heroine}'s accord")
            require(all(row.get("choice") == ACCORD_CHOICE[heroine] or str(row.get("choice", "")).startswith(ROUTE_PREFIX[heroine]) for row in rows), f"route choice does not belong to {heroine}")
            require([row.get("visitCount") for row in rows] == list(range(len(rows))), f"visit counters are not sequential for {heroine}")
            require(all(row.get("qingAfter", 0) >= row.get("qingBefore", 0) for row in rows) and any(row.get("qingAfter", 0) > row.get("qingBefore", 0) for row in rows), f"route did not preserve/increase qing for {heroine}")
    require(len(core.get("jointActions") or []) == 5, "five joint actions were not completed")
    preterminal = core.get("preterminalAssertions")
    require(isinstance(preterminal, list) and len(preterminal) == 19, "preterminal assertions must contain days 1..19")
    if isinstance(preterminal, list) and len(preterminal) == 19:
        require([row.get("day") for row in preterminal] == list(range(1, 20)), "preterminal day order invalid")
        require(all(row.get("phaseIsNotEnding") is True and row.get("overIsFalse") is True and row.get("endingAbsent") is True and row.get("sharedInvitationAbsent") is True for row in preterminal), "an ending/invitation appeared before day 20")

    terminal = observations.get("outcome", {}).get("state", {})
    require(terminal.get("terminal") == "day-20-balanced-ending" and terminal.get("day") == 20 and terminal.get("phase") == "ending" and terminal.get("over") is True and terminal.get("endingId") == "balanced" and len(terminal.get("jointActions") or []) == 5 and terminal.get("publicPromises") == [True, True, True], "day-20 balanced terminal proof failed")
    restart = observations.get("restart", {}).get("state", {})
    restart_visits = restart.get("visits")
    require(restart.get("restart") == "day-1-opening-five-maps-reset" and restart.get("day") == 1 and restart.get("phase") == "opening" and restart.get("over") is False and set(restart.get("relationsKeys") or []) == HEROINES and isinstance(restart_visits, dict) and set(restart_visits) == HEROINES and all(item == 0 for item in restart_visits.values()) and restart.get("galleryCountAfter") == restart.get("galleryCountBefore"), "restart proof failed")

    assets = environment.get("assetManifest")
    require(isinstance(assets, list) and len(assets) >= 30, "asset manifest is incomplete")
    if isinstance(assets, list):
        require(len({row.get("key") for row in assets}) == len(assets), "asset keys are duplicated")
        require(all(isinstance(row.get("sha256"), str) and len(row["sha256"]) == 64 and row.get("naturalWidth", 0) > 0 and row.get("naturalHeight", 0) > 0 and row.get("httpStatus") == 200 for row in assets), "an asset failed hash/decode/HTTP checks")
        by_key = {row.get("key"): row for row in assets}
        require(set(by_key) >= SCENE_ASSET_KEYS | DOOR_ASSET_KEYS, "scene/door asset evidence is incomplete")
        scene_assets = [by_key[key] for key in SCENE_ASSET_KEYS if key in by_key]
        door_assets = [by_key[key] for key in DOOR_ASSET_KEYS if key in by_key]
        require(len(scene_assets) == 15 and len({row.get("path") for row in scene_assets}) == 15 and len({row.get("sha256") for row in scene_assets}) == 15, "scene asset paths/hashes must be unique")
        require(len(door_assets) == 5 and len({row.get("path") for row in door_assets}) == 5 and len({row.get("sha256") for row in door_assets}) == 5, "door asset paths/hashes must be unique")
    viewports = environment.get("viewportChecks")
    require(isinstance(viewports, list) and {row.get("screen") for row in viewports} >= {"five-door-hub", "day-20-coalition-gate", "terminal-1920"}, "required viewport screens missing")
    if isinstance(viewports, list):
        require(all(row.get("horizontalOverflow") is False and row.get("fatal") is False for row in viewports), "viewport overflow/fatal card detected")
    shots = environment.get("screenshots")
    require(isinstance(shots, dict) and set(shots) >= REQUIRED_SHOTS, "required screenshots missing")
    if isinstance(shots, dict):
        for name in REQUIRED_SHOTS:
            relative = shots.get(name)
            require(isinstance(relative, str) and (PROJECT / relative).is_file(), f"screenshot missing on disk: {name}")
        require("/adult/" in str(shots.get("adult-five-afterglow", "")), "adult frame must stay in adult evidence directory")
        require(all("/adult/" not in path for name, path in shots.items() if name != "adult-five-afterglow"), "safe evidence references adult directory")
    runtime_errors = environment.get("errors")
    require(isinstance(runtime_errors, dict), "error arrays missing")
    if isinstance(runtime_errors, dict):
        for name in ("console", "page", "network", "http"):
            require(runtime_errors.get(name) == [], f"{name} errors are not empty")
    return errors

def write_verification(passed: bool, errors: list[str]) -> None:
    status = "PASS" if passed else "FAIL"
    atomic_json(
        VERIFICATION,
        {
            "schemaVersion": 3,
            "status": status,
            "verify": {"command": "python3 test/verify.py", "exitCode": 0 if passed else 1},
            "completeRun": {
                "id": "jin-ping-mei-five-house-twenty-day-main-path",
                "cleanContext": passed,
                "terminal": "day-20-balanced-ending" if passed else "NOT_VERIFIED",
                "restart": "day-1-opening-five-maps-reset" if passed else "NOT_VERIFIED",
                "evidence": "qa/evidence/browser/evidence-normal.json",
            },
            "checks": {name: status for name in CHECKS},
            "limitations": [
                {
                    "scope": "tested runtime",
                    "reason": "权威路径覆盖本机 Chromium 的 1280×800 与 1920×1080；未把主观趣味、所有结局、移动端或其他浏览器宣称为已验证。",
                }
            ],
        },
    )


def main() -> int:
    if len(sys.argv) != 1:
        print("usage: python3 test/verify.py", file=sys.stderr)
        return 2
    atomic_json(EVIDENCE, {
        "schemaVersion": 1,
        "runId": "jin-ping-mei-five-house-twenty-day-main-path",
        "environment": {"failure": "verification did not complete"},
        "inputTrace": ["browser run did not complete"],
        "observations": {},
    })
    write_verification(False, ["browser run not completed"])
    result = subprocess.run([sys.executable, "test/qa_browser.py"], cwd=APP)
    errors: list[str]
    if result.returncode != 0:
        errors = [f"qa_browser.py exited {result.returncode}"]
    else:
        try:
            errors = validate_evidence(json.loads(EVIDENCE.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as error:
            errors = [f"cannot read evidence: {error}"]
    passed = result.returncode == 0 and not errors
    write_verification(passed, errors)
    print(f"authoritative verification: {'PASS' if passed else 'FAIL'}")
    if errors:
        for error in errors:
            print(f"  - {error}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
