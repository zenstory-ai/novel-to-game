import * as THREE from 'three';
import './styles.css';
import { PALETTE, PRODUCT_BUDGET, SCENE_BUDGET, percentile } from './config.js';
import { createPlayerState, restartPlayer, setPaused, stepPlayer } from './simulation.js';
import { createWorld, terrainHeight } from './world.js';

const canvas = document.querySelector('#game-canvas');
const unsupported = document.querySelector('#unsupported');
const pausePanel = document.querySelector('#pause-panel');
const pauseLabel = document.querySelector('#pause-label');
const boundaryNote = document.querySelector('#boundary-note');
const fieldHud = document.querySelector('#field-hud');
document.querySelector('#s0-badge').textContent = 'S1 · controller proof';
const query = new URLSearchParams(window.location.search);
const explicitContext = canvas.getContext('webgl2', {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});

if (!explicitContext) {
  unsupported.hidden = false;
  document.querySelector('#title-screen').hidden = true;
  throw new Error('WebGL2 is required for Project Plateau.');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  context: explicitContext,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.amber);
scene.fog = new THREE.FogExp2(PALETTE.dusk, 0.0094);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
const titleCameraPosition = new THREE.Vector3(18, 8.2, 77);
const titleCameraTarget = new THREE.Vector3(-2, 5.5, -38);

const hemisphere = new THREE.HemisphereLight(PALETTE.amber, PALETTE.canopy, 2.3);
const sun = new THREE.DirectionalLight(0xffdba1, 3.4);
sun.position.set(-38, 62, 45);
scene.add(hemisphere, sun);

const world = createWorld(scene);
scene.add(camera);
camera.add(world.fieldCamera);
world.fieldCamera.position.set(0.58, -0.72, -1.35);
world.fieldCamera.rotation.set(-0.08, 0.18, 0);
world.fieldCamera.scale.setScalar(0.34);
const clock = new THREE.Clock();
const pressed = new Set();
let player = createPlayerState();
let runActive = false;
let cameraMode = 'title';
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let frameSamples = [];
let lastFrame = performance.now();
let firstRenderedAt = null;
let visualElapsed = 0;
let boundaryNoticeUntil = 0;
let observedBoundaryRecoveries = 0;

function setCameraToPlayer(now = performance.now()) {
  const moving = pressed.has('KeyW') || pressed.has('KeyA') || pressed.has('KeyS') || pressed.has('KeyD');
  const eyeHeight = player.stance === 'crouch' ? 2.55 : 3.45;
  const bob = moving && !reducedMotion && !player.paused
    ? Math.sin(player.distanceTravelled * 3.2) * (player.stance === 'sprint' ? 0.055 : 0.032)
    : 0;
  camera.position.set(
    player.position.x,
    terrainHeight(player.position.x, player.position.z) + eyeHeight + bob,
    player.position.z,
  );
  camera.rotation.set(player.pitch, player.heading, 0, 'YXZ');
  if (player.boundaryRecoveries > observedBoundaryRecoveries) {
    observedBoundaryRecoveries = player.boundaryRecoveries;
    boundaryNoticeUntil = now + 1500;
  }
  boundaryNote.hidden = now >= boundaryNoticeUntil;
}

function setView(view) {
  cameraMode = view;
  world.fieldCamera.visible = view === 'field' || view === 'glade';
  if (view === 'field' || view === 'order') {
    document.body.dataset.mode = view;
    fieldHud.hidden = view !== 'field';
    camera.fov = 72;
    setCameraToPlayer();
  } else if (view === 'glade') {
    document.body.dataset.mode = 'field';
    fieldHud.hidden = false;
    camera.position.set(12, 5.2, -9);
    camera.lookAt(new THREE.Vector3(1, 3.4, -49));
    camera.fov = 72;
  } else {
    document.body.dataset.mode = 'title';
    fieldHud.hidden = true;
    cameraMode = 'title';
    camera.position.copy(titleCameraPosition);
    camera.lookAt(titleCameraTarget);
    camera.fov = 58;
  }
  camera.updateProjectionMatrix();
}

function inputSnapshot() {
  return {
    forward: Number(pressed.has('KeyW')) - Number(pressed.has('KeyS')),
    right: Number(pressed.has('KeyD')) - Number(pressed.has('KeyA')),
    sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
    crouch: pressed.has('KeyC') || pressed.has('ControlLeft') || pressed.has('ControlRight'),
    heading: player.heading,
    pitch: player.pitch,
  };
}

function requestFieldPointerLock() {
  try {
    const request = canvas.requestPointerLock();
    request?.catch?.(() => {});
  } catch {
    // Keyboard movement remains available when browser policy denies pointer lock.
  }
}

function beginRun() {
  player = restartPlayer(player);
  runActive = true;
  observedBoundaryRecoveries = 0;
  boundaryNoticeUntil = 0;
  pausePanel.hidden = true;
  setView('field');
  requestFieldPointerLock();
}

