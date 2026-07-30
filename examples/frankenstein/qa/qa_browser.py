#!/usr/bin/env python3
"""Frankenstein slice — real-browser QA.

Boot -> title -> cold open -> nights -> restart, driven twice (mouse-primary and
keyboard-only; BUILD_BRIEF requires every action to be reachable by keyboard alone),
then a third, full campaign: seed 42, played through nights 1-7 to the walk, the
door, an ending, the epilogue, afterRun and restart (GAME_DESIGN §10, §12) — and a
fourth pass that repeats that campaign mouse-only: title buttons, click-to-move,
click-to-exit, hotspot walk-and-act (queuedAction), the lesson window, the knock,
the door exchanges, the epilogue cards and the restart button, all by click/hold
with no keyboard input anywhere (QA_REPORT F6) — and a fifth pass that gets the
creature seen on night 1 by standing still in the yard until Agatha's retiring
patrol finds him, asserting the seen phase renders console-clean and the SEEN
failure card lands after the 2 s hold (QA_REPORT F7) — and two more passes that
play the remaining designed endings for real (GAME_DESIGN §12): the sixth takes
from the milk-house once a night for five nights until the family leaves for
want (sim.js STORE_GONE_DAWNS), the seventh draws the store to 1 by dawn 6 so
the walk is the errand (day 9, two slots), knocks, and never answers — the
door's real-time clock runs out at index 0, which is the silence ending
(sim.js:666). Both assert the ending id, a console-clean staging segment,
afterRun, and a restart to a valid initial state. An eighth pass plays the
night-1 seen failure to its epilogue card at textScale 1 and 1.5, frames
both, and asserts the text-size setting delivers on the card itself
(TASK F10). A ninth pass gates the audio layer (ART_DIRECTION §13): all
twelve §13.5 keys authored (pending lists empty), each rendered offline and
asserted non-silent against sound=false and missing-key silence, the beds
asserted sounding with levels that follow real state (the hearth louder at a
Firing >= 2 dawn than at a small one; the wind's yard layer up in the last two
night-minutes), the position stage asserted on the band it filters (F14:
energy above 900 Hz, not full-band RMS), the options switch reaching the
layer, the AudioContext running after the first real input — and a driven
five-night campaign in which every gated key fires from real state: the latch
exactly once (never at a dawn without a first carry behind it), the bird at
every dawn read and in no other phase, the taper from a real unease-2 night,
the four footfalls on their four real surfaces, and the guitar at its seeded
hour.

Evidence lands in the workspace at qa/evidence/browser/ as JPEG. The qa contract treats
paths outside the workspace (and system temp dirs) as no evidence at all.

Usage:  python3 qa/qa_browser.py
Env:    BASE_URL, QA_SLOW=1 (normal speed; timing evidence is only valid here),
        QA_SHOTS to override the evidence directory,
        QA_ONLY=want,silence to run named passes only (for iteration — a subset
        writes -partial evidence, is stamped partial, and is never a release gate).
"""
from __future__ import annotations

import json
import math
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

EXAMPLE_ROOT = Path(__file__).resolve().parent.parent
APP = EXAMPLE_ROOT / "build" / "app"
EVIDENCE = EXAMPLE_ROOT / "qa" / "evidence"
# QA_ONLY runs a subset of passes, for iterating on one of them without paying for
# the whole suite (a normal-speed full run is tens of minutes). A subset can never
# be the release gate, so it is fenced off from the canonical evidence: its frames
# and summary land beside them under a -partial name, the run is stamped
# `partial: true`, and the closing line says so. Only a full run writes
# qa/evidence/browser/ and automated.json.
ONLY = {name.strip() for name in os.environ.get("QA_ONLY", "").split(",") if name.strip()}
_DEFAULT_SHOTS = EVIDENCE / ("browser-partial" if ONLY else "browser")
SHOTS = Path(os.environ.get("QA_SHOTS", _DEFAULT_SHOTS))
SUMMARY = EVIDENCE / ("automated-partial.json" if ONLY else "automated.json")
PORT = 5199
BASE = os.environ.get("BASE_URL", f"http://127.0.0.1:{PORT}")
SLOW = bool(os.environ.get("QA_SLOW"))
URL = f"{BASE}/?seed=42" + ("" if SLOW else "&fast=1")
# Real-second timeouts scale with the speed: at normal speed a night-minute is
# 8 s and the creature walks 36 px/s; at ?fast=1 they are 1 s and 290 px/s.
SPEED = 8 if SLOW else 1
# Arrival tolerance for click-to-move polling. Shared so the assertion that a
# click really moved the creature is derived from the same number the poll uses.
ARRIVE_R = 14

# Canvas game with a 60 Hz rAF loop, so frame-time distribution is the right measure.
# PRODUCT_BRIEF names a >=30 FPS floor => 33.4 ms; absolute stall gate 200 ms.
FRAME_FLOOR_MS = 33.4
STALL_MS = 200.0

passed = failed = 0
errors: list[str] = []
net_errors: list[str] = []
request_hosts: set[str] = set()
perf: dict[str, dict] = {}
shot_n = 0

LONGTASK_INIT = """
window.__longtasks = [];
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__longtasks.push({ms: Math.round(e.duration), at: Math.round(e.startTime)});
  }).observe({ entryTypes: ['longtask'] });
} catch (err) { window.__longtasks = null; }
"""


def section(name: str) -> None:
    print(f"\n== {name} ==")


def check(cond: bool, name: str) -> bool:
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")
    return bool(cond)


def shot(page, name: str, clip: dict | None = None) -> str:
    global shot_n
    shot_n += 1
    fn = f"{shot_n:02d}_{name}.jpg"
    page.screenshot(path=str(SHOTS / fn), type="jpeg", quality=80,
                    **({"clip": clip} if clip else {}))
    return fn


def ensure_server():
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", PORT)); s.close()
        return None
    except OSError:
        pass
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            s = socket.socket(); s.connect(("127.0.0.1", PORT)); s.close()
            return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("local server failed to start")


def st(page):
    return page.evaluate("(() => { const s = window.__game.state; return JSON.parse(JSON.stringify(s)); })()")


def phase(page) -> str:
    return page.evaluate("window.__game.phase")


def frame_stats(page, label: str, n: int = 90) -> dict:
    """Frame-interval distribution at the current (heaviest) screen.

    All samples kept, first frame included — that is where a cold-path hitch lands.
    A mean is not a conclusion.
    """
    samples = page.evaluate(
        """async (n) => new Promise((res) => {
            const s = []; let last = performance.now();
            const tick = (now) => { s.push(now - last); last = now;
              if (s.length >= n) res(s); else requestAnimationFrame(tick); };
            requestAnimationFrame(tick);
        })""", n)
    o = sorted(samples)
    pick = lambda q: o[min(len(o) - 1, int(len(o) * q))]
    d = {"p50": round(pick(.50), 2), "p95": round(pick(.95), 2), "max": round(o[-1], 2), "n": len(o)}
    perf[label] = d
    print(f"  frame {label}: p50 {d['p50']} / p95 {d['p95']} / worst {d['max']} ms")
    return d


def wait_phase(page, want, timeout_ms=20000) -> bool:
    """Drive the title/scene phases forward until `want` is reached."""
    step = 200
    for _ in range(timeout_ms // step):
        if phase(page) == want:
            return True
        page.wait_for_timeout(step)
    return phase(page) == want


def hold(page, key: str, ms: int) -> None:
    """Movement and the context action are HOLD, not press: main.js reads
    keys.has(...) every tick, so a press that releases in the same frame does nothing."""
    page.keyboard.down(key)
    page.wait_for_timeout(ms)
    page.keyboard.up(key)


def hold_mouse(page, x: int, y: int, ms: int) -> None:
    page.mouse.move(x, y)
    page.mouse.down()
    page.wait_for_timeout(ms)
    page.mouse.up()


def run_once(page, mode: str) -> dict:
    """One full pass. mode='keyboard' uses keys only; mode='mouse' clicks the canvas."""
    out = {}
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(400)

    section(f"[{mode}] boot and title")
    check(phase(page) == "title", "boots into the title phase")
    # the title reveals over ~1.6 s (beat = phaseTick/16, 6 beats)
    page.wait_for_timeout(6000)
    beat = page.evaluate("window.__game.state.phaseTick")
    check(beat >= 270, f"title fully revealed (phaseTick {beat} >= 270)")
    out["title_shot"] = shot(page, f"{mode}_title")
    frame_stats(page, f"{mode}_title")

    if mode == "mouse":
        # The three title verbs are click targets (drawTitle hit boxes, low-centre).
        section("[mouse] title buttons: about and options plates")
        page.mouse.click(640, 756)   # third verb: about
        page.wait_for_timeout(400)
        check(phase(page) == "about", "clicking the third title verb opens the about card")
        page.mouse.click(640, 400)   # anywhere: back (main.js step 'about')
        page.wait_for_timeout(400)
        check(phase(page) == "title", "clicking the about card returns to the title")
        # Coming back restores the revealed title (phaseTick = TITLE_REVEALED).
        page.wait_for_function("window.__game.state.phaseTick >= 280", timeout=10000)
        page.mouse.click(640, 722)   # second verb: options
        page.wait_for_timeout(400)
        check(phase(page) == "options", "clicking the second title verb opens the options plate")
        before = page.evaluate(
            "(JSON.parse(localStorage.getItem('hovel.options') || '{}').textScale) || 1")
        # The rows are real click targets now; their boxes come from the game
        # (they move with the text-size setting, so no hardcoded y).
        rows = page.evaluate("window.__game.optionRows")
        check(len(rows) == 6, f"the options plate exposes six row targets ({len(rows)})")
        page.mouse.click(rows[0]["x"] + rows[0]["w"] / 2, rows[0]["y"] + rows[0]["h"] / 2)   # text size
        page.wait_for_timeout(300)
        after = page.evaluate(
            "(JSON.parse(localStorage.getItem('hovel.options') || '{}').textScale) || 1")
        check(after != before, f"clicking an options row toggles it (textScale {before} -> {after})")
        # ...and the last row is the mouse-driven way back the plate never had.
        rows = page.evaluate("window.__game.optionRows")   # re-read: the paper moved
        page.mouse.click(rows[-1]["x"] + rows[-1]["w"] / 2, rows[-1]["y"] + rows[-1]["h"] / 2)
        page.wait_for_timeout(400)
        check(phase(page) == "title", "the options plate's back row returns to the title by mouse")
        page.evaluate("localStorage.removeItem('hovel.options')")

    section(f"[{mode}] enter the run")
    if mode == "keyboard":
        page.keyboard.press("Enter")
    else:
        out["title_button_shot"] = shot(page, "mouseclick_title_button")
        page.mouse.click(640, 688)          # first title verb sits low-centre
        page.wait_for_timeout(200)
        check(phase(page) == "coldOpen",
              "the first title verb is clickable (no keyboard fallback)")
    page.wait_for_timeout(600)
    check(phase(page) != "title", f"leaving the title works ({mode})")
    out["cold_open_shot"] = shot(page, f"{mode}_cold_open")

    # The cold open advances only while the action is HELD and wants 23 s of it.
    # ?fast=1 does not shorten it: coldTime counts real seconds, not night-minutes.
    section(f"[{mode}] cold open (23 s held)")
    t0 = time.time()
    if mode == "keyboard":
        page.keyboard.down(" ")
    else:
        page.mouse.move(640, 400); page.mouse.down()
    while phase(page) == "coldOpen" and time.time() - t0 < 40:
        page.wait_for_timeout(500)
    if mode == "keyboard":
        page.keyboard.up(" ")
    else:
        page.mouse.up()
    out["cold_open_seconds"] = round(time.time() - t0, 1)
    check(phase(page) == "night",
          f"cold open completes into the night ({out['cold_open_seconds']} s held, phase={phase(page)})")

    section(f"[{mode}] the nights")
    s0 = st(page)
    start_night = s0.get("night")
    # Movement and the context action are held, not tapped (see hold()).
    for i in range(24):
        if mode == "keyboard":
            hold(page, ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4], 420)
            hold(page, " ", 900)          # hold to watch / take the context action
        else:
            hold_mouse(page, 400 + (i % 5) * 90, 300 + (i % 3) * 70, 700)
        if i == 6:
            out["playing_shot"] = shot(page, f"{mode}_playing")
            frame_stats(page, f"{mode}_playing")
        cur = st(page)
        if cur.get("night") and start_night and cur["night"] > start_night:
            out["advanced_a_night"] = True
            break
    s1 = st(page)
    check(s1.get("tick", 0) > s0.get("tick", 0), "the simulation advances under input")
    changed = [k for k in ("night", "minute", "words", "firing", "store", "ownFood", "unease")
               if s0.get(k) != s1.get(k)]
    check(bool(changed), f"observable state changes: {changed or 'none'}")
    out["state_changed"] = changed
    out["night_reached"] = s1.get("night")

    section(f"[{mode}] restart")
    page.evaluate("window.__game.restart()")
    page.wait_for_timeout(500)
    s2 = st(page)
    check(phase(page) == "title", "restart returns to the title")
    check(s2.get("night") == s0.get("night") and s2.get("words") == s0.get("words"),
          f"restart restores a valid initial state (night {s2.get('night')}, words {s2.get('words')})")
    out["restart_shot"] = shot(page, f"{mode}_restart")
    return out


# ---------------------------------------------------------------- full campaign
#
# One genuinely played run to an ending (GAME_DESIGN §10 beats 1-5, §12, §15):
#   night 1-2  listen at the chink (words, and the trigger that fires once at
#              firing-0 dawns: unease 1, decays the next incident-free night)
#   night 3    listen, then after the retiring window carry the load to the door
#   night 4    the first lesson at minute 0, then the second carry
#   night 5-7  lesson at minute 0, listen out the rest
#   day 8      the long walk (Store 3 at dawn 6 -> 5 slots), knock inside the
#              15-30 s band, five exchanges (words >= 80 and carries >= 1), the
#              withheld hand, the moon hold, afterRun, restart.
# Nothing here pokes run state: minutes pass in real time, every action goes
# through the game's own input path (key/mouse events), and the cones, costs
# and gates all apply. The single concession is the lesson start: the engine
# accepts it only inside the first 0.03 night-minutes (availableAction), which
# is 1-2 ticks at any speed, so it is dispatched in-page, rAF-aligned, as an
# ordinary KeyboardEvent through the real keydown listener.

DESIGNED_ENDINGS = ("seen", "want", "silence", "door")  # GAME_DESIGN §12 "No dead end"

