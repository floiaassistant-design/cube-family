import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { FirstNight, isFirstNightShelter } from "./first-night";
import { Bag, craft, MINING_PICK, RECIPES } from "./items";

const camp = { x: 0.5, y: 65.01, z: 0.5 };
const ruin = { x: 28, y: 61, z: 0 };
const firstRuin = () => ruin;

describe("The First Night", () => {
  it("guides a new player through the actual plank and pick recipes", () => {
    const bag = new Bag();
    const mission = new FirstNight(undefined);
    expect(mission.objective(bag, false)).toBe("wood");
    bag.add(BlockId.PINE_WOOD);
    expect(mission.objective(bag, false)).toBe("planks");
    for (const recipe of RECIPES.filter(({ id }) => id === "planks-pine")) {
      expect(craft(bag, recipe)).toBe(true);
    }
    expect(bag.count(BlockId.PLANKS)).toBe(4);
    expect(mission.objective(bag, false)).toBe("stone");
    bag.add(BlockId.COBBLE, 2);
    expect(mission.objective(bag, false)).toBe("pick");
    for (const recipe of RECIPES.filter(({ id }) => id === MINING_PICK)) {
      expect(craft(bag, recipe)).toBe(true);
    }
    expect(mission.advance(bag, false, false, camp, firstRuin)).toBe(true);
    expect(mission.objective(bag, false)).toBe("shelter");
  });

  it("requires a roof and three two-block walls, with at least one player-built voxel", () => {
    const occupied = new Set(["0,64,0", "0,67,0", "-1,65,0", "-1,66,0", "1,65,0", "1,66,0"]);
    const solid = (x: number, y: number, z: number) => occupied.has([x, y, z].join(","));
    const built = (x: number, y: number, z: number) => x === 0 && y === 67 && z === 0;
    expect(isFirstNightShelter(camp, solid, built)).toBe(false);
    occupied.add("0,65,-1");
    occupied.add("0,66,-1");
    expect(isFirstNightShelter(camp, solid, built)).toBe(true);
    expect(isFirstNightShelter(camp, solid, () => false)).toBe(false);
    occupied.delete("0,67,0");
    expect(isFirstNightShelter(camp, solid, built)).toBe(false);
  });

  it("resumes a sheltered night, cancels progress outside and awards one persistent map", () => {
    const bag = new Bag({ [MINING_PICK]: 1 });
    const mission = new FirstNight({ step: "shelter" });
    expect(mission.objective(bag, true)).toBe("dusk");
    expect(mission.advance(bag, false, true, camp, firstRuin)).toBe(false);
    expect(mission.advance(bag, true, true, camp, firstRuin)).toBe(true);
    expect(mission.objective(bag, true)).toBe("night");
    const resumed = new FirstNight(mission.toJSON());
    expect(resumed.advance(bag, false, true, camp, firstRuin)).toBe(true);
    expect(resumed.advance(bag, true, false, camp, firstRuin)).toBe(false);
    resumed.advance(bag, true, true, camp, firstRuin);
    expect(resumed.advance(bag, true, false, camp, firstRuin)).toBe(true);
    expect(resumed.toJSON()).toEqual({ step: "map", ruin });
    expect(resumed.advance(bag, false, false, { ...ruin, y: ruin.y + 12 }, firstRuin)).toBe(false);
    expect(resumed.advance(bag, false, false, { ...ruin, y: ruin.y + 1 }, firstRuin)).toBe(true);
    expect(new FirstNight(resumed.toJSON()).objective(bag, true)).toBe(null);
  });

  it("rejects missing or invalid saved ruin coordinates", () => {
    for (const site of [undefined, { ...ruin, y: -1 }, { ...ruin, x: 2 ** 31 }]) {
      expect(new FirstNight({ step: "map", ruin: site }).step).toBe("gather");
    }
  });
});
