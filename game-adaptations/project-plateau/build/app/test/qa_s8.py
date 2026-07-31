#!/usr/bin/env python3
"""Run reference paths and a full achromatopsia route with real input only."""

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
EVIDENCE = BUILD / "evidence" / "s8"
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
                    raise RuntimeError("Vite exited before S8 QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for S8 QA")


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
    for pattern, directory in (("*.json", STATE_DIR), ("*.json", BROWSER_DIR), ("*.jpg", EVIDENCE)):
        for stale in directory.glob(pattern):
            stale.unlink()
    errors: list[str] = []
    hosts: set[str] = set()
    checkpoints: list[dict[str, str]] = []
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
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        page.goto(f"{BASE_URL}/?qa=s8", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        assert page.evaluate("window.__projectPlateau.stage") in {"s8-input-paths", "s9-living-plates", "s10-glade-clarity"}
        vision_mode = "full-colour"

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            state_relative = f"build/evidence/s8/state/{identifier}.json"
            browser_relative = f"build/evidence/s8/browser/{identifier}.json"
            visual_relative = f"build/evidence/s8/{identifier}.jpg"
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
            page.screenshot(path=EVIDENCE / f"{identifier}.jpg", type="jpeg", quality=86)
            checkpoints.append(
                {"id": identifier, "state": state_relative, "browser": browser_relative, "visual": visual_relative}
            )
            return state

        def move_until(path: str, key: str, predicate: str, label: str, timeout: int = 30000) -> None:
            before = snapshot(page)["player"]
            started = time.monotonic()
            page.keyboard.down(key)
            try:
                page.wait_for_function(predicate, timeout=timeout)
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
            page.wait_for_timeout(60)
            clean = capture("00-clean-field-order", ["Enter the basin"])
            assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(100)
            state = snapshot(page)
            assert state["player"]["remainingLight"] <= 180, state
            return time.monotonic()

        def restart_path(checkpoint: str) -> float:
            page.get_by_role("button", name="Take the route again").click()
            page.wait_for_timeout(60)
            clean = capture(checkpoint, ["Take the route again"])
            assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(100)
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
            move_until(path, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 45", "Fort to brook")
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

        # Mixed: weaker covered view, one strong behavior frame, one shot and noisy creek.
        mixed_started = restart_path("06-strong-clean-restart")
        move_until("Mixed", "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 45", "Fort to brook")
        page.keyboard.press("KeyE")
        expose_plate("Mixed", 0, "partial tutorial frame")
        move_until("Mixed", "KeyA", "window.__projectPlateau.snapshot().player.position.x < 2.7", "choose canopy")
        move_until("Mixed", "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 18", "brook to canopy frame")
        expose_plate("Mixed", 1, "covered flank frame")
        move_until("Mixed", "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2", "canopy to glade")
        page.keyboard.press("KeyE")
        expose_plate("Mixed", 2, "single behavior frame")
        attack = capture("07-mixed-return-attack", ["three input-only frames", "attack begins"])
        assert attack["player"]["threatState"] == "attack", attack
        fire("Mixed")
        move_until("Mixed", "KeyD", "window.__projectPlateau.snapshot().player.position.x > 3.4", "line up exposed creek")
        move_until("Mixed", "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2", "commit exposed return")
        brook = capture("08-mixed-rifle-brook", ["F", "Left Mouse", "D to creek", "S into exposed return"])
        assert brook["player"]["returnRoute"] == "exposed", brook
        assert brook["player"]["returnCostSeconds"] == 18, brook
        assert brook["player"]["brookResponse"] == "brush-moving", brook
        move_until("Mixed", "KeyS", "window.__projectPlateau.snapshot().player.position.z >= 62", "creek return to Fort")
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        mixed = capture("09-mixed-input-result", ["S along the complete creek return to Fort"])
        assert mixed["player"]["result"]["band"] == "corroborating-record", mixed
        assert mixed["player"]["result"]["evidence"] == 4, mixed
        assert mixed["player"]["result"]["gunshotCallback"], mixed
        assert mixed["player"]["cartridges"] == 1, mixed
        finish_metrics("Mixed", mixed_started, mixed)

        # Panic: sprint, spend both rounds, expose all plates, take two contacts.
        panic_started = restart_path("10-mixed-clean-restart")
        page.keyboard.down("ShiftLeft")
        move_until("Panic", "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 18", "sprint Fort to shelf")
        page.keyboard.up("ShiftLeft")
        expose_plate("Panic", 0, "first immediate open frame")
        fire("Panic")
        expose_plate("Panic", 1, "second immediate open frame")
        fire("Panic")
        expose_plate("Panic", 2, "third immediate open frame")
        page.wait_for_function("window.__projectPlateau.snapshot().player.bodyMargin === 0", timeout=5000)
        first_contact = capture("11-panic-first-contact", ["sprint", "three open frames", "both rifle rounds", "wait for contact"])
        assert first_contact["player"]["contactCount"] == 1, first_contact
        assert first_contact["player"]["cartridges"] == 0, first_contact
        move_until("Panic", "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2", "continue to glade")
        expose_plate("Panic", 3, "fourth immediate frame without behavior read")
        move_until("Panic", "KeyD", "window.__projectPlateau.snapshot().player.position.x > 3.4", "line up creek")
        move_until("Panic", "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2", "take exposed creek")
        move_until(
            "Panic",
            "KeyS",
            "window.__projectPlateau.snapshot().player.runStatus !== 'active'",
            "continue without cover discipline",
            timeout=8000,
        )
        panic = capture("12-panic-input-failure", ["fourth open frame", "exposed creek", "continue after body margin is gone"])
        assert panic["player"]["runStatus"] == "failure", panic
        assert panic["player"]["failureCause"] == "second-unblocked-strike", panic
        assert panic["player"]["contactCount"] == 2 and panic["player"]["shotCount"] == 2, panic
        finish_metrics("Panic", panic_started, panic)

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        clean = capture("13-panic-clean-restart", ["Take the route again"])
        assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
        assert clean["player"]["distanceTravelled"] == 0, clean

        # Repeat the complete Strong route with Chromium's achromatopsia
        # emulation. This is input/state evidence; an independent reviewer still
        # decides whether the visual cues are perceptually sufficient.
        vision_mode = "achromatopsia"
        cdp.send("Emulation.setEmulatedVisionDeficiency", {"type": vision_mode})
        achrom_order = capture("14-achromatopsia-field-order", ["Chromium achromatopsia"])
        assert achrom_order["mode"] == "order", achrom_order
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)
        achrom_started = time.monotonic()
        achrom = run_strong_path(
            "Achromatopsia Strong",
            achrom_started,
            (
                "15-achromatopsia-brook-frame",
                "16-achromatopsia-basalt-frame",
                "17-achromatopsia-glade-frames",
                "18-achromatopsia-covered-return",
                "19-achromatopsia-input-result",
            ),
        )
        assert achrom["player"]["result"]["band"] == "strong-field-record", achrom
        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        achrom_restart = capture("20-achromatopsia-clean-restart", ["Take the route again"])
        assert achrom_restart["mode"] == "order", achrom_restart
        assert achrom_restart["player"]["distanceTravelled"] == 0, achrom_restart

        vision_mode = "full-colour"
        cdp.send("Emulation.setEmulatedVisionDeficiency", {"type": "none"})
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
        "stage": "s8-input-paths",
        "source": {"scope": "index.html, package manifests, public assets and src", "sha256": fingerprint()},
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
            "mixedOneShotNoisyCreekAndCallback": True,
            "mixedCorroboratingEvidenceFour": True,
            "panicBothShotsAllPlatesAndSecondContact": True,
            "cleanRestartAfterEveryReferenceClass": True,
            "achromatopsiaStrongInputRoute": True,
            "achromatopsiaStrongCleanRestart": True,
            "noThreatMeter": no_threat_meter,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
        },
        "verbEvidenceMatrix": {
            "traverse": "Strong input trace + 05-strong-input-result",
            "observe": "01-strong-brook-frame + 03-strong-glade-frames",
            "commitExposedObjective": "02-strong-basalt-frame + 03-strong-glade-frames",
            "evadeOrDefend": "04-strong-covered-return",
            "reachRelativeSafety": "05-strong-input-result",
        },
        "pathMetrics": path_metrics,
        "visionRoutes": {
            "full-colour": [
                "00-clean-field-order",
                "01-strong-brook-frame",
                "03-strong-glade-frames",
                "04-strong-covered-return",
                "05-strong-input-result",
                "06-strong-clean-restart",
            ],
            "achromatopsia": [
                "14-achromatopsia-field-order",
                "15-achromatopsia-brook-frame",
                "17-achromatopsia-glade-frames",
                "18-achromatopsia-covered-return",
                "19-achromatopsia-input-result",
                "20-achromatopsia-clean-restart",
            ],
        },
        "inputTrace": input_trace,
        "performance": performance,
        "checkpoints": checkpoints,
        "limitations": [
            "The paths use real keyboard/mouse movement and wait on observed state, but they are deterministic automation rather than first-time human navigation evidence.",
            "S8 validates the reconciled 1–3 minute product budget; independent perception and three external tester records remain required.",
            "The Strong path records distinct young-play and branch-pull states, but automated pose checks do not establish anatomy or animation quality.",
            "Chromium emulation plus deterministic input proves route and UI state continuity; it does not prove that a person can distinguish every visual cue.",
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
                "source": report["source"],
            },
            indent=2,
        )
    )
    print(f"S8 PASS: {output.relative_to(BUILD.parent)}")


if __name__ == "__main__":
    main()
