import * as THREE from 'three';
import {
  SUN_DIRECTION,
  applyAtmosphereEnvironment,
  createAtmosphere,
} from './atmosphere.js';
import { FieldAudio, captionForCue } from './audio.js';
import { applyLookDelta, shouldCaptureGameplayKey } from './controller.js';
import { DAYLIGHT_ENERGY_PROFILE } from './daylight-energy.js';
import {
  daylightCondition,
  frameConditionCopy,
  gradeForPlate,
  nextBandCopy,
  noteForPlate,
  verdictForPlate,
  routeConsequence,
} from './field-journal.js';
import { PLATE_WINDOW, createFrameEvidenceProbe } from './frame-evidence.js';
import { createFieldLighting } from './field-lighting.js';
import { createDaylightClock } from './daylight-clock.js';
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
  CONTACT_SECONDS,
  EXPOSURE_SECONDS,
  INITIAL_LIGHT_SECONDS,
  MAX_STEADY_DRIFT_RADIANS,
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
import { brookFluvialProcessAt, terrainHeight } from './terrain.js';
import { createViewmodelController } from './viewmodel.js';
import { createWorld } from './world.js';
import { createGrassField } from './grass-field.js';
import { createFieldMotes } from './field-motes.js';
import { createStegosaurus } from './stegosaurus.js';
import { stegosaurusPose } from './stegosaurus-path.js';
import { hideLoading, showLoading } from './loading-screen.js';
import { createFrameCommitGate } from './frame-commit-gate.js';
import { COVER_BAND } from './environment-layout.js';

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
const previewGrade = document.querySelector('#preview-grade');
const previewVerdict = document.querySelector('#preview-verdict');
const terminalLedger = document.querySelector('#terminal-ledger');
const contactNote = document.querySelector('#contact-note');
const plateRail = document.querySelector('#plate-rail');
const plateSlots = [...plateRail.children];
const cartridgeDisplay = document.querySelector('#cartridge-display');
const cartridgeSlots = [...cartridgeDisplay.children];
const captionLine = document.querySelector('#caption-line');
const lightWatch = document.querySelector('#light-watch');
const lightSeconds = document.querySelector('#light-seconds');
const lightBar = document.querySelector('#light-bar');
const terminalPanel = document.querySelector('#terminal-panel');
const terminalBoardSlots = [...terminalPanel.querySelector('.terminal-board').children];
const terminalEyebrow = document.querySelector('#terminal-eyebrow');
const terminalTitle = document.querySelector('#terminal-title');
const terminalResultCopy = document.querySelector('#terminal-result-copy');
const terminalDetail = document.querySelector('#terminal-detail');
const terminalCallback = document.querySelector('#terminal-callback');
const terminalNext = document.querySelector('#terminal-next');
document.querySelector('#build-badge').textContent = 'Challenger expedition · field copy';
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
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = DAYLIGHT_ENERGY_PROFILE.toneMappingExposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb4c2);
scene.fog = new THREE.FogExp2(0x8fb0b8, DAYLIGHT_ENERGY_PROFILE.fogDensityPerMeter);
const atmosphere = createAtmosphere(scene);
const atmosphereEnvironment = applyAtmosphereEnvironment(scene, renderer);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
// Hold the title close to the scout's eventual eye line. The earlier high,
// distant survey angle exposed too much empty foreground and made the basin
// read like a level editor overview instead of a dangerous field photograph.
const titleCameraPosition = new THREE.Vector3(-3.5, 1.7, 16);
const titleCameraTarget = new THREE.Vector3(0, 1.2, -33);

