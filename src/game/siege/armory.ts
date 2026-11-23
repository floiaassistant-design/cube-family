/** A small, temporary siege economy. Nothing here touches the normal inventory
 * or persistent world saves. Only the SiegeController can authorize purchases. */
export type ArmoryPurchase = "sword" | "bow" | "sword-upgrade" | "bow-upgrade" | "arrows";
export type ArmoryKill = "normal" | "runner" | "armored" | "boss";

export interface ArmoryState {
  readonly coins: number;
  /** 0 = default weapon, 1 = bought, 2–4 = upgrades. */
  readonly swordTier: number;
  readonly bowTier: number;
  readonly swordDamage: number;
  readonly bowDamage: number;
  readonly bowCooldown: number;
}

export const ARMORY_ITEMS: readonly ArmoryPurchase[] = [
  "sword",
  "sword-upgrade",
  "bow",
  "bow-upgrade",
  "arrows",
];

const UPGRADE_SWORD = [75, 125, 175] as const;
const UPGRADE_BOW = [100, 150, 200] as const;
const KILL_REWARDS: Readonly<Record<ArmoryKill, number>> = {
  normal: 20,
  runner: 25,
  armored: 30,
  boss: 80,
};

const MAX_COINS = 99_999;

/** Returns null when an offer is no longer available (not purchased yet,
 * already owned, or maximum rank reached). No hidden escalating prices. */
export function armoryPrice(state: ArmoryState, item: ArmoryPurchase, arrows: number): number | null {
  switch (item) {
    case "sword":
      return state.swordTier === 0 ? 100 : null;
    case "bow":
      return state.bowTier === 0 ? 150 : null;
    case "sword-upgrade":
      return state.swordTier >= 1 && state.swordTier <= 3
        ? (UPGRADE_SWORD[state.swordTier - 1] ?? null)
        : null;
    case "bow-upgrade":
      return state.bowTier >= 1 && state.bowTier <= 3
        ? (UPGRADE_BOW[state.bowTier - 1] ?? null)
        : null;
    case "arrows":
      return arrows <= 96 ? 30 : null;
  }
}

export class SiegeArmory {
  private coins = 100;
  private swordTier = 0;
  private bowTier = 0;

  get state(): ArmoryState {
    return {
      coins: this.coins,
      swordTier: this.swordTier,
      bowTier: this.bowTier,
      swordDamage: this.swordTier === 0 ? 4 : 4 + this.swordTier * 2,
      bowDamage: this.bowTier === 0 ? 4 : 5 + this.bowTier,
      bowCooldown: this.bowTier === 0 ? 0.8 : Math.max(0.4, 0.8 - this.bowTier * 0.1),
    };
  }

  reset(): void {
    this.coins = 100;
    this.swordTier = 0;
    this.bowTier = 0;
  }

  awardKill(kind: ArmoryKill): void {
    this.coins = Math.min(MAX_COINS, this.coins + KILL_REWARDS[kind]);
  }

  awardWave(): void {
    this.coins = Math.min(MAX_COINS, this.coins + 40);
  }

  /** The arrow count belongs to the siege controller, not the normal bag.
   * On failure, the transaction has no side effects. */
  buy(item: ArmoryPurchase, arrows: number): { success: boolean; arrows: number } {
    const price = armoryPrice(this.state, item, arrows);
    if (price === null || this.coins < price) return { success: false, arrows };
    this.coins -= price;
    switch (item) {
      case "sword":
        this.swordTier = 1;
        break;
      case "bow":
        this.bowTier = 1;
        break;
      case "sword-upgrade":
        this.swordTier++;
        break;
      case "bow-upgrade":
        this.bowTier++;
        break;
      case "arrows":
        return { success: true, arrows: arrows + 32 };
    }
    return { success: true, arrows };
  }
}
