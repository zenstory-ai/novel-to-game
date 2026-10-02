// 火脉残图界面：五行明牌、连锁揭格、收手/深入与软失败。

import { ITEMS } from './data.js';
import { bgStyle } from './assets.js';
import { audio } from './audio.js';
import { addCorners, el, iconBadge, showModal } from './ui.js';
import {
  HUNT_GUIDES,
  createTreasureHunt,
  digTreasureTile,
  enterTreasureDepth,
  finishTreasureDepth,
  settleTreasureHunt,
  visibleTreasureState,
} from './treasure.js';

const ELEMENT_COPY = {
  金: '遗珍偏多',
  木: '连脉偏多',
  水: '丹药偏多',
  火: '躁脉难辨',
  土: '稳藏偏多',
};

const KIND_COPY = {
  supply: '得物资',
  relic: '得残简',
  vein: '连开邻格',
  trap: '妖气上涌',
  empty: '空穴',
};

// 探路者一人一句大白话(详细规则在 treasure.js 的 HUNT_GUIDES)
const GUIDE_PLAIN = {
  wukong: { short: '悟空', line: '悟空：深层能看穿哪一格是妖穴' },
  bajie: { short: '八戒', line: '八戒：每层白挖一格' },
  sha: { short: '沙僧', line: '沙僧：替你挡一次妖气' },
};

function pickGuide(root) {
  return new Promise((resolve) => {
    const rows = Object.values(HUNT_GUIDES).map((guide) => {
      const row = el('div', 'hunt-guide-row');
      row.append(
        iconBadge(guide.key === 'wukong' ? '识' : guide.key === 'bajie' ? '掘' : '守'),
        el('div', 'hunt-guide-line', GUIDE_PLAIN[guide.key]?.line ?? guide.desc),
      );
      return row;
    });
    showModal(root, {
      id: 'modal-hunt-guide',
      title: '谁来探路',
      bodyNodes: [
        el('p', 'tutorial-line', '残图上九处地脉，各标一个五行。外层挖三处，之后可以收手，也可以再往深处挖。'),
        ...rows,
      ],
      buttons: Object.values(HUNT_GUIDES).map((guide) => ({
        label: GUIDE_PLAIN[guide.key]?.short ?? guide.name,
        id: `hunt-guide-${guide.key}`,
        onClick: () => resolve(guide.key),
      })),
    });
  });
}

function itemsText(items) {
  const parts = Object.entries(items).map(([key, amount]) => `${ITEMS[key]?.name ?? key}×${amount}`);
  return parts.length ? parts.join('、') : '尚无';
}

function resultBody(result) {
  const growth = result.growth;
  const nodes = [
    el('p', 'hunt-result-lead', result.forcedRetreat
      ? '妖气冲破地层，只来得及护住外层所获；深层宝物尽失。'
      : result.deepened
        ? '探至火脉深层又全身而退，外层与深层所得一并归队。'
        : '见好就收，已得宝物分毫不少地带回队中。'),
    el('div', 'hunt-result-row', `道具：${itemsText(result.items)}`),
    el('div', 'hunt-result-row', `残简：${result.relics} · 化作 ${growth.potentialPoints} 点潜力`),
  ];
  if (growth.skillPoints) nodes.push(el('div', 'hunt-result-row rare', `深探心得：${HUNT_GUIDES[growth.unit].name} 修炼点 +${growth.skillPoints}`));
  return nodes;
}

