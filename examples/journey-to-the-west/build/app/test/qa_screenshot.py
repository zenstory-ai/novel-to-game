#!/usr/bin/env python3
"""代表帧必须等入战遮罩退场后再保存。"""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from playwright.sync_api import Page, sync_playwright

import qa_browser


class CaptureProbe:
    """把真实 Page 交给 BrowserPath，并在截图入口记录遮罩状态。"""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.overlay_count_at_capture: int | None = None

    def __getattr__(self, name: str):
        return getattr(self.page, name)

    def screenshot(self, **kwargs):
        self.overlay_count_at_capture = self.page.locator(".ink-swirl").count()
        if self.overlay_count_at_capture:
            raise AssertionError("入战遮罩仍在时保存了代表帧")
        return self.page.screenshot(**kwargs)


class ScreenshotReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = qa_browser.ensure_server()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.browser.close()
        cls.playwright.stop()
        if cls.server:
            cls.server.terminate()
            cls.server.wait(timeout=3)

    def test_shot_waits_for_real_ink_swirl_to_leave(self) -> None:
        page = self.browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(qa_browser.BASE_URL, wait_until="domcontentloaded")
        page.wait_for_selector("#app")

        # 真实入战流程会在 inkSwirl 的 Promise 返回后创建战斗界面；遮罩再过 260ms 才移除。
        page.evaluate(
            """async () => {
              const { inkSwirl } = await import('./js/ui.js');
              const root = document.querySelector('#app');
              await inkSwirl(root, false);
              const button = document.createElement('button');
              button.className = 'cmd-btn';
              button.dataset.cmd = 'auto';
              button.textContent = '挂机';
              root.appendChild(button);
            }"""
        )
        self.assertTrue(page.locator('.cmd-btn[data-cmd="auto"]').is_visible())
        self.assertEqual(page.locator(".ink-swirl").count(), 1)

        probe = CaptureProbe(page)
        with tempfile.TemporaryDirectory() as temp_dir:
            previous_shots = qa_browser.SHOTS
            qa_browser.SHOTS = Path(temp_dir)
            try:
                output = qa_browser.BrowserPath(probe).shot("battle-ready")
            finally:
                qa_browser.SHOTS = previous_shots
            self.assertTrue(output.is_file())

        self.assertEqual(probe.overlay_count_at_capture, 0)
        page.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
