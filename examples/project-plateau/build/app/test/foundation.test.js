import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { RIDGE_SURFACE_PROFILE, SUN_DIRECTION, createAtmosphere } from '../src/atmosphere.js';
import { OVERHEAD_CLOUD_PROFILE } from '../src/overhead-cloud-field.js';
import {
  PRODUCT_BUDGET,
  SCENE_BUDGET,
  onePercentLowFps,
  percentile,
  seededRandom,
} from '../src/config.js';
import {
  CANOPY_WIND_PROFILE,
  PTERODACTYL_ATTACK_CYCLE_SECONDS,
  createWorld,
  loadOptionalAssetVisual,
  pterodactylAttackFlightState,
  pterodactylAttackPose,
  pterodactylWingBeat,
  terrainHeight,
} from '../src/world.js';
import {
  BASALT_FORMATION_LAYOUT,
  BROOK_BOULDER,
  COVER_RIPARIAN_TREE_LAYOUT,
  FLUVIAL_ROCK_TRANSPORT_PROFILE,
  HERO_GINGKO_LAYOUT,
  NON_COLUMNAR_ROCK_LAYOUT,
  VEGETATION_LAYOUT,
} from '../src/environment-layout.js';
import { NAVIGATION } from '../src/simulation.js';
import { BASALT_SHELF_ASSET } from '../src/basalt-shelf.js';
import { BROOK_OBSTACLE_FLOW_PROFILE } from '../src/brook-hydrology.js';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);

test('foundation exposes the locked viewport and performance budgets', () => {
  assert.deepEqual(PRODUCT_BUDGET.targetViewport, [1440, 900]);
  assert.deepEqual(PRODUCT_BUDGET.minimumViewport, [1280, 720]);
  assert.equal(PRODUCT_BUDGET.medianFps, 45);
  assert.equal(PRODUCT_BUDGET.onePercentLowFps, 30);
  assert.equal(PRODUCT_BUDGET.ttiMs, 8000);
});

test('optional asset fallback handles load failure without swallowing attachment invariants', async () => {
  let fallbackCalls = 0;
  const fallback = await loadOptionalAssetVisual({
    load: async () => { throw new Error('asset unavailable'); },
    attach: () => { throw new Error('must not attach'); },
    onLoadFailure(error) {
      fallbackCalls += 1;
      return { status: 'fallback', error: error.message };
    },
  });
  assert.deepEqual(fallback, { status: 'fallback', error: 'asset unavailable' });
  assert.equal(fallbackCalls, 1);

  await assert.rejects(
    loadOptionalAssetVisual({
      load: async () => ({ name: 'valid-template' }),
      attach: () => { throw new Error('support invariant failed'); },
      onLoadFailure() {
        fallbackCalls += 1;
        return { status: 'fallback' };
      },
    }),
    /support invariant failed/,
  );
  assert.equal(fallbackCalls, 1, 'attachment failures must fail closed');
});

test('procedural placement is deterministic for a recorded seed', () => {
  const first = seededRandom(139);
  const second = seededRandom(139);
  assert.deepEqual(
    Array.from({ length: 12 }, first),
    Array.from({ length: 12 }, second),
  );
});

test('representative scene contains all declared subject and pressure groups', () => {
  assert.equal(SCENE_BUDGET.adultIguanodons, 2);
  assert.equal(SCENE_BUDGET.youngIguanodons, 3);
  assert.ok(SCENE_BUDGET.pterodactyls >= 1);
  assert.equal(SCENE_BUDGET.ferns, 120);
  assert.ok(SCENE_BUDGET.groundCover >= 300);
  assert.equal(SCENE_BUDGET.bryophyteGround, 640);
  assert.equal(SCENE_BUDGET.forestFloorDetritus, 390);
  assert.ok(SCENE_BUDGET.distantTrees >= 120);
  assert.ok(SCENE_BUDGET.deadfall >= 12);
  assert.ok(SCENE_BUDGET.trees + SCENE_BUDGET.ferns >= 200);
});

test('every authored solid collider stays registered to the rendered object position', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  scene.updateMatrixWorld(true);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();

  for (const collider of NAVIGATION.obstacles) {
    let anchor;
    if (collider.category === 'living-subject') {
      anchor = world.family[collider.visualIndex];
      anchor.getWorldPosition(position);
    } else {
      anchor = scene.getObjectByName(collider.visualAnchor);
      assert.ok(anchor, `missing visual anchor for ${collider.id}: ${collider.visualAnchor}`);
      if (anchor.isInstancedMesh) {
        anchor.getMatrixAt(collider.visualIndex, matrix);
        position.setFromMatrixPosition(matrix).applyMatrix4(anchor.matrixWorld);
      } else if (collider.visualIndex !== null) {
        anchor.children[collider.visualIndex].getWorldPosition(position);
      } else {
        anchor.getWorldPosition(position);
      }
    }
    const visualX = collider.visualX ?? collider.x;
    const visualZ = collider.visualZ ?? collider.z;
    assert.ok(Math.hypot(position.x - visualX, position.z - visualZ) < 0.01, {
      collider: collider.id,
      colliderPosition: [visualX, visualZ],
      visualPosition: [position.x, position.z],
    });
  }
});

test('hero gingko is terrain-supported and its collision volume follows the visible trunk', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const anchor = scene.getObjectByName('world.landmark.fort-gingko');
  const snapshot = world.assetSnapshot().heroGingko;
  const collider = NAVIGATION.obstacles.find((obstacle) => obstacle.id === HERO_GINGKO_LAYOUT.id);

  assert.ok(anchor?.isGroup);
  assert.equal(anchor.position.x, HERO_GINGKO_LAYOUT.x);
  assert.equal(anchor.position.y, terrainHeight(HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z));
  assert.equal(anchor.position.z, HERO_GINGKO_LAYOUT.z);
  assert.equal(anchor.rotation.y, HERO_GINGKO_LAYOUT.rotation);
  assert.equal(anchor.scale.x, HERO_GINGKO_LAYOUT.scale);
  assert.equal(anchor.userData.supportModel, 'terrain-root-flare-to-trunk-to-crown');
  assert.equal(anchor.userData.fallback.visible, true);

  assert.ok(collider);
  assert.equal(collider.x, anchor.position.x);
  assert.equal(collider.z, anchor.position.z);
  assert.equal(collider.radius, HERO_GINGKO_LAYOUT.collisionRadius);
  assert.equal(collider.height, HERO_GINGKO_LAYOUT.collisionHeight);
  assert.equal(collider.visualAnchor, anchor.name);

  const centreY = anchor.position.y;
  const maximumGroundDelta = Math.max(...Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return Math.abs(terrainHeight(
      anchor.position.x + Math.cos(angle) * 1.1,
      anchor.position.z + Math.sin(angle) * 1.1,
    ) - centreY);
  }));
  assert.ok(maximumGroundDelta < 0.08, maximumGroundDelta);
  assert.equal(snapshot.provenance, 'project-original-deterministic-offline-authored-mesh');
  assert.equal(snapshot.supportModel, 'terrain-root-flare-to-trunk-to-crown');
  assert.deepEqual(snapshot.position, [HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z]);
  assert.equal(snapshot.fallbackVisible, true);
});

test('the family asset exposes two adults, three young and both authored behaviors', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const family = world.assetSnapshot().family;
  assert.equal(family.adults, 2);
  assert.equal(family.young, 3);
  assert.deepEqual(family.behaviors, ['graze', 'branch-pull', 'young-play']);
  assert.equal(family.branchPresent, true);

  world.update(1, false, { familyMoment: 'glade-branch-pull' });
  assert.equal(world.familySnapshot().moment, 'glade-branch-pull');
});

test('family actions remain planted while anatomical pivots and branch contact carry motion', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const young = world.family[2];
  world.update(2, false, { familyMoment: 'glade-young-play' });
  const firstYoungPose = {
    x: young.position.x,
    z: young.position.z,
    head: young.userData.rig.headPivot.rotation.z,
    tail: young.userData.rig.tailPivots.at(-1).rotation.y,
  };
  world.update(2.5, false, { familyMoment: 'glade-young-play' });
  assert.equal(young.position.x, young.userData.baseX, 'play must not slide the creature root');
  assert.equal(young.position.z, young.userData.baseZ, 'play must keep planted route contact');
  assert.ok(Math.abs(young.userData.rig.headPivot.rotation.z - firstYoungPose.head) > 0.02);
  assert.ok(Math.abs(young.userData.rig.tailPivots.at(-1).rotation.y - firstYoungPose.tail) > 0.02);

  const branch = scene.getObjectByName('subject.iguanodon_family.feeding_branch');
  const pullingAdult = world.family[1];
  world.update(3, false, { familyMoment: 'glade-branch-pull' });
  const firstBranch = branch.userData.branchPivot.rotation.z;
  const firstHead = pullingAdult.userData.rig.headPivot.rotation.z;
  world.update(3.72, false, { familyMoment: 'glade-branch-pull' });
  assert.ok(Math.abs(branch.userData.branchPivot.rotation.z - firstBranch) > 0.04);
  assert.ok(Math.abs(pullingAdult.userData.rig.headPivot.rotation.z - firstHead) > 0.06);

  const maximumPullSeconds = (Math.PI / 2 + Math.PI * 2) / 3.4;
  world.update(maximumPullSeconds, false, { familyMoment: 'glade-branch-pull' });
  assert.ok(
    world.familySnapshot().branchContactDistance < 0.65,
    `the branch tip must visibly meet the pulling adult's jaw: ${world.familySnapshot().branchContactDistance}m`,
  );
  world.update(maximumPullSeconds, true, { familyMoment: 'glade-branch-pull' });
  assert.ok(
    world.familySnapshot().branchContactDistance < 0.65,
    `reduced motion must preserve the authored jaw contact: ${world.familySnapshot().branchContactDistance}m`,
  );
});

test('pterodactyl attack reads as search, fold-dive and close attack from simulation time', () => {
  assert.equal(pterodactylAttackPose(0.38).stage, 'search');
  assert.equal(pterodactylAttackPose(0.72).stage, 'fold-dive');
  assert.equal(pterodactylAttackPose(1.1).stage, 'attack');
  assert.equal(pterodactylAttackPose(2.85).stage, 'pull-up');
  assert.ok(pterodactylAttackPose(0.72).approach > pterodactylAttackPose(0.38).approach + 0.2);
  assert.ok(pterodactylAttackPose(1.1).wingFold > 0.75);
  assert.ok(pterodactylAttackPose(2.85).approach < pterodactylAttackPose(2).approach * 0.25);

  const playerPosition = new THREE.Vector3(0, 0, 2);
  const flightSamples = [0.16, 0.48, 0.8, 1.1].map((attackClock) => (
    pterodactylAttackFlightState({
      attackClock,
      playerPosition,
      cameraRaised: false,
      familyMoment: null,
      reducedMotion: false,
    })
  ));
  assert.ok(flightSamples.every(({ position }) => position.y >= 6.2 && position.y <= 10.8));
  assert.ok(flightSamples.every(({ position }) => position.z >= -22.1 && position.z <= -7.7));
  for (let index = 1; index < flightSamples.length; index += 1) {
    assert.ok(flightSamples[index].position.y < flightSamples[index - 1].position.y);
    assert.ok(flightSamples[index].position.z > flightSamples[index - 1].position.z);
  }
  const segmentDirections = flightSamples.slice(1).map(({ position }, index) => (
    position.clone().sub(flightSamples[index].position).normalize()
  ));
  for (let index = 1; index < segmentDirections.length; index += 1) {
    assert.ok(
      segmentDirections[index].dot(segmentDirections[index - 1]) > 0.96,
      'the authored dive must not snap, reverse, or present the animal sideways',
    );
  }

  const loweredCameraFlight = pterodactylAttackFlightState({
    attackClock: 1.1,
    playerPosition,
    cameraRaised: false,
    familyMoment: 'glade-young-play',
    reducedMotion: false,
  });
  const raisedCameraFlight = pterodactylAttackFlightState({
    attackClock: 1.1,
    playerPosition,
    cameraRaised: true,
    familyMoment: 'glade-young-play',
    reducedMotion: false,
  });
  assert.ok(
    raisedCameraFlight.position.distanceTo(loweredCameraFlight.position) < 1e-9,
    'raising the field camera must not teleport the attacking pterodactyl',
  );
  assert.equal(raisedCameraFlight.approach, loweredCameraFlight.approach);

  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const primary = world.pterodactyls[0];
  const projectedShadow = scene.getObjectByName('threat.pterodactyl.projected-shadow');
  assert.equal(projectedShadow.geometry.userData.profile, 'moving-winged-ground-shadow');
  const contactShadows = scene.getObjectByName('subject.iguanodon_family.contact-shadows');
  assert.ok(contactShadows?.isGroup);
  assert.equal(contactShadows.children.length, 5);
  assert.ok(contactShadows.children.every((shadow) => shadow.userData.profile === 'tight-foot-contact-shadow'));
  world.update(20, false, {
    threatAwareness: 3,
    attackSeconds: 0.38,
    rifleRaised: true,
    playerPosition: { x: 0, z: 2 },
  });
  const searchPosition = primary.position.clone();
  const searchShadowPosition = projectedShadow.position.clone();
  assert.equal(projectedShadow.visible, true);
  world.update(20.72, false, {
    threatAwareness: 3,
    attackSeconds: 1.1,
    rifleRaised: true,
    playerPosition: { x: 0, z: 2 },
  });
  assert.equal(world.threatSnapshot().attackStage, 'attack');
  assert.ok(primary.position.y < searchPosition.y - 2.5);
  assert.ok(primary.position.z > searchPosition.z + 7);
  assert.ok(projectedShadow.position.distanceTo(searchShadowPosition) > 5);
  assert.ok(
    Math.hypot(projectedShadow.position.x, projectedShadow.position.z - 2)
      < Math.hypot(searchShadowPosition.x, searchShadowPosition.z - 2),
    'the projected shadow must sweep toward the player through the exposed corridor',
  );
  assert.ok(projectedShadow.material.opacity > 0.24);
  assert.ok(projectedShadow.scale.x > 2.2, 'the close strike shadow must fill the player read zone');
  assert.ok(world.threatSnapshot().attackProgress > 0.9);
  assert.ok(world.threatSnapshot().scale > 1.2, 'the close strike must read larger than the orbit silhouette');
  assert.ok(
    Math.abs(primary.userData.flightPose.bank) >= 0.08,
    'the strike needs a restrained bank without rolling the animal onto its side',
  );
  assert.ok(Math.abs(primary.position.x) > 1.8, 'the strike must graze the exposed route edge, not center on the player');
  assert.equal(world.pterodactyls[1].visible, false);
  assert.equal(world.pterodactyls[2].visible, false);

  const cycleBefore = pterodactylAttackFlightState({
    attackClock: PTERODACTYL_ATTACK_CYCLE_SECONDS - 1 / 120,
    attackOrigin: playerPosition,
    reducedMotion: false,
  });
  const cycleAfter = pterodactylAttackFlightState({
    attackClock: PTERODACTYL_ATTACK_CYCLE_SECONDS + 1 / 120,
    attackOrigin: playerPosition,
    reducedMotion: false,
  });
  assert.ok(
    cycleBefore.position.distanceTo(cycleAfter.position) < 0.25,
    'the authored attack review cycle must close without a world-space teleport',
  );
  const fallbackWorld = createWorld(new THREE.Scene());
  const fallbackThreat = fallbackWorld.pterodactyls[0];
  fallbackWorld.update(PTERODACTYL_ATTACK_CYCLE_SECONDS - 1 / 120, false, {
    threatAwareness: 3,
    playerPosition,
  });
  const fallbackCycleBefore = fallbackThreat.position.clone();
  fallbackWorld.update(PTERODACTYL_ATTACK_CYCLE_SECONDS + 1 / 120, false, {
    threatAwareness: 3,
    playerPosition,
  });
  assert.ok(
    fallbackThreat.position.distanceTo(fallbackCycleBefore) < 0.25,
    'the world fallback clock must use the same closed attack cycle',
  );

  const attackPositionWithRifle = primary.position.clone();
  const attackScaleWithRifle = primary.scale.x;
  world.update(20.72, false, {
    threatAwareness: 3,
    attackSeconds: 1.1,
    cameraRaised: true,
    familyMoment: 'glade-young-play',
    playerPosition: { x: 0, z: 2 },
  });
  assert.ok(
    primary.position.distanceTo(attackPositionWithRifle) < 1e-9,
    'the rendered attack position must remain continuous when the camera is raised',
  );
  assert.equal(primary.scale.x, attackScaleWithRifle);
  assert.equal(world.threatSnapshot().attackStage, 'attack');

  world.update(22.85, false, {
    threatAwareness: 3,
    attackSeconds: 2.85,
    rifleRaised: true,
    playerPosition: { x: 0, z: 2 },
  });
  assert.equal(world.threatSnapshot().attackStage, 'pull-up');
  assert.equal(projectedShadow.visible, true, 'the attack shadow must remain readable through pull-up');

  world.update(21, false, {
    threatAwareness: 2,
    familyMoment: 'glade-young-play',
    playerPosition: { x: 0, z: -5 },
  });
  const orbitPosition = primary.position.clone();
  const orbitScale = primary.scale.x;
  world.update(21, false, {
    threatAwareness: 2,
    cameraRaised: true,
    familyMoment: 'glade-young-play',
    playerPosition: { x: 0, z: -5 },
  });
  assert.ok(
    primary.position.distanceTo(orbitPosition) < 1e-9,
    'raising the field camera must not relocate an orbiting pterodactyl',
  );
  assert.equal(primary.scale.x, orbitScale);

  const worldLockedOrbit = primary.position.clone();
  world.update(21, false, {
    threatAwareness: 2,
    playerPosition: { x: 7.5, z: 11 },
  });
  assert.ok(
    primary.position.distanceTo(worldLockedOrbit) < 1e-9,
    'walking must not drag or teleport an orbiting pterodactyl through world space',
  );

  const transitionWorld = createWorld(new THREE.Scene());
  const transitionThreat = transitionWorld.pterodactyls[0];
  transitionWorld.update(10, false, {
    threatAwareness: 0,
    playerPosition: { x: 0, z: 0 },
    deltaSeconds: 1 / 60,
  });
  for (const [index, nextAwareness] of [1, 2].entries()) {
    const beforeTransition = transitionThreat.position.clone();
    transitionWorld.update(10 + (index + 1) / 60, false, {
      threatAwareness: nextAwareness,
      playerPosition: { x: index * 4, z: index * -3 },
      deltaSeconds: 1 / 60,
    });
    assert.ok(
      transitionThreat.position.distanceTo(beforeTransition) < 0.75,
      `orbit awareness ${nextAwareness - 1}->${nextAwareness} must remain frame-continuous`,
    );
  }

  world.update(24, false, {
    threatAwareness: 3,
    attackSeconds: 1.1,
    playerPosition: { x: 2, z: -4 },
  });
  const latchedAttackPosition = primary.position.clone();
  world.update(24, false, {
    threatAwareness: 3,
    attackSeconds: 1.1,
    playerPosition: { x: 12, z: 9 },
  });
  assert.ok(
    primary.position.distanceTo(latchedAttackPosition) < 1e-9,
    'an active dive must retain its entry anchor while the player moves',
  );
});

