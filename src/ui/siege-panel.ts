import type { SiegeReport } from "../game/siege/session";

export interface SiegePanelCallbacks {
  readonly build: () => void;
  readonly visit: () => void;
  readonly start: () => void;
  readonly stop: () => void;
  readonly shoot: () => void;
  readonly repair: () => void;
}

export interface SiegePanelState {
  readonly creative: boolean;
  readonly playing: boolean;
  readonly hasFortress: boolean;
  readonly nearby: boolean;
  readonly report: SiegeReport | null;
}

/** Small accessible action panel: no extra navigation screens or desktop-only bindings. */
export class SiegePanel {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly reportText: HTMLDivElement;
  private readonly buildButton: HTMLButtonElement;
  private readonly visitButton: HTMLButtonElement;
  private readonly startButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly shootButton: HTMLButtonElement;
  private readonly repairButton: HTMLButtonElement;
  private readonly french: boolean;

  constructor(parent: HTMLElement, callbacks: SiegePanelCallbacks, french: boolean) {
    this.french = french;
    this.root = document.createElement("div");
    this.root.id = "siege-panel";
    this.root.setAttribute("aria-label", french ? "Défense de forteresse" : "Fortress defense");
    this.title = document.createElement("div");
    this.title.className = "siege-title";
    this.title.textContent = french ? "Forteresse des Cinq Bastions" : "Five Bastions Fortress";
    this.reportText = document.createElement("div");
    this.reportText.className = "siege-status";
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        action();
      });
      return b;
    };
    this.buildButton = button(french ? "Construire (B)" : "Build (B)", callbacks.build);
    this.visitButton = button(french ? "Visiter (V)" : "Visit (V)", callbacks.visit);
    this.startButton = button(
      french ? "Lancer les vagues (N)" : "Start waves (N)",
      callbacks.start,
    );
    this.stopButton = button(french ? "Arrêter (X)" : "Stop (X)", callbacks.stop);
    this.shootButton = button(french ? "Tirer (G)" : "Fire (G)", callbacks.shoot);
    this.repairButton = button(
      french ? "Réparer (H) : 5 éliminations" : "Repair (H): 5 kills",
      callbacks.repair,
    );
    this.root.append(
      this.title,
      this.reportText,
      this.buildButton,
      this.visitButton,
      this.startButton,
      this.shootButton,
      this.repairButton,
      this.stopButton,
    );
    this.root.hidden = true;
    parent.append(this.root);
  }

  update(state: SiegePanelState): void {
    const { report, playing, nearby, creative, hasFortress } = state;
    const show = playing && (hasFortress || creative);
    if (this.root.hidden === show) this.root.hidden = !show;
    if (!show) return;
    const active =
      report?.phase === "preparation" ||
      report?.phase === "wave" ||
      report?.phase === "intermission";
    this.buildButton.hidden = hasFortress || !creative;
    this.visitButton.hidden = !hasFortress || nearby || active;
    this.startButton.hidden = !hasFortress || !nearby || active;
    this.stopButton.hidden = !active;
    this.shootButton.hidden = report?.phase !== "wave";
    this.repairButton.hidden = report?.phase !== "intermission";
    this.repairButton.disabled =
      !report || report.kills < 5 || report.crystal === report.maxCrystal;

    let status: string;
    if (!hasFortress) {
      status = this.french
        ? "Mode Libre : construire sur un terrain vierge"
        : "Creative: build on an empty site";
    } else if (!report || report.phase === "idle") {
      status = this.french ? "Arène prête · 1 joueur" : "Arena ready · 1 player";
    } else if (report.phase === "victory" || report.phase === "defeat") {
      status = this.french
        ? report.phase === "victory"
          ? "Victoire ! Tous les assauts repoussés."
          : "Défaite : le cristal est détruit."
        : report.phase === "victory"
          ? "Victory! Siege repelled."
          : "Defeat: crystal destroyed.";
    } else {
      const phase =
        report.phase === "preparation"
          ? this.french
            ? "Préparation"
            : "Preparation"
          : report.phase === "intermission"
            ? this.french
              ? "Réparation"
              : "Intermission"
            : this.french
              ? "Assaut"
              : "Attack";
      status = `${phase} ${report.wave.toString()}/${report.totalWaves.toString()} · ${this.french ? "Cristal" : "Crystal"} ${report.crystal.toString()}/${report.maxCrystal.toString()} · ${this.french ? "Flèches" : "Arrows"} ${report.arrows.toString()} · ${this.french ? "Élim." : "Kills"} ${report.kills.toString()}`;
      if (report.phase !== "wave") status += ` · ${report.timer.toString()}s`;
      else status += ` · ${report.pending.toString()} ${this.french ? "restants" : "remaining"}`;
    }
    if (this.reportText.textContent !== status) this.reportText.textContent = status;
  }
}
