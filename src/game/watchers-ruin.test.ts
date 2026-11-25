import { describe, expect, it } from "vitest";
import { BlockId } from "../world/blocks";
import { Chunk } from "../world/chunk";
import { EditStore } from "../world/edit-store";
import { findWatchersRuin, WatchersRuin } from "./watchers-ruin";

describe("Watchers’ Ruin", () => {
  it("chooses the same dry site each time and goes around existing edits", () => {
    const start = { x: 0.5, z: 0.5 };
    const height = () => 61;
    const first = findWatchersRuin(start, start, height, () => false);
    const conflict = (minX: number, maxX: number, minZ: number, maxZ: number) =>
      first.x >= minX && first.x <= maxX && first.z >= minZ && first.z <= maxZ;
    expect(first).toEqual({ x: 28, y: 61, z: 0 });
    const next = findWatchersRuin(start, start, height, conflict);
    expect(next).not.toEqual(first);
    expect(findWatchersRuin(start, start, height, conflict)).toEqual(next);
  });

  it("creates loot across chunk boundaries and keeps both placed and broken blocks on reload", () => {
    const ruin = new WatchersRuin({ x: 0, y: 61, z: 0 }, () => 59);
    expect(ruin.chunks).toHaveLength(4);
    const west = new Chunk(-1, -1);
    const edits = new EditStore(null, 2026);
    ruin.apply(west, edits);
    expect(west.getBlock(15, 62, 15)).toBe(BlockId.COPPER_ORE);
    expect(west.getBlock(15, 64, 14)).toBe(BlockId.LANTERN);
    edits.record(-1, 62, -1, BlockId.AIR);
    edits.record(-1, 64, -2, BlockId.PLANKS);
    const reloaded = new Chunk(-1, -1);
    edits.applyTo(reloaded);
    ruin.apply(reloaded, edits);
    expect(reloaded.getBlock(15, 62, 15)).toBe(BlockId.AIR);
    expect(reloaded.getBlock(15, 64, 14)).toBe(BlockId.PLANKS);
  });
});
