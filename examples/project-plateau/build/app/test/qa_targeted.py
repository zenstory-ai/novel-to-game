#!/usr/bin/env python3
"""Targeted selector, evidence, and freeze audits for Project Plateau.

This runner owns orchestration only. Gameplay and browser assertions remain in
their authored suites; evidence-only selectors consume frozen artifacts.
"""

from __future__ import annotations

import argparse
import ast
import gzip
import hashlib
import json
import os
from pathlib import Path
import socket
import statistics
import subprocess
import sys
import time
from urllib.parse import urlparse

from qa_assertions import (
    AssertionFailure,
    assert_delivery_budget,
    assert_investment_stop_loss,
    assert_performance_contract,
    assert_performance_method,
    assert_route_clock,
    summarize_frame_times,
)


APP = Path(__file__).resolve().parent.parent
BUILD = APP.parent
PROJECT = BUILD.parent
REPO = PROJECT.parents[1]
TEST = APP / "test"
DEFAULT_EVIDENCE = BUILD / "evidence" / "visual-upgrade"
CANONICAL_ACS = {f"AC-{index:02d}" for index in range(1, 21)}
FINGERPRINT_KEYS = {
    "appFingerprint", "evidenceMethodFingerprint", "rubricFingerprint", "referenceFingerprint"
}
TELEMETRY_CONTRACT = json.loads((TEST / "telemetry-schema.json").read_text(encoding="utf-8"))
PERFORMANCE_CONTRACT = TELEMETRY_CONTRACT["performanceContract"]
PERFORMANCE_DEFAULTS = {
    "warmupFrames": PERFORMANCE_CONTRACT["defaultWarmupFrames"],
    "repeats": PERFORMANCE_CONTRACT["defaultRepeats"],
    "frames": PERFORMANCE_CONTRACT["defaultFramesPerRepeat"],
}
_ROUTE_CLOCK_CONTRACT = TELEMETRY_CONTRACT["routeClockContract"]
ROUTE_CLOCK = {
    "baselineSeconds": _ROUTE_CLOCK_CONTRACT["baselineSimulationSeconds"],
    "minimumSeconds": _ROUTE_CLOCK_CONTRACT["productToleranceSeconds"][0],
    "maximumSeconds": _ROUTE_CLOCK_CONTRACT["productToleranceSeconds"][1],
    "baselineToleranceSeconds": _ROUTE_CLOCK_CONTRACT["maximumBaselineDeltaSeconds"],
    "wallSimulationToleranceSeconds": _ROUTE_CLOCK_CONTRACT["maximumWallSimulationDeltaSeconds"],
}


