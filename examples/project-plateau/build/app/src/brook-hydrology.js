import * as THREE from 'three';

export const BROOK_HYDROLOGY_PROFILE = Object.freeze({
  version: 'gravity-drained-twin-reach-losing-basin-v1',
  waterClearanceMeters: 0.12,
  minimumDownstreamGrade: 0.0008,
  reflectionReachSampleSpan: 4,
  drainageModel: 'two-headwater-reaches-drain-to-saturated-infiltration-hollow',
  crossChannelSurfaceModel: 'gravity-level-cross-section',
  surfaceEnergyModel:
    'downstream-grade-and-rendered-obstacle-coupled-ripple-roughness-and-aeration',
  reflectionModel: 'camera-selected-local-tangent-plane-with-spatial-validity-mask',
});

export const BROOK_REFLECTION_PROFILE = Object.freeze({
  version: 'bounded-screen-space-over-planar-brook-reflection-v1',
  model: 'screen-space-reflected-ray-over-local-planar-and-scene-probe-fallback',
  opaqueSceneSource: 'same-camera-colour-and-depth-capture-with-water-suppressed',
  rayMarch: 'perspective-correct-screen-segment-with-depth-thickness-gate',
  maximumRangeMeters: 38,
  constantThicknessMeters: 0.12,
  depthScaledThicknessPerMeter: 0.008,
  stepsByQuality: Object.freeze({ low: 0, balanced: 12, high: 20 }),
  confidenceModel: 'viewport-edge-hit-thickness-and-above-surface-gates',
  fallback: 'camera-selected-local-planar-then-scene-layout-equirectangular-probe',
  evidenceBoundary:
    'screen-space-rays-cannot-recover-occluded-or-off-screen-geometry-and-never-replace-the-fallback',
});

export const BROOK_OBSTACLE_FLOW_PROFILE = Object.freeze({
  version: 'rendered-clast-coupled-bounded-obstacle-flow-v1',
  model: 'local-potential-flow-deflection-with-downstream-vortex-shedding-and-aeration',
  candidateSource:
    'rendered-terrain-settled-active-bedload-and-historical-flood-lag-world-bounds',
  maximumObstacleCount: 12,
  activeCountByQuality: Object.freeze({ low: 4, balanced: 8, high: 12 }),
  maximumChannelDistanceFraction: 0.54,
  minimumUpperColumnContact: 0.16,
  radiusRangeMeters: Object.freeze([0.07, 0.68]),
  wakeLengthRangeMeters: Object.freeze([0.42, 3.1]),
  maximumSurfaceNormalSlope: 0.052,
  maximumAeration: 0.31,
  evidenceBoundary:
    'local-bounded-cylinder-and-shedding-approximation-not-cfd-discharge-or-transport-proof',
});

export const BROOK_FREE_SURFACE_PROFILE = Object.freeze({
  version: 'tessellated-obstacle-coupled-free-surface-v1',
  model:
    'gravity-base-level-with-clast-pressure-speedup-and-downstream-shedding-displacement',
  longitudinalSubdivisions: 4,
  crossSectionVertices: 13,
  maximumDisplacementMeters: 0.038,
  maximumUpstreamCompressionMeters: 0.032,
  maximumSideDrawdownMeters: 0.012,
  maximumWakeAmplitudeMeters: 0.018,
  volumeContract:
    'zero-mean-oscillatory-wake-with-local-upstream-rise-and-side-drawdown-over-fixed-base-level',
  evidenceBoundary:
    'centimetre-bounded-visual-free-surface-not-shallow-water-cfd-or-volume-conservation-proof',
});

function horizontalDistance(start, end) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function nearestBrookSegment(points, x, z) {
  let nearest = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
    const interpolation = lengthSquared <= 1e-8 ? 0 : THREE.MathUtils.clamp(
      ((x - start.x) * deltaX + (z - start.z) * deltaZ) / lengthSquared,
      0,
      1,
    );
    const projectedX = start.x + deltaX * interpolation;
    const projectedZ = start.z + deltaZ * interpolation;
    const distance = Math.hypot(x - projectedX, z - projectedZ);
    if (nearest && distance >= nearest.distance) continue;
    const length = Math.sqrt(lengthSquared) || 1;
    nearest = {
      index,
      interpolation,
      distance,
      tangentX: deltaX / length,
      tangentZ: deltaZ / length,
    };
  }
  return nearest;
}

