import {
  NAVIGATION_BOUNDS,
  NON_SOLID_COLLISION_POLICY,
  PLAYER_CAPSULE,
  STATIC_COLLIDERS,
} from './collision-layout.js';
import { terrainHeight } from './terrain.js';

export const NAVIGATION = Object.freeze({
  bounds: NAVIGATION_BOUNDS,
  playerRadius: PLAYER_CAPSULE.radius,
  playerCapsule: PLAYER_CAPSULE,
  obstacles: STATIC_COLLIDERS,
  nonSolidPolicy: NON_SOLID_COLLISION_POLICY,
});

export const JUMP = Object.freeze({ speed: 5.8, gravity: 15 });

const FIXED_MOVEMENT_STEP = 1 / 60;

function clonePosition(position) {
  return { x: position.x, z: position.z };
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

function verticalRangesOverlap(position, obstacle, explicitPlayerBottom = null) {
  const playerBottom = Number.isFinite(explicitPlayerBottom)
    ? explicitPlayerBottom
    : terrainHeight(position.x, position.z);
  const playerTop = playerBottom + PLAYER_CAPSULE.height;
  const obstacleBottom = terrainHeight(obstacle.x, obstacle.z) + obstacle.baseOffset;
  const obstacleTop = obstacleBottom + obstacle.height;
  return playerBottom < obstacleTop && playerTop > obstacleBottom;
}

function localPoint(position, obstacle) {
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  const dx = position.x - obstacle.x;
  const dz = position.z - obstacle.z;
  return {
    x: cosine * dx - sine * dz,
    z: sine * dx + cosine * dz,
  };
}

function worldPoint(position, obstacle) {
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    x: obstacle.x + cosine * position.x + sine * position.z,
    z: obstacle.z - sine * position.x + cosine * position.z,
  };
}

export function collisionAt(position, playerBottom = null) {
  const radius = PLAYER_CAPSULE.radius;
  return STATIC_COLLIDERS.find((obstacle) => {
    if (!verticalRangesOverlap(position, obstacle, playerBottom)) return false;
    if (obstacle.type === 'circle') {
      return Math.hypot(position.x - obstacle.x, position.z - obstacle.z)
        < obstacle.radius + radius - 1e-7;
    }
    const local = localPoint(position, obstacle);
    if (obstacle.type === 'horizontal-capsule') {
      const closestX = Math.max(-obstacle.halfLength, Math.min(obstacle.halfLength, local.x));
      return Math.hypot(local.x - closestX, local.z) < obstacle.radius + radius - 1e-7;
    }
    return (
      Math.abs(local.x) < obstacle.halfX + radius - 1e-7
      && Math.abs(local.z) < obstacle.halfZ + radius - 1e-7
    );
  }) ?? null;
}

function separateCircle(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const requiredDistance = obstacle.radius + PLAYER_CAPSULE.radius;
  const dx = position.x - obstacle.x;
  const dz = position.z - obstacle.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= requiredDistance - 1e-7) return null;
  let normalX = dx;
  let normalZ = dz;
  if (distance <= 1e-8) {
    normalX = previous.x - obstacle.x;
    normalZ = previous.z - obstacle.z;
    const previousDistance = Math.hypot(normalX, normalZ);
    if (previousDistance <= 1e-8) {
      normalX = 1;
      normalZ = 0;
    } else {
      normalX /= previousDistance;
      normalZ /= previousDistance;
    }
  } else {
    normalX /= distance;
    normalZ /= distance;
  }
  return {
    position: {
      x: obstacle.x + normalX * requiredDistance,
      z: obstacle.z + normalZ * requiredDistance,
    },
    normal: { x: normalX, z: normalZ },
  };
}

function separateOrientedBox(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const local = localPoint(position, obstacle);
  const previousLocal = localPoint(previous, obstacle);
  const halfX = obstacle.halfX + PLAYER_CAPSULE.radius;
  const halfZ = obstacle.halfZ + PLAYER_CAPSULE.radius;
  if (Math.abs(local.x) >= halfX - 1e-7 || Math.abs(local.z) >= halfZ - 1e-7) return null;
  const xPenetration = halfX - Math.abs(local.x);
  const zPenetration = halfZ - Math.abs(local.z);
  const resolved = { ...local };
  let localNormal;
  if (xPenetration <= zPenetration) {
    const sign = Math.sign(local.x) || Math.sign(previousLocal.x) || 1;
    resolved.x = sign * halfX;
    localNormal = { x: sign, z: 0 };
  } else {
    const sign = Math.sign(local.z) || Math.sign(previousLocal.z) || 1;
    resolved.z = sign * halfZ;
    localNormal = { x: 0, z: sign };
  }
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    position: worldPoint(resolved, obstacle),
    normal: {
      x: cosine * localNormal.x + sine * localNormal.z,
      z: -sine * localNormal.x + cosine * localNormal.z,
    },
  };
}

