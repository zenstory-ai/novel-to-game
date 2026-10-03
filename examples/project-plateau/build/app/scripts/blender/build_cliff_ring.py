"""Build the distant plateau wall ("the western wall") as one GLB.

Run headless from build/app:
  Blender -b --factory-startup -P scripts/blender/build_cliff_ring.py -- public/assets/cliff-ring-v1.glb

An arc of columnar basalt cliff, 200-225 m from the basin centre, from the
fort side round through the west to the far end of the valley. Faces are
faceted into columns and stepped back at ledges; the top is ragged. One
tileable 1k albedo and normal pair (computed in numpy, no render) is
repeated along the wall. Target: 6-10k triangles.
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
import OpenImageIO as oiio

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS else "public/assets/cliff-ring-v1.glb")
TEXTURE = 1024
TILE_METRES = 24.0
RADIUS = 212.0
ARC_START = math.radians(100)   # atan2(z, x): +z side, beyond the fort
ARC_END = math.radians(262)     # through -x (west) to the far valley (-z)
SEGMENTS = 230
ROWS = 13
BASE_Y = -12.0
TOP_Y = 64.0
rng = np.random.default_rng(1912)


def value_noise_1d(count, period, seed):
    lattice = np.random.default_rng(seed).random(period + 1)
    lattice[-1] = lattice[0]
    x = np.arange(count) / count * period
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return lattice[i] * (1 - f) + lattice[i + 1] * f


def build_mesh():
    mesh = bpy.data.meshes.new("CliffRing")
    obj = bpy.data.objects.new("CliffRing", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    top_noise = value_noise_1d(SEGMENTS + 1, 23, 5)
    column_noise = value_noise_1d(SEGMENTS + 1, 97, 9)
    top_jitter = rng.random(SEGMENTS + 1)
    grid = []
    for row in range(ROWS + 1):
        v = row / ROWS
        ring = []
        for seg in range(SEGMENTS + 1):
            u = seg / SEGMENTS
            angle = ARC_START + (ARC_END - ARC_START) * u
            top = TOP_Y - 12 * top_noise[seg] - 7 * math.sin(u * math.pi * 3.1) ** 2
            # Both ends of the arc slump into the forest instead of stopping.
            ends = min(u, 1 - u) / 0.12
            taper = 1.0 if ends >= 1 else ends * ends * (3 - 2 * ends)
            top = BASE_Y + 6 + (top - BASE_Y - 6) * taper
            y = BASE_Y + (top - BASE_Y) * v
            # Columns: faceted every other segment; ledges step the face back.
            facet = 0.7 * (seg % 2) + 1.6 * column_noise[seg]
            ledge = 3.2 * math.floor(v * 3.999) + 1.6 * max(0.0, math.sin(v * math.pi * 7.0))
            crown = 4.0 * top_jitter[seg] if row == ROWS else 0.0
            radius = RADIUS + facet + ledge + crown
            ring.append(bm.verts.new((math.cos(angle) * radius, -math.sin(angle) * radius, y)))
        grid.append(ring)
    arc_length = RADIUS * (ARC_END - ARC_START)
    for row in range(ROWS):
        for seg in range(SEGMENTS):
            quad = (grid[row][seg], grid[row][seg + 1], grid[row + 1][seg + 1], grid[row + 1][seg])
            face = bm.faces.new(quad)
            for loop, (s, r) in zip(face.loops, ((seg, row), (seg + 1, row), (seg + 1, row + 1), (seg, row + 1))):
                height = BASE_Y + (TOP_Y - BASE_Y) * r / ROWS
                loop[uv_layer].uv = (s / SEGMENTS * arc_length / TILE_METRES, (height - BASE_Y) / TILE_METRES)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Faces must look inward, toward the basin.
    inward = [f for f in bm.faces if f.normal.dot(-f.calc_center_median().normalized()) < 0]
    bmesh.ops.reverse_faces(bm, faces=inward)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj


def tileable_texture():
    n = TEXTURE
    x = np.arange(n) / n
    # Columns: vertical facets with dark joints; strata: horizontal bands.
    columns = 14
    # Irregular column widths: warp the phase so joints do not read as a curtain.
    warp = x + 0.012 * np.sin(x * math.pi * 2 * 3) + 0.006 * np.sin(x * math.pi * 2 * 7 + 1.3)
    column_phase = (warp * columns) % 1.0
    joint = np.exp(-((column_phase - 0.02) ** 2) / 0.0004) + np.exp(-((column_phase - 0.98) ** 2) / 0.0004)
    facet_shade = 0.93 + 0.07 * np.cos(column_phase * math.pi * 2)
    strata = 0.5 + 0.5 * np.sin(x * math.pi * 2 * 6 + np.sin(x * math.pi * 2 * 2) * 0.8)
    grain = rng.random((n, n))
    grain = (grain + np.roll(grain, 1, 0) + np.roll(grain, 1, 1) + np.roll(grain, -1, 0)) / 4
    shade = facet_shade[None, :] * (1 - 0.3 * joint[None, :]) * (0.8 + 0.2 * grain)
    band = strata[:, None]
    basalt = np.array([0.15, 0.17, 0.2])
    oxblood = np.array([0.2, 0.13, 0.12])
    albedo = (basalt[None, None, :] * (1 - band[..., None] * 0.45) + oxblood[None, None, :] * band[..., None] * 0.45)
    albedo = albedo * shade[..., None]
    height = facet_shade[None, :] * (1 - joint[None, :]) + 0.15 * grain
    gy, gx = np.gradient(height)
    normal = np.stack([-gx * 6, gy * 6, np.ones_like(height)], -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return np.clip(albedo, 0, 1) ** (1 / 2.2), normal * 0.5 + 0.5


def save_png(path, data):
    data = (np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8)
    out = oiio.ImageOutput.create(path)
    out.open(path, oiio.ImageSpec(data.shape[1], data.shape[0], 3, "uint8"))
    out.write_image(data)
    out.close()


def material(albedo_path, normal_path):
    mat = bpy.data.materials.new("CliffBasalt")
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.92
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.image = bpy.data.images.load(albedo_path)
    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = bpy.data.images.load(normal_path)
    normal_tex.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(albedo.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = build_mesh()
    albedo, normal = tileable_texture()
    work = os.path.dirname(OUT)
    albedo_path = os.path.join(work, ".cliff-albedo.png")
    normal_path = os.path.join(work, ".cliff-normal.png")
    save_png(albedo_path, albedo)
    save_png(normal_path, normal)
    obj.data.materials.append(material(albedo_path, normal_path))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_image_format="JPEG",
        export_jpeg_quality=82,
        export_yup=True,
    )
    os.remove(albedo_path)
    os.remove(normal_path)
    print("cliff ring triangles:", len(obj.data.polygons))


main()
