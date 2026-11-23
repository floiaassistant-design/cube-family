#!/usr/bin/env python3
"""Génère le dragon rouge voxel en GLB, avec la bibliothèque standard de Python."""

from __future__ import annotations
import collections
import gzip
import json
import math
import struct
from itertools import pairwise
from pathlib import Path

HERE = Path(__file__).resolve().parent
UNIT = 0.12
C = {
    "red": "#B92732",
    "red_light": "#DC3640",
    "red_hi": "#F45146",
    "red_dark": "#84202A",
    "orange": "#E96C35",
    "orange_light": "#FA9941",
    "cream": "#F3D4AC",
    "cream_dim": "#D3B189",
    "gold": "#E8A632",
    "gold_light": "#FFD66F",
    "gold_dark": "#A96C22",
    "membrane": "#F6B478",
    "membrane_light": "#FFD8A2",
    "membrane_dark": "#D98162",
    "eye": "#FFCA1C",
    "eye_light": "#FFF08B",
    "pupil": "#472322",
    "fang": "#FFF0D3",
    "leather": "#6D3926",
    "leather_light": "#9B5B38",
    "leather_dark": "#3C231B",
    "ruby": "#C92942",
    "ruby_light": "#FC6584",
    "shadow": "#53242D",
}


def rgb(name):
    srgb = (channel / 255 for channel in bytes.fromhex(C[name][1:]))
    linear = (
        value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in srgb
    )
    return bytes([*(round(value * 255) for value in linear), 255])


def mix(a, b, fraction):
    return tuple(x + (y - x) * fraction for x, y in zip(a, b))


class Vox:
    def __init__(self, name, pivot=(0, 0, 0)):
        self.name = name
        self.pivot = tuple(pivot)
        self.v = {}

    def set(self, x, y, z, c):
        self.v[tuple(int(round(a)) for a in (x, y, z))] = c

    def box(self, a, b, c, d, e, f, col):
        for x in range(int(a), int(b) + 1):
            for y in range(int(c), int(d) + 1):
                for z in range(int(e), int(f) + 1):
                    self.set(x, y, z, col)

    def ell(self, cx, cy, cz, rx, ry, rz, col, replace=True):
        for x in range(math.floor(cx - rx), math.ceil(cx + rx) + 1):
            for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1):
                for z in range(math.floor(cz - rz), math.ceil(cz + rz) + 1):
                    if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (
                        (z - cz) / rz
                    ) ** 2 <= 1:
                        if replace or (x, y, z) not in self.v:
                            self.set(x, y, z, col)

    def line(self, a, b, rad, col):
        steps = max(1, math.ceil(math.dist(a, b) * 2.4))
        for step in range(steps + 1):
            self.ell(*mix(a, b, step / steps), rad, rad, rad, col)

    def triangle_spike(self, origin, height, width, col, axis="z"):
        x, y, z = origin
        for i in range(height):
            r = max(0, round(width * (1 - i / max(1, height))))
            if axis == "z":
                self.box(x - r, x + r, y - r, y + r, z + i, z + i, col)
            elif axis == "x":
                self.box(x - i, x - i, y - r, y + r, z - r, z + r, col)


parts = []


def new(name, pivot=(0, 0, 0)):
    p = Vox(name, pivot)
    parts.append(p)
    return p


# --- Body proportions: broad shoulder-chest, arched neck, haunches ---
body = new("01_Corps", (0, 0, 19))
body.ell(1, 0, 19, 16, 11.3, 9.3, "red")
body.ell(-9, 0, 20, 10, 10.9, 10.3, "red_light")
body.ell(10, 0, 19, 9, 9.3, 9.6, "red")
# Pale plated underside: front bib joins throat; chest remains wide at sides.
for x in range(-17, 16):
    s = math.sqrt(max(0.03, 1 - (x / 18) ** 2))
    ylim = round(6.6 * s)
    z = round(19 - 9.0 * s)
    for y in range(-ylim, ylim + 1):
        zz = z + round(2.0 * (abs(y) / max(1, ylim)) ** 2)
        body.set(x, y, zz, "cream_dim" if x % 4 == 0 else "cream")
        body.set(x, y, zz + 1, "cream_dim" if x % 4 == 0 else "cream")