test('pterodactyl shadow crosses awareness 2 to 3 without a one-frame jump', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const shadow = scene.getObjectByName('threat.pterodactyl.projected-shadow');
  const frameSeconds = 1 / 60;
  const playerPosition = { x: 0, z: 2 };

  world.update(10, false, {
    threatAwareness: 2,
    playerPosition,
    deltaSeconds: frameSeconds,
  });
  const awarenessTwoPosition = shadow.position.clone();
  world.update(10 + frameSeconds, false, {
    threatAwareness: 3,
    attackSeconds: 0.38,
    playerPosition,
    deltaSeconds: frameSeconds,
  });
  const transitionPosition = shadow.position.clone();
  const transitionTarget = shadow.userData.targetPosition.clone();
  const transitionDelta = transitionPosition.distanceTo(awarenessTwoPosition);
  assert.ok(
    transitionDelta < 0.75,
    `awareness 2->3 shadow displacement must stay sub-frame-continuous: ${transitionDelta}`,
  );

  let previousDistance = transitionPosition.distanceTo(transitionTarget);
  for (let frame = 0; frame < 12; frame += 1) {
    world.update(10 + frameSeconds, false, {
      threatAwareness: 3,
      attackSeconds: 0.38,
      playerPosition,
      deltaSeconds: frameSeconds,
    });
    assert.ok(
      shadow.userData.targetPosition.distanceTo(transitionTarget) < 1e-9,
      'a fixed attack input must keep the projected-shadow target stable',
    );
    const distance = shadow.position.distanceTo(transitionTarget);
    assert.ok(
      distance < previousDistance,
      `projected shadow must approach its target monotonically: ${distance} < ${previousDistance}`,
    );
    previousDistance = distance;
  }
});

test('pterodactyl flight uses a visible asymmetric flap cycle instead of a static glide', () => {
  assert.ok(pterodactylWingBeat(0.35) > 0.26);
  assert.ok(pterodactylWingBeat(1.05) < -0.24);
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const primary = world.pterodactyls[0];
  const leftShoulder = primary.userData.rig.leftWing.shoulder;
  const rightShoulder = primary.userData.rig.rightWing.shoulder;

  world.update(0.35, false, { threatAwareness: 0, playerPosition: { x: 0, z: 0 } });
  const upperStroke = {
    left: leftShoulder.rotation.z,
    right: rightShoulder.rotation.z,
  };
  world.update(1.1, false, { threatAwareness: 0, playerPosition: { x: 0, z: 0 } });
  const lowerStroke = {
    left: leftShoulder.rotation.z,
    right: rightShoulder.rotation.z,
  };

  assert.ok(Math.abs(upperStroke.left - lowerStroke.left) >= 0.42);
  assert.ok(Math.abs(upperStroke.right - lowerStroke.right) >= 0.42);
  assert.ok(Math.sign(upperStroke.left) !== Math.sign(upperStroke.right));
  assert.ok(Math.sign(lowerStroke.left) !== Math.sign(lowerStroke.right));
});

test('pterodactyl body forward follows the actual orbit and attack travel tangent', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const primary = world.pterodactyls[0];
  const localForward = new THREE.Vector3(0, 0, -1);

  world.update(4, false, {
    threatAwareness: 0,
    playerPosition: { x: 0, z: 0 },
  });
  const orbitStart = primary.position.clone();
  const orbitForward = localForward.clone().applyQuaternion(primary.quaternion).normalize();
  world.update(4.02, false, {
    threatAwareness: 0,
    playerPosition: { x: 0, z: 0 },
  });
  const orbitTravel = primary.position.clone().sub(orbitStart).normalize();
  assert.ok(orbitForward.dot(orbitTravel) >= 0.96, {
    orbitForward: orbitForward.toArray(),
    orbitTravel: orbitTravel.toArray(),
  });

  // Let the world-space transition from orbit to the latched attack curve
  // finish before comparing the authored tangent.
  world.update(19.4, false, {
    threatAwareness: 3,
    attackSeconds: 0.1,
    playerPosition: { x: 0, z: 2 },
  });
  world.update(20, false, {
    threatAwareness: 3,
    attackSeconds: 0.7,
    rifleRaised: true,
    playerPosition: { x: 0, z: 2 },
  });
  const attackStart = primary.position.clone();
  const attackForward = localForward.clone().applyQuaternion(primary.quaternion).normalize();
  world.update(20.02, false, {
    threatAwareness: 3,
    attackSeconds: 0.72,
    rifleRaised: true,
    playerPosition: { x: 0, z: 2 },
  });
  const attackTravel = primary.position.clone().sub(attackStart).normalize();
  assert.ok(attackForward.dot(attackTravel) >= 0.94, {
    attackForward: attackForward.toArray(),
    attackTravel: attackTravel.toArray(),
  });
  assert.ok(attackForward.y < -0.2, 'a descending strike must pitch the head down');
  const attackUp = new THREE.Vector3(0, 1, 0).applyQuaternion(primary.quaternion).normalize();
  assert.ok(attackUp.y > 0.9, {
    attackUp: attackUp.toArray(),
    message: 'the attack must retain a stable vertical reference instead of rolling onto its side',
  });
});

test('atmosphere exposes layered humid depth rather than a flat sky backdrop', () => {
  const scene = new THREE.Scene();
  const atmosphere = createAtmosphere(scene);
  const sky = scene.getObjectByName('world.atmosphere.gradient-sky');
  const cloudVeil = scene.getObjectByName('world.atmosphere.cloud-veil');
  const cloudDeck = scene.getObjectByName('world.atmosphere.cloud-deck');
  const cloudBanks = scene.getObjectByName('world.atmosphere.cloud-banks');
  const farRidge = scene.getObjectByName('world.atmosphere.far-ridge');
  const nearRidge = scene.getObjectByName('world.atmosphere.near-ridge');
  assert.equal(sky.userData.profile, 'bounded-humid-display-sky');
  assert.deepEqual(sky.userData.sunDirection, SUN_DIRECTION.toArray());
  assert.equal(cloudDeck.material.type, 'ShaderMaterial');
  assert.equal(cloudDeck.material.transparent, true);
  assert.equal(cloudDeck.material.depthWrite, false);
  assert.equal(cloudDeck.userData.profile, 'world-space-shared-density-overhead-cloud-deck');
  assert.deepEqual(cloudDeck.userData.altitudeRangeMeters, [620, 840]);
  assert.equal(cloudDeck.userData.domainMeters, 2048);
  assert.equal(
    cloudDeck.material.userData.surface,
    'shared-density-overhead-cloud-underside',
  );
  assert.equal(
    cloudDeck.material.uniforms.densityMap.value.name,
    'world.atmosphere.overhead-cloud-density',
  );
  assert.equal(cloudVeil.material.type, 'ShaderMaterial');
  assert.equal(cloudVeil.material.transparent, true);
  assert.equal(cloudVeil.material.depthWrite, false);
  assert.equal(cloudVeil.userData.profile, 'high-broken-humidity-veil');
  assert.ok(cloudVeil.material.uniforms.layerOpacity.value < cloudDeck.material.uniforms.layerOpacity.value);
  assert.deepEqual(OVERHEAD_CLOUD_PROFILE.windVelocityMetersPerSecond, [1.05, 0.28]);
  atmosphere.userData.update(12, false);
  assert.equal(cloudVeil.material.uniforms.time.value, 12);
  assert.equal(cloudDeck.material.uniforms.time.value, 12);
  assert.deepEqual(
    atmosphere.userData.cloudFieldSnapshot().overheadCoupling.windOffsetMeters,
    [12.600000000000001, 3.3600000000000003],
  );
  atmosphere.userData.update(12, true);
  assert.equal(cloudVeil.material.uniforms.time.value, 0);
  assert.equal(cloudDeck.material.uniforms.time.value, 0);
  assert.deepEqual(
    atmosphere.userData.cloudFieldSnapshot().overheadCoupling.windOffsetMeters,
    [0, 0],
  );
  assert.ok(cloudBanks.isGroup);
  assert.equal(cloudBanks.userData.profile, 'raymarched-cumulus-volumes-with-puff-fallback');
  assert.equal(cloudBanks.userData.bankCount, 11);
  assert.equal(cloudBanks.userData.volumeCount, cloudBanks.userData.bankCount);
  assert.deepEqual(cloudBanks.userData.depthBandCounts, {
    nearHorizon: 6,
    farHorizon: 5,
  });
  assert.deepEqual(cloudBanks.userData.solarCoupling, {
    placement: 'anti-solar-northern-horizon-only',
    localDirectSunAttenuation: 0,
    reason: 'no-volume-crosses-the-local-sun-direction',
    maximumSunAlignment: -0.1768,
  });
  assert.equal(cloudBanks.userData.balancedSteps, 12);
  assert.equal(cloudBanks.userData.highSteps, 18);
  assert.equal(cloudBanks.userData.puffCount, 56);
  const cloudVolumes = scene.getObjectByName('world.atmosphere.cloud-volumes');
  const cloudFallback = scene.getObjectByName('world.atmosphere.cloud-puff-fallback');
  assert.ok(cloudVolumes.isGroup);
  assert.equal(cloudVolumes.userData.profile, 'bounded-raymarched-cumulus-volumes');
  assert.equal(cloudVolumes.userData.balancedSteps, 12);
  assert.equal(cloudVolumes.userData.highSteps, 18);
  assert.equal(cloudVolumes.children.length, cloudBanks.userData.bankCount);
  for (const bank of cloudVolumes.children) {
    assert.ok(bank.isMesh);
    assert.equal(bank.userData.profile, 'bounded-raymarched-cumulus-volume');
    assert.ok(['near-horizon', 'far-horizon'].includes(bank.userData.depthBand));
    assert.ok(bank.userData.antiSolarAlignment < 0);
    assert.ok(bank.userData.depthMeters >= 11.6);
    assert.deepEqual(bank.userData.stepCounts, { balanced: 12, high: 18 });
    assert.equal(bank.userData.extinctionPerMeter, 0.24);
    assert.equal(bank.geometry.userData.profile, 'bounded-cumulus-raymarch-domain');
    assert.equal(bank.material.type, 'ShaderMaterial');
    assert.equal(bank.material.side, THREE.BackSide);
    assert.equal(bank.material.transparent, true);
    assert.equal(bank.material.premultipliedAlpha, true);
    assert.equal(bank.material.depthWrite, false);
    assert.equal(bank.material.userData.surface, 'beer-lambert-single-scattering-cloud-volume');
    assert.deepEqual(bank.material.userData.physics, {
      medium: 'water-droplet-participating-medium',
      extinctionLaw: 'Beer-Lambert',
      lighting: 'height-ambient-plus-sun-ray-self-shadow',
      condensationBase: 'shared-lifting-condensation-level',
    });
  }
  assert.ok(cloudFallback.isInstancedMesh);
  assert.equal(cloudFallback.count, cloudBanks.userData.puffCount);
  assert.equal(cloudFallback.geometry.userData.profile, 'smooth-overlapping-cloud-puff');
  assert.equal(cloudFallback.geometry.attributes.color.itemSize, 3);
  assert.deepEqual(cloudBanks.userData.materialProfiles, {
    low: 'bounded-lit-cloud-puff-volume',
    balanced: 'twelve-step-beer-lambert-cloud-volume',
    high: 'eighteen-step-beer-lambert-cloud-volume',
  });
  assert.deepEqual(cloudBanks.userData.snapshot(), {
    profile: 'raymarched-cumulus-volumes-with-puff-fallback',
    volumeCount: 11,
    puffCount: 56,
    depthBandCounts: { nearHorizon: 6, farHorizon: 5 },
    solarCoupling: {
      placement: 'anti-solar-northern-horizon-only',
      localDirectSunAttenuation: 0,
      reason: 'no-volume-crosses-the-local-sun-direction',
      maximumSunAlignment: -0.1768,
    },
    stepCounts: { balanced: 12, high: 18 },
    physics: {
      medium: 'water-droplet-participating-medium',
      extinctionLaw: 'Beer-Lambert',
      lighting: 'height-ambient-plus-sun-ray-self-shadow',
      condensationBase: 'shared-lifting-condensation-level',
    },
  });
  const firstCloudBank = cloudVolumes.children[0];
  const [baseCloudX, baseCloudY, baseCloudZ] = firstCloudBank.userData.basePosition;
  atmosphere.userData.update(10, false, 'balanced');
  assert.ok(firstCloudBank.position.x > baseCloudX);
  assert.ok(firstCloudBank.position.z > baseCloudZ);
  assert.equal(firstCloudBank.material.uniforms.stepCount.value, 12);
  assert.ok(firstCloudBank.material.uniforms.windOffset.value.length() > 0);
  atmosphere.userData.update(10, true, 'balanced');
  assert.deepEqual(firstCloudBank.position.toArray(), [baseCloudX, baseCloudY, baseCloudZ]);
  assert.deepEqual(firstCloudBank.material.uniforms.windOffset.value.toArray(), [0, 0]);
  atmosphere.userData.update(4, false, 'low');
  assert.equal(cloudVolumes.visible, false);
  assert.equal(cloudFallback.visible, true);
  assert.equal(cloudDeck.visible, false);
  atmosphere.userData.update(4, false, 'high');
  assert.equal(cloudVolumes.visible, true);
  assert.equal(cloudFallback.visible, false);
  assert.equal(cloudDeck.visible, true);
  assert.equal(firstCloudBank.material.uniforms.stepCount.value, 18);
  const overheadSnapshot = atmosphere.userData.cloudFieldSnapshot().overheadCoupling;
  assert.equal(overheadSnapshot.version, 'world-space-overhead-cloud-and-sun-shadow-v1');
  assert.equal(overheadSnapshot.densityTexture.objectCount, 1);
  assert.deepEqual(overheadSnapshot.densityTexture.statistics, {
    minimum: 0.2031,
    maximum: 0.8381,
    mean: 0.5095,
    coverageFraction: 0.3456,
  });
  assert.deepEqual(overheadSnapshot.visibleLayer, {
    profile: 'world-space-shared-density-overhead-cloud-deck',
    drawCalls: 1,
    densitySamplesPerFragment: 5,
    replacesPreviousDeckDrawCall: true,
  });
  assert.equal(overheadSnapshot.shadow.additionalDrawCalls, 0);
  assert.equal(overheadSnapshot.shadow.collisionChange, 'none');
  assert.equal(overheadSnapshot.quality, 'high');
  assert.equal(
    atmosphere.userData.environmentLighting,
    'bounded-pmrem-physical-sky-dielectric-response',
  );
  for (const ridge of [farRidge, nearRidge]) {
    assert.equal(ridge.userData.profile, 'lit-eroded-terrain-ridge-volume');
    assert.ok(ridge.userData.depthMeters >= 58);
    assert.equal(ridge.userData.lighting, 'world-normal-directional-light-plus-exponential-aerial-fog');
    assert.equal(ridge.userData.collisionPolicy, 'non-interactive-terrain-beyond-navigation-boundary');
    assert.equal(ridge.geometry.userData.profile, 'world-space-eroded-ridge-heightfield');
    assert.deepEqual(ridge.geometry.userData.segments, [72, 12]);
    assert.equal(ridge.geometry.attributes.position.count, 73 * 13);
    assert.equal(ridge.geometry.attributes.normal.count, 73 * 13);
    assert.equal(ridge.geometry.attributes.uv.count, 73 * 13);
    assert.equal(ridge.geometry.attributes.ridgeDrainage.count, 73 * 13);
    assert.equal(ridge.geometry.attributes.ridgeExposedStone.count, 73 * 13);
    assert.equal(ridge.geometry.attributes.ridgeHeightFraction.count, 73 * 13);
    assert.ok(ridge.geometry.index.count >= 72 * 12 * 6);
    assert.ok(ridge.geometry.boundingBox.max.z - ridge.geometry.boundingBox.min.z >= 58);
    assert.ok(ridge.geometry.boundingBox.max.y > ridge.userData.peakRange[0]);
    assert.equal(ridge.material.type, 'MeshLambertMaterial');
    assert.equal(ridge.material.userData.surface, 'matte-aerial-weathered-ridge');
    assert.equal(ridge.material.userData.diffuseModel, 'Lambert');
    assert.equal(ridge.material.userData.processSurface, RIDGE_SURFACE_PROFILE);
    assert.equal(ridge.userData.surfaceMaterial, RIDGE_SURFACE_PROFILE);
    assert.equal(ridge.userData.forest.ridgeSurface, RIDGE_SURFACE_PROFILE);
    assert.equal(RIDGE_SURFACE_PROFILE.version, 'process-coupled-distant-ridge-surface-v2');
    assert.match(RIDGE_SURFACE_PROFILE.sourceModel, /normal-slope-aspect/);
    assert.equal(RIDGE_SURFACE_PROFILE.microDetailPeriodMeters, 9);
    assert.equal(RIDGE_SURFACE_PROFILE.maximumVegetatedSoilBlend, 0.46);
    assert.equal(RIDGE_SURFACE_PROFILE.maximumSlopeSubstrateBlend, 0.36);
    assert.equal(
      ridge.userData.sourceColour,
      ridge === nearRidge ? '#3c4a35' : '#394840',
    );
    const ridgeForest = ridge.getObjectByName(`${ridge.name}.vegetation`);
    assert.ok(ridgeForest?.isGroup);
    assert.equal(
      ridgeForest.userData.profile,
      'terrain-cohort-and-understory-sourced-ridge-forest-v5',
    );
    assert.equal(ridgeForest.children.length, 3);
    assert.ok(ridge.userData.forest.instanceCount >= (ridge === nearRidge ? 560 : 440));
    assert.equal(ridge.userData.forest.samplesPerSurfaceCell, 2);
    assert.equal(
      ridge.userData.forest.broadCrownCount + ridge.userData.forest.narrowCrownCount,
      ridge.userData.forest.instanceCount,
    );
    assert.ok(ridge.userData.forest.understoryCrownCount >= 160);
    assert.equal(
      ridge.userData.forest.totalCrownCount,
      ridge.userData.forest.instanceCount + ridge.userData.forest.understoryCrownCount,
    );
    assert.equal(ridge.userData.forest.drawCalls, 3);
    assert.equal(
      Object.values(ridge.userData.forest.crownArchitectureCounts)
        .reduce((total, count) => total + count, 0),
      ridge.userData.forest.totalCrownCount,
    );
    assert.ok(Object.values(ridge.userData.forest.crownArchitectureCounts).every((count) => count > 0));
    assert.ok(ridge.userData.forest.sourceDamagedCrownCount > 0);
    assert.equal(ridge.userData.forest.crownVariationAttribute, 'ridgeCrownVariation');
    assert.equal(ridge.userData.forest.broadCrownComponentCount, 20);
    assert.equal(ridge.userData.forest.broadCrownFoliageCohortCount, 11);
    assert.equal(ridge.userData.forest.broadCrownStructuralBranchCount, 9);
    assert.equal(ridge.userData.forest.broadCrownTriangleCount, 520);
    assert.equal(ridge.userData.forest.narrowCrownComponentCount, 5);
    assert.equal(ridge.userData.forest.narrowCrownFoliageCohortCount, 4);
    assert.equal(ridge.userData.forest.narrowCrownStructuralBranchCount, 1);
    assert.equal(ridge.userData.forest.narrowCrownTriangleCount, 500);
    assert.deepEqual(ridge.userData.forest.supportEvidence, {
      rootCount: ridge.userData.forest.instanceCount,
      supportedRootCount: ridge.userData.forest.instanceCount,
      supportRatio: 1,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.06,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    });
    assert.equal(
      ridge.userData.forest.crownAttachment,
      'closed-crown-base-overlaps-load-bearing-trunk-top',
    );
    assert.deepEqual(ridge.userData.forest.understorySupport, {
      rootCount: ridge.userData.forest.understoryCrownCount,
      supportedRootCount: ridge.userData.forest.understoryCrownCount,
      supportRatio: 1,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.045,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    });
    assert.equal(
      ridge.userData.forest.crownSurface,
      'closed-branch-supported-leaf-cohort-and-whorl-crowns-with-age-asymmetry-and-source-damage',
    );
    assert.equal(ridge.userData.forest.lighting, 'fogged-non-emissive-opaque-dielectric');
    const [trunks, broadCrowns, narrowCrowns] = ridgeForest.children;
    assert.equal(trunks.count, ridge.userData.forest.instanceCount);
    assert.equal(
      broadCrowns.count,
      ridge.userData.forest.broadCrownCount + ridge.userData.forest.understoryCrownCount,
    );
    assert.equal(narrowCrowns.count, ridge.userData.forest.narrowCrownCount);
    assert.equal(trunks.geometry.userData.profile, 'closed-low-poly-distant-trunk');
    assert.equal(trunks.geometry.userData.supportRootY, 0);
    assert.equal(
      broadCrowns.geometry.userData.profile,
      'closed-branch-supported-eleven-leaf-cohort-broad-crown-v4',
    );
    assert.equal(
      narrowCrowns.geometry.userData.profile,
      'closed-leader-supported-four-whorl-narrow-distant-crown-v4',
    );
    assert.equal(broadCrowns.geometry.userData.closedVolume, true);
    assert.equal(narrowCrowns.geometry.userData.closedVolume, true);
    assert.ok(broadCrowns.geometry.attributes.color);
    assert.ok(narrowCrowns.geometry.attributes.color);
    assert.equal(broadCrowns.geometry.userData.closedComponentCount, 20);
    assert.equal(broadCrowns.geometry.userData.foliageCohortCount, 11);
    assert.equal(broadCrowns.geometry.userData.structuralBranchComponentCount, 9);
    assert.equal(broadCrowns.geometry.userData.triangleCount, 520);
    assert.ok(Math.min(...broadCrowns.geometry.attributes.ridgeCrownBranch.array) === 0);
    assert.ok(Math.max(...broadCrowns.geometry.attributes.ridgeCrownBranch.array) === 1);
    assert.equal(narrowCrowns.geometry.userData.closedComponentCount, 5);
    assert.equal(narrowCrowns.geometry.userData.foliageCohortCount, 4);
    assert.equal(narrowCrowns.geometry.userData.structuralBranchComponentCount, 1);
    assert.equal(narrowCrowns.geometry.userData.triangleCount, 500);
    assert.equal(broadCrowns.geometry.attributes.ridgeCrownVariation.count, broadCrowns.count);
    assert.equal(narrowCrowns.geometry.attributes.ridgeCrownVariation.count, narrowCrowns.count);
    assert.ok(Math.max(...broadCrowns.geometry.attributes.ridgeCrownLobe.array) >= 10);
    assert.ok(Math.max(...narrowCrowns.geometry.attributes.ridgeCrownLobe.array) >= 3);
    assert.equal(broadCrowns.material.flatShading, false);
    assert.equal(narrowCrowns.material.flatShading, false);
    for (const mesh of ridgeForest.children) {
      assert.ok(mesh.isInstancedMesh);
      assert.equal(mesh.material.type, 'MeshStandardMaterial');
      assert.equal(mesh.material.metalness, 0);
      assert.ok(mesh.material.roughness >= 0.9);
      assert.equal(mesh.material.fog, true);
      assert.equal(mesh.material.emissive.getHex(), 0);
      assert.equal(mesh.material.userData.surface, 'matte-non-emissive-distant-ridge-vegetation');
      assert.equal(
        mesh.material.userData.energyModel,
        'opaque-dielectric-direct-and-environment-light-response',
      );
      if (mesh !== trunks) {
        assert.equal(mesh.material.userData.crownVariation.version, 'ridge-crown-architecture-v4');
        assert.match(mesh.material.customProgramCacheKey(), /ridge-crown-architecture-v4/);
      }
      assert.equal(mesh.userData.collisionRole, 'non-solid-distant-background-vegetation');
    }
    ridge.updateWorldMatrix(true, true);
    const raycaster = new THREE.Raycaster();
    for (const placement of ridgeForest.userData.placements.filter((_, index) => index % 13 === 0)) {
      raycaster.set(
        new THREE.Vector3(
          placement.x,
          ridge.geometry.boundingBox.max.y + 20,
          placement.z,
        ),
        new THREE.Vector3(0, -1, 0),
      );
      const supportHit = raycaster.intersectObject(ridge, false)[0];
      assert.ok(supportHit, placement);
      assert.ok(Math.abs(supportHit.point.y - placement.y) < 1e-4, {
        placement,
        supportY: supportHit.point.y,
      });
      assert.ok(placement.crownOverlap > 0);
      assert.ok(placement.slopeY >= 0.58);
      assert.ok(placement.exposedStone <= 0.6);
      assert.ok(['juvenile-pioneer', 'layered-mature', 'weathered-emergent'].includes(
        placement.crownArchitecture,
      ));
      assert.equal(placement.crownVariation.length, 4);
      assert.ok(placement.crownVariation.every((value) => value >= 0 && value <= 1));
    }
    for (const placement of ridgeForest.userData.understoryPlacements.filter(
      (_, index) => index % 11 === 0,
    )) {
      raycaster.set(
        new THREE.Vector3(
          placement.x,
          ridge.geometry.boundingBox.max.y + 20,
          placement.z,
        ),
        new THREE.Vector3(0, -1, 0),
      );
      const supportHit = raycaster.intersectObject(ridge, false)[0];
      assert.ok(supportHit, placement);
      assert.ok(Math.abs(supportHit.point.y - placement.y) < 1e-4, placement);
      assert.equal(placement.understory, true);
      assert.ok(placement.slopeY >= 0.58);
      assert.ok(placement.exposedStone <= 0.46);
      assert.equal(placement.crownArchitecture, 'juvenile-pioneer');
      assert.equal(placement.crownVariation.length, 4);
    }
    const positions = ridge.geometry.attributes.position;
    for (let xIndex = 0; xIndex <= 72; xIndex += 1) {
      const expectedFrontHeight = ridge.userData.frontConnection
        === 'centre-apron-buried-into-playable-heightfield-with-subgrade-side-skirts'
        ? THREE.MathUtils.lerp(
          ridge.userData.baseY,
          terrainHeight(positions.getX(xIndex), positions.getZ(xIndex)) - 0.04,
          1 - THREE.MathUtils.smoothstep(Math.abs(positions.getX(xIndex)), 82, 108),
        )
        : ridge.userData.baseY;
      assert.ok(Math.abs(positions.getY(xIndex) - expectedFrontHeight) < 1e-5);
      const farEdgeIndex = 12 * 73 + xIndex;
      assert.ok(Math.abs(positions.getY(farEdgeIndex) - ridge.userData.baseY) < 1e-5);
    }
    const normals = ridge.geometry.attributes.normal;
    let upwardNormals = 0;
    let depthFacingNormals = 0;
    for (let index = 0; index < normals.count; index += 1) {
      if (normals.getY(index) > 0.25) upwardNormals += 1;
      if (Math.abs(normals.getZ(index)) > 0.08) depthFacingNormals += 1;
    }
    assert.ok(upwardNormals > normals.count * 0.8);
    assert.ok(depthFacingNormals > normals.count * 0.25);
  }
  for (const layer of ['mist-near', 'mist-mid', 'mist-far']) {
    const mistLayer = scene.getObjectByName(`world.atmosphere.${layer}`);
    assert.ok(mistLayer?.isGroup, layer);
    assert.equal(mistLayer.userData.profile, 'irregular-distance-layered-mist');
    assert.ok(mistLayer.children.length >= 5);
    for (const pocket of mistLayer.children) {
      assert.equal(pocket.material.type, 'ShaderMaterial');
      assert.equal(pocket.material.depthWrite, false);
      assert.equal(pocket.userData.profile, 'low-broken-mist-pocket');
      assert.ok(pocket.scale.y < pocket.scale.x * 0.35, 'mist must stay low and horizontal');
    }
  }
});

