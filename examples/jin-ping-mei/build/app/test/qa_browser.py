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
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SLOW = bool(os.environ.get("QA_SLOW"))
URL = f"{BASE}/?seed=42" + ("" if SLOW else "&fast=1")
# 证据落工作区内的持久路径:qa 契约把系统临时目录视为无证据,对应检查项不得记通过。
# 本示例上一轮复审正是因为 /tmp 证据失效而不得 PASS。
_EXAMPLE_ROOT = Path(__file__).resolve().parents[3]
SHOTS = Path(os.environ.get("JPM_QA_SHOTS", _EXAMPLE_ROOT / "qa" / "evidence" / "browser"))
SAFE = SHOTS / "safe"
ADULT = SHOTS / "adult"

# 转场延迟预算：一次交互到画面落定 ≤ 200 ms 才不被感知为卡；长任务绝对门 200 ms（契约）
TRANSITION_BUDGET_MS = 200.0
STALL_MS = 200.0

passed = failed = 0
errors: list[str] = []
network_errors: list[str] = []
http_errors: list[str] = []
household_seen: set[str] = set()
perf: dict[str, dict] = {}
request_hosts: set[str] = set()
longtasks: list[int] = []


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
    page.screenshot(path=str(folder / f"{name}.jpg"), type="jpeg", quality=80)


def check_scaled_age_gate(page, label: str) -> None:
    viewport_width = page.evaluate("innerWidth")
    viewport_height = page.evaluate("innerHeight")
    frame = page.locator("#age-gate").evaluate(
        """e => {
          const style = getComputedStyle(e, '::before');
          return {width: parseFloat(style.width), height: parseFloat(style.height)};
        }"""
    )
    frame_left = (viewport_width - frame["width"]) / 2
    frame_top = (viewport_height - frame["height"]) / 2
    selectors = [
        ".age-gate .age-seal",
        ".age-gate .eyebrow",
        ".age-gate h1",
        ".age-gate p:not(.eyebrow)",
        ".age-gate .button-row",
        "#btn-age-yes",
        "#btn-age-no",
    ]
    for selector in selectors:
        box = page.locator(selector).bounding_box()
        in_viewport = bool(
            box
            and box["x"] >= 0
            and box["x"] + box["width"] <= viewport_width
            and box["y"] >= 0
            and box["y"] + box["height"] <= viewport_height
        )
        in_frame = bool(
            box
            and box["x"] >= frame_left
            and box["x"] + box["width"] <= frame_left + frame["width"]
            and box["y"] >= frame_top
            and box["y"] + box["height"] <= frame_top + frame["height"]
        )
        check(in_viewport, f"{label} 200% 文字缩放时 {selector} 不越出视口")
        check(in_frame, f"{label} 200% 文字缩放时 {selector} 不越出装饰框")
    body_copy = page.locator(".age-gate p:not(.eyebrow)")
    body_box = body_copy.bounding_box()
    check(
        bool(
            body_box
            and body_box["x"] >= viewport_width * 0.15
            and body_box["x"] + body_box["width"] <= viewport_width * 0.85
        ),
        f"{label} 200% 文字缩放时年龄说明仍留在安全边距内",
    )
    check(
        body_copy.evaluate("e => e.scrollWidth <= e.clientWidth"),
        f"{label} 200% 文字缩放时年龄说明内部无横向溢出",
    )
    # 印章是年龄门里唯一可压缩的 flex 子项。只断言 bounding box 不越界的话，"不溢出"可以靠把
    # 印章压成矩形买到——那不是修好了布局，是把失败挪到了看不见的地方。
    seal = page.locator(".age-gate .age-seal").bounding_box()
    check(
        bool(seal and abs(seal["width"] - seal["height"]) <= max(2.0, seal["width"] * 0.06)),
        f"{label} 200% 文字缩放时 18+ 印章未被压扁（{seal['width']:.1f}×{seal['height']:.1f}）" if seal else f"{label} 200% 文字缩放时 18+ 印章可测量",
    )