export function brookFlowFrameAt(points, hydrology, x, z) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new TypeError('Brook flow frame requires at least two centreline points.');
  }
  if (!hydrology?.waterLevels || hydrology.waterLevels.length !== points.length) {
    throw new TypeError('Brook flow frame requires hydrology sampled on the same points.');
  }
  const nearest = nearestBrookSegment(points, x, z);
  const { index, interpolation } = nearest;
  const waterLevel = THREE.MathUtils.lerp(
    hydrology.waterLevels[index],
    hydrology.waterLevels[index + 1],
    interpolation,
  );
  const flowEnergy = THREE.MathUtils.lerp(
    hydrology.flowEnergies[index],
    hydrology.flowEnergies[index + 1],
    interpolation,
  );
  const branchDirection = index < hydrology.confluenceIndex ? 1 : -1;
  return Object.freeze({
    segmentIndex: index,
    interpolation,
    channelDistance: nearest.distance,
    waterLevel,
    flowEnergy,
    flowDirection: new THREE.Vector2(
      nearest.tangentX * branchDirection,
      nearest.tangentZ * branchDirection,
    ),
  });
}

export function buildBrookObstacleFlowField(points, hydrology, candidates, options = {}) {
  if (!Array.isArray(candidates)) {
    throw new TypeError('Brook obstacle flow requires rendered obstacle candidates.');
  }
  const profile = options.profile ?? BROOK_OBSTACLE_FLOW_PROFILE;
  const width = options.width ?? 3.4;
  const maximumChannelDistance = width * profile.maximumChannelDistanceFraction;
  const obstacles = [];
  const rejected = [];

  for (const candidate of candidates) {
    const finiteCandidate = [
      candidate?.x,
      candidate?.z,
      candidate?.radiusMeters,
      candidate?.topElevation,
      candidate?.bottomElevation,
    ].every(Number.isFinite);
    if (!finiteCandidate || !candidate?.id) {
      rejected.push(Object.freeze({
        id: candidate?.id ?? 'unknown-candidate',
        reason: 'invalid-rendered-world-bounds',
      }));
      continue;
    }
    const frame = brookFlowFrameAt(points, hydrology, candidate.x, candidate.z);
    const bedElevation = Number.isFinite(candidate.bedElevation)
      ? candidate.bedElevation
      : candidate.bottomElevation;
    const waterDepthMeters = frame.waterLevel - bedElevation;
    const obstacleHeightMeters = Math.max(
      candidate.topElevation - candidate.bottomElevation,
      0.001,
    );
    const topClearanceMeters = frame.waterLevel - candidate.topElevation;
    const upperColumnContact = THREE.MathUtils.clamp(
      1 - Math.max(0, topClearanceMeters) / Math.max(waterDepthMeters, 0.035),
      0,
      1,
    );
    let rejectionReason = null;
    if (frame.channelDistance > maximumChannelDistance) {
      rejectionReason = 'outside-rendered-wetted-channel';
    } else if (waterDepthMeters <= 0.008 || candidate.bottomElevation >= frame.waterLevel) {
      rejectionReason = 'no-water-column-intersection';
    } else if (upperColumnContact < profile.minimumUpperColumnContact) {
      rejectionReason = 'too-deep-to-resolve-at-free-surface';
    }
    if (rejectionReason) {
      rejected.push(Object.freeze({ id: candidate.id, reason: rejectionReason }));
      continue;
    }

    const radiusMeters = THREE.MathUtils.clamp(
      candidate.radiusMeters,
      profile.radiusRangeMeters[0],
      profile.radiusRangeMeters[1],
    );
    const emergedFraction = THREE.MathUtils.clamp(
      (candidate.topElevation - frame.waterLevel) / obstacleHeightMeters,
      0,
      1,
    );
    const surfaceContact = THREE.MathUtils.clamp(
      upperColumnContact * (0.72 + emergedFraction * 0.28),
      0,
      1,
    );
    const deflectionRadiusMeters = THREE.MathUtils.clamp(
      radiusMeters * (2.15 + surfaceContact * 0.6) + waterDepthMeters * 0.35,
      radiusMeters * 1.75,
      1.55,
    );
    const wakeLengthMeters = THREE.MathUtils.clamp(
      radiusMeters * (4.2 + surfaceContact * 1.7) + waterDepthMeters * 1.15,
      profile.wakeLengthRangeMeters[0],
      profile.wakeLengthRangeMeters[1],
    );
    const wakeHalfWidthMeters = THREE.MathUtils.clamp(
      radiusMeters * (0.82 + surfaceContact * 0.42),
      0.085,
      0.74,
    );
    const normalSlope = profile.maximumSurfaceNormalSlope
      * surfaceContact
      * THREE.MathUtils.lerp(0.58, 1, frame.flowEnergy);
    const aeration = profile.maximumAeration
      * surfaceContact
      * THREE.MathUtils.smoothstep(emergedFraction + upperColumnContact * 0.42, 0.28, 0.82)
      * THREE.MathUtils.smoothstep(frame.flowEnergy, 0.08, 0.7);
    const roughnessGain = THREE.MathUtils.clamp(
      surfaceContact * (0.045 + frame.flowEnergy * 0.075),
      0,
      0.12,
    );
    const impact = surfaceContact
      * (radiusMeters + wakeLengthMeters * 0.16)
      * (0.45 + frame.flowEnergy * 0.55);
    obstacles.push(Object.freeze({
      id: candidate.id,
      sourceClass: candidate.sourceClass ?? 'rendered-clast',
      x: candidate.x,
      z: candidate.z,
      radiusMeters,
      topElevation: candidate.topElevation,
      bottomElevation: candidate.bottomElevation,
      waterLevel: frame.waterLevel,
      waterDepthMeters,
      topClearanceMeters,
      upperColumnContact,
      emergedFraction,
      channelDistance: frame.channelDistance,
      flowEnergy: frame.flowEnergy,
      flowDirection: frame.flowDirection,
      deflectionRadiusMeters,
      wakeLengthMeters,
      wakeHalfWidthMeters,
      normalSlope,
      aeration,
      roughnessGain,
      impact,
    }));
  }

  obstacles.sort((left, right) => right.impact - left.impact || left.id.localeCompare(right.id));
  const selected = Object.freeze(obstacles.slice(0, profile.maximumObstacleCount));
  const selectedIds = new Set(selected.map(({ id }) => id));
  obstacles.slice(profile.maximumObstacleCount).forEach(({ id }) => {
    rejected.push(Object.freeze({ id, reason: 'bounded-uniform-budget' }));
  });
  return Object.freeze({
    profile,
    candidateCount: candidates.length,
    qualifyingCount: obstacles.length,
    selected,
    rejected: Object.freeze(rejected),
    selectedSourceClasses: Object.freeze([...new Set(
      selected.map(({ sourceClass }) => sourceClass),
    )]),
    maximumNormalSlope: selected.length > 0
      ? Math.max(...selected.map(({ normalSlope }) => normalSlope))
      : 0,
    maximumAeration: selected.length > 0
      ? Math.max(...selected.map(({ aeration }) => aeration))
      : 0,
    selectedIds: Object.freeze([...selectedIds]),
  });
}