const { sun, hemisphere, follow: followSunShadow } = createFieldLighting(scene);
const daylight = createDaylightClock({
  scene, renderer, sun, hemisphere, environment: atmosphereEnvironment,
});
const world = createWorld(scene);
const grassField = createGrassField(scene, world.terrain);
const fieldMotes = createFieldMotes(scene);
const stegosaurus = createStegosaurus(scene);
const heightFog = createHeightFogController(camera, SUN_DIRECTION);
heightFog.applyTo(scene);
let hy3dVisualPromise = null;
function ensureHy3dVisuals() {
  if (!hy3dVisualPromise) {
    hy3dVisualPromise = Promise.all([world.enableHy3dVisuals(), stegosaurus.load()])
      .then(async ([result]) => {
        heightFog.applyTo(scene);
        world.requestBrookReflectionRefresh();
        await prewarmShaders();
        return result;
      })
      .catch((error) => {
        hy3dVisualPromise = null;
        throw error;
      });
  }
  return hy3dVisualPromise;
}
const frameProbe = createFrameEvidenceProbe({
  camera,
  terrainHeight,
  subjects: () => [
    ...world.family.map((animal) => ({
      subject: 'iguanodon', role: animal.userData.behaviorRole, object: animal,
    })),
    { subject: 'stegosaurus', object: stegosaurus.anchor },
    { subject: 'pterodactyl', object: world.pterodactyls[0] },
  ],
  occluders: () => world.plateOccluders,
  lensFov: () => (player.cameraRaised ? RAISED_CAMERA_FOV : null),
});
// Only measure the glass when a plate or the family reading depends on it.
function measureFrameEvidence(canopy = false) {
  const needed = player.cameraRaised
    || player.pendingExposure
    || (player.zone === 'iguanodon-glade' && !player.observedBehavior);
  return needed ? frameProbe.measure({ canopy }) : [];
}
const {
  composer,
  gradePass,
  gtaoPass,
  fxaaPass,
  smaaPass,
} = createFieldPostprocessing({
  renderer,
  scene,
  camera,
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: qualityRenderPixelRatio(window.devicePixelRatio, presentationSettings.quality),
});
scene.add(camera);
camera.add(world.fieldCamera);
camera.add(world.rifle);
let threatPulse = 0;
// Redundant tension cue beside call, shadow and flight path: the frame edges
// close in and lose colour while a dive is committed. Never the only signal.
function composerThreat(state) {
  const target = !runActive || state.paused ? 0
    : state.threatState === 'attack' ? 1 : state.threatState === 'search' ? 0.35 : 0;
  threatPulse += (target - threatPulse) * 0.08;
  gradePass.uniforms.threat.value = threatPulse;
  gradePass.uniforms.time.value = visualElapsed;
}
const viewmodel = createViewmodelController({
  fieldCamera: world.fieldCamera,
  rifle: world.rifle,
});
const clock = new THREE.Timer();
const listenerForward = new THREE.Vector3();
const fieldAudio = new FieldAudio();
const pressed = new Set();
// Right mouse or Q: either held keeps the camera up.
const cameraHolds = new Set();
let jumpQueued = false;
let player = createPlayerState();
let smoothedEyeHeight = 1.8;
let lastCameraMotionAt = null;
let runActive = false;
let cameraMode = 'title';
let renderScheduleAt = 0;
let renderedFrameCount = 0;
let stillFrameDirty = true;
let firstRenderedAt = null;
let visualElapsed = 0;
const assetFrameCommit = createFrameCommitGate();

let boundaryNoticeUntil = 0;
let observedBoundaryRecoveries = 0;
let observationNoticeUntil = 0;
let contactNoticeUntil = 0;
let captionNoticeUntil = 0;
let lastStegosaurusPhase = 'absent';
let coverCaptionAllowedAt = 0;
let crackedPreviewIndex = -1;
let crackedPreviewUntil = 0;

function renderGrade(list, plate) {
  list.replaceChildren(...gradeForPlate(plate).map(({ label, good }) => {
    const item = document.createElement('li');
    item.textContent = label;
    item.dataset.good = good === null ? 'neutral' : good ? 'true' : 'false';
    return item;
  }));
}

const ROMAN_PLATES = ['I', 'II', 'III', 'IV'];
// A period long-focus lens: raising the camera narrows the view enough that
// framing an animal is a real decision.
const RAISED_CAMERA_FOV = 26;
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

// The dropped case is built once, hidden, so leaving it in the basin never
// creates materials (and shader links) in the middle of a run.
const droppedCase = (() => {
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
  group.visible = false;
  scene.add(group);
  return group;
})();

function hideDroppedCase() {
  droppedCase.visible = false;
}

function showDroppedCase(position, heading) {
  // The scout casts the case forward off the shoulder so the drop lands inside
  // a level first-person view.
  const landingX = position.x - Math.sin(heading) * 5.6;
  const landingZ = position.z - Math.cos(heading) * 5.6;
  droppedCase.position.set(landingX, terrainHeight(landingX, landingZ) + 0.02, landingZ);
  droppedCase.rotation.y = heading + 0.45;
  droppedCase.visible = true;
}

// Link every shader the run can show while the loading card is still up: the
// stegosaurus, the dropped case and the dive are revealed for one compile and
// one throwaway frame, then put back as they were.
async function prewarmShaders() {
  const revealed = [stegosaurus.anchor, droppedCase, ...world.pterodactyls].map((object) => {
    const before = { object, visible: object.visible, culled: [] };
    object.visible = true;
    object.traverse((child) => {
      if (!child.isMesh) return;
      before.culled.push([child, child.frustumCulled]);
      child.frustumCulled = false;
    });
    return before;
  });
  // Everything else hidden at the title (field viewmodel, boulders, the hero
  // tree) is compiled here too, so the first click into the field does not
  // stall on new programs. Lights stay as they are: they change every key.
  const hidden = [];
  scene.traverse((object) => {
    if (!object.visible && !object.isLight) hidden.push(object);
  });
  hidden.forEach((object) => { object.visible = true; });
  try {
    await renderer.compileAsync(scene, camera);
    composer.render();
  } finally {
    hidden.forEach((object) => { object.visible = false; });
    revealed.forEach(({ object, visible, culled }) => {
      object.visible = visible;
      culled.forEach(([child, frustumCulled]) => { child.frustumCulled = frustumCulled; });
    });
  }
}

