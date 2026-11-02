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
  const path = nav.findPath(...start, 319, 500);
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

test('通行区只取道路中心线的圆头宽度，并扣除角色足底半径', () => {
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[80, 200], [520, 200]], width: 120 }],
    clearance: 20,
    grid: 20,
  });
  assert.equal(nav.isPointWalkable(300, 200), true);
  assert.equal(nav.isPointWalkable(300, 159), false, '桥边留不下足底半径时不可走');
  assert.equal(nav.isPointWalkable(300, 100), false, '道路之外不可走');
  assert.equal(nav.isPointWalkable(60, 200), true, '圆头线帽应与绘制语义一致');
});

test('单点道路是圆形广场，建筑内和安全距离内均不可走', () => {
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[300, 200]], width: 360 }],
    blockers: [[[270, 170], [330, 170], [330, 230], [270, 230]]],
    clearance: 18,
    grid: 20,
  });
  assert.equal(nav.isPointWalkable(200, 200), true);
  assert.equal(nav.isPointWalkable(300, 200), false, '建筑内不可走');
  assert.equal(nav.isPointWalkable(255, 200), false, '不可贴着建筑足印走');
  assert.equal(nav.isPointWalkable(250, 200), true);
});

test('可视物件 footprint 边缘会为角色足圆留出安全距离', () => {
  const footprint = [-60, -40, 60, 0];
  const at = [300, 220];
  const [left, top, right, bottom] = footprint;
  const blocker = [[at[0] + left, at[1] + top], [at[0] + right, at[1] + top],
    [at[0] + right, at[1] + bottom], [at[0] + left, at[1] + bottom]];
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[300, 200]], width: 500 }],
    blockers: [blocker],
    clearance: 18,
    grid: 20,
  });
  for (const point of [[300, 163], [300, 237], [223, 200], [377, 200]]) {
    assert.equal(nav.isPointWalkable(...point), false, `${point.join(',')} 不应让足圆擦入物件边缘`);
  }
  for (const point of [[300, 161], [300, 239], [221, 200], [379, 200]]) {
    assert.equal(nav.isPointWalkable(...point), true, `${point.join(',')} 已在安全距离外`);
  }
});

test('小于角色直径的窄门不能挤过去', () => {
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[60, 200], [540, 200]], width: 360 }],
    blockers: [
      [[280, 20], [320, 20], [320, 185], [280, 185]],
      [[280, 215], [320, 215], [320, 380], [280, 380]],
    ],
    clearance: 18,
    grid: 20,
  });
  assert.deepEqual(nav.findPath(100, 200, 500, 200), []);
});

test('两个合法格中心之间不能用拉直路线擦墙', () => {
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[60, 200], [540, 200]], width: 360 }],
    blockers: [[[280, 180], [320, 180], [320, 240], [280, 240]]],
    clearance: 20,
    grid: 20,
  });
  assert.equal(nav.isPointWalkable(240, 165), true);
  assert.equal(nav.isPointWalkable(360, 165), true);
  assert.equal(nav.lineClear(240, 165, 360, 165), false);
});

test('道路胶囊并集之间不到两像素的断口也不能被采样跨过', () => {
  const nav = createNavigation({
    size: [240, 200],
    walk: [[0, 0], [240, 0], [240, 200], [0, 200]],
    paths: [
      { points: [[80, 100]], width: 40 },
      { points: [[121, 100]], width: 40 },
    ],
    grid: 20,
  });
  assert.equal(nav.isPointWalkable(80, 100), true);
  assert.equal(nav.isPointWalkable(121, 100), true);
  assert.equal(nav.lineClear(80, 100, 121, 100), false, '两圆之间 1px 断口应被精确识别');
});

