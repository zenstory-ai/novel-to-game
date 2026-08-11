import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

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
const OUTPUT = resolve(APP, 'public/assets/brook-boulder-original-v6.glb');
const BASE_Y = -0.56;

function orientTrianglesOutward(positions, indices, centre = new THREE.Vector3(0, 0, 0)) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  for (let index = 0; index < indices.length; index += 3) {
    a.fromArray(positions, indices[index] * 3);
    b.fromArray(positions, indices[index + 1] * 3);
    c.fromArray(positions, indices[index + 2] * 3);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(centre);
    if (normal.dot(centroid) < 0) {
      [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
    }
  }
}

function createMainMass() {
  // V5 proved the support and transport story, but twelve sectors were visible
  // in the review silhouette. V6 keeps the same broad buried footprint while
  // resolving weathered curvature between a small number of real fracture
  // planes. This is authored surface density, not a displacement-only disguise.
  const segments = 48;
  const rings = [
    { y: BASE_Y, rx: 0.755, rz: 0.605, cx: 0.07, cz: 0.025, phase: 0.00 },
    { y: -0.525, rx: 0.855, rz: 0.675, cx: 0.055, cz: 0.038, phase: 0.05 },
    { y: -0.455, rx: 0.925, rz: 0.735, cx: 0.035, cz: 0.048, phase: 0.10 },
    { y: -0.360, rx: 0.975, rz: 0.775, cx: 0.005, cz: 0.047, phase: 0.16 },
    { y: -0.255, rx: 1.005, rz: 0.805, cx: -0.025, cz: 0.038, phase: 0.22 },
    { y: -0.145, rx: 1.015, rz: 0.817, cx: -0.060, cz: 0.020, phase: 0.28 },
    { y: -0.035, rx: 1.000, rz: 0.807, cx: -0.100, cz: -0.005, phase: 0.35 },
    { y: 0.075, rx: 0.955, rz: 0.778, cx: -0.145, cz: -0.037, phase: 0.42 },
    { y: 0.175, rx: 0.885, rz: 0.730, cx: -0.190, cz: -0.070, phase: 0.49 },
    { y: 0.265, rx: 0.795, rz: 0.663, cx: -0.235, cz: -0.097, phase: 0.56 },
    { y: 0.345, rx: 0.685, rz: 0.575, cx: -0.275, cz: -0.116, phase: 0.63 },
    { y: 0.415, rx: 0.555, rz: 0.468, cx: -0.310, cz: -0.126, phase: 0.70 },
    { y: 0.475, rx: 0.410, rz: 0.350, cx: -0.338, cz: -0.127, phase: 0.77 },
    { y: 0.525, rx: 0.255, rz: 0.220, cx: -0.360, cz: -0.120, phase: 0.84 },
  ];
  const fracturePlanes = [
    [new THREE.Vector3(0.94, 0.13, 0.31).normalize(), 0.805],
    [new THREE.Vector3(-0.73, 0.19, 0.66).normalize(), 0.785],
    [new THREE.Vector3(0.10, 0.25, -0.96).normalize(), 0.725],
    [new THREE.Vector3(-0.27, 0.91, -0.31).normalize(), 0.545],
    [new THREE.Vector3(0.31, 0.87, 0.38).normalize(), 0.610],
  ];
  const positions = [];
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2 + ring.phase * 0.20;
      const coherentBreak = 1
        + Math.sin(angle * 3 + ring.phase * 2.1) * 0.038
        + Math.sin(angle * 5 - 0.8) * 0.018
        + Math.sin(angle * 2 + ringIndex * 0.31) * 0.014;
      const upperLoss = ringIndex >= 5
        ? Math.max(0, Math.sin(angle * 2 - 0.3)) * 0.038
        : 0;
      const point = new THREE.Vector3(
        ring.cx + Math.cos(angle) * ring.rx * (coherentBreak - upperLoss),
        ring.y + (ringIndex === 0
          ? 0
          : Math.sin(angle * 2.7 + ring.phase) * 0.012
            + Math.sin(angle * 5.3 - ring.phase * 0.6) * 0.006),
        ring.cz + Math.sin(angle) * ring.rz * (
          1 + Math.cos(angle * 4 + 0.5) * 0.026 + Math.sin(angle * 7 - 0.4) * 0.010
        ),
      );
      if (ringIndex > 0) {
        for (const [normal, limit] of fracturePlanes) {
          const distance = point.dot(normal);
          if (distance > limit) point.addScaledVector(normal, -(distance - limit));
        }
      }
      // Preserve the approved 2.48 m world-space transport class after the
      // anchor's 1.3x longitudinal scale; added tessellation must not silently
      // turn the residual erratic into a larger hydraulic obstacle.
      point.x *= 0.942;
      positions.push(point.x, point.y, point.z);
    }
  }
  const bottomCentre = positions.length / 3;
  positions.push(0.08 * 0.942, BASE_Y, 0.03);
  const topCentre = positions.length / 3;
  positions.push(-0.378 * 0.942, 0.558, -0.105);
  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const lower = ringIndex * segments + segment;
      const lowerNext = ringIndex * segments + next;
      const upper = (ringIndex + 1) * segments + segment;
      const upperNext = (ringIndex + 1) * segments + next;
      if ((ringIndex + segment) % 2 === 0) {
        indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
      } else {
        indices.push(lower, upper, upperNext, lower, upperNext, lowerNext);
      }
    }
  }
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(bottomCentre, segment, next);
    const topOffset = (rings.length - 1) * segments;
    indices.push(topOffset + segment, topOffset + next, topCentre);
  }
  orientTrianglesOutward(positions, indices, new THREE.Vector3(-0.08, -0.03, 0));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const facetedGeometry = toCreasedNormals(geometry, THREE.MathUtils.degToRad(42));
  geometry.dispose();
  facetedGeometry.computeBoundingBox();
  facetedGeometry.computeBoundingSphere();
  facetedGeometry.userData = {
    profile: 'dense-offset-crown-bank-erratic-with-weathered-load-bearing-fracture-faces',
    topology: 'closed-ring-loft-with-sealed-support-and-crown-caps',
    supportModel: 'coplanar-broad-base-under-centre-of-mass',
    supportPlaneY: BASE_Y,
    supportVertexCount: segments + 1,
    fracturePlaneCount: fracturePlanes.length,
    centreOfMassProjection: 'inside-support-polygon',
    surfaceSectors: segments,
    surfaceRingCount: rings.length,
    normalModel: 'forty-two-degree-selective-fracture-crease-with-continuous-weathered-normals',
  };
  return facetedGeometry;
}

