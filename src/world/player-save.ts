import type { DragonParking } from "../game/dragon";
import { isHandEquipment, type HandEquipment } from "../game/items";
import { CHUNK_HEIGHT } from "./coords";
import type { KeyValueStorage } from "./edit-store";

/** Where the player was, which way they were looking, what time it was
 * and what was on their hotbar — saved per world so coming back picks up
 * exactly where they left off. */
export interface PlayerSave {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly flying: boolean;
  /** Seconds into the day/night cycle. */
  readonly time: number;
  readonly hotbar: readonly number[];
  readonly slot: number;
  /** Optional for saves made before the pick could be selected or put away. */
  readonly pickInHand?: boolean;
  /** Optional new selection; null means a block, undefined means a legacy save. */
  readonly heldEquipment?: HandEquipment | null;
  /** "creative" (everything, unlimited) or "adventure" (gather and craft). */
  readonly mode?: "creative" | "adventure";
  /** Raw saved bag and journal; validated by the classes that own them. */
  readonly bag?: unknown;
  readonly journal?: unknown;
  readonly firstNight?: unknown;
  readonly wildlife?: unknown;
  readonly dragon?: DragonParking | undefined;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readDragon(value: unknown): DragonParking | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { x, y, z, yaw } = value as Partial<Record<keyof DragonParking, unknown>>;
  if (!finite(x) || !finite(y) || !finite(z) || !finite(yaw)) return undefined;
  if (Math.abs(x) > 2 ** 30 || Math.abs(z) > 2 ** 30 || y < 1 || y > CHUNK_HEIGHT + 48) {
    return undefined;
  }
  return { x, y, z, yaw };
}

export function playerSaveKey(seed: number): string {
  return `voxel-world:player:v2:${seed.toString()}`;
}

export function loadPlayerSave(storage: KeyValueStorage | null, seed: number): PlayerSave | null {
  try {
    const raw = storage?.getItem(playerSaveKey(seed));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Record<keyof PlayerSave, unknown>>;
    if (!finite(p.x) || !finite(p.y) || !finite(p.z) || !finite(p.yaw) || !finite(p.pitch)) {
      return null;
    }
    if (!finite(p.time)) return null;
    const hotbar = Array.isArray(p.hotbar) ? p.hotbar.filter(finite) : [];
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      flying: p.flying === true,
      time: p.time,
      hotbar,
      slot: finite(p.slot) ? Math.max(0, Math.min(8, Math.floor(p.slot))) : 0,
      ...(typeof p.pickInHand === "boolean" ? { pickInHand: p.pickInHand } : {}),
      ...(p.heldEquipment === null || isHandEquipment(p.heldEquipment)
        ? { heldEquipment: p.heldEquipment }
        : {}),
      mode: p.mode === "adventure" ? "adventure" : "creative",
      bag: p.bag,
      journal: p.journal,
      ...(p.firstNight === undefined ? {} : { firstNight: p.firstNight }),
      ...(p.wildlife === undefined ? {} : { wildlife: p.wildlife }),
      dragon: readDragon(p.dragon),
    };
  } catch {
    return null; // a corrupt save just means a fresh start
  }
}

export function storePlayerSave(
  storage: KeyValueStorage | null,
  seed: number,
  save: PlayerSave,
): void {
  try {
    storage?.setItem(playerSaveKey(seed), JSON.stringify(save));
  } catch {
    // Storage full or unavailable: nothing to do but carry on.
  }
}
