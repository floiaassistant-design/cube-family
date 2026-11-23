import type { Vec3 } from "../../player/physics";
import { siegePath, type FortressLocation, type SiegeRoute } from "./fortress";

export const MAX_SIEGE_ZOMBIES = 18;
const ROUTES: readonly SiegeRoute[] = ["south", "west", "north", "east"];
export type SiegePhase = "idle" | "preparation" | "wave" | "intermission" | "victory" | "defeat";
export type ZombieVariant = "normal" | "runner" | "armored" | "boss";

export interface SiegeZombie {
  readonly kind: "siege-zombie";
  readonly id: string;
  position: Vec3;
  health: number;
  readonly maxHealth: number;
  readonly variant: ZombieVariant;
  moving: boolean;
  route: SiegeRoute;
  waypoint: number;
  attackClock: number;
}

export interface SiegeOptions {
  readonly waves: number;
  readonly difficulty: "easy" | "normal" | "hard";
}

export interface SiegeReport {
  readonly phase: SiegePhase;
  readonly wave: number;
  readonly totalWaves: number;
  readonly crystal: number;
  readonly maxCrystal: number;
  readonly kills: number;
  readonly pending: number;
  readonly arrows: number;
  readonly timer: number;
}

export class SiegeController {
  private readonly site: FortressLocation;
  private readonly sampler: (x: number, z: number) => number;
  private readonly enemies = new Map<string, SiegeZombie>();
  private phase: SiegePhase = "idle";
  private wave = 0;
  private clock = 0;
  private budget = 0;
  private spawned = 0;
  private nextSpawn = 0;
  private crystal = 600;
  private kills = 0;
  private arrows = 32;
  private lastMelee = -1;
  private lastArrow = -1;
  private currentDifficulty: SiegeOptions["difficulty"] = "normal";
  private totalWaves = 10;
  private sequence = 0;

  constructor(site: FortressLocation, sampleGround: (x: number, z: number) => number) {
    this.site = site;
    this.sampler = sampleGround;
  }

  get active(): boolean {
    return this.phase === "preparation" || this.phase === "wave" || this.phase === "intermission";
  }

  get zombies(): readonly SiegeZombie[] {
    return [...this.enemies.values()];
  }

  get report(): SiegeReport {
    return {
      phase: this.phase,
      wave: this.wave,
      totalWaves: this.totalWaves,
      crystal: this.crystal,
      maxCrystal: 600,
      kills: this.kills,
      pending: Math.max(0, this.budget - this.spawned) + this.enemies.size,
      arrows: this.arrows,
      timer: Math.ceil(this.clock),
    };
  }

  start(options: SiegeOptions = { waves: 10, difficulty: "normal" }): void {
    if (![5, 10, 20].includes(options.waves)) throw new Error("Invalid number of waves");
    if (!["easy", "normal", "hard"].includes(options.difficulty))
      throw new Error("Invalid difficulty");
    this.phase = "preparation";
    this.totalWaves = options.waves;
    this.currentDifficulty = options.difficulty;
    this.wave = 0;
    this.clock = 20;
    this.spawned = 0;
    this.budget = 0;
    this.crystal = 600;
    this.kills = 0;
    this.arrows = 32;
    this.lastArrow = -1;
    this.lastMelee = -1;
    this.sequence = 0;
    this.enemies.clear();
  }

  stop(): void {
    this.phase = "idle";
    this.enemies.clear();
    this.clock = 0;
  }

  private beginWave(): void {
    this.phase = "wave";
    this.wave++;
    const factor =
      this.currentDifficulty === "easy" ? 0.72 : this.currentDifficulty === "hard" ? 1.35 : 1;
    this.budget = Math.ceil((4 + this.wave * 2) * factor);
    this.spawned = 0;
    this.nextSpawn = 0;
    this.clock = 0;
    this.arrows = Math.min(64, this.arrows + 24);
  }

  private spawn(): void {
    const route = ROUTES[this.sequence % ROUTES.length] ?? "south";
    const variant: ZombieVariant =
      (this.wave === 5 || this.wave === this.totalWaves) && this.spawned === this.budget - 1
        ? "boss"
        : this.wave >= 6 && this.spawned % 4 === 0
          ? "armored"
          : this.wave >= 3 && this.spawned % 3 === 0
            ? "runner"
            : "normal";
    const path = siegePath(this.site, route);
    const firstPoint = path[0];
    if (!firstPoint) return;
    const { x, z } = firstPoint;
    const maxHealth =
      variant === "boss" ? 35 : variant === "armored" ? 12 : variant === "runner" ? 5 : 8;
    const id = `siege:${(this.sequence++).toString()}`;
    this.enemies.set(id, {
      id,
      kind: "siege-zombie",
      health: maxHealth,
      maxHealth,
      variant,
      position: { x, y: this.sampler(x, z) + 1, z },
      moving: false,
      route,
      waypoint: 1,
      attackClock: 0,
    });
    this.spawned++;
  }

