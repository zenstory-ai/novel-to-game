import * as THREE from 'three';
import { applyCreatureSkin } from './creature-skin.js';
import { stegosaurusPose } from './stegosaurus-path.js';
import { terrainHeight } from './terrain.js';

// Blender-built, rigged stegosaurus (scripts/blender/build_stegosaurus.py).
export const STEGOSAURUS_ASSET = Object.freeze({
  url: '/assets/stegosaurus-v1.glb',
  clips: Object.freeze(['Walk', 'Drink']),
});

export function createStegosaurus(scene) {
  const anchor = new THREE.Group();
  anchor.name = 'subject.stegosaurus';
  anchor.visible = false;
  scene.add(anchor);
  let mixer = null;
  let actions = null;
  let active = null;
  let pending = null;
  let neck = null;
  let headBone = null;
  let lookWeight = 0;
  const neckWorld = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const parentQuaternion = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  function play(name) {
    if (!actions || active === name) return;
    const next = actions[name];
    next.reset().fadeIn(0.6).play();
    if (active) actions[active].fadeOut(0.6);
    active = name;
  }

  function load() {
    pending ??= import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(STEGOSAURUS_ASSET.url))
      .then((gltf) => {
        const model = gltf.scene;
        model.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.material = applyCreatureSkin(object.material, { rim: 0.4, belly: 0.05 });
        });
        anchor.add(model);
        neck = model.getObjectByName('neck');
        headBone = model.getObjectByName('head');
        mixer = new THREE.AnimationMixer(model);
        actions = Object.fromEntries(STEGOSAURUS_ASSET.clips.map((clip) => {
          const animation = gltf.animations.find((candidate) => candidate.name === clip);
          if (!animation) throw new Error(`The stegosaurus ${clip} motion is missing from the local case.`);
          return [clip, mixer.clipAction(animation)];
        }));
        return anchor;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  }

  // Within twelve metres the walking animal swings its neck toward the scout.
  // Not while it drinks: a head-down neck turned sideways reads as a second head.
  function lookToward(scout, deltaSeconds, drinking) {
    if (!neck || !headBone || !neck.parent) return;
    const distance = scout ? Math.hypot(scout.x - anchor.position.x, scout.z - anchor.position.z) : Infinity;
    const target = drinking ? 0 : THREE.MathUtils.clamp((12 - distance) / 3, 0, 1);
    lookWeight += (target - lookWeight) * (deltaSeconds > 0 ? 1 - Math.exp(-deltaSeconds * 2.5) : 1);
    if (lookWeight < 0.01) return;
    anchor.updateWorldMatrix(true, true);
    neck.getWorldPosition(neckWorld);
    headBone.getWorldPosition(headWorld);
    const facing = Math.atan2(headWorld.x - neckWorld.x, headWorld.z - neckWorld.z);
    const wanted = Math.atan2(scout.x - neckWorld.x, scout.z - neckWorld.z);
    const yaw = THREE.MathUtils.clamp(
      Math.atan2(Math.sin(wanted - facing), Math.cos(wanted - facing)),
      -0.55,
      0.55,
    ) * lookWeight;
    neck.parent.getWorldQuaternion(parentQuaternion);
    turn.setFromAxisAngle(up, yaw);
    neck.quaternion.premultiply(parentQuaternion.clone().invert().multiply(turn).multiply(parentQuaternion));
  }

  function update(clockSeconds, deltaSeconds, reducedMotion = false, scout = null) {
    const pose = stegosaurusPose(clockSeconds);
    anchor.visible = Boolean(mixer) && pose.phase !== 'absent' && pose.phase !== 'gone';
    if (!anchor.visible) return pose;
    anchor.position.set(pose.x, terrainHeight(pose.x, pose.z) - 0.05, pose.z);
    anchor.rotation.y = pose.heading - Math.PI / 2;
    play(pose.phase === 'drinking' ? 'Drink' : 'Walk');
    if (actions.Walk) actions.Walk.timeScale = 0.35 + pose.stride * 0.65;
    mixer.update(reducedMotion ? 0 : deltaSeconds);
    lookToward(scout, deltaSeconds, pose.phase === 'drinking');
    return pose;
  }

  return { anchor, load, update };
}
