// 行走地图的纯寻路网格：多边形可走区减去障碍，多入口共享同一套判定。

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (!dx && !dy) return Math.hypot(x - ax, y - ay);
  const ratio = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx ** 2 + dy ** 2)));
  return Math.hypot(x - (ax + ratio * dx), y - (ay + ratio * dy));
}

function pointPolygonDistance(x, y, polygon) {
  let distance = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    distance = Math.min(distance, pointSegmentDistance(x, y, ax, ay, bx, by));
  }
  return distance;
}

function segmentSegmentDistance(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (ux, uy, vx, vy) => ux * vy - uy * vx;
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const adx = dx - ax;
  const ady = dy - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const cax = ax - cx;
  const cay = ay - cy;
  const cbx = bx - cx;
  const cby = by - cy;
  const side1 = cross(abx, aby, acx, acy);
  const side2 = cross(abx, aby, adx, ady);
  const side3 = cross(cdx, cdy, cax, cay);
  const side4 = cross(cdx, cdy, cbx, cby);
  const epsilon = 1e-7;
  const intersects = side1 * side2 <= epsilon && side3 * side4 <= epsilon
    && Math.max(Math.min(ax, bx), Math.min(cx, dx)) <= Math.min(Math.max(ax, bx), Math.max(cx, dx)) + epsilon
    && Math.max(Math.min(ay, by), Math.min(cy, dy)) <= Math.min(Math.max(ay, by), Math.max(cy, dy)) + epsilon;
  if (intersects) return 0;
  return Math.min(
    pointSegmentDistance(ax, ay, cx, cy, dx, dy),
    pointSegmentDistance(bx, by, cx, cy, dx, dy),
    pointSegmentDistance(cx, cy, ax, ay, bx, by),
    pointSegmentDistance(dx, dy, ax, ay, bx, by),
  );
}

function intersectIntervals(first, second) {
  const start = Math.max(first[0], second[0]);
  const end = Math.min(first[1], second[1]);
  return start <= end ? [start, end] : null;
}

function linearRangeInterval(value, slope, minimum, maximum) {
  if (Math.abs(slope) < 1e-9) return value >= minimum && value <= maximum ? [0, 1] : null;
  const first = (minimum - value) / slope;
  const second = (maximum - value) / slope;
  return intersectIntervals([Math.min(first, second), Math.max(first, second)], [0, 1]);
}

function segmentCircleInterval(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax;
  const dy = by - ay;
  const ox = ax - cx;
  const oy = ay - cy;
  const quadratic = dx ** 2 + dy ** 2;
  if (quadratic < 1e-12) return ox ** 2 + oy ** 2 <= radius ** 2 ? [0, 1] : null;
  const linear = 2 * (ox * dx + oy * dy);
  const constant = ox ** 2 + oy ** 2 - radius ** 2;
  const discriminant = linear ** 2 - 4 * quadratic * constant;
  if (discriminant < 0) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  return intersectIntervals([
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ], [0, 1]);
}

function segmentRectangleInterval(ax, ay, bx, by, cx, cy, dx, dy, radius) {
  const edgeX = dx - cx;
  const edgeY = dy - cy;
  const length = Math.hypot(edgeX, edgeY);
  if (length < 1e-9) return null;
  const alongX = edgeX / length;
  const alongY = edgeY / length;
  const acrossX = -alongY;
  const acrossY = alongX;
  const queryX = bx - ax;
  const queryY = by - ay;
  const offsetX = ax - cx;
  const offsetY = ay - cy;
  const along = linearRangeInterval(
    offsetX * alongX + offsetY * alongY,
    queryX * alongX + queryY * alongY,
    0,
    length,
  );
  if (!along) return null;
  const across = linearRangeInterval(
    offsetX * acrossX + offsetY * acrossY,
    queryX * acrossX + queryY * acrossY,
    -radius,
    radius,
  );
  return across ? intersectIntervals(along, across) : null;
}