function buildReflectionReach(
  points,
  waterLevels,
  startIndex,
  endIndex,
  branch,
  width,
  id,
) {
  const start = points[startIndex];
  const end = points[endIndex];
  const chordLength = Math.max(horizontalDistance(start, end), 0.001);
  const tangent = new THREE.Vector3(
    end.x - start.x,
    0,
    end.z - start.z,
  ).normalize();
  const grade = (waterLevels[endIndex] - waterLevels[startIndex]) / chordLength;
  const normal = new THREE.Vector3(
    -grade * tangent.x,
    1,
    -grade * tangent.z,
  ).normalize();
  const center = new THREE.Vector3(
    (start.x + end.x) * 0.5,
    (waterLevels[startIndex] + waterLevels[endIndex]) * 0.5,
    (start.z + end.z) * 0.5,
  );
  let arcLength = 0;
  let maxSurfaceDeviation = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    if (index > startIndex) arcLength += horizontalDistance(points[index - 1], points[index]);
    const deltaX = points[index].x - center.x;
    const deltaZ = points[index].z - center.z;
    const planeHeight = center.y + grade * (deltaX * tangent.x + deltaZ * tangent.z);
    maxSurfaceDeviation = Math.max(
      maxSurfaceDeviation,
      Math.abs(waterLevels[index] - planeHeight),
    );
  }
  const downstreamDrop = branch === 'north-headwater'
    ? waterLevels[startIndex] - waterLevels[endIndex]
    : waterLevels[endIndex] - waterLevels[startIndex];
  return Object.freeze({
    id,
    branch,
    startIndex,
    endIndex,
    center,
    tangent,
    normal,
    grade,
    arcLength,
    halfLength: arcLength * 0.5 + 0.8,
    halfWidth: width * 0.5 + 0.45,
    maxSurfaceDeviation,
    downstreamDrop,
  });
}

function buildReflectionReaches(points, waterLevels, confluenceIndex, width, sampleSpan) {
  const reaches = [];
  const addBranch = (branchStart, branchEnd, branch) => {
    for (let start = branchStart; start < branchEnd; start += sampleSpan) {
      const end = Math.min(start + sampleSpan, branchEnd);
      reaches.push(buildReflectionReach(
        points,
        waterLevels,
        start,
        end,
        branch,
        width,
        `reach-${String(reaches.length + 1).padStart(2, '0')}`,
      ));
    }
  };
  addBranch(0, confluenceIndex, 'north-headwater');
  addBranch(confluenceIndex, points.length - 1, 'south-headwater');
  return Object.freeze(reaches);
}

