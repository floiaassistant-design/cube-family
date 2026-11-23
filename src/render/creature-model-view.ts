import * as THREE from "three";
import { MAX_CATS, MAX_NIGHT_CREATURES, type Creature } from "../game/wildlife";
import { CatModel, OrangeCatModel } from "./cat-model";
import { MAX_SIEGE_ZOMBIES } from "../game/siege/session";
import { SiegeZombieModel } from "./siege-zombie-model";
import type { CreatureModel } from "./creature-model";
import { RoamerModel } from "./roamer-model";

const BOX_FACES = [
  { corners: [1, 3, 7, 5], shade: 0.78 },
  { corners: [0, 4, 6, 2], shade: 0.67 },
  { corners: [2, 6, 7, 3], shade: 1 },
  { corners: [0, 1, 5, 4], shade: 0.43 },
  { corners: [4, 5, 7, 6], shade: 0.92 },
  { corners: [0, 2, 3, 1], shade: 0.63 },
] as const;

interface CreaturePose {
  readonly model: CreatureModel;
  readonly phase: number;
  readonly lastPosition: THREE.Vector3;
  yaw: number;
  gait: number;
}

interface ProjectedFace {
  readonly xy: [number, number, number, number, number, number, number, number];
  depth: number;
  color: string;
}

/** Canvas fallback projects the same cuboids used by WebGL. */
class CanvasCreatureView {
  private readonly viewProjection = new THREE.Matrix4();
  private readonly clip = new THREE.Matrix4();
  private readonly corners = [
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
  ] as const;
  private readonly faces: ProjectedFace[] = [];
  private readonly pool: ProjectedFace[] = [];
  private readonly tint = new THREE.Color();

  beginFrame(camera: THREE.PerspectiveCamera): void {
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }

  draw(ctx: CanvasRenderingContext2D, model: CreatureModel, shade: number): void {
    this.faces.length = 0;
    for (const { node, color, minimumShade } of model.boxes) {
      if (!node.visible) continue;
      this.clip.multiplyMatrices(this.viewProjection, node.matrixWorld);
      for (const [i, corner] of this.corners.entries()) {
        corner.set((i & 1) - 0.5, ((i >> 1) & 1) - 0.5, ((i >> 2) & 1) - 0.5, 1);
        corner.applyMatrix4(this.clip);
        if (corner.w > 0.1) {
          corner.x /= corner.w;
          corner.y /= corner.w;
        }
      }
      for (const {
        corners: [i, j, k, l],
        shade: sideShade,
      } of BOX_FACES) {
        const a = this.corners[i];
        const b = this.corners[j];
        const c = this.corners[k];
        const d = this.corners[l];
        if (Math.min(a.w, b.w, c.w, d.w) <= 0.1) continue;
        if ((b.x - a.x) * (c.y - a.y) <= (b.y - a.y) * (c.x - a.x)) continue;
        const index = this.faces.length;
        const face = (this.pool[index] ??= {
          xy: [0, 0, 0, 0, 0, 0, 0, 0],
          depth: 0,
          color: "",
        });
        face.xy[0] = a.x;
        face.xy[1] = a.y;
        face.xy[2] = b.x;
        face.xy[3] = b.y;
        face.xy[4] = c.x;
        face.xy[5] = c.y;
        face.xy[6] = d.x;
        face.xy[7] = d.y;
        face.depth = a.w + b.w + c.w + d.w;
        face.color = this.tint
          .copy(color)
          .multiplyScalar(Math.max(shade, minimumShade) * sideShade)
          .getStyle();
        this.faces.push(face);
      }
    }
    this.faces.sort((a, b) => b.depth - a.depth);
    const halfWidth = ctx.canvas.width / 2;
    const halfHeight = ctx.canvas.height / 2;
    for (const { xy, color } of this.faces) {
      ctx.beginPath();
      ctx.moveTo((1 + xy[0]) * halfWidth, (1 - xy[1]) * halfHeight);
      ctx.lineTo((1 + xy[2]) * halfWidth, (1 - xy[3]) * halfHeight);
      ctx.lineTo((1 + xy[4]) * halfWidth, (1 - xy[5]) * halfHeight);
      ctx.lineTo((1 + xy[6]) * halfWidth, (1 - xy[7]) * halfHeight);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

export class CreatureModelView {
  private readonly poses = new Map<string, CreaturePose>();
  private readonly canvasView: CanvasCreatureView | null;
  private readonly instances: THREE.InstancedMesh<
    THREE.BoxGeometry,
    THREE.MeshBasicMaterial
  > | null;
  private readonly matrix = new THREE.Matrix4();
  private readonly tint = new THREE.Color();
  private count = 0;

  constructor(scene: THREE.Scene | null) {
    this.canvasView = scene ? null : new CanvasCreatureView();
    this.instances = null;
    if (!scene) return;
    const geometry = new THREE.BoxGeometry();
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (const [i, { shade }] of BOX_FACES.entries()) colors.fill(shade, i * 12, (i + 1) * 12);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.instances = new THREE.InstancedMesh(
      geometry,
      material,
      MAX_CATS * new OrangeCatModel().boxes.length +
        MAX_NIGHT_CREATURES * new RoamerModel().boxes.length +
        MAX_SIEGE_ZOMBIES * new SiegeZombieModel().boxes.length,
    );
    this.instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instances.frustumCulled = false;
    this.instances.visible = false;
    this.instances.name = "creature-models";
    scene.add(this.instances);
  }

  beginFrame(camera: THREE.PerspectiveCamera, ids: ReadonlySet<string>): void {
    for (const id of this.poses.keys()) {
      if (!ids.has(id)) this.poses.delete(id);
    }
    this.count = 0;
    this.canvasView?.beginFrame(camera);
    if (this.instances) {
      // Keep instance coordinates close to zero even far from spawn.
      this.instances.position.copy(camera.position);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    creature: Creature,
    time: number,
    dt: number,
    shade: number,
  ): void {
    const { x, y, z } = creature.position;
    let pose = this.poses.get(creature.id);
    if (!pose) {
      let phase = 0;
      for (let i = 0; i < creature.id.length; i++)
        phase = (phase * 31 + creature.id.charCodeAt(i)) >>> 0;
      phase = (phase % 6283) / 1000;
      pose = {
        model:
          creature.kind === "cat"
            ? creature.coat === 0
              ? new OrangeCatModel()
              : new CatModel(creature.coat)
            : creature.kind === "siege-zombie"
              ? new SiegeZombieModel()
              : new RoamerModel(),
        phase,
        lastPosition: new THREE.Vector3(x, y, z),
        yaw: phase,
        gait: 0,
      };
      pose.model.root.position.copy(pose.lastPosition);
      pose.model.root.rotation.y = phase;
      this.poses.set(creature.id, pose);
    }
    const dx = x - pose.lastPosition.x;
    const dz = z - pose.lastPosition.z;
    const moved = Math.hypot(dx, dz);
    if (creature.moving && moved > 0.002 && moved < 1.5) pose.yaw = Math.atan2(dx, dz);
    pose.lastPosition.set(x, y, z);
    const root = pose.model.root;
    if (root.position.distanceToSquared(pose.lastPosition) > 1)
      root.position.copy(pose.lastPosition);
    else {
      root.position.x = THREE.MathUtils.damp(root.position.x, x, 16, dt);
      root.position.y = y;
      root.position.z = THREE.MathUtils.damp(root.position.z, z, 16, dt);
    }
    const turn = pose.yaw - root.rotation.y;
    root.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-dt * 12));
    pose.gait = THREE.MathUtils.damp(pose.gait, creature.moving ? 1 : 0, 14, dt);
    pose.model.pose(time, pose.phase, pose.gait, creature);
    root.updateMatrixWorld();
    if (!this.instances) {
      this.canvasView?.draw(ctx, pose.model, shade);
      return;
    }
    const origin = this.instances.position;
    for (const { node, color, minimumShade } of pose.model.boxes) {
      if (!node.visible) continue;
      this.matrix.copy(node.matrixWorld);
      const elements = this.matrix.elements;
      elements[12] -= origin.x;
      elements[13] -= origin.y;
      elements[14] -= origin.z;
      this.instances.setMatrixAt(this.count, this.matrix);
      this.instances.setColorAt(
        this.count++,
        this.tint.copy(color).multiplyScalar(Math.max(shade, minimumShade)),
      );
    }
  }

  endFrame(): void {
    if (!this.instances) return;
    this.instances.count = this.count;
    this.instances.visible = this.count > 0;
    if (!this.instances.visible) return;
    this.instances.instanceMatrix.needsUpdate = true;
    if (this.instances.instanceColor) this.instances.instanceColor.needsUpdate = true;
  }
}
