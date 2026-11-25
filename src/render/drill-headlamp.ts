import { drillAxis } from "../game/flight-drill";
import type { SolidQuery, Vec3 } from "../player/physics";
import { raycastVoxels } from "../player/raycast";

export const LAMP_RANGE = 18;
export const LAMP_SLOPE = 0.54;
export const LAMP_GRID = 7;
export const LAMP_SHADOW_BIAS = 0.55;

export interface DrillHeadlamp {
  readonly origin: Vec3;
  readonly direction: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly depth: Float32Array;
}

/** A small angular depth grid gives both renderers the same occlusion data. */
export function drillHeadlamp(
  position: Vec3,
  yaw: number,
  pitch: number,
  solid: SolidQuery,
  depth: Float32Array,
): DrillHeadlamp {
  const axis = drillAxis(position, yaw, pitch);
  const { direction, right, up } = axis;
  const origin = {
    x: axis.origin.x + direction.x * 0.55,
    y: axis.origin.y + direction.y * 0.55,
    z: axis.origin.z + direction.z * 0.55,
  };
  for (let row = 0; row < LAMP_GRID; row++) {
    const v = ((2 * row) / (LAMP_GRID - 1) - 1) * LAMP_SLOPE;
    for (let column = 0; column < LAMP_GRID; column++) {
      const u = ((2 * column) / (LAMP_GRID - 1) - 1) * LAMP_SLOPE;
      const ray = {
        x: direction.x + u * right.x + v * up.x,
        y: direction.y + u * right.y + v * up.y,
        z: direction.z + u * right.z + v * up.z,
      };
      const length = Math.sqrt(1 + u * u + v * v);
      const hit = raycastVoxels(origin, ray, LAMP_RANGE * length, solid);
      depth[row * LAMP_GRID + column] = hit ? hit.distance / length : LAMP_RANGE;
    }
  }
  return { origin, direction, right, up, depth };
}

/** Diffuse intensity at a visible voxel face for the software renderer. */
export function headlampAt(
  lamp: DrillHeadlamp,
  x: number,
  y: number,
  z: number,
  faceAxis: number,
  entering: number,
): number {
  const dx = x - lamp.origin.x;
  const dy = y - lamp.origin.y;
  const dz = z - lamp.origin.z;
  const along = dx * lamp.direction.x + dy * lamp.direction.y + dz * lamp.direction.z;
  if (along <= 0.05 || along >= LAMP_RANGE) return 0;
  const invWidth = 1 / (along * LAMP_SLOPE);
  const u = (dx * lamp.right.x + dy * lamp.right.y + dz * lamp.right.z) * invWidth;
  const v = (dx * lamp.up.x + dy * lamp.up.y + dz * lamp.up.z) * invWidth;
  const radius = u * u + v * v;
  if (radius >= 1) return 0;
  const column = Math.round(((u + 1) * (LAMP_GRID - 1)) / 2);
  const row = Math.round(((v + 1) * (LAMP_GRID - 1)) / 2);
  if (along > (lamp.depth[row * LAMP_GRID + column] ?? LAMP_RANGE) + LAMP_SHADOW_BIAS) return 0;
  const surface = Math.max(0, entering * (faceAxis === 0 ? dx : faceAxis === 1 ? dy : dz));
  const cosine = surface / Math.sqrt(dx * dx + dy * dy + dz * dz);
  const falloff = (1 - radius) * (1 - along / LAMP_RANGE);
  return falloff * falloff * (0.24 + 0.76 * cosine);
}
