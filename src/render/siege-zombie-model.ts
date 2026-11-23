import * as THREE from "three";
import type { Creature } from "../game/wildlife";
import { CreatureModel } from "./creature-model";

const skin = new THREE.Color(0x6e9e62);
const shadow = new THREE.Color(0x3d6a49);
const coat = new THREE.Color(0x335c85);
const denim = new THREE.Color(0x35455e);
const rust = new THREE.Color(0x9a6040);
const bone = new THREE.Color(0xe6dec0);
const dark = new THREE.Color(0x192c31);
const armor = new THREE.Color(0x9299a3);

/** Original voxel undead, reused by the WebGL and software creature renderers. */
export class SiegeZombieModel extends CreatureModel {
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly helmet: THREE.Object3D;
  private readonly breastplate: THREE.Object3D;

  constructor() {
    super();
    this.box(this.root, coat, 0, 1.03, 0, 0.63, 0.72, 0.35);
    this.box(this.root, rust, -0.2, 0.98, 0.181, 0.16, 0.29, 0.04);
    this.box(this.root, skin, 0, 1.56, 0.02, 0.52, 0.5, 0.5);
    this.box(this.root, shadow, -0.165, 1.52, 0.277, 0.10, 0.09, 0.04);
    this.box(this.root, shadow, 0.165, 1.52, 0.277, 0.10, 0.09, 0.04);
    this.box(this.root, dark, 0, 1.36, 0.28, 0.26, 0.07, 0.045);
    this.box(this.root, bone, -0.045, 1.355, 0.309, 0.05, 0.05, 0.02);
    this.helmet = this.box(this.root, armor, 0, 1.84, 0, 0.61, 0.24, 0.58);
    this.breastplate = this.box(this.root, armor, 0, 1.065, 0.19, 0.68, 0.47, 0.13);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.41, 1.29, 0);
      this.root.add(arm);
      this.arms.push(arm);
      this.box(arm, coat, 0, -0.18, 0, 0.25, 0.35, 0.29);
      this.box(arm, skin, 0, -0.49, 0, 0.22, 0.32, 0.24);
      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.7, 0);
      this.root.add(leg);
      this.legs.push(leg);
      this.box(leg, denim, 0, -0.32, 0, 0.26, 0.67, 0.31);
      this.box(leg, dark, 0, -0.62, 0.08, 0.27, 0.15, 0.41);
    }
  }

  pose(time: number, phase: number, gait: number, creature: Creature): void {
    if (creature.kind !== "siege-zombie") return;
    const armored = creature.variant === "armored" || creature.variant === "boss";
    this.helmet.visible = armored;
    this.breastplate.visible = armored;
    this.root.scale.setScalar(creature.variant === "boss" ? 1.32 : 1);
    const walk = Math.sin(time * 7 + phase) * gait;
    for (const [index, arm] of this.arms.entries()) {
      arm.rotation.x = -0.75 + walk * (index ? 0.25 : -0.25);
    }
    for (const [index, leg] of this.legs.entries()) {
      leg.rotation.x = walk * (index ? -0.5 : 0.5);
    }
  }
}
