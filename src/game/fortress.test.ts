import { describe, expect, it } from "vitest";
import { Chunk } from "../world/chunk";
import { BlockId } from "../world/blocks";
import { FORTRESS_CRYSTAL, fortressBlueprint } from "./fortress-blueprint";
import { applyFortressChunk, FORTRESS_GROUND_Y } from "./fortress-arena";
import { FortressSiege } from "./fortress-siege";

describe("five-bastion castle", () => {
  it("is deterministic and stays within the 96x96 footprint", () => {
    const blocks = fortressBlueprint();
    expect(blocks.length).toBeGreaterThan(1000);
    expect(blocks).toEqual(fortressBlueprint());
    expect(blocks.every((b) => b.x >= 0 && b.x < 96 && b.z >= 0 && b.z < 96)).toBe(true);
    const at = (x: number, y: number, z: number) =>
      blocks.find((b) => b.x === x && b.y === y && b.z === z)?.id;
    expect(at(FORTRESS_CRYSTAL.x, 2, FORTRESS_CRYSTAL.z)).toBe(BlockId.CRYSTAL);
    expect(at(48, 4, 86)).toBe(BlockId.AIR); // the southern gateway
    expect(at(48, 8, 86)).toBe(BlockId.PLANKS); // fortified lintel
  });
  it("overlays only the dedicated arena, even after a chunk reload", () => {
    const chunk = new Chunk(3, 3);
    applyFortressChunk(chunk);
    expect(chunk.getBlock(0, FORTRESS_GROUND_Y, 0)).toBe(BlockId.GRASS);
    expect(chunk.getBlock(0, FORTRESS_GROUND_Y + 2, 0)).toBe(BlockId.CRYSTAL);
    const other = new Chunk(20, 20);
    other.setBlock(0, 66, 0, BlockId.DIAMOND_ORE);
    applyFortressChunk(other);
    expect(other.getBlock(0, 66, 0)).toBe(BlockId.DIAMOND_ORE);
  });
});

describe("fortress siege", () => {
  const stand = (_x: number, _z: number, _y: number, _tall: boolean) => FORTRESS_GROUND_Y + 1;
  it("starts with preparation, spawns raiders and accepts combat", () => {
    const game = new FortressSiege();
    game.start();
    expect(game.phase).toBe("preparation");
    for (let i = 0; i < 205; i++) game.update(0.1, stand);
    expect(game.phase).toBe("wave");
    game.update(0.1, stand);
    const target = game.creatures[0];
    expect(target).toBeDefined();
    if (!target) throw new Error("missing attacker");
    expect(game.strike(target.id, 8)).toBe("defeated");
    expect(game.creatures.some((z) => z.id === target.id)).toBe(false);
  });
  it("rejects invalid time steps and resets without persisting", () => {
    const game = new FortressSiege();
    expect(game.update(Number.POSITIVE_INFINITY, stand)).toBe("idle");
    game.start();
    game.reset();
    expect(game.phase).toBe("idle");
    expect(game.wave).toBe(0);
    expect(game.crystalHealth).toBe(800);
  });
});
