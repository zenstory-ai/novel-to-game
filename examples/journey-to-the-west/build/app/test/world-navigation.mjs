import assert from 'node:assert/strict';

import { createNavigation, findInteractionPath } from '../js/world-navigation.js';
import { GRID, MAP_SCALE, SCENES } from '../js/world.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log('\n== 行走地图：障碍、断路与端点合法化 ==');

const outer = [[0, 0], [800, 0], [800, 600], [0, 600]];

test('矩形障碍会让路径绕行且每段不穿墙', () => {
  const nav = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[300, 120], [500, 120], [500, 480], [300, 480]]],
  });
  const path = nav.findPath(100, 300, 700, 300);
  assert.ok(path.length >= 2);
  let from = [100, 300];
  for (const point of path) {
    assert.equal(nav.lineClear(...from, ...point), true);
    from = point;
  }
  assert.ok(path.some(([, y]) => y < 120 || y > 480));
});

test('合法真实起点作为首段锚点，不会用格中心拉直穿墙', () => {
  const nav = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[300, 120], [500, 120], [500, 480], [300, 480]]],
  });
  const start = [20, 20];
  const path = nav.findPath(...start, 319, 514);
  assert.ok(path.length >= 2);
  let from = start;
  for (const point of path) {
    assert.equal(nav.lineClear(...from, ...point), true);
    from = point;
  }
});

test('障碍切断整张图时返回空路径', () => {
  const nav = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[380, 0], [420, 0], [420, 600], [380, 600]]],
  });
  assert.deepEqual(nav.findPath(100, 300, 700, 300), []);
});

test('对角相邻的可走格不会从封死墙角穿过', () => {
  const nav = createNavigation({
    size: [160, 160],
    walk: [[0, 0], [160, 0], [160, 160], [0, 160]],
    grid: 40,
    blockers: [
      [[40, 0], [80, 0], [80, 40], [40, 40]],
      [[0, 40], [40, 40], [40, 80], [0, 80]],
    ],
  });
  assert.deepEqual(nav.findPath(20, 20, 100, 100), []);
});

test('出生点与目标落进障碍时会归到最近可走格', () => {
  const nav = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[300, 200], [500, 200], [500, 400], [300, 400]]],
  });
  const spawn = nav.normalizePoint(400, 300);
  assert.ok(spawn);
  assert.equal(nav.isWalkableCell(...nav.cellOf(...spawn)), true);
  const path = nav.findPath(400, 300, 700, 500);
  assert.ok(path.length > 0);
  assert.deepEqual(path.at(-1), [700, 500]);
});

test('越界目标只落到边缘合法格，直线判定不会沿夹取格走出地图', () => {
  const nav = createNavigation({ size: [800, 600], walk: outer, grid: 20 });
  for (const target of [[-100, 300], [900, 300]]) {
    assert.equal(nav.lineClear(100, 300, ...target), false);
    const path = nav.findPath(100, 300, ...target);
    assert.ok(path.length > 0);
    const endpoint = path.at(-1);
    assert.equal(nav.isPointInBounds(...endpoint), true);
    assert.equal(nav.isWalkableCell(...nav.cellOf(...endpoint)), true);
    assert.notDeepEqual(endpoint, target);
  }
});

test('交互不会隔墙触发，并会绕到目标同侧的可视候选点', () => {
  const sealed = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[380, 0], [420, 0], [420, 600], [380, 600]]],
  });
  assert.deepEqual(findInteractionPath(sealed, {
    from: [100, 300], target: [440, 300], candidates: [[330, 300], [550, 300]], reach: 150,
  }), []);

  const routed = createNavigation({
    size: [800, 600], walk: outer, grid: 20,
    blockers: [[[300, 120], [500, 120], [500, 480], [300, 480]]],
  });
  const start = [100, 300];
  const target = [530, 300];
  const path = findInteractionPath(routed, {
    from: start, target, candidates: [[420, 300], [640, 300]], reach: 150,
  });
  assert.ok(path.length >= 2);
  let from = start;
  for (const point of path) {
    assert.equal(routed.lineClear(...from, ...point), true);
    from = point;
  }
  assert.ok(path.at(-1)[0] > 500);
  assert.equal(routed.lineClear(...path.at(-1), ...target), true);
});

