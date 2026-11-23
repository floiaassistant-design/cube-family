import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import {
  Bag,
  COPPER_AXE,
  COPPER_SWORD,
  craft,
  digSeconds,
  isHandEquipment,
  MINING_PICK,
  RECIPES,
  WOOD_SHIELD,
} from "./items";
import { attackDamage, incomingDamage } from "./equipment";

describe("new adventure equipment", () => {
  it("recognizes holdable tools and preserves old pick ids", () => {
    for (const id of [MINING_PICK, COPPER_SWORD, COPPER_AXE, WOOD_SHIELD]) {
      expect(isHandEquipment(id)).toBe(true);
    }
    expect(isHandEquipment("unknown-tool")).toBe(false);
    expect(isHandEquipment(BlockId.STONE)).toBe(false);
  });

  it("crafts each new tool once and keeps it through a save", () => {
    const bag = new Bag({ [BlockId.COPPER_ORE]: 9, [BlockId.PLANKS]: 7 });
    for (const id of [COPPER_SWORD, COPPER_AXE, WOOD_SHIELD] as const) {
      const recipe = RECIPES.find((item) => item.id === id);
      if (!recipe) throw new Error(`Recipe missing: ${id}`);
      expect(craft(bag, recipe)).toBe(true);
      expect(craft(bag, recipe)).toBe(false);
      expect(bag.count(id)).toBe(1);
    }
    expect(bag.count(BlockId.COPPER_ORE)).toBe(3);
    expect(bag.count(BlockId.PLANKS)).toBe(0);
    const restored = new Bag(bag.toJSON());
    expect(restored.equipment()).toEqual([COPPER_SWORD, COPPER_AXE, WOOD_SHIELD]);
    expect(restored.toJSON()).toEqual(bag.toJSON());
  });

  it("weapons strengthen combat and an equipped axe speeds wood cutting", () => {
    expect(attackDamage(null)).toBe(2);
    expect(attackDamage(COPPER_SWORD)).toBe(4);
    expect(attackDamage(COPPER_AXE)).toBe(3);
    expect(attackDamage(WOOD_SHIELD)).toBe(2);
    expect(digSeconds(BlockId.WOOD, false, false, true)).toBeLessThan(
      digSeconds(BlockId.WOOD),
    );
    expect(digSeconds(BlockId.STONE, false, false, true)).toBe(digSeconds(BlockId.STONE));
  });

  it("combines held shield and passive armor, without negative damage", () => {
    expect(incomingDamage(false, false)).toBe(2);
    expect(incomingDamage(true, false)).toBe(1);
    expect(incomingDamage(false, true)).toBe(1);
    expect(incomingDamage(true, true)).toBe(0);
  });

  it("rejects arbitrary and oversized items in saves", () => {
    const bag = new Bag({
      "evil-weapon": 100,
      [COPPER_SWORD]: 900,
      [WOOD_SHIELD]: -3,
    });
    expect(bag.count(COPPER_SWORD)).toBe(1);
    expect(bag.count(WOOD_SHIELD)).toBe(0);
    expect(Object.keys(bag.toJSON())).toEqual([COPPER_SWORD]);
  });
});
