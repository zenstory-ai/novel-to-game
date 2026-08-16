import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BROOK_REFLECTION_PROFILE } from './brook-hydrology.js';
import { terrainHeight } from './terrain.js';

function createBrookLocalReflectionPanorama(scene, existingTexture = null) {
  const width = 512;
  const height = 256;
  const data = existingTexture?.image?.data?.length === width * height * 4
    ? existingTexture.image.data
    : new Uint8Array(width * height * 4);
  const colorBytes = (hex) => {
    const color = new THREE.Color(hex);
    return [color.r * 255, color.g * 255, color.b * 255];
  };
  const topSky = colorBytes(0x6e9295);
  const horizonSky = colorBytes(0xc59a6e);
  const horizonGround = colorBytes(0x31453d);
  const lowerGround = colorBytes(0x182722);
  const blendPixel = (x, y, color, opacity = 1) => {
    const wrappedX = ((Math.round(x) % width) + width) % width;
    const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)));
    const offset = (clampedY * width + wrappedX) * 4;
    const inverse = 1 - opacity;
    data[offset] = Math.round(data[offset] * inverse + color[0] * opacity);
    data[offset + 1] = Math.round(data[offset + 1] * inverse + color[1] * opacity);
    data[offset + 2] = Math.round(data[offset + 2] * inverse + color[2] * opacity);
    data[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    const normalized = y / (height - 1);
    const isSky = normalized >= 0.5;
    const blend = isSky ? (normalized - 0.5) * 2 : normalized * 2;
    const start = isSky ? horizonSky : lowerGround;
    const end = isSky ? topSky : horizonGround;
    const color = [
      THREE.MathUtils.lerp(start[0], end[0], blend),
      THREE.MathUtils.lerp(start[1], end[1], blend),
      THREE.MathUtils.lerp(start[2], end[2], blend),
    ];
    for (let x = 0; x < width; x += 1) blendPixel(x, y, color, 1);
  }

  const drawEllipse = (centreX, centreY, radiusX, radiusY, color, opacity) => {
    const safeRadiusX = Math.max(0.75, Math.min(width * 0.18, radiusX));
    const safeRadiusY = Math.max(0.75, Math.min(height * 0.24, radiusY));
    for (const wrappedCentre of [centreX - width, centreX, centreX + width]) {
      const minX = Math.floor(wrappedCentre - safeRadiusX);
      const maxX = Math.ceil(wrappedCentre + safeRadiusX);
      const minY = Math.max(0, Math.floor(centreY - safeRadiusY));
      const maxY = Math.min(height - 1, Math.ceil(centreY + safeRadiusY));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = (x - wrappedCentre) / safeRadiusX;
          const dy = (y - centreY) / safeRadiusY;
          const distance = dx * dx + dy * dy;
          if (distance > 1) continue;
          blendPixel(x, y, color, opacity * (1 - THREE.MathUtils.smoothstep(distance, 0.68, 1)));
        }
      }
    }
  };

  const sunDirection = new THREE.Vector3(-0.44, 0.55, 0.71).normalize();
  const sunAzimuth = Math.atan2(sunDirection.z, sunDirection.x);
  const sunElevation = Math.asin(sunDirection.y);
  drawEllipse(
    (sunAzimuth / (Math.PI * 2) + 0.5) * width,
    (sunElevation / Math.PI + 0.5) * height,
    7,
    7,
    colorBytes(0xe7c08a),
    0.72,
  );

  scene.updateMatrixWorld(true);
  const probe = new THREE.Vector3(-10.5, terrainHeight(-10.5, 28) + 1.35, 28);
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const centre = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const descriptors = [];
  const roleForName = (name) => {
    if (/cloud/i.test(name)) return 'cloud';
    if (/basalt|ridge|mountain/i.test(name)) return 'rock';
    if (/canopy|crown|leaf/i.test(name)) return 'canopy';
    if (/trunk|tree-fern-sentinel/i.test(name)) return 'trunk';
    if (/pterodactyl/i.test(name)) return 'airborne';
    return null;
  };
  const rolePalette = {
    cloud: colorBytes(0xb9c6c3),
    rock: colorBytes(0x4e5a57),
    canopy: colorBytes(0x294b3a),
    trunk: colorBytes(0x3d3c33),
    airborne: colorBytes(0x4a5558),
  };
  const isWorldVisible = (object) => {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  };
  const addDescriptor = (object, matrix, role) => {
    const sphere = object.geometry?.boundingSphere;
    if (!sphere) return;
    centre.copy(sphere.center).applyMatrix4(matrix);
    matrix.decompose(new THREE.Vector3(), rotation, scale);
    const radius = sphere.radius * Math.max(scale.x, scale.y, scale.z);
    const offset = centre.clone().sub(probe);
    const distance = offset.length();
    if (distance < 1 || distance > 240 || radius <= 0) return;
    const azimuth = Math.atan2(offset.z, offset.x);
    const elevation = Math.atan2(offset.y, Math.hypot(offset.x, offset.z));
    const angularRadius = Math.atan2(radius, distance);
    descriptors.push({
      role,
      distance,
      x: (azimuth / (Math.PI * 2) + 0.5) * width,
      y: (elevation / Math.PI + 0.5) * height,
      radius: Math.max(0.7, angularRadius / (Math.PI * 2) * width),
    });
  };
  scene.traverse((object) => {
    if (!isWorldVisible(object)) return;
    const role = roleForName(object.name ?? '');
    if (!role) return;
    if (object.isInstancedMesh) {
      object.geometry.computeBoundingSphere();
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        addDescriptor(object, worldMatrix, role);
      }
      return;
    }
    if (object.isMesh) {
      object.geometry.computeBoundingSphere();
      addDescriptor(object, object.matrixWorld, role);
      return;
    }
    if (object.isSprite) {
      object.getWorldPosition(centre);
      const offset = centre.clone().sub(probe);
      const distance = offset.length();
      if (distance < 1 || distance > 240) return;
      object.getWorldScale(scale);
      descriptors.push({
        role,
        distance,
        x: (Math.atan2(offset.z, offset.x) / (Math.PI * 2) + 0.5) * width,
        y: (Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) / Math.PI + 0.5) * height,
        radius: Math.max(1, Math.atan2(Math.max(scale.x, scale.y) * 0.5, distance) / (Math.PI * 2) * width),
      });
    }
  });
  descriptors.sort((a, b) => b.distance - a.distance);
  descriptors.forEach(({ role, x, y, radius, distance }) => {
    const opacity = role === 'cloud' ? 0.58 : THREE.MathUtils.clamp(0.82 - distance / 520, 0.42, 0.78);
    const shape = role === 'trunk'
      ? [radius * 0.34, radius * 2.5]
      : role === 'canopy' || role === 'cloud'
        ? [radius * 1.85, radius * 0.72]
        : role === 'rock'
          ? [radius * 0.88, radius * 1.42]
          : [radius * 1.7, radius * 0.4];
    drawEllipse(x, y, shape[0], shape[1], rolePalette[role], opacity);
  });

  const texture = existingTexture ?? new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = 'world.material.brook-local-scene-panorama';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.userData.sourceObjectCount = descriptors.length;
  texture.needsUpdate = true;
  return texture;
}