START_LESSON_JS = """
() => new Promise((res) => {
  const key = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
  };
  key();  // advance the dawn read
  let guard = 0;
  const pump = () => {
    const g = window.__game;
    const a = g.state.tonight && g.state.tonight.action;
    if (a && a.kind === 'lesson') { res('lesson'); return; }
    if (g.phase === 'night' && g.state.minute > 0.5) { res('missed'); return; }
    if (++guard > 600) { res('timeout'); return; }
    // One fresh edge per frame: the dawn read consumes the first of them; the
    // very next one lands on the first night tick (minute 1/mt <= 0.03), which
    // is the only moment the engine accepts a lesson start.
    key();
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
})
"""


class CampaignAbort(Exception):
    pass


def need(cond: bool, name: str) -> None:
    """PASS lines print as they land; a failure is reported once, by the
    run_campaign handler, together with the state snapshot."""
    if cond:
        check(True, name)
    else:
        raise CampaignAbort(name)


def press(page, key: str = "e", ms: int = 90) -> None:
    page.keyboard.down(key)
    page.wait_for_timeout(ms)
    page.keyboard.up(key)


def qa_state(page) -> dict:
    return page.evaluate("""(() => {
      const g = window.__game; const s = g.state;
      return { phase: g.phase, night: s.night, day: s.day,
        minute: Math.round(s.minute * 100) / 100, length: s.nightLength,
        words: s.words, firing: s.firing, store: s.store, unease: s.unease,
        x: Math.round(s.creature.x), y: Math.round(s.creature.y),
        carrying: s.creature.carrying, inHovel: s.creature.inHovel,
        ending: s.ending, seenBy: s.seenBy, seenCtx: s.seenContext, exchanges: s.exchangesReached,
        carries: s.carriesTotal, lessons: s.lessonsAttended, listens: s.listensCompleted,
        takes: s.takesTotal, zeroStoreRun: s.zeroStoreRun, familyGone: s.familyGone,
        slipped: s.walkSlipped, walk: s.walk,
        door: s.door && { index: s.door.index, exchangeTicks: s.door.exchangeTicks,
                          clockTicks: s.door.clockTicks, slots: s.door.slots },
        canSpeak: g.engine.doorCanSpeak(s),
        lessonDone: !!(s.tonight && s.tonight.lessonDone),
        listening: !!(s.tonight && s.tonight.listening),
        action: (s.tonight && s.tonight.action) ? s.tonight.action.kind : null,
        walkStage: s.walkScene ? s.walkScene.stage : null }; })()""")


def wait_cond(page, pred, timeout_s: float, poll_ms: int = 150):
    t0 = time.time()
    s = qa_state(page)
    while not pred(s):
        if time.time() - t0 > timeout_s:
            return None
        page.wait_for_timeout(poll_ms)
        s = qa_state(page)
    return s


def wait_dawn(page, timeout_s: float = 0) -> dict:
    """The night plays out to the dawn read; being seen aborts the campaign."""
    s = wait_cond(page, lambda s: s["phase"] in ("dawnRead", "seen"), timeout_s or 30 * SPEED)
    if s is None:
        raise CampaignAbort("night did not reach the dawn read")
    if s["phase"] == "seen":
        raise CampaignAbort(f"seen by {s['seenBy']} on night {s['night']}, minute {s['minute']}")
    return s


def drive_to(page, tx: int, ty: int, radius: int = 14, timeout_s: float = 0,
             phases=("night",)):
    """Keyboard click-to-move: poll the creature and hold arrows toward the point.
    The keyboard campaign drives with keys because BUILD_BRIEF requires the whole
    path to be reachable by keyboard alone; the mouse campaign below clicks."""
    timeout_s = timeout_s or 12 * SPEED
    # The per-axis dead zone has to stay inside the arrival ring or this
    # controller can park outside it forever: with a fixed 6 px zone and
    # radius 7, |dx| = |dy| = 6 is 8.49 px away — outside the ring and inside
    # both dead zones — so `want` comes out empty, no key is held, and the
    # creature stands still until the timeout. Deriving the zone from the radius
    # makes that structurally impossible, since dz * sqrt(2) < radius always.
    # Radii of 12 and up keep the old 6 px zone, so the passing legs are
    # unchanged.
    dz = max(1.5, min(6.0, radius / 2))
    held: set[str] = set()

    def release():
        for k in held:
            page.keyboard.up(k)
        held.clear()

    t0 = time.time()
    s = qa_state(page)
    while math.hypot(tx - s["x"], ty - s["y"]) > radius:
        if s["phase"] not in phases:
            release()
            return s
        if time.time() - t0 > timeout_s:
            release()
            return None
        want: set[str] = set()
        if tx - s["x"] > dz:
            want.add("ArrowRight")
        elif tx - s["x"] < -dz:
            want.add("ArrowLeft")
        if ty - s["y"] > dz:
            want.add("ArrowDown")
        elif ty - s["y"] < -dz:
            want.add("ArrowUp")
        for k in want - held:
            page.keyboard.down(k)
        for k in held - want:
            page.keyboard.up(k)
        held.clear()
        held.update(want)
        page.wait_for_timeout(70)
        s = qa_state(page)
    release()
    return s


# Keyboard routes around the obstacle rectangles (engine constants.js). The
# drive controller walks 45-degree diagonals until an axis enters its deadzone,
# which pins it against rectangle faces it meets mid-diagonal; these legs are
# axis-aligned or diagonal-safe, verified at both speeds in Node against the
# engine itself. The lanes follow the designed CARRY_ROUTE.
ROUTE_OUT = [(585, 258), (455, 330), (310, 458)]   # mouth -> below the outhouse
ROUTE_DOOR = [(450, 462), (748, 462), (748, 425), (700, 425)]  # outhouse -> door, south lane
ROUTE_HOME = [(748, 410), (748, 290), (684, 290), (630, 265)]  # door -> mouth, east lane
ROUTE_CROSS = [(684, 222), (748, 222), (748, 425), (700, 425)]  # the walk, daylight


def carry_load(page, out: dict, tag: str) -> None:
    """Outhouse -> door -> hovel mouth, inside the cone-free minutes. The caller
    has already stepped out; ends back inside with firing one higher."""
    f0 = qa_state(page)["firing"]
    for wx, wy in ROUTE_OUT:
        s = drive_to(page, wx, wy, 12)
        if s is None or s["phase"] != "night":
            raise CampaignAbort(f"{tag}: the walk to the outhouse failed (last={s})")
    press(page)  # take the load (instant context action, in reach of the outhouse)
    need(qa_state(page)["carrying"], f"[campaign] {tag}: the load is taken up")
    for wx, wy in ROUTE_DOOR:
        s = drive_to(page, wx, wy, 16)
        if s is None or s["phase"] != "night":
            raise CampaignAbort(f"{tag}: the carry to the door failed (last={s})")
    press(page)  # put it down at their door
    s = qa_state(page)
    need(not s["carrying"] and s["firing"] == f0 + 1,
         f"[campaign] {tag}: put down at their door (firing {f0} -> {s['firing']})")
    out[f"{tag}_shot"] = shot(page, f"campaign_{tag}")
    for wx, wy in ROUTE_HOME:
        s = drive_to(page, wx, wy, 12)
        if s is None or s["phase"] != "night":
            raise CampaignAbort(f"{tag}: the walk home failed (last={s})")
    press(page)  # slip back inside
    need(qa_state(page)["inHovel"], f"[campaign] {tag}: back inside ahead of the dawn window")


def start_lesson(page, night: int) -> None:
    r = page.evaluate(START_LESSON_JS)
    need(r == "lesson", f"night {night}: the lesson starts at minute 0 ({r})")


# ---------------------------------------------------------------- hovel plate
#
# TASK 5 ("刻在版上"): the cold slot, the tally plank and the journal bundle
# were single fillRect swatches over plate/hovel — flat stickers on an
# engraved ground. Pixel-level guard: sample each region on the canvas itself
# and assert it is not one colour. A same-size patch of bare straw next to
# each region is the control: the straw is part of the engraved plate, so it
# marks what "engraved" scores on the same metric — and a broken probe (all
# zeros, a covered canvas) fails the controls too, loudly.
#
# Floors: measured on the engraved build (2026-07-28, the night frame — the
# poorer case; the dawn frame scores higher): slot 754 unique / 525 luminance
# variance, plank 143 / 921, bundle 197 / 773; straw controls 2865/658,
# 3002/490, 893/637. A flat fillRect with a 1.5 px stroke scores ~3-6 unique
# colours and variance ~10. The floors sit ~3.5x below the worst engraved
# measurement and an order of magnitude above flat.
UNIQUE_FLOOR = 40
VAR_FLOOR = 150.0

HOVEL_PROBE_JS = """(() => {
  const c = document.getElementById('plate');
  const ctx = c.getContext('2d');
  const probe = (x, y, w, h) => {
    const d = ctx.getImageData(x, y, w, h).data;
    const colours = new Set();
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sum2 += l * l; n++;
    }
    const mean = sum / n;
    return { unique: colours.size, var: Math.round((sum2 / n - mean * mean) * 10) / 10 };
  };
  return {
    slot: probe(900, 480, 260, 90),        // the cold slot (TASK 5 coordinates)
    plank: probe(460, 560, 400, 110),      // the tally plank; FLOOR = 690
    bundle: probe(880, 600, 50, 40),       // the journal parcel
    straw_slot: probe(900, 590, 260, 90),  // controls: bare straw, same sizes
    straw_plank: probe(60, 565, 400, 110),
    straw_bundle: probe(1200, 600, 50, 40),
  };
})()"""


# ------------------------------------------------------- the holding plate
#
# QA_REPORT F15: §16.3 lists the whole holding plate as Canvas 2D work — "walls
# in section, three hatched ground types, trees in outline, the pool, the sty,
# the well, the woodpile, the path, the lane gate" — and none of it existed; the
# yard shipped as flat-filled rects and two polylines, the placeholder geometry
# the build started from. This gate makes a regression to that state loud.
#
# It is two-sided, which is the point. Engraved regions must clear a floor, so a
# return to flat fills (or a broken probe reading a blank canvas) fails. And two
# regions must stay *flat*, because §4.4 says so in as many words: the cottage
# interior "is not a ground type: it is flat plate tone with the walls in section
# and a ruled hearth square", and the open ground between the outhouse and the
# door is "the emptiest region on the plate, because it is where the player is
# exposed and where a cone must be read against nothing". Hatching either one is
# a defect, so the controls are asserted in the other direction and decorative
# filler cannot creep in.
#
# Floors measured on this build (seed 42, night 3, creature in the yard, zero
# live cones): cottage wall in section 49 colours / 2199.7 luminance variance,
# wood edge 418 / 1193.6, milk-house 136 / 3500.1, woodpile 157 / 3404, against
# controls of 1 / 0.0 (cottage interior) and 8 / 0.7 (open ground). The floors
# sit about 2x under the weakest engraved region and the ceilings about 10x over
# the busiest control, so the two can never be confused.
YARD_UNIQUE_FLOOR = 30
YARD_VAR_FLOOR = 600.0
YARD_FLAT_UNIQUE_CEIL = 14
YARD_FLAT_VAR_CEIL = 40.0

YARD_PROBE_JS = """(() => {
  const c = document.getElementById('plate');
  const ctx = c.getContext('2d');
  const probe = (x, y, w, h) => {
    const d = ctx.getImageData(x, y, w, h).data;
    const colours = new Set();
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sum2 += l * l; n++;
    }
    const mean = sum / n;
    return { unique: colours.size, var: Math.round((sum2 / n - mean * mean) * 10) / 10 };
  };
  return {
    cottage_wall: probe(550, 318, 14, 84),   // walls in section, hatched between the lines
    wood_edge: probe(100, 150, 130, 120),    // trees in outline, broken canopy
    milkhouse: probe(694, 236, 32, 30),      // actionable: contour + contact shadow
    woodpile: probe(452, 416, 56, 26),       // scenery: open outline, log ends in courses
    cottage_interior: probe(640, 320, 70, 70),  // control: flat plate tone by §4.4
    open_ground: probe(380, 378, 60, 34),       // control: the emptiest region by §4.4
    cones: window.__game.cones.length,
  };
})()"""


def yard_plate_checks(page, out: dict) -> None:
    """The creature is in the yard and no cone is live, so the plate under the
    probe is the ground layer itself — a live wedge over a control would raise
    its variance and the flatness assertions would be measuring the cone."""
    s = qa_state(page)
    need(not s["inHovel"], "[campaign] yard plate: the creature is outside for the probe")
    rep = page.evaluate(YARD_PROBE_JS)
    out["yard_probe"] = rep
    need(rep["cones"] == 0,
         f"[campaign] yard plate: no live cone over the probe ({rep['cones']} cones)")
    for region in ("cottage_wall", "wood_edge", "milkhouse", "woodpile"):
        r = rep[region]
        need(r["unique"] >= YARD_UNIQUE_FLOOR and r["var"] >= YARD_VAR_FLOOR,
             f"[campaign] yard {region} is engraved, not a flat fill "
             f"({r['unique']} colours >= {YARD_UNIQUE_FLOOR}, "
             f"luminance var {r['var']} >= {YARD_VAR_FLOOR})")
    for region in ("cottage_interior", "open_ground"):
        r = rep[region]
        need(r["unique"] <= YARD_FLAT_UNIQUE_CEIL and r["var"] <= YARD_FLAT_VAR_CEIL,
             f"[campaign] yard {region} stays flat as ART_DIRECTION §4.4 requires "
             f"({r['unique']} colours <= {YARD_FLAT_UNIQUE_CEIL}, "
             f"luminance var {r['var']} <= {YARD_FLAT_VAR_CEIL})")
    out["yard_shot"] = shot(page, "campaign_yard_plate")


def hovel_plate_checks(page, out: dict) -> None:
    """Night 7, after the lesson: words >= 62 (the campaign's own gates prove
    >= 80 by the walk, so >= 62 here is arithmetic), the creature is inside,
    and slot + plank + bundle are all on the straw in one frame."""
    s = qa_state(page)
    need(s["words"] >= 62,
         f"[campaign] night 7: words {s['words']} >= 62, the journal bundle is on the straw")
    rep = page.evaluate(HOVEL_PROBE_JS)
    out["hovel_probe"] = rep
    for region in ("slot", "plank", "bundle"):
        r, c = rep[region], rep[f"straw_{region}"]
        need(r["unique"] >= UNIQUE_FLOOR and r["var"] >= VAR_FLOOR,
             f"[campaign] hovel {region} is no flat swatch "
             f"({r['unique']} colours >= {UNIQUE_FLOOR}, luminance var {r['var']} >= {VAR_FLOOR}; "
             f"straw control {c['unique']} / {c['var']})")
    need(all(rep[f"straw_{r}"]["unique"] >= UNIQUE_FLOOR and rep[f"straw_{r}"]["var"] >= VAR_FLOOR
             for r in ("slot", "plank", "bundle")),
         "[campaign] the straw controls read as engraved plate (probe sanity)")
    out["hovel_shot"] = shot(page, "campaign_hovel_night")


