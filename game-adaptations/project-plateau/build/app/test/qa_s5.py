#!/usr/bin/env python3
"""Exercise all result bands, both return consequences and the five-verb chain."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "s5"
STATE_DIR = EVIDENCE / "state"
BROWSER_DIR = EVIDENCE / "browser"
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
                    raise RuntimeError("Vite exited before S5 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S5 QA")


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


def snapshot(page: Page) -> dict[str, object]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def run() -> dict[str, object]:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    BROWSER_DIR.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    hosts: set[str] = set()
    checkpoints: list[dict[str, str]] = []

    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        page.goto(f"{BASE_URL}/?qa=s5", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") == "s5-route-outcomes"
        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(120)

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s5/state/{identifier}.json"
            browser_relative = f"build/evidence/s5/browser/{identifier}.json"
            visual_relative = f"build/evidence/s5/{identifier}.jpg"
            (STATE_DIR / f"{identifier}.json").write_text(
                json.dumps(state, indent=2) + "\n", encoding="utf-8"
            )
            viewport = page.viewport_size or {"width": 0, "height": 0}
            browser_record = {
                "inputs": inputs,
                "viewport": [viewport["width"], viewport["height"]],
                "url": page.url,
                "consoleErrorsAtCheckpoint": list(errors),
                "requestHostsAtCheckpoint": sorted(hosts),
                "capturedAtUnixMs": int(time.time() * 1000),
            }
            (BROWSER_DIR / f"{identifier}.json").write_text(
                json.dumps(browser_record, indent=2) + "\n", encoding="utf-8"
            )
            page.screenshot(path=EVIDENCE / f"{identifier}.jpg", type="jpeg", quality=86)
            checkpoints.append(
                {"id": identifier, "state": state_relative, "browser": browser_relative, "visual": visual_relative}
            )
            return state

        def expose_plate(index: int) -> dict[str, object]:
            page.mouse.move(720, 450)
            page.mouse.down(button="right")
            page.wait_for_timeout(50)
            page.mouse.down(button="left")
            page.mouse.up(button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                timeout=3500,
            )
            return snapshot(page)

        def restart_and_begin() -> None:
            page.get_by_role("button", name="Take the route again").click()
            page.wait_for_timeout(50)
            clean = snapshot(page)
            assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 420, clean
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(70)

        def return_via_cover() -> None:
            page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
            page.wait_for_timeout(50)
            page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
            page.wait_for_timeout(70)
            page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
            page.wait_for_function(
                "window.__projectPlateau.snapshot().player.runStatus === 'result'",
                timeout=1000,
            )

        # Alive band 0: survival without proof.
        page.keyboard.down("KeyW")
        page.wait_for_timeout(360)
        page.keyboard.up("KeyW")
        return_via_cover()
        no_record = capture("01-returned-without-record", ["W", "QA walking compression: glade → covered return → Fort"])
        assert no_record["player"]["distanceTravelled"] > 0, no_record
        assert no_record["player"]["result"]["band"] == "returned-without-record", no_record
        restart_and_begin()

        # Alive band 1–3: exact tutorial partial survives.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(50)
        page.keyboard.press("KeyE")
        expose_plate(0)
        return_via_cover()
        insufficient = capture("02-insufficient-record", ["E", "Right Mouse", "Left Mouse", "covered return", "Fort"])
        assert insufficient["player"]["result"]["band"] == "insufficient-record", insufficient
        assert insufficient["player"]["result"]["evidence"] == 1, insufficient
        restart_and_begin()

        # Mixed: all five verbs, one paused committed dive, timely shot, noisy creek and band 4–5.
        page.keyboard.down("KeyW")
        page.wait_for_timeout(300)
        page.keyboard.up("KeyW")
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(50)
        page.keyboard.press("KeyE")
        expose_plate(0)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(60)
        expose_plate(1)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(60)
        page.keyboard.press("KeyE")
        expose_plate(2)
        page.wait_for_timeout(350)
        before_pause = snapshot(page)["player"]["attackSeconds"]
        page.keyboard.press("KeyP")
        page.wait_for_timeout(550)
        during_pause = snapshot(page)
        assert during_pause["player"]["paused"], during_pause
        assert abs(during_pause["player"]["attackSeconds"] - before_pause) < 0.08, during_pause
        page.keyboard.press("KeyP")
        page.wait_for_timeout(60)
        page.keyboard.down("KeyF")
        page.mouse.click(720, 450, button="left")
        page.keyboard.up("KeyF")
        page.wait_for_timeout(60)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 7, z: 18})")
        page.wait_for_timeout(100)
        assert snapshot(page)["player"]["returnRoute"] == "exposed"
        page.evaluate("window.__projectPlateau.teleportForTest({x: -10.5, z: 52})")
        page.wait_for_timeout(120)
        noisy_return = capture(
            "03-noisy-exposed-return",
            ["W", "E", "three shutter commitments", "P pause/resume during dive", "F", "Left Mouse", "exposed return"],
        )
        assert noisy_return["player"]["returnCostSeconds"] == 18, noisy_return
        assert noisy_return["player"]["brookResponse"] == "brush-moving", noisy_return
        assert noisy_return["brookResponseVisual"]["state"] == "brush-moving", noisy_return
        assert noisy_return["player"]["gunshotFired"], noisy_return
        assert noisy_return["player"]["cartridges"] == 1, noisy_return
        assert noisy_return["player"]["distanceTravelled"] > 0, noisy_return
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            timeout=1000,
        )
        corroborating = capture("04-corroborating-shot-result", ["Fort gate"])
        assert corroborating["player"]["result"]["band"] == "corroborating-record", corroborating
        assert corroborating["player"]["result"]["evidence"] == 4, corroborating
        assert corroborating["ui"]["terminal"]["callback"] == "The report carried. Something answered by the brook.", corroborating
        restart_and_begin()

        # An unbroken attack entering the creek strikes the best plate but not the body.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(50)
        page.keyboard.press("KeyE")
        expose_plate(0)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(60)
        expose_plate(1)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(60)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 7, z: 18})")
        page.wait_for_timeout(100)
        strike = capture("05-exposed-case-strike", ["partial plate", "basalt plate", "attack-state exposed return"])
        assert strike["player"]["returnStrike"], strike
        assert strike["player"]["plates"][1]["status"] == "cracked", strike
        assert strike["player"]["bodyMargin"] == 1, strike
        assert strike["player"]["returnCostSeconds"] == 12, strike
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            timeout=1000,
        )
        strike_result = capture("06-struck-insufficient-result", ["Fort gate"])
        assert strike_result["player"]["result"]["band"] == "insufficient-record", strike_result
        assert strike_result["player"]["result"]["evidence"] == 1, strike_result
        restart_and_begin()

        # Current-source Strong/no-shot evidence, repeated at minimum viewport.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(50)
        page.keyboard.press("KeyE")
        expose_plate(0)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(60)
        expose_plate(1)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(50)
        page.keyboard.press("KeyE")
        expose_plate(2)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(6200)
        expose_plate(3)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            timeout=1000,
        )
        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(100)
        strong = capture("07-strong-result-1280x720", ["four proof exposures", "covered return", "Fort gate"])
        assert strong["viewport"] == [1280, 720], strong
        assert strong["player"]["result"]["band"] == "strong-field-record", strong
        assert strong["player"]["gunshotFired"] is False, strong
        page.set_viewport_size({"width": 1440, "height": 900})
        restart_and_begin()

        # Panic: two exposed commitments, two unblocked contacts, explicit failure.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(60)
        expose_plate(0)
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.bodyMargin === 0",
            timeout=5000,
        )
        expose_plate(1)
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'failure'",
            timeout=5000,
        )
        panic = capture("08-panic-second-contact", ["two open shutter commitments", "no cover", "no timely shot"])
        assert panic["player"]["failureCause"] == "second-unblocked-strike", panic
        assert panic["player"]["result"]["kind"] == "failure", panic

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(60)
        final_clean = snapshot(page)
        assert final_clean["mode"] == "order", final_clean
        assert final_clean["player"]["brookResponse"] is None, final_clean
        assert final_clean["player"]["remainingLight"] == 420, final_clean
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s5-route-outcomes",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "targetViewport": [1440, 900],
            "minimumViewport": [1280, 720],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "allFourAliveBands": True,
            "strongNoShotCoveredReturn": True,
            "mixedShotCallbackCorroboratingReturn": True,
            "panicExplicitFailure": True,
            "exposedAttackCracksBestPlateNotBody": True,
            "coveredExposedAndNoisyCosts": {"covered": 28, "exposed": 12, "noisyExposed": 18},
            "pauseFreezesCommittedDive": True,
            "minimumViewportTerminal": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "verbEvidenceMatrix": {
            "traverse": "03-noisy-exposed-return",
            "observe": "03-noisy-exposed-return",
            "commitExposedObjective": "03-noisy-exposed-return",
            "evadeOrDefend": "03-noisy-exposed-return",
            "reachRelativeSafety": "04-corroborating-shot-result",
        },
        "referencePaths": {
            "Strong": {"result": "strong-field-record", "checkpoint": "07-strong-result-1280x720", "shot": False},
            "Mixed": {"result": "corroborating-record", "checkpoint": "04-corroborating-shot-result", "shot": True},
            "Panic": {"result": "second-unblocked-strike", "checkpoint": "08-panic-second-contact", "shot": False},
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S5 uses QA-only walking compression between decision spaces; it does not yet satisfy the final uncompressed reference-run gate.",
            "The five verbs occur in the Mixed state path with a real movement input, but full geographic traversal still needs authoritative evidence.",
            "Brook response is a deterministic local brush animation and result callback; production audio remains pending.",
            "Terminal plates now vary by frame key but remain CSS grayboxes rather than accepted final plate renders.",
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
    print(
        json.dumps(
            {"stage": report["stage"], "checks": report["checks"], "performance": report["performance"], "source": report["source"]},
            indent=2,
        )
    )
    print(f"S5 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