test('terrain projects correlated colour, roughness and height without planar tangent stretch', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const terrain = scene.getObjectByName('world.connected_route.terrain');
  assert.equal(terrain.material.map, null);
  assert.equal(terrain.material.roughnessMap, null);
  assert.equal(terrain.material.normalMap, null);
  assert.equal(
    terrain.material.userData.surface,
    'source-coupled-ecological-soil-and-basalt-weathering',
  );
  assert.deepEqual(terrain.material.userData.layers, [
    'navigation-exterior-basalt-escarpment-relief',
    'vertex-drainage-zone',
    'vertex-slope-mineral-zone',
    'world-space-broad-breakup',
    'rotated-mesoscale-grit',
    'distance-faded-projected-correlated-soil-albedo-roughness-relief',
    'near-field-habitat-gated-stone-organic-pore-inclusions',
    'sub-grid-cavity-indirect-occlusion',
    'canopy-and-hollow-retained-humus',
    'canopy-shade-moisture-and-stability-bryophyte-cover',
    'brook-hydrology-saturated-bank',
    'slope-and-exposure-mineral-washout',
    'route-footfall-litter-suppression-and-compaction',
    'inner-bend-point-bar-coarse-sand-and-fine-gravel',
    'low-energy-overbank-floodplain-silt',
    'outer-bend-cohesive-cut-bank-exposure',
    'angle-of-repose-bedrock-exposure',
    'source-coupled-cliff-toe-colluvium',
    'formation-sourced-basalt-weathering-apron',
  ]);
  assert.equal(
    terrain.material.userData.macroControl.name,
    'world.material.terrain-macro-control',
  );
  assert.equal(terrain.material.userData.macroControl.colorSpace, THREE.NoColorSpace);
  assert.equal(
    terrain.material.customProgramCacheKey(),
    'terrain-ecological-geological-micro-surface-v13',
  );
  assert.deepEqual(terrain.material.userData.surfaceDetail, {
    projection: 'continuous-world-space-triplanar',
    triplanarSharpness: 4,
    coarsePeriodMeters: 47,
    mediumPeriodMeters: 13,
    mediumFadeMeters: [45, 110],
    finePeriodMeters: 1.282,
    fineFadeMeters: [18, 58],
    fineInclusionChannels: {
      stone: 'soil-albedo-alpha',
      organic: 'soil-roughness-alpha',
      pore: 'soil-height-alpha',
    },
    fineInclusionModel: 'habitat-gated-sparse-irregular-stone-organic-and-pore-microstructure',
    maximumFineReliefAmplitudeMeters: 0.0025,
    normalSource: 'projected-meso-height-plus-source-gated-sparse-fine-stone',
    normalReliefAmplitudeMeters: [0.16, 0.21],
    cavityOcclusionFloor: 0.74,
    cavityLightingScope: 'indirect-diffuse-and-specular-only',
    compactionResponse: 'wet-alluvial-and-route-surfaces-reduce-relief-and-cavity',
    bryophyteResponse: 'living-cover-darkens-albedo-fills-fine-relief-and-retains-high-roughness',
  });
  for (const attributeName of [
    'terrainWetness',
    'terrainSlope',
    'terrainExposure',
    'terrainBasaltInfluence',
    'terrainHumus',
    'terrainWetBank',
    'terrainMineralExposure',
    'terrainRouteWear',
    'terrainAlluvium',
    'terrainFluvialSurface',
    'terrainBedrockExposure',
    'terrainColluvium',
  ]) {
    const attribute = terrain.geometry.getAttribute(attributeName);
    assert.equal(attribute.count, terrain.geometry.getAttribute('position').count);
    const values = Array.from(attribute.array);
    assert.ok(Math.min(...values) >= 0);
    assert.ok(Math.max(...values) <= 1);
    assert.ok(Math.max(...values) > Math.min(...values));
  }
  assert.equal(terrain.geometry.getAttribute('terrainFluvialSurface').itemSize, 4);
  assert.equal(
    world.assetSnapshot().terrain.surface,
    'source-coupled-ecological-soil-and-basalt-weathering',
  );
  assert.equal(world.assetSnapshot().terrain.ecology.randomMasks, 0);
  assert.equal(world.assetSnapshot().terrain.ecology.controlLines.brook, 10);
  assert.deepEqual(world.assetSnapshot().terrain.surfaceDetail, {
    projection: 'continuous-world-space-triplanar',
    triplanarSharpness: 4,
    coarsePeriodMeters: 47,
    mediumPeriodMeters: 13,
    mediumFadeMeters: [45, 110],
    finePeriodMeters: 1.282,
    fineFadeMeters: [18, 58],
    fineInclusionChannels: {
      stone: 'soil-albedo-alpha',
      organic: 'soil-roughness-alpha',
      pore: 'soil-height-alpha',
    },
    fineInclusionModel: 'habitat-gated-sparse-irregular-stone-organic-and-pore-microstructure',
    maximumFineReliefAmplitudeMeters: 0.0025,
    normalSource: 'projected-meso-height-plus-source-gated-sparse-fine-stone',
    normalReliefAmplitudeMeters: [0.16, 0.21],
    cavityOcclusionFloor: 0.74,
    cavityLightingScope: 'indirect-diffuse-and-specular-only',
    compactionResponse: 'wet-alluvial-and-route-surfaces-reduce-relief-and-cavity',
    bryophyteResponse: 'living-cover-darkens-albedo-fills-fine-relief-and-retains-high-roughness',
  });
  assert.deepEqual(world.assetSnapshot().terrain.surfaceGeology, {
    model: 'angle-of-repose-bedrock-exposure-and-source-coupled-colluvium',
    looseRegolithAngleDegrees: 34,
    looseRegolithGradient: 0.674509,
    fullBedrockAngleDegrees: 55,
    fullBedrockGradient: 1.428148,
    colluviumToeReachMeters: 6.5,
    bedrockReliefScale: 0.58,
    jointModel: 'source-basalt-joints-with-bounded-optical-relief',
    stratificationModel: 'world-height-bed-contacts-gated-by-source-bedrock-exposure',
    stratificationPeriodsMeters: [0.58, 1.74],
    maximumStratificationAlbedoReduction: 0.11,
    overlayGeometryCount: 0,
    slopeSource: 'rendered-heightfield-normal-not-sub-grid-analytic-probe',
    massTransfer: 'unstable-regolith-exposes-source-bedrock-and-stable-toe-retains-colluvium',
    ranges: {
      bedrockExposure: { minimum: 0, maximum: 0.8778, mean: 0.003 },
      colluvium: { minimum: 0, maximum: 0.9102, mean: 0.0089 },
    },
  });
  assert.deepEqual(world.assetSnapshot().terrain.fluvialSurface, {
    model: 'meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure',
    processSource: 'shared-brook-control-line-heightfield-and-bank-curvature',
    bankSurfaceModel: 'terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields',
    bankTopology: 'single-shared-render-and-collision-heightfield',
    bankOverlayGeometryCount: 0,
    bankOverlayDrawCalls: 0,
    wetBankRoughnessRange: [0.76, 0.99],
    contactModel: 'water-feather-over-shared-terrain-bank-no-raised-ribbon',
    pointBarMaterial: 'inner-bend-coarse-sand-and-rounded-fine-gravel',
    floodplainMaterial: 'low-energy-overbank-silt-and-clay',
    cutBankMaterial: 'outer-bend-exposed-cohesive-subsoil',
    pointBarReliefAmplitudeMeters: 0.13,
    floodplainReliefAmplitudeMeters: 0.045,
    cutBankReliefAmplitudeMeters: 0.11,
    grainOrdering: 'cut-bank-erosion-to-bed-load-to-inner-bend-lag-to-overbank-fines',
    ranges: {
      pointBarDeposit: { minimum: 0, maximum: 0.5699, mean: 0.0055 },
      floodplainSilt: { minimum: 0, maximum: 0.4145, mean: 0.0217 },
      cutBankExposure: { minimum: 0, maximum: 0.8533, mean: 0.0059 },
    },
  });
  assert.equal(terrain.material.userData.microTextures.albedo.name, 'world.material.soil-albedo');
  assert.equal(terrain.material.userData.microTextures.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(
    terrain.material.userData.microTextures.roughness.name,
    'world.material.soil-roughness',
  );
  assert.equal(terrain.material.userData.microTextures.roughness.colorSpace, THREE.NoColorSpace);
  assert.equal(
    terrain.material.userData.microTextures.height.name,
    'world.material.soil-macro-detail',
  );
  assert.equal(
    terrain.material.userData.basaltWeatheringTextures.albedo.name,
    'world.material.basalt-albedo',
  );
  assert.equal(
    terrain.material.userData.basaltWeatheringTextures.roughness.name,
    'world.material.basalt-roughness',
  );
  assert.equal(
    terrain.material.userData.basaltWeatheringTextures.height.name,
    'world.material.basalt-height',
  );
  const terrainPositions = terrain.geometry.getAttribute('position');
  const basaltInfluence = terrain.geometry.getAttribute('terrainBasaltInfluence');
  const renderedSlope = terrain.geometry.getAttribute('terrainSlope');
  const bedrockExposure = terrain.geometry.getAttribute('terrainBedrockExposure');
  const colluvium = terrain.geometry.getAttribute('terrainColluvium');
  const nearestInfluence = (targetX, targetZ) => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index < terrainPositions.count; index += 1) {
      const distance = Math.hypot(
        terrainPositions.getX(index) - targetX,
        terrainPositions.getZ(index) - targetZ,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    return basaltInfluence.getX(nearestIndex);
  };
  for (const formation of BASALT_FORMATION_LAYOUT) {
    assert.ok(nearestInfluence(formation.x - 2.4, formation.z) > 0.85, formation);
  }
  assert.ok(
    nearestInfluence(31.25, -38) > 0.5,
    'the raised source zones must share one stability-limited weathered shoulder',
  );
  assert.ok(nearestInfluence(0, -30) < 0.01, 'glade soil must not inherit remote basalt');
  const nearestAttribute = (attribute, targetX, targetZ) => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index < terrainPositions.count; index += 1) {
      const distance = Math.hypot(
        terrainPositions.getX(index) - targetX,
        terrainPositions.getZ(index) - targetZ,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    return attribute.getX(nearestIndex);
  };
  assert.equal(nearestAttribute(renderedSlope, 31.25, -26.25), 1);
  assert.ok(nearestAttribute(bedrockExposure, 31.25, -26.25) > 0.8);
  assert.ok(nearestAttribute(colluvium, 27.5, -26.25) > 0.85);
  assert.equal(nearestAttribute(bedrockExposure, 0, -26.25), 0);
  const canopy = scene.getObjectByName('world.connected_route.canopy');
  const canopyLeafDetail = scene.getObjectByName('world.connected_route.canopy-leaf-detail');
  const canopyLeafCompound = scene.getObjectByName(
    'world.connected_route.canopy-leaf-detail-compound',
  );
  const trunks = scene.getObjectByName('world.connected_route.tree_trunks');
  const plateBarkedTrunks = scene.getObjectByName(
    'world.connected_route.tree_trunks-plate-barked',
  );
  const ferns = scene.getObjectByName('world.connected_route.ferns');
  assert.equal(canopy.material.flatShading, false);
  assert.equal(ferns.material.flatShading, false);
  assert.equal(canopy.material.userData.surface, 'smooth-canopy-mass-with-sky-response');
  assert.equal(canopy.geometry.userData.shading, 'retained-smooth-source-normals');
  const canopyNormals = canopy.geometry.attributes.normal;
  let hasInterpolatedTriangle = false;
  for (let index = 0; index + 2 < canopyNormals.count; index += 3) {
    const delta = Math.abs(canopyNormals.getX(index) - canopyNormals.getX(index + 1))
      + Math.abs(canopyNormals.getY(index) - canopyNormals.getY(index + 1))
      + Math.abs(canopyNormals.getZ(index) - canopyNormals.getZ(index + 1));
    if (delta > 0.001) {
      hasInterpolatedTriangle = true;
      break;
    }
  }
  assert.ok(hasInterpolatedTriangle, 'canopy must retain interpolated source normals');
  const leafMeshes = [canopyLeafDetail, canopyLeafCompound];
  assert.ok(leafMeshes.every((mesh) => mesh?.isInstancedMesh));
  assert.equal(
    leafMeshes.reduce((total, mesh) => total + mesh.count, 0),
    VEGETATION_LAYOUT.trees.filter(({ isAraucaria }) => !isAraucaria).length,
  );
  assert.deepEqual(
    leafMeshes.map((mesh) => mesh.geometry.userData.family),
    ['elliptic-waxy', 'compound-lanceolate'],
  );
  assert.deepEqual(
    leafMeshes.map((mesh) => mesh.material.map.name),
    ['world.material.leaf-cluster-atlas', 'world.material.compound-lanceolate-leaf-atlas'],
  );
  for (const leafMesh of leafMeshes) {
    assert.equal(leafMesh.geometry.userData.anchorCount, 8);
    assert.ok(leafMesh.geometry.userData.cardCount >= 16);
    assert.ok(leafMesh.geometry.getAttribute('color'));
    assert.equal(
      leafMesh.geometry.userData.supportModel,
      'secondary-branch-tip-to-visible-rachis',
    );
    assert.equal(leafMesh.material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(
      leafMesh.material.map.userData.source,
      'deterministic-original-code-authored-atlas',
    );
    assert.ok(leafMesh.material.alphaTest >= 0.3);
    assert.equal(leafMesh.material.alphaToCoverage, true);
    assert.equal(
      leafMesh.material.userData.surface,
      'branch-supported-alpha-tested-matte-leaf-spray',
    );
    assert.equal(
      leafMesh.material.userData.energyModel,
      'shadow-aware-beer-lambert-thin-leaf-transmission',
    );
    assert.equal(leafMesh.material.emissiveIntensity, 0);
    assert.equal(leafMesh.material.userData.transmissionModel.directionalShadow, true);
    assert.equal(leafMesh.material.userData.transmissionModel.emissive, false);
    assert.match(leafMesh.material.onBeforeCompile.toString(), /leafTransmittance/);
    assert.match(leafMesh.material.onBeforeCompile.toString(), /directionalShadowMap/);
    assert.equal(
      leafMesh.material.userData.windModel.supportModel,
      'branch-attached-uv-base-with-flexible-leaf-tip',
    );
    assert.equal(
      leafMesh.customDepthMaterial.userData.shadowModel,
      'shared-displacement-uniforms-for-colour-and-depth-pass',
    );
    assert.equal(
      leafMesh.customDepthMaterial.userData.windUniforms,
      leafMesh.material.userData.windUniforms,
    );
    assert.match(leafMesh.material.onBeforeCompile.toString(), /injectLeafWindVertex/);
    assert.match(leafMesh.customDepthMaterial.onBeforeCompile.toString(), /injectLeafWindVertex/);
    const leafAtlas = leafMesh.material.map.image;
    let visibleLeafPixels = 0;
    for (let index = 3; index < leafAtlas.data.length; index += 4) {
      if (leafAtlas.data[index] >= 102) visibleLeafPixels += 1;
    }
    const leafCoverage = visibleLeafPixels / (leafAtlas.width * leafAtlas.height);
    assert.ok(leafCoverage >= 0.14 && leafCoverage <= 0.4, leafCoverage);
    assert.equal(leafAtlas.data[3], 0, 'leaf-card atlas corners must remain transparent');
    assert.equal(
      leafMesh.userData.compositionRole,
      'branch-tip-supported-leaf-scale-silhouette',
    );
  }
  assert.equal(trunks.material.map.name, 'world.material.bark-albedo');
  assert.equal(trunks.material.roughnessMap.name, 'world.material.bark-roughness');
  assert.equal(trunks.material.bumpMap.name, 'world.material.bark-height');
  assert.ok(trunks.geometry.attributes.uv);
  assert.equal(plateBarkedTrunks.material.map.name, 'world.material.plate-bark-albedo');
  assert.equal(
    plateBarkedTrunks.material.roughnessMap.name,
    'world.material.plate-bark-roughness',
  );
  assert.equal(plateBarkedTrunks.material.bumpMap.name, 'world.material.plate-bark-height');
  assert.notEqual(plateBarkedTrunks.geometry, trunks.geometry);
  assert.ok(plateBarkedTrunks.geometry.attributes.uv);

  world.update(3.25, false, { quality: 'balanced' });
  for (const leafMesh of leafMeshes) {
    const uniforms = leafMesh.material.userData.windUniforms;
    assert.equal(uniforms.time.value, 3.25);
    assert.equal(uniforms.strength.value, CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters);
    assert.equal(uniforms.verticalStrength.value, CANOPY_WIND_PROFILE.verticalTipDisplacementMeters);
  }
  world.update(8, true, { quality: 'balanced' });
  for (const leafMesh of leafMeshes) {
    const uniforms = leafMesh.material.userData.windUniforms;
    assert.equal(uniforms.time.value, 0);
    assert.equal(uniforms.strength.value, 0);
    assert.equal(uniforms.verticalStrength.value, 0);
  }
});

test('the glade composition protects a lit family-and-basalt sightline', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const composition = world.assetSnapshot().gladeComposition;
  assert.ok(composition.sightlineHalfWidth >= 20);
  assert.equal(composition.sunLanePresent, true);
  assert.equal(composition.shadowCastingSubjects, 5);
  assert.ok(composition.familyWidth >= 14);
});

