import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { format } from "prettier";
import { Matrix4, Quaternion, Vector3 } from "three";

// Preserve the original cuboids and animation tracks so both game renderers
// can use the same assets without fetching several GLBs during play.
const index = JSON.parse(readFileSync("assets/3d/INDEX.json", "utf8"));
const models = [
  ["cow", "vache-brune"],
  ["miner", "zombie-mineur"],
  ["titan", "titan-zombie-siege"],
];
const output = "src/render/voxel-creature-assets.ts";
const round = (n) => Number(n.toFixed(6));

function readModel(id) {
  const entry = index.assets.find((asset) => asset.id === id);
  assert(entry?.model_source, id);
  const raw = readFileSync(entry.model_source);
  const glb =
    entry.format === "base64(gzip(glb))" ? gunzipSync(Buffer.from(raw.toString(), "base64")) : raw;
  if (entry.sha256_glb) {
    assert.equal(createHash("sha256").update(glb).digest("hex"), entry.sha256_glb);
  }
  if (entry.git_blob_sha) {
    const hash = createHash("sha1").update(`blob ${glb.length}\0`).update(glb).digest("hex");
    assert.equal(hash, entry.git_blob_sha);
  }
  assert.equal(glb.subarray(0, 4).toString(), "glTF");
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  const jsonLength = glb.readUInt32LE(12);
  return {
    data: JSON.parse(glb.subarray(20, 20 + jsonLength).toString()),
    bin: glb.subarray(28 + jsonLength),
  };
}

const components = {
  5121: { size: 1, read: "readUInt8" },
  5123: { size: 2, read: "readUInt16LE" },
  5125: { size: 4, read: "readUInt32LE" },
  5126: { size: 4, read: "readFloatLE" },
};

function rows(data, bin, index) {
  const accessor = data.accessors[index];
  assert(!accessor.sparse);
  const view = data.bufferViews[accessor.bufferView];
  const { read, size } = components[accessor.componentType];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert(width);
  const stride = view.byteStride ?? size * width;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const max = accessor.normalized ? 2 ** (8 * size) - 1 : 1;
  return Array.from({ length: accessor.count }, (_, i) =>
    Array.from({ length: width }, (_, j) => bin[read](offset + i * stride + j * size) / max),
  );
}

function cuboid(vertices, rgb, luminous) {
  const axes = [0, 1, 2].map((axis) => [...new Set(vertices.map((v) => round(v[axis])))]);
  if (axes.every((axis) => axis.length === 2)) {
    const center = axes.map(([a, b]) => (a + b) / 2);
    const size = axes.map(([a, b]) => Math.abs(a - b));
    return { box: [...center, ...size, ...rgb].map(round), ...(luminous ? { luminous } : {}) };
  }
  // Trimesh stores the eight corners with Z, Y and X in bits 0, 1 and 2.
  // A handful of trims on the miner are rotated within their own part.
  assert.equal(vertices.length, 8);
  const p0 = new Vector3(...vertices[0]);
  const basis = [4, 2, 1].map((index) => new Vector3(...vertices[index]).sub(p0));
  const size = basis.map((axis) => axis.length());
  for (const [i, corner] of vertices.entries()) {
    const expected = p0.clone();
    basis.forEach((axis, j) => {
      if (i & (1 << (2 - j))) expected.add(axis);
    });
    assert(expected.distanceTo(new Vector3(...corner)) < 0.00001, "Non-cuboid mesh");
  }
  const center = basis.reduce((point, axis) => point.addScaledVector(axis, 0.5), p0.clone());
  const [x, y, z] = basis.map((axis) => axis.normalize());
  assert(Math.abs(x.dot(y)) < 0.001 && Math.abs(y.dot(z)) < 0.001);
  const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return {
    box: [...center, ...size, ...rgb].map(round),
    rotation: orientation.toArray().map(round),
  };
}

function convert({ data, bin }) {
  const parts = data.nodes.map((node) => {
    const boxes = [];
    for (const primitive of data.meshes[node.mesh]?.primitives ?? []) {
      const position = rows(data, bin, primitive.attributes.POSITION);
      const color = rows(data, bin, primitive.attributes.COLOR_0);
      const ix = rows(data, bin, primitive.indices).flat();
      assert.equal(ix.length % 36, 0);
      const emissions = data.materials?.[primitive.material]?.emissiveFactor ?? [];
      const luminous = emissions.some((channel) => channel > 0) ? 0.85 : 0;
      for (let offset = 0; offset < ix.length; offset += 36) {
        const corners = [...new Set(ix.slice(offset, offset + 36))].sort((a, b) => a - b);
        assert(corners.length === 8 || corners.length === 24);
        const rgb = color[corners[0]].slice(0, 3);
        assert(corners.every((i) => rgb.every((component, c) => component === color[i][c])));
        boxes.push(
          cuboid(
            corners.map((i) => position[i]),
            rgb,
            luminous,
          ),
        );
      }
    }
    return {
      ...(node.translation ? { translation: node.translation.map(round) } : {}),
      ...(node.matrix ? { matrix: node.matrix.map(round) } : {}),
      ...(node.children ? { children: node.children } : {}),
      boxes,
    };
  });
  const clips = data.animations.map((animation) => ({
    name: animation.name,
    tracks: animation.channels.map(({ sampler: i, target }) => {
      const sampler = animation.samplers[i];
      assert.equal(sampler.interpolation ?? "LINEAR", "LINEAR");
      assert(["rotation", "translation"].includes(target.path));
      return {
        part: target.node,
        property: target.path,
        time: rows(data, bin, sampler.input).flat().map(round),
        values: rows(data, bin, sampler.output).flat().map(round),
      };
    }),
  }));
  return { parts, clips, roots: data.scenes[data.scene ?? 0].nodes };
}

const assets = Object.fromEntries(models.map(([key, id]) => [key, convert(readModel(id))]));
const ts = await format(
  `// Generated from the original GLBs by scripts/generate-voxel-creature-assets.mjs.\nimport type { VoxelCreatureAsset } from "./asset-creature-model";\n\nexport const VOXEL_ASSETS: Record<"cow" | "miner" | "titan", VoxelCreatureAsset> = ${JSON.stringify(assets)};\n`,
  { parser: "typescript", printWidth: 100 },
);
if (process.argv.includes("--check")) {
  assert.equal(readFileSync(output, "utf8"), ts, "Regenerate the voxel creature assets");
} else {
  writeFileSync(output, ts);
}
