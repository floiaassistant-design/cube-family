import {
  COPPER_AXE,
  COPPER_SWORD,
  isNewEquipment,
  type NewEquipment,
  WOOD_SHIELD,
} from "./equipment";
import { BLOCKS, BlockId, INVENTORY_BLOCKS } from "../world/blocks";

export { COPPER_AXE, COPPER_SWORD, WOOD_SHIELD } from "./equipment";

/** What the player carries in Adventure mode. Validate items and counts
 * when loading a saved bag. */

export const STACK_LIMIT = 999;
export const MINING_PICK = "mining-pick";
export const COPPER_PICK = "copper-pick";
export const COPPER_ARMOR = "copper-armor";
export type MiningPick = typeof MINING_PICK | typeof COPPER_PICK;
export type HandEquipment = MiningPick | NewEquipment;
export type ItemId = BlockId | HandEquipment | typeof COPPER_ARMOR;
export type HeldItem = BlockId | HandEquipment;

export function isHandEquipment(item: unknown): item is HandEquipment {
  return item === MINING_PICK || item === COPPER_PICK || isNewEquipment(item);
}

export function isMiningPick(item: ItemId): item is MiningPick {
  return item === MINING_PICK || item === COPPER_PICK;
}

const HOLDABLE = new Set<number>(INVENTORY_BLOCKS);
const EQUIPMENT = [
  MINING_PICK,
  COPPER_PICK,
  COPPER_ARMOR,
  COPPER_SWORD,
  COPPER_AXE,
  WOOD_SHIELD,
] as const;
const stackLimit = (item: ItemId): number => (typeof item === "string" ? 1 : STACK_LIMIT);

/** What breaking a block gives you (nothing for AIR). Rock comes away as
 * cobblestone and turf as dirt; everything else drops itself. */
export function dropFor(block: BlockId): BlockId {
  switch (block) {
    case BlockId.STONE:
      return BlockId.COBBLE;
    case BlockId.GRASS:
    case BlockId.FROSTED_GRASS:
      return BlockId.DIRT;
    default:
      return HOLDABLE.has(block) ? block : BlockId.AIR;
  }
}

/** Seconds of digging in Adventure, using the pick automatically when owned. */
export function digSeconds(
  block: BlockId,
  hasMiningPick = false,
  copperPick = false,
  usingAxe = false,
): number {
  const rockSpeed = copperPick ? 0.42 : hasMiningPick ? 0.65 : 1.3;
  const oreSpeed = copperPick ? 0.57 : 0.85;
  const def = BLOCKS[block];
  if (!def.breakable) return Infinity;
  if (def.shape === "cross") return 0.08;
  switch (block) {
    case BlockId.LEAVES:
    case BlockId.AUTUMN_LEAVES:
    case BlockId.PINE_LEAVES:
      return 0.25;
    case BlockId.GLASS:
    case BlockId.LANTERN:
      return 0.35;
    case BlockId.DIRT:
    case BlockId.GRASS:
    case BlockId.FROSTED_GRASS:
    case BlockId.SAND:
    case BlockId.GRAVEL:
    case BlockId.SNOW:
    case BlockId.CLAY:
      return 0.5;
    case BlockId.ICE:
    case BlockId.CACTUS:
      return 0.6;
    case BlockId.WOOD:
    case BlockId.PALE_WOOD:
    case BlockId.PINE_WOOD:
    case BlockId.PLANKS:
      return usingAxe ? 0.3 : 0.9;
    case BlockId.COAL_ORE:
      return hasMiningPick ? oreSpeed : 1.6;
    case BlockId.GOLD_ORE:
      return hasMiningPick ? oreSpeed : Infinity;
    case BlockId.COPPER_ORE:
      return hasMiningPick ? oreSpeed : 1.8;
    case BlockId.DIAMOND_ORE:
      return hasMiningPick ? (copperPick ? 0.76 : 1.5) : Infinity;
    case BlockId.CRYSTAL:
      return hasMiningPick ? (copperPick ? 0.7 : 1) : Infinity;
    default:
      return rockSpeed; // stone and everything built from it
  }
}

export class Bag {
  private readonly counts = new Map<ItemId, number>();
  /** Fired whenever a count changes. */
  onChange: (() => void) | undefined;

  constructor(saved?: unknown) {
    if (typeof saved !== "object" || saved === null) return;
    for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
      const id = EQUIPMENT.find((equipment) => equipment === key) ?? (Number(key) as BlockId);
      if (typeof id === "number" && !HOLDABLE.has(id)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const count = Math.min(stackLimit(id), Math.floor(value));
      if (count > 0) this.counts.set(id, count);
    }
  }

  count(item: ItemId): number {
    return this.counts.get(item) ?? 0;
  }

  /** Adds up to `amount`; returns how many actually fit. */
  add(item: ItemId, amount = 1): number {
    if ((typeof item === "number" && !HOLDABLE.has(item)) || amount <= 0) return 0;
    const before = this.count(item);
    const after = Math.min(stackLimit(item), before + Math.floor(amount));
    if (after === before) return 0;
    this.counts.set(item, after);
    this.onChange?.();
    return after - before;
  }

  /** Takes `amount` out if (and only if) that many are there. */
  remove(block: ItemId, amount = 1): boolean {
    const before = this.count(block);
    if (amount <= 0 || before < amount) return false;
    if (before === amount) this.counts.delete(block);
    else this.counts.set(block, before - amount);
    this.onChange?.();
    return true;
  }

