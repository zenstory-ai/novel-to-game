"""Shared mechanical assertions for Project Plateau authored QA suites."""

from __future__ import annotations

import json
import math
from pathlib import Path
import statistics


TEST = Path(__file__).resolve().parent
CONTRACT = json.loads((TEST / "telemetry-schema.json").read_text(encoding="utf-8"))
PERFORMANCE = CONTRACT["performanceContract"]
ROUTE_CLOCK = CONTRACT["routeClockContract"]
DELIVERY = CONTRACT["deliveryContract"]
ROUTE_INPUT_CONTINUATION_MS = 250


class AssertionFailure(RuntimeError):
    """A shared Project Plateau QA contract failed."""


def route_input_calibration(key: str, continuation_ms: int) -> dict[str, object]:
    if key != "KeyW":
        raise AssertionFailure("route calibration must continue the existing forward traversal input")
    if not isinstance(continuation_ms, int) or not 1 <= continuation_ms <= 350:
        raise AssertionFailure("route input continuation must be bounded to 1..350ms")
    return {
        "input": key,
        "concurrentInput": "KeyC",
        "continuationMs": continuation_ms,
        "continuousInput": True,
        "noInputSegment": False,
    }


def assert_promotion_pf_semantics(
    samples: list[dict[str, object]],
    states: dict[str, dict[str, object]],
) -> dict[str, object]:
    by_pf = {str(sample["pf"]): sample for sample in samples}
    attack = states["PF-04"]
    attack_player = attack["player"]
    attack_visual = attack["threatVisual"]
    if (
        attack_player.get("threatAwareness") != 3
        or attack_player.get("threatState") != "attack"
        or attack_visual.get("attackStage") not in {"fold-dive", "attack"}
    ):
        raise AssertionFailure("PF-04 must capture the real committed awareness-3 dive before cover")
    family_heading = float(states["PF-03"]["player"]["heading"])
    return_player = states["PF-05"]["player"]
    return_heading = float(return_player["heading"])
    heading_delta = abs((return_heading - family_heading + math.pi) % (2 * math.pi) - math.pi)
    transitions = by_pf["PF-05"].get("inputTransitions")
    minimum_turn = 2.3 if by_pf["PF-05"].get("viewport") == "1280x720" else 2.5
    if (
        not isinstance(transitions, list)
        or "MouseTurn" not in transitions
        or "KeyW" not in transitions
        or "KeyA" not in transitions
        or "KeyS" in transitions
    ):
        raise AssertionFailure("PF-05 must use real mouse turn plus camera-relative KeyW return input")
    if heading_delta < minimum_turn:
        raise AssertionFailure("PF-05 heading must materially differ from the family composition")
    if float(return_player["position"]["z"]) <= float(attack_player["position"]["z"]):
        raise AssertionFailure("PF-05 must make forward progress toward Fort")
    forward_to_fort = -math.cos(return_heading)
    minimum_forward = 0.7 if by_pf["PF-05"].get("viewport") == "1280x720" else 0.85
    if forward_to_fort < minimum_forward:
        raise AssertionFailure("PF-05 camera-relative forward direction must face Fort")
    return {
        "pf04Awareness": attack_player["threatAwareness"],
        "pf04AttackStage": attack_visual["attackStage"],
        "pf05HeadingDelta": round(heading_delta, 4),
        "pf05InputTransitions": transitions,
    }


