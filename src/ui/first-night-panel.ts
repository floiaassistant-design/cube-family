import type { FirstNightObjective } from "../game/first-night";
import type { Translator } from "../i18n";

const hints = {
  wood: "firstNightWood",
  planks: "firstNightPlanks",
  stone: "firstNightStone",
  pick: "firstNightPick",
  shelter: "firstNightShelter",
  dusk: "firstNightDusk",
  night: "firstNightWait",
} as const;

/** Compact objective and compass card, shared by pointer and touch. */
export class FirstNightPanel {
  private readonly card = document.createElement("section");
  private readonly heading = document.createElement("strong");
  private readonly instruction = document.createElement("div");
  private readonly compass = document.createElement("div");
  private readonly arrow = document.createElement("span");
  private readonly distance = document.createElement("span");
  private readonly t: Translator;
  private objective: FirstNightObjective | null = null;

  constructor(parent: HTMLElement, t: Translator) {
    this.t = t;
    this.card.id = "first-night";
    this.card.hidden = true;
    this.heading.id = "first-night-title";
    this.card.setAttribute("aria-labelledby", this.heading.id);
    this.instruction.setAttribute("role", "status");
    this.compass.className = "first-night-compass";
    this.arrow.textContent = "↑";
    this.arrow.setAttribute("aria-hidden", "true");
    this.compass.append(this.arrow, this.distance);
    this.card.append(this.heading, this.instruction, this.compass);
    parent.append(this.card);
  }

  update(objective: FirstNightObjective | null, map?: { angle: number; distance: number }): void {
    if (objective !== this.objective) {
      this.objective = objective;
      this.card.hidden = objective === null;
      this.heading.textContent = this.t(objective === "map" ? "watchersMap" : "firstNightTitle");
      this.compass.hidden = objective !== "map";
      this.instruction.textContent =
        objective === null
          ? ""
          : this.t(objective === "map" ? "watchersMapHint" : hints[objective]);
    }
    if (!map || objective !== "map") return;
    const distance = this.t("watchersDistance", { distance: Math.round(map.distance) });
    if (distance !== this.distance.textContent) this.distance.textContent = distance;
    this.arrow.style.transform = `rotate(${Math.round(map.angle).toString()}deg)`;
  }
}
