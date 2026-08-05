#!/usr/bin/env python3
"""Capture compact still and continuous-motion evidence for the glade."""

from __future__ import annotations

import hashlib
import base64
import json
from pathlib import Path
import shutil
import socket
import subprocess
import time

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
OUTPUT = PROJECT / "build" / "evidence" / "visual-upgrade" / "generated"
MOTION = OUTPUT / "motion"
TARGETS = PROJECT / "design" / "visual-targets"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
VIEWPORTS = ((1440, 900), (1280, 720))
FROZEN_TIME = 4.25
JPEG_QUALITY = 84
CAPTURE_SCHEMA_VERSION = 2


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_fingerprint() -> str:
    """Bind captures to the same publishable app inputs as verify.py."""
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


def resource_matches(resource: object) -> bool:
    """Accept only workspace-local resources whose recorded bytes still match."""
    if not isinstance(resource, dict) or not isinstance(resource.get("path"), str):
        return False
    project_root = PROJECT.resolve()
    path = (PROJECT / resource["path"]).resolve()
    return (
        path.is_relative_to(project_root)
        and path.is_file()
        and path.stat().st_size == resource.get("bytes")
        and sha256(path) == resource.get("sha256")
    )


def reusable_capture_manifest(fingerprint: str) -> dict[str, object] | None:
    """Keep a reviewed evidence candidate immutable while its app inputs match."""
    manifest_path = OUTPUT / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return None
    if (
        manifest.get("schemaVersion") != CAPTURE_SCHEMA_VERSION
        or manifest.get("sourceFingerprint") != fingerprint
        or manifest.get("consoleErrors") != []
    ):
        return None
    captures = manifest.get("captures")
    targets = manifest.get("targets")
    cadence = manifest.get("motionCadence")
    if not isinstance(captures, list) or not captures:
        return None
    if not isinstance(targets, list) or not targets or not isinstance(cadence, dict):
        return None
    samples = cadence.get("samples")
    if not isinstance(samples, list) or cadence.get("consoleErrors") != []:
        return None
    resources = [
        *captures,
        manifest.get("contactSheet"),
        *targets,
        cadence.get("video"),
        *samples,
    ]
    return manifest if all(resource_matches(resource) for resource in resources) else None


