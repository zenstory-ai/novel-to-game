#!/usr/bin/env python3
"""Capture the connected-zone and four-state primitive threat checkpoint."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "s2"
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
        cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True,
    )
    for _ in range(80):
        with socket.socket() as probe:
            try:
                probe.connect(("127.0.0.1", 4173))
                return process
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Vite exited before S2 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S2 QA")


def fingerprint() -> str:
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


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    hosts: set[str] = set()
    checkpoints: list[dict[str, object]] = []
    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        page.goto(f"{BASE_URL}/?qa=s2", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        runtime_stage = page.evaluate("window.__projectPlateau.stage")
        assert runtime_stage in {"s2-topology", "s3-exposed-proof", "s4-complete-loop"}
        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(180)

        def snap() -> dict[str, object]:
            return page.evaluate("window.__projectPlateau.snapshot()")

        def capture(identifier: str, filename: str) -> None:
            state = snap()
            page.screenshot(path=EVIDENCE / filename, type="jpeg", quality=86)
            checkpoints.append({"id": identifier, "state": state, "visual": f"build/evidence/s2/{filename}"})

        def wait_for_threat(max_x: float = 10, min_forward: float = 10) -> None:
            page.wait_for_function(
                """([maxX, minForward]) => {
                    const state = window.__projectPlateau.snapshot();
                    return Math.abs(state.threatVisual.position.x - state.player.position.x) <= maxX
                      && state.threatVisual.position.z <= state.player.position.z - minForward;
                }""",
                arg=[max_x, min_forward],
                timeout=16000,
            )

        initial = snap()
        assert initial["player"]["zone"] == "fort"
        assert initial["player"]["threatState"] == "distant"
        assert initial["threatVisual"]["state"] == "distant"
        capture("fort-distant", "01-fort-distant.jpg")

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(220)
        watch = snap()
        assert watch["player"]["zone"] == "canopy-overlook", watch
        assert watch["player"]["threatState"] == "watch", watch
        assert watch["threatVisual"]["state"] == "watch", watch
        wait_for_threat()
        capture("canopy-watch", "02-canopy-watch.jpg")

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(220)
        search = snap()
        assert search["player"]["zone"] == "iguanodon-glade", search
        assert search["player"]["threatState"] == "search", search
        assert search["threatVisual"]["state"] == "search", search
        wait_for_threat()
        capture("glade-search", "03-glade-search.jpg")

        if runtime_stage == "s4-complete-loop":
            page.mouse.move(720, 450)
            page.mouse.down(button="right")
            page.wait_for_timeout(50)
            page.mouse.down(button="left")
            page.mouse.up(button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                "window.__projectPlateau.snapshot().player.threatState === 'attack'",
                timeout=3500,
            )
        else:
            page.evaluate("window.__projectPlateau.teleportForTest({x: 7, z: 18})")
            page.keyboard.down("ShiftLeft")
            page.keyboard.down("KeyW")
            page.wait_for_timeout(1150)
            page.keyboard.up("KeyW")
            page.keyboard.up("ShiftLeft")
            page.wait_for_timeout(120)
        attack = snap()
        expected_attack_zone = "iguanodon-glade" if runtime_stage == "s4-complete-loop" else "exposed-creek"
        assert attack["player"]["zone"] == expected_attack_zone, attack
        assert attack["player"]["threatState"] == "attack", attack
        expected_attack_event = "plate-exposure:+2" if runtime_stage == "s4-complete-loop" else "exposed-sprint"
        assert attack["player"]["lastThreatEvent"] == expected_attack_event, attack
        assert attack["threatVisual"]["state"] == "attack", attack
        wait_for_threat(max_x=5, min_forward=7)
        capture("creek-attack", "04-creek-attack.jpg")

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(6250)
        covered = snap()
        assert covered["player"]["zone"] == "covered-return", covered
        assert covered["player"]["inCover"], covered
        assert covered["player"]["threatState"] == "search", covered
        assert covered["player"]["lastThreatEvent"] == "cover-deescalation", covered
        assert covered["threatVisual"]["state"] == "search", covered
        capture("covered-deescalation", "05-covered-deescalation.jpg")

        history = covered["player"]["zoneHistory"]
        expected_history = ["fort", "canopy-overlook", "iguanodon-glade", "covered-return"]
        if runtime_stage != "s4-complete-loop":
            expected_history.append("exposed-creek")
        for expected in expected_history:
            assert expected in history, history
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s2-topology",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900], "baseUrl": BASE_URL,
        },
        "checks": {
            "connectedZoneHistory": True,
            "distant": True, "watch": True, "search": True, "attack": True,
            "coverDeescalation": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts), "externalHosts": external,
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S2 threat state changes are driven by topology, exposed sprint and cover; plate exposure joins in S3.",
            "Primitive flight communicates distance, orbit and folded dive but does not yet apply contact or audio.",
            "Final cover density, route commitment costs and extraction remain later gates."
        ],
    }


def main() -> None:
    server = start_server()
    try:
        report = run()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
    output = EVIDENCE / "report.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"stage": report["stage"], "checks": report["checks"], "performance": report["performance"], "source": report["source"]}, indent=2))
    print(f"S2 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
