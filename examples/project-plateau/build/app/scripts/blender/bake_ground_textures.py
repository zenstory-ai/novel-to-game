"""Bake Project Plateau's tileable ground PBR layers from real scattered geometry.

Run headless from build/app:
  Blender -b --factory-startup -P scripts/blender/bake_ground_textures.py -- public/assets/ground [size]

Each layer is a 2 m square tile built from a periodic heightfield plus scattered
leaves, twigs, moss cushions and pebbles (wrapped across the tile edges so the
result is seamless). An orthographic top-down Cycles render captures diffuse
colour, world normal, depth and ambient occlusion passes plus a roughness AOV.
Layers are stacked vertically into three strips for a sampler2DArray:
  ground-albedo.jpg  sRGB base colour
  ground-normal.jpg  tangent-space normal (OpenGL, +Y up)
  ground-orh.jpg     R = occlusion, G = roughness, B = height
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
import OpenImageIO as oiio

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = os.path.abspath(ARGS[0] if ARGS else "public/assets/ground")
SIZE = int(ARGS[1]) if len(ARGS) > 1 else 1024
TILE = 2.0
HEIGHT_RANGE = 0.08  # metres mapped onto the 0..1 height channel
LAYERS = ("litter", "moss", "mud", "gravel", "rock")


# ---------------------------------------------------------------- noise ----
def periodic_value_noise(n, period, rng):
    lattice = rng.random((period, period))
    coords = np.arange(n) / n * period
    i0 = np.floor(coords).astype(int)
    f = coords - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % period
    a = lattice[np.ix_(i0, i0)]
    b = lattice[np.ix_(i0, i1)]
    c = lattice[np.ix_(i1, i0)]
    d = lattice[np.ix_(i1, i1)]
    fy = f[:, None]
    fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(n, period, octaves, rng, gain=0.5):
    total = np.zeros((n, n))
    amplitude = 1.0
    norm = 0.0
    for _ in range(octaves):
        total += amplitude * periodic_value_noise(n, period, rng)
        norm += amplitude
        amplitude *= gain
        period *= 2
    return total / norm


def periodic_worley(n, cells, rng):
    """Distance to nearest and second-nearest feature point (wrapping)."""
    grid =np.stack(np.meshgrid(np.arange(cells), np.arange(cells), indexing="ij"), -1)
    feature = (grid + rng.random((cells, cells, 2))) / cells
    feature = feature.reshape(-1, 2)
    coords = (np.arange(n) + 0.5) / n
    yy, xx = np.meshgrid(coords, coords, indexing="ij")
    best = np.full((n, n), 9.0)
    second = np.full((n, n), 9.0)
    for fy, fx in feature:
        dy = np.abs(yy - fy)
        dx = np.abs(xx - fx)
        dy = np.minimum(dy, 1 - dy)
        dx = np.minimum(dx, 1 - dx)
        d = np.sqrt(dx * dx + dy * dy)
        second = np.where(d < best, best, np.minimum(second, d))
        best = np.minimum(best, d)
    return best * cells, second * cells


# ---------------------------------------------------------------- scene ----
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.cycles.device = "CPU"
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("World")
    world.color = (0.5, 0.5, 0.5)
    world.light_settings.distance = 0.06
    scene.world = world
    layer = scene.view_layers[0]
    layer.use_pass_diffuse_color = True
    layer.use_pass_normal = True
    layer.use_pass_z = True
    layer.use_pass_ambient_occlusion = True
    aov = layer.aovs.add()
    aov.name = "rough"
    aov.type = "VALUE"
    camera_data = bpy.data.cameras.new("Top")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = TILE
    camera_data.clip_start = 0.01
    camera_data.clip_end = 3.0
    camera = bpy.data.objects.new("Top", camera_data)
    camera.location = (TILE / 2, TILE / 2, 1.0)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return scene


def make_material():
    material = bpy.data.materials.new("Surface")
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    color = nodes.new("ShaderNodeAttribute")
    color.attribute_name = "Col"
    rough = nodes.new("ShaderNodeAttribute")
    rough.attribute_name = "rough"
    aov = nodes.new("ShaderNodeOutputAOV")
    aov.aov_name = "rough"
    links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(rough.outputs["Fac"], bsdf.inputs["Roughness"])
    links.new(rough.outputs["Fac"], aov.inputs["Value"])
    return material


class Builder:
    """Accumulates wrapped instances into flat arrays with colour/roughness."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.colors = []
        self.roughs = []
        self.count = 0

    def add(self, verts, faces, color, rough, radius):
        verts = np.asarray(verts, dtype=float)
        cx, cy = verts[:, 0].mean(), verts[:, 1].mean()
        for ox in (-TILE, 0.0, TILE):
            for oy in (-TILE, 0.0, TILE):
                if not (-radius < cx + ox < TILE + radius and -radius < cy + oy < TILE + radius):
                    continue
                self.verts.append(verts + np.array([ox, oy, 0.0]))
                for face in faces:
                    self.faces.append([self.count + i for i in face])
                    self.colors.append(color)
                    self.roughs.append(rough)
                self.count += len(verts)

    def finish(self, name, material, scene):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(np.concatenate(self.verts).tolist(), [], self.faces)
        sizes = np.array([len(f) for f in self.faces])
        corner_color = np.repeat(np.array(self.colors, dtype=np.float32), sizes, axis=0)
        corner_color = np.concatenate([corner_color, np.ones((len(corner_color), 1), np.float32)], 1)
        corner_rough = np.repeat(np.array(self.roughs, dtype=np.float32), sizes)
        mesh.attributes.new("Col", "FLOAT_COLOR", "CORNER").data.foreach_set("color", corner_color.ravel())
        mesh.attributes.new("rough", "FLOAT", "CORNER").data.foreach_set("value", corner_rough)
        mesh.polygons.foreach_set("use_smooth", np.ones(len(self.faces), dtype=bool))
        mesh.update()
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(obj)
        return obj