# ---------------------------------------------------------------- the aperture
#
# TASK 6 ("撕裂的缝"): the aperture was the plate/room image drawn into a
# hard-cornered rect with a stroked rule — a rectangle, where ART_DIRECTION
# §7.1 calls for a ragged chink and §16.3 lists "the aperture mask" as Canvas
# 2D work. The room is now clipped to a det()-seeded sawtooth path with
# plankBreak/plankEnd edges over the seam. Pixel guard: along three edges of
# the aperture, find the first pixel per column/row that reads as the room —
# warm, i.e. r - b > 8 and luminance > 40; measured against the plate's
# blue-grey boards and the nightDeep break mass (which fail it) and the
# whitewash, floor boards and brown ink (which pass) — and assert the
# boundary is no straight line: the variance of its position must clear a
# floor a rectangle cannot reach (the pre-TASK-6 rect build scores 0.00 on
# these lanes — measured on the left lane; the bottom and right lanes are
# the same uniform floor and wall at the rect's own rim). The tally plank's
# own edges, straight by construction, are the control: a broken probe (all
# zeros, a covered canvas) fails there loudly.
#
# The lanes dodge the room plate's own dark features, because there the
# first-warm scan follows the room's content instead of the mask: the beamed
# ceiling (the top edge is excluded outright), the hearth's dark mouth and
# the fire glow (the left lane is pinned above the hearth top, the bottom
# lane right of where the glow can reach), and the boarded window's warm
# frame plus the plates on the board (the right lane stops above both).
#
# Floors: measured on the ragged build (2026-07-28, seed 42 night frame):
# bottom 3.32 px^2, left 1.43, right 15.87 (2.9 with two window-shadow rows
# set aside). Floors sit >=2.7x below those. The second number in each gate
# is the tooth envelope — the mask edge can never pass the plank teeth, so a
# warm pixel beyond it is a room pixel leaked onto the boards.
APERTURE_FLOOR_BOTTOM = 1.2
APERTURE_FLOOR_SIDE = 0.5
APERTURE_CONTROL_CEIL = 0.5

APERTURE_PROBE_JS = """(() => {
  const c = document.getElementById('plate');
  const ctx = c.getContext('2d');
  const AX = 160, AY = 150, AW = 430, AH = 330;   // drawHovel's aperture rect
  const img = ctx.getImageData(AX - 30, AY - 30, AW + 60, AH + 80).data;
  const W = AW + 60;
  const px = (x, y) => {
    const i = ((y - (AY - 30)) * W + (x - (AX - 30))) * 4;
    return [img[i], img[i + 1], img[i + 2]];
  };
  const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  const warm = (p) => p[0] - p[2] > 8 && lum(p) > 40;
  const variance = (xs) => {
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return Math.round(xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length * 100) / 100;
  };
  const scan = (hits) => ({ n: hits.length, var: variance(hits),
                            min: Math.min(...hits), max: Math.max(...hits) });
  // Bottom edge: columns right of the hearth glow. Scan DOWN from inside the
  // room and take the first pixel that stops reading as room — that is the
  // board tooth, i.e. the mask's boundary. The earlier version scanned up from
  // the straw and took the first warm pixel, which assumed the plate below the
  // aperture was dark. Since plate/hovel was regenerated to §7.1 the hearth
  // light legitimately spills onto that straw, so the upward scan latched onto
  // the plate's own glow at y = 500 in every column and read it as the room
  // leaking past the teeth. Measuring the boundary from inside is independent
  // of whatever the plate does underneath it.
  const bot = [];
  for (let x = 360; x <= AX + AW - 24; x += 3)
    for (let y = AY + AH - 70; y <= AY + AH + 20; y++)
      if (!warm(px(x, y))) { bot.push(y); break; }
  // left edge: rows above the hearth's dark mouth, scanning in from the boards
  const lef = [];
  for (let y = 204; y <= 258; y += 3)
    for (let x = AX - 20; x < AX + 70; x++)
      if (warm(px(x, y))) { lef.push(x); break; }
  // right edge: rows clear of the window frame and the plates, scanning in
  const rig = [];
  for (let y = 210; y <= 333; y += 3)
    for (let x = AX + AW + 20; x > AX + AW - 70; x--)
      if (warm(px(x, y))) { rig.push(x); break; }
  // Control: the prompt band's top edge at 0.88h = 704. It is opaque PAL.paper
  // laid straight across the frame, so a working probe must score ~0 variance
  // on it — that is what proves the variance figures above mean "torn" rather
  // than "noisy probe". The control used to be the tally plank's edges, keyed
  // on warm(), but the plank is #3a3020 and passes warm() itself; once
  // plate/hovel was regenerated the straw around it is lit and warm too, so
  // the scan measured straw texture instead of the plank. The band is keyed on
  // luminance instead and does not depend on the plate at all.
  const bd = ctx.getImageData(300, 680, 700, 60).data;
  const bdl = (x, y) => {
    const i = ((y - 680) * 700 + (x - 300)) * 4;
    return 0.299 * bd[i] + 0.587 * bd[i + 1] + 0.114 * bd[i + 2];
  };
  const bt = [];
  for (let x = 300; x < 1000; x += 3)
    for (let y = 682; y < 738; y++) if (bdl(x, y) > 180) { bt.push(y); break; }
  return { bottom: scan(bot), left: scan(lef), right: scan(rig),
           bandTop: scan(bt) };
})()"""


def aperture_checks(page, out: dict) -> None:
    """Night 7, same frame as the swatch guard: the room is lit (firing 2),
    the family is drawn, and the aperture's four broken board edges are on
    the plate. Three edges must read as torn lines and stay inside the tooth
    envelope; the plank control must stay straight."""
    ap = page.evaluate(APERTURE_PROBE_JS)
    out["aperture_probe"] = ap
    b, l, r = ap["bottom"], ap["left"], ap["right"]
    need(b["n"] >= 60 and b["var"] >= APERTURE_FLOOR_BOTTOM and b["max"] <= 466,
         f"[campaign] aperture bottom edge is a torn line, not a rule "
         f"(boundary variance {b['var']} px^2 >= {APERTURE_FLOOR_BOTTOM}, "
         f"deepest warm {b['max']} <= 466 over {b['n']} columns; a rectangle scores 0)")
    need(l["n"] >= 15 and l["var"] >= APERTURE_FLOOR_SIDE and l["min"] >= 172,
         f"[campaign] aperture left edge is a torn line, not a rule "
         f"(boundary variance {l['var']} px^2 >= {APERTURE_FLOOR_SIDE}, "
         f"shallowest warm {l['min']} >= 172 over {l['n']} rows; a rectangle scores 0)")
    need(r["n"] >= 15 and r["var"] >= APERTURE_FLOOR_SIDE and r["max"] <= 578,
         f"[campaign] aperture right edge is a torn line, not a rule "
         f"(boundary variance {r['var']} px^2 >= {APERTURE_FLOOR_SIDE}, "
         f"shallowest warm {r['max']} <= 578 over {r['n']} rows; a rectangle scores 0)")
    bt = ap["bandTop"]
    need(bt["n"] >= 200 and bt["var"] <= APERTURE_CONTROL_CEIL,
         f"[campaign] the prompt band's straight edge still reads straight "
         f"(control: {bt['var']} px^2 <= {APERTURE_CONTROL_CEIL} over {bt['n']} columns)")
    out["aperture_shot"] = shot(page, "campaign_hovel_aperture",
                                clip={"x": 120, "y": 108, "width": 530, "height": 424})


def run_campaign(page) -> dict:
    """The full path the docstring promises: played, on the fixed seed, to a
    designed ending, then restarted to a valid initial state."""
    out = {"plan": "listen n1-2; carry n3; lesson+carry n4; lesson n5-7; "
                   "walk day 8 (5 slots); five exchanges; epilogue; restart"}
    try:
        section("[campaign] boot, title, cold open")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(600)
        need(phase(page) == "title", "[campaign] boots into the title phase")
        page.keyboard.press("Enter")
        need(wait_cond(page, lambda s: s["phase"] == "coldOpen", 5),
             "[campaign] leaving the title works")
        page.keyboard.down(" ")
        t0 = time.time()
        while phase(page) == "coldOpen" and time.time() - t0 < 40:
            page.wait_for_timeout(500)
        page.keyboard.up(" ")
        s = qa_state(page)
        need(s["phase"] == "night" and s["night"] == 1,
             "[campaign] cold open completes into night 1")

        section("[campaign] nights 1-2: listening at the chink")
        press(page)  # start listening; blocks mint every 2 night-minutes
        s = wait_dawn(page)
        out["words_after_n1"] = s["words"]
        need(s["words"] >= 10, f"[campaign] night 1 banks words by listening ({s['words']})")
        press(page)  # let the day pass -> night 2
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 2, 5),
             "[campaign] night 2 begins")
        press(page)
        s = wait_dawn(page)
        out["words_after_n2"] = s["words"]

        section("[campaign] night 3: first carry after the retiring window")
        press(page)  # -> night 3
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 3, 5),
             "[campaign] night 3 begins")
        press(page)  # listen through minutes 0-5
        need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED),
             "[campaign] night 3: the retiring window closes")
        press(page)  # come away from the chink
        press(page, "x")  # lift the plank
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[campaign] night 3: steps out once the yard is empty")
        section("[campaign] holding plate: engraved, not flat fills (F15)")
        yard_plate_checks(page, out)
        carry_load(page, out, "n3_carry")
        out["hovel_f1_shot"] = shot(page, "campaign_hovel_firing1")  # the slot's pile: 1 course
        press(page)  # listen out the rest
        wait_dawn(page)

        section("[campaign] night 4: first lesson, second carry")
        start_lesson(page, 4)
        # M5's T-b frame (ART_DIRECTION §14): a word seen being minted, mid-rise
        # in its lane, while the lesson runs. Capture-only — the frame is the
        # evidence, judged in qa/evidence/signature-frames.md.
        t0 = time.time()
        while time.time() - t0 < 8 * SPEED:
            if page.evaluate("window.__game.minted.length") > 0:
                out["lesson_mint_shot"] = shot(page, "campaign_lesson_mint")
                break
            page.wait_for_timeout(100)
        need(wait_cond(page, lambda s: s["lessonDone"], 10 * SPEED),
             "[campaign] night 4: the first lesson completes (+20 words)")
        press(page, "x")
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[campaign] night 4: steps out after the lesson")
        carry_load(page, out, "n4_carry")
        out["hovel_f2_shot"] = shot(page, "campaign_hovel_firing2")  # the slot's pile: 2 courses
        press(page)
        s = wait_dawn(page)
        # Dawn 5 — the §14 read (M4): fire built high, Safie and Agatha at the
        # board, and the aperture's ragged edge in daylight.
        out["hovel_dawn_shot"] = shot(page, "campaign_hovel_dawn")

        section("[campaign] nights 5-7: the remaining lessons")
        for n in (5, 6, 7):
            start_lesson(page, n)
            need(wait_cond(page, lambda s: s["lessonDone"], 10 * SPEED),
                 f"[campaign] night {n}: the lesson completes")
            if n == 7:
                section("[campaign] hovel plate: nothing reads as a flat swatch (TASK 5)")
                hovel_plate_checks(page, out)
                section("[campaign] the aperture mask is irregular (TASK 6)")
                aperture_checks(page, out)
            press(page)  # listen out the rest
            s = wait_dawn(page)
        out["nights_completed"] = 7
        out["words_at_walk"] = s["words"]
        need(s["lessons"] == 4, f"[campaign] four lessons attended ({s['lessons']})")
        need(s["words"] >= 80,
             f"[campaign] words {s['words']} >= 80, the fifth exchange gate (GAME_DESIGN §7)")
        need(s["carries"] >= 1,
             f"[campaign] carries {s['carries']} >= 1, the exchange-5 lock (GAME_DESIGN §9)")
        need(s["night"] == 8,
             f"[campaign] seven full nights played before the walk (now at dawn 8, night counter {s['night']})")

        section("[campaign] day 8: the walk")
        press(page)  # let the day pass -> the walk
        s = wait_cond(page, lambda s: s["phase"] == "walk", 5)
        need(s and s["walk"] and s["walk"]["band"] == "long" and s["walk"]["slots"] == 5,
             f"[campaign] the long walk, five slots (walk={s and s['walk']})")
        need(wait_cond(page, lambda s: s["walkStage"] == "cross", 6),
             "[campaign] the three go out at the gate")
        out["walk_shot"] = shot(page, "campaign_walk")
        page.wait_for_timeout(17000)  # knocking inside 15 s costs a slot; past 30 s another
        for wx, wy in ROUTE_CROSS:
            s = drive_to(page, wx, wy, 16, phases=("walk",))
            if s is None or s["phase"] != "walk":
                raise CampaignAbort(f"the daylight crossing failed (last={s})")
        need(True, "[campaign] crosses the yard in daylight")
        press(page, "e", 120)
        s = wait_cond(page, lambda s: s["phase"] == "door", 5)
        need(s and s["door"] and s["door"]["slots"] == 5,
             f"[campaign] the knock keeps all five slots (slots={s and s['door'] and s['door']['slots']})")
        out["door_shot"] = shot(page, "campaign_door")

        section("[campaign] the door: five exchanges")
        t0 = time.time()
        while time.time() - t0 < 170:
            s = qa_state(page)
            if s["phase"] != "door":
                break
            if s["door"] and s["door"]["exchangeTicks"] <= 0 and s["canSpeak"]:
                press(page, "e", 60)
            page.wait_for_timeout(350)
        s = wait_cond(page, lambda s: s["phase"] == "aftermath", 10)
        need(s is not None, "[campaign] the door opens when the walk's clock runs out")
        need(s["exchanges"] == 5,
             f"[campaign] all five exchanges land (reached {s['exchanges']}, words {s['words']})")
        need(s["ending"] in DESIGNED_ENDINGS,
             f"[campaign] ending id is a designed one ({s['ending']}; §12: {DESIGNED_ENDINGS})")
        need(s["ending"] == "door", f"[campaign] the run ends at the door ({s['ending']})")
        out["ending"] = s["ending"]
        out["exchanges"] = s["exchanges"]

        section("[campaign] aftermath, epilogue, afterRun")
        model = page.evaluate("(() => { const g = window.__game; return g.engine.epilogueModel(g.state); })()")
        need(model["ending"] == "door" and model["exchange5"],
             f"[campaign] the epilogue model agrees (ending={model['ending']}, "
             f"exchange5={model['exchange5']}, storeAtFlight={model['storeAtFlight']}, beds={model['beds']})")
        out["epilogue_model"] = model
        page.keyboard.down("e")  # the withheld hand, then the moon hold
        done = None
        t0 = time.time()
        while time.time() - t0 < 60:
            ph = phase(page)
            estep = page.evaluate("window.__game.epilogueStep")
            if ph == "epilogue" and "epilogue_shot" not in out:
                page.wait_for_timeout(800)  # the lane card, the run's ending text
                out["epilogue_shot"] = shot(page, "campaign_epilogue")
            # M9's frames (ART_DIRECTION §14): the dark day, the held moonset,
            # the burn. Capture-only, judged in qa/evidence/signature-frames.md.
            if ph == "epilogue" and estep == 1 and "darkday_shot" not in out:
                out["darkday_shot"] = shot(page, "campaign_darkday")
            if ph == "epilogue" and estep == 2 and "moonset_shot" not in out:
                page.wait_for_timeout(1200)  # the arc visibly runs down
                out["moonset_shot"] = shot(page, "campaign_moonset")
            if ph == "epilogue" and estep == 3 and "fire_shot" not in out:
                page.wait_for_timeout(900)  # mid-burn
                out["fire_shot"] = shot(page, "campaign_fire")
            if ph == "afterRun":
                done = qa_state(page)
                break
            page.wait_for_timeout(250)
        page.keyboard.up("e")
        need(done is not None, "[campaign] the epilogue plays out to afterRun")
        need(done["ending"] == "door" and done["exchanges"] == 5,
             "[campaign] the ending is still recorded at afterRun")
        out["afterrun_shot"] = shot(page, "campaign_afterrun")

        section("[campaign] restart")
        page.keyboard.press("Enter")
        s = wait_cond(page, lambda s: s["phase"] == "title", 5)
        need(s and s["night"] == 1 and s["words"] == 0,
             f"[campaign] restart restores a valid initial state "
             f"(phase={s and s['phase']}, night {s and s['night']}, words {s and s['words']})")
        out["restart_shot"] = shot(page, "campaign_restart")
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[campaign] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "campaign_abort")
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- mouse campaign
#
# QA_REPORT F6: the same campaign as run_campaign, but every input is a mouse
# click or hold — no keyboard anywhere. Click-to-move goes through the game's
# own click path (main.js yardClick / scene.queuedAction): a click on a
# hotspot walks the creature there and acts on arrival, so the outhouse, the
# door pile, the hovel mouth and the cottage door are clicked directly at the
# ends of the same safe lanes the keyboard campaign drives.

