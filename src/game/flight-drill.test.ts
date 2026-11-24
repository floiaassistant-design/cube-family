import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { Chunk } from "../world/chunk";
import { World } from "../world/world";
import { drillTargets, FlyingDrill, planDrilling } from "./flight-drill";

function testWorld() {
  const world = new World(3);
  const chunk = new Chunk(0, 0);
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) chunk.setBlock(x, 20, z, BlockId.STONE);
  }
  world.setChunk(chunk);
  return world;
}

describe("creative flying drill", () => {
  it("has unique, controllable 1/3/5 cross-sections", () => {
    const position = { x: 8.5, y: 21, z: 8.5 };
    expect(drillTargets(position, 0, 0, 1)).toHaveLength(1);
    expect(drillTargets(position, 0, 0, 3)).toHaveLength(9);
    expect(drillTargets(position, 0, 0, 5)).toHaveLength(25);
    expect(drillTargets(position, 0, 0.7, 5).length).toBeGreaterThan(15);
  });

  it("never generates unloaded chunks, overwrites water, or digs outside height", () => {
    const world = testWorld();
    world.setBlock(8, 22, 6, BlockId.DIAMOND_ORE);
    world.setBlock(9, 22, 6, BlockId.WATER);
    const edits = planDrilling(world, { x: 8.5, y: 21, z: 8.5 }, 0, 0, 3);
    expect(
      edits.some((cell) => world.getBlock(cell.x, cell.y, cell.z) === BlockId.DIAMOND_ORE),
    ).toBe(true);
    expect(edits.some((cell) => world.getBlock(cell.x, cell.y, cell.z) === BlockId.WATER)).toBe(
      false,
    );
    expect(planDrilling(world, { x: 8.5, y: -5, z: 8.5 }, 0, 0, 5)).toEqual([]);
    expect(planDrilling(world, { x: 160, y: 21, z: 160 }, 0, 0, 5)).toEqual([]);
  });

  it("changes the size and only emits bounded batches while drilling", () => {
    const world = testWorld();
    const drill = new FlyingDrill(world);
    const location = { x: 8.5, y: 21, z: 8.5, yaw: 0 };
    expect(drill.spawn(location, () => 21, location)).toBe(true);
    expect(drill.cycleSize()).toBe(5);
    expect(drill.cycleSize()).toBe(1);
    expect(drill.cycleSize()).toBe(3);
    // A loaded wall is actually cleared; no blind edits outside loaded chunks.
    for (let x = 6; x <= 10; x++) {
      for (let y = 21; y <= 23; y++) world.setBlock(x, y, 6, BlockId.STONE);
    }
    const batches: number[] = [];
    drill.onExcavate = (edits) => {
      batches.push(edits.length);
      for (const edit of edits) world.setBlock(edit.x, edit.y, edit.z, edit.id);
    };
    drill.drilling = true;
    const input = {
      forward: 0,
      right: 0,
      yaw: 0,
      pitch: 0,
      jump: false,
      descend: false,
      sprint: false,
    };
    for (let i = 0; i < 30; i++) drill.step(1 / 120, input);
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.every((count) => count <= 8)).toBe(true);
    expect(world.getBlock(8, 22, 6)).toBe(BlockId.AIR);
  });
});
