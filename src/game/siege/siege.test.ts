import { describe, expect, it } from "vitest";
import { BlockId } from "../../world/blocks";
import { createFortressBlueprint, siegePath } from "./fortress";
import { findFortressSite, FortressStore } from "./fortress-store";
import { SiegeController } from "./session";

const site = { x: 128, z: -64, y: 62 } as const;
const at = (x: number, y: number, z: number) =>
  createFortressBlueprint(site).find((b) => b.x === site.x + x && b.y === site.y + y && b.z === site.z + z)?.id;

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

  it("rejects sites outside safe world height", () => {
    expect(() => createFortressBlueprint({ ...site, y: 115 })).toThrow();
  });
});

describe("fortress world metadata and placement", () => {
  it("chooses an untouched, dry site rather than replacing a player's blocks", () => {
    const s = findFortressSite(
      0, 0, () => ({ terrainHeight: 60 }),
      (minX) => minX > 100,
    );
    expect(s).not.toBeNull();
    expect(s?.x).not.toBe(128);
    expect(s?.y).toBe(62);
  });

  it("stores a fortress per seed and clears it without touching player data", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
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

  it("an arrow consumes ammunition, hits visible zombies and cannot be spammed", () => {
    const session = new SiegeController(site, () => 60);
    session.start({ waves: 5, difficulty: "easy" });
    for (let i = 0; i < 210; i++) session.update(0.1);
    const enemy = session.zombies[0];
    expect(enemy).toBeDefined();
    const origin = { x: enemy.position.x, y: enemy.position.y + 0.95, z: enemy.position.z - 5 };
    const direction = { x: 0, y: 0, z: 1 };
    expect(session.shoot(origin, direction, 2, () => true)).toBe(true);
    expect(session.report.arrows).toBe(55);
    expect(session.shoot(origin, direction, 2.1, () => true)).toBe(false);
    expect(session.report.arrows).toBe(55);
    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });
});
