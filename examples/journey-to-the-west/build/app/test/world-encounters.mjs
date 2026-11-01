import assert from 'node:assert/strict';

import { resolveDemonPosition } from '../js/world-encounters.js';
import { SCENES } from '../js/world.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

const oldDemon = () => ({
  id: 'demon3_1', scene: 'huokou', x: 850, y: 300,
  battle: 'bounty_b', unit: 'mob_fire2', name: '火炎小校', seed: 987654321,
});

console.log('\n== 旧封妖坐标迁移 ==');

test('旧火口障碍坐标确定性迁移到当前合法刷新点', () => {
  const first = resolveDemonPosition(SCENES.huokou, oldDemon());
  const second = resolveDemonPosition(SCENES.huokou, oldDemon());
  assert.deepEqual([first.x, first.y], [second.x, second.y]);
  assert.ok(SCENES.huokou.demonSpawns.some(([x, y]) => x === first.x && y === first.y));
});

test('两张封妖地图的所有合法新坐标保持原对象与原位置', () => {
  for (const scene of [SCENES.village, SCENES.huokou]) {
    for (const [x, y] of scene.demonSpawns) {
      const demon = { ...oldDemon(), scene: scene.id, x, y };
      assert.equal(resolveDemonPosition(scene, demon), demon);
    }
  }
});

test('active bounty 迁移只替换坐标并保留环数、接取状态、战斗身份与随机种子', () => {
  const bounty = { ring: 2, round: 3, accepted: true, report: false, demon: oldDemon() };
  const original = structuredClone(bounty);
  bounty.demon = resolveDemonPosition(SCENES.huokou, bounty.demon);
  assert.deepEqual(
    { ...bounty, demon: { ...bounty.demon, x: original.demon.x, y: original.demon.y } },
    original,
  );
});

test('JSON 重载后的已迁移坐标保持稳定', () => {
  const migrated = resolveDemonPosition(SCENES.huokou, oldDemon());
  const loaded = JSON.parse(JSON.stringify(migrated));
  assert.equal(resolveDemonPosition(SCENES.huokou, loaded), loaded);
});

test('缺少明确刷新点时显式失败', () => {
  assert.throws(
    () => resolveDemonPosition({ ...SCENES.huokou, id: 'broken', demonSpawns: [] }, oldDemon()),
    /缺少 demonSpawns/,
  );
});

console.log(`\n封妖坐标迁移结果: ${passed} 通过, 0 失败`);
