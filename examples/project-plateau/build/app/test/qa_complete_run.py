#!/usr/bin/env python3
"""Run one complete strong-result path with real input only."""

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
EVIDENCE = Path(
    os.environ.get("PLATEAU_EVIDENCE_DIR", BUILD / "evidence" / "current-run")
).expanduser().resolve()
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
ROUTE_INPUT_CONTINUATION_MS = 250
RUNTIME_FINGERPRINT_SCOPE = (
    "interactive inputs: index/package manifests, src and public assets; "
    "generated conversion-preview outputs excluded"
)


def runtime_source_fingerprint() -> str:
    """Bind the evidence to the interactive files without hashing generated previews."""
    excluded_prefix = "public/media/project-plateau-preview"
    paths = [APP / "index.html", APP / "package.json", APP / "package-lock.json"]
    paths += sorted((APP / "public").rglob("*"))
    paths += sorted((APP / "src").rglob("*"))
    digest = hashlib.sha256()
    for path in paths:
        if not path.is_file():
            continue
        relative = path.relative_to(APP).as_posix()
        if relative.startswith(excluded_prefix):
            continue
        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def route_input_calibration(key: str, continuation_ms: int) -> dict[str, object]:
    if key != "KeyW" or not 1 <= continuation_ms <= 350:
        raise AssertionError("route input calibration must be bounded forward input")
    return {
        "input": key,
        "concurrentInput": "KeyC",
        "continuationMs": continuation_ms,
        "continuousInput": True,
        "noInputSegment": False,
    }


def start_server() -> subprocess.Popen[str] | None:
    parsed = urlparse(BASE_URL)
    with socket.socket() as probe:
        try:
            default_port = 443 if parsed.scheme == "https" else 4173
            probe.connect((parsed.hostname or "127.0.0.1", parsed.port or default_port))
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


def snapshot(page: Page) -> dict[str, object]:
    return page.evaluate("window.__projectPlateau.snapshot()")


def semantic_state(state: dict[str, object]) -> dict[str, object]:
    """Keep only player-visible state needed to explain a checkpoint."""
    player = state["player"]
    return {
        "mode": state["mode"],
        "stage": state["stage"],
        "viewport": state["viewport"],
        "sceneChildren": state["sceneChildren"],
        "triangles": state["triangles"],
        "cameraMode": state["cameraMode"],
        "pointerLock": state["pointerLock"],
        "presentationSettings": state["presentationSettings"],
        "player": {
            name: player[name]
            for name in (
                "position",
                "zone",
                "remainingLight",
                "elapsedSeconds",
                "distanceTravelled",
                "plates",
                "shotCount",
                "cartridges",
                "bodyMargin",
                "returnRoute",
                "runStatus",
                "result",
            )
        },
    }


def evidence_reference(path: Path) -> str:
    try:
        return path.relative_to(BUILD.parent).as_posix()
    except ValueError:
        return path.as_posix()


