import {
  aabbFromFeetPosition,
  aabbIntersectsSolid,
  forwardVector,
  GRAVITY,
  moveAndCollide,
  PLAYER_EYE_HEIGHT,
  rightVector,
  TERMINAL_VELOCITY,
  type PlayerPhysicsState,
  type Vec3,
} from "../player/physics";
import { raycastVoxels } from "../player/raycast";
import { BlockId, isSolid } from "../world/blocks";
import { CHUNK_HEIGHT, worldToChunk } from "../world/coords";
import type { World } from "../world/world";

export const DRAGON_SCALE = 0.56;
export const DRAGON_FOOT_OFFSET = 0.06;
export const DRAGON_SEAT_HEIGHT = (4.08 - DRAGON_FOOT_OFFSET) * DRAGON_SCALE;
const BODY_WIDTH = 2.5;
const BODY_HEIGHT = 4.1;
const MOUNT_REACH = 5.5;
const MAX_ALTITUDE = CHUNK_HEIGHT + 48;
const ZERO = { x: 0, y: 0, z: 0 };

export interface DragonParking extends Vec3 {
  readonly yaw: number;
}

export interface DragonInput {
  readonly forward: number;
  readonly right: number;
  readonly yaw: number;
  readonly jump: boolean;
  readonly descend: boolean;
  readonly sprint: boolean;
}

const bodyBounds = (position: Vec3) => aabbFromFeetPosition(position, BODY_WIDTH, BODY_HEIGHT);

export class DragonMount {
  private readonly world: World;
  private state: PlayerPhysicsState | null = null;
  private previous: Vec3 | null = null;
  private lastParking: DragonParking | undefined;
  private lastExit: Vec3 | undefined;
  yaw = 0;
  flying = false;

  constructor(world: World) {
    this.world = world;
  }

  get position(): Vec3 | null {
    return this.state?.position ?? null;
  }

  get velocity(): Vec3 {
    return this.state?.velocity ?? ZERO;
  }

  get grounded(): boolean {
    return this.state?.onGround === true;
  }

  get parking(): DragonParking | undefined {
    return this.lastParking;
  }

  get savedRiderPosition(): Vec3 | undefined {
    return this.lastExit;
  }

  seat(position: Vec3): Vec3 {
    return { ...position, y: position.y + DRAGON_SEAT_HEIGHT };
  }

  interpolatedPosition(alpha: number): Vec3 | null {
    if (!this.position || !this.previous) return this.position;
    const p = this.position;
    const q = this.previous;
    return {
      x: q.x + (p.x - q.x) * alpha,
      y: q.y + (p.y - q.y) * alpha,
      z: q.z + (p.z - q.z) * alpha,
    };
  }

  private readonly loaded = (x: number, z: number): boolean =>
    this.world.hasChunk(worldToChunk(x), worldToChunk(z));

  private readonly solid = (x: number, y: number, z: number): boolean =>
    isSolid(this.world.getBlock(x, y, z));

  /** Water and chunk edges stop the hull but never qualify as a dry landing. */
  private readonly obstacle = (x: number, y: number, z: number): boolean =>
    !this.loaded(x, z) ||
    y < 0 ||
    this.solid(x, y, z) ||
    this.world.getBlock(x, y, z) === BlockId.WATER;

  private hasDryFooting(position: Vec3): boolean {
    const slab = bodyBounds({ ...position, y: position.y - 0.08 });
    return aabbIntersectsSolid({ min: slab.min, max: { ...slab.max, y: position.y } }, this.solid);
  }

  private canPark(position: Vec3): boolean {
    return (
      !aabbIntersectsSolid(bodyBounds(position), this.obstacle) && this.hasDryFooting(position)
    );
  }

