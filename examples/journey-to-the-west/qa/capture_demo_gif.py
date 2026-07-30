#!/usr/bin/env python3
"""录一段真实战斗的动图，供 README 首屏使用。

不是摆拍：走的是 qa_browser 同一条键盘路径，常速播放，抓的是真实结算帧——
飘字、「克!」印章、行动顺序条推进都来自引擎实际输出。

跑法: python3 qa/capture_demo_gif.py [--out <path>] [--frames N] [--interval MS]
"""
import argparse
import io
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "build" / "app"
PORT = 5176
BASE = f"http://127.0.0.1:{PORT}"


def ensure_server():
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
    raise RuntimeError("本地服务未起来")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE.parent / "screenshots" / "demo.gif"))
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--interval", type=int, default=180, help="抓帧间隔 ms")
    ap.add_argument("--width", type=int, default=720, help="输出宽度，等比缩放")
    ap.add_argument("--keep", type=float, default=0.78, help="保留画面顶部比例，裁掉底部指令台")
    args = ap.parse_args()

    server = ensure_server()
    frames: list[Image.Image] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            # 常速：不带 fast=1
            page.goto(f"{BASE}/?seed=42", wait_until="load")
            page.wait_for_selector("#btn-start", timeout=15000)

            # 全键盘走到战斗一的指令阶段（与 qa_browser 键盘全流程同路径）
            page.keyboard.press("Enter")
            page.wait_for_selector("#dialog", timeout=10000)
            for _ in range(20):
                if page.locator("#dialog").count() == 0:
                    break
                page.keyboard.press("Enter")
                page.wait_for_timeout(180)
            page.wait_for_selector("#overworld-canvas", timeout=8000)
            # 先问土地：遭遇罗刹女以此为前置（叙事上土地才指路）
            for _ in range(4):
                page.keyboard.press("ArrowLeft"); page.wait_for_timeout(90)
            for _ in range(2):
                page.keyboard.press("ArrowUp"); page.wait_for_timeout(90)
            page.wait_for_timeout(500)
            page.keyboard.press("Enter")
            page.wait_for_selector("#dialog", timeout=8000)
            for _ in range(10):
                if page.locator("#dialog").count() == 0:
                    break
                page.keyboard.press("Enter"); page.wait_for_timeout(180)
            for _ in range(11):
                page.keyboard.press("ArrowRight"); page.wait_for_timeout(90)
            for _ in range(2):
                page.keyboard.press("ArrowUp"); page.wait_for_timeout(90)
            page.wait_for_selector("#dialog", timeout=10000)
            for _ in range(50):
                if page.locator('.cmd-btn[data-cmd="auto"]').count() > 0:
                    break
                if page.locator("#dialog").count() > 0 or page.locator(".modal-mask").count() > 0:
                    page.keyboard.press("Enter")
                page.wait_for_timeout(220)
            page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=10000)

            # 抓帧：一边下指令一边连续截图，捕捉真实结算演出
            def grab():
                frames.append(Image.open(io.BytesIO(
                    page.screenshot(type="jpeg", quality=88))).convert("RGB"))

            issued = 0
            for i in range(args.frames):
                # 每隔几帧推进一次指令，让结算演出落在抓帧窗口里
                if i % 6 == 0 and page.locator('.cmd-btn[data-cmd="auto"]').count() > 0:
                    if issued == 0:
                        page.keyboard.press("2")      # 法术
                        page.wait_for_timeout(150)
                        page.keyboard.press("Enter")  # 选第一个法术
                        page.wait_for_timeout(150)
                        page.keyboard.press("Enter")  # 确认目标
                    else:
                        page.keyboard.press("6")      # 自动
                    issued += 1
                grab()
                page.wait_for_timeout(args.interval)
            browser.close()
    finally:
        if server:
            server.terminate()

    if not frames:
        print("没抓到帧")
        return 1

    # 裁掉底部指令台：抓帧落在指令阶段之间时那一块是空的，做首屏 hero 很难看，
    # 而战斗台本身（对阵、行动顺序条、飘字、五行环）才是要展示的东西。
    src_w, src_h = frames[0].size
    crop_h = round(src_h * args.keep)
    frames = [f.crop((0, 0, src_w, crop_h)) for f in frames]

    w = args.width
    h = round(frames[0].height * w / frames[0].width)
    frames = [f.resize((w, h), Image.LANCZOS) for f in frames]
    # 量化到共享调色板，控制体积
    pal = frames[0].quantize(colors=128, method=Image.MEDIANCUT)
    frames = [f.quantize(palette=pal, dither=Image.FLOYDSTEINBERG) for f in frames]

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=args.interval, loop=0, optimize=True)
    size = out.stat().st_size
    print(f"{len(frames)} 帧 → {out}  {size/1e6:.2f}MB  {w}×{h}")
    if size > 8_000_000:
        print("警告：超过 8MB，GitHub 上加载会慢，考虑减帧或降宽")
    return 0


if __name__ == "__main__":
    sys.exit(main())
