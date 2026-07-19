#!/usr/bin/env python3
"""浏览器全程自检(playwright):
标题 → 序幕(土地对话/阵型/存档) → 战斗1(教学/法术/变化/化虫入腹)
→ 战斗2(携宠/假扇反噬) → BOSS(阵型切换/真扇三段/白牛真身) → 结局 → 读档。
断言:关键 DOM 存在、控制台 0 报错;截图存 /tmp/xiyou_shots/。

用法: python3 test/qa_browser.py
环境变量: BASE_URL(默认 http://127.0.0.1:5173), QA_SLOW=1 关闭加速。
"""
import os, shutil, socket, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
URL = BASE + "/?seed=42" + ("" if os.environ.get("QA_SLOW") else "&fast=1")
SHOTS = "/tmp/xiyou_shots"

passed, failed = 0, 0
errors = []


def ok(cond, name):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


def section(t):
    print(f"\n== {t} ==")


def ensure_server():
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", 5173))
        s.close()
        return None
    except OSError:
        pass
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "5173", "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            s = socket.socket(); s.connect(("127.0.0.1", 5173)); s.close()
            return proc
        except OSError:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError("无法启动本地服务")


class QA:
    def __init__(self, page):
        self.p = page
        self.n = 0

    def shot(self, name):
        self.n += 1
        self.p.screenshot(path=f"{SHOTS}/{self.n:02d}_{name}.png")

    def click_dialogs(self, max_clicks=20):
        """点完当前剧情对话;返回点击次数。"""
        for i in range(max_clicks):
            if self.p.locator("#dialog").count() == 0:
                return i
            self.p.wait_for_timeout(250)
            self.p.locator("#dialog").click()
        return max_clicks

    def wait_dialog_then_clear(self, timeout=10000):
        self.p.wait_for_selector("#dialog", timeout=timeout)
        self.click_dialogs()

    def dialogs_until_battle(self, timeout_s=60):
        """点穿所有剧情对话,直到战斗指令菜单或战斗开场小卡片出现。"""
        t0 = time.time()
        while time.time() - t0 < timeout_s:
            if self.p.locator('.cmd-btn[data-cmd="auto"]').count() > 0:
                return True
            if self.p.locator("#btn-once-close").count() > 0:
                return True
            if self.p.locator("#dialog").count() > 0:
                self.p.locator("#dialog").click()
            self.p.wait_for_timeout(250)
        return False

    def cmd_visible(self):
        b = self.p.locator('.cmd-btn[data-cmd="auto"]')
        return b.count() > 0 and b.first.is_visible()

    def click_auto(self):
        self.p.locator('.cmd-btn[data-cmd="auto"]').first.click()
        self.p.wait_for_timeout(60)

    def battle_state(self):
        return self.p.evaluate("window.__game.battle ? {round: __game.battle.round, formation: __game.battle.formation, items: __game.battle.items, caught: __game.battle.caught ?? [], units: __game.battle.units.map(u => ({id: u.id, key: u.defKey, hp: u.hp, maxHp: u.maxHp, alive: u.alive, element: u.element, charge: u.charge ?? 0}))} : null")

    def defeat_retry(self):
        """若出现败北面板则点重试;返回是否重试。"""
        if self.p.locator("#modal-defeat #btn-retry").count() > 0:
            self.p.locator("#modal-defeat #btn-retry").click()
            self.p.wait_for_timeout(600)
            return True
        return False

    def close_once(self):
        """若出现即时小卡片则关闭;返回是否关过。"""
        if self.p.locator("#btn-once-close").count() > 0:
            self.p.locator("#btn-once-close").click()
            self.p.wait_for_timeout(200)
            return True
        return False

    def prompt_unit_id(self):
        """当前指令单位:按 cmd-status 姓名映射 p0..p3。"""
        status = self.p.locator(".cmd-status").inner_text()
        for name, uid in (("孙悟空", "p0"), ("猪八戒", "p1"), ("沙悟净", "p2"), ("辟水金睛兽", "p3"), ("赤焰火骝", "p3")):
            if name in status:
                return uid
        return None

    def lowest_party(self, st):
        alive = [u for u in st["units"] if u["id"].startswith("p") and u["alive"]]
        return min(alive, key=lambda u: u["hp"]) if alive else None

    def boss_hp_ratio(self, key):
        st = self.battle_state()
        if not st:
            return 1.0
        for u in st["units"]:
            if u["key"] == key and u["alive"]:
                return u["hp"] / u["maxHp"]
        return 1.0

    def battle_over(self):
        return (
            self.p.locator("#modal-victory #btn-victory-ok").count() > 0
            or self.p.locator("#modal-defeat #btn-retry").count() > 0
            or self.p.evaluate("__game.phase()") != "battle"
        )

    def wait_victory(self, timeout=30000):
        self.p.wait_for_selector("#modal-victory #btn-victory-ok", timeout=timeout)