  /** Non-blocking fixed-budget enemies, no edits to the permanent voxel world. */
  update(dt: number): void {
    if (!this.active) return;
    const step = Math.max(0, Math.min(dt, 0.1));
    if (this.phase === "preparation" || this.phase === "intermission") {
      this.clock -= step;
      if (this.clock <= 0) this.beginWave();
      return;
    }
    this.clock += step;
    this.nextSpawn -= step;
    if (
      this.spawned < this.budget &&
      this.enemies.size < MAX_SIEGE_ZOMBIES &&
      this.nextSpawn <= 0
    ) {
      this.spawn();
      this.nextSpawn = 0.75;
    }
    for (const enemy of this.enemies.values()) {
      const path = siegePath(this.site, enemy.route);
      const target = path[enemy.waypoint];
      if (!target) {
        enemy.moving = false;
        enemy.attackClock -= step;
        if (enemy.attackClock <= 0) {
          enemy.attackClock = 1.3;
          this.crystal = Math.max(0, this.crystal - (enemy.variant === "boss" ? 22 : 9));
        }
        continue;
      }
      const dx = target.x - enemy.position.x;
      const dz = target.z - enemy.position.z;
      const distance = Math.hypot(dx, dz);
      const speed =
        (enemy.variant === "runner" ? 2.2 : enemy.variant === "boss" ? 0.85 : 1.35) * step;
      if (distance <= speed + 0.05) {
        enemy.position = {
          x: target.x,
          z: target.z,
          y: this.ground(target.x, target.z),
        };
        enemy.waypoint++;
      } else {
        const x = enemy.position.x + (dx / distance) * speed;
        const z = enemy.position.z + (dz / distance) * speed;
        enemy.position = { x, z, y: this.ground(x, z) };
      }
      enemy.moving = true;
    }
    if (this.crystal <= 0) {
      this.phase = "defeat";
      this.enemies.clear();
    } else if (this.spawned >= this.budget && this.enemies.size === 0) {
      if (this.wave >= this.totalWaves) this.phase = "victory";
      else {
        this.phase = "intermission";
        this.clock = 12;
      }
    }
  }

  private ground(x: number, z: number): number {
    // Courtyard and approach roads belong to the fortress's level.
    if (
      x >= this.site.x - 9 &&
      x <= this.site.x + 104 &&
      z >= this.site.z - 9 &&
      z <= this.site.z + 104
    )
      return this.site.y + 1;
    return this.sampler(x, z) + 1;
  }

  /** Player sword — existing interaction's close-range raycast selects the enemy. */
  melee(enemy: SiegeZombie, damage: number, now: number): boolean {
    if (this.phase !== "wave" || now - this.lastMelee < 0.45 || !this.enemies.has(enemy.id))
      return false;
    this.lastMelee = now;
    this.damage(enemy, Math.max(1, Math.min(6, damage)));
    return true;
  }

  /** Virtual arrow: the same aim works from mouse, gamepad and touch. */
  shoot(
    origin: Vec3,
    direction: Vec3,
    now: number,
    clear: (from: Vec3, to: Vec3) => boolean,
  ): boolean {
    if (this.phase !== "wave" || now - this.lastArrow < 0.8 || this.arrows <= 0) return false;
    this.lastArrow = now;
    this.arrows--;
    const unit = Math.hypot(direction.x, direction.y, direction.z);
    if (unit < 0.1) return true;
    let selected: SiegeZombie | null = null;
    let nearest = 34;
    for (const enemy of this.enemies.values()) {
      const center = { x: enemy.position.x, y: enemy.position.y + 0.95, z: enemy.position.z };
      const dx = center.x - origin.x;
      const dy = center.y - origin.y;
      const dz = center.z - origin.z;
      const dot = (dx * direction.x + dy * direction.y + dz * direction.z) / unit;
      if (dot <= 0 || dot >= nearest) continue;
      const miss = dx * dx + dy * dy + dz * dz - dot * dot;
      if (miss > (enemy.variant === "boss" ? 1.1 : 0.56) ** 2 || !clear(origin, center)) continue;
      selected = enemy;
      nearest = dot;
    }
    if (selected) this.damage(selected, 4);
    return true;
  }

  /** A simple shared-resource repair between waves. */
  repair(): boolean {
    if (this.phase !== "intermission" || this.kills < 5 || this.crystal >= 600) return false;
    this.kills -= 5;
    this.crystal = Math.min(600, this.crystal + 90);
    return true;
  }

  private damage(enemy: SiegeZombie, amount: number): void {
    enemy.health -= amount;
    if (enemy.health > 0) return;
    this.enemies.delete(enemy.id);
    this.kills++;
  }
}
