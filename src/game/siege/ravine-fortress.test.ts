import { describe, expect, it } from "vitest";
import { BlockId } from "../../world/blocks";
import { Chunk } from "../../world/chunk";
import { CHUNK_HEIGHT, worldToChunk } from "../../world/coords";
import { World } from "../../world/world";
import { SIEGE_GATES, siegeGateCenter, siegeGateVoxels, southAssaultPath } from "./assault";
import { createFortressBlueprint } from "./fortress";
import { FortressStore } from "./fortress-store";
import { SiegeGateOverlay } from "./gate-overlay";
import {
  RAVINE_APPROACH_Z,
  RAVINE_CRYSTAL_Z,
  RAVINE_GATES,
  fortressVisit,
  ravineGroundOffset,
} from "./ravine-layout";
import { SiegeController, TITAN_HEIGHT, TITAN_TARGET_RADIUS } from "./session";

const site = { x: -105, z: 111, y: 67, layout: "ravine" } as const;

describe("High Gorge Fortress", () => {
  it("builds a continuous rising lane and matching doors with room for the Titan", () => {
    const blocks = createFortressBlueprint(site);
    expect(blocks.length).toBeLessThan(150_000); // Leave room for player edits in world exports.
    const geometry = new Map(blocks.map(({ x, y, z, id }) => [`${x},${y},${z}`, id]));
    const at = (x: number, y: number, z: number) => geometry.get(`${x},${y},${z}`);
    const path = southAssaultPath(site, 3, 2, 0);
    expect(path.flatMap(({ gate }) => gate ?? [])).toEqual(SIEGE_GATES);
    for (let z = RAVINE_APPROACH_Z; z <= RAVINE_CRYSTAL_Z - 2; z++) {
      const floor = site.y + ravineGroundOffset(z);
      const radius = 3 + Math.ceil(TITAN_TARGET_RADIUS);
      if (z > RAVINE_APPROACH_Z)
        expect(floor - site.y - ravineGroundOffset(z - 1)).toBeLessThanOrEqual(1);
      for (let x = 47 - radius; x <= 47 + radius; x++) {
        expect(at(site.x + x, floor, site.z + z)).not.toBe(BlockId.AIR);
        expect(at(site.x + x, floor, site.z + z)).toBeDefined();
        for (let h = 1; h <= Math.ceil(TITAN_HEIGHT); h++)
          expect(at(site.x + x, floor + h, site.z + z)).toBe(BlockId.AIR);
      }
    }
    for (const gate of SIEGE_GATES) {
      expect(siegeGateVoxels(site, gate)).toHaveLength(72);
      for (const { x, y, z } of siegeGateVoxels(site, gate)) expect(at(x, y, z)).toBe(BlockId.AIR);
    }
    const { x, y, z } = fortressVisit(site);
    expect(at(Math.floor(x), Math.floor(y) - 1, Math.floor(z))).toBe(BlockId.STONE_BRICK);
    expect(at(Math.floor(x), Math.floor(y), Math.floor(z))).toBe(BlockId.AIR);
    expect(at(site.x + 47, site.y + 10, site.z + RAVINE_CRYSTAL_Z)).toBe(BlockId.CRYSTAL);
    expect(blocks.every(({ y }) => y >= 1 && y < CHUNK_HEIGHT)).toBe(true);
  });

  it("holds each defense line until its gate falls and resets all three gates per run", () => {
    const siege = new SiegeController(site, () => site.y - 3, 24);
    siege.start();
    const events: string[] = [];
    for (let i = 0; i < 3500 && events.length < 4; i++) {
      siege.update(0.1);
      const report = siege.report;
      const { outerGate, innerGate, keepGate } = report;
      if (outerGate.health > 0) expect(innerGate.health).toBe(innerGate.maxHealth);
      if (innerGate.health > 0) expect(keepGate?.health).toBe(keepGate?.maxHealth);
      if (keepGate && keepGate.health > 0) expect(report.crystal).toBe(report.maxCrystal);
      if (outerGate.health === 0 && !events.includes("outer")) events.push("outer");
      if (innerGate.health === 0 && !events.includes("inner")) events.push("inner");
      if (keepGate?.health === 0 && !events.includes("keep")) events.push("keep");
      if (report.crystal < report.maxCrystal) events.push("crystal");
      for (const zombie of siege.zombies) {
        const z = Math.floor(zombie.position.z) - site.z;
        if (z >= RAVINE_APPROACH_Z)
          expect(zombie.position.y).toBe(site.y + ravineGroundOffset(z) + 1);
      }
    }
    expect(events).toEqual(["outer", "inner", "keep", "crystal"]);
    siege.stop();
    siege.start();
    expect(siege.report.keepGate?.health).toBe(RAVINE_GATES.keep.maxHealth);
  });

  it("restores the ravine metadata and streams temporary gates independently", () => {
    const records = new Map<string, string>();
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
    };
    new FortressStore(storage, 19).write(site);
    expect(new FortressStore(storage, 19).read()).toEqual(site);

    const world = new World(19);
    const gates = new SiegeGateOverlay(site);
    gates.sync(world, true, true, true);
    const keep = siegeGateCenter(site, "keep");
    const cx = worldToChunk(keep.x);
    const cz = worldToChunk(keep.z);
    world.setChunk(new Chunk(cx, cz));
    gates.applyToLoadedChunk(world, cx, cz);
    expect(world.getBlock(keep.x, keep.y, keep.z)).toBe(BlockId.PLANKS);
    expect(gates.sync(world, false, false, true)).toEqual([]);
    expect(gates.sync(world, false, false, false)).toEqual([{ cx, cz }]);
    expect(world.getBlock(keep.x, keep.y, keep.z)).toBe(BlockId.AIR);
  });
});
