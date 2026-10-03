import * as THREE from 'three';

// The glass is the window inside the camera overlay (#camera-overlay: inset
// 8vh 12vw 12vh plus a 4vw border), expressed in normalised device
// coordinates. Plates are graded, and stored, from this window only.
export const PLATE_WINDOW = Object.freeze({ left: -0.68, right: 0.68, bottom: -0.632, top: 0.712 });
const WINDOW_HEIGHT = (PLATE_WINDOW.top - PLATE_WINDOW.bottom) / 2;
const TERRAIN_SAMPLES = 12;

function localAnchorsFor(object) {
  object.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  object.traverse((child) => {
    if (!child.isMesh || !child.visible || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    meshBox.copy(child.geometry.boundingBox)
      .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
    box.union(meshBox);
  });
  if (box.isEmpty()) return null;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const along = size.x >= size.z ? new THREE.Vector3(size.x * 0.42, 0, 0) : new THREE.Vector3(0, 0, size.z * 0.42);
  return [
    centre.clone(),
    centre.clone().add(along),
    centre.clone().sub(along),
    new THREE.Vector3(centre.x, box.max.y - size.y * 0.08, centre.z),
    new THREE.Vector3(centre.x, box.min.y + size.y * 0.06, centre.z),
  ];
}

// Projects a few anchor points of every rendered subject through the live
// camera, so the simulation grades the plate from what is on the glass.
export function createFrameEvidenceProbe({
  camera: liveCamera,
  terrainHeight,
  subjects,
  occluders = () => [],
  lensFov = () => null,
}) {
  const raycaster = new THREE.Raycaster();
  // The plate is taken through the lens at its working focal length, not the
  // half-raised view of the moment the camera comes up.
  const lens = new THREE.PerspectiveCamera();
  let camera = liveCamera;
  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const direction = new THREE.Vector3();

  function terrainBlocks(target) {
    for (let step = 1; step < TERRAIN_SAMPLES; step += 1) {
      const t = step / TERRAIN_SAMPLES;
      const x = camera.position.x + (target.x - camera.position.x) * t;
      const y = camera.position.y + (target.y - camera.position.y) * t;
      const z = camera.position.z + (target.z - camera.position.z) * t;
      if (terrainHeight(x, z) > y + 0.15) return true;
    }
    return false;
  }

  function canopyBlocks(target, objects) {
    if (!objects.length) return false;
    direction.copy(target).sub(camera.position);
    const distance = direction.length();
    raycaster.set(camera.position, direction.normalize());
    raycaster.far = Math.max(0, distance - 1.2);
    return raycaster.intersectObjects(objects, true).length > 0;
  }

  function measure({ canopy = false } = {}) {
    liveCamera.updateMatrixWorld();
    const fov = lensFov();
    camera = liveCamera;
    if (fov && Math.abs(fov - liveCamera.fov) > 0.01) {
      lens.position.copy(liveCamera.position);
      lens.quaternion.copy(liveCamera.quaternion);
      lens.aspect = liveCamera.aspect;
      lens.near = liveCamera.near;
      lens.far = liveCamera.far;
      lens.fov = fov;
      lens.updateProjectionMatrix();
      lens.updateMatrixWorld();
      camera = lens;
    }
    const evidence = [];
    const canopyObjects = canopy ? occluders() : [];
    for (const entry of subjects()) {
      const { object } = entry;
      if (!object?.visible) continue;
      object.userData.frameAnchors ??= localAnchorsFor(object);
      const anchors = object.userData.frameAnchors;
      if (!anchors) continue;
      object.updateWorldMatrix(true, false);
      let inFrame = 0;
      let blocked = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let front = 0;
      let centre = null;
      let centred = false;
      anchors.forEach((anchor, index) => {
        world.copy(anchor).applyMatrix4(object.matrixWorld);
        if (index === 0) centre = world.clone();
        ndc.copy(world).project(camera);
        if (ndc.z <= -1 || ndc.z >= 1) return;
        if (index === 0) {
          centred = Math.abs(ndc.x) <= PLATE_WINDOW.right * 0.7
            && ndc.y >= PLATE_WINDOW.bottom * 0.7 && ndc.y <= PLATE_WINDOW.top * 0.7;
        }
        front += 1;
        minX = Math.min(minX, ndc.x);
        maxX = Math.max(maxX, ndc.x);
        minY = Math.min(minY, ndc.y);
        maxY = Math.max(maxY, ndc.y);
        if (ndc.x < PLATE_WINDOW.left || ndc.x > PLATE_WINDOW.right
          || ndc.y < PLATE_WINDOW.bottom || ndc.y > PLATE_WINDOW.top) return;
        inFrame += 1;
        if (terrainBlocks(world)) blocked += 1;
      });
      if (front === 0) continue;
      const widthToHeight = camera.aspect;
      const projectedSize = Math.max(maxY - minY, (maxX - minX) * widthToHeight) / 2 / WINDOW_HEIGHT;
      const occluded = inFrame > 0 && (
        blocked * 2 >= inFrame || (canopy && centre && canopyBlocks(centre, canopyObjects))
      );
      evidence.push({
        subject: entry.subject,
        role: entry.role ?? null,
        inFrameFraction: Number((inFrame / anchors.length).toFixed(3)),
        projectedSize: Number(projectedSize.toFixed(3)),
        centred,
        occluded,
      });
    }
    return evidence;
  }

  return { measure };
}