def run() -> dict[str, object]:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for stale in EVIDENCE.glob("*.jpg"):
        stale.unlink()
    errors: list[str] = []
    checkpoints: list[dict[str, object]] = []
    input_trace: list[dict[str, object]] = []
    path_metrics: dict[str, dict[str, object]] = {}
    performance_metrics: dict[str, object] | None = None
    loading_metrics: dict[str, object] | None = None
    asset_evidence: dict[str, object] = {}
    rendering_evidence: dict[str, object] = {}

    # The runner may observe the QA snapshot but may not invoke either state-shortcut hook.
    runner_source = Path(__file__).read_text(encoding="utf-8")
    forbidden_hooks = ["teleport" + "ForTest", "advance" + "TimeForTest"]
    assert all(hook not in runner_source for hook in forbidden_hooks)

    with sync_playwright() as playwright:
        options: dict[str, object] = {"headless": True}
        if CHROME.exists():
            options["executable_path"] = str(CHROME)
        browser = playwright.chromium.launch(**options)
        browser_version = browser.version
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        cdp = page.context.new_cdp_session(page)
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error" or "GL_INVALID_" in message.text
            else None,
        )
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.goto(f"{BASE_URL}/?qa=complete-run", wait_until="networkidle")
        page.wait_for_function("window.__projectPlateau?.ready === true")
        loading_metrics = page.evaluate("window.__projectPlateau.loadingSnapshot()")
        assert loading_metrics["timeToFirstFrameMs"] is not None, loading_metrics
        assert loading_metrics["timeToFirstFrameMs"] <= 8000, loading_metrics
        launched = page.evaluate("window.__projectPlateau.stage") == "current-complete-run"
        assert launched
        vision_mode = "full-colour"

        def capture(identifier: str, inputs: list[str]) -> dict[str, object]:
            state = snapshot(page)
            visual_path = EVIDENCE / f"{identifier}.jpg"
            viewport = page.viewport_size or {"width": 0, "height": 0}
            mechanical_visual_health = page.evaluate(
                "window.__projectPlateau.frameHealthForTest()"
            )
            browser_record = {
                "inputs": inputs,
                "viewport": [viewport["width"], viewport["height"]],
                "visionMode": vision_mode,
                "url": page.url,
                "consoleErrorsAtCheckpoint": list(errors),
                "mechanicalVisualHealth": mechanical_visual_health,
            }
            page.screenshot(path=visual_path, type="jpeg", quality=86)
            checkpoints.append(
                {
                    "id": identifier,
                    "inputs": inputs,
                    "state": semantic_state(state),
                    "browser": browser_record,
                    "visual": evidence_reference(visual_path),
                }
            )
            return state

        def move_until(
            path: str,
            key: str,
            predicate: str,
            label: str,
            timeout: int = 30000,
            continuation_ms: int = 0,
        ) -> None:
            before = snapshot(page)["player"]
            started = time.monotonic()
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
                    **(route_input_calibration(key, continuation_ms) if continuation_ms else {}),
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

        capture("00-title-load", ["Load title"])

        def begin_first_path() -> float:
            page.get_by_role("button", name="Enter the basin").click()
            page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
            page.wait_for_timeout(60)
            clean = capture("00-clean-field-order", ["Enter the basin"])
            assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
            page.get_by_role("button", name="Begin field work").click()
            page.wait_for_timeout(100)
            state = snapshot(page)
            assert state["player"]["remainingLight"] <= 180, state
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
            nonlocal performance_metrics
            brook_id, basalt_id, glade_id, covered_id, result_id = identifiers
            move_until(
                path,
                "KeyW",
                "window.__projectPlateau.snapshot().player.position.z <= 45",
                "Fort to brook",
                continuation_ms=ROUTE_INPUT_CONTINUATION_MS if path == "Strong" else 0,
            )
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
            move_until(
                path,
                "KeyS",
                "window.__projectPlateau.snapshot().player.position.z > 3.2",
                "protect first behavior plate",
            )
            wait_for_cover(path, "break the dive between behavior frames")
            move_until(
                path,
                "KeyW",
                "window.__projectPlateau.snapshot().player.position.z <= 2",
                "return for second behavior frame",
            )
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
            performance_metrics = page.evaluate("window.__projectPlateau.sampleFrames(180)")
            assert performance_metrics["samples"] == 180, performance_metrics
            assert performance_metrics["medianFps"] >= 45, performance_metrics
            assert performance_metrics["onePercentLowFps"] >= 30, performance_metrics
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
        strong = run_strong_path(
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

        page.get_by_role("button", name="Take the route again").click()
        page.wait_for_timeout(80)
        clean = capture("06-strong-clean-restart", ["Take the route again"])
        assert clean["mode"] == "order" and clean["player"]["remainingLight"] == 180, clean
        assert clean["player"]["distanceTravelled"] == 0, clean
        page.set_viewport_size({"width": 1280, "height": 720})
        page.get_by_role("button", name="Begin field work").click()
        page.keyboard.down("KeyW")
        page.wait_for_timeout(520)
        page.keyboard.up("KeyW")
        page.wait_for_timeout(80)
        capture("07-minimum-viewport-field", ["1280x720", "Begin field work", "W"])
        page.set_viewport_size({"width": 1440, "height": 900})
        for index, shot in enumerate(("brook", "basalt", "glade"), start=8):
            review = page.evaluate(
                "shot => window.__projectPlateau.setEnvironmentReviewForTest({ shot })",
                shot,
            )
            assert review["shot"] == shot, review
            page.wait_for_timeout(120)
            review_state = capture(
                f"{index:02d}-review-{shot}",
                [f"fixed environment-review camera: {shot}"],
            )
            assert review_state["environmentReviewShot"] == shot, review_state
            if shot == "brook":
                scene_capture = review_state["assets"]["brook"]["sceneCapture"]
                assert scene_capture["status"] == "ready", scene_capture
                assert scene_capture["reflectionResolution"] == [512, 256], scene_capture
                assert scene_capture["panoramaBuilds"] >= 2, scene_capture
                assert scene_capture["sourceObjectCount"] > 0, scene_capture
                assert scene_capture["planarResolution"] == [320, 180], scene_capture
                assert scene_capture["planarCaptures"] > 0, scene_capture
                assert scene_capture["reachCount"] == 19, scene_capture
                assert scene_capture["activeReachId"].startswith("reach-"), scene_capture
                assert scene_capture["activeBranch"] in {
                    "north-headwater",
                    "south-headwater",
                }, scene_capture
                assert scene_capture["activePlaneTolerance"] <= 0.25, scene_capture
                plane_normal_length_squared = sum(
                    value * value for value in scene_capture["activePlaneNormal"]
                )
                assert abs(plane_normal_length_squared - 1) < 0.00001, scene_capture
                assert scene_capture["activePlaneNormal"][1] > 0.99, scene_capture
                assert scene_capture["refractionResolution"] == [480, 270], scene_capture
                assert scene_capture["refractionCaptures"] > 0, scene_capture
                assert scene_capture["renderError"] is None, scene_capture
                assert (
                    scene_capture["reflectionMode"]
                    == "local-planar-plus-scene-layout-probe"
                ), scene_capture
                assert (
                    scene_capture["planarMode"]
                    == "camera-selected-oblique-clipped-gravity-reach-reflection"
                ), scene_capture
                assert (
                    scene_capture["refractionMode"]
                    == "same-camera-depth-refracted-scene-with-channel-bed-fallback"
                ), scene_capture
                assert (
                    scene_capture["ssrMode"]
                    == "same-camera-depth-bounded-screen-space-reflection"
                ), scene_capture
                assert scene_capture["ssrSteps"] == 12, scene_capture
                assert scene_capture["ssrRangeMeters"] == 38, scene_capture
                hydrology = review_state["assets"]["brook"]["hydrology"]
                assert (
                    hydrology["version"]
                    == "gravity-drained-twin-reach-losing-basin-v1"
                ), hydrology
                assert hydrology["sampleCount"] == 73, hydrology
                assert (
                    hydrology["surfaceEnergyModel"]
                    == (
                        "downstream-grade-and-rendered-obstacle-coupled-ripple-"
                        "roughness-and-aeration"
                    )
                ), hydrology
                assert hydrology["confluenceIndex"] == 35, hydrology
                assert hydrology["minimumDownstreamGrade"] >= 0.0008, hydrology
                assert 0.1 < hydrology["maximumDownstreamGrade"] < 0.11, hydrology
                assert hydrology["maximumFlowEnergy"] == 1, hydrology
                assert hydrology["maximumPondingDepth"] < 0.16, hydrology
                assert hydrology["maximumBedClearance"] < 0.28, hydrology
                assert hydrology["crossChannelGrade"] == 0, hydrology
                assert hydrology["northHeadwaterDrop"] > 3, hydrology
                assert hydrology["southHeadwaterDrop"] > 3.5, hydrology
                assert hydrology["reflectionReachCount"] == 19, hydrology
                assert (
                    hydrology["screenSpaceReflectionModel"]
                    == "screen-space-reflected-ray-over-local-planar-and-scene-probe-fallback"
                ), hydrology
                optics = review_state["assets"]["brook"]["optics"]
                assert optics == {
                    "waterColumnSource": (
                        "water-level-minus-shared-terrain-heightfield"
                    ),
                    "waterDepthRangeMeters": [0.002, 0.288],
                    "indexOfRefraction": 1.333,
                    "normalIncidenceReflectance": 0.02037,
                    "absorptionCoefficientPerMeter": [0.72, 0.22, 0.13],
                    "roughnessRange": [0.11, 0.34],
                    "aerationSource": (
                        "local-downstream-grade-bank-contact-and-rendered-clast-"
                        "downstream-wakes"
                    ),
                    "staticOverlayRipples": 0,
                    "reflectionProfile": (
                        "bounded-screen-space-over-planar-brook-reflection-v1"
                    ),
                    "screenSpaceReflectionModel": (
                        "screen-space-reflected-ray-over-local-planar-and-scene-probe-fallback"
                    ),
                    "screenSpaceReflectionRangeMeters": 38,
                    "screenSpaceReflectionStepsByQuality": {
                        "low": 0,
                        "balanced": 12,
                        "high": 20,
                    },
                    "screenSpaceReflectionFallback": (
                        "camera-selected-local-planar-then-scene-layout-equirectangular-probe"
                    ),
                    "reflectionEvidenceBoundary": (
                        "screen-space-rays-cannot-recover-occluded-or-off-screen-geometry-"
                        "and-never-replace-the-fallback"
                    ),
                    "obstacleFlowProfile": (
                        "rendered-clast-coupled-bounded-obstacle-flow-v1"
                    ),
                    "obstacleFlowEvidenceBoundary": (
                        "local-bounded-cylinder-and-shedding-approximation-not-cfd-"
                        "discharge-or-transport-proof"
                    ),
                    "freeSurfaceProfile": (
                        "tessellated-obstacle-coupled-free-surface-v1"
                    ),
                    "freeSurfaceGrid": [4, 13],
                    "freeSurfaceDisplacementRangeMeters": [-0.038, 0.038],
                    "freeSurfaceEvidenceBoundary": (
                        "centimetre-bounded-visual-free-surface-not-shallow-water-cfd-"
                        "or-volume-conservation-proof"
                    ),
                    "hydraulicEvidenceBoundary": (
                        "bounded-local-free-surface-does-not-claim-discharge-cfd-volume-"
                        "proof-or-exact-wave-spectrum"
                    ),
                }, optics
                free_surface = review_state["assets"]["brook"]["freeSurface"]
                assert free_surface == {
                    "version": "tessellated-obstacle-coupled-free-surface-v1",
                    "model": (
                        "gravity-base-level-with-clast-pressure-speedup-and-downstream-"
                        "shedding-displacement"
                    ),
                    "grid": [4, 13],
                    "longitudinalRows": 289,
                    "vertexCount": 3757,
                    "triangleCount": 6912,
                    "displacementRangeMeters": [-0.038, 0.038],
                    "maximumUpstreamCompressionMeters": 0.032,
                    "maximumSideDrawdownMeters": 0.012,
                    "maximumWakeAmplitudeMeters": 0.018,
                    "volumeContract": (
                        "zero-mean-oscillatory-wake-with-local-upstream-rise-and-side-"
                        "drawdown-over-fixed-base-level"
                    ),
                    "evidenceBoundary": (
                        "centimetre-bounded-visual-free-surface-not-shallow-water-cfd-"
                        "or-volume-conservation-proof"
                    ),
                }, free_surface
                obstacle_flow = review_state["assets"]["brook"]["obstacleFlow"]
                assert (
                    obstacle_flow["version"]
                    == "rendered-clast-coupled-bounded-obstacle-flow-v1"
                ), obstacle_flow
                assert obstacle_flow["candidateCount"] == 62, obstacle_flow
                assert obstacle_flow["qualifyingCount"] == 37, obstacle_flow
                assert obstacle_flow["selectedCount"] == 12, obstacle_flow
                assert obstacle_flow["maximumObstacleCount"] == 12, obstacle_flow
                assert obstacle_flow["activeCountByQuality"] == {
                    "low": 4,
                    "balanced": 8,
                    "high": 12,
                }, obstacle_flow
                assert obstacle_flow["selectedSourceClasses"] == [
                    "historical-high-flow-rounded-lag",
                    "active-channel-bed-load",
                ], obstacle_flow
                assert obstacle_flow["selectedIds"][0] == "brook-cobble-east-1", (
                    obstacle_flow
                )
                assert obstacle_flow["rejectionCounts"] == {
                    "outside-rendered-wetted-channel": 25,
                    "bounded-uniform-budget": 25,
                }, obstacle_flow
                assert obstacle_flow["maximumNormalSlope"] <= 0.052, obstacle_flow
                assert obstacle_flow["maximumAeration"] <= 0.31, obstacle_flow
                assert len(obstacle_flow["obstacles"]) == 12, obstacle_flow
                for obstacle in obstacle_flow["obstacles"]:
                    assert obstacle["channelDistance"] <= 3.4 * 0.54, obstacle
                    assert obstacle["wakeLengthMeters"] > obstacle["radiusMeters"], obstacle
                    assert abs(
                        sum(component * component for component in obstacle["flowDirection"])
                        - 1
                    ) < 0.001, obstacle
                bank_integration = review_state["assets"]["brook"]["bankIntegration"]
                assert bank_integration == {
                    "profile": "terrain-integrated-fluvial-bank-transition",
                    "model": (
                        "terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields"
                    ),
                    "topology": "single-shared-render-and-collision-heightfield",
                    "overlayGeometryCount": 0,
                    "overlayDrawCalls": 0,
                    "wetBankRoughnessRange": [0.76, 0.99],
                    "contactModel": (
                        "water-feather-over-shared-terrain-bank-no-raised-ribbon"
                    ),
                    "sideAnchorCount": 2,
                }, bank_integration
                sediment_sorting = review_state["assets"]["brook"]["sedimentSorting"]
                assert sediment_sorting == {
                    "model": (
                        "meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure"
                    ),
                    "processSource": (
                        "shared-brook-control-line-heightfield-and-bank-curvature"
                    ),
                    "distribution": "gravity-flow-bed-load-and-inner-bend-point-bar-lag",
                    "contactModel": (
                        "terrain-normal-aligned-shallow-bed-and-bar-deposition"
                    ),
                    "geometry": {
                        "profile": "weathered-fractured-rock-detail-1",
                        "topology": (
                            "single-support-ring-to-abraded-crown-with-closed-bottom-cap"
                        ),
                        "supportRingCount": 1,
                        "collapsedSupportRingCount": 0,
                        "supportNormalBoundary": (
                            "split-side-course-and-downward-cap-vertices"
                        ),
                        "supportVertexCount": 21,
                        "minimumTriangleArea": 0.025994,
                    },
                    "material": {
                        "surface": (
                            "seam-free-vertex-mineral-varied-rough-dielectric-stream-stone"
                        ),
                        "mapping": "no-spherical-uv-texture-sampling",
                        "colourMultiplier": "#858e89",
                        "roughness": 0.96,
                        "metalness": 0,
                        "envMapIntensity": 0.06,
                    },
                    "activeBedCount": 36,
                    "pointBarLagCount": 20,
                    "maximumSupportClearance": -0.0118,
                    "minimumContactVertexCount": 21,
                }, sediment_sorting
                driftwood = review_state["assets"]["brook"]["driftwood"]
                assert driftwood["instanceCount"] == 10, driftwood
                assert driftwood["drawCalls"] == 3, driftwood
                assert (
                    driftwood["supportModel"]
                    == "gravity-settled-tangent-aligned-multipoint-deadfall"
                ), driftwood
                assert driftwood["collisionRole"] == "non-solid-visual-accent", driftwood
                assert driftwood["supportEvidence"] == {
                    "instanceCount": 10,
                    "supportSampleCount": 41,
                    "minimumClearance": -0.0342,
                    "maximumClearance": 0.008,
                    "maximumTerrainSlope": 0.136,
                }, driftwood
                assert driftwood["material"] == {
                    "surface": "water-darkened-furrowed-bark-and-broken-end-grain",
                    "energyModel": "opaque-non-emissive-dielectric-weathered-wood",
                    "moistureClass": "brook-bank-wet",
                    "textureChannels": {
                        "albedo": "world.material.bark-albedo",
                        "roughness": "world.material.bark-roughness",
                        "height": "world.material.bark-height",
                    },
                    "flatShading": False,
                    "envMapIntensity": 0.12,
                }, driftwood
                assert len(driftwood["geometry"]) == 3, driftwood
                assert all(
                    geometry["profile"]
                    == "closed-curved-branched-deadwood-with-jagged-fibre-breaks"
                    and geometry["surface"]
                    == "mapped-furrowed-bark-with-distinct-end-grain-and-splinters"
                    and geometry["triangleCount"] >= 696
                    and geometry["closedSegmentCount"] >= 7
                    and geometry["primaryBranchCount"] >= 2
                    and geometry["splinterCount"] >= 4
                    and geometry["supportPointCount"] >= 2
                    and geometry["loadPath"]
                    == "closed-overlapping-trunk-to-branch-volumes-with-tapered-fibre-breaks"
                    for geometry in driftwood["geometry"]
                ), driftwood
                asset_evidence["brookHydrology"] = hydrology
                asset_evidence["brookOptics"] = optics
                asset_evidence["brookFreeSurface"] = free_surface
                asset_evidence["brookObstacleFlow"] = obstacle_flow
                asset_evidence["brookBankIntegration"] = bank_integration
                asset_evidence["brookSedimentSorting"] = sediment_sorting
                asset_evidence["brookDriftwood"] = driftwood
                asset_evidence["brookReflection"] = scene_capture
        detail_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'brookDetail' })"
        )
        assert detail_review["shot"] == "brookDetail", detail_review
        page.wait_for_timeout(120)
        detail_state = capture(
            "11-review-brook-detail",
            ["fixed environment-review camera: brook physical contact detail"],
        )
        assert detail_state["environmentReviewShot"] == "brookDetail", detail_state
        obstacle_detail_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'brookObstacleDetail' })"
        )
        assert obstacle_detail_review["shot"] == "brookObstacleDetail", (
            obstacle_detail_review
        )
        page.wait_for_timeout(120)
        obstacle_detail_state = capture(
            "30-review-brook-obstacle-flow-detail",
            [
                "fixed environment-review camera: rendered historical lag clast, "
                "upstream compression and downstream bounded wake"
            ],
        )
        assert (
            obstacle_detail_state["environmentReviewShot"] == "brookObstacleDetail"
        ), obstacle_detail_state
        surface_profile_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ "
            "shot: 'brookSurfaceProfileDetail' })"
        )
        assert surface_profile_review["shot"] == "brookSurfaceProfileDetail", (
            surface_profile_review
        )
        page.wait_for_timeout(120)
        surface_profile_state = capture(
            "31-review-brook-free-surface-profile",
            [
                "fixed grazing environment-review camera: centimetre-bounded upstream rise, "
                "side drawdown and downstream free-surface shedding"
            ],
        )
        assert (
            surface_profile_state["environmentReviewShot"] == "brookSurfaceProfileDetail"
        ), surface_profile_state
        basalt_detail_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'basaltDetail' })"
        )
        assert basalt_detail_review["shot"] == "basaltDetail", basalt_detail_review
        page.wait_for_timeout(120)
        basalt_detail_state = capture(
            "12-review-basalt-detail",
            ["fixed environment-review camera: buried basalt massif, mineral shelves and talus contact"],
        )
        assert basalt_detail_state["environmentReviewShot"] == "basaltDetail", basalt_detail_state
        basalt_shelf = basalt_detail_state["assets"]["basaltShelf"]
        assert basalt_shelf["visualStatus"] == "original-asset-ready", basalt_shelf
        assert basalt_shelf["loaded"] == 3, basalt_shelf
        assert basalt_shelf["fallbackVisible"] is False, basalt_shelf
        assert basalt_shelf["collisionRole"] == "non-solid-outside-navigation-boundary", basalt_shelf
        assert basalt_shelf["drawCallsPerFormation"] == 2, basalt_shelf
        assert basalt_shelf["variantCount"] == 3, basalt_shelf
        assert len(set(basalt_shelf["variantIds"])) == 3, basalt_shelf
        assert {
            formation["variantId"] for formation in basalt_shelf["formations"]
        } == set(basalt_shelf["variantIds"]), basalt_shelf
        assert sum(basalt_shelf["trianglesByVariant"]) == basalt_shelf["totalAssetTriangles"]
        for formation in basalt_shelf["formations"]:
            support = formation["supportEvidence"]
            assert support is not None, formation
            assert support["bottomVertexCount"] > 0, support
            assert support["supportRatio"] == 1, support
            assert support["maximumBottomClearance"] <= 0.04, support
            assert support["minimumWorldX"] > 29, support
        asset_evidence["basaltShelf"] = basalt_shelf
        basalt_rubble = basalt_detail_state["assets"]["basaltRubble"]
        assert basalt_rubble["profile"] == "joint-bounded-angular-talus-block", basalt_rubble
        assert basalt_rubble["count"] == 44, basalt_rubble
        assert basalt_rubble["drawCalls"] == 1, basalt_rubble
        assert (
            basalt_rubble["surface"] == "dark-weathered-oxidized-basalt-talus"
        ), basalt_rubble
        assert (
            basalt_rubble["settling"]
            == "terrain-normal-aligned-multipoint-buried-support"
        ), basalt_rubble
        assert (
            basalt_rubble["collisionRole"]
            == "non-solid-outside-navigation-boundary"
        ), basalt_rubble
        rubble_support = basalt_rubble["supportEvidence"]
        assert rubble_support["placementCount"] == 44, rubble_support
        assert rubble_support["supportedPlacementCount"] == 44, rubble_support
        assert rubble_support["supportRatio"] == 1, rubble_support
        assert rubble_support["maximumSupportClearance"] <= 0.015, rubble_support
        assert rubble_support["minimumSupportClearance"] >= -0.045, rubble_support
        assert rubble_support["minimumContactVertexCount"] >= 8, rubble_support
        assert rubble_support["minimumWorldX"] > 29, rubble_support
        rubble_burial = rubble_support["burialRangeMeters"]
        assert rubble_burial[0] >= 0.018, rubble_support
        assert rubble_burial[1] <= 0.04, rubble_support
        assert rubble_burial[1] - rubble_burial[0] >= 0.02, rubble_support
        asset_evidence["basaltRubble"] = basalt_rubble
        ridge_volume_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'ridgeVolume' })"
        )
        assert ridge_volume_review["shot"] == "ridgeVolume", ridge_volume_review
        page.wait_for_timeout(120)
        ridge_volume_state = capture(
            "13-review-ridge-volume",
            [
                "fixed environment-review camera: eroded ridge depth, lit slope and terrain-supported distant forest inspection"
            ],
        )
        assert ridge_volume_state["environmentReviewShot"] == "ridgeVolume", ridge_volume_state
        ridge_forest = ridge_volume_state["assets"]["ridgeForest"]
        assert (
            ridge_forest["profile"]
            == "terrain-cohort-and-understory-sourced-ridge-forest-v5"
        ), ridge_forest
        assert ridge_forest["ridgeCount"] == 2, ridge_forest
        assert ridge_forest["totalInstances"] >= 1000, ridge_forest
        assert ridge_forest["totalUnderstoryCrowns"] >= 320, ridge_forest
        assert (
            ridge_forest["totalCrowns"]
            == ridge_forest["totalInstances"] + ridge_forest["totalUnderstoryCrowns"]
        ), ridge_forest
        assert ridge_forest["totalDrawCalls"] == 6, ridge_forest
        assert ridge_forest["allRootsSupported"] is True, ridge_forest
        for ridge in ridge_forest["ridges"]:
            assert ridge["instanceCount"] >= 440, ridge
            assert ridge["drawCalls"] == 3, ridge
            assert ridge["samplesPerSurfaceCell"] == 2, ridge
            assert sum(ridge["crownArchitectureCounts"].values()) == (
                ridge["totalCrownCount"]
            ), ridge
            assert all(
                count > 0 for count in ridge["crownArchitectureCounts"].values()
            ), ridge
            assert ridge["sourceDamagedCrownCount"] > 0, ridge
            assert ridge["crownVariationAttribute"] == "ridgeCrownVariation", ridge
            assert ridge["broadCrownComponentCount"] == 20, ridge
            assert ridge["broadCrownFoliageCohortCount"] == 11, ridge
            assert ridge["broadCrownStructuralBranchCount"] == 9, ridge
            assert ridge["broadCrownTriangleCount"] == 520, ridge
            assert ridge["narrowCrownComponentCount"] == 5, ridge
            assert ridge["narrowCrownFoliageCohortCount"] == 4, ridge
            assert ridge["narrowCrownStructuralBranchCount"] == 1, ridge
            assert ridge["narrowCrownTriangleCount"] == 500, ridge
            assert ridge["broadCrownCount"] + ridge["narrowCrownCount"] == ridge["instanceCount"]
            assert ridge["understoryCrownCount"] >= 160, ridge
            assert (
                ridge["totalCrownCount"]
                == ridge["instanceCount"] + ridge["understoryCrownCount"]
            ), ridge
            support = ridge["supportEvidence"]
            assert support["supportRatio"] == 1, support
            assert support["maximumRootClearance"] == 0, support
            assert support["maximumRootEmbedding"] == 0.06, support
            assert support["interpolation"] == "barycentric-on-rendered-ridge-triangles", support
            understory_support = ridge["understorySupport"]
            assert understory_support["rootCount"] == ridge["understoryCrownCount"], ridge
            assert understory_support["supportRatio"] == 1, understory_support
            assert understory_support["maximumRootClearance"] == 0, understory_support
            assert understory_support["maximumRootEmbedding"] == 0.045, understory_support
            assert (
                understory_support["interpolation"]
                == "barycentric-on-rendered-ridge-triangles"
            ), understory_support
            assert (
                ridge["crownSurface"]
                == "closed-branch-supported-leaf-cohort-and-whorl-crowns-with-age-asymmetry-and-source-damage"
            ), ridge
            assert ridge["ridgeSurface"] == {
                "version": "process-coupled-distant-ridge-surface-v2",
                "sourceModel": (
                    "rendered-height-normal-slope-aspect-drainage-exposed-stone-"
                    "and-height-fraction-fields"
                ),
                "broadDetailPeriodMeters": 37,
                "fineDetailPeriodMeters": 13,
                "microDetailPeriodMeters": 9,
                "maximumHumusDarkening": 0.38,
                "maximumVegetatedSoilBlend": 0.46,
                "maximumSlopeSubstrateBlend": 0.36,
                "maximumStoneBlend": 0.45,
                "temporalModel": (
                    "stable-world-space-no-camera-or-time-dependent-pattern"
                ),
                "evidenceBoundary": (
                    "distant-surface-response-does-not-add-collision-or-claim-surveyed-geology"
                ),
            }, ridge
        cloud_field = ridge_volume_state["assets"]["cloudField"]
        assert (
            cloud_field["profile"]
            == "raymarched-cumulus-volumes-with-puff-fallback"
        ), cloud_field
        assert cloud_field["volumeCount"] == 11, cloud_field
        assert cloud_field["puffCount"] == 56, cloud_field
        assert cloud_field["depthBandCounts"] == {
            "nearHorizon": 6,
            "farHorizon": 5,
        }, cloud_field
        assert cloud_field["stepCounts"] == {"balanced": 12, "high": 18}
        assert cloud_field["physics"] == {
            "medium": "water-droplet-participating-medium",
            "extinctionLaw": "Beer-Lambert",
            "lighting": "height-ambient-plus-sun-ray-self-shadow",
            "condensationBase": "shared-lifting-condensation-level",
        }, cloud_field
        assert cloud_field["solarCoupling"] == {
            "placement": "anti-solar-northern-horizon-only",
            "localDirectSunAttenuation": 0,
            "reason": "no-volume-crosses-the-local-sun-direction",
            "maximumSunAlignment": -0.1768,
        }, cloud_field
        overhead_cloud = cloud_field["overheadCoupling"]
        assert (
            overhead_cloud["version"]
            == "world-space-overhead-cloud-and-sun-shadow-v1"
        ), overhead_cloud
        assert overhead_cloud["resolution"] == 256, overhead_cloud
        assert overhead_cloud["domainMeters"] == 2048, overhead_cloud
        assert overhead_cloud["altitudeMeters"] == 620, overhead_cloud
        assert overhead_cloud["thicknessMeters"] == 220, overhead_cloud
        assert overhead_cloud["shadowSamples"] == 2, overhead_cloud
        assert overhead_cloud["minimumSunTransmittance"] == 0.58, overhead_cloud
        assert overhead_cloud["densityTexture"] == {
            "name": "world.atmosphere.overhead-cloud-density",
            "objectCount": 1,
            "statistics": {
                "minimum": 0.2031,
                "maximum": 0.8381,
                "mean": 0.5095,
                "coverageFraction": 0.3456,
            },
        }, overhead_cloud
        assert overhead_cloud["visibleLayer"] == {
            "profile": "world-space-shared-density-overhead-cloud-deck",
            "drawCalls": 1,
            "densitySamplesPerFragment": 5,
            "replacesPreviousDeckDrawCall": True,
        }, overhead_cloud
        overhead_shadow = overhead_cloud["shadow"]
        assert (
            overhead_shadow["model"]
            == "same-density-two-sample-sun-path-beer-lambert-transmittance"
        ), overhead_shadow
        assert overhead_shadow["installedMaterialCount"] >= 180, overhead_shadow
        assert overhead_shadow["additionalDrawCalls"] == 0, overhead_shadow
        assert overhead_shadow["collisionChange"] == "none", overhead_shadow
        assert overhead_cloud["quality"] == "balanced", overhead_cloud
        asset_evidence["cloudField"] = cloud_field
        asset_evidence["ridgeForest"] = ridge_forest
        gingko_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'gingko' })"
        )
        assert gingko_review["shot"] == "gingko", gingko_review
        page.wait_for_timeout(120)
        gingko_state = capture(
            "14-review-gingko",
            ["fixed environment-review camera: full root-to-crown gingko load path"],
        )
        assert gingko_state["environmentReviewShot"] == "gingko", gingko_state
        assert gingko_state["assets"]["heroGingko"]["loaded"] is True, gingko_state
        assert gingko_state["assets"]["heroGingko"]["fallbackVisible"] is False, gingko_state
        gingko_evidence = gingko_state["assets"]["heroGingko"]
        assert gingko_evidence["version"] == "original-hero-gingko-v2", gingko_evidence
        assert gingko_evidence["leafCount"] == 1971, gingko_evidence
        assert gingko_evidence["supportSnapshot"] == {
            "rootCount": 7,
            "buriedRootTipCount": 7,
            "minimumRootTipDepthMeters": 0.2,
            "scaffoldBranchCount": 10,
            "secondaryBranchCount": 20,
            "twigCount": 68,
            "leafBearingShootCount": 88,
            "leafCount": 1971,
            "pruningStubCount": 4,
            "maximumLeafSupportGapMeters": 0,
            "maximumAllometricAreaRatio": 0.9248000000000001,
        }, gingko_evidence
        assert gingko_evidence["surfaceProfile"]["version"] == (
            "correlated-bark-albedo-roughness-relief-v1"
        ), gingko_evidence
        assert gingko_evidence["surfaceProfile"]["textureObjectCount"] == 2, gingko_evidence
        assert gingko_evidence["windProfile"]["version"] == (
            "hierarchical-gentle-breeze-wind-v1"
        ), gingko_evidence
        assert gingko_evidence["windProfile"]["hierarchy"] == {
            "rootAndTrunk": [0, 0],
            "scaffold": [0.05, 0.32],
            "secondary": [0.28, 0.56],
            "twig": [0.52, 0.82],
            "leaf": [0.4, 1],
        }, gingko_evidence
        assert gingko_evidence["windSnapshot"]["time"] == 14.75, gingko_evidence
        assert gingko_evidence["windSnapshot"]["strength"] == 0.12, gingko_evidence
        assert gingko_evidence["windSnapshot"]["verticalStrength"] == 0.024, gingko_evidence
        assert gingko_evidence["windSnapshot"]["reducedMotion"] is False, gingko_evidence
        assert gingko_evidence["windSnapshot"]["rootAndTrunkFlex"] == [0, 0], gingko_evidence
        assert gingko_evidence["windSnapshot"]["maximumFlex"] == 1, gingko_evidence
        assert gingko_evidence["windSnapshot"]["shadowModel"] == (
            "identical-colour-and-depth-pass-displacement-function-and-uniforms"
        ), gingko_evidence
        asset_evidence["heroGingko"] = gingko_evidence
        gingko_root_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'gingkoRoot' })"
        )
        assert gingko_root_review["shot"] == "gingkoRoot", gingko_root_review
        page.wait_for_timeout(120)
        gingko_root_state = capture(
            "15-review-gingko-root",
            ["fixed environment-review camera: root flare embedded in terrain"],
        )
        assert gingko_root_state["environmentReviewShot"] == "gingkoRoot", gingko_root_state
        terrain_detail_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'terrainDetail' })"
        )
        assert terrain_detail_review["shot"] == "terrainDetail", terrain_detail_review
        page.wait_for_timeout(120)
        terrain_detail_state = capture(
            "16-review-terrain-geology-detail",
            ["fixed environment-review camera: basin soil to exterior basalt weathering apron"],
        )
        assert (
            terrain_detail_state["environmentReviewShot"] == "terrainDetail"
        ), terrain_detail_state
        terrain_detail_health = checkpoints[-1]["browser"]["mechanicalVisualHealth"]
        assert terrain_detail_health["passed"], terrain_detail_health
        escarpment_detail_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'escarpmentDetail' })"
        )
        assert escarpment_detail_review["shot"] == "escarpmentDetail", escarpment_detail_review
        page.wait_for_timeout(120)
        escarpment_detail_state = capture(
            "17-review-basalt-escarpment-contact",
            ["fixed environment-review camera: basin foot, continuous cliff face and buried basalt shelf"],
        )
        assert (
            escarpment_detail_state["environmentReviewShot"] == "escarpmentDetail"
        ), escarpment_detail_state
        rendering_evidence = escarpment_detail_state["rendering"]
        contact_occlusion = rendering_evidence["contactOcclusion"]
        assert contact_occlusion["enabled"] is True, contact_occlusion
        assert contact_occlusion["screenSpaceRadius"] is False, contact_occlusion
        assert 0 < contact_occlusion["radiusMeters"] < 1, contact_occlusion
        assert contact_occlusion["blendIntensity"] <= 0.3, contact_occlusion
        assert rendering_evidence["shadowMap"]["enabled"] is True, rendering_evidence
        daylight_energy = rendering_evidence["daylightEnergy"]
        assert daylight_energy["version"] == "late-humid-daylight-energy-v2", daylight_energy
        assert daylight_energy["fogDensityPerMeter"] == 0.0058, daylight_energy
        assert daylight_energy["environmentIntensity"] == 0.3, daylight_energy
        assert daylight_energy["ambientIntensity"] == 0.08, daylight_energy
        assert daylight_energy["hemisphereIntensity"] == 0.68, daylight_energy
        assert daylight_energy["sunIntensity"] == 2.65, daylight_energy
        assert daylight_energy["ratios"]["skyToResidualAmbient"] >= 8, daylight_energy
        assert (
            daylight_energy["sources"]["environment"]
            == "preetham-sky-pmrem-specular-and-rough-dielectric-response"
        ), daylight_energy
        assert (
            daylight_energy["sources"]["fog"]
            == "analytic-height-density-with-sun-direction-single-scattering"
        ), daylight_energy
        aerial_perspective = daylight_energy["aerialPerspective"]
        assert aerial_perspective["version"] == (
            "analytic-height-aerial-perspective-v1"
        ), aerial_perspective
        assert aerial_perspective["baseHeightMeters"] == -4, aerial_perspective
        assert aerial_perspective["scaleHeightMeters"] == 22, aerial_perspective
        assert aerial_perspective["extinctionAtBasePerMeter"] == 0.0058, aerial_perspective
        assert aerial_perspective["mieAnisotropy"] == 0.58, aerial_perspective
        assert aerial_perspective["maximumFogOpacity"] == 0.88, aerial_perspective
        assert aerial_perspective["installedMaterialCount"] >= 40, aerial_perspective
        assert aerial_perspective["fallbackFogModel"] == (
            "three-fog-exp2-for-unpatched-custom-shaders"
        ), aerial_perspective
        terrain_evidence = escarpment_detail_state["assets"]["terrain"]
        assert terrain_evidence["surfaceDetail"] == {
            "projection": "continuous-world-space-triplanar",
            "triplanarSharpness": 4,
            "coarsePeriodMeters": 47,
            "mediumPeriodMeters": 13,
            "mediumFadeMeters": [45, 110],
            "finePeriodMeters": 1.282,
            "fineFadeMeters": [18, 58],
            "fineInclusionChannels": {
                "stone": "soil-albedo-alpha",
                "organic": "soil-roughness-alpha",
                "pore": "soil-height-alpha",
            },
            "fineInclusionModel": (
                "habitat-gated-sparse-irregular-stone-organic-and-pore-microstructure"
            ),
            "maximumFineReliefAmplitudeMeters": 0.0025,
            "normalSource": (
                "projected-meso-height-plus-source-gated-sparse-fine-stone"
            ),
            "normalReliefAmplitudeMeters": [0.16, 0.21],
            "cavityOcclusionFloor": 0.74,
            "cavityLightingScope": "indirect-diffuse-and-specular-only",
            "compactionResponse": (
                "wet-alluvial-and-route-surfaces-reduce-relief-and-cavity"
            ),
            "bryophyteResponse": (
                "living-cover-darkens-albedo-fills-fine-relief-and-retains-high-roughness"
            ),
        }, terrain_evidence
        assert terrain_evidence["routeSurface"] == {
            "version": "terrain-integrated-footfall-compaction-v1",
            "source": "three-authored-navigation-control-lines",
            "topology": "single-shared-render-and-collision-heightfield",
            "surfaceResponse": (
                "litter-suppression-colour-compaction-relief-and-roughness"
            ),
            "overlayGeometryCount": 0,
            "overlayDrawCalls": 0,
            "collisionChange": "none",
            "mainRouteInfluenceMeters": [1.4, 3.25],
            "coveredForkInfluenceMeters": [1.05, 2.55],
            "exposedForkInfluenceMeters": [1.15, 2.8],
        }, terrain_evidence
        assert terrain_evidence["surfaceGeology"] == {
            "model": "angle-of-repose-bedrock-exposure-and-source-coupled-colluvium",
            "looseRegolithAngleDegrees": 34,
            "looseRegolithGradient": 0.674509,
            "fullBedrockAngleDegrees": 55,
            "fullBedrockGradient": 1.428148,
            "colluviumToeReachMeters": 6.5,
            "bedrockReliefScale": 0.58,
            "jointModel": "source-basalt-joints-with-bounded-optical-relief",
            "stratificationModel": (
                "world-height-bed-contacts-gated-by-source-bedrock-exposure"
            ),
            "stratificationPeriodsMeters": [0.58, 1.74],
            "maximumStratificationAlbedoReduction": 0.11,
            "overlayGeometryCount": 0,
            "slopeSource": "rendered-heightfield-normal-not-sub-grid-analytic-probe",
            "massTransfer": (
                "unstable-regolith-exposes-source-bedrock-and-stable-toe-retains-colluvium"
            ),
            "ranges": {
                "bedrockExposure": {
                    "minimum": 0,
                    "maximum": 0.8778,
                    "mean": 0.003,
                },
                "colluvium": {"minimum": 0, "maximum": 0.9102, "mean": 0.0089},
            },
        }, terrain_evidence
        assert terrain_evidence["fluvialSurface"] == {
            "model": (
                "meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure"
            ),
            "processSource": "shared-brook-control-line-heightfield-and-bank-curvature",
            "bankSurfaceModel": (
                "terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields"
            ),
            "bankTopology": "single-shared-render-and-collision-heightfield",
            "bankOverlayGeometryCount": 0,
            "bankOverlayDrawCalls": 0,
            "wetBankRoughnessRange": [0.76, 0.99],
            "contactModel": (
                "water-feather-over-shared-terrain-bank-no-raised-ribbon"
            ),
            "pointBarMaterial": "inner-bend-coarse-sand-and-rounded-fine-gravel",
            "floodplainMaterial": "low-energy-overbank-silt-and-clay",
            "cutBankMaterial": "outer-bend-exposed-cohesive-subsoil",
            "pointBarReliefAmplitudeMeters": 0.13,
            "floodplainReliefAmplitudeMeters": 0.045,
            "cutBankReliefAmplitudeMeters": 0.11,
            "grainOrdering": (
                "cut-bank-erosion-to-bed-load-to-inner-bend-lag-to-overbank-fines"
            ),
            "ranges": {
                "pointBarDeposit": {"minimum": 0, "maximum": 0.5699, "mean": 0.0055},
                "floodplainSilt": {"minimum": 0, "maximum": 0.4145, "mean": 0.0217},
                "cutBankExposure": {"minimum": 0, "maximum": 0.8533, "mean": 0.0059},
            },
        }, terrain_evidence
        ecology_evidence = terrain_evidence["ecology"]
        assert (
            ecology_evidence["model"]
            == "source-coupled-canopy-litter-hydrology-slope-and-footfall"
        ), ecology_evidence
        assert ecology_evidence["randomMasks"] == 0, ecology_evidence
        assert ecology_evidence["canopySources"] == 146, ecology_evidence
        assert (
            ecology_evidence["bryophyteModel"]
            == "canopy-shade-moisture-hollow-and-stable-substrate-bryophyte-establishment"
        ), ecology_evidence
        assert ecology_evidence["controlLines"] == {
            "brook": 10,
            "mainRoute": 8,
            "coveredFork": 5,
            "exposedFork": 5,
        }, ecology_evidence
        assert ecology_evidence["ranges"]["humus"]["maximum"] > 0.8
        assert ecology_evidence["ranges"]["wetBank"]["maximum"] > 0.95
        assert ecology_evidence["ranges"]["mineralExposure"]["maximum"] > 0.9
        assert ecology_evidence["ranges"]["routeWear"]["maximum"] > 0.95
        assert ecology_evidence["ranges"]["alluvium"]["maximum"] > 0.55
        assert ecology_evidence["ranges"]["humus"]["mean"] > 0.09
        assert ecology_evidence["ranges"]["bryophyte"]["mean"] > 0.06
        assert terrain_evidence["bryophyte"] == {
            "model": (
                "canopy-shade-moisture-hollow-and-stable-substrate-bryophyte-establishment"
            ),
            "sourceCanopyKinds": [
                "128-main-canopy-trees",
                "12-habitat-tree-ferns",
                "5-cover-arches",
                "1-hero-gingko",
            ],
            "exclusions": [
                "route-compaction",
                "unstable-mineral-exposure",
                "active-point-bar-reworking",
                "cut-bank-erosion",
            ],
            "topology": (
                "thin-living-cover-inside-shared-terrain-material-no-overlay-geometry"
            ),
            "collisionChange": "none",
        }, terrain_evidence
        assert ecology_evidence["geomorphology"] == {
            "model": (
                "named-process-relief-brook-incision-meander-bars-cutbanks-and-glade-terrace"
            ),
            "brookIncisionDepthMeters": 0.22,
            "pointBarAccretionMeters": 0.34,
            "cutBankErosionMeters": 0.14,
            "alluvialBenchHeightMeters": 0.22,
            "gladeTerraceRiserMeters": 0.62,
            "topology": (
                "single-cpu-heightfield-shared-by-rendering-collision-placement-and-hydrology"
            ),
        }, ecology_evidence
        asset_evidence["terrain"] = terrain_evidence
        escarpment_evidence = terrain_evidence["escarpment"]
        collision_evidence = escarpment_detail_state["collision"]
        maximum_player_centre_x = (
            collision_evidence["navigationBounds"]["maxX"]
            - collision_evidence["capsule"]["radius"]
        )
        assert escarpment_evidence["topology"] == "continuous-heightfield-no-overhang"
        assert escarpment_evidence["riseStartX"] > maximum_player_centre_x
        assert min(escarpment_evidence["sourceHeightsAtX34"]) >= 2.5
        escarpment_slope_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'escarpmentSlopeDetail' })"
        )
        assert escarpment_slope_review["shot"] == "escarpmentSlopeDetail", escarpment_slope_review
        page.wait_for_timeout(120)
        escarpment_slope_state = capture(
            "18-review-stability-limited-escarpment-slope",
            [
                "fixed environment-review camera: continuous stability-limited bedrock slope"
            ],
        )
        assert (
            escarpment_slope_state["environmentReviewShot"] == "escarpmentSlopeDetail"
        ), escarpment_slope_state
        slope_terrain = escarpment_slope_state["assets"]["terrain"]
        stability_limited_escarpment = slope_terrain["escarpment"]
        assert "slopeExposure" not in escarpment_slope_state["assets"]
        assert stability_limited_escarpment["transitionRunMeters"] == 3.35
        assert (
            stability_limited_escarpment["maximumAnalyticGradient"]
            <= slope_terrain["surfaceGeology"]["fullBedrockGradient"]
        ), stability_limited_escarpment
        assert stability_limited_escarpment["stabilityModel"] == (
            "smoothstep-rise-bounded-by-intact-bedrock-slope-limit"
        )
        asset_evidence["stabilityLimitedEscarpment"] = stability_limited_escarpment
        boulder_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'boulderDetail' })"
        )
        assert boulder_review["shot"] == "boulderDetail", boulder_review
        page.wait_for_timeout(120)
        boulder_state = capture(
            "19-review-brook-boulder-detail",
            [
                "fixed environment-review camera: closed fractured mass, buried support and settled spall"
            ],
        )
        assert boulder_state["environmentReviewShot"] == "boulderDetail", boulder_state
        brook_boulder = boulder_state["assets"]["brookBoulder"]
        assert brook_boulder["version"] == "original-brook-boulder-v6", brook_boulder
        assert brook_boulder["visualStatus"] == "original-asset-ready", brook_boulder
        assert brook_boulder["loaded"] is True, brook_boulder
        assert brook_boulder["fallbackVisible"] is False, brook_boulder
        assert brook_boulder["drawCalls"] == 6, brook_boulder
        assert brook_boulder["fragmentCount"] == 5, brook_boulder
        assert (
            brook_boulder["triangles"]
            == brook_boulder["massTriangles"] + brook_boulder["apronTriangles"]
        ), brook_boulder
        assert (
            brook_boulder["collisionRole"]
            == "solid-main-mass-with-non-solid-sub-step-spall-apron"
        ), brook_boulder
        assert (
            brook_boulder["transportClass"]
            == "immobile-residual-bank-erratic-reexposed-on-inner-bend"
        ), brook_boulder
        assert brook_boulder["presentFlowMobility"] == "immobile", brook_boulder
        boulder_support = brook_boulder["supportEvidence"]
        assert boulder_support is not None, brook_boulder
        assert boulder_support["supportVertexCount"] >= 25, boulder_support
        assert boulder_support["supportRatio"] == 1, boulder_support
        assert -0.086 <= boulder_support["minimumClearance"] <= -0.08, boulder_support
        assert boulder_support["maximumClearance"] <= 0.055, boulder_support
        boulder_material = brook_boulder["material"]
        assert boulder_material["energyModel"] == "non-emissive-dielectric-rock-albedo"
        assert boulder_material["flatShading"] is False, boulder_material
        assert boulder_material["colourMultiplier"] == "#747c76", boulder_material
        assert (
            boulder_material["albedoModel"]
            == "coordinate-weathering-and-porosity-varied-capillary-front"
        ), boulder_material
        assert boulder_material["capillaryBand"] == {
            "nominalFrontY": -0.455,
            "porosityVariationMeters": 0.09,
            "lowerTransitionMeters": 0.08,
            "upperTransitionMeters": 0.07,
            "saturatedRoughness": 0.74,
            "porositySource": "same-correlated-height-field-as-optical-relief",
        }, boulder_material
        fluvial_rocks = boulder_state["assets"]["nonColumnarRocks"]
        assert fluvial_rocks["fluvialTransport"] == {
            "model": "active-bedload-historical-flood-lag-and-residual-bank-erratic",
            "brookWidthMeters": 3.4,
            "presentMobileLongAxisMeters": [0.16, 0.55],
            "historicalLagLongAxisMeters": [1.06, 1.32],
            "historicalLagMaximumBrookWidthFraction": 0.39,
            "residualErraticLongAxisMeters": 2.48,
            "mobilityContract": "only-non-solid-sub-step-clasts-move-with-present-flow",
            "hydraulicEvidenceBoundary": (
                "grade-only-water-model-does-not-prove-exact-transport-competence"
            ),
        }, fluvial_rocks
        fluvial_family = next(
            family for family in fluvial_rocks["families"]
            if family["family"] == "fluvial-cobble"
        )
        assert fluvial_family["geometry"] == "historical-high-flow-rounded-lag-clast"
        assert fluvial_family["topology"] == (
            "single-support-ring-to-rounded-crown-with-non-overlapping-bottom-cap"
        ), fluvial_family
        assert fluvial_family["supportRingCount"] == 1, fluvial_family
        assert fluvial_family["collapsedSupportRingCount"] == 0, fluvial_family
        assert fluvial_family["supportNormalBoundary"] == (
            "split-side-course-and-downward-cap-vertices"
        ), fluvial_family
        assert fluvial_family["minimumTriangleArea"] > 0.001, fluvial_family
        assert fluvial_family["transportClasses"] == ["historical-high-flow-rounded-lag"]
        assert fluvial_family["presentFlowMobilities"] == ["immobile"]
        assert fluvial_family["longAxisRangeMeters"] == [1.06, 1.315]
        assert fluvial_family["maximumBrookWidthFraction"] == 0.387
        bedded_family = next(
            family for family in fluvial_rocks["families"]
            if family["family"] == "bedded-slab"
        )
        assert (
            bedded_family["geometry"]
            == "joint-bounded-tabular-plateau-slab"
        ), bedded_family
        assert (
            bedded_family["silhouetteModel"]
            == "joint-bounded-broken-rectangle-not-sphere-derived"
        ), bedded_family
        assert (
            bedded_family["topology"]
            == "closed-irregular-ring-stack-with-coplanar-support-cap"
        ), bedded_family
        assert bedded_family["beddingLedgeCount"] == 2, bedded_family
        assert (
            bedded_family["normalProfile"]
            == "thirty-one-degree-creased-bedding-and-joint-normals"
        ), bedded_family
        assert bedded_family["localDimensionsMeters"] == [2.1064, 0.6265, 1.599]
        assert bedded_family["maximumSupportClearance"] <= 0.025, bedded_family
        assert bedded_family["minimumContactVertexCount"] >= 3, bedded_family
        asset_evidence["nonColumnarRocks"] = fluvial_rocks
        asset_evidence["brookBoulder"] = brook_boulder
        fern_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'fernDetail' })"
        )
        assert fern_review["shot"] == "fernDetail", fern_review
        page.wait_for_timeout(120)
        fern_state = capture(
            "20-review-fern-detail",
            [
                "fixed environment-review camera: buried rhizomes, attached fronds and humid-margin distribution"
            ],
        )
        assert fern_state["environmentReviewShot"] == "fernDetail", fern_state
        fern_library = fern_state["assets"]["fernLibrary"]
        assert fern_library["visualStatus"] == "original-asset-ready", fern_library
        assert fern_library["loaded"] is True, fern_library
        assert fern_library["fallbackVisible"] is False, fern_library
        assert fern_library["runtimeDrawCalls"] == 14, fern_library
        assert fern_library["instanceCount"] == 132, fern_library
        assert fern_library["foregroundReplacementCount"] == 12, fern_library
        assert fern_library["proceduralForegroundFallbackVisible"] is False, fern_library
        assert fern_library["drawCalls"] == 6, fern_library
        assert fern_library["drawCallsPerVariant"] == 2, fern_library
        assert fern_library["variantCount"] == 3, fern_library
        assert len(set(fern_library["variantIds"])) == 3, fern_library
        assert sum(fern_library["counts"]) == 132, fern_library
        assert all(count > 0 for count in fern_library["counts"]), fern_library
        assert sum(fern_library["habitatCounts"].values()) == 132, fern_library
        assert (
            fern_library["collisionRole"] == "non-solid-pliable-understory"
        ), fern_library
        fern_support = fern_library["supportEvidence"]
        assert fern_support is not None, fern_library
        assert fern_support["supportVertexCount"] == 1716, fern_support
        assert fern_support["supportedVertexCount"] == 1716, fern_support
        assert fern_support["supportRatio"] == 1, fern_support
        assert fern_support["minimumClearance"] >= -0.055, fern_support
        assert fern_support["maximumClearance"] <= 0.018, fern_support
        assert (
            fern_library["windModel"]["supportModel"]
            == "buried-rhizome-fixed-rachis-and-leaflets-progressively-flexible"
        ), fern_library
        assert fern_library["windModel"]["flexAttribute"] == "uv1-y", fern_library
        assert 0 < fern_library["windState"]["horizontalStrength"] <= 0.12, fern_library
        assert 0 < fern_library["windState"]["verticalStrength"] <= 0.03, fern_library
        assert fern_library["windState"]["time"] == 14.75, fern_library
        assert (
            fern_library["shadowDisplacement"]
            == "identical-colour-and-depth-pass-displacement-function-and-uniforms"
        ), fern_library
        assert (
            fern_library["material"]["energyModel"]
            == "shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric"
        ), fern_library
        assert (
            fern_library["material"]["albedoProfile"]
            == "source-coupled-bounded-foliage-albedo-v1"
        ), fern_library
        accent_ferns = fern_library["accentLibrary"]
        assert accent_ferns["loaded"] is True, accent_ferns
        assert accent_ferns["visible"] is True, accent_ferns
        assert accent_ferns["qualityGated"] is True, accent_ferns
        assert accent_ferns["fallbackVisible"] is False, accent_ferns
        assert accent_ferns["instanceCount"] == 88, accent_ferns
        assert accent_ferns["counts"] == [44, 20, 24], accent_ferns
        assert sum(accent_ferns["habitatCounts"].values()) == 88, accent_ferns
        assert accent_ferns["placementRoleCounts"] == {
            "tree-fern-understory-skirt-replacement": 24,
            "degradable-wetland-accent-replacement": 36,
            "degradable-margin-accent-replacement": 28,
        }, accent_ferns
        accent_support = accent_ferns["supportEvidence"]
        assert accent_support["supportVertexCount"] == 1144, accent_support
        assert accent_support["supportedVertexCount"] == 1144, accent_support
        assert accent_support["supportRatio"] == 1, accent_support
        assert accent_support["minimumClearance"] >= -0.055, accent_support
        assert accent_support["maximumClearance"] <= 0.018, accent_support
        assert len(accent_ferns["dimensionSummary"]) == 3, accent_ferns
        for dimensions in accent_ferns["dimensionSummary"].values():
            assert (
                dimensions["envelopePassCount"] == dimensions["instanceCount"]
            ), dimensions
            assert (
                dimensions["maximumDiameterMeters"] <= dimensions["maxDiameterMeters"]
            ), dimensions
            assert (
                dimensions["maximumHeightMeters"] <= dimensions["maxHeightMeters"]
            ), dimensions
        brook_response_stand = fern_library["brookResponseStand"]
        assert brook_response_stand["loaded"] is True, brook_response_stand
        assert brook_response_stand["fallbackVisible"] is False, brook_response_stand
        assert brook_response_stand["response"] is None, brook_response_stand
        assert brook_response_stand["instanceCount"] == 5, brook_response_stand
        assert brook_response_stand["counts"] == [5, 0, 0], brook_response_stand
        assert brook_response_stand["activeDrawCalls"] == 2, brook_response_stand
        assert (
            brook_response_stand["placementRole"]
            == "brook-response-humid-brush-replacement"
        ), brook_response_stand
        assert (
            brook_response_stand["supportModel"]
            == "buried-rhizome-to-closed-rachis-to-attached-pinnate-leaflets"
        ), brook_response_stand
        assert (
            brook_response_stand["collisionRole"] == "non-solid-pliable-understory"
        ), brook_response_stand
        brook_response_support = brook_response_stand["supportEvidence"]
        assert brook_response_support["supportVertexCount"] == 65, brook_response_support
        assert brook_response_support["supportedVertexCount"] == 65, brook_response_support
        assert brook_response_support["supportRatio"] == 1, brook_response_support
        assert brook_response_support["minimumClearance"] >= -0.055, brook_response_support
        assert brook_response_support["maximumClearance"] <= 0.018, brook_response_support
        brook_response_dimensions = brook_response_stand["dimensionSummary"]
        assert brook_response_dimensions["instanceCount"] == 5, brook_response_dimensions
        assert brook_response_dimensions["envelopePassCount"] == 5, brook_response_dimensions
        assert (
            brook_response_dimensions["maximumDiameterMeters"]
            <= brook_response_dimensions["maxDiameterMeters"]
        ), brook_response_dimensions
        assert (
            brook_response_dimensions["maximumHeightMeters"]
            <= brook_response_dimensions["maxHeightMeters"]
        ), brook_response_dimensions
        assert brook_response_stand["windState"] == {
            "time": 14.75,
            "horizontalStrength": 0.055,
            "verticalStrength": 0.012,
        }, brook_response_stand
        asset_evidence["fernLibrary"] = fern_library
        ground_cover_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'groundCoverDetail' })"
        )
        assert ground_cover_review["shot"] == "groundCoverDetail", ground_cover_review
        page.wait_for_timeout(120)
        ground_cover_state = capture(
            "21-review-ground-cover-detail",
            [
                "fixed environment-review camera: mature size envelopes, buried root crowns and attached leaves"
            ],
        )
        assert (
            ground_cover_state["environmentReviewShot"] == "groundCoverDetail"
        ), ground_cover_state
        ground_cover = ground_cover_state["assets"]["groundCoverLibrary"]
        assert ground_cover["visualStatus"] == "original-asset-ready", ground_cover
        assert ground_cover["loaded"] is True, ground_cover
        assert ground_cover["fallbackVisible"] is False, ground_cover
        assert ground_cover["instanceCount"] == 360, ground_cover
        assert ground_cover["drawCalls"] == 6, ground_cover
        assert ground_cover["drawCallsPerVariant"] == 2, ground_cover
        assert ground_cover["version"] == "original-ground-cover-library-v3", ground_cover
        assert ground_cover["triangles"] == 2712, ground_cover
        assert ground_cover["trianglesByVariant"] == [760, 832, 1120], ground_cover
        assert sum(ground_cover["counts"]) == 360, ground_cover
        assert all(count > 0 for count in ground_cover["counts"]), ground_cover
        assert sum(ground_cover["habitatCounts"].values()) == 360, ground_cover
        assert ground_cover["collisionRole"] == "non-solid-pliable-ground-cover", ground_cover
        architecture = ground_cover["architecture"]
        assert (
            architecture["model"]
            == "mixed-age-asymmetric-petiole-and-leaf-hierarchy"
        ), architecture
        assert architecture["leafPhaseAttribute"] == "uv1-x", architecture
        assert architecture["petioleRadialSegments"] == 6, architecture
        assert architecture["maximumPetioleRadiusMetersByVariant"] == [
            0.011,
            0.0095,
            0.008,
        ], architecture
        assert architecture["instanceYawVariationRadians"] == 0.11, architecture
        assert architecture["instanceRadialVariation"] == 0.14, architecture
        assert architecture["instanceVerticalVariationMeters"] == 0.022, architecture
        assert architecture["maximumAttachmentGapMeters"] == 0.0001, architecture
        ground_support = ground_cover["supportEvidence"]
        assert ground_support["supportVertexCount"] == 5400, ground_support
        assert ground_support["supportedVertexCount"] == 5400, ground_support
        assert ground_support["supportRatio"] == 1, ground_support
        assert ground_support["minimumClearance"] >= -0.065, ground_support
        assert ground_support["maximumClearance"] <= -0.035, ground_support
        assert len(ground_cover["dimensionSummary"]) == 3, ground_cover
        for dimensions in ground_cover["dimensionSummary"]:
            assert (
                dimensions["envelopePassCount"] == dimensions["instanceCount"]
            ), dimensions
            assert (
                dimensions["maximumDiameterMeters"] <= dimensions["maxDiameterMeters"]
            ), dimensions
            assert (
                dimensions["maximumHeightMeters"] <= dimensions["maxHeightMeters"]
            ), dimensions
        settlement = ground_cover["horizontalSettlement"]
        assert settlement["relocatedInstances"] == 0, settlement
        assert settlement["maximumMeters"] == 0, settlement
        assert (
            settlement["model"]
            == "smallest-deterministic-move-from-sharp-break-to-continuous-soil"
        ), settlement
        assert ground_cover["windModel"]["flexAttribute"] == "uv1-y", ground_cover
        assert 0 < ground_cover["windState"]["horizontalStrength"] <= 0.07, ground_cover
        assert 0 < ground_cover["windState"]["verticalStrength"] <= 0.015, ground_cover
        assert ground_cover["windState"]["time"] == 14.75, ground_cover
        assert (
            ground_cover["shadowDisplacement"]
            == "identical-colour-and-depth-pass-displacement-function-and-uniforms"
        ), ground_cover
        assert (
            ground_cover["material"]["energyModel"]
            == "shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric"
        ), ground_cover
        assert (
            ground_cover["material"]["albedoProfile"]
            == "source-coupled-bounded-foliage-albedo-v1"
        ), ground_cover
        asset_evidence["groundCoverLibrary"] = ground_cover
        forest_boundary = ground_cover_state["assets"]["environmentDensity"]
        assert (
            forest_boundary["forestSuccessionProfile"]
            == "terrain-sourced-boundary-forest-succession-v2"
        ), forest_boundary
        assert (
            forest_boundary["forestCollisionModel"]
            == "load-bearing-trunks-wholly-outside-navigation-crowns-may-overhang"
        ), forest_boundary
        succession = forest_boundary["forestSuccession"]
        assert succession["instanceCount"] == 144, succession
        assert succession["cohortCount"] == 12, succession
        assert succession["outsideNavigationCount"] == 144, succession
        assert succession["ageCounts"] == {
            "mature": 72,
            "submature": 36,
            "pioneer": 36,
        }, succession
        assert sum(succession["crownVariantCounts"]) == 144, succession
        assert succession["crownOverlapLinks"] >= 60, succession
        assert succession["overlapLinkedTreeCount"] >= 80, succession
        forest_edge_original = forest_boundary["forestEdgeOriginal"]
        assert forest_edge_original["visualStatus"] == "original-asset-ready", forest_edge_original
        assert forest_edge_original["loaded"] is True, forest_edge_original
        assert forest_edge_original["fallbackVisible"] is False, forest_edge_original
        assert forest_edge_original["instanceCount"] == 144, forest_edge_original
        assert forest_edge_original["cohortCount"] == 12, forest_edge_original
        assert forest_edge_original["ageCounts"] == {
            "mature": 72,
            "submature": 36,
            "pioneer": 36,
        }, forest_edge_original
        assert forest_edge_original["drawCalls"] == 8, forest_edge_original
        assert (
            forest_edge_original["collisionRole"]
            == "inaccessible-solid-trunks-beyond-navigation-with-overhanging-pliable-crowns"
        ), forest_edge_original
        edge_retention = forest_edge_original["leafRetention"]
        assert edge_retention["version"] == "age-wind-and-habitat-leaf-retention-v1"
        assert (
            edge_retention["sourceModel"]
            == "succession-age-wind-damage-slope-wetness-and-stable-individual-rank"
        )
        assert (
            edge_retention["temporalModel"]
            == "stable-per-instance-no-camera-or-time-dependent-leaf-popping"
        )
        assert (
            edge_retention["shadowModel"]
            == "identical-colour-and-depth-pass-leaf-rejection"
        )
        assert edge_retention["ageCounts"] == {
            "mature": 72,
            "submature": 36,
            "pioneer": 36,
        }
        assert edge_retention["minimumRetention"] == 0.884
        assert edge_retention["maximumRetention"] == 0.9543
        assert edge_retention["meanRetention"] == 0.9151
        assert edge_retention["damagedInstanceCount"] == 18
        edge_support = forest_edge_original["supportEvidence"]
        assert edge_support["supportVertexCount"] == edge_support["supportedVertexCount"], edge_support
        assert edge_support["supportRatio"] == 1, edge_support
        assert edge_support["maximumClearance"] <= 0, edge_support
        assert edge_support["settlementAxis"] == "world-gravity-only", edge_support
        asset_evidence["forestSuccession"] = forest_boundary
        tree_fern_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'treeFernDetail' })"
        )
        assert tree_fern_review["shot"] == "treeFernDetail", tree_fern_review
        page.wait_for_timeout(120)
        tree_fern_state = capture(
            "22-review-tree-fern-detail",
            [
                "fixed environment-review camera: buried root mantle, vertical fibrous trunk, closed rachises and attached pinnate leaflets"
            ],
        )
        assert (
            tree_fern_state["environmentReviewShot"] == "treeFernDetail"
        ), tree_fern_state
        tree_ferns = tree_fern_state["assets"]["treeFernLibrary"]
        assert tree_ferns["version"] == "original-tree-fern-library-v1", tree_ferns
        assert tree_ferns["visualStatus"] == "original-asset-ready", tree_ferns
        assert tree_ferns["loaded"] is True, tree_ferns
        assert tree_ferns["fallbackVisible"] is False, tree_ferns
        assert tree_ferns["instanceCount"] == 12, tree_ferns
        assert tree_ferns["placementAnchorCount"] == 12, tree_ferns
        assert tree_ferns["allTrunksVertical"] is True, tree_ferns
        assert tree_ferns["drawCalls"] == 9, tree_ferns
        assert tree_ferns["drawCallsPerVariant"] == 3, tree_ferns
        assert tree_ferns["triangles"] == 19_788, tree_ferns
        assert tree_ferns["trianglesByVariant"] == [6_652, 5_872, 7_264], tree_ferns
        assert tree_ferns["counts"] == [2, 7, 3], tree_ferns
        assert tree_ferns["habitatCounts"] == {
            "humid-retentive-margin": 2,
            "wind-exposed-drained-margin": 7,
            "sheltered-humus-margin": 3,
        }, tree_ferns
        assert (
            tree_ferns["growthModel"]
            == "gravitropic-vertical-trunk-with-gravity-settled-root-mantle"
        ), tree_ferns
        assert (
            tree_ferns["collisionRole"]
            == "solid-fibrous-trunk-with-non-solid-pliable-fronds-and-sub-step-roots"
        ), tree_ferns
        tree_fern_support = tree_ferns["supportEvidence"]
        assert tree_fern_support["supportVertexCount"] == 408, tree_fern_support
        assert tree_fern_support["supportedVertexCount"] == 408, tree_fern_support
        assert tree_fern_support["supportRatio"] == 1, tree_fern_support
        assert tree_fern_support["minimumClearance"] >= -0.24, tree_fern_support
        assert tree_fern_support["maximumClearance"] <= 0, tree_fern_support
        assert tree_fern_support["settlementAxis"] == "world-gravity-only", tree_fern_support
        tree_fern_dimensions = tree_ferns["dimensionSummary"]
        assert tree_fern_dimensions["envelopePassCount"] == 12, tree_fern_dimensions
        assert (
            tree_fern_dimensions["maximumDiameterMeters"]
            <= tree_fern_dimensions["maximumCrownDiameterMeters"]
        ), tree_fern_dimensions
        assert (
            tree_fern_dimensions["maximumHeightMeters"]
            <= tree_fern_dimensions["maximumMatureHeightMeters"]
        ), tree_fern_dimensions
        assert tree_ferns["windModel"]["flexAttribute"] == "uv1-y", tree_ferns
        assert 0 < tree_ferns["windState"]["horizontalStrength"] <= 0.18, tree_ferns
        assert 0 < tree_ferns["windState"]["verticalStrength"] <= 0.04, tree_ferns
        assert tree_ferns["windState"]["time"] == 14.75, tree_ferns
        assert (
            tree_ferns["shadowDisplacement"]
            == "identical-colour-and-depth-pass-displacement-function-and-uniforms"
        ), tree_ferns
        assert (
            tree_ferns["material"]["energyModel"]
            == "shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric"
        ), tree_ferns
        assert (
            tree_ferns["material"]["albedoProfile"]
            == "source-coupled-bounded-foliage-albedo-v1"
        ), tree_ferns
        asset_evidence["treeFernLibrary"] = tree_ferns
        canopy_tree_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'canopyTreeDetail' })"
        )
        assert canopy_tree_review["shot"] == "canopyTreeDetail", canopy_tree_review
        page.wait_for_timeout(120)
        canopy_tree_state = capture(
            "23-review-canopy-tree-detail",
            [
                "fixed environment-review camera: buried root mantle, vertical trunk, closed branch hierarchy and attached mature leaves"
            ],
        )
        assert (
            canopy_tree_state["environmentReviewShot"] == "canopyTreeDetail"
        ), canopy_tree_state
        canopy_trees = canopy_tree_state["assets"]["canopyTreeLibrary"]
        assert canopy_trees["version"] == "original-canopy-tree-library-v7", canopy_trees
        assert canopy_trees["visualStatus"] == "original-asset-ready", canopy_trees
        assert canopy_trees["loaded"] is True, canopy_trees
        assert canopy_trees["fallbackVisible"] is False, canopy_trees
        assert canopy_trees["instanceCount"] == 128, canopy_trees
        assert canopy_trees["placementAnchorCount"] == 128, canopy_trees
        assert canopy_trees["allTrunksVertical"] is True, canopy_trees
        assert canopy_trees["drawCalls"] == 8, canopy_trees
        assert canopy_trees["drawCallsPerVariant"] == 2, canopy_trees
        assert canopy_trees["triangles"] == 33_102, canopy_trees
        assert canopy_trees["trianglesByVariant"] == [7_896, 6_930, 7_896, 10_380], canopy_trees
        assert canopy_trees["renderedTriangles"] == 1_081_758, canopy_trees
        assert canopy_trees["counts"] == [6, 37, 42, 43], canopy_trees
        assert canopy_trees["habitatCounts"] == {
            "humid-retentive-broadleaf": 6,
            "drained-open-broadleaf": 37,
            "plate-barked-compound-margin": 42,
            "raised-araucaria-tier": 43,
        }, canopy_trees
        assert canopy_trees["leafCounts"] == [924, 798, 924, 1_296], canopy_trees
        assert canopy_trees["damagedLeafCounts"] == [249, 240, 243, 370], canopy_trees
        assert canopy_trees["branchAnchorCounts"] == [132, 114, 132, 216], canopy_trees
        assert (
            canopy_trees["leafAttachmentDistribution"]
            == "distributed-nodes-along-closed-primary-secondary-and-tertiary-branch-axes"
        ), canopy_trees
        assert (
            canopy_trees["leafCoverageModel"]
            == "higher-node-density-with-bounded-nine-point-five-percent-leaf-growth"
        ), canopy_trees
        assert (
            canopy_trees["leafNodeHierarchy"]
            == "primary-secondary-tertiary-and-araucaria-whorl-axes"
        ), canopy_trees
        assert canopy_trees["surfaceVariation"] == {
            "version": "stable-individual-bark-scar-and-lamina-damage-v1",
            "structureModel": (
                "instance-ranked-trunk-localised-healed-scar-with-callus-and-"
                "exposed-heartwood-response"
            ),
            "leafModel": (
                "stable-per-leaf-edge-notches-and-rare-lamina-perforation-from-"
                "authored-retention-rank"
            ),
            "structureVariationSource": (
                "stable-tree-index-rank-plus-recorded-wind-damage"
            ),
            "leafVariationSource": (
                "asset-authored-uv1-x-stable-complete-lamina-rank"
            ),
            "maximumScarHeightMeters": 0.96,
            "maximumScarAngularFraction": 0.22,
            "damagedLeafRankThreshold": 0.72,
            "perforatedLeafRankThreshold": 0.92,
            "temporalModel": "stable-no-time-or-camera-dependent-surface-popping",
            "shadowModel": (
                "identical-partial-lamina-rejection-in-colour-and-depth-passes"
            ),
            "evidenceBoundary": (
                "bounded-surface-history-does-not-claim-species-specific-"
                "palaeobotanical-damage-rates"
            ),
        }, canopy_trees
        assert canopy_trees["leafCountGrowthPercent"] == 9.5, canopy_trees
        assert canopy_trees["assetTriangleGrowthPercent"] == 0.82, canopy_trees
        assert (
            canopy_trees["assetTriangleGrowthBaseline"]
            == "v6-to-v7-stratified-crown-and-fractured-limb-architecture"
        ), canopy_trees
        assert canopy_trees["roundedLaminaTriangleGrowthPercent"] == 92.41, canopy_trees
        assert (
            canopy_trees["roundedLaminaTriangleGrowthBaseline"]
            == "v5-to-v6-rounded-lamina-topology"
        ), canopy_trees
        assert canopy_trees["trianglesPerLeaf"] == 6, canopy_trees
        assert canopy_trees["verticesPerLeaf"] == 8, canopy_trees
        assert canopy_trees["leafSurfaceTriangleMultiplier"] == 3, canopy_trees
        assert (
            canopy_trees["partialLaminaDamage"]
            == "stable-one-sided-missing-margin-plus-colour-depth-shared-rare-perforation"
        ), canopy_trees
        assert (
            canopy_trees["crownArchitecture"]
            == "vertical-crown-volume-with-closed-upper-scaffolds-and-wind-fractured-limb-stubs"
        ), canopy_trees
        assert canopy_trees["brokenBranchCounts"] == [1, 1, 1, 2], canopy_trees
        assert canopy_trees["fractureSplinterCounts"] == [3, 3, 3, 6], canopy_trees
        assert (
            canopy_trees["crownBudgetModel"]
            == "existing-leaf-budget-reallocated-from-broken-horizontal-limbs-to-supported-upper-scaffolds"
        ), canopy_trees
        canopy_retention = canopy_trees["leafRetention"]
        assert canopy_retention["version"] == "age-wind-and-habitat-leaf-retention-v1"
        assert canopy_retention["ageCounts"] == {"unspecified": 128}
        assert 0.82 <= canopy_retention["minimumRetention"]
        assert canopy_retention["minimumRetention"] < canopy_retention["meanRetention"]
        assert canopy_retention["meanRetention"] < canopy_retention["maximumRetention"]
        assert canopy_retention["maximumRetention"] <= 0.985
        assert (
            canopy_retention["temporalModel"]
            == "stable-per-instance-no-camera-or-time-dependent-leaf-popping"
        )
        assert (
            canopy_retention["shadowModel"]
            == "identical-colour-and-depth-pass-leaf-rejection"
        )
        assert (
            canopy_trees["growthModel"]
            == "gravitropic-vertical-trunk-with-gravity-settled-root-mantle"
        ), canopy_trees
        assert (
            canopy_trees["collisionRole"]
            == "solid-visible-trunk-with-non-solid-branches-and-pliable-leaves"
        ), canopy_trees
        canopy_support = canopy_trees["supportEvidence"]
        assert canopy_support["supportVertexCount"] == 3_540, canopy_support
        assert canopy_support["supportedVertexCount"] == 3_540, canopy_support
        assert canopy_support["supportRatio"] == 1, canopy_support
        assert canopy_support["minimumClearance"] >= -0.82, canopy_support
        assert canopy_support["maximumClearance"] <= 0, canopy_support
        assert canopy_support["settlementAxis"] == "world-gravity-only", canopy_support
        assert len(canopy_trees["dimensionSummary"]) == 4, canopy_trees
        for dimensions in canopy_trees["dimensionSummary"]:
            assert dimensions["envelopePassCount"] == dimensions["instanceCount"], dimensions
            assert (
                dimensions["maximumDiameterMeters"]
                <= dimensions["maximumCrownDiameterMeters"]
            ), dimensions
            assert (
                dimensions["maximumHeightMeters"]
                <= dimensions["maximumMatureHeightMeters"]
            ), dimensions
        assert canopy_trees["windModel"]["flexAttribute"] == "uv1-y", canopy_trees
        assert 0 < canopy_trees["windState"]["horizontalStrength"] <= 0.1, canopy_trees
        assert 0 < canopy_trees["windState"]["verticalStrength"] <= 0.025, canopy_trees
        assert canopy_trees["windState"]["time"] == 14.75, canopy_trees
        assert (
            canopy_trees["shadowDisplacement"]
            == "identical-colour-and-depth-pass-displacement-function-and-uniforms"
        ), canopy_trees
        assert (
            canopy_trees["materials"]["energyModel"]
            == "shadow-aware-bounded-thin-leaf-transmission-non-emissive-dielectric"
        ), canopy_trees
        assert (
            canopy_trees["materials"]["albedoProfile"]
            == "source-coupled-bounded-foliage-albedo-v1"
        ), canopy_trees
        assert set(canopy_trees["materials"]["structureSurfaces"]) == {
            "wet-furrowed",
            "plate-barked",
        }, canopy_trees
        assert set(canopy_trees["materials"]["leafSurfaces"]) == {
            "elliptic-waxy",
            "compound-lanceolate",
            "araucaria-whorl",
        }, canopy_trees
        asset_evidence["canopyTreeLibrary"] = canopy_trees
        iguanodon_review = page.evaluate(
            "window.__projectPlateau.setVisualReviewOrbitForTest({ subject: 'iguanodon', angleDegrees: 135 })"
        )
        assert iguanodon_review["subject"] == "iguanodon", iguanodon_review
        assert iguanodon_review["angleDegrees"] == 135, iguanodon_review
        page.wait_for_timeout(150)
        iguanodon_state = capture(
            "24-review-iguanodon-skin",
            [
                "fixed subject-review camera: authored albedo, non-emissive dielectric skin and crease-bounded normal continuity"
            ],
        )
        iguanodon_skin = iguanodon_state["assets"]["family"]["hy3d"]["skin"]
        assert iguanodon_state["assets"]["family"]["visualStatus"] == "hy3d-family-ready"
        assert iguanodon_state["assets"]["family"]["hy3d"]["loadedAdults"] == 2
        assert iguanodon_state["assets"]["family"]["hy3d"]["loadedYoung"] == 3
        assert iguanodon_skin == {
            "model": "opaque-non-emissive-biological-dielectric",
            "baseColourSource": (
                "authored-hy3d-albedo-with-neutral-olive-calibration"
            ),
            "albedoMultiplierLinear": [0.7, 0.64, 0.52],
            "roughnessSource": "authored-packed-map-green-channel",
            "roughnessFactor": 1,
            "roughnessRange": [0.72, 0.94],
            "roughnessRemap": (
                "authored-green-linearly-remapped-into-dry-scaled-skin-range"
            ),
            "approximateIndexOfRefraction": 1.42,
            "specularIntensity": 0.92,
            "environmentIntensity": 0.48,
            "normalSource": (
                "authored-tangent-space-map-with-restored-unit-strength"
            ),
            "normalScale": [1, 1],
            "clearcoat": 0,
            "transmission": 0,
            "emission": 0,
            "evidenceBoundary": (
                "bounded-skin-optics-not-a-claim-about-extinct-species-pigmentation"
            ),
            "normalContinuity": iguanodon_skin["normalContinuity"],
        }, iguanodon_skin
        assert (
            iguanodon_skin["normalContinuity"]["model"]
            == "crease-bounded-coincident-position-average-across-uv-seams"
        ), iguanodon_skin
        assert iguanodon_skin["normalContinuity"]["creaseDegrees"] == 52
        assert iguanodon_skin["normalContinuity"]["duplicateGroups"] > 0
        assert iguanodon_skin["normalContinuity"]["smoothedVertices"] > 0
        asset_evidence["iguanodonSkin"] = iguanodon_skin
        detritus_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'detritusDetail' })"
        )
        assert detritus_review["shot"] == "detritusDetail", detritus_review
        page.wait_for_timeout(120)
        detritus_state = capture(
            "25-review-forest-floor-detritus",
            [
                "fixed environment-review camera: gravity-settled curled leaves, twigs, bark and husks under canopy-source ecology"
            ],
        )
        assert detritus_state["environmentReviewShot"] == "detritusDetail"
        detritus = detritus_state["assets"]["environmentDensity"][
            "forestFloorDetritus"
        ]
        assert detritus["profile"] == "source-coupled-forest-floor-detritus-v2"
        assert detritus["instanceCount"] == 390
        assert detritus["counts"] == [120, 120, 120, 30]
        assert detritus["drawCalls"] == 4
        assert detritus["variantIds"] == [
            "curled-broadleaf-litter",
            "twig-and-bark-fall",
            "cone-husk-and-leaf-scatter",
            "hero-gingko-fan-leaf-fall",
        ]
        assert detritus["sourceRoleCounts"] == {
            "canopyHabitat": 360,
            "heroGingkoInterRoot": 30,
        }
        assert detritus["supportEvidence"]["supportRatio"] == 1
        assert detritus["supportEvidence"]["minimumClearance"] >= -0.0081
        assert detritus["supportEvidence"]["maximumClearance"] <= 0.035
        assert detritus["ecologyRanges"]["humus"][0] >= 0.08
        assert detritus["ecologyRanges"]["routeWear"][1] <= 0.16
        assert detritus["ecologyRanges"]["wetBank"][1] <= 0.65
        assert detritus["ecologyRanges"]["mineralExposure"][1] <= 0.58
        assert detritus["ecologyRanges"]["slope"][1] <= 0.28
        assert (
            detritus["energyModel"]
            == "opaque-non-emissive-dielectric-dry-and-decaying-organic-matter"
        )
        assert (
            detritus["collisionRole"]
            == "non-solid-compressible-forest-floor-detritus"
        )
        asset_evidence["forestFloorDetritus"] = detritus
        route_surface_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'routeSurfaceDetail' })"
        )
        assert route_surface_review["shot"] == "routeSurfaceDetail", route_surface_review
        page.wait_for_timeout(120)
        route_surface_state = capture(
            "26-review-terrain-integrated-route",
            [
                "fixed environment-review camera: continuous compacted soil route without transparent overlay geometry"
            ],
        )
        assert route_surface_state["environmentReviewShot"] == "routeSurfaceDetail"
        route_surface = route_surface_state["assets"]["terrain"]["routeSurface"]
        assert route_surface["version"] == "terrain-integrated-footfall-compaction-v1"
        assert route_surface["overlayGeometryCount"] == 0
        assert route_surface["overlayDrawCalls"] == 0
        assert route_surface["collisionChange"] == "none"
        assert (
            route_surface["surfaceResponse"]
            == "litter-suppression-colour-compaction-relief-and-roughness"
        )
        asset_evidence["routeSurface"] = route_surface
        forest_boundary_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'forestBoundaryDetail' })"
        )
        assert forest_boundary_review["shot"] == "forestBoundaryDetail", forest_boundary_review
        page.wait_for_timeout(120)
        forest_boundary_state = capture(
            "27-review-complete-boundary-forest",
            [
                "fixed environment-review camera: all twelve terrain-supported boundary cohorts using complete original tree assets"
            ],
        )
        assert (
            forest_boundary_state["environmentReviewShot"]
            == "forestBoundaryDetail"
        ), forest_boundary_state
        forest_edge_original = forest_boundary_state["assets"]["environmentDensity"][
            "forestEdgeOriginal"
        ]
        assert forest_edge_original["instanceCount"] == 144, forest_edge_original
        assert forest_edge_original["cohortCount"] == 12, forest_edge_original
        assert forest_edge_original["fallbackVisible"] is False, forest_edge_original
        assert forest_edge_original["supportEvidence"]["supportRatio"] == 1, forest_edge_original
        assert forest_edge_original["leafRetention"]["damagedInstanceCount"] == 18
        bryophyte_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'bryophyteDetail' })"
        )
        assert bryophyte_review["shot"] == "bryophyteDetail", bryophyte_review
        page.wait_for_timeout(120)
        bryophyte_state = capture(
            "28-review-bryophyte-ground-layer",
            [
                "fixed environment-review camera: closed moss, clubmoss and humid grass forms rooted below the shared terrain heightfield"
            ],
        )
        assert bryophyte_state["environmentReviewShot"] == "bryophyteDetail"
        bryophyte = bryophyte_state["assets"]["environmentDensity"][
            "bryophyteGroundLayer"
        ]
        assert bryophyte["profile"] == "supported-bryophyte-herbaceous-ground-layer-v2"
        assert bryophyte["instanceCount"] == 640
        assert bryophyte["counts"] == {
            "moss-mat": 387,
            "clubmoss-spray": 196,
            "humid-grass-tuft": 57,
        }
        assert bryophyte["drawCalls"] == 3
        assert bryophyte["supportEvidence"]["supportRatio"] == 1
        assert bryophyte["supportEvidence"]["minimumRootClearance"] == -0.026
        assert bryophyte["supportEvidence"]["maximumRootClearance"] == -0.026
        assert all(
            geometry["closedVolumes"]
            and geometry["rootVertexCount"] > 0
            and geometry["rootY"] == 0
            for geometry in bryophyte["geometry"]
        )
        deadfall = bryophyte_state["assets"]["environmentDensity"]["deadfall"]
        assert deadfall["instanceCount"] == 18, deadfall
        assert (
            deadfall["supportModel"]
            == "gravity-settled-tangent-aligned-multipoint-deadfall"
        ), deadfall
        assert deadfall["supportEvidence"] == {
            "instanceCount": 18,
            "supportSampleCount": 78,
            "minimumClearance": -0.0238,
            "maximumClearance": 0.012,
            "maximumTerrainSlope": 0.1189,
        }, deadfall
        assert deadfall["collisionRole"] == "non-solid-visual-accent", deadfall
        assert (
            deadfall["energyModel"]
            == "opaque-non-emissive-dielectric-weathered-wood"
        ), deadfall
        assert deadfall["material"] == {
            "surface": "dry-weathered-furrowed-bark-and-broken-end-grain",
            "moistureClass": "forest-floor-dry-to-damp",
            "textureChannels": {
                "albedo": "world.material.bark-albedo",
                "roughness": "world.material.bark-roughness",
                "height": "world.material.bark-height",
            },
            "flatShading": False,
            "envMapIntensity": 0.08,
        }, deadfall
        assert len(deadfall["geometry"]) == 3, deadfall
        assert all(
            geometry["profile"]
            == "closed-curved-branched-deadwood-with-jagged-fibre-breaks"
            and geometry["surface"]
            == "mapped-furrowed-bark-with-distinct-end-grain-and-splinters"
            and geometry["triangleCount"] >= 696
            and geometry["closedSegmentCount"] >= 7
            and geometry["primaryBranchCount"] >= 2
            and geometry["splinterCount"] >= 4
            and geometry["supportPointCount"] >= 2
            and geometry["loadPath"]
            == "closed-overlapping-trunk-to-branch-volumes-with-tapered-fibre-breaks"
            for geometry in deadfall["geometry"]
        ), deadfall
        assert (
            bryophyte["collisionRole"]
            == "non-solid-compressible-ground-vegetation"
        )
        assert (
            bryophyte["energyModel"]
            == "opaque-non-emissive-zero-metalness-organic-dielectric"
        )
        asset_evidence["bryophyteGroundLayer"] = bryophyte
        cover_review = page.evaluate(
            "window.__projectPlateau.setEnvironmentReviewForTest({ shot: 'coverDetail' })"
        )
        assert cover_review["shot"] == "coverDetail", cover_review
        page.wait_for_timeout(120)
        cover_state = capture(
            "29-review-riparian-cover",
            [
                "fixed environment-review camera: ten independent root-supported riparian trees with overlapping non-solid crowns"
            ],
        )
        assert cover_state["environmentReviewShot"] == "coverDetail", cover_state
        cover = cover_state["assets"]["cover"]
        assert cover["profile"] == "asymmetric-riparian-overlap-canopy", cover
        assert cover["archCount"] == 0, cover
        assert cover["pairCount"] == 5, cover
        assert cover["treeCount"] == 10, cover
        assert cover["bridgeGeometryCount"] == 0, cover
        assert cover["rootAnchorsPreserved"] is True, cover
        assert cover["minimumHalfClearance"] >= 3.4, cover
        assert cover["visualStatus"] == "original-asset-ready", cover
        assert cover["loaded"] is True, cover
        assert cover["fallbackVisible"] is False, cover
        assert cover["instanceCount"] == 10, cover
        assert cover["drawCalls"] == 8, cover
        assert cover["counts"] == [5, 1, 3, 1], cover
        assert (
            cover["supportModel"]
            == "buried-root-mantle-to-trunk-to-closed-branches-to-attached-leaves"
        ), cover
        cover_support = cover["supportEvidence"]
        assert cover_support["supportVertexCount"] == 286, cover_support
        assert cover_support["supportedVertexCount"] == 286, cover_support
        assert cover_support["supportRatio"] == 1, cover_support
        assert cover_support["minimumClearance"] >= -0.82, cover_support
        assert cover_support["maximumClearance"] <= 0, cover_support
        assert cover_support["settlementAxis"] == "world-gravity-only", cover_support
        assert cover["leafRetention"]["ageCounts"] == {
            "submature": 3,
            "mature": 5,
            "pioneer": 2,
        }, cover
        assert len(cover["fallbackBoughs"]) == 10, cover
        assert all(
            bough["crossTrunkBridge"] is False
            and bough["maximumHorizontalCantileverMeters"] <= 2.34
            and bough["loadPath"]
            == "root-mantle-to-vertical-trunk-to-fork-to-attached-crown"
            for bough in cover["fallbackBoughs"]
        ), cover
        asset_evidence["riparianCover"] = cover
        leaf_wind_evidence = escarpment_detail_state["assets"]["vegetation"]["leafFamilies"]
        assert len(leaf_wind_evidence) == 2, leaf_wind_evidence
        for leaf_family in leaf_wind_evidence:
            assert (
                leaf_family["windModel"]["supportModel"]
                == "branch-attached-uv-base-with-flexible-leaf-tip"
            ), leaf_family
            assert 0 < leaf_family["windState"]["horizontalStrength"] <= 0.1, leaf_family
            assert leaf_family["windState"]["time"] == 14.75, leaf_family
            assert (
                leaf_family["shadowDisplacement"]
                == "shared-displacement-uniforms-for-colour-and-depth-pass"
            ), leaf_family
        asset_evidence["vegetationWind"] = {
            "leafFamilies": leaf_wind_evidence,
            "reducedMotionDisablesDisplacement": True,
        }
        browser.close()

    minimal_checks = {
        "launch": launched,
        "render": bool(
            strong["sceneChildren"] > 0 and strong["triangles"] > 0 and not errors
        ),
        "input": bool(input_trace and strong["player"]["distanceTravelled"] > 0),
        "coreLoop": strong["player"]["runStatus"] == "result",
        "outcome": strong["player"]["result"]["band"] == "strong-field-record",
        "restart": bool(
            clean["mode"] == "order"
            and clean["player"]["remainingLight"] == 180
            and clean["player"]["distanceTravelled"] == 0
        ),
    }
    image_health_records = {
        checkpoint["id"]: checkpoint["browser"]["mechanicalVisualHealth"]
        for checkpoint in checkpoints
        if checkpoint["id"]
        in {
            "01-strong-brook-frame",
            "02-strong-basalt-frame",
            "03-strong-glade-frames",
            "04-strong-covered-return",
            "07-minimum-viewport-field",
        }
    }
    assert len(image_health_records) == 5, image_health_records
    assert all(record["passed"] for record in image_health_records.values()), image_health_records
    return {
        "stage": "current-complete-run",
        "runtimeSource": {
            "sha256": runtime_source_fingerprint(),
            "scope": RUNTIME_FINGERPRINT_SCOPE,
        },
        "environment": {
            "browser": browser_version,
            "viewport": [1440, 900],
            "baseUrl": BASE_URL,
        },
        "loading": loading_metrics,
        "performance": performance_metrics,
        "assetEvidence": asset_evidence,
        "renderingEvidence": rendering_evidence,
        "pathMetrics": path_metrics,
        "inputTrace": input_trace,
        "minimalChecks": minimal_checks,
        "mechanicalVisualHealth": image_health_records,
        "checkpoints": checkpoints,
        "limitations": [
            "The recorded path uses deterministic browser automation in local desktop Chromium; other browsers, GPUs and devices were not exercised.",
            "The Strong path records distinct young-play and branch-pull states, but automated pose checks do not establish anatomy or animation quality.",
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
                "minimalChecks": report["minimalChecks"],
                "pathMetrics": report["pathMetrics"],
            },
            indent=2,
        )
    )
    print(f"CURRENT RUN PASS: {evidence_reference(output)}")


if __name__ == "__main__":
    main()
