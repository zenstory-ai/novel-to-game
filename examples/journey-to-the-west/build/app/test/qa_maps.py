#!/usr/bin/env python3
"""重叠绘景地图、空间碰撞、支路探索与窄屏小地图的定向浏览器回归。

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
import time
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


def point_in_polygon(point: tuple[float, float], polygon: list[list[float]]) -> bool:
    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing_x:
                inside = not inside
        previous = current
    return inside


def point_segment_distance(point: tuple[float, float], start: list[float], end: list[float]) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    ratio = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy))


def point_in_path(point: tuple[float, float], path: dict[str, object], clearance: float) -> bool:
    points = path["points"]
    radius = path["width"] / 2 - clearance
    if len(points) == 1:
        return math.dist(point, points[0]) <= radius + 1
    return any(point_segment_distance(point, start, end) <= radius + 1 for start, end in zip(points, points[1:]))


def point_rectangle_distance(point: tuple[float, float], prop: dict[str, object]) -> float:
    x, y = point
    left, top, right, bottom = prop["footprint"]
    left += prop["at"][0]
    right += prop["at"][0]
    top += prop["at"][1]
    bottom += prop["at"][1]
    dx = max(left - x, 0, x - right)
    dy = max(top - y, 0, y - bottom)
    return math.hypot(dx, dy)


def point_polygon_distance(point: tuple[float, float], polygon: list[list[float]]) -> float:
    if point_in_polygon(point, polygon):
        return 0
    closed = polygon[1:] + polygon[:1]
    return min(point_segment_distance(point, start, end) for start, end in zip(polygon, closed))


def story_url(*, fast: bool = True) -> str:
    return f"{BASE_URL}/?seed=42" + ("&fast=1" if fast else "")


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

    def reset_context(self, width: int, height: int, *, device_scale_factor: float = 1) -> None:
        self.context.close()
        self.context = self.browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=device_scale_factor,
        )
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

    def install_campaign(self, campaign: dict[str, object], *, fast: bool = True) -> None:
        self.page.goto(story_url(fast=fast))
        self.page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        self.page.reload()
        self.page.wait_for_selector("#btn-continue")
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        self.page.wait_for_function("() => document.querySelector('.hud-minimap')?.dataset.k")
        self.page.wait_for_function("() => window.__game.world?.()?.player")

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

    def minimap_click_point(self, point: list[float]) -> None:
        scale = self.page.evaluate("window.__game.world().scale")
        target = self.page.locator(".hud-minimap").evaluate(
            """(canvas, { point, scale }) => ({
              x: (Number(canvas.dataset.ox) + point[0] * scale * Number(canvas.dataset.k))
                * canvas.getBoundingClientRect().width / canvas.width,
              y: (Number(canvas.dataset.oy) + point[1] * scale * Number(canvas.dataset.k))
                * canvas.getBoundingClientRect().height / canvas.height,
            })""",
            {"point": point, "scale": scale},
        )
        self.page.locator(".hud-minimap").click(position=target)

    def walk_trace(self, target: list[float], *, timeout_seconds: float = 18) -> list[dict[str, object]]:
        self.minimap_click_point(target)
        self.page.wait_for_function("() => window.__game.world().player.moving", timeout=4000)
        trace: list[dict[str, object]] = []
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            snapshot = self.page.evaluate("window.__game.world()")
            trace.append(snapshot)
            if len(trace) > 1 and not snapshot["player"]["moving"]:
                return trace
            self.page.wait_for_timeout(55)
        self.fail(f"角色未在 {timeout_seconds:.0f} 秒内结束移动；末帧={trace[-1] if trace else None}")

    def trace_walkability(self, snapshots: list[dict[str, object]]) -> dict[str, object]:
        return self.page.evaluate(
            """async snapshots => {
              const [{ SCENES, MAP_SCALE, GRID }, { createNavigation }] = await Promise.all([
                import('./js/world.js'), import('./js/world-navigation.js'),
              ]);
              const scene = SCENES[snapshots[0].sceneId];
              const navigation = createNavigation({
                size: scene.size, walk: scene.walk, paths: scene.paths,
                blockers: scene.blockers, clearance: scene.clearance,
                scale: MAP_SCALE, grid: GRID,
              });
              const invalid = [];
              snapshots.forEach((snapshot, frame) => {
                [['player', snapshot.player], ...snapshot.followers.map(actor => [actor.id, actor])]
                  .forEach(([id, actor]) => {
                    if (!navigation.isPointWalkable(actor.x, actor.y)) invalid.push({ frame, id, x: actor.x, y: actor.y });
                  });
              });
              return { invalid, scale: MAP_SCALE };
            }""",
            snapshots,
        )

    def scene_geometry(self, scene: str) -> dict[str, object]:
        return self.page.evaluate(
            """async sceneId => {
              const { SCENES } = await import('./js/world.js');
              const scene = SCENES[sceneId];
              return {
                paths: scene.paths,
                clearance: scene.clearance,
                blockers: scene.blockers,
              };
            }""",
            scene,
        )

    def assert_trace_matches_scene_geometry(self, snapshots: list[dict[str, object]], geometry: dict[str, object]) -> None:
        scale = snapshots[0]["scale"]
        for frame_index, snapshot in enumerate(snapshots):
            actors = [("player", snapshot["player"])] + [
                (actor["id"], actor) for actor in snapshot["followers"]
            ]
            for actor_id, actor in actors:
                point = (actor["x"] / scale, actor["y"] / scale)
                self.assertTrue(
                    any(point_in_path(point, path, geometry["clearance"]) for path in geometry["paths"]),
                    f"第 {frame_index} 帧 {actor_id} 脚点离开道路：{point}",
                )
                for blocker_index, blocker in enumerate(geometry["blockers"]):
                    self.assertGreaterEqual(
                        point_polygon_distance(point, blocker) + 1,
                        geometry["clearance"],
                        f"第 {frame_index} 帧 {actor_id} 脚点侵入 blocker {blocker_index} 安全圈：{point}",
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

    def test_scenes_use_only_complete_overlapping_painted_quarters_at_runtime(self) -> None:
        self.page.goto(story_url())
        contract = self.page.evaluate(
            """async () => {
              const { SCENES } = await import('./js/world.js');
              return Object.fromEntries(['village', 'cuiyun', 'huokou', 'jilei'].map(key => {
                const scene = SCENES[key];
                return [key, {
                  world: scene.size,
                  painted: scene.terrain?.painted ?? false,
                  overlap: scene.terrain?.overlap ?? false,
                  chunks: scene.terrain?.chunks ?? [],
                  pathCount: scene.paths?.length ?? 0,
                  sceneryCount: scene.scenery?.length ?? 0,
                  clearance: scene.clearance ?? null,
                  solidWithoutFootprint: (scene.scenery ?? [])
                    .filter(item => item.solid !== false && !item.footprint)
                    .map(item => item.id ?? item.art),
                }];
              }));
            }"""
        )
        for scene, measured in contract.items():
            with self.subTest(scene=scene):
                self.assertEqual(measured["world"], [2400, 1600])
                self.assertTrue(measured["painted"])
                self.assertTrue(measured["overlap"])
                self.assertEqual(len(measured["chunks"]), 4)
                self.assertEqual(
                    [chunk["art"] for chunk in measured["chunks"]],
                    [f"{scene}-overlap-{quadrant}" for quadrant in ("nw", "ne", "sw", "se")],
                )
                self.assertEqual(
                    [chunk["at"] for chunk in measured["chunks"]],
                    [[0, 0], [1080, 0], [0, 720], [1080, 720]],
                )
                self.assertTrue(all(chunk["size"] == [1320, 880] for chunk in measured["chunks"]))
                self.assertEqual([chunk["fadeLeft"] for chunk in measured["chunks"]], [0, 240, 0, 240])
                self.assertEqual([chunk["fadeTop"] for chunk in measured["chunks"]], [0, 0, 160, 160])
                self.assertGreater(measured["pathCount"], 0)
                self.assertGreater(measured["sceneryCount"], 0)
                self.assertEqual(measured["clearance"], 18)
                self.assertEqual(measured["solidWithoutFootprint"], [])
        loaded_map_assets = self.page.evaluate(
            """performance.getEntriesByType('resource').map(entry => entry.name)
              .filter(name => name.includes('/assets/terrain/'))"""
        )
        self.assertEqual(len(loaded_map_assets), 16)
        self.assertTrue(all("-overlap-" in asset and asset.endswith(".webp?art=20260905-reimagine") for asset in loaded_map_assets))

    def test_painted_quarters_supply_one_source_pixel_per_css_pixel_without_dpr2_claim(self) -> None:
        self.reset_context(1440, 900, device_scale_factor=2)
        self.page.goto(story_url())
        measurements = self.page.evaluate(
            """async () => {
              const { SCENES, MAP_SCALE } = await import('./js/world.js');
              const specs = new Map();
              for (const scene of Object.values(SCENES)) {
                for (const chunk of scene.terrain.chunks) {
                  specs.set(`terrain/${chunk.art}.webp`, { size: chunk.size });
                }
              }
              const load = (asset, spec) => new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve({
                  asset, natural: [image.naturalWidth, image.naturalHeight],
                  requiredPixels: [spec.size[0] * MAP_SCALE, spec.size[1] * MAP_SCALE],
                });
                image.onerror = () => resolve({ asset, natural: [0, 0], requiredPixels: [spec.size[0] * MAP_SCALE, spec.size[1] * MAP_SCALE] });
                image.src = `assets/${asset}`;
              });
              return Promise.all([...specs].map(([asset, spec]) => load(asset, spec)));
            }"""
        )
        for measured in measurements:
            with self.subTest(asset=measured["asset"]):
                self.assertGreater(measured["natural"][0], 0, f"缺少分层美术：{measured['asset']}")
                self.assertGreaterEqual(
                    measured["natural"][0], measured["requiredPixels"][0],
                    f"{measured['asset']} 横向会超过源像素尺寸",
                )
                self.assertGreaterEqual(
                    measured["natural"][1], measured["requiredPixels"][1],
                    f"{measured['asset']} 纵向会超过源像素尺寸",
                )

    def test_four_way_overlap_blends_four_distinct_sources_bilinearly(self) -> None:
        self.page.goto(story_url())
        continuity = self.page.evaluate(
            """async () => {
              const { createMapRenderer } = await import('./js/map-renderer.js');
              const colors = {
                nw: [200, 40, 20], ne: [20, 180, 40],
                sw: [40, 20, 200], se: [180, 160, 60],
              };
              const images = Object.fromEntries(Object.entries(colors).map(([key, rgb]) => {
                const image = document.createElement('canvas');
                image.width = 1320;
                image.height = 880;
                const context = image.getContext('2d');
                context.fillStyle = `rgb(${rgb.join(',')})`;
                context.fillRect(0, 0, image.width, image.height);
                return [key, image];
              }));
              const chunks = [
                { art: 'nw', at: [0, 0], size: [1320, 880], fadeLeft: 0, fadeTop: 0 },
                { art: 'ne', at: [1080, 0], size: [1320, 880], fadeLeft: 240, fadeTop: 0 },
                { art: 'sw', at: [0, 720], size: [1320, 880], fadeLeft: 0, fadeTop: 160 },
                { art: 'se', at: [1080, 720], size: [1320, 880], fadeLeft: 240, fadeTop: 160 },
              ];
              const renderer = createMapRenderer({
                id: 'synthetic-overlap', size: [2400, 1600],
                terrain: { painted: true, overlap: true, baseColor: '#111111', chunks },
              }, { textureImage: key => images[key] });
              const output = document.createElement('canvas');
              output.width = 2400;
              output.height = 1600;
              renderer.drawTerrain(output.getContext('2d'), { x: 0, y: 0, vw: 2400, vh: 1600 });
              const context = output.getContext('2d');
              const xs = [1079, 1080, 1199, 1200, 1319, 1320, 1321];
              const ys = [719, 720, 799, 800, 879, 880, 881];
              const samples = [];
              for (const y of ys) for (const x of xs) {
                const horizontal = Math.max(0, Math.min(1, (x + 0.5 - 1080) / 240));
                const vertical = Math.max(0, Math.min(1, (y + 0.5 - 720) / 160));
                const weights = {
                  nw: (1 - horizontal) * (1 - vertical),
                  ne: horizontal * (1 - vertical),
                  sw: (1 - horizontal) * vertical,
                  se: horizontal * vertical,
                };
                const expected = [0, 1, 2].map(channel => Object.entries(weights)
                  .reduce((sum, [key, weight]) => sum + colors[key][channel] * weight, 0));
                samples.push({
                  at: [x, y], expected,
                  rgba: [...context.getImageData(x, y, 1, 1).data],
                });
              }
              renderer.dispose();
              return samples;
            }"""
        )
        for sample in continuity:
            with self.subTest(at=sample["at"]):
                self.assertEqual(sample["rgba"][3], 255)
                for actual, expected in zip(sample["rgba"][:3], sample["expected"]):
                    self.assertLessEqual(
                        abs(actual - expected),
                        3,
                        f"四块交汇处 {sample['at']} 未按双线性权重连续混合："
                        f"actual={sample['rgba']} expected={sample['expected']}",
                    )

    def test_clicking_a_building_footprint_never_places_the_player_inside_it(self) -> None:
        base = self.fresh_campaign()
        self.install_campaign(self.scene_fixture(base, "village"))
        prop = self.page.evaluate(
            """async () => {
              const { SCENES } = await import('./js/world.js');
              return SCENES.village.scenery.find(item => item.id === 'blacksmith');
            }"""
        )
        left, top, right, bottom = prop["footprint"]
        target = [prop["at"][0] + (left + right) / 2, prop["at"][1] + (top + bottom) / 2]
        trace = self.walk_trace(target)
        result = self.trace_walkability(trace)
        self.assertEqual(result["invalid"], [])
        self.assert_trace_matches_scene_geometry(trace, self.scene_geometry("village"))
        clearance = 18
        for snapshot in trace:
            x = snapshot["player"]["x"] / result["scale"]
            y = snapshot["player"]["y"] / result["scale"]
            self.assertFalse(
                prop["at"][0] + left - clearance <= x <= prop["at"][0] + right + clearance
                and prop["at"][1] + top - clearance <= y <= prop["at"][1] + bottom + clearance,
                f"玩家脚点进入铁匠铺占地安全圈：({x:.1f}, {y:.1f})",
            )

    def test_crossing_water_keeps_every_footpoint_on_the_bridge_path(self) -> None:
        base = self.fresh_campaign()
        self.install_campaign(self.scene_fixture(base, "cuiyun"), fast=False)
        geometry = self.page.evaluate(
            """async () => {
              const { SCENES } = await import('./js/world.js');
              const scene = SCENES.cuiyun;
              return { feature: scene.features.find(item => item.kind === 'water'), paths: scene.paths, clearance: scene.clearance };
            }"""
        )
        trace = self.walk_trace([850, 1050])
        result = self.trace_walkability(trace)
        self.assertEqual(result["invalid"], [])
        self.assert_trace_matches_scene_geometry(trace, self.scene_geometry("cuiyun"))
        water_steps = []
        for snapshot in trace:
            point = (snapshot["player"]["x"] / result["scale"], snapshot["player"]["y"] / result["scale"])
            if point_in_polygon(point, geometry["feature"]["polygon"]):
                water_steps.append(point)
                self.assertTrue(
                    any(point_in_path(point, path, geometry["clearance"]) for path in geometry["paths"]),
                    f"玩家脚点离开桥路后踩入水面：{point}",
                )
        self.assertGreater(len(water_steps), 3, "实走轨迹应真实穿过河面上的桥段")

    def test_clicking_water_beside_the_bridge_stops_at_a_walkable_edge(self) -> None:
        base = self.fresh_campaign()
        self.install_campaign(self.scene_fixture(base, "cuiyun"))
        geometry = self.scene_geometry("cuiyun")
        feature = self.page.evaluate(
            """async () => {
              const { SCENES } = await import('./js/world.js');
              return SCENES.cuiyun.features.find(item => item.kind === 'water');
            }"""
        )
        requested = (1050.0, 850.0)
        self.assertTrue(point_in_polygon(requested, feature["polygon"]))
        self.assertFalse(any(point_in_path(requested, path, geometry["clearance"]) for path in geometry["paths"]))
        trace = self.walk_trace(list(requested))
        self.assert_trace_matches_scene_geometry(trace, geometry)
        endpoint = (
            trace[-1]["player"]["x"] / trace[-1]["scale"],
            trace[-1]["player"]["y"] / trace[-1]["scale"],
        )
        self.assertGreater(math.dist(endpoint, requested), 20, "桥外水面点击不应被当作可站立终点")

    def test_normal_speed_bend_keeps_followers_inside_shared_navigation_geometry(self) -> None:
        base = self.fresh_campaign()
        self.install_campaign(self.scene_fixture(base, "village"), fast=False)
        target = (1750, 500)
        trace = self.walk_trace(list(target))
        result = self.trace_walkability(trace)
        self.assertEqual(result["invalid"], [])
        self.assert_trace_matches_scene_geometry(trace, self.scene_geometry("village"))
        endpoint = (trace[-1]["player"]["x"] / result["scale"], trace[-1]["player"]["y"] / result["scale"])
        self.assertLess(math.dist(endpoint, target), 12, f"玩家应走完整条弯路而非首段提前停下：{endpoint}")
        self.assertGreater(len(trace), 24, "常速弯路应留下足够连续的空间采样")
        player_points = [
            (frame["player"]["x"] / result["scale"], frame["player"]["y"] / result["scale"])
            for frame in trace
        ]
        self.assertGreater(
            max(point_segment_distance(point, list(player_points[0]), list(target)) for point in player_points),
            35,
            "实际脚点应走过道路弯折，而不是把多段路当成直线",
        )
        for follower_id in ("tang", "bajie", "sha"):
            positions = [
                (next(actor for actor in frame["followers"] if actor["id"] == follower_id)["x"],
                 next(actor for actor in frame["followers"] if actor["id"] == follower_id)["y"])
                for frame in trace
            ]
            self.assertGreater(math.dist(positions[0], positions[-1]), 300, f"{follower_id} 应实际跟过弯路")
            elapsed = max(0.001, (trace[-1]["time"] - trace[0]["time"]) / 1000)
            travelled = sum(math.dist(start, end) for start, end in zip(positions, positions[1:]))
            self.assertLessEqual(
                travelled,
                270 * 1.2 * elapsed + 3,
                f"{follower_id} 常速追赶的累计速度不应超过主角速度的 1.2 倍",
            )

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
                if scene == "cuiyun":
                    self.walk_trace([850, 1050])
                elif scene == "huokou":
                    self.walk_trace([1500, 1100])
                self.page.wait_for_function(
                    "() => window.__game.world().followers.every(actor => !actor.moving)",
                    timeout=8000,
                )
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