function queuePlateCapture(plateIndex) {
  pendingPlateCapture = {
    plateIndex,
    generation: plateCaptureGeneration,
  };
}

// Store only the glass window, small, and develop it off the main thread's
// critical path: a cropped bitmap snapshot, then an S-curve, a little sepia
// and a vignette, encoded asynchronously.
function encodeRenderedPlate(capture) {
  const width = canvas.width;
  const height = canvas.height;
  const sx = Math.round(((PLATE_WINDOW.left + 1) / 2) * width);
  const sy = Math.round(((1 - PLATE_WINDOW.top) / 2) * height);
  const sw = Math.round(((PLATE_WINDOW.right - PLATE_WINDOW.left) / 2) * width);
  const sh = Math.round(((PLATE_WINDOW.top - PLATE_WINDOW.bottom) / 2) * height);
  createImageBitmap(canvas, sx, sy, sw, sh, { resizeWidth: 480, resizeQuality: 'medium' })
    .then((bitmap) => {
      const plate = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = plate.getContext('2d');
      context.filter = 'grayscale(1) sepia(.32) contrast(1.32) brightness(1.04)';
      context.drawImage(bitmap, 0, 0);
      context.filter = 'none';
      const vignette = context.createRadialGradient(
        plate.width / 2, plate.height / 2, plate.height * 0.32,
        plate.width / 2, plate.height / 2, plate.width * 0.62,
      );
      vignette.addColorStop(0, 'rgba(24,18,12,0)');
      vignette.addColorStop(1, 'rgba(24,18,12,.55)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, plate.width, plate.height);
      bitmap.close();
      return plate.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    })
    .then((blob) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => resolve(reader.result), { once: true });
      reader.readAsDataURL(blob);
    }))
    .then((dataUrl) => {
      if (capture.generation !== plateCaptureGeneration) return;
      plateImages[capture.plateIndex] = typeof dataUrl === 'string' ? dataUrl : null;
    })
    .catch(() => {});
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

const ABANDON_PROMPT_COPY = 'Leave the plate case and run [Hold G] — nothing on glass comes home.';
const DOYLE_STEGOSAURUS_LINE = 'Arched back, triangular fringes, a bird-like head held low: the creature from Maple White\'s sketch-book, come down to drink.';

// Where a place lies, in words relative to where the scout faces.
function directionTo(target) {
  const bearing = Math.atan2(-(target.x - player.position.x), -(target.z - player.position.z));
  const relative = Math.atan2(Math.sin(bearing - player.heading), Math.cos(bearing - player.heading));
  if (Math.abs(relative) < Math.PI / 4) return 'ahead';
  if (Math.abs(relative) > (Math.PI * 3) / 4) return 'behind you';
  return relative > 0 ? 'to your left' : 'to your right';
}

function coverDirection() {
  let best = null;
  for (const [x, z] of COVER_BAND.centerline) {
    const distance = Math.hypot(x - player.position.x, z - player.position.z);
    if (!best || distance < best.distance) best = { x, z, distance };
  }
  return directionTo(best);
}

