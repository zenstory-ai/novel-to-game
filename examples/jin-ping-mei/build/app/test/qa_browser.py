#!/usr/bin/env python3
"""用 Playwright 跑《风月总账》一条专一路线并保留三张代表帧。"""

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


def click(page: Page, selector: str) -> None:
    node = page.locator(selector)
    if node.count() == 0:
        raise RuntimeError(f"找不到 {selector}（phase={phase(page)}）")
    node.first.click()
    page.wait_for_timeout(80)


def shot(page: Page, name: str) -> Path:
    output = SAFE / f"{name}.jpg"
    page.screenshot(path=output, type="jpeg", quality=80)
    return output


def resolve_morning(page: Page) -> None:
    if phase(page) != "morning":
        return
    option = page.locator('[data-morning="explain"]:not([disabled])')
    if option.count() == 0:
        option = page.locator("[data-morning]:not([disabled])").first
    option.click()
    page.wait_for_timeout(80)


def choose_day(page: Page) -> None:
    click(page, '[data-day-action="ledger"]')
    if phase(page) == "household":
        page.locator("button[data-household]:not([disabled])").first.click()
        page.wait_for_timeout(80)
    if phase(page) == "banquet":
        option = page.locator('[data-banquet="banquet_honor_yue"]:not([disabled])')
        option.click()
        page.wait_for_timeout(100)
        click(page, "#btn-scene-close")


def route_night(page: Page, route: str, night: str) -> None:
    click(page, '[data-visit="wu_yueniang"]')
    click(page, f'[data-route-choice="{route}"]')
    target = page.locator(f'[data-night="{night}"]:not([disabled])')
    if target.count() != 1:
        raise RuntimeError(f"夜间选项未解锁：{night}")
    target.click()
    page.wait_for_timeout(100)
    if phase(page) == "scene":
        click(page, "#btn-scene-close")


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
        "confirm the 18+ age gate",
        "start a new ledger and choose the respectful opening",
        "complete six household and relationship days",
        "reach the exclusive ending",
        "restart to the day-one opening",
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
        click(page, "#btn-age-yes")
        checks["launch"] = age_gate_ready and bool(page.locator(".title-screen").count())

        click(page, "#btn-start")
        click(page, '[data-opening="respect_yue"]')
        checks["input"] = state(page)["history"][0]["choice"] == "respect_yue"
        observations["input"] = {
            "id": "opening-choice-accepted",
            "inputs": ["click start", "choose respect_yue"],
            "state": {
                "phase": phase(page),
                "choice": state(page)["history"][0]["choice"],
            },
        }

        routes = (
            "yue_share_shortfall",
            "yue_show_accounts",
            "yue_keep_word",
            "yue_ask_backing",
            "yue_offer_seat",
            "yue_share_keys",
        )
        for day, route in enumerate(routes, start=1):
            resolve_morning(page)
            choose_day(page)
            route_night(page, route, "prelude" if day < 3 else "explicit")

        checks["coreLoop"] = phase(page) == "ending"
        checks["outcome"] = (
            page.locator("#ending-view").get_attribute("data-ending") == "exclusive"
        )
        ending_shot = shot(page, "07_exclusive_ending")
        ending_visual = ending_shot.relative_to(PROJECT).as_posix()
        checks["render"] = bool(
            age_gate_shot.is_file()
            and ending_shot.is_file()
            and page.locator("#ending-view").is_visible()
            and not console_errors
            and not network_errors
            and not http_errors
        )
        observations["render"] = {
            "id": "exclusive-ending-rendered",
            "inputs": ["complete the sixth day"],
            "state": {
                "phase": phase(page),
                "consoleErrors": console_errors,
                "networkErrors": network_errors,
                "httpErrors": http_errors,
            },
            "visual": ending_visual,
        }
        observations["coreLoop"] = {
            "id": "six-day-loop-complete",
            "inputs": ["complete six day and night decisions"],
            "state": {"phase": phase(page), "day": state(page)["day"]},
        }
        observations["outcome"] = {
            "id": "exclusive-ending",
            "inputs": ["resolve the sixth night"],
            "state": {"terminal": "exclusive-ending", "phase": phase(page)},
            "visual": ending_visual,
        }

        click(page, "#btn-restart")
        restart_shot = shot(page, "08_restart")
        restarted = state(page)
        checks["restart"] = bool(
            restarted["day"] == 1
            and restarted["phase"] == "opening"
            and restart_shot.is_file()
        )
        observations["restart"] = {
            "id": "clean-day-one-restart",
            "inputs": ["click restart"],
            "state": {
                "restart": "day-1-opening",
                "day": restarted["day"],
                "phase": restarted["phase"],
            },
            "visual": restart_shot.relative_to(PROJECT).as_posix(),
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
    SAFE.mkdir(parents=True, exist_ok=True)
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
            "viewport": [1280, 800],
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
