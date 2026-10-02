#!/usr/bin/env python3
"""唯一权威完整路径：年龄门 → 标题 → 共通线 → 选择 → 吴月娘线 → 良缘结局 → 原著命数 → 回标题重开。

真实 Chromium + Playwright 点击／按键；不调用任何游戏内部函数。--write-evidence 时写
qa/verification.json、qa/evidence/run.json 与三张截图（标题、ADV 场景、结局）。
"""

from __future__ import annotations

import argparse
import datetime as dt
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
QA = EXAMPLE / "qa"
RUN_ID = "jin-ping-mei-galgame-2026-10"
COMMAND = "cd examples/jin-ping-mei/build/app && python3 test/verify_visual.py --write-evidence"
SHOTS = {"title": "screenshots/title.jpg", "adv": "screenshots/adv.jpg", "ending": "qa/evidence/ending.jpg"}
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")
# 月娘良缘的一条完整选择：按选项里出现的字找按钮
PLAN = ["立刻回家", "看向月娘", "正院 · 月娘还在", "先别吵", "箱子我替你守着", "听月娘的", "正院 · 月娘",
        "沉下脸", "给月娘", "吴月娘", "那件事，是我不对", "糖兔子", "家里的账，大姐管", "推门进去", "只陪她坐着"]
LIMITATIONS = [
    {"scope": "路径覆盖", "reason": "浏览器只走月娘良缘一条完整路径；其余 15 个结局由 test/lint_script.mjs 穷举选择证明可达，未逐一在浏览器渲染。"},
    {"scope": "成人画面", "reason": "权威路径选择不进入亲密场景，成人 CG 的显示与帘幕替代只做过人工抽查。"},
    {"scope": "视口与浏览器", "reason": "只在 1440×900 Chromium 运行；窄屏布局与其他浏览器未纳入本次运行。"},
    {"scope": "体验判断", "reason": "自动化只证明能启动、渲染、输入、走到结局并重开，不判断剧情是否动人或节奏是否合适。"},
]


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def verification(status: str, checks: dict, terminal: str, restart: str) -> dict:
    return {
        "schemaVersion": 3,
        "status": status,
        "verify": {"command": COMMAND, "exitCode": 0 if status == "PASS" else 1},
        "completeRun": {"id": RUN_ID, "cleanContext": True, "terminal": terminal, "restart": restart, "evidence": "qa/evidence/run.json"},
        "checks": checks,
        "limitations": LIMITATIONS,
    }


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def run(write: bool) -> None:
    if write:
        write_json(QA / "verification.json", verification("FAIL", {k: "NOT_RUN" for k in CHECKS}, "NOT_RUN", "NOT_RUN"))
    port = free_port()
    url = f"http://127.0.0.1:{port}/"
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=APP,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    obs: dict = {}
    trace: list[str] = []
    try:
        for _ in range(60):
            try:
                urlopen(url, timeout=0.2)
                break
            except OSError:
                time.sleep(0.05)
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            errors: list[str] = []
            requests: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("requestfailed", lambda r: errors.append(f"failed {r.url}"))
            page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
            page.on("request", lambda r: requests.append(r.url))
            shot = lambda key: page.screenshot(path=str(EXAMPLE / SHOTS[key]), type="jpeg", quality=82)

            # launch：年龄门在前，确认前不请求任何成人 CG
            page.goto(url)
            page.wait_for_selector("#gate:not([hidden])")
            adult_before = [u for u in requests if "/explicit" in u or "/prelude" in u]
            page.click("#btn-age-yes")
            page.wait_for_selector("#title:not([hidden])")
            page.wait_for_timeout(2600)
            shot("title")
            obs["launch"] = {"id": "age-gate-then-title", "inputs": ["打开页面", "点击「我已成年，进入」"],
                             "state": {"ageGateFirst": True, "adultRequestsBeforeConfirm": len(adult_before),
                                       "titleMenu": page.locator(".title-menu button").all_inner_texts()},
                             "visual": SHOTS["title"]}
            assert not adult_before
            trace.append("点击年龄门确认，进入动画标题。")

            # input：在设置里把文字速度拖到瞬间（真实滑杆输入），再开始游戏
            page.click('.title-menu [data-act="config"]')
            page.locator('input[data-cfg="textSpeed"]').fill("100")
            page.click('#overlay [data-act="close"]')
            page.click('.title-menu [data-act="new"]')
            page.wait_for_selector("#game:not([hidden])")
            chapter_card = page.inner_text("#card")
            page.mouse.click(720, 300)  # 点掉序章标题卡
            first_line = page.inner_text("#text")
            page.mouse.click(720, 300)
            after_click = page.inner_text("#text")
            page.keyboard.press("Enter")
            after_key = page.inner_text("#text")
            assert "序章" in chapter_card and first_line and first_line != after_click != after_key, "点击／回车没有推进文字"
            trace.append("设置里把文字速度调到瞬间；开始游戏后用鼠标点击和回车各推进一句。")

            plan = list(PLAN)
            chapters: list[str] = []
            adv_state = None
            quick = None
            for _ in range(2000):
                if page.is_visible("#title"):
                    break
                card = page.locator("#card:not([hidden])")
                if card.count():
                    cls = card.get_attribute("class") or ""
                    text = card.inner_text()
                    if "chapter" in cls:
                        chapters.append(text.split("\n")[1] if "\n" in text else text)
                    if "ending" in cls and "ending" not in obs:
                        page.wait_for_timeout(1600)  # 结局卡出现后 1.5 秒内的点击会被挡下
                        shot("ending")
                        obs["outcome"] = {"id": "yue-good-ending", "inputs": ["按计划在每个选项处点击", "读完月娘线"],
                                          "state": {"endingCard": " / ".join(t for t in text.split("\n") if t.strip()),
                                                    "recorded": page.evaluate("JSON.parse(localStorage.getItem('jpm2_global')||'{}').ending||[]"),
                                                    "terminal": "yue_good"},
                                          "visual": SHOTS["ending"]}
                        trace.append("走到「吴月娘篇 · 良缘结局 · 月下焚香」。")
                    if "fate" in cls and "fatePage" not in obs["outcome"]["state"]:
                        page.wait_for_timeout(5100)  # 命数页逐行浮现，5 秒内的点击只会整页显出
                        obs["outcome"]["state"]["fatePage"] = page.inner_text(".fate-inner h2")
                        trace.append("点开原著命数页（第七十九回、第一百回）后回到标题。")
                choices = page.locator("#choices:not([hidden]) button.choice")
                if choices.count():
                    want = plan.pop(0)
                    texts = choices.all_inner_texts()
                    index = next((i for i, t in enumerate(texts) if want in t), None)
                    assert index is not None, f"找不到选项「{want}」：{texts}"
                    if want == "吴月娘":
                        obs["coreLoop"] = {"id": "common-route-to-branch", "inputs": PLAN[:9],
                                           "state": {"chapters": list(chapters), "openDoors": [t.split("\n")[1] for t in texts
                                                     if not choices.nth(texts.index(t)).is_disabled()]}}
                    page.wait_for_timeout(500)  # 选项出现后 450ms 内的点击会被挡下
                    choices.nth(index).click()
                    continue
                name = page.inner_text("#nameplate") if page.is_visible("#nameplate") else ""
                if adv_state is None and name.startswith("玉楼") and page.locator(".sprite").count() >= 3:
                    page.wait_for_timeout(700)
                    shot("adv")
                    adv_state = page.evaluate("""() => ({
                      nameplate: document.querySelector('#nameplate').textContent,
                      sprites: [...document.querySelectorAll('.sprite')].map(s => s.dataset.who + (s.classList.contains('dim') ? ':dim' : ':speaking')),
                      spritesLoaded: [...document.querySelectorAll('.sprite img')].every(i => i.complete && i.naturalWidth > 0),
                      background: document.querySelector('.bg.on').dataset.bg })""")
                    assert adv_state["spritesLoaded"]
                    # 快存 → 推进两句 → 快读，应回到同一句；再开回看记录
                    saved_line = page.inner_text("#text")
                    page.click('#quickmenu [data-act="qsave"]')
                    page.wait_for_selector('#toast:has-text("已快速存档")')
                    page.keyboard.press("Enter")
                    page.keyboard.press("Enter")
                    page.click('#quickmenu [data-act="qload"]')
                    page.wait_for_timeout(300)
                    restored = page.inner_text("#text")
                    page.mouse.move(720, 300)
                    page.mouse.wheel(0, -200)
                    page.wait_for_selector(".backlog li")
                    backlog = page.locator(".backlog li").count()
                    page.keyboard.press("Escape")
                    quick = {"savedLine": saved_line, "restoredLine": restored, "backlogEntries": backlog}
                    assert saved_line == restored and backlog > 5, quick
                    trace.append("在三人同场的晚饭戏截图；快存、推进两句、快读回到同一句；滚轮上翻打开回看记录后关闭。")
                page.keyboard.press("Enter")
            assert page.is_visible("#title") and not plan, f"没有走完：剩余选择 {plan}"
            obs["render"] = {"id": "adv-scene-three-sprites", "inputs": ["读到晚饭戏玉楼开口"],
                             "state": adv_state, "visual": SHOTS["adv"]}
            obs["input"] = {"id": "click-enter-wheel-quicksave", "inputs": ["设置滑杆", "鼠标点击", "回车", "快存／快读", "滚轮回看", "选项点击"],
                            "state": {"firstLine": first_line, "afterClick": after_click, "afterEnter": after_key, **quick}}

            # restart：回到标题后「继续」可用，「开始游戏」从序章第一句重来
            continue_enabled = page.locator('.title-menu [data-act="continue"]').is_enabled()
            page.click('.title-menu [data-act="new"]')
            page.wait_for_selector("#game:not([hidden])")
            page.mouse.click(720, 300)
            restart_line = page.inner_text("#text")
            assert restart_line == first_line
            obs["restart"] = {"id": "title-new-game", "inputs": ["结局后回到标题", "点击「开始游戏」"],
                              "state": {"continueEnabled": continue_enabled, "firstLine": restart_line, "restart": "prologue-first-line"}}
            trace.append("回到标题后重新开始，回到序章第一句。")
            assert not errors, errors
            version = browser.version
            browser.close()
    finally:
        server.terminate()

    print(f"PASS：{len(chapters)} 张章节卡，结局 {obs['outcome']['state']['endingCard']}")
    if write:
        write_json(QA / "evidence" / "run.json", {
            "schemaVersion": 1,
            "runId": RUN_ID,
            "environment": {"browser": f"Chromium {version}", "viewport": "1440x900", "runtime": "临时本地 HTTP 服务 + Python Playwright",
                            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")},
            "inputTrace": trace,
            "observations": {k: obs[k] for k in CHECKS},
        })
        write_json(QA / "verification.json", verification("PASS", {k: "PASS" for k in CHECKS}, "yue_good", "prologue-first-line"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-evidence", action="store_true")
    run(parser.parse_args().write_evidence)
