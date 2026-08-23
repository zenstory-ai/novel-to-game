// 碧波潭·变螃蟹偷金睛兽(第60回):三个短判断节点,不做迷宫/收集品。
// 错误选择只演一次后由悟空自行纠正，避免零代价反复弹同一道题。

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

  // 节点一:变什么潜入?(判断一次;错了由悟空吸取信息后自行改法)
  const first = await choice(wrap, TEXT.story.bibotanChoice1.title, TEXT.story.bibotanChoice1.options);
  if (first !== 'crab') {
    audio.sfx('thud');
    await showDialog(root, first === 'insect' ? TEXT.story.bibotanInsectFail : TEXT.story.bibotanBruteFail);
  }
  audio.sfx('transform');
  await showDialog(root, TEXT.story.bibotanCrabOk);

  // 节点二:如何接近宴席?(同样只让错误提供一次信息,不要求重复提交正确答案)
  const second = await choice(wrap, TEXT.story.bibotanChoice2.title, TEXT.story.bibotanChoice2.options);
  if (second !== 'shift') {
    audio.sfx('thud');
    await showDialog(root, TEXT.story.bibotanRushFail);
  }
  await showDialog(root, TEXT.story.bibotanShiftOk);
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