test('精确起点只按真实几何验证，不被所在格的中心代替', () => {
  const nav = createNavigation({
    size: [600, 400],
    walk: [[0, 0], [600, 0], [600, 400], [0, 400]],
    paths: [{ points: [[80, 200], [520, 200]], width: 230 }],
    clearance: 18,
    grid: 28,
  });
  const start = [300, 104];
  assert.equal(nav.isPointWalkable(...start), true);
  assert.equal(nav.isWalkableCell(...nav.cellOf(...start)), false);
  const path = nav.findPath(...start, 500, 200);
  assert.ok(path.length > 0);
  assert.equal(nav.lineClear(...start, ...path[0]), true);
});

test('精确目标不会替换掉已验证的目标格中心而造成非法末段', () => {
  const nav = createNavigation({
    size: [400, 400],
    walk: [[0, 0], [400, 0], [400, 400], [0, 400]],
    paths: [{ points: [[30, 200], [370, 200]], width: 300 }],
    blockers: [[[180, 140], [220, 140], [220, 260], [180, 260]]],
    clearance: 18,
    grid: 28,
  });
  const start = [249.62075479328632, 131.44415066577494];
  const goal = [226.98197612538934, 276.84023193083704];
  const path = nav.findPath(...start, ...goal);
  assert.ok(path.length > 0);
  assert.deepEqual(path.at(-1), goal);
  let from = start;
  for (const point of path) {
    assert.equal(nav.lineClear(...from, ...point), true, `${from.join(',')} -> ${point.join(',')} 必须为合法路段`);
    from = point;
  }
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
      paths: scene.paths,
      blockers: scene.blockers,
      clearance: scene.clearance,
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

test('实际村庄路线在逐帧缩短后仍保持合法并到达精确终点', () => {
  const scene = SCENES.village;
  const nav = createNavigation({
    size: scene.size,
    walk: scene.walk,
    paths: scene.paths,
    blockers: scene.blockers,
    clearance: scene.clearance,
    scale: MAP_SCALE,
    grid: GRID,
  });
  let position = nav.normalizePoint(...scene.spawn.map((value) => value * MAP_SCALE));
  const goal = scene.landmarks.village_well.at.map((value) => value * MAP_SCALE);
  const path = nav.findPath(...position, ...goal);
  assert.ok(path.length > 0);
  for (const target of path) {
    while (Math.hypot(target[0] - position[0], target[1] - position[1]) > 4.5) {
      assert.equal(nav.lineClear(...position, ...target), true, '逐帧移动不应因重新采样同一路段而清路');
      const dx = target[0] - position[0];
      const dy = target[1] - position[1];
      const distance = Math.hypot(dx, dy);
      position = [position[0] + dx / distance * 4.5, position[1] + dy / distance * 4.5];
    }
    position = target;
  }
  assert.deepEqual(position, goal);
});

test('村庄初始队形归一化后仍在开阔街面，并能在首屏看到土地', () => {
  const scene = SCENES.village;
  const nav = createNavigation({
    size: scene.size, walk: scene.walk, paths: scene.paths, blockers: scene.blockers,
    clearance: scene.clearance, scale: MAP_SCALE, grid: GRID,
  });
  const spawn = nav.normalizePoint(...scene.spawn.map((value) => value * MAP_SCALE));
  const offsets = [[115, -22], [230, 20], [345, -18]];
  const followers = offsets.map(([behind, offsetY]) => nav.normalizePoint(spawn[0] - behind, spawn[1] + offsetY));
  for (const point of [spawn, ...followers]) {
    assert.ok(point);
    assert.equal(nav.isPointWalkable(...point), true);
  }
  const spawnLogical = spawn.map((value) => value / MAP_SCALE);
  assert.ok(Math.hypot(spawnLogical[0] - scene.npcs.tudi.at[0], spawnLogical[1] - scene.npcs.tudi.at[1]) < 700);
  const market = scene.scenery.find((item) => item.id === 'food-stall');
  const marketTop = market.at[1] - market.size[1] * market.anchor[1];
  assert.ok(followers[1][1] / MAP_SCALE < marketTop - scene.clearance, '八戒初始脚点不应落在摊棚屋面');
});

test('实际场景与待启用手绘场景的精确点位及人物交互落点都合法且可达', () => {
  const visualBlockerArts = new Set([
    'village-house','market','forge','shrine','tree','dead-tree',
    'cave','demon-gate','furnace','furnace-ruin','bamboo','banana',
  ]);
  for (const scene of Object.values(SCENES)) {
    const solidScenery = scene.scenery
      .filter((item) => item.solid !== false && item.footprint);
    const deriveBlockers = (painted) => solidScenery.map((item) => {
      const footprint = painted && visualBlockerArts.has(item.art)
        ? [-item.size[0] * item.anchor[0], -item.size[1] * item.anchor[1], item.size[0] * (1 - item.anchor[0]), item.size[1] * (1 - item.anchor[1])]
        : item.footprint;
      const [left, top, right, bottom] = footprint;
      return [[item.at[0] + left, item.at[1] + top], [item.at[0] + right, item.at[1] + top],
        [item.at[0] + right, item.at[1] + bottom], [item.at[0] + left, item.at[1] + bottom]];
    });
    const physicalBlockers = deriveBlockers(false);
    const paintedBlockers = deriveBlockers(true);
    assert.deepEqual(scene.physicalBlockers, physicalBlockers, `${scene.id} 应保留物理占地`);
    assert.deepEqual(scene.paintedBlockers, paintedBlockers, `${scene.id} 应预计算手绘视觉占地`);
    assert.deepEqual(scene.blockers, scene.terrain.painted ? paintedBlockers : physicalBlockers,
      `${scene.id} 应按地表模式选择视觉或物理占地`);

    const assertTargets = (blockers, mode) => {
      const nav = createNavigation({
        size: scene.size,
        walk: scene.walk,
        paths: scene.paths,
        blockers,
        clearance: scene.clearance,
        scale: MAP_SCALE,
        grid: GRID,
      });
      const start = scene.spawn.map((value) => value * MAP_SCALE);
      const assertPoint = (label, point) => {
        const target = point.map((value) => value * MAP_SCALE);
        assert.equal(nav.isPointWalkable(...target), true, `${scene.id} ${mode} ${label} 应在精确可走区内`);
        const path = nav.findPath(...start, ...target);
        assert.ok(path.length > 0, `${scene.id} ${mode} ${label} 应可达`);
        assert.ok(Math.hypot(path.at(-1)[0] - target[0], path.at(-1)[1] - target[1]) < 1,
          `${scene.id} ${mode} ${label} 不应被改落到远处`);
      };

      assertPoint('出生点', scene.spawn);
      for (const [id, point] of Object.entries(scene.arrivals ?? {})) assertPoint(`抵达点 ${id}`, point);
      for (const [id, portal] of Object.entries(scene.portals)) assertPoint(`出口 ${id}`, portal.at);
      for (const [id, landmark] of Object.entries(scene.landmarks ?? {})) assertPoint(`地标 ${id}`, landmark.at);
      for (const [index, point] of (scene.demonSpawns ?? []).entries()) assertPoint(`明雷刷新点 ${index}`, point);

      for (const [id, npc] of Object.entries(scene.npcs)) {
        assertPoint(`人物 ${id}`, npc.at);
        const [x, y] = npc.at.map((value) => value * MAP_SCALE);
        const candidates = [
          [x - 110, y + 14], [x + 110, y + 14], [x, y - 110], [x, y + 110],
        ];
        const path = findInteractionPath(nav, {
          from: start,
          target: [x, y],
          candidates,
          reach: 210,
        });
        assert.ok(path.length > 0, `${scene.id} ${mode} 人物 ${id} 应有真实可达且可视的交互落点`);
      }
    };

    assertTargets(scene.blockers, '当前地表');
    if (!scene.terrain.painted) assertTargets(scene.paintedBlockers, '待启用手绘地表');
  }
});

console.log(`\n行走寻路结果: ${passed} 通过, 0 失败`);
