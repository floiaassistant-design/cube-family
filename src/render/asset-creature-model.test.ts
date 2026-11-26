import { describe, expect, it } from "vitest";
import { AssetCreatureModel } from "./asset-creature-model";
import type { Cow } from "../game/cows";
import type { NightCreature } from "../game/wildlife";
import type { SiegeZombie } from "../game/siege/session";

const position = { x: 0, y: 60, z: 0 };

describe("original voxel models", () => {
  it("preserves the GLB volumes of the cow, miner and Titan", () => {
    expect(AssetCreatureModel.boxCount("cow")).toBe(64);
    expect(AssetCreatureModel.boxCount("miner")).toBe(128);
    expect(AssetCreatureModel.boxCount("titan")).toBe(362);
    const miner = new AssetCreatureModel("miner");
    expect(miner.boxes.some(({ node }) => Math.abs(node.quaternion.z) > 0.01)).toBe(true);
  });

  it("plays the cow's graze and walk clips on the source joints", () => {
    const cow: Cow = { id: "cow:1:0", kind: "cow", position, action: "Graze", moving: false };
    const model = new AssetCreatureModel("cow");
    const head = model.root.getObjectByName("joint2");
    const leg = model.root.getObjectByName("joint3");
    expect(head).toBeDefined();
    expect(leg).toBeDefined();
    model.pose(0, 0, 0, cow, 0.8);
    expect(Math.abs(head?.quaternion.x ?? 0)).toBeGreaterThan(0.15);
    cow.action = "Walk";
    cow.moving = true;
    model.pose(0, 0, 0, cow, 0.43);
    expect(Math.abs(leg?.quaternion.x ?? 0)).toBeGreaterThan(0.05);
  });

  it("plays the strike animation for the miner and the Titan and preserves the bright core", () => {
    const miner: NightCreature = {
      id: "roamer:0",
      kind: "roamer",
      position,
      variant: "miner",
      moving: false,
      health: 6,
      attacking: true,
    };
    const titan: SiegeZombie = {
      id: "siege:18",
      kind: "siege-zombie",
      position,
      variant: "boss",
      moving: false,
      attacking: true,
      health: 35,
      maxHealth: 35,
      route: "south",
      lane: 0,
      spread: 0,
      row: 0,
      waypoint: 2,
      attackClock: 0.6,
    };
    const minerModel = new AssetCreatureModel("miner");
    const titanModel = new AssetCreatureModel("titan");
    minerModel.pose(0, 0, 0, miner, 0.34);
    titanModel.pose(0, 0, 0, titan, 0.34);
    expect(Math.abs(minerModel.root.getObjectByName("joint4")?.quaternion.x ?? 0)).toBeGreaterThan(
      0.1,
    );
    expect(Math.abs(titanModel.root.getObjectByName("joint5")?.quaternion.x ?? 0)).toBeGreaterThan(
      0.1,
    );
    expect(titanModel.boxes.some(({ minimumShade }) => minimumShade >= 0.8)).toBe(true);
  });
});