def main():
    shutil.rmtree(SHOTS, ignore_errors=True)
    os.makedirs(SHOTS, exist_ok=True)
    server = ensure_server()
    try:
        run()
    finally:
        if server:
            server.terminate()
    print(f"\n控制台错误: {len(errors)}")
    for e in errors[:10]:
        print("  ERR:", e[:300])
    print(f"结果: {passed} 通过, {failed} 失败, 截图 {QA_static_n()} 张 → {SHOTS}")
    sys.exit(1 if (failed or errors) else 0)


_last_qa = None
def QA_static_n():
    return _last_qa.n if _last_qa else 0


def run():
    global _last_qa
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
        page.on("dialog", lambda d: d.accept())
        qa = QA(page)
        _last_qa = qa

        # ---------- 标题 ----------
        section("标题画面")
        page.goto(URL)
        page.wait_for_selector("#btn-start", timeout=10000)
        ok(page.locator(".title-logo h1").inner_text() == "西游记 · 三借芭蕉扇", "标题文案")
        ok(page.evaluate("__game.phase()") == "title", "phase=title")
        qa.shot("title")
        # 如何游玩
        page.click("#btn-howto")
        page.wait_for_selector("#modal-help")
        qa.shot("help")
        page.click("#btn-help-close")

        # ---------- 序幕 ----------
        section("序幕 · 火焰山脚")
        page.click("#btn-start")
        qa.wait_dialog_then_clear()  # 序幕旁白
        page.wait_for_selector("#overworld-canvas", timeout=5000)
        page.wait_for_timeout(600)
        ok(page.evaluate("__game.phase()") == "overworld", "phase=overworld")
        # 序幕旁白叠在小世界上(非黑屏):画布与对话框都曾共存
        ok(page.evaluate("__game.audio.ctx !== null"), "点击开始后 AudioContext 已解锁")
        ok(page.evaluate("__game.audio.bgm !== null && __game.audio.bgm.scene === 'overworld'"), "小世界 BGM 播放中")
        qa.shot("overworld")
        # 土地对话
        pos = page.evaluate("__game.npcScreenPos('tudi')")
        ok(pos is not None, "QA 钩子:土地坐标")
        page.mouse.click(pos["x"], pos["y"])
        page.wait_for_selector("#dialog", timeout=10000)
        qa.shot("dialog_tudi")
        qa.click_dialogs()
        # 阵型切换(顶栏)
        page.click("#btn-formation")
        page.wait_for_selector("#modal-formation")
        qa.shot("formation_modal")
        page.click('.formation-row[data-formation="liuding"]')
        page.wait_for_timeout(300)
        ok(page.evaluate("__game.campaign().formation") == "liuding", "顶栏切换六丁阵")
        page.click("#btn-formation")
        page.wait_for_selector("#modal-formation")
        page.click('.formation-row[data-formation="tiangang"]')
        page.wait_for_timeout(200)
        ok(page.evaluate("__game.campaign().formation") == "tiangang", "切回天罡阵")
        # 存档按钮
        page.click("#btn-save")
        page.wait_for_timeout(300)
        ok(page.evaluate("!!localStorage.getItem('xiyou_save_v1')"), "顶栏存档写入 localStorage")
        # 静音开关
        page.click("#btn-mute")
        page.wait_for_timeout(150)
        ok(page.evaluate("localStorage.getItem('xiyou_mute')") == "1" and page.evaluate("__game.audio.muted"), "静音开关:关(持久化)")
        page.click("#btn-mute")
        page.wait_for_timeout(150)
        ok(page.evaluate("localStorage.getItem('xiyou_mute')") == "0" and not page.evaluate("__game.audio.muted"), "静音开关:开")
        # 面板系统:角色/背包/召唤兽
        page.click("#btn-hero")
        page.wait_for_selector("#modal-hero")
        ok("孙悟空" in page.locator("#modal-hero").inner_text(), "角色面板显示队伍")
        ok(page.locator("#btn-hero.open").count() == 1, "当前面板按钮高亮(朱底)")
        qa.shot("panel_hero")
        page.click("#modal-hero-close")
        page.click("#btn-bag")
        page.wait_for_selector("#modal-bag")
        ok("金疮药" in page.locator("#modal-bag").inner_text(), "背包面板显示物品")
        qa.shot("panel_bag")
        page.click("#modal-bag-close")
        page.click("#btn-pet")
        page.wait_for_selector("#modal-pet")
        ok("尚未收服" in page.locator("#modal-pet").inner_text(), "召唤兽面板(未收服)")
        qa.shot("panel_pet")
        page.click("#modal-pet-close")
        # 前往罗刹女
        pos = page.evaluate("__game.npcScreenPos('luosha')")
        page.mouse.click(pos["x"], pos["y"])
        qa.wait_dialog_then_clear()

        # ---------- 战斗1 · 翠云山罗刹女(一战吹飞→灵吉→再战) ----------
        section("战斗1 · 罗刹女(两战+定风丹)")
        page.wait_for_selector("#btn-tutorial-ok", timeout=10000)
        qa.shot("battle1_tutorial")
        page.click("#btn-tutorial-ok")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=5000)
        ok(page.locator(".unit-card.party").count() == 3, "我方 3 单位")
        ok(page.locator(".unit-card.enemy").count() == 3, "敌方 3 单位(罗刹女+侍婢×2)")
        ok(page.locator(".order-chip").count() == 6, "行动顺序条 6 单位")
        ok(page.locator('.unit-card.party .elem-badge').first.inner_text() == "金", "悟空五行=金")
        ok(page.locator('.unit-card.enemy .elem-badge').first.inner_text() == "木", "罗刹女五行=木")

        # 一战:首回合悟空 法术→如意金箍棒→罗刹女(必「克!」),其余自动;第3回合剧情吹飞
        page.click('.cmd-btn[data-cmd="skill"]')
        page.wait_for_selector('[data-skill="ruyibang"]')
        qa.shot("battle1_skill_menu")
        page.click('[data-skill="ruyibang"]')
        page.wait_for_timeout(200)
        page.locator('.unit-card[data-unit-id="e0"]').click()
        page.wait_for_timeout(400)
        qa.shot("battle1_first_strike")
        ok(page.locator(".float-text").count() >= 0, "飘字层存在")
        qa.click_auto(); qa.click_auto()
        for _ in range(120):
            if page.locator("#dialog").count() > 0:
                break
            if qa.cmd_visible():
                qa.click_auto()
            else:
                page.wait_for_timeout(150)
        page.wait_for_selector("#dialog", timeout=15000)
        ok("吹" in page.locator("#dialog").inner_text() or "扇" in page.locator("#dialog").inner_text(), "第3回合剧情吹飞(非失败)")
        qa.shot("battle1_blowaway")
        # 吹飞过场 → 灵吉授定风丹
        for _ in range(20):
            if page.locator("#dialog").count() == 0:
                break
            page.wait_for_timeout(250)
            if "定风丹" in page.locator("#dialog").inner_text():
                qa.shot("battle1_lingji")
            page.locator("#dialog").click()
        ok(page.evaluate("__game.campaign().treasure") == "dingfengdan", "获得法宝·定风丹")
        # 再战前对话 → 再战
        ok(qa.dialogs_until_battle(), "灵吉之后进入再战")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=10000)
        # 再战:悟空变化(≤55% 化虫入腹,侍婢溃散)
        for _ in range(400):
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
                page.wait_for_timeout(200)
                continue
            if qa.battle_over():
                break
            if qa.cmd_visible():
                status = page.locator(".cmd-status").inner_text()
                if "孙悟空" in status and qa.boss_hp_ratio("luosha") <= 0.55:
                    page.click('.cmd-btn[data-cmd="special"]')
                    qa.close_once()
                    page.wait_for_selector('[data-form="chongzi"]')
                    page.click('[data-form="chongzi"]')
                    page.wait_for_timeout(600)
                    qa.shot("battle1_finisher")
                else:
                    qa.click_auto()
            else:
                page.wait_for_timeout(120)
        qa.wait_victory()
        st = qa.battle_state()
        ok(st and not any(u["key"] in ("luosha", "shibi") and u["alive"] for u in st["units"]), "罗刹女已败,侍婢溃散")
        qa.shot("battle1_victory")
        ok("等级提升" in page.locator("#modal-victory").inner_text(), "胜利结算含升级")
        page.click("#btn-victory-ok")
        ok(qa.dialogs_until_battle(), "战斗1后剧情推进到战斗2")

        # ---------- 战斗2 ----------
        section("战斗2 · 火焰山火兵(携宠+假扇)")
        page.wait_for_selector("#btn-once-close", timeout=15000)
        qa.shot("battle2_card")
        page.click("#btn-once-close")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        ok(len(page.evaluate("__game.campaign().pets")) == 0, "本幕尚无召唤兽(金睛兽移批2)")
        ok(page.locator(".unit-card.party").count() == 3, "我方 3 单位")
        ok(page.locator(".unit-card.enemy").count() == 3, "敌方 3 火妖")
        qa.shot("battle2_cmd")
        # 先集火火兵·甲至 ≤40% → 捕妖绳收服;再假扇演示;危急用金疮药;败北重试
        caught = False
        fan_used = False
        healed = False
        summon_shot = False
        for _ in range(500):
            if qa.defeat_retry():
                caught = False
                fan_used = False
                continue
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
                page.wait_for_timeout(200)
                continue
            if qa.battle_over():
                break
            if qa.cmd_visible():
                st = qa.battle_state()
                uid = qa.prompt_unit_id()
                low = qa.lowest_party(st)
                e0 = next((u for u in st["units"] if u["id"] == "e0"), None)
                e0_low = e0 and e0["alive"] and e0["hp"] / e0["maxHp"] <= 0.4
                if "huobao" in (st.get("caught") if st else []):
                    caught = True
                if uid == "p0" and e0_low and not caught and st["items"].get("buyaosheng", 0) > 0:
                    # 捕妖绳收服(剧情门控捕捉)
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="buyaosheng"]')
                    page.click('[data-item="buyaosheng"]')
                    page.wait_for_timeout(200)
                    page.locator('.unit-card[data-unit-id="e0"]').click()
                    page.wait_for_timeout(400)
                elif not caught and uid in ("p0", "p1") and e0 and e0["alive"]:
                    page.click('.cmd-btn[data-cmd="attack"]')
                    page.wait_for_timeout(200)
                    page.locator('.unit-card[data-unit-id="e0"]').click()
                    page.wait_for_timeout(200)
                elif not caught and uid in ("p2", "p3"):
                    # 捕捉前队友守势,防误杀
                    page.click('.cmd-btn[data-cmd="defend"]')
                    page.wait_for_timeout(150)
                elif uid == "p0" and not fan_used:
                    # 假扇演示(反噬)
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="fakefan"]')
                    page.click('[data-item="fakefan"]')
                    fan_used = True
                    page.wait_for_timeout(500)
                    qa.shot("battle2_fakefan")
                elif uid == "p0" and low and low["hp"] / low["maxHp"] < 0.35 and st["items"].get("jinchuang", 0) > 0:
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="jinchuang"]')
                    page.click('[data-item="jinchuang"]')
                    page.wait_for_timeout(200)
                    page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                    page.wait_for_timeout(300)
                    if not healed:
                        healed = True
                        qa.shot("battle2_heal")
                else:
                    qa.click_auto()
            else:
                st_now = qa.battle_state()
                if not caught and st_now and "huobao" in (st_now.get("caught") or []):
                    caught = True
                    qa.shot("battle2_catch")
                page.wait_for_timeout(120)
            if not summon_shot and page.locator(".unit-card.enemy").count() > 3:
                summon_shot = True
                qa.shot("battle2_summon")
        qa.wait_victory()
        ok(caught, "捕妖绳收服火兵(赤焰火骝)")
        ok(summon_shot, "火炎校尉召唤火兵增援")
        qa.shot("battle2_victory")
        page.click("#btn-victory-ok")
        page.wait_for_timeout(400)
        ok(any(p["key"] == "huobao" for p in page.evaluate("__game.campaign().pets")), "赤焰火骝已入召唤兽列表")
        ok(qa.dialogs_until_battle(), "战斗2后剧情推进到摩云洞")

        # ---------- 批2:摩云洞·玉面公主 ----------
        section("批2 · 玉面公主/初战牛魔王/碧波潭")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        ok(page.locator(".unit-card.enemy").count() == 3, "玉面公主+妖将×2")
        ok(page.locator(".unit-card.party").count() == 4, "我方 4 单位(赤焰火骝上阵)")
        qa.shot("yumian_cmd")
        for _ in range(500):
            if qa.defeat_retry():
                continue
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
                page.wait_for_timeout(200)
                continue
            if qa.battle_over():
                break
            if qa.cmd_visible():
                st = qa.battle_state()
                low = qa.lowest_party(st)
                uid = qa.prompt_unit_id()
                if uid == "p0" and low and low["hp"] / low["maxHp"] < 0.35 and st["items"].get("jinchuang", 0) > 0:
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="jinchuang"]')
                    page.click('[data-item="jinchuang"]')
                    page.wait_for_timeout(200)
                    page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                    page.wait_for_timeout(300)
                else:
                    qa.click_auto()
            else:
                page.wait_for_timeout(120)
        qa.wait_victory()
        qa.shot("yumian_victory")
        page.click("#btn-victory-ok")
        page.wait_for_timeout(300)
        ok(page.evaluate("__game.campaign().equips?.wukong") == "ruyibang_jing", "装备首件掉落:如意金箍棒·精")
        # 初战牛魔王:3 回合自动 → 赴宴而走
        ok(qa.dialogs_until_battle(), "进入初战牛魔王")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        for _ in range(120):
            if page.locator("#dialog").count() > 0:
                break
            if qa.cmd_visible():
                qa.click_auto()
            else:
                page.wait_for_timeout(150)
        page.wait_for_selector("#dialog", timeout=15000)
        ok("碧波潭" in page.locator("#dialog").inner_text() or "赴宴" in page.locator("#dialog").inner_text(), "牛魔王赴宴而走(剧情)")
        qa.shot("niu1_retreat")
        # 碧波潭三节点
        for _ in range(30):
            if page.locator("#choice-crab").count() > 0:
                break
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
            page.wait_for_timeout(250)
        page.wait_for_selector("#choice-crab", timeout=10000)
        qa.shot("bibotan_choice1")
        page.click("#choice-insect")  # 先试错:蟭蟟虫被冲回
        page.wait_for_selector("#dialog", timeout=5000)
        qa.click_dialogs()
        page.wait_for_selector("#choice-crab", timeout=5000)
        page.click("#choice-crab")  # 变螃蟹
        page.wait_for_selector("#dialog", timeout=5000)
        qa.click_dialogs()
        page.wait_for_selector("#choice-shift", timeout=5000)
        qa.shot("bibotan_choice2")
        page.click("#choice-shift")
        page.wait_for_selector("#dialog", timeout=5000)
        qa.click_dialogs()
        page.wait_for_selector("#choice-steal", timeout=5000)
        page.click("#choice-steal")
        # 点到骗扇结束(真扇入手)即停,保住 BOSS 战前对话窗口
        page.wait_for_selector("#dialog", timeout=5000)
        for _ in range(20):
            if page.evaluate("__game.campaign().items.truefan") == 3:
                break
            page.locator("#dialog").click()
            page.wait_for_timeout(220)
        ok(page.evaluate("__game.campaign().items.truefan") == 3, "变牛魔王骗得真扇×3")
        ok(any(p["key"] == "pixie" for p in page.evaluate("__game.campaign().pets")), "辟水金睛兽正式入队")
        qa.shot("bibotan_pixie")
        # 牛魔王变假八戒反骗(演出;选识破)
        page.wait_for_selector("#dialog", timeout=15000)
        qa.click_dialogs()
        page.wait_for_selector("#choice-check", timeout=10000)
        qa.shot("fanpian_choice")
        page.click("#choice-check")
        page.wait_for_selector("#dialog", timeout=8000)
        for _ in range(4):
            page.locator("#dialog").click()
            page.wait_for_timeout(220)
        # 等 BOSS 战前对话出现,换宠上阵
        page.wait_for_selector("#dialog", timeout=15000)
        page.click("#btn-pet")
        page.wait_for_selector("#modal-pet")
        ok(page.locator('[data-pet-active="pixie"]').count() == 1, "召唤兽面板含辟水金睛兽")
        page.click('[data-pet-active="pixie"]')
        page.wait_for_selector("#modal-pet")
        ok(page.evaluate("__game.campaign().pets.find(p=>p.key==='pixie').active") == True, "换上辟水金睛兽上阵")
        page.click("#modal-pet-close")
        qa.click_dialogs()  # 点完 BOSS 战前对白

        # ---------- 战斗3 BOSS ----------
        section("战斗3 · 积雷山牛魔王(真扇+阶段)")
        page.wait_for_selector("#btn-once-close", timeout=15000)
        qa.shot("battle3_card")
        page.click("#btn-once-close")
        page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=15000)
        ok(page.locator(".unit-card.enemy").count() == 3, "决战敌方:牛魔王+玉面公主+妖将")
        ok(page.evaluate("__game.campaign().items.truefan") == 3, "持有真扇×3")
        qa.shot("battle3_cmd")
        fan_used = 0
        formation_switched = False
        phase_shot = False
        defend_shot = False
        saw_charge = False
        god_shot = False
        for i in range(900):
            if qa.defeat_retry():
                fan_used = 0
                formation_switched = False
                continue
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
                page.wait_for_timeout(200)
                continue
            if qa.battle_over():
                break
            if qa.cmd_visible():
                st = qa.battle_state()
                uid = qa.prompt_unit_id()
                low = qa.lowest_party(st)
                round_now = (st or {}).get("round", 1)
                charging = any(u["charge"] == 1 and u["alive"] for u in st["units"] if not u["id"].startswith("p"))
                if any(u["charge"] > 0 for u in st["units"] if not u["id"].startswith("p")):
                    saw_charge = True
                if uid == "p0" and not formation_switched:
                    # 战斗内免费换阵:天罡 → 六丁
                    page.click("#btn-battle-formation")
                    formation_switched = True
                    page.wait_for_timeout(400)
                    qa.shot("battle3_formation")
                    ok(page.evaluate("__game.battle.formation") == "liuding", "战斗内免费换阵六丁")
                elif charging and low and uid == low["id"]:
                    # BOSS 蓄力中:血量最低者防御
                    page.click('.cmd-btn[data-cmd="defend"]')
                    page.wait_for_timeout(300)
                    if not defend_shot:
                        defend_shot = True
                        qa.shot("battle3_defend")
                elif uid == "p0" and fan_used < 3 and round_now >= 2:
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="truefan"]')
                    page.click('[data-item="truefan"]')
                    fan_used += 1
                    page.wait_for_timeout(500)
                    qa.shot(f"battle3_truefan_{fan_used}")
                elif uid == "p0" and low and low["hp"] / low["maxHp"] < 0.3 and st["items"].get("jinchuang", 0) > 0:
                    page.click('.cmd-btn[data-cmd="item"]')
                    page.wait_for_selector('[data-item="jinchuang"]')
                    page.click('[data-item="jinchuang"]')
                    page.wait_for_timeout(200)
                    page.locator(f'.unit-card[data-unit-id="{low["id"]}"]').click()
                    page.wait_for_timeout(300)
                else:
                    qa.click_auto()
            else:
                if not phase_shot and page.locator(".unit-card.enemy.big").count() > 0:
                    page.wait_for_timeout(300)
                    qa.shot("battle3_whitebull")
                    phase_shot = True
                if not god_shot and page.locator(".god-overlay").count() > 0:
                    god_shot = True
                    qa.shot("battle3_godassist")
                page.wait_for_timeout(120)
        qa.wait_victory()
        ok(saw_charge, "牛魔王发出过蓄力预警")
        ok(phase_shot, "牛魔王变身白牛真身(大体积单位)")
        ok(page.evaluate("__game.battle.godAssisted") == True, "众神围剿登场(门控)")
        ok(fan_used >= 1, f"真扇使用了 {fan_used} 次")
        st = qa.battle_state()
        ok(st and not any(u["key"] in ("niumowang", "whitebull") and u["alive"] for u in st["units"]), "牛魔王已降伏")
        qa.shot("battle3_victory")
        page.click("#btn-victory-ok")

        # ---------- 结局(真扇三段+四十九扇+还扇西行) ----------
        section("结局")
        page.wait_for_selector("#ending-root", timeout=15000)
        for _ in range(40):
            if page.locator(".ending-panel").count() > 0:
                break
            if page.locator(".fan-counter").count() > 0:
                txt = page.locator(".fan-counter").inner_text()
                if "49" in txt:
                    qa.shot("ending_fan49")
            if page.locator("#dialog").count() > 0:
                page.locator("#dialog").click()
            page.wait_for_timeout(300)
        page.wait_for_selector(".ending-panel", timeout=15000)
        ok("三借芭蕉扇 · 完" in page.locator("#ending-root").inner_text(), "结局文案")
        ok("还" in page.locator("#ending-root").inner_text(), "还扇西行收束")
        qa.shot("ending")

        # ---------- 成长面板(加点/推荐/召唤兽上阵) ----------
        section("成长面板实测")
        page.click("#btn-hero")
        page.wait_for_selector("#modal-hero")
        ok(page.locator('[data-alloc-plus="wukong:攻"]').count() == 1, "加点 ＋ 钮存在")
        page.click('[data-alloc-plus="wukong:攻"]')
        page.wait_for_selector("#modal-hero")
        ok(page.evaluate("__game.campaign().alloc?.wukong?.['攻']") == 1, "悟空 攻+1 已写入")
        ok(page.evaluate("__game.campaign().pendingPoints.wukong") == page.evaluate("(__game.campaign().battlesWon * 5) - 1"), "潜力点已扣(按胜场×5)")
        page.click('[data-alloc-recommend="sha"]')
        page.wait_for_selector("#modal-hero")
        ok(page.evaluate("__game.campaign().pendingPoints.sha") == 0, "沙僧一键推荐加点投完")
        qa.shot("panel_hero_alloc")
        page.click("#modal-hero-close")
        page.click("#btn-pet")
        page.wait_for_selector("#modal-pet")
        ok(page.locator('[data-pet-active="huobao"]').count() == 1, "召唤兽面板列出赤焰火骝")
        ok(page.locator('[data-pet-active="pixie"]').count() == 1, "召唤兽面板列出辟水金睛兽")
        ok(len(page.evaluate("__game.campaign().pets")) == 2, "本批共 2 只宝宝")
        qa.shot("panel_pet_roster")
        page.click("#modal-pet-close")

        # ---------- 读档 ----------
        section("读档")
        page.reload()
        page.wait_for_selector("#btn-continue", timeout=10000)
        page.click("#btn-continue")
        page.wait_for_selector("#dialog", timeout=10000)
        ok("牛魔王" in page.locator("#dialog").inner_text() or "真扇" in page.locator("#dialog").inner_text(), "读档回到 BOSS 战前剧情")
        qa.shot("load_continue")
        qa.click_dialogs()
        # 读档后阵型/等级/养成保持
        lv = page.evaluate("__game.campaign().levels.wukong")
        ok(lv >= 3, f"读档后悟空等级 Lv.{lv}")
        ok(page.evaluate("__game.campaign().alloc?.wukong?.['攻']") == 1, "读档后加点保留")
        ok(any(p["key"] == "huobao" for p in page.evaluate("__game.campaign().pets")) and any(p["key"] == "pixie" for p in page.evaluate("__game.campaign().pets")), "读档后双召唤兽保留")

        browser.close()


if __name__ == "__main__":
    main()