test('四图尺寸下的支路夹障碍仍保持连通', () => {
  for (const [start, landmark] of [
    [[1080, 900], [520, 1160]],
    [[320, 1330], [1740, 1080]],
    [[210, 960], [1760, 1120]],
    [[180, 1390], [1940, 1210]],
  ]) {
    const nav = createNavigation({
      size: [2400, 1600],
      walk: [[40, 40], [2360, 40], [2360, 1560], [40, 1560]],
      blockers: [[[900, 500], [1500, 500], [1500, 1040], [900, 1040]]],
      grid: 28,
    });
    assert.ok(nav.findPath(...start, ...landmark).length > 0);
  }
});

test('实际场景的出生、人物、出口、抵达与地标均在同一可达分区', () => {
  for (const scene of Object.values(SCENES)) {
    const nav = createNavigation({
      size: scene.size,
      walk: scene.walk,
      blockers: scene.blockers,
      scale: MAP_SCALE,
      grid: GRID,
    });
    const start = scene.spawn.map((value) => value * MAP_SCALE);
    const targets = [
      ...Object.values(scene.npcs).map((npc) => npc.at),
      ...Object.values(scene.portals).map((portal) => portal.at),
      ...Object.values(scene.arrivals ?? {}),
      ...Object.values(scene.landmarks ?? {}).map((landmark) => landmark.at),
      ...(scene.demonSpawns ?? []),
    ];
    assert.ok(nav.normalizePoint(...start), `${scene.id} 出生点应有可走落点`);
    for (const target of targets) {
      assert.ok(
        nav.findPath(...start, target[0] * MAP_SCALE, target[1] * MAP_SCALE).length > 0,
        `${scene.id} 的 ${target.join(',')} 应从出生点可达`,
      );
    }
  }
});

test('实际场景的精确点位及人物两侧交互落点都合法且可达', () => {
  for (const scene of Object.values(SCENES)) {
    const nav = createNavigation({
      size: scene.size,
      walk: scene.walk,
      blockers: scene.blockers,
      scale: MAP_SCALE,
      grid: GRID,
    });
    const start = scene.spawn.map((value) => value * MAP_SCALE);
    const assertPoint = (label, point) => {
      const target = point.map((value) => value * MAP_SCALE);
      assert.equal(nav.isWalkableCell(...nav.cellOf(...target)), true, `${scene.id} ${label} 不应落在障碍内`);
      const path = nav.findPath(...start, ...target);
      assert.ok(path.length > 0, `${scene.id} ${label} 应可达`);
      assert.ok(Math.hypot(path.at(-1)[0] - target[0], path.at(-1)[1] - target[1]) < 1, `${scene.id} ${label} 不应被改落到远处`);
    };

    assertPoint('出生点', scene.spawn);
    for (const [id, point] of Object.entries(scene.arrivals ?? {})) assertPoint(`抵达点 ${id}`, point);
    for (const [id, portal] of Object.entries(scene.portals)) assertPoint(`出口 ${id}`, portal.at);
    for (const [id, landmark] of Object.entries(scene.landmarks ?? {})) assertPoint(`地标 ${id}`, landmark.at);
    for (const [index, point] of (scene.demonSpawns ?? []).entries()) assertPoint(`明雷刷新点 ${index}`, point);

    for (const [id, npc] of Object.entries(scene.npcs)) {
      assertPoint(`人物 ${id}`, npc.at);
      const [x, y] = npc.at.map((value) => value * MAP_SCALE);
      for (const side of [-1, 1]) {
        const target = [x + side * 110, y + 14];
        assert.equal(nav.isWalkableCell(...nav.cellOf(...target)), true, `${scene.id} 人物 ${id} 的侧向交互点不应落在障碍内`);
        const path = nav.findPath(...start, ...target);
        assert.ok(path.length > 0, `${scene.id} 人物 ${id} 的侧向交互点应可达`);
        assert.ok(Math.hypot(path.at(-1)[0] - x, path.at(-1)[1] - y) < 210, `${scene.id} 人物 ${id} 的交互终点应保持在触发距离内`);
      }
    }
  }
});

console.log(`\n行走寻路结果: ${passed} 通过, 0 失败`);