START_LESSON_MOUSE_JS = """
() => new Promise((res) => {
  const canvas = document.getElementById('plate');
  const r = canvas.getBoundingClientRect();
  // (640, 400) on the plate: the chink, off the exit slot.
  const cx = r.left + r.width * (640 / 1280);
  const cy = r.top + r.height * (400 / 800);
  const click = () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };
  click();  // advance the dawn read
  let guard = 0;
  const pump = () => {
    const g = window.__game;
    const a = g.state.tonight && g.state.tonight.action;
    if (a && a.kind === 'lesson') { res('lesson'); return; }
    if (g.phase === 'night' && g.state.minute > 0.5) { res('missed'); return; }
    if (++guard > 600) { res('timeout'); return; }
    // One fresh click edge per frame — the same concession as the keyboard
    // pump: the engine accepts a lesson start only at minute <= 0.03, which
    // is 1-2 ticks at any speed.
    click();
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
})
"""


def click_arrive(page, x: int, y: int, phase_want: str = "night",
                 radius: int = ARRIVE_R, timeout_s: float = 0) -> dict:
    """Click a plain (non-hotspot) spot and poll until the creature gets there."""
    page.mouse.click(x, y)
    s = wait_cond(page, lambda s: s["phase"] != phase_want
                  or math.hypot(x - s["x"], y - s["y"]) <= radius,
                  timeout_s or 15 * SPEED, 100)
    need(s is not None and s["phase"] == phase_want
         and math.hypot(x - s["x"], y - s["y"]) <= radius,
         f"[mouse-campaign] click-to-move reaches ({x},{y}) (last={s})")
    return s


def mouse_carry(page, out: dict, tag: str) -> None:
    """The carry, clicked: waypoints move, the hotspots act on arrival
    (outhouse -> take the load, door -> put it down, mouth -> slip inside)."""
    f0 = qa_state(page)["firing"]
    x0, y0 = qa_state(page)["x"], qa_state(page)["y"]
    s = click_arrive(page, 585, 258)
    if "move_shot" not in out:  # first carry: evidence that click-to-move moves
        out["move_shot"] = shot(page, "mouseclick_yard_move")
        # Bound the travel by the geometry, not by a hand-picked number. The leg
        # is d0 long and click_arrive stops polling inside ARRIVE_R, so a real
        # walk covers at least d0 - ARRIVE_R; standing still covers 0. A fixed
        # bar cannot work here: the creature moves WALK_SPEED (290 px) per
        # *night-minute*, so it covers 290 px/s at ?fast=1 but only 36 px/s at
        # normal speed, and the 100 ms poll overshoots the arrival ring by ~29 px
        # accelerated against ~3.6 px at normal speed. The old `> 40` bar sat
        # above the guaranteed floor of 31.5 px, so it failed outright under
        # QA_SLOW and was a coin-flip at fast.
        d0 = math.hypot(585 - x0, 258 - y0)
        moved = math.hypot(s["x"] - x0, s["y"] - y0)
        need(moved >= d0 - ARRIVE_R - 2,
             f"[mouse-campaign] click-to-move actually moves the creature "
             f"(({x0},{y0}) -> ({s['x']},{s['y']}); moved {moved:.1f} px of the "
             f"{d0:.1f} px leg, floor {d0 - ARRIVE_R - 2:.1f})")
    click_arrive(page, 455, 330)
    page.mouse.click(310, 485)  # the outhouse: walk there and take the load on arrival
    s = wait_cond(page, lambda s: s["carrying"] or s["phase"] != "night", 15 * SPEED, 100)
    need(s and s["phase"] == "night" and s["carrying"],
         f"[mouse-campaign] {tag}: the outhouse click walks over and takes the load (last={s})")
    click_arrive(page, 450, 462)
    click_arrive(page, 748, 462)
    click_arrive(page, 748, 425)
    page.mouse.click(700, 425)  # their door: put the load down on arrival
    s = wait_cond(page, lambda s: not s["carrying"] or s["phase"] != "night", 15 * SPEED, 100)
    need(s and s["phase"] == "night" and not s["carrying"] and s["firing"] == f0 + 1,
         f"[mouse-campaign] {tag}: the door click puts the load down "
         f"(firing {f0} -> {s and s['firing']})")
    out[f"{tag}_shot"] = shot(page, f"mousecampaign_{tag}")
    click_arrive(page, 748, 410)
    click_arrive(page, 748, 290)
    click_arrive(page, 684, 290)
    page.mouse.click(630, 265)  # the hovel mouth: slip back inside on arrival
    s = wait_cond(page, lambda s: s["inHovel"] or s["phase"] != "night", 15 * SPEED, 100)
    need(s and s["inHovel"],
         f"[mouse-campaign] {tag}: the mouth click slips back inside (last={s})")


def run_mouse_campaign(page) -> dict:
    """The F6 done-criterion pass: the full campaign to an ending, mouse only.
    Mirrors run_campaign beat for beat; every input above is page.mouse or an
    in-page MouseEvent through the real canvas listener (the lesson pump)."""
    out = {"plan": "as [campaign], but no keyboard input anywhere; hotspots "
                   "carry the context actions (walk-and-act on arrival)"}
    try:
        section("[mouse-campaign] boot, title, cold open")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(600)
        need(phase(page) == "title", "[mouse-campaign] boots into the title phase")
        page.wait_for_timeout(6000)  # the verb hit boxes exist only at beat 6
        out["title_button_shot"] = shot(page, "mousecampaign_title_button")
        page.mouse.click(640, 688)   # the first verb: into the run
        need(wait_cond(page, lambda s: s["phase"] == "coldOpen", 5) is not None,
             "[mouse-campaign] clicking the first title verb enters the run")
        page.mouse.move(640, 400)
        page.mouse.down()
        t0 = time.time()
        while phase(page) == "coldOpen" and time.time() - t0 < 40:
            page.wait_for_timeout(500)
        page.mouse.up()
        s = qa_state(page)
        need(s["phase"] == "night" and s["night"] == 1,
             "[mouse-campaign] cold open completes into night 1 (held mouse)")

        section("[mouse-campaign] nights 1-2: listening, clicked at the chink")
        page.mouse.click(640, 400)
        need(wait_cond(page, lambda s: s["listening"], 5) is not None,
             "[mouse-campaign] night 1: a click at the chink starts listening")
        s = wait_dawn(page)
        out["words_after_n1"] = s["words"]
        need(s["words"] >= 10, f"[mouse-campaign] night 1 banks words by listening ({s['words']})")
        page.mouse.click(640, 400)   # let the day pass: dawn read advanced by click
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 2, 5),
             "[mouse-campaign] night 2 begins (dawn read advanced by click)")
        page.mouse.click(640, 400)
        s = wait_dawn(page)
        out["words_after_n2"] = s["words"]

        section("[mouse-campaign] night 3: first carry, clicked")
        page.mouse.click(640, 400)   # -> night 3
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 3, 5),
             "[mouse-campaign] night 3 begins")
        page.mouse.click(640, 400)   # listen through the retiring window
        need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED),
             "[mouse-campaign] night 3: the retiring window closes")
        page.mouse.click(1000, 600)  # the cold slot, lower right: lift the plank
        need(wait_cond(page, lambda s: not s["inHovel"], 5) is not None,
             "[mouse-campaign] night 3: clicking the cold slot steps out")
        mouse_carry(page, out, "n3_carry")
        page.mouse.click(640, 400)   # listen out the rest
        wait_dawn(page)

        section("[mouse-campaign] night 4: first lesson by click, second carry")
        r = page.evaluate(START_LESSON_MOUSE_JS)
        need(r == "lesson",
             f"[mouse-campaign] night 4: the lesson starts at minute 0 by click ({r})")
        need(wait_cond(page, lambda s: s["lessonDone"], 10 * SPEED),
             "[mouse-campaign] night 4: the first lesson completes (+20 words)")
        page.mouse.click(1000, 600)
        need(wait_cond(page, lambda s: not s["inHovel"], 5) is not None,
             "[mouse-campaign] night 4: steps out after the lesson")
        mouse_carry(page, out, "n4_carry")
        page.mouse.click(640, 400)
        wait_dawn(page)

        section("[mouse-campaign] nights 5-7: the remaining lessons by click")
        for n in (5, 6, 7):
            r = page.evaluate(START_LESSON_MOUSE_JS)
            need(r == "lesson",
                 f"[mouse-campaign] night {n}: the lesson starts at minute 0 by click ({r})")
            need(wait_cond(page, lambda s: s["lessonDone"], 10 * SPEED),
                 f"[mouse-campaign] night {n}: the lesson completes")
            page.mouse.click(640, 400)   # listen out the rest
            s = wait_dawn(page)
        out["nights_completed"] = 7
        out["words_at_walk"] = s["words"]
        need(s["lessons"] == 4, f"[mouse-campaign] four lessons attended ({s['lessons']})")
        need(s["words"] >= 80,
             f"[mouse-campaign] words {s['words']} >= 80, the fifth exchange gate (GAME_DESIGN §7)")
        need(s["carries"] >= 1,
             f"[mouse-campaign] carries {s['carries']} >= 1, the exchange-5 lock (GAME_DESIGN §9)")
        need(s["night"] == 8,
             f"[mouse-campaign] seven full nights played before the walk (night counter {s['night']})")

        section("[mouse-campaign] day 8: the walk, clicked")
        page.mouse.click(640, 400)   # let the day pass -> the walk
        s = wait_cond(page, lambda s: s["phase"] == "walk", 5)
        need(s and s["walk"] and s["walk"]["band"] == "long" and s["walk"]["slots"] == 5,
             f"[mouse-campaign] the long walk, five slots (walk={s and s['walk']})")
        need(wait_cond(page, lambda s: s["walkStage"] == "cross", 6),
             "[mouse-campaign] the three go out at the gate")
        out["walk_shot"] = shot(page, "mousecampaign_walk")
        page.wait_for_timeout(17000)  # knocking inside 15 s costs a slot; past 30 s another
        click_arrive(page, 684, 222, "walk", 16)
        click_arrive(page, 748, 222, "walk", 16)
        click_arrive(page, 748, 425, "walk", 16)
        page.mouse.click(700, 425)   # the door: walk up and knock on arrival
        s = wait_cond(page, lambda s: s["phase"] == "door", 15 * SPEED, 100)
        need(s and s["door"] and s["door"]["slots"] == 5,
             f"[mouse-campaign] clicking the door walks up and knocks, keeping all five slots "
             f"(slots={s and s['door'] and s['door']['slots']})")
        out["door_shot"] = shot(page, "mousecampaign_door")

        section("[mouse-campaign] the door: five exchanges, clicked")
        t0 = time.time()
        while time.time() - t0 < 170:
            s = qa_state(page)
            if s["phase"] != "door":
                break
            if s["door"] and s["door"]["exchangeTicks"] <= 0 and s["canSpeak"]:
                page.mouse.click(640, 400)
                page.wait_for_timeout(60)
            page.wait_for_timeout(350)
        s = wait_cond(page, lambda s: s["phase"] == "aftermath", 10)
        need(s is not None, "[mouse-campaign] the door opens when the walk's clock runs out")
        need(s["exchanges"] == 5,
             f"[mouse-campaign] all five exchanges land by click "
             f"(reached {s['exchanges']}, words {s['words']})")
        need(s["ending"] in DESIGNED_ENDINGS,
             f"[mouse-campaign] ending id is a designed one ({s['ending']}; §12: {DESIGNED_ENDINGS})")
        need(s["ending"] == "door", f"[mouse-campaign] the run ends at the door ({s['ending']})")
        out["ending"] = s["ending"]
        out["exchanges"] = s["exchanges"]

        section("[mouse-campaign] aftermath, epilogue, afterRun")
        page.mouse.move(640, 400)
        page.mouse.down()            # the withheld hand
        page.wait_for_timeout(1500)
        page.mouse.up()
        need(wait_cond(page, lambda s: s["phase"] == "epilogue", 15) is not None,
             "[mouse-campaign] the withheld hand holds (mouse.down) into the epilogue")
        step0 = page.evaluate("window.__game.epilogueStep")
        page.mouse.click(640, 400)   # a card advance well ahead of its minTicks timer
        page.wait_for_timeout(700)
        step1 = page.evaluate("window.__game.epilogueStep")
        need(step1 == step0 + 1,
             f"[mouse-campaign] a click advances an epilogue card (step {step0} -> {step1})")
        out["epilogue_shot"] = shot(page, "mousecampaign_epilogue")
        page.mouse.click(640, 400)   # the next card too; the moon hold ignores clicks
        page.wait_for_timeout(700)
        page.mouse.down()            # the moon hold; fire and closing run on their timers
        done = None
        t0 = time.time()
        while time.time() - t0 < 60:
            if phase(page) == "afterRun":
                done = qa_state(page)
                break
            page.wait_for_timeout(400)
        page.mouse.up()
        need(done is not None, "[mouse-campaign] the epilogue plays out to afterRun")
        need(done["ending"] == "door" and done["exchanges"] == 5,
             "[mouse-campaign] the ending is still recorded at afterRun")
        out["afterrun_shot"] = shot(page, "mousecampaign_afterrun")

        section("[mouse-campaign] restart, clicked")
        page.mouse.click(640, 493)   # the restart button on the after-run card
        s = wait_cond(page, lambda s: s["phase"] == "title", 5)
        need(s and s["night"] == 1 and s["words"] == 0,
             f"[mouse-campaign] clicking restart restores a valid initial state "
             f"(phase={s and s['phase']}, night {s and s['night']}, words {s and s['words']})")
        out["restart_shot"] = shot(page, "mousecampaign_restart")
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[mouse-campaign] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "mousecampaign_abort")
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- seen ending
#
# QA_REPORT F7: the seen ending, reached by real play on the fixed seed — no
# state injection. Night 1, lift the plank and stand still in the yard: Agatha's
# retiring patrol finds the creature at minute ~= 1.38 (a designed risk). The
# pass exists to prove renderSeen runs console-clean end to end — the frozen
# wedges, the shadow under the seer, and the failure card after the 2 s hold.
# F7's symptom was exactly a console flood from this phase, so the segment gets
# its own zero-new-errors assertion on top of the run-wide console gate.

