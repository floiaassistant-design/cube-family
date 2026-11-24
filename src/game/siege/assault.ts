import type { FortressLocation } from "./fortress";

/** All attackers converge on the south-facing gatehouse. A staging spread
 * makes a visible horde without forcing creatures through the stone walls. */
export const SIEGE_FRONT = "south" as const;
export const MAX_SIEGE_ZOMBIES = 48;
export const OUTER_GATE_MAX_HEALTH = 320;
export const INNER_GATE_MAX_HEALTH = 240;

export type SiegeGateId = "outer" | "inner";
export interface GateHealth {
  readonly health: number;
  readonly maxHealth: number;
}

export interface GateVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Physical (temporary) doors sit inside the existing six-block-high openings.
 * The fortress blueprint and all existing saved block IDs are unchanged. */
export function siegeGateVoxels(site: FortressLocation, gate: SiegeGateId): GateVoxel[] {
  const z = site.z + (gate === "outer" ? 2 : 15);
  const blocks: GateVoxel[] = [];
  for (let y = 1; y <= 5; y++) {
    for (let x = 44; x <= 51; x++) {
      blocks.push({ x: site.x + x, y: site.y + y, z });
    }
  }
  return blocks;
}

export interface SiegeWaypoint {
  readonly x: number;
  readonly z: number;
}

/** Index 1 waits outside the first gate, index 3 outside the second.
 * Only lane -3..3 can pass through the two 8-wide gate openings. */
export function southAssaultPath(
  site: FortressLocation,
  lane: number,
  spread: number,
  row: number,
): readonly SiegeWaypoint[] {
  const gateX = site.x + 47.5 + Math.max(-3, Math.min(3, lane));
  const point = (x: number, z: number): SiegeWaypoint => ({ x, z: site.z + z + 0.5 });
  return [
    point(site.x + 47 + spread + 0.5, -16 - row * 3),
    point(gateX, -3),
    point(gateX, 7),
    point(gateX, 12),
    point(gateX, 18),
    point(gateX, 37),
    point(site.x + 47.5, 47),
  ];
}

/** Stable, deterministic formation from the zombie sequence number. */
export function assaultFormation(sequence: number): {
  readonly lane: number;
  readonly spread: number;
  readonly row: number;
} {
  return {
    lane: (sequence % 7) - 3,
    spread: (sequence % 25) - 12,
    row: Math.floor(sequence / 25) % 4,
  };
}
