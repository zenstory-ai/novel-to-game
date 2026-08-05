import * as THREE from 'three';

const TAU = Math.PI * 2;
const DEFAULT_VARIANTS = {
  slate: {
    upper: 0x5c7180,
    flank: 0x74807d,
    underside: 0xa18c70,
    beak: 0x77766c,
  },
  cool: {
    upper: 0x607681,
    flank: 0x71858b,
    underside: 0x969184,
    beak: 0x5b605b,
  },
  moss: {
    upper: 0x66766a,
    flank: 0x788579,
    underside: 0x999177,
    beak: 0x666358,
  },
};

function namedGroup(name, position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  return group;
}

function finishGeometry(geometry) {
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  faceted.computeBoundingBox();
  faceted.computeBoundingSphere();
  return faceted;
}

/**
 * Builds an organic, faceted volume along X. Each ring is
 * [x, centreY, centreZ, radiusY, radiusZ, roll?].
 */
function createLoftGeometry(rings, radialSegments = 8, { capStart = true, capEnd = true } = {}) {
  const vertices = [];
  const indices = [];

  for (const [x, centreY, centreZ, radiusY, radiusZ, roll = 0] of rings) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * TAU + roll;
      vertices.push(
        x,
        centreY + Math.cos(angle) * radiusY,
        centreZ + Math.sin(angle) * radiusZ,
      );
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + nextSide;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + nextSide;
      if ((ring + side) % 2 === 0) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, c, d, a, d, b);
      }
    }
  }

  const firstCentre = vertices.length / 3;
  vertices.push(rings[0][0], rings[0][1], rings[0][2]);
  const last = rings[rings.length - 1];
  const lastCentre = vertices.length / 3;
  vertices.push(last[0], last[1], last[2]);
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments;
    if (capStart) indices.push(firstCentre, nextSide, side);
    const offset = (rings.length - 1) * radialSegments;
    if (capEnd) indices.push(lastCentre, offset + side, offset + nextSide);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return finishGeometry(geometry);
}

function createLimbGeometry(length, upperRadius, lowerRadius, depthScale = 0.82) {
  const geometry = createLoftGeometry([
    [0, 0, 0, upperRadius * 0.9, upperRadius * depthScale * 0.92],
    [length * 0.17, 0.015, 0, upperRadius * 1.13, upperRadius * depthScale, 0.08],
    [length * 0.48, -0.01, 0, upperRadius, upperRadius * depthScale * 0.9, 0.15],
    [length * 0.76, 0.012, 0, lowerRadius * 1.14, lowerRadius * depthScale, -0.08],
    [length, 0, 0, lowerRadius * 0.78, lowerRadius * depthScale * 0.72],
  ], 7);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

function createFootGeometry(length, width, height) {
  return createLoftGeometry([
    [-length * 0.2, height * 0.55, 0, height * 0.52, width * 0.55],
    [length * 0.28, height * 0.36, 0, height * 0.42, width * 0.66, 0.12],
    [length * 0.72, height * 0.2, 0, height * 0.25, width * 0.54],
    [length, height * 0.12, 0, height * 0.08, width * 0.32],
  ], 6);
}

function mesh(name, geometry, material) {
  const part = new THREE.Mesh(geometry, material);
  part.name = name;
  part.castShadow = true;
  part.receiveShadow = true;
  return part;
}

function createCheekPlateGeometry(side) {
  const outer = side * 0.405;
  const inner = side * 0.34;
  const vertices = [
    0.08, 0.11, outer,
    0.67, 0.06, side * 0.445,
    1.16, -0.08, side * 0.335,
    0.08, 0.11, inner,
    0.67, 0.06, side * 0.365,
    1.16, -0.08, side * 0.27,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 1, 2, 5, 4, 3,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    2, 5, 3, 2, 3, 0,
  ]);
  return finishGeometry(geometry);
}

function createSurfacePlateGeometry(length, width, camber = 0.012) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -length * 0.5, 0, 0,
    -length * 0.08, width * 0.5, camber,
    length * 0.5, 0, 0,
    -length * 0.08, -width * 0.5, camber,
    0, 0, camber * 1.7,
  ], 3));
  geometry.setIndex([
    0, 1, 4,
    1, 2, 4,
    2, 3, 4,
    3, 0, 4,
  ]);
  return finishGeometry(geometry);
}

