import { describe, expect, it } from "vitest";
import { CowHerd, MAX_COWS } from "./cows";

const player = { x: 0, y: 61, z: 0 };
const pasture = () => player.y;

describe("brown cows", () => {
  it("only creates herds on eligible ground by day and keeps them at dusk", () => {
    const terrain = { pasture, stand: pasture };
    const first = new CowHerd(4026, terrain);
    first.update(0.1, player, false);
    expect([...first.values()]).toHaveLength(0);
    first.update(1, player, true);
    const herd = [...first.values()];
    expect(herd.length).toBeGreaterThan(0);
    expect(herd.length).toBeLessThanOrEqual(MAX_COWS);
    const second = new CowHerd(4026, terrain);
    second.update(0.1, player, false);
    second.update(1, player, true);
    expect([...second.values()]).toEqual(herd);
    first.update(1.2, player, false);
    expect([...first.values()].map((cow) => cow.id)).toEqual(herd.map((cow) => cow.id));
    const flooded = new CowHerd(4026, { ...terrain, pasture: () => null });
    flooded.update(1, player, true);
    expect([...flooded.values()]).toHaveLength(0);
  });

  it("blocks building in the cow's space and cycles between walking and grazing", () => {
    const cows = new CowHerd(2026, { pasture, stand: pasture });
    cows.update(0.1, player, true);
    const cow = [...cows.values()][0];
    if (!cow) throw new Error("Pasture did not create a cow");
    const { x, y, z } = cow.position;
    expect(cows.occupies(Math.floor(x), Math.floor(y), Math.floor(z))).toBe(true);
    expect(cows.occupies(Math.floor(x), Math.floor(y) + 4, Math.floor(z))).toBe(false);
    const actions = new Set<string>();
    for (let step = 0; step < 160; step++) {
      cows.update(0.1, player, false);
      actions.add(cow.action);
    }
    expect(actions).toEqual(new Set(["Idle", "Walk", "Graze"]));
    expect(cow.position).not.toEqual({ x, y, z });
  });
});