def reusable_motion_cadence(fingerprint: str) -> dict[str, object] | None:
    """Reuse a hash-valid uncut take for unchanged publishable app inputs."""
    manifest_path = OUTPUT / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        cadence = manifest["motionCadence"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return None
    if (
        manifest.get("schemaVersion") != CAPTURE_SCHEMA_VERSION
        or manifest.get("sourceFingerprint") != fingerprint
        or not isinstance(cadence, dict)
    ):
        return None
    samples = cadence.get("samples")
    if not isinstance(samples, list) or cadence.get("consoleErrors") != []:
        return None
    resources = [cadence.get("video"), *samples]
    for resource in resources:
        if not resource_matches(resource):
            return None
    return cadence


def start_server() -> tuple[subprocess.Popen[str], str]:
    """Start an owned Vite process without touching the interactive port 4173."""
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    process = subprocess.Popen(
        [
            "npm",
            "run",
            "start",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--strictPort",
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
                    raise RuntimeError("Vite exited before visual capture")
                time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Vite did not become ready for visual capture")


def run(base_url: str) -> dict[str, object]:
    fingerprint = source_fingerprint()
    retained_motion = reusable_motion_cadence(fingerprint)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for stale in (*OUTPUT.glob("*.png"), *OUTPUT.glob("*.jpg")):
        stale.unlink()
    errors: list[str] = []
    captures: list[dict[str, object]] = []
    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        for width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
            page.goto(f"{base_url}/?qa=visual-capture", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.evaluate("window.__projectPlateau.loadHy3dVisualsForTest()")
            title_frozen = page.evaluate(f"window.__projectPlateau.freezeVisualForTest({FROZEN_TIME})")
            page.wait_for_timeout(50)
            title_path = OUTPUT / f"title-{width}x{height}.jpg"
            page.screenshot(path=title_path, type="jpeg", quality=JPEG_QUALITY)
            captures.append({
                "id": f"title-{width}x{height}",
                "path": title_path.relative_to(PROJECT).as_posix(),
                "viewport": [width, height],
                "sha256": sha256(title_path),
                "bytes": title_path.stat().st_size,
                "frozenAnimationSeconds": title_frozen,
                "familyMoment": None,
                "threatState": "distant",
            })
            page.evaluate("window.__projectPlateau.setView('glade')")
            frozen = page.evaluate(f"window.__projectPlateau.freezeVisualForTest({FROZEN_TIME})")
            page.wait_for_timeout(100)
            for state_name, awareness in (("family", 2), ("dive", 3)):
                page.evaluate(f"window.__projectPlateau.setThreatVisualForTest({awareness}, '{state_name}')")
                page.wait_for_timeout(50)
                path = OUTPUT / f"{state_name}-{width}x{height}.jpg"
                page.screenshot(path=path, type="jpeg", quality=JPEG_QUALITY)
                state = page.evaluate("window.__projectPlateau.snapshot()")
                captures.append({
                    "id": f"{state_name}-{width}x{height}",
                    "path": path.relative_to(PROJECT).as_posix(),
                    "viewport": [width, height],
                    "sha256": sha256(path),
                    "bytes": path.stat().st_size,
                    "frozenAnimationSeconds": frozen,
                    "familyMoment": state["familyVisual"]["moment"],
                    "threatState": state["threatVisual"]["state"],
                })
            page.close()

        sheet = browser.new_page(viewport={"width": 1440, "height": 900})
        images = [
            "data:image/jpeg;base64," + base64.b64encode((PROJECT / item["path"]).read_bytes()).decode("ascii")
            for item in captures
        ]
        sheet.set_content(f"""
          <style>*{{box-sizing:border-box}}body{{margin:0;background:#101714;color:#f1e8d0;font:16px system-ui}}
          main{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px}}figure{{margin:0}}img{{width:100%;height:350px;object-fit:contain;background:#0b100e}}figcaption{{margin-bottom:6px;letter-spacing:.08em;font-size:12px}}</style>
          <main>
          <figure><figcaption>TITLE · 1440 × 900</figcaption><img src="{images[0]}"></figure>
          <figure><figcaption>FAMILY · 1440 × 900 · {FROZEN_TIME:.2f}s</figcaption><img src="{images[1]}"></figure>
          <figure><figcaption>DIVE · 1440 × 900 · {FROZEN_TIME:.2f}s</figcaption><img src="{images[2]}"></figure>
          <figure><figcaption>TITLE · 1280 × 720</figcaption><img src="{images[3]}"></figure>
          <figure><figcaption>FAMILY · 1280 × 720 · {FROZEN_TIME:.2f}s</figcaption><img src="{images[4]}"></figure>
          <figure><figcaption>DIVE · 1280 × 720 · {FROZEN_TIME:.2f}s</figcaption><img src="{images[5]}"></figure>
          </main>
        """, wait_until="load")
        sheet_path = OUTPUT / "contact-sheet-supported-viewports.jpg"
        sheet.screenshot(path=sheet_path, type="jpeg", quality=JPEG_QUALITY)
        sheet.close()

        motion = retained_motion or capture_motion_cadence(browser, base_url)
        browser.close()

    assert not errors, errors
    targets = [
        {
            "id": path.stem.split("-", 1)[1],
            "path": path.relative_to(PROJECT).as_posix(),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        }
        for path in sorted(TARGETS.glob("*.svg"))
    ]
    assert len(captures) == 6, captures
    assert len({item["sha256"] for item in captures}) == 6, captures
    assert len(targets) == 3, targets
    result = {
        "schemaVersion": CAPTURE_SCHEMA_VERSION,
        "command": "npm run capture:visual",
        "sourceFingerprint": fingerprint,
        "scene": "glade-family-under-aerial-pressure",
        "seed": 139,
        "frozenAnimationSeconds": FROZEN_TIME,
        "captures": captures,
        "contactSheet": {
            "path": sheet_path.relative_to(PROJECT).as_posix(),
            "sha256": sha256(sheet_path),
            "bytes": sheet_path.stat().st_size,
        },
        "targets": targets,
        "motionCadence": motion,
        "consoleErrors": errors,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def capture_motion_cadence(browser, base_url: str) -> dict[str, object]:
    """Bind a continuous browser take and deterministic phase samples.

    The WebM is real-time and uncut. JPEGs use the renderer's QA clock so the
    named phases remain reproducible; they are not presented as gameplay time.
    """
    MOTION.mkdir(parents=True, exist_ok=True)
    for stale in MOTION.iterdir():
        if stale.is_file():
            stale.unlink()

    errors: list[str] = []
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        record_video_dir=str(MOTION),
        record_video_size={"width": 1280, "height": 720},
    )
    page = context.new_page()
    recording_started = time.monotonic()
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
    transitions: list[dict[str, object]] = []

    page.goto(f"{base_url}/?qa=motion-cadence", wait_until="networkidle")
    page.wait_for_function("window.__projectPlateau?.ready === true")
    page.evaluate("window.__projectPlateau.loadHy3dVisualsForTest()")
    page.evaluate("window.__projectPlateau.teleportForTest({x: 1, z: -30})")
    page.evaluate("window.__projectPlateau.setView('glade')")
    page.evaluate("window.__projectPlateau.setThreatVisualForTest(1, null)")
    started = time.monotonic()
    preroll_seconds = max(0, started - recording_started)
    transitions.append({"phase": "watch", "atMs": 0, "threatState": "watch", "rendererResponse": "orbit"})
    page.wait_for_timeout(900)
    page.evaluate("window.__projectPlateau.setThreatVisualForTest(3, null)")
    transitions.append({
        "phase": "bank-dive-pull-up-cycle",
        "atMs": round((time.monotonic() - started) * 1000),
        "threatState": "attack",
        "rendererResponse": "orbit",
    })
    # 4.9 seconds exceeds the closed 4.4 second attack cycle, so the uncut
    # recording contains approach, deepest dive and recovery regardless of the
    # animation phase at the state transition.
    page.wait_for_timeout(4900)
    transitions.append({
        "phase": "cycle-complete",
        "atMs": round((time.monotonic() - started) * 1000),
        "threatState": page.evaluate("window.__projectPlateau.snapshot().threatVisual.state"),
        "rendererResponse": page.evaluate("window.__projectPlateau.snapshot().threatVisual.response"),
    })
    video = page.video
    page.close()
    context.close()
    recorded = Path(video.path())
    video_path = MOTION / "watch-bank-dive-pull-up.webm"
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to remove browser initialization frames from motion evidence")
    subprocess.run(
        [
            ffmpeg,
            "-loglevel", "error",
            "-ss", f"{preroll_seconds:.3f}",
            "-i", str(recorded),
            "-an",
            "-c:v", "libvpx-vp9",
            "-deadline", "realtime",
            "-cpu-used", "4",
            "-crf", "30",
            "-b:v", "0",
            "-y", str(video_path),
        ],
        check=True,
    )
    recorded.unlink()

    samples: list[dict[str, object]] = []
    sample_page = browser.new_page(viewport={"width": 1280, "height": 720})
    sample_page.goto(f"{base_url}/?qa=motion-cadence-samples", wait_until="networkidle")
    sample_page.wait_for_function("window.__projectPlateau?.ready === true")
    sample_page.evaluate("window.__projectPlateau.loadHy3dVisualsForTest()")
    sample_page.evaluate("window.__projectPlateau.teleportForTest({x: 1, z: -30})")
    sample_page.evaluate("window.__projectPlateau.setView('glade')")
    # Set each state before advancing its phase. Freezing first used to pin the
    # bank sample at the pre-attack entry position, leaving the subject outside
    # the frame even though its label claimed an attack phase.
    previous_awareness = None
    for phase, awareness, seconds in (
        ("watch", 1, 0.0),
        ("bank", 3, 0.72),
        ("dive", 3, 1.35),
        ("pull-up", 3, 2.85),
    ):
        if awareness != previous_awareness:
            sample_page.evaluate(f"window.__projectPlateau.setThreatVisualForTest({awareness}, null)")
            previous_awareness = awareness
        sample_page.evaluate(f"window.__projectPlateau.freezeVisualForTest({seconds})")
        sample_page.wait_for_timeout(50)
        path = MOTION / f"{phase}.jpg"
        sample_page.screenshot(path=path, type="jpeg", quality=JPEG_QUALITY)
        state = sample_page.evaluate("window.__projectPlateau.snapshot().threatVisual")
        samples.append({
            "phase": phase,
            "rendererSeconds": seconds,
            "threatState": state["state"],
            "rendererResponse": state["response"],
            "path": path.relative_to(PROJECT).as_posix(),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        })
    sample_page.close()
    assert not errors, errors
    result = {
        "claim": "continuous real-browser watch to attack cycle plus deterministic phase samples",
        "captureMode": "one continuous real-time Playwright gameplay take after browser preroll removal; QA-clock JPEG samples are phase labels, not gameplay timing",
        "authoredCycleSeconds": 4.4,
        "trimmedBrowserPrerollMs": round(preroll_seconds * 1000),
        "transitions": transitions,
        "video": {
            "path": video_path.relative_to(PROJECT).as_posix(),
            "sha256": sha256(video_path),
            "bytes": video_path.stat().st_size,
        },
        "samples": samples,
        "consoleErrors": errors,
    }
    assert [item["phase"] for item in result["samples"]] == ["watch", "bank", "dive", "pull-up"]
    assert [item["rendererSeconds"] for item in result["samples"]] == sorted(
        item["rendererSeconds"] for item in result["samples"]
    )
    assert result["transitions"][0]["atMs"] == 0
    assert result["transitions"][-1]["atMs"] >= result["authoredCycleSeconds"] * 1000
    for resource in [result["video"], *result["samples"]]:
        path = PROJECT / resource["path"]
        assert resource["bytes"] == path.stat().st_size > 0
        assert resource["sha256"] == sha256(path)
    return result


def main() -> None:
    retained = reusable_capture_manifest(source_fingerprint())
    if retained is not None:
        print(json.dumps(retained, indent=2))
        return
    server, base_url = start_server()
    try:
        result = run(base_url)
    finally:
        server.terminate()
        server.wait(timeout=5)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
