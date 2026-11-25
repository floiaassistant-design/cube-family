import type { SolidQuery, Vec3 } from "../player/physics";
import { BlockId } from "../world/blocks";
import { type RuinSite, readRuinSite } from "./watchers-ruin";
import { canCraft, type Bag, MINING_PICK, RECIPES } from "./items";

export type FirstNightSave =
  | { readonly step: "shelter" | "night" }
  | { readonly step: "map" | "visited"; readonly ruin: RuinSite };

export type FirstNightObjective =
  "wood" | "planks" | "stone" | "pick" | "shelter" | "dusk" | "night" | "map";

const pickRecipe = RECIPES.find((recipe) => recipe.id === MINING_PICK);
const pickPlanks = pickRecipe?.needs.find(([item]) => item === BlockId.PLANKS)?.[1] ?? 2;
const plankRecipes = RECIPES.filter((recipe) => recipe.output === BlockId.PLANKS);
const cardinalDirections = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

/** One open entrance is enough. Natural rock can form part of the shelter. */
export function isFirstNightShelter(position: Vec3, solid: SolidQuery, built: SolidQuery): boolean {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);
  const z = Math.floor(position.z);
  if (!solid(x, y - 1, z) || solid(x, y, z) || solid(x, y + 1, z)) return false;

  const roof = [2, 3, 4, 5].find((offset) => solid(x, y + offset, z));
  if (roof === undefined) return false;
  let playerBuilt = built(x, y + roof, z);
  let walls = 0;
  for (const [dx, dz] of cardinalDirections) {
    for (let distance = 1; distance <= 3; distance++) {
      const wallX = x + dx * distance;
      const wallZ = z + dz * distance;
      if (!solid(wallX, y, wallZ) || !solid(wallX, y + 1, wallZ)) continue;
      walls++;
      playerBuilt ||= built(wallX, y, wallZ) || built(wallX, y + 1, wallZ);
      break;
    }
  }
  return walls >= 3 && playerBuilt;
}

/** State belongs to a single Adventure world. Inventory requirements come from real recipes. */
export class FirstNight {
  private progress: FirstNightSave | null = null;

  constructor(saved: unknown) {
    if (saved === null || typeof saved !== "object") return;
    const { step, ruin } = saved as { step?: unknown; ruin?: unknown };
    if (step === "shelter" || step === "night") this.progress = { step };
    if (step === "map" || step === "visited") {
      const site = readRuinSite(ruin);
      if (site) this.progress = { step, ruin: site };
    }
  }

  get step() {
    return this.progress?.step ?? "gather";
  }

  get ruin(): RuinSite | null {
    return this.progress && "ruin" in this.progress ? this.progress.ruin : null;
  }

  objective(bag: Bag, sheltered: boolean): FirstNightObjective | null {
    switch (this.step) {
      case "gather":
        if (pickRecipe && canCraft(bag, pickRecipe)) return "pick";
        if (bag.count(BlockId.PLANKS) < pickPlanks) {
          return plankRecipes.some((recipe) => canCraft(bag, recipe)) ? "planks" : "wood";
        }
        return "stone";
      case "shelter":
        return sheltered ? "dusk" : "shelter";
      case "night":
        return "night";
      case "map":
        return "map";
      case "visited":
        return null;
    }
  }

  /** Returns true only when progress changes. The site is chosen once, at dawn. */
  advance(
    bag: Bag,
    sheltered: boolean,
    dark: boolean,
    position: Vec3,
    chooseRuin: () => RuinSite,
  ): boolean {
    switch (this.step) {
      case "gather":
        if (!bag.pick) return false;
        this.progress = { step: "shelter" };
        return true;
      case "shelter":
        if (!sheltered || !dark) return false;
        this.progress = { step: "night" };
        return true;
      case "night":
        if (!sheltered) this.progress = { step: "shelter" };
        else if (!dark) this.progress = { step: "map", ruin: chooseRuin() };
        else return false;
        return true;
      case "map": {
        const ruin = this.ruin;
        if (
          !ruin ||
          Math.hypot(position.x - ruin.x - 0.5, position.z - ruin.z - 0.5) > 2 ||
          position.y < ruin.y + 0.5 ||
          position.y > ruin.y + 3
        )
          return false;
        this.progress = { step: "visited", ruin };
        return true;
      }
      case "visited":
        return false;
    }
  }

  toJSON(): FirstNightSave | null {
    return this.progress;
  }
}
