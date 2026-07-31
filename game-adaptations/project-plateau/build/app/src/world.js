import * as THREE from 'three';
import { PALETTE, SCENE_BUDGET, seededRandom } from './config.js';

const shared = {
  trunkGeometry: new THREE.CylinderGeometry(0.34, 0.52, 5.6, 6),
  crownGeometry: new THREE.IcosahedronGeometry(2.8, 1),
  fernGeometry: new THREE.ConeGeometry(0.7, 2.8, 4),
  trunkMaterial: new THREE.MeshStandardMaterial({ color: 0x354331, roughness: 1 }),
  crownMaterial: new THREE.MeshStandardMaterial({ color: PALETTE.canopy, roughness: 1 }),
  fernMaterial: new THREE.MeshStandardMaterial({ color: PALETTE.fern, roughness: 0.92 }),
};

export function terrainHeight(x, z) {
  const broad = Math.sin(x * 0.045) * 0.7 + Math.cos(z * 0.052) * 0.45;
  const basin = -Math.exp(-(x * x + (z + 8) * (z + 8)) / 1200) * 1.4;
  return broad + basin;
}

function makeTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(180, 210, 54, 62);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    positions.setZ(i, terrainHeight(x, z));
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.soil,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  mesh.name = 'world.connected_route.terrain';
  scene.add(mesh);
}

function makeRibbon(points, width, color, yOffset = 0) {
  const vertices = [];
  const indices = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const px = -dz / length;
    const pz = dx / length;
    const half = width * (0.85 + (i % 3) * 0.08) * 0.5;
    const y = terrainHeight(current.x, current.z) + yOffset;
    vertices.push(current.x + px * half, y, current.z + pz * half);
    vertices.push(current.x - px * half, y, current.z - pz * half);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    }),
  );
}

function makeRouteAndBrook(scene) {
  const brookPoints = [
    [-14, 88], [-11, 69], [-16, 51], [-10, 33], [-13, 15], [-7, -4],
    [-12, -22], [-8, -39], [-15, -58], [-11, -78],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const brook = makeRibbon(brookPoints, 3.4, PALETTE.water, 0.12);
  brook.name = 'world.connected_route.brook';
  scene.add(brook);

  const routePoints = [
    [3, 88], [4, 67], [0, 50], [8, 31], [11, 12], [4, -8], [10, -31], [3, -54],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const route = makeRibbon(routePoints, 4.8, 0x74664a, 0.055);
  route.material.opacity = 0.68;
  route.name = 'world.connected_route.track';
  const canopyFork = makeRibbon([
    [5, 35], [-4, 25], [-12, 13], [-10, 1], [0, -13],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), 3.7, 0x43563c, 0.07);
  canopyFork.material.opacity = 0.72;
  canopyFork.name = 'world.connected_route.covered_fork';
  const basaltFork = makeRibbon([
    [5, 35], [13, 25], [20, 13], [18, 0], [7, -14],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)), 4.2, 0x8a6240, 0.075);
  basaltFork.material.opacity = 0.76;
  basaltFork.name = 'world.connected_route.exposed_fork';
  scene.add(route, canopyFork, basaltFork);
}

function makeCoverArches(scene) {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x29382d, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x153d2a, roughness: 0.96 });
  const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.48, 6.5, 7);
  const leafGeometry = new THREE.IcosahedronGeometry(2.4, 1);
  const arches = [[-4, 26], [-8, 16], [-10, 6], [-7, -4], [-2, 12]];
  arches.forEach(([centerX, z], index) => {
    const ground = terrainHeight(centerX, z);
    const spread = 2.7 + (index % 2) * 0.35;
    const left = primitive(bark, trunkGeometry, [centerX - spread, ground + 3, z], [1, 1, 1], [0, 0, -0.24]);
    const right = primitive(bark, trunkGeometry, [centerX + spread, ground + 3, z], [1, 1, 1], [0, 0, 0.24]);
    const crown = primitive(
      bark,
      new THREE.CylinderGeometry(0.3, 0.42, spread * 2.35, 7),
      [centerX, ground + 6.45, z],
      [1, 1, 1],
      [0, 0, Math.PI / 2],
    );
    const leftCrown = primitive(leaf, leafGeometry, [centerX - 2.5, ground + 5.7, z], [1.2, 0.8, 1], [0, index, 0]);
    const rightCrown = primitive(leaf, leafGeometry, [centerX + 2.5, ground + 5.7, z], [1.2, 0.8, 1], [0, -index, 0]);
    group.add(left, right, crown, leftCrown, rightCrown);
  });
  group.name = 'world.connected_route.cover_arches';
  group.userData.archCount = arches.length;
  scene.add(group);
  return group;
}

