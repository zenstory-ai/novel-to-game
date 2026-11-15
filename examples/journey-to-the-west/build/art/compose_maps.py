#!/usr/bin/env python3
"""把每张场景的四块重叠绘景缝成一整张底图（开发期工具，不进运行包）。

四块是分别生成的，重叠区里的内容并不逐像素一致，线性渐变会留下重影或硬痕。这里分两步：
先在重叠区里找一条「两张图最相近」的路径来切（最小代价缝）；再沿这条缝分频段混合——细节在缝上
干脆地切开，不出重影，明暗与色调这类低频在几十像素里缓缓过渡，不留一道色差。
东、南两块外缘生成时留下的直线拼接痕先被探测出来，缝只允许落在它的内侧。

    python3 build/art/compose_maps.py <四块所在目录> <输出目录>      # 需要 Pillow 与 numpy
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

SCENES = ("village", "cuiyun", "huokou", "jilei")
TILE_UNITS = (1320, 880)
OVERLAP_UNITS = (240, 160)
EDGE_MARGIN = 18          # 缝离重叠区两侧至少这么远
BANDS = (2.0, 5.0, 10.0)   # 分频段的高斯半径（像素），由细到粗
LINE_SPAN = 61            # 判定「直线痕」时沿缝方向取的窗口（像素）
LINE_RATIO = 3.2          # 竖直边缘响应超过中位数多少倍算直线痕
# 分块内部的折线色差（生成时留下、落在重叠区之外，缝盖不住）：沿折线把色阶摊成一段缓坡。坐标是整图像素。
HEAL = {
    "cuiyun": [((1251, 677), (1311, 774), (1310, 912))],
}
# 整图外缘被画上的一圈边框：用紧邻的画面镜像盖掉。值是要盖掉的像素宽度。
EDGE_FILL = {
    "jilei": {"bottom": 24, "right": 12},
}
HEAL_REACH = 72
HEAL_CORE = 6            # 折线本身那一道细痕的半宽：用两侧的像素补上


def load(src: Path, scene: str, q: str) -> np.ndarray:
    return np.asarray(Image.open(src / f"{scene}-overlap-{q}.webp").convert("RGB")).astype(np.float32)


def line_response(img: np.ndarray) -> np.ndarray:
    """逐像素的「竖直直线」响应：相邻两列的色差沿竖向取窗口均值。分块里生成时留下的拼接痕是这种形状。"""
    d = np.abs(np.diff(img, axis=1)).mean(axis=2)
    d = np.pad(d, ((0, 0), (0, 1)), mode="edge")
    k = LINE_SPAN
    c = np.cumsum(np.pad(d, ((k // 2 + 1, k // 2), (0, 0)), mode="edge"), axis=0)
    return (c[k:] - c[:-k]) / k


def blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """沿两个轴各做三遍盒式模糊，近似高斯；边缘按最近像素延伸。"""
    out = a.astype(np.float32)
    r = max(1, int(round(sigma * 1.0)))
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=axis, dtype=np.float64)
            n = out.shape[axis]
            hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
            lo = np.take(c, np.arange(0, n), axis=axis)
            out = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return out


def seam_path(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """a、b 是同一重叠区的两个版本（H×W×3）。返回自上而下每一行的切点列号。"""
    h, w, _ = a.shape
    diff = np.abs(a - b).sum(axis=2)
    # 两边都平坦的地方切起来最不显眼：差异之外再加上各自的局部纹理强度
    ga = np.abs(np.gradient(a.mean(axis=2), axis=1)) + np.abs(np.gradient(a.mean(axis=2), axis=0))
    gb = np.abs(np.gradient(b.mean(axis=2), axis=1)) + np.abs(np.gradient(b.mean(axis=2), axis=0))
    cost = diff + 0.6 * (ga + gb)
    # 直线拼接痕：前一块里的痕要落在缝的右边（被后一块盖住），后一块里的痕要落在缝的左边
    for img, keep_left in ((a, False), (b, True)):
        r = line_response(img)
        hit = r > LINE_RATIO * float(np.median(r))
        hit[:, :6] = False
        hit[:, -6:] = False
        if keep_left:   # 缝在痕的左侧会把痕露出来：痕及其左边都罚
            bad = np.cumsum(hit[:, ::-1], axis=1)[:, ::-1] > 0
        else:           # 缝在痕的右侧会把痕露出来：痕及其右边都罚
            bad = np.cumsum(hit, axis=1) > 0
        cost += bad * 4000.0
    cost[:, :EDGE_MARGIN] = 1e9
    cost[:, w - EDGE_MARGIN:] = 1e9
    acc = cost.copy()
    for y in range(1, h):
        prev = acc[y - 1]
        best = np.minimum(prev, np.minimum(np.roll(prev, 1), np.roll(prev, -1)))
        best[0] = min(prev[0], prev[1])
        best[-1] = min(prev[-1], prev[-2])
        acc[y] += best
    path = np.zeros(h, dtype=np.int32)
    path[-1] = int(np.argmin(acc[-1]))
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        x0, x1 = max(0, x - 1), min(w, x + 2)
        path[y] = x0 + int(np.argmin(acc[y, x0:x1]))
    return path


def band_blend(a: np.ndarray, b: np.ndarray, path: np.ndarray) -> np.ndarray:
    """沿缝分频段混合：细节频段用窄过渡，低频用宽过渡。"""
    h, w, _ = a.shape
    mask = (np.arange(w)[None, :] >= path[:, None]).astype(np.float32)[..., None]
    out = np.zeros_like(a)
    pa, pb = a, b
    for sigma in BANDS:
        la, lb = blur(a, sigma), blur(b, sigma)
        m = blur(mask, sigma * 0.75)
        out += (pa - la) * (1 - m) + (pb - lb) * m
        pa, pb = la, lb
    m = blur(mask, BANDS[-1] * 1.1)
    # 贴边几列收回到 0 与 1，和重叠区外相接
    edge = np.clip(np.arange(w) / 12.0, 0, 1)[None, :, None]
    m = m * edge
    m = 1 - (1 - m) * edge[:, ::-1]
    return out + pa * (1 - m) + pb * m


def join_h(left: np.ndarray, right: np.ndarray, ov: int) -> np.ndarray:
    a, b = left[:, -ov:], right[:, :ov]
    mid = band_blend(a, b, seam_path(a, b))
    return np.concatenate([left[:, :-ov], mid, right[:, ov:]], axis=1)


def join_v(top: np.ndarray, bottom: np.ndarray, ov: int) -> np.ndarray:
    t = lambda x: np.transpose(x, (1, 0, 2))
    return t(join_h(t(top), t(bottom), ov))


def heal_step(img: np.ndarray, line: tuple[tuple[int, int], ...]) -> None:
    """折线两侧各取一条窄带量出色阶，再按到折线的距离线性摊开，硬边变成缓坡。就地修改。"""
    pts = np.array(line, dtype=np.float32)
    x0, y0 = np.floor(pts.min(axis=0) - HEAL_REACH - 2).astype(int)
    x1, y1 = np.ceil(pts.max(axis=0) + HEAL_REACH + 2).astype(int)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(img.shape[1], x1), min(img.shape[0], y1)
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    best = np.full(xs.shape, 1e9, np.float32)
    side = np.zeros(xs.shape, np.float32)
    along = np.zeros(xs.shape, np.float32)
    nx = np.zeros(xs.shape, np.float32)
    ny = np.zeros(xs.shape, np.float32)
    cx = np.zeros(xs.shape, np.float32)
    cy = np.zeros(xs.shape, np.float32)
    base = 0.0
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        dx, dy = bx - ax, by - ay
        length = float(np.hypot(dx, dy))
        u = np.clip(((xs - ax) * dx + (ys - ay) * dy) / (length * length), 0, 1)
        dist = np.hypot(xs - (ax + u * dx), ys - (ay + u * dy))
        cross = (xs - ax) * dy - (ys - ay) * dx   # 正负分出折线两侧
        closer = dist < best
        best = np.where(closer, dist, best)
        side = np.where(closer, np.sign(cross), side)
        along = np.where(closer, base + u * length, along)
        nx = np.where(closer, dy / length, nx)
        ny = np.where(closer, -dx / length, ny)
        cx = np.where(closer, ax + u * dx, cx)
        cy = np.where(closer, ay + u * dy, cy)
        base += length
    region = img[y0:y1, x0:x1]
    near = (best > 3) & (best < 14)
    bins = np.clip((along / 24).astype(int), 0, int(base / 24))
    step = np.zeros((bins.max() + 1, 3), np.float32)
    for i in range(bins.max() + 1):
        pos, neg = near & (bins == i) & (side > 0), near & (bins == i) & (side < 0)
        if pos.sum() > 20 and neg.sum() > 20:
            step[i] = region[pos].mean(axis=0) - region[neg].mean(axis=0)
    for c in range(3):   # 沿折线方向平滑，色阶不逐段跳
        step[:, c] = np.convolve(np.pad(step[:, c], 2, mode="edge"), np.ones(5) / 5, mode="valid")
    ends = np.clip(np.minimum(along, base - along) / 30.0, 0, 1)   # 折线两端收口
    fall = np.clip(1 - best / HEAL_REACH, 0, 1) * ends
    region -= (0.5 * side * fall)[..., None] * step[bins]
    # 折线上那道细痕：取法线两侧稍远处的像素各一半补上
    core = np.clip((HEAL_CORE - best) / 2.0, 0, 1) * ends
    off = HEAL_CORE + 4
    def sample(sign: float) -> np.ndarray:
        sx = np.clip(np.rint(cx + sign * nx * off).astype(int), 0, img.shape[1] - 1)
        sy = np.clip(np.rint(cy + sign * ny * off).astype(int), 0, img.shape[0] - 1)
        return img[sy, sx]
    patch = 0.5 * (sample(1.0) + sample(-1.0))
    region[:] = region * (1 - core[..., None]) + patch * core[..., None]


def compose(src: Path, scene: str) -> Image.Image:
    nw, ne, sw, se = (load(src, scene, q) for q in ("nw", "ne", "sw", "se"))
    h, w, _ = nw.shape
    ox = round(OVERLAP_UNITS[0] / TILE_UNITS[0] * w)
    oy = round(OVERLAP_UNITS[1] / TILE_UNITS[1] * h)
    full = join_v(join_h(nw, ne, ox), join_h(sw, se, ox), oy)
    for line in HEAL.get(scene, ()):
        heal_step(full, line)
    fill = EDGE_FILL.get(scene, {})
    if n := fill.get("bottom"):
        full[-n:] = full[-2 * n:-n][::-1]
    if n := fill.get("right"):
        full[:, -n:] = full[:, -2 * n:-n][:, ::-1]
    return Image.fromarray(full.clip(0, 255).astype(np.uint8))


def main() -> int:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        im = compose(src, scene)
        im.save(out / f"{scene}.png")
        print(scene, im.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
