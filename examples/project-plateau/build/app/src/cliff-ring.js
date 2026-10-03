import * as THREE from 'three';

// The distant plateau wall (scripts/blender/build_cliff_ring.py): one mesh,
// one material, no shadows, left to the fog.
export const CLIFF_RING_ASSET = Object.freeze({ url: '/assets/cliff-ring-v1.glb' });

// The authored wall tops out on one flat line. Lift and drop the upper band
// along the ring so the skyline reads as broken crags, not a curtain rail.
function breakSkyline(geometry) {
  const position = geometry.attributes.position;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const bandStart = min.y + (max.y - min.y) * 0.55;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    if (y <= bandStart) continue;
    const angle = Math.atan2(position.getZ(index), position.getX(index));
    // A tableland, not a sierra: the top stays level in long runs and breaks
    // in slumped notches and the odd low buttress.
    const wave = Math.sin(angle * 13 + 0.7) * 0.6 + Math.sin(angle * 37 + 2.1) * 0.4;
    const crags = wave < 0 ? wave * 7 : wave * 1.5;
    const weight = THREE.MathUtils.smoothstep(y, bandStart, max.y);
    position.setY(index, y + crags * weight);
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function createCliffRing(scene) {
  const anchor = new THREE.Group();
  anchor.name = 'world.atmosphere.cliff-ring';
  scene.add(anchor);
  let pending = null;
  function load() {
    pending ??= import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(CLIFF_RING_ASSET.url))
      .then((gltf) => {
        gltf.scene.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = false;
          object.frustumCulled = false;
          const map = object.material.map;
          if (map) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
          }
          object.material.normalScale?.set(0.8, 0.8);
          // Weathered basalt, not pale limestone: darker and slightly warm.
          object.material.color.set(0x857a70);
          breakSkyline(object.geometry);
        });
        anchor.add(gltf.scene);
        return anchor;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  }
  return { anchor, load };
}
