import { BlockId } from "../world/blocks";

/** Reusable, seed-independent voxel plan. Never writes to the world or saves. */
export interface FortressBlock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly id: BlockId;
}
export interface FortressPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export const FORTRESS_SIZE = 96;
export const FORTRESS_HEIGHT = 24;
export const FORTRESS_GATE = { x: 48, y: 1, z: 94 } as const;
export const FORTRESS_CRYSTAL = { x: 48, y: 2, z: 48 } as const;
export const FORTRESS_SPAWNS: readonly FortressPoint[] = [
  { x: 48, y: 1, z: -12 },
  { x: 108, y: 1, z: 48 },
  { x: 48, y: 1, z: 108 },
  { x: -12, y: 1, z: 48 },
  { x: 106, y: 1, z: -10 },
];

/** Generates a distinctive five-bastion castle, relative to a level floor at y=0.
 * Does not generate a solid 96x96 foundation: that would overwhelm mobile
 * devices and write hundreds of thousands of unnecessary world edits.
 */
export function fortressBlueprint(): FortressBlock[] {
  const cells = new Map<string, FortressBlock>();
  const put = (x: number, y: number, z: number, id: BlockId): void => {
    if (x < 0 || x >= FORTRESS_SIZE || z < 0 || z >= FORTRESS_SIZE) return;
    if (y < 0 || y >= FORTRESS_HEIGHT) return;
    cells.set(`${x},${y},${z}`, { x, y, z, id });
  };
  const fill = (
    minX: number, maxX: number, minY: number, maxY: number,
    minZ: number, maxZ: number, id: BlockId,
  ): void => {
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++) put(x, y, z, id);
  };
  // Continuous outer curtain walls, with a five-block-wide south gate.
  for (let y = 1; y <= 10; y++) {
    fill(8, 10, y, y, 8, 87, BlockId.STONE_BRICK);
    fill(85, 87, y, y, 8, 87, BlockId.STONE_BRICK);
    fill(8, 87, y, y, 8, 10, BlockId.STONE_BRICK);
    fill(8, 87, y, y, 85, 87, BlockId.STONE_BRICK);
  }
  fill(45, 51, 1, 7, 85, 87, BlockId.AIR);
  fill(43, 53, 8, 12, 83, 89, BlockId.STONE_BRICK);
  fill(45, 51, 8, 10, 85, 87, BlockId.PLANKS);
  // Battlements: walkable parapets with alternating crenellations.
  for (let n = 12; n <= 83; n += 4) {
    fill(n, n + 1, 11, 12, 8, 9, BlockId.STONE_BRICK);
    fill(n, n + 1, 11, 12, 86, 87, BlockId.STONE_BRICK);
    fill(8, 9, 11, 12, n, n + 1, BlockId.STONE_BRICK);
    fill(86, 87, 11, 12, n, n + 1, BlockId.STONE_BRICK);
  }
  // Four large hollow towers, with covered upper platforms.
  for (const [cx, cz] of [[10, 10], [85, 10], [10, 85], [85, 85]] as const) {
    for (let x = cx - 6; x <= cx + 6; x++)
      for (let z = cz - 6; z <= cz + 6; z++) {
        if (x < 0 || z < 0 || x >= 96 || z >= 96) continue;
        const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz));
        if (edge >= 5) fill(x, x, 1, 17, z, z, BlockId.STONE_BRICK);
        else {
          put(x, 1, z, BlockId.PLANKS);
          put(x, 15, z, BlockId.PLANKS);
        }
        if (edge === 6 && (x + z) % 3 !== 0) put(x, 19, z, BlockId.STONE_BRICK);
      }
    // Leave an entrance facing the inner courtyard.
    fill(cx < 48 ? cx + 5 : cx - 5, cx < 48 ? cx + 6 : cx - 4, 2, 4,
      cz, cz + 1, BlockId.AIR);
    fill(cx - 6, cx + 6, 18, 18, cz - 6, cz + 6, BlockId.BRICK);
    put(cx, 20, cz, BlockId.LANTERN);
  }
  // The internal defensive ring and two connecting paths.
  for (let y = 1; y <= 6; y++) {
    fill(19, 21, y, y, 19, 76, BlockId.STONE_BRICK);
    fill(74, 76, y, y, 19, 76, BlockId.STONE_BRICK);
    fill(19, 76, y, y, 19, 21, BlockId.STONE_BRICK);
    fill(19, 76, y, y, 74, 76, BlockId.STONE_BRICK);
  }
  fill(46, 49, 1, 4, 74, 76, BlockId.AIR);
  fill(46, 49, 1, 4, 19, 21, BlockId.AIR);
  for (let z = 77; z <= 95; z++) fill(46, 49, 0, 0, z, z, BlockId.COBBLE);
  for (let z = 52; z <= 73; z++) fill(46, 49, 0, 0, z, z, BlockId.COBBLE);
  // Courtyard keep: open archway on its south side and visible crystal.
  for (let y = 1; y <= 13; y++) {
    fill(39, 39, y, y, 39, 57, BlockId.STONE_BRICK);
    fill(56, 56, y, y, 39, 57, BlockId.STONE_BRICK);
    fill(39, 56, y, y, 39, 39, BlockId.STONE_BRICK);
    fill(39, 56, y, y, 57, 57, BlockId.STONE_BRICK);
  }
  fill(46, 49, 1, 4, 57, 57, BlockId.AIR);
  fill(39, 56, 14, 14, 39, 57, BlockId.BRICK);
  fill(44, 51, 0, 0, 44, 51, BlockId.STONE_BRICK);
  fill(47, 48, 1, 3, 47, 48, BlockId.CRYSTAL);
  // Sloping steps from ground level to the wall walkways.
  for (let step = 0; step <= 10; step++) {
    fill(14, 16, step, step, 34 + step, 35 + step, BlockId.STONE_BRICK);
    fill(79, 81, step, step, 34 + step, 35 + step, BlockId.STONE_BRICK);
  }
  // Sparse lighting in the courtyard: no new block ids needed.
  for (const [x, z] of [[30, 30], [65, 30], [30, 65], [65, 65], [48, 81]] as const) {
    fill(x, x, 1, 3, z, z, BlockId.WOOD);
    put(x, 4, z, BlockId.LANTERN);
  }
  return [...cells.values()];
}
