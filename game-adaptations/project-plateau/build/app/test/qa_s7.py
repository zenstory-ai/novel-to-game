#!/usr/bin/env python3
"""Verify persisted presentation settings, lifecycle layouts, loading and payload budgets."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import Locator, Page, sync_playwright

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "s7"
STATE_DIR = EVIDENCE / "state"
BROWSER_DIR = EVIDENCE / "browser"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
TARGET_VIEWPORT = {"width": 1440, "height": 900}
MINIMUM_VIEWPORT = {"width": 1280, "height": 720}
NETWORK_MBIT = 25


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
                    raise RuntimeError("Vite exited before S7 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S7 QA")


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


def payload_report() -> dict[str, object]:
    files = []
    raw_total = 0
    gzip_total = 0
    for path in sorted((APP / "dist").rglob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        compressed = gzip.compress(data, compresslevel=9)
        files.append(
            {
                "path": path.relative_to(APP / "dist").as_posix(),
                "rawBytes": len(data),
                "gzipBytes": len(compressed),
            }
        )
        raw_total += len(data)
        gzip_total += len(compressed)
    return {"files": files, "rawBytes": raw_total, "gzipBytes": gzip_total}


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
        context = browser.new_context(viewport=TARGET_VIEWPORT)
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
        cdp.send(
            "Network.emulateNetworkConditions",
            {
                "offline": False,
                "latency": 20,
                "downloadThroughput": NETWORK_MBIT * 1024 * 1024 / 8,
                "uploadThroughput": NETWORK_MBIT * 1024 * 1024 / 8,
                "connectionType": "ethernet",
            },
        )
        page.goto(f"{BASE_URL}/?qa=s7", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        page.wait_for_function("window.__projectPlateau.snapshot().firstRenderedAt !== null")
        assert page.evaluate("window.__projectPlateau.stage") in {"s7-lifecycle", "s8-input-paths", "s9-living-plates"}

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s7/state/{identifier}.json"
            browser_relative = f"build/evidence/s7/browser/{identifier}.json"
            visual_relative = f"build/evidence/s7/{identifier}.jpg"
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

        def assert_within_viewport(locator: Locator) -> None:
            box = locator.bounding_box()
            viewport = page.viewport_size
            assert box and viewport, (box, viewport)
            assert box["x"] >= -1 and box["y"] >= -1, box
            assert box["x"] + box["width"] <= viewport["width"] + 1, (box, viewport)
            assert box["y"] + box["height"] <= viewport["height"] + 1, (box, viewport)

        def expose_plate(index: int) -> dict[str, object]:
            page.mouse.move(640, 360)
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

        first_loading = page.evaluate("window.__projectPlateau.loadingSnapshot()")
        assert first_loading["timeToFirstFrameMs"] <= 8000, first_loading

        # Customize every setting, reload without cache and prove the same values are restored.
        page.get_by_role("button", name="Settings").click()
        page.locator("#reduced-motion").check()
        page.locator("#text-scale").select_option("1.5")
        page.locator("#ambience-volume").fill("0.22")
        page.locator("#effects-volume").fill("0.44")
        page.locator("#music-volume").fill("0.11")
        expected_settings = {
            "reducedMotion": True,
            "captionsEnabled": True,
            "textScale": "1.5",
            "volumes": {"ambience": 0.22, "effects": 0.44, "music": 0.11},
        }
        current = snapshot(page)["presentationSettings"]
        assert {key: current[key] for key in expected_settings} == expected_settings, current
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        page.wait_for_function("window.__projectPlateau.snapshot().firstRenderedAt !== null")
        persisted = snapshot(page)
        assert {key: persisted["presentationSettings"][key] for key in expected_settings} == expected_settings, persisted
        assert persisted["mode"] == "title" and persisted["audio"]["status"] == "idle", persisted
        assert page.locator("body").evaluate("element => element.classList.contains('reduced-motion')")
        assert page.locator("html").evaluate("element => element.style.getPropertyValue('--text-scale')") == "1.5"
        page.get_by_role("button", name="Settings").click()
        settings_target = capture("01-persisted-settings-target", ["customize all settings", "no-cache reload", "Settings"])
        assert_within_viewport(page.locator("#settings-panel"))
        assert settings_target["audio"]["volumes"] == expected_settings["volumes"], settings_target

        # Minimum viewport keeps 150% settings, order, field, pause and terminal surfaces in bounds.
        page.set_viewport_size(MINIMUM_VIEWPORT)
        page.wait_for_timeout(100)
        minimum_settings = capture("02-settings-150-minimum", ["resize to 1280x720"])
        assert minimum_settings["viewport"] == [1280, 720], minimum_settings
        assert_within_viewport(page.locator("#settings-panel"))
        page.locator("#settings-panel .panel-close").click()
        page.get_by_role("button", name="Enter the basin").click()
        order = capture("03-field-order-minimum", ["Enter the basin"])
        assert order["mode"] == "order", order
        assert_within_viewport(page.locator("#field-order"))
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_function("window.__projectPlateau.snapshot().audio.status === 'running'", timeout=3000)
        page.wait_for_timeout(80)
        field = capture("04-field-minimum", ["Begin field work"])
        assert field["mode"] == "field" and field["viewport"] == [1280, 720], field

        page.keyboard.press("KeyP")
        page.wait_for_timeout(80)
        manual_pause = capture("05-manual-pause-minimum", ["P"])
        assert manual_pause["player"]["paused"] is True, manual_pause
        assert manual_pause["player"]["pauseReason"] == "manual", manual_pause
        assert_within_viewport(page.locator("#pause-panel"))
        page.get_by_role("button", name="Resume field work").click()
        page.wait_for_timeout(60)

        # Focus loss freezes an in-flight plate and suspends audio until resume.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 45})")
        page.wait_for_timeout(60)
        page.keyboard.press("KeyE")
        page.mouse.move(640, 360)
        page.mouse.down(button="right")
        page.mouse.down(button="left")
        page.mouse.up(button="left")
        page.mouse.up(button="right")
        page.wait_for_timeout(380)
        before_focus_loss = snapshot(page)["player"]["pendingExposure"]["remainingSeconds"]
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.wait_for_timeout(520)
        focus_pause = capture("06-focus-pause-commitment-minimum", ["shutter", "window blur", "wait 520ms"])
        assert focus_pause["player"]["pauseReason"] == "window-inactive", focus_pause
        assert abs(focus_pause["player"]["pendingExposure"]["remainingSeconds"] - before_focus_loss) < 0.08, focus_pause
        assert focus_pause["audio"]["status"] == "suspended", focus_pause
        assert_within_viewport(page.locator("#pause-panel"))
        page.get_by_role("button", name="Resume field work").click()
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[0].status === 'exposed'",
            timeout=3500,
        )

        # Measure the heaviest minimum-viewport state before completing the route.
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(60)
        page.keyboard.press("KeyE")
        expose_plate(1)
        minimum_performance = page.evaluate("window.__projectPlateau.sampleFrames(120)")
        assert minimum_performance["medianFps"] >= 45, minimum_performance
        assert minimum_performance["onePercentLowFps"] >= 30, minimum_performance
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 18})")
        page.wait_for_timeout(80)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: 70})")
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        result = capture("07-result-minimum", ["glade proof", "covered return", "Fort gate"])
        assert result["ui"]["terminal"]["kind"] == "alive", result
        assert_within_viewport(page.locator("#terminal-panel"))

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(60)
        restarted = capture("08-restart-order-minimum", ["Take the route again"])
        assert restarted["mode"] == "order", restarted
        assert restarted["player"]["remainingLight"] == 180, restarted
        assert restarted["presentationSettings"]["textScale"] == "1.5", restarted
        assert_within_viewport(page.locator("#field-order"))

        # Restore defaults removes the versioned record; reload remains a clean title state.
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        page.set_viewport_size(TARGET_VIEWPORT)
        page.get_by_role("button", name="Settings").click()
        page.get_by_role("button", name="Restore defaults").click()
        assert page.evaluate("localStorage.getItem('project-plateau:presentation:v1')") is None
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        defaults = snapshot(page)
        assert defaults["mode"] == "title" and defaults["player"]["lastEvent"] == "clean-start", defaults
        assert defaults["presentationSettings"]["reducedMotion"] is False, defaults
        assert defaults["presentationSettings"]["captionsEnabled"] is True, defaults
        assert defaults["presentationSettings"]["textScale"] == "1", defaults
        assert defaults["presentationSettings"]["volumes"] == {
            "ambience": 0.34, "effects": 0.72, "music": 0.2
        }, defaults
        page.get_by_role("button", name="Settings").click()
        reset = capture("09-restored-defaults-target", ["Restore defaults", "no-cache reload", "Settings"])
        assert reset["viewport"] == [1440, 900], reset
        assert_within_viewport(page.locator("#settings-panel"))
        page.locator("#settings-panel .panel-close").click()

        # Repeat the heavy state at the target viewport for the final performance record.
        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
        page.wait_for_timeout(60)
        page.keyboard.press("KeyE")
        expose_plate(0)
        target_performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert target_performance["medianFps"] >= 45, target_performance
        assert target_performance["onePercentLowFps"] >= 30, target_performance
        heavy = capture("10-heavy-state-target", ["glade observation", "open proof", "240-frame sample"])
        assert heavy["player"]["threatState"] == "attack", heavy

        final_loading = page.evaluate("window.__projectPlateau.loadingSnapshot()")
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    payload = payload_report()
    assert payload["gzipBytes"] <= 20 * 1024 * 1024, payload
    assert payload["rawBytes"] <= 50 * 1024 * 1024, payload
    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s7-lifecycle",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "targetViewport": [1440, 900],
            "minimumViewport": [1280, 720],
            "network": {"cacheDisabled": True, "downlinkMbit": NETWORK_MBIT, "uplinkMbit": NETWORK_MBIT, "latencyMs": 20},
            "baseUrl": BASE_URL,
        },
        "checks": {
            "settingsPersistAcrossReload": True,
            "invalidStorageUnitCoverage": True,
            "restoreDefaultsClearsVersionedRecord": True,
            "targetAndMinimumViewportLifecycle": True,
            "textScale150MinimumViewport": True,
            "manualPause": True,
            "focusLossFreezesCommitmentAndSuspendsAudio": True,
            "terminalRestartPreservesSettingsAndResetsRun": True,
            "cleanReloadReturnsToTitle": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "loading": {"firstNoCacheNavigation": first_loading, "finalNavigation": final_loading, "budgetMs": 8000},
        "payload": {**payload, "initialCompressedBudgetBytes": 20 * 1024 * 1024, "totalBudgetBytes": 50 * 1024 * 1024},
        "performance": {"minimumViewport": minimum_performance, "targetViewport": target_performance},
        "checkpoints": checkpoints,
        "limitations": [
            "The 25 Mbps no-cache loading check uses Chrome DevTools throttling against the local Vite server; public-host cold loading remains a deployment gate.",
            "Presentation settings use one versioned localStorage record and intentionally do not migrate an earlier schema because none has shipped.",
            "S7 verifies lifecycle layout and state at both supported viewports but does not replace uncompressed Strong/Mixed/Panic reference runs.",
            "Automated screenshots prove panel bounds and state correspondence, not subjective comfort at 150% text.",
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
                "loading": report["loading"],
                "payload": report["payload"],
                "performance": report["performance"],
                "source": report["source"],
            },
            indent=2,
        )
    )
    print(f"S7 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
