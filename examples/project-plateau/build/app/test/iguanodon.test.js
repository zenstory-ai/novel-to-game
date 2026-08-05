import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createIguanodon } from '../src/iguanodon.js';

function meshStats(root) {
  let meshes = 0;
  let triangles = 0;
  let minY = Infinity;
  const names = new Set();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    names.add(object.name);
    const position = object.geometry.getAttribute('position');
    triangles += object.geometry.index
      ? object.geometry.index.count / 3
      : position.count / 3;
    const bounds = new THREE.Box3().setFromObject(object);
    minY = Math.min(minY, bounds.min.y);
    assert.equal(object.castShadow, true, `${object.name} must cast shadows`);
    assert.equal(object.receiveShadow, true, `${object.name} must receive shadows`);
  });
  return { meshes, triangles, minY, names };
}

test('adult Iguanodon is a grounded articulated loft model rather than a primitive blob', () => {
  const adult = createIguanodon();
  const stats = meshStats(adult);
  const rig = adult.userData.rig;

  assert.equal(adult.name, 'subject.iguanodon_family.adult');
  assert.equal(adult.userData.assetVersion, 'procedural-loft-v7.1');
  assert.ok(stats.meshes >= 45, stats);
  assert.ok(stats.triangles >= 1900, stats);
  assert.ok(stats.minY >= -0.03 && stats.minY <= 0.03, stats);
  assert.equal(stats.names.size, stats.meshes, 'mesh names must remain unique');

  assert.ok(rig.neckPivot && rig.headPivot && rig.jawPivot);
  assert.equal(rig.tailPivots.length, 5);
  assert.ok(rig.tailPivots.every((pivot) => pivot.isBone));
  const bodyTail = adult.getObjectByName('iguanodon.body-tail.continuous-skin');
  assert.ok(bodyTail.isSkinnedMesh);
  assert.ok(bodyTail.geometry.getAttribute('skinIndex'));
  assert.ok(bodyTail.geometry.getAttribute('skinWeight'));
  assert.ok(bodyTail.userData.tailLength < 4.9, 'tail must not become an oversized rod');
  assert.ok(
    Math.abs(rig.tailPivots[0].rotation.z) < 0.05,
    'the tail base must leave the sacrum without an abrupt vertical kink',
  );
  assert.ok(
    bodyTail.skeleton.bones.some((bone) => bone.name === 'iguanodon.pelvis.pivot'),
    'the fixed torso and articulated tail must share one skeleton',
  );
  assert.deepEqual(Object.keys(rig.limbs).sort(), [
    'leftFore', 'leftHind', 'rightFore', 'rightHind',
  ]);
  Object.values(rig.limbs).forEach((limb) => {
    assert.ok(limb.root && limb.upper && limb.mid && limb.distal && limb.foot);
  });

  const skull = adult.getObjectByName('iguanodon.head.skull');
  assert.equal(skull.geometry.type, 'BufferGeometry');
  assert.notEqual(skull.geometry.type, 'SphereGeometry');
  assert.notEqual(skull.geometry.type, 'CapsuleGeometry');
  assert.ok(adult.getObjectByName('iguanodon.left.hind-toe-1'));
  assert.ok(adult.getObjectByName('iguanodon.right.hind-toe-3'));
  assert.ok(adult.getObjectByName('iguanodon.left.thumb-spike'));

  for (const side of ['left', 'right']) {
    assert.ok(adult.getObjectByName(`iguanodon.head.cheek-${side}`));
    assert.ok(adult.getObjectByName(`iguanodon.head.beak-edge-${side}`));
    assert.ok(adult.getObjectByName(`iguanodon.head.jawline-${side}`));
    assert.equal(
      adult.getObjectByName(`iguanodon.head.nostril-${side}`).geometry.type,
      'CircleGeometry',
      'nostrils must read as inset slits rather than projecting black nose blocks',
    );
  }
  const beak = adult.getObjectByName('iguanodon.head.beak');
  const beakSize = beak.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(beakSize.x < 0.55, 'upper beak must remain a short wedge instead of a long drooping muzzle');
  assert.ok(beakSize.z < 0.5, 'front beak width must stay restrained');
  assert.equal(adult.getObjectByName('iguanodon.head.beak-tip'), undefined);
  const beakPositions = beak.geometry.getAttribute('position');
  const tipX = beak.geometry.boundingBox.max.x;
  const tipVertices = [];
  for (let index = 0; index < beakPositions.count; index += 1) {
    if (Math.abs(beakPositions.getX(index) - tipX) < 1e-5) {
      tipVertices.push([
        beakPositions.getY(index),
        beakPositions.getZ(index),
      ]);
    }
  }
  const uniqueTipCoordinates = (axis) => [...new Set(
    tipVertices.map((vertex) => vertex[axis].toFixed(5)),
  )].map(Number);
  const tipY = uniqueTipCoordinates(0);
  const tipZ = uniqueTipCoordinates(1);
  assert.equal(tipY.length, 2, 'beak tip must be a flat trapezoid, not a rounded cap');
  assert.equal(tipZ.length, 4, 'beak tip must have four trapezoid corners, not an ellipse');
  assert.ok(Math.max(...tipY) - Math.min(...tipY) < 0.08, 'beak tip must stay vertically thin');
  assert.ok(Math.max(...tipZ) - Math.min(...tipZ) < 0.18, 'beak tip must stay narrower than the cheeks');
  const cuttingEdge = adult.getObjectByName('iguanodon.head.beak-cutting-edge');
  assert.equal(cuttingEdge.geometry.type, 'BoxGeometry');
  const cuttingEdgeSize = cuttingEdge.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(
    cuttingEdgeSize.z > cuttingEdgeSize.y * 5,
    'front cutting edge must read as a horizontal mouth cut rather than a round plug',
  );

  for (const side of ['left', 'right']) {
    const socket = adult.getObjectByName(`iguanodon.head.eye-${side}.socket`);
    const eyeball = adult.getObjectByName(`iguanodon.head.eye-${side}`);
    const iris = adult.getObjectByName(`iguanodon.head.iris-${side}`);
    const brow = adult.getObjectByName(`iguanodon.head.brow-${side}`);
    assert.ok(Math.abs(socket.position.z) < 0.4, 'eyes must sit inside the skull silhouette');
    assert.ok(eyeball.geometry.parameters.radius <= 0.08, 'eyeballs must not read as large beads');
    assert.ok(eyeball.scale.z <= 0.36, 'eyeballs must be shallowly inset, not projecting spheres');
    assert.ok(iris.geometry.parameters.radius <= 0.035, 'iris must stay subordinate to the eye socket');
    assert.ok(brow.position.y > socket.position.y, 'brow must cover the upper edge of the eye');
  }

  const bodyMaterial = bodyTail.material;
  assert.equal(bodyMaterial.type, 'MeshPhysicalMaterial');
  assert.ok(bodyMaterial.vertexColors);
  assert.ok(bodyMaterial.roughness >= 0.72, 'body must remain matte rather than plastic');
  assert.ok(bodyMaterial.clearcoat > 0 && bodyMaterial.clearcoat < 0.15);
  assert.ok(adult.getObjectByName('iguanodon.surface.mineral-sheen'));
  assert.ok(adult.getObjectByName('iguanodon.shoulder.scute-12'));
  assert.notEqual(
    adult.getObjectByName('iguanodon.shoulder.scute-1').geometry.type,
    'CircleGeometry',
    'scutes must follow the body as tapered plates rather than round dots',
  );
  const belly = adult.getObjectByName('iguanodon.torso.underside');
  const bellySize = belly.geometry.boundingBox.getSize(new THREE.Vector3());
  const bellyColor = belly.material.color;
  const upperColor = skull.material.color;
  const colorDistance = Math.hypot(
    bellyColor.r - upperColor.r,
    bellyColor.g - upperColor.g,
    bellyColor.b - upperColor.b,
  );
  assert.ok(bellySize.z > 1.3, 'warm underside must wrap far enough onto the visible lower flank');
  assert.ok(
    colorDistance > 0.12,
    'warm underside must remain chromatically separated from the slate upper planes',
  );

  Object.values(rig.limbs).forEach((limb) => {
    assert.ok(limb.jointSleeve?.isMesh);
    assert.equal(limb.jointSleeve.geometry.type, 'BufferGeometry');
    assert.equal(limb.jointVolumes, undefined, 'visible crystal-ball joints must not return');
  });
  assert.equal(
    adult.getObjectByName('iguanodon.left.knee.volume'),
    undefined,
    'knees must be overlapping lofts, not separate spherical blocks',
  );
});

test('young Iguanodon keeps the same action rig with distinct proportions and palette', () => {
  const young = createIguanodon({ young: true, materialVariant: 'moss' });
  const stats = meshStats(young);

  assert.equal(young.name, 'subject.iguanodon_family.young');
  assert.equal(young.userData.young, true);
  assert.ok(young.userData.rig.headPivot.scale.x > 1.1);
  assert.equal(young.getObjectByName('iguanodon.shoulder.scutes').visible, false);
  assert.ok(stats.triangles >= 1900, stats);
});
