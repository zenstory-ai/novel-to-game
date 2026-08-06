import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { createAtmosphere } from './atmosphere.js';
import { FieldAudio, captionForCue } from './audio.js';
import {
  PALETTE,
  PRODUCT_BUDGET,
  SCENE_BUDGET,
  onePercentLowFps,
  percentile,
} from './config.js';
import { applyLookDelta, shouldCaptureGameplayKey } from './controller.js';
import {
  MAX_RENDER_PIXEL_RATIO,
  QUALITY_PROFILES,
  advanceRenderSchedule,
  qualityRenderPixelRatio,
  renderIntervalForState,
  shouldRenderFrame,
} from './render-budget.js';
import {
  SETTINGS_STORAGE_KEY,
  clearSettings,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from './settings.js';
import {
  EXPOSURE_SECONDS,
  collisionContractSnapshot,
  createPlayerState,
  examine,
  fireDefensiveShot,
  frameForState,
  restartPlayer,
  releaseTransientTools,
  setCameraRaised,
  setPaused,
  setRifleRaised,
  startExposure,
  stepPlayer,
} from './simulation.js';
import { terrainHeight } from './terrain.js';
import { PTERODACTYL_ATTACK_CYCLE_SECONDS, createWorld } from './world.js';
import { showPreviewGateway } from './preview-gateway.js';
import { hideLoading, loadingScreenSnapshot, showLoading } from './loading-screen.js';

const canvas = document.querySelector('#game-canvas');
const requiredAssetsError = document.querySelector('#required-assets-error');
const requiredAssetsCopy = document.querySelector('#required-assets-copy');
const enterButton = document.querySelector('#enter-button');
const pausePanel = document.querySelector('#pause-panel');
const pauseLabel = document.querySelector('#pause-label');
const boundaryNote = document.querySelector('#boundary-note');
const fieldHud = document.querySelector('#field-hud');
const contextPrompt = document.querySelector('#context-prompt');
const controlHint = document.querySelector('#control-hint');
const fieldNote = document.querySelector('#field-note');
const cameraOverlay = document.querySelector('#camera-overlay');
const frameCondition = document.querySelector('#frame-condition');
const commitLine = document.querySelector('#commit-line');
const platePreview = document.querySelector('#plate-preview');
const previewImage = platePreview.querySelector('.preview-image');
const previewNumber = document.querySelector('#preview-number');
const previewCopy = document.querySelector('#preview-copy');
const contactNote = document.querySelector('#contact-note');
const plateRail = document.querySelector('#plate-rail');
const plateSlots = [...plateRail.children];
const cartridgeDisplay = document.querySelector('#cartridge-display');
const cartridgeSlots = [...cartridgeDisplay.children];
const captionLine = document.querySelector('#caption-line');
const lightWatch = document.querySelector('#light-watch');
const lightSeconds = document.querySelector('#light-seconds');
const terminalPanel = document.querySelector('#terminal-panel');
const terminalBoardSlots = [...terminalPanel.querySelector('.terminal-board').children];
const terminalEyebrow = document.querySelector('#terminal-eyebrow');
const terminalTitle = document.querySelector('#terminal-title');
const terminalResultCopy = document.querySelector('#terminal-result-copy');
const terminalDetail = document.querySelector('#terminal-detail');
const terminalCallback = document.querySelector('#terminal-callback');
document.querySelector('#build-badge').textContent = 'Playable prototype';
const query = new URLSearchParams(window.location.search);
const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let presentationSettings = loadSettings(window.localStorage, systemReducedMotion);
let reducedMotion = presentationSettings.reducedMotion;
const explicitContext = canvas.getContext('webgl2', {
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
});

if (!explicitContext) {
  showPreviewGateway('webgl2-unavailable');
  throw new Error('WebGL2 is required for Project Plateau.');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  context: explicitContext,
  antialias: true,
  powerPreference: 'default',
});
renderer.setPixelRatio(qualityRenderPixelRatio(window.devicePixelRatio, presentationSettings.quality));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x122c34);
scene.fog = new THREE.FogExp2(0x496a69, 0.0086);
createAtmosphere(scene);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
const titleCameraPosition = new THREE.Vector3(18, 7.6, 55);
const titleCameraTarget = new THREE.Vector3(-1, 3.2, -34);