def run_seen(page) -> dict:
    out = {"plan": "night 1: step out of the mouth, stand still; Agatha's "
                   "retiring patrol sees the creature at minute ~= 1.38"}
    try:
        section("[seen] boot, title, cold open")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(600)
        need(phase(page) == "title", "[seen] boots into the title phase")
        page.keyboard.press("Enter")
        need(wait_cond(page, lambda s: s["phase"] == "coldOpen", 5) is not None,
             "[seen] leaving the title works")
        page.keyboard.down(" ")
        t0 = time.time()
        while phase(page) == "coldOpen" and time.time() - t0 < 40:
            page.wait_for_timeout(500)
        page.keyboard.up(" ")
        s = qa_state(page)
        need(s["phase"] == "night" and s["night"] == 1,
             "[seen] cold open completes into night 1")

        section("[seen] night 1: out of the mouth, standing still")
        err0 = len(errors)
        press(page, "x")  # lift the plank; then no input at all
        s = wait_cond(page, lambda s: s["phase"] == "seen", 30 * SPEED)
        need(s is not None, "[seen] Agatha's retiring patrol finds the creature")
        need(s["ending"] == "seen" and s["seenBy"] == "agatha" and s["seenCtx"] == "night",
             f"[seen] the night sighting is recorded (ending={s['ending']}, "
             f"seenBy={s['seenBy']}, context={s['seenCtx']}, minute {s['minute']})")
        need(s["minute"] < 5,
             f"[seen] seen inside the retiring window (minute {s['minute']} < 5)")
        cones = page.evaluate("window.__game.cones.map(c => c.owner)")
        need(s["seenBy"] in cones,
             f"[seen] the seer's cone is still live in the freeze (cones={cones})")
        out["freeze_shot"] = shot(page, "seen_freeze")

        section("[seen] the failure card after the 2 s hold")
        try:
            page.wait_for_function("window.__game.epilogueStep >= 1", timeout=10000)
            held = True
        except Exception:
            held = False
        need(held, "[seen] the 2 s hold elapses into the failure card")
        page.wait_for_timeout(300)  # let the card draw for a few frames
        out["card_shot"] = shot(page, "seen_card")
        need(len(errors) == err0,
             f"[seen] console clean through the seen phase ({len(errors) - err0} new errors)")
        press(page)
        s = wait_cond(page, lambda s: s["phase"] == "epilogue", 5)
        need(s is not None and s["ending"] == "seen",
             "[seen] any key moves on to the epilogue, the ending still recorded")
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[seen] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "seen_abort")
        except Exception:
            pass
    return out


# ---------------------------------------------------- the milk-house take leg
#
# Shared by the want and silence passes: wait out the retiring window inside
# (Agatha's circuit reaches the milk-house at minute ~= 2.2), step out, walk
# the 60 px to the milk-house, one take (0.44 night-minutes), walk back, slip
# in. Minutes 5.2 -> dawnStart carry no cones at firing 0, unease <= 1, so the
# leg is cone-free; the drive target is the milk-house's west face itself, so
# the obstacle pin lands the creature on the target instead of overshooting it.

def take_once(page, tag: str, takes_want: int) -> None:
    need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED) is not None,
         f"[{tag}] the retiring window closes")
    press(page, "x")
    need(wait_cond(page, lambda s: not s["inHovel"], 10 * SPEED),
         f"[{tag}] steps out once the yard is empty")
    # Walk and act by clicking the hotspot, not by driving the arrows to a stand
    # point. The take's reach is 30 px around MILK_HOUSE (710,252) and the
    # milk-house obstacle is pushed out by the creature's 8 px radius to
    # x 688-732 / y 230-272, so the ground a taker may actually stand on is a
    # crescent about 8 px wide. No fixed arrival radius hits it at both speeds:
    # at ?fast=1 the creature covers ~20 px per 70 ms poll and overshoots such a
    # ring, and at normal speed it creeps east to exactly x=688 — the inflated
    # face — where push-out pins it, `want` becomes {ArrowUp} forever and the
    # night expires with the creature never leaving (688,264). That was F16.
    # The engine's own queuedAction snaps the walk to the hotspot and fires the
    # action on arrival (main.js yardClick / maybeQueuedAction), so arrival is
    # the engine's business at either speed — the same mechanism the mouse
    # campaign already proves at normal speed.
    page.mouse.click(710, 252)   # MILK_HOUSE, hotspot r 30
    s = wait_cond(page, lambda s: s["takes"] == takes_want or s["phase"] != "night",
                  20 * SPEED)
    need(s and s["phase"] == "night" and s["takes"] == takes_want,
         f"[{tag}] the milk-house take lands (takesTotal={s and s['takes']}, last={s})")
    page.mouse.click(630, 265)   # HOVEL_MOUTH, hotspot r 24: walk home and slip in
    need(wait_cond(page, lambda s: s["inHovel"], 20 * SPEED),
         f"[{tag}] back inside ahead of the dawn window")


def play_epilogue(page, tag: str) -> dict | None:
    """The epilogue to afterRun by real input: a fresh key edge advances each
    timed card well ahead of its minTicks; the moon set (step 2 in both the
    want and the lane variants) is a 5 s hold that ignores edges, so the key
    is held down until the step passes. Returns the afterRun state or None."""
    done = None
    holding = False
    t0 = time.time()
    while time.time() - t0 < 45:
        s = qa_state(page)
        if s["phase"] == "afterRun":
            done = s
            break
        if s["phase"] != "epilogue":
            page.wait_for_timeout(200)
            continue
        step = page.evaluate("window.__game.epilogueStep")
        if step == 2:
            if not holding:
                page.keyboard.down("e")
                holding = True
        else:
            if holding:
                page.keyboard.up("e")
                holding = False
            press(page, "e", 60)
        page.wait_for_timeout(250)
    if holding:
        page.keyboard.up("e")
    return done


def cold_open_to_night1(page, tag: str) -> None:
    """The shared entry every campaign pass uses: title -> Enter -> the 23 s
    held cold open -> night 1."""
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(600)
    need(phase(page) == "title", f"[{tag}] boots into the title phase")
    page.keyboard.press("Enter")
    need(wait_cond(page, lambda s: s["phase"] == "coldOpen", 5) is not None,
         f"[{tag}] leaving the title works")
    page.keyboard.down(" ")
    t0 = time.time()
    while phase(page) == "coldOpen" and time.time() - t0 < 40:
        page.wait_for_timeout(500)
    page.keyboard.up(" ")
    s = qa_state(page)
    need(s["phase"] == "night" and s["night"] == 1,
         f"[{tag}] cold open completes into night 1")


# ---------------------------------------------------------------- want ending
#
# GAME_DESIGN §12 "want": three consecutive dawns at Store 0 and the family
# leaves (sim.js:149-150, 166-171). Doing nothing never gets there — after the
# thaw the store pins at 2 — so the pass takes from the milk-house once a
# night for five nights: store 4, 2, 0, 0, 0, familyGone at dawn 6, and the
# dawn read advances straight into the epilogue (no aftermath on this path).
# The want staging (the gone card, the want closing lines, main.js:342/616)
# had never executed, so the segment from the last dawn read to afterRun gets
# its own zero-new-errors assertion, as run_seen does for F7.

def run_want(page) -> dict:
    out = {"plan": "one milk-house take per night, nights 1-5: store 4,2,0,0,0; "
                   "zeroStoreRun 3 at dawn 6 -> the family is gone (want)"}
    try:
        section("[want] boot, title, cold open")
        cold_open_to_night1(page, "want")

        section("[want] nights 1-5: one take a night")
        store_want = {1: 4, 2: 2, 3: 0, 4: 0, 5: 0}
        for n in (1, 2, 3, 4, 5):
            take_once(page, "want", n)
            s = wait_dawn(page)
            need(s["store"] == store_want[n] and s["takes"] == n,
                 f"[want] night {n}: the take drains the store on schedule "
                 f"(store {s['store']} == {store_want[n]}, takesTotal {s['takes']})")
            if n < 5:
                press(page)  # let the day pass -> the next night
                need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == n + 1, 5),
                     f"[want] night {n + 1} begins")

        section("[want] dawn 6: the family is gone")
        out["nights_completed"] = 5
        need(s["zeroStoreRun"] >= 3 and s["familyGone"],
             f"[want] three consecutive dawns at store 0 "
             f"(zeroStoreRun {s['zeroStoreRun']}, familyGone {s['familyGone']})")
        err0 = len(errors)
        press(page)  # advance the read -> epilogue (advanceFromDawn, sim.js:167)
        s = wait_cond(page, lambda s: s["phase"] == "epilogue", 5)
        need(s is not None, "[want] the dawn read advances into the epilogue")
        need(s["ending"] in DESIGNED_ENDINGS,
             f"[want] ending id is a designed one ({s['ending']}; §12: {DESIGNED_ENDINGS})")
        need(s["ending"] == "want", f"[want] the run ends for want ({s['ending']})")
        out["ending"] = s["ending"]
        page.wait_for_timeout(400)  # let the gone card draw for a few frames
        out["gone_shot"] = shot(page, "want_gone_card")
        model = page.evaluate("(() => { const g = window.__game; return g.engine.epilogueModel(g.state); })()")
        need(model["ending"] == "want" and model["nothingPutBy"],
             f"[want] the epilogue model agrees (ending={model['ending']}, "
             f"nothingPutBy={model['nothingPutBy']}, storeAtFlight={model['storeAtFlight']})")
        out["epilogue_model"] = model

        done = play_epilogue(page, "want")
        need(done is not None, "[want] the epilogue plays out to afterRun")
        need(done["ending"] == "want",
             "[want] the ending is still recorded at afterRun")
        out["afterrun_shot"] = shot(page, "want_afterrun")
        need(len(errors) == err0,
             f"[want] console clean through the want staging ({len(errors) - err0} new errors)")

        section("[want] restart")
        page.keyboard.press("Enter")
        s = wait_cond(page, lambda s: s["phase"] == "title", 5)
        need(s and s["night"] == 1 and s["words"] == 0 and s["store"] == 6 and not s["ending"],
             f"[want] restart restores a valid initial state "
             f"(phase={s and s['phase']}, night {s and s['night']}, words {s and s['words']}, "
             f"store {s and s['store']})")
        out["restart_shot"] = shot(page, "want_restart")
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[want] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "want_abort")
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- silence ending
#
# GAME_DESIGN §12 "silence": the door's clock is real time — 30 s a slot, not
# accelerated by ?fast=1 — and it ends on whatever is in progress; index 0 is
# silence (sim.js:664-666). The cheap walk is the errand: store <= 1 at dawn 6
# selects it (day 9, two slots). One milk-house take on night 1 draws the
# store curve 4,3,2,1,1,... — never 0, so the family stays — and nights 2-8
# are simply waited out inside. Words stay 0, so the knock costs one slot
# (WALK_NOTICE_WORDS): one slot, a 30 s clock, and no answer at all. The door
# scene running its clock out at index 0 (the sitSilence subtitle) had never
# executed, so the segment from the knock to afterRun gets its own
# zero-new-errors assertion, as run_seen does for F7.

