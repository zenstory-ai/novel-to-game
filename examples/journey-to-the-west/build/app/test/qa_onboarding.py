#!/usr/bin/env python3
"""《三借芭蕉扇》借扇准备、假扇试探与首战渐进教学的定向浏览器回归。

存档只用来布置合法前置；NPC触发、剧情选择、目标选择和战斗指令均经真实 DOM 输入完成。
本脚本不写 qa/verification.json，不代替权威完整路径。
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import time
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import APP, PROJECT, BrowserPath, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(
    os.environ.get(
        "ONBOARDING_SHOTS",
        PROJECT / "qa/evidence/onboarding",
    )
)


def story_url(*, fast: bool) -> str:
    return f"{BASE_URL}/?seed=42" + ("&fast=1" if fast else "")


class OnboardingBrowserTests(unittest.TestCase):
    browser: Browser

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ensure_server()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(args=["--disable-audio-output"])

    @classmethod
    def tearDownClass(cls) -> None:
        cls.browser.close()
        cls.playwright.stop()
        if cls.server:
            cls.server.terminate()
            cls.server.wait(timeout=3)

    def setUp(self) -> None:
        self.context: BrowserContext = self.browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
        self.page = self.context.new_page()

    def tearDown(self) -> None:
        self.context.close()

    def fresh_campaign(self, *, fast: bool) -> dict[str, object]:
        page = self.page
        page.goto(story_url(fast=fast))
        page.wait_for_selector("#btn-start")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("#btn-start")
        page.click("#btn-start")
        page.wait_for_function(f"() => localStorage.getItem('{SAVE_KEY}') !== null")
        return page.evaluate(f"JSON.parse(localStorage.getItem('{SAVE_KEY}'))")

    def install_campaign(self, campaign: dict[str, object], *, fast: bool) -> BrowserPath:
        page = self.page
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        page.goto(story_url(fast=fast))
        page.wait_for_selector("#btn-continue")
        page.click("#btn-continue")
        page.wait_for_selector("#overworld-canvas")
        return BrowserPath(page)

    @staticmethod
    def first_borrow_fixture(base: dict[str, object]) -> dict[str, object]:
        campaign = copy.deepcopy(base)
        campaign["stage"] = "prologue"
        campaign["flags"] = {"tudi": True}
        campaign["world"] = {"scene": "cuiyun"}
        campaign["luosha1Done"] = False
        campaign["chaptersSeen"] = {"c1": True}
        return campaign

    @staticmethod
    def fan_trial_fixture(base: dict[str, object]) -> dict[str, object]:
        campaign = copy.deepcopy(base)
        campaign["stage"] = "pre_fire"
        campaign["flags"] = {"tudi": True, "borrowingApproach": "calm"}
        campaign["world"] = {"scene": "huokou"}
        campaign["luosha1Done"] = True
        campaign["levels"] = {"wukong": 2, "bajie": 2, "sha": 2, "pixie": 1}
        campaign["storyLevel"] = 2
        campaign["items"]["fakefan"] = 1
        return campaign

    def track_until(self, path: BrowserPath, selector: str, *, timeout_seconds: int = 35) -> None:
        path.track("main")
        path.advance_until(selector, timeout_seconds=timeout_seconds)

    def enter_first_battle(self, choice: str, *, fast: bool) -> BrowserPath:
        base = self.fresh_campaign(fast=fast)
        path = self.install_campaign(self.first_borrow_fixture(base), fast=fast)
        self.track_until(path, "#modal-borrowing-approach")
        self.page.click(f"#btn-approach-{choice}")
        self.page.wait_for_selector("#modal-borrowing-approach", state="detached")
        path.advance_until("#battle-tutorial[data-step]")
        self.page.wait_for_selector('.cmd-btn[data-cmd="attack"]')
        return path

    def enter_fan_battle(self, choice: str) -> BrowserPath:
        base = self.fresh_campaign(fast=True)
        path = self.install_campaign(self.fan_trial_fixture(base), fast=True)
        self.track_until(path, "#modal-fan-trial")
        self.page.click(f"#btn-trial-{choice}")
        self.page.wait_for_selector("#modal-fan-trial", state="detached")
        path.advance_until("#btn-once-close")
        self.page.click("#btn-once-close")
        self.page.wait_for_selector('.cmd-btn[data-cmd="attack"]')
        return path

    def stored_campaign(self) -> dict[str, object]:
        return self.page.evaluate(f"JSON.parse(localStorage.getItem('{SAVE_KEY}'))")

    def defend_remaining_party(self, expected: int = 2) -> None:
        for _ in range(expected):
            self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]')
            self.page.keyboard.press("3")

    def defend_until_defeat(self, *, timeout_seconds: int = 45) -> None:
        page = self.page
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if page.locator("#modal-defeat #btn-retry").count():
                return
            defend = page.locator('.cmd-btn[data-cmd="defend"]')
            if not defend.count() or not defend.first.is_visible():
                page.wait_for_timeout(40)
                continue
            prompt = page.locator(".cmd-status").evaluate("el => el.textContent")
            round_number = page.evaluate("__game.battle.round")
            page.keyboard.press("3")
            page.wait_for_function(
                """([prompt, roundNumber]) =>
                  document.querySelector('#modal-defeat #btn-retry')
                  || __game.battle.round !== roundNumber
                  || !document.querySelector('.cmd-btn[data-cmd="defend"]')
                  || document.querySelector('.cmd-status')?.textContent !== prompt""",
                arg=[prompt, round_number],
                timeout=5000,
            )
        self.fail(f"{timeout_seconds} 秒内未通过逐角色真实防御进入败北结算")

    def test_calm_choice_reduces_damage_and_first_element_hit_matches_real_damage(self) -> None:
        path = self.enter_first_battle("calm", fast=False)
        page = self.page
        self.assertEqual(self.stored_campaign()["flags"]["borrowingApproach"], "calm")
        party_buffs = page.evaluate(
            """__game.battle.units.filter(u => u.side === 'party').map(
              u => u.buffs.filter(b => b.id === 'dmg_reduce').map(b => [b.val, b.turns]))"""
        )
        self.assertEqual(party_buffs, [[[0.15, 2]], [[0.15, 2]], [[0.15, 2]]])
        self.assertEqual(page.locator("#modal-tutorial").count(), 0)
        self.assertEqual(
            page.locator('.cmd-btn[data-cmd="attack"], .cmd-btn[data-cmd="skill"], .cmd-btn[data-cmd="defend"]').count(),
            3,
        )
        self.assertEqual(page.locator("#btn-tutorial-more").count(), 1)
        page.wait_for_selector(".ink-swirl", state="detached", timeout=3000)
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=SHOTS / "01_first-command.jpg", type="jpeg", quality=82)

        target_id = page.evaluate(
            "__game.battle.units.find(u => u.defKey === 'luosha').id"
        )
        hp_before = page.evaluate(
            "id => __game.battle.units.find(u => u.id === id).hp", target_id
        )
        page.mouse.click(*self._center('.cmd-btn[data-cmd="attack"]'))
        page.mouse.click(*self._center(f'.unit-card[data-unit-id="{target_id}"]'))
        self.defend_remaining_party()

        page.wait_for_selector("#first-element-hit", timeout=20000)
        hit = page.locator("#first-element-hit")
        amount = int(hit.get_attribute("data-amount"))
        hp_after = page.evaluate(
            "id => __game.battle.units.find(u => u.id === id).hp", target_id
        )
        self.assertEqual(hit.get_attribute("data-actor"), "p0")
        self.assertEqual(hit.get_attribute("data-target"), target_id)
        self.assertEqual(hit.get_attribute("data-attack-element"), "金")
        self.assertEqual(hit.get_attribute("data-target-element"), "木")
        self.assertEqual(hp_before - hp_after, amount)
        self.assertIn("×1.5", hit.inner_text().replace(" ", ""))
        self.assertIn(str(amount), hit.inner_text())
        page.screenshot(path=SHOTS / "02_first-element-hit.jpg", type="jpeg", quality=82)

        page.wait_for_function(
            "() => __game.battle.round === 2 && document.querySelector('.cmd-btn[data-cmd=\"attack\"]')",
            timeout=20000,
        )
        self.assertEqual(page.locator("#battle-tutorial").get_attribute("data-step"), "defend")
        tutorial_text = page.locator("#battle-tutorial").inner_text()
        self.assertIn("完整指令", tutorial_text)
        self.assertIn("回复", tutorial_text)
        self.assertIn("法力", tutorial_text)
        for command in ("attack", "skill", "defend", "item", "special", "auto", "flee", "repeat", "protect"):
            self.assertEqual(page.locator(f'.cmd-btn[data-cmd="{command}"]').count(), 1)
        page.locator('.cmd-btn[data-cmd="defend"]').hover()
        page.wait_for_selector("#cmd-preview", state="visible")
        defend_preview = page.locator("#cmd-preview").inner_text()
        self.assertIn("伤害减半", defend_preview)
        self.assertIn("法力", defend_preview)
        page.screenshot(path=SHOTS / "03_round-two.jpg", type="jpeg", quality=82)

        # 再结算一回真实指令，首次演出不得创建第二张。
        first_amount = hit.get_attribute("data-amount")
        page.mouse.click(*self._center('.cmd-btn[data-cmd="attack"]'))
        page.mouse.click(*self._center(f'.unit-card[data-unit-id="{target_id}"]'))
        self.defend_remaining_party()
        page.wait_for_function("() => __game.battle.round >= 3", timeout=20000)
        self.assertEqual(page.locator("#first-element-hit").count(), 1)
        self.assertEqual(page.locator("#first-element-hit").get_attribute("data-amount"), first_amount)

    def test_rush_choice_adds_wukong_attack_for_two_rounds(self) -> None:
        self.enter_first_battle("rush", fast=True)
        buffs = self.page.evaluate(
            """__game.battle.units.find(u => u.defKey === 'wukong').buffs
              .filter(b => b.id === 'atk_up').map(b => [b.val, b.turns])"""
        )
        self.assertEqual(buffs, [[0.15, 2]])
        self.assertEqual(self.stored_campaign()["flags"]["borrowingApproach"], "rush")

    def test_legacy_save_without_borrowing_flag_prompts_before_battle(self) -> None:
        base = self.fresh_campaign(fast=True)
        fixture = self.first_borrow_fixture(base)
        self.assertNotIn("borrowingApproach", fixture["flags"])
        path = self.install_campaign(fixture, fast=True)
        self.track_until(path, "#modal-borrowing-approach")
        self.assertEqual(self.page.locator("#btn-approach-calm").count(), 1)
        self.assertEqual(self.page.locator("#btn-approach-rush").count(), 1)

    def test_ember_trial_consumes_chance_without_buffing_fire_enemies(self) -> None:
        self.enter_fan_battle("ember")
        campaign = self.stored_campaign()
        self.assertEqual(campaign["flags"]["fanTrial"], "ember")
        self.assertNotIn("fakefan", campaign["items"])
        buffs = self.page.evaluate(
            """__game.battle.units.filter(u => u.side === 'enemy' && u.element === '火')
              .flatMap(u => u.buffs.filter(b => b.id === 'atk_up' && b.val === .3))"""
        )
        self.assertEqual(buffs, [])

    def test_full_trial_buffs_fire_enemies_once_after_defeat_retry(self) -> None:
        self.enter_fan_battle("full")
        page = self.page

        def buff_count() -> int:
            return page.evaluate(
                """__game.battle.units.filter(u => u.side === 'enemy' && u.element === '火')
                  .reduce((n, u) => n + u.buffs.filter(b => b.id === 'atk_up' && b.val === .3 && b.turns === 3).length, 0)"""
            )

        fire_count = page.evaluate(
            "__game.battle.units.filter(u => u.side === 'enemy' && u.element === '火').length"
        )
        self.assertGreater(fire_count, 0)
        self.assertEqual(buff_count(), fire_count)
        self.assertEqual(self.stored_campaign()["flags"]["fanTrial"], "full")
        self.assertNotIn("fakefan", self.stored_campaign()["items"])

        # 全员持续防御直到败北，用真实「再战」验证选择不重弹、效果不叠加。
        self.defend_until_defeat()
        self.assertEqual(page.locator("#modal-defeat #btn-retry").count(), 1)
        page.click("#btn-retry")
        page.wait_for_selector('.cmd-btn[data-cmd="attack"]', timeout=10000)
        self.assertEqual(page.locator("#modal-fan-trial").count(), 0)
        self.assertEqual(buff_count(), fire_count)

    def test_saved_fan_trial_is_reused_without_showing_choice_again(self) -> None:
        base = self.fresh_campaign(fast=True)
        fixture = self.fan_trial_fixture(base)
        fixture["flags"]["fanTrial"] = "ember"
        fixture["items"].pop("fakefan", None)
        path = self.install_campaign(fixture, fast=True)
        self.track_until(path, "#btn-once-close")
        self.assertEqual(self.page.locator("#modal-fan-trial").count(), 0)

    def _center(self, selector: str) -> tuple[float, float]:
        box = self.page.locator(selector).bounding_box()
        self.assertIsNotNone(box, f"控件不可见: {selector}")
        return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


if __name__ == "__main__":
    unittest.main(verbosity=2)
