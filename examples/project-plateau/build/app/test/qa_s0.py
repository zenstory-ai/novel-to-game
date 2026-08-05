#!/usr/bin/env python3
"""Capture the Project Plateau S0 renderer and performance baseline."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "s0"
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
                    raise RuntimeError("Vite exited before the S0 browser check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the S0 browser check")


def compressed_dist_bytes() -> tuple[int, int]:
    raw = 0
    compressed = 0
    for path in (APP / "dist").rglob("*"):
        if path.is_file():
            data = path.read_bytes()
            raw += len(data)
            compressed += len(gzip.compress(data, compresslevel=9))
    return raw, compressed


def source_fingerprint() -> str:
    digest = hashlib.sha256()
    inputs = [APP / "index.html", APP / "package.json", APP / "package-lock.json"]
    inputs.extend(sorted((APP / "public").rglob("*")))
    inputs.extend(sorted((APP / "src").rglob("*")))
    for path in inputs:
        if path.is_file():
            digest.update(path.relative_to(APP).as_posix().encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
    return digest.hexdigest()


def command_version(*command: str) -> str:
    return subprocess.check_output(command, cwd=APP, text=True).strip()


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    request_hosts: set[str] = set()

    with sync_playwright() as playwright:
        launch_args: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch_args["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch_args)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: console_errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: request_hosts.add(urlparse(request.url).netloc))

        navigation_started = time.perf_counter()
        response = page.goto(f"{BASE_URL}/?view=title&qa=s0-title", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        tti_ms = round((time.perf_counter() - navigation_started) * 1000, 1)
        assert response and response.ok, "S0 document request failed"
        assert page.locator("#unsupported").is_hidden(), "WebGL2 fallback was shown"
        title_snapshot = page.evaluate("window.__projectPlateau.snapshot()")
        assert title_snapshot["renderer"] == "WebGL2", title_snapshot
        assert title_snapshot["viewport"] == [1440, 900], title_snapshot
        page.screenshot(path=EVIDENCE / "01-title.jpg", type="jpeg", quality=88)

        page.get_by_role("button", name="Enter the basin").click()
        page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
        assert page.get_by_text("FIELD ORDER // FORWARD SCOUT").is_visible()
        page.screenshot(path=EVIDENCE / "02-field-order.jpg", type="jpeg", quality=88)
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(900)
        page.evaluate("window.__projectPlateau.setView('glade')")
        field_snapshot = page.evaluate("window.__projectPlateau.snapshot()")
        assert field_snapshot["mode"] == "field", field_snapshot
        page.screenshot(path=EVIDENCE / "03-glade-heavy.jpg", type="jpeg", quality=88)

        page.wait_for_timeout(500)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45, performance
        assert performance["onePercentLowFps"] >= 30, performance

        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(250)
        minimum_snapshot = page.evaluate("window.__projectPlateau.snapshot()")
        assert minimum_snapshot["viewport"] == [1280, 720], minimum_snapshot
        page.screenshot(path=EVIDENCE / "04-minimum-viewport.jpg", type="jpeg", quality=88)
        browser.close()

    raw_bytes, compressed_bytes = compressed_dist_bytes()
    allowed = {urlparse(BASE_URL).netloc}
    external_hosts = sorted(host for host in request_hosts if host and host not in allowed)
    assert not console_errors, console_errors
    assert not external_hosts, external_hosts
    assert compressed_bytes <= 20 * 1024 * 1024, compressed_bytes
    assert tti_ms <= 8000, tti_ms

    return {
        "stage": "s0-renderer",
        "source": {
            "scope": "index.html, package manifests, public assets and src",
            "sha256": source_fingerprint(),
        },
        "environment": {
            "node": command_version("node", "--version"),
            "npm": command_version("npm", "--version"),
            "vite": "8.2.0",
            "three": "0.185.1",
            "python": sys.version.split()[0],
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "baseUrl": BASE_URL,
        },
        "checks": {
            "webgl2": True,
            "titleMenu": True,
            "fieldOrder": True,
            "representativeHeavyFrame": True,
            "minimumViewport": True,
            "consoleErrors": console_errors,
            "requestHosts": sorted(request_hosts),
            "externalHosts": external_hosts,
        },
        "performance": performance,
        "loading": {
            "observedTtiMs": tti_ms,
            "budgetTtiMs": 8000,
            "distRawBytes": raw_bytes,
            "distGzipBytes": compressed_bytes,
            "initialCompressedBudgetBytes": 20 * 1024 * 1024,
        },
        "render": field_snapshot,
        "minimumRender": minimum_snapshot,
        "screenshots": [
            "build/evidence/s0/01-title.jpg",
            "build/evidence/s0/02-field-order.jpg",
            "build/evidence/s0/03-glade-heavy.jpg",
            "build/evidence/s0/04-minimum-viewport.jpg",
        ],
        "limitations": [
            "S0 proves the renderer, representative scene density, loading and viewport baseline only.",
            "Player locomotion, collision, gameplay state, audio and complete-run evidence remain later gates.",
            "Performance was sampled headlessly on one development machine and is not a target-device matrix.",
        ],
    }


def main() -> None:
    server = start_server()
    try:
        result = run()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
    output = EVIDENCE / "report.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"S0 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