# 本作是纯 DOM/CSS 视觉小说：全项目零 requestAnimationFrame、零 canvas，没有逐帧渲染循环。
# 采 rAF 间隔只会量到浏览器空闲垂直同步节拍（headless 恒为 ~8.3 ms），无论画面轻重都一样，
# 因此帧率数字对本作**不构成**性能结论。真正会被玩家感知的是一次转场里主线程被阻塞多久，
# 用 longtask（>50 ms 主线程占用）直接观测，并测「点击→下一次绘制完成」的转场延迟。
LONGTASK_INIT = """
window.__longtasks = [];
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longtasks.push({
      ms: Math.round(e.duration),
      at: Math.round(e.startTime),            // 距本次导航的毫秒数，用于归因启动 vs 游戏中
      phase: (document.querySelector('#game-shell') || {}).dataset?.phase || '?',
    });
  }).observe({ entryTypes: ['longtask'] });
} catch (err) { window.__longtasks = null; }
"""


def transition_latency(page, label: str, selector: str) -> float | None:
    """在页内测「点击 selector → 下一次绘制完成」的毫秒数（不含 CDP 往返开销）。"""
    ms = page.evaluate(
        """async (sel) => {
            const node = document.querySelector(sel);
            if (!node) return null;
            const t0 = performance.now();
            node.click();
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return performance.now() - t0;
        }""",
        selector,
    )
    if ms is not None:
        perf[label] = {"transition_to_paint_ms": round(ms, 2)}
        print(f"  转场延迟 {label}: {ms:.1f} ms")
    return ms


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
        # 转场延迟测在本作最重的真实状态：关闭群体冲突场景册（群像 CG 卸载 + 回到日程盘），
        # 不是标题页或静止对白屏。
        if "banquet_conflict_close" not in perf:
            transition_latency(page, "banquet_conflict_close", "#btn-scene-close")
            page.wait_for_timeout(80)
        else:
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
            page.on("request", lambda req: request_hosts.add(urlparse(req.url).netloc))
            page.add_init_script(LONGTASK_INIT)

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
            page.evaluate("document.documentElement.style.fontSize = '200%'")
            page.wait_for_timeout(80)
            check_scaled_age_gate(page, "1280×800")
            shot(page, SAFE, "01_age_gate_200pct_text")
            page.set_viewport_size({"width": 1920, "height": 1080})
            page.wait_for_timeout(80)
            check_scaled_age_gate(page, "1920×1080")
            page.set_viewport_size({"width": 1280, "height": 800})
            page.evaluate("document.documentElement.style.fontSize = ''")
            page.wait_for_timeout(80)
            click(page, "#btn-age-yes")
            check(page.locator(".title-screen").count() == 1, "确认后进入标题")
            check("你是西门庆" in page.locator(".identity-line").inner_text(), "标题明确玩家是西门庆")
            check("今夜进谁的门" in page.locator(".title-subtitle").inner_text(), "第一屏给直接欲望与后果")
            shot(page, SAFE, "02_title")

            start_fresh(page, "respect_yue")
            check(state(page)["history"][0]["choice"] == "respect_yue", "首个有意义选择写入公开历史")
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
            check("日头" in state(page)["morning"]["text"], "金莲把昨夜选择带回白日")
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
            check(state(page)["version"] == 6, "旧孟玉楼存档键不污染新周目")

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
            check(page.evaluate("__game.assets().missingCritical.length") == 0, "发布模式 11 张关键视觉零缺失")
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
            broken_page.route("**/assets/cg/group/title_three.webp", lambda route: route.abort())
            broken_page.route("**/assets/heroine/yue/night.webp", lambda route: route.abort())
            broken_page.goto(URL, wait_until="networkidle")
            missing = broken_page.evaluate("__game.assets().missingCritical")
            check(
                broken_page.locator("#asset-error").count() == 1
                and {"cover", "heroine/yue/close"}.issubset(set(missing)),
                "首屏或人物近景缺图时拒绝进入残缺游戏",
            )
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
            safe_names = {p.name for p in SAFE.glob("*.jpg")}
            adult_names = {p.name for p in ADULT.glob("*.jpg")}
            check(safe_names.isdisjoint(adult_names), "安全与 18+ 导出文件名清单互不重叠")
            readme = (ROOT.parents[3] / "README.md").read_text(encoding="utf-8")
            check(not any(name in readme for name in ["yue_explicit.webp", "pan_explicit.webp", "pinger_explicit.webp", "qa/evidence/browser/adult"]), "README 未嵌入 18+ 路线资产或内部证据")

            longtasks.extend(page.evaluate("window.__longtasks || []") or [])

            context.close()
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=3)

    # ---- 性能与自包含结论（独立于实现方自测，写进 QA_REPORT 环境表）----
    local = {urlparse(BASE).netloc, ""}
    external = sorted(h for h in request_hosts if h not in local)
    check(not external, f"无外部请求域（实测 {sorted(request_hosts)}）")
    check(bool(perf), "已在最重真实状态（群体冲突场景册转场）实测延迟")
    worst_transition = max(
        (v["transition_to_paint_ms"] for v in perf.values() if "transition_to_paint_ms" in v),
        default=0.0,
    )
    check(worst_transition <= TRANSITION_BUDGET_MS,
          f"最重转场 点击→绘制 {worst_transition} ms ≤ {TRANSITION_BUDGET_MS} ms")
    # 长任务按归因分档：启动期（年龄门/首屏，玩家还没进入游戏）与游戏中（玩家正在操作时的
    # 主线程阻塞，才是真卡顿）。用观察器已记录的 phase 归因，不用挂钟时间——挂钟阈值会随
    # 测试自身新增的步骤漂移，把真实的游戏中卡顿挪进"启动期"豁免里。
    boot = [t for t in longtasks if t["phase"] == "?"]
    ingame = [t for t in longtasks if t["phase"] != "?"]
    worst_boot = max((t["ms"] for t in boot), default=0)
    worst_ingame = max((t["ms"] for t in ingame), default=0)
    if boot:
        print(f"  启动期长任务: {sorted((t['ms'] for t in boot), reverse=True)}（年龄门/首屏，玩家尚未进入游戏）")
    check(worst_ingame < STALL_MS,
          f"游戏中无 >{STALL_MS:.0f} ms 主线程长任务（最坏 {worst_ingame} ms，共 {len(ingame)} 次 >50 ms）")

    size_bytes = sum(
        p.stat().st_size for p in ROOT.rglob("*")
        if p.is_file() and ".vercel" not in p.parts and "test" not in p.parts
    )
    evidence = {
        "url": URL,
        "normal_speed_run": SLOW,
        "viewports": ["1280x800", "1920x1080"],
        "scaled_age_gate_viewports": ["1280x800@200%-text", "1920x1080@200%-text"],
        "passed": passed,
        "failed": failed,
        "console_errors": errors,
        "network_errors": network_errors,
        "http_errors": http_errors,
        "performance": {
            "note": "纯 DOM/CSS，无 rAF 渲染循环；帧率对本作无意义，改测转场延迟与主线程长任务",
            "local_load_ms": round(load_ms, 1),
            "transitions": perf,
            "transition_budget_ms": TRANSITION_BUDGET_MS,
            "longtasks_over_50ms": sorted(longtasks, key=lambda t: -t["ms"]),
            "stall_gate_ms": STALL_MS,
            "build_bytes": size_bytes,
        },
        "request_hosts": sorted(request_hosts),
        "external_hosts": external,
        "safe_screenshots": sorted(p.name for p in SAFE.glob("*.jpg")),
        "adult_screenshots": sorted(p.name for p in ADULT.glob("*.jpg")),
        "screenshots_retained_in_git": False,
    }
    if SLOW:
        run_evidence = SHOTS / "evidence-normal.json"
        run_evidence.write_text(
            json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"\n控制台错误: {len(errors)}；资源失败: {len(network_errors)}")
    print(f"包体: {size_bytes/1048576:.2f} MB；外部域: {external or '无'}")
    print(f"结果: {passed} 通过, {failed} 失败")
    if not SLOW:
        print("提示: 本轮为加速路径，时序证据无效（qa-contract《首次上手》）；"
              "正常速度完整路径须以 QA_SLOW=1 复跑一次，秒级节拍写回 QA_REPORT。")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
