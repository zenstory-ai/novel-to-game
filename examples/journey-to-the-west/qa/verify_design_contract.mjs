import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(resolve(here, 'design-contract.json'), 'utf8'));
const data = await import(resolve(here, '../build/app/js/data.js'));
const engine = readFileSync(resolve(here, '../build/app/js/engine.js'), 'utf8');

function number(pattern, label) {
  const match = engine.match(pattern);
  assert.ok(match, `未找到实现锚点：${label}`);
  return Number(match[1]);
}

const actual = {
  elementChain: Object.fromEntries(
    Object.entries(data.ELEMENTS).map(([key, value]) => [key, value.beats]),
  ),
  elementCoefficients: data.ELEMENT_COEF,
  formations: {
    tiangang: data.FORMATIONS.tiangang.mods,
    liuding: data.FORMATIONS.liuding.mods,
  },
  fieldRules: {
    firemobs: {
      kind: data.BATTLES.firemobs.fieldRule.kind,
      pct: data.BATTLES.firemobs.fieldRule.pct,
      element: data.BATTLES.firemobs.fieldRule.element,
      immuneElement: data.BATTLES.firemobs.fieldRule.immuneElement,
    },
    yumian: {
      kind: data.BATTLES.yumian.fieldRule.kind,
      unitKey: data.BATTLES.yumian.fieldRule.unitKey,
      count: data.BATTLES.yumian.fieldRule.count,
      reduce: data.BATTLES.yumian.fieldRule.reduce,
    },
  },
  finalBoss: {
    hp: data.ENEMIES.whitebull.base.hp,
    element: data.ENEMIES.whitebull.element,
    previousPhase: data.ENEMIES.niumowang.nextPhase,
  },
  growth: {
    pointsPerLevel: data.GROWTH.pointsPerLevel,
    skillPointsPerLevel: data.GROWTH.skillPointsPerLevel,
    skillRankCap: data.GROWTH.skillRankCap,
  },
  trueFan: {
    maxStages: number(/state\.fanStage >= (\d+)/, '真扇阶段上限'),
    stageTwoSpeed: number(/fanStage === 2[\s\S]{0,250}?spd_up', val: ([\d.]+)/, '二生风'),
    stageThreeRegen: number(/fanStage === 3[\s\S]{0,250}?regen', val: ([\d.]+)/, '三落雨回复'),
    stageThreeVulnerability: number(/fanStage === 3[\s\S]{0,600}?vulnerable', val: ([\d.]+)/, '三落雨破绽'),
  },
};

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.source, 'design/GAME_DESIGN.md');
assert.deepEqual(actual, contract.invariants);
console.log('设计契约：7 组关键不变量一致');
