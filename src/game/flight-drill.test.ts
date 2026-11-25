import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { Chunk } from "../world/chunk";
import { World } from "../world/world";
import { FlyingDrill, planDrilling } from "./flight-drill";
import { forwardVector } from "../player/physics";
import { raycastVoxels } from "../player/raycast";

const parking = { x: 8.5, y: 21, z: 11.5, yaw: 0 };
const idle = { forward: 0, right: 0, yaw: 0, pitch: 0, jump: false, descend: false, sprint: false };

function setup() {
  const world = new World(3);
  const chunk = new Chunk(0, 0);
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) chunk.setBlock(x, 20, z, BlockId.STONE);
  }
  world.setChunk(chunk);
  const drill = new FlyingDrill(world);
  expect(drill.spawn(parking, () => 21, parking)).toBe(true);
  return { world, drill };
}

describe("creative flying drill", () => {
  it("centres the camera on the voxel cut by the drill in both orientations", () => {
    const { world, drill } = setup();
    for (const [yaw, pitch, block] of [
      [0, 0, { x: 8, y: 22, z: 9 }],
      [-Math.PI / 2, 0.35, { x: 11, y: 23, z: 11 }],
    ] as const) {
      world.setBlock(block.x, block.y, block.z, BlockId.STONE);
      const view = drill.mountedCamera(parking, yaw, pitch, 16 / 9);
      const heading = forwardVector(view.yaw);
      const ray = {
        x: heading.x * Math.cos(view.pitch),
        y: Math.sin(view.pitch),
        z: heading.z * Math.cos(view.pitch),
      };
      const hit = raycastVoxels(
        view.position,
        ray,
        15,
        (x, y, z) => world.getBlock(x, y, z) === BlockId.STONE,
      );
      expect(hit && { x: hit.blockX, y: hit.blockY, z: hit.blockZ }).toEqual(block);
      expect(planDrilling(world, parking, yaw, pitch, 1)).toEqual([{ ...block, id: BlockId.AIR }]);
    }
  });

  it("starts with the first wall, respects the bore diameter and caps edits", () => {
    const { world, drill } = setup();
    for (let x = 6; x <= 10; x++) {
      for (let y = 21; y <= 24; y++) {
        world.setBlock(x, y, 10, BlockId.STONE);
        world.setBlock(x, y, 8, BlockId.STONE);
      }
    }
    const single = planDrilling(world, parking, 0, 0, 1);
    expect(single).toEqual([{ x: 8, y: 22, z: 10, id: BlockId.AIR }]);
    expect(planDrilling(world, parking, 0, 0, 3, 25)).toHaveLength(9);
    expect(planDrilling(world, parking, 0, 0, 5)).toHaveLength(8);
    expect(planDrilling(world, parking, 0, 0, 5, 25).length).toBeGreaterThan(9);
    expect(drill.cycleSize()).toBe(5);
    expect(drill.cycleSize()).toBe(1);
    expect(drill.cycleSize()).toBe(3);
  });

  it("does not skip water, bedrock or unloaded chunks", () => {
    const { world } = setup();
    world.setBlock(8, 22, 10, BlockId.WATER);
    world.setBlock(8, 22, 9, BlockId.DIAMOND_ORE);
    expect(planDrilling(world, parking, 0, 0, 1)).toEqual([]);
    world.setBlock(8, 22, 10, BlockId.BEDROCK);
    expect(planDrilling(world, parking, 0, 0, 1)).toEqual([]);
    expect(planDrilling(world, { ...parking, z: 0.4 }, 0, 0, 5)).toEqual([]);
    expect(planDrilling(world, { ...parking, y: -5 }, 0, 0, 5)).toEqual([]);
    expect(world.loadedChunkCount).toBe(1);
  });

  it("bores through a wall and flies through instead of stopping in front of it", () => {
    const { world, drill } = setup();
    for (let z = 6; z <= 9; z++) {
      for (let x = 4; x <= 12; x++) {
        for (let y = 21; y < 26; y++) world.setBlock(x, y, z, BlockId.STONE);
      }
    }
    const batches: number[] = [];
    drill.onExcavate = (edits) => {
      batches.push(edits.length);
      for (const edit of edits) world.setBlock(edit.x, edit.y, edit.z, edit.id);
    };
    drill.step(1 / 60, { ...idle, jump: true });
    expect(drill.flying).toBe(true);
    drill.toggleDrilling();
    for (let i = 0; i < 52; i++) drill.step(1 / 60, { ...idle, forward: 1 });
    expect(drill.position?.z).toBeLessThan(6);
    expect(drill.position?.y).toBeGreaterThanOrEqual(21);
    expect(batches.length).toBeGreaterThan(2);
    expect(Math.max(...batches)).toBeLessThanOrEqual(8);
    expect(world.getBlock(8, 22, 8)).toBe(BlockId.AIR);
    expect(world.getBlock(4, 22, 8)).toBe(BlockId.STONE);
  });

  it("turns the drill in place, aims upward and keeps continuous boring after mouse release", () => {
    const { world, drill } = setup();
    world.setBlock(10, 23, 11, BlockId.DIAMOND_ORE);
    drill.onExcavate = (edits) => {
      for (const edit of edits) world.setBlock(edit.x, edit.y, edit.z, edit.id);
    };
    drill.size = 1;
    drill.toggleDrilling();
    drill.triggerHeld = true;
    drill.triggerHeld = false;
    drill.step(1 / 60, { ...idle, yaw: -Math.PI / 2, pitch: 0.6 });
    expect(drill.yaw).toBe(-Math.PI / 2);
    expect(drill.drilling).toBe(true);
    expect(world.getBlock(10, 23, 11)).toBe(BlockId.AIR);
    drill.stopDrilling();
    expect(drill.drilling).toBe(false);
  });

  it("moves sideways and backwards without turning, then hovers at the same height", () => {
    const { drill } = setup();
    for (let i = 0; i < 20; i++) drill.step(1 / 60, { ...idle, jump: true });
    const lifted = drill.position;
    expect(lifted?.y).toBeGreaterThan(22);
    for (let i = 0; i < 36; i++) drill.step(1 / 60, { ...idle, right: 0.4, forward: -0.25 });
    expect(drill.position?.x).toBeGreaterThan(parking.x);
    expect(drill.position?.z).toBeGreaterThan(parking.z);
    expect(drill.yaw).toBe(0);
    for (let i = 0; i < 80; i++) drill.step(1 / 60, idle);
    const settledY = drill.position?.y;
    for (let i = 0; i < 30; i++) drill.step(1 / 60, idle);
    expect(drill.position?.y).toBeCloseTo(settledY ?? 0, 3);
  });
});
