import type { FortressLocation } from "./fortress";
import {
  RAVINE_CRYSTAL_Z,
  RAVINE_GATES,
  RAVINE_PASSAGE,
  ravineGroundOffset,
} from "./ravine-layout";

/** All attackers converge on the south-facing gatehouse. A staging spread
 * makes a visible horde without forcing creatures through the stone walls. */
export const SIEGE_FRONT = "south" as const;
export const MAX_SIEGE_ZOMBIES = 48;
export const OUTER_GATE_MAX_HEALTH = 320;
export const INNER_GATE_MAX_HEALTH = 240;

export const SIEGE_GATES = ["outer", "inner", "keep"] as const;
export type SiegeGateId = (typeof SIEGE_GATES)[number];
export interface GateHealth {
  readonly health: number;
  readonly maxHealth: number;
}

export interface GateVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function siegeGateCenter(site: FortressLocation, gate: SiegeGateId): GateVoxel {
  const ravine = site.layout === "ravine";
  const z = ravine ? RAVINE_GATES[gate].z : gate === "outer" ? 2 : 15;
  return { x: site.x + 47, y: site.y + 3 + (ravine ? ravineGroundOffset(z) : 0), z: site.z + z };
}

/** Physical, temporary doors fill the blueprint's matching openings. */
export function siegeGateVoxels(site: FortressLocation, gate: SiegeGateId): GateVoxel[] {
  const ravine = site.layout === "ravine";
  if (!ravine && gate === "keep") return [];
  const center = siegeGateCenter(site, gate);
  const firstX = ravine ? RAVINE_PASSAGE.firstX : 44;
  const lastX = ravine ? RAVINE_PASSAGE.lastX : 51;
  const height = ravine ? RAVINE_PASSAGE.height : 5;
  const blocks: GateVoxel[] = [];
  for (let y = 1; y <= height; y++) {
    for (let x = firstX; x <= lastX; x++) {
      blocks.push({ x: site.x + x, y: center.y - 3 + y, z: center.z });
    }
  }
  return blocks;
}

export interface SiegeWaypoint {
  readonly x: number;
  readonly z: number;
  readonly gate?: SiegeGateId;
}

/** Funnel all attackers through the doors, stopping at each intact barrier. */
export function southAssaultPath(
  site: FortressLocation,
  lane: number,
  spread: number,
  row: number,
): readonly SiegeWaypoint[] {
  const gateX = site.x + 47.5 + Math.max(-3, Math.min(3, lane));
  const point = (x: number, z: number): SiegeWaypoint => ({ x, z: site.z + z + 0.5 });
  const spawn = point(site.x + 47 + spread + 0.5, -16 - row * 3);
  if (site.layout === "ravine") {
    const stages: SiegeWaypoint[] = [];
    for (const gate of SIEGE_GATES) {
      const { z } = RAVINE_GATES[gate];
      stages.push(point(gateX, z - 3), { ...point(gateX, z + 3), gate });
    }
    return [spawn, point(gateX, -9), ...stages, point(site.x + 47.5, RAVINE_CRYSTAL_Z - 2)];
  }
  return [
    spawn,
    point(gateX, -3),
    { ...point(gateX, 7), gate: "outer" },
    point(gateX, 12),
    { ...point(gateX, 18), gate: "inner" },
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