export function startTreasureHunt(root, { seed, onState } = {}) {
  let state = null;
  let wrap = null;
  let closed = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  const publish = () => onState?.(state ? visibleTreasureState(state) : null);

  function cleanup() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onGridKey);
    wrap?.remove();
    publish();
  }

  function finish(result) {
    publish();
    showModal(root, {
      id: 'modal-hunt-result',
      title: result.forcedRetreat ? '妖气逼退 · 外藏保住' : result.deepened ? '深层得宝 · 满载而归' : '见好就收 · 携宝归队',
      bodyNodes: resultBody(result),
      buttons: [{
        label: '整装归队',
        id: 'hunt-return',
        onClick: () => {
          cleanup();
          resolveDone(result);
        },
      }],
    });
  }

  function showDepthChoice() {
    const visible = visibleTreasureState(state);
    const settleReward = itemsText(visible.safeSettleReward);
    // 外层所得与顶栏那行同一本账：已带回+还在洞里逐项相加，残简一并列上
    const outer = { ...visible.bankedItems };
    for (const [k, n] of Object.entries(visible.carriedItems)) outer[k] = (outer[k] ?? 0) + n;
    const relics = visible.bankedRelics + visible.carriedRelics;
    showModal(root, {
      id: 'modal-hunt-depth',
      title: '残图已明 · 收手还是深入',
      bodyNodes: [
        el('p', 'tutorial-line', `外层挖到：${[Object.keys(outer).length ? itemsText(outer) : '', relics > 0 ? `残简 ${relics}` : ''].filter(Boolean).join(' · ') || '尚无'}。`),
        el('p', 'tutorial-line', `收手：带着这些回去，另得一张${settleReward}。`),
        el('p', 'tutorial-line', '深入：外层所得先送回队里收好，再往深处挖两处，可得大还丹与修炼心得；妖气涨满只丢深处的东西。'),
      ],
      buttons: [
        { label: '见好就收', id: 'treasure-settle', onClick: () => finish(settleTreasureHunt(state)) },
        {
          label: '再探深层',
          id: 'treasure-deepen',
          onClick: () => {
            enterTreasureDepth(state);
            audio.sfx('transform');
            render();
          },
        },
      ],
    });
  }

  function showFinishDepth() {
    showModal(root, {
      id: 'modal-hunt-finish',
      title: '深层已探 · 妖气将合',
      bodyNodes: [el('p', 'tutorial-line', '再贪一步便是把运气当本事。带上深层所得，立刻回队。')],
      buttons: [{ label: '携宝归队', id: 'treasure-finish', onClick: () => finish(finishTreasureDepth(state)) }],
    });
  }

  function tileButton(tile) {
    const revealed = tile.revealed;
    const danger = tile.dangerMarked && !revealed;
    const button = el('button', `treasure-tile element-${tile.element}${revealed ? ' revealed' : ' sealed'}${danger ? ' danger-mark' : ''}`);
    button.type = 'button';
    button.dataset.treasureIndex = String(tile.index);
    button.dataset.element = tile.element;
    button.disabled = revealed || state.status !== 'playing';
    button.append(iconBadge(tile.element, { round: true }));
    // 未掘的格子只露五行印(含义看上方图例);掘开后才写是什么
    if (revealed) button.append(el('span', 'treasure-tile-title', tile.name), el('span', 'treasure-tile-sub', KIND_COPY[tile.kind]));
    else if (danger) button.append(el('span', 'treasure-tile-title', '妖穴'), el('span', 'treasure-tile-sub', '悟空看穿了'));
    button.title = revealed ? tile.name : `${tile.element}脉 · ${ELEMENT_COPY[tile.element]}`;
    button.addEventListener('click', () => {
      const beforeThreat = state.threat;
      const beforeRevealed = state.revealed[state.layer].length;
      digTreasureTile(state, tile.index);
      const revealedNow = state.revealed[state.layer].length - beforeRevealed;
      if (state.threat > beforeThreat) audio.sfx('thud');
      else if (revealedNow > 1) audio.sfx('skill');
      else audio.sfx('click');
      render();
      if (state.status === 'finished') finish(state.result);
      else if (state.layer === 'outer' && visibleTreasureState(state).canChooseDepth) showDepthChoice();
      else if (state.layer === 'deep' && visibleTreasureState(state).canFinishDepth) showFinishDepth();
    });
    return button;
  }

  function render() {
    if (!wrap || !state) return;
    const visible = visibleTreasureState(state);
    const panel = wrap.querySelector('.treasure-panel');
    panel.textContent = '';
    addCorners(panel);

    const head = el('div', 'treasure-head');
    const title = el('div', 'treasure-title', visible.layer === 'outer' ? '火脉残图 · 炉砖外藏' : '火脉残图 · 妖穴深层');
    const guide = el('div', 'treasure-guide', state.status === 'preview' ? '尚未选人' : `${GUIDE_PLAIN[visible.guide]?.short ?? ''}探路`);
    head.append(title, guide);

    const status = el('div', 'treasure-status');
    const threat = el('div', 'treasure-meter');
    threat.append(el('span', '', '妖气'));
    for (let i = 0; i < visible.maxThreat; i += 1) {
      threat.append(el('i', i < visible.threat ? 'on' : ''));
    }
    status.append(
      el('div', 'treasure-digs', `掘数 ${visible.digsUsed}/${visible.digsLimit}`),
      threat,
      el('div', 'treasure-haul', `已带回：${itemsText(visible.bankedItems)} · 还在洞里：${itemsText(visible.carriedItems)} · 残简 ${visible.bankedRelics + visible.carriedRelics}`),
    );

    const legend = el('div', 'treasure-legend');
    for (const [element, copy] of Object.entries(ELEMENT_COPY)) {
      const item = el('span', 'treasure-legend-item');
      item.append(iconBadge(element, { round: true, sm: true }), document.createTextNode(copy));
      legend.append(item);
    }

    const grid = el('div', `treasure-grid ${visible.layer}`);
    for (const tile of visible.tiles) grid.append(tileButton(tile));
    const note = el('div', 'treasure-note', visible.layer === 'outer'
      ? '五行只说「多半」有什么：火脉也可能藏丹，金脉也可能惊妖。挖满三处后再定去留。'
      : visible.guide === 'wukong'
        ? '悟空看穿的妖穴已盖上「识」印，避开它挖。'
        : '妖气已有一格；涨满四格就得退，只丢深处挖到的东西。');

    panel.append(head, status, legend, grid, note);
    publish();
    const first = grid.querySelector('button:not(:disabled)');
    first?.focus({ preventScroll: true });
  }

  function onGridKey(event) {
    if (!wrap?.isConnected || document.querySelector('.modal-mask')) return;
    const buttons = [...wrap.querySelectorAll('.treasure-tile:not(:disabled)')];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement);
    let next = current < 0 ? 0 : current;
    if (event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'ArrowRight') next += 1;
    else if (event.key === 'ArrowUp') next -= 3;
    else if (event.key === 'ArrowDown') next += 3;
    else if (event.key === 'Enter' || event.key === ' ') {
      (buttons[current < 0 ? 0 : current])?.click();
      event.preventDefault();
      return;
    } else return;
    next = Math.max(0, Math.min(buttons.length - 1, next));
    buttons[next]?.focus({ preventScroll: true });
    event.preventDefault();
  }

  wrap = el('div', 'screen treasure-root');
  wrap.id = 'treasure-root';
  Object.assign(wrap.style, bgStyle('huoyan'));
  wrap.append(el('div', 'treasure-veil'));
  const panel = el('div', 'treasure-panel');
  wrap.append(panel);
  root.append(wrap);
  window.addEventListener('keydown', onGridKey);

  void (async () => {
    // 先把整张残图(扣着的九格)摆出来,再在它上面选探路者:选之前就看得见要挖的是什么
    state = createTreasureHunt(seed, 'wukong');
    state.status = 'preview';
    render();
    const guide = await pickGuide(root);
    if (closed) return;
    state = createTreasureHunt(seed, guide);
    audio.sfx('levelup');
    render();
  })();

  return {
    done,
    snapshot: () => (state ? visibleTreasureState(state) : null),
  };
}
