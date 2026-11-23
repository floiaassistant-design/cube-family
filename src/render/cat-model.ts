import * as THREE from "three";
import type { Creature } from "../game/wildlife";
import { CreatureModel } from "./creature-model";

const COATS = [
  [0xab6841, 0xe9ad73, 0xf9dcc0],
  [0x384155, 0x69778b, 0xcad0dc],
  [0xa9957c, 0xe8d7ba, 0xffedce],
  [0x3e2b37, 0x7f5d55, 0xedba80],
] as const;

/** An original voxel cat and its adoption collar. */
export class CatModel extends CreatureModel {
  private readonly accessories: THREE.Object3D[];
  private readonly torso = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly tail = new THREE.Group();

  constructor(coatIndex: number) {
    super();
    // Wildlife bounds the coat index for spawned and restored cats.
    const colors = COATS[coatIndex] ?? COATS[0];
    const dark = new THREE.Color(colors[0]);
    const fur = new THREE.Color(colors[1]);
    const light = new THREE.Color(colors[2]);
    const eye = new THREE.Color(0x253637);
    const ear = new THREE.Color(0xe79e9e);
    const nose = new THREE.Color(0xa05060);
    const collar = new THREE.Color(0x6189c5);
    const tag = new THREE.Color(0xffd28a);
    this.root.add(this.torso);
    this.box(this.torso, fur, 0, 0.35, -0.045, 0.32, 0.28, 0.64);
    this.box(this.torso, light, 0, 0.238, 0.001, 0.324, 0.09, 0.48);
    // A few broad marks stay legible at a distance.
    this.box(this.torso, dark, 0, 0.489, -0.16, 0.3, 0.035, 0.085);
    this.box(this.torso, dark, 0, 0.489, -0.015, 0.31, 0.035, 0.055);
    this.box(this.torso, fur, 0, 0.5, 0.323, 0.35, 0.29, 0.31);
    this.box(this.torso, light, 0, 0.446, 0.48, 0.215, 0.1, 0.073);
    this.box(this.torso, nose, 0, 0.479, 0.52, 0.057, 0.037, 0.02);
    for (const side of [-1, 1]) {
      this.box(this.torso, dark, side * 0.119, 0.677, 0.298, 0.098, 0.14, 0.1);
      this.box(this.torso, ear, side * 0.119, 0.675, 0.35, 0.052, 0.074, 0.013);
      this.box(this.torso, eye, side * 0.106, 0.531, 0.483, 0.045, 0.056, 0.024);
      for (const z of [-0.255, 0.19]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.105, 0.252, z);
        this.torso.add(leg);
        this.legs.push(leg);
        this.box(leg, dark, 0, -0.12, 0, 0.105, 0.24, 0.105);
        this.box(leg, light, 0, -0.218, 0.015, 0.113, 0.069, 0.142);
      }
    }
    this.tail.position.set(0, 0.39, -0.345);
    this.torso.add(this.tail);
    this.box(this.tail, fur, 0, 0.085, -0.058, 0.083, 0.22, 0.11);
    this.box(this.tail, dark, 0, 0.205, -0.105, 0.083, 0.088, 0.148);
    this.box(this.tail, light, 0, 0.252, -0.157, 0.085, 0.081, 0.077);
    this.accessories = [
      this.box(this.torso, collar, 0, 0.334, 0.304, 0.265, 0.077, 0.16),
      this.box(this.torso, tag, 0, 0.307, 0.392, 0.062, 0.061, 0.038),
    ];
  }

  pose(time: number, phase: number, gait: number, creature: Creature): void {
    if (creature.kind !== "cat") return;
    for (const accessory of this.accessories) accessory.visible = creature.owned;
    this.root.scale.setScalar(creature.growsIn > 0 ? 0.64 : 1);
    const stride = Math.sin(time * 14 + phase);
    this.torso.position.y = Math.abs(stride) * gait * 0.037;
    for (const [index, leg] of this.legs.entries()) {
      leg.rotation.x = (index === 0 || index === 3 ? stride : -stride) * gait * 0.59;
    }
    this.tail.rotation.y = Math.sin(time * 2.9 + phase) * (0.23 + gait * 0.19);
    this.tail.rotation.x = -0.38 + Math.sin(time * 2.1 + phase) * 0.12;
  }
}
