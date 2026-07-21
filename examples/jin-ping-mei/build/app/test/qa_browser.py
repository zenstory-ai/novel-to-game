#!/usr/bin/env python3
"""浏览器全程自检(playwright):
标题 → 第一幕(过门/传闻) → 第二幕(谋算/第59/62回选择) → 第79回清零演出
→ 分家 → 结局 → 收束 → 重开。
断言:关键 DOM 与引擎状态、明暗两账不对称、控制台 0 报错;过程截图存 /tmp/jpm_shots/。
音频:静音开关生效且 localStorage 持久化;全程不因音频报错。

用法: python3 test/qa_browser.py
环境变量: BASE_URL(默认 http://127.0.0.1:5173), QA_SLOW=1 关闭加速。
"""
import os, shutil, socket, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5173")
URL = BASE + "/?seed=42" + ("" if os.environ.get("QA_SLOW") else "&fast=1")
SHOTS = "/tmp/jpm_shots"

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

    def ev(self, js):
        return self.p.evaluate(js)

    def festival(self):
        return self.ev("__game.festival()")

    def phase(self):
        return self.ev("__game.phase()")

    def settle(self):
        """关掉节令结算模态(若有)。"""
        if self.p.locator("#modal-settle").count() > 0:
            self.p.locator('#modal-settle .choice-btn').first.click()
            self.p.wait_for_timeout(200)
            return True
        return False

    def handle_visit(self, choice_idx=0):
        """上门事件:有人来时当场表态。返回是否处理过。"""
        if self.p.locator("#modal-visit").count() == 0:
            return False
        ch = self.p.locator("#modal-visit .choice-btn")
        n = ch.count()
        for i in range(n):
            b = ch.nth(min(choice_idx, n - 1))
            if b.is_enabled():
                b.click()
                self.p.wait_for_timeout(250)
                return True
        return False

    def seal(self, name, picks):
        """打开一枚印章子面板,按序点选并确认。印章不可用则直接返回 False。"""
        btn = self.p.locator(f'[data-seal="{name}"]')
        if btn.count() == 0 or not btn.first.is_enabled():
            return False
        btn.first.click()
        self.p.wait_for_selector("#subpanel", timeout=5000)
        for pk in picks:
            b = self.p.locator(f'[data-pick="{pk}"]')
            if b.count() > 0 and b.first.is_enabled():
                b.first.click()
                self.p.wait_for_timeout(60)
        self.p.locator("#btn-sub-confirm").click()
        self.p.wait_for_timeout(120)
        return True

    def actions_phase(self, policy, limit=4):
        """行动阶段按策略消耗行动点;返回实际执行的动作数。"""
        n = 0
        while self.ev("__game.state().ap") > 0 and n < limit:
            self.handle_visit()
            ap0 = self.ev("__game.state().ap")
            policy(n)
            n += 1
            if self.ev("__game.state().ap") == ap0:
                break  # 动作未生效(被拒),避免死循环
        return n

    def submit(self):
        self.handle_visit()  # 上门的人不应对,门闩着,提交点不动
        self.p.locator("#btn-submit").click()
        self.p.wait_for_timeout(1800)
        self.handle_visit()
        self.settle()
        self.p.wait_for_timeout(300)

    def handle_event(self, choice_idx=0):
        """处理当前事件模态;返回是否处理过。"""
        if self.p.locator("#modal-event").count() == 0:
            return False
        ch = self.p.locator("#modal-event .choice-btn")
        ch.nth(min(choice_idx, ch.count() - 1)).click()
        self.p.wait_for_timeout(300)
        self.handle_visit()
        return True

    def wait_special(self, timeout_s=60):
        """等待并处理演出层:清零/结局/收束/事件。返回 'clear'|'ending'|'epilogue'|'event'|None。"""
        t0 = time.time()
        seen_clear = False
        while time.time() - t0 < timeout_s:
            if self.p.locator("#clear-overlay").count() > 0:
                if not seen_clear:
                    seen_clear = True
                    self.shot("f19_clearing")
                self.p.wait_for_timeout(1200)
                continue
            if seen_clear and self.p.locator("#clear-overlay").count() == 0:
                return "clear"
            if self.p.locator("#ending-root").count() > 0:
                return "ending"
            if self.p.locator("#epilogue-root").count() > 0:
                return "epilogue"
            if self.p.locator("#modal-event").count() > 0:
                return "event"
            if self.p.locator("#modal-visit").count() > 0:
                return "visit"
            self.p.wait_for_timeout(300)
        return None