function createClosedFragment({ x, z, radius, height, yaw, sides }) {
  const positions = [];
  const indices = [];
  const fragmentRings = [
    { y: BASE_Y, scale: 1 },
    { y: BASE_Y + height * 0.48, scale: 0.88 },
    { y: BASE_Y + height * 0.82, scale: 0.61 },
  ];
  for (let ringIndex = 0; ringIndex < fragmentRings.length; ringIndex += 1) {
    const ring = fragmentRings[ringIndex];
    for (let side = 0; side < sides; side += 1) {
      const angle = yaw + (side / sides) * Math.PI * 2 + ringIndex * 0.035;
      const breakScale = 0.91
        + Math.sin(side * 2.7 + x * 3.1 + ringIndex * 0.6) * 0.055;
      positions.push(
        x + Math.cos(angle) * radius * ring.scale * breakScale,
        ring.y + (ringIndex === 0 ? 0 : Math.sin(side * 1.7 + z) * height * 0.035),
        z + Math.sin(angle) * radius * ring.scale * (1.01 - breakScale * 0.06),
      );
    }
  }
  const bottomCentre = positions.length / 3;
  positions.push(x, BASE_Y, z);
  const topCentre = positions.length / 3;
  positions.push(x - radius * 0.08, BASE_Y + height, z + radius * 0.04);
  for (let ringIndex = 0; ringIndex < fragmentRings.length - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ringIndex * sides + side;
      const lowerNext = ringIndex * sides + next;
      const upper = (ringIndex + 1) * sides + side;
      const upperNext = (ringIndex + 1) * sides + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const topOffset = (fragmentRings.length - 1) * sides;
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(bottomCentre, side, next);
    indices.push(topOffset + side, topOffset + next, topCentre);
  }
  orientTrianglesOutward(positions, indices, new THREE.Vector3(x, BASE_Y + height * 0.45, z));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const facetedGeometry = toCreasedNormals(geometry, THREE.MathUtils.degToRad(40));
  geometry.dispose();
  return facetedGeometry;
}