def transform(verts, yaw, scale, translate, tilt=(0.0, 0.0)):
    verts = np.asarray(verts, dtype=float) * scale
    ax, ay = tilt
    rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]])
    ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]])
    rz = np.array([[math.cos(yaw), -math.sin(yaw), 0], [math.sin(yaw), math.cos(yaw), 0], [0, 0, 1]])
    return verts @ rx.T @ ry.T @ rz.T + np.asarray(translate)


def ground_grid(builder, height, colors, rough):
    """Periodic heightfield whose last row/column repeats the first."""
    n = height.shape[0]
    step = TILE / n
    jj, ii = np.meshgrid(np.arange(n + 1), np.arange(n + 1), indexing="ij")
    verts = np.stack([ii * step, jj * step, height[jj % n, ii % n]], -1).reshape(-1, 3)
    base = builder.count
    builder.verts.append(verts)
    for j in range(n):
        for i in range(n):
            a = base + j * (n + 1) + i
            builder.faces.append([a, a + 1, a + n + 2, a + n + 1])
            builder.colors.append(tuple(colors[j, i]))
            builder.roughs.append(float(rough[j, i]))
    builder.count += len(verts)


# --------------------------------------------------------------- shapes ----
GROUND = {"height": None}


def ground_at(x, y):
    height = GROUND["height"]
    n = height.shape[0]
    return float(height[int(y / TILE * n) % n, int(x / TILE * n) % n])

def leaf_shape(length, width, curl, arc, segs=7):
    verts, faces = [], []
    for k in range(segs + 1):
        t = k / segs
        x = (t - 0.5) * length
        w = width * 0.5 * math.sin(math.pi * min(max(t, 0.02), 0.98)) ** 0.85
        z_mid = arc * (t - 0.5) ** 2 * length
        verts += [(x, -w, z_mid + curl * w), (x, 0.0, z_mid), (x, w, z_mid + curl * w)]
    for k in range(segs):
        a = k * 3
        faces += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    return verts, faces


def fan_leaf_shape(radius, spread=1.9, segs=8):
    verts, faces = [(0.0, 0.0, 0.0)], []
    for k in range(segs + 1):
        angle = -spread / 2 + spread * k / segs
        notch = 0.82 if k == segs // 2 else 1.0
        verts.append((math.cos(angle) * radius * notch, math.sin(angle) * radius * notch, radius * 0.06))
    for k in range(segs):
        faces.append((0, k + 1, k + 2))
    return verts, faces