// One prompt slot, in priority order: the dive, the exposure in hand, the
// family's live behaviour, the drinking stegosaurus, then everything else.
function contextualCopy() {
  if (player.threatState === 'attack') {
    return player.inCover
      ? 'Wings hammer the leaves overhead. Stay under them, keep low [C].'
      : `Wings circling low · Get under the thorns ${coverDirection()} · Keep low [C] · Rifle [F]`;
  }
  if (player.pendingExposure) {
    return player.pendingExposure.maxCameraDrift
      > (player.pendingExposure.driftLimit ?? MAX_STEADY_DRIFT_RADIANS)
      ? 'The camera shifted. Fine detail is going.'
      : player.pendingExposure.braced ? 'Braced against the earth. Hold.' : 'Easy now. Hold the glass still.';
  }
  if (player.cameraRaised) {
    const frame = frameForState(player);
    if (frame.key === 'subject-glimpse') return 'Only the rim of a body touches the glass. Centre it, or close in.';
    if (frame.composition === 'empty') return 'Only the river light reaches the glass.';
    if (frame.key.endsWith('-repeat')) return 'That movement is already in the case.';
    return player.stance === 'crouch' || player.inCover
      ? 'Draw the dark slide [Left Mouse / Space]'
      : 'Brace low [C], or draw the slide [Left Mouse / Space]';
  }
  if (player.zone === 'iguanodon-glade' && player.familyMoment === 'glade-young-play') {
    return 'The young break into a run across the bar.';
  }
  if (player.zone === 'iguanodon-glade' && player.familyMoment === 'glade-branch-pull') {
    return 'The feeding adult draws the whole bough down.';
  }
  if (player.zone === 'iguanodon-glade' && player.familyMoment === 'glade-alarm') {
    return player.familyAlarmSeconds > 0
      ? 'Too close. Back off, or crouch [C], and let them settle.'
      : 'The family has heard the wings. Break the dive before you lose another plate.';
  }
  const stegoPose = stegosaurusPose(player.stegosaurusClock);
  const stegoOnGlass = player.plates.some((plate) => plate.subject === 'stegosaurus' && plate.points >= 2);
  if (stegoPose.phase === 'drinking' && !stegoOnGlass && player.zone !== 'fort') {
    const where = directionTo(stegoPose);
    return `Something heavy drinks at the brook ${where === 'ahead' ? 'ahead of you' : where}.`;
  }
  // A held release must always show its progress, even where the prompt is not due.
  if (!player.caseAbandoned && player.abandonHoldSeconds > 0) return ABANDON_PROMPT_COPY;
  if (abandonPromptDue(player)) return ABANDON_PROMPT_COPY;
  if (player.zone === 'brook-blind' && !player.examinedTrack) return 'Three toes in the wet bar. Read them [E].';
  // Onboarding, once: after the first plate the brook is just the way home.
  if (player.zone === 'brook-blind' && player.plates.every((plate) => plate.status === 'unexposed')) {
    return 'The spoor turns downriver. Raise the camera [Hold Right Mouse or Q].';
  }
  if (player.zone === 'iguanodon-glade' && !player.observedBehavior) {
    if (!player.inCover) return `Watch from the thorn blind ${coverDirection()}; the wings cannot reach under it.`;
    return player.familyFocusSeconds > 0 ? 'Stay with them.' : 'Stop. Let the family forget you are here.';
  }
  if (player.returnRoute === 'covered') return 'Under the thorns now. Fort smoke shows through the leaves.';
  if (player.returnRoute === 'exposed') return 'Stay with the bright creek. There is nowhere to hide.';
  const platesSpent = player.plates.every((plate) => plate.status !== 'unexposed');
  if (player.reachedGlade && player.zone === 'iguanodon-glade' && platesSpent) {
    return 'Fort smoke lies north: back under the thorn arches, or the quick open creek.';
  }
  return '';
}

function renderPreview(plate, label, verdict) {
  const gradeKey = `${plate.index}:${plate.status}:${plate.frameKey}:${plateCaptureGeneration}`;
  previewNumber.textContent = ROMAN_PLATES[plate.index];
  previewCopy.textContent = label;
  platePreview.dataset.status = plate.status;
  if (previewGrade.dataset.plate !== gradeKey) {
    previewGrade.dataset.plate = gradeKey;
    // A struck plate keeps its stamps, struck through: what it held is gone.
    renderGrade(previewGrade, plate.status === 'cracked' ? { ...plate, status: 'exposed' } : plate);
    if (plate.status === 'cracked') {
      previewGrade.querySelectorAll('li').forEach((item) => { item.dataset.good = 'struck'; });
    }
    previewVerdict.textContent = verdict;
  }
  previewImage.dataset.frame = plate.frameKey ?? 'empty';
  applyPlateImage(previewImage, plateImages[plate.index]);
}

