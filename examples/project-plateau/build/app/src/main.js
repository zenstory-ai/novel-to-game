import * as THREE from 'three';
import {
  SUN_DIRECTION,
  applyAtmosphereEnvironment,
  createAtmosphere,
} from './atmosphere.js';
import { FieldAudio, captionForCue } from './audio.js';
import { applyLookDelta, shouldCaptureGameplayKey } from './controller.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';
import { createFieldLighting } from './field-lighting.js';
import { createFieldPostprocessing } from './field-postprocessing.js';
import { createHeightFogController } from './height-fog.js';
import {
  QUALITY_PROFILES,
  advanceRenderSchedule,
  qualityRenderPixelRatio,
  renderIntervalForState,
  shouldRenderFrame,
} from './render-budget.js';
import {
  clearSettings,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from './settings.js';
import {
  ABANDON_HOLD_SECONDS,
  EXPOSURE_SECONDS,
  abandonPromptDue,
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
import { createViewmodelController } from './viewmodel.js';
import { createWorld } from './world.js';
import { hideLoading, showLoading } from './loading-screen.js';

const canvas = document.querySelector('#game-canvas');
const runtimeError = document.querySelector('#runtime-error');
const runtimeErrorCopy = document.querySelector('#runtime-error-copy');
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
renderer.toneMappingExposure = DAYLIGHT_ENERGY_PROFILE.toneMappingExposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x122c34);
scene.fog = new THREE.FogExp2(0x58716f, DAYLIGHT_ENERGY_PROFILE.fogDensityPerMeter);
const atmosphere = createAtmosphere(scene);
const atmosphereEnvironment = applyAtmosphereEnvironment(scene, renderer);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
const titleCameraPosition = new THREE.Vector3(18, 7.6, 55);
const titleCameraTarget = new THREE.Vector3(-1, 3.2, -34);

const { sun } = createFieldLighting(scene);
const world = createWorld(scene);
const heightFog = createHeightFogController(camera, SUN_DIRECTION);
heightFog.applyTo(scene);
atmosphere.userData.applyCloudShadowsTo(scene);
let hy3dVisualPromise = null;
function ensureHy3dVisuals() {
  if (!hy3dVisualPromise) {
    hy3dVisualPromise = world.enableHy3dVisuals()
      .then((result) => {
        heightFog.applyTo(scene);
        atmosphere.userData.applyCloudShadowsTo(scene);
        world.requestBrookReflectionRefresh();
        return result;
      })
      .catch((error) => {
        hy3dVisualPromise = null;
        throw error;
      });
  }
  return hy3dVisualPromise;
}
const {
  composer,
  gtaoPass,
  fxaaPass,
  smaaPass,
} = createFieldPostprocessing({
  renderer,
  scene,
  camera,
  excludedRoots: [world.fieldCamera, world.rifle],
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: qualityRenderPixelRatio(window.devicePixelRatio, presentationSettings.quality),
});
scene.add(camera);
camera.add(world.fieldCamera);
camera.add(world.rifle);
const viewmodel = createViewmodelController({
  fieldCamera: world.fieldCamera,
  rifle: world.rifle,
});
const clock = new THREE.Clock();
const fieldAudio = new FieldAudio();
const pressed = new Set();
let jumpQueued = false;
let player = createPlayerState();
let smoothedEyeHeight = 3.45;
let lastCameraMotionAt = null;
let runActive = false;
let cameraMode = 'title';
let renderScheduleAt = 0;
let renderedFrameCount = 0;
let firstRenderedAt = null;
let visualElapsed = 0;

let boundaryNoticeUntil = 0;
let observedBoundaryRecoveries = 0;
let observationNoticeUntil = 0;
let contactNoticeUntil = 0;
let captionNoticeUntil = 0;

const ROMAN_PLATES = ['I', 'II', 'III', 'IV'];
let plateImages = Array(ROMAN_PLATES.length).fill(null);
let plateCaptureGeneration = 0;
let pendingPlateCapture = null;

function applyPlateImage(element, image) {
  element.dataset.captured = image ? 'true' : 'false';
  element.style.backgroundImage = image ? `url("${image}")` : '';
}

function clearPlateImages() {
  plateCaptureGeneration += 1;
  pendingPlateCapture = null;
  plateImages = Array(ROMAN_PLATES.length).fill(null);
  applyPlateImage(previewImage, null);
  terminalBoardSlots.forEach((slot) => applyPlateImage(slot, null));
}

let droppedCase = null;

function hideDroppedCase() {
  if (!droppedCase) return;
  scene.remove(droppedCase);
  droppedCase.traverse((object) => {
    if (object.isMesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  droppedCase = null;
}

function showDroppedCase(position, heading) {
  hideDroppedCase();
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.2, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.88, metalness: 0.04 }),
  );
  body.position.y = 0.1;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.05, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x5a422c, roughness: 0.82, metalness: 0.04 }),
  );
  lid.position.y = 0.225;
  const latch = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.05, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xa8874e, roughness: 0.42, metalness: 0.6 }),
  );
  latch.position.set(0, 0.18, 0.24);
  group.add(body, lid, latch);
  group.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  // The scout casts the case forward off the shoulder so the drop lands inside
  // a level first-person view (the eye sits ~3.45m above the ground plane).
  const landingX = position.x - Math.sin(heading) * 5.6;
  const landingZ = position.z - Math.cos(heading) * 5.6;
  group.position.set(landingX, terrainHeight(landingX, landingZ) + 0.02, landingZ);
  group.rotation.y = heading + 0.45;
  scene.add(group);
  droppedCase = group;
}

