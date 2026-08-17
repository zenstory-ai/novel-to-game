#!/usr/bin/env python3
"""用 Playwright 全键盘跑《风月总账》三院同灯路线并保留三张代表帧。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SLOW = bool(os.environ.get("QA_SLOW"))
URL = f"{BASE_URL}/?seed=42" + ("" if SLOW else "&fast=1")
SHOTS = Path(os.environ.get("JPM_QA_SHOTS", PROJECT / "qa/evidence/browser"))
SAFE = SHOTS / "safe"
ADULT = SHOTS / "adult"
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")


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
    for _ in range(50):
        with socket.socket() as probe:
            try:
                probe.connect((host, port))
                return process
            except OSError:
                time.sleep(0.1)
    process.kill()
    raise RuntimeError("本地服务启动失败")


def phase(page: Page) -> str:
    return page.locator("#game-shell").get_attribute("data-phase") or ""


def state(page: Page) -> dict[str, object]:
    return page.evaluate("__game.state()")


def activate(page: Page, selector: str, result_contains: str | None = None) -> str:
    node = page.locator(selector)
    if node.count() == 0:
        raise RuntimeError(f"找不到 {selector}（phase={phase(page)}）")
    node.first.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(80)
    response = ""
    result = page.locator("#result-overlay")
    if result.count() and result.is_visible():
        response = result.inner_text()
        if result_contains and result_contains not in response:
            raise RuntimeError(f"选择回应未显示 {result_contains!r}：{response}")
        close = page.locator("#btn-result-continue")
        close.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(80)
    elif result_contains:
        raise RuntimeError(f"选择后没有可见回应：{result_contains!r}")
    return response


def shot(page: Page, name: str) -> Path:
    output = SAFE / f"{name}.jpg"
    page.screenshot(path=output, type="jpeg", quality=80)
    return output


def adult_shot(page: Page, name: str) -> Path:
    output = ADULT / f"{name}.jpg"
    page.screenshot(path=output, type="jpeg", quality=80)
    return output


def resolve_morning(page: Page) -> None:
    if phase(page) != "morning":
        return
    option = page.locator('[data-morning="explain"]:not([disabled])')
    if option.count() == 0:
        option = page.locator("[data-morning]:not([disabled])").first
    activate(page, f'[data-morning="{option.get_attribute("data-morning")}"]:not([disabled])')


def choose_day(
    page: Page,
    joint_action: str | None = None,
    capture_name: str | None = None,
) -> str | None:
    joint_result = None
    if joint_action:
        activate(page, f'[data-joint-action="{joint_action}"]:not([disabled])')
        if phase(page) != "joint_result":
            raise RuntimeError(f"联院差事没有进入结果画面：{joint_action}")
        result = page.locator(f'[data-joint-result="{joint_action}"]')
        if result.count() != 1 or not result.is_visible():
            raise RuntimeError(f"联院结果画面没有渲染：{joint_action}")
        joint_result = result.get_attribute("data-joint-result")
        if capture_name:
            shot(page, capture_name)
        activate(page, '[data-joint-continue="1"]')
    else:
        activate(page, '[data-day-action="ledger"]')
    if phase(page) == "household":
        option = page.locator("button[data-household]:not([disabled])").first
        activate(page, f'[data-household="{option.get_attribute("data-household")}"]:not([disabled])')
    if phase(page) == "banquet":
        activate(page, '[data-banquet="banquet_balance"]:not([disabled])')
        activate(page, "#btn-scene-close")
    return joint_result


def route_night(page: Page, heroine: str, route: str, night: str = "talk") -> None:
    activate(page, f'[data-visit="{heroine}"]')
    activate(page, f'[data-route-choice="{route}"]')
    target = page.locator(f'[data-night="{night}"]:not([disabled])')
    if target.count() != 1:
        raise RuntimeError(f"夜间选项未解锁：{night}")
    activate(page, f'[data-night="{night}"]:not([disabled])')
    if phase(page) == "scene":
        activate(page, "#btn-scene-close")


def run_path() -> tuple[
    dict[str, bool],
    list[str],
    list[str],
    list[str],
    dict[str, object],
    list[str],
    str,
]:
    checks = {name: False for name in CHECK_NAMES}
    console_errors: list[str] = []
    network_errors: list[str] = []
    http_errors: list[str] = []
    observations: dict[str, object] = {}
    input_trace = [
        "use keyboard Enter to confirm the 18+ age gate",
        "use keyboard only to start and choose the respectful opening",
        "hear Yue's order term, Pan's truth term, and Pinger's safety term",
        "complete joint_yue_pan and joint_yue_pinger as visible two-woman scenes",
        "balance the public banquet and invite all three women on night six",
        "choose shared_divide_roles, view inner_court_accord, make two visible afterglow choices, view inner_court_afterglow, choose a dawn outcome, and reach 三院同灯",
        "restart and confirm the earned group page persists in the gallery",
    ]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.on(
            "console",
            lambda message: console_errors.append(f"console:{message.text}")
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: console_errors.append(f"pageerror:{error}"))
        page.on(
            "requestfailed",
            lambda request: network_errors.append(f"{request.url}: {request.failure}"),
        )
        page.on(
            "response",
            lambda response: http_errors.append(f"{response.status} {response.url}")
            if response.status >= 400
            else None,
        )

        page.goto(URL, wait_until="networkidle")
        age_gate_ready = bool(
            page.locator("#age-gate").count()
            and "18+" in page.locator("#age-gate").inner_text()
            and page.locator("#scene-image,.title-art").count() == 0
        )
        age_gate_shot = shot(page, "01_age_gate")
        observations["launch"] = {
            "id": "age-gate-ready",
            "inputs": ["navigate to the seeded run"],
            "state": {"ageGateReady": age_gate_ready, "url": page.url},
            "visual": age_gate_shot.relative_to(PROJECT).as_posix(),
        }
        activate(page, "#btn-age-yes")
        checks["launch"] = age_gate_ready and bool(page.locator(".title-screen").count())

        activate(page, "#btn-start")
        opening_response = activate(page, '[data-opening="respect_yue"]', "这会儿知道回来")
        checks["input"] = bool(
            state(page)["history"][0]["choice"] == "respect_yue"
            and "这会儿知道回来" in opening_response
        )
        observations["input"] = {
            "id": "opening-choice-accepted",
            "inputs": ["focus start and press Enter", "focus respect_yue and press Enter"],
            "state": {
                "phase": phase(page),
                "choice": state(page)["history"][0]["choice"],
                "responseVisible": "这会儿知道回来" in opening_response,
            },
        }

        day_panel_fits = page.evaluate(
            "(() => { const p=document.querySelector('.day-panel'); const s=document.querySelector('.phase-stage'); "
            "if(!p||!s) return false; const a=p.getBoundingClientRect(), b=s.getBoundingClientRect(); "
            "return a.top>=b.top && a.bottom<=b.bottom; })()"
        )
        visits = (
            ("wu_yueniang", "accord_yue_order", None),
            ("pan_jinlian", "accord_pan_truth", None),
            ("li_pinger", "accord_pinger_key", "joint_yue_pan"),
            ("wu_yueniang", "yue_share_shortfall", "joint_yue_pinger"),
            ("pan_jinlian", "pan_take_cup", None),
        )
        joint_results: list[str] = []
        door_visual: Path | None = None
        door_sources: list[str] = []
        for visit_index, (heroine, route, joint_action) in enumerate(visits):
            resolve_morning(page)
            result = choose_day(
                page,
                joint_action,
                "04_joint_yue_pan" if joint_action == "joint_yue_pan" else None,
            )
            if result:
                joint_results.append(result)
            if visit_index == 0:
                door_visual = shot(page, "03_evening_doors")
                door_sources = page.locator(".door-card img").evaluate_all(
                    "nodes => nodes.map(node => node.getAttribute('src'))"
                )
            route_night(page, heroine, route)
        resolve_morning(page)
        choose_day(page)
        hub_state = state(page)
        accord_visible = all(
            page.locator(f'[data-accord="{term}"].complete').count() >= 1
            for term in ("order", "truth", "safety")
        )
        activate(page, '[data-shared-start="1"]')
        shared_option = page.locator(
            '[data-shared-night="shared_divide_roles"]:not([disabled])'
        )
        if shared_option.count() != 1:
            raise RuntimeError("三院共同分工未解锁")
        activate(page, '[data-shared-night="shared_divide_roles"]:not([disabled])', "今夜都不走")
        accord_scene = state(page)
        group_scene_ready = bool(
            phase(page) == "scene"
            and page.locator('[data-scene-id="inner_court_accord"]').is_visible()
            and accord_scene["pendingScene"] == "inner_court_accord"
        )
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.wait_for_timeout(100)
        large_viewport_fits = page.evaluate(
            "document.documentElement.scrollWidth <= innerWidth && "
            "document.documentElement.scrollHeight <= innerHeight"
        )
        activate(page, "#btn-scene-close")

        after_work_state = state(page)
        after_work_continues = phase(page) == "shared_afterglow"
        activate(page, '[data-shared-afterglow="afterglow_yue_cup"]', "她若真想躲")
        afterglow_shot = shot(page, "06_shared_afterglow")
        activate(page, '[data-shared-afterglow="afterglow_close_door"]', "门已经关了")
        intimate_scene_ready = bool(
            phase(page) == "scene"
            and page.locator('[data-scene-id="inner_court_afterglow"]').is_visible()
            and state(page)["pendingScene"] == "inner_court_afterglow"
        )
        intimate_shot = adult_shot(page, "07_inner_court_afterglow")
        activate(page, "#btn-scene-close")
        dawn_ready = phase(page) == "shared_dawn"
        activate(page, '[data-shared-dawn="dawn_same_table"]', "四盏茶仍送进同一间屋")

        checks["coreLoop"] = phase(page) == "ending"
        checks["outcome"] = (
            page.locator("#ending-view").get_attribute("data-ending") == "balanced"
        )
        ending_shot = shot(page, "08_balanced_ending")
        ending_visual = ending_shot.relative_to(PROJECT).as_posix()
        checks["render"] = bool(
            age_gate_shot.is_file()
            and (SAFE / "04_joint_yue_pan.jpg").is_file()
            and ending_shot.is_file()
            and accord_visible
            and day_panel_fits
            and door_visual is not None
            and door_visual.is_file()
            and len(door_sources) == 3
            and len(set(door_sources)) == 3
            and all("/portrait/" not in source for source in door_sources)
            and joint_results == ["joint_yue_pan", "joint_yue_pinger"]
            and group_scene_ready
            and after_work_continues
            and afterglow_shot.is_file()
            and intimate_scene_ready
            and intimate_shot.is_file()
            and dawn_ready
            and large_viewport_fits
            and page.locator("#ending-view").is_visible()
            and not console_errors
            and not network_errors
            and not http_errors
        )
        observations["render"] = {
            "id": "pair-action-and-inner-court-rendered-at-both-target-viewports",
            "inputs": [
                "complete three accords",
                "complete two pair actions",
                "choose shared_divide_roles",
            ],
            "state": {
                "phase": phase(page),
                "accordSealsVisible": accord_visible,
                "dayPanelFits1280x800": day_panel_fits,
                "heroineDoorAssets": door_sources,
                "heroineDoorVisual": door_visual.relative_to(PROJECT).as_posix() if door_visual else None,
                "jointResultScenes": joint_results,
                "groupSceneReady": group_scene_ready,
                "afterWorkPhase": after_work_state["phase"],
                "afterglowContinues": after_work_continues,
                "intimateSceneReady": intimate_scene_ready,
                "dawnReady": dawn_ready,
                "viewport1920x1080Fits": large_viewport_fits,
                "consoleErrors": console_errors,
                "networkErrors": network_errors,
                "httpErrors": http_errors,
            },
            "visual": (SAFE / "04_joint_yue_pan.jpg")
            .relative_to(PROJECT)
            .as_posix(),
        }
        observations["coreLoop"] = {
            "id": "six-day-loop-complete",
            "inputs": [
                "complete three agreement nights, two pair-action days, two personal nights, the shared work scene, two afterglow choices, the adult ensemble scene, and one dawn choice"
            ],
            "state": {
                "phase": phase(page),
                "day": state(page)["day"],
                "accords": hub_state["accords"],
                "jointActions": hub_state["jointActions"],
                "sharedNightChoice": state(page)["sharedNightChoice"],
                "sharedAfterglowChoices": state(page)["sharedAfterglowChoices"],
                "sharedDawnChoice": state(page)["sharedDawnChoice"],
            },
        }
        observations["outcome"] = {
            "id": "balanced-inner-court-ending",
            "inputs": ["resolve shared_divide_roles, finish both afterglow beats, close inner_court_afterglow, and choose dawn_same_table"],
            "state": {
                "terminal": "balanced-ending",
                "phase": phase(page),
                "haremCoalition": state(page)["flags"].get("harem_coalition", False),
                "sceneUnlocked": "inner_court_accord" in state(page)["unlocked"],
                "afterglowSceneUnlocked": "inner_court_afterglow" in state(page)["unlocked"],
            },
            "visual": ending_visual,
        }

        activate(page, "#btn-restart")
        restarted = state(page)
        gallery = page.evaluate("__game.gallery()")
        checks["restart"] = bool(
            restarted["day"] == 1
            and restarted["phase"] == "opening"
            and "inner_court_accord" in gallery
        )
        observations["restart"] = {
            "id": "clean-day-one-restart",
            "inputs": ["focus restart and press Enter"],
            "state": {
                "restart": "day-1-opening",
                "day": restarted["day"],
                "phase": restarted["phase"],
                "galleryKeepsInnerCourtAccord": "inner_court_accord" in gallery,
            },
        }
        browser_version = browser.version
        context.close()
        browser.close()

    return (
        checks,
        console_errors,
        network_errors,
        http_errors,
        observations,
        input_trace,
        browser_version,
    )


def main() -> int:
    shutil.rmtree(SAFE, ignore_errors=True)
    shutil.rmtree(ADULT, ignore_errors=True)
    SAFE.mkdir(parents=True, exist_ok=True)
    ADULT.mkdir(parents=True, exist_ok=True)
    server = ensure_server()
    try:
        (
            checks,
            console_errors,
            network_errors,
            http_errors,
            observations,
            input_trace,
            browser_version,
        ) = run_path()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=3)

    build_bytes = sum(
        path.stat().st_size
        for path in APP.rglob("*")
        if path.is_file() and ".vercel" not in path.parts and "test" not in path.parts
    )
    evidence = {
        "schemaVersion": 1,
        "runId": "jin-ping-mei-main-path",
        "environment": {
            "browser": browser_version,
            "viewports": [[1280, 800], [1920, 1080]],
            "url": URL,
            "normalSpeedRun": SLOW,
            "buildBytes": build_bytes,
        },
        "inputTrace": input_trace,
        "observations": observations,
    }
    if SLOW:
        (SHOTS / "evidence-normal.json").write_text(
            json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    for name in CHECK_NAMES:
        print(f"{name}: {'PASS' if checks[name] else 'FAIL'}")
    print(
        "browser errors: "
        f"console={len(console_errors)}, network={len(network_errors)}, http={len(http_errors)}"
    )
    print(f"screenshots: {len(list(SAFE.glob('*.jpg')))}; build: {build_bytes / 1048576:.2f} MB")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
