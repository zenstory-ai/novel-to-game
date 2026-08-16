import * as THREE from 'three';

import { NON_COLUMNAR_ROCK_LAYOUT } from './environment-layout.js';
import { createNonColumnarRockGeometry } from './rock-geometry.js';
import { createNonColumnarRockMaterial } from './rock-materials.js';
import { renderedRockObstacleCandidate, settleRockOnTerrain } from './rock-placement.js';

function makeNonColumnarRockFamilies(scene) {
  const familySpecs = [
    Object.freeze({
      family: 'fluvial-cobble',
      name: 'world.connected_route.rock-family.fluvial-cobbles',
      distribution: 'historical-high-flow-lag-now-immobile-under-present-brook',
      collisionRole: 'static-solid-historical-lag-clasts',
    }),
    Object.freeze({
      family: 'bedded-slab',
      name: 'world.connected_route.rock-family.bedded-glade-slabs',
      distribution: 'dry-glade-bowl-margin-bedding-exposure',
      collisionRole: 'static-solid-margin-slabs',
    }),
    Object.freeze({
      family: 'angular-talus',
      name: 'world.ridge-foot.rock-family.angular-talus',
      distribution: 'ridge-apron-downslope-talus-beyond-route',
      collisionRole: 'non-solid-beyond-navigation-boundary',
    }),
  ];
  const group = new THREE.Group();
  const tint = new THREE.Color();
  const dummy = new THREE.Object3D();
  const brookObstacleCandidates = [];
  familySpecs.forEach((spec) => {
    const placements = NON_COLUMNAR_ROCK_LAYOUT.filter(({ family }) => family === spec.family);
    const geometry = createNonColumnarRockGeometry(spec.family);
    const material = createNonColumnarRockMaterial(spec.family);
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const supportEvidence = [];
    placements.forEach((placement, index) => {
      supportEvidence.push(settleRockOnTerrain(dummy, geometry, placement));
      mesh.setMatrixAt(index, dummy.matrix);
      if (spec.family === 'fluvial-cobble') {
        brookObstacleCandidates.push(renderedRockObstacleCandidate(
          placement.id,
          placement.transportClass,
          geometry,
          dummy.matrix,
        ));
        tint.setHSL(0.39 + index * 0.004, 0.045, 0.49 + (index % 3) * 0.022);
      } else if (spec.family === 'bedded-slab') {
        // The slab is dry brown-grey bedrock. The former 0.65 lightness made
        // the large eastern instance read as an unweathered chalk capsule.
        tint.setHSL(0.085 + index * 0.003, 0.085, 0.42 + (index % 2) * 0.022);
      } else {
        tint.setHSL(0.075 + index * 0.004, 0.12, 0.57 + (index % 3) * 0.035);
      }
      mesh.setColorAt(index, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.name = spec.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.family = spec.family;
    mesh.userData.collisionRole = spec.collisionRole;
    mesh.userData.supportEvidence = Object.freeze(supportEvidence);
    group.add(mesh);
  });
  group.name = 'world.authored-non-columnar-rock-families';
  group.userData.profile = 'three-geology-specific-non-columnar-rock-families';
  group.userData.brookObstacleCandidates = Object.freeze(brookObstacleCandidates);
  scene.add(group);
  return group;
}
export {
  createFracturedBasaltGeometry,
  createNonColumnarRockGeometry,
  createWeatheredRockGeometry,
} from './rock-geometry.js';
export { basaltDetailTextures, rockTextures } from './rock-materials.js';
export { renderedRockObstacleCandidate, settleRockOnTerrain } from './rock-placement.js';
export { makeNonColumnarRockFamilies };
