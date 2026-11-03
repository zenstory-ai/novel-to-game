#!/usr/bin/env python3
"""战斗与剧情对白呈现回归。

这里验证玩家可观察到的语义契约；动画时长、颜色和像素值不属于契约。
真实首战用普通速度和真实 DOM 输入，短暂演出由 MutationObserver 留存事件证据。
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import time
import unittest

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from qa_browser import PROJECT, BrowserPath, ensure_server


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
SAVE_KEY = "xiyou_save_v1"
EVIDENCE = Path(
    os.environ.get("PRESENTATION_SHOTS", PROJECT / "qa/evidence/presentation")
)


def story_url(*, fast: bool = True) -> str:
    return f"{BASE_URL}/?seed=42" + ("&fast=1" if fast else "")


class PresentationBrowserTests(unittest.TestCase):
    browser: Browser

    @classmethod
    def setUpClass(cls) -> None:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
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
        self.page = self.context.new_page()

    def tearDown(self) -> None:
        self.context.close()

    def show_dialog(self, lines: list[dict[str, str | None]]) -> None:
        self.page.goto(story_url())
        self.page.wait_for_selector("#btn-start")
        self.page.evaluate(
            """async (lines) => {
              const { showDialog } = await import('./js/ui.js');
              const root = document.querySelector('#app');
              root.replaceChildren();
              window.__presentationDialog = showDialog(root, lines);
            }""",
            lines,
        )
        self.page.wait_for_selector("#dialog")
        self.page.wait_for_timeout(220)

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

    def enter_first_battle(self, *, capture_story_dialogue: bool = False) -> BrowserPath:
        campaign = copy.deepcopy(self.fresh_campaign(fast=False))
        campaign["stage"] = "prologue"
        campaign["flags"] = {"tudi": True}
        campaign["world"] = {"scene": "cuiyun"}
        campaign["luosha1Done"] = False
        campaign["chaptersSeen"] = {"c1": True}
        self.page.evaluate(
            "([key, value]) => localStorage.setItem(key, JSON.stringify(value))",
            [SAVE_KEY, campaign],
        )
        self.page.evaluate(
            """() => {
              localStorage.setItem('xiyou_speed', '1');
              localStorage.setItem('xiyou_skipfx', '1');
              localStorage.setItem('xiyou_shake', '0');
              localStorage.setItem('xiyou_mute', '1');
            }"""
        )
        self.page.goto(story_url(fast=False))
        self.page.click("#btn-continue")
        self.page.wait_for_selector("#overworld-canvas")
        path = BrowserPath(self.page)
        path.track("main")
        if capture_story_dialogue:
            self.page.wait_for_selector("#dialog", timeout=35000)
            self.page.screenshot(
                path=EVIDENCE / "07_story-dialogue-real.jpg", type="jpeg", quality=82
            )
        path.advance_until("#modal-borrowing-approach")
        self.page.click("#btn-approach-calm")
        self.page.wait_for_selector("#modal-borrowing-approach", state="detached")
        path.advance_until("#battle-tutorial[data-step]")
        self.page.wait_for_selector('.cmd-btn[data-cmd="attack"]')
        return path

    def center(self, selector: str) -> tuple[float, float]:
        box = self.page.locator(selector).bounding_box()
        self.assertIsNotNone(box, f"控件不可见: {selector}")
        return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

    @staticmethod
    def boxes_overlap(a: dict[str, float], b: dict[str, float]) -> bool:
        return not (
            a["x"] + a["width"] <= b["x"]
            or b["x"] + b["width"] <= a["x"]
            or a["y"] + a["height"] <= b["y"]
            or b["y"] + b["height"] <= a["y"]
        )

    def defend_remaining_party(self) -> None:
        for _ in range(2):
            self.page.wait_for_selector('.cmd-btn[data-cmd="defend"]')
            self.page.keyboard.press("3")

    def test_dialog_separates_copy_progress_and_explicit_continue_action(self) -> None:
        self.show_dialog([{"who": "wukong", "text": "先看清来路，再挥棒破阵。"}])
        dialog = self.page.locator("#dialog")
        self.assertEqual(dialog.get_attribute("role"), "dialog")
        self.assertEqual(dialog.locator(".dlg-text").inner_text(), "先看清来路，再挥棒破阵。")
        self.assertEqual(dialog.locator(".dlg-progress").inner_text(), "1 / 1")
        button = dialog.locator("button.dlg-next")
        self.assertEqual(button.count(), 1)
        box = button.bounding_box()
        self.assertIsNotNone(box)
        self.assertGreaterEqual(box["height"], 44)
        self.page.screenshot(path=EVIDENCE / "01_dialog-desktop.jpg", type="jpeg", quality=82)

    def test_selecting_dialog_copy_does_not_advance(self) -> None:
        self.show_dialog(
            [
                {"who": "wukong", "text": "这一句允许玩家选中查阅。"},
                {"who": "bajie", "text": "这一句不应被误跳过。"},
            ]
        )
        self.page.evaluate(
            """() => {
              const body = document.querySelector('#dialog-body');
              const selection = window.getSelection();
              selection.removeAllRanges();
              const range = document.createRange();
              range.selectNodeContents(body);
              selection.addRange(range);
              body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }"""
        )
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-idx"), "0")

    def test_scrolling_dialog_copy_does_not_advance(self) -> None:
        long_copy = "山路回旋，火云压城；先读完这一段再继续。" * 18
        self.page.set_viewport_size({"width": 320, "height": 568})
        self.show_dialog(
            [
                {"who": "wukong", "text": long_copy},
                {"who": "bajie", "text": "滚动不能误跳到这里。"},
            ]
        )
        self.page.locator("#dialog-body").evaluate(
            """body => {
              body.scrollTop = Math.min(80, body.scrollHeight - body.clientHeight);
              body.dispatchEvent(new Event('scroll', { bubbles: true }));
              body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }"""
        )
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-idx"), "0")

    def test_dialog_pointer_keyboard_and_modal_rules_are_consistent(self) -> None:
        self.show_dialog(
            [
                {"who": "wukong", "text": "鼠标推进。"},
                {"who": "bajie", "text": "模态出现时停住。"},
                {"who": "sha", "text": "键盘推进。"},
            ]
        )
        self.page.click("#dialog")
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-idx"), "1")
        self.page.evaluate(
            """() => {
              const modal = document.createElement('div');
              modal.className = 'modal-mask';
              document.querySelector('#app').append(modal);
            }"""
        )
        self.page.wait_for_timeout(220)
        self.page.keyboard.press("Enter")
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-idx"), "1")
        self.page.locator(".modal-mask").evaluate("node => node.remove()")
        self.page.keyboard.press("Enter")
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-idx"), "2")

    def test_narrator_hides_portrait_and_does_not_leak_speaker_identity(self) -> None:
        self.show_dialog(
            [
                {"who": "fakeBajie", "text": "先借八戒面貌出场。"},
                {"who": None, "text": "风声掠过山口。"},
            ]
        )
        stage = self.page.locator(".dlg-stage")
        self.assertEqual(stage.get_attribute("data-portrait"), "bajie")
        self.page.click("#dialog-continue")
        self.assertEqual(self.page.locator("#dialog").get_attribute("data-mode"), "narrator")
        self.assertTrue(stage.is_hidden())
        self.assertTrue(self.page.locator("#dialog-speaker").is_hidden())
        self.assertEqual(self.page.locator("#dialog-speaker").inner_text(), "")

    def test_long_dialog_copy_scrolls_without_hiding_footer_on_mobile(self) -> None:
        long_copy = "山路回旋，火云压城；悟空辨风、八戒守阵、悟净护住退路。" * 16
        for width, height, filename in (
            (390, 844, "02_dialog-mobile-390.jpg"),
            (320, 568, "03_dialog-mobile-320.jpg"),
        ):
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": height})
                self.show_dialog([{"who": "wukong", "text": long_copy}])
                body = self.page.locator("#dialog-body")
                metrics = body.evaluate(
                    "el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight })"
                )
                self.assertGreater(metrics["scrollHeight"], metrics["clientHeight"])
                footer = self.page.locator(".dlg-footer")
                footer_box = footer.bounding_box()
                self.assertIsNotNone(footer_box)
                self.assertLessEqual(footer_box["y"] + footer_box["height"], height)
                self.assertTrue(self.page.locator("#dialog-continue").is_visible())
                self.assertLessEqual(
                    self.page.evaluate("document.documentElement.scrollWidth"), width
                )
                self.page.screenshot(path=EVIDENCE / filename, type="jpeg", quality=82)

    def test_mobile_battle_guidance_preview_and_controls_do_not_overlap(self) -> None:
        self.page.set_viewport_size({"width": 320, "height": 568})
        self.enter_first_battle()
        self.page.wait_for_selector(".ink-swirl", state="detached", timeout=3000)
        self.page.mouse.move(1, 1)
        self.page.wait_for_selector("#cmd-preview", state="hidden")
        self.assertTrue(self.page.locator("#battle-tutorial").is_visible())
        self.page.locator('.cmd-btn[data-cmd="attack"]').hover()
        self.page.wait_for_selector("#cmd-preview", state="visible")
        boxes = {
            name: self.page.locator(selector).bounding_box()
            for name, selector in {
                "preview": "#cmd-preview",
                "controls": "#cmd-menu",
            }.items()
        }
        self.assertTrue(all(boxes.values()))
        self.assertTrue(self.page.locator("#battle-tutorial").is_hidden())
        self.page.screenshot(path=EVIDENCE / "06_battle-mobile-320.jpg", type="jpeg", quality=82)
        self.assertFalse(
            self.boxes_overlap(boxes["preview"], boxes["controls"]), boxes
        )
        target_centers = self.page.evaluate(
            """() => {
              const preview = document.querySelector('#cmd-preview').getBoundingClientRect();
              return [...document.querySelectorAll('.unit-card')]
                .filter(card => card.getClientRects().length)
                .map(card => {
                  const rect = card.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  const samples = [.12, .3, .5, .7, .88];
                  const clickable = samples.some(px => samples.some(py => {
                    const sx = rect.left + rect.width * px;
                    const sy = rect.top + rect.height * py;
                    return document.elementFromPoint(sx, sy)?.closest('.unit-card') === card;
                  }));
                  return {
                    id: card.dataset.unitId,
                    covered: x >= preview.left && x <= preview.right && y >= preview.top && y <= preview.bottom,
                    clickable,
                  };
                });
            }"""
        )
        self.assertTrue(all(not item["covered"] for item in target_centers), target_centers)
        self.assertTrue(all(item["clickable"] for item in target_centers), target_centers)
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 320)
        for button in self.page.locator(".cmd-btn:visible").all():
            self.assertGreaterEqual(button.bounding_box()["height"], 44)
        self.page.mouse.move(1, 1)
        self.page.wait_for_selector("#cmd-preview", state="hidden")
        self.assertTrue(self.page.locator("#battle-tutorial").is_visible())

    def test_component_damage_feedback_preserves_all_three_event_relations(self) -> None:
        self.page.goto(story_url())
        results = self.page.evaluate(
            """async () => {
              const { createBattleAnimator } = await import('./js/battle_animator.js');
              const root = document.querySelector('#app');
              root.replaceChildren();
              const field = document.createElement('div');
              const banner = document.createElement('div');
              const card = document.createElement('div');
              card.className = 'unit-card enemy';
              card.dataset.unitId = 't';
              const anchor = document.createElement('div');
              anchor.className = 'float-anchor';
              const img = document.createElement('img');
              img.className = 'unit-portrait';
              card.append(img, anchor);
              field.append(card, banner);
              root.append(field);
              const state = {
                def: { id: 'synthetic-contract' },
                units: [
                  { id: 'a', name: '出手者', side: 'party', portrait: 'wukong' },
                  { id: 't', name: '受击者', side: 'enemy', portrait: 'luosha' },
                ],
              };
              const animator = createBattleAnimator({
                root, state, field, banner,
                fx: { play: async () => {}, emit: () => {}, ring: () => {} },
                cardByUnit: new Map([['t', { card, anchor, img }]]),
                duration: () => 0,
                skipEffects: () => true,
                shakeEnabled: () => false,
                renderOrderBar: () => {},
                renderUnits: () => {},
                pushLog: () => {},
                setJumpedIds: () => {},
                sync: () => {},
                showActing: () => {},
              });
              const cases = [
                ['normal', null, 81, '水', '金'],
                ['ke', 'ke', 123, '金', '木'],
                ['beike', 'beike', 47, '木', '金'],
              ];
              const evidence = [];
              for (const [expected, rel, amount, attackElement, targetElement] of cases) {
                await animator.playEvents([{
                  t: 'damage', actor: 'a', target: 't', amount, rel,
                  attackElement, targetElement, kind: 'magic',
                }]);
                const impact = card.querySelector('.element-impact');
                evidence.push({
                  expected,
                  eventAmount: amount,
                  relation: impact?.dataset.relation,
                  amount: impact?.dataset.amount,
                  attackElement: impact?.dataset.attackElement,
                  targetElement: impact?.dataset.targetElement,
                  icons: impact?.querySelectorAll('img.element-impact-icon').length,
                  float: anchor.querySelector('.float-text')?.textContent?.trim(),
                });
                animator.clearFloats();
              }
              return evidence;
            }"""
        )
        for item in results:
            with self.subTest(relation=item["expected"]):
                self.assertEqual(item["relation"], item["expected"])
                self.assertEqual(item["amount"], str(item["eventAmount"]))
                self.assertEqual(item["float"], str(item["eventAmount"]))
                self.assertEqual(item["icons"], 2)
                self.assertTrue(item["attackElement"])
                self.assertTrue(item["targetElement"])

    def test_battle_presentation_clears_stale_overlays_at_lifecycle_boundaries(self) -> None:
        self.page.goto(story_url())
        evidence = self.page.evaluate(
            """async () => {
              const { createBattleAnimator } = await import('./js/battle_animator.js');
              const root = document.querySelector('#app');
              root.replaceChildren();
              const field = document.createElement('div');
              const banner = document.createElement('div');
              const cards = new Map();
              for (const id of ['a', 'b', 't']) {
                const card = document.createElement('div');
                card.className = 'unit-card party';
                card.dataset.unitId = id;
                const anchor = document.createElement('div');
                anchor.className = 'float-anchor';
                const img = document.createElement('img');
                card.append(img, anchor);
                field.append(card);
                cards.set(id, { card, anchor, img });
              }
              field.append(banner);
              root.append(field);
              const state = {
                def: { id: 'luosha1' },
                units: [
                  { id: 'a', name: '甲', side: 'party', portrait: 'wukong' },
                  { id: 'b', name: '乙', side: 'party', portrait: 'bajie' },
                  { id: 't', name: '目标', side: 'enemy', portrait: 'luosha' },
                ],
              };
              const animator = createBattleAnimator({
                root, state, field, banner,
                fx: { play: async () => {}, emit: () => {}, ring: () => {} },
                cardByUnit: cards,
                duration: () => 0,
                skipEffects: () => true,
                shakeEnabled: () => false,
                renderOrderBar: () => {},
                renderUnits: () => {},
                pushLog: () => {},
                setJumpedIds: () => {},
                sync: () => {},
                showActing: () => {},
              });
              const cue = () => {
                const node = document.querySelector('#battle-action-cue');
                return {
                  hidden: node.hidden,
                  actor: node.querySelector('.action-cue-actor')?.textContent ?? '',
                };
              };
              const results = [];
              for (const noActionEvent of [
                { t: 'defend', unit: 'b' },
                { t: 'item', actor: 'b', item: 'jinchuang' },
              ]) {
                await animator.playEvents([{ t: 'action', actor: 'a', name: '甲的攻击', skill: false }]);
                const afterA = cue();
                await animator.playEvents([{ t: 'turn', unit: 'b' }, noActionEvent]);
                const afterNoAction = cue();
                await animator.playEvents([{ t: 'action', actor: 'b', name: '乙的攻击', skill: false }]);
                const afterB = cue();
                results.push({ kind: noActionEvent.t, afterA, afterNoAction, afterB });
              }
              await animator.playEvents([{
                t: 'damage', actor: 'a', target: 't', amount: 123, rel: 'ke',
                attackElement: '金', targetElement: '木', kind: 'magic',
              }]);
              const firstHitBeforeEnd = Boolean(field.querySelector('#first-element-hit'));
              await animator.playEvents([{ t: 'battle_end' }]);
              return {
                cueResults: results,
                firstHitBeforeEnd,
                firstHitAfterEnd: Boolean(field.querySelector('#first-element-hit')),
                cueHiddenAfterEnd: document.querySelector('#battle-action-cue').hidden,
              };
            }"""
        )
        for item in evidence["cueResults"]:
            with self.subTest(next_event=item["kind"]):
                self.assertFalse(item["afterA"]["hidden"])
                self.assertEqual(item["afterA"]["actor"], "甲")
                self.assertTrue(item["afterNoAction"]["hidden"])
                self.assertFalse(item["afterB"]["hidden"])
                self.assertEqual(item["afterB"]["actor"], "乙")
        self.assertTrue(evidence["firstHitBeforeEnd"])
        self.assertFalse(evidence["firstHitAfterEnd"])
        self.assertTrue(evidence["cueHiddenAfterEnd"])

    def test_real_first_hit_keeps_event_truth_when_effects_are_disabled(self) -> None:
        self.enter_first_battle(capture_story_dialogue=True)
        page = self.page
        page.wait_for_selector(".ink-swirl", state="detached", timeout=3000)
        page.screenshot(path=EVIDENCE / "05_battle-command.jpg", type="jpeg", quality=82)
        page.evaluate(
            """() => {
              window.__presentationEvents = { cues: [], impacts: [], floats: [] };
              const read = () => {
                const cue = document.querySelector('#battle-action-cue:not([hidden])');
                if (cue) window.__presentationEvents.cues.push({
                  actor: cue.querySelector('.action-cue-actor')?.textContent?.trim(),
                  skill: cue.querySelector('.action-cue-skill')?.textContent?.trim(),
                  portraits: cue.querySelectorAll('img.action-cue-portrait[alt]').length,
                  icons: cue.querySelectorAll('img.action-cue-skill-icon').length,
                });
                document.querySelectorAll('.element-impact').forEach(node => {
                  if (node.dataset.qaCaptured) return;
                  node.dataset.qaCaptured = '1';
                  window.__presentationEvents.impacts.push({
                    relation: node.dataset.relation,
                    amount: node.dataset.amount,
                    attackElement: node.dataset.attackElement,
                    targetElement: node.dataset.targetElement,
                    icons: node.querySelectorAll('img.element-impact-icon').length,
                    target: node.closest('.unit-card')?.dataset.unitId,
                  });
                });
                document.querySelectorAll('.unit-card .float-text').forEach(node => {
                  if (node.dataset.qaCaptured) return;
                  node.dataset.qaCaptured = '1';
                  window.__presentationEvents.floats.push({
                    text: node.textContent?.trim(),
                    target: node.closest('.unit-card')?.dataset.unitId,
                  });
                });
              };
              window.__presentationObserver = new MutationObserver(read);
              window.__presentationObserver.observe(document.querySelector('#app'), {
                subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']
              });
              read();
            }"""
        )
        target_id = page.evaluate("__game.battle.units.find(u => u.defKey === 'luosha').id")
        hp_before = page.evaluate(
            "id => __game.battle.units.find(u => u.id === id).hp", target_id
        )
        page.mouse.click(*self.center('.cmd-btn[data-cmd="attack"]'))
        page.mouse.click(*self.center(f'.unit-card[data-unit-id="{target_id}"]'))
        self.defend_remaining_party()
        page.wait_for_selector("#battle-action-cue:not([hidden])", timeout=5000)
        page.screenshot(path=EVIDENCE / "08_battle-action-cue.jpg", type="jpeg", quality=82)
        page.wait_for_selector("#first-element-hit", timeout=20000)
        hit = page.locator("#first-element-hit")
        amount = int(hit.get_attribute("data-amount"))
        hp_after = page.evaluate(
            "id => __game.battle.units.find(u => u.id === id).hp", target_id
        )
        events = page.evaluate("window.__presentationEvents")
        cues = [cue for cue in events["cues"] if cue["actor"] == "孙悟空"]
        impacts = [impact for impact in events["impacts"] if impact["target"] == target_id]
        self.assertTrue(cues, "真实行动没有留下行动提示证据")
        self.assertTrue(cues[0]["skill"])
        self.assertEqual(cues[0]["portraits"], 1)
        self.assertEqual(cues[0]["icons"], 1)
        self.assertTrue(impacts, "真实伤害没有在受击单位处留下反馈证据")
        impact = impacts[0]
        self.assertEqual(impact["relation"], "ke")
        self.assertEqual(impact["attackElement"], "金")
        self.assertEqual(impact["targetElement"], "木")
        self.assertEqual(int(impact["amount"]), amount)
        self.assertEqual(impact["icons"], 2)
        self.assertTrue(
            any(item["target"] == target_id and item["text"] == str(amount) for item in events["floats"]),
            "真实伤害数值没有显示在受击目标处",
        )
        self.assertEqual(hp_before - hp_after, amount)
        self.assertEqual(hit.locator("img.element-feedback-icon").count(), 2)
        self.assertEqual(page.locator(".float-text.info").filter(has_text=cues[0]["skill"]).count(), 0)
        page.screenshot(path=EVIDENCE / "04_battle-first-ke.jpg", type="jpeg", quality=82)

        log = page.locator(".battle-report-lines .battle-report-line")
        self.assertEqual(log.count(), 1)
        toggle = page.locator("#battle-report-toggle")
        self.assertEqual(toggle.get_attribute("aria-expanded"), "false")
        toggle.click()
        self.assertEqual(toggle.get_attribute("aria-expanded"), "true")
        page.wait_for_function(
            "() => document.querySelectorAll('.battle-report-lines .battle-report-line').length > 1",
            timeout=12000,
        )
        self.assertGreater(log.count(), 1)
        self.assertLessEqual(log.count(), 12)

        tutorial_box = page.locator("#battle-tutorial").bounding_box()
        menu_box = page.locator("#cmd-menu").bounding_box()
        self.assertIsNotNone(tutorial_box)
        self.assertIsNotNone(menu_box)
        self.assertFalse(self.boxes_overlap(tutorial_box, menu_box), "教学卡遮住了指令台")


if __name__ == "__main__":
    unittest.main(verbosity=2)