def main():
    shutil.rmtree(SHOTS, ignore_errors=True)
    os.makedirs(SHOTS, exist_ok=True)
    server = ensure_server()
    qa = None
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
            page.on("dialog", lambda d: d.accept())
            qa = QA(page)

            # ---------- 标题 ----------
            section("标题画面")
            page.goto(URL)
            page.wait_for_selector("#btn-start", timeout=10000)
            ok("大宅两本账" in page.locator(".title-logo h1").inner_text(), "标题文案")
            ok("17" in page.locator(".title-rating").inner_text(), "标题含 17+ 内容提示")
            qa.shot("title")
            page.click("#btn-howto")
            page.wait_for_selector("#modal-help")
            ok("藏" in page.locator("#modal-help").inner_text(), "玩法说明含五类行动")
            qa.shot("howto")
            page.click('#modal-help .choice-btn')
            # 静音开关持久化(在局内测)
            page.click("#btn-start")
            page.wait_for_selector("#modal-event", timeout=10000)

            # ---------- 第一幕 ----------
            section("第一幕 · 入门")
            ok("过门" in page.locator("#modal-event").inner_text(), "节令1 过门事件")
            qa.shot("f1_event")
            page.click('.choice-btn[data-choice="si"]')
            page.wait_for_timeout(300)
            ok(qa.ev("__game.state().player.sifang") == 600, "嫁妆留一半 → 私房600")
            ok(qa.phase() == "actions", "进入行动阶段")
            ok(page.locator(".leaderboard").is_visible(), "排行榜在(第一幕)")
            ok(page.locator(".lb-row").count() == 4, "初始四房上榜")
            # 音频:AudioContext 已因手势解锁;静音开关持久化
            page.click("#btn-mute"); page.wait_for_timeout(80)
            m1 = qa.ev("localStorage.getItem('jpm_mute')")
            page.click("#btn-mute"); page.wait_for_timeout(80)
            m0 = qa.ev("localStorage.getItem('jpm_mute')")
            ok(m1 == "1" and m0 == "0", "静音开关生效且持久化")
            qa.shot("f1_stage")
            # F1 行动:探(薛媒婆免费)+结+藏;在「藏」前后核对明暗不对称
            asym = {}
            def pol1(i):
                if i == 0: qa.seal("tan", ["servant:xuemei", "target:yue"])
                elif i == 1: qa.seal("jie", ["target:ximen", "size:small", "fund:si"])
                else:
                    asym['m0'] = qa.ev("JSON.stringify([__game.state().player.tiyan,__game.state().player.chong])")
                    asym['si0'] = qa.ev("__game.state().player.sifang")
                    qa.seal("cang", ["mode:save"])
                    asym['m1'] = qa.ev("JSON.stringify([__game.state().player.tiyan,__game.state().player.chong])")
                    asym['si1'] = qa.ev("__game.state().player.sifang")
            qa.actions_phase(pol1)
            ok(qa.ev("__game.state().rumors.length") >= 1, "探得一条传闻")
            ok(page.locator(".rumor-card").count() >= 1, "传闻卡出现")
            qa.shot("f1_actions")
            ok(asym.get('m0') == asym.get('m1') and asym.get('si1', 0) > asym.get('si0', 0), "「藏」只涨暗账不涨明账")
            sky1 = qa.ev("document.querySelector('.tint-layer')?.dataset.sky ?? ''")
            qa.submit()
            ok(qa.festival() == 2, "进入节令2")
            # 留宿灯光:剖面图上只有被留宿那一房的窗亮着,且与引擎判定一致
            ok(page.locator(".room-glow.lit").count() == 1, "留宿灯光:只有一房的窗亮着")
            house = qa.ev("document.querySelector('.room-glow.lit')?.dataset.lodging ?? ''")
            ok(house != "" and house == qa.ev("__game.state().lodging"), f"亮灯的一房与引擎留宿一致({house})")
            # F2-F6:走完第一幕
            first_false_seen = False
            for f in range(2, 7):
                if f == 3:
                    # 上门事件:节令中途有人主动来找你,要求当场表态(掷定走 seedRNG,节令3必来)
                    page.locator('#modal-event .choice-btn').first.click()
                    page.wait_for_timeout(400)
                    ok(page.locator("#modal-visit").count() > 0, "节令中途有人上门")
                    qa.shot("visit")
                    sf0 = qa.ev("__game.state().player.sifang")
                    page.locator('#modal-visit .choice-btn').first.click()
                    page.wait_for_timeout(300)
                    ok(qa.ev("__game.state().visit") is None, "上门事件当场表态")
                    paid = qa.ev("__game.state().player.sifang") != sf0
                    owed = qa.ev("__game.state().player.renqing.xuee") > 0
                    ok(paid or owed, "上门选择有代价(没有安全选项)")
                else:
                    qa.handle_event(0)
                def pol(i):
                    if i == 0: qa.seal("tan", ["servant:xuemei", "target:yue"])
                    else: qa.seal("cang", ["mode:save"])
                qa.actions_phase(pol, limit=2)
                if f == 5:
                    first_false_seen = qa.ev("__game.state().rumors.some(r=>r.truth===false)")
                qa.submit()
            ok(first_false_seen, "第一幕出现第一条假传闻")
            ok(qa.ev("__game.state().rivals.pan.joined"), "潘金莲第9回入门")
            ok(qa.ev("__game.state().rivals.pinger.joined"), "李瓶儿第19回入门")
            ok(page.locator(".lb-row").count() == 6, "六房全部上榜")
            qa.shot("act1_end")

            # ---------- 第二幕 ----------
            section("第二幕 · 争锋")
            ok(qa.ev("__game.state().flags.mou") == True, "第30回解锁谋算")
            qa.handle_event(0)  # 节令7 冬至(无选择)
            sky7 = qa.ev("document.querySelector('.tint-layer')?.dataset.sky ?? ''")
            ok(sky7 != "" and sky7 != sky1, f"节令天色变化生效({sky1} → {sky7})")
            # 谋:散布流言对潘金莲
            def pol_mou(i):
                if i < 2: qa.seal("mou", ["scheme:sanbu", "target:pan"])
                else: qa.seal("cang", ["mode:save"])
            qa.actions_phase(pol_mou, limit=3)
            schemes = qa.ev("JSON.stringify(__game.state().schemes)")
            ok("sanbu" in schemes, "谋算已起(进度+知情者)")
            ok(qa.ev("__game.state().player.fengsheng") > 0, "谋算升起风声")
            qa.shot("act2_mou")
            qa.submit()
            # 节令 8-14:铺退路 + 藏 + 探
            for f in range(8, 15):
                qa.handle_event(0)
                def pol2(i):
                    if i == 0: qa.seal("cang", ["mode:tuilu", "line:niangjia"])
                    elif i == 1: qa.seal("cang", ["mode:tuilu", "line:puzi"])
                    else: qa.seal("cang", ["mode:save"])
                qa.actions_phase(pol2, limit=3)
                qa.submit()
            ok(qa.ev("__game.state().player.tuilu.length") >= 1, "退路已开拓")
            # 第59回:官哥儿夭 —— 选「换取好处」
            section("第59/62回选择")
            ok(qa.festival() == 15, "节令15 官哥儿夭")
            qa.shot("f15_event")
            page.locator('#modal-event .choice-btn[data-choice="huanqu"]').click()
            page.wait_for_timeout(300)
            ok(qa.ev("__game.state().flags.huanqu") == True, "换取好处已记录")
            ok(qa.ev("__game.state().player.renqing.pan") >= 20, "潘金莲人情入手")
            qa.submit()
            # 第62回:李瓶儿病故 —— 选「收敛不出头」
            ok(qa.festival() == 16, "节令16 李瓶儿病故")
            page.locator('#modal-event .choice-btn[data-choice="shoulian"]').click()
            page.wait_for_timeout(300)
            qa.submit()
            ok(qa.ev("__game.state().rivals.pinger.alive") == False, "李瓶儿撤榜(亡故不可逆)")
            for f in range(17, 19):
                qa.handle_event(0)
                qa.actions_phase(lambda i: qa.seal("cang", ["mode:save"]), limit=3)
                qa.submit()
            ok(qa.festival() == 19, "走到第79回")

            # ---------- 第79回 明账清零 ----------
            section("第79回 · 明账清零")
            best = qa.ev("__game.state().bestRank")
            r = qa.wait_special(timeout_s=90)
            ok(r == "clear", "清零演出播完")
            ok(qa.ev("__game.state().player.tiyan") == 0 and qa.ev("__game.state().player.chong") == 0, "体面/宠归零")
            ok(page.locator(".leaderboard").count() == 0 or not page.locator(".leaderboard").is_visible(), "排行榜从界面消失")
            ok(qa.ev("__game.leaderboard().length") == 0, "排行榜不再回来")
            ok(isinstance(best, int) and best >= 1, f"历史最高位次已记录({best})")
            ok(qa.ev("__game.state().player.sifang") > 0, "暗账保留")
            qa.shot("f19_after")

            # ---------- 分家 ----------
            section("第三幕 · 分家")
            qa.submit()  # 第79回纯清算,无行动点,直接提交进入分家
            for f in range(20, 23):
                sp = qa.wait_special(timeout_s=30)
                if sp == "event":
                    qa.handle_event(0)
                qa.actions_phase(lambda i: qa.seal("cang", ["mode:save"]), limit=3)
                qa.submit()
            ok(qa.festival() == 23, "走到去向节令")

            # ---------- 结局 ----------
            section("结局与收束")
            r = qa.wait_special(timeout_s=30)
            ok(r == "ending", "结局面板出现")
            ending = qa.ev("__game.state().ending.key")
            ok(ending in ("liyanei", "niangjia", "shoufu", "liuluo", "faluo"), f"结局判定({ending})")
            txt = page.locator("#ending-root").inner_text()
            ok("历史最高位次" in txt and "于结局无所增益" in txt, "结算点破排行榜与结局无关")
            qa.shot("ending")
            page.click("#btn-ending-next")
            page.wait_for_timeout(1500)
            qa.settle()  # 第23令的结算模态(若有)
            page.wait_for_selector("#epilogue-root", timeout=20000)
            ok("蓋為世戒" in page.locator("#epilogue-root").inner_text(), "第一百回收束引原著序")
            qa.shot("epilogue")

            # ---------- 重开 ----------
            section("重开")
            page.click("#btn-restart")
            page.wait_for_selector("#btn-start", timeout=10000)
            ok(qa.ev("!localStorage.getItem('jpm_save_v1')"), "重开后旧档已清")
            qa.shot("restart")

            browser.close()
    finally:
        if server:
            server.terminate()
    print(f"\n控制台错误: {len(errors)}")
    for e in errors[:10]:
        print("  ERR:", e[:300])
    print(f"结果: {passed} 通过, {failed} 失败, 截图 {qa.n if qa else 0} 张 → {SHOTS}")
    sys.exit(1 if (failed or errors) else 0)


if __name__ == "__main__":
    main()
