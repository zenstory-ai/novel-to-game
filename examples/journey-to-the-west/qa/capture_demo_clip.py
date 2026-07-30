#!/usr/bin/env python3
"""录一段可直接发到 X 的真实战斗视频。

和 capture_demo_gif.py 同源、同一条键盘路径、同一个种子,区别只在输出:
GIF 是给 README 首屏用的,截图拼帧、5fps、裁掉指令台;这里录的是 Playwright
原生视频流(常速、原生帧率、1280x800 不裁),给时间轴上的短片用。

三条不能动的约束:
1. 常速。不带 fast=1,引擎按真实节奏结算,飘字和「克!」印章的时机就是玩家看到的时机。
2. 种子固定。?seed=42,同一条键盘路径重跑出同一场战斗,片子可以被复现和被质疑。
3. 落盘在工作区内。qa 契约把系统临时目录路径视为无证据,视频同理:
   examples/journey-to-the-west/screenshots/clip/,不进 /tmp。

整段是一次不间断的录制。后期只在这条录像上截一个窗口(scripts/xclip.py encode --start),
窗口之内没有任何剪辑——序幕和战斗之间没有拼接,片中也没有。

跑法:
  python3 qa/capture_demo_clip.py                    # 录 + 出 20s mp4
  python3 qa/capture_demo_clip.py --no-encode        # 只录原始 webm
  python3 qa/capture_demo_clip.py --start 3.5        # 手工指定截取起点(相对 battle_ready)
"""
from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
EXAMPLE = HERE.parent
REPO = EXAMPLE.parent.parent
APP = EXAMPLE / "build" / "app"
XCLIP = REPO / "scripts" / "xclip.py"
PORT = 5176
BASE = f"http://127.0.0.1:{PORT}"

# 1280x800 = 1.6:1。X 的画幅窗口是 1:3 到 3:1,边长上限 1280x1024,正好卡住不超。
# 不裁底部指令台:对读不懂中文的人来说,那排「攻击/法术/防御/道具」上移动的
# 键盘高亮是唯一能一眼看出"有人在操作真实界面"的东西,比省下的画幅值钱。
VIEW = {"width": 1280, "height": 800}


def ensure_server() -> subprocess.Popen | None:
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", PORT)) == 0:
            return None
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(60):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", PORT)) == 0:
                return proc
        time.sleep(0.1)
    proc.kill()
    raise RuntimeError("本地服务未起来")


class Take:
    """一次录制。marks 记录关键时刻相对录制起点的秒数,后期靠它定位截取窗口。"""

    def __init__(self, page, t0: float):
        self.page = page
        self.t0 = t0
        self.marks: list[dict] = []

    def mark(self, label: str) -> float:
        t = time.monotonic() - self.t0
        self.marks.append({"label": label, "t": round(t, 3)})
        print(f"  [{t:6.2f}s] {label}")
        return t

    def at(self, label: str) -> float:
        for m in self.marks:
            if m["label"] == label:
                return m["t"]
        raise KeyError(label)

    def key(self, k: str, wait: int = 0) -> None:
        self.page.keyboard.press(k)
        if wait:
            self.page.wait_for_timeout(wait)


def prologue(t: Take) -> None:
    """序幕:开场 → 问土地 → 触发罗刹女遭遇。与 capture_demo_gif.py 同一条路径。"""
    p = t.page
    p.goto(f"{BASE}/?seed=42", wait_until="load")
    p.wait_for_selector("#btn-start", timeout=15000)
    t.mark("title")

    t.key("Enter")
    p.wait_for_selector("#dialog", timeout=10000)
    for _ in range(20):
        if p.locator("#dialog").count() == 0:
            break
        t.key("Enter", 180)
    p.wait_for_selector("#overworld-canvas", timeout=8000)
    t.mark("overworld")

    # 先问土地:遭遇罗刹女以此为前置(叙事上土地才指路)
    for _ in range(4):
        t.key("ArrowLeft", 90)
    for _ in range(2):
        t.key("ArrowUp", 90)
    p.wait_for_timeout(500)
    t.key("Enter")
    p.wait_for_selector("#dialog", timeout=8000)
    for _ in range(10):
        if p.locator("#dialog").count() == 0:
            break
        t.key("Enter", 180)
    for _ in range(11):
        t.key("ArrowRight", 90)
    for _ in range(2):
        t.key("ArrowUp", 90)
    p.wait_for_selector("#dialog", timeout=10000)

    for _ in range(60):
        if p.locator('.cmd-btn[data-cmd="auto"]').count() > 0:
            break
        if p.locator("#dialog").count() > 0 or p.locator(".modal-mask").count() > 0:
            t.key("Enter")
        p.wait_for_timeout(220)
    p.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=10000)
    t.mark("battle_ready")


def cmd_open(page) -> bool:
    b = page.locator('.cmd-btn[data-cmd="auto"]')
    return b.count() > 0 and b.first.is_visible()


def wait_cmd(t: Take, timeout_s: float = 25.0) -> bool:
    """等指令台回来。中间冒出的即时小卡片顺手关掉,不然会一直挡着。"""
    p = t.page
    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout_s:
        if p.locator("#btn-once-close").count() > 0:
            p.locator("#btn-once-close").click()
            p.wait_for_timeout(200)
        if p.locator("#dialog").count() > 0:
            t.key("Enter", 200)
        if cmd_open(p):
            return True
        p.wait_for_timeout(200)
    return False


