#!/usr/bin/env python3
"""首次试玩发现的结局布局回归；测试存档只用于知情复测。"""

import os
from pathlib import Path
import time
import unittest

from playwright.sync_api import sync_playwright
from qa_browser import BASE_URL, ensure_server


class EndingAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ensure_server()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(args=["--disable-audio-output"])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        if cls.server:
            cls.server.terminate()
            cls.server.wait(timeout=3)

    def test_ending_readable_and_restart_reachable(self):
        for width, height in [(390, 844), (844, 390), (1280, 720)]:
            with self.subTest(viewport=(width, height)):
                context = self.browser.new_context(viewport={"width": width, "height": height})
                page = context.new_page()
                try:
                    page.goto(f"{BASE_URL}/?seed=42&fast=1")
                    page.wait_for_selector("#btn-start")
                    page.evaluate("""async () => {
                      const {newCampaign} = await import('./js/progress.js');
                      const c = newCampaign(42);
                      c.stage = 'done'; c.treasure = 'dingfengdan';
                      c.flags.firetroopDeal = 'keep'; c.fanFooled = false;
                      c.hunts.fire = {guide:'wukong', deepened:true};
                      c.pets = [{key:'huobao', active:true}];
                      localStorage.setItem('xiyou_save_v1', JSON.stringify(c));
                    }""")
                    page.reload()
                    page.click("#btn-continue")
                    deadline = time.monotonic() + 25
                    while not page.locator(".ending-panel").count() and time.monotonic() < deadline:
                        if page.locator("#dialog").count():
                            page.locator("#dialog").click()
                        page.wait_for_timeout(180)
                    panel = page.locator(".ending-panel")
                    panel.wait_for()
                    page.wait_for_timeout(1700)  # 结局主视觉淡入完成后留代表帧。
                    output = Path(os.environ.get("AUDIT_ENDING_SHOTS", "/tmp/xiyou-ending-audit"))
                    output.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=output / f"ending-{width}x{height}.jpg", type="jpeg", quality=85)
                    metrics = panel.evaluate("""p => {
                      const box = p.getBoundingClientRect();
                      const rect = s => {const r=p.querySelector(s).getBoundingClientRect();
                        return {left:r.left, right:r.right, top:r.top, bottom:r.bottom};};
                      return {width:box.width, left:box.left, right:box.right,
                        overflow:p.scrollWidth > p.clientWidth,
                        title:rect('.ending-title'), restart:rect('#btn-restart')};
                    }""")
                    if width <= 700:
                        self.assertGreaterEqual(metrics["width"], width * .85, metrics)
                    self.assertFalse(metrics["overflow"], metrics)
                    for key in ["title", "restart"]:
                        self.assertGreaterEqual(metrics[key]["left"], 0, metrics)
                        self.assertLessEqual(metrics[key]["right"], width, metrics)
                        self.assertGreaterEqual(metrics[key]["top"], 0, metrics)
                        self.assertLessEqual(metrics[key]["bottom"], height, metrics)
                    # 最后一条痕迹能滚到，且重开无需先滚正文寻找。
                    page.locator(".ending-recap p").last.scroll_into_view_if_needed()
                    page.click("#btn-restart")
                    page.wait_for_selector("#btn-start")
                    self.assertIsNone(page.evaluate("localStorage.getItem('xiyou_save_v1')"))
                finally:
                    context.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
