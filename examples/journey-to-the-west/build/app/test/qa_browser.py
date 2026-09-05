#!/usr/bin/env python3
"""用 Playwright 跑一条《三借芭蕉扇》完整路径并保留三张代表帧。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from typing import Callable, Optional
from urllib.parse import urlparse

from playwright.sync_api import Page, sync_playwright


APP = Path(__file__).resolve().parent.parent
PROJECT = APP.parents[1]
EVIDENCE = PROJECT / "qa/evidence"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
URL = BASE_URL + "/?seed=42" + ("" if os.environ.get("QA_SLOW") else "&fast=1")
SHOTS = Path(os.environ.get("QA_SHOTS", EVIDENCE / "browser"))
CHECK_NAMES = ("launch", "render", "input", "coreLoop", "outcome", "restart")
Decision = Callable[[dict[str, object], Optional[str]], bool]


def ensure_server() -> subprocess.Popen[bytes] | None:
    parsed = urlparse(BASE_URL)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    with socket.socket() as probe:
        try:
            probe.connect((host, port))
            return None
        except OSError:
            pass
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", host],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        with socket.socket() as probe:
            try:
                probe.connect((host, port))
                return process
            except OSError:
                time.sleep(0.2)
    process.kill()
    raise RuntimeError("无法启动本地服务")


class BrowserPath:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.screenshot_count = 0

    def shot(self, name: str) -> Path:
        self.page.wait_for_function(
            "() => document.querySelectorAll('.float-text, .float-stamp').length === 0",
            timeout=12000,
        )
        self.screenshot_count += 1
        output = SHOTS / f"{self.screenshot_count:02d}_{name}.jpg"
        self.page.screenshot(path=output, type="jpeg", quality=80)
        return output

    def click_dialogs(self, max_clicks: int = 30) -> None:
        for _ in range(max_clicks):
            dialog = self.page.locator("#dialog")
            if dialog.count() == 0:
                return
            self.page.wait_for_timeout(220)
            dialog.click()
        raise RuntimeError("剧情对白未在限定次数内结束")

    def wait_dialog_then_clear(self, timeout: int = 10000) -> None:
        self.page.wait_for_selector("#dialog", timeout=timeout)
        self.click_dialogs()

    def dialogs_until_battle(self, timeout_seconds: int = 60) -> None:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if self.page.locator('.cmd-btn[data-cmd="auto"]').count():
                return
            if self.page.locator("#btn-once-close").count():
                return
            if self.page.locator("#dialog").count():
                self.page.locator("#dialog").click()
            self.page.wait_for_timeout(220)
        raise RuntimeError("剧情未在限定时间内推进到战斗")

    def command_visible(self) -> bool:
        command = self.page.locator('.cmd-btn[data-cmd="auto"]')
        return command.count() > 0 and command.first.is_visible()

    def click_auto(self) -> None:
        self.page.locator('.cmd-btn[data-cmd="auto"]').first.click()
        self.page.wait_for_timeout(60)

    def battle_state(self) -> dict[str, object]:
        return self.page.evaluate(
            """window.__game.battle ? {
              round: __game.battle.round,
              formation: __game.battle.formation,
              items: __game.battle.items,
              caught: __game.battle.caught ?? [],
              units: __game.battle.units.map(u => ({
                id: u.id, key: u.defKey, hp: u.hp, maxHp: u.maxHp,
                alive: u.alive, charge: u.charge ?? 0, form: u.form ? u.form.id : null
              }))
            } : {}"""
        )

    def prompt_unit_id(self) -> str | None:
        status = self.page.locator(".cmd-status").inner_text()
        for name, unit_id in (
            ("孙悟空", "p0"),
            ("猪八戒", "p1"),
            ("沙悟净", "p2"),
            ("辟水金睛兽", "p3"),
            ("赤焰火骝", "p3"),
        ):
            if name in status:
                return unit_id
        return None

    @staticmethod
    def lowest_party(state: dict[str, object]) -> dict[str, object] | None:
        units = state.get("units", [])
        alive = [unit for unit in units if unit["id"].startswith("p") and unit["alive"]]
        return min(alive, key=lambda unit: unit["hp"]) if alive else None

    def battle_over(self) -> bool:
        return bool(
            self.page.locator("#modal-victory #btn-victory-ok").count()
            or self.page.locator("#modal-defeat #btn-retry").count()
            or self.page.evaluate("__game.phase()") != "battle"
        )

    def drive_battle(
        self,
        *,
        decide: Decision | None = None,
        max_steps: int = 600,
        stop_on_dialog: bool = False,
    ) -> None:
        for _ in range(max_steps):
            retry = self.page.locator("#modal-defeat #btn-retry")
            if retry.count():
                retry.click()
                self.page.wait_for_timeout(500)
                continue
            dialog = self.page.locator("#dialog")
            if dialog.count():
                if stop_on_dialog:
                    return
                dialog.click()
                self.page.wait_for_timeout(180)
                continue
            if self.battle_over():
                return
            if self.command_visible():
                state = self.battle_state()
                unit_id = self.prompt_unit_id()
                if decide and decide(state, unit_id):
                    continue
                self.click_auto()
            else:
                self.page.wait_for_timeout(100)
        raise RuntimeError("战斗未在限定步数内结束")

    def wait_victory(self) -> None:
        self.page.wait_for_selector("#modal-victory #btn-victory-ok", timeout=30000)


def run_path() -> tuple[
    dict[str, bool],
    list[str],
    dict[str, object],
    list[str],
    str,
]:
    checks = {name: False for name in CHECK_NAMES}
    errors: list[str] = []
    observations: dict[str, object] = {}
    input_trace = [
        "start a new campaign",
        "interact with the Earth God and Princess Iron Fan",
        "complete six command battles and story decisions",
        "use keyboard-only input to choose a guide and complete the risky five-element treasure route",
        "reach the designed ending",
        "restart to a clean title campaign",
    ]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on(
            "console",
            lambda message: errors.append(message.text) if message.type == "error" else None,
        )
        page.on("pageerror", lambda error: errors.append(f"PAGEERROR: {error}"))
        page.on("dialog", lambda dialog: dialog.accept())
        path = BrowserPath(page)

        page.goto(URL)
        page.wait_for_selector("#btn-start", timeout=10000)
        checks["launch"] = page.evaluate("__game.phase()") == "title"
        title_shot = path.shot("title")
        observations["launch"] = {
            "id": "title-ready",
            "inputs": ["navigate to the seeded title"],
            "state": {"phase": page.evaluate("__game.phase()")},
            "visual": title_shot.relative_to(PROJECT).as_posix(),
        }

        page.click("#btn-start")
        path.wait_dialog_then_clear()
        page.wait_for_selector("#overworld-canvas", timeout=5000)
        checks["input"] = page.evaluate("__game.phase()") == "overworld"
        observations["input"] = {
            "id": "overworld-input-accepted",
            "inputs": ["click start", "advance dialogue"],
            "state": {"phase": page.evaluate("__game.phase()")},
        }

        for actor in ("tudi", "luosha"):
            position = page.evaluate(f"__game.npcScreenPos('{actor}')")
            if not position:
                raise RuntimeError(f"无法定位剧情角色：{actor}")
            page.mouse.click(position["x"], position["y"])
            path.wait_dialog_then_clear()

        page.wait_for_selector("#btn-tutorial-ok", timeout=10000)
        page.click("#btn-tutorial-ok")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=5000)
        path.drive_battle(stop_on_dialog=True, max_steps=150)

        while page.locator("#choice-dingfengdan").count() == 0:
            if page.locator("#dialog").count():
                page.locator("#dialog").click()
            page.wait_for_timeout(200)
        page.click("#choice-dingfengdan")
        path.dialogs_until_battle()
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=10000)

        def defeat_luosha(state: dict[str, object], unit_id: str | None) -> bool:
            boss = next(
                (unit for unit in state.get("units", []) if unit["key"] == "luosha" and unit["alive"]),
                None,
            )
            if unit_id != "p0" or not boss or boss["hp"] / boss["maxHp"] > 0.55:
                return False
            page.click('.cmd-btn[data-cmd="special"]')
            if page.locator("#btn-once-close").count():
                page.locator("#btn-once-close").click()
            page.wait_for_selector('[data-form="chongzi"]')
            page.click('[data-form="chongzi"]')
            page.wait_for_timeout(400)
            return True

        path.drive_battle(decide=defeat_luosha)
        path.wait_victory()
        page.click("#btn-victory-ok")
        page.wait_for_selector("#dialog", timeout=15000)
        while page.evaluate("__game.phase()") != "overworld":
            page.locator("#dialog").click()
            page.wait_for_timeout(220)
        page.wait_for_selector("#dialog", timeout=10000)

        page.click("#btn-bag")
        page.wait_for_selector("#modal-bag")
        page.click("#btn-treasure-swap")
        page.wait_for_selector("#choice-bihuojin")
        page.click("#choice-bihuojin")
        page.wait_for_selector("#modal-bag")
        page.click("#modal-bag-close")
        path.dialogs_until_battle()

        page.wait_for_selector("#btn-once-close", timeout=15000)
        page.click("#btn-once-close")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)

        def cross_fire_mountain(state: dict[str, object], unit_id: str | None) -> bool:
            units = state.get("units", [])
            caught = "huobao" in state.get("caught", [])
            target = next((unit for unit in units if unit["id"] == "e0"), None)
            wukong = next((unit for unit in units if unit["id"] == "p0"), None)
            low = path.lowest_party(state)
            if unit_id == "p0" and wukong and not wukong["form"]:
                page.click('.cmd-btn[data-cmd="special"]')
                page.wait_for_selector('[data-form="xuangui"]')
                page.click('[data-form="xuangui"]')
                page.wait_for_timeout(400)
                return True
            if (
                target
                and target["alive"]
                and target["hp"] / target["maxHp"] <= 0.4
                and not caught
                and state["items"].get("buyaosheng", 0) > 0
            ):
                page.click('.cmd-btn[data-cmd="item"]')
                page.wait_for_selector('[data-item="buyaosheng"]')
                page.click('[data-item="buyaosheng"]')
                page.locator('.unit-card[data-unit-id="e0"]').click()
                page.wait_for_timeout(300)
                return True
            if target and target["alive"] and not caught and unit_id in {"p1", "p2"}:
                page.click('.cmd-btn[data-cmd="attack"]')
                page.locator('.unit-card[data-unit-id="e0"]').click()
                page.wait_for_timeout(180)
                return True
            if not caught and unit_id == "p0":
                page.click('.cmd-btn[data-cmd="defend"]')
                return True
            if (
                unit_id == "p0"
                and low
                and low["hp"] / low["maxHp"] < 0.35
                and state["items"].get("jinchuang", 0) > 0
            ):
                page.click('.cmd-btn[data-cmd="item"]')
                page.wait_for_selector('[data-item="jinchuang"]')
                page.click('[data-item="jinchuang"]')
                page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                page.wait_for_timeout(250)
                return True
            return False

        path.drive_battle(decide=cross_fire_mountain)
        path.wait_victory()
        page.click("#btn-victory-ok")

        # 火脉残图：悟空探路，按五行明牌取两处水藏与一处金简，再深入避开火眼标出的妖穴。
        while page.locator("#hunt-guide-wukong").count() == 0:
            if page.locator("#dialog").count():
                page.locator("#dialog").click()
            page.wait_for_timeout(180)
        page.keyboard.press("Enter")
        page.wait_for_selector("#treasure-root", timeout=8000)
        for _ in range(3):
            page.keyboard.press("Enter")
            page.wait_for_timeout(180)
        page.wait_for_selector("#treasure-deepen", timeout=5000)
        page.keyboard.press("ArrowRight")
        page.keyboard.press("Enter")
        hunt_shot = path.shot("fire_vein_treasure")
        for _ in range(2):
            page.keyboard.press("Enter")
            page.wait_for_timeout(180)
        page.wait_for_selector("#treasure-finish", timeout=5000)
        page.keyboard.press("Enter")
        page.wait_for_selector("#modal-hunt-result", timeout=5000)
        hunt_state = page.evaluate("__game.treasure()")
        hunt_result = hunt_state.get("result") if hunt_state else None
        if not (
            hunt_result
            and hunt_result.get("deepened") is True
            and hunt_result.get("forcedRetreat") is False
            and hunt_result.get("relics") == 4
            and hunt_result.get("growth", {}).get("potentialPoints") == 4
            and hunt_result.get("growth", {}).get("skillPoints") == 1
            and hunt_result.get("items", {}).get("dahuandan") == 1
        ):
            raise RuntimeError(f"寻宝深层结算未满足合同：{hunt_result}")
        page.keyboard.press("Enter")

        path.dialogs_until_battle()
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        hunt_campaign = page.evaluate("__game.campaign().hunts.fire")
        next_battle = path.battle_state()
        if not (
            hunt_campaign
            and hunt_campaign.get("potentialPoints") == 4
            and hunt_campaign.get("skillPoints") == 1
            and next_battle.get("items", {}).get("dahuandan") == 1
        ):
            raise RuntimeError(
                f"寻宝奖励未写入下一战：campaign={hunt_campaign}, items={next_battle.get('items')}"
            )

        def heal_party(state: dict[str, object], unit_id: str | None) -> bool:
            low = path.lowest_party(state)
            if (
                unit_id == "p0"
                and low
                and low["hp"] / low["maxHp"] < 0.35
                and state["items"].get("jinchuang", 0) > 0
            ):
                page.click('.cmd-btn[data-cmd="item"]')
                page.wait_for_selector('[data-item="jinchuang"]')
                page.click('[data-item="jinchuang"]')
                page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                page.wait_for_timeout(250)
                return True
            return False

        path.drive_battle(decide=heal_party)
        path.wait_victory()
        page.click("#btn-victory-ok")
        page.wait_for_selector("#equip-ruyibang_jing", timeout=8000)
        page.click("#equip-ruyibang_jing")
        path.dialogs_until_battle()
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        path.drive_battle(stop_on_dialog=True, max_steps=150)

        while page.locator("#choice-crab").count() == 0:
            if page.locator("#dialog").count():
                page.locator("#dialog").click()
            page.wait_for_timeout(200)
        page.click("#choice-crab")
        path.wait_dialog_then_clear()
        page.wait_for_selector("#choice-shift", timeout=5000)
        page.click("#choice-shift")
        path.wait_dialog_then_clear()
        page.wait_for_selector("#choice-steal", timeout=5000)
        page.click("#choice-steal")
        page.wait_for_selector("#dialog", timeout=5000)
        while page.evaluate("__game.campaign().items.truefan") != 3:
            page.locator("#dialog").click()
            page.wait_for_timeout(200)

        path.click_dialogs()
        page.wait_for_selector("#choice-check", timeout=10000)
        page.click("#choice-check")
        page.wait_for_selector("#dialog", timeout=8000)
        for _ in range(4):
            page.locator("#dialog").click()
            page.wait_for_timeout(200)
        page.wait_for_selector("#dialog", timeout=15000)
        page.click("#btn-pet")
        page.wait_for_selector("#modal-pet")
        page.click('[data-pet-active="pixie"]')
        page.wait_for_selector("#modal-pet")
        page.click("#modal-pet-close")
        path.click_dialogs()

        page.wait_for_selector("#btn-once-close", timeout=15000)
        page.click("#btn-once-close")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        boss_shot = path.shot("boss_command")
        public_hero = PROJECT / "screenshots/hero.jpg"
        public_hero.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(boss_shot, public_hero)

        def defeat_bull_king(state: dict[str, object], unit_id: str | None) -> bool:
            low = path.lowest_party(state)
            charging = any(
                unit["charge"] == 1 and unit["alive"]
                for unit in state.get("units", [])
                if not unit["id"].startswith("p")
            )
            if unit_id == "p0" and state.get("formation") != "liuding":
                page.click("#btn-battle-formation")
                page.wait_for_timeout(300)
                return True
            if charging and low and unit_id == low["id"]:
                page.click('.cmd-btn[data-cmd="defend"]')
                return True
            if (
                unit_id == "p0"
                and state.get("round", 1) >= 2
                and state["items"].get("truefan", 0) > 0
            ):
                page.click('.cmd-btn[data-cmd="item"]')
                page.wait_for_selector('[data-item="truefan"]')
                page.click('[data-item="truefan"]')
                page.wait_for_timeout(350)
                return True
            if (
                unit_id == "p0"
                and low
                and low["hp"] / low["maxHp"] < 0.3
                and state["items"].get("jinchuang", 0) > 0
            ):
                page.click('.cmd-btn[data-cmd="item"]')
                page.wait_for_selector('[data-item="jinchuang"]')
                page.click('[data-item="jinchuang"]')
                page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                page.wait_for_timeout(250)
                return True
            return False

        path.drive_battle(decide=defeat_bull_king, max_steps=900)
        path.wait_victory()
        page.click("#btn-victory-ok")

        page.wait_for_selector("#ending-root", timeout=15000)
        for _ in range(40):
            if page.locator(".ending-panel").count():
                break
            if page.locator("#dialog").count():
                page.locator("#dialog").click()
            page.wait_for_timeout(250)
        page.wait_for_selector(".ending-panel", timeout=15000)
        ending_title = page.locator(".ending-title").inner_text()
        page.wait_for_function("() => document.querySelector('.ending-bg')?.style.backgroundImage.includes('huoyan-rain.jpg')")
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        ending_shot = path.shot("ending")
        checks["coreLoop"] = page.evaluate("__game.phase()") == "ending"
        # 文案允许重写；以已完成的战役、雨后场景和实际渲染的结局标题共同证明结果。
        checks["outcome"] = bool(page.evaluate("""async () => {
          const { TEXT } = await import('./js/text.js');
          return __game.phase() === 'ending' && __game.campaign().battlesWon === 4
            && document.querySelector('.ending-title')?.textContent === TEXT.story.endingTitle
            && document.querySelector('.ending-bg')?.style.backgroundImage.includes('huoyan-rain.jpg');
        }"""))
        checks["render"] = ending_shot.is_file() and not errors
        ending_visual = ending_shot.relative_to(PROJECT).as_posix()
        observations["render"] = {
            "id": "ending-rendered",
            "inputs": ["complete the final battle"],
            "state": {
                "phase": page.evaluate("__game.phase()"),
                "consoleErrors": errors,
            },
            "visual": ending_visual,
        }
        observations["coreLoop"] = {
            "id": "campaign-loop-complete",
            "inputs": ["complete the authored campaign path"],
            "state": {
                "phase": page.evaluate("__game.phase()"),
                "battlesWon": page.evaluate("__game.campaign().battlesWon"),
                "treasureHunt": page.evaluate("__game.campaign().hunts.fire"),
                "treasureSnapshot": hunt_state,
                "treasureInput": "keyboard-only",
            },
            "visual": hunt_shot.relative_to(PROJECT).as_posix(),
        }
        observations["outcome"] = {
            "id": "designed-ending",
            "inputs": ["resolve the final victory"],
            "state": {
                "terminal": "ending: 三借芭蕉扇 · 完",
                "displayTitle": ending_title,
                "phase": page.evaluate("__game.phase()"),
            },
            "visual": ending_visual,
        }

        page.click("#btn-restart")
        page.wait_for_selector("#btn-start", timeout=10000)
        checks["restart"] = bool(
            page.evaluate(
                "__game.phase() === 'title' && "
                "__game.campaign().stage === 'prologue' && "
                "__game.campaign().battlesWon === 0"
            )
        )
        observations["restart"] = {
            "id": "clean-restart",
            "inputs": ["click restart"],
            "state": {
                "restart": "new campaign title",
                "phase": page.evaluate("__game.phase()"),
                "stage": page.evaluate("__game.campaign().stage"),
                "battlesWon": page.evaluate("__game.campaign().battlesWon"),
            },
        }
        browser_version = browser.version
        browser.close()

    return checks, errors, observations, input_trace, browser_version


def main() -> int:
    shutil.rmtree(SHOTS, ignore_errors=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = ensure_server()
    try:
        checks, errors, observations, input_trace, browser_version = run_path()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=3)

    build_bytes = sum(
        path.stat().st_size
        for path in APP.rglob("*")
        if path.is_file() and ".vercel" not in path.parts and "test" not in path.parts
    )
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    evidence = {
        "schemaVersion": 1,
        "runId": "journey-to-the-west-main-path",
        "environment": {
            "browser": browser_version,
            "viewport": [1440, 900],
            "url": URL,
            "buildBytes": build_bytes,
        },
        "inputTrace": input_trace,
        "observations": observations,
    }
    (EVIDENCE / "automated.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for name in CHECK_NAMES:
        print(f"{name}: {'PASS' if checks[name] else 'FAIL'}")
    if errors:
        print("browser errors:")
        for error in errors[:10]:
            print(f"- {error[:300]}")
    print(f"screenshots: {len(list(SHOTS.glob('*.jpg')))}; build: {build_bytes / 1048576:.2f} MB")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