test('degradable ground accents add deterministic depth without changing collision truth', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const accents = scene.getObjectByName('world.connected_route.degradable-ground-accents');
  const wetland = scene.getObjectByName('world.connected_route.degradable-wetland-accents');
  const margins = scene.getObjectByName('world.connected_route.degradable-margin-accents');

  assert.equal(accents.userData.profile, 'deterministic-non-solid-instanced-accents');
  assert.equal(accents.children.length, 3);
  assert.ok(
    scene.getObjectByName('world.connected_route.ferns.accent-asset-anchor')?.isGroup,
  );
  assert.equal(wetland.count, 36);
  assert.equal(margins.count, 28);
  assert.equal(wetland.userData.collisionRole, 'non-solid-visual-accent');
  assert.equal(margins.userData.collisionRole, 'non-solid-visual-accent');
  assert.deepEqual(world.assetSnapshot().degradableGroundAccents, {
    profile: 'deterministic-non-solid-instanced-accents',
    quality: 'balanced',
    visible: true,
    instanceCount: 64,
    drawCalls: 2,
    collisionRole: 'non-solid-visual-accent',
  });

  world.update(0, true, { quality: 'low' });
  assert.equal(accents.visible, false);
  world.update(0, true, { quality: 'high' });
  assert.equal(accents.visible, true);
  assert.equal(world.assetSnapshot().degradableGroundAccents.quality, 'high');
});

test('environment density adds near, mid and far habitat layers without collision authority', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const density = scene.getObjectByName('world.environment-density');
  const snapshot = world.assetSnapshot().environmentDensity;
  assert.ok(density?.isGroup);
  assert.equal(snapshot.profile, 'near-mid-far-instanced-habitat-density');
  assert.ok(snapshot.instanceCount >= 1_650);
  assert.ok(snapshot.drawCalls <= 17);
  assert.equal(snapshot.collisionRole, 'non-solid-visual-accent');
  assert.equal(
    snapshot.groundCoverDistribution,
    'shade-and-wetness-clustered-microhabitats',
  );
  assert.equal(snapshot.groundCoverClusterCount, 24);
  assert.equal(
    snapshot.bryophyteGroundLayer.profile,
    'supported-bryophyte-herbaceous-ground-layer-v2',
  );
  assert.equal(snapshot.bryophyteGroundLayer.instanceCount, SCENE_BUDGET.bryophyteGround);
  assert.deepEqual(snapshot.bryophyteGroundLayer.counts, {
    'moss-mat': 387,
    'clubmoss-spray': 196,
    'humid-grass-tuft': 57,
  });
  assert.equal(snapshot.bryophyteGroundLayer.drawCalls, 3);
  assert.equal(snapshot.bryophyteGroundLayer.supportEvidence.supportRatio, 1);
  assert.equal(snapshot.bryophyteGroundLayer.supportEvidence.minimumRootClearance, -0.026);
  assert.equal(snapshot.bryophyteGroundLayer.supportEvidence.maximumRootClearance, -0.026);
  assert.equal(snapshot.deadfall.instanceCount, SCENE_BUDGET.deadfall);
  assert.equal(
    snapshot.deadfall.supportModel,
    'gravity-settled-tangent-aligned-multipoint-deadfall',
  );
  assert.equal(snapshot.deadfall.supportEvidence.instanceCount, SCENE_BUDGET.deadfall);
  assert.equal(snapshot.deadfall.supportEvidence.supportSampleCount, 78);
  assert.equal(snapshot.deadfall.supportEvidence.minimumClearance, -0.0238);
  assert.equal(snapshot.deadfall.supportEvidence.maximumClearance, 0.012);
  assert.equal(snapshot.deadfall.supportEvidence.maximumTerrainSlope, 0.1189);
  assert.equal(snapshot.deadfall.collisionRole, 'non-solid-visual-accent');
  assert.equal(
    snapshot.deadfall.energyModel,
    'opaque-non-emissive-dielectric-weathered-wood',
  );
  assert.equal(
    snapshot.deadfall.material.surface,
    'dry-weathered-furrowed-bark-and-broken-end-grain',
  );
  assert.equal(snapshot.deadfall.material.moistureClass, 'forest-floor-dry-to-damp');
  assert.equal(snapshot.deadfall.material.flatShading, false);
  assert.ok(snapshot.deadfall.material.envMapIntensity <= 0.08);
  assert.equal(snapshot.deadfall.geometry.length, 3);
  assert.ok(snapshot.deadfall.geometry.every((geometry) => (
    geometry.profile === 'closed-curved-branched-deadwood-with-jagged-fibre-breaks'
      && geometry.surface === 'mapped-furrowed-bark-with-distinct-end-grain-and-splinters'
      && geometry.triangleCount >= 696
      && geometry.closedSegmentCount >= 7
      && geometry.primaryBranchCount >= 2
      && geometry.splinterCount >= 4
      && geometry.supportPointCount >= 2
      && geometry.loadPath
        === 'closed-overlapping-trunk-to-branch-volumes-with-tapered-fibre-breaks'
  )));
  assert.equal(
    snapshot.bryophyteGroundLayer.collisionRole,
    'non-solid-compressible-ground-vegetation',
  );
  assert.equal(snapshot.bryophyteGroundLayer.geometry.length, 3);
  assert.ok(snapshot.bryophyteGroundLayer.geometry.every((geometry) => (
    geometry.closedVolumes && geometry.rootVertexCount > 0 && geometry.rootY === 0
  )));
  assert.equal(
    snapshot.forestFloorDetritus.profile,
    'source-coupled-forest-floor-detritus-v2',
  );
  assert.equal(snapshot.forestFloorDetritus.instanceCount, SCENE_BUDGET.forestFloorDetritus);
  assert.deepEqual(snapshot.forestFloorDetritus.counts, [120, 120, 120, 30]);
  assert.equal(snapshot.forestFloorDetritus.drawCalls, 4);
  assert.deepEqual(snapshot.forestFloorDetritus.variantIds, [
    'curled-broadleaf-litter',
    'twig-and-bark-fall',
    'cone-husk-and-leaf-scatter',
    'hero-gingko-fan-leaf-fall',
  ]);
  assert.deepEqual(snapshot.forestFloorDetritus.sourceRoleCounts, {
    canopyHabitat: 360,
    heroGingkoInterRoot: 30,
  });
  assert.equal(snapshot.forestFloorDetritus.supportEvidence.supportRatio, 1);
  assert.ok(snapshot.forestFloorDetritus.supportEvidence.minimumClearance >= -0.0081);
  assert.ok(snapshot.forestFloorDetritus.supportEvidence.maximumClearance <= 0.035);
  assert.ok(snapshot.forestFloorDetritus.ecologyRanges.humus[0] >= 0.08);
  assert.ok(snapshot.forestFloorDetritus.ecologyRanges.routeWear[1] <= 0.16);
  assert.ok(snapshot.forestFloorDetritus.ecologyRanges.wetBank[1] <= 0.65);
  assert.ok(snapshot.forestFloorDetritus.ecologyRanges.mineralExposure[1] <= 0.58);
  assert.ok(snapshot.forestFloorDetritus.ecologyRanges.slope[1] <= 0.28);
  assert.equal(
    snapshot.forestSuccessionProfile,
    'terrain-sourced-boundary-forest-succession-v2',
  );
  assert.equal(
    snapshot.forestCollisionModel,
    'load-bearing-trunks-wholly-outside-navigation-crowns-may-overhang',
  );
  assert.equal(snapshot.forestSuccession.instanceCount, SCENE_BUDGET.distantTrees);
  assert.equal(snapshot.forestSuccession.cohortCount, 12);
  assert.equal(snapshot.forestSuccession.outsideNavigationCount, SCENE_BUDGET.distantTrees);
  assert.deepEqual(snapshot.forestSuccession.ageCounts, {
    mature: 72,
    submature: 36,
    pioneer: 36,
  });
  assert.ok(snapshot.forestSuccession.crownOverlapLinks >= 60);
  assert.ok(scene.getObjectByName('world.environment-density.distant-canopy')?.isInstancedMesh);
  assert.ok(scene.getObjectByName('world.environment-density.ground-cover-1')?.isInstancedMesh);
  const broadleafCover = scene.getObjectByName('world.environment-density.ground-cover-3');
  assert.equal(broadleafCover.geometry.userData.profile, 'broad-waxy-lanceolate-understory-rosette');
  assert.equal(broadleafCover.geometry.userData.leafCount, 7);
  assert.equal(broadleafCover.geometry.userData.surface, 'curved-midrib-and-gravity-settle');
  assert.equal(broadleafCover.material.userData.surface, 'waxy-broadleaf-understory-response');
  assert.ok(scene.getObjectByName('world.environment-density.deadfall-1')?.isInstancedMesh);
  assert.ok(
    scene.getObjectByName('world.environment-density.forest-floor-detritus-1')?.isInstancedMesh,
  );
  assert.ok(
    scene.getObjectByName('world.environment-density.forest-floor-detritus-4')?.isInstancedMesh,
  );
});

