#!/usr/bin/env python3
"""Run one complete strong-result path with real input only."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright

from _qa_assertions import ROUTE_INPUT_CONTINUATION_MS, route_input_calibration

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = Path(
    os.environ.get("PLATEAU_EVIDENCE_DIR", BUILD / "evidence" / "current-run")
).expanduser().resolve()
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def start_server() -> subprocess.Popen[str] | None:
    parsed = urlparse(BASE_URL)
    with socket.socket() as probe:
        try:
            default_port = 443 if parsed.scheme == "https" else 4173
            probe.connect((parsed.hostname or "127.0.0.1", parsed.port or default_port))
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
                    raise RuntimeError("Vite exited before complete-run QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for complete-run QA")


def snapshot(page: Page) -> dict[str, object]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def semantic_state(state: dict[str, object]) -> dict[str, object]:
    """Keep only player-visible state needed to explain a checkpoint."""
    player = state["player"]
    return {
        "mode": state["mode"],
        "stage": state["stage"],
        "viewport": state["viewport"],
        "sceneChildren": state["sceneChildren"],
        "triangles": state["triangles"],
        "cameraMode": state["cameraMode"],
        "pointerLock": state["pointerLock"],
        "presentationSettings": state["presentationSettings"],
        "player": {
            name: player[name]
            for name in (
                "position",
                "zone",
                "remainingLight",
                "elapsedSeconds",
                "distanceTravelled",
                "plates",
                "shotCount",
                "cartridges",
                "bodyMargin",
                "returnRoute",
                "runStatus",
                "result",
            )
        },
    }


def evidence_reference(path: Path) -> str:
    try:
        return path.relative_to(BUILD.parent).as_posix()
    except ValueError:
        return path.as_posix()


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for stale in EVIDENCE.glob("*.jpg"):
        stale.unlink()
    errors: list[str] = []
    checkpoints: list[dict[str, object]] = []
    input_trace: list[dict[str, object]] = []
    path_metrics: dict[str, dict[str, object]] = {}

    # The runner may observe the QA snapshot but may not invoke either state-shortcut hook.
    runner_source = Path(__file__).read_text(encoding="utf-8")
    forbidden_hooks = ["teleport" + "ForTest", "advance" + "TimeForTest"]
    assert all(hook not in runner_source for hook in forbidden_hooks)

    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        cdp = page.context.new_cdp_session(page)
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.goto(f"{BASE_URL}/?qa=complete-run", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") == "current-complete-run"
        page.get_by_role("button", name="Settings").click()
        page.locator("#reduced-motion").check()
        page.locator("#captions-enabled").uncheck()
        page.locator("#text-scale").select_option("1.5")
        accessibility = page.evaluate(
            """
            () => ({
              settings: window.__projectPlateau.snapshot().presentationSettings,
              reducedMotionClass: document.body.classList.contains('reduced-motion'),
              textScale: document.documentElement.dataset.textScale,
              horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            })
            """
        )
        assert accessibility["settings"]["reducedMotion"] is True, accessibility
        assert accessibility["settings"]["captionsEnabled"] is False, accessibility
        assert accessibility["textScale"] == "1.5", accessibility
        assert accessibility["reducedMotionClass"] is True, accessibility
        assert accessibility["horizontalOverflow"] is False, accessibility
        page.locator("#settings-reset").click()
        reset_settings = page.evaluate(
            "window.__projectPlateau.snapshot().presentationSettings"
        )
        assert reset_settings["textScale"] == "1", reset_settings
        assert reset_settings["captionsEnabled"] is True, reset_settings
        page.get_by_role("button", name="Close settings").click()
        vision_mode = "full-colour"

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            visual_path = EVIDENCE / f"{identifier}.jpg"
            viewport = page.viewport_size or {"width": 0, "height": 0}
            browser_record = {
                "inputs": inputs,
                "viewport": [viewport["width"], viewport["height"]],
                "visionMode": vision_mode,
                "url": page.url,
                "consoleErrorsAtCheckpoint": list(errors),
            }
            page.screenshot(path=visual_path, type="jpeg", quality=86)
            checkpoints.append(
                {
                    "id": identifier,
                    "inputs": inputs,
                    "state": semantic_state(state),
                    "browser": browser_record,
                    "visual": evidence_reference(visual_path),
                }
            )
            return state

        def move_until(
            path: str,
            key: str,
            predicate: str,
            label: str,
            timeout: int = 30000,
            continuation_ms: int = 0,
        ) -> None:
            before = snapshot(page)["player"]
            started = time.monotonic()
            page.keyboard.down(key)
            try:
                page.wait_for_function(predicate, timeout=timeout)
                if continuation_ms:
                    route_input_calibration(key, continuation_ms)
                    page.keyboard.down("KeyC")
                    try:
                        page.wait_for_timeout(continuation_ms)
                    finally:
                        page.keyboard.up("KeyC")
            finally:
                page.keyboard.up(key)
            page.wait_for_timeout(70)
            after = snapshot(page)["player"]
            input_trace.append(
                {
                    "path": path,
                    "input": key,
                    "purpose": label,
                    "wallSeconds": round(time.monotonic() - started, 3),
                    "start": before["position"],
                    "end": after["position"],
                    "distanceAfter": after["distanceTravelled"],
                    **(route_input_calibration(key, continuation_ms) if continuation_ms else {}),
                }
            )

        def expose_plate(path: str, index: int, label: str) -> dict[str, object]:
            started = time.monotonic()
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
            page.wait_for_timeout(70)
            state = snapshot(page)
            input_trace.append(
                {
                    "path": path,
                    "input": "Right Mouse + Left Mouse",
                    "purpose": label,
                    "wallSeconds": round(time.monotonic() - started, 3),
                    "plate": index + 1,
                    "frame": state["player"]["plates"][index]["frameKey"],
                    "points": state["player"]["plates"][index]["points"],
                }
            )
            return state

        def wait_for_cover(path: str, label: str) -> None:
            before = snapshot(page)["player"]
            started = time.monotonic()
            page.wait_for_function(
                "window.__projectPlateau.snapshot().player.threatAwareness <= 2",
                timeout=8000,
            )
            after = snapshot(page)["player"]
            input_trace.append(
                {
                    "path": path,
                    "input": "hold position under cover",
                    "purpose": label,
                    "wallSeconds": round(time.monotonic() - started, 3),
                    "awarenessBefore": before["threatAwareness"],
                    "awarenessAfter": after["threatAwareness"],
                }
            )

        def fire(path: str) -> dict[str, object]:
            started = time.monotonic()
            before = snapshot(page)["player"]["shotCount"]
            page.keyboard.down("KeyF")
            page.wait_for_timeout(60)
            page.mouse.click(720, 450, button="left")
            page.keyboard.up("KeyF")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.shotCount === {before + 1}",
                timeout=1000,
            )
            page.wait_for_timeout(80)
            state = snapshot(page)
            input_trace.append(
                {
                    "path": path,
                    "input": "F + Left Mouse",
                    "purpose": "interrupt committed dive",
                    "wallSeconds": round(time.monotonic() - started, 3),
                    "shotCount": state["player"]["shotCount"],
                    "cartridges": state["player"]["cartridges"],
                }
            )
            return state

        def begin_first_path() -> float:
            page.get_by_role("button", name="Enter the basin").click()
            page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
            page.wait_for_timeout(60)
            clean = capture("00-clean-field-order", ["Enter the basin"])
            assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(100)
            state = snapshot(page)
            assert state["player"]["remainingLight"] <= 180, state
            return time.monotonic()

        def finish_metrics(path: str, started: float, state: dict[str, object]) -> None:
            player = state["player"]
            path_metrics[path] = {
                "wallSeconds": round(time.monotonic() - started, 3),
                "simulationSeconds": player["elapsedSeconds"],
                "distanceTravelled": player["distanceTravelled"],
                "remainingLight": player["remainingLight"],
                "returnCostSeconds": player["returnCostSeconds"],
                "route": player["returnRoute"],
                "result": player["result"],
                "visionMode": vision_mode,
            }

        def run_strong_path(
            path: str,
            started: float,
            identifiers: tuple[str, str, str, str, str],
        ) -> dict[str, object]:
            brook_id, basalt_id, glade_id, covered_id, result_id = identifiers
            move_until(
                path,
                "KeyW",
                "window.__projectPlateau.snapshot().player.position.z <= 45",
                "Fort to brook",
                continuation_ms=ROUTE_INPUT_CONTINUATION_MS if path == "Strong" else 0,
            )
            page.keyboard.press("KeyE")
            expose_plate(path, 0, "partial tutorial frame")
            partial = capture(brook_id, ["W to brook", "E", "camera commitment"])
            assert partial["player"]["plates"][0]["points"] == 1, partial
            move_until(path, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 18", "brook to basalt")
            expose_plate(path, 1, "basalt scale frame")
            basalt = capture(basalt_id, ["W to basalt", "camera commitment"])
            assert basalt["player"]["plates"][1]["points"] == 2, basalt
            move_until(path, "KeyA", "window.__projectPlateau.snapshot().player.position.x < 2.7", "enter canopy")
            wait_for_cover(path, "widen the attack before glade")
            move_until(path, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2", "canopy to glade")
            page.keyboard.press("KeyE")
            expose_plate(path, 2, "young-at-play frame")
            move_until(
                path,
                "KeyS",
                "window.__projectPlateau.snapshot().player.position.z > 3.2",
                "protect first behavior plate",
            )
            wait_for_cover(path, "break the dive between behavior frames")
            move_until(
                path,
                "KeyW",
                "window.__projectPlateau.snapshot().player.position.z <= 2",
                "return for second behavior frame",
            )
            expose_plate(path, 3, "branch-pull frame")
            glade = capture(glade_id, ["W to glade", "E", "two camera commitments"])
            assert sum(plate["points"] for plate in glade["player"]["plates"]) == 7, glade
            assert [plate["frameKey"] for plate in glade["player"]["plates"][2:]] == [
                "glade-young-play",
                "glade-branch-pull",
            ], glade
            move_until(path, "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2", "retreat into cover")
            wait_for_cover(path, "break the final dive")
            covered = capture(covered_id, ["S into cover", "hold until wider pass"])
            assert covered["player"]["returnRoute"] == "covered", covered
            move_until(
                path,
                "KeyS",
                "window.__projectPlateau.snapshot().player.runStatus === 'result'",
                "covered return through the Fort gate",
            )
            strong = capture(result_id, ["S along the complete return to Fort"])
            assert strong["player"]["result"]["band"] == "strong-field-record", strong
            assert strong["player"]["result"]["evidence"] == 7, strong
            assert strong["player"]["shotCount"] == 0 and strong["player"]["bodyMargin"] == 1, strong
            assert 30 <= strong["player"]["remainingLight"] <= 120, strong
            finish_metrics(path, started, strong)
            return strong

        # Strong: four real exposures, two cover reads, covered return, no shot.
        strong_started = begin_first_path()
        run_strong_path(
            "Strong",
            strong_started,
            (
                "01-strong-brook-frame",
                "02-strong-basalt-frame",
                "03-strong-glade-frames",
                "04-strong-covered-return",
                "05-strong-input-result",
            ),
        )

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        clean = capture("06-strong-clean-restart", ["Take the route again"])
        assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
        assert clean["player"]["distanceTravelled"] == 0, clean
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(80)
        performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
        assert performance["medianFps"] >= 45 and performance["onePercentLowFps"] >= 30, performance
        no_threat_meter = page.locator("[data-threat-meter]").count() == 0
        browser.close()

    assert not errors, errors
    return {
        "stage": "current-complete-run",
        "environment": {
            "browser": "Google Chrome 150.0.7871.187" if CHROME.exists() else "Playwright Chromium",
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "checks": {
            "noTeleportOrDirectTimeAdvance": True,
            "strongAllFiveVerbsNoShot": True,
            "strongEvidenceSevenAndBodyMargin": True,
            "strongDistinctBehaviorFrames": True,
            "strongRemainingLightWithinReferenceWindow": True,
            "cleanRestartAfterStrongResult": True,
            "accessibilityModesAppliedAndReset": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
        },
        "verbEvidenceMatrix": {
            "traverse": "Strong input trace + 05-strong-input-result",
            "observe": "01-strong-brook-frame + 03-strong-glade-frames",
            "commitExposedObjective": "02-strong-basalt-frame + 03-strong-glade-frames",
            "evadeOrDefend": "04-strong-covered-return",
            "reachRelativeSafety": "05-strong-input-result",
        },
        "pathMetrics": path_metrics,
        "accessibility": accessibility,
        "inputTrace": input_trace,
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "The paths use real keyboard/mouse movement and wait on observed state, but they are deterministic automation rather than first-time human navigation evidence.",
            "The run validates the reconciled 1–3 minute product budget; independent first-time perception is outside smoke assurance.",
            "The Strong path records distinct young-play and branch-pull states, but automated pose checks do not establish anatomy or animation quality.",
            "Subjective fun, balance and audio mix are not inferred from the deterministic results.",
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
                "pathMetrics": report["pathMetrics"],
                "performance": report["performance"],
            },
            indent=2,
        )
    )
    print(f"CURRENT RUN PASS: {evidence_reference(output)}")


if __name__ == "__main__":
    main()
