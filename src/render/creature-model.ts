import * as THREE from "three";
import type { Creature } from "../game/wildlife";

export interface CreatureBox {
  readonly node: THREE.Object3D;
  readonly color: THREE.Color;
  readonly minimumShade: number;
}

/** A model faces +Z and stands on local y = 0. Both renderers use its cuboids. */
export abstract class CreatureModel {
  readonly root = new THREE.Group();
  readonly boxes: CreatureBox[] = [];

  protected box(
    parent: THREE.Object3D,
    color: THREE.Color,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    length: number,
    minimumShade = 0,
  ): THREE.Object3D {
    const node = new THREE.Object3D();
    node.position.set(x, y, z);
    node.scale.set(width, height, length);
    parent.add(node);
    this.boxes.push({ node, color, minimumShade });
    return node;
  }

  abstract pose(time: number, phase: number, gait: number, creature: Creature): void;
}
