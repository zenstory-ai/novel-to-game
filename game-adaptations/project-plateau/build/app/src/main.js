import * as THREE from 'three';
import './styles.css';
import { PALETTE, PRODUCT_BUDGET, SCENE_BUDGET, percentile } from './config.js';
import { createWorld } from './world.js';

const canvas = document.querySelector('#game-canvas');
const unsupported = document.querySelector('#unsupported');
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
camera.position.set(18, 8.2, 77);
camera.lookAt(new THREE.Vector3(-2, 5.5, -38));

const hemisphere = new THREE.HemisphereLight(PALETTE.amber, PALETTE.canopy, 2.3);
const sun = new THREE.DirectionalLight(0xffdba1, 3.4);
sun.position.set(-38, 62, 45);
scene.add(hemisphere, sun);

const world = createWorld(scene);
const clock = new THREE.Clock();
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cameraBase = camera.position.clone();
let yaw = 0;
let pitch = -0.02;
let frameSamples = [];
let lastFrame = performance.now();
let firstRenderedAt = null;

function setView(view) {
  if (view === 'field' || view === 'glade' || view === 'order') {
    document.body.dataset.mode = view === 'order' ? 'order' : 'field';
    camera.position.set(12, 5.2, -9);
    camera.lookAt(new THREE.Vector3(1, 3.4, -49));
    camera.fov = 72;
  } else {
    document.body.dataset.mode = 'title';
    camera.position.set(18, 8.2, 77);
    camera.lookAt(new THREE.Vector3(-2, 5.5, -38));
    camera.fov = 58;
  }
  cameraBase = camera.position.clone();
  yaw = 0;
  pitch = 0;
  camera.updateProjectionMatrix();
}

function animate() {
  const elapsed = clock.getElapsedTime();
  world.update(elapsed, reducedMotion);
  if (!reducedMotion && document.body.dataset.mode !== 'field') {
    camera.position.x = cameraBase.x + Math.sin(elapsed * 0.08) * 0.7;
  }
  renderer.render(scene, camera);
  const now = performance.now();
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
  setView('order');
  document.querySelector('#field-order').hidden = false;
});
document.querySelector('#dismiss-order').addEventListener('click', () => {
  document.querySelector('#field-order').hidden = true;
  setView('field');
});
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

canvas.addEventListener('pointermove', (event) => {
  if (document.body.dataset.mode !== 'field' || reducedMotion) return;
  yaw -= event.movementX * 0.00045;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.00035, -0.24, 0.18);
  camera.rotation.set(pitch, yaw + Math.PI, 0, 'YXZ');
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

window.__projectPlateau = {
  stage: 's0-renderer',
  ready: true,
  renderer: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'unsupported',
  productBudget: PRODUCT_BUDGET,
  sceneBudget: SCENE_BUDGET,
  setView,
  sampleFrames,
  snapshot() {
    return {
      stage: this.stage,
      mode: document.body.dataset.mode,
      renderer: this.renderer,
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
