#!/usr/bin/env python3
"""常速首次上手计时 + 性能实测。

qa 契约:加速模式下取得的一切时序证据无效。本脚本**不带** `fast=1`,按正常速度实测:
  - 首屏加载(导航开始 → 标题可读)
  - 进入游戏 → 首个有意义动作(玩家指令真实改变战斗状态)的秒数
  - 强制演出 / 无交互段时长
  - 战斗中帧率
  - 玩家实际下载的包体(排除 test/ 与 RUN.md,与 .vercelignore 一致)

跑法: python3 qa/onboarding_timing.py [--write]
"""
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "build" / "app"
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5174")
URL = BASE + "/?seed=42"  # 注意:不加 fast=1
SHOTS = HERE / "evidence" / "onboarding-frames"


def free_port(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def ensure_server():
    port = int(BASE.rsplit(":", 1)[1])
    if not free_port(port):
        return None
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(60):
        if not free_port(port):
            return proc
        time.sleep(0.1)
    raise RuntimeError("本地服务未起来")


def bundle_size() -> dict:
    """玩家实际下载的资源:排除 test/、RUN.md、.omc(与 .vercelignore 一致)。"""
    skip_dirs = {"test", ".omc", "node_modules"}
    skip_files = {"RUN.md", ".vercelignore", ".gitignore", "vercel.json", "package.json"}
    by_kind, total = {}, 0
    for path in APP.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(APP)
        if rel.parts[0] in skip_dirs or rel.name in skip_files:
            continue
        size = path.stat().st_size
        kind = {".js": "js", ".css": "css", ".html": "html"}.get(
            path.suffix.lower(), "assets")
        by_kind[kind] = by_kind.get(kind, 0) + size
        total += size
    return {"total": total, "by_kind": by_kind}


def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    server = ensure_server()
    result = {"url": URL, "fast_mode": False, "bundle": bundle_size()}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            errors = []
            page.on("console", lambda m: m.type == "error" and errors.append(m.text))
            page.on("pageerror", lambda e: errors.append(str(e)))

            t0 = time.monotonic()
            page.goto(URL, wait_until="load")
            page.wait_for_selector("#app *", timeout=15000)
            result["first_paint_s"] = round(time.monotonic() - t0, 3)
            nav = page.evaluate(
                "() => { const n = performance.getEntriesByType('navigation')[0];"
                " return n ? {domContentLoaded: n.domContentLoadedEventEnd,"
                " load: n.loadEventEnd, transferSize: n.transferSize} : null; }")
            result["navigation_ms"] = nav
            page.screenshot(path=str(SHOTS / "t0_title.jpg"), type="jpeg", quality=80)

            # 全程键盘驱动:与 qa_browser「键盘全流程」逐键一致,只是不加速。
            # 混用鼠标会把焦点留在按钮上,小世界收不到方向键。
            page.wait_for_selector("#btn-start", timeout=10000)
            t_click = time.monotonic()
            page.keyboard.press("Enter")                      # 标题:回车开始
            page.wait_for_selector("#dialog", timeout=10000)
            waited = 0.0
            for _ in range(20):                               # 序幕旁白
                if page.locator("#dialog").count() == 0:
                    break
                page.keyboard.press("Enter")
                page.wait_for_timeout(180)
                waited += 0.18
            page.wait_for_selector("#overworld-canvas", timeout=8000)
            result["prologue_forced_wait_s"] = round(waited, 2)
            result["title_to_playable_s"] = round(time.monotonic() - t_click, 3)
            page.screenshot(path=str(SHOTS / "t1_overworld.jpg"), type="jpeg", quality=80)
            result["phase_after_prologue"] = page.evaluate("() => window.__game.phase()")

            read_hp = ("() => { const b = window.__game && window.__game.battle;"
                       " return b && b.units ? b.units.map(u => u.hp) : null; }")

            # 走到土地问话(左 4 上 2),再走到罗刹女触发遭遇(右 11 上 2)
            t_walk = time.monotonic()
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
            result["walk_to_encounter_s"] = round(time.monotonic() - t_walk, 3)

            # 战前对话 + 教学卡:常速逐个回车过
            t_pre = time.monotonic()
            for _ in range(50):
                if page.locator('.cmd-btn[data-cmd="auto"]').count() > 0:
                    break
                if page.locator("#dialog").count() > 0 or page.locator(".modal-mask").count() > 0:
                    page.keyboard.press("Enter")
                page.wait_for_timeout(220)
            page.wait_for_selector('.cmd-btn[data-cmd="auto"]', timeout=10000)
            result["pre_battle_dialog_s"] = round(time.monotonic() - t_pre, 3)
            t_battle = time.monotonic()
            hp_before = page.evaluate(read_hp)
            page.screenshot(path=str(SHOTS / "t2_battle_open.jpg"), type="jpeg", quality=80)

            # 帧率:战斗界面下采样 2 秒
            fps = page.evaluate("""() => new Promise(res => {
              let n = 0; const t = performance.now();
              const tick = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(tick);
                else res(Math.round(n / ((performance.now() - t) / 1000))); };
              requestAnimationFrame(tick);
            })""")
            result["battle_fps"] = fps

            # 下第一个真实指令(攻击 → 选目标),测到状态改变的秒数
            # 回合制要全员下完指令才结算:悟空手动攻击,其余按「自动」补齐,
            # 所以「首个有意义动作产生效果」天然包含下满一轮指令的时间。
            t_cmd = time.monotonic()
            page.keyboard.press("1")           # 数字键直选:攻击
            page.wait_for_timeout(300)
            page.keyboard.press("ArrowRight")  # 目标循环(与 qa_browser 同一条已验证路径)
            page.wait_for_timeout(200)
            page.keyboard.press("Enter")       # 确认目标
            page.wait_for_timeout(300)
            for _ in range(6):                 # 其余伙伴:6=自动
                if page.locator('.cmd-btn[data-cmd="auto"]').count() == 0:
                    break
                page.keyboard.press("6")
                page.wait_for_timeout(300)
            result["issue_full_round_s"] = round(time.monotonic() - t_cmd, 3)
            changed = None
            for _ in range(300):
                hp_now = page.evaluate(read_hp)
                if hp_now and hp_before is None:
                    hp_before = hp_now
                elif hp_now and hp_now != hp_before:
                    changed = time.monotonic()
                    break
                page.wait_for_timeout(100)
            result["battle_open_to_state_change_s"] = (
                round(changed - t_battle, 3) if changed else None)
            result["total_entry_to_first_effect_s"] = (
                round(changed - t0, 3) if changed else None)
            page.screenshot(path=str(SHOTS / "t3_first_effect.jpg"), type="jpeg", quality=80)
            result["console_errors"] = errors
            browser.close()
    finally:
        if server:
            server.terminate()

    b = result["bundle"]
    lines = [
        "# 常速首次上手计时与性能实测",
        "",
        "由 `qa/onboarding_timing.py` 生成，**未使用 `fast=1`**——qa 契约规定加速模式下的",
        "时序证据无效。视口 1280×800，种子 42，全新浏览器上下文。",
        "",
        "## 时序（秒，常速）",
        "",
        "| 指标 | 实测 | 契约判据 |",
        "|---|---|---|",
        f"| 首屏可读（导航 → `#app` 有内容） | {result.get('first_paint_s')} | 无锁定预算 |",
        f"| 标题 → 可操作（序幕小世界） | {result.get('title_to_playable_s')} | — |",
        f"| 序幕强制等待合计 | {result.get('prologue_forced_wait_s')} | 无交互段应尽量短 |",
        f"| 小世界走位到遭遇 | {result.get('walk_to_encounter_s')} | — |",
        f"| 战前对话 + 教学卡 | {result.get('pre_battle_dialog_s')} | 强制演出应尽量短 |",
        f"| 下满一轮指令（悟空手动 + 其余自动） | {result.get('issue_full_round_s')} | — |",
        f"| 进战斗 → 首个状态改变 | {result.get('battle_open_to_state_change_s')} | — |",
        f"| **进入 → 首个有意义动作产生效果** | **{result.get('total_entry_to_first_effect_s')}** | 契约参考 ≤30 秒 |",
        "",
        "## 性能",
        "",
        "| 指标 | 实测 | PRODUCT_BRIEF 预算 |",
        "|---|---|---|",
        f"| 战斗中帧率 | {result.get('battle_fps')} fps | `N/A`（intake 未锁定） |",
        f"| 玩家下载包体 | {b['total'] / 1e6:.2f} MB | `N/A`（intake 未锁定） |",
        f"| └ 资产 | {b['by_kind'].get('assets', 0) / 1e6:.2f} MB | — |",
        f"| └ JS | {b['by_kind'].get('js', 0) / 1e3:.0f} KB | — |",
        f"| └ CSS | {b['by_kind'].get('css', 0) / 1e3:.0f} KB | — |",
        f"| 控制台错误 | {len(result.get('console_errors') or [])} | 0 |",
        "",
        "PRODUCT_BRIEF 第 1 维把性能预算记作 `N/A`（intake 未锁定，见该文档「未确认假设」）。",
        "按流程契约 `N/A` 也是锁定值，因此**不存在可判超标的预算**——本节只如实报出实测数字，",
        "不据此判 `major`；「未锁定性能预算」本身作为 `product` 归属的已知缺口留档。",
        "",
        "帧序证据：`qa/evidence/onboarding-frames/`（t0 标题 / t1 序幕 / t2 进战斗 / t3 首个效果）。",
        "",
    ]
    md = "\n".join(lines)
    print(md)
    if "--write" in sys.argv:
        (HERE / "evidence" / "onboarding-timing.md").write_text(md, encoding="utf-8")
        (HERE / "evidence" / "onboarding-timing.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print("已写 qa/evidence/onboarding-timing.md")
    return 1 if result.get("console_errors") else 0


if __name__ == "__main__":
    sys.exit(main())
