#!/usr/bin/env python3
"""Record one input-only core-loop run and derive legible 30s/15s demos.

The source take is one continuous Strong-result browser run with two defensive
shots. Delivery clips use same-take editorial cuts at natural 1x playback so
camera commitment, the pterodactyl dive, rifle response and result remain
readable without distorting player motion. The route never teleports or advances
time through a QA hook, and the edited demos never replace the current
complete-run report. Raw and encoded video stay out of Git; marks, hashes and
probe data remain reproducible.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright

BUILD = Path(__file__).resolve().parents[2]
APP = BUILD / "app"
REPO = BUILD.parents[2]
MEDIA = BUILD / "media"
CLIP = MEDIA / "clip"
XCLIP = REPO / "scripts" / "xclip.py"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEW = {"width": 1280, "height": 800}
PUBLIC_MEDIA = APP / "public" / "media"
RUNTIME_FINGERPRINT_SCOPE = (
    "interactive inputs: index/package manifests, src and public assets; "
    "generated conversion-preview outputs excluded"
)
EDIT_DESCRIPTION = (
    "disclosed same-take editorial cuts at natural 1x playback; no speed ramps, "
    "teleport, state fabrication or substitute render"
)
CAPTURE_DESCRIPTION = (
    "one continuous input-only Strong-result browser run with multi-axis traversal, "
    "eased mouse look and two defensive shots"
)


def edit_segment(
    name: str,
    start: str,
    end: str,
    duration: float,
    core_verb: str,
    *,
    offset: float = 0,
    anchor: str = "start",
) -> dict[str, object]:
    return {
        "name": name,
        "start": start,
        "end": end,
        "duration": duration,
        "coreVerb": core_verb,
        "offset": offset,
        "anchor": anchor,
    }


EDIT_STORIES = {
    15: [
        edit_segment("field-order", "field_order:start", "field_order:end", 0.8,
                     "accept the field order", anchor="end"),
        edit_segment("route-to-brook", "fort_to_brook:start", "fort_to_brook:end", 1.0,
                     "traverse the plateau", offset=2.0),
        edit_segment("brook-camera", "brook_plate:start", "brook_plate:end", 1.5,
                     "commit a brook plate", anchor="end"),
        edit_segment("basalt-camera", "basalt_plate:start", "basalt_plate:end", 1.5,
                     "record geological scale", anchor="end"),
        edit_segment("cover-observation", "first_cover_read:start", "first_cover_read:end", 1.0,
                     "read the threat from cover", offset=2.0),
        edit_segment("young-camera", "young_play_plate:start", "young_play_plate:end", 1.5,
                     "record young behavior", anchor="end"),
        edit_segment("dive-defense", "attack_ready", "rifle_response", 1.7,
                     "interrupt one dive"),
        edit_segment("branch-camera", "branch_pull_plate:start", "branch_pull_plate:end", 1.5,
                     "record branch pulling", anchor="end"),
        edit_segment("exposed-return", "exposed_return:start", "exposed_return:end", 1.5,
                     "extract by the exposed creek", offset=5.0),
        edit_segment("strong-result", "result:start", "demo_end", 3.0,
                     "deliver a Strong field record"),
    ],
    30: [
        edit_segment("field-order", "field_order:start", "field_order:end", 1.5,
                     "accept the field order", anchor="end"),
        edit_segment("route-to-brook", "fort_to_brook:start", "fort_to_brook:end", 3.0,
                     "traverse the plateau"),
        edit_segment("brook-camera", "brook_plate:start", "brook_plate:end", 2.1,
                     "commit a brook plate", anchor="end"),
        edit_segment("route-to-basalt", "brook_to_basalt:start", "brook_to_basalt:end", 2.5,
                     "follow the brook inland", offset=2.0),
        edit_segment("basalt-camera", "basalt_plate:start", "basalt_plate:end", 2.1,
                     "record geological scale", anchor="end"),
        edit_segment("cover-observation", "first_cover_read:start", "first_cover_read:end", 3.6,
                     "read the threat from cover", offset=1.0),
        edit_segment("route-to-glade", "canopy_to_glade:start", "canopy_to_glade:end", 2.5,
                     "enter the family glade"),
        edit_segment("young-camera", "young_play_plate:start", "young_play_plate:end", 2.1,
                     "record young behavior", anchor="end"),
        edit_segment("dive-defense", "attack_ready", "rifle_response", 1.7,
                     "interrupt one dive"),
        edit_segment("branch-camera", "branch_pull_plate:start", "branch_pull_plate:end", 2.1,
                     "record branch pulling", anchor="end"),
        edit_segment("exposed-return", "exposed_return:start", "exposed_return:end", 3.0,
                     "extract by the exposed creek", offset=3.0),
        edit_segment("strong-result", "result:start", "demo_end", 3.8,
                     "deliver a Strong field record"),
    ],
}
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

FORWARD_WEAVE = (
    (("KeyW", "KeyD"), -0.10, -0.015, 540),
    (("KeyW",), 0.08, 0.02, 650),
    (("KeyW", "KeyA"), 0.13, -0.01, 540),
    (("KeyW",), -0.05, 0.0, 650),
)
BACKWARD_WEAVE = (
    (("KeyS",), 0.12, -0.015, 650),
    (("KeyS",), -0.10, 0.02, 650),
    (("KeyS",), -0.08, -0.01, 650),
    (("KeyS",), 0.10, 0.0, 650),
)


def git_head() -> str:
    """Read media provenance without coupling the recorder to the QA verifier."""
    return subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        raise RuntimeError(f"Required command is unavailable: {tool}")
    return path


def runtime_source_fingerprint(commit: str | None = None) -> str:
    """Hash interactive inputs without creating a preview-output cycle."""
    excluded_prefix = "public/media/project-plateau-preview"
    if commit is None:
        paths = [APP / "index.html", APP / "package.json", APP / "package-lock.json"]
        paths += sorted((APP / "public").rglob("*")) + sorted((APP / "src").rglob("*"))
        entries = [
            (path.relative_to(APP).as_posix(), path.read_bytes())
            for path in paths
            if path.is_file() and not path.relative_to(APP).as_posix().startswith(excluded_prefix)
        ]
    else:
        app_relative = APP.relative_to(REPO).as_posix()
        listed = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", commit, "--", app_relative],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=True,
        )
        selected = []
        for repository_path in listed.stdout.splitlines():
            relative = Path(repository_path).relative_to(app_relative).as_posix()
            if relative.startswith(excluded_prefix):
                continue
            if relative in {"index.html", "package.json", "package-lock.json"} or relative.startswith(
                ("public/", "src/")
            ):
                selected.append((relative, repository_path))
        order = {"index.html": 0, "package.json": 1, "package-lock.json": 2}
        selected.sort(key=lambda item: (order.get(item[0], 3), item[0]))
        entries = []
        for relative, repository_path in selected:
            blob = subprocess.run(
                ["git", "show", f"{commit}:{repository_path}"],
                cwd=REPO,
                capture_output=True,
                check=True,
            )
            entries.append((relative, blob.stdout))
    digest = hashlib.sha256()
    for relative, payload in entries:
        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update(payload)
        digest.update(b"\0")
    return digest.hexdigest()


def start_server() -> tuple[subprocess.Popen[str], str]:
    # Own a fresh strict port. Reusing whatever happens to answer on 4173 can
    # capture stale bytes while the manifest still claims the current commit.
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    process = subprocess.Popen(
        [
            "npm", "run", "start", "--", "--host", "127.0.0.1",
            "--port", str(port), "--strictPort",
        ],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    for _ in range(80):
        with socket.socket() as probe:
            try:
                probe.connect(("127.0.0.1", port))
                return process, f"http://127.0.0.1:{port}"
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Vite exited before media capture")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for media capture")


def snapshot(page: Page) -> dict[str, object]:
    return page.evaluate("window.__projectPlateau.snapshot()")


class Take:
    def __init__(self, page: Page, started: float):
        self.page = page
        self.started = started
        self.marks: list[dict[str, object]] = []
        self.pointer = [VIEW["width"] / 2, VIEW["height"] / 2]

    def mark(self, label: str, **details: object) -> float:
        elapsed = round(time.monotonic() - self.started, 3)
        self.marks.append({"label": label, "t": elapsed, **details})
        print(f"  [{elapsed:6.2f}s] {label}")
        return elapsed

    def at(self, label: str) -> float:
        return next(float(mark["t"]) for mark in self.marks if mark["label"] == label)


def aim_with_mouse(take: Take, heading: float, pitch: float) -> None:
    """Aim with pointer input while keeping the route heading reproducible."""
    current = snapshot(take.page)["player"]
    movement_x = (float(current["heading"]) - heading) / 0.002
    movement_y = (float(current["pitch"]) - pitch) / 0.0016
    target_x = max(0, min(VIEW["width"], take.pointer[0] + movement_x))
    target_y = max(0, min(VIEW["height"], take.pointer[1] + movement_y))
    take.page.mouse.move(target_x, target_y)
    take.pointer = [target_x, target_y]
    aimed = snapshot(take.page)["player"]
    if abs(float(aimed["heading"]) - heading) > 0.015 or abs(float(aimed["pitch"]) - pitch) > 0.015:
        raise RuntimeError(f"Pointer aim missed target: {aimed}")


def smooth_aim(take: Take, heading: float, pitch: float, duration_ms: int = 420) -> None:
    """Turn with a short eased mouse gesture instead of snapping the view."""
    player = snapshot(take.page)["player"]
    start_heading = float(player["heading"])
    start_pitch = float(player["pitch"])
    steps = max(4, duration_ms // 45)
    for step in range(1, steps + 1):
        progress = step / steps
        eased = progress * progress * (3 - 2 * progress)
        aim_with_mouse(
            take,
            start_heading + (heading - start_heading) * eased,
            start_pitch + (pitch - start_pitch) * eased,
        )
        take.page.wait_for_timeout(duration_ms / steps)


def move_leg(
    take: Take,
    keys: tuple[str, ...],
    heading: float,
    pitch: float,
    duration_ms: int,
) -> None:
    for key in keys:
        take.page.keyboard.down(key)
    try:
        smooth_aim(take, heading, pitch, duration_ms)
    finally:
        for key in reversed(keys):
            take.page.keyboard.up(key)


def move_naturally_until(
    take: Take,
    predicate: str,
    label: str,
    choreography: tuple[tuple[tuple[str, ...], float, float, int], ...],
    timeout: int = 30000,
) -> None:
    """Traverse with diagonal inputs and an eased changing view until the route gate is met."""
    take.mark(
        f"{label}:start",
        input=" + ".join(sorted({key for leg in choreography for key in leg[0]})),
        position=snapshot(take.page)["player"]["position"],
    )
    deadline = time.monotonic() + timeout / 1000
    leg = 0
    while not take.page.evaluate(predicate):
        if time.monotonic() > deadline:
            print("  route timeout snapshot:", json.dumps(snapshot(take.page)["player"], sort_keys=True))
            raise RuntimeError(f"Natural route timed out: {label}")
        move_leg(take, *choreography[leg % len(choreography)])
        leg += 1
    if snapshot(take.page)["player"]["runStatus"] == "active":
        smooth_aim(take, 0, 0, 320)
    take.page.wait_for_timeout(160)
    take.mark(f"{label}:end", position=snapshot(take.page)["player"]["position"])


def expose_plate(take: Take, index: int, label: str) -> None:
    page = take.page
    take.mark(f"{label}:start", input="Right Mouse + Left Mouse", plate=index + 1)
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
    plate = snapshot(page)["player"]["plates"][index]
    take.mark(f"{label}:end", frame=plate["frameKey"], points=plate["points"])


def wait_for_cover(take: Take, label: str) -> None:
    take.mark(f"{label}:start", input="hold position under cover")
    take.page.wait_for_function(
        "window.__projectPlateau.snapshot().player.threatAwareness <= 2",
        timeout=8000,
    )
    take.mark(f"{label}:end", awareness=snapshot(take.page)["player"]["threatAwareness"])


def interrupt_dive(take: Take, label_prefix: str = "") -> None:
    """Make the limited defensive verb readable without manufacturing state."""
    page = take.page
    before = snapshot(page)["player"]
    assert before["threatState"] == "attack", before
    route_heading = float(before["heading"])
    route_pitch = float(before["pitch"])
    aim_with_mouse(take, 0.14, 0.2)
    take.mark(
        f"{label_prefix}attack_ready",
        state=before["threatState"],
        cartridges=before["cartridges"],
        threat=snapshot(page)["threatVisual"],
    )
    page.wait_for_function(
        "window.__projectPlateau.snapshot().threatVisual.attackStage === 'fold-dive'",
        timeout=1500,
    )
    take.mark(f"{label_prefix}dive_commit", threat=snapshot(page)["threatVisual"])
    page.keyboard.down("KeyF")
    take.mark(f"{label_prefix}rifle_raise", input="hold F")
    page.wait_for_timeout(340)
    # Pointer lock turns an absolute mouse move into look input. Fire at the
    # current cursor position so the demo does not silently rotate the player
    # before the exposed return.
    heading_before_shot = snapshot(page)["player"]["heading"]
    page.mouse.down(button="left")
    page.mouse.up(button="left")
    take.mark(f"{label_prefix}rifle_fire", input="Left Mouse")
    page.wait_for_function(
        f"window.__projectPlateau.snapshot().player.shotCount === {before['shotCount'] + 1}",
        timeout=1500,
    )
    page.wait_for_timeout(720)
    page.keyboard.up("KeyF")
    page.wait_for_timeout(280)
    after = snapshot(page)["player"]
    assert after["cartridges"] == before["cartridges"] - 1, after
    assert abs(after["heading"] - heading_before_shot) < 1e-6, after
    take.mark(
        f"{label_prefix}rifle_response",
        shotCount=after["shotCount"],
        cartridges=after["cartridges"],
        brookResponse=after["brookResponse"],
    )
    aim_with_mouse(take, route_heading, route_pitch)


def record_take(out_dir: Path) -> tuple[Path, Take, list[str], set[str]]:
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    hosts: set[str] = set()

    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        context = browser.new_context(
            viewport=VIEW,
            record_video_dir=str(raw_dir),
            record_video_size=VIEW,
        )
        context.add_init_script(POINTER_LOCK_SHIM)
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        take = Take(page, time.monotonic())

        page.goto(f"{BASE_URL}/?media=core-loop", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        page.get_by_role("button", name="Enter the basin").click()
        page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
        page.wait_for_timeout(450)
        take.mark("demo_start", state="field-order")
        take.mark("field_order:start", state="field-order")
        page.wait_for_timeout(1600)
        take.mark("field_order:end", state="field-order")
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)
        page.mouse.move(*take.pointer)
        aim_with_mouse(take, 0, 0)

        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.z <= 45",
            "fort_to_brook",
            FORWARD_WEAVE,
        )
        page.keyboard.press("KeyE")
        expose_plate(take, 0, "brook_plate")
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.x >= 4.8",
            "clear_brook_boulder",
            (
                (("KeyW", "KeyD"), -0.14, -0.01, 520),
                (("KeyD",), 0.08, 0.01, 420),
            ),
        )
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.z <= 18",
            "brook_to_basalt",
            FORWARD_WEAVE,
        )
        expose_plate(take, 1, "basalt_plate")
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.x < 2.7",
            "enter_canopy",
            (
                (("KeyW", "KeyA"), 0.14, -0.01, 520),
                (("KeyA",), -0.08, 0.01, 420),
            ),
        )
        wait_for_cover(take, "first_cover_read")
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.z <= 2",
            "canopy_to_glade",
            FORWARD_WEAVE,
        )
        page.keyboard.press("KeyE")
        expose_plate(take, 2, "young_play_plate")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.threatState === 'attack'",
            timeout=2500,
        )
        interrupt_dive(take)
        expose_plate(take, 3, "branch_pull_plate")
        page.wait_for_function(
            "window.__projectPlateau.snapshot().player.threatState === 'attack'",
            timeout=2500,
        )
        interrupt_dive(take, "branch_")
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.x > 3.8",
            "line_up_exposed_creek",
            (
                (("KeyS", "KeyD"), 0.14, -0.01, 520),
                (("KeyD",), -0.08, 0.01, 420),
            ),
        )
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.position.z > 3.2",
            "commit_exposed_return",
            (
                (("KeyS",), -0.08, -0.01, 520),
                (("KeyS",), 0.08, 0.01, 520),
            ),
        )
        move_naturally_until(
            take,
            "window.__projectPlateau.snapshot().player.runStatus === 'result'",
            "exposed_return",
            BACKWARD_WEAVE,
        )
        result = snapshot(page)
        assert result["player"]["result"]["band"] == "strong-field-record", result
        assert result["player"]["result"]["evidence"] == 7, result
        assert result["player"]["shotCount"] == 2, result
        assert result["player"]["cartridges"] == 0, result
        assert result["player"]["returnRoute"] == "exposed", result
        assert result["player"]["returnCostSeconds"] == 18, result
        assert result["player"]["result"]["gunshotCallback"], result
        take.mark(
            "result:start",
            state="strong-field-record",
            route="exposed",
            evidence=7,
            shotCount=2,
        )
        page.wait_for_timeout(3800)
        take.mark("demo_end", state="strong-field-record")

        video = page.video
        context.close()
        browser.close()
        source = Path(video.path())

    raw_take = out_dir / "raw_take.webm"
    raw_take.unlink(missing_ok=True)
    source.rename(raw_take)
    return raw_take, take, errors, hosts


def probe(path: Path) -> dict[str, object]:
    output = subprocess.run(
        [
            need("ffprobe"), "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    details = json.loads(output.stdout)
    # ffprobe echoes the caller's absolute path. Keep the committed manifest
    # portable and avoid recording a contributor's local checkout location.
    details["format"]["filename"] = (
        str(path.relative_to(BUILD)) if path.is_relative_to(BUILD) else path.name
    )
    return details


def mark_seconds(marks: dict[str, object], label: str) -> float:
    match = next((mark for mark in marks["marks"] if mark["label"] == label), None)
    if match is None:
        raise RuntimeError(f"Missing capture mark required by edit story: {label}")
    return float(match["t"]) + float(marks["raw"]["marksToSourceOffset"])


def story_segments(marks: dict[str, object], target_seconds: int) -> list[dict[str, object]]:
    output_cursor = 0.0
    segments: list[dict[str, object]] = []
    for story in EDIT_STORIES[target_seconds]:
        name = story["name"]
        start_label = story["start"]
        end_label = story["end"]
        duration = float(story["duration"])
        source_start = mark_seconds(marks, start_label)
        source_end = mark_seconds(marks, end_label)
        if story.get("anchor", "start") == "end":
            source_end -= float(story.get("offset", 0))
            source_start = source_end - duration
        else:
            source_start += float(story.get("offset", 0))
            source_end = source_start + duration
        window_start = mark_seconds(marks, start_label)
        window_end = mark_seconds(marks, end_label)
        if source_start < window_start - 0.001 or source_end > window_end + 0.001:
            raise RuntimeError(
                f"Natural-speed slice {name} exceeds its marked window: "
                f"{source_start:.3f}..{source_end:.3f} outside "
                f"{window_start:.3f}..{window_end:.3f}"
            )
        segments.append({
            "name": name,
            "coreVerb": story["coreVerb"],
            "sourceStartLabel": start_label,
            "sourceEndLabel": end_label,
            "sourceStartSeconds": round(source_start, 3),
            "sourceEndSeconds": round(source_end, 3),
            "sourceDurationSeconds": duration,
            "outputStartSeconds": round(output_cursor, 3),
            "outputEndSeconds": round(output_cursor + duration, 3),
            "outputDurationSeconds": duration,
            "playbackRate": 1.0,
        })
        output_cursor += duration
    if abs(output_cursor - target_seconds) > 1e-6:
        raise RuntimeError(f"{target_seconds}s story totals {output_cursor:.3f}s")
    return segments


def encode_story(source: Path, output: Path, segments: list[dict[str, object]]) -> None:
    filters: list[str] = []
    inputs: list[str] = []
    for index, segment in enumerate(segments):
        filters.append(
            f"[0:v]trim=start={segment['sourceStartSeconds']}:end={segment['sourceEndSeconds']},"
            f"setpts=PTS-STARTPTS[v{index}]"
        )
        inputs.append(f"[v{index}]")
    target = sum(float(segment["outputDurationSeconds"]) for segment in segments)
    filters.append(
        f"{''.join(inputs)}concat=n={len(segments)}:v=1:a=0,"
        f"tpad=stop_mode=clone:stop_duration=0.2,trim=duration={target:.3f},"
        "fps=30,scale=1280:800:flags=lanczos,setsar=1:1[vout]"
    )
    subprocess.run(
        [
            need("ffmpeg"), "-y", "-i", str(source),
            "-filter_complex", ";".join(filters), "-map", "[vout]",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
            "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow",
            "-g", "60", "-keyint_min", "60", "-x264-params", "open-gop=0",
            "-movflags", "+faststart", "-an", "-t", f"{target:.3f}", str(output),
        ],
        check=True,
        capture_output=True,
    )


def publish_preview(source: Path, segments: list[dict[str, object]], marks: dict[str, object]) -> dict[str, object]:
    PUBLIC_MEDIA.mkdir(parents=True, exist_ok=True)
    video = PUBLIC_MEDIA / "project-plateau-preview-15s.mp4"
    poster = PUBLIC_MEDIA / "project-plateau-preview-poster.jpg"
    subprocess.run(
        [
            need("ffmpeg"), "-y", "-i", str(source),
            "-vf", "fps=30,scale=960:600:flags=lanczos,setsar=1:1",
            "-c:v", "libx264", "-profile:v", "high", "-level", "3.1",
            "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "slow",
            "-g", "60", "-keyint_min", "60", "-x264-params", "open-gop=0",
            "-movflags", "+faststart", "-an", "-t", "15", str(video),
        ],
        check=True,
        capture_output=True,
    )
    poster_second = 4.8
    subprocess.run(
        [
            need("ffmpeg"), "-y", "-ss", str(poster_second), "-i", str(video),
            "-frames:v", "1", "-q:v", "3", str(poster),
        ],
        check=True,
        capture_output=True,
    )
    video_probe = probe(video)
    video_probe["format"]["filename"] = str(video.relative_to(APP))
    preview = {
        "schemaVersion": 2,
        "purpose": "mobile, social in-app browser and WebGL2-unavailable conversion preview",
        "capture": marks["capture"],
        "edit": EDIT_DESCRIPTION,
        "interactiveSourceCommit": marks["sourceCommit"],
        "interactiveSourceFingerprint": marks["sourceFingerprint"],
        "interactiveSourceFingerprintScope": marks["sourceFingerprintScope"],
        "source": {
            "path": "../media/clip/project-plateau-15s.mp4",
            "sha256": sha256(source),
            "bytes": source.stat().st_size,
        },
        "video": {
            "path": "public/media/project-plateau-preview-15s.mp4",
            "sha256": sha256(video),
            "bytes": video.stat().st_size,
            "probe": video_probe,
        },
        "poster": {
            "path": "public/media/project-plateau-preview-poster.jpg",
            "sha256": sha256(poster),
            "bytes": poster.stat().st_size,
            "sourceSecond": poster_second,
        },
        "storyBeats": segments,
        "delivery": {
            "preload": "none until preview routing",
            "autoplay": "muted playsinline; controls remain available",
            "interactiveRuntimeLoadedInPreviewMode": False,
        },
        "limitations": [
            "The edited preview is not gameplay-timing evidence; build/evidence/current-run/report.json remains authoritative.",
            "The preview is a conversion fallback, not a substitute for desktop WebGL2 QA.",
        ],
    }
    return preview


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_raw_provenance(raw_take: Path, marks: dict[str, object]) -> float:
    """Fail closed before a reused take can mint new delivery claims."""
    if not raw_take.is_file():
        raise RuntimeError(f"Raw take does not exist: {raw_take}")
    raw = marks.get("raw")
    if not isinstance(raw, dict):
        raise RuntimeError("marks.raw must be an object")
    expected_path = str(raw_take.relative_to(BUILD))
    checks = {
        "path": raw.get("path") == expected_path,
        "bytes": raw.get("bytes") == raw_take.stat().st_size,
        "sha256": raw.get("sha256") == sha256(raw_take),
        "sourceCommit": isinstance(marks.get("sourceCommit"), str)
        and runtime_source_fingerprint(marks["sourceCommit"]) == marks.get("sourceFingerprint"),
        "sourceFingerprintScope": marks.get("sourceFingerprintScope") == RUNTIME_FINGERPRINT_SCOPE,
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError(f"Raw take provenance mismatch: {', '.join(failed)}")

    details = probe(raw_take)
    actual_duration = float(details["format"]["duration"])
    recorded_duration = float(raw.get("durationSeconds", -1))
    if abs(actual_duration - recorded_duration) > 0.05:
        raise RuntimeError(
            f"Raw take duration mismatch: recorded={recorded_duration:.3f}, "
            f"actual={actual_duration:.3f}"
        )
    offset = float(raw.get("marksToSourceOffset", 0))
    raw_marks = marks.get("marks")
    if not isinstance(raw_marks, list):
        raise RuntimeError("marks.marks must be an array")
    for mark in raw_marks:
        source_second = float(mark["t"]) + offset
        if source_second < -0.001 or source_second > actual_duration + 0.001:
            raise RuntimeError(
                f"Capture mark {mark.get('label')} lies outside the raw take: {source_second:.3f}s"
            )
    demo_window = marks.get("demoWindow")
    if not isinstance(demo_window, dict):
        raise RuntimeError("marks.demoWindow must be an object")
    demo_start = float(demo_window.get("sourceStartSeconds", -1))
    demo_end = demo_start + float(demo_window.get("sourceDurationSeconds", -1))
    if demo_start < 0 or demo_end > actual_duration + 0.001 or demo_end <= demo_start:
        raise RuntimeError(
            f"Demo window lies outside the raw take: {demo_start:.3f}..{demo_end:.3f}s"
        )
    return actual_duration


def validate_story_segments(segments: list[dict[str, object]], raw_duration: float) -> None:
    for segment in segments:
        start = float(segment["sourceStartSeconds"])
        end = float(segment["sourceEndSeconds"])
        if start < 0 or end <= start or end > raw_duration + 0.001:
            raise RuntimeError(
                f"Story segment {segment['name']} lies outside the raw take: "
                f"{start:.3f}..{end:.3f}s"
            )
        source_duration = float(segment["sourceDurationSeconds"])
        output_duration = float(segment["outputDurationSeconds"])
        if abs(source_duration - output_duration) > 0.001 or segment["playbackRate"] != 1.0:
            raise RuntimeError(f"Story segment {segment['name']} is not natural 1x playback")


def main() -> int:
    global BASE_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=CLIP)
    parser.add_argument("--no-encode", action="store_true")
    parser.add_argument("--reuse-raw", action="store_true", help="Re-encode the existing raw take and marks")
    args = parser.parse_args()
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    marks_path = out_dir / "marks.json"
    if args.reuse_raw:
        raw_take = out_dir / "raw_take.webm"
        marks = json.loads(marks_path.read_text())
        raw_duration = validate_raw_provenance(raw_take, marks)
        marks["capture"] = CAPTURE_DESCRIPTION
        marks["edit"] = EDIT_DESCRIPTION
        marks_path.write_text(json.dumps(marks, indent=2) + "\n")
        print(f"Reusing raw take: {raw_take}")
    else:
        capture_source_commit = git_head()
        capture_source_fingerprint = runtime_source_fingerprint(capture_source_commit)
        working_source_fingerprint = runtime_source_fingerprint()
        if working_source_fingerprint != capture_source_fingerprint:
            raise RuntimeError(
                "Interactive runtime inputs differ from HEAD; commit them before capture"
            )
        server, BASE_URL = start_server()
        try:
            raw_take, take, errors, hosts = record_take(out_dir)
        finally:
            server.terminate()
            server.wait(timeout=5)

        allowed = {"", urlparse(BASE_URL).netloc}
        external = sorted(hosts - allowed)
        assert not errors, errors
        assert not external, external
        raw_probe = probe(raw_take)
        raw_duration = float(raw_probe["format"]["duration"])
        # Take's monotonic origin is created immediately after Playwright opens
        # the record_video page, so marks already use the raw stream timeline.
        # The container may retain encoder tail after demo_end; treating that
        # tail as a leading offset used to shift every edit past its real verb.
        offset = 0.0
        marks = {
            "capture": CAPTURE_DESCRIPTION,
            "edit": EDIT_DESCRIPTION,
            "viewport": VIEW,
            "url": f"{BASE_URL}/?media=core-loop",
            "pointerLockMode": "deterministic-browser-shim",
            "sourceCommit": capture_source_commit,
            "sourceFingerprint": capture_source_fingerprint,
            "sourceFingerprintScope": RUNTIME_FINGERPRINT_SCOPE,
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
            "raw": {
                "path": str(raw_take.relative_to(BUILD)),
                "bytes": raw_take.stat().st_size,
                "sha256": sha256(raw_take),
                "durationSeconds": raw_duration,
                "marksToSourceOffset": offset,
                "trailingCaptureSeconds": round(raw_duration - take.at("demo_end"), 3),
            },
            "demoWindow": {
                "sourceStartSeconds": round(take.at("demo_start") + offset, 3),
                "sourceDurationSeconds": round(take.at("demo_end") - take.at("demo_start"), 3),
            },
            "marks": take.marks,
        }
        marks_path.write_text(json.dumps(marks, indent=2) + "\n")
        print(f"Raw take: {raw_take} ({raw_duration:.2f}s, {raw_take.stat().st_size / 1e6:.2f}MB)")
        print(f"Marks: {marks_path}")
        raw_duration = validate_raw_provenance(raw_take, marks)
    if args.no_encode:
        return 0

    encodes: list[dict[str, object]] = []
    for seconds in (30, 15):
        output = out_dir / f"project-plateau-{seconds}s.mp4"
        segments = story_segments(marks, seconds)
        validate_story_segments(segments, raw_duration)
        encode_story(raw_take, output, segments)
        verify = subprocess.run(
            [sys.executable, str(XCLIP), "verify", str(output)],
            capture_output=True,
            text=True,
        )
        print(verify.stdout)
        assert verify.returncode == 0, verify.stdout + verify.stderr
        details = probe(output)
        encodes.append(
            {
                "path": str(output.relative_to(BUILD)),
                "targetSeconds": seconds,
                "segments": segments,
                "bytes": output.stat().st_size,
                "sha256": sha256(output),
                "probe": details,
                "verification": verify.stdout.strip().splitlines(),
            }
        )

    preview = publish_preview(
        out_dir / "project-plateau-15s.mp4",
        next(encode["segments"] for encode in encodes if encode["targetSeconds"] == 15),
        marks,
    )

    contact_sheets: list[dict[str, object]] = []
    for seconds, filename, sampling in (
        (15, "contact-sheet.jpg", "one frame every 1.5 seconds from the promoted 15-second encode"),
        (30, "contact-sheet-30s.jpg", "one frame every three seconds from the 30-second encode"),
    ):
        contact_sheet = out_dir / filename
        subprocess.run(
            [
                need("ffmpeg"), "-y", "-i", str(out_dir / f"project-plateau-{seconds}s.mp4"),
                "-vf", f"fps=1/{seconds / 10:g},scale=480:-2,tile=5x2",
                "-frames:v", "1", str(contact_sheet),
            ],
            check=True,
            capture_output=True,
        )
        contact_sheets.append({
            "path": str(contact_sheet.relative_to(BUILD)),
            "bytes": contact_sheet.stat().st_size,
            "sha256": sha256(contact_sheet),
            "sampling": sampling,
        })
    share_card = out_dir.parent / "project-plateau-github.jpg"
    card = subprocess.run(
        [
            sys.executable, str(XCLIP), "card",
            str(BUILD / "evidence" / "current-run" / "03-strong-glade-frames.jpg"),
            "--out", str(share_card), "--kind", "github", "--top", "20",
            "--bottom", "160", "--anchor", "center", "--quality", "3",
        ],
        capture_output=True,
        text=True,
    )
    print(card.stdout)
    assert card.returncode == 0, card.stdout + card.stderr

    manifest = {
        "sourceCommit": marks["sourceCommit"],
        "sourceFingerprint": marks["sourceFingerprint"],
        "sourceFingerprintScope": marks["sourceFingerprintScope"],
        "capture": marks["capture"],
        "edit": marks["edit"],
        "rawSha256": marks["raw"]["sha256"],
        "encodes": encodes,
        "contactSheets": contact_sheets,
        "shareCard": {
            "path": str(share_card.relative_to(BUILD)),
            "bytes": share_card.stat().st_size,
            "sha256": sha256(share_card),
            "source": "evidence/current-run/03-strong-glade-frames.jpg",
            "transform": "crop and resize only; no added text or generated imagery",
        },
        "publicPreview": {
            "path": preview["video"]["path"],
            "bytes": preview["video"]["bytes"],
            "sha256": preview["video"]["sha256"],
            "posterPath": preview["poster"]["path"],
            "posterSha256": preview["poster"]["sha256"],
        },
        "limitations": [
            "The delivery encodes use disclosed same-take cuts at natural 1x playback and therefore are not continuous traversal-timing evidence.",
            "build/evidence/current-run/report.json remains the authoritative input-only traversal and timing record.",
            "The local MP4/WebM files are reproducible delivery artifacts and are intentionally excluded from Git history.",
        ],
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
