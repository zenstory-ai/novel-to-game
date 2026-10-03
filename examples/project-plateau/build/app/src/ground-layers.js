import * as THREE from 'three';

// Blender-baked tileable ground layers (scripts/blender/bake_ground_textures.py).
// Each strip stacks the layers vertically; they become sampler2DArray slices.
export const GROUND_LAYER_NAMES = Object.freeze(['litter', 'moss', 'mud', 'gravel', 'rock']);
export const GROUND_TILE_METERS = 2.6;

const STRIPS = Object.freeze({
  albedo: 'assets/ground/ground-albedo.jpg',
  normal: 'assets/ground/ground-normal.jpg',
  orh: 'assets/ground/ground-orh.jpg',
});

function placeholderArray(color) {
  const data = new Uint8Array(4 * GROUND_LAYER_NAMES.length);
  for (let index = 0; index < GROUND_LAYER_NAMES.length; index += 1) data.set(color, index * 4);
  const texture = new THREE.DataArrayTexture(data, 1, 1, GROUND_LAYER_NAMES.length);
  texture.needsUpdate = true;
  return texture;
}

async function decodeStrip(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The ground layer ${url} is missing from the local case.`);
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  const { width, height } = bitmap;
  const { data } = context.getImageData(0, 0, width, height);
  bitmap.close();
  return { data: new Uint8Array(data.buffer), width, height };
}

function applyStrip(texture, strip, colorSpace) {
  const layerSize = strip.width;
  texture.image = {
    data: strip.data,
    width: layerSize,
    height: layerSize,
    depth: strip.height / layerSize,
  };
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.dispose();
  texture.needsUpdate = true;
}

export function createGroundLayers(baseUrl = '/') {
  const textures = {
    albedo: placeholderArray([92, 78, 58, 255]),
    normal: placeholderArray([128, 128, 255, 255]),
    orh: placeholderArray([255, 230, 128, 255]),
  };
  let pending = null;
  function load() {
    pending ??= Promise.all(
      Object.entries(STRIPS).map(async ([key, path]) => {
        const strip = await decodeStrip(`${baseUrl}${path}`);
        applyStrip(textures[key], strip, key === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
      }),
    ).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }
  return { textures, load };
}
