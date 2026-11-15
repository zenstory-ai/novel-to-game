// 火脉残图的界面：选探路者 → 外层三掘 → 收手或深入两掘。规则在 rules/treasure.js。

import { h, clear, wait } from '../core/dom.js';
import { GUIDES, HUNT, createHunt, dig, settleSafe, goDeep, finishDeep, view, haulText } from '../rules/treasure.js';
import { ITEMS, PARTY } from '../data/combat.js';
import { uiArt, bgArt, faceStyle, ELEMENT_ICON } from '../data/art.js';
import { audio } from '../core/audio.js';

const itemsText = (items) => Object.entries(items).map(([k, n]) => `${ITEMS[k].name} ×${n}`).join('、') || '无';
const HINT = { 金: '多藏残简', 木: '多是连脉', 水: '多是药囊', 火: '藏丹，也伏妖', 土: '石匣或空腔' };

export function runHunt(stage, { seed, clue }) {
  return new Promise((resolve) => {
    const root = h('div.screen.hunt', { data: { ui: 'hunt' }, style: { backgroundImage: `url(${bgArt('huoyan')})` } });
    stage.append(root);
    let state = null;
    let lastLine = '';

    function pickGuide() {
      root.dataset.step = 'guide';
      clear(root).append(h('div.hunt-card.card', {},
        h('h2', {}, '火脉残图', h('small', {}, '残图上五脉交错。让谁走在前头探路？')),
        h('div.guides', {}, Object.values(GUIDES).map((g) => h('button.guide', { type: 'button', data: { guide: g.key }, onclick: () => start(g.key) },
          h('div.face', { style: faceStyle(PARTY[g.key].art) }), h('b', {}, g.name), h('em', {}, g.perk), h('span', {}, g.desc)))),
        h('p.muted', { style: { margin: 0, textAlign: 'center', fontSize: '13.5px' } }, clue ? '放归的火妖指过一条冷砖退路：外层头一回撞上妖穴，妖气不涨。' : '外层掘三处，再决定见好就收，还是往深处去。')));
    }

    function start(guide) {
      audio.sfx('quest');
      state = createHunt(seed, guide, { clue });
      lastLine = `${PARTY[guide].name}走在前头。未掘的地块只露五行：${Object.entries(HINT).map(([k, v]) => `${k}${v}`).join('；')}。`;
      render();
    }

    function narrate(events) {
      const lines = [];
      for (const e of events) {
        if (e.t === 'supply') lines.push(`翻出${itemsText(e.reward)}。`);
        else if (e.t === 'relic') lines.push(`得残简 ${e.amount} 卷。`);
        else if (e.t === 'vein') lines.push(e.next != null ? '地脉相连，顺势带开了旁边一块。' : '地脉相连，旁边却已无可揭之处。');
        else if (e.t === 'rake') lines.push('八戒的钉耙收不住，连旁边一块也翻了开来。');
        else if (e.t === 'trap') lines.push(`惊动妖穴！妖气涨了 ${e.amount} 格。`);
        else if (e.t === 'clue') lines.push('撞上妖穴——贴着冷砖走，避过了这一回。');
        else if (e.t === 'guard') lines.push('撞上妖穴——沙僧横杖挡下，妖气未涨。');
        else if (e.t === 'forced') lines.push('妖气合围！深处所得尽数丢下，外层的已经护住。');
        else if (e.t === 'reveal' && e.kind === 'empty') lines.push('旧炉空腔，什么也没有。');
      }
      return lines.join('');
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
          ? [h('div.tname', {}, t.name), h('div.tsub', {}, t.kind === 'supply' ? itemsText(t.reward) : t.kind === 'relic' ? `残简 ${t.relics} 卷` : t.kind === 'vein' ? '连脉' : t.kind === 'trap' ? '妖穴' : '空')]
          : [h('img', { src: uiArt(ELEMENT_ICON[t.element]), alt: '' }), h('div.tname', {}, `${t.element}脉`), h('div.tsub', {}, HINT[t.element])];
        return h(`button.tile${t.open ? `.open.${t.kind}` : ''}${t.marked ? '.marked' : ''}`, { type: 'button', data: { tile: t.index, el: t.element }, disabled: !canDig, onclick: () => onDig(t.index) }, inner);
      });
      const acts = [];
      if (state.status === 'finished') {
        acts.push(h('button.btn.primary', { type: 'button', data: { act: 'leave' }, onclick: () => finish(state.result) }, state.result.forced ? '撤出火脉' : '带着东西归队'));
      } else if (v.atFork) {
        acts.push(
          h('button.btn.qing', { type: 'button', data: { act: 'settle' }, onclick: () => { settleSafe(state); lastLine = '收手。封炉的余火凝成一张避火符，连同手中所得一并带走。'; render(); } }, h('span', {}, '见好就收', h('small', {}, '保住手中所得，另得一张避火符（深处拿不到）'))),
          h('button.btn.primary', { type: 'button', data: { act: 'deep' }, onclick: () => { goDeep(state); audio.sfx('portal'); lastLine = `外层所得已护住。深处只有六块地，再掘两处；妖气满 ${HUNT.maxThreat} 格就得撤，只丢深处的东西。${state.guide === 'wukong' ? '火眼金睛看得分明：标了「妖穴」的两处碰不得。' : ''}`; render(); } }, h('span', {}, '封存所得，往深处去', h('small', {}, '放弃避火符；探完必得大还丹与一重修炼心得'))),
        );
      } else if (v.deepDone) {
        acts.push(h('button.btn.primary', { type: 'button', data: { act: 'finish' }, onclick: () => { finishDeep(state); lastLine = '深处探完，妖气还没围上来。得大还丹一枚、修炼心得一重。'; render(); } }, '收棒，出火脉'));
      }
      clear(root).append(h('div.hunt-card.card', {},
        h('h2', {}, `火脉残图 · ${layerName}`),
        h('div.hunt-top', {},
          h('div.hunt-stat', { data: { ui: 'threat' } }, h('b', {}, `妖气 ${v.threat} / ${v.maxThreat}`), h('div.threat', {}, Array.from({ length: v.maxThreat }, (_, i) => h(`i${i < v.threat ? '.on' : ''}`))), h('span.muted', {}, v.layer === 'deep' ? '满格即被逼退，只丢深处所得' : '外层不会被逼退，妖气会带进深处')),
          h('div.hunt-stat', {}, h('b', {}, `${layerName} · 第 ${Math.min(v.digs + 1, v.digLimit)} / ${v.digLimit} 掘`), h('span', {}, `探路：${GUIDES[v.guide].name}`), h('span.muted', {}, v.clueReady ? '冷砖退路：还能避一回' : v.shaReady ? '沙僧：还能挡一回' : GUIDES[v.guide].perk)),
          h('div.hunt-stat', {}, h('b', {}, '所得'), h('span', {}, `已护住：${haulText(v.banked, v.bankedRelics)}`), h('span', {}, `手中：${haulText(v.carried, v.carriedRelics)}`))),
        h('div.hunt-body', {}, h('div.hunt-grid', {}, tiles), h('div.hunt-side', {}, h('div.say', { role: 'status' }, lastLine), h('div.acts', {}, acts)))));
    }

    pickGuide();
  });
}
