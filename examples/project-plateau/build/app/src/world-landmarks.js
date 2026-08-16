import * as THREE from 'three';
import { PALETTE } from './config.js';
import { FORT_FIREPIT, FORT_TENT_LAYOUT, HERO_GINGKO_LAYOUT } from './environment-layout.js';
import { terrainHeight } from './terrain.js';
import { createCylinderBetween, createVerticalLoft, primitive } from './world-rendering.js';
import { shared } from './vegetation-rendering.js';

function createTentPanelGeometry(vertices, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeAFrameTent() {
  const tent = new THREE.Group();
  const width = 5.1;
  const length = 6.4;
  const ridgeHeight = 3.35;
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const canvasMaterial = new THREE.MeshStandardMaterial({
    color: 0xad9770,
    emissive: 0x392719,
    emissiveIntensity: 0.34,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const endMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f7957,
    emissive: 0x2f2117,
    emissiveIntensity: 0.28,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const entryMaterial = new THREE.MeshStandardMaterial({
    color: 0x242824,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x493929,
    roughness: 0.88,
  });

  const roof = new THREE.Mesh(
    createTentPanelGeometry(
      [
        -halfWidth, 0.2, -halfLength,
        0, ridgeHeight, -halfLength,
        0, ridgeHeight, halfLength,
        -halfWidth, 0.2, halfLength,
        0, ridgeHeight, -halfLength,
        halfWidth, 0.2, -halfLength,
        halfWidth, 0.2, halfLength,
        0, ridgeHeight, halfLength,
      ],
      [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    ),
    canvasMaterial,
  );
  roof.name = 'canvas-roof';
  roof.castShadow = true;
  roof.receiveShadow = true;
  tent.add(roof);

  const seamPoints = [];
  for (const z of [-halfLength * 0.5, 0, halfLength * 0.5]) {
    seamPoints.push(
      new THREE.Vector3(-halfWidth + 0.018, 0.215, z),
      new THREE.Vector3(0, ridgeHeight + 0.018, z),
      new THREE.Vector3(0, ridgeHeight + 0.018, z),
      new THREE.Vector3(halfWidth - 0.018, 0.215, z),
    );
  }
  const canvasSeams = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(seamPoints),
    new THREE.LineBasicMaterial({ color: 0x74694f, transparent: true, opacity: 0.62 }),
  );
  canvasSeams.name = 'canvas-seams';
  tent.add(canvasSeams);

  const rear = new THREE.Mesh(
    createTentPanelGeometry(
      [
        -halfWidth, 0.2, halfLength,
        halfWidth, 0.2, halfLength,
        0, ridgeHeight, halfLength,
      ],
      [0, 1, 2],
    ),
    endMaterial,
  );
  rear.name = 'rear-canvas-panel';
  rear.castShadow = true;
  tent.add(rear);

  const darkEntry = new THREE.Mesh(
    createTentPanelGeometry(
      [-1.18, 0.18, -halfLength - 0.035, 1.18, 0.18, -halfLength - 0.035, 0, 2.72, -halfLength - 0.035],
      [0, 1, 2],
    ),
    entryMaterial,
  );
  darkEntry.name = 'dark-entry';
  tent.add(darkEntry);

  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(
      createTentPanelGeometry(
        [
          0, ridgeHeight, -halfLength - 0.06,
          side * halfWidth, 0.2, -halfLength - 0.06,
          side * 0.82, 0.2, -halfLength - 0.08,
        ],
        [0, 1, 2],
      ),
      endMaterial,
    );
    flap.name = side < 0 ? 'entry-flap-left' : 'entry-flap-right';
    flap.castShadow = true;
    tent.add(flap);
  }

  const ridgePole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.075, length + 0.7, 7),
    poleMaterial,
  );
  ridgePole.name = 'ridge-pole';
  ridgePole.position.y = ridgeHeight + 0.04;
  ridgePole.rotation.x = Math.PI / 2;
  ridgePole.castShadow = true;
  tent.add(ridgePole);
  for (const z of [-halfLength - 0.12, halfLength + 0.12]) {
    const upright = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, ridgeHeight + 0.25, 7),
      poleMaterial,
    );
    upright.position.set(0, ridgeHeight / 2, z);
    upright.castShadow = true;
    tent.add(upright);
  }

  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, ridgeHeight, -halfLength),
    new THREE.Vector3(0, 0.04, -halfLength - 2.1),
    new THREE.Vector3(0, ridgeHeight, halfLength),
    new THREE.Vector3(0, 0.04, halfLength + 2.1),
  ]);
  const ropes = new THREE.LineSegments(
    ropeGeometry,
    new THREE.LineBasicMaterial({ color: 0x6c6049, transparent: true, opacity: 0.72 }),
  );
  ropes.name = 'guy-ropes';
  tent.add(ropes);
  tent.userData.profile = 'pitched-expedition-a-frame';
  return tent;
}

function makeSmokeTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const v = (y / (size - 1)) * 2 - 1;
      const warpedX = u + Math.sin((v + 0.23) * 5.1) * 0.085;
      const edgeNoise = Math.sin(u * 13.7 + v * 8.3) * 0.045
        + Math.sin(u * 5.4 - v * 11.2) * 0.028;
      const distance = Math.hypot(warpedX * 0.9, v * 1.08) + edgeNoise;
      const feather = THREE.MathUtils.smoothstep(1 - distance, 0, 0.58);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(255 * feather * feather);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'world.material.soft-smoke-wisp';
  return texture;
}

function makeFort(scene) {
  const tents = new THREE.Group();
  tents.name = 'world.connected_route.fort-tents';
  for (const { x, z, rotation } of FORT_TENT_LAYOUT) {
    const tent = makeAFrameTent();
    tent.position.set(x, terrainHeight(x, z), z);
    tent.rotation.y = rotation;
    tents.add(tent);
  }
  scene.add(tents);

  const fireX = FORT_FIREPIT.x;
  const fireZ = FORT_FIREPIT.z;
  const fireGround = terrainHeight(fireX, fireZ);
  const firepit = new THREE.Group();
  firepit.name = 'world.connected_route.fort-firepit';
  firepit.userData.profile = 'stone-ring-and-charred-logs';
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4a42, roughness: 1 });
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMaterial);
    stone.position.set(Math.cos(angle) * 0.72, 0.16, Math.sin(angle) * 0.72);
    stone.scale.set(1.2, 0.62, 0.84);
    stone.rotation.y = angle;
    stone.castShadow = true;
    firepit.add(stone);
  }
  const logMaterial = new THREE.MeshStandardMaterial({ color: 0x2d241d, roughness: 0.95 });
  for (const rotation of [-0.62, 0.62]) {
    const directionX = Math.cos(rotation) * 0.72;
    const directionZ = Math.sin(rotation) * 0.72;
    const log = new THREE.Mesh(
      createCylinderBetween(
        [-directionX, 0.27, -directionZ],
        [directionX, 0.31, directionZ],
        0.12,
        0.105,
        7,
      ),
      logMaterial,
    );
    log.castShadow = true;
    firepit.add(log);
  }
  const flameGroup = new THREE.Group();
  flameGroup.name = 'camp-flames';
  const flameColors = [0xffb23e, 0xf4762b, 0xffd77a];
  [[-0.2, 0.02, 1.14], [0.18, -0.08, 1.34], [0.02, 0.18, 0.96]].forEach(
    ([x, z, height], index) => {
      const flameGeometry = createVerticalLoft([
        [0, 0, 0, 0.15, 0.12],
        [height * 0.28, 0.035, -0.02, 0.2, 0.15],
        [height * 0.64, -0.045, 0.025, 0.11, 0.085],
        [height, 0.035, -0.015, 0.012, 0.012],
      ], 6);
      flameGeometry.computeVertexNormals();
      const flame = new THREE.Mesh(
        flameGeometry,
        new THREE.MeshBasicMaterial({
          color: flameColors[index],
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flame.position.set(x, 0.34, z);
      flame.userData.baseScale = 1.68 + index * 0.14;
      flameGroup.add(flame);
    },
  );
  const emberGlow = new THREE.PointLight(0xff8a3a, 6.8, 20, 1.85);
  emberGlow.name = 'ember-glow';
  emberGlow.position.y = 0.72;
  emberGlow.castShadow = false;
  firepit.add(flameGroup, emberGlow);
  firepit.position.set(fireX, fireGround, fireZ);
  scene.add(firepit);

  const smoke = new THREE.Group();
  const smokeTexture = makeSmokeTexture();
  for (let index = 0; index < 9; index += 1) {
    const smokeColor = new THREE.Color(PALETTE.smoke).lerp(
      new THREE.Color(0xd1ad78),
      (1 - index / 8) * 0.22,
    );
    const wisp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTexture,
      color: smokeColor,
      transparent: true,
      opacity: 0.31 - index * 0.012,
      depthWrite: false,
    }));
    const windLean = -index * 0.18;
    const baseX = windLean + Math.sin(index * 1.61) * (0.08 + index * 0.012);
    const baseY = 0.58 + index * 0.79;
    wisp.position.set(baseX, baseY, Math.cos(index * 1.27) * 0.16);
    wisp.userData.baseX = baseX;
    wisp.userData.baseY = baseY;
    wisp.userData.baseRotation = Math.sin(index * 2.17) * 0.2;
    wisp.scale.set(1.58 + index * 0.15, 1.9 + index * 0.22, 1);
    wisp.material.rotation = wisp.userData.baseRotation;
    wisp.renderOrder = 1;
    smoke.add(wisp);
  }
  smoke.position.set(fireX, fireGround + 0.42, fireZ);
  smoke.name = 'world.connected_route.fort_smoke';
  smoke.userData.profile = 'layered-billboard-wisps';
  smoke.userData.campFlames = flameGroup;
  smoke.userData.emberGlow = emberGlow;

  const signal = new THREE.Group();
  const signalX = 7.4;
  const signalZ = 73.2;
  const signalGround = terrainHeight(signalX, signalZ);
  signal.name = 'world.connected_route.fort-signal';
  signal.position.set(signalX, signalGround, signalZ);
  const signalPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.085, 4.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x493929, roughness: 0.9 }),
  );
  signalPole.name = 'signal-pole';
  signalPole.position.y = 2.4;
  signalPole.castShadow = true;
  const flagGeometry = createTentPanelGeometry(
    [
      0, 0.56, 0,
      0, -0.56, 0,
      -1.3, -0.42, 0,
      -1.3, 0.42, 0,
      -2.6, -0.5, 0,
      -2.6, 0.08, 0,
    ],
    [0, 1, 2, 0, 2, 3, 3, 2, 4, 3, 4, 5],
  );
  const signalFlag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xb75236,
      emissive: 0x3a140d,
      emissiveIntensity: 0.36,
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
  );
  signalFlag.name = 'signal-flag';
  signalFlag.position.y = 4.12;
  signalFlag.castShadow = true;
  signalFlag.userData.profile = 'wind-readable-camp-signal';
  signalFlag.userData.basePositions = Float32Array.from(
    signalFlag.geometry.attributes.position.array,
  );
  signal.add(signalPole, signalFlag);
  scene.add(signal);
  smoke.userData.campSignal = signalFlag;
  scene.add(smoke);
  return smoke;
}