function updateFieldHud(now) {
  const currentFrame = player.pendingExposure ?? frameForState(player);
  const prompt = contextualCopy();
  const attackLive = player.threatState === 'attack';
  const behaviourLive = player.zone === 'iguanodon-glade'
    && ['glade-young-play', 'glade-branch-pull', 'glade-alarm'].includes(player.familyMoment);
  // The raised camera owns the top of the view: its frame condition must stay readable.
  const showFieldNote = Boolean(player.lastObservation && now < observationNoticeUntil && !player.cameraRaised);
  contextPrompt.textContent = prompt;
  contextPrompt.classList.toggle('urgent', attackLive && !player.failed);
  // A field note never hides the dive warning or a live behaviour cue.
  contextPrompt.hidden = !prompt || player.failed || (showFieldNote && !attackLive && !behaviourLive);
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
  cameraOverlay.dataset.stability = player.pendingExposure
    ? player.pendingExposure.maxCameraDrift
      > (player.pendingExposure.driftLimit ?? MAX_STEADY_DRIFT_RADIANS) ? 'shaken' : 'steady'
    : player.stance === 'crouch' || player.inCover ? 'braced' : 'ready';
  frameCondition.textContent = frameConditionCopy(currentFrame);
  const commitProgress = player.pendingExposure
    ? ((EXPOSURE_SECONDS - player.pendingExposure.remainingSeconds) / EXPOSURE_SECONDS) * 100
    : 0;
  commitLine.style.setProperty('--commit-progress', `${Math.max(0, Math.min(100, commitProgress))}%`);
  document.body.dataset.camera = player.cameraRaised ? 'raised' : 'folded';
  document.body.dataset.cover = player.inCover ? 'true' : 'false';

  document.body.dataset.rifle = player.rifleRaised ? 'raised' : 'lowered';
  cartridgeDisplay.hidden = !(player.rifleRevealed || attackLive);
  cartridgeSlots.forEach((slot, index) => {
    slot.classList.toggle('spent', index >= player.cartridges);
  });

  // The four plates and the light are the stakes: show them from the first step.
  plateRail.hidden = player.caseAbandoned;
  plateSlots.forEach((slot, index) => {
    const plate = player.plates[index];
    slot.dataset.status = plate.status;
    slot.dataset.frame = plate.frameKey ?? 'empty';
    slot.textContent = plate.status === 'cracked' ? '✕' : ROMAN_PLATES[index];
    slot.setAttribute(
      'aria-label',
      `Plate ${ROMAN_PLATES[index]}: ${plate.status}${plate.status === 'exposed' ? ` — ${noteForPlate(plate)}` : ''}`,
    );
  });

  lightWatch.hidden = false;
  lightSeconds.textContent = daylightCondition(player.remainingLight);
  lightBar.style.setProperty('--light', `${((player.remainingLight / INITIAL_LIGHT_SECONDS) * 100).toFixed(1)}%`);

  const crackedPlate = crackedPreviewUntil > now ? player.plates[crackedPreviewIndex] : null;
  const previewPlate = player.lastProofEvent
    ? player.plates[player.lastProofEvent.plateIndex]
    : null;
  const showProof = player.previewSeconds > 0
    && !player.caseAbandoned
    && player.lastProofEvent
    && previewPlate?.status === 'exposed'
    && !attackLive;
  platePreview.hidden = !(crackedPlate?.status === 'cracked' || showProof);
  if (crackedPlate?.status === 'cracked') {
    renderPreview(crackedPlate, 'The wing struck the case.', 'Broken glass proves nothing.');
  } else if (showProof) {
    const label = player.lastProofEvent.behavior === 'drinking'
      ? DOYLE_STEGOSAURUS_LINE
      : player.lastProofEvent.label;
    renderPreview(previewPlate, label, verdictForPlate(previewPlate));
  }

  fieldNote.hidden = !showFieldNote;
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
  const desiredEyeHeight = player.stance === 'crouch' ? 1.15 : 1.8;
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
  const desiredFov = player.cameraRaised ? RAISED_CAMERA_FOV : player.rifleRaised ? 66 : 70 + sprintFov;
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
    crouch: pressed.has('KeyC'),
    abandon: pressed.has('KeyG'),
    jump: jumpQueued,
    heading: player.heading,
    pitch: player.pitch,
    lookHorizontal: Number(pressed.has('ArrowLeft')) - Number(pressed.has('ArrowRight')),
    lookVertical: Number(pressed.has('ArrowUp')) - Number(pressed.has('ArrowDown')),
  };
  jumpQueued = false;
  return snapshot;
}