function queuePlateCapture(plateIndex) {
  pendingPlateCapture = {
    plateIndex,
    generation: plateCaptureGeneration,
  };
}

function encodeRenderedPlate(capture) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const reader = new FileReader();
    reader.addEventListener('loadend', () => {
      if (capture.generation !== plateCaptureGeneration) return;
      plateImages[capture.plateIndex] = typeof reader.result === 'string' ? reader.result : null;
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

const ABANDON_PROMPT_COPY = 'Drop the case and run [Hold G] — the plates stay in the basin.';

function contextualCopy() {
  if (player.pendingExposure) return 'Hold steady.';
  if (player.cameraRaised) return 'Hold steady. Release the shutter [Left Mouse]';
  if (player.threatState === 'attack') return 'Hold rifle [F] · Fire before contact [Left Mouse]';
  // A held release must always show its progress, even where the prompt is not due.
  if (!player.caseAbandoned && player.abandonHoldSeconds > 0) return ABANDON_PROMPT_COPY;
  if (abandonPromptDue(player)) return ABANDON_PROMPT_COPY;
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
  const holdProgress = !player.caseAbandoned && player.abandonHoldSeconds > 0
    ? Math.min(1, player.abandonHoldSeconds / ABANDON_HOLD_SECONDS)
    : 0;
  contextPrompt.style.setProperty('--hold-progress', `${(holdProgress * 100).toFixed(1)}%`);
  // The complete legend is onboarding, not a permanent debug bar. Keep it on
  // the first controllable metres, then let contextual prompts own the HUD.
  const controlsLearned = player.distanceTravelled >= 5
    || player.position.z < 60
    || player.threatAwareness >= 1
    || cameraMode === 'glade';
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

  plateRail.hidden = !player.plateRailRevealed || player.caseAbandoned;
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
    && !player.caseAbandoned
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
    && !player.cameraRaised
    && !player.caseAbandoned;
  world.rifle.visible = runActive && !player.failed && player.rifleRaised;
  viewmodel.update(now, player, reducedMotion);
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

function inputSnapshot() {
  const snapshot = {
    forward: Number(pressed.has('KeyW')) - Number(pressed.has('KeyS')),
    right: Number(pressed.has('KeyD')) - Number(pressed.has('KeyA')),
    sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
    crouch: pressed.has('KeyC') || pressed.has('ControlLeft') || pressed.has('ControlRight'),
    abandon: pressed.has('KeyG'),
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

function pointerLockUnavailable() {
  const qaMode = query.get('qa');
  if (qaMode && qaMode !== 'pointer-lock-rejection') return;
  if (runActive && !player.paused) pauseRun('pointer-lock-unavailable');
}

function requestFieldPointerLock() {
  try {
    const request = canvas.requestPointerLock();
    request?.catch?.(pointerLockUnavailable);
  } catch {
    pointerLockUnavailable();
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
    const leftInBasin = player.result.caseAbandoned === true;
    slot.dataset.status = leftInBasin ? 'abandoned' : plate.status;
    slot.dataset.frame = plate.frameKey ?? 'empty';
    slot.dataset.cues = !leftInBasin && plate.status === 'exposed' ? `${plate.points} cue${plate.points === 1 ? '' : 's'}` : '';
    applyPlateImage(slot, !leftInBasin && plate.status === 'exposed' ? plateImages[index] : null);
    slot.setAttribute(
      'aria-label',
      leftInBasin
        ? `Plate ${ROMAN_PLATES[index]}: left in the basin${plate.label ? ` — ${plate.label}` : ''}`
        : `Plate ${ROMAN_PLATES[index]}: ${plate.status}${plate.label ? ` — ${plate.label}` : ''}`,
    );
  });

  if (player.result.kind === 'alive') {
    terminalEyebrow.textContent = 'WHAT REACHED CAMP';
    terminalTitle.textContent = player.result.title;
    terminalResultCopy.textContent = player.result.copy;
    terminalDetail.textContent = player.result.caseAbandoned
      ? `${player.result.evidence} evidence cues · ${player.result.survivingPlates} recorded plates · ${player.result.abandonedPlates} exposed plate${player.result.abandonedPlates === 1 ? '' : 's'} left in the basin · ${player.result.route} return · ${Math.ceil(player.result.remainingLight)}s light`
      : `${player.result.evidence} evidence cues · ${player.result.survivingPlates} recorded plates · ${player.result.route} return · ${Math.ceil(player.result.remainingLight)}s light`;
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
  hideDroppedCase();
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
  hideDroppedCase();
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
  return {
    threatAwareness: player.threatAwareness,
    attackSeconds: player.attackSeconds,
    playerPosition: player.position,
    shotCount: player.shotCount,
    brookResponse: player.brookResponse,
    inCover: player.inCover,
    familyMoment: player.pendingExposure?.key ?? null,
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
    const previousCaseAbandoned = player.caseAbandoned;
    player = stepPlayer(player, inputSnapshot(), deltaSeconds);
    if (player.threatState !== previousThreatState) {
      fieldAudio.setThreatState(player.threatState);
      if (player.threatState !== 'distant') showCaption(player.threatState);
    }
    if ((player.lastProofEvent?.plateIndex ?? -1) !== previousProofPlate) {
      emitCue('plate-slide');
    }
    if (player.returnRoute !== previousRoute && player.returnRoute === 'covered') emitCue('cover');
    if (!previousCaseAbandoned && player.caseAbandoned) {
      emitCue('case-drop', 3000);
      observationNoticeUntil = now + 3400;
      showDroppedCase(player.caseDropPosition ?? player.position, player.heading);
    }
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
    visualElapsed += deltaSeconds;
  } else if (!runActive && cameraMode !== 'terminal') {
    visualElapsed += deltaSeconds;
  }
  world.update(
    visualElapsed,
    reducedMotion || player.paused || cameraMode === 'terminal',
    worldRuntime(deltaSeconds),
  );
  atmosphere.userData.update(
    visualElapsed,
    reducedMotion || player.paused || cameraMode === 'terminal',
    presentationSettings.quality,
  );


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
    requestAnimationFrame(animate);
    return;
  }
  renderScheduleAt = advanceRenderSchedule(frameTime, renderScheduleAt, renderInterval);
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
  world.prepareBrookRender(
    renderer,
    camera,
    presentationSettings.quality,
    renderedFrameCount,
  );
  composer.render();
  if (firstRenderedAt === null) hideLoading();
  if (capture) {
    pendingPlateCapture = null;
    encodeRenderedPlate(capture);
    world.fieldCamera.visible = cameraWasVisible;
    world.rifle.visible = rifleWasVisible;
  }
  renderedFrameCount += 1;
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
  runtimeError.hidden = true;
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
    runtimeErrorCopy.textContent = error instanceof Error
      ? error.message
      : 'A required local 3D asset could not be loaded.';
    document.querySelector('#field-order').hidden = true;
    document.querySelector('#retry-runtime').hidden = false;
    runtimeError.hidden = false;
    document.body.dataset.mode = 'runtime-error';
  } finally {
    enterButton.disabled = false;
  }
}

enterButton.addEventListener('click', enterBasin);
document.querySelector('#retry-runtime').addEventListener('click', enterBasin);
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
    return;
  }
  if (runActive && !player.paused && document.pointerLockElement !== canvas) {
    pauseRun('pointer-lock');
  }
});
document.addEventListener('pointerlockerror', () => {
  pointerLockUnavailable();
});
canvas.addEventListener('click', () => {
  if (runActive && !player.paused && cameraMode === 'field') requestFieldPointerLock();
});
window.addEventListener('blur', () => pauseRun('window-inactive'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseRun('window-inactive');
});

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
  snapshot() {
    return {
      stage: this.stage,
      mode: document.body.dataset.mode,
      cameraMode,
      runActive,
      renderer: this.renderer,
      player: playerSnapshot(),
      sceneChildren: scene.children.length,
      triangles: renderer.info.render.triangles,
    };
  },
};

setView(query.get('view') === 'glade' ? 'glade' : 'title');
requestAnimationFrame(animate);
