import * as THREE from "three";
import type { Creature } from "../game/wildlife";
import { CreatureModel } from "./creature-model";
import { VOXEL_ASSETS } from "./voxel-creature-assets";

export interface VoxelCreatureAsset {
  readonly roots: readonly number[];
  readonly parts: readonly {
    readonly translation?: readonly [number, number, number];
    readonly matrix?: readonly number[];
    readonly children?: readonly number[];
    readonly boxes: readonly {
      readonly box: readonly [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      readonly rotation?: readonly number[];
      readonly luminous?: number;
    }[];
  }[];
  readonly clips: readonly {
    readonly name: string;
    readonly tracks: readonly {
      readonly part: number;
      readonly property: "translation" | "rotation";
      readonly time: readonly number[];
      readonly values: readonly number[];
    }[];
  }[];
}

const settings = {
  cow: { scale: 0.78, foot: 0.144 },
  miner: { scale: 0.73, foot: 0.012 },
  titan: { scale: 0.3, foot: -0.12 },
};

type AssetKind = keyof typeof settings;
const clipsByAsset = new Map<AssetKind, readonly THREE.AnimationClip[]>();

function clips(kind: AssetKind): readonly THREE.AnimationClip[] {
  const existing = clipsByAsset.get(kind);
  if (existing) return existing;
  const result = VOXEL_ASSETS[kind].clips.map(
    ({ name, tracks }) =>
      new THREE.AnimationClip(
        name,
        -1,
        tracks.map(({ part, property, time, values }) =>
          property === "rotation"
            ? new THREE.QuaternionKeyframeTrack(`joint${part.toString()}.quaternion`, time, values)
            : new THREE.VectorKeyframeTrack(`joint${part.toString()}.position`, time, values),
        ),
      ),
  );
  clipsByAsset.set(kind, result);
  return result;
}

/** Original GLB cuboids and clips on the instance/canvas creature renderer. */
export class AssetCreatureModel extends CreatureModel {
  private readonly kind: AssetKind;
  private readonly mixer: THREE.AnimationMixer;
  private playing: THREE.AnimationAction | null = null;

  static boxCount(kind: AssetKind): number {
    return VOXEL_ASSETS[kind].parts.reduce((count, part) => count + part.boxes.length, 0);
  }

  constructor(kind: AssetKind) {
    super();
    this.kind = kind;
    const asset = VOXEL_ASSETS[kind];
    const { scale, foot } = settings[kind];
    const rig = new THREE.Group();
    rig.scale.setScalar(scale);
    rig.position.y = -foot * scale;
    this.root.add(rig);
    this.mixer = new THREE.AnimationMixer(rig);
    const nodes = asset.parts.map((part, i) => {
      const node = new THREE.Group();
      node.name = `joint${i.toString()}`;
      if (part.matrix) node.applyMatrix4(new THREE.Matrix4().fromArray(part.matrix));
      if (part.translation) node.position.set(...part.translation);
      for (const { box, rotation, luminous } of part.boxes) {
        const [x, y, z, width, height, depth, r, g, b] = box;
        const mesh = this.box(
          node,
          new THREE.Color(r, g, b),
          x,
          y,
          z,
          width,
          height,
          depth,
          luminous,
        );
        if (rotation) mesh.quaternion.fromArray(rotation);
      }
      return node;
    });
    for (const [i, part] of asset.parts.entries()) {
      const node = nodes[i];
      if (!node) continue;
      for (const child of part.children ?? []) {
        const partNode = nodes[child];
        if (partNode) node.add(partNode);
      }
    }
    for (const i of asset.roots) {
      const root = nodes[i];
      if (root) rig.add(root);
    }
  }

  pose(_time: number, phase: number, _gait: number, creature: Creature, dt: number): void {
    let action = creature.moving ? "Walk" : "Idle";
    if (creature.kind === "cow") action = creature.action;
    else if (creature.kind === "roamer" && creature.attacking) action = "Attack";
    else if (creature.kind === "siege-zombie" && creature.attacking) action = "Smash";
    if (this.playing?.getClip().name !== action) {
      const clip = clips(this.kind).find((clip) => clip.name === action);
      if (!clip) return;
      const next = this.mixer.clipAction(clip);
      if (this.playing) this.playing.fadeOut(0.16);
      next.reset().fadeIn(0.16).play();
      if (action === "Idle") next.time = phase % clip.duration;
      this.playing = next;
    }
    this.mixer.update(dt);
  }
}
