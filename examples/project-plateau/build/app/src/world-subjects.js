import * as THREE from 'three';
import { createIguanodon } from './iguanodon.js';
import { createPterodactyl } from './pterodactyl.js';
import { PALETTE, seededRandom } from './config.js';
import { FAMILY_LAYOUT, FEEDING_BRANCH } from './environment-layout.js';
import { terrainHeight } from './terrain.js';
import { createCylinderBetween, primitive } from './world-rendering.js';
import { shared } from './vegetation-rendering.js';

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
    shadow.renderOrder = 1;
    group.add(shadow);
  });

  scene.add(group);
  return group;
}

export {
  PTERODACTYL_ORBIT_CENTER,
  THREAT_TRANSITION_SECONDS,
  alignPterodactylToTravel,
  makeFamily,
  makeFamilyContactShadows,
  makeFeedingBranch,
  makeGladeSunLane,
  makePterodactyl,
  makePterodactylShadow,
};
