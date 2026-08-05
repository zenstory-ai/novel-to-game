import * as THREE from 'three';

const TAU = Math.PI * 2;

function namedGroup(name, position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  return group;
}

function finishGeometry(geometry) {
  const faceted = geometry.index ? geometry.toNonIndexed() : geometry;
  if (faceted !== geometry) geometry.dispose();
  faceted.computeVertexNormals();
  faceted.computeBoundingBox();
  faceted.computeBoundingSphere();
  return faceted;
}

/** Builds a closed faceted volume along local Z. */
function createAxialLoft(rings, radialSegments = 7) {
  const vertices = [];
  const indices = [];

  rings.forEach(([z, centreX, centreY, radiusX, radiusY, roll = 0]) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * TAU + roll;
      vertices.push(
        centreX + Math.cos(angle) * radiusX,
        centreY + Math.sin(angle) * radiusY,
        z,
      );
    }
  });

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const frontCentre = vertices.length / 3;
  const front = rings[0];
  vertices.push(front[1], front[2], front[0]);
  const backCentre = vertices.length / 3;
  const back = rings.at(-1);
  vertices.push(back[1], back[2], back[0]);
  const backOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(frontCentre, side, next);
    indices.push(backCentre, backOffset + next, backOffset + side);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return finishGeometry(geometry);
}