function addUvsAndColours(geometry, family) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uvs = new Float32Array(positions.count * 2);
  const colors = new Float32Array(positions.count * 3);
  const colour = new THREE.Color();
  const damp = new THREE.Color(0x33473d);
  const stone = new THREE.Color(0x59635d);
  const fresh = new THREE.Color(0x6b6d63);
  const iron = new THREE.Color(0x665749);
  const lichen = new THREE.Color(0x59634d);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const nx = Math.abs(normals.getX(index));
    const ny = Math.abs(normals.getY(index));
    const nz = Math.abs(normals.getZ(index));
    if (ny >= nx && ny >= nz) {
      uvs[index * 2] = x * 0.44 + 0.5;
      uvs[index * 2 + 1] = z * 0.44 + 0.5;
    } else if (nx >= nz) {
      uvs[index * 2] = z * 0.44 + 0.5;
      uvs[index * 2 + 1] = y * 0.44 + 0.5;
    } else {
      uvs[index * 2] = x * 0.44 + 0.5;
      uvs[index * 2 + 1] = y * 0.44 + 0.5;
    }
    // Rock albedo follows coherent mineral/weathering bands, never camera- or
    // normal-facing sides. The v1 normal-weighted colour split made one half
    // chalk white and the other slate grey under the same sunlight.
    const mineralBand = THREE.MathUtils.clamp(
      0.5
        + Math.sin(x * 2.7 + z * 2.15 + y * 1.4) * 0.22
        + Math.sin(x * 5.1 - z * 3.6) * 0.08,
      0,
      1,
    );
    const capillaryFront = BASE_Y + 0.11
      + Math.sin(x * 4.3 + z * 3.7) * 0.025
      + (mineralBand - 0.5) * 0.035;
    const capillary = 1 - THREE.MathUtils.smoothstep(
      y,
      capillaryFront - 0.06,
      capillaryFront + 0.08,
    );
    const upperWeathering = THREE.MathUtils.smoothstep(y, -0.16, 0.52);
    const ironBand = THREE.MathUtils.smoothstep(
      Math.sin(x * 3.1 - y * 5.4 + z * 2.0),
      0.38,
      0.84,
    ) * (1 - capillary);
    const lichenPatch = THREE.MathUtils.smoothstep(
      Math.sin(x * 5.9 + z * 4.7) * 0.55 + Math.sin(y * 8.2 - z * 2.3) * 0.45,
      0.56,
      0.91,
    ) * upperWeathering;
    colour.copy(stone)
      .lerp(fresh, mineralBand * 0.13 + upperWeathering * 0.045)
      .lerp(iron, ironBand * 0.075)
      .lerp(lichen, lichenPatch * 0.08)
      .lerp(damp, capillary * 0.38);
    if (family === 'apron') colour.lerp(damp, 0.14);
    colors[index * 3] = colour.r;
    colors[index * 3 + 1] = colour.g;
    colors[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

const massGeometry = createMainMass();
addUvsAndColours(massGeometry, 'mass');
const fragmentSpecs = [
  { x: -1.17, z: -0.72, radius: 0.13, height: 0.1, yaw: 0.2, sides: 10 },
  { x: -0.92, z: 0.9, radius: 0.11, height: 0.08, yaw: 0.7, sides: 9 },
  { x: 1.16, z: -0.7, radius: 0.12, height: 0.09, yaw: 0.45, sides: 10 },
  { x: 1.05, z: 0.82, radius: 0.1, height: 0.075, yaw: 0.1, sides: 9 },
  { x: 0.04, z: -1.04, radius: 0.09, height: 0.065, yaw: 0.9, sides: 9 },
];
const fragmentGeometries = fragmentSpecs.map((spec, index) => {
  const geometry = createClosedFragment(spec);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    profile: `settled-spall-fragment-${index + 1}`,
    topology: 'closed-flat-based-fragment',
    supportModel: 'independent-fragment-resting-on-bank-sediment',
    supportPlaneY: BASE_Y,
    fragmentIndex: index,
  };
  addUvsAndColours(geometry, 'apron');
  return geometry;
});

const root = new THREE.Group();
root.name = 'brook-boulder-original-v6';
root.userData = {
  provenance: 'project-original-deterministic-offline-authored-geometry',
  geologicalReference: 'humid-channel-bank-residual-erratic-with-load-bearing-fracture-faces',
  albedoModel: 'coordinate-weathering-and-porosity-varied-capillary-front',
  normalModel: 'forty-two-degree-selective-fracture-crease-with-continuous-weathered-normals',
  supportModel: 'broad-buried-mass-base-with-independent-sediment-supported-spall',
  collisionModel: 'solid-main-mass-with-non-solid-sub-step-spall-apron',
  transportClass: 'immobile-residual-bank-erratic-reexposed-on-inner-bend',
  drawCalls: 1 + fragmentSpecs.length,
};
const mass = new THREE.Mesh(massGeometry, new THREE.MeshStandardMaterial({
  name: 'brook-boulder-weathered-mass',
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.95,
  metalness: 0,
  flatShading: false,
}));
mass.name = 'brook-boulder-load-bearing-mass';
mass.userData.name = mass.name;
const spalls = fragmentGeometries.map((geometry, index) => {
  const spall = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    name: `brook-boulder-settled-spall-${index + 1}`,
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    flatShading: false,
  }));
  spall.name = `brook-boulder-spall-${index + 1}`;
  spall.userData.name = spall.name;
  spall.userData.fragmentIndex = index;
  return spall;
});
for (const mesh of [mass, ...spalls]) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}
root.add(mass, ...spalls);

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
});
await writeFile(OUTPUT, Buffer.from(result));

const bounds = new THREE.Box3().setFromObject(root);
let triangles = 0;
root.traverse((object) => {
  if (!object.isMesh) return;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
});
console.log(JSON.stringify({
  output: OUTPUT,
  bytes: result.byteLength,
  triangles,
  drawCalls: root.userData.drawCalls,
  fragmentCount: fragmentSpecs.length,
  supportPlaneY: BASE_Y,
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
}, null, 2));
