#!/usr/bin/env python3
"""Capture the source-bound Project Plateau visual-target review bundle."""

from __future__ import annotations

import hashlib
import json
import os
from base64 import b64decode
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlparse

from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat
from playwright.sync_api import Page, sync_playwright

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
EVIDENCE = Path(
    os.environ.get(
        "PROJECT_PLATEAU_VISUAL_EVIDENCE",
        BUILD / "evidence" / "visual-targets",
    )
).resolve()
FRAMES = EVIDENCE / "frames"
STATE = EVIDENCE / "state"
BROWSER = EVIDENCE / "browser"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
TRACK_ROI_MIN_STDDEV = 11.5


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_fingerprint() -> str:
    digest = hashlib.sha256()
    paths = [APP / "index.html", APP / "package.json", APP / "package-lock.json"]
    paths += sorted((APP / "public").rglob("*")) + sorted((APP / "src").rglob("*"))
    for path in paths:
        if not path.is_file():
            continue
        digest.update(path.relative_to(APP).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


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
                    raise RuntimeError("Vite exited before visual-target QA")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for visual-target QA")


def make_contact_sheet(records: list[dict[str, object]], target: Path, columns: int = 2) -> None:
    tile_width, tile_height = 720, 450
    rows = (len(records) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "#18201d")
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        source = EVIDENCE / str(record["visual"])
        with Image.open(source) as image:
            fitted = ImageOps.fit(image.convert("RGB"), (tile_width, tile_height))
            x = (index % columns) * tile_width
            y = (index // columns) * tile_height
            sheet.paste(fitted, (x, y))
            label = f'{record["target"]} · {record["variant"]}'
            draw.rectangle((x + 12, y + 12, x + 12 + len(label) * 8, y + 36), fill="#17201de6")
            draw.text((x + 20, y + 18), label, fill="#eee5cf")
    sheet.save(target, quality=92)


def run() -> dict[str, object]:
    for directory in (FRAMES, STATE, BROWSER):
        directory.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    hosts: set[str] = set()
    captures: list[dict[str, object]] = []
    plate_captures: list[dict[str, object]] = []
    motion_captures: list[dict[str, object]] = []
    accessible_ui_layout: dict[str, object] = {}
    fingerprint = source_fingerprint()

    server = start_server()
    try:
        with sync_playwright() as playwright:
            options: dict[str, object] = {"headless": True}
            if CHROME.exists():
                options["executable_path"] = str(CHROME)
            browser = playwright.chromium.launch(**options)
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
            page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
            page.goto(f"{BASE_URL}/?qa=visual-targets", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.family.visualStatus === 'hy3d-family-ready'",
                timeout=15000,
            )
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.pterodactyl.visualStatus === 'hy3d-flock-ready'",
                timeout=15000,
            )
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.fieldCamera.visualStatus === 'hy3d-field-camera-ready'",
                timeout=15000,
            )
            page.wait_for_function(
                "window.__projectPlateau.snapshot().assets.rifle.visualStatus === 'hy3d-rifle-ready'",
                timeout=15000,
            )

            def capture(target: str, variant: str, inputs: list[str]) -> dict[str, object]:
                identifier = f"{target.lower()}-{variant}"
                state_path = STATE / f"{identifier}.json"
                browser_path = BROWSER / f"{identifier}.json"
                visual_path = FRAMES / f"{identifier}.jpg"
                state = page.evaluate("window.__projectPlateau.snapshot()")
                viewport = page.viewport_size or {"width": 0, "height": 0}
                browser_record = page.evaluate(
                    """() => ({
                      userAgent: navigator.userAgent,
                      devicePixelRatio: window.devicePixelRatio,
                      bodyMode: document.body.dataset.mode,
                      textScale: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(),
                      reducedMotionClass: document.body.classList.contains('reduced-motion')
                    })"""
                )
                browser_record.update(
                    {
                        "inputs": inputs,
                        "viewport": [viewport["width"], viewport["height"]],
                        "url": page.url,
                        "consoleErrorsAtCheckpoint": list(errors),
                        "requestHostsAtCheckpoint": sorted(hosts),
                        "capturedAtUnixMs": int(time.time() * 1000),
                    }
                )
                state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
                browser_path.write_text(json.dumps(browser_record, indent=2) + "\n", encoding="utf-8")
                page.screenshot(path=visual_path, type="jpeg", quality=92)
                record = {
                    "target": target,
                    "variant": variant,
                    "visual": visual_path.relative_to(EVIDENCE).as_posix(),
                    "state": state_path.relative_to(EVIDENCE).as_posix(),
                    "browser": browser_path.relative_to(EVIDENCE).as_posix(),
                    "visualSha256": sha256_file(visual_path),
                    "stateSha256": sha256_file(state_path),
                    "browserSha256": sha256_file(browser_path),
                    "viewport": browser_record["viewport"],
                }
                captures.append(record)
                return state

            def teleport(x: float, z: float, heading: float = 0, pitch: float = 0) -> None:
                page.evaluate(
                    "p => window.__projectPlateau.teleportForTest(p)",
                    {"x": x, "z": z, "heading": heading, "pitch": pitch},
                )
                page.wait_for_timeout(100)

            def lower_camera_after_exposure() -> None:
                page.mouse.down(button="right")
                page.mouse.up(button="right")
                page.wait_for_timeout(40)

            def capture_plate(index: int, variant: str, expected_frame: str) -> dict[str, object]:
                data_uri = page.evaluate(
                    "plateIndex => window.__projectPlateau.plateImageForTest(plateIndex)",
                    index,
                )
                assert isinstance(data_uri, str) and data_uri.startswith("data:image/jpeg;base64,"), data_uri
                visual_path = FRAMES / f"plate-{index + 1}-{variant}.jpg"
                visual_path.write_bytes(b64decode(data_uri.split(",", 1)[1]))
                state = page.evaluate("window.__projectPlateau.snapshot()")
                plate = state["player"]["plates"][index]
                assert plate["frameKey"] == expected_frame, plate
                with Image.open(visual_path) as image:
                    grayscale = image.convert("L")
                    statistics = ImageStat.Stat(grayscale)
                    metrics = {
                        "size": list(image.size),
                        "lumaStdDev": round(statistics.stddev[0], 3),
                        "entropy": round(grayscale.entropy(), 3),
                    }
                    if index == 0:
                        width, height = image.size
                        # The opening plate frames the track in the lower-right
                        # third.  Keep this crop on the authored print itself;
                        # the previous centre crop mostly measured empty ground
                        # and could not prove VT-02 material/relief detail.
                        track_roi = grayscale.crop((
                            int(width * 0.57),
                            int(height * 0.52),
                            int(width * 0.86),
                            int(height * 0.74),
                        ))
                        metrics["trackRoiStdDev"] = round(ImageStat.Stat(track_roi).stddev[0], 3)
                        metrics["trackRoiEntropy"] = round(track_roi.entropy(), 3)
                record = {
                    "plateIndex": index,
                    "variant": variant,
                    "frameKey": plate["frameKey"],
                    "visual": visual_path.relative_to(EVIDENCE).as_posix(),
                    "visualSha256": sha256_file(visual_path),
                    **metrics,
                }
                plate_captures.append(record)
                return record

            def capture_motion_frame(sequence: str, frame_index: int) -> None:
                identifier = f"motion-{sequence}-{frame_index:02d}"
                visual_path = FRAMES / f"{identifier}.jpg"
                state_path = STATE / f"{identifier}.json"
                state = page.evaluate("window.__projectPlateau.snapshot()")
                page.screenshot(path=visual_path, type="jpeg", quality=90)
                state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
                motion_captures.append({
                    "target": "MOTION",
                    "variant": f"{sequence}-{frame_index:02d}",
                    "sequence": sequence,
                    "frameIndex": frame_index,
                    "visual": visual_path.relative_to(EVIDENCE).as_posix(),
                    "state": state_path.relative_to(EVIDENCE).as_posix(),
                    "visualSha256": sha256_file(visual_path),
                    "stateSha256": sha256_file(state_path),
                })

            def expose(index: int) -> dict[str, object]:
                page.mouse.move(720, 450)
                page.mouse.down(button="right")
                page.wait_for_timeout(80)
                page.mouse.down(button="left")
                page.mouse.up(button="left")
                page.mouse.up(button="right")
                page.wait_for_function(
                    f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                    timeout=3500,
                )
                lower_camera_after_exposure()
                return page.evaluate("window.__projectPlateau.snapshot()")

            def capture_live_exposure(
                index: int,
                frame_key: str,
                variant: str,
                motion_sequence: str,
            ) -> dict[str, object]:
                page.mouse.move(720, 450)
                page.mouse.down(button="right")
                page.wait_for_timeout(80)
                page.mouse.down(button="left")
                page.mouse.up(button="left")
                page.mouse.up(button="right")
                page.wait_for_function(
                    f"window.__projectPlateau.snapshot().player.pendingExposure?.key === '{frame_key}'",
                    timeout=1200,
                )
                state = capture("VT03", variant, ["Right Mouse held", "Left Mouse shutter"])
                assert state["player"]["cameraRaised"], state
                assert not page.locator("#context-prompt").is_visible(), state
                capture_motion_frame(motion_sequence, 0)
                for motion_frame in (1, 2):
                    page.wait_for_timeout(360)
                    capture_motion_frame(motion_sequence, motion_frame)
                page.wait_for_function(
                    f"window.__projectPlateau.snapshot().player.plates[{index}].status === 'exposed'",
                    timeout=3500,
                )
                lower_camera_after_exposure()
                return state

            capture("VT01", "title-1440x900", ["cold load"])
            page.set_viewport_size({"width": 1280, "height": 720})
            page.wait_for_timeout(120)
            capture("VT01", "title-1280x720", ["cold load", "minimum viewport"])
            page.set_viewport_size({"width": 1440, "height": 900})
            page.wait_for_timeout(120)

            page.get_by_role("button", name="Enter the basin").click()
            page.get_by_role("button", name="Begin field work").click()
            teleport(0, 44)
            track = capture("VT02", "first-controllable-track", ["Begin field work", "QA teleport to opening sightline"])
            assert track["ui"]["prompt"] == "Examine the track [E]", track
            page.keyboard.press("KeyE")
            page.wait_for_timeout(2550)
            examined = capture("VT02", "track-examined", ["E", "wait for field note to clear"])
            assert examined["player"]["examinedTrack"], examined
            assert examined["ui"]["fieldNote"] is None, examined
            assert examined["ui"]["caption"] is None, examined

            teleport(0, 44, heading=0.56, pitch=-0.25)
            expose(0)
            capture_plate(0, "brook-track", "brook-partial")
            teleport(8, 18)
            expose(1)
            capture_plate(1, "basalt-scale", "basalt-scale")
            teleport(0, 18)
            page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
            teleport(0, -5)
            page.keyboard.press("KeyE")
            page.wait_for_timeout(1550)
            capture_live_exposure(2, "glade-young-play", "young-play-silver-frame", "young-play")
            capture_plate(2, "young-play", "glade-young-play")
            teleport(0, 18)
            page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
            teleport(1, -6, heading=-0.3)
            capture_live_exposure(3, "glade-branch-pull", "branch-pull-silver-frame", "branch-pull")
            capture_plate(3, "branch-pull", "glade-branch-pull")

            teleport(0, 2, pitch=0.14)
            page.keyboard.down("KeyF")
            page.wait_for_timeout(160)
            attack = capture("VT04", "attack-defense", ["KeyF held", "attack corridor"])
            assert attack["player"]["threatState"] == "attack", attack
            assert attack["assets"]["pterodactyl"]["silhouette"] == "continuous-skinned-membrane-wing", attack
            assert not page.locator("#plate-preview").is_visible(), attack
            capture_motion_frame("pterodactyl-attack", 0)
            for motion_frame in (1, 2):
                page.wait_for_timeout(320)
                capture_motion_frame("pterodactyl-attack", motion_frame)
            page.mouse.click(720, 450, button="left")
            page.wait_for_function(
                "window.__projectPlateau.snapshot().player.shotCount === 1",
                timeout=1200,
            )
            target_performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
            page.keyboard.up("KeyF")

            teleport(0, 4)
            page.wait_for_function("window.__projectPlateau.snapshot().player.threatAwareness <= 2", timeout=8000)
            teleport(0, 70)
            page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1200)
            result = capture("VT05", "strong-result", ["covered return", "Fort submission"])
            assert result["player"]["result"]["band"] == "strong-field-record", result
            assert result["ui"]["capturedPlateImages"] == [True, True, True, True], result
            terminal_plate_styles = page.evaluate(
                """() => [...document.querySelectorAll('.terminal-board > span')].map((slot) => ({
                  frameKey: slot.dataset.frame,
                  captured: slot.dataset.captured,
                  inlineImageLength: slot.style.backgroundImage.length,
                  backgroundPosition: getComputedStyle(slot).backgroundPosition,
                  backgroundSize: getComputedStyle(slot).backgroundSize,
                  backgroundRepeat: getComputedStyle(slot).backgroundRepeat
                }))"""
            )
            assert all(slot["captured"] == "true" for slot in terminal_plate_styles), terminal_plate_styles
            assert all(slot["inlineImageLength"] > 1000 for slot in terminal_plate_styles), terminal_plate_styles
            assert all(slot["backgroundPosition"] == "50% 50%" for slot in terminal_plate_styles), terminal_plate_styles
            assert all(slot["backgroundSize"] == "cover" for slot in terminal_plate_styles), terminal_plate_styles
            assert all(slot["backgroundRepeat"] == "no-repeat" for slot in terminal_plate_styles), terminal_plate_styles

            page.get_by_role("button", name="Take the route again").click()
            page.get_by_role("button", name="Begin field work").click()
            page.set_viewport_size({"width": 1280, "height": 720})
            teleport(0, 18)
            capture("VT06", "minimum-field-1280x720", ["minimum viewport", "ordinary field state"])
            page.evaluate(
                """() => {
                  const scale = document.querySelector('#text-scale');
                  scale.value = '1.5';
                  scale.dispatchEvent(new Event('change', {bubbles: true}));
                  const motion = document.querySelector('#reduced-motion');
                  motion.checked = true;
                  motion.dispatchEvent(new Event('change', {bubbles: true}));
                }"""
            )
            page.wait_for_timeout(120)
            accessible = capture(
                "VT06",
                "minimum-150-text-reduced-motion",
                ["1280x720", "150% text", "reduced motion"],
            )
            assert accessible["presentationSettings"]["textScale"] == "1.5", accessible
            assert accessible["presentationSettings"]["reducedMotion"], accessible
            accessible_ui_layout = page.evaluate(
                """() => {
                  const result = {rootFontSize: getComputedStyle(document.documentElement).fontSize};
                  for (const [key, selector] of Object.entries({
                    controls: '#control-hint',
                    prompt: '#context-prompt',
                    caption: '#caption-line'
                  })) {
                    const element = document.querySelector(selector);
                    if (!element || element.hidden || getComputedStyle(element).display === 'none') {
                      result[key] = null;
                      continue;
                    }
                    const bounds = element.getBoundingClientRect();
                    result[key] = {
                      left: bounds.left, top: bounds.top,
                      right: bounds.right, bottom: bounds.bottom,
                      width: bounds.width, height: bounds.height
                    };
                  }
                  return result;
                }"""
            )
            assert accessible_ui_layout["rootFontSize"] == "24px", accessible_ui_layout
            visible_accessible_boxes = [
                bounds for key, bounds in accessible_ui_layout.items()
                if key != "rootFontSize" and bounds is not None
            ]
            for bounds in visible_accessible_boxes:
                assert bounds["left"] >= 12 and bounds["top"] >= 12, accessible_ui_layout
                assert bounds["right"] <= 1268 and bounds["bottom"] <= 708, accessible_ui_layout
            for left_index, left_bounds in enumerate(visible_accessible_boxes):
                for right_bounds in visible_accessible_boxes[left_index + 1:]:
                    overlap_width = min(left_bounds["right"], right_bounds["right"]) - max(left_bounds["left"], right_bounds["left"])
                    overlap_height = min(left_bounds["bottom"], right_bounds["bottom"]) - max(left_bounds["top"], right_bounds["top"])
                    assert overlap_width <= 0 or overlap_height <= 0, accessible_ui_layout
            teleport(0, 2)
            page.keyboard.down("KeyF")
            page.wait_for_timeout(120)
            minimum_performance = page.evaluate("window.__projectPlateau.sampleFrames(240)")
            page.keyboard.up("KeyF")

            page.set_viewport_size({"width": 1440, "height": 900})
            page.wait_for_timeout(120)
            for subject in ("iguanodon", "pterodactyl"):
                for angle in (0, 90, 180, 270):
                    page.evaluate(
                        "review => window.__projectPlateau.setVisualReviewOrbitForTest(review)",
                        {"subject": subject, "angleDegrees": angle},
                    )
                    page.wait_for_timeout(160)
                    capture(
                        "ORBIT",
                        f"{subject}-{angle:03d}",
                        [f"QA visual orbit {subject}", f"{angle} degrees"],
                    )

            # Lock subject transform and camera, then isolate the three HY3D
            # morph phases. Ordinary elapsed-time samples also change the
            # animal's orbit heading and cannot prove bilateral wing motion.
            page.evaluate("window.__projectPlateau.freezeVisualForTest(0.35, false)")
            page.evaluate(
                "review => window.__projectPlateau.setVisualReviewOrbitForTest(review)",
                {"subject": "pterodactyl", "angleDegrees": 0},
            )
            for frame_index, pose in enumerate((
                {"wingUp": 1},
                {},
                {"wingDown": 1},
            )):
                page.evaluate(
                    "pose => window.__projectPlateau.setPterodactylMorphPoseForTest(pose)",
                    pose,
                )
                page.wait_for_timeout(120)
                capture_motion_frame("pterodactyl-wingbeat", frame_index)

            user_agent = page.evaluate("navigator.userAgent")
            browser.close()

        allowed = {urlparse(BASE_URL).netloc}
        external = sorted(host for host in hosts if host and host not in allowed)
        assert not errors, errors
        assert not external, external
        assert target_performance["medianFps"] >= 45, target_performance
        assert target_performance["onePercentLowFps"] >= 30, target_performance
        assert minimum_performance["medianFps"] >= 45, minimum_performance
        assert minimum_performance["onePercentLowFps"] >= 30, minimum_performance
        assert len(plate_captures) == 4, plate_captures
        assert all(record["lumaStdDev"] >= 24 for record in plate_captures), plate_captures
        assert all(record["entropy"] >= 5.4 for record in plate_captures), plate_captures
        # The track itself must remain readable after removing the unrelated
        # bright vegetation scatter that previously inflated this ROI metric.
        assert plate_captures[0]["trackRoiStdDev"] >= TRACK_ROI_MIN_STDDEV, plate_captures[0]
        assert plate_captures[0]["trackRoiEntropy"] >= 5.0, plate_captures[0]

        plate_distances: list[float] = []
        for left_index, left in enumerate(plate_captures):
            with Image.open(EVIDENCE / str(left["visual"])) as left_image:
                left_gray = left_image.convert("L").resize((48, 30))
                for right in plate_captures[left_index + 1:]:
                    with Image.open(EVIDENCE / str(right["visual"])) as right_image:
                        right_gray = right_image.convert("L").resize((48, 30))
                        distance = ImageStat.Stat(ImageChops.difference(left_gray, right_gray)).mean[0]
                        plate_distances.append(round(distance, 3))
        assert plate_distances and min(plate_distances) >= 2.5, plate_distances

        motion_distances: dict[str, list[float]] = {}
        for sequence in (
            "young-play",
            "branch-pull",
            "pterodactyl-attack",
            "pterodactyl-wingbeat",
        ):
            sequence_records = [
                record for record in motion_captures if record["sequence"] == sequence
            ]
            assert len(sequence_records) == 3, sequence_records
            distances: list[float] = []
            for left, right in zip(sequence_records, sequence_records[1:]):
                with Image.open(EVIDENCE / str(left["visual"])) as left_image:
                    left_gray = left_image.convert("L").resize((96, 60))
                    with Image.open(EVIDENCE / str(right["visual"])) as right_image:
                        right_gray = right_image.convert("L").resize((96, 60))
                        distance = ImageStat.Stat(ImageChops.difference(left_gray, right_gray)).mean[0]
                        distances.append(round(distance, 3))
            assert min(distances) >= 0.15, {sequence: distances}
            motion_distances[sequence] = distances

        primary_variants = {
            "VT01": "title-1440x900",
            "VT02": "track-examined",
            "VT03": "young-play-silver-frame",
            "VT04": "attack-defense",
            "VT05": "strong-result",
            "VT06": "minimum-150-text-reduced-motion",
        }
        primary = [
            next(record for record in captures if record["target"] == target and record["variant"] == variant)
            for target, variant in primary_variants.items()
        ]
        orbit_records = [record for record in captures if record["target"] == "ORBIT"]
        target_sheet = EVIDENCE / "contact-sheet-targets.jpg"
        orbit_sheet = EVIDENCE / "contact-sheet-orbits.jpg"
        plate_sheet = EVIDENCE / "contact-sheet-plates.jpg"
        motion_sheet = EVIDENCE / "contact-sheet-motion.jpg"
        make_contact_sheet(primary, target_sheet)
        make_contact_sheet(orbit_records, orbit_sheet, columns=2)
        make_contact_sheet(
            [
                {"target": f"PLATE {record['plateIndex'] + 1}", **record}
                for record in plate_captures
            ],
            plate_sheet,
            columns=2,
        )
        make_contact_sheet(motion_captures, motion_sheet, columns=3)

        performance_path = EVIDENCE / "performance.json"
        performance_path.write_text(
            json.dumps(
                {
                    "targetViewport": {"viewport": [1440, 900], **target_performance},
                    "minimumViewport": {"viewport": [1280, 720], **minimum_performance},
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        manifest = {
            "schemaVersion": 1,
            "candidate": "project-plateau-visual-sota",
            "source": {
                "scope": "index.html, package manifests, public assets and src",
                "sha256": fingerprint,
            },
            "capturedAtUnixMs": int(time.time() * 1000),
            "environment": {
                "baseUrl": BASE_URL,
                "userAgent": user_agent,
                "requestHosts": sorted(hosts),
                "externalHosts": external,
                "consoleErrors": errors,
            },
            "checks": {
                "allSixTargetsPresent": all(any(record["target"] == target for record in captures) for target in primary_variants),
                "titleAtTargetAndMinimumViewport": sum(record["target"] == "VT01" for record in captures) == 2,
                "youngPlayAndBranchPullCaptured": sum(record["target"] == "VT03" for record in captures) == 2,
                "orbitAnglesPerCreature": all(
                    sum(record["target"] == "ORBIT" and str(record["variant"]).startswith(subject) for record in captures) == 4
                    for subject in ("iguanodon", "pterodactyl")
                ),
                "rawPlateImagesPresent": len(plate_captures) == 4,
                "rawPlateImagesVisuallyDistinct": min(plate_distances) >= 2.5,
                "plateOneTrackRegionHasDetail": (
                    plate_captures[0]["trackRoiStdDev"] >= TRACK_ROI_MIN_STDDEV
                ),
                "motionSequencesPresentAndChanging": all(
                    min(distances) >= 0.15 for distances in motion_distances.values()
                ),
                "accessibleUiHasSafeMarginsAndNoOverlap": True,
                "targetAndMinimumPerformancePass": True,
                "noConsoleOrExternalRequestErrors": True,
            },
            "captures": captures,
            "plateCaptures": plate_captures,
            "platePairwiseMeanLumaDistances": plate_distances,
            "terminalPlateStyles": terminal_plate_styles,
            "motionCaptures": motion_captures,
            "motionPairwiseMeanLumaDistances": motion_distances,
            "accessibleUiLayout": accessible_ui_layout,
            "contactSheets": [
                {"path": target_sheet.relative_to(EVIDENCE).as_posix(), "sha256": sha256_file(target_sheet)},
                {"path": orbit_sheet.relative_to(EVIDENCE).as_posix(), "sha256": sha256_file(orbit_sheet)},
                {"path": plate_sheet.relative_to(EVIDENCE).as_posix(), "sha256": sha256_file(plate_sheet)},
                {"path": motion_sheet.relative_to(EVIDENCE).as_posix(), "sha256": sha256_file(motion_sheet)},
            ],
            "performance": {
                "path": performance_path.relative_to(EVIDENCE).as_posix(),
                "sha256": sha256_file(performance_path),
            },
            "reviewStatus": "pending-independent-visual-review",
        }
        manifest_path = EVIDENCE / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        manifest_hash = sha256_file(manifest_path)
        (EVIDENCE / "manifest.sha256").write_text(f"{manifest_hash}  manifest.json\n", encoding="utf-8")
        return {
            "sourceSha256": fingerprint,
            "manifestSha256": manifest_hash,
            "captureCount": len(captures),
            "targetPerformance": target_performance,
            "minimumPerformance": minimum_performance,
            "evidence": str(EVIDENCE),
        }
    finally:
        if server is not None:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    report = run()
    print(json.dumps(report, indent=2))
    print(f"VISUAL TARGETS PASS: {EVIDENCE / 'manifest.json'}")
