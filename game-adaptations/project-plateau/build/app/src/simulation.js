export const INITIAL_PLAYER = Object.freeze({
  position: Object.freeze({ x: 3, z: 70 }),
  heading: 0,
  pitch: 0,
});

export const NAVIGATION = Object.freeze({
  bounds: Object.freeze({ minX: -43, maxX: 29, minZ: -90, maxZ: 91 }),
  playerRadius: 0.6,
  obstacles: Object.freeze([
    Object.freeze({ id: 'fort-tent-west', type: 'circle', x: -3, z: 80, radius: 3.4 }),
    Object.freeze({ id: 'fort-tent-east', type: 'circle', x: 5, z: 84, radius: 3.4 }),
    Object.freeze({ id: 'brook-boulder', type: 'circle', x: -7.5, z: 35, radius: 2.2 }),
    Object.freeze({ id: 'basalt-wall', type: 'box', minX: 27, maxX: 45, minZ: -85, maxZ: 65 }),
  ]),
});

const SPEED = Object.freeze({ walk: 4.2, sprint: 6.8, crouch: 2.2 });
const THREAT_STATES = Object.freeze(['distant', 'watch', 'search', 'attack']);

function clonePosition(position) {
  return { x: position.x, z: position.z };
}

export function createPlayerState() {
  return {
    position: clonePosition(INITIAL_PLAYER.position),
    lastStablePosition: clonePosition(INITIAL_PLAYER.position),
    heading: INITIAL_PLAYER.heading,
    pitch: INITIAL_PLAYER.pitch,
    stance: 'walk',
    elapsedSeconds: 0,
    distanceTravelled: 0,
    paused: false,
    pauseReason: null,
    boundaryRecoveries: 0,
    collisions: 0,
    lastEvent: 'clean-start',
    zone: 'fort',
    zoneHistory: ['fort'],
    reachedGlade: false,
    inCover: false,
    coverSeconds: 0,
    sprintExposureSeconds: 0,
    sprintEscalationCharged: false,
    threatAwareness: 0,
    threatState: 'distant',
    lastThreatEvent: 'distant',
  };
}

export function restartPlayer() {
  return createPlayerState();
}

export function setPaused(state, paused, reason = null) {
  return {
    ...state,
    position: clonePosition(state.position),
    lastStablePosition: clonePosition(state.lastStablePosition),
    paused,
    pauseReason: paused ? reason : null,
    lastEvent: paused ? `paused:${reason ?? 'manual'}` : 'resumed',
  };
}

function insideBounds(position) {
  const { bounds, playerRadius } = NAVIGATION;
  return (
    position.x >= bounds.minX + playerRadius
    && position.x <= bounds.maxX - playerRadius
    && position.z >= bounds.minZ + playerRadius
    && position.z <= bounds.maxZ - playerRadius
  );
}

function obstacleAt(position) {
  const radius = NAVIGATION.playerRadius;
  return NAVIGATION.obstacles.find((obstacle) => {
    if (obstacle.type === 'circle') {
      return Math.hypot(position.x - obstacle.x, position.z - obstacle.z) < obstacle.radius + radius;
    }
    return (
      position.x > obstacle.minX - radius
      && position.x < obstacle.maxX + radius
      && position.z > obstacle.minZ - radius
      && position.z < obstacle.maxZ + radius
    );
  });
}

export function zoneForPosition(position, reachedGlade = false) {
  if (position.z >= 62) return 'fort';
  if (position.z >= 34) return 'brook-blind';
  if (position.z <= 3) return 'iguanodon-glade';
  if (reachedGlade) return position.x < 3 ? 'covered-return' : 'exposed-creek';
  return position.x < 3 ? 'canopy-overlook' : 'basalt-shelf';
}

function updateThreatState(state, zone, stance, deltaSeconds, travelled) {
  const entered = zone !== state.zone;
  const inCover = zone === 'canopy-overlook' || zone === 'covered-return';
  let awareness = state.threatAwareness;
  let coverSeconds = inCover ? state.coverSeconds + deltaSeconds : 0;
  let sprintExposureSeconds = stance === 'sprint' && travelled > 0 && (zone === 'basalt-shelf' || zone === 'exposed-creek')
    ? state.sprintExposureSeconds + deltaSeconds
    : 0;
  let sprintEscalationCharged = state.sprintEscalationCharged;
  let event = state.lastThreatEvent;

  if (entered && (zone === 'canopy-overlook' || zone === 'basalt-shelf')) {
    awareness = Math.max(awareness, 1);
    event = 'territory-watch';
  }
  if (entered && zone === 'iguanodon-glade') {
    awareness = Math.max(awareness, 2);
    event = 'glade-search';
  }
  if (sprintExposureSeconds >= 1 && !sprintEscalationCharged) {
    awareness = Math.min(3, awareness + 1);
    sprintEscalationCharged = true;
    event = 'exposed-sprint';
  }
  if (stance !== 'sprint' || inCover) sprintEscalationCharged = false;
  if (coverSeconds >= 6) {
    awareness = Math.max(0, awareness - 1);
    coverSeconds -= 6;
    event = 'cover-deescalation';
  }

  return {
    awareness,
    threatState: THREAT_STATES[awareness],
    inCover,
    coverSeconds,
    sprintExposureSeconds,
    sprintEscalationCharged,
    event,
  };
}

