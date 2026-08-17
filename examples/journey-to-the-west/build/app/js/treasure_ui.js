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

function pickGuide(root) {
  return new Promise((resolve) => {
    const rows = Object.values(HUNT_GUIDES).map((guide) => {
      const row = el('div', 'hunt-guide-row');
      row.append(
        iconBadge(guide.key === 'wukong' ? '识' : guide.key === 'bajie' ? '掘' : '守'),
        el('div', '', `${guide.name} — ${guide.desc}`),
      );
      return row;
    });
    showModal(root, {
      id: 'modal-hunt-guide',
      title: '火脉残图 · 谁来探路',
      bodyNodes: [
        el('p', 'tutorial-line', '五行罗盘只报地脉，不报格中何物。先定探路者；他的本事会改写这一局。'),
        ...rows,
      ],
      buttons: Object.values(HUNT_GUIDES).map((guide) => ({
        label: guide.name,
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
    showModal(root, {
      id: 'modal-hunt-depth',
      title: '残图已明 · 收手还是深入',
      bodyNodes: [
        el('p', 'tutorial-line', `外层所得已在手：${itemsText({ ...state.bankedItems, ...state.carriedItems })}。`),
        el('p', 'tutorial-line', `此刻收手可把封炉余火凝成${settleReward}；深入会放弃这份独占稳收，换取大还丹与修炼心得。外层所得仍已护住。`),
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
    const button = el('button', `treasure-tile element-${tile.element}${revealed ? ' revealed' : ''}${danger ? ' danger-mark' : ''}`);
    button.type = 'button';
    button.dataset.treasureIndex = String(tile.index);
    button.dataset.element = tile.element;
    button.disabled = revealed || state.status !== 'playing';
    button.append(iconBadge(tile.element, { round: true }));
    const title = revealed ? tile.name : danger ? '火眼识破 · 妖穴' : `${tile.element}脉 · ${ELEMENT_COPY[tile.element]}`;
    const sub = revealed ? KIND_COPY[tile.kind] : danger ? '此处妖气最盛' : '点击掘开';
    button.append(el('span', 'treasure-tile-title', title), el('span', 'treasure-tile-sub', sub));
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
    const guide = el('div', 'treasure-guide', HUNT_GUIDES[visible.guide].name);
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
      el('div', 'treasure-haul', `护住：${itemsText(visible.bankedItems)} · 手中：${itemsText(visible.carriedItems)} · 残简 ${visible.bankedRelics + visible.carriedRelics}`),
    );

    const legend = el('div', 'treasure-legend');
    for (const [element, copy] of Object.entries(ELEMENT_COPY)) {
      const item = el('span', 'treasure-legend-item');
      item.append(iconBadge(element, { round: true, sm: true }), document.createTextNode(`${element}·${copy}`));
      legend.append(item);
    }

    const grid = el('div', `treasure-grid ${visible.layer}`);
    for (const tile of visible.tiles) grid.append(tileButton(tile));
    const note = el('div', 'treasure-note', visible.layer === 'outer'
      ? '五行只报倾向：同一火脉可能藏丹，也可能惊妖；不能仅凭明牌锁定陷阱。三掘后必须收手或深入。'
      : visible.guide === 'wukong'
        ? '火眼已从同类地脉里辨出真妖穴并盖上「识」印。这是五行明牌之外的新情报。'
        : '深层起步妖气一格；若涨满四格，只损失深层所得，外层宝物已经护住。');

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