test('environment landmarks use authored organic and fractured silhouettes instead of stretched primitives', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const trunks = scene.getObjectByName('world.connected_route.tree_trunks');
  const plateBarkedTrunks = scene.getObjectByName(
    'world.connected_route.tree_trunks-plate-barked',
  );
  const canopyTreeAnchor = scene.getObjectByName(
    'world.connected_route.canopy-tree-sentinels',
  );
  const canopy = scene.getObjectByName('world.connected_route.canopy');
  const canopyBranches = scene.getObjectByName(
    'world.connected_route.canopy-load-bearing-branches',
  );
  const plateCanopyBranches = scene.getObjectByName(
    'world.connected_route.canopy-load-bearing-branches-plate-barked',
  );
  const ferns = scene.getObjectByName('world.connected_route.ferns');
  const basalt = scene.getObjectByName('world.connected_route.red_basalt');
  const track = scene.getObjectByName('world.connected_route.three-toed-track');

  assert.ok(canopyTreeAnchor.isGroup);
  assert.equal(canopyTreeAnchor.children.length, SCENE_BUDGET.trees);
  assert.ok(canopyTreeAnchor.children.every(
    (child) => child.userData.canopyTreePlacementAnchor,
  ));
  assert.equal(canopyTreeAnchor.userData.fallbackMeshes.length, 9);
  assert.equal(
    canopyTreeAnchor.userData.growthModel,
    'gravitropic-vertical-trunk-with-gravity-settled-root-mantle',
  );

  assert.equal(trunks.geometry.userData.profile, 'buttressed-bent-branching');
  assert.equal(trunks.geometry.userData.surface, 'directional-bark-plane-variation');
  assert.equal(trunks.geometry.userData.barkFamily, 'wet-furrowed-buttress');
  assert.ok(trunks.geometry.attributes.color);
  assert.equal(trunks.material.vertexColors, true);
  assert.equal(
    plateBarkedTrunks.geometry.userData.profile,
    'fluted-plate-barked-buttressed-trunk',
  );
  assert.equal(
    plateBarkedTrunks.geometry.userData.surface,
    'attached-fibrous-bark-plate-relief',
  );
  assert.equal(
    plateBarkedTrunks.geometry.userData.geometricRelief,
    'continuous-radial-flutes-and-staggered-plates',
  );
  assert.equal(
    trunks.count + plateBarkedTrunks.count,
    SCENE_BUDGET.trees,
  );
  assert.ok(plateBarkedTrunks.geometry.attributes.color);
  assert.equal(plateBarkedTrunks.material.vertexColors, true);
  assert.equal(canopy.geometry.userData.profile, 'asymmetric-multi-lobe');
  assert.equal(canopy.geometry.userData.surface, 'broken-canopy-plane-variation');
  assert.ok(canopy.geometry.attributes.color);
  assert.ok(canopyBranches?.isInstancedMesh);
  assert.ok(plateCanopyBranches?.isInstancedMesh);
  assert.equal(
    canopyBranches.count + plateCanopyBranches.count,
    VEGETATION_LAYOUT.trees.filter(({ isAraucaria }) => !isAraucaria).length,
  );
  assert.equal(canopyBranches.geometry.userData.profile, 'load-bearing-radial-branch-whorl');
  assert.equal(canopyBranches.geometry.userData.primaryBranchCount, 5);
  assert.equal(canopyBranches.geometry.userData.secondaryBranchCount, 8);
  assert.equal(
    canopyBranches.geometry.userData.supportModel,
    'trunk-to-primary-to-leaf-cluster',
  );
  assert.equal(canopyBranches.geometry.userData.leafAnchorCount, 8);
  assert.equal(plateCanopyBranches.geometry, canopyBranches.geometry);
  assert.equal(plateCanopyBranches.material, plateBarkedTrunks.material);
  assert.equal(
    canopyBranches.userData.compositionRole,
    'visible-trunk-to-leaf-load-path',
  );
  assert.equal(
    plateCanopyBranches.userData.compositionRole,
    'visible-trunk-to-leaf-load-path',
  );
  assert.ok(canopyBranches.geometry.attributes.uv);
  assert.ok(canopyBranches.geometry.attributes.color);
  assert.ok(ferns.geometry.userData.frondSegments >= 6);
  assert.equal(ferns.geometry.userData.variant, 'open-rosette');
  assert.equal(ferns.geometry.userData.surface, 'ribbed-frond-color-break');
  assert.ok(ferns.geometry.attributes.color);
  assert.equal(ferns.material.vertexColors, true);
  assert.equal(scene.getObjectByName('world.connected_route.ferns-variant-2').geometry.userData.variant, 'upright-feather');
  assert.equal(scene.getObjectByName('world.connected_route.ferns-variant-3').geometry.userData.variant, 'low-cycad');
  const treeFernAnchor = scene.getObjectByName('world.connected_route.tree-fern-sentinels');
  const treeFernTrunks = scene.getObjectByName(
    'world.connected_route.tree-fern-sentinels.procedural-trunks',
  );
  const treeFernCrowns = scene.getObjectByName(
    'world.connected_route.tree-fern-crowns.procedural',
  );
  const foregroundFronds = scene.getObjectByName('world.connected_route.foreground-depth-fronds');
  const brookResponse = scene.getObjectByName('world.connected_route.brook_response');
  const brookResponseAssetAnchor = scene.getObjectByName(
    'world.connected_route.brook-response.asset-anchor',
  );
  assert.ok(treeFernAnchor.isGroup);
  assert.equal(treeFernAnchor.children.length, 12);
  assert.ok(treeFernAnchor.children.every((child) => child.userData.treeFernPlacementAnchor));
  assert.equal(treeFernAnchor.userData.fallbackMeshes.length, 4);
  assert.equal(
    treeFernAnchor.userData.growthModel,
    'gravitropic-vertical-trunk-with-gravity-settled-root-mantle',
  );
  assert.ok(treeFernTrunks.isInstancedMesh);
  assert.ok(treeFernCrowns.isInstancedMesh);
  assert.equal(treeFernTrunks.count, 12);
  assert.equal(treeFernTrunks.geometry.userData.profile, 'ring-scarred-tree-fern-trunk');
  assert.equal(
    treeFernTrunks.geometry.userData.surface,
    'alternating-leaf-scar-bands-with-buttress-roots',
  );
  assert.equal(treeFernCrowns.count, 4);
  assert.equal(treeFernCrowns.geometry.userData.variant, 'broad-tree-fern-crown');
  assert.equal(
    scene.getObjectByName(
      'world.connected_route.tree-fern-crowns.procedural-variant-2',
    ).geometry.userData.variant,
    'wind-broken-tree-fern-crown',
  );
  assert.equal(
    scene.getObjectByName(
      'world.connected_route.tree-fern-crowns.procedural-variant-3',
    ).geometry.userData.variant,
    'dense-low-tree-fern-crown',
  );
  assert.equal(treeFernTrunks.userData.compositionRole, 'sightline-margin-scale-anchor');
  assert.ok(foregroundFronds.isInstancedMesh);
  assert.equal(foregroundFronds.count, 12);
  assert.equal(foregroundFronds.userData.compositionRole, 'dark-foreground-depth-frame');
  assert.ok(brookResponse.isGroup);
  assert.equal(brookResponse.children.length, 5);
  assert.equal(brookResponse.userData.profile, 'bounded-five-frond-physical-fallback');
  assert.equal(brookResponse.userData.supportModel, 'terrain-rooted-rhizome-to-flexing-frond');
  assert.ok(brookResponse.children.every((frond) => frond.scale.x <= 0.345));
  assert.ok(brookResponse.children.every((frond) => frond.material.metalness === 0));
  assert.ok(brookResponseAssetAnchor.isGroup);
  assert.deepEqual(brookResponseAssetAnchor.userData.fallbackMeshes, [brookResponse]);
  assert.equal(brookResponseAssetAnchor.userData.placements.length, 5);
  assert.ok(brookResponseAssetAnchor.userData.placements.every(
    (placement) => placement.sourceRole === 'brook-response-humid-brush-replacement',
  ));
  assert.ok(brookResponseAssetAnchor.userData.placements.every(
    (placement) => placement.maxDiameterMeters === 1.12
      && placement.maxHeightMeters === 0.46,
  ));
  assert.ok(brookResponseAssetAnchor.userData.placements.every(
    (placement) => placement.x >= -11.75 && placement.x <= -9.16
      && placement.z >= 47.08 && placement.z <= 47.86,
  ));
  assert.ok(basalt.geometry.userData.fractureRings >= 5);
  assert.equal(basalt.geometry.userData.irregularTop, true);
  assert.equal(basalt.geometry.userData.profile, 'subtly-tapered-polygonal-cooling-column');
  assert.equal(basalt.geometry.userData.crossSection, 'hexagonal-joint-cell');
  assert.equal(track.children.length, 2);
  const trackClods = scene.getObjectByName('world.track.displaced-mud-clods');
  assert.ok(trackClods.isInstancedMesh);
  assert.equal(trackClods.count, 13);
  assert.equal(trackClods.userData.profile, 'irregular-perimeter-displacement');
  assert.equal(track.userData.firstRead, 'three-toed-print');
  assert.equal(track.userData.openingSightline, true);
  assert.ok(track.userData.worldAnchor.scale >= 2 && track.userData.worldAnchor.scale <= 2.15);
  assert.ok(track.userData.worldAnchor.x > -1.8 && track.userData.worldAnchor.x < -1.5);
  assert.equal(track.children[0].geometry.userData.profile, 'deformed-tridactyl-mud-impression');
  assert.equal(track.children[0].geometry.userData.toeCount, 3);
  assert.equal(track.children[0].geometry.userData.longestToe, 'centre');
  assert.equal(track.children[0].geometry.userData.tipProfile, 'rounded-pressure-spread');
  assert.equal(track.children[0].geometry.userData.edgeProfile, 'asymmetric-collapsed-wet-mud');
  assert.equal(track.children[0].geometry.userData.softEdge, true);
  assert.equal(track.children[0].geometry.userData.toeTipDepthVariation, true);
  assert.equal(track.children[0].geometry.userData.physicalRelief, true);
  assert.equal(track.children[0].geometry.userData.terrainCutaway, true);
  assert.equal(track.children[0].geometry.userData.edgeAlpha, true);
  assert.equal(
    track.children[0].geometry.userData.coverageModel,
    'pressure-rim-and-standing-water-only',
  );
  assert.ok(track.children[0].geometry.userData.reliefDepthMeters >= 0.1);
  assert.equal(track.children[0].userData.contactShape, 'terrain-deformed-tridactyl-print');
  const trackHeights = Array.from(
    { length: track.children[0].geometry.attributes.position.count },
    (_, index) => track.children[0].geometry.attributes.position.getY(index),
  );
  assert.ok(Math.max(...trackHeights) - Math.min(...trackHeights) >= 0.08);
  assert.equal(track.children[0].geometry.attributes.color.itemSize, 4);
  const trackAlphas = Array.from(
    { length: track.children[0].geometry.attributes.color.count },
    (_, index) => track.children[0].geometry.attributes.color.getW(index),
  );
  assert.ok(Math.min(...trackAlphas) <= 0.01);
  assert.ok(Math.max(...trackAlphas) >= 0.95);
  assert.ok(
    trackAlphas.filter((alpha) => alpha <= 0.05).length > trackAlphas.length * 0.42,
    'the carrier mesh must remain invisible outside displaced mud',
  );
  assert.ok(track.children[0].geometry.attributes.uv);
  assert.equal(track.children[0].material.type, 'MeshPhysicalMaterial');
  assert.equal(track.children[0].material.depthWrite, false);
  assert.equal(track.children[0].material.bumpMap.name, 'world.material.soil-macro-detail');
  assert.equal(
    scene.getObjectByName('world.connected_route.terrain').geometry.userData.trackSubsurfaceClearance,
    'concealed-cutaway-under-impression',
  );
  const integratedBrookBank = scene.getObjectByName('world.connected_route.brook-wet-bank');
  assert.ok(integratedBrookBank.isGroup);
  assert.equal(integratedBrookBank.children.length, 0);
  const brook = scene.getObjectByName('world.connected_route.brook');
  assert.equal(brook.material.type, 'ShaderMaterial');
  assert.equal(
    brook.material.userData.surface,
    'measured-column-fresnel-shallow-brook-shader',
  );
  assert.equal(
    brook.material.userData.motion,
    'tessellated-gravity-and-rendered-obstacle-coupled-twin-headwater-free-surface',
  );
  assert.equal(brook.material.depthWrite, false);
  assert.equal(
    brook.geometry.userData.profile,
    'tessellated-gravity-level-twin-headwater-free-surface',
  );
  assert.equal(brook.geometry.userData.crossSectionVertices, 13);
  assert.equal(brook.geometry.userData.longitudinalSubdivisions, 4);
  assert.equal(brook.geometry.userData.longitudinalRows, 289);
  assert.equal(brook.geometry.userData.baseTriangleCount, 6912);
  assert.equal(brook.geometry.userData.crossChannelGrade, 0);
  assert.equal(
    brook.geometry.userData.hydrologyVersion,
    'gravity-drained-twin-reach-losing-basin-v1',
  );
  assert.equal(brook.geometry.attributes.flowDirection.itemSize, 1);
  assert.equal(brook.geometry.attributes.flowEnergy.itemSize, 1);
  assert.equal(brook.geometry.attributes.waterDepthMeters.itemSize, 1);
  assert.equal(brook.geometry.attributes.color.itemSize, 4);
  assert.equal(
    brook.geometry.userData.waterColumnSource,
    'water-level-minus-shared-terrain-heightfield',
  );
  assert.deepEqual(brook.geometry.userData.waterDepthRangeMeters, [0.002, 0.288]);
  assert.equal(
    integratedBrookBank.userData.surface,
    'terrain-integrated-fluvial-bank-transition',
  );
  assert.equal(integratedBrookBank.userData.bankOverlayGeometryCount, 0);
  assert.equal(integratedBrookBank.userData.bankOverlayDrawCalls, 0);
  const brookAlbedo = brook.material.uniforms.flowAlbedo.value;
  const brookRoughness = brook.material.uniforms.flowRoughness.value;
  const brookNormal = brook.material.uniforms.flowNormal.value;
  assert.equal(brookAlbedo.name, 'world.material.brook-albedo');
  assert.equal(brookRoughness.name, 'world.material.brook-roughness');
  assert.equal(brookNormal.name, 'world.material.brook-normal');
  assert.notEqual(brookAlbedo, brookRoughness);
  assert.equal(brookAlbedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(brookNormal.colorSpace, THREE.NoColorSpace);
  assert.deepEqual(brook.material.userData.layers, [
    'shared-heightfield-measured-water-column',
    'broad-flow-normal',
    'fine-cross-current-normal',
    'downstream-grade-coupled-hydraulic-energy',
    'rendered-clast-potential-flow-deflection',
    'downstream-bounded-vortex-shedding-and-contact-aeration',
    'centimetre-bounded-free-surface-pressure-speedup-and-wake-displacement',
    'fresnel-sky-response',
    'grade-bounded-bank-and-flow-aeration',
    'scene-layout-local-reflection',
    'camera-selected-gravity-reach-planar-reflection',
    'bounded-screen-space-reflection-over-planar-fallback',
    'beer-lambert-channel-bed-transmission',
    'same-camera-scene-colour-depth-refraction',
  ]);
  assert.deepEqual(brook.material.userData.optics, {
    waterColumnSource: 'water-level-minus-shared-terrain-heightfield',
    waterDepthRangeMeters: [0.002, 0.288],
    indexOfRefraction: 1.333,
    normalIncidenceReflectance: 0.02037,
    absorptionCoefficientPerMeter: [0.72, 0.22, 0.13],
    roughnessRange: [0.11, 0.34],
    aerationSource:
      'local-downstream-grade-bank-contact-and-rendered-clast-downstream-wakes',
    staticOverlayRipples: 0,
    reflectionProfile: 'bounded-screen-space-over-planar-brook-reflection-v1',
    screenSpaceReflectionModel:
      'screen-space-reflected-ray-over-local-planar-and-scene-probe-fallback',
    screenSpaceReflectionRangeMeters: 38,
    screenSpaceReflectionStepsByQuality: { low: 0, balanced: 12, high: 20 },
    screenSpaceReflectionFallback:
      'camera-selected-local-planar-then-scene-layout-equirectangular-probe',
    reflectionEvidenceBoundary:
      'screen-space-rays-cannot-recover-occluded-or-off-screen-geometry-and-never-replace-the-fallback',
    obstacleFlowProfile: 'rendered-clast-coupled-bounded-obstacle-flow-v1',
    obstacleFlowEvidenceBoundary:
      'local-bounded-cylinder-and-shedding-approximation-not-cfd-discharge-or-transport-proof',
    freeSurfaceProfile: 'tessellated-obstacle-coupled-free-surface-v1',
    freeSurfaceGrid: [4, 13],
    freeSurfaceDisplacementRangeMeters: [-0.038, 0.038],
    freeSurfaceEvidenceBoundary:
      'centimetre-bounded-visual-free-surface-not-shallow-water-cfd-or-volume-conservation-proof',
    hydraulicEvidenceBoundary:
      'bounded-local-free-surface-does-not-claim-discharge-cfd-volume-proof-or-exact-wave-spectrum',
  });
  const reflectionPanorama = brook.material.uniforms.sceneReflectionPanorama.value;
  assert.equal(reflectionPanorama.isDataTexture, true);
  assert.equal(reflectionPanorama.name, 'world.material.brook-local-scene-panorama');
  assert.ok(reflectionPanorama.userData.sourceObjectCount > 0);
  assert.equal(
    brook.material.uniforms.channelBed.value.name,
    'world.material.soil-albedo',
  );
  assert.equal(
    brook.material.uniforms.sceneRefractionColor.value.name,
    'world.material.brook-scene-refraction-colour',
  );
  assert.equal(
    brook.material.uniforms.sceneRefractionDepth.value.name,
    'world.material.brook-scene-refraction-depth',
  );
  assert.equal(brook.material.uniforms.sceneRefractionDepth.value.isDepthTexture, true);
  assert.match(brook.material.fragmentShader, /equirectangularUv/);
  assert.match(brook.material.fragmentShader, /absorptionCoefficient/);
  assert.match(brook.material.fragmentShader, /transmittedBed/);
  assert.match(brook.material.fragmentShader, /vPlanarReflectionCoord/);
  assert.match(brook.material.fragmentShader, /planarSceneReflection/);
  assert.match(brook.material.fragmentShader, /activePlaneAgreement/);
  assert.match(brook.material.fragmentShader, /traceScreenSpaceReflection/);
  assert.match(brook.material.fragmentShader, /perspectiveStart/);
  assert.match(brook.material.fragmentShader, /thicknessConfidence/);
  assert.match(brook.material.fragmentShader, /reflectedRayAboveSurface/);
  assert.match(brook.material.fragmentShader, /sampleRenderedObstacleFlow/);
  assert.match(brook.material.fragmentShader, /potentialPerturbationLocal/);
  assert.match(brook.material.fragmentShader, /alternatingVortex/);
  assert.match(brook.material.fragmentShader, /obstacleContactAeration/);
  assert.match(brook.material.fragmentShader, /obstacleCenterRadiusContact\[12\]/);
  assert.match(brook.material.vertexShader, /sampleObstacleSurfaceDisplacement/);
  assert.match(brook.material.vertexShader, /upstreamCompression/);
  assert.match(brook.material.vertexShader, /sideSpeedup/);
  assert.match(brook.material.vertexShader, /wakeAmplitude/);
  assert.match(brook.material.vertexShader, /vSurfaceDisplacementMeters/);
  assert.match(brook.material.fragmentShader, /signedFlow/);
  assert.match(brook.material.fragmentShader, /hydraulicEnergy/);
  assert.match(brook.material.fragmentShader, /0\.02037/);
  assert.match(brook.material.fragmentShader, /AIR_TO_WATER_ETA = 0\.7501875/);
  assert.match(brook.material.fragmentShader, /perspectiveDepthToViewZ/);
  assert.match(brook.material.fragmentShader, /sceneRefractionDepth/);
  assert.match(brook.material.fragmentShader, /measuredWaterPath/);
  assert.match(brook.material.fragmentShader, /reconstructViewPosition/);
  assert.match(brook.material.fragmentShader, /projectViewPosition/);
  assert.match(brook.material.vertexShader, /vWorldNormal/);
  assert.match(brook.material.fragmentShader, /geometricNormal/);
  assert.match(brook.material.fragmentShader, /waterDepthMeters \/ max\(viewFacing, 0\.32\)/);
  assert.doesNotMatch(brook.material.fragmentShader, /mix\(0\.035, 0\.82, channelDepth\)/);
  const worldSource = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');
  assert.match(worldSource, /new Reflector\(/);
  assert.match(worldSource, /new THREE\.WebGLRenderTarget\(480, 270/);
  assert.match(worldSource, /new THREE\.DepthTexture\(480, 270/);
  assert.match(worldSource, /if \(frameIndex < 1\) return;/);
  assert.match(worldSource, /renderer\.setRenderTarget\(savedRenderTarget\)/);
  assert.match(worldSource, /renderer\.setViewport\(savedViewport\)/);
  assert.match(worldSource, /renderer\.setScissor\(savedScissor\)/);
  assert.match(worldSource, /renderer\.setScissorTest\(savedScissorTest\)/);
  assert.match(worldSource, /cameraProjectionMatrix\.value\.copy\(camera\.projectionMatrix\)/);
  assert.match(worldSource, /cameraProjectionInverse\.value\.copy\(camera\.projectionMatrixInverse\)/);
  assert.equal(typeof world.prepareBrookRender, 'function');
  assert.equal(typeof world.requestBrookReflectionRefresh, 'function');
  const sceneCapture = world.assetSnapshot().brook.sceneCapture;
  assert.deepEqual(sceneCapture, {
    status: 'pending-renderer',
    quality: 'balanced',
    reflectionResolution: [512, 256],
    panoramaBuilds: 1,
    sourceObjectCount: sceneCapture.sourceObjectCount,
    planarResolution: [320, 180],
    planarCaptures: 0,
    reachCount: 19,
    activeReachId: 'reach-07',
    activeBranch: 'north-headwater',
    activePlaneHeight: -1.8956,
    activePlaneNormal: [-0.009159, 0.998757, -0.048993],
    activePlaneTolerance: 0.1837,
    reachSwitches: 0,
    refractionResolution: [480, 270],
    refractionCaptures: 0,
    reflectionMode: 'scene-layout-equirectangular-probe-fallback',
    ssrMode: 'pending-same-camera-depth-screen-space-reflection',
    ssrSteps: 12,
    ssrRangeMeters: 38,
    planarMode: 'camera-selected-oblique-clipped-gravity-reach-reflection',
    refractionMode: 'same-camera-depth-refracted-scene-with-channel-bed-fallback',
    renderError: null,
  });
  assert.ok(sceneCapture.sourceObjectCount > 0);
  assert.deepEqual(world.assetSnapshot().brook.hydrology, {
    version: 'gravity-drained-twin-reach-losing-basin-v1',
    drainageModel: 'two-headwater-reaches-drain-to-saturated-infiltration-hollow',
    crossChannelSurfaceModel: 'gravity-level-cross-section',
    surfaceEnergyModel:
      'downstream-grade-and-rendered-obstacle-coupled-ripple-roughness-and-aeration',
    reflectionModel: 'camera-selected-local-tangent-plane-with-spatial-validity-mask',
    screenSpaceReflectionModel:
      'screen-space-reflected-ray-over-local-planar-and-scene-probe-fallback',
    sampleCount: 73,
    confluenceIndex: 35,
    confluence: [-10.5191, -2.3694, 6.9222],
    minimumDownstreamGrade: 0.0008,
    maximumDownstreamGrade: 0.102611,
    maximumFlowEnergy: 1,
    maximumPondingDepth: 0.1273,
    maximumBedClearance: 0.2473,
    crossChannelGrade: 0,
    northHeadwaterDrop: 3.087,
    southHeadwaterDrop: 3.6565,
    reflectionReachCount: 19,
  });
  const obstacleFlow = world.assetSnapshot().brook.obstacleFlow;
  assert.equal(obstacleFlow.version, BROOK_OBSTACLE_FLOW_PROFILE.version);
  assert.equal(obstacleFlow.model, BROOK_OBSTACLE_FLOW_PROFILE.model);
  assert.equal(obstacleFlow.candidateCount, 62);
  assert.equal(obstacleFlow.qualifyingCount, 37);
  assert.equal(obstacleFlow.selectedCount, 12);
  assert.equal(obstacleFlow.maximumObstacleCount, 12);
  assert.deepEqual(obstacleFlow.activeCountByQuality, { low: 4, balanced: 8, high: 12 });
  assert.deepEqual(obstacleFlow.selectedSourceClasses, [
    'historical-high-flow-rounded-lag',
    'active-channel-bed-load',
  ]);
  assert.equal(obstacleFlow.selectedIds[0], 'brook-cobble-east-1');
  assert.deepEqual(obstacleFlow.rejectionCounts, {
    'outside-rendered-wetted-channel': 25,
    'bounded-uniform-budget': 25,
  });
  assert.ok(obstacleFlow.maximumNormalSlope <= 0.052);
  assert.ok(obstacleFlow.maximumAeration <= 0.31);
  assert.equal(obstacleFlow.obstacles.length, 12);
  assert.ok(obstacleFlow.obstacles.every((obstacle) => (
    obstacle.channelDistance <= 3.4 * 0.54
      && obstacle.wakeLengthMeters > obstacle.radiusMeters
      && Math.hypot(...obstacle.flowDirection) > 0.999
  )));
  assert.equal(brook.material.uniforms.obstacleCount.value, 8);
  world.update(2, false, { quality: 'low' });
  assert.equal(brook.material.uniforms.obstacleCount.value, 4);
  world.update(2.1, false, { quality: 'high' });
  assert.equal(brook.material.uniforms.obstacleCount.value, 12);
  assert.deepEqual(world.assetSnapshot().brook.freeSurface, {
    version: 'tessellated-obstacle-coupled-free-surface-v1',
    model:
      'gravity-base-level-with-clast-pressure-speedup-and-downstream-shedding-displacement',
    grid: [4, 13],
    longitudinalRows: 289,
    vertexCount: 3757,
    triangleCount: 6912,
    displacementRangeMeters: [-0.038, 0.038],
    maximumUpstreamCompressionMeters: 0.032,
    maximumSideDrawdownMeters: 0.012,
    maximumWakeAmplitudeMeters: 0.018,
    volumeContract:
      'zero-mean-oscillatory-wake-with-local-upstream-rise-and-side-drawdown-over-fixed-base-level',
    evidenceBoundary:
      'centimetre-bounded-visual-free-surface-not-shallow-water-cfd-or-volume-conservation-proof',
  });
  const brookNormalBytes = brookNormal.image.data;
  let brookGreen = 0;
  let brookBlue = 0;
  const encodedSlopes = [];
  for (let index = 0; index < brookNormalBytes.length; index += 4) {
    brookGreen += brookNormalBytes[index + 1];
    brookBlue += brookNormalBytes[index + 2];
    encodedSlopes.push(Math.hypot(
      brookNormalBytes[index] / 255 * 2 - 1,
      brookNormalBytes[index + 1] / 255 * 2 - 1,
    ));
  }
  assert.ok(brookBlue > brookGreen * 1.7, 'tangent-space brook normals must point through blue/Z');
  encodedSlopes.sort((a, b) => a - b);
  const meanEncodedSlope = encodedSlopes.reduce((sum, slope) => sum + slope, 0)
    / encodedSlopes.length;
  assert.ok(meanEncodedSlope >= 0.055 && meanEncodedSlope <= 0.072, meanEncodedSlope);
  assert.ok(encodedSlopes[Math.floor(encodedSlopes.length * 0.95)] <= 0.145);
  assert.ok(encodedSlopes.at(-1) <= 0.33);
  for (const side of ['left', 'right']) {
    const wetEdge = scene.getObjectByName(`world.connected_route.brook-${side}-wet-edge`);
    assert.ok(wetEdge.isGroup);
    assert.equal(wetEdge.children.length, 0);
    assert.equal(wetEdge.userData.surface, 'terrain-integrated-fluvial-bank-transition');
    assert.equal(wetEdge.userData.bankOverlayGeometryCount, 0);
  }
  const driftwood = scene.getObjectByName('world.connected_route.brook-driftwood');
  assert.ok(driftwood.isInstancedMesh);
  assert.equal(driftwood.count, 4);
  assert.equal(
    driftwood.geometry.userData.profile,
    'closed-curved-branched-deadwood-with-jagged-fibre-breaks',
  );
  assert.equal(
    driftwood.geometry.userData.surface,
    'mapped-furrowed-bark-with-distinct-end-grain-and-splinters',
  );
  assert.ok(driftwood.geometry.userData.triangleCount >= 900);
  assert.ok(driftwood.geometry.userData.closedSegmentCount >= 7);
  assert.ok(driftwood.geometry.userData.splinterCount >= 4);
  assert.equal(
    driftwood.geometry.userData.loadPath,
    'closed-overlapping-trunk-to-branch-volumes-with-tapered-fibre-breaks',
  );
  assert.ok(driftwood.geometry.attributes.color);
  assert.ok(driftwood.geometry.attributes.uv);
  assert.equal(driftwood.material.userData.moistureClass, 'brook-bank-wet');
  assert.equal(driftwood.material.flatShading, false);
  assert.ok(driftwood.material.map);
  const driftwoodSnapshot = world.assetSnapshot().brook.driftwood;
  assert.equal(driftwoodSnapshot.instanceCount, 10);
  assert.equal(driftwoodSnapshot.drawCalls, 3);
  assert.equal(driftwoodSnapshot.supportEvidence.instanceCount, 10);
  assert.ok(driftwoodSnapshot.supportEvidence.supportSampleCount >= 30);
  assert.ok(driftwoodSnapshot.supportEvidence.minimumClearance >= -0.12);
  assert.ok(driftwoodSnapshot.supportEvidence.maximumClearance <= 0.016);
  assert.equal(scene.getObjectByName('world.connected_route.brook-driftwood-variant-2').count, 3);
  assert.equal(scene.getObjectByName('world.connected_route.brook-driftwood-variant-3').count, 3);
  assert.equal(scene.getObjectByName('world.connected_route.brook-glint'), undefined);
  assert.match(brook.material.fragmentShader, /channelDepth/);
  assert.match(brook.material.fragmentShader, /bankAeration/);
  assert.match(brook.material.fragmentShader, /fresnel/);
  const brookStones = scene.getObjectByName('world.connected_route.brook-stones');
  assert.ok(brookStones.isInstancedMesh);
  assert.equal(brookStones.geometry.userData.profile, 'weathered-fractured-rock-detail-1');
  assert.equal(
    brookStones.geometry.userData.topology,
    'single-support-ring-to-abraded-crown-with-closed-bottom-cap',
  );
  assert.equal(brookStones.geometry.userData.supportRingCount, 1);
  assert.equal(brookStones.geometry.userData.collapsedSupportRingCount, 0);
  assert.equal(
    brookStones.geometry.userData.supportNormalBoundary,
    'split-side-course-and-downward-cap-vertices',
  );
  assert.equal(brookStones.geometry.userData.supportVertexCount, 21);
  assert.ok(brookStones.geometry.userData.minimumTriangleArea > 0.001);
  assert.equal(brookStones.geometry.boundingBox.min.y, 0);
  const brookStoneNormals = brookStones.geometry.getAttribute('normal');
  assert.ok(Array.from({ length: 10 }, (_, index) => brookStoneNormals.getY(index)).every(
    (normalY) => normalY > -0.08,
  ));
  assert.ok(Array.from({ length: 11 }, (_, index) => brookStoneNormals.getY(index + 50)).every(
    (normalY) => normalY < -0.95,
  ));
  assert.equal(
    brookStones.userData.contactModel,
    'terrain-normal-aligned-shallow-bed-and-bar-deposition',
  );
  assert.equal(
    brookStones.userData.distribution,
    'gravity-flow-bed-load-and-inner-bend-point-bar-lag',
  );
  assert.equal(brookStones.userData.sedimentSorting.activeBedCount, 36);
  assert.equal(brookStones.userData.sedimentSorting.pointBarLagCount, 20);
  assert.equal(brookStones.userData.sedimentSorting.supportEvidence.length, 56);
  const activeBedStones = brookStones.userData.sedimentSorting.supportEvidence
    .filter(({ depositionClass }) => depositionClass === 'active-channel-bed-load');
  const pointBarStones = brookStones.userData.sedimentSorting.supportEvidence
    .filter(({ depositionClass }) => depositionClass === 'inner-bend-point-bar-coarse-lag');
  assert.equal(activeBedStones.length, 36);
  assert.equal(pointBarStones.length, 20);
  assert.ok(activeBedStones.every(({ channelDistance }) => channelDistance <= 1.8));
  assert.ok(pointBarStones.every(({ pointBarProcess, pointBarDeposit, routeWear }) => (
    pointBarProcess > 0.14 && pointBarDeposit > 0.1 && routeWear < 0.18
  )));
  assert.ok(brookStones.userData.sedimentSorting.supportEvidence.every((support) => (
    support.maximumSupportClearance <= 0.025
      && support.contactVertexCount >= 3
      && support.supportVertexCount === 21
  )));
  assert.deepEqual(world.assetSnapshot().brook.sedimentSorting, {
    model: 'meander-energy-sorted-point-bar-floodplain-silt-and-cut-bank-exposure',
    processSource: 'shared-brook-control-line-heightfield-and-bank-curvature',
    distribution: 'gravity-flow-bed-load-and-inner-bend-point-bar-lag',
    contactModel: 'terrain-normal-aligned-shallow-bed-and-bar-deposition',
    geometry: {
      profile: 'weathered-fractured-rock-detail-1',
      topology: 'single-support-ring-to-abraded-crown-with-closed-bottom-cap',
      supportRingCount: 1,
      collapsedSupportRingCount: 0,
      supportNormalBoundary: 'split-side-course-and-downward-cap-vertices',
      supportVertexCount: 21,
      minimumTriangleArea: 0.025994,
    },
    material: {
      surface: 'seam-free-vertex-mineral-varied-rough-dielectric-stream-stone',
      mapping: 'no-spherical-uv-texture-sampling',
      colourMultiplier: '#858e89',
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.06,
    },
    activeBedCount: 36,
    pointBarLagCount: 20,
    maximumSupportClearance: -0.0118,
    minimumContactVertexCount: 21,
  });
  assert.equal(brookStones.material.map, null);
  assert.equal(brookStones.material.roughnessMap, null);
  assert.equal(brookStones.material.bumpMap, null);
  assert.equal(
    brookStones.material.userData.surface,
    'seam-free-vertex-mineral-varied-rough-dielectric-stream-stone',
  );
  assert.equal(brookStones.material.userData.mapping, 'no-spherical-uv-texture-sampling');
  assert.equal(`#${brookStones.material.color.getHexString()}`, '#858e89');
  const brookBoulderAnchor = scene.getObjectByName('world.connected_route.brook-boulder');
  const brookBoulder = brookBoulderAnchor.userData.fallback;
  assert.equal(brookBoulder.parent, brookBoulderAnchor);
  assert.equal(brookBoulderAnchor.userData.visualSource, 'procedural-fallback');
  assert.equal(brookBoulderAnchor.userData.transportClass, BROOK_BOULDER.transportClass);
  assert.equal(brookBoulderAnchor.userData.presentFlowMobility, 'immobile');
  assert.equal(brookBoulder.geometry.userData.profile, 'weathered-fractured-rock-detail-2');
  assert.equal(brookBoulder.geometry.userData.flatBase, true);
  assert.equal(brookBoulder.geometry.userData.uvProfile, 'indexed-spherical-rock-uv');
  assert.equal(brookBoulder.geometry.userData.normalProfile, 'continuous-indexed-surface-normals');
  assert.ok(brookBoulder.geometry.index, 'hero rock must share vertices for continuous lighting');
  assert.equal(
    brookBoulder.material.userData.surface,
    'continuous-weathered-rock-fracture-and-wetness',
  );
  assert.deepEqual(brookBoulder.material.userData.layers, [
    'broad-clipped-fracture-planes',
    'continuous-weathered-edge-normals',
    'restrained-mineral-variation',
    'dark-lower-capillary-band',
    'seam-free-triplanar-albedo-roughness-relief',
  ]);
  assert.equal(brookBoulder.material.map, null, 'hero rock must not expose a spherical albedo seam');
  assert.equal(brookBoulder.material.roughnessMap, null);
  assert.equal(brookBoulder.material.bumpMap, null, 'hero rock must not expose a spherical bump seam');
  assert.equal(brookBoulder.material.flatShading, false);
  assert.equal(
    brookBoulder.material.customProgramCacheKey(),
    'hero-rock-triplanar-weathering-v1',
  );
  assert.equal(
    brookBoulder.material.userData.triplanarTextures.albedo.name,
    'world.material.weathered-rock-albedo',
  );
  assert.equal(
    brookBoulder.material.userData.triplanarTextures.roughness.name,
    'world.material.weathered-rock-roughness',
  );
  assert.equal(
    brookBoulder.material.userData.triplanarTextures.height.name,
    'world.material.weathered-rock-height',
  );
  assert.equal(
    brookBoulderAnchor.userData.supportModel,
    'sediment-embedded-flat-base-multipoint-contact',
  );
  assert.ok(brookBoulderAnchor.userData.supportVertexCount >= 4);
  brookBoulderAnchor.updateMatrixWorld(true);
  const rockPosition = brookBoulder.geometry.getAttribute('position');
  const rockVertex = new THREE.Vector3();
  let minimumRockClearance = Infinity;
  for (let index = 0; index < rockPosition.count; index += 1) {
    rockVertex.fromBufferAttribute(rockPosition, index);
    brookBoulder.localToWorld(rockVertex);
    minimumRockClearance = Math.min(
      minimumRockClearance,
      rockVertex.y - terrainHeight(rockVertex.x, rockVertex.z),
    );
  }
  assert.ok(minimumRockClearance >= -0.05, 'hero rock burial must remain shallow');
  assert.ok(minimumRockClearance <= -0.02, 'hero rock must settle into bank sediment');
  assert.equal(
    brookBoulder.geometry.userData.weathering,
    'broad-clipped-fracture-planes-with-rounded-edges',
  );
  assert.equal(
    brookBoulder.geometry.userData.moistureProfile,
    'darkened-lower-capillary-band',
  );
  const boulderCollider = NAVIGATION.obstacles.find(({ id }) => id === 'brook-boulder');
  const visualWidth = (brookBoulder.geometry.boundingBox.max.x
    - brookBoulder.geometry.boundingBox.min.x) * brookBoulderAnchor.scale.x;
  const visualDepth = (brookBoulder.geometry.boundingBox.max.z
    - brookBoulder.geometry.boundingBox.min.z) * brookBoulderAnchor.scale.z;
  const visualRadius = Math.max(visualWidth, visualDepth) * 0.5;
  assert.ok(Math.abs(boulderCollider.radius - visualRadius) <= 0.22);
  assert.ok(boulderCollider.height <= 1.5, 'boulder collider must not extend far above its mesh');
  const groundStones = scene.getObjectByName('world.connected_route.ground-stones');
  assert.equal(groundStones.geometry.userData.profile, 'weathered-fractured-rock-detail-1');
  assert.equal(groundStones.material.map.name, 'world.material.weathered-rock-albedo');
  assert.equal(
    groundStones.userData.contactModel,
    'terrain-normal-aligned-flat-base-shallow-burial',
  );
  const ripples = scene.getObjectByName('world.connected_route.brook-ripples');
  assert.ok(ripples.isGroup);
  assert.equal(ripples.children.length, 0);
  assert.equal(ripples.userData.staticOverlayCount, 0);
  assert.equal(
    ripples.userData.surfaceRole,
    'zero-draw-static-overlay-retired-motion-resolved-in-water-shader',
  );
  const routeAnchor = scene.getObjectByName('world.connected_route.track');
  assert.ok(routeAnchor.isGroup);
  assert.equal(routeAnchor.children.length, 0);
  assert.equal(
    routeAnchor.userData.surface,
    'terrain-integrated-footfall-compaction-not-overlay-ribbon',
  );
  assert.equal(routeAnchor.userData.overlayGeometryCount, 0);
  assert.equal(routeAnchor.userData.overlayDrawCalls, 0);
  assert.equal(routeAnchor.userData.collisionChange, 'none');
  const sunLane = scene.getObjectByName('world.iguanodon_glade.sun_lane');
  assert.equal(sunLane.userData.profile, 'directional-sun-revealed-by-local-humidity');
  assert.equal(sunLane.userData.energyModel, 'no-emissive-ground-overlay');
  assert.equal(
    scene.getObjectByName('world.iguanodon_glade.sun_lane.ground-feather'),
    undefined,
  );
  assert.equal(
    scene.getObjectByName('world.iguanodon_glade.sun_lane.humidity-motes').geometry.userData.profile,
    'local-humidity-sun-motes',
  );
  assert.equal(
    scene.getObjectByName('world.iguanodon_glade.sun_lane.humidity-motes').material.type,
    'ShaderMaterial',
  );
  const humidityShafts = scene.getObjectByName('world.iguanodon_glade.sun_lane.humidity-shafts');
  assert.equal(humidityShafts.userData.profile, 'localized-broken-volumetric-planes');
  assert.equal(humidityShafts.children.length, 3);
  assert.ok(humidityShafts.children.every((shaft) => (
    shaft.userData.profile === 'broken-world-space-humidity-shaft'
      && shaft.material.type === 'ShaderMaterial'
      && shaft.material.depthWrite === false
  )));
  assert.equal(scene.getObjectByName('world.atmosphere.humidity-band'), undefined);
  const basaltSeams = scene.getObjectByName('world.connected_route.red-basalt-fracture-seams');
  const basaltSpalls = scene.getObjectByName('world.connected_route.red-basalt-spall-ledges');
  assert.ok(basaltSeams.isInstancedMesh);
  assert.ok(basaltSpalls.isInstancedMesh);
  assert.equal(basaltSeams.count, SCENE_BUDGET.basaltPillars * 2);
  assert.equal(basaltSpalls.count, SCENE_BUDGET.basaltPillars);
  assert.equal(basaltSeams.geometry.userData.profile, 'polygon-following-cross-joint-seam');
  assert.equal(basaltSpalls.geometry.userData.profile, 'attached-basalt-spall-ledge');
  const basaltCrusts = scene.getObjectByName('world.connected_route.red-basalt-mineral-crusts');
  assert.ok(basaltCrusts.isInstancedMesh);
  assert.equal(basaltCrusts.count, SCENE_BUDGET.basaltPillars * 2);
  assert.equal(basaltCrusts.geometry.userData.profile, 'thin-mineral-weathering-crust');
  assert.ok(basalt.geometry.attributes.uv);
  assert.equal(basalt.material.userData.surface, 'oxidized-columnar-basalt-with-cooling-joints');
  assert.equal(basalt.material.map.name, 'world.material.basalt-albedo');
  assert.equal(basalt.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(basalt.material.roughnessMap.name, 'world.material.basalt-roughness');
  assert.equal(basalt.material.bumpMap.name, 'world.material.basalt-height');
  assert.notEqual(basalt.material.map, basalt.material.roughnessMap);
  assert.notEqual(basalt.material.roughnessMap, basalt.material.bumpMap);
  assert.equal(basalt.userData.formationCount, 3);
  assert.equal(basalt.userData.columnsPerFormation, 6);
  assert.equal(
    basalt.userData.formationFrame,
    'shared-cooling-front-normal-with-bounded-jitter',
  );
  assert.equal(basalt.userData.contactModel, 'buried-into-continuous-bedrock-outcrop');
  const basaltOutcrops = scene.getObjectByName(
    'world.connected_route.red-basalt-bedrock-outcrops',
  );
  assert.ok(basaltOutcrops.isMesh);
  assert.equal(
    basaltOutcrops.geometry.userData.profile,
    'terrain-conforming-shared-bedrock-outcrop',
  );
  assert.equal(basaltOutcrops.geometry.userData.formationCount, 3);
  assert.equal(
    basaltOutcrops.geometry.userData.contactModel,
    'buried-columns-on-continuous-weathered-bedrock',
  );
  assert.equal(basaltOutcrops.material.userData.surface, 'weathered-continuous-basalt-bedrock');
  const basaltRubble = scene.getObjectByName('world.connected_route.red-basalt-rubble');
  assert.equal(basaltRubble.userData.distribution, 'pillar-base-downslope-talus');
  assert.equal(basaltRubble.userData.sourcePillarCount, SCENE_BUDGET.basaltPillars);
  assert.equal(
    basaltRubble.userData.settling,
    'terrain-normal-aligned-multipoint-buried-support',
  );
  assert.equal(
    basaltRubble.userData.supportModel,
    'closed-flat-footprint-gravity-rest-on-sourced-heightfield',
  );
  assert.equal(basaltRubble.userData.collisionRole, 'non-solid-outside-navigation-boundary');
  assert.equal(basaltRubble.geometry.userData.profile, 'joint-bounded-angular-talus-block');
  assert.equal(basaltRubble.geometry.userData.supportPlane, 'coplanar-broad-footprint-y0');
  assert.equal(basaltRubble.material.userData.surface, 'dark-weathered-oxidized-basalt-talus');
  assert.equal(basaltRubble.material.roughness, 0.99);
  assert.equal(basaltRubble.material.metalness, 0);
  assert.equal(basaltRubble.userData.supportEvidence.length, 44);
  assert.ok(basaltRubble.userData.supportEvidence.every((entry) => (
    entry.contactVertexCount === entry.supportVertexCount
  )));
  const basaltRubbleSnapshot = world.assetSnapshot().basaltRubble;
  assert.equal(basaltRubbleSnapshot.count, 44);
  assert.equal(basaltRubbleSnapshot.drawCalls, 1);
  assert.equal(basaltRubbleSnapshot.surface, 'dark-weathered-oxidized-basalt-talus');
  assert.equal(basaltRubbleSnapshot.supportEvidence.placementCount, 44);
  assert.equal(basaltRubbleSnapshot.supportEvidence.supportedPlacementCount, 44);
  assert.equal(basaltRubbleSnapshot.supportEvidence.supportRatio, 1);
  assert.ok(basaltRubbleSnapshot.supportEvidence.maximumSupportClearance <= 0.015);
  assert.ok(basaltRubbleSnapshot.supportEvidence.minimumSupportClearance >= -0.045);
  assert.ok(basaltRubbleSnapshot.supportEvidence.minimumContactVertexCount >= 8);
  assert.ok(basaltRubbleSnapshot.supportEvidence.minimumWorldX > 29);
  const [minimumRubbleBurial, maximumRubbleBurial] = (
    basaltRubbleSnapshot.supportEvidence.burialRangeMeters
  );
  assert.ok(minimumRubbleBurial >= 0.018);
  assert.ok(maximumRubbleBurial <= 0.04);
  assert.ok(maximumRubbleBurial - minimumRubbleBurial >= 0.02);
  const coverArches = scene.getObjectByName('world.connected_route.cover_arches');
  assert.equal(coverArches.userData.profile, 'asymmetric-riparian-overlap-canopy');
  assert.equal(coverArches.userData.archCount, 0);
  assert.equal(coverArches.userData.pairCount, 5);
  assert.equal(coverArches.userData.treeCount, 10);
  assert.equal(coverArches.userData.bridgeGeometryCount, 0);
  assert.equal(coverArches.userData.rootAnchorsPreserved, true);
  assert.equal(
    coverArches.userData.loadPath,
    'ten-independent-roots-to-trunks-to-branches-to-attached-crowns',
  );
  const coverLeafDetail = scene.getObjectByName('world.connected_route.cover-arch-leaf-detail');
  assert.ok(coverLeafDetail?.isInstancedMesh);
  assert.equal(coverLeafDetail.count, 30);
  assert.equal(coverLeafDetail.geometry.userData.profile, 'branch-supported-volumetric-leaf-spray');
  assert.equal(coverLeafDetail.geometry.userData.cardCount, 0);
  assert.ok(coverLeafDetail.geometry.userData.leafCount >= 12);
  assert.equal(coverLeafDetail.geometry.userData.closedSurface, true);
  assert.equal(
    coverLeafDetail.geometry.userData.supportModel,
    'bough-to-rachis-to-petiole-to-leaf-blade',
  );
  assert.ok(coverLeafDetail.geometry.getAttribute('color'));
  assert.equal(
    coverLeafDetail.material.userData.energyModel,
    'shadow-aware-beer-lambert-thin-leaf-transmission',
  );
  assert.equal(coverLeafDetail.material.userData.transmissionModel.emissive, false);
  assert.equal(coverLeafDetail.material.map, null);
  assert.equal(coverLeafDetail.material.emissiveIntensity, 0);
  assert.equal(
    coverLeafDetail.material.userData.surface,
    'closed-volume-matte-leaf-blades-with-visible-rachis',
  );
  assert.equal(coverLeafDetail.castShadow, false);
  assert.equal(coverLeafDetail.receiveShadow, false);
  assert.equal(
    coverLeafDetail.userData.shadowModel,
    'aggregate-crown-owns-canopy-occlusion',
  );
  assert.ok(coverArches.userData.minimumHalfClearance >= 3.4);
  const coverTrunks = coverArches.children.filter(
    (child) => child.name.startsWith('riparian-rooted-trunk'),
  );
  const coverBoughs = coverArches.children.filter(
    (child) => child.name.startsWith('root-supported-riparian-bough'),
  );
  const coverCrowns = coverArches.children.filter(
    (child) => child.name.startsWith('tree-supported-'),
  );
  assert.equal(coverTrunks.length, 10);
  assert.equal(coverBoughs.length, 10);
  assert.equal(coverCrowns.length, 15);
  assert.ok(new Set(coverTrunks.map((trunk) => trunk.scale.y.toFixed(4))).size >= 8);
  assert.ok(coverBoughs.every((bough) => (
    bough.geometry.userData.profile === 'single-root-supported-asymmetric-riparian-bough'
      && bough.geometry.userData.crossTrunkBridge === false
      && bough.geometry.userData.maximumHorizontalCantileverMeters <= 2.34
      && bough.userData.sourceRoot.length === 2
  )));
  assert.equal(
    coverArches.children.filter((child) => child.name.startsWith('organic-arch-bough')).length,
    0,
  );
  assert.ok(coverArches.children.every((child) => child.material.vertexColors));
  const coverBough = coverArches.children.find(
    (child) => child.name === 'root-supported-riparian-bough-1-left',
  );
  assert.equal(coverBough.material.userData.surface, 'mapped-non-emissive-damp-bark');
  assert.equal(coverBough.material.emissiveIntensity, 0);
  assert.equal(coverBough.material.map.name, 'world.material.bark-albedo');
  assert.equal(coverBough.material.roughnessMap.name, 'world.material.bark-roughness');
  assert.equal(coverBough.material.bumpMap.name, 'world.material.bark-height');
  const coverAssetAnchor = scene.getObjectByName(
    'world.connected_route.cover-riparian-tree-asset-anchor',
  );
  assert.equal(coverAssetAnchor.children.length, COVER_RIPARIAN_TREE_LAYOUT.length);
  coverAssetAnchor.children.forEach((anchor, index) => {
    assert.ok(anchor.userData.canopyTreePlacementAnchor);
    assert.equal(anchor.position.x, COVER_RIPARIAN_TREE_LAYOUT[index].x);
    assert.equal(anchor.position.z, COVER_RIPARIAN_TREE_LAYOUT[index].z);
    assert.equal(anchor.position.y, terrainHeight(
      COVER_RIPARIAN_TREE_LAYOUT[index].x,
      COVER_RIPARIAN_TREE_LAYOUT[index].z,
    ));
  });
  assert.notEqual(trunks.geometry.type, 'CylinderGeometry');
  assert.notEqual(basalt.geometry.type, 'CylinderGeometry');
});

test('broadleaf bark and leaf families preserve support, attachment and material energy truth', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const snapshot = world.assetSnapshot().vegetation;
  assert.equal(snapshot.profile, 'two-broadleaf-bark-and-leaf-families-plus-araucaria');
  assert.equal(snapshot.trunkFamilies.length, 2);
  assert.equal(snapshot.leafFamilies.length, 2);
  assert.deepEqual(
    snapshot.trunkFamilies.map(({ barkFamily }) => barkFamily),
    ['wet-furrowed-buttress', 'plate-barked-fibrous'],
  );
  assert.deepEqual(
    snapshot.leafFamilies.map(({ family }) => family),
    ['elliptic-waxy', 'compound-lanceolate'],
  );
  assert.ok(snapshot.trunkFamilies.every(({ albedo, roughness, height }) => (
    albedo !== roughness && roughness !== height && albedo !== height
  )));
  assert.ok(snapshot.leafFamilies.every(({ energyModel }) => (
    energyModel === 'shadow-aware-beer-lambert-thin-leaf-transmission'
  )));
  assert.ok(snapshot.leafFamilies.every(({ windModel, shadowDisplacement }) => (
    windModel.supportModel === 'branch-attached-uv-base-with-flexible-leaf-tip'
    && shadowDisplacement === 'shared-displacement-uniforms-for-colour-and-depth-pass'
  )));
  assert.equal(snapshot.interiorMassRole, 'bounded-interior-canopy-mass');

  const branchMatrix = new THREE.Matrix4();
  const leafMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (const tree of VEGETATION_LAYOUT.trees.filter(({ isAraucaria }) => !isAraucaria)) {
    const compound = tree.leafFamily === 'compound-lanceolate';
    const branchMesh = scene.getObjectByName(compound
      ? 'world.connected_route.canopy-load-bearing-branches-plate-barked'
      : 'world.connected_route.canopy-load-bearing-branches');
    const leafMesh = scene.getObjectByName(compound
      ? 'world.connected_route.canopy-leaf-detail-compound'
      : 'world.connected_route.canopy-leaf-detail');
    branchMesh.getMatrixAt(tree.canopyFamilyIndex, branchMatrix);
    leafMesh.getMatrixAt(tree.canopyFamilyIndex, leafMatrix);
    branchMatrix.elements.forEach((value, index) => {
      assert.ok(
        Math.abs(value - leafMatrix.elements[index]) < 0.000001,
        `${tree.index} leaf sprays must inherit their exact supporting branch transform`,
      );
    });
    position.setFromMatrixPosition(leafMatrix);
    assert.ok(Math.abs(position.x - tree.x) < 0.0001);
    assert.ok(Math.abs(position.z - tree.z) < 0.0001);
    assert.ok(
      Math.abs(position.y - (terrainHeight(tree.x, tree.z) + 4.78 * tree.scale)) < 0.0001,
    );
    assert.deepEqual(
      leafMesh.geometry.userData.anchorPositions,
      branchMesh.geometry.userData.leafAnchorPositions,
    );
  }

  for (const mesh of world.vegetation.trunkMeshes) {
    const positions = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    let downwardSupportNormals = 0;
    let upwardSupportNormals = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index)) > 0.000001) continue;
      if (normals.getY(index) < -0.5) downwardSupportNormals += 1;
      if (normals.getY(index) > 0.5) upwardSupportNormals += 1;
    }
    assert.ok(downwardSupportNormals > 0, `${mesh.name} needs a downward-facing root plane`);
    assert.equal(upwardSupportNormals, 0, `${mesh.name} root cap winding is reversed`);
  }
});