class ContractError(RuntimeError):
    """A targeted contract is missing or invalid."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def normalized_args(selector: str, supplied: dict[str, object]) -> dict[str, object]:
    defaults: dict[str, dict[str, object]] = {
        "strong-route": {"profile": "balanced", "viewport": "1440x900"},
        "deterministic-paths": {"profile": "balanced", "paths": "strong,mixed,panic"},
        "route-clock": {"profile": "balanced", **ROUTE_CLOCK},
        "promotion-trace": {"profile": "balanced", "viewport": "1440x900", "inputOnly": True, "uncut": True},
        "camera-continuity": {"controllerContract": "current"},
        "performance-heaviest": {"profile": "balanced", "viewport": "1440x900", **PERFORMANCE_DEFAULTS},
        "delivery-budget": {},
        "evidence-integrity": {"fingerprints": "all4"},
        "spatial-anchors": {"profile": "balanced"},
        "profile-equivalence": {"profiles": "low,balanced,high"},
        "pf-contracts": {"pf": "01..06"},
        "accessibility-layout-motion": {"viewport": "1280x720", "textScale": 1.5, "reducedMotion": True},
        "accessibility-colour": {"modes": "protanopia,deuteranopia,tritanopia,achromatopsia"},
        "evidence-schema": {"bundle": "frozen"},
        "review-bundle-audit": {"bundle": "frozen", "forms": "signed"},
        "investment-stop-loss": {"source": "AC-06,AC-07", "threshold": "50/35"},
        "quality-delta-audit": {"activePF": "01..05", "minDelta": 1, "minDimensions": 4},
    }
    if selector not in defaults:
        raise ContractError(f"unknown selector: {selector}")
    return dict(sorted({**defaults[selector], **supplied}.items()))


def load_coverage(path: Path) -> list[dict[str, object]]:
    document = json.loads(path.read_text(encoding="utf-8"))
    registrations = document.get("registrations") if isinstance(document, dict) else None
    if not isinstance(registrations, list):
        raise ContractError("coverage document must contain a registrations array")
    return registrations


def resolve_reference(reference: str) -> tuple[Path, str | None]:
    path_text, separator, fragment = reference.partition("#")
    path = (APP / path_text).resolve()
    if not path.is_relative_to(REPO.resolve()) or not path.exists():
        raise ContractError(f"provenance path does not exist inside repository: {reference}")
    return path, fragment if separator else None


def validate_reference(reference: str) -> None:
    path, fragment = resolve_reference(reference)
    if not fragment:
        return
    if path.suffix == ".py":
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        top_level = {
            node.name for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
        }
        if fragment not in top_level:
            raise ContractError(f"Python provenance symbol is not top-level or does not exist: {reference}")
        return
    if path.suffix == ".json" and fragment.startswith("/"):
        value: object = json.loads(path.read_text(encoding="utf-8"))
        for part in fragment[1:].split("/"):
            key = part.replace("~1", "/").replace("~0", "~")
            if not isinstance(value, dict) or key not in value:
                raise ContractError(f"JSON provenance pointer does not exist: {reference}")
            value = value[key]
        return
    if fragment not in path.read_text(encoding="utf-8", errors="ignore"):
        raise ContractError(f"provenance fragment does not exist: {reference}")


def validate_provenance(row: dict[str, object], index: int) -> list[str]:
    problems = []
    assertion_references: list[str] = []
    for field in ("assertionSource", "fixtureOrCheckpointSource"):
        value = row.get(field)
        if not isinstance(value, str) or not value.strip():
            problems.append(f"row {index}: {field} must be a non-empty string")
            continue
        for reference in value.split(" + "):
            if field == "assertionSource":
                assertion_references.append(reference)
            try:
                validate_reference(reference)
            except ContractError as error:
                problems.append(f"row {index}: {error}")
    from verify import SUITES
    suite_ids = {suite.identifier for suite in SUITES} | {"authoritative:frozen-evidence"}
    suite_value = row.get("authoritativeSuite")
    if not isinstance(suite_value, str):
        problems.append(f"row {index}: authoritativeSuite must be a string")
    else:
        unknown = [item for item in suite_value.split(" + ") if item not in suite_ids]
        if unknown:
            problems.append(f"row {index}: unknown authoritative suite ids {unknown}")
        declared = {
            item for item in suite_value.split(" + ")
            if item != "authoritative:frozen-evidence" and item in suite_ids
        }
        authored: set[str] = set()
        for reference in assertion_references:
            try:
                source_path, _ = resolve_reference(reference)
            except ContractError:
                continue
            for suite in SUITES:
                for location in suite.locations:
                    registered_path = (suite.cwd / location).resolve()
                    if source_path == registered_path or (
                        location.endswith("/") and source_path.is_relative_to(registered_path)
                    ):
                        authored.add(suite.identifier)
                        break
        if authored and authored != declared:
            problems.append(
                f"row {index}: authoritative suite membership mismatch "
                f"declared={sorted(declared)} authored={sorted(authored)}"
            )
    return problems


def audit_coverage(path: Path) -> dict[str, object]:
    required = {
        "acId", "selector", "selectorArgs", "metric", "viewport",
        "assertionSource", "fixtureOrCheckpointSource", "authoritativeSuite",
    }
    registrations = load_coverage(path)
    problems: list[str] = []
    ids: list[str] = []
    full_keys: set[tuple[str, str, str]] = set()
    for index, row in enumerate(registrations):
        if not isinstance(row, dict):
            problems.append(f"row {index}: registration must be an object")
            continue
        missing = required - row.keys()
        unknown = row.keys() - required
        if missing:
            problems.append(f"row {index}: missing fields {sorted(missing)}")
        if unknown:
            problems.append(f"row {index}: unknown fields {sorted(unknown)}")
        ac_id = row.get("acId")
        selector = row.get("selector")
        selector_args = row.get("selectorArgs")
        if not isinstance(ac_id, str) or ac_id not in CANONICAL_ACS:
            problems.append(f"row {index}: unknown acId {ac_id!r}")
            continue
        ids.append(ac_id)
        if not isinstance(selector, str) or not isinstance(selector_args, dict):
            problems.append(f"row {index}: selector and selectorArgs must be typed")
            continue
        try:
            expanded = normalized_args(selector, selector_args)
        except ContractError as error:
            problems.append(f"row {index}: {error}")
            continue
        full_key = (ac_id, selector, canonical_json(expanded))
        if full_key in full_keys:
            problems.append(f"row {index}: duplicate full registration {full_key}")
        full_keys.add(full_key)
        assertion_source = row.get("assertionSource")
        if not isinstance(assertion_source, str) or assertion_source.startswith("test/qa_targeted.py"):
            problems.append(f"row {index}: runner-owned duplicate assertion is forbidden")
        problems.extend(validate_provenance(row, index))
    duplicate_ids = sorted({ac_id for ac_id in ids if ids.count(ac_id) > 1})
    if duplicate_ids:
        problems.append("duplicate acId: " + ", ".join(duplicate_ids))
    actual = set(ids)
    if actual != CANONICAL_ACS:
        problems.append(
            f"canonical AC mismatch missing={sorted(CANONICAL_ACS - actual)} orphan={sorted(actual - CANONICAL_ACS)}"
        )
    if problems:
        raise ContractError("coverage audit failed:\n- " + "\n- ".join(problems))
    return {
        "status": "PASS",
        "coverage": sorted(actual),
        "registrations": len(registrations),
        "normalizedRegistrationHashes": [sha256_bytes("|".join(key).encode()) for key in sorted(full_keys)],
    }


def app_fingerprint() -> str:
    from verify import app_fingerprint as shared_app_fingerprint
    return shared_app_fingerprint()


def hash_inputs(paths: list[Path], *, root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        if not path.is_file():
            raise ContractError(f"fingerprint input missing: {path}")
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def four_fingerprints() -> dict[str, str]:
    method_inputs = sorted(TEST.glob("*.py")) + [
        TEST / "targeted-coverage.json", TEST / "telemetry-schema.json",
        TEST / "visual-review-contract.json",
    ]
    rubric_inputs = [TEST / "visual-review-contract.json", PROJECT / "design" / "ART_DIRECTION.md"]
    reference_manifest = json.loads((TEST / "reference-manifest.json").read_text(encoding="utf-8"))
    reference_inputs = [TEST / "reference-manifest.json"]
    for item in reference_manifest["resources"]:
        path = TEST / item["path"]
        if path.stat().st_size != item["bytes"] or sha256_file(path) != item["sha256"]:
            raise ContractError(f"reference resource binding mismatch: {item['path']}")
        reference_inputs.append(path)
    return {
        "appFingerprint": app_fingerprint(),
        "evidenceMethodFingerprint": hash_inputs(method_inputs, root=APP),
        "rubricFingerprint": hash_inputs(rubric_inputs, root=PROJECT),
        "referenceFingerprint": hash_inputs(reference_inputs, root=APP),
    }


def anchor_audit() -> dict[str, object]:
    baseline_path = TEST / "spatial-anchor-baseline.json"
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    actual = {
        relative: sha256_file(APP / relative)
        for relative in baseline["files"]
    }
    if actual != baseline["files"]:
        raise ContractError(f"shared spatial anchors changed: expected={baseline['files']} actual={actual}")
    derived = baseline["derivedSnapshot"]
    snapshot_path = APP / derived["path"]
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    if sha256_file(snapshot_path) != derived["sha256"]:
        raise ContractError("derived spatial anchor/collider snapshot hash changed")
    if len(snapshot["collision"]["STATIC_COLLIDERS"]) != derived["colliderCount"]:
        raise ContractError("derived collider count changed")
    if len(snapshot["anchors"]["VEGETATION_LAYOUT"]["trees"]) != derived["treeCount"]:
        raise ContractError("derived vegetation anchor count changed")
    return {"status": "PASS", "seed": baseline["seed"], "files": actual, "derivedSnapshot": derived}


def run_script(script: str) -> None:
    result = subprocess.run([sys.executable, script], cwd=APP)
    if result.returncode:
        raise ContractError(f"authoritative suite failed: {script}")


def load_report(stage: str) -> dict[str, object]:
    return json.loads((BUILD / "evidence" / stage / "report.json").read_text(encoding="utf-8"))


def current_s8_report() -> dict[str, object]:
    path = BUILD / "evidence" / "s8" / "report.json"
    if path.is_file():
        report = json.loads(path.read_text(encoding="utf-8"))
        if report.get("source", {}).get("sha256") == app_fingerprint():
            return report
    run_script("test/qa_s8.py")
    report = load_report("s8")
    if report.get("source", {}).get("sha256") != app_fingerprint():
        raise ContractError("S8 report did not bind the current app fingerprint")
    return report


def start_server() -> tuple[subprocess.Popen[str] | None, str]:
    base_url = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
    parsed = urlparse(base_url)
    with socket.socket() as probe:
        try:
            probe.connect((parsed.hostname or "127.0.0.1", parsed.port or 4173))
            return None, base_url
        except OSError:
            pass
    process = subprocess.Popen(
        ["npm", "run", "start", "--", "--host", "127.0.0.1", "--port", "4173"],
        cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True,
    )
    for _ in range(100):
        with socket.socket() as probe:
            try:
                probe.connect(("127.0.0.1", 4173))
                return process, base_url
            except OSError:
                if process.poll() is not None:
                    break
                time.sleep(.1)
    process.terminate()
    raise ContractError("Vite did not become ready for targeted performance")


def run_performance(args: argparse.Namespace) -> dict[str, object]:
    from playwright.sync_api import sync_playwright
    width, height = map(int, args.viewport.split("x"))
    warmup = args.warmup_frames
    repeats = args.repeats
    frames = args.frames
    assert_performance_method(warmup, repeats, frames)
    fingerprints = four_fingerprints()
    if args.profile != TELEMETRY_CONTRACT["freezeBundleContract"]["performanceProfile"]:
        raise ContractError("release/investment performance evidence must use balanced profile")
    selector_predicate = PERFORMANCE_CONTRACT["heaviestStatePredicate"]
    selector_hash = sha256_bytes(canonical_json(selector_predicate).encode())
    output = Path(args.output).resolve() if args.output else DEFAULT_EVIDENCE / "performance"
    output.mkdir(parents=True, exist_ok=True)
    server, base_url = start_server()
    raw: list[dict[str, object]] = []
    repeat_summaries: list[dict[str, object]] = []
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            if chrome.exists():
                launch["executable_path"] = str(chrome)
            browser = playwright.chromium.launch(**launch)
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            page.goto(f"{base_url}/?qa=targeted-performance", wait_until="networkidle")
            page.wait_for_function("window.__projectPlateau?.ready === true")
            page.get_by_role("button", name="Settings").click()
            page.locator("#visual-quality").select_option(args.profile)
            page.locator("#settings-panel .panel-close").click()
            page.get_by_role("button", name="Enter the basin").click()
            page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=120_000)
            page.get_by_role("button", name="Begin field work").click()
            page.evaluate("window.__projectPlateau.loadHy3dVisualsForTest()")
            page.evaluate("window.__projectPlateau.teleportForTest({x: 0, z: -10})")
            page.keyboard.press("KeyE")
            page.wait_for_timeout(60)
            page.mouse.move(width // 2, height // 2)
            page.mouse.down(button="right")
            page.mouse.click(width // 2, height // 2, button="left")
            page.mouse.up(button="right")
            page.wait_for_function("window.__projectPlateau.snapshot().player.threatState === 'attack'", timeout=5000)
            state = page.evaluate("window.__projectPlateau.snapshot()")
            if state["presentationSettings"]["quality"] != args.profile:
                raise ContractError("selected quality profile was not applied")
            page.evaluate("count => window.__projectPlateau.sampleFrames(count)", warmup)
            for repeat in range(1, repeats + 1):
                frame_times = page.evaluate(
                    """count => new Promise(resolve => {
                      const values = [];
                      let previous = null;
                      let observed = window.__projectPlateau.snapshot().renderBudget.renderedFrames;
                      const take = now => {
                        const current = window.__projectPlateau.snapshot().renderBudget.renderedFrames;
                        if (current !== observed) {
                          if (previous !== null) values.push(now - previous);
                          previous = now;
                          observed = current;
                        }
                        if (values.length >= count) resolve(values); else requestAnimationFrame(take); };
                      requestAnimationFrame(take);
                    })""", frames,
                )
                summary = {"repeat": repeat, **summarize_frame_times(frame_times)}
                repeat_summaries.append(summary)
                started = time.time() * 1000
                elapsed = 0.0
                for index, frame_time in enumerate(frame_times):
                    elapsed += frame_time
                    raw.append({
                        "repeat": repeat, "index": index, "timestampMs": round(started + elapsed, 3),
                        "frameTimeMs": round(float(frame_time), 3), "viewport": args.viewport,
                        "profile": args.profile, "stateSelectorHash": selector_hash, "warmupFrames": warmup,
                        "appFingerprint": fingerprints["appFingerprint"],
                        "evidenceMethodFingerprint": fingerprints["evidenceMethodFingerprint"],
                    })
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
    worst = assert_performance_contract(repeat_summaries)
    raw_path = output / f"raw-{args.viewport}-{args.profile}.jsonl"
    raw_path.write_text("".join(canonical_json(item) + "\n" for item in raw), encoding="utf-8")
    manifest = {
        "schemaVersion": 1, "scenario": "performance-heaviest", "viewport": args.viewport,
        "profile": args.profile, "warmupFrames": warmup, "repeats": repeats, "framesPerRepeat": frames,
        "measuredFrames": frames * repeats, "stateSelector": selector_predicate, "stateSelectorHash": selector_hash,
        "fingerprints": fingerprints, "repeatSummaries": repeat_summaries,
        "worstRepeat": worst,
        "rawFrames": {"path": raw_path.name, "sha256": sha256_file(raw_path)},
    }
    manifest_path = output / f"manifest-{args.viewport}-{args.profile}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def iter_bundle_files(bundle: Path, *, include_reviews: bool) -> list[Path]:
    ignored = {"freeze.json", "reviews-freeze.json", "post-verify-audit.json"}
    files = []
    for path in bundle.rglob("*"):
        if not path.is_file() or path.name in ignored:
            continue
        if not include_reviews and path.is_relative_to(bundle / "reviews"):
            continue
        files.append(path)
    return sorted(files)


def file_manifest(bundle: Path, *, include_reviews: bool) -> list[dict[str, object]]:
    return [
        {"path": path.relative_to(bundle).as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)}
        for path in iter_bundle_files(bundle, include_reviews=include_reviews)
    ]


def manifest_hash(files: list[dict[str, object]]) -> str:
    return sha256_bytes(canonical_json(files).encode())


def validate_telemetry(path: Path) -> int:
    required = set(
        TELEMETRY_CONTRACT["performanceSampleRequired"]
        if path.parent.name == "performance"
        else TELEMETRY_CONTRACT["promotionSampleRequired"]
    )
    count = 0
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            sample = json.loads(line)
            missing = required - sample.keys()
            if missing:
                raise ContractError(f"{path}:{line_number} missing telemetry fields {sorted(missing)}")
            count += 1
    if count == 0:
        raise ContractError(f"telemetry is empty: {path}")
    return count


def validate_promotion_telemetry(path: Path) -> dict[str, object]:
    required = set(TELEMETRY_CONTRACT["promotionSampleRequired"])
    samples = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    if len(samples) < 6:
        raise ContractError("promotion telemetry must contain at least PF-01..PF-06 samples")
    expected_pf = {f"PF-{index:02d}" for index in range(1, 7)}
    actual_pf = {sample.get("pf") for sample in samples}
    if actual_pf != expected_pf:
        raise ContractError(f"promotion telemetry PF set mismatch: {actual_pf}")
    previous = -1.0
    trace_ids = set()
    fingerprints = four_fingerprints()
    for index, sample in enumerate(samples):
        missing = required - sample.keys()
        if missing:
            raise ContractError(f"promotion telemetry row {index} missing {sorted(missing)}")
        timestamp = sample["timestampMs"]
        if not isinstance(timestamp, (int, float)) or timestamp <= previous:
            raise ContractError("promotion telemetry timestamps must increase")
        previous = timestamp
        trace_ids.add(sample["traceId"])
        if sample["clipTimecodeMs"] != timestamp:
            raise ContractError("promotion telemetry clip timecode must be synchronized")
        if any(sample[key] != value for key, value in fingerprints.items()):
            raise ContractError("promotion telemetry fingerprints are stale")
        if not isinstance(sample["position"], dict) or set(sample["position"]) != {"x", "z"}:
            raise ContractError("promotion telemetry position must be planar x/z")
        if not isinstance(sample["linearVelocity"], dict) or set(sample["linearVelocity"]) != {"x", "z"}:
            raise ContractError("promotion telemetry linearVelocity must be planar x/z")
        if not isinstance(sample["inputTransitions"], list):
            raise ContractError("promotion telemetry inputTransitions must be an array")
        if sample.get("inputOnly") is not True or sample.get("uncut") is not True:
            raise ContractError("promotion telemetry must attest input-only and uncut capture")
        if sample.get("diagnostic") is not False or sample.get("captureSource") != "qa_s8-real-browser-input":
            raise ContractError("promotion telemetry must come from the real S8 input capture, not a fixture/diagnostic")
        if sample.get("viewport") != "1440x900":
            raise ContractError("promotion telemetry must bind the canonical 1440x900 take")
    if samples[0]["pf"] != "PF-01" or samples[-1]["pf"] != "PF-06":
        raise ContractError("promotion telemetry must bind first control through terminal result")
    if len(trace_ids) != 1:
        raise ContractError("promotion telemetry must come from one trace")
    return {"samples": len(samples), "pf": sorted(actual_pf), "sha256": sha256_file(path)}


def validate_promotion_capture(bundle: Path) -> dict[str, object]:
    telemetry_path = bundle / "paths" / "promotion-telemetry.jsonl"
    clip_path = bundle / "paths" / "promotion.webm"
    receipt_path = bundle / "paths" / "capture-1440x900.json"
    if not receipt_path.is_file():
        raise ContractError("promotion requires a real-browser capture receipt; fixture-only proof is forbidden")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    expected = {
        "captureSource": "qa_s8-real-browser-input", "viewport": "1440x900",
        "inputOnly": True, "uncut": True, "diagnostic": False,
    }
    if any(receipt.get(key) != value for key, value in expected.items()):
        raise ContractError("promotion capture receipt is not an input-only uncut S8 capture")
    if receipt.get("fingerprints") != four_fingerprints():
        raise ContractError("promotion capture receipt fingerprints are stale")
    for field, path in (("telemetry", telemetry_path), ("clip", clip_path)):
        binding = receipt.get(field)
        if not isinstance(binding, dict) or binding.get("sha256") != sha256_file(path):
            raise ContractError(f"promotion capture receipt {field} hash mismatch")
    samples = [json.loads(line) for line in telemetry_path.read_text(encoding="utf-8").splitlines() if line]
    trace_ids = {sample["traceId"] for sample in samples}
    if trace_ids != {receipt.get("traceId")}:
        raise ContractError("promotion receipt and telemetry trace ids differ")
    previous_time = -1.0
    for sample in samples:
        pf = sample["pf"]
        stem = f"{pf}-1440x900"
        paths = {
            "frameSha256": bundle / "frames" / f"{stem}.jpg",
            "stateSha256": bundle / "state" / f"{stem}.json",
            "browserSha256": bundle / "browser" / f"{stem}.json",
        }
        for field, path in paths.items():
            if not path.is_file() or sample.get(field) != sha256_file(path):
                raise ContractError(f"promotion {pf} {field} binding mismatch")
        state = json.loads(paths["stateSha256"].read_text(encoding="utf-8"))
        browser = json.loads(paths["browserSha256"].read_text(encoding="utf-8"))
        if browser.get("traceId") != sample["traceId"] or browser.get("timecodeMs") != sample["clipTimecodeMs"]:
            raise ContractError(f"promotion {pf} browser/timecode synchronization mismatch")
        if browser.get("inputOnly") is not True or browser.get("uncut") is not True or browser.get("diagnostic") is not False:
            raise ContractError(f"promotion {pf} browser record is not active input-only evidence")
        player = state.get("player", {})
        if player.get("position") != sample["position"] or player.get("heading") != sample["heading"] or player.get("pitch") != sample["pitch"]:
            raise ContractError(f"promotion {pf} state/telemetry synchronization mismatch")
        if state.get("cameraMode") != sample["cameraMode"]:
            raise ContractError(f"promotion {pf} camera mode mismatch")
        if sample["clipTimecodeMs"] <= previous_time:
            raise ContractError("promotion timecodes must be strictly increasing")
        previous_time = sample["clipTimecodeMs"]
    terminal = json.loads((bundle / "state" / "PF-06-1440x900.json").read_text(encoding="utf-8"))
    player = terminal.get("player", {})
    if terminal.get("cameraMode") != "terminal" or player.get("result", {}).get("band") != "strong-field-record":
        raise ContractError("PF-06 is not the same-trace Strong terminal")
    if [plate.get("frameKey") for plate in player.get("plates", [])] != [
        "brook-partial", "basalt-scale", "glade-young-play", "glade-branch-pull",
    ]:
        raise ContractError("PF-06 does not contain the exact ordered four plates")
    return {"status": "PASS", "traceId": receipt["traceId"], "samples": len(samples)}


def validate_pf_contracts(bundle: Path) -> dict[str, object]:
    promotion = validate_promotion_capture(bundle)
    for viewport in TELEMETRY_CONTRACT["pfBundleContract"]["viewports"]:
        receipt_path = bundle / "paths" / f"capture-{viewport}.json"
        if not receipt_path.is_file():
            raise ContractError(f"PF contracts missing real-input viewport receipt: {viewport}")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if receipt.get("viewport") != viewport or receipt.get("inputOnly") is not True or receipt.get("diagnostic") is not False:
            raise ContractError(f"PF viewport capture is not active real-input evidence: {viewport}")
        for pf in range(1, 7):
            stem = f"PF-{pf:02d}-{viewport}"
            for directory, suffix in (("frames", ".jpg"), ("state", ".json"), ("browser", ".json")):
                if not (bundle / directory / f"{stem}{suffix}").is_file():
                    raise ContractError(f"PF contract missing {stem} {directory}")
    return {**promotion, "viewports": TELEMETRY_CONTRACT["pfBundleContract"]["viewports"]}


def validate_resource_manifest(bundle: Path, manifest: dict[str, object]) -> None:
    resources = manifest.get("resources")
    if not isinstance(resources, list) or not resources:
        raise ContractError("bundle manifest requires a non-empty resources array")
    seen = set()
    for resource in resources:
        if not isinstance(resource, dict) or set(resource) != {"path", "bytes", "sha256"}:
            raise ContractError("bundle resource entries require path, bytes, and sha256")
        path = (bundle / resource["path"]).resolve()
        if not path.is_relative_to(bundle.resolve()) or not path.is_file():
            raise ContractError(f"bundle resource is missing or escapes bundle: {resource}")
        if resource["path"] in seen:
            raise ContractError(f"duplicate bundle resource: {resource['path']}")
        seen.add(resource["path"])
        if resource["bytes"] != path.stat().st_size or resource["sha256"] != sha256_file(path):
            raise ContractError(f"bundle resource hash/size mismatch: {resource['path']}")
    actual = {
        path.relative_to(bundle).as_posix()
        for path in iter_bundle_files(bundle, include_reviews=False)
        if path.name != "manifest.json"
    }
    if seen != actual:
        raise ContractError(f"bundle resource manifest mismatch missing={sorted(actual-seen)} orphan={sorted(seen-actual)}")


def validate_performance_bundle(bundle: Path) -> dict[str, dict[str, object]]:
    contract = PERFORMANCE_CONTRACT
    expected_viewports = set(TELEMETRY_CONTRACT["freezeBundleContract"]["performanceViewports"])
    manifests: dict[str, dict[str, object]] = {}
    fingerprints = four_fingerprints()
    expected_selector = contract["heaviestStatePredicate"]
    expected_selector_hash = sha256_bytes(canonical_json(expected_selector).encode())
    for path in sorted((bundle / "performance").glob("manifest-*.json")):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        viewport = manifest.get("viewport")
        if viewport not in expected_viewports or viewport in manifests:
            raise ContractError(f"unexpected/duplicate performance viewport: {viewport}")
        if manifest.get("profile") != "balanced":
            raise ContractError("frozen performance must use balanced profile")
        warmup = manifest.get("warmupFrames")
        repeats = manifest.get("repeats")
        frames = manifest.get("framesPerRepeat")
        if not all(isinstance(value, int) for value in (warmup, repeats, frames)):
            raise ContractError("performance sampling counts must be integers")
        if warmup < contract["defaultWarmupFrames"] or repeats < contract["defaultRepeats"] or frames < contract["defaultFramesPerRepeat"]:
            raise ContractError("performance bundle is weaker than 300 warmup + 3x600")
        if manifest.get("measuredFrames") != repeats * frames or repeats * frames < contract["minimumMeasuredFrames"]:
            raise ContractError("performance measured-frame count is inconsistent")
        if manifest.get("stateSelector") != expected_selector or manifest.get("stateSelectorHash") != expected_selector_hash:
            raise ContractError("performance heaviest-state predicate/hash mismatch")
        if manifest.get("fingerprints") != fingerprints:
            raise ContractError("performance fingerprints are stale")
        raw_record = manifest.get("rawFrames")
        if not isinstance(raw_record, dict) or set(raw_record) != {"path", "sha256"}:
            raise ContractError("performance manifest lacks raw frame binding")
        raw_path = (path.parent / raw_record["path"]).resolve()
        if not raw_path.is_relative_to(path.parent.resolve()) or not raw_path.is_file() or sha256_file(raw_path) != raw_record["sha256"]:
            raise ContractError("performance raw frame hash mismatch")
        rows = [json.loads(line) for line in raw_path.read_text(encoding="utf-8").splitlines() if line]
        if len(rows) != repeats * frames:
            raise ContractError("performance raw row count does not match manifest")
        summaries = []
        for repeat in range(1, repeats + 1):
            selected = [row for row in rows if row.get("repeat") == repeat]
            if len(selected) != frames or [row.get("index") for row in selected] != list(range(frames)):
                raise ContractError(f"performance repeat {repeat} is incomplete or misindexed")
            for row in selected:
                missing = set(TELEMETRY_CONTRACT["performanceSampleRequired"]) - row.keys()
                if missing:
                    raise ContractError(f"performance row missing {sorted(missing)}")
                if row["viewport"] != viewport or row["profile"] != "balanced":
                    raise ContractError("performance raw viewport/profile mismatch")
                if row["warmupFrames"] != warmup or row["stateSelectorHash"] != expected_selector_hash:
                    raise ContractError("performance raw method/state mismatch")
                if row["appFingerprint"] != fingerprints["appFingerprint"] or row["evidenceMethodFingerprint"] != fingerprints["evidenceMethodFingerprint"]:
                    raise ContractError("performance raw fingerprints are stale")
                if not isinstance(row["frameTimeMs"], (int, float)) or row["frameTimeMs"] <= 0:
                    raise ContractError("performance frame time must be positive")
            summaries.append({"repeat": repeat, **summarize_frame_times([float(row["frameTimeMs"]) for row in selected])})
        if manifest.get("repeatSummaries") != summaries:
            raise ContractError("performance repeat summaries do not reconcile with raw rows")
        if manifest.get("worstRepeat") != assert_performance_contract(summaries):
            raise ContractError("performance worst-repeat summary does not reconcile")
        manifests[viewport] = manifest
    if set(manifests) != expected_viewports:
        raise ContractError(f"performance bundle requires both viewports: {set(manifests)}")
    return manifests


def validate_complete_bundle(bundle: Path) -> dict[str, object]:
    manifest = evidence_manifest(bundle)
    contract = TELEMETRY_CONTRACT["freezeBundleContract"]
    frames = []
    for pf in range(1, 7):
        for viewport in contract["performanceViewports"]:
            stem = f"PF-{pf:02d}-{viewport}"
            for directory, suffix in (("frames", ".jpg"), ("state", ".json"), ("browser", ".json")):
                path = bundle / directory / f"{stem}{suffix}"
                if not path.is_file():
                    raise ContractError(f"complete bundle missing {path.relative_to(bundle)}")
            frames.append(stem)
    promotion = bundle / contract["promotionTelemetry"]
    clip = bundle / contract["promotionClip"]
    if not clip.is_file() or clip.stat().st_size == 0:
        raise ContractError("complete bundle requires a non-empty input-only promotion clip")
    promotion_record = validate_promotion_telemetry(promotion)
    validate_pf_contracts(bundle)
    for name in contract["requiredContactSheets"]:
        path = bundle / "contact-sheets" / name
        if not path.is_file() or path.stat().st_size == 0:
            raise ContractError(f"complete bundle missing contact sheet: {name}")
    before_mapping_path = bundle / "contact-sheets" / "before-mapping.json"
    if not before_mapping_path.is_file():
        raise ContractError("complete bundle missing machine-readable before proxy mapping")
    before_mapping = json.loads(before_mapping_path.read_text(encoding="utf-8"))
    review_contract = json.loads(
        (TEST / "visual-review-contract.json").read_text(encoding="utf-8")
    )
    if before_mapping != review_contract["beforeMapping"]:
        raise ContractError("before proxy mapping/claim boundary does not match review contract")
    if sha256_file(bundle / "contact-sheets" / "reference.jpg") != sha256_file(TEST / "reference" / "ashmaw-contact-sheet.jpg"):
        raise ContractError("frozen reference contact sheet is not the fingerprint-bound ASHMAW source")
    performance = validate_performance_bundle(bundle)
    validate_resource_manifest(bundle, manifest)
    return {"frames": frames, "promotion": promotion_record, "performanceViewports": sorted(performance)}


def evidence_manifest(bundle: Path) -> dict[str, object]:
    path = bundle / "manifest.json"
    if not path.is_file():
        raise ContractError(f"evidence manifest missing: {path}")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    fingerprints = manifest.get("fingerprints")
    if not isinstance(fingerprints, dict) or set(fingerprints) != FINGERPRINT_KEYS:
        raise ContractError("manifest must contain exactly four named fingerprints")
    if fingerprints != four_fingerprints():
        raise ContractError("evidence fingerprints do not match current inputs")
    return manifest


def write_evidence_manifest(bundle: Path) -> dict[str, object]:
    resources = [
        {"path": path.relative_to(bundle).as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)}
        for path in iter_bundle_files(bundle, include_reviews=False)
        if path.name != "manifest.json"
    ]
    manifest = {"schemaVersion": 1, "fingerprints": four_fingerprints(), "resources": resources}
    path = bundle / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def freeze_bundle(bundle: Path) -> dict[str, object]:
    complete = validate_complete_bundle(bundle)
    sample_count = sum(validate_telemetry(path) for path in sorted((bundle / "performance").glob("raw-*.jsonl")))
    files = file_manifest(bundle, include_reviews=False)
    record = {
        "schemaVersion": 1, "phase": "evidence-frozen", "fingerprints": four_fingerprints(),
        "files": files, "frozenBundleHash": manifest_hash(files), "performanceSamples": sample_count,
        "completeBundle": complete,
        "frozenAtUnixMs": int(time.time() * 1000),
    }
    freeze_path = bundle / "freeze.json"
    freeze_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    for path in [*iter_bundle_files(bundle, include_reviews=False), freeze_path]:
        path.chmod(0o444)
    return record


def hash_attested_review_forms(bundle: Path) -> list[Path]:
    contract = json.loads((TEST / "visual-review-contract.json").read_text(encoding="utf-8"))
    forms = sorted((bundle / "reviews").glob("*.json"))
    if len(forms) < 2:
        raise ContractError("at least two independent hash-attested review forms are required")
    reviewer_ids = set()
    for path in forms:
        form = json.loads(path.read_text(encoding="utf-8"))
        for field in contract["attestedFormRequired"]:
            if field not in form or form[field] in (None, "", [], {}):
                raise ContractError(f"unsigned or incomplete review form {path}: missing {field}")
        if form["reviewerId"] in reviewer_ids:
            raise ContractError("reviewer identities must be unique")
        reviewer_ids.add(form["reviewerId"])
        independence = form["independence"]
        if not isinstance(independence, dict) or independence.get("status") != "INDEPENDENT" or independence.get("conflicts") != []:
            raise ContractError(f"reviewer independence is not attested: {path}")
        blind_order = form["blindOrder"]
        if not isinstance(blind_order, list) or len(blind_order) != 3 or len(set(blind_order)) != 3:
            raise ContractError(f"review form lacks a three-way blind order: {path}")
        if form["beforeMapping"] != contract["beforeMapping"]:
            raise ContractError(f"review form before proxy mapping/claim boundary mismatch: {path}")
        if form["reviewProcess"] != contract["reviewProcess"]:
            raise ContractError(f"review process claim boundary mismatch: {path}")
        if form["rubricFingerprint"] != four_fingerprints()["rubricFingerprint"]:
            raise ContractError(f"review rubric fingerprint mismatch: {path}")
        if form["referenceFingerprint"] != four_fingerprints()["referenceFingerprint"]:
            raise ContractError(f"review reference fingerprint mismatch: {path}")
        calibration = form["calibration"]
        required_calibration = set(contract["calibration"]["requiredFields"])
        if not isinstance(calibration, dict) or not required_calibration <= calibration.keys():
            raise ContractError(f"reviewer calibration evidence is incomplete: {path}")
        if (
            calibration.get("status") != "PASS"
            or calibration.get("anchorDisposition") != "FAIL"
            or not isinstance(calibration.get("identifiedBlocker"), str)
            or not calibration["identifiedBlocker"].strip()
            or calibration.get("rubricFingerprint") != form["rubricFingerprint"]
            or calibration.get("referenceFingerprint") != form["referenceFingerprint"]
        ):
            raise ContractError(f"reviewer calibration did not pass: {path}")
        signature = form["signature"]
        if not isinstance(signature, dict) or set(contract["signatureRequired"]) - signature.keys():
            raise ContractError(f"review hash attestation is incomplete: {path}")
        if signature["type"] != contract["signatureType"]:
            raise ContractError(f"review hash attestation type mismatch: {path}")
        if signature["signedBy"] != form["reviewerId"] or not isinstance(signature["signedAt"], str) or not signature["signedAt"]:
            raise ContractError(f"review hash attestation identity/time mismatch: {path}")
        payload = {key: value for key, value in form.items() if key != "signature"}
        if signature["payloadSha256"] != sha256_bytes(canonical_json(payload).encode()):
            raise ContractError(f"review hash attestation payload mismatch: {path}")
    return forms


def review_scores(bundle: Path) -> list[dict[str, object]]:
    contract = json.loads((TEST / "visual-review-contract.json").read_text(encoding="utf-8"))
    dimensions = contract["dimensions"]
    active_pf = contract["activePf"]
    frame_pass = contract["framePass"]
    forms = []
    for path in hash_attested_review_forms(bundle):
        form = json.loads(path.read_text(encoding="utf-8"))
        scores = form.get("scores")
        if not isinstance(scores, dict) or not set(active_pf) <= scores.keys():
            raise ContractError(f"review form lacks every active PF score: {path}")
        for pf in active_pf:
            row = scores[pf]
            before = row.get("before")
            candidate = row.get("candidate")
            if set(before or {}) != set(dimensions) or set(candidate or {}) != set(dimensions):
                raise ContractError(f"review score dimensions are incomplete: {path}:{pf}")
            before_values = list(before.values())
            candidate_values = list(candidate.values())
            if any(not isinstance(value, int) or value < 0 or value > 3 for value in before_values):
                raise ContractError(f"before score is outside 0..3: {path}:{pf}")
            if any(not isinstance(value, int) or value < 0 or value > 3 for value in candidate_values):
                raise ContractError(f"candidate score is outside 0..3: {path}:{pf}")
            if sum(candidate_values) < frame_pass["minimumTotal"] or min(candidate_values) < frame_pass["minimumDimension"]:
                raise ContractError(f"candidate PF does not pass the frozen rubric: {path}:{pf}")
            if row.get("blockers", 0) or row.get("majors", 0):
                raise ContractError(f"candidate PF has blocker/major findings: {path}:{pf}")
        if scores.get("PF-06", {}).get("continuity") != "PASS":
            raise ContractError(f"PF-06 continuity did not pass: {path}")
        if form.get("disposition", {}).get("tier") not in {"same", "one-gap"}:
            raise ContractError(f"reference tier is not promotion-eligible: {path}")
        forms.append(form)
    return forms


def assert_quality_delta(bundle: Path) -> dict[str, object]:
    contract = json.loads((TEST / "visual-review-contract.json").read_text(encoding="utf-8"))
    dimensions = contract["dimensions"]
    active_pf = contract["activePf"]
    delta_contract = contract["qualityDelta"]
    results = []
    for form in review_scores(bundle):
        deltas = {
            pf: {
                dimension: form["scores"][pf]["candidate"][dimension] - form["scores"][pf]["before"][dimension]
                for dimension in dimensions
            }
            for pf in active_pf
        }
        medians = {
            dimension: statistics.median(deltas[pf][dimension] for pf in active_pf)
            for dimension in dimensions
        }
        improved = sum(value >= delta_contract["minimumMedianDelta"] for value in medians.values())
        if improved < delta_contract["minimumImprovedDimensions"]:
            raise ContractError(f"reviewer {form['reviewerId']} improves only {improved} dimensions")
        for pf, row in deltas.items():
            if sum(row.values()) < delta_contract["minimumNetDeltaPerPf"]:
                raise ContractError(f"reviewer {form['reviewerId']} reports a net regression at {pf}")
            if min(row.values()) < delta_contract["minimumCellDelta"]:
                raise ContractError(f"reviewer {form['reviewerId']} reports a two-level cell regression at {pf}")
        results.append({"reviewerId": form["reviewerId"], "medianDeltaByDimension": medians, "improvedDimensions": improved})
    if len(results) < delta_contract["requiredIndependentPassingReviewers"]:
        raise ContractError("too few independently passing reviewers")
    return {"status": "PASS", "reviewers": results}


def freeze_reviews(bundle: Path) -> dict[str, object]:
    freeze = json.loads((bundle / "freeze.json").read_text(encoding="utf-8"))
    current = file_manifest(bundle, include_reviews=False)
    if manifest_hash(current) != freeze["frozenBundleHash"]:
        raise ContractError("evidence changed after freeze")
    forms = hash_attested_review_forms(bundle)
    review_files = [{"path": p.relative_to(bundle).as_posix(), "bytes": p.stat().st_size, "sha256": sha256_file(p)} for p in forms]
    review_record = {
        "schemaVersion": 1, "phase": "reviews-frozen", "files": review_files,
        "frozenReviewHash": manifest_hash(review_files), "frozenAtUnixMs": int(time.time() * 1000),
    }
    path = bundle / "reviews-freeze.json"
    path.write_text(json.dumps(review_record, indent=2) + "\n", encoding="utf-8")
    for form in forms:
        form.chmod(0o444)
    path.chmod(0o444)
    return review_record


def audit_frozen_bundle(bundle: Path) -> dict[str, object]:
    freeze = json.loads((bundle / "freeze.json").read_text(encoding="utf-8"))
    current_fingerprints = four_fingerprints()
    if freeze.get("fingerprints") != current_fingerprints:
        raise ContractError("frozen evidence fingerprints do not match current source/method/rubric/reference inputs")
    validate_complete_bundle(bundle)
    evidence_files = file_manifest(bundle, include_reviews=False)
    if manifest_hash(evidence_files) != freeze["frozenBundleHash"]:
        raise ContractError("post-freeze evidence hash mismatch")
    reviews = json.loads((bundle / "reviews-freeze.json").read_text(encoding="utf-8"))
    review_files = [
        {"path": path.relative_to(bundle).as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)}
        for path in hash_attested_review_forms(bundle)
    ]
    if manifest_hash(review_files) != reviews["frozenReviewHash"]:
        raise ContractError("post-freeze review hash mismatch")
    writable = [p.relative_to(bundle).as_posix() for p in iter_bundle_files(bundle, include_reviews=True) if os.access(p, os.W_OK)]
    if writable:
        raise ContractError(f"frozen evidence must be read-only: {writable}")
    return {
        "status": "PASS",
        "fingerprints": current_fingerprints,
        "frozenBundleHash": freeze["frozenBundleHash"],
        "frozenReviewHash": reviews["frozenReviewHash"],
    }


def consume_authoritative_verify(bundle: Path) -> dict[str, object]:
    audit = audit_frozen_bundle(bundle)
    reviews = review_scores(bundle)
    quality_delta = assert_quality_delta(bundle)
    receipt = bundle.parent / f".{bundle.name}-authoritative-verify-receipt.json"
    if receipt.exists():
        post_audit = bundle.parent / f".{bundle.name}-post-verify-audit.json"
        try:
            existing = json.loads(receipt.read_text(encoding="utf-8"))
            existing_pid = existing.get("pid")
            process_alive = isinstance(existing_pid, int) and existing_pid > 0
            if process_alive:
                try:
                    os.kill(existing_pid, 0)
                except ProcessLookupError:
                    process_alive = False
                except PermissionError:
                    process_alive = True
        except (json.JSONDecodeError, OSError):
            process_alive = True
        if post_audit.exists() or process_alive:
            raise ContractError(f"authoritative verify already consumed for this frozen bundle: {receipt}")
        receipt.unlink()
    payload = {
        **audit,
        "ac18ReviewAudit": {"status": "PASS", "hashAttestedForms": len(reviews)},
        "ac20QualityDeltaAudit": quality_delta,
        "consumedAtUnixMs": int(time.time() * 1000),
        "pid": os.getpid(),
    }
    descriptor = os.open(receipt, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o444)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(payload, stream, indent=2)
        stream.write("\n")
    return payload


def abort_authoritative_verify(bundle: Path) -> dict[str, object]:
    """Release a failed run's one-shot receipt without publishing a PASS audit."""
    receipt = bundle.parent / f".{bundle.name}-authoritative-verify-receipt.json"
    post_audit = bundle.parent / f".{bundle.name}-post-verify-audit.json"
    receipt.unlink(missing_ok=True)
    post_audit.unlink(missing_ok=True)
    return {"status": "ABORTED", "postVerifyAuditPublished": False}