def run_silence(page) -> dict:
    out = {"plan": "take n1 (store 1 at dawn 6 -> the errand walk, day 9, two "
                   "slots); wait out n2-8 inside; knock in the 15-30 s band "
                   "(words 0 -> one slot); never answer: the 30 s clock runs "
                   "out at index 0"}
    try:
        section("[silence] boot, title, cold open")
        cold_open_to_night1(page, "silence")

        section("[silence] night 1: one take; nights 2-8 waited out inside")
        take_once(page, "silence", 1)
        s = wait_dawn(page)
        need(s["store"] == 4 and s["takes"] == 1,
             f"[silence] night 1: the take lands (store {s['store']} == 4, takesTotal {s['takes']})")
        for n in (2, 3, 4, 5, 6, 7, 8):
            press(page)  # let the day pass -> the next night
            need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == n, 5),
                 f"[silence] night {n} begins")
            s = wait_dawn(page)  # no input at all: the creature simply hides
            if n == 5:
                need(s["store"] == 1 and s["walk"] and s["walk"]["band"] == "errand"
                     and s["walk"]["day"] == 9 and s["walk"]["slots"] == 2,
                     f"[silence] store 1 at dawn 6 selects the errand walk "
                     f"(store {s['store']}, walk={s['walk']})")
                need(not s["familyGone"] and s["zeroStoreRun"] == 0,
                     f"[silence] the store never pins at 0, the family stays "
                     f"(zeroStoreRun {s['zeroStoreRun']}, familyGone {s['familyGone']})")

        section("[silence] day 9: the errand walk")
        out["nights_completed"] = 8
        press(page)  # let the day pass -> the walk
        s = wait_cond(page, lambda s: s["phase"] == "walk", 5)
        need(s and s["walk"] and s["walk"]["band"] == "errand" and s["walk"]["slots"] == 2,
             f"[silence] the errand walk, two slots (walk={s and s['walk']})")
        need(wait_cond(page, lambda s: s["walkStage"] == "cross", 6),
             "[silence] the three go out at the gate")
        page.wait_for_timeout(17000)  # knocking inside 15 s costs a slot; past 30 s another
        for wx, wy in ROUTE_CROSS:
            s = drive_to(page, wx, wy, 16, phases=("walk",))
            if s is None or s["phase"] != "walk":
                raise CampaignAbort(f"the daylight crossing failed (last={s})")
        err0 = len(errors)
        press(page, "e", 120)  # the knock — the last input this pass ever sends
        s = wait_cond(page, lambda s: s["phase"] == "door", 5)
        need(s and s["door"] and s["door"]["slots"] == 1,
             f"[silence] the knock with no words costs a slot (slots="
             f"{s and s['door'] and s['door']['slots']}, words {s and s['words']})")

        section("[silence] the door: no answer, the clock runs out")
        page.wait_for_timeout(2500)  # a few seconds into the clock for the frame
        out["door_shot"] = shot(page, "silence_door")
        s = wait_cond(page, lambda s: s["phase"] == "aftermath", 40)
        need(s is not None, "[silence] the door opens when the clock runs out with no answer")
        need(s["ending"] in DESIGNED_ENDINGS,
             f"[silence] ending id is a designed one ({s['ending']}; §12: {DESIGNED_ENDINGS})")
        need(s["ending"] == "silence" and s["exchanges"] == 0,
             f"[silence] the run ends in silence at index 0 "
             f"(ending={s['ending']}, exchangesReached {s['exchanges']})")
        out["ending"] = s["ending"]
        out["exchanges"] = s["exchanges"]

        section("[silence] aftermath, epilogue, afterRun")
        model = page.evaluate("(() => { const g = window.__game; return g.engine.epilogueModel(g.state); })()")
        need(model["ending"] == "silence" and model["exchanges"] == 0,
             f"[silence] the epilogue model agrees (ending={model['ending']}, "
             f"exchanges={model['exchanges']}, storeAtFlight={model['storeAtFlight']})")
        out["epilogue_model"] = model
        page.keyboard.down("e")  # the withheld hand
        page.wait_for_timeout(1200)
        page.keyboard.up("e")
        need(wait_cond(page, lambda s: s["phase"] == "epilogue", 5) is not None,
             "[silence] the withheld hand holds into the epilogue")
        done = play_epilogue(page, "silence")
        need(done is not None, "[silence] the epilogue plays out to afterRun")
        need(done["ending"] == "silence" and done["exchanges"] == 0,
             "[silence] the ending is still recorded at afterRun")
        out["afterrun_shot"] = shot(page, "silence_afterrun")
        need(len(errors) == err0,
             f"[silence] console clean through the silence staging ({len(errors) - err0} new errors)")

        section("[silence] restart")
        page.keyboard.press("Enter")
        s = wait_cond(page, lambda s: s["phase"] == "title", 5)
        need(s and s["night"] == 1 and s["words"] == 0 and s["store"] == 6 and not s["ending"],
             f"[silence] restart restores a valid initial state "
             f"(phase={s and s['phase']}, night {s and s['night']}, words {s and s['words']}, "
             f"store {s and s['store']})")
        out["restart_shot"] = shot(page, "silence_restart")
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[silence] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "silence_abort")
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- card layout
#
# QA_REPORT F8: card text must stay on the paper. drawCard now lays out
# through layoutCard (render.js) — a pure measure, no drawing — which the
# harness drives through window.__game. Every string in STRINGS is tried as
# a card body line and as the display line, plus every composite card
# main.js can build (the options panel at each focus row, the about and SEEN
# cards, all epilogue sets, the closing triplets, the end card), with and
# without a foot button, at every reachable textScale. Each wrapped line
# must measure inside the paper's inner width and the block must clear the
# paper's foot and the button zone — so a future long string fails here
# instead of silently spilling ink onto the nightDeep ground.
#
# TASK F10 extends the gate from geometry to §9's typography: every wrapped
# line also holds at most 62 characters (the measure asserted in characters,
# not just pixels), the body size never crosses §9's 13 px floor, leading
# holds at 1.5 at every ladder rung, every line stands left-aligned at the
# paper's text edge, and the text-size setting delivers at least its own
# ratio on every card (the shrink ladder may no longer eat it).

def run_card_layout(page) -> dict:
    out = {}
    section("card layout: no glyph off the paper (F8), §9 typography (F10)")
    rep = page.evaluate("""(() => {
      const g = window.__game;
      const S = g.STRINGS;
      const all = [];
      (function walk(o) {
        if (!o) return;
        if (typeof o === 'string') { all.push(o); return; }
        if (typeof o !== 'object') return;
        for (const v of Object.values(o)) walk(v);
      })(S);
      const cards = [];
      for (const s of all) { cards.push(['SEEN', s]); cards.push([s]); }
      const O = S.options;
      const rows = [                       // the longest variant of every row
        `${O.textSize}: ${O.textSizeValues[2]}`, `${O.ink}: ${O.inkValues[1]}`,
        `${O.sound}: ${O.onOff[0]}`, `${O.murmur}: ${O.onOff[0]}`,
        `${O.motion}: ${O.onOff[0]}`, O.back];
      for (let f = 0; f < rows.length; f++)
        cards.push([O.title, ...rows.map((r, i) => (i === f ? `— ${r} —` : r))]);
      cards.push([...S.about]);
      for (const fl of [S.failure.seenAgatha, S.failure.seenFelix,
                        S.failure.seenFirstLight, S.failure.seenGarden])
        cards.push([S.failure.header, fl]);
      cards.push([S.epilogue.gone.line1, S.epilogue.gone.line2]);
      cards.push([S.epilogue.darkDay]);
      cards.push([...S.epilogue.lane]);                       // the F8 frame
      cards.push([...S.epilogue.lane, S.epilogue.laneSatUp, S.epilogue.laneAnswer]);
      cards.push([...S.epilogue.lane, S.epilogue.laneSatUp, S.epilogue.laneAnswerProduce]);
      cards.push([...S.epilogue.lane, S.epilogue.laneAnswer]);
      const C = S.epilogue.closing;
      for (const t of [[C.labourTrue, C.theft, C.journal], [C.labourTrue, C.fewWords, C.noJournal],
                       [C.labourFalse, C.theft, C.noJournal], [C.labourFalse, C.fewWords, C.journal],
                       [C.labourTrue, C.journal], [C.fed, C.journal], [C.theft, C.noJournal]])
        cards.push(t);
      cards.push([S.cards.endOfRun]);
      const wide = [], tall = [], overChars = [], smallPx = [], badLead = [], badAlign = [];
      const shrunk = {};
      const perCard = {};
      let checked = 0;
      for (let ci = 0; ci < cards.length; ci++) {
        const lines = cards[ci];
        for (let bi = 0; bi < 2; bi++) {
          const btns = bi ? [{ id: 'b', label: S.cards.restart, focus: true }] : [];
          const key = ci + '|' + bi;
          for (const scale of [1, 1.25, 1.5]) {
            const L = g.layoutCard(lines, { textScale: scale }, btns);
            checked++;
            for (const ln of L.lines) {
              if (ln.width > L.innerW + 0.5)
                wide.push({ scale, str: ln.str.slice(0, 60),
                            width: Math.round(ln.width * 10) / 10, innerW: L.innerW });
              if (ln.str.length > L.measureChars)
                overChars.push({ scale, len: ln.str.length, str: ln.str.slice(0, 60) });
              if (L.align !== 'left' || ln.x !== L.textX || ln.x < L.paperX0 + L.padX - 0.5)
                badAlign.push({ scale, str: ln.str.slice(0, 40), x: ln.x, textX: L.textX });
            }
            if (L.px < 13)
              smallPx.push({ scale, first: String(lines[0]).slice(0, 40), px: L.px });
            const leadRatio = L.leading / L.px;
            if (leadRatio < 1.45 || leadRatio > 1.55)
              badLead.push({ scale, first: String(lines[0]).slice(0, 40),
                             px: L.px, leading: L.leading });
            if (L.textBottom > L.textLimit + 0.5 || L.textTop < L.paperTop - 0.5)
              tall.push({ scale, first: String(lines[0]).slice(0, 40), logical: lines.length,
                          buttons: btns.length, bottom: Math.round(L.textBottom),
                          limit: Math.round(L.textLimit) });
            if (L.shrink < 1) {
              const k = `${scale}|${lines.length}|${btns.length}|${String(lines[0]).slice(0, 30)}`;
              if (!(k in shrunk) || L.shrink < shrunk[k].shrink)
                shrunk[k] = { scale, shrink: L.shrink, px: L.px, logical: lines.length,
                              buttons: btns.length, first: String(lines[0]).slice(0, 44) };
            }
            if (!perCard[key])
              perCard[key] = { first: String(lines[0]).slice(0, 44), logical: lines.length,
                               buttons: btns.length, scales: {} };
            perCard[key].scales[scale] = {
              px: L.px, nLines: L.lines.length,
              maxChars: L.lines.length ? Math.max(...L.lines.map(l => l.str.length)) : 0,
            };
          }
        }
      }
      const under = [];
      for (const c of Object.values(perCard)) {
        const p1 = c.scales[1].px, p2 = c.scales[1.25].px, p3 = c.scales[1.5].px;
        if (p2 < p1 * 1.25 * 0.85 || p3 < p1 * 1.5 * 0.85)
          under.push({ first: c.first, buttons: c.buttons, p1, p2, p3 });
      }
      // The heaviest cards for the record: most wrapped lines first, then the
      // deepest shrink at textScale 1.
      const heavy = Object.values(perCard)
        .sort((a, b) => (b.scales[1].nLines - a.scales[1].nLines)
                        || (a.scales[1].px - b.scales[1].px))
        .slice(0, 6);
      return { checked, nStrings: all.length, wide, tall, overChars, smallPx,
               badLead, badAlign, under, heavy, shrunk: Object.values(shrunk) };
    })()""")
    check(not rep["wide"],
          f"every card line wraps inside the paper's inner width "
          f"({rep['checked']} layouts over {rep['nStrings']} strings; overflow: {rep['wide'][:3]})")
    check(not rep["tall"],
          f"every card block clears the paper's foot and the button zone "
          f"({rep['checked']} layouts; misfit: {rep['tall'][:3]})")
    check(not rep["overChars"],
          f"every wrapped line holds at most 62 characters — §9's measure asserted "
          f"in characters ({rep['checked']} layouts; over: {rep['overChars'][:3]})")
    check(not rep["smallPx"],
          f"card body never crosses §9's 13 px floor ({rep['checked']} layouts; "
          f"under: {rep['smallPx'][:3]})")
    check(not rep["badLead"],
          f"card leading holds at 1.5 at every ladder rung "
          f"({rep['checked']} layouts; off: {rep['badLead'][:3]})")
    check(not rep["badAlign"],
          f"every card line is left-aligned at the paper's text edge "
          f"({rep['checked']} layouts; off: {rep['badAlign'][:3]})")
    check(not rep["under"],
          f"the text-size setting delivers at least its own ratio on every card "
          f"(0.85 tolerance for ladder steps; under-delivers: {rep['under'][:3]})")
    out["layout"] = rep
    for s in sorted(rep["shrunk"], key=lambda s: (s["scale"], s["first"])):
        print(f"  note  textScale {s['scale']}: a {s['logical']}-line card "
              f"({'buttons' if s['buttons'] else 'no buttons'}) fits at shrink {s['shrink']} "
              f"(body {s['px']} px) — {s['first']!r}")
    print("  card table (heaviest): body px / wrapped lines / max chars per line, "
          "textScale 1 · 1.25 · 1.5")
    for c in rep["heavy"]:
        sc = c["scales"]
        print(f"    {c['first']!r} ({c['logical']} logical, "
              f"{'buttons' if c['buttons'] else 'no buttons'}): "
              + " · ".join(f"{sc[str(s)]['px']}/{sc[str(s)]['nLines']}/{sc[str(s)]['maxChars']}"
                           for s in (1, 1.25, 1.5)))

    # Frames for the record: the about card, and the options panel at
    # textScale 1.25 — both go through drawCard's new wrapping path.
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(6000)
    page.mouse.click(640, 756)   # third verb: about
    page.wait_for_timeout(500)
    check(phase(page) == "about", "the about card opens for the layout frame")
    out["about_shot"] = shot(page, "card_about")
    page.mouse.click(640, 400)   # anywhere: back to the title
    page.wait_for_timeout(400)
    page.wait_for_function("window.__game.state.phaseTick >= 280", timeout=10000)
    page.mouse.click(640, 722)   # second verb: options
    page.wait_for_timeout(400)
    rows = page.evaluate("window.__game.optionRows")
    page.mouse.click(rows[0]["x"] + rows[0]["w"] / 2, rows[0]["y"] + rows[0]["h"] / 2)   # text size 1 -> 1.25
    page.wait_for_timeout(400)
    scale = page.evaluate("(JSON.parse(localStorage.getItem('hovel.options') || '{}').textScale) || 1")
    check(scale == 1.25, f"the options frame is at textScale 1.25 (got {scale})")
    out["options_shot"] = shot(page, "card_options_scale125")
    page.evaluate("localStorage.removeItem('hovel.options')")
    out["completed"] = True
    return out


# ---------------------------------------------------- epilogue at two text sizes
#
# TASK F10: the text-size setting must produce a proportionate change on the
# cards themselves, and the epilogue card is the slice's payoff surface. The
# pass plays the fastest designed path to an epilogue card by real input —
# the night-1 seen failure, one key on — once at textScale 1 and once at 1.5,
# frames the lane card both times, measures the exact card on screen through
# layoutCard, and asserts the delivered body size really grows.

