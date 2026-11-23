import { describe, expect, it } from "vitest";
import { playerSaveKey } from "./player-save";
import { exportWorldArchive, importWorldArchive, MAX_WORLD_FILE_BYTES } from "./world-transfer";
import { WorldRegistry } from "./world-registry";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const player = JSON.stringify({
  x: 4,
  y: 72,
  z: 8,
  yaw: 0.4,
  pitch: 0,
  flying: false,
  time: 19,
  hotbar: [1, 2, 3],
  slot: 0,
  mode: "adventure",
  bag: { "14": 4 },
  wildlife: { health: 10 },
});

describe("world transfer", () => {
  it("exports all three legacy save keys, restores on another browser, preserves bytes", () => {
    const source = memory();
    const registry = new WorldRegistry(source);
    registry.create("Family fortress", "adventure", 105);
    source.setItem(playerSaveKey(105), player);
    source.setItem("voxel-world:edits:v2:105", '{"0,0":{"3":14}}');
    source.setItem("voxel-world:fortress:v1:105", '{"x":128,"y":64,"z":96}');
    source.setItem("app-unrelated", "keep private");
    const text = exportWorldArchive(source, registry.get(105));
    expect(text).not.toBeNull();
    if (!text) return;
    expect(text).not.toContain("keep private");
    const target = memory();
    const restored = importWorldArchive(target, new WorldRegistry(target), text);
    expect(restored).toEqual({ ok: true, seed: 105 });
    expect(target.getItem(playerSaveKey(105))).toBe(player);
    expect(target.getItem("voxel-world:edits:v2:105")).toBe('{"0,0":{"3":14}}');
    expect(target.getItem("voxel-world:fortress:v1:105")).toBe('{"x":128,"y":64,"z":96}');
    expect(new WorldRegistry(target).get(105)?.name).toBe("Family fortress");
  });

  it("refuses to overwrite any existing player saves, even without registry", () => {
    const source = memory();
    const origin = new WorldRegistry(source);
    origin.create("Old", "adventure", 8);
    source.setItem(playerSaveKey(8), player);
    const archive = exportWorldArchive(source, origin.get(8));
    expect(archive).not.toBeNull();
    if (!archive) return;
    const target = memory();
    target.setItem(playerSaveKey(8), "existing data");
    const result = importWorldArchive(target, new WorldRegistry(null), archive);
    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(target.getItem(playerSaveKey(8))).toBe("existing data");
  });

  it("rejects malformed and oversized archives, without writing anything", () => {
    const target = memory();
    const registry = new WorldRegistry(target);
    for (const text of ["{", "{}", "[]", "x".repeat(MAX_WORLD_FILE_BYTES + 1)]) {
      expect(importWorldArchive(target, registry, text)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(target.data.size).toBe(0);
  });

  it("rejects malicious edit identifiers and malformed player data", () => {
    const target = memory();
    const registry = new WorldRegistry(target);
    const base = {
      format: "cube-family-world",
      version: 1,
      world: { seed: 22, name: "Fail", mode: "creative" },
      saves: { player, edits: '{"0,0":{"3":14}}', fortress: null },
    };
    const edits = [
      '{"0,0":{"-1":14}}',
      '{"0,0":{"999999999":14}}',
      '{"0,0":{"3":999}}',
      '{"__proto__":{"3":14}}',
      '{"0,0":[]}',
    ];
    for (const bad of edits) {
      expect(
        importWorldArchive(
          target,
          registry,
          JSON.stringify({
            ...base,
            saves: { ...base.saves, edits: bad },
          }),
        ).ok,
      ).toBe(false);
    }
    expect(
      importWorldArchive(
        target,
        registry,
        JSON.stringify({
          ...base,
          saves: { ...base.saves, player: '{"x":1}' },
        }),
      ).ok,
    ).toBe(false);
    expect(target.data.size).toBe(0);
  });

  it("rolls back partial writes when storage is full", () => {
    const source = memory();
    const origin = new WorldRegistry(source);
    origin.create("Rollback", "creative", 33);
    source.setItem(playerSaveKey(33), player);
    source.setItem("voxel-world:edits:v2:33", "{}");
    const archive = exportWorldArchive(source, origin.get(33));
    if (!archive) throw new Error("archive unavailable");
    const target = memory();
    const limited = {
      ...target,
      setItem: (key: string, value: string) => {
        if (key === "voxel-world:edits:v2:33") throw new Error("quota");
        target.setItem(key, value);
      },
    };
    expect(importWorldArchive(limited, new WorldRegistry(target), archive)).toEqual({
      ok: false,
      reason: "storage",
    });
    expect(target.getItem(playerSaveKey(33))).toBeNull();
    expect(target.getItem("voxel-world:edits:v2:33")).toBeNull();
  });

  it("keeps a blank named world exportable", () => {
    const storage = memory();
    const registry = new WorldRegistry(storage);
    registry.create("Empty", "creative", 57);
    const archive = exportWorldArchive(storage, registry.get(57));
    if (!archive) throw new Error("archive unavailable");
    const destination = memory();
    expect(importWorldArchive(destination, new WorldRegistry(destination), archive)).toEqual({
      ok: true,
      seed: 57,
    });
  });

  it("rejects archives with an incompatible future version", () => {
    const storage = memory();
    const registry = new WorldRegistry(storage);
    registry.create("World", "creative", 80);
    const raw = exportWorldArchive(storage, registry.get(80));
    if (!raw) throw new Error("archive unavailable");
    const bad = JSON.parse(raw) as Record<string, unknown>;
    bad.version = 2;
    const destination = memory();
    expect(
      importWorldArchive(destination, new WorldRegistry(destination), JSON.stringify(bad)),
    ).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