/** Sections are [x, centreY, halfHeight, halfWidth, topWidthScale?]. */
function createTrapezoidWedgeGeometry(sections) {
  const vertices = [];
  const indices = [];
  sections.forEach(([x, centreY, halfHeight, halfWidth, topWidthScale = 0.82]) => {
    const topWidth = halfWidth * topWidthScale;
    vertices.push(
      x, centreY + halfHeight, -topWidth,
      x, centreY + halfHeight, topWidth,
      x, centreY - halfHeight, -halfWidth,
      x, centreY - halfHeight, halfWidth,
    );
  });
  for (let section = 0; section < sections.length - 1; section += 1) {
    const a = section * 4;
    const b = a + 4;
    indices.push(
      a, b, a + 1, a + 1, b, b + 1,
      a + 2, a + 3, b + 2, a + 3, b + 3, b + 2,
      a, a + 2, b, a + 2, b + 2, b,
      a + 1, b + 1, a + 3, a + 3, b + 1, b + 3,
    );
  }
  const end = (sections.length - 1) * 4;
  indices.push(0, 1, 2, 1, 3, 2, end, end + 2, end + 1, end + 1, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return finishGeometry(geometry);
}

function addBone(parent, name, length, upperRadius, lowerRadius, angle, material) {
  const pivot = namedGroup(`${name}.pivot`);
  pivot.rotation.z = angle;
  const bone = mesh(
    `${name}.mesh`,
    createLimbGeometry(length, upperRadius, lowerRadius),
    material,
  );
  pivot.add(bone);
  parent.add(pivot);
  return pivot;
}

function createMaterials(young, materialVariant) {
  const requested = typeof materialVariant === 'string'
    ? DEFAULT_VARIANTS[materialVariant]
    : materialVariant;
  const palette = { ...DEFAULT_VARIANTS.slate, ...(requested || {}) };

  if (young) {
    const lift = (hex, amount) => new THREE.Color(hex).lerp(new THREE.Color(0x9c9a7e), amount);
    palette.upper = lift(palette.upper, 0.2);
    palette.flank = lift(palette.flank, 0.22);
    palette.underside = lift(palette.underside, 0.16);
  }

  const standard = (color, roughness) => new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: true,
  });
  return {
    upper: standard(palette.upper, 0.82),
    bodyTail: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.79,
      metalness: 0,
      clearcoat: 0.045,
      clearcoatRoughness: 0.46,
      sheen: 0.16,
      sheenRoughness: 0.76,
      sheenColor: new THREE.Color(0x7f94a0),
      // Preserve the authored low-poly silhouette, but interpolate normals over
      // the single torso-to-tail skin so ring boundaries never read as seams.
      flatShading: false,
      vertexColors: true,
    }),
    bodyTailPalette: {
      upper: new THREE.Color(palette.upper),
      flank: new THREE.Color(palette.flank),
      underside: new THREE.Color(palette.underside),
    },
    flank: standard(palette.flank, 0.87),
    underside: standard(palette.underside, 0.91),
    beak: new THREE.MeshStandardMaterial({
      color: palette.beak,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
      emissive: new THREE.Color(palette.beak),
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide,
    }),
    beakEdge: standard(new THREE.Color(palette.beak).multiplyScalar(0.68), 0.73),
    cheek: standard(new THREE.Color(palette.flank).multiplyScalar(0.86), 0.85),
    mineral: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.upper).lerp(new THREE.Color(0xa9b0a2), 0.28),
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0.19,
      clearcoatRoughness: 0.34,
      sheen: 0.24,
      sheenRoughness: 0.62,
      sheenColor: new THREE.Color(0xaeb8b3),
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    claw: standard(0x303637, 0.84),
    eye: standard(0x121817, 0.38),
    iris: standard(0x8f7c52, 0.5),
  };
}

