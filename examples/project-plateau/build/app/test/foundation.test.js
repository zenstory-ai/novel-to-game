import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
  onePercentLowFps,
  seededRandom,
} from '../src/config.js';
import {
  PTERODACTYL_ATTACK_TIMELINE,
  createWorld,
  loadOptionalAssetVisual,
  pterodactylAttackFlightState,
  pterodactylAttackPose,
  pterodactylWingBeat,
  terrainHeight,
} from '../src/world.js';
import { HERO_GINGKO_LAYOUT } from '../src/environment-layout.js';
import { NAVIGATION } from '../src/simulation.js';

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
  world.update(1.5, false, { familyMoment: 'glade-routine' });
  assert.equal(world.familySnapshot().moment, 'glade-routine');
  world.update(2, false, { familyMoment: 'glade-alarm' });
  assert.equal(world.familySnapshot().moment, 'glade-alarm');
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

test('the attack circles low in front of the scout before the dive lands at contact', () => {
  const { circleEnd, contact } = PTERODACTYL_ATTACK_TIMELINE;
  assert.equal(pterodactylAttackPose(1).stage, 'circle');
  assert.equal(pterodactylAttackPose(circleEnd + 0.8).stage, 'attack');
  assert.ok(circleEnd >= 4 && contact - circleEnd >= 1.5, 'the warning pass lasts long enough to read, and a finished dive plate leaves time for the rifle');

  const scout = { x: 0, z: 2 };
  const heading = 0;
  const sample = (clock) => pterodactylAttackFlightState({
    attackClock: clock, attackOrigin: scout, attackHeading: heading, strikeTarget: scout,
  }).position;
  for (let clock = 0.6; clock < circleEnd; clock += 0.5) {
    const position = sample(clock);
    const ahead = -(position.z - scout.z);
    assert.ok(position.y > 5 && position.y < 13, `low circling height at ${clock}s`);
    assert.ok(ahead > 0 && Math.hypot(position.x - scout.x, position.z - scout.z) < 25, `in front at ${clock}s`);
  }
  let previous = sample(0);
  for (let clock = 1 / 60; clock <= contact; clock += 1 / 60) {
    const position = sample(clock);
    assert.ok(position.distanceTo(previous) < 0.6, `continuous flight at ${clock.toFixed(2)}s`);
    previous = position;
  }
  const strike = sample(contact);
  assert.ok(Math.hypot(strike.x - scout.x, strike.z - scout.z) < 2.5 && strike.y < 3.5);

  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const primary = world.pterodactyls[0];
  const shadow = scene.getObjectByName('threat.pterodactyl.projected-shadow');
  const runtime = { threatAwareness: 3, attackSeconds: 2, playerPosition: scout, playerHeading: heading };
  world.update(20, false, runtime);
  world.update(20, false, runtime);
  const circling = primary.position.clone();
  assert.equal(shadow.visible, true, 'the circling wing throws a ground shadow');
  world.update(20, false, { ...runtime, cameraRaised: true, familyMoment: 'glade-young-play' });
  assert.ok(primary.position.distanceTo(circling) < 1e-9, 'raising the camera must not move the bird');
  assert.equal(world.pterodactyls[1].visible, false);
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

  // Compare the dive tangent once the orbit-to-attack transition has settled.
  const strike = { threatAwareness: 3, rifleRaised: true, playerPosition: { x: 0, z: 2 }, playerHeading: 0 };
  world.update(19.4, false, { ...strike, attackSeconds: 0.1 });
  world.update(20, false, { ...strike, attackSeconds: 4 });
  const attackStart = primary.position.clone();
  const attackForward = localForward.clone().applyQuaternion(primary.quaternion).normalize();
  world.update(20.02, false, { ...strike, attackSeconds: 4.02 });
  const attackTravel = primary.position.clone().sub(attackStart).normalize();
  assert.ok(attackForward.dot(attackTravel) >= 0.94, {
    attackForward: attackForward.toArray(),
    attackTravel: attackTravel.toArray(),
  });
  assert.ok(attackForward.y < -0.2, 'a descending strike must pitch the head down');
});

test('one percent low FPS averages the slowest one percent of frame times', () => {
  const frames = [...Array(198).fill(10), 100, 200];
  assert.ok(Math.abs(onePercentLowFps(frames) - (1000 / 150)) < 1e-9);
  assert.equal(onePercentLowFps([]), 0);
});