# Side-scale armour plates, cascading in rows (mottled, discrete voxel tiles).
for x in range(-14, 16, 4):
    for side in (-1, 1):
        for z in (16, 21, 26):
            y = round(side * (9.4 * math.sqrt(max(0.03, 1 - ((z - 19) / 12) ** 2))))
            body.box(x, x + 2, y, y, z, z + 1, "red_light" if (x + z) % 3 else "red_hi")
# Spikes on spine behind saddle only.
for x in range(12, 18, 4):
    z = round(19 + 9 * math.sqrt(max(0, 1 - (x / 20) ** 2)))
    body.triangle_spike((x, 0, z), 4, 2, "orange")

# Bulky legs with four separate animation pivots and toes/claws.
for xbase, tag in [(-11, "Avant"), (11, "Arriere")]:
    for side, sname in [(-1, "Gauche"), (1, "Droite")]:
        cy = side * 9
        p = new(f"02_Patte_{tag}_{sname}", (xbase, cy, 17))
        p.ell(xbase, cy, 17, 6.2, 5.0, 8.2, "red_light")
        p.ell(xbase + 1, cy, 10, 4.7, 3.9, 6.6, "red")
        p.box(xbase - 4, xbase + 2, cy - 3, cy + 3, 3, 8, "red")
        p.ell(xbase - 3, cy, 3, 6.1, 4.7, 2.8, "red_light")
        # Toes face the head (-X) and are clearly separate along Y.
        for n, yy in enumerate([cy - 3, cy, cy + 3]):
            p.box(xbase - 8, xbase - 5, yy, yy + 1, 1, 3, "red")
            p.box(xbase - 10, xbase - 8, yy, yy + 1, 1, 2, "fang")
        p.box(xbase - 3, xbase + 2, cy - 4, cy + 4, 7, 8, "gold")
        p.box(xbase - 4, xbase + 1, cy - 4, cy + 4, 8, 8, "gold_light")

neck = new("03_Cou", (-21, 0, 30))
curve = [
    (-12, 0, 21, 7.8),
    (-16, 0, 25, 6.6),
    (-19, 0, 30, 6.2),
    (-21, 0, 35, 5.9),
    (-23, 0, 40, 5.3),
]
for x, y, z, r in curve:
    neck.ell(x, y, z, r, r * 0.74, r * 1.06, "red_light")
# Big pale throat plates at front(-X), cream stays visible below jaw.
for x, z, rad in [(-18, 24, 4.6), (-22, 29, 4.8), (-25, 34, 4.4), (-27, 39, 3.8)]:
    neck.ell(x, 0, z, rad, 3.4, rad + 0.2, "cream")
    for dz in range(-3, 4, 4):
        neck.box(x - 2, x, -3, 3, z + dz, z + dz, "cream_dim")
for x, z in [(-14, 30), (-17, 35), (-20, 41), (-23, 45)]:
    neck.triangle_spike((x + 5, 0, z), 4, 2, "orange")

head = new("04_Tete", (-32, 0, 42))
head.ell(-31, 0, 44, 7.1, 6.7, 6.2, "red_light")
head.ell(-36, 0, 41, 7.0, 5.2, 4.4, "red")
head.box(-43, -36, -5, 5, 40, 43, "red_light")
head.box(-43, -39, -4, 4, 42, 43, "red_hi")
head.box(-42, -34, -4, 4, 37, 39, "cream_dim")
head.box(-42, -33, -3, 3, 37, 37, "cream")
# Square nostrils, prominent angular eyes, brow and cheek spines.
for side in (-1, 1):
    y = side
    head.box(-43, -42, y * 3, y * 4, 42, 43, "pupil")
    head.box(-37, -33, y * 6, y * 6, 45, 47, "gold")
    head.box(-36, -34, y * 7, y * 7, 45, 46, "eye")
    head.box(-35, -35, y * 8, y * 8, 45, 46, "pupil")
    head.set(-36, y * 8, 46, "eye_light")
    head.box(-37, -32, y * 6, y * 7, 48, 49, "red_dark")
    for x in (-43, -39, -35):
        head.box(x, x + 1, y * 4, y * 4, 36, 37, "fang")
    # Large backward horns, cream and gold banding at base, raised tips.
    path = [
        (-30, side * 3, 49),
        (-26, side * 6, 54),
        (-20, side * 8, 56),
        (-17, side * 9, 61),
    ]
    for i, (a, b) in enumerate(zip(path[:-1], path[1:])):
        head.line(a, b, 2.1 if i == 0 else (1.6 if i == 1 else 1.15), "cream")
    head.line(path[0], path[1], 2.2, "gold")
    head.line(path[1], path[2], 1.6, "cream")
    for x, z in [(-29, 42), (-26, 40), (-25, 46), (-23, 43)]:
        head.line((x, side * 5, z), (x + 4, side * 7, z + 2), 1.25, "orange")
