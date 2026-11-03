#!/usr/bin/env python3
"""首次完整试玩所暴露叙事信息边界的定向回归。"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import BrowserPath, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(os.environ["STORY_AUDIT_SHOTS"]) if os.environ.get("STORY_AUDIT_SHOTS") else None


class StoryAuditBrowserTests(unittest.TestCase):
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
        self.context: BrowserContext = self.browser.new_context(viewport={"width": 1440, "height": 900})
        self.page: Page = self.context.new_page()
        self.page.goto(f"{BASE_URL}/?seed=42&fast=1")
        self.page.wait_for_selector("#btn-start")
        self.page.evaluate("localStorage.clear()")
        self.page.reload()
        self.page.click("#btn-start")
        self.page.wait_for_function(f"() => localStorage.getItem('{SAVE_KEY}') !== null")
        self.base = json.loads(self.page.evaluate(f"localStorage.getItem('{SAVE_KEY}')"))

    def tearDown(self) -> None:
        self.context.close()

    def install(self, campaign: dict[str, object]) -> None:
        self.page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")

    def test_unverified_fan_is_neutral_in_bag_then_reveals_after_trial(self) -> None:
        campaign = copy.deepcopy(self.base)
        campaign["stage"] = "pre_fire"
        campaign["flags"] = {"tudi": True}
        campaign["items"]["fakefan"] = 1
        campaign["world"] = {"scene": "village"}
        self.install(campaign)
        self.page.click("#btn-bag")
        bag = self.page.locator("#modal-bag")
        self.assertIn("借来的芭蕉扇", bag.inner_text())
        self.assertNotIn("芭蕉扇·伪", bag.inner_text())
        self.assertNotIn("火反倒更旺", bag.inner_text())
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=SHOTS / "after-unverified-fan-bag.jpg", type="jpeg", quality=84)

        self.page.locator("#modal-bag .panel-close").click()
        campaign["flags"]["fanTrial"] = "ember"
        self.install(campaign)
        self.page.click("#btn-bag")
        self.assertIn("芭蕉扇·伪", self.page.locator("#modal-bag").inner_text())

    def test_fake_bajie_encounter_hides_real_bajie_follower(self) -> None:
        campaign = copy.deepcopy(self.base)
        campaign["stage"] = "pre_boss"
        campaign["flags"] = {"tudi": True}
        campaign["world"] = {"scene": "cuiyun"}
        self.install(campaign)
        followers = self.page.evaluate("window.__game.world().followers.map(x => x.id)")
        self.assertEqual(followers, [])
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=SHOTS / "after-fake-bajie-staging.jpg", type="jpeg", quality=84)

    def test_real_pre_fire_bounty_reveals_fan_after_using_it(self) -> None:
        campaign = copy.deepcopy(self.base)
        campaign["stage"] = "pre_fire"
        campaign["flags"] = {"tudi": True}
        campaign["luosha1Done"] = True
        campaign["items"]["fakefan"] = 1
        campaign["world"] = {"scene": "village"}
        self.install(campaign)
        path = BrowserPath(self.page)
        path.track("bounty")
        self.page.wait_for_selector('#npc-menu [data-opt="accept"]', timeout=20000)
        self.page.click('#npc-menu [data-opt="accept"]')
        path.back_to_world("village")
        path.track("bounty")
        self.page.wait_for_selector('[data-cmd="item"]', timeout=30000)
        self.page.locator('[data-cmd="item"]').click()
        item = self.page.locator('[data-item="fakefan"]')
        self.assertIn("借来的芭蕉扇", item.inner_text())
        self.assertNotIn("芭蕉扇·伪", item.inner_text())
        item.hover()
        self.assertIn("尚未试过扇势", self.page.locator("#cmd-preview").inner_text())
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=SHOTS / "after-fan-neutral-battle-menu.jpg", type="jpeg", quality=84)
        item.click()
        path.drive_battle(max_steps=400)
        path.wait_victory()
        self.page.click("#btn-victory-ok")
        path.back_to_world("huokou")
        self.page.click("#btn-bag")
        self.assertIn("芭蕉扇·伪", self.page.locator("#modal-bag").inner_text())
        self.assertTrue(self.page.evaluate("__game.campaign().flags.fakeFanKnown === true"))
        if SHOTS:
            self.page.screenshot(path=SHOTS / "after-fan-revealed-in-bag.jpg", type="jpeg", quality=84)
        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        self.page.click("#btn-bag")
        self.assertIn("芭蕉扇·伪", self.page.locator("#modal-bag").inner_text())


if __name__ == "__main__":
    unittest.main(verbosity=2)
