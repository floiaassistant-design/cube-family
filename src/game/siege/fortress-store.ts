import { CHUNK_HEIGHT } from "../../world/coords";
import type { KeyValueStorage } from "../../world/edit-store";
import { SEA_LEVEL, type ColumnProfile } from "../../world/terrain";
import { FORTRESS_SIZE, type FortressLocation } from "./fortress";

/** Metadata lives outside player saves: old worlds keep exactly the same save format. */
export class FortressStore {
  private readonly key: string;
  private readonly storage: KeyValueStorage | null;

  constructor(storage: KeyValueStorage | null, seed: number) {
    this.storage = storage;
    this.key = `voxel-world:fortress:v1:${seed.toString()}`;
  }

  read(): FortressLocation | null {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const location = data as Record<string, unknown>;
      if (
        typeof location.x !== "number" ||
        typeof location.z !== "number" ||
        typeof location.y !== "number" ||
        !Number.isInteger(location.x) ||
        !Number.isInteger(location.z) ||
        !Number.isInteger(location.y)
      )
        return null;
      const { x, z, y } = location as unknown as FortressLocation;
      if (y < 18 || y + 20 >= CHUNK_HEIGHT || Math.abs(x) > 1e7 || Math.abs(z) > 1e7) return null;
      return { x, z, y };
    } catch {
      return null;
    }
  }

  write(site: FortressLocation): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(site));
    } catch {
      // The structure can still be explored in this session if storage is blocked.
    }
  }

  clear(): void {
    try {
      this.storage?.setItem(this.key, "");
    } catch {
      // Private browsing.
    }
  }
}

export type TerrainSampler = (x: number, z: number) => Pick<ColumnProfile, "terrainHeight">;

/** Select a dry, reasonably flat site near (not ON) the player's creations. */
export function findFortressSite(
  playerX: number,
  playerZ: number,
  sample: TerrainSampler,
  hasEdits: (minX: number, maxX: number, minZ: number, maxZ: number) => boolean,
): FortressLocation | null {
  if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return null;
  const px = Math.floor(playerX);
  const pz = Math.floor(playerZ);
  const candidates: readonly (readonly [number, number])[] = [
    [128, -48],
    [128, 96],
    [-224, -48],
    [-224, 96],
    [-48, 128],
    [96, 128],
    [-48, -224],
    [96, -224],
    [224, 0],
    [-320, 0],
    [0, 224],
    [0, -320],
  ];
  for (const [dx, dz] of candidates) {
    const x = px + dx;
    const z = pz + dz;
    if (hasEdits(x - 12, x + FORTRESS_SIZE + 11, z - 12, z + FORTRESS_SIZE + 11)) continue;
    let low = Infinity;
    let high = -Infinity;
    // Sample the full footprint, not just the center, so tall cliffs and
    // submerged columns aren't mistaken for an even construction site.
    for (let sx = 0; sx <= FORTRESS_SIZE; sx += 8) {
      for (let sz = 0; sz <= FORTRESS_SIZE; sz += 8) {
        const elevation = sample(x + sx, z + sz).terrainHeight;
        low = Math.min(low, elevation);
        high = Math.max(high, elevation);
      }
    }
    if (low <= SEA_LEVEL + 2 || high - low > 7 || high + 20 >= CHUNK_HEIGHT) continue;
    return { x, z, y: high + 2 };
  }
  return null;
}
