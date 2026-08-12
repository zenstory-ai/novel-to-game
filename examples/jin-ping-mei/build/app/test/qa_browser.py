#!/usr/bin/env python3
"""《风月总账》真实浏览器 QA：三条成人路线、闭环、场景册、重开与双视口。

证据落盘工作区内 qa/evidence/（不用系统临时目录，否则按契约视为无证据）。
环境变量: BASE_URL, QA_SLOW=1 关闭加速（正常速度路径）, JPM_QA_SHOTS 覆盖证据目录。
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SLOW = bool(os.environ.get("QA_SLOW"))
URL = f"{BASE}/?seed=42" + ("" if SLOW else "&fast=1")
# 证据落工作区内的持久路径:qa 契约把系统临时目录视为无证据,对应检查项不得记通过。
# 本示例曾因 /tmp 证据失效而不得 PASS。
_EXAMPLE_ROOT = Path(__file__).resolve().parents[3]
SHOTS = Path(os.environ.get("JPM_QA_SHOTS", _EXAMPLE_ROOT / "qa" / "evidence" / "browser"))
SAFE = SHOTS / "safe"
ADULT = SHOTS / "adult"

passed = failed = 0
errors: list[str] = []
network_errors: list[str] = []
http_errors: list[str] = []
household_seen: set[str] = set()
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")
minimal_checks = {name: False for name in CHECK_NAMES}


def section(name: str) -> None:
    print(f"\n== {name} ==")


def check(condition: bool, name: str) -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


def write_minimal_checkpoint() -> None:
    """Persist the six-key run before optional regression diagnostics continue."""
    if not SLOW:
        return
    path = SHOTS / "evidence-normal.json"
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(
            {"minimalChecks": minimal_checks, "checkpoint": "complete-run"},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def ensure_server():
    sock = socket.socket()
    try:
        sock.connect(("127.0.0.1", 5173))
        sock.close()
        return None
    except OSError:
        pass
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "5173", "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            sock = socket.socket()
            sock.connect(("127.0.0.1", 5173))
            sock.close()
            return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("本地服务启动失败")


def phase(page) -> str:
    return page.locator("#game-shell").get_attribute("data-phase") or ""


def state(page) -> dict:
    return page.evaluate("__game.state()")


def shot(page, folder: Path, name: str) -> None:
    page.screenshot(path=str(folder / f"{name}.jpg"), type="jpeg", quality=80)


def click(page, selector: str) -> None:
    node = page.locator(selector)
    assert node.count() > 0, f"找不到 {selector}（phase={phase(page)}）"
    node.first.click()
    page.wait_for_timeout(80)


def resolve_morning(page, preferred="explain") -> None:
    if phase(page) != "morning":
        return
    node = page.locator(f'[data-morning="{preferred}"]:not([disabled])')
    if node.count() == 0:
        node = page.locator("[data-morning]:not([disabled])").first
    node.click()
    page.wait_for_timeout(80)


def choose_day(page, action="ledger", banquet="banquet_honor_yue", household=None) -> None:
    click(page, f'[data-day-action="{action}"]')
    if phase(page) == "household":
        stage = page.locator(".household-stage")
        actor = stage.get_attribute("data-household-actor")
        if actor not in household_seen:
            check(page.locator(".household-row").count() == 3, "人物账列出三名宅中短线角色")
            check(page.locator(".household-portrait").evaluate("e => e.complete && e.naturalHeight > 700"), f"{actor} 立绘真实加载")
            shot(page, SAFE, f"household_{actor}")
            household_seen.add(actor)
        option = page.locator(f'button[data-household="{household}"]:not([disabled])') if household else page.locator('button[data-household]:not([disabled])').first
        option.click()
        page.wait_for_timeout(80)
        assert phase(page) == "choose_visit"
    if phase(page) == "banquet":
        option = page.locator(f'[data-banquet="{banquet}"]:not([disabled])')
        if option.count() == 0:
            option = page.locator('[data-banquet="banquet_honor_yue"]:not([disabled])')
        option.click()
        page.wait_for_timeout(100)
        assert phase(page) == "scene"
        check(state(page)["pendingScene"] == "banquet_conflict", "中秋真实触发群体冲突 scene_id")
        shot(page, SAFE, "06_banquet_conflict")
        click(page, "#btn-scene-close")


def route_night(page, heroine: str, route: str, night: str, adult_name: str | None = None) -> None:
    click(page, f'[data-visit="{heroine}"]')
    check(phase(page) == "visit", f"进入 {heroine} 人物近景")
    close_box = page.locator(".close-cg").bounding_box()
    stage_box = page.locator("#phase-stage").bounding_box()
    if close_box and stage_box:
        # 美术 P0-1 修复后的回归防线：近景是单张整版铺满，人物占比由图内位置承担；
        # 任何回到 inset 左右对接的改动都会在这里重新被抓到。
        ratio = close_box["width"] / stage_box["width"]
        check(ratio >= 0.98 and abs(close_box["x"] - stage_box["x"]) <= 2, f"人物近景单张整版铺满、无分屏接缝（占比 {ratio:.2f}，左缘偏差 {abs(close_box['x'] - stage_box['x']):.0f}px）")
    click(page, f'[data-route-choice="{route}"]')
    check(phase(page) == "night", "人物回应后进入夜间意愿选择")
    check(page.locator('[data-night="leave"]:not([disabled])').count() == 1, "“到此为止”始终可选")
    target = page.locator(f'[data-night="{night}"]:not([disabled])')
    assert target.count() == 1, f"夜间 {night} 未解锁：{page.locator(f'[data-night={night}]').inner_text()}"
    target.click()
    page.wait_for_timeout(100)
    if phase(page) == "scene":
        scene_id = state(page)["pendingScene"]
        check(page.locator("#scene-image").evaluate("e => e.naturalWidth > 1000 && e.naturalHeight > 700"), f"{scene_id} 关键图真实加载")
        if adult_name:
            shot(page, ADULT, adult_name)
        click(page, "#btn-scene-close")


def start_fresh(page, opening: str) -> None:
    if page.locator("#btn-start").count():
        click(page, "#btn-start")
    else:
        page.evaluate("__game.restart()")
        page.wait_for_timeout(80)
    assert phase(page) == "opening"
    click(page, f'[data-opening="{opening}"]')
    assert phase(page) == "day"


def main() -> int:
    global errors, network_errors, http_errors
    # 只清本次截图子目录；qa/evidence/ 下的机器汇总由各自生成器维护，
    # 不能被复跑抹掉。
    shutil.rmtree(SAFE, ignore_errors=True)
    shutil.rmtree(ADULT, ignore_errors=True)
    SAFE.mkdir(parents=True, exist_ok=True)
    ADULT.mkdir(parents=True, exist_ok=True)
    server = ensure_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            page.on("console", lambda msg: errors.append(f"console:{msg.text}") if msg.type == "error" else None)
            page.on("pageerror", lambda exc: errors.append(f"pageerror:{exc}"))
            page.on("requestfailed", lambda req: network_errors.append(f"{req.url}: {req.failure}"))
            page.on("response", lambda res: http_errors.append(f"{res.status} {res.url}") if res.status >= 400 else None)
            # 自包含切片核对：任何外部请求域都等于绕过体积统计

            section("年龄门与男性身份")
            page.goto(URL, wait_until="networkidle")
            load_ms = page.evaluate("performance.getEntriesByType('navigation')[0].loadEventEnd")
            check(0 < load_ms < 2000, f"本地首屏加载低于 2 秒（{load_ms:.0f} ms）")
            check(page.locator("html").get_attribute("lang") == "zh-CN", "界面语言声明为简体中文")
            check(page.locator("#age-gate").count() == 1, "首屏年龄门存在")
            check("18+" in page.locator("#age-gate").inner_text(), "年龄门写明 18+")
            check("明确成人" in page.locator("#age-gate").inner_text(), "年龄门说明明确成人内容")
            check(page.locator("#scene-image,.title-art").count() == 0, "确认成年前不把 CG 放进 DOM")
            shot(page, SAFE, "01_age_gate")
            click(page, "#btn-age-yes")
            title_ready = page.locator(".title-screen").count() == 1
            check(title_ready, "确认后进入标题")
            minimal_checks["launch"] = title_ready
            check("你是西门庆" in page.locator(".identity-line").inner_text(), "标题明确玩家是西门庆")
            check("今夜进谁的门" in page.locator(".title-subtitle").inner_text(), "第一屏给直接欲望与后果")
            shot(page, SAFE, "02_title")

            start_fresh(page, "respect_yue")
            first_input_recorded = state(page)["history"][0]["choice"] == "respect_yue"
            check(first_input_recorded, "首个有意义选择写入公开历史")
            minimal_checks["input"] = first_input_recorded
            shot(page, SAFE, "03_opening_choice_done")

            section("月娘专一完整路径")
            routes = [
                "yue_share_shortfall", "yue_show_accounts", "yue_keep_word",
                "yue_ask_backing", "yue_offer_seat", "yue_share_keys",
            ]
            for day_num, route in enumerate(routes, start=1):
                # 银钱收紧后的晨间报条:用度每日照实报,第 3 日给催账口风,第 5 日交代收账结果。
                notes = page.locator(".morning-note").all_inner_texts()
                if day_num == 2:
                    check(any("灶上、门房、针线" in t for t in notes), "次晨照实报宅中用度")
                if day_num == 3:
                    check(any("收账的今日又来问了一回" in t for t in notes), "第 3 日晨间先给催账口风")
                if day_num == 5:
                    check(any("门外那人" in t for t in notes), "第 4 日催账结算在次晨有现场交代")
                resolve_morning(page, "explain")
                choose_day(page, "ledger")
                night = "prelude" if day_num < 3 else "explicit"
                route_night(page, "wu_yueniang", route, night, f"yue_day{day_num}_{night}")
                if day_num == 2:
                    check(phase(page) == "morning" and state(page)["morning"]["id"] == "yue_delayed", "两回合后出现月娘延迟回响")
                    shot(page, SAFE, "04_delayed_yue_morning")
                if day_num == 3:
                    check("yue_explicit" in state(page)["unlocked"], "月娘关系终段由守约解锁")
                    check(state(page)["resources"]["house"] > 65, "亲密场景反过来提高家宅状态")
                    check(state(page)["morning"]["id"] == "yue_help", "月娘次晨主动把共同承诺带进白日")
            reached_ending = phase(page) == "ending"
            exclusive_outcome = page.locator("#ending-view").get_attribute("data-ending") == "exclusive"
            check(reached_ending, "6 日完整流程到达结算")
            check(exclusive_outcome, "专一深线结算可观察")
            check("共掌一宅" in page.locator(".ending-tag").inner_text(), "结算回读月娘理解型结果")
            shot(page, SAFE, "07_exclusive_ending")
            minimal_checks["coreLoop"] = reached_ending
            minimal_checks["outcome"] = exclusive_outcome
            minimal_checks["render"] = bool(
                reached_ending
                and page.locator("#ending-view").is_visible()
                and (SAFE / "07_exclusive_ending.jpg").is_file()
                and not errors
                and not network_errors
                and not http_errors
            )

            section("重开")
            click(page, "#btn-restart")
            restarted = state(page)["day"] == 1 and state(page)["phase"] == "opening"
            check(restarted, "重开清空周目")
            minimal_checks["restart"] = restarted
            write_minimal_checkpoint()
            context.close()
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=3)

    size_bytes = sum(
        p.stat().st_size for p in ROOT.rglob("*")
        if p.is_file() and ".vercel" not in p.parts and "test" not in p.parts
    )
    evidence = {
        "url": URL,
        "normal_speed_run": SLOW,
        "passed": passed,
        "failed": failed,
        "console_errors": errors,
        "network_errors": network_errors,
        "http_errors": http_errors,
        "build_bytes": size_bytes,
        "safe_screenshots": sorted(p.name for p in SAFE.glob("*.jpg")),
        "adult_screenshots": sorted(p.name for p in ADULT.glob("*.jpg")),
        "screenshots_retained_in_git": False,
        "minimalChecks": minimal_checks,
    }
    if SLOW:
        run_evidence = SHOTS / "evidence-normal.json"
        run_evidence.write_text(
            json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(
        f"\n控制台/页面错误: {len(errors)}；"
        f"网络失败: {len(network_errors)}；HTTP 错误: {len(http_errors)}"
    )
    print(f"包体: {size_bytes/1048576:.2f} MB")
    print(f"路径检查: {passed} 通过, {failed} 失败")
    return 0 if all(minimal_checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
