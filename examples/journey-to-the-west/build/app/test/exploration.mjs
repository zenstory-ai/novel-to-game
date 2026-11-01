import assert from 'node:assert/strict';

import {
  EXPLORATIONS,
  commitExploration,
  explorationEntry,
} from '../js/exploration.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function campaign() {
  return { money: 100, items: {}, exploration: undefined };
}

console.log('\n== 四图支路探索 ==');

test('八处地点 id、所属场景与四处二选一固定', () => {
  assert.deepEqual(Object.keys(EXPLORATIONS).sort(), [
    'cuiyun_basket', 'cuiyun_grove', 'huokou_bricks', 'huokou_shelter',
    'jilei_camp', 'jilei_lookout', 'village_fields', 'village_well',
  ]);
  assert.deepEqual(EXPLORATIONS.village_well.options.map((option) => option.key), ['jinchuang', 'falidan']);
  assert.deepEqual(EXPLORATIONS.cuiyun_basket.options.map((option) => option.key), ['jinchuang', 'falidan']);
  assert.deepEqual(EXPLORATIONS.huokou_shelter.options.map((option) => option.key), ['bihuofu', 'jinchuang']);
  assert.deepEqual(EXPLORATIONS.jilei_camp.options.map((option) => option.key), ['buyaosheng', 'money20']);
  for (const [id, entry] of Object.entries(EXPLORATIONS)) {
    assert.equal(entry.scene, id.split('_')[0]);
  }
});

test('旧档缺少 exploration 时可正常首次提交', () => {
  const state = campaign();
  const result = commitExploration(state, 'village', 'village_well', 'jinchuang');
  assert.equal(result.ok, true);
  assert.deepEqual(explorationEntry(state, 'village_well'), { choice: 'jinchuang' });
  assert.equal(state.items.jinchuang, 1);
});

test('取消或非法选择不写状态也不发奖励', () => {
  const state = campaign();
  assert.deepEqual(commitExploration(state, 'village', 'village_well', null), { ok: false, reason: 'invalid-choice' });
  assert.equal(state.exploration, undefined);
  assert.deepEqual(state.items, {});
});

test('未知地点与跨场景提交被拒绝', () => {
  const state = campaign();
  assert.equal(commitExploration(state, 'village', 'missing', 'observe').reason, 'unknown-landmark');
  assert.equal(commitExploration(state, 'cuiyun', 'village_fields', 'observe').reason, 'wrong-scene');
  assert.equal(state.exploration, undefined);
});

test('同一地点只能结算一次且保留首次选择', () => {
  const state = campaign();
  assert.equal(commitExploration(state, 'cuiyun', 'cuiyun_basket', 'falidan').ok, true);
  assert.equal(commitExploration(state, 'cuiyun', 'cuiyun_basket', 'jinchuang').reason, 'already-visited');
  assert.equal(state.items.falidan, 1);
  assert.equal(state.items.jinchuang, undefined);
  assert.equal(explorationEntry(state, 'cuiyun_basket').choice, 'falidan');
});

test('观察点只记录理解，不增加物品银两或奖励计数', () => {
  const state = campaign();
  assert.equal(commitExploration(state, 'huokou', 'huokou_bricks', 'observe').ok, true);
  assert.equal(state.money, 100);
  assert.deepEqual(state.items, {});
  assert.deepEqual(state.exploration, { huokou_bricks: { choice: 'observe' } });
});

test('四处补给各自最多计一次并按选择给真实奖励', () => {
  const state = campaign();
  commitExploration(state, 'village', 'village_well', 'falidan');
  commitExploration(state, 'cuiyun', 'cuiyun_basket', 'jinchuang');
  commitExploration(state, 'huokou', 'huokou_shelter', 'bihuofu');
  commitExploration(state, 'jilei', 'jilei_camp', 'money20');
  assert.deepEqual(state.items, { falidan: 1, jinchuang: 1, bihuofu: 1 });
  assert.equal(state.money, 120);
  assert.equal(Object.keys(state.exploration).length, 4);
});

test('探索状态经过 JSON 存读后仍阻止重复领奖', () => {
  const state = campaign();
  commitExploration(state, 'jilei', 'jilei_camp', 'buyaosheng');
  const loaded = JSON.parse(JSON.stringify(state));
  assert.equal(commitExploration(loaded, 'jilei', 'jilei_camp', 'money20').reason, 'already-visited');
  assert.equal(loaded.items.buyaosheng, 1);
  assert.equal(loaded.money, 100);
});

console.log(`\n支路探索结果: ${passed} 通过, 0 失败`);
