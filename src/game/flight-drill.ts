import { DragonMount, type DragonInput } from "./dragon";
import { aabbFromFeetPosition, forwardVector, rightVector, type Vec3 } from "../player/physics";
import { raycastVoxels } from "../player/raycast";
import { BlockId } from "../world/blocks";
import { CHUNK_HEIGHT, worldToChunk } from "../world/coords";
import type { World } from "../world/world";

export type DrillSize = 1 | 3 | 5;
export const DRILL_AXIS_HEIGHT = 1.24;
const DRILL_REACH = 3.65;
const FIRST_CUT = 0.68;
const MAX_PITCH = 1.1;
const CUT_INTERVAL = 0.12;

export interface DrillEdit extends Vec3 {
  readonly id: typeof BlockId.AIR;
}

/** Shared origin and basis for cutting, aiming and the mounted headlamp. */
export function drillAxis(position: Vec3, yaw: number, pitch: number) {
  const angle = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  const forward = forwardVector(yaw);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    origin: { ...position, y: position.y + DRILL_AXIS_HEIGHT },
    direction: { x: forward.x * cos, y: sin, z: forward.z * cos },
    right: rightVector(yaw),
    up: { x: -forward.x * sin, y: cos, z: -forward.z * sin },
  };
}

type DrillWorld = Pick<World, "hasChunk" | "getBlock">;

function loaded(world: DrillWorld, x: number, y: number, z: number): boolean {
  return y >= 1 && y < CHUNK_HEIGHT && world.hasChunk(worldToChunk(x), worldToChunk(z));
}

function firstCut(world: DrillWorld, origin: Vec3, direction: Vec3) {
  const start = {
    x: origin.x + direction.x * FIRST_CUT,
    y: origin.y + direction.y * FIRST_CUT,
    z: origin.z + direction.z * FIRST_CUT,
  };
  return raycastVoxels(
    start,
    direction,
    DRILL_REACH - FIRST_CUT,
    (x, y, z) => !loaded(world, x, y, z) || world.getBlock(x, y, z) !== BlockId.AIR,
  );
}

/** Find the first obstruction along each parallel ray across the cutter. */
export function planDrilling(
  world: DrillWorld,
  position: Vec3,
  yaw: number,
  pitch: number,
  size: DrillSize,
  budget = 8,
): DrillEdit[] {
  if (budget <= 0) return [];
  const { origin, direction, right, up } = drillAxis(position, yaw, pitch);
  const cells = new Map<string, { edit: DrillEdit; distance: number }>();
  const radius = (size - 1) / 2;
  for (let row = -radius; row <= radius; row++) {
    for (let column = -radius; column <= radius; column++) {
      const rayOrigin = {
        x: origin.x + right.x * column + up.x * row,
        y: origin.y + up.y * row,
        z: origin.z + right.z * column + up.z * row,
      };
      const hit = firstCut(world, rayOrigin, direction);
      if (!hit) continue;
      const { blockX: x, blockY: y, blockZ: z, distance } = hit;
      if (!loaded(world, x, y, z)) continue;
      const block = world.getBlock(x, y, z);
      if (block === BlockId.WATER || block === BlockId.BEDROCK) continue;
      const key = `${x.toString()},${y.toString()},${z.toString()}`;
      if ((cells.get(key)?.distance ?? Infinity) > distance) {
        cells.set(key, { edit: { x, y, z, id: BlockId.AIR }, distance });
      }
    }
  }
  return [...cells.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, budget)
    .map(({ edit }) => edit);
}

/** The drill inherits parking and collisions but steers like a hovercraft. */
export class FlyingDrill extends DragonMount {
  private readonly drillWorld: World;
  private elapsed = 0;
  private continuous = false;
  triggerHeld = false;
  pitch = 0;
  size: DrillSize = 3;
  onExcavate: ((edits: readonly DrillEdit[]) => void) | undefined;

  constructor(drillWorld: World) {
    super(drillWorld);
    this.drillWorld = drillWorld;
  }

  get drilling(): boolean {
    return this.continuous || this.triggerHeld;
  }

  toggleDrilling(): void {
    this.continuous = !this.continuous;
  }

  stopDrilling(): void {
    this.continuous = false;
    this.triggerHeld = false;
    this.elapsed = 0;
  }

  protected override bodyBounds(position: Vec3) {
    return aabbFromFeetPosition(position, 1.65, 2.4);
  }

  override seat(position: Vec3): Vec3 {
    return { ...position, y: position.y + 1.65 };
  }

  override mountedCamera(position: Vec3, yaw: number, pitch: number, aspect: number) {
    const { origin, direction } = drillAxis(position, yaw, pitch);
    const hit = firstCut(this.drillWorld, origin, direction);
    const aimDistance = hit ? hit.distance + FIRST_CUT + 0.02 : DRILL_REACH;
    const aim = {
      x: origin.x + direction.x * aimDistance,
      y: origin.y + direction.y * aimDistance,
      z: origin.z + direction.z * aimDistance,
    };
    const heading = forwardVector(yaw);
    const back = { x: -heading.x * 0.8, y: 0.6, z: -heading.z * 0.8 };
    const distance = this.cameraDistance(origin, back, aspect < 1 ? 8 : 6.5);
    const camera = {
      x: origin.x + back.x * distance,
      y: origin.y + back.y * distance,
      z: origin.z + back.z * distance,
    };
    return {
      position: camera,
      yaw,
      pitch: Math.atan2(aim.y - camera.y, Math.hypot(aim.x - camera.x, aim.z - camera.z)),
      distance,
    };
  }

  protected override movementHeading(dt: number, input: DragonInput | null): Vec3 {
    if (!input) return super.movementHeading(dt, input);
    const { forward, right } = input;
    const amount = Math.hypot(forward, right) || 1;
    const heading = forwardVector(this.yaw);
    const side = rightVector(this.yaw);
    return {
      x: (heading.x * forward + side.x * right) / amount,
      y: 0,
      z: (heading.z * forward + side.z * right) / amount,
    };
  }

  protected override flightVerticalTarget(
    input: DragonInput | null,
    _moving: boolean,
    canClimb: boolean,
  ) {
    if (input?.jump && canClimb) return 6.5;
    if (input?.descend) return -6.5;
    const forward = Math.max(0, input?.forward ?? 0);
    return this.drilling ? Math.sin(this.pitch) * forward * 6.5 : 0;
  }

  cycleSize(): DrillSize {
    this.size = this.size === 1 ? 3 : this.size === 3 ? 5 : 1;
    return this.size;
  }

  override step(dt: number, input: DragonInput | null): void {
    if (input) {
      this.yaw = input.yaw;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, input.pitch ?? 0));
    }
    if (this.drilling && input && this.position) {
      if (this.elapsed === 0 || this.elapsed >= CUT_INTERVAL) {
        this.elapsed = 0;
        const edits = planDrilling(this.drillWorld, this.position, this.yaw, this.pitch, this.size);
        if (edits.length > 0) this.onExcavate?.(edits);
      }
      this.elapsed += dt;
    } else {
      this.elapsed = 0;
    }
    super.step(dt, input);
  }
}
