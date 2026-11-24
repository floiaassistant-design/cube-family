import { describe, expect, it } from "vitest";
import { SiegeArmory, armoryPrice } from "./armory";
import { SiegeController } from "./session";

const site = { x: 128, z: -64, y: 62 } as const;

describe("siege armory prices and progression", () => {
  it("starts each run with coins and defaults that do not affect normal inventory", () => {
    const shop = new SiegeArmory();
    expect(shop.state).toEqual({
      coins: 100,
      swordTier: 0,
      bowTier: 0,
      swordDamage: 4,
      bowDamage: 4,
      bowCooldown: 0.8,
    });
    expect(armoryPrice(shop.state, "sword", 32)).toBe(100);
    expect(armoryPrice(shop.state, "bow", 32)).toBe(150);
    expect(armoryPrice(shop.state, "sword-upgrade", 32)).toBeNull();
    expect(armoryPrice(shop.state, "bow-upgrade", 32)).toBeNull();
  });

  it("buys a sword then upgrades through three ranks, rejecting duplicates and excess levels", () => {
    const shop = new SiegeArmory();
    expect(shop.buy("sword", 32)).toEqual({ success: true, arrows: 32 });
    expect(shop.state.swordTier).toBe(1);
    expect(shop.state.swordDamage).toBe(6);
    expect(shop.state.coins).toBe(0);
    expect(shop.buy("sword", 32).success).toBe(false);
    expect(shop.buy("sword-upgrade", 32).success).toBe(false);

    for (let i = 0; i < 8; i++) shop.awardKill("boss");
    for (const [cost, tier, damage] of [
      [75, 2, 8],
      [125, 3, 10],
      [175, 4, 12],
    ] as const) {
      expect(armoryPrice(shop.state, "sword-upgrade", 32)).toBe(cost);
      expect(shop.buy("sword-upgrade", 32).success).toBe(true);
      expect(shop.state.swordTier).toBe(tier);
      expect(shop.state.swordDamage).toBe(damage);
    }
    expect(armoryPrice(shop.state, "sword-upgrade", 32)).toBeNull();
    expect(shop.buy("sword-upgrade", 32).success).toBe(false);
  });

  it("upgrades bow damage/cadence and caps arrow restocking with atomic payment", () => {
    const shop = new SiegeArmory();
    expect(shop.buy("bow", 32).success).toBe(false);
    shop.awardKill("armored");
    shop.awardKill("boss");
    expect(shop.buy("bow", 32).success).toBe(true);
    expect(shop.state.bowTier).toBe(1);
    expect(shop.state.bowDamage).toBe(6);
    expect(shop.state.bowCooldown).toBeCloseTo(0.7);

    for (let i = 0; i < 10; i++) shop.awardKill("boss");
    for (const nextTier of [2, 3, 4]) {
      expect(shop.buy("bow-upgrade", 32).success).toBe(true);
      expect(shop.state.bowTier).toBe(nextTier);
    }
    expect(shop.state.bowCooldown).toBeCloseTo(0.4);
    expect(shop.state.bowDamage).toBe(9);
    expect(shop.buy("bow-upgrade", 32).success).toBe(false);
    expect(shop.buy("arrows", 97)).toEqual({ success: false, arrows: 97 });
    const coins = shop.state.coins;
    expect(shop.buy("arrows", 96)).toEqual({ success: true, arrows: 128 });
    expect(shop.state.coins).toBe(coins - 30);
    expect(shop.buy("arrows", 128).success).toBe(false);
  });

  it("awards capped currency and resets only the temporary run", () => {
    const shop = new SiegeArmory();
    shop.awardKill("normal");
    shop.awardKill("runner");
    shop.awardKill("armored");
    shop.awardKill("boss");
    shop.awardWave();
    expect(shop.state.coins).toBe(295);
    for (let i = 0; i < 1500; i++) shop.awardKill("boss");
    expect(shop.state.coins).toBe(99_999);
    shop.reset();
    expect(shop.state.coins).toBe(100);
    expect(shop.state.bowTier).toBe(0);
  });
});

describe("armory integration in the fortress session", () => {
  it("allows purchases only before/between waves and makes the sword stronger", () => {
    const siege = new SiegeController(site, () => 60);
    expect(siege.buy("sword")).toBe(false);
    siege.start({ waves: 5, difficulty: "easy" });
    expect(siege.buy("sword")).toBe(true);
    expect(siege.report.armory.coins).toBe(0);
    expect(siege.buy("bow")).toBe(false);

    for (let i = 0; i < 210; i++) siege.update(0.1);
    expect(siege.report.phase).toBe("wave");
    expect(siege.buy("arrows")).toBe(false);
    const zombie = siege.zombies[0];
    expect(zombie).toBeDefined();
    if (!zombie) throw new Error("Expected first zombie");
    const health = zombie.health;
    expect(siege.melee(zombie, 4, 1)).toBe(true);
    expect(zombie.health).toBe(health - 6);
    expect(siege.report.armory.coins).toBe(0);
    expect(siege.melee(zombie, 4, 2)).toBe(true);
    expect(siege.report.armory.coins).toBe(20);
    siege.stop();
    expect(siege.report.armory.coins).toBe(100);
    siege.start();
    expect(siege.report.armory.swordTier).toBe(0);
  });

  it("pays wave completion bonuses and permits purchases in intermissions", () => {
    const siege = new SiegeController(site, () => 60);
    siege.start({ waves: 5, difficulty: "easy" });
    let strikeTime = 1;
    for (let frame = 0; frame < 1500 && siege.report.phase !== "intermission"; frame++) {
      siege.update(0.1);
      for (const zombie of siege.zombies) {
        while (zombie.health > 0) {
          strikeTime += 1;
          expect(siege.melee(zombie, 4, strikeTime)).toBe(true);
        }
      }
    }
    expect(siege.report.phase).toBe("intermission");
    expect(siege.report.armory.coins).toBeGreaterThanOrEqual(240);
    expect(siege.buy("bow")).toBe(true);
    expect(siege.report.armory.bowTier).toBe(1);
    const currentArrows = siege.report.arrows;
    expect(siege.buy("arrows")).toBe(true);
    expect(siege.report.arrows).toBe(currentArrows + 32);
  });
});