const ambient = new THREE.AmbientLight(0x718889, 0.1);
const hemisphere = new THREE.HemisphereLight(0x82aab1, 0x20342d, 0.46);
const sun = new THREE.DirectionalLight(0xffc276, 5.25);
sun.position.set(-46, 58, 76);
sun.target.position.set(1, 0, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -58;
sun.shadow.camera.right = 58;
sun.shadow.camera.top = 74;
sun.shadow.camera.bottom = -74;
sun.shadow.camera.near = 8;
sun.shadow.camera.far = 230;
sun.shadow.bias = -0.00045;
sun.shadow.normalBias = 0.028;
const gladeFill = new THREE.PointLight(0xe9a85f, 2.25, 48, 2.05);
gladeFill.position.set(-4, 13, -18);
const canopyRim = new THREE.DirectionalLight(0x82b6bc, 0.62);
canopyRim.position.set(32, 24, -36);
const subjectFill = new THREE.DirectionalLight(0xd8c3a0, 0.4);
subjectFill.position.set(-12, 15, 36);
subjectFill.target.position.set(1, 2.2, -33);
const basaltBounce = new THREE.PointLight(0x8a7770, 1.12, 56, 2.15);
basaltBounce.position.set(23, 11, -21);
scene.add(
  ambient,
  hemisphere,
  sun,
  sun.target,
  gladeFill,
  canopyRim,
  subjectFill,
  subjectFill.target,
  basaltBounce,
);

const world = createWorld(scene);
const gtaoExcluded = [world.fieldCamera, world.rifle];
scene.traverse((object) => {
  if (!object.isMesh && !object.isSprite) return;
  if (gtaoExcluded.some((root) => root === object || root.getObjectById?.(object.id))) return;
  if (object.userData.gtaoExcluded) {
    gtaoExcluded.push(object);
    return;
  }
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  if (materials.some((material) => material?.transparent || material?.opacity < 1)) {
    gtaoExcluded.push(object);
  }
});
gtaoExcluded.forEach((object) => { object.userData.gtaoExcluded = true; });
let hy3dVisualPromise = null;
function ensureHy3dVisuals() {
  if (!hy3dVisualPromise) {
    hy3dVisualPromise = world.enableHy3dVisuals().catch((error) => {
      hy3dVisualPromise = null;
      throw error;
    });
  }
  return hy3dVisualPromise;
}
const composer = new EffectComposer(renderer);
composer.setPixelRatio(qualityRenderPixelRatio(window.devicePixelRatio, presentationSettings.quality));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const gtaoPass = new GTAOPass(
  scene,
  camera,
  window.innerWidth,
  window.innerHeight,
  undefined,
  {
    radius: 0.18,
    distanceExponent: 1.25,
    thickness: 1.15,
    distanceFallOff: 0.9,
    scale: 0.82,
    samples: 4,
    screenSpaceRadius: false,
  },
  {
    lumaPhi: 8,
    depthPhi: 2,
    normalPhi: 3,
    radius: 6,
    radiusExponent: 2,
    rings: 2,
    samples: 4,
  },
);
const renderGtao = gtaoPass.render.bind(gtaoPass);
gtaoPass.render = (...args) => {
  const visibility = gtaoExcluded.map((object) => object.visible);
  gtaoExcluded.forEach((object) => { object.visible = false; });
  try {
    return renderGtao(...args);
  } finally {
    gtaoExcluded.forEach((object, index) => { object.visible = visibility[index]; });
  }
};
gtaoPass.blendIntensity = 0.28;
composer.addPass(gtaoPass);
const fieldGradePass = new ShaderPass({
  name: 'ProjectPlateauFieldGrade',
  uniforms: {
    tDiffuse: { value: null },
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
    uniform sampler2D tDiffuse;

    float fieldHash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 color = mix(vec3(luma), source.rgb, 1.035);
      float shadowWeight = 1.0 - smoothstep(0.12, 0.52, luma);
      float highlightWeight = smoothstep(0.46, 0.9, luma);
      color = mix(color, color * vec3(0.94, 1.0, 1.045), shadowWeight * 0.045);
      color = mix(color, color * vec3(1.035, 1.0, 0.955), highlightWeight * 0.03);
      vec2 centred = (vUv - 0.5) * vec2(1.0, 0.82);
      float vignette = smoothstep(0.34, 0.76, dot(centred, centred));
      color *= 1.0 - vignette * 0.055;
      float grain = fieldHash(gl_FragCoord.xy) - 0.5;
      color += grain * 0.002;
      gl_FragColor = vec4(max(color, 0.0), source.a);
    }
  `,
});
fieldGradePass.material.name = 'Project Plateau restrained field grade';
composer.addPass(fieldGradePass);
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.name = 'Project Plateau single-pass FXAA';
composer.addPass(fxaaPass);
const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
smaaPass.name = 'Project Plateau balanced/high SMAA';
composer.addPass(smaaPass);
composer.addPass(new OutputPass());
scene.add(camera);
camera.add(world.fieldCamera);
camera.add(world.rifle);
const FIELD_CAMERA_VIEWMODEL = Object.freeze({
  position: Object.freeze([0.59, -0.91, -1.52]),
  rotation: Object.freeze([-0.14, 0.16, -0.065]),
  scale: 0.39,
});
const RIFLE_VIEWMODEL = Object.freeze({
  position: Object.freeze([0.72, -0.91, -1.14]),
  rotation: Object.freeze([-0.025, 0.15, -0.09]),
  scale: 0.205,
});
world.fieldCamera.position.fromArray(FIELD_CAMERA_VIEWMODEL.position);
world.fieldCamera.rotation.set(...FIELD_CAMERA_VIEWMODEL.rotation);
world.fieldCamera.scale.setScalar(FIELD_CAMERA_VIEWMODEL.scale);
world.rifle.position.fromArray(RIFLE_VIEWMODEL.position);
world.rifle.rotation.set(...RIFLE_VIEWMODEL.rotation);
world.rifle.scale.setScalar(RIFLE_VIEWMODEL.scale);
const clock = new THREE.Clock();
const fieldAudio = new FieldAudio();
const pressed = new Set();
let jumpQueued = false;
let player = createPlayerState();
let pointerLockStatus = 'idle';
let pointerLockError = null;
let smoothedEyeHeight = 3.45;
let lastCameraMotionAt = null;
let runActive = false;
let cameraMode = 'title';
let visualReviewOrbit = null;
let frameSamples = [];
let lastFrame = performance.now();
let lastRenderedAt = 0;
let renderScheduleAt = 0;
let renderedFrameCount = 0;
let skippedFrameCount = 0;
let firstRenderedAt = null;
let visualElapsed = 0;
let visualTimeFrozen = false;
let visualThreatOverride = null;
let visualThreatPose = null;
let visualPterodactylMorphPose = null;
let boundaryNoticeUntil = 0;
let observedBoundaryRecoveries = 0;
let observationNoticeUntil = 0;
let contactNoticeUntil = 0;
let captionNoticeUntil = 0;
let observedViewmodelShotCount = 0;
let rifleRecoilStartedAt = -Infinity;

const ROMAN_PLATES = ['I', 'II', 'III', 'IV'];
let plateImages = Array(ROMAN_PLATES.length).fill(null);
let plateCaptureGeneration = 0;
let pendingPlateCapture = null;
let plateCaptureStatus = 'idle';
let plateCaptureDurationMs = null;
let plateCaptureError = null;

function applyPlateImage(element, image) {
  element.dataset.captured = image ? 'true' : 'false';
  element.style.backgroundImage = image ? `url("${image}")` : '';
}

function updateViewmodelPose(now) {
  if ((player.shotCount ?? 0) > observedViewmodelShotCount) {
    observedViewmodelShotCount = player.shotCount;
    rifleRecoilStartedAt = now;
  }
  const speed = Math.hypot(player.velocity?.x ?? 0, player.velocity?.z ?? 0);
  const moving = speed > 0.08 && !player.paused;
  const motion = moving && !reducedMotion ? Math.min(1, speed / 5.2) : 0;
  const phase = player.distanceTravelled * 3.2;
  const horizontal = Math.cos(phase * 0.5) * 0.012 * motion;
  const vertical = Math.sin(phase) * 0.014 * motion;
  const recoilAge = Math.max(0, now - rifleRecoilStartedAt);
  const recoil = recoilAge < 150
    ? Math.sin((recoilAge / 150) * Math.PI) * (1 - recoilAge / 150)
    : 0;

  world.fieldCamera.position.set(
    FIELD_CAMERA_VIEWMODEL.position[0] + horizontal,
    FIELD_CAMERA_VIEWMODEL.position[1] + vertical,
    FIELD_CAMERA_VIEWMODEL.position[2],
  );
  world.fieldCamera.rotation.set(
    FIELD_CAMERA_VIEWMODEL.rotation[0] + vertical * 0.35,
    FIELD_CAMERA_VIEWMODEL.rotation[1] - horizontal * 0.55,
    FIELD_CAMERA_VIEWMODEL.rotation[2] + horizontal * 0.8,
  );
  world.rifle.position.set(
    RIFLE_VIEWMODEL.position[0] + horizontal * 0.65,
    RIFLE_VIEWMODEL.position[1] + vertical * 0.75 - recoil * 0.015,
    RIFLE_VIEWMODEL.position[2] + recoil * 0.08,
  );
  world.rifle.rotation.set(
    RIFLE_VIEWMODEL.rotation[0] + vertical * 0.24 + recoil * 0.045,
    RIFLE_VIEWMODEL.rotation[1] - horizontal * 0.4,
    RIFLE_VIEWMODEL.rotation[2] + horizontal * 0.62,
  );
}

function clearPlateImages() {
  plateCaptureGeneration += 1;
  pendingPlateCapture = null;
  plateCaptureStatus = 'idle';
  plateCaptureDurationMs = null;
  plateCaptureError = null;
  plateImages = Array(ROMAN_PLATES.length).fill(null);
  applyPlateImage(previewImage, null);
  terminalBoardSlots.forEach((slot) => applyPlateImage(slot, null));
}

function queuePlateCapture(plateIndex) {
  pendingPlateCapture = {
    plateIndex,
    generation: plateCaptureGeneration,
    requestedAt: performance.now(),
  };
  plateCaptureStatus = 'queued';
  plateCaptureError = null;
}

function encodeRenderedPlate(capture) {
  plateCaptureStatus = 'encoding';
  canvas.toBlob((blob) => {
    if (!blob) {
      plateCaptureStatus = 'error';
      plateCaptureError = 'The rendered plate could not be encoded.';
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('loadend', () => {
      if (capture.generation !== plateCaptureGeneration) return;
      plateImages[capture.plateIndex] = typeof reader.result === 'string' ? reader.result : null;
      plateCaptureDurationMs = Number((performance.now() - capture.requestedAt).toFixed(2));
      plateCaptureStatus = plateImages[capture.plateIndex] ? 'ready' : 'error';
      if (plateCaptureStatus === 'error') plateCaptureError = 'The rendered plate was empty.';
    }, { once: true });
    reader.readAsDataURL(blob);
  }, 'image/jpeg', 0.8);
}

function syncSettingsControls() {
  document.querySelector('#reduced-motion').checked = presentationSettings.reducedMotion;
  document.querySelector('#captions-enabled').checked = presentationSettings.captionsEnabled;
  document.querySelector('#text-scale').value = presentationSettings.textScale;
  document.querySelector('#visual-quality').value = presentationSettings.quality;
  document.querySelector('#look-sensitivity').value = presentationSettings.lookSensitivity;
  for (const channel of ['ambience', 'effects', 'music']) {
    document.querySelector(`#${channel}-volume`).value = presentationSettings.volumes[channel];
  }
}

function applyPresentationSettings(settings, persist = true) {
  presentationSettings = normalizeSettings(settings, systemReducedMotion);
  reducedMotion = presentationSettings.reducedMotion;
  document.body.classList.toggle('reduced-motion', reducedMotion);
  document.documentElement.style.setProperty('--text-scale', presentationSettings.textScale);
  document.documentElement.dataset.textScale = presentationSettings.textScale;
  document.documentElement.dataset.quality = presentationSettings.quality;
  const qualityProfile = QUALITY_PROFILES[presentationSettings.quality];
  gtaoPass.enabled = qualityProfile.gtao;
  smaaPass.enabled = presentationSettings.quality === 'high';
  fxaaPass.enabled = presentationSettings.quality !== 'high';
  if (sun.shadow.mapSize.x !== qualityProfile.shadowMapSize) {
    sun.shadow.mapSize.setScalar(qualityProfile.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  fieldAudio.setCaptionsEnabled(presentationSettings.captionsEnabled);
  for (const channel of ['ambience', 'effects', 'music']) {
    fieldAudio.setVolume(channel, presentationSettings.volumes[channel]);
  }
  if (!fieldAudio.captionsEnabled) captionLine.hidden = true;
  resize();
  if (persist) presentationSettings = saveSettings(window.localStorage, presentationSettings);
  syncSettingsControls();
}

function showCaption(cue, duration = 2400) {
  const copy = captionForCue(cue);
  if (!copy || !fieldAudio.captionsEnabled) return;
  captionLine.textContent = copy;
  captionNoticeUntil = performance.now() + duration;
}

function emitCue(cue, duration) {
  fieldAudio.cue(cue);
  showCaption(cue, duration);
}

function contextualCopy() {
  if (player.pendingExposure) return 'Hold steady.';
  if (player.cameraRaised) return 'Hold steady. Release the shutter [Left Mouse]';
  if (player.threatState === 'attack') return 'Hold rifle [F] · Fire before contact [Left Mouse]';
  if (player.zone === 'brook-blind' && !player.examinedTrack) return 'Examine the track [E]';
  if (player.zone === 'brook-blind') return 'Hold camera [Right Mouse]';
  if (player.zone === 'iguanodon-glade' && !player.observedBehavior) return 'Read the family [E]';
  if (player.returnRoute) return 'Follow the Fort smoke through the gate.';
  if (player.zone !== 'fort' && player.plates.some((plate) => plate.status === 'unexposed')) {
    return 'Hold camera [Right Mouse]';
  }
  return '';
}

function frameConditionCopy(frame) {
  const conditions = {
    'empty-fort': 'NO LIVING SUBJECT',
    'brook-unread': 'TRACK CONTEXT // UNREAD',
    'brook-partial': 'FOLIAGE // SUBJECT PARTLY OCCLUDED',
    'canopy-flank': 'FERN GAP // FLANK CLEAR',
    'basalt-scale': 'OPEN SIGHT // BASALT SCALE',
    'glade-form': 'FAMILY // BEHAVIOR NOT YET READ',
    'glade-behavior': 'FAMILY // LIVING BEHAVIOR',
    'glade-young-play': 'FAMILY // YOUNG AT PLAY',
    'glade-branch-pull': 'FAMILY // BRANCH PULL',
    'return-occluded': 'THORN // BODY PARTLY OCCLUDED',
    'creek-scale': 'OPEN SIGHT // CREEK SCALE',
  };
  return conditions[frame.key] ?? 'FIELD FRAME';
}

function updateFieldHud(now) {
  const currentFrame = player.pendingExposure ?? frameForState(player);
  const prompt = contextualCopy();
  contextPrompt.textContent = prompt;
  contextPrompt.hidden = !prompt || player.failed;
  // The complete legend is onboarding, not a permanent debug bar. Keep it on
  // the first controllable metres, then let contextual prompts own the HUD.
  const controlsLearned = player.distanceTravelled >= 5
    || player.position.z < 60
    || player.threatAwareness >= 1
    || cameraMode === 'glade'
    || visualThreatOverride !== null;
  controlHint.hidden = player.zone === 'brook-blind' || controlsLearned;

  cameraOverlay.hidden = !player.cameraRaised;
  frameCondition.textContent = frameConditionCopy(currentFrame);
  const commitProgress = player.pendingExposure
    ? ((EXPOSURE_SECONDS - player.pendingExposure.remainingSeconds) / EXPOSURE_SECONDS) * 100
    : 0;
  commitLine.style.setProperty('--commit-progress', `${Math.max(0, Math.min(100, commitProgress))}%`);
  document.body.dataset.camera = player.cameraRaised ? 'raised' : 'folded';

  document.body.dataset.rifle = player.rifleRaised ? 'raised' : 'lowered';
  cartridgeDisplay.hidden = !(player.rifleRevealed || player.threatState === 'attack');
  cartridgeSlots.forEach((slot, index) => {
    slot.classList.toggle('spent', index >= player.cartridges);
  });

  plateRail.hidden = !player.plateRailRevealed;
  plateSlots.forEach((slot, index) => {
    const plate = player.plates[index];
    slot.dataset.status = plate.status;
    slot.dataset.frame = plate.frameKey ?? 'empty';
    slot.dataset.cues = plate.status === 'exposed' ? `${plate.points} cue${plate.points === 1 ? '' : 's'}` : '';
    slot.style.setProperty('--plate-fill', `${plate.points * 50}%`);
    slot.setAttribute(
      'aria-label',
      `Plate ${ROMAN_PLATES[index]}: ${plate.status}${plate.status === 'exposed' ? `, ${plate.points} cues` : ''}`,
    );
  });

  lightWatch.hidden = !player.plateRailRevealed;
  lightSeconds.textContent = Math.max(0, Math.ceil(player.remainingLight));

  const previewPlate = player.lastProofEvent
    ? player.plates[player.lastProofEvent.plateIndex]
    : null;
  const showPreview = player.previewSeconds > 0
    && player.lastProofEvent
    && previewPlate?.status === 'exposed';
  platePreview.hidden = !showPreview;
  if (showPreview) {
    const { plateIndex, key } = player.lastProofEvent;
    previewNumber.textContent = ROMAN_PLATES[plateIndex];
    previewCopy.textContent = player.lastProofEvent.label;
    previewImage.dataset.frame = key;
    applyPlateImage(previewImage, plateImages[plateIndex]);
  }

  fieldNote.hidden = !player.lastObservation || now >= observationNoticeUntil;
  if (!fieldNote.hidden) fieldNote.textContent = player.lastObservation;
  contactNote.hidden = now >= contactNoticeUntil;
  captionLine.hidden = !fieldAudio.captionsEnabled
    || now >= captionNoticeUntil;
  document.body.dataset.contact = contactNote.hidden ? 'false' : 'true';

  world.fieldCamera.visible = runActive
    && !player.failed
    && !player.rifleRaised
    && !player.cameraRaised;
  world.rifle.visible = runActive && !player.failed && player.rifleRaised;
  updateViewmodelPose(now);
}

function setCameraToPlayer(now = performance.now()) {
  const speed = Math.hypot(player.velocity?.x ?? 0, player.velocity?.z ?? 0);
  const moving = speed > 0.08;
  const desiredEyeHeight = player.stance === 'crouch' ? 2.55 : 3.45;
  const cameraDelta = lastCameraMotionAt === null
    ? 0
    : Math.max(0, Math.min((now - lastCameraMotionAt) / 1000, 0.1));
  lastCameraMotionAt = now;
  const eyeBlend = 1 - Math.exp(-12 * cameraDelta);
  smoothedEyeHeight += (desiredEyeHeight - smoothedEyeHeight) * eyeBlend;
  const bob = moving && player.grounded && !reducedMotion && !player.paused
    ? Math.sin(player.distanceTravelled * 3.2) * (player.stance === 'sprint' ? 0.05 : 0.028)
    : 0;
  camera.position.set(
    player.position.x,
    terrainHeight(player.position.x, player.position.z)
      + (player.verticalOffset ?? 0)
      + smoothedEyeHeight
      + bob,
    player.position.z,
  );
  camera.rotation.set(player.pitch, player.heading, 0, 'YXZ');
  const sprintFov = player.stance === 'sprint' ? Math.min(2.4, speed * 0.35) : 0;
  const desiredFov = player.cameraRaised ? 58 : player.rifleRaised ? 66 : 70 + sprintFov;
  const nextFov = camera.fov + (desiredFov - camera.fov) * (1 - Math.exp(-10 * cameraDelta));
  if (Math.abs(camera.fov - nextFov) > 0.001) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  if (player.boundaryRecoveries > observedBoundaryRecoveries) {
    observedBoundaryRecoveries = player.boundaryRecoveries;
    boundaryNoticeUntil = now + 1500;
  }
  boundaryNote.hidden = now >= boundaryNoticeUntil;
  updateFieldHud(now);
}

function setView(view) {
  visualReviewOrbit = null;
  world.family.forEach((animal) => { animal.visible = true; });
  world.pterodactyls.forEach((animal) => { animal.visible = true; });
  cameraMode = view;
  world.fieldCamera.visible = view === 'field' || view === 'glade';
  world.rifle.visible = false;
  if (view === 'field' || view === 'order') {
    document.body.dataset.mode = view;
    fieldHud.hidden = view !== 'field';
    camera.fov = 70;
    setCameraToPlayer();
  } else if (view === 'glade') {
    document.body.dataset.mode = 'field';
    fieldHud.hidden = false;
    camera.position.set(12, 5.2, -9);
    camera.lookAt(new THREE.Vector3(1, 3.4, -49));
    camera.fov = 66;
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

function setVisualReviewOrbitCamera() {
  if (!visualReviewOrbit) return;
  const isIguanodon = visualReviewOrbit.subject === 'iguanodon';
  const subject = isIguanodon ? world.family[0] : world.pterodactyls[0];
  const target = subject.getWorldPosition(new THREE.Vector3());
  target.y += isIguanodon ? 2.15 * subject.scale.y : 0.1;
  const angle = THREE.MathUtils.degToRad(visualReviewOrbit.angleDegrees);
  const pterodactylWingView = Math.abs(Math.sin(angle)) > 0.7;
  const radius = isIguanodon ? 13.2 : pterodactylWingView ? 11.8 : 10.4;
  const lift = isIguanodon ? 2.15 : pterodactylWingView ? 1.2 : 1.05;
  camera.position.set(
    target.x + Math.sin(angle) * radius,
    target.y + lift,
    target.z + Math.cos(angle) * radius,
  );
  camera.lookAt(target);
  camera.fov = isIguanodon ? 44 : 50;
  camera.updateProjectionMatrix();
}

function inputSnapshot() {
  const snapshot = {
    forward: Number(pressed.has('KeyW')) - Number(pressed.has('KeyS')),
    right: Number(pressed.has('KeyD')) - Number(pressed.has('KeyA')),
    sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
    crouch: pressed.has('KeyC') || pressed.has('ControlLeft') || pressed.has('ControlRight'),
    jump: jumpQueued,
    heading: player.heading,
    pitch: player.pitch,
  };
  jumpQueued = false;
  return snapshot;
}

function clearTransientInput() {
  pressed.clear();
  jumpQueued = false;
  player = releaseTransientTools(player);
}

function pointerLockUnavailable(error) {
  pointerLockStatus = 'unavailable';
  pointerLockError = error instanceof Error ? error.message : String(error || 'Pointer lock unavailable');
  const qaMode = query.get('qa');
  if (qaMode && qaMode !== 'pointer-lock-rejection') return;
  if (runActive && !player.paused) pauseRun('pointer-lock-unavailable');
}

function requestFieldPointerLock() {
  pointerLockStatus = 'requesting';
  pointerLockError = null;
  try {
    const request = canvas.requestPointerLock();
    request?.catch?.(pointerLockUnavailable);
  } catch (error) {
    pointerLockUnavailable(error);
  }
}

function presentTerminal() {
  if (!player.result) return;
  emitCue(player.result.kind === 'alive' ? 'result' : 'failure', 3200);
  clearTransientInput();
  runActive = false;
  cameraMode = 'terminal';
  document.body.dataset.mode = 'terminal';
  document.body.dataset.camera = 'folded';
  document.body.dataset.rifle = 'lowered';
  terminalPanel.hidden = false;
  terminalPanel.dataset.kind = player.result.kind;
  pausePanel.hidden = true;
  document.querySelector('#field-order').hidden = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();

  terminalBoardSlots.forEach((slot, index) => {
    const plate = player.plates[index];
    slot.dataset.status = plate.status;
    slot.dataset.frame = plate.frameKey ?? 'empty';
    slot.dataset.cues = plate.status === 'exposed' ? `${plate.points} cue${plate.points === 1 ? '' : 's'}` : '';
    applyPlateImage(slot, plate.status === 'exposed' ? plateImages[index] : null);
    slot.setAttribute(
      'aria-label',
      `Plate ${ROMAN_PLATES[index]}: ${plate.status}${plate.label ? ` — ${plate.label}` : ''}`,
    );
  });

  if (player.result.kind === 'alive') {
    terminalEyebrow.textContent = 'WHAT REACHED CAMP';
    terminalTitle.textContent = player.result.title;
    terminalResultCopy.textContent = player.result.copy;
    terminalDetail.textContent = `${player.result.evidence} evidence cues · ${player.result.survivingPlates} recorded plates · ${player.result.route} return · ${Math.ceil(player.result.remainingLight)}s light`;
    terminalCallback.hidden = !player.result.gunshotCallback;
    terminalCallback.textContent = player.result.gunshotCallback ?? '';
  } else {
    terminalEyebrow.textContent = 'FIELD WORK ENDED';
    terminalTitle.textContent = player.result.title;
    terminalResultCopy.textContent = player.result.copy;
    terminalDetail.textContent = player.result.cue;
    terminalCallback.hidden = true;
    terminalCallback.textContent = '';
  }
}

function returnToFieldOrder() {
  clearTransientInput();
  player = createPlayerState();
  clearPlateImages();
  runActive = false;
  terminalPanel.hidden = true;
  closePanels();
  setView('order');
  document.querySelector('#field-order').hidden = false;
  void fieldAudio.pause();
}

function beginRun() {
  clearTransientInput();
  player = restartPlayer(player);
  clearPlateImages();
  fieldAudio.resetRun();
  runActive = true;
  observedBoundaryRecoveries = 0;
  boundaryNoticeUntil = 0;
  observationNoticeUntil = 0;
  contactNoticeUntil = 0;
  captionNoticeUntil = 0;
  pausePanel.hidden = true;
  terminalPanel.hidden = true;
  setView('field');
  void fieldAudio.start().then(() => showCaption('field-start', 2600));
  requestFieldPointerLock();
}

function pauseRun(reason = 'manual') {
  if (!runActive) return;
  clearTransientInput();
  player = setPaused(player, true, reason);
  pauseLabel.textContent = reason === 'window-inactive'
    ? 'PAUSED — WINDOW INACTIVE'
    : reason === 'pointer-lock-unavailable'
      ? 'POINTER LOCK UNAVAILABLE'
      : 'PAUSED';
  pausePanel.hidden = false;
  document.body.dataset.mode = 'paused';
  void fieldAudio.pause();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function resumeRun() {
  if (!runActive) return;
  clearTransientInput();
  player = setPaused(player, false);
  pausePanel.hidden = true;
  cameraMode = 'field';
  document.body.dataset.mode = 'field';
  void fieldAudio.resume();
  requestFieldPointerLock();
}

function worldRuntime(deltaSeconds = 0) {
  const threatAwareness = visualThreatOverride ?? player.threatAwareness;
  const attackSeconds = visualThreatOverride === null
    ? player.attackSeconds
    : visualThreatPose === 'dive'
      ? 1.1
      : visualElapsed % PTERODACTYL_ATTACK_CYCLE_SECONDS;
  return {
    threatAwareness,
    attackSeconds,
    playerPosition: player.position,
    shotCount: player.shotCount,
    brookResponse: player.brookResponse,
    inCover: player.inCover,
    familyMoment: visualThreatPose === 'family'
      ? 'glade-young-play'
      : player.pendingExposure?.key ?? null,
    captureThreatPose: visualThreatPose,
    pterodactylMorphPose: visualPterodactylMorphPose,
    quality: presentationSettings.quality,
    deltaSeconds,
  };
}

function update(deltaSeconds, now) {
  if (runActive && !player.paused) {
    const previousContacts = player.contactCount;
    const previousRunStatus = player.runStatus;
    const previousThreatState = player.threatState;
    const previousProofPlate = player.lastProofEvent?.plateIndex ?? -1;
    const previousRoute = player.returnRoute;
    const previousBrookResponse = player.brookResponse;
    player = stepPlayer(player, inputSnapshot(), deltaSeconds);
    if (player.threatState !== previousThreatState) {
      fieldAudio.setThreatState(player.threatState);
      if (player.threatState !== 'distant') showCaption(player.threatState);
    }
    if ((player.lastProofEvent?.plateIndex ?? -1) !== previousProofPlate) {
      emitCue('plate-slide');
    }
    if (player.returnRoute !== previousRoute && player.returnRoute === 'covered') emitCue('cover');
    if (player.brookResponse !== previousBrookResponse && player.brookResponse === 'brush-moving') {
      emitCue('brook-response', 3000);
    }
    if (player.contactCount > previousContacts) {
      emitCue('contact', 2800);
      contactNoticeUntil = now + 3200;
      const cracked = player.plates.find((plate) => plate.status === 'cracked');
      contactNote.textContent = cracked
        ? `CASE STRIKE — PLATE ${ROMAN_PLATES[cracked.index]} CRACKED.`
        : 'CASE STRIKE — THE NEXT PASS WILL END THE RUN.';
    }
    if (previousRunStatus === 'active' && player.runStatus !== 'active') presentTerminal();
    if (!visualTimeFrozen) visualElapsed += deltaSeconds;
  } else if (!runActive && cameraMode !== 'terminal') {
    if (!visualTimeFrozen) visualElapsed += deltaSeconds;
  }
  world.update(
    visualElapsed,
    reducedMotion || player.paused || cameraMode === 'terminal',
    worldRuntime(visualTimeFrozen ? 0 : deltaSeconds),
  );

  if (cameraMode === 'visual-review-orbit') setVisualReviewOrbitCamera();

  if (cameraMode === 'field' || cameraMode === 'order') {
    setCameraToPlayer(now);
  } else if (cameraMode === 'title' && !reducedMotion) {
    camera.position.x = titleCameraPosition.x + Math.sin(visualElapsed * 0.08) * 0.7;
    camera.lookAt(titleCameraTarget);
  }
}

function animate(frameTime) {
  const renderInterval = renderIntervalForState({
    runActive,
    cameraMode,
    paused: player.paused,
    hidden: document.hidden,
    activeFps: QUALITY_PROFILES[presentationSettings.quality].activeFps,
  });
  if (!shouldRenderFrame(frameTime, renderScheduleAt, renderInterval)) {
    skippedFrameCount += 1;
    requestAnimationFrame(animate);
    return;
  }
  renderScheduleAt = advanceRenderSchedule(frameTime, renderScheduleAt, renderInterval);
  lastRenderedAt = frameTime;
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  update(deltaSeconds, now);
  const capture = pendingPlateCapture;
  const cameraWasVisible = capture ? world.fieldCamera.visible : false;
  const rifleWasVisible = capture ? world.rifle.visible : false;
  if (capture) {
    world.fieldCamera.visible = false;
    world.rifle.visible = false;
  }
  composer.render();
  if (firstRenderedAt === null) hideLoading();
  if (capture) {
    pendingPlateCapture = null;
    encodeRenderedPlate(capture);
    world.fieldCamera.visible = cameraWasVisible;
    world.rifle.visible = rifleWasVisible;
  }
  renderedFrameCount += 1;
  frameSamples.push(now - lastFrame);
  if (frameSamples.length > 360) frameSamples.shift();
  lastFrame = now;
  firstRenderedAt ??= now;
  requestAnimationFrame(animate);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = qualityRenderPixelRatio(window.devicePixelRatio, presentationSettings.quality);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  fxaaPass.material.uniforms.resolution.value.set(
    1 / (width * pixelRatio),
    1 / (height * pixelRatio),
  );
  smaaPass.setSize(width * pixelRatio, height * pixelRatio);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function closePanels() {
  document.querySelector('#settings-panel').hidden = true;
  document.querySelector('#credits-panel').hidden = true;
}

async function enterBasin() {
  closePanels();
  requiredAssetsError.hidden = true;
  enterButton.disabled = true;
  showLoading('Preparing field camera, rifle and wildlife…', 'assets');
  try {
    await ensureHy3dVisuals();
    player = createPlayerState();
    setView('order');
    document.querySelector('#field-order').hidden = false;
    hideLoading();
  } catch (error) {
    hideLoading();
    clearTransientInput();
    runActive = false;
    requiredAssetsCopy.textContent = error instanceof Error
      ? error.message
      : 'A required local 3D asset could not be loaded.';
    document.querySelector('#field-order').hidden = true;
    requiredAssetsError.hidden = false;
    document.body.dataset.mode = 'asset-error';
  } finally {
    enterButton.disabled = false;
  }
}

enterButton.addEventListener('click', enterBasin);
document.querySelector('#retry-assets').addEventListener('click', enterBasin);
document.querySelector('#dismiss-order').addEventListener('click', () => {
  document.querySelector('#field-order').hidden = true;
  beginRun();
});
document.querySelector('#resume-button').addEventListener('click', resumeRun);
document.querySelector('#restart-button').addEventListener('click', beginRun);
document.querySelector('#terminal-restart').addEventListener('click', returnToFieldOrder);
document.querySelector('#settings-button').addEventListener('click', () => {
  closePanels();
  document.querySelector('#settings-panel').hidden = false;
});
document.querySelector('#credits-button').addEventListener('click', () => {
  closePanels();
  document.querySelector('#credits-panel').hidden = false;
});
document.querySelectorAll('.panel-close').forEach((button) => button.addEventListener('click', closePanels));
document.querySelector('#reduced-motion').addEventListener('change', (event) => {
  applyPresentationSettings({ ...presentationSettings, reducedMotion: event.currentTarget.checked });
});
document.querySelector('#captions-enabled').addEventListener('change', (event) => {
  applyPresentationSettings({ ...presentationSettings, captionsEnabled: event.currentTarget.checked });
});
for (const channel of ['ambience', 'effects', 'music']) {
  document.querySelector(`#${channel}-volume`).addEventListener('input', (event) => {
    applyPresentationSettings({
      ...presentationSettings,
      volumes: { ...presentationSettings.volumes, [channel]: event.currentTarget.value },
    });
  });
}
document.querySelector('#text-scale').addEventListener('change', (event) => {
  applyPresentationSettings({ ...presentationSettings, textScale: event.currentTarget.value });
});
document.querySelector('#visual-quality').addEventListener('change', (event) => {
  applyPresentationSettings({ ...presentationSettings, quality: event.currentTarget.value });
});
document.querySelector('#look-sensitivity').addEventListener('input', (event) => {
  applyPresentationSettings({ ...presentationSettings, lookSensitivity: event.currentTarget.value });
});
document.querySelector('#settings-reset').addEventListener('click', () => {
  clearSettings(window.localStorage);
  applyPresentationSettings(normalizeSettings({}, systemReducedMotion), false);
});

applyPresentationSettings(presentationSettings, false);

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP' && !event.repeat && runActive) {
    if (player.paused) resumeRun();
    else pauseRun('manual');
    return;
  }
  if (event.code === 'KeyE' && !event.repeat && runActive && !player.paused) {
    const previousObservation = player.lastObservation;
    player = examine(player);
    if (player.lastObservation && player.lastObservation !== previousObservation) {
      observationNoticeUntil = performance.now() + 1400;
      emitCue('examine');
    }
    return;
  }
  if (event.code === 'KeyF' && runActive && !player.paused) {
    player = setRifleRaised(player, true);
    return;
  }
  const captureGameplayKey = shouldCaptureGameplayKey(event.code, {
    runActive,
    paused: player.paused,
    cameraMode,
  });
  if (captureGameplayKey && event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
    return;
  }
  if (captureGameplayKey) pressed.add(event.code);
});
document.addEventListener('keyup', (event) => {
  if (event.code === 'KeyF') player = setRifleRaised(player, false);
  pressed.delete(event.code);
});
document.addEventListener('mousedown', (event) => {
  if (!runActive || player.paused || cameraMode !== 'field') return;
  if (event.button === 2) {
    event.preventDefault();
    const wasRaised = player.cameraRaised;
    player = setCameraRaised(player, true);
    if (!wasRaised && player.cameraRaised) emitCue('camera-raise');
  } else if (event.button === 0 && player.rifleRaised) {
    event.preventDefault();
    const previousShotCount = player.shotCount;
    player = fireDefensiveShot(player);
    if (player.shotCount > previousShotCount) {
      fieldAudio.setThreatState(player.threatState);
      emitCue('rifle', 3200);
      contactNoticeUntil = performance.now() + 2600;
      contactNote.textContent = player.lastThreatEvent === 'defensive-shot-interrupt'
        ? 'RIFLE REPORT — THE DIVE SHEARS AWAY.'
        : 'RIFLE REPORT — THE DIVE WAS NOT COMMITTED.';
    }
  } else if (event.button === 0 && player.cameraRaised) {
    event.preventDefault();
    const hadPendingExposure = Boolean(player.pendingExposure);
    player = startExposure(player);
    if (!hadPendingExposure && player.pendingExposure) {
      queuePlateCapture(player.pendingExposure.plateIndex);
      emitCue('shutter');
    }
  }
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 2) player = setCameraRaised(player, false);
});
document.addEventListener('contextmenu', (event) => {
  if (runActive && !player.paused) event.preventDefault();
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || player.paused || cameraMode !== 'field') return;
  const orientation = applyLookDelta(player, event, {
    horizontal: 0.002 * presentationSettings.lookSensitivity,
    vertical: 0.0016 * presentationSettings.lookSensitivity,
  });
  player.heading = orientation.heading;
  player.pitch = orientation.pitch;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    pointerLockStatus = 'locked';
    pointerLockError = null;
    return;
  }
  if (runActive && !player.paused && document.pointerLockElement !== canvas) {
    pointerLockStatus = 'lost';
    pauseRun('pointer-lock');
  }
});
document.addEventListener('pointerlockerror', () => {
  pointerLockUnavailable(new Error('The browser denied pointer lock. Click Resume field work to retry.'));
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
  let previousRenderAt = null;
  let observedFrameCount = renderedFrameCount;
  await new Promise((resolve) => {
    const take = () => {
      if (renderedFrameCount !== observedFrameCount) {
        if (previousRenderAt !== null) samples.push(lastRenderedAt - previousRenderAt);
        previousRenderAt = lastRenderedAt;
        observedFrameCount = renderedFrameCount;
      }
      if (samples.length >= count) resolve();
      else requestAnimationFrame(take);
    };
    requestAnimationFrame(take);
  });
  const p50Ms = percentile(samples, 0.5);
  const lowFps = onePercentLowFps(samples);
  return {
    samples: samples.length,
    medianFrameMs: Number(p50Ms.toFixed(2)),
    medianFps: Number((1000 / p50Ms).toFixed(1)),
    onePercentLowFps: Number(lowFps.toFixed(1)),
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
    velocity: {
      x: Number((player.velocity?.x ?? 0).toFixed(3)),
      z: Number((player.velocity?.z ?? 0).toFixed(3)),
    },
    groundY: Number(player.groundY.toFixed(3)),
    verticalOffset: Number((player.verticalOffset ?? 0).toFixed(3)),
    verticalVelocity: Number((player.verticalVelocity ?? 0).toFixed(3)),
    grounded: player.grounded,
    heading: Number(player.heading.toFixed(4)),
    pitch: Number(player.pitch.toFixed(4)),
    elapsedSeconds: Number(player.elapsedSeconds.toFixed(3)),
    distanceTravelled: Number(player.distanceTravelled.toFixed(3)),
    remainingLight: Number(player.remainingLight.toFixed(3)),
  };
}

window.__projectPlateau = {
  stage: 'current-complete-run',
  ready: true,
  renderer: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'unsupported',
  productBudget: PRODUCT_BUDGET,
  sceneBudget: SCENE_BUDGET,
  setView,
  sampleFrames,
  renderFrameForTest() {
    if (!query.has('qa')) throw new Error('renderFrameForTest requires a qa query');
    composer.render();
    return true;
  },
  loadHy3dVisualsForTest() {
    if (!query.has('qa')) throw new Error('loadHy3dVisualsForTest requires a qa query');
    return ensureHy3dVisuals();
  },
  loadingSnapshot() {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      timeToFirstFrameMs: firstRenderedAt === null ? null : Number(firstRenderedAt.toFixed(2)),
      domInteractiveMs: navigation ? Number(navigation.domInteractive.toFixed(2)) : null,
      loadEventMs: navigation ? Number(navigation.loadEventEnd.toFixed(2)) : null,
      resourceCount: performance.getEntriesByType('resource').length,
      ui: loadingScreenSnapshot(),
    };
  },
  pause: pauseRun,
  resume: resumeRun,
  restart: beginRun,
  plateImageForTest(index) {
    if (!query.has('qa')) throw new Error('plateImageForTest requires a qa query');
    return plateImages[index] ?? null;
  },
  setVisualReviewOrbitForTest({ subject, angleDegrees = 0 }) {
    if (!query.has('qa')) throw new Error('setVisualReviewOrbitForTest requires a qa query');
    if (subject !== 'iguanodon' && subject !== 'pterodactyl') {
      throw new Error(`Unsupported visual-review subject: ${subject}`);
    }
    visualReviewOrbit = { subject, angleDegrees: Number(angleDegrees) || 0 };
    cameraMode = 'visual-review-orbit';
    document.body.dataset.mode = 'review';
    document.body.dataset.camera = 'folded';
    document.body.dataset.rifle = 'lowered';
    fieldHud.hidden = true;
    world.fieldCamera.visible = false;
    world.rifle.visible = false;
    world.family.forEach((animal, index) => { animal.visible = subject === 'iguanodon' && index === 0; });
    world.pterodactyls.forEach((animal, index) => { animal.visible = subject === 'pterodactyl' && index === 0; });
    setVisualReviewOrbitCamera();
    return { ...visualReviewOrbit };
  },
  setPterodactylMorphPoseForTest(pose = {}) {
    if (!query.has('qa')) throw new Error('setPterodactylMorphPoseForTest requires a qa query');
    const normalized = Object.fromEntries(['wingUp', 'wingDown', 'diveFold'].map((target) => (
      [target, THREE.MathUtils.clamp(Number(pose[target]) || 0, 0, 1)]
    )));
    visualPterodactylMorphPose = normalized;
    visualTimeFrozen = true;
    world.update(visualElapsed, reducedMotion, worldRuntime(0));
    if (cameraMode === 'visual-review-orbit') setVisualReviewOrbitCamera();
    return normalized;
  },
  teleportForTest(position) {
    if (!query.has('qa')) throw new Error('teleportForTest requires a qa query');
    player.position = { x: position.x, z: position.z };
    player.lastStablePosition = { ...player.position };
    player.groundY = terrainHeight(player.position.x, player.position.z);
    player.verticalOffset = 0;
    player.verticalVelocity = 0;
    player.grounded = true;
    player.velocity = { x: 0, z: 0 };
    if (Number.isFinite(position.heading)) player.heading = position.heading;
    if (Number.isFinite(position.pitch)) player.pitch = position.pitch;
    setCameraToPlayer();
  },
  advanceTimeForTest(seconds) {
    if (!query.has('qa')) throw new Error('advanceTimeForTest requires a qa query');
    let remaining = Math.max(0, Number(seconds) || 0);
    while (remaining > 0 && player.runStatus === 'active') {
      const delta = Math.min(1, remaining);
      player = stepPlayer(player, {}, delta);
      remaining -= delta;
    }
    if (player.runStatus !== 'active') presentTerminal();
    return playerSnapshot();
  },
  freezeVisualForTest(seconds = 4.25, useReducedMotion = true) {
    if (!query.has('qa')) throw new Error('freezeVisualForTest requires a qa query');
    visualElapsed = Math.max(0, Number(seconds) || 0);
    visualTimeFrozen = true;
    world.update(visualElapsed, Boolean(useReducedMotion), worldRuntime(0));
    return visualElapsed;
  },
  setThreatVisualForTest(awareness = null, pose = null) {
    if (!query.has('qa')) throw new Error('setThreatVisualForTest requires a qa query');
    visualThreatOverride = awareness === null
      ? null
      : Math.max(0, Math.min(3, Number(awareness) || 0));
    visualThreatPose = pose;
    world.update(visualElapsed, true, worldRuntime(0));
    return visualThreatOverride;
  },
  snapshot() {
    camera.updateMatrixWorld();
    const cameraForward = camera.getWorldDirection(new THREE.Vector3());
    return {
      stage: this.stage,
      mode: document.body.dataset.mode,
      cameraMode,
      visualReviewOrbit,
      runActive,
      pointerLock: {
        active: document.pointerLockElement === canvas,
        status: pointerLockStatus,
        error: pointerLockError,
        cameraForward: {
          x: Number(cameraForward.x.toFixed(4)),
          y: Number(cameraForward.y.toFixed(4)),
          z: Number(cameraForward.z.toFixed(4)),
        },
      },
      renderer: this.renderer,
      player: playerSnapshot(),
      threatVisual: world.threatSnapshot(),
      familyVisual: world.familySnapshot(),
      brookResponseVisual: world.brookResponseSnapshot(),
      assets: world.assetSnapshot(),
      collision: collisionContractSnapshot(),
      audio: fieldAudio.snapshot(),
      presentationSettings: {
        ...presentationSettings,
        volumes: { ...presentationSettings.volumes },
        storageKey: SETTINGS_STORAGE_KEY,
      },
      ui: {
        prompt: contextPrompt.hidden ? null : contextPrompt.textContent,
        cameraOverlay: !cameraOverlay.hidden,
        rifleOverlay: player.rifleRaised && world.rifle.visible,
        plateRail: !plateRail.hidden,
        platePreview: platePreview.hidden ? null : previewCopy.textContent,
        capturedPlateImages: plateImages.map(Boolean),
        fieldNote: fieldNote.hidden ? null : fieldNote.textContent,
        contactNote: contactNote.hidden ? null : contactNote.textContent,
        cartridgesVisible: !cartridgeDisplay.hidden,
        caption: captionLine.hidden ? null : captionLine.textContent,
        lightWatch: lightWatch.hidden ? null : Number(lightSeconds.textContent),
        terminal: terminalPanel.hidden
          ? null
          : {
              kind: terminalPanel.dataset.kind,
              title: terminalTitle.textContent,
              copy: terminalResultCopy.textContent,
              detail: terminalDetail.textContent,
              callback: terminalCallback.hidden ? null : terminalCallback.textContent,
            },
      },
      plateCapture: {
        status: plateCaptureStatus,
        durationMs: plateCaptureDurationMs,
        error: plateCaptureError,
      },
      sceneChildren: scene.children.length,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      viewport: [window.innerWidth, window.innerHeight],
      renderBudget: {
        pixelRatio: renderer.getPixelRatio(),
        maxPixelRatio: MAX_RENDER_PIXEL_RATIO,
        quality: presentationSettings.quality,
        activeFpsCap: QUALITY_PROFILES[presentationSettings.quality].activeFps,
        renderedFrames: renderedFrameCount,
        skippedFrames: skippedFrameCount,
        activeFpsPolicy: '60fps-cap-across-refresh-rates',
        idleFpsCap: 30,
        pausedFpsCap: 15,
        hiddenFpsCap: 4,
        powerPreference: 'default',
        preserveDrawingBuffer: false,
        gtaoSamples: 4,
        antialiasing: presentationSettings.quality === 'high' ? 'smaa' : 'single-pass-fxaa',
      },
      firstRenderedAt,
      recentMedianFrameMs: Number(percentile(frameSamples, 0.5).toFixed(2)),
    };
  },
};

setView(query.get('view') === 'glade' || query.get('qa') === 's0' ? 'glade' : 'title');
if (query.has('qa')) void ensureHy3dVisuals();
requestAnimationFrame(animate);