# layered crown spikes
for x, z in [(-30, 49), (-27, 51), (-24, 49)]:
    head.triangle_spike((x, 0, z), 4, 2, "red_dark")

# Long S tail: saddle-to-tip with jointed chunks and gold back spikes.
tail_points = [
    (12, 0, 20),
    (20, 0, 18),
    (28, 1, 15),
    (35, 3, 12),
    (42, 5, 12),
    (49, 7, 15),
    (54, 9, 23),
]
for i, (p0, p1) in enumerate(zip(tail_points[:-1], tail_points[1:])):
    p = new(f"05_Queue_{i+1:02d}", p0)
    rad = 6.1 - i * 0.82
    p.line(p0, p1, max(1.25, rad), "red" if i % 2 == 0 else "red_light")
    # Pale undersides follow the tail segments down to the curl.
    for voxel in list(p.v):
        x, y, z = voxel
        fraction = max(0, min(1, (x - p0[0]) / (p1[0] - p0[0])))
        _, center_y, center_z = mix(p0, p1, fraction)
        if z < center_z - rad * 0.43 and abs(y - center_y) < rad * 0.72:
            p.v[voxel] = "cream_dim" if x % 4 == 0 else "cream"
    # Golden dorsal scutes.
    midpoint = mix(p0, p1, 0.5)
    p.box(
        round(midpoint[0]),
        round(midpoint[0]) + 2,
        round(midpoint[1]) - 2,
        round(midpoint[1]) + 2,
        round(midpoint[2] + rad),
        round(midpoint[2] + rad) + 2,
        "orange",
    )
    for frac in (0.30, 0.73):
        q = mix(p0, p1, frac)
        p.triangle_spike(
            (round(q[0]), round(q[1]), round(q[2] + rad)),
            3 if i < 4 else 2,
            1,
            "gold_light",
        )
end = new("06_Queue_Flamme", (54, 9, 23))
end.line((53, 9, 21), (57, 11, 31), 2.4, "red_light")
for a, b in [
    ((55, 9, 27), (57, 6, 31)),
    ((56, 10, 30), (57, 9, 35)),
    ((57, 11, 30), (59, 13, 34)),
    ((55, 10, 26), (58, 15, 29)),
]:
    end.line(a, b, 1.5, "orange_light")
    end.line(mix(a, b, 0.65), b, 1.2, "gold_light")

# The wrist sits high above the shoulder. Fingers share that wrist and fan out
# to the stepped tips. An inward arc between adjacent tips cuts out each scallop.
wrist = (-9, 28, 59)
leading_edge = [
    wrist,
    (-3, 36, 60),
    (6, 45, 57),
    (15, 52, 53),
    (23, 58, 47),
    (30, 61, 38),
]
fingers = [leading_edge[-1], (34, 49, 26), (26, 34, 22), (19, 20, 24)]
shoulder = (-8, 8, 28)
elbow = (-12, 19, 39)
inner_edge = [fingers[-1], (11, 14, 28), (3, 10, 31), shoulder, elbow, wrist]


def wing_point(point, side):
    x, span, height = point
    return x, side * span, height


