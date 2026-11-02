// 明雷位置兼容：旧地图坐标只在无法正常接近交互时迁移到当前场景的已验证刷新点。

import { GRID, MAP_SCALE } from './world.js';
import { createNavigation, findInteractionPath } from './world-navigation.js';

const navigationCache = new WeakMap();

function navigationFor(scene) {
  let navigation = navigationCache.get(scene);
  if (!navigation) {
    navigation = createNavigation({
      size: scene.size,
      walk: scene.walk,
      paths: scene.paths,
      blockers: scene.blockers,
      clearance: scene.clearance,
      scale: MAP_SCALE,
      grid: GRID,
    });
    navigationCache.set(scene, navigation);
  }
  return navigation;
}

function canInteractAt(navigation, scene, point) {
  const from = scene.spawn.map((value) => value * MAP_SCALE);
  const target = point.map((value) => value * MAP_SCALE);
  if (!navigation.isPointWalkable(...target)) return false;
  const side = from[0] < target[0] ? -1 : 1;
  const candidates = [
    [target[0] + side * 110, target[1] + 14],
    [target[0] - side * 110, target[1] + 14],
    [target[0], target[1] - 110],
    [target[0], target[1] + 110],
  ];
  return findInteractionPath(navigation, { from, target, candidates, reach: 210 }).length > 0;
}

export function resolveDemonPosition(scene, demon) {
  if (!scene.demonSpawns?.length) throw new Error(`场景 ${scene.id} 缺少 demonSpawns`);
  const navigation = navigationFor(scene);
  if (canInteractAt(navigation, scene, [demon.x, demon.y])) return demon;
  const point = scene.demonSpawns.find((candidate) => canInteractAt(navigation, scene, candidate));
  if (!point) throw new Error(`场景 ${scene.id} 没有可交互的 demonSpawns`);
  return { ...demon, x: point[0], y: point[1] };
}
