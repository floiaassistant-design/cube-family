import { BlockId } from "../world/blocks";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "../world/coords";
import type { Chunk } from "../world/chunk";
import { fortressBlueprint } from "./fortress-blueprint";

/** Dedicated, unsaved challenge map. It only applies to an explicitly opted-in
 * fortress session; ordinary worlds, edits, and world seeds are untouched.
 * Chunk patching occurs before meshing and is repeatable after chunk streaming.
 */
export const FORTRESS_GROUND_Y = 64;
export const FORTRESS_WORLD_SEED = 846913;
const MAP_MIN = -16;
const MAP_MAX = 111;

// Only compute this sparse lookup once; no giant per-frame voxel operations.
const blueprintByChunk = new Map<string, ReturnType<typeof fortressBlueprint>>();
for (const cell of fortressBlueprint()) {
  const cx = Math.floor(cell.x / CHUNK_SIZE);
  const cz = Math.floor(cell.z / CHUNK_SIZE);
  const key = `${cx},${cz}`;
  let cells = blueprintByChunk.get(key);
  if (!cells) {
    cells = [];
    blueprintByChunk.set(key, cells);
  }
  cells.push(cell);
}

export function applyFortressChunk(chunk: Chunk): void {
  const startX = chunk.cx * CHUNK_SIZE;
  const startZ = chunk.cz * CHUNK_SIZE;
  if (
    startX > MAP_MAX ||
    startZ > MAP_MAX ||
    startX + CHUNK_SIZE - 1 < MAP_MIN ||
    startZ + CHUNK_SIZE - 1 < MAP_MIN
  )
    return;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    const wx = startX + x;
    if (wx < MAP_MIN || wx > MAP_MAX) continue;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wz = startZ + z;
      if (wz < MAP_MIN || wz > MAP_MAX) continue;
      // Preserve original underground terrain while leveling a safe arena.
      for (let y = FORTRESS_GROUND_Y - 1; y < CHUNK_HEIGHT; y++) {
        chunk.setBlock(
          x,
          y,
          z,
          y === FORTRESS_GROUND_Y
            ? BlockId.GRASS
            : y < FORTRESS_GROUND_Y
              ? BlockId.STONE
              : BlockId.AIR,
        );
      }
    }
  }

  for (const cell of blueprintByChunk.get(`${chunk.cx},${chunk.cz}`) ?? []) {
    const y = FORTRESS_GROUND_Y + cell.y;
    if (y < CHUNK_HEIGHT) {
      chunk.setBlock(cell.x - startX, y, cell.z - startZ, cell.id);
    }
  }
}
