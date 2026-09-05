import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  RIVER_ROOM_PROFILE,
  makeRiverRoomLandforms,
} from '../src/river-room-landforms.js';
import { NAVIGATION_BOUNDS } from '../src/collision-layout.js';
import { NAVIGATION } from '../src/simulation.js';

test('river room replaces the empty glade read without entering collision truth', () => {
  const obstacleContract = NAVIGATION.obstacles.map(({ id, x, z, radius }) => ({ id, x, z, radius }));
  const scene = new THREE.Scene();
  const riverRoom = makeRiverRoomLandforms(scene);
  const instanceMatrix = new THREE.Matrix4();

  assert.equal(riverRoom.name, 'world.river-room.incised-basin');
  assert.equal(riverRoom.userData.profile, RIVER_ROOM_PROFILE);
  assert.equal(
    riverRoom.children.filter((child) => child.isMesh && child.name.includes('terrace')).length,
    RIVER_ROOM_PROFILE.terraces,
  );
  assert.equal(riverRoom.children.filter((child) => child.name.includes('point-bar')).length, 2);
  assert.equal(riverRoom.children.filter((child) => child.name.includes('backwater')).length, 2);
  assert.equal(
    riverRoom.children.filter((child) => child.name.includes('meadow')).length,
    RIVER_ROOM_PROFILE.meadowMats + 1,
  );
  const meadowTufts = riverRoom.getObjectByName('world.river-room.meadow-tuft-masses');
  assert.equal(
    meadowTufts.children.reduce((count, mesh) => count + mesh.count, 0),
    RIVER_ROOM_PROFILE.meadowTufts,
  );
  const instanceScale = new THREE.Vector3();
  for (const mesh of meadowTufts.children) {
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, instanceMatrix);
      instanceScale.setFromMatrixScale(instanceMatrix);
      assert.ok(instanceScale.y <= 1.3, 'meadow blades must remain below the giant-prop range');
    }
  }
  assert.equal(
    riverRoom.getObjectByName('world.river-room.family-point-bar').material.color.getHex(),
    0x746f62,
  );
  assert.equal(
    riverRoom.getObjectByName('world.river-room.meadow-near-west').material.color.getHex(),
    0x586751,
  );
  assert.equal(riverRoom.userData.fernLibraryPlacements.length, RIVER_ROOM_PROFILE.libraryFerns);
  assert.equal(riverRoom.userData.canopyTreePlacements.length, RIVER_ROOM_PROFILE.terraceTrees);
  for (const placement of riverRoom.userData.canopyTreePlacements) {
    assert.ok(
      placement.x < NAVIGATION_BOUNDS.minX
        || placement.x > NAVIGATION_BOUNDS.maxX
        || placement.z < NAVIGATION_BOUNDS.minZ
        || placement.z > NAVIGATION_BOUNDS.maxZ,
      `authored canopy (${placement.x}, ${placement.z}) must stay beyond the playable rectangle`,
    );
  }

  const stillLife = riverRoom.getObjectByName('world.river-room.boundary-still-life');
  const instancePosition = new THREE.Vector3();
  for (const mesh of stillLife.children) {
    const expectedCount = mesh.name.includes('rock')
      ? RIVER_ROOM_PROFILE.boundaryRocks
      : RIVER_ROOM_PROFILE.boundaryDeadwood;
    assert.equal(mesh.count, expectedCount);
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, instanceMatrix);
      instancePosition.setFromMatrixPosition(instanceMatrix);
      assert.ok(
        instancePosition.x < NAVIGATION_BOUNDS.minX
          || instancePosition.x > NAVIGATION_BOUNDS.maxX,
        `${mesh.name} instance ${index} must stay beyond the lateral navigation edge`,
      );
    }
  }

  const eastTerrace = riverRoom.getObjectByName('world.river-room.east-red-earth-terrace');
  eastTerrace.geometry.computeBoundingBox();
  assert.ok(eastTerrace.geometry.boundingBox.max.y - eastTerrace.geometry.boundingBox.min.y > 4);
  assert.ok(eastTerrace.geometry.boundingBox.min.x > NAVIGATION_BOUNDS.maxX);
  for (const name of ['world.river-room.far-terrace-west', 'world.river-room.far-terrace-east']) {
    const terrace = riverRoom.getObjectByName(name);
    terrace.geometry.computeBoundingBox();
    assert.ok(terrace.geometry.boundingBox.max.z < NAVIGATION_BOUNDS.minZ);
  }
  assert.ok(
    riverRoom.getObjectByName('world.river-room.west-wet-terrace')
      .userData.authoredRiseMeters <= 0.3,
  );
  riverRoom.traverse((object) => {
    if (!object.isMesh) return;
    assert.match(object.userData.collisionRole, /^non-solid-/);
  });
  assert.deepEqual(
    NAVIGATION.obstacles.map(({ id, x, z, radius }) => ({ id, x, z, radius })),
    obstacleContract,
  );
});
