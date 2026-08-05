#!/usr/bin/env python3
"""Gate first-person motion stability, frame pacing, and obvious temporal pops."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import socket
import statistics
import subprocess
import time
from urllib.parse import urlparse

from PIL import Image, ImageChops, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = BUILD / "evidence" / "motion"
FRAMES = EVIDENCE / "frames"
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

HY3D_ASSETS_READY = """
() => {
  const assets = window.__projectPlateau.snapshot().assets;
  return assets.family.visualStatus === 'hy3d-family-ready'
    && assets.pterodactyl.visualStatus === 'hy3d-flock-ready'
    && assets.fieldCamera.visualStatus === 'hy3d-field-camera-ready'
    && assets.rifle.visualStatus === 'hy3d-rifle-ready';
}
"""


def webgl_renderer(page) -> dict[str, object]:
    return page.evaluate(
        """
        () => {
          const canvas = document.querySelector('#game-canvas');
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          const vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
          const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
          const software = /swiftshader|llvmpipe|software rasterizer/i.test(`${vendor} ${renderer}`);
          return {vendor, renderer, software};
        }
        """
    )


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
                    raise RuntimeError("Vite exited before the motion check")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for the motion check")


def mean_difference(first: Path, second: Path) -> float:
    with Image.open(first).convert("RGB") as left, Image.open(second).convert("RGB") as right:
        difference = ImageChops.difference(left, right)
        return sum(ImageStat.Stat(difference).mean) / (3 * 255)


def capture_canvas(page, destination: Path) -> None:
    """Capture the canvas without waiting for a continuously rendered locator to settle."""
    clip = page.evaluate(
        """
        () => {
          const bounds = document.querySelector('#game-canvas').getBoundingClientRect();
          return {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height};
        }
        """
    )
    assert clip["width"] > 0 and clip["height"] > 0, clip
    page.screenshot(
        path=destination,
        type="jpeg",
        quality=90,
        clip=clip,
        timeout=120_000,
    )


def make_contact_sheet(paths: list[Path], destination: Path) -> None:
    images = [Image.open(path).convert("RGB") for path in paths]
    width = 480
    resized = [image.resize((width, round(image.height * width / image.width))) for image in images]
    label_height = 32
    sheet = Image.new("RGB", (width * 2, (resized[0].height + label_height) * 2), "#0d1516")
    draw = ImageDraw.Draw(sheet)
    for index, image in enumerate(resized[:4]):
        x = (index % 2) * width
        y = (index // 2) * (image.height + label_height)
        sheet.paste(image, (x, y + label_height))
        draw.text((x + 12, y + 9), paths[index].stem, fill="#e8dfc7")
    sheet.save(destination, format="JPEG", quality=88)
    for image in images:
        image.close()


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
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
            page.goto(f"{BASE_URL}/?qa=motion", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.wait_for_function(HY3D_ASSETS_READY, timeout=120_000)
            page.get_by_role("button", name="Enter the basin").click()
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(500)
            page.evaluate("window.__projectPlateau.freezeVisualForTest(4.25, true)")
            static_paths = []
            for index in range(3):
                path = FRAMES / f"static-{index:02d}.jpg"
                capture_canvas(page, path)
                static_paths.append(path)
                page.wait_for_timeout(90)
            static_diffs = [
                mean_difference(static_paths[index], static_paths[index + 1])
                for index in range(len(static_paths) - 1)
            ]
            assert max(static_diffs) < 0.0025, static_diffs

            context.close()
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.add_init_script(POINTER_LOCK_SHIM)
            page = context.new_page()
            page.goto(f"{BASE_URL}/?qa=motion-live", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.wait_for_function(HY3D_ASSETS_READY, timeout=120_000)
            page.get_by_role("button", name="Enter the basin").click()
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(500)
            page.evaluate(
                "document.dispatchEvent(new MouseEvent('mousemove', {movementX: 150, movementY: 0}))"
            )
            page.wait_for_timeout(100)
            origin = page.evaluate("window.__projectPlateau.snapshot()")
            heading = origin["player"]["heading"]

            page.keyboard.down("KeyW")
            page.wait_for_timeout(650)
            motion_paths: list[Path] = []
            positions: list[dict[str, float]] = []
            speeds: list[float] = []
            for index in range(8):
                path = FRAMES / f"walk-pan-{index:02d}.jpg"
                capture_canvas(page, path)
                motion_paths.append(path)
                state = page.evaluate("window.__projectPlateau.snapshot().player")
                positions.append(state["position"])
                speeds.append(math.hypot(state["velocity"]["x"], state["velocity"]["z"]))
                page.evaluate(
                    "document.dispatchEvent(new MouseEvent('mousemove', {movementX: 2, movementY: 0}))"
                )
                page.wait_for_timeout(90)
            renderer = webgl_renderer(page)
            frame_sample_count = 8 if renderer["software"] else 120
            frame_pacing = page.evaluate(
                "count => window.__projectPlateau.sampleFrames(count)",
                frame_sample_count,
            )
            page.keyboard.up("KeyW")

            displacements = [
                {
                    "x": positions[index + 1]["x"] - positions[index]["x"],
                    "z": positions[index + 1]["z"] - positions[index]["z"],
                }
                for index in range(len(positions) - 1)
            ]
            initial_forward = {"x": -math.sin(heading), "z": -math.cos(heading)}
            assert all(
                displacement["x"] * initial_forward["x"] + displacement["z"] * initial_forward["z"] > 0
                for displacement in displacements
            ), displacements
            assert min(speeds) > 3.8 and max(speeds) <= 4.21, speeds
            if renderer["software"]:
                performance_gate = {
                    "status": "NOT_RUN",
                    "reason": "Software WebGL is not a supported performance target.",
                }
            else:
                assert frame_pacing["medianFps"] >= 45, frame_pacing
                assert frame_pacing["onePercentLowFps"] >= 30, frame_pacing
                performance_gate = {"status": "PASS"}

            motion_diffs = [
                mean_difference(motion_paths[index], motion_paths[index + 1])
                for index in range(len(motion_paths) - 1)
            ]
            median_motion_diff = statistics.median(motion_diffs)
            assert median_motion_diff > 0.003, motion_diffs
            assert max(motion_diffs) < median_motion_diff * 3, motion_diffs
            make_contact_sheet(
                [motion_paths[index] for index in (0, 2, 4, 7)],
                EVIDENCE / "motion-contact-sheet.jpg",
            )
            final = page.evaluate("window.__projectPlateau.snapshot()")
            context.close()
            browser.close()

        report = {
            "status": "PASS",
            "pointerLockMode": "deterministic-browser-shim",
            "staticNormalizedDiffs": [round(value, 6) for value in static_diffs],
            "motionNormalizedDiffs": [round(value, 6) for value in motion_diffs],
            "webglRenderer": renderer,
            "framePacing": frame_pacing,
            "performanceGate": performance_gate,
            "finalHeading": final["player"]["heading"],
            "finalPosition": final["player"]["position"],
            "evidence": ["build/evidence/motion/motion-contact-sheet.jpg"],
        }
        (EVIDENCE / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
