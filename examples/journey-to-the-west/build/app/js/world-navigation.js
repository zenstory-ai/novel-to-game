// 行走地图的纯寻路网格：多边形可走区减去障碍，多入口共享同一套判定。

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function createNavigation({ size, walk, blockers = [], scale = 1, grid = 28 }) {
  const width = size[0] * scale;
  const height = size[1] * scale;
  const walkPoly = walk.map(([x, y]) => [x * scale, y * scale]);
  const blockerPolys = blockers.map((polygon) => polygon.map(([x, y]) => [x * scale, y * scale]));
  const cols = Math.ceil(width / grid);
  const rows = Math.ceil(height / grid);
  const walkable = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) * grid;
      const y = (row + 0.5) * grid;
      walkable[row * cols + col] = pointInPolygon(x, y, walkPoly)
        && !blockerPolys.some((polygon) => pointInPolygon(x, y, polygon)) ? 1 : 0;
    }
  }

  const cellOf = (x, y) => [
    Math.max(0, Math.min(cols - 1, Math.floor(x / grid))),
    Math.max(0, Math.min(rows - 1, Math.floor(y / grid))),
  ];
  const isPointInBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
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
    if (!isPointInBounds(ax, ay) || !isPointInBounds(bx, by)) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (grid / 2)));
    let previous = cellOf(ax, ay);
    if (!isWalkableCell(...previous)) return false;
    for (let step = 0; step <= steps; step += 1) {
      const x = ax + ((bx - ax) * step) / steps;
      const y = ay + ((by - ay) * step) / steps;
      if (!isPointInBounds(x, y)) return false;
      const [col, row] = cellOf(x, y);
      if (!isWalkableCell(col, row)) return false;
      if (col !== previous[0] && row !== previous[1]
        && (!isWalkableCell(col, previous[1]) || !isWalkableCell(previous[0], row))) return false;
      previous = [col, row];
    }
    return true;
  }

  // 八向广度寻路，不切障碍角；目标在可走区外时落到最近可走格。
  function findPath(fromX, fromY, toX, toY) {
    const startPoint = normalizePoint(fromX, fromY);
    const goalCell = nearestWalkableCell(...cellOf(toX, toY));
    if (!startPoint || !goalCell) return [];
    const [startCol, startRow] = cellOf(...startPoint);
    const [goalCol, goalRow] = goalCell;
    const exactGoalCell = isPointInBounds(toX, toY) && isWalkableCell(...cellOf(toX, toY));
    const goal = exactGoalCell ? [toX, toY] : [(goalCol + 0.5) * grid, (goalRow + 0.5) * grid];

    if (lineClear(startPoint[0], startPoint[1], goal[0], goal[1])) return [goal];

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
    if (!cells.length) return [goal];
    cells[cells.length - 1] = goal;

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
    isWalkableCell,
    normalizePoint,
    lineClear,
    findPath,
  };
}
