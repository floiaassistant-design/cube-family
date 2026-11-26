import { incomingDamage } from "./equipment";
import type { SiegeZombie } from "./siege/session";
import { forwardVector, PLAYER_EYE_HEIGHT, type Vec3 } from "../player/physics";
import { DAY_LENGTH_SECONDS, SUNSET_PHASE } from "../render/sky";
import { CHUNK_HEIGHT } from "../world/coords";
import { hash3 } from "../world/terrain";
import { COW_HEIGHT, CowHerd, type Cow, type CowTerrain } from "./cows";
import { TITAN_HEIGHT } from "./siege/session";

export const MAX_HEALTH = 10;
const MAX_PETS = 24;
const MAX_WILD_CATS = 18;
export const MAX_CATS = MAX_PETS + MAX_WILD_CATS;
const CAT_CELL = 14;
const STARTER_CAT_ID = "s:0";
export const MAX_NIGHT_CREATURES = 4;
export const ROAMER_MAX_HEALTH = 6;
const PET_REST = 90;
const KITTEN_AGE = 225;

export interface Cat {
  readonly id: string;
  readonly kind: "cat";
  readonly coat: number;
  owned: boolean;
  growsIn: number;
  rest: number;
  position: Vec3;
  moving: boolean;
}
export interface NightCreature {
  readonly id: string;
  readonly kind: "roamer";
  position: Vec3;
  health: number;
  moving: boolean;
  readonly variant?: "miner";
  attacking?: boolean;
}
export type Creature = Cat | Cow | NightCreature | SiegeZombie;

export type CatResult = "adopted" | "purr" | "kitten" | "full" | "resting";
export type StrikeResult = "struck" | "defeated" | "recovering";
export type WildlifeEvent = "hurt" | "retreat" | "blocked";

export interface WildlifeTerrain {
  /** Returns dry walkable ground just above or below this level. */
  stand(x: number, z: number, y: number, tall: boolean): number | null;
  surface(x: number, z: number): number;
  clear(from: Vec3, to: Vec3): boolean;
  readonly cattle?: CowTerrain;
}

interface WildlifeSave {
  readonly cats: readonly Cat[];
  readonly health: number;
  readonly kittenSequence: number;
}

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const unitRoll = (seed: number, x: number, y: number, z: number): number =>
  (hash3(seed, x, y, z) >>> 0) / 0x100000000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fromNumber(value: unknown, min: number, max: number, fallback = min): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function restoreCats(raw: unknown): Cat[] {
  const cats = new Map<string, Cat>();
  if (!Array.isArray(raw)) return [];
  for (const value of raw.slice(0, MAX_PETS) as unknown[]) {
    const data = record(value);
    const pos = record(data?.position);
    if (
      !data ||
      !pos ||
      typeof data.id !== "string" ||
      !/^(s:0|w:-?\d+:-?\d+:[01]|k:\d+)$/.test(data.id)
    ) {
      continue;
    }
    const x = fromNumber(pos.x, -(2 ** 30), 2 ** 30, NaN);
    const y = fromNumber(pos.y, 1, CHUNK_HEIGHT - 1, NaN);
    const z = fromNumber(pos.z, -(2 ** 30), 2 ** 30, NaN);
    if (![x, y, z].every(Number.isFinite)) continue;
    cats.set(data.id, {
      id: data.id,
      kind: "cat",
      coat: Math.round(fromNumber(data.coat, 0, 3)),
      owned: true,
      growsIn: fromNumber(data.growsIn, 0, KITTEN_AGE),
      rest: fromNumber(data.rest, 0, PET_REST),
      position: { x, y, z },
      moving: false,
    });
  }
  return [...cats.values()];
}

export function timeIsNight(seconds: number): boolean {
  const phase =
    (((seconds % DAY_LENGTH_SECONDS) + DAY_LENGTH_SECONDS) % DAY_LENGTH_SECONDS) /
    DAY_LENGTH_SECONDS;
  return phase >= SUNSET_PHASE;
}

export function nextMorning(seconds: number): number {
  return (Math.floor(seconds / DAY_LENGTH_SECONDS) + 1.01) * DAY_LENGTH_SECONDS;
}

export function creatureCenter(creature: Creature): Vec3 {
  const height =
    creature.kind === "roamer"
      ? 0.92
      : creature.kind === "siege-zombie"
        ? creature.variant === "boss"
          ? TITAN_HEIGHT * 0.5
          : 0.92
        : creature.kind === "cow"
          ? COW_HEIGHT * 0.62
          : creature.growsIn > 0
            ? 0.27
            : 0.43;
  return { ...creature.position, y: creature.position.y + height };
}

export class Wildlife {
  private readonly terrain: WildlifeTerrain;
  private readonly seed: number;
  private readonly cats = new Map<string, Cat>();
  private readonly roaming = new Map<string, NightCreature>();
  private readonly cattle: CowHerd | null;
  private tickTime = 0;
  private nextSpawn = 0;
  private nextCats = 0;
  private lastStrike = 0;
  private lastDamage = 0;
  private healAt = 0;
  private nightSequence = 0;
  private kittenSequence: number;
  private elapsed = 0;
  private life: number;

