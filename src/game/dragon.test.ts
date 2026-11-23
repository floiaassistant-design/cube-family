import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { Chunk } from "../world/chunk";
import { World } from "../world/world";
import { type DragonInput, DragonMount } from "./dragon";

const GROUND = 20;
const PARKING = { x: 8.5, y: GROUND + 1, z: 22.5, yaw: 0 };
const IDLE = { forward: 0, right: 0, yaw: 0, jump: false, descend: false, sprint: false };

function plateau() {
  const world = new World(1);
  for (let cz = 0; cz < 3; cz++) {
    const chunk = new Chunk(0, cz);
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) chunk.setBlock(x, GROUND, z, BlockId.STONE);
    }
    world.setChunk(chunk);
  }
  const dragon = new DragonMount(world);
  expect(dragon.spawn(PARKING, () => GROUND + 1, PARKING)).toBe(true);
  return { world, dragon };
}

function steer(dragon: DragonMount, seconds: number, input: Partial<DragonInput>): void {
  for (let tick = 0; tick < Math.round(seconds * 120); tick++) {
    dragon.step(1 / 120, { ...IDLE, ...input });
  }
}

describe("dragon mount", () => {
  it("walks, climbs, glides and only allows a rider to dismount on dry land", () => {
    const { dragon } = plateau();
    expect(dragon.canMount({ ...PARKING, x: PARKING.x - 3 })).toBe(true);
    steer(dragon, 0.7, { forward: 1 });
    expect(dragon.position?.z).toBeLessThan(PARKING.z - 2);
    expect(dragon.grounded).toBe(true);

    steer(dragon, 1, { jump: true });
    expect(dragon.flying).toBe(true);
    expect(dragon.position?.y).toBeGreaterThan(PARKING.y + 4);
    expect(dragon.safeExit()).toBeNull();
    expect(dragon.savedRiderPosition?.y).toBe(PARKING.y);
    const apex = dragon.position?.y ?? 0;
    steer(dragon, 1, { forward: 1 });
    expect(dragon.position?.y).toBeLessThan(apex + 0.5);

    steer(dragon, 2, { descend: true });
    expect(dragon.flying).toBe(false);
    expect(dragon.grounded).toBe(true);
    expect(dragon.safeExit()?.y).toBe(PARKING.y);
  });

  it("steps up a single block and stops at taller walls or missing chunks", () => {
    const { world, dragon } = plateau();
    for (let x = 5; x < 12; x++) {
      for (let z = 12; z < 19; z++) world.setBlock(x, GROUND + 1, z, BlockId.STONE);
    }
    steer(dragon, 1.2, { forward: 1 });
    expect(dragon.position?.y).toBeCloseTo(PARKING.y + 1);
    for (let x = 5; x < 12; x++) {
      for (let y = GROUND + 2; y < GROUND + 8; y++) {
        world.setBlock(x, y, 12, BlockId.STONE);
      }
    }
    steer(dragon, 1, { forward: 1 });
    expect(dragon.position?.z).toBeGreaterThan(14.2);
    steer(dragon, 4, { right: 1, sprint: true });
    expect(dragon.position?.x).toBeLessThanOrEqual(14.76);
  });

  it("keeps its dry parking spot when a water surface blocks a landing", () => {
    const { world, dragon } = plateau();
    steer(dragon, 1, { jump: true });
    for (let x = 5; x <= 11; x++) {
      for (let z = 20; z <= 25; z++) world.setBlock(x, GROUND + 1, z, BlockId.WATER);
    }
    steer(dragon, 2, { descend: true });
    expect(dragon.position?.y).toBeCloseTo(GROUND + 2);
    expect(dragon.flying).toBe(true);
    expect(dragon.safeExit()).toBeNull();
    expect(dragon.parking).toEqual(PARKING);
  });
});
