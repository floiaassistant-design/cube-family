import { BlockId, type BlockId as Block } from "../../world/blocks";
import { CHUNK_HEIGHT } from "../../world/coords";
import { createRavineFortress } from "./ravine-fortress";

/** Historical locations omit the layout. Their saved voxels remain authoritative. */
export interface FortressLocation {
  readonly x: number; // south-west corner
  readonly z: number;
  readonly y: number; // courtyard floor
  readonly layout?: "ravine";
}

export interface FortressBlock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly id: Block;
}

export const FORTRESS_SIZE = 96;
export const FORTRESS_CENTER = 47;
export const FORTRESS_CRYSTAL = 47;
export const FORTRESS_CLEARANCE = 20;
const S = FORTRESS_SIZE - 1;

/** Pure blueprint — neither modifies a world nor saves anything. */
export function createFortressBlueprint(site: FortressLocation): FortressBlock[] {
  if (
    ![site.x, site.y, site.z].every(Number.isInteger) ||
    site.y < 18 ||
    site.y + FORTRESS_CLEARANCE >= CHUNK_HEIGHT
  )
    throw new Error("Fortress location is outside the buildable world");
  if (site.layout === "ravine") return createRavineFortress(site);

  const blocks = new Map<string, FortressBlock>();
  const put = (x: number, dy: number, z: number, id: Block): void => {
    const ax = site.x + x;
    const ay = site.y + dy;
    const az = site.z + z;
    blocks.set(`${ax},${ay},${az}`, { x: ax, y: ay, z: az, id });
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
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  const ring = (
    a: number,
    b: number,
    y0: number,
    y1: number,
    thickness: number,
    id: Block,
  ): void => {
    fill(a, b, a, a + thickness - 1, y0, y1, id);
    fill(a, b, b - thickness + 1, b, y0, y1, id);
    fill(a, a + thickness - 1, a, b, y0, y1, id);
    fill(b - thickness + 1, b, a, b, y0, y1, id);
  };
  // Courtyard, flagstones, wooden cross-axes, and raised central plaza.
  fill(0, S, 0, S, 0, 0, BlockId.STONE_BRICK);
  fill(6, 89, 6, 89, 0, 0, BlockId.GRASS);
  fill(43, 52, 2, 93, 0, 0, BlockId.COBBLE);
  fill(2, 93, 43, 52, 0, 0, BlockId.COBBLE);
  fill(31, 64, 31, 64, 0, 0, BlockId.STONE_BRICK);
  // Four-direction approach roads, gently supported on stone piers.
  for (const [dx, dz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    for (let r = 1; r <= 10; r++) {
      for (let n = 44; n <= 51; n++) {
        const x = dx === 0 ? n : dx < 0 ? -r : S + r;
        const z = dz === 0 ? n : dz < 0 ? -r : S + r;
        put(x, 0, z, BlockId.COBBLE);
      }
    }
  }
  // Foundations reach the lowest allowed terrain even on a gently raised site.
  // Never emit a block below bedrock for manually supplied low-lying locations.
  const footingBottom = Math.max(-22, 1 - site.y);
  for (let x = 0; x <= S; x += 8)
    for (let z = 0; z <= S; z += 8) fill(x, x + 1, z, z + 1, footingBottom, -1, BlockId.COBBLE);
  // Primary and secondary curtains. Walkways are wide enough for defenders.
  ring(0, S, 1, 9, 3, BlockId.STONE_BRICK);
  ring(15, 80, 1, 7, 2, BlockId.STONE_BRICK);
  ring(0, S, 10, 10, 5, BlockId.COBBLE);
  ring(15, 80, 8, 8, 4, BlockId.COBBLE);
  for (let p = 0; p <= S; p += 4) {
    for (const a of [0, S]) {
      fill(p, Math.min(S, p + 1), a, a, 11, 12, BlockId.STONE_BRICK);
      fill(a, a, p, Math.min(S, p + 1), 11, 12, BlockId.STONE_BRICK);
    }
  }
  // Four corner bastions, 13 x 13, with walkable roof and arrow slots.
  for (const tx of [0, 83])
    for (const tz of [0, 83]) {
      fill(tx, tx + 12, tz, tz + 12, 1, 1, BlockId.COBBLE);
      for (let y = 2; y <= 16; y++) {
        for (let x = tx; x <= tx + 12; x++)
          for (let z = tz; z <= tz + 12; z++) {
            if (x < tx + 2 || x > tx + 10 || z < tz + 2 || z > tz + 10)
              put(x, y, z, BlockId.STONE_BRICK);
          }
      }
      fill(tx + 2, tx + 10, tz + 2, tz + 10, 9, 9, BlockId.PLANKS);
      fill(tx + 2, tx + 10, tz + 2, tz + 10, 16, 16, BlockId.PLANKS);
      for (let p = 0; p <= 12; p += 3) {
        put(tx + p, 17, tz, BlockId.COBBLE);
        put(tx + p, 17, tz + 12, BlockId.COBBLE);
        put(tx, 17, tz + p, BlockId.COBBLE);
        put(tx + 12, 17, tz + p, BlockId.COBBLE);
      }
      // A spiral staircase joins the lower door to the upper fighting platform.
      // The headroom is cleared at intermediate floors, so both roofs are usable.
      const staircase = [
        [6, 10],
        [7, 10],
        [8, 10],
        [9, 10],
        [9, 9],
        [9, 8],
        [9, 7],
        [9, 6],
        [9, 5],
        [8, 5],
        [7, 5],
        [6, 5],
        [5, 5],
        [4, 5],
        [3, 5],
      ] as const;
      for (const [step, [lx, lz]] of staircase.entries()) {
        const x = tx + lx;
        const z = tz + (tz === 0 ? lz : 12 - lz);
        const y = step + 2;
        put(x, y, z, BlockId.COBBLE);
        put(x, y + 1, z, BlockId.AIR);
        put(x, y + 2, z, BlockId.AIR);
      }
      // Door on the courtyard-facing side and a visible lantern on the roof.
      const entranceZ = tz === 0 ? tz + 12 : tz;
      for (let y = 1; y <= 3; y++) put(tx + 6, y, entranceZ, BlockId.AIR);
      put(tx + 6, 17, tz + 6, BlockId.LANTERN);
    }
  // Main south gate-house is the fifth bastion.
  fill(39, 56, 0, 10, 11, 13, BlockId.STONE_BRICK);
  fill(40, 55, 2, 8, 14, 14, BlockId.PLANKS);
  for (let x = 40; x <= 56; x += 3) put(x, 15, 1, BlockId.COBBLE);
  for (const x of [40, 55]) for (let z = 1; z < 9; z += 2) put(x, 15, z, BlockId.LANTERN);
  // Both outer and inner walls have four 6-block-high open gates.
  for (const [a, b] of [
    [0, 5],
    [15, 16],
    [79, 80],
    [90, 95],
  ] as const) {
    for (let side = a; side <= b; side++) {
      for (let y = 1; y <= 6; y++) {
        for (let p = 44; p <= 51; p++) {
          put(p, y, side, BlockId.AIR);
          put(side, y, p, BlockId.AIR);
        }
      }
    }
  }
  // Four interior stairways connect the courtyard directly to each outer wall.
  for (const tx of [5, 90])
    for (const north of [true, false]) {
      const startZ = north ? 4 : 91;
      const direction = north ? 1 : -1;
      for (let step = 0; step < 10; step++) {
        const z = startZ + direction * step;
        const y = 10 - step;
        fill(tx, tx + 1, z, z, y, y, BlockId.COBBLE);
        fill(tx, tx + 1, z, z, y + 1, y + 2, BlockId.AIR);
      }
    }
  // Central keep, open door to south, crystal on a protective plinth.
  ring(35, 60, 1, 13, 2, BlockId.STONE_BRICK);
  fill(35, 60, 35, 60, 14, 14, BlockId.PLANKS);
  for (let x = 35; x <= 60; x += 3) {
    put(x, 15, 35, BlockId.COBBLE);
    put(x, 15, 60, BlockId.COBBLE);
  }
  for (let z = 35; z <= 60; z += 3) {
    put(35, 15, z, BlockId.COBBLE);
    put(60, 15, z, BlockId.COBBLE);
  }
  // The four cardinal entrances let all enemy approaches reach the crystal.
  for (let y = 1; y <= 7; y++) {
    for (let p = 45; p <= 50; p++) {
      put(p, y, 35, BlockId.AIR);
      put(p, y, 60, BlockId.AIR);
      put(35, y, p, BlockId.AIR);
      put(60, y, p, BlockId.AIR);
    }
  }
  fill(44, 51, 44, 51, 1, 1, BlockId.COBBLE);
  fill(46, 49, 46, 49, 2, 2, BlockId.COPPER_BLOCK);
  put(FORTRESS_CRYSTAL, 3, FORTRESS_CRYSTAL, BlockId.CRYSTAL);
  // Courtyard lighting and supply stalls are visual landmarks.
  for (const [x, z] of [
    [27, 27],
    [68, 27],
    [27, 68],
    [68, 68],
  ] as const) {
    fill(x, x, z, z, 1, 3, BlockId.WOOD);
    put(x, 4, z, BlockId.LANTERN);
    fill(x - 3, x + 3, z - 2, z + 2, 1, 1, BlockId.PLANKS);
  }
  return [...blocks.values()];
}

/** Paths enter by real gate openings, rather than walking through curtain walls. */
export type SiegeRoute = "north" | "south" | "east" | "west";

export function siegePath(
  site: FortressLocation,
  route: SiegeRoute,
): readonly { x: number; z: number }[] {
  const c = (x: number, z: number) => ({ x: site.x + x + 0.5, z: site.z + z + 0.5 });
  switch (route) {
    case "north":
      return [c(47, 107), c(47, 91), c(47, 74), c(47, 58), c(47, 47)];
    case "south":
      return [c(47, -12), c(47, 6), c(47, 22), c(47, 37), c(47, 47)];
    case "east":
      return [c(107, 47), c(91, 47), c(74, 47), c(58, 47), c(47, 47)];
    case "west":
      return [c(-12, 47), c(6, 47), c(22, 47), c(37, 47), c(47, 47)];
  }
}