function createBrookSceneCapture(scene, brook, hydrology, suppressedObjects = []) {
  const material = brook.material;
  let panorama = createBrookLocalReflectionPanorama(scene);
  material.uniforms.sceneReflectionPanorama.value = panorama;
  const refractionTarget = new THREE.WebGLRenderTarget(480, 270, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  refractionTarget.texture.name = 'world.material.brook-scene-refraction-colour';
  refractionTarget.texture.colorSpace = THREE.NoColorSpace;
  refractionTarget.texture.generateMipmaps = false;
  const refractionDepth = new THREE.DepthTexture(480, 270, THREE.UnsignedIntType);
  refractionDepth.name = 'world.material.brook-scene-refraction-depth';
  refractionDepth.format = THREE.DepthFormat;
  refractionDepth.minFilter = THREE.NearestFilter;
  refractionDepth.magFilter = THREE.NearestFilter;
  refractionTarget.depthTexture = refractionDepth;
  material.uniforms.sceneRefractionColor.value = refractionTarget.texture;
  material.uniforms.sceneRefractionDepth.value = refractionDepth;
  const reflectionReaches = hydrology.reaches;
  const representativePoint = new THREE.Vector3(-10.5, 0, 28);
  let activeReach = reflectionReaches.reduce((nearest, reach) => (
    reach.center.distanceToSquared(representativePoint)
      < nearest.center.distanceToSquared(representativePoint) ? reach : nearest
  ), reflectionReaches[0]);
  const reflector = new Reflector(new THREE.PlaneGeometry(1, 1), {
    textureWidth: 320,
    textureHeight: 180,
    clipBias: 0.0025,
    multisample: 0,
  });
  reflector.name = 'world.connected_route.brook-planar-reflection-capture';
  const planarTarget = reflector.getRenderTarget();
  planarTarget.texture.name = 'world.material.brook-planar-reflection';
  const planarMatrix = material.uniforms.planarReflectionMatrix.value;
  const reflectorInverse = new THREE.Matrix4().copy(reflector.matrixWorld).invert();
  const cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const reachDelta = new THREE.Vector3();
  const lastCameraPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  const cameraQuaternion = new THREE.Quaternion();
  const lastCameraQuaternion = new THREE.Quaternion();
  const savedViewport = new THREE.Vector4();
  const savedScissor = new THREE.Vector4();
  let captureRequested = true;
  let lastCaptureFrame = -Infinity;
  const status = {
    status: 'pending-renderer',
    quality: 'balanced',
    reflectionResolution: [panorama.image.width, panorama.image.height],
    panoramaBuilds: 1,
    sourceObjectCount: panorama.userData.sourceObjectCount,
    planarResolution: [320, 180],
    planarCaptures: 0,
    reachCount: reflectionReaches.length,
    activeReachId: activeReach.id,
    activeBranch: activeReach.branch,
    activePlaneHeight: Number(activeReach.center.y.toFixed(4)),
    activePlaneNormal: activeReach.normal.toArray().map((value) => Number(value.toFixed(6))),
    activePlaneTolerance: Number((activeReach.maxSurfaceDeviation + 0.08).toFixed(4)),
    reachSwitches: 0,
    refractionResolution: [480, 270],
    refractionCaptures: 0,
    reflectionMode: 'scene-layout-equirectangular-probe-fallback',
    ssrMode: 'pending-same-camera-depth-screen-space-reflection',
    ssrSteps: BROOK_REFLECTION_PROFILE.stepsByQuality.balanced,
    ssrRangeMeters: BROOK_REFLECTION_PROFILE.maximumRangeMeters,
    planarMode: 'camera-selected-oblique-clipped-gravity-reach-reflection',
    refractionMode: 'same-camera-depth-refracted-scene-with-channel-bed-fallback',
    renderError: null,
  };
  const applyActiveReach = () => {
    reflector.position.copy(activeReach.center);
    reflector.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      activeReach.normal,
    );
    reflector.updateMatrixWorld(true);
    reflectorInverse.copy(reflector.matrixWorld).invert();
    material.uniforms.planarReflectionCenter.value.copy(activeReach.center);
    material.uniforms.planarReflectionTangent.value.copy(activeReach.tangent);
    material.uniforms.planarReflectionPlaneNormal.value.copy(activeReach.normal);
    material.uniforms.planarReflectionHalfExtent.value.set(
      activeReach.halfWidth,
      activeReach.halfLength,
    );
    material.uniforms.planarReflectionPlaneTolerance.value = Math.max(
      0.08,
      activeReach.maxSurfaceDeviation + 0.08,
    );
    status.activeReachId = activeReach.id;
    status.activeBranch = activeReach.branch;
    status.activePlaneHeight = Number(activeReach.center.y.toFixed(4));
    status.activePlaneNormal = activeReach.normal.toArray()
      .map((value) => Number(value.toFixed(6)));
    status.activePlaneTolerance = Number(
      material.uniforms.planarReflectionPlaneTolerance.value.toFixed(4),
    );
  };
  const scoreReachForCamera = (reach) => {
    reachDelta.copy(reach.center).sub(cameraPosition);
    const distanceSquared = reachDelta.lengthSq();
    const forwardDepth = reachDelta.dot(cameraDirection);
    if (forwardDepth <= 0.1) return Infinity;
    const lateralSquared = Math.max(0, distanceSquared - forwardDepth * forwardDepth);
    return lateralSquared / Math.max(forwardDepth * forwardDepth, 1)
      + forwardDepth * 0.0008;
  };
  const selectActiveReach = (force = false) => {
    cameraDirection.normalize();
    let selected = activeReach;
    let selectedScore = scoreReachForCamera(activeReach);
    for (const reach of reflectionReaches) {
      const score = scoreReachForCamera(reach);
      if (score < selectedScore) {
        selected = reach;
        selectedScore = score;
      }
    }
    if (!Number.isFinite(selectedScore)) {
      selected = reflectionReaches.reduce((nearest, reach) => (
        reach.center.distanceToSquared(cameraPosition)
          < nearest.center.distanceToSquared(cameraPosition) ? reach : nearest
      ), reflectionReaches[0]);
    }
    const activeScore = scoreReachForCamera(activeReach);
    if (selected !== activeReach && (
      force || !Number.isFinite(activeScore) || selectedScore < activeScore * 0.82
    )) {
      activeReach = selected;
      status.reachSwitches += 1;
    }
    applyActiveReach();
  };
  applyActiveReach();
  const captureResolutionForQuality = (quality) => (
    quality === 'high' ? [640, 360] : [480, 270]
  );
  const refreshStatus = () => {
    if (status.quality === 'low') {
      status.status = 'disabled-low';
    } else if (status.planarCaptures > 0 && status.refractionCaptures > 0) {
      status.status = 'ready';
    } else if (status.planarCaptures > 0 || status.refractionCaptures > 0) {
      status.status = 'partial-fallback';
    } else {
      status.status = 'pending-renderer';
    }
  };
  const setQuality = (quality) => {
    status.quality = ['low', 'balanced', 'high'].includes(quality) ? quality : 'balanced';
    if (status.quality === 'low') {
      material.uniforms.planarReflectionReady.value = 0;
      material.uniforms.sceneRefractionReady.value = 0;
      material.uniforms.reflectionPanoramaMix.value = 0;
      material.uniforms.bedTransmissionMix.value = 0.28;
      material.uniforms.ssrSteps.value = BROOK_REFLECTION_PROFILE.stepsByQuality.low;
      material.uniforms.ssrStrength.value = 0;
      status.ssrSteps = BROOK_REFLECTION_PROFILE.stepsByQuality.low;
      status.ssrMode = 'disabled-low';
      status.refractionMode = 'channel-bed-fallback-low-quality';
    } else {
      material.uniforms.planarReflectionReady.value = status.planarCaptures > 0 ? 1 : 0;
      material.uniforms.sceneRefractionReady.value = status.refractionCaptures > 0 ? 1 : 0;
      material.uniforms.planarReflectionMix.value = status.quality === 'high' ? 0.9 : 0.82;
      material.uniforms.reflectionPanoramaMix.value = status.quality === 'high' ? 0.84 : 0.76;
      material.uniforms.bedTransmissionMix.value = status.quality === 'high' ? 0.96 : 0.92;
      material.uniforms.ssrSteps.value = BROOK_REFLECTION_PROFILE.stepsByQuality[
        status.quality
      ];
      material.uniforms.ssrStrength.value = status.quality === 'high' ? 0.86 : 0.76;
      status.ssrSteps = BROOK_REFLECTION_PROFILE.stepsByQuality[status.quality];
      status.ssrMode = status.refractionCaptures > 0
        ? 'same-camera-depth-bounded-screen-space-reflection'
        : 'pending-same-camera-depth-screen-space-reflection';
      status.refractionMode = status.refractionCaptures > 0
        ? 'same-camera-depth-refracted-scene-with-channel-bed-fallback'
        : 'pending-same-camera-depth-refraction';
      const [width, height] = captureResolutionForQuality(status.quality);
      if (status.refractionResolution[0] !== width || status.refractionResolution[1] !== height) {
        refractionTarget.setSize(width, height);
        status.refractionResolution = [width, height];
        captureRequested = true;
      }
    }
    refreshStatus();
  };
  return {
    setQuality,
    requestReflectionRefresh() {
      panorama = createBrookLocalReflectionPanorama(scene, panorama);
      material.uniforms.sceneReflectionPanorama.value = panorama;
      status.panoramaBuilds += 1;
      status.sourceObjectCount = panorama.userData.sourceObjectCount;
      captureRequested = true;
      refreshStatus();
    },
    prepare(renderer, camera, quality = 'balanced', frameIndex = 0) {
      setQuality(quality);
      if (!renderer?.isWebGLRenderer || !camera?.isCamera) return;
      material.uniforms.cameraNear.value = camera.near;
      material.uniforms.cameraFar.value = camera.far;
      material.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      material.uniforms.cameraProjectionInverse.value.copy(camera.projectionMatrixInverse);
      if (status.quality === 'low') return;
      // Let the primary renderer allocate its shadow maps before the mirrored
      // and refracted cameras compile lit/instanced materials against them.
      // Capturing on frame zero binds placeholder textures to shadow samplers and
      // poisons later draws.
      if (frameIndex < 1) return;
      camera.updateMatrixWorld(true);
      camera.getWorldPosition(cameraPosition);
      camera.getWorldQuaternion(cameraQuaternion);
      camera.getWorldDirection(cameraDirection);
      const cameraPositionDeltaSquared = cameraPosition.distanceToSquared(lastCameraPosition);
      const cameraJumped = cameraPositionDeltaSquared > 25;
      const cameraMoved = cameraPositionDeltaSquared > 0.16
        || cameraQuaternion.angleTo(lastCameraQuaternion) > 0.025;
      const captureInterval = status.quality === 'high' ? 6 : 12;
      if (!captureRequested && (!cameraMoved || frameIndex - lastCaptureFrame < captureInterval)) {
        return;
      }
      selectActiveReach(captureRequested || cameraJumped);
      const hiddenObjects = [brook, ...suppressedObjects].filter(Boolean);
      const visibility = hiddenObjects.map((object) => object.visible);
      const savedRenderTarget = renderer.getRenderTarget();
      const savedXrEnabled = renderer.xr.enabled;
      const savedShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const savedScissorTest = renderer.getScissorTest();
      renderer.getViewport(savedViewport);
      renderer.getScissor(savedScissor);
      hiddenObjects.forEach((object) => { object.visible = false; });
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      const captureErrors = [];
      try {
        renderer.setRenderTarget(refractionTarget);
        renderer.setViewport(0, 0, status.refractionResolution[0], status.refractionResolution[1]);
        renderer.setScissor(0, 0, status.refractionResolution[0], status.refractionResolution[1]);
        renderer.setScissorTest(false);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        material.uniforms.sceneRefractionColor.value = refractionTarget.texture;
        material.uniforms.sceneRefractionDepth.value = refractionDepth;
        material.uniforms.sceneRefractionReady.value = 1;
        status.refractionCaptures += 1;
        status.refractionMode = 'same-camera-depth-refracted-scene-with-channel-bed-fallback';
        status.ssrMode = 'same-camera-depth-bounded-screen-space-reflection';
      } catch (error) {
        material.uniforms.sceneRefractionReady.value = 0;
        status.refractionMode = 'beer-lambert-channel-bed-fallback';
        status.ssrMode = 'disabled-capture-error';
        captureErrors.push(`refraction: ${error instanceof Error ? error.message : String(error)}`);
      }
      try {
        reflector.onBeforeRender(renderer, scene, camera);
        reflectorInverse.copy(reflector.matrixWorld).invert();
        planarMatrix
          .copy(reflector.material.uniforms.textureMatrix.value)
          .multiply(reflectorInverse);
        material.uniforms.planarReflection.value = planarTarget.texture;
        material.uniforms.planarReflectionReady.value = 1;
        status.planarCaptures += 1;
        status.reflectionMode = 'local-planar-plus-scene-layout-probe';
      } catch (error) {
        material.uniforms.planarReflectionReady.value = 0;
        status.reflectionMode = 'scene-layout-equirectangular-probe-fallback';
        captureErrors.push(`reflection: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        status.renderError = captureErrors.length > 0 ? captureErrors.join('; ') : null;
        captureRequested = false;
        lastCaptureFrame = frameIndex;
        lastCameraPosition.copy(cameraPosition);
        lastCameraQuaternion.copy(cameraQuaternion);
        refreshStatus();
        hiddenObjects.forEach((object, index) => { object.visible = visibility[index]; });
        renderer.xr.enabled = savedXrEnabled;
        renderer.shadowMap.autoUpdate = savedShadowAutoUpdate;
        renderer.setRenderTarget(savedRenderTarget);
        renderer.setViewport(savedViewport);
        renderer.setScissor(savedScissor);
        renderer.setScissorTest(savedScissorTest);
      }
    },
    snapshot() {
      return {
        status: status.status,
        quality: status.quality,
        reflectionResolution: [...status.reflectionResolution],
        panoramaBuilds: status.panoramaBuilds,
        sourceObjectCount: status.sourceObjectCount,
        planarResolution: [...status.planarResolution],
        planarCaptures: status.planarCaptures,
        reachCount: status.reachCount,
        activeReachId: status.activeReachId,
        activeBranch: status.activeBranch,
        activePlaneHeight: status.activePlaneHeight,
        activePlaneNormal: [...status.activePlaneNormal],
        activePlaneTolerance: status.activePlaneTolerance,
        reachSwitches: status.reachSwitches,
        refractionResolution: [...status.refractionResolution],
        refractionCaptures: status.refractionCaptures,
        reflectionMode: status.reflectionMode,
        planarMode: status.planarMode,
        refractionMode: status.refractionMode,
        ssrMode: status.ssrMode,
        ssrSteps: status.ssrSteps,
        ssrRangeMeters: status.ssrRangeMeters,
        renderError: status.renderError,
      };
    },
  };
}

export { createBrookSceneCapture };
