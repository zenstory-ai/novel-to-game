import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createPterodactyl } from '../src/pterodactyl.js';

function meshStats(root) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  return {
    meshes,
    triangles: meshes.reduce((total, part) => {
      const geometry = part.geometry;
      return total + (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3);
    }, 0),
  };
}

test('pterodactyl is an articulated thick-membrane creature rather than a paper triangle', () => {
  const animal = createPterodactyl();
  const { meshes, triangles } = meshStats(animal);
  const names = meshes.map((part) => part.name);
  const membraneMeshes = meshes.filter((part) => part.name.endsWith('.membrane.continuous-skin'));

  assert.equal(animal.userData.silhouette, 'continuous-skinned-membrane-wing');
  assert.equal(animal.userData.assetVersion, 'procedural-pterodactyl-v5');
  assert.equal(animal.userData.forwardAxis, '-Z');
  assert.ok(meshes.length >= 45);
  assert.ok(triangles >= 1200 && triangles <= 3000);
  assert.equal(new Set(names).size, names.length);
  assert.ok(meshes.every((part) => part.castShadow && part.receiveShadow));
  assert.equal(membraneMeshes.length, 2, 'each wing must use one continuous membrane skin');

  for (const membrane of membraneMeshes) {
    assert.ok(membrane.isSkinnedMesh, `${membrane.name} must deform as one skin`);
    assert.ok(membrane.geometry.getAttribute('skinIndex'));
    assert.ok(membrane.geometry.getAttribute('skinWeight'));
    assert.ok(membrane.geometry.getAttribute('color'), 'membrane must carry bay colour variation');
    assert.ok(membrane.geometry.userData.spanStations >= 7);
    membrane.geometry.computeBoundingBox();
    const thickness = membrane.geometry.boundingBox.getSize(new THREE.Vector3()).y;
    assert.ok(thickness >= 0.055, `${membrane.name} must have a closed visible edge`);
  }
});

test('pterodactyl exposes multi-joint wings and readable anatomical anchors', () => {
  const animal = createPterodactyl();
  const { rig } = animal.userData;
  const names = [];
  animal.traverse((node) => names.push(node.name));

  for (const side of ['leftWing', 'rightWing']) {
    assert.ok(rig[side].shoulder.isBone);
    assert.ok(rig[side].elbow.isBone);
    assert.ok(rig[side].wrist.isBone);
    assert.equal(rig[side].membraneSegments.length, 1);
    assert.equal(rig[side].membraneSegments[0].skeleton.bones.length, 3);
  }
  assert.ok(rig.head.isGroup);
  assert.ok(rig.tail.isGroup);
  assert.ok(rig.hindLimbs.left.isGroup);
  assert.ok(rig.hindLimbs.right.isGroup);
  assert.ok(names.some((name) => name.includes('head.beak')));
  assert.ok(names.some((name) => name.includes('beak.lower-mandible')));
  assert.ok(names.some((name) => name.includes('head.crest')));
  assert.equal(names.filter((name) => name.includes('head.orbit-')).length, 2);
  assert.equal(names.filter((name) => name.includes('head.nostril-')).length, 2);
  assert.ok(names.some((name) => name.includes('hindlimb.foot')));
  assert.equal(names.filter((name) => name.includes('hindlimb.toe-') && name.endsWith('.pivot')).length, 6);
  assert.ok(names.some((name) => name.includes('wing-finger')));
  assert.equal(names.filter((name) => name.includes('.membrane.vein-')).length, 10);
  assert.ok(names.includes('pterodactyl.neck.nuchal-saddle'));
  assert.ok(names.includes('pterodactyl.neck.gular-transition'));
});

