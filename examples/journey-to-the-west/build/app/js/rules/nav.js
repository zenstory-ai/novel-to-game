// 场景行走：由道路与占地矩形生成可走栅格，A* 寻路后拉直。纯逻辑，Node 可测。

const CELL = 20;
const MARGIN = 12; // 脚点离路缘与占地的净空

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function createNav(scene, size = [2400, 1600]) {
  const cols = Math.ceil(size[0] / CELL), rows = Math.ceil(size[1] / CELL);
  const grid = new Uint8Array(cols * rows);

  function pointWalkable(x, y) {
    if (x < 30 || y < 30 || x > size[0] - 30 || y > size[1] - 30) return false;
    for (const [x0, y0, x1, y1] of scene.blocks) {
      if (x > x0 - MARGIN && x < x1 + MARGIN && y > y0 - MARGIN && y < y1 + MARGIN) return false;
    }
    for (const r of scene.roads) {
      const half = r.w / 2 - MARGIN;
      if (r.pts.length === 1) {
        if (Math.hypot(x - r.pts[0][0], y - r.pts[0][1]) <= half) return true;
        continue;
      }
      for (let i = 0; i < r.pts.length - 1; i += 1) {
        if (distToSegment(x, y, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) <= half) return true;
      }
    }
    return false;
  }
  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) grid[cy * cols + cx] = pointWalkable((cx + 0.5) * CELL, (cy + 0.5) * CELL) ? 1 : 0;
  }

  const cellOf = (x, y) => [Math.max(0, Math.min(cols - 1, Math.floor(x / CELL))), Math.max(0, Math.min(rows - 1, Math.floor(y / CELL)))];
  const open = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && grid[cy * cols + cx] === 1;
  const walkable = (x, y) => { const [cx, cy] = cellOf(x, y); return open(cx, cy) && pointWalkable(x, y); };

  function nearest(x, y) {
    if (walkable(x, y)) return [x, y];
    const [sx, sy] = cellOf(x, y);
    let best = null, bestD = Infinity;
    for (let r = 1; r < Math.max(cols, rows); r += 1) {
      for (let cy = sy - r; cy <= sy + r; cy += 1) {
        for (let cx = sx - r; cx <= sx + r; cx += 1) {
          if (Math.max(Math.abs(cx - sx), Math.abs(cy - sy)) !== r || !open(cx, cy)) continue;
          const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL;
          const d = Math.hypot(px - x, py - y);
          if (d < bestD) { bestD = d; best = [px, py]; }
        }
      }
      if (best && bestD <= (r + 1) * CELL) return best;
    }
    return best;
  }

  function clear(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const [cx, cy] = cellOf(ax + (bx - ax) * t, ay + (by - ay) * t);
      if (!open(cx, cy)) return false;
    }
    return true;
  }

  // A*；返回从起点之后的一串路点（地图单位），无路则返回空数组
  function path(from, to) {
    const start = nearest(from[0], from[1]);
    const goal = nearest(to[0], to[1]);
    if (!start || !goal) return [];
    const [sx, sy] = cellOf(start[0], start[1]);
    const [gx, gy] = cellOf(goal[0], goal[1]);
    const N = cols * rows;
    const g = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => {
      const top = heap[0]; const last = heap.pop();
      if (heap.length) {
        heap[0] = last; let k = 0;
        for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; }
      }
      return top;
    };
    const s = sy * cols + sx, e = gy * cols + gx;
    g[s] = 0; push(s, 0);
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === e) break;
      const cx = cur % cols, cy = (cur - cx) / cols;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!open(nx, ny)) continue;
          if (dx && dy && (!open(cx + dx, cy) || !open(cx, cy + dy))) continue;
          const ni = ny * cols + nx;
          const cost = g[cur] + (dx && dy ? 1.4142 : 1);
          if (cost < g[ni]) { g[ni] = cost; prev[ni] = cur; push(ni, cost + Math.hypot(gx - nx, gy - ny)); }
        }
      }
    }
    if (prev[e] === -1 && e !== s) return [];
    const cells = [];
    for (let i = e; i !== -1; i = prev[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => [((i % cols) + 0.5) * CELL, (Math.floor(i / cols) + 0.5) * CELL]);
    pts[0] = start;
    pts[pts.length - 1] = goal;
    // 拉直：能直达的中间点丢掉
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !clear(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b -= 1;
      out.push(pts[b]);
      a = b;
    }
    return out.slice(1);
  }

  // 方向键行走：整步不通就沿单轴滑动
  function slide(x, y, dx, dy) {
    if (walkable(x + dx, y + dy)) return [x + dx, y + dy];
    if (dx && walkable(x + dx, y)) return [x + dx, y];
    if (dy && walkable(x, y + dy)) return [x, y + dy];
    return [x, y];
  }

  return { walkable, nearest, path, slide, cols, rows, cell: CELL, grid };
}

export function pathLength(from, pts) {
  let len = 0, p = from;
  for (const q of pts) { len += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  return len;
}
