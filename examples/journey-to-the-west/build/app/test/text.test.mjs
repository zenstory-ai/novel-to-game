import assert from 'node:assert/strict';
import { TEXT } from '../js/text.js';

const sceneContracts = {
  prologueIntro: [null, 'tang', 'bajie', 'wukong', 'sha'],
  tudiTalk: ['tudi', 'tudi', 'wukong', 'tudi', 'wukong', 'tudi'],
  tudiTalkAgain: ['tudi'],
  luoshaPre1: ['luosha', 'luosha', 'wukong', 'luosha', 'wukong', 'luosha', 'shibi'],
  blowAway: ['luosha', null, 'wukong', 'wukong'],
  lingji: ['lingji', 'wukong', 'lingji', 'lingji', 'lingji', 'wukong'],
  luoshaPre2: ['luosha', 'wukong', null, 'luosha'],
  luoshaPre2b: ['luosha', 'wukong', null, 'luosha'],
  luoshaMid: [null, 'luosha', 'wukong'],
  postBattle1: ['luosha', 'wukong', null, 'luosha', 'wukong'],
  preBattle2: [null, 'tudi', 'tudi', 'wukong', 'tudi'],
  postBattle2: ['wukong', 'tudi', 'tudi', 'bajie'],
  treasureIntro: ['tudi', 'wukong', 'sha'],
  preYumian: [null, 'wukong', 'bajie', 'sha'],
  yumianPre: ['yumian', 'wukong', 'yumian', 'yumian', 'yaojiang', 'wukong'],
  postYumian: ['yumian', 'niumowang', 'wukong', 'niumowang'],
  niu1Retreat: [null, 'niumowang', 'niumowang', 'wukong', 'wukong'],
  bibotanIntro: [null, 'wukong'],
  bibotanInsectFail: [null, 'wukong'],
  bibotanBruteFail: [null, 'wukong'],
  bibotanCrabOk: [null],
  bibotanRushFail: [null, 'wukong'],
  bibotanShiftOk: [null, null],
  bibotanStealOk: [null, 'wukong', null],
  pianzhen: [null, 'wukong', 'luosha', 'luosha', 'wukong', 'luosha', 'wukong', null],
  fanpian1: [null, 'fakeBajie', 'wukong'],
  fanpianCheck: ['fakeBajie', 'wukong', null, 'niumowang'],
  fanpianGive: [null, 'niumowang', 'wukong'],
  preBattle3: [null, 'bajie', 'tudi', 'sha', 'niumowang', 'niumowang'],
  godAssistDialog: [null, 'nezha', 'luosha', 'luosha', 'niumowang'],
  phase2: [null],
  ending: [null, 'luosha', null, null, null, null, null, null],
};

for (const [name, expectedWho] of Object.entries(sceneContracts)) {
  const scene = TEXT.story[name];
  assert.ok(Array.isArray(scene), `${name} should remain a dialogue scene`);
  assert.deepEqual(scene.map((line) => line.who ?? null), expectedWho, `${name} speaker order changed`);
  assert.ok(scene.every((line) => typeof line.text === 'string' && line.text.trim()), `${name} has empty copy`);
}

assert.deepEqual(Object.keys(TEXT.story.treasureReturn), ['safe', 'deep', 'forced']);
assert.deepEqual(
  Object.values(TEXT.story.treasureReturn).map(({ who }) => who),
  ['bajie', 'wukong', 'sha'],
);

const choiceKeys = {
  bibotanChoice1: ['insect', 'crab', 'brute'],
  bibotanChoice2: ['shift', 'rush'],
  bibotanChoice3: ['steal'],
  fanpianChoice: ['check', 'give'],
  treasureChoice: ['dingfengdan', 'bihuojin'],
  equipChoice: ['ruyibang_jing', 'suozijia', 'fengchiguan'],
};
for (const [name, keys] of Object.entries(choiceKeys)) {
  assert.deepEqual(TEXT.story[name].options.map(({ key }) => key), keys, `${name} branch keys changed`);
}

const placeholders = new Map();
function collectPlaceholders(value, path = 'TEXT') {
  if (typeof value === 'string') {
    const found = value.match(/\{[^}]+\}/g);
    if (found) placeholders.set(path, found);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => collectPlaceholders(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectPlaceholders(item, `${path}.${key}`);
  }
}
collectPlaceholders(TEXT);
assert.deepEqual(Object.fromEntries(placeholders), {
  'TEXT.ui.round': ['{n}'],
  'TEXT.ui.commandFor': ['{name}'],
  'TEXT.ui.autoSet': ['{name}'],
  'TEXT.ui.buffShow': ['{name}', '{turns}'],
  'TEXT.float.heal': ['{n}'],
  'TEXT.float.mpUp': ['{n}'],
  'TEXT.float.transform': ['{name}'],
  'TEXT.battle.telegraph': ['{name}', '{skill}'],
  'TEXT.battle.formationBtn': ['{name}'],
  'TEXT.fanMsgs.fallback': ['{name}'],
});

const joined = JSON.stringify(TEXT);
for (const required of [
  '金→木→土→水→火→金', '×1.5', '×0.66', '10%', '三回合', '≤40%',
  '五万', '定风丹', '避火锦', '一扇息火', '二扇生风', '三扇',
  '假扇', '越扇火越旺', '八卦炉', '捕妖绳', '碧波潭', '辟水金睛兽',
  '善财童子', '七十二变', '白牛真身', '【狂暴】', '四十九扇',
]) {
  assert.ok(joined.includes(required), `missing story or rule knowledge: ${required}`);
}

console.log('text contracts: structure, branch keys, placeholders, and gameplay knowledge preserved');