function clearTransientInput() {
  pressed.clear();
  cameraHolds.clear();
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
  fieldAudio.setThreatState('distant');
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
    slot.dataset.note = !leftInBasin ? noteForPlate(plate) : '';
    applyPlateImage(slot, !leftInBasin && plate.status === 'exposed' ? plateImages[index] : null);
    const stamps = document.createElement('ul');
    stamps.className = 'plate-grade';
    if (!leftInBasin) renderGrade(stamps, plate);
    slot.replaceChildren(stamps);
    slot.setAttribute(
      'aria-label',
      leftInBasin
        ? `Plate ${ROMAN_PLATES[index]}: left in the basin${plate.label ? ` — ${plate.label}` : ''}`
        : `Plate ${ROMAN_PLATES[index]}: ${plate.status}${plate.label ? ` — ${plate.label}` : ''}`,
    );
  });

  const kept = player.result.caseAbandoned ? [] : player.plates.filter((plate) => plate.status === 'exposed' && plate.points > 0);
  const species = [
    ['Iguanodon family', kept.some((plate) => plate.subject === 'iguanodon-family')],
    ['Pterodactyl', kept.some((plate) => plate.subject === 'pterodactyl')],
    ['Stegosaurus', kept.some((plate) => plate.subject === 'stegosaurus')],
  ];
  terminalLedger.replaceChildren(...species.map(([name, recorded]) => {
    const item = document.createElement('li');
    item.textContent = `${name} — ${recorded ? 'on glass' : 'not recorded'}`;
    item.dataset.recorded = recorded ? 'true' : 'false';
    return item;
  }));
  terminalLedger.hidden = player.result.kind !== 'alive';
  if (player.result.kind === 'alive') {
    terminalEyebrow.textContent = 'The case opened at Fort Challenger';
    terminalTitle.textContent = player.result.title;
    terminalResultCopy.textContent = player.result.copy;
    const recoveredNotes = player.result.caseAbandoned
      ? []
      : player.plates.filter((plate) => plate.status === 'exposed').map(noteForPlate);
    terminalDetail.textContent = recoveredNotes.length > 0
      ? `On the drying rack: ${recoveredNotes.join(' · ')}.`
      : 'The rack is bare. No living shape survived on glass.';
    const callback = [
      routeConsequence(player.result),
      player.result.aerialEvidence
        ? 'One plate fixes the wing at the instant it commits to the dive.'
        : null,
      player.result.stegosaurusEvidence
        ? "And Maple White's sketch has its witness: the stegosaurus at the drinking-place."
        : null,
    ].filter(Boolean).join(' ');
    terminalCallback.hidden = !callback;
    terminalCallback.textContent = callback;
    terminalNext.textContent = nextBandCopy(player.result);
    terminalNext.hidden = !terminalNext.textContent;
  } else {
    terminalNext.hidden = true;
    terminalEyebrow.textContent = 'The case never reached the fort';
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
  daylight.reset(visualElapsed);
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
  lastStegosaurusPhase = 'absent';
  crackedPreviewIndex = -1;
  crackedPreviewUntil = 0;
  player = restartPlayer(player);
  clearPlateImages();
  hideDroppedCase();
  // A restart mid-dive must not carry the old threat into the new run.
  world.resetRun();
  daylight.reset(visualElapsed);
  threatPulse = 0;
  smoothedEyeHeight = 1.8;
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
    ? 'PAUSED — THE VALLEY WAITS'
    : reason === 'pointer-lock-unavailable'
      ? 'CLICK THE VALLEY TO TAKE UP THE CAMERA AGAIN'
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
    familyMoment: player.pendingExposure?.familyMoment ?? player.familyMoment,
    familyStartled: player.familyAlarmSeconds > 0,
    playerHeading: player.heading,
    reachedGlade: player.reachedGlade,
    quality: presentationSettings.quality,
    deltaSeconds,
  };
}

