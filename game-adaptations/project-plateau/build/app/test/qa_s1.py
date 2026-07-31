#!/usr/bin/env python3
"""Exercise S1 movement, collision, lifecycle and a continuous browser smoke."""

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
EVIDENCE = BUILD / "evidence" / "s1"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
SMOKE_SECONDS = float(os.environ.get("SMOKE_SECONDS", "60"))
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
                    raise RuntimeError("Vite exited before the S1 browser check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the S1 browser check")


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
    checkpoints: list[dict[str, object]] = []

    with sync_playwright() as playwright:
        launch_args: dict[str, object] = {"headless": True}
        if CHROME.exists():
            launch_args["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**launch_args)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: console_errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: request_hosts.add(urlparse(request.url).netloc))
        response = page.goto(f"{BASE_URL}/?qa=s1", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert response and response.ok
        assert page.evaluate("window.__projectPlateau.stage") in {
            "s1-controller", "s2-topology", "s3-exposed-proof", "s4-complete-loop",
            "s5-route-outcomes", "s6-field-feedback"
        }

        def snapshot() -> dict[str, object]:
            return page.evaluate("window.__projectPlateau.snapshot()")

        def shot(name: str) -> str:
            path = EVIDENCE / name
            page.screenshot(path=path, type="jpeg", quality=86)
            return f"build/evidence/s1/{name}"

        def hold(*codes: str, milliseconds: int) -> None:
            for code in codes:
                page.keyboard.down(code)
            page.wait_for_timeout(milliseconds)
            for code in reversed(codes):
                page.keyboard.up(code)
            page.wait_for_timeout(80)

        page.get_by_role("button", name="Enter the basin").click()
        assert page.get_by_text("FIELD ORDER // FORWARD SCOUT").is_visible()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(200)
        clean = snapshot()
        assert clean["runActive"] and not clean["player"]["paused"], clean
        assert clean["player"]["position"] == {"x": 3, "z": 70}, clean
        checkpoints.append({"id": "clean-start", "state": clean, "visual": shot("01-clean-start.jpg")})

        hold("KeyW", milliseconds=850)
        walked = snapshot()
        assert walked["player"]["position"]["z"] < 67.2, walked
        assert walked["player"]["distanceTravelled"] > 2.8, walked
        checkpoints.append({"id": "walk", "state": walked, "visual": shot("02-walk.jpg")})

        before_sprint = walked["player"]["distanceTravelled"]
        page.keyboard.down("ShiftLeft")
        page.keyboard.down("KeyW")
        page.wait_for_timeout(420)
        sprinting = snapshot()
        assert sprinting["player"]["stance"] == "sprint", sprinting
        page.keyboard.up("KeyW")
        page.keyboard.up("ShiftLeft")
        page.wait_for_timeout(80)
        assert sprinting["player"]["distanceTravelled"] - before_sprint > 2.2, sprinting

        page.keyboard.down("KeyC")
        page.keyboard.down("KeyW")
        page.wait_for_timeout(260)
        crouching = snapshot()
        assert crouching["player"]["stance"] == "crouch", crouching
        page.keyboard.up("KeyW")
        page.keyboard.up("KeyC")
        page.wait_for_timeout(80)

        page.evaluate("window.__projectPlateau.teleportForTest({x: -7, z: 80})")
        hold("KeyW", "KeyD", milliseconds=520)
        collision = snapshot()
        distance_from_tent = ((collision["player"]["position"]["x"] + 3) ** 2 + (collision["player"]["position"]["z"] - 80) ** 2) ** 0.5
        assert collision["player"]["collisions"] > 0, collision
        assert distance_from_tent >= 3.99, collision
        checkpoints.append({"id": "collision-slide", "state": collision, "visual": shot("03-collision-slide.jpg")})

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -89.2})")
        hold("KeyW", milliseconds=360)
        boundary = snapshot()
        assert boundary["player"]["boundaryRecoveries"] > 0, boundary
        assert boundary["player"]["position"]["x"] == 0, boundary
        assert -89.401 <= boundary["player"]["position"]["z"] <= -89.15, boundary
        assert boundary["player"]["position"] == boundary["player"]["lastStablePosition"], boundary
        assert page.get_by_text("The red cliff gives no path here.").is_visible()
        checkpoints.append({"id": "boundary-recovery", "state": boundary, "visual": shot("04-boundary-recovery.jpg")})

        page.evaluate("window.__projectPlateau.teleportForTest({x: 3, z: 70})")
        page.wait_for_timeout(1550)
        page.keyboard.press("KeyP")
        paused = snapshot()
        assert paused["player"]["paused"] and paused["player"]["pauseReason"] == "manual", paused
        held_time = paused["player"]["elapsedSeconds"]
        held_position = paused["player"]["position"]
        hold("KeyW", milliseconds=450)
        still_paused = snapshot()
        assert abs(still_paused["player"]["elapsedSeconds"] - held_time) < 0.02, still_paused
        assert still_paused["player"]["position"] == held_position, still_paused
        checkpoints.append({"id": "manual-pause", "state": still_paused, "visual": shot("05-manual-pause.jpg")})

        page.get_by_role("button", name="Resume field work").click()
        page.wait_for_timeout(180)
        assert not snapshot()["player"]["paused"]
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        focus_pause = snapshot()
        assert focus_pause["player"]["paused"], focus_pause
        assert focus_pause["player"]["pauseReason"] == "window-inactive", focus_pause
        assert page.get_by_text("PAUSED — WINDOW INACTIVE").is_visible()
        page.get_by_role("button", name="Resume field work").click()
        page.wait_for_timeout(180)

        hold("KeyS", milliseconds=260)
        page.keyboard.press("KeyP")
        page.get_by_role("button", name="Restart run").click()
        page.wait_for_timeout(100)
        restarted = snapshot()
        assert restarted["player"]["position"] == {"x": 3, "z": 70}, restarted
        assert restarted["player"]["elapsedSeconds"] < 0.2, restarted
        assert restarted["player"]["distanceTravelled"] == 0, restarted
        assert restarted["player"]["collisions"] == 0, restarted
        assert restarted["player"]["boundaryRecoveries"] == 0, restarted
        checkpoints.append({"id": "clean-restart", "state": restarted, "visual": shot("06-clean-restart.jpg")})

        smoke_start_state = snapshot()
        smoke_started = time.monotonic()
        pattern = ["KeyW", "KeyD", "KeyS", "KeyA"]
        index = 0
        while time.monotonic() - smoke_started < SMOKE_SECONDS:
            code = pattern[index % len(pattern)]
            page.keyboard.down(code)
            page.wait_for_timeout(min(2000, max(50, int((SMOKE_SECONDS - (time.monotonic() - smoke_started)) * 1000))))
            page.keyboard.up(code)
            index += 1
            current = snapshot()
            assert not current["player"]["paused"], current
        smoke_duration = round(time.monotonic() - smoke_started, 2)
        smoke_end_state = snapshot()
        elapsed_gain = smoke_end_state["player"]["elapsedSeconds"] - smoke_start_state["player"]["elapsedSeconds"]
        assert elapsed_gain >= SMOKE_SECONDS * 0.9, (elapsed_gain, SMOKE_SECONDS)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45, performance
        assert performance["onePercentLowFps"] >= 30, performance
        memory = page.evaluate("performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null")
        checkpoints.append({"id": "continuous-smoke", "state": smoke_end_state, "visual": shot("07-smoke-end.jpg")})
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external_hosts = sorted(request_hosts - allowed)
    assert not console_errors, console_errors
    assert not external_hosts, external_hosts
    return {
        "stage": "s1-controller",
        "source": {
            "scope": "index.html, package manifests, public assets and src",
            "sha256": source_fingerprint(),
        },
        "environment": {
            "node": command_version("node", "--version"),
            "npm": command_version("npm", "--version"),
            "vite": "8.2.0",
            "three": "0.185.1",
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "baseUrl": BASE_URL,
            "viewport": [1440, 900],
        },
        "checks": {
            "walk": True,
            "sprint": True,
            "crouch": True,
            "collisionSlide": True,
            "boundaryRecovery": True,
            "manualPauseFreeze": True,
            "focusLossFreeze": True,
            "cleanRestart": True,
            "consoleErrors": console_errors,
            "requestHosts": sorted(request_hosts),
            "externalHosts": external_hosts,
        },
        "continuousSmoke": {
            "requestedSeconds": SMOKE_SECONDS,
            "wallSeconds": smoke_duration,
            "simulatedElapsedGain": round(elapsed_gain, 3),
            "inputSegments": index,
            "memory": memory,
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S1 proves controller, foundation collision and lifecycle behavior, not final route topology.",
            "Observe, camera, threat, defense, evidence and extraction verbs remain later gates.",
            "The browser smoke is one headless development-machine run, not independent QA."
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
    print(json.dumps({
        "stage": report["stage"],
        "checks": report["checks"],
        "continuousSmoke": report["continuousSmoke"],
        "performance": report["performance"],
        "source": report["source"],
    }, indent=2))
    print(f"S1 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