test('non-columnar rock families are terrain-supported, habitat-specific and collision-honest', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const group = scene.getObjectByName('world.authored-non-columnar-rock-families');
  const families = [
    scene.getObjectByName('world.connected_route.rock-family.fluvial-cobbles'),
    scene.getObjectByName('world.connected_route.rock-family.bedded-glade-slabs'),
    scene.getObjectByName('world.ridge-foot.rock-family.angular-talus'),
  ];

  assert.equal(world.nonColumnarRockFamilies, group);
  assert.equal(group.userData.profile, 'three-geology-specific-non-columnar-rock-families');
  assert.equal(group.userData.placementCount, NON_COLUMNAR_ROCK_LAYOUT.length);
  assert.equal(group.children.length, 3);
  const rockSnapshot = world.assetSnapshot().nonColumnarRocks;
  assert.equal(rockSnapshot.profile, group.userData.profile);
  assert.equal(rockSnapshot.placementCount, NON_COLUMNAR_ROCK_LAYOUT.length);
  assert.equal(rockSnapshot.families.length, 3);
  assert.deepEqual(rockSnapshot.fluvialTransport, FLUVIAL_ROCK_TRANSPORT_PROFILE);
  assert.equal(
    rockSnapshot.fluvialTransport.hydraulicEvidenceBoundary,
    'grade-only-water-model-does-not-prove-exact-transport-competence',
  );
  assert.ok(rockSnapshot.families.every(({ mapping }) => (
    mapping === 'seam-free-object-space-triplanar'
  )));
  for (const family of families) {
    assert.ok(family.isInstancedMesh);
    assert.equal(family.geometry.userData.columnar, false);
    assert.equal(family.geometry.userData.source, 'original-code-authored-non-columnar-rock');
    assert.equal(family.geometry.userData.supportPlane, 'coplanar-broad-footprint-y0');
    assert.equal(
      family.geometry.userData.centerOfMassProjection,
      'inside-convex-support-footprint',
    );
    assert.ok(family.geometry.userData.supportVertexCount >= 8);
    if (family.userData.family === 'bedded-slab') {
      assert.equal(family.geometry.index, null, 'creased slab faces need independent normals');
    } else {
      assert.ok(family.geometry.index);
    }
    assert.ok(family.geometry.attributes.normal);
    assert.ok(family.geometry.attributes.uv);
    const positions = family.geometry.attributes.position;
    const normals = family.geometry.attributes.normal;
    const crownY = family.geometry.boundingBox.max.y;
    const supportY = family.geometry.boundingBox.min.y;
    let skywardCrownNormals = 0;
    let downwardSupportNormals = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) >= crownY - 0.08 && normals.getY(index) > 0.72) {
        skywardCrownNormals += 1;
      }
      if (positions.getY(index) <= supportY + 0.0001 && normals.getY(index) < -0.72) {
        downwardSupportNormals += 1;
      }
    }
    assert.ok(skywardCrownNormals > 0, `${family.name} crown needs a skyward weathering face`);
    assert.ok(downwardSupportNormals > 0, `${family.name} support plane must face downward`);
    assert.deepEqual(family.material.userData.channels, [
      'world.material.weathered-rock-albedo',
      'world.material.weathered-rock-roughness',
      'world.material.weathered-rock-height',
    ]);
    assert.equal(family.material.map, null, 'large rocks must not expose a spherical albedo seam');
    assert.equal(family.material.roughnessMap, null);
    assert.equal(family.material.bumpMap, null, 'large rocks must not expose a spherical relief seam');
    assert.equal(family.material.userData.mapping, 'seam-free-object-space-triplanar');
    assert.equal(
      family.material.userData.triplanarTextures.albedo.name,
      'world.material.weathered-rock-albedo',
    );
    assert.equal(
      family.material.userData.triplanarTextures.roughness.name,
      'world.material.weathered-rock-roughness',
    );
    assert.equal(
      family.material.userData.triplanarTextures.height.name,
      'world.material.weathered-rock-height',
    );
    assert.match(family.material.customProgramCacheKey(), /non-columnar-rock-triplanar-v2-/);
    assert.equal(
      family.userData.contactModel,
      'terrain-normal-aligned-coplanar-footprint-shallow-burial',
    );
    assert.equal(family.userData.supportEvidence.length, family.count);
    for (const support of family.userData.supportEvidence) {
      assert.ok(support.minimumSupportClearance >= -support.burial - 1e-6);
      assert.ok(support.maximumSupportClearance <= 0.025);
      assert.ok(support.contactVertexCount >= 3);
      assert.equal(support.supportVertexCount, family.geometry.userData.supportVertexCount);
    }
  }

  const fluvial = families[0];
  const slabs = families[1];
  const talus = families[2];
  assert.equal(fluvial.geometry.userData.profile, 'historical-high-flow-rounded-lag-clast');
  assert.equal(
    fluvial.geometry.userData.topology,
    'single-support-ring-to-rounded-crown-with-non-overlapping-bottom-cap',
  );
  assert.equal(fluvial.geometry.userData.supportRingCount, 1);
  assert.equal(fluvial.geometry.userData.collapsedSupportRingCount, 0);
  assert.equal(
    fluvial.geometry.userData.supportNormalBoundary,
    'split-side-course-and-downward-cap-vertices',
  );
  assert.ok(fluvial.geometry.userData.minimumTriangleArea > 0.001);
  assert.ok(fluvial.geometry.index, 'fluvial shell must preserve one closed indexed surface');
  const fluvialPositions = fluvial.geometry.getAttribute('position');
  const fluvialIndices = fluvial.geometry.index;
  const triangleA = new THREE.Vector3();
  const triangleB = new THREE.Vector3();
  const triangleC = new THREE.Vector3();
  const triangleEdgeA = new THREE.Vector3();
  const triangleEdgeB = new THREE.Vector3();
  let minimumTriangleArea = Number.POSITIVE_INFINITY;
  for (let index = 0; index < fluvialIndices.count; index += 3) {
    triangleA.fromBufferAttribute(fluvialPositions, fluvialIndices.getX(index));
    triangleB.fromBufferAttribute(fluvialPositions, fluvialIndices.getX(index + 1));
    triangleC.fromBufferAttribute(fluvialPositions, fluvialIndices.getX(index + 2));
    triangleEdgeA.subVectors(triangleB, triangleA);
    triangleEdgeB.subVectors(triangleC, triangleA);
    minimumTriangleArea = Math.min(
      minimumTriangleArea,
      triangleEdgeA.cross(triangleEdgeB).length() * 0.5,
    );
  }
  assert.ok(minimumTriangleArea > 0.001, `degenerate fluvial triangle: ${minimumTriangleArea}`);
  assert.ok(Math.abs(minimumTriangleArea - fluvial.geometry.userData.minimumTriangleArea) < 1e-9);
  assert.equal(fluvial.material.userData.moistureModel, 'porosity-varied-low-capillary-front');
  assert.equal(
    fluvial.userData.distribution,
    'historical-high-flow-lag-now-immobile-under-present-brook',
  );
  assert.equal(fluvial.userData.collisionRole, 'static-solid-historical-lag-clasts');
  assert.deepEqual(fluvial.userData.transportClasses, ['historical-high-flow-rounded-lag']);
  assert.deepEqual(fluvial.userData.presentFlowMobilities, ['immobile']);
  assert.deepEqual(fluvial.userData.longAxisRangeMeters, [1.06, 1.315]);
  assert.equal(fluvial.userData.maximumBrookWidthFraction, 0.387);
  assert.ok(
    fluvial.userData.longAxisRangeMeters[0]
      >= FLUVIAL_ROCK_TRANSPORT_PROFILE.historicalLagLongAxisMeters[0],
  );
  assert.ok(
    fluvial.userData.longAxisRangeMeters[1]
      <= FLUVIAL_ROCK_TRANSPORT_PROFILE.historicalLagLongAxisMeters[1],
  );
  assert.ok(
    fluvial.userData.maximumBrookWidthFraction
      <= FLUVIAL_ROCK_TRANSPORT_PROFILE.historicalLagMaximumBrookWidthFraction,
  );
  assert.equal(slabs.geometry.userData.profile, 'joint-bounded-tabular-plateau-slab');
  assert.equal(slabs.geometry.userData.beddingLedgeCount, 2);
  assert.equal(
    slabs.geometry.userData.normalProfile,
    'thirty-one-degree-creased-bedding-and-joint-normals',
  );
  assert.equal(
    slabs.geometry.userData.silhouetteModel,
    'joint-bounded-broken-rectangle-not-sphere-derived',
  );
  assert.equal(
    slabs.geometry.userData.topology,
    'closed-irregular-ring-stack-with-coplanar-support-cap',
  );
  const slabSize = slabs.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(slabSize.x / slabSize.y > 3.1 && slabSize.x / slabSize.y < 3.6, slabSize.toArray());
  assert.ok(slabSize.z / slabSize.y > 2.4 && slabSize.z / slabSize.y < 2.7, slabSize.toArray());
  assert.equal(talus.geometry.userData.profile, 'joint-bounded-angular-talus-block');
  assert.notDeepEqual(
    Array.from(fluvial.geometry.attributes.position.array),
    Array.from(slabs.geometry.attributes.position.array),
  );
  assert.notDeepEqual(
    Array.from(slabs.geometry.attributes.position.array),
    Array.from(talus.geometry.attributes.position.array),
  );

  const solidRocks = NON_COLUMNAR_ROCK_LAYOUT.filter(({ solid }) => solid);
  assert.equal(solidRocks.length, fluvial.count + slabs.count);
  for (const rock of solidRocks) {
    const collider = NAVIGATION.obstacles.find(({ id }) => id === rock.id);
    assert.ok(collider, `${rock.id} lost collision authority`);
    assert.equal(collider.x, rock.x);
    assert.equal(collider.z, rock.z);
    assert.equal(collider.radius, rock.collisionRadius);
    assert.equal(collider.height, rock.collisionHeight);
    if (rock.family === 'fluvial-cobble') {
      assert.equal(rock.transportClass, 'historical-high-flow-rounded-lag');
      assert.equal(rock.presentFlowMobility, 'immobile');
      assert.equal(collider.category, 'historical-flood-lag');
    }
    assert.ok(
      collider.height > NAVIGATION.playerCapsule.maximumGroundStep,
      `${rock.id} must not be visual-only above the step threshold`,
    );
  }
  for (const rock of NON_COLUMNAR_ROCK_LAYOUT.filter(({ solid }) => !solid)) {
    assert.ok(
      rock.z + rock.scale[2] < NAVIGATION.bounds.minZ,
      `${rock.id} must stay wholly beyond the navigable ridge boundary`,
    );
    assert.equal(NAVIGATION.obstacles.some(({ id }) => id === rock.id), false);
  }
});