def post_verify_audit(
    bundle: Path,
    verification_path: Path | None = None,
    log_path: Path | None = None,
) -> dict[str, object]:
    verification_path = verification_path or PROJECT / "qa" / "verification.json"
    log_path = log_path or PROJECT / "qa" / "evidence" / "verify.log"
    verification = json.loads(verification_path.read_text(encoding="utf-8"))
    verify = verification.get("verify")
    if not isinstance(verify, dict):
        raise ContractError("authoritative verification record is missing verify metadata")
    suites = verify.get("suites")
    succeeded = (
        verify.get("exitCode") == 0
        and isinstance(suites, list)
        and bool(suites)
        and all(
            isinstance(suite, dict)
            and suite.get("executed") is True
            and suite.get("passed") is True
            for suite in suites
        )
    )
    if not succeeded:
        abort_authoritative_verify(bundle)
        raise ContractError("failed/incomplete authoritative verification cannot publish a PASS post-audit")
    if not log_path.is_file() or verify.get("logSha256") != sha256_file(log_path):
        raise ContractError("authoritative verification log hash mismatch")
    source_fingerprint = verification.get("sourceFingerprint")
    if source_fingerprint != four_fingerprints()["appFingerprint"]:
        raise ContractError("authoritative verification source fingerprint mismatch")
    audit = audit_frozen_bundle(bundle)
    if audit["fingerprints"]["appFingerprint"] != source_fingerprint:
        raise ContractError("frozen evidence app fingerprint does not match authoritative verification source")
    reviews = review_scores(bundle)
    quality_delta = assert_quality_delta(bundle)
    receipt = bundle.parent / f".{bundle.name}-authoritative-verify-receipt.json"
    if not receipt.is_file():
        raise ContractError("authoritative verify receipt is missing")
    record = {
        **audit,
        "ac18ReviewAudit": {"status": "PASS", "hashAttestedForms": len(reviews)},
        "ac20QualityDeltaAudit": quality_delta,
        "receiptSha256": sha256_file(receipt),
        "sourceFingerprint": source_fingerprint,
        "verificationSha256": sha256_file(verification_path),
        "verificationLogSha256": sha256_file(log_path),
        "auditedAtUnixMs": int(time.time() * 1000),
    }
    path = bundle.parent / f".{bundle.name}-post-verify-audit.json"
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return record


