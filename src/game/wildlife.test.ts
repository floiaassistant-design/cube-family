import { describe, expect, it } from "vitest";
import { DAY_LENGTH_SECONDS } from "../render/sky";
import type { Vec3 } from "../player/physics";
import {
  type Cat,
  MAX_HEALTH,
  type NightCreature,
  nextMorning,
  timeIsNight,
  Wildlife,
} from "./wildlife";

const home: Vec3 = { x: 0.5, y: 64, z: 0.5 };
const flat = { stand: () => 64, surface: () => 64, clear: () => true };
const findRoamer = (world: Wildlife): NightCreature => {
  const roamer = world.nearby(home).find((creature) => creature.kind === "roamer");
  if (!roamer) throw new Error("Expected a night creature");
  return roamer;
};
const catsNearHome = (world: Wildlife): Cat[] =>
  world.nearby(home).filter((creature) => creature.kind === "cat");

describe("adventure wildlife", () => {
  it("spawns only after sunset and clears at dawn, including while paused", () => {
    const world = new Wildlife(2026, flat, undefined);
    expect(timeIsNight(DAY_LENGTH_SECONDS * 0.59)).toBe(false);
    expect(timeIsNight(DAY_LENGTH_SECONDS * 0.72)).toBe(true);
    expect(timeIsNight(nextMorning(DAY_LENGTH_SECONDS * 0.72))).toBe(false);
    world.update(0.15, home, false, true, false);
    expect(world.nearby(home).every((entity) => entity.kind === "cat")).toBe(true);
    world.update(0.15, home, true, false, false);
    expect(world.nearby(home).every((entity) => entity.kind === "cat")).toBe(true);
    world.update(0.15, home, true, true, false);
    expect(findRoamer(world).health).toBe(6);
    world.update(0.15, home, false, false, false);
    expect(world.nearby(home).every((entity) => entity.kind === "cat")).toBe(true);
  });

  it("has a short attack cooldown and removes a defeated roamer", () => {
    const world = new Wildlife(2026, flat, undefined);
    world.update(0.15, home, true, true, false);
    const enemy = findRoamer(world);
    expect(world.strike(enemy)).toBe("struck");
    expect(world.strike(enemy)).toBe("recovering");
    world.update(0.5, home, true, true, false);
    expect(world.strike(enemy)).toBe("struck");
    world.update(0.5, home, true, true, false);
    expect(world.strike(enemy)).toBe("defeated");
    expect(world.nearby(home)).not.toContain(enemy);
  });

  it("deals reduced damage through copper armor and restores health in bed", () => {
    const world = new Wildlife(2026, flat, undefined);
    world.update(0.15, home, true, true, true);
    const enemy = findRoamer(world);
    expect(world.update(0.15, { ...enemy.position }, true, true, true)).toBe("hurt");
    expect(world.health).toBe(MAX_HEALTH - 1);
    world.rest();
    expect(world.health).toBe(MAX_HEALTH);
    expect(world.nearby(home).every((entity) => entity.kind === "cat")).toBe(true);
  });

  it("only damages a player the roamer can reach in sight", () => {
    const world = new Wildlife(2026, { ...flat, clear: () => false }, undefined);
    world.update(0.15, home, true, true, false);
    const enemy = findRoamer(world);
    expect(world.update(0.15, { ...enemy.position }, true, true, false)).toBeNull();
    expect(world.health).toBe(MAX_HEALTH);
  });

  it("returns a family-friendly retreat when a hit depletes health", () => {
    const world = new Wildlife(2026, flat, { health: 1 });
    world.update(0.15, home, true, true, false);
    const enemy = findRoamer(world);
    expect(world.update(0.15, { ...enemy.position }, true, true, false)).toBe("retreat");
    expect(world.health).toBe(MAX_HEALTH);
  });

  it("populates a chunk with varied cats that adopt, have kittens and survive reload", () => {
    const world = new Wildlife(2026, flat, undefined);
    world.update(0.15, home, false, true, false);
    const cats = catsNearHome(world);
    expect(cats.length).toBeGreaterThan(4);
    expect(new Set(cats.map((cat) => cat.coat)).size).toBeGreaterThan(1);
    const [first, second] = cats;
    if (!first || !second) throw new Error("Expected nearby cats");
    expect(world.useCat(first)).toBe("adopted");
    expect(world.useCat(first)).toBe("purr");
    expect(world.useCat(second)).toBe("adopted");
    second.position = { ...first.position };
    expect(world.useCat(first)).toBe("kitten");
    expect(world.useCat(second)).toBe("resting");
    expect(world.petCount).toBe(3);

    const restored = new Wildlife(2026, flat, JSON.parse(JSON.stringify(world.save())) as unknown);
    expect(restored.petCount).toBe(3);
    expect(catsNearHome(restored).filter((creature) => creature.growsIn > 0)).toHaveLength(1);
    const far = { x: 100, y: 64, z: 100 };
    restored.update(0.15, far, false, true, false);
    expect(
      restored.nearby(far).filter((creature) => creature.kind === "cat" && creature.owned),
    ).toHaveLength(3);
  });

  it("ignores malformed pets in older or damaged saves", () => {
    const world = new Wildlife(2026, flat, {
      health: "broken",
      cats: [null, { id: "bad", position: home }, { id: "k:1", position: { x: "0" } }],
    });
    expect(world.health).toBe(MAX_HEALTH);
    expect(world.petCount).toBe(0);
  });
});
