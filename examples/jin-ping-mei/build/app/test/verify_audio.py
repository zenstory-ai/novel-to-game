#!/usr/bin/env python3
"""真实 Chromium + Playwright 端到端音频与设置面板回归验证（零文件写入仓库）。

覆盖：
1. 年龄门确认前点击页面：零游戏媒体（图/音/视）请求；
2. 标题页配乐正常播起 + 「鉴赏 → 音乐」点击正在播放的「春庭」可真正暂停并再次点播恢复；
3. 设置 → 声音：总静音、三通道独立开关、滑块联动解除静音、仅派发 change 事件也能落盘、% / 静音显示、音效试听；
4. 配乐=0 / 总静音：严格 muted=true & paused=true，开新局与 visibilitychange 切回前台零漏播；
5. 切曲 900ms 交叉淡出期间切后台（visibilitychange hidden）：新旧两轨立即全部 muted=true & paused=true；
6. 刷新直点「开始游戏」：单轨互斥（title 立即硬停，仅 daily 播放）且不退化成 synthTick 合成蜂鸣；
7. 损坏的 localStorage（null / "oops" / voice=200）：零 pageerror、UI 滑块回落正常默认值、过场视频不崩溃；
8. 过场视频（鉴赏与剧情）：voice=0 时 video.muted=true 且不压低 BGM，切后台暂停鉴赏视频；剧情过场中开菜单暂停视频后解除 BGM duck；
9. 390×844 移动端声音设置页：0px 横向溢出、全部控件在屏内。
"""
from __future__ import annotations

import functools
import http.server
import json
import re
import socket
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]
MEDIA_RE = re.compile(r"\.(webp|jpg|jpeg|png|mp4|mp3)(\?|$)")