function addEye(headPivot, side, materials, young) {
  const sideLabel = side < 0 ? 'left' : 'right';
  const socket = namedGroup(`iguanodon.head.eye-${side < 0 ? 'left' : 'right'}.socket`, [
    0.82,
    0.2,
    side * 0.375,
  ]);
  const eyeScale = young ? 1.06 : 1;
  const eyeball = mesh(
    `iguanodon.head.eye-${sideLabel}`,
    new THREE.IcosahedronGeometry(0.072 * eyeScale, 1),
    materials.eye,
  );
  eyeball.scale.z = 0.34;
  const iris = mesh(
    `iguanodon.head.iris-${sideLabel}`,
    new THREE.CircleGeometry(0.032 * eyeScale, 7),
    materials.iris,
  );
  iris.position.z = side * 0.027;
  iris.rotation.y = side < 0 ? Math.PI : 0;
  socket.add(eyeball, iris);
  headPivot.add(socket);

  const brow = mesh(
    `iguanodon.head.brow-${sideLabel}`,
    createSurfacePlateGeometry(0.34, 0.105, 0.018),
    materials.upper,
  );
  brow.position.set(0.79, 0.275, side * 0.404);
  brow.rotation.set(0, side < 0 ? Math.PI : 0, -0.1);
  headPivot.add(brow);
  return socket;
}

function addRearFoot(anklePivot, sideLabel, materials) {
  const footPivot = namedGroup(`iguanodon.${sideLabel}.hind-foot.pivot`);
  footPivot.position.set(0, -0.02, 0);
  const palm = mesh(
    `iguanodon.${sideLabel}.hind-foot`,
    createFootGeometry(0.7, 0.43, 0.2),
    materials.flank,
  );
  footPivot.add(palm);

  [-0.21, 0, 0.21].forEach((z, index) => {
    const toe = mesh(
      `iguanodon.${sideLabel}.hind-toe-${index + 1}`,
      createFootGeometry(index === 1 ? 0.62 : 0.51, 0.105, 0.105),
      materials.claw,
    );
    toe.position.set(0.43 - Math.abs(z) * 0.25, 0.035, z);
    toe.rotation.y = -z * 0.38;
    footPivot.add(toe);
  });
  anklePivot.add(footPivot);
  return footPivot;
}

function addForeHand(wristPivot, side, sideLabel, materials) {
  const handPivot = namedGroup(`iguanodon.${sideLabel}.fore-hand.pivot`);
  const palm = mesh(
    `iguanodon.${sideLabel}.fore-hand`,
    createFootGeometry(0.48, 0.28, 0.14),
    materials.flank,
  );
  handPivot.add(palm);

  [-0.13, 0, 0.13].forEach((z, index) => {
    const digit = mesh(
      `iguanodon.${sideLabel}.fore-digit-${index + 1}`,
      createFootGeometry(index === 1 ? 0.38 : 0.32, 0.07, 0.075),
      materials.claw,
    );
    digit.position.set(0.29, 0.02, z);
    digit.rotation.y = -z * 0.45;
    handPivot.add(digit);
  });

  const thumb = mesh(
    `iguanodon.${sideLabel}.thumb-spike`,
    createLoftGeometry([
      [0, 0, 0, 0.09, 0.075],
      [0.26, 0.08, 0, 0.018, 0.018],
    ], 5),
    materials.claw,
  );
  thumb.position.set(0.08, 0.1, side * 0.16);
  thumb.rotation.y = side * 0.36;
  thumb.rotation.z = 0.34;
  handPivot.add(thumb);
  wristPivot.add(handPivot);
  return handPivot;
}

