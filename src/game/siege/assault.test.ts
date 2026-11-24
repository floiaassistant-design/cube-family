import { describe, expect, it } from "vitest";
import { BlockId } from "../../world/blocks";
import { Chunk } from "../../world/chunk";
import { World } from "../../world/world";
import {
  assaultFormation,
  INNER_GATE_MAX_HEALTH,
  OUTER_GATE_MAX_HEALTH,
  siegeGateVoxels,
  southAssaultPath,
} from "./assault";
import { SiegeGateOverlay } from "./gate-overlay";
import { SiegeController } from "./session";

const site = { x: 0, z: 0, y: 62 } as const;

describe("concentrated south-front attack", () => {
  it("forms a large crowd in front of the gate and routes through both entrances", () => {
    for (let i = 0; i < 150; i++) {
      const formation = assaultFormation(i);
      expect(formation.lane).toBeGreaterThanOrEqual(-3);
      expect(formation.lane).toBeLessThanOrEqual(3);
      const path = southAssaultPath(site, formation.lane, formation.spread, formation.row);
      expect(path).toHaveLength(7);
      expect(path[0]?.z).toBeLessThan(-10);
      expect(path[1]?.z).toBeLessThan(0);
      expect(path[2]?.z).toBeGreaterThan(2);
      expect(path[3]?.z).toBeLessThan(15);
      expect(path[4]?.z).toBeGreaterThan(15);
      expect(path[6]).toEqual({ x: 47.5, z: 47.5 });
    }
  });

  it("spawns more zombies than the original siege but keeps a strict mobile cap", () => {
    const siege = new SiegeController(site, () => 62, 24);
    siege.start({ waves: 10, difficulty: "normal" });
    for (let i = 0; i < 290; i++) siege.update(0.1);
    expect(siege.report.phase).toBe("wave");
    expect(siege.report.pending).toBeGreaterThan(20);
    expect(siege.zombies.length).toBeLessThanOrEqual(24);
    expect(siege.zombies.length).toBeGreaterThan(18);
    expect(siege.report.maxActiveZombies).toBe(24);
    expect(siege.zombies.every((z) => z.route === "south")).toBe(true);
    expect(siege.zombies.some((z) => z.position.z < 0)).toBe(true);
  });

  it("bashes the two gates in order, then attackers can reach the crystal", () => {
    const siege = new SiegeController(site, () => 62, 36);
    siege.start({ waves: 5, difficulty: "normal" });
    expect(siege.report.outerGate.health).toBe(OUTER_GATE_MAX_HEALTH);
    expect(siege.report.innerGate.health).toBe(INNER_GATE_MAX_HEALTH);
    let firstBreach: number | null = null;
    let secondBreach: number | null = null;
    let damageAfterBreaches = false;
    for (let i = 0; i < 4000 && !damageAfterBreaches; i++) {
      siege.update(0.1);
      const report = siege.report;
      if (firstBreach === null && report.outerGate.health === 0) firstBreach = i;
      if (secondBreach === null && report.innerGate.health === 0) secondBreach = i;
      if (report.crystal < report.maxCrystal) damageAfterBreaches = true;
    }
    expect(firstBreach).not.toBeNull();
    expect(secondBreach).not.toBeNull();
    expect(firstBreach).toBeLessThan(secondBreach ?? 0);
    expect(damageAfterBreaches).toBe(true);
    siege.stop();
    siege.start();
    expect(siege.report.outerGate.health).toBe(OUTER_GATE_MAX_HEALTH);
    expect(siege.report.innerGate.health).toBe(INNER_GATE_MAX_HEALTH);
  });
});

describe("temporary physical wooden gates", () => {
  const load = (world: World, cx: number, cz: number): void => {
    world.setChunk(new Chunk(cx, cz));
  };

  it("creates visible solid doors and restores the original empty openings without saving", () => {
    const world = new World(42);
    load(world, 2, 0);
    load(world, 3, 0);
    const overlay = new SiegeGateOverlay(site);
    expect(world.getBlock(47, 63, 2)).toBe(BlockId.AIR);
    const modified = overlay.sync(world, true, true);
    expect(modified).toHaveLength(2);
    for (const gate of ["outer", "inner"] as const) {
      expect(siegeGateVoxels(site, gate)).toHaveLength(40);
    }
    expect(world.getBlock(47, 63, 2)).toBe(BlockId.PLANKS);
    expect(world.getBlock(47, 67, 15)).toBe(BlockId.PLANKS);
    overlay.sync(world, false, true);
    expect(world.getBlock(47, 63, 2)).toBe(BlockId.AIR);
    expect(world.getBlock(47, 67, 15)).toBe(BlockId.PLANKS);
    overlay.sync(world, false, false);
    expect(world.getBlock(47, 67, 15)).toBe(BlockId.AIR);
  });

  it("recreates a closed gate on streamed chunks and never erases user blocks", () => {
    const world = new World(42);
    load(world, 2, 0);
    const overlay = new SiegeGateOverlay(site);
    world.setBlock(45, 63, 2, BlockId.COPPER_BLOCK);
    overlay.sync(world, true, true);
    expect(world.getBlock(45, 63, 2)).toBe(BlockId.COPPER_BLOCK);
    expect(world.getBlock(46, 63, 2)).toBe(BlockId.PLANKS);
    overlay.forgetChunk(2, 0);
    world.removeChunk(2, 0);
    load(world, 2, 0);
    overlay.applyToLoadedChunk(world, 2, 0);
    expect(world.getBlock(46, 63, 2)).toBe(BlockId.PLANKS);
    overlay.sync(world, false, false);
    expect(world.getBlock(46, 63, 2)).toBe(BlockId.AIR);
  });
});