def issue_skill(t: Take, browse: bool = True) -> None:
    """给当前单位下一条法术指令,途中把方向键的移动做出来。

    这是全片唯一"有人在操作"的可读证据:指令台上的高亮框、法术菜单里的移动、
    选目标时预览条上跟着变的「克/被克」,全是引擎对真实按键的响应。
    """
    t.key("ArrowRight", 380 if browse else 160)   # 攻击 → 法术,高亮可见地移一格
    t.key("Enter", 480)                            # 展开法术菜单
    if browse:
        t.key("ArrowRight", 460)
        t.key("ArrowLeft", 460)
    t.key("Enter", 420)                            # 选中法术 → 进入选目标
    if browse:
        t.key("ArrowRight", 560)                   # 换目标,预览条上的五行利弊跟着变
        t.key("ArrowLeft", 560)
    t.key("Enter", 260)                            # 确认


def issue_attack(t: Take) -> None:
    """普攻:少两次停顿,让一轮里的三条指令不至于全是同一个节奏。"""
    t.key("Enter", 320)        # 高亮默认停在「攻击」
    t.key("ArrowRight", 420)   # 换个目标,预览条重算
    t.key("Enter", 240)


def play_round(t: Take, n: int) -> None:
    """打完整的一回合:逐个单位下指令 → 指令台收起 → 全场结算演出。

    结算是这场战斗的招牌时刻——飘字、「克!」印章、血条掉、行动顺序条推进
    同时发生,而且只在所有人都下完指令之后才发生。片子的窗口必须落在这里。
    """
    p = t.page
    for i in range(4):
        if not wait_cmd(t, 20):
            break
        t.mark(f"r{n}_cmd{i}")
        issue_skill(t, browse=(i == 0)) if i == 0 else issue_attack(t)
        p.wait_for_timeout(200)
        if not cmd_open(p):
            break                      # 指令台收了 = 本回合指令下完,开始结算
    t.mark(f"r{n}_resolve")
    wait_cmd(t, 25)                    # 结算演出走完,指令台重新出现
    t.mark(f"r{n}_done")


def battle_beats(t: Take, rounds: int) -> None:
    t.page.wait_for_timeout(600)
    for n in range(1, rounds + 1):
        play_round(t, n)
        if not cmd_open(t.page):
            break
    t.page.wait_for_timeout(1500)
    t.mark("end")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", type=Path,
                    default=EXAMPLE / "screenshots" / "clip")
    ap.add_argument("--duration", type=float, default=20.0, help="成片时长(秒)")
    ap.add_argument("--start", type=float, default=None,
                    help="截取起点(源片绝对秒数);不给则用第 1 回合结算前 4s")
    ap.add_argument("--rounds", type=int, default=4, help="录几个回合,多录留出挑窗口的余量")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--no-encode", action="store_true", help="只录不转,方便先挑剪切点")
    args = ap.parse_args()

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    server = ensure_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            # record_video_* 走 CDP 屏幕流,常速、原生帧率,不是逐帧截图拼的。
            ctx = browser.new_context(
                viewport=VIEW,
                record_video_dir=str(raw_dir),
                record_video_size=VIEW,
            )
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

            t = Take(page, time.monotonic())
            prologue(t)
            battle_beats(t, args.rounds)

            video = page.video
            ctx.close()   # 必须 close,webm 才会落盘
            browser.close()
            src = Path(video.path())
    finally:
        if server:
            server.terminate()

    webm = out_dir / "raw_take.webm"
    if webm.exists():
        webm.unlink()
    src.rename(webm)

    # 录制在 goto 之前就开了,marks 的零点比源片零点晚一点。用「片长 - 最后一个标记」
    # 把这段前导算出来,标记才能直接换算成源片秒数。
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(webm)],
        capture_output=True, text=True, check=True).stdout.strip())
    offset = round(dur - t.at("end"), 3)

    marks_path = out_dir / "marks.json"
    marks_path.write_text(json.dumps(
        {"seed": 42, "viewport": VIEW, "fast": False,
         "url": f"{BASE}/?seed=42", "console_errors": errors,
         "source_duration": dur, "marks_to_source_offset": offset,
         "marks": t.marks}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n原片 → {webm}  ({webm.stat().st_size/1e6:.2f}MB, {dur:.2f}s)")
    print(f"时标 → {marks_path}  (标记 + {offset:.2f}s = 源片秒数)")
    if errors:
        print(f"控制台报错 {len(errors)} 条:{errors[:3]}")

    if args.no_encode:
        print("\n下一步:python3 scripts/xclip.py contact-sheet "
              f"{webm} --out {out_dir/'sheet'} --every 1")
        return 0

    # 默认起点:第一回合指令下完、结算开始后 0.5 秒。X 拿第 0 帧当缩略图,而这一帧上
    # 「连击!」印章、飘字、血条、行动顺序条同时在动,是全片信息密度最高的一帧。
    # 往后 20 秒正好走完"结算 → 下一回合逐人下指令 → 再结算"两轮循环,
    # 且停在剧情对话开始之前——对话段是静止的说话头,放进短片里就是九秒空转。
    # 这个 0.5 是这一版录像量出来的,换了节拍或换了战斗,先跑 --no-encode 加
    # scripts/xclip.py contact-sheet 用眼睛挑,别信默认值。
    start = args.start if args.start is not None else (t.at("r1_resolve") + offset + 0.5)
    out = out_dir / "jtw_battle_20s.mp4"
    print(f"\n截取窗口:源片 {start:.2f}s 起 {args.duration:.1f}s")
    rc = subprocess.run([sys.executable, str(XCLIP), "encode", str(webm),
                         "--out", str(out), "--start", f"{start:.3f}",
                         "--duration", f"{args.duration:.3f}",
                         "--fps", str(args.fps)]).returncode
    return rc


if __name__ == "__main__":
    sys.exit(main())