function addLeg(root, { kind, side, position, materials }) {
  const sideLabel = side < 0 ? 'left' : 'right';
  const isHind = kind === 'hind';
  const upperLength = isHind ? 1.05 : 0.86;
  const lowerLength = isHind ? 1.06 : 1.1;
  const upperAngle = isHind ? -0.2 : 0.32;
  const lowerWorldAngle = isHind ? 0.28 : -0.18;

  const shoulderOrHip = namedGroup(
    `iguanodon.${sideLabel}.${isHind ? 'hip' : 'shoulder'}.pivot`,
    position,
  );
  root.add(shoulderOrHip);
  const upper = addBone(
    shoulderOrHip,
    `iguanodon.${sideLabel}.${isHind ? 'thigh' : 'upper-forelimb'}`,
    upperLength,
    isHind ? 0.43 : 0.3,
    isHind ? 0.31 : 0.22,
    upperAngle,
    materials.upper,
  );

  const mid = namedGroup(`iguanodon.${sideLabel}.${isHind ? 'knee' : 'elbow'}.pivot`, [0, -upperLength, 0]);
  mid.rotation.z = lowerWorldAngle - upperAngle;
  upper.add(mid);
  const jointSleeveGeometry = createLimbGeometry(
    isHind ? 0.48 : 0.38,
    isHind ? 0.29 : 0.205,
    isHind ? 0.235 : 0.165,
    0.78,
  );
  jointSleeveGeometry.translate(0, isHind ? 0.19 : 0.15, 0);
  const jointSleeve = mesh(
    `iguanodon.${sideLabel}.${isHind ? 'knee' : 'elbow'}.sleeve`,
    jointSleeveGeometry,
    materials.flank,
  );
  mid.add(jointSleeve);
  const lower = mesh(
    `iguanodon.${sideLabel}.${isHind ? 'shin' : 'forearm'}.mesh`,
    createLimbGeometry(
      lowerLength,
      isHind ? 0.31 : 0.225,
      isHind ? 0.22 : 0.16,
      0.76,
    ),
    materials.flank,
  );
  mid.add(lower);

  const ankleOrWrist = namedGroup(
    `iguanodon.${sideLabel}.${isHind ? 'ankle' : 'wrist'}.pivot`,
    [0, -lowerLength, 0],
  );
  ankleOrWrist.rotation.z = -lowerWorldAngle;
  mid.add(ankleOrWrist);
  const foot = isHind
    ? addRearFoot(ankleOrWrist, sideLabel, materials)
    : addForeHand(ankleOrWrist, side, sideLabel, materials);

  return {
    root: shoulderOrHip,
    upper,
    mid,
    lower,
    distal: ankleOrWrist,
    foot,
    jointSleeve,
  };
}

