import { FortressStore } from "../game/siege/fortress-store";
import { BLOCKS } from "./blocks";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./coords";
import type { KeyValueStorage } from "./edit-store";
import { loadPlayerSave, playerSaveKey } from "./player-save";
import { isWorldSeed, type WorldEntry, type WorldMode, WorldRegistry } from "./world-registry";

export const MAX_WORLD_FILE_BYTES = 6_000_000;
const MAX_EDIT_CELLS = 200_000;
const SAVE_KEYS = {
  player: playerSaveKey,
  edits: (seed: number): string => `voxel-world:edits:v2:${seed.toString()}`,
  fortress: (seed: number): string => `voxel-world:fortress:v1:${seed.toString()}`,
} as const;

type SaveKind = keyof typeof SAVE_KEYS;
type Saves = Record<SaveKind, string | null>;

interface WorldArchive {
  readonly format: "cube-family-world";
  readonly version: 1;
  readonly world: {
    readonly seed: number;
    readonly name: string;
    readonly mode: WorldMode;
  };
  readonly saves: Saves;
}

export type ImportWorldResult =
  | { readonly ok: true; readonly seed: number }
  | { readonly ok: false; readonly reason: "invalid" | "conflict" | "storage" };

interface TransferStorage extends KeyValueStorage {
  removeItem?(key: string): void;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validEdits(value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return false;
  }
  if (!record(parsed)) return false;
  let total = 0;
  for (const [chunk, cells] of Object.entries(parsed)) {
    if (!/^-?\d+,-?\d+$/.test(chunk) || !record(cells)) return false;
    for (const [index, block] of Object.entries(cells)) {
      total++;
      const offset = Number(index);
      if (
        total > MAX_EDIT_CELLS ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset >= CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT ||
        offset.toString() !== index ||
        typeof block !== "number" ||
        !Object.hasOwn(BLOCKS, block)
      ) {
        return false;
      }
    }
  }
  return true;
}

function validPlayer(seed: number, value: string): boolean {
  return (
    loadPlayerSave(
      { getItem: (key) => (key === playerSaveKey(seed) ? value : null), setItem: () => undefined },
      seed,
    ) !== null
  );
}

function validFortress(seed: number, value: string): boolean {
  return (
    new FortressStore(
      {
        getItem: () => value,
        setItem: () => undefined,
      },
      seed,
    ).read() !== null
  );
}

function parseArchive(text: string): WorldArchive | null {
  if (text.length > MAX_WORLD_FILE_BYTES || text.length === 0) return null;
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!record(value) || value.format !== "cube-family-world" || value.version !== 1) {
    return null;
  }
  if (!record(value.world) || !record(value.saves)) return null;
  const { seed, name, mode } = value.world;
  if (
    typeof seed !== "number" ||
    !isWorldSeed(seed) ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.length > 40 ||
    (mode !== "creative" && mode !== "adventure")
  ) {
    return null;
  }
  const saves = value.saves;
  for (const kind of Object.keys(SAVE_KEYS) as SaveKind[]) {
    if (saves[kind] !== null && typeof saves[kind] !== "string") return null;
  }
  const player = saves.player as string | null;
  const edits = saves.edits as string | null;
  const fortress = saves.fortress as string | null;
  if (
    (player !== null && !validPlayer(seed, player)) ||
    (edits !== null && !validEdits(edits)) ||
    (fortress !== null && fortress.length > 0 && !validFortress(seed, fortress))
  ) {
    return null;
  }
  return {
    format: "cube-family-world",
    version: 1,
    world: { seed, name: name.trim(), mode },
    saves: { player, edits, fortress },
  };
}

/** Export only the selected world's save keys. Never export settings or other worlds. */
export function exportWorldArchive(
  storage: KeyValueStorage | null,
  entry: WorldEntry | null,
): string | null {
  if (!storage || !entry || !isWorldSeed(entry.seed)) return null;
  try {
    const saves: Saves = {
      player: storage.getItem(SAVE_KEYS.player(entry.seed)),
      edits: storage.getItem(SAVE_KEYS.edits(entry.seed)),
      fortress: storage.getItem(SAVE_KEYS.fortress(entry.seed)),
    };
    const archive = JSON.stringify({
      format: "cube-family-world",
      version: 1,
      world: { seed: entry.seed, name: entry.name, mode: entry.mode },
      saves,
    });
    return parseArchive(archive) ? archive : null;
  } catch {
    return null;
  }
}

/**
 * Restore into an unused seed only. An imported world may never overwrite
 * a player save or an existing registry entry, even with user metadata changed.
 * New keys are rolled back if storage or registry creation fails.
 */
export function importWorldArchive(
  storage: TransferStorage | null,
  registry: WorldRegistry,
  text: string,
): ImportWorldResult {
  const archive = parseArchive(text);
  if (!archive) return { ok: false, reason: "invalid" };
  if (!storage?.removeItem) return { ok: false, reason: "storage" };

  const { seed, name, mode } = archive.world;
  if (registry.get(seed)) return { ok: false, reason: "conflict" };
  const keys = (Object.keys(SAVE_KEYS) as SaveKind[]).map((kind) => ({
    key: SAVE_KEYS[kind](seed),
    value: archive.saves[kind],
  }));
  try {
    if (keys.some(({ key }) => storage.getItem(key) !== null)) {
      return { ok: false, reason: "conflict" };
    }
  } catch {
    return { ok: false, reason: "storage" };
  }
  // Reserve the seed before writing its save payload: registry.create checks
  // that no saves exist yet, so invoking it after writes would fail.
  if (!registry.create(name, mode, seed)) return { ok: false, reason: "storage" };
  try {
    for (const { key, value } of keys) {
      if (value !== null) storage.setItem(key, value);
    }
    return { ok: true, seed };
  } catch {
    // The new world is not active. Remove every new key and its registry
    // entry; preflight guaranteed there were no earlier keys to destroy.
    registry.remove(seed, -1);
    return { ok: false, reason: "storage" };
  }
}