function placeVegetation(scene) {
  const random = seededRandom(139);
  const trunkMesh = new THREE.InstancedMesh(
    shared.trunkGeometry,
    shared.trunkMaterial,
    SCENE_BUDGET.trees,
  );
  const crownMesh = new THREE.InstancedMesh(
    shared.crownGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const dummy = new THREE.Object3D();

  for (let i = 0; i < SCENE_BUDGET.trees; i += 1) {
    let x;
    let z;
    do {
      x = (random() - 0.5) * 150;
      z = (random() - 0.5) * 190;
    } while (Math.abs(x - 4) < 9 && z > -65);
    const scale = 0.72 + random() * 0.7;
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 2.8 * scale, z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + (random() - 0.5) * 0.8, y + 6.3 * scale, z);
    dummy.rotation.set(random() * 0.15, random() * Math.PI, random() * 0.1);
    dummy.scale.set(scale * (0.9 + random() * 0.35), scale * 0.72, scale);
    dummy.updateMatrix();
    crownMesh.setMatrixAt(i, dummy.matrix);
  }
  trunkMesh.name = 'world.connected_route.tree_trunks';
  crownMesh.name = 'world.connected_route.canopy';
  scene.add(trunkMesh, crownMesh);

  const fernMesh = new THREE.InstancedMesh(
    shared.fernGeometry,
    shared.fernMaterial,
    SCENE_BUDGET.ferns,
  );
  for (let i = 0; i < SCENE_BUDGET.ferns; i += 1) {
    const x = (random() - 0.5) * 130;
    const z = (random() - 0.5) * 170;
    const scale = 0.28 + random() * 0.8;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.7, z);
    dummy.rotation.set((random() - 0.5) * 0.22, random() * Math.PI, (random() - 0.5) * 0.18);
    dummy.scale.set(scale * 0.75, scale, scale * 0.75);
    dummy.updateMatrix();
    fernMesh.setMatrixAt(i, dummy.matrix);
  }
  fernMesh.name = 'world.connected_route.ferns';
  scene.add(fernMesh);
}

function makeBasalt(scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.basalt, roughness: 0.95 });
  const pillars = new THREE.InstancedMesh(geometry, material, SCENE_BUDGET.basaltPillars);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < SCENE_BUDGET.basaltPillars; i += 1) {
    const z = -80 + i * 8.2;
    const x = 34 + Math.sin(i * 1.7) * 4;
    const h = 13 + (i % 5) * 3.8;
    dummy.position.set(x, terrainHeight(x, z) + h / 2 - 1, z);
    dummy.rotation.set(0, (i % 3 - 1) * 0.13, (i % 2 - 0.5) * 0.05);
    dummy.scale.set(5.5 + (i % 4), h, 4.4 + ((i + 2) % 3));
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
  }
  pillars.name = 'world.connected_route.red_basalt';
  scene.add(pillars);
}

function primitive(material, geometry, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  return mesh;
}