test('basalt seams inherit each tilted pillar frame instead of floating in world space', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const pillars = scene.getObjectByName('world.connected_route.red_basalt');
  const seams = scene.getObjectByName('world.connected_route.red-basalt-fracture-seams');
  const pillarMatrix = new THREE.Matrix4();
  const seamMatrix = new THREE.Matrix4();
  const pillarUp = new THREE.Vector3();
  const seamUp = new THREE.Vector3();

  for (let index = 0; index < pillars.count; index += 1) {
    pillars.getMatrixAt(index, pillarMatrix);
    pillarUp.set(pillarMatrix.elements[4], pillarMatrix.elements[5], pillarMatrix.elements[6]).normalize();
    for (let joint = 0; joint < 2; joint += 1) {
      const seamIndex = index * 2 + joint;
      seams.getMatrixAt(seamIndex, seamMatrix);
      seamUp.set(seamMatrix.elements[4], seamMatrix.elements[5], seamMatrix.elements[6]).normalize();
      assert.ok(
        pillarUp.dot(seamUp) > 0.9999,
        `basalt seam ${seamIndex} detached from pillar ${index} tilt`,
      );
    }
  }
});

test('basalt formations share a cooling direction and emerge from terrain-conforming bedrock', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const pillars = scene.getObjectByName('world.connected_route.red_basalt');
  const outcrops = scene.getObjectByName('world.connected_route.red-basalt-bedrock-outcrops');
  const matrix = new THREE.Matrix4();
  const referenceUp = new THREE.Vector3();
  const pillarUp = new THREE.Vector3();
  for (let formation = 0; formation < pillars.userData.formationCount; formation += 1) {
    const start = formation * pillars.userData.columnsPerFormation;
    pillars.getMatrixAt(start, matrix);
    referenceUp.set(matrix.elements[4], matrix.elements[5], matrix.elements[6]).normalize();
    for (let local = 1; local < pillars.userData.columnsPerFormation; local += 1) {
      pillars.getMatrixAt(start + local, matrix);
      pillarUp.set(matrix.elements[4], matrix.elements[5], matrix.elements[6]).normalize();
      assert.ok(
        referenceUp.dot(pillarUp) > 0.975,
        `basalt formation ${formation} lost its common cooling-front normal`,
      );
    }
  }
  const positions = outcrops.geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const relief = y - terrainHeight(x, z);
    assert.ok(relief >= 0.005 && relief <= 0.07, `outcrop relief ${relief} left terrain contact`);
  }
});

