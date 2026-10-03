import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere-sky.js';

// Camera-following instanced grass. Each instance is a clump of tapered blades
// on a world-anchored grid that wraps around the camera, so blades never
// slide as the scout walks. Height and growth density come from the terrain
// mesh itself (its heights and ecology masks), so no extra sampling is paid.
const BLADES_PER_CLUMP = 7;
const SEGMENTS = 4;
const RINGS = Object.freeze([
  Object.freeze({ name: 'near', cell: 0.4, radius: 22, scale: 0.78 }),
  Object.freeze({ name: 'far', cell: 1.0, radius: 58, scale: 1.2 }),
]);

function bladeClumpGeometry(seed = 7) {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const positions = [];
  const blade = [];
  const indices = [];
  for (let b = 0; b < BLADES_PER_CLUMP; b += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.28;
    const facing = random() * Math.PI;
    const height = 0.38 + random() * 0.62;
    const width = 0.035 + random() * 0.03;
    const lean = 0.15 + random() * 0.35;
    const baseX = Math.cos(angle) * radius;
    const baseZ = Math.sin(angle) * radius;
    const start = positions.length / 3;
    for (let s = 0; s <= SEGMENTS; s += 1) {
      const t = s / SEGMENTS;
      const w = width * (1 - t * 0.92);
      const bend = lean * t * t;
      const cx = baseX + Math.cos(facing + 1.57) * bend;
      const cz = baseZ + Math.sin(facing + 1.57) * bend;
      positions.push(
        cx - Math.cos(facing) * w, t * height, cz - Math.sin(facing) * w,
        cx + Math.cos(facing) * w, t * height, cz + Math.sin(facing) * w,
      );
      blade.push(t, random(), t, random());
    }
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = start + s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('bladeData', new THREE.Float32BufferAttribute(blade, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
    new Array(positions.length).fill(0).map((_, index) => (index % 3 === 1 ? 1 : 0)),
    3,
  ));
  geometry.setIndex(indices);
  return geometry;
}

function terrainFieldTextures(terrain) {
  const geometry = terrain.geometry;
  const params = geometry.parameters;
  const columns = params.widthSegments + 1;
  const rows = params.heightSegments + 1;
  const position = geometry.getAttribute('position');
  const read = (name, index, component = 0) => {
    const attribute = geometry.getAttribute(name);
    return attribute ? attribute.array[index * attribute.itemSize + component] : 0;
  };
  const heights = new Float32Array(columns * rows);
  const field = new Uint8Array(columns * rows * 4);
  for (let index = 0; index < columns * rows; index += 1) {
    heights[index] = position.getY(index);
    const route = read('terrainRouteWear', index);
    const wetBank = read('terrainWetBank', index);
    const wet = read('terrainWetness', index);
    const rock = Math.max(read('terrainBedrockExposure', index), read('terrainBasaltInfluence', index) * 0.9);
    const slope = read('terrainSlope', index);
    const pointBar = read('terrainFluvialSurface', index, 0);
    const mineral = read('terrainMineralExposure', index);
    const humus = read('terrainHumus', index);
    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const density = clamp01(1 - route * 1.7)
      * clamp01(1 - wetBank * 1.8)
      * clamp01(1 - (wet - 0.55) * 3)
      * clamp01(1 - rock * 1.6)
      * clamp01(1 - (slope - 0.6) * 2.5)
      * clamp01(1 - pointBar * 1.6)
      * clamp01(1 - mineral * 0.9)
      * (1 - humus * 0.55);
    field[index * 4] = Math.round(density * 255);
    field[index * 4 + 1] = Math.round(clamp01(mineral * 0.8 + route * 0.6 + (1 - wet) * 0.3) * 255);
    field[index * 4 + 3] = 255;
  }
  const heightTexture = new THREE.DataTexture(heights, columns, rows, THREE.RedFormat, THREE.FloatType);
  heightTexture.magFilter = THREE.LinearFilter;
  heightTexture.minFilter = THREE.LinearFilter;
  heightTexture.needsUpdate = true;
  const fieldTexture = new THREE.DataTexture(field, columns, rows, THREE.RGBAFormat);
  fieldTexture.magFilter = THREE.LinearFilter;
  fieldTexture.minFilter = THREE.LinearFilter;
  fieldTexture.needsUpdate = true;
  // Plane row 0 sits at world z = -height/2 after the terrain's -90° X rotation.
  const extent = new THREE.Vector4(params.width, params.height, columns, rows);
  return { heightTexture, fieldTexture, extent };
}

function createGrassMaterial(uniforms) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute vec2 bladeData;
        attribute vec2 clumpCell;
        uniform sampler2D grassHeight;
        uniform sampler2D grassField;
        uniform vec4 grassExtent;
        uniform vec3 grassCamera;
        uniform float grassCell;
        uniform float grassRadius;
        uniform float grassScale;
        uniform float grassTime;
        varying vec3 vGrassColor;
        varying float vGrassTip;
        float grassHash(vec2 p) {
          return fract(sin(dot(p, vec2(41.37, 289.13))) * 43758.5453);
        }
        vec2 grassUv(vec2 world) {
          vec2 grid = (world + grassExtent.xy * 0.5) / grassExtent.xy * (grassExtent.zw - 1.0);
          return (grid + 0.5) / grassExtent.zw;
        }
      `)
      .replace('#include <begin_vertex>', `
        float span = grassRadius * 2.0;
        vec2 anchor = clumpCell * grassCell;
        vec2 world = grassCamera.xz + mod(anchor - grassCamera.xz + grassRadius, span) - grassRadius;
        vec2 cellId = floor(world / grassCell + 0.5);
        world = cellId * grassCell;
        float h1 = grassHash(cellId);
        float h2 = grassHash(cellId + 17.3);
        float h3 = grassHash(cellId + 41.9);
        world += (vec2(h1, h2) - 0.5) * grassCell * 0.9;
        vec2 uv = grassUv(world);
        vec4 field = texture2D(grassField, uv);
        float ground = texture2D(grassHeight, uv).r;
        float patchNoise = grassHash(floor(world * 0.18)) * 0.5 + grassHash(floor(world * 0.07 + 3.1)) * 0.5;
        float density = field.r * smoothstep(0.08, 0.55, patchNoise + field.r * 0.45);
        float distanceToCamera = length(world - grassCamera.xz);
        float fade = 1.0 - smoothstep(grassRadius * 0.62, grassRadius * 0.97, distanceToCamera);
        float present = step(h3, density) * fade;
        float scale = grassScale * (0.55 + h2 * 0.75) * mix(0.6, 1.0, density) * present;
        float yaw = h1 * 6.2831;
        mat2 spin = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw));
        vec3 transformed = vec3(position);
        transformed.xz = spin * transformed.xz;
        transformed *= scale;
        float tip = bladeData.x;
        float gust = sin(grassTime * 1.7 + world.x * 0.23 + world.y * 0.17)
          * 0.5 + sin(grassTime * 3.1 + world.x * 0.9) * 0.18;
        transformed.xz += vec2(0.8, 0.45) * gust * tip * tip * 0.18 * scale;
        transformed += vec3(world.x, ground - 0.03, world.y);
        vGrassTip = tip;
        vec3 lush = mix(vec3(0.035, 0.095, 0.03), vec3(0.09, 0.16, 0.04), h1);
        vec3 dry = vec3(0.26, 0.25, 0.1);
        vec3 tipColor = mix(lush, dry, clamp(field.g * 0.45 + (patchNoise - 0.55) * 0.7, 0.0, 0.7));
        vGrassColor = mix(vec3(0.025, 0.04, 0.015), tipColor, smoothstep(0.0, 0.8, tip));
      `)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3(0.0, 1.0, 0.0);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3 grassSunDirection;
        uniform vec3 grassSunColor;
        varying vec3 vGrassColor;
        varying float vGrassTip;
      `)
      .replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        normal = normalize(vNormal);
      `)
      .replace('#include <color_fragment>', `
        diffuseColor.rgb = vGrassColor;
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        vec3 grassView = normalize(vViewPosition);
        vec3 grassSunView = normalize((viewMatrix * vec4(grassSunDirection, 0.0)).xyz);
        float grassBacklight = pow(max(dot(-grassView, grassSunView), 0.0), 3.0);
        totalEmissiveRadiance += grassSunColor * vGrassColor * grassBacklight * vGrassTip * 1.4;
      `);
  };
  material.customProgramCacheKey = () => 'plateau-grass-field-v1';
  return material;
}

export function createGrassField(scene, terrain) {
  const { heightTexture, fieldTexture, extent } = terrainFieldTextures(terrain);
  const shared = {
    grassHeight: { value: heightTexture },
    grassField: { value: fieldTexture },
    grassExtent: { value: extent },
    grassCamera: { value: new THREE.Vector3() },
    grassTime: { value: 0 },
    grassSunDirection: { value: SUN_DIRECTION },
    grassSunColor: { value: new THREE.Color(0xffc98a).multiplyScalar(1.4) },
  };
  const group = new THREE.Group();
  group.name = 'world.ground.grass-field';
  const meshes = RINGS.map((ring, ringIndex) => {
    const geometry = bladeClumpGeometry(11 + ringIndex * 5);
    const side = Math.ceil((ring.radius * 2) / ring.cell);
    const cells = new Float32Array(side * side * 2);
    for (let z = 0; z < side; z += 1) {
      for (let x = 0; x < side; x += 1) {
        cells[(z * side + x) * 2] = x;
        cells[(z * side + x) * 2 + 1] = z;
      }
    }
    geometry.setAttribute('clumpCell', new THREE.InstancedBufferAttribute(cells, 2));
    geometry.instanceCount = side * side;
    const material = createGrassMaterial({
      ...shared,
      grassCell: { value: ring.cell },
      grassRadius: { value: (side * ring.cell) / 2 },
      grassScale: { value: ring.scale },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `world.ground.grass-${ring.name}`;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return {
    group,
    meshes,
    update(camera, elapsed, reducedMotion = false) {
      shared.grassCamera.value.copy(camera.position);
      shared.grassTime.value = reducedMotion ? 0 : elapsed;
    },
  };
}
