import type { Vec3 } from "../player/physics";
import { BlockId } from "../world/blocks";
import type { Chunk } from "../world/chunk";
import { CHUNK_HEIGHT, chunkKey, worldToChunk, worldToLocal } from "../world/coords";
import type { EditStore } from "../world/edit-store";
import { SEA_LEVEL } from "../world/terrain";

export type RuinSite = Vec3;
type TerrainHeight = (x: number, z: number) => number;
type ColumnConflict = (minX: number, maxX: number, minZ: number, maxZ: number) => boolean;
type RuinCell = Vec3 & { readonly block: BlockId };
const FOOTPRINT = 3;
const SUPPORT_DEPTH = 5;

export function readRuinSite(value: unknown): RuinSite | null {
  if (value === null || typeof value !== "object") return null;
  const { x, y, z } = value as Partial<RuinSite>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(z) ||
    Math.abs(x) > 2 ** 30 ||
    Math.abs(z) > 2 ** 30 ||
    y <= SEA_LEVEL ||
    y + 5 >= CHUNK_HEIGHT
  )
    return null;
  return { x, y, z };
}

/** Find a dry site with space around the entrance, near the refuge first. */
export function findWatchersRuin(
  origin: Pick<Vec3, "x" | "z">,
  spawn: Pick<Vec3, "x" | "z">,
  height: TerrainHeight,
  hasEdits: ColumnConflict,
): RuinSite {
  let fallback: { site: RuinSite; score: number } | undefined;
  for (const center of [origin, spawn]) {
    for (const radius of [28, 40, 56, 72, 96, 128, 192]) {
      for (let bearing = 0; bearing < 8; bearing++) {
        const angle = (bearing * Math.PI) / 4;
        const x = Math.floor(center.x + Math.cos(angle) * radius);
        const z = Math.floor(center.z + Math.sin(angle) * radius);
        if (hasEdits(x - FOOTPRINT, x + FOOTPRINT, z - FOOTPRINT, z + FOOTPRINT)) continue;
        let low = Infinity;
        let high = 0;
        for (let dx = -FOOTPRINT; dx <= FOOTPRINT; dx++) {
          for (let dz = -FOOTPRINT; dz <= FOOTPRINT; dz++) {
            const ground = height(x + dx, z + dz);
            low = Math.min(low, ground);
            high = Math.max(high, ground);
          }
        }
        const site = readRuinSite({ x, z, y: Math.max(SEA_LEVEL + 1, high) });
        if (!site) continue;
        const relief = high - low;
        if (low > SEA_LEVEL && relief <= 2) return site;
        const score = relief + (low > SEA_LEVEL ? 0 : 15) + radius / 32;
        if (!fallback || score < fallback.score) fallback = { site, score };
      }
    }
  }
  if (fallback) return fallback.site;
  // Even an extensively built-up world gets a site. The overlay always gives
  // existing player edits priority, including air where they removed a block.
  const x = Math.floor(spawn.x + 28);
  const z = Math.floor(spawn.z);
  const y = Math.min(CHUNK_HEIGHT - 6, Math.max(SEA_LEVEL + 1, height(x, z)));
  return { x, y, z };
}

/** Locally generated ruins follow the world's normal streaming and edit precedence. */
export class WatchersRuin {
  private readonly cellsByChunk = new Map<string, RuinCell[]>();
  readonly chunks: { readonly cx: number; readonly cz: number }[] = [];

  constructor(site: RuinSite, height: TerrainHeight) {
    for (let dx = -FOOTPRINT; dx <= FOOTPRINT; dx++) {
      for (let dz = -FOOTPRINT; dz <= FOOTPRINT; dz++) {
        const x = site.x + dx;
        const z = site.z + dz;
        const cx = worldToChunk(x);
        const cz = worldToChunk(z);
        const key = chunkKey(cx, cz);
        let cells = this.cellsByChunk.get(key);
        if (!cells) {
          cells = [];
          this.cellsByChunk.set(key, cells);
          this.chunks.push({ cx, cz });
        }
        const base = Math.max(height(x, z), site.y - SUPPORT_DEPTH);
        for (let y = base; y < site.y; y++) cells.push({ x, y, z, block: BlockId.COBBLE });
        for (let dy = 0; dy <= 4; dy++) {
          cells.push({ x, y: site.y + dy, z, block: this.block(dx, dy, dz) });
        }
      }
    }
  }

  private block(x: number, y: number, z: number): BlockId {
    if (y === 0)
      return Math.abs(x) === 3 || Math.abs(z) === 3 ? BlockId.COBBLE : BlockId.STONE_BRICK;

    // An open courtyard, a broken arch and two illuminated relics at the back.
    if (z === 2 && Math.abs(x) === 2 && y <= 4) return BlockId.STONE_BRICK;
    if (z === 2 && y === 4 && x >= -2 && x <= 0) return BlockId.STONE_BRICK;
    if (z === -2 && Math.abs(x) <= 2 && y <= (x === 2 ? 1 : 2)) return BlockId.COBBLE;
    if (z === -2 && y === 3 && Math.abs(x) === 1) return BlockId.LANTERN;
    if (z === -1 && y === 1 && Math.abs(x) === 1) return BlockId.COPPER_ORE;
    if (x === -2 && z <= 0 && y === 1) return BlockId.STONE_BRICK;
    return BlockId.AIR;
  }

  apply(chunk: Chunk, edits: Pick<EditStore, "hasEdit">): void {
    const cells = this.cellsByChunk.get(chunkKey(chunk.cx, chunk.cz));
    for (const { x, y, z, block } of cells ?? []) {
      if (!edits.hasEdit(x, y, z)) chunk.setBlock(worldToLocal(x), y, worldToLocal(z), block);
    }
  }
}
