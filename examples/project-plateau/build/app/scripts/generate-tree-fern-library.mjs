import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

class NodeFileReader {
  result = null;

  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader = NodeFileReader;

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(APP, 'public/assets/tree-fern-library-original-v1.glb');
const SUPPORT_PLANE_Y = -0.18;

const VARIANTS = Object.freeze([
  Object.freeze({
    id: 'humid-arch-tree-fern',
    trunkHeight: 3.22,
    trunkLeanX: 0.04,
    trunkLeanZ: -0.025,
    frondCount: 15,
    segments: 14,
    frondLength: 2.48,
    rise: 0.78,
    droop: 0.68,
    leafletLength: 0.62,
    angleOffset: 0.08,
    hue: 0.315,
  }),
  Object.freeze({
    id: 'storm-swept-tree-fern',
    trunkHeight: 3.48,
    trunkLeanX: -0.13,
    trunkLeanZ: 0.07,
    frondCount: 12,
    segments: 15,
    frondLength: 2.7,
    rise: 0.94,
    droop: 0.55,
    leafletLength: 0.59,
    angleOffset: 0.34,
    hue: 0.302,
  }),
  Object.freeze({
    id: 'sheltered-tier-tree-fern',
    trunkHeight: 2.96,
    trunkLeanX: 0.025,
    trunkLeanZ: 0.055,
    frondCount: 18,
    segments: 13,
    frondLength: 2.2,
    rise: 0.62,
    droop: 0.74,
    leafletLength: 0.56,
    angleOffset: -0.16,
    hue: 0.286,
  }),
]);

function createClosedTube(points, {
  baseRadius,
  tipRadius,
  radialSegments = 6,
  hue = 0.08,
  saturation = 0.28,
  lightness = 0.18,
  flexStart = 0,
  flexEnd = 1,
  phase = 0,
} = {}) {
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const indices = [];
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const t = pointIndex / (points.length - 1);
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    direction.subVectors(next, previous).normalize();
    lateral.crossVectors(direction, up);
    if (lateral.lengthSq() < 0.001) lateral.set(1, 0, 0);
    lateral.normalize();
    binormal.crossVectors(lateral, direction).normalize();
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, t ** 0.78);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + phase * 0.09;
      const point = points[pointIndex].clone()
        .addScaledVector(lateral, Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(...point);
      uvs.push(side / radialSegments, t);
      flexUvs.push(0, THREE.MathUtils.lerp(flexStart, flexEnd, t));
      colour.setHSL(
        hue + t * 0.014,
        saturation + t * 0.045,
        lightness + t * 0.055 + Math.sin(side * 2.1 + pointIndex) * 0.008,
      );
      colors.push(colour.r, colour.g, colour.b);
    }
  }
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const nextSide = (side + 1) % radialSegments;
      const lower = pointIndex * radialSegments + side;
      const lowerNext = pointIndex * radialSegments + nextSide;
      const upper = (pointIndex + 1) * radialSegments + side;
      const upperNext = (pointIndex + 1) * radialSegments + nextSide;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const baseCentre = positions.length / 3;
  positions.push(...points[0]);
  uvs.push(0.5, 0);
  flexUvs.push(0, flexStart);
  colors.push(...colors.slice(0, 3));
  const tipCentre = positions.length / 3;
  positions.push(...points.at(-1));
  uvs.push(0.5, 1);
  flexUvs.push(0, flexEnd);
  colors.push(...colors.slice(-3));
  for (let side = 0; side < radialSegments; side += 1) {
    const nextSide = (side + 1) % radialSegments;
    indices.push(baseCentre, nextSide, side);
    const tip = (points.length - 1) * radialSegments;
    indices.push(tip + side, tip + nextSide, tipCentre);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRootTrunk(spec, variantIndex) {
  const sides = 16;
  const rings = 20;
  const positions = [];
  const uvs = [];
  const flexUvs = [];
  const colors = [];
  const indices = [];
  const colour = new THREE.Color();
  for (let ringIndex = 0; ringIndex < rings; ringIndex += 1) {
    const t = ringIndex / (rings - 1);
    const y = THREE.MathUtils.lerp(SUPPORT_PLANE_Y, spec.trunkHeight, t);
    const baseFlare = Math.exp(-t * 8.5) * 0.24;
    const scarRelief = Math.sin(t * Math.PI * 22 + variantIndex * 0.8) * 0.014;
    const radius = THREE.MathUtils.lerp(0.37, 0.225, t) + baseFlare + scarRelief;
    const centreX = spec.trunkLeanX * t ** 1.35 + Math.sin(t * 7.2 + variantIndex) * 0.018;
    const centreZ = spec.trunkLeanZ * t ** 1.42 + Math.sin(t * 5.7 - variantIndex) * 0.014;
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2 + 0.08;
      const fibreRelief = 1 + Math.sin(side * 3.7 + ringIndex * 0.44) * 0.035;
      positions.push(
        centreX + Math.cos(angle) * radius * fibreRelief,
        y,
        centreZ + Math.sin(angle) * radius * (1.02 - (fibreRelief - 1) * 0.4),
      );
      uvs.push(side / sides, t * 4.2);
      flexUvs.push(0, 0);
      const scar = Math.max(0, Math.sin(t * Math.PI * 22 + variantIndex * 0.8));
      colour.setHSL(
        0.075 + Math.sin(side * 1.7) * 0.006,
        0.28,
        0.145 + scar * 0.035 + t * 0.018,
      );
      colors.push(colour.r, colour.g, colour.b);
    }
  }
  for (let ringIndex = 0; ringIndex < rings - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ringIndex * sides + side;
      const lowerNext = ringIndex * sides + next;
      const upper = (ringIndex + 1) * sides + side;
      const upperNext = (ringIndex + 1) * sides + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const bottomCentre = positions.length / 3;
  positions.push(0, SUPPORT_PLANE_Y, 0);
  uvs.push(0.5, 0);
  flexUvs.push(0, 0);
  colors.push(0.07, 0.047, 0.027);
  const topCentre = positions.length / 3;
  positions.push(spec.trunkLeanX, spec.trunkHeight, spec.trunkLeanZ);
  uvs.push(0.5, 1);
  flexUvs.push(0, 0);
  colors.push(0.19, 0.13, 0.075);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(bottomCentre, next, side);
    const top = (rings - 1) * sides;
    indices.push(top + side, top + next, topCentre);
  }
  const trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  trunk.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  trunk.setAttribute('uv1', new THREE.Float32BufferAttribute(flexUvs, 2));
  trunk.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trunk.setIndex(indices);
  trunk.computeVertexNormals();

  const rootParts = [trunk];
  // A closed crown hub bridges the fibrous trunk to every petiole. Besides
  // carrying the load path, it removes the false sawn-off-cylinder silhouette
  // that a flat trunk cap would create below an open crown.
  rootParts.push(createClosedTube([
    new THREE.Vector3(spec.trunkLeanX * 0.96, spec.trunkHeight - 0.14, spec.trunkLeanZ * 0.96),
    new THREE.Vector3(spec.trunkLeanX, spec.trunkHeight + 0.04, spec.trunkLeanZ),
    new THREE.Vector3(spec.trunkLeanX * 1.02, spec.trunkHeight + 0.22, spec.trunkLeanZ * 1.02),
  ], {
    baseRadius: 0.31,
    tipRadius: 0.15,
    radialSegments: 12,
    hue: 0.09,
    saturation: 0.31,
    lightness: 0.16,
    flexStart: 0,
    flexEnd: 0,
    phase: variantIndex,
  }));
  for (let rootIndex = 0; rootIndex < 7; rootIndex += 1) {
    const angle = (rootIndex / 7) * Math.PI * 2 + variantIndex * 0.27;
    const length = 0.68 + (rootIndex % 3) * 0.09;
    rootParts.push(createClosedTube([
      new THREE.Vector3(Math.cos(angle) * 0.16, 0.27, Math.sin(angle) * 0.16),
      new THREE.Vector3(Math.cos(angle) * 0.42, 0.045, Math.sin(angle) * 0.42),
      new THREE.Vector3(
        Math.cos(angle) * length,
        // A closed tube extends below its centreline by roughly its tip
        // radius. Keep the authored root centre one radius above the declared
        // support plane so no hidden tip silently becomes the real support.
        SUPPORT_PLANE_Y + 0.045,
        Math.sin(angle) * length,
      ),
    ], {
      baseRadius: 0.17,
      tipRadius: 0.045,
      radialSegments: 6,
      hue: 0.072,
      saturation: 0.27,
      lightness: 0.13,
      flexStart: 0,
      flexEnd: 0,
      phase: rootIndex,
    }));
  }
  const geometry = mergeGeometries(rootParts, false);
  rootParts.forEach((part) => part.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const geometryPositions = geometry.getAttribute('position');
  let supportVertexCount = 0;
  for (let index = 0; index < geometryPositions.count; index += 1) {
    if (geometryPositions.getY(index) <= SUPPORT_PLANE_Y + 0.002) supportVertexCount += 1;
  }
  geometry.userData = {
    profile: `closed-root-flare-and-fibrous-trunk-${spec.id}`,
    topology: 'closed-root-disc-plus-overlapping-closed-buttresses-and-trunk',
    supportPlaneY: SUPPORT_PLANE_Y,
    supportVertexCount,
    supportModel: 'broad-root-disc-under-gravitropic-fibrous-trunk',
    trunkHeight: spec.trunkHeight,
  };
  return geometry;
}

function frondCentres(spec, variantIndex, frondIndex) {
  const angularBias = spec.id === 'storm-swept-tree-fern'
    ? Math.sin(frondIndex * 0.83) * 0.16
    : 0;
  const angle = (frondIndex / spec.frondCount) * Math.PI * 2
    + spec.angleOffset
    + Math.sin(frondIndex * 1.91 + variantIndex) * 0.095
    + angularBias;
  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
  const tier = frondIndex % 4;
  const tierLength = [1.06, 1, 0.93, 0.8][tier];
  const tierRise = [0.76, 0.94, 1.1, 1.28][tier];
  const tierDroop = [1.18, 1, 0.82, 0.58][tier];
  const length = spec.frondLength * tierLength * (
    0.88 + (frondIndex % 5) * 0.045
      + (spec.id === 'storm-swept-tree-fern' && frondIndex % 4 === 0 ? -0.13 : 0)
  );
  const crownOrigin = new THREE.Vector3(
    spec.trunkLeanX,
    spec.trunkHeight + 0.06,
    spec.trunkLeanZ,
  );
  const centres = Array.from({ length: spec.segments + 1 }, (_, segment) => {
    const t = segment / spec.segments;
    const radial = length * t * (0.95 + Math.sin(t * Math.PI) * 0.1);
    const point = crownOrigin.clone().addScaledVector(direction, radial);
    point.addScaledVector(
      tangent,
      Math.sin(t * Math.PI) * Math.sin(frondIndex * 1.47 + variantIndex) * length * 0.045,
    );
    point.y += Math.sin(t * Math.PI) * spec.rise * tierRise
      + t * 0.16
      - t * t * spec.droop * tierDroop;
    return point;
  });
  return { angle, direction, tangent, length, centres };
}

function pushCurvedLeaflet(buffers, {
  centre,
  forward,
  tangent,
  side,
  length,
  width,
  flex,
  hue,
  shade,
  droop,
}) {
  const lateral = tangent.clone().multiplyScalar(side);
  const camber = width * 0.22;
  const root = centre.clone().addScaledVector(lateral, 0.026);
  const frontInner = centre.clone().addScaledVector(lateral, length * 0.28)
    .addScaledVector(forward, width * 0.52);
  const frontOuter = centre.clone().addScaledVector(lateral, length * 0.72)
    .addScaledVector(forward, width * 0.4);
  const tip = centre.clone().addScaledVector(lateral, length)
    .addScaledVector(forward, width * 0.06);
  tip.y -= length * droop;
  const rearOuter = centre.clone().addScaledVector(lateral, length * 0.72)
    .addScaledVector(forward, -width * 0.4);
  const rearInner = centre.clone().addScaledVector(lateral, length * 0.28)
    .addScaledVector(forward, -width * 0.52);
  const ridgeInner = centre.clone().addScaledVector(lateral, length * 0.3);
  const ridgeOuter = centre.clone().addScaledVector(lateral, length * 0.7);
  ridgeInner.y += camber;
  ridgeOuter.y += camber * 0.8;
  frontInner.y += camber * 0.24;
  frontOuter.y += camber * 0.16;
  rearInner.y += camber * 0.2;
  rearOuter.y += camber * 0.13;
  const vertices = [
    root, frontInner, frontOuter, tip, rearOuter, rearInner, ridgeInner, ridgeOuter,
  ];
  const textureUvs = [
    [0.5, 0], [1, 0.28], [0.91, 0.72], [0.5, 1],
    [0.09, 0.72], [0, 0.28], [0.5, 0.3], [0.5, 0.7],
  ];
  const indices = [
    0, 1, 6, 0, 6, 5,
    1, 2, 7, 1, 7, 6,
    2, 3, 7, 3, 4, 7,
    4, 5, 6, 4, 6, 7,
  ];
  const baseIndex = buffers.positions.length / 3;
  const colour = new THREE.Color();
  vertices.forEach((point, index) => {
    buffers.positions.push(...point);
    buffers.uvs.push(...textureUvs[index]);
    buffers.flexUvs.push(0, flex);
    const ridge = index === 6 || index === 7;
    colour.setHSL(hue, 0.49, shade + (ridge ? 0.045 : 0));
    buffers.colors.push(colour.r, colour.g, colour.b);
  });
  indices.forEach((index) => buffers.indices.push(baseIndex + index));
}

function createRachisesAndLeaflets(spec, variantIndex) {
  const rachisParts = [];
  const buffers = {
    positions: [], uvs: [], flexUvs: [], colors: [], indices: [],
  };
  for (let frondIndex = 0; frondIndex < spec.frondCount; frondIndex += 1) {
    const {
      tangent, centres,
    } = frondCentres(spec, variantIndex, frondIndex);
    rachisParts.push(createClosedTube(centres, {
      baseRadius: 0.046,
      tipRadius: 0.009,
      radialSegments: 6,
      hue: spec.hue - 0.045,
      saturation: 0.34,
      lightness: 0.16,
      flexStart: 0.04,
      flexEnd: 1,
      phase: frondIndex,
    }));
    for (let segment = 2; segment < spec.segments; segment += 1) {
      const t = segment / spec.segments;
      const leafletLength = spec.leafletLength
        * Math.sin(t * Math.PI) ** 0.5
        * (1 - t * 0.28)
        * (0.92 + Math.sin(segment * 2.2 + frondIndex * 0.8) * 0.055);
      const leafletWidth = leafletLength * (0.26 + t * 0.025);
      const localForward = centres[Math.min(spec.segments, segment + 1)].clone()
        .sub(centres[Math.max(0, segment - 1)])
        .normalize();
      for (const side of [-1, 1]) {
        pushCurvedLeaflet(buffers, {
          centre: centres[segment],
          // Leaflet width follows the local rachis tangent rather than a flat
          // world-horizontal radial. This keeps the lamina visible and attached
          // along both rising and drooping sections of the frond.
          forward: localForward,
          tangent,
          side,
          length: leafletLength,
          width: leafletWidth * 1.24,
          flex: t,
          hue: spec.hue + Math.sin(frondIndex * 1.6 + segment) * 0.007,
          shade: 0.32 + t * 0.07 + (segment % 2) * 0.012,
          droop: 0.075 + t * 0.055,
        });
      }
    }
  }

  for (let shoot = 0; shoot < 3; shoot += 1) {
    const angle = shoot * Math.PI * 2 / 3 + variantIndex * 0.34;
    const origin = new THREE.Vector3(spec.trunkLeanX, spec.trunkHeight, spec.trunkLeanZ);
    rachisParts.push(createClosedTube([
      origin,
      origin.clone().add(new THREE.Vector3(
        Math.cos(angle) * 0.08,
        0.34 + shoot * 0.06,
        Math.sin(angle) * 0.08,
      )),
      origin.clone().add(new THREE.Vector3(
        Math.cos(angle) * (0.16 + shoot * 0.025),
        0.58 + shoot * 0.05,
        Math.sin(angle) * (0.16 + shoot * 0.025),
      )),
    ], {
      baseRadius: 0.038,
      tipRadius: 0.018,
      radialSegments: 6,
      hue: spec.hue - 0.04,
      saturation: 0.36,
      lightness: 0.16,
      flexStart: 0.02,
      flexEnd: 0.38,
      phase: shoot,
    }));
  }
  const rachises = mergeGeometries(rachisParts, false);
  rachisParts.forEach((geometry) => geometry.dispose());
  rachises.computeBoundingBox();
  rachises.computeBoundingSphere();
  rachises.userData = {
    profile: `closed-overlapping-tree-fern-rachises-${spec.id}`,
    topology: 'closed-tapered-petioles-overlap-trunk-crown',
    supportModel: 'each-rachis-base-penetrates-supported-trunk-crown',
    frondCount: spec.frondCount,
    centralShootCount: 3,
  };

  const leaflets = new THREE.BufferGeometry();
  leaflets.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  leaflets.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  leaflets.setAttribute('uv1', new THREE.Float32BufferAttribute(buffers.flexUvs, 2));
  leaflets.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  leaflets.setIndex(buffers.indices);
  leaflets.computeVertexNormals();
  leaflets.computeBoundingBox();
  leaflets.computeBoundingSphere();
  leaflets.userData = {
    profile: `shared-vertex-cambered-pinnate-leaflets-${spec.id}`,
    topology: 'indexed-curved-leaflets-with-continuous-per-leaf-normal-field',
    supportModel: 'every-leaflet-root-overlaps-closed-load-bearing-rachis',
    flexProfile: 'uv1-y-fixed-crown-to-flexible-tip-independent-of-texture-uv',
    leafletPairsPerFrond: spec.segments - 2,
    trianglesPerLeaflet: 8,
  };
  return { rachises, leaflets };
}

function buildVariant(spec, variantIndex) {
  const trunk = createRootTrunk(spec, variantIndex);
  const { rachises, leaflets } = createRachisesAndLeaflets(spec, variantIndex);
  const group = new THREE.Group();
  group.name = `tree-fern-variant-${variantIndex + 1}-${spec.id}`;
  group.userData = {
    variantId: spec.id,
    variantIndex,
    frondCount: spec.frondCount,
    leafletPairsPerFrond: spec.segments - 2,
    drawCalls: 3,
    supportModel: 'buried-root-flare-to-fibrous-trunk-to-closed-rachis-to-attached-leaflet',
  };
  const materials = [
    new THREE.MeshStandardMaterial({
      name: `${spec.id}-root-trunk`, color: 0xffffff, vertexColors: true,
      roughness: 0.96, metalness: 0,
    }),
    new THREE.MeshStandardMaterial({
      name: `${spec.id}-rachis`, color: 0xffffff, vertexColors: true,
      roughness: 0.93, metalness: 0,
    }),
    new THREE.MeshStandardMaterial({
      name: `${spec.id}-leaflets`, color: 0xffffff, vertexColors: true,
      roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    }),
  ];
  const meshes = [
    new THREE.Mesh(trunk, materials[0]),
    new THREE.Mesh(rachises, materials[1]),
    new THREE.Mesh(leaflets, materials[2]),
  ];
  const names = [
    'tree-fern-root-trunk',
    'tree-fern-load-bearing-rachises',
    'tree-fern-attached-leaflets',
  ];
  meshes.forEach((mesh, index) => {
    mesh.name = names[index];
    mesh.userData.name = mesh.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

const root = new THREE.Group();
root.name = 'tree-fern-library-original-v1';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-mesh-library',
  botanicalReference: 'arborescent-fern-root-mantle-fibrous-trunk-and-pinnate-crown',
  supportModel: 'buried-root-flare-to-fibrous-trunk-to-closed-rachis-to-attached-leaflet',
  collisionModel: 'solid-fibrous-trunk-with-non-solid-pliable-fronds',
  variantCount: VARIANTS.length,
  drawCalls: VARIANTS.length * 3,
};
VARIANTS.forEach((spec, index) => root.add(buildVariant(spec, index)));

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
});
await writeFile(OUTPUT, Buffer.from(result));

const trianglesByVariant = root.children.map((variant) => {
  let triangles = 0;
  variant.traverse((object) => {
    if (!object.isMesh) return;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  return triangles;
});
const boundsByVariant = root.children.map((variant) => {
  const bounds = new THREE.Box3().setFromObject(variant);
  return { min: bounds.min.toArray(), max: bounds.max.toArray() };
});
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: result.byteLength,
  triangles: trianglesByVariant.reduce((sum, value) => sum + value, 0),
  trianglesByVariant,
  drawCalls: root.userData.drawCalls,
  supportPlaneY: SUPPORT_PLANE_Y,
  variantIds: VARIANTS.map(({ id }) => id),
  boundsByVariant,
}, null, 2));