def run_epilogue_textscale(page) -> dict:
    out = {}
    section("epilogue card: the text-size setting delivers (F10)")
    err0 = len(errors)
    layouts = {}
    try:
        for scale in (1, 1.5):
            tag = f"scale{scale}"
            page.goto(URL, wait_until="networkidle")
            page.evaluate("localStorage.setItem('hovel.options', "
                          f"JSON.stringify({{ textScale: {scale} }}))")
            page.goto(URL, wait_until="networkidle")
            page.wait_for_timeout(600)
            need(phase(page) == "title", f"[{tag}] boots into the title phase")
            got = page.evaluate(
                "(JSON.parse(localStorage.getItem('hovel.options') || '{}').textScale) || 1")
            need(got == scale, f"[{tag}] textScale {scale} is in force (got {got})")
            page.keyboard.press("Enter")
            need(wait_cond(page, lambda s: s["phase"] == "coldOpen", 5) is not None,
                 f"[{tag}] leaving the title works")
            page.keyboard.down(" ")
            t0 = time.time()
            while phase(page) == "coldOpen" and time.time() - t0 < 40:
                page.wait_for_timeout(500)
            page.keyboard.up(" ")
            need(qa_state(page)["phase"] == "night",
                 f"[{tag}] cold open completes into night 1")
            press(page, "x")  # lift the plank; stand still for Agatha's patrol
            need(wait_cond(page, lambda s: s["phase"] == "seen", 30 * SPEED) is not None,
                 f"[{tag}] Agatha's retiring patrol finds the creature")
            page.wait_for_function("window.__game.epilogueStep >= 1", timeout=10000)
            press(page)  # through the failure card into the epilogue
            s = wait_cond(page, lambda s: s["phase"] == "epilogue", 5)
            need(s is not None and s["ending"] == "seen",
                 f"[{tag}] the epilogue opens (ending={s and s['ending']})")
            page.wait_for_timeout(600)  # let the lane card draw for a few frames
            out[f"shot_{tag}"] = shot(page, f"epilogue_textscale{scale}")
            layouts[scale] = page.evaluate("""(() => {
              const g = window.__game, S = g.STRINGS;
              // the exact card renderEpilogue's lane step is showing
              const m = g.engine.epilogueModel(g.state);
              const lines = [...S.epilogue.lane];
              if (m.satUp) lines.push(S.epilogue.laneSatUp);
              lines.push(m.beds >= 3 ? S.epilogue.laneAnswerProduce : S.epilogue.laneAnswer);
              const L = g.layoutCard(lines, { textScale: %s }, []);
              return { px: L.px, pxTitle: L.pxTitle, lines: L.lines.length,
                       maxChars: Math.max(...L.lines.map(l => l.str.length)),
                       align: L.align, paperW: Math.round(L.paperX1 - L.paperX0),
                       bottom: Math.round(L.textBottom), limit: Math.round(L.textLimit) };
            })()""" % scale)
            need(layouts[scale]["bottom"] <= layouts[scale]["limit"],
                 f"[{tag}] the lane card fits its paper on screen "
                 f"({layouts[scale]['bottom']} <= {layouts[scale]['limit']})")
            page.evaluate("localStorage.removeItem('hovel.options')")
        need(len(errors) == err0,
             f"console clean through both epilogue runs ({len(errors) - err0} new errors)")
        check(layouts[1.5]["px"] > layouts[1]["px"],
              f"the epilogue card's body grows with the setting: scale 1 -> "
              f"{layouts[1]['px']} px / {layouts[1]['lines']} lines / "
              f"{layouts[1]['maxChars']} max chars, scale 1.5 -> {layouts[1.5]['px']} px / "
              f"{layouts[1.5]['lines']} lines / {layouts[1.5]['maxChars']} max chars")
        out["layouts"] = layouts
        out["completed"] = True
    except CampaignAbort as e:
        out["completed"] = False
        out["abort"] = str(e)
        check(False, f"[epilogue-textscale] {e}")
        try:
            out["state_at_abort"] = qa_state(page)
            out["abort_shot"] = shot(page, "epilogue_textscale_abort")
        except Exception:
            pass
        page.evaluate("localStorage.removeItem('hovel.options')")
    return out


# ---------------------------------------------------------------- fonts
#
# ART_DIRECTION §9 + §16.1: font/caslon-text and font/caslon-display are
# release-gated skin keys, loaded by src/skin.js through FontFace. "Loaded" is
# not "in use" — the F6 lesson — so the gate does not stop at
# document.fonts.check: it measures the game's own title and prompt strings in
# each Caslon face and in Georgia and asserts the widths differ. If a face
# failed to load, the canvas would silently measure with Georgia and the two
# numbers would be identical.

def run_fonts(page) -> dict:
    out = {}
    section("fonts: the Caslon faces load and are really in use (§9, §16.1)")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(600)
    rep = page.evaluate("""async () => {
      await document.fonts.ready;
      const cx = document.createElement('canvas').getContext('2d');
      const w = (font, str) => { cx.font = font; return cx.measureText(str).width; };
      const S = window.__game.STRINGS;
      const body = S.prompts.keepWatching + ' · ' + S.prompts.liftPlank;
      const disp = S.title.book;
      return {
        checkText: document.fonts.check('16px "Libre Caslon Text"'),
        checkDisp: document.fonts.check('16px "Libre Caslon Display"'),
        pending: window.__game.pendingKeys,
        body, disp,
        textW: w('20px "Libre Caslon Text", Georgia, serif', body),
        textGeoW: w('20px Georgia, serif', body),
        dispW: w('30px "Libre Caslon Display", Georgia, serif', disp),
        dispGeoW: w('30px Georgia, serif', disp),
        textOnDisp: w('30px "Libre Caslon Text", Georgia, serif', disp),
        dispOnText: w('20px "Libre Caslon Display", Georgia, serif', body),
      };
    }""")
    check(rep["checkText"], 'document.fonts.check: "Libre Caslon Text" is loaded')
    check(rep["checkDisp"], 'document.fonts.check: "Libre Caslon Display" is loaded')
    font_pending = [k for k in rep["pending"] if k.startswith("font/")]
    check(not font_pending,
          f"skin.pending() holds no font keys (pending: {rep['pending'] or 'none'})")

    def differs(a, b):
        return abs(a - b) > max(0.5, 0.01 * max(a, b))
    check(differs(rep["textW"], rep["textGeoW"]),
          f"the prompt string really renders in Caslon Text, not the Georgia fallback "
          f"({rep['textW']:.1f} vs {rep['textGeoW']:.1f} px — {rep['body']!r})")
    check(differs(rep["dispW"], rep["dispGeoW"]),
          f"the title string really renders in Caslon Display, not the Georgia fallback "
          f"({rep['dispW']:.1f} vs {rep['dispGeoW']:.1f} px — {rep['disp']!r})")
    check(differs(rep["dispW"], rep["textOnDisp"]),
          f"Text and Display are not the same family (title: Display {rep['dispW']:.1f} "
          f"vs Text {rep['textOnDisp']:.1f} px)")
    check(differs(rep["textW"], rep["dispOnText"]),
          f"Text and Display are not the same family (body: Text {rep['textW']:.1f} "
          f"vs Display {rep['dispOnText']:.1f} px)")
    out["measure"] = rep

    # Frames for the record: the title plate (Display in use), and the cold
    # open's hovel with the prompt band (Text in use).
    page.wait_for_function("window.__game.state.phaseTick >= 280", timeout=15000)
    page.wait_for_timeout(300)
    out["title_shot"] = shot(page, "fonts_title")
    page.keyboard.press("Enter")
    page.wait_for_timeout(1200)
    check(phase(page) == "coldOpen", "the cold open opens for the prompt-band frame")
    out["prompt_shot"] = shot(page, "fonts_coldopen_prompt")
    out["completed"] = True
    return out


# ---------------------------------------------------------------- audio
#
# ART_DIRECTION §13 + the queue's audio task: all twelve §13.5 gated keys are
# authored and fire from real state. Headless cannot hear, so the proof is
# fourfold. Offline: every key's exact voice (or bed) and position stage is
# rendered in an OfflineAudioContext and asserted non-silent, with sound=false
# and a missing key asserted silent without throwing (the F6/fonts lesson:
# "called" is not "sounding"); the beds are rendered at two states and their
# levels compared (the hearth at a Firing >= 2 dawn vs a small one; the wind's
# yard layer up vs down — §13.2's second non-visual channel). The position
# stage is asserted on the band it actually filters: F14's full-band RMS
# compare netted the 900 Hz low-pass against the hovel's unfiltered 0.16
# reflection and passed at 2.2%, so it now compares the energy above 900 Hz
# (audition's hf900) on the palette's brightest source, the taper strike.
# Live: the switch and the autoplay gate, then a driven five-night campaign in
# which the played log and the live-bed list show every key entering from real
# state — and the bird entering at every dawn read and in no other phase.

# Offline floors sit at roughly half the measured renders (qa/evidence/
# automated.json, run.audio.renders) so a voice can be re-balanced without a
# harness edit, but silence, a dropped position stage, or a bed that stops
# following state fails loudly.
GATED_KEYS = (
    "footfall/snow", "footfall/path", "footfall/earth", "footfall/straw",
    "load-down", "latch", "hearth/small", "hearth/high",
    "taper-strike", "dawn-bird", "wind", "guitar",
)