function createSkinnedBodyTailGeometry(definitions, rootPosition, palette, radialSegments = 16) {
  const bodyRings = [
    [1.38, 2.1, 0, 0.72, 0.76],
    [0.58, 2.22, 0, 0.93, 0.96, 0.1],
    [-0.28, 2.34, 0, 1.02, 1.02, -0.05],
    [-0.96, 2.34, 0, 1.01, 0.98, 0.04],
    [-1.46, 2.31, 0, 0.95, 0.91, 0.07],
    [-1.86, 2.31, 0, 0.9, 0.86, 0.04],
    [-2.16, 2.3, 0, 0.82, 0.78, 0.01],
    [-2.28, 2.29, 0, 0.77, 0.73, -0.01],
    [-2.38, 2.28, 0, 0.72, 0.69],
  ].map(([x, centreY, centreZ, radiusY, radiusZ, roll = 0]) => ({
    kind: 'body', x, centreY, centreZ, radiusY, radiusZ, roll,
  }));

  const tailRings = [];
  let cumulative = 0;
  definitions.forEach((definition, segment) => {
    for (let step = 1; step <= 6; step += 1) {
      const distance = cumulative + definition.length * (step / 6);
      // The sacral volume already covers the beginning of the first tail bone.
      // Start the explicit caudal rings inside that volume so the silhouette
      // overlaps smoothly instead of revealing a butt-to-tail attachment line.
      if (distance > 0.78) tailRings.push({ kind: 'tail', distance, segment, t: step / 6 });
    }
    cumulative += definition.length;
  });
  const rings = [...bodyRings, ...tailRings];
  const totalLength = definitions.reduce((total, definition) => total + definition.length, 0);
  const visibleTailStart = 0.78;

  const skinForTailDistance = (distance) => {
    if (distance <= 0) return { primaryBone: 0, secondaryBone: 1, secondaryWeight: 0 };
    let start = 0;
    for (let segment = 0; segment < definitions.length; segment += 1) {
      const definition = definitions[segment];
      if (distance <= start + definition.length || segment === definitions.length - 1) {
        const t = THREE.MathUtils.clamp((distance - start) / definition.length, 0, 1);
        return {
          primaryBone: segment + 1,
          secondaryBone: Math.min(definitions.length, segment + 2),
          secondaryWeight: segment === definitions.length - 1 ? 0 : t * t * (3 - 2 * t),
        };
      }
      start += definition.length;
    }
    return { primaryBone: definitions.length, secondaryBone: 0, secondaryWeight: 0 };
  };

  const tailProfile = (distance) => {
    const u = THREE.MathUtils.clamp(
      (distance - visibleTailStart) / (totalLength - visibleTailStart),
      0,
      1,
    );
    const smoothU = u * u * (3 - 2 * u);
    const sCurve = u < 0.5
      ? -Math.sin((u / 0.5) * Math.PI) * 0.11
      : THREE.MathUtils.smoothstep(u, 0.5, 1) * 0.045;
    const proximalMuscle = Math.sin(Math.PI * Math.min(u / 0.32, 1));
    const crown = THREE.MathUtils.lerp(
      rootPosition.y + 0.7,
      rootPosition.y + 0.24,
      smoothU,
    ) + sCurve;
    const radiusY = 0.68 * ((1 - u) ** 0.82) + 0.025 + proximalMuscle * 0.07;
    const radiusZ = 0.66 * ((1 - u) ** 0.76) + 0.025 + proximalMuscle * 0.055;
    return {
      centreY: crown - radiusY,
      centreZ: rootPosition.z + Math.sin(u * Math.PI) * 0.035,
      radiusY,
      radiusZ,
    };
  };

  const vertices = [];
  const indices = [];
  const colors = [];
  const skinIndices = [];
  const skinWeights = [];
  rings.forEach((ring, ringIndex) => {
    let x;
    let centreY;
    let centreZ;
    let radiusY;
    let radiusZ;
    let roll;
    let shade;
    let primaryBone;
    let secondaryBone;
    let secondaryWeight;

    if (ring.kind === 'body') {
      ({ x, centreY, centreZ, radiusY, radiusZ, roll } = ring);
      shade = THREE.MathUtils.lerp(0.92, 0.875, THREE.MathUtils.clamp((-x - 1.25) / 1.3, 0, 1));
      ({ primaryBone, secondaryBone, secondaryWeight } = skinForTailDistance(rootPosition.x - x));
    } else {
      const { distance } = ring;
      const profile = tailProfile(distance);
      x = rootPosition.x - distance;
      ({ centreY, centreZ, radiusY, radiusZ } = profile);
      roll = Math.max(0, ringIndex - bodyRings.length - 3) * 0.024;
      shade = THREE.MathUtils.lerp(
        0.88,
        0.78,
        THREE.MathUtils.clamp(distance / cumulative, 0, 1),
      );
      ({ primaryBone, secondaryBone, secondaryWeight } = skinForTailDistance(distance));
    }

    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * TAU + roll;
      const vertical = Math.cos(angle);
      const upperBlend = THREE.MathUtils.smoothstep(vertical, -0.05, 0.72);
      const undersideBlend = THREE.MathUtils.smoothstep(-vertical, 0.18, 0.86);
      const surfaceColor = palette.flank.clone().lerp(palette.upper, upperBlend);
      surfaceColor.lerp(palette.underside, undersideBlend * 0.9);
      // Low-frequency mineral variation breaks the single-colour clay read
      // without introducing tiled scales or unstable procedural noise.
      const facetVariation = 0.95 + (((ringIndex * 5 + side * 3) % 7) - 3) * 0.012;
      surfaceColor.multiplyScalar(shade * facetVariation);
      vertices.push(
        x,
        centreY + Math.cos(angle) * radiusY,
        centreZ + Math.sin(angle) * radiusZ,
      );
      colors.push(surfaceColor.r, surfaceColor.g, surfaceColor.b);
      skinIndices.push(primaryBone, secondaryBone, 0, 0);
      skinWeights.push(1 - secondaryWeight, secondaryWeight, 0, 0);
    }
  });

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + nextSide;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + nextSide;
      indices.push(a, c, b, b, c, d);
    }
  }
  const frontCentre = vertices.length / 3;
  const front = bodyRings[0];
  vertices.push(front.x, front.centreY, front.centreZ);
  colors.push(palette.upper.r * 0.92, palette.upper.g * 0.92, palette.upper.b * 0.92);
  skinIndices.push(0, 0, 0, 0);
  skinWeights.push(1, 0, 0, 0);
  for (let side = 0; side < radialSegments; side += 1) {
    indices.push(frontCentre, side, (side + 1) % radialSegments);
  }

  const tipCentre = vertices.length / 3;
  const tip = tailProfile(totalLength);
  vertices.push(rootPosition.x - totalLength, tip.centreY, tip.centreZ);
  colors.push(palette.flank.r * 0.78, palette.flank.g * 0.78, palette.flank.b * 0.78);
  skinIndices.push(definitions.length, 0, 0, 0);
  skinWeights.push(1, 0, 0, 0);
  const lastRing = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    indices.push(tipCentre, lastRing + side, lastRing + ((side + 1) % radialSegments));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addBodyTail(root, materials) {
  const definitions = [
    { length: 1, angle: 0.008, yaw: 0.018 },
    { length: 1, angle: -0.006, yaw: -0.032 },
    { length: 0.95, angle: 0.007, yaw: -0.022 },
    { length: 0.8, angle: -0.005, yaw: 0.036 },
    { length: 0.6, angle: 0.004, yaw: 0.03 },
  ];
  const rootPosition = new THREE.Vector3(-1.58, 2.33, 0);
  const pelvis = new THREE.Bone();
  pelvis.name = 'iguanodon.pelvis.pivot';
  const bones = definitions.map((definition, index) => {
    const bone = new THREE.Bone();
    bone.name = `iguanodon.tail.segment-${index + 1}.pivot`;
    bone.position.set(index === 0 ? rootPosition.x : -definitions[index - 1].length, index === 0 ? rootPosition.y : 0, 0);
    return bone;
  });
  pelvis.add(bones[0]);
  for (let index = 1; index < bones.length; index += 1) bones[index - 1].add(bones[index]);

  const bodyTail = new THREE.SkinnedMesh(
    createSkinnedBodyTailGeometry(definitions, rootPosition, materials.bodyTailPalette),
    materials.bodyTail,
  );
  bodyTail.name = 'iguanodon.body-tail.continuous-skin';
  bodyTail.castShadow = true;
  bodyTail.receiveShadow = true;
  bodyTail.userData.tailLength = definitions.reduce((total, definition) => total + definition.length, 0);
  bodyTail.add(pelvis);
  root.add(bodyTail);
  root.updateMatrixWorld(true);
  bodyTail.bind(new THREE.Skeleton([pelvis, ...bones]));
  definitions.forEach((definition, index) => {
    bones[index].rotation.z = definition.angle;
    bones[index].rotation.y = definition.yaw;
  });
  return { bodyTail, tailPivots: bones };
}