function update(deltaSeconds, now) {
  if (runActive && !player.paused) {
    const previousContacts = player.contactCount;
    const previousRunStatus = player.runStatus;
    const previousThreatState = player.threatState;
    const previousFamilyMoment = player.familyMoment;
    const previousObservedBehavior = player.observedBehavior;
    const previousProofPlate = player.lastProofEvent?.plateIndex ?? -1;
    const previousRoute = player.returnRoute;
    const previousBrookResponse = player.brookResponse;
    const previousCaseAbandoned = player.caseAbandoned;
    const previousReachedGlade = player.reachedGlade;
    const previousInCover = player.inCover;
    const previousPlateStatus = player.plates.map((plate) => plate.status);
    const closingExposure = Boolean(player.pendingExposure)
      && player.pendingExposure.remainingSeconds <= deltaSeconds + 1e-6;
    const input = inputSnapshot();
    input.frameEvidence = measureFrameEvidence(closingExposure);
    player = stepPlayer(player, input, deltaSeconds);
    if (!previousReachedGlade && player.reachedGlade) emitCue('stegosaurus', 3400);
    if (player.threatState !== previousThreatState) {
      fieldAudio.setThreatState(player.threatState);
      if (player.threatState !== 'distant') showCaption(player.threatState);
    }
    if (player.familyMoment !== previousFamilyMoment) {
      if (player.familyMoment === 'glade-young-play') emitCue('family-play', 2600);
      if (player.familyMoment === 'glade-branch-pull') emitCue('family-branch', 2600);
    }
    if (!previousObservedBehavior && player.observedBehavior) {
      observationNoticeUntil = now + 2200;
      fieldAudio.cue('examine');
    }
    if ((player.lastProofEvent?.plateIndex ?? -1) !== previousProofPlate) {
      queuePlateCapture(player.lastProofEvent.plateIndex);
      emitCue('plate-slide');
    }
    if (!previousInCover && player.inCover && now > coverCaptionAllowedAt) {
      emitCue('cover', 2200);
      coverCaptionAllowedAt = now + 8000;
    }
    if (!previousCaseAbandoned && player.caseAbandoned) {
      emitCue('case-drop', 3000);
      observationNoticeUntil = now + 3400;
      showDroppedCase(player.caseDropPosition ?? player.position, player.heading);
    }
    if (player.brookResponse !== previousBrookResponse && player.brookResponse === 'brush-moving') {
      emitCue('brook-response', 3000);
    }
    if (player.contactCount > previousContacts) {
      emitCue('contact', 3200);
      contactNoticeUntil = now + 3600;
      const cracked = player.plates.find(
        (plate, index) => plate.status === 'cracked' && previousPlateStatus[index] !== 'cracked',
      );
      contactNote.textContent = cracked
        ? `The case takes the blow. Plate ${ROMAN_PLATES[cracked.index]} breaks inside.`
        : 'The case takes the blow. It will not survive another.';
      if (cracked) {
        crackedPreviewIndex = cracked.index;
        crackedPreviewUntil = now + 4200;
      }
    }
    if (previousRunStatus === 'active' && player.runStatus !== 'active') presentTerminal();
    visualElapsed += deltaSeconds;
    daylight.update(1 - player.remainingLight / INITIAL_LIGHT_SECONDS, visualElapsed);
    camera.getWorldDirection(listenerForward);
    fieldAudio.update({
      listener: camera.position,
      forward: listenerForward,
      brookDistance: brookFluvialProcessAt(player.position.x, player.position.z).distance,
      wingPosition: world.pterodactyls[0].position,
      distanceTravelled: player.distanceTravelled,
      stance: player.stance,
      elapsed: visualElapsed,
    });
  } else if (!runActive && cameraMode !== 'terminal') {
    visualElapsed += deltaSeconds;
  }
  world.update(
    visualElapsed,
    reducedMotion || player.paused || cameraMode === 'terminal',
    worldRuntime(deltaSeconds),
  );
  const frozen = reducedMotion || player.paused || cameraMode === 'terminal';
  const stegoPose = stegosaurus.update(
    runActive ? player.stegosaurusClock : null,
    player.paused || cameraMode === 'terminal' ? 0 : deltaSeconds,
    frozen,
    runActive ? player.position : null,
  );
  if (runActive && stegoPose.phase !== lastStegosaurusPhase) {
    if (stegoPose.phase === 'drinking') showCaption('stegosaurus-drinking', 4200);
    lastStegosaurusPhase = stegoPose.phase;
  }
  composerThreat(player);
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
  clock.update(frameTime);
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  // A paused run or the result board is a still picture: render it once,
  // then idle until something changes it.
  const still = runActive ? player.paused : cameraMode === 'terminal';
  if (still && !stillFrameDirty) {
    requestAnimationFrame(animate);
    return;
  }
  stillFrameDirty = !still;
  const now = performance.now();
  update(deltaSeconds, now);
  const capture = pendingPlateCapture;
  const cameraWasVisible = capture ? world.fieldCamera.visible : false;
  const rifleWasVisible = capture ? world.rifle.visible : false;
  // The plate keeps what the graded lens held, not the wider view the eye is
  // already easing back to once the camera comes down.
  const eyeFov = capture ? camera.fov : null;
  if (capture) {
    world.fieldCamera.visible = false;
    world.rifle.visible = false;
    camera.fov = RAISED_CAMERA_FOV;
    camera.updateProjectionMatrix();
  }
  followSunShadow(camera);
  grassField.update(camera, visualElapsed, reducedMotion);
  fieldMotes.update(camera, visualElapsed, reducedMotion, renderer.getPixelRatio());
  world.prepareBrookRender(
    renderer,
    camera,
    presentationSettings.quality,
    renderedFrameCount,
  );
  composer.render();
  if (assetFrameCommit.commit()) {
    window.__projectPlateau.ready = true;
    hideLoading();
  }
  if (capture) {
    pendingPlateCapture = null;
    encodeRenderedPlate(capture);
    world.fieldCamera.visible = cameraWasVisible;
    world.rifle.visible = rifleWasVisible;
    camera.fov = eyeFov;
    camera.updateProjectionMatrix();
  }
  renderedFrameCount += 1;
  firstRenderedAt ??= now;
  requestAnimationFrame(animate);
}

function resize() {
  stillFrameDirty = true;
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
  showLoading('Checking the camera, rifle and glass plates…', 'assets');
  try {
    await ensureHy3dVisuals();
    player = createPlayerState();
    setView('order');
    document.querySelector('#field-order').hidden = false;
    await assetFrameCommit.wait();
  } catch (error) {
    hideLoading();
    clearTransientInput();
    runActive = false;
    window.__projectPlateau.ready = false;
    runtimeErrorCopy.textContent = error instanceof Error
      ? error.message
      : 'Something needed for the expedition is missing from the local case.';
    document.querySelector('#field-order').hidden = true;
    document.querySelector('#retry-runtime').hidden = false;
    runtimeError.hidden = false;
    document.body.dataset.mode = 'runtime-error';
  } finally {
    enterButton.disabled = false;
  }
}

