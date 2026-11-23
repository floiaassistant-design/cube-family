import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const load = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const isFile = (path) => typeof path === "string" && existsSync(resolve(root, path));

const assets = load("assets/3d/INDEX.json").assets;
const assetIds = new Set();
for (const asset of assets) {
  assert(typeof asset.id === "string" && !assetIds.has(asset.id), "Asset ID dupliqué");
  assetIds.add(asset.id);
  assert(isFile(asset.model_source), `Modèle absent : ${asset.model_source}`);
  if (asset.format === "glb") {
    const bytes = readFileSync(resolve(root, asset.model_source));
    const headerValid =
      bytes.length >= 28 &&
      bytes.toString("ascii", 0, 4) === "glTF" &&
      bytes.readUInt32LE(4) === 2 &&
      bytes.readUInt32LE(8) === bytes.length;
    assert(headerValid, `En-tête GLB invalide : ${asset.model_source}`);
    const jsonLength = bytes.readUInt32LE(12);
    const jsonEnd = 20 + jsonLength;
    assert(jsonEnd + 8 <= bytes.length, `JSON GLB tronqué : ${asset.model_source}`);
    assert(bytes.readUInt32LE(16) === 0x4e4f534a, "Chunk JSON GLB absent");
    const data = JSON.parse(bytes.toString("utf8", 20, jsonEnd));
    assert(data.asset?.version === "2.0", "Version glTF non prise en charge");
    assert(data.meshes?.some((mesh) => mesh.primitives?.length > 0), "GLB sans maillage");
    const binLength = bytes.readUInt32LE(jsonEnd);
    assert(bytes.readUInt32LE(jsonEnd + 4) === 0x004e4942, "Chunk BIN GLB absent");
    assert(jsonEnd + 8 + binLength === bytes.length, "Taille du GLB incohérente");
    assert(data.buffers?.[0]?.byteLength <= binLength, "Tampon GLB incohérent");
    for (const view of data.bufferViews ?? []) {
      assert((view.byteOffset ?? 0) + view.byteLength <= binLength, "Vue GLB hors limites");
    }
  }
}

const validStates = new Set(["asset_only", "integrated_in_code"]);
const catalogAssetIds = new Set();

for (const name of ["creatures", "equipements"]) {
  const catalog = load(`docs/catalogues/${name}.json`);
  assert(catalog.schema_version === 1, `Schéma invalide : ${name}`);
  assert(Array.isArray(catalog.entries), `Entrées absentes : ${name}`);
  const known = new Set();
  for (const entry of catalog.entries) {
    assert(typeof entry.id === "string" && entry.id.length > 0, "ID vide");
    assert(!known.has(entry.id), `ID dupliqué : ${entry.id}`);
    known.add(entry.id);
    assert(validStates.has(entry.status), `État invalide : ${entry.id}`);
    assert(Array.isArray(entry.source_files), `Sources invalides : ${entry.id}`);
    for (const file of entry.source_files) {
      assert(isFile(file), `Source absente : ${file}`);
    }
    if (entry.status === "integrated_in_code") {
      assert(entry.source_files.length > 0, `Pas de source : ${entry.id}`);
    } else {
      assert(entry.asset_id !== null, `Asset requis : ${entry.id}`);
      assert(entry.source_files.length === 0, `Statut incohérent : ${entry.id}`);
    }
    if (entry.asset_id !== null) {
      assert(assetIds.has(entry.asset_id), `Asset inconnu : ${entry.id}`);
    }
    if (entry.asset_id !== null) catalogAssetIds.add(entry.asset_id);
  }
}

for (const id of assetIds) {
  assert(catalogAssetIds.has(id), `Modèle sans fiche : ${id}`);
}

console.log("Catalogues et références de modèles vérifiés.");