function makeIguanodon(scene, x, z, scale, heading, young = false) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: young ? 0x65736b : PALETTE.slate,
    roughness: 0.9,
  });
  const bodyGeometry = new THREE.IcosahedronGeometry(1, 1);
  const limbGeometry = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6);
  const tailGeometry = new THREE.ConeGeometry(0.45, 3.8, 7);
  const body = primitive(skin, bodyGeometry, [0, 1.7, 0], [2.8, 1.45, 1.1]);
  const shoulder = primitive(skin, bodyGeometry, [1.75, 2.0, 0], [1.15, 1.2, 0.95]);
  const head = primitive(skin, bodyGeometry, [2.75, 2.45, 0], [0.68, 0.62, 0.58]);
  const muzzle = primitive(skin, bodyGeometry, [3.28, 2.28, 0], [0.6, 0.38, 0.48]);
  const tail = primitive(skin, tailGeometry, [-3.6, 1.65, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
  tail.rotation.z = -Math.PI / 2;
  for (const xLeg of [-1.35, 1.3]) {
    for (const side of [-0.6, 0.6]) {
      const leg = primitive(skin, limbGeometry, [xLeg, 0.75, side], [1, 1, 1]);
      group.add(leg);
    }
  }
  group.add(body, shoulder, head, muzzle, tail);
  group.position.set(x, terrainHeight(x, z) + 0.1, z);
  group.rotation.y = heading;
  group.scale.setScalar(scale);
  group.name = young ? 'subject.iguanodon_family.young' : 'subject.iguanodon_family.adult';
  group.userData.baseY = group.position.y;
  group.userData.phase = x * 0.7 + z;
  scene.add(group);
  return group;
}

function makeFamily(scene) {
  return [
    makeIguanodon(scene, -6, -47, 1.36, -0.18, false),
    makeIguanodon(scene, 10, -54, 1.24, 2.7, false),
    makeIguanodon(scene, -1, -42, 0.68, 0.4, true),
    makeIguanodon(scene, 4, -48, 0.62, -0.65, true),
    makeIguanodon(scene, 1, -56, 0.72, 2.2, true),
  ];
}

function makePterodactyl(scene, radius, height, phase, scale = 1) {
  const group = new THREE.Group();
  const membrane = new THREE.MeshStandardMaterial({
    color: 0x665f58,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const hide = new THREE.MeshStandardMaterial({ color: 0x403e39, roughness: 0.9 });
  const wingGeometry = (side) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      side * 5.4, 0, 1.5,
      side * 1.15, 0, -0.65,
      side * 5.4, 0, 1.5,
      side * 3.2, 0, -0.25,
      side * 1.15, 0, -0.65,
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  const leftWing = new THREE.Mesh(wingGeometry(-1), membrane);
  const rightWing = new THREE.Mesh(wingGeometry(1), membrane);
  const body = primitive(hide, new THREE.ConeGeometry(0.42, 3.5, 7), [0, 0.02, -1.25], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const head = primitive(hide, new THREE.ConeGeometry(0.22, 1.7, 6), [0, 0, -3.1], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const crest = primitive(membrane, new THREE.ConeGeometry(0.24, 1.15, 5), [0, 0.16, -2.75], [1, 1, 1], [Math.PI / 2, 0, 0]);
  leftWing.name = 'threat.pterodactyl.left-wing';
  rightWing.name = 'threat.pterodactyl.right-wing';
  group.add(leftWing, rightWing, body, head, crest);
  group.scale.setScalar(scale);
  group.name = 'threat.pterodactyl.distant';
  group.userData = {
    radius,
    height,
    phase,
    baseScale: scale,
    leftWing,
    rightWing,
    silhouette: 'membrane-wing',
  };
  scene.add(group);
  return group;
}

function makeFort(scene) {
  const canvasMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.canvas, roughness: 1 });
  const tentGeometry = new THREE.ConeGeometry(3.2, 4.5, 4);
  for (const [x, z, rotation] of [[-3, 80, Math.PI / 4], [5, 84, Math.PI / 4]]) {
    const tent = new THREE.Mesh(tentGeometry, canvasMaterial);
    tent.position.set(x, terrainHeight(x, z) + 2.1, z);
    tent.rotation.y = rotation;
    scene.add(tent);
  }
  const smokeGeometry = new THREE.SphereGeometry(1, 8, 6);
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.smoke, transparent: true, opacity: 0.28 });
  const smoke = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const puff = new THREE.Mesh(smokeGeometry, smokeMaterial);
    puff.position.set(Math.sin(i) * 0.8, i * 1.75, 0);
    puff.scale.setScalar(0.55 + i * 0.18);
    smoke.add(puff);
  }
  smoke.position.set(-8, terrainHeight(-8, 78) + 2.5, 78);
  smoke.name = 'world.connected_route.fort_smoke';
  scene.add(smoke);
  return smoke;
}

