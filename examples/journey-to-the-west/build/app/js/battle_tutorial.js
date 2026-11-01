// 首战渐进教学：只提示真实可见的操作，不代替玩家选择，也不参与战斗结算。

import { el } from './ui.js';

const TRIAL_LABELS = {
  ember: '假扇试探：先试小火',
  full: '假扇试探：直扇火口',
};

export function createBattleTutorial({ field, state, enabled, storySetup = {} }) {
  let firstCommandDone = false;
  let card = null;
  let body = null;

  function preparationLabel() {
    if (storySetup.approach === 'calm') {
      const buff = state.units.find((u) => u.side === 'party')?.buffs.find((b) => b.id === 'dmg_reduce');
      if (buff) return `稳阵生效：所受伤害 -${Math.round(buff.val * 100)}% · 前${buff.turns}回合`;
    }
    if (storySetup.approach === 'rush') {
      const wukong = state.units.find((u) => u.side === 'party' && u.id === 'p0');
      const buff = wukong?.buffs.find((b) => b.id === 'atk_up');
      if (buff) return `试刀生效：悟空攻击 +${Math.round(buff.val * 100)}% · 前${buff.turns}回合`;
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
    field.appendChild(card);
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
      setStep('command', '悟空属金，罗刹女属木。先点【攻击】，再亲手选择木行的罗刹女。');
    } else if (state.round === 2) {
      setStep('defend', '第二回合已恢复完整指令。【防御】使本回合所受伤害减半，并回复 10% 法力。');
    } else {
      destroy();
    }
  }

  function onMenu(unit) {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    setStep('command', `${unit.name}正在等号令：悟空金行克罗刹女木行，先点【攻击】；其余指令可随时展开。`);
  }

  function onCommandSelected(type) {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    if (type === 'attack') setStep('target', '攻击已选。点罗刹女选作目标，也可比较侍婢的五行再决定。');
    else if (type === 'skill') setStep('skill', '法术会消耗法力。可查看招式后返回，或照提示先用普通攻击。');
    else if (type === 'defend') setStep('defend-preview', '防御使本回合所受伤害减半，并回复 10% 法力；本回合也可以这样应战。');
  }

  function onTargetPicked(target) {
    if (!enabled || state.round !== 1 || firstCommandDone || !target) return;
    setStep('locked', `已选 ${target.name}。再为伙伴下令，随后按上方顺序逐个出手。`);
  }

  function completeCommand() {
    if (!enabled || state.round !== 1 || firstCommandDone) return;
    firstCommandDone = true;
    setStep('waiting-hit', '悟空已领命。接着安排伙伴，留意上方出手顺序。');
  }

  function destroy() {
    card?.remove();
    card = null;
    body = null;
  }

  return {
    beginRound,
    completeCommand,
    destroy,
    isFirstCommand: () => enabled && state.round === 1 && !firstCommandDone,
    onCommandSelected,
    onMenu,
    onTargetPicked,
  };
}
