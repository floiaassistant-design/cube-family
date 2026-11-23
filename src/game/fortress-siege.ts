import type { Vec3 } from "../player/physics";
import type { NightCreature, StrikeResult } from "./wildlife";
import { FORTRESS_CRYSTAL } from "./fortress-blueprint";
import { FORTRESS_GROUND_Y } from "./fortress-arena";

export type SiegePhase = "idle" | "preparation" | "wave" | "intermission" | "victory" | "defeat";
type Route = readonly { x: number; z: number }[];
interface Raider {
  readonly creature: NightCreature;
  readonly route: Route;
  next: number;
  attackCooldown: number;
}

const CORE = { x: FORTRESS_CRYSTAL.x + 0.5, z: FORTRESS_CRYSTAL.z + 0.5 };
const SOUTH: Route = [
  { x: 48, z: 93 }, { x: 48, z: 79 }, { x: 48, z: 73 },
  { x: 48, z: 61 }, { x: 48, z: 54 }, CORE,
];
const ROUTES: readonly Route[] = [
  SOUTH,
  [{ x: 48, z: 103 }, ...SOUTH],
  [{ x: 102, z: 102 }, { x: 48, z: 103 }, ...SOUTH],
  [{ x: -6, z: 102 }, { x: 48, z: 103 }, ...SOUTH],
  [{ x: 102, z: -6 }, { x: 105, z: 102 }, { x: 48, z: 103 }, ...SOUTH],
];
const STARTS = [
  { x: 48, z: 105 }, { x: 48, z: 107 }, { x: 105, z: 48 },
  { x: -8, z: 48 }, { x: 105, z: -8 },
] as const;

/** Standalone cooperative-ready wave simulation, with no DOM or storage. */
export class FortressSiege {
  readonly totalWaves = 10;
  readonly maxActive = 18;
  phase: SiegePhase = "idle";
  wave = 0;
  crystalHealth = 800;
  countdown = 0;
  private readonly enemies = new Map<string, Raider>();
  private spawned = 0;
  private toSpawn = 0;
  private spawnTimer = 0;
  private sequence = 0;
  private strikeTime = 0;
  private elapsed = 0;

  get creatures(): NightCreature[] {
    return [...this.enemies.values()].map((raider) => raider.creature);
  }

  start(): void {
    if (this.phase !== "idle") return;
    this.phase = "preparation";
    this.countdown = 20;
  }

  reset(): void {
    this.phase = "idle";
    this.wave = 0;
    this.crystalHealth = 800;
    this.enemies.clear();
    this.elapsed = 0;
    this.countdown = 0;
    this.spawned = this.toSpawn = 0;
  }

  strike(id: string, damage: number): StrikeResult {
    const raider = this.enemies.get(id);
    if (!raider) return "recovering";
    if (this.elapsed < this.strikeTime) return "recovering";
    this.strikeTime = this.elapsed + 0.45;
    raider.creature.health -= Math.max(1, Math.min(8, Math.floor(damage)));
    if (raider.creature.health > 0) return "struck";
    this.enemies.delete(id);
    return "defeated";
  }

  update(
    dt: number,
    stand: (x: number, z: number, y: number, tall: boolean) => number | null,
  ): SiegePhase {
    if (!Number.isFinite(dt) || dt <= 0) return this.phase;
    const step = Math.min(dt, 0.1);
    if (this.phase === "idle" || this.phase === "victory" || this.phase === "defeat")
      return this.phase;
    this.elapsed += step;

    if (this.phase === "preparation" || this.phase === "intermission") {
      this.countdown = Math.max(0, this.countdown - step);
      if (this.countdown <= 0) this.beginWave();
      return this.phase;
    }

    this.spawnTimer -= step;
    if (this.spawned < this.toSpawn && this.enemies.size < this.maxActive &&
        this.spawnTimer <= 0) {
      this.spawnOne(stand);
      this.spawnTimer = 1.35;
    }

    for (const raider of this.enemies.values()) {
      const creature = raider.creature;
      const target = raider.route[raider.next];
      if (!target) continue;
      const dx = target.x - creature.position.x;
      const dz = target.z - creature.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.75) {
        raider.next++;
        if (raider.next >= raider.route.length) {
          raider.next = raider.route.length - 1;
          raider.attackCooldown -= step;
          if (raider.attackCooldown <= 0) {
            this.crystalHealth = Math.max(0, this.crystalHealth - 8);
            raider.attackCooldown = 1.4;
          }
        }
        continue;
      }
      const speed = 1.7 + (this.wave >= 3 ? 0.5 : 0);
      const distanceStep = Math.min(speed * step, distance);
      const x = creature.position.x + (dx / distance) * distanceStep;
      const z = creature.position.z + (dz / distance) * distanceStep;
      const y = stand(x, z, creature.position.y, true);
      if (y !== null) {
        creature.position = { x, y, z };
        creature.moving = true;
      } else creature.moving = false;
    }

    if (this.crystalHealth <= 0) {
      this.phase = "defeat";
    } else if (this.spawned === this.toSpawn && this.enemies.size === 0) {
      if (this.wave >= this.totalWaves) this.phase = "victory";
      else {
        this.phase = "intermission";
        this.countdown = 12;
      }
    }
    return this.phase;
  }

  private beginWave(): void {
    this.wave++;
    this.phase = "wave";
    this.spawned = 0;
    this.toSpawn = 3 + this.wave * 2;
    this.spawnTimer = 0;
    this.countdown = 0;
  }

  private spawnOne(
    stand: (x: number, z: number, y: number, tall: boolean) => number | null,
  ): void {
    // Alternate fronts after the early tutorial waves.
    const front = this.wave <= 2 ? 0 : (this.spawned + this.wave) % STARTS.length;
    const start = STARTS[front];
    if (!start) return;
    const x = start.x + ((this.spawned % 3) - 1) * 0.6;
    const z = start.z;
    const y = stand(x, z, FORTRESS_GROUND_Y + 1, true);
    if (y === null) return; // Try again next frame; never spawn inside unloaded ground.
    const boss = this.wave === 10 && this.spawned === this.toSpawn - 1;
    const creature: NightCreature = {
      id: `siege:${this.sequence++}`,
      kind: "roamer",
      position: { x, y, z } satisfies Vec3,
      health: boss ? 36 : this.wave >= 6 ? 10 : this.wave >= 3 ? 7 : 5,
      moving: false,
    };
    this.enemies.set(creature.id, {
      creature,
      route: ROUTES[front] ?? SOUTH,
      next: 0,
      attackCooldown: 1.4,
    });
    this.spawned++;
  }
}