function makeBrookResponse(scene) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x2a4c35, roughness: 0.94 });
  for (let index = 0; index < 5; index += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.2, 4), material);
    frond.position.set((index - 2) * 0.72, 1.35 + (index % 2) * 0.18, (index % 3) * 0.42);
    frond.rotation.z = (index - 2) * 0.08;
    group.add(frond);
  }
  group.position.set(-10.5, terrainHeight(-10.5, 47), 47);
  group.name = 'world.connected_route.brook_response';
  group.userData.response = null;
  scene.add(group);
  return group;
}

function makeFieldCamera(scene) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4b2f24, roughness: 0.76 });
  const brass = new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.52, metalness: 0.45 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151a18, roughness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ba69d, roughness: 0.2, metalness: 0.1 });
  const rear = primitive(wood, new THREE.BoxGeometry(1, 1, 1), [0, 0, 0.34], [1.8, 1.16, 0.34]);
  const glassBack = primitive(glass, new THREE.BoxGeometry(1, 1, 1), [0, 0, 0.53], [1.38, 0.78, 0.05]);
  group.add(rear, glassBack);
  for (let index = 0; index < 5; index += 1) {
    const depth = -0.05 - index * 0.23;
    const taper = 1 - index * 0.065;
    group.add(primitive(
      index % 2 ? wood : black,
      new THREE.BoxGeometry(1, 1, 1),
      [0, 0, depth],
      [1.48 * taper, 0.9 * taper, 0.14],
    ));
  }
  const front = primitive(wood, new THREE.BoxGeometry(1, 1, 1), [0, 0, -1.25], [1.28, 0.88, 0.18]);
  const lens = primitive(black, new THREE.CylinderGeometry(0.45, 0.63, 0.78, 12), [0, 0, -1.75], [1, 1, 1], [Math.PI / 2, 0, 0]);
  const lensRing = primitive(brass, new THREE.TorusGeometry(0.48, 0.09, 8, 18), [0, 0, -2.16], [1, 1, 1], [Math.PI / 2, 0, 0]);
  const railGeometry = new THREE.BoxGeometry(0.12, 0.12, 2.45);
  group.add(front, lens, lensRing);
  group.add(primitive(brass, railGeometry, [-0.68, -0.58, -0.78], [1, 1, 1]));
  group.add(primitive(brass, railGeometry, [0.68, -0.58, -0.78], [1, 1, 1]));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 7, 16, Math.PI), brass);
  handle.position.set(0, 0.67, 0.18);
  handle.rotation.z = Math.PI;
  group.add(handle);
  group.position.set(2.8, 1.55, 67);
  group.rotation.set(-0.06, Math.PI, 0);
  group.scale.setScalar(0.78);
  group.name = 'tool.field_camera';
  group.userData.assetVersion = 'bellows-camera';
  scene.add(group);
  return group;
}

