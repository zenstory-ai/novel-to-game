import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  PRODUCT_BUDGET,
  SCENE_BUDGET,
  onePercentLowFps,
  percentile,
  seededRandom,
} from '../src/config.js';
import {
  PTERODACTYL_ATTACK_CYCLE_SECONDS,
  createWorld,
  loadOptionalAssetVisual,
  pterodactylAttackFlightState,
  pterodactylAttackPose,
  pterodactylWingBeat,
  terrainHeight,
} from '../src/world.js';
import { HERO_GINGKO_LAYOUT } from '../src/environment-layout.js';
import { NAVIGATION } from '../src/simulation.js';

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
  createWorld(scene);
  const anchor = scene.getObjectByName('world.landmark.fort-gingko');
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
});

test('the family asset exposes two adults, three young and both authored behaviors', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  assert.equal(world.family.filter((animal) => !animal.userData.young).length, 2);
  assert.equal(world.family.filter((animal) => animal.userData.young).length, 3);
  const behaviors = new Set(world.family.map((animal) => animal.userData.behaviorRole));
  for (const behavior of ['graze', 'branch-pull', 'young-play']) {
    assert.ok(behaviors.has(behavior));
  }
  assert.ok(scene.getObjectByName('subject.iguanodon_family.feeding_branch'));

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

test('runtime sources contain no remote request or navigation URL', () => {
  const files = ['index.html', ...globSync('src/*.{js,css}', { cwd: rootPath })];
  for (const relative of files) {
    const source = readFileSync(new URL(relative, root), 'utf8');
    assert.doesNotMatch(source, /https?:\/\//i, relative);
    assert.doesNotMatch(source, /(?:src|href)\s*=\s*['"]\/\//i, relative);
    assert.doesNotMatch(source, /url\(\s*['"]?https?:/i, relative);
  }
});