  constructor(seed: number, terrain: WildlifeTerrain, persisted: unknown) {
    this.seed = seed;
    this.terrain = terrain;
    this.cattle = terrain.cattle ? new CowHerd(seed, terrain.cattle) : null;
    const save = record(persisted);
    for (const cat of restoreCats(save?.cats)) this.cats.set(cat.id, cat);
    this.life = fromNumber(save?.health, 1, MAX_HEALTH, MAX_HEALTH);
    this.kittenSequence = Math.round(fromNumber(save?.kittenSequence, 0, 1000000));
  }

  get health(): number {
    return this.life;
  }

  get petCount(): number {
    let count = 0;
    for (const cat of this.cats.values()) if (cat.owned) count++;
    return count;
  }

  nearby(player: Vec3, range = 23): Creature[] {
    return [
      ...this.cats.values(),
      ...this.roaming.values(),
      ...(this.cattle?.values() ?? []),
    ].filter((creature) => distance(player, creature.position) <= range);
  }

  cowOccupies(x: number, y: number, z: number): boolean {
    return this.cattle?.occupies(x, y, z) ?? false;
  }

  save(): WildlifeSave {
    return {
      cats: [...this.cats.values()].filter((cat) => cat.owned),
      health: this.life,
      kittenSequence: this.kittenSequence,
    };
  }

  /** Give the player a visible encounter near their starting position on dry ground. */
  spawnStarterCat(player: Vec3, yaw: number): void {
    if (this.cats.has(STARTER_CAT_ID)) return;
    const eye = { ...player, y: player.y + PLAYER_EYE_HEIGHT };
    for (const radius of [4, 6, 8]) {
      for (const offset of [0.22, -0.22, 0.46, -0.46, 0.7, -0.7]) {
        const direction = forwardVector(yaw + offset);
        const x = player.x + direction.x * radius;
        const z = player.z + direction.z * radius;
        const y = this.terrain.stand(x, z, this.terrain.surface(x, z), false);
        if (y === null || Math.abs(y - player.y) > 2) continue;
        const cat: Cat = {
          id: STARTER_CAT_ID,
          kind: "cat",
          coat: 0,
          owned: false,
          growsIn: 0,
          rest: 0,
          position: { x, y, z },
          moving: false,
        };
        if (!this.terrain.clear(eye, creatureCenter(cat))) continue;
        this.cats.set(cat.id, cat);
        return;
      }
    }
  }

  update(
    dt: number,
    player: Vec3,
    night: boolean | null,
    active: boolean,
    protectedByCopper: boolean,
    shieldHeld = false,
    daylight = !night,
  ): WildlifeEvent | null {
    if (!night) {
      this.roaming.clear();
      this.nextSpawn = 0;
    }
    if (!active) return null;
    this.elapsed += dt;
    this.tickTime += dt;
    if (this.tickTime < 0.1) return null;
    const step = this.tickTime;
    this.tickTime = 0;
    if (this.elapsed >= this.nextCats) {
      this.nextCats = this.elapsed + 1;
      this.spawnCats(player);
    }
    this.moveCats(player, step);
    this.cattle?.update(step, player, daylight);
    if (night === null) return null;
    if (!night && this.life < MAX_HEALTH && this.elapsed >= this.healAt) {
      this.life++;
      this.healAt = this.elapsed + 5;
    }
    if (night) return this.updateNight(player, step, protectedByCopper, shieldHeld);
    return null;
  }

  private spawnCats(player: Vec3): void {
    for (const [id, cat] of this.cats) {
      if (!cat.owned && distance(player, cat.position) > 24) this.cats.delete(id);
    }
    const gx = Math.floor(player.x / CAT_CELL);
    const gz = Math.floor(player.z / CAT_CELL);
    let wildCount = this.cats.size - this.petCount;
    for (let x = gx - 1; x <= gx + 1; x++) {
      for (let z = gz - 1; z <= gz + 1; z++) {
        for (let i = 0; i < 2 && wildCount < MAX_WILD_CATS; i++) {
          const id = `w:${x.toString()}:${z.toString()}:${i.toString()}`;
          if (this.cats.has(id)) continue;
          const cx = (x + unitRoll(this.seed ^ 0xca75, x, i, z)) * CAT_CELL + 0.5;
          const cz = (z + unitRoll(this.seed ^ 0x018c, x, i, z)) * CAT_CELL + 0.5;
          if (Math.hypot(player.x - cx, player.z - cz) > 20) continue;
          const y = this.terrain.stand(cx, cz, this.terrain.surface(cx, cz), false);
          if (y === null) continue;
          const coat = Math.floor(unitRoll(this.seed ^ 0x7a88, x, i, z) * 4);
          this.cats.set(id, {
            id,
            kind: "cat",
            coat,
            owned: false,
            growsIn: 0,
            rest: 0,
            position: { x: cx, y, z: cz },
            moving: false,
          });
          wildCount++;
        }
      }
    }
  }

