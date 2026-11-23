const REPORT_INTERVAL_MS = 300;

export interface HudInfo {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly chunks: number;
  readonly seed: number;
  /** Extra trailing detail, e.g. the render tier and scale. */
  readonly note?: string;
}

/** The debug line (fps, position, chunk count, seed) and the little toast
 * that names things — the block just selected, a mode just toggled. */
export class Hud {
  private readonly stats: HTMLDivElement;
  private readonly adventure: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly digHint: HTMLDivElement;
  private readonly digProgress: HTMLProgressElement;
  private frames = 0;
  private lastReport = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** Frames per second over the last report window. */
  fps = 0;

  constructor(parent: HTMLElement, digLabel: string) {
    this.stats = document.createElement("div");
    this.stats.id = "fps";
    this.toast = document.createElement("div");
    this.toast.id = "toast";
    this.digHint = document.createElement("div");
    this.digHint.id = "dig-hint";
    this.digHint.hidden = true;
    this.digProgress = document.createElement("progress");
    this.digProgress.id = "dig-progress";
    this.digProgress.hidden = true;
    this.digProgress.max = 1;
    this.digProgress.setAttribute("aria-label", digLabel);
    this.adventure = document.createElement("div");
    this.adventure.id = "adventure-status";
    this.adventure.hidden = true;
    parent.append(this.stats, this.toast, this.digHint, this.digProgress, this.adventure);
  }

  setDigging(progress: number | null, hint: string): void {
    const showProgress = progress !== null;
    const showHint = !showProgress && hint !== "";
    if (this.digProgress.hidden === showProgress) this.digProgress.hidden = !showProgress;
    if (showProgress && this.digProgress.value !== progress) this.digProgress.value = progress;
    if (this.digHint.hidden === showHint) this.digHint.hidden = !showHint;
    if (showHint && this.digHint.textContent !== hint) this.digHint.textContent = hint;
  }

  setAdventureStatus(text: string): void {
    const hide = text === "";
    if (this.adventure.hidden !== hide) this.adventure.hidden = hide;
    if (!hide && this.adventure.textContent !== text) this.adventure.textContent = text;
  }

  setStatsVisible(visible: boolean): void {
    this.stats.style.display = visible ? "block" : "none";
  }

  /** Shows a short message above the hotbar for a moment. */
  announce(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add("visible");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove("visible");
    }, 1400);
  }

  frame(nowMs: number, info: HudInfo): void {
    this.frames++;
    if (nowMs - this.lastReport < REPORT_INTERVAL_MS) return;
    this.fps = Math.round((this.frames * 1000) / (nowMs - this.lastReport));
    this.frames = 0;
    this.lastReport = nowMs;
    const pos = `${Math.floor(info.x).toString()}, ${Math.floor(info.y).toString()}, ${Math.floor(info.z).toString()}`;
    const note = info.note ? ` · ${info.note}` : "";
    this.stats.textContent = `${this.fps.toString()} fps · (${pos}) · ${info.chunks.toString()} chunks · seed ${info.seed.toString()}${note}`;
  }
}