  /** The blocks held, in inventory order. */
  owned(): BlockId[] {
    return INVENTORY_BLOCKS.filter((block) => this.count(block) > 0);
  }

  get pick(): MiningPick | null {
    if (this.count(COPPER_PICK) > 0) return COPPER_PICK;
    return this.count(MINING_PICK) > 0 ? MINING_PICK : null;
  }

  equipment(): readonly (typeof EQUIPMENT)[number][] {
    return EQUIPMENT.filter((item) =>
      isMiningPick(item) ? item === this.pick : this.count(item) > 0,
    );
  }

  toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [block, count] of this.counts) out[block.toString()] = count;
    return out;
  }
}

export interface Recipe {
  readonly id: string;
  readonly output: ItemId;
  readonly amount: number;
  readonly needs: readonly (readonly [ItemId, number])[];
}

/** What can be made by hand. Deliberately few and obvious: a child should
 * be able to guess each one. */
export const RECIPES: readonly Recipe[] = [
  { id: "planks-oak", output: BlockId.PLANKS, amount: 4, needs: [[BlockId.WOOD, 1]] },
  { id: "planks-pale", output: BlockId.PLANKS, amount: 4, needs: [[BlockId.PALE_WOOD, 1]] },
  { id: "planks-pine", output: BlockId.PLANKS, amount: 4, needs: [[BlockId.PINE_WOOD, 1]] },
  {
    id: MINING_PICK,
    output: MINING_PICK,
    amount: 1,
    needs: [
      [BlockId.PLANKS, 2],
      [BlockId.COBBLE, 2],
    ],
  },
  {
    id: "stone",
    output: BlockId.STONE,
    amount: 2,
    needs: [
      [BlockId.COBBLE, 2],
      [BlockId.COAL_ORE, 1],
    ],
  },
  { id: "stone-bricks", output: BlockId.STONE_BRICK, amount: 4, needs: [[BlockId.COBBLE, 4]] },
  {
    id: "bricks",
    output: BlockId.BRICK,
    amount: 4,
    needs: [
      [BlockId.CLAY, 4],
      [BlockId.COAL_ORE, 1],
    ],
  },
  {
    id: "glass",
    output: BlockId.GLASS,
    amount: 2,
    needs: [
      [BlockId.SAND, 2],
      [BlockId.COAL_ORE, 1],
    ],
  },
  { id: "sandstone", output: BlockId.SANDSTONE, amount: 2, needs: [[BlockId.SAND, 4]] },
  {
    id: COPPER_PICK,
    output: COPPER_PICK,
    amount: 1,
    needs: [
      [MINING_PICK, 1],
      [BlockId.COPPER_ORE, 3],
    ],
  },
  {
    id: COPPER_ARMOR,
    output: COPPER_ARMOR,
    amount: 1,
    needs: [
      [BlockId.COPPER_ORE, 6],
      [BlockId.PLANKS, 1],
    ],
  },
  {
    id: COPPER_SWORD,
    output: COPPER_SWORD,
    amount: 1,
    needs: [
      [BlockId.COPPER_ORE, 2],
      [BlockId.PLANKS, 1],
    ],
  },
  {
    id: COPPER_AXE,
    output: COPPER_AXE,
    amount: 1,
    needs: [
      [BlockId.COPPER_ORE, 3],
      [BlockId.PLANKS, 2],
    ],
  },
  {
    id: WOOD_SHIELD,
    output: WOOD_SHIELD,
    amount: 1,
    needs: [
      [BlockId.PLANKS, 4],
      [BlockId.COPPER_ORE, 1],
    ],
  },
  {
    id: "copper-block",
    output: BlockId.COPPER_BLOCK,
    amount: 1,
    needs: [[BlockId.COPPER_ORE, 4]],
  },
  {
    id: "camp-bed",
    output: BlockId.CAMP_BED,
    amount: 1,
    needs: [
      [BlockId.PLANKS, 3],
      [BlockId.TALL_GRASS, 2],
    ],
  },
  { id: "ice", output: BlockId.ICE, amount: 1, needs: [[BlockId.SNOW, 2]] },
  {
    id: "lantern",
    output: BlockId.LANTERN,
    amount: 1,
    needs: [
      [BlockId.CRYSTAL, 1],
      [BlockId.PLANKS, 2],
    ],
  },
  {
    id: "lantern-gold",
    output: BlockId.LANTERN,
    amount: 2,
    needs: [
      [BlockId.GOLD_ORE, 1],
      [BlockId.COAL_ORE, 1],
    ],
  },
];

export function canCraft(bag: Bag, recipe: Recipe): boolean {
  if (recipe.output === MINING_PICK && bag.pick === COPPER_PICK) return false;
  return (
    recipe.needs.every(([block, amount]) => bag.count(block) >= amount) &&
    bag.count(recipe.output) + recipe.amount <= stackLimit(recipe.output)
  );
}

/** Spends the ingredients and adds the result; false (and no change) if
 * the bag doesn't hold what the recipe needs. */
export function craft(bag: Bag, recipe: Recipe): boolean {
  if (!canCraft(bag, recipe)) return false;
  for (const [block, amount] of recipe.needs) bag.remove(block, amount);
  bag.add(recipe.output, recipe.amount);
  return true;
}