/** Extrudes an asymmetric silhouette in the YZ plane around local X. */
function createSidePrism(points, halfWidth) {
  const vertices = [];
  const indices = [];
  for (const x of [-halfWidth, halfWidth]) {
    points.forEach(([y, z]) => vertices.push(x, y, z));
  }
  const count = points.length;
  for (let index = 1; index < count - 1; index += 1) {
    indices.push(0, index + 1, index);
    indices.push(count, count + index, count + index + 1);
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(index, next, count + index);
    indices.push(next, count + next, count + index);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return finishGeometry(geometry);
}

/** Builds one closed, cambered and skin-weighted membrane for an entire wing. */
function createContinuousMembraneGeometry(side, shoulderOrigin, thickness = 0.07) {
  const stations = [
    // outward, leading Z, trailing Z, bone A, bone B, B weight
    [0.02, -0.08, 1.05, 0, 0, 0],
    [0.82, -0.18, 1.18, 0, 1, 0.34],
    [1.72, -0.22, 1.08, 1, 1, 0],
    [2.48, -0.29, 0.95, 1, 2, 0.5],
    [3.27, -0.35, 0.78, 2, 2, 0],
    [4.35, -0.28, 0.5, 2, 2, 0],
    [5.45, -0.21, 0.05, 2, 2, 0],
  ];
  const chordFractions = [0, 0.48, 1];
  const vertices = [];
  const indices = [];
  const colors = [];
  const skinIndices = [];
  const skinWeights = [];
  const half = thickness / 2;

  for (const layerY of [-half, half]) {
    stations.forEach(([outward, leadingZ, trailingZ, boneA, boneB, weightB], stationIndex) => {
      chordFractions.forEach((chord, chordIndex) => {
        const camber = chordIndex === 1 ? 0.052 : chordIndex === 2 ? -0.012 : 0;
        vertices.push(
          shoulderOrigin[0] + side * outward,
          shoulderOrigin[1] + layerY + camber,
          shoulderOrigin[2] + THREE.MathUtils.lerp(leadingZ, trailingZ, chord),
        );
        const span = stationIndex / (stations.length - 1);
        const leading = new THREE.Color(0x705d4c);
        const crown = new THREE.Color(0xa18266);
        const trailing = new THREE.Color(0x654c42);
        const chordColor = chordIndex === 0
          ? leading
          : chordIndex === 1 ? crown : trailing;
        chordColor.lerp(new THREE.Color(0x55483f), span * 0.2);
        colors.push(chordColor.r, chordColor.g, chordColor.b);
        skinIndices.push(boneA, boneB, 0, 0);
        skinWeights.push(1 - weightB, weightB, 0, 0);
      });
    });
  }

  const stationCount = stations.length;
  const chordCount = chordFractions.length;
  const layerSize = stationCount * chordCount;
  for (let layer = 0; layer < 2; layer += 1) {
    const offset = layer * layerSize;
    for (let station = 0; station < stationCount - 1; station += 1) {
      for (let chord = 0; chord < chordCount - 1; chord += 1) {
        const a = offset + station * chordCount + chord;
        const b = a + 1;
        const c = offset + (station + 1) * chordCount + chord;
        const d = c + 1;
        if (layer === 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    }
  }

  const perimeter = [];
  for (let station = 0; station < stationCount; station += 1) perimeter.push(station * chordCount);
  for (let chord = 1; chord < chordCount; chord += 1) {
    perimeter.push((stationCount - 1) * chordCount + chord);
  }
  for (let station = stationCount - 2; station >= 0; station -= 1) {
    perimeter.push(station * chordCount + chordCount - 1);
  }
  for (let chord = chordCount - 2; chord > 0; chord -= 1) perimeter.push(chord);
  for (let index = 0; index < perimeter.length; index += 1) {
    const next = (index + 1) % perimeter.length;
    const lowerA = perimeter[index];
    const lowerB = perimeter[next];
    const upperA = lowerA + layerSize;
    const upperB = lowerB + layerSize;
    indices.push(lowerA, lowerB, upperA, lowerB, upperB, upperA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  const finished = finishGeometry(geometry);
  finished.userData.spanStations = stationCount;
  finished.userData.closedVolume = true;
  return finished;
}

function mesh(name, geometry, material) {
  const part = new THREE.Mesh(geometry, material);
  part.name = name;
  part.castShadow = true;
  part.receiveShadow = true;
  return part;
}

function cylinderBetween(name, start, end, startRadius, endRadius, material, radialSegments = 6) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const bone = mesh(
    name,
    finishGeometry(new THREE.CylinderGeometry(endRadius, startRadius, length, radialSegments, 1, false)),
    material,
  );
  bone.position.copy(from).addScaledVector(direction, 0.5);
  bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return bone;
}

function createMaterials() {
  const standard = (color, roughness, options = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: true,
    ...options,
  });

  const membrane = new THREE.MeshPhysicalMaterial({
    color: 0x9a8069,
    roughness: 0.86,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.96,
    transmission: 0.018,
    thickness: 0.07,
    ior: 1.34,
    attenuationColor: new THREE.Color(0x855e45),
    attenuationDistance: 1.15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.91,
    depthWrite: true,
    flatShading: false,
    vertexColors: true,
    emissive: 0x211712,
    emissiveIntensity: 0.055,
  });

  return {
    dorsal: standard(0x343a3a, 0.82),
    flank: standard(0x4b514e, 0.87),
    underside: standard(0x716d62, 0.91),
    membrane,
    edge: standard(0x8f7861, 0.77, { emissive: 0x2b2018, emissiveIntensity: 0.05 }),
    vein: standard(0x58483d, 0.88, { transparent: true, opacity: 0.78 }),
    beak: standard(0x292e2e, 0.76),
    beakEdge: standard(0x7d7362, 0.84),
    orbit: standard(0x222827, 0.88),
    claw: standard(0x181d1d, 0.72),
    eye: standard(0xc3974f, 0.38, { emissive: 0x3d260d, emissiveIntensity: 0.2 }),
  };
}

function addWing(root, side, materials) {
  const sideLabel = side < 0 ? 'left' : 'right';
  const prefix = `pterodactyl.${sideLabel}-wing`;
  const shoulderOrigin = [side * 0.35, 0.16, -0.24];
  const shoulder = new THREE.Bone();
  shoulder.name = `${prefix}.shoulder.pivot`;
  shoulder.position.set(...shoulderOrigin);

  const upperLength = 1.72;
  const upper = cylinderBetween(
    `${prefix}.humerus`,
    [0, 0, 0],
    [side * upperLength, 0.02, -0.22],
    0.13,
    0.095,
    materials.edge,
  );
  shoulder.add(upper);

  const elbow = new THREE.Bone();
  elbow.name = `${prefix}.elbow.pivot`;
  elbow.position.set(side * upperLength, 0.02, -0.22);
  shoulder.add(elbow);

  const forearmLength = 1.55;
  const forearm = cylinderBetween(
    `${prefix}.radius-ulna`,
    [0, 0, 0],
    [side * forearmLength, 0, -0.13],
    0.1,
    0.065,
    materials.edge,
  );
  elbow.add(forearm);

  const wrist = new THREE.Bone();
  wrist.name = `${prefix}.wrist.pivot`;
  wrist.position.set(side * forearmLength, 0, -0.13);
  elbow.add(wrist);

  const wingFingerLength = 2.18;
  const wingFinger = cylinderBetween(
    `${prefix}.wing-finger`,
    [0, 0, 0],
    [side * wingFingerLength, 0, 0.14],
    0.07,
    0.022,
    materials.edge,
    5,
  );
  wrist.add(wingFinger);

  const handPalm = mesh(
    `${prefix}.hand.palm`,
    new THREE.IcosahedronGeometry(0.105, 0),
    materials.flank,
  );
  handPalm.scale.set(0.82, 0.62, 1.12);
  handPalm.position.set(side * 0.025, -0.025, -0.035);
  wrist.add(handPalm);

  const freeDigits = [];
  for (let index = 0; index < 3; index += 1) {
    const digit = namedGroup(`${prefix}.hand.free-digit-${index + 1}.pivot`);
    const spread = index - 1;
    const middle = [
      side * (0.1 + spread * 0.035),
      -0.045 - Math.abs(spread) * 0.012,
      -0.15 - index * 0.03,
    ];
    const distal = [
      side * (0.14 + spread * 0.045),
      -0.085,
      -0.275 - index * 0.038,
    ];
    const clawTip = [
      distal[0] + side * (0.022 + index * 0.004),
      -0.045,
      distal[2] - 0.095,
    ];
    const proximalPhalanx = cylinderBetween(
      `${prefix}.hand.free-digit-${index + 1}.proximal`,
      [side * 0.018, -0.018, -0.02],
      middle,
      0.041 - index * 0.003,
      0.029 - index * 0.002,
      materials.flank,
      6,
    );
    const distalPhalanx = cylinderBetween(
      `${prefix}.hand.free-digit-${index + 1}.distal`,
      middle,
      distal,
      0.03 - index * 0.002,
      0.019,
      materials.flank,
      6,
    );
    const claw = cylinderBetween(
      `${prefix}.hand.free-digit-${index + 1}.claw`,
      distal,
      clawTip,
      0.021,
      0.005,
      materials.claw,
      5,
    );
    digit.add(proximalPhalanx, distalPhalanx, claw);
    wrist.add(digit);
    freeDigits.push(digit);
  }

  const shoulderVeins = [
    cylinderBetween(`${prefix}.membrane.vein-shoulder-a`, [side * 0.25, 0.072, 0.12], [side * 0.56, 0.066, 0.91], 0.026, 0.014, materials.vein, 5),
    cylinderBetween(`${prefix}.membrane.vein-shoulder-b`, [side * 0.72, 0.07, -0.05], [side * 1.02, 0.064, 0.82], 0.023, 0.012, materials.vein, 5),
  ];
  shoulder.add(...shoulderVeins);

  const elbowVeins = [
    cylinderBetween(`${prefix}.membrane.vein-elbow-a`, [side * 0.16, 0.068, 0.02], [side * 0.52, 0.062, 0.7], 0.022, 0.011, materials.vein, 5),
    cylinderBetween(`${prefix}.membrane.vein-elbow-b`, [side * 0.7, 0.066, -0.03], [side * 0.94, 0.06, 0.59], 0.019, 0.009, materials.vein, 5),
  ];
  elbow.add(...elbowVeins);

  const wristVein = cylinderBetween(
    `${prefix}.membrane.vein-wrist`,
    [side * 0.18, 0.064, 0.04],
    [side * 0.84, 0.058, 0.47],
    0.018,
    0.007,
    materials.vein,
    5,
  );
  wrist.add(wristVein);

  const elbowJoint = mesh(
    `${prefix}.elbow.joint`,
    new THREE.IcosahedronGeometry(0.12, 1),
    materials.edge,
  );
  const wristJoint = mesh(
    `${prefix}.wrist.joint`,
    new THREE.IcosahedronGeometry(0.095, 1),
    materials.edge,
  );
  elbow.add(elbowJoint);
  wrist.add(wristJoint);

  const membrane = new THREE.SkinnedMesh(
    createContinuousMembraneGeometry(side, shoulderOrigin),
    materials.membrane,
  );
  membrane.name = `${prefix}.membrane.continuous-skin`;
  membrane.castShadow = true;
  membrane.receiveShadow = true;
  membrane.add(shoulder);
  root.add(membrane);
  root.updateMatrixWorld(true);
  membrane.bind(new THREE.Skeleton([shoulder, elbow, wrist]));
  shoulder.rotation.z = side * -0.025;
  elbow.rotation.y = side * -0.06;
  wrist.rotation.y = side * 0.055;

  return {
    shoulder,
    elbow,
    wrist,
    freeDigits,
    membranes: [membrane],
  };
}

function addHindLimb(root, side, materials) {
  const sideLabel = side < 0 ? 'left' : 'right';
  const prefix = `pterodactyl.${sideLabel}-hindlimb`;
  const hip = namedGroup(`${prefix}.hip.pivot`, [side * 0.29, -0.12, 0.68]);
  const thighEnd = [side * 0.2, -0.28, 0.28];
  const thigh = cylinderBetween(
    `${prefix}.thigh`,
    [0, 0, 0],
    thighEnd,
    0.095,
    0.07,
    materials.flank,
    6,
  );
  const knee = namedGroup(`${prefix}.knee.pivot`, thighEnd);
  const shinEnd = [side * 0.1, -0.33, 0.35];
  const shin = cylinderBetween(
    `${prefix}.shin`,
    [0, 0, 0],
    shinEnd,
    0.068,
    0.043,
    materials.flank,
    6,
  );
  const ankle = namedGroup(`${prefix}.ankle.pivot`, shinEnd);
  const foot = mesh(
    `${prefix}.foot`,
    createAxialLoft([
      [0, 0, 0, 0.1, 0.075],
      [0.18, 0, -0.018, 0.125, 0.066],
      [0.34, 0, -0.035, 0.12, 0.05],
      [0.43, 0, -0.04, 0.09, 0.035],
    ], 6),
    materials.flank,
  );
  foot.rotation.y = side * -0.1;
  ankle.add(foot);

  const plantarPad = mesh(
    `${prefix}.foot.plantar-pad`,
    new THREE.IcosahedronGeometry(0.12, 0),
    materials.underside,
  );
  plantarPad.position.set(0, -0.072, 0.285);
  plantarPad.scale.set(1.15, 0.46, 1.48);
  ankle.add(plantarPad);

  const toes = [];
  for (const [index, toeX] of [-0.09, 0, 0.09].entries()) {
    const toeRoot = namedGroup(`${prefix}.toe-${index + 1}.pivot`, [toeX, -0.045, 0.31]);
    const fan = toeX * 1.45;
    const middle = [fan - toeX, -0.018, 0.19 - Math.abs(toeX) * 0.2];
    const distal = [fan * 1.12 - toeX, -0.006, 0.34 - Math.abs(toeX) * 0.28];
    const clawTip = [distal[0] + Math.sign(toeX) * 0.012, -0.038, distal[2] + 0.085];
    const proximalToe = cylinderBetween(
      `${prefix}.toe-${index + 1}.proximal`,
      [0, 0, 0],
      middle,
      0.042,
      0.03,
      materials.flank,
      6,
    );
    const distalToe = cylinderBetween(
      `${prefix}.toe-${index + 1}.distal`,
      middle,
      distal,
      0.031,
      0.019,
      materials.flank,
      6,
    );
    const toeClaw = cylinderBetween(
      `${prefix}.toe-${index + 1}.claw`,
      distal,
      clawTip,
      0.021,
      0.005,
      materials.claw,
      5,
    );
    toeRoot.add(proximalToe, distalToe, toeClaw);
    ankle.add(toeRoot);
    toes.push(toeRoot);
  }

  const kneeJoint = mesh(
    `${prefix}.knee.joint`,
    new THREE.IcosahedronGeometry(0.075, 0),
    materials.claw,
  );
  knee.add(shin, kneeJoint, ankle);
  hip.add(thigh, knee);
  root.add(hip);
  hip.userData.footRig = { ankle, sole: foot, plantarPad, toes };
  return hip;
}

/**
 * Creates an original, animation-ready, low-poly pterodactyl silhouette.
 * The animal flies toward local -Z. Wing pivots are exposed through userData.rig.
 */
export function createPterodactyl() {
  const root = namedGroup('threat.pterodactyl.distant');
  const materials = createMaterials();

  const torso = mesh(
    'pterodactyl.torso',
    createAxialLoft([
      [-0.88, 0, 0.04, 0.32, 0.31],
      [-0.38, 0, 0.08, 0.42, 0.4, 0.08],
      [0.28, 0, 0.02, 0.38, 0.34],
      [0.94, 0, -0.02, 0.23, 0.22, -0.08],
      [1.22, 0, 0, 0.12, 0.12],
    ]),
    materials.dorsal,
  );
  const shoulderMantle = mesh(
    'pterodactyl.torso.shoulder-mantle',
    createAxialLoft([
      [-0.72, 0, 0.16, 0.37, 0.23],
      [-0.38, 0, 0.22, 0.47, 0.24, 0.08],
      [-0.03, 0, 0.17, 0.39, 0.19],
    ], 7),
    materials.flank,
  );
  const belly = mesh(
    'pterodactyl.torso.underside',
    createAxialLoft([
      [-0.56, 0, -0.12, 0.29, 0.22],
      [0.12, 0, -0.17, 0.32, 0.2, 0.1],
      [0.72, 0, -0.11, 0.2, 0.14],
    ], 6),
    materials.underside,
  );
  root.add(torso, shoulderMantle, belly);

  const neck = mesh(
    'pterodactyl.neck',
    createAxialLoft([
      [-1.02, 0, 0.07, 0.24, 0.25],
      [-1.34, 0, 0.12, 0.2, 0.22, 0.08],
      [-1.61, 0, 0.12, 0.17, 0.18],
    ], 6),
    materials.flank,
  );
  const nuchalSaddle = mesh(
    'pterodactyl.neck.nuchal-saddle',
    createAxialLoft([
      [-1.57, 0, 0.23, 0.13, 0.065],
      [-1.28, 0, 0.27, 0.2, 0.08, 0.09],
      [-0.94, 0, 0.22, 0.29, 0.09],
      [-0.7, 0, 0.17, 0.33, 0.065, -0.06],
    ], 6),
    materials.flank,
  );
  const gularTransition = mesh(
    'pterodactyl.neck.gular-transition',
    createAxialLoft([
      [-1.54, 0, -0.08, 0.13, 0.055],
      [-1.28, 0, -0.13, 0.18, 0.075, 0.08],
      [-0.96, 0, -0.14, 0.25, 0.09],
      [-0.72, 0, -0.1, 0.3, 0.06, -0.05],
    ], 6),
    materials.underside,
  );
  root.add(neck, nuchalSaddle, gularTransition);

  const headPivot = namedGroup('pterodactyl.head.pivot', [0, 0.12, -1.55]);
  const skull = mesh(
    'pterodactyl.head.skull',
    createAxialLoft([
      [-0.08, 0, 0.01, 0.205, 0.22],
      [-0.38, 0, 0.055, 0.255, 0.25, 0.1],
      [-0.72, 0, 0.005, 0.19, 0.16],
      [-0.88, 0, -0.015, 0.155, 0.125],
    ], 7),
    materials.dorsal,
  );
  const beak = mesh(
    'pterodactyl.head.beak.upper-rostrum',
    createAxialLoft([
      [-0.72, 0, 0.005, 0.17, 0.105],
      [-1.16, 0, -0.035, 0.115, 0.068],
      [-1.58, 0, -0.065, 0.066, 0.038],
      [-1.76, 0, -0.082, 0.012, 0.012],
    ], 5),
    materials.beak,
  );
  const lowerBeak = mesh(
    'pterodactyl.head.beak.lower-mandible',
    createAxialLoft([
      [-0.72, 0, -0.105, 0.15, 0.045],
      [-1.18, 0, -0.11, 0.1, 0.035],
      [-1.6, 0, -0.105, 0.042, 0.018],
    ], 5),
    materials.beakEdge,
  );
  const crest = mesh(
    'pterodactyl.head.crest',
    createSidePrism([
      [0.12, -0.16],
      [0.38, 0.14],
      [0.3, 0.57],
      [0.08, 0.78],
      [0.035, 0.18],
    ], 0.105),
    materials.flank,
  );
  const throat = mesh(
    'pterodactyl.head.throat-keel',
    createSidePrism([
      [-0.03, -0.12],
      [-0.2, -0.42],
      [-0.12, -0.75],
      [-0.025, -0.5],
    ], 0.13),
    materials.underside,
  );
  headPivot.add(skull, beak, lowerBeak, crest, throat);

  for (const side of [-1, 1]) {
    const sideLabel = side < 0 ? 'left' : 'right';
    const orbit = mesh(
      `pterodactyl.head.orbit-${sideLabel}`,
      finishGeometry(new THREE.TorusGeometry(0.09, 0.022, 4, 8)),
      materials.orbit,
    );
    orbit.position.set(side * 0.215, 0.085, -0.39);
    orbit.rotation.y = Math.PI / 2;
    const eye = mesh(
      `pterodactyl.head.eye-${sideLabel}`,
      new THREE.IcosahedronGeometry(0.058, 1),
      materials.eye,
    );
    eye.position.set(side * 0.224, 0.085, -0.39);
    eye.scale.x = 0.54;
    const nostril = mesh(
      `pterodactyl.head.nostril-${sideLabel}`,
      new THREE.IcosahedronGeometry(0.035, 0),
      materials.orbit,
    );
    nostril.position.set(side * 0.112, 0.05, -0.91);
    nostril.scale.x = 0.42;
    headPivot.add(orbit, eye, nostril);
  }
  root.add(headPivot);

  const tailPivot = namedGroup('pterodactyl.tail.pivot', [0, 0, 1.05]);
  const tail = mesh(
    'pterodactyl.tail',
    createAxialLoft([
      [0, 0, 0, 0.13, 0.12],
      [0.46, 0, 0.01, 0.08, 0.075],
      [0.92, 0, 0.015, 0.025, 0.025],
    ], 5),
    materials.flank,
  );
  tailPivot.add(tail);
  root.add(tailPivot);

  const leftWing = addWing(root, -1, materials);
  const rightWing = addWing(root, 1, materials);
  const leftHindLimb = addHindLimb(root, -1, materials);
  const rightHindLimb = addHindLimb(root, 1, materials);

  const rig = {
    head: headPivot,
    leftWing: {
      shoulder: leftWing.shoulder,
      elbow: leftWing.elbow,
      wrist: leftWing.wrist,
      freeDigits: leftWing.freeDigits,
      membraneSegments: leftWing.membranes,
    },
    rightWing: {
      shoulder: rightWing.shoulder,
      elbow: rightWing.elbow,
      wrist: rightWing.wrist,
      freeDigits: rightWing.freeDigits,
      membraneSegments: rightWing.membranes,
    },
    tail: tailPivot,
    hindLimbs: { left: leftHindLimb, right: rightHindLimb },
  };

  root.userData = {
    assetVersion: 'procedural-pterodactyl-v5',
    rig,
    leftWing: leftWing.shoulder,
    rightWing: rightWing.shoulder,
    silhouette: 'continuous-skinned-membrane-wing',
    forwardAxis: '-Z',
  };

  return root;
}