function separateHorizontalCapsule(position, previous, obstacle, playerBottom = null) {
  if (!verticalRangesOverlap(position, obstacle, playerBottom)) return null;
  const local = localPoint(position, obstacle);
  const previousLocal = localPoint(previous, obstacle);
  const closestX = Math.max(-obstacle.halfLength, Math.min(obstacle.halfLength, local.x));
  const requiredDistance = obstacle.radius + PLAYER_CAPSULE.radius;
  let normalX = local.x - closestX;
  let normalZ = local.z;
  const distance = Math.hypot(normalX, normalZ);
  if (distance >= requiredDistance - 1e-7) return null;
  if (distance <= 1e-8) {
    const previousClosestX = Math.max(
      -obstacle.halfLength,
      Math.min(obstacle.halfLength, previousLocal.x),
    );
    normalX = previousLocal.x - previousClosestX;
    normalZ = previousLocal.z;
    const previousDistance = Math.hypot(normalX, normalZ);
    if (previousDistance <= 1e-8) {
      normalX = 0;
      normalZ = 1;
    } else {
      normalX /= previousDistance;
      normalZ /= previousDistance;
    }
  } else {
    normalX /= distance;
    normalZ /= distance;
  }
  const resolvedLocal = {
    x: closestX + normalX * requiredDistance,
    z: normalZ * requiredDistance,
  };
  const cosine = Math.cos(obstacle.rotation);
  const sine = Math.sin(obstacle.rotation);
  return {
    position: worldPoint(resolvedLocal, obstacle),
    normal: {
      x: cosine * normalX + sine * normalZ,
      z: -sine * normalX + cosine * normalZ,
    },
  };
}

export function resolveObstacleStep(position, delta, options = {}) {
  let resolved = { x: position.x + delta.x, z: position.z + delta.z };
  const currentGround = terrainHeight(position.x, position.z);
  const desiredGround = terrainHeight(resolved.x, resolved.z);
  if (!options.airborne && Math.abs(desiredGround - currentGround) > PLAYER_CAPSULE.maximumGroundStep) {
    return { position: clonePosition(position), collision: 'terrain-step', normal: null };
  }
  const playerBottom = Number.isFinite(options.playerBottom) ? options.playerBottom : null;

  let collision = null;
  let normal = null;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    let separated = false;
    for (const obstacle of STATIC_COLLIDERS) {
      const result = obstacle.type === 'circle'
        ? separateCircle(resolved, position, obstacle, playerBottom)
        : obstacle.type === 'horizontal-capsule'
          ? separateHorizontalCapsule(resolved, position, obstacle, playerBottom)
          : separateOrientedBox(resolved, position, obstacle, playerBottom);
      if (!result) continue;
      resolved = result.position;
      collision ??= obstacle.id;
      normal = result.normal;
      separated = true;
    }
    if (!separated) break;
  }
  return { position: resolved, collision, normal };
}

function moveTowardsVector(current, target, maximumDelta) {
  const difference = { x: target.x - current.x, z: target.z - current.z };
  const distance = Math.hypot(difference.x, difference.z);
  if (distance <= maximumDelta || distance <= 1e-12) return clonePosition(target);
  const scale = maximumDelta / distance;
  return {
    x: current.x + difference.x * scale,
    z: current.z + difference.z * scale,
  };
}

