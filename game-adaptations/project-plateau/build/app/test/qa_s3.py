#!/usr/bin/env python3
"""Capture observation, exposed proof, recoverable contact and defense evidence."""

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
EVIDENCE = BUILD / "evidence" / "s3"
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
                    raise RuntimeError("Vite exited before S3 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S3 QA")


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
        page.goto(f"{BASE_URL}/?qa=s3", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") in {
            "s3-exposed-proof", "s4-complete-loop", "s5-route-outcomes", "s6-field-feedback"
        }
        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(180)

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s3/state/{identifier}.json"
            browser_relative = f"build/evidence/s3/browser/{identifier}.json"
            visual_relative = f"build/evidence/s3/{identifier}.jpg"
            (STATE_DIR / f"{identifier}.json").write_text(
                json.dumps(state, indent=2) + "\n", encoding="utf-8"
            )
            browser_record = {
                "inputs": inputs,
                "viewport": [1440, 900],
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
                {
                    "id": identifier,
                    "state": state_relative,
                    "browser": browser_relative,
                    "visual": visual_relative,
                }
            )
            return state

        clean = capture("01-clean-start", ["Enter the basin", "Begin field work"])
        assert clean["player"]["plates"][0]["status"] == "unexposed", clean
        assert clean["player"]["cartridges"] == 2, clean
        assert clean["player"]["bodyMargin"] == 1, clean

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(120)
        assert snapshot(page)["ui"]["prompt"] == "Examine the track [E]"
        page.keyboard.press("KeyE")
        page.wait_for_timeout(80)
        examined = capture("02-track-examined", ["QA route setup: brook blind", "E"])
        assert examined["player"]["examinedTrack"], examined
        assert examined["player"]["lastObservation"] == "Three toes. Fresh. The brook runs back to camp.", examined
        assert sum(plate["points"] for plate in examined["player"]["plates"]) == 0, examined

        page.mouse.move(720, 450)
        page.mouse.down(button="right")
        page.wait_for_timeout(100)
        raised = capture("03-camera-raised", ["Right Mouse down"])
        assert raised["player"]["cameraRaised"], raised
        assert raised["ui"]["cameraOverlay"], raised
        assert raised["ui"]["prompt"] == "Hold steady. Release the shutter [Left Mouse]", raised

        page.mouse.down(button="left")
        page.mouse.up(button="left")
        page.mouse.up(button="right")
        page.wait_for_timeout(620)
        committing = snapshot(page)
        assert committing["player"]["pendingExposure"], committing
        remaining_before_pause = committing["player"]["pendingExposure"]["remainingSeconds"]
        page.keyboard.press("KeyP")
        page.wait_for_timeout(620)
        paused = capture("04-paused-commitment", ["Left Mouse", "Right Mouse up", "P", "wait 620ms"])
        assert paused["player"]["paused"], paused
        assert abs(paused["player"]["pendingExposure"]["remainingSeconds"] - remaining_before_pause) < 0.08, paused
        assert paused["player"]["plates"][0]["status"] == "unexposed", paused
        page.keyboard.press("KeyP")
        page.wait_for_timeout(1650)
        partial = capture("05-partial-plate", ["P resume", "wait for live two-second commitment"])
        assert partial["player"]["plates"][0]["status"] == "exposed", partial
        assert partial["player"]["plates"][0]["points"] == 1, partial
        assert partial["player"]["plates"][0]["label"] == "PARTIAL — foliage hides the flank.", partial
        assert partial["player"]["threatAwareness"] == 1, partial
        assert partial["ui"]["platePreview"] == "PARTIAL — foliage hides the flank.", partial

        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(120)
        page.mouse.down(button="right")
        page.wait_for_timeout(70)
        page.mouse.down(button="left")
        page.mouse.up(button="left")
        page.mouse.up(button="right")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[1].status === 'exposed'",
            timeout=3500,
        )
        open_plate = snapshot(page)
        assert open_plate["player"]["plates"][1]["points"] == 2, open_plate
        assert open_plate["player"]["threatState"] == "attack", open_plate
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.bodyMargin === 0",
            timeout=5000,
        )
        contact = capture("06-recoverable-contact", ["QA route setup: basalt shelf", "Right Mouse", "Left Mouse", "wait for contact"])
        assert contact["player"]["failed"] is False, contact
        assert contact["player"]["bodyMargin"] == 0, contact
        assert contact["player"]["plates"][1]["status"] == "cracked", contact
        assert contact["player"]["plates"][1]["lostPoints"] == 2, contact
        assert contact["player"]["plates"][0]["status"] == "exposed", contact
        assert contact["player"]["threatState"] == "watch", contact
        assert contact["ui"]["contactNote"] == "CASE STRIKE — PLATE II CRACKED.", contact

        page.evaluate("window.__projectPlateau.restart()")
        page.wait_for_timeout(150)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(120)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 7, z: 18})")
        page.keyboard.down("ShiftLeft")
        page.keyboard.down("KeyW")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.threatState === 'attack'",
            timeout=2500,
        )
        page.keyboard.up("KeyW")
        page.keyboard.up("ShiftLeft")
        page.keyboard.down("KeyF")
        page.wait_for_timeout(60)
        page.mouse.click(720, 450, button="left")
        page.keyboard.up("KeyF")
        page.wait_for_timeout(80)
        shot = capture("07-shot-interrupt", ["Restart", "QA route setup: glade → exposed creek", "Shift+W", "F", "Left Mouse"])
        assert shot["player"]["gunshotFired"], shot
        assert shot["player"]["shotCount"] == 1, shot
        assert shot["player"]["cartridges"] == 1, shot
        assert shot["player"]["threatState"] == "watch", shot
        assert shot["player"]["lastThreatEvent"] == "defensive-shot-interrupt", shot
        assert shot["player"]["bodyMargin"] == 1, shot
        assert shot["ui"]["contactNote"] == "RIFLE REPORT — THE DIVE SHEARS AWAY.", shot

        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s3-exposed-proof",
        "source": {
            "scope": "index.html, package manifests, public assets and src",
            "sha256": fingerprint(),
        },
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "observationChangesEligibilityWithoutPoints": True,
            "cameraRaiseAndTwoSecondCommitment": True,
            "pauseFreezesCommitment": True,
            "coveredPartialPlate": True,
            "openPlateEscalatesThreat": True,
            "highestValuePlateCracksOnRecoverableContact": True,
            "timelyShotInterruptsAttack": True,
            "persistentGunshotFlag": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S3 proves observation, plate exposure, contact and limited defense but does not yet submit a complete run at Fort.",
            "Proof grades are deterministic authored zone/observation outcomes; final gaze and behavior-window polish remains.",
            "The rifle report and plate mechanisms are visual graybox feedback; the final audio layer remains a later gate.",
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
            {
                "stage": report["stage"],
                "checks": report["checks"],
                "performance": report["performance"],
                "source": report["source"],
            },
            indent=2,
        )
    )
    print(f"S3 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
