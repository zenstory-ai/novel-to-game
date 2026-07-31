#!/usr/bin/env python3
"""Verify distinct family behavior and renderer-derived glass-plate images."""

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
EVIDENCE = BUILD / "evidence" / "s9"
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
                    raise RuntimeError("Vite exited before S9 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S9 QA")


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
        page.goto(f"{BASE_URL}/?qa=s9", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") in {"s9-living-plates", "s10-glade-clarity"}

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s9/state/{identifier}.json"
            browser_relative = f"build/evidence/s9/browser/{identifier}.json"
            visual_relative = f"build/evidence/s9/{identifier}.jpg"
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

        def teleport(x: float, z: float) -> None:
            page.evaluate(f"window.__projectPlateau.teleportForTest({{x: {x}, z: {z}, heading: 0}})")
            page.wait_for_timeout(80)

        def expose(index: int) -> dict[str, object]:
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
            page.wait_for_timeout(70)
            return snapshot(page)

        def begin_exposure(index: int, frame_key: str) -> dict[str, object]:
            page.mouse.move(720, 450)
            page.mouse.down(button="right")
            page.wait_for_timeout(70)
            page.mouse.down(button="left")
            page.mouse.up(button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.pendingExposure?.key === '{frame_key}'",
                timeout=1000,
            )
            state = snapshot(page)
            assert state["ui"]["capturedPlateImages"][index], state
            return state

        page.get_by_role("button", name="Enter the basin").click()
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)

        # QA placement establishes the first two approved frames; S8 remains the timing reference.
        teleport(0, 45)
        page.keyboard.press("KeyE")
        brook = expose(0)
        assert brook["player"]["plates"][0]["frameKey"] == "brook-partial", brook
        teleport(8, 18)
        basalt = expose(1)
        assert basalt["player"]["plates"][1]["frameKey"] == "basalt-scale", basalt
        teleport(0, 18)
        page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
        teleport(0, 2)
        page.keyboard.press("KeyE")

        young_pending = begin_exposure(2, "glade-young-play")
        assert young_pending["familyVisual"]["moment"] == "glade-young-play", young_pending
        family_asset = young_pending["assets"]["family"]
        assert family_asset["adults"] == 2 and family_asset["young"] == 3, young_pending
        assert family_asset["behaviors"] == ["graze", "branch-pull", "young-play"], young_pending
        assert family_asset["branchPresent"] and family_asset["visibleParts"] >= 50, young_pending
        capture("01-young-play-commitment", ["QA place in glade", "E", "camera commitment"])
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[2].status === 'exposed'",
            timeout=3500,
        )
        young = capture("02-young-play-plate", ["wait for Plate III to seat"])
        assert young["player"]["plates"][2]["frameKey"] == "glade-young-play", young
        assert "young play" in young["ui"]["platePreview"].lower(), young

        branch_pending = begin_exposure(3, "glade-branch-pull")
        assert branch_pending["familyVisual"]["moment"] == "glade-branch-pull", branch_pending
        assert branch_pending["familyVisual"]["branchAngle"] > 0.4, branch_pending
        capture("03-branch-pull-commitment", ["second glade camera commitment"])
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[3].status === 'exposed'",
            timeout=3500,
        )
        branch = capture("04-branch-pull-plate", ["wait for Plate IV to seat"])
        assert branch["player"]["plates"][3]["frameKey"] == "glade-branch-pull", branch
        assert "branch" in branch["ui"]["platePreview"].lower(), branch

        teleport(0, 4)
        page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
        teleport(0, 70)
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        result = capture("05-distinct-recovered-plates", ["QA place through covered return", "Fort submission"])
        assert result["player"]["result"]["band"] == "strong-field-record", result
        assert result["player"]["result"]["evidence"] == 7, result
        assert result["ui"]["capturedPlateImages"] == [True, True, True, True], result

        plate_styles = page.locator(".terminal-board span").evaluate_all(
            "elements => elements.map(element => ({"
            "image: element.style.backgroundImage, "
            "captured: element.dataset.captured, "
            "filter: getComputedStyle(element).filter"
            "}))"
        )
        assert all(style["captured"] == "true" for style in plate_styles), plate_styles
        assert all("data:image/jpeg;base64" in style["image"] for style in plate_styles), plate_styles
        assert all("grayscale" in style["filter"] for style in plate_styles), plate_styles
        assert len({style["image"] for style in plate_styles}) == 4, "captured plates must be distinct"
        plate_image_records = [
            {
                "plate": index + 1,
                "bytesInCssValue": len(style["image"].encode()),
                "sha256": hashlib.sha256(style["image"].encode()).hexdigest(),
                "filter": style["filter"],
            }
            for index, style in enumerate(plate_styles)
        ]

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        clean = capture("06-clean-order-no-plates", ["Take the route again"])
        assert clean["mode"] == "order", clean
        assert clean["ui"]["capturedPlateImages"] == [False, False, False, False], clean

        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        browser.close()

    allowed = {urlparse(BASE_URL).netloc}
    external = sorted(hosts - allowed)
    assert not errors, errors
    assert not external, external
    return {
        "stage": "s9-living-plates",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "twoAdultsThreeYoung": True,
            "youngPlayAndBranchPullDistinct": True,
            "rendererCanvasFeedsEveryPlate": True,
            "fourCapturedPlatesAreDistinct": True,
            "plateImagesUseNonColourTreatment": True,
            "strongRecoveredBoardUsesCapturedViews": True,
            "restartClearsCapturedViews": True,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "plateImages": plate_image_records,
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S9 uses QA placement to isolate asset states; S8 remains the input-only traversal and timing evidence.",
            "The plate images are real renderer-canvas captures with monochrome treatment, while evidence grading remains deterministic simulation state.",
            "Automated shape/state checks do not replace independent anatomy, premise or first-time player perception review.",
            "Subjective composition, animation quality and visual appeal are not inferred from deterministic checks.",
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
                "plateImages": report["plateImages"],
                "performance": report["performance"],
                "source": report["source"],
            },
            indent=2,
        )
    )
    print(f"S9 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
