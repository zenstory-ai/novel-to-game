import * as THREE from 'three';
import {
  BROOK_FREE_SURFACE_PROFILE,
  BROOK_OBSTACLE_FLOW_PROFILE,
  BROOK_REFLECTION_PROFILE,
} from './brook-hydrology.js';

function createBrookMaterial(textures, bedTextures) {
  const fallbackReflection = new THREE.DataTexture(
    new Uint8Array([112, 142, 145, 255]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  fallbackReflection.name = 'world.material.brook-local-reflection-fallback';
  fallbackReflection.colorSpace = THREE.NoColorSpace;
  fallbackReflection.needsUpdate = true;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      detailMix: { value: 0.72 },
      flowAlbedo: { value: textures.albedo },
      flowRoughness: { value: textures.roughness },
      flowNormal: { value: textures.normal },
      channelBed: { value: bedTextures.albedo },
      shallowColor: { value: new THREE.Color(0x6f978b) },
      deepColor: { value: new THREE.Color(0x285d68) },
      skyColor: { value: new THREE.Color(0x94b3b1) },
      foamColor: { value: new THREE.Color(0xd0d5c5) },
      sunColor: { value: new THREE.Color(0xd9b37d) },
      sunDirection: { value: new THREE.Vector3(-0.44, 0.55, 0.71).normalize() },
      sceneReflectionPanorama: { value: fallbackReflection },
      planarReflection: { value: fallbackReflection },
      planarReflectionMatrix: { value: new THREE.Matrix4() },
      planarReflectionCenter: { value: new THREE.Vector3() },
      planarReflectionTangent: { value: new THREE.Vector3(0, 0, 1) },
      planarReflectionPlaneNormal: { value: new THREE.Vector3(0, 1, 0) },
      planarReflectionHalfExtent: { value: new THREE.Vector2(2.15, 5.6) },
      planarReflectionPlaneTolerance: { value: 0.12 },
      planarReflectionReady: { value: 0 },
      planarReflectionMix: { value: 0.82 },
      sceneRefractionColor: { value: fallbackReflection },
      sceneRefractionDepth: { value: fallbackReflection },
      sceneRefractionReady: { value: 0 },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 600 },
      cameraProjectionMatrix: { value: new THREE.Matrix4() },
      cameraProjectionInverse: { value: new THREE.Matrix4() },
      reflectionPanoramaMix: { value: 0.76 },
      bedTransmissionMix: { value: 0.68 },
      ssrSteps: { value: BROOK_REFLECTION_PROFILE.stepsByQuality.balanced },
      ssrRange: { value: BROOK_REFLECTION_PROFILE.maximumRangeMeters },
      ssrStrength: { value: 0.76 },
      ssrThickness: { value: BROOK_REFLECTION_PROFILE.constantThicknessMeters },
      ssrThicknessSlope: {
        value: BROOK_REFLECTION_PROFILE.depthScaledThicknessPerMeter,
      },
      obstacleCount: {
        value: BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality.balanced,
      },
      obstacleCenterRadiusContact: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
      obstacleFlowWake: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
      obstacleResponse: {
        value: Array.from(
          { length: BROOK_OBSTACLE_FLOW_PROFILE.maximumObstacleCount },
          () => new THREE.Vector4(),
        ),
      },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexColors: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec4 vRibbonColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec4 vPlanarReflectionCoord;
      varying float vFlowDirection;
      varying float vFlowEnergy;
      varying float vWaterDepthMeters;
      varying float vSurfaceDisplacementMeters;
      uniform mat4 planarReflectionMatrix;
      uniform float time;
      uniform float obstacleCount;
      uniform vec4 obstacleCenterRadiusContact[12];
      uniform vec4 obstacleFlowWake[12];
      uniform vec4 obstacleResponse[12];
      attribute float flowDirection;
      attribute float flowEnergy;
      attribute float waterDepthMeters;

      float sampleObstacleSurfaceDisplacement(vec2 worldPosition) {
        float displacement = 0.0;
        for (int obstacleIndex = 0; obstacleIndex < 12; obstacleIndex += 1) {
          if (float(obstacleIndex) >= obstacleCount) break;
          vec4 centerRadiusContact = obstacleCenterRadiusContact[obstacleIndex];
          if (centerRadiusContact.z <= 0.001 || centerRadiusContact.w <= 0.001) continue;
          vec4 flowWake = obstacleFlowWake[obstacleIndex];
          vec4 response = obstacleResponse[obstacleIndex];
          vec2 flowDirectionVector = normalize(flowWake.xy);
          vec2 lateralDirection = vec2(-flowDirectionVector.y, flowDirectionVector.x);
          vec2 relative = worldPosition - centerRadiusContact.xy;
          float along = dot(relative, flowDirectionVector);
          float across = dot(relative, lateralDirection);
          float radius = centerRadiusContact.z;

          // Stagnation pressure raises the upstream nose while acceleration
          // around the two shoulders lowers the local free surface. Both use
          // the rendered clast radius and the same bounded response as the
          // fragment normal field.
          vec2 compressionFrame = vec2(
            (along + radius * 0.86) / max(radius * 0.72, 0.025),
            across / max(radius * 0.92, 0.025)
          );
          float upstreamCompression = (1.0 - smoothstep(
            0.18,
            1.15,
            length(compressionFrame)
          )) * centerRadiusContact.w;
          float normalizedAcross = abs(across) / max(radius, 0.025);
          float normalizedAlong = abs(along) / max(radius, 0.025);
          float sideSpeedup = smoothstep(0.26, 0.72, normalizedAcross)
            * (1.0 - smoothstep(1.08, 1.9, normalizedAcross))
            * (1.0 - smoothstep(0.36, 1.55, normalizedAlong))
            * centerRadiusContact.w;
          float compressionAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumUpstreamCompressionMeters.toFixed(3)},
            radius * response.y * 1.15
          );
          float sideDrawdownAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumSideDrawdownMeters.toFixed(3)},
            radius * response.y * 0.55
          );
          displacement += upstreamCompression * compressionAmplitude
            - sideSpeedup * sideDrawdownAmplitude;

          // Only the downstream half-plane receives the alternating shed
          // wake. Its expanding lateral envelope and bounded amplitude keep
          // this centimetre-scale creek response distinct from ocean waves.
          float downstream = smoothstep(radius * 0.18, radius * 0.82, along)
            * (1.0 - smoothstep(flowWake.z * 0.7, flowWake.z, along));
          float wakeProgress = clamp(along / max(flowWake.z, 0.001), 0.0, 1.0);
          float wakeWidth = mix(radius * 0.58, flowWake.w, sqrt(wakeProgress));
          float lateralEnvelope = 1.0 - smoothstep(
            wakeWidth * 0.18,
            max(wakeWidth, 0.02),
            abs(across)
          );
          float wakePhase = along / max(radius, 0.07) * 3.65
            - time * (2.25 + centerRadiusContact.w * 1.15)
            + across / max(wakeWidth, 0.02) * 2.4;
          float wakeAmplitude = min(
            ${BROOK_FREE_SURFACE_PROFILE.maximumWakeAmplitudeMeters.toFixed(3)},
            radius * response.y * 0.65
          );
          displacement += sin(wakePhase) * downstream * lateralEnvelope
            * wakeAmplitude * centerRadiusContact.w;
        }
        return clamp(
          displacement,
          -${BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters.toFixed(3)},
          ${BROOK_FREE_SURFACE_PROFILE.maximumDisplacementMeters.toFixed(3)}
        );
      }

      void main() {
        vUv = uv;
        vRibbonColor = color;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        float surfaceDisplacementMeters = sampleObstacleSurfaceDisplacement(
          worldPosition.xz
        );
        worldPosition.y += surfaceDisplacementMeters;
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vPlanarReflectionCoord = planarReflectionMatrix * worldPosition;
        vFlowDirection = flowDirection;
        vFlowEnergy = flowEnergy;
        vWaterDepthMeters = max(0.0, waterDepthMeters + surfaceDisplacementMeters);
        vSurfaceDisplacementMeters = surfaceDisplacementMeters;
        vec4 mvPosition = viewMatrix * worldPosition;
        vViewPosition = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      #include <packing>
      uniform float time;
      uniform float detailMix;
      uniform sampler2D flowAlbedo;
      uniform sampler2D flowRoughness;
      uniform sampler2D flowNormal;
      uniform sampler2D channelBed;
      uniform vec3 shallowColor;
      uniform vec3 deepColor;
      uniform vec3 skyColor;
      uniform vec3 foamColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      uniform sampler2D sceneReflectionPanorama;
      uniform sampler2D planarReflection;
      uniform vec3 planarReflectionCenter;
      uniform vec3 planarReflectionTangent;
      uniform vec3 planarReflectionPlaneNormal;
      uniform vec2 planarReflectionHalfExtent;
      uniform float planarReflectionPlaneTolerance;
      uniform float planarReflectionReady;
      uniform float planarReflectionMix;
      uniform sampler2D sceneRefractionColor;
      uniform sampler2D sceneRefractionDepth;
      uniform float sceneRefractionReady;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform mat4 cameraProjectionMatrix;
      uniform mat4 cameraProjectionInverse;
      uniform float reflectionPanoramaMix;
      uniform float bedTransmissionMix;
      uniform float ssrSteps;
      uniform float ssrRange;
      uniform float ssrStrength;
      uniform float ssrThickness;
      uniform float ssrThicknessSlope;
      uniform float obstacleCount;
      uniform vec4 obstacleCenterRadiusContact[12];
      uniform vec4 obstacleFlowWake[12];
      uniform vec4 obstacleResponse[12];
      varying vec2 vUv;
      varying vec4 vRibbonColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vViewPosition;
      varying vec4 vPlanarReflectionCoord;
      varying float vFlowDirection;
      varying float vFlowEnergy;
      varying float vWaterDepthMeters;
      varying float vSurfaceDisplacementMeters;

      const float PI = 3.141592653589793;

      mat2 rotateUv(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine);
      }

      vec3 unpackFlowNormal(vec3 encoded) {
        return normalize(encoded * 2.0 - 1.0);
      }

      vec2 equirectangularUv(vec3 direction) {
        vec3 unitDirection = normalize(direction);
        return vec2(
          fract(atan(unitDirection.z, unitDirection.x) / (2.0 * PI) + 0.5),
          clamp(asin(unitDirection.y) / PI + 0.5, 0.002, 0.998)
        );
      }

      vec3 reconstructViewPosition(vec2 screenUv, float depth) {
        vec4 clipPosition = vec4(screenUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 viewPosition = cameraProjectionInverse * clipPosition;
        return viewPosition.xyz / max(viewPosition.w, 0.00001);
      }

      vec2 projectViewPosition(vec3 viewPosition) {
        vec4 clipPosition = cameraProjectionMatrix * vec4(viewPosition, 1.0);
        return clipPosition.xy / max(clipPosition.w, 0.00001) * 0.5 + 0.5;
      }

      float insideViewport(vec2 screenUv) {
        return step(0.002, screenUv.x) * step(screenUv.x, 0.998)
          * step(0.002, screenUv.y) * step(screenUv.y, 0.998);
      }

      vec4 traceScreenSpaceReflection(
        vec3 rayOrigin,
        vec3 rayDirection,
        float aboveSurface
      ) {
        if (ssrSteps < 0.5 || aboveSurface < 0.5 || sceneRefractionReady < 0.5) {
          return vec4(0.0);
        }

        float rayLength = ssrRange;
        if (rayDirection.z > 0.0001) {
          rayLength = min(
            rayLength,
            (-cameraNear * 1.08 - rayOrigin.z) / rayDirection.z
          );
        }
        if (rayLength < 0.08) return vec4(0.0);

        vec3 rayEnd = rayOrigin + rayDirection * rayLength;
        vec4 clipStart = cameraProjectionMatrix * vec4(rayOrigin, 1.0);
        vec4 clipEnd = cameraProjectionMatrix * vec4(rayEnd, 1.0);
        float inverseWStart = 1.0 / max(clipStart.w, 0.00001);
        float inverseWEnd = 1.0 / max(clipEnd.w, 0.00001);
        vec2 projectedStart = clipStart.xy * inverseWStart;
        vec2 projectedEnd = clipEnd.xy * inverseWEnd;
        vec3 perspectiveStart = rayOrigin * inverseWStart;
        vec3 perspectiveEnd = rayEnd * inverseWEnd;
        float previousProgress = 0.0;
        float hitProgress = 0.0;
        float hitThickness = 0.0;
        vec2 hitUv = vec2(0.0);
        float foundHit = 0.0;

        for (int stepIndex = 1; stepIndex <= 20; stepIndex += 1) {
          if (float(stepIndex) > ssrSteps) break;
          float progress = float(stepIndex) / max(ssrSteps, 1.0);
          vec2 projected = mix(projectedStart, projectedEnd, progress);
          vec2 sampleUv = projected * 0.5 + 0.5;
          if (insideViewport(sampleUv) < 0.5) break;

          float sampledDepth = texture2D(sceneRefractionDepth, sampleUv).r;
          if (sampledDepth < 0.999995) {
            float inverseW = mix(inverseWStart, inverseWEnd, progress);
            vec3 rayPosition = mix(
              perspectiveStart,
              perspectiveEnd,
              progress
            ) / max(inverseW, 0.00001);
            vec3 scenePosition = reconstructViewPosition(sampleUv, sampledDepth);
            float thickness = scenePosition.z - rayPosition.z;
            float thicknessWindow = ssrThickness
              + abs(scenePosition.z) * ssrThicknessSlope;
            if (thickness >= 0.0 && thickness <= thicknessWindow) {
              hitProgress = progress;
              hitThickness = thickness;
              hitUv = sampleUv;
              foundHit = 1.0;
              break;
            }
          }
          previousProgress = progress;
        }

        if (foundHit < 0.5) return vec4(0.0);

        // Refine only inside the first accepted depth interval. The opaque
        // capture does not contain the water, so no arbitrary self-hit bias is
        // needed at the ray origin.
        float lowerProgress = previousProgress;
        float upperProgress = hitProgress;
        for (int refineIndex = 0; refineIndex < 3; refineIndex += 1) {
          float progress = (lowerProgress + upperProgress) * 0.5;
          vec2 projected = mix(projectedStart, projectedEnd, progress);
          vec2 sampleUv = projected * 0.5 + 0.5;
          float sampledDepth = texture2D(
            sceneRefractionDepth,
            clamp(sampleUv, vec2(0.002), vec2(0.998))
          ).r;
          float inverseW = mix(inverseWStart, inverseWEnd, progress);
          vec3 rayPosition = mix(
            perspectiveStart,
            perspectiveEnd,
            progress
          ) / max(inverseW, 0.00001);
          vec3 scenePosition = reconstructViewPosition(sampleUv, sampledDepth);
          float thickness = scenePosition.z - rayPosition.z;
          if (sampledDepth < 0.999995 && thickness >= 0.0) {
            upperProgress = progress;
            hitUv = sampleUv;
            hitThickness = thickness;
          } else {
            lowerProgress = progress;
          }
        }

        float edgeDistance = min(
          min(hitUv.x, 1.0 - hitUv.x),
          min(hitUv.y, 1.0 - hitUv.y)
        );
        float edgeConfidence = smoothstep(0.0, 0.075, edgeDistance);
        float refinedDepth = texture2D(sceneRefractionDepth, hitUv).r;
        vec3 refinedScenePosition = reconstructViewPosition(hitUv, refinedDepth);
        float thicknessWindow = ssrThickness
          + abs(refinedScenePosition.z) * ssrThicknessSlope;
        float thicknessConfidence = 1.0 - smoothstep(
          thicknessWindow * 0.45,
          thicknessWindow,
          hitThickness
        );
        vec3 reflectedSceneColor = texture2D(sceneRefractionColor, hitUv).rgb;
        return vec4(
          reflectedSceneColor,
          edgeConfidence * thicknessConfidence * aboveSurface
        );
      }

      void sampleRenderedObstacleFlow(
        vec2 worldPosition,
        out vec2 surfaceSlope,
        out float wakeEnergy,
        out float aeration,
        out float roughnessGain
      ) {
        surfaceSlope = vec2(0.0);
        wakeEnergy = 0.0;
        aeration = 0.0;
        roughnessGain = 0.0;
        for (int obstacleIndex = 0; obstacleIndex < 12; obstacleIndex += 1) {
          if (float(obstacleIndex) >= obstacleCount) break;
          vec4 centerRadiusContact = obstacleCenterRadiusContact[obstacleIndex];
          if (centerRadiusContact.z <= 0.001 || centerRadiusContact.w <= 0.001) continue;
          vec4 flowWake = obstacleFlowWake[obstacleIndex];
          vec4 response = obstacleResponse[obstacleIndex];
          vec2 flowDirection = normalize(flowWake.xy);
          vec2 lateralDirection = vec2(-flowDirection.y, flowDirection.x);
          vec2 relative = worldPosition - centerRadiusContact.xy;
          float along = dot(relative, flowDirection);
          float across = dot(relative, lateralDirection);
          float radius = centerRadiusContact.z;
          float radiusSquared = radius * radius;
          float distanceSquared = max(dot(relative, relative), radiusSquared * 1.02);
          float distanceFromCenter = sqrt(distanceSquared);
          float outsideBody = smoothstep(radius * 0.94, radius * 1.08, distanceFromCenter);
          float nearField = (1.0 - smoothstep(
            radius * 1.04,
            max(response.x, radius * 1.08),
            distanceFromCenter
          )) * outsideBody * centerRadiusContact.w;

          // The near field follows the bounded inviscid cylinder solution. It
          // bends the local velocity around the actual rendered clast instead
          // of painting circular ripple decals around an arbitrary point.
          float inverseDistanceFourth = 1.0 / max(
            distanceSquared * distanceSquared,
            radiusSquared * radiusSquared * 1.04
          );
          vec2 potentialPerturbationLocal = vec2(
            -radiusSquared * (along * along - across * across) * inverseDistanceFourth,
            -2.0 * radiusSquared * along * across * inverseDistanceFourth
          );
          vec2 potentialPerturbation = flowDirection * potentialPerturbationLocal.x
            + lateralDirection * potentialPerturbationLocal.y;
          float potentialMagnitude = length(potentialPerturbation);
          if (potentialMagnitude > 0.0001) {
            surfaceSlope += potentialPerturbation / potentialMagnitude
              * min(potentialMagnitude, 1.25)
              * response.y
              * nearField;
          }

          // Separation and alternating shedding are allowed only downstream.
          // Their envelope expands with distance while decaying before the
          // authored wake bound; the rock remains the sole spatial source.
          float downstream = smoothstep(radius * 0.18, radius * 0.82, along)
            * (1.0 - smoothstep(flowWake.z * 0.7, flowWake.z, along));
          float wakeProgress = clamp(along / max(flowWake.z, 0.001), 0.0, 1.0);
          float wakeWidth = mix(radius * 0.58, flowWake.w, sqrt(wakeProgress));
          float lateralEnvelope = 1.0 - smoothstep(
            wakeWidth * 0.18,
            max(wakeWidth, 0.02),
            abs(across)
          );
          float wake = downstream * lateralEnvelope * centerRadiusContact.w;
          float sheddingPhase = along / max(radius, 0.07) * 3.65
            - time * (2.25 + centerRadiusContact.w * 1.15)
            + across / max(wakeWidth, 0.02) * 2.4;
          float alternatingVortex = sin(sheddingPhase);
          float compressionWave = cos(sheddingPhase * 0.52 - 0.7);
          surfaceSlope += (
            lateralDirection * alternatingVortex
              + flowDirection * compressionWave * 0.28
          ) * response.y * wake * 0.58;
          float upstreamCompression = nearField
            * (1.0 - smoothstep(-radius * 0.12, radius * 0.72, along))
            * smoothstep(0.08, 0.56, potentialMagnitude);
          float separatedFlowEnergy = max(wake, upstreamCompression * 0.68);
          wakeEnergy = max(wakeEnergy, separatedFlowEnergy);
          aeration = max(
            aeration,
            response.z * separatedFlowEnergy
              * (0.62 + abs(alternatingVortex) * 0.38)
          );
          roughnessGain = max(
            roughnessGain,
            response.w * max(separatedFlowEnergy, nearField * 0.54)
          );
        }
        float aggregateSlope = length(surfaceSlope);
        if (aggregateSlope > 0.052) {
          surfaceSlope *= 0.052 / aggregateSlope;
        }
      }

      void main() {
        float edgeDistance = min(vUv.x, 1.0 - vUv.x);
        float waterDepthMeters = clamp(vWaterDepthMeters, 0.0, 0.36);
        float channelDepth = smoothstep(0.012, 0.285, waterDepthMeters);
        float signedFlow = clamp(vFlowDirection, -1.0, 1.0);
        float hydraulicEnergy = clamp(vFlowEnergy, 0.0, 1.0);
        vec2 obstacleSlope;
        float obstacleWakeEnergy;
        float obstacleAeration;
        float obstacleRoughnessGain;
        sampleRenderedObstacleFlow(
          vWorldPosition.xz,
          obstacleSlope,
          obstacleWakeEnergy,
          obstacleAeration,
          obstacleRoughnessGain
        );
        vec2 broadUv = vec2(
          vUv.x * 3.4,
          vUv.y * 11.0 - time * 0.34 * signedFlow
        ) + obstacleSlope * vec2(3.6, 2.25);
        vec2 fineUv = rotateUv(0.49) * vec2(vUv.x * 7.2, vUv.y * 23.0)
          + vec2(time * 0.11 * signedFlow, -time * 0.61 * signedFlow)
          + obstacleSlope * vec2(7.8, 5.4);
        vec3 broadNormal = unpackFlowNormal(texture2D(flowNormal, broadUv).xyz);
        vec3 fineNormal = unpackFlowNormal(texture2D(flowNormal, fineUv).xyz);
        float wettedSurface = smoothstep(0.008, 0.055, waterDepthMeters);
        vec2 broadRippleSlope = broadNormal.xy
          * mix(0.44, 0.72, hydraulicEnergy)
          * wettedSurface;
        vec2 fineRippleSlope = fineNormal.xy
          * mix(0.12, 0.24, hydraulicEnergy)
          * detailMix
          * wettedSurface;
        vec2 rippleSlope = broadRippleSlope + fineRippleSlope
          + obstacleSlope * wettedSurface;
        vec3 geometricNormal = normalize(vWorldNormal);
        vec3 surfaceNormal = normalize(
          geometricNormal + vec3(rippleSlope.x, 0.0, rippleSlope.y)
        );

        vec2 colourUv = vec2(
          vUv.x * 2.1 + time * 0.018 * signedFlow,
          vUv.y * 5.6 - time * 0.12 * signedFlow
        );
        float mineralNoise = texture2D(flowAlbedo, colourUv).g;
        float textureRoughness = texture2D(flowRoughness, fineUv * 0.72).r;
        float roughness = clamp(
          0.06 + textureRoughness * 0.22 + hydraulicEnergy * 0.07
            + obstacleRoughnessGain,
          0.11,
          0.34
        );

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float viewFacing = clamp(dot(surfaceNormal, viewDirection), 0.0, 1.0);
        float fresnel = 0.02037 + 0.97963 * pow(1.0 - viewFacing, 5.0);

        vec2 distortedBedUv = vWorldPosition.xz * 0.085
          + rippleSlope * vec2(0.13, 0.1);
        vec3 channelBedColor = texture2D(channelBed, distortedBedUv).rgb;
        // Water-column thickness comes from the same water level and terrain
        // heightfield used by hydrology and collision. Grazing views lengthen
        // that measured vertical column; no painted centre-channel depth is used.
        float opticalThickness = clamp(
          waterDepthMeters / max(viewFacing, 0.32),
          0.006,
          0.72
        );
        vec3 absorptionCoefficient = vec3(0.72, 0.22, 0.13);
        vec3 transmittance = exp(-absorptionCoefficient * opticalThickness);
        vec3 waterScatterColor = mix(shallowColor, deepColor, channelDepth * 0.68);
        vec3 transmittedBed = channelBedColor * transmittance
          + waterScatterColor * (vec3(1.0) - transmittance);
        vec3 waterColor = transmittedBed;

        // Snell refraction is evaluated in view space. The depth buffer then
        // supplies the actual opaque surface behind this water fragment, so the
        // Beer-Lambert path is measured from geometry rather than painted into
        // the ribbon. A second depth sample refines the first channel-depth guess.
        const float AIR_TO_WATER_ETA = 0.7501875;
        vec3 incidentWorldDirection = normalize(vWorldPosition - cameraPosition);
        vec3 incidentViewDirection = normalize(mat3(viewMatrix) * incidentWorldDirection);
        vec3 rippleNormalView = normalize(mat3(viewMatrix) * surfaceNormal);
        vec3 rippleRefraction = refract(incidentViewDirection, rippleNormalView, AIR_TO_WATER_ETA);
        float estimatedWaterPath = clamp(opticalThickness, 0.012, 0.72);
        vec2 firstProjectedUv = projectViewPosition(
          vViewPosition + rippleRefraction * estimatedWaterPath
        );
        vec2 firstRefractionUv = clamp(
          firstProjectedUv,
          vec2(0.002),
          vec2(0.998)
        );
        float waterViewZ = perspectiveDepthToViewZ(gl_FragCoord.z, cameraNear, cameraFar);
        float firstOpaqueDepth = texture2D(sceneRefractionDepth, firstRefractionUv).r;
        float firstOpaqueViewZ = perspectiveDepthToViewZ(firstOpaqueDepth, cameraNear, cameraFar);
        vec3 firstOpaqueViewPosition = reconstructViewPosition(
          firstRefractionUv,
          firstOpaqueDepth
        );
        float firstWaterPath = clamp(
          length(firstOpaqueViewPosition - vViewPosition)
            * step(0.001, waterViewZ - firstOpaqueViewZ)
            * insideViewport(firstProjectedUv),
          0.0,
          0.85
        );
        vec2 projectedRefractionUv = projectViewPosition(
          vViewPosition + rippleRefraction * max(firstWaterPath, 0.025)
        );
        vec2 refractionUv = clamp(
          projectedRefractionUv,
          vec2(0.002),
          vec2(0.998)
        );
        float opaqueDepth = texture2D(sceneRefractionDepth, refractionUv).r;
        float opaqueViewZ = perspectiveDepthToViewZ(opaqueDepth, cameraNear, cameraFar);
        vec3 opaqueViewPosition = reconstructViewPosition(refractionUv, opaqueDepth);
        float measuredWaterPath = clamp(
          length(opaqueViewPosition - vViewPosition)
            * step(0.001, waterViewZ - opaqueViewZ),
          0.0,
          0.85
        );
        float depthIsBehindWater = step(0.002, measuredWaterPath);
        float depthIsGeometry = 1.0 - step(0.999995, opaqueDepth);
        float sceneDepthValid = sceneRefractionReady
          * depthIsBehindWater
          * depthIsGeometry
          * insideViewport(projectedRefractionUv);
        vec3 refractedSceneColor = texture2D(sceneRefractionColor, refractionUv).rgb;
        vec3 measuredTransmittance = exp(
          -absorptionCoefficient * max(measuredWaterPath, 0.025)
        );
        vec3 transmittedScene = refractedSceneColor * measuredTransmittance
          + deepColor * (vec3(1.0) - measuredTransmittance);
        vec3 transmittedSurface = mix(transmittedBed, transmittedScene, sceneDepthValid);
        float transmissionWeight = (1.0 - fresnel)
          * mix(bedTransmissionMix * 0.92, bedTransmissionMix, sceneDepthValid);
        waterColor = mix(waterScatterColor, transmittedSurface, transmissionWeight);

        // Roughness broadens the lobe; it must not invent a large normal-incidence
        // mirror term. Fresh water starts near the dielectric F0 above.
        float reflectionStrength = clamp(
          fresnel + roughness * 0.012,
          0.02037,
          0.72
        );
        float warmReflection = pow(max(dot(reflect(-normalize(sunDirection), surfaceNormal), viewDirection), 0.0), 54.0);
        vec3 reflectedSky = mix(skyColor, sunColor, warmReflection * 0.48);
        vec3 incidentDirection = normalize(vWorldPosition - cameraPosition);
        vec3 reflectedDirection = reflect(incidentDirection, surfaceNormal);
        vec3 localSceneReflection = texture2D(
          sceneReflectionPanorama,
          equirectangularUv(reflectedDirection)
        ).rgb;
        vec3 reflectedScene = mix(
          reflectedSky,
          localSceneReflection,
          reflectionPanoramaMix
        );
        vec4 distortedReflectionCoord = vPlanarReflectionCoord;
        vec2 reflectionSlope = broadRippleSlope + fineRippleSlope * 0.22;
        distortedReflectionCoord.xy += reflectionSlope * 0.028
          * distortedReflectionCoord.w;
        vec2 planarUv = distortedReflectionCoord.xy
          / max(distortedReflectionCoord.w, 0.0001);
        float planarInside = step(0.001, distortedReflectionCoord.w)
          * step(0.002, planarUv.x) * step(planarUv.x, 0.998)
          * step(0.002, planarUv.y) * step(planarUv.y, 0.998);
        vec3 activeTangent = normalize(planarReflectionTangent);
        vec3 activeAcross = normalize(vec3(-activeTangent.z, 0.0, activeTangent.x));
        vec3 activeDelta = vWorldPosition - planarReflectionCenter;
        float activeAlong = abs(dot(activeDelta, activeTangent))
          / max(planarReflectionHalfExtent.y, 0.001);
        float activeCross = abs(dot(activeDelta, activeAcross))
          / max(planarReflectionHalfExtent.x, 0.001);
        float activeFootprint = 1.0 - smoothstep(
          0.72,
          1.0,
          max(activeAlong, activeCross)
        );
        float activePlaneDistance = abs(dot(activeDelta, planarReflectionPlaneNormal));
        float activePlaneAgreement = 1.0 - smoothstep(
          planarReflectionPlaneTolerance * 0.55,
          planarReflectionPlaneTolerance,
          activePlaneDistance
        );
        vec3 planarSceneReflection = texture2D(
          planarReflection,
          clamp(planarUv, vec2(0.002), vec2(0.998))
        ).rgb;
        reflectedScene = mix(
          reflectedScene,
          planarSceneReflection,
          planarReflectionReady * planarReflectionMix * planarInside
            * activeFootprint * activePlaneAgreement
            * mix(1.0, 0.56, hydraulicEnergy)
        );
        // Screen-space rays attach nearby reflected trunks and rocks to the
        // actual depth buffer. A calmer ray normal preserves coherent shapes;
        // Fresnel and final shading still use the full ripple normal. Misses,
        // occlusion and viewport exits fade back to the local planar/probe pair.
        vec3 geometricNormalView = normalize(mat3(viewMatrix) * geometricNormal);
        vec3 coherentReflectionNormal = normalize(mix(
          rippleNormalView,
          geometricNormalView,
          clamp(0.54 + roughness * 0.72, 0.54, 0.74)
        ));
        vec3 reflectedViewRay = normalize(reflect(
          incidentViewDirection,
          coherentReflectionNormal
        ));
        float reflectedRayAboveSurface = step(
          0.015,
          dot(reflectedViewRay, geometricNormalView)
        );
        vec4 screenSpaceReflection = traceScreenSpaceReflection(
          vViewPosition,
          reflectedViewRay,
          reflectedRayAboveSurface
        );
        float screenSpaceConfidence = screenSpaceReflection.a
          * ssrStrength
          * mix(0.92, 0.64, roughness);
        reflectedScene = mix(
          reflectedScene,
          screenSpaceReflection.rgb,
          screenSpaceConfidence
        );
        vec3 colour = mix(waterColor, reflectedScene, reflectionStrength);

        float bankContact = 1.0 - smoothstep(0.055, 0.22, edgeDistance);
        float foamNoise = broadNormal.x * 0.44 + fineNormal.y * 0.31 + mineralNoise * 0.4;
        float bankAeration = smoothstep(0.12, 0.54, foamNoise)
          * bankContact
          * smoothstep(0.16, 0.72, hydraulicEnergy)
          * 0.2;
        float hydraulicAeration = smoothstep(0.18, 0.62, foamNoise)
          * smoothstep(0.035, 0.16, waterDepthMeters)
          * hydraulicEnergy * 0.22;
        float obstacleContactAeration = obstacleAeration
          * smoothstep(-0.16, 0.48, foamNoise + obstacleWakeEnergy * 0.4)
          * smoothstep(0.018, 0.12, waterDepthMeters);
        float foam = clamp(
          bankAeration + hydraulicAeration + obstacleContactAeration,
          0.0,
          0.4
        );
        colour = mix(colour, foamColor, foam);

        float feather = smoothstep(0.0, 0.82, vRibbonColor.a);
        // The shader already resolves an approximate transmitted riverbed, so
        // keep the channel core nearly opaque and only feather the physical bank.
        float alpha = feather * clamp(0.88 + fresnel * 0.08 + foam * 0.08, 0.0, 0.98);
        gl_FragColor = vec4(colour, alpha);
        #include <fog_fragment>
      }
    `,
  });
  material.name = 'Project Plateau measured-column shallow brook';
  return material;
}

function applyBrookObstacleFlowField(material, field) {
  const centerUniforms = material.uniforms.obstacleCenterRadiusContact.value;
  const flowUniforms = material.uniforms.obstacleFlowWake.value;
  const responseUniforms = material.uniforms.obstacleResponse.value;
  centerUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  flowUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  responseUniforms.forEach((uniform) => uniform.set(0, 0, 0, 0));
  field.selected.forEach((obstacle, index) => {
    centerUniforms[index].set(
      obstacle.x,
      obstacle.z,
      obstacle.radiusMeters,
      obstacle.upperColumnContact,
    );
    flowUniforms[index].set(
      obstacle.flowDirection.x,
      obstacle.flowDirection.y,
      obstacle.wakeLengthMeters,
      obstacle.wakeHalfWidthMeters,
    );
    responseUniforms[index].set(
      obstacle.deflectionRadiusMeters,
      obstacle.normalSlope,
      obstacle.aeration,
      obstacle.roughnessGain,
    );
  });
  material.uniforms.obstacleCount.value = Math.min(
    field.selected.length,
    BROOK_OBSTACLE_FLOW_PROFILE.activeCountByQuality.balanced,
  );
}

export { applyBrookObstacleFlowField, createBrookMaterial };
