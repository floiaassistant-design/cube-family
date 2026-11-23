import { describe, expect, it } from "vitest";
import { loadPlayerSave, storePlayerSave } from "./player-save";
import { WORLD_REGISTRY_KEY, WorldRegistry } from "./world-registry";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("WorldRegistry", () => {
  it("discovers legacy player, edit and fortress saves without changing their bytes", () => {
    const storage = memory();
    storage.map.set("voxel-world:player:v2:5", '{"x":1}');
    storage.map.set("voxel-world:edits:v2:9", '{"0,0":{"1":2}}');
    storage.map.set("voxel-world:fortress:v1:11", '{"x":2}');
    const registry = new WorldRegistry(storage, () => 100);
    expect(registry.list().map((w) => w.seed)).toEqual([5, 9, 11]);
    expect(storage.map.get("voxel-world:edits:v2:9")).toBe('{"0,0":{"1":2}}');
    expect(registry.get(5)?.name).toBe("World 5");
    expect(new WorldRegistry(storage).list()).toHaveLength(3);
  });

  it("does not claim that a shared terrain seed is a shared save", () => {
    const storage = memory();
    storage.map.set("voxel-world:edits:v2:41", "{}");
    const registry = new WorldRegistry(storage, () => 10);
    expect(registry.create("Overwrite?", "creative", 41)).toBeNull();
    expect(storage.map.get("voxel-world:edits:v2:41")).toBe("{}");
  });

  it("creates a named world, tracks mode and visit, and survives reopening", () => {
    const storage = memory();
    const registry = new WorldRegistry(
      storage,
      () => 100,
      () => 0.01,
    );
    const created = registry.create("  Family fort  ", "adventure");
    expect(created?.name).toBe("Family fort");
    expect(created?.mode).toBe("adventure");
    expect(created).not.toBeNull();
    if (!created) return;
    registry.visit(created.seed, "adventure");
    registry.setMode(created.seed, "creative");
    const restored = new WorldRegistry(storage);
    expect(restored.get(created.seed)?.mode).toBe("creative");
    expect(restored.get(created.seed)?.lastPlayed).toBe(100);
  });

  it("keeps an older player save intact when its world is named", () => {
    const storage = memory();
    const save = {
      x: 1,
      y: 64,
      z: 2,
      yaw: 0,
      pitch: 0,
      flying: false,
      time: 8,
      hotbar: [],
      slot: 0,
      mode: "adventure" as const,
    };
    storePlayerSave(storage, 28, save);
    const registry = new WorldRegistry(storage);
    expect(registry.rename(28, "Ancient village")).toBe(true);
    expect(loadPlayerSave(storage, 28)).toEqual(save);
    expect(new WorldRegistry(storage).get(28)?.name).toBe("Ancient village");
  });

  it("requires valid names and unique seeds, and never corrupts occupied worlds", () => {
    const storage = memory();
    const registry = new WorldRegistry(
      storage,
      () => 8,
      () => 0.2,
    );
    expect(registry.create("  ", "creative", 2)).toBeNull();
    expect(registry.create("A", "creative", 2)?.seed).toBe(2);
    expect(registry.create("B", "adventure", 2)).toBeNull();
    expect(registry.create("Long name ".repeat(10), "creative", 3)?.name.length).toBe(40);
  });

  it("requires two distinct seeds and deletes only an inactive world", () => {
    const storage = memory();
    const registry = new WorldRegistry(storage);
    registry.create("Keep", "creative", 7);
    registry.create("Remove", "adventure", 8);
    storage.map.set("voxel-world:player:v2:7", '{"keep":true}');
    storage.map.set("voxel-world:player:v2:8", '{"remove":true}');
    storage.map.set("voxel-world:fortress:v1:8", '{"remove":true}');
    expect(registry.remove(7, 7)).toBe(false);
    expect(registry.remove(8, 7)).toBe(true);
    expect(storage.map.get("voxel-world:player:v2:7")).toBe('{"keep":true}');
    expect(storage.map.has("voxel-world:player:v2:8")).toBe(false);
    expect(storage.map.has("voxel-world:fortress:v1:8")).toBe(false);
  });

  it("ignores malformed registry values and invalid legacy keys", () => {
    const storage = memory();
    storage.map.set(WORLD_REGISTRY_KEY, '{"version":1,"worlds":[{"seed":"bad"}]}');
    storage.map.set("voxel-world:player:v2:NaN", "x");
    storage.map.set("voxel-world:player:v2:17", "legacy");
    expect(new WorldRegistry(storage).list().map((w) => w.seed)).toEqual([17]);
  });

  it("fails safely when local storage refuses writes", () => {
    const registry = new WorldRegistry({
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(registry.create("Cannot save", "creative", 19)).toBeNull();
  });
});