def delivery_budget(metric: str) -> dict[str, object]:
    dist = APP / "dist"
    if not dist.is_dir():
        result = subprocess.run(["npm", "run", "build"], cwd=APP)
        if result.returncode:
            raise ContractError("production build failed")
    raw = gzip_total = 0
    for path in dist.rglob("*"):
        if path.is_file():
            data = path.read_bytes()
            raw += len(data)
            gzip_total += len(gzip.compress(data, compresslevel=9))
    assert_delivery_budget(metric, raw_bytes=raw, gzip_bytes=gzip_total)
    if metric == "tti-errors":
        run_script("test/qa_s7.py")
        return {"status": "PASS", "loading": load_report("s7")["loading"]}
    return {"status": "PASS", "rawBytes": raw, "gzipBytes": gzip_total}


def profile_equivalence() -> dict[str, object]:
    from playwright.sync_api import sync_playwright
    server, base_url = start_server()
    records: dict[str, object] = {}
    try:
        with sync_playwright() as playwright:
            launch: dict[str, object] = {"headless": True}
            chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            if chrome.exists():
                launch["executable_path"] = str(chrome)
            browser = playwright.chromium.launch(**launch)
            for profile in TELEMETRY_CONTRACT["profileEquivalence"]["profiles"]:
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                page.goto(f"{base_url}/?qa=profile-equivalence-{profile}", wait_until="networkidle")
                page.wait_for_function("window.__projectPlateau?.ready === true")
                page.get_by_role("button", name="Settings").click()
                page.locator("#visual-quality").select_option(profile)
                page.locator("#settings-panel .panel-close").click()
                page.get_by_role("button", name="Enter the basin").click()
                page.wait_for_function("window.__projectPlateau.snapshot().mode === 'order'", timeout=15000)
                state = page.evaluate("window.__projectPlateau.snapshot()")
                player = dict(state["player"])
                for field in ("elapsedSeconds", "remainingLight"):
                    player.pop(field, None)
                records[profile] = {
                    "player": player,
                    "mode": state["mode"],
                    "runActive": state["runActive"],
                }
                if state["presentationSettings"]["quality"] != profile:
                    raise ContractError(f"quality profile did not apply: {profile}")
                page.close()
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
    values = list(records.values())
    if any(value != values[0] for value in values[1:]):
        raise ContractError("low/balanced/high gameplay snapshots differ")
    return {"status": "PASS", "profiles": list(records), "gameplaySnapshotSha256": sha256_bytes(canonical_json(values[0]).encode())}


