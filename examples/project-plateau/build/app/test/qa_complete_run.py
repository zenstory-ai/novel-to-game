#!/usr/bin/env python3
"""Run one real-input Project Plateau path from clean start through restart."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import time
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence/current-run"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4183")
PORT = urlparse(BASE_URL).port or 4183
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def start_server() -> subprocess.Popen[str] | None:
    with socket.socket() as probe:
        try:
            probe.connect((urlparse(BASE_URL).hostname or "127.0.0.1", PORT))
            return None
        except OSError:
            pass
    # Play the deployed build, not the dev server.
    subprocess.run(["npm", "run", "build"], cwd=APP, check=True, stdout=subprocess.DEVNULL)
    process = subprocess.Popen(
        ["npx", "vite", "preview", "--host", "127.0.0.1", "--port", str(PORT), "--strictPort"],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    for _ in range(300):
        with socket.socket() as probe:
            try:
                probe.connect(("127.0.0.1", PORT))
                return process
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Vite preview exited before complete-run QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite preview did not become ready for complete-run QA")


def snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def compact_state(state: dict[str, Any]) -> dict[str, Any]:
    player = state["player"]
    plates = player["plates"]
    result = player["result"]
    plate_state: dict[str, Any] = {
        "position": player["position"],
        "remainingLight": player["remainingLight"],
        "distanceTravelled": player["distanceTravelled"],
        "plateStatus": [plate["status"] for plate in plates],
        "platePoints": [plate["points"] for plate in plates],
        "bodyMargin": player["bodyMargin"],
        "returnRoute": player["returnRoute"],
        "runStatus": player["runStatus"],
        "resultBand": result["band"] if result else None,
    }
    if any(plate["frameKey"] for plate in plates):
        plate_state["plateFrames"] = [plate["frameKey"] for plate in plates]
        plate_state["plateBehaviors"] = [plate["behavior"] for plate in plates]
    return {
        "mode": state["mode"],
        "sceneChildren": state["sceneChildren"],
        "player": plate_state,
    }


def run() -> dict[str, Any]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for stale in EVIDENCE.glob("*.jpg"):
        stale.unlink()

    errors: list[str] = []
    checkpoints: list[dict[str, Any]] = []
    input_trace: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=str(CHROME) if CHROME.exists() else None,
        )
        recovery_page = browser.new_page(viewport={"width": 1440, "height": 900})
        aborted_required_asset = False

        def interrupt_first_required_asset(route: Any) -> None:
            nonlocal aborted_required_asset
            if not aborted_required_asset:
                aborted_required_asset = True
                route.abort()
                return
            route.continue_()

        required_asset_pattern = "**/iguanodon-hy3d-v35-stylized.glb"
        recovery_page.route(required_asset_pattern, interrupt_first_required_asset)
        recovery_page.goto(f"{BASE_URL}/?qa=asset-recovery", wait_until="networkidle")
        recovery_page.locator("#runtime-error").wait_for(state="visible")
        assert aborted_required_asset
        assert recovery_page.evaluate("window.__projectPlateau.ready") is False
        assert recovery_page.locator("body").get_attribute("data-mode") == "runtime-error"
        recovery_page.unroute(required_asset_pattern, interrupt_first_required_asset)
        recovery_page.get_by_role("button", name="Check the case again").click()
        recovery_page.wait_for_function("window.__projectPlateau?.ready === true")
        assert recovery_page.locator("#runtime-error").is_hidden()
        assert recovery_page.locator("body").get_attribute("data-mode") == "order"
        asset_recovery = {
            "requiredAssetRequest": "iguanodon-hy3d-v35-stylized.glb",
            "failureState": "runtime-error-ready-false",
            "retryState": "order-ready-after-render",
        }
        recovery_page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error" or "GL_INVALID_" in message.text
            else None,
        )
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.goto(f"{BASE_URL}/?qa=complete-run", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") == "current-complete-run"
        assert page.locator("body").get_attribute("data-mode") == "title"

        def capture(identifier: str, inputs: list[str]) -> dict[str, Any]:
            state = snapshot(page)
            image = EVIDENCE / f"{identifier}.jpg"
            page.screenshot(path=image, type="jpeg", quality=84)
            checkpoints.append(
                {
                    "id": identifier,
                    "inputs": inputs,
                    "state": compact_state(state),
                    "visual": image.relative_to(BUILD.parent).as_posix(),
                }
            )
            return state

        def turn_until(key: str, predicate: str, purpose: str) -> None:
            page.keyboard.down(key)
            try:
                page.wait_for_function(predicate, timeout=10000)
            finally:
                page.keyboard.up(key)
            input_trace.append(f"{key}: {purpose}")

        def move_until(key: str, predicate: str, purpose: str) -> None:
            before = snapshot(page)["player"]
            page.keyboard.down(key)
            try:
                page.wait_for_function(predicate, timeout=90000)
            finally:
                page.keyboard.up(key)
            page.wait_for_timeout(70)
            after = snapshot(page)["player"]
            assert before["position"] != after["position"]
            input_trace.append(f"{key}: {purpose}")

        def expose_plate(index: int, purpose: str) -> None:
            page.mouse.move(720, 450)
            page.mouse.down(button="right")
            page.wait_for_timeout(60)
            page.mouse.click(720, 450, button="left")
            page.mouse.up(button="right")
            page.wait_for_function(
                f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                timeout=12000,
            )
            input_trace.append(f"Right Mouse + Left Mouse: {purpose}")

        def wait_for_cover(purpose: str) -> None:
            page.keyboard.down("KeyC")
            try:
                page.wait_for_function(
                    "window.__projectPlateau.snapshot().player.threatAwareness <= 2",
                    timeout=8000,
                )
            finally:
                page.keyboard.up("KeyC")
            input_trace.append(f"hold KeyC under cover: {purpose}")

        def wait_for_family_moment(moment: str, window_end: float) -> None:
            # Do not accept a matching label at the tail of its window: the
            # authoritative path must leave the full two-second exposure plus
            # a small input/render margin before the behavior changes.
            latest_start = window_end - 2.25
            page.wait_for_function(
                """([moment, latestStart]) => {
                    const player = window.__projectPlateau.snapshot().player;
                    return player.familyMoment === moment
                        && player.familyBehaviorSeconds <= latestStart;
                }""",
                arg=[moment, latest_start],
                timeout=10000,
            )

        page.get_by_role("button", name="Follow the spoor").click()
        page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'")
        clean_start = capture("00-clean-start", ["Follow the spoor"])
        assert clean_start["player"]["remainingLight"] == 300
        assert clean_start["sceneChildren"] > 0

        page.get_by_role("button", name="Shoulder the case").click()
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= 45",
            "reach the brook",
        )
        page.keyboard.press("KeyE")
        expose_plate(0, "record the brook")
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= 18",
            "reach the basalt shelf",
        )
        expose_plate(1, "record basalt scale")
        move_until(
            "KeyA",
            "window.__projectPlateau.snapshot().player.position.x < -3.0",
            "step under the thorn arches",
        )
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= 2",
            "follow the thorn band to the glade",
        )
        page.keyboard.press("KeyE")
        move_until(
            "KeyD",
            "window.__projectPlateau.snapshot().player.position.x > -2.2",
            "keep to the band as it bends toward the glade",
        )
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= -9",
            "settle in the glade-edge blind",
        )
        capture("01-field-glade", ["settle in the glade-edge blind"])
        wait_for_family_moment("glade-young-play", 4.6)
        expose_plate(2, "record young at play from the blind")
        wait_for_cover("crouch until the wings lose interest")
        turn_until(
            "ArrowRight",
            "window.__projectPlateau.snapshot().player.heading <= -0.42",
            "turn to the feeding adult",
        )
        wait_for_family_moment("glade-branch-pull", 9.0)
        expose_plate(3, "record branch pulling from the blind")
        wait_for_cover("let the wings lose interest")
        turn_until(
            "ArrowLeft",
            "window.__projectPlateau.snapshot().player.heading >= -0.05",
            "face the glade again",
        )
        move_until(
            "KeyA",
            "window.__projectPlateau.snapshot().player.position.x < -3.2",
            "step back to the thorn band's centre",
        )
        move_until(
            "KeyS",
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            "back up the thorn band to Fort",
        )

        outcome = capture("02-designed-outcome", ["complete the covered route"])
        assert outcome["player"]["returnRoute"] == "covered", outcome["player"]["returnRoute"]
        plates = [(plate["frameKey"], plate["points"], plate["status"]) for plate in outcome["player"]["plates"]]
        assert sum(points for _, points, _ in plates) == 7, plates
        assert [plate["behavior"] for plate in outcome["player"]["plates"] if plate["behavior"]] == [
            "young-play",
            "branch-pull",
        ]
        assert outcome["player"]["runStatus"] == "result"
        assert outcome["player"]["result"]["band"] == "strong-field-record"
        assert outcome["player"]["distanceTravelled"] > 0

        page.get_by_role("button", name="Walk the bend again").click()
        page.wait_for_timeout(80)
        restart = capture("03-clean-restart", ["Walk the bend again"])
        assert restart["mode"] == "order"
        assert restart["player"]["remainingLight"] == 300
        assert restart["player"]["distanceTravelled"] == 0
        assert not errors, errors
        browser_version = browser.version
        browser.close()

    launch, render, outcome_observation, restart_observation = checkpoints
    launch["state"]["assetRecovery"] = asset_recovery
    outcome_observation["state"]["terminal"] = outcome["player"]["result"]["band"]
    restart_observation["state"]["restart"] = "clean-field-order"
    plates = outcome["player"]["plates"]
    return {
        "schemaVersion": 1,
        "runId": "project-plateau-main-path",
        "environment": {"browser": browser_version, "viewport": [1440, 900], "baseUrl": BASE_URL},
        "inputTrace": input_trace,
        "observations": {
            "launch": launch,
            "render": render,
            "input": {
                "id": "field-input-trace",
                "inputs": input_trace,
                "state": {"distanceTravelled": outcome["player"]["distanceTravelled"]},
            },
            "coreLoop": {
                "id": "glade-behaviors",
                "inputs": [step for step in input_trace if "from the blind" in step],
                "state": {
                    "runStatus": outcome["player"]["runStatus"],
                    "evidencePoints": sum(plate["points"] for plate in plates),
                    "distinctBehaviors": [plate["behavior"] for plate in plates if plate["behavior"]],
                },
            },
            "outcome": outcome_observation,
            "restart": restart_observation,
        },
    }

def main() -> None:
    server = start_server()
    output = EVIDENCE / "report.json"
    try:
        report = run()
    except Exception as error:
        # Say what actually failed, not the placeholder written before the run.
        output.write_text(json.dumps({
            "stage": "current-complete-run",
            "failure": f"{type(error).__name__}: {error}"[:2000],
        }, indent=2) + "\n", encoding="utf-8")
        raise
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"CURRENT RUN PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
