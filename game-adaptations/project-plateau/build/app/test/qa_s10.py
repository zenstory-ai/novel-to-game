#!/usr/bin/env python3
"""Verify the protected glade and colour-vision review checkpoints."""

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
EVIDENCE = BUILD / "evidence" / "s10"
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
                    raise RuntimeError("Vite exited before S10 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S10 QA")


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


def focus_metrics(page: Page) -> dict[str, float | int]:
    return page.evaluate(
        """() => {
          const source = document.querySelector('#game-canvas');
          const copy = document.createElement('canvas');
          copy.width = source.width;
          copy.height = source.height;
          const context = copy.getContext('2d', {willReadFrequently: true});
          context.drawImage(source, 0, 0);
          const x = Math.floor(copy.width * 0.22);
          const y = Math.floor(copy.height * 0.13);
          const width = Math.floor(copy.width * 0.54);
          const height = Math.floor(copy.height * 0.56);
          const pixels = context.getImageData(x, y, width, height).data;
          let dark = 0;
          let bright = 0;
          let chromatic = 0;
          const count = pixels.length / 4;
          for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
            if (luma < 35) dark += 1;
            if (luma > 95) bright += 1;
            if (Math.max(red, green, blue) - Math.min(red, green, blue) > 20) chromatic += 1;
          }
          return {
            width,
            height,
            darkRatio: Number((dark / count).toFixed(4)),
            brightRatio: Number((bright / count).toFixed(4)),
            chromaticRatio: Number((chromatic / count).toFixed(4)),
          };
        }"""
    )