def run_scenario(args: argparse.Namespace) -> dict[str, object]:
    evidence = Path(args.evidence).resolve() if args.evidence else DEFAULT_EVIDENCE
    if args.scenario in {"strong-route", "deterministic-paths", "route-clock"}:
        report = current_s8_report()
        return assert_route_clock(report) if args.scenario == "route-clock" else {"status": "PASS", "suite": "browser:complete-run"}
    if args.scenario == "performance-heaviest":
        return run_performance(args)
    if args.scenario == "promotion-trace":
        output = Path(args.output).resolve() if args.output else evidence
        subprocess.run(
            [sys.executable, str(TEST / "qa_promotion.py"), "promotion", str(output), args.viewport],
            cwd=APP, check=True,
        )
        write_evidence_manifest(output)
        validate_promotion_telemetry(output / "paths" / "promotion-telemetry.jsonl")
        return validate_promotion_capture(output)
    if args.scenario == "pf-contracts":
        subprocess.run(
            [sys.executable, str(TEST / "qa_promotion.py"), "viewport", str(evidence), "1280x720"],
            cwd=APP, check=True,
        )
        write_evidence_manifest(evidence)
        return validate_pf_contracts(evidence)
    if args.scenario == "camera-continuity":
        run_script("test/qa_controller.py")
        return validate_promotion_capture(evidence)
    if args.scenario == "delivery-budget":
        return delivery_budget(args.metric)
    if args.scenario == "spatial-anchors":
        return anchor_audit()
    if args.scenario == "profile-equivalence":
        return profile_equivalence()
    if args.scenario == "accessibility-layout-motion":
        run_script("test/qa_s7.py")
        return {"status": "PASS", "suite": "browser:checkpoint-history"}
    if args.scenario == "accessibility-colour":
        current_s8_report()
        run_script("test/qa_s10.py")
        return {"status": "PASS", "suites": ["browser:complete-run", "browser:current-visual"]}
    if args.scenario in {"evidence-integrity", "evidence-schema"}:
        return {"status": "PASS", **validate_complete_bundle(evidence)}
    if args.scenario in {"review-bundle-audit", "quality-delta-audit"}:
        audit = audit_frozen_bundle(evidence)
        forms = review_scores(evidence)
        if args.scenario == "quality-delta-audit":
            return {**audit, **assert_quality_delta(evidence)}
        return {**audit, "hashAttestedForms": len(forms)}
    if args.scenario == "investment-stop-loss":
        viewports = validate_performance_bundle(evidence)
        passed = assert_investment_stop_loss(viewports)
        return {"status": "PASS" if passed else "STOP_INVESTMENT", "releaseFailure": False, "viewports": viewports}
    # The remaining selectors are evidence consumers. They fail closed until
    # the later capture lane has produced a frozen candidate.
    evidence_manifest(evidence)
    return audit_frozen_bundle(evidence)


