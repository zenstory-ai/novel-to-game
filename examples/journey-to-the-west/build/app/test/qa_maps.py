#!/usr/bin/env python3
"""扩展场景、支路探索与窄屏小地图的定向浏览器回归。

存档夹具只选择合法剧情阶段与既有资源；移动、探索、取消和重访都经
真实 canvas / minimap / modal 输入完成。本脚本不写权威 QA 事实源。
"""

from __future__ import annotations

import copy
import json
import math
import os
from pathlib import Path
import re
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import PROJECT, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(os.environ.get("MAPS_SHOTS", PROJECT / "qa/evidence/maps"))
SCENES = {
    "village": ("prologue", ("village_well", "village_fields"), "01_village_districts.jpg"),
    "cuiyun": ("prologue", ("cuiyun_grove", "cuiyun_basket"), "02_cuiyun_districts.jpg"),
    "huokou": ("pre_fire", ("huokou_bricks", "huokou_shelter"), "03_huokou_districts.jpg"),
    "jilei": ("pre_yumian", ("jilei_camp", "jilei_lookout"), "04_jilei_districts.jpg"),
}
VISITED_CHOICE = {
    "village_well": "jinchuang",
    "cuiyun_grove": "observe",
    "huokou_bricks": "observe",
    "jilei_camp": "buyaosheng",
}


def story_url() -> str:
    return f"{BASE_URL}/?seed=42&fast=1"


