#!/usr/bin/env python3
"""Verify the desktop 3D / mobile-social preview entry contract."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from verify import app_fingerprint


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "entry"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
PREVIEW_PATH = "/media/project-plateau-preview-15s.mp4"
POSTER_PATH = "/media/project-plateau-preview-poster.jpg"

DISABLE_WEBGL2 = """
(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
    if (type === 'webgl2') return null;
    return original.call(this, type, ...args);
  };
})();
"""


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
                    raise RuntimeError("Vite exited before the entry check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the entry check")


def local_path(url: str) -> str:
    parsed = urlparse(url)
    return parsed.path


def assert_preview(page, expected_reason: str, screenshot: Path) -> dict[str, object]:
    page.wait_for_function("window.__projectPlateauEntry?.mode === 'preview'")
    entry = page.evaluate("window.__projectPlateauEntry")
    assert entry["reason"] == expected_reason, entry
    assert page.locator("#preview-gateway").is_visible()
    assert page.locator("#title-screen").is_hidden()
    assert page.locator("#game-canvas").is_hidden()
    assert page.locator("#preview-video source").get_attribute("src") == PREVIEW_PATH
    assert page.locator("#preview-video").get_attribute("poster") == POSTER_PATH
    assert page.get_by_role("link", name="Play a mobile-ready 2D game").is_visible()
    assert page.get_by_role("link", name="Try the second 2D demo").is_visible()
    assert page.get_by_role("link", name="Explore the 3D case study").is_visible()
    page.wait_for_function("document.querySelector('#preview-video').readyState >= 2")
    media = page.locator("#preview-video").evaluate(
        "video => ({paused: video.paused, muted: video.muted, readyState: video.readyState, duration: video.duration})"
    )
    assert media["muted"] is True, media
    assert 14.8 <= media["duration"] <= 15.2, media
    page.screenshot(path=screenshot, type="jpeg", quality=86, full_page=True)
    return {"entry": entry, "media": media, "screenshot": screenshot.name}


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    assert (APP / f"public{PREVIEW_PATH}").is_file(), PREVIEW_PATH
    assert (APP / f"public{POSTER_PATH}").is_file(), POSTER_PATH
    server = start_server()
    errors: list[str] = []
    all_requests: list[str] = []
    records: dict[str, object] = {}
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            if CHROME.exists():
                launch["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**launch)

            desktop_context = browser.new_context(viewport={"width": 1440, "height": 900})
            desktop = desktop_context.new_page()
            desktop.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            desktop.on("request", lambda request: all_requests.append(request.url))
            desktop.goto(BASE_URL, wait_until="networkidle")
            desktop.wait_for_function("window.__projectPlateau?.ready === true")
            desktop_entry = desktop.evaluate("window.__projectPlateauEntry")
            assert desktop_entry == {
                "ready": True,
                "mode": "interactive",
                "reason": "desktop-webgl2",
            }, desktop_entry
            assert desktop.locator("#preview-gateway").is_hidden()
            desktop_paths = [local_path(url) for url in all_requests]
            assert PREVIEW_PATH not in desktop_paths, desktop_paths
            records["desktop"] = {"entry": desktop_entry, "previewRequested": False}
            desktop_context.close()

            mobile_requests: list[str] = []
            mobile_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                screen={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                device_scale_factor=2,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) "
                    "AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1"
                ),
            )
            mobile = mobile_context.new_page()
            mobile.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            mobile.on("request", lambda request: (mobile_requests.append(request.url), all_requests.append(request.url)))
            mobile.goto(BASE_URL, wait_until="networkidle")
            records["mobile"] = assert_preview(
                mobile,
                "mobile-controls-unavailable",
                EVIDENCE / "01-mobile-preview.jpg",
            )
            mobile_paths = [local_path(url) for url in mobile_requests]
            assert PREVIEW_PATH in mobile_paths, mobile_paths
            assert "/src/main.js" not in mobile_paths, mobile_paths
            assert not any("three" in path for path in mobile_paths), mobile_paths
            records["mobile"]["interactiveRuntimeRequested"] = False
            mobile_context.close()

            in_app_context = browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 AppleWebKit/537.36 MicroMessenger/8.0.55",
            )
            in_app = in_app_context.new_page()
            in_app.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            in_app.on("request", lambda request: all_requests.append(request.url))
            in_app.goto(BASE_URL, wait_until="networkidle")
            records["inAppBrowser"] = assert_preview(
                in_app,
                "in-app-browser",
                EVIDENCE / "02-in-app-browser-preview.jpg",
            )
            in_app_context.close()

            no_webgl_context = browser.new_context(viewport={"width": 1440, "height": 900})
            no_webgl_context.add_init_script(DISABLE_WEBGL2)
            no_webgl = no_webgl_context.new_page()
            no_webgl.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            no_webgl.on("request", lambda request: all_requests.append(request.url))
            no_webgl.goto(BASE_URL, wait_until="networkidle")
            records["withoutWebGL2"] = assert_preview(
                no_webgl,
                "webgl2-unavailable",
                EVIDENCE / "03-without-webgl2-preview.jpg",
            )
            assert no_webgl.evaluate("typeof window.__projectPlateau === 'undefined'") is True
            no_webgl_context.close()
            browser.close()

        external_hosts = sorted(
            {
                urlparse(url).netloc
                for url in all_requests
                if urlparse(url).netloc not in {"", "127.0.0.1:4173"}
            }
        )
        assert errors == [], errors
        assert external_hosts == [], external_hosts
        report = {
            "suite": "browser:entry-conversion",
            "status": "PASS",
            "sourceFingerprint": app_fingerprint(),
            "checks": {
                "desktopWebGL2LoadsInteractiveBuild": True,
                "desktopDoesNotRequestPreviewMedia": True,
                "mobileLoadsLocal15SecondPreview": True,
                "mobileDoesNotLoadThreeRuntime": True,
                "inAppBrowserLoadsPreview": True,
                "missingWebGL2LoadsPreview": True,
                "twoMobileDemoLinksVisible": True,
                "caseStudyLinkVisible": True,
                "consoleErrors": errors,
                "externalHosts": external_hosts,
            },
            "records": records,
        }
        (EVIDENCE / "report.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
        return report
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
