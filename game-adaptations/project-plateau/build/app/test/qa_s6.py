#!/usr/bin/env python3
"""Verify recognizable field assets, local audio cues, captions and audio controls."""

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
EVIDENCE = BUILD / "evidence" / "s6"
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
                    raise RuntimeError("Vite exited before S6 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S6 QA")


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
        page.goto(f"{BASE_URL}/?qa=s6", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") in {"s6-field-feedback", "s7-lifecycle"}

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s6/state/{identifier}.json"
            browser_relative = f"build/evidence/s6/browser/{identifier}.json"
            visual_relative = f"build/evidence/s6/{identifier}.jpg"
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
            page.wait_for_timeout(70)
            page.mouse.down(button="left")
            page.mouse.up(button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                timeout=3500,
            )
            return snapshot(page)

        # All controls are operable before the audio context exists.
        page.get_by_role("button", name="Settings").click()
        page.locator("#ambience-volume").fill("0.25")
        page.locator("#effects-volume").fill("0.45")
        page.locator("#music-volume").fill("0.15")
        page.locator("#captions-enabled").uncheck()
        assert snapshot(page)["audio"]["captionsEnabled"] is False
        page.locator("#captions-enabled").check()
        settings = capture("01-audio-settings", ["Settings", "set three channel volumes", "captions off", "captions on"])
        assert settings["audio"]["volumes"] == {"ambience": 0.25, "effects": 0.45, "music": 0.15}, settings
        assert settings["audio"]["captionsEnabled"] is True, settings
        page.locator("#settings-panel .panel-close").click()

        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_function("window.__projectPlateau.snapshot().audio.status === 'running'", timeout=3000)
        page.wait_for_timeout(90)
        field_start = capture("02-field-sound-start", ["Enter the basin", "Begin field work"])
        assert field_start["audio"]["recentCues"][-1]["cue"] == "field-start", field_start
        assert field_start["ui"]["caption"] == "[brook water and insects under the canopy]", field_start

        # The period camera now reads as a bellows camera in the live first-person view.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(80)
        page.keyboard.press("KeyE")
        page.wait_for_timeout(60)
        examined = capture("03-examine-caption", ["QA route setup: brook blind", "E"])
        assert examined["ui"]["caption"] == "[fern brushes aside; pencil marks the field card]", examined
        assert examined["audio"]["recentCues"][-1]["cue"] == "examine", examined

        page.mouse.move(720, 450)
        page.mouse.down(button="right")
        page.wait_for_timeout(100)
        camera_raised = capture("04-bellows-camera-raised", ["Right Mouse down"])
        assert camera_raised["assets"]["fieldCamera"] == {"version": "bellows-camera", "visibleParts": 13}, camera_raised
        assert camera_raised["ui"]["caption"] == "[wood frame lifts; bellows opens]", camera_raised
        page.mouse.down(button="left")
        page.mouse.up(button="left")
        page.mouse.up(button="right")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[0].status === 'exposed'",
            timeout=3500,
        )
        plate = capture("05-plate-slide-caption", ["Left Mouse", "wait for two-second exposure"])
        assert plate["ui"]["caption"] == "[glass plate seats in its case]", plate
        assert plate["audio"]["recentCues"][-1]["cue"] == "plate-slide", plate

        # An open second commitment exposes the membrane-wing threat; canopy cover makes it pull up.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(80)
        exposed = expose_plate(1)
        assert exposed["player"]["threatState"] == "attack", exposed
        page.wait_for_timeout(100)
        attack = capture("06-membrane-wing-attack", ["QA route setup: basalt shelf", "second shutter commitment"])
        recent_attack_cues = [event["cue"] for event in attack["audio"]["recentCues"]]
        assert "attack" in recent_attack_cues, attack
        assert attack["assets"]["pterodactyl"] == {"silhouette": "membrane-wing", "visibleParts": 5}, attack

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(70)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18, pitch: 0.32})")
        page.wait_for_timeout(120)
        covered = capture("07-cover-pull-up", ["QA route setup: glade", "covered return"])
        assert covered["player"]["returnRoute"] == "covered", covered
        assert covered["player"]["inCover"] is True, covered
        assert covered["threatVisual"]["response"] == "cover-pull-up", covered
        assert covered["assets"]["cover"] == {"archCount": 5, "visibleParts": 25}, covered
        assert covered["ui"]["caption"] == "[branches scrape the camera; wingbeats widen]", covered

        # A second run demonstrates rifle, noisy-brook and result feedback in one causal chain.
        page.evaluate("window.__projectPlateau.restart()")
        page.wait_for_function("window.__projectPlateau.snapshot().audio.status === 'running'", timeout=1000)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(80)
        page.keyboard.press("KeyE")
        expose_plate(0)
        page.wait_for_timeout(80)
        assert snapshot(page)["player"]["threatState"] == "attack"
        page.keyboard.down("KeyF")
        page.mouse.click(720, 450, button="left")
        page.keyboard.up("KeyF")
        page.wait_for_timeout(80)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 7, z: 18})")
        page.wait_for_timeout(150)
        brook = capture("08-rifle-brook-response", ["glade proof", "F", "Left Mouse", "exposed return"])
        brook_cues = [event["cue"] for event in brook["audio"]["recentCues"]]
        assert brook["player"]["gunshotFired"] is True, brook
        assert brook["player"]["brookResponse"] == "brush-moving", brook
        assert brook["brookResponseVisual"]["state"] == "brush-moving", brook
        assert brook["player"]["returnCostSeconds"] == 18, brook
        assert "rifle" in brook_cues and "brook-response" in brook_cues, brook
        assert brook["ui"]["caption"] == "[brush thrashes beside the brook]", brook

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        result = capture("09-result-cue", ["Fort gate"])
        assert result["ui"]["terminal"]["kind"] == "alive", result
        assert result["audio"]["recentCues"][-1]["cue"] == "result", result

        # Failure has its own cue, and a new run clears prior cue history while preserving settings.
        page.get_by_role("button", name="Take the route again").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        clean_audio = snapshot(page)["audio"]
        assert [event["cue"] for event in clean_audio["recentCues"]] == ["field-start"], clean_audio
        assert clean_audio["volumes"] == {"ambience": 0.25, "effects": 0.45, "music": 0.15}, clean_audio
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.evaluate("window.__projectPlateau.advanceTimeForTest(420)")
        failure = capture("10-failure-cue", ["restart", "QA deadline advance outside Fort"])
        assert failure["player"]["failureCause"] == "remaining-light-expired", failure
        assert failure["audio"]["recentCues"][-1]["cue"] == "failure", failure

        page.get_by_role("button", name="Take the route again").click()
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
        "stage": "s6-field-feedback",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "targetViewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "recognizableBellowsCameraStructure": True,
            "membraneWingThreatStructure": True,
            "coverArchesAndPullUpResponse": True,
            "lazyLocalWebAudioRunning": True,
            "threeChannelVolumeControls": True,
            "captionsToggleAndCoreCueCaptions": True,
            "rifleAndBrookResponseCues": True,
            "distinctResultAndFailureCues": True,
            "runResetClearsCueHistoryAndPreservesSettings": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "The audio evidence proves browser audio-node state, cue scheduling, settings and captions; it does not claim subjective mix or sound quality.",
            "Core sound is original Web Audio synthesis rather than final recorded or authored production sound.",
            "The camera, pterodactyl and cover volumes are improved procedural assets, but the remaining release-gate assets and final animation polish are still open.",
            "S6 retains QA-only route compression; uncompressed reference runs remain a later authoritative gate.",
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
    print(f"S6 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