enterButton.addEventListener('click', () => {
  // Normally already built while idle on the title; this is the fallback.
  fieldAudio.prepare();
  void enterBasin();
});
document.querySelector('#retry-runtime').addEventListener('click', enterBasin);
document.querySelector('#dismiss-order').addEventListener('click', () => {
  document.querySelector('#field-order').hidden = true;
  beginRun();
});
document.querySelector('#resume-button').addEventListener('click', resumeRun);
document.querySelector('#restart-button').addEventListener('click', beginRun);
document.querySelector('#terminal-restart').addEventListener('click', returnToFieldOrder);
function openSettings() {
  closePanels();
  document.querySelector('#settings-panel').hidden = false;
}
document.querySelector('#settings-button').addEventListener('click', openSettings);
document.querySelector('#pause-settings').addEventListener('click', openSettings);
document.addEventListener('click', (event) => {
  const panel = document.querySelector('#settings-panel');
  if (panel.hidden || panel.contains(event.target)) return;
  if (event.target.closest('#settings-button, #pause-settings')) return;
  closePanels();
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
  if (event.code === 'Escape' && !document.querySelector('#settings-panel').hidden) {
    closePanels();
    return;
  }
  if (event.code === 'KeyF' && runActive && !player.paused) {
    player = setRifleRaised(player, true);
    return;
  }
  if (event.code === 'KeyQ' && !event.repeat && runActive && !player.paused && cameraMode === 'field') {
    holdCamera('KeyQ', true);
    return;
  }
  if (event.code === 'Space' && player.cameraRaised && runActive && !player.paused) {
    event.preventDefault();
    if (!event.repeat) exposePlate();
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
  if (event.code === 'KeyQ') holdCamera('KeyQ', false);
  pressed.delete(event.code);
});

function holdCamera(source, held) {
  if (held) cameraHolds.add(source);
  else cameraHolds.delete(source);
  const wasRaised = player.cameraRaised;
  player = setCameraRaised(player, cameraHolds.size > 0);
  if (!wasRaised && player.cameraRaised) emitCue('camera-raise');
}

function exposePlate() {
  const hadPendingExposure = Boolean(player.pendingExposure);
  player = startExposure(player, frameProbe.measure({ canopy: true }));
  if (!hadPendingExposure && player.pendingExposure) emitCue('shutter');
}
document.addEventListener('mousedown', (event) => {
  if (!runActive || player.paused || cameraMode !== 'field') return;
  if (event.button === 2) {
    event.preventDefault();
    holdCamera('mouse', true);
  } else if (event.button === 0 && player.rifleRaised) {
    event.preventDefault();
    const previousShotCount = player.shotCount;
    player = fireDefensiveShot(player);
    if (player.shotCount > previousShotCount) {
      fieldAudio.setThreatState(player.threatState);
      emitCue('rifle', 3200);
      contactNoticeUntil = performance.now() + 2600;
      contactNote.textContent = player.lastThreatEvent === 'defensive-shot-interrupt'
        ? 'Rifle report — the dive shears away.'
        : player.lastThreatEvent === 'defensive-shot-too-late'
          ? 'Too late — the wings have already passed.'
          : 'Rifle report — nothing was diving yet.';
    }
  } else if (event.button === 0 && player.cameraRaised) {
    event.preventDefault();
    exposePlate();
  }
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 2) holdCamera('mouse', false);
});
document.addEventListener('contextmenu', (event) => {
  if (runActive && !player.paused) event.preventDefault();
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || player.paused || cameraMode !== 'field') return;
  // Through the long lens the same hand movement turns the view less.
  const lensScale = player.cameraRaised ? camera.fov / 70 : 1;
  const orientation = applyLookDelta(player, event, {
    horizontal: 0.002 * presentationSettings.lookSensitivity * lensScale,
    vertical: 0.0016 * presentationSettings.lookSensitivity * lensScale,
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
  ready: false,
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
      renderedFrames: renderedFrameCount,
    };
  },
};

// Review-only handle for placing the scout during visual checks (?dev).
if (query.has('dev')) {
  window.__projectPlateau.dev = {
    THREE, scene, camera, renderer, world, stegosaurus,
    set(changes) {
      player = { ...player, ...changes };
      stillFrameDirty = true;
    },
    evidence: (canopy = false) => frameProbe.measure({ canopy }),
    frame: () => frameForState(player),
  };
}

setView(query.get('view') === 'glade' ? 'glade' : 'title');
requestAnimationFrame(animate);
showLoading('Holding the silver plate until the valley settles…', 'assets');
ensureHy3dVisuals()
  .then(() => assetFrameCommit.wait())
  .then(() => {
    // Build the suspended sound graph while the title sits idle, not on the
    // click that leaves it; the run start only resumes it.
    const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 400));
    idle(() => fieldAudio.prepare(), { timeout: 3000 });
  })
  .catch((error) => {
    console.error('Project Plateau title assets failed to settle.', error);
    hideLoading();
    window.__projectPlateau.ready = false;
    runtimeErrorCopy.textContent = error instanceof Error
      ? error.message
      : 'Something needed for the expedition is missing from the local case.';
    document.querySelector('#retry-runtime').hidden = false;
    runtimeError.hidden = false;
    document.body.dataset.mode = 'runtime-error';
  });