function makeHeroGingko(scene) {
  const anchor = new THREE.Group();
  anchor.name = 'world.landmark.fort-gingko';
  anchor.position.set(
    HERO_GINGKO_LAYOUT.x,
    terrainHeight(HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z),
    HERO_GINGKO_LAYOUT.z,
  );
  anchor.rotation.y = HERO_GINGKO_LAYOUT.rotation;
  anchor.scale.setScalar(HERO_GINGKO_LAYOUT.scale);
  anchor.userData.supportModel = 'terrain-root-flare-to-trunk-to-crown';

  const fallback = new THREE.Group();
  fallback.name = 'world.landmark.fort-gingko.procedural-fallback';
  const bark = shared.plateBarkMaterial.clone();
  bark.userData = {
    ...shared.plateBarkMaterial.userData,
    role: 'hero-gingko-fallback-load-bearing-bark',
  };
  const leaves = shared.crownMaterial.clone();
  leaves.emissive.set(0x000000);
  leaves.emissiveIntensity = 0;
  leaves.userData = {
    surface: 'hero-gingko-fallback-interior-canopy',
    energyModel: 'non-emissive-dielectric-leaf-albedo',
  };
  const trunk = primitive(
    bark,
    shared.plateBarkedTrunkGeometry,
    [0, 0, 0],
    [1.24, 2.12, 1.24],
    [0, 0.18, 0],
  );
  trunk.name = 'fallback-load-bearing-trunk';
  const branches = primitive(
    bark,
    shared.canopyBranchGeometry,
    [0.15, 8.8, -0.05],
    [2.25, 1.75, 2.25],
    [0, -0.45, 0],
  );
  branches.name = 'fallback-load-bearing-crown-branches';
  const crownPlacements = [
    [-2.2, 10.15, -0.4, 1.65, 0.12],
    [0.1, 11.05, 0.15, 1.8, 1.08],
    [2.35, 10.25, 0.2, 1.62, 2.1],
    [-0.9, 9.8, 1.65, 1.35, 0.58],
    [1.15, 10, -1.55, 1.42, 1.72],
  ];
  fallback.add(trunk, branches);
  crownPlacements.forEach(([x, y, z, scale, rotation], index) => {
    const crown = primitive(
      leaves,
      index % 2 ? shared.crownAccentGeometry : shared.crownGeometry,
      [x, y, z],
      [scale, scale * 0.68, scale],
      [0.08, rotation, -0.05],
    );
    crown.name = `fallback-fan-crown-${index + 1}`;
    fallback.add(crown);
  });
  fallback.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  fallback.userData.profile = 'bounded-original-geometry-fallback';
  fallback.userData.supportModel = 'terrain-root-flare-to-visible-branches-to-canopy';
  anchor.add(fallback);
  anchor.userData.fallback = fallback;
  scene.add(anchor);
  return anchor;
}