  private moveCats(player: Vec3, dt: number): void {
    let i = 0;
    for (const cat of this.cats.values()) {
      if (!cat.owned) continue;
      cat.growsIn = Math.max(0, cat.growsIn - dt);
      cat.rest = Math.max(0, cat.rest - dt);
      if (distance(player, cat.position) > 18) {
        const angle = i * 2.4;
        const radius = 2 + (i % 3) * 0.8;
        const x = player.x + Math.cos(angle) * radius;
        const z = player.z + Math.sin(angle) * radius;
        const y = this.terrain.stand(x, z, player.y, false);
        if (y !== null) cat.position = { x, y, z };
      } else {
        cat.moving = this.move(
          cat,
          player,
          dt * (cat.growsIn > 0 ? 1.65 : 1.9),
          1.6 + (i % 4) * 0.35,
        );
      }
      i++;
    }
  }

  private move(
    creature: Cat | NightCreature,
    destination: Vec3,
    speed: number,
    stop: number,
  ): boolean {
    const { x, y, z } = creature.position;
    const dx = destination.x - x;
    const dz = destination.z - z;
    const distanceXZ = Math.hypot(dx, dz);
    if (distanceXZ <= stop) return false;
    const nx = x + (dx / distanceXZ) * speed;
    const nz = z + (dz / distanceXZ) * speed;
    const ny = this.terrain.stand(nx, nz, y, creature.kind === "roamer");
    if (ny === null) return false;
    creature.position = { x: nx, y: ny, z: nz };
    return true;
  }

  private updateNight(
    player: Vec3,
    dt: number,
    armored: boolean,
    shieldHeld: boolean,
  ): WildlifeEvent | null {
    if (this.elapsed >= this.nextSpawn) {
      this.nextSpawn = this.elapsed + 8;
      this.spawnRoamer(player);
    }
    for (const [id, creature] of this.roaming) {
      if (distance(player, creature.position) > 24) {
        this.roaming.delete(id);
        continue;
      }
      creature.moving = this.move(creature, player, dt * 1.65, 0.95);
      const chest = { ...player, y: player.y + 0.8 };
      creature.attacking =
        distance(chest, creatureCenter(creature)) < 1.18 &&
        this.terrain.clear(creatureCenter(creature), chest);
      if (creature.attacking && this.elapsed >= this.lastDamage) {
        this.lastDamage = this.elapsed + 1.45;
        this.healAt = this.elapsed + 5;
        const damage = incomingDamage(armored, shieldHeld);
        this.life -= damage;
        if (damage === 0) return "blocked";
        if (this.life > 0) return "hurt";
        this.life = MAX_HEALTH;
        this.roaming.clear();
        this.nextSpawn = this.elapsed + 14;
        return "retreat";
      }
    }
    return null;
  }

  private spawnRoamer(player: Vec3): void {
    if (this.roaming.size >= MAX_NIGHT_CREATURES) return;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = unitRoll(this.seed ^ 0x88ae, this.nightSequence, attempt, 0) * 2 * Math.PI;
      const radius = 8 + (attempt % 6);
      const x = player.x + Math.cos(angle) * radius;
      const z = player.z + Math.sin(angle) * radius;
      const surface = this.terrain.surface(x, z);
      // These creatures spawn outdoors, above approximately the local ground level.
      const y = this.terrain.stand(x, z, surface, true);
      if (y === null || Math.abs(player.y - y) > 9) continue;
      const sequence = this.nightSequence++;
      const id = `roamer:${sequence.toString()}`;
      this.roaming.set(id, {
        id,
        kind: "roamer",
        position: { x, y, z },
        health: ROAMER_MAX_HEALTH,
        moving: false,
        ...(sequence % 2 === 0 ? { variant: "miner" } : {}),
      });
      break;
    }
  }

  useCat(cat: Cat): CatResult {
    if (!cat.owned) {
      if (this.petCount >= MAX_PETS) return "full";
      cat.owned = true;
      return "adopted";
    }
    if (cat.growsIn > 0 || cat.rest > 0) return "resting";
    if (this.petCount >= MAX_PETS) return "full";
    const partner = [...this.cats.values()].find(
      (other) =>
        other !== cat &&
        other.owned &&
        other.growsIn === 0 &&
        other.rest === 0 &&
        distance(other.position, cat.position) <= 4,
    );
    if (!partner) return "purr";
    cat.rest = partner.rest = PET_REST;
    let id: string;
    do {
      id = `k:${(this.kittenSequence++).toString()}`;
    } while (this.cats.has(id));
    this.cats.set(id, {
      id,
      kind: "cat",
      coat: (cat.coat + partner.coat + this.kittenSequence) % 4,
      owned: true,
      growsIn: KITTEN_AGE,
      rest: 0,
      position: { ...cat.position },
      moving: false,
    });
    return "kitten";
  }

  strike(creature: NightCreature, damage = 2): StrikeResult {
    if (this.elapsed < this.lastStrike) return "recovering";
    this.lastStrike = this.elapsed + 0.45;
    creature.health -= Math.max(1, Math.min(4, Math.floor(damage)));
    if (creature.health > 0) return "struck";
    this.roaming.delete(creature.id);
    return "defeated";
  }

  rest(): void {
    this.life = MAX_HEALTH;
    this.roaming.clear();
  }
}
