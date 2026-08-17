import assert from 'node:assert/strict';

import {
  createTreasureHunt,
  digTreasureTile,
  enterTreasureDepth,
  finishTreasureDepth,
  settleTreasureHunt,
  visibleTreasureState,
} from '../js/treasure.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function digKinds(state, layer, kinds, count) {
  const indices = state.layers[layer]
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => kinds.includes(tile.kind))
    .slice(0, count)
    .map(({ index }) => index);
  assert.equal(indices.length, count, `缺少 ${kinds.join('/')} 地块`);
  for (const index of indices) digTreasureTile(state, index);
  return indices;
}

console.log('\n== 火脉残图：可复现短探索 ==');

test('同 seed、同探路者生成同一地脉', () => {
  const a = createTreasureHunt(302, 'wukong');
  const b = createTreasureHunt(302, 'wukong');
  assert.deepEqual(a.layers, b.layers);
});

test('不同 seed 改变地块次序', () => {
  const a = createTreasureHunt(302, 'wukong');
  const b = createTreasureHunt(303, 'wukong');
  assert.notDeepEqual(a.layers, b.layers);
});

test('五行明牌只报倾向，不能精确锁定陷阱', () => {
  const state = createTreasureHunt(302, 'wukong');
  const visible = visibleTreasureState(state);
  assert.deepEqual(new Set(visible.tiles.map((tile) => tile.element)), new Set(['金', '木', '水', '火', '土']));
  assert.ok(visible.tiles.every((tile) => tile.kind === null && tile.name === null));
  for (const layer of Object.values(state.layers)) {
    for (const trap of layer.filter((tile) => tile.kind === 'trap')) {
      assert.ok(layer.some((tile) => tile.element === trap.element && tile.kind !== 'trap'));
    }
  }
});

test('八戒每层第一掘免费翻开相邻地块', () => {
  const state = createTreasureHunt(302, 'bajie');
  digTreasureTile(state, 4);
  assert.ok(state.revealed.outer.length >= 2);
  assert.ok(state.events.some((entry) => entry.type === 'bajie_chain' && entry.layer === 'outer'));
});

test('沙僧挡住首次妖气反扑', () => {
  const state = createTreasureHunt(302, 'sha');
  const trap = state.layers.outer.findIndex((tile) => tile.kind === 'trap');
  digTreasureTile(state, trap);
  assert.equal(state.threat, 0);
  assert.ok(state.events.some((entry) => entry.type === 'guard'));
});

test('外层三掘后可见好就收，所得进入结算', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply'], 2);
  digKinds(state, 'outer', ['relic'], 1);
  const result = settleTreasureHunt(state);
  assert.equal(result.deepened, false);
  assert.ok(Object.values(result.items).reduce((sum, amount) => sum + amount, 0) >= 2);
  assert.equal(result.growth.potentialPoints, 1);
  assert.equal(result.growth.skillPoints, 0);
});

test('任何局面收手都可凝成深探无法同时取得的避火符', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply', 'relic', 'empty'], 3);
  assert.equal(state.threat, 0);
  assert.deepEqual(visibleTreasureState(state).safeSettleReward, { bihuofu: 1 });
  const result = settleTreasureHunt(state);
  assert.equal(result.items.bihuofu, 1);
  assert.deepEqual(result.events.find((entry) => entry.type === 'safe_settle').reward, { bihuofu: 1 });

  const deepState = createTreasureHunt(302, 'wukong');
  digKinds(deepState, 'outer', ['supply', 'relic', 'empty'], 3);
  enterTreasureDepth(deepState);
  assert.deepEqual(visibleTreasureState(deepState).safeSettleReward, {});
  assert.ok(!deepState.events.some((entry) => entry.type === 'safe_settle'));
  assert.ok(deepState.layers.deep.every((tile) => tile.reward?.bihuofu === undefined));
});

test('深入放弃收手避火符，保留独占的大还丹与修炼收益', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply', 'relic', 'empty'], 3);
  assert.deepEqual(visibleTreasureState(state).safeSettleReward, { bihuofu: 1 });
  enterTreasureDepth(state);
  digKinds(state, 'deep', ['supply', 'relic'], 2);
  const result = finishTreasureDepth(state);
  assert.equal(result.items.bihuofu, undefined);
  assert.equal(result.items.dahuandan, 1);
  assert.equal(result.growth.skillPoints, 1);
});

test('悟空深入后补充公开五行无法推出的真妖穴情报', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply', 'relic', 'empty'], 3);
  enterTreasureDepth(state);
  const visible = visibleTreasureState(state);
  const marked = visible.tiles.filter((tile) => tile.dangerMarked);
  assert.equal(marked.length, 2);
  assert.deepEqual(
    marked.map((tile) => tile.index).sort((a, b) => a - b),
    state.layers.deep.filter((tile) => tile.kind === 'trap').map((tile) => tile.index).sort((a, b) => a - b),
  );
  assert.ok(visible.tiles.every((tile) => tile.kind === null));
  for (const markedTile of marked) {
    assert.ok(visible.tiles.some((tile) => tile.element === markedTile.element && !tile.dangerMarked));
  }

  const publicState = createTreasureHunt(302, 'sha');
  digKinds(publicState, 'outer', ['supply', 'relic', 'empty'], 3);
  enterTreasureDepth(publicState);
  assert.ok(visibleTreasureState(publicState).tiles.every((tile) => !tile.dangerMarked));
});

test('深层两掘成功必得大还丹与修炼心得', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply', 'relic', 'empty'], 3);
  enterTreasureDepth(state);
  digKinds(state, 'deep', ['supply', 'relic'], 2);
  const result = finishTreasureDepth(state);
  assert.equal(result.forcedRetreat, false);
  assert.equal(result.items.dahuandan, 1);
  assert.equal(result.growth.skillPoints, 1);
  assert.ok(result.growth.potentialPoints >= 1);
});

test('残简全部化作潜力，不静默封顶', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['relic'], 2);
  digKinds(state, 'outer', ['supply'], 1);
  enterTreasureDepth(state);
  digKinds(state, 'deep', ['relic'], 1);
  digKinds(state, 'deep', ['supply'], 1);
  const result = finishTreasureDepth(state);
  assert.equal(result.relics, 4);
  assert.equal(result.growth.potentialPoints, 4);
});

test('深层妖气满格只丢深层所得，外层所得保留', () => {
  const state = createTreasureHunt(302, 'wukong');
  digKinds(state, 'outer', ['supply'], 2);
  digKinds(state, 'outer', ['relic'], 1);
  enterTreasureDepth(state);
  const outerItems = { ...state.bankedItems };
  digKinds(state, 'deep', ['trap'], 2);
  assert.equal(state.status, 'finished');
  assert.equal(state.result.forcedRetreat, true);
  assert.deepEqual(state.result.items, outerItems);
  assert.equal(state.result.growth.skillPoints, 0);
});

console.log(`\n火脉残图结果: ${passed} 通过, 0 失败`);
