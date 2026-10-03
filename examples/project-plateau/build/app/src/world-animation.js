import * as THREE from 'three';

import { BROOK_OBSTACLE_FLOW_PROFILE } from './brook-hydrology.js';
import { updateCanopyTreeLibraryWind } from './canopy-tree-library.js';
import { updateFernLibraryWind } from './fern-library.js';
import { updateGroundCoverLibraryWind } from './ground-cover-library.js';
import { updateHeroGingkoWind } from './hero-gingko.js';
import { applyHy3dIguanodonLook, applyHy3dIguanodonPose } from './hy3d-iguanodon.js';
import { applyHy3dPterodactylPose } from './hy3d-pterodactyl.js';
import { terrainHeight } from './terrain.js';
import { updateTreeFernLibraryWind } from './tree-fern-library.js';
import { CANOPY_WIND_PROFILE } from './vegetation-leaf-materials.js';
import { shared } from './vegetation-rendering.js';
import {
  PTERODACTYL_ORBIT_CENTER,
  THREAT_TRANSITION_SECONDS,
  alignPterodactylToTravel,
  pterodactylAttackFlightState,
  pterodactylWingBeat,
} from './world-subjects.js';

export function createWorldAnimationController({
  accentFernAssetAnchor,
  brookObstacleFlowField,
  brookResponse,
  brookSceneCapture,
  coverArches,
  degradableGroundAccents,
  environmentDensity,
  family,
  familyContactShadows,
  feedingBranch,
  gladeSunLane,
  habitatAccents,
  heroGingko,
  nonColumnarRockFamilies,
  pterodactyls,
  pterodactylShadow,
  rifle,
  riparianCover,
  routeAndBrook,
  smoke,
  vegetation,
}) {
  let renderedThreatState = 'distant';
  let renderedThreatResponse = 'orbit';
  let renderedAttackStage = 'orbit';
  let renderedAttackProgress = 0;
  let renderedFamilyMoment = 'glade-young-play';
  let observedShotCount = 0;
  let flashSeconds = 0;
  let previousThreatAwareness = null;
  let visualOrbitAwareness = 0;
  let hasRenderedThreatFrame = false;
  let previousWorldElapsed = null;
  const attackAnchor = new THREE.Vector3();
  let attackHeading = 0;
  let attackEntryPosition = null;
  let attackEntryScale = null;
  let attackEntryElapsed = 0;
  let attackExitPosition = null;
  let attackExitScale = null;
  let attackExitElapsed = 0;
  const familyOffsets = family.map(() => new THREE.Vector3());
  const familyLook = family.map(() => ({ value: 0 }));
  const playAngles = family.map(() => 0);
  const scoutHead = new THREE.Vector3();
  return {
    // A new run starts with the threat and the family as authored.
    resetRun() {
      renderedThreatState = 'distant';
      renderedAttackStage = 'orbit';
      renderedAttackProgress = 0;
      previousThreatAwareness = null;
      visualOrbitAwareness = 0;
      attackEntryPosition = null;
      attackEntryScale = null;
      attackExitPosition = null;
      attackExitScale = null;
      familyOffsets.forEach((offset) => offset.set(0, 0, 0));
      familyLook.forEach((look) => { look.value = 0; });
      playAngles.fill(0);
    },
    update(elapsed, reducedMotion = false, runtime = {}) {
      const awareness = Math.max(0, Math.min(3, runtime.threatAwareness ?? 0));
      const visualQuality = ['low', 'balanced', 'high'].includes(runtime.quality)
        ? runtime.quality
        : 'balanced';
      degradableGroundAccents.visible = visualQuality !== 'low';
      environmentDensity.visible = visualQuality !== 'low';
      shared.canopyLeafMaterials.forEach((material) => {
        const windUniforms = material.userData.windUniforms;
        windUniforms.time.value = reducedMotion ? 0 : elapsed;
        windUniforms.strength.value = reducedMotion
          ? 0
          : CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters;
        windUniforms.verticalStrength.value = reducedMotion
          ? 0
          : CANOPY_WIND_PROFILE.verticalTipDisplacementMeters;
      });
      updateFernLibraryWind(vegetation.fernAssetAnchor, elapsed, reducedMotion);
      updateFernLibraryWind(accentFernAssetAnchor, elapsed, reducedMotion);
      updateFernLibraryWind(brookResponse.userData.assetAnchor, elapsed, reducedMotion);
      updateGroundCoverLibraryWind(
        environmentDensity.userData.groundCoverAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateTreeFernLibraryWind(
        habitatAccents.treeFernAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateCanopyTreeLibraryWind(
        vegetation.canopyTreeAssetAnchor,
        elapsed,
        reducedMotion,
      );
      updateCanopyTreeLibraryWind(
        riparianCover.assetAnchor,
        elapsed,
        reducedMotion,
      );
      updateHeroGingkoWind(heroGingko, elapsed, reducedMotion);
      brookSceneCapture.setQuality(visualQuality);
      renderedThreatState = ['distant', 'watch', 'search', 'attack'][awareness];
      renderedThreatResponse = awareness === 3 && runtime.inCover ? 'cover-pull-up' : 'orbit';
      const playerPosition = runtime.playerPosition ?? { x: 0, z: 0 };
      const deltaSeconds = Math.max(0, Number(runtime.deltaSeconds) || 0);
      const orbitDeltaSeconds = Object.hasOwn(runtime, 'deltaSeconds')
        ? deltaSeconds
        : previousWorldElapsed === null
          ? Math.max(0, Number(elapsed) || 0)
          : Math.max(0, (Number(elapsed) || 0) - previousWorldElapsed);
      const enteringAttack = awareness === 3 && previousThreatAwareness !== 3;
      const leavingAttack = awareness !== 3 && previousThreatAwareness === 3;
      if (enteringAttack) {
        attackAnchor.set(playerPosition.x, 0, playerPosition.z);
        attackHeading = Number.isFinite(runtime.playerHeading) ? runtime.playerHeading : 0;
        attackEntryPosition = hasRenderedThreatFrame ? pterodactyls[0].position.clone() : null;
        attackEntryScale = hasRenderedThreatFrame ? pterodactyls[0].scale.x : null;
        attackEntryElapsed = elapsed;
        attackExitPosition = null;
        attackExitScale = null;
      } else if (awareness === 3 && deltaSeconds > 0) {
        // The circle drifts after a scout who walks on, at a hunting pace.
        const chaseX = playerPosition.x - attackAnchor.x;
        const chaseZ = playerPosition.z - attackAnchor.z;
        const chase = Math.hypot(chaseX, chaseZ);
        const step = Math.min(chase, deltaSeconds * 3.2);
        if (chase > 1e-6) {
          attackAnchor.x += (chaseX / chase) * step;
          attackAnchor.z += (chaseZ / chase) * step;
        }
      }
      if (leavingAttack) {
        attackExitPosition = pterodactyls[0].position.clone();
        attackExitScale = pterodactyls[0].scale.x;
        attackExitElapsed = elapsed;
        attackEntryPosition = null;
        attackEntryScale = null;
      }
      const orbitAwarenessTarget = Math.min(2, awareness);
      const orbitBlend = deltaSeconds > 0
        ? 1 - Math.exp(-deltaSeconds * 0.9)
        : 1;
      visualOrbitAwareness = THREE.MathUtils.lerp(
        visualOrbitAwareness,
        orbitAwarenessTarget,
        orbitBlend,
      );
      const requestedFamilyMoment = runtime.familyMoment;
      renderedFamilyMoment = requestedFamilyMoment === 'glade-routine'
        || requestedFamilyMoment === 'glade-young-play'
        || requestedFamilyMoment === 'glade-branch-pull'
        || requestedFamilyMoment === 'glade-alarm'
        ? requestedFamilyMoment
        : elapsed % 12 < 6 ? 'glade-young-play' : 'glade-branch-pull';
      const waterFlowTime = elapsed * (reducedMotion ? 0.18 : 1);
      routeAndBrook.brook.material.uniforms.time.value = waterFlowTime;
      routeAndBrook.brook.material.uniforms.detailMix.value = visualQuality === 'low'
        ? 0
        : visualQuality === 'high' ? 1 : 0.72;
      routeAndBrook.brook.material.uniforms.obstacleCount.value = Math.min(
        brookObstacleFlowField.selected.length,
        BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality[visualQuality],
      );
      gladeSunLane.userData.motes.rotation.y = reducedMotion ? 0 : elapsed * 0.006;
      const eventClarity = awareness === 3 ? 0.68 : awareness === 2 ? 0.84 : 1;
      gladeSunLane.userData.motes.material.uniforms.moteOpacity.value = (reducedMotion
        ? 0.085
        : 0.125 + Math.sin(elapsed * 0.37) * 0.018) * eventClarity;
      gladeSunLane.userData.shafts.children.forEach((shaft) => {
        shaft.material.uniforms.time.value = reducedMotion ? 0 : elapsed * 0.04;
        const shaftIndex = Number(shaft.name.slice(-1)) - 1;
        shaft.material.uniforms.shaftOpacity.value = (0.035 - shaftIndex * 0.004)
          * eventClarity;
      });
      const responseStrength = runtime.brookResponse === 'brush-moving'
        ? 0.24
        : runtime.brookResponse === 'answering-call' ? 0.08 : 0.015;
      const brookResponseWind = brookResponse.userData.assetAnchor
        .userData.assetVisual?.userData.materials.windUniforms;
      if (brookResponseWind) {
        brookResponseWind.strength.value = reducedMotion
          ? 0
          : runtime.brookResponse === 'brush-moving'
            ? 0.19
            : runtime.brookResponse === 'answering-call' ? 0.13 : 0.055;
        brookResponseWind.verticalStrength.value = reducedMotion
          ? 0
          : runtime.brookResponse === 'brush-moving'
            ? 0.035
            : runtime.brookResponse === 'answering-call' ? 0.026 : 0.012;
      }
      brookResponse.children.forEach((frond, index) => {
        frond.rotation.z = (index - 2) * 0.08
          + Math.sin(elapsed * (2.4 + index * 0.12) + index) * responseStrength;
      });
      if ((runtime.shotCount ?? 0) > observedShotCount) {
        observedShotCount = runtime.shotCount;
        flashSeconds = 0.1;
      }
      flashSeconds = Math.max(0, flashSeconds - (runtime.deltaSeconds ?? 0));
      rifle.userData.flash.visible = flashSeconds > 0;
      rifle.userData.flash.material.opacity = flashSeconds > 0 ? flashSeconds * 8 : 0;
      const speed = reducedMotion ? 0.08 : 0.18;
      pterodactyls.forEach((mesh, index) => {
        const { radius, height, phase } = mesh.userData;
        const isPrimary = index === 0;
        const previousVisualScale = mesh.scale.x;
        mesh.visible = isPrimary || awareness === 0;
        const lowerAwareness = Math.floor(visualOrbitAwareness);
        const upperAwareness = Math.ceil(visualOrbitAwareness);
        const awarenessFraction = visualOrbitAwareness - lowerAwareness;
        const orbitRadii = [radius, 26, 17];
        const orbitHeights = [height, 9.4, 7.8];
        const stateRadius = isPrimary
          ? THREE.MathUtils.lerp(
            orbitRadii[lowerAwareness],
            orbitRadii[upperAwareness],
            awarenessFraction,
          )
          : radius;
        const stateHeight = isPrimary
          ? THREE.MathUtils.lerp(
            orbitHeights[lowerAwareness],
            orbitHeights[upperAwareness],
            awarenessFraction,
          )
          : height;
        const speedAwareness = isPrimary ? visualOrbitAwareness : 0;
        const stateSpeed = speed * (1 + speedAwareness * 0.42) * (1 + index * 0.08);
        mesh.userData.orbitAngle = (mesh.userData.orbitAngle ?? phase)
          + orbitDeltaSeconds * stateSpeed;
        const angle = mesh.userData.orbitAngle;
        const flightVelocity = new THREE.Vector3();
        let diveApproach = 0;
        let attackWingFold = 0;
        let attackRecovery = 0;
        if (isPrimary && awareness === 3 && runtime.inCover) {
          const targetPosition = new THREE.Vector3(
            attackAnchor.x + Math.cos(angle) * 3,
            stateHeight + 12 + Math.sin(angle * 1.6) * 0.7,
            attackAnchor.z - 17 + Math.sin(angle) * 3,
          );
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(attackEntryPosition ?? targetPosition).lerp(targetPosition, transition);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? mesh.userData.baseScale,
            mesh.userData.baseScale,
            transition,
          ));
          flightVelocity.set(
            -Math.sin(angle) * 3 * stateSpeed,
            Math.cos(angle * 1.6) * 1.12 * stateSpeed,
            Math.cos(angle) * 3 * stateSpeed,
          );
        } else if (isPrimary && awareness === 3) {
          const attackClock = Number.isFinite(runtime.attackSeconds)
            ? runtime.attackSeconds
            : elapsed;
          const flight = pterodactylAttackFlightState({
            attackClock,
            attackOrigin: attackAnchor,
            attackHeading,
            strikeTarget: playerPosition,
            reducedMotion,
          });
          const nextFlight = pterodactylAttackFlightState({
            attackClock: attackClock + 1 / 120,
            attackOrigin: attackAnchor,
            attackHeading,
            strikeTarget: playerPosition,
            reducedMotion,
          });
          const { pose: attackPose } = flight;
          diveApproach = flight.approach;
          attackWingFold = attackPose.wingFold;
          attackRecovery = attackPose.recovery;
          renderedAttackStage = attackPose.stage;
          renderedAttackProgress = diveApproach;
          // Orient against the same authored curve so the animal cannot slide
          // sideways while circling or pitch upward while descending.
          const attackScale = mesh.userData.baseScale
            * (1.05 + diveApproach * 0.4);
          const transition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          const entryPosition = attackEntryPosition ?? flight.position;
          const nextTransition = attackEntryPosition
            ? THREE.MathUtils.smoothstep(
              elapsed + 1 / 120 - attackEntryElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(entryPosition).lerp(flight.position, transition);
          flightVelocity
            .copy(entryPosition)
            .lerp(nextFlight.position, nextTransition)
            .sub(mesh.position);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            attackEntryScale ?? attackScale,
            attackScale,
            transition,
          ));
        } else {
          const xRadius = stateRadius;
          const zRadius = stateRadius * 0.35;
          const targetPosition = new THREE.Vector3(
            PTERODACTYL_ORBIT_CENTER.x + Math.cos(angle) * xRadius,
            stateHeight + Math.sin(angle * 2) * 1.2,
            PTERODACTYL_ORBIT_CENTER.z + Math.sin(angle) * zRadius,
          );
          const exitTransition = isPrimary && attackExitPosition
            ? THREE.MathUtils.smoothstep(
              elapsed - attackExitElapsed,
              0,
              THREAT_TRANSITION_SECONDS,
            )
            : 1;
          mesh.position.copy(
            isPrimary && attackExitPosition ? attackExitPosition : targetPosition,
          ).lerp(targetPosition, exitTransition);
          flightVelocity.set(
            -Math.sin(angle) * xRadius * stateSpeed,
            Math.cos(angle * 2) * 2.4 * stateSpeed,
            Math.cos(angle) * zRadius * stateSpeed,
          );
          const orbitScale = mesh.userData.baseScale
            * (isPrimary
              ? THREE.MathUtils.lerp(1, 0.82, Math.min(1, visualOrbitAwareness))
              : 1);
          mesh.scale.setScalar(THREE.MathUtils.lerp(
            isPrimary && attackExitScale ? attackExitScale : orbitScale,
            orbitScale,
            exitTransition,
          ));
          mesh.rotation.x = 0;
        }
        const poseBlend = mesh.userData.hasRenderedFlightPose && deltaSeconds > 0
          ? 1 - Math.exp(-deltaSeconds * 10)
          : 1;
        const desiredVisualScale = mesh.scale.x;
        mesh.scale.setScalar(THREE.MathUtils.lerp(
          previousVisualScale,
          desiredVisualScale,
          poseBlend,
        ));
        mesh.name = `threat.pterodactyl.${isPrimary ? renderedThreatState : 'distant'}`;
        const authoredWingFold = isPrimary && awareness === 3 && !runtime.inCover
          ? Math.max(attackWingFold, diveApproach * 0.8)
          : 0;
        const wingFold = THREE.MathUtils.lerp(
          mesh.userData.renderedWingFold ?? authoredWingFold,
          authoredWingFold,
          poseBlend,
        );
        mesh.userData.renderedWingFold = wingFold;
        const wingBeat = pterodactylWingBeat(elapsed, phase, awareness, reducedMotion)
          * (1 - wingFold * 0.78);
        for (const [sideName, sideSign] of [['leftWing', -1], ['rightWing', 1]]) {
          const wing = mesh.userData.rig[sideName];
          const rest = mesh.userData.restPose[sideName];
          const bend = -sideSign * (wingFold * 0.02 + wingBeat);
          wing.shoulder.rotation.set(
            rest.shoulder.x,
            rest.shoulder.y + sideSign * wingFold * 0.24,
            rest.shoulder.z + bend,
          );
          wing.elbow.rotation.set(
            rest.elbow.x,
            rest.elbow.y + sideSign * wingFold * 0.48,
            rest.elbow.z + bend * 0.34,
          );
          wing.wrist.rotation.set(
            rest.wrist.x,
            rest.wrist.y + sideSign * wingFold * 0.62,
            rest.wrist.z + bend * 0.2,
          );
        }
        const morphPose = runtime.pterodactylMorphPose ?? {
          wingUp: Math.max(0, wingBeat) * 3.25,
          wingDown: Math.max(0, -wingBeat) * 3.25,
          diveFold: wingFold,
        };
        applyHy3dPterodactylPose(mesh, morphPose);
        mesh.userData.flightPose = {
          wingBeat: Number(wingBeat.toFixed(4)),
          wingFold: Number(wingFold.toFixed(4)),
          mode: wingFold > 0.55 ? 'fold-dive' : wingBeat >= 0 ? 'upstroke' : 'downstroke',
        };
        mesh.userData.rig.head.rotation.x = awareness === 3
          ? -0.08 - diveApproach * 0.3
          : Math.sin(angle * 1.7) * 0.025;
        mesh.userData.rig.tail.rotation.y = Math.sin(angle * 1.4) * 0.08;
        const directAttack = isPrimary && awareness === 3 && !runtime.inCover;
        const rollAmplitude = awareness === 3 ? 0.08 : 0.16 + awareness * 0.035;
        // Circling banks into the turn; the committed dive levels out.
        const authoredFlightRoll = directAttack
          ? THREE.MathUtils.lerp(-0.42, -0.06, diveApproach) + attackRecovery * 0.1
          : Math.sin(angle * 2.4) * rollAmplitude;
        const flightRoll = THREE.MathUtils.lerp(
          mesh.userData.renderedFlightRoll ?? authoredFlightRoll,
          authoredFlightRoll,
          poseBlend,
        );
        mesh.userData.renderedFlightRoll = flightRoll;
        alignPterodactylToTravel(mesh, flightVelocity, flightRoll);
        mesh.userData.flightPose.bank = Number(flightRoll.toFixed(4));
        mesh.userData.flightPose.direction = mesh.userData.flightDirection
          ? mesh.userData.flightDirection.toArray().map((value) => Number(value.toFixed(4)))
          : null;
        mesh.userData.hasRenderedFlightPose = true;
      });
      if (runtime.captureThreatPose === 'family' || runtime.captureThreatPose === 'dive') {
        const primary = pterodactyls[0];
        const dive = runtime.captureThreatPose === 'dive';
        primary.position.set(dive ? 3.8 : -4, dive ? 5.3 : 10.5, dive ? -21.5 : -31);
        primary.rotation.set(
          dive ? 0.62 : 0.12,
          dive ? Math.PI + 0.46 : Math.PI,
          dive ? -0.62 : -0.12,
        );
        primary.scale.setScalar(primary.userData.baseScale * (dive ? 1.18 : 0.86));
        applyHy3dPterodactylPose(primary, {
          wingUp: dive ? 0 : 0.2,
          wingDown: 0,
          diveFold: dive ? 0.9 : 0,
        });
      }
      const primaryThreat = pterodactyls[0];
      const shadowVisible = awareness >= 2 && !runtime.inCover;
      pterodactylShadow.visible = shadowVisible;
      if (shadowVisible) {
        const shadowTarget = awareness === 3
          ? playerPosition
          : PTERODACTYL_ORBIT_CENTER;
        const attackShadowPull = awareness === 3
          ? 0.18 + renderedAttackProgress * 0.5
          : 0.38;
        const shadowX = THREE.MathUtils.lerp(primaryThreat.position.x, shadowTarget.x, attackShadowPull);
        const shadowZ = THREE.MathUtils.lerp(
          primaryThreat.position.z,
          shadowTarget.z - (awareness === 3 ? 0 : 3.8),
          awareness === 3 ? 0.18 + renderedAttackProgress * 0.5 : 0.36,
        );
        const shadowTargetPosition = pterodactylShadow.userData.targetPosition.set(
          shadowX,
          terrainHeight(shadowX, shadowZ) + 0.048,
          shadowZ,
        );
        const shadowBlend = pterodactylShadow.userData.wasVisible
          ? deltaSeconds > 0 ? 1 - Math.exp(-deltaSeconds * 6) : 1
          : 1;
        if (pterodactylShadow.userData.wasVisible) {
          pterodactylShadow.position.lerp(shadowTargetPosition, shadowBlend);
        } else {
          pterodactylShadow.position.copy(shadowTargetPosition);
        }
        pterodactylShadow.rotation.y = THREE.MathUtils.lerp(
          pterodactylShadow.rotation.y,
          primaryThreat.rotation.y,
          shadowBlend,
        );
        const shadowScale = 1.34 + renderedAttackProgress * 1.42;
        pterodactylShadow.userData.smoothingScale.setScalar(shadowScale);
        pterodactylShadow.scale.lerp(
          pterodactylShadow.userData.smoothingScale,
          shadowBlend,
        );
        pterodactylShadow.material.opacity = THREE.MathUtils.lerp(
          pterodactylShadow.material.opacity,
          (awareness === 3 ? 0.27 : 0.19) + renderedAttackProgress * 0.18,
          shadowBlend,
        );
      }
      pterodactylShadow.userData.wasVisible = shadowVisible;
      if (awareness !== 3) {
        renderedAttackStage = 'orbit';
        renderedAttackProgress = 0;
      }
      previousThreatAwareness = awareness;
      previousWorldElapsed = Number(elapsed) || 0;
      hasRenderedThreatFrame = true;
      family.forEach((animal, index) => {
        const {
          baseX,
          baseY,
          baseZ,
          baseHeading,
          behaviorRole,
          phase,
          rig,
          restPose,
        } = animal.userData;
        const youngPlay = behaviorRole === 'young-play' && renderedFamilyMoment === 'glade-young-play';
        const branchPull = behaviorRole === 'branch-pull' && renderedFamilyMoment === 'glade-branch-pull';
        const familyAlarm = renderedFamilyMoment === 'glade-alarm';
        const motion = reducedMotion ? 0.12 : 1;
        const breath = Math.sin(elapsed * 0.82 + phase);

        // A startled animal steps a few metres away from the scout, then
        // drifts home once the glade is quiet again.
        const offset = familyOffsets[index];
        const scout = runtime.playerPosition;
        if (scout && deltaSeconds > 0) {
          const awayX = baseX + offset.x - scout.x;
          const awayZ = baseZ + offset.z - scout.z;
          const distance = Math.hypot(awayX, awayZ);
          if (runtime.familyStartled && distance < 13 && distance > 1e-3) {
            const step = Math.min(deltaSeconds * 2.6, Math.max(0, 5 - offset.length()));
            offset.x += (awayX / distance) * step;
            offset.z += (awayZ / distance) * step;
          } else if (!runtime.familyStartled) {
            const back = Math.min(offset.length(), deltaSeconds * 0.7);
            if (back > 0) offset.addScaledVector(offset.clone().normalize(), -back);
          }
        }

        // The young run a short closed loop that starts and ends at home.
        let loopX = 0;
        let loopZ = 0;
        let loopYaw = 0;
        if (behaviorRole === 'young-play') {
          const lap = Math.PI * 2;
          const running = youngPlay && !reducedMotion;
          const atHome = playAngles[index] % lap < 1e-3;
          if (deltaSeconds > 0 && (running || !atHome)) {
            const next = playAngles[index] + deltaSeconds * 1.6;
            playAngles[index] = !running && Math.floor(next / lap) > Math.floor(playAngles[index] / lap)
              ? Math.floor(next / lap) * lap
              : next;
          }
          const theta = playAngles[index];
          const a = 2.2;
          const b = (animal.userData.baseX < 0 ? 1 : -1) * 1.1;
          const localX = a * Math.sin(theta);
          const localZ = b * (1 - Math.cos(theta));
          loopX = localX * Math.cos(baseHeading) + localZ * Math.sin(baseHeading);
          loopZ = -localX * Math.sin(baseHeading) + localZ * Math.cos(baseHeading);
          loopYaw = Math.atan2(-b * Math.sin(theta), a * Math.cos(theta));
        }
        const standX = baseX + offset.x + loopX;
        const standZ = baseZ + offset.z + loopZ;
        animal.position.x = standX;
        animal.position.z = standZ;
        animal.position.y = terrainHeight(standX, standZ) + (baseY - terrainHeight(baseX, baseZ))
          + breath * 0.012 * motion;
        animal.rotation.y = baseHeading + loopYaw;
        animal.rotation.z = Math.sin(elapsed * 0.45 + index) * 0.004 * motion;

        const contactShadow = familyContactShadows.children[index];
        const contactScale = animal.userData.young ? 0.88 : 1.36;
        contactShadow.visible = animal.visible;
        contactShadow.position.set(
          standX,
          terrainHeight(standX, standZ) + 0.045,
          standZ,
        );
        contactShadow.rotation.y = baseHeading + loopYaw;
        contactShadow.scale.set(contactScale * 1.55, 1, contactScale * 0.68);

        rig.neckPivot.rotation.z = restPose.neckZ + breath * 0.018 * motion;
        rig.headPivot.rotation.z = restPose.headZ - breath * 0.012 * motion;
        rig.jawPivot.rotation.z = restPose.jawZ;
        rig.tailPivots.forEach((pivot, tailIndex) => {
          pivot.rotation.z = restPose.tailZ[tailIndex]
            + Math.sin(elapsed * 0.42 + phase + tailIndex * 0.52) * (0.004 + tailIndex * 0.002) * motion;
          pivot.rotation.y = restPose.tailY[tailIndex]
            + Math.sin(elapsed * 0.34 + phase + tailIndex * 0.58)
            * (0.008 + tailIndex * 0.008) * motion;
        });
        Object.entries(rig.limbs).forEach(([key, limb], limbIndex) => {
          limb.upper.rotation.z = restPose.limbZ[key].upper;
          limb.mid.rotation.z = restPose.limbZ[key].mid;
          limb.distal.rotation.z = restPose.limbZ[key].distal;
          limb.root.rotation.y = Math.sin(elapsed * 0.42 + phase + limbIndex) * 0.008 * motion;
        });

        if (familyAlarm) {
          const alarmTurn = animal.userData.young ? 0.18 : 0.1;
          animal.rotation.y = baseHeading + Math.sin(elapsed * 1.8 + phase) * alarmTurn * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + (animal.userData.young ? 0.2 : 0.34);
          rig.headPivot.rotation.z = restPose.headZ - 0.12;
          rig.jawPivot.rotation.z = restPose.jawZ + Math.max(0, Math.sin(elapsed * 3.2 + phase)) * 0.055;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y += Math.sin(elapsed * 1.5 + phase) * (0.02 + tailIndex * 0.018) * motion;
          });
          applyHy3dIguanodonPose(animal, {
            play: animal.userData.young ? 0.18 : 0,
            reach: animal.userData.young ? 0 : 0.12,
          });
        } else if (behaviorRole === 'graze') {
          rig.neckPivot.rotation.z = restPose.neckZ - 0.3 + breath * 0.025 * motion;
          rig.headPivot.rotation.z = restPose.headZ - 0.18 - breath * 0.018 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + (0.035 + Math.sin(elapsed * 2.1) * 0.022) * motion;
          applyHy3dIguanodonPose(animal, {
            graze: 0.78 + breath * 0.16 * motion,
            tailLeft: Math.max(0, breath) * 0.18 * motion,
            tailRight: Math.max(0, -breath) * 0.18 * motion,
          });
        }

        if (youngPlay) {
          // Play is a planted bow-and-counterstep, not a sliding root orbit.
          // Two diagonal feet remain the weight-bearing pair while the named
          // neck, head, limb and tail pivots carry the visible action.
          const playPhase = elapsed * 2.1 + phase;
          const playSignal = Math.sin(playPhase * 1.18);
          const strideSignal = Math.sin(playPhase * 1.42);
          const stride = strideSignal * 0.38 * motion;
          const brace = Math.max(0, strideSignal) * 0.3 * motion;
          const socialTurn = animal.userData.baseX < 0 ? 1 : -1;
          const leadWeight = animal.userData.baseX < 0 ? 1 : 0.72;
          animal.position.y += (
            Math.max(0, playSignal) * 0.132
              - Math.max(0, -playSignal) * 0.045
          ) * leadWeight * motion;
          animal.rotation.z += strideSignal * 0.072 * leadWeight * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.26 + playSignal * 0.34 * motion;
          rig.headPivot.rotation.z = restPose.headZ + 0.12 - playSignal * 0.3 * motion;
          rig.jawPivot.rotation.z = restPose.jawZ + Math.max(0, -playSignal) * 0.035 * motion;
          rig.limbs.leftFore.upper.rotation.z += stride;
          rig.limbs.rightFore.upper.rotation.z -= stride;
          rig.limbs.leftHind.upper.rotation.z -= stride * 0.72;
          rig.limbs.rightHind.upper.rotation.z += stride * 0.72;
          rig.limbs.leftFore.mid.rotation.z += brace;
          rig.limbs.rightHind.mid.rotation.z += brace * 0.7;
          rig.limbs.rightFore.mid.rotation.z += Math.max(0, -stride) * 0.42;
          rig.limbs.leftHind.mid.rotation.z += Math.max(0, stride) * 0.3;
          rig.limbs.leftFore.root.rotation.y += socialTurn * strideSignal * 0.09 * motion;
          rig.limbs.rightFore.root.rotation.y -= socialTurn * strideSignal * 0.075 * motion;
          rig.limbs.leftHind.root.rotation.y -= socialTurn * strideSignal * 0.065 * motion;
          rig.limbs.rightHind.root.rotation.y += socialTurn * strideSignal * 0.085 * motion;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y -= playSignal * (0.075 + tailIndex * 0.038) * motion;
            pivot.rotation.z += playSignal * (0.03 + tailIndex * 0.011) * motion;
          });
          applyHy3dIguanodonPose(animal, {
            play: 0.46 + playSignal * 0.5 * motion,
            tailLeft: Math.max(0, playSignal) * motion,
            tailRight: Math.max(0, -playSignal) * motion,
          });
        } else if (branchPull) {
          const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
          const pull = 0.14 + pullCycle * 0.86 * motion;
          rig.neckPivot.rotation.z = restPose.neckZ + 0.36 * pull;
          rig.headPivot.rotation.z = restPose.headZ - 0.62 * pull;
          rig.jawPivot.rotation.z = restPose.jawZ + 0.14 * pull;
          rig.limbs.leftFore.upper.rotation.z = restPose.limbZ.leftFore.upper - 0.54 * pull;
          rig.limbs.rightFore.upper.rotation.z = restPose.limbZ.rightFore.upper - 0.54 * pull;
          rig.limbs.leftFore.mid.rotation.z = restPose.limbZ.leftFore.mid + 0.17 * pull;
          rig.limbs.rightFore.mid.rotation.z = restPose.limbZ.rightFore.mid + 0.17 * pull;
          rig.limbs.leftHind.upper.rotation.z = restPose.limbZ.leftHind.upper + 0.07 * pull;
          rig.limbs.rightHind.upper.rotation.z = restPose.limbZ.rightHind.upper + 0.07 * pull;
          animal.rotation.z -= 0.022 * pull;
          rig.tailPivots.forEach((pivot, tailIndex) => {
            pivot.rotation.y += pull * (0.018 + tailIndex * 0.012);
          });
          applyHy3dIguanodonPose(animal, {
            reach: pull,
            tailLeft: pull * 0.28,
          });
        } else if (behaviorRole === 'stay-close') {
          rig.neckPivot.rotation.z = restPose.neckZ + 0.06;
          rig.headPivot.rotation.z = restPose.headZ + 0.04;
          applyHy3dIguanodonPose(animal, {
            play: 0.2,
            tailRight: Math.max(0, breath) * 0.16 * motion,
            tailLeft: Math.max(0, -breath) * 0.16 * motion,
          });
        } else if (behaviorRole !== 'graze') {
          applyHy3dIguanodonPose(animal);
        }

        // Within fifteen metres the animal keeps an eye on the scout.
        const look = familyLook[index];
        let lookTarget = 0;
        if (scout && runtime.reachedGlade && !youngPlay) {
          const distance = Math.hypot(standX - scout.x, standZ - scout.z);
          lookTarget = THREE.MathUtils.clamp((15 - distance) / 4, 0, 1);
        }
        look.value += (lookTarget - look.value) * (deltaSeconds > 0 ? 1 - Math.exp(-deltaSeconds * 3) : 1);
        if (scout && look.value > 0.01) {
          scoutHead.set(scout.x, terrainHeight(scout.x, scout.z) + 1.7, scout.z);
          applyHy3dIguanodonLook(animal, scoutHead, look.value);
        }
      });
      const branchPull = renderedFamilyMoment === 'glade-branch-pull';
      const pullCycle = (Math.sin(elapsed * 3.4) + 1) * 0.5;
      // The bough flexes at the jaw contact instead of swinging through a
      // large disconnected arc. The dinosaur supplies most of the action;
      // the rooted tree only yields a few degrees under load.
      feedingBranch.userData.branchPivot.rotation.z = branchPull
        ? 0.03 + pullCycle * (reducedMotion ? 0.05 : 0.12)
        : 0.03;
      feedingBranch.userData.leafClusters.forEach((cluster, index) => {
        const rest = feedingBranch.userData.leafRestRotations[index];
        cluster.rotation.set(
          rest.x + (branchPull ? Math.sin(elapsed * 7.2 + index) * 0.08 * pullCycle : 0),
          rest.y,
          rest.z + (branchPull ? Math.cos(elapsed * 6.4 + index) * 0.045 * pullCycle : 0),
        );
      });
      smoke.children.forEach((puff, index) => {
        const drift = reducedMotion ? 0.04 : 0.14 + index * 0.012;
        puff.position.x = puff.userData.baseX + Math.sin(elapsed * 0.22 + index) * drift;
        puff.position.y = puff.userData.baseY
          + Math.sin(elapsed * 0.16 + index * 0.7) * (reducedMotion ? 0.04 : 0.14);
        puff.material.rotation = puff.userData.baseRotation
          + (reducedMotion ? 0 : Math.sin(elapsed * 0.09 + index) * 0.12);
      });
      smoke.userData.campFlames.children.forEach((flame, index) => {
        const flicker = reducedMotion
          ? 1
          : 0.86 + Math.sin(elapsed * (5.2 + index * 0.7) + index * 1.8) * 0.14;
        flame.scale.set(
          flame.userData.baseScale * (1.02 - flicker * 0.04),
          flame.userData.baseScale * flicker,
          flame.userData.baseScale * (0.96 + flicker * 0.03),
        );
        flame.rotation.y = index * 1.7 + (reducedMotion ? 0 : Math.sin(elapsed * 2.1 + index) * 0.12);
      });
      smoke.userData.emberGlow.intensity = reducedMotion
        ? 2.85
        : 2.85 + Math.sin(elapsed * 5.6) * 0.22;
      const signalFlag = smoke.userData.campSignal;
      const signalPositions = signalFlag.geometry.attributes.position;
      const basePositions = signalFlag.userData.basePositions;
      for (let index = 0; index < signalPositions.count; index += 1) {
        const offset = index * 3;
        const distanceFromHoist = THREE.MathUtils.clamp(-basePositions[offset] / 2.6, 0, 1);
        signalPositions.setY(
          index,
          basePositions[offset + 1]
            + Math.sin(elapsed * (reducedMotion ? 0.32 : 1.75) + distanceFromHoist * 2.1)
              * distanceFromHoist * (reducedMotion ? 0.02 : 0.085),
        );
        signalPositions.setZ(
          index,
          basePositions[offset + 2]
            + Math.sin(elapsed * (reducedMotion ? 0.45 : 2.8) + distanceFromHoist * 4.2)
              * distanceFromHoist * (reducedMotion ? 0.035 : 0.15),
        );
      }
      signalPositions.needsUpdate = true;
      signalFlag.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 1.65) * 0.035;
    },
    threatSnapshot() {
      const primary = pterodactyls[0];
      return {
        state: renderedThreatState,
        response: renderedThreatResponse,
        attackStage: renderedAttackStage,
        attackProgress: Number(renderedAttackProgress.toFixed(3)),
        flightPose: primary.userData.flightPose ?? null,
        position: {
          x: Number(primary.position.x.toFixed(2)),
          y: Number(primary.position.y.toFixed(2)),
          z: Number(primary.position.z.toFixed(2)),
        },
        scale: Number(primary.scale.x.toFixed(4)),
        anchorModel: 'fixed-world-orbit-latched-attack-origin',
      };
    },
    brookResponseSnapshot() {
      return {
        state: brookResponse.userData.response,
        position: {
          x: Number(brookResponse.position.x.toFixed(2)),
          y: Number(brookResponse.position.y.toFixed(2)),
          z: Number(brookResponse.position.z.toFixed(2)),
        },
      };
    },
    familySnapshot() {
      const pullingAdult = family.find((animal) => animal.userData.behaviorRole === 'branch-pull');
      const jawPosition = pullingAdult.userData.rig.jawPivot.getWorldPosition(new THREE.Vector3());
      const branchTip = feedingBranch.userData.branchPivot.localToWorld(
        feedingBranch.userData.contactPoint.clone(),
      );
      return {
        moment: renderedFamilyMoment,
        adults: family.filter((animal) => !animal.userData.young).length,
        young: family.filter((animal) => animal.userData.young).length,
        branchAngle: Number(feedingBranch.userData.branchPivot.rotation.z.toFixed(3)),
        branchContactDistance: Number(jawPosition.distanceTo(branchTip).toFixed(3)),
        positions: family.map((animal) => ({
          x: Number(animal.position.x.toFixed(3)),
          y: Number(animal.position.y.toFixed(3)),
          z: Number(animal.position.z.toFixed(3)),
        })),
        roles: family.map((animal) => animal.userData.behaviorRole),
      };
    },
  };
}
