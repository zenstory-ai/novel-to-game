#!/usr/bin/env python3
"""浏览器端到端完整路径验证（真实 Chromium + Playwright，只用点击与按键，不调用任何游戏内部函数、不注入存档）。

一条完整运行：年龄门（确认之前不请求任何图片、影像、声音）→ 标题 → 序章 → 共通线六章 → 分岔夜进正院 →
吴月娘线 → 良缘结局「月下焚香」→ 原著命数 → 回标题 → 重开回到序章第一句。

路上经过：一段从头看完的剧情过场（核对影像在播、有声、字幕按时间点换句）、限时抉择等到「不作声」、
两场察言观色（看见物证才多出的选项要出现；那句话压在画面下沿时，每个细节框的中心与下半仍点得中）、按住空格护灯、快存快读、存进第 1 格后刷新页面读回（落在过场中间，应显示末帧定格）、
关掉「成人画面」后在良缘夜选「留下」（应挂帘幕，全程零成人图片请求）。
结局之后从剧情树回到「拜月」，打开「成人画面」再走一遍同意选择：点「留下」之前零请求，点了之后才请求（不截图）。
序章里混用指针与键盘：鼠标点快捷栏「回看」→ Esc 或右上角关闭 → 空格、回车仍是往下读，不会把册页再打开。
另开一个 390×844 的窄屏会话走到第一个限时抉择，核对选项与快捷栏都在屏内；回看超过一页时翻页条可点、能翻回上一页，
刷新页面「继续」读档后回看仍带着读档前的句子。

--write-evidence：整份重写 qa/verification.json、qa/evidence/ 与 screenshots/ 四张公开截图（都不含成人画面）。
--out DIR：把同样的验证记录与截图写到 DIR 下（目录结构同上），不碰 qa/ 与 screenshots/；修复者自测用这个。
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import socket
import subprocess
import sys
import time
import traceback
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]
EXAMPLE = APP.parents[1]
OUT = EXAMPLE  # --out 改写；验证记录与截图都写在 OUT 下的 qa/ 与 screenshots/
RUN_ID = "jin-ping-mei-rebuild-2026-11"
COMMAND = "cd examples/jin-ping-mei/build/app && python3 test/verify.py --write-evidence"
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")
FIRST_LINE = "清河县的春天来得迟，一来就是满街柳絮。"
ADULT_RE = re.compile(r"/assets/cg/(yue|pan|pinger|meng|xuee)/(prelude|explicit)\.")
MEDIA_RE = re.compile(r"\.(webp|jpg|jpeg|png|mp4|mp3)(\?|$)")
LIMITATIONS = [
    {"scope": "路径覆盖", "reason": "浏览器只走吴月娘良缘一条完整路径；其余 15 个结局由 npm run verify:model 穷举全部选择证明可达，没有逐一在浏览器里走。"},
    {"scope": "剧情过场", "reason": "这条路径经过 9 段过场，只把第一段从头看完并核对字幕换句，其余用两次空格跳过；另外 49 段只核对了登记、文件与字幕句数。演技、口型与人物声音是否前后一致没有自动判断。"},
    {"scope": "影游交互", "reason": "只走了一次限时沉默、两场察言观色（花园看一处，门前看两处、其中一处用鼠标点金框下半）、一次护灯成功；其余沉默分支、细节组合与护灯失败由 verify:model 穷举证明可达。"},
    {"scope": "成人画面", "reason": "只核对了年龄拦截与开关逻辑（年龄门前零媒体请求、关掉时挂帘幕、同意之前零请求、同意之后才请求），不判断成人 CG 的画面内容；证据截图一律不含成人画面。"},
    {"scope": "视口与浏览器", "reason": "完整路径只在 1440×900 的 Chromium 里走；390×844 只走到第一个限时抉择并核对布局，没有窄屏通关，也没有在真机、Safari 或 Firefox 上运行。"},
    {"scope": "声音", "reason": "只确认过场影像不是静音、音量大于零，配乐文件请求成功；听感没有自动判断。"},
    {"scope": "体验判断", "reason": "自动化只证明能启动、渲染、输入、走到结局并重开，不判断剧情是否动人、节奏是否合适。"},
]

STATE_JS = """() => {
  const q = (s) => document.querySelector(s);
  const choices = q('#choices');
  const open = choices && !choices.hidden && choices.classList.contains('on') && !choices.classList.contains('leaving');
  const card = q('#card');
  const video = q('#cut-plane video');
  return {
    screen: q('#app').dataset.screen,
    beat: q('#game').dataset.beat || '',
    options: open ? [...choices.querySelectorAll('button[data-i]')].filter((b) => !b.disabled).map((b) => b.innerText.replace(/\\s+/g, ' ').trim()) : null,
    timed: open && choices.classList.contains('timed'),
    look: !q('#look-ui').hidden,
    hold: !q('#hold').hidden,
    card: card.hidden ? '' : card.className,
    cardText: card.hidden ? '' : card.innerText.replace(/\\s+/g, ' ').trim(),
    text: q('#text').textContent,
    typed: q('#dialogue').classList.contains('waiting'),
    who: q('#who').hidden ? '' : q('#who .who-name').textContent,
    kind: q('#dialogue').dataset.kind,
    chapter: q('#chapter-tag').textContent,
    cut: q('#cut-plane').className,
    video: video ? { t: video.currentTime, d: video.duration || 0, muted: video.muted, volume: video.volume, paused: video.paused, ended: video.ended } : null,
    cg: q('#cg-plane').classList.contains('on') ? q('#cg-plane img').getAttribute('src') : '',
    veiled: q('#cg-plane').classList.contains('veiled'),
    book: !q('#book').hidden,
    stamps: q('#stamps').innerText.trim(),
    sprites: [...document.querySelectorAll('#sprites .sprite:not(.leaving)')].map((s) => s.dataset.who),
  };
}"""


SPOT_HIT_JS = """() => [...document.querySelectorAll('.spots .spot:not(:disabled)')].map((el) => {
  const r = el.getBoundingClientRect();
  const probes = [[0.5, 0.5], [0.5, 0.85], [0.2, 0.75], [0.8, 0.75]].map(([fx, fy]) => {
    const x = r.left + r.width * fx;
    const y = r.top + r.height * fy;
    const hit = document.elementFromPoint(x, y);
    return { x: Math.round(x), y: Math.round(y), ok: hit?.closest('.spot') === el, hit: hit ? (hit.id || hit.className || hit.tagName) : null };
  });
  return { name: el.getAttribute('aria-label'), probes };
})"""


def assert_spots_clickable(run: "Run", where: str) -> list[dict]:
    """看过一处之后，那句话压在画面下沿：每个还能看的细节框，中心与下半都要点得中（不被文本区盖住）。"""
    spots = run.page.evaluate(SPOT_HIT_JS)
    assert spots, f"{where}：没有还能看的细节框"
    blocked = [(s["name"], p) for s in spots for p in s["probes"] if not p["ok"]]
    assert not blocked, f"{where}：细节框被别的层盖住，点不中：{blocked[:4]}"
    return [{"spot": s["name"], "probesHit": len(s["probes"])} for s in spots]


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Run:
    def __init__(self, page, shots: bool):
        self.page = page
        self.shots = shots
        self.trace: list[str] = []
        self.requests: list[str] = []
        self.errors: list[str] = []
        page.on("request", lambda r: self.requests.append(r.url))
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: self.errors.append(f"console.error: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.on("response", lambda r: self.errors.append(f"HTTP {r.status}: {r.url}") if r.status >= 400 else None)
        page.on("requestfailed", lambda r: self.errors.append(f"requestfailed: {r.url}") if "/assets/" in r.url and "ERR_ABORTED" not in (r.failure or "") else None)

    # ---- 观察 ----
    def state(self) -> dict:
        return self.page.evaluate(STATE_JS)

    def adult_requests(self) -> list[str]:
        return [u for u in self.requests if ADULT_RE.search(u)]

    def step(self, text: str) -> None:
        self.trace.append(text)
        print(f"  · {text}", flush=True)

    def shot(self, relative: str) -> str:
        if self.shots:
            path = OUT / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(path), type="jpeg", quality=88)
        return relative

    # ---- 输入 ----
    def wait(self, predicate, what: str, timeout: float = 20.0, press: str | None = None, every: float = 0.07) -> dict:
        end = time.time() + timeout
        while time.time() < end:
            s = self.state()
            if predicate(s):
                return s
            if press:
                self.page.keyboard.press(press)
            self.page.wait_for_timeout(int(every * 1000))
        raise AssertionError(f"等不到：{what}；当前 {json.dumps(self.state(), ensure_ascii=False)[:400]}")

    def read_on(self, what: str = "下一个要动手的地方", timeout: float = 90.0) -> dict:
        """按空格一路读，直到出现选项、察言观色、护灯或整屏卡。"""
        return self.wait(lambda s: s["options"] is not None or s["look"] or s["hold"] or s["card"], what, timeout, press="Space")

    def pass_card(self, kind: str) -> None:
        self.wait(lambda s: kind in s["card"], f"读到 {kind} 出现", 60, press="Space")
        self.wait(lambda s: kind not in s["card"], f"{kind} 收起", 20, press="Space", every=0.25)

    def choose(self, fragment: str) -> None:
        s = self.wait(lambda s: s["options"] is not None, f"选项「{fragment}」", 30)
        assert any(fragment in o for o in s["options"]), f"没有含「{fragment}」的选项：{s['options']}"
        self.page.locator("#choices button[data-i]", has_text=fragment).first.click()
        self.step(f"点选项「{fragment}」")
        self.wait(lambda s: s["options"] is None, "选项收起", 8)

    def key(self, key: str, note: str) -> None:
        self.page.keyboard.press(key)
        self.step(f"按 {key}：{note}")


def play(run: Run, base: str, obs: dict) -> dict:
    page = run.page

    # ---------- launch：年龄门在一切画面之前 ----------
    page.goto(base, wait_until="load")
    page.wait_for_selector("#gate.on", timeout=10000)
    page.wait_for_timeout(600)
    # 门面只有一张不含人物的宅门图；游戏里的图片、影像与声音都得等确认之后
    media_before = [u for u in run.requests if MEDIA_RE.search(u) and not u.endswith("/assets/ui/gate.webp")]
    assert not media_before, f"年龄确认之前就请求了游戏媒体：{media_before[:3]}"
    assert page.locator("#title").is_hidden() and page.locator("#game").is_hidden()
    run.step("打开页面，停在年龄门")
    page.click("#age-yes")
    run.step("点「我已成年，推门进去」")
    page.wait_for_selector("#title.on", timeout=10000)
    page.wait_for_function("document.querySelector('#title .pic img').naturalWidth > 0", timeout=15000)
    page.wait_for_timeout(1800)
    obs["launch"] = {
        "id": "age-gate-then-title",
        "inputs": ["打开页面", "点「我已成年，推门进去」"],
        "state": {"mediaRequestsBeforeAgeConfirm": 0, "screenAfterConfirm": run.state()["screen"], "title": page.title(), "pageErrors": list(run.errors)},
        "visual": run.shot("screenshots/title.jpg"),
    }
    assert not run.errors, f"启动时有报错：{run.errors}"

    # ---------- 序章 ----------
    page.click('#title [data-act="new"]')
    run.step("点「开始游戏」")
    run.pass_card("card-chapter")
    first = run.wait(lambda s: s["beat"] == "line" and s["text"] == FIRST_LINE and s["typed"], "序章第一句打完", 15)
    assert page.locator("#first-hint").is_visible(), "第一句下面没有操作提示"
    shown = first["text"]
    page.mouse.click(720, 300)
    run.step("点画面，读下一句")
    second = run.wait(lambda s: s["text"] and s["text"] != shown and not s["text"].startswith(shown[:4]), "点击后换到下一句", 8)
    # 混用指针与键盘：鼠标打开快捷栏的册页，关上之后空格、回车仍是往下读
    run.wait(lambda s: s["typed"], "这一句打完", 8)
    mixed = []
    for close, key in (("Escape", "Space"), ("x", "Enter")):
        before = run.state()["text"]
        page.click('#quick [data-act="backlog"]')
        page.wait_for_selector("#book.on", timeout=5000)
        if close == "Escape":
            page.keyboard.press("Escape")
        else:
            page.click("#book .book-close")
        page.wait_for_selector("#book", state="hidden", timeout=5000)
        page.keyboard.press(key)
        after = run.wait(lambda s: s["text"] != before or s["book"], f"关掉回看后按 {key}", 6)
        assert not after["book"], f"鼠标打开回看、{close} 关上后按 {key}，回看又被打开了"
        run.step(f"鼠标点「回看」→ {close} 关上 → 按 {key}：往下读了一句")
        mixed.append({"open": "pointer", "close": close, "key": key, "before": before, "after": after["text"]})
        run.wait(lambda s: s["typed"], "这一句打完", 8)
    obs["input"] = {
        "id": "click-and-keys-advance",
        "inputs": ["点画面", "按空格", "鼠标开回看后用键盘继续"],
        "state": {"before": shown, "afterClick": second["text"], "pointerThenKeyboard": mixed},
    }
    run.read_on()
    run.choose("立刻回家")

    # ---------- 第一章：晚饭，限时抉择 + 第一段过场从头看完 ----------
    run.pass_card("card-chapter")
    s = run.wait(lambda s: s["beat"] == "line" and len(s["sprites"]) >= 1 and s["who"] == "月娘" and s["text"].endswith("」"), "月娘立绘登场开口", 60, press="Space")
    page.wait_for_timeout(700)
    obs["render"] = {
        "id": "adv-scene-with-sprite",
        "inputs": ["按空格读到晚饭"],
        "state": {"chapter": s["chapter"], "speaker": s["who"], "sprites": s["sprites"], "text": s["text"], "dialogue": s["kind"]},
        "visual": run.shot("screenshots/adv.jpg"),
    }
    s = run.read_on()
    assert s["timed"], "凉汤这一问应当限时"
    assert not any("不作声" in o for o in s["options"]), "限时开着的时候，不作声不该列成选项"
    run.choose("看向月娘")
    run.step("不按键，把这段过场从头看完")
    s = run.wait(lambda s: s["video"] and s["video"]["t"] > 0.4 and "live" in s["cut"], "过场开播", 15)
    assert not s["video"]["muted"] and s["video"]["volume"] > 0, f"过场应当有声：{s['video']}"
    seen_lines: list[str] = []
    timing: list[dict] = []  # 每句字幕：浮出时的影像秒数与墙钟
    cut_shot = None
    end = time.time() + 60
    while time.time() < end:
        s = run.state()
        if s["text"] and (not seen_lines or seen_lines[-1] != s["text"]):
            seen_lines.append(s["text"])
            timing.append({"text": s["text"], "videoT": round(s["video"]["t"], 2) if s["video"] else None, "wall": time.time()})
        if cut_shot is None and s["video"] and 4.6 < s["video"]["t"] < 5.3 and s["kind"] == "sub":
            cut_shot = run.shot("screenshots/cut.jpg")
        if "ended" in s["cut"]:
            break
        page.wait_for_timeout(120)
    s = run.state()
    assert "ended" in s["cut"], "过场没有演到末帧"
    assert len(seen_lines) >= 4, f"字幕没有跟着影像换句：{seen_lines}"
    # 字幕节拍（第 4 轮盲玩：前紧后松、旁白跑在画面前面）：每句停够读完的时间，浮出时影像已演到它的时间点、还没演过它所属的镜头
    plan = page.evaluate("""async (lines) => {
      const { readMs } = await import('./js/engine/subs.js');
      const { CUT } = await import('./js/story/registry.js');
      return { need: lines.map((t) => readMs(t.replace(/^「|」$/g, ''))), cues: CUT.d_yue.cues, ends: CUT.d_yue.ends };
    }""", seen_lines)
    for k, row in enumerate(timing):
        if row["videoT"] is not None:
            assert plan["cues"][k] - 0.15 <= row["videoT"] <= plan["ends"][k] + 0.05, f"第 {k + 1} 句「{row['text'][:12]}」在影像 {row['videoT']} 秒浮出，不在它的镜头 {plan['cues'][k]}–{plan['ends'][k]} 秒里"
        if k + 1 < len(timing):
            stayed = timing[k + 1]["wall"] - row["wall"]
            row["stayedMs"] = round(stayed * 1000)
            # 第一句在「过场开播」之前就浮出来了，墙钟从中途量起，只记录不判
            assert k == 0 or stayed * 1000 >= plan["need"][k] * 0.9, f"第 {k + 1} 句「{row['text'][:12]}」只停了 {stayed:.1f} 秒，读完要 {plan['need'][k] / 1000:.1f} 秒"
    for row in timing:
        row.pop("wall")
    assert cut_shot, "没截到过场画面"
    page.wait_for_timeout(600)
    assert "月娘会记得这句话" in run.state()["stamps"], "过场演完后没有盖「她记下了」的印"
    cut_obs = {"cut": "d_yue", "subtitleLinesShownByCue": seen_lines, "subtitleTiming": timing, "readMs": plan["need"], "audible": True, "endedOnPoster": True, "stampAfterCut": "月娘会记得这句话"}

    run.read_on()
    run.choose("正院 · 月娘还在")
    # 第 5 轮盲玩：「灯下看账」写她提笔写账，画面却是站着、两手空着的立绘。现在她搁笔起身才登场，
    # 写她「坐回案前，提起笔」时立绘已经退场。逐句记下每一句压着的立绘
    ledger_lines: dict[str, list[str]] = {}
    def seen_ledger(s: dict) -> bool:
        if s["beat"] == "line" and s["text"]:
            ledger_lines.setdefault(s["text"], s["sprites"])
        return "card-chapter" in s["card"]
    run.wait(seen_ledger, "正院一场读完", 40, press="Space", every=0.3)
    stood = [t for t in ledger_lines if "起身站到案前" in t]
    back = [t for t in ledger_lines if "坐回案前" in t]
    assert stood and ledger_lines[stood[0]] == ["yue"], f"她搁笔起身那一句应当配月娘立绘：{ledger_lines}"
    assert back and ledger_lines[back[0]] == [], f"她坐回案前提笔时不该留着站立的立绘：{ledger_lines}"
    assert not any(k in t for t in ledger_lines for k in ("笔停了停", "接着写")), f"正院还在写她伏案写账：{list(ledger_lines)}"
    run.step("正院夜访：起身那句配立绘，坐回案前那句立绘已退场")

    # ---------- 第二章：快存快读；限时走到「不作声」；存第 1 格后刷新读回 ----------
    run.pass_card("card-chapter")
    s = run.wait(lambda s: s["beat"] == "line" and "春梅" in s["text"] and s["who"] == "", "读到春梅堵在灶台前", 30, press="Space")
    run.wait(lambda s: s["typed"], "这一句打完", 5)
    saved_text = run.state()["text"]
    run.key("q", "快存")
    page.wait_for_timeout(500)
    for _ in range(3):
        page.keyboard.press("Space")
        page.wait_for_timeout(350)
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
    moved = run.state()["text"]
    assert moved != saved_text
    run.key("w", "快读")
    s = run.wait(lambda s: s["text"] == saved_text and s["typed"], "快读回到同一句", 8)
    # 快进途中打开菜单：背后的对白必须停在原句，关上菜单后再接着快进
    run.key("Escape", "打开菜单开「快进时也跳过没读过的文字」")
    page.wait_for_selector("#book.on", timeout=5000)
    page.click("#book [data-tab='settings']")
    page.click("#book [data-set='read']")
    page.locator("#book label.toggle", has_text="跳过没读过的文字").click()
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    run.key("f", "开启快进")
    page.wait_for_timeout(60)
    run.key("Escape", "快进途中打开菜单")
    page.wait_for_selector("#book.on", timeout=5000)
    paused_at = run.state()
    page.wait_for_timeout(500)
    still_at = run.state()
    assert still_at["book"] and still_at["text"] == paused_at["text"] and still_at["beat"] == paused_at["beat"], (
        f"菜单开着时快进仍在背后推进：{paused_at['text']!r} → {still_at['text']!r}"
    )
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    resumed = run.wait(lambda s: s["text"] != paused_at["text"] or s["options"] is not None, "关上菜单后快进恢复", 5)
    run.key("Escape", "打开菜单关回「快进时也跳过没读过的文字」")
    page.wait_for_selector("#book.on", timeout=5000)
    page.click("#book [data-tab='settings']")
    page.click("#book [data-set='read']")
    page.locator("#book label.toggle", has_text="跳过没读过的文字").click()
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    run.key("w", "快读回到原句")
    s = run.wait(lambda s: s["text"] == saved_text and s["typed"], "快读再次回到同一句", 8)
    save_obs = {
        "quickSavedAt": saved_text,
        "movedTo": moved,
        "quickLoadedAt": s["text"],
        "skipPausedInMenu": {"heldAt": paused_at["text"], "resumedTo": resumed["text"]},
    }

    s = run.read_on()
    assert s["timed"]
    run.step("限时抉择：不点，等灯芯烧完")
    t0 = time.time()
    # 灯芯烧尽时先摆出「你没有开口」，这时按数字键不再算数（第 4 轮盲玩：超时后按 1 以为替人出了头）
    page.wait_for_selector("#choices.expired", timeout=20000)
    expired_note = page.locator("#choices .wick-note").inner_text()
    assert "没有开口" in expired_note, f"灯芯烧尽后没有说明是时间到了：{expired_note}"
    page.keyboard.press("1")
    run.step("灯芯烧尽之后按 1：不算数")
    page.wait_for_function("document.querySelector('#toast').textContent.includes('烧尽')", timeout=2000)
    run.wait(lambda s: s["options"] is None, "灯芯烧尽，走到不作声", 8)
    waited = round(time.time() - t0, 1)
    assert waited > 12, f"限时没有走满（{waited} 秒）"
    # 选完就看后果：沉默分支不垫旁白，不按任何键，过场自己就开演（盲玩里荷花饼沉默先垫了一句旁白，被当成没有过场）
    s = run.wait(lambda s: "on" in s["cut"].split() and s["video"] is not None and s["kind"] == "sub", "沉默分支一走到就进过场", 8)
    silent_obs = {"waitedSeconds": waited, "expiredNote": expired_note, "lateKeyIgnored": True, "cutStartedWithoutKeypress": True, "cutPlane": s["cut"], "dialogue": s["kind"]}

    # 走进这段沉默的过场，在过场中间存到第 1 格，刷新页面读回：应显示末帧定格与同一句字幕
    s = run.wait(lambda s: s["kind"] == "sub" and s["video"] and s["text"], "沉默分支的过场字幕", 15, press="Space", every=0.3)
    sub_text = s["text"]
    run.key("s", "打开存档")
    page.wait_for_selector("#book.on .slot-main[data-slot='1']", timeout=5000)
    assert run.state()["video"]["paused"], "菜单开着的时候过场应当暂停"
    page.click("#book .slot-main[data-slot='1']")
    run.step("存进第 1 格")
    page.wait_for_selector("#book .slot:not(.empty) .slot-main[data-slot='1']", timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    page.reload(wait_until="load")
    run.step("刷新页面")
    page.wait_for_selector("#title.on", timeout=10000)
    page.click('#title [data-act="load"]')
    page.click("#book .slot-main[data-slot='1']")
    run.step("标题 → 读取存档 → 第 1 格")
    s = run.wait(lambda s: s["screen"] == "game" and s["text"] == sub_text, "读回过场里的那一句", 10)
    assert "ended" in s["cut"] and s["video"] is None, f"读档落在过场中间应显示末帧定格：{s['cut']}"
    save_obs.update({"slotSavedDuringCut": sub_text, "afterReload": s["text"], "cutShownAs": "poster-still"})

    # ---------- 第三章：察言观色 ----------
    run.read_on()  # 章节卡
    run.pass_card("card-chapter")
    ch3_first = run.wait(lambda s: s["beat"] == "line" and s["typed"], "第三章第一句", 15)
    run.key("q", "察言观色前快存")
    page.wait_for_timeout(450)
    s = run.wait(lambda s: s["look"], "花园里的察言观色", 60, press="Space")
    page.wait_for_timeout(200)
    run.key("w", "察言观色途中快读")
    s = run.wait(lambda s: s["beat"] == "line" and s["text"] == ch3_first["text"], "从察言观色快读回普通对白", 8)
    leftover_look = page.evaluate("""() => ({
      lookUiHidden: document.querySelector('#look-ui').hidden,
      spots: document.querySelectorAll('.spots').length,
      chips: document.querySelectorAll('#look-ui .chip, #look-done').length,
      steady: document.querySelector('#cg-plane .pic').classList.contains('steady'),
    })""")
    assert leftover_look == {"lookUiHidden": True, "spots": 0, "chips": 0, "steady": False}, f"察言观色途中快读后旧交互未清干净：{leftover_look}"
    s = run.wait(lambda s: s["look"], "重新走到花园里的察言观色", 60, press="Space")
    page.wait_for_function("document.querySelector('#cg-plane .pic.live') !== null", timeout=15000)
    page.locator(".spot[aria-label='瓶儿手里的钥匙']").click()
    run.step("察言观色：看「瓶儿手里的钥匙」")
    s = run.wait(lambda s: "钥匙" in s["text"], "看见的那句话", 8)
    garden_hits = assert_spots_clickable(run, "花园的察言观色")
    page.locator(".spot[aria-label='金莲的团扇']").hover()
    page.wait_for_timeout(1600)
    look_shot = run.shot("screenshots/film.jpg")
    look_obs = {"garden": s["text"], "idleFilmPlaying": True}
    page.click("#look-done")
    s = run.read_on()
    assert any("钥匙你自己收着" in o for o in s["options"]), f"看见钥匙之后应多出一个选项：{s['options']}"
    # 解锁的那一项要看得出来（第 4 轮盲玩：解锁项排在第 1 位、和别的选项一模一样，以为白看了）
    assert any("钥匙你自己收着" in o and "看见了「瓶儿手里的钥匙」" in o for o in s["options"]), f"解锁的选项没有写明是看见了哪一处：{s['options']}"
    assert sum("看见了" in o for o in s["options"]) == 1, f"只有解锁的那一项该带「看见了」：{s['options']}"
    run.choose("箱子我替你守着")

    # ---------- 第四章：门前旧契 ----------
    run.pass_card("card-chapter")
    run.wait(lambda s: s["look"], "门前的察言观色", 60, press="Space")
    page.locator(".spot[aria-label='旧契']").click()
    run.step("察言观色：看「旧契」")
    run.wait(lambda s: "已折" in s["text"], "契尾小字", 8)
    gate_hits = assert_spots_clickable(run, "门前的察言观色")
    # 用真实鼠标点「背在身后的手」金框的中心与下半（盲玩里这里被文本区盖住，点了没反应）
    box = page.locator(".spot[aria-label='另一个人背在身后的手']").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.8)
    run.step("察言观色：用鼠标点「另一个人背在身后的手」金框下半")
    run.wait(lambda s: "麻绳" in s["text"], "点中背在身后的手", 8)
    page.click("#look-done")
    s = run.read_on()
    assert any("契尾" in o for o in s["options"]), f"看见契尾之后应多出一个选项：{s['options']}"
    look_obs["gate"] = "看见契尾后多出「指着契尾」；描述压在画面下沿时，每个细节框中心与下半都点得中，鼠标点中「背在身后的手」的下半"
    look_obs["spotHitTest"] = {"garden": garden_hits, "gate": gate_hits}
    run.choose("听月娘的")

    # ---------- 第五章：护灯 ----------
    run.pass_card("card-chapter")
    ch5_first = run.wait(lambda s: s["beat"] == "line" and s["typed"], "第五章第一句", 15)
    run.key("q", "护灯前快存")
    page.wait_for_timeout(450)
    run.wait(lambda s: s["hold"], "雨夜护灯", 60, press="Space")
    page.wait_for_timeout(300)
    run.key("w", "护灯途中快读")
    run.wait(lambda s: s["beat"] == "line" and s["text"] == ch5_first["text"], "从护灯快读回普通对白", 8)
    assert not run.state()["hold"] and page.locator("#hold .lantern").count() == 0, "护灯途中快读后护灯层未清理"
    run.wait(lambda s: s["hold"], "重新走到雨夜护灯", 60, press="Space")
    page.wait_for_timeout(900)
    page.keyboard.down("Space")
    run.step("按住空格护灯")
    page.wait_for_timeout(2700)
    page.keyboard.up("Space")
    s = run.wait(lambda s: not s["hold"] and "又直了起来" in s["text"], "护住了灯", 12)
    hold_obs = {"heldMs": 2700, "result": s["text"], "midHoldQuickLoadCleaned": True}
    s = run.read_on()
    assert s["options"] is not None, "护灯后的去向选项"
    run.key("q", "选项处快存")
    page.wait_for_timeout(450)
    run.key("1", "按 1 选第一项（进入 460ms 收起动画）")
    page.wait_for_timeout(90)
    run.key("w", "选择收起动画期间立即快读")
    page.wait_for_timeout(650)
    after_race = run.state()
    assert after_race["options"] is not None and len(after_race["options"]) >= 2, f"选择动画期间快读后选项被旧回调清空：{after_race}"
    save_obs["choiceAnimQuickLoadOptions"] = after_race["options"]
    run.choose("正院 · 月娘")

    # ---------- 第六章：清明荷亭 ----------
    run.pass_card("card-chapter")
    s = run.read_on()
    assert s["timed"]
    assert "沉下脸" in s["options"][0], s["options"]
    # 两个选项的限时抉择里按数字键 1，等于点第一项（第 4 轮盲玩疑似走成了不作声）
    page.wait_for_timeout(400)
    run.key("1", "限时抉择里按数字键选「沉下脸」")
    run.wait(lambda s: s["options"] is None, "选项收起", 8)
    s = run.wait(lambda s: s["kind"] == "sub" and s["text"], "荷亭过场字幕", 10)
    assert "应伯爵的酒醒了一半" in s["text"], f"按 1 应走到「沉下脸」的后果，实际：{s['text']}"
    key_obs = {"timedTwoOptionKey1": s["text"]}
    run.read_on()
    run.choose("给月娘")

    # ---------- 分岔夜 ----------
    s = run.wait(lambda s: s["options"] is not None and page.locator("#choices.branch").count() == 1, "五扇院门", 90, press="Space")
    doors = page.evaluate("[...document.querySelectorAll('#choices .door')].map((d) => [d.querySelector('em').textContent, d.classList.contains('lit')])")
    assert dict(doors)["吴月娘"], f"正院的灯应当亮着：{doors}"
    page.wait_for_timeout(900)
    run.shot("qa/evidence/doors.jpg")
    run.key("Escape", "打开菜单")
    page.click("#book [data-tab='tree']")
    tree_open = page.locator("#book .tree-node:not(.locked)").count()
    assert tree_open >= 7, f"共通线七章应当都能回去：{tree_open}"
    page.keyboard.press("Escape")
    page.locator("#choices .door", has_text="吴月娘").click()
    run.step("进正院（吴月娘）")
    branch_obs = {"doors": doors, "treeNodesOpen": tree_open}

    # ---------- 吴月娘线 ----------
    run.pass_card("card-chapter")
    run.read_on()
    run.choose("那件事，是我不对")
    run.pass_card("card-chapter")
    run.read_on()
    run.choose("糖兔子")
    run.pass_card("card-chapter")
    run.read_on()
    run.choose("家里的账，大姐管")
    run.pass_card("card-chapter")
    run.read_on()
    run.choose("推门进去")
    s = run.read_on()
    assert any("留下" in o for o in s["options"]) and not s["timed"], "良缘夜要有一次不限时的同意选择"

    # 关掉「成人画面」再选「留下」：应挂帘幕，全程零成人图片请求
    run.key("Escape", "打开菜单")
    page.click("#book [data-tab='settings']")
    page.click("#book [data-set='other']")
    page.locator("#book label.toggle", has_text="成人画面").click()
    run.step("设置：关掉「成人画面」")
    page.keyboard.press("Escape")
    run.choose("握住她的手，留下")
    # 良缘夜在选择之前已经挂着「对镜卸簪」的全年龄 CG，要等画面换掉它
    s = run.wait(lambda s: s["cg"] and "unpin" not in s["cg"], "亲密场景的画面", 8)
    assert s["veiled"] and "curtain" in s["cg"], f"关掉成人画面后应挂帘幕：{s['cg']}"
    assert not run.adult_requests(), f"不该请求成人图片：{run.adult_requests()}"
    page.wait_for_timeout(900)
    run.shot("qa/evidence/curtain.jpg")
    adult_obs = {"adultOff": {"shown": s["cg"], "adultImageRequests": 0}}

    # ---------- outcome：结局与命数 ----------
    s = run.wait(lambda s: "card-ending" in s["card"], "结局卡", 90, press="Space")
    page.wait_for_timeout(2400)
    s = run.state()
    assert "月下焚香" in s["cardText"] and "良缘" in s["cardText"], s["cardText"]
    ending_shot = run.shot("qa/evidence/ending.jpg")
    record = json.loads(page.evaluate("localStorage.getItem('fyzz2.record')"))
    assert "yue_good" in record["ending"], record["ending"]
    run.pass_card("card-ending")
    run.step("点过结局卡")
    s = run.wait(lambda s: "card-fate" in s["card"] and "第一百回" in s["cardText"] and "改不了" in s["cardText"], "原著命数页显出全文", 30)
    fate_text = s["cardText"]
    page.wait_for_selector("#card .fate-foot.on", timeout=20000)
    page.wait_for_timeout(1200)
    run.shot("qa/evidence/fate.jpg")
    run.wait(lambda s: s["screen"] == "title", "回到标题", 20, press="Space", every=0.4)
    run.step("点过命数页，回到标题")
    # 第 2、5 轮盲玩：读完命数页连按空格，焦点落到「开始游戏」上就开了新局。玩过一局回到标题不给按钮焦点
    for _ in range(6):
        page.wait_for_timeout(400)
        page.keyboard.press("Space")
    focus = page.evaluate("document.activeElement?.dataset?.act || document.activeElement?.tagName")
    assert run.state()["screen"] == "title", "回到标题后连按空格不该开新局"
    assert focus != "new", f"回到标题后焦点不该落在「开始游戏」上：{focus}"
    page.keyboard.press("ArrowDown")
    first = page.evaluate("document.activeElement?.dataset?.act")
    assert first == "new", f"上下键应当从第一项选起：{first}"
    page.evaluate("document.activeElement.blur()")
    run.step("回到标题后连按 6 下空格仍在标题；按下键选中第一项")
    # 第 5 轮盲玩：鉴赏的结局页点了没反应。见过的结局点开重看结局名与原著命数
    page.click('#title [data-act="gallery"]')
    page.click("#book [data-sub='ending']")
    page.click("#book [data-ending='yue_good']")
    page.wait_for_selector("#viewer:not([hidden]) .end-review", timeout=5000)
    review = page.inner_text("#viewer .end-review")
    assert "月下焚香" in review and "第一百回" in review, f"结局重看缺内容：{review}"
    pill = page.evaluate("""() => { const b = document.querySelector('#book .subtabs button'); const r = b.getBoundingClientRect();
      const t = document.createRange(); t.selectNodeContents(b.firstChild); const tr = t.getBoundingClientRect();
      return Math.abs((tr.top + tr.bottom) / 2 - (r.top + r.bottom) / 2); }""")
    assert pill <= 3, f"鉴赏页签胶囊里的字没有垂直居中：偏 {pill:.1f}px"
    page.keyboard.press("Escape")
    page.wait_for_selector("#viewer", state="hidden", timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    run.step("鉴赏 · 结局：点开「月下焚香」重看结局名与命数；页签文字垂直居中")
    gallery_obs = {"endingReview": review.replace("\n", " "), "pillTextOffsetPx": round(pill, 1), "focusAfterTitleReturn": focus}
    obs["outcome"] = {
        "id": "yue-good-ending-and-fate",
        "inputs": ["一路选到吴月娘良缘", "点过结局卡与命数页"],
        "state": {"ending": "yue_good", "endingTitle": "月下焚香", "kind": "良缘", "fatePage": fate_text, "recordedEndings": record["ending"], "titleProgress": page.inner_text("#title-progress"), "afterEnding": gallery_obs},
        "visual": ending_shot,
    }
    obs["coreLoop"] = {
        "id": "read-choose-watch-consequence",
        "inputs": list(run.trace),
        "state": {"firstCutscene": cut_obs, "timedSilence": silent_obs, "look": look_obs, "holdLamp": hold_obs, "saveLoad": save_obs, "branchNight": branch_obs, "adultGate": adult_obs, "timedKeys": key_obs},
        "visual": look_shot,
    }

    # ---------- restart：重开回到序章第一句，心意清零 ----------
    page.wait_for_timeout(1500)
    page.click('#title [data-act="new"]')
    run.step("点「开始游戏」重开")
    run.pass_card("card-chapter")
    s = run.wait(lambda s: s["beat"] == "line" and s["text"] == FIRST_LINE, "重开后的序章第一句", 15)
    page.keyboard.press("Escape")
    page.click("#book [data-tab='hearts']")
    lit = page.locator("#book .hearts li.lit").count()
    page.keyboard.press("Escape")
    assert lit == 0, f"重开后不该有亮着灯的门：{lit}"
    obs["restart"] = {
        "id": "new-game-from-title",
        "inputs": ["点「开始游戏」", "打开菜单看心意"],
        "state": {"restart": "prologue-first-line", "text": s["text"], "chapter": s["chapter"], "doorsLit": lit, "sprites": s["sprites"]},
    }

    # ---------- 成人画面开着：同意之前零请求，同意之后才请求（不截图） ----------
    page.keyboard.press("Escape")
    page.click("#book [data-tab='settings']")
    page.click("#book [data-set='other']")
    page.locator("#book label.toggle", has_text="成人画面").click()
    page.click("#book [data-set='film']")
    page.locator("#book label.toggle", has_text="动态影像").click()
    run.step("设置：打开「成人画面」，关掉「动态影像」（过场改为定格画面）")
    page.click("#book [data-tab='tree']")
    page.locator("#book .tree-node", has_text="拜月").click()
    page.click("#confirm [data-v='yes']")
    run.step("剧情树：从「拜月」重来")
    run.pass_card("card-chapter")
    run.read_on()
    run.choose("推门进去")
    run.read_on()
    assert not run.adult_requests(), "同意之前不该请求成人图片"
    run.choose("握住她的手，留下")
    run.wait(lambda s: s["cg"] and "unpin" not in s["cg"] and not s["veiled"], "亲密场景的画面", 8)
    page.wait_for_timeout(800)
    asked = run.adult_requests()
    assert asked and all(ADULT_RE.search(u) for u in asked), "同意之后应当请求成人 CG"
    adult_obs["adultOn"] = {"requestsBeforeConsent": 0, "requestsAfterConsent": len(asked)}
    assert not run.errors, f"运行中有报错：{run.errors}"
    return obs


def narrow(browser, base: str, shots: bool) -> dict:
    """390×844：走到第一个限时抉择，核对选项、灯芯与快捷栏都在屏内、互不遮挡。"""
    context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = context.new_page()
    run = Run(page, shots)
    page.goto(base, wait_until="load")
    page.tap("#age-yes")
    page.wait_for_selector("#title.on")
    page.wait_for_timeout(1500)
    run.shot("qa/evidence/narrow-title.jpg")
    page.tap('#title [data-act="new"]')
    run.pass_card("card-chapter")
    tap = lambda: page.tap("#stage", position={"x": 195, "y": 200})
    # 快进碰到没读过的句子就停：停下的同时按钮要熄，触屏点过之后不留一块像「开着」的底（第 4 轮盲玩：停了还像在跑，干等 80 秒）
    run.wait(lambda s: s["beat"] == "line" and s["typed"], "序章第一句打完", 15)
    page.locator('#quick [data-act="skip"]').tap()
    page.wait_for_timeout(500)
    ff = page.evaluate("""() => { const css = (a) => getComputedStyle(document.querySelector(`#quick [data-act="${a}"]`)); return { active: document.querySelector('#quick [data-act="skip"]').classList.contains('active'), bg: css('skip').backgroundColor, idle: css('backlog').backgroundColor, color: css('skip').color, idleColor: css('backlog').color, tag: !document.querySelector('#mode-tag').hidden, toast: document.querySelector('#toast').textContent }; }""")
    assert not ff["active"] and not ff["tag"] and ff["bg"] == ff["idle"] and ff["color"] == ff["idleColor"], f"快进停在没读过的句子上，按钮却还像开着：{ff}"
    assert "快进停在" in ff["toast"], f"快进停下没有说一声：{ff}"
    end = time.time() + 60
    while time.time() < end and run.state()["options"] is None:
        tap()
        page.wait_for_timeout(90)
    page.locator("#choices button", has_text="立刻回家").tap()
    run.pass_card("card-chapter")
    end = time.time() + 90
    while time.time() < end:
        s = run.state()
        if s["options"] is not None and s["timed"]:
            break
        tap()
        page.wait_for_timeout(90)
    page.wait_for_timeout(700)
    boxes = page.evaluate("""() => [...document.querySelectorAll('#choices .choice, #choices .wick, #quick button, #text')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [e.className || e.id || e.dataset.act, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })""")
    outside = [b for b in boxes if b[1] < 0 or b[3] > 390 or b[2] < 0 or b[4] > 844]
    assert not outside, f"窄屏有元素出了屏：{outside}"
    small = page.evaluate("[...document.querySelectorAll('#choices .choice, #quick button')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).length")
    assert small == 0, "窄屏有小于 40px 高的点按目标"
    run.shot("qa/evidence/narrow-choice.jpg")
    # 回看在窄屏：超过一页时翻页条可点，能翻回上一页；刷新后「继续」，回看还带着读档前的句子
    page.locator('#quick [data-act="backlog"]').tap()
    page.wait_for_selector("#book.on", timeout=5000)
    page.wait_for_timeout(400)
    pg = page.evaluate("""() => { const bar = document.querySelector('#book .pg-bar'); const prev = bar?.querySelector('[data-pg="-1"]'); const r = prev?.getBoundingClientRect(); return { lines: document.querySelectorAll('#book .backlog li').length, hidden: !bar || bar.hidden, label: bar?.querySelector('span')?.textContent || '', prev: r ? [r.width, r.height, r.bottom] : null }; }""")
    assert pg["lines"] > 0 and not pg["hidden"] and pg["label"].startswith(pg["label"].split(" / ")[-1]), f"窄屏回看应停在最后一页并带翻页条：{pg}"
    assert pg["prev"] and pg["prev"][0] >= 40 and pg["prev"][1] >= 40 and pg["prev"][2] <= 844, f"窄屏回看的上一页按钮不可点：{pg}"
    page.locator('#book .pg-bar [data-pg="-1"]').tap()
    page.wait_for_timeout(300)
    flipped = page.inner_text("#book .pg-bar span")
    assert flipped != pg["label"], f"窄屏回看翻不回上一页：{pg['label']} → {flipped}"
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    page.reload(wait_until="load")
    page.wait_for_selector("#title.on", timeout=10000)
    page.wait_for_timeout(1300)
    page.tap('#title [data-act="continue"]')
    run.wait(lambda s: s["options"] is not None, "读档回到限时抉择", 15)
    # 「继续」落回最近的选择处要说一声（第 4 轮盲玩：以为存档坏了）
    cont_toast = page.inner_text("#toast")
    assert "最近的选择处" in cont_toast, f"「继续」回到选择处却没有说明：{cont_toast!r}"
    page.locator('#quick [data-act="backlog"]').tap()
    page.wait_for_selector("#book.on", timeout=5000)
    page.wait_for_timeout(400)
    kept = page.locator("#book .backlog li").count()
    assert kept >= pg["lines"] - 1, f"读档后回看丢了读档前的句子：{pg['lines']} → {kept}"
    page.keyboard.press("Escape")
    page.wait_for_selector("#book", state="hidden", timeout=5000)
    page.locator("#choices button", has_text="看向月娘").tap()
    s = run.wait(lambda s: s["video"] and s["video"]["t"] > 1.0, "窄屏过场开播", 15)
    assert not run.errors, f"窄屏有报错：{run.errors}"
    # 五扇门的版式（第 4 轮盲玩：窄屏西厢那句被截成「咱们当…」）：用同一个组件摆出五扇门，量每句门后话是否读得全、门卡是否都在屏内
    doors = page.evaluate("""async () => {
      const { showChoices, closeChoices } = await import('./js/ui/choices.js');
      const { HEROINES } = await import('./js/story/registry.js');
      closeChoices();
      showChoices({ at: 'layout-probe', branch: true, options: HEROINES.map((who, i) => ({ i, who, enabled: true })) }, { onPick: () => {} });
      await new Promise((r) => setTimeout(r, 900));
      const rows = [...document.querySelectorAll('#choices .door')].map((d) => { const q = d.querySelector('q'); const r = d.getBoundingClientRect(); return { who: d.querySelector('em').textContent, clipped: !q || q.scrollHeight > q.clientHeight + 1 || q.scrollWidth > q.clientWidth + 1 || getComputedStyle(q).display === 'none', top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
      closeChoices();
      return rows;
    }""")
    bad = [d for d in doors if d["clipped"] or d["top"] < 0 or d["bottom"] > 844]
    assert len(doors) == 5 and not bad, f"窄屏门卡的话没读全或出了屏：{bad or doors}"
    context.close()
    return {"viewport": "390x844", "reached": "第一章限时抉择与其后的过场", "elementsOutsideViewport": 0,
            "fastForwardStop": {"buttonIdleAfterStop": True, "toast": ff["toast"]}, "continueToast": cont_toast,
            "doorLinesReadable": [d["who"] for d in doors],
            "backlog": {"lines": pg["lines"], "pages": pg["label"], "flippedTo": flipped, "afterReloadContinue": kept}}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-evidence", action="store_true")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--out", type=Path, help="验证记录与截图写到这个目录（默认是示例目录本身，即 qa/ 与 screenshots/）")
    args = parser.parse_args()
    global OUT
    if args.out:
        OUT = args.out.resolve()
        args.write_evidence = True
    port = free_port()
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}/"
    checks = {name: "NOT_RUN" for name in CHECKS}
    obs: dict = {}
    suites: dict = {}
    trace: list[str] = []
    environment: dict = {}
    error = None
    try:
        for _ in range(50):
            try:
                urlopen(base, timeout=1).close()
                break
            except OSError:
                time.sleep(0.1)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=not args.headed)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            run = Run(context.new_page(), args.write_evidence)
            environment = {"browser": f"Chromium {browser.version}", "driver": "Playwright (Python)", "viewport": "1440x900", "cleanContext": "全新浏览器上下文，无存档", "when": dt.datetime.now().astimezone().isoformat(timespec="seconds")}
            try:
                play(run, base, obs)
            finally:
                trace = run.trace
            context.close()
            suites["narrow-390x844"] = narrow(browser, base, args.write_evidence)
            browser.close()
        for name in CHECKS:
            checks[name] = "PASS" if name in obs else "FAIL"
    except Exception as exc:  # noqa: BLE001 — 失败也要整份重写记录
        error = f"{type(exc).__name__}: {exc}"
        traceback.print_exc()
        for name in CHECKS:
            checks[name] = "PASS" if name in obs else "FAIL"
    finally:
        server.terminate()

    status = "PASS" if error is None and all(v == "PASS" for v in checks.values()) else "FAIL"
    print(f"{status}  " + "  ".join(f"{k}={v}" for k, v in checks.items()))
    if error:
        print(error)
    if args.write_evidence:
        blank = {"id": "not-reached", "inputs": ["未走到这一步"], "state": {"reached": False}}
        observations = {name: obs.get(name, blank) for name in CHECKS}
        if "render" in observations and "visual" not in observations["render"]:
            observations["render"]["visual"] = "screenshots/title.jpg"
        write_json(OUT / "qa" / "evidence" / "run.json", {
            "schemaVersion": 1,
            "runId": RUN_ID,
            "environment": environment or {"note": "浏览器没有启动"},
            "inputTrace": trace or ["未能开始"],
            "observations": observations,
        })
        verify = {"command": COMMAND, "exitCode": 0 if status == "PASS" else 1}
        if suites:
            verify["suites"] = suites
        write_json(OUT / "qa" / "verification.json", {
            "schemaVersion": 3,
            "status": status,
            "verify": verify,
            "completeRun": {"id": RUN_ID, "cleanContext": True, "terminal": "yue_good", "restart": "prologue-first-line", "evidence": "qa/evidence/run.json"},
            "checks": checks,
            "limitations": LIMITATIONS if error is None else [*LIMITATIONS, {"scope": "本次运行失败", "reason": error[:300]}],
        })
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
