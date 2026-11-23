import { describe, expect, it } from "vitest";
import { BlockId } from "../../world/blocks";
import { findPleasantSpawn } from "../../world/spawn";
import { createColumnSampler, SEA_LEVEL } from "../../world/terrain";
import { CHUNK_HEIGHT } from "../../world/coords";
import { createFortressBlueprint, siegePath } from "./fortress";
import { findFortressSite, FortressStore } from "./fortress-store";
import { SiegeController } from "./session";

const site = { x: 128, z: -64, y: 62 } as const;
const at = (x: number, y: number, z: number) =>
  createFortressBlueprint(site).find(
    (b) => b.x === site.x + x && b.y === site.y + y && b.z === site.z + z,
  )?.id;

describe("five-bastion fortress", () => {
  it("builds distinct stone corner bastions and a fifth gatehouse", () => {
    const blueprint = createFortressBlueprint(site);
    expect(blueprint.length).toBeGreaterThan(10000);
    expect(new Set(blueprint.map((b) => `${b.x},${b.y},${b.z}`)).size).toBe(blueprint.length);
    expect(at(0, 12, 0)).toBe(BlockId.STONE_BRICK);
    expect(at(95, 12, 95)).toBe(BlockId.STONE_BRICK);
    expect(at(47, 13, 5)).toBe(BlockId.STONE_BRICK);
    expect(at(47, 3, 47)).toBe(BlockId.CRYSTAL);
  });

  it("has four open outer and inner gates for enemy routes", () => {
    for (const p of [0, 15, 80, 95]) {
      expect(at(47, 2, p)).toBe(BlockId.AIR);
      expect(at(p, 2, 47)).toBe(BlockId.AIR);
    }
    for (const route of ["north", "south", "east", "west"] as const) {
      const points = siegePath(site, route);
      expect(points[points.length - 1]).toEqual({ x: site.x + 47.5, z: site.z + 47.5 });
    }
  });

  it("provides usable ascent steps to every tower and the outer rampart", () => {
    for (const tx of [0, 83]) {
      for (const tz of [0, 83]) {
        expect(at(tx + 6, 2, tz + (tz === 0 ? 10 : 2))).toBe(BlockId.COBBLE);
        expect(at(tx + 3, 16, tz + (tz === 0 ? 5 : 7))).toBe(BlockId.COBBLE);
      }
    }
    for (const tx of [5, 90]) {
      expect(at(tx, 10, 4)).toBe(BlockId.COBBLE);
      expect(at(tx, 1, 13)).toBe(BlockId.COBBLE);
      expect(at(tx, 10, 91)).toBe(BlockId.COBBLE);
      expect(at(tx, 1, 82)).toBe(BlockId.COBBLE);
    }
  });

  it("rejects sites outside safe world height", () => {
    expect(() => createFortressBlueprint({ ...site, y: 115 })).toThrow();
  });
});

describe("fortress world metadata and placement", () => {
  it("chooses an untouched, dry site rather than replacing a player's blocks", () => {
    const s = findFortressSite(
      0,
      0,
      () => ({ terrainHeight: 60 }),
      (minX) => minX > 100,
    );
    expect(s).not.toBeNull();
    expect(s?.x).not.toBe(128);
    expect(s?.y).toBe(62);
  });

  it("finds a safe construction site in the reference seeded world", () => {
    const sampler = createColumnSampler(2026);
    const spawn = findPleasantSpawn(2026);
    const site = findFortressSite(spawn.x, spawn.z, sampler, () => false);
    if (!site) {
      const examples = [
        [0, 0],
        [128, -48],
        [512, 0],
        [-608, 0],
        [1024, 1024],
        [-1536, -1536],
        [2048, 0],
      ].map(([dx, dz]) => {
        const x = spawn.x + (dx ?? 0);
        const z = spawn.z + (dz ?? 0);
        const heights = [];
        for (let sx = 0; sx <= 96; sx += 8)
          for (let sz = 0; sz <= 96; sz += 8)
            heights.push(sampler(x + sx, z + sz).terrainHeight);
        return { dx, dz, low: Math.min(...heights), high: Math.max(...heights) };
      });
      console.warn("FORTRESS_SITE_DIAGNOSTIC", JSON.stringify({ spawn, examples }));
    }
    expect(site).not.toBeNull();
    if (!site) return;
    expect(site.y).toBeGreaterThan(SEA_LEVEL + 2);
    expect(site.y + 20).toBeLessThan(CHUNK_HEIGHT);
    expect(findFortressSite(spawn.x, spawn.z, sampler, () => true)).toBeNull();
  });

  it("stores a fortress per seed and clears it without touching player data", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    const saved = new FortressStore(storage, 42);
    saved.write(site);
    expect(new FortressStore(storage, 42).read()).toEqual(site);
    expect(new FortressStore(storage, 43).read()).toBeNull();
    saved.clear();
    expect(saved.read()).toBeNull();
  });
});

