#!/usr/bin/env python3
"""Verify the browser controller contract through the real DOM event boundary."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "controller"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

POINTER_LOCK_SHIM = """
(() => {
  let lockedElement = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return lockedElement; },
  });
  HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
    lockedElement = this;
    document.dispatchEvent(new Event('pointerlockchange'));
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function exitPointerLock() {
    lockedElement = null;
    document.dispatchEvent(new Event('pointerlockchange'));
  };
})();
"""

POINTER_LOCK_REJECTION = """
(() => {
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return null; },
  });
  HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
    const error = new DOMException('Pointer lock denied by the browser', 'NotAllowedError');
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockerror')));
    return Promise.reject(error);
  };
})();
"""

HY3D_ASSETS_READY = """
() => {
  const assets = window.__projectPlateau.snapshot().assets;
  return assets.family.visualStatus === 'hy3d-family-ready'
    && assets.pterodactyl.visualStatus === 'hy3d-flock-ready'
    && assets.fieldCamera.visualStatus === 'hy3d-field-camera-ready'
    && assets.rifle.visualStatus === 'hy3d-rifle-ready';
}
"""


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
                    raise RuntimeError("Vite exited before the controller check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the controller check")


def enter_field(page) -> None:
    # `ready` exposes the QA API while HY3D parsing is still asynchronous. On Linux's
    # software renderer, clicking during that work can block Playwright's action
    # acknowledgement even though the button itself is visible and enabled.
    page.wait_for_function(HY3D_ASSETS_READY, timeout=120_000)
    page.get_by_role("button", name="Enter the basin").click()
    page.get_by_role("button", name="Begin field work").click()
    page.wait_for_timeout(180)


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    server = start_server()
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            if CHROME.exists():
                launch["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**launch)

            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.add_init_script(POINTER_LOCK_SHIM)
            page = context.new_page()
            page.goto(f"{BASE_URL}/?qa=controller", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")

            page.keyboard.down("KeyW")
            enter_field(page)
            origin = page.evaluate("window.__projectPlateau.snapshot()")
            page.wait_for_timeout(420)
            held = page.evaluate("window.__projectPlateau.snapshot()")
            page.keyboard.up("KeyW")
            assert held["player"]["position"] == origin["player"]["position"], held
            assert held["pointerLock"]["active"] is True, held

            page.evaluate(
                "document.dispatchEvent(new MouseEvent('mousemove', "
                "{movementX: 120, movementY: -20}))"
            )
            page.wait_for_timeout(80)
            turned = page.evaluate("window.__projectPlateau.snapshot()")
            assert turned["player"]["heading"] < -0.23, turned
            assert turned["player"]["pitch"] > 0.03, turned
            camera_forward = turned["pointerLock"]["cameraForward"]
            heading = turned["player"]["heading"]
            assert abs(camera_forward["x"] + math.sin(heading)) < 0.002, turned
            assert abs(camera_forward["z"] + math.cos(heading)) < 0.002, turned

            before_move = turned["player"]["position"]
            page.keyboard.down("KeyW")
            page.wait_for_function(
                "({ before, forward }) => {"
                "  const position = window.__projectPlateau.snapshot().player.position;"
                "  const dx = position.x - before.x;"
                "  const dz = position.z - before.z;"
                "  return dx * forward.x + dz * forward.z > 0.03;"
                "}",
                arg={"before": before_move, "forward": camera_forward},
                timeout=5_000,
            )
            page.keyboard.up("KeyW")
            moved = page.evaluate("window.__projectPlateau.snapshot()")
            delta = {
                "x": moved["player"]["position"]["x"] - before_move["x"],
                "z": moved["player"]["position"]["z"] - before_move["z"],
            }
            forward_projection = delta["x"] * camera_forward["x"] + delta["z"] * camera_forward["z"]
            lateral_drift = abs(delta["x"] * camera_forward["z"] - delta["z"] * camera_forward["x"])
            assert forward_projection > 0.03, moved
            assert lateral_drift < 0.02, moved

            page.keyboard.press("Space")
            page.wait_for_timeout(110)
            airborne = page.evaluate("window.__projectPlateau.snapshot()")
            assert airborne["player"]["grounded"] is False, airborne
            assert airborne["player"]["verticalOffset"] > 0.35, airborne
            assert airborne["player"]["verticalVelocity"] > 0, airborne
            page.evaluate("window.__projectPlateau.advanceTimeForTest(2)")
            landed = page.evaluate("window.__projectPlateau.snapshot()")
            assert landed["player"]["verticalOffset"] == 0, landed
            assert landed["player"]["verticalVelocity"] == 0, landed

            page.evaluate("window.__projectPlateau.setThreatVisualForTest(2, null)")
            page.set_viewport_size({"width": 1000, "height": 600})
            page.evaluate("window.__projectPlateau.freezeVisualForTest(4.25, false)")
            camera_lowered_threat = page.evaluate(
                "window.__projectPlateau.snapshot().threatVisual"
            )
            page.mouse.down(button="right")
            assert page.evaluate("window.__projectPlateau.snapshot().player.cameraRaised") is True
            page.evaluate("window.__projectPlateau.freezeVisualForTest(4.25, false)")
            camera_raised_threat = page.evaluate(
                "window.__projectPlateau.snapshot().threatVisual"
            )
            camera_raise_drift = math.sqrt(sum(
                (camera_raised_threat["position"][axis] - camera_lowered_threat["position"][axis]) ** 2
                for axis in ("x", "y", "z")
            ))
            # Authored time is frozen here: tool input must not advance the orbit,
            # awareness blend, or any other world-space threat state.
            assert camera_raise_drift < 0.002, {
                "lowered": camera_lowered_threat,
                "raised": camera_raised_threat,
                "drift": camera_raise_drift,
            }
            assert abs(camera_raised_threat["scale"] - camera_lowered_threat["scale"]) < 0.002, {
                "lowered": camera_lowered_threat,
                "raised": camera_raised_threat,
            }
            assert camera_raised_threat["attackStage"] == camera_lowered_threat["attackStage"]
            hud_layout = page.evaluate(
                "() => {"
                "  const box = (id) => {"
                "    const rect = document.getElementById(id).getBoundingClientRect();"
                "    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };"
                "  };"
                "  return { caption: box('caption-line'), plates: box('plate-rail') };"
                "}"
            )
            overlaps = not (
                hud_layout["caption"]["right"] <= hud_layout["plates"]["left"]
                or hud_layout["plates"]["right"] <= hud_layout["caption"]["left"]
                or hud_layout["caption"]["bottom"] <= hud_layout["plates"]["top"]
                or hud_layout["plates"]["bottom"] <= hud_layout["caption"]["top"]
            )
            assert overlaps is False, hud_layout
            page.mouse.up(button="right")
            page.set_viewport_size({"width": 1440, "height": 900})

            # Freeze authored animation time, then translate only the player.
            # A deterministic translation isolates the spatial contract from
            # ordinary orbit motion and controller frame scheduling.
            world_locked = page.evaluate(
                "() => {"
                "  window.__projectPlateau.freezeVisualForTest(4.25, false);"
                "  const before = window.__projectPlateau.snapshot();"
                "  const { x, z } = before.player.position;"
                "  const { heading, pitch } = before.player;"
                "  window.__projectPlateau.teleportForTest({ x: x + 4, z: z - 3, heading, pitch });"
                "  window.__projectPlateau.freezeVisualForTest(4.25, false);"
                "  const after = window.__projectPlateau.snapshot();"
                "  window.__projectPlateau.teleportForTest({ x, z, heading, pitch });"
                "  return { before, after };"
                "}"
            )
            world_locked_before = world_locked["before"]
            world_locked_after = world_locked["after"]
            assert world_locked_after["threatVisual"]["position"] == world_locked_before["threatVisual"]["position"], {
                "before": world_locked_before["threatVisual"],
                "after": world_locked_after["threatVisual"],
            }
            assert world_locked_after["threatVisual"]["scale"] == world_locked_before["threatVisual"]["scale"]
            assert world_locked_after["familyVisual"]["positions"] == world_locked_before["familyVisual"]["positions"]
            page.evaluate("window.__projectPlateau.setThreatVisualForTest(null, null)")

            page.keyboard.down("KeyF")
            assert page.evaluate("window.__projectPlateau.snapshot().player.rifleRaised") is True
            page.evaluate("window.dispatchEvent(new Event('blur'))")
            assert page.evaluate("window.__projectPlateau.snapshot().player.rifleRaised") is False
            page.get_by_role("button", name="Resume field work").click()
            page.wait_for_timeout(100)

            page.mouse.down(button="right")
            assert page.evaluate("window.__projectPlateau.snapshot().player.cameraRaised") is True
            page.evaluate("window.dispatchEvent(new Event('blur'))")
            assert page.evaluate("window.__projectPlateau.snapshot().player.cameraRaised") is False
            page.mouse.up(button="right")
            page.get_by_role("button", name="Resume field work").click()
            page.wait_for_timeout(100)

            page.mouse.down(button="right")
            assert page.evaluate("window.__projectPlateau.snapshot().player.cameraRaised") is True
            shutter_handler_ms = page.evaluate(
                "() => {"
                "  const started = performance.now();"
                "  document.dispatchEvent(new MouseEvent('mousedown', {button: 0}));"
                "  return performance.now() - started;"
                "}"
            )
            assert page.evaluate("Boolean(window.__projectPlateau.snapshot().player.pendingExposure)") is True
            assert shutter_handler_ms < 50, shutter_handler_ms
            page.wait_for_function("window.__projectPlateau.snapshot().ui.capturedPlateImages[0] === true")
            page.mouse.up(button="right")

            page.evaluate("document.exitPointerLock()")
            lost = page.evaluate("window.__projectPlateau.snapshot()")
            assert lost["player"]["paused"] is True, lost
            assert lost["player"]["pauseReason"] == "pointer-lock", lost

            assert "Look [Mouse]" in page.locator("#control-hint").text_content()
            assert "Rifle [Hold F]" in page.locator("#control-hint").text_content()
            assert "Jump [Space]" in page.locator("#control-hint").text_content()
            screenshot = EVIDENCE / "controller-contract.jpg"
            page.screenshot(path=screenshot, type="jpeg", quality=86)
            context.close()

            rejected_context = browser.new_context(viewport={"width": 1280, "height": 720})
            rejected_context.add_init_script(POINTER_LOCK_REJECTION)
            rejected = rejected_context.new_page()
            rejected.goto(f"{BASE_URL}/?qa=pointer-lock-rejection", wait_until="networkidle")
            rejected.wait_for_function("window.__projectPlateau?.ready === true")
            enter_field(rejected)
            rejected.wait_for_timeout(120)
            denied = rejected.evaluate("window.__projectPlateau.snapshot()")
            assert denied["player"]["paused"] is True, denied
            assert denied["player"]["pauseReason"] == "pointer-lock-unavailable", denied
            assert denied["pointerLock"]["status"] == "unavailable", denied
            assert rejected.get_by_text("POINTER LOCK UNAVAILABLE").is_visible()
            rejected_context.close()
            browser.close()

        report = {
            "status": "PASS",
            "pointerLockMode": "deterministic-browser-shim",
            "nativePointerLock": "NOT_RUN: headed Chrome did not grant pointer lock in the automated desktop session",
            "checks": [
                "pre-run held-key isolation",
                "pointer-lock acquisition boundary",
                "mouse delta to camera orientation",
                "camera-relative W projection",
                "spacebar ballistic jump and grounded landing",
                "camera raise preserves pterodactyl position, scale and flight state",
                "player movement preserves world-space pterodactyl and planted family transforms",
                "compact desktop captions preserve the plate-rail safe area",
                "focus-loss transient tool reset",
                "non-blocking shutter capture",
                "pointer-lock loss pause",
                "pointer-lock denial failure UI",
            ],
            "evidence": ["build/evidence/controller/controller-contract.jpg"],
        }
        (EVIDENCE / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
