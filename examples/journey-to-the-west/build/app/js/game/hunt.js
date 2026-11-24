// 火脉残图：视觉符号与语义色盘面，精简文字负担。规则在 rules/treasure.js。

import { h, clear, wait } from '../core/dom.js';
import { GUIDES, createHunt, dig, settleSafe, goDeep, finishDeep, view, haulText } from '../rules/treasure.js';
import { ITEMS, PARTY } from '../data/combat.js';
import { uiArt, bgArt, faceStyle, ELEMENT_ICON } from '../data/art.js';
import { audio } from '../core/audio.js';

const itemsText = (items) => Object.entries(items).map(([k, n]) => `${ITEMS[k].name}×${n}`).join('、') || '无';
const TAG = { 金: '残简', 木: '连脉', 水: '药囊', 火: '丹·妖', 土: '石匣' };

export function runHunt(stage, { seed, clue }) {
  return new Promise((resolve) => {
    const root = h('div.screen.hunt', { data: { ui: 'hunt' }, style: { backgroundImage: `url(${bgArt('huoyan')})` } });
    stage.append(root);
    let state = null;
    let lastLine = '';

    function pickGuide() {
      root.dataset.step = 'guide';
      clear(root).append(h('div.hunt-card.card', {},
        h('h2', {}, '火脉残图', h('small', {}, '择一人探路')),
        h('div.guides', {}, Object.values(GUIDES).map((g) => h('button.guide', { type: 'button', data: { guide: g.key }, onclick: () => start(g.key) },
          h('div.face', { style: faceStyle(PARTY[g.key].art) }), h('b', {}, g.name), h('em', {}, g.perk), h('span', {}, g.desc)))),
        clue && h('p.muted', { style: { margin: 0, textAlign: 'center', fontSize: '13.5px' } }, '冷砖退路：外层首避妖穴')));
    }

    function start(guide) {
      audio.sfx('quest');
      state = createHunt(seed, guide, { clue });
      lastLine = `${PARTY[guide].name}探路，择脉下掘。`;
      render();
    }

    function narrate(events) {
      const lines = [];
      for (const e of events) {
        if (e.t === 'supply') lines.push(`得${itemsText(e.reward)}`);
        else if (e.t === 'relic') lines.push(`得残简 ×${e.amount}`);
        else if (e.t === 'vein') lines.push(e.next != null ? '连脉带开邻格' : '邻格已开');
        else if (e.t === 'rake') lines.push('钉耙连翻邻格');
        else if (e.t === 'trap') lines.push(`惊妖穴，妖气 +${e.amount}`);
        else if (e.t === 'clue') lines.push('冷砖避过妖穴');
        else if (e.t === 'guard') lines.push('沙僧挡下妖气');
        else if (e.t === 'forced') lines.push('妖气满格！弃深层，保外层');
        else if (e.t === 'reveal' && e.kind === 'empty') lines.push('空腔无物');
      }
      return lines.join(' · ');
    }

    async function onDig(index) {
      const events = dig(state, index);
      if (!events.length) return;
      const kinds = events.map((e) => e.t);
      audio.sfx(kinds.includes('trap') || kinds.includes('forced') ? 'telegraph' : kinds.includes('supply') || kinds.includes('relic') ? 'coin' : 'thud');
      lastLine = narrate(events);
      render();
    }

    function finish(result) {
      root.dataset.step = 'done';
      audio.sfx('levelup', { volume: 0.6 });
      wait(120).then(() => { root.remove(); resolve(result); });
    }

    function render() {
      const v = view(state);
      root.dataset.step = state.status === 'finished' ? 'result' : v.layer;
      const layerName = v.layer === 'outer' ? '外层' : '深层';
      const tiles = v.tiles.map((t) => {
        const canDig = state.status === 'playing' && !t.open && v.digs < v.digLimit;
        const inner = t.open
          ? [h('div.tname', {}, t.name), h('div.tsub', {}, t.kind === 'supply' ? itemsText(t.reward) : t.kind === 'relic' ? `残简 ×${t.relics}` : t.kind === 'vein' ? '连脉' : t.kind === 'trap' ? '妖穴' : '空')]
          : [h('img', { src: uiArt(ELEMENT_ICON[t.element]), alt: t.element }), h('div.tsub', {}, TAG[t.element])];
        return h(`button.tile${t.open ? `.open.${t.kind}` : ''}${t.marked ? '.marked' : ''}`, { type: 'button', data: { tile: t.index, el: t.element }, disabled: !canDig, title: t.open ? t.name : `${t.element}脉 · ${TAG[t.element]}`, onclick: () => onDig(t.index) }, inner);
      });
      const acts = [];
      if (state.status === 'finished') {
        acts.push(h('button.btn.primary', { type: 'button', data: { act: 'leave' }, onclick: () => finish(state.result) }, state.result.forced ? '撤出火脉' : '携物归队'));
      } else if (v.atFork) {
        acts.push(
          h('button.btn.qing', { type: 'button', data: { act: 'settle' }, onclick: () => { settleSafe(state); lastLine = '收手护物，凝得避火符 ×1。'; render(); } }, h('span', {}, '见好就收', h('small', {}, '保所得 · 得避火符'))),
          h('button.btn.primary', { type: 'button', data: { act: 'deep' }, onclick: () => { goDeep(state); audio.sfx('portal'); lastLine = state.guide === 'wukong' ? '外层已护。火眼已标两处妖穴。' : '外层已护。深层再掘两处，满妖气即撤。'; render(); } }, h('span', {}, '深入火脉', h('small', {}, '弃符 · 争大还丹+修炼'))),
        );
      } else if (v.deepDone) {
        acts.push(h('button.btn.primary', { type: 'button', data: { act: 'finish' }, onclick: () => { finishDeep(state); lastLine = '深探得手：大还丹 ×1、修炼 +1。'; render(); } }, '收棒归队'));
      }
      const shield = v.clueReady ? '退路避险' : v.shaReady ? '沙僧护持' : GUIDES[v.guide].perk;
      clear(root).append(h('div.hunt-card.card', {},
        h('h2', {}, `火脉残图 · ${layerName}`),
        h('div.hunt-top', {},
          h('div.hunt-stat', { data: { ui: 'threat' }, title: v.layer === 'deep' ? '妖气满格即被逼退，仅失深层所得' : '外层不逼退，妖气带入深层；深层满格即撤' },
            h('b', {}, `妖气 ${v.threat}/${v.maxThreat}`, h(`em.hunt-tag${v.layer === 'deep' ? '' : '.mild'}`, {}, v.layer === 'deep' ? '满格退层' : '深层满4撤')),
            h('div.threat', {}, Array.from({ length: v.maxThreat }, (_, i) => h(`i${i < v.threat ? '.on' : ''}`)))),
          h('div.hunt-stat', {}, h('b', {}, `${layerName} ${Math.min(v.digs + 1, v.digLimit)}/${v.digLimit} 掘`), h('span', {}, `${PARTY[v.guide].name} · ${shield}`)),
          h('div.hunt-stat', {}, h('b', {}, '所得'), h('span', {}, `已护：${haulText(v.banked, v.bankedRelics)}`), h('span', {}, `在手：${haulText(v.carried, v.carriedRelics)}`))),
        h('div.hunt-body', {}, h('div.hunt-grid', {}, tiles), h('div.hunt-side', {}, h('div.say', { role: 'status' }, lastLine), h('div.acts', {}, acts)))));
    }

    pickGuide();
  });
}
