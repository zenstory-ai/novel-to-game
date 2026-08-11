import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  mergeGeometries,
  toCreasedNormals,
} from 'three/addons/utils/BufferGeometryUtils.js';
import {
  applyHy3dIguanodonPose,
  HY3D_IGUANODON_ASSET,
  IGUANODON_SKIN_SURFACE,
  upgradeIguanodonFamilyWithHy3d,
} from './hy3d-iguanodon.js';
import {
  applyHy3dPterodactylPose,
  HY3D_PTERODACTYL_ASSET,
  upgradePterodactylFlockWithHy3d,
} from './hy3d-pterodactyl.js';
import {
  attachHy3dFieldCameraVisual,
  HY3D_FIELD_CAMERA_ASSET,
  loadHy3dFieldCameraTemplate,
} from './hy3d-field-camera.js';
import {
  attachHy3dRifleVisual,
  HY3D_RIFLE_ASSET,
  loadHy3dRifleTemplate,
} from './hy3d-rifle.js';
import {
  attachHeroGingkoVisual,
  HERO_GINGKO_ASSET,
  loadHeroGingkoTemplate,
  updateHeroGingkoWind,
} from './hero-gingko.js';
import {
  attachBasaltShelfVisual,
  BASALT_SHELF_ASSET,
  loadBasaltShelfTemplate,
} from './basalt-shelf.js';
import {
  attachBrookBoulderVisual,
  BROOK_BOULDER_ASSET,
  loadBrookBoulderTemplate,
} from './brook-boulder.js';
import {
  attachFernLibraryVisual,
  FERN_LIBRARY_ASSET,
  FERN_WIND_PROFILE,
  loadFernLibraryTemplate,
  updateFernLibraryWind,
} from './fern-library.js';
import {
  attachGroundCoverLibraryVisual,
  GROUND_COVER_ARCHITECTURE_PROFILE,
  GROUND_COVER_LIBRARY_ASSET,
  GROUND_COVER_WIND_PROFILE,
  loadGroundCoverLibraryTemplate,
  updateGroundCoverLibraryWind,
} from './ground-cover-library.js';
import {
  attachTreeFernLibraryVisual,
  loadTreeFernLibraryTemplate,
  TREE_FERN_LIBRARY_ASSET,
  TREE_FERN_WIND_PROFILE,
  updateTreeFernLibraryWind,
} from './tree-fern-library.js';
import {
  attachCanopyTreeLibraryVisual,
  CANOPY_TREE_LIBRARY_ASSET,
  CANOPY_TREE_SURFACE_VARIATION_PROFILE,
  CANOPY_TREE_WIND_PROFILE,
  loadCanopyTreeLibraryTemplate,
  updateCanopyTreeLibraryWind,
} from './canopy-tree-library.js';
import {
  createForestSuccessionLayout,
  FOREST_SUCCESSION_PROFILE,
} from './forest-succession.js';
import {
  VEGETATION_BASE_COLOURS,
  vegetationLeafTint,
  vegetationStructureTint,
} from './vegetation-albedo.js';
import {
  FOREST_FLOOR_DETRITUS_PROFILE,
  createForestFloorDetritusLayer,
} from './forest-floor-detritus.js';
import {
  BRYOPHYTE_GROUND_LAYER_PROFILE,
  createBryophyteGroundLayer,
} from './bryophyte-ground-layer.js';
import { createIguanodon } from './iguanodon.js';
import { createPterodactyl } from './pterodactyl.js';
import { PALETTE, SCENE_BUDGET, seededRandom } from './config.js';
import { NAVIGATION_BOUNDS } from './collision-layout.js';
import {
  BASALT_FORMATION_LAYOUT,
  BROOK_BOULDER,
  COVER_ARCH_LAYOUT,
  COVER_RIPARIAN_TREE_LAYOUT,
  FAMILY_LAYOUT,
  FEEDING_BRANCH,
  FERN_LIBRARY_LAYOUT,
  FLUVIAL_ROCK_TRANSPORT_PROFILE,
  FOREGROUND_FROND_LAYOUT,
  FORT_FIREPIT,
  FORT_TENT_LAYOUT,
  HABITAT_TREE_LAYOUT,
  HERO_GINGKO_LAYOUT,
  NON_COLUMNAR_ROCK_LAYOUT,
  VEGETATION_LAYOUT,
} from './environment-layout.js';
import {
  BASALT_ESCARPMENT_PROFILE,
  BROOK_CONTROL_POINTS,
  COVERED_FORK_CONTROL_POINTS,
  EAST_ESCARPMENT_SURFACE_PROFILE,
  EXPOSED_FORK_CONTROL_POINTS,
  MAIN_ROUTE_CONTROL_POINTS,
  TERRAIN_ECOLOGY_PROFILE,
  TERRAIN_BRYOPHYTE_PROFILE,
  TERRAIN_FLUVIAL_SURFACE_PROFILE,
  TERRAIN_GEOMORPHOLOGY_PROFILE,
  TERRAIN_ROUTE_SURFACE_PROFILE,
  basaltEscarpmentHeight,
  brookFluvialProcessAt,
  eastEscarpmentSurfaceAt,
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from './terrain.js';
import {
  BROOK_FREE_SURFACE_PROFILE,
  BROOK_HYDROLOGY_PROFILE,
  BROOK_OBSTACLE_FLOW_PROFILE,
  BROOK_REFLECTION_PROFILE,
  buildBrookObstacleFlowField,
  buildBrookHydrology,
} from './brook-hydrology.js';

export { terrainHeight } from './terrain.js';

function toNonIndexed(geometry) {
  if (!geometry.index) return geometry;
  const expanded = geometry.toNonIndexed();
  geometry.dispose();
  return expanded;
}

function mergeParts(parts) {
  const expanded = parts.map(toNonIndexed);
  expanded.forEach((part) => {
    for (const attribute of Object.keys(part.attributes)) {
      if (attribute !== 'position') part.deleteAttribute(attribute);
    }
  });
  const merged = mergeGeometries(expanded, false);
  expanded.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function mergeSmoothParts(parts) {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function transformGeometry(geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function createVerticalLoft(rings, radialSegments = 7) {
  const vertices = [];
  const indices = [];
  rings.forEach(([y, centreX, centreZ, radiusX, radiusZ, roll = 0]) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + roll;
      vertices.push(
        centreX + Math.cos(angle) * radiusX,
        y,
        centreZ + Math.sin(angle) * radiusZ,
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
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottomCentre = vertices.length / 3;
  vertices.push(rings[0][1], rings[0][0], rings[0][2]);
  const topCentre = vertices.length / 3;
  const top = rings.at(-1);
  vertices.push(top[1], top[0], top[2]);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createCylinderBetween(start, end, startRadius, endRadius, radialSegments = 6) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(
    endRadius,
    startRadius,
    direction.length(),
    radialSegments,
    1,
    false,
  );
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    from.clone().addScaledVector(direction, 0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  ));
  return geometry;
}

function createPrehistoricTrunkGeometry() {
  const parts = [createVerticalLoft([
    [0, 0, 0, 0.68, 0.6],
    [0.7, 0.03, -0.04, 0.52, 0.48, 0.08],
    [2.3, -0.08, 0.1, 0.39, 0.35, -0.05],
    [4.2, 0.12, 0.04, 0.3, 0.27, 0.1],
    [5.8, 0.22, -0.1, 0.22, 0.2, -0.04],
  ], 11)];
  const roots = [0.1, 1.37, 2.66, 3.94, 5.2];
  roots.forEach((angle, index) => {
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.18, 0.2, Math.sin(angle) * 0.18],
      [Math.cos(angle) * (0.92 + (index % 2) * 0.18), 0.035, Math.sin(angle) * (0.92 + (index % 2) * 0.18)],
      0.31,
      0.075,
      7,
    ));
  });
  parts.push(
    createCylinderBetween([0.08, 4.35, 0.02], [1.28, 5.3, 0.34], 0.24, 0.09, 9),
    createCylinderBetween([0.02, 4.78, -0.04], [-0.92, 5.5, -0.5], 0.2, 0.075, 9),
    createCylinderBetween([0.16, 5.1, -0.08], [0.62, 5.82, -0.72], 0.16, 0.06, 8),
  );
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const faceBreak = normals ? Math.abs(normals.getX(index)) * 0.08 : 0;
    const barkRidge = Math.sin(y * 3.4 + x * 7.1 - z * 5.3) * 0.12
      + Math.sin(y * 8.7 - x * 2.8) * 0.05;
    const shade = THREE.MathUtils.clamp(0.78 + barkRidge + faceBreak, 0.57, 1);
    colors.push(shade, shade * 0.96, shade * 0.84);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 6.2);
  geometry.userData.profile = 'buttressed-bent-branching';
  geometry.userData.surface = 'directional-bark-plane-variation';
  geometry.userData.barkFamily = 'wet-furrowed-buttress';
  geometry.userData.geometricRelief = 'bent-loft-with-buttress-roots';
  return geometry;
}

function createPlateBarkedTrunkGeometry() {
  const radialSegments = 14;
  const rings = [
    [0, 0, 0, 0.72, 0.64],
    [0.32, 0.02, -0.025, 0.63, 0.57],
    [0.78, 0.045, -0.055, 0.54, 0.49],
    [1.35, 0.015, 0.015, 0.48, 0.43],
    [2.05, -0.075, 0.09, 0.415, 0.37],
    [2.78, -0.09, 0.125, 0.365, 0.325],
    [3.48, -0.02, 0.08, 0.325, 0.29],
    [4.12, 0.09, 0.015, 0.29, 0.255],
    [4.72, 0.165, -0.055, 0.255, 0.225],
    [5.25, 0.205, -0.095, 0.225, 0.2],
    [5.72, 0.225, -0.115, 0.19, 0.17],
  ];
  const vertices = [];
  const indices = [];
  rings.forEach(([y, centreX, centreZ, radiusX, radiusZ], ringIndex) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + 0.08;
      // The relief is part of the load-bearing trunk surface: long radial
      // flutes continue between rings while smaller staggered plates vary with
      // height. Nothing is offset as a floating bark decal.
      const longFlute = Math.sin(angle * 5 + 0.32) * 0.055;
      const plateStep = Math.sin(angle * 3 - ringIndex * 1.17) * 0.028
        + Math.sin(angle * 7 + ringIndex * 0.73) * 0.014;
      const relief = 1 + longFlute + plateStep;
      vertices.push(
        centreX + Math.cos(angle) * radiusX * relief,
        y,
        centreZ + Math.sin(angle) * radiusZ * relief,
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
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottomCentre = vertices.length / 3;
  vertices.push(rings[0][1], 0, rings[0][2]);
  const topCentre = vertices.length / 3;
  const top = rings.at(-1);
  vertices.push(top[1], top[0], top[2]);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  trunk.setIndex(indices);

  const parts = [trunk];
  [0.25, 1.53, 2.82, 4.08, 5.38].forEach((angle, index) => {
    const length = 0.86 + (index % 2) * 0.19;
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.22, 0.2, Math.sin(angle) * 0.22],
      [Math.cos(angle) * length, 0.035, Math.sin(angle) * length],
      0.29,
      0.07,
      8,
    ));
  });
  parts.push(
    createCylinderBetween([0.04, 4.28, 0.02], [1.12, 5.2, 0.52], 0.225, 0.078, 9),
    createCylinderBetween([-0.01, 4.62, 0.01], [-1.08, 5.34, -0.26], 0.19, 0.066, 9),
    createCylinderBetween([0.12, 5.02, -0.06], [0.52, 5.72, -0.78], 0.15, 0.052, 8),
  );
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const faceLight = normals ? Math.abs(normals.getZ(index)) * 0.055 : 0;
    const plateValue = Math.sin(y * 4.6 - x * 5.8 + z * 3.3) * 0.085
      + Math.sin(y * 9.8 + x * 2.4) * 0.035;
    const shade = THREE.MathUtils.clamp(0.73 + plateValue + faceLight, 0.52, 0.94);
    colors.push(shade, shade * 0.9, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 6.1);
  geometry.userData.profile = 'fluted-plate-barked-buttressed-trunk';
  geometry.userData.surface = 'attached-fibrous-bark-plate-relief';
  geometry.userData.barkFamily = 'plate-barked-fibrous';
  geometry.userData.geometricRelief = 'continuous-radial-flutes-and-staggered-plates';
  geometry.userData.supportModel = 'coplanar-root-flare-with-five-buttresses';
  return geometry;
}

function createCanopyClusterGeometry(accent = false) {
  const lobes = accent ? [
    [[-0.72, 0.05, 0.18], [0.82, 0.46, 0.72], [0.08, 0.45, -0.05]],
    [[0.34, 0.18, -0.38], [0.76, 0.38, 0.62], [-0.06, -0.18, 0.08]],
    [[0.82, -0.02, 0.3], [0.58, 0.34, 0.52], [0.12, 0.18, 0.04]],
    [[-0.05, 0.44, 0.46], [0.62, 0.32, 0.56], [0.04, 0.38, -0.12]],
  ] : [
    [[-1.18, -0.04, 0.16], [1.05, 0.62, 0.92], [0.05, 0.32, 0.02]],
    [[-0.26, 0.28, -0.7], [1.08, 0.66, 0.82], [-0.08, -0.2, 0.1]],
    [[0.92, -0.02, 0.22], [0.96, 0.58, 0.88], [0.12, 0.42, -0.04]],
    [[0.14, 0.62, 0.54], [0.9, 0.5, 0.78], [-0.04, 0.12, 0.08]],
    [[0.45, 0.46, -0.36], [0.74, 0.42, 0.68], [0.08, -0.38, -0.03]],
    [[-0.58, 0.48, 0.52], [0.7, 0.4, 0.62], [-0.12, 0.25, 0.06]],
  ];
  const parts = lobes.map(([position, scale, rotation]) => transformGeometry(
    new THREE.IcosahedronGeometry(1, 2),
    position,
    scale,
    rotation,
  ));
  const geometry = mergeSmoothParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const sunBreak = Math.sin(x * 4.7 + z * 6.2 + y * 3.1) * 0.09;
    const heightBreak = THREE.MathUtils.clamp(y * 0.07, -0.03, 0.08);
    const shade = THREE.MathUtils.clamp(0.82 + sunBreak + heightBreak, 0.64, 1);
    colors.push(shade * 0.86, shade, shade * 0.76);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = accent ? 'asymmetric-accent-lobes' : 'asymmetric-multi-lobe';
  geometry.userData.surface = 'broken-canopy-plane-variation';
  geometry.userData.shading = 'retained-smooth-source-normals';
  return geometry;
}

const CANOPY_PRIMARY_BRANCHES = Object.freeze([
  [[0, 0, 0], [-1.55, 0.72, 0.32], 0.2, 0.085],
  [[0.04, 0.08, 0], [1.48, 0.62, 0.52], 0.19, 0.08],
  [[0, 0.16, -0.03], [-0.5, 1.08, -1.28], 0.17, 0.065],
  [[0.03, 0.24, 0.04], [0.72, 1.26, -0.72], 0.16, 0.06],
  [[-0.02, 0.34, 0.06], [0.18, 1.58, 0.66], 0.145, 0.052],
]);

const CANOPY_SECONDARY_BRANCHES = Object.freeze([
  [[-1.24, 0.61, 0.26], [-2.08, 0.92, 0.78], 0.09, 0.035],
  [[-1.18, 0.58, 0.22], [-1.74, 1.04, -0.42], 0.08, 0.03],
  [[1.16, 0.52, 0.42], [2.02, 0.86, 0.12], 0.085, 0.032],
  [[1.1, 0.5, 0.4], [1.56, 1.05, 1.02], 0.075, 0.028],
  [[-0.4, 0.94, -1.05], [-1.15, 1.32, -1.58], 0.07, 0.026],
  [[0.58, 1.09, -0.62], [1.18, 1.52, -1.18], 0.068, 0.024],
  [[0.16, 1.36, 0.54], [-0.32, 1.91, 1.08], 0.062, 0.022],
  [[0.17, 1.38, 0.55], [0.72, 1.84, 0.92], 0.058, 0.02],
]);

const CANOPY_LEAF_ANCHORS = Object.freeze(CANOPY_SECONDARY_BRANCHES.map(([, end]) => end));

function createCanopyBranchGeometry() {
  // One visible load path runs from the trunk crown into every major leaf
  // mass. Intersecting tapered cylinders are intentional branch unions; they
  // prevent the canopy cards from reading as unsupported green clouds.
  const parts = [...CANOPY_PRIMARY_BRANCHES, ...CANOPY_SECONDARY_BRANCHES].map(([
    start,
    end,
    startRadius,
    endRadius,
  ]) => createCylinderBetween(start, end, startRadius, endRadius, 7));
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const mineral = Math.sin(y * 7.2 + x * 3.9 - z * 5.4) * 0.08;
    const shade = THREE.MathUtils.clamp(0.7 + mineral + y * 0.025, 0.53, 0.82);
    colors.push(shade, shade * 0.93, shade * 0.78);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 2.2);
  geometry.userData.profile = 'load-bearing-radial-branch-whorl';
  geometry.userData.primaryBranchCount = CANOPY_PRIMARY_BRANCHES.length;
  geometry.userData.secondaryBranchCount = CANOPY_SECONDARY_BRANCHES.length;
  geometry.userData.leafAnchorCount = CANOPY_LEAF_ANCHORS.length;
  geometry.userData.leafAnchorPositions = CANOPY_LEAF_ANCHORS.map((anchor) => [...anchor]);
  geometry.userData.supportModel = 'trunk-to-primary-to-leaf-cluster';
  return geometry;
}

function createGroundCoverGeometry(variant = 0) {
  const vertices = [];
  const colors = [];
  const bladeCount = 9 + variant * 2;
  for (let index = 0; index < bladeCount; index += 1) {
    const angle = (index / bladeCount) * Math.PI * 2 + variant * 0.31;
    const radial = 0.05 + (index % 4) * 0.075;
    const height = 0.44 + ((index * 5 + variant * 3) % 7) * 0.075;
    const width = 0.055 + ((index + variant) % 3) * 0.018;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const base = direction.clone().multiplyScalar(radial);
    const middle = base.clone().addScaledVector(direction, height * 0.19);
    middle.y = height * 0.58;
    const tip = base.clone().addScaledVector(direction, height * (0.28 + variant * 0.025));
    tip.y = height;
    const baseLeft = base.clone().addScaledVector(tangent, width);
    const baseRight = base.clone().addScaledVector(tangent, -width);
    const middleLeft = middle.clone().addScaledVector(tangent, width * 0.62);
    const middleRight = middle.clone().addScaledVector(tangent, -width * 0.62);
    for (const point of [
      baseLeft, middleLeft, baseRight,
      baseRight, middleLeft, middleRight,
      middleLeft, tip, middleRight,
    ]) {
      vertices.push(point.x, point.y, point.z);
      const heightWeight = point.y / height;
      const shade = 0.72 + heightWeight * 0.24 + Math.sin(index * 2.7) * 0.035;
      colors.push(shade * 0.78, shade, shade * 0.68);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = `curved-blade-ground-cover-${variant + 1}`;
  geometry.userData.surface = 'height-varied-blade-clump';
  return geometry;
}

function createBroadleafGroundCoverGeometry() {
  const vertices = [];
  const colors = [];
  const leafCount = 7;
  const segments = 5;
  for (let leaf = 0; leaf < leafCount; leaf += 1) {
    const angle = (leaf / leafCount) * Math.PI * 2 + (leaf % 2 ? 0.16 : -0.09);
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const length = 0.62 + (leaf % 3) * 0.13;
    const width = 0.14 + ((leaf * 2) % 4) * 0.025;
    const centres = [];
    const leftEdges = [];
    const rightEdges = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const centre = direction.clone().multiplyScalar(length * t);
      centre.addScaledVector(tangent, Math.sin(t * Math.PI) * (leaf % 2 ? 0.035 : -0.028));
      centre.y = 0.025 + Math.sin(t * Math.PI) * (0.2 + (leaf % 3) * 0.035) + t * 0.055;
      const halfWidth = Math.pow(Math.sin(t * Math.PI), 0.72) * width + 0.008;
      centres.push(centre);
      leftEdges.push(centre.clone().addScaledVector(tangent, halfWidth));
      rightEdges.push(centre.clone().addScaledVector(tangent, -halfWidth));
    }
    for (let segment = 0; segment < segments; segment += 1) {
      const points = [
        leftEdges[segment],
        leftEdges[segment + 1],
        rightEdges[segment],
        rightEdges[segment],
        leftEdges[segment + 1],
        rightEdges[segment + 1],
      ];
      points.forEach((point, pointIndex) => {
        vertices.push(point.x, point.y, point.z);
        const t = (segment + (pointIndex === 1 || pointIndex === 4 || pointIndex === 5 ? 1 : 0))
          / segments;
        const midrib = pointIndex === 0 || pointIndex === 3 ? 0.025 : 0;
        const shade = 0.72 + t * 0.2 + midrib + (leaf % 3) * 0.025;
        colors.push(shade * 0.76, shade, shade * 0.67);
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'broad-waxy-lanceolate-understory-rosette';
  geometry.userData.leafCount = leafCount;
  geometry.userData.surface = 'curved-midrib-and-gravity-settle';
  return geometry;
}

function createLeafClusterTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const random = seededRandom(7613);
  const leaves = Array.from({ length: 15 }, (_, index) => ({
    x: -0.68 + random() * 1.36,
    y: -0.62 + random() * 1.24,
    radiusX: 0.12 + random() * 0.16,
    radiusY: 0.075 + random() * 0.1,
    angle: random() * Math.PI + (index % 2 ? 0.32 : -0.22),
    shade: 0.76 + random() * 0.22,
  }));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      let coverage = 0;
      let shade = 0;
      for (const leaf of leaves) {
        const cosine = Math.cos(leaf.angle);
        const sine = Math.sin(leaf.angle);
        const dx = u - leaf.x;
        const dy = v - leaf.y;
        const localX = (dx * cosine + dy * sine) / leaf.radiusX;
        const localY = (-dx * sine + dy * cosine) / leaf.radiusY;
        const distance = localX * localX + localY * localY;
        const leafCoverage = 1 - THREE.MathUtils.smoothstep(distance, 0.76, 1.12);
        if (leafCoverage > coverage) {
          coverage = leafCoverage;
          const midrib = Math.exp(-Math.abs(localY) * 13) * 0.12;
          shade = leaf.shade + midrib;
        }
      }
      const twigDistance = Math.abs(v * 0.52 - u * 0.15 + 0.06);
      const twigCoverage = twigDistance < 0.028 && Math.abs(u) < 0.72 ? 0.92 : 0;
      if (twigCoverage > coverage) {
        coverage = twigCoverage;
        shade = 0.68;
      }
      const offset = (y * size + x) * 4;
      const fineBreak = (Math.sin(x * 1.73 + y * 0.91) * 0.5 + 0.5) * 0.055;
      const value = THREE.MathUtils.clamp(shade - fineBreak, 0, 1);
      data[offset] = Math.round(value * 0.88 * 255);
      data[offset + 1] = Math.round(value * 255);
      data[offset + 2] = Math.round(value * 0.78 * 255);
      data[offset + 3] = Math.round(coverage * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.leaf-cluster-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.family = 'elliptic-waxy';
  texture.userData.source = 'deterministic-original-code-authored-atlas';
  texture.userData.attachment = 'twig-centred-leaf-spray';
  texture.needsUpdate = true;
  return texture;
}

function createCompoundLeafClusterTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const leaflets = [];
  for (let index = 1; index < 10; index += 1) {
    const t = index / 10;
    const spineX = -0.76 + t * 1.5;
    const spineY = -0.13 + Math.sin(t * Math.PI) * 0.18 + (t - 0.5) * 0.16;
    for (const side of [-1, 1]) {
      leaflets.push({
        x: spineX - side * 0.015,
        y: spineY + side * (0.17 + Math.sin(t * Math.PI) * 0.07),
        radiusX: 0.125 + Math.sin(t * Math.PI) * 0.045,
        radiusY: 0.047 + Math.sin(t * Math.PI) * 0.018,
        angle: side * (0.86 - t * 0.24) + 0.08,
        shade: 0.75 + t * 0.16 + (index % 3) * 0.018,
      });
    }
  }
  // A terminal leaflet continues the rachis rather than forming an arbitrary
  // detached oval at the atlas edge.
  leaflets.push({
    x: 0.72,
    y: 0.1,
    radiusX: 0.16,
    radiusY: 0.052,
    angle: 0.18,
    shade: 0.92,
  });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      let coverage = 0;
      let shade = 0;
      for (const leaflet of leaflets) {
        const cosine = Math.cos(leaflet.angle);
        const sine = Math.sin(leaflet.angle);
        const dx = u - leaflet.x;
        const dy = v - leaflet.y;
        const localX = (dx * cosine + dy * sine) / leaflet.radiusX;
        const localY = (-dx * sine + dy * cosine) / leaflet.radiusY;
        const distance = localX * localX + localY * localY;
        const leafletCoverage = 1 - THREE.MathUtils.smoothstep(distance, 0.72, 1.12);
        if (leafletCoverage > coverage) {
          coverage = leafletCoverage;
          const midrib = Math.exp(-Math.abs(localY) * 16) * 0.1;
          shade = leaflet.shade + midrib;
        }
      }
      const t = THREE.MathUtils.clamp((u + 0.78) / 1.56, 0, 1);
      const spineY = -0.13 + Math.sin(t * Math.PI) * 0.18 + (t - 0.5) * 0.16;
      const twigCoverage = Math.abs(v - spineY) < 0.024 && u > -0.82 && u < 0.82 ? 0.94 : 0;
      if (twigCoverage > coverage) {
        coverage = twigCoverage;
        shade = 0.64;
      }
      const offset = (y * size + x) * 4;
      const veinBreak = (Math.sin(x * 1.27 - y * 0.83) * 0.5 + 0.5) * 0.04;
      const value = THREE.MathUtils.clamp(shade - veinBreak, 0, 1);
      data[offset] = Math.round(value * 0.78 * 255);
      data[offset + 1] = Math.round(value * 255);
      data[offset + 2] = Math.round(value * 0.7 * 255);
      data[offset + 3] = Math.round(coverage * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.compound-lanceolate-leaf-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.userData.family = 'compound-lanceolate';
  texture.userData.source = 'deterministic-original-code-authored-atlas';
  texture.userData.attachment = 'continuous-rachis-with-attached-leaflets';
  texture.needsUpdate = true;
  return texture;
}

function createClosedLeafBladeGeometry(length, width, thickness = 0.028, camber = 0.045) {
  const outline = [
    [0, 0],
    [length * 0.17, width * 0.28],
    [length * 0.46, width * 0.5],
    [length * 0.76, width * 0.34],
    [length, 0],
    [length * 0.76, -width * 0.34],
    [length * 0.46, -width * 0.5],
    [length * 0.17, -width * 0.28],
  ];
  const vertices = [length * 0.48, thickness * 0.5 + camber, 0];
  outline.forEach(([x, z]) => vertices.push(x, thickness * 0.5, z));
  const bottomCentre = vertices.length / 3;
  vertices.push(length * 0.48, -thickness * 0.5, 0);
  outline.forEach(([x, z]) => vertices.push(x, -thickness * 0.5, z));
  const indices = [];
  const outlineCount = outline.length;
  for (let index = 0; index < outlineCount; index += 1) {
    const next = (index + 1) % outlineCount;
    const top = 1 + index;
    const topNext = 1 + next;
    const bottom = bottomCentre + 1 + index;
    const bottomNext = bottomCentre + 1 + next;
    indices.push(0, top, topNext);
    indices.push(bottomCentre, bottomNext, bottom);
    indices.push(top, bottom, topNext, topNext, bottom, bottomNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createVolumetricLeafSprayGeometry() {
  const parts = [
    createCylinderBetween([-1.02, 0, 0], [1.08, 0.055, 0], 0.035, 0.016, 6),
    createCylinderBetween([-0.22, 0.012, 0], [0.58, 0.16, 0.62], 0.026, 0.011, 6),
  ];
  const leafSpecs = [];
  [-0.78, -0.42, -0.05, 0.32, 0.67].forEach((x, index) => {
    [-1, 1].forEach((side) => {
      leafSpecs.push({
        base: [x, 0.025 + index * 0.006, 0],
        direction: [0.2 + index * 0.035, 0.08 + (index % 2) * 0.045, side],
        length: 0.58 + (index % 3) * 0.07,
        width: 0.5 + (index % 2) * 0.06,
        // Alternating petiole torsion prevents an impossible perfectly planar
        // roof. Edge leaves roll and droop more than the protected inner pair.
        roll: side * (0.32 + index * 0.095),
      });
    });
  });
  leafSpecs.push(
    {
      base: [1.02, 0.052, 0], direction: [1, 0.12, 0.08],
      length: 0.74, width: 0.56, roll: -0.28,
    },
    {
      base: [0.23, 0.095, 0.35], direction: [-0.18, 0.08, 1],
      length: 0.56, width: 0.46, roll: 0.46,
    },
    {
      base: [0.52, 0.148, 0.58], direction: [0.56, 0.13, 0.82],
      length: 0.62, width: 0.48, roll: -0.38,
    },
  );
  const sourceAxis = new THREE.Vector3(1, 0, 0);
  leafSpecs.forEach(({ base, direction, length, width, roll }) => {
    const basePoint = new THREE.Vector3(...base);
    const leafDirection = new THREE.Vector3(...direction).normalize();
    const petioleEnd = basePoint.clone().addScaledVector(leafDirection, 0.12);
    parts.push(createCylinderBetween(
      basePoint.toArray(),
      petioleEnd.toArray(),
      0.012,
      0.006,
      5,
    ));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(sourceAxis, leafDirection);
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(sourceAxis, roll));
    const blade = createClosedLeafBladeGeometry(length, width);
    blade.applyMatrix4(new THREE.Matrix4().compose(
      petioleEnd,
      quaternion,
      new THREE.Vector3(1, 1, 1),
    ));
    parts.push(blade);
  });
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const surfaceVariation = Math.sin(x * 5.7 - z * 4.3 + y * 8.1) * 0.045;
    const shade = THREE.MathUtils.clamp(0.9 + surfaceVariation, 0.83, 0.97);
    colors.push(shade * 0.76, shade, shade * 0.7);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = 'branch-supported-volumetric-leaf-spray';
  geometry.userData.leafCount = leafSpecs.length;
  geometry.userData.cardCount = 0;
  geometry.userData.closedSurface = true;
  geometry.userData.supportModel = 'bough-to-rachis-to-petiole-to-leaf-blade';
  geometry.userData.energyModel = 'finite-thickness-leaf-with-aggregate-crown-shadow-proxy';
  return geometry;
}

function createSupportedCanopyLeafGeometry(family = 'elliptic-waxy') {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const cardsPerAnchor = 2;
  CANOPY_LEAF_ANCHORS.forEach((anchor, anchorIndex) => {
    const radialYaw = Math.atan2(anchor[0], anchor[2]);
    for (let cardIndex = 0; cardIndex < cardsPerAnchor; cardIndex += 1) {
      const base = vertices.length / 3;
      const width = family === 'compound-lanceolate'
        ? 1.05 + (anchorIndex % 3) * 0.09
        : 0.9 + (anchorIndex % 3) * 0.08;
      const height = family === 'compound-lanceolate'
        ? 0.46 + (anchorIndex % 2) * 0.045
        : 0.56 + (anchorIndex % 2) * 0.055;
      const yaw = radialYaw + cardIndex * (Math.PI / cardsPerAnchor) + anchorIndex * 0.17;
      const pitch = -0.12 + ((anchorIndex + cardIndex) % 3) * 0.12;
      const roll = (cardIndex - (cardsPerAnchor - 1) * 0.5) * 0.13;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll));
      // The card centre sits at the terminal secondary-branch point. The atlas
      // itself contains the continuing twig/rachis, so every visible spray has
      // an explicit load path into wood instead of hovering around crown centre.
      const centre = new THREE.Vector3(...anchor).add(new THREE.Vector3(
        Math.cos(radialYaw) * 0.12,
        0.04 + cardIndex * 0.035,
        Math.sin(radialYaw) * 0.12,
      ));
      const corners = [
        new THREE.Vector3(-width * 0.5, -height * 0.5, 0),
        new THREE.Vector3(width * 0.5, -height * 0.5, 0),
        new THREE.Vector3(width * 0.5, height * 0.5, 0),
        new THREE.Vector3(-width * 0.5, height * 0.5, 0),
      ];
      corners.forEach((corner) => {
        corner.applyQuaternion(rotation).add(centre);
        vertices.push(corner.x, corner.y, corner.z);
      });
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const familyTint = family === 'compound-lanceolate'
    ? [0.8, 0.96, 0.68]
    : [0.74, 1, 0.72];
  const colors = [];
  for (let index = 0; index < vertices.length / 3; index += 1) {
    const shade = 0.9 + (index % 4) * 0.025;
    colors.push(
      familyTint[0] * shade,
      familyTint[1] * shade,
      familyTint[2] * shade,
    );
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = `branch-tip-supported-${family}-leaf-sprays`;
  geometry.userData.family = family;
  geometry.userData.cardCount = CANOPY_LEAF_ANCHORS.length * cardsPerAnchor;
  geometry.userData.anchorCount = CANOPY_LEAF_ANCHORS.length;
  geometry.userData.anchorPositions = CANOPY_LEAF_ANCHORS.map((anchor) => [...anchor]);
  geometry.userData.supportModel = 'secondary-branch-tip-to-visible-rachis';
  return geometry;
}

function createBarkDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const random = seededRandom(8941);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const verticalFurrow = Math.abs(Math.sin(x * 0.31 + Math.sin(y * 0.045) * 1.9));
      const brokenPlate = Math.sin(y * 0.23 + x * 0.07) * 0.12
        + Math.sin(y * 0.067 - x * 0.16) * 0.07;
      const fissure = verticalFurrow > 0.94 ? -0.28 : 0;
      const value = THREE.MathUtils.clamp(
        0.68 + verticalFurrow * 0.15 + brokenPlate + fissure + (random() - 0.5) * 0.06,
        0.26,
        0.94,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * 0.78 * 255);
      albedoData[offset + 1] = Math.round(value * 0.69 * 255);
      albedoData[offset + 2] = Math.round(value * 0.52 * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.82 + (1 - value) * 0.17, 0.78, 0.99);
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(value * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 6.5);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.userData.family = 'wet-furrowed-buttress';
    texture.userData.source = 'deterministic-original-code-authored-tile';
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.bark-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.bark-roughness', roughnessData),
    height: makeTexture('world.material.bark-height', heightData),
  });
}

function createPlateBarkDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const random = seededRandom(8963);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const row = Math.floor(v * 9);
      const staggeredU = (u + (row % 2) * 0.12 + Math.sin(v * Math.PI * 2) * 0.018) % 1;
      const verticalCell = Math.abs((staggeredU * 5) % 1 - 0.5) * 2;
      const horizontalCell = Math.abs((v * 9) % 1 - 0.5) * 2;
      const edgeDistance = Math.min(verticalCell, horizontalCell);
      const fissure = edgeDistance > 0.88 ? -0.26 : 0;
      const fibrousLift = Math.sin((u * 7 + v * 1.8) * Math.PI * 2) * 0.07
        + Math.sin((u * 3 - v * 4.4) * Math.PI * 2) * 0.035;
      const value = THREE.MathUtils.clamp(
        0.67 + fibrousLift + fissure + (random() - 0.5) * 0.045,
        0.25,
        0.9,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * 0.82 * 255);
      albedoData[offset + 1] = Math.round(value * 0.61 * 255);
      albedoData[offset + 2] = Math.round(value * 0.43 * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.86 + (1 - value) * 0.12, 0.82, 0.99);
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(value * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.2, 5.8);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.userData.family = 'plate-barked-fibrous';
    texture.userData.source = 'deterministic-original-code-authored-tile';
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture(
      'world.material.plate-bark-albedo',
      albedoData,
      THREE.SRGBColorSpace,
    ),
    roughness: makeTexture('world.material.plate-bark-roughness', roughnessData),
    height: makeTexture('world.material.plate-bark-height', heightData),
  });
}

export const CANOPY_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.085,
  verticalTipDisplacementMeters: 0.018,
  macroFrequencyHz: 0.82,
  flutterFrequencyHz: 2.3,
  anchorUvY: Object.freeze([0.04, 0.92]),
  supportModel: 'branch-attached-uv-base-with-flexible-leaf-tip',
  shadowModel: 'shared-displacement-uniforms-for-colour-and-depth-pass',
});

function injectLeafWindVertex(shader, uniforms) {
  shader.uniforms.leafWindTime = uniforms.time;
  shader.uniforms.leafWindStrength = uniforms.strength;
  shader.uniforms.leafWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      uniform float leafWindTime;
      uniform float leafWindStrength;
      uniform float leafWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float leafWindAnchor = 0.0;
      #ifdef USE_UV
        leafWindAnchor = smoothstep(
          ${CANOPY_WIND_PROFILE.anchorUvY[0].toFixed(2)},
          ${CANOPY_WIND_PROFILE.anchorUvY[1].toFixed(2)},
          uv.y
        );
      #endif
      vec4 leafWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 leafWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        leafWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        leafWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 leafWindWorldDirection = normalize(vec3(
        ${CANOPY_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 leafWindLocalDirection = normalize(vec3(
        dot(leafWindBasis[0], leafWindWorldDirection),
        dot(leafWindBasis[1], leafWindWorldDirection),
        dot(leafWindBasis[2], leafWindWorldDirection)
      ));
      float leafWindMacro = sin(
        leafWindTime * ${CANOPY_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(leafWindWorldPoint.xz, vec2(0.071, 0.053))
      );
      float leafWindFlutter = sin(
        leafWindTime * ${CANOPY_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(leafWindWorldPoint.xz, vec2(-0.117, 0.089))
      );
      float leafWindResponse = leafWindAnchor * (leafWindMacro * 0.72 + leafWindFlutter * 0.28);
      transformed += leafWindLocalDirection * leafWindResponse * leafWindStrength;
      transformed.y += leafWindAnchor * leafWindFlutter * leafWindVerticalStrength;
    `);
}

function applyThinLeafTransmission(material, family, wind = false) {
  const windUniforms = wind ? Object.freeze({
    time: { value: 0 },
    strength: { value: CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: CANOPY_WIND_PROFILE.verticalTipDisplacementMeters },
  }) : null;
  material.onBeforeCompile = (shader) => {
    if (windUniforms) injectLeafWindVertex(shader, windUniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  // geometryNormal already follows the rendered face for DoubleSide
  // materials. Multiplying by faceDirection again would invert the back-face
  // normal twice and suppress the physically correct opposite-side lobe.
  vec3 leafSurfaceNormal = normalize( geometryNormal );
  vec3 leafSunDirection = normalize( directionalLights[ 0 ].direction );
  float leafLightSide = dot( leafSurfaceNormal, leafSunDirection );
  float leafViewSide = dot( leafSurfaceNormal, geometryViewDir );
  float leafOppositeSides = saturate( - leafLightSide * leafViewSide );
  float leafIncidence = max( abs( leafLightSide ), 0.22 );
  vec3 leafAbsorption = vec3( 1.65, 0.62, 2.15 );
  vec3 leafTransmittance = exp( - leafAbsorption * 0.55 / leafIncidence );
  float leafShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow leafTransmissionShadow = directionalLightShadows[ 0 ];
    leafShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      leafTransmissionShadow.shadowMapSize,
      leafTransmissionShadow.shadowIntensity,
      leafTransmissionShadow.shadowBias,
      leafTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * leafTransmittance
    * pow( leafOppositeSides, 0.42 )
    * leafShadowVisibility
    * RECIPROCAL_PI
    * 0.62;
#endif`,
    );
  };
  material.customProgramCacheKey = () => (
    `thin-leaf-beer-lambert-v3-${family}-${wind ? 'anchored-wind' : 'static'}`
  );
  material.userData.energyModel = 'shadow-aware-beer-lambert-thin-leaf-transmission';
  material.userData.transmissionModel = Object.freeze({
    thicknessScale: 0.55,
    absorption: [1.65, 0.62, 2.15],
    directionalShadow: true,
    emissive: false,
  });
  if (windUniforms) {
    material.userData.windModel = CANOPY_WIND_PROFILE;
    material.userData.windUniforms = windUniforms;
  }
  return material;
}

function createLeafWindDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    alphaTest: sourceMaterial.alphaTest,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  material.onBeforeCompile = (shader) => injectLeafWindVertex(shader, uniforms);
  material.customProgramCacheKey = () => (
    `leaf-wind-depth-v1-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  material.userData.shadowModel = CANOPY_WIND_PROFILE.shadowModel;
  return material;
}

function addCylindricalUvs(geometry, heightScale) {
  const positions = geometry.getAttribute('position');
  const uvs = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    uvs.push(Math.atan2(z, x) / (Math.PI * 2) + 0.5, y / heightScale);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

function createFernGeometry({
  frondCount = 8,
  frondSegments = 6,
  lengthScale = 1,
  liftScale = 1,
  angleOffset = 0,
  centralShoots = 3,
  variant = 'rosette',
} = {}) {
  const vertices = [];
  for (let index = 0; index < frondCount; index += 1) {
    const angle = (index / frondCount) * Math.PI * 2 + angleOffset + Math.sin(index * 1.73) * 0.045;
    const length = (0.92 + (index % 3) * 0.15) * lengthScale;
    const lift = (0.46 + (index % 4) * 0.08) * liftScale;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const leftEdge = [];
    const rightEdge = [];
    const centres = [];
    for (let segment = 0; segment <= frondSegments; segment += 1) {
      const t = segment / frondSegments;
      const centre = direction.clone().multiplyScalar(length * t);
      centre.y = 0.04 + Math.sin(t * Math.PI) * lift + t * 0.04;
      const width = (0.045 + Math.sin(t * Math.PI) * 0.1) * (1 - t * 0.36);
      centres.push(centre);
      leftEdge.push(centre.clone().addScaledVector(tangent, width));
      rightEdge.push(centre.clone().addScaledVector(tangent, -width));
    }
    for (let segment = 0; segment < frondSegments; segment += 1) {
      const a = leftEdge[segment];
      const b = rightEdge[segment];
      const c = leftEdge[segment + 1];
      const d = rightEdge[segment + 1];
      for (const point of [a, c, b, b, c, d]) vertices.push(...point);
    }
    for (let segment = 1; segment < frondSegments; segment += 1) {
      const t = segment / frondSegments;
      const leafletLength = (0.24 + Math.sin(t * Math.PI) * 0.12) * (1 - t * 0.28);
      const forward = direction.clone().multiplyScalar(0.12);
      const leftTip = centres[segment].clone().addScaledVector(tangent, leafletLength).add(forward);
      const rightTip = centres[segment].clone().addScaledVector(tangent, -leafletLength).add(forward);
      const nextCentre = centres[Math.min(frondSegments, segment + 1)];
      for (const point of [centres[segment], leftTip, nextCentre, centres[segment], nextCentre, rightTip]) {
        vertices.push(...point);
      }
    }
  }
  for (let index = 0; index < centralShoots; index += 1) {
    const angle = (index / centralShoots) * Math.PI * 2 + 0.45 + angleOffset;
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const base = new THREE.Vector3(0, 0.04, 0);
    const left = tangent.clone().multiplyScalar(0.11).add(new THREE.Vector3(0, 0.58, 0));
    const right = tangent.clone().multiplyScalar(-0.11).add(new THREE.Vector3(0, 0.58, 0));
    const tip = new THREE.Vector3(Math.cos(angle) * 0.18, 1.12, Math.sin(angle) * 0.18);
    for (const point of [base, left, tip, base, tip, right]) vertices.push(...point);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const ribBreak = Math.sin(x * 8.7 - z * 6.2 + y * 5.1) * 0.08;
    const heightBreak = THREE.MathUtils.clamp(y * 0.12, 0, 0.1);
    const shade = THREE.MathUtils.clamp(0.82 + ribBreak + heightBreak, 0.65, 1);
    colors.push(shade * 0.84, shade, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  addCylindricalUvs(geometry, 2.9);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.frondSegments = frondSegments;
  geometry.userData.variant = variant;
  geometry.userData.surface = 'ribbed-frond-color-break';
  return geometry;
}

function createAraucariaGeometry() {
  const parts = [];
  const tiers = [
    [1.48, 0.62],
    [1.22, 1.12],
    [0.98, 1.6],
    [0.72, 2.02],
  ];
  tiers.forEach(([radius, y], tierIndex) => {
    const branchCount = 6;
    for (let branch = 0; branch < branchCount; branch += 1) {
      const angle = (branch / branchCount) * Math.PI * 2 + tierIndex * 0.38;
      parts.push(transformGeometry(
        new THREE.IcosahedronGeometry(1, 1),
        [Math.cos(angle) * radius * 0.52, y, Math.sin(angle) * radius * 0.52],
        [radius * 0.62, 0.16 + tierIndex * 0.015, 0.28],
        [0, -angle, (branch % 2 - 0.5) * 0.08],
      ));
    }
  });
  parts.push(transformGeometry(new THREE.IcosahedronGeometry(1, 1), [0, 2.36, 0], [0.42, 0.48, 0.42]));
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const shade = THREE.MathUtils.clamp(
      0.8 + Math.sin(positions.getY(index) * 5.2 + positions.getX(index) * 4.1) * 0.12,
      0.64,
      1,
    );
    colors.push(shade * 0.84, shade, shade * 0.74);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.profile = 'whorled-araucaria-branches';
  geometry.userData.surface = 'tiered-needle-plane-variation';
  return geometry;
}

function createTreeFernTrunkGeometry() {
  const parts = [createVerticalLoft([
      [0, 0, 0, 0.34, 0.32],
      [0.42, 0.02, -0.02, 0.31, 0.29, 0.08],
      [1.18, -0.025, 0.025, 0.285, 0.27, -0.06],
      [2.05, 0.035, -0.03, 0.25, 0.235, 0.1],
      [2.72, 0.055, 0.02, 0.21, 0.2, -0.04],
    ], 10)];
  [0.25, 1.82, 3.34, 4.96].forEach((angle, index) => {
    parts.push(createCylinderBetween(
      [Math.cos(angle) * 0.12, 0.18, Math.sin(angle) * 0.12],
      [Math.cos(angle) * (0.58 + (index % 2) * 0.16), 0.03, Math.sin(angle) * (0.58 + (index % 2) * 0.16)],
      0.19,
      0.045,
      5,
    ));
  });
  const geometry = mergeParts(parts);
  const positions = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const x = positions.getX(index);
    const ringBreak = Math.sin(y * 15.4 + x * 4.1) * 0.11;
    const shade = THREE.MathUtils.clamp(0.76 + ringBreak, 0.58, 0.9);
    colors.push(shade, shade * 0.92, shade * 0.72);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'ring-scarred-tree-fern-trunk';
  geometry.userData.surface = 'alternating-leaf-scar-bands-with-buttress-roots';
  return geometry;
}

function createFracturedBasaltGeometry(radialSegments = 6) {
  const rings = [
    [-0.5, 1.04, 0, 0, 0.8],
    [-0.34, 1.015, 0.018, -0.012, 0.84],
    [-0.19, 1.035, 0.026, -0.018, 0.88],
    [-0.04, 1.0, 0.008, 0.014, 0.83],
    [0.11, 1.025, -0.016, 0.024, 0.89],
    [0.25, 0.99, -0.022, 0.006, 0.82],
    [0.38, 0.975, 0.012, -0.014, 0.87],
    [0.5, 0.94, 0, 0, 0.78],
  ];
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  rings.forEach(([y, radius, offsetX, offsetZ, shade], ringIndex) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + 0.08;
      const jaggedTop = ringIndex === rings.length - 1
        ? [0.035, -0.02, 0.055, -0.035, 0.015, -0.012][side]
        : 0;
      vertices.push(
        offsetX + Math.cos(angle) * radius,
        y + jaggedTop,
        offsetZ + Math.sin(angle) * radius,
      );
      colors.push(shade, shade, shade);
      uvs.push(side / radialSegments, ringIndex / (rings.length - 1));
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottomCentre = vertices.length / 3;
  vertices.push(0, -0.5, 0);
  colors.push(0.78, 0.78, 0.78);
  uvs.push(0.5, 0.5);
  const topCentre = vertices.length / 3;
  vertices.push(0, 0.51, 0);
  colors.push(0.88, 0.88, 0.88);
  uvs.push(0.5, 0.5);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.fractureRings = rings.length;
  geometry.userData.irregularTop = true;
  geometry.userData.profile = 'subtly-tapered-polygonal-cooling-column';
  geometry.userData.crossSection = 'hexagonal-joint-cell';
  return geometry;
}

function createSoilDetailTextures() {
  const size = 256;
  const heights = new Float32Array(size * size);
  const aggregateChips = new Float32Array(size * size);
  const organicFibres = new Float32Array(size * size);
  const poreCavities = new Float32Array(size * size);
  const makeGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const wrap = (value, cells) => ((value % cells) + cells) % cells;
  const tileNoise = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const x0 = wrap(floorX, cells);
    const y0 = wrap(floorY, cells);
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = THREE.MathUtils.smoothstep(x - floorX, 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - floorY, 0, 1);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  const hashCell = (x, y, salt) => {
    let value = Math.imul(x + salt * 17, 374761393)
      + Math.imul(y - salt * 11, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  const cellularDistance = (u, v, cells, salt) => {
    const px = u * cells;
    const py = v * cells;
    const baseX = Math.floor(px);
    const baseY = Math.floor(py);
    let nearest = Infinity;
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const cellX = baseX + offsetX;
        const cellY = baseY + offsetY;
        const wrappedX = ((cellX % cells) + cells) % cells;
        const wrappedY = ((cellY % cells) + cells) % cells;
        const pointX = cellX + 0.18 + hashCell(wrappedX, wrappedY, salt) * 0.64;
        const pointY = cellY + 0.18 + hashCell(wrappedX, wrappedY, salt + 19) * 0.64;
        nearest = Math.min(nearest, Math.hypot(px - pointX, py - pointY));
      }
    }
    return nearest;
  };
  const sparseCellularFeature = (
    u,
    v,
    cells,
    salt,
    density,
    minimumRadius,
    maximumRadius,
  ) => {
    const px = u * cells;
    const py = v * cells;
    const baseX = Math.floor(px);
    const baseY = Math.floor(py);
    let feature = 0;
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
        const cellX = baseX + offsetX;
        const cellY = baseY + offsetY;
        const wrappedX = wrap(cellX, cells);
        const wrappedY = wrap(cellY, cells);
        if (hashCell(wrappedX, wrappedY, salt + 43) > density) continue;
        const pointX = cellX + 0.12 + hashCell(wrappedX, wrappedY, salt) * 0.76;
        const pointY = cellY + 0.12 + hashCell(wrappedX, wrappedY, salt + 19) * 0.76;
        const radius = THREE.MathUtils.lerp(
          minimumRadius,
          maximumRadius,
          hashCell(wrappedX, wrappedY, salt + 71),
        );
        const distance = Math.hypot(px - pointX, py - pointY);
        feature = Math.max(
          feature,
          1 - THREE.MathUtils.smoothstep(distance, radius * 0.38, radius),
        );
      }
    }
    return feature;
  };
  const broadGrid = makeGrid(7, 621);
  const mesoGrid = makeGrid(23, 631);
  const grainGrid = makeGrid(61, 641);
  const moistureGrid = makeGrid(13, 647);
  const mineralGrid = makeGrid(31, 653);
  const organicGrid = makeGrid(37, 677);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = tileNoise(broadGrid, 7, u, v);
      const meso = tileNoise(mesoGrid, 23, u + (broad - 0.5) * 0.04, v - (broad - 0.5) * 0.035);
      const grain = tileNoise(grainGrid, 61, u - (meso - 0.5) * 0.015, v + (meso - 0.5) * 0.012);
      const aggregateDistance = cellularDistance(u, v, 31, 659);
      const aggregateChip = 1 - THREE.MathUtils.smoothstep(aggregateDistance, 0.1, 0.29);
      const sparseAggregateChip = sparseCellularFeature(
        u,
        v,
        31,
        727,
        0.24,
        0.09,
        0.28,
      );
      const organicCarrier = tileNoise(
        organicGrid,
        37,
        u + (meso - 0.5) * 0.012,
        v - (grain - 0.5) * 0.01,
      );
      const fibreWaveA = Math.abs(Math.sin((u * 11 + v * 7) * Math.PI * 2));
      const fibreWaveB = Math.abs(Math.sin((u * 5 - v * 17) * Math.PI * 2));
      const fibreLine = Math.max(
        1 - THREE.MathUtils.smoothstep(fibreWaveA, 0.025, 0.13),
        (1 - THREE.MathUtils.smoothstep(fibreWaveB, 0.02, 0.11)) * 0.78,
      );
      const organicFibre = fibreLine * THREE.MathUtils.smoothstep(
        organicCarrier,
        0.57,
        0.84,
      );
      const poreCavity = sparseCellularFeature(
        u + 0.173,
        v - 0.219,
        47,
        761,
        0.16,
        0.05,
        0.16,
      );
      aggregateChips[y * size + x] = sparseAggregateChip;
      organicFibres[y * size + x] = organicFibre;
      poreCavities[y * size + x] = poreCavity;
      heights[y * size + x] = THREE.MathUtils.clamp(
        0.5 + (broad - 0.5) * 0.28 + (meso - 0.5) * 0.17
          + (grain - 0.5) * 0.065 + aggregateChip * 0.035,
        0.24,
        0.76,
      );
    }
  }

  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const offset = index * 4;
      const height = heights[index];
      const u = x / size;
      const v = y / size;
      const moisture = tileNoise(moistureGrid, 13, u + 0.19, v - 0.13);
      const mineral = tileNoise(mineralGrid, 31, u - 0.07, v + 0.23);
      const aggregateChip = aggregateChips[index];
      albedoData[offset] = Math.round(THREE.MathUtils.clamp(
        151 + height * 19 + mineral * 11 + aggregateChip * 14,
        0,
        255,
      ));
      albedoData[offset + 1] = Math.round(THREE.MathUtils.clamp(
        145 + height * 17 + moisture * 10 + aggregateChip * 8,
        0,
        255,
      ));
      albedoData[offset + 2] = Math.round(THREE.MathUtils.clamp(
        118 + height * 12 + moisture * 7 + aggregateChip * 3,
        0,
        255,
      ));
      albedoData[offset + 3] = Math.round(aggregateChip * 255);

      const roughness = THREE.MathUtils.clamp(
        0.83 + (1 - height) * 0.13 - moisture * 0.04
          + (mineral - 0.5) * 0.035 - aggregateChip * 0.035,
        0.74,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([
        roughnessByte,
        roughnessByte,
        roughnessByte,
        Math.round(organicFibres[index] * 255),
      ], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([
        heightByte,
        heightByte,
        heightByte,
        Math.round(poreCavities[index] * 255),
      ], offset);
    }
  }

  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 10);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    texture.userData.generation = 'tileable-multiscale-sparse-inclusion-v3';
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.soil-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.soil-roughness', roughnessData),
    height: makeTexture('world.material.soil-macro-detail', heightData),
  });
}

function createTerrainMacroControlTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const makeGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const broadGrid = makeGrid(7, 661);
  const mineralGrid = makeGrid(17, 673);
  const gritGrid = makeGrid(41, 691);
  const sample = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x) % cells;
    const y0 = Math.floor(y) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = THREE.MathUtils.smoothstep(x - Math.floor(x), 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - Math.floor(y), 0, 1);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = sample(broadGrid, 7, u, v);
      const mineral = sample(mineralGrid, 17, u + broad * 0.08, v - broad * 0.06);
      const grit = sample(gritGrid, 41, u - mineral * 0.035, v + mineral * 0.025);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(broad * 255);
      data[offset + 1] = Math.round(mineral * 255);
      data[offset + 2] = Math.round(grit * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'world.material.terrain-macro-control';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createWaterDetailTextures() {
  const size = 128;
  const heights = new Float32Array(size * size);
  const random = seededRandom(733);
  const makePeriodicGrid = (cells) => Array.from(
    { length: cells * cells },
    () => random(),
  );
  const broadGrid = makePeriodicGrid(9);
  const mediumGrid = makePeriodicGrid(23);
  const fineGrid = makePeriodicGrid(47);
  const samplePeriodicGrid = (grid, cells, u, v) => {
    const wrappedU = ((u % 1) + 1) % 1;
    const wrappedV = ((v % 1) + 1) % 1;
    const gx = wrappedU * cells;
    const gy = wrappedV * cells;
    const x0 = Math.floor(gx) % cells;
    const y0 = Math.floor(gy) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const txRaw = gx - Math.floor(gx);
    const tyRaw = gy - Math.floor(gy);
    const tx = txRaw * txRaw * (3 - 2 * txRaw);
    const ty = tyRaw * tyRaw * (3 - 2 * tyRaw);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = samplePeriodicGrid(broadGrid, 9, u, v);
      const medium = samplePeriodicGrid(
        mediumGrid,
        23,
        u + (broad - 0.5) * 0.075,
        v - (broad - 0.5) * 0.11,
      );
      const fine = samplePeriodicGrid(
        fineGrid,
        47,
        u - (medium - 0.5) * 0.035,
        v + (broad - 0.5) * 0.045,
      );
      const flowRidge = 0.5 + Math.sin(
        Math.PI * 2 * (v * 5 + u * 0.65 + (broad - 0.5) * 1.7),
      ) * 0.5;
      const value = THREE.MathUtils.clamp(
        0.22 + broad * 0.46 + medium * 0.23 + fine * 0.08 + flowRidge * 0.025,
        0.18,
        0.82,
      );
      heights[y * size + x] = value;
    }
  }
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const sample = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const height = heights[y * size + x];
      const deepBand = 0.5 + Math.sin(y * 0.052 + x * 0.071) * 0.15;
      albedoData[offset] = Math.round(54 + height * 10 + deepBand * 5);
      albedoData[offset + 1] = Math.round(92 + height * 13 + deepBand * 7);
      albedoData[offset + 2] = Math.round(94 + height * 14 + deepBand * 8);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(0.34 + (1 - height) * 0.26, 0.32, 0.62);
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * 1.2;
      const dz = (sample(x, y - 1) - sample(x, y + 1)) * 1.2;
      const normal = new THREE.Vector3(dx, dz, 1).normalize();
      normalData[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
      normalData[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      normalData[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      normalData[offset + 3] = 255;
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 6.5);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.brook-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.brook-roughness', roughnessData),
    normal: makeTexture('world.material.brook-normal', normalData),
  });
}

function createBrookMaterial(textures, bedTextures) {
  const fallbackReflection = new THREE.DataTexture(
    new Uint8Array([112, 142, 145, 255]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  fallbackReflection.name = 'world.material.brook-local-reflection-fallback';
  fallbackReflection.colorSpace = THREE.NoColorSpace;
  fallbackReflection.needsUpdate = true;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      detailMix: { value: 0.72 },
      flowAlbedo: { value: textures.albedo },
      flowRoughness: { value: textures.roughness },
      flowNormal: { value: textures.normal },
      channelBed: { value: bedTextures.albedo },
      shallowColor: { value: new THREE.Color(0x6f978b) },
      deepColor: { value: new THREE.Color(0x285d68) },
      skyColor: { value: new THREE.Color(0x94b3b1) },
      foamColor: { value: new THREE.Color(0xd0d5c5) },
      sunColor: { value: new THREE.Color(0xd9b37d) },
      sunDirection: { value: new THREE.Vector3(-0.44, 0.55, 0.71).normalize() },
      sceneReflectionPanorama: { value: fallbackReflection },
      planarReflection: { value: fallbackReflection },
      planarReflectionMatrix: { value: new THREE.Matrix4() },
      planarReflectionCenter: { value: new THREE.Vector3() },
      planarReflectionTangent: { value: new THREE.Vector3(0, 0, 1) },
      planarReflectionPlaneNormal: { value: new THREE.Vector3(0, 1, 0) },
      planarReflectionHalfExtent: { value: new THREE.Vector2(2.15, 5.6) },
      planarReflectionPlaneTolerance: { value: 0.12 },
      planarReflectionReady: { value: 0 },
      planarReflectionMix: { value: 0.82 },
      sceneRefractionColor: { value: fallbackReflection },
      sceneRefractionDepth: { value: fallbackReflection },
      sceneRefractionReady: { value: 0 },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 600 },
      cameraProjectionMatrix: { value: new THREE.Matrix4() },
      cameraProjectionInverse: { value: new THREE.Matrix4() },
      reflectionPanoramaMix: { value: 0.76 },
      bedTransmissionMix: { value: 0.68 },
      ssrSteps: { value: BROOK_REFLECTION_PROFILE.stepsByQuality.balanced },
      ssrRange: { value: BROOK_REFLECTION_PROFILE.maximumRangeMeters },
      ssrStrength: { value: 0.76 },
      ssrThickness: { value: BROOK_REFLECTION_PROFILE.constantThicknessMeters },
      ssrThicknessSlope: {
        value: BROOK_REFLECTION_PROFILE.depthScaledThicknessPerMeter,
      },
      obstacleCount: {
        value: BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality.balanced,
      },
      obstacleCenterRadiusContact: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
      obstacleFlowWake: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
      obstacleResponse: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexColors: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec4 vRibbonColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec4 vPlanarReflectionCoord;
      varying float vFlowDirection;
      varying float vFlowEnergy;
      varying float vWaterDepthMeters;
      varying float vSurfaceDisplacementMeters;
      uniform mat4 planarReflectionMatrix;
      uniform float time;
      uniform float obstacleCount;
      uniform vec4 obstacleCenterRadiusContact[12];
      uniform vec4 obstacleFlowWake[12];
      uniform vec4 obstacleResponse[12];
      attribute float flowDirection;
      attribute float flowEnergy;
      attribute float waterDepthMeters;

      float sampleObstacleSurfaceDisplacement(vec2 worldPosition) {
        float displacement = 0.0;
        for (int obstacleIndex = 0; obstacleIndex < 12; obstacleIndex += 1) {
          if (float(obstacleIndex) >= obstacleCount) break;
          vec4 centerRadiusContact = obstacleCenterRadiusContact[obstacleIndex];
          if (centerRadiusContact.z <= 0.001 || centerRadiusContact.w <= 0.001) continue;
          vec4 flowWake = obstacleFlowWake[obstacleIndex];
          vec4 response = obstacleResponse[obstacleIndex];
          vec2 flowDirectionVector = normalize(flowWake.xy);
          vec2 lateralDirection = vec2(-flowDirectionVector.y, flowDirectionVector.x);
          vec2 relative = worldPosition - centerRadiusContact.xy;
          float along = dot(relative, flowDirectionVector);
          float across = dot(relative, lateralDirection);
          float radius = centerRadiusContact.z;

          // Stagnation pressure raises the upstream nose while acceleration
          // around the two shoulders lowers the local free surface. Both use
          // the rendered clast radius and the same bounded response as the
          // fragment normal field.
          vec2 compressionFrame = vec2(
            (along + radius * 0.86) / max(radius * 0.72, 0.025),
            across / max(radius * 0.92, 0.025)
          );
          float upstreamCompression = (1.0 - smoothstep(
            0.18,
            1.15,
            length(compressionFrame)
          )) * centerRadiusContact.w;
          float normalizedAcross = abs(across) / max(radius, 0.025);
          float normalizedAlong = abs(along) / max(radius, 0.025);
          float sideSpeedup = smoothstep(0.26, 0.72, normalizedAcross)
            * (1.0 - smoothstep(1.08, 1.9, normalizedAcross))
            * (1.0 - smoothstep(0.36, 1.55, normalizedAlong))
            * centerRadiusContact.w;
          float compressionAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumUpstreamCompressionMeters.toFixed(3)},
            radius * response.y * 1.15
          );
          float sideDrawdownAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumSideDrawdownMeters.toFixed(3)},
            radius * response.y * 0.55
          );
          displacement += upstreamCompression * compressionAmplitude
            - sideSpeedup * sideDrawdownAmplitude;

          // Only the downstream half-plane receives the alternating shed
          // wake. Its expanding lateral envelope and bounded amplitude keep
          // this centimetre-scale creek response distinct from ocean waves.
          float downstream = smoothstep(radius * 0.18, radius * 0.82, along)
            * (1.0 - smoothstep(flowWake.z * 0.7, flowWake.z, along));
          float wakeProgress = clamp(along / max(flowWake.z, 0.001), 0.0, 1.0);
          float wakeWidth = mix(radius * 0.58, flowWake.w, sqrt(wakeProgress));
          float lateralEnvelope = 1.0 - smoothstep(
            wakeWidth * 0.18,
            max(wakeWidth, 0.02),
            abs(across)
          );
          float wakePhase = along / max(radius, 0.07) * 3.65
            - time * (2.25 + centerRadiusContact.w * 1.15)
            + across / max(wakeWidth, 0.02) * 2.4;
          float wakeAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumWakeAmplitudeMeters.toFixed(3)},
            radius * response.y * 0.65
          );
          displacement += sin(wakePhase) * downstream * lateralEnvelope
            * wakeAmplitude * centerRadiusContact.w;
        }
        return clamp(
          displacement,
          -${BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters.toFixed(3)},
          ${BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters.toFixed(3)}
        );
      }

      void main() {
        vUv = uv;
        vRibbonColor = color;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        float surfaceDisplacementMeters = sampleObstacleSurfaceDisplacement(
          worldPosition.xz
        );
        worldPosition.y += surfaceDisplacementMeters;
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vPlanarReflectionCoord = planarReflectionMatrix * worldPosition;
        vFlowDirection = flowDirection;
        vFlowEnergy = flowEnergy;
        vWaterDepthMeters = max(0.0, waterDepthMeters + surfaceDisplacementMeters);
        vSurfaceDisplacementMeters = surfaceDisplacementMeters;
        vec4 mvPosition = viewMatrix * worldPosition;
        vViewPosition = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      #include <packing>
      uniform float time;
      uniform float detailMix;
      uniform sampler2D flowAlbedo;
      uniform sampler2D flowRoughness;
      uniform sampler2D flowNormal;
      uniform sampler2D channelBed;
      uniform vec3 shallowColor;
      uniform vec3 deepColor;
      uniform vec3 skyColor;
      uniform vec3 foamColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      uniform sampler2D sceneReflectionPanorama;
      uniform sampler2D planarReflection;
      uniform vec3 planarReflectionCenter;
      uniform vec3 planarReflectionTangent;
      uniform vec3 planarReflectionPlaneNormal;
      uniform vec2 planarReflectionHalfExtent;
      uniform float planarReflectionPlaneTolerance;
      uniform float planarReflectionReady;
      uniform float planarReflectionMix;
      uniform sampler2D sceneRefractionColor;
      uniform sampler2D sceneRefractionDepth;
      uniform float sceneRefractionReady;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform mat4 cameraProjectionMatrix;
      uniform mat4 cameraProjectionInverse;
      uniform float reflectionPanoramaMix;
      uniform float bedTransmissionMix;
      uniform float ssrSteps;
      uniform float ssrRange;
      uniform float ssrStrength;
      uniform float ssrThickness;
      uniform float ssrThicknessSlope;
      uniform float obstacleCount;
      uniform vec4 obstacleCenterRadiusContact[12];
      uniform vec4 obstacleFlowWake[12];
      uniform vec4 obstacleResponse[12];
      varying vec2 vUv;
      varying vec4 vRibbonColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec4 vPlanarReflectionCoord;
      varying float vFlowDirection;
      varying float vFlowEnergy;
      varying float vWaterDepthMeters;
      varying float vSurfaceDisplacementMeters;

      const float PI = 3.141592653589793;

      mat2 rotateUv(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine);
      }

      vec3 unpackFlowNormal(vec3 encoded) {
        return normalize(encoded * 2.0 - 1.0);
      }

      vec2 equirectangularUv(vec3 direction) {
        vec3 unitDirection = normalize(direction);
        return vec2(
          fract(atan(unitDirection.z, unitDirection.x) / (2.0 * PI) + 0.5),
          clamp(asin(unitDirection.y) / PI + 0.5, 0.002, 0.998)
        );
      }

      vec3 reconstructViewPosition(vec2 screenUv, float depth) {
        vec4 clipPosition = vec4(screenUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 viewPosition = cameraProjectionInverse * clipPosition;
        return viewPosition.xyz / max(viewPosition.w, 0.00001);
      }

      vec2 projectViewPosition(vec3 viewPosition) {
        vec4 clipPosition = cameraProjectionMatrix * vec4(viewPosition, 1.0);
        return clipPosition.xy / max(clipPosition.w, 0.00001) * 0.5 + 0.5;
      }

      float insideViewport(vec2 screenUv) {
        return step(0.002, screenUv.x) * step(screenUv.x, 0.998)
          * step(0.002, screenUv.y) * step(screenUv.y, 0.998);
      }

      vec4 traceScreenSpaceReflection(
        vec3 rayOrigin,
        vec3 rayDirection,
        float aboveSurface
      ) {
        if (ssrSteps < 0.5 || aboveSurface < 0.5 || sceneRefractionReady < 0.5) {
          return vec4(0.0);
        }

        float rayLength = ssrRange;
        if (rayDirection.z > 0.0001) {
          rayLength = min(
            rayLength,
            (-cameraNear * 1.08 - rayOrigin.z) / rayDirection.z
          );
        }
        if (rayLength < 0.08) return vec4(0.0);

        vec3 rayEnd = rayOrigin + rayDirection * rayLength;
        vec4 clipStart = cameraProjectionMatrix * vec4(rayOrigin, 1.0);
        vec4 clipEnd = cameraProjectionMatrix * vec4(rayEnd, 1.0);
        float inverseWStart = 1.0 / max(clipStart.w, 0.00001);
        float inverseWEnd = 1.0 / max(clipEnd.w, 0.00001);
        vec2 projectedStart = clipStart.xy * inverseWStart;
        vec2 projectedEnd = clipEnd.xy * inverseWEnd;
        vec3 perspectiveStart = rayOrigin * inverseWStart;
        vec3 perspectiveEnd = rayEnd * inverseWEnd;
        float previousProgress = 0.0;
        float hitProgress = 0.0;
        float hitThickness = 0.0;
        vec2 hitUv = vec2(0.0);
        float foundHit = 0.0;

        for (int stepIndex = 1; stepIndex <= 20; stepIndex += 1) {
          if (float(stepIndex) > ssrSteps) break;
          float progress = float(stepIndex) / max(ssrSteps, 1.0);
          vec2 projected = mix(projectedStart, projectedEnd, progress);
          vec2 sampleUv = projected * 0.5 + 0.5;
          if (insideViewport(sampleUv) < 0.5) break;

          float sampledDepth = texture2D(sceneRefractionDepth, sampleUv).r;
          if (sampledDepth < 0.999995) {
            float inverseW = mix(inverseWStart, inverseWEnd, progress);
            vec3 rayPosition = mix(
              perspectiveStart,
              perspectiveEnd,
              progress
            ) / max(inverseW, 0.00001);
            vec3 scenePosition = reconstructViewPosition(sampleUv, sampledDepth);
            float thickness = scenePosition.z - rayPosition.z;
            float thicknessWindow = ssrThickness
              + abs(scenePosition.z) * ssrThicknessSlope;
            if (thickness >= 0.0 && thickness <= thicknessWindow) {
              hitProgress = progress;
              hitThickness = thickness;
              hitUv = sampleUv;
              foundHit = 1.0;
              break;
            }
          }
          previousProgress = progress;
        }

        if (foundHit < 0.5) return vec4(0.0);

        // Refine only inside the first accepted depth interval. The opaque
        // capture does not contain the water, so no arbitrary self-hit bias is
        // needed at the ray origin.
        float lowerProgress = previousProgress;
        float upperProgress = hitProgress;
        for (int refineIndex = 0; refineIndex < 3; refineIndex += 1) {
          float progress = (lowerProgress + upperProgress) * 0.5;
          vec2 projected = mix(projectedStart, projectedEnd, progress);
          vec2 sampleUv = projected * 0.5 + 0.5;
          float sampledDepth = texture2D(
            sceneRefractionDepth,
            clamp(sampleUv, vec2(0.002), vec2(0.998))
          ).r;
          float inverseW = mix(inverseWStart, inverseWEnd, progress);
          vec3 rayPosition = mix(
            perspectiveStart,
            perspectiveEnd,
            progress
          ) / max(inverseW, 0.00001);
          vec3 scenePosition = reconstructViewPosition(sampleUv, sampledDepth);
          float thickness = scenePosition.z - rayPosition.z;
          if (sampledDepth < 0.999995 && thickness >= 0.0) {
            upperProgress = progress;
            hitUv = sampleUv;
            hitThickness = thickness;
          } else {
            lowerProgress = progress;
          }
        }

        float edgeDistance = min(
          min(hitUv.x, 1.0 - hitUv.x),
          min(hitUv.y, 1.0 - hitUv.y)
        );
        float edgeConfidence = smoothstep(0.0, 0.075, edgeDistance);
        float refinedDepth = texture2D(sceneRefractionDepth, hitUv).r;
        vec3 refinedScenePosition = reconstructViewPosition(hitUv, refinedDepth);
        float thicknessWindow = ssrThickness
          + abs(refinedScenePosition.z) * ssrThicknessSlope;
        float thicknessConfidence = 1.0 - smoothstep(
          thicknessWindow * 0.45,
          thicknessWindow,
          hitThickness
        );
        vec3 reflectedSceneColor = texture2D(sceneRefractionColor, hitUv).rgb;
        return vec4(
          reflectedSceneColor,
          edgeConfidence * thicknessConfidence * aboveSurface
        );
      }

      void sampleRenderedObstacleFlow(
        vec2 worldPosition,
        out vec2 surfaceSlope,
        out float wakeEnergy,
        out float aeration,
        out float roughnessGain
      ) {
        surfaceSlope = vec2(0.0);
        wakeEnergy = 0.0;
        aeration = 0.0;
        roughnessGain = 0.0;
        for (int obstacleIndex = 0; obstacleIndex < 12; obstacleIndex += 1) {
          if (float(obstacleIndex) >= obstacleCount) break;
          vec4 centerRadiusContact = obstacleCenterRadiusContact[obstacleIndex];
          if (centerRadiusContact.z <= 0.001 || centerRadiusContact.w <= 0.001) continue;
          vec4 flowWake = obstacleFlowWake[obstacleIndex];
          vec4 response = obstacleResponse[obstacleIndex];
          vec2 flowDirection = normalize(flowWake.xy);
          vec2 lateralDirection = vec2(-flowDirection.y, flowDirection.x);
          vec2 relative = worldPosition - centerRadiusContact.xy;
          float along = dot(relative, flowDirection);
          float across = dot(relative, lateralDirection);
          float radius = centerRadiusContact.z;
          float radiusSquared = radius * radius;
          float distanceSquared = max(dot(relative, relative), radiusSquared * 1.02);
          float distanceFromCenter = sqrt(distanceSquared);
          float outsideBody = smoothstep(radius * 0.94, radius * 1.08, distanceFromCenter);
          float nearField = (1.0 - smoothstep(
            radius * 1.04,
            max(response.x, radius * 1.08),
            distanceFromCenter
          )) * outsideBody * centerRadiusContact.w;

          // The near field follows the bounded inviscid cylinder solution. It
          // bends the local velocity around the actual rendered clast instead
          // of painting circular ripple decals around an arbitrary point.
          float inverseDistanceFourth = 1.0 / max(
            distanceSquared * distanceSquared,
            radiusSquared * radiusSquared * 1.04
          );
          vec2 potentialPerturbationLocal = vec2(
            -radiusSquared * (along * along - across * across) * inverseDistanceFourth,
            -2.0 * radiusSquared * along * across * inverseDistanceFourth
          );
          vec2 potentialPerturbation = flowDirection * potentialPerturbationLocal.x
            + lateralDirection * potentialPerturbationLocal.y;
          float potentialMagnitude = length(potentialPerturbation);
          if (potentialMagnitude > 0.0001) {
            surfaceSlope += potentialPerturbation / potentialMagnitude
              * min(potentialMagnitude, 1.25)
              * response.y
              * nearField;
          }

          // Separation and alternating shedding are allowed only downstream.
          // Their envelope expands with distance while decaying before the
          // authored wake bound; the rock remains the sole spatial source.
          float downstream = smoothstep(radius * 0.18, radius * 0.82, along)
            * (1.0 - smoothstep(flowWake.z * 0.7, flowWake.z, along));
          float wakeProgress = clamp(along / max(flowWake.z, 0.001), 0.0, 1.0);
          float wakeWidth = mix(radius * 0.58, flowWake.w, sqrt(wakeProgress));
          float lateralEnvelope = 1.0 - smoothstep(
            wakeWidth * 0.18,
            max(wakeWidth, 0.02),
            abs(across)
          );
          float wake = downstream * lateralEnvelope * centerRadiusContact.w;
          float sheddingPhase = along / max(radius, 0.07) * 3.65
            - time * (2.25 + centerRadiusContact.w * 1.15)
            + across / max(wakeWidth, 0.02) * 2.4;
          float alternatingVortex = sin(sheddingPhase);
          float compressionWave = cos(sheddingPhase * 0.52 - 0.7);
          surfaceSlope += (
            lateralDirection * alternatingVortex
              + flowDirection * compressionWave * 0.28
          ) * response.y * wake * 0.58;
          float upstreamCompression = nearField
            * (1.0 - smoothstep(-radius * 0.12, radius * 0.72, along))
            * smoothstep(0.08, 0.56, potentialMagnitude);
          float separatedFlowEnergy = max(wake, upstreamCompression * 0.68);
          wakeEnergy = max(wakeEnergy, separatedFlowEnergy);
          aeration = max(
            aeration,
            response.z * separatedFlowEnergy
              * (0.62 + abs(alternatingVortex) * 0.38)
          );
          roughnessGain = max(
            roughnessGain,
            response.w * max(separatedFlowEnergy, nearField * 0.54)
          );
        }
        float aggregateSlope = length(surfaceSlope);
        if (aggregateSlope > 0.052) {
          surfaceSlope *= 0.052 / aggregateSlope;
        }
      }

      void main() {
        float edgeDistance = min(vUv.x, 1.0 - vUv.x);
        float waterDepthMeters = clamp(vWaterDepthMeters, 0.0, 0.36);
        float channelDepth = smoothstep(0.012, 0.285, waterDepthMeters);
        float signedFlow = clamp(vFlowDirection, -1.0, 1.0);
        float hydraulicEnergy = clamp(vFlowEnergy, 0.0, 1.0);
        vec2 obstacleSlope;
        float obstacleWakeEnergy;
        float obstacleAeration;
        float obstacleRoughnessGain;
        sampleRenderedObstacleFlow(
          vWorldPosition.xz,
          obstacleSlope,
          obstacleWakeEnergy,
          obstacleAeration,
          obstacleRoughnessGain
        );
        vec2 broadUv = vec2(
          vUv.x * 3.4,
          vUv.y * 11.0 - time * 0.34 * signedFlow
        ) + obstacleSlope * vec2(3.6, 2.25);
        vec2 fineUv = rotateUv(0.49) * vec2(vUv.x * 7.2, vUv.y * 23.0)
          + vec2(time * 0.11 * signedFlow, -time * 0.61 * signedFlow)
          + obstacleSlope * vec2(7.8, 5.4);
        vec3 broadNormal = unpackFlowNormal(texture2D(flowNormal, broadUv).xyz);
        vec3 fineNormal = unpackFlowNormal(texture2D(flowNormal, fineUv).xyz);
        float wettedSurface = smoothstep(0.008, 0.055, waterDepthMeters);
        vec2 broadRippleSlope = broadNormal.xy
          * mix(0.44, 0.72, hydraulicEnergy)
          * wettedSurface;
        vec2 fineRippleSlope = fineNormal.xy
          * mix(0.12, 0.24, hydraulicEnergy)
          * detailMix
          * wettedSurface;
        vec2 rippleSlope = broadRippleSlope + fineRippleSlope
          + obstacleSlope * wettedSurface;
        vec3 geometricNormal = normalize(vWorldNormal);
        vec3 surfaceNormal = normalize(
          geometricNormal + vec3(rippleSlope.x, 0.0, rippleSlope.y)
        );

        vec2 colourUv = vec2(
          vUv.x * 2.1 + time * 0.018 * signedFlow,
          vUv.y * 5.6 - time * 0.12 * signedFlow
        );
        float mineralNoise = texture2D(flowAlbedo, colourUv).g;
        float textureRoughness = texture2D(flowRoughness, fineUv * 0.72).r;
        float roughness = clamp(
          0.06 + textureRoughness * 0.22 + hydraulicEnergy * 0.07
            + obstacleRoughnessGain,
          0.11,
          0.34
        );

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float viewFacing = clamp(dot(surfaceNormal, viewDirection), 0.0, 1.0);
        float fresnel = 0.02037 + 0.97963 * pow(1.0 - viewFacing, 5.0);

        vec2 distortedBedUv = vWorldPosition.xz * 0.085
          + rippleSlope * vec2(0.13, 0.1);
        vec3 channelBedColor = texture2D(channelBed, distortedBedUv).rgb;
        // Water-column thickness comes from the same water level and terrain
        // heightfield used by hydrology and collision. Grazing views lengthen
        // that measured vertical column; no painted centre-channel depth is used.
        float opticalThickness = clamp(
          waterDepthMeters / max(viewFacing, 0.32),
          0.006,
          0.72
        );
        vec3 absorptionCoefficient = vec3(0.72, 0.22, 0.13);
        vec3 transmittance = exp(-absorptionCoefficient * opticalThickness);
        vec3 waterScatterColor = mix(shallowColor, deepColor, channelDepth * 0.68);
        vec3 transmittedBed = channelBedColor * transmittance
          + waterScatterColor * (vec3(1.0) - transmittance);
        vec3 waterColor = transmittedBed;

        // Snell refraction is evaluated in view space. The depth buffer then
        // supplies the actual opaque surface behind this water fragment, so the
        // Beer-Lambert path is measured from geometry rather than painted into
        // the ribbon. A second depth sample refines the first channel-depth guess.
        const float AIR_TO_WATER_ETA = 0.7501875;
        vec3 incidentWorldDirection = normalize(vWorldPosition - cameraPosition);
        vec3 incidentViewDirection = normalize(mat3(viewMatrix) * incidentWorldDirection);
        vec3 rippleNormalView = normalize(mat3(viewMatrix) * surfaceNormal);
        vec3 rippleRefraction = refract(incidentViewDirection, rippleNormalView, AIR_TO_WATER_ETA);
        float estimatedWaterPath = clamp(opticalThickness, 0.012, 0.72);
        vec2 firstProjectedUv = projectViewPosition(
          vViewPosition + rippleRefraction * estimatedWaterPath
        );
        vec2 firstRefractionUv = clamp(
          firstProjectedUv,
          vec2(0.002),
          vec2(0.998)
        );
        float waterViewZ = perspectiveDepthToViewZ(gl_FragCoord.z, cameraNear, cameraFar);
        float firstOpaqueDepth = texture2D(sceneRefractionDepth, firstRefractionUv).r;
        float firstOpaqueViewZ = perspectiveDepthToViewZ(firstOpaqueDepth, cameraNear, cameraFar);
        vec3 firstOpaqueViewPosition = reconstructViewPosition(
          firstRefractionUv,
          firstOpaqueDepth
        );
        float firstWaterPath = clamp(
          length(firstOpaqueViewPosition - vViewPosition)
            * step(0.001, waterViewZ - firstOpaqueViewZ)
            * insideViewport(firstProjectedUv),
          0.0,
          0.85
        );
        vec2 projectedRefractionUv = projectViewPosition(
          vViewPosition + rippleRefraction * max(firstWaterPath, 0.025)
        );
        vec2 refractionUv = clamp(
          projectedRefractionUv,
          vec2(0.002),
          vec2(0.998)
        );
        float opaqueDepth = texture2D(sceneRefractionDepth, refractionUv).r;
        float opaqueViewZ = perspectiveDepthToViewZ(opaqueDepth, cameraNear, cameraFar);
        vec3 opaqueViewPosition = reconstructViewPosition(refractionUv, opaqueDepth);
        float measuredWaterPath = clamp(
          length(opaqueViewPosition - vViewPosition)
            * step(0.001, waterViewZ - opaqueViewZ),
          0.0,
          0.85
        );
        float depthIsBehindWater = step(0.002, measuredWaterPath);
        float depthIsGeometry = 1.0 - step(0.999995, opaqueDepth);
        float sceneDepthValid = sceneRefractionReady
          * depthIsBehindWater
          * depthIsGeometry
          * insideViewport(projectedRefractionUv);
        vec3 refractedSceneColor = texture2D(sceneRefractionColor, refractionUv).rgb;
        vec3 measuredTransmittance = exp(
          -absorptionCoefficient * max(measuredWaterPath, 0.025)
        );
        vec3 transmittedScene = refractedSceneColor * measuredTransmittance
          + deepColor * (vec3(1.0) - measuredTransmittance);
        vec3 transmittedSurface = mix(transmittedBed, transmittedScene, sceneDepthValid);
        float transmissionWeight = (1.0 - fresnel)
          * mix(bedTransmissionMix * 0.92, bedTransmissionMix, sceneDepthValid);
        waterColor = mix(waterScatterColor, transmittedSurface, transmissionWeight);

        // Roughness broadens the lobe; it must not invent a large normal-incidence
        // mirror term. Fresh water starts near the dielectric F0 above.
        float reflectionStrength = clamp(
          fresnel + roughness * 0.012,
          0.02037,
          0.72
        );
        float warmReflection = pow(max(dot(reflect(-normalize(sunDirection), surfaceNormal), viewDirection), 0.0), 54.0);
        vec3 reflectedSky = mix(skyColor, sunColor, warmReflection * 0.48);
        vec3 incidentDirection = normalize(vWorldPosition - cameraPosition);
        vec3 reflectedDirection = reflect(incidentDirection, surfaceNormal);
        vec3 localSceneReflection = texture2D(
          sceneReflectionPanorama,
          equirectangularUv(reflectedDirection)
        ).rgb;
        vec3 reflectedScene = mix(
          reflectedSky,
          localSceneReflection,
          reflectionPanoramaMix
        );
        vec4 distortedReflectionCoord = vPlanarReflectionCoord;
        vec2 reflectionSlope = broadRippleSlope + fineRippleSlope * 0.22;
        distortedReflectionCoord.xy += reflectionSlope * 0.028
          * distortedReflectionCoord.w;
        vec2 planarUv = distortedReflectionCoord.xy
          / max(distortedReflectionCoord.w, 0.0001);
        float planarInside = step(0.001, distortedReflectionCoord.w)
          * step(0.002, planarUv.x) * step(planarUv.x, 0.998)
          * step(0.002, planarUv.y) * step(planarUv.y, 0.998);
        vec3 activeTangent = normalize(planarReflectionTangent);
        vec3 activeAcross = normalize(vec3(-activeTangent.z, 0.0, activeTangent.x));
        vec3 activeDelta = vWorldPosition - planarReflectionCenter;
        float activeAlong = abs(dot(activeDelta, activeTangent))
          / max(planarReflectionHalfExtent.y, 0.001);
        float activeCross = abs(dot(activeDelta, activeAcross))
          / max(planarReflectionHalfExtent.x, 0.001);
        float activeFootprint = 1.0 - smoothstep(
          0.72,
          1.0,
          max(activeAlong, activeCross)
        );
        float activePlaneDistance = abs(dot(activeDelta, planarReflectionPlaneNormal));
        float activePlaneAgreement = 1.0 - smoothstep(
          planarReflectionPlaneTolerance * 0.55,
          planarReflectionPlaneTolerance,
          activePlaneDistance
        );
        vec3 planarSceneReflection = texture2D(
          planarReflection,
          clamp(planarUv, vec2(0.002), vec2(0.998))
        ).rgb;
        reflectedScene = mix(
          reflectedScene,
          planarSceneReflection,
          planarReflectionReady * planarReflectionMix * planarInside
            * activeFootprint * activePlaneAgreement
            * mix(1.0, 0.56, hydraulicEnergy)
        );
        // Screen-space rays attach nearby reflected trunks and rocks to the
        // actual depth buffer. A calmer ray normal preserves coherent shapes;
        // Fresnel and final shading still use the full ripple normal. Misses,
        // occlusion and viewport exits fade back to the local planar/probe pair.
        vec3 geometricNormalView = normalize(mat3(viewMatrix) * geometricNormal);
        vec3 coherentReflectionNormal = normalize(mix(
          rippleNormalView,
          geometricNormalView,
          clamp(0.54 + roughness * 0.72, 0.54, 0.74)
        ));
        vec3 reflectedViewRay = normalize(reflect(
          incidentViewDirection,
          coherentReflectionNormal
        ));
        float reflectedRayAboveSurface = step(
          0.015,
          dot(reflectedViewRay, geometricNormalView)
        );
        vec4 screenSpaceReflection = traceScreenSpaceReflection(
          vViewPosition,
          reflectedViewRay,
          reflectedRayAboveSurface
        );
        float screenSpaceConfidence = screenSpaceReflection.a
          * ssrStrength
          * mix(0.92, 0.64, roughness);
        reflectedScene = mix(
          reflectedScene,
          screenSpaceReflection.rgb,
          screenSpaceConfidence
        );
        vec3 colour = mix(waterColor, reflectedScene, reflectionStrength);

        float bankContact = 1.0 - smoothstep(0.055, 0.22, edgeDistance);
        float foamNoise = broadNormal.x * 0.44 + fineNormal.y * 0.31 + mineralNoise * 0.4;
        float bankAeration = smoothstep(0.12, 0.54, foamNoise)
          * bankContact
          * smoothstep(0.16, 0.72, hydraulicEnergy)
          * 0.2;
        float hydraulicAeration = smoothstep(0.18, 0.62, foamNoise)
          * smoothstep(0.035, 0.16, waterDepthMeters)
          * hydraulicEnergy * 0.22;
        float obstacleContactAeration = obstacleAeration
          * smoothstep(-0.16, 0.48, foamNoise + obstacleWakeEnergy * 0.4)
          * smoothstep(0.018, 0.12, waterDepthMeters);
        float foam = clamp(
          bankAeration + hydraulicAeration + obstacleContactAeration,
          0.0,
          0.4
        );
        colour = mix(colour, foamColor, foam);

        float feather = smoothstep(0.0, 0.82, vRibbonColor.a);
        // The shader already resolves an approximate transmitted riverbed, so
        // keep the channel core nearly opaque and only feather the physical bank.
        float alpha = feather * clamp(0.88 + fresnel * 0.08 + foam * 0.08, 0.0, 0.98);
        gl_FragColor = vec4(colour, alpha);
        #include <fog_fragment>
      }
    `,
  });
  material.name = 'Project Plateau measured-column shallow brook';
  material.userData.surface = 'measured-column-fresnel-shallow-brook-shader';
  material.userData.motion =
    'tessellated-gravity-and-rendered-obstacle-coupled-twin-headwater-free-surface';
  material.userData.layers = Object.freeze([
    'shared-heightfield-measured-water-column',
    'broad-flow-normal',
    'fine-cross-current-normal',
    'downstream-grade-coupled-hydraulic-energy',
    'rendered-clast-potential-flow-deflection',
    'downstream-bounded-vortex-shedding-and-contact-aeration',
    'centimetre-bounded-free-surface-pressure-speedup-and-wake-displacement',
    'fresnel-sky-response',
    'grade-bounded-bank-and-flow-aeration',
    'scene-layout-local-reflection',
    'camera-selected-gravity-reach-planar-reflection',
    'bounded-screen-space-reflection-over-planar-fallback',
    'beer-lambert-channel-bed-transmission',
    'same-camera-scene-colour-depth-refraction',
  ]);
  return material;
}

function applyBrookObstacleFlowField(material, field) {
  const centerUniforms = material.uniforms.obstacleCenterRadiusContact.value;
  const flowUniforms = material.uniforms.obstacleFlowWake.value;
  const responseUniforms = material.uniforms.obstacleResponse.value;
  centerUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  flowUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  responseUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  field.selected.forEach((obstacle, index) => {
    centerUniforms[index].set(
      obstacle.x,
      obstacle.z,
      obstacle.radiusMeters,
      obstacle.upperColumnContact,
    );
    flowUniforms[index].set(
      obstacle.flowDirection.x,
      obstacle.flowDirection.y,
      obstacle.wakeLengthMeters,
      obstacle.wakeHalfWidthMeters,
    );
    responseUniforms[index].set(
      obstacle.deflectionRadiusMeters,
      obstacle.normalSlope,
      obstacle.aeration,
      obstacle.roughnessGain,
    );
  });
  material.uniforms.obstacleCount.value = Math.min(
    field.selected.length,
    BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality.balanced,
  );
  const rejectionCounts = {};
  field.rejected.forEach(({ reason }) => {
    rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
  });
  material.userData.obstacleFlow = Object.freeze({
    version: field.profile.version,
    model: field.profile.model,
    candidateSource: field.profile.candidateSource,
    candidateCount: field.candidateCount,
    qualifyingCount: field.qualifyingCount,
    selectedCount: field.selected.length,
    maximumObstacleCount: field.profile.maximumObstacleCount,
    activeCountByQuality: field.profile.activeCountByQuality,
    selectedSourceClasses: field.selectedSourceClasses,
    selectedIds: field.selectedIds,
    rejectionCounts: Object.freeze(rejectionCounts),
    maximumNormalSlope: Number(field.maximumNormalSlope.toFixed(5)),
    maximumAeration: Number(field.maximumAeration.toFixed(5)),
    evidenceBoundary: field.profile.evidenceBoundary,
    obstacles: Object.freeze(field.selected.map((obstacle) => Object.freeze({
      id: obstacle.id,
      sourceClass: obstacle.sourceClass,
      position: Object.freeze([
        Number(obstacle.x.toFixed(4)),
        Number(obstacle.z.toFixed(4)),
      ]),
      radiusMeters: Number(obstacle.radiusMeters.toFixed(4)),
      waterDepthMeters: Number(obstacle.waterDepthMeters.toFixed(4)),
      topClearanceMeters: Number(obstacle.topClearanceMeters.toFixed(4)),
      channelDistance: Number(obstacle.channelDistance.toFixed(4)),
      upperColumnContact: Number(obstacle.upperColumnContact.toFixed(4)),
      flowDirection: Object.freeze([
        Number(obstacle.flowDirection.x.toFixed(5)),
        Number(obstacle.flowDirection.y.toFixed(5)),
      ]),
      wakeLengthMeters: Number(obstacle.wakeLengthMeters.toFixed(4)),
      wakeHalfWidthMeters: Number(obstacle.wakeHalfWidthMeters.toFixed(4)),
      normalSlope: Number(obstacle.normalSlope.toFixed(5)),
      aeration: Number(obstacle.aeration.toFixed(5)),
    }))),
  });
}

function createBrookLocalReflectionPanorama(scene, existingTexture = null) {
  const width = 512;
  const height = 256;
  const data = existingTexture?.image?.data?.length === width * height * 4
    ? existingTexture.image.data
    : new Uint8Array(width * height * 4);
  const colorBytes = (hex) => {
    const color = new THREE.Color(hex);
    return [color.r * 255, color.g * 255, color.b * 255];
  };
  const topSky = colorBytes(0x6e9295);
  const horizonSky = colorBytes(0xc59a6e);
  const horizonGround = colorBytes(0x31453d);
  const lowerGround = colorBytes(0x182722);
  const blendPixel = (x, y, color, opacity = 1) => {
    const wrappedX = ((Math.round(x) % width) + width) % width;
    const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)));
    const offset = (clampedY * width + wrappedX) * 4;
    const inverse = 1 - opacity;
    data[offset] = Math.round(data[offset] * inverse + color[0] * opacity);
    data[offset + 1] = Math.round(data[offset + 1] * inverse + color[1] * opacity);
    data[offset + 2] = Math.round(data[offset + 2] * inverse + color[2] * opacity);
    data[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    const normalized = y / (height - 1);
    const isSky = normalized >= 0.5;
    const blend = isSky ? (normalized - 0.5) * 2 : normalized * 2;
    const start = isSky ? horizonSky : lowerGround;
    const end = isSky ? topSky : horizonGround;
    const color = [
      THREE.MathUtils.lerp(start[0], end[0], blend),
      THREE.MathUtils.lerp(start[1], end[1], blend),
      THREE.MathUtils.lerp(start[2], end[2], blend),
    ];
    for (let x = 0; x < width; x += 1) blendPixel(x, y, color, 1);
  }

  const drawEllipse = (centreX, centreY, radiusX, radiusY, color, opacity) => {
    const safeRadiusX = Math.max(0.75, Math.min(width * 0.18, radiusX));
    const safeRadiusY = Math.max(0.75, Math.min(height * 0.24, radiusY));
    for (const wrappedCentre of [centreX - width, centreX, centreX + width]) {
      const minX = Math.floor(wrappedCentre - safeRadiusX);
      const maxX = Math.ceil(wrappedCentre + safeRadiusX);
      const minY = Math.max(0, Math.floor(centreY - safeRadiusY));
      const maxY = Math.min(height - 1, Math.ceil(centreY + safeRadiusY));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - wrappedCentre) / safeRadiusX;
          const dy = (y - centreY) / safeRadiusY;
          const distance = dx * dx + dy * dy;
          if (distance > 1) continue;
          blendPixel(x, y, color, opacity * (1 - THREE.MathUtils.smoothstep(distance, 0.68, 1)));
        }
      }
    }
  };

  const sunDirection = new THREE.Vector3(-0.44, 0.55, 0.71).normalize();
  const sunAzimuth = Math.atan2(sunDirection.z, sunDirection.x);
  const sunElevation = Math.asin(sunDirection.y);
  drawEllipse(
    (sunAzimuth / (Math.PI * 2) + 0.5) * width,
    (sunElevation / Math.PI + 0.5) * height,
    7,
    7,
    colorBytes(0xe7c08a),
    0.72,
  );

  scene.updateMatrixWorld(true);
  const probe = new THREE.Vector3(-10.5, terrainHeight(-10.5, 28) + 1.35, 28);
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const centre = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const descriptors = [];
  const roleForName = (name) => {
    if (/cloud/i.test(name)) return 'cloud';
    if (/basalt|ridge|mountain/i.test(name)) return 'rock';
    if (/canopy|crown|leaf/i.test(name)) return 'canopy';
    if (/trunk|tree-fern-sentinel/i.test(name)) return 'trunk';
    if (/pterodactyl/i.test(name)) return 'airborne';
    return null;
  };
  const rolePalette = {
    cloud: colorBytes(0xb9c6c3),
    rock: colorBytes(0x4e5a57),
    canopy: colorBytes(0x294b3a),
    trunk: colorBytes(0x3d3c33),
    airborne: colorBytes(0x4a5558),
  };
  const isWorldVisible = (object) => {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  };
  const addDescriptor = (object, matrix, role) => {
    const sphere = object.geometry?.boundingSphere;
    if (!sphere) return;
    centre.copy(sphere.center).applyMatrix4(matrix);
    matrix.decompose(new THREE.Vector3(), rotation, scale);
    const radius = sphere.radius * Math.max(scale.x, scale.y, scale.z);
    const offset = centre.clone().sub(probe);
    const distance = offset.length();
    if (distance < 1 || distance > 240 || radius <= 0) return;
    const azimuth = Math.atan2(offset.z, offset.x);
    const elevation = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
    const angularRadius = Math.atan2(radius, distance);
    descriptors.push({
      role,
      distance,
      x: (azimuth / (Math.PI * 2) + 0.5) * width,
      y: (elevation / Math.PI + 0.5) * height,
      radius: Math.max(0.7, angularRadius / (Math.PI * 2) * width),
    });
  };
  scene.traverse((object) => {
    if (!isWorldVisible(object)) return;
    const role = roleForName(object.name ?? '');
    if (!role) return;
    if (object.isInstancedMesh) {
      object.geometry.computeBoundingSphere();
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        addDescriptor(object, worldMatrix, role);
      }
      return;
    }
    if (object.isMesh) {
      object.geometry.computeBoundingSphere();
      addDescriptor(object, object.matrixWorld, role);
      return;
    }
    if (object.isSprite) {
      object.getWorldPosition(centre);
      const offset = centre.clone().sub(probe);
      const distance = offset.length();
      if (distance < 1 || distance > 240) return;
      object.getWorldScale(scale);
      descriptors.push({
        role,
        distance,
        x: (Math.atan2(offset.z, offset.x) / (Math.PI * 2) + 0.5) * width,
        y: (Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) / Math.PI + 0.5) * height,
        radius: Math.max(1, Math.atan2(Math.max(scale.x, scale.y) * 0.5, distance) / (Math.PI * 2) * width),
      });
    }
  });
  descriptors.sort((a, b) => b.distance - a.distance);
  descriptors.forEach(({ role, x, y, radius, distance }) => {
    const opacity = role === 'cloud' ? 0.58 : THREE.MathUtils.clamp(0.82 - distance / 520, 0.42, 0.78);
    const shape = role === 'trunk'
      ? [radius * 0.34, radius * 2.5]
      : role === 'canopy' || role === 'cloud'
        ? [radius * 1.85, radius * 0.72]
        : role === 'rock'
          ? [radius * 0.88, radius * 1.42]
          : [radius * 1.7, radius * 0.4];
    drawEllipse(x, y, shape[0], shape[1], rolePalette[role], opacity);
  });

  const texture = existingTexture ?? new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = 'world.material.brook-local-scene-panorama';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.userData.sourceObjectCount = descriptors.length;
  texture.userData.probePosition = probe.toArray();
  texture.needsUpdate = true;
  return texture;
}

function createBrookSceneCapture(scene, brook, hydrology, suppressedObjects = []) {
  const material = brook.material;
  let panorama = createBrookLocalReflectionPanorama(scene);
  material.uniforms.sceneReflectionPanorama.value = panorama;
  const refractionTarget = new THREE.WebGLRenderTarget(480, 270, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  refractionTarget.texture.name = 'world.material.brook-scene-refraction-colour';
  refractionTarget.texture.colorSpace = THREE.NoColorSpace;
  refractionTarget.texture.generateMipmaps = false;
  const refractionDepth = new THREE.DepthTexture(480, 270, THREE.UnsignedIntType);
  refractionDepth.name = 'world.material.brook-scene-refraction-depth';
  refractionDepth.format = THREE.DepthFormat;
  refractionDepth.minFilter = THREE.NearestFilter;
  refractionDepth.magFilter = THREE.NearestFilter;
  refractionTarget.depthTexture = refractionDepth;
  material.uniforms.sceneRefractionColor.value = refractionTarget.texture;
  material.uniforms.sceneRefractionDepth.value = refractionDepth;
  const reflectionReaches = hydrology.reaches;
  const representativePoint = new THREE.Vector3(-10.5, 0, 28);
  let activeReach = reflectionReaches.reduce((nearest, reach) => (
    reach.center.distanceToSquared(representativePoint)
      < nearest.center.distanceToSquared(representativePoint) ? reach : nearest
  ), reflectionReaches[0]);
  const reflector = new Reflector(new THREE.PlaneGeometry(1, 1), {
    textureWidth: 320,
    textureHeight: 180,
    clipBias: 0.0025,
    multisample: 0,
  });
  reflector.name = 'world.connected_route.brook-planar-reflection-capture';
  const planarTarget = reflector.getRenderTarget();
  planarTarget.texture.name = 'world.material.brook-planar-reflection';
  const planarMatrix = material.uniforms.planarReflectionMatrix.value;
  const reflectorInverse = new THREE.Matrix4().copy(reflector.matrixWorld).invert();
  const cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const reachDelta = new THREE.Vector3();
  const lastCameraPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  const cameraQuaternion = new THREE.Quaternion();
  const lastCameraQuaternion = new THREE.Quaternion();
  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();
  let captureRequested = true;
  let lastCaptureFrame = -Infinity;
  const status = {
    status: 'pending-renderer',
    quality: 'balanced',
    reflectionResolution: [panorama.image.width, panorama.image.height],
    panoramaBuilds: 1,
    sourceObjectCount: panorama.userData.sourceObjectCount,
    planarResolution: [320, 180],
    planarCaptures: 0,
    reachCount: reflectionReaches.length,
    activeReachId: activeReach.id,
    activeBranch: activeReach.branch,
    activePlaneHeight: Number(activeReach.center.y.toFixed(4)),
    activePlaneNormal: activeReach.normal.toArray().map((value) => Number(value.toFixed(6))),
    activePlaneTolerance: Number((activeReach.maxSurfaceDeviation + 0.08).toFixed(4)),
    reachSwitches: 0,
    refractionResolution: [480, 270],
    refractionCaptures: 0,
    reflectionMode: 'scene-layout-equirectangular-probe-fallback',
    ssrMode: 'pending-same-camera-depth-screen-space-reflection',
    ssrSteps: BROOK_REFLECTION_PROFILE.stepsByQuality.balanced,
    ssrRangeMeters: BROOK_REFLECTION_PROFILE.maximumRangeMeters,
    planarMode: 'camera-selected-oblique-clipped-gravity-reach-reflection',
    refractionMode: 'same-camera-depth-refracted-scene-with-channel-bed-fallback',
    renderError: null,
  };
  const applyActiveReach = () => {
    reflector.position.copy(activeReach.center);
    reflector.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      activeReach.normal,
    );
    reflector.updateMatrixWorld(true);
    reflectorInverse.copy(reflector.matrixWorld).invert();
    material.uniforms.planarReflectionCenter.value.copy(activeReach.center);
    material.uniforms.planarReflectionTangent.value.copy(activeReach.tangent);
    material.uniforms.planarReflectionPlaneNormal.value.copy(activeReach.normal);
    material.uniforms.planarReflectionHalfExtent.value.set(
      activeReach.halfWidth,
      activeReach.halfLength,
    );
    material.uniforms.planarReflectionPlaneTolerance.value = Math.max(
      0.08,
      activeReach.maxSurfaceDeviation + 0.08,
    );
    status.activeReachId = activeReach.id;
    status.activeBranch = activeReach.branch;
    status.activePlaneHeight = Number(activeReach.center.y.toFixed(4));
    status.activePlaneNormal = activeReach.normal.toArray()
      .map((value) => Number(value.toFixed(6)));
    status.activePlaneTolerance = Number(
      material.uniforms.planarReflectionPlaneTolerance.value.toFixed(4),
    );
  };
  const scoreReachForCamera = (reach) => {
    reachDelta.copy(reach.center).sub(cameraPosition);
    const distanceSquared = reachDelta.lengthSq();
    const forwardDepth = reachDelta.dot(cameraDirection);
    if (forwardDepth <= 0.1) return Infinity;
    const lateralSquared = Math.max(0, distanceSquared - forwardDepth * forwardDepth);
    return lateralSquared / Math.max(forwardDepth * forwardDepth, 1)
      + forwardDepth * 0.0008;
  };
  const selectActiveReach = (force = false) => {
    cameraDirection.normalize();
    let selected = activeReach;
    let selectedScore = scoreReachForCamera(activeReach);
    for (const reach of reflectionReaches) {
      const score = scoreReachForCamera(reach);
      if (score < selectedScore) {
        selected = reach;
        selectedScore = score;
      }
    }
    if (!Number.isFinite(selectedScore)) {
      selected = reflectionReaches.reduce((nearest, reach) => (
        reach.center.distanceToSquared(cameraPosition)
          < nearest.center.distanceToSquared(cameraPosition) ? reach : nearest
      ), reflectionReaches[0]);
    }
    const activeScore = scoreReachForCamera(activeReach);
    if (selected !== activeReach && (
      force || !Number.isFinite(activeScore) || selectedScore < activeScore * 0.82
    )) {
      activeReach = selected;
      status.reachSwitches += 1;
    }
    applyActiveReach();
  };
  applyActiveReach();
  const captureResolutionForQuality = (quality) => (
    quality === 'high' ? [640, 360] : [480, 270]
  );
  const refreshStatus = () => {
    if (status.quality === 'low') {
      status.status = 'disabled-low';
    } else if (status.planarCaptures > 0 && status.refractionCaptures > 0) {
      status.status = 'ready';
    } else if (status.planarCaptures > 0 || status.refractionCaptures > 0) {
      status.status = 'partial-fallback';
    } else {
      status.status = 'pending-renderer';
    }
  };
  const setQuality = (quality) => {
    status.quality = ['low', 'balanced', 'high'].includes(quality) ? quality : 'balanced';
    if (status.quality === 'low') {
      material.uniforms.planarReflectionReady.value = 0;
      material.uniforms.sceneRefractionReady.value = 0;
      material.uniforms.reflectionPanoramaMix.value = 0;
      material.uniforms.bedTransmissionMix.value = 0.28;
      material.uniforms.ssrSteps.value = BROOK_REFLECTION_PROFILE.stepsByQuality.low;
      material.uniforms.ssrStrength.value = 0;
      status.ssrSteps = BROOK_REFLECTION_PROFILE.stepsByQuality.low;
      status.ssrMode = 'disabled-low';
      status.refractionMode = 'channel-bed-fallback-low-quality';
    } else {
      material.uniforms.planarReflectionReady.value = status.planarCaptures > 0 ? 1 : 0;
      material.uniforms.sceneRefractionReady.value = status.refractionCaptures > 0 ? 1 : 0;
      material.uniforms.planarReflectionMix.value = status.quality === 'high' ? 0.9 : 0.82;
      material.uniforms.reflectionPanoramaMix.value = status.quality === 'high' ? 0.84 : 0.76;
      material.uniforms.bedTransmissionMix.value = status.quality === 'high' ? 0.96 : 0.92;
      material.uniforms.ssrSteps.value = BROOK_REFLECTION_PROFILE.stepsByQuality[
        status.quality
      ];
      material.uniforms.ssrStrength.value = status.quality === 'high' ? 0.86 : 0.76;
      status.ssrSteps = BROOK_REFLECTION_PROFILE.stepsByQuality[status.quality];
      status.ssrMode = status.refractionCaptures > 0
        ? 'same-camera-depth-bounded-screen-space-reflection'
        : 'pending-same-camera-depth-screen-space-reflection';
      status.refractionMode = status.refractionCaptures > 0
        ? 'same-camera-depth-refracted-scene-with-channel-bed-fallback'
        : 'pending-same-camera-depth-refraction';
      const [width, height] = captureResolutionForQuality(status.quality);
      if (status.refractionResolution[0] !== width || status.refractionResolution[1] !== height) {
        refractionTarget.setSize(width, height);
        status.refractionResolution = [width, height];
        captureRequested = true;
      }
    }
    refreshStatus();
  };
  return {
    setQuality,
    requestReflectionRefresh() {
      panorama = createBrookLocalReflectionPanorama(scene, panorama);
      material.uniforms.sceneReflectionPanorama.value = panorama;
      status.panoramaBuilds += 1;
      status.sourceObjectCount = panorama.userData.sourceObjectCount;
      captureRequested = true;
      refreshStatus();
    },
    prepare(renderer, camera, quality = 'balanced', frameIndex = 0) {
      setQuality(quality);
      if (!renderer?.isWebGLRenderer || !camera?.isCamera) return;
      material.uniforms.cameraNear.value = camera.near;
      material.uniforms.cameraFar.value = camera.far;
      material.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      material.uniforms.cameraProjectionInverse.value.copy(camera.projectionMatrixInverse);
      if (status.quality === 'low') return;
      // Let the primary renderer allocate its shadow maps before the mirrored
      // and refracted cameras compile lit/instanced materials against them.
      // Capturing on frame zero binds placeholder textures to shadow samplers and
      // poisons later draws.
      if (frameIndex < 1) return;
      camera.updateMatrixWorld(true);
      camera.getWorldPosition(cameraPosition);
      camera.getWorldQuaternion(cameraQuaternion);
      camera.getWorldDirection(cameraDirection);
      const cameraPositionDeltaSquared = cameraPosition.distanceToSquared(lastCameraPosition);
      const cameraJumped = cameraPositionDeltaSquared > 25;
      const cameraMoved = cameraPositionDeltaSquared > 0.16
        || cameraQuaternion.angleTo(lastCameraQuaternion) > 0.025;
      const captureInterval = status.quality === 'high' ? 6 : 12;
      if (!captureRequested && (!cameraMoved || frameIndex - lastCaptureFrame < captureInterval)) {
        return;
      }
      selectActiveReach(captureRequested || cameraJumped);
      const hiddenObjects = [brook, ...suppressedObjects].filter(Boolean);
      const visibility = hiddenObjects.map((object) => object.visible);
      const savedRenderTarget = renderer.getRenderTarget();
      const savedXrEnabled = renderer.xr.enabled;
      const savedShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const savedScissorTest = renderer.getScissorTest();
      renderer.getViewport(savedViewport);
      renderer.getScissor(savedScissor);
      hiddenObjects.forEach((object) => { object.visible = false; });
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      const captureErrors = [];
      try {
        renderer.setRenderTarget(refractionTarget);
        renderer.setViewport(0, 0, status.refractionResolution[0], status.refractionResolution[1]);
        renderer.setScissor(0, 0, status.refractionResolution[0], status.refractionResolution[1]);
        renderer.setScissorTest(false);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        material.uniforms.sceneRefractionColor.value = refractionTarget.texture;
        material.uniforms.sceneRefractionDepth.value = refractionDepth;
        material.uniforms.sceneRefractionReady.value = 1;
        status.refractionCaptures += 1;
        status.refractionMode = 'same-camera-depth-refracted-scene-with-channel-bed-fallback';
        status.ssrMode = 'same-camera-depth-bounded-screen-space-reflection';
      } catch (error) {
        material.uniforms.sceneRefractionReady.value = 0;
        status.refractionMode = 'beer-lambert-channel-bed-fallback';
        status.ssrMode = 'disabled-capture-error';
        captureErrors.push(`refraction: ${error instanceof Error ? error.message : String(error)}`);
      }
      try {
        reflector.onBeforeRender(renderer, scene, camera);
        reflectorInverse.copy(reflector.matrixWorld).invert();
        planarMatrix
          .copy(reflector.material.uniforms.textureMatrix.value)
          .multiply(reflectorInverse);
        material.uniforms.planarReflection.value = planarTarget.texture;
        material.uniforms.planarReflectionReady.value = 1;
        status.planarCaptures += 1;
        status.reflectionMode = 'local-planar-plus-scene-layout-probe';
      } catch (error) {
        material.uniforms.planarReflectionReady.value = 0;
        status.reflectionMode = 'scene-layout-equirectangular-probe-fallback';
        captureErrors.push(`reflection: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        status.renderError = captureErrors.length > 0 ? captureErrors.join('; ') : null;
        captureRequested = false;
        lastCaptureFrame = frameIndex;
        lastCameraPosition.copy(cameraPosition);
        lastCameraQuaternion.copy(cameraQuaternion);
        refreshStatus();
        hiddenObjects.forEach((object, index) => { object.visible = visibility[index]; });
        renderer.xr.enabled = savedXrEnabled;
        renderer.shadowMap.autoUpdate = savedShadowAutoUpdate;
        renderer.setRenderTarget(savedRenderTarget);
        renderer.setViewport(savedViewport);
        renderer.setScissor(savedScissor);
        renderer.setScissorTest(savedScissorTest);
      }
    },
    snapshot() {
      return {
        status: status.status,
        quality: status.quality,
        reflectionResolution: [...status.reflectionResolution],
        panoramaBuilds: status.panoramaBuilds,
        sourceObjectCount: status.sourceObjectCount,
        planarResolution: [...status.planarResolution],
        planarCaptures: status.planarCaptures,
        reachCount: status.reachCount,
        activeReachId: status.activeReachId,
        activeBranch: status.activeBranch,
        activePlaneHeight: status.activePlaneHeight,
        activePlaneNormal: [...status.activePlaneNormal],
        activePlaneTolerance: status.activePlaneTolerance,
        reachSwitches: status.reachSwitches,
        refractionResolution: [...status.refractionResolution],
        refractionCaptures: status.refractionCaptures,
        reflectionMode: status.reflectionMode,
        planarMode: status.planarMode,
        refractionMode: status.refractionMode,
        ssrMode: status.ssrMode,
        ssrSteps: status.ssrSteps,
        ssrRangeMeters: status.ssrRangeMeters,
        renderError: status.renderError,
      };
    },
  };
}

function createBasaltDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const makeGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const wrap = (value, cells) => ((value % cells) + cells) % cells;
  const tileNoise = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const x0 = wrap(floorX, cells);
    const y0 = wrap(floorY, cells);
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = THREE.MathUtils.smoothstep(x - floorX, 0, 1);
    const ty = THREE.MathUtils.smoothstep(y - floorY, 0, 1);
    const lower = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], tx);
    const upper = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], tx);
    return THREE.MathUtils.lerp(lower, upper, ty);
  };
  const broadGrid = makeGrid(7, 1297);
  const mesoGrid = makeGrid(19, 1301);
  const grainGrid = makeGrid(47, 1303);
  const fractureGrid = makeGrid(23, 1307);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const broad = tileNoise(broadGrid, 7, u, v);
      const meso = tileNoise(
        mesoGrid,
        19,
        u + (broad - 0.5) * 0.055,
        v - (broad - 0.5) * 0.04,
      );
      const grain = tileNoise(grainGrid, 47, u - (meso - 0.5) * 0.018, v);
      const fracture = tileNoise(
        fractureGrid,
        23,
        u + (meso - 0.5) * 0.022,
        0.17 + (v - 0.5) * 0.035,
      );
      const sparseCrack = fracture > 0.86 ? (fracture - 0.86) * 2.6 : 0;
      const height = THREE.MathUtils.clamp(
        0.45 + (broad - 0.5) * 0.2 + (meso - 0.5) * 0.24
          + (grain - 0.5) * 0.08 - sparseCrack,
        0.12,
        0.78,
      );
      const offset = (y * size + x) * 4;
      const albedo = THREE.MathUtils.clamp(0.67 + (height - 0.45) * 0.42, 0.48, 0.82);
      albedoData.set([
        Math.round(albedo * 255),
        Math.round(albedo * 0.93 * 255),
        Math.round(albedo * 0.88 * 255),
        255,
      ], offset);
      const roughness = THREE.MathUtils.clamp(
        0.89 + (1 - height) * 0.09 + sparseCrack * 0.05,
        0.88,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(height * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.15, 5.25);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.basalt-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.basalt-roughness', roughnessData),
    height: makeTexture('world.material.basalt-height', heightData),
  });
}

function createRockDetailTextures() {
  const size = 128;
  const albedoData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  const makeNoiseGrid = (cells, seed) => {
    const random = seededRandom(seed);
    return Float32Array.from({ length: cells * cells }, () => random());
  };
  const macroGrid = makeNoiseGrid(5, 1439);
  const mesoGrid = makeNoiseGrid(13, 1447);
  const grainGrid = makeNoiseGrid(29, 1453);
  const lichenGrid = makeNoiseGrid(9, 1459);
  const tileNoise = (grid, cells, u, v) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x) % cells;
    const y0 = Math.floor(y) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const fx = THREE.MathUtils.smoothstep(x - Math.floor(x), 0, 1);
    const fy = THREE.MathUtils.smoothstep(y - Math.floor(y), 0, 1);
    const top = THREE.MathUtils.lerp(grid[y0 * cells + x0], grid[y0 * cells + x1], fx);
    const bottom = THREE.MathUtils.lerp(grid[y1 * cells + x0], grid[y1 * cells + x1], fx);
    return THREE.MathUtils.lerp(top, bottom, fy);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const macro = tileNoise(macroGrid, 5, u, v);
      const meso = tileNoise(mesoGrid, 13, u, v);
      const grain = tileNoise(grainGrid, 29, u, v);
      const lichenNoise = tileNoise(lichenGrid, 9, u + 0.17, v - 0.11);
      const value = THREE.MathUtils.clamp(
        0.54 + (macro - 0.5) * 0.22 + (meso - 0.5) * 0.13
          + (grain - 0.5) * 0.055,
        0.4,
        0.74,
      );
      const moss = THREE.MathUtils.clamp(
        THREE.MathUtils.smoothstep(lichenNoise, 0.58, 0.86) * 0.72,
        0,
        1,
      );
      const offset = (y * size + x) * 4;
      albedoData[offset] = Math.round(value * (0.93 - moss * 0.07) * 255);
      albedoData[offset + 1] = Math.round(value * (0.96 + moss * 0.025) * 255);
      albedoData[offset + 2] = Math.round(value * (0.9 - moss * 0.055) * 255);
      albedoData[offset + 3] = 255;
      const roughness = THREE.MathUtils.clamp(
        0.82 + (1 - value) * 0.14 + moss * 0.035,
        0.84,
        0.99,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData.set([roughnessByte, roughnessByte, roughnessByte, 255], offset);
      const heightByte = Math.round(value * 255);
      heightData.set([heightByte, heightByte, heightByte, 255], offset);
    }
  }
  const makeTexture = (name, data, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 1.9);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    albedo: makeTexture('world.material.weathered-rock-albedo', albedoData, THREE.SRGBColorSpace),
    roughness: makeTexture('world.material.weathered-rock-roughness', roughnessData),
    height: makeTexture('world.material.weathered-rock-height', heightData),
  });
}

function createSmallWeatheredStoneGeometry() {
  // Small bed-load and ground stones still need a real support footprint.
  // A sphere supported only by duplicated pole vertices sinks its rounded
  // lower shell through the terrain and exposes a sharp dark intersection
  // band. Ten perimeter contacts plus one bottom centre make a closed,
  // non-overlapping base while the upper courses preserve an abraded pebble.
  const radialSegments = 10;
  const rings = [
    { y: 0, radiusX: 1, radiusZ: 0.88, offsetX: 0.01, offsetZ: -0.006 },
    { y: 0.1, radiusX: 0.96, radiusZ: 0.84, offsetX: 0.018, offsetZ: -0.008 },
    { y: 0.36, radiusX: 0.9, radiusZ: 0.8, offsetX: 0.012, offsetZ: 0.004 },
    { y: 0.69, radiusX: 0.72, radiusZ: 0.65, offsetX: -0.018, offsetZ: 0.01 },
    { y: 0.93, radiusX: 0.39, radiusZ: 0.35, offsetX: -0.035, offsetZ: 0.004 },
  ];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const abrasion = 1
        + Math.sin(angle * 3 + ringIndex * 0.73) * 0.025
        + Math.sin(angle * 5 - ringIndex * 0.31) * 0.012;
      positions.push(
        ring.offsetX + Math.cos(angle) * ring.radiusX * abrasion,
        ring.y,
        ring.offsetZ + Math.sin(angle) * ring.radiusZ * abrasion,
      );
      uvs.push(side / radialSegments, ring.y / 1.08);
    }
  }
  const bottomCapOffset = positions.length / 3;
  for (let side = 0; side < radialSegments; side += 1) {
    const source = side * 3;
    positions.push(positions[source], positions[source + 1], positions[source + 2]);
    uvs.push(
      positions[source] * 0.48 + 0.5,
      positions[source + 2] * 0.48 + 0.5,
    );
  }
  const bottomCentre = positions.length / 3;
  positions.push(0.01, 0, -0.006);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.045, 1.08, 0);
  uvs.push(0.5, 1);

  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lowerOffset = ringIndex * radialSegments;
    const upperOffset = (ringIndex + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        lowerOffset + side,
        upperOffset + side,
        lowerOffset + next,
        upperOffset + side,
        upperOffset + next,
        lowerOffset + next,
      );
    }
  }
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, bottomCapOffset + side, bottomCapOffset + next);
    indices.push(topOffset + side, topCentre, topOffset + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.topology = 'single-support-ring-to-abraded-crown-with-closed-bottom-cap';
  geometry.userData.supportRingCount = 1;
  geometry.userData.collapsedSupportRingCount = 0;
  geometry.userData.supportNormalBoundary = 'split-side-course-and-downward-cap-vertices';
  return geometry;
}

function createWeatheredRockGeometry(seed, detail = 2) {
  // Keep a shared-vertex surface, but make the silhouette respond to erosion
  // and fracture planes rather than merely scaling a sphere. Broad clipped
  // faces remain continuous at their weathered edges, avoiding both a plastic
  // capsule and the unrelated per-triangle lighting of the old icosahedron.
  const geometry = detail <= 1
    ? createSmallWeatheredStoneGeometry()
    : new THREE.SphereGeometry(1, 14, 9);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const heroRock = detail > 1;
  const point = new THREE.Vector3();
  const fracturePlanes = [
    [new THREE.Vector3(0.83, 0.18, 0.52).normalize(), 0.76],
    [new THREE.Vector3(-0.68, 0.34, 0.65).normalize(), 0.78],
    [new THREE.Vector3(0.12, 0.58, -0.81).normalize(), 0.8],
  ];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const shelf = Math.sin(x * 4.7 + y * 2.3 - z * 3.1 + seed * 0.013) * 0.11;
    const broad = Math.sin(x * 2.1 - z * 2.8 + seed * 0.021) * 0.09;
    const scale = 0.94 + shelf + broad;
    let nextX;
    let nextY;
    let nextZ;
    if (heroRock) {
      nextX = x * scale * (0.98 + y * 0.09) + Math.sin(y * 4.1 + seed) * 0.055;
      nextY = y * scale * 0.84 + Math.sin(x * 3.8 - z * 4.2) * 0.045;
      nextZ = z * scale * (0.94 - y * 0.045) + Math.sin(x * 3.2 + seed * 0.1) * 0.05;
      if (nextY < -0.52) nextY = -0.52 + (nextY + 0.52) * 0.1;
      if (nextY > 0.48) nextY = 0.48 + (nextY - 0.48) * 0.36;
    } else {
      const heightFraction = y / 1.08;
      const crownCamber = Math.sin(Math.PI * heightFraction);
      const abrasion = 0.97 + shelf * 0.34 + broad * 0.28;
      nextX = x * abrasion + Math.sin(y * 4.1 + seed) * crownCamber * 0.035;
      nextY = y <= 0.0001
        ? 0
        : y + crownCamber * (
          x * 0.025
          - z * 0.018
          + Math.sin(x * 3.8 - z * 4.2) * 0.014
        );
      nextZ = z * (abrasion * 0.98) + Math.sin(x * 3.2 + seed * 0.1)
        * crownCamber * 0.03;
    }
    if (heroRock) {
      point.set(nextX, nextY, nextZ);
      for (const [normal, limit] of fracturePlanes) {
        const distance = point.dot(normal);
        if (distance > limit) point.addScaledVector(normal, -(distance - limit) * 0.78);
      }
      nextX = point.x;
      nextY = point.y;
      nextZ = point.z;
    }
    positions.setXYZ(index, nextX, nextY, nextZ);
    const heightLight = THREE.MathUtils.clamp(nextY * 0.065, -0.045, 0.065);
    const mineralBreak = Math.sin(nextX * 4.1 - nextZ * 3.7 + seed * 0.04) * 0.035;
    const shade = THREE.MathUtils.clamp(
      (heroRock ? 0.76 : 0.94) + heightLight + mineralBreak,
      heroRock ? 0.62 : 0.84,
      heroRock ? 0.86 : 1.03,
    );
    colors.push(
      shade * 0.93,
      shade,
      shade * 0.92,
    );
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (!heroRock && geometry.index) {
    const triangleA = new THREE.Vector3();
    const triangleB = new THREE.Vector3();
    const triangleC = new THREE.Vector3();
    const triangleEdgeA = new THREE.Vector3();
    const triangleEdgeB = new THREE.Vector3();
    let minimumTriangleArea = Number.POSITIVE_INFINITY;
    for (let index = 0; index < geometry.index.count; index += 3) {
      triangleA.fromBufferAttribute(positions, geometry.index.getX(index));
      triangleB.fromBufferAttribute(positions, geometry.index.getX(index + 1));
      triangleC.fromBufferAttribute(positions, geometry.index.getX(index + 2));
      triangleEdgeA.subVectors(triangleB, triangleA);
      triangleEdgeB.subVectors(triangleC, triangleA);
      minimumTriangleArea = Math.min(
        minimumTriangleArea,
        triangleEdgeA.cross(triangleEdgeB).length() * 0.5,
      );
    }
    geometry.userData.minimumTriangleArea = minimumTriangleArea;
  }
  geometry.userData.profile = `weathered-fractured-rock-detail-${detail}`;
  geometry.userData.flatBase = true;
  geometry.userData.uvProfile = heroRock
    ? 'indexed-spherical-rock-uv'
    : 'indexed-rounded-ring-stack-uv';
  geometry.userData.normalProfile = 'continuous-indexed-surface-normals';
  geometry.userData.weathering = heroRock
    ? 'broad-clipped-fracture-planes-with-rounded-edges'
    : 'rounded-multiscale-stream-stone';
  geometry.userData.moistureProfile = heroRock ? 'darkened-lower-capillary-band' : 'none';
  geometry.userData.supportVertexCount = heroRock ? null : Array.from(
    { length: positions.count },
    (_, index) => positions.getY(index),
  ).filter((height) => height <= 0.0001).length;
  geometry.userData.seed = seed;
  return geometry;
}

const NON_COLUMNAR_ROCK_PROFILES = Object.freeze({
  'fluvial-cobble': Object.freeze({
    seed: 31,
    profile: 'historical-high-flow-rounded-lag-clast',
    fractureModel: 'long-duration-abrasion-with-muted-broad-faces',
    materialColor: 0x4c5550,
    flatShading: false,
    bumpScale: 0.023,
    moistureModel: 'porosity-varied-low-capillary-front',
  }),
  'bedded-slab': Object.freeze({
    seed: 47,
    profile: 'joint-bounded-tabular-plateau-slab',
    fractureModel: 'closed-irregular-ring-stack-with-two-load-bearing-bedding-ledges',
    materialColor: 0x5a5044,
    flatShading: false,
    bumpScale: 0.029,
  }),
  'angular-talus': Object.freeze({
    seed: 73,
    profile: 'joint-bounded-angular-talus-block',
    fractureModel: 'three-broad-joint-planes-with-sharp-spall-faces',
    materialColor: 0x57483d,
    flatShading: true,
    bumpScale: 0.034,
  }),
});

function createBeddedSlabGeometry() {
  // A bedded slab is a stack of joint-bounded plates, not a vertically squashed
  // sphere. Repeating the same irregular perimeter through paired equal-height
  // rings creates two real bedding ledges while preserving one closed mass and
  // a broad coplanar support polygon.
  const perimeter = [
    [-1.04, -0.34],
    [-0.66, -0.7],
    [0.14, -0.78],
    [0.82, -0.55],
    [1.0, -0.02],
    [0.74, 0.62],
    [0.12, 0.78],
    [-0.7, 0.63],
    [-1.02, 0.23],
  ];
  const rings = [
    {
      y: 0, sx: 0.86, sz: 0.83, ox: 0.03, oz: -0.01,
      edge: [0, -0.025, 0.025, -0.015, 0.02, -0.02, 0.015, -0.01, 0.025],
    },
    {
      y: 0.14, sx: 1, sz: 1, ox: 0, oz: 0,
      edge: [0.02, -0.015, 0.03, -0.025, 0.01, -0.035, 0.02, -0.02, 0.025],
    },
    {
      y: 0.14, sx: 0.94, sz: 0.93, ox: -0.025, oz: 0.012,
      edge: [-0.01, -0.07, 0.015, -0.09, -0.035, 0.005, -0.075, -0.02, -0.1],
    },
    {
      y: 0.34, sx: 0.9, sz: 0.88, ox: -0.05, oz: 0.018,
      edge: [0.015, -0.035, 0.025, -0.06, -0.015, 0.02, -0.045, 0.005, -0.07],
    },
    {
      y: 0.34, sx: 0.94, sz: 0.92, ox: -0.065, oz: 0.024,
      edge: [0.055, -0.01, 0.075, 0, -0.025, 0.065, -0.005, 0.085, 0.015],
    },
    {
      y: 0.52, sx: 0.8, sz: 0.77, ox: -0.13, oz: 0.012,
      edge: [0.04, -0.035, 0.06, -0.045, 0.005, 0.035, -0.055, 0.02, -0.06],
    },
    {
      y: 0.57, sx: 0.74, sz: 0.7, ox: -0.18, oz: 0,
      edge: [0.03, -0.06, 0.055, -0.035, -0.015, 0.045, -0.07, 0.025, -0.05],
    },
  ];
  const crownOffsets = [0.005, 0.035, 0.012, -0.022, -0.03, 0.004, 0.045, 0.026, -0.015];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (const [pointIndex, [x, z]] of perimeter.entries()) {
      const crownOffset = ringIndex === rings.length - 1 ? crownOffsets[pointIndex] : 0;
      const edgeScale = 1 + ring.edge[pointIndex];
      const px = x * ring.sx * edgeScale + ring.ox;
      const py = ring.y + crownOffset + (ringIndex === 0 ? 0 : x * 0.018 + z * 0.012);
      const pz = z * ring.sz * edgeScale + ring.oz;
      positions.push(px, py, pz);
      uvs.push(px * 0.42 + 0.5, pz * 0.42 + 0.5);
    }
  }
  const ringSize = perimeter.length;
  const bottomCentre = positions.length / 3;
  positions.push(0.02, 0, 0);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.18, 0.58, 0);
  uvs.push(0.43, 0.5);
  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let pointIndex = 0; pointIndex < ringSize; pointIndex += 1) {
      const next = (pointIndex + 1) % ringSize;
      const lower = ringIndex * ringSize + pointIndex;
      const lowerNext = ringIndex * ringSize + next;
      const upper = (ringIndex + 1) * ringSize + pointIndex;
      const upperNext = (ringIndex + 1) * ringSize + next;
      indices.push(lower, upper, lowerNext, upper, upperNext, lowerNext);
    }
  }
  const topOffset = (rings.length - 1) * ringSize;
  for (let pointIndex = 0; pointIndex < ringSize; pointIndex += 1) {
    const next = (pointIndex + 1) % ringSize;
    indices.push(bottomCentre, pointIndex, next);
    indices.push(topOffset + pointIndex, topCentre, topOffset + next);
  }
  const indexedGeometry = new THREE.BufferGeometry();
  indexedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexedGeometry.setIndex(indices);
  const geometry = toCreasedNormals(indexedGeometry, THREE.MathUtils.degToRad(31));
  indexedGeometry.dispose();
  geometry.userData.beddingLedgeCount = 2;
  geometry.userData.silhouetteModel = 'joint-bounded-broken-rectangle-not-sphere-derived';
  geometry.userData.topology = 'closed-irregular-ring-stack-with-coplanar-support-cap';
  geometry.userData.normalProfile = 'thirty-one-degree-creased-bedding-and-joint-normals';
  return geometry;
}

function createFluvialCobbleGeometry() {
  // A transported cobble needs one load-bearing footprint and one continuous
  // rounded shell. Clamping a sphere's lower latitude rings onto the same
  // plane leaves overlapping coplanar faces, which render as a false black
  // seam at the bank contact. This ring stack keeps every side course at a
  // unique elevation and closes the support plane with one downward cap.
  const radialSegments = 14;
  const rings = [
    { y: 0, radiusX: 1.005, radiusZ: 0.82, offsetX: 0.015, offsetZ: -0.01 },
    { y: 0.085, radiusX: 0.98, radiusZ: 0.78, offsetX: 0.025, offsetZ: -0.008 },
    { y: 0.32, radiusX: 0.94, radiusZ: 0.76, offsetX: 0.018, offsetZ: 0.006 },
    { y: 0.56, radiusX: 0.78, radiusZ: 0.64, offsetX: -0.015, offsetZ: 0.012 },
    { y: 0.755, radiusX: 0.42, radiusZ: 0.36, offsetX: -0.035, offsetZ: 0.005 },
  ];
  const positions = [];
  const uvs = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const broadFaceVariation = 1
        + Math.sin(angle * 3 + ringIndex * 0.71) * 0.018
        + Math.sin(angle * 5 - ringIndex * 0.43) * 0.009;
      const x = ring.offsetX + Math.cos(angle) * ring.radiusX * broadFaceVariation;
      const z = ring.offsetZ + Math.sin(angle) * ring.radiusZ * broadFaceVariation;
      positions.push(x, ring.y, z);
      uvs.push(side / radialSegments, ring.y / 0.84);
    }
  }
  const bottomCapOffset = positions.length / 3;
  for (let side = 0; side < radialSegments; side += 1) {
    const source = side * 3;
    positions.push(positions[source], positions[source + 1], positions[source + 2]);
    uvs.push(
      positions[source] * 0.48 + 0.5,
      positions[source + 2] * 0.48 + 0.5,
    );
  }
  const bottomCentre = positions.length / 3;
  positions.push(0.015, 0, -0.01);
  uvs.push(0.5, 0.5);
  const topCentre = positions.length / 3;
  positions.push(-0.055, 0.84, 0);
  uvs.push(0.5, 1);

  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lowerOffset = ringIndex * radialSegments;
    const upperOffset = (ringIndex + 1) * radialSegments;
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        lowerOffset + side,
        upperOffset + side,
        lowerOffset + next,
        upperOffset + side,
        upperOffset + next,
        lowerOffset + next,
      );
    }
  }
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, bottomCapOffset + side, bottomCapOffset + next);
    indices.push(topOffset + side, topCentre, topOffset + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.silhouetteModel = 'single-abraded-ellipsoid-with-broad-load-bearing-footprint';
  geometry.userData.topology = 'single-support-ring-to-rounded-crown-with-non-overlapping-bottom-cap';
  geometry.userData.supportRingCount = 1;
  geometry.userData.collapsedSupportRingCount = 0;
  geometry.userData.supportNormalBoundary = 'split-side-course-and-downward-cap-vertices';
  return geometry;
}

function createNonColumnarRockGeometry(family) {
  const profile = NON_COLUMNAR_ROCK_PROFILES[family];
  const geometry = family === 'fluvial-cobble'
    ? createFluvialCobbleGeometry()
    : family === 'bedded-slab'
      ? createBeddedSlabGeometry()
      : new THREE.SphereGeometry(1, 8, 6);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const point = new THREE.Vector3();
  const talusPlanes = [
    [new THREE.Vector3(0.88, 0.08, 0.47).normalize(), 0.73],
    [new THREE.Vector3(-0.64, 0.22, 0.74).normalize(), 0.76],
    [new THREE.Vector3(0.12, 0.66, -0.74).normalize(), 0.74],
  ];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    let nextX;
    let nextY;
    let nextZ;
    if (family === 'fluvial-cobble') {
      const abrasion = 1
        + Math.sin(x * 4.1 - z * 3.3 + profile.seed) * 0.035
        + Math.sin(y * 5.7 + x * 2.2) * 0.022;
      nextX = x * abrasion * (1.04 + y * 0.045) + Math.sin(y * 3.7) * 0.045;
      nextZ = z * abrasion * 0.82 + Math.cos(y * 4.2 + 0.7) * 0.045;
      const heightFraction = y / 0.84;
      const crownCamber = Math.sin(Math.PI * heightFraction);
      nextY = y <= 0.0001
        ? 0
        : y + crownCamber * (
          x * 0.036
          - z * 0.022
          + Math.sin(x * 3.2 - z * 2.4) * 0.017
        );
      nextX *= 1.00755;
    } else if (family === 'bedded-slab') {
      nextX = x;
      nextY = y;
      nextZ = z;
    } else {
      const facetBreak = 1
        + Math.sin(x * 4.7 - z * 5.1 + profile.seed) * 0.055
        + Math.sin(y * 5.9 + z * 2.4) * 0.035;
      point.set(x * facetBreak * 0.93, y * 0.52, z * facetBreak * 0.86);
      for (const [normal, limit] of talusPlanes) {
        const distance = point.dot(normal);
        if (distance > limit) point.addScaledVector(normal, -(distance - limit) * 0.86);
      }
      nextX = point.x;
      nextY = Math.max(-0.38, point.y) + 0.38;
      nextZ = point.z;
    }
    positions.setXYZ(index, nextX, nextY, nextZ);
    const heightFraction = family === 'fluvial-cobble'
      ? nextY / 0.84
      : family === 'bedded-slab' ? nextY / 0.8 : nextY / 1.02;
    const beddingShade = family === 'bedded-slab'
      ? Math.sin(nextY * 22.5) * 0.045
      : 0;
    const facetShade = family === 'angular-talus'
      ? Math.sin(nextX * 3.8 - nextZ * 4.4) * 0.06
      : Math.sin(nextX * 2.6 + nextZ * 3.1) * 0.025;
    const shade = THREE.MathUtils.clamp(
      0.83 + heightFraction * 0.12 + beddingShade + facetShade,
      0.68,
      1.02,
    );
    colors.push(shade * 0.98, shade, shade * 0.95);
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (family !== 'bedded-slab') geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (geometry.index) {
    const triangleA = new THREE.Vector3();
    const triangleB = new THREE.Vector3();
    const triangleC = new THREE.Vector3();
    const triangleEdgeA = new THREE.Vector3();
    const triangleEdgeB = new THREE.Vector3();
    let minimumTriangleArea = Number.POSITIVE_INFINITY;
    for (let index = 0; index < geometry.index.count; index += 3) {
      triangleA.fromBufferAttribute(positions, geometry.index.getX(index));
      triangleB.fromBufferAttribute(positions, geometry.index.getX(index + 1));
      triangleC.fromBufferAttribute(positions, geometry.index.getX(index + 2));
      triangleEdgeA.subVectors(triangleB, triangleA);
      triangleEdgeB.subVectors(triangleC, triangleA);
      minimumTriangleArea = Math.min(
        minimumTriangleArea,
        triangleEdgeA.cross(triangleEdgeB).length() * 0.5,
      );
    }
    geometry.userData.minimumTriangleArea = minimumTriangleArea;
  }
  geometry.userData.profile = profile.profile;
  geometry.userData.family = family;
  geometry.userData.source = 'original-code-authored-non-columnar-rock';
  geometry.userData.fractureModel = profile.fractureModel;
  geometry.userData.supportPlane = 'coplanar-broad-footprint-y0';
  geometry.userData.uvProfile = family === 'fluvial-cobble'
    ? 'indexed-rounded-ring-stack-uv'
    : 'indexed-spherical-family-uv';
  geometry.userData.supportVertexCount = Array.from(
    { length: positions.count },
    (_, index) => positions.getY(index),
  ).filter((height) => height <= 0.0001).length;
  geometry.userData.centerOfMassProjection = 'inside-convex-support-footprint';
  geometry.userData.normalProfile = family === 'fluvial-cobble'
    ? 'continuous-abraded-surface-normals'
    : family === 'bedded-slab'
      ? 'thirty-one-degree-creased-bedding-and-joint-normals'
      : 'faceted-fracture-and-bedding-normals';
  geometry.userData.columnar = false;
  return geometry;
}

function createNonColumnarRockMaterial(family) {
  const profile = NON_COLUMNAR_ROCK_PROFILES[family];
  const material = new THREE.MeshStandardMaterial({
    color: profile.materialColor,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: profile.flatShading,
    envMapIntensity: 0.08,
    dithering: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.familyRockAlbedo = { value: rockTextures.albedo };
    shader.uniforms.familyRockRoughness = { value: rockTextures.roughness };
    shader.uniforms.familyRockHeight = { value: rockTextures.height };
    shader.uniforms.familyRockReliefScale = { value: profile.bumpScale * 7.2 };
    shader.uniforms.familyRockBankMoisture = { value: family === 'fluvial-cobble' ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vFamilyRockObjectPosition;
        varying vec3 vFamilyRockObjectNormal;
      `)
      .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        vFamilyRockObjectNormal = objectNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vFamilyRockObjectPosition = transformed;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D familyRockAlbedo;
        uniform sampler2D familyRockRoughness;
        uniform sampler2D familyRockHeight;
        uniform float familyRockReliefScale;
        uniform float familyRockBankMoisture;
        varying vec3 vFamilyRockObjectPosition;
        varying vec3 vFamilyRockObjectNormal;

        vec3 familyRockBlendWeights() {
          vec3 weights = pow(abs(normalize(vFamilyRockObjectNormal)), vec3(2.8));
          return weights / max(dot(weights, vec3(1.0)), 0.0001);
        }

        vec3 sampleFamilyRockAlbedo() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          vec3 xSample = texture2D(familyRockAlbedo, point.zy + vec2(0.17, 0.29)).rgb;
          vec3 ySample = texture2D(familyRockAlbedo, point.xz + vec2(0.41, 0.13)).rgb;
          vec3 zSample = texture2D(familyRockAlbedo, point.xy + vec2(0.07, 0.47)).rgb;
          return xSample * weights.x + ySample * weights.y + zSample * weights.z;
        }

        float sampleFamilyRockRoughness() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          return texture2D(familyRockRoughness, point.zy + vec2(0.17, 0.29)).g * weights.x
            + texture2D(familyRockRoughness, point.xz + vec2(0.41, 0.13)).g * weights.y
            + texture2D(familyRockRoughness, point.xy + vec2(0.07, 0.47)).g * weights.z;
        }

        float sampleFamilyRockHeight() {
          vec3 weights = familyRockBlendWeights();
          vec3 point = vFamilyRockObjectPosition * 1.42;
          return texture2D(familyRockHeight, point.zy + vec2(0.17, 0.29)).r * weights.x
            + texture2D(familyRockHeight, point.xz + vec2(0.41, 0.13)).r * weights.y
            + texture2D(familyRockHeight, point.xy + vec2(0.07, 0.47)).r * weights.z;
        }

        vec3 perturbFamilyRockNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = normalize(dFdx(surfacePosition));
          vec3 sigmaY = normalize(dFdy(surfacePosition));
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 familyRockSample = sampleFamilyRockAlbedo();
        float familyRockLuma = dot(familyRockSample, vec3(0.2126, 0.7152, 0.0722));
        float familyRockMineral = smoothstep(0.12, 0.45, familyRockLuma);
        vec3 familyRockTint = familyRockSample / max(familyRockLuma, 0.08);
        float familyRockPorosityHeight = sampleFamilyRockHeight();
        diffuseColor.rgb *= mix(0.76, 1.08, familyRockMineral)
          * mix(vec3(1.0), familyRockTint, 0.2);
        float familyRockCapillaryFront = 0.13
          + (familyRockPorosityHeight - 0.5) * 0.07;
        float familyRockMoisture = (1.0 - smoothstep(
          familyRockCapillaryFront - 0.055,
          familyRockCapillaryFront + 0.07,
          vFamilyRockObjectPosition.y
        )) * familyRockBankMoisture;
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.54, 0.66, 0.6),
          familyRockMoisture * 0.36
        );
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float familyRockRelief = familyRockPorosityHeight;
        vec2 familyRockReliefGradient = vec2(
          dFdx(familyRockRelief),
          dFdy(familyRockRelief)
        ) * familyRockReliefScale;
        normal = perturbFamilyRockNormal(
          -vViewPosition,
          normal,
          familyRockReliefGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          mix(roughnessFactor, sampleFamilyRockRoughness(), 0.76),
          0.88,
          1.0
        );
        float familyRockWetFront = 0.13
          + (familyRockPorosityHeight - 0.5) * 0.07;
        float familyRockWetness = (1.0 - smoothstep(
          familyRockWetFront - 0.055,
          familyRockWetFront + 0.07,
          vFamilyRockObjectPosition.y
        )) * familyRockBankMoisture;
        roughnessFactor = mix(roughnessFactor, 0.78, familyRockWetness * 0.48);
      `);
  };
  material.customProgramCacheKey = () => `non-columnar-rock-triplanar-v2-${family}`;
  material.userData.surface = `${family}-separated-albedo-roughness-relief`;
  material.userData.channels = Object.freeze([
    rockTextures.albedo.name,
    rockTextures.roughness.name,
    rockTextures.height.name,
  ]);
  material.userData.triplanarTextures = Object.freeze({
    albedo: rockTextures.albedo,
    roughness: rockTextures.roughness,
    height: rockTextures.height,
  });
  material.userData.mapping = 'seam-free-object-space-triplanar';
  material.userData.moistureModel = profile.moistureModel ?? 'dry-surface-no-capillary-response';
  material.userData.authorship = 'original-procedural-texture-family';
  return material;
}

const rockSupportPoint = new THREE.Vector3();
const rockTerrainNormal = new THREE.Vector3();
const rockTerrainAlignment = new THREE.Quaternion();
const rockTerrainYaw = new THREE.Quaternion();
const rockUp = new THREE.Vector3(0, 1, 0);

function settleRockOnTerrain(target, geometry, placement) {
  const gradient = terrainGradient(placement.x, placement.z, 0.35);
  rockTerrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
  rockTerrainAlignment.setFromUnitVectors(rockUp, rockTerrainNormal);
  rockTerrainYaw.setFromAxisAngle(rockTerrainNormal, placement.yaw ?? 0);
  target.position.set(placement.x, 0, placement.z);
  target.quaternion.multiplyQuaternions(rockTerrainYaw, rockTerrainAlignment);
  target.scale.fromArray(placement.scale);
  target.updateMatrix();

  const positions = geometry.getAttribute('position');
  const supportLimit = geometry.boundingBox.min.y + 0.0001;
  const requiredOffsets = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > supportLimit) continue;
    rockSupportPoint.fromBufferAttribute(positions, index).applyMatrix4(target.matrix);
    requiredOffsets.push(
      terrainHeight(rockSupportPoint.x, rockSupportPoint.z) - rockSupportPoint.y,
    );
  }
  const burial = placement.burial ?? 0.04;
  target.position.y = Math.max(...requiredOffsets) - burial;
  target.updateMatrix();

  const supportClearances = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > supportLimit) continue;
    rockSupportPoint.fromBufferAttribute(positions, index).applyMatrix4(target.matrix);
    supportClearances.push(
      rockSupportPoint.y - terrainHeight(rockSupportPoint.x, rockSupportPoint.z),
    );
  }
  return Object.freeze({
    id: placement.id,
    x: placement.x,
    z: placement.z,
    yaw: placement.yaw,
    burial,
    slope: Math.hypot(gradient.x, gradient.z),
    minimumSupportClearance: Math.min(...supportClearances),
    maximumSupportClearance: Math.max(...supportClearances),
    contactVertexCount: supportClearances.filter((clearance) => clearance <= 0.025).length,
    supportVertexCount: supportClearances.length,
    solid: placement.solid,
  });
}

function renderedRockObstacleCandidate(id, sourceClass, geometry, matrix) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const worldBounds = geometry.boundingBox.clone().applyMatrix4(matrix);
  const center = worldBounds.getCenter(new THREE.Vector3());
  const size = worldBounds.getSize(new THREE.Vector3());
  return Object.freeze({
    id,
    sourceClass,
    x: center.x,
    z: center.z,
    radiusMeters: Math.max(size.x, size.z) * 0.5,
    topElevation: worldBounds.max.y,
    bottomElevation: worldBounds.min.y,
    bedElevation: terrainHeight(center.x, center.z),
  });
}

function makeNonColumnarRockFamilies(scene) {
  const familySpecs = [
    Object.freeze({
      family: 'fluvial-cobble',
      name: 'world.connected_route.rock-family.fluvial-cobbles',
      distribution: 'historical-high-flow-lag-now-immobile-under-present-brook',
      collisionRole: 'static-solid-historical-lag-clasts',
    }),
    Object.freeze({
      family: 'bedded-slab',
      name: 'world.connected_route.rock-family.bedded-glade-slabs',
      distribution: 'dry-glade-bowl-margin-bedding-exposure',
      collisionRole: 'static-solid-margin-slabs',
    }),
    Object.freeze({
      family: 'angular-talus',
      name: 'world.ridge-foot.rock-family.angular-talus',
      distribution: 'ridge-apron-downslope-talus-beyond-route',
      collisionRole: 'non-solid-beyond-navigation-boundary',
    }),
  ];
  const group = new THREE.Group();
  const tint = new THREE.Color();
  const dummy = new THREE.Object3D();
  const brookObstacleCandidates = [];
  familySpecs.forEach((spec) => {
    const placements = NON_COLUMNAR_ROCK_LAYOUT.filter(({ family }) => family === spec.family);
    const geometry = createNonColumnarRockGeometry(spec.family);
    const material = createNonColumnarRockMaterial(spec.family);
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const supportEvidence = [];
    placements.forEach((placement, index) => {
      supportEvidence.push(settleRockOnTerrain(dummy, geometry, placement));
      mesh.setMatrixAt(index, dummy.matrix);
      if (spec.family === 'fluvial-cobble') {
        brookObstacleCandidates.push(renderedRockObstacleCandidate(
          placement.id,
          placement.transportClass,
          geometry,
          dummy.matrix,
        ));
        tint.setHSL(0.39 + index * 0.004, 0.045, 0.49 + (index % 3) * 0.022);
      } else if (spec.family === 'bedded-slab') {
        // The slab is dry brown-grey bedrock. The former 0.65 lightness made
        // the large eastern instance read as an unweathered chalk capsule.
        tint.setHSL(0.085 + index * 0.003, 0.085, 0.42 + (index % 2) * 0.022);
      } else {
        tint.setHSL(0.075 + index * 0.004, 0.12, 0.57 + (index % 3) * 0.035);
      }
      mesh.setColorAt(index, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.name = spec.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.family = spec.family;
    mesh.userData.distribution = spec.distribution;
    mesh.userData.collisionRole = spec.collisionRole;
    mesh.userData.transportClasses = Object.freeze([
      ...new Set(placements.map(({ transportClass }) => transportClass).filter(Boolean)),
    ]);
    mesh.userData.presentFlowMobilities = Object.freeze([
      ...new Set(placements.map(({ presentFlowMobility }) => presentFlowMobility).filter(Boolean)),
    ]);
    if (spec.family === 'fluvial-cobble') {
      const baseDimensions = geometry.boundingBox.getSize(new THREE.Vector3());
      const longAxes = placements.map(({ scale }) => Math.max(
        baseDimensions.x * scale[0],
        baseDimensions.z * scale[2],
      ));
      mesh.userData.longAxisRangeMeters = Object.freeze([
        Number(Math.min(...longAxes).toFixed(3)),
        Number(Math.max(...longAxes).toFixed(3)),
      ]);
      mesh.userData.maximumBrookWidthFraction = Number((
        Math.max(...longAxes) / FLUVIAL_ROCK_TRANSPORT_PROFILE.brookWidthMeters
      ).toFixed(3));
    }
    mesh.userData.contactModel = 'terrain-normal-aligned-coplanar-footprint-shallow-burial';
    mesh.userData.supportEvidence = Object.freeze(supportEvidence);
    group.add(mesh);
  });
  group.name = 'world.authored-non-columnar-rock-families';
  group.userData.profile = 'three-geology-specific-non-columnar-rock-families';
  group.userData.placementCount = NON_COLUMNAR_ROCK_LAYOUT.length;
  group.userData.collisionPolicy = 'solid-inside-route-distant-nonsolid-outside-boundary';
  group.userData.fluvialTransport = FLUVIAL_ROCK_TRANSPORT_PROFILE;
  group.userData.brookObstacleCandidates = Object.freeze(brookObstacleCandidates);
  scene.add(group);
  return group;
}

const barkTextures = createBarkDetailTextures();
const plateBarkTextures = createPlateBarkDetailTextures();
const leafClusterTexture = createLeafClusterTexture();
const compoundLeafClusterTexture = createCompoundLeafClusterTexture();

const shared = {
  trunkGeometry: createPrehistoricTrunkGeometry(),
  plateBarkedTrunkGeometry: createPlateBarkedTrunkGeometry(),
  canopyBranchGeometry: createCanopyBranchGeometry(),
  crownGeometry: createCanopyClusterGeometry(),
  crownAccentGeometry: createCanopyClusterGeometry(true),
  araucariaGeometry: createAraucariaGeometry(),
  treeFernTrunkGeometry: createTreeFernTrunkGeometry(),
  treeFernCrownGeometries: [
    createFernGeometry({
      frondCount: 14,
      frondSegments: 8,
      lengthScale: 2.25,
      liftScale: 0.72,
      angleOffset: 0.12,
      centralShoots: 6,
      variant: 'broad-tree-fern-crown',
    }),
    createFernGeometry({
      frondCount: 11,
      frondSegments: 9,
      lengthScale: 2.48,
      liftScale: 1.02,
      angleOffset: 0.36,
      centralShoots: 4,
      variant: 'wind-broken-tree-fern-crown',
    }),
    createFernGeometry({
      frondCount: 17,
      frondSegments: 7,
      lengthScale: 1.88,
      liftScale: 0.56,
      angleOffset: -0.18,
      centralShoots: 7,
      variant: 'dense-low-tree-fern-crown',
    }),
  ],
  fernGeometries: [
    createFernGeometry({ variant: 'open-rosette' }),
    createFernGeometry({
      frondCount: 6,
      frondSegments: 7,
      lengthScale: 1.22,
      liftScale: 1.18,
      angleOffset: 0.21,
      centralShoots: 2,
      variant: 'upright-feather',
    }),
    createFernGeometry({
      frondCount: 10,
      frondSegments: 5,
      lengthScale: 0.94,
      liftScale: 0.62,
      angleOffset: -0.17,
      centralShoots: 4,
      variant: 'low-cycad',
    }),
  ],
  groundCoverGeometries: [
    createGroundCoverGeometry(0),
    createGroundCoverGeometry(1),
    createBroadleafGroundCoverGeometry(),
  ],
  leafDetailGeometry: createVolumetricLeafSprayGeometry(),
  canopyLeafGeometries: [
    createSupportedCanopyLeafGeometry('elliptic-waxy'),
    createSupportedCanopyLeafGeometry('compound-lanceolate'),
  ],
  trunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    flatShading: false,
    dithering: true,
    envMapIntensity: 0.46,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.035,
  }),
  plateBarkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    flatShading: false,
    dithering: true,
    envMapIntensity: 0.34,
    map: plateBarkTextures.albedo,
    roughnessMap: plateBarkTextures.roughness,
    bumpMap: plateBarkTextures.height,
    bumpScale: 0.028,
  }),
  crownMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.84,
    flatShading: false,
    dithering: true,
    emissive: 0x07130d,
    emissiveIntensity: 0.025,
    envMapIntensity: 0.52,
  }),
  fernMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    side: THREE.DoubleSide,
    flatShading: false,
    envMapIntensity: 0.5,
  }),
  treeFernTrunkMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.91,
    flatShading: false,
    envMapIntensity: 0.42,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.028,
  }),
  leafDetailMaterial: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.38,
  }),
  canopyLeafMaterials: [leafClusterTexture, compoundLeafClusterTexture].map((texture) => (
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      vertexColors: true,
      alphaTest: 0.34,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
      envMapIntensity: 0.24,
    })
  )),
};
shared.crownMaterial.userData.surface = 'smooth-canopy-mass-with-sky-response';
shared.fernMaterial.userData.surface = 'smooth-fern-frond-with-sky-response';
shared.trunkMaterial.userData.surface = 'bark-albedo-roughness-height-microstructure';
shared.plateBarkMaterial.userData.surface = 'plate-bark-geometric-relief-plus-separated-pbr-data';
shared.leafDetailMaterial.userData.surface = 'closed-volume-matte-leaf-blades-with-visible-rachis';
applyThinLeafTransmission(shared.leafDetailMaterial, 'cover-volumetric-waxy');
shared.canopyLeafMaterials.forEach((material, index) => {
  material.userData.surface = 'branch-supported-alpha-tested-matte-leaf-spray';
  material.userData.family = index === 0 ? 'elliptic-waxy' : 'compound-lanceolate';
  applyThinLeafTransmission(material, material.userData.family, true);
});

const GLADE_SIGHTLINE_HALF_WIDTH = 22;
const soilTextures = createSoilDetailTextures();
const terrainMacroControlTexture = createTerrainMacroControlTexture();
const waterTextures = createWaterDetailTextures();
const basaltDetailTextures = createBasaltDetailTextures();
const rockTextures = createRockDetailTextures();
const TRACK_IMPRESSION = Object.freeze({
  x: -1.65,
  z: 35.75,
  rotation: 0.44,
  scale: 2.08,
});

export function pterodactylAttackPose(attackSeconds = 0, reducedMotion = false) {
  const clock = Math.max(0, Number.isFinite(attackSeconds) ? attackSeconds : 0);
  // The threat must already be crossing the exposed corridor when the player
  // reaches for the rifle. Delaying all approach motion until 0.34 s left the
  // first defensive read as a distant bird in empty sky.
  const rawApproach = THREE.MathUtils.clamp((clock - 0.18) / 0.74, 0, 1);
  const easedApproach = rawApproach * rawApproach * (3 - 2 * rawApproach);
  const rawRecovery = THREE.MathUtils.clamp((clock - 2.24) / (3.05 - 2.24), 0, 1);
  const recovery = rawRecovery * rawRecovery * (3 - 2 * rawRecovery);
  const attackEnvelope = easedApproach * (1 - recovery);
  const approach = reducedMotion ? attackEnvelope * 0.38 : attackEnvelope;
  const rawFlightProgress = THREE.MathUtils.clamp((clock - 0.12) / 1.4, 0, 1);
  const easedFlightProgress = rawFlightProgress * rawFlightProgress * (3 - 2 * rawFlightProgress);
  const stage = clock < 0.5
    ? 'search'
    : clock < 0.92 ? 'fold-dive' : clock < 2.24 ? 'attack' : 'pull-up';
  return {
    stage,
    approach,
    recovery,
    flightProgress: reducedMotion ? easedFlightProgress * 0.38 : easedFlightProgress,
    wingFold: THREE.MathUtils.clamp(0.08 + approach * 0.74, 0, 0.82),
    pitch: THREE.MathUtils.lerp(0.06 + approach * 0.5, -0.2, recovery),
  };
}

export function pterodactylWingBeat(elapsed, phase = 0, awareness = 0, reducedMotion = false) {
  const tempo = reducedMotion ? 0.72 : 4.15 + awareness * 0.38;
  const cycle = elapsed * tempo + phase;
  const sine = Math.sin(cycle);
  const asymmetricStroke = sine >= 0
    ? sine ** 0.72
    : -((-sine) ** 1.28);
  return asymmetricStroke * (reducedMotion ? 0.045 : 0.29 + awareness * 0.035);
}

const PTERODACTYL_LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const PTERODACTYL_WORLD_UP = new THREE.Vector3(0, 1, 0);
const PTERODACTYL_ORBIT_CENTER = Object.freeze({ x: 0, z: -9 });
const THREAT_TRANSITION_SECONDS = 0.55;
export const PTERODACTYL_ATTACK_CYCLE_SECONDS = 4.4;

function alignPterodactylToTravel(mesh, velocity, roll = 0) {
  if (velocity.lengthSq() <= 1e-10) return;
  const direction = velocity.clone().normalize();
  const localZInWorld = direction.clone().negate();
  const referenceUp = Math.abs(direction.dot(PTERODACTYL_WORLD_UP)) > 0.98
    ? new THREE.Vector3(0, 0, 1)
    : PTERODACTYL_WORLD_UP;
  const localXInWorld = referenceUp.clone().cross(localZInWorld).normalize();
  const localYInWorld = localZInWorld.clone().cross(localXInWorld).normalize();
  const rotationBasis = new THREE.Matrix4().makeBasis(
    localXInWorld,
    localYInWorld,
    localZInWorld,
  );
  mesh.quaternion.setFromRotationMatrix(rotationBasis);
  mesh.rotateZ(roll);
  mesh.userData.flightDirection = direction;
}

function cubicBezierPoint(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  return new THREE.Vector3(
    inverse ** 3 * start.x
      + 3 * inverse ** 2 * progress * controlA.x
      + 3 * inverse * progress ** 2 * controlB.x
      + progress ** 3 * end.x,
    inverse ** 3 * start.y
      + 3 * inverse ** 2 * progress * controlA.y
      + 3 * inverse * progress ** 2 * controlB.y
      + progress ** 3 * end.y,
    inverse ** 3 * start.z
      + 3 * inverse ** 2 * progress * controlA.z
      + 3 * inverse * progress ** 2 * controlB.z
      + progress ** 3 * end.z,
  );
}

export function pterodactylAttackFlightState({
  attackClock,
  attackOrigin,
  playerPosition,
  reducedMotion,
}) {
  const finiteClock = Number.isFinite(attackClock) ? attackClock : 0;
  const cycleClock = ((finiteClock % PTERODACTYL_ATTACK_CYCLE_SECONDS)
    + PTERODACTYL_ATTACK_CYCLE_SECONDS) % PTERODACTYL_ATTACK_CYCLE_SECONDS;
  const pose = pterodactylAttackPose(cycleClock, reducedMotion);
  const approach = pose.approach;
  const flightProgress = pose.flightProgress;
  const diveStart = new THREE.Vector3(-4.6, 10.4, -24);
  const diveControlA = new THREE.Vector3(-4.05, 10.05, -20);
  const diveControlB = new THREE.Vector3(-3.15, 7.45, -13.5);
  const diveEnd = new THREE.Vector3(-2.6, 6.5, -9.8);
  const divePosition = cubicBezierPoint(
    diveStart,
    diveControlA,
    diveControlB,
    diveEnd,
    flightProgress,
  );
  const recoveryProgress = pose.recovery;
  const recoveryPosition = cubicBezierPoint(
    diveEnd,
    new THREE.Vector3(-1.9, 6.55, -7.3),
    new THREE.Vector3(2.8, 9.2, -3.2),
    new THREE.Vector3(7.5, 12.2, 1.4),
    recoveryProgress,
  );
  const attackPosition = divePosition.lerp(recoveryPosition, recoveryProgress);
  // The visual-review cycle continues through a wide, high return arc and
  // meets the next dive at the same point and tangent. The former 3.2-second
  // modulo jumped directly from recoveryEnd to diveStart by ~28 world units.
  const returnProgress = THREE.MathUtils.smoothstep(
    cycleClock,
    3.05,
    PTERODACTYL_ATTACK_CYCLE_SECONDS,
  );
  const returnPosition = cubicBezierPoint(
    new THREE.Vector3(7.5, 12.2, 1.4),
    new THREE.Vector3(9.85, 13.7, 3.7),
    new THREE.Vector3(-5.15, 10.75, -28),
    diveStart,
    returnProgress,
  );
  const authoredPosition = cycleClock > 3.05 ? returnPosition : attackPosition;
  // `playerPosition` remains as a compatibility alias for authored/test
  // callers. The live world passes a position latched once when the attack
  // begins; it must never pass the player's continuously changing position.
  const origin = attackOrigin ?? playerPosition ?? { x: 0, z: 0 };
  return {
    pose,
    approach,
    position: authoredPosition.add(new THREE.Vector3(
      origin.x,
      0,
      origin.z,
    )),
  };
}

function terrainColorAt(x, z, ecology = terrainEcologyAt(x, z)) {
  const drySoil = new THREE.Color(0x756c52);
  const mossSoil = new THREE.Color(0x465943);
  const exposedSoil = new THREE.Color(0x806d53);
  const wetSoil = new THREE.Color(0x304b45);
  const humusSoil = new THREE.Color(0x394334);
  const bryophyteSoil = new THREE.Color(0x3f5439);
  const compactedSoil = new THREE.Color(0x625b49);
  const pointBarSediment = new THREE.Color(0x817963);
  const floodplainSilt = new THREE.Color(0x746b57);
  const cutBankSubsoil = new THREE.Color(0x674c3b);
  const variation = terrainVariation(x, z);
  const wetness = terrainWetness(x, z);
  const slope = terrainSlope(x, z);
  const height = terrainHeight(x, z);
  const exposure = THREE.MathUtils.clamp((height + 2.1) / 5.4, 0, 1);
  const mossWeight = THREE.MathUtils.clamp(
    0.4 + variation * 0.32 + (1 - exposure) * 0.24 - slope * 0.7,
    0.08,
    0.82,
  );
  const exposedWeight = THREE.MathUtils.clamp(exposure * 0.5 + slope * 1.2, 0, 0.62);
  const color = drySoil
    .lerp(mossSoil, mossWeight)
    .lerp(exposedSoil, exposedWeight)
    .lerp(wetSoil, Math.max(wetness * 0.38, ecology.wetBank * 0.58))
    .lerp(humusSoil, ecology.humus * 0.64)
    .lerp(bryophyteSoil, ecology.bryophyte * 0.38)
    .lerp(floodplainSilt, ecology.floodplainSilt * 0.58)
    .lerp(pointBarSediment, ecology.pointBarDeposit * 0.56)
    .lerp(cutBankSubsoil, ecology.cutBankExposure * 0.62)
    .lerp(exposedSoil, ecology.mineralExposure * 0.28)
    .lerp(compactedSoil, ecology.routeWear * 0.32);
  color.offsetHSL(0, 0, variation * 0.025);
  return color;
}

function trackLocalCoordinates(worldX, worldZ) {
  const dx = worldX - TRACK_IMPRESSION.x;
  const dz = worldZ - TRACK_IMPRESSION.z;
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: (cosine * dx - sine * dz) / TRACK_IMPRESSION.scale,
    z: (sine * dx + cosine * dz) / TRACK_IMPRESSION.scale,
  };
}

function trackWorldCoordinates(localX, localZ) {
  const cosine = Math.cos(TRACK_IMPRESSION.rotation);
  const sine = Math.sin(TRACK_IMPRESSION.rotation);
  return {
    x: TRACK_IMPRESSION.x + (cosine * localX + sine * localZ) * TRACK_IMPRESSION.scale,
    z: TRACK_IMPRESSION.z + (-sine * localX + cosine * localZ) * TRACK_IMPRESSION.scale,
  };
}

function trackSubsurfaceClearance(worldX, worldZ) {
  const local = trackLocalCoordinates(worldX, worldZ);
  const radialDistance = Math.hypot(local.x / 1.14, (local.z + 0.4) / 1.52);
  const concealedInterior = 1 - THREE.MathUtils.smoothstep(radialDistance, 0.58, 0.78);
  return -concealedInterior * 0.24;
}

function basaltWeatheringInfluence(worldX, worldZ) {
  const sourcedApron = BASALT_FORMATION_LAYOUT.reduce((strongest, formation) => {
    // Weathered mineral fragments spread downslope toward the playable west
    // side, but stay coupled to their source formation instead of becoming a
    // generic red terrain tint across the basin.
    const apronCentreX = formation.x - 2.4;
    const normalizedX = (worldX - apronCentreX) / 9.2;
    const normalizedZ = (worldZ - formation.z) / 8.4;
    const radialDistance = Math.hypot(normalizedX, normalizedZ);
    const influence = 1 - THREE.MathUtils.smoothstep(radialDistance, 0.24, 1);
    return Math.max(strongest, influence);
  }, 0);
  const escarpmentRelief = THREE.MathUtils.clamp(
    basaltEscarpmentHeight(worldX, worldZ) / 3.15,
    0,
    1,
  );
  const exposedWestFace = 1 - THREE.MathUtils.smoothstep(worldX, 32, 42);
  const connectedCliff = escarpmentRelief * exposedWestFace * 0.8;
  return Math.max(sourcedApron, connectedCliff);
}

const TERRAIN_SURFACE_DETAIL_PROFILE = Object.freeze({
  projection: 'continuous-world-space-triplanar',
  triplanarSharpness: 4,
  coarsePeriodMeters: 47,
  mediumPeriodMeters: 13,
  mediumFadeMeters: Object.freeze([45, 110]),
  finePeriodMeters: 1.282,
  fineFadeMeters: Object.freeze([18, 58]),
  fineInclusionChannels: Object.freeze({
    stone: 'soil-albedo-alpha',
    organic: 'soil-roughness-alpha',
    pore: 'soil-height-alpha',
  }),
  fineInclusionModel: 'habitat-gated-sparse-irregular-stone-organic-and-pore-microstructure',
  maximumFineReliefAmplitudeMeters: 0.0025,
  normalSource: 'projected-meso-height-plus-source-gated-sparse-fine-stone',
  normalReliefAmplitudeMeters: Object.freeze([0.16, 0.21]),
  cavityOcclusionFloor: 0.74,
  cavityLightingScope: 'indirect-diffuse-and-specular-only',
  compactionResponse: 'wet-alluvial-and-route-surfaces-reduce-relief-and-cavity',
  bryophyteResponse: 'living-cover-darkens-albedo-fills-fine-relief-and-retains-high-roughness',
});

function makeTerrain(scene) {
  // Source-coupled transition masks need sub-canopy and trail edges to bend
  // continuously. The older ~1.9 m grid exposed individual interpolation
  // triangles once the fake glade colour wash was removed.
  const widthSegments = 144;
  const heightSegments = 168;
  const geometry = new THREE.PlaneGeometry(180, 210, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const colors = [];
  const wetnesses = [];
  const slopes = [];
  const exposures = [];
  const basaltInfluences = [];
  const bedrockExposures = [];
  const colluviumWeights = [];
  const humusWeights = [];
  const wetBankWeights = [];
  const mineralExposureWeights = [];
  const routeWearWeights = [];
  const alluviumWeights = [];
  const pointBarDepositWeights = [];
  const floodplainSiltWeights = [];
  const cutBankExposureWeights = [];
  const bryophyteWeights = [];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const height = terrainHeight(x, z);
    positions.setZ(i, height + trackSubsurfaceClearance(x, z));
    const ecology = terrainEcologyAt(x, z);
    const color = terrainColorAt(x, z, ecology);
    colors.push(color.r, color.g, color.b);
    wetnesses.push(terrainWetness(x, z));
    exposures.push(THREE.MathUtils.clamp((height + 2.1) / 5.4, 0, 1));
    basaltInfluences.push(basaltWeatheringInfluence(x, z));
    humusWeights.push(ecology.humus);
    wetBankWeights.push(ecology.wetBank);
    mineralExposureWeights.push(ecology.mineralExposure);
    routeWearWeights.push(ecology.routeWear);
    alluviumWeights.push(ecology.alluvium);
    pointBarDepositWeights.push(ecology.pointBarDeposit);
    floodplainSiltWeights.push(ecology.floodplainSilt);
    cutBankExposureWeights.push(ecology.cutBankExposure);
    bryophyteWeights.push(ecology.bryophyte);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('terrainWetness', new THREE.Float32BufferAttribute(wetnesses, 1));
  geometry.setAttribute('terrainExposure', new THREE.Float32BufferAttribute(exposures, 1));
  geometry.setAttribute(
    'terrainBasaltInfluence',
    new THREE.Float32BufferAttribute(basaltInfluences, 1),
  );
  geometry.setAttribute('terrainHumus', new THREE.Float32BufferAttribute(humusWeights, 1));
  geometry.setAttribute('terrainWetBank', new THREE.Float32BufferAttribute(wetBankWeights, 1));
  geometry.setAttribute(
    'terrainMineralExposure',
    new THREE.Float32BufferAttribute(mineralExposureWeights, 1),
  );
  geometry.setAttribute('terrainRouteWear', new THREE.Float32BufferAttribute(routeWearWeights, 1));
  geometry.setAttribute('terrainAlluvium', new THREE.Float32BufferAttribute(alluviumWeights, 1));
  const fluvialSurfaceWeights = [];
  for (let index = 0; index < pointBarDepositWeights.length; index += 1) {
    fluvialSurfaceWeights.push(
      pointBarDepositWeights[index],
      floodplainSiltWeights[index],
      cutBankExposureWeights[index],
      bryophyteWeights[index],
    );
  }
  geometry.setAttribute(
    'terrainFluvialSurface',
    new THREE.Float32BufferAttribute(fluvialSurfaceWeights, 4),
  );
  geometry.userData.trackSubsurfaceClearance = 'concealed-cutaway-under-impression';
  geometry.userData.profile = 'named-process-heightfield-with-brook-glade-and-east-escarpment';
  geometry.userData.widthSegments = widthSegments;
  geometry.userData.heightSegments = heightSegments;
  const summarizeRange = (values) => ({
    minimum: Number(Math.min(...values).toFixed(4)),
    maximum: Number(Math.max(...values).toFixed(4)),
    mean: Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4)),
  });
  geometry.userData.ecology = Object.freeze({
    ...TERRAIN_ECOLOGY_PROFILE,
    ranges: Object.freeze({
      humus: Object.freeze(summarizeRange(humusWeights)),
      wetBank: Object.freeze(summarizeRange(wetBankWeights)),
      mineralExposure: Object.freeze(summarizeRange(mineralExposureWeights)),
      routeWear: Object.freeze(summarizeRange(routeWearWeights)),
      alluvium: Object.freeze(summarizeRange(alluviumWeights)),
      bryophyte: Object.freeze(summarizeRange(bryophyteWeights)),
    }),
    geomorphology: TERRAIN_GEOMORPHOLOGY_PROFILE,
  });
  geometry.userData.fluvialSurface = Object.freeze({
    ...TERRAIN_FLUVIAL_SURFACE_PROFILE,
    ranges: Object.freeze({
      pointBarDeposit: Object.freeze(summarizeRange(pointBarDepositWeights)),
      floodplainSilt: Object.freeze(summarizeRange(floodplainSiltWeights)),
      cutBankExposure: Object.freeze(summarizeRange(cutBankExposureWeights)),
    }),
  });
  geometry.computeVertexNormals();
  const meshNormals = geometry.getAttribute('normal');
  for (let index = 0; index < positions.count; index += 1) {
    // PlaneGeometry is still in its local XY plane here, so local +Z is world
    // up after the pending -90 degree X rotation. Deriving slope from this
    // rendered normal keeps a one-cell cliff from being missed by a much
    // smaller analytic probe at the grid endpoints.
    const up = Math.max(Math.abs(meshNormals.getZ(index)), 1e-5);
    const renderedGradient = Math.hypot(
      meshNormals.getX(index),
      meshNormals.getY(index),
    ) / up;
    const worldX = positions.getX(index);
    const worldZ = -positions.getY(index);
    const surface = eastEscarpmentSurfaceAt(worldX, worldZ, renderedGradient);
    slopes.push(THREE.MathUtils.clamp(renderedGradient / 0.32, 0, 1));
    bedrockExposures.push(surface.bedrockExposure);
    colluviumWeights.push(surface.colluvium);
  }
  geometry.setAttribute('terrainSlope', new THREE.Float32BufferAttribute(slopes, 1));
  geometry.setAttribute(
    'terrainBedrockExposure',
    new THREE.Float32BufferAttribute(bedrockExposures, 1),
  );
  geometry.setAttribute(
    'terrainColluvium',
    new THREE.Float32BufferAttribute(colluviumWeights, 1),
  );
  geometry.userData.surfaceGeology = Object.freeze({
    ...EAST_ESCARPMENT_SURFACE_PROFILE,
    ranges: Object.freeze({
      bedrockExposure: Object.freeze(summarizeRange(bedrockExposures)),
      colluvium: Object.freeze(summarizeRange(colluviumWeights)),
    }),
  });
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainMacroControl = { value: terrainMacroControlTexture };
    shader.uniforms.terrainSoilAlbedo = { value: soilTextures.albedo };
    shader.uniforms.terrainSoilRoughness = { value: soilTextures.roughness };
    shader.uniforms.terrainSoilHeight = { value: soilTextures.height };
    shader.uniforms.terrainBasaltAlbedo = { value: basaltDetailTextures.albedo };
    shader.uniforms.terrainBasaltRoughness = { value: basaltDetailTextures.roughness };
    shader.uniforms.terrainBasaltHeight = { value: basaltDetailTextures.height };
    shader.uniforms.terrainBasaltBase = { value: new THREE.Color(PALETTE.basalt) };
    shader.uniforms.terrainPointBarBase = { value: new THREE.Color(0x817963) };
    shader.uniforms.terrainFloodplainSiltBase = { value: new THREE.Color(0x746b57) };
    shader.uniforms.terrainCutBankBase = { value: new THREE.Color(0x674c3b) };
    shader.uniforms.terrainBryophyteBase = { value: new THREE.Color(0x3f5439) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute float terrainWetness;
        attribute float terrainSlope;
        attribute float terrainExposure;
        attribute float terrainBasaltInfluence;
        attribute float terrainBedrockExposure;
        attribute float terrainColluvium;
        attribute float terrainHumus;
        attribute float terrainWetBank;
        attribute float terrainMineralExposure;
        attribute float terrainRouteWear;
        attribute vec4 terrainFluvialSurface;
        varying vec4 vTerrainClimate;
        varying vec4 vTerrainGeology;
        varying vec4 vTerrainEcology;
        varying vec4 vTerrainFluvial;
        varying vec3 vTerrainWorldPosition;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vTerrainClimate = vec4(
          terrainWetness,
          terrainSlope,
          terrainExposure,
          terrainBasaltInfluence
        );
        vTerrainGeology = vec4(
          terrainBedrockExposure,
          terrainColluvium,
          terrainMineralExposure,
          terrainFluvialSurface.z
        );
        vTerrainEcology = vec4(
          terrainHumus,
          terrainWetBank,
          terrainRouteWear,
          terrainFluvialSurface.x
        );
        vTerrainFluvial = vec4(
          terrainFluvialSurface.y,
          terrainFluvialSurface.w,
          0.0,
          0.0
        );
        vTerrainWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D terrainMacroControl;
        uniform sampler2D terrainSoilAlbedo;
        uniform sampler2D terrainSoilRoughness;
        uniform sampler2D terrainSoilHeight;
        uniform sampler2D terrainBasaltAlbedo;
        uniform sampler2D terrainBasaltRoughness;
        uniform sampler2D terrainBasaltHeight;
        uniform vec3 terrainBasaltBase;
        uniform vec3 terrainPointBarBase;
        uniform vec3 terrainFloodplainSiltBase;
        uniform vec3 terrainCutBankBase;
        uniform vec3 terrainBryophyteBase;
        varying vec4 vTerrainClimate;
        varying vec4 vTerrainGeology;
        varying vec4 vTerrainEcology;
        varying vec4 vTerrainFluvial;
        varying vec3 vTerrainWorldPosition;

        #define vTerrainWetness vTerrainClimate.x
        #define vTerrainSlope vTerrainClimate.y
        #define vTerrainExposure vTerrainClimate.z
        #define vTerrainBasaltInfluence vTerrainClimate.w
        #define vTerrainBedrockExposure vTerrainGeology.x
        #define vTerrainColluvium vTerrainGeology.y
        #define vTerrainMineralExposure vTerrainGeology.z
        #define vTerrainCutBankExposure vTerrainGeology.w
        #define vTerrainHumus vTerrainEcology.x
        #define vTerrainWetBank vTerrainEcology.y
        #define vTerrainRouteWear vTerrainEcology.z
        #define vTerrainPointBarDeposit vTerrainEcology.w
        #define vTerrainFloodplainSilt vTerrainFluvial.x
        #define vTerrainBryophyte vTerrainFluvial.y

        vec3 perturbTerrainSurfaceNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = dFdx(surfacePosition);
          vec3 sigmaY = dFdy(surfacePosition);
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }

        vec4 sampleTerrainProjected(
          sampler2D surfaceMap,
          vec3 surfacePosition,
          vec3 geometricNormal
        ) {
          vec3 projectionWeights = pow(abs(geometricNormal), vec3(4.0));
          projectionWeights /= max(
            projectionWeights.x + projectionWeights.y + projectionWeights.z,
            0.0001
          );
          return texture2D(surfaceMap, surfacePosition.zy) * projectionWeights.x
            + texture2D(surfaceMap, surfacePosition.xz) * projectionWeights.y
            + texture2D(surfaceMap, surfacePosition.xy) * projectionWeights.z;
        }

      `)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 terrainMacroUv = vTerrainWorldPosition.xz * 0.0068 + vec2(0.17, -0.23);
        vec2 terrainMesoUv = mat2(0.819, -0.574, 0.574, 0.819)
          * vTerrainWorldPosition.xz * 0.021;
        vec4 terrainMacroSample = texture2D(terrainMacroControl, terrainMacroUv);
        vec4 terrainMesoSample = texture2D(terrainMacroControl, terrainMesoUv);
        vec3 terrainGeometricWorldNormal = normalize(cross(
          dFdx(vTerrainWorldPosition),
          dFdy(vTerrainWorldPosition)
        ));
        vec3 terrainSoilPositionA = vTerrainWorldPosition * 0.0212766
          + vec3(0.37, 0.11, -0.19);
        vec3 terrainRotatedWorldPosition = vec3(
          vTerrainWorldPosition.x * 0.766 - vTerrainWorldPosition.z * 0.643,
          vTerrainWorldPosition.y,
          vTerrainWorldPosition.x * 0.643 + vTerrainWorldPosition.z * 0.766
        );
        vec3 terrainSoilPositionB = terrainRotatedWorldPosition * 0.0769231
          + vec3(-0.28, 0.23, 0.43);
        float terrainViewDistance = length(cameraPosition - vTerrainWorldPosition);
        float terrainMediumDetailFade = 1.0 - smoothstep(
          45.0,
          110.0,
          terrainViewDistance
        );
        float terrainFineDetailFade = 1.0 - smoothstep(
          18.0,
          58.0,
          terrainViewDistance
        );
        vec2 terrainFineUv = mat2(0.643, -0.766, 0.766, 0.643)
          * vTerrainWorldPosition.xz * 0.78 + vec2(0.31, -0.27);
        vec4 terrainSoilFineAlbedo = texture2D(terrainSoilAlbedo, terrainFineUv);
        vec4 terrainSoilFineRoughness = texture2D(terrainSoilRoughness, terrainFineUv);
        vec4 terrainSoilFineHeight = texture2D(terrainSoilHeight, terrainFineUv);
        vec4 terrainSoilAlbedoA = sampleTerrainProjected(
          terrainSoilAlbedo,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        );
        vec4 terrainSoilAlbedoB = sampleTerrainProjected(
          terrainSoilAlbedo,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        );
        float terrainMediumBlend = 0.52 * terrainMediumDetailFade;
        vec3 terrainSoilMicro = mix(
          terrainSoilAlbedoA.rgb,
          terrainSoilAlbedoB.rgb,
          terrainMediumBlend
        );
        float terrainSoilRoughnessA = sampleTerrainProjected(
          terrainSoilRoughness,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        ).g;
        float terrainSoilRoughnessB = sampleTerrainProjected(
          terrainSoilRoughness,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        ).g;
        float terrainSoilHeightA = sampleTerrainProjected(
          terrainSoilHeight,
          terrainSoilPositionA,
          terrainGeometricWorldNormal
        ).r;
        float terrainSoilHeightB = sampleTerrainProjected(
          terrainSoilHeight,
          terrainSoilPositionB,
          terrainGeometricWorldNormal
        ).r;
        float terrainSoilMicroLuma = dot(
          terrainSoilMicro,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainSoilFineLuma = dot(
          terrainSoilFineAlbedo.rgb,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainMicroRoughnessSample = mix(
          terrainSoilRoughnessA,
          terrainSoilRoughnessB,
          terrainMediumBlend
        );
        float terrainMicroHeightSample = mix(
          terrainSoilHeightA,
          terrainSoilHeightB,
          terrainMediumBlend
        );
        float terrainMicroCavity = smoothstep(
          0.025,
          0.19,
          (terrainSoilHeightA - terrainSoilHeightB) * terrainMediumDetailFade
        );
        vec3 terrainBasaltPosition = vec3(
          vTerrainWorldPosition.x * 0.906 - vTerrainWorldPosition.z * 0.423,
          vTerrainWorldPosition.y,
          vTerrainWorldPosition.x * 0.423 + vTerrainWorldPosition.z * 0.906
        ) * 0.24 + vec3(0.11, -0.17, 0.31);
        vec3 terrainBasaltSample = sampleTerrainProjected(
          terrainBasaltAlbedo,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).rgb;
        float terrainBasaltLuma = dot(
          terrainBasaltSample,
          vec3(0.2126, 0.7152, 0.0722)
        );
        float terrainBasaltRoughnessSample = sampleTerrainProjected(
          terrainBasaltRoughness,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).g;
        float terrainBasaltHeightSample = sampleTerrainProjected(
          terrainBasaltHeight,
          terrainBasaltPosition,
          terrainGeometricWorldNormal
        ).r;
        float broadBreak = terrainMacroSample.r * 2.0 - 1.0;
        float mineralBreak = terrainMesoSample.g * 2.0 - 1.0;
        float gritBreak = terrainMesoSample.b * 2.0 - 1.0;
        float dampPocket = clamp(max(
          vTerrainWetness * (0.72 + terrainMacroSample.g * 0.42),
          vTerrainWetBank * (0.86 + terrainMacroSample.g * 0.16)
        ), 0.0, 1.0);
        float mineralShelf = clamp(max(
          vTerrainSlope * 0.72 + vTerrainExposure * 0.28,
          vTerrainMineralExposure
        ), 0.0, 1.0);
        float retainedHumus = clamp(
          vTerrainHumus * (0.82 + terrainMacroSample.r * 0.24),
          0.0,
          1.0
        );
        float bryophyteTexture = smoothstep(
          0.24,
          0.78,
          terrainMacroSample.r * 0.42
            + terrainMesoSample.g * 0.38
            + terrainMesoSample.b * 0.2
        );
        float establishedBryophyte = clamp(
          vTerrainBryophyte * mix(0.48, 1.0, bryophyteTexture),
          0.0,
          1.0
        );
        float terrainFineStone = smoothstep(
          0.72,
          0.93,
          terrainSoilFineAlbedo.a
        ) * terrainFineDetailFade * clamp(max(
          max(vTerrainMineralExposure * 0.92, vTerrainPointBarDeposit * 0.88),
          max(vTerrainColluvium * 0.68, vTerrainCutBankExposure * 0.46)
        ),
          0.0,
          1.0
        ) * (1.0 - vTerrainRouteWear * 0.34);
        float terrainFineOrganic = smoothstep(
          0.46,
          0.8,
          terrainSoilFineRoughness.a
        ) * terrainFineDetailFade * retainedHumus
          * (1.0 - vTerrainRouteWear * 0.86)
          * (1.0 - mineralShelf * 0.58)
          * (1.0 - vTerrainPointBarDeposit * 0.72);
        float terrainFinePore = smoothstep(
          0.72,
          0.94,
          terrainSoilFineHeight.a
        ) * terrainFineDetailFade * clamp(
          vTerrainCutBankExposure * 0.62
            + vTerrainFloodplainSilt * 0.22
            + retainedHumus * 0.08,
          0.0,
          0.7
        )
          * (1.0 - dampPocket * 0.7)
          * (1.0 - vTerrainFloodplainSilt * 0.74)
          * (1.0 - establishedBryophyte * 0.58);
        terrainMicroCavity *= (1.0 - dampPocket * 0.2)
          * (1.0 - vTerrainPointBarDeposit * 0.14)
          * (1.0 - vTerrainFloodplainSilt * 0.68)
          * (1.0 - vTerrainRouteWear * 0.62)
          * (1.0 - establishedBryophyte * 0.32);
        terrainMicroCavity = clamp(
          terrainMicroCavity * (1.0 + vTerrainCutBankExposure * 0.12),
          0.0,
          1.0
        );
        vec3 drainageResponse = vec3(0.72, 0.86, 0.82);
        vec3 mineralResponse = vec3(1.16, 0.96, 0.79);
        vec3 humusResponse = vec3(0.62, 0.72, 0.57);
        vec3 compactedResponse = vec3(0.9, 0.88, 0.79);
        diffuseColor.rgb *= terrainSoilMicro;
        diffuseColor.rgb *= 0.94 + broadBreak * 0.17 + mineralBreak * 0.075 + gritBreak * 0.035;
        float terrainSoilAggregateContrast = clamp(
          (terrainSoilMicroLuma - 0.39) * 2.45,
          -0.16,
          0.17
        );
        float terrainAggregateVisibility = (
          0.28 + smoothstep(
            0.28,
            0.76,
            terrainMesoSample.b * 0.64 + terrainMacroSample.g * 0.36
          ) * 0.72
        ) * (1.0 - dampPocket * 0.48);
        diffuseColor.rgb *= 1.0
          + terrainSoilAggregateContrast * terrainAggregateVisibility;
        vec3 terrainSoilChromaticity = terrainSoilMicro / max(terrainSoilMicroLuma, 0.08);
        diffuseColor.rgb *= mix(vec3(1.0), terrainSoilChromaticity, 0.11);
        float terrainFineAggregateContrast = clamp(
          (terrainSoilFineLuma - 0.39) * 2.2,
          -0.1,
          0.11
        ) * terrainFineDetailFade * (1.0 - dampPocket * 0.52);
        diffuseColor.rgb *= 1.0 + terrainFineAggregateContrast * 0.42;
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * mineralResponse * 1.035,
          terrainFineStone * 0.24
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * vec3(0.54, 0.58, 0.46),
          terrainFineOrganic * 0.34
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * humusResponse,
          retainedHumus * 0.48
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * drainageResponse,
          dampPocket * 0.46
        );
        vec3 bryophyteSurface = terrainBryophyteBase
          * mix(0.82, 1.1, terrainSoilMicroLuma)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.08);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          bryophyteSurface,
          establishedBryophyte * 0.68
        );
        float pointBarCoarseFraction = clamp(
          terrainMesoSample.b * 0.68 + terrainMacroSample.g * 0.32,
          0.0,
          1.0
        );
        vec3 pointBarSediment = terrainPointBarBase
          * mix(0.82, 1.12, pointBarCoarseFraction)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.13);
        vec3 floodplainSilt = terrainFloodplainSiltBase
          * mix(0.94, 1.05, terrainMacroSample.r)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.08);
        vec3 cutBankSubsoil = terrainCutBankBase
          * mix(0.86, 1.08, terrainSoilMicroLuma)
          * mix(vec3(1.0), terrainSoilChromaticity, 0.1);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          floodplainSilt,
          vTerrainFloodplainSilt * 0.62 * (1.0 - dampPocket * 0.32)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          pointBarSediment,
          vTerrainPointBarDeposit * mix(0.48, 0.7, pointBarCoarseFraction)
            * (1.0 - dampPocket * 0.24)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          cutBankSubsoil,
          vTerrainCutBankExposure * mix(0.54, 0.72, dampPocket)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * mineralResponse,
          mineralShelf * 0.31
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * compactedResponse,
          vTerrainRouteWear * 0.18
        );
        float terrainBasaltBreakup = smoothstep(
          0.32,
          0.7,
          terrainMacroSample.b * 0.46 + terrainMesoSample.r * 0.54
        );
        float terrainWeatheringWeight = clamp(
          vTerrainBasaltInfluence * (0.16 + terrainBasaltBreakup * 0.52)
            + vTerrainBasaltInfluence * vTerrainBasaltInfluence * 0.1,
          0.0,
          0.74
        );
        float terrainBasaltWeight = max(
          terrainWeatheringWeight,
          vTerrainBedrockExposure * mix(0.88, 0.96, terrainBasaltBreakup)
        );
        terrainBasaltWeight = max(
          terrainBasaltWeight,
          vTerrainColluvium * mix(0.32, 0.68, terrainBasaltBreakup)
        );
        terrainBasaltWeight = clamp(terrainBasaltWeight, 0.0, 0.96);
        vec3 terrainBasaltChromaticity = terrainBasaltSample
          / max(terrainBasaltLuma, 0.08);
        vec3 terrainBasaltWeathered = terrainBasaltBase
          * mix(0.7, 1.32, terrainBasaltLuma)
          * mix(vec3(1.0), terrainBasaltChromaticity, 0.16);
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          terrainBasaltWeathered,
          terrainBasaltWeight
        );
        float terrainBedPhaseFine = sin(
          vTerrainWorldPosition.y * 10.833
            + vTerrainWorldPosition.z * 0.055
            + broadBreak * 0.72
        ) * 0.5 + 0.5;
        float terrainBedPhaseBroad = sin(
          vTerrainWorldPosition.y * 3.611
            - vTerrainWorldPosition.z * 0.019
            + mineralBreak * 0.46
        ) * 0.5 + 0.5;
        float terrainBedContact = max(
          smoothstep(0.82, 0.97, terrainBedPhaseFine) * 0.72,
          smoothstep(0.88, 0.985, terrainBedPhaseBroad)
        );
        float exposedStrata = vTerrainBedrockExposure
          * mix(0.52, 1.0, terrainBasaltBreakup);
        diffuseColor.rgb *= 1.0 - terrainBedContact * exposedStrata * 0.11;
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float terrainSurfaceHeight = mix(
          terrainMicroHeightSample,
          terrainBasaltHeightSample,
          terrainBasaltWeight
        ) - terrainBedContact * exposedStrata * 0.065;
        float terrainReliefAmplitudeMeters = mix(
          0.16,
          0.21,
          max(mineralShelf, terrainBasaltWeight)
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.13,
          vTerrainPointBarDeposit
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.045,
          vTerrainFloodplainSilt
        );
        terrainReliefAmplitudeMeters = mix(
          terrainReliefAmplitudeMeters,
          0.11,
          vTerrainCutBankExposure
        );
        float terrainSurfaceHeightMeters = terrainSurfaceHeight
          * terrainReliefAmplitudeMeters
          + terrainFineStone * 0.0025;
        vec2 terrainSurfaceGradient = vec2(
          dFdx(terrainSurfaceHeightMeters),
          dFdy(terrainSurfaceHeightMeters)
        )
          * (1.0 - dampPocket * 0.38)
          * (1.0 - vTerrainRouteWear * 0.32)
          * (1.0 - establishedBryophyte * 0.3)
          * mix(1.0, 0.58, vTerrainBedrockExposure)
          * (1.0 + vTerrainMineralExposure * 0.16);
        normal = perturbTerrainSurfaceNormal(
          -vViewPosition,
          normal,
          terrainSurfaceGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          terrainMicroRoughnessSample - vTerrainWetness * 0.14 + vTerrainSlope * 0.035
            + (terrainMesoSample.b - 0.5) * 0.055,
          0.68,
          0.99
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainMicroRoughnessSample,
          0.48
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainSoilFineRoughness.g,
          terrainFineDetailFade * 0.18 * (1.0 - dampPocket * 0.38)
        );
        roughnessFactor = mix(
          roughnessFactor,
          terrainBasaltRoughnessSample,
          terrainBasaltWeight * 0.76
        );
        roughnessFactor = mix(roughnessFactor, 0.965, retainedHumus * 0.42);
        roughnessFactor = mix(roughnessFactor, 0.975, establishedBryophyte * 0.58);
        roughnessFactor = mix(roughnessFactor, 0.925, vTerrainPointBarDeposit * 0.54);
        roughnessFactor = mix(roughnessFactor, 0.985, vTerrainFloodplainSilt * 0.66);
        roughnessFactor = mix(
          roughnessFactor,
          mix(0.95, 0.79, dampPocket),
          vTerrainCutBankExposure * 0.62
        );
        roughnessFactor = mix(roughnessFactor, 0.76, vTerrainWetBank * 0.52);
        roughnessFactor = mix(roughnessFactor, 0.985, vTerrainMineralExposure * 0.38);
        roughnessFactor = mix(roughnessFactor, 0.91, vTerrainRouteWear * 0.34);
        roughnessFactor = mix(roughnessFactor, 0.9, terrainFineStone * 0.3);
        roughnessFactor = mix(roughnessFactor, 0.985, terrainFineOrganic * 0.46);
        roughnessFactor = clamp(roughnessFactor, 0.7, 0.99);
      `)
      .replace('#include <aomap_fragment>', `
        #include <aomap_fragment>
        float terrainCombinedCavity = clamp(max(
          terrainMicroCavity,
          terrainFinePore * 0.05 + terrainFineOrganic * 0.035
        ), 0.0, 1.0);
        float terrainCavityOcclusion = mix(1.0, 0.74, terrainCombinedCavity);
        reflectedLight.indirectDiffuse *= terrainCavityOcclusion;
        reflectedLight.indirectSpecular *= mix(1.0, 0.86, terrainCombinedCavity);
      `);
  };
  material.customProgramCacheKey = () => 'terrain-ecological-geological-micro-surface-v13';
  material.userData.surface = 'source-coupled-ecological-soil-and-basalt-weathering';
  material.userData.layers = Object.freeze([
    'navigation-exterior-basalt-escarpment-relief',
    'vertex-drainage-zone',
    'vertex-slope-mineral-zone',
    'world-space-broad-breakup',
    'rotated-mesoscale-grit',
    'distance-faded-projected-correlated-soil-albedo-roughness-relief',
    'near-field-habitat-gated-stone-organic-pore-inclusions',
    'sub-grid-cavity-indirect-occlusion',
    'canopy-and-hollow-retained-humus',
    'canopy-shade-moisture-and-stability-bryophyte-cover',
    'brook-hydrology-saturated-bank',
    'slope-and-exposure-mineral-washout',
    'route-footfall-litter-suppression-and-compaction',
    'inner-bend-point-bar-coarse-sand-and-fine-gravel',
    'low-energy-overbank-floodplain-silt',
    'outer-bend-cohesive-cut-bank-exposure',
    'angle-of-repose-bedrock-exposure',
    'source-coupled-cliff-toe-colluvium',
    'formation-sourced-basalt-weathering-apron',
  ]);
  material.userData.ecology = geometry.userData.ecology;
  material.userData.bryophyte = TERRAIN_BRYOPHYTE_PROFILE;
  material.userData.fluvialSurface = geometry.userData.fluvialSurface;
  material.userData.routeSurface = TERRAIN_ROUTE_SURFACE_PROFILE;
  material.userData.surfaceDetail = TERRAIN_SURFACE_DETAIL_PROFILE;
  material.userData.macroControl = terrainMacroControlTexture;
  material.userData.microTextures = Object.freeze({
    albedo: soilTextures.albedo,
    roughness: soilTextures.roughness,
    height: soilTextures.height,
  });
  material.userData.basaltWeatheringTextures = Object.freeze({
    albedo: basaltDetailTextures.albedo,
    roughness: basaltDetailTextures.roughness,
    height: basaltDetailTextures.height,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'world.connected_route.terrain';
  scene.add(mesh);
  return mesh;
}

function makeHydrologicalRibbon(points, width, color, hydrology) {
  const vertices = [];
  const colors = [];
  const uvs = [];
  const flowDirections = [];
  const flowEnergies = [];
  const waterDepthMeters = [];
  const indices = [];
  const longitudinalSubdivisions = BROOK_FREE_SURFACE_PROFILE.longitudinalSubdivisions;
  const crossSectionVertices = BROOK_FREE_SURFACE_PROFILE.crossSectionVertices;
  const longitudinalRows = (points.length - 1) * longitudinalSubdivisions + 1;
  const current = new THREE.Vector3();
  const tangentStart = new THREE.Vector3();
  const tangentEnd = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let row = 0; row < longitudinalRows; row += 1) {
    const sourcePosition = row / longitudinalSubdivisions;
    const segment = Math.min(points.length - 2, Math.floor(sourcePosition));
    const interpolation = row === longitudinalRows - 1 ? 1 : sourcePosition - segment;
    current.lerpVectors(points[segment], points[segment + 1], interpolation);
    tangentStart.subVectors(
      points[Math.min(points.length - 1, segment + 1)],
      points[Math.max(0, segment - 1)],
    );
    tangentEnd.subVectors(
      points[Math.min(points.length - 1, segment + 2)],
      points[segment],
    );
    tangent.lerpVectors(tangentStart, tangentEnd, interpolation);
    const dx = tangent.x;
    const dz = tangent.z;
    const length = Math.hypot(dx, dz) || 1;
    const px = -dz / length;
    const pz = dx / length;
    const widthBreak = 0.9
      + Math.sin(sourcePosition * 1.71 + points.length * 0.13) * 0.08
      + Math.sin(sourcePosition * 0.63 + 1.4) * 0.045;
    const half = width * widthBreak * 0.5;
    const progress = row / (longitudinalRows - 1);
    const waterLevel = THREE.MathUtils.lerp(
      hydrology.waterLevels[segment],
      hydrology.waterLevels[segment + 1],
      interpolation,
    );
    const flowDirection = THREE.MathUtils.lerp(
      hydrology.flowDirections[segment],
      hydrology.flowDirections[segment + 1],
      interpolation,
    );
    const flowEnergy = THREE.MathUtils.lerp(
      hydrology.flowEnergies[segment],
      hydrology.flowEnergies[segment + 1],
      interpolation,
    );
    for (let crossIndex = 0; crossIndex < crossSectionVertices; crossIndex += 1) {
      const crossProgress = crossIndex / (crossSectionVertices - 1);
      const normalizedOffset = THREE.MathUtils.lerp(1.08, -1.08, crossProgress);
      const offset = half * normalizedOffset;
      const x = current.x + px * offset;
      const z = current.z + pz * offset;
      const alpha = 1 - THREE.MathUtils.smoothstep(Math.abs(normalizedOffset), 0.82, 1.08);
      vertices.push(x, waterLevel, z);
      colors.push(1, 1, 1, alpha);
      uvs.push(crossProgress, progress);
      flowDirections.push(flowDirection);
      flowEnergies.push(flowEnergy);
      waterDepthMeters.push(Math.max(0, waterLevel - terrainHeight(x, z)));
    }
    if (row < longitudinalRows - 1) {
      const currentOffset = row * crossSectionVertices;
      const nextOffset = (row + 1) * crossSectionVertices;
      for (let band = 0; band < crossSectionVertices - 1; band += 1) {
        const a = currentOffset + band;
        const b = currentOffset + band + 1;
        const c = nextOffset + band;
        const d = nextOffset + band + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('flowDirection', new THREE.Float32BufferAttribute(flowDirections, 1));
  geometry.setAttribute('flowEnergy', new THREE.Float32BufferAttribute(flowEnergies, 1));
  geometry.setAttribute(
    'waterDepthMeters',
    new THREE.Float32BufferAttribute(waterDepthMeters, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.yOffset = BROOK_HYDROLOGY_PROFILE.waterClearanceMeters;
  geometry.userData.profile = 'tessellated-gravity-level-twin-headwater-free-surface';
  geometry.userData.crossSectionVertices = crossSectionVertices;
  geometry.userData.longitudinalSubdivisions = longitudinalSubdivisions;
  geometry.userData.longitudinalRows = longitudinalRows;
  geometry.userData.baseTriangleCount = indices.length / 3;
  geometry.userData.crossChannelGrade = hydrology.crossChannelGrade;
  geometry.userData.hydrologyVersion = hydrology.profile.version;
  geometry.userData.waterColumnSource = 'water-level-minus-shared-terrain-heightfield';
  geometry.userData.waterDepthRangeMeters = Object.freeze([
    Number(Math.min(...waterDepthMeters).toFixed(4)),
    Number(Math.max(...waterDepthMeters).toFixed(4)),
  ]);
  geometry.userData.freeSurface = Object.freeze({
    version: BROOK_FREE_SURFACE_PROFILE.version,
    model: BROOK_FREE_SURFACE_PROFILE.model,
    grid: Object.freeze([longitudinalSubdivisions, crossSectionVertices]),
    longitudinalRows,
    vertexCount: vertices.length / 3,
    triangleCount: indices.length / 3,
    displacementRangeMeters: Object.freeze([
      -BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters,
      BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters,
    ]),
    maximumUpstreamCompressionMeters:
      BROOK_FREE_SURFACE_PROFILE.maximumUpstreamCompressionMeters,
    maximumSideDrawdownMeters: BROOK_FREE_SURFACE_PROFILE.maximumSideDrawdownMeters,
    maximumWakeAmplitudeMeters: BROOK_FREE_SURFACE_PROFILE.maximumWakeAmplitudeMeters,
    volumeContract: BROOK_FREE_SURFACE_PROFILE.volumeContract,
    evidenceBoundary: BROOK_FREE_SURFACE_PROFILE.evidenceBoundary,
  });
  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ribbon.receiveShadow = true;
  return ribbon;
}

function smoothPath(points, divisionsPerSpan = 7) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  return curve.getSpacedPoints(Math.max(12, (points.length - 1) * divisionsPerSpan));
}

function createDeadwoodSegmentGeometry(
  start,
  end,
  startRadius,
  endRadius,
  {
    seed,
    ringCount = 7,
    radialSegments = 12,
    brokenEnd = true,
  },
) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const axis = to.clone().sub(from);
  const length = axis.length();
  const tangent = axis.clone().normalize();
  const reference = Math.abs(tangent.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const radialA = new THREE.Vector3().crossVectors(tangent, reference).normalize();
  const radialB = new THREE.Vector3().crossVectors(tangent, radialA).normalize();
  const random = seededRandom(seed);
  const bowA = (random() - 0.5) * Math.min(length * 0.035, startRadius * 0.65);
  const bowB = (random() - 0.5) * Math.min(length * 0.025, startRadius * 0.48);
  const phase = random() * Math.PI * 2;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const ringOffsets = [];
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();

  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1);
    centre.lerpVectors(from, to, t);
    const bend = Math.sin(t * Math.PI);
    centre.addScaledVector(radialA, bowA * bend);
    centre.addScaledVector(radialB, bowB * bend);
    centre.y -= bend * Math.min(0.035, length * 0.012);
    const nominalRadius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    ringOffsets.push(vertices.length / 3);
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2;
      const furrow = Math.sin(angle * 3 + phase + t * 2.7) * 0.045
        + Math.sin(angle * 7 - phase * 0.7 + t * 5.1) * 0.022;
      const radius = nominalRadius * (1 + furrow);
      const fractureAdvance = brokenEnd && ring === ringCount - 1
        ? endRadius * (0.08 + (Math.sin(angle * 2.5 + phase) * 0.5 + 0.5) * 0.48)
        : 0;
      point.copy(centre)
        .addScaledVector(tangent, fractureAdvance)
        .addScaledVector(radialA, Math.cos(angle) * radius)
        .addScaledVector(radialB, Math.sin(angle) * radius);
      vertices.push(point.x, point.y, point.z);
      const barkShade = THREE.MathUtils.clamp(
        0.86
          + Math.sin(angle * 5.2 + t * 13.7 + phase) * 0.075
          + Math.sin(t * 31.1 - angle * 1.8) * 0.035,
        0.72,
        0.98,
      );
      colors.push(0.82 * barkShade, 0.76 * barkShade, 0.64 * barkShade);
      uvs.push(side / radialSegments, t * length * 1.8);
    }
  }

  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    const current = ringOffsets[ring];
    const nextRing = ringOffsets[ring + 1];
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      indices.push(
        current + side,
        current + next,
        nextRing + side,
        current + next,
        nextRing + next,
        nextRing + side,
      );
    }
  }

  const addEndGrain = (ringIndex, reverse) => {
    const sourceOffset = ringOffsets[ringIndex];
    const capOffset = vertices.length / 3;
    const capCentre = new THREE.Vector3();
    for (let side = 0; side < radialSegments; side += 1) {
      const sourceIndex = (sourceOffset + side) * 3;
      point.set(vertices[sourceIndex], vertices[sourceIndex + 1], vertices[sourceIndex + 2]);
      capCentre.add(point);
      vertices.push(point.x, point.y, point.z);
      const grain = 0.86 + Math.sin(side * 2.3 + phase) * 0.08;
      colors.push(0.74 * grain, 0.53 * grain, 0.32 * grain);
      const angle = (side / radialSegments) * Math.PI * 2;
      uvs.push(0.5 + Math.cos(angle) * 0.46, 0.5 + Math.sin(angle) * 0.46);
    }
    capCentre.multiplyScalar(1 / radialSegments);
    const centreIndex = vertices.length / 3;
    vertices.push(capCentre.x, capCentre.y, capCentre.z);
    colors.push(0.71, 0.49, 0.28);
    uvs.push(0.5, 0.5);
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      if (reverse) indices.push(centreIndex, capOffset + next, capOffset + side);
      else indices.push(centreIndex, capOffset + side, capOffset + next);
    }
  };
  addEndGrain(0, true);
  addEndGrain(ringCount - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createDriftwoodGeometry(variant = 0) {
  const layouts = [
    [
      [[-1.35, 0, 0], [1.3, 0.08, 0.12], 0.17, 0.105],
      [[-0.42, 0.025, 0], [-0.86, 0.44, -0.28], 0.085, 0.026],
      [[0.18, 0.05, 0.04], [0.66, 0.5, 0.36], 0.095, 0.03],
      [[0.82, 0.07, 0.08], [1.08, 0.34, -0.24], 0.065, 0.022],
    ],
    [
      [[-1.18, 0.03, -0.08], [1.42, 0.13, -0.02], 0.145, 0.08],
      [[-0.68, 0.05, -0.05], [-0.28, 0.58, 0.24], 0.075, 0.022],
      [[0.46, 0.1, -0.02], [0.92, 0.36, -0.42], 0.082, 0.025],
    ],
    [
      [[-1.46, 0.02, 0.08], [1.16, 0.18, -0.16], 0.19, 0.115],
      [[-0.88, 0.06, 0.03], [-1.18, 0.31, 0.43], 0.09, 0.028],
      [[-0.08, 0.1, -0.02], [0.18, 0.63, -0.18], 0.11, 0.035],
      [[0.62, 0.15, -0.1], [0.94, 0.47, 0.22], 0.072, 0.024],
    ],
  ];
  const layout = layouts[variant % layouts.length];
  const parts = layout.map(([start, end, startRadius, endRadius], segmentIndex) => (
    createDeadwoodSegmentGeometry(start, end, startRadius, endRadius, {
      seed: 11_717 + variant * 331 + segmentIndex * 47,
    })
  ));
  const addSplinter = (start, end, radius, index) => {
    parts.push(createDeadwoodSegmentGeometry(start, end, radius, radius * 0.08, {
      seed: 14_119 + variant * 503 + index * 71,
      ringCount: 4,
      radialSegments: 6,
      brokenEnd: false,
    }));
  };
  layout.forEach(([start, end, , endRadius], segmentIndex) => {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const tangent = to.clone().sub(from).normalize();
    const side = new THREE.Vector3().crossVectors(
      tangent,
      Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0),
    ).normalize();
    const splitStart = to.clone().addScaledVector(tangent, -endRadius * 0.32);
    const splitEnd = to.clone()
      .addScaledVector(tangent, endRadius * (0.72 + (segmentIndex % 2) * 0.22))
      .addScaledVector(side, endRadius * (segmentIndex % 2 ? -0.36 : 0.34));
    addSplinter(splitStart.toArray(), splitEnd.toArray(), endRadius * 0.24, segmentIndex);
  });
  const [mainStart, mainEnd, mainStartRadius] = layout[0];
  const mainFrom = new THREE.Vector3(...mainStart);
  const mainTo = new THREE.Vector3(...mainEnd);
  const reverseTangent = mainFrom.clone().sub(mainTo).normalize();
  addSplinter(
    mainFrom.clone().addScaledVector(reverseTangent, -mainStartRadius * 0.18).toArray(),
    mainFrom.clone().addScaledVector(reverseTangent, mainStartRadius * 0.72).toArray(),
    mainStartRadius * 0.2,
    layout.length,
  );
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute('position');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const supportPoints = [];
  const minimumY = geometry.boundingBox.min.y;
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > minimumY + 0.024) continue;
    supportPoints.push(Object.freeze([
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    ]));
  }
  geometry.userData.profile = 'closed-curved-branched-deadwood-with-jagged-fibre-breaks';
  geometry.userData.variant = `weathered-load-path-${variant + 1}`;
  geometry.userData.surface = 'mapped-furrowed-bark-with-distinct-end-grain-and-splinters';
  geometry.userData.closedSegmentCount = parts.length;
  geometry.userData.primaryBranchCount = layout.length - 1;
  geometry.userData.splinterCount = layout.length + 1;
  geometry.userData.triangleCount = geometry.index.count / 3;
  geometry.userData.supportPoints = Object.freeze(supportPoints);
  geometry.userData.supportModel = 'gravity-settled-tangent-aligned-multipoint-deadfall';
  geometry.userData.loadPath = 'closed-overlapping-trunk-to-branch-volumes-with-tapered-fibre-breaks';
  return geometry;
}

function createDeadwoodMaterial({ wet = false } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: wet ? 0.9 : 0.96,
    roughnessMap: barkTextures.roughness,
    map: barkTextures.albedo,
    bumpMap: barkTextures.height,
    bumpScale: wet ? 0.016 : 0.024,
    metalness: 0,
    flatShading: false,
    envMapIntensity: wet ? 0.12 : 0.08,
    dithering: true,
  });
  material.emissive.set(0x000000);
  material.emissiveIntensity = 0;
  material.userData = {
    surface: wet
      ? 'water-darkened-furrowed-bark-and-broken-end-grain'
      : 'dry-weathered-furrowed-bark-and-broken-end-grain',
    energyModel: 'opaque-non-emissive-dielectric-weathered-wood',
    moistureClass: wet ? 'brook-bank-wet' : 'forest-floor-dry-to-damp',
    textureChannels: Object.freeze({
      albedo: barkTextures.albedo.name,
      roughness: barkTextures.roughness.name,
      height: barkTextures.height.name,
    }),
  };
  return material;
}

function distanceToTaperedTrackSegment(
  x,
  z,
  startX,
  startZ,
  endX,
  endZ,
  baseRadius,
  tipRadius,
) {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const projection = THREE.MathUtils.clamp(
    ((x - startX) * segmentX + (z - startZ) * segmentZ) / lengthSquared,
    0,
    1,
  );
  const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, projection);
  return Math.hypot(
    x - (startX + segmentX * projection),
    z - (startZ + segmentZ * projection),
  ) - radius;
}

function trackImpressionFields(x, z) {
  const pad = (Math.hypot((x - 0.045) / 0.35, (z - 0.11) / 0.27) - 1) * 0.27;
  const metatarsalBridge = (Math.hypot((x + 0.025) / 0.43, (z + 0.19) / 0.36) - 1) * 0.34;
  const centreToe = distanceToTaperedTrackSegment(
    x, z, 0.015, -0.14, -0.055, -1.42, 0.22, 0.125,
  );
  const leftToe = distanceToTaperedTrackSegment(
    x, z, -0.105, -0.11, -0.74, -0.99, 0.215, 0.135,
  );
  const rightToe = distanceToTaperedTrackSegment(
    x, z, 0.11, -0.1, 0.64, -0.86, 0.205, 0.145,
  );
  return {
    pad,
    bridge: metatarsalBridge,
    centreToe,
    leftToe,
    rightToe,
  };
}

function trackImpressionDistance(x, z) {
  return Math.min(...Object.values(trackImpressionFields(x, z)));
}

function trackPressureAt(x, z) {
  const spots = [
    [0, -1.35, 0.22, 1],
    [-0.67, -0.9, 0.24, 0.78],
    [0.67, -0.9, 0.24, 0.78],
    [0, 0.12, 0.34, 0.52],
  ];
  return THREE.MathUtils.clamp(spots.reduce((total, [spotX, spotZ, spread, weight]) => {
    const distanceSquared = (x - spotX) ** 2 + (z - spotZ) ** 2;
    return total + Math.exp(-distanceSquared / (spread * spread)) * weight;
  }, 0), 0, 1);
}

function createTrackMudImpressionGeometry() {
  const radialRings = 32;
  const segments = 96;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const pressedMud = new THREE.Color(0x07191a);
  const compressedRim = new THREE.Color(0xb29c6c);
  const standingWater = new THREE.Color(0x4c6964);

  function writeVertex(localX, localZ, normalizedRadius) {
    const world = trackWorldCoordinates(localX, localZ);
    const fields = trackImpressionFields(localX, localZ);
    const edgeNoise = Math.sin(localX * 19.4 + localZ * 11.7) * 0.009
      + Math.sin(localX * 8.2 - localZ * 23.1) * 0.006;
    const distance = Math.min(...Object.values(fields)) + edgeNoise;
    const inside = 1 - THREE.MathUtils.smoothstep(distance, -0.025, 0.065);
    const compression = (field) => 1 - THREE.MathUtils.smoothstep(field, -0.02, 0.055);
    const centreCompression = compression(fields.centreToe);
    const leftCompression = compression(fields.leftToe) * 0.86;
    const rightCompression = compression(fields.rightToe) * 0.7;
    const toeCompression = Math.max(centreCompression, leftCompression, rightCompression);
    const padCompression = Math.max(compression(fields.pad), compression(fields.bridge) * 0.72);
    const rawRim = Math.exp(-((distance / 0.03) ** 2));
    const collapsedEdge = THREE.MathUtils.clamp(
      0.68
        + Math.sin(localX * 13.8 - localZ * 8.5) * 0.24
        - Math.exp(-(((localX - 0.53) / 0.2) ** 2 + ((localZ + 0.69) / 0.24) ** 2)) * 0.52,
      0.12,
      1,
    );
    const rim = rawRim * collapsedEdge;
    const pressure = trackPressureAt(localX, localZ);
    const depression = inside * 0.018
      + padCompression * 0.018
      + centreCompression * (0.037 + pressure * 0.03)
      + leftCompression * 0.019
      + rightCompression * 0.012;
    const rimLift = rim * 0.015;
    const mottle = Math.sin(localX * 9.3 + localZ * 6.7) * 0.0015
      * (1 - normalizedRadius);
    vertices.push(
      world.x,
      terrainHeight(world.x, world.z) + 0.012 - depression + rimLift + mottle,
      world.z,
    );

    const wetCompression = THREE.MathUtils.clamp(
      inside * 0.4 + padCompression * 0.28 + toeCompression * 0.78,
      0,
      0.96,
    );
    const color = terrainColorAt(world.x, world.z).lerp(pressedMud, wetCompression);
    const puddle = THREE.MathUtils.clamp(
      Math.exp(-(((localX + 0.12) / 0.28) ** 2 + ((localZ + 0.46) / 0.46) ** 2))
        * inside * (0.35 + pressure * 0.5),
      0,
      0.38,
    );
    color.lerp(standingWater, puddle);
    color.lerp(compressedRim, rim * 0.58);
    color.offsetHSL(0, 0, Math.sin(localX * 7.1 - localZ * 8.3) * 0.008);
    // Only disturbed mud is allowed to replace the terrain surface. The old
    // radial alpha kept the entire carrier ellipse opaque, which rendered as a
    // pale circular "spotlight" around an otherwise physical print. Couple
    // coverage to pressure, displaced rim and standing water instead; the
    // outer radial fade is now only a safety feather at the mesh boundary.
    const radialFeather = 1 - THREE.MathUtils.smoothstep(normalizedRadius, 0.82, 1);
    const disturbanceCoverage = THREE.MathUtils.clamp(Math.max(
      inside * 0.96,
      rim,
      wetCompression * 0.9,
      puddle * 0.92,
    ), 0, 1);
    const alpha = radialFeather * disturbanceCoverage;
    colors.push(color.r, color.g, color.b, alpha);
    uvs.push(localX / 2.4 + 0.5, (localZ + 0.4) / 3.1 + 0.5);
  }

  writeVertex(0, -0.4, 0);
  for (let ring = 1; ring <= radialRings; ring += 1) {
    const normalizedRadius = ring / radialRings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const irregularity = 1 + (
        Math.sin(angle * 5 + 0.8) * 0.025
        + Math.sin(angle * 9 - 0.35) * 0.014
      ) * normalizedRadius;
      writeVertex(
        Math.cos(angle) * 1.14 * normalizedRadius * irregularity,
        -0.4 + Math.sin(angle) * 1.52 * normalizedRadius * irregularity,
        normalizedRadius,
      );
    }
  }

  const ringIndex = (ring, segment) => 1 + (ring - 1) * segments + ((segment + segments) % segments);
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, ringIndex(1, segment + 1), ringIndex(1, segment));
  }
  for (let ring = 1; ring < radialRings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const inner = ringIndex(ring, segment);
      const innerNext = ringIndex(ring, segment + 1);
      const outer = ringIndex(ring + 1, segment);
      const outerNext = ringIndex(ring + 1, segment + 1);
      indices.push(inner, innerNext, outer, innerNext, outerNext, outer);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'deformed-tridactyl-mud-impression';
  geometry.userData.toeCount = 3;
  geometry.userData.longestToe = 'centre';
  geometry.userData.tipProfile = 'rounded-pressure-spread';
  geometry.userData.edgeProfile = 'asymmetric-collapsed-wet-mud';
  geometry.userData.softEdge = true;
  geometry.userData.toeTipDepthVariation = true;
  geometry.userData.physicalRelief = true;
  geometry.userData.terrainCutaway = true;
  geometry.userData.edgeAlpha = true;
  geometry.userData.coverageModel = 'pressure-rim-and-standing-water-only';
  geometry.userData.reliefDepthMeters = 0.104;
  return geometry;
}

function makeThreeToedTrack(scene) {
  const group = new THREE.Group();
  const trackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.86,
    roughnessMap: soilTextures.roughness,
    bumpMap: soilTextures.height,
    bumpScale: 0.006,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.54,
    flatShading: false,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const impression = primitive(
    trackMaterial,
    createTrackMudImpressionGeometry(),
    [0, 0, 0],
    [1, 1, 1],
  );
  impression.name = 'world.track.deformed-three-toed-impression';
  impression.userData.contactShape = 'terrain-deformed-tridactyl-print';
  impression.castShadow = false;
  impression.receiveShadow = true;
  impression.renderOrder = 1;
  group.add(impression);
  const clodCount = 13;
  const clods = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x3b4234, roughness: 0.98, flatShading: true }),
    clodCount,
  );
  const clodLocalAnchors = [
    [-0.48, 0.18], [0.46, 0.22], [-0.62, -0.28], [0.57, -0.34],
    [-0.86, -0.72], [-0.52, -1.03], [-0.18, -1.48], [0.2, -1.37],
    [0.56, -0.93], [0.74, -0.66], [-0.28, 0.42], [0.17, 0.4], [0.72, -0.12],
  ];
  const clodRandom = seededRandom(2057);
  const clodDummy = new THREE.Object3D();
  clodLocalAnchors.forEach(([localX, localZ], index) => {
    const world = trackWorldCoordinates(
      localX + (clodRandom() - 0.5) * 0.1,
      localZ + (clodRandom() - 0.5) * 0.1,
    );
    const scale = 0.065 + clodRandom() * 0.095;
    clodDummy.position.set(world.x, terrainHeight(world.x, world.z) + scale * 0.28, world.z);
    clodDummy.rotation.set(clodRandom() * 0.8, clodRandom() * Math.PI, clodRandom() * 0.45);
    clodDummy.scale.set(scale * (1.05 + clodRandom() * 0.7), scale * 0.42, scale);
    clodDummy.updateMatrix();
    clods.setMatrixAt(index, clodDummy.matrix);
  });
  clods.name = 'world.track.displaced-mud-clods';
  clods.castShadow = true;
  clods.receiveShadow = true;
  clods.userData.profile = 'irregular-perimeter-displacement';
  group.add(clods);
  // Keep the print inside the opening field of view without turning it into a
  // UI-sized emblem. Its asymmetric toe pressure must carry the first read.
  group.userData.worldAnchor = {
    x: TRACK_IMPRESSION.x,
    z: TRACK_IMPRESSION.z,
    rotation: TRACK_IMPRESSION.rotation,
    scale: TRACK_IMPRESSION.scale,
  };
  group.name = 'world.connected_route.three-toed-track';
  group.userData.firstRead = 'three-toed-print';
  group.userData.openingSightline = true;
  scene.add(group);
  return group;
}

function makeRouteAndBrook(scene) {
  const brookControlPoints = BROOK_CONTROL_POINTS
    .map(([x, z]) => new THREE.Vector3(x, 0, z));
  const brookPoints = smoothPath(brookControlPoints, 8);
  const brookHydrology = buildBrookHydrology(brookPoints, terrainHeight, { width: 3.4 });
  // Wetness, point-bar deposition, floodplain silt and cut-bank exposure are
  // already attributes of the rendered/collidable terrain. The former three
  // transparent ribbons sat 7-9.5 cm above that surface and made a second,
  // visually uniform bank. Retain named zero-draw anchors for inspection while
  // the shared heightfield owns all visible bank material and contact.
  const makeBankAnchor = (name, side) => {
    const anchor = new THREE.Group();
    anchor.name = name;
    anchor.userData = {
      ...TERRAIN_FLUVIAL_SURFACE_PROFILE,
      side,
      surface: 'terrain-integrated-fluvial-bank-transition',
    };
    return anchor;
  };
  const brookBank = makeBankAnchor('world.connected_route.brook-wet-bank', 'both');
  const brook = makeHydrologicalRibbon(
    brookPoints,
    3.4,
    PALETTE.water,
    brookHydrology,
  );
  brook.material.dispose();
  brook.material = createBrookMaterial(waterTextures, soilTextures);
  brook.material.userData.optics = Object.freeze({
    waterColumnSource: brook.geometry.userData.waterColumnSource,
    waterDepthRangeMeters: brook.geometry.userData.waterDepthRangeMeters,
    indexOfRefraction: 1.333,
    normalIncidenceReflectance: 0.02037,
    absorptionCoefficientPerMeter: Object.freeze([0.72, 0.22, 0.13]),
    roughnessRange: Object.freeze([0.11, 0.34]),
    aerationSource:
      'local-downstream-grade-bank-contact-and-rendered-clast-downstream-wakes',
    staticOverlayRipples: 0,
    reflectionProfile: BROOK_REFLECTION_PROFILE.version,
    screenSpaceReflectionModel: BROOK_REFLECTION_PROFILE.model,
    screenSpaceReflectionRangeMeters: BROOK_REFLECTION_PROFILE.maximumRangeMeters,
    screenSpaceReflectionStepsByQuality: BROOK_REFLECTION_PROFILE.stepsByQuality,
    screenSpaceReflectionFallback: BROOK_REFLECTION_PROFILE.fallback,
    reflectionEvidenceBoundary: BROOK_REFLECTION_PROFILE.evidenceBoundary,
    obstacleFlowProfile: BROOK_OBSTACLE_FLOW_PROFILE.version,
    obstacleFlowEvidenceBoundary: BROOK_OBSTACLE_FLOW_PROFILE.evidenceBoundary,
    freeSurfaceProfile: BROOK_FREE_SURFACE_PROFILE.version,
    freeSurfaceGrid: brook.geometry.userData.freeSurface.grid,
    freeSurfaceDisplacementRangeMeters:
      brook.geometry.userData.freeSurface.displacementRangeMeters,
    freeSurfaceEvidenceBoundary: BROOK_FREE_SURFACE_PROFILE.evidenceBoundary,
    hydraulicEvidenceBoundary:
      'bounded-local-free-surface-does-not-claim-discharge-cfd-volume-proof-or-exact-wave-spectrum',
  });
  brook.name = 'world.connected_route.brook';
  const leftWetEdge = makeBankAnchor('world.connected_route.brook-left-wet-edge', 'left');
  const rightWetEdge = makeBankAnchor('world.connected_route.brook-right-wet-edge', 'right');
  scene.add(brookBank, leftWetEdge, rightWetEdge, brook);

  // The former 48 static torus arcs were screen dressing rather than water
  // motion: they neither advected nor responded to depth, grade or obstacles.
  // Keep a named zero-draw group for the quality/capture plumbing while all
  // visible ripple motion is resolved by the measured-column surface shader.
  const brookRipples = new THREE.Group();
  brookRipples.name = 'world.connected_route.brook-ripples';
  brookRipples.userData.surfaceRole =
    'zero-draw-static-overlay-retired-motion-resolved-in-water-shader';
  brookRipples.userData.staticOverlayCount = 0;
  scene.add(brookRipples);

  const brookStoneCount = 56;
  const activeBedStoneCount = 36;
  const brookStoneGeometry = createWeatheredRockGeometry(1831, 1);
  const brookStones = new THREE.InstancedMesh(
    brookStoneGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x858e89,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.06,
      dithering: true,
    }),
    brookStoneCount,
  );
  const random = seededRandom(482);
  const dummy = new THREE.Object3D();
  const stoneColor = new THREE.Color();
  const brookStoneSupportEvidence = [];
  const brookObstacleCandidates = [];
  for (let index = 0; index < brookStoneCount; index += 1) {
    const depositionClass = index < activeBedStoneCount
      ? 'active-channel-bed-load'
      : 'inner-bend-point-bar-coarse-lag';
    let segment = 0;
    let point = null;
    let direction = null;
    let process = null;
    let ecology = null;
    for (let attempt = 0; attempt < 96; attempt += 1) {
      segment = Math.min(
        brookPoints.length - 2,
        Math.floor(random() * (brookPoints.length - 1)),
      );
      const t = random();
      point = brookPoints[segment].clone().lerp(brookPoints[segment + 1], t);
      direction = brookPoints[segment + 1].clone().sub(brookPoints[segment]);
      const acrossChannel = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      if (depositionClass === 'active-channel-bed-load') {
        point.addScaledVector(acrossChannel, (random() - 0.5) * 2.8);
      } else {
        const bankSide = random() < 0.5 ? -1 : 1;
        point.addScaledVector(acrossChannel, bankSide * (3.2 + random() * 4.1));
      }
      process = brookFluvialProcessAt(point.x, point.z);
      ecology = terrainEcologyAt(point.x, point.z);
      const physicallyAccepted = depositionClass === 'active-channel-bed-load'
        ? process.distance <= 1.8
        : process.pointBar > 0.14
          && ecology.pointBarDeposit > 0.1
          && ecology.routeWear < 0.18;
      if (physicallyAccepted) break;
      point = null;
    }
    if (!point) {
      throw new Error(`Unable to place ${depositionClass} from brook process source`);
    }
    const scale = depositionClass === 'active-channel-bed-load'
      ? 0.08 + random() * 0.18
      : 0.07 + random() * 0.14;
    const flowYaw = Math.atan2(-direction.z, direction.x);
    const support = settleRockOnTerrain(dummy, brookStoneGeometry, {
      id: `brook-bed-cobble-${index + 1}`,
      x: point.x,
      z: point.z,
      yaw: flowYaw + (random() - 0.5) * 0.42,
      scale: [scale * (0.8 + random() * 0.6), scale * 0.55, scale],
      burial: 0.03,
      solid: false,
    });
    brookStoneSupportEvidence.push(Object.freeze({
      ...support,
      depositionClass,
      channelDistance: Number(process.distance.toFixed(4)),
      pointBarProcess: Number(process.pointBar.toFixed(4)),
      pointBarDeposit: Number(ecology.pointBarDeposit.toFixed(4)),
      routeWear: Number(ecology.routeWear.toFixed(4)),
    }));
    brookObstacleCandidates.push(renderedRockObstacleCandidate(
      support.id,
      depositionClass,
      brookStoneGeometry,
      dummy.matrix,
    ));
    brookStones.setMatrixAt(index, dummy.matrix);
    stoneColor.setHSL(0.41 + random() * 0.035, 0.06 + random() * 0.06, 0.2 + random() * 0.085);
    brookStones.setColorAt(index, stoneColor);
  }
  brookStones.name = 'world.connected_route.brook-stones';
  brookStones.castShadow = true;
  brookStones.receiveShadow = true;
  brookStones.userData.contactModel = 'terrain-normal-aligned-shallow-bed-and-bar-deposition';
  brookStones.userData.distribution = 'gravity-flow-bed-load-and-inner-bend-point-bar-lag';
  brookStones.material.userData.surface =
    'seam-free-vertex-mineral-varied-rough-dielectric-stream-stone';
  brookStones.material.userData.mapping = 'no-spherical-uv-texture-sampling';
  brookStones.userData.sedimentSorting = Object.freeze({
    model: TERRAIN_FLUVIAL_SURFACE_PROFILE.model,
    processSource: TERRAIN_FLUVIAL_SURFACE_PROFILE.processSource,
    activeBedCount: activeBedStoneCount,
    pointBarLagCount: brookStoneCount - activeBedStoneCount,
    supportEvidence: Object.freeze(brookStoneSupportEvidence),
  });
  brookStones.userData.collisionRole = 'non-solid-sub-step-stream-bed-decor';
  scene.add(brookStones);

  const driftwoodCount = 10;
  const driftwoodMaterial = createDeadwoodMaterial({ wet: true });
  const driftwoodCounts = [4, 3, 3];
  const driftwoodMeshes = driftwoodCounts.map((count, variant) => (
    new THREE.InstancedMesh(createDriftwoodGeometry(variant), driftwoodMaterial, count)
  ));
  const driftwoodIndices = [0, 0, 0];
  const driftwoodColor = new THREE.Color();
  const driftwoodRandom = seededRandom(1169);
  const driftwoodSupportPoint = new THREE.Vector3();
  const driftwoodTerrainNormal = new THREE.Vector3();
  const driftwoodSlopeFrame = new THREE.Quaternion();
  const driftwoodYawFrame = new THREE.Quaternion();
  const driftwoodSupportEvidence = {
    instanceCount: 0,
    supportSampleCount: 0,
    minimumClearance: Infinity,
    maximumClearance: -Infinity,
    maximumTerrainSlope: 0,
  };
  const measureDriftwoodSupport = (geometry) => {
    let minimumClearance = Infinity;
    let maximumClearance = -Infinity;
    for (const coordinates of geometry.userData.supportPoints) {
      driftwoodSupportPoint.set(...coordinates).applyMatrix4(dummy.matrix);
      const clearance = driftwoodSupportPoint.y
        - terrainHeight(driftwoodSupportPoint.x, driftwoodSupportPoint.z);
      minimumClearance = Math.min(minimumClearance, clearance);
      maximumClearance = Math.max(maximumClearance, clearance);
    }
    return { minimumClearance, maximumClearance };
  };
  for (let index = 0; index < driftwoodCount; index += 1) {
    let segment;
    let point;
    do {
      segment = 4 + Math.floor(driftwoodRandom() * (brookPoints.length - 9));
      point = brookPoints[segment].clone();
    } while (Math.hypot(point.x - TRACK_IMPRESSION.x, point.z - TRACK_IMPRESSION.z) < 6.5);
    const before = brookPoints[Math.max(0, segment - 1)];
    const after = brookPoints[Math.min(brookPoints.length - 1, segment + 1)];
    const direction = after.clone().sub(before).setY(0).normalize();
    const side = index % 2 ? -1 : 1;
    const lateral = new THREE.Vector3(-direction.z, 0, direction.x)
      .multiplyScalar(side * (2.15 + driftwoodRandom() * 0.85));
    point.add(lateral);
    const gradient = terrainGradient(point.x, point.z, 0.45);
    const terrainSlopeAtPlacement = Math.hypot(gradient.x, gradient.z);
    driftwoodTerrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
    driftwoodSlopeFrame.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      driftwoodTerrainNormal,
    );
    driftwoodYawFrame.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.atan2(direction.z, direction.x) + (driftwoodRandom() - 0.5) * 0.75,
    );
    dummy.position.set(point.x, terrainHeight(point.x, point.z) + 0.12, point.z);
    dummy.quaternion.multiplyQuaternions(driftwoodSlopeFrame, driftwoodYawFrame);
    const scale = 0.72 + driftwoodRandom() * 0.58;
    dummy.scale.set(
      scale * (0.91 + driftwoodRandom() * 0.18),
      scale * (0.9 + driftwoodRandom() * 0.16),
      scale * (0.91 + driftwoodRandom() * 0.18),
    );
    dummy.updateMatrix();
    const variant = index % driftwoodMeshes.length;
    const driftwood = driftwoodMeshes[variant];
    const instanceIndex = driftwoodIndices[variant];
    let support = measureDriftwoodSupport(driftwood.geometry);
    dummy.position.y -= support.maximumClearance - 0.008;
    dummy.updateMatrix();
    support = measureDriftwoodSupport(driftwood.geometry);
    if (support.maximumClearance > 0.016 || support.minimumClearance < -0.12) {
      throw new Error(`could not gravity-settle brook driftwood instance ${index}`);
    }
    driftwood.setMatrixAt(instanceIndex, dummy.matrix);
    driftwoodColor.setHSL(
      0.075 + driftwoodRandom() * 0.035,
      0.035 + driftwoodRandom() * 0.025,
      0.54 + driftwoodRandom() * 0.07,
    );
    driftwood.setColorAt(instanceIndex, driftwoodColor);
    driftwoodIndices[variant] += 1;
    driftwoodSupportEvidence.instanceCount += 1;
    driftwoodSupportEvidence.supportSampleCount += driftwood.geometry.userData.supportPoints.length;
    driftwoodSupportEvidence.minimumClearance = Math.min(
      driftwoodSupportEvidence.minimumClearance,
      support.minimumClearance,
    );
    driftwoodSupportEvidence.maximumClearance = Math.max(
      driftwoodSupportEvidence.maximumClearance,
      support.maximumClearance,
    );
    driftwoodSupportEvidence.maximumTerrainSlope = Math.max(
      driftwoodSupportEvidence.maximumTerrainSlope,
      terrainSlopeAtPlacement,
    );
  }
  driftwoodMeshes.forEach((driftwood, index) => {
    driftwood.name = index === 0
      ? 'world.connected_route.brook-driftwood'
      : `world.connected_route.brook-driftwood-variant-${index + 1}`;
    driftwood.castShadow = true;
    driftwood.receiveShadow = true;
    driftwood.userData.supportModel = driftwood.geometry.userData.supportModel;
    driftwood.userData.collisionRole = 'non-solid-visual-accent';
    driftwood.userData.moistureClass = driftwoodMaterial.userData.moistureClass;
  });
  scene.add(...driftwoodMeshes);
  makeThreeToedTrack(scene);

  // Footfall changes the same soil that carries collision and ecological
  // placement. The former transparent ribbons duplicated that surface and
  // exposed their triangulation at grazing angles. Keep zero-draw semantic
  // anchors for inspection while the terrainRouteWear field owns every visible
  // colour, relief and roughness response.
  const [route, canopyFork, basaltFork] = [
    ['world.connected_route.track', 'main-route', MAIN_ROUTE_CONTROL_POINTS,
      TERRAIN_ROUTE_SURFACE_PROFILE.mainRouteInfluenceMeters],
    ['world.connected_route.covered_fork', 'covered-fork', COVERED_FORK_CONTROL_POINTS,
      TERRAIN_ROUTE_SURFACE_PROFILE.coveredForkInfluenceMeters],
    ['world.connected_route.exposed_fork', 'exposed-fork', EXPOSED_FORK_CONTROL_POINTS,
      TERRAIN_ROUTE_SURFACE_PROFILE.exposedForkInfluenceMeters],
  ].map(([name, branch, controlPoints, influenceMeters]) => {
    const routeAnchor = new THREE.Group();
    routeAnchor.name = name;
    routeAnchor.userData = {
      ...TERRAIN_ROUTE_SURFACE_PROFILE,
      branch,
      controlPointCount: controlPoints.length,
      influenceMeters: [...influenceMeters],
      surface: 'terrain-integrated-footfall-compaction-not-overlay-ribbon',
    };
    scene.add(routeAnchor);
    return routeAnchor;
  });
  return {
    brook,
    brookHydrology,
    brookBank,
    leftWetEdge,
    rightWetEdge,
    driftwood: driftwoodMeshes,
    driftwoodSupportEvidence: Object.freeze(driftwoodSupportEvidence),
    brookRipples,
    brookStones,
    brookPoints,
    brookObstacleCandidates: Object.freeze(brookObstacleCandidates),
    route,
    canopyFork,
    basaltFork,
  };
}

function createRootSupportedRiparianBoughGeometry({
  rootX,
  rootHeightOffset,
  side,
  treeIndex,
  trunkHeightScale,
}) {
  const inward = side === 'left' ? 1 : -1;
  const joinY = rootHeightOffset + 4.18 * trunkHeightScale;
  const reach = 1.58 + ((treeIndex * 7) % 5) * 0.19;
  const rise = 1.02 + ((treeIndex * 3) % 4) * 0.17;
  const drift = ((treeIndex * 11) % 7 - 3) * 0.11;
  const start = [rootX + inward * 0.04, joinY, 0];
  const shoulder = [rootX + inward * 0.62, joinY + 0.48, drift * 0.45];
  const crownNode = [rootX + inward * reach, joinY + rise, drift];
  const parts = [
    createCylinderBetween(start, shoulder, 0.245, 0.165, 9),
    createCylinderBetween(shoulder, crownNode, 0.165, 0.072, 8),
    createCylinderBetween(
      shoulder,
      [rootX - inward * (0.54 + (treeIndex % 3) * 0.13), joinY + 0.88, -drift - 0.34],
      0.132,
      0.05,
      8,
    ),
    createCylinderBetween(
      [
        rootX + inward * reach * 0.62,
        joinY + rise * 0.62,
        drift * 0.62,
      ],
      [
        rootX + inward * (reach * 0.82),
        joinY + rise + 0.66 + (treeIndex % 2) * 0.18,
        drift - inward * 0.48,
      ],
      0.105,
      0.042,
      7,
    ),
  ];
  const geometry = mergeParts(parts);
  geometry.userData.profile = 'single-root-supported-asymmetric-riparian-bough';
  geometry.userData.sourceTreeIndex = treeIndex;
  geometry.userData.sourceSide = side;
  geometry.userData.loadPath = 'root-mantle-to-vertical-trunk-to-fork-to-attached-crown';
  geometry.userData.crossTrunkBridge = false;
  geometry.userData.maximumHorizontalCantileverMeters = Number(reach.toFixed(3));
  geometry.userData.phototropicBias = 'inward-light-gap-with-bounded-outward-secondary-fork';
  return geometry;
}

function makeRiparianCover(scene) {
  const group = new THREE.Group();
  const assetAnchor = new THREE.Group();
  assetAnchor.name = 'world.connected_route.cover-riparian-tree-asset-anchor';
  assetAnchor.userData.supportModel = CANOPY_TREE_LIBRARY_ASSET.supportModel;
  assetAnchor.userData.collisionRole = CANOPY_TREE_LIBRARY_ASSET.collisionRole;
  assetAnchor.userData.growthModel = CANOPY_TREE_LIBRARY_ASSET.growthModel;
  COVER_RIPARIAN_TREE_LAYOUT.forEach((tree) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.cover-riparian-tree-placement-${tree.index + 1}`;
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    placementAnchor.userData.visualIndex = tree.index;
    assetAnchor.add(placementAnchor);
  });
  const leafDetails = new THREE.InstancedMesh(
    shared.leafDetailGeometry,
    shared.leafDetailMaterial,
    COVER_ARCH_LAYOUT.length * 6,
  );
  const leafDummy = new THREE.Object3D();
  const leafColor = new THREE.Color();
  const bark = new THREE.MeshStandardMaterial({
    color: 0x765e46,
    roughness: 0.92,
    vertexColors: true,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.3,
    map: barkTextures.albedo,
    roughnessMap: barkTextures.roughness,
    bumpMap: barkTextures.height,
    bumpScale: 0.03,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: 0x557b59,
    roughness: 0.86,
    vertexColors: true,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 0.32,
  });
  bark.userData.surface = 'mapped-non-emissive-damp-bark';
  leaf.userData.surface = 'non-emissive-matte-canopy-interior';
  COVER_ARCH_LAYOUT.forEach(({ centerX, z, spread }, index) => {
    const ground = terrainHeight(centerX, z);
    const leftTree = COVER_RIPARIAN_TREE_LAYOUT[index * 2];
    const rightTree = COVER_RIPARIAN_TREE_LAYOUT[index * 2 + 1];
    const leftGround = terrainHeight(leftTree.x, leftTree.z);
    const rightGround = terrainHeight(rightTree.x, rightTree.z);
    const leftHeightScale = 1 + (leftTree.scale - 0.76) * 0.85;
    const rightHeightScale = 1 + (rightTree.scale - 0.76) * 0.85;
    const left = primitive(
      bark,
      shared.trunkGeometry,
      [leftTree.x, leftGround, leftTree.z],
      [0.74 + leftTree.scale * 0.1, leftHeightScale, 0.74 + leftTree.scale * 0.1],
      [0, leftTree.trunkYaw, 0],
    );
    left.name = `riparian-rooted-trunk-${index + 1}-left`;
    const right = primitive(
      bark,
      shared.trunkGeometry,
      [rightTree.x, rightGround, rightTree.z],
      [0.74 + rightTree.scale * 0.1, rightHeightScale, 0.74 + rightTree.scale * 0.1],
      [0, rightTree.trunkYaw, 0],
    );
    right.name = `riparian-rooted-trunk-${index + 1}-right`;
    const leftReach = 1.58 + ((leftTree.index * 7) % 5) * 0.19;
    const rightReach = 1.58 + ((rightTree.index * 7) % 5) * 0.19;
    const leftRise = 1.02 + ((leftTree.index * 3) % 4) * 0.17;
    const rightRise = 1.02 + ((rightTree.index * 3) % 4) * 0.17;
    const leftDrift = ((leftTree.index * 11) % 7 - 3) * 0.11;
    const rightDrift = ((rightTree.index * 11) % 7 - 3) * 0.11;
    const leftJoinY = leftGround - ground + 4.18 * leftHeightScale;
    const rightJoinY = rightGround - ground + 4.18 * rightHeightScale;
    const leftBough = primitive(
      bark,
      createRootSupportedRiparianBoughGeometry({
        rootX: -spread,
        rootHeightOffset: leftGround - ground,
        side: 'left',
        treeIndex: leftTree.index,
        trunkHeightScale: leftHeightScale,
      }),
      [centerX, ground, z],
      [1, 1, 1],
      [0, 0, 0],
    );
    leftBough.name = `root-supported-riparian-bough-${index + 1}-left`;
    leftBough.userData.sourceRoot = Object.freeze([leftTree.x, leftTree.z]);
    const rightBough = primitive(
      bark,
      createRootSupportedRiparianBoughGeometry({
        rootX: spread,
        rootHeightOffset: rightGround - ground,
        side: 'right',
        treeIndex: rightTree.index,
        trunkHeightScale: rightHeightScale,
      }),
      [centerX, ground, z],
      [1, 1, 1],
      [0, 0, 0],
    );
    rightBough.name = `root-supported-riparian-bough-${index + 1}-right`;
    rightBough.userData.sourceRoot = Object.freeze([rightTree.x, rightTree.z]);
    const leftCrown = primitive(
      leaf,
      shared.crownGeometry,
      [
        centerX - spread + leftReach * 0.48,
        ground + leftJoinY + leftRise * 0.58,
        z + leftDrift * 0.5,
      ],
      [0.4 + leftTree.scale * 0.055, 0.3 + leftTree.scale * 0.035, 0.38],
      [0.03, leftTree.trunkYaw * 0.58, -0.035],
    );
    leftCrown.name = `tree-supported-crown-${index + 1}-left`;
    leftCrown.userData.sourceTreeIndex = leftTree.index;
    const rightCrown = primitive(
      leaf,
      shared.crownGeometry,
      [
        centerX + spread - rightReach * 0.48,
        ground + rightJoinY + rightRise * 0.58,
        z + rightDrift * 0.5,
      ],
      [0.39 + rightTree.scale * 0.06, 0.29 + rightTree.scale * 0.04, 0.4],
      [-0.035, rightTree.trunkYaw * 0.54, 0.04],
    );
    rightCrown.name = `tree-supported-crown-${index + 1}-right`;
    rightCrown.userData.sourceTreeIndex = rightTree.index;
    const dominantTree = index % 2 === 0 ? leftTree : rightTree;
    const dominantReach = index % 2 === 0 ? leftReach : rightReach;
    const dominantJoinY = index % 2 === 0 ? leftJoinY : rightJoinY;
    const dominantRise = index % 2 === 0 ? leftRise : rightRise;
    const dominantDrift = index % 2 === 0 ? leftDrift : rightDrift;
    const dominantDirection = index % 2 === 0 ? 1 : -1;
    const overlapCrown = primitive(
      leaf,
      shared.crownAccentGeometry,
      [
        centerX + dominantDirection * (-spread + dominantReach * 0.94),
        ground + dominantJoinY + dominantRise + 0.2,
        z + dominantDrift,
      ],
      [0.34, 0.27, 0.33],
      [0.04, dominantTree.trunkYaw * 0.42, dominantDirection * -0.05],
    );
    overlapCrown.name = `tree-supported-overlap-crown-${index + 1}-${dominantTree.side}`;
    overlapCrown.userData.sourceTreeIndex = dominantTree.index;
    overlapCrown.userData.loadPath = 'single-root-supported-bough-to-attached-crown';
    group.add(left, right, leftBough, rightBough, leftCrown, rightCrown, overlapCrown);
    const leafAnchors = [
      [leftTree.x - 0.35, leftGround + 5.36 * leftHeightScale, z - 0.38, 1.12, leftTree.trunkYaw],
      [leftTree.x + leftReach * 0.46, ground + leftJoinY + leftRise * 0.72, z + leftDrift - 0.24, 1.04, leftTree.trunkYaw + 0.72],
      [leftTree.x + leftReach * 0.92, ground + leftJoinY + leftRise + 0.3, z + leftDrift + 0.16, 0.98, leftTree.trunkYaw + 1.1],
      [rightTree.x - rightReach * 0.9, ground + rightJoinY + rightRise + 0.22, z + rightDrift - 0.18, 0.96, rightTree.trunkYaw - 0.7],
      [rightTree.x - rightReach * 0.44, ground + rightJoinY + rightRise * 0.7, z + rightDrift + 0.28, 1.04, rightTree.trunkYaw + 0.48],
      [rightTree.x + 0.42, rightGround + 5.28 * rightHeightScale, z + 0.34, 1.1, rightTree.trunkYaw],
    ];
    leafAnchors.forEach(([x, y, leafZ, scale, yaw], anchorIndex) => {
      const leafIndex = index * 6 + anchorIndex;
      leafDummy.position.set(x, y, leafZ);
      leafDummy.rotation.set(0, yaw, 0);
      leafDummy.scale.set(scale, scale * 0.72, scale);
      leafDummy.updateMatrix();
      leafDetails.setMatrixAt(leafIndex, leafDummy.matrix);
      leafColor.setHSL(
        0.315 + anchorIndex * 0.007,
        0.42,
        0.44 + (index % 2) * 0.018 + (anchorIndex % 3) * 0.014,
      );
      leafDetails.setColorAt(leafIndex, leafColor);
    });
  });
  leafDetails.name = 'world.connected_route.cover-arch-leaf-detail';
  // The closed crown masses already cast the aggregate canopy shadow. The
  // visible leaf blades are a geometric detail LOD: casting or receiving the
  // proxy volume again would count the same leaf area twice and blacken their
  // physically transmitted underside. The interior crown is the bounded
  // aggregate occluder; the outer blades resolve shape and sun transmission.
  leafDetails.castShadow = false;
  leafDetails.receiveShadow = false;
  leafDetails.userData.compositionRole = 'near-cover-supported-volumetric-leaf-scale-breakup';
  leafDetails.userData.supportModel = shared.leafDetailGeometry.userData.supportModel;
  leafDetails.userData.shadowModel = 'aggregate-crown-owns-canopy-occlusion';
  group.add(leafDetails);
  group.name = 'world.connected_route.cover_arches';
  group.userData.archCount = 0;
  group.userData.pairCount = COVER_ARCH_LAYOUT.length;
  group.userData.treeCount = COVER_RIPARIAN_TREE_LAYOUT.length;
  group.userData.minimumHalfClearance = 3.5;
  group.userData.profile = 'asymmetric-riparian-overlap-canopy';
  group.userData.loadPath = 'ten-independent-roots-to-trunks-to-branches-to-attached-crowns';
  group.userData.bridgeGeometryCount = 0;
  group.userData.rootAnchorsPreserved = true;
  group.userData.collisionRole = 'solid-visible-trunks-with-non-solid-branches-and-pliable-leaves';
  assetAnchor.userData.fallbackMeshes = Object.freeze([...group.children]);
  scene.add(group, assetAnchor);
  return Object.freeze({ group, assetAnchor });
}

function placeVegetation(scene) {
  const canopyTreeAssetAnchor = new THREE.Group();
  canopyTreeAssetAnchor.name = 'world.connected_route.canopy-tree-sentinels';
  canopyTreeAssetAnchor.userData.supportModel = CANOPY_TREE_LIBRARY_ASSET.supportModel;
  canopyTreeAssetAnchor.userData.collisionRole = CANOPY_TREE_LIBRARY_ASSET.collisionRole;
  canopyTreeAssetAnchor.userData.growthModel = CANOPY_TREE_LIBRARY_ASSET.growthModel;
  VEGETATION_LAYOUT.trees.forEach((tree) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.canopy-tree-placement-${tree.index + 1}`;
    placementAnchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    placementAnchor.userData.canopyTreePlacementAnchor = true;
    placementAnchor.userData.visualIndex = tree.index;
    canopyTreeAssetAnchor.add(placementAnchor);
  });
  const wetTrunkCount = VEGETATION_LAYOUT.trees.filter(
    ({ barkFamily }) => barkFamily === 'wet-furrowed',
  ).length;
  const plateTrunkCount = VEGETATION_LAYOUT.trees.length - wetTrunkCount;
  const trunkMeshes = {
    'wet-furrowed': new THREE.InstancedMesh(
      shared.trunkGeometry,
      shared.trunkMaterial,
      wetTrunkCount,
    ),
    'plate-barked': new THREE.InstancedMesh(
      shared.plateBarkedTrunkGeometry,
      shared.plateBarkMaterial,
      plateTrunkCount,
    ),
  };
  const crownMesh = new THREE.InstancedMesh(
    shared.crownGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const crownAccentMesh = new THREE.InstancedMesh(
    shared.crownAccentGeometry,
    shared.crownMaterial,
    SCENE_BUDGET.trees,
  );
  const ellipticTreeCount = VEGETATION_LAYOUT.trees.filter(
    ({ leafFamily }) => leafFamily === 'elliptic-waxy',
  ).length;
  const compoundTreeCount = VEGETATION_LAYOUT.trees.filter(
    ({ leafFamily }) => leafFamily === 'compound-lanceolate',
  ).length;
  const canopyBranchMeshes = {
    'elliptic-waxy': new THREE.InstancedMesh(
      shared.canopyBranchGeometry,
      shared.trunkMaterial,
      ellipticTreeCount,
    ),
    'compound-lanceolate': new THREE.InstancedMesh(
      shared.canopyBranchGeometry,
      shared.plateBarkMaterial,
      compoundTreeCount,
    ),
  };
  const araucariaMesh = new THREE.InstancedMesh(
    shared.araucariaGeometry,
    shared.crownMaterial,
    VEGETATION_LAYOUT.trees.filter(({ isAraucaria }) => isAraucaria).length,
  );
  const leafDetailMeshes = {
    'elliptic-waxy': new THREE.InstancedMesh(
      shared.canopyLeafGeometries[0],
      shared.canopyLeafMaterials[0],
      ellipticTreeCount,
    ),
    'compound-lanceolate': new THREE.InstancedMesh(
      shared.canopyLeafGeometries[1],
      shared.canopyLeafMaterials[1],
      compoundTreeCount,
    ),
  };
  const dummy = new THREE.Object3D();
  const trunkColor = new THREE.Color();
  const crownColor = new THREE.Color();
  let araucariaIndex = 0;

  VEGETATION_LAYOUT.trees.forEach((tree) => {
    const {
      index: i, x, z, scale, isAraucaria,
    } = tree;
    const y = terrainHeight(x, z);
    const crownClusterScale = 0.5 + ((i * 7) % 5) * 0.024;
    const crownValueShift = (Math.floor(i / 5) % 3 - 1) * 0.026;
    // The current authored trunk loft starts at y=0. The previous placement
    // still treated it like a center-origin cylinder and lifted every tree by
    // roughly half its height. Reset all Euler axes as well: otherwise a
    // crown's tilt leaks into the next trunk through the reused dummy object.
    dummy.position.set(x, y - 0.035 * scale, z);
    dummy.rotation.set(0, tree.trunkYaw, 0);
    dummy.scale.set(...tree.trunkScale);
    dummy.updateMatrix();
    const trunkMesh = trunkMeshes[tree.barkFamily];
    trunkMesh.setMatrixAt(tree.trunkFamilyIndex, dummy.matrix);
    trunkColor.setHSL(...tree.trunkColor);
    trunkMesh.setColorAt(tree.trunkFamilyIndex, trunkColor);

    if (!isAraucaria) {
      dummy.position.set(x, y + 4.78 * scale, z);
      dummy.rotation.set(0, tree.trunkYaw + tree.crownRotation[1] * 0.16, 0);
      dummy.scale.set(
        scale * 1.08,
        scale * (0.94 + (i % 4) * 0.035),
        scale * (0.94 + ((i + 2) % 5) * 0.028),
      );
      dummy.updateMatrix();
      const canopyBranchMesh = canopyBranchMeshes[tree.leafFamily];
      canopyBranchMesh.setMatrixAt(tree.canopyFamilyIndex, dummy.matrix);
      canopyBranchMesh.setColorAt(tree.canopyFamilyIndex, trunkColor);

      const leafDetailMesh = leafDetailMeshes[tree.leafFamily];
      leafDetailMesh.setMatrixAt(tree.canopyFamilyIndex, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(
        tree.leafFamily === 'compound-lanceolate' ? -0.012 : 0.006,
        tree.leafFamily === 'compound-lanceolate' ? 0.012 : 0.008,
        tree.leafFamily === 'compound-lanceolate' ? 0.4 : 0.42,
      );
      leafDetailMesh.setColorAt(tree.canopyFamilyIndex, crownColor);
    }

    if (isAraucaria) {
      dummy.position.set(x, y + 5.72 * scale, z);
      dummy.rotation.set(0, tree.canopyYaw, 0);
      dummy.scale.set(...tree.canopyScale).multiplyScalar(crownClusterScale);
      dummy.updateMatrix();
      araucariaMesh.setMatrixAt(araucariaIndex, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      araucariaMesh.setColorAt(araucariaIndex, crownColor);
      araucariaIndex += 1;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setColorAt(i, crownColor);
      crownAccentMesh.setColorAt(i, crownColor);
    } else {
      const [crownOffsetX, crownOffsetZ] = tree.crownOffset;
      dummy.position.set(x + crownOffsetX, y + 6.15 * scale, z + crownOffsetZ);
      dummy.rotation.set(...tree.crownRotation);
      dummy.scale.set(...tree.crownScale).multiplyScalar(crownClusterScale * 0.94);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownColor.setHSL(...tree.crownColor);
      crownColor.offsetHSL(0, crownValueShift * 0.55, crownValueShift);
      crownMesh.setColorAt(i, crownColor);

      dummy.position.set(
        x + tree.accentOffset[0],
        y + 7.05 * scale,
        z + tree.accentOffset[1],
      );
      dummy.rotation.set(...tree.accentRotation);
      dummy.scale.set(...tree.accentScale).multiplyScalar(0.58 + (i % 3) * 0.035);
      dummy.updateMatrix();
      crownAccentMesh.setMatrixAt(i, dummy.matrix);
      crownColor.offsetHSL(0.01, -0.02, 0.035);
      crownAccentMesh.setColorAt(i, crownColor);
    }
  });
  trunkMeshes['wet-furrowed'].name = 'world.connected_route.tree_trunks';
  trunkMeshes['plate-barked'].name = 'world.connected_route.tree_trunks-plate-barked';
  canopyBranchMeshes['elliptic-waxy'].name = 'world.connected_route.canopy-load-bearing-branches';
  canopyBranchMeshes['compound-lanceolate'].name = 'world.connected_route.canopy-load-bearing-branches-plate-barked';
  crownMesh.name = 'world.connected_route.canopy';
  crownAccentMesh.name = 'world.connected_route.canopy-highlights';
  araucariaMesh.name = 'world.connected_route.araucaria-canopy';
  leafDetailMeshes['elliptic-waxy'].name = 'world.connected_route.canopy-leaf-detail';
  leafDetailMeshes['compound-lanceolate'].name = 'world.connected_route.canopy-leaf-detail-compound';
  Object.values(trunkMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'solid-visible-trunk-family';
  });
  Object.values(canopyBranchMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.compositionRole = 'visible-trunk-to-leaf-load-path';
  });
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownAccentMesh.castShadow = true;
  crownAccentMesh.receiveShadow = true;
  araucariaMesh.castShadow = true;
  araucariaMesh.receiveShadow = true;
  crownMesh.userData.compositionRole = 'bounded-interior-canopy-mass';
  crownAccentMesh.userData.compositionRole = 'bounded-interior-canopy-accent';
  Object.values(leafDetailMeshes).forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = createLeafWindDepthMaterial(mesh.material);
    mesh.userData.compositionRole = 'branch-tip-supported-leaf-scale-silhouette';
    mesh.userData.collisionRole = 'non-solid-leaf-spray';
  });
  canopyTreeAssetAnchor.userData.fallbackMeshes = Object.freeze([
    ...Object.values(trunkMeshes),
    ...Object.values(canopyBranchMeshes),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    ...Object.values(leafDetailMeshes),
  ]);
  scene.add(
    canopyTreeAssetAnchor,
    ...Object.values(trunkMeshes),
    ...Object.values(canopyBranchMeshes),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    ...Object.values(leafDetailMeshes),
  );

  const fernMeshes = shared.fernGeometries.map((geometry, variantIndex) => {
    const count = Math.floor((SCENE_BUDGET.ferns + 2 - variantIndex) / 3);
    return new THREE.InstancedMesh(geometry, shared.fernMaterial, count);
  });
  const fernInstanceIndices = [0, 0, 0];
  VEGETATION_LAYOUT.ferns.forEach((fern) => {
    const {
      x, z, scale, variantIndex,
    } = fern;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, fern.rotation, 0);
    dummy.scale.set(...fern.instanceScale);
    dummy.updateMatrix();
    const fernMesh = fernMeshes[variantIndex];
    const instanceIndex = fernInstanceIndices[variantIndex];
    fernMesh.setMatrixAt(instanceIndex, dummy.matrix);
    crownColor.setHSL(...fern.color);
    fernMesh.setColorAt(instanceIndex, crownColor);
    fernInstanceIndices[variantIndex] += 1;
  });
  fernMeshes.forEach((fernMesh, index) => {
    fernMesh.name = index === 0
      ? 'world.connected_route.ferns'
      : `world.connected_route.ferns-variant-${index + 1}`;
    fernMesh.castShadow = true;
    fernMesh.receiveShadow = true;
  });
  scene.add(...fernMeshes);
  const fernAssetAnchor = new THREE.Group();
  fernAssetAnchor.name = 'world.connected_route.ferns.asset-anchor';
  fernAssetAnchor.userData.fallbackMeshes = fernMeshes;
  fernAssetAnchor.userData.supportModel = FERN_LIBRARY_ASSET.supportModel;
  fernAssetAnchor.userData.collisionRole = FERN_LIBRARY_ASSET.collisionRole;
  scene.add(fernAssetAnchor);

  const stoneCount = 96;
  const groundStoneGeometry = createWeatheredRockGeometry(1571, 1).scale(0.42, 0.42, 0.42);
  const stoneMesh = new THREE.InstancedMesh(
    groundStoneGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.97,
      map: rockTextures.albedo,
      roughnessMap: rockTextures.roughness,
      bumpMap: rockTextures.height,
      bumpScale: 0.018,
    }),
    stoneCount,
  );
  VEGETATION_LAYOUT.stones.forEach((stone) => {
    const {
      index, x, z, scale,
    } = stone;
    const visualClusterScale = 0.72 + ((index * 5) % 7) * 0.06;
    settleRockOnTerrain(dummy, groundStoneGeometry, {
      id: `ground-stone-${index + 1}`,
      x,
      z,
      yaw: stone.rotation[1],
      scale: stone.instanceScale.map((value) => value * visualClusterScale),
      burial: 0.025,
      solid: false,
    });
    stoneMesh.setMatrixAt(index, dummy.matrix);
    crownColor.setHSL(...stone.color);
    crownColor.offsetHSL(0, -0.025, (Math.floor(index / 9) % 3 - 1) * 0.025 - 0.025);
    stoneMesh.setColorAt(index, crownColor);
  });
  stoneMesh.name = 'world.connected_route.ground-stones';
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.userData.contactModel = 'terrain-normal-aligned-flat-base-shallow-burial';
  stoneMesh.userData.collisionRole = 'non-solid-sub-step-ground-decor';
  scene.add(stoneMesh);
  return Object.freeze({
    trunkMeshes: Object.freeze(Object.values(trunkMeshes)),
    canopyBranchMeshes: Object.freeze(Object.values(canopyBranchMeshes)),
    leafDetailMeshes: Object.freeze(Object.values(leafDetailMeshes)),
    crownMesh,
    crownAccentMesh,
    araucariaMesh,
    fernMeshes: Object.freeze(fernMeshes),
    fernAssetAnchor,
    canopyTreeAssetAnchor,
    profile: 'two-broadleaf-bark-and-leaf-families-plus-araucaria',
  });
}

function makeHabitatAccents(scene) {
  // The broad central sightline stays open, while authored tree-fern sentinels
  // provide near/mid/far scale at its margins.  This avoids solving depth with
  // indiscriminate scatter or a repeated wall of identical canopy crowns.
  const placements = HABITAT_TREE_LAYOUT;
  const treeFernAssetAnchor = new THREE.Group();
  treeFernAssetAnchor.name = 'world.connected_route.tree-fern-sentinels';
  treeFernAssetAnchor.userData.supportModel = TREE_FERN_LIBRARY_ASSET.supportModel;
  treeFernAssetAnchor.userData.collisionRole = TREE_FERN_LIBRARY_ASSET.collisionRole;
  treeFernAssetAnchor.userData.growthModel = TREE_FERN_LIBRARY_ASSET.growthModel;
  placements.forEach(([x, z], index) => {
    const placementAnchor = new THREE.Group();
    placementAnchor.name = `world.connected_route.tree-fern-placement-${index + 1}`;
    placementAnchor.position.set(x, terrainHeight(x, z), z);
    placementAnchor.userData.treeFernPlacementAnchor = true;
    placementAnchor.userData.visualIndex = index;
    treeFernAssetAnchor.add(placementAnchor);
  });
  const trunks = new THREE.InstancedMesh(
    shared.treeFernTrunkGeometry,
    shared.treeFernTrunkMaterial,
    placements.length,
  );
  const crownCounts = shared.treeFernCrownGeometries.map((_, variantIndex) => (
    placements.filter((__, index) => index % shared.treeFernCrownGeometries.length === variantIndex).length
  ));
  const crownMeshes = shared.treeFernCrownGeometries.map((geometry, variantIndex) => (
    new THREE.InstancedMesh(geometry, shared.fernMaterial, crownCounts[variantIndex])
  ));
  const crownIndices = crownMeshes.map(() => 0);
  const skirts = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    placements.length * 2,
  );
  const foregroundPlacements = FOREGROUND_FROND_LAYOUT;
  const foregroundFronds = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    foregroundPlacements.length,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(1889);
  const fernLibraryPlacements = [];

  placements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground - 0.02, z);
    dummy.rotation.set((random() - 0.5) * 0.12, yaw, (random() - 0.5) * 0.1);
    dummy.scale.set(scale * 0.92, scale * (1.03 + random() * 0.12), scale * 0.92);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.245 + random() * 0.025, 0.25, 0.19 + random() * 0.04);
    trunks.setColorAt(index, color);

    dummy.position.set(x, ground + 2.65 * scale, z);
    dummy.rotation.set(-0.12 + random() * 0.24, yaw + random() * 0.55, 0.09 - random() * 0.18);
    dummy.scale.set(
      scale * (0.82 + random() * 0.38),
      scale * (0.86 + random() * 0.28),
      scale * (0.78 + random() * 0.4),
    );
    dummy.updateMatrix();
    const crownVariant = index % crownMeshes.length;
    const crownMesh = crownMeshes[crownVariant];
    const crownIndex = crownIndices[crownVariant];
    crownMesh.setMatrixAt(crownIndex, dummy.matrix);
    color.setHSL(0.31 + random() * 0.04, 0.46 + random() * 0.08, 0.17 + random() * 0.055);
    crownMesh.setColorAt(crownIndex, color);
    crownIndices[crownVariant] += 1;

    for (let skirt = 0; skirt < 2; skirt += 1) {
      const angle = yaw + skirt * Math.PI + (random() - 0.5) * 0.5;
      const radius = scale * (0.64 + random() * 0.35);
      const skirtX = x + Math.cos(angle) * radius;
      const skirtZ = z + Math.sin(angle) * radius;
      const skirtRotation = angle + random();
      const skirtScale = scale * (0.72 + random() * 0.3);
      dummy.position.set(skirtX, terrainHeight(skirtX, skirtZ) + 0.025, skirtZ);
      dummy.rotation.set(0, skirtRotation, 0);
      dummy.scale.setScalar(skirtScale);
      dummy.updateMatrix();
      const skirtIndex = index * 2 + skirt;
      skirts.setMatrixAt(skirtIndex, dummy.matrix);
      const skirtColor = [
        0.295 + random() * 0.05,
        0.4 + random() * 0.1,
        0.18 + random() * 0.045,
      ];
      color.setHSL(...skirtColor);
      skirts.setColorAt(skirtIndex, color);
      const matureScale = skirtScale * 0.36;
      fernLibraryPlacements.push(Object.freeze({
        index: skirtIndex,
        x: skirtX,
        z: skirtZ,
        scale: matureScale,
        variantIndex: 2,
        rotation: skirtRotation,
        instanceScale: Object.freeze([matureScale, matureScale * 0.92, matureScale]),
        color: Object.freeze(skirtColor),
        sourceRole: 'tree-fern-understory-skirt-replacement',
        maxDiameterMeters: 1.45,
        maxHeightMeters: 0.4,
      }));
    }
  });

  foregroundPlacements.forEach(([x, z, scale, yaw], index) => {
    const ground = terrainHeight(x, z);
    dummy.position.set(x, ground + 0.025, z);
    dummy.rotation.set(0, yaw, (index % 2 ? -1 : 1) * 0.035);
    dummy.scale.set(scale * 1.18, scale * 0.72, scale);
    dummy.updateMatrix();
    foregroundFronds.setMatrixAt(index, dummy.matrix);
    color.setHSL(0.305 + random() * 0.025, 0.45 + random() * 0.07, 0.115 + random() * 0.025);
    foregroundFronds.setColorAt(index, color);
  });

  trunks.name = 'world.connected_route.tree-fern-sentinels.procedural-trunks';
  skirts.name = 'world.connected_route.tree-fern-understory';
  foregroundFronds.name = 'world.connected_route.foreground-depth-fronds';
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crownMeshes.forEach((crownMesh, index) => {
    crownMesh.name = index === 0
      ? 'world.connected_route.tree-fern-crowns.procedural'
      : `world.connected_route.tree-fern-crowns.procedural-variant-${index + 1}`;
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.userData.compositionRole = 'asymmetric-midground-depth';
  });
  skirts.castShadow = true;
  skirts.receiveShadow = true;
  foregroundFronds.castShadow = true;
  foregroundFronds.receiveShadow = true;
  foregroundFronds.userData.compositionRole = 'dark-foreground-depth-frame';
  trunks.userData.compositionRole = 'sightline-margin-scale-anchor';
  treeFernAssetAnchor.userData.fallbackMeshes = Object.freeze([trunks, ...crownMeshes]);
  scene.add(treeFernAssetAnchor, trunks, ...crownMeshes, skirts, foregroundFronds);
  return {
    treeFernAssetAnchor,
    trunks,
    crowns: crownMeshes,
    skirts,
    foregroundFronds,
    fernLibraryPlacements: Object.freeze(fernLibraryPlacements),
  };
}

function makeDegradableGroundAccents(scene) {
  const group = new THREE.Group();
  const wetlandCount = 36;
  const marginCount = 28;
  const wetland = new THREE.InstancedMesh(
    shared.fernGeometries[1],
    shared.fernMaterial,
    wetlandCount,
  );
  const margins = new THREE.InstancedMesh(
    shared.fernGeometries[2],
    shared.fernMaterial,
    marginCount,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const random = seededRandom(2719);
  const fernLibraryPlacements = [];

  // Follow the brook at irregular intervals, but stay outside its open water
  // and the opening track read. These are visual instances only: they never
  // enter collision or navigation truth.
  for (let index = 0; index < wetlandCount; index += 1) {
    const t = (index + 0.35 + random() * 0.3) / wetlandCount;
    const z = THREE.MathUtils.lerp(82, -66, t);
    const brookX = -11.5 + Math.sin(z * 0.071) * 3.1;
    const side = index % 2 ? -1 : 1;
    const x = brookX + side * (3.1 + random() * 2.2);
    const trackDistance = Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z);
    const finalZ = trackDistance < 7 ? z + (z > TRACK_IMPRESSION.z ? 7 : -7) : z;
    const scale = 0.62 + random() * 0.72;
    const rotation = random() * Math.PI * 2;
    const tilt = (random() - 0.5) * 0.07;
    const instanceScale = [
      scale * (0.72 + random() * 0.28),
      scale * (1.1 + random() * 0.35),
      scale,
    ];
    dummy.position.set(x, terrainHeight(x, finalZ) + 0.02, finalZ);
    dummy.rotation.set(0, rotation, tilt);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    wetland.setMatrixAt(index, dummy.matrix);
    const wetlandColor = [
      0.36 + random() * 0.035,
      0.34 + random() * 0.12,
      0.16 + random() * 0.055,
    ];
    color.setHSL(...wetlandColor);
    wetland.setColorAt(index, color);
    fernLibraryPlacements.push(Object.freeze({
      index,
      x,
      z: finalZ,
      scale: scale * 0.32,
      variantIndex: 0,
      rotation,
      instanceScale: Object.freeze(instanceScale.map((value) => value * 0.32)),
      color: Object.freeze(wetlandColor),
      sourceRole: 'degradable-wetland-accent-replacement',
      maxDiameterMeters: 1.4,
      maxHeightMeters: 0.5,
    }));
  }

  // Alternate route margins and depth bands so the plateau no longer reads
  // as one flat horizontal strip or a regularly spaced tree row.
  for (let index = 0; index < marginCount; index += 1) {
    const nearBand = index < 12;
    const side = index % 2 ? -1 : 1;
    const z = nearBand
      ? 48 + random() * 34
      : -54 + random() * 70;
    const x = side * (nearBand ? 14 + random() * 10 : 20 + random() * 13);
    const scale = nearBand ? 1.35 + random() * 1.25 : 0.9 + random() * 1.05;
    const rotation = random() * Math.PI * 2;
    const tilt = side * (0.04 + random() * 0.08);
    const instanceScale = [
      scale * (1.12 + random() * 0.32),
      scale * (0.68 + random() * 0.22),
      scale,
    ];
    dummy.position.set(x, terrainHeight(x, z) + 0.025, z);
    dummy.rotation.set(0, rotation, tilt);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    margins.setMatrixAt(index, dummy.matrix);
    const marginColor = [
      0.3 + random() * 0.035,
      0.4 + random() * 0.11,
      nearBand ? 0.105 : 0.15 + random() * 0.04,
    ];
    color.setHSL(...marginColor);
    margins.setColorAt(index, color);
    const matureScale = Math.min(0.5, scale * 0.22);
    const scaleRatio = matureScale / scale;
    fernLibraryPlacements.push(Object.freeze({
      index: wetlandCount + index,
      x,
      z,
      scale: matureScale,
      variantIndex: 2,
      rotation,
      instanceScale: Object.freeze(instanceScale.map((value) => value * scaleRatio)),
      color: Object.freeze(marginColor),
      sourceRole: 'degradable-margin-accent-replacement',
      maxDiameterMeters: 1.8,
      maxHeightMeters: 0.9,
    }));
  }

  wetland.name = 'world.connected_route.degradable-wetland-accents';
  margins.name = 'world.connected_route.degradable-margin-accents';
  for (const mesh of [wetland, margins]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    mesh.userData.qualityProfile = 'balanced-high-only';
  }
  wetland.userData.compositionRole = 'irregular-wetland-midground-rhythm';
  margins.userData.compositionRole = 'foreground-midground-depth-break';
  group.name = 'world.connected_route.degradable-ground-accents';
  group.userData.profile = 'deterministic-non-solid-instanced-accents';
  group.userData.instanceCount = wetlandCount + marginCount;
  group.userData.drawCalls = 2;
  group.userData.quality = 'balanced';
  group.userData.fernLibraryPlacements = Object.freeze(fernLibraryPlacements);
  group.userData.proceduralFallbackMeshes = Object.freeze([wetland, margins]);
  group.add(wetland, margins);
  scene.add(group);
  return group;
}

function makeEnvironmentDensity(scene) {
  const group = new THREE.Group();
  const random = seededRandom(4871);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const groundCoverMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.34,
  });
  groundCoverMaterial.userData.surface = 'matte-multiscale-forest-floor-blades';
  const broadleafGroundCoverMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.42,
  });
  broadleafGroundCoverMaterial.userData.surface = 'waxy-broadleaf-understory-response';
  const coverCounts = shared.groundCoverGeometries.map((_, variant) => (
    Math.floor((SCENE_BUDGET.groundCover + 2 - variant) / 3)
  ));
  const coverMeshes = shared.groundCoverGeometries.map((geometry, variant) => {
    const material = variant === 2 ? broadleafGroundCoverMaterial : groundCoverMaterial;
    const mesh = new THREE.InstancedMesh(geometry, material, coverCounts[variant]);
    mesh.name = `world.environment-density.ground-cover-${variant + 1}`;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    return mesh;
  });
  const coverIndices = [0, 0, 0];
  const coverPlacements = [];

  function blocksAuthoredRead(x, z) {
    if (Math.hypot(x - TRACK_IMPRESSION.x, z - TRACK_IMPRESSION.z) < 5.8) return true;
    if (Math.hypot(x - 1, z - 81) < 18) return true;
    if (z > 18 && z < 72 && Math.abs(x - 3) < 5.8) return true;
    if (z > -58 && z <= 18 && Math.abs(x - 1) < 8.5) return true;
    return FAMILY_LAYOUT.some((animal) => Math.hypot(x - animal.x, z - animal.z) < 3.2);
  }

  const forestFloorDetritus = createForestFloorDetritusLayer({
    terrainHeight,
    terrainGradient,
    terrainEcologyAt,
    sources: HABITAT_TREE_LAYOUT,
    heroSource: [HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z, HERO_GINGKO_LAYOUT.scale],
    blocksPlacement: blocksAuthoredRead,
    count: SCENE_BUDGET.forestFloorDetritus,
  });
  const bryophyteGroundLayer = createBryophyteGroundLayer({
    terrainHeight,
    terrainGradient,
    terrainEcologyAt,
    blocksPlacement: blocksAuthoredRead,
    targetCount: SCENE_BUDGET.bryophyteGround,
  });

  const shadeClusters = HABITAT_TREE_LAYOUT.map(([x, z, scale], index) => ({
    x,
    z,
    radius: 3.6 + scale * 2.1,
    microclimate: index % 2 ? 'broken-canopy-shade' : 'trunk-dripline',
  }));
  const wetlandClusters = Array.from({ length: 12 }, (_, index) => {
    const z = THREE.MathUtils.lerp(76, -66, index / 11);
    const brookX = -11.5 + Math.sin(z * 0.071) * 3.1;
    const side = index % 2 ? -1 : 1;
    return {
      x: brookX + side * (4.8 + (index % 3) * 0.62),
      z,
      radius: 3.2 + (index % 4) * 0.55,
      microclimate: 'brook-bank-moisture',
    };
  });
  const coverClusters = [...shadeClusters, ...wetlandClusters];

  for (let index = 0; index < SCENE_BUDGET.groundCover; index += 1) {
    let cluster = coverClusters[index % coverClusters.length];
    let x;
    let z;
    let attempts = 0;
    do {
      if (attempts > 0 && attempts % 6 === 0) {
        cluster = coverClusters[(index + attempts / 6) % coverClusters.length];
      }
      const angle = random() * Math.PI * 2;
      const radius = cluster.radius * random() ** 1.55;
      x = cluster.x + Math.cos(angle) * radius;
      z = cluster.z + Math.sin(angle) * radius * (0.72 + random() * 0.42);
      attempts += 1;
    } while (blocksAuthoredRead(x, z) && attempts < 30);
    const variant = index % coverMeshes.length;
    const wetness = terrainWetness(x, z);
    const scale = 0.42 + random() ** 1.35 * 1.12;
    const tiltX = (random() - 0.5) * 0.05;
    const rotation = random() * Math.PI * 2;
    const tiltZ = (random() - 0.5) * 0.08;
    const instanceScale = [
      scale * (0.72 + random() * 0.52),
      scale * (0.72 + random() * 0.58),
      scale * (0.72 + random() * 0.52),
    ];
    dummy.position.set(x, terrainHeight(x, z) + 0.018, z);
    dummy.rotation.set(tiltX, rotation, tiltZ);
    dummy.scale.set(...instanceScale);
    dummy.updateMatrix();
    const mesh = coverMeshes[variant];
    const instanceIndex = coverIndices[variant];
    mesh.setMatrixAt(instanceIndex, dummy.matrix);
    const coverColor = [
      0.285 + wetness * 0.075 + random() * 0.035,
      0.34 + random() * 0.16,
      0.115 + random() * 0.075,
    ];
    color.setHSL(...coverColor);
    mesh.setColorAt(instanceIndex, color);
    coverPlacements.push(Object.freeze({
      index,
      x,
      z,
      scale,
      variantIndex: variant,
      rotation,
      instanceScale: Object.freeze(instanceScale),
      color: Object.freeze(coverColor),
      microclimate: cluster.microclimate,
    }));
    coverIndices[variant] += 1;
  }

  const groundCoverAssetAnchor = new THREE.Group();
  groundCoverAssetAnchor.name = 'world.environment-density.ground-cover.asset-anchor';
  groundCoverAssetAnchor.userData.fallbackMeshes = coverMeshes;
  groundCoverAssetAnchor.userData.supportModel = GROUND_COVER_LIBRARY_ASSET.supportModel;
  groundCoverAssetAnchor.userData.collisionRole = GROUND_COVER_LIBRARY_ASSET.collisionRole;

  const forestSuccession = createForestSuccessionLayout({
    count: SCENE_BUDGET.distantTrees,
    terrainHeight,
    terrainGradient,
    terrainWetness,
    navigationBounds: NAVIGATION_BOUNDS,
  });
  const forestEdgeTrees = Object.freeze(forestSuccession.placements
    .map((placement, index) => Object.freeze({
      index,
      x: placement.x,
      z: placement.z,
      scale: placement.heightScale * 0.92,
      trunkYaw: placement.yaw,
      isAraucaria: placement.crownVariant === 1,
      barkFamily: placement.crownVariant === 1 || index % 3 !== 2
        ? 'wet-furrowed'
        : 'plate-barked',
      leafFamily: placement.crownVariant === 1
        ? 'araucaria-whorl'
        : index % 3 === 2 ? 'compound-lanceolate' : 'elliptic-waxy',
      successionCohortId: placement.cohortId,
      successionAgeClass: placement.ageClass,
      successionWindDamage: placement.windDamage,
    })));
  // Keep the old low-detail batch only as a complete loading fallback. At the
  // accepted runtime all twelve cohorts use the same root-to-leaf original
  // asset, so the southern skyline cannot collapse into unrelated pale blobs.
  const simplifiedForestPlacements = forestSuccession.placements;
  const forestEdgeAssetAnchor = new THREE.Group();
  forestEdgeAssetAnchor.name = 'world.environment-density.forest-edge.original-canopy-anchor';
  forestEdgeAssetAnchor.userData.fallbackMeshes = Object.freeze([]);
  forestEdgeAssetAnchor.userData.placements = forestEdgeTrees;
  forestEdgeAssetAnchor.userData.cohortCount = new Set(
    forestEdgeTrees.map(({ successionCohortId }) => successionCohortId),
  ).size;
  forestEdgeAssetAnchor.userData.ageCounts = Object.freeze(
    forestEdgeTrees.reduce((countsByAge, { successionAgeClass }) => ({
      ...countsByAge,
      [successionAgeClass]: (countsByAge[successionAgeClass] ?? 0) + 1,
    }), {}),
  );
  forestEdgeAssetAnchor.userData.supportModel = CANOPY_TREE_LIBRARY_ASSET.supportModel;
  forestEdgeAssetAnchor.userData.collisionRole =
    'inaccessible-solid-trunks-beyond-navigation-with-overhanging-pliable-crowns';
  forestEdgeTrees.forEach((tree) => {
    const anchor = new THREE.Group();
    anchor.name = `world.environment-density.forest-edge-placement-${tree.index + 1}`;
    anchor.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z);
    anchor.userData.canopyTreePlacementAnchor = true;
    anchor.userData.successionCohortId = tree.successionCohortId;
    forestEdgeAssetAnchor.add(anchor);
  });
  const distantTrunkMaterial = new THREE.MeshStandardMaterial({
    color: 0xa69a88,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.18,
  });
  distantTrunkMaterial.emissive.set(0x000000);
  distantTrunkMaterial.emissiveIntensity = 0;
  distantTrunkMaterial.userData = {
    surface: 'bounded-distant-bark-dielectric-response',
    energyModel: 'non-emissive-dielectric-forest-boundary-structure',
  };
  const distantTrunks = new THREE.InstancedMesh(
    shared.trunkGeometry,
    distantTrunkMaterial,
    simplifiedForestPlacements.length,
  );
  const distantCrownMaterials = [
    VEGETATION_BASE_COLOURS.canopyBroadleaf,
    VEGETATION_BASE_COLOURS.canopyAraucaria,
    VEGETATION_BASE_COLOURS.treeFernLeaf,
  ].map((baseColour, crownVariant) => {
    const material = new THREE.MeshStandardMaterial({
      color: baseColour,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.24,
    });
    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;
    material.userData = {
      surface: 'bounded-distant-canopy-dielectric-response',
      energyModel: 'non-emissive-dielectric-diffuse-forest-boundary-foliage',
      crownVariant,
      successionProfile: FOREST_SUCCESSION_PROFILE.version,
    };
    return material;
  });
  const distantCrownCounts = [0, 1, 2].map((crownVariant) => (
    simplifiedForestPlacements.filter((placement) => (
      placement.crownVariant === crownVariant
    )).length
  ));
  const distantCrownMeshes = [
    new THREE.InstancedMesh(
      shared.crownGeometry, distantCrownMaterials[0], distantCrownCounts[0],
    ),
    new THREE.InstancedMesh(
      shared.araucariaGeometry, distantCrownMaterials[1], distantCrownCounts[1],
    ),
    new THREE.InstancedMesh(
      shared.treeFernCrownGeometries[1], distantCrownMaterials[2], distantCrownCounts[2],
    ),
  ];
  const distantCrownIndices = [0, 0, 0];
  simplifiedForestPlacements.forEach((placement, simplifiedIndex) => {
    const {
      x, z, groundY, yaw, trunkScale, crownVariant, crownScale,
      crownOffset, heightScale, wetness, slope, individual,
    } = placement;
    dummy.position.set(x, groundY - 0.025, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(...trunkScale);
    dummy.updateMatrix();
    distantTrunks.setMatrixAt(simplifiedIndex, dummy.matrix);
    const structureAlbedo = vegetationStructureTint({
      hue: crownVariant === 1 ? 0.075 : 0.09,
      wetness,
      individual,
      baseLightness: 0.61,
    });
    color.setHSL(
      structureAlbedo.hue,
      structureAlbedo.saturation,
      structureAlbedo.lightness,
    );
    distantTrunks.setColorAt(simplifiedIndex, color);

    const sourceCrownHeight = crownVariant === 2 ? 2.72 : crownVariant === 1 ? 5.7 : 6.02;
    dummy.position.set(
      x + crownOffset[0],
      groundY + sourceCrownHeight * heightScale,
      z + crownOffset[1],
    );
    dummy.rotation.set(0, yaw + placement.windDamage * 0.28, 0);
    dummy.scale.set(...crownScale);
    dummy.updateMatrix();
    const distantCrownMesh = distantCrownMeshes[crownVariant];
    const distantCrownIndex = distantCrownIndices[crownVariant];
    distantCrownMesh.setMatrixAt(distantCrownIndex, dummy.matrix);
    const leafAlbedo = vegetationLeafTint([
      'canopy-drained-broadleaf',
      'canopy-araucaria',
      'tree-fern-exposed',
    ][crownVariant], {
      wetness,
      slope,
      individual,
    });
    color.setHSL(leafAlbedo.hue, leafAlbedo.saturation, leafAlbedo.lightness);
    distantCrownMesh.setColorAt(distantCrownIndex, color);
    distantCrownIndices[crownVariant] += 1;
  });
  distantTrunks.name = 'world.environment-density.distant-trunks';
  // These low-detail crowns remain outside the navigation boundary and do not
  // enter the directional shadow pass. The complete mid-distance edge assets
  // below carry the visible local shadow relationship instead.
  distantTrunks.castShadow = false;
  distantTrunks.receiveShadow = true;
  distantTrunks.userData.compositionRole = 'terrain-supported-inaccessible-forest-boundary';
  distantTrunks.userData.successionProfile = FOREST_SUCCESSION_PROFILE.version;
  distantCrownMeshes.forEach((mesh, index) => {
    mesh.name = index === 0
      ? 'world.environment-density.distant-canopy'
      : `world.environment-density.distant-canopy-variant-${index + 1}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.compositionRole = 'overlapping-age-stratified-forest-edge-canopy';
    mesh.userData.successionProfile = FOREST_SUCCESSION_PROFILE.version;
  });
  forestEdgeAssetAnchor.userData.fallbackMeshes = Object.freeze([
    distantTrunks,
    ...distantCrownMeshes,
  ]);

  const deadfallMaterial = createDeadwoodMaterial();
  const deadfallMeshes = [0, 1, 2].map((variant) => {
    const count = Math.floor((SCENE_BUDGET.deadfall + 2 - variant) / 3);
    const mesh = new THREE.InstancedMesh(createDriftwoodGeometry(variant), deadfallMaterial, count);
    mesh.name = `world.environment-density.deadfall-${variant + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionRole = 'non-solid-visual-accent';
    return mesh;
  });
  const deadfallIndices = [0, 0, 0];
  const deadfallSupportEvidence = {
    instanceCount: 0,
    supportSampleCount: 0,
    minimumClearance: Infinity,
    maximumClearance: -Infinity,
    maximumTerrainSlope: 0,
  };
  const supportPoint = new THREE.Vector3();
  const terrainNormal = new THREE.Vector3();
  const slopeFrame = new THREE.Quaternion();
  const yawFrame = new THREE.Quaternion();
  const measureDeadfallSupport = (geometry) => {
    let minimumClearance = Infinity;
    let maximumClearance = -Infinity;
    for (const coordinates of geometry.userData.supportPoints) {
      supportPoint.set(...coordinates).applyMatrix4(dummy.matrix);
      const clearance = supportPoint.y - terrainHeight(supportPoint.x, supportPoint.z);
      minimumClearance = Math.min(minimumClearance, clearance);
      maximumClearance = Math.max(maximumClearance, clearance);
    }
    return { minimumClearance, maximumClearance };
  };
  for (let index = 0; index < SCENE_BUDGET.deadfall; index += 1) {
    const variant = index % deadfallMeshes.length;
    const geometry = deadfallMeshes[variant].geometry;
    let settled = false;
    let support = null;
    let candidateSlope = Infinity;
    for (let attempt = 0; attempt < 80 && !settled; attempt += 1) {
      const side = index % 2 ? -1 : 1;
      const z = -65 + random() * 132;
      const x = side * (12 + random() * 37);
      const scale = 0.72 + random() * 0.86;
      const yaw = random() * Math.PI;
      candidateSlope = terrainSlope(x, z);
      if (candidateSlope > 0.18 || blocksAuthoredRead(x, z)) continue;
      const gradient = terrainGradient(x, z, 0.45);
      terrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
      slopeFrame.setFromUnitVectors(new THREE.Vector3(0, 1, 0), terrainNormal);
      yawFrame.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      dummy.position.set(x, terrainHeight(x, z) + 0.09 * scale, z);
      dummy.quaternion.multiplyQuaternions(slopeFrame, yawFrame);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      support = measureDeadfallSupport(geometry);
      dummy.position.y -= support.maximumClearance - 0.012;
      dummy.updateMatrix();
      support = measureDeadfallSupport(geometry);
      settled = support.maximumClearance <= 0.02 && support.minimumClearance >= -0.14;
    }
    if (!settled || !support) throw new Error(`could not settle deadfall instance ${index}`);
    const deadfallMesh = deadfallMeshes[variant];
    const deadfallInstanceIndex = deadfallIndices[variant];
    deadfallMesh.setMatrixAt(deadfallInstanceIndex, dummy.matrix);
    color.setHSL(
      0.075 + (index % 4) * 0.008,
      0.035 + (index % 3) * 0.008,
      0.62 - terrainWetness(dummy.position.x, dummy.position.z) * 0.075
        + ((index * 7) % 5 - 2) * 0.012,
    );
    deadfallMesh.setColorAt(deadfallInstanceIndex, color);
    deadfallIndices[variant] += 1;
    deadfallSupportEvidence.instanceCount += 1;
    deadfallSupportEvidence.supportSampleCount += geometry.userData.supportPoints.length;
    deadfallSupportEvidence.minimumClearance = Math.min(
      deadfallSupportEvidence.minimumClearance,
      support.minimumClearance,
    );
    deadfallSupportEvidence.maximumClearance = Math.max(
      deadfallSupportEvidence.maximumClearance,
      support.maximumClearance,
    );
    deadfallSupportEvidence.maximumTerrainSlope = Math.max(
      deadfallSupportEvidence.maximumTerrainSlope,
      candidateSlope,
    );
  }

  group.add(
    forestFloorDetritus,
    bryophyteGroundLayer,
    ...coverMeshes,
    groundCoverAssetAnchor,
    forestEdgeAssetAnchor,
    distantTrunks,
    ...distantCrownMeshes,
    ...deadfallMeshes,
  );
  group.name = 'world.environment-density';
  group.userData.profile = 'near-mid-far-instanced-habitat-density';
  group.userData.groundCoverDistribution = 'shade-and-wetness-clustered-microhabitats';
  group.userData.groundCoverClusterCount = coverClusters.length;
  group.userData.forestSuccessionProfile = FOREST_SUCCESSION_PROFILE.version;
  group.userData.forestSuccession = forestSuccession.summary;
  group.userData.forestCollisionModel = FOREST_SUCCESSION_PROFILE.collisionModel;
  group.userData.forestEdgeAssetAnchor = forestEdgeAssetAnchor;
  group.userData.forestEdgeTrees = forestEdgeTrees;
  group.userData.forestEdgeOriginalDrawCalls = 0;
  group.userData.forestFallbackDrawCalls = 1 + distantCrownMeshes.length;
  group.userData.forestFallbackActiveDrawCalls = 1 + distantCrownMeshes.length;
  group.userData.instanceCount = SCENE_BUDGET.groundCover
    + SCENE_BUDGET.forestFloorDetritus
    + bryophyteGroundLayer.userData.instanceCount
    + SCENE_BUDGET.distantTrees * 2
    + SCENE_BUDGET.deadfall;
  group.userData.drawCalls = coverMeshes.length + 1 + distantCrownMeshes.length
    + deadfallMeshes.length + FOREST_FLOOR_DETRITUS_PROFILE.drawCalls
    + BRYOPHYTE_GROUND_LAYER_PROFILE.drawCalls;
  group.userData.groundCoverFallbackDrawCalls = coverMeshes.length;
  group.userData.groundCoverActiveDrawCalls = coverMeshes.length;
  group.userData.nonGroundCoverDrawCalls = 1 + distantCrownMeshes.length
    + deadfallMeshes.length + FOREST_FLOOR_DETRITUS_PROFILE.drawCalls
    + BRYOPHYTE_GROUND_LAYER_PROFILE.drawCalls;
  group.userData.groundCoverMeshes = Object.freeze(coverMeshes);
  group.userData.groundCoverPlacements = Object.freeze(coverPlacements);
  group.userData.groundCoverAssetAnchor = groundCoverAssetAnchor;
  group.userData.forestFloorDetritus = forestFloorDetritus;
  group.userData.bryophyteGroundLayer = bryophyteGroundLayer;
  group.userData.deadfallSupportModel =
    'gravity-settled-tangent-aligned-multipoint-deadfall';
  group.userData.deadfallSupportEvidence = Object.freeze(deadfallSupportEvidence);
  group.userData.deadfallMaterial = deadfallMaterial;
  group.userData.deadfallMeshes = Object.freeze(deadfallMeshes);
  group.userData.collisionRole = 'non-solid-visual-accent';
  scene.add(group);
  return group;
}

function makeBrookBoulder(scene) {
  const geometry = createWeatheredRockGeometry(2027, 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x59655d,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: false,
    dithering: true,
    envMapIntensity: 0.06,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.heroRockAlbedo = { value: rockTextures.albedo };
    shader.uniforms.heroRockRoughness = { value: rockTextures.roughness };
    shader.uniforms.heroRockHeight = { value: rockTextures.height };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vHeroRockObjectPosition;
        varying vec3 vHeroRockObjectNormal;
      `)
      .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        vHeroRockObjectNormal = objectNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vHeroRockObjectPosition = transformed;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform sampler2D heroRockAlbedo;
        uniform sampler2D heroRockRoughness;
        uniform sampler2D heroRockHeight;
        varying vec3 vHeroRockObjectPosition;
        varying vec3 vHeroRockObjectNormal;

        vec3 heroRockBlendWeights() {
          vec3 weights = pow(abs(normalize(vHeroRockObjectNormal)), vec3(2.6));
          return weights / max(dot(weights, vec3(1.0)), 0.0001);
        }

        vec3 sampleHeroRockAlbedo() {
          vec3 weights = heroRockBlendWeights();
          vec3 point = vHeroRockObjectPosition * 1.35;
          vec3 xSample = texture2D(heroRockAlbedo, point.zy + vec2(0.17, 0.29)).rgb;
          vec3 ySample = texture2D(heroRockAlbedo, point.xz + vec2(0.41, 0.13)).rgb;
          vec3 zSample = texture2D(heroRockAlbedo, point.xy + vec2(0.07, 0.47)).rgb;
          return xSample * weights.x + ySample * weights.y + zSample * weights.z;
        }

        float sampleHeroRockRoughness() {
          vec3 weights = heroRockBlendWeights();
          vec3 point = vHeroRockObjectPosition * 1.35;
          return texture2D(heroRockRoughness, point.zy + vec2(0.17, 0.29)).g * weights.x
            + texture2D(heroRockRoughness, point.xz + vec2(0.41, 0.13)).g * weights.y
            + texture2D(heroRockRoughness, point.xy + vec2(0.07, 0.47)).g * weights.z;
        }

        float sampleHeroRockHeight() {
          vec3 weights = heroRockBlendWeights();
          vec3 point = vHeroRockObjectPosition * 1.35;
          return texture2D(heroRockHeight, point.zy + vec2(0.17, 0.29)).r * weights.x
            + texture2D(heroRockHeight, point.xz + vec2(0.41, 0.13)).r * weights.y
            + texture2D(heroRockHeight, point.xy + vec2(0.07, 0.47)).r * weights.z;
        }

        vec3 perturbHeroRockNormal(
          vec3 surfacePosition,
          vec3 surfaceNormal,
          vec2 heightDerivatives,
          float direction
        ) {
          vec3 sigmaX = normalize(dFdx(surfacePosition));
          vec3 sigmaY = normalize(dFdy(surfacePosition));
          vec3 responseX = cross(sigmaY, surfaceNormal);
          vec3 responseY = cross(surfaceNormal, sigmaX);
          float determinant = dot(sigmaX, responseX) * direction;
          vec3 gradient = sign(determinant)
            * (heightDerivatives.x * responseX + heightDerivatives.y * responseY);
          return normalize(abs(determinant) * surfaceNormal - gradient);
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 heroRockSample = sampleHeroRockAlbedo();
        float heroRockLuma = dot(heroRockSample, vec3(0.2126, 0.7152, 0.0722));
        float heroRockMineral = smoothstep(0.11, 0.42, heroRockLuma);
        vec3 heroRockTint = heroRockSample / max(heroRockLuma, 0.08);
        diffuseColor.rgb *= mix(0.7, 1.08, heroRockMineral)
          * mix(vec3(1.0), heroRockTint, 0.18);
        float heroRockWetBand = 1.0 - smoothstep(
          -0.4,
          -0.12,
          vHeroRockObjectPosition.y
        );
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.48, 0.61, 0.55),
          heroRockWetBand
        );
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float heroRockRelief = sampleHeroRockHeight();
        vec2 heroRockReliefGradient = vec2(
          dFdx(heroRockRelief),
          dFdy(heroRockRelief)
        ) * 0.22;
        normal = perturbHeroRockNormal(
          -vViewPosition,
          normal,
          heroRockReliefGradient,
          faceDirection
        );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(
          mix(roughnessFactor, sampleHeroRockRoughness(), 0.72),
          0.88,
          1.0
        );
        float heroRockWetRoughness = 1.0 - smoothstep(
          -0.4,
          -0.12,
          vHeroRockObjectPosition.y
        );
        roughnessFactor = mix(roughnessFactor, 0.7, heroRockWetRoughness * 0.72);
      `);
  };
  material.customProgramCacheKey = () => 'hero-rock-triplanar-weathering-v1';
  material.userData.surface = 'continuous-weathered-rock-fracture-and-wetness';
  material.userData.layers = Object.freeze([
    'broad-clipped-fracture-planes',
    'continuous-weathered-edge-normals',
    'restrained-mineral-variation',
    'dark-lower-capillary-band',
    'seam-free-triplanar-albedo-roughness-relief',
  ]);
  material.userData.triplanarTextures = Object.freeze({
    albedo: rockTextures.albedo,
    roughness: rockTextures.roughness,
    height: rockTextures.height,
  });
  const boulder = new THREE.Mesh(geometry, material);
  boulder.position.set(BROOK_BOULDER.x, 0, BROOK_BOULDER.z);
  // The residual bank erratic settles with its broad weathered base down. It is
  // re-exposed beside the modern brook, not presented as load transported by
  // the present flow. Large pitch/roll values made the former form read as a
  // hovering capsule and contradicted its static load-bearing role.
  const gradient = terrainGradient(BROOK_BOULDER.x, BROOK_BOULDER.z, 0.35);
  const supportNormal = new THREE.Vector3(-gradient.x, 1, -gradient.z).normalize();
  const terrainAlignment = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    supportNormal,
  );
  const geologicalYaw = new THREE.Quaternion().setFromAxisAngle(supportNormal, 0.54);
  boulder.quaternion.multiplyQuaternions(geologicalYaw, terrainAlignment);
  boulder.scale.set(1.3, 0.98, 1.2);
  boulder.updateMatrixWorld(true);
  const localVertex = new THREE.Vector3();
  let groundingOffset = -Infinity;
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    localVertex.fromBufferAttribute(positions, index);
    boulder.localToWorld(localVertex);
    groundingOffset = Math.max(
      groundingOffset,
      terrainHeight(localVertex.x, localVertex.z) - 0.035 - localVertex.y,
    );
  }
  boulder.position.y = groundingOffset;
  boulder.updateMatrixWorld(true);
  let supportVertexCount = 0;
  for (let index = 0; index < positions.count; index += 1) {
    localVertex.fromBufferAttribute(positions, index);
    boulder.localToWorld(localVertex);
    const clearance = localVertex.y - terrainHeight(localVertex.x, localVertex.z);
    if (clearance <= 0.055) supportVertexCount += 1;
  }
  boulder.userData.minimumTerrainClearance = -0.035;
  boulder.userData.supportVertexCount = supportVertexCount;
  boulder.userData.supportModel = 'sediment-embedded-flat-base-multipoint-contact';
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  boulder.name = 'world.connected_route.brook-boulder.procedural-fallback';
  boulder.userData.collisionRole = 'solid-boulder-fallback';

  const anchor = new THREE.Group();
  anchor.position.copy(boulder.position);
  anchor.quaternion.copy(boulder.quaternion);
  anchor.scale.copy(boulder.scale);
  boulder.position.set(0, 0, 0);
  boulder.quaternion.identity();
  boulder.scale.set(1, 1, 1);
  anchor.add(boulder);
  anchor.name = 'world.connected_route.brook-boulder';
  anchor.userData.fallback = boulder;
  anchor.userData.minimumTerrainClearance = -0.035;
  anchor.userData.supportVertexCount = supportVertexCount;
  anchor.userData.supportModel = 'sediment-embedded-flat-base-multipoint-contact';
  anchor.userData.collisionRole = 'solid-boulder';
  anchor.userData.transportClass = BROOK_BOULDER.transportClass;
  anchor.userData.presentFlowMobility = BROOK_BOULDER.presentFlowMobility;
  anchor.userData.visualSource = 'procedural-fallback';
  scene.add(anchor);
  return anchor;
}

const brookBoulderSupportPoint = new THREE.Vector3();

function brookBoulderSupportVertices(anchor, callback, includeObject = () => true) {
  const visual = anchor.userData.assetVisual;
  if (!visual) return 0;
  anchor.updateMatrixWorld(true);
  let count = 0;
  visual.traverse((object) => {
    if (!object.isMesh) return;
    if (!includeObject(object)) return;
    const positions = object.geometry.getAttribute('position');
    const supportPlaneY = object.geometry.userData.supportPlaneY
      ?? BROOK_BOULDER_ASSET.supportPlaneY;
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) > supportPlaneY + 0.0002) continue;
      brookBoulderSupportPoint.fromBufferAttribute(positions, index);
      object.localToWorld(brookBoulderSupportPoint);
      callback(brookBoulderSupportPoint, object);
      count += 1;
    }
  });
  return count;
}

function settleBrookBoulderAsset(anchor) {
  const requiredDeltas = [];
  brookBoulderSupportVertices(anchor, (point) => {
    requiredDeltas.push(terrainHeight(point.x, point.z) - 0.085 - point.y);
  }, (object) => object.name === 'brook-boulder-load-bearing-mass');
  if (requiredDeltas.length) {
    anchor.position.y += Math.max(...requiredDeltas);
    anchor.updateMatrixWorld(true);
  }
  const spalls = [];
  anchor.userData.assetVisual.traverse((object) => {
    if (object.isMesh && object.name.startsWith('brook-boulder-spall-')) spalls.push(object);
  });
  for (const spall of spalls) {
    const fragmentDeltas = [];
    brookBoulderSupportVertices(anchor, (point) => {
      fragmentDeltas.push(terrainHeight(point.x, point.z) - 0.025 - point.y);
    }, (object) => object === spall);
    if (!fragmentDeltas.length) continue;
    spall.parent.updateMatrixWorld(true);
    const worldVerticalPerLocalY = spall.parent.matrixWorld.elements[5];
    spall.position.y += Math.max(...fragmentDeltas) / worldVerticalPerLocalY;
    spall.updateMatrixWorld(true);
  }
}

function measureBrookBoulderSupport(anchor) {
  let supportVertexCount = 0;
  let supportedVertexCount = 0;
  let minimumClearance = Infinity;
  let maximumClearance = -Infinity;
  brookBoulderSupportVertices(anchor, (point) => {
    const clearance = point.y - terrainHeight(point.x, point.z);
    supportVertexCount += 1;
    if (clearance <= 0.055) supportedVertexCount += 1;
    minimumClearance = Math.min(minimumClearance, clearance);
    maximumClearance = Math.max(maximumClearance, clearance);
  });
  const evidence = Object.freeze({
    supportVertexCount,
    supportedVertexCount,
    supportRatio: supportVertexCount ? supportedVertexCount / supportVertexCount : 0,
    minimumClearance,
    maximumClearance,
    burialDepth: 0.085,
  });
  anchor.userData.supportEvidence = evidence;
  anchor.userData.supportModel = BROOK_BOULDER_ASSET.supportModel;
  return evidence;
}

function createBasaltOutcropGeometry(formations) {
  const radialSegments = 18;
  const ringCount = 3;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const deepBasalt = new THREE.Color(PALETTE.basaltShade);
  const oxidizedBasalt = new THREE.Color(PALETTE.basalt);
  const vertexColor = new THREE.Color();
  formations.forEach((formation, formationIndex) => {
    const start = vertices.length / 3;
    const centreHeight = terrainHeight(formation.x, formation.z);
    vertices.push(formation.x, centreHeight + 0.065, formation.z);
    vertexColor.copy(deepBasalt).lerp(oxidizedBasalt, 0.1);
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    uvs.push(formation.x * 0.08, formation.z * 0.08);
    for (let ring = 1; ring <= ringCount; ring += 1) {
      const normalizedRing = ring / ringCount;
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * Math.PI * 2 + formation.yaw;
        const irregularity = 1
          + Math.sin(angle * 5 + formationIndex * 1.7) * 0.07
          + Math.sin(angle * 8 - formationIndex * 0.8) * 0.035;
        const radius = normalizedRing * (3.25 + formationIndex * 0.2) * irregularity;
        const x = formation.x + Math.cos(angle) * radius * (1 + formationIndex * 0.05);
        const z = formation.z + Math.sin(angle) * radius * (0.82 + formationIndex * 0.04);
        const ground = terrainHeight(x, z);
        const shelfLift = (1 - normalizedRing) * 0.045
          + Math.max(0, Math.sin(angle * 3.0 + formationIndex) * 0.008);
        vertices.push(x, ground + 0.006 + shelfLift, z);
        const oxidation = THREE.MathUtils.clamp(
          0.05 + normalizedRing * 0.16 + Math.sin(angle * 4 + formationIndex) * 0.03,
          0.04,
          0.24,
        );
        vertexColor.copy(deepBasalt).lerp(oxidizedBasalt, oxidation);
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
        uvs.push(x * 0.08, z * 0.08);
      }
    }
    const ringVertex = (ring, segment) => (
      start + 1 + (ring - 1) * radialSegments + ((segment + radialSegments) % radialSegments)
    );
    for (let segment = 0; segment < radialSegments; segment += 1) {
      indices.push(start, ringVertex(1, segment + 1), ringVertex(1, segment));
    }
    for (let ring = 1; ring < ringCount; ring += 1) {
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const inner = ringVertex(ring, segment);
        const innerNext = ringVertex(ring, segment + 1);
        const outer = ringVertex(ring + 1, segment);
        const outerNext = ringVertex(ring + 1, segment + 1);
        indices.push(inner, innerNext, outer, innerNext, outerNext, outer);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'terrain-conforming-shared-bedrock-outcrop';
  geometry.userData.formationCount = formations.length;
  geometry.userData.contactModel = 'buried-columns-on-continuous-weathered-bedrock';
  return geometry;
}

function makeBasalt(scene) {
  const geometry = createFracturedBasaltGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  const pillarMaterial = material.clone();
  pillarMaterial.map = basaltDetailTextures.albedo;
  pillarMaterial.roughnessMap = basaltDetailTextures.roughness;
  pillarMaterial.bumpMap = basaltDetailTextures.height;
  pillarMaterial.bumpScale = 0.038;
  pillarMaterial.envMapIntensity = 0.2;
  pillarMaterial.userData.surface = 'oxidized-columnar-basalt-with-cooling-joints';
  const pillars = new THREE.InstancedMesh(geometry, pillarMaterial, SCENE_BUDGET.basaltPillars);
  const seamGeometry = new THREE.TorusGeometry(1, 0.018, 3, 6, Math.PI * 2);
  seamGeometry.rotateX(Math.PI / 2);
  seamGeometry.userData.profile = 'polygon-following-cross-joint-seam';
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x39211d,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
  });
  const seams = new THREE.InstancedMesh(
    seamGeometry,
    seamMaterial,
    SCENE_BUDGET.basaltPillars * 2,
  );
  const spallGeometry = new THREE.DodecahedronGeometry(1, 0);
  spallGeometry.userData.profile = 'attached-basalt-spall-ledge';
  const spalls = new THREE.InstancedMesh(
    spallGeometry,
    material,
    SCENE_BUDGET.basaltPillars,
  );
  const crustGeometry = new THREE.DodecahedronGeometry(1, 0);
  crustGeometry.userData.profile = 'thin-mineral-weathering-crust';
  const crusts = new THREE.InstancedMesh(
    crustGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.015,
      flatShading: true,
    }),
    SCENE_BUDGET.basaltPillars * 2,
  );
  const dummy = new THREE.Object3D();
  const attached = new THREE.Object3D();
  const attachedMatrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const random = seededRandom(720);
  const clusters = BASALT_FORMATION_LAYOUT;
  const packedColumnLayout = [
    [0, 0, 1],
    [-1.48, 0.2, 0.88],
    [1.46, 0.28, 0.78],
    [-0.76, -1.34, 0.64],
    [0.78, -1.38, 0.52],
    [2.13, -0.82, 0.4],
  ];
  const outcropMaterial = pillarMaterial.clone();
  outcropMaterial.bumpScale = 0.024;
  outcropMaterial.roughness = 0.98;
  outcropMaterial.userData.surface = 'weathered-continuous-basalt-bedrock';
  const outcrops = new THREE.Mesh(createBasaltOutcropGeometry(clusters), outcropMaterial);
  outcrops.name = 'world.connected_route.red-basalt-bedrock-outcrops';
  outcrops.receiveShadow = true;
  outcrops.userData.collisionRole = 'non-solid-outside-navigation-boundary';
  const pillarDescriptors = [];
  let crustIndex = 0;
  for (let i = 0; i < SCENE_BUDGET.basaltPillars; i += 1) {
    const cluster = Math.floor(i / 6);
    const local = i % 6;
    const formation = clusters[cluster];
    const [layoutX, layoutZ, heightFactor] = packedColumnLayout[local];
    const localX = cluster === 1 ? -layoutX * 0.92 : layoutX * (cluster === 2 ? 1.08 : 1);
    const localZ = layoutZ * (cluster === 0 ? 0.92 : cluster === 2 ? 1.12 : 1.02);
    const cos = Math.cos(formation.yaw);
    const sin = Math.sin(formation.yaw);
    const x = formation.x + localX * cos - localZ * sin + (random() - 0.5) * 0.45;
    const z = formation.z + localX * sin + localZ * cos + (random() - 0.5) * 0.45;
    const broken = heightFactor < 0.56;
    const clusterHeightScale = [0.86, 0.74, 0.96][cluster];
    const h = (6.8 + heightFactor * 13.5 + random() * 1.2) * clusterHeightScale;
    const radius = 0.78 + random() * 0.22;
    const ground = terrainHeight(x, z);
    const pillarYaw = formation.yaw + (random() - 0.5) * 0.38;
    dummy.position.set(x, ground + h / 2 - 0.24, z);
    dummy.rotation.set(
      formation.dipX + (random() - 0.5) * (broken ? 0.1 : 0.035),
      pillarYaw,
      formation.dipZ + (random() - 0.5) * (broken ? 0.13 : 0.045),
    );
    dummy.scale.set(
      radius * (0.94 + random() * 0.1),
      h,
      radius * (0.9 + random() * 0.1),
    );
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
    const pillarMatrix = dummy.matrix.clone();
    color.set(PALETTE.basalt).offsetHSL(
      (random() - 0.5) * 0.012,
      (random() - 0.5) * 0.07,
      (random() - 0.5) * 0.045,
    );
    pillars.setColorAt(i, color);

    for (let joint = 0; joint < 2; joint += 1) {
      const seamLevel = 0.25 + joint * 0.38 + random() * 0.1;
      attached.position.set(0, seamLevel - 0.5, 0);
      attached.rotation.set(0, random() * 0.12, 0);
      attached.scale.set(1.012, (0.42 + random() * 0.18) / h, 0.97);
      attached.updateMatrix();
      attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
      seams.setMatrixAt(i * 2 + joint, attachedMatrix);
    }

    const ledgeAngle = (i % 3) * 2.03 + random() * 0.42;
    const ledgeLevel = 0.31 + random() * 0.38;
    attached.position.set(
      Math.cos(ledgeAngle) * 0.98,
      ledgeLevel - 0.5,
      Math.sin(ledgeAngle) * 0.98,
    );
    attached.rotation.set(0, -ledgeAngle + Math.PI / 2, 0);
    attached.scale.set(
      0.18 + random() * 0.16,
      (0.07 + random() * 0.08) / h,
      (0.08 + random() * 0.06) / radius,
    );
    attached.updateMatrix();
    attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
    spalls.setMatrixAt(i, attachedMatrix);
    color.offsetHSL(0.004, -0.04, -0.035);
    spalls.setColorAt(i, color);

    for (let patch = 0; patch < 2; patch += 1) {
      const patchAngle = (patch ? 2.12 : -1.26) + (random() - 0.5) * 0.55;
      const patchLevel = 0.22 + patch * 0.43 + random() * 0.12;
      attached.position.set(
        Math.cos(patchAngle) * 0.98,
        patchLevel - 0.5,
        Math.sin(patchAngle) * 0.98,
      );
      attached.rotation.set(
        (random() - 0.5) * 0.24,
        -patchAngle + Math.PI / 2,
        (random() - 0.5) * 0.3,
      );
      attached.scale.set(
        0.08 + random() * 0.08,
        (0.16 + random() * 0.24) / h,
        (0.018 + random() * 0.018) / radius,
      );
      attached.updateMatrix();
      attachedMatrix.multiplyMatrices(pillarMatrix, attached.matrix);
      crusts.setMatrixAt(crustIndex, attachedMatrix);
      color.set(patch === 0 ? 0x6f3d2e : 0x5d3429).multiplyScalar(0.9 + random() * 0.16);
      crusts.setColorAt(crustIndex, color);
      crustIndex += 1;
    }
    pillarDescriptors.push({ x, z, radius, height: h, cluster, broken });
  }
  pillars.name = 'world.connected_route.red_basalt';
  pillars.castShadow = true;
  pillars.receiveShadow = true;
  pillars.userData.formationCount = clusters.length;
  pillars.userData.columnsPerFormation = packedColumnLayout.length;
  pillars.userData.formationFrame = 'shared-cooling-front-normal-with-bounded-jitter';
  pillars.userData.contactModel = 'buried-into-continuous-bedrock-outcrop';
  pillars.userData.diameterRangeMeters = [1.4, 2.1];
  seams.name = 'world.connected_route.red-basalt-fracture-seams';
  seams.castShadow = false;
  seams.receiveShadow = true;
  spalls.name = 'world.connected_route.red-basalt-spall-ledges';
  spalls.castShadow = true;
  spalls.receiveShadow = true;
  crusts.name = 'world.connected_route.red-basalt-mineral-crusts';
  crusts.castShadow = false;
  crusts.receiveShadow = true;

  const rubbleCount = 44;
  const rubbleGeometry = createNonColumnarRockGeometry('angular-talus');
  const rubbleMaterial = material.clone();
  rubbleMaterial.color.set(0x716b65);
  rubbleMaterial.roughness = 0.99;
  rubbleMaterial.metalness = 0;
  rubbleMaterial.envMapIntensity = 0.04;
  rubbleMaterial.userData.surface = 'dark-weathered-oxidized-basalt-talus';
  const rubble = new THREE.InstancedMesh(
    rubbleGeometry,
    rubbleMaterial,
    rubbleCount,
  );
  const rubbleRandom = seededRandom(904);
  const rubbleSupportEvidence = [];
  for (let index = 0; index < rubbleCount; index += 1) {
    const source = pillarDescriptors[index % pillarDescriptors.length];
    const gradientX = terrainHeight(source.x + 0.7, source.z)
      - terrainHeight(source.x - 0.7, source.z);
    const gradientZ = terrainHeight(source.x, source.z + 0.7)
      - terrainHeight(source.x, source.z - 0.7);
    const downhillAngle = Math.atan2(-gradientZ, -gradientX);
    const angle = index % 4 === 0
      ? rubbleRandom() * Math.PI * 2
      : downhillAngle + (rubbleRandom() - 0.5) * 1.7;
    const distance = source.radius * 0.72 + 0.28 + rubbleRandom() ** 1.45 * 2.65;
    const x = source.x + Math.cos(angle) * distance;
    const z = source.z + Math.sin(angle) * distance;
    const scale = 0.24 + rubbleRandom() ** 0.82 * (source.broken ? 0.82 : 0.58);
    const scaleVector = [
      scale * (0.82 + rubbleRandom() * 0.34),
      scale * (0.42 + rubbleRandom() * 0.26),
      scale * (0.72 + rubbleRandom() * 0.42),
    ];
    const burial = 0.018 + rubbleRandom() * 0.022;
    const support = settleRockOnTerrain(dummy, rubbleGeometry, {
      id: `red-basalt-rubble-${index + 1}`,
      x,
      z,
      yaw: rubbleRandom() * Math.PI * 2,
      scale: scaleVector,
      burial,
      solid: false,
    });
    rubbleSupportEvidence.push(support);
    rubble.setMatrixAt(index, dummy.matrix);
    color.set(PALETTE.basaltShade).lerp(
      new THREE.Color(0x554943),
      0.22 + rubbleRandom() * 0.28,
    );
    rubble.setColorAt(index, color);
  }
  rubble.name = 'world.connected_route.red-basalt-rubble';
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  rubble.userData.distribution = 'pillar-base-downslope-talus';
  rubble.userData.sourcePillarCount = pillarDescriptors.length;
  rubble.userData.settling = 'terrain-normal-aligned-multipoint-buried-support';
  rubble.userData.supportModel = 'closed-flat-footprint-gravity-rest-on-sourced-heightfield';
  rubble.userData.supportEvidence = Object.freeze(rubbleSupportEvidence);
  rubble.userData.collisionRole = 'non-solid-outside-navigation-boundary';
  const proceduralFallback = new THREE.Group();
  proceduralFallback.name = 'world.connected_route.red-basalt.procedural-upper-fallback';
  proceduralFallback.userData.profile = 'buried-columns-with-attached-joints-and-weathering';
  proceduralFallback.userData.supportModel = 'continuous-outcrop-to-buried-columns';
  proceduralFallback.add(pillars, seams, spalls, crusts);

  const assetScales = [1, 0.92, 1.03];
  const assetAnchors = clusters.map((formation, formationIndex) => {
    const anchor = new THREE.Group();
    const gradient = terrainGradient(formation.x, formation.z, 0.45);
    const terrainNormal = new THREE.Vector3(-gradient.x, 1, -gradient.z).normalize();
    const slopeFrame = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      terrainNormal,
    );
    const yawFrame = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      formation.yaw,
    );
    anchor.name = `world.connected_route.red-basalt-shelf.anchor-${formationIndex + 1}`;
    anchor.position.set(
      formation.x,
      terrainHeight(formation.x, formation.z) + 0.2,
      formation.z,
    );
    anchor.quaternion.multiplyQuaternions(slopeFrame, yawFrame);
    anchor.scale.setScalar(assetScales[formationIndex]);
    anchor.userData.formationIndex = formationIndex;
    anchor.userData.layout = { ...formation, scale: assetScales[formationIndex] };
    anchor.userData.supportModel = 'terrain-normal-aligned-buried-bedrock-plinth';
    anchor.userData.collisionRole = 'non-solid-outside-navigation-boundary';
    return anchor;
  });
  scene.add(outcrops, rubble, proceduralFallback, ...assetAnchors);
  return {
    assetAnchors,
    proceduralFallback,
    outcrops,
    rubble,
    pillars,
    seams,
    spalls,
    crusts,
  };
}

function measureBasaltShelfSupport(anchor) {
  const visual = anchor.userData.assetVisual;
  const massif = visual?.getObjectByName('basalt-shelf-load-bearing-massif');
  if (!massif?.isMesh) return null;
  anchor.updateMatrixWorld(true);
  const positions = massif.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  let bottomVertexCount = 0;
  let supportedBottomVertexCount = 0;
  let minimumBottomClearance = Infinity;
  let maximumBottomClearance = -Infinity;
  let minimumWorldX = Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);
    const localY = point.y;
    massif.localToWorld(point);
    minimumWorldX = Math.min(minimumWorldX, point.x);
    if (localY > -0.5) continue;
    bottomVertexCount += 1;
    const clearance = point.y - terrainHeight(point.x, point.z);
    minimumBottomClearance = Math.min(minimumBottomClearance, clearance);
    maximumBottomClearance = Math.max(maximumBottomClearance, clearance);
    if (clearance <= 0.04) supportedBottomVertexCount += 1;
  }
  const evidence = Object.freeze({
    bottomVertexCount,
    supportedBottomVertexCount,
    minimumBottomClearance,
    maximumBottomClearance,
    minimumWorldX,
    supportRatio: bottomVertexCount > 0 ? supportedBottomVertexCount / bottomVertexCount : 0,
  });
  anchor.userData.supportEvidence = evidence;
  return evidence;
}

function primitive(material, geometry, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeIguanodon(scene, x, z, scale, heading, young, behaviorRole) {
  const group = createIguanodon({
    young,
    materialVariant: young ? 'moss' : 'slate',
  });
  const { rig } = group.userData;
  const restPose = {
    neckZ: rig.neckPivot.rotation.z,
    headZ: rig.headPivot.rotation.z,
    jawZ: rig.jawPivot.rotation.z,
    tailZ: rig.tailPivots.map((pivot) => pivot.rotation.z),
    tailY: rig.tailPivots.map((pivot) => pivot.rotation.y),
    limbZ: Object.fromEntries(Object.entries(rig.limbs).map(([key, limb]) => [key, {
      upper: limb.upper.rotation.z,
      mid: limb.mid.rotation.z,
      distal: limb.distal.rotation.z,
    }])),
  };
  group.position.set(x, terrainHeight(x, z) + 0.035, z);
  group.rotation.y = heading;
  group.scale.setScalar(scale);
  group.userData = {
    ...group.userData,
    baseX: x,
    baseY: group.position.y,
    baseZ: z,
    baseHeading: heading,
    phase: x * 0.7 + z,
    young,
    behaviorRole,
    headPivot: rig.headPivot,
    rig,
    restPose,
  };
  scene.add(group);
  return group;
}

function makeFamily(scene) {
  return FAMILY_LAYOUT.map((animal) => makeIguanodon(
    scene,
    animal.x,
    animal.z,
    animal.scale,
    animal.heading,
    animal.young,
    animal.behaviorRole,
  ));
}

function makeFeedingBranch(scene) {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: 0x4a4632,
    vertexColors: true,
    roughness: 0.94,
    flatShading: true,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: PALETTE.wetFern,
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
  });
  const trunk = primitive(bark, shared.trunkGeometry, [0, 0, 0], [0.72, 1.18, 0.72]);
  const branchPivot = new THREE.Group();
  branchPivot.position.set(0, 4.6, 0);
  const bough = primitive(
    bark,
    createCylinderBetween([0, 0, 0], [-5.35, -0.08, 0.12], 0.26, 0.11, 7),
    [0, 0, 0],
    [1, 1, 1],
  );
  const upperTwig = primitive(
    bark,
    createCylinderBetween([-2.3, 0, 0.06], [-3.15, 0.72, 0.48], 0.105, 0.045, 6),
    [0, 0, 0],
    [1, 1, 1],
  );
  const lowerTwig = primitive(
    bark,
    createCylinderBetween([-3.55, -0.03, 0.08], [-4.25, 0.48, -0.52], 0.09, 0.04, 6),
    [0, 0, 0],
    [1, 1, 1],
  );
  branchPivot.add(bough, upperTwig, lowerTwig);
  for (let index = 0; index < 5; index += 1) {
    const crown = primitive(
      leaf,
      shared.crownAccentGeometry,
      [-1.35 - index * 0.84, 0.26 + (index % 2) * 0.34, (index % 2 - 0.5) * 0.62],
      [0.64 + (index % 2) * 0.08, 0.55, 0.62],
      [0, index * 0.48, (index % 2 - 0.5) * 0.16],
    );
    branchPivot.add(crown);
  }
  group.add(trunk, branchPivot);
  group.position.set(
    FEEDING_BRANCH.x,
    terrainHeight(FEEDING_BRANCH.x, FEEDING_BRANCH.z),
    FEEDING_BRANCH.z,
  );
  group.name = 'subject.iguanodon_family.feeding_branch';
  group.userData.branchPivot = branchPivot;
  group.userData.contactPoint = new THREE.Vector3(-5.35, -0.08, 0.12);
  group.userData.leafClusters = branchPivot.children.slice(3);
  group.userData.leafRestRotations = group.userData.leafClusters.map((cluster) => (
    cluster.rotation.clone()
  ));
  scene.add(group);
  return group;
}

function makeGladeSunLane(scene) {
  const group = new THREE.Group();
  const random = seededRandom(1461);
  const motePositions = [];
  for (let index = 0; index < 120; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    motePositions.push(
      1 + Math.cos(angle) * radius * 13,
      0.6 + random() * 8.4,
      -30 + Math.sin(angle) * radius * 18,
    );
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3));
  moteGeometry.userData.profile = 'local-humidity-sun-motes';
  const moteMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      moteColor: { value: new THREE.Color(0xe8cd8b) },
      moteOpacity: { value: 0.14 },
    },
    vertexShader: `
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(18.0 / max(1.0, -viewPosition.z), 1.15, 3.2);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 moteColor;
      uniform float moteOpacity;
      void main() {
        float distanceFromCentre = length(gl_PointCoord - 0.5);
        float softDisc = 1.0 - smoothstep(0.18, 0.5, distanceFromCentre);
        if (softDisc <= 0.01) discard;
        gl_FragColor = vec4(moteColor, moteOpacity * softDisc);
      }
    `,
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = 'world.iguanodon_glade.sun_lane.humidity-motes';
  motes.frustumCulled = false;

  const shaftGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const shafts = new THREE.Group();
  [
    [-8.5, 10.5, -25.5, 6.4, 21, -0.08, 0.15],
    [0.5, 11.2, -33, 8.2, 23, 0.05, 0.62],
    [8.2, 10.2, -40, 5.6, 20, -0.04, 1.08],
  ].forEach(([x, y, z, width, height, yaw, phase], index) => {
    const shaftMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        shaftColor: { value: new THREE.Color(0xf0d69c) },
        shaftOpacity: { value: 0.035 - index * 0.004 },
        phase: { value: phase },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 shaftColor;
        uniform float shaftOpacity;
        uniform float phase;
        uniform float time;
        void main() {
          float sideFade = smoothstep(0.0, 0.24, vUv.x)
            * (1.0 - smoothstep(0.68, 1.0, vUv.x));
          float verticalFade = smoothstep(0.02, 0.28, vUv.y)
            * (1.0 - smoothstep(0.72, 1.0, vUv.y));
          float humidBreak = 0.72
            + sin(vUv.y * 12.0 + vUv.x * 5.0 + phase + time) * 0.16
            + sin(vUv.y * 29.0 - vUv.x * 9.0 - phase * 1.7) * 0.08;
          float alpha = shaftOpacity * sideFade * verticalFade * humidBreak;
          if (alpha <= 0.002) discard;
          gl_FragColor = vec4(shaftColor, alpha);
        }
      `,
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(x, y, z);
    shaft.rotation.y = yaw;
    shaft.scale.set(width, height, 1);
    shaft.name = `world.iguanodon_glade.sun_lane.humidity-shaft-${index + 1}`;
    shaft.userData.profile = 'broken-world-space-humidity-shaft';
    shafts.add(shaft);
  });
  shafts.name = 'world.iguanodon_glade.sun_lane.humidity-shafts';
  shafts.userData.profile = 'localized-broken-volumetric-planes';

  // Sun energy already comes from the scene's shadow-casting directional
  // source. A former transparent amber disc painted light onto the terrain and
  // stayed bright regardless of normal, occlusion or material response. Keep
  // only low-opacity humidity scatter so the lane reveals that real light
  // instead of faking a second emissive ground surface.
  group.add(shafts, motes);
  group.userData.profile = 'directional-sun-revealed-by-local-humidity';
  group.userData.energyModel = 'no-emissive-ground-overlay';
  group.userData.motes = motes;
  group.userData.shafts = shafts;
  group.name = 'world.iguanodon_glade.sun_lane';
  scene.add(group);
  return group;
}

function makePterodactyl(scene, radius, height, phase, scale = 1) {
  const group = createPterodactyl();
  const { rig } = group.userData;
  const restPose = Object.fromEntries(['leftWing', 'rightWing'].map((side) => [side, {
    shoulder: rig[side].shoulder.rotation.clone(),
    elbow: rig[side].elbow.rotation.clone(),
    wrist: rig[side].wrist.rotation.clone(),
  }]));
  group.scale.setScalar(scale);
  group.name = 'threat.pterodactyl.distant';
  group.userData = {
    ...group.userData,
    radius,
    height,
    phase,
    baseScale: scale,
    restPose,
  };
  scene.add(group);
  return group;
}

function makePterodactylShadow(scene) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.46);
  shape.lineTo(0.42, -0.2);
  shape.lineTo(1.45, -0.12);
  shape.lineTo(2.35, 0.08);
  shape.lineTo(1.18, 0.28);
  shape.lineTo(0.34, 0.34);
  shape.lineTo(0, 0.64);
  shape.lineTo(-0.34, 0.34);
  shape.lineTo(-1.18, 0.28);
  shape.lineTo(-2.35, 0.08);
  shape.lineTo(-1.45, -0.12);
  shape.lineTo(-0.42, -0.2);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(Math.PI / 2);
  geometry.userData.profile = 'moving-winged-ground-shadow';
  const material = new THREE.MeshBasicMaterial({
    color: 0x14231f,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.name = 'threat.pterodactyl.projected-shadow';
  shadow.visible = false;
  shadow.renderOrder = 2;
  shadow.userData.targetPosition = new THREE.Vector3();
  shadow.userData.smoothingScale = new THREE.Vector3(1, 1, 1);

  // Two quiet outer silhouettes soften the otherwise cut-paper edge without
  // adding a screen-space blur pass or another dynamic shadow map.
  [
    [1.1, 0.085],
    [1.22, 0.035],
  ].forEach(([scale, opacity], index) => {
    const haloMaterial = material.clone();
    haloMaterial.opacity = opacity;
    haloMaterial.polygonOffsetFactor = -4 - index;
    const halo = new THREE.Mesh(geometry, haloMaterial);
    halo.name = `threat.pterodactyl.projected-shadow-soft-edge-${index + 1}`;
    halo.position.y = 0.003 * (index + 1);
    halo.scale.setScalar(scale);
    halo.renderOrder = 1;
    shadow.add(halo);
  });
  scene.add(shadow);
  return shadow;
}

function makeFamilyContactShadows(scene, family) {
  const group = new THREE.Group();
  group.name = 'subject.iguanodon_family.contact-shadows';
  const geometry = new THREE.CircleGeometry(1, 28);
  geometry.rotateX(-Math.PI / 2);
  geometry.userData.profile = 'tight-foot-contact-shadow';

  family.forEach((animal, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x17251f,
      transparent: true,
      opacity: animal.userData.young ? 0.17 : 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const shadow = new THREE.Mesh(geometry, material);
    shadow.name = `subject.iguanodon_family.contact-shadow-${index + 1}`;
    shadow.userData.profile = 'tight-foot-contact-shadow';
    shadow.userData.familyIndex = index;
    shadow.renderOrder = 1;
    group.add(shadow);
  });

  scene.add(group);
  return group;
}

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
    wisp.userData.windLean = windLean;
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
  anchor.userData.layout = { ...HERO_GINGKO_LAYOUT };
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
  group.userData.response = null;
  group.userData.profile = 'bounded-five-frond-physical-fallback';
  group.userData.supportModel = 'terrain-rooted-rhizome-to-flexing-frond';
  group.userData.collisionRole = FERN_LIBRARY_ASSET.collisionRole;

  const assetAnchor = new THREE.Group();
  assetAnchor.name = 'world.connected_route.brook-response.asset-anchor';
  assetAnchor.userData.fallbackMeshes = Object.freeze([group]);
  assetAnchor.userData.supportModel = FERN_LIBRARY_ASSET.supportModel;
  assetAnchor.userData.collisionRole = FERN_LIBRARY_ASSET.collisionRole;
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
  group.userData.singleAssetPath = true;
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
  group.userData.singleAssetPath = true;
  scene.add(group);
  return group;
}

export async function loadOptionalAssetVisual({ load, attach, onLoadFailure }) {
  let template;
  try {
    template = await load();
  } catch (error) {
    return onLoadFailure(error);
  }
  return attach(template);
}

export function createWorld(scene) {
  const terrain = makeTerrain(scene);
  const routeAndBrook = makeRouteAndBrook(scene);
  const brookBoulder = makeBrookBoulder(scene);
  const riparianCover = makeRiparianCover(scene);
  const coverArches = riparianCover.group;
  const vegetation = placeVegetation(scene);
  const nonColumnarRockFamilies = makeNonColumnarRockFamilies(scene);
  const brookObstacleFlowField = buildBrookObstacleFlowField(
    routeAndBrook.brookPoints,
    routeAndBrook.brookHydrology,
    [
      ...routeAndBrook.brookObstacleCandidates,
      ...nonColumnarRockFamilies.userData.brookObstacleCandidates,
    ],
    { width: FLUVIAL_ROCK_TRANSPORT_PROFILE.brookWidthMeters },
  );
  applyBrookObstacleFlowField(routeAndBrook.brook.material, brookObstacleFlowField);
  const habitatAccents = makeHabitatAccents(scene);
  vegetation.fernAssetAnchor.userData.fallbackMeshes = Object.freeze([
    ...vegetation.fernMeshes,
    habitatAccents.foregroundFronds,
  ]);
  const degradableGroundAccents = makeDegradableGroundAccents(scene);
  const accentFernAssetAnchor = new THREE.Group();
  accentFernAssetAnchor.name = 'world.connected_route.ferns.accent-asset-anchor';
  accentFernAssetAnchor.userData.fallbackMeshes = Object.freeze([
    habitatAccents.skirts,
    ...degradableGroundAccents.userData.proceduralFallbackMeshes,
  ]);
  accentFernAssetAnchor.userData.placements = Object.freeze([
    ...habitatAccents.fernLibraryPlacements,
    ...degradableGroundAccents.userData.fernLibraryPlacements,
  ].map((placement, index) => Object.freeze({
    ...placement,
    index: FERN_LIBRARY_LAYOUT.length + index,
  })));
  accentFernAssetAnchor.userData.supportModel = FERN_LIBRARY_ASSET.supportModel;
  accentFernAssetAnchor.userData.collisionRole = FERN_LIBRARY_ASSET.collisionRole;
  degradableGroundAccents.add(accentFernAssetAnchor);
  const environmentDensity = makeEnvironmentDensity(scene);
  const basalt = makeBasalt(scene);
  const family = makeFamily(scene);
  const familyContactShadows = makeFamilyContactShadows(scene, family);
  const feedingBranch = makeFeedingBranch(scene);
  const gladeSunLane = makeGladeSunLane(scene);
  const pterodactyls = [
    makePterodactyl(scene, 29, 23, 0.0, 0.88),
    makePterodactyl(scene, 31, 18.5, 2.2, 0.46),
    makePterodactyl(scene, 35, 20.5, 4.1, 0.32),
  ];
  const pterodactylShadow = makePterodactylShadow(scene);
  const smoke = makeFort(scene);
  const heroGingko = makeHeroGingko(scene);
  const brookResponse = makeBrookResponse(scene);
  const fieldCamera = makeFieldCameraMount(scene);
  const rifle = makeRifleMount(scene);
  const brookSceneCapture = createBrookSceneCapture(
    scene,
    routeAndBrook.brook,
    routeAndBrook.brookHydrology,
    [
      routeAndBrook.brookRipples,
      fieldCamera,
      rifle,
    ],
  );
  let renderedThreatState = 'distant';
  let renderedThreatResponse = 'orbit';
  let renderedAttackStage = 'orbit';
  let renderedAttackProgress = 0;
  let renderedFamilyMoment = 'glade-young-play';
  let observedShotCount = 0;
  let flashSeconds = 0;
  let previousThreatAwareness = null;
  let visualOrbitAwareness = 0;
  let hasRenderedThreatFrame = false;
  let previousWorldElapsed = null;
  const attackAnchor = new THREE.Vector3();
  let attackEntryPosition = null;
  let attackEntryScale = null;
  let attackEntryElapsed = 0;
  let attackExitPosition = null;
  let attackExitScale = null;
  let attackExitElapsed = 0;
  let familyVisualStatus = 'procedural-fallback';
  let familyVisualError = null;
  let pterodactylVisualStatus = 'procedural-fallback';
  let pterodactylVisualError = null;
  let fieldCameraVisualStatus = 'required-not-loaded';
  let fieldCameraVisualError = null;
  let rifleVisualStatus = 'required-not-loaded';
  let rifleVisualError = null;
  let heroGingkoVisualStatus = 'original-fallback';
  let heroGingkoVisualError = null;
  let basaltShelfVisualStatus = 'original-fallback';
  let basaltShelfVisualError = null;
  let brookBoulderVisualStatus = 'original-fallback';
  let brookBoulderVisualError = null;
  let fernLibraryVisualStatus = 'original-fallback';
  let fernLibraryVisualError = null;
  let groundCoverLibraryVisualStatus = 'original-fallback';
  let groundCoverLibraryVisualError = null;
  let treeFernLibraryVisualStatus = 'original-fallback';
  let treeFernLibraryVisualError = null;
  let canopyTreeLibraryVisualStatus = 'original-fallback';
  let canopyTreeLibraryVisualError = null;
  let coverCanopyVisualStatus = 'original-fallback';
  let coverCanopyVisualError = null;
  let forestEdgeCanopyVisualStatus = 'original-not-loaded';
  let forestEdgeCanopyVisualError = null;
  let assetVisualPromise = null;

  function enableHy3dVisuals() {
    if (!assetVisualPromise) {
      familyVisualStatus = 'loading';
      pterodactylVisualStatus = 'loading';
      fieldCameraVisualStatus = 'loading';
      rifleVisualStatus = 'loading';
      heroGingkoVisualStatus = 'loading';
      basaltShelfVisualStatus = 'loading';
      brookBoulderVisualStatus = 'loading';
      fernLibraryVisualStatus = 'loading';
      groundCoverLibraryVisualStatus = 'loading';
      treeFernLibraryVisualStatus = 'loading';
      canopyTreeLibraryVisualStatus = 'loading';
      coverCanopyVisualStatus = 'loading';
      forestEdgeCanopyVisualStatus = 'loading';
      const familyTask = upgradeIguanodonFamilyWithHy3d(family, { includeYoung: true })
        .then((result) => {
          familyVisualStatus = 'hy3d-family-ready';
          return { status: familyVisualStatus, ...result };
        })
        .catch((error) => {
          familyVisualStatus = 'procedural-fallback';
          familyVisualError = error instanceof Error ? error.message : String(error);
          return { status: familyVisualStatus, upgraded: 0, error: familyVisualError };
        });
      const pterodactylTask = upgradePterodactylFlockWithHy3d(pterodactyls)
        .then((result) => {
          pterodactylVisualStatus = 'hy3d-flock-ready';
          return { status: pterodactylVisualStatus, ...result };
        })
        .catch((error) => {
          pterodactylVisualStatus = 'procedural-fallback';
          pterodactylVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: pterodactylVisualStatus,
            upgraded: 0,
            error: pterodactylVisualError,
          };
        });
      const rifleTask = loadHy3dRifleTemplate()
        .then((template) => {
          attachHy3dRifleVisual(rifle, template);
          rifleVisualStatus = 'hy3d-rifle-ready';
          return { status: rifleVisualStatus, attached: 1 };
        })
        .catch((error) => {
          rifleVisualStatus = 'error';
          rifleVisualError = error instanceof Error ? error.message : String(error);
          throw new Error(`Required HY3D rifle failed to load: ${rifleVisualError}`);
        });
      const fieldCameraTask = loadHy3dFieldCameraTemplate()
        .then((template) => {
          attachHy3dFieldCameraVisual(fieldCamera, template);
          fieldCameraVisualStatus = 'hy3d-field-camera-ready';
          return { status: fieldCameraVisualStatus, attached: 1 };
        })
        .catch((error) => {
          fieldCameraVisualStatus = 'error';
          fieldCameraVisualError = error instanceof Error ? error.message : String(error);
          throw new Error(`Required HY3D field camera failed to load: ${fieldCameraVisualError}`);
        });
      const heroGingkoTask = loadOptionalAssetVisual({
        load: loadHeroGingkoTemplate,
        attach: (template) => {
          attachHeroGingkoVisual(heroGingko, template);
          heroGingkoVisualStatus = 'original-asset-ready';
          return { status: heroGingkoVisualStatus, attached: 1 };
        },
        onLoadFailure: (error) => {
          heroGingkoVisualStatus = 'original-fallback';
          heroGingkoVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: heroGingkoVisualStatus,
            attached: 0,
            error: heroGingkoVisualError,
          };
        },
      });
      const basaltShelfTask = loadOptionalAssetVisual({
        load: loadBasaltShelfTemplate,
        attach: (template) => {
          const supportEvidence = basalt.assetAnchors.map((anchor) => {
            attachBasaltShelfVisual(anchor, template, basaltDetailTextures);
            return measureBasaltShelfSupport(anchor);
          });
          basalt.proceduralFallback.visible = false;
          basaltShelfVisualStatus = 'original-asset-ready';
          return {
            status: basaltShelfVisualStatus,
            attached: basalt.assetAnchors.length,
            supportEvidence,
          };
        },
        onLoadFailure: (error) => {
          basalt.proceduralFallback.visible = true;
          basaltShelfVisualStatus = 'original-fallback';
          basaltShelfVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: basaltShelfVisualStatus,
            attached: 0,
            error: basaltShelfVisualError,
          };
        },
      });
      const brookBoulderTask = loadOptionalAssetVisual({
        load: loadBrookBoulderTemplate,
        attach: (template) => {
          attachBrookBoulderVisual(brookBoulder, template, rockTextures);
          settleBrookBoulderAsset(brookBoulder);
          const supportEvidence = measureBrookBoulderSupport(brookBoulder);
          brookBoulderVisualStatus = 'original-asset-ready';
          return {
            status: brookBoulderVisualStatus,
            attached: 1,
            supportEvidence,
          };
        },
        onLoadFailure: (error) => {
          brookBoulder.userData.fallback.visible = true;
          brookBoulderVisualStatus = 'original-fallback';
          brookBoulderVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: brookBoulderVisualStatus,
            attached: 0,
            error: brookBoulderVisualError,
          };
        },
      });
      const fernLibraryTask = loadOptionalAssetVisual({
        load: loadFernLibraryTemplate,
        attach: (template) => {
          const primaryVisual = attachFernLibraryVisual(
            vegetation.fernAssetAnchor,
            template,
            FERN_LIBRARY_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          const accentVisual = attachFernLibraryVisual(
            accentFernAssetAnchor,
            template,
            accentFernAssetAnchor.userData.placements,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          const brookResponseVisual = attachFernLibraryVisual(
            brookResponse.userData.assetAnchor,
            template,
            brookResponse.userData.assetAnchor.userData.placements,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          fernLibraryVisualStatus = 'original-asset-ready';
          return {
            status: fernLibraryVisualStatus,
            attached: primaryVisual.userData.instanceCount
              + accentVisual.userData.instanceCount
              + brookResponseVisual.userData.instanceCount,
            supportEvidence: {
              primary: primaryVisual.userData.supportSummary,
              accents: accentVisual.userData.supportSummary,
              brookResponse: brookResponseVisual.userData.supportSummary,
            },
          };
        },
        onLoadFailure: (error) => {
          for (const anchor of [
            vegetation.fernAssetAnchor,
            accentFernAssetAnchor,
            brookResponse.userData.assetAnchor,
          ]) {
            anchor.userData.fallbackMeshes.forEach((mesh) => { mesh.visible = true; });
            if (anchor.userData.assetVisual) anchor.userData.assetVisual.visible = false;
          }
          fernLibraryVisualStatus = 'original-fallback';
          fernLibraryVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: fernLibraryVisualStatus,
            attached: 0,
            error: fernLibraryVisualError,
          };
        },
      });
      const groundCoverLibraryTask = loadOptionalAssetVisual({
        load: loadGroundCoverLibraryTemplate,
        attach: (template) => {
          const visual = attachGroundCoverLibraryVisual(
            environmentDensity.userData.groundCoverAssetAnchor,
            template,
            environmentDensity.userData.groundCoverPlacements,
            { terrainHeight, terrainGradient },
          );
          environmentDensity.userData.groundCoverActiveDrawCalls =
            GROUND_COVER_LIBRARY_ASSET.drawCalls;
          environmentDensity.userData.drawCalls = environmentDensity.userData.nonGroundCoverDrawCalls
            + environmentDensity.userData.groundCoverActiveDrawCalls
            + environmentDensity.userData.forestEdgeOriginalDrawCalls;
          groundCoverLibraryVisualStatus = 'original-asset-ready';
          return {
            status: groundCoverLibraryVisualStatus,
            attached: visual.userData.instanceCount,
            supportEvidence: visual.userData.supportSummary,
          };
        },
        onLoadFailure: (error) => {
          environmentDensity.userData.groundCoverMeshes.forEach((mesh) => { mesh.visible = true; });
          environmentDensity.userData.groundCoverActiveDrawCalls =
            environmentDensity.userData.groundCoverFallbackDrawCalls;
          environmentDensity.userData.drawCalls = environmentDensity.userData.nonGroundCoverDrawCalls
            + environmentDensity.userData.groundCoverActiveDrawCalls
            + environmentDensity.userData.forestEdgeOriginalDrawCalls;
          groundCoverLibraryVisualStatus = 'original-fallback';
          groundCoverLibraryVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: groundCoverLibraryVisualStatus,
            attached: 0,
            error: groundCoverLibraryVisualError,
          };
        },
      });
      const treeFernLibraryTask = loadOptionalAssetVisual({
        load: loadTreeFernLibraryTemplate,
        attach: (template) => {
          const visual = attachTreeFernLibraryVisual(
            habitatAccents.treeFernAssetAnchor,
            template,
            HABITAT_TREE_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          treeFernLibraryVisualStatus = 'original-asset-ready';
          return {
            status: treeFernLibraryVisualStatus,
            attached: visual.userData.instanceCount,
            supportEvidence: visual.userData.supportSummary,
          };
        },
        onLoadFailure: (error) => {
          habitatAccents.treeFernAssetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (habitatAccents.treeFernAssetAnchor.userData.assetVisual) {
            habitatAccents.treeFernAssetAnchor.userData.assetVisual.visible = false;
          }
          treeFernLibraryVisualStatus = 'original-fallback';
          treeFernLibraryVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: treeFernLibraryVisualStatus,
            attached: 0,
            error: treeFernLibraryVisualError,
          };
        },
      });
      const canopyTreeLibraryTask = loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            vegetation.canopyTreeAssetAnchor,
            template,
            VEGETATION_LAYOUT.trees,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          canopyTreeLibraryVisualStatus = 'original-asset-ready';
          return {
            status: canopyTreeLibraryVisualStatus,
            attached: visual.userData.instanceCount,
            supportEvidence: visual.userData.supportSummary,
          };
        },
        onLoadFailure: (error) => {
          vegetation.canopyTreeAssetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (vegetation.canopyTreeAssetAnchor.userData.assetVisual) {
            vegetation.canopyTreeAssetAnchor.userData.assetVisual.visible = false;
          }
          canopyTreeLibraryVisualStatus = 'original-fallback';
          canopyTreeLibraryVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: canopyTreeLibraryVisualStatus,
            attached: 0,
            error: canopyTreeLibraryVisualError,
          };
        },
      });
      const coverCanopyTask = loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            riparianCover.assetAnchor,
            template,
            COVER_RIPARIAN_TREE_LAYOUT,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          visual.name = 'world.connected_route.cover-riparian-trees.original-canopy-library';
          visual.userData.compositionRole = 'non-repeating-riparian-overlap-cover';
          coverCanopyVisualStatus = 'original-asset-ready';
          return {
            status: coverCanopyVisualStatus,
            attached: visual.userData.instanceCount,
            supportEvidence: visual.userData.supportSummary,
          };
        },
        onLoadFailure: (error) => {
          riparianCover.assetAnchor.userData.fallbackMeshes.forEach((mesh) => {
            mesh.visible = true;
          });
          if (riparianCover.assetAnchor.userData.assetVisual) {
            riparianCover.assetAnchor.userData.assetVisual.visible = false;
          }
          coverCanopyVisualStatus = 'original-fallback';
          coverCanopyVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: coverCanopyVisualStatus,
            attached: 0,
            error: coverCanopyVisualError,
          };
        },
      });
      const forestEdgeCanopyTask = loadOptionalAssetVisual({
        load: loadCanopyTreeLibraryTemplate,
        attach: (template) => {
          const visual = attachCanopyTreeLibraryVisual(
            environmentDensity.userData.forestEdgeAssetAnchor,
            template,
            environmentDensity.userData.forestEdgeTrees,
            { terrainHeight, terrainGradient, terrainWetness },
          );
          visual.name = 'world.environment-density.forest-edge.original-canopy-library';
          visual.userData.collisionRole = environmentDensity.userData.forestEdgeAssetAnchor
            .userData.collisionRole;
          environmentDensity.userData.forestEdgeOriginalDrawCalls = visual.userData.drawCalls;
          environmentDensity.userData.forestFallbackActiveDrawCalls = 0;
          environmentDensity.userData.drawCalls = environmentDensity.userData.nonGroundCoverDrawCalls
            - environmentDensity.userData.forestFallbackDrawCalls
            + environmentDensity.userData.groundCoverActiveDrawCalls
            + environmentDensity.userData.forestEdgeOriginalDrawCalls;
          forestEdgeCanopyVisualStatus = 'original-asset-ready';
          return {
            status: forestEdgeCanopyVisualStatus,
            attached: visual.userData.instanceCount,
            supportEvidence: visual.userData.supportSummary,
          };
        },
        onLoadFailure: (error) => {
          if (environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual) {
            environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual.visible = false;
          }
          environmentDensity.userData.forestEdgeOriginalDrawCalls = 0;
          environmentDensity.userData.forestFallbackActiveDrawCalls =
            environmentDensity.userData.forestFallbackDrawCalls;
          environmentDensity.userData.drawCalls = environmentDensity.userData.nonGroundCoverDrawCalls
            + environmentDensity.userData.groundCoverActiveDrawCalls;
          forestEdgeCanopyVisualStatus = 'far-boundary-only-fallback';
          forestEdgeCanopyVisualError = error instanceof Error ? error.message : String(error);
          return {
            status: forestEdgeCanopyVisualStatus,
            attached: 0,
            error: forestEdgeCanopyVisualError,
          };
        },
      });
      assetVisualPromise = Promise.all([
        familyTask,
        pterodactylTask,
        fieldCameraTask,
        rifleTask,
        heroGingkoTask,
        basaltShelfTask,
        brookBoulderTask,
        fernLibraryTask,
        groundCoverLibraryTask,
        treeFernLibraryTask,
        canopyTreeLibraryTask,
        coverCanopyTask,
        forestEdgeCanopyTask,
      ])
        .then(([
          familyResult,
          pterodactylResult,
          fieldCameraResult,
          rifleResult,
          heroGingkoResult,
          basaltShelfResult,
          brookBoulderResult,
          fernLibraryResult,
          groundCoverLibraryResult,
          treeFernLibraryResult,
          canopyTreeLibraryResult,
          coverCanopyResult,
          forestEdgeCanopyResult,
        ]) => ({
          familyResult,
          pterodactylResult,
          fieldCameraResult,
          rifleResult,
          heroGingkoResult,
          basaltShelfResult,
          brookBoulderResult,
          fernLibraryResult,
          groundCoverLibraryResult,
          treeFernLibraryResult,
          canopyTreeLibraryResult,
          coverCanopyResult,
          forestEdgeCanopyResult,
        }))
        .catch((error) => {
          assetVisualPromise = null;
          throw error;
        });
    }
    return assetVisualPromise;
  }

  return {
    family,
    vegetation,
    coverArches,
    habitatAccents,
    degradableGroundAccents,
    environmentDensity,
    pterodactyls,
    pterodactylShadow,
    smoke,
    heroGingko,
    basalt,
    brookResponse,
    brookBoulder,
    nonColumnarRockFamilies,
    fieldCamera,
    rifle,
    enableHy3dVisuals,
    prepareBrookRender(renderer, camera, quality = 'balanced', frameIndex = 0) {
      brookSceneCapture.prepare(renderer, camera, quality, frameIndex);
    },
    requestBrookReflectionRefresh() {
      brookSceneCapture.requestReflectionRefresh();
    },
    update(elapsed, reducedMotion = false, runtime = {}) {
      const awareness = Math.max(0, Math.min(3, runtime.threatAwareness ?? 0));
      const visualQuality = ['low', 'balanced', 'high'].includes(runtime.quality)
        ? runtime.quality
        : 'balanced';
      degradableGroundAccents.visible = visualQuality !== 'low';
      degradableGroundAccents.userData.quality = visualQuality;
      environmentDensity.visible = visualQuality !== 'low';
      environmentDensity.userData.quality = visualQuality;
      shared.canopyLeafMaterials.forEach((material) => {
        const windUniforms = material.userData.windUniforms;
        windUniforms.time.value = reducedMotion ? 0 : elapsed;
        windUniforms.strength.value = reducedMotion
          ? 0
          : CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters;
        windUniforms.verticalStrength.value = reducedMotion
          ? 0
          : CANOPY_WIND_PROFILE.verticalTipDisplacementMeters;
      });
      updateFernLibraryWind(vegetation.fernAssetAnchor, elapsed, reducedMotion);
      updateFernLibraryWind(accentFernAssetAnchor, elapsed, reducedMotion);
      updateFernLibraryWind(brookResponse.userData.assetAnchor, elapsed, reducedMotion);
      updateGroundCoverLibraryWind(
        environmentDensity.userData.groundCoverAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateTreeFernLibraryWind(
        habitatAccents.treeFernAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateCanopyTreeLibraryWind(
        vegetation.canopyTreeAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateCanopyTreeLibraryWind(
        riparianCover.assetAnchor,
        elapsed,
        reducedMotion,
      );
      updateHeroGingkoWind(heroGingko, elapsed, reducedMotion);
      brookSceneCapture.setQuality(visualQuality);
      renderedThreatState = ['distant', 'watch', 'search', 'attack'][awareness];
      renderedThreatResponse = awareness === 3 && runtime.inCover ? 'cover-pull-up' : 'orbit';
      const playerPosition = runtime.playerPosition ?? { x: 0, z: 0 };
      const deltaSeconds = Math.max(0, Number(runtime.deltaSeconds) || 0);
      const orbitDeltaSeconds = Object.hasOwn(runtime, 'deltaSeconds')
        ? deltaSeconds
        : previousWorldElapsed === null
          ? Math.max(0, Number(elapsed) || 0)
          : Math.max(0, (Number(elapsed) || 0) - previousWorldElapsed);
      const enteringAttack = awareness === 3 && previousThreatAwareness !== 3;
      const leavingAttack = awareness !== 3 && previousThreatAwareness === 3;
      if (enteringAttack) {
        attackAnchor.set(playerPosition.x, 0, playerPosition.z);
        attackEntryPosition = hasRenderedThreatFrame ? pterodactyls[0].position.clone() : null;
        attackEntryScale = hasRenderedThreatFrame ? pterodactyls[0].scale.x : null;
        attackEntryElapsed = elapsed;
        attackExitPosition = null;
        attackExitScale = null;
      } else if (leavingAttack) {
        attackExitPosition = pterodactyls[0].position.clone();
        attackExitScale = pterodactyls[0].scale.x;
        attackExitElapsed = elapsed;
        attackEntryPosition = null;
        attackEntryScale = null;
      }
      const orbitAwarenessTarget = Math.min(2, awareness);
      const orbitBlend = deltaSeconds > 0
        ? 1 - Math.exp(-deltaSeconds * 0.9)
        : 1;
      visualOrbitAwareness = THREE.MathUtils.lerp(
        visualOrbitAwareness,
        orbitAwarenessTarget,
        orbitBlend,
      );
      const requestedFamilyMoment = runtime.familyMoment;
      renderedFamilyMoment = requestedFamilyMoment === 'glade-young-play'
        || requestedFamilyMoment === 'glade-branch-pull'
        ? requestedFamilyMoment
        : elapsed % 12 < 6 ? 'glade-young-play' : 'glade-branch-pull';
      const waterFlowTime = elapsed * (reducedMotion ? 0.18 : 1);
      routeAndBrook.brook.material.uniforms.time.value = waterFlowTime;
      routeAndBrook.brook.material.uniforms.detailMix.value = visualQuality === 'low'
        ? 0
        : visualQuality === 'high' ? 1 : 0.72;
      routeAndBrook.brook.material.uniforms.obstacleCount.value = Math.min(
        brookObstacleFlowField.selected.length,
        BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality[visualQuality],
      );
      routeAndBrook.brook.material.userData.flowOffset = Object.freeze({
        northHeadwaterUv: Number((-waterFlowTime * 0.34).toFixed(4)),
        southHeadwaterUv: Number((waterFlowTime * 0.34).toFixed(4)),
        confluenceUv: 0,
      });
      gladeSunLane.userData.motes.rotation.y = reducedMotion ? 0 : elapsed * 0.006;
      const eventClarity = awareness === 3 ? 0.68 : awareness === 2 ? 0.84 : 1;
      gladeSunLane.userData.motes.material.uniforms.moteOpacity.value = (reducedMotion
        ? 0.085
        : 0.125 + Math.sin(elapsed * 0.37) * 0.018) * eventClarity;
      gladeSunLane.userData.shafts.children.forEach((shaft) => {
        shaft.material.uniforms.time.value = reducedMotion ? 0 : elapsed * 0.04;
        const shaftIndex = Number(shaft.name.slice(-1)) - 1;
        shaft.material.uniforms.shaftOpacity.value = (0.035 - shaftIndex * 0.004)
          * eventClarity;
      });
      brookResponse.userData.response = runtime.brookResponse ?? null;
      const responseStrength = runtime.brookResponse === 'brush-moving'
        ? 0.24
        : runtime.brookResponse === 'answering-call' ? 0.08 : 0.015;
      const brookResponseWind = brookResponse.userData.assetAnchor
        .userData.assetVisual?.userData.materials.windUniforms;
      if (brookResponseWind) {
        brookResponseWind.strength.value = reducedMotion
          ? 0
          : runtime.brookResponse === 'brush-moving'
            ? 0.19
            : runtime.brookResponse === 'answering-call' ? 0.13 : 0.055;
        brookResponseWind.verticalStrength.value = reducedMotion
          ? 0
          : runtime.brookResponse === 'brush-moving'
            ? 0.035
            : runtime.brookResponse === 'answering-call' ? 0.026 : 0.012;
      }
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
        const previousVisualScale = mesh.scale.x;
        mesh.visible = isPrimary || awareness === 0;
        const lowerAwareness = Math.floor(visualOrbitAwareness);
        const upperAwareness = Math.ceil(visualOrbitAwareness);
        const awarenessFraction = visualOrbitAwareness - lowerAwareness;
        const orbitRadii = [radius, 26, 17];
        const orbitHeights = [height, 9.4, 7.8];
        const stateRadius = isPrimary
          ? THREE.MathUtils.lerp(
            orbitRadii[lowerAwareness],
            orbitRadii[upperAwareness],
            awarenessFraction,
          )
          : radius;
        const stateHeight = isPrimary
          ? THREE.MathUtils.lerp(
            orbitHeights[lowerAwareness],
            orbitHeights[upperAwareness],
            awarenessFraction,
          )
          : height;
        const speedAwareness = isPrimary ? visualOrbitAwareness : 0;
        const stateSpeed = speed * (1 + speedAwareness * 0.42) * (1 + index * 0.08);
        mesh.userData.orbitAngle = (mesh.userData.orbitAngle ?? phase)
          + orbitDeltaSeconds * stateSpeed;
        const angle = mesh.userData.orbitAngle;
        const flightVelocity = new THREE.Vector3();
        let diveApproach = 0;
        let attackWingFold = 0;
        let attackRecovery = 0;
        if (isPrimary && awareness === 3 && runtime.inCover) {
          const targetPosition = new THREE.Vector3(
            attackAnchor.x + Math.cos(angle) * 3,
            stateHeight + 12 + Math.sin(angle * 1.6) * 0.7,
            attackAnchor.z - 17 + Math.sin(angle) * 3,
          );
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(attackEntryPosition ?? targetPosition).lerp(targetPosition, transition);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? mesh.userData.baseScale,
            mesh.userData.baseScale,
            transition,
          ));
          flightVelocity.set(
            -Math.sin(angle) * 3 * stateSpeed,
            Math.cos(angle * 1.6) * 1.12 * stateSpeed,
            Math.cos(angle) * 3 * stateSpeed,
          );
        } else if (isPrimary && awareness === 3) {
          const attackClock = Number.isFinite(runtime.attackSeconds)
            ? runtime.attackSeconds
            : elapsed;
          const flight = pterodactylAttackFlightState({
            attackClock,
            attackOrigin: attackAnchor,
            reducedMotion,
          });
          const nextFlight = pterodactylAttackFlightState({
            attackClock: attackClock + 1 / 120,
            attackOrigin: attackAnchor,
            reducedMotion,
          });
          const { pose: attackPose } = flight;
          diveApproach = flight.approach;
          attackWingFold = attackPose.wingFold;
          attackRecovery = attackPose.recovery;
          renderedAttackStage = attackPose.stage;
          renderedAttackProgress = diveApproach;
          // Graze the creek-side route edge instead of flying into the exact
          // camera centre. Orient against this same authored curve so the
          // animal cannot slide sideways or pitch upward while descending.
          const attackScale = mesh.userData.baseScale
            * (0.96 + diveApproach * 0.5);
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          const entryPosition = attackEntryPosition ?? flight.position;
          const nextTransition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed + 1 / 120 - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(entryPosition).lerp(flight.position, transition);
          flightVelocity
            .copy(entryPosition)
            .lerp(nextFlight.position, nextTransition)
            .sub(mesh.position);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? attackScale,
            attackScale,
            transition,
          ));
        } else {
          const xRadius = stateRadius;
          const zRadius = stateRadius * 0.35;
          const targetPosition = new THREE.Vector3(
            PTERODACTYL_ORBIT_CENTER.x + Math.cos(angle) * xRadius,
            stateHeight + Math.sin(angle * 2) * 1.2,
            PTERODACTYL_ORBIT_CENTER.z + Math.sin(angle) * zRadius,
          );
          const exitTransition = isPrimary && attackExitPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackExitElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(
            isPrimary && attackExitPosition ? attackExitPosition : targetPosition,
          ).lerp(targetPosition, exitTransition);
          flightVelocity.set(
            -Math.sin(angle) * xRadius * stateSpeed,
            Math.cos(angle * 2) * 2.4 * stateSpeed,
            Math.cos(angle) * zRadius * stateSpeed,
          );
          const orbitScale = mesh.userData.baseScale
            * (isPrimary
              ? THREE.MathUtils.lerp(1, 0.82, Math.min(1, visualOrbitAwareness))
              : 1);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            isPrimary && attackExitScale ? attackExitScale : orbitScale,
            orbitScale,
            exitTransition,
          ));
          mesh.rotation.x = 0;
        }
        const poseBlend = mesh.userData.hasRenderedFlightPose && deltaSeconds > 0
          ? 1 - Math.exp(-deltaSeconds * 10)
          : 1;
        const desiredVisualScale = mesh.scale.x;
        mesh.scale.setScalar(THREE.MathUtils.lerp(
          previousVisualScale,
          desiredVisualScale,
          poseBlend,
        ));
        mesh.name = `threat.pterodactyl.${isPrimary ? renderedThreatState : 'distant'}`;
        const authoredWingFold = isPrimary && awareness === 3 && !runtime.inCover
          ? Math.max(attackWingFold, 0.1 + diveApproach * 0.7)
          : 0;
        const wingFold = THREE.MathUtils.lerp(
          mesh.userData.renderedWingFold ?? authoredWingFold,
          authoredWingFold,
          poseBlend,
        );
        mesh.userData.renderedWingFold = wingFold;
        const wingBeat = pterodactylWingBeat(elapsed, phase, awareness, reducedMotion)
          * (1 - wingFold * 0.78);
        for (const [sideName, sideSign] of [['leftWing', -1], ['rightWing', 1]]) {
          const wing = mesh.userData.rig[sideName];
          const rest = mesh.userData.restPose[sideName];
          const bend = -sideSign * (wingFold * 0.02 + wingBeat);
          wing.shoulder.rotation.set(
            rest.shoulder.x,
            rest.shoulder.y + sideSign * wingFold * 0.24,
            rest.shoulder.z + bend,
          );
          wing.elbow.rotation.set(
            rest.elbow.x,
            rest.elbow.y + sideSign * wingFold * 0.48,
            rest.elbow.z + bend * 0.34,
          );
          wing.wrist.rotation.set(
            rest.wrist.x,
            rest.wrist.y + sideSign * wingFold * 0.62,
            rest.wrist.z + bend * 0.2,
          );
        }
        const morphPose = runtime.pterodactylMorphPose ?? {
          wingUp: Math.max(0, wingBeat) * 3.25,
          wingDown: Math.max(0, -wingBeat) * 3.25,
          diveFold: wingFold,
        };
        applyHy3dPterodactylPose(mesh, morphPose);
        mesh.userData.flightPose = {
          wingBeat: Number(wingBeat.toFixed(4)),
          wingFold: Number(wingFold.toFixed(4)),
          mode: wingFold > 0.55 ? 'fold-dive' : wingBeat >= 0 ? 'upstroke' : 'downstroke',
        };
        mesh.userData.rig.head.rotation.x = awareness === 3
          ? -0.08 - diveApproach * 0.3
          : Math.sin(angle * 1.7) * 0.025;
        mesh.userData.rig.tail.rotation.y = Math.sin(angle * 1.4) * 0.08;
        const directAttack = isPrimary && awareness === 3 && !runtime.inCover;
        const rollAmplitude = awareness === 3 ? 0.08 : 0.16 + awareness * 0.035;
        const authoredFlightRoll = directAttack
          ? -0.04 - diveApproach * 0.05 + attackRecovery * 0.1
          : Math.sin(angle * 2.4) * rollAmplitude;
        const flightRoll = THREE.MathUtils.lerp(
          mesh.userData.renderedFlightRoll ?? authoredFlightRoll,
          authoredFlightRoll,
          poseBlend,
        );
        mesh.userData.renderedFlightRoll = flightRoll;
        alignPterodactylToTravel(mesh, flightVelocity, flightRoll);
        mesh.userData.flightPose.bank = Number(flightRoll.toFixed(4));
        mesh.userData.flightPose.direction = mesh.userData.flightDirection
          ? mesh.userData.flightDirection.toArray().map((value) => Number(value.toFixed(4)))
          : null;
        mesh.userData.hasRenderedFlightPose = true;
      });
      if (runtime.captureThreatPose === 'family' || runtime.captureThreatPose === 'dive') {
        const primary = pterodactyls[0];
        const dive = runtime.captureThreatPose === 'dive';
        primary.position.set(dive ? 3.8 : -4, dive ? 5.3 : 10.5, dive ? -21.5 : -31);
        primary.rotation.set(
          dive ? 0.62 : 0.12,
          dive ? Math.PI + 0.46 : Math.PI,
          dive ? -0.62 : -0.12,
        );
        primary.scale.setScalar(primary.userData.baseScale * (dive ? 1.18 : 0.86));
        applyHy3dPterodactylPose(primary, {
          wingUp: dive ? 0 : 0.2,
          wingDown: 0,
          diveFold: dive ? 0.9 : 0,
        });
      }
      const primaryThreat = pterodactyls[0];
      const shadowVisible = awareness >= 2 && !runtime.inCover;
      pterodactylShadow.visible = shadowVisible;
      if (shadowVisible) {
        const shadowTarget = awareness === 3
          ? attackAnchor
          : PTERODACTYL_ORBIT_CENTER;
        const attackShadowPull = awareness === 3
          ? 0.3 + renderedAttackProgress * 0.32
          : 0.38;
        const shadowX = THREE.MathUtils.lerp(primaryThreat.position.x, shadowTarget.x, attackShadowPull);
        const shadowZ = THREE.MathUtils.lerp(
          primaryThreat.position.z,
          shadowTarget.z - (awareness === 3
            ? THREE.MathUtils.lerp(3.8, 1.2, renderedAttackProgress)
            : 3.8),
          awareness === 3 ? 0.3 + renderedAttackProgress * 0.28 : 0.36,
        );
        const shadowTargetPosition = pterodactylShadow.userData.targetPosition.set(
          shadowX,
          terrainHeight(shadowX, shadowZ) + 0.048,
          shadowZ,
        );
        const shadowBlend = pterodactylShadow.userData.wasVisible
          ? deltaSeconds > 0 ? 1 - Math.exp(-deltaSeconds * 8) : 1
          : 1;
        if (pterodactylShadow.userData.wasVisible) {
          pterodactylShadow.position.lerp(shadowTargetPosition, shadowBlend);
        } else {
          pterodactylShadow.position.copy(shadowTargetPosition);
        }
        pterodactylShadow.rotation.y = THREE.MathUtils.lerp(
          pterodactylShadow.rotation.y,
          primaryThreat.rotation.y,
          shadowBlend,
        );
        const shadowScale = 1.34 + renderedAttackProgress * 1.42;
        pterodactylShadow.userData.smoothingScale.setScalar(shadowScale);
        pterodactylShadow.scale.lerp(
          pterodactylShadow.userData.smoothingScale,
          shadowBlend,
        );
        pterodactylShadow.material.opacity = THREE.MathUtils.lerp(
          pterodactylShadow.material.opacity,
          (awareness === 3 ? 0.27 : 0.19) + renderedAttackProgress * 0.18,
          shadowBlend,
        );
      }
      pterodactylShadow.userData.wasVisible = shadowVisible;
      if (awareness !== 3) {
        renderedAttackStage = 'orbit';
        renderedAttackProgress = 0;
      }
      previousThreatAwareness = awareness;
      previousWorldElapsed = Number(elapsed) || 0;
      hasRenderedThreatFrame = true;
      family.forEach((animal, index) => {
        const {
          baseX,
          baseY,
          baseZ,
          baseHeading,
          behaviorRole,
          phase,
          rig,
          restPose,
        } = animal.userData;
        const youngPlay = behaviorRole === 'young-play' && renderedFamilyMoment === 'glade-young-play';
        const branchPull = behaviorRole === 'branch-pull' && renderedFamilyMoment === 'glade-branch-pull';
        const motion = reducedMotion ? 0.12 : 1;
        const breath = Math.sin(elapsed * 0.82 + phase);
        animal.position.x = baseX;
        animal.position.z = baseZ;
        animal.position.y = baseY + breath * 0.012 * motion;
        animal.rotation.y = baseHeading;
        animal.rotation.z = Math.sin(elapsed * 0.45 + index) * 0.004 * motion;

        const contactShadow = familyContactShadows.children[index];
        const contactScale = animal.userData.young ? 0.88 : 1.36;
        contactShadow.visible = animal.visible;
        contactShadow.position.set(
          baseX,
          terrainHeight(baseX, baseZ) + 0.045,
          baseZ,
        );
        contactShadow.rotation.y = baseHeading;
        contactShadow.scale.set(contactScale * 1.55, 1, contactScale * 0.68);

        rig.neckPivot.rotation.z = restPose.neckZ + breath * 0.018 * motion;
        rig.headPivot.rotation.z = restPose.headZ - breath * 0.012 * motion;
        rig.jawPivot.rotation.z = restPose.jawZ;
        rig.tailPivots.forEach((pivot, tailIndex) => {
          pivot.rotation.z = restPose.tailZ[tailIndex]
            + Math.sin(elapsed * 0.42 + phase + tailIndex * 0.52) * (0.004 + tailIndex * 0.002) * motion;
          pivot.rotation.y = restPose.tailY[tailIndex]
            + Math.sin(elapsed * 0.34 + phase + tailIndex * 0.58)
            * (0.008 + tailIndex * 0.008) * motion;
        });
        Object.entries(rig.limbs).forEach(([key, limb], limbIndex) => {
          limb.upper.rotation.z = restPose.limbZ[key].upper;
          limb.mid.rotation.z = restPose.limbZ[key].mid;
          limb.distal.rotation.z = restPose.limbZ[key].distal;
          limb.root.rotation.y = Math.sin(elapsed * 0.42 + phase + limbIndex) * 0.008 * motion;
        });

        if (behaviorRole === 'graze') {
          rig.neckPivot.rotation.z = restPose.neckZ - 0.3 + breath * 0.025 * motion;
          rig.headPivot.rotation.z = restPose.headZ - 0.18 - breath * 0.018 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + (0.035 + Math.sin(elapsed * 2.1) * 0.022) * motion;
          applyHy3dIguanodonPose(animal, {
            graze: 0.78 + breath * 0.16 * motion,
            tailLeft: Math.max(0, breath) * 0.18 * motion,
            tailRight: Math.max(0, -breath) * 0.18 * motion,
          });
        }

        if (youngPlay) {
          // Play is a planted bow-and-counterstep, not a sliding root orbit.
          // Two diagonal feet remain the weight-bearing pair while the named
          // neck, head, limb and tail pivots carry the visible action.
          const playPhase = elapsed * 2.1 + phase;
          const playSignal = Math.sin(playPhase * 1.18);
          const strideSignal = Math.sin(playPhase * 1.42);
          const stride = strideSignal * 0.38 * motion;
          const brace = Math.max(0, strideSignal) * 0.3 * motion;
          const socialTurn = animal.userData.baseX < 0 ? 1 : -1;
          const leadWeight = animal.userData.baseX < 0 ? 1 : 0.72;
          animal.position.y += (
            Math.max(0, playSignal) * 0.132
              - Math.max(0, -playSignal) * 0.045
          ) * leadWeight * motion;
          animal.rotation.y = baseHeading
            + socialTurn * (0.15 + Math.sin(playPhase * 0.72) * 0.2) * motion;
          animal.rotation.z += strideSignal * 0.072 * leadWeight * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.26 + playSignal * 0.34 * motion;
          rig.headPivot.rotation.z = restPose.headZ + 0.12 - playSignal * 0.3 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + Math.max(0, -playSignal) * 0.035 * motion;
          rig.limbs.leftFore.upper.rotation.z += stride;
          rig.limbs.rightFore.upper.rotation.z -= stride;
          rig.limbs.leftHind.upper.rotation.z -= stride * 0.72;
          rig.limbs.rightHind.upper.rotation.z += stride * 0.72;
          rig.limbs.leftFore.mid.rotation.z += brace;
          rig.limbs.rightHind.mid.rotation.z += brace * 0.7;
          rig.limbs.rightFore.mid.rotation.z += Math.max(0, -stride) * 0.42;
          rig.limbs.leftHind.mid.rotation.z += Math.max(0, stride) * 0.3;
          rig.limbs.leftFore.root.rotation.y += socialTurn * strideSignal * 0.09 * motion;
          rig.limbs.rightFore.root.rotation.y -= socialTurn * strideSignal * 0.075 * motion;
          rig.limbs.leftHind.root.rotation.y -= socialTurn * strideSignal * 0.065 * motion;
          rig.limbs.rightHind.root.rotation.y += socialTurn * strideSignal * 0.085 * motion;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y -= playSignal * (0.075 + tailIndex * 0.038) * motion;
            pivot.rotation.z += playSignal * (0.03 + tailIndex * 0.011) * motion;
          });
          applyHy3dIguanodonPose(animal, {
            play: 0.46 + playSignal * 0.5 * motion,
            tailLeft: Math.max(0, playSignal) * motion,
            tailRight: Math.max(0, -playSignal) * motion,
          });
        } else if (branchPull) {
          const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
          const pull = 0.14 + pullCycle * 0.86 * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.36 * pull;
          rig.headPivot.rotation.z = restPose.headZ - 0.62 * pull;
          rig.jawPivot.rotation.z = restPose.jawZ + 0.14 * pull;
          rig.limbs.leftFore.upper.rotation.z = restPose.limbZ.leftFore.upper - 0.54 * pull;
          rig.limbs.rightFore.upper.rotation.z = restPose.limbZ.rightFore.upper - 0.54 * pull;
          rig.limbs.leftFore.mid.rotation.z = restPose.limbZ.leftFore.mid + 0.17 * pull;
          rig.limbs.rightFore.mid.rotation.z = restPose.limbZ.rightFore.mid + 0.17 * pull;
          rig.limbs.leftHind.upper.rotation.z = restPose.limbZ.leftHind.upper + 0.07 * pull;
          rig.limbs.rightHind.upper.rotation.z = restPose.limbZ.rightHind.upper + 0.07 * pull;
          animal.rotation.z -= 0.022 * pull;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y += pull * (0.018 + tailIndex * 0.012);
          });
          applyHy3dIguanodonPose(animal, {
            reach: pull,
            tailLeft: pull * 0.28,
          });
        } else if (behaviorRole === 'stay-close') {
          rig.neckPivot.rotation.z = restPose.neckZ + 0.06;
          rig.headPivot.rotation.z = restPose.headZ + 0.04;
          applyHy3dIguanodonPose(animal, {
            play: 0.2,
            tailRight: Math.max(0, breath) * 0.16 * motion,
            tailLeft: Math.max(0, -breath) * 0.16 * motion,
          });
        } else if (behaviorRole !== 'graze') {
          applyHy3dIguanodonPose(animal);
        }
      });
      const branchPull = renderedFamilyMoment === 'glade-branch-pull';
      const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
      // The bough flexes at the jaw contact instead of swinging through a
      // large disconnected arc. The dinosaur supplies most of the action;
      // the rooted tree only yields a few degrees under load.
      feedingBranch.userData.branchPivot.rotation.z = branchPull
        ? 0.03 + pullCycle * (reducedMotion ? 0.05 : 0.12)
        : 0.03;
      feedingBranch.userData.leafClusters.forEach((cluster, index) => {
        const rest = feedingBranch.userData.leafRestRotations[index];
        cluster.rotation.set(
          rest.x + (branchPull ? Math.sin(elapsed * 7.2 + index) * 0.08 * pullCycle : 0),
          rest.y,
          rest.z + (branchPull ? Math.cos(elapsed * 6.4 + index) * 0.045 * pullCycle : 0),
        );
      });
      smoke.children.forEach((puff, index) => {
        const drift = reducedMotion ? 0.04 : 0.14 + index * 0.012;
        puff.position.x = puff.userData.baseX + Math.sin(elapsed * 0.22 + index) * drift;
        puff.position.y = puff.userData.baseY
          + Math.sin(elapsed * 0.16 + index * 0.7) * (reducedMotion ? 0.04 : 0.14);
        puff.material.rotation = puff.userData.baseRotation
          + (reducedMotion ? 0 : Math.sin(elapsed * 0.09 + index) * 0.12);
      });
      smoke.userData.campFlames.children.forEach((flame, index) => {
        const flicker = reducedMotion
          ? 1
          : 0.86 + Math.sin(elapsed * (5.2 + index * 0.7) + index * 1.8) * 0.14;
        flame.scale.set(
          flame.userData.baseScale * (1.02 - flicker * 0.04),
          flame.userData.baseScale * flicker,
          flame.userData.baseScale * (0.96 + flicker * 0.03),
        );
        flame.rotation.y = index * 1.7 + (reducedMotion ? 0 : Math.sin(elapsed * 2.1 + index) * 0.12);
      });
      smoke.userData.emberGlow.intensity = reducedMotion
        ? 2.85
        : 2.85 + Math.sin(elapsed * 5.6) * 0.22;
      const signalFlag = smoke.userData.campSignal;
      const signalPositions = signalFlag.geometry.attributes.position;
      const basePositions = signalFlag.userData.basePositions;
      for (let index = 0; index < signalPositions.count; index += 1) {
        const offset = index * 3;
        const distanceFromHoist = THREE.MathUtils.clamp(-basePositions[offset] / 2.6, 0, 1);
        signalPositions.setY(
          index,
          basePositions[offset + 1]
            + Math.sin(elapsed * (reducedMotion ? 0.32 : 1.75) + distanceFromHoist * 2.1)
              * distanceFromHoist * (reducedMotion ? 0.02 : 0.085),
        );
        signalPositions.setZ(
          index,
          basePositions[offset + 2]
            + Math.sin(elapsed * (reducedMotion ? 0.45 : 2.8) + distanceFromHoist * 4.2)
              * distanceFromHoist * (reducedMotion ? 0.035 : 0.15),
        );
      }
      signalPositions.needsUpdate = true;
      signalFlag.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 1.65) * 0.035;
    },
    threatSnapshot() {
      const primary = pterodactyls[0];
      return {
        state: renderedThreatState,
        response: renderedThreatResponse,
        attackStage: renderedAttackStage,
        attackProgress: Number(renderedAttackProgress.toFixed(3)),
        flightPose: primary.userData.flightPose ?? null,
        position: {
          x: Number(primary.position.x.toFixed(2)),
          y: Number(primary.position.y.toFixed(2)),
          z: Number(primary.position.z.toFixed(2)),
        },
        scale: Number(primary.scale.x.toFixed(4)),
        anchorModel: 'fixed-world-orbit-latched-attack-origin',
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
    familySnapshot() {
      const pullingAdult = family.find((animal) => animal.userData.behaviorRole === 'branch-pull');
      const jawPosition = pullingAdult.userData.rig.jawPivot.getWorldPosition(new THREE.Vector3());
      const branchTip = feedingBranch.userData.branchPivot.localToWorld(
        feedingBranch.userData.contactPoint.clone(),
      );
      return {
        moment: renderedFamilyMoment,
        adults: family.filter((animal) => !animal.userData.young).length,
        young: family.filter((animal) => animal.userData.young).length,
        branchAngle: Number(feedingBranch.userData.branchPivot.rotation.z.toFixed(3)),
        branchContactDistance: Number(jawPosition.distanceTo(branchTip).toFixed(3)),
        positions: family.map((animal) => ({
          x: Number(animal.position.x.toFixed(3)),
          y: Number(animal.position.y.toFixed(3)),
          z: Number(animal.position.z.toFixed(3)),
        })),
        roles: family.map((animal) => animal.userData.behaviorRole),
      };
    },
    assetSnapshot() {
      return {
        terrain: {
          profile: terrain.geometry.userData.profile,
          vertices: terrain.geometry.attributes.position.count,
          surface: terrain.material.userData.surface,
          surfaceDetail: {
            ...terrain.material.userData.surfaceDetail,
            mediumFadeMeters: [
              ...terrain.material.userData.surfaceDetail.mediumFadeMeters,
            ],
            fineFadeMeters: [
              ...terrain.material.userData.surfaceDetail.fineFadeMeters,
            ],
            fineInclusionChannels: {
              ...terrain.material.userData.surfaceDetail.fineInclusionChannels,
            },
            normalReliefAmplitudeMeters: [
              ...terrain.material.userData.surfaceDetail.normalReliefAmplitudeMeters,
            ],
          },
          routeSurface: {
            ...terrain.material.userData.routeSurface,
            mainRouteInfluenceMeters: [
              ...terrain.material.userData.routeSurface.mainRouteInfluenceMeters,
            ],
            coveredForkInfluenceMeters: [
              ...terrain.material.userData.routeSurface.coveredForkInfluenceMeters,
            ],
            exposedForkInfluenceMeters: [
              ...terrain.material.userData.routeSurface.exposedForkInfluenceMeters,
            ],
          },
          surfaceGeology: {
            ...terrain.geometry.userData.surfaceGeology,
            ranges: Object.fromEntries(Object.entries(
              terrain.geometry.userData.surfaceGeology.ranges,
            ).map(([key, value]) => [key, { ...value }])),
          },
          fluvialSurface: {
            ...terrain.geometry.userData.fluvialSurface,
            ranges: Object.fromEntries(Object.entries(
              terrain.geometry.userData.fluvialSurface.ranges,
            ).map(([key, value]) => [key, { ...value }])),
          },
          ecology: {
            ...terrain.geometry.userData.ecology,
            ranges: Object.fromEntries(Object.entries(
              terrain.geometry.userData.ecology.ranges,
            ).map(([key, value]) => [key, { ...value }])),
            controlLines: {
              brook: BROOK_CONTROL_POINTS.length,
              mainRoute: MAIN_ROUTE_CONTROL_POINTS.length,
              coveredFork: COVERED_FORK_CONTROL_POINTS.length,
              exposedFork: EXPOSED_FORK_CONTROL_POINTS.length,
            },
          },
          bryophyte: {
            ...terrain.material.userData.bryophyte,
            sourceCanopyKinds: [...terrain.material.userData.bryophyte.sourceCanopyKinds],
            exclusions: [...terrain.material.userData.bryophyte.exclusions],
          },
          escarpment: {
            ...BASALT_ESCARPMENT_PROFILE,
            sourceZs: [...BASALT_ESCARPMENT_PROFILE.sourceZs],
            sourceHeightsAtX34: BASALT_ESCARPMENT_PROFILE.sourceZs.map((z) => (
              Number(basaltEscarpmentHeight(34, z).toFixed(3))
            )),
          },
        },
        brook: {
          surface: routeAndBrook.brook.material.userData.surface,
          motion: routeAndBrook.brook.material.userData.motion,
          layers: [...routeAndBrook.brook.material.userData.layers],
          optics: {
            ...routeAndBrook.brook.material.userData.optics,
            waterDepthRangeMeters: [
              ...routeAndBrook.brook.material.userData.optics.waterDepthRangeMeters,
            ],
            absorptionCoefficientPerMeter: [
              ...routeAndBrook.brook.material.userData.optics.absorptionCoefficientPerMeter,
            ],
            roughnessRange: [
              ...routeAndBrook.brook.material.userData.optics.roughnessRange,
            ],
            freeSurfaceGrid: [
              ...routeAndBrook.brook.material.userData.optics.freeSurfaceGrid,
            ],
            freeSurfaceDisplacementRangeMeters: [
              ...routeAndBrook.brook.material.userData.optics
                .freeSurfaceDisplacementRangeMeters,
            ],
          },
          freeSurface: {
            ...routeAndBrook.brook.geometry.userData.freeSurface,
            grid: [...routeAndBrook.brook.geometry.userData.freeSurface.grid],
            displacementRangeMeters: [
              ...routeAndBrook.brook.geometry.userData.freeSurface.displacementRangeMeters,
            ],
          },
          obstacleFlow: {
            ...routeAndBrook.brook.material.userData.obstacleFlow,
            activeCountByQuality: {
              ...routeAndBrook.brook.material.userData.obstacleFlow.activeCountByQuality,
            },
            selectedSourceClasses: [
              ...routeAndBrook.brook.material.userData.obstacleFlow.selectedSourceClasses,
            ],
            selectedIds: [
              ...routeAndBrook.brook.material.userData.obstacleFlow.selectedIds,
            ],
            rejectionCounts: {
              ...routeAndBrook.brook.material.userData.obstacleFlow.rejectionCounts,
            },
            obstacles: routeAndBrook.brook.material.userData.obstacleFlow.obstacles
              .map((obstacle) => ({
                ...obstacle,
                position: [...obstacle.position],
                flowDirection: [...obstacle.flowDirection],
              })),
          },
          bankIntegration: {
            profile: routeAndBrook.brookBank.userData.surface,
            model: routeAndBrook.brookBank.userData.bankSurfaceModel,
            topology: routeAndBrook.brookBank.userData.bankTopology,
            overlayGeometryCount:
              routeAndBrook.brookBank.userData.bankOverlayGeometryCount,
            overlayDrawCalls: routeAndBrook.brookBank.userData.bankOverlayDrawCalls,
            wetBankRoughnessRange: [
              ...routeAndBrook.brookBank.userData.wetBankRoughnessRange,
            ],
            contactModel: routeAndBrook.brookBank.userData.contactModel,
            sideAnchorCount: [
              routeAndBrook.leftWetEdge,
              routeAndBrook.rightWetEdge,
            ].filter((anchor) => anchor.isGroup && anchor.children.length === 0).length,
          },
          sedimentSorting: {
            model: routeAndBrook.brookStones.userData.sedimentSorting.model,
            processSource: routeAndBrook.brookStones.userData.sedimentSorting.processSource,
            distribution: routeAndBrook.brookStones.userData.distribution,
            contactModel: routeAndBrook.brookStones.userData.contactModel,
            geometry: {
              profile: routeAndBrook.brookStones.geometry.userData.profile,
              topology: routeAndBrook.brookStones.geometry.userData.topology,
              supportRingCount:
                routeAndBrook.brookStones.geometry.userData.supportRingCount,
              collapsedSupportRingCount:
                routeAndBrook.brookStones.geometry.userData.collapsedSupportRingCount,
              supportNormalBoundary:
                routeAndBrook.brookStones.geometry.userData.supportNormalBoundary,
              supportVertexCount:
                routeAndBrook.brookStones.geometry.userData.supportVertexCount,
              minimumTriangleArea: Number(
                routeAndBrook.brookStones.geometry.userData.minimumTriangleArea.toFixed(6),
              ),
            },
            material: {
              surface: routeAndBrook.brookStones.material.userData.surface,
              mapping: routeAndBrook.brookStones.material.userData.mapping,
              colourMultiplier: `#${routeAndBrook.brookStones.material.color.getHexString()}`,
              roughness: routeAndBrook.brookStones.material.roughness,
              metalness: routeAndBrook.brookStones.material.metalness,
              envMapIntensity: routeAndBrook.brookStones.material.envMapIntensity,
            },
            activeBedCount:
              routeAndBrook.brookStones.userData.sedimentSorting.activeBedCount,
            pointBarLagCount:
              routeAndBrook.brookStones.userData.sedimentSorting.pointBarLagCount,
            maximumSupportClearance: Number(Math.max(
              ...routeAndBrook.brookStones.userData.sedimentSorting.supportEvidence
                .map(({ maximumSupportClearance }) => maximumSupportClearance),
            ).toFixed(4)),
            minimumContactVertexCount: Math.min(
              ...routeAndBrook.brookStones.userData.sedimentSorting.supportEvidence
                .map(({ contactVertexCount }) => contactVertexCount),
            ),
          },
          driftwood: {
            instanceCount: routeAndBrook.driftwood.reduce((sum, mesh) => sum + mesh.count, 0),
            drawCalls: routeAndBrook.driftwood.length,
            supportModel: routeAndBrook.driftwood[0].userData.supportModel,
            collisionRole: routeAndBrook.driftwood[0].userData.collisionRole,
            supportEvidence: {
              ...routeAndBrook.driftwoodSupportEvidence,
              minimumClearance: Number(
                routeAndBrook.driftwoodSupportEvidence.minimumClearance.toFixed(4),
              ),
              maximumClearance: Number(
                routeAndBrook.driftwoodSupportEvidence.maximumClearance.toFixed(4),
              ),
              maximumTerrainSlope: Number(
                routeAndBrook.driftwoodSupportEvidence.maximumTerrainSlope.toFixed(4),
              ),
            },
            material: {
              surface: routeAndBrook.driftwood[0].material.userData.surface,
              energyModel: routeAndBrook.driftwood[0].material.userData.energyModel,
              moistureClass: routeAndBrook.driftwood[0].material.userData.moistureClass,
              textureChannels: {
                ...routeAndBrook.driftwood[0].material.userData.textureChannels,
              },
              flatShading: routeAndBrook.driftwood[0].material.flatShading,
              envMapIntensity: routeAndBrook.driftwood[0].material.envMapIntensity,
            },
            geometry: routeAndBrook.driftwood.map((mesh) => ({
              variant: mesh.geometry.userData.variant,
              profile: mesh.geometry.userData.profile,
              surface: mesh.geometry.userData.surface,
              triangleCount: mesh.geometry.userData.triangleCount,
              closedSegmentCount: mesh.geometry.userData.closedSegmentCount,
              primaryBranchCount: mesh.geometry.userData.primaryBranchCount,
              splinterCount: mesh.geometry.userData.splinterCount,
              supportPointCount: mesh.geometry.userData.supportPoints.length,
              loadPath: mesh.geometry.userData.loadPath,
            })),
          },
          hydrology: {
            version: routeAndBrook.brookHydrology.profile.version,
            drainageModel: routeAndBrook.brookHydrology.profile.drainageModel,
            crossChannelSurfaceModel:
              routeAndBrook.brookHydrology.profile.crossChannelSurfaceModel,
            surfaceEnergyModel:
              routeAndBrook.brookHydrology.profile.surfaceEnergyModel,
            reflectionModel: routeAndBrook.brookHydrology.profile.reflectionModel,
            screenSpaceReflectionModel: BROOK_REFLECTION_PROFILE.model,
            sampleCount: routeAndBrook.brookHydrology.waterLevels.length,
            confluenceIndex: routeAndBrook.brookHydrology.confluenceIndex,
            confluence: routeAndBrook.brookHydrology.confluence.toArray()
              .map((value) => Number(value.toFixed(4))),
            minimumDownstreamGrade: Number(
              routeAndBrook.brookHydrology.minimumMeasuredDownstreamGrade.toFixed(6),
            ),
            maximumDownstreamGrade: Number(
              routeAndBrook.brookHydrology.maximumMeasuredDownstreamGrade.toFixed(6),
            ),
            maximumFlowEnergy: Number(
              routeAndBrook.brookHydrology.maximumFlowEnergy.toFixed(4),
            ),
            maximumPondingDepth: Number(
              routeAndBrook.brookHydrology.maximumPondingDepth.toFixed(4),
            ),
            maximumBedClearance: Number(
              routeAndBrook.brookHydrology.maximumBedClearance.toFixed(4),
            ),
            crossChannelGrade: routeAndBrook.brookHydrology.crossChannelGrade,
            northHeadwaterDrop: Number((
              routeAndBrook.brookHydrology.waterLevels[0]
                - routeAndBrook.brookHydrology.waterLevels[
                  routeAndBrook.brookHydrology.confluenceIndex
                ]
            ).toFixed(4)),
            southHeadwaterDrop: Number((
              routeAndBrook.brookHydrology.waterLevels.at(-1)
                - routeAndBrook.brookHydrology.waterLevels[
                  routeAndBrook.brookHydrology.confluenceIndex
                ]
            ).toFixed(4)),
            reflectionReachCount: routeAndBrook.brookHydrology.reaches.length,
          },
          sceneCapture: brookSceneCapture.snapshot(),
        },
        brookBoulder: {
          version: BROOK_BOULDER_ASSET.version,
          visualStatus: brookBoulderVisualStatus,
          visualError: brookBoulderVisualError,
          loaded: Boolean(brookBoulder.userData.assetVisual),
          fallbackVisible: brookBoulder.userData.fallback.visible,
          bytes: BROOK_BOULDER_ASSET.bytes,
          triangles: BROOK_BOULDER_ASSET.triangles,
          massTriangles: BROOK_BOULDER_ASSET.massTriangles,
          apronTriangles: BROOK_BOULDER_ASSET.apronTriangles,
          drawCalls: BROOK_BOULDER_ASSET.drawCalls,
          fragmentCount: BROOK_BOULDER_ASSET.fragmentCount,
          provenance: BROOK_BOULDER_ASSET.provenance,
          supportModel: BROOK_BOULDER_ASSET.supportModel,
          collisionRole: BROOK_BOULDER_ASSET.collisionRole,
          normalModel: BROOK_BOULDER_ASSET.normalModel,
          transportClass: brookBoulder.userData.transportClass,
          presentFlowMobility: brookBoulder.userData.presentFlowMobility,
          material: brookBoulder.userData.assetVisual ? (() => {
            const mass = brookBoulder.userData.assetVisual.getObjectByName(
              'brook-boulder-load-bearing-mass',
            );
            return {
              surface: mass.material.userData.surface,
              albedoModel: mass.material.userData.albedoModel,
              energyModel: mass.material.userData.energyModel,
              flatShading: mass.material.flatShading,
              colourMultiplier: `#${mass.material.color.getHexString()}`,
              capillaryBand: { ...mass.material.userData.capillaryBand },
            };
          })() : null,
          position: [brookBoulder.position.x, brookBoulder.position.y, brookBoulder.position.z],
          scale: [brookBoulder.scale.x, brookBoulder.scale.y, brookBoulder.scale.z],
          supportEvidence: brookBoulder.userData.supportEvidence ? {
            supportVertexCount: brookBoulder.userData.supportEvidence.supportVertexCount,
            supportedVertexCount: brookBoulder.userData.supportEvidence.supportedVertexCount,
            supportRatio: Number(
              brookBoulder.userData.supportEvidence.supportRatio.toFixed(4),
            ),
            minimumClearance: Number(
              brookBoulder.userData.supportEvidence.minimumClearance.toFixed(4),
            ),
            maximumClearance: Number(
              brookBoulder.userData.supportEvidence.maximumClearance.toFixed(4),
            ),
            burialDepth: brookBoulder.userData.supportEvidence.burialDepth,
          } : null,
        },
        canopyTreeLibrary: {
          version: CANOPY_TREE_LIBRARY_ASSET.version,
          visualStatus: canopyTreeLibraryVisualStatus,
          visualError: canopyTreeLibraryVisualError,
          loaded: Boolean(vegetation.canopyTreeAssetAnchor.userData.assetVisual),
          fallbackVisible: vegetation.canopyTreeAssetAnchor.userData.fallbackMeshes.some(
            (mesh) => mesh.visible,
          ),
          bytes: CANOPY_TREE_LIBRARY_ASSET.bytes,
          triangles: CANOPY_TREE_LIBRARY_ASSET.triangles,
          trianglesByVariant: [...CANOPY_TREE_LIBRARY_ASSET.trianglesByVariant],
          renderedTriangles: vegetation.canopyTreeAssetAnchor.userData.assetVisual
            ?.userData.counts.reduce((sum, count, index) => (
              sum + count * CANOPY_TREE_LIBRARY_ASSET.trianglesByVariant[index]
            ), 0) ?? 0,
          drawCalls: CANOPY_TREE_LIBRARY_ASSET.drawCalls,
          drawCallsPerVariant: CANOPY_TREE_LIBRARY_ASSET.drawCallsPerVariant,
          variantCount: CANOPY_TREE_LIBRARY_ASSET.variantCount,
          variantIds: [...CANOPY_TREE_LIBRARY_ASSET.variantIds],
          leafCounts: [...CANOPY_TREE_LIBRARY_ASSET.leafCounts],
          damagedLeafCounts: [...CANOPY_TREE_LIBRARY_ASSET.damagedLeafCounts],
          branchAnchorCounts: [...CANOPY_TREE_LIBRARY_ASSET.branchAnchorCounts],
          instanceCount: vegetation.canopyTreeAssetAnchor.userData.assetVisual
            ?.userData.instanceCount ?? 0,
          counts: [
            ...(vegetation.canopyTreeAssetAnchor.userData.assetVisual?.userData.counts ?? []),
          ],
          habitatCounts: {
            ...(vegetation.canopyTreeAssetAnchor.userData.assetVisual
              ?.userData.habitatCounts ?? {}),
          },
          distributionModel: 'species-first-with-terrain-hydrology-splitting-elliptic-broadleaf',
          provenance: CANOPY_TREE_LIBRARY_ASSET.provenance,
          supportModel: CANOPY_TREE_LIBRARY_ASSET.supportModel,
          collisionRole: CANOPY_TREE_LIBRARY_ASSET.collisionRole,
          growthModel: CANOPY_TREE_LIBRARY_ASSET.growthModel,
          leafAttachmentDistribution: CANOPY_TREE_LIBRARY_ASSET.leafAttachmentDistribution,
          leafCoverageModel: CANOPY_TREE_LIBRARY_ASSET.leafCoverageModel,
          leafNodeHierarchy: CANOPY_TREE_LIBRARY_ASSET.leafNodeHierarchy,
          leafCountGrowthPercent: CANOPY_TREE_LIBRARY_ASSET.leafCountGrowthPercent,
          assetTriangleGrowthPercent: CANOPY_TREE_LIBRARY_ASSET.assetTriangleGrowthPercent,
          assetTriangleGrowthBaseline: CANOPY_TREE_LIBRARY_ASSET.assetTriangleGrowthBaseline,
          roundedLaminaTriangleGrowthPercent:
            CANOPY_TREE_LIBRARY_ASSET.roundedLaminaTriangleGrowthPercent,
          roundedLaminaTriangleGrowthBaseline:
            CANOPY_TREE_LIBRARY_ASSET.roundedLaminaTriangleGrowthBaseline,
          trianglesPerLeaf: CANOPY_TREE_LIBRARY_ASSET.trianglesPerLeaf,
          verticesPerLeaf: CANOPY_TREE_LIBRARY_ASSET.verticesPerLeaf,
          leafSurfaceTriangleMultiplier:
            CANOPY_TREE_LIBRARY_ASSET.leafSurfaceTriangleMultiplier,
          partialLaminaDamage: CANOPY_TREE_LIBRARY_ASSET.partialLaminaDamage,
          crownArchitecture: CANOPY_TREE_LIBRARY_ASSET.crownArchitecture,
          brokenBranchCounts: [...CANOPY_TREE_LIBRARY_ASSET.brokenBranchCounts],
          fractureSplinterCounts: [...CANOPY_TREE_LIBRARY_ASSET.fractureSplinterCounts],
          crownBudgetModel: CANOPY_TREE_LIBRARY_ASSET.crownBudgetModel,
          surfaceVariation: {
            ...CANOPY_TREE_SURFACE_VARIATION_PROFILE,
          },
          leafRetention: vegetation.canopyTreeAssetAnchor.userData.assetVisual ? {
            ...vegetation.canopyTreeAssetAnchor.userData.assetVisual.userData.leafRetentionSummary,
            minimumRetention: Number(vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.leafRetentionSummary.minimumRetention.toFixed(4)),
            maximumRetention: Number(vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.leafRetentionSummary.maximumRetention.toFixed(4)),
            meanRetention: Number(vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.leafRetentionSummary.meanRetention.toFixed(4)),
            ageCounts: {
              ...vegetation.canopyTreeAssetAnchor.userData.assetVisual.userData
                .leafRetentionSummary.ageCounts,
            },
          } : null,
          placementAnchorCount: vegetation.canopyTreeAssetAnchor.children.filter(
            (child) => child.userData.canopyTreePlacementAnchor,
          ).length,
          allTrunksVertical: vegetation.canopyTreeAssetAnchor.children
            .filter((child) => child.userData.canopyTreePlacementAnchor)
            .every((child) => Math.abs(child.rotation.x) < 0.000_001
              && Math.abs(child.rotation.z) < 0.000_001),
          dimensionSummary: (
            vegetation.canopyTreeAssetAnchor.userData.assetVisual?.userData.dimensionSummary ?? []
          ).map((summary) => ({
            id: summary.id,
            instanceCount: summary.instanceCount,
            maximumDiameterMeters: Number(summary.maximumDiameterMeters.toFixed(4)),
            maximumHeightMeters: Number(summary.maximumHeightMeters.toFixed(4)),
            maximumCrownDiameterMeters: summary.maximumCrownDiameterMeters,
            maximumMatureHeightMeters: summary.maximumMatureHeightMeters,
            envelopePassCount: summary.envelopePassCount,
          })),
          supportEvidence: vegetation.canopyTreeAssetAnchor.userData.supportEvidence ? {
            supportVertexCount:
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence.supportVertexCount,
            supportedVertexCount:
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence.supportedVertexCount,
            supportRatio: Number(
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence.supportRatio.toFixed(4),
            ),
            minimumClearance: Number(
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence
                .minimumClearance.toFixed(4),
            ),
            maximumClearance: Number(
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence
                .maximumClearance.toFixed(4),
            ),
            burialDepth: vegetation.canopyTreeAssetAnchor.userData.supportEvidence.burialDepth,
            settlementAxis:
              vegetation.canopyTreeAssetAnchor.userData.supportEvidence.settlementAxis,
          } : null,
          materials: vegetation.canopyTreeAssetAnchor.userData.assetVisual ? {
            structureSurfaces: Object.fromEntries(Object.entries(
              vegetation.canopyTreeAssetAnchor.userData.assetVisual
                .userData.materials.structures,
            ).map(([family, material]) => [family, material.userData.surface])),
            leafSurfaces: Object.fromEntries(Object.entries(
              vegetation.canopyTreeAssetAnchor.userData.assetVisual.userData.materials.leaves,
            ).map(([family, material]) => [family, material.userData.surface])),
            energyModel: vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.materials.leaves['elliptic-waxy'].userData.energyModel,
            albedoProfile: vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.materials.leaves['elliptic-waxy'].userData.albedoProfile,
          } : null,
          windModel: {
            ...CANOPY_TREE_WIND_PROFILE,
            direction: [...CANOPY_TREE_WIND_PROFILE.direction],
          },
          windState: vegetation.canopyTreeAssetAnchor.userData.assetVisual ? {
            time: Number(vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.time.value.toFixed(3)),
            horizontalStrength: vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.strength.value,
            verticalStrength: vegetation.canopyTreeAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.verticalStrength.value,
          } : null,
          shadowDisplacement: CANOPY_TREE_WIND_PROFILE.shadowModel,
        },
        vegetation: {
          profile: vegetation.profile,
          trunkFamilies: vegetation.trunkMeshes.map((mesh) => ({
            name: mesh.name,
            instances: mesh.count,
            geometry: mesh.geometry.userData.profile,
            barkFamily: mesh.geometry.userData.barkFamily,
            geometricRelief: mesh.geometry.userData.geometricRelief,
            material: mesh.material.userData.surface,
            albedo: mesh.material.map.name,
            roughness: mesh.material.roughnessMap.name,
            height: mesh.material.bumpMap.name,
          })),
          leafFamilies: vegetation.leafDetailMeshes.map((mesh) => ({
            name: mesh.name,
            instances: mesh.count,
            family: mesh.geometry.userData.family,
            anchorCount: mesh.geometry.userData.anchorCount,
            supportModel: mesh.geometry.userData.supportModel,
            atlas: mesh.material.map.name,
            atlasSource: mesh.material.map.userData.source,
            energyModel: mesh.material.userData.energyModel,
            windModel: {
              ...mesh.material.userData.windModel,
              direction: [...mesh.material.userData.windModel.direction],
              anchorUvY: [...mesh.material.userData.windModel.anchorUvY],
            },
            windState: {
              time: Number(mesh.material.userData.windUniforms.time.value.toFixed(3)),
              horizontalStrength: mesh.material.userData.windUniforms.strength.value,
              verticalStrength: mesh.material.userData.windUniforms.verticalStrength.value,
            },
            shadowDisplacement: mesh.customDepthMaterial.userData.shadowModel,
          })),
          interiorMassRole: vegetation.crownMesh.userData.compositionRole,
        },
        treeFernLibrary: {
          version: TREE_FERN_LIBRARY_ASSET.version,
          visualStatus: treeFernLibraryVisualStatus,
          visualError: treeFernLibraryVisualError,
          loaded: Boolean(habitatAccents.treeFernAssetAnchor.userData.assetVisual),
          fallbackVisible: habitatAccents.treeFernAssetAnchor.userData.fallbackMeshes.some(
            (mesh) => mesh.visible,
          ),
          bytes: TREE_FERN_LIBRARY_ASSET.bytes,
          triangles: TREE_FERN_LIBRARY_ASSET.triangles,
          trianglesByVariant: [...TREE_FERN_LIBRARY_ASSET.trianglesByVariant],
          drawCalls: TREE_FERN_LIBRARY_ASSET.drawCalls,
          drawCallsPerVariant: TREE_FERN_LIBRARY_ASSET.drawCallsPerVariant,
          variantCount: TREE_FERN_LIBRARY_ASSET.variantCount,
          variantIds: [...TREE_FERN_LIBRARY_ASSET.variantIds],
          frondCounts: [...TREE_FERN_LIBRARY_ASSET.frondCounts],
          instanceCount: habitatAccents.treeFernAssetAnchor.userData.assetVisual
            ?.userData.instanceCount ?? 0,
          counts: [
            ...(habitatAccents.treeFernAssetAnchor.userData.assetVisual?.userData.counts ?? []),
          ],
          habitatCounts: {
            ...(habitatAccents.treeFernAssetAnchor.userData.assetVisual
              ?.userData.habitatCounts ?? {}),
          },
          distributionModel: 'source-coupled-moisture-slope-exposure-and-shelter',
          provenance: TREE_FERN_LIBRARY_ASSET.provenance,
          supportModel: TREE_FERN_LIBRARY_ASSET.supportModel,
          collisionRole: TREE_FERN_LIBRARY_ASSET.collisionRole,
          growthModel: TREE_FERN_LIBRARY_ASSET.growthModel,
          placementAnchorCount: habitatAccents.treeFernAssetAnchor.children.filter(
            (child) => child.userData.treeFernPlacementAnchor,
          ).length,
          allTrunksVertical: habitatAccents.treeFernAssetAnchor.children
            .filter((child) => child.userData.treeFernPlacementAnchor)
            .every((child) => Math.abs(child.rotation.x) < 0.000_001
              && Math.abs(child.rotation.z) < 0.000_001),
          dimensionSummary: habitatAccents.treeFernAssetAnchor.userData.assetVisual ? (() => {
            const summary = habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.dimensionSummary;
            return {
              instanceCount: summary.instanceCount,
              maximumDiameterMeters: Number(summary.maximumDiameterMeters.toFixed(4)),
              maximumHeightMeters: Number(summary.maximumHeightMeters.toFixed(4)),
              maximumCrownDiameterMeters: summary.maximumCrownDiameterMeters,
              maximumMatureHeightMeters: summary.maximumMatureHeightMeters,
              envelopePassCount: summary.envelopePassCount,
            };
          })() : null,
          supportEvidence: habitatAccents.treeFernAssetAnchor.userData.supportEvidence ? {
            supportVertexCount:
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence.supportVertexCount,
            supportedVertexCount:
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence.supportedVertexCount,
            supportRatio: Number(
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence.supportRatio.toFixed(4),
            ),
            minimumClearance: Number(
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence
                .minimumClearance.toFixed(4),
            ),
            maximumClearance: Number(
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence
                .maximumClearance.toFixed(4),
            ),
            burialDepth: habitatAccents.treeFernAssetAnchor.userData.supportEvidence.burialDepth,
            settlementAxis:
              habitatAccents.treeFernAssetAnchor.userData.supportEvidence.settlementAxis,
          } : null,
          material: habitatAccents.treeFernAssetAnchor.userData.assetVisual ? {
            barkSurface: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.rootTrunk.userData.surface,
            leafSurface: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.leaflet.userData.surface,
            energyModel: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.leaflet.userData.energyModel,
            albedoProfile: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.leaflet.userData.albedoProfile,
            barkAlbedo: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.bark.albedo.name,
            barkRoughness: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.bark.roughness.name,
            barkHeight: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.bark.height.name,
            leafAlbedo: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.leaf.albedo.name,
            leafRoughness: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.leaf.roughness.name,
            leafHeight: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.textures.leaf.height.name,
          } : null,
          windModel: {
            ...TREE_FERN_WIND_PROFILE,
            direction: [...TREE_FERN_WIND_PROFILE.direction],
          },
          windState: habitatAccents.treeFernAssetAnchor.userData.assetVisual ? {
            time: Number(habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.time.value.toFixed(3)),
            horizontalStrength: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.strength.value,
            verticalStrength: habitatAccents.treeFernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.verticalStrength.value,
          } : null,
          shadowDisplacement: TREE_FERN_WIND_PROFILE.shadowModel,
        },
        fernLibrary: {
          version: FERN_LIBRARY_ASSET.version,
          visualStatus: fernLibraryVisualStatus,
          visualError: fernLibraryVisualError,
          loaded: Boolean(vegetation.fernAssetAnchor.userData.assetVisual),
          fallbackVisible: vegetation.fernAssetAnchor.userData.fallbackMeshes.some(
            (mesh) => mesh.visible,
          ),
          runtimeDrawCalls: (
            vegetation.fernAssetAnchor.userData.assetVisual ? FERN_LIBRARY_ASSET.drawCalls : 0
          ) + (
            accentFernAssetAnchor.userData.assetVisual ? FERN_LIBRARY_ASSET.drawCalls : 0
          ) + (
            brookResponse.userData.assetAnchor.userData.assetVisual
              ? brookResponse.userData.assetAnchor.userData.assetVisual.userData.counts
                .filter((count) => count > 0).length * FERN_LIBRARY_ASSET.drawCallsPerVariant
              : 0
          ),
          foregroundReplacementCount: FERN_LIBRARY_LAYOUT.filter(
            (placement) => placement.sourceRole === 'foreground-depth-frond-replacement',
          ).length,
          proceduralForegroundFallbackVisible: habitatAccents.foregroundFronds.visible,
          bytes: FERN_LIBRARY_ASSET.bytes,
          triangles: FERN_LIBRARY_ASSET.triangles,
          trianglesByVariant: [...FERN_LIBRARY_ASSET.trianglesByVariant],
          drawCalls: FERN_LIBRARY_ASSET.drawCalls,
          drawCallsPerVariant: FERN_LIBRARY_ASSET.drawCallsPerVariant,
          variantCount: FERN_LIBRARY_ASSET.variantCount,
          variantIds: [...FERN_LIBRARY_ASSET.variantIds],
          instanceCount: vegetation.fernAssetAnchor.userData.assetVisual?.userData.instanceCount
            ?? 0,
          counts: [
            ...(vegetation.fernAssetAnchor.userData.assetVisual?.userData.counts ?? []),
          ],
          habitatCounts: {
            ...(vegetation.fernAssetAnchor.userData.assetVisual?.userData.habitatCounts ?? {}),
          },
          distributionModel: 'wet-margin-and-drained-slope-priority-with-seeded-understory-fallback',
          provenance: FERN_LIBRARY_ASSET.provenance,
          supportModel: FERN_LIBRARY_ASSET.supportModel,
          collisionRole: FERN_LIBRARY_ASSET.collisionRole,
          material: vegetation.fernAssetAnchor.userData.assetVisual ? {
            leafSurface: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.leaf.userData.surface,
            energyModel: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.leaf.userData.energyModel,
            albedoProfile: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.leaf.userData.albedoProfile,
            albedo: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.textures.albedo.name,
            roughness: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.textures.roughness.name,
            height: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.textures.height.name,
          } : null,
          windModel: {
            ...FERN_WIND_PROFILE,
            direction: [...FERN_WIND_PROFILE.direction],
          },
          windState: vegetation.fernAssetAnchor.userData.assetVisual ? {
            time: Number(vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.time.value.toFixed(3)),
            horizontalStrength: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.strength.value,
            verticalStrength: vegetation.fernAssetAnchor.userData.assetVisual
              .userData.materials.windUniforms.verticalStrength.value,
          } : null,
          shadowDisplacement: FERN_WIND_PROFILE.shadowModel,
          supportEvidence: vegetation.fernAssetAnchor.userData.supportEvidence ? {
            supportVertexCount:
              vegetation.fernAssetAnchor.userData.supportEvidence.supportVertexCount,
            supportedVertexCount:
              vegetation.fernAssetAnchor.userData.supportEvidence.supportedVertexCount,
            supportRatio: Number(
              vegetation.fernAssetAnchor.userData.supportEvidence.supportRatio.toFixed(4),
            ),
            minimumClearance: Number(
              vegetation.fernAssetAnchor.userData.supportEvidence.minimumClearance.toFixed(4),
            ),
            maximumClearance: Number(
              vegetation.fernAssetAnchor.userData.supportEvidence.maximumClearance.toFixed(4),
            ),
            burialDepth: vegetation.fernAssetAnchor.userData.supportEvidence.burialDepth,
          } : null,
          accentLibrary: {
            loaded: Boolean(accentFernAssetAnchor.userData.assetVisual),
            visible: degradableGroundAccents.visible
              && (accentFernAssetAnchor.userData.assetVisual?.visible ?? false),
            qualityGated: true,
            fallbackVisible: accentFernAssetAnchor.userData.fallbackMeshes.some(
              (mesh) => mesh.visible,
            ),
            instanceCount: accentFernAssetAnchor.userData.assetVisual?.userData.instanceCount ?? 0,
            counts: [
              ...(accentFernAssetAnchor.userData.assetVisual?.userData.counts ?? []),
            ],
            habitatCounts: {
              ...(accentFernAssetAnchor.userData.assetVisual?.userData.habitatCounts ?? {}),
            },
            placementRoleCounts: Object.fromEntries([
              'tree-fern-understory-skirt-replacement',
              'degradable-wetland-accent-replacement',
              'degradable-margin-accent-replacement',
            ].map((role) => [
              role,
              accentFernAssetAnchor.userData.placements.filter(
                (placement) => placement.sourceRole === role,
              ).length,
            ])),
            dimensionSummary: Object.fromEntries(Object.entries(
              accentFernAssetAnchor.userData.assetVisual?.userData.dimensionSummary ?? {},
            ).map(([role, summary]) => [role, {
              instanceCount: summary.instanceCount,
              maximumDiameterMeters: Number(summary.maximumDiameterMeters.toFixed(4)),
              maximumHeightMeters: Number(summary.maximumHeightMeters.toFixed(4)),
              maxDiameterMeters: summary.maxDiameterMeters,
              maxHeightMeters: summary.maxHeightMeters,
              envelopePassCount: summary.envelopePassCount,
            }])),
            supportEvidence: accentFernAssetAnchor.userData.supportEvidence ? {
              supportVertexCount:
                accentFernAssetAnchor.userData.supportEvidence.supportVertexCount,
              supportedVertexCount:
                accentFernAssetAnchor.userData.supportEvidence.supportedVertexCount,
              supportRatio: Number(
                accentFernAssetAnchor.userData.supportEvidence.supportRatio.toFixed(4),
              ),
              minimumClearance: Number(
                accentFernAssetAnchor.userData.supportEvidence.minimumClearance.toFixed(4),
              ),
              maximumClearance: Number(
                accentFernAssetAnchor.userData.supportEvidence.maximumClearance.toFixed(4),
              ),
              burialDepth: accentFernAssetAnchor.userData.supportEvidence.burialDepth,
            } : null,
          },
          brookResponseStand: {
            loaded: Boolean(brookResponse.userData.assetAnchor.userData.assetVisual),
            fallbackVisible: brookResponse.visible,
            response: brookResponse.userData.response,
            instanceCount:
              brookResponse.userData.assetAnchor.userData.assetVisual?.userData.instanceCount ?? 0,
            counts: [
              ...(brookResponse.userData.assetAnchor.userData.assetVisual?.userData.counts ?? []),
            ],
            activeDrawCalls: brookResponse.userData.assetAnchor.userData.assetVisual
              ? brookResponse.userData.assetAnchor.userData.assetVisual.userData.counts
                .filter((count) => count > 0).length * FERN_LIBRARY_ASSET.drawCallsPerVariant
              : 0,
            placementRole: 'brook-response-humid-brush-replacement',
            supportModel: brookResponse.userData.assetAnchor.userData.supportModel,
            collisionRole: brookResponse.userData.assetAnchor.userData.collisionRole,
            dimensionSummary: (() => {
              const summary = brookResponse.userData.assetAnchor.userData.assetVisual
                ?.userData.dimensionSummary['brook-response-humid-brush-replacement'];
              return summary ? {
                instanceCount: summary.instanceCount,
                maximumDiameterMeters: Number(summary.maximumDiameterMeters.toFixed(4)),
                maximumHeightMeters: Number(summary.maximumHeightMeters.toFixed(4)),
                maxDiameterMeters: summary.maxDiameterMeters,
                maxHeightMeters: summary.maxHeightMeters,
                envelopePassCount: summary.envelopePassCount,
              } : null;
            })(),
            supportEvidence: brookResponse.userData.assetAnchor.userData.supportEvidence ? {
              supportVertexCount:
                brookResponse.userData.assetAnchor.userData.supportEvidence.supportVertexCount,
              supportedVertexCount:
                brookResponse.userData.assetAnchor.userData.supportEvidence.supportedVertexCount,
              supportRatio: Number(
                brookResponse.userData.assetAnchor.userData.supportEvidence.supportRatio.toFixed(4),
              ),
              minimumClearance: Number(
                brookResponse.userData.assetAnchor.userData.supportEvidence
                  .minimumClearance.toFixed(4),
              ),
              maximumClearance: Number(
                brookResponse.userData.assetAnchor.userData.supportEvidence
                  .maximumClearance.toFixed(4),
              ),
              burialDepth:
                brookResponse.userData.assetAnchor.userData.supportEvidence.burialDepth,
            } : null,
            windState: brookResponse.userData.assetAnchor.userData.assetVisual ? {
              time: Number(brookResponse.userData.assetAnchor.userData.assetVisual
                .userData.materials.windUniforms.time.value.toFixed(3)),
              horizontalStrength: brookResponse.userData.assetAnchor.userData.assetVisual
                .userData.materials.windUniforms.strength.value,
              verticalStrength: brookResponse.userData.assetAnchor.userData.assetVisual
                .userData.materials.windUniforms.verticalStrength.value,
            } : null,
          },
        },
        nonColumnarRocks: {
          profile: nonColumnarRockFamilies.userData.profile,
          placementCount: nonColumnarRockFamilies.userData.placementCount,
          collisionPolicy: nonColumnarRockFamilies.userData.collisionPolicy,
          fluvialTransport: {
            ...nonColumnarRockFamilies.userData.fluvialTransport,
            presentMobileLongAxisMeters: [
              ...nonColumnarRockFamilies.userData.fluvialTransport.presentMobileLongAxisMeters,
            ],
            historicalLagLongAxisMeters: [
              ...nonColumnarRockFamilies.userData.fluvialTransport.historicalLagLongAxisMeters,
            ],
          },
          families: nonColumnarRockFamilies.children.map((familyMesh) => ({
            family: familyMesh.userData.family,
            instances: familyMesh.count,
            geometry: familyMesh.geometry.userData.profile,
            silhouetteModel: familyMesh.geometry.userData.silhouetteModel ?? null,
            topology: familyMesh.geometry.userData.topology ?? null,
            supportRingCount: familyMesh.geometry.userData.supportRingCount ?? null,
            collapsedSupportRingCount:
              familyMesh.geometry.userData.collapsedSupportRingCount ?? null,
            supportNormalBoundary:
              familyMesh.geometry.userData.supportNormalBoundary ?? null,
            minimumTriangleArea: familyMesh.geometry.userData.minimumTriangleArea
              ? Number(familyMesh.geometry.userData.minimumTriangleArea.toFixed(6))
              : null,
            beddingLedgeCount: familyMesh.geometry.userData.beddingLedgeCount ?? 0,
            normalProfile: familyMesh.geometry.userData.normalProfile,
            localDimensionsMeters: [
              Number((familyMesh.geometry.boundingBox.max.x
                - familyMesh.geometry.boundingBox.min.x).toFixed(4)),
              Number((familyMesh.geometry.boundingBox.max.y
                - familyMesh.geometry.boundingBox.min.y).toFixed(4)),
              Number((familyMesh.geometry.boundingBox.max.z
                - familyMesh.geometry.boundingBox.min.z).toFixed(4)),
            ],
            material: familyMesh.material.userData.surface,
            mapping: familyMesh.material.userData.mapping,
            collisionRole: familyMesh.userData.collisionRole,
            distribution: familyMesh.userData.distribution,
            transportClasses: [...familyMesh.userData.transportClasses],
            presentFlowMobilities: [...familyMesh.userData.presentFlowMobilities],
            longAxisRangeMeters: familyMesh.userData.longAxisRangeMeters
              ? [...familyMesh.userData.longAxisRangeMeters]
              : null,
            maximumBrookWidthFraction:
              familyMesh.userData.maximumBrookWidthFraction ?? null,
            minimumSupportClearance: Number(Math.min(
              ...familyMesh.userData.supportEvidence.map(
                ({ minimumSupportClearance }) => minimumSupportClearance,
              ),
            ).toFixed(4)),
            maximumSupportClearance: Number(Math.max(
              ...familyMesh.userData.supportEvidence.map(
                ({ maximumSupportClearance }) => maximumSupportClearance,
              ),
            ).toFixed(4)),
            minimumContactVertexCount: Math.min(
              ...familyMesh.userData.supportEvidence.map(
                ({ contactVertexCount }) => contactVertexCount,
              ),
            ),
          })),
        },
        basaltShelf: {
          version: BASALT_SHELF_ASSET.version,
          visualStatus: basaltShelfVisualStatus,
          visualError: basaltShelfVisualError,
          loaded: basalt.assetAnchors.filter((anchor) => anchor.userData.assetVisual).length,
          fallbackVisible: basalt.proceduralFallback.visible,
          bytes: BASALT_SHELF_ASSET.bytes,
          totalAssetTriangles: BASALT_SHELF_ASSET.triangles,
          trianglesPerFormation: Math.max(...BASALT_SHELF_ASSET.trianglesByVariant),
          trianglesByVariant: [...BASALT_SHELF_ASSET.trianglesByVariant],
          drawCallsPerFormation: BASALT_SHELF_ASSET.drawCalls,
          variantCount: BASALT_SHELF_ASSET.variantCount,
          variantIds: [...BASALT_SHELF_ASSET.variantIds],
          shelfCount: BASALT_SHELF_ASSET.shelfCount,
          fragmentCount: BASALT_SHELF_ASSET.fragmentCount,
          provenance: BASALT_SHELF_ASSET.provenance,
          supportModel: BASALT_SHELF_ASSET.supportModel,
          collisionRole: 'non-solid-outside-navigation-boundary',
          formations: basalt.assetAnchors.map((anchor) => ({
            position: [anchor.position.x, anchor.position.z],
            scale: anchor.scale.x,
            variantId: anchor.userData.variantId ?? null,
            triangles: BASALT_SHELF_ASSET.trianglesByVariant[
              anchor.userData.formationIndex
            ],
            supportModel: anchor.userData.supportModel,
            supportEvidence: anchor.userData.supportEvidence ? {
              bottomVertexCount: anchor.userData.supportEvidence.bottomVertexCount,
              supportedBottomVertexCount:
                anchor.userData.supportEvidence.supportedBottomVertexCount,
              minimumBottomClearance: Number(
                anchor.userData.supportEvidence.minimumBottomClearance.toFixed(4),
              ),
              maximumBottomClearance: Number(
                anchor.userData.supportEvidence.maximumBottomClearance.toFixed(4),
              ),
              minimumWorldX: Number(anchor.userData.supportEvidence.minimumWorldX.toFixed(4)),
              supportRatio: Number(anchor.userData.supportEvidence.supportRatio.toFixed(4)),
            } : null,
          })),
        },
        basaltRubble: {
          profile: basalt.rubble.geometry.userData.profile,
          family: basalt.rubble.geometry.userData.family,
          count: basalt.rubble.count,
          drawCalls: 1,
          distribution: basalt.rubble.userData.distribution,
          sourcePillarCount: basalt.rubble.userData.sourcePillarCount,
          settling: basalt.rubble.userData.settling,
          supportModel: basalt.rubble.userData.supportModel,
          collisionRole: basalt.rubble.userData.collisionRole,
          supportPlane: basalt.rubble.geometry.userData.supportPlane,
          centerOfMassProjection: basalt.rubble.geometry.userData.centerOfMassProjection,
          surface: basalt.rubble.material.userData.surface,
          supportEvidence: {
            placementCount: basalt.rubble.userData.supportEvidence.length,
            supportVertexCount: basalt.rubble.geometry.userData.supportVertexCount,
            supportedPlacementCount: basalt.rubble.userData.supportEvidence.filter((entry) => (
              entry.contactVertexCount === entry.supportVertexCount
            )).length,
            supportRatio: Number((
              basalt.rubble.userData.supportEvidence.filter((entry) => (
                entry.contactVertexCount === entry.supportVertexCount
              )).length / basalt.rubble.userData.supportEvidence.length
            ).toFixed(4)),
            minimumSupportClearance: Number(Math.min(
              ...basalt.rubble.userData.supportEvidence.map(
                ({ minimumSupportClearance }) => minimumSupportClearance,
              ),
            ).toFixed(4)),
            maximumSupportClearance: Number(Math.max(
              ...basalt.rubble.userData.supportEvidence.map(
                ({ maximumSupportClearance }) => maximumSupportClearance,
              ),
            ).toFixed(4)),
            minimumContactVertexCount: Math.min(
              ...basalt.rubble.userData.supportEvidence.map(
                ({ contactVertexCount }) => contactVertexCount,
              ),
            ),
            minimumWorldX: Number(Math.min(
              ...basalt.rubble.userData.supportEvidence.map(({ x }) => x),
            ).toFixed(4)),
            burialRangeMeters: [
              Number(Math.min(
                ...basalt.rubble.userData.supportEvidence.map(({ burial }) => burial),
              ).toFixed(4)),
              Number(Math.max(
                ...basalt.rubble.userData.supportEvidence.map(({ burial }) => burial),
              ).toFixed(4)),
            ],
          },
        },
        fieldCamera: {
          version: HY3D_FIELD_CAMERA_ASSET.version,
          visualStatus: fieldCameraVisualStatus,
          visualError: fieldCameraVisualError,
          loaded: Boolean(fieldCamera.userData.hy3dVisual),
          singleAssetPath: true,
          bytes: HY3D_FIELD_CAMERA_ASSET.bytes,
          triangles: HY3D_FIELD_CAMERA_ASSET.triangles,
          visibleParts: fieldCamera.children.length,
          hands: {
            loaded: Boolean(fieldCamera.userData.hy3dVisual),
            styleVersion: HY3D_FIELD_CAMERA_ASSET.version,
            hands: HY3D_FIELD_CAMERA_ASSET.integratedHands,
            gripRoles: [...HY3D_FIELD_CAMERA_ASSET.gripRoles],
            drawCalls: fieldCamera.userData.hy3dVisual ? 1 : 0,
            integratedWithTool: true,
          },
        },
        rifle: {
          version: HY3D_RIFLE_ASSET.version,
          visualStatus: rifleVisualStatus,
          visualError: rifleVisualError,
          loaded: Boolean(rifle.userData.hy3dVisual),
          singleAssetPath: true,
          bytes: HY3D_RIFLE_ASSET.bytes,
          triangles: HY3D_RIFLE_ASSET.triangles,
          visibleParts: rifle.children.length,
          hands: {
            loaded: Boolean(rifle.userData.hy3dVisual),
            styleVersion: HY3D_RIFLE_ASSET.version,
            hands: HY3D_RIFLE_ASSET.integratedHands,
            gripRoles: [...HY3D_RIFLE_ASSET.gripRoles],
            drawCalls: rifle.userData.hy3dVisual ? 1 : 0,
            integratedWithTool: true,
          },
        },
        pterodactyl: {
          silhouette: pterodactyls[0].userData.silhouette,
          projectedShadow: pterodactylShadow.geometry.userData.profile,
          visibleParts: pterodactyls[0].children.length,
          visualStatus: pterodactylVisualStatus,
          visualError: pterodactylVisualError,
          hy3d: {
            version: HY3D_PTERODACTYL_ASSET.version,
            bytes: HY3D_PTERODACTYL_ASSET.bytes,
            loaded: pterodactyls.filter((pterodactyl) => pterodactyl.userData.hy3dVisual).length,
            sharedResource: true,
            runtimeMorphPose: true,
            poseTargets: ['wingUp', 'wingDown', 'diveFold'],
          },
        },
        cover: {
          profile: coverArches.userData.profile,
          archCount: coverArches.userData.archCount,
          pairCount: coverArches.userData.pairCount,
          treeCount: coverArches.userData.treeCount,
          visibleParts: coverArches.children.length,
          bridgeGeometryCount: coverArches.userData.bridgeGeometryCount,
          loadPath: coverArches.userData.loadPath,
          rootAnchorsPreserved: coverArches.userData.rootAnchorsPreserved,
          collisionRole: coverArches.userData.collisionRole,
          minimumHalfClearance: coverArches.userData.minimumHalfClearance,
          visualStatus: coverCanopyVisualStatus,
          visualError: coverCanopyVisualError,
          loaded: Boolean(riparianCover.assetAnchor.userData.assetVisual?.visible),
          fallbackVisible: riparianCover.assetAnchor.userData.fallbackMeshes.some(
            (mesh) => mesh.visible,
          ),
          assetVersion: CANOPY_TREE_LIBRARY_ASSET.version,
          instanceCount: riparianCover.assetAnchor.userData.assetVisual?.userData.instanceCount ?? 0,
          drawCalls: riparianCover.assetAnchor.userData.assetVisual?.userData.drawCalls ?? 0,
          counts: [
            ...(riparianCover.assetAnchor.userData.assetVisual?.userData.counts ?? []),
          ],
          supportModel: riparianCover.assetAnchor.userData.supportModel,
          supportEvidence: riparianCover.assetAnchor.userData.assetVisual?.userData.supportSummary
            ? { ...riparianCover.assetAnchor.userData.assetVisual.userData.supportSummary }
            : null,
          leafRetention: riparianCover.assetAnchor.userData.assetVisual?.userData.leafRetentionSummary
            ? { ...riparianCover.assetAnchor.userData.assetVisual.userData.leafRetentionSummary }
            : null,
          fallbackBoughs: coverArches.children
            .filter((child) => child.name.startsWith('root-supported-riparian-bough'))
            .map((child) => ({
              name: child.name,
              sourceTreeIndex: child.geometry.userData.sourceTreeIndex,
              sourceSide: child.geometry.userData.sourceSide,
              crossTrunkBridge: child.geometry.userData.crossTrunkBridge,
              maximumHorizontalCantileverMeters:
                child.geometry.userData.maximumHorizontalCantileverMeters,
              loadPath: child.geometry.userData.loadPath,
            })),
        },
        heroGingko: {
          version: HERO_GINGKO_ASSET.version,
          visualStatus: heroGingkoVisualStatus,
          visualError: heroGingkoVisualError,
          loaded: Boolean(heroGingko.userData.assetVisual),
          fallbackVisible: heroGingko.userData.fallback.visible,
          bytes: HERO_GINGKO_ASSET.bytes,
          triangles: HERO_GINGKO_ASSET.triangles,
          drawCalls: HERO_GINGKO_ASSET.drawCalls,
          leafCount: HERO_GINGKO_ASSET.leafCount,
          provenance: HERO_GINGKO_ASSET.provenance,
          supportModel: heroGingko.userData.supportModel,
          supportSnapshot: heroGingko.userData.assetVisual?.userData.supportSnapshot
            ? structuredClone(heroGingko.userData.assetVisual.userData.supportSnapshot)
            : null,
          surfaceProfile: heroGingko.userData.assetVisual?.userData.surfaceProfile
            ? structuredClone(heroGingko.userData.assetVisual.userData.surfaceProfile)
            : null,
          windProfile: heroGingko.userData.assetVisual?.userData.windProfile
            ? structuredClone(heroGingko.userData.assetVisual.userData.windProfile)
            : null,
          windSnapshot: heroGingko.userData.assetVisual?.userData.windSnapshot
            ? structuredClone(heroGingko.userData.assetVisual.userData.windSnapshot)
            : null,
          position: [HERO_GINGKO_LAYOUT.x, HERO_GINGKO_LAYOUT.z],
        },
        family: {
          adults: family.filter((animal) => !animal.userData.young).length,
          young: family.filter((animal) => animal.userData.young).length,
          behaviors: ['graze', 'branch-pull', 'young-play'],
          branchPresent: feedingBranch.parent === scene,
          visualStatus: familyVisualStatus,
          visualError: familyVisualError,
          hy3d: {
            version: HY3D_IGUANODON_ASSET.version,
            bytes: HY3D_IGUANODON_ASSET.bytes,
            loadedAdults: family.filter((animal) => (
              !animal.userData.young && animal.userData.hy3dVisual
            )).length,
            loadedYoung: family.filter((animal) => (
              animal.userData.young && animal.userData.hy3dVisual
            )).length,
            sharedResource: true,
            staticSourceMesh: true,
            runtimeMorphPose: true,
            poseTargets: ['graze', 'reach', 'play', 'tailLeft', 'tailRight', 'juvenile'],
            skin: family[0].userData.hy3dVisual ? (() => {
              const mesh = family[0].userData.hy3dVisual.getObjectByProperty('isMesh', true);
              return {
                ...IGUANODON_SKIN_SURFACE,
                albedoMultiplierLinear: [
                  ...IGUANODON_SKIN_SURFACE.albedoMultiplierLinear,
                ],
                normalScale: [...IGUANODON_SKIN_SURFACE.normalScale],
                normalContinuity: { ...mesh.geometry.userData.normalContinuity },
              };
            })() : null,
          },
          visibleParts: family.reduce((total, animal) => total + animal.children.length, 0)
            + feedingBranch.children.length,
        },
        gladeComposition: {
          sightlineHalfWidth: GLADE_SIGHTLINE_HALF_WIDTH,
          sunLanePresent: gladeSunLane.parent === scene,
          shadowCastingSubjects: family.filter((animal) => (
            animal.children.some((part) => part.castShadow)
          )).length,
          familyWidth: Math.max(...family.map((animal) => animal.userData.baseX))
            - Math.min(...family.map((animal) => animal.userData.baseX)),
        },
        degradableGroundAccents: {
          profile: degradableGroundAccents.userData.profile,
          quality: degradableGroundAccents.userData.quality,
          visible: degradableGroundAccents.visible,
          instanceCount: degradableGroundAccents.userData.instanceCount,
          drawCalls: degradableGroundAccents.userData.drawCalls,
          collisionRole: 'non-solid-visual-accent',
        },
        groundCoverLibrary: {
          version: GROUND_COVER_LIBRARY_ASSET.version,
          visualStatus: groundCoverLibraryVisualStatus,
          visualError: groundCoverLibraryVisualError,
          loaded: Boolean(
            environmentDensity.userData.groundCoverAssetAnchor.userData.assetVisual,
          ),
          fallbackVisible: environmentDensity.userData.groundCoverMeshes.some(
            (mesh) => mesh.visible,
          ),
          bytes: GROUND_COVER_LIBRARY_ASSET.bytes,
          triangles: GROUND_COVER_LIBRARY_ASSET.triangles,
          trianglesByVariant: [...GROUND_COVER_LIBRARY_ASSET.trianglesByVariant],
          drawCalls: GROUND_COVER_LIBRARY_ASSET.drawCalls,
          drawCallsPerVariant: GROUND_COVER_LIBRARY_ASSET.drawCallsPerVariant,
          variantCount: GROUND_COVER_LIBRARY_ASSET.variantCount,
          variantIds: [...GROUND_COVER_LIBRARY_ASSET.variantIds],
          leafCounts: [...GROUND_COVER_LIBRARY_ASSET.leafCounts],
          instanceCount: environmentDensity.userData.groundCoverAssetAnchor
            .userData.assetVisual?.userData.instanceCount ?? 0,
          counts: [
            ...(environmentDensity.userData.groundCoverAssetAnchor
              .userData.assetVisual?.userData.counts ?? []),
          ],
          habitatCounts: {
            ...(environmentDensity.userData.groundCoverAssetAnchor
              .userData.assetVisual?.userData.habitatCounts ?? {}),
          },
          distributionModel: 'brook-moisture-and-slope-priority-with-canopy-shade-rosettes',
          provenance: GROUND_COVER_LIBRARY_ASSET.provenance,
          supportModel: GROUND_COVER_LIBRARY_ASSET.supportModel,
          collisionRole: GROUND_COVER_LIBRARY_ASSET.collisionRole,
          architecture: {
            ...GROUND_COVER_ARCHITECTURE_PROFILE,
            maximumPetioleRadiusMetersByVariant: [
              ...GROUND_COVER_ARCHITECTURE_PROFILE.maximumPetioleRadiusMetersByVariant,
            ],
          },
          material: environmentDensity.userData.groundCoverAssetAnchor
            .userData.assetVisual ? {
              leafSurface: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.leaf.userData.surface,
              energyModel: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.leaf.userData.energyModel,
              albedoProfile: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.leaf.userData.albedoProfile,
              albedo: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.textures.albedo.name,
              roughness: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.textures.roughness.name,
              height: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.textures.height.name,
            } : null,
          windModel: {
            ...GROUND_COVER_WIND_PROFILE,
            direction: [...GROUND_COVER_WIND_PROFILE.direction],
          },
          windState: environmentDensity.userData.groundCoverAssetAnchor
            .userData.assetVisual ? {
              time: Number(environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.windUniforms.time.value.toFixed(3)),
              horizontalStrength: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.windUniforms.strength.value,
              verticalStrength: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.materials.windUniforms.verticalStrength.value,
            } : null,
          shadowDisplacement: GROUND_COVER_WIND_PROFILE.shadowModel,
          supportEvidence: environmentDensity.userData.groundCoverAssetAnchor
            .userData.supportEvidence ? {
              supportVertexCount: environmentDensity.userData.groundCoverAssetAnchor
                .userData.supportEvidence.supportVertexCount,
              supportedVertexCount: environmentDensity.userData.groundCoverAssetAnchor
                .userData.supportEvidence.supportedVertexCount,
              supportRatio: Number(environmentDensity.userData.groundCoverAssetAnchor
                .userData.supportEvidence.supportRatio.toFixed(4)),
              minimumClearance: Number(environmentDensity.userData.groundCoverAssetAnchor
                .userData.supportEvidence.minimumClearance.toFixed(4)),
              maximumClearance: Number(environmentDensity.userData.groundCoverAssetAnchor
                .userData.supportEvidence.maximumClearance.toFixed(4)),
            burialDepth: environmentDensity.userData.groundCoverAssetAnchor
              .userData.supportEvidence.burialDepth,
          } : null,
          dimensionSummary: environmentDensity.userData.groundCoverAssetAnchor
            .userData.assetVisual?.userData.dimensionSummary.map((summary) => ({
              id: summary.id,
              scale: summary.scale,
              maximumDiameterMeters: Number(summary.maximumDiameterMeters.toFixed(4)),
              maxDiameterMeters: summary.maxDiameterMeters,
              maximumHeightMeters: Number(summary.maximumHeightMeters.toFixed(4)),
              maxHeightMeters: summary.maxHeightMeters,
              envelopePassCount: summary.envelopePassCount,
              instanceCount: summary.instanceCount,
            })) ?? [],
          horizontalSettlement: environmentDensity.userData.groundCoverAssetAnchor
            .userData.assetVisual ? {
              relocatedInstances: environmentDensity.userData.groundCoverAssetAnchor
                .userData.assetVisual.userData.supportEvidence.filter(
                  (evidence) => evidence.horizontalSettlement > 0,
                ).length,
              maximumMeters: Number(Math.max(
                ...environmentDensity.userData.groundCoverAssetAnchor
                  .userData.assetVisual.userData.supportEvidence.map(
                    (evidence) => evidence.horizontalSettlement,
                  ),
              ).toFixed(4)),
              model: 'smallest-deterministic-move-from-sharp-break-to-continuous-soil',
            } : null,
        },
        environmentDensity: {
          profile: environmentDensity.userData.profile,
          quality: environmentDensity.userData.quality,
          visible: environmentDensity.visible,
          instanceCount: environmentDensity.userData.instanceCount,
          drawCalls: environmentDensity.userData.drawCalls,
          collisionRole: environmentDensity.userData.collisionRole,
          groundCoverDistribution: environmentDensity.userData.groundCoverDistribution,
          groundCoverClusterCount: environmentDensity.userData.groundCoverClusterCount,
          bryophyteGroundLayer: {
            profile: environmentDensity.userData.bryophyteGroundLayer.userData.profile,
            instanceCount:
              environmentDensity.userData.bryophyteGroundLayer.userData.instanceCount,
            counts: {
              ...environmentDensity.userData.bryophyteGroundLayer.userData.counts,
            },
            variantIds: [...BRYOPHYTE_GROUND_LAYER_PROFILE.variantIds],
            drawCalls: environmentDensity.userData.bryophyteGroundLayer.userData.drawCalls,
            distributionModel:
              environmentDensity.userData.bryophyteGroundLayer.userData.distributionModel,
            supportModel: BRYOPHYTE_GROUND_LAYER_PROFILE.supportModel,
            loadPath: BRYOPHYTE_GROUND_LAYER_PROFILE.loadPath,
            collisionRole:
              environmentDensity.userData.bryophyteGroundLayer.userData.collisionRole,
            energyModel: environmentDensity.userData.bryophyteGroundLayer.userData.energyModel,
            supportEvidence: {
              ...environmentDensity.userData.bryophyteGroundLayer.userData.supportEvidence,
              minimumRootClearance: Number(environmentDensity.userData.bryophyteGroundLayer
                .userData.supportEvidence.minimumRootClearance.toFixed(4)),
              maximumRootClearance: Number(environmentDensity.userData.bryophyteGroundLayer
                .userData.supportEvidence.maximumRootClearance.toFixed(4)),
            },
            geometry: environmentDensity.userData.bryophyteGroundLayer.children.map((mesh) => ({
              variantId: mesh.userData.variantId,
              profile: mesh.geometry.userData.profile,
              closedVolumes: mesh.geometry.userData.closedVolumes,
              rootVertexCount: mesh.geometry.userData.rootVertexCount,
              rootY: mesh.geometry.userData.rootY,
            })),
          },
          forestFloorDetritus: {
            profile: environmentDensity.userData.forestFloorDetritus.userData.profile,
            instanceCount:
              environmentDensity.userData.forestFloorDetritus.userData.instanceCount,
            counts: [
              ...environmentDensity.userData.forestFloorDetritus.userData.counts,
            ],
            drawCalls: environmentDensity.userData.forestFloorDetritus.userData.drawCalls,
            variantIds: [...FOREST_FLOOR_DETRITUS_PROFILE.variantIds],
            sourceRoleCounts: {
              ...environmentDensity.userData.forestFloorDetritus.userData.sourceRoleCounts,
            },
            heroGingkoModel: {
              ...environmentDensity.userData.forestFloorDetritus.userData.heroGingkoModel,
              source: [
                ...environmentDensity.userData.forestFloorDetritus.userData
                  .heroGingkoModel.source,
              ],
              radiusMeters: [
                ...environmentDensity.userData.forestFloorDetritus.userData
                  .heroGingkoModel.radiusMeters,
              ],
              rootAnglesRadians: [
                ...environmentDensity.userData.forestFloorDetritus.userData
                  .heroGingkoModel.rootAnglesRadians,
              ],
            },
            distributionModel:
              environmentDensity.userData.forestFloorDetritus.userData.distributionModel,
            supportModel:
              environmentDensity.userData.forestFloorDetritus.userData.supportModel,
            collisionRole:
              environmentDensity.userData.forestFloorDetritus.userData.collisionRole,
            energyModel: FOREST_FLOOR_DETRITUS_PROFILE.energyModel,
            ecologyRanges: Object.fromEntries([
              'humus',
              'routeWear',
              'wetBank',
              'mineralExposure',
              'slope',
            ].map((field) => {
              const values = environmentDensity.userData.forestFloorDetritus.userData
                .placements.map((placement) => placement[field]);
              return [field, [
                Number(Math.min(...values).toFixed(4)),
                Number(Math.max(...values).toFixed(4)),
              ]];
            })),
            supportEvidence: {
              ...environmentDensity.userData.forestFloorDetritus.userData.supportEvidence,
              minimumClearance: Number(environmentDensity.userData.forestFloorDetritus.userData
                .supportEvidence.minimumClearance.toFixed(4)),
              maximumClearance: Number(environmentDensity.userData.forestFloorDetritus.userData
                .supportEvidence.maximumClearance.toFixed(4)),
            },
          },
          deadfall: {
            instanceCount: SCENE_BUDGET.deadfall,
            supportModel: environmentDensity.userData.deadfallSupportModel,
            supportEvidence: {
              ...environmentDensity.userData.deadfallSupportEvidence,
              minimumClearance: Number(environmentDensity.userData.deadfallSupportEvidence
                .minimumClearance.toFixed(4)),
              maximumClearance: Number(environmentDensity.userData.deadfallSupportEvidence
                .maximumClearance.toFixed(4)),
              maximumTerrainSlope: Number(environmentDensity.userData.deadfallSupportEvidence
                .maximumTerrainSlope.toFixed(4)),
            },
            collisionRole: 'non-solid-visual-accent',
            energyModel: 'opaque-non-emissive-dielectric-weathered-wood',
            material: {
              surface: environmentDensity.userData.deadfallMaterial.userData.surface,
              moistureClass:
                environmentDensity.userData.deadfallMaterial.userData.moistureClass,
              textureChannels: {
                ...environmentDensity.userData.deadfallMaterial.userData.textureChannels,
              },
              flatShading: environmentDensity.userData.deadfallMaterial.flatShading,
              envMapIntensity: environmentDensity.userData.deadfallMaterial.envMapIntensity,
            },
            geometry: environmentDensity.userData.deadfallMeshes.map((mesh) => ({
              variant: mesh.geometry.userData.variant,
              profile: mesh.geometry.userData.profile,
              surface: mesh.geometry.userData.surface,
              triangleCount: mesh.geometry.userData.triangleCount,
              closedSegmentCount: mesh.geometry.userData.closedSegmentCount,
              primaryBranchCount: mesh.geometry.userData.primaryBranchCount,
              splinterCount: mesh.geometry.userData.splinterCount,
              supportPointCount: mesh.geometry.userData.supportPoints.length,
              loadPath: mesh.geometry.userData.loadPath,
            })),
          },
          forestSuccessionProfile: environmentDensity.userData.forestSuccessionProfile,
          forestCollisionModel: environmentDensity.userData.forestCollisionModel,
          forestSuccession: {
            ...environmentDensity.userData.forestSuccession,
            cohortCounts: {
              ...environmentDensity.userData.forestSuccession.cohortCounts,
            },
            ageCounts: {
              ...environmentDensity.userData.forestSuccession.ageCounts,
            },
            crownVariantCounts: [
              ...environmentDensity.userData.forestSuccession.crownVariantCounts,
            ],
            wetnessRange: [
              ...environmentDensity.userData.forestSuccession.wetnessRange,
            ],
          },
          forestEdgeOriginal: {
            visualStatus: forestEdgeCanopyVisualStatus,
            visualError: forestEdgeCanopyVisualError,
            loaded: Boolean(
              environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual,
            ),
            fallbackVisible: environmentDensity.userData.forestEdgeAssetAnchor.userData
              .fallbackMeshes.some((mesh) => mesh.visible),
            instanceCount: environmentDensity.userData.forestEdgeAssetAnchor.userData
              .assetVisual?.userData.instanceCount ?? 0,
            cohortCount: environmentDensity.userData.forestEdgeAssetAnchor.userData.cohortCount,
            ageCounts: {
              ...environmentDensity.userData.forestEdgeAssetAnchor.userData.ageCounts,
            },
            drawCalls: environmentDensity.userData.forestEdgeAssetAnchor.userData
              .assetVisual?.userData.drawCalls ?? 0,
            collisionRole: environmentDensity.userData.forestEdgeAssetAnchor.userData.collisionRole,
            leafRetention: environmentDensity.userData.forestEdgeAssetAnchor.userData
              .assetVisual ? {
                ...environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual
                  .userData.leafRetentionSummary,
                minimumRetention: Number(environmentDensity.userData.forestEdgeAssetAnchor.userData
                  .assetVisual.userData.leafRetentionSummary.minimumRetention.toFixed(4)),
                maximumRetention: Number(environmentDensity.userData.forestEdgeAssetAnchor.userData
                  .assetVisual.userData.leafRetentionSummary.maximumRetention.toFixed(4)),
                meanRetention: Number(environmentDensity.userData.forestEdgeAssetAnchor.userData
                  .assetVisual.userData.leafRetentionSummary.meanRetention.toFixed(4)),
                ageCounts: {
                  ...environmentDensity.userData.forestEdgeAssetAnchor.userData.assetVisual
                    .userData.leafRetentionSummary.ageCounts,
                },
              } : null,
            supportEvidence: environmentDensity.userData.forestEdgeAssetAnchor.userData
              .supportEvidence ? {
                supportVertexCount: environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.supportVertexCount,
                supportedVertexCount: environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.supportedVertexCount,
                supportRatio: Number(environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.supportRatio.toFixed(4)),
                minimumClearance: Number(environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.minimumClearance.toFixed(4)),
                maximumClearance: Number(environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.maximumClearance.toFixed(4)),
                settlementAxis: environmentDensity.userData.forestEdgeAssetAnchor
                  .userData.supportEvidence.settlementAxis,
              } : null,
          },
        },
      };
    },
  };
}
