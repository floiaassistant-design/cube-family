import { BLOCKS, type BlockId } from "./blocks";
import { Chunk } from "./chunk";
import { CHUNK_HEIGHT, CHUNK_SIZE, chunkKey, worldToChunk, worldToLocal } from "./coords";

/** The subset of Storage this store needs — injectable so tests run against
 * a plain in-memory stub instead of a browser's localStorage. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type SerializedEdits = Record<string, Record<string, number>>;

/** Player edits as a sparse overlay: chunk key -> (flat block index -> block
 * id). Chunks themselves are never persisted — they're always regenerated
 * from the seed and the overlay is re-applied on top, so a whole explored
 * world costs only as much storage as the blocks the player actually
 * changed. Keyed by seed: two worlds never see each other's edits. */
export class EditStore {
  private readonly storage: KeyValueStorage | null;
  private readonly key: string;
  private readonly edits = new Map<string, Map<number, BlockId>>();

  constructor(storage: KeyValueStorage | null, seed: number) {
    this.storage = storage;
    this.key = EditStore.storageKey(seed);
    this.load();
  }

  static storageKey(seed: number): string {
    return `voxel-world:edits:v2:${seed.toString()}`;
  }

  record(worldX: number, worldY: number, worldZ: number, id: BlockId): void {
    const key = chunkKey(worldToChunk(worldX), worldToChunk(worldZ));
    let chunkEdits = this.edits.get(key);
    if (!chunkEdits) {
      chunkEdits = new Map();
      this.edits.set(key, chunkEdits);
    }
    chunkEdits.set(Chunk.index(worldToLocal(worldX), worldY, worldToLocal(worldZ)), id);
    this.save();
  }

  /** Batch structure edits: persist once rather than once per voxel. */
  recordMany(edits: readonly { x: number; y: number; z: number; id: BlockId }[]): void {
    for (const edit of edits) {
      if (!Number.isInteger(edit.x) || !Number.isInteger(edit.y) || !Number.isInteger(edit.z) ||
          edit.y < 0 || edit.y >= CHUNK_HEIGHT || !Object.hasOwn(BLOCKS, edit.id)) {
        throw new Error("Invalid block in edit batch");
      }
    }
    for (const edit of edits) {
      const key = chunkKey(worldToChunk(edit.x), worldToChunk(edit.z));
      let cells = this.edits.get(key);
      if (!cells) {
        cells = new Map();
        this.edits.set(key, cells);
      }
      cells.set(Chunk.index(worldToLocal(edit.x), edit.y, worldToLocal(edit.z)), edit.id);
    }
    this.save();
  }

  /** Returns true if any existing player edit would intersect the structure. */
  hasEditsInRect(minX: number, maxX: number, minZ: number, maxZ: number): boolean {
    for (let cx = worldToChunk(minX); cx <= worldToChunk(maxX); cx++) {
      for (let cz = worldToChunk(minZ); cz <= worldToChunk(maxZ); cz++) {
        const cells = this.edits.get(chunkKey(cx, cz));
        if (!cells) continue;
        for (const index of cells.keys()) {
          const x = cx * CHUNK_SIZE + (index % CHUNK_SIZE);
          const z = cz * CHUNK_SIZE + (Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE);
          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
        }
      }
    }
    return false;
  }

  /** Re-applies recorded edits onto a freshly generated chunk. */
  applyTo(chunk: Chunk): void {
    const chunkEdits = this.edits.get(chunkKey(chunk.cx, chunk.cz));
    if (!chunkEdits) return;
    for (const [index, id] of chunkEdits) {
      chunk.buffer[index] = id;
    }
  }

  /** Forgets every edit (the world returns to how the seed made it). */
  clear(): void {
    this.edits.clear();
    this.save();
  }

  get editedChunkCount(): number {
    return this.edits.size;
  }

  get totalEdits(): number {
    let total = 0;
    for (const chunkEdits of this.edits.values()) total += chunkEdits.size;
    return total;
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return;
      for (const [key, cells] of Object.entries(parsed) as [string, unknown][]) {
        if (
          !/^-?\d+,-?\d+$/.test(key) ||
          !cells ||
          typeof cells !== "object" ||
          Array.isArray(cells)
        ) {
          continue;
        }
        const chunkEdits = new Map<number, BlockId>();
        for (const [index, id] of Object.entries(cells) as [string, unknown][]) {
          const cell = Number(index);
          if (
            cell.toString() === index &&
            Number.isInteger(cell) &&
            cell >= 0 &&
            cell < CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT &&
            typeof id === "number" &&
            Object.hasOwn(BLOCKS, id)
          ) {
            chunkEdits.set(cell, id as BlockId);
          }
        }
        if (chunkEdits.size > 0) this.edits.set(key, chunkEdits);
      }
    } catch {
      // A corrupt payload silently resets the overlay — losing edits beats
      // wedging the game on startup forever.
    }
  }

  private save(): void {
    if (!this.storage) return;
    const out: SerializedEdits = {};
    for (const [key, chunkEdits] of this.edits) {
      const cells: Record<string, number> = {};
      for (const [index, id] of chunkEdits) {
        cells[index.toString()] = id;
      }
      out[key] = cells;
    }
    try {
      this.storage.setItem(this.key, JSON.stringify(out));
    } catch {
      // Edits remain available in memory when local storage is full or blocked.
    }
  }
}