export function createNavigation({ size, walk, paths, blockers = [], clearance = 0, scale = 1, grid = 28 }) {
  const width = size[0] * scale;
  const height = size[1] * scale;
  const walkPoly = walk.map(([x, y]) => [x * scale, y * scale]);
  const pathConstraint = Array.isArray(paths);
  const scaledPaths = (paths ?? []).map((path) => ({
    points: path.points.map(([x, y]) => [x * scale, y * scale]),
    radius: path.width * scale / 2,
  }));
  const blockerPolys = blockers.map((polygon) => polygon.map(([x, y]) => [x * scale, y * scale]));
  const scaledClearance = clearance * scale;
  const cols = Math.ceil(width / grid);
  const rows = Math.ceil(height / grid);
  const walkable = new Uint8Array(cols * rows);
  const isPointInBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

  function isPointOnPath(x, y) {
    if (!pathConstraint) return true;
    return scaledPaths.some(({ points, radius }) => {
      const usableRadius = Math.max(0, radius - scaledClearance);
      if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]) <= usableRadius;
      for (let index = 1; index < points.length; index += 1) {
        if (pointSegmentDistance(x, y, ...points[index - 1], ...points[index]) <= usableRadius) return true;
      }
      return false;
    });
  }

  function isPointWalkable(x, y) {
    if (!isPointInBounds(x, y) || !pointInPolygon(x, y, walkPoly) || !isPointOnPath(x, y)) return false;
    return !blockerPolys.some((polygon) => pointInPolygon(x, y, polygon)
      || (scaledClearance > 0 && pointPolygonDistance(x, y, polygon) < scaledClearance));
  }

  function lineCoveredByPaths(ax, ay, bx, by) {
    if (!pathConstraint) return true;
    const intervals = [];
    for (const { points, radius } of scaledPaths) {
      const usableRadius = Math.max(0, radius - scaledClearance);
      if (points.length === 1) {
        const interval = segmentCircleInterval(ax, ay, bx, by, ...points[0], usableRadius);
        if (interval) intervals.push(interval);
        continue;
      }
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        for (const interval of [
          segmentRectangleInterval(ax, ay, bx, by, ...start, ...end, usableRadius),
          segmentCircleInterval(ax, ay, bx, by, ...start, usableRadius),
          segmentCircleInterval(ax, ay, bx, by, ...end, usableRadius),
        ]) if (interval) intervals.push(interval);
      }
    }
    intervals.sort((left, right) => left[0] - right[0]);
    let coveredUntil = 0;
    for (const [start, end] of intervals) {
      if (start > coveredUntil + 1e-7) return false;
      coveredUntil = Math.max(coveredUntil, end);
      if (coveredUntil >= 1 - 1e-7) return true;
    }
    return false;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) * grid;
      const y = (row + 0.5) * grid;
      walkable[row * cols + col] = isPointWalkable(x, y) ? 1 : 0;
    }
  }

  const cellOf = (x, y) => [
    Math.max(0, Math.min(cols - 1, Math.floor(x / grid))),
    Math.max(0, Math.min(rows - 1, Math.floor(y / grid))),
  ];
  const isWalkableCell = (col, row) => col >= 0 && row >= 0 && col < cols && row < rows
    && walkable[row * cols + col] === 1;

  function nearestWalkableCell(col0, row0) {
    if (isWalkableCell(col0, row0)) return [col0, row0];
    for (let radius = 1; radius < Math.max(cols, rows); radius += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let offset = -radius; offset <= radius; offset += 1) {
        for (const edge of [-radius, radius]) {
          for (const [col, row] of [[col0 + offset, row0 + edge], [col0 + edge, row0 + offset]]) {
            if (!isWalkableCell(col, row)) continue;
            const distance = (col - col0) ** 2 + (row - row0) ** 2;
            if (distance < bestDistance) {
              bestDistance = distance;
              best = [col, row];
            }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function normalizePoint(x, y) {
    const cell = nearestWalkableCell(...cellOf(x, y));
    return cell ? [(cell[0] + 0.5) * grid, (cell[1] + 0.5) * grid] : null;
  }

  function lineClear(ax, ay, bx, by) {
    if (!isPointWalkable(ax, ay) || !isPointWalkable(bx, by)) return false;
    if (!lineCoveredByPaths(ax, ay, bx, by)) return false;
    const collisionDistance = Math.max(scaledClearance, 1e-7);
    const crossesBlocker = blockerPolys.some((polygon) => polygon.some((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return segmentSegmentDistance(ax, ay, bx, by, ...point, ...next) < collisionDistance;
    }));
    if (crossesBlocker) return false;
    const sampleStride = scaledClearance > 0
      ? Math.max(2, Math.min(grid / 4, scaledClearance / 2))
      : grid / 2;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / sampleStride));
    for (let step = 0; step <= steps; step += 1) {
      const x = ax + ((bx - ax) * step) / steps;
      const y = ay + ((by - ay) * step) / steps;
      if (!isPointInBounds(x, y) || !pointInPolygon(x, y, walkPoly)) return false;
    }
    return true;
  }

  function nearestVisibleCell(x, y) {
    const [col0, row0] = cellOf(x, y);
    for (let radius = 0; radius < Math.max(cols, rows); radius += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const candidates = radius === 0
          ? [[col0, row0]]
          : [[col0 + offset, row0 - radius], [col0 + offset, row0 + radius],
            [col0 - radius, row0 + offset], [col0 + radius, row0 + offset]];
        for (const [col, row] of candidates) {
          if (!isWalkableCell(col, row)) continue;
          const center = [(col + 0.5) * grid, (row + 0.5) * grid];
          if (!lineClear(x, y, ...center)) continue;
          const distance = Math.hypot(center[0] - x, center[1] - y);
          if (distance < bestDistance) {
            best = [col, row];
            bestDistance = distance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // 八向广度寻路，不切障碍角；目标在可走区外时落到最近可走格。
  function findPath(fromX, fromY, toX, toY) {
    const startPoint = isPointWalkable(fromX, fromY) ? [fromX, fromY] : normalizePoint(fromX, fromY);
    const goalPoint = isPointWalkable(toX, toY) ? [toX, toY] : normalizePoint(toX, toY);
    if (!startPoint || !goalPoint) return [];
    const startCell = nearestVisibleCell(...startPoint);
    const goalCell = nearestVisibleCell(...goalPoint);
    if (!startCell || !goalCell) return [];
    const [startCol, startRow] = startCell;
    const [goalCol, goalRow] = goalCell;
    const goal = goalPoint;

    if (lineClear(startPoint[0], startPoint[1], goal[0], goal[1])) return [goal];

    const startCenter = [(startCol + 0.5) * grid, (startRow + 0.5) * grid];
    const goalCenter = [(goalCol + 0.5) * grid, (goalRow + 0.5) * grid];
    if (!lineClear(...startPoint, ...startCenter) || !lineClear(...goalCenter, ...goal)) return [];
    if (startCol === goalCol && startRow === goalRow) return [startCenter, goal];

    const previous = new Int32Array(cols * rows).fill(-1);
    const start = startRow * cols + startCol;
    const end = goalRow * cols + goalCol;
    previous[start] = start;
    const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current === end) break;
      const col = current % cols;
      const row = (current / cols) | 0;
      for (let dc = -1; dc <= 1; dc += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          if (!dc && !dr) continue;
          const nextCol = col + dc;
          const nextRow = row + dr;
          if (!isWalkableCell(nextCol, nextRow)) continue;
          if (dc && dr && (!isWalkableCell(col + dc, row) || !isWalkableCell(col, row + dr))) continue;
          if (!lineClear(
            (col + 0.5) * grid,
            (row + 0.5) * grid,
            (nextCol + 0.5) * grid,
            (nextRow + 0.5) * grid,
          )) continue;
          const next = nextRow * cols + nextCol;
          if (previous[next] !== -1) continue;
          previous[next] = current;
          queue.push(next);
        }
      }
    }
    if (previous[end] === -1) return [];

    const cells = [];
    for (let current = end; current !== start; current = previous[current]) {
      cells.push([((current % cols) + 0.5) * grid, (((current / cols) | 0) + 0.5) * grid]);
    }
    cells.reverse();
    cells.unshift(startCenter);
    if (Math.hypot(goalCenter[0] - goal[0], goalCenter[1] - goal[1]) > 1e-7) cells.push(goal);

    const path = [];
    let anchorX = startPoint[0];
    let anchorY = startPoint[1];
    let index = 0;
    while (index < cells.length) {
      let farthest = cells.length - 1;
      while (farthest > index && !lineClear(anchorX, anchorY, cells[farthest][0], cells[farthest][1])) farthest -= 1;
      path.push(cells[farthest]);
      [anchorX, anchorY] = cells[farthest];
      index = farthest + 1;
    }
    return path;
  }

  return {
    width,
    height,
    cols,
    rows,
    cellOf,
    isPointInBounds,
    isPointWalkable,
    isWalkableCell,
    normalizePoint,
    lineClear,
    findPath,
  };
}

export function findInteractionPath(navigation, { from, target, candidates, reach }) {
  for (const candidate of candidates) {
    const path = navigation.findPath(...from, ...candidate);
    const endpoint = path.at(-1);
    if (!endpoint || Math.hypot(endpoint[0] - target[0], endpoint[1] - target[1]) > reach) continue;
    if (!navigation.lineClear(endpoint[0], endpoint[1], target[0], target[1])) continue;
    return path;
  }
  return [];
}