class ExpandedMapBrowserTests(unittest.TestCase):
    browser: Browser

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ensure_server()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(args=["--disable-audio-output"])
        SHOTS.mkdir(parents=True, exist_ok=True)

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

    def tearDown(self) -> None:
        self.context.close()

    def reset_context(self, width: int, height: int) -> None:
        self.context.close()
        self.context = self.browser.new_context(viewport={"width": width, "height": height})
        self.page = self.context.new_page()

    def fresh_campaign(self) -> dict[str, object]:
        self.page.goto(story_url())
        self.page.wait_for_selector("#btn-start")
        self.page.evaluate("localStorage.clear()")
        self.page.reload()
        self.page.wait_for_selector("#btn-start")
        self.page.click("#btn-start")
        self.page.wait_for_function(f"() => localStorage.getItem('{SAVE_KEY}') !== null")
        return self.page.evaluate(f"JSON.parse(localStorage.getItem('{SAVE_KEY}'))")

    @staticmethod
    def scene_fixture(base: dict[str, object], scene: str, *, exploration=None) -> dict[str, object]:
        campaign = copy.deepcopy(base)
        campaign["stage"] = SCENES[scene][0]
        campaign["flags"] = {"tudi": True}
        campaign["world"] = {"scene": scene}
        campaign["chaptersSeen"] = {"c1": True}
        campaign["exploration"] = copy.deepcopy(exploration or {})
        return campaign

    def install_campaign(self, campaign: dict[str, object]) -> None:
        self.page.goto(story_url())
        self.page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        self.page.wait_for_function("() => document.querySelector('.hud-minimap')?.dataset.k")

    def stored_campaign(self) -> dict[str, object]:
        raw = self.page.evaluate(f"localStorage.getItem('{SAVE_KEY}')")
        self.assertIsNotNone(raw)
        return json.loads(raw)

    def landmark_point(self, scene: str, landmark_id: str) -> dict[str, float]:
        return self.page.evaluate(
            """async ([sceneId, landmarkId]) => {
              const { SCENES, MAP_SCALE } = await import('./js/world.js');
              const landmark = SCENES[sceneId].landmarks?.[landmarkId];
              return landmark ? { x: landmark.at[0], y: landmark.at[1], scale: MAP_SCALE } : null;
            }""",
            [scene, landmark_id],
        )

    def minimap_move_to_landmark(self, scene: str, landmark_id: str, *, wait_for_arrival: bool = False) -> None:
        point = self.landmark_point(scene, landmark_id)
        self.assertIsNotNone(point, f"{landmark_id} 应存在于 {scene}")
        target = self.page.locator(".hud-minimap").evaluate(
            """(canvas, p) => ({
              x: (Number(canvas.dataset.ox) + p.x * p.scale * Number(canvas.dataset.k))
                * canvas.getBoundingClientRect().width / canvas.width,
              y: (Number(canvas.dataset.oy) + p.y * p.scale * Number(canvas.dataset.k))
                * canvas.getBoundingClientRect().height / canvas.height,
            })""",
            point,
        )
        self.page.locator(".hud-minimap").click(position=target)
        self.page.wait_for_function(
            """id => {
              const p = window.__game.npcScreenPos(id);
              const c = document.querySelector('#overworld-canvas')?.getBoundingClientRect();
              return p && c && p.x >= c.left + 30 && p.x <= c.right - 30
                && p.y >= c.top + 80 && p.y <= c.bottom - 30;
            }""",
            arg=landmark_id,
            timeout=12000,
        )
        if wait_for_arrival:
            self.page.wait_for_function(
                r"""([tx, ty]) => {
                  const match = document.querySelector('.hud-coords')?.textContent
                    ?.match(/\((\d+)\s*,\s*(\d+)\)/);
                  return match && Math.hypot(Number(match[1]) - tx, Number(match[2]) - ty) <= 12;
                }""",
                arg=[point["x"] / 10, point["y"] / 10],
                timeout=25000,
            )

    def open_landmark(self, scene: str, landmark_id: str) -> None:
        self.minimap_move_to_landmark(scene, landmark_id)
        pos = self.page.evaluate("id => window.__game.npcScreenPos(id)", landmark_id)
        self.page.mouse.click(pos["x"], pos["y"])
        self.page.wait_for_selector("#modal-exploration", timeout=12000)

    def minimap_has_color(self, scene: str, landmark_id: str, rgb: tuple[int, int, int]) -> bool:
        point = self.landmark_point(scene, landmark_id)
        return self.page.locator(".hud-minimap").evaluate(
            """(canvas, { point, rgb }) => {
              const k = Number(canvas.dataset.k);
              const cx = Math.round(Number(canvas.dataset.ox) + point.x * point.scale * k);
              const cy = Math.round(Number(canvas.dataset.oy) + point.y * point.scale * k);
              const data = canvas.getContext('2d').getImageData(cx - 5, cy - 5, 11, 11).data;
              for (let i = 0; i < data.length; i += 4) {
                if (Math.abs(data[i] - rgb[0]) <= 3
                    && Math.abs(data[i + 1] - rgb[1]) <= 3
                    && Math.abs(data[i + 2] - rgb[2]) <= 3
                    && data[i + 3] > 240) return true;
              }
              return false;
            }""",
            {"point": point, "rgb": list(rgb)},
        )

    @staticmethod
    def coords(text: str) -> tuple[int, int]:
        match = re.search(r"\((\d+)\s*,\s*(\d+)\)", text)
        if not match:
            raise AssertionError(f"无法读取坐标：{text}")
        return int(match.group(1)), int(match.group(2))

    def test_scenes_use_2400_by_1600_worlds_and_real_3_by_2_art(self) -> None:
        self.page.goto(story_url())
        dimensions = self.page.evaluate(
            """async () => {
              const { SCENES } = await import('./js/world.js');
              return Object.fromEntries(await Promise.all(
              ['village', 'cuiyun', 'huokou', 'jilei'].map(key => new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve([key, {
                  natural: [image.naturalWidth, image.naturalHeight],
                  world: SCENES[key].size,
                }]);
                image.onerror = () => resolve([key, { natural: [0, 0], world: SCENES[key].size }]);
                image.src = `assets/scene/map-${key}.jpg?v=20261101-districts`;
              }))
            ));
            }"""
        )
        for scene, measured in dimensions.items():
            with self.subTest(scene=scene):
                self.assertEqual(measured["world"], [2400, 1600])
                width, height = measured["natural"]
                self.assertGreaterEqual(width, 1536)
                self.assertGreaterEqual(height, 1024)
                self.assertAlmostEqual(width / height, 3 / 2, places=3)

    def test_each_scene_renders_two_landmarks_and_distinct_districts(self) -> None:
        base = self.fresh_campaign()
        for scene, (_, landmarks, shot) in SCENES.items():
            with self.subTest(scene=scene):
                fixture = self.scene_fixture(
                    base,
                    scene,
                    exploration={landmarks[0]: {"choice": VISITED_CHOICE[landmarks[0]]}},
                )
                self.install_campaign(fixture)
                for landmark_id in landmarks:
                    self.assertIsNotNone(self.page.evaluate("id => __game.npcScreenPos(id)", landmark_id))
                self.assertTrue(self.minimap_has_color(scene, landmarks[0], (99, 200, 178)))
                self.assertTrue(self.minimap_has_color(scene, landmarks[1], (240, 198, 77)))
                self.minimap_move_to_landmark(scene, landmarks[1], wait_for_arrival=True)
                self.page.screenshot(path=SHOTS / shot, type="jpeg", quality=82)

    def test_canceling_landmark_choice_changes_neither_state_nor_reward(self) -> None:
        base = self.fresh_campaign()
        fixture = self.scene_fixture(base, "village")
        before_items = copy.deepcopy(fixture["items"])
        self.install_campaign(fixture)
        self.open_landmark("village", "village_well")
        self.page.click("#explore-cancel")
        self.page.wait_for_selector("#modal-exploration", state="detached")
        current = self.page.evaluate("({ exploration: __game.campaign().exploration, items: __game.campaign().items })")
        self.assertEqual(current["exploration"], {})
        self.assertEqual(current["items"], before_items)

    def test_landmark_choice_saves_one_reward_and_survives_reload(self) -> None:
        base = self.fresh_campaign()
        fixture = self.scene_fixture(base, "village")
        before = fixture["items"].get("jinchuang", 0)
        self.install_campaign(fixture)
        self.open_landmark("village", "village_well")
        self.page.click("#explore-choice-jinchuang")
        self.page.wait_for_selector("#modal-exploration", state="detached")
        saved = self.stored_campaign()
        self.assertEqual(saved["exploration"]["village_well"], {"choice": "jinchuang"})
        self.assertEqual(saved["items"]["jinchuang"], before + 1)
        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        self.assertEqual(self.page.evaluate("__game.campaign().exploration.village_well.choice"), "jinchuang")

    def test_revisiting_landmark_does_not_duplicate_reward(self) -> None:
        base = self.fresh_campaign()
        base["items"]["jinchuang"] = base["items"].get("jinchuang", 0) + 1
        fixture = self.scene_fixture(base, "village", exploration={"village_well": {"choice": "jinchuang"}})
        self.install_campaign(fixture)
        self.open_landmark("village", "village_well")
        self.assertIn("已探", self.page.locator("#modal-exploration .modal-title").inner_text())
        self.assertEqual(self.page.locator('[id^="explore-choice-"]').count(), 0)
        self.page.click("#explore-cancel")
        self.assertEqual(self.page.evaluate("__game.campaign().items.jinchuang"), fixture["items"]["jinchuang"])

    def test_mobile_minimap_moves_across_expanded_map_without_hud_overlap(self) -> None:
        self.reset_context(390, 844)
        base = self.fresh_campaign()
        self.install_campaign(self.scene_fixture(base, "village"))
        minimap = self.page.locator(".hud-minimap")
        self.assertTrue(minimap.is_visible())
        before = self.coords(self.page.locator(".hud-coords").inner_text())
        self.minimap_move_to_landmark("village", "village_fields", wait_for_arrival=True)
        after = self.coords(self.page.locator(".hud-coords").inner_text())
        self.assertGreater(math.hypot(after[0] - before[0], after[1] - before[1]), 35)
        overlap = self.page.evaluate(
            """() => {
              const a = document.querySelector('.hud-map').getBoundingClientRect();
              const b = document.querySelector('.hud-cards').getBoundingClientRect();
              return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
                * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            }"""
        )
        self.assertEqual(overlap, 0)
        self.page.screenshot(path=SHOTS / "05_mobile_long_route.jpg", type="jpeg", quality=82)


if __name__ == "__main__":
    unittest.main(verbosity=2)