def selector_listing(coverage: Path) -> dict[str, object]:
    registrations = load_coverage(coverage)
    selectors: dict[str, dict[str, object]] = {}
    for row in registrations:
        selector = str(row["selector"])
        selectors.setdefault(selector, {
            "selector": selector, "registrations": [], "authoritativeSuites": set(),
            "assertionSources": set(), "fixtureOrCheckpointSources": set(),
        })
        selectors[selector]["registrations"].append(row["acId"])
        selectors[selector]["authoritativeSuites"].add(row["authoritativeSuite"])
        selectors[selector]["assertionSources"].add(row["assertionSource"])
        selectors[selector]["fixtureOrCheckpointSources"].add(row["fixtureOrCheckpointSource"])
    return {
        "schemaVersion": 1,
        "selectors": [
            {
                **value,
                "registrations": sorted(value["registrations"]),
                "authoritativeSuites": sorted(value["authoritativeSuites"]),
                "assertionSources": sorted(value["assertionSources"]),
                "fixtureOrCheckpointSources": sorted(value["fixtureOrCheckpointSources"]),
            }
            for _, value in sorted(selectors.items())
        ],
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--list", action="store_true")
    result.add_argument("--audit-coverage")
    result.add_argument("--scenario")
    result.add_argument("--viewport", default="1440x900", choices=("1440x900", "1280x720"))
    result.add_argument("--profile", default="balanced", choices=("low", "balanced", "high"))
    result.add_argument("--metric", choices=("raw-bytes", "initial-gzip", "tti-errors"))
    result.add_argument("--network-mbps", type=int, default=25)
    result.add_argument("--warmup-frames", type=int, default=300)
    result.add_argument("--repeats", type=int, default=3)
    result.add_argument("--frames", type=int, default=600)
    result.add_argument("--evidence")
    result.add_argument("--output")
    result.add_argument("--freeze-bundle")
    result.add_argument("--freeze-reviews")
    result.add_argument("--verify-frozen-bundle")
    result.add_argument("--consume-authoritative-verify")
    result.add_argument("--post-verify-audit")
    result.add_argument("--verification")
    result.add_argument("--verification-log")
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        coverage = Path(args.audit_coverage).resolve() if args.audit_coverage else TEST / "targeted-coverage.json"
        if args.list:
            output = selector_listing(coverage)
        elif args.audit_coverage:
            output = audit_coverage(coverage)
        elif args.freeze_bundle:
            output = freeze_bundle(Path(args.freeze_bundle).resolve())
        elif args.freeze_reviews:
            output = freeze_reviews(Path(args.freeze_reviews).resolve())
        elif args.verify_frozen_bundle:
            output = audit_frozen_bundle(Path(args.verify_frozen_bundle).resolve())
        elif args.consume_authoritative_verify:
            output = consume_authoritative_verify(Path(args.consume_authoritative_verify).resolve())
        elif args.post_verify_audit:
            output = post_verify_audit(
                Path(args.post_verify_audit).resolve(),
                Path(args.verification).resolve() if args.verification else None,
                Path(args.verification_log).resolve() if args.verification_log else None,
            )
        elif args.scenario:
            output = run_scenario(args)
        else:
            raise ContractError("choose --list, --audit-coverage, a scenario, or a freeze/audit operation")
        print(json.dumps(output, indent=2, default=lambda value: sorted(value) if isinstance(value, set) else str(value)))
        return 0
    except (ContractError, AssertionFailure, FileNotFoundError, json.JSONDecodeError, KeyError, AssertionError) as error:
        print(json.dumps({"status": "NOT_RUN" if isinstance(error, FileNotFoundError) else "FAIL", "error": str(error)}, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
