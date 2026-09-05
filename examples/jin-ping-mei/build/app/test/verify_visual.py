#!/usr/bin/env python3
"""轻量浏览器视觉烟测：标题、首日、夜访、结局与重开。"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


APP = Path(__file__).resolve().parents[1]
EXAMPLE = APP.parents[1]
EVIDENCE = EXAMPLE / "qa" / "evidence"
VERIFICATION = EXAMPLE / "qa" / "verification.json"
RUN_EVIDENCE = EVIDENCE / "run.json"
RUN_ID = "jin-ping-mei-visual-reconstruction-2026-09-05"
VERIFY_COMMAND = "cd examples/jin-ping-mei/build/app && python3 test/verify_visual.py --write-evidence"
VIEWPORTS = [
    ("mobile", 390, 844),
    ("portrait-tablet", 768, 1024),
    ("tablet", 1024, 768),
    ("desktop", 1280, 800),
    ("wide", 1920, 1080),
]

LIMITATIONS = [
    {
        "scope": "路径覆盖",
        "reason": "快速路径在每屏选择第一项可行主动作，只到达一个失稳结局；没有穷举其他选项或结局。",
    },
    {
        "scope": "输入覆盖",
        "reason": "本次使用 Playwright locator.click 且不使用 force；没有复测 2026-08 的全键盘正常速度路径。",
    },
    {
        "scope": "响应式覆盖",
        "reason": "五档视口覆盖标题与首日，390×844 和 1280×800 覆盖夜访，1280×800 覆盖本次结局；未声明五档完整二十日矩阵。",
    },
    {
        "scope": "体验判断",
        "reason": "自动化只证明当前候选可启动、渲染、输入、走到结果并重开，不判断主观吸引力、长期平衡或其他浏览器。",
    },
]


def write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def pending_verification() -> dict:
    return {
        "schemaVersion": 3,
        "status": "FAIL",
        "verify": {"command": VERIFY_COMMAND, "exitCode": 1},
        "completeRun": {
            "id": RUN_ID,
            "cleanContext": True,
            "terminal": "NOT_RUN",
            "restart": "NOT_RUN",
            "evidence": "qa/evidence/run.json",
        },
        "checks": {key: "NOT_RUN" for key in ("launch", "render", "input", "coreLoop", "outcome", "restart")},
        "limitations": LIMITATIONS,
    }


def runtime_digest() -> str:
    digest = hashlib.sha256()
    for relative in ("index.html", "css/style.css", "css/new-guofeng.css", "js/main.js", "js/data.js", "js/engine.js", "js/text.js", "js/assets.js"):
        digest.update(relative.encode())
        digest.update((APP / relative).read_bytes())
    for asset in sorted((APP / "assets").rglob("*")):
        if asset.is_file():
            digest.update(asset.relative_to(APP).as_posix().encode())
            digest.update(asset.read_bytes())
    return digest.hexdigest()


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_server(url: str) -> None:
    for _ in range(50):
        try:
            with urlopen(url, timeout=0.2) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("本地验证服务器未能启动")


def layout_snapshot(page, name: str, width: int, height: int) -> dict:
    page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(40)
    metrics = page.evaluate(
        """() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          mainPanelOverflow: [...document.querySelectorAll('#phase-stage .decision-panel')]
            .some((panel) => panel.scrollHeight > panel.clientHeight + 1),
          controls: [...document.querySelectorAll('button:not(:disabled):not([aria-disabled="true"])')]
            .filter((button) => {
              const rect = button.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
            .map((button) => {
              const rect = button.getBoundingClientRect();
              return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
            })
        })"""
    )
    controls_in_view = all(
        control["left"] >= -0.5
        and control["top"] >= -0.5
        and control["right"] <= width + 0.5
        and control["bottom"] <= height + 0.5
        for control in metrics["controls"]
    )
    return {
        "name": name,
        "width": width,
        "height": height,
        "horizontalOverflow": metrics["scrollWidth"] > metrics["clientWidth"],
        "verticalPageOverflow": metrics["scrollHeight"] > metrics["clientHeight"],
        "mainPanelOverflow": metrics["mainPanelOverflow"],
        "enabledControlsInViewport": controls_in_view,
    }


def click_forward(page) -> str | None:
    candidate = page.evaluate(
        """() => {
          const selectorFor = (button) => {
            if (button.id) return `#${CSS.escape(button.id)}`;
            const key = Object.keys(button.dataset)[0];
            if (!key) return null;
            const attr = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
            return `[data-${attr}="${CSS.escape(button.dataset[key])}"]`;
          };
          const dismiss = document.querySelector('#result-feedback #btn-result-dismiss');
          if (dismiss) return { selector: '#btn-result-dismiss', label: 'dismiss-feedback' };
          const available = (selector) => [...document.querySelectorAll(selector)].filter((button) => {
            const rect = button.getBoundingClientRect();
            return !button.disabled && button.getAttribute('aria-disabled') !== 'true'
              && rect.width > 0 && rect.height > 0;
          });
          const preferred = available('#phase-stage .choice-button, #phase-stage .story-continue');
          const buttons = preferred.length ? preferred : available('#phase-stage button');
          if (!buttons.length) return null;
          return { selector: selectorFor(buttons[0]), label: buttons[0].innerText.trim() };
        }"""
    )
    if not candidate or not candidate["selector"]:
        return None
    page.locator(candidate["selector"]).click(timeout=5_000, no_wait_after=True)
    return candidate["label"]


def assert_layout(rows: list[dict], label: str) -> None:
    for row in rows:
        assert not row["horizontalOverflow"], f"{label} {row['name']} 出现横向溢出"
        assert not row["verticalPageOverflow"], f"{label} {row['name']} 出现页面纵向溢出"
        assert not row["mainPanelOverflow"], f"{label} {row['name']} 主面板出现内部滚动"
        assert row["enabledControlsInViewport"], f"{label} {row['name']} 有控件落出视口"


def run(write_evidence: bool) -> dict:
    port = free_port()
    url = f"http://127.0.0.1:{port}/?seed=42"
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(url)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            browser_version = browser.version
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            console_errors: list[str] = []
            http_errors: list[dict] = []
            pre_age_images: list[str] = []
            age_confirmed = {"value": False}
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: console_errors.append(str(error)))
            page.on(
                "response",
                lambda response: http_errors.append({"status": response.status, "url": response.url})
                if response.status >= 400
                else None,
            )
            page.on(
                "request",
                lambda request: pre_age_images.append(request.url)
                if request.resource_type == "image" and not age_confirmed["value"]
                else None,
            )

            page.goto(url, wait_until="commit")
            page.wait_for_selector("#btn-age-yes")
            page.wait_for_timeout(120)
            assert not any(
                "/assets/cg/" in item and "title_new_guofeng" not in item
                for item in pre_age_images
            )
            page.click("#btn-age-yes", no_wait_after=True)
            age_confirmed["value"] = True
            page.wait_for_selector("#btn-start")
            assert page.locator(".title-cast li").count() == 5
            title_layout = [layout_snapshot(page, *viewport) for viewport in VIEWPORTS]
            assert_layout(title_layout, "标题")
            if write_evidence:
                page.set_viewport_size({"width": 1920, "height": 1080})
                page.screenshot(path=str(EVIDENCE / "visual-reconstruction-title.jpg"), type="jpeg", quality=86)

            page.set_viewport_size({"width": 1280, "height": 800})
            page.click("#btn-start", no_wait_after=True)
            page.wait_for_selector(".opening-case")
            opening_layout = [layout_snapshot(page, *viewport) for viewport in VIEWPORTS]
            assert_layout(opening_layout, "首日")
            if write_evidence:
                page.set_viewport_size({"width": 1280, "height": 800})
                page.screenshot(path=str(EVIDENCE / "visual-reconstruction-day.jpg"), type="jpeg", quality=86)

            action_count = 0
            while page.evaluate("window.__game.state().phase") != "choose_visit":
                assert action_count < 30, "首日未在预期步数内进入选院"
                assert click_forward(page), "首日流程没有可继续的控件"
                page.wait_for_timeout(4)
                action_count += 1

            page.set_viewport_size({"width": 1280, "height": 800})
            page.locator("[data-visit]:not(:disabled)").first.click(no_wait_after=True)
            page.wait_for_selector("[data-route-choice]")
            assert page.evaluate("window.__game.state().phase") == "visit"
            visit_layout = [
                layout_snapshot(page, "mobile", 390, 844),
                layout_snapshot(page, "desktop", 1280, 800),
            ]
            assert_layout(visit_layout, "夜访")
            if write_evidence:
                page.screenshot(path=str(EVIDENCE / "visual-reconstruction-night-visit.jpg"), type="jpeg", quality=86)

            page.locator("[data-route-choice]:not(:disabled)").first.click(no_wait_after=True)
            page.wait_for_selector("[data-route-story]")
            assert page.evaluate("window.__game.state().phase") == "route_aftermath"

            seen: dict[tuple[int, str, int], int] = {}
            while page.evaluate("window.__game.state().phase") != "ending":
                state = page.evaluate("window.__game.state()")
                signature = (state["day"], state["phase"], len(state["history"]))
                seen[signature] = seen.get(signature, 0) + 1
                assert seen[signature] <= 12, f"流程卡在 {signature}"
                assert action_count < 750, "快速烟测超过动作上限"
                assert click_forward(page), f"{signature} 没有可继续的控件"
                page.wait_for_timeout(2)
                action_count += 1

            ending = page.evaluate("window.__game.state()")
            assert ending["day"] == 20 and ending["ending"]["id"]
            page.set_viewport_size({"width": 1280, "height": 800})
            assert_layout([layout_snapshot(page, "desktop", 1280, 800)], "结局")
            if write_evidence:
                page.screenshot(path=str(EVIDENCE / "visual-reconstruction-ending.jpg"), type="jpeg", quality=86)

            old_seed = ending["seed"]
            page.locator("#btn-restart").click(timeout=5_000, no_wait_after=True)
            page.wait_for_selector(".opening-case")
            restarted = page.evaluate("window.__game.state()")
            assert restarted["day"] == 1 and restarted["phase"] == "opening"
            assert restarted["seed"] != old_seed
            browser.close()

        assert not console_errors, f"浏览器控制台错误：{console_errors}"
        assert not http_errors, f"HTTP 错误：{http_errors}"
        report = {
            "schemaVersion": 1,
            "runId": RUN_ID,
            "environment": {
                "candidate": "2026-09 标题与开场视觉重构候选",
                "runtimeDigestSha256": runtime_digest(),
                "browser": {"name": "Chromium", "version": browser_version},
                "testedRuntime": "临时本地 HTTP 服务 + Python Playwright",
                "seed": 42,
                "mode": "每屏第一项可行主动作的快速完整路径",
                "inputMode": "Playwright locator.click；不使用 force；DOM 只负责读取候选 selector",
                "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                "errors": {"console": console_errors, "http": http_errors},
                "limitations": LIMITATIONS,
            },
            "inputTrace": [
                "以 Playwright 点击确认年龄门并进入五院标题。",
                "点击进入首日，完成正堂选择与三拍后章，再真实进入吴月娘夜访并选择第一项路线回答。",
                f"继续以 Playwright locator.click 激活每屏第一项可见可行主动作；主流程动作计数 {action_count}。",
                "到达第二十日失稳结局后点击“换一套暗线”，确认新 seed 回到第一日正堂。",
            ],
            "observations": {
                "launch": {
                    "id": "age-gate-to-five-court-title",
                    "inputs": ["打开 seed=42", "点击我已成年"],
                    "state": {
                        "ageGateVisible": True,
                        "adultAssetRequestsBeforeConfirmation": 0,
                        "preAgeImageRequests": pre_age_images,
                        "titleVisible": True,
                        "titleCourtCount": 5,
                    },
                    "visual": "qa/evidence/visual-reconstruction-title.jpg",
                },
                "render": {
                    "id": "title-opening-night-ending-rendered",
                    "inputs": ["检查五档标题与首日", "检查移动端及桌面夜访", "检查桌面结局"],
                    "state": {
                        "titleViewports": title_layout,
                        "openingViewports": opening_layout,
                        "nightVisitViewports": visit_layout,
                        "endingViewport": {"width": 1280, "height": 800},
                        "horizontalOverflowCount": 0,
                        "mainPanelOverflowCount": 0,
                        "enabledControlsOutsideViewportCount": 0,
                    },
                    "visual": "qa/evidence/visual-reconstruction-day.jpg",
                },
                "input": {
                    "id": "visible-enabled-controls-accepted",
                    "inputs": ["Playwright locator.click", "不使用 force", "DOM 仅选择下一 locator"],
                    "state": {
                        "mainPathActionCount": action_count,
                        "openingChoiceAccepted": True,
                        "nightVisitAccepted": True,
                        "routeResultVisible": True,
                        "consoleErrors": console_errors,
                        "httpErrors": http_errors,
                    },
                    "visual": "qa/evidence/visual-reconstruction-night-visit.jpg",
                },
                "coreLoop": {
                    "id": "twenty-day-fast-path-complete",
                    "inputs": ["从第一日正堂持续选择每屏第一项可行主动作"],
                    "state": {"day": ending["day"], "phase": ending["phase"], "historyCount": len(ending["history"])},
                },
                "outcome": {
                    "id": "day-20-unstable-ending",
                    "inputs": ["完成第二十日最终选择并读取结局"],
                    "state": {
                        "terminal": "day-20-unstable-ending",
                        "day": ending["day"],
                        "phase": ending["phase"],
                        "endingId": ending["ending"]["id"],
                        "endingTitle": ending["ending"]["title"],
                    },
                    "visual": "qa/evidence/visual-reconstruction-ending.jpg",
                },
                "restart": {
                    "id": "new-seed-day-1-opening",
                    "inputs": ["点击换一套暗线"],
                    "state": {
                        "restart": "day-1-opening-new-seed",
                        "day": restarted["day"],
                        "phase": restarted["phase"],
                        "seedChanged": restarted["seed"] != old_seed,
                    },
                },
            },
        }
        return report
    finally:
        server.terminate()
        try:
            server.wait(timeout=2)
        except subprocess.TimeoutExpired:
            server.kill()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-evidence", action="store_true")
    args = parser.parse_args()
    if args.write_evidence:
        write_json_atomic(VERIFICATION, pending_verification())
    report = run(args.write_evidence)
    verification = {
        "schemaVersion": 3,
        "status": "PASS",
        "verify": {"command": VERIFY_COMMAND, "exitCode": 0},
        "completeRun": {
            "id": RUN_ID,
            "cleanContext": True,
            "terminal": "day-20-unstable-ending",
            "restart": "day-1-opening-new-seed",
            "evidence": "qa/evidence/run.json",
        },
        "checks": {key: "PASS" for key in ("launch", "render", "input", "coreLoop", "outcome", "restart")},
        "limitations": LIMITATIONS,
    }
    if args.write_evidence:
        write_json_atomic(RUN_EVIDENCE, report)
        write_json_atomic(VERIFICATION, verification)
    print(json.dumps({"checks": verification["checks"], "runId": RUN_ID}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
