import type { FortressLocation } from "./fortress";

export const RAVINE_GATES = {
  outer: { z: 8, maxHealth: 320, fr: "Premier rempart", en: "First rampart" },
  inner: { z: 26, maxHealth: 240, fr: "Bastion médian", en: "Middle bastion" },
  keep: { z: 44, maxHealth: 200, fr: "Dernier refuge", en: "Last refuge" },
} as const;
export const RAVINE_PASSAGE = { firstX: 42, lastX: 53, height: 6 } as const;
export const RAVINE_APPROACH_Z = -10;
export const RAVINE_CRYSTAL_Z = 62;
export const RAVINE_WALKWAY = 7;

export function ravineGroundOffset(z: number): number {
  if (z < 16) return 0;
  if (z < 34) return Math.min(3, Math.floor((z - 16) / 2) + 1);
  if (z < 52) return Math.min(6, 4 + Math.floor((z - 34) / 2));
  return Math.min(8, 7 + Math.floor((z - 52) / 2));
}

export function fortressVisit(site: FortressLocation): { x: number; y: number; z: number } {
  return {
    x: site.x + 47.5,
    y: site.y + (site.layout === "ravine" ? RAVINE_WALKWAY : 0) + 1.02,
    z: site.z + (site.layout === "ravine" ? RAVINE_GATES.outer.z + 1.5 : 26.5),
  };
}
