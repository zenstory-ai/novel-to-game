#!/usr/bin/env python3
"""首次完整试玩发现的战斗信息与窄屏可用性回归。

测试直接启动真实战斗界面并通过 DOM 下令；不写权威 QA 结果。
"""

from __future__ import annotations

import copy
import os
from pathlib import Path
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import PROJECT, BrowserPath, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(os.environ.get("BATTLE_AUDIT_SHOTS", PROJECT / "qa/evidence/battle-audit"))


class BattleAuditTests(unittest.TestCase):
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
            viewport={"width": 1440, "height": 900}, reduced_motion="reduce"
        )
        self.page: Page = self.context.new_page()

    def tearDown(self) -> None:
        self.context.close()

    def start_battle(self, battle_id: str, *, width: int = 1440, height: int = 900) -> None:
        self.page.set_viewport_size({"width": width, "height": height})
        self.page.goto(f"{BASE_URL}/?seed=42&fast=1")
        self.page.wait_for_selector("#btn-start")
        self.page.evaluate(
            """async ({ battleId }) => {
              localStorage.setItem('xiyou_skipfx', '1');
              localStorage.setItem('xiyou_speed', '2');
              document.body.classList.remove('no-topbar');
              document.body.classList.add('phase-battle');
              const { runBattleScreen } = await import('./js/battle_ui.js');
              const root = document.querySelector('#app');
              root.replaceChildren();
              window.__auditResult = null;
              window.__auditPromise = runBattleScreen({
                root,
                battleId,
                partyDefs: [
                  { key: 'wukong', level: 6 },
                  { key: 'bajie', level: 6 },
                  { key: 'sha', level: 6 },
                ],
                formation: 'liuding',
                items: { jinchuang: 6 },
                seed: 42,
                fast: true,
                showTutorial: false,
                hasPendingPoints: () => false,
                openGrowth: async () => {},
                canRegroup: false,
              }).then(result => { window.__auditResult = result; return result; });
            }""",
            {"battleId": battle_id},
        )
        self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]')

    def enter_real_first_battle(self, *, width: int, height: int) -> None:
        page = self.page
        page.set_viewport_size({"width": width, "height": height})
        page.goto(f"{BASE_URL}/?seed=42&fast=1")
        page.wait_for_selector("#btn-start")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("#btn-start")
        page.click("#btn-start")
        page.wait_for_function(f"() => localStorage.getItem('{SAVE_KEY}') !== null")
        campaign = page.evaluate(f"JSON.parse(localStorage.getItem('{SAVE_KEY}'))")
        fixture = copy.deepcopy(campaign)
        fixture["stage"] = "prologue"
        fixture["flags"] = {"tudi": True}
        fixture["world"] = {"scene": "cuiyun"}
        fixture["luosha1Done"] = False
        fixture["chaptersSeen"] = {"c1": True}
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, fixture],
        )
        page.goto(f"{BASE_URL}/?seed=42&fast=1")
        page.wait_for_selector("#btn-continue")
        page.click("#btn-continue")
        page.wait_for_selector("#overworld-canvas")
        path = BrowserPath(page)
        path.track("main")
        path.advance_until("#modal-borrowing-approach", timeout_seconds=35)
        page.click("#btn-approach-calm")
        page.wait_for_selector("#modal-borrowing-approach", state="detached")
        path.advance_until("#battle-tutorial[data-step]", timeout_seconds=35)
        page.wait_for_selector('.cmd-btn[data-cmd="defend"]')

    def defend_round(self, party_count: int = 3) -> None:
        start_round = self.page.evaluate("__game.battle.round")
        for _ in range(party_count):
            self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]', state="visible")
            self.page.locator('.cmd-btn[data-cmd="defend"]').click()
        self.page.wait_for_function(
            "([round]) => window.__auditResult || __game.battle.round > round",
            arg=[start_round],
            timeout=15000,
        )

    def test_story_exit_round_does_not_request_discarded_commands(self) -> None:
        self.start_battle("luosha1")
        self.assertIn("撑过两回合", self.page.locator(".battle-objective").inner_text())
        self.defend_round()
        self.defend_round()
        self.page.wait_for_function("() => window.__auditResult !== null", timeout=15000)
        result = self.page.evaluate("window.__auditResult")
        self.assertEqual(result["winner"], "story")
        self.assertEqual(result["rounds"], 3)
        self.assertEqual(self.page.locator('.cmd-btn[data-cmd="defend"]').count(), 0)

    def test_charge_stays_visible_during_decision_then_clears_after_heavy(self) -> None:
        self.start_battle("niumowang")
        self.defend_round()
        self.defend_round()
        self.defend_round()
        self.page.wait_for_function(
            """() => document.querySelector('[data-unit-id="e0"] [data-buff="charge"]')
              && document.querySelector('.cmd-btn[data-cmd="defend"]')"""
        )
        chip = self.page.locator('[data-unit-id="e0"] [data-buff="charge"]')
        self.assertTrue(
            chip.is_visible(),
            self.page.evaluate(
                """() => ({
                  boss: __game.battle.units.find(u => u.id === 'e0'),
                  chips: [...document.querySelectorAll('[data-buff]')].map(n => [n.dataset.buff, n.textContent]),
                })"""
            ),
        )
        self.assertIn("混铁棍", chip.inner_text())
        self.assertIn("本回合", chip.inner_text())
        SHOTS.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=SHOTS / "charge-command-phase.jpg", type="jpeg", quality=82)
        self.defend_round()
        self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]', state="visible")
        self.assertEqual(self.page.locator('[data-buff="charge"]').count(), 0)

    def test_mobile_protect_command_is_fully_visible_and_clickable(self) -> None:
        self.enter_real_first_battle(width=390, height=844)
        for _ in range(3):
            self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]', state="visible")
            self.page.locator('.cmd-btn[data-cmd="defend"]').click()
        self.page.wait_for_function(
            """() => __game.battle.round === 2
              && document.querySelector('.cmd-btn[data-cmd="protect"]')""",
            timeout=15000,
        )
        topbar = self.page.locator("#topbar")
        self.assertTrue(topbar.is_visible())
        protect = self.page.locator('.cmd-btn[data-cmd="protect"]')
        self.assertTrue(protect.is_visible())
        metrics = protect.evaluate(
            """button => {
              const b = button.getBoundingClientRect();
              const menu = button.closest('#cmd-menu').getBoundingClientRect();
              const topbar = document.querySelector('#topbar').getBoundingClientRect();
              const center = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
              return {
                top: b.top, bottom: b.bottom, height: b.height,
                menuTop: menu.top, menuBottom: menu.bottom,
                topbarTop: topbar.top, topbarBottom: topbar.bottom,
                hit: center?.closest('[data-cmd]')?.dataset.cmd ?? null,
                scrollWidth: document.documentElement.scrollWidth,
              };
            }"""
        )
        self.assertGreaterEqual(metrics["height"], 44)
        self.assertGreaterEqual(metrics["top"], metrics["menuTop"])
        self.assertLessEqual(metrics["bottom"], metrics["menuBottom"])
        self.assertLessEqual(metrics["bottom"], metrics["topbarTop"])
        self.assertLessEqual(metrics["topbarBottom"], 844)
        self.assertEqual(metrics["hit"], "protect")
        self.assertLessEqual(metrics["scrollWidth"], 390)
        prompt_before = self.page.locator(".cmd-status").inner_text()
        protect.click()
        self.page.wait_for_selector('.unit-card[data-unit-id="p1"].targetable')
        self.page.locator('.unit-card[data-unit-id="p1"]').click()
        self.page.wait_for_function(
            "prompt => document.querySelector('.cmd-status')?.textContent !== prompt",
            arg=prompt_before,
        )
        SHOTS.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=SHOTS / "mobile-protect.jpg", type="jpeg", quality=82)


if __name__ == "__main__":
    unittest.main(verbosity=2)
