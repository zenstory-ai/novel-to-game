#!/usr/bin/env python3
"""Record one continuous input-only Strong run and derive 30s/15s previews.

The delivery clips use uniform time compression over one uncut browser take.
They do not teleport, advance time through a QA hook, splice state, or replace
the S8 traversal report. Raw and encoded video stay out of Git; the capture
marks, hashes, measured probe data and real share card remain reproducible.
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

APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
REPO = BUILD.parents[2]
MEDIA = BUILD / "media"
CLIP = MEDIA / "clip"
EVIDENCE = BUILD / "evidence" / "s8"
XCLIP = REPO / "scripts" / "xclip.py"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEW = {"width": 1280, "height": 800}


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        raise RuntimeError(f"Required command is unavailable: {tool}")
    return path


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

    def mark(self, label: str, **details: object) -> float:
        elapsed = round(time.monotonic() - self.started, 3)
        self.marks.append({"label": label, "t": elapsed, **details})
        print(f"  [{elapsed:6.2f}s] {label}")
        return elapsed

    def at(self, label: str) -> float:
        return next(float(mark["t"]) for mark in self.marks if mark["label"] == label)


def move_until(take: Take, key: str, predicate: str, label: str, timeout: int = 30000) -> None:
    take.mark(f"{label}:start", input=key, position=snapshot(take.page)["player"]["position"])
    take.page.keyboard.down(key)
    try:
        take.page.wait_for_function(predicate, timeout=timeout)
    finally:
        take.page.keyboard.up(key)
    take.page.wait_for_timeout(70)
    take.mark(f"{label}:end", position=snapshot(take.page)["player"]["position"])


def expose_plate(take: Take, index: int, label: str) -> None:
    page = take.page
    take.mark(f"{label}:start", input="Right Mouse + Left Mouse", plate=index + 1)
    page.mouse.move(VIEW["width"] / 2, VIEW["height"] / 2)
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
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("request", lambda request: hosts.add(urlparse(request.url).netloc))
        take = Take(page, time.monotonic())

        page.goto(f"{BASE_URL}/?media=strong", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        page.get_by_role("button", name="Enter the basin").click()
        page.wait_for_timeout(1200)
        take.mark("strong_start", state="field-order")
        page.get_by_role("button", name="Begin field work").click()
        page.wait_for_timeout(100)

        move_until(take, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 45", "fort_to_brook")
        page.keyboard.press("KeyE")
        expose_plate(take, 0, "brook_plate")
        move_until(take, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 18", "brook_to_basalt")
        expose_plate(take, 1, "basalt_plate")
        move_until(take, "KeyA", "window.__projectPlateau.snapshot().player.position.x < 2.7", "enter_canopy")
        wait_for_cover(take, "first_cover_read")
        move_until(take, "KeyW", "window.__projectPlateau.snapshot().player.position.z <= 2", "canopy_to_glade")
        page.keyboard.press("KeyE")
        expose_plate(take, 2, "young_play_plate")
        expose_plate(take, 3, "branch_pull_plate")
        move_until(take, "KeyS", "window.__projectPlateau.snapshot().player.position.z > 3.2", "retreat_to_cover")
        wait_for_cover(take, "final_cover_read")
        move_until(take, "KeyS", "window.__projectPlateau.snapshot().player.position.z >= 62", "covered_return")
        page.wait_for_function("window.__projectPlateau.snapshot().player.runStatus === 'result'", timeout=1000)
        result = snapshot(page)
        assert result["player"]["result"]["band"] == "strong-field-record", result
        assert result["player"]["result"]["evidence"] == 7, result
        page.wait_for_timeout(1800)
        take.mark("strong_end", state="strong-field-record")

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


def encode_uniform_speed(source: Path, output: Path, start: float, source_duration: float, target: float) -> None:
    speed = source_duration / target
    subprocess.run(
        [
            need("ffmpeg"), "-y", "-i", str(source), "-ss", f"{start:.3f}",
            "-t", f"{source_duration:.3f}", "-vf",
            f"setpts=(PTS-STARTPTS)/{speed:.8f},fps=30,tpad=stop_mode=clone:stop_duration=4,setsar=1:1",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
            "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow",
            "-g", "60", "-keyint_min", "60", "-x264-params", "open-gop=0",
            "-movflags", "+faststart", "-an", "-t", f"{target:.3f}", str(output),
        ],
        check=True,
        capture_output=True,
    )


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
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
        source_start = float(marks["strongWindow"]["sourceStartSeconds"])
        source_duration = float(marks["strongWindow"]["sourceDurationSeconds"])
        print(f"Reusing raw take: {raw_take}")
    else:
        server = start_server()
        try:
            raw_take, take, errors, hosts = record_take(out_dir)
        finally:
            if server:
                server.terminate()
                server.wait(timeout=5)

        allowed = {urlparse(BASE_URL).netloc}
        external = sorted(hosts - allowed)
        assert not errors, errors
        assert not external, external
        raw_probe = probe(raw_take)
        raw_duration = float(raw_probe["format"]["duration"])
        offset = round(raw_duration - take.at("strong_end"), 3)
        source_start = take.at("strong_start") + offset
        source_duration = take.at("strong_end") - take.at("strong_start")
        marks = {
            "capture": "one continuous input-only Strong run",
            "edit": "uniform time compression only; no state cuts or splices",
            "viewport": VIEW,
            "url": f"{BASE_URL}/?media=strong",
            "sourceFingerprint": json.loads((EVIDENCE / "report.json").read_text())["source"]["sha256"],
            "consoleErrors": errors,
            "requestHosts": sorted(hosts),
            "externalHosts": external,
            "raw": {
                "path": str(raw_take.relative_to(BUILD)),
                "bytes": raw_take.stat().st_size,
                "sha256": sha256(raw_take),
                "durationSeconds": raw_duration,
                "marksToSourceOffset": offset,
            },
            "strongWindow": {
                "sourceStartSeconds": round(source_start, 3),
                "sourceDurationSeconds": round(source_duration, 3),
            },
            "marks": take.marks,
        }
        marks_path.write_text(json.dumps(marks, indent=2) + "\n")
        print(f"Raw take: {raw_take} ({raw_duration:.2f}s, {raw_take.stat().st_size / 1e6:.2f}MB)")
        print(f"Marks: {marks_path}")
    if args.no_encode:
        return 0

    encodes: list[dict[str, object]] = []
    for seconds in (30, 15):
        output = out_dir / f"project-plateau-{seconds}s.mp4"
        encode_uniform_speed(raw_take, output, source_start, source_duration, seconds)
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
                "speed": round(source_duration / seconds, 5),
                "bytes": output.stat().st_size,
                "sha256": sha256(output),
                "probe": details,
                "verification": verify.stdout.strip().splitlines(),
            }
        )

    contact_sheet = out_dir / "contact-sheet.jpg"
    subprocess.run(
        [
            need("ffmpeg"), "-y", "-i", str(out_dir / "project-plateau-30s.mp4"),
            "-vf", "fps=1/3,scale=480:-2,tile=5x2", "-frames:v", "1", str(contact_sheet),
        ],
        check=True,
        capture_output=True,
    )
    share_card = out_dir.parent / "project-plateau-github.jpg"
    card = subprocess.run(
        [
            sys.executable, str(XCLIP), "card",
            str(BUILD / "evidence" / "s10" / "02-young-play-silver-frame.jpg"),
            "--out", str(share_card), "--kind", "github", "--top", "20",
            "--bottom", "160", "--anchor", "center", "--quality", "3",
        ],
        capture_output=True,
        text=True,
    )
    print(card.stdout)
    assert card.returncode == 0, card.stdout + card.stderr

    manifest = {
        "sourceFingerprint": marks["sourceFingerprint"],
        "capture": marks["capture"],
        "edit": marks["edit"],
        "rawSha256": marks["raw"]["sha256"],
        "encodes": encodes,
        "contactSheet": {
            "path": str(contact_sheet.relative_to(BUILD)),
            "bytes": contact_sheet.stat().st_size,
            "sha256": sha256(contact_sheet),
            "sampling": "one frame every three seconds from the 30-second encode",
        },
        "shareCard": {
            "path": str(share_card.relative_to(BUILD)),
            "bytes": share_card.stat().st_size,
            "sha256": sha256(share_card),
            "source": "evidence/s10/02-young-play-silver-frame.jpg",
            "transform": "crop and resize only; no added text or generated imagery",
        },
        "limitations": [
            "The delivery encodes are uniformly time-compressed and therefore are not timing evidence.",
            "S8 report.json remains the authoritative input-only traversal and timing record.",
            "The local MP4/WebM files are reproducible delivery artifacts and are intentionally excluded from Git history.",
        ],
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