test('basalt shelf anchors bury their load-bearing plane and remain outside playable collision space', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const snapshot = world.assetSnapshot().basaltShelf;
  assert.equal(snapshot.visualStatus, 'original-fallback');
  assert.equal(snapshot.loaded, 0);
  assert.equal(snapshot.fallbackVisible, true);
  assert.equal(snapshot.bytes, BASALT_SHELF_ASSET.bytes);
  assert.equal(snapshot.totalAssetTriangles, BASALT_SHELF_ASSET.triangles);
  assert.equal(
    snapshot.trianglesPerFormation,
    Math.max(...BASALT_SHELF_ASSET.trianglesByVariant),
  );
  assert.equal(snapshot.variantCount, BASALT_FORMATION_LAYOUT.length);
  assert.deepEqual(snapshot.variantIds, BASALT_SHELF_ASSET.variantIds);
  assert.equal(snapshot.drawCallsPerFormation, BASALT_SHELF_ASSET.drawCalls);
  assert.equal(world.basalt.assetAnchors.length, BASALT_FORMATION_LAYOUT.length);

  const bottomY = BASALT_SHELF_ASSET.localBounds.min[1];
  const minX = BASALT_SHELF_ASSET.localBounds.min[0];
  const maxX = BASALT_SHELF_ASSET.localBounds.max[0];
  const minZ = BASALT_SHELF_ASSET.localBounds.min[2];
  const maxZ = BASALT_SHELF_ASSET.localBounds.max[2];
  for (const anchor of world.basalt.assetAnchors) {
    anchor.updateMatrixWorld(true);
    const footprint = [
      [minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ],
    ].map(([x, z]) => anchor.localToWorld(new THREE.Vector3(x, bottomY, z)));
    assert.ok(
      Math.min(...footprint.map((point) => point.x)) > NAVIGATION.bounds.maxX,
      `${anchor.name} crosses into playable space without a collider`,
    );
    for (const point of footprint) {
      assert.ok(
        point.y - terrainHeight(point.x, point.z) <= -0.17,
        `${anchor.name} load-bearing corner is not buried`,
      );
    }
    assert.equal(anchor.userData.supportModel, 'terrain-normal-aligned-buried-bedrock-plinth');
    assert.equal(anchor.userData.collisionRole, 'non-solid-outside-navigation-boundary');
  }
});

test('routes and brook banks stay inside the shared terrain while water levels remain physical', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const bank = scene.getObjectByName('world.connected_route.brook-wet-bank');
  assert.ok(bank.isGroup);
  assert.equal(bank.children.length, 0);
  assert.equal(bank.userData.bankOverlayGeometryCount, 0);
  assert.equal(bank.userData.bankOverlayDrawCalls, 0);
  assert.equal(bank.userData.bankTopology, 'single-shared-render-and-collision-heightfield');
  assert.equal(
    bank.userData.contactModel,
    'water-feather-over-shared-terrain-bank-no-raised-ribbon',
  );
  for (const side of ['left', 'right']) {
    const edge = scene.getObjectByName(`world.connected_route.brook-${side}-wet-edge`);
    assert.ok(edge.isGroup, side);
    assert.equal(edge.children.length, 0, side);
    assert.equal(edge.userData.side, side);
    assert.equal(edge.userData.bankOverlayDrawCalls, 0, side);
  }
  const routeNames = [
    'world.connected_route.track',
    'world.connected_route.covered_fork',
    'world.connected_route.exposed_fork',
  ];
  for (const name of routeNames) {
    const anchor = scene.getObjectByName(name);
    assert.ok(anchor.isGroup, name);
    assert.equal(anchor.children.length, 0, name);
    assert.equal(anchor.userData.overlayGeometryCount, 0, name);
    assert.equal(anchor.userData.overlayDrawCalls, 0, name);
    assert.equal(anchor.userData.topology, 'single-shared-render-and-collision-heightfield', name);
    assert.equal(anchor.userData.collisionChange, 'none', name);
  }
  const routeSurface = world.assetSnapshot().terrain.routeSurface;
  assert.equal(routeSurface.version, 'terrain-integrated-footfall-compaction-v1');
  assert.equal(routeSurface.overlayGeometryCount, 0);
  assert.equal(routeSurface.overlayDrawCalls, 0);
  assert.deepEqual(routeSurface.mainRouteInfluenceMeters, [1.4, 3.25]);
  assert.deepEqual(routeSurface.coveredForkInfluenceMeters, [1.05, 2.55]);
  assert.deepEqual(routeSurface.exposedForkInfluenceMeters, [1.15, 2.8]);
  assert.deepEqual(world.assetSnapshot().brook.bankIntegration, {
    profile: 'terrain-integrated-fluvial-bank-transition',
    model: 'terrain-integrated-wet-bank-point-bar-floodplain-and-cut-bank-fields',
    topology: 'single-shared-render-and-collision-heightfield',
    overlayGeometryCount: 0,
    overlayDrawCalls: 0,
    wetBankRoughnessRange: [0.76, 0.99],
    contactModel: 'water-feather-over-shared-terrain-bank-no-raised-ribbon',
    sideAnchorCount: 2,
  });
  const brook = scene.getObjectByName('world.connected_route.brook');
  const positions = brook.geometry.attributes.position;
  const flowDirections = brook.geometry.attributes.flowDirection;
  const flowEnergies = brook.geometry.attributes.flowEnergy;
  const waterDepthMeters = brook.geometry.attributes.waterDepthMeters;
  const crossSectionVertices = brook.geometry.userData.crossSectionVertices;
  assert.equal(crossSectionVertices, 13);
  assert.equal(positions.count % crossSectionVertices, 0);
  assert.equal(positions.count / crossSectionVertices, 289);
  for (let row = 0; row < positions.count / crossSectionVertices; row += 1) {
    const first = row * crossSectionVertices;
    const level = positions.getY(first);
    for (let cross = 1; cross < crossSectionVertices; cross += 1) {
      assert.ok(
        Math.abs(positions.getY(first + cross) - level) < 0.000001,
        `brook row ${row} must not inherit a cross-bank terrain tilt`,
      );
      assert.equal(flowDirections.getX(first + cross), flowDirections.getX(first));
      assert.equal(flowEnergies.getX(first + cross), flowEnergies.getX(first));
      assert.ok(waterDepthMeters.getX(first + cross) >= 0);
    }
    assert.ok(flowEnergies.getX(first) >= 0 && flowEnergies.getX(first) <= 1);
  }
  assert.ok(Math.abs(Math.min(...waterDepthMeters.array) - 0.0019769) < 1e-6);
  assert.ok(Math.abs(Math.max(...waterDepthMeters.array) - 0.2879528) < 1e-6);
});

test('every instanced tree keeps its authored root plane in contact with terrain', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (const name of [
    'world.connected_route.tree_trunks',
    'world.connected_route.tree_trunks-plate-barked',
  ]) {
    const trunks = scene.getObjectByName(name);
    for (let index = 0; index < trunks.count; index += 1) {
      trunks.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      const rootOffset = position.y - terrainHeight(position.x, position.z);
      assert.ok(rootOffset <= 0.001, `${name} ${index} root must not float: ${rootOffset}`);
      assert.ok(rootOffset >= -0.05, `${name} ${index} root must not be buried: ${rootOffset}`);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      assert.ok(up.y > 0.9999, `${name} ${index} inherited a non-yaw tilt: ${up.y}`);
    }
  }
});

test('every instanced fern stays upright with its root plane touching terrain', () => {
  const scene = new THREE.Scene();
  createWorld(scene);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3();

  for (const name of [
    'world.connected_route.ferns',
    'world.connected_route.ferns-variant-2',
    'world.connected_route.ferns-variant-3',
  ]) {
    const ferns = scene.getObjectByName(name);
    for (let index = 0; index < ferns.count; index += 1) {
      ferns.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      assert.ok(Math.abs(position.y - terrainHeight(position.x, position.z)) < 0.00001);
      up.set(0, 1, 0).applyQuaternion(rotation);
      assert.ok(up.y > 0.9999);
    }
  }
});

test('Fort Plateau reads as pitched canvas shelters with soft camp smoke', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const tents = scene.getObjectByName('world.connected_route.fort-tents');
  const smoke = scene.getObjectByName('world.connected_route.fort_smoke');
  const firepit = scene.getObjectByName('world.connected_route.fort-firepit');
  const signal = scene.getObjectByName('world.connected_route.fort-signal');

  assert.equal(tents.children.length, 2);
  assert.ok(tents.children.every((tent) => tent.userData.profile === 'pitched-expedition-a-frame'));
  assert.ok(tents.children.every((tent) => tent.getObjectByName('canvas-roof')));
  assert.ok(tents.children.every((tent) => tent.getObjectByName('dark-entry')));
  assert.ok(tents.children.every((tent) => tent.getObjectByName('ridge-pole')));
  assert.ok(tents.children.every((tent) => tent.getObjectByName('canvas-seams')));
  assert.ok(tents.children.every((tent) => tent.getObjectByName('canvas-roof').material.emissiveIntensity >= 0.3));
  assert.equal(smoke.userData.profile, 'layered-billboard-wisps');
  assert.equal(smoke.children.length, 9);
  assert.ok(smoke.children.every((wisp) => wisp.isSprite));
  assert.ok(smoke.children.every((wisp) => wisp.material.type === 'SpriteMaterial'));
  assert.ok(smoke.children.every((wisp) => wisp.material.map?.isDataTexture));
  assert.equal(firepit.userData.profile, 'stone-ring-and-charred-logs');
  assert.ok(firepit.getObjectByName('ember-glow').intensity >= 6);
  const flames = firepit.getObjectByName('camp-flames');
  assert.ok(flames.children.every((flame) => flame.userData.baseScale >= 1.6));
  assert.ok(flames.children.every((flame) => flame.material.toneMapped === false));
  const flag = signal.getObjectByName('signal-flag');
  assert.equal(flag.userData.profile, 'wind-readable-camp-signal');
  const before = Array.from(flag.geometry.attributes.position.array);
  world.update(1.4, true, { quality: 'balanced' });
  const after = Array.from(flag.geometry.attributes.position.array);
  assert.notDeepEqual(after, before);
});

test('frame percentile is stable and keeps the slow tail visible', () => {
  const frames = [16, 17, 15, 18, 40, 14, 16, 17, 19, 16];
  assert.equal(percentile(frames, 0.5), 17);
  assert.equal(percentile(frames, 0.99), 40);
  assert.equal(percentile([], 0.5), 0);
});

test('one percent low FPS averages the slowest one percent of frame times', () => {
  const frames = [...Array(198).fill(10), 100, 200];
  assert.ok(Math.abs(onePercentLowFps(frames) - (1000 / 150)) < 1e-9);
  assert.equal(onePercentLowFps([]), 0);
});

test('runtime sources contain no remote asset or CDN request while navigation links may leave the app', () => {
  const files = ['index.html', ...globSync('src/*.{js,css}', { cwd: rootPath })];
  for (const relative of files) {
    const source = readFileSync(new URL(relative, root), 'utf8');
    const loadableSource = relative === 'index.html'
      ? source.replace(/(<a\b[^>]*\bhref\s*=\s*['"])https?:\/\/[^'"]+/gi, '$1navigation-only')
      : source;
    assert.doesNotMatch(loadableSource, /https?:\/\//i, relative);
    assert.doesNotMatch(source, /(?:src|href)\s*=\s*['"]\/\//i, relative);
    assert.doesNotMatch(source, /url\(\s*['"]?https?:/i, relative);
  }
});

test('the central helper prompt clears the protected silver-frame exposure area', () => {
  const styles = readFileSync(new URL('src/styles.css', root), 'utf8');
  const main = readFileSync(new URL('src/main.js', root), 'utf8');
  assert.match(
    styles,
    /html\s*\{\s*font-size:\s*calc\(16px \* var\(--text-scale\)\);\s*\}/,
    'text scaling must change the rem root rather than only inherited body copy',
  );
  assert.match(styles, /#build-badge\s*\{\s*display:\s*none;\s*\}/);
  assert.match(main, /document\.documentElement\.dataset\.textScale\s*=\s*presentationSettings\.textScale/);
  assert.match(
    main,
    /const attackSeconds = visualThreatOverride === null\s*\?\s*player\.attackSeconds/,
    'normal play must keep the simulation attack clock outside QA capture mode',
  );
  assert.match(main, /controlHint\.hidden\s*=\s*player\.zone\s*===\s*'brook-blind'/);
  assert.match(styles, /html\[data-text-scale="1\.5"\]\s+#control-hint/);
  assert.match(
    styles,
    /\.glass-plate\s*\{[^}]*backdrop-filter:\s*grayscale\(1\)[^}]*opacity:\s*1;/,
    'the title plate must read as a seated silver-black physical object',
  );
  assert.doesNotMatch(
    styles.match(/\.glass-plate\s*\{[^}]*\}/)?.[0] ?? '',
    /mix-blend-mode/,
    'the title plate must not dissolve into the world through screen blending',
  );
  assert.match(
    styles,
    /body\[data-camera="raised"\]\s+#context-prompt\s*\{\s*display:\s*none;\s*\}/,
  );
  assert.match(
    styles,
    /body\[data-rifle="raised"\]\s+#plate-preview\s*\{\s*display:\s*none;\s*\}/,
  );
  assert.match(
    styles,
    /body\[data-camera="raised"\]\s+#control-hint,\s*body\[data-rifle="raised"\]\s+#control-hint\s*\{\s*display:\s*none;\s*\}/,
  );
  assert.match(
    styles,
    /\.terminal-board span\[data-captured="true"\]\s*\{[^}]*background-position:\s*center;[^}]*background-size:\s*cover;[^}]*background-repeat:\s*no-repeat;/,
    'captured plates must override frame-specific fallback background positioning',
  );
});

test('QA exposes fixed environment-review cameras for repeatable visual comparison', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const shot of [
    'brook', 'brookDetail', 'brookObstacleDetail', 'brookSurfaceProfileDetail',
    'boulderDetail', 'fernDetail',
    'groundCoverDetail', 'detritusDetail',
    'bryophyteDetail',
    'routeSurfaceDetail', 'treeFernDetail',
    'canopyTreeDetail', 'coverDetail',
    'gingko', 'gingkoRoot',
    'basalt', 'basaltDetail', 'terrainDetail', 'escarpmentDetail', 'escarpmentSlopeDetail',
    'glade', 'ridgeVolume', 'forestBoundaryDetail',
  ]) {
    assert.match(main, new RegExp(`${shot}: Object\\.freeze\\(\\{`));
  }
  assert.match(main, /setEnvironmentReviewForTest\(\{ shot \}\)/);
  assert.match(main, /cameraMode = 'environment-review'/);
  assert.match(main, /visualElapsed = 14\.75/);
  assert.match(main, /world\.prepareBrookRender\(/);
});
