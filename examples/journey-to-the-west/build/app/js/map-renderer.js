// 连续绘景地图：分块原生重叠蒙版、当前场景 DPR 缓存、小地图与导航调试共用逻辑坐标。

const GROUND_COLORS = {
  sand: '#b99159',
  moss: '#637254',
  basalt: '#4c413b',
  slate: '#596269',
};

function tracePolygon(context, polygon, scale) {
  if (!polygon?.length) return false;
  context.beginPath();
  context.moveTo(polygon[0][0] * scale, polygon[0][1] * scale);
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index][0] * scale, polygon[index][1] * scale);
  }
  context.closePath();
  return true;
}

export function createMapRenderer(scene, { scale = 1, density = 1, textureImage } = {}) {
  const terrain = scene.terrain ?? {};
  const chunks = (terrain.chunks ?? []).map((chunk) => ({ ...chunk, image: textureImage?.(chunk.art) ?? null }));
  // 相邻块同时使用互补权重，四块交会处的权重总和仍为一。
  for (const chunk of chunks) {
    chunk.fadeRight = Math.max(0, ...chunks.filter((other) => other.at[1] === chunk.at[1]
      && other.at[0] > chunk.at[0]).map((other) => chunk.at[0] + chunk.size[0] - other.at[0]));
    chunk.fadeBottom = Math.max(0, ...chunks.filter((other) => other.at[0] === chunk.at[0]
      && other.at[1] > chunk.at[1]).map((other) => chunk.at[1] + chunk.size[1] - other.at[1]));
  }
  if (terrain.painted !== true || !chunks.length || chunks.some((chunk) => !chunk.image)) {
    throw new Error(`场景 ${scene.id ?? 'unknown'} 缺少完整绘景分块`);
  }

  const worldWidth = scene.size[0] * scale;
  const worldHeight = scene.size[1] * scale;
  const baseColor = terrain.baseColor ?? GROUND_COLORS[terrain.ground] ?? '#766451';
  let renderDensity = Math.max(1, density);
  let terrainCache = null;
  let cacheFailed = false;
  let preview = null;
  let previewWidth = 0;
  let previewHeight = 0;

  function maskedChunkSource(chunk) {
    if ((!chunk.fadeLeft && !chunk.fadeTop && !chunk.fadeRight && !chunk.fadeBottom) || chunk.maskPrepared) return chunk.renderImage ?? chunk.image;
    chunk.maskPrepared = true;
    if (typeof document === 'undefined') return chunk.image;
    const width = chunk.image.naturalWidth || chunk.image.width;
    const height = chunk.image.naturalHeight || chunk.image.height;
    if (!width || !height) return chunk.image;
    const masked = document.createElement('canvas');
    masked.width = width;
    masked.height = height;
    const context = masked.getContext('2d');
    if (!context) return chunk.image;
    context.drawImage(chunk.image, 0, 0, width, height);
    context.globalCompositeOperation = 'destination-in';
    for (const [fade, extent, horizontal, reverse] of [
      [chunk.fadeLeft, chunk.size[0], true, false],
      [chunk.fadeRight, chunk.size[0], true, true],
      [chunk.fadeTop, chunk.size[1], false, false],
      [chunk.fadeBottom, chunk.size[1], false, true],
    ]) {
      if (!fade) continue;
      const ratio = Math.min(1, fade / extent);
      const gradient = context.createLinearGradient(0, 0, horizontal ? width : 0, horizontal ? 0 : height);
      if (reverse) {
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(1 - ratio, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(ratio, 'rgba(0,0,0,1)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
      }
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    context.globalCompositeOperation = 'source-over';
    chunk.renderImage = masked;
    return masked;
  }

  function drawChunk(context, chunk, camera = null) {
    const x = chunk.at[0] * scale;
    const y = chunk.at[1] * scale;
    const width = chunk.size[0] * scale;
    const height = chunk.size[1] * scale;
    if (camera && (x > camera.x + camera.vw || y > camera.y + camera.vh
      || x + width < camera.x || y + height < camera.y)) return;
    context.drawImage(maskedChunkSource(chunk), x, y, width, height);
  }

  function drawChunkLayer(context, camera = null) {
    context.save();
    context.clearRect(0, 0, worldWidth, worldHeight);
    context.globalCompositeOperation = 'lighter';
    const orderedChunks = [...chunks].sort((left, right) => left.at[1] - right.at[1] || left.at[0] - right.at[0]);
    for (const chunk of orderedChunks) drawChunk(context, chunk, camera);
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = baseColor;
    context.fillRect(0, 0, worldWidth, worldHeight);
    context.restore();
  }

  function drawTerrainDirect(context, camera) {
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = baseColor;
    context.fillRect(0, 0, camera.vw, camera.vh);
    context.translate(-camera.x, -camera.y);
    drawChunkLayer(context, camera);
    context.restore();
  }

  function buildTerrainCache() {
    if (cacheFailed || typeof document === 'undefined') return null;
    try {
      const cache = document.createElement('canvas');
      cache.width = Math.ceil(worldWidth * renderDensity);
      cache.height = Math.ceil(worldHeight * renderDensity);
      const context = cache.getContext('2d');
      context.setTransform(renderDensity, 0, 0, renderDensity, 0, 0);
      drawTerrainDirect(context, { x: 0, y: 0, vw: worldWidth, vh: worldHeight });
      terrainCache = cache;
      return terrainCache;
    } catch {
      cacheFailed = true;
      terrainCache = null;
      return null;
    }
  }

  function drawTerrain(context, camera) {
    const cache = terrainCache ?? buildTerrainCache();
    if (!cache) {
      drawTerrainDirect(context, camera);
      return;
    }
    const sourceX = Math.max(0, camera.x * renderDensity);
    const sourceY = Math.max(0, camera.y * renderDensity);
    const sourceWidth = Math.min(camera.vw * renderDensity, cache.width - sourceX);
    const sourceHeight = Math.min(camera.vh * renderDensity, cache.height - sourceY);
    context.drawImage(
      cache,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      Math.max(0, -camera.x),
      Math.max(0, -camera.y),
      sourceWidth / renderDensity,
      sourceHeight / renderDensity,
    );
  }

  function rebuildPreview(width, height) {
    preview = document.createElement('canvas');
    preview.width = width;
    preview.height = height;
    previewWidth = width;
    previewHeight = height;
    const context = preview.getContext('2d');
    const k = Math.min(width / worldWidth, height / worldHeight);
    const ox = (width - worldWidth * k) / 2;
    const oy = (height - worldHeight * k) / 2;
    context.fillStyle = '#17130f';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(ox, oy);
    context.scale(k, k);
    context.fillStyle = baseColor;
    context.fillRect(0, 0, worldWidth, worldHeight);
    drawChunkLayer(context);
    context.restore();
    return { k, ox, oy };
  }

  function drawPreview(context, width, height) {
    if (!preview || previewWidth !== width || previewHeight !== height) rebuildPreview(width, height);
    context.drawImage(preview, 0, 0);
    const k = Math.min(width / worldWidth, height / worldHeight);
    return { k, ox: (width - worldWidth * k) / 2, oy: (height - worldHeight * k) / 2 };
  }

  function drawDebug(context, camera) {
    context.save();
    context.translate(-camera.x, -camera.y);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.setLineDash([10, 8]);
    for (const path of scene.paths ?? []) {
      const points = path.points ?? [];
      if (!points.length) continue;
      context.strokeStyle = 'rgba(74,255,136,0.72)';
      context.lineWidth = Math.max(1, (path.width - 2 * (scene.clearance ?? 0)) * scale);
      context.beginPath();
      context.moveTo(points[0][0] * scale, points[0][1] * scale);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0] * scale, points[index][1] * scale);
      if (points.length === 1) context.lineTo(points[0][0] * scale + 0.01, points[0][1] * scale);
      context.stroke();
    }
    context.setLineDash([]);
    context.fillStyle = 'rgba(255,62,62,0.28)';
    context.strokeStyle = 'rgba(255,100,100,0.9)';
    context.lineWidth = 2;
    for (const blocker of scene.blockers ?? []) {
      if (!tracePolygon(context, blocker, scale)) continue;
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function setDensity(nextDensity) {
    const next = Math.max(1, nextDensity || 1);
    if (Math.abs(next - renderDensity) < 0.01) return;
    if (terrainCache) {
      terrainCache.width = 0;
      terrainCache.height = 0;
    }
    terrainCache = null;
    cacheFailed = false;
    renderDensity = next;
  }

  function dispose() {
    if (terrainCache) {
      terrainCache.width = 0;
      terrainCache.height = 0;
    }
    if (preview) {
      preview.width = 0;
      preview.height = 0;
    }
    for (const chunk of chunks) {
      if (chunk.renderImage) {
        chunk.renderImage.width = 0;
        chunk.renderImage.height = 0;
        chunk.renderImage = null;
      }
    }
    terrainCache = null;
    preview = null;
  }

  return {
    setDensity,
    dispose,
    drawTerrain,
    drawPreview,
    drawDebug,
  };
}