def assert_route_clock(report: dict[str, object]) -> dict[str, object]:
    metrics = report["pathMetrics"]["Strong"]
    simulation = float(metrics["simulationSeconds"])
    wall = float(metrics["wallSeconds"])
    minimum, maximum = ROUTE_CLOCK["productToleranceSeconds"]
    if not minimum <= simulation <= maximum:
        raise AssertionFailure(f"Strong simulation clock outside product tolerance: {simulation}")
    if abs(simulation - ROUTE_CLOCK["baselineSimulationSeconds"]) > ROUTE_CLOCK["maximumBaselineDeltaSeconds"]:
        raise AssertionFailure(f"Strong simulation clock drifted from retained baseline: {simulation}")
    if abs(wall - simulation) > ROUTE_CLOCK["maximumWallSimulationDeltaSeconds"]:
        raise AssertionFailure(f"wall/simulation clock drift is too large: wall={wall} simulation={simulation}")
    trace = [item for item in report["inputTrace"] if item["path"] == "Strong"]
    if not trace or any(float(item.get("wallSeconds", 0)) <= 0 for item in trace):
        raise AssertionFailure("Strong trace contains an empty or uninstrumented segment")
    calibrated = [item for item in trace if item.get("continuationMs")]
    if len(calibrated) != 1 or calibrated[0] != {
        **calibrated[0],
        **route_input_calibration("KeyW", ROUTE_INPUT_CONTINUATION_MS),
    }:
        raise AssertionFailure("Strong trace lacks the single bounded continuous-input calibration")
    if any(item.get("noInputSegment") is True for item in trace):
        raise AssertionFailure("Strong trace contains forbidden no-input calibration")
    return {"status": "PASS", "simulationSeconds": simulation, "wallSeconds": wall, "segments": len(trace)}


def assert_performance_method(warmup: int, repeats: int, frames: int) -> None:
    canonical = (
        PERFORMANCE["defaultWarmupFrames"],
        PERFORMANCE["defaultRepeats"],
        PERFORMANCE["defaultFramesPerRepeat"],
    )
    if (warmup, repeats, frames) == canonical:
        return
    if warmup < PERFORMANCE["defaultWarmupFrames"]:
        raise AssertionFailure("performance warmup cannot be weaker than the declared default")
    if frames * repeats < PERFORMANCE["minimumMeasuredFrames"] or repeats < PERFORMANCE["defaultRepeats"]:
        raise AssertionFailure("alternative performance method must retain the declared measured-frame and repeat power")


def summarize_frame_times(frame_times: list[float]) -> dict[str, float]:
    median_ms = statistics.median(frame_times)
    tail_count = max(1, math.ceil(len(frame_times) * 0.01))
    slowest_one_percent_ms = statistics.fmean(sorted(frame_times, reverse=True)[:tail_count])
    return {
        "medianFrameMs": round(median_ms, 3),
        "medianFps": round(1000 / median_ms, 1),
        "onePercentLowFps": round(1000 / slowest_one_percent_ms, 1),
        "worstFrameMs": round(max(frame_times), 3),
    }


def assert_performance_contract(repeats: list[dict[str, object]]) -> dict[str, float]:
    worst = {
        "medianFps": min(float(item["medianFps"]) for item in repeats),
        "onePercentLowFps": min(float(item["onePercentLowFps"]) for item in repeats),
    }
    floor = PERFORMANCE["releaseFloor"]
    if worst["medianFps"] < floor["medianFps"] or worst["onePercentLowFps"] < floor["onePercentLowFps"]:
        raise AssertionFailure(f"release performance failed: {worst}")
    return worst


def assert_investment_stop_loss(manifests: dict[str, dict[str, object]]) -> bool:
    threshold = PERFORMANCE["investmentStopLoss"]
    return all(
        item["worstRepeat"]["medianFps"] >= threshold["medianFps"]
        and item["worstRepeat"]["onePercentLowFps"] >= threshold["onePercentLowFps"]
        for item in manifests.values()
    )


def assert_delivery_budget(metric: str, *, raw_bytes: int, gzip_bytes: int) -> None:
    if metric == "raw-bytes" and raw_bytes > DELIVERY["totalRawBytes"]:
        raise AssertionFailure(f"raw payload exceeds contract: {raw_bytes}")
    if metric == "initial-gzip" and gzip_bytes > DELIVERY["initialGzipBytes"]:
        raise AssertionFailure(f"gzip payload exceeds contract: {gzip_bytes}")