function makeRifle(scene) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x503126, roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x252a28, roughness: 0.48, metalness: 0.62 });
  const brass = new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.45, metalness: 0.55 });
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false,
  });
  const stock = primitive(wood, new THREE.BoxGeometry(1, 1, 1), [0.25, -0.1, 0], [0.42, 0.3, 2.5], [0.03, 0, 0]);
  const barrel = primitive(steel, new THREE.CylinderGeometry(0.09, 0.13, 4.8, 10), [0.1, 0.14, -2.45], [1, 1, 1], [Math.PI / 2, 0, 0]);
  const chamber = primitive(brass, new THREE.BoxGeometry(1, 1, 1), [0.1, 0.06, -0.25], [0.36, 0.26, 0.6]);
  const flash = primitive(flashMaterial, new THREE.ConeGeometry(0.35, 1.5, 8), [0.1, 0.14, -5.25], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  flash.name = 'tool.period_rifle.muzzle_flash';
  flash.visible = false;
  group.add(stock, barrel, chamber, flash);
  group.position.set(2.8, 1.2, 67);
  group.rotation.set(-0.16, Math.PI, 0);
  group.scale.setScalar(0.34);
  group.name = 'tool.period_rifle';
  group.userData.flash = flash;
  scene.add(group);
  return group;
}