function addShoulderScutes(root, materials) {
  const scutes = new THREE.Group();
  scutes.name = 'iguanodon.shoulder.scutes';
  const geometry = createSurfacePlateGeometry(0.22, 0.095, 0.018);
  const scuteMaterial = materials.flank.clone();
  scuteMaterial.color.lerp(materials.upper.color, 0.48).multiplyScalar(0.86);
  scuteMaterial.roughness = 0.72;
  scuteMaterial.side = THREE.DoubleSide;

  const marks = [
    [0.55, 2.64, 0.91, 0.12, 1.05], [0.28, 2.72, 0.96, 0.09, 0.82],
    [0.02, 2.67, 1.0, 0.07, 0.72], [0.72, 2.46, 0.96, 0.08, 0.74],
    [0.42, 2.4, 1.01, 0.05, 0.62], [-0.2, 2.57, 1.0, 0.06, 0.68],
    [0.55, 2.64, -0.91, -0.12, 1.05], [0.28, 2.72, -0.96, -0.09, 0.82],
    [0.02, 2.67, -1.0, -0.07, 0.72], [0.72, 2.46, -0.96, -0.08, 0.74],
    [0.42, 2.4, -1.01, -0.05, 0.62], [-0.2, 2.57, -1.0, -0.06, 0.68],
  ];
  marks.forEach(([x, y, z, rotation, scale], index) => {
    const mark = mesh(`iguanodon.shoulder.scute-${index + 1}`, geometry, scuteMaterial);
    mark.position.set(x, y, z);
    mark.rotation.set(0, z < 0 ? Math.PI : 0, rotation);
    mark.scale.setScalar(scale);
    scutes.add(mark);
  });
  root.add(scutes);
  return scutes;
}

