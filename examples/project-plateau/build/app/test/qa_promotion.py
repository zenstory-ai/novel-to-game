#!/usr/bin/env python3
"""Capture real-input promotion traces and synchronized PF evidence."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageOps
from playwright.sync_api import Page, sync_playwright

from qa_s8 import CHROME
from qa_assertions import (
    ROUTE_INPUT_CONTINUATION_MS,
    assert_promotion_pf_semantics,
    route_input_calibration,
)
from qa_controller import POINTER_LOCK_SHIM
from qa_targeted import APP, TEST, canonical_json, four_fingerprints, sha256_file, start_server


PF_BY_STAGE = {
    "brook": "PF-01",
    "basalt": "PF-02",
    "family": "PF-03",
    "attack": "PF-04",
    "return": "PF-05",
    "terminal": "PF-06",
}


def snapshot(page: Page) -> dict[str, object]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def assert_strong_terminal(state: dict[str, object]) -> None:
    player = state["player"]
    assert player["result"]["band"] == "strong-field-record", state
    assert player["result"]["evidence"] == 7, state
    assert player["shotCount"] == 0 and player["bodyMargin"] == 1, state
    assert [plate["frameKey"] for plate in player["plates"]] == [
        "brook-partial", "basalt-scale", "glade-young-play", "glade-branch-pull",
    ], state


class PromotionCapture:
    def __init__(self, page: Page, bundle: Path, viewport: str, trace_id: str, started: float):
        self.page = page
        self.bundle = bundle
        self.viewport = viewport
        self.trace_id = trace_id
        self.started = started
        self.fingerprints = four_fingerprints()
        self.samples: list[dict[str, object]] = []
        self.states: dict[str, dict[str, object]] = {}
        self.previous: dict[str, object] | None = None

    def checkpoint(self, stage: str, inputs: list[str]) -> None:
        pf = PF_BY_STAGE[stage]
        state = snapshot(self.page)
        elapsed = round((time.monotonic() - self.started) * 1000, 3)
        if self.samples and elapsed <= self.samples[-1]["timestampMs"]:
            elapsed = self.samples[-1]["timestampMs"] + 0.001
        stem = f"{pf}-{self.viewport}"
        frame_path = self.bundle / "frames" / f"{stem}.jpg"
        state_path = self.bundle / "state" / f"{stem}.json"
        browser_path = self.bundle / "browser" / f"{stem}.json"
        self.page.screenshot(path=frame_path, type="jpeg", quality=92)
        state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        browser = {
            "pf": pf,
            "viewport": self.viewport,
            "timecodeMs": elapsed,
            "traceId": self.trace_id,
            "inputs": inputs,
            "inputOnly": True,
            "uncut": True,
            "diagnostic": False,
            "cameraMode": state["cameraMode"],
            "url": self.page.url,
        }
        browser_path.write_text(json.dumps(browser, indent=2) + "\n", encoding="utf-8")
        player = state["player"]
        angular_velocity = 0.0
        if self.previous is not None:
            dt = max((elapsed - float(self.previous["timestampMs"])) / 1000, 0.001)
            angular_velocity = round(
                max(
                    abs(float(player["heading"]) - float(self.previous["heading"])),
                    abs(float(player["pitch"]) - float(self.previous["pitch"])),
                ) / dt,
                5,
            )
        sample = {
            "timestampMs": elapsed,
            "pf": pf,
            "inputTransitions": inputs,
            "position": player["position"],
            "heading": player["heading"],
            "pitch": player["pitch"],
            "cameraMode": state["cameraMode"],
            "linearVelocity": player["velocity"],
            "angularVelocity": angular_velocity,
            "stateKey": stage,
            "inputOnly": True,
            "uncut": True,
            "diagnostic": False,
            "captureSource": "qa_s8-real-browser-input",
            "viewport": self.viewport,
            "frameSha256": sha256_file(frame_path),
            "stateSha256": sha256_file(state_path),
            "browserSha256": sha256_file(browser_path),
            **self.fingerprints,
            "clipTimecodeMs": elapsed,
            "traceId": self.trace_id,
        }
        self.samples.append(sample)
        self.states[pf] = state
        self.previous = sample


def move_until(
    page: Page,
    key: str,
    predicate: str,
    timeout: int = 30_000,
    continuation_ms: int = 0,
) -> None:
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


def expose(page: Page, index: int) -> None:
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


def wait_for_cover(page: Page) -> None:
    page.wait_for_function(
        "window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000
    )


def turn_toward_fort(page: Page) -> float:
    before = float(snapshot(page)["player"]["heading"])
    page.mouse.move(0, 520, steps=12)
    page.wait_for_timeout(80)
    turned = float(snapshot(page)["player"]["heading"])
    delta = abs((turned - before + math.pi) % (2 * math.pi) - math.pi)
    viewport = page.viewport_size or {"width": 1440}
    minimum_turn = 2.3 if viewport["width"] <= 1280 else 2.5
    minimum_forward = 0.7 if viewport["width"] <= 1280 else 0.85
    if delta < minimum_turn or -math.cos(turned) < minimum_forward:
        raise AssertionError(f"real pointer turn did not face Fort: before={before} actual={turned}")
    return turned


def return_until(page: Page, predicate: str, timeout: int = 30_000) -> None:
    deadline = time.monotonic() + timeout / 1000
    correcting = False
    page.keyboard.down("KeyW")
    try:
        while not page.evaluate(f"() => Boolean({predicate})"):
            if time.monotonic() >= deadline:
                raise TimeoutError(f"covered forward return timed out: {snapshot(page)['player']}")
            x = float(snapshot(page)["player"]["position"]["x"])
            if x < 2.4 and not correcting:
                page.keyboard.down("KeyA")
                correcting = True
            elif x > 3.3 and correcting:
                page.keyboard.up("KeyA")
                correcting = False
            page.wait_for_timeout(50)
    finally:
        if correcting:
            page.keyboard.up("KeyA")
        page.keyboard.up("KeyW")
    page.wait_for_timeout(70)


def capture_trace(bundle: Path, viewport: str, *, record_clip: bool) -> dict[str, object]:
    width, height = map(int, viewport.split("x"))
    trace_id = f"strong-{viewport}-{int(time.time() * 1000)}"
    raw_video = bundle / "paths" / "raw-video"
    raw_video.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    server, base_url = start_server()
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            if CHROME.exists():
                launch["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**launch)
            context_args: dict[str, object] = {"viewport": {"width": width, "height": height}}
            if record_clip:
                context_args.update(record_video_dir=str(raw_video), record_video_size={"width": width, "height": height})
            context = browser.new_context(**context_args)
            context.add_init_script(POINTER_LOCK_SHIM)
            page = context.new_page()
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
            recording_started = time.monotonic()
            page.goto(f"{base_url}/?qa=promotion", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.get_by_role("button", name="Enter the basin").click()
            page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
            page.mouse.move(1440, 450)
            page.get_by_role("button", name="Begin field work").press("Enter")
            page.wait_for_timeout(100)
            started = time.monotonic()
            capture = PromotionCapture(page, bundle, viewport, trace_id, started)

            move_until(
                page,
                "KeyW",
                "window.__projectPlateau.snapshot().player.position.z <= 45",
                continuation_ms=ROUTE_INPUT_CONTINUATION_MS,
            )
            move_until(page, "KeyD", "window.__projectPlateau.snapshot().player.position.x >= 5.8")
            page.mouse.move(max(0, width - 360), 450, steps=8)
            page.wait_for_timeout(80)
            page.keyboard.press("KeyE")
            expose(page, 0)
            capture.checkpoint("brook", ["KeyW", "KeyD", "MouseTurn", "KeyE", "RightMouse", "LeftMouse"])
            page.mouse.move(width, 450, steps=8)
            page.wait_for_timeout(80)
            move_until(page, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 10")
            move_until(page, "KeyD", "window.__projectPlateau.snapshot().player.position.x >= 9.5")
            expose(page, 1)
            capture.checkpoint("basalt", ["KeyW", "KeyD", "RightMouse", "LeftMouse"])
            move_until(page, "KeyA", "window.__projectPlateau.snapshot().player.position.x < 2.7")
            wait_for_cover(page)
            move_until(page, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2")
            page.keyboard.press("KeyE")
            expose(page, 2)
            move_until(page, "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2")
            wait_for_cover(page)
            move_until(page, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2")
            expose(page, 3)
            capture.checkpoint("family", ["KeyW", "KeyE", "RightMouse", "LeftMouse"])
            page.wait_for_function(
                "() => { const s = window.__projectPlateau.snapshot(); return s.player.threatAwareness === 3"
                " && s.player.threatState === 'attack'"
                " && ['fold-dive', 'attack'].includes(s.threatVisual.attackStage); }",
                timeout=5000,
            )
            capture.checkpoint("attack", ["RightMouse", "LeftMouse"])
            move_until(page, "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2")
            wait_for_cover(page)
            turn_toward_fort(page)
            return_until(page, "window.__projectPlateau.snapshot().player.position.z >= 60.4")
            move_until(page, "KeyD", "window.__projectPlateau.snapshot().player.position.x <= 0.8")
            capture.checkpoint("return", ["MouseTurn", "KeyW", "KeyA", "KeyD", "covered-return"])
            return_until(page, "window.__projectPlateau.snapshot().player.runStatus === 'result'")
            terminal = snapshot(page)
            assert_strong_terminal(terminal)
            capture.checkpoint("terminal", ["KeyW", "Fort-submit"])
            semantic_assertions = assert_promotion_pf_semantics(capture.samples, capture.states)
            page.wait_for_timeout(500)
            video = page.video if record_clip else None
            context.close()
            recorded = Path(video.path()) if video else None
            browser.close()
            if errors:
                raise AssertionError(errors)
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)

    telemetry_name = "promotion-telemetry.jsonl" if record_clip else f"viewport-{viewport}-telemetry.jsonl"
    telemetry_path = bundle / "paths" / telemetry_name
    telemetry_path.write_text("".join(canonical_json(row) + "\n" for row in capture.samples), encoding="utf-8")
    clip_path = None
    if recorded:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("ffmpeg is required to trim promotion browser preroll")
        clip_path = bundle / "paths" / "promotion.webm"
        preroll = max(0, started - recording_started)
        subprocess.run(
            [ffmpeg, "-loglevel", "error", "-ss", f"{preroll:.3f}", "-i", str(recorded),
             "-an", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "4",
             "-crf", "30", "-b:v", "0", "-y", str(clip_path)],
            check=True,
        )
        recorded.unlink()
    receipt = {
        "schemaVersion": 1,
        "captureSource": "qa_s8-real-browser-input",
        "captureScript": "test/qa_promotion.py",
        "captureScriptSha256": sha256_file(Path(__file__)),
        "s8AssertionSource": "test/qa_s8.py#run",
        "s8AssertionSha256": sha256_file(TEST / "qa_s8.py"),
        "viewport": viewport,
        "traceId": trace_id,
        "inputOnly": True,
        "uncut": True,
        "diagnostic": False,
        "telemetry": {"path": f"paths/{telemetry_name}", "sha256": sha256_file(telemetry_path)},
        "clip": None if clip_path is None else {"path": "paths/promotion.webm", "sha256": sha256_file(clip_path)},
        "fingerprints": four_fingerprints(),
        "semanticAssertions": semantic_assertions,
    }
    receipt_path = bundle / "paths" / f"capture-{viewport}.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


def make_contact_sheet(bundle: Path, target: Path) -> None:
    records = [bundle / "frames" / f"PF-{index:02d}-1440x900.jpg" for index in range(1, 7)]
    sheet = Image.new("RGB", (1440, 1350), "#18201d")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(records):
        with Image.open(path) as source:
            tile = ImageOps.fit(source.convert("RGB"), (720, 450))
        x, y = (index % 2) * 720, (index // 2) * 450
        sheet.paste(tile, (x, y))
        draw.rectangle((x + 12, y + 12, x + 100, y + 38), fill="#17201d")
        draw.text((x + 20, y + 19), f"PF-{index + 1:02d}", fill="#eee5cf")
    sheet.save(target, quality=92)


def prepare_review_inputs(bundle: Path) -> None:
    contact = bundle / "contact-sheets"
    contact.mkdir(parents=True, exist_ok=True)
    make_contact_sheet(bundle, contact / "candidate.jpg")
    shutil.copy2(TEST / "reference" / "ashmaw-contact-sheet.jpg", contact / "reference.jpg")
    before = subprocess.run(
        ["git", "show", "HEAD:examples/project-plateau/build/evidence/visual-upgrade/generated/contact-sheet-supported-viewports.jpg"],
        cwd=APP.parents[3], capture_output=True, check=True,
    ).stdout
    (contact / "before.jpg").write_bytes(before)
    review_contract = json.loads(
        (TEST / "visual-review-contract.json").read_text(encoding="utf-8")
    )
    (contact / "before-mapping.json").write_text(
        json.dumps(review_contract["beforeMapping"], indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    if len(sys.argv) != 4 or sys.argv[1] not in {"promotion", "viewport"}:
        raise SystemExit("usage: qa_promotion.py promotion|viewport BUNDLE VIEWPORT")
    mode, bundle, viewport = sys.argv[1], Path(sys.argv[2]).resolve(), sys.argv[3]
    for name in ("frames", "state", "browser", "paths", "contact-sheets", "reviews"):
        (bundle / name).mkdir(parents=True, exist_ok=True)
    result = capture_trace(bundle, viewport, record_clip=mode == "promotion")
    if mode == "promotion":
        prepare_review_inputs(bundle)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