INIT_PROBE = r"""
(() => {
  window.__probe = { audios: [], ctxs: [], oscStarts: [], bufStarts: [], playCalls: [] };
  const OrigAudio = window.Audio;
  window.Audio = function(src) {
    const el = new OrigAudio(src);
    const id = window.__probe.audios.length;
    const rec = { id, src, el, playCalls: 0, pauseCalls: 0 };
    const origPlay = el.play.bind(el);
    el.play = function() {
      rec.playCalls += 1;
      window.__probe.playCalls.push({ id, src: el.src, muted: el.muted, vol: el.volume });
      return origPlay();
    };
    const origPause = el.pause.bind(el);
    el.pause = function() { rec.pauseCalls += 1; return origPause(); };
    window.__probe.audios.push(rec);
    return el;
  };
  window.Audio.prototype = OrigAudio.prototype;

  const OrigAC = window.AudioContext || window.webkitAudioContext;
  if (OrigAC) {
    const WrappedAC = function(...args) {
      const ctx = new OrigAC(...args);
      const origOsc = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = function() {
        const osc = origOsc();
        const origStart = osc.start.bind(osc);
        osc.start = function(...a) { window.__probe.oscStarts.push(ctx.state); return origStart(...a); };
        return osc;
      };
      const origBuf = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = function() {
        const src = origBuf();
        const origStart = src.start.bind(src);
        src.start = function(...a) { window.__probe.bufStarts.push(ctx.state); return origStart(...a); };
        return src;
      };
      window.__probe.ctxs.push(ctx);
      return ctx;
    };
    WrappedAC.prototype = OrigAC.prototype;
    window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }
})();
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def attach_error_collector(page) -> list[str]:
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.on("response", lambda r: errors.append(f"HTTP {r.status}: {r.url}") if r.status >= 400 else None)
    return errors


def inspect_audio(page) -> dict:
    return page.evaluate("async () => (await import('./js/audio.js')).audio.inspect()")


def snap_audios(page) -> list[dict]:
    return page.evaluate("""() => window.__probe.audios.map(a => ({
      id: a.id, src: a.src, paused: a.el.paused, muted: a.el.muted, vol: Number(a.el.volume.toFixed(4)), playCalls: a.playCalls
    }))""")


def main() -> None:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]

    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(QuietHandler, directory=str(APP)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--autoplay-policy=document-user-activation-required"])

            # 1. Age gate zero-media contract + gallery title pause + settings controls + bgm=0 / mute / visibility
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.add_init_script(INIT_PROBE)
            page = ctx.new_page()
            errors = attach_error_collector(page)
            reqs: list[str] = []
            page.on("request", lambda r: reqs.append(r.url))

            page.goto(base, wait_until="load")
            page.wait_for_selector("#gate.on", timeout=10000)
            page.mouse.click(40, 40)  # click gate background before confirming age
            page.wait_for_timeout(250)
            media_before = [u for u in reqs if MEDIA_RE.search(u) and not u.endswith("/assets/ui/gate.webp")]
            assert not media_before, f"年龄确认前发生了媒体请求：{media_before}"

            page.click("#age-yes")
            page.wait_for_selector("#title.on", timeout=10000)
            page.wait_for_timeout(1100)
            st = inspect_audio(page)
            assert st["active"] == "title" and st["unpausedTracks"] == 1 and st["activeTracks"] == 1, st

            # Gallery -> Music: clicking playing 'title' (春庭) pauses it; clicking again resumes
            page.click('#title [data-act="gallery"]')
            page.wait_for_selector("#book.on")
            page.click("#book [data-sub='music']")
            page.click('#book [data-music="title"]')
            page.wait_for_timeout(1050)
            st = inspect_audio(page)
            assert st["active"] is None and st["unpausedTracks"] == 0, f"春庭未能暂停：{st}"
            page.click('#book [data-music="title"]')
            page.wait_for_timeout(400)
            st = inspect_audio(page)
            assert st["active"] == "title" and st["unpausedTracks"] == 1, f"春庭未能恢复：{st}"

            # Settings -> Sound tab: change-only event, mute, channel toggles, slider cross-sync, SE preview
            page.click("#book [data-tab='settings']")
            page.click("#book [data-set='sound']")
            page.evaluate("""() => {
              const el = document.querySelector('#book input[data-key="voice"]');
              el.value = '25';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }""")
            stored_voice = page.evaluate("JSON.parse(localStorage.getItem('fyzz2.settings')).voice")
            assert stored_voice == 25, f"仅派发 change 事件未落盘：{stored_voice}"

            # Global mute toggle -> immediate silence & muted=true, paused=true
            page.locator("#book label.toggle", has_text="全部静音").click()
            page.wait_for_timeout(120)
            st = inspect_audio(page)
            assert st["muted"] and st["unpausedTracks"] == 0 and st["activeTracks"] == 0, st
            outs = page.evaluate("[...document.querySelectorAll('#book .audio-row output')].map(o => o.textContent)")
            assert outs == ["静音", "静音", "静音"], f"总静音下读数未同步：{outs}"

            # Dragging SE slider up while muted unmutes globally, turns seOn on, and plays preview click
            before_se = page.evaluate("window.__probe.bufStarts.length")
            page.evaluate("""() => {
              const el = document.querySelector('#book input[data-key="se"]');
              el.value = '80';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page.wait_for_timeout(150)
            st = inspect_audio(page)
            after_se = page.evaluate("window.__probe.bufStarts.length")
            assert not st["muted"] and st["seEnabled"] and st["seVolume"] == 80, st
            assert after_se > before_se, "拖动音效滑块未触发试听音"

            # Set bgm slider to 0 -> immediate hard-stop (muted=true, paused=true)
            page.evaluate("""() => {
              const el = document.querySelector('#book input[data-key="bgm"]');
              el.value = '0';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }""")
            page.wait_for_timeout(150)
            st = inspect_audio(page)
            assert st["unpausedTracks"] == 0 and st["activeTracks"] == 0, st
            assert all(a["paused"] and a["muted"] for a in snap_audios(page)), snap_audios(page)

            # Start new game with bgm=0 + visibilitychange hidden->visible -> zero play calls
            page.keyboard.press("Escape")
            page.wait_for_selector("#book", state="hidden")
            plays_before = page.evaluate("window.__probe.playCalls.length")
            page.click('#title [data-act="new"]')
            page.wait_for_timeout(500)
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
              document.dispatchEvent(new Event('visibilitychange'));
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            page.wait_for_timeout(150)
            plays_after = page.evaluate("window.__probe.playCalls.length")
            assert plays_after == plays_before, f"bgm=0 下开新局或切后台回前台偷跑了 play()：{plays_before} -> {plays_after}"
            assert not errors, errors
            ctx.close()

            # 2. Crossfade hidden kill: title -> daily 120ms later hide tab -> 0 unpaused tracks (both old & new stopped!)
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.add_init_script(INIT_PROBE)
            page = ctx.new_page()
            errors = attach_error_collector(page)
            page.goto(base, wait_until="load")
            page.click("#age-yes")
            page.wait_for_selector("#title.on", timeout=10000)
            page.wait_for_timeout(1050)
            page.click('#title [data-act="new"]')
            page.wait_for_timeout(120)
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            page.wait_for_timeout(120)
            st = inspect_audio(page)
            assert st["unpausedTracks"] == 0 and st["fadingCount"] == 0 and st["ctxState"] == "suspended", st
            assert all(a["paused"] and a["muted"] for a in snap_audios(page)), snap_audios(page)
            assert not errors, errors
            ctx.close()

            # 3. Reload + direct click '开始游戏' -> single track (daily only), zero synthTick fallback
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.add_init_script(INIT_PROBE + "\nsessionStorage.setItem('fyzz2.age', 'yes');")
            page = ctx.new_page()
            errors = attach_error_collector(page)
            page.goto(base, wait_until="load")
            page.wait_for_selector("#title.on", timeout=10000)
            page.click('#title [data-act="new"]')
            page.wait_for_timeout(300)
            st = inspect_audio(page)
            assert st["active"] == "daily" and st["unpausedTracks"] == 1, st
            assert page.evaluate("window.__probe.oscStarts.length") == 0, "刷新直点不应退化为合成蜂鸣"
            assert not errors, errors
            ctx.close()

            # 4. Corrupted localStorage (null & bad strings & voice=200) -> 0 errors, defaults restored, cutscene safe
            for payload, expect_voice in [
                ({"bgm": None, "se": None, "voice": None}, 85),
                ({"bgm": "oops", "se": "oops", "voice": 200}, 100),
            ]:
                ctx = browser.new_context(viewport={"width": 1280, "height": 720})
                ctx.add_init_script(f"""
sessionStorage.setItem('fyzz2.age', 'yes');
localStorage.setItem('fyzz2.record', JSON.stringify({{ cg:[], cut:['d_pan'], scene:[], music:['title'], ending:[], read:[], chosen:[] }}));
localStorage.setItem('fyzz2.settings', {json.dumps(json.dumps(payload))});
""")
                page = ctx.new_page()
                errors = attach_error_collector(page)
                page.goto(base, wait_until="load")
                page.wait_for_selector("#title.on", timeout=10000)
                page.click('#title [data-act="settings"]')
                page.wait_for_selector("#book.on")
                page.click("#book [data-set='sound']")
                page.wait_for_timeout(450)
                ui = page.evaluate("""() => [...document.querySelectorAll('#book .audio-row')].map(r => ({
                  key: r.dataset.channel, val: Number(r.querySelector('input').value), out: r.querySelector('output').textContent
                }))""")
                assert ui == [
                    {"key": "bgm", "val": 60, "out": "60%"},
                    {"key": "se", "val": 70, "out": "70%"},
                    {"key": "voice", "val": expect_voice, "out": f"{expect_voice}%"},
                ], f"坏 localStorage 未回落清洗：{payload} -> {ui}"
                # Open gallery cut to verify voice clamping never crashes HTMLMediaElement.volume
                page.click("#book [data-tab='gallery']")
                page.click("#book [data-sub='cut']")
                page.locator("#book button.cell[data-cut]").first.click()
                page.wait_for_selector("#viewer video", timeout=5000)
                page.wait_for_timeout(250)
                assert not errors, f"坏设置 {payload} 引发报错：{errors}"
                ctx.close()

            # 5. Gallery cut with voice=0 -> video.muted=true, no BGM ducking, hidden pauses viewer video
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.add_init_script(INIT_PROBE + """
sessionStorage.setItem('fyzz2.age', 'yes');
localStorage.setItem('fyzz2.record', JSON.stringify({ cg:[], cut:['d_pan'], scene:[], music:['title'], ending:[], read:[], chosen:[] }));
localStorage.setItem('fyzz2.settings', JSON.stringify({ bgm: 60, se: 70, voice: 0 }));
""")
            page = ctx.new_page()
            errors = attach_error_collector(page)
            page.goto(base, wait_until="load")
            page.wait_for_selector("#title.on", timeout=10000)
            page.click('#title [data-act="gallery"]')
            page.wait_for_selector("#book.on")
            page.click("#book [data-sub='cut']")
            page.locator("#book button.cell[data-cut]").first.click()
            page.wait_for_selector("#viewer video", timeout=5000)
            page.wait_for_timeout(1000)
            vid = page.evaluate("() => { const v = document.querySelector('#viewer video'); return { paused: v.paused, muted: v.muted, vol: v.volume }; }")
            st = inspect_audio(page)
            assert vid["muted"] is True and vid["vol"] == 0, vid
            assert st["ducked"] is False, f"过场人声为 0 不应压低 BGM：{st}"
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            page.wait_for_timeout(200)
            vid_paused = page.evaluate("document.querySelector('#viewer video').paused")
            assert vid_paused is True, "切后台后鉴赏过场视频未暂停"
            assert not errors, errors
            ctx.close()

            # 6. In-game cutscene paused by opening menu -> BGM ducking immediately released
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.add_init_script(INIT_PROBE + "\nsessionStorage.setItem('fyzz2.age', 'yes');")
            page = ctx.new_page()
            errors = attach_error_collector(page)
            page.goto(base, wait_until="load")
            page.wait_for_selector("#title.on", timeout=10000)
            page.click('#title [data-act="new"]')
            # Advance to first choice ("立刻回家") then chapter 1 timed choice ("看向月娘") -> cutscene d_yue
            for target_choice in ("立刻回家", "看向月娘"):
                for _ in range(180):
                    btn = page.locator("#choices button[data-i]", has_text=target_choice)
                    if btn.count() > 0 and btn.first.is_visible():
                        btn.first.click()
                        break
                    page.keyboard.press("Space")
                    page.wait_for_timeout(45)
                else:
                    raise AssertionError(f"未走到选项：{target_choice}")
                page.wait_for_timeout(600)
            # Wait for cutscene video to start playing -> BGM should be ducked
            page.wait_for_function("(() => { const v = document.querySelector('#cut-plane video'); return v && !v.paused && v.currentTime > 0.2; })()", timeout=15000)
            st_live = inspect_audio(page)
            assert st_live["ducked"] is True, f"过场有声播放中 BGM 应被压低：{st_live}"
            # Open menu via Esc -> video pauses, BGM unducks immediately!
            page.keyboard.press("Escape")
            page.wait_for_selector("#book.on", timeout=5000)
            page.wait_for_timeout(150)
            st_menu = inspect_audio(page)
            assert page.evaluate("document.querySelector('#cut-plane video').paused") is True
            assert st_menu["ducked"] is False, f"菜单暂停过场后 BGM 未恢复正常音量：{st_menu}"
            # Close menu -> video resumes, BGM ducks again
            page.keyboard.press("Escape")
            page.wait_for_selector("#book", state="hidden", timeout=5000)
            page.wait_for_timeout(250)
            st_resumed = inspect_audio(page)
            assert st_resumed["ducked"] is True, f"关闭菜单恢复过场后 BGM 未重新压低：{st_resumed}"
            assert not errors, errors
            ctx.close()

            # 7. Narrow 390x844 mobile sound settings layout -> 0px overflow & all controls within viewport
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
            ctx.add_init_script("sessionStorage.setItem('fyzz2.age', 'yes');")
            page = ctx.new_page()
            errors = attach_error_collector(page)
            page.goto(base, wait_until="load")
            page.wait_for_selector("#title.on", timeout=10000)
            page.tap('#title [data-act="settings"]')
            page.wait_for_selector("#book.on")
            page.tap("#book [data-set='sound']")
            page.wait_for_timeout(200)
            layout = page.evaluate("""() => {
              const overflowX = document.documentElement.scrollWidth - window.innerWidth;
              const items = [...document.querySelectorAll('#book .set-row, #book .audio-toggle, #book input[type="range"], #book output')]
                .filter(e => e.offsetParent)
                .map(e => { const r = e.getBoundingClientRect(); return { cls: e.className || e.tagName, l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom) }; });
              return { overflowX, items };
            }""")
            assert layout["overflowX"] == 0, f"390px 声音设置页横向溢出：{layout}"
            out_of_bounds = [i for i in layout["items"] if i["l"] < 0 or i["r"] > 390 or i["b"] > 844]
            assert not out_of_bounds, f"390px 声音设置页控件出屏：{out_of_bounds}"
            assert not errors, errors
            ctx.close()

            browser.close()
    finally:
        server.shutdown()

    print("verify_audio.py PASSED (all 7 E2E suites green, 0 errors)")


if __name__ == "__main__":
    main()
