#!/usr/bin/env python3
"""真实无头 Chromium 音频与设置面板端到端验证。

覆盖：
1. 标题画面首点解锁 + 设置面板实时控制 BGM 开关、SFX 开关、音量滑块、总静音。
2. 静音状态下从标题进入大地图（不偷跑 BGM，且拦截音效）。
3. 局内设置修改音量/开关后刷新重载：设置不丢失；首点「接着西行」同时触发 unlock(title) 与切到 overworld 时严格单轨（无 title/overworld 叠音）。
4. 大地图切入第一场剧情战（overworld -> battle）：严格单轨（unpausedTracks == 1），旧轨彻底停止。
5. 返回标题并重新开局（restart）：音频设置保留，390px 窄屏设置面板无横向溢出，全程零控制台/页面/请求错误。
"""
from __future__ import annotations

import functools
import http.server
import json
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]


def start_server() -> tuple[http.server.ThreadingHTTPServer, int]:
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):  # noqa: A002
            pass

    handler = functools.partial(QuietHandler, directory=str(APP))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, port


def snap(page) -> dict:
    return page.evaluate("window.xiyou.snapshot()")


def assert_eq(actual, expected, msg: str):
    if actual != expected:
        raise AssertionError(f"{msg}: expected {expected!r}, got {actual!r}")


def assert_true(cond: bool, msg: str):
    if not cond:
        raise AssertionError(msg)


def clear_dialogues(page, max_steps: int = 40):
    for _ in range(max_steps):
        if page.locator('[data-ui="dialogue"]').count() > 0 and page.locator('[data-ui="dialogue"]').first.is_visible():
            page.keyboard.press("Space")
            page.wait_for_timeout(80)
        elif page.locator('[data-ui="chapter"]').count() > 0 and page.locator('[data-ui="chapter"]').first.is_visible():
            page.wait_for_timeout(200)
            page.keyboard.press("Space")
            page.wait_for_timeout(120)
        else:
            break


def set_range(page, selector: str, value: int):
    page.locator(selector).evaluate(
        """(el, v) => {
            el.value = String(v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }""",
        value,
    )