def ico_shape(subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    verts = [tuple(v.co) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return np.array(verts), faces


ICO2 = ico_shape(2)
ICO1 = ico_shape(1)


def pebble(rng, radius, flatten=0.55):
    verts, faces = ICO2
    jitter = 1.0 + (rng.random(len(verts)) - 0.5) * 0.18
    shaped = verts * jitter[:, None] * np.array([1.0, 0.7 + rng.random() * 0.3, flatten])
    return shaped * radius, faces


def twig_shape(rng, length, radius, stations=7, sides=5):
    verts, faces = [], []
    bend = (rng.random() - 0.5) * 0.25 * length
    for s in range(stations):
        t = s / (stations - 1)
        x = (t - 0.5) * length
        y = bend * math.sin(math.pi * t)
        r = radius * (1.0 - 0.45 * t)
        for k in range(sides):
            a = 2 * math.pi * k / sides
            verts.append((x, y + math.cos(a) * r, math.sin(a) * r + radius))
    for s in range(stations - 1):
        for k in range(sides):
            a = s * sides + k
            b = s * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    return verts, faces


def pick(rng, palette, spread=0.06):
    base = np.array(palette[rng.integers(len(palette))], dtype=float)
    return tuple(np.clip(base * (1 + (rng.random(3) - 0.5) * spread * 2), 0, 1))


def scatter_leaves(builder, rng, count, palette, size, z_base, rough=(0.7, 0.9), fan_ratio=0.3):
    for index in range(count):
        if rng.random() < fan_ratio:
            verts, faces = fan_leaf_shape(size * (0.45 + rng.random() * 0.35))
        else:
            length = size * (0.7 + rng.random() * 0.8)
            verts, faces = leaf_shape(length, length * (0.22 + rng.random() * 0.2),
                                      curl=0.6 + rng.random() * 0.8, arc=0.4 + rng.random() * 0.6)
        x, y = rng.random() * TILE, rng.random() * TILE
        position = (x, y, ground_at(x, y) + z_base + index / count * 0.012)
        placed = transform(verts, rng.random() * 6.283, 1.0, position,
                           tilt=((rng.random() - 0.5) * 0.5, (rng.random() - 0.5) * 0.5))
        builder.add(placed, faces, pick(rng, palette), rough[0] + rng.random() * (rough[1] - rough[0]), size)


def scatter_pebbles(builder, rng, count, palette, radius_range, z_sink, rough=(0.55, 0.85)):
    for _ in range(count):
        radius = radius_range[0] + rng.random() ** 1.6 * (radius_range[1] - radius_range[0])
        verts, faces = pebble(rng, radius)
        x, y = rng.random() * TILE, rng.random() * TILE
        position = (x, y, ground_at(x, y) + radius * z_sink)
        placed = transform(verts, rng.random() * 6.283, 1.0, position,
                           tilt=((rng.random() - 0.5) * 0.3, (rng.random() - 0.5) * 0.3))
        builder.add(placed, faces, pick(rng, palette, 0.1), rough[0] + rng.random() * (rough[1] - rough[0]), radius)


def scatter_twigs(builder, rng, count, palette, z_base):
    for _ in range(count):
        length = 0.08 + rng.random() * 0.3
        verts, faces = twig_shape(rng, length, 0.003 + rng.random() * 0.007)
        x, y = rng.random() * TILE, rng.random() * TILE
        position = (x, y, ground_at(x, y) + z_base)
        placed = transform(verts, rng.random() * 6.283, 1.0, position)
        builder.add(placed, faces, pick(rng, palette), 0.85, length)


def scatter_moss(builder, rng, count, palette, clump_mask):
    verts, faces = ICO1
    placed_count = 0
    while placed_count < count:
        x, y = rng.random() * TILE, rng.random() * TILE
        if rng.random() > clump_mask(x, y):
            continue
        radius = 0.004 + rng.random() * 0.01
        shaped = verts * np.array([radius, radius, radius * 0.75])
        position = (x, y, ground_at(x, y) + radius * 0.2)
        builder.add(transform(shaped, 0.0, 1.0, position), faces, pick(rng, palette, 0.12), 0.95, radius)
        placed_count += 1


# --------------------------------------------------------------- layers ----
GRID = max(256, SIZE // 2)


def lin(rgb):
    return tuple((np.asarray(rgb, dtype=float) ** 2.2).tolist())


def lerp_colors(a, b, t):
    a, b = np.asarray(lin(a)), np.asarray(lin(b))
    return a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None]


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def build_litter(builder, rng):
    height = (fbm(GRID, 4, 5, rng) - 0.5) * 0.016
    tone = fbm(GRID, 3, 5, rng)
    moss = smooth(0.58, 0.72, fbm(GRID, 3, 4, rng))
    colors = lerp_colors((0.19, 0.14, 0.10), (0.31, 0.23, 0.16), tone)
    colors = colors * (1 - moss[..., None]) + np.asarray(lin((0.27, 0.32, 0.13)))[None, None] * moss[..., None]
    GROUND["height"] = height
    ground_grid(builder, height, colors, np.full((GRID, GRID), 0.92))
    leaves = [(0.42, 0.27, 0.13), (0.55, 0.38, 0.18), (0.30, 0.20, 0.12), (0.45, 0.42, 0.20),
              (0.36, 0.30, 0.16), (0.62, 0.48, 0.24), (0.33, 0.40, 0.17), (0.24, 0.17, 0.11)]
    scatter_leaves(builder, rng, 1500, [lin(c) for c in leaves], 0.075, 0.002)
    scatter_twigs(builder, rng, 34, [lin(c) for c in ((0.36, 0.29, 0.22), (0.46, 0.39, 0.31), (0.24, 0.19, 0.15))], 0.0)
    scatter_pebbles(builder, rng, 45, [lin(c) for c in ((0.46, 0.43, 0.38), (0.35, 0.30, 0.27))], (0.006, 0.02), 0.1)


def build_moss(builder, rng):
    height = (fbm(GRID, 8, 6, rng) - 0.5) * 0.012 + (fbm(GRID, 48, 2, rng) - 0.5) * 0.004
    tone = fbm(GRID, 6, 6, rng) * 0.7 + fbm(GRID, 40, 2, rng) * 0.3
    gaps = smooth(0.36, 0.28, fbm(GRID, 6, 5, rng))
    colors = lerp_colors((0.20, 0.27, 0.11), (0.36, 0.39, 0.17), tone)
    colors = colors * (1 - gaps[..., None]) + np.asarray(lin((0.22, 0.17, 0.12)))[None, None] * gaps[..., None]
    GROUND["height"] = height
    ground_grid(builder, height, colors, np.full((GRID, GRID), 0.95))
    clump = fbm(GRID, 5, 3, rng)
    mask = lambda x, y: smooth(0.42, 0.62, clump[int(y / TILE * GRID) % GRID, int(x / TILE * GRID) % GRID])
    palette = [lin(c) for c in ((0.30, 0.40, 0.13), (0.40, 0.46, 0.16), (0.24, 0.33, 0.11), (0.46, 0.48, 0.20))]
    scatter_moss(builder, rng, 4200, palette, mask)
    scatter_leaves(builder, rng, 220, [lin(c) for c in ((0.33, 0.40, 0.17), (0.45, 0.42, 0.20), (0.42, 0.30, 0.15))], 0.05, 0.003)


def build_mud(builder, rng):
    height = (fbm(GRID, 3, 6, rng) - 0.5) * 0.024 + (fbm(GRID, 32, 3, rng) - 0.5) * 0.005
    puddle_noise = fbm(GRID, 2, 4, rng)
    water = smooth(0.42, 0.36, puddle_noise)
    height = height - water * 0.012
    water_level = np.percentile(height, 14)
    flooded = height < water_level
    height = np.where(flooded, water_level, height)
    crest = smooth(0.0, 0.01, height - np.median(height))
    colors = lerp_colors((0.27, 0.21, 0.15), (0.43, 0.35, 0.26), crest * 0.7 + fbm(GRID, 16, 3, rng) * 0.3)
    wet = np.clip(water + flooded, 0, 1)
    colors = colors * (1 - 0.35 * wet[..., None])
    rough = np.where(flooded, 0.06, 0.72 - wet * 0.3 - (1 - crest) * 0.12)
    GROUND["height"] = height
    ground_grid(builder, height, colors, rough)
    scatter_pebbles(builder, rng, 160, [lin(c) for c in ((0.40, 0.37, 0.33), (0.30, 0.26, 0.22), (0.48, 0.40, 0.30))], (0.005, 0.022), -0.2, (0.4, 0.7))
    scatter_leaves(builder, rng, 70, [lin(c) for c in ((0.22, 0.16, 0.10), (0.30, 0.22, 0.13))], 0.06, 0.0, (0.5, 0.7))


def build_gravel(builder, rng):
    height = (fbm(GRID, 5, 4, rng) - 0.5) * 0.006
    colors = lerp_colors((0.42, 0.37, 0.30), (0.52, 0.46, 0.37), fbm(GRID, 6, 4, rng))
    GROUND["height"] = height
    ground_grid(builder, height, colors, np.full((GRID, GRID), 0.9))
    palette = [lin(c) for c in ((0.50, 0.48, 0.45), (0.38, 0.36, 0.34), (0.34, 0.22, 0.17), (0.55, 0.47, 0.36),
                                (0.22, 0.21, 0.20), (0.62, 0.60, 0.55), (0.44, 0.33, 0.26))]
    scatter_pebbles(builder, rng, 1700, palette, (0.008, 0.045), 0.25, (0.5, 0.8))


def build_rock(builder, rng):
    near, far = periodic_worley(GRID, 7, rng)
    crack = smooth(0.0, 0.09, far - near)
    fine_near, fine_far = periodic_worley(GRID, 19, rng)
    fine_crack = smooth(0.0, 0.06, fine_far - fine_near)
    broad = fbm(GRID, 3, 7, rng)
    height = (broad - 0.5) * 0.05 + crack * 0.01 + fine_crack * 0.005 + (fbm(GRID, 24, 3, rng) - 0.5) * 0.006
    tone = fbm(GRID, 5, 6, rng)
    colors = lerp_colors((0.30, 0.19, 0.15), (0.50, 0.34, 0.26), tone * 0.7 + broad * 0.3)
    colors = colors * (0.55 + 0.45 * (crack * 0.6 + fine_crack * 0.4))[..., None]
    lichen = smooth(0.7, 0.76, fbm(GRID, 20, 3, rng)) * crack
    colors = colors * (1 - lichen[..., None]) + np.asarray(lin((0.56, 0.56, 0.42)))[None, None] * lichen[..., None]
    GROUND["height"] = height
    ground_grid(builder, height, colors, 0.78 + 0.15 * (1 - crack))


BUILDERS = {
    "litter": build_litter,
    "moss": build_moss,
    "mud": build_mud,
    "gravel": build_gravel,
    "rock": build_rock,
}


# --------------------------------------------------------------- render ----
def read_passes(path):
    """Multilayer EXR passes arrive as separate parts; flatten them by name."""
    image = oiio.ImageInput.open(path)
    passes = {}
    index = 0
    while image.seek_subimage(index, 0):
        pixels = image.read_image("float")
        for channel_index, name in enumerate(image.spec().channelnames):
            passes[name.split(".", 1)[1]] = pixels[..., channel_index]
        index += 1
    image.close()
    return passes


def render_layer(name, seed):
    scene = reset_scene()
    material = make_material()
    builder = Builder()
    BUILDERS[name](builder, np.random.default_rng(seed))
    builder.finish(name, material, scene)
    path = os.path.join(OUT_DIR, f".{name}.exr")
    settings = scene.render.image_settings
    if hasattr(settings, "media_type"):
        settings.media_type = "MULTI_LAYER_IMAGE"
        settings.file_format = "OPEN_EXR_MULTILAYER"
    else:
        settings.file_format = "OPEN_EXR_MULTILAYER"
    scene.render.image_settings.color_depth = "32"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    passes = read_passes(path)
    os.remove(path)
    albedo = np.stack([passes[f"Diffuse Color.{c}"] for c in "RGB"], -1)
    normal = np.stack([passes[f"Normal.{c}"] for c in "XYZ"], -1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-5)
    depth = passes["Depth.Z"]
    occlusion = passes["Ambient Occlusion.R"]
    rough = passes["rough.X"]
    height = 1.0 - depth
    low, high = np.percentile(height, 0.5), np.percentile(height, 99.7)
    height = np.clip((height - low) / max(high - low, 1e-4), 0, 1)
    occlusion = np.clip(occlusion / max(np.percentile(occlusion, 98), 1e-4), 0, 1)
    srgb = np.where(albedo <= 0.0031308, albedo * 12.92, 1.055 * np.power(np.clip(albedo, 0, 1), 1 / 2.4) - 0.055)
    return srgb, normal * 0.5 + 0.5, np.stack([occlusion, rough, height], -1)


def save_jpg(path, data, quality=88):
    data = (np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8)
    spec = oiio.ImageSpec(data.shape[1], data.shape[0], 3, "uint8")
    spec.attribute("CompressionQuality", quality)
    out = oiio.ImageOutput.create(path)
    out.open(path, spec)
    out.write_image(data)
    out.close()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    strips = {"albedo": [], "normal": [], "orh": []}
    for index, name in enumerate(LAYERS):
        albedo, normal, orh = render_layer(name, 1912 + index * 31)
        strips["albedo"].append(albedo)
        strips["normal"].append(normal)
        strips["orh"].append(orh)
        print(f"baked {name}")
    for key, layers in strips.items():
        save_jpg(os.path.join(OUT_DIR, f"ground-{key}.jpg"), np.concatenate(layers, 0), 90 if key == "normal" else 86)
    print("ground layers:", ", ".join(LAYERS))


main()
