import * as THREE from 'three';
import { createIguanodon } from './iguanodon.js';
import { createPterodactyl } from './pterodactyl.js';
import { PALETTE, seededRandom } from './config.js';
import {
  FAMILY_LAYOUT,
  FEEDING_BRANCH,
  PTERODACTYL_ORBIT_CENTER,
} from './environment-layout.js';
import { terrainHeight } from './terrain.js';
import { createCylinderBetween, primitive } from './world-rendering.js';
import { shared } from './vegetation-rendering.js';

// The committed attack on the simulation's attack clock: a slow, low circle
// in front of the scout (readable, photographable, with a ground shadow), then
// the fold and the dive that lands at contact.
export const PTERODACTYL_ATTACK_TIMELINE = Object.freeze({
  circleEnd: 4,
  contact: 5.5, // matches CONTACT_SECONDS in simulation.js
});

export function pterodactylAttackPose(attackSeconds = 0, reducedMotion = false) {
  const clock = Math.max(0, Number.isFinite(attackSeconds) ? attackSeconds : 0);
  const { circleEnd, contact } = PTERODACTYL_ATTACK_TIMELINE;
  const rawApproach = THREE.MathUtils.clamp((clock - circleEnd) / (contact - circleEnd), 0, 1);
  const easedApproach = rawApproach * rawApproach * (3 - 2 * rawApproach);
  const approach = reducedMotion ? easedApproach * 0.6 : easedApproach;
  const stage = clock < circleEnd
    ? 'circle'
    : clock < circleEnd + 0.6 ? 'fold-dive' : clock < contact ? 'attack' : 'pull-up';
  return {
    stage,
    approach,
    recovery: 0,
    flightProgress: rawApproach,
    wingFold: THREE.MathUtils.clamp(0.06 + approach * 0.76, 0, 0.82),
    pitch: 0.06 + approach * 0.5,
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
const THREAT_TRANSITION_SECONDS = 0.55;

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

const ATTACK_CIRCLE = Object.freeze({
  ahead: 15,
  startRadius: 9,
  radius: 6,
  startHeight: 12,
  height: 6.8,
  angularSpeed: 0.45,
});

function circlePoint(origin, heading, clock) {
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const settle = THREE.MathUtils.smoothstep(clock, 0, 2.4);
  const radius = THREE.MathUtils.lerp(ATTACK_CIRCLE.startRadius, ATTACK_CIRCLE.radius, settle);
  const height = THREE.MathUtils.lerp(ATTACK_CIRCLE.startHeight, ATTACK_CIRCLE.height, settle);
  // Start on the far side of the circle and sweep across the scout's view.
  const angle = heading + Math.PI / 2 + clock * ATTACK_CIRCLE.angularSpeed;
  return new THREE.Vector3(
    origin.x + forwardX * ATTACK_CIRCLE.ahead + Math.cos(angle) * radius,
    height + Math.sin(clock * 1.7) * 0.35,
    origin.z + forwardZ * ATTACK_CIRCLE.ahead - Math.sin(angle) * radius,
  );
}

export function pterodactylAttackFlightState({
  attackClock,
  attackOrigin,
  attackHeading = 0,
  strikeTarget = null,
  reducedMotion = false,
}) {
  const clock = Math.max(0, Number.isFinite(attackClock) ? attackClock : 0);
  const pose = pterodactylAttackPose(clock, reducedMotion);
  const origin = attackOrigin ?? { x: 0, z: 0 };
  const { circleEnd } = PTERODACTYL_ATTACK_TIMELINE;
  if (clock < circleEnd) {
    return { pose, approach: pose.approach, position: circlePoint(origin, attackHeading, clock) };
  }
  // The dive leaves the circle on its tangent and grazes the scout's shoulder.
  const start = circlePoint(origin, attackHeading, circleEnd);
  const tangent = circlePoint(origin, attackHeading, circleEnd + 0.25).sub(start).multiplyScalar(4);
  const target = strikeTarget ?? origin;
  const end = new THREE.Vector3(
    target.x + Math.cos(attackHeading) * 1.4,
    2.7,
    target.z - Math.sin(attackHeading) * 1.4,
  );
  // The wings fold and the body drops first, then levels into the strike.
  const position = cubicBezierPoint(
    start,
    start.clone().addScaledVector(tangent, 0.5).add(new THREE.Vector3(0, -2.4, 0)),
    end.clone().add(new THREE.Vector3(0, 0.4, 0)),
    end,
    Math.min(1, pose.flightProgress),
  );
  return { pose, approach: pose.approach, position };
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
