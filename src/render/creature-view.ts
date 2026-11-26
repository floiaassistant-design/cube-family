import * as THREE from "three";
import {
  creatureCenter,
  ROAMER_MAX_HEALTH,
  type Creature,
  type WildlifeTerrain,
} from "../game/wildlife";
import { CreatureModelView } from "./creature-model-view";
import { ROAMER_HEIGHT } from "./roamer-model";
import { TITAN_HEIGHT } from "../game/siege/session";

/** Render the creatures in the world and project health bars onto the overlay. */
export class CreatureView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clear: WildlifeTerrain["clear"];
  private readonly forward = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly barAnchor = new THREE.Vector3();
  private readonly creatureIds = new Set<string>();
  private readonly models: CreatureModelView;
  private readonly webgl: boolean;

  constructor(
    parent: HTMLElement,
    camera: THREE.PerspectiveCamera,
    clear: WildlifeTerrain["clear"],
    scene: THREE.Scene | null,
  ) {
    this.camera = camera;
    this.clear = clear;
    this.webgl = scene !== null;
    this.models = new CreatureModelView(scene);
    this.canvas = document.createElement("canvas");
    this.canvas.id = "creatures";
    this.canvas.setAttribute("aria-hidden", "true");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is unavailable");
    this.ctx = ctx;
    parent.append(this.canvas);
  }

  render(creatures: readonly Creature[], time: number, dt: number, shade: number): void {
    this.creatureIds.clear();
    for (const creature of creatures) this.creatureIds.add(creature.id);
    this.camera.updateMatrixWorld();
    this.models.beginFrame(this.camera, this.creatureIds);
    const overlayVisible = this.webgl
      ? creatures.some(
          (creature) =>
            (creature.kind === "roamer" && creature.health < ROAMER_MAX_HEALTH) ||
            (creature.kind === "siege-zombie" && creature.health < creature.maxHealth),
        )
      : creatures.length > 0;
    if (this.canvas.hidden === overlayVisible) this.canvas.hidden = !overlayVisible;
    if (creatures.length === 0) {
      this.models.endFrame();
      return;
    }
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (overlayVisible) {
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.ctx.clearRect(0, 0, width, height);
    }
    this.camera.getWorldDirection(this.forward);
    const sorted = creatures
      .map((creature) => {
        this.delta.copy(creature.position).sub(this.camera.position);
        return { creature, depth: this.forward.dot(this.delta) };
      })
      .filter(
        ({ creature, depth }) =>
          depth > 0.18 && depth < (creature.kind === "siege-zombie" ? (this.webgl ? 64 : 28) : 24),
      )
      .sort((a, b) => b.depth - a.depth);
    const focus = height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    for (const { creature, depth } of sorted) {
      const center = creatureCenter(creature);
      this.projected.copy(center).project(this.camera);
      if (Math.abs(this.projected.x) > 1.35 || Math.abs(this.projected.y) > 1.35) continue;
      const injured =
        (creature.kind === "roamer" && creature.health < ROAMER_MAX_HEALTH) ||
        (creature.kind === "siege-zombie" && creature.health < creature.maxHealth);
      const unobstructed = (!this.webgl || injured) && this.clear(this.camera.position, center);
      if (this.webgl || unobstructed) this.models.draw(this.ctx, creature, time, dt, shade);
      if (!injured || !unobstructed) continue;

      const { x, y, z } = creature.position;
      const height =
        creature.kind === "siege-zombie" && creature.variant === "boss"
          ? TITAN_HEIGHT
          : ROAMER_HEIGHT;
      this.barAnchor.set(x, y + height + 0.12, z).project(this.camera);
      const barWidth = THREE.MathUtils.clamp((0.75 * focus) / depth, 12, 100);
      const left = ((this.barAnchor.x + 1) * width - barWidth) / 2;
      const top = ((1 - this.barAnchor.y) * height) / 2;
      this.ctx.fillStyle = "#242b3b";
      this.ctx.fillRect(left - 1, top - 1, barWidth + 2, 6);
      this.ctx.fillStyle = "#ffc084";
      const maxHealth = creature.kind === "siege-zombie" ? creature.maxHealth : ROAMER_MAX_HEALTH;
      this.ctx.fillRect(left, top, (barWidth * creature.health) / maxHealth, 4);
    }
    this.models.endFrame();
  }
}
