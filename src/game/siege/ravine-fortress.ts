import { BlockId, type BlockId as Block } from "../../world/blocks";
import type { FortressBlock, FortressLocation } from "./fortress";
import {
  RAVINE_APPROACH_Z,
  RAVINE_CRYSTAL_Z,
  RAVINE_GATES,
  RAVINE_PASSAGE,
  RAVINE_WALKWAY,
  ravineGroundOffset,
} from "./ravine-layout";

function cliffsAt(z: number): { west: number; east: number } {
  const pinch = Math.floor(Math.max(0, z) / 25);
  return {
    west: 24 + pinch + Math.floor(3 * Math.sin(z * 0.16)),
    east: 72 - pinch + Math.floor(3 * Math.cos(z * 0.13)),
  };
}

/** A rising ravine pinned between two irregular cliff faces. The main lane,
 * stairs and wall walks are cut out before the masonry is placed. */
export function createRavineFortress(site: FortressLocation): FortressBlock[] {
  const blocks = new Map<string, FortressBlock>();
  const put = (x: number, y: number, z: number, id: Block): void => {
    blocks.set(`${x},${y},${z}`, { x: site.x + x, y: site.y + y, z: site.z + z, id });
  };
  const fill = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    id: Block,
  ): void => {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) put(x, y, z, id);
      }
    }
  };

  for (let z = RAVINE_APPROACH_Z; z <= 75; z++) {
    const base = ravineGroundOffset(z);
    const { west, east } = cliffsAt(z);
    const minX = z < 0 ? 35 : west - 1;
    const maxX = z < 0 ? 60 : east + 1;
    fill(minX, maxX, z, z, -1, base, BlockId.STONE);
    fill(minX, maxX, z, z, base + 1, 17, BlockId.AIR);
    fill(minX, maxX, z, z, base, base, BlockId.GRAVEL);
    fill(41, 54, z, z, base, base, BlockId.COBBLE);

    if (z % 7 === 0) {
      const footing = Math.max(-22, 1 - site.y);
      for (const x of [minX, 41, 53, maxX - 1])
        fill(x, x + 1, z, z + 1, footing, -2, BlockId.COBBLE);
    }
    if (z < 0) continue;
    const crest = 14 + Math.floor(3 * Math.sin(z * 0.24)) + Math.floor(z / 40);
    for (let depth = 0; depth < 10; depth++) {
      const height = Math.min(19, crest + Math.floor(depth / 2));
      const rock = depth % 4 === 0 ? BlockId.COBBLE : BlockId.STONE;
      for (const x of [west - depth, east + depth]) {
        fill(x, x, z, z, -2, height - 1, rock);
        put(x, height, z, height >= 16 ? BlockId.SNOW : BlockId.STONE);
      }
    }
  }

  for (const { z, towerHeight, facing } of [
    { z: RAVINE_GATES.outer.z, towerHeight: 2, facing: BlockId.COBBLE },
    { z: RAVINE_GATES.inner.z, towerHeight: 4, facing: BlockId.COPPER_BLOCK },
    { z: RAVINE_GATES.keep.z, towerHeight: 4, facing: BlockId.STONE_BRICK },
  ]) {
    const base = ravineGroundOffset(z);
    const { west, east } = cliffsAt(z);
    const walk = base + RAVINE_WALKWAY;
    // Six high and twelve wide so a Titan fits in every assault lane.
    fill(west - 3, east + 3, z - 1, z + 2, base + 1, walk, BlockId.STONE_BRICK);
    fill(
      RAVINE_PASSAGE.firstX,
      RAVINE_PASSAGE.lastX,
      z - 1,
      z + 2,
      base + 1,
      base + RAVINE_PASSAGE.height,
      BlockId.AIR,
    );
    // Full-height merlons alternate with open shooting lanes.
    for (let x = west + 2; x < east; x += 4) {
      fill(x, x + 1, z - 1, z - 1, walk + 1, walk + 2, BlockId.STONE_BRICK);
    }

    // Lanterns mark the passage. Towers leave the central shooting gallery open.
    for (const towerX of [RAVINE_PASSAGE.firstX - 4, RAVINE_PASSAGE.lastX + 1]) {
      fill(towerX, towerX + 3, z - 3, z - 2, base + 1, walk + towerHeight, BlockId.STONE_BRICK);
      fill(towerX - 1, towerX + 4, z - 4, z - 2, walk + towerHeight, walk + towerHeight, facing);
      put(towerX + 1, base + 4, z - 4, BlockId.LANTERN);
      put(towerX + 2, walk + towerHeight + 1, z - 3, BlockId.LANTERN);
    }

    // Steps on both sides make the walk usable with its portcullis shut.
    for (const { x, direction, edge } of [
      { x: 33, direction: 1, edge: z + 2 },
      { x: 60, direction: -1, edge: z - 1 },
    ]) {
      for (let step = 1; step <= RAVINE_WALKWAY; step++) {
        const stairZ = edge + direction * step;
        const floor = ravineGroundOffset(stairZ);
        fill(x, x + 3, stairZ, stairZ, floor + 1, walk - step, BlockId.STONE_BRICK);
      }
      put(x - 1, walk + 1, edge, BlockId.LANTERN);
    }
  }

  // Braziers leave the middle of the lane clear and light each fallback.
  for (const z of [-8, 2, 12, 20, 30, 38, 48, 56]) {
    const base = ravineGroundOffset(z);
    for (const x of [40, 55]) {
      put(x, base + 1, z, BlockId.COBBLE);
      put(x, base + 2, z, BlockId.LANTERN);
    }
  }

  const rearFloor = ravineGroundOffset(RAVINE_CRYSTAL_Z);
  fill(33, 62, 66, 69, rearFloor + 1, rearFloor + 9, BlockId.STONE_BRICK);
  for (const x of [34, 56]) {
    fill(x, x + 5, 63, 69, rearFloor + 1, rearFloor + 10, BlockId.STONE_BRICK);
    fill(x - 1, x + 6, 62, 70, rearFloor + 10, rearFloor + 10, BlockId.COBBLE);
    for (const side of [x - 1, x + 5])
      fill(side, side + 1, 62, 64, rearFloor + 11, rearFloor + 11, BlockId.STONE_BRICK);
    put(x + 2, rearFloor + 5, 62, BlockId.LANTERN);
  }
  fill(43, 52, 59, 65, rearFloor, rearFloor, BlockId.STONE_BRICK);
  fill(
    46,
    48,
    RAVINE_CRYSTAL_Z,
    RAVINE_CRYSTAL_Z + 1,
    rearFloor + 1,
    rearFloor + 1,
    BlockId.COPPER_BLOCK,
  );
  put(47, rearFloor + 2, RAVINE_CRYSTAL_Z, BlockId.CRYSTAL);
  for (const x of [43, 52]) put(x, rearFloor + 1, RAVINE_CRYSTAL_Z + 2, BlockId.LANTERN);
  return [...blocks.values()];
}