describe("solo zombie defense", () => {
  it("starts with preparation and spawns a capped first wave", () => {
    const session = new SiegeController(site, () => 60);
    session.start({ waves: 10, difficulty: "normal" });
    expect(session.report.phase).toBe("preparation");
    for (let i = 0; i < 201; i++) session.update(0.1);
    expect(session.report.phase).toBe("wave");
    for (let i = 0; i < 80; i++) session.update(0.1);
    expect(session.zombies.length).toBeGreaterThan(0);
    expect(session.zombies.length).toBeLessThanOrEqual(18);
    session.stop();
    expect(session.report.phase).toBe("idle");
    expect(session.zombies.length).toBe(0);
  });

  it("can finish all five waves with a victory and restart cleanly", () => {
    const session = new SiegeController(site, () => 60);
    session.start({ waves: 5, difficulty: "easy" });
    let attackTime = 1;
    for (let frame = 0; frame < 5000 && session.report.phase !== "victory"; frame++) {
      session.update(0.1);
      for (const zombie of session.zombies) {
        while (zombie.health > 0) {
          attackTime += 1;
          expect(session.melee(zombie, 6, attackTime)).toBe(true);
        }
      }
    }
    expect(session.report.phase).toBe("victory");
    expect(session.report.wave).toBe(5);
    expect(session.report.kills).toBeGreaterThan(25);
    expect(session.zombies).toHaveLength(0);

    session.start({ waves: 10, difficulty: "normal" });
    expect(session.report.phase).toBe("preparation");
    expect(session.report.wave).toBe(0);
    expect(session.report.crystal).toBe(600);
    expect(session.report.kills).toBe(0);
  });

  it("ends in defeat when attackers reach the unprotected crystal", () => {
    const session = new SiegeController(site, () => 60);
    session.start({ waves: 10, difficulty: "normal" });
    for (let frame = 0; frame < 6000 && session.report.phase !== "defeat"; frame++) {
      session.update(0.1);
    }
    expect(session.report.phase).toBe("defeat");
    expect(session.report.crystal).toBe(0);
    expect(session.zombies).toHaveLength(0);
    expect(session.repair()).toBe(false);
  });

  it("an arrow consumes ammunition, hits visible zombies and cannot be spammed", () => {
    const session = new SiegeController(site, () => 60);
    session.start({ waves: 5, difficulty: "easy" });
    for (let i = 0; i < 210; i++) session.update(0.1);
    const enemy = session.zombies[0];
    if (!enemy) throw new Error("Expected a spawned zombie");
    const origin = { x: enemy.position.x, y: enemy.position.y + 0.95, z: enemy.position.z - 5 };
    const direction = { x: 0, y: 0, z: 1 };
    expect(session.shoot(origin, direction, 2, () => true)).toBe(true);
    expect(session.report.arrows).toBe(55);
    expect(session.shoot(origin, direction, 2.1, () => true)).toBe(false);
    expect(session.report.arrows).toBe(55);
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });
});
