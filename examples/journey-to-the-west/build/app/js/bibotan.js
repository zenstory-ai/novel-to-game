// 碧波潭·变螃蟹偷金睛兽(第60回):三个"改变可用动作"的节点,不做迷宫/收集品。
// 选错会被发现退回,重选即可(剧情状态,不算失败)。

import { TEXT } from './text.js';
import { el, showDialog, showModal } from './ui.js';
import { bgStyle } from './assets.js';
import { audio } from './audio.js';

export async function runBibotan(root, { fast = false } = {}) {
  root.querySelectorAll('.battle-root').forEach((n) => n.remove()); // 清掉初战底景
  const wrap = el('div', 'screen bibotan-root');
  wrap.id = 'bibotan-root';
  Object.assign(wrap.style, bgStyle('bibotan'));
  root.appendChild(wrap);
  audio.sfx('skill');

  await showDialog(root, TEXT.story.bibotanIntro);

  // 节点一:变什么潜入?(蟭蟟虫会被水流冲回;原形硬闯会被拦)
  for (;;) {
    const pick = await choice(wrap, TEXT.story.bibotanChoice1.title, TEXT.story.bibotanChoice1.options);
    if (pick === 'crab') {
      audio.sfx('transform');
      await showDialog(root, TEXT.story.bibotanCrabOk);
      break;
    }
    audio.sfx('thud');
    await showDialog(root, pick === 'insect' ? TEXT.story.bibotanInsectFail : TEXT.story.bibotanBruteFail);
  }
  // 节点二:如何接近宴席?(径直游入会被巡守拦回)
  for (;;) {
    const pick = await choice(wrap, TEXT.story.bibotanChoice2.title, TEXT.story.bibotanChoice2.options);
    if (pick === 'shift') {
      await showDialog(root, TEXT.story.bibotanShiftOk);
      break;
    }
    audio.sfx('thud');
    await showDialog(root, TEXT.story.bibotanRushFail);
  }
  // 节点三:偷!
  await choice(wrap, TEXT.story.bibotanChoice3.title, TEXT.story.bibotanChoice3.options);
  audio.sfx('levelup');
  await showDialog(root, TEXT.story.bibotanStealOk);
  wrap.remove();
}

function choice(root, title, options) {
  return new Promise((resolve) => {
    const body = el('div', 'choice-list');
    showModal(root, {
      id: 'modal-choice',
      title,
      bodyNodes: [body],
      buttons: options.map((o) => ({
        label: o.label,
        id: `choice-${o.key}`,
        onClick: () => resolve(o.key),
      })),
    });
  });
}
