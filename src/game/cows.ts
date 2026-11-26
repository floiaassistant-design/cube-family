import { aabbFromFeetPosition, type Vec3 } from "../player/physics";
import { hash3 } from "../world/terrain";

export const MAX_COWS = 6;
export const COW_WIDTH = 1.32;
export const COW_HEIGHT = 1.75;
const PASTURE_CELL = 16;
const RANGE = 25;
const CYCLE = 15;

export interface Cow {
  readonly id: string;
  readonly kind: "cow";
  position: Vec3;
  action: "Idle" | "Walk" | "Graze";
  moving: boolean;
}

export interface CowTerrain {
  /** Open, dry pasture at the surface. */
  pasture(x: number, z: number): number | null;
  /** A position the cow's body can actually reach. */
  stand(x: number, z: number, y: number): number | null;
}

interface PastureCow extends Cow {
  readonly home: Vec3;
  readonly phase: number;
  readonly bearing: number;
}

export class CowHerd {
  private readonly cows = new Map<string, PastureCow>();
  private elapsed = 0;
  private nextScan = 0;
  private readonly seed: number;
  private readonly terrain: CowTerrain;

  constructor(seed: number, terrain: CowTerrain) {
    this.seed = seed;
    this.terrain = terrain;
  }

  values(): Iterable<Cow> {
    return this.cows.values();
  }

  occupies(x: number, y: number, z: number): boolean {
    for (const { position } of this.cows.values()) {
      const { min, max } = aabbFromFeetPosition(position, COW_WIDTH, COW_HEIGHT);
      if (x < max.x && x + 1 > min.x && y < max.y && y + 1 > min.y && z < max.z && z + 1 > min.z)
        return true;
    }
    return false;
  }

  private roll(x: number, attempt: number, z: number): number {
    return (hash3(this.seed ^ 0xc075, x, attempt, z) >>> 0) / 0x100000000;
  }

  private checkPastures(player: Vec3, daylight: boolean): void {
    for (const [id, cow] of this.cows) {
      const { x, y, z } = cow.position;
      if (Math.hypot(player.x - x, player.y - y, player.z - z) > RANGE + 7) {
        this.cows.delete(id);
      }
    }
    if (!daylight) return;
    const gx = Math.floor(player.x / PASTURE_CELL);
    const gz = Math.floor(player.z / PASTURE_CELL);
    for (let i = gx - 1; i <= gx + 1; i++) {
      for (let j = gz - 1; j <= gz + 1; j++) {
        if (this.cows.size >= MAX_COWS) return;
        const id = `cow:${i.toString()}:${j.toString()}`;
        if (this.cows.has(id)) continue;
        for (let attempt = 0; attempt < 5; attempt++) {
          const x = (i + this.roll(i, attempt, j)) * PASTURE_CELL;
          const z = (j + this.roll(i, attempt + 5, j)) * PASTURE_CELL;
          const distance = Math.hypot(player.x - x, player.z - z);
          if (distance < 3 || distance > RANGE - 3) continue;
          const y = this.terrain.pasture(x, z);
          if (y === null || Math.abs(y - player.y) > 8) continue;
          const position = { x, y, z };
          this.cows.set(id, {
            id,
            kind: "cow",
            position,
            home: position,
            moving: false,
            action: "Idle",
            phase: this.roll(i, 10, j) * CYCLE,
            bearing: this.roll(i, 11, j) * 2 * Math.PI,
          });
          break;
        }
      }
    }
  }

  update(dt: number, player: Vec3, daylight: boolean): void {
    this.elapsed += dt;
    if (this.elapsed >= this.nextScan) {
      this.nextScan = this.elapsed + 1;
      this.checkPastures(player, daylight);
    }
    for (const [id, cow] of this.cows) {
      const clock = this.elapsed + cow.phase;
      const phase = clock % CYCLE;
      const { x, y, z } = cow.position;
      // A removed floor should make the cow settle down, just as it does during a step.
      const floor = this.terrain.stand(x, z, y);
      if (floor === null) {
        cow.position = { x, y: y - dt * 4, z };
        cow.moving = false;
        cow.action = "Idle";
        if (cow.position.y < 1) this.cows.delete(id);
        continue;
      }
      if (floor < y) cow.position = { x, y: floor, z };
      cow.moving = false;
      cow.action = phase > 7 ? "Graze" : "Idle";
      if (phase < 2 || phase > 7) continue;
      const angle = cow.bearing + Math.floor(clock / CYCLE) * 2.4;
      const dx = cow.home.x + Math.cos(angle) * 3.5 - x;
      const dz = cow.home.z + Math.sin(angle) * 3.5 - z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) continue;
      const length = Math.min(distance, dt);
      const nextX = x + (dx / distance) * length;
      const nextZ = z + (dz / distance) * length;
      const nextY = this.terrain.stand(nextX, nextZ, cow.position.y);
      if (nextY === null) continue;
      cow.position = { x: nextX, y: nextY, z: nextZ };
      cow.moving = true;
      cow.action = "Walk";
    }
  }
}