def run_audio(page) -> dict:
    out = {"plan": "register + offline renders (no input); the sound switch; "
                   "then nights 1-5: clear the path n1, a garden print and the "
                   "first carry n2, the taper n3 (waited out inside), the "
                   "second carry n4, the thaw and the sty n5 -> every gated "
                   "key from real state"}
    try:
        section("audio: the register and the offline renders (§13.5)")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(600)
        reg = page.evaluate("""() => ({
          pending: window.__game.audioPending,
          gated: window.__game.audioGatedPending,
          status: window.__game.audioStatus,
        })""")
        out["pending"] = reg["pending"]
        check(reg["pending"] == [],
              f"audio.pending(): empty — all twelve §13.5 keys authored {reg['pending']}")
        check(reg["gated"] == [],
              f"audio.gatedPending(): empty — the release-gate row closes {reg['gated']}")
        out["context_before_input"] = reg["status"]["context"]

        rend = page.evaluate("""async () => {
          const A = window.__game;
          const tryAud = async (key, opts) => {
            try { return await A.audioAudition(key, opts); }
            catch (e) { return { threw: String(e) }; }
          };
          return {
            'footfall/snow':  await tryAud('footfall/snow',  { position: 'yard',  seconds: 0.6 }),
            'footfall/path':  await tryAud('footfall/path',  { position: 'yard',  seconds: 0.6 }),
            'footfall/earth': await tryAud('footfall/earth', { position: 'yard',  seconds: 0.6 }),
            'footfall/straw': await tryAud('footfall/straw', { position: 'yard',  seconds: 0.6 }),
            'load-down':      await tryAud('load-down',      { position: 'yard',  seconds: 1.2 }),
            'latch':          await tryAud('latch',          { position: 'hovel', seconds: 0.6 }),
            'hearth/small':   await tryAud('hearth/small',   { position: 'hovel', seconds: 2.5 }),
            'hearth/high':    await tryAud('hearth/high',    { position: 'hovel', seconds: 2.5 }),
            'taper-strike':   await tryAud('taper-strike',   { position: 'hovel', seconds: 1.0 }),
            'dawn-bird':      await tryAud('dawn-bird',      { position: 'hovel', seconds: 2.0 }),
            'wind':           await tryAud('wind',           { position: 'yard',  seconds: 3.0 }),
            'guitar':         await tryAud('guitar',         { position: 'hovel', seconds: 7.5 }),
            'wind/l2up':      await tryAud('wind', { position: 'yard', seconds: 3.0, params: { layer2: 1 } }),
            'wind/l2down':    await tryAud('wind', { position: 'yard', seconds: 3.0, params: { layer2: 0 } }),
            'off':            await tryAud('latch', { position: 'hovel', sound: false }),
            'offBed':         await tryAud('hearth/high', { position: 'hovel', sound: false, seconds: 2.0 }),
            'missing':        await tryAud('no/such-key', { position: 'hovel' }),
            'taperYard':      await tryAud('taper-strike', { position: 'yard', seconds: 1.0 }),
          };
        }""")
        out["renders"] = rend
        floors = {  # (rms, peak) at ~half the measured values
            "footfall/snow": (0.0004, 0.008), "footfall/path": (0.0004, 0.008),
            "footfall/earth": (0.0004, 0.006), "footfall/straw": (0.0004, 0.006),
            "load-down": (0.008, 0.10), "latch": (0.005, 0.05),
            "hearth/small": (0.003, 0.012), "hearth/high": (0.007, 0.03),
            "taper-strike": (0.003, 0.02), "dawn-bird": (0.015, 0.12),
            "wind": (0.003, 0.010), "guitar": (0.02, 0.10),
        }
        for k in GATED_KEYS:
            r = rend[k]
            lo_rms, lo_peak = floors[k]
            check(not r.get("threw") and r.get("rms", 0) > lo_rms and r.get("peak", 0) > lo_peak,
                  f"{k} offline render is not silence (RMS {r.get('rms'):.5f} >= {lo_rms}, "
                  f"peak {r.get('peak'):.3f} >= {lo_peak})")
        small, high = rend["hearth/small"], rend["hearth/high"]
        check(high.get("rms", 0) > small.get("rms", 1) * 1.8,
              f"the hearth's level follows the fire: built high is louder than small "
              f"(RMS {high.get('rms'):.5f} vs {small.get('rms'):.5f}; §13.2's second channel)")
        l2up, l2down = rend["wind/l2up"], rend["wind/l2down"]
        check(l2up.get("rms", 0) > l2down.get("rms", 1) * 3,
              f"the wind's yard layer rises for the last two night-minutes "
              f"(RMS {l2up.get('rms'):.5f} vs {l2down.get('rms'):.5f} down)")
        off, off_bed, missing = rend["off"], rend["offBed"], rend["missing"]
        check(not off.get("threw") and off.get("rms", 1) < 1e-9,
              f"the same render with sound=false is silence (RMS {off.get('rms')})")
        check(not off_bed.get("threw") and off_bed.get("rms", 1) < 1e-9,
              f"a bed with sound=false is silence too (RMS {off_bed.get('rms')})")
        check(not missing.get("threw") and missing.get("rms", 1) < 1e-9,
              f"a missing key renders silence and does not throw "
              f"(threw={missing.get('threw')!r}, RMS {missing.get('rms')})")
        taper_yard, taper_hovel = rend["taperYard"], rend["taper-strike"]
        check(taper_yard.get("hf900", 0) > taper_hovel.get("hf900", 1) * 2,
              f"F14: the position stage really filters — energy above the wall's 900 Hz "
              f"corner, yard vs hovel (hf900 {taper_yard.get('hf900'):.5f} vs "
              f"{taper_hovel.get('hf900'):.5f}; full-band RMS nets the low-pass against "
              f"the reflection and says nothing)")

        section("audio: the switch on the options plate, and the autoplay gate")
        # Title -> options -> the sound row. The first arrows/Enter are also the
        # first real input, so the context must be running right after.
        page.keyboard.press("ArrowDown")   # title focus: begin -> options
        page.keyboard.press("Enter")
        need(wait_cond(page, lambda s: s["phase"] == "options", 5) is not None,
             "[audio] the options plate opens")
        st1 = page.evaluate("window.__game.audioStatus")
        check(st1["context"] == "running",
              f"AudioContext running after the first real input (was "
              f"{out['context_before_input']!r} before, now {st1['context']!r})")
        page.keyboard.press("ArrowDown")   # textScale -> ink
        page.keyboard.press("ArrowDown")   # ink -> sound
        page.keyboard.press("Enter")       # sound off
        page.wait_for_timeout(150)
        st2 = page.evaluate("window.__game.audioStatus")
        check(st2["soundOn"] is False, "[audio] options.sound off reaches the layer")
        page.keyboard.press("Enter")       # sound back on for the driven nights
        page.wait_for_timeout(150)
        st3 = page.evaluate("window.__game.audioStatus")
        check(st3["soundOn"] is True, "[audio] options.sound on again")

        section("audio: five driven nights — every gated key from real state")
        cold_open_to_night1(page, "audio")
        need(wait_cond(page, lambda s: any(b["key"] == "wind" for b in page.evaluate("window.__game.audioBeds")), 5),
             "[audio] night 1: the wind bed is sounding")
        guitars0 = page.evaluate("window.__game.audioPlayed")
        need(any(p["key"] == "guitar" and p["phase"] == "coldOpen" for p in guitars0),
             "[audio] the cold open's 0:06 beat sounds the guitar")

        # Night 1: clear the path at the apron, then scuff on it — snow first,
        # grit after (footfall/snow, footfall/path).
        need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED),
             "[audio] night 1: the retiring window closes")
        press(page, "x")
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[audio] night 1: steps out once the yard is empty")
        for wx, wy in [(684, 290), (748, 300), (748, 440), (700, 440)]:
            s = drive_to(page, wx, wy, 12)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 1: the walk to the apron failed (last={s})")
        press(page)  # iron on frozen ground: the path hold (stands still)
        need(wait_cond(page, lambda s: s["action"] == "path", 5),
             "[audio] night 1: clearing the path")
        need(wait_cond(page, lambda s: s["action"] is None, 8 * SPEED),
             "[audio] night 1: the path is cleared")
        for _ in range(2):  # scuff the grit he just made
            drive_to(page, 748, 440, 10)
            drive_to(page, 700, 440, 10)
        for wx, wy in [(748, 300), (684, 290), (630, 265)]:
            s = drive_to(page, wx, wy, 12)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 1: the walk home failed (last={s})")
        press(page)  # slip back inside
        need(qa_state(page)["inHovel"], "[audio] night 1: back inside ahead of the dawn window")
        s = wait_dawn(page)  # dawn 2: Firing 0, no fire lit
        played0 = page.evaluate("window.__game.audioPlayed")
        check(not any(p["key"] == "latch" for p in played0),
              f"[audio] dawn 2 without a carry: no latch (played: {played0 or 'nothing'})")
        check(not any(b["key"].startswith("hearth") for b in page.evaluate("window.__game.audioBeds")),
              "[audio] a Firing-0 dawn: the hearth is silent (no fire burning)")
        for k in ("footfall/snow", "footfall/path"):
            need(any(p["key"] == k and p["phase"] == "night" for p in played0),
                 f"[audio] {k} sounded from a real walk on its surface")
        need(any(p["key"] == "guitar" and p["phase"] == "night" for p in played0),
             "[audio] the guitar sounds at its seeded hour inside the night")

        # Night 2: a garden print (unease 2 by dawn 3 -> the taper on night 3),
        # then the first carry — load-down at the door, the latch at dawn 3.
        press(page)  # let the day pass -> night 2
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 2, 5),
             "[audio] night 2 begins")
        need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED),
             "[audio] night 2: the retiring window closes")
        press(page, "x")
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[audio] night 2: steps out once the yard is empty")
        for wx, wy in [(684, 290), (748, 300), (850, 460)]:
            s = drive_to(page, wx, wy, 12)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 2: the walk to the garden failed (last={s})")
        need(wait_cond(page, lambda s: s["unease"] == 2, 5),
             "[audio] night 2: a footprint in the beds (unease 1 -> 2)")
        f0 = qa_state(page)["firing"]
        for wx, wy in [(455, 462), (310, 458)]:
            s = drive_to(page, wx, wy, 14)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 2: the walk to the outhouse failed (last={s})")
        press(page)  # take the load up
        need(qa_state(page)["carrying"], "[audio] night 2: the load is taken up")
        for wx, wy in ROUTE_DOOR:
            s = drive_to(page, wx, wy, 16)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 2: the carry to the door failed (last={s})")
        press(page)  # put it down at their door
        s = qa_state(page)
        need(not s["carrying"] and s["firing"] == f0 + 1,
             f"[audio] night 2: put down at their door (firing {f0} -> {s['firing']})")
        for wx, wy in ROUTE_HOME:
            s = drive_to(page, wx, wy, 12)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 2: the walk home failed (last={s})")
        press(page)  # slip back inside
        need(qa_state(page)["inHovel"], "[audio] night 2: back inside ahead of the dawn window")
        s = wait_dawn(page)  # dawn 3: the family finds the first load
        played1 = page.evaluate("window.__game.audioPlayed")
        latches = [p for p in played1 if p["key"] == "latch"]
        check(len(latches) == 1,
              f"[audio] the dawn after the first carry sounds the latch, once "
              f"(played: {played1})")
        check(bool(latches) and latches[0]["position"] == "hovel",
              f"[audio] the latch is heard through the hovel wall "
              f"(position: {latches[0]['position'] if latches else 'n/a'})")
        loads = [p for p in played1 if p["key"] == "load-down" and p["phase"] == "night"]
        check(bool(loads) and loads[0]["position"] == "yard",
              f"[audio] the load-down sounds at the door, in the open "
              f"({len(loads)}x, position {loads[0]['position'] if loads else 'n/a'})")
        check(any(b["key"] == "hearth/small" for b in page.evaluate("window.__game.audioBeds")),
              "[audio] a Firing-1 dawn read: the hearth bed sounds, small")

        # Night 3: unease 2 at the dusk snapshot, so the taper lights ahead of
        # Felix waking. Waited out inside — heard through the wall.
        press(page)  # -> night 3, no second carry
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 3, 5),
             "[audio] night 3 begins")
        s = wait_dawn(page)  # dawn 4
        played2 = page.evaluate("window.__game.audioPlayed")
        check(sum(1 for p in played2 if p["key"] == "latch") == 1,
              f"[audio] dawn 4 with nothing new carried: still one latch, not two "
              f"(played: {played2})")
        tapers = [p for p in played2 if p["key"] == "taper-strike"]
        check(len(tapers) == 1 and tapers[0]["phase"] == "night" and tapers[0]["position"] == "hovel",
              f"[audio] the taper strike fires from a real unease-2 night, heard through "
              f"the wall ({len(tapers)}x, {tapers[0] if tapers else 'n/a'})")

        # Night 4: the second carry -> Firing 2 at dawn 5, the hearth built high.
        press(page)  # -> night 4
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 4, 5),
             "[audio] night 4 begins")
        need(wait_cond(page, lambda s: s["minute"] >= 5.2, 10 * SPEED),
             "[audio] night 4: the retiring window closes")
        press(page, "x")
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[audio] night 4: steps out once the yard is empty")
        carry_load(page, out, "audio_n4_carry")
        s = wait_dawn(page)  # dawn 5: Firing 2
        need(s["firing"] == 2, f"[audio] dawn 5: Firing 2 behind the read (firing {s['firing']})")
        check(any(b["key"] == "hearth/high" for b in page.evaluate("window.__game.audioBeds")),
              "[audio] a Firing-2 dawn read: the hearth bed sounds, built high")

        # Night 5: the thaw — earth underfoot, and the sty's straw (the pig
        # drive is free of unease by design, GAME_DESIGN §6.4).
        press(page)  # -> night 5 (Firing 2 at dusk: the household retires late)
        need(wait_cond(page, lambda s: s["phase"] == "night" and s["night"] == 5, 5),
             "[audio] night 5 begins")
        need(wait_cond(page, lambda s: s["minute"] >= 6.2, 10 * SPEED),
             "[audio] night 5: the late retiring window closes")
        press(page, "x")
        need(wait_cond(page, lambda s: not s["inHovel"], 5),
             "[audio] night 5: steps out once the yard is empty")
        for wx, wy in [(585, 258), (520, 238), (530, 246), (585, 258), (630, 265)]:
            s = drive_to(page, wx, wy, 10)
            if s is None or s["phase"] != "night":
                raise CampaignAbort(f"night 5: the sty round failed (last={s})")
        press(page)  # slip back inside
        need(qa_state(page)["inHovel"], "[audio] night 5: back inside ahead of the dawn window")
        s = wait_dawn(page)  # dawn 6
        played5 = page.evaluate("window.__game.audioPlayed")
        for k in ("footfall/earth", "footfall/straw"):
            need(any(p["key"] == k and p["phase"] == "night" for p in played5),
                 f"[audio] {k} sounded from a real walk on its surface")

        section("audio: the release-gate table closes (§13.5)")
        played_all = page.evaluate("window.__game.audioPlayed")
        missing = [k for k in GATED_KEYS if not any(p["key"] == k for p in played_all)]
        check(not missing,
              f"all twelve gated cues fired from real state in one campaign "
              f"(missing: {missing or 'none'})")
        birds = [p for p in played_all if p["key"] == "dawn-bird"]
        check(len(birds) == 5 and all(p["phase"] == "dawnRead" for p in birds),
              f"the bird sings at first light and nowhere else "
              f"({len(birds)} dawns, phases {sorted(set(p['phase'] for p in birds)) or 'n/a'})")
        out["completed"] = True
    except CampaignAbort as e:
        out["aborted"] = str(e)
        check(False, f"[audio] pass aborted: {e}")
    return out


def main() -> int:
    shutil.rmtree(SHOTS, ignore_errors=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = ensure_server()
    result = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))
            page.on("requestfailed", lambda r: net_errors.append(f"{r.url}: {r.failure}"))
            page.on("request", lambda r: request_hosts.add(urlparse(r.url).netloc))
            page.add_init_script(LONGTASK_INIT)

            passes = (
                ("keyboard", lambda: run_once(page, "keyboard")),
                ("mouse", lambda: run_once(page, "mouse")),
                ("campaign", lambda: run_campaign(page)),
                ("mouse_campaign", lambda: run_mouse_campaign(page)),
                ("seen", lambda: run_seen(page)),
                ("want", lambda: run_want(page)),
                ("silence", lambda: run_silence(page)),
                ("card_layout", lambda: run_card_layout(page)),
                ("epilogue_textscale", lambda: run_epilogue_textscale(page)),
                ("fonts", lambda: run_fonts(page)),
                ("audio", lambda: run_audio(page)),
            )
            unknown = ONLY - {name for name, _ in passes}
            if unknown:
                raise SystemExit(f"QA_ONLY names no such pass: {sorted(unknown)}")
            for name, run in passes:
                if ONLY and name not in ONLY:
                    continue
                result[name] = run()

            section("determinism")
            def replay():
                page.goto(URL, wait_until="networkidle")
                page.wait_for_timeout(300)
                page.keyboard.press("Enter")
                for _ in range(40):
                    page.keyboard.press("ArrowRight"); page.wait_for_timeout(40)
                s = st(page)
                return {k: s.get(k) for k in ("night", "words", "firing", "store", "ownFood", "unease")}
            a, b = replay(), replay()
            check(a == b, f"same seed + same input sequence -> same state ({a})")

            section("viewport and readability")
            for w, h in ((1280, 800), (1280, 720)):
                page.set_viewport_size({"width": w, "height": h})
                page.wait_for_timeout(400)
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth > window.innerWidth ||"
                    " document.documentElement.scrollHeight > window.innerHeight")
                check(not overflow, f"{w}x{h} no scroll overflow")
                cv = page.locator("canvas").bounding_box()
                check(cv and cv["width"] > 0 and cv["height"] > 0, f"{w}x{h} canvas has non-zero size")
                shot(page, f"viewport_{w}x{h}")
            page.set_viewport_size({"width": 1280, "height": 800})

            section("reduced motion")
            rm = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
            rmp = rm.new_page()
            rmp.goto(URL, wait_until="networkidle")
            rmp.wait_for_timeout(1500)
            check(rmp.locator("canvas").count() == 1, "still renders under prefers-reduced-motion")
            rmp.screenshot(path=str(SHOTS / "reduced_motion.jpg"), type="jpeg", quality=80)
            rm.close()

            longtasks = page.evaluate("window.__longtasks || []") or []
            ctx.close(); browser.close()
    finally:
        if server:
            server.terminate()

    section("self-contained and performance")
    local = {urlparse(BASE).netloc, ""}
    external = sorted(h for h in request_hosts if h not in local)
    check(not external, f"no external request domains (saw {sorted(request_hosts)})")
    check(not net_errors, f"no failed resource requests ({len(net_errors)})")
    check(not errors, f"console clean ({len(errors)} errors)")
    worst_p95 = max((d["p95"] for d in perf.values()), default=0.0)
    worst_max = max((d["max"] for d in perf.values()), default=0.0)
    check(worst_p95 <= FRAME_FLOOR_MS, f"frame p95 {worst_p95} ms <= {FRAME_FLOOR_MS} ms (30 FPS floor)")
    check(worst_max < STALL_MS, f"no >{STALL_MS:.0f} ms stall (worst frame {worst_max} ms)")
    boot = [t for t in longtasks if t["at"] <= 1500]
    ingame = [t for t in longtasks if t["at"] > 1500]
    if boot:
        print(f"  boot long tasks: {[t['ms'] for t in boot]} (first-paint decode; see load gate)")
    check(max((t["ms"] for t in ingame), default=0) < STALL_MS,
          f"no in-game main-thread block > {STALL_MS:.0f} ms ({len(ingame)} over 50 ms)")

    size = sum(p.stat().st_size for p in APP.rglob("*") if p.is_file())
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    SUMMARY.write_text(json.dumps({
        "url": URL, "normal_speed_run": SLOW, "viewport": "1280x800",
        "partial": bool(ONLY), "passes_run": sorted(result) if ONLY else "all",
        "passed": passed, "failed": failed,
        "console_errors": errors, "network_errors": net_errors,
        "request_hosts": sorted(request_hosts), "external_hosts": external,
        "frame_ms": perf, "frame_floor_ms": FRAME_FLOOR_MS, "stall_gate_ms": STALL_MS,
        "longtasks_over_50ms": sorted(longtasks, key=lambda t: -t["ms"]),
        "build_bytes": size, "shots": shot_n,
        "shots_dir": str(SHOTS.relative_to(EXAMPLE_ROOT)),
        "run": result,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nbuild: {size/1048576:.2f} MB | external domains: {external or 'none'}")
    print(f"result: {passed} passed, {failed} failed | {shot_n} frames -> {SHOTS}")
    if ONLY:
        print(f"note: PARTIAL run ({', '.join(sorted(result))}); not a release gate and not "
              f"the canonical evidence. Re-run without QA_ONLY for that.")
    if not SLOW:
        print("note: accelerated run; timing evidence is invalid. Re-run once with QA_SLOW=1.")
    return 1 if (failed or errors) else 0


if __name__ == "__main__":
    raise SystemExit(main())
