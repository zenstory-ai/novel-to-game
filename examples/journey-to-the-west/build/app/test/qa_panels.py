#!/usr/bin/env python3
"""角色与系统面板、窄屏小地图的定向浏览器回归。

存档只布置合法的已推进资源状态；面板选择、加点、修炼、换装、宠物出战、
法宝改选、阵型与设置均通过真实 DOM 输入完成。本脚本不写权威 QA 事实源。
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import PROJECT, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
SHOTS = Path(os.environ.get("PANELS_SHOTS", PROJECT / "qa/evidence/panels"))


def story_url() -> str:
    return f"{BASE_URL}/?seed=42&fast=1"


class PanelBrowserTests(unittest.TestCase):
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
        self.context: BrowserContext = self.browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
        self.page: Page = self.context.new_page()

    def tearDown(self) -> None:
        self.context.close()

    def reset_context(self, width: int, height: int) -> None:
        self.context.close()
        self.context = self.browser.new_context(viewport={"width": width, "height": height})
        self.page = self.context.new_page()

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

    @staticmethod
    def rich_fixture(base: dict[str, object], *, pets: bool = True) -> dict[str, object]:
        campaign = copy.deepcopy(base)
        campaign["stage"] = "prologue"
        campaign["flags"] = {"tudi": True}
        campaign["world"] = {"scene": "village"}
        campaign["chaptersSeen"] = {"c1": True}
        campaign["levels"] = {
            "wukong": 4,
            "bajie": 4,
            "sha": 4,
            "pixie": 4,
            "huobao": 4,
        }
        campaign["storyLevel"] = 4
        campaign["money"] = 2200
        campaign["pendingPoints"] = {"wukong": 2, "bajie": 2, "sha": 2}
        campaign["skillPoints"] = {"wukong": 1, "bajie": 1, "sha": 1}
        campaign["alloc"] = {}
        campaign["skillLevels"] = {}
        campaign["gear"] = {}
        campaign["equipBag"] = {
            "jingtie": 1,
            "mianjia": 1,
            "bintie": 1,
            "xipijia": 1,
        }
        campaign["items"] = {
            "jinchuang": 3,
            "falidan": 2,
            "buyaosheng": 1,
            "bihuofu": 1,
        }
        campaign["treasure"] = "dingfengdan"
        campaign["formation"] = "tiangang"
        campaign["pets"] = (
            [{"key": "pixie", "active": True}, {"key": "huobao", "active": False}]
            if pets
            else []
        )
        campaign["petJoined"] = pets
        return campaign

    def install_campaign(self, campaign: dict[str, object]) -> None:
        page = self.page
        page.goto(story_url())
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        page.reload()
        page.wait_for_selector("#btn-continue")
        page.click("#btn-continue")
        page.wait_for_selector("#overworld-canvas")
        page.wait_for_selector("#topbar")
        self.wait_for_minimap_pixels()

    def wait_for_minimap_pixels(self) -> None:
        self.page.wait_for_function(
            """() => {
              const canvas = document.querySelector('.hud-minimap');
              if (!canvas) return false;
              const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
              let visible = 0;
              for (let i = 3; i < data.length; i += 4) if (data[i] > 0) visible++;
              return visible > data.length / 8;
            }""",
            timeout=5000,
        )

    def stored_campaign(self) -> dict[str, object]:
        raw = self.page.evaluate(f"localStorage.getItem('{SAVE_KEY}')")
        self.assertIsNotNone(raw)
        return json.loads(raw)

    def install_rich_campaign(self, *, pets: bool = True) -> None:
        base = self.fresh_campaign()
        self.install_campaign(self.rich_fixture(base, pets=pets))

    def assert_panel_contract(self, modal_id: str, viewport: tuple[int, int]) -> None:
        page = self.page
        modal = page.locator(f"#{modal_id}")
        panel = modal.locator(".panel-shell")
        page.wait_for_selector(f"#{modal_id} .panel-shell")
        metrics = panel.evaluate(
            """el => {
              const r = el.getBoundingClientRect();
              const body = el.querySelector('.modal-body');
              return {
                left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                width: r.width, height: r.height,
                bodyOverflow: body ? body.scrollWidth - body.clientWidth : 0
              };
            }"""
        )
        width, height = viewport
        self.assertGreater(metrics["width"], 0)
        self.assertGreater(metrics["height"], 0)
        self.assertGreaterEqual(metrics["left"], -0.5)
        self.assertGreaterEqual(metrics["top"], -0.5)
        self.assertLessEqual(metrics["right"], width + 0.5)
        self.assertLessEqual(metrics["bottom"], height + 0.5)
        self.assertLessEqual(metrics["bodyOverflow"], 1)
        self.assertEqual(modal.locator(".icon-badge").count(), 0)
        broken = modal.locator("img").evaluate_all(
            "imgs => imgs.filter(img => !img.complete || img.naturalWidth <= 0).map(img => img.src)"
        )
        self.assertEqual(broken, [])
        close = panel.locator(".panel-close")
        self.assertEqual(close.count(), 1)
        close.click()
        page.wait_for_selector(f"#{modal_id}", state="detached")

    def open_panel(self, button_id: str, modal_id: str) -> None:
        self.page.click(f"#{button_id}")
        self.page.wait_for_selector(f"#{modal_id} .panel-shell")

    def click_backdrop(self, modal_id: str) -> None:
        self.page.locator(f"#{modal_id}").click(position={"x": 2, "y": 2})

    def open_treasure_choice(self) -> None:
        self.page.click("#btn-treasure-swap")
        self.page.wait_for_selector("#modal-choice .panel-shell")

    def test_six_top_level_panels_close_from_backdrop_and_restore_opener_focus(self) -> None:
        self.install_rich_campaign()
        panels = [
            ("btn-hero", "modal-hero"),
            ("btn-bag", "modal-bag"),
            ("btn-pet", "modal-pet"),
            ("btn-quest", "modal-quest"),
            ("btn-formation", "modal-formation"),
            ("btn-system", "modal-system"),
        ]
        for button_id, modal_id in panels:
            with self.subTest(panel=modal_id):
                self.open_panel(button_id, modal_id)
                self.click_backdrop(modal_id)
                self.page.wait_for_selector(f"#{modal_id}", state="detached")
                self.assertEqual(self.page.evaluate("document.activeElement?.id"), button_id)
                self.assertNotIn(
                    "open", self.page.locator(f"#{button_id}").get_attribute("class") or ""
                )

    def test_inside_click_and_inside_to_backdrop_drag_do_not_close_panel(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        panel = self.page.locator("#modal-bag .panel-shell")
        panel.click(position={"x": 12, "y": 12})
        self.assertEqual(self.page.locator("#modal-bag").count(), 1)
        box = panel.bounding_box()
        self.assertIsNotNone(box)
        self.page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 24)
        self.page.mouse.down()
        self.page.mouse.move(2, 2)
        self.page.mouse.up()
        self.assertEqual(self.page.locator("#modal-bag").count(), 1)

    def test_top_level_panel_escape_and_close_button_restore_opener_focus(self) -> None:
        self.install_rich_campaign()
        for close_method in ("escape", "button"):
            with self.subTest(close_method=close_method):
                self.open_panel("btn-quest", "modal-quest")
                if close_method == "escape":
                    self.page.keyboard.press("Escape")
                else:
                    self.page.locator("#modal-quest .panel-close").click()
                self.page.wait_for_selector("#modal-quest", state="detached")
                self.assertEqual(self.page.evaluate("document.activeElement?.id"), "btn-quest")

    def test_panel_surface_and_backdrop_use_one_shared_opacity_contract(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        colors = self.page.locator("#modal-bag").evaluate(
            """mask => ({
              backdrop: getComputedStyle(mask).backgroundColor,
              surface: getComputedStyle(mask.querySelector('.panel-shell')).backgroundColor,
              closeSize: (() => {
                const r = mask.querySelector('.panel-close').getBoundingClientRect();
                return [r.width, r.height];
              })(),
            })"""
        )
        self.assertEqual(colors["backdrop"], "rgba(24, 30, 27, 0.32)")
        self.assertEqual(colors["surface"], "rgb(255, 249, 237)")
        self.assertGreaterEqual(colors["closeSize"][0], 44)
        self.assertGreaterEqual(colors["closeSize"][1], 44)

    def test_desktop_panels_share_shell_fit_viewport_and_load_art(self) -> None:
        self.install_rich_campaign()
        panels = [
            ("btn-hero", "modal-hero", "01_desktop_character.jpg"),
            ("btn-bag", "modal-bag", "02_desktop_bag.jpg"),
            ("btn-pet", "modal-pet", "03_desktop_pet.jpg"),
            ("btn-quest", "modal-quest", "04_desktop_quest.jpg"),
            ("btn-formation", "modal-formation", "05_desktop_formation.jpg"),
            ("btn-system", "modal-system", "06_desktop_settings.jpg"),
        ]
        for button_id, modal_id, shot in panels:
            with self.subTest(panel=modal_id):
                self.open_panel(button_id, modal_id)
                self.page.screenshot(path=SHOTS / shot, type="jpeg", quality=82)
                self.assert_panel_contract(modal_id, (1440, 900))

    def test_mobile_panels_share_shell_without_horizontal_overflow(self) -> None:
        self.reset_context(390, 844)
        self.install_rich_campaign()
        panels = [
            ("btn-hero", "modal-hero"),
            ("btn-bag", "modal-bag"),
            ("btn-pet", "modal-pet"),
            ("btn-quest", "modal-quest"),
            ("btn-formation", "modal-formation"),
            ("btn-system", "modal-system"),
        ]
        for button_id, modal_id in panels:
            with self.subTest(panel=modal_id):
                self.open_panel(button_id, modal_id)
                if modal_id == "modal-hero":
                    self.page.screenshot(
                        path=SHOTS / "07_mobile_character.jpg", type="jpeg", quality=82
                    )
                self.assert_panel_contract(modal_id, (390, 844))

    def test_mobile_character_bottom_actions_scroll_clear_of_status_strip(self) -> None:
        for width, height in [(390, 844), (320, 700)]:
            with self.subTest(viewport=f"{width}x{height}"):
                self.reset_context(width, height)
                self.install_rich_campaign()
                self.open_panel("btn-hero", "modal-hero")
                metrics = self.page.locator("#modal-hero .modal-body").evaluate(
                    """body => {
                      body.scrollTop = body.scrollHeight;
                      const action = body.querySelector('.recommend-actions').getBoundingClientRect();
                      const status = body.querySelector('.panel-status-strip').getBoundingClientRect();
                      const lastStat = body.querySelector('.stat-cell:last-child').getBoundingClientRect();
                      const bodyRect = body.getBoundingClientRect();
                      return {
                        actionBottom: action.bottom,
                        statusTop: status.top,
                        statusBottom: status.bottom,
                        lastStatBottom: lastStat.bottom,
                        actionTop: action.top,
                        bodyBottom: bodyRect.bottom,
                        scrollTop: body.scrollTop,
                        scrollHeight: body.scrollHeight,
                        clientHeight: body.clientHeight,
                      };
                    }"""
                )
                self.assertLessEqual(metrics["lastStatBottom"], metrics["actionTop"] + 0.5)
                self.assertLessEqual(metrics["actionBottom"], metrics["statusTop"] + 0.5)
                self.assertLessEqual(metrics["statusBottom"], metrics["bodyBottom"] + 0.5)
                self.assertGreaterEqual(
                    metrics["scrollTop"] + metrics["clientHeight"],
                    metrics["scrollHeight"] - 1,
                )
                if width == 390:
                    self.page.screenshot(
                        path=SHOTS / "07_mobile_character.jpg", type="jpeg", quality=82
                    )

    def test_character_stat_change_preserves_selected_member_and_tab(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-hero", "modal-hero")
        self.page.get_by_label("查看猪八戒").click()
        self.page.locator('[data-alloc-plus="bajie:体"]').click()
        detail = self.page.locator('#modal-hero .member-detail[data-hero="bajie"]')
        self.assertEqual(detail.count(), 1)
        self.assertEqual(
            self.page.locator('#modal-hero [role="tab"][aria-selected="true"]').inner_text(),
            "概览",
        )
        saved = self.stored_campaign()
        self.assertEqual(saved["pendingPoints"]["bajie"], 1)
        self.assertEqual(saved["alloc"]["bajie"]["体"], 1)

        self.page.get_by_label("气血减一点").click()
        self.assertEqual(
            self.page.locator('#modal-hero .member-detail[data-hero="bajie"]').count(), 1
        )
        saved = self.stored_campaign()
        self.assertEqual(saved["pendingPoints"]["bajie"], 2)
        self.assertEqual(saved["alloc"]["bajie"]["体"], 0)

    def test_character_stat_rebuild_preserves_focus_within_same_stat(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-hero", "modal-hero")
        self.page.get_by_label("查看猪八戒").click()
        plus = self.page.locator('[data-alloc-plus="bajie:体"]')

        plus.click()
        self.page.wait_for_function(
            "() => document.activeElement?.dataset.allocPlus === 'bajie:体'"
        )
        self.assertEqual(self.page.evaluate("document.activeElement?.dataset.allocPlus"), "bajie:体")

        self.page.locator('[data-alloc-plus="bajie:体"]').click()
        self.page.wait_for_function(
            "() => document.activeElement?.getAttribute('aria-label') === '气血减一点'"
        )
        self.assertEqual(
            self.page.evaluate("document.activeElement?.getAttribute('aria-label')"),
            "气血减一点",
        )

    def test_character_training_preserves_member_and_tab_after_point_and_study(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-hero", "modal-hero")
        self.page.get_by_label("查看沙悟净").click()
        self.page.get_by_role("tab", name="修炼").click()
        self.page.locator('[data-skill-plus^="sha:"]').first.click()
        self.assertEqual(
            self.page.locator('#modal-hero .member-detail[data-hero="sha"]').count(), 1
        )
        self.assertEqual(
            self.page.locator('#modal-hero [role="tab"][aria-selected="true"]').inner_text(),
            "修炼",
        )
        after_point = self.stored_campaign()
        self.assertEqual(after_point["skillPoints"]["sha"], 0)

        money_before = after_point["money"]
        self.page.locator('[data-skill-study^="sha:"]').first.click()
        after_study = self.stored_campaign()
        self.assertLess(after_study["money"], money_before)
        self.assertEqual(
            self.page.locator('#modal-hero .member-detail[data-hero="sha"]').count(), 1
        )
        self.assertEqual(
            self.page.locator('#modal-hero [role="tab"][aria-selected="true"]').inner_text(),
            "修炼",
        )

    def test_character_equipment_change_preserves_selected_member_and_tab(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-hero", "modal-hero")
        self.page.get_by_role("tab", name="装备").click()
        self.page.locator('[data-equip="wukong:bintie"]').click()
        saved = self.stored_campaign()
        self.assertEqual(saved["gear"]["wukong"]["weapon"], "bintie")
        self.assertEqual(
            self.page.locator('#modal-hero .member-detail[data-hero="wukong"]').count(), 1
        )
        self.assertEqual(
            self.page.locator('#modal-hero [role="tab"][aria-selected="true"]').inner_text(),
            "装备",
        )

    def test_pet_panel_has_specific_empty_state_when_no_pet_is_owned(self) -> None:
        self.install_rich_campaign(pets=False)
        self.open_panel("btn-pet", "modal-pet")
        empty = self.page.locator("#modal-pet .panel-empty-state")
        self.assertEqual(empty.count(), 1)
        self.assertIn("还没有召唤兽", empty.inner_text())
        self.assertIn("捕妖绳", empty.inner_text())

    def test_pet_selection_and_activation_persist_after_rebuild(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-pet", "modal-pet")
        self.page.get_by_label("查看赤焰火骝").click()
        self.assertEqual(
            self.page.locator('#modal-pet .member-detail[data-pet="huobao"]').count(), 1
        )
        self.page.locator('[data-pet-active="huobao"]:not(:disabled)').first.click()
        saved = self.stored_campaign()
        states = {pet["key"]: pet["active"] for pet in saved["pets"]}
        self.assertEqual(states, {"pixie": False, "huobao": True})
        self.assertEqual(
            self.page.locator('#modal-pet .member-detail[data-pet="huobao"]').count(), 1
        )
        self.assertTrue(self.page.locator('[data-pet-active="huobao"]').first.is_disabled())

    def test_pet_potential_points_are_in_overview_and_skills_stay_in_training(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-pet", "modal-pet")
        overview = self.page.locator("#modal-pet .member-tab-content")
        self.assertGreater(overview.locator(".stat-cell").count(), 0)
        self.assertEqual(overview.locator(".skill-cell").count(), 0)
        self.page.get_by_role("tab", name="修炼").click()
        training = self.page.locator("#modal-pet .member-tab-content")
        self.assertEqual(training.locator(".stat-cell").count(), 0)
        self.assertGreater(training.locator(".skill-cell").count(), 0)

    def test_bag_item_selection_shows_real_detail_and_treasure_swap_persists(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        self.page.locator('[data-bag-item="jinchuang"]').click()
        detail = self.page.locator("#modal-bag .bag-desc").inner_text()
        self.assertIn("金疮药 ×3", detail)
        self.assertIn("回复一半气血", detail)

        self.page.click("#btn-treasure-swap")
        self.page.wait_for_selector("#choice-bihuojin")
        self.page.click("#choice-bihuojin")
        self.page.wait_for_selector("#modal-bag")
        self.assertIn("避火锦", self.page.locator("#modal-bag .treasure-card").inner_text())
        self.assertEqual(self.stored_campaign()["treasure"], "bihuojin")

    def test_treasure_choice_arrow_key_and_enter_choose_second_card(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        self.page.click("#btn-treasure-swap")
        self.page.wait_for_selector("#modal-choice")
        self.page.keyboard.press("ArrowRight")
        self.assertEqual(
            self.page.evaluate("document.activeElement?.id"), "choice-bihuojin"
        )
        self.page.keyboard.press("Enter")
        self.page.wait_for_selector("#modal-choice", state="detached")
        self.assertEqual(self.stored_campaign()["treasure"], "bihuojin")

    def test_optional_treasure_choice_escape_cancels_only_top_layer_and_restores_focus(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        original = self.stored_campaign()["treasure"]
        self.open_treasure_choice()
        self.page.keyboard.press("Escape")
        self.page.wait_for_selector("#modal-choice", state="detached")
        self.assertEqual(self.page.locator("#modal-bag").count(), 1)
        self.assertEqual(self.stored_campaign()["treasure"], original)
        self.assertEqual(self.page.evaluate("document.activeElement?.id"), "btn-treasure-swap")

    def test_optional_treasure_choice_backdrop_and_close_button_cancel_without_state_change(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        original = self.stored_campaign()["treasure"]
        for close_method in ("backdrop", "button"):
            with self.subTest(close_method=close_method):
                self.open_treasure_choice()
                if close_method == "backdrop":
                    self.click_backdrop("modal-choice")
                else:
                    self.page.locator("#modal-choice .panel-close").click()
                self.page.wait_for_selector("#modal-choice", state="detached")
                self.assertEqual(self.page.locator("#modal-bag").count(), 1)
                self.assertEqual(self.stored_campaign()["treasure"], original)
                self.assertEqual(
                    self.page.evaluate("document.activeElement?.id"), "btn-treasure-swap"
                )

    def test_nested_overlay_does_not_dim_parent_twice(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        self.open_treasure_choice()
        colors = self.page.evaluate(
            """() => ({
              parent: getComputedStyle(document.querySelector('#modal-bag')).backgroundColor,
              child: getComputedStyle(document.querySelector('#modal-choice')).backgroundColor,
            })"""
        )
        self.assertEqual(colors["parent"], "rgba(24, 30, 27, 0.32)")
        self.assertEqual(colors["child"], "rgba(0, 0, 0, 0)")

    def test_required_choice_ignores_escape_and_backdrop(self) -> None:
        self.install_rich_campaign()
        self.page.evaluate(
            """async () => {
              const { showModal, el } = await import('./js/ui.js');
              showModal(document.querySelector('#app'), {
                id: 'modal-required-test', title: '必须选择',
                bodyNodes: [el('p', 'tutorial-line', '这一步必须明确选择。')],
                buttons: [{ label: '继续', id: 'required-continue' }],
              });
            }"""
        )
        self.page.wait_for_selector("#modal-required-test")
        self.assertEqual(self.page.locator("#modal-required-test .panel-close").count(), 0)
        self.page.keyboard.press("Escape")
        self.click_backdrop("modal-required-test")
        self.assertEqual(self.page.locator("#modal-required-test").count(), 1)
        self.page.click("#required-continue")
        self.page.wait_for_selector("#modal-required-test", state="detached")

    def test_cancelable_confirm_backdrop_resolves_false_and_restores_parent_focus(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-bag", "modal-bag")
        self.page.locator("#btn-treasure-swap").focus()
        self.page.evaluate(
            """async () => {
              const { confirmModal } = await import('./js/ui.js');
              document.body.dataset.confirmResult = 'pending';
              confirmModal(document.querySelector('#app'), {
                title: '确认测试', text: '确认要继续吗？'
              }).then(value => { document.body.dataset.confirmResult = String(value); });
            }"""
        )
        self.page.wait_for_selector("#modal-confirm")
        self.click_backdrop("modal-confirm")
        self.page.wait_for_selector("#modal-confirm", state="detached")
        self.page.wait_for_function("document.body.dataset.confirmResult === 'false'")
        self.assertEqual(self.page.locator("#modal-bag").count(), 1)
        self.assertEqual(self.page.evaluate("document.activeElement?.id"), "btn-treasure-swap")

    def test_short_mobile_panels_keep_content_height_and_reachable_header_controls(self) -> None:
        for width, height in [(390, 844), (320, 700)]:
            with self.subTest(viewport=f"{width}x{height}"):
                self.reset_context(width, height)
                campaign = self.rich_fixture(self.fresh_campaign())
                campaign["items"] = {}
                campaign["equipBag"] = {}
                campaign["treasure"] = None
                self.install_campaign(campaign)
                for button_id, modal_id in (("btn-bag", "modal-bag"), ("btn-system", "modal-system")):
                    with self.subTest(panel=modal_id):
                        self.open_panel(button_id, modal_id)
                        metrics = self.page.locator(f"#{modal_id} .panel-shell").evaluate(
                            """panel => {
                              const pr = panel.getBoundingClientRect();
                              const body = panel.querySelector('.modal-body');
                              const br = body.getBoundingClientRect();
                              const title = panel.querySelector('.modal-title').getBoundingClientRect();
                              const close = panel.querySelector('.panel-close').getBoundingClientRect();
                              const empty = panel.querySelector('.bag-grid > .cmd-empty')?.getBoundingClientRect();
                              const grid = panel.querySelector('.bag-grid')?.getBoundingClientRect();
                              return {
                                height: pr.height, viewportHeight: innerHeight,
                                bodyClient: body.clientHeight, bodyScroll: body.scrollHeight,
                                titleTop: title.top, closeTop: close.top,
                                closeRight: close.right, panelRight: pr.right,
                                bodyBottom: br.bottom, panelBottom: pr.bottom,
                                emptyWidth: empty?.width ?? null, gridWidth: grid?.width ?? null,
                              };
                            }"""
                        )
                        if modal_id == "modal-bag":
                            self.assertLess(metrics["height"], metrics["viewportHeight"] - 24)
                            self.assertGreaterEqual(
                                metrics["emptyWidth"], metrics["gridWidth"] * 0.8
                            )
                        if metrics["bodyScroll"] > metrics["bodyClient"] + 1:
                            self.assertLess(metrics["bodyClient"], metrics["bodyScroll"])
                        self.assertGreaterEqual(metrics["titleTop"], 0)
                        self.assertGreaterEqual(metrics["closeTop"], 0)
                        self.assertLessEqual(metrics["closeRight"], metrics["panelRight"] + 0.5)
                        self.assertLessEqual(metrics["bodyBottom"], metrics["panelBottom"] + 0.5)
                        if width == 390 and modal_id == "modal-bag":
                            self.page.screenshot(
                                path=SHOTS / "09_mobile_short_bag.jpg",
                                type="jpeg",
                                quality=82,
                            )
                        self.page.locator(f"#{modal_id} .panel-close").click()

    def test_formation_selection_updates_current_choice(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-formation", "modal-formation")
        self.page.locator('[data-formation="liuding"]').click()
        self.page.wait_for_selector("#modal-formation", state="detached")
        self.open_panel("btn-formation", "modal-formation")
        current = self.page.locator('[data-formation="liuding"]')
        self.assertTrue(current.is_disabled())
        self.assertEqual(current.get_attribute("aria-pressed"), "true")
        self.assertFalse(self.page.locator('[data-formation="tiangang"]').is_disabled())

    def test_settings_controls_persist_and_load_restores_saved_campaign(self) -> None:
        self.install_rich_campaign()
        self.open_panel("btn-system", "modal-system")

        speed = self.page.locator("#btn-speed")
        speed.click()
        self.assertEqual(speed.get_attribute("aria-pressed"), "true")
        self.assertEqual(self.page.evaluate("localStorage.getItem('xiyou_speed')"), "2")

        mute = self.page.locator("#btn-mute")
        mute.click()
        self.assertEqual(mute.get_attribute("aria-pressed"), "true")
        self.assertEqual(self.page.evaluate("localStorage.getItem('xiyou_mute')"), "1")

        down = self.page.locator("#btn-vol-bgm-down")
        for _ in range(4):
            if down.is_enabled():
                down.click()
        self.assertTrue(down.is_disabled())
        self.assertEqual(self.page.evaluate("localStorage.getItem('xiyou_vol_bgm')"), "0")
        up = self.page.locator("#btn-vol-bgm-up")
        for _ in range(4):
            if up.is_enabled():
                up.click()
        self.assertTrue(up.is_disabled())
        self.assertEqual(self.page.evaluate("localStorage.getItem('xiyou_vol_bgm')"), "1")

        self.page.click("#btn-save")
        self.page.wait_for_selector("#modal-system", state="detached")
        self.assertEqual(self.stored_campaign()["formation"], "tiangang")
        self.open_panel("btn-formation", "modal-formation")
        self.page.locator('[data-formation="liuding"]').click()
        self.open_panel("btn-system", "modal-system")
        self.page.click("#btn-load")
        self.page.wait_for_selector("#overworld-canvas")
        self.open_panel("btn-formation", "modal-formation")
        self.assertTrue(self.page.locator('[data-formation="tiangang"]').is_disabled())

    def test_mobile_minimap_has_real_pixels_does_not_overlap_and_moves_party(self) -> None:
        for width, height in [(390, 844), (320, 700)]:
            with self.subTest(viewport=f"{width}x{height}"):
                self.reset_context(width, height)
                self.install_rich_campaign()
                minimap = self.page.locator(".hud-minimap")
                self.assertTrue(minimap.is_visible())
                pixels = minimap.evaluate(
                    """canvas => {
                      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                      let visible = 0, varied = 0;
                      const first = [data[0], data[1], data[2], data[3]];
                      for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] > 0) visible++;
                        if (data[i] !== first[0] || data[i + 1] !== first[1] || data[i + 2] !== first[2]) varied++;
                      }
                      return { visible, varied, total: data.length / 4 };
                    }"""
                )
                self.assertGreater(pixels["visible"], pixels["total"] * 0.5)
                self.assertGreater(pixels["varied"], pixels["total"] * 0.02)
                overlap = self.page.evaluate(
                    """() => {
                      const a = document.querySelector('.hud-map').getBoundingClientRect();
                      const b = document.querySelector('.hud-cards').getBoundingClientRect();
                      return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
                        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                    }"""
                )
                self.assertEqual(overlap, 0)

                before = self.page.locator(".hud-coords").inner_text()
                box = minimap.bounding_box()
                self.assertIsNotNone(box)
                minimap.click(position={"x": box["width"] * 0.62, "y": box["height"] * 0.72})
                self.page.wait_for_function(
                    "before => document.querySelector('.hud-coords')?.textContent !== before",
                    arg=before,
                    timeout=5000,
                )
                after = self.page.locator(".hud-coords").inner_text()
                self.assertNotEqual(after, before)
                if width == 390:
                    self.page.screenshot(
                        path=SHOTS / "08_mobile_minimap.jpg", type="jpeg", quality=82
                    )


if __name__ == "__main__":
    unittest.main(verbosity=2)