for side, name in [(-1, "Gauche"), (1, "Droite")]:
    wing = new(f"07_Aile_{name}", wing_point(shoulder, side))
    edge = list(leading_edge)
    for a, b in pairwise(fingers):
        for step in range(1, 20):
            t = step / 19
            arc = mix(a, b, t)
            edge.append(mix(arc, wrist, 0.23 * math.sin(math.pi * t)))
    edge.extend(inner_edge[1:])
    for a, b in pairwise(edge):
        subdivisions = max(1, math.ceil(math.dist(a, b) * 2.4))
        for step in range(subdivisions + 1):
            outer = mix(a, b, step / subdivisions)
            samples = max(1, math.ceil(math.dist(wrist, outer) * 2.8))
            for sample in range(samples + 1):
                t = sample / samples
                x, span, height = mix(wrist, outer, t)
                x += 2.1 * math.sin(math.pi * t)
                tile = (round(span) // 4 + 2 * (round(height) // 4)) % 5
                color = (
                    "membrane_dark"
                    if t < 0.27
                    else "membrane_light" if t > 0.79 or tile == 0 else "membrane"
                )
                wing.set(x, side * span, height, color)
                wing.set(x + 1, side * span, height, color)
    for path, radius, color in [
        ([shoulder, elbow, wrist], 2.1, "red"),
        (leading_edge, 1.65, "red_light"),
        *[
            ([wrist, mix(wrist, tip, 0.56), tip], 1.25, "red_dark")
            for tip in fingers[1:]
        ],
    ]:
        for a, b in pairwise(path):
            wing.line(wing_point(a, side), wing_point(b, side), radius, color)
    for tip in [wrist, *fingers]:
        x, span, height = tip
        wing.line(
            wing_point((x, span, height + 1), side),
            wing_point((x + 1, span, height - 2), side),
            1.3,
            "gold",
        )

# Gold chest harness, faceted ruby, padded saddle and banner.
harness = new("08_Poitrine_Armure", (-14, 0, 24))
for z in range(17, 29):
    half = 5 - abs(z - 23)
    if half < 0:
        continue
    harness.box(-24, -19, -half, half, z, z, "gold_dark")
    harness.box(-25, -25, -half, half, z, z, "gold")
    if half >= 2:
        harness.box(-26, -26, 1 - half, half - 1, z, z, "ruby")
harness.box(-27, -27, -2, 1, 22, 24, "ruby")
harness.box(-27, -27, -2, -1, 24, 25, "ruby_light")
for side in (-1, 1):
    harness.line((-12, side * 9, 29), (-19, side * 8, 25), 1.3, "gold_dark")
    harness.line((-19, side * 8, 25), (-24, side * 4, 23), 1.35, "gold")
bridle = new("09_Bride", (-35, 0, 43))
for side in (-1, 1):
    bridle.box(-42, -41, side * 5, side * 5, 41, 43, "leather")
    bridle.box(-34, -33, side * 6, side * 6, 40, 42, "leather")
    bridle.set(-42, side * 6, 42, "gold")
saddle = new("10_Selle", (0, 0, 30))
saddle.box(-6, 8, -6, 6, 28, 29, "leather")
saddle.box(-5, 6, -5, 5, 30, 31, "leather_light")
saddle.box(-3, 4, -3, 3, 32, 32, "leather")
for x in (-2, 1, 4):
    saddle.box(x, x, -3, 3, 33, 33, "leather_light")
for y in (-6, 6):
    saddle.box(-6, 8, y, y, 29, 31, "gold")
    saddle.box(-2, 0, y - 1, y + 1, 19, 28, "leather_dark")
    saddle.box(-2, 0, y - 1, y + 1, 23, 24, "gold")
# A modest high back and raised front pommel
saddle.box(7, 9, -5, 5, 31, 36, "leather")
saddle.box(7, 9, -6, 6, 35, 36, "gold")
saddle.box(-7, -6, -4, 4, 31, 34, "gold_dark")
saddle.box(-7, -7, -3, 3, 33, 34, "gold")
for side, sname in [(-1, "Gauche"), (1, "Droite")]:
    p = new(f"11_Banniere_{sname}", (2, side * 9, 23))
    p.box(-2, 6, side * 10, side * 10, 19, 27, "red_dark")
    p.box(-2, 6, side * 11, side * 11, 27, 27, "gold")
    p.box(-2, 6, side * 11, side * 11, 19, 19, "gold")
    p.box(-2, -2, side * 11, side * 11, 19, 27, "gold")
    p.box(6, 6, side * 11, side * 11, 19, 27, "gold")
    for x, z in [(2, 25), (1, 24), (3, 24), (2, 23), (1, 22), (3, 22), (2, 21)]:
        p.set(x, side * 12, z, "gold_light")

# Rider frame is 1 voxel above saddle. Separate, empty glTF node.
SEAT = [0, 0, 34]


def mesh_faces(part):
    """Merge adjacent exposed faces with the same color and normal."""
    layers = collections.defaultdict(set)
    for point, color in part.v.items():
        for axis in range(3):
            u_axis, v_axis = (axis + 1) % 3, (axis + 2) % 3
            for sign in (-1, 1):
                neighbor = list(point)
                neighbor[axis] += sign
                if tuple(neighbor) not in part.v:
                    key = axis, sign, point[axis] + sign * 0.5, color
                    layers[key].add((point[u_axis], point[v_axis]))

    for (axis, sign, plane, color), cells in layers.items():
        u_axis, v_axis = (axis + 1) % 3, (axis + 2) % 3
        while cells:
            u, v = min(cells)
            width = height = 1
            while (u + width, v) in cells:
                width += 1
            while all((xx, v + height) in cells for xx in range(u, u + width)):
                height += 1
            for xx in range(u, u + width):
                for yy in range(v, v + height):
                    cells.remove((xx, yy))
            corners = [(u, v), (u + width, v), (u + width, v + height), (u, v + height)]
            if sign < 0:
                corners.reverse()
            quad = []
            for uu, vv in corners:
                p = [0, 0, 0]
                p[axis], p[u_axis], p[v_axis] = plane, uu - 0.5, vv - 0.5
                quad.append(
                    tuple((value - pivot) * UNIT for value, pivot in zip(p, part.pivot))
                )
            yield quad, rgb(color)


def export_glb(path):
    gltf = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(parts) + 1))}],
        "nodes": [],
        "meshes": [],
        "accessors": [],
        "bufferViews": [],
    }
    buffer = bytearray()

    def accessor(data, count, component, kind, **metadata):
        view = len(gltf["bufferViews"])
        gltf["bufferViews"].append(
            {"buffer": 0, "byteOffset": len(buffer), "byteLength": len(data)}
        )
        buffer.extend(data)
        buffer.extend(bytes(-len(buffer) % 4))
        gltf["accessors"].append(
            {
                "bufferView": view,
                "componentType": component,
                "count": count,
                "type": kind,
                **metadata,
            }
        )
        return len(gltf["accessors"]) - 1

    for part in parts:
        points, colors, indices = [], bytearray(), bytearray()
        for quad, color in mesh_faces(part):
            start = len(points)
            points.extend(quad)
            colors.extend(color * 4)
            indices.extend(struct.pack("<6H", *(start + i for i in (0, 1, 2, 0, 2, 3))))
        position = accessor(
            b"".join(struct.pack("<3f", *p) for p in points),
            len(points),
            5126,
            "VEC3",
            min=[min(axis) for axis in zip(*points)],
            max=[max(axis) for axis in zip(*points)],
        )
        attributes = {
            "POSITION": position,
            "COLOR_0": accessor(colors, len(points), 5121, "VEC4", normalized=True),
        }
        gltf["meshes"].append(
            {
                "primitives": [
                    {
                        "attributes": attributes,
                        "indices": accessor(indices, len(indices) // 2, 5123, "SCALAR"),
                    },
                ]
            }
        )
        gltf["nodes"].append(
            {
                "name": part.name,
                "mesh": len(gltf["meshes"]) - 1,
                "translation": [round(n * UNIT, 4) for n in part.pivot],
            }
        )

    gltf["nodes"].append(
        {"name": "SeatAnchor", "translation": [n * UNIT for n in SEAT]}
    )
    gltf["buffers"] = [{"byteLength": len(buffer)}]
    document = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    document += b" " * (-len(document) % 4)
    glb = (
        struct.pack("<4sII", b"glTF", 2, 28 + len(document) + len(buffer))
        + struct.pack("<I4s", len(document), b"JSON")
        + document
        + struct.pack("<I4s", len(buffer), b"BIN\0")
        + buffer
    )
    path.with_suffix(".glb.gz").write_bytes(
        gzip.compress(glb, compresslevel=9, mtime=0)
    )


if __name__ == "__main__":
    export_glb(HERE / "dragon_voxel_rouge_v03.glb")