export function buildBrookHydrology(points, sampleBedHeight, options = {}) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new TypeError('Brook hydrology requires at least three ordered centreline points.');
  }
  if (typeof sampleBedHeight !== 'function') {
    throw new TypeError('Brook hydrology requires a bed-height sampler.');
  }
  const width = options.width ?? 3.4;
  const waterClearance = options.waterClearance
    ?? BROOK_HYDROLOGY_PROFILE.waterClearanceMeters;
  const minimumGrade = options.minimumGrade
    ?? BROOK_HYDROLOGY_PROFILE.minimumDownstreamGrade;
  const reachSampleSpan = options.reachSampleSpan
    ?? BROOK_HYDROLOGY_PROFILE.reflectionReachSampleSpan;
  const bedLevels = points.map((point) => sampleBedHeight(point.x, point.z));
  const minimumBedLevel = Math.min(...bedLevels);
  const confluenceIndex = bedLevels.indexOf(minimumBedLevel);
  if (confluenceIndex <= 0 || confluenceIndex >= points.length - 1) {
    throw new RangeError('Brook confluence must be an interior saturated hollow.');
  }
  const requestedLevels = bedLevels.map((height) => height + waterClearance);
  const waterLevels = [...requestedLevels];

  // Both mapped reaches are headwaters. They drain toward the interior hollow;
  // the small monotonic lift only removes centimetre-scale procedural bed humps.
  // It never tilts the water across the channel and never asks the current to
  // climb a terrain-following ribbon.
  for (let index = confluenceIndex - 1; index >= 0; index -= 1) {
    const distance = horizontalDistance(points[index], points[index + 1]);
    waterLevels[index] = Math.max(
      requestedLevels[index],
      waterLevels[index + 1] + distance * minimumGrade,
    );
  }
  for (let index = confluenceIndex + 1; index < points.length; index += 1) {
    const distance = horizontalDistance(points[index - 1], points[index]);
    waterLevels[index] = Math.max(
      requestedLevels[index],
      waterLevels[index - 1] + distance * minimumGrade,
    );
  }

  const flowDirections = waterLevels.map((_, index) => (
    index < confluenceIndex ? 1 : index > confluenceIndex ? -1 : 0
  ));
  let minimumMeasuredDownstreamGrade = Infinity;
  let maximumMeasuredDownstreamGrade = 0;
  const localDownstreamGrades = waterLevels.map(() => 0);
  for (let index = 0; index < confluenceIndex; index += 1) {
    const grade = (waterLevels[index] - waterLevels[index + 1])
      / Math.max(horizontalDistance(points[index], points[index + 1]), 0.001);
    localDownstreamGrades[index] = grade;
    minimumMeasuredDownstreamGrade = Math.min(minimumMeasuredDownstreamGrade, grade);
    maximumMeasuredDownstreamGrade = Math.max(maximumMeasuredDownstreamGrade, grade);
  }
  for (let index = confluenceIndex + 1; index < points.length; index += 1) {
    const grade = (waterLevels[index] - waterLevels[index - 1])
      / Math.max(horizontalDistance(points[index], points[index - 1]), 0.001);
    localDownstreamGrades[index] = grade;
    minimumMeasuredDownstreamGrade = Math.min(minimumMeasuredDownstreamGrade, grade);
    maximumMeasuredDownstreamGrade = Math.max(maximumMeasuredDownstreamGrade, grade);
  }
  localDownstreamGrades[confluenceIndex] = Math.max(
    localDownstreamGrades[confluenceIndex - 1],
    localDownstreamGrades[confluenceIndex + 1],
  ) * 0.62;
  const flowEnergies = localDownstreamGrades.map((grade) => THREE.MathUtils.clamp(
    (grade - 0.004) / 0.06,
    0,
    1,
  ));
  const reaches = buildReflectionReaches(
    points,
    waterLevels,
    confluenceIndex,
    width,
    reachSampleSpan,
  );
  const maximumPondingDepth = Math.max(
    ...waterLevels.map((height, index) => height - requestedLevels[index]),
  );
  const maximumBedClearance = Math.max(
    ...waterLevels.map((height, index) => height - bedLevels[index]),
  );
  return Object.freeze({
    profile: BROOK_HYDROLOGY_PROFILE,
    bedLevels: Object.freeze(bedLevels),
    waterLevels: Object.freeze(waterLevels),
    flowDirections: Object.freeze(flowDirections),
    localDownstreamGrades: Object.freeze(localDownstreamGrades),
    flowEnergies: Object.freeze(flowEnergies),
    confluenceIndex,
    confluence: new THREE.Vector3(
      points[confluenceIndex].x,
      waterLevels[confluenceIndex],
      points[confluenceIndex].z,
    ),
    minimumMeasuredDownstreamGrade,
    maximumMeasuredDownstreamGrade,
    maximumFlowEnergy: Math.max(...flowEnergies),
    maximumPondingDepth,
    maximumBedClearance,
    crossChannelGrade: 0,
    reaches,
  });
}