export function integrateMovement(state, targetVelocity, response, deltaSeconds, jumpRequested) {
  const stepCount = Math.max(1, Math.ceil(deltaSeconds / FIXED_MOVEMENT_STEP));
  const stepSeconds = deltaSeconds / stepCount;
  let position = clonePosition(state.position);
  let velocity = clonePosition(state.velocity ?? { x: 0, z: 0 });
  let travelled = 0;
  let collision = null;
  let boundaryRecovered = false;
  let groundY = Number.isFinite(state.groundY)
    ? state.groundY
    : terrainHeight(position.x, position.z);
  let verticalOffset = Math.max(0, Number(state.verticalOffset) || 0);
  let verticalVelocity = Number(state.verticalVelocity) || 0;
  let grounded = state.grounded ?? verticalOffset <= 1e-8;
  let worldFootY = groundY + verticalOffset;
  let jumped = false;
  let landed = false;

  const initialRecovery = resolveObstacleStep(position, { x: 0, z: 0 }, {
    playerBottom: worldFootY,
    airborne: !grounded,
  });
  if (initialRecovery.collision) {
    position = initialRecovery.position;
    velocity = { x: 0, z: 0 };
    collision = initialRecovery.collision;
    groundY = terrainHeight(position.x, position.z);
    if (grounded) worldFootY = groundY;
  }

  for (let step = 0; step < stepCount; step += 1) {
    if (jumpRequested && grounded) {
      verticalVelocity = JUMP.speed;
      grounded = false;
      jumped = true;
    }
    jumpRequested = false;

    let nextFootY = worldFootY;
    if (!grounded) {
      nextFootY += verticalVelocity * stepSeconds - 0.5 * JUMP.gravity * stepSeconds ** 2;
      verticalVelocity -= JUMP.gravity * stepSeconds;
    }
    velocity = moveTowardsVector(velocity, targetVelocity, response * stepSeconds);
    const delta = { x: velocity.x * stepSeconds, z: velocity.z * stepSeconds };
    const full = { x: position.x + delta.x, z: position.z + delta.z };
    if (!insideBounds(full)) {
      position = clonePosition(state.lastStablePosition);
      velocity = { x: 0, z: 0 };
      boundaryRecovered = true;
      groundY = terrainHeight(position.x, position.z);
      if (grounded || nextFootY <= groundY) {
        grounded = true;
        verticalVelocity = 0;
        worldFootY = groundY;
      } else {
        worldFootY = nextFootY;
      }
      break;
    }
    const desiredGround = terrainHeight(full.x, full.z);
    const resolved = resolveObstacleStep(position, delta, {
      playerBottom: grounded ? desiredGround : nextFootY,
      airborne: !grounded,
    });
    const actual = {
      x: resolved.position.x - position.x,
      z: resolved.position.z - position.z,
    };
    if (resolved.collision) {
      velocity = {
        x: actual.x / stepSeconds,
        z: actual.z / stepSeconds,
      };
      const speed = Math.hypot(velocity.x, velocity.z);
      const requestedSpeed = Math.hypot(targetVelocity.x, targetVelocity.z);
      if (speed > requestedSpeed && speed > 1e-8) {
        const scale = requestedSpeed / speed;
        velocity.x *= scale;
        velocity.z *= scale;
      }
    }
    travelled += Math.hypot(actual.x, actual.z);
    position = resolved.position;
    collision ??= resolved.collision;
    groundY = terrainHeight(position.x, position.z);
    if (grounded) {
      worldFootY = groundY;
      verticalVelocity = 0;
    } else if (nextFootY <= groundY) {
      worldFootY = groundY;
      verticalVelocity = 0;
      grounded = true;
      landed = true;
    } else {
      worldFootY = nextFootY;
    }
  }

  verticalOffset = grounded ? 0 : Math.max(0, worldFootY - groundY);

  return {
    position,
    groundY,
    verticalOffset,
    verticalVelocity,
    grounded,
    velocity,
    travelled,
    collision,
    boundaryRecovered,
    jumped,
    landed,
  };
}

export function collisionContractSnapshot() {
  const categories = {};
  for (const collider of STATIC_COLLIDERS) {
    categories[collider.category] = (categories[collider.category] ?? 0) + 1;
  }
  return {
    model: 'vertical-capsule-on-heightfield-with-ballistic-jump',
    broadPhase: 'authored-static-collider-list',
    resolution: 'iterative-depenetration-with-surface-slide',
    fixedMovementStepSeconds: FIXED_MOVEMENT_STEP,
    jump: {
      speed: JUMP.speed,
      gravity: JUMP.gravity,
      restrictedByTools: true,
    },
    capsule: { ...PLAYER_CAPSULE },
    navigationBounds: { ...NAVIGATION_BOUNDS },
    colliderCount: STATIC_COLLIDERS.length,
    categories,
    nonSolidPolicy: NON_SOLID_COLLISION_POLICY,
  };
}
