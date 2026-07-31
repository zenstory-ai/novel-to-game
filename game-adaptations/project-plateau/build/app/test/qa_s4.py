#!/usr/bin/env python3
"""Capture the primitive proof-to-return-to-result loop and both terminal failures."""

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
EVIDENCE = BUILD / "evidence" / "s4"
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
                    raise RuntimeError("Vite exited before S4 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S4 QA")


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
        page.goto(f"{BASE_URL}/?qa=s4", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") in {
            "s4-complete-loop", "s5-route-outcomes", "s6-field-feedback", "s7-lifecycle", "s8-input-paths", "s9-living-plates"
        }
        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(150)

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s4/state/{identifier}.json"
            browser_relative = f"build/evidence/s4/browser/{identifier}.json"
            visual_relative = f"build/evidence/s4/{identifier}.jpg"
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
                {"id": identifier, "state": state_relative, "browser": browser_relative, "visual": visual_relative}
            )
            return state

        def expose_plate(index: int) -> dict[str, object]:
            page.mouse.move(720, 450)
            page.mouse.down(button="right")
            page.wait_for_timeout(60)
            page.mouse.down(button="left")
            page.mouse.up(button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                timeout=3500,
            )
            return snapshot(page)

        clean = capture("01-clean-start", ["Enter the basin", "Begin field work"])
        assert clean["player"]["remainingLight"] <= 180
        assert clean["player"]["runStatus"] == "active"

        # One uninterrupted deterministic Strong-band state path. QA teleports only
        # compress walking time; all observation, exposure, threat and route rules run.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(80)
        page.keyboard.press("KeyE")
        expose_plate(0)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(80)
        expose_plate(1)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(60)
        page.keyboard.press("KeyE")
        expose_plate(2)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(120)
        route = capture(
            "02-covered-return-committed",
            ["QA walking compression: brook → basalt → glade → covered return", "E", "three shutter commitments"],
        )
        assert route["player"]["returnRoute"] == "covered", route
        assert route["player"]["returnCostSeconds"] == 28, route
        assert route["player"]["threatState"] == "attack", route
        page.wait_for_timeout(6200)
        assert snapshot(page)["player"]["threatState"] == "search"
        expose_plate(3)
        proof = capture(
            "03-six-cue-record",
            ["Hold in cover for six seconds", "Right Mouse", "Left Mouse"],
        )
        assert sum(plate["points"] for plate in proof["player"]["plates"] if plate["status"] == "exposed") == 6, proof
        assert proof["player"]["bodyMargin"] == 1, proof
        assert proof["player"]["cartridges"] == 2, proof

        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            timeout=1500,
        )
        strong = capture("04-strong-result", ["QA walking compression: covered return → Fort gate"])
        assert strong["player"]["result"]["band"] == "strong-field-record", strong
        assert strong["player"]["result"]["evidence"] == 6, strong
        assert strong["player"]["result"]["route"] == "covered", strong
        assert strong["ui"]["terminal"]["copy"] == "Scale. Living form. Behavior. The field record holds.", strong

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(100)
        restarted = capture("05-result-restart", ["Take the route again"])
        assert restarted["mode"] == "order", restarted
        assert restarted["runActive"] is False, restarted
        assert restarted["player"]["runStatus"] == "active", restarted
        assert restarted["player"]["remainingLight"] == 180, restarted
        assert all(plate["status"] == "unexposed" for plate in restarted["player"]["plates"]), restarted

        # Timeout failure and clean restart.
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(50)
        page.evaluate("window.__projectPlateau.advanceTimeForTest(181)")
        timeout = capture("06-timeout-failure", ["Begin field work", "QA time compression: 181 seconds outside Fort"])
        assert timeout["player"]["runStatus"] == "failure", timeout
        assert timeout["player"]["failureCause"] == "remaining-light-expired", timeout
        assert timeout["ui"]["terminal"]["copy"] == "The basin went dark. The brook was no longer enough.", timeout
        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        timeout_restart = capture("07-timeout-restart", ["Take the route again"])
        assert timeout_restart["mode"] == "order", timeout_restart
        assert timeout_restart["player"]["remainingLight"] == 180, timeout_restart

        # Two unblocked contacts: the first is recoverable and the second is terminal.
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 8, z: 18})")
        page.wait_for_timeout(80)
        expose_plate(0)
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.bodyMargin === 0",
            timeout=5000,
        )
        first_contact = capture("08-first-contact", ["QA walking compression: basalt shelf", "shutter", "wait for first contact"])
        assert first_contact["player"]["runStatus"] == "active", first_contact
        assert first_contact["player"]["plates"][0]["status"] == "cracked", first_contact
        expose_plate(1)
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.runStatus === 'failure'",
            timeout=5000,
        )
        second_contact = capture("09-second-contact-failure", ["second open shutter", "wait for second contact"])
        assert second_contact["player"]["failureCause"] == "second-unblocked-strike", second_contact
        assert second_contact["ui"]["terminal"]["copy"] == "The second pass found you in open ground.", second_contact
        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        final_restart = capture("10-failure-restart", ["Take the route again"])
        assert final_restart["mode"] == "order", final_restart
        assert final_restart["player"]["bodyMargin"] == 1, final_restart
        assert final_restart["player"]["contactCount"] == 0, final_restart

        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s4-complete-loop",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "sameRunObserveProofCoveredReturnStrongResult": True,
            "fourPhysicalPlatesResolved": True,
            "coveredReturnCostAppliedOnce": True,
            "resultRestartReturnsCleanFieldOrder": True,
            "timeoutFailureCauseAndCue": True,
            "timeoutRestartReturnsCleanFieldOrder": True,
            "firstContactRecoverable": True,
            "secondContactCauseAndCue": True,
            "failureRestartReturnsCleanFieldOrder": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "completeRun": {
            "result": "strong-field-record",
            "evidence": 6,
            "route": "covered",
            "startCheckpoint": "01-clean-start",
            "resultCheckpoint": "04-strong-result",
            "restartCheckpoint": "05-result-restart",
            "walkingCompression": "QA-only teleport shortens traversal; all decision/resource transitions execute in one unchanged run state.",
        },
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S4 proves the primitive terminal loop but is not the final authoritative verification command or final qa/verification.json handoff.",
            "The complete-run browser path compresses walking with a QA-only teleport while preserving one continuous gameplay state.",
            "The Strong checkpoint reaches the designed evidence band but does not yet enforce the 30–120 second remaining-light reference window.",
            "Exposed-return/noise consequence, no-record/corroborating result captures, audio and production art remain later gates.",
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
    print(f"S4 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