test('pterodactyl membrane has clay skin, darker veins and restrained translucency', () => {
  const animal = createPterodactyl();
  const { meshes } = meshStats(animal);
  const membranes = meshes.filter((part) => part.name.endsWith('.membrane.continuous-skin'));
  const veins = meshes.filter((part) => part.name.includes('.membrane.vein-'));

  assert.equal(membranes.length, 2);
  assert.equal(veins.length, 10);
  for (const membrane of membranes) {
    assert.ok(membrane.material.isMeshPhysicalMaterial);
    assert.ok(membrane.material.opacity >= 0.88, 'membrane should not read as ghost plastic');
    assert.ok(membrane.material.transmission <= 0.025, 'transmission is an edge cue, not the base look');
    assert.ok(membrane.material.roughness >= 0.82, 'membrane should remain dry and leathery');
    const colours = membrane.geometry.getAttribute('color');
    const unique = new Set();
    for (let index = 0; index < colours.count; index += 1) {
      unique.add(`${colours.getX(index).toFixed(3)}:${colours.getY(index).toFixed(3)}:${colours.getZ(index).toFixed(3)}`);
    }
    assert.ok(unique.size >= 8, 'span and chord bays need visible colour hierarchy');
  }
  assert.ok(veins.every((part) => part.material.opacity < 0.85));
});

test('pterodactyl wrists carry three grasping free digits distinct from the long wing finger', () => {
  const animal = createPterodactyl();
  const { meshes, triangles } = meshStats(animal);
  const byName = new Map(meshes.map((part) => [part.name, part]));

  assert.ok(triangles < 3000);
  for (const [sideName, sideLabel] of [['leftWing', 'left-wing'], ['rightWing', 'right-wing']]) {
    const { freeDigits } = animal.userData.rig[sideName];
    assert.equal(freeDigits.length, 3);
    assert.ok(byName.has(`pterodactyl.${sideLabel}.hand.palm`));
    const wingFinger = byName.get(`pterodactyl.${sideLabel}.wing-finger`);
    wingFinger.geometry.computeBoundingBox();
    const wingFingerLength = wingFinger.geometry.boundingBox.getSize(new THREE.Vector3()).length();

    freeDigits.forEach((digit, index) => {
      assert.ok(digit.isGroup);
      const prefix = `pterodactyl.${sideLabel}.hand.free-digit-${index + 1}`;
      const proximal = byName.get(`${prefix}.proximal`);
      const distal = byName.get(`${prefix}.distal`);
      const claw = byName.get(`${prefix}.claw`);
      assert.ok(proximal && distal && claw, `${prefix} must have two phalanges and a claw`);
      const digitBox = new THREE.Box3().setFromObject(digit);
      assert.ok(digitBox.getSize(new THREE.Vector3()).length() < wingFingerLength * 0.35);
      assert.ok([proximal, distal, claw].every((part) => part.geometry.attributes.position.count >= 30));
    });
  }
});

test('pterodactyl rear feet have connected soles, pads and three tapered clawed toes', () => {
  const animal = createPterodactyl();
  animal.updateMatrixWorld(true);
  const { meshes } = meshStats(animal);
  const names = new Set(meshes.map((part) => part.name));

  for (const [sideName, sideLabel] of [['left', 'left-hindlimb'], ['right', 'right-hindlimb']]) {
    const footRig = animal.userData.rig.hindLimbs[sideName].userData.footRig;
    assert.ok(footRig.ankle.isGroup);
    assert.ok(footRig.sole.isMesh);
    assert.ok(footRig.plantarPad.isMesh);
    assert.equal(footRig.toes.length, 3);

    const padBox = new THREE.Box3().setFromObject(footRig.plantarPad);
    assert.ok(new THREE.Box3().setFromObject(footRig.sole).intersectsBox(padBox));
    footRig.toes.forEach((toe, index) => {
      const prefix = `pterodactyl.${sideLabel}.toe-${index + 1}`;
      assert.ok(names.has(`${prefix}.proximal`));
      assert.ok(names.has(`${prefix}.distal`));
      assert.ok(names.has(`${prefix}.claw`));
      assert.ok(new THREE.Box3().setFromObject(toe).intersectsBox(padBox), `${prefix} must meet the pad`);
    });
  }
});
