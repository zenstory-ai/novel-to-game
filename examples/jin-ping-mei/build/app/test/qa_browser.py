#!/usr/bin/env python3
"""用真实 Chromium 全键盘走完《风月总账》五人二十日共同结局。"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Locator, Page, sync_playwright


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
URL = f"{BASE_URL}/?seed=42"
SHOTS = Path(os.environ.get("JPM_QA_SHOTS", PROJECT / "qa/evidence/browser"))
SAFE = SHOTS / "safe"
ADULT = SHOTS / "adult"
EVIDENCE = SHOTS / "evidence-normal.json"
HEROINE_IDS = ["wu_yueniang", "pan_jinlian", "li_pinger", "meng_yulou", "sun_xuee"]
ACCORDS = {
    "wu_yueniang": "accord_order",
    "pan_jinlian": "accord_truth",
    "li_pinger": "accord_safety",
    "meng_yulou": "accord_grace",
    "sun_xuee": "accord_hearth",
}
PUBLIC_BALANCE = {5: "public_balance_1", 10: "public_balance_2", 15: "public_balance_3"}
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")


def atomic_json(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def ensure_server() -> subprocess.Popen[bytes] | None:
    parsed = urlparse(BASE_URL)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    with socket.socket() as probe:
        try:
            probe.connect((host, port))
            return None
        except OSError:
            pass
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", host],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(80):
        with socket.socket() as probe:
            try:
                probe.connect((host, port))
                return process
            except OSError:
                time.sleep(0.1)
    process.kill()
    raise RuntimeError("本地服务启动失败")


def phase(page: Page) -> str:
    shell = page.locator("#game-shell")
    return shell.get_attribute("data-phase") if shell.count() else ""


def state(page: Page) -> dict[str, object] | None:
    return page.evaluate("window.__game?.state() ?? null")


def canonical_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def activate(page: Page, target: str | Locator, input_trace: list[dict[str, object]]) -> str:
    locator = page.locator(target) if isinstance(target, str) else target
    if locator.count() == 0:
        raise RuntimeError(f"找不到 {target!r}（phase={phase(page)}）")
    locator = locator.first
    if locator.is_disabled():
        raise RuntimeError(f"目标被锁住 {target!r}（phase={phase(page)}）")
    marker = {
        "phaseBefore": phase(page) or "title-or-age",
        "selector": target if isinstance(target, str) else "locator",
        "text": locator.inner_text().strip()[:80],
        "key": "Enter",
    }
    locator.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(55)
    result = page.locator("#result-overlay")
    response = ""
    if result.count() and result.is_visible():
        response = result.inner_text()
        close = page.locator("#btn-result-continue")
        close.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(55)
        marker["resultOverlayClosedWith"] = "Enter"
    marker["phaseAfter"] = phase(page) or "title-or-age"
    input_trace.append(marker)
    return response


def screenshot(page: Page, directory: Path, name: str) -> str:
    path = directory / f"{name}.jpg"
    page.screenshot(path=path, type="jpeg", quality=82)
    return path.relative_to(PROJECT).as_posix()


def viewport_fit(page: Page) -> dict[str, object]:
    return page.evaluate(
        """() => {
          const root = document.documentElement;
          const stage = document.querySelector('#phase-stage, .title-screen, .ending-view');
          const box = stage?.getBoundingClientRect();
          return {
            viewport: {width: innerWidth, height: innerHeight},
            horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
            stage: box ? {left: box.left, top: box.top, right: box.right, bottom: box.bottom} : null,
            fatal: Boolean(document.querySelector('#asset-error,.fatal-card')),
          };
        }"""
    )


def resolve_morning(page: Page, input_trace: list[dict[str, object]]) -> None:
    if phase(page) != "morning":
        return
    target = page.locator('[data-morning="appease"]:not([disabled])')
    if target.count() == 0:
        target = page.locator('[data-morning="explain"]:not([disabled])')
    if target.count() == 0:
        target = page.locator("[data-morning]:not([disabled])").first
    activate(page, target, input_trace)


def settle_interlude(
    page: Page,
    day: int,
    input_trace: list[dict[str, object]],
    screenshots: dict[str, str],
) -> None:
    if phase(page) == "joint_result":
        joint_id = page.locator("[data-joint-result]").get_attribute("data-joint-result") or "joint"
        screenshots[f"joint-{joint_id}"] = screenshot(page, SAFE, f"joint_{joint_id}")
        activate(page, '[data-joint-continue="1"]', input_trace)
    if phase(page) == "household":
        activate(page, page.locator("button[data-household]:not([disabled])").first, input_trace)
    if phase(page) == "banquet":
        activate(page, f'[data-banquet="{PUBLIC_BALANCE[day]}"]', input_trace)
        if phase(page) != "scene":
            raise RuntimeError(f"第{day}日公开选择后未进入场景册")
        screenshots[f"public-day-{day}"] = screenshot(page, SAFE, f"public_day_{day}")
        activate(page, "#btn-scene-close", input_trace)


def choose_day(
    page: Page,
    day: int,
    input_trace: list[dict[str, object]],
    screenshots: dict[str, str],
) -> str:
    joint = page.locator("button[data-joint-action]:not([disabled])")
    if joint.count():
        target = joint.first
        action = target.get_attribute("data-joint-action") or ""
        activate(page, target, input_trace)
    else:
        action = "ledger"
        activate(page, '[data-day-action="ledger"]', input_trace)
    settle_interlude(page, day, input_trace, screenshots)
    return action


def main() -> int:
    if len(sys.argv) != 1:
        print("usage: python3 test/qa_browser.py", file=sys.stderr)
        return 2
    if "fast=1" in URL:
        raise RuntimeError("权威路径不得启用 fast=1")

    start_time = time.time()
    server = ensure_server()
    if SAFE.exists():
        shutil.rmtree(SAFE)
    if ADULT.exists():
        shutil.rmtree(ADULT)
    SAFE.mkdir(parents=True, exist_ok=True)
    ADULT.mkdir(parents=True, exist_ok=True)

    checks = {name: False for name in CHECK_NAMES}
    console_errors: list[str] = []
    page_errors: list[str] = []
    network_errors: list[str] = []
    http_errors: list[str] = []
    response_status: dict[str, int] = {}
    input_trace: list[dict[str, object]] = []
    day_trace: list[dict[str, object]] = []
    route_trace: list[dict[str, object]] = []
    preterminal: list[dict[str, object]] = []
    screenshots: dict[str, str] = {}
    viewport_checks: list[dict[str, object]] = []
    reload_evidence: dict[str, object] = {}
    corrupt_save: dict[str, object] = {}
    browser_version = ""
    terminal: dict[str, object] = {}
    restart_state: dict[str, object] = {}
    age_no_safe = False

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            browser_version = browser.version
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("requestfailed", lambda request: network_errors.append(f"{request.url}: {request.failure}"))

            def remember_response(response: object) -> None:
                status = getattr(response, "status")
                url = getattr(response, "url")
                response_status[url] = status
                if status >= 400:
                    http_errors.append(f"{status} {url}")

            page.on("response", remember_response)
            page.goto(URL, wait_until="networkidle")
            page.wait_for_function("window.__game && window.__game.assets().ok === true")
            actual_url = page.url
            if "fast=1" in actual_url:
                raise RuntimeError(f"权威路径误开 fast：{actual_url}")

            body_before_age = page.locator("body").inner_text()
            age_dom_safe = (
                page.locator("#age-gate").count() == 1
                and page.locator("#scene-image,#gallery-replay-image,.gallery-card img").count() == 0
                and not any(scene_title in body_before_age for scene_title in ["账页压在床边", "花园门闩落了", "灯影里仍有五声回应"])
            )
            screenshots["age-gate"] = screenshot(page, SAFE, "01_age_gate")
            activate(page, "#btn-age-yes", input_trace)
            checks["launch"] = age_dom_safe and page.locator(".title-screen").count() == 1
            activate(page, "#btn-start", input_trace)
            activate(page, '[data-opening="opening_open_ledger"]', input_trace)
            opening_state = state(page) or {}
            checks["input"] = bool(opening_state.get("history") and opening_state["history"][0].get("choice") == "opening_open_ledger")

            seen_heroines: set[str] = set()
            joint_actions: list[str] = []
            for day in range(1, 21):
                resolve_morning(page, input_trace)
                if phase(page) != "day":
                    raise RuntimeError(f"第{day}日没有进入白日阶段：{phase(page)}")
                current = state(page) or {}
                if current.get("day") != day:
                    raise RuntimeError(f"日序错位：期望 {day}，实际 {current.get('day')}")
                day_def = page.evaluate("window.__game.dayDef()")
                day_trace.append(
                    {
                        "day": day,
                        "pressureId": day_def["id"],
                        "pressureText": day_def["pressure"],
                        "pressureTextHash": hashlib.sha256(day_def["pressure"].encode("utf-8")).hexdigest(),
                        "phase": phase(page),
                    }
                )
                if day <= 19:
                    preterminal.append(
                        {
                            "day": day,
                            "phaseIsNotEnding": phase(page) != "ending",
                            "overIsFalse": current.get("over") is False,
                            "endingAbsent": current.get("ending") is None,
                            "sharedInvitationAbsent": page.locator("[data-shared-start]").count() == 0,
                        }
                    )
                if day in (1, 10, 19, 20):
                    screenshots[f"day-{day}"] = screenshot(page, SAFE, f"day_{day:02d}")

                action = choose_day(page, day, input_trace, screenshots)
                if action.startswith("joint_"):
                    joint_actions.append(action)
                if phase(page) != "choose_visit":
                    raise RuntimeError(f"第{day}日白日结算后未到院门：{phase(page)}")

                if day == 1:
                    screenshots["five-door-hub"] = screenshot(page, SAFE, "02_five_door_hub")
                    viewport_checks.append({"screen": "five-door-hub", **viewport_fit(page)})
                if day == 10:
                    before = state(page)
                    before_hash = canonical_hash(before)
                    page.reload(wait_until="networkidle")
                    page.wait_for_function("window.__game && window.__game.assets().ok === true")
                    if page.locator("#btn-continue").count() != 1 or page.locator("#btn-continue").is_disabled():
                        raise RuntimeError("中局刷新后继续按钮不可用")
                    activate(page, "#btn-continue", input_trace)
                    after = state(page)
                    after_hash = canonical_hash(after)
                    reload_evidence = {
                        "day": 10,
                        "phase": "choose_visit",
                        "beforeSerializedStateHash": before_hash,
                        "afterSerializedStateHash": after_hash,
                        "match": before_hash == after_hash and before == after,
                    }
                    if not reload_evidence["match"]:
                        raise RuntimeError("中局刷新续读后的状态不一致")

                if day == 20:
                    screenshots["day-20-coalition-gate"] = screenshot(page, SAFE, "20_coalition_gate")
                    viewport_checks.append({"screen": "day-20-coalition-gate", **viewport_fit(page)})
                    break

                heroine = HEROINE_IDS[(day - 1) % len(HEROINE_IDS)]
                before = state(page) or {}
                before_qing = before["relations"][heroine]["qing"]
                activate(page, f'[data-visit="{heroine}"]', input_trace)
                if heroine not in seen_heroines:
                    choice_id = ACCORDS[heroine]
                    target = f'[data-route-choice="{choice_id}"]:not([disabled])'
                else:
                    target_locator = page.locator("button[data-route-choice]:not([disabled])").first
                    choice_id = target_locator.get_attribute("data-route-choice") or ""
                    target = target_locator
                activate(page, target, input_trace)
                activate(page, '[data-night="talk"]:not([disabled])', input_trace)
                after = state(page) or {}
                route_trace.append(
                    {
                        "day": day,
                        "heroine": heroine,
                        "choice": choice_id,
                        "qingBefore": before_qing,
                        "qingAfter": after["relations"][heroine]["qing"],
                        "visitCount": after["visits"][heroine],
                        "characterSpecificConsequence": after["relations"][heroine]["reasons"][0],
                    }
                )
                seen_heroines.add(heroine)

            final_gate = state(page) or {}
            if page.locator('[data-shared-start="1"]').count() != 1:
                raise RuntimeError("第二十日共同邀请没有出现")
            activate(page, '[data-shared-start="1"]', input_trace)
            activate(page, '[data-shared-night="shared_five_roles"]', input_trace)
            if phase(page) != "scene" or page.locator('[data-scene-id="inner_court_accord"]').count() != 1:
                raise RuntimeError("五约同灯场景没有出现")
            screenshots["five-accord-scene"] = screenshot(page, SAFE, "21_five_accord")
            activate(page, "#btn-scene-close", input_trace)
            for choice in ("after_1_names", "after_2_hear", "after_3_pact"):
                activate(page, f'[data-shared-afterglow="{choice}"]', input_trace)
            if phase(page) != "scene" or page.locator('[data-scene-id="inner_court_afterglow"]').count() != 1:
                raise RuntimeError("五人余夜场景没有出现")
            screenshots["adult-five-afterglow"] = screenshot(page, ADULT, "five_afterglow")
            activate(page, "#btn-scene-close", input_trace)
            activate(page, '[data-shared-dawn="dawn_six_tea"]', input_trace)
            ended = state(page) or {}
            terminal = {
                "day": ended.get("day"),
                "phase": ended.get("phase"),
                "over": ended.get("over"),
                "endingId": (ended.get("ending") or {}).get("id"),
                "accords": ended.get("accords"),
                "jointActions": ended.get("jointActions"),
                "publicPromises": [bool(ended.get("flags", {}).get(f"public_vow_{index}")) for index in (1, 2, 3)],
                "sharedAfterglowChoices": ended.get("sharedAfterglowChoices"),
                "sharedDawnChoice": ended.get("sharedDawnChoice"),
            }
            screenshots["terminal-1280"] = screenshot(page, SAFE, "22_terminal_1280")
            page.set_viewport_size({"width": 1920, "height": 1080})
            page.wait_for_timeout(100)
            viewport_checks.append({"screen": "terminal-1920", **viewport_fit(page)})
            screenshots["terminal-1920"] = screenshot(page, SAFE, "23_terminal_1920")
            checks["outcome"] = (
                terminal["day"] == 20
                and terminal["phase"] == "ending"
                and terminal["over"] is True
                and terminal["endingId"] == "balanced"
                and len(terminal["jointActions"] or []) == 5
                and all(terminal["publicPromises"])
            )

            gallery_before_restart = page.evaluate("window.__game.gallery()")
            activate(page, "#btn-restart", input_trace)
            restarted = state(page) or {}
            restart_state = {
                "day": restarted.get("day"),
                "phase": restarted.get("phase"),
                "over": restarted.get("over"),
                "relationsKeys": sorted((restarted.get("relations") or {}).keys()),
                "visits": restarted.get("visits"),
                "jointActions": restarted.get("jointActions"),
                "galleryCountBefore": len(gallery_before_restart),
                "galleryCountAfter": len(page.evaluate("window.__game.gallery()")),
            }
            checks["restart"] = (
                restart_state["day"] == 1
                and restart_state["phase"] == "opening"
                and restart_state["over"] is False
                and restart_state["relationsKeys"] == sorted(HEROINE_IDS)
                and all(value == 0 for value in (restart_state["visits"] or {}).values())
                and restart_state["galleryCountAfter"] == restart_state["galleryCountBefore"]
            )
            activate(page, "#btn-gallery", input_trace)
            screenshots["restart-gallery"] = screenshot(page, SAFE, "24_restart_gallery")
            activate(page, "#btn-gallery-close", input_trace)

            page.evaluate("localStorage.setItem(window.__game.saveKey, '{broken-json')")
            page.reload(wait_until="networkidle")
            page.wait_for_function("window.__game && window.__game.assets().ok === true")
            corrupt_save = {
                "continueDisabled": page.locator("#btn-continue").is_disabled(),
                "saveRemoved": page.evaluate("localStorage.getItem(window.__game.saveKey) === null"),
                "titleVisible": page.locator(".title-screen").count() == 1,
            }

            asset_paths = page.evaluate("window.__game.assetPaths")
            loaded_assets = page.evaluate("window.__game.assets().loaded")
            asset_manifest: list[dict[str, object]] = []
            for key, relative in sorted(asset_paths.items()):
                file_path = APP / relative
                url = urljoin(actual_url, relative)
                loaded = loaded_assets.get(key, {})
                asset_manifest.append(
                    {
                        "key": key,
                        "path": relative,
                        "sha256": hashlib.sha256(file_path.read_bytes()).hexdigest(),
                        "bytes": file_path.stat().st_size,
                        "naturalWidth": loaded.get("width", 0),
                        "naturalHeight": loaded.get("height", 0),
                        "httpStatus": response_status.get(url),
                    }
                )

            checks["coreLoop"] = (
                len(day_trace) == 20
                and [row["day"] for row in day_trace] == list(range(1, 21))
                and len({row["pressureId"] for row in day_trace}) == 20
                and len({row["pressureTextHash"] for row in day_trace}) == 20
                and set(row["heroine"] for row in route_trace) == set(HEROINE_IDS)
                and len(joint_actions) == 5
                and len(preterminal) == 19
                and all(all(row[key] for key in ("phaseIsNotEnding", "overIsFalse", "endingAbsent", "sharedInvitationAbsent")) for row in preterminal)
                and reload_evidence.get("match") is True
            )
            checks["render"] = (
                all(row["naturalWidth"] > 0 and row["naturalHeight"] > 0 and row["httpStatus"] == 200 for row in asset_manifest)
                and not any(row["horizontalOverflow"] or row["fatal"] for row in viewport_checks)
                and page.locator("#asset-error,.fatal-card").count() == 0
            )

            no_context = browser.new_context(viewport={"width": 1280, "height": 800})
            no_page = no_context.new_page()
            no_page.on("console", lambda message: console_errors.append(f"age-no:{message.text}") if message.type == "error" else None)
            no_page.on("pageerror", lambda error: page_errors.append(f"age-no:{error}"))
            no_page.goto(URL, wait_until="networkidle")
            no_page.wait_for_function("window.__game && window.__game.assets().ok === true")
            activate(no_page, "#btn-age-no", input_trace)
            age_no_safe = (
                "只供成年人" in no_page.locator("body").inner_text()
                and no_page.locator("#scene-image,#gallery-replay-image,.gallery-card img").count() == 0
            )
            no_context.close()
            context.close()
            browser.close()

        duration_ms = int((time.time() - start_time) * 1000)
        ordered_inputs = [
            f"{index + 1:03d}. {row['phaseBefore']} | Enter | {row['text']} | {row['phaseAfter']}"
            for index, row in enumerate(input_trace)
        ]
        evidence = {
            "schemaVersion": 1,
            "runId": "jin-ping-mei-five-house-twenty-day-main-path",
            "environment": {
                "browser": {"name": "Chromium", "version": browser_version},
                "url": URL,
                "normalSpeedRun": True,
                "durationMs": duration_ms,
                "viewports": [[1280, 800], [1920, 1080]],
                "assetManifest": asset_manifest,
                "viewportChecks": viewport_checks,
                "screenshots": screenshots,
                "errors": {"console": console_errors, "page": page_errors, "network": network_errors, "http": http_errors},
            },
            "inputTrace": ordered_inputs,
            "observations": {
                "launch": {
                    "id": "age-gate-and-title-ready",
                    "inputs": ["navigate to seed=42 without fast mode", "press Enter on the 18+ confirmation"],
                    "state": {"adultContentAbsentBeforeConfirmation": age_dom_safe, "ageNoNeverExposesAdultDom": age_no_safe, "titleVisible": True},
                    "visual": screenshots["age-gate"],
                },
                "render": {
                    "id": "five-door-and-terminal-rendered",
                    "inputs": ["render the five-door hub", "render the day-20 ending at both target viewports"],
                    "state": {"assetCount": len(asset_manifest), "allAssetsDecoded": all(row["naturalWidth"] > 0 and row["naturalHeight"] > 0 and row["httpStatus"] == 200 for row in asset_manifest), "viewportChecks": viewport_checks, "errors": {"console": console_errors, "page": page_errors, "network": network_errors, "http": http_errors}},
                    "visual": screenshots["five-door-hub"],
                },
                "input": {
                    "id": "keyboard-path-and-save-reload-accepted",
                    "inputs": ["activate every game decision with focused Enter", "reload at day 10 and continue"],
                    "state": {"mode": "keyboard-only Enter activation", "acceptedInputCount": len(input_trace), "openingChoice": "opening_open_ledger", "midpointReload": reload_evidence, "corruptSave": corrupt_save},
                },
                "coreLoop": {
                    "id": "twenty-day-five-route-loop-complete",
                    "inputs": ["complete days 1 through 20", "touch all five heroine routes", "complete five distinct joint actions and three public promises"],
                    "state": {"dayTrace": day_trace, "routeTrace": route_trace, "jointActions": joint_actions, "preterminalAssertions": preterminal, "finalGateBeforeInvitation": {"day": final_gate.get("day"), "phase": final_gate.get("phase"), "accords": final_gate.get("accords"), "jointActions": final_gate.get("jointActions")}},
                },
                "outcome": {
                    "id": "day-20-balanced-ending",
                    "inputs": ["choose shared_five_roles", "complete three afterglow decisions", "choose dawn_six_tea"],
                    "state": {"terminal": "day-20-balanced-ending", **terminal},
                    "visual": screenshots["terminal-1920"],
                },
                "restart": {
                    "id": "day-1-clean-restart",
                    "inputs": ["press Enter on restart", "open the persistent gallery"],
                    "state": {"restart": "day-1-opening-five-maps-reset", **restart_state},
                },
            },
        }
        atomic_json(EVIDENCE, evidence)
        all_passed = (
            all(checks.values())
            and age_dom_safe
            and age_no_safe
            and reload_evidence.get("match") is True
            and corrupt_save == {"continueDisabled": True, "saveRemoved": True, "titleVisible": True}
            and not any((console_errors, page_errors, network_errors, http_errors))
        )
        print(f"browser={browser_version} url={URL} normalSpeedRun=true durationMs={duration_ms}")
        print(f"days={len(day_trace)} routes={len(set(row['heroine'] for row in route_trace))} joints={len(joint_actions)} ending={terminal.get('endingId')}")
        print("checks=" + ", ".join(f"{key}:{'PASS' if value else 'FAIL'}" for key, value in checks.items()))
        print(f"errors console={len(console_errors)} page={len(page_errors)} network={len(network_errors)} http={len(http_errors)}")
        return 0 if all_passed else 1
    except Exception as error:
        duration_ms = int((time.time() - start_time) * 1000)
        atomic_json(
            EVIDENCE,
            {
                "schemaVersion": 1,
                "runId": "jin-ping-mei-five-house-twenty-day-main-path",
                "environment": {"url": URL, "normalSpeedRun": True, "durationMs": duration_ms, "failure": f"{type(error).__name__}: {error}"},
                "inputTrace": ["browser QA failed before the complete path"],
                "observations": {},
            },
        )
        print(f"browser QA FAIL: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=3)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    raise SystemExit(main())
