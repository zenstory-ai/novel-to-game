#!/usr/bin/env python3
"""《风月总账》真实浏览器 QA：三条成人路线、闭环、场景册、重开与双视口。"""
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
URL = f"{BASE}/?seed=42&fast=1"
SHOTS = Path(os.environ.get("JPM_QA_SHOTS", "/tmp/jpm_qa"))
SAFE = SHOTS / "safe"
ADULT = SHOTS / "adult"
passed = failed = 0
errors: list[str] = []
network_errors: list[str] = []
http_errors: list[str] = []


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
    page.screenshot(path=str(folder / f"{name}.png"))


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


def choose_day(page, action="ledger", banquet="banquet_honor_yue") -> None:
    click(page, f'[data-day-action="{action}"]')
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
        ratio = close_box["width"] / stage_box["width"]
        check(0.55 <= ratio <= 0.72, f"人物近景占画面 55%–70%（{ratio:.2f}）")
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
    shutil.rmtree(SHOTS, ignore_errors=True)
    SAFE.mkdir(parents=True)
    ADULT.mkdir(parents=True)
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
            check(page.locator(".title-screen").count() == 1, "确认后进入标题")
            check("你是西门庆" in page.locator(".identity-line").inner_text(), "标题明确玩家是西门庆")
            check("今晚进谁的门" in page.locator(".title-subtitle").inner_text(), "第一屏给直接欲望与后果")
            shot(page, SAFE, "02_title")

            start_fresh(page, "respect_yue")
            check(state(page)["history"][0]["choice"] == "respect_yue", "首个有意义选择写入公开历史")
            frame_ms = page.evaluate("""async () => new Promise((resolve) => {
                const samples = [];
                let last = performance.now();
                const tick = (now) => {
                    samples.push(now - last);
                    last = now;
                    if (samples.length >= 24) resolve(samples.slice(2).reduce((a, b) => a + b, 0) / (samples.length - 2));
                    else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            })""")
            check(frame_ms <= 33.4, f"交互帧间隔达到 30 FPS 预算（{frame_ms:.1f} ms）")
            shot(page, SAFE, "03_opening_choice_done")

            section("月娘专一完整路径")
            routes = [
                "yue_share_shortfall", "yue_show_accounts", "yue_keep_word",
                "yue_ask_backing", "yue_offer_seat", "yue_share_keys",
            ]
            for day_num, route in enumerate(routes, start=1):
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
            check(phase(page) == "ending", "6 日完整流程到达结算")
            check(page.locator("#ending-view").get_attribute("data-ending") == "exclusive", "专一深线结算可观察")
            check("共掌一宅" in page.locator(".ending-tag").inner_text(), "结算回读月娘理解型结果")
            shot(page, SAFE, "07_exclusive_ending")

            section("场景册与重开")
            click(page, "#btn-gallery")
            check(page.locator("#gallery-modal").count() == 1, "场景册可打开")
            check(page.locator(".gallery-card.unlocked").count() == 3, "月娘两页 + 宴席一页已解锁")
            shot(page, SAFE, "08_gallery_after_yue")
            before_replay = state(page)
            click(page, '[data-gallery-open="yue_prelude"]')
            check(page.locator("#gallery-replay").get_attribute("data-replay-scene") == "yue_prelude", "已解锁册页可以全屏重看")
            check(page.locator("#gallery-replay-image").evaluate("e => e.naturalWidth > 1000"), "重看使用真实关键 CG")
            shot(page, ADULT, "gallery_replay_yue_prelude")
            page.keyboard.press("Escape")
            check(page.locator("#gallery-replay").count() == 0 and page.locator("#gallery-modal").count() == 1, "Escape 只收回重看册页")
            check(state(page) == before_replay, "重看不重复改变周目状态")
            click(page, "#btn-gallery-close")
            click(page, "#btn-restart")
            check(state(page)["day"] == 1 and state(page)["phase"] == "opening", "重开清空周目")
            check(len(page.evaluate("__game.gallery()")) == 3, "重开不清永久场景册")

            section("真实拒绝路径")
            click(page, '[data-opening="respect_yue"]')
            choose_day(page, "ledger")
            click(page, '[data-visit="li_pinger"]')
            click(page, '[data-route-choice="pinger_ask_money"]')
            check(page.locator('[data-night="explicit"][disabled]').count() == 1, "只取钱会得到人物化的关系终段拒绝")
            unlocked_before_leave = list(state(page)["unlocked"])
            click(page, '[data-night="leave"]')
            check(phase(page) == "morning", "玩家实际选择“到此为止”后流程继续")
            check(state(page)["unlocked"] == unlocked_before_leave, "拒绝路径不误解锁成人册页")
            check(state(page)["history"][-1]["type"] == "night" and state(page)["history"][-1]["action"] == "leave", "拒绝选择写入关系历史")

            section("金莲路线与可追溯嫉妒")
            page.evaluate("__game.restart()")
            page.wait_for_timeout(80)
            click(page, '[data-opening="tease_pan"]')
            choose_day(page, "ledger")
            route_night(page, "pan_jinlian", "pan_take_cup", "prelude", "pan_prelude")
            resolve_morning(page, "explain")
            choose_day(page, "listen")
            check(state(page)["selectedDayAction"] == "listen", "白天探话成为金莲当夜关系终段筹码")
            route_night(page, "pan_jinlian", "pan_take_clue", "explicit", "pan_explicit")
            check("pan_explicit" in state(page)["unlocked"], "金莲关系终段由承诺、情与欲解锁")
            check(state(page)["morning"]["id"] == "pan_claim", "金莲次晨主动来收公开承诺")
            check("人前" in state(page)["morning"]["text"], "金莲把昨夜选择带回公开关系")
            resolve_morning(page, "explain")
            choose_day(page, "listen")
            route_night(page, "pan_jinlian", "pan_bring_confrontation", "talk")
            check(state(page)["morning"]["id"] == "jealousy", "高妒关系在下一次晨升级为敲门")
            check("花园角门" in state(page)["morning"]["text"], "嫉妒说明具体可见行为")
            shot(page, SAFE, "09_jealousy_chain")

            section("瓶儿路线与白天反哺")
            page.evaluate("__game.restart()")
            click(page, '[data-opening="respect_yue"]')
            choose_day(page, "ledger")
            route_night(page, "li_pinger", "pinger_settle_room", "talk")
            resolve_morning(page, "explain")
            choose_day(page, "ledger")
            route_night(page, "li_pinger", "pinger_protect_books", "prelude", "pinger_prelude")
            resolve_morning(page, "explain")
            choose_day(page, "ledger")
            route_night(page, "li_pinger", "pinger_protect_public", "explicit", "pinger_explicit")
            check("pinger_explicit" in state(page)["unlocked"], "瓶儿关系终段由保护解锁")
            check(state(page)["morning"]["id"] == "pinger_help", "瓶儿次晨主动送来可用货路")
            check("merchant_route" in state(page)["secrets"], "瓶儿亲密后给出可解决经营的货路")
            check(len(page.evaluate("__game.gallery()")) == 7, "三人 6 张路线 CG + 1 张群体 CG 全入册")

            section("场景册隔离与新旧存档")
            page.evaluate("__game.restart()")
            click(page, "#btn-gallery")
            check(page.locator(".gallery-card.unlocked").count() == 7, "重开后 7 页仍保留")
            check(page.locator(".gallery-card.locked").count() == 0, "已解锁页不再显示剪影")
            click(page, "#btn-gallery-close")
            page.evaluate("localStorage.setItem('jpm_save_v1', JSON.stringify({version:2,player:{name:'孟玉楼'}}))")
            check(state(page)["version"] == 3, "旧孟玉楼存档键不污染新周目")

            section("双视口、键盘与资源")
            for width, height in [(1280, 800), (1920, 1080)]:
                page.set_viewport_size({"width": width, "height": height})
                box = page.locator("#game-shell").bounding_box()
                check(bool(box and box["x"] >= 0 and box["y"] >= 0 and box["width"] <= width and box["height"] <= height), f"{width}×{height} 主界面不溢出")
                for selector in [".relation-rail", "#phase-stage", ".topbar"]:
                    node = page.locator(selector).bounding_box()
                    check(bool(node and node["width"] > 100 and node["height"] > 40), f"{width}×{height} {selector} 可见")
                if width == 1280:
                    choice_font = float(page.locator(".choice-button b").first.evaluate("e => parseFloat(getComputedStyle(e).fontSize)"))
                    body_font = float(page.locator(".phase-header > p:last-child").first.evaluate("e => parseFloat(getComputedStyle(e).fontSize)"))
                    relation_font = float(page.locator(".relation-card p").first.evaluate("e => parseFloat(getComputedStyle(e).fontSize)"))
                    check(choice_font >= 13, f"最小视口功能标签字号达标（{choice_font:.0f}px）")
                    check(body_font >= 14, f"最小视口正文字号达标（{body_font:.0f}px）")
                    check(relation_font >= 12, f"最小视口人物原因字号达标（{relation_font:.0f}px）")
            glyphs = page.locator(".shape-mark").all_inner_texts()
            check(len(glyphs) == 3 and len(set(glyphs)) == 3, "三条人物色带同时有文字与形状冗余")
            page.keyboard.press("Tab")
            focused = page.evaluate("document.activeElement && document.activeElement.tagName")
            check(focused == "BUTTON", "核心控件可用 Tab 聚焦")
            check(page.evaluate("__game.assets().missingCritical.length") == 0, "发布模式 7 张关键 CG 零缺失")
            check(not network_errors and not http_errors, "关键资源请求零失败")
            check(not errors, "浏览器控制台 0 未处理异常")
            click(page, "#btn-mute")
            check(page.evaluate("localStorage.getItem('jpm_mute')") == "1", "静音按钮写入持久状态")
            persistence_page = context.new_page()
            persistence_page.goto(URL, wait_until="networkidle")
            check(persistence_page.evaluate("localStorage.getItem('jpm_mute')") == "1", "新页面仍读取静音状态")
            persistence_page.close()
            click(page, "#btn-mute")

            section("发布模式缺图失败")
            broken = browser.new_context(viewport={"width": 1280, "height": 800})
            broken_page = broken.new_page()
            broken_page.route("**/assets/cg/pinger/explicit.webp", lambda route: route.abort())
            broken_page.goto(URL, wait_until="networkidle")
            check(broken_page.locator("#asset-error").count() == 1, "缺任一关键 CG 时拒绝灰盒上线")
            broken.close()

            section("reduce-motion")
            reduced = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
            reduced_page = reduced.new_page()
            reduced_page.goto(URL, wait_until="networkidle")
            reduced_page.evaluate("sessionStorage.setItem('jpm_fengyue_age_session','yes')")
            reduced_page.reload(wait_until="networkidle")
            reduced_page.click("#btn-start")
            duration = reduced_page.locator(".heroine-figure").first.evaluate("e => getComputedStyle(e).animationDuration")
            check(duration in ("0.001ms", "1e-06s", "0s"), "prefers-reduced-motion 关闭持续动效")
            reduced.close()

            section("安全截图隔离")
            safe_names = {p.name for p in SAFE.glob("*.png")}
            adult_names = {p.name for p in ADULT.glob("*.png")}
            check(safe_names.isdisjoint(adult_names), "安全与 18+ 导出文件名清单互不重叠")
            readme = (ROOT.parents[3] / "README.md").read_text(encoding="utf-8")
            check(not any(name in readme for name in ["yue_explicit.webp", "pan_explicit.webp", "pinger_explicit.webp", "/tmp/jpm_qa/adult"]), "README 未嵌入 18+ 路线资产或内部证据")

            context.close()
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=3)

    evidence = {
        "url": URL,
        "passed": passed,
        "failed": failed,
        "console_errors": errors,
        "network_errors": network_errors,
        "http_errors": http_errors,
        "performance": {
            "local_load_ms": round(load_ms, 1),
            "average_frame_interval_ms": round(frame_ms, 1),
        },
        "safe_screenshots": sorted(p.name for p in SAFE.glob("*.png")),
        "adult_screenshots": sorted(p.name for p in ADULT.glob("*.png")),
    }
    (SHOTS / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n控制台错误: {len(errors)}；资源失败: {len(network_errors)}")
    print(f"结果: {passed} 通过, {failed} 失败；证据 → {SHOTS}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