function resolveObstacleMovement(position, delta) {
  const full = { x: position.x + delta.x, z: position.z + delta.z };
  const hit = obstacleAt(full);
  if (!hit) return { position: full, collision: null };

  const xOnly = { x: position.x + delta.x, z: position.z };
  if (Math.abs(delta.x) > 1e-8 && !obstacleAt(xOnly)) {
    return { position: xOnly, collision: hit.id };
  }
  const zOnly = { x: position.x, z: position.z + delta.z };
  if (Math.abs(delta.z) > 1e-8 && !obstacleAt(zOnly)) {
    return { position: zOnly, collision: hit.id };
  }
  return { position: clonePosition(position), collision: hit.id };
}

export function stepPlayer(state, input = {}, rawDeltaSeconds = 0) {
  const deltaSeconds = Math.max(0, Math.min(rawDeltaSeconds, 1));
  if (state.paused) {
    return {
      ...state,
      position: clonePosition(state.position),
      lastStablePosition: clonePosition(state.lastStablePosition),
    };
  }

  const heading = Number.isFinite(input.heading) ? input.heading : state.heading;
  const pitch = Number.isFinite(input.pitch) ? input.pitch : state.pitch;
  const forward = Math.max(-1, Math.min(1, input.forward ?? 0));
  const right = Math.max(-1, Math.min(1, input.right ?? 0));
  const magnitude = Math.hypot(forward, right);
  const normalizedForward = magnitude > 1 ? forward / magnitude : forward;
  const normalizedRight = magnitude > 1 ? right / magnitude : right;
  const stance = input.crouch ? 'crouch' : input.sprint ? 'sprint' : 'walk';
  const distance = SPEED[stance] * deltaSeconds;
  const delta = {
    x: (Math.sin(heading) * normalizedForward + Math.cos(heading) * normalizedRight) * distance,
    z: (-Math.cos(heading) * normalizedForward + Math.sin(heading) * normalizedRight) * distance,
  };
  const full = { x: state.position.x + delta.x, z: state.position.z + delta.z };

  if (!insideBounds(full)) {
    return {
      ...state,
      position: clonePosition(state.lastStablePosition),
      lastStablePosition: clonePosition(state.lastStablePosition),
      heading,
      pitch,
      stance,
      elapsedSeconds: state.elapsedSeconds + deltaSeconds,
      boundaryRecoveries: state.boundaryRecoveries + 1,
      lastEvent: 'boundary-recovery',
    };
  }

  const resolved = resolveObstacleMovement(state.position, delta);
  const travelled = Math.hypot(
    resolved.position.x - state.position.x,
    resolved.position.z - state.position.z,
  );
  const reachedGlade = state.reachedGlade || resolved.position.z <= 3;
  const zone = zoneForPosition(resolved.position, reachedGlade);
  const threat = updateThreatState(state, zone, stance, deltaSeconds, travelled);
  const zoneHistory = zone === state.zone ? [...state.zoneHistory] : [...state.zoneHistory, zone];
  return {
    ...state,
    position: clonePosition(resolved.position),
    lastStablePosition: clonePosition(resolved.position),
    heading,
    pitch,
    stance,
    elapsedSeconds: state.elapsedSeconds + deltaSeconds,
    distanceTravelled: state.distanceTravelled + travelled,
    collisions: state.collisions + (resolved.collision ? 1 : 0),
    lastEvent: resolved.collision ? `collision:${resolved.collision}` : travelled > 0 ? 'movement' : 'idle',
    zone,
    zoneHistory,
    reachedGlade,
    inCover: threat.inCover,
    coverSeconds: threat.coverSeconds,
    sprintExposureSeconds: threat.sprintExposureSeconds,
    sprintEscalationCharged: threat.sprintEscalationCharged,
    threatAwareness: threat.awareness,
    threatState: threat.threatState,
    lastThreatEvent: threat.event,
  };
}
