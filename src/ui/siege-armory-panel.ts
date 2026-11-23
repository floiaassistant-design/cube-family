import { ARMORY_ITEMS, armoryPrice, type ArmoryPurchase } from "../game/siege/armory";
import type { SiegeReport } from "../game/siege/session";

const NAMES: Record<ArmoryPurchase, readonly [string, string]> = {
  sword: ["Épée renforcée", "Reinforced sword"],
  "sword-upgrade": ["Améliorer l'épée", "Upgrade sword"],
  bow: ["Arc renforcé", "Reinforced bow"],
  "bow-upgrade": ["Améliorer l'arc", "Upgrade bow"],
  arrows: ["32 flèches", "32 arrows"],
};

/** Local, collapsible store for the fortress event. All pricing and
 * purchase conditions are owned by the armory game module. */
export class SiegeArmoryPanel {
  readonly root: HTMLDivElement;
  private readonly summary: HTMLDivElement;
  private readonly rows = new Map<ArmoryPurchase, HTMLButtonElement>();
  private readonly french: boolean;
  private expanded = false;

  constructor(onBuy: (item: ArmoryPurchase) => void, french: boolean) {
    this.french = french;
    this.root = document.createElement("div");
    this.root.id = "siege-armory";
    this.root.setAttribute("aria-label", french ? "Boutique du siège" : "Siege shop");
    this.root.hidden = true;
    this.summary = document.createElement("div");
    this.summary.className = "siege-shop-summary";
    this.root.append(this.summary);

    for (const item of ARMORY_ITEMS) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.offer = item;
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onBuy(item);
      });
      this.rows.set(item, button);
      this.root.append(button);
    }
  }

  get isOpen(): boolean {
    return this.expanded;
  }

  toggle(): void {
    this.expanded = !this.expanded;
    this.root.hidden = !this.expanded;
  }

  close(): void {
    this.expanded = false;
    this.root.hidden = true;
  }

  update(report: SiegeReport | null, canPurchase: boolean): void {
    if (!this.expanded) return;
    if (!report) {
      this.summary.textContent = this.french
        ? "Lance une partie pour acheter."
        : "Start a siege to buy.";
    } else {
      const { coins, swordTier, bowTier } = report.armory;
      this.summary.textContent = this.french
        ? `Pièces : ${coins} · Épée niv. ${swordTier} · Arc niv. ${bowTier}`
        : `Coins: ${coins} · Sword Lv. ${swordTier} · Bow Lv. ${bowTier}`;
    }

    for (const item of ARMORY_ITEMS) {
      const button = this.rows.get(item);
      if (!button) continue;
      const price = report ? armoryPrice(report.armory, item, report.arrows) : null;
      const label = NAMES[item][this.french ? 0 : 1];
      const unavailable = price === null;
      const suffix = unavailable
        ? this.french
          ? "indisponible"
          : "unavailable"
        : `${price} ${this.french ? "pièces" : "coins"}`;
      const next = `${label} — ${suffix}`;
      if (button.textContent !== next) button.textContent = next;
      button.disabled = !canPurchase || unavailable || !report || report.armory.coins < price;
    }
  }
}
