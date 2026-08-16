import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './config.js';
import { terrainHeight } from './terrain.js';

export const RIDGE_SURFACE_PROFILE = Object.freeze({
  version: 'process-coupled-distant-ridge-surface-v2',
  sourceModel:
    'rendered-height-normal-slope-aspect-drainage-exposed-stone-and-height-fraction-fields',
  broadDetailPeriodMeters: 37,
  fineDetailPeriodMeters: 13,
  microDetailPeriodMeters: 9,
  maximumHumusDarkening: 0.38,
  maximumVegetatedSoilBlend: 0.46,
  maximumSlopeSubstrateBlend: 0.36,
  maximumStoneBlend: 0.45,
  temporalModel: 'stable-world-space-no-camera-or-time-dependent-pattern',
  evidenceBoundary:
    'distant-surface-response-does-not-add-collision-or-claim-surveyed-geology',
});

function createRidge(name, frontZ, depth, baseY, peakRange, color, seed, connectToTerrain = false) {
  const random = seededRandom(seed);
  const segmentsX = 72;
  const segmentsZ = 12;
  const pointsX = segmentsX + 1;
  const vertices = [];
  const colors = [];
  const ridgeDrainage = [];
  const ridgeExposedStone = [];
  const ridgeHeightFraction = [];
  const uvs = [];
  const indices = [];
  const surfaceFields = [];
  const baseColor = new THREE.Color(color).offsetHSL(-0.008, 0.035, -0.075);
  const slopeColor = new THREE.Color(color).offsetHSL(0.002, -0.015, 0.005);
  const crestColor = new THREE.Color(color).offsetHSL(0.009, -0.085, 0.095);
  const drainageColor = new THREE.Color(color).offsetHSL(-0.012, 0.035, -0.11);
  const stoneColor = new THREE.Color(color).offsetHSL(0.015, -0.12, 0.13);
  const crestHeights = [];
  let rollingNoise = random() - 0.5;
  for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
    const x = -220 + (440 * xIndex) / segmentsX;
    rollingNoise = rollingNoise * 0.82 + (random() - 0.5) * 0.34;
    const broadRelief = Math.sin(x * 0.018 + seed * 0.007) * 0.43
      + Math.sin(x * 0.041 - seed * 0.013) * 0.24
      + Math.sin(x * 0.086 + 1.7) * 0.1
      + rollingNoise * 0.44;
    crestHeights.push(THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(peakRange[0], peakRange[1], 0.53 + broadRelief * 0.44),
      peakRange[0],
      peakRange[1],
    ));
  }

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const depthFraction = zIndex / segmentsZ;
    const z = frontZ - depth * depthFraction;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const xFraction = xIndex / segmentsX;
      const x = -220 + 440 * xFraction;
      const crossSlopeWarp = Math.sin(x * 0.032 + seed * 0.011) * 0.045
        * Math.sin(depthFraction * Math.PI);
      const warpedDepth = THREE.MathUtils.clamp(depthFraction + crossSlopeWarp, 0, 1);
      const crossSection = Math.sin(warpedDepth * Math.PI) ** 0.72;
      const shoulderBreak = 0.91
        + Math.sin(x * 0.071 + z * 0.025 + seed * 0.017) * 0.055
        + Math.sin(x * 0.137 - z * 0.019) * 0.025;
      const drainageWave = Math.sin(x * 0.052 + z * 0.011 + seed * 0.021) * 0.66
        + Math.sin(x * 0.113 - z * 0.018 - seed * 0.009) * 0.34;
      const drainage = (THREE.MathUtils.clamp(drainageWave * 0.5 + 0.5, 0, 1) ** 9)
        * crossSection
        * THREE.MathUtils.lerp(1.15, 2.75, 1 - Math.abs(depthFraction - 0.5) * 2);
      const erosion = (
        Math.sin(x * 0.19 + z * 0.057 + seed * 0.031) * 0.36
        + Math.sin(x * 0.087 - z * 0.091 + 2.4) * 0.24
      ) * crossSection;
      const crestHeight = crestHeights[xIndex];
      const terrainConnection = connectToTerrain
        ? 1 - THREE.MathUtils.smoothstep(Math.abs(x), 82, 108)
        : 0;
      const frontHeight = THREE.MathUtils.lerp(
        baseY,
        terrainHeight(x, frontZ) - 0.04,
        terrainConnection,
      );
      const slopeBaseline = THREE.MathUtils.lerp(frontHeight, baseY, depthFraction);
      const y = slopeBaseline
        + (crestHeight - slopeBaseline) * crossSection * shoulderBreak
        - drainage
        + erosion;
      vertices.push(x, y, z);
      uvs.push(xFraction, depthFraction);

      const heightFraction = THREE.MathUtils.clamp((y - baseY) / (peakRange[1] - baseY), 0, 1);
      const drainageWeight = THREE.MathUtils.clamp(drainage / 2.75, 0, 1);
      const exposedStone = THREE.MathUtils.smoothstep(heightFraction, 0.52, 0.9)
        * THREE.MathUtils.clamp(
          Math.sin(x * 0.116 - z * 0.074 + seed * 0.019) * 0.5 + 0.5,
          0,
          1,
        ) ** 5;
      surfaceFields.push({
        drainageWeight,
        exposedStone,
        heightFraction,
      });
      ridgeDrainage.push(drainageWeight);
      ridgeExposedStone.push(exposedStone);
      ridgeHeightFraction.push(heightFraction);
      const vertexColor = baseColor.clone()
        .lerp(slopeColor, THREE.MathUtils.smoothstep(heightFraction, 0.08, 0.52))
        .lerp(crestColor, THREE.MathUtils.smoothstep(heightFraction, 0.58, 0.98))
        .lerp(drainageColor, drainageWeight * 0.58)
        .lerp(stoneColor, exposedStone * 0.3);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);

      if (xIndex < segmentsX && zIndex < segmentsZ) {
        const offset = zIndex * pointsX + xIndex;
        const nextRow = offset + pointsX;
        indices.push(offset, offset + 1, nextRow, offset + 1, nextRow + 1, nextRow);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('ridgeDrainage', new THREE.Float32BufferAttribute(ridgeDrainage, 1));
  geometry.setAttribute(
    'ridgeExposedStone',
    new THREE.Float32BufferAttribute(ridgeExposedStone, 1),
  );
  geometry.setAttribute(
    'ridgeHeightFraction',
    new THREE.Float32BufferAttribute(ridgeHeightFraction, 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = 'world-space-eroded-ridge-heightfield';
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    fog: true,
    side: THREE.FrontSide,
    dithering: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute float ridgeDrainage;
        attribute float ridgeExposedStone;
        attribute float ridgeHeightFraction;
        varying float vRidgeDrainage;
        varying float vRidgeExposedStone;
        varying float vRidgeHeightFraction;
        varying vec3 vRidgeLocalPosition;
        varying vec3 vRidgeLocalNormal;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vRidgeDrainage = ridgeDrainage;
        vRidgeExposedStone = ridgeExposedStone;
        vRidgeHeightFraction = ridgeHeightFraction;
        vRidgeLocalPosition = position;
        vRidgeLocalNormal = normal;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vRidgeDrainage;
        varying float vRidgeExposedStone;
        varying float vRidgeHeightFraction;
        varying vec3 vRidgeLocalPosition;
        varying vec3 vRidgeLocalNormal;
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float ridgeBroadDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.broadDetailPeriodMeters.toFixed(1)}
            + vRidgeLocalPosition.z / 53.0) * 6.2831853
        ) * 0.58 + sin(
          (vRidgeLocalPosition.x / 61.0
            - vRidgeLocalPosition.z / ${RIDGE_SURFACE_PROFILE.broadDetailPeriodMeters.toFixed(1)})
            * 6.2831853 + 1.7
        ) * 0.42;
        float ridgeFineDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.fineDetailPeriodMeters.toFixed(1)}
            - vRidgeLocalPosition.z / 17.0) * 6.2831853
        ) * 0.54 + sin(
          (vRidgeLocalPosition.x / 23.0 + vRidgeLocalPosition.z / 11.0)
            * 6.2831853 - 0.9
        ) * 0.46;
        float ridgeMicroDetail = sin(
          (vRidgeLocalPosition.x / ${RIDGE_SURFACE_PROFILE.microDetailPeriodMeters.toFixed(1)}
            + vRidgeLocalPosition.z / 12.0) * 6.2831853 + 0.43
        ) * 0.57 + sin(
          (vRidgeLocalPosition.x / 15.0 - vRidgeLocalPosition.z / 8.0)
            * 6.2831853 - 1.13
        ) * 0.43;
        vec3 ridgeNormal = normalize(vRidgeLocalNormal);
        float ridgeSlope = smoothstep(0.08, 0.68, 1.0 - abs(ridgeNormal.y));
        float ridgeAspect = clamp(
          dot(normalize(ridgeNormal.xz + vec2(0.0001)), normalize(vec2(-0.44, 0.71)))
            * 0.5 + 0.5,
          0.0,
          1.0
        );
        float ridgeHumus = (0.24 + vRidgeDrainage * 0.76)
          * smoothstep(-0.42, 0.46, ridgeBroadDetail)
          * (1.0 - ridgeSlope * 0.58)
          * (1.0 - vRidgeExposedStone);
        float ridgeVegetatedSoil = smoothstep(0.08, 0.3, vRidgeHeightFraction)
          * (1.0 - smoothstep(0.7, 0.94, vRidgeHeightFraction))
          * (1.0 - ridgeSlope * 0.72)
          * (1.0 - vRidgeExposedStone)
          * smoothstep(-0.68, 0.38, ridgeBroadDetail + vRidgeDrainage * 0.42);
        float ridgeSlopeSubstrate = ridgeSlope
          * (1.0 - vRidgeDrainage * 0.78)
          * smoothstep(0.12, 0.78, vRidgeHeightFraction)
          * smoothstep(-0.62, 0.54, ridgeFineDetail + ridgeMicroDetail * 0.3);
        float ridgeStone = vRidgeExposedStone
          * smoothstep(-0.46, 0.5, ridgeFineDetail + ridgeMicroDetail * 0.24)
          * smoothstep(0.42, 0.92, vRidgeHeightFraction);
        diffuseColor.rgb *= mix(
          vec3(1.0),
          vec3(0.62, 0.73, 0.58),
          ridgeHumus * ${RIDGE_SURFACE_PROFILE.maximumHumusDarkening.toFixed(2)}
        );
        float ridgeSurfaceLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 ridgeVegetatedSoilColour = vec3(
          ridgeSurfaceLuma * 0.79,
          ridgeSurfaceLuma * 0.87,
          ridgeSurfaceLuma * 0.67
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          ridgeVegetatedSoilColour,
          ridgeVegetatedSoil * ${RIDGE_SURFACE_PROFILE.maximumVegetatedSoilBlend.toFixed(2)}
        );
        vec3 ridgeSlopeSubstrateColour = vec3(
          ridgeSurfaceLuma * mix(1.06, 1.15, ridgeAspect),
          ridgeSurfaceLuma * mix(0.96, 1.02, ridgeAspect),
          ridgeSurfaceLuma * mix(0.78, 0.87, ridgeAspect)
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          ridgeSlopeSubstrateColour,
          ridgeSlopeSubstrate * ${RIDGE_SURFACE_PROFILE.maximumSlopeSubstrateBlend.toFixed(2)}
        );
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          vec3(ridgeSurfaceLuma * 1.08, ridgeSurfaceLuma * 1.02, ridgeSurfaceLuma * 0.92),
          ridgeStone * ${RIDGE_SURFACE_PROFILE.maximumStoneBlend.toFixed(2)}
        );
      `);
  };
  material.customProgramCacheKey = () => RIDGE_SURFACE_PROFILE.version;
  const ridge = new THREE.Mesh(geometry, material);
  ridge.name = name;
  ridge.userData.profile = 'lit-eroded-terrain-ridge-volume';
  ridge.userData.baseY = baseY;
  ridge.castShadow = false;
  ridge.receiveShadow = false;
  const forest = createRidgeForest({
    ridgeName: name,
    geometry,
    surfaceFields,
    segmentsX,
    segmentsZ,
    seed: seed + 3001,
    baseY,
    isNearRidge: connectToTerrain,
  });
  ridge.add(forest);
  ridge.userData.forest = Object.freeze({
    ...forest.userData.summary,
    ridgeSurface: RIDGE_SURFACE_PROFILE,
  });
  return ridge;
}

function normalizedCrownGeometry(profile) {
  const markClosedComponent = (source, lobe, branch = 0) => {
    const crown = source.index ? source.toNonIndexed() : source;
    if (crown !== source) source.dispose();
    crown.setAttribute(
      'ridgeCrownLobe',
      new THREE.Float32BufferAttribute(
        Float32Array.from({ length: crown.attributes.position.count }, () => lobe),
        1,
      ),
    );
    crown.setAttribute(
      'ridgeCrownBranch',
      new THREE.Float32BufferAttribute(
        Float32Array.from({ length: crown.attributes.position.count }, () => branch),
        1,
      ),
    );
    crown.computeVertexNormals();
    return crown;
  };
  const createBranch = (start, end, lobe, bottomRadius, topRadius) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    const branch = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 5, 1, false);
    branch.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      ),
    );
    branch.translate(
      (start.x + end.x) * 0.5,
      (start.y + end.y) * 0.5,
      (start.z + end.z) * 0.5,
    );
    return markClosedComponent(branch, lobe, 1);
  };
  const sourceGeometries = profile === 'broad'
    ? (() => {
      const foliageLayouts = [
        [0, 0, 0.25, 0, 0.42, 0.24, 0.35, 1],
        [1, -0.03, 0.52, 0.02, 0.37, 0.22, 0.32, 1],
        [2, 0.03, 0.78, 0, 0.26, 0.21, 0.23, 0],
        [3, -0.46, 0.4, 0.1, 0.3, 0.16, 0.25, 0],
        [4, -0.64, 0.52, -0.07, 0.25, 0.14, 0.21, 0],
        [5, 0.47, 0.43, -0.1, 0.31, 0.17, 0.26, 0],
        [6, 0.65, 0.56, 0.08, 0.25, 0.14, 0.21, 0],
        [7, -0.32, 0.65, 0.2, 0.25, 0.15, 0.22, 0],
        [8, 0.33, 0.68, -0.18, 0.26, 0.15, 0.22, 0],
        [9, -0.05, 0.53, 0.37, 0.26, 0.15, 0.21, 0],
        [10, 0.08, 0.57, -0.37, 0.25, 0.15, 0.21, 0],
      ];
      const foliage = foliageLayouts.map(
        ([lobe, x, y, z, scaleX, scaleY, scaleZ, detail]) => {
          const cohort = new THREE.IcosahedronGeometry(1, detail);
          cohort.scale(scaleX, scaleY, scaleZ);
          cohort.translate(x, y, z);
          return markClosedComponent(cohort, lobe);
        },
      );
      const branchLayouts = [
        [[0, 0.02, 0], [0.03, 0.78, 0], 2, 0.058, 0.03],
        [[0, 0.12, 0], [-0.46, 0.4, 0.1], 3, 0.056, 0.027],
        [[-0.38, 0.36, 0.08], [-0.64, 0.52, -0.07], 4, 0.032, 0.018],
        [[0, 0.13, 0], [0.47, 0.43, -0.1], 5, 0.057, 0.028],
        [[0.4, 0.39, -0.08], [0.65, 0.56, 0.08], 6, 0.032, 0.018],
        [[-0.02, 0.33, 0.02], [-0.32, 0.65, 0.2], 7, 0.044, 0.022],
        [[0.01, 0.35, 0], [0.33, 0.68, -0.18], 8, 0.043, 0.021],
        [[0, 0.3, 0.03], [-0.05, 0.53, 0.37], 9, 0.04, 0.02],
        [[0, 0.31, -0.03], [0.08, 0.57, -0.37], 10, 0.04, 0.02],
      ];
      const branches = branchLayouts.map(
        ([start, end, lobe, bottomRadius, topRadius]) => createBranch(
          new THREE.Vector3(...start),
          new THREE.Vector3(...end),
          lobe,
          bottomRadius,
          topRadius,
        ),
      );
      return [...foliage, ...branches];
    })()
    : (() => {
      const whorlLayouts = [
        [0, 0, 0.2, 0, 0.66, 0.18, 0.66],
        [1, -0.03, 0.4, 0.02, 0.52, 0.17, 0.52],
        [2, 0.03, 0.6, -0.02, 0.38, 0.17, 0.38],
        [3, 0, 0.8, 0, 0.23, 0.18, 0.23],
      ];
      const whorls = whorlLayouts.map(([lobe, x, y, z, scaleX, scaleY, scaleZ]) => {
        const whorl = new THREE.LatheGeometry([
          new THREE.Vector2(0, -1),
          new THREE.Vector2(0.95, -0.82),
          new THREE.Vector2(0.78, -0.48),
          new THREE.Vector2(0.52, 0.1),
          new THREE.Vector2(0.18, 0.78),
          new THREE.Vector2(0, 1),
        ], 12, 0, Math.PI * 2);
        whorl.scale(scaleX, scaleY, scaleZ);
        whorl.translate(x, y, z);
        return markClosedComponent(whorl, lobe);
      });
      const leader = createBranch(
        new THREE.Vector3(0, 0.015, 0),
        new THREE.Vector3(0, 0.96, 0),
        3,
        0.05,
        0.018,
      );
      return [...whorls, leader];
    })();
  const mergedGeometry = mergeGeometries(sourceGeometries, false);
  for (const source of sourceGeometries) source.dispose();
  if (!mergedGeometry) throw new Error(`Unable to build ${profile} ridge crown geometry`);
  mergedGeometry.deleteAttribute('normal');
  mergedGeometry.deleteAttribute('uv');
  const geometry = mergeVertices(mergedGeometry, 1e-5);
  mergedGeometry.dispose();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const centreX = (bounds.min.x + bounds.max.x) * 0.5;
  const centreZ = (bounds.min.z + bounds.max.z) * 0.5;
  const widthX = Math.max(0.001, bounds.max.x - bounds.min.x);
  const widthZ = Math.max(0.001, bounds.max.z - bounds.min.z);
  const height = Math.max(0.001, bounds.max.y - bounds.min.y);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedY = (positions.getY(index) - bounds.min.y) / height;
    const normalizedX = ((positions.getX(index) - centreX) * 2) / widthX;
    const normalizedZ = ((positions.getZ(index) - centreZ) * 2) / widthZ;
    const angle = Math.atan2(normalizedZ, normalizedX);
    const irregularity = 1
      + Math.sin(angle * (profile === 'broad' ? 5 : 7) + normalizedY * 4.1) * 0.045;
    positions.setXYZ(
      index,
      normalizedX * irregularity,
      normalizedY,
      normalizedZ * irregularity,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const colours = [];
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedY = THREE.MathUtils.clamp(positions.getY(index), 0, 1);
    const directionalBreakup = Math.sin(
      positions.getX(index) * 4.7 + positions.getZ(index) * 3.9 + normalizedY * 2.1,
    ) * 0.025;
    const exposure = THREE.MathUtils.clamp(
      (profile === 'broad' ? 0.72 : 0.68) + normalizedY * 0.27 + directionalBreakup,
      0.62,
      1,
    );
    colours.push(exposure, exposure, exposure);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.profile = profile === 'broad'
    ? 'closed-branch-supported-eleven-leaf-cohort-broad-crown-v4'
    : 'closed-leader-supported-four-whorl-narrow-distant-crown-v4';
  geometry.userData.closedVolume = true;
  geometry.userData.closedComponentCount = profile === 'broad' ? 20 : 5;
  geometry.userData.foliageCohortCount = profile === 'broad' ? 11 : 4;
  geometry.userData.structuralBranchComponentCount = profile === 'broad' ? 9 : 1;
  geometry.userData.componentOverlap = profile === 'broad'
    ? 'nine-tapered-forks-overlap-trunk-or-parent-cohort-and-eleven-closed-leaf-cohorts'
    : 'one-closed-tapered-leader-overlaps-trunk-and-four-closed-whorl-cohorts';
  geometry.userData.surfaceModel = 'branch-supported-cohorts-with-age-asymmetry-and-damage';
  geometry.userData.triangleCount = geometry.index.count / 3;
  return geometry;
}

function applyRidgeCrownVariation(material, crownProfile) {
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute vec4 ridgeCrownVariation;
        attribute float ridgeCrownLobe;
        attribute float ridgeCrownBranch;
        varying float vRidgeCrownBranch;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 ridgeCrownUndeformed = transformed;
        vRidgeCrownBranch = ridgeCrownBranch;
        float ridgeCrownHeight = clamp(transformed.y, 0.0, 1.0);
        float ridgeCrownArchitecture = ridgeCrownVariation.x;
        float ridgeCrownPhase = ridgeCrownVariation.y * 6.2831853;
        float ridgeCrownAsymmetry = ridgeCrownVariation.z;
        float ridgeCrownDamage = ridgeCrownVariation.w;
        float ridgeCrownAngle = atan(transformed.z, transformed.x);
        float ridgeCrownTier = sin(
          ridgeCrownHeight * mix(2.2, 3.65, ridgeCrownArchitecture) * 6.2831853
            + ridgeCrownPhase + ridgeCrownLobe * 0.71
        );
        float ridgeCrownEdge = sin(
          ridgeCrownAngle * mix(4.0, 6.8, ridgeCrownArchitecture)
            + ridgeCrownPhase * 1.37 + ridgeCrownLobe * 1.91
        ) * 0.058 + sin(
          ridgeCrownAngle * 9.0 - ridgeCrownPhase * 0.83
            + ridgeCrownHeight * 5.1
        ) * 0.028;
        float ridgeCrownRadial = 1.0
          + ridgeCrownTier * mix(0.018, 0.055, ridgeCrownArchitecture)
          + ridgeCrownEdge * mix(0.58, 1.0, ridgeCrownAsymmetry);
        float ridgeCrownDamageDirection = ridgeCrownPhase * 1.73 + 0.8;
        float ridgeCrownDamageSector = pow(max(cos(
          ridgeCrownAngle - ridgeCrownDamageDirection
        ), 0.0), 8.0) * smoothstep(0.24, 0.92, ridgeCrownHeight);
        ridgeCrownRadial *= 1.0 - ridgeCrownDamageSector * ridgeCrownDamage * 0.19;
        transformed.xz *= ridgeCrownRadial;
        float ridgeCrownLean = smoothstep(0.12, 0.94, ridgeCrownHeight)
          * ridgeCrownAsymmetry * mix(0.025, 0.1, ridgeCrownArchitecture);
        transformed.x += cos(ridgeCrownPhase) * ridgeCrownLean;
        transformed.z += sin(ridgeCrownPhase) * ridgeCrownLean;
        ${crownProfile === 'broad' ? `
          float ridgeCrownLobePhase = ridgeCrownPhase + ridgeCrownLobe * 1.47;
          float ridgeCrownLobeWeight = step(0.5, ridgeCrownLobe);
          transformed.x += cos(ridgeCrownLobePhase) * ridgeCrownLobeWeight
            * ridgeCrownAsymmetry * 0.045;
          transformed.z += sin(ridgeCrownLobePhase) * ridgeCrownLobeWeight
            * ridgeCrownAsymmetry * 0.045;
          float ridgeCrownMaturityBreadth = 0.84
            + sin(ridgeCrownArchitecture * 3.14159265) * 0.19;
          transformed.xz *= ridgeCrownMaturityBreadth;
        ` : `
          transformed.xz *= mix(
            vec2(1.0),
            vec2(0.82 + ridgeCrownAsymmetry * 0.18, 1.08),
            ridgeCrownArchitecture * 0.24
          );
        `}
        transformed = mix(transformed, ridgeCrownUndeformed, ridgeCrownBranch);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying float vRidgeCrownBranch;
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          vec3(0.075, 0.052, 0.032),
          vRidgeCrownBranch
        );
      `);
  };
  material.customProgramCacheKey = () => (
    `${previousProgramCacheKey()}|ridge-crown-architecture-v4-${crownProfile}`
  );
}