function pauseRun(reason = 'manual') {
  if (!runActive) return;
  pressed.clear();
  player = setPaused(player, true, reason);
  pauseLabel.textContent = reason === 'window-inactive' ? 'PAUSED — WINDOW INACTIVE' : 'PAUSED';
  pausePanel.hidden = false;
  document.body.dataset.mode = 'paused';
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function resumeRun() {
  if (!runActive) return;
  player = setPaused(player, false);
  pausePanel.hidden = true;
  cameraMode = 'field';
  document.body.dataset.mode = 'field';
  requestFieldPointerLock();
}

function update(deltaSeconds, now) {
  if (runActive && !player.paused) {
    player = stepPlayer(player, inputSnapshot(), deltaSeconds);
    visualElapsed += deltaSeconds;
  } else if (!runActive) {
    visualElapsed += deltaSeconds;
  }
  world.update(visualElapsed, reducedMotion || player.paused);

  if (cameraMode === 'field' || cameraMode === 'order') {
    setCameraToPlayer(now);
  } else if (cameraMode === 'title' && !reducedMotion) {
    camera.position.x = titleCameraPosition.x + Math.sin(visualElapsed * 0.08) * 0.7;
    camera.lookAt(titleCameraTarget);
  }
}

function animate() {
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  update(deltaSeconds, now);
  renderer.render(scene, camera);
  frameSamples.push(now - lastFrame);
  if (frameSamples.length > 360) frameSamples.shift();
  lastFrame = now;
  firstRenderedAt ??= now;
  requestAnimationFrame(animate);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function closePanels() {
  document.querySelector('#settings-panel').hidden = true;
  document.querySelector('#credits-panel').hidden = true;
}

document.querySelector('#enter-button').addEventListener('click', () => {
  closePanels();
  player = createPlayerState();
  setView('order');
  document.querySelector('#field-order').hidden = false;
});
document.querySelector('#dismiss-order').addEventListener('click', () => {
  document.querySelector('#field-order').hidden = true;
  beginRun();
});
document.querySelector('#resume-button').addEventListener('click', resumeRun);
document.querySelector('#restart-button').addEventListener('click', beginRun);
document.querySelector('#settings-button').addEventListener('click', () => {
  closePanels();
  document.querySelector('#settings-panel').hidden = false;
});
document.querySelector('#credits-button').addEventListener('click', () => {
  closePanels();
  document.querySelector('#credits-panel').hidden = false;
});
document.querySelectorAll('.panel-close').forEach((button) => button.addEventListener('click', closePanels));
document.querySelector('#reduced-motion').checked = reducedMotion;
document.querySelector('#reduced-motion').addEventListener('change', (event) => {
  reducedMotion = event.currentTarget.checked;
  document.body.classList.toggle('reduced-motion', reducedMotion);
});
document.querySelector('#text-scale').addEventListener('change', (event) => {
  document.documentElement.style.setProperty('--text-scale', event.currentTarget.value);
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP' && !event.repeat && runActive) {
    if (player.paused) resumeRun();
    else pauseRun('manual');
    return;
  }
  pressed.add(event.code);
});
document.addEventListener('keyup', (event) => pressed.delete(event.code));
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || player.paused || cameraMode !== 'field') return;
  player.heading -= event.movementX * 0.002;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.0016, -1.15, 1.1);
});
document.addEventListener('pointerlockchange', () => {
  if (runActive && !player.paused && document.pointerLockElement !== canvas) {
    pauseRun('pointer-lock');
  }
});
canvas.addEventListener('click', () => {
  if (runActive && !player.paused && cameraMode === 'field') requestFieldPointerLock();
});
window.addEventListener('blur', () => pauseRun('window-inactive'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseRun('window-inactive');
});

async function sampleFrames(count = 180) {
  const samples = [];
  let previous = performance.now();
  await new Promise((resolve) => {
    const take = (now) => {
      samples.push(now - previous);
      previous = now;
      if (samples.length >= count) resolve();
      else requestAnimationFrame(take);
    };
    requestAnimationFrame(take);
  });
  const p50Ms = percentile(samples, 0.5);
  const p99Ms = percentile(samples, 0.99);
  return {
    samples: samples.length,
    medianFrameMs: Number(p50Ms.toFixed(2)),
    medianFps: Number((1000 / p50Ms).toFixed(1)),
    onePercentLowFps: Number((1000 / p99Ms).toFixed(1)),
    worstFrameMs: Number(Math.max(...samples).toFixed(2)),
  };
}

function playerSnapshot() {
  return {
    ...player,
    position: {
      x: Number(player.position.x.toFixed(3)),
      z: Number(player.position.z.toFixed(3)),
    },
    lastStablePosition: {
      x: Number(player.lastStablePosition.x.toFixed(3)),
      z: Number(player.lastStablePosition.z.toFixed(3)),
    },
    heading: Number(player.heading.toFixed(4)),
    pitch: Number(player.pitch.toFixed(4)),
    elapsedSeconds: Number(player.elapsedSeconds.toFixed(3)),
    distanceTravelled: Number(player.distanceTravelled.toFixed(3)),
  };
}

window.__projectPlateau = {
  stage: 's1-controller',
  ready: true,
  renderer: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'unsupported',
  productBudget: PRODUCT_BUDGET,
  sceneBudget: SCENE_BUDGET,
  setView,
  sampleFrames,
  pause: pauseRun,
  resume: resumeRun,
  restart: beginRun,
  teleportForTest(position) {
    if (!query.has('qa')) throw new Error('teleportForTest requires a qa query');
    player.position = { x: position.x, z: position.z };
    player.lastStablePosition = { ...player.position };
    setCameraToPlayer();
  },
  snapshot() {
    return {
      stage: this.stage,
      mode: document.body.dataset.mode,
      cameraMode,
      runActive,
      renderer: this.renderer,
      player: playerSnapshot(),
      sceneChildren: scene.children.length,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      viewport: [window.innerWidth, window.innerHeight],
      firstRenderedAt,
      recentMedianFrameMs: Number(percentile(frameSamples, 0.5).toFixed(2)),
    };
  },
};

setView(query.get('view') === 'glade' || query.get('qa') === 's0' ? 'glade' : 'title');
requestAnimationFrame(animate);
