// One shared GLB template loader: loads once, shares the prepared template
// between callers, and forgets a failed load so the next call retries.
export function createCachedGltfLoader({ assetUrl, prepare, loaderFactory }) {
  let templatePromise;
  return function loadTemplate() {
    templatePromise ??= Promise.resolve()
      .then(async () => {
        if (loaderFactory) return loaderFactory();
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        return new GLTFLoader();
      })
      .then((loader) => loader.loadAsync(assetUrl))
      .then((gltf) => prepare(gltf.scene))
      .catch((error) => {
        templatePromise = undefined;
        throw error;
      });
    return templatePromise;
  };
}
