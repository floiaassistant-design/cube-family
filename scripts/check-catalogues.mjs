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
}

const validStates = new Set(["asset_only", "integrated_in_code"]);
const creatureIds = new Set();

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
    if (name === "creatures") creatureIds.add(entry.id);
  }
}

for (const id of assetIds) {
  assert(creatureIds.has(id), `Modèle sans fiche créature : ${id}`);
}

console.log("Catalogues et références de modèles vérifiés.");
