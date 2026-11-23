/** Unique inventory ids and mechanics for the new equipment.
 * Kept separate from rendering, controls, and the save format. */
export const COPPER_SWORD = "copper-sword";
export const COPPER_AXE = "copper-axe";
export const WOOD_SHIELD = "wood-shield";

export type NewEquipment = typeof COPPER_SWORD | typeof COPPER_AXE | typeof WOOD_SHIELD;

export function isNewEquipment(value: unknown): value is NewEquipment {
  return value === COPPER_SWORD || value === COPPER_AXE || value === WOOD_SHIELD;
}

/** The original hand attack remains 2; equipped weapons are stronger. */
export function attackDamage(item: unknown): number {
  if (item === COPPER_SWORD) return 4;
  if (item === COPPER_AXE) return 3;
  return 2;
}

/** Shield protection applies only while held. Copper armor still protects passively. */
export function incomingDamage(armored: boolean, shieldHeld: boolean): number {
  return Math.max(0, 2 - Number(armored) - Number(shieldHeld));
}