function makeBrookResponse(scene) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x526453,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.16,
    side: THREE.DoubleSide,
  });
  for (let index = 0; index < 5; index += 1) {
    const frond = new THREE.Mesh(shared.fernGeometries[index % shared.fernGeometries.length], material);
    frond.position.set((index - 2) * 0.72, 0.04, (index % 3) * 0.42);
    frond.scale.setScalar(0.31 + (index % 2) * 0.035);
    frond.rotation.z = (index - 2) * 0.08;
    frond.castShadow = true;
    frond.receiveShadow = true;
    frond.name = `world.connected_route.brook-response.procedural-frond-${index + 1}`;
    group.add(frond);
  }
  group.position.set(-10.5, terrainHeight(-10.5, 47), 47);
  group.name = 'world.connected_route.brook_response';
  group.userData.profile = 'bounded-five-frond-physical-fallback';
  group.userData.supportModel = 'terrain-rooted-rhizome-to-flexing-frond';

  const assetAnchor = new THREE.Group();
  assetAnchor.name = 'world.connected_route.brook-response.asset-anchor';
  assetAnchor.userData.fallbackMeshes = Object.freeze([group]);
  assetAnchor.userData.placements = Object.freeze([
    [-1.25, 0.1, 0.24, -0.45],
    [-0.62, 0.5, 0.28, 0.72],
    [0.03, 0.86, 0.25, -0.18],
    [0.72, 0.08, 0.29, 0.42],
    [1.34, 0.44, 0.23, -0.68],
  ].map(([offsetX, offsetZ, scale, rotation], index) => Object.freeze({
    index,
    x: group.position.x + offsetX,
    z: group.position.z + offsetZ,
    scale,
    variantIndex: 0,
    rotation,
    instanceScale: Object.freeze([scale, scale * 0.9, scale]),
    color: Object.freeze([0.322, 0.095, 0.46 + (index % 3) * 0.025]),
    sourceRole: 'brook-response-humid-brush-replacement',
    maxDiameterMeters: 1.12,
    maxHeightMeters: 0.46,
  })));
  group.userData.assetAnchor = assetAnchor;
  scene.add(group, assetAnchor);
  return group;
}

function makeFieldCameraMount(scene) {
  const group = new THREE.Group();
  group.position.set(2.8, 1.55, 67);
  group.rotation.set(-0.06, Math.PI, 0);
  group.scale.setScalar(0.64);
  group.name = 'tool.field_camera';
  scene.add(group);
  return group;
}

function makeRifleMount(scene) {
  const group = new THREE.Group();
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false,
  });
  const flash = primitive(
    flashMaterial,
    new THREE.ConeGeometry(0.28, 1.1, 8),
    [0, 0.11, -3.32],
    [1, 1, 1],
    [-Math.PI / 2, 0, 0],
  );
  flash.name = 'tool.period_rifle.muzzle_flash';
  flash.visible = false;
  group.add(flash);
  group.position.set(2.8, 1.2, 67);
  group.rotation.set(-0.16, Math.PI, 0);
  group.scale.setScalar(0.34);
  group.name = 'tool.period_rifle';
  group.userData.flash = flash;
  scene.add(group);
  return group;
}

export {
  makeBrookResponse,
  makeFieldCameraMount,
  makeFort,
  makeHeroGingko,
  makeRifleMount,
};
