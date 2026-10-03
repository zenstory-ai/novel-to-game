import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { COVER_BAND, COVER_BAND_TREE_FERNS, coverBandSamples } from './environment-layout.js';
import { terrainHeight } from './terrain.js';

const ARCH_SPACING = 3.6;
const ARCH_PEAK = 2.75;
const LEAVES_PER_ARCH = 120;

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// One thorn stem: a tube over the walk from one edge of the band to the
// other, with short hooked spines along it.
function archStem(sample, random, lean) {
  const span = COVER_BAND.halfWidth + 0.35 + random() * 0.25;
  const leftX = sample.x - sample.normalX * span;
  const leftZ = sample.z - sample.normalZ * span;
  const rightX = sample.x + sample.normalX * span;
  const rightZ = sample.z + sample.normalZ * span;
  const along = { x: -sample.normalZ * lean, z: sample.normalX * lean };
  const peak = ARCH_PEAK + (random() - 0.5) * 0.35;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(leftX, terrainHeight(leftX, leftZ) - 0.05, leftZ),
    new THREE.Vector3(sample.x + along.x, terrainHeight(sample.x, sample.z) + peak * 2, sample.z + along.z),
    new THREE.Vector3(rightX, terrainHeight(rightX, rightZ) - 0.05, rightZ),
  );
  const parts = [new THREE.TubeGeometry(curve, 24, 0.022 + random() * 0.01, 5, false)];
  for (let index = 1; index < 22; index += 1) {
    const t = index / 22;
    const point = curve.getPoint(t);
    const spine = new THREE.ConeGeometry(0.01, 0.09, 3);
    spine.rotateZ((random() - 0.5) * 2.4);
    spine.rotateX((random() - 0.5) * 2.4);
    spine.translate(point.x, point.y, point.z);
    parts.push(spine);
  }
  return { geometry: mergeGeometries(parts.map((part) => part.toNonIndexed())), curve };
}

// The thorn arches that make the cover band read as shelter: low brambles
// arching over the walk every few metres, leafed enough to break the sky.
export function makeCoverBand(scene) {
  const group = new THREE.Group();
  group.name = 'world.cover-band';
  const random = seeded(4417);
  const stems = [];
  const leafCurves = [];
  for (const sample of coverBandSamples(ARCH_SPACING)) {
    // The blind's front stays open toward the family.
    if (sample.z < COVER_BAND.blind.z + 1.5) continue;
    for (const lean of [-0.6, 0.45]) {
      const { geometry, curve } = archStem(sample, random, lean);
      stems.push(geometry);
      leafCurves.push(curve);
    }
  }
  const stemMesh = new THREE.Mesh(
    mergeGeometries(stems),
    new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.94 }),
  );
  stemMesh.name = 'world.cover-band.thorn-arches';
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;

  // A small pointed leaflet, stalk at the origin.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.07, 0.045, 0.2, 0);
  leafShape.quadraticCurveTo(0.07, -0.045, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 3);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafCurves.length * LEAVES_PER_ARCH);
  leaves.name = 'world.cover-band.thorn-leaves';
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let leafIndex = 0;
  for (const curve of leafCurves) {
    for (let index = 0; index < LEAVES_PER_ARCH; index += 1) {
      const t = 0.08 + random() * 0.84;
      dummy.position.copy(curve.getPoint(t)).add(new THREE.Vector3(
        (random() - 0.5) * 0.36,
        (random() - 0.5) * 0.22,
        (random() - 0.5) * 0.36,
      ));
      dummy.rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI);
      dummy.scale.setScalar(0.7 + random() * 0.8);
      dummy.updateMatrix();
      leaves.setMatrixAt(leafIndex, dummy.matrix);
      color.setHSL(0.21 + random() * 0.08, 0.34 + random() * 0.14, 0.1 + random() * 0.07);
      leaves.setColorAt(leafIndex, color);
      leafIndex += 1;
    }
  }
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.computeBoundingSphere();

  const treeFernAnchor = new THREE.Group();
  treeFernAnchor.name = 'world.cover-band.tree-ferns';
  COVER_BAND_TREE_FERNS.forEach(([x, z], index) => {
    const placement = new THREE.Group();
    placement.name = `world.cover-band.tree-fern-placement-${index + 1}`;
    placement.position.set(x, terrainHeight(x, z), z);
    placement.userData.treeFernPlacementAnchor = true;
    treeFernAnchor.add(placement);
  });
  group.add(stemMesh, leaves, treeFernAnchor);
  group.userData = { treeFernAnchor };
  scene.add(group);
  return group;
}
