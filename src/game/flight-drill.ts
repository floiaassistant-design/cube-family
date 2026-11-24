import { DragonMount, type DragonInput } from "./dragon";
import { aabbFromFeetPosition, forwardVector, rightVector, type Vec3 } from "../player/physics";
import { BlockId } from "../world/blocks";
import { CHUNK_HEIGHT, worldToChunk } from "../world/coords";
import type { World } from "../world/world";

export type DrillSize = 1 | 3 | 5;
export interface DrillInput extends DragonInput {
  readonly pitch?: number;
}
export interface DrillEdit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly id: typeof BlockId.AIR;
}

/** A cross-section perpendicular to the drill's heading, even on steep climbs. */
export function drillTargets(center: Vec3, yaw: number, pitch: number, size: DrillSize): Vec3[] {
  const tilt = Math.max(-1.35, Math.min(1.35, pitch));
  const forward = forwardVector(yaw);
  const right = rightVector(yaw);
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const tip = {
    x: center.x + forward.x * c * 2.15,
    y: center.y + 1.25 - s * 2.15,
    z: center.z + forward.z * c * 2.15,
  };
  const cells = new Map<string, Vec3>();
  const radius = (size - 1) / 2;
  for (let vertical = -radius; vertical <= radius; vertical++) {
    for (let horizontal = -radius; horizontal <= radius; horizontal++) {
      const x = Math.floor(tip.x + right.x * horizontal + forward.x * s * vertical);
      const y = Math.floor(tip.y + c * vertical);
      const z = Math.floor(tip.z + right.z * horizontal + forward.z * s * vertical);
      cells.set(x.toString() + "," + y.toString() + "," + z.toString(), { x, y, z });
    }
  }
  return [...cells.values()];
}

/** Calculate edits without generating unknown chunks or changing the world. */
export function planDrilling(
  world: Pick<World, "hasChunk" | "getBlock">,
  position: Vec3,
  yaw: number,
  pitch: number,
  size: DrillSize,
  budget = 8,
): DrillEdit[] {
  if (budget <= 0) return [];
  const edits: DrillEdit[] = [];
  for (const target of drillTargets(position, yaw, pitch, size)) {
    if (target.y < 1 || target.y >= CHUNK_HEIGHT) continue;
    if (!world.hasChunk(worldToChunk(target.x), worldToChunk(target.z))) continue;
    const block = world.getBlock(target.x, target.y, target.z);
    if (block === BlockId.AIR || block === BlockId.WATER) continue;
    edits.push({ ...target, id: BlockId.AIR });
    if (edits.length >= budget) break;
  }
  return edits;
}

/** Creative-only vehicle: reuse mature mounted flight, not the dragon's AI or renderer. */
export class FlyingDrill extends DragonMount {
  private readonly drillWorld: World;
  private accumulator = 0;
  drilling = false;
  pitch = 0;
  size: DrillSize = 3;
  onExcavate: ((edits: readonly DrillEdit[]) => void) | undefined;

  constructor(world: World) {
    super(world);
    this.drillWorld = world;
  }

  /** A three-block tunnel fits the fuselage; the rotor extends ahead of it. */
  protected override bodyBounds(position: Vec3) {
    return aabbFromFeetPosition(position, 1.75, 2.55);
  }

  cycleSize(): DrillSize {
    this.size = this.size === 1 ? 3 : this.size === 3 ? 5 : 1;
    return this.size;
  }

  override step(dt: number, input: DrillInput | null): void {
    if (input) this.pitch = Math.max(-1.1, Math.min(1.1, input.pitch ?? this.pitch));
    this.accumulator += dt;
    if (this.drilling && input && this.position && this.accumulator >= 0.12) {
      this.accumulator = 0;
      const edits = planDrilling(
        this.drillWorld,
        this.position,
        this.yaw,
        input.pitch ?? 0,
        this.size,
      );
      if (edits.length > 0) this.onExcavate?.(edits);
    } else if (!this.drilling || !input) {
      this.accumulator = 0;
    }
    // During boring, forward thrust follows the nose: look up to climb,
    // look down to descend. Manual ascent/descent always take precedence.
    const steer =
      this.drilling && input && input.forward > 0.1
        ? {
            ...input,
            jump: input.jump || this.pitch < -0.2,
            descend: input.descend || (!input.jump && this.pitch > 0.2),
          }
        : input;
    super.step(dt, steer);
  }
}