  /** Try the saved spot first, then dry clearings within walking distance of spawn. */
  spawn(
    origin: Pick<Vec3, "x" | "z">,
    terrainY: (x: number, z: number) => number,
    saved?: DragonParking,
  ): boolean {
    if (this.state) return true;
    if (saved && this.canPark(saved) && this.findExit(saved, saved.yaw)) {
      this.park(saved);
      return true;
    }

    const candidates: { position: DragonParking; score: number }[] = [];
    const originY = terrainY(Math.floor(origin.x), Math.floor(origin.z));
    for (let x = -20; x <= 20; x += 2) {
      for (let z = -20; z <= 20; z += 2) {
        const distance = Math.hypot(x, z);
        if (distance < 7 || distance > 21) continue;
        const px = origin.x + x;
        const pz = origin.z + z;
        const y = terrainY(Math.floor(px), Math.floor(pz));
        const position = { x: px, y, z: pz, yaw: Math.atan2(x, z) + Math.PI / 3 };
        // A clearing at the player's level is easier to reach. Favor the
        // starting view if two clearings offer a similar approach.
        const score = distance + Math.abs(y - originY) * 3 + Math.hypot(x, z + 8) * 0.2;
        candidates.push({ position, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const candidate = candidates.find(
      ({ position }) => this.canPark(position) && this.findExit(position, position.yaw),
    );
    if (!candidate) return false;
    this.park(candidate.position);
    return true;
  }

  private park(position: DragonParking): void {
    this.state = { position, velocity: ZERO, onGround: true };
    this.previous = position;
    this.yaw = position.yaw;
    this.lastParking = position;
  }

  /** Return the dragon to dry ground when the rider retreats from combat. */
  returnToParking(): void {
    this.flying = false;
    if (this.lastParking) this.park(this.lastParking);
  }

  canMount(position: Vec3): boolean {
    if (!this.state?.onGround) return false;
    const seat = this.seat(this.state.position);
    const eye = { ...position, y: position.y + PLAYER_EYE_HEIGHT };
    const direction = { x: seat.x - eye.x, y: seat.y - eye.y, z: seat.z - eye.z };
    const distance = Math.hypot(direction.x, direction.y, direction.z);
    return (
      distance <= MOUNT_REACH &&
      !raycastVoxels(eye, direction, distance, this.solid) &&
      this.safeExit() !== null
    );
  }

  safeExit(): Vec3 | null {
    const p = this.position;
    if (!p || this.flying || !this.grounded) return null;
    return this.findExit(p, this.yaw);
  }

  private findExit(p: Vec3, yaw: number): Vec3 | null {
    const f = forwardVector(yaw);
    const r = rightVector(yaw);
    for (const distance of [2.25, 3.25, 4.25]) {
      for (const direction of [r, { x: -r.x, z: -r.z }, { x: -f.x, z: -f.z }, f]) {
        const x = p.x + direction.x * distance;
        const z = p.z + direction.z * distance;
        const columnX = Math.floor(x);
        const columnZ = Math.floor(z);
        for (const offset of [0, 1, -1, -2]) {
          const y = Math.round(p.y) + offset;
          const exit = { x, y, z };
          if (
            this.solid(columnX, y - 1, columnZ) &&
            !aabbIntersectsSolid(aabbFromFeetPosition(exit), this.obstacle)
          ) {
            const seat = this.seat(p);
            const delta = { x: x - seat.x, y: y + PLAYER_EYE_HEIGHT - seat.y, z: z - seat.z };
            if (!raycastVoxels(seat, delta, Math.hypot(delta.x, delta.y, delta.z), this.solid)) {
              return exit;
            }
          }
        }
      }
    }
    return null;
  }

  recordParking(): void {
    const position = this.position;
    if (!position || !this.canPark(position)) return;
    const exit = this.safeExit();
    if (!exit) return;
    this.lastExit = exit;
    this.lastParking = { ...position, yaw: this.yaw };
  }

  occupiesBlock(x: number, y: number, z: number): boolean {
    if (!this.position) return false;
    const { min, max } = bodyBounds(this.position);
    return x < max.x && x + 1 > min.x && y < max.y && y + 1 > min.y && z < max.z && z + 1 > min.z;
  }

  private cameraDistance(origin: Vec3, direction: Vec3, distance: number): number {
    const hit = raycastVoxels(origin, direction, distance, this.obstacle);
    return hit ? Math.max(0, hit.distance - 0.22) : distance;
  }

  /** A rear three-quarter view keeps the rider in front of the camera and
   * the head beyond the saddle, even when steering with the view turned. */
  mountedCamera(position: Vec3, lookYaw: number, lookPitch: number, aspect: number) {
    const seat = this.seat(position);
    const focus = { ...seat, y: seat.y + 0.6 };
    const relative = lookYaw - this.yaw;
    const orbit = Math.max(
      -1.08,
      Math.min(1.08, Math.atan2(Math.sin(relative), Math.cos(relative)) + 0.5),
    );
    const pitch = Math.max(-0.69, Math.min(-0.19, lookPitch - 0.42));
    const wantedDistance = aspect < 1 ? 8.6 : 7.7;
    const shot = (yaw: number, tilt: number) => {
      const direction = forwardVector(yaw);
      const back = {
        x: -direction.x * Math.cos(tilt),
        y: -Math.sin(tilt),
        z: -direction.z * Math.cos(tilt),
      };
      const distance = this.cameraDistance(focus, back, wantedDistance);
      return {
        yaw,
        pitch: tilt,
        distance,
        position: {
          x: focus.x + back.x * distance,
          y: focus.y + back.y * distance,
          z: focus.z + back.z * distance,
        },
      };
    };
    let best = shot(this.yaw + orbit, pitch);
    if (best.distance < 4.8) {
      // Try the other shoulder and a higher view before moving close to the saddle.
      for (const offset of [-0.93, 0.93, 0]) {
        const alternative = shot(this.yaw + offset, -0.67);
        if (alternative.distance > best.distance) best = alternative;
        if (best.distance >= wantedDistance) break;
      }
    }
    return best;
  }

  step(dt: number, input: DragonInput | null): void {
    const state = this.state;
    if (!state) return;
    this.previous = state.position;
    const p = state.position;

    // Idle mounts still settle if the player removes the ground beneath them.
    if (!input && this.flying) return;
    if (!input && state.onGround && this.hasDryFooting(p)) return;
    if (
      state.onGround &&
      input?.jump &&
      !aabbIntersectsSolid(bodyBounds({ ...p, y: p.y + 0.05 }), this.obstacle)
    ) {
      this.recordParking();
      this.flying = true;
    }

    const f = forwardVector(input?.yaw ?? this.yaw);
    const r = rightVector(input?.yaw ?? this.yaw);
    const forward = input?.forward ?? 0;
    const right = input?.right ?? 0;
    const amount = Math.min(1, Math.hypot(forward, right));
    const wantsMove = amount > 0.025;
    if (wantsMove) {
      const target = Math.atan2(-(f.x * forward + r.x * right), -(f.z * forward + r.z * right));
      const difference = target - this.yaw;
      const turn = Math.atan2(Math.sin(difference), Math.cos(difference));
      const limit = dt * (this.flying ? 2.5 : 4.5);
      this.yaw += Math.max(-limit, Math.min(limit, turn));
    }

    const heading = forwardVector(this.yaw);
    const speed = this.flying ? (input?.sprint ? 17 : 12) : input?.sprint ? 7.8 : 5.2;
    const ease = 1 - Math.exp(-dt * (this.flying ? 4.5 : 11));
    const velocity = {
      x: state.velocity.x + (heading.x * speed * amount - state.velocity.x) * ease,
      y: Math.max(TERMINAL_VELOCITY, state.velocity.y - GRAVITY * dt),
      z: state.velocity.z + (heading.z * speed * amount - state.velocity.z) * ease,
    };
    if (this.flying) {
      const targetY = input?.descend
        ? -6.5
        : input?.jump && p.y < MAX_ALTITUDE
          ? 6.5
          : wantsMove
            ? -0.8
            : 0;
      velocity.y = state.velocity.y + (targetY - state.velocity.y) * (1 - Math.exp(-dt * 7));
      velocity.y = Math.min(velocity.y, (MAX_ALTITUDE - p.y) / dt);
    }

    const dx = velocity.x * dt;
    const dz = velocity.z * dt;
    const move = (from: Vec3, dy: number) =>
      moveAndCollide(from, velocity, dx, dy, dz, this.obstacle, bodyBounds);
    let next = move(p, velocity.y * dt);
    if (
      !this.flying &&
      state.onGround &&
      wantsMove &&
      (Math.abs(next.velocity.x - velocity.x) > 1e-4 ||
        Math.abs(next.velocity.z - velocity.z) > 1e-4)
    ) {
      const raised = { ...p, y: p.y + 1.001 };
      if (!aabbIntersectsSolid(bodyBounds(raised), this.obstacle)) {
        const stepped = move(raised, -1.06);
        if (
          stepped.onGround &&
          this.hasDryFooting(stepped.position) &&
          stepped.position.y > p.y + 0.25
        ) {
          next = stepped;
        }
      }
    }
    const onGround = next.onGround && this.hasDryFooting(next.position);
    this.state = { ...next, onGround };
    if (onGround) this.flying = false;
  }
}
