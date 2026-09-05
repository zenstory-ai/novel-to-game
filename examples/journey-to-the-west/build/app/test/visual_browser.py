#!/usr/bin/env python3
"""画面重构回归：真实开局输入、常速回合与宽窄屏控件边界；不替代完整战役 QA。"""
import json
import os
from pathlib import Path
import socket

# 复用现有浏览器路径与本地服务，不加载存档或注入游戏状态。
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    os.environ['BASE_URL'] = f'http://127.0.0.1:{listener.getsockname()[1]}'
from qa_browser import BASE_URL, BrowserPath, PROJECT, ensure_server
from playwright.sync_api import sync_playwright

OUT = PROJECT / 'qa/evidence/visual-refresh'
OUT.mkdir(parents=True, exist_ok=True)


def bounds(page, selector):
    return page.locator(selector).evaluate_all('''els => els.filter(e => e.getClientRects().length && !e.disabled && !e.classList.contains('disabled')).map(e => {
      const r=e.getBoundingClientRect();
      const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {text:e.innerText, visible:r.x>=0 && r.y>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1, unobstructed:e===top || e.contains(top)};
    })''')


def main():
    server=ensure_server()
    evidence={'command':'python3 test/visual_browser.py','status':'NOT_RUN','viewports':[], 'errors':[], 'visuals':[f'qa/evidence/visual-refresh/{scene}-{size}.jpg' for scene in ('title','dialogue','battle') for size in ('desktop','mobile')]}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch()
            evidence['browser']=browser.version
            for width,height in [(1440,900),(390,844)]:
                page=browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce' if width==390 else 'no-preference')
                page.on('pageerror',lambda error:evidence['errors'].append(str(error)))
                page.on('console',lambda message:evidence['errors'].append(message.text) if message.type=='error' else None)
                page.on('response',lambda response:evidence['errors'].append(f'{response.status} {response.url}') if response.status>=400 else None)
                page.goto(BASE_URL+'/?seed=42')
                page.wait_for_selector('#btn-start')
                title=bounds(page,'.title-btn')
                assert title and all(item['visible'] and item['unobstructed'] for item in title), title
                page.screenshot(path=OUT/('title-mobile.jpg' if width==390 else 'title-desktop.jpg'),type='jpeg',quality=85)
                path=BrowserPath(page)
                page.click('#btn-start')
                page.wait_for_selector('#dialog')
                page.keyboard.press('Enter')
                page.wait_for_function("() => document.querySelector('.dlg-name')?.textContent === '唐僧'")
                # 真实读档输入不能重入尚未结束的剧情协程。
                page.click('#btn-system')
                page.click('#btn-load')
                assert page.locator('#dialog').count()==1
                assert page.locator('#dialog').get_attribute('data-idx')=='1'
                assert page.locator('.dlg-stage').count()==1
                page.locator('.toast').filter(has_text='先把这段话听完').wait_for()
                if page.locator('.topbar-dropdown').is_visible(): page.click('#btn-system')
                page.wait_for_timeout(2800)
                page.click('#btn-system')
                page.click('#btn-help')
                page.wait_for_selector('#modal-help')
                page.keyboard.press('Enter')
                assert page.locator('#modal-help').count()==0
                assert page.locator('#dialog').get_attribute('data-idx')=='1'
                dialogue=bounds(page,'#dialog')
                assert all(item['visible'] and item['unobstructed'] for item in dialogue), dialogue
                page.screenshot(path=OUT/('dialogue-mobile.jpg' if width==390 else 'dialogue-desktop.jpg'),type='jpeg',quality=85)
                path.click_dialogs()
                assert page.locator('.dlg-stage').count()==0
                page.wait_for_selector('#overworld-canvas')
                for actor in ('tudi','luosha'):
                    pos=page.evaluate(f"__game.npcScreenPos('{actor}')")
                    page.mouse.click(pos['x'],pos['y']);path.wait_dialog_then_clear()
                page.wait_for_selector('#btn-tutorial-ok');page.click('#btn-tutorial-ok')
                page.wait_for_selector('.cmd-btn[data-cmd="auto"]')
                page.wait_for_timeout(1600)
                controls=bounds(page,'.cmd-btn, #btn-battle-formation')
                assert controls and all(item['visible'] and item['unobstructed'] for item in controls), controls
                page.screenshot(path=OUT/('battle-mobile.jpg' if width==390 else 'battle-desktop.jpg'),type='jpeg',quality=85)
                motion=page.evaluate('''() => ({requested:matchMedia('(prefers-reduced-motion: reduce)').matches, duration:getComputedStyle(document.querySelector('.unit-card.commanding .unit-portrait')).animationDuration})''')
                if width==390:
                    assert motion['requested'] and all(float(d.strip().removesuffix('s')) <= .001 for d in motion['duration'].split(',')), motion
                before=path.battle_state()
                # 真鼠标选择自动，等常速结算结束；只读钩子证明回合与体力变化。
                for _ in range(3):
                    page.locator('.cmd-btn[data-cmd="auto"]').click()
                    page.wait_for_timeout(150)
                page.wait_for_function('() => __game.battle.round > 1',timeout=30000)
                after=path.battle_state()
                hp_before={unit['id']:unit['hp'] for unit in before['units']}
                hp_changed=any(unit['hp'] != hp_before[unit['id']] for unit in after['units'])
                assert hp_changed, {'before':before,'after':after}
                evidence['viewports'].append({'viewport':[width,height],'title':title,'dialogue':dialogue,'dialogueRemoved':True,'commands':controls,'roundBefore':before['round'],'roundAfter':after['round'],'hpChanged':hp_changed,'motion':motion})
                page.close()
            browser.close()
        assert not evidence['errors'],evidence['errors']
        evidence['status']='PASS'
    finally:
        if evidence['status']!='PASS': evidence['status']='FAIL'
        (OUT/'report.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
        if server: server.terminate();server.wait(timeout=3)
    print('visual browser regression: '+evidence['status'])

if __name__=='__main__': main()