function addMineralSheen(root, materials) {
  const sheen = new THREE.Group();
  sheen.name = 'iguanodon.surface.mineral-sheen';
  const geometry = createSurfacePlateGeometry(0.34, 0.048, 0.008);
  const facets = [
    [-1.05, 3.22, -0.25, 0.2, 1.7],
    [-0.55, 3.34, 0.08, -0.1, 1.45],
    [0.02, 3.3, -0.16, 0.14, 1.25],
    [0.54, 3.12, 0.2, -0.18, 1.08],
  ];
  facets.forEach(([x, y, z, rotation, scale], index) => {
    const facet = mesh(`iguanodon.surface.mineral-facet-${index + 1}`, geometry, materials.mineral);
    facet.position.set(x, y, z);
    facet.rotation.set(-Math.PI / 2, 0, rotation);
    facet.scale.setScalar(scale);
    sheen.add(facet);
  });
  root.add(sheen);
  return sheen;
}

/**
 * Creates a grounded, animation-ready procedural low-poly Iguanodon.
 * The model faces +X and rests on Y=0. `materialVariant` may be
 * "slate", "cool", "moss", or a partial color palette object.
 */
export function createIguanodon({ young = false, materialVariant = 'slate' } = {}) {
  const root = namedGroup(young ? 'subject.iguanodon_family.young' : 'subject.iguanodon_family.adult');
  const materials = createMaterials(young, materialVariant);
  const { bodyTail, tailPivots } = addBodyTail(root, materials);

  const belly = mesh(
    'iguanodon.torso.underside',
    createLoftGeometry([
      [-1.42, 1.84, 0, 0.48, 0.75],
      [-0.52, 1.52, 0, 0.5, 0.9, 0.08],
      [0.44, 1.52, 0, 0.46, 0.86],
      [1.12, 1.76, 0, 0.38, 0.67],
    ], 8),
    materials.underside,
  );
  root.add(belly);

  const neckPivot = namedGroup('iguanodon.neck.pivot', [1.2, 2.04, 0]);
  neckPivot.rotation.z = 0.07;
  const neck = mesh(
    'iguanodon.neck',
    createLoftGeometry([
      [-0.05, 0.05, 0, 0.72, 0.72],
      [0.42, 0.2, 0, 0.7, 0.68, 0.09],
      [0.88, 0.48, 0, 0.57, 0.57, -0.05],
      [1.2, 0.7, 0, 0.47, 0.49],
    ], 8),
    materials.upper,
  );
  neckPivot.add(neck);
  root.add(neckPivot);

  const throat = mesh(
    'iguanodon.neck.underside',
    createLoftGeometry([
      [0.12, -0.18, 0, 0.45, 0.6],
      [0.55, 0.05, 0, 0.41, 0.51],
      [1.08, 0.42, 0, 0.28, 0.38],
    ], 7),
    materials.underside,
  );
  neckPivot.add(throat);

  const headPivot = namedGroup('iguanodon.head.pivot', [1.02, 0.6, 0]);
  headPivot.rotation.z = -0.01;
  const head = mesh(
    'iguanodon.head.skull',
    createLoftGeometry([
      [-0.14, 0, 0, 0.43, 0.46],
      [0.28, 0.13, 0, 0.45, 0.45, 0.08],
      [0.78, 0.12, 0, 0.35, 0.39],
      [1.08, 0.04, 0, 0.27, 0.29, -0.06],
      [1.32, -0.01, 0, 0.2, 0.22],
    ], 8),
    materials.upper,
  );
  headPivot.add(head);

  const beak = mesh(
    'iguanodon.head.beak',
    createTrapezoidWedgeGeometry([
      [1.01, -0.015, 0.16, 0.235, 0.78],
      [1.26, -0.04, 0.075, 0.16, 0.76],
      [1.49, -0.075, 0.012, 0.085, 0.72],
    ]),
    materials.beak,
  );
  headPivot.add(beak);

  const cuttingEdge = mesh(
    'iguanodon.head.beak-cutting-edge',
    new THREE.BoxGeometry(0.035, 0.008, 0.172),
    materials.beakEdge,
  );
  cuttingEdge.position.set(1.497, -0.087, 0);
  headPivot.add(cuttingEdge);

  for (const side of [-1, 1]) {
    const cheek = mesh(
      `iguanodon.head.cheek-${side < 0 ? 'left' : 'right'}`,
      createCheekPlateGeometry(side),
      materials.cheek,
    );
    headPivot.add(cheek);

    const beakEdge = mesh(
      `iguanodon.head.beak-edge-${side < 0 ? 'left' : 'right'}`,
      createLoftGeometry([
        [1.02, -0.105, side * 0.2, 0.032, 0.029],
        [1.25, -0.1, side * 0.145, 0.025, 0.023],
        [1.46, -0.075, side * 0.052, 0.012, 0.012],
      ], 5),
      materials.beakEdge,
    );
    headPivot.add(beakEdge);

    const nostril = mesh(
      `iguanodon.head.nostril-${side < 0 ? 'left' : 'right'}`,
      new THREE.CircleGeometry(0.026, 6),
      materials.eye,
    );
    nostril.position.set(1.16, 0.045, side * 0.235);
    nostril.rotation.y = side < 0 ? Math.PI : 0;
    nostril.rotation.z = -0.15;
    nostril.scale.set(2.4, 0.13, 1);
    headPivot.add(nostril);
  }

  const jawPivot = namedGroup('iguanodon.jaw.pivot', [0.28, -0.13, 0]);
  const jaw = mesh(
    'iguanodon.jaw',
    createTrapezoidWedgeGeometry([
      [0, 0, 0.13, 0.31, 0.78],
      [0.46, -0.015, 0.12, 0.25, 0.76],
      [0.82, -0.005, 0.075, 0.15, 0.74],
      [1.04, 0.02, 0.025, 0.05, 0.68],
    ]),
    materials.underside,
  );
  jawPivot.add(jaw);
  for (const side of [-1, 1]) {
    const jawline = mesh(
      `iguanodon.head.jawline-${side < 0 ? 'left' : 'right'}`,
      createLoftGeometry([
        [0.05, -0.09, side * 0.29, 0.03, 0.028],
        [0.52, -0.1, side * 0.23, 0.025, 0.023],
        [1.02, -0.055, side * 0.075, 0.012, 0.012],
      ], 5),
      materials.cheek,
    );
    jawPivot.add(jawline);
  }
  headPivot.add(jawPivot);
  neckPivot.add(headPivot);

  const eyes = [
    addEye(headPivot, -1, materials, young),
    addEye(headPivot, 1, materials, young),
  ];

  const limbs = {
    leftFore: addLeg(root, {
      kind: 'fore', side: -1, position: [0.92, 1.95, -0.62], materials,
    }),
    rightFore: addLeg(root, {
      kind: 'fore', side: 1, position: [0.92, 1.95, 0.62], materials,
    }),
    leftHind: addLeg(root, {
      kind: 'hind', side: -1, position: [-1.02, 2.12, -0.62], materials,
    }),
    rightHind: addLeg(root, {
      kind: 'hind', side: 1, position: [-1.02, 2.12, 0.62], materials,
    }),
  };

  const scutes = addShoulderScutes(root, materials);
  const mineralSheen = addMineralSheen(root, materials);
  if (young) {
    root.scale.setScalar(0.68);
    headPivot.scale.setScalar(1.13);
    scutes.visible = false;
    mineralSheen.scale.setScalar(0.92);
  } else {
    headPivot.scale.setScalar(1.09);
  }

  const rig = {
    neckPivot,
    headPivot,
    jawPivot,
    tailPivots,
    limbs,
    eyeSockets: eyes,
  };
  root.userData = {
    assetVersion: 'procedural-loft-v7.1',
    young,
    facingAxis: '+X',
    groundY: 0,
    rig,
    headPivot,
    neckPivot,
    jawPivot,
    tailPivots,
    bodyTail,
    limbs,
    sculptRuntime: {
      pivots: rig,
      materialVariant: typeof materialVariant === 'string' ? materialVariant : 'custom',
      approximateHiddenSide: true,
    },
  };

  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return root;
}
