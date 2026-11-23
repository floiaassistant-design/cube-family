import { describe, expect, it } from "vitest";
import { BlockId } from "./blocks";
import { Chunk } from "./chunk";
import { CHUNK_SIZE } from "./coords";
import { EditStore, type KeyValueStorage } from "./edit-store";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe("record + applyTo", () => {
  it("re-applies a recorded edit onto a fresh chunk", () => {
    const store = new EditStore(memoryStorage(), 1);
    store.record(5, 10, 7, BlockId.WOOD);
    const chunk = new Chunk(0, 0);
    store.applyTo(chunk);
    expect(chunk.getBlock(5, 10, 7)).toBe(BlockId.WOOD);
  });

  it("routes negative world coordinates to the right chunk and local cell", () => {
    const store = new EditStore(memoryStorage(), 1);
    store.record(-1, 10, -1, BlockId.STONE); // chunk (-1,-1), local (15, 15)
    const chunk = new Chunk(-1, -1);
    store.applyTo(chunk);
    expect(chunk.getBlock(CHUNK_SIZE - 1, 10, CHUNK_SIZE - 1)).toBe(BlockId.STONE);
  });

  it("does not touch chunks without recorded edits", () => {
    const store = new EditStore(memoryStorage(), 1);
    store.record(5, 10, 7, BlockId.WOOD); // chunk (0,0)
    const other = new Chunk(3, 3);
    store.applyTo(other);
    expect(other.isEmpty()).toBe(true);
  });

  it("keeps only the last edit for a cell edited twice", () => {
    const store = new EditStore(memoryStorage(), 1);
    store.record(5, 10, 7, BlockId.WOOD);
    store.record(5, 10, 7, BlockId.AIR); // broke the block afterwards
    const chunk = new Chunk(0, 0);
    chunk.setBlock(5, 10, 7, BlockId.STONE);
    store.applyTo(chunk);
    expect(chunk.getBlock(5, 10, 7)).toBe(BlockId.AIR);
  });
});

describe("persistence across instances", () => {
  it("a new store over the same storage and seed sees earlier edits", () => {
    const storage = memoryStorage();
    const first = new EditStore(storage, 42);
    first.record(3, 20, 4, BlockId.LEAVES);
    first.record(30, 21, 40, BlockId.SAND); // a second chunk

    const second = new EditStore(storage, 42);
    expect(second.totalEdits).toBe(2);
    expect(second.editedChunkCount).toBe(2);

    const chunk = new Chunk(0, 0);
    second.applyTo(chunk);
    expect(chunk.getBlock(3, 20, 4)).toBe(BlockId.LEAVES);
  });

  it("different seeds keep fully separate overlays", () => {
    const storage = memoryStorage();
    const worldA = new EditStore(storage, 1);
    worldA.record(0, 10, 0, BlockId.WOOD);

    const worldB = new EditStore(storage, 2);
    expect(worldB.totalEdits).toBe(0);
    const chunk = new Chunk(0, 0);
    worldB.applyTo(chunk);
    expect(chunk.isEmpty()).toBe(true);
  });

  it("a corrupt payload resets to empty instead of throwing", () => {
    const storage = memoryStorage();
    storage.setItem(EditStore.storageKey(9), "{not json");
    const store = new EditStore(storage, 9);
    expect(store.totalEdits).toBe(0);
  });
});

describe("storage failures", () => {
  it("keeps the session playable if storage reads and writes fail", () => {
    const fail = () => {
      throw new Error("Storage unavailable");
    };
    const store = new EditStore({ getItem: fail, setItem: fail }, 1);
    store.record(5, 10, 7, BlockId.WOOD);
    const chunk = new Chunk(0, 0);
    store.applyTo(chunk);
    expect(chunk.getBlock(5, 10, 7)).toBe(BlockId.WOOD);
  });

  it("keeps valid edits next to malformed entries", () => {
    const storage = memoryStorage();
    const index = Chunk.index(5, 10, 7);
    storage.setItem(
      EditStore.storageKey(1),
      JSON.stringify({ "1,1": null, "0,0": { [index]: BlockId.WOOD, 6: 255, "-1": 1 } }),
    );
    const store = new EditStore(storage, 1);
    const chunk = new Chunk(0, 0);
    store.applyTo(chunk);
    expect(store.totalEdits).toBe(1);
    expect(chunk.getBlock(5, 10, 7)).toBe(BlockId.WOOD);
  });
});

describe("fortress batch safety", () => {
  it("persists a batch over several chunks and detects occupied terrain", () => {
    const storage = memoryStorage();
    const store = new EditStore(storage, 123);
    store.recordMany([
      { x: -1, y: 48, z: -1, id: BlockId.STONE_BRICK },
      { x: 17, y: 50, z: 17, id: BlockId.COBBLE },
    ]);
    expect(store.totalEdits).toBe(2);
    expect(store.hasEditsInRect(-3, 0, -3, 0)).toBe(true);
    expect(store.hasEditsInRect(17, 19, 17, 19)).toBe(true);
    expect(store.hasEditsInRect(5, 10, 5, 10)).toBe(false);
    const copy = new EditStore(storage, 123);
    const chunk = new Chunk(-1, -1);
    copy.applyTo(chunk);
    expect(chunk.getBlock(15, 48, 15)).toBe(BlockId.STONE_BRICK);
  });

  it("rejects invalid batches without committing partial edits", () => {
    const store = new EditStore(memoryStorage(), 987);
    expect(() => {
      store.recordMany([
        { x: 1, y: 40, z: 1, id: BlockId.STONE_BRICK },
        { x: 2, y: -1, z: 1, id: BlockId.STONE_BRICK },
      ]);
    }).toThrow();
    expect(store.totalEdits).toBe(0);
  });
});