def run() -> dict[str, object]:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    BROWSER_DIR.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    hosts: set[str] = set()
    checkpoints: list[dict[str, object]] = []
    visuals: list[dict[str, object]] = []
    colour_vision_modes = ("protanopia", "deuteranopia", "tritanopia")
    colour_vision_matrix: dict[str, dict[str, str]] = {
        mode: {} for mode in colour_vision_modes
    }

    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        cdp = page.context.new_cdp_session(page)
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        page.goto(f"{BASE_URL}/?qa=s10", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") == "s10-glade-clarity"

        vision_mode = "full-colour"

        def set_vision(mode: str) -> None:
            nonlocal vision_mode
            vision_mode = mode
            cdp.send(
                "Emulation.setEmulatedVisionDeficiency",
                {"type": "none" if mode == "full-colour" else mode},
            )

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s10/state/{identifier}.json"
            browser_relative = f"build/evidence/s10/browser/{identifier}.json"
            visual_relative = f"build/evidence/s10/{identifier}.jpg"
            (STATE_DIR / f"{identifier}.json").write_text(
                json.dumps(state, indent=2) + "\n", encoding="utf-8"
            )
            viewport = page.viewport_size or {"width": 0, "height": 0}
            browser_record = {
                "inputs": inputs,
                "viewport": [viewport["width"], viewport["height"]],
                "visionMode": vision_mode,
                "url": page.url,
                "consoleErrorsAtCheckpoint": list(errors),
                "requestHostsAtCheckpoint": sorted(hosts),
                "capturedAtUnixMs": int(time.time() * 1000),
            }
            (BROWSER_DIR / f"{identifier}.json").write_text(
                json.dumps(browser_record, indent=2) + "\n", encoding="utf-8"
            )
            target = EVIDENCE / f"{identifier}.jpg"
            page.screenshot(path=target, type="jpeg", quality=88)
            visual_record = {
                "path": visual_relative,
                "bytes": target.stat().st_size,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "visionMode": vision_mode,
            }
            visuals.append(visual_record)
            checkpoints.append(
                {
                    "id": identifier,
                    "state": state_relative,
                    "browser": browser_relative,
                    "visual": visual_relative,
                    "visionMode": vision_mode,
                }
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
        for index, mode in enumerate(colour_vision_modes):
            set_vision(mode)
            identifier = f"00{chr(ord('a') + index)}-{mode}-field-order"
            order = capture(identifier, [f"Chromium {mode}", "Enter the basin"])
            assert order["mode"] == "order", order
            assert page.locator("#field-order").is_visible()
            assert "Photograph living proof" in page.locator("#field-order").inner_text()
            colour_vision_matrix[mode]["order"] = identifier
        set_vision("full-colour")
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)

        # Prepare the first two approved views so the glade pair can fill Plates III–IV.
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
        page.wait_for_timeout(1550)
        sightline = capture("01-clear-family-sightline", ["QA place in glade", "E", "wait for note to clear"])
        composition = sightline["assets"]["gladeComposition"]
        assert sightline["ui"]["fieldNote"] is None, sightline
        assert composition["sightlineHalfWidth"] >= 20, composition
        assert composition["sunLanePresent"], composition
        assert composition["shadowCastingSubjects"] == 5, composition
        assert composition["familyWidth"] >= 14, composition
        focus = focus_metrics(page)
        assert focus["darkRatio"] <= 0.32, focus
        assert focus["brightRatio"] >= 0.52, focus
        assert focus["chromaticRatio"] >= 0.6, focus

        for index, mode in enumerate(colour_vision_modes, start=7):
            set_vision(mode)
            identifier = f"{index:02d}-{mode}-glade"
            glade_mode = capture(identifier, [f"Chromium {mode}", "glade decision checkpoint"])
            assert glade_mode["mode"] == "field", glade_mode
            assert glade_mode["ui"]["prompt"] == "Raise camera [Right Mouse]", glade_mode
            assert glade_mode["ui"]["plateRail"], glade_mode
            assert glade_mode["ui"]["lightWatch"] is not None, glade_mode
            colour_vision_matrix[mode]["glade"] = identifier
        set_vision("full-colour")

        young_pending = begin_exposure(2, "glade-young-play")
        assert young_pending["familyVisual"]["moment"] == "glade-young-play", young_pending
        young = capture("02-young-play-silver-frame", ["Right Mouse", "Left Mouse", "live commitment"])
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[2].status === 'exposed'",
            timeout=3500,
        )

        branch_pending = begin_exposure(3, "glade-branch-pull")
        assert branch_pending["familyVisual"]["moment"] == "glade-branch-pull", branch_pending
        assert branch_pending["familyVisual"]["branchAngle"] > 0.4, branch_pending
        branch = capture("03-branch-pull-silver-frame", ["Right Mouse", "Left Mouse", "second live commitment"])
        assert young["player"]["pendingExposure"]["key"] != branch["player"]["pendingExposure"]["key"]
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.plates[3].status === 'exposed'",
            timeout=3500,
        )

        set_vision("achromatopsia")
        page.keyboard.down("KeyF")
        page.wait_for_timeout(120)
        non_colour = capture("04-achromatopsia-attack", ["Chromium achromatopsia", "F raised rifle"])
        assert non_colour["player"]["threatState"] == "attack", non_colour
        assert non_colour["threatVisual"]["state"] == "attack", non_colour
        assert non_colour["ui"]["rifleOverlay"], non_colour
        assert non_colour["ui"]["cartridgesVisible"], non_colour
        assert non_colour["assets"]["pterodactyl"]["silhouette"] == "membrane-wing", non_colour
        for index, mode in enumerate(colour_vision_modes, start=10):
            set_vision(mode)
            identifier = f"{index:02d}-{mode}-attack-defense"
            attack_mode = capture(identifier, [f"Chromium {mode}", "F raised rifle"])
            assert attack_mode["player"]["threatState"] == "attack", attack_mode
            assert attack_mode["ui"]["prompt"].startswith("Raise rifle"), attack_mode
            assert attack_mode["ui"]["rifleOverlay"], attack_mode
            assert attack_mode["ui"]["cartridgesVisible"], attack_mode
            colour_vision_matrix[mode]["attackDefense"] = identifier
        page.keyboard.up("KeyF")
        set_vision("full-colour")

        teleport(0, 4)
        page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
        teleport(0, 70)
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        result = capture("05-strong-plate-board", ["QA place through covered return", "Fort submission"])
        assert result["player"]["result"]["band"] == "strong-field-record", result
        assert result["player"]["result"]["evidence"] == 7, result
        assert result["ui"]["capturedPlateImages"] == [True, True, True, True], result
        for index, mode in enumerate(colour_vision_modes, start=13):
            set_vision(mode)
            identifier = f"{index:02d}-{mode}-strong-result"
            result_mode = capture(identifier, [f"Chromium {mode}", "Strong result checkpoint"])
            assert result_mode["mode"] == "terminal", result_mode
            assert result_mode["ui"]["terminal"]["title"] == "Strong field record", result_mode
            assert "7 evidence cues" in result_mode["ui"]["terminal"]["detail"], result_mode
            colour_vision_matrix[mode]["result"] = identifier
        set_vision("full-colour")

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        clean = capture("06-clean-restart", ["Take the route again"])
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
    assert len({visual["sha256"] for visual in visuals}) == len(visuals), visuals
    return {
        "stage": "s10-glade-clarity",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "protectedGladeSightline": True,
            "familyAndBasaltShareSunLane": True,
            "allFiveSubjectsCastShadows": True,
            "observationNoteClearsBeforeHeroFrame": True,
            "focusRegionPixelFloor": True,
            "youngPlayAndBranchPullRemainDistinct": True,
            "achromatopsiaAttackRetainsShapeAndToolState": True,
            "colourVisionCheckpointMatrixComplete": all(
                set(records) == {"order", "glade", "attackDefense", "result"}
                for records in colour_vision_matrix.values()
            ),
            "strongBoardUsesFourCapturedViews": True,
            "restartClearsCapturedViews": True,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "focusRegion": focus,
        "colourVisionMatrix": colour_vision_matrix,
        "visuals": visuals,
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "S10 uses QA placement to isolate visual states; S8 remains the input-only traversal and timing evidence.",
            "The focus-region pixel floor detects gross occlusion and flat exposure, not subjective composition quality.",
            "S8 provides the complete full-colour and achromatopsia input routes; S10 adds the required protanopia, deuteranopia and tritanopia review checkpoints.",
            "Chromium emulation and state assertions prepare a reproducible matrix, but an independent reviewer must still judge cue readability.",
            "Automated state and image checks do not replace independent anatomy, motion, premise or first-time player review.",
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
                "focusRegion": report["focusRegion"],
                "performance": report["performance"],
                "source": report["source"],
            },
            indent=2,
        )
    )
    print(f"S10 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
