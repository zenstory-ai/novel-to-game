// 首战渐进教学：只提示真实可见的操作，不代替玩家选择，也不参与战斗结算。

import { el } from './ui.js';

const TRIAL_LABELS = {
  ember: '试扇：小火',
  full: '试扇：火口',
};

export function createBattleTutorial({ field, state, enabled, storySetup = {} }) {
  let firstCommandDone = false;
  let card = null;
  let body = null;

  function preparationLabel() {
    if (storySetup.approach === 'calm') {
      const buff = state.units.find((u) => u.side === 'party')?.buffs.find((b) => b.id === 'dmg_reduce');
      if (buff) return `减伤 ${Math.round(buff.val * 100)}% · ${buff.turns}回合`;
    }
    if (storySetup.approach === 'rush') {
      const wukong = state.units.find((u) => u.side === 'party' && u.id === 'p0');
      const buff = wukong?.buffs.find((b) => b.id === 'atk_up');
      if (buff) return `攻击 +${Math.round(buff.val * 100)}% · ${buff.turns}回合`;
    }
    return null;
  }

  function ensureCard() {
    if (!enabled || card?.isConnected) return card;
    card = el('aside', 'battle-tutorial');
    card.id = 'battle-tutorial';
    card.dataset.step = 'intro';
    card.setAttribute('aria-live', 'polite');
    const kicker = el('div', 'battle-tutorial-kicker', '初战指引');
    body = el('div', 'battle-tutorial-body');
    const setup = el('div', 'battle-tutorial-setup');
    // 数值只读 createBattle 后的真实 buff；storySetup 只用于定位这次准备的来路。
    const labels = [preparationLabel(), TRIAL_LABELS[storySetup.fanTrial]].filter(Boolean);
    for (const label of labels) setup.append(el('span', 'battle-tutorial-chip', label));
    card.append(kicker, body);
    if (labels.length) card.append(setup);
    const host = field.parentElement ?? field;
    host.appendChild(card);
    host.classList.add('tutorial-active');
    return card;
  }

  function setStep(step, text) {
    if (!ensureCard()) return;
    card.dataset.step = step;
    body.textContent = text;
  }

  function beginRound() {
    if (!enabled) return;
    if (state.round === 1) {
      setStep('command', '金克木：点【攻击】，再选罗刹女。');
    } else if (state.round === 2) {
      setStep('defend', '完整指令已开放。【防御】伤害减半，回复 10% 法力。');
    } else {
      destroy();
    }
  }

  function onMenu(unit) {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    setStep('command', '金克木：点【攻击】，再选罗刹女。');
  }

  function onCommandSelected(type) {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    if (type === 'attack') setStep('target', '选罗刹女；目标旁会提示五行关系。');
    else if (type === 'skill') setStep('skill', '法术消耗法力；可返回改用攻击。');
    else if (type === 'defend') setStep('defend-preview', '防御：伤害减半，回复 10% 法力。');
  }

  function onTargetPicked(target) {
    if (!enabled || state.round !== 1 || firstCommandDone || !target) return;
    setStep('locked', `目标：${target.name}。继续安排伙伴。`);
  }

  function completeCommand() {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    firstCommandDone = true;
    setStep('waiting-hit', '悟空已领命 · 继续安排伙伴。');
  }

  function destroy() {
    card?.parentElement?.classList.remove('tutorial-active');
    card?.remove();
    card = null;
    body = null;
  }

  function setPreviewing(active) {
    if (!card?.isConnected) return;
    card.hidden = active;
  }

  return {
    beginRound,
    completeCommand,
    destroy,
    isFirstCommand: () => enabled && state.round === 1 && !firstCommandDone,
    onCommandSelected,
    onMenu,
    onTargetPicked,
    setPreviewing,
  };
}
