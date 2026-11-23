import * as THREE from "three";
import { CreatureModel } from "./creature-model";

export const ROAMER_HEIGHT = 1.73;

const slate = new THREE.Color(0x555c71);
const edge = new THREE.Color(0x8893ab);
const dark = new THREE.Color(0x30394e);
const shale = new THREE.Color(0x726680);
const moss = new THREE.Color(0x619485);
const glow = new THREE.Color(0xa8ffca);

/** The Slate Roamer carries a green mineral core inside layered slabs. */
export class RoamerModel extends CreatureModel {
  private readonly torso = new THREE.Group();
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly core: THREE.Object3D;

  constructor() {
    super();
    this.root.add(this.torso);
    this.box(this.torso, dark, 0, 0.92, -0.036, 0.52, 0.62, 0.4);
    this.box(this.torso, slate, 0, 1.135, 0.012, 0.66, 0.31, 0.48);
    this.box(this.torso, edge, 0.038, 1.28, -0.02, 0.49, 0.065, 0.44);
    this.box(this.torso, dark, 0.035, 1.465, 0.035, 0.43, 0.33, 0.38);
    this.box(this.torso, slate, 0.035, 1.571, 0.058, 0.46, 0.155, 0.38);
    this.box(this.torso, shale, 0.157, 1.655, 0.002, 0.115, 0.135, 0.23);
    this.box(this.torso, shale, -0.098, 1.56, -0.182, 0.13, 0.19, 0.1);
    this.box(this.torso, moss, -0.12, 1.194, -0.238, 0.22, 0.12, 0.095);
    this.box(this.torso, edge, 0.034, 0.86, -0.232, 0.3, 0.11, 0.088);
    this.box(this.torso, moss, 0, 1.041, 0.231, 0.23, 0.26, 0.088);
    this.core = this.box(this.torso, glow, 0, 1.041, 0.279, 0.119, 0.174, 0.076, 0.94);
    this.core.rotation.z = Math.PI / 5;
    for (const side of [-1, 1]) {
      this.box(this.torso, glow, 0.035 + side * 0.099, 1.476, 0.229, 0.103, 0.046, 0.029, 0.93);
      const arm = new THREE.Group();
      arm.position.set(side * 0.367, side === -1 ? 1.24 : 1.18, -0.025);
      arm.rotation.z = side * 0.16;
      this.arms.push(arm);
      this.torso.add(arm);
      this.box(arm, dark, 0, -0.272, 0.015, 0.164, 0.545, 0.207);
      this.box(arm, side === -1 ? shale : slate, side * 0.02, -0.054, -0.016, 0.253, 0.21, 0.3);
      this.box(arm, edge, side * 0.025, -0.365, 0.009, 0.193, 0.122, 0.213);
      this.box(arm, shale, 0, -0.51, 0.021, 0.226, 0.19, 0.247);
      const leg = new THREE.Group();
      leg.position.set(side * 0.149, 0.626, -0.01);
      this.legs.push(leg);
      this.root.add(leg);
      this.box(leg, dark, 0, -0.261, -0.011, 0.209, 0.544, 0.214);
      this.box(leg, slate, 0, -0.369, 0.047, 0.23, 0.189, 0.146);
      this.box(leg, shale, 0, -0.548, 0.061, 0.243, 0.154, 0.338);
    }
  }

  pose(time: number, phase: number, gait: number): void {
    const stride = Math.sin(time * 8 + phase);
    this.torso.position.y = Math.abs(stride) * gait * 0.027;
    this.torso.rotation.y = stride * gait * 0.075;
    for (const [index, leg] of this.legs.entries()) {
      leg.rotation.x = stride * gait * (index === 0 ? 0.48 : -0.48);
    }
    for (const [index, arm] of this.arms.entries()) {
      arm.rotation.x = stride * gait * (index === 0 ? -0.35 : 0.35) - 0.08;
    }
    const pulse = Math.sin(time * 3 + phase) * 0.08;
    this.core.scale.set(0.119 * (1 + pulse), 0.174 * (1 + pulse), 0.076);
  }
}
