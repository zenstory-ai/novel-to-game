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
EVIDENCE = Path(
    os.environ.get("PLATEAU_EVIDENCE_DIR", BUILD / "evidence/current-run")
).expanduser().resolve()
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def start_server() -> subprocess.Popen[str] | None:
    parsed = urlparse(BASE_URL)
    with socket.socket() as probe:
        try:
            probe.connect(
                (
                    parsed.hostname or "127.0.0.1",
                    parsed.port or (443 if parsed.scheme == "https" else 4173),
                )
            )
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


def snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def compact_state(state: dict[str, Any]) -> dict[str, Any]:
    player = state["player"]
    plates = player["plates"]
    result = player["result"]
    return {
        "mode": state["mode"],
        "sceneChildren": state["sceneChildren"],
        "triangles": state["triangles"],
        "player": {
            "position": player["position"],
            "remainingLight": player["remainingLight"],
            "distanceTravelled": player["distanceTravelled"],
            "plateStatus": [plate["status"] for plate in plates],
            "platePoints": [plate["points"] for plate in plates],
            "bodyMargin": player["bodyMargin"],
            "returnRoute": player["returnRoute"],
            "runStatus": player["runStatus"],
            "resultBand": result["band"] if result else None,
        },
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

        def move_until(key: str, predicate: str, purpose: str) -> None:
            before = snapshot(page)["player"]
            page.keyboard.down(key)
            try:
                page.wait_for_function(predicate, timeout=30000)
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
                timeout=3500,
            )
            input_trace.append(f"Right Mouse + Left Mouse: {purpose}")

        def wait_for_cover(purpose: str) -> None:
            page.wait_for_function(
                "window.__projectPlateau.snapshot().player.threatAwareness <= 2",
                timeout=8000,
            )
            input_trace.append(f"hold position: {purpose}")

        page.get_by_role("button", name="Enter the basin").click()
        page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'")
        clean_start = capture("00-clean-start", ["Enter the basin"])
        assert clean_start["player"]["remainingLight"] == 180
        assert clean_start["sceneChildren"] > 0 and clean_start["triangles"] > 0

        page.get_by_role("button", name="Begin field work").click()
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
            "window.__projectPlateau.snapshot().player.position.x < 2.7",
            "enter canopy cover",
        )
        wait_for_cover("let the attack widen")
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= 2",
            "reach the glade",
        )
        page.keyboard.press("KeyE")
        expose_plate(2, "record young at play")
        move_until(
            "KeyS",
            "window.__projectPlateau.snapshot().player.position.z > 3.2",
            "protect the first behavior plate",
        )
        wait_for_cover("break the dive")
        move_until(
            "KeyW",
            "window.__projectPlateau.snapshot().player.position.z <= 2",
            "return for the second behavior plate",
        )
        expose_plate(3, "record branch pulling")
        move_until(
            "KeyS",
            "window.__projectPlateau.snapshot().player.position.z > 3.2",
            "retreat into cover",
        )
        wait_for_cover("prepare the covered return")
        move_until(
            "KeyS",
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            "return to Fort",
        )

        outcome = capture("01-designed-outcome", ["complete the covered route"])
        assert sum(plate["points"] for plate in outcome["player"]["plates"]) == 7
        assert outcome["player"]["runStatus"] == "result"
        assert outcome["player"]["result"]["band"] == "strong-field-record"
        assert outcome["player"]["distanceTravelled"] > 0

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        restart = capture("02-clean-restart", ["Take the route again"])
        assert restart["mode"] == "order"
        assert restart["player"]["remainingLight"] == 180
        assert restart["player"]["distanceTravelled"] == 0
        assert not errors, errors
        browser_version = browser.version
        browser.close()

    clean_observation, outcome_observation, restart_observation = checkpoints
    outcome_observation = {
        **outcome_observation,
        "state": {
            **outcome_observation["state"],
            "terminal": outcome["player"]["result"]["band"],
        },
    }
    restart_observation = {
        **restart_observation,
        "state": {
            **restart_observation["state"],
            "restart": "clean-field-order",
        },
    }
    return {
        "schemaVersion": 1,
        "runId": "project-plateau-main-path",
        "environment": {
            "browser": browser_version,
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "inputTrace": input_trace,
        "observations": {
            "launch": clean_observation,
            "render": outcome_observation,
            "input": {
                "id": "field-input-trace",
                "inputs": input_trace,
                "state": {
                    "acceptedInputCount": len(input_trace),
                    "distanceTravelled": outcome["player"]["distanceTravelled"],
                },
            },
            "coreLoop": {
                "id": "completed-field-loop",
                "inputs": ["record four plates", "return to Fort"],
                "state": {
                    "runStatus": outcome["player"]["runStatus"],
                    "evidencePoints": sum(
                        plate["points"] for plate in outcome["player"]["plates"]
                    ),
                },
            },
            "outcome": outcome_observation,
            "restart": restart_observation,
        },
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
    print(f"CURRENT RUN PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