function triangleSurfaceSample(attribute, pointsX, xIndex, zIndex, u, v, target) {
  const lowerLeft = zIndex * pointsX + xIndex;
  const lowerRight = lowerLeft + 1;
  const upperLeft = lowerLeft + pointsX;
  const upperRight = upperLeft + 1;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  if (u + v <= 1) {
    a.fromBufferAttribute(attribute, lowerLeft);
    b.fromBufferAttribute(attribute, lowerRight);
    c.fromBufferAttribute(attribute, upperLeft);
    return target.copy(a)
      .addScaledVector(b.clone().sub(a), u)
      .addScaledVector(c.clone().sub(a), v);
  }
  a.fromBufferAttribute(attribute, upperRight);
  b.fromBufferAttribute(attribute, upperLeft);
  c.fromBufferAttribute(attribute, lowerRight);
  return target.copy(a)
    .addScaledVector(b.clone().sub(a), 1 - u)
    .addScaledVector(c.clone().sub(a), 1 - v);
}

function triangleSurfaceField(fields, pointsX, xIndex, zIndex, u, v, key) {
  const lowerLeft = zIndex * pointsX + xIndex;
  const lowerRight = lowerLeft + 1;
  const upperLeft = lowerLeft + pointsX;
  const upperRight = upperLeft + 1;
  if (u + v <= 1) {
    return fields[lowerLeft][key]
      + (fields[lowerRight][key] - fields[lowerLeft][key]) * u
      + (fields[upperLeft][key] - fields[lowerLeft][key]) * v;
  }
  return fields[upperRight][key]
    + (fields[upperLeft][key] - fields[upperRight][key]) * (1 - u)
    + (fields[lowerRight][key] - fields[upperRight][key]) * (1 - v);
}

