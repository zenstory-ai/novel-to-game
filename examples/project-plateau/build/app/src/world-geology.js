import * as THREE from 'three';
import { BROOK_BOULDER_ASSET } from './brook-boulder.js';
import { PALETTE, SCENE_BUDGET, seededRandom } from './config.js';
import {
  BASALT_FORMATION_LAYOUT,
  BROOK_BOULDER,
} from './environment-layout.js';
import { terrainGradient, terrainHeight } from './terrain.js';
import {
  basaltDetailTextures,
  createFracturedBasaltGeometry,
  createNonColumnarRockGeometry,
  createWeatheredRockGeometry,
  rockTextures,
  settleRockOnTerrain,
} from './rock-rendering.js';

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
  anchor.userData.supportVertexCount = supportVertexCount;
  anchor.userData.supportModel = 'sediment-embedded-flat-base-multipoint-contact';
  anchor.userData.collisionRole = 'solid-boulder';
  anchor.userData.transportClass = BROOK_BOULDER.transportClass;
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

export { makeBasalt, makeBrookBoulder, settleBrookBoulderAsset };
