import type { KeyValueStorage } from "./edit-store";

/** Metadata only: legacy player, block and fortress saves remain keyed by seed. */
export const WORLD_REGISTRY_KEY = "cube-family:world-registry:v1";
const WORLD_LIMIT = 200;
const MAX_SEED = 0x7fffffff;
const SAVE_PREFIXES = [
  "voxel-world:player:v2:",
  "voxel-world:edits:v2:",
  "voxel-world:fortress:v1:",
] as const;

export type WorldMode = "creative" | "adventure";

export interface WorldEntry {
  readonly seed: number;
  readonly name: string;
  readonly mode: WorldMode;
  readonly createdAt: number;
  readonly lastPlayed: number;
}

interface IndexedStorage extends KeyValueStorage {
  readonly length?: number;
  key?(index: number): string | null;
  removeItem?(key: string): void;
}

export function isWorldSeed(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MAX_SEED;
}

function safeName(name: string): string {
  return name.trim().slice(0, 40);
}

function readEntry(value: unknown): WorldEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.seed !== "number" ||
    !isWorldSeed(v.seed) ||
    typeof v.name !== "string" ||
    !safeName(v.name) ||
    (v.mode !== "creative" && v.mode !== "adventure") ||
    typeof v.createdAt !== "number" ||
    !Number.isSafeInteger(v.createdAt) ||
    v.createdAt < 0 ||
    typeof v.lastPlayed !== "number" ||
    !Number.isSafeInteger(v.lastPlayed) ||
    v.lastPlayed < 0
  ) {
    return null;
  }
  return {
    seed: v.seed,
    name: safeName(v.name),
    mode: v.mode,
    createdAt: v.createdAt,
    lastPlayed: v.lastPlayed,
  };
}

export class WorldRegistry {
  private readonly worlds = new Map<number, WorldEntry>();

  private readonly storage: IndexedStorage | null;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(
    storage: IndexedStorage | null,
    now: () => number = Date.now,
    random: () => number = Math.random,
  ) {
    this.storage = storage;
    this.now = now;
    this.random = random;
    this.load();
    this.discoverExistingSaves();
  }

  private fallback(seed: number): WorldEntry {
    return { seed, name: `World ${seed.toString()}`, mode: "creative", createdAt: 0, lastPlayed: 0 };
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(WORLD_REGISTRY_KEY);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const parsed = data as { version?: unknown; worlds?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.worlds)) return;
      for (const value of parsed.worlds.slice(0, WORLD_LIMIT)) {
        const entry = readEntry(value);
        if (entry) this.worlds.set(entry.seed, entry);
      }
    } catch {
      // Damaged metadata must never hide or modify legacy saves.
    }
  }

  private discoverExistingSaves(): void {
    if (!this.storage?.key || typeof this.storage.length !== "number") return;
    let added = false;
    try {
      const length = Math.min(this.storage.length, 10000);
      for (let i = 0; i < length && this.worlds.size < WORLD_LIMIT; i++) {
        const key = this.storage.key(i);
        if (!key) continue;
        const prefix = SAVE_PREFIXES.find((part) => key.startsWith(part));
        if (!prefix || !this.storage.getItem(key)) continue;
        const suffix = key.slice(prefix.length);
        const seed = Number(suffix);
        if (!isWorldSeed(seed) || seed.toString() !== suffix || this.worlds.has(seed)) continue;
        this.worlds.set(seed, this.fallback(seed));
        added = true;
      }
    } catch {
      // Storage enumeration may be blocked by privacy settings.
    }
    if (added) this.persist();
  }

  private persist(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(
        WORLD_REGISTRY_KEY,
        JSON.stringify({ version: 1, worlds: [...this.worlds.values()] }),
      );
      return true;
    } catch {
      return false;
    }
  }

  list(): WorldEntry[] {
    return [...this.worlds.values()].sort(
      (a, b) => b.lastPlayed - a.lastPlayed || b.createdAt - a.createdAt || a.seed - b.seed,
    );
  }

  get(seed: number): WorldEntry | null {
    return this.worlds.get(seed) ?? null;
  }

  /** Remember a visited world without rewriting any existing save keys. */
  visit(seed: number, mode: WorldMode): void {
    if (!isWorldSeed(seed)) return;
    const previous = this.worlds.get(seed) ?? this.fallback(seed);
    this.worlds.set(seed, { ...previous, mode, lastPlayed: this.now() });
    this.persist();
  }

  setMode(seed: number, mode: WorldMode): void {
    const previous = this.worlds.get(seed);
    if (!previous) return;
    this.worlds.set(seed, { ...previous, mode });
    this.persist();
  }

  private seedOccupied(seed: number): boolean {
    if (this.worlds.has(seed)) return true;
    try {
      return SAVE_PREFIXES.some((prefix) => Boolean(this.storage?.getItem(prefix + seed.toString())));
    } catch {
      // Never assume an unavailable store is empty.
      return true;
    }
  }

  /** A seed can identify only one local save until the save format is versioned. */
  create(name: string, mode: WorldMode, requestedSeed?: number): WorldEntry | null {
    const clean = safeName(name);
    if (!clean || this.worlds.size >= WORLD_LIMIT || !this.storage) return null;
    let seed = requestedSeed;
    if (seed === undefined) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = Math.floor(this.random() * MAX_SEED);
        if (isWorldSeed(candidate) && !this.seedOccupied(candidate)) {
          seed = candidate;
          break;
        }
      }
    }
    if (seed === undefined || !isWorldSeed(seed) || this.seedOccupied(seed)) return null;
    const stamp = this.now();
    const entry: WorldEntry = {
      seed,
      name: clean,
      mode,
      createdAt: stamp,
      lastPlayed: stamp,
    };
    this.worlds.set(seed, entry);
    if (!this.persist()) {
      this.worlds.delete(seed);
      return null;
    }
    return entry;
  }

  rename(seed: number, name: string): boolean {
    const previous = this.worlds.get(seed);
    const clean = safeName(name);
    if (!previous || !clean) return false;
    this.worlds.set(seed, { ...previous, name: clean });
    if (this.persist()) return true;
    this.worlds.set(seed, previous);
    return false;
  }

  /** Never delete the active world's saves: its running session could recreate them. */
  remove(seed: number, activeSeed: number): boolean {
    const previous = this.worlds.get(seed);
    if (!previous || seed === activeSeed || !this.storage?.removeItem) return false;
    this.worlds.delete(seed);
    if (!this.persist()) {
      this.worlds.set(seed, previous);
      return false;
    }
    try {
      for (const prefix of SAVE_PREFIXES) this.storage.removeItem(prefix + seed.toString());
      return true;
    } catch {
      // A partially failed removal must remain visible so it can be retried.
      this.worlds.set(seed, previous);
      this.persist();
      return false;
    }
  }
}