def run() -> dict:
    srv, port = start_server()
    base = f"http://127.0.0.1:{port}/?fast=1&seed=42"
    errors: list[str] = []
    report: dict[str, object] = {}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url}"))

            # 1. 标题画面冷启动 + 设置面板实时控制
            page.goto(base, wait_until="networkidle")
            page.wait_for_selector('[data-ui="title"]', timeout=15000)

            s0 = snap(page)["audio"]
            assert_eq(s0["wanted"], "title", "title wanted on boot")
            assert_eq(s0["unpausedTracks"], 0, "no autoplay before user gesture")

            # 点击设置：触发首次手势解锁并打开面板
            page.locator('[data-act="settings"]').click()
            page.wait_for_selector('[data-panel="settings"]', timeout=5000)
            page.wait_for_function("window.xiyou.snapshot().audio.unpausedTracks === 1", timeout=5000)
            page.wait_for_timeout(450)  # 让淡入完成

            s1 = snap(page)["audio"]
            assert_eq(s1["active"], "title", "title BGM active")
            assert_eq(s1["unpausedTracks"], 1, "strictly 1 track playing")
            assert_true(s1["musicGain"] > 0.3, f"expected musicGain > 0.3, got {s1['musicGain']}")
            assert_eq(page.locator('[data-set="musicOn"]').inner_text().strip(), "开", "musicOn label")
            assert_eq(page.locator('[data-set="soundOn"]').inner_text().strip(), "开", "soundOn label")
            assert_eq(page.locator('[data-set="mute"]').inner_text().strip(), "有声", "mute label")

            # 单独关闭音乐：立即归零且暂停，音效仍保持开启
            page.locator('[data-set="musicOn"]').click()
            page.wait_for_timeout(80)
            s_bgm_off = snap(page)["audio"]
            assert_eq(s_bgm_off["unpausedTracks"], 0, "BGM paused immediately on musicOn off")
            assert_eq(s_bgm_off["musicGain"], 0, "musicGain === 0 when musicOn off")
            assert_eq(s_bgm_off["musicEnabled"], False, "musicEnabled false")
            assert_eq(s_bgm_off["sfxEnabled"], True, "sfxEnabled stays true")
            assert_eq(page.locator('[data-set="musicOn"]').inner_text().strip(), "关", "musicOn label off")

            # 重新打开音乐：立即恢复
            page.locator('[data-set="musicOn"]').click()
            page.wait_for_function("window.xiyou.snapshot().audio.unpausedTracks === 1", timeout=5000)
            assert_eq(snap(page)["audio"]["active"], "title", "title resumes on musicOn on")

            # 单独关闭音效：sfxGain === 0，BGM 不受影响
            page.locator('[data-set="soundOn"]').click()
            page.wait_for_timeout(60)
            s_sfx_off = snap(page)["audio"]
            assert_eq(s_sfx_off["sfxEnabled"], False, "sfxEnabled false")
            assert_eq(s_sfx_off["sfxGain"], 0, "sfxGain === 0")
            assert_eq(s_sfx_off["unpausedTracks"], 1, "BGM stays playing when only SFX off")

            # 开启总静音：全部归零
            page.locator('[data-set="mute"]').click()
            page.wait_for_timeout(60)
            s_muted = snap(page)["audio"]
            assert_eq(s_muted["muted"], True, "global mute on")
            assert_eq(s_muted["unpausedTracks"], 0, "all BGM stopped on mute")
            assert_eq(s_muted["musicGain"], 0, "musicGain 0 on mute")
            assert_eq(s_muted["sfxGain"], 0, "sfxGain 0 on mute")
            assert_eq(page.locator('[data-set="mute"]').inner_text().strip(), "已静音", "mute text")
            assert_eq(page.locator('[data-set="musicOn"]').inner_text().strip(), "关", "music shows off while muted")
            assert_eq(page.locator('[data-set="soundOn"]').inner_text().strip(), "关", "sfx shows off while muted")

            blocked_before = s_muted["sfxBlockedCount"]
            page.locator('[data-panel="settings"] [data-act="close"]').click()

            # 2. 静音状态开新局进大地图：绝不偷跑 BGM，且拦下 SFX
            page.locator('[data-act="new"]').click()
            page.wait_for_selector('[data-ui="dialogue"]', timeout=15000)
            clear_dialogues(page)
            page.wait_for_function("window.xiyou.snapshot().world && window.xiyou.snapshot().world.mapReady && !window.xiyou.snapshot().world.busy", timeout=15000)

            s_world_muted = snap(page)["audio"]
            assert_eq(s_world_muted["wanted"], "overworld", "world wanted overworld")
            assert_eq(s_world_muted["unpausedTracks"], 0, "no BGM leak on title->world while muted")
            assert_eq(s_world_muted["musicGain"], 0, "musicGain stays 0 in world")
            assert_true(s_world_muted["sfxBlockedCount"] > blocked_before, "SFX blocked count grew while muted")

            # 3. 局内打开设置：UI 与实时状态一致 -> 取消静音并调节音量 -> 重载验证持久化 + 首点切轨不叠音
            page.locator('[data-icon="more"]').click()
            page.locator('[data-icon="settings"]').click()
            page.wait_for_selector('[data-panel="settings"]', timeout=5000)
            assert_eq(page.locator('[data-set="mute"]').inner_text().strip(), "已静音", "in-game panel reflects mute")

            page.locator('[data-set="mute"]').click()
            page.locator('[data-set="soundOn"]').click()
            set_range(page, '[data-set="music"]', 40)
            set_range(page, '[data-set="sound"]', 50)
            page.wait_for_function("window.xiyou.snapshot().audio.unpausedTracks === 1", timeout=5000)
            s_live = snap(page)["audio"]
            assert_eq(s_live["active"], "overworld", "overworld playing after unmute")
            assert_true(abs(s_live["musicVolume"] - 0.4) < 0.01, f"musicVolume 0.4, got {s_live['musicVolume']}")
            assert_true(abs(s_live["sfxVolume"] - 0.5) < 0.01, f"sfxVolume 0.5, got {s_live['sfxVolume']}")
            page.locator('[data-panel="settings"] [data-act="close"]').click()

            # 页面重载：测试「首次点击接着西行同时触发 unlock(title) + 进入 overworld」的经典叠音竞态
            page.reload(wait_until="networkidle")
            page.wait_for_selector('[data-ui="title"]', timeout=15000)
            page.locator('[data-act="continue"]').click()
            page.wait_for_function("window.xiyou.snapshot().world && window.xiyou.snapshot().world.mapReady", timeout=15000)
            page.wait_for_timeout(550)

            s_reload = snap(page)["audio"]
            assert_eq(s_reload["wanted"], "overworld", "after reload continue wanted overworld")
            assert_eq(s_reload["active"], "overworld", "after reload continue active overworld")
            assert_eq(s_reload["unpausedTracks"], 1, "strictly 1 unpaused track after title->overworld race")
            assert_eq(s_reload["activeTracks"], 1, "strictly 1 audible track after title->overworld race")
            if "title" in s_reload["tracks"]:
                assert_eq(s_reload["tracks"]["title"]["paused"], True, "title track must be paused after switch")
                assert_eq(s_reload["tracks"]["title"]["volume"], 0, "title track volume must be 0 after switch")
            assert_true(abs(s_reload["musicVolume"] - 0.4) < 0.01, "musicVolume persisted across reload")
            assert_true(abs(s_reload["sfxVolume"] - 0.5) < 0.01, "sfxVolume persisted across reload")

            # 4. 推进主线进入第一场战斗（overworld -> battle）：验证单轨切换与 SFX 正常播放
            # 点击主线追踪自动找土地 -> 问完土地 -> 追踪去翠云山找罗刹女开战
            page.locator('[data-ui="quests"] button').first.click()
            page.wait_for_selector('[data-ui="dialogue"]', timeout=15000)
            clear_dialogues(page)
            page.wait_for_function("window.xiyou.snapshot().world && !window.xiyou.snapshot().world.busy", timeout=10000)
            # 现在任务指向翠云山罗刹女，点主线追踪自动过阵并触发剧情战
            page.locator('[data-ui="quests"] button').first.click()
            # 等进入对话、章节卡或选择框，一路推到开战
            for _ in range(140):
                cur = snap(page)
                if cur["screen"] == "battle":
                    break
                choice_btn = page.locator('[data-ui^="choice-"] [data-key]')
                if choice_btn.count() > 0 and choice_btn.first.is_visible():
                    page.wait_for_function("() => !document.querySelector('[data-ui^=\"choice-\"][data-armed=\"0\"]')", timeout=5000)
                    choice_btn.first.click()
                elif page.locator('[data-ui="dialogue"]').count() > 0 and page.locator('[data-ui="dialogue"]').first.is_visible():
                    page.keyboard.press("Space")
                elif page.locator('[data-ui="chapter"]').count() > 0 and page.locator('[data-ui="chapter"]').first.is_visible():
                    page.keyboard.press("Space")
                page.wait_for_timeout(120)

            assert_eq(snap(page)["screen"], "battle", "reached first battle")
            page.wait_for_timeout(500)
            s_battle = snap(page)["audio"]
            assert_eq(s_battle["wanted"], "battle", "battle BGM wanted")
            assert_eq(s_battle["active"], "battle", "battle BGM active")
            assert_eq(s_battle["unpausedTracks"], 1, "strictly 1 track in battle")
            assert_eq(s_battle["tracks"]["overworld"]["paused"], True, "overworld stopped in battle")
            assert_eq(s_battle["tracks"]["battle"]["paused"], False, "battle playing")
            assert_true(s_battle["sfxPlayedCount"] > 0, "SFX played in battle/world")

            # 5. 窄屏移动端（390x844）检查设置面板排版 + 关闭音乐后重开新局保留设置
            mobile = browser.new_context(viewport={"width": 390, "height": 844})
            mpage = mobile.new_page()
            mpage.on("console", lambda m: errors.append(f"mobile.console.{m.type}: {m.text}") if m.type == "error" else None)
            mpage.on("pageerror", lambda e: errors.append(f"mobile.pageerror: {e}"))
            mpage.on("requestfailed", lambda r: errors.append(f"mobile.requestfailed: {r.url}"))

            mpage.goto(base, wait_until="networkidle")
            mpage.wait_for_selector('[data-ui="title"]', timeout=15000)
            mpage.locator('[data-act="settings"]').click()
            mpage.wait_for_selector('[data-panel="settings"]', timeout=5000)
            overflow = mpage.evaluate(
                "() => { const p = document.querySelector('[data-panel=\"settings\"] .panel'); return p.scrollWidth - p.clientWidth; }"
            )
            assert_true(overflow <= 1, f"mobile settings panel horizontal overflow: {overflow}px")
            # 关闭音乐，关闭面板，开新局，再返回标题、重新开局：音乐始终保持关闭
            mpage.locator('[data-set="musicOn"]').click()
            mpage.locator('[data-panel="settings"] [data-act="close"]').click()
            mpage.locator('[data-act="new"]').click()
            mpage.wait_for_selector('[data-ui="dialogue"]', timeout=15000)
            clear_dialogues(mpage)
            mpage.wait_for_function("window.xiyou.snapshot().world && window.xiyou.snapshot().world.mapReady && !window.xiyou.snapshot().world.busy", timeout=15000)
            assert_eq(snap(mpage)["audio"]["unpausedTracks"], 0, "mobile world stays silent when musicOn=false")
            # 回到标题再重新开局
            mpage.locator('[data-icon="more"]').click()
            mpage.locator('[data-icon="settings"]').click()
            mpage.locator('[data-act="title"]').click()
            mpage.wait_for_selector('[data-ui="title"]', timeout=10000)
            mpage.locator('[data-act="new"]').click()
            mpage.wait_for_selector('[data-ui="confirm"]', timeout=5000)
            mpage.wait_for_function("() => !document.querySelector('[data-ui=\"confirm\"][data-armed=\"0\"]')", timeout=5000)
            mpage.locator('[data-ui="confirm"] [data-act="yes"]').click()
            mpage.wait_for_function("window.xiyou.snapshot().world && window.xiyou.snapshot().world.mapReady", timeout=15000)
            mpage.wait_for_timeout(200)
            s_restart = snap(mpage)["audio"]
            assert_eq(s_restart["musicEnabled"], False, "musicOn=false persisted across restart")
            assert_eq(s_restart["unpausedTracks"], 0, "zero tracks after restart with musicOn=false")

            browser.close()

            report = {
                "status": "passed",
                "titleActive": s1,
                "worldMuted": s_world_muted,
                "reloadRace": s_reload,
                "battle": s_battle,
                "mobileRestart": s_restart,
                "mobileSettingsOverflowPx": overflow,
                "errors": errors,
            }
    finally:
        srv.shutdown()
        srv.server_close()

    if errors:
        raise AssertionError(f"Browser errors encountered: {errors}")
    return report


if __name__ == "__main__":
    try:
        res = run()
        print(json.dumps({
            "status": res["status"],
            "reloadRace": {
                "active": res["reloadRace"]["active"],
                "unpausedTracks": res["reloadRace"]["unpausedTracks"],
                "musicVolume": res["reloadRace"]["musicVolume"],
                "sfxVolume": res["reloadRace"]["sfxVolume"],
                "tracks": res["reloadRace"]["tracks"],
            },
            "battle": {
                "active": res["battle"]["active"],
                "unpausedTracks": res["battle"]["unpausedTracks"],
                "sfxPlayedCount": res["battle"]["sfxPlayedCount"],
                "tracks": res["battle"]["tracks"],
            },
            "mobileRestart": {
                "musicEnabled": res["mobileRestart"]["musicEnabled"],
                "unpausedTracks": res["mobileRestart"]["unpausedTracks"],
                "mobileSettingsOverflowPx": res["mobileSettingsOverflowPx"],
            },
            "errors": res["errors"],
        }, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(f"AUDIO VERIFICATION FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
