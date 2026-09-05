#!/usr/bin/env python3
"""首夜阅读与键盘烟测；不代替完整二十日 QA 或全站无障碍审计。"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from playwright.sync_api import sync_playwright
from verify_visual import (
    APP, EVIDENCE, assert_layout, click_forward, free_port, layout_snapshot,
    runtime_digest, wait_for_server, write_json_atomic,
)


# 用户确认保留的原版图片；与本轮改动前的仓库版本逐字节核对后固定。
# 不随构建自动重算期望值；更换这组图片需要重新确认美术方向。
ORIGINAL_ART_SHA256 = {
    'assets/cg/group/title_new_guofeng.webp': '375f73c10aea38a0235e84467bfabf8f13fe5a55322875e4af3711fa0a1b3bfc',
    'assets/heroine/yue/night.webp': '5f9dd4ad1e7bf7c91643d0f519bdbf90b158d06c7ea6b3db6bb1d10032d44803',
    'assets/heroine/pan/night.webp': 'd9e966068e2f727c37b0e23df3e59a5f173d78c1146ba69e7acd7de2c946df99',
    'assets/heroine/pinger/night.webp': '982804fc9d873848965eb4e70e7ef6090740d135c622a281936cb84280d93b81',
    'assets/heroine/meng/night.webp': '69809edd2de568e73956fd4f2d45c47a5d99e5ad2bb1d6c5e019eedeefc126d7',
    'assets/heroine/xuee/night.webp': '7394d8b7ff4e48498266ea2c16d9c6851949bdc3e444fb39fc761c34003ce3f8',
}


def check_original_art(root):
    observed = {}
    for relative, expected in ORIGINAL_ART_SHA256.items():
        actual = hashlib.sha256((root / relative).read_bytes()).hexdigest()
        assert actual == expected, f'原版人物图片发生变化：{relative}'
        observed[relative] = actual
    return observed


def contrast(foreground, background):
    def luminance(rgb):
        channels = [value / 255 for value in rgb]
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]
        return sum(v * w for v, w in zip(linear, (.2126, .7152, .0722)))
    light, dark = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (light + .05) / (dark + .05)


def check_reading(page):
    rows = page.locator('.want-line, .want-line > b, .want-line > span, .want-line > small').evaluate_all('''nodes => nodes.map(node => {
        const s = getComputedStyle(node);
        return {tag: node.tagName, color: s.color, fontSize: parseFloat(s.fontSize)};
    })''')
    assert len(rows) == 4, rows
    # 当前正文使用不透明底色；仅测此区域，不宣称覆盖所有页面。
    background = page.locator('.want-line').evaluate('node => getComputedStyle(node).backgroundColor')
    background_rgb = [float(n) for n in re.findall(r'[\d.]+', background)]
    assert len(background_rgb) == 3, f'正文底色必须不透明：{background}'
    for row in rows:
        rgb = [float(n) for n in re.findall(r'[\d.]+', row['color'])]
        assert len(rgb) == 3, row
        row['contrastRatio'] = round(contrast(rgb, background_rgb), 2)
        assert row['contrastRatio'] >= 4.5, f'夜访低对比文字：{row}'
        assert row['fontSize'] >= 12, f'夜访辅助字小于 12px：{row}'
    return rows


def run():
    original_art = check_original_art(APP)
    port = free_port()
    url = f'http://127.0.0.1:{port}'
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    report = []
    try:
        wait_for_server(url)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'{url}/?seed=42')
            page.locator('#btn-age-yes').click()
            page.locator('#btn-start').wait_for()
            # 只读真实资产键表，不修改游戏状态或 DOM。
            assets = page.evaluate("async () => (await import('./js/assets.js')).ASSET_PATHS")
            assert assets['cover'] == 'assets/cg/group/title_new_guofeng.webp'
            for name in ('yue', 'pan', 'pinger', 'meng', 'xuee'):
                for suffix in ('', '/close'):
                    assert assets[f'heroine/{name}{suffix}'] == f'assets/heroine/{name}/night.webp'
            page.locator('#btn-start').click()
            for _ in range(30):
                if page.evaluate('window.__game.state().phase') == 'choose_visit':
                    break
                assert click_forward(page)
            assert page.evaluate('window.__game.state().phase') == 'choose_visit'
            page.locator('[data-visit]:not(:disabled)').first.click()
            page.locator('[data-route-choice]').first.wait_for()
            for name, width, height in [('desktop', 1280, 800), ('mobile', 390, 844)]:
                layout = layout_snapshot(page, name, width, height)
                assert_layout([layout], '首夜阅读')
                report.append({'viewport': name, 'text': check_reading(page), 'layout': layout})
                if width == 390:
                    page.locator('[data-route-choice]').first.hover()
                    page.wait_for_timeout(250)
                    # hover 会横移按钮；按上下边界判断单列，不把横向动效误报为换列。
                    positions = page.locator('[data-route-choice]').evaluate_all('nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return {top:r.top, bottom:r.bottom}; })')
                    assert all(previous['bottom'] <= following['top'] + .5 for previous, following in zip(positions, positions[1:])), f'手机夜访选项应逐行排列：{positions}'
                    report[-1]['stackedChoicesWhileHovered'] = True
            # 用真实 Tab 找到选项，Enter 提交，不用 focus() 或脚本点击。
            for _ in range(40):
                page.keyboard.press('Tab')
                if page.locator('[data-route-choice]:focus-visible').count():
                    break
            focused = page.locator('[data-route-choice]:focus-visible')
            assert focused.count() == 1, '键盘无法聚焦夜访选项'
            focus = focused.evaluate('node => { const s = getComputedStyle(node); return {style:s.outlineStyle, width:parseFloat(s.outlineWidth)}; }')
            assert focus['style'] != 'none' and focus['width'] >= 2, f'缺少可见聚焦框：{focus}'
            page.keyboard.press('Enter')
            page.locator('[data-route-story]').first.wait_for()
            assert page.evaluate('window.__game.state().phase') == 'route_aftermath'
            assert not errors, errors
            browser.close()
        return {'status':'PASS', 'runtimeDigestSha256':runtime_digest(), 'originalPortraits':True, 'originalArtSha256':original_art, 'keyboardChoice':True, 'checks':report}
    finally:
        server.terminate()
        server.wait(timeout=5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-evidence', action='store_true')
    args = parser.parse_args()
    command = 'python3 test/verify_readability.py' + (' --write-evidence' if args.write_evidence else '')
    path = EVIDENCE / 'readability.json'
    if args.write_evidence:
        write_json_atomic(path, {'status': 'FAIL', 'command': command, 'failure': '本次阅读验证尚未完成。'})
    result = {**run(), 'command': command}
    if args.write_evidence:
        write_json_atomic(path, result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
