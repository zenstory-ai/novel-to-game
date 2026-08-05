#!/usr/bin/env python3
"""Exercise visible Project Plateau colliders in the real browser runtime."""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = Path(
    os.environ.get("PROJECT_PLATEAU_COLLISION_EVIDENCE", BUILD / "evidence" / "collision")
).resolve()
STATE = EVIDENCE / "state"
BROWSER = EVIDENCE / "browser"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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
                    raise RuntimeError("Vite exited before collision QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for collision QA")


def run() -> dict[str, object]:
    for directory in (EVIDENCE, STATE, BROWSER):
        directory.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    request_hosts: set[str] = set()
    checkpoints: list[dict[str, object]] = []
    server = start_server()
    try:
        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.exists():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: console_errors.append(f"PAGEERROR: {error}"))
            page.on("request", lambda request: request_hosts.add(urlparse(request.url).netloc))
            page.goto(f"{BASE_URL}/?qa=collision", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.evaluate("window.__projectPlateau.loadHy3dVisualsForTest()")
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.fieldCamera.visualStatus === 'hy3d-field-camera-ready'",
                timeout=15000,
            )
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.rifle.visualStatus === 'hy3d-rifle-ready'",
                timeout=15000,
            )
            page.evaluate("window.__projectPlateau.restart()")
            page.wait_for_timeout(180)

            def capture_contact(
                identifier: str,
                position: dict[str, float],
                key: str,
                expected_collision: str,
                hold_ms: int = 1000,
            ) -> None:
                page.evaluate("position => window.__projectPlateau.teleportForTest(position)", position)
                page.wait_for_timeout(80)
                page.keyboard.down(key)
                page.wait_for_timeout(hold_ms)
                state = page.evaluate("window.__projectPlateau.snapshot()")
                page.keyboard.up(key)
                assert state["player"]["lastEvent"] == f"collision:{expected_collision}", state
                assert state["player"]["collisions"] > 0, state
                assert state["collision"]["model"] == "vertical-capsule-on-heightfield-with-ballistic-jump"
                assert state["collision"]["colliderCount"] >= 50

                state_path = STATE / f"{identifier}.json"
                browser_path = BROWSER / f"{identifier}.json"
                visual_path = EVIDENCE / f"{identifier}.jpg"
                state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
                browser_record = {
                    "inputs": [f"teleport {position}", f"hold {key} {hold_ms}ms"],
                    "expectedCollision": expected_collision,
                    "viewport": [1440, 900],
                    "url": page.url,
                    "consoleErrorsAtCheckpoint": list(console_errors),
                    "requestHostsAtCheckpoint": sorted(request_hosts),
                    "capturedAtUnixMs": int(time.time() * 1000),
                }
                browser_path.write_text(
                    json.dumps(browser_record, indent=2) + "\n", encoding="utf-8"
                )
                page.screenshot(path=visual_path, type="jpeg", quality=90)
                checkpoints.append(
                    {
                        "id": identifier,
                        "expectedCollision": expected_collision,
                        "visual": visual_path.relative_to(BUILD).as_posix(),
                        "visualSha256": sha256_file(visual_path),
                        "state": state_path.relative_to(BUILD).as_posix(),
                        "stateSha256": sha256_file(state_path),
                        "browser": browser_path.relative_to(BUILD).as_posix(),
                        "browserSha256": sha256_file(browser_path),
                        "finalPosition": state["player"]["position"],
                        "groundY": state["player"]["groundY"],
                    }
                )

            capture_contact(
                "01-visible-brook-boulder",
                {"x": -7.5, "z": 39, "heading": 0, "pitch": -0.08},
                "KeyW",
                "brook-boulder",
                1200,
            )
            capture_contact(
                "02-rotated-fort-tent",
                {"x": -6, "z": 77, "heading": -3 * math.pi / 4, "pitch": -0.04},
                "KeyW",
                "fort-tent-west",
                1000,
            )
            capture_contact(
                "03-cover-arch-trunk",
                {"x": -5.6, "z": 28, "heading": -math.pi / 2, "pitch": -0.05},
                "KeyW",
                "cover-arch-1-right-trunk",
                900,
            )
            capture_contact(
                "04-living-subject-space",
                {"x": -8, "z": -27, "heading": 0, "pitch": -0.03},
                "KeyW",
                "iguanodon-adult-graze",
                1000,
            )
            assert not console_errors, console_errors
            external_hosts = sorted(
                host for host in request_hosts
                if host and host not in {"127.0.0.1:4173", "localhost:4173"}
            )
            assert not external_hosts, external_hosts
            browser.close()
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)

    report = {
        "suite": "browser:collision-contract",
        "status": "pass",
        "checkpoints": checkpoints,
        "consoleErrors": console_errors,
        "requestHosts": sorted(request_hosts),
        "limitations": [
            "Movement uses a vertical capsule on the shared terrain heightfield with fixed-step ballistic jumping and height-aware solid overlap.",
            "Low decorative objects remain intentionally traversable and are listed in the runtime collision policy.",
        ],
    }
    report_path = EVIDENCE / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
