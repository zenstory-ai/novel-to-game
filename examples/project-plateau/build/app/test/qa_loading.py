#!/usr/bin/env python3
"""Verify cold-start and focal-asset loading states are visible and truthful."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import Route, sync_playwright

from verify import app_fingerprint


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "loading"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def start_server() -> subprocess.Popen[str] | None:
    parsed = urlparse(BASE_URL)
    with socket.socket() as probe:
        try:
            probe.connect((parsed.hostname or "127.0.0.1", parsed.port or 4173))
            return None
        except OSError:
            pass
    process = subprocess.Popen(
        ["npm", "run", "start", "--", "--host", "127.0.0.1", "--port", "4173"],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    for _ in range(80):
        with socket.socket() as probe:
            try:
                probe.connect(("127.0.0.1", 4173))
                return process
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Vite exited before the loading check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the loading check")


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    server = start_server()
    errors: list[str] = []
    delayed = False
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            if CHROME.exists():
                launch["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**launch)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

            def delay_camera(route: Route) -> None:
                nonlocal delayed
                if "field-camera" in route.request.url and not delayed:
                    delayed = True
                    time.sleep(1.5)
                route.continue_()

            page.route("**/*.glb", delay_camera)
            page.goto(BASE_URL, wait_until="domcontentloaded")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.wait_for_function("document.querySelector('#loading-screen')?.hidden === true")
            assert page.locator("#title-screen").is_visible()

            page.get_by_role("button", name="Enter the basin").click()
            page.locator("#loading-screen").wait_for(state="visible")
            loading = page.evaluate("window.__projectPlateau.loadingSnapshot().ui")
            assert loading == {
                "visible": True,
                "phase": "assets",
                "status": "Preparing field camera, rifle and wildlife…",
            }, loading
            assert page.locator("#field-order").is_hidden()
            page.screenshot(path=EVIDENCE / "01-required-assets-loading.jpg", type="jpeg", quality=86)

            page.locator("#field-order").wait_for(state="visible", timeout=30000)
            assert page.locator("#loading-screen").is_hidden()
            ready = page.evaluate("window.__projectPlateau.loadingSnapshot().ui")
            assert ready["visible"] is False, ready
            page.screenshot(path=EVIDENCE / "02-field-order-ready.jpg", type="jpeg", quality=86)
            context.close()
            browser.close()

        assert delayed is True
        assert errors == [], errors
        report = {
            "suite": "browser:loading-state",
            "status": "PASS",
            "sourceFingerprint": app_fingerprint(),
            "checks": {
                "bootLoaderClearsAfterFirstFrame": True,
                "requiredAssetLoaderVisible": True,
                "loadingStatusNamesRequiredAssets": True,
                "fieldOrderRemainsHiddenUntilReady": True,
                "loaderClearsAfterSuccess": True,
                "consoleErrors": errors,
            },
            "evidence": [
                "01-required-assets-loading.jpg",
                "02-field-order-ready.jpg",
            ],
        }
        (EVIDENCE / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
