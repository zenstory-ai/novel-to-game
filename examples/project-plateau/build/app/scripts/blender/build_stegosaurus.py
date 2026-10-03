"""Build the rigged, textured stegosaurus for Project Plateau's drinking-place beat.

Run headless from build/app:
  Blender -b --factory-startup -P scripts/blender/build_stegosaurus.py -- public/assets/stegosaurus-v1.glb

Chapter XII: "that arched back with triangular fringes along it, that strange
bird-like head held close to the ground ... the very creature which Maple White
had preserved in his sketch-book." The body is a Skin-modifier skeleton
(subdivided), the plates and thagomizer are separate rigid parts, and a
procedural skin (Voronoi scale bump, mottled countershaded colour) is baked by
Cycles to 1k albedo/normal maps. Two looping actions are exported: Walk, Drink.
The model faces +X, stands on z = 0 and is roughly 9.5 m long.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS else "public/assets/stegosaurus-v1.glb")
TEXTURE_SIZE = 1024
FPS = 24

# (x, y, z, radius) skeleton nodes; edges link them below.
SPINE = [
    ("snout", (4.35, 0, 0.92), 0.14),
    ("head", (3.9, 0, 1.0), 0.27),
    ("neck", (3.25, 0, 1.26), 0.4),
    ("withers", (2.25, 0, 1.78), 0.86),
    ("back", (1.0, 0, 2.38), 1.12),
    ("hips", (-0.2, 0, 2.62), 1.08),
    ("tail1", (-1.45, 0, 2.36), 0.72),
    ("tail2", (-2.65, 0, 1.96), 0.42),
    ("tail3", (-3.75, 0, 1.6), 0.25),
    ("tail4", (-4.65, 0, 1.34), 0.13),
    ("tip", (-5.25, 0, 1.2), 0.05),
]
FRONT_LEG = [((2.2, 0.52, 1.45), 0.44), ((2.32, 0.64, 0.85), 0.31), ((2.26, 0.66, 0.16), 0.27), ((2.42, 0.68, 0.07), 0.25)]
HIND_LEG = [((-0.12, 0.6, 2.1), 0.7), ((0.18, 0.72, 1.2), 0.42), ((-0.12, 0.74, 0.46), 0.3), ((0.16, 0.76, 0.09), 0.29)]

BONES = [
    # name, head, tail, parent
    ("pelvis", (-0.2, 0, 2.0), (-0.2, 0, 2.62), None),
    ("spine1", (-0.2, 0, 2.62), (1.0, 0, 2.38), "pelvis"),
    ("spine2", (1.0, 0, 2.38), (2.25, 0, 1.78), "spine1"),
    ("neck", (2.25, 0, 1.78), (3.25, 0, 1.26), "spine2"),
    ("head", (3.25, 0, 1.26), (4.35, 0, 0.92), "neck"),
    ("tail1", (-0.2, 0, 2.62), (-1.45, 0, 2.36), "pelvis"),
    ("tail2", (-1.45, 0, 2.36), (-2.65, 0, 1.96), "tail1"),
    ("tail3", (-2.65, 0, 1.96), (-3.75, 0, 1.6), "tail2"),
    ("tail4", (-3.75, 0, 1.6), (-5.25, 0, 1.2), "tail3"),
]
for side, sign in (("L", 1), ("R", -1)):
    f = [Vector((p[0], p[1] * sign, p[2])) for p, _ in FRONT_LEG]
    h = [Vector((p[0], p[1] * sign, p[2])) for p, _ in HIND_LEG]
    BONES += [
        (f"arm.{side}", f[0], f[1], "spine2"),
        (f"forearm.{side}", f[1], f[2], f"arm.{side}"),
        (f"hand.{side}", f[2], f[3], f"forearm.{side}"),
        (f"thigh.{side}", h[0], h[1], "pelvis"),
        (f"shin.{side}", h[1], h[2], f"thigh.{side}"),
        (f"foot.{side}", h[2], h[3], f"shin.{side}"),
    ]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.device = "CPU"
    scene.render.fps = FPS
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def select_only(obj):
    for other in bpy.context.scene.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def build_body():
    mesh = bpy.data.meshes.new("StegosaurusBody")
    obj = link(bpy.data.objects.new("StegosaurusBody", mesh))
    bm = bmesh.new()
    radii = []
    spine = []
    for _, position, radius in SPINE:
        spine.append(bm.verts.new(position))
        radii.append(radius)
    for a, b in zip(spine, spine[1:]):
        bm.edges.new((a, b))
    withers = spine[3]
    hips = spine[5]
    for sign in (1, -1):
        for leg, anchor in ((FRONT_LEG, withers), (HIND_LEG, hips)):
            previous = anchor
            # The first leg node sits inside the torso hull; skipping it keeps
            # the Skin modifier from folding a fin at the junction.
            for position, radius in leg[1:]:
                vert = bm.verts.new((position[0], position[1] * sign, position[2]))
                radii.append(radius)
                bm.edges.new((previous, vert))
                previous = vert
    bm.to_mesh(mesh)
    bm.free()
    skin = obj.modifiers.new("Skin", "SKIN")
    skin.use_smooth_shade = True
    for vertex, radius in zip(mesh.skin_vertices[0].data, radii):
        vertex.radius = (radius, radius)
    mesh.skin_vertices[0].data[5].use_root = True
    sub = obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Subsurf")
    bpy.ops.object.shade_smooth()
    return obj


def spine_at(x):
    """Interpolated (height, radius) of the spine at body station x."""
    nodes = [(p[0], p[2], r) for _, p, r in SPINE]
    for (x0, z0, r0), (x1, z1, r1) in zip(nodes, nodes[1:]):
        if x1 <= x <= x0:
            t = (x0 - x) / (x0 - x1)
            return z0 + (z1 - z0) * t, r0 + (r1 - r0) * t
    return nodes[-1][1], nodes[-1][2]


def add_part(bm, verts, faces, part):
    layer = bm.loops.layers.float_color.get("Part") or bm.loops.layers.float_color.new("Part")
    created = [bm.verts.new(v) for v in verts]
    for face in faces:
        f = bm.faces.new([created[i] for i in face])
        for loop in f.loops:
            loop[layer] = part


def build_plates():
    mesh = bpy.data.meshes.new("StegosaurusPlates")
    obj = link(bpy.data.objects.new("StegosaurusPlates", mesh))
    bm = bmesh.new()
    stations = 17
    for index in range(stations):
        x = 3.0 - index * (6.5 / (stations - 1))
        height, radius = spine_at(x)
        size = 0.22 + 0.62 * math.exp(-((x + 0.35) / 1.9) ** 2)
        width = size * 0.85
        side = 1 if index % 2 == 0 else -1
        outline = [(-0.42, -0.25), (-0.5, 0.18), (-0.4, 0.52), (-0.18, 0.84), (0.05, 1.0), (0.24, 0.8), (0.4, 0.45), (0.46, 0.08), (0.36, -0.25)]
        thickness = 0.035 + size * 0.02
        lean = math.radians(9) * side
        base_z = height + radius * 0.62
        verts = []
        for ty in (-thickness, thickness):
            for u, v in outline:
                px = x + u * width
                pz = v * size
                py = side * 0.11 + ty
                # Lean the plate outward around the spine axis.
                ry = py * math.cos(lean) - pz * math.sin(lean)
                rz = py * math.sin(lean) + pz * math.cos(lean)
                verts.append((px, ry, base_z + rz - 0.04))
        n = len(outline)
        faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
        for k in range(n):
            a, b = k, (k + 1) % n
            faces.append((a, b, b + n, a + n))
        add_part(bm, verts, faces, (1.0, 0.0, 0.0, 1.0))
    # Thagomizer: two pairs of tail spikes.
    for x, sign in ((-4.25, 1), (-4.25, -1), (-4.75, 1), (-4.75, -1)):
        height, radius = spine_at(x)
        direction = Vector((-0.45, 0.62 * sign, 0.64)).normalized()
        base = Vector((x, sign * radius * 0.5, height + radius * 0.4))
        tip = base + direction * 0.78
        side_a = direction.orthogonal().normalized()
        side_b = direction.cross(side_a).normalized()
        ring = [base + (side_a * math.cos(a) + side_b * math.sin(a)) * 0.075 for a in [k * math.tau / 6 for k in range(6)]]
        verts = [tuple(v) for v in ring] + [tuple(tip)]
        faces = [(k, (k + 1) % 6, 6) for k in range(6)] + [tuple(reversed(range(6)))]
        add_part(bm, verts, faces, (0.0, 1.0, 0.0, 1.0))
    # Small dark eyes.
    for sign in (1, -1):
        result = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.045)
        for v in result["verts"]:
            v.co += Vector((3.98, 0.2 * sign, 1.08))
        layer = bm.loops.layers.float_color.get("Part")
        for f in {f for v in result["verts"] for f in v.link_faces}:
            for loop in f.loops:
                loop[layer] = (0.0, 0.0, 1.0, 1.0)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj


def skin_material():
    """Procedural skin: Voronoi scales as bump, mottled olive countershading,
    rust plates darkening at the rim, bone-coloured spikes, dark eyes."""
    material = bpy.data.materials.new("StegosaurusSkin")
    nt = material.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")
    geometry = nodes.new("ShaderNodeNewGeometry")
    part = nodes.new("ShaderNodeVertexColor")
    part.layer_name = "Part"
    split = nodes.new("ShaderNodeSeparateColor")
    links.new(part.outputs["Color"], split.inputs["Color"])

    mottle = nodes.new("ShaderNodeTexNoise")
    mottle.inputs["Scale"].default_value = 1.6
    mottle.inputs["Detail"].default_value = 6
    links.new(coords.outputs["Object"], mottle.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.055, 0.06, 0.03, 1)
    ramp.color_ramp.elements[1].position = 0.68
    ramp.color_ramp.elements[1].color = (0.16, 0.13, 0.07, 1)
    links.new(mottle.outputs["Fac"], ramp.inputs["Fac"])

    # Dark saddle bands across the back.
    bands = nodes.new("ShaderNodeTexWave")
    bands.wave_type = "BANDS"
    bands.bands_direction = "X"
    bands.inputs["Scale"].default_value = 0.55
    bands.inputs["Distortion"].default_value = 6
    links.new(coords.outputs["Object"], bands.inputs["Vector"])
    band_mix = nodes.new("ShaderNodeMix")
    band_mix.data_type = "RGBA"
    band_mix.blend_type = "MULTIPLY"
    band_mix.inputs["Factor"].default_value = 0.35
    links.new(ramp.outputs["Color"], band_mix.inputs["A"])
    links.new(bands.outputs["Color"], band_mix.inputs["B"])

    # Countershading: underside and lower flanks pale.
    belly_factor = nodes.new("ShaderNodeMapRange")
    normal_z = nodes.new("ShaderNodeSeparateXYZ")
    links.new(geometry.outputs["Normal"], normal_z.inputs["Vector"])
    links.new(normal_z.outputs["Z"], belly_factor.inputs["Value"])
    belly_factor.inputs["From Min"].default_value = 0.1
    belly_factor.inputs["From Max"].default_value = -0.7
    belly = nodes.new("ShaderNodeMix")
    belly.data_type = "RGBA"
    links.new(belly_factor.outputs["Result"], belly.inputs["Factor"])
    links.new(band_mix.outputs["Result"], belly.inputs["A"])
    belly.inputs["B"].default_value = (0.36, 0.31, 0.21, 1)

    plate_ramp = nodes.new("ShaderNodeValToRGB")
    plate_ramp.color_ramp.elements[0].color = (0.1, 0.05, 0.025, 1)
    plate_ramp.color_ramp.elements[1].position = 0.75
    plate_ramp.color_ramp.elements[1].color = (0.3, 0.13, 0.05, 1)
    links.new(mottle.outputs["Fac"], plate_ramp.inputs["Fac"])
    plates = nodes.new("ShaderNodeMix")
    plates.data_type = "RGBA"
    links.new(split.outputs["Red"], plates.inputs["Factor"])
    links.new(belly.outputs["Result"], plates.inputs["A"])
    links.new(plate_ramp.outputs["Color"], plates.inputs["B"])
    spikes = nodes.new("ShaderNodeMix")
    spikes.data_type = "RGBA"
    links.new(split.outputs["Green"], spikes.inputs["Factor"])
    links.new(plates.outputs["Result"], spikes.inputs["A"])
    spikes.inputs["B"].default_value = (0.3, 0.27, 0.2, 1)
    eyes = nodes.new("ShaderNodeMix")
    eyes.data_type = "RGBA"
    links.new(split.outputs["Blue"], eyes.inputs["Factor"])
    links.new(spikes.outputs["Result"], eyes.inputs["A"])
    eyes.inputs["B"].default_value = (0.01, 0.008, 0.006, 1)
    links.new(eyes.outputs["Result"], bsdf.inputs["Base Color"])

    scales = nodes.new("ShaderNodeTexVoronoi")
    scales.inputs["Scale"].default_value = 22
    links.new(coords.outputs["Object"], scales.inputs["Vector"])
    big_scales = nodes.new("ShaderNodeTexVoronoi")
    big_scales.inputs["Scale"].default_value = 7
    links.new(coords.outputs["Object"], big_scales.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.02
    links.new(scales.outputs["Distance"], bump.inputs["Height"])
    bump2 = nodes.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.4
    bump2.inputs["Distance"].default_value = 0.04
    links.new(big_scales.outputs["Distance"], bump2.inputs["Height"])
    links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
    links.new(bump2.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return material


def bake_textures(obj, material):
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    nodes = material.node_tree.nodes
    images = {}
    for name, colorspace in (("albedo", "sRGB"), ("normal", "Non-Color")):
        image = bpy.data.images.new(f"stegosaurus-{name}", TEXTURE_SIZE, TEXTURE_SIZE)
        image.colorspace_settings.name = colorspace
        node = nodes.new("ShaderNodeTexImage")
        node.image = image
        nodes.active = node
        bake = bpy.context.scene.render.bake
        bake.margin = 8
        if name == "albedo":
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
        else:
            bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
        nodes.remove(node)
        images[name] = image
    return images


def textured_material(images):
    material = bpy.data.materials.new("StegosaurusBaked")
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.image = images["albedo"]
    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = images["normal"]
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(albedo.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.82
    return material


def build_armature():
    data = bpy.data.armatures.new("StegosaurusRig")
    rig = link(bpy.data.objects.new("StegosaurusRig", data))
    select_only(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent in BONES:
        bone = data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        leg = any(part in name for part in ("arm", "hand", "thigh", "shin", "foot"))
        # Legs: local X lateral so X-rotation swings fore/aft. Spine: Z up.
        bone.align_roll(Vector((1, 0, 0)) if leg else Vector((0, 0, 1)))
        if parent:
            bone.parent = data.edit_bones[parent]
            bone.use_connect = (Vector(head) - data.edit_bones[parent].tail).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def segment_distance(point, head, tail):
    axis = tail - head
    t = max(0.0, min(1.0, (point - head).dot(axis) / max(axis.length_squared, 1e-9)))
    return (point - (head + axis * t)).length


def skin_to_rig(body, rig):
    select_only(body)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Rigid fallback for plates, spikes and eyes (and any vertex heat missed):
    # bind to the nearest spine/tail/head bone.
    groups = {g.name: g for g in body.vertex_groups}
    axial = [b for b in BONES if not any(p in b[0] for p in ("arm", "hand", "thigh", "shin", "foot", "pelvis"))]
    part_layer = body.data.color_attributes.get("Part")
    rigid = set()
    if part_layer is not None:
        for loop in body.data.loops:
            if max(part_layer.data[loop.index].color[:3]) > 0.5:
                rigid.add(loop.vertex_index)
    for vertex in body.data.vertices:
        total = sum(g.weight for g in vertex.groups)
        is_part = vertex.index in rigid
        if total > 0.5 and not is_part:
            continue
        for g in list(vertex.groups):
            body.vertex_groups[g.group].remove([vertex.index])
        nearest = min(axial, key=lambda b: segment_distance(vertex.co, Vector(b[1]), Vector(b[2])))
        groups[nearest[0]].add([vertex.index], 1.0, "REPLACE")


def key_rotation(rig, bone, frame, x=0.0, z=0.0):
    pose = rig.pose.bones[bone]
    pose.rotation_mode = "XYZ"
    pose.rotation_euler = (x, 0.0, z)
    pose.keyframe_insert("rotation_euler", frame=frame)


def new_action(rig, name):
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"
        pose.rotation_euler = (0, 0, 0)
        pose.location = (0, 0, 0)
    return action


def walk_action(rig):
    action = new_action(rig, "Walk")
    frames = 32
    phases = {"thigh.L": 0.0, "arm.L": 0.25, "thigh.R": 0.5, "arm.R": 0.75}
    for step in range(9):
        frame = step * frames / 8
        t = step / 8
        for upper, phase in phases.items():
            side = upper[-1]
            angle = (t + phase) * math.tau
            swing = math.sin(angle)
            lift = max(0.0, math.cos(angle))
            if upper.startswith("thigh"):
                key_rotation(rig, upper, frame, x=swing * 0.32)
                key_rotation(rig, f"shin.{side}", frame, x=-lift * 0.42)
                key_rotation(rig, f"foot.{side}", frame, x=lift * 0.3 - swing * 0.2)
            else:
                key_rotation(rig, upper, frame, x=swing * 0.28)
                key_rotation(rig, f"forearm.{side}", frame, x=lift * 0.35)
                key_rotation(rig, f"hand.{side}", frame, x=-swing * 0.2)
        bob = math.sin(t * 2 * math.tau)
        sway = math.sin(t * math.tau)
        pelvis = rig.pose.bones["pelvis"]
        pelvis.location = (0, 0.04 * bob, 0)
        pelvis.keyframe_insert("location", frame=frame)
        key_rotation(rig, "pelvis", frame, z=sway * 0.04)
        for index, bone in enumerate(("tail1", "tail2", "tail3", "tail4")):
            key_rotation(rig, bone, frame, z=math.sin(t * math.tau - index * 0.6) * (0.05 + index * 0.025))
        key_rotation(rig, "neck", frame, x=0.04 * bob, z=-sway * 0.04)
        key_rotation(rig, "head", frame, x=0.03 * bob)
    return action


def drink_action(rig):
    action = new_action(rig, "Drink")
    frames = 72
    for step in range(13):
        frame = step * frames / 12
        t = step / 12
        gulp = math.sin(t * 3 * math.tau)
        key_rotation(rig, "spine2", frame, x=-0.1)
        key_rotation(rig, "neck", frame, x=-0.4 - gulp * 0.03)
        key_rotation(rig, "head", frame, x=-0.3 - gulp * 0.05)
        key_rotation(rig, "arm.L", frame, x=0.08)
        key_rotation(rig, "arm.R", frame, x=-0.06)
        for index, bone in enumerate(("tail1", "tail2", "tail3", "tail4")):
            key_rotation(rig, bone, frame, z=math.sin(t * math.tau - index * 0.7) * (0.03 + index * 0.02))
    return action


def main():
    reset()
    body = build_body()
    extras = build_plates()
    material = skin_material()
    for obj in (body, extras):
        obj.data.materials.clear()
        obj.data.materials.append(material)
    select_only(body)
    extras.select_set(True)
    bpy.ops.object.join()
    body.name = "Stegosaurus"
    images = bake_textures(body, material)
    body.data.materials.clear()
    body.data.materials.append(textured_material(images))
    rig = build_armature()
    skin_to_rig(body, rig)
    walk_action(rig)
    drink_action(rig)
    rig.animation_data.action = None
    for action in (bpy.data.actions["Walk"], bpy.data.actions["Drink"]):
        track = rig.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 1, action)
    for image in images.values():
        image.file_format = "JPEG" if image.name.endswith("albedo") else "PNG"
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in (body, rig))
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_image_format="JPEG",
        export_jpeg_quality=86,
        export_yup=True,
    )
    print("stegosaurus exported", OUT, os.path.getsize(OUT), "bytes,", len(body.data.polygons), "faces")


main()
