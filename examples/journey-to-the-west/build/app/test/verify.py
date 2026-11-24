#!/usr/bin/env python3
"""浏览器端到端完整路径验证：真实浏览器、真实点击与按键，从干净初态走到结局再重开。

    python3 test/verify.py            # 在 build/app 下运行；自己起本地服务，结束后关掉
    python3 test/verify.py --slow     # 不带 fast 参数，按常速演出（很慢，排障用）
    python3 test/verify.py --out DIR  # 记录与截图写到 DIR（自测用），不动 qa/

不注入存档、不调内部接口：只点界面、按空格，读取 window.xiyou.snapshot() 这份只读快照做判断与留证。
无论成败都整份重写 qa/verification.json 与 qa/evidence/run.json（给了 --out 则写到那个目录）。
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import socket
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]
EXAMPLE = APP.parents[1]
QA = EXAMPLE / "qa"
EVIDENCE = QA / "evidence"
COMMAND = "cd examples/journey-to-the-west/build/app && python3 test/verify.py"
RUN_ID = "three-fans-main-path"
CHECKS = ("launch", "render", "input", "coreLoop", "outcome", "restart")

# 剧情抉择：一条有代表性的路线
CHOICES = {
    "choice-approach": "calm", "choice-treasure": "dingfengdan", "choice-fantrial": "ember", "choice-deal": "keep",
    "choice-loot": "ruyibang_jing", "choice-pond1": "crab", "choice-pond2": "shift", "choice-bajie": "check",
}
BEATS = {"金": "木", "木": "土", "土": "水", "水": "火", "火": "金"}
SKILLS = {  # 技能键 -> (耗法, 目标)
    "ruyibang": (16, "enemy"), "qitian": (24, "enemy"), "hengsao": (20, "enemies"), "zhenhai": (26, "enemies"),
    "jiuchipaba": (16, "enemies"), "hengpa": (18, "enemies"), "tunshan": (20, "enemy"), "gongdi": (18, "enemy"),
    "xiangyaozhang": (14, "enemy"), "liusha": (18, "enemy"), "luohanjinshen": (30, "party"),
    "pishuijue": (24, "enemies"), "jinglang": (28, "enemies"), "bingfeng": (24, "enemy"),
    "huolian": (14, "enemy"), "fenye": (20, "enemies"), "chiyan": (16, "enemy"), "xuanbing_ji": (0, "enemy"),
}
SINGLE_PREF = ["qitian", "ruyibang", "tunshan", "liusha", "xiangyaozhang", "bingfeng", "chiyan", "huolian"]
AREA_PREF = ["zhenhai", "hengsao", "hengpa", "jiuchipaba", "jinglang", "pishuijue", "fenye"]


class Failure(Exception):
    pass


class Run:
    def __init__(self, page, fast: bool):
        self.page = page
        self.fast = fast
        self.trace: list[str] = []
        self.console: list[str] = []
        self.observations: dict[str, dict] = {}
        self.battles: list[dict] = []
        self.started = time.time()
        self.catch_tried = False
        self.shopped = False
        self.bounty_done = False
        self.reloaded = False
        self.formation_set = False
        self.fan_checks: list[dict] = []   # 决战每次下令时真扇提示在不在
        self.ending_holds: list[dict] = []  # 结局每句字幕不操作时停了多久
        self.choice_guard: dict | None = None  # 剧情抉择弹出后连按空格/回车，不该替玩家定分支
        self.lingji_bg: str | None = None       # 灵吉对白时的底景
        self.bull_goals: list[str] = []         # 白牛在场时「此战」写的什么
        self.bull_down_open = False             # 白牛已伏地而战斗还没结束
        self.demon_click: dict | None = None    # 直接点游走火妖是否开战
        self.relief_watch = False
        self.relief: list[dict] = []
        self.charge_checks: list[dict] = []     # 决战蓄力时预警点的名与锁定目标是否一致
        self.cmd_guard: dict | None = None      # 指令台一亮就点下去（连点对白的余波）不该替人下令
        self.repeat_labels: list[str] = []      # 「沿用」按钮上写的将沿用的指令
        self.finisher_goal: str | None = None   # 二借罗刹女露疲态时「此战」写的什么
        page.on("console", lambda m: self.console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: self.console.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: self.console.append(f"requestfailed: {r.url}"))

    # ---------- 基础 ----------
    def snap(self) -> dict:
        return self.page.evaluate("window.xiyou.snapshot()")

    def step(self, text: str) -> None:
        self.trace.append(text)

    def vis(self, sel: str) -> bool:
        loc = self.page.locator(sel)
        return loc.count() > 0 and loc.first.is_visible()

    def click(self, sel: str, note: str | None = None) -> None:
        # 新弹出的层（指令台、结算卡、抉择、确认框）刚出现的一小会儿不认点击：像玩家一样等它亮起再点
        self.page.wait_for_function(
            "(sel) => { const el = document.querySelector(sel); const g = el && el.closest('[data-armed]'); return !g || g.dataset.armed !== '0'; }",
            arg=sel, timeout=5000)
        self.page.locator(sel).first.click(timeout=10000)
        if note:
            self.step(note)

    def key(self, key: str) -> None:
        self.page.keyboard.press(key)

    def wait(self, ms: int) -> None:
        self.page.wait_for_timeout(ms)

    def shot(self, name: str, folder: Path | None = None) -> str:
        folder = folder or EVIDENCE
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{name}.jpg"
        self.page.screenshot(path=str(path), type="jpeg", quality=80)
        return path.relative_to(EXAMPLE).as_posix() if path.is_relative_to(EXAMPLE) else path.as_posix()

    def observe(self, check: str, oid: str, inputs: list[str], state: dict, visual: str | None = None) -> None:
        entry = {"id": oid, "inputs": inputs, "state": state}
        if visual:
            entry["visual"] = visual
        self.observations[check] = entry

    def canvas_ink(self) -> int:
        """场景画布上取样点里有多少种颜色：全黑或单色说明没画出来。"""
        return self.page.evaluate(
            """() => { const c = document.querySelector('.world-canvas'); if (!c) return 0;
            const x = c.getContext('2d'); const seen = new Set();
            for (let i = 1; i < 9; i++) for (let j = 1; j < 9; j++) { const d = x.getImageData(c.width * i / 9, c.height * j / 9, 1, 1).data; seen.add(d[0] + ',' + d[1] + ',' + d[2]); }
            return seen.size; }"""
        )

    # ---------- 交战 ----------
    def command(self, s: dict, uid: str) -> None:
        b = s["battle"]
        units = {u["id"]: u for u in b["units"]}
        me = units[uid]
        foes = [u for u in b["units"] if u["side"] == "enemy" and u["alive"]]
        allies = [u for u in b["units"] if u["side"] == "party" and u["alive"]]
        bid = b["id"]
        items = b["items"]
        boss_charging = next((u for u in foes if u["charging"]), None)
        locked = units.get(boss_charging["chargeTarget"]) if boss_charging and boss_charging.get("chargeTarget") else None
        lowest = locked if locked and locked["alive"] else min(allies, key=lambda u: u["hp"])
        has = lambda sel: self.vis(sel)

        def target(pref_keys=()):
            for k in pref_keys:
                for f in foes:
                    if f["key"] == k:
                        return f
            ke = [f for f in foes if BEATS.get(me["element"]) == f["element"]]
            return (ke or sorted(foes, key=lambda f: f["hp"]))[0]

        def do_attack(t):
            self.click('[data-cmd="attack"]')
            # 首战第一下直接点场上的人，其余点列表，两种入口都走到
            if bid == "luosha1" and b["round"] == 1:
                self.click(f'.unit[data-id="{t["id"]}"] .unit-hit', f'{me["name"]}：攻击，点场上的{t["name"]}')
            else:
                self.click(f'[data-target="{t["id"]}"]', f'{me["name"]}：攻击 {t["name"]}')

        def pick(sel):
            # 子菜单一页只摆排得下的几格：要点的那一格不在这一页就往后翻
            for _ in range(4):
                if self.page.locator(sel).count():
                    break
                self.click('.cmd-pager [data-page="next"]')
            self.click(sel)

        def do_skill(key, t=None):
            self.click('[data-cmd="skill"]')
            pick(f'[data-skill="{key}"]')
            if SKILLS[key][1] == "enemy":
                self.click(f'[data-target="{t["id"]}"]')
            self.step(f'{me["name"]}：法术 {key}' + (f' → {t["name"]}' if t else ''))

        def do_item(key, tid=None, note=""):
            self.click('[data-cmd="item"]')
            pick(f'[data-item="{key}"]')
            if tid:
                self.click(f'[data-target="{tid}"]')
            self.step(f'{me["name"]}：道具 {key} {note}')

        def do_form(form):
            self.click('[data-cmd="special"]')
            self.click(f'[data-form="{form}"]', f'{me["name"]}：七十二变 {form}')

        def best(pool, kind):
            for k in pool:
                if k in me_skills and SKILLS[k][0] <= me["mp"] and SKILLS[k][1] == kind:
                    return k
            return None

        me_skills = ["xuanbing_ji"] if me["form"] == "xuangui" else ([] if me["form"] else me["skills"])

        # 首战照着指点走一遍：攻击、法术、防御三种入口
        if bid == "luosha1" and b["round"] == 1:
            if me["key"] == "wukong":
                return do_attack(target(("luosha",)))
            if me["key"] == "bajie":
                return do_skill("jiuchipaba")
            return self.click('[data-cmd="defend"]', f'{me["name"]}：防御')
        # 老牛蓄力：被盯上的人防御
        if boss_charging and lowest["id"] == uid:
            return self.click('[data-cmd="defend"]', f'{me["name"]}：防御（被蓄力盯上）')
        # 血少先吃药
        if me["hp"] / me["maxHp"] < 0.38 and items.get("jinchuang", 0) > 0 and not getattr(self, "_potion_round", None) == (b["round"], uid):
            self._potion_round = (b["round"], uid)
            return do_item("jinchuang", uid, "给自己")
        if me["key"] == "wukong":
            luosha = next((f for f in foes if f["key"] == "luosha"), None)
            if bid == "luosha" and luosha and luosha["hp"] / luosha["maxHp"] <= 0.45:
                return do_form("chongzi")
            if bid == "firemobs" and not me["form"]:
                return do_form("xuangui")
        # 火兵气血低于四成时试一次捕妖绳
        if bid == "firemobs" and me["key"] == "sha" and not self.catch_tried and items.get("buyaosheng", 0) > 0:
            weak = next((f for f in foes if f["catchKey"] and f["hp"] / f["maxHp"] <= 0.4), None)
            if weak:
                self.catch_tried = True
                return do_item("buyaosheng", weak["id"], f'捆 {weak["name"]}')
        # 决战：沙僧执扇，三扇依次扇出
        if bid == "niumowang" and me["key"] == "sha" and b["fanStage"] < 3 and items.get("truefan", 0) > 0:
            bull = next((f for f in foes if f["key"] == "whitebull"), None)
            if (b["fanStage"] == 0 and b["round"] >= 2) or (b["fanStage"] >= 1 and bull):
                self.fan_queued = (b["round"], b["fanStage"])
                return do_item("truefan", None, f'第 {b["fanStage"] + 1} 扇')
        prefer = {"luosha": ("luosha",), "firemobs": ("firemob2",), "yumian": ("yaojiang",), "niumowang": ("whitebull", "niumowang")}.get(bid, ())
        t = target(prefer)
        single = best(SINGLE_PREF, "enemy")
        area = best(AREA_PREF, "enemies")
        if single and (len(foes) < 3 or bid in ("luosha", "niumowang", "yumian", "firemobs")):
            return do_skill(single, t)
        if area and len(foes) >= 2:
            return do_skill(area)
        if single:
            return do_skill(single, t)
        return do_attack(t)

    def battle_tick(self, s: dict) -> None:
        b = s["battle"]
        root = self.page.locator('[data-ui="battle"]').first
        if self.cmd_guard is None and b["id"] == "luosha1":
            # 像连点对白的玩家：首战指令台一亮起就点到「防御」的位置（这一下不该替悟空下令）
            self.page.wait_for_selector('[data-ui="battle"][data-phase="command"] .cmd-panel[data-mode="main"][data-armed="0"] [data-cmd="defend"]', timeout=30000)
            box = self.page.locator('[data-cmd="defend"]').bounding_box()
            self.page.mouse.click(box["x"] + 12, box["y"] + 12)
            queued = self.page.evaluate("[...document.querySelectorAll('.cmd-side .queued div')].map(n => n.textContent)")
            self.cmd_guard = {"queuedAfterInstantClick": queued}
            self.step("首战指令台刚亮起就点「防御」的位置（连点余波）")
            if queued:
                raise Failure(f"指令台刚亮起的那一下点击被当成了下令：{queued}")
            return
        phase = root.get_attribute("data-phase")
        if phase != "command":
            return
        if b["id"] == "niumowang" and not self.relief_watch:
            # 白牛现形时土地接力：记下土地立绘是否真的上场、横幅写了什么
            self.relief_watch = True
            self.page.evaluate("""() => { window.__relief = window.__relief || []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) {
                if (n.nodeType === 1 && n.matches?.('[data-ui=relief]')) window.__relief.push({ art: n.style.backgroundImage, at: Date.now() });
                if (n.nodeType === 1 && n.matches?.('.banner') && n.textContent.includes('接力')) window.__relief.push({ banner: n.textContent });
            } }).observe(document.body, { childList: true, subtree: true }); }""")
        if b["id"] == "niumowang" and not self.formation_set and b["formation"] != "liuding":
            self.formation_set = True
            self.click('[data-ui="formation"]', "决战：换六丁阵")
            self.wait(80)
            return
        uid = root.get_attribute("data-turn")
        if not uid:
            return
        if self.page.locator('.cmd-panel[data-armed="1"]').count() == 0:
            return  # 指令台还在防误触的那一小会儿里
        if self.vis('.cmd-panel[data-mode="main"] [data-cmd="repeat"]:not(:disabled)'):
            label = self.page.locator('[data-cmd="repeat"] [data-ui="repeat-what"]').inner_text() if self.vis('[data-cmd="repeat"] [data-ui="repeat-what"]') else ""
            if len(self.repeat_labels) < 12 and label not in self.repeat_labels:
                self.repeat_labels.append(label)
            if not label:
                raise Failure("「沿用」按钮没写明将沿用什么")
        if b["id"] == "luosha" and self.finisher_goal is None and any(u["key"] == "luosha" and u["alive"] and u["hp"] / u["maxHp"] <= 0.45 for u in b["units"]):
            self.finisher_goal = self.page.evaluate("document.querySelector('[data-ui=battle-goal]')?.textContent ?? ''")
            if "特技" not in self.finisher_goal:
                raise Failure(f"罗刹女已露疲态，「此战」仍是旧说法：{self.finisher_goal!r}")
        if b["id"] == "niumowang" and self.vis('.cmd-panel[data-mode="main"]'):
            coach = self.page.evaluate("() => document.querySelector('[data-ui=coach]')?.textContent ?? ''")
            glow = self.page.locator('.cmd-panel [data-cmd="item"].glow').count() > 0
            queued = getattr(self, "fan_queued", None) == (b["round"], b["fanStage"])  # 这回合已有人领扇
            if any(u["key"] == "whitebull" and u["alive"] for u in b["units"]):
                g = self.page.evaluate("document.querySelector('[data-ui=battle-goal]')?.textContent ?? ''")
                if g and g not in self.bull_goals:
                    self.bull_goals.append(g)
            charger = next((u for u in b["units"] if u["side"] == "enemy" and u["alive"] and u["charging"]), None)
            if charger:
                warn = self.page.evaluate("document.querySelector('[data-ui=warn]')?.textContent ?? ''")
                locked = next((u for u in b["units"] if u["id"] == charger.get("chargeTarget")), None)
                self.charge_checks.append({"round": b["round"], "turn": uid, "warn": warn, "locked": locked["name"] if locked else None,
                                           "namesLocked": bool(locked and locked["alive"] and locked["name"] in warn)})
            self.fan_checks.append({"round": b["round"], "turn": uid, "fanStage": b["fanStage"], "queuedThisRound": queued, "fanCoach": "【道具】" in coach, "itemGlow": glow})
        try:
            self.command(self.snap(), uid)
        except Exception as error:  # 面板在演出与下令之间切换时可能点空，下一拍重读状态
            self.trace.append(f"（重读状态：{type(error).__name__}）")
            if self.vis('[data-cmd="back"]'):
                try:
                    self.click('[data-cmd="back"]')
                except Exception:
                    pass
        self.wait(40)

    # ---------- 寻宝 ----------
    def hunt_tick(self) -> None:
        if self.vis('[data-guide="wukong"]'):
            return self.click('[data-guide="wukong"]', "火脉残图：悟空探路")
        for act in ("leave", "finish", "deep"):
            if self.vis(f'[data-act="{act}"]'):
                return self.click(f'[data-act="{act}"]', f"火脉残图：{act}")
        tiles = self.page.locator(".tile:not(:disabled):not(.marked)")
        if tiles.count() > 0:
            idx = tiles.first.get_attribute("data-tile")
            return self.click(f'.tile[data-tile="{idx}"]', f"火脉残图：掘第 {idx} 块")

    # ---------- 场景 ----------
    def world_tick(self, s: dict) -> None:
        w = s["world"]
        c = s["campaign"]
        if not w or w["hidden"] or w["busy"] or w["moving"] or not w["mapReady"]:
            return
        # 借过一回扇之后：买一贴药、分配一次成长、做一环封妖，再接主线
        if c["stage"] == "borrow2" and not self.bounty_done:
            if sum(c["points"].values()) > 0 and not getattr(self, "_grown", False):
                self._grown = True
                self.click('[data-icon="hero"]', "打开【角色】")
                for member in ("wukong", "bajie", "sha"):
                    self.click(f'[data-member="{member}"]')
                    self.click('[data-act="recommend"]', f"{member}：推荐加点")
                    self.click('[data-tab="skills"]')
                    self.click('[data-act="recommend"]', f"{member}：推荐修炼")
                    self.click('[data-tab="stats"]')
                self.click('[data-ui="panel"] [data-act="close"]', "关闭面板")
                return
            b = c["bounty"]
            if b["state"] == "hunt" and self.demon_click is None and any(a["id"].startswith("demon") for a in w["actors"]):
                return self.click_demon()
            if b["state"] == "idle" or b["state"] == "hunt":
                return self.click('[data-quest="bounty"]', "点【日常】任务：自动寻路")
        if c["stage"] == "borrow2" and self.bounty_done and not self.shopped and c["money"] >= 40 and w["scene"] == "village":
            self.shopped = True
            return self.shop()
        # 之后每次升级都把点数用掉
        if sum(c["points"].values()) + sum(c["skillPoints"].values()) > 0 and c["stage"] not in ("ask", "borrow1", "borrow2"):
            self.click('[data-icon="hero"]', "打开【角色】分配成长")
            for member in ("wukong", "bajie", "sha"):
                self.click(f'[data-member="{member}"]')
                if self.page.locator('[data-act="recommend"]:not(:disabled)').count():
                    self.click('[data-act="recommend"]')
                self.click('[data-tab="skills"]')
                if self.page.locator('[data-act="recommend"]:not(:disabled)').count():
                    self.click('[data-act="recommend"]')
                self.click('[data-tab="stats"]')
            self.click('[data-ui="panel"] [data-act="close"]')
            if c["pets"]:
                self.click('[data-icon="pet"]', "打开【召唤兽】分配成长")
                for pet in c["pets"]:
                    self.click(f'[data-member="{pet["key"]}"]')
                    if self.page.locator('[data-act="recommend"]:not(:disabled)').count():
                        self.click('[data-act="recommend"]')
                    self.click('[data-tab="skills"]')
                    if self.page.locator('[data-act="recommend"]:not(:disabled)').count():
                        self.click('[data-act="recommend"]')
                    self.click('[data-tab="stats"]')
                self.click('[data-ui="panel"] [data-act="close"]')
            return
        self.click('[data-quest="main"]', f'点【主线】任务（{c["stage"]}）：自动寻路')
        self.wait(250)

    def click_demon(self) -> None:
        """封妖令：不用任务追踪，直接点场上游走的火妖；点下去前停一拍（像玩家看准再点），它挪开也该追上去开打。"""
        canvas = self.page.locator(".world-canvas").bounding_box()
        for _ in range(12):
            demon = next((a for a in self.snap()["world"]["actors"] if a["id"].startswith("demon")), None)
            if not demon:
                return
            if 80 < demon["sx"] < canvas["width"] - 80 and 80 < demon["sy"] < canvas["height"] - 120:
                break
            self.page.mouse.click(canvas["x"] + min(canvas["width"] - 120, max(120, demon["sx"])), canvas["y"] + min(canvas["height"] - 160, max(140, demon["sy"])))
            self.step("点地面：朝游走的火妖走近")
            for _ in range(60):
                self.wait(100)
                if not self.snap()["world"]["moving"]:
                    break
        self.wait(1000)
        self.page.mouse.click(canvas["x"] + demon["sx"], canvas["y"] + demon["sy"] + 30)
        self.step("停一拍后直接点场上的火妖（点在身子下半与名牌一带）")
        started = time.time()
        while time.time() - started < 15:
            self.wait(150)
            if self.snap()["battle"] or self.vis('[data-ui="battle"]'):
                break
        battle = self.snap()["battle"]
        self.demon_click = {"clickedAt": [demon["sx"], demon["sy"] + 30], "battle": battle["id"] if battle else None, "seconds": round(time.time() - started, 1)}
        if not battle or not battle["id"].startswith("bounty"):
            raise Failure(f"直接点游走的火妖没有开战：{self.demon_click}")

    def shop(self) -> None:
        """走到卖糕少年跟前买一贴金疮药：点小地图走近，再直接点场上的人。"""
        self.step("点小地图：走到卖糕少年附近")
        box = self.page.locator('[data-ui="minimap"] canvas').bounding_box()
        self.page.mouse.click(box["x"] + box["width"] * 760 / 2400, box["y"] + box["height"] * 1000 / 1600)
        for _ in range(100):
            self.wait(120)
            if not self.snap()["world"]["moving"]:
                break
        npc = next((a for a in self.snap()["world"]["actors"] if a["id"] == "gaoshao"), None)
        if not npc:
            raise Failure("场景里找不到卖糕少年")
        canvas = self.page.locator(".world-canvas").bounding_box()
        self.page.mouse.click(canvas["x"] + npc["sx"], canvas["y"] + npc["sy"])
        self.step("点场上的卖糕少年")
        self.page.wait_for_selector('[data-ui="npc-menu"]', timeout=15000)
        self.click('[data-ui="npc-menu"] [data-key="shop"]', "卖糕少年：买丹药")
        before = self.snap()["campaign"]["items"].get("jinchuang", 0)
        self.click('[data-buy="jinchuang"]', "买金疮药一贴")
        after = self.snap()["campaign"]["items"].get("jinchuang", 0)
        if after != before + 1:
            raise Failure("买药后金疮药数量没有 +1")
        self.click('[data-ui="panel"] [data-act="close"]')


    # ---------- 结局字幕 ----------
    def read_ending(self, label: str) -> None:
        """不操作时每句字幕都得停住（至少按字数给足阅读时间），提示语与行为一致；按空格才翻到下一句。"""
        self.page.wait_for_function("(() => { const r = document.querySelector('[data-ui=ending]'); return r && r.dataset.step !== '0'; })()", timeout=30000)
        while not self.vis('[data-ui="ending-end"]'):
            step = self.page.locator('[data-ui="ending"]').get_attribute("data-step")
            text = self.page.locator('.ending-text').inner_text().strip()
            chars = len("".join(text.split()))
            scene = self.page.locator('[data-ui="ending"]').get_attribute("data-scene")
            if scene == "fire" and any(k in text for k in ("退去", "灰烬", "落雨", "无火", "雨后")):
                raise Failure(f"结局第 {step} 句写火已退，画面仍是烈火地景：{text[:20]}")
            hold = max(3.0, chars / 6 + 1)  # 每秒六字再加一秒
            self.wait(int(hold * 1000))
            after = self.page.locator('[data-ui="ending"]').get_attribute("data-step")
            hint = self.page.locator('[data-ui="ending-hint"]').inner_text() if self.vis('[data-ui="ending-hint"]') else ""
            self.ending_holds.append({"run": label, "step": step, "chars": chars, "heldSeconds": round(hold, 1), "stillOnStep": after == step, "hint": hint, "scene": scene})
            if after != step:
                raise Failure(f"结局字幕没等玩家就自己翻了：第 {step} 句（{chars} 字）不到 {hold:.1f} 秒就换成第 {after} 句")
            if "点击或按空格继续" not in hint:
                raise Failure(f"结局第 {step} 句没有常驻的继续提示：{hint!r}")
            self.key("Space")
            self.step(f"{label}：读完结局第 {step} 句，按空格")
            self.page.wait_for_function(f"(() => {{ const r = document.querySelector('[data-ui=ending]'); return !r || r.dataset.step !== '{step}'; }})()", timeout=10000)

    # ---------- 主循环 ----------
    def drive(self, until, limit_s: int = 900, label: str = "") -> dict:
        deadline = time.time() + limit_s
        last_battle = None
        while time.time() < deadline:
            s = self.snap()
            if s["battle"]:
                if last_battle != s["battle"]["id"]:
                    last_battle = s["battle"]["id"]
                    self.step(f'进入战斗：{last_battle}')
            elif last_battle:
                last_battle = None
            if until(s):
                return s
            if self.vis('[data-ui="result"]'):
                if not self.vis('[data-ui="result"][data-armed="1"]'):
                    self.wait(60)
                    continue  # 结算卡刚弹出的那一小会儿不认点击
                b = s["battle"]
                if b:
                    self.battles.append({"id": b["id"], "winner": b["winner"], "rounds": b["round"] - 1})
                    if b["id"] in ("niumowang",) and b["winner"] == "party" and "final" not in self.observations:
                        self.observations["final"] = {"shot": self.shot("final-victory")}
                    if b["id"].startswith("bounty") and b["winner"] == "party":
                        self.bounty_done = True
                act = "retry" if self.vis('[data-ui="result"] [data-act="retry"]') else "ok"
                self.click(f'[data-ui="result"] [data-act="{act}"]', f"结算：{act}")
            elif self.vis('[data-ui="confirm"]'):
                self.click('[data-ui="confirm"] [data-act="yes"]')
            elif self.vis('[data-ui="npc-menu"]'):
                self.click('[data-ui="npc-menu"] [data-key="take"]', "土地：接下封妖令")
            elif self.vis('[data-ui="landmark"]'):
                self.click('[data-ui="landmark"] .opt')
            elif any(self.vis(f'[data-ui="{k}"]') for k in CHOICES):
                if self.choice_guard is None:
                    k0 = next(k for k in CHOICES if self.vis(f'[data-ui="{k}"]'))
                    focused = self.page.evaluate("document.activeElement?.classList.contains('opt') ?? false")
                    for k in ("Space", "Space", "Enter"):
                        self.key(k)
                        self.wait(60)
                    self.choice_guard = {"choice": k0, "optionFocusedOnOpen": focused, "stillOpenAfterSpaceSpaceEnter": self.vis(f'[data-ui="{k0}"]'), "flags": self.snap()["campaign"]["flags"]}
                    self.step(f"抉择 {k0} 弹出后连按空格、空格、回车（不该替玩家选）")
                    if focused or not self.choice_guard["stillOpenAfterSpaceSpaceEnter"]:
                        raise Failure(f"剧情抉择被空格/回车直接确认了：{self.choice_guard}")
                for k, v in CHOICES.items():
                    if self.vis(f'[data-ui="{k}"]'):
                        self.click(f'[data-ui="{k}"] [data-key="{v}"]', f"抉择 {k} = {v}")
                        break
            elif self.vis('[data-ui="chapter"]') or self.vis('[data-ui="dialogue"]'):
                if self.lingji_bg is None and self.page.locator('[data-ui="dialogue"][data-who="lingji"]').count():
                    self.lingji_bg = self.page.evaluate("document.querySelector('[data-ui=backdrop]')?.style.backgroundImage ?? ''")
                    self.observations.setdefault("lingji", {"bg": self.lingji_bg, "shot": self.shot("lingji-xumi")})
                    if "xumi" not in self.lingji_bg:
                        raise Failure(f"灵吉菩萨在小须弥山说话，底景却是 {self.lingji_bg!r}")
                self.key("Space")
            elif self.vis('[data-ui="hunt"]'):
                self.hunt_tick()
            elif s["battle"] and not s["battle"]["over"]:
                if s["battle"]["id"] == "niumowang" and any(u["key"] == "whitebull" and not u["alive"] for u in s["battle"]["units"]):
                    self.bull_down_open = True
                    raise Failure("白牛真身已伏地，决战却没有结束")
                self.battle_tick(s)
            elif self.vis('[data-ui="ending"]'):
                if self.vis('[data-ui="ending-end"]'):
                    return s
                self.key("Space")
            elif s["screen"] == "world":
                self.world_tick(s)
            self.wait(60 if self.fast else 250)
        raise Failure(f"超时：{label}（阶段 {self.snap()['campaign']}）")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def serve() -> tuple[http.server.ThreadingHTTPServer, int]:
    port = free_port()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):  # 不把每个请求打到终端
            pass

    handler = functools.partial(Quiet, directory=str(APP))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


def evidence_ref() -> str:
    path = EVIDENCE / "run.json"
    return path.relative_to(EXAMPLE).as_posix() if path.is_relative_to(EXAMPLE) else path.as_posix()


def write_result(run: Run | None, status: dict[str, str], exit_code: int, environment: dict, error: str | None) -> None:
    QA.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    observations = {}
    for check in CHECKS:
        o = (run.observations.get(check) if run else None) or {"id": f"{check}-not-reached", "inputs": ["未执行到这一步"], "state": {"reached": False}}
        observations[check] = o
    evidence = {
        "schemaVersion": 1, "runId": RUN_ID, "environment": environment,
        "inputTrace": (run.trace if run and run.trace else ["未产生输入"]),
        "observations": observations,
    }
    (EVIDENCE / "run.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ok = all(v == "PASS" for v in status.values())
    limitations = [
        {"scope": "路径覆盖", "reason": "浏览器只走一条路线：稳阵、定风丹、先试边火、留用火妖、悟空探路并深入、点钢棒箍、识破假八戒；其余抉择分支与寻宝随机局面由 npm test 的规则回归覆盖，未逐一在浏览器渲染。"},
        {"scope": "演出速度", "reason": "为缩短时长使用公开的 ?fast=1&seed=42 参数：演出与行走被压缩，规则与随机序列不变；常速下的节奏与手感未在本次运行中计时。"},
        {"scope": "视口与浏览器", "reason": "只在 1280×800 的 Chromium（无头）中运行；390 px 窄屏与其他浏览器未纳入这条命令。"},
        {"scope": "声音", "reason": "无头浏览器不出声：只确认音频文件请求没有失败，不判断听感。"},
        {"scope": "体验判断", "reason": "这条命令只证明能启动、渲染、输入、打通主线并重开，不判断是否好玩、数值是否平衡。"},
        {"scope": "真机与其他浏览器", "reason": "未在任何手机真机、Safari 或 Firefox 上运行；390×844 窄屏只在第 5 轮盲玩中用无头 Chromium 重走标题、主界面、面板与首战，未打通全程。"},
        {"scope": "第 5 轮盲玩", "reason": "初次盲玩（1280×800，常速）打到结局「火息路开 · 继续西行」，刷新恢复与通关重开均通过；未发现 P0/P1/P2，仅记 P3 措辞与遮挡细节，见 qa/playtest-report.md。盲玩未覆盖：强攻破势后的二借台词呼应、开局即选避火锦、主线火兵战收服后的留用/放归抉择、残图深入、受骗交扇、战败重打。"},
    ]
    if error:
        limitations.insert(0, {"scope": "本次运行失败", "reason": error[:400]})
    verification = {
        "schemaVersion": 3,
        "status": "PASS" if ok else "FAIL",
        "verify": {"command": COMMAND, "exitCode": exit_code},
        "completeRun": {"id": RUN_ID, "cleanContext": True, "terminal": "done", "restart": "ask", "evidence": evidence_ref()},
        "checks": status,
        "limitations": limitations,
    }
    (QA / "verification.json").write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slow", action="store_true", help="不带 fast 参数")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--out", type=Path, help="记录与截图写到这个目录（默认 qa/，供正式验收）")
    args = parser.parse_args()
    if args.out:
        global QA, EVIDENCE
        QA = args.out.resolve()
        EVIDENCE = QA / "evidence"
    status = {c: "NOT_RUN" for c in CHECKS}
    run: Run | None = None
    error: str | None = None
    server, port = serve()
    url = f"http://127.0.0.1:{port}/index.html?seed=42" + ("" if args.slow else "&fast=1")
    environment = {"runtime": "Chromium (Playwright, headless)", "viewport": "1280x800", "url": url.replace(str(port), "<port>"), "os": sys.platform}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        environment["browserVersion"] = browser.version
        context = browser.new_context(viewport={"width": 1280, "height": 800})  # 全新上下文：没有任何存档
        page = context.new_page()
        run = Run(page, fast=not args.slow)
        try:
            # launch
            status["launch"] = "FAIL"
            page.goto(url)
            page.wait_for_selector('[data-ui="title"]', timeout=30000)
            run.wait(600)
            had_save = page.evaluate("Object.keys(localStorage).length")
            if had_save:
                raise Failure("初态不干净：localStorage 非空")
            if run.vis('[data-act="continue"]'):
                raise Failure("干净初态不该出现「接着西行」")
            run.observe("launch", "title-screen", ["打开页面，等待标题画面"], {"screen": run.snap()["screen"], "localStorageKeys": had_save, "consoleErrors": len(run.console)}, run.shot("01-title"))
            if run.console:
                raise Failure(f"启动时控制台报错：{run.console[:3]}")
            status["launch"] = "PASS"

            # render + input
            status["render"] = status["input"] = "FAIL"
            run.click('[data-act="new"]', "点「踏上火焰山」")
            page.wait_for_selector('[data-ui="dialogue"]', timeout=20000)
            run.drive(lambda s: s["world"] and not s["world"]["busy"] and not run.vis('[data-ui="dialogue"]'), 60, "序幕对白")
            run.wait(400)
            ink = run.canvas_ink()
            first = run.snap()
            if ink < 12:
                raise Failure(f"场景画布没有画出内容（取样颜色 {ink} 种）")
            box = page.locator(".world-canvas").bounding_box()
            page.mouse.click(box["x"] + box["width"] * 0.36, box["y"] + box["height"] * 0.56)
            run.step("点地面：向左下走几步")
            run.wait(700)
            moved = run.snap()
            page.keyboard.down("ArrowRight"); run.wait(350); page.keyboard.up("ArrowRight")
            run.step("按住方向键右")
            run.wait(200)
            moved2 = run.snap()
            visual = run.shot("02-village")
            run.observe("render", "village-scene", ["点「踏上火焰山」", "空格读完序幕"], {"scene": first["world"]["scene"], "mapReady": first["world"]["mapReady"], "sampledColors": ink}, visual)
            if (first["world"]["x"], first["world"]["y"]) == (moved["world"]["x"], moved["world"]["y"]):
                raise Failure("点地面后悟空没有移动")
            if moved2["world"]["x"] <= moved["world"]["x"] and (moved2["world"]["x"], moved2["world"]["y"]) == (moved["world"]["x"], moved["world"]["y"]):
                raise Failure("方向键没有移动悟空")
            run.observe("input", "walk-by-click-and-keys", ["点地面", "按住方向键右"], {"before": [first["world"]["x"], first["world"]["y"]], "afterClick": [moved["world"]["x"], moved["world"]["y"]], "afterKey": [moved2["world"]["x"], moved2["world"]["y"]]})
            status["render"] = status["input"] = "PASS"

            # coreLoop：问路 → 一借（教学战）→ 授宝 → 成长 → 封妖一环 → 买药 → 二借化虫 → 火兵 → 残图 → 摩云洞
            status["coreLoop"] = "FAIL"
            run.drive(lambda s: s["campaign"]["stage"] == "borrow2" and s["screen"] == "world" and not s["world"]["busy"], 300, "一借与授宝")
            run.shot("03-after-first-borrow")
            run.drive(lambda s: s["campaign"]["stage"] == "tryfan" and s["screen"] == "world" and not s["world"]["busy"] and not s["battle"], 600, "封妖、买药、二借")
            mid = run.snap()
            # 刷新页面：从存档接着走，证明存读真的恢复了进度
            page.reload()
            page.wait_for_selector('[data-ui="title"]', timeout=30000)
            run.click('[data-act="continue"]', "刷新页面后点「接着西行」")
            page.wait_for_function("window.xiyou.snapshot().world && window.xiyou.snapshot().world.mapReady", timeout=30000)
            run.wait(300)
            again = run.snap()
            for k in ("stage", "levels", "money", "treasure"):
                if again["campaign"][k] != mid["campaign"][k]:
                    raise Failure(f"读档后 {k} 与存档前不一致")
            run.reloaded = True
            run.drive(lambda s: s["campaign"]["stage"] == "niu" and s["screen"] == "world" and not s["world"]["busy"] and not s["battle"], 900, "火兵、残图、摩云洞")
            core = run.snap()
            won = [b for b in run.battles if b["winner"] == "party"]
            if len(won) < 4:
                raise Failure(f"核心循环没打够：只赢了 {len(won)} 场")
            if not run.cmd_guard or run.cmd_guard["queuedAfterInstantClick"]:
                raise Failure(f"没有验到指令台防误触：{run.cmd_guard}")
            if not run.repeat_labels or not run.finisher_goal:
                raise Failure(f"没看到「沿用」写明内容或二借疲态时的「此战」：{run.repeat_labels} {run.finisher_goal!r}")
            if not run.demon_click or not run.demon_click.get("battle"):
                raise Failure(f"封妖令没有通过直接点火妖开战：{run.demon_click}")
            run.observe("coreLoop", "walk-talk-battle-grow", ["任务追踪寻路", "首战指令台刚亮起就点一下（不该下令）", "逐个伙伴下令", "「沿用」按钮写明将沿用什么", "二借罗刹女露疲态时「此战」改写", "【角色】推荐加点", "封妖一环（直接点游走的火妖开打）", "买药", "刷新后读档", "火脉残图"],
                        {"demonClick": run.demon_click, "cmdGuard": run.cmd_guard, "repeatLabels": run.repeat_labels, "finisherGoal": run.finisher_goal, "stage": core["campaign"]["stage"], "level": core["campaign"]["levels"]["wukong"], "battles": run.battles, "bountyRings": core["campaign"]["bounty"]["total"], "reloadRestored": run.reloaded, "hunt": core["campaign"]["hunt"], "pets": core["campaign"]["pets"]},
                        run.shot("04-jilei"))
            status["coreLoop"] = "PASS"

            # outcome：老牛赴宴 → 碧波潭 → 骗扇 → 识破假八戒 → 决战 → 结局
            status["outcome"] = "FAIL"
            run.drive(lambda s: run.vis('[data-ui="ending"]') or run.vis('[data-ui="ending-end"]'), 900, "决战")
            prompts = [f for f in run.fan_checks if f["fanStage"] == 0 and not f["queuedThisRound"]]
            if not prompts or not all(f["fanCoach"] and f["itemGlow"] for f in prompts):
                raise Failure(f"决战真扇一扇未出时，下令处没有一直点明真扇：{run.fan_checks[:6]}")
            if not any(f["round"] >= 2 for f in prompts):
                raise Failure("决战第 2 回合起真扇提示没有留住")
            if any(f["fanCoach"] for f in run.fan_checks if f["fanStage"] >= 1 or f["queuedThisRound"]):
                raise Failure("真扇已领或已扇过，提示还挂着")
            relief = page.evaluate("window.__relief || []")
            if not any("tudi" in (r.get("art") or "") for r in relief) or not any("全队" in (r.get("banner") or "") or "在场伙伴" in (r.get("banner") or "") for r in relief):
                raise Failure(f"白牛现形时土地没有上场或没写明回血：{relief}")
            run.relief = relief
            if not run.charge_checks:
                raise Failure("决战里没有遇到蓄力预警")
            if not all(c["namesLocked"] for c in run.charge_checks):
                raise Failure(f"蓄力预警写的人名与实际锁定的目标不一致：{[c for c in run.charge_checks if not c['namesLocked']][:3]}")
            if not run.bull_goals or not all("伏地即胜" in g for g in run.bull_goals):
                raise Failure(f"白牛真身在场时「此战」没写明伏地即胜：{run.bull_goals}")
            if run.lingji_bg is None:
                raise Failure("没有看到灵吉菩萨的对白")
            run.read_ending("首通")
            end = run.snap()
            if end["campaign"]["stage"] != "done":
                raise Failure("结局画面出现时战役阶段不是 done")
            final = next((b for b in run.battles if b["id"] == "niumowang" and b["winner"] == "party"), None)
            if not final:
                raise Failure("没有决战得胜的记录")
            title = " ".join(page.locator('[data-ui="ending-end"] h1').inner_text().split())
            run.wait(1600)
            run.observe("outcome", "ending-reached", ["首个抉择弹出后连按空格、空格、回车，抉择仍在", "灵吉对白底景为小须弥山", "决战中下令处一直点明真扇，三扇依次扇出", "白牛在场时「此战」写明伏地即胜，白牛伏地战斗即结束", "蓄力预警点名的人就是重击锁定的人", "白牛现形时土地立绘上场并写明回血", "结局每句字幕不操作也停住，空格逐句读完，字幕写火退时画面已换地景"], {"stage": end["campaign"]["stage"], "terminal": "done", "endingTitle": title, "finalBattle": final, "wins": end["campaign"]["wins"], "flags": end["campaign"]["flags"], "fanPrompts": run.fan_checks, "endingHolds": run.ending_holds, "choiceGuard": run.choice_guard, "lingjiBackdrop": run.lingji_bg, "bullGoals": run.bull_goals, "chargeChecks": run.charge_checks, "relief": run.relief}, run.shot("05-ending"))
            status["outcome"] = "PASS"

            # restart：刷新后从标题「重温结局」再读一遍（同样不许自动翻页），再重走这一难 → 回到初态
            status["restart"] = "FAIL"
            page.reload()
            page.wait_for_selector('[data-ui="title"]', timeout=30000)
            label = page.locator('[data-act="continue"]').inner_text().strip() if run.vis('[data-act="continue"]') else ""
            if label != "重温结局":
                raise Failure(f"通关后刷新，标题上没有「重温结局」：{label!r}")
            run.click('[data-act="continue"]', "刷新后点「重温结局」")
            run.read_ending("重温")
            run.click('[data-ui="ending-end"] [data-act="restart"]', "点「重走这一难」")
            page.wait_for_selector('[data-ui="dialogue"]', timeout=30000)
            fresh = run.snap()
            c = fresh["campaign"]
            if not (c["stage"] == "ask" and c["levels"]["wukong"] == 1 and c["money"] == 100 and not c["items"] and not c["pets"] and c["wins"] == 0 and not c["flags"]):
                raise Failure(f"重开后不是初态：{c}")
            run.observe("restart", "fresh-campaign", ["刷新", "点「重温结局」并读完", "点「重走这一难」"], {"stage": c["stage"], "restart": "ask", "level": c["levels"]["wukong"], "money": c["money"], "items": c["items"], "pets": c["pets"], "wins": c["wins"]}, run.shot("06-restart"))
            status["restart"] = "PASS"
            if run.console:
                raise Failure(f"全程控制台报错 {len(run.console)} 条：{run.console[:3]}")
        except Exception as exc:  # noqa: BLE001 —— 任何失败都要落成 FAIL 记录
            error = f"{type(exc).__name__}: {exc}"
            try:
                run.shot("failure")
            except Exception:
                pass
        finally:
            environment["seconds"] = round(time.time() - run.started)
            environment["consoleErrors"] = run.console[:10]
            browser.close()
            server.shutdown()
    exit_code = 0 if error is None and all(v == "PASS" for v in status.values()) else 1
    write_result(run, status, exit_code, environment, error)
    print(json.dumps({"status": "PASS" if exit_code == 0 else "FAIL", "checks": status, "error": error, "battles": run.battles if run else [], "seconds": environment.get("seconds")}, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