function createRidgeForest({
  ridgeName,
  geometry,
  surfaceFields,
  segmentsX,
  segmentsZ,
  seed,
  baseY,
  isNearRidge,
}) {
  const random = seededRandom(seed);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const pointsX = segmentsX + 1;
  const placements = [];
  const understoryPlacements = [];
  const sampledPosition = new THREE.Vector3();
  const sampledNormal = new THREE.Vector3();

  for (let zIndex = 1; zIndex < segmentsZ - 1; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      for (let surfaceSample = 0; surfaceSample < 2; surfaceSample += 1) {
      const u = surfaceSample === 0
        ? 0.08 + random() * 0.36
        : 0.56 + random() * 0.36;
      const v = surfaceSample === 0
        ? 0.1 + random() * 0.34
        : 0.54 + random() * 0.38;
      triangleSurfaceSample(positions, pointsX, xIndex, zIndex, u, v, sampledPosition);
      triangleSurfaceSample(normals, pointsX, xIndex, zIndex, u, v, sampledNormal).normalize();
      const drainageWeight = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'drainageWeight',
      );
      const exposedStone = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'exposedStone',
      );
      const heightFraction = triangleSurfaceField(
        surfaceFields,
        pointsX,
        xIndex,
        zIndex,
        u,
        v,
        'heightFraction',
      );
      if (sampledPosition.y <= baseY + 2.6 || sampledNormal.y < 0.58 || exposedStone > 0.6) {
        continue;
      }

      const slopeSuitability = THREE.MathUtils.smoothstep(sampledNormal.y, 0.58, 0.96);
      const moistureSuitability = THREE.MathUtils.clamp(
        0.42 + drainageWeight * 0.38 + (1 - heightFraction) * 0.2,
        0,
        1,
      );
      const exposureRetention = 1 - exposedStone * 0.88;
      const establishmentChance = (isNearRidge ? 0.68 : 0.63)
        * THREE.MathUtils.lerp(0.58, 1, slopeSuitability)
        * THREE.MathUtils.lerp(0.7, 1.08, moistureSuitability)
        * exposureRetention;
      if (random() > establishmentChance) {
        const understoryChance = (isNearRidge ? 0.48 : 0.42)
          * THREE.MathUtils.lerp(0.58, 1.08, moistureSuitability)
          * THREE.MathUtils.lerp(0.62, 1, slopeSuitability)
          * (1 - exposedStone * 0.94);
        if (exposedStone <= 0.46 && random() <= understoryChance) {
          const understoryHeight = THREE.MathUtils.lerp(
            isNearRidge ? 1.6 : 1.35,
            isNearRidge ? 3.4 : 2.85,
            random() ** 0.78,
          ) * THREE.MathUtils.lerp(0.86, 1.08, moistureSuitability);
          understoryPlacements.push({
            x: sampledPosition.x,
            y: sampledPosition.y,
            z: sampledPosition.z,
            broad: true,
            understory: true,
            crownHeight: understoryHeight,
            crownRadius: understoryHeight * THREE.MathUtils.lerp(0.52, 0.76, random()),
            yaw: random() * Math.PI * 2,
            shade: THREE.MathUtils.lerp(0.72, 0.91, random())
              * THREE.MathUtils.lerp(0.92, 1.06, moistureSuitability),
            slopeY: sampledNormal.y,
            drainageWeight,
            exposedStone,
            heightFraction,
          });
        }
        continue;
      }

      const broad = random() < THREE.MathUtils.lerp(0.42, 0.68, moistureSuitability);
      const height = THREE.MathUtils.lerp(
        isNearRidge ? 3.6 : 3,
        isNearRidge ? 9.4 : 8.2,
        random() ** 0.85,
      ) * THREE.MathUtils.lerp(0.82, 1.08, moistureSuitability);
      const trunkHeight = height * (broad
        ? THREE.MathUtils.lerp(0.39, 0.5, random())
        : THREE.MathUtils.lerp(0.43, 0.54, random()));
      const crownHeight = height * (broad ? 0.66 : 0.78);
      const crownRadius = height * (broad
        ? THREE.MathUtils.lerp(0.3, 0.4, random())
        : THREE.MathUtils.lerp(0.2, 0.29, random()));
      const trunkRadius = height * THREE.MathUtils.lerp(0.025, 0.04, random());
      placements.push({
        x: sampledPosition.x,
        y: sampledPosition.y,
        z: sampledPosition.z,
        broad,
        height,
        trunkHeight,
        trunkRadius,
        crownHeight,
        crownRadius,
        crownOverlap: crownHeight * (broad ? 0.16 : 0.2),
        yaw: random() * Math.PI * 2,
        shade: THREE.MathUtils.lerp(0.84, 1.08, random()),
        slopeY: sampledNormal.y,
        drainageWeight,
        exposedStone,
        heightFraction,
      });
      }
    }
  }

  const variationHash = (placement, salt) => {
    const value = Math.sin(
      placement.x * 12.9898 + placement.z * 78.233 + seed * 0.001 + salt * 19.19,
    ) * 43758.5453;
    return value - Math.floor(value);
  };
  const allCrownPlacements = [...placements, ...understoryPlacements];
  allCrownPlacements.forEach((placement, index) => {
    const heightSignal = placement.understory
      ? THREE.MathUtils.clamp((placement.crownHeight - 1.35) / 2.05, 0, 1) * 0.24
      : THREE.MathUtils.clamp((placement.height - 3.6) / 5.0, 0, 1);
    const architecture = placement.understory
      ? 0.08 + variationHash(placement, index + 3) * 0.18
      : THREE.MathUtils.clamp(
        heightSignal * 0.68 + variationHash(placement, index + 7) * 0.32,
        0,
        1,
      );
    const asymmetry = THREE.MathUtils.clamp(
      0.14 + variationHash(placement, index + 13) * 0.48
        + placement.exposedStone * 0.28
        + (1 - placement.slopeY) * 0.22,
      0.12,
      0.92,
    );
    const damage = THREE.MathUtils.clamp(
      variationHash(placement, index + 29) * 0.28
        + placement.exposedStone * 0.62
        + placement.heightFraction * 0.18,
      0,
      0.86,
    );
    placement.crownArchitecture = architecture < 0.34
      ? 'juvenile-pioneer'
      : architecture < 0.7
        ? 'layered-mature'
        : 'weathered-emergent';
    placement.crownVariation = [
      architecture,
      variationHash(placement, index + 41),
      asymmetry,
      damage,
    ];
  });

  const group = new THREE.Group();
  group.name = `${ridgeName}.vegetation`;
  const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.68, 1, 6, 1, false);
  trunkGeometry.translate(0, 0.5, 0);
  trunkGeometry.computeBoundingBox();
  trunkGeometry.computeBoundingSphere();
  trunkGeometry.userData.profile = 'closed-low-poly-distant-trunk';
  const broadCrownGeometry = normalizedCrownGeometry('broad');
  const narrowCrownGeometry = normalizedCrownGeometry('narrow');
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d2a22,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
  const broadCrownMaterial = new THREE.MeshStandardMaterial({
    color: isNearRidge ? 0x173c2b : 0x29463d,
    roughness: 0.93,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
    fog: true,
  });
  const narrowCrownMaterial = new THREE.MeshStandardMaterial({
    color: isNearRidge ? 0x15372a : 0x253f38,
    roughness: 0.95,
    metalness: 0,
    flatShading: false,
    vertexColors: true,
    fog: true,
  });
  for (const material of [trunkMaterial, broadCrownMaterial, narrowCrownMaterial]) {
    material.userData.energyModel = 'opaque-dielectric-direct-and-environment-light-response';
  }

  const broadPlacements = placements.filter((placement) => placement.broad);
  const narrowPlacements = placements.filter((placement) => !placement.broad);
  const broadCrownPlacements = [...broadPlacements, ...understoryPlacements];
  const addCrownVariationAttribute = (crownGeometry, list) => {
    crownGeometry.setAttribute(
      'ridgeCrownVariation',
      new THREE.InstancedBufferAttribute(
        Float32Array.from(list.flatMap((placement) => placement.crownVariation)),
        4,
      ),
    );
  };
  addCrownVariationAttribute(broadCrownGeometry, broadCrownPlacements);
  addCrownVariationAttribute(narrowCrownGeometry, narrowPlacements);
  applyRidgeCrownVariation(broadCrownMaterial, 'broad');
  applyRidgeCrownVariation(narrowCrownMaterial, 'narrow');
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length);
  const broadCrowns = new THREE.InstancedMesh(
    broadCrownGeometry,
    broadCrownMaterial,
    broadCrownPlacements.length,
  );
  const narrowCrowns = new THREE.InstancedMesh(
    narrowCrownGeometry,
    narrowCrownMaterial,
    narrowPlacements.length,
  );
  trunks.name = `${ridgeName}.vegetation.trunks`;
  broadCrowns.name = `${ridgeName}.vegetation.broad-crowns`;
  narrowCrowns.name = `${ridgeName}.vegetation.narrow-crowns`;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, placement.y - 0.06, placement.z);
    dummy.rotation.set(0, placement.yaw, 0);
    dummy.scale.set(
      placement.trunkRadius * 2,
      placement.trunkHeight + 0.06,
      placement.trunkRadius * 2,
    );
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    tint.setScalar(placement.shade);
    trunks.setColorAt(index, tint);
  });
  const placeCrowns = (mesh, list) => {
    list.forEach((placement, index) => {
      dummy.position.set(
        placement.x,
        placement.understory
          ? placement.y - 0.045
          : placement.y + placement.trunkHeight - placement.crownOverlap,
        placement.z,
      );
      dummy.rotation.set(0, placement.yaw, 0);
      dummy.scale.set(placement.crownRadius, placement.crownHeight, placement.crownRadius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      tint.setRGB(
        placement.shade * (0.965 - placement.exposedStone * 0.025),
        placement.shade * (0.985 + placement.drainageWeight * 0.028),
        placement.shade * (0.95 + (1 - placement.heightFraction) * 0.025),
      );
      mesh.setColorAt(index, tint);
    });
  };
  placeCrowns(broadCrowns, broadCrownPlacements);
  placeCrowns(narrowCrowns, narrowPlacements);
  for (const mesh of [trunks, broadCrowns, narrowCrowns]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.userData.collisionRole = 'non-solid-distant-background-vegetation';
    group.add(mesh);
  }

  const summary = Object.freeze({
    profile: 'terrain-cohort-and-understory-sourced-ridge-forest-v5',
    ridge: ridgeName,
    instanceCount: placements.length,
    broadCrownCount: broadPlacements.length,
    narrowCrownCount: narrowPlacements.length,
    understoryCrownCount: understoryPlacements.length,
    totalCrownCount: broadCrownPlacements.length + narrowPlacements.length,
    drawCalls: 3,
    samplesPerSurfaceCell: 2,
    crownArchitectureCounts: Object.freeze(Object.fromEntries([
      'juvenile-pioneer',
      'layered-mature',
      'weathered-emergent',
    ].map((architecture) => [
      architecture,
      allCrownPlacements.filter(
        (placement) => placement.crownArchitecture === architecture,
      ).length,
    ]))),
    sourceDamagedCrownCount: allCrownPlacements.filter(
      (placement) => placement.crownVariation[3] >= 0.5,
    ).length,
    crownVariationAttribute: 'ridgeCrownVariation',
    broadCrownComponentCount: broadCrownGeometry.userData.closedComponentCount,
    broadCrownFoliageCohortCount: broadCrownGeometry.userData.foliageCohortCount,
    broadCrownStructuralBranchCount:
      broadCrownGeometry.userData.structuralBranchComponentCount,
    broadCrownTriangleCount: broadCrownGeometry.userData.triangleCount,
    narrowCrownComponentCount: narrowCrownGeometry.userData.closedComponentCount,
    narrowCrownFoliageCohortCount: narrowCrownGeometry.userData.foliageCohortCount,
    narrowCrownStructuralBranchCount:
      narrowCrownGeometry.userData.structuralBranchComponentCount,
    narrowCrownTriangleCount: narrowCrownGeometry.userData.triangleCount,
    sourceModel:
      'ridge-slope-drainage-height-and-exposed-stone-tree-plus-gap-understory-establishment',
    supportEvidence: Object.freeze({
      rootCount: placements.length,
      supportedRootCount: placements.length,
      supportRatio: placements.length > 0 ? 1 : 0,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.06,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    }),
    crownAttachment: 'closed-crown-base-overlaps-load-bearing-trunk-top',
    understorySupport: Object.freeze({
      rootCount: understoryPlacements.length,
      supportedRootCount: understoryPlacements.length,
      supportRatio: understoryPlacements.length > 0 ? 1 : 0,
      maximumRootClearance: 0,
      maximumRootEmbedding: 0.045,
      interpolation: 'barycentric-on-rendered-ridge-triangles',
    }),
    crownSurface:
      'closed-branch-supported-leaf-cohort-and-whorl-crowns-with-age-asymmetry-and-source-damage',
    lighting: 'fogged-non-emissive-opaque-dielectric',
    collisionRole: 'non-solid-distant-background-vegetation',
  });
  group.userData.profile = summary.profile;
  group.userData.summary = summary;
  group.userData.placements = placements.map((placement) => ({ ...placement }));
  group.userData.understoryPlacements = understoryPlacements.map(
    (placement) => ({ ...placement }),
  );
  return group;
}

export { createRidge };