export function createWorld(scene) {
  makeTerrain(scene);
  makeRouteAndBrook(scene);
  const coverArches = makeCoverArches(scene);
  placeVegetation(scene);
  makeBasalt(scene);
  const family = makeFamily(scene);
  const pterodactyls = [
    makePterodactyl(scene, 29, 23, 0.0, 0.88),
    makePterodactyl(scene, 37, 28, 2.2, 0.62),
    makePterodactyl(scene, 45, 32, 4.1, 0.46),
  ];
  const smoke = makeFort(scene);
  const brookResponse = makeBrookResponse(scene);
  const fieldCamera = makeFieldCamera(scene);
  const rifle = makeRifle(scene);
  let renderedThreatState = 'distant';
  let renderedThreatResponse = 'orbit';
  let observedShotCount = 0;
  let flashSeconds = 0;

  return {
    family,
    coverArches,
    pterodactyls,
    smoke,
    brookResponse,
    fieldCamera,
    rifle,
    update(elapsed, reducedMotion = false, runtime = {}) {
      const awareness = Math.max(0, Math.min(3, runtime.threatAwareness ?? 0));
      renderedThreatState = ['distant', 'watch', 'search', 'attack'][awareness];
      renderedThreatResponse = awareness === 3 && runtime.inCover ? 'cover-pull-up' : 'orbit';
      const playerPosition = runtime.playerPosition ?? { x: 0, z: 0 };
      brookResponse.userData.response = runtime.brookResponse ?? null;
      const responseStrength = runtime.brookResponse === 'brush-moving'
        ? 0.24
        : runtime.brookResponse === 'answering-call' ? 0.08 : 0.015;
      brookResponse.children.forEach((frond, index) => {
        frond.rotation.z = (index - 2) * 0.08
          + Math.sin(elapsed * (2.4 + index * 0.12) + index) * responseStrength;
      });
      if ((runtime.shotCount ?? 0) > observedShotCount) {
        observedShotCount = runtime.shotCount;
        flashSeconds = 0.1;
      }
      flashSeconds = Math.max(0, flashSeconds - (runtime.deltaSeconds ?? 0));
      rifle.userData.flash.visible = flashSeconds > 0;
      rifle.userData.flash.material.opacity = flashSeconds > 0 ? flashSeconds * 8 : 0;
      const speed = reducedMotion ? 0.08 : 0.18;
      pterodactyls.forEach((mesh, index) => {
        const { radius, height, phase } = mesh.userData;
        const isPrimary = index === 0;
        const stateRadius = isPrimary ? [radius, 26, 17, 9][awareness] : radius;
        const stateHeight = isPrimary ? [height, 12, 10, 6.7][awareness] : height;
        const stateSpeed = speed * (1 + awareness * 0.42) * (1 + index * 0.08);
        const angle = phase + elapsed * stateSpeed;
        if (isPrimary && awareness === 3 && runtime.inCover) {
          mesh.position.set(
            playerPosition.x + Math.cos(angle) * 3,
            stateHeight + 12 + Math.sin(angle * 1.6) * 0.7,
            playerPosition.z - 17 + Math.sin(angle) * 3,
          );
          mesh.scale.setScalar(mesh.userData.baseScale);
          mesh.rotation.x = 0.32;
        } else if (isPrimary && awareness === 3) {
          const dive = (elapsed % 3.2) / 3.2;
          const approach = dive < 0.72 ? dive / 0.72 : (1 - dive) / 0.28;
          mesh.position.set(
            playerPosition.x + Math.cos(angle) * stateRadius * (1 - approach * 0.72),
            stateHeight + (1 - approach) * 5,
            playerPosition.z - 15 + Math.sin(angle) * 2.5 + approach,
          );
          mesh.scale.set(mesh.userData.baseScale * 0.7, mesh.userData.baseScale, mesh.userData.baseScale);
          mesh.rotation.x = -0.42 * approach;
        } else {
          mesh.position.set(
            playerPosition.x + Math.cos(angle) * stateRadius,
            stateHeight + Math.sin(angle * 2) * 1.2,
            playerPosition.z - 25 + Math.sin(angle) * stateRadius * 0.35,
          );
          mesh.scale.setScalar(mesh.userData.baseScale);
          mesh.rotation.x = 0;
        }
        mesh.name = `threat.pterodactyl.${isPrimary ? renderedThreatState : 'distant'}`;
        const wingFold = isPrimary && awareness === 3 && !runtime.inCover
          ? 0.24 + Math.abs(Math.sin(angle * 2)) * 0.08
          : 0;
        const wingBeat = reducedMotion ? 0 : Math.sin(angle * (2.8 + awareness * 0.4)) * (0.05 + awareness * 0.025);
        mesh.userData.leftWing.rotation.z = wingFold + wingBeat;
        mesh.userData.rightWing.rotation.z = -wingFold - wingBeat;
        mesh.rotation.y = -angle + Math.PI / 2;
        mesh.rotation.z = Math.sin(angle * 2.4) * (0.16 + awareness * 0.035);
      });
      family.forEach((animal, index) => {
        animal.position.y = animal.userData.baseY + Math.sin(elapsed * 0.8 + animal.userData.phase) * (reducedMotion ? 0.008 : 0.035);
        animal.rotation.z = Math.sin(elapsed * 0.45 + index) * (reducedMotion ? 0.002 : 0.008);
      });
      smoke.children.forEach((puff, index) => {
        puff.position.x = Math.sin(elapsed * 0.22 + index) * (reducedMotion ? 0.15 : 0.55);
      });
    },
    threatSnapshot() {
      const primary = pterodactyls[0];
      return {
        state: renderedThreatState,
        response: renderedThreatResponse,
        position: {
          x: Number(primary.position.x.toFixed(2)),
          y: Number(primary.position.y.toFixed(2)),
          z: Number(primary.position.z.toFixed(2)),
        },
      };
    },
    brookResponseSnapshot() {
      return {
        state: brookResponse.userData.response,
        position: {
          x: Number(brookResponse.position.x.toFixed(2)),
          y: Number(brookResponse.position.y.toFixed(2)),
          z: Number(brookResponse.position.z.toFixed(2)),
        },
      };
    },
    assetSnapshot() {
      return {
        fieldCamera: {
          version: fieldCamera.userData.assetVersion,
          visibleParts: fieldCamera.children.length,
        },
        pterodactyl: {
          silhouette: pterodactyls[0].userData.silhouette,
          visibleParts: pterodactyls[0].children.length,
        },
        cover: {
          archCount: coverArches.userData.archCount,
          visibleParts: coverArches.children.length,
        },
      };
    },
  };
}
