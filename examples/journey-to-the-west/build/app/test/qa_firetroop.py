#!/usr/bin/env python3
"""“火兵退路交易”的定向浏览器回归。

存档只布置火兵战已经合法收服后的前置事实；土地触发、交易选择和寻宝均经真实 DOM 输入完成。
本脚本不写 qa/verification.json，也不代替 qa_browser.py 的权威完整路径。
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import unittest

from playwright.sync_api import Browser, BrowserContext, sync_playwright

from qa_browser import PROJECT, BrowserPath, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(
    os.environ.get(
        "FIRETROOP_SHOTS",
        PROJECT / "qa/evidence/firetroop",
    )
)


def story_url() -> str:
    return f"{BASE_URL}/?seed=42&fast=1"


class FireTroopBrowserTests(unittest.TestCase):
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

    def fresh_campaign(self) -> dict[str, object]:
        page = self.page
        page.goto(story_url())
        page.wait_for_selector("#btn-start")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("#btn-start")
        page.click("#btn-start")
        page.wait_for_function(f"() => localStorage.getItem('{SAVE_KEY}') !== null")
        return page.evaluate(f"JSON.parse(localStorage.getItem('{SAVE_KEY}'))")

    def install_campaign(self, campaign: dict[str, object]) -> BrowserPath:
        page = self.page
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        page.goto(story_url())
        page.wait_for_selector("#btn-continue")
        page.click("#btn-continue")
        page.wait_for_selector("#overworld-canvas")
        return BrowserPath(page)

    @staticmethod
    def captured_firetroop_fixture(
        base: dict[str, object], *, pending: bool = True
    ) -> dict[str, object]:
        """火兵战已收服火骝并落盘，尚未找土地看残图。"""
        campaign = copy.deepcopy(base)
        campaign["stage"] = "treasure_fire"
        campaign["world"] = {"scene": "huokou"}
        campaign["seedBase"] = 42  # storyTreasure 使用 42 + 260 = 302。
        campaign["flags"] = {"tudi": True, "fanTrial": "ember"}
        if pending:
            campaign["flags"]["firetroopDealPending"] = True
        campaign["pets"] = [{"key": "huobao", "active": True}]
        campaign["levels"]["huobao"] = 3
        campaign["gear"] = {
            **campaign.get("gear", {}),
            "huobao": {"weapon": "bintie", "armor": "xipijia"},
        }
        campaign["equipBag"] = {
            **campaign.get("equipBag", {}),
            "bintie": 1,
            "xipijia": 0,
        }
        campaign["items"].pop("fakefan", None)
        campaign["hunts"] = {}
        return campaign

    def stored_campaign(self) -> dict[str, object]:
        raw = self.page.evaluate(f"localStorage.getItem('{SAVE_KEY}')")
        self.assertIsNotNone(raw, "交易选择后应立即产生存档")
        return json.loads(raw)

    def enter_deal(self, fixture: dict[str, object]) -> BrowserPath:
        path = self.install_campaign(fixture)
        path.track("main")
        path.advance_until("#modal-firetroop-deal")
        return path

    def advance_to_guide(self, path: BrowserPath) -> None:
        path.advance_until("#modal-hunt-guide")

    def test_keep_preserves_captured_pet_and_equipment(self) -> None:
        fixture = self.captured_firetroop_fixture(self.fresh_campaign())
        self.enter_deal(fixture)

        self.page.click("#btn-firetroop-keep")
        self.page.wait_for_selector("#modal-firetroop-deal", state="detached")

        saved = self.stored_campaign()
        self.assertEqual(saved["flags"].get("firetroopDeal"), "keep")
        self.assertNotIn("firetroopDealPending", saved["flags"])
        self.assertEqual(saved["pets"], [{"key": "huobao", "active": True}])
        self.assertEqual(
            saved["gear"]["huobao"],
            {"weapon": "bintie", "armor": "xipijia"},
        )

    def test_release_refunds_equipment_and_reload_does_not_reprompt(self) -> None:
        fixture = self.captured_firetroop_fixture(self.fresh_campaign())
        path = self.enter_deal(fixture)

        self.page.click("#btn-firetroop-release")
        self.page.wait_for_selector("#modal-firetroop-deal", state="detached")
        self.assert_release_portrait_uses_loaded_art()

        saved = self.stored_campaign()
        self.assertEqual(saved["flags"].get("firetroopDeal"), "release")
        self.assertNotIn("firetroopDealPending", saved["flags"])
        self.assertFalse(any(pet["key"] == "huobao" for pet in saved["pets"]))
        self.assertNotIn("huobao", saved["gear"])
        self.assertEqual(saved["equipBag"]["bintie"], 2)
        self.assertEqual(saved["equipBag"]["xipijia"], 1)

        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        path = BrowserPath(self.page)
        path.track("main")
        self.advance_to_guide(path)
        self.assertEqual(self.page.locator("#modal-firetroop-deal").count(), 0)
        reloaded = self.stored_campaign()
        self.assertEqual(reloaded["equipBag"]["bintie"], 2)
        self.assertEqual(reloaded["equipBag"]["xipijia"], 1)

    def test_release_clue_blocks_real_outer_trap_and_is_written_to_hunt(self) -> None:
        fixture = self.captured_firetroop_fixture(self.fresh_campaign())
        path = self.enter_deal(fixture)
        self.page.click("#btn-firetroop-release")
        self.page.wait_for_selector("#modal-firetroop-deal", state="detached")
        self.assert_release_portrait_uses_loaded_art()
        self.advance_to_guide(path)

        self.page.click("#hunt-guide-sha")
        self.page.wait_for_selector("#treasure-root")
        self.page.locator(".treasure-clue", has_text="火兵退路 · 可避险").wait_for()

        # 纯规则模块中 seed=302 的外层第 8 格是唯一妖气；落地仍通过真实按钮输入。
        self.page.click('[data-treasure-index="8"]')
        snapshot = self.page.evaluate("__game.treasure()")
        self.assertEqual(snapshot["threat"], 0)
        self.assertTrue(snapshot["firetroopClueUsed"])
        self.assertEqual(
            self.page.locator(".treasure-clue").inner_text(),
            "火兵退路 · 已避险",
        )
        SHOTS.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(
            path=SHOTS / "01_release-clue-consumed.jpg",
            type="jpeg",
            quality=82,
        )

        # 再完成两次真实外层挖掘并收手，让实际消费事实进入 hunts.fire。
        self.page.click('[data-treasure-index="0"]')
        self.page.click('[data-treasure-index="1"]')
        self.page.wait_for_selector("#treasure-settle")
        self.page.click("#treasure-settle")
        self.page.wait_for_selector("#modal-hunt-result")
        self.page.click("#hunt-return")
        path.back_to_world("huokou")

        saved = self.stored_campaign()
        self.assertTrue(saved["hunts"]["fire"]["firetroopClueUsed"])
        self.assertEqual(saved["flags"].get("firetroopDeal"), "release")

    def test_legacy_captured_save_without_pending_fact_skips_deal(self) -> None:
        fixture = self.captured_firetroop_fixture(
            self.fresh_campaign(), pending=False
        )
        self.assertNotIn("firetroopDeal", fixture["flags"])
        path = self.install_campaign(fixture)
        path.track("main")
        self.advance_to_guide(path)

        self.assertEqual(self.page.locator("#modal-firetroop-deal").count(), 0)
        self.assertEqual(self.page.locator("#modal-hunt-guide").count(), 1)
        self.assertNotIn("firetroopDeal", self.stored_campaign()["flags"])

    def assert_release_portrait_uses_loaded_art(self) -> None:
        portrait = self.page.locator(".dlg-portrait")
        portrait.wait_for(state="visible")
        self.page.wait_for_function(
            "() => document.querySelector('.dlg-portrait')?.naturalWidth > 0"
        )
        src = portrait.get_attribute("src") or ""
        self.assertIn("assets/units/mob_fire1.webp", src)
        self.assertFalse(src.startswith("data:image"), "火兵对白不得回退为字形头像")


if __name__ == "__main__":
    unittest.main(verbosity=2)
