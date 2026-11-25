import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DRILL_AXIS_HEIGHT, type FlyingDrill } from "../game/flight-drill";
import type { Vec3 } from "../player/physics";

const material = new THREE.MeshBasicMaterial({ vertexColors: true });
const COLORS = {
  dark: 0x242932,
  frame: 0x46515b,
  steel: 0x7f8c97,
  edge: 0xb6c9cd,
  copper: 0xb96828,
  ochre: 0xe98d2e,
  brass: 0xffc36a,
  lamp: 0xffe5a1,
  cyan: 0x26b7dd,
  core: 0x9ef8ff,
  leather: 0x664539,
  suit: 0x26536b,
  scarf: 0xd24528,
  skin: 0xf0b78d,
};

type Color = keyof typeof COLORS;

/** Build a single indexed mesh for each moving assembly, shared by both renderers. */
class Assembly {
  private readonly parts: THREE.BufferGeometry[] = [];

  private add(geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: Color) {
    geometry.translate(x, y, z);
    const normals = geometry.getAttribute("normal");
    const values = new Float32Array(normals.count * 3);
    const base = new THREE.Color(COLORS[color]);
    const tint = new THREE.Color();
    for (let i = 0; i < normals.count; i++) {
      const direction = normals.getX(i) * -0.24 + normals.getY(i) * 0.45 + normals.getZ(i) * -0.2;
      const lit = color === "lamp" || color === "core" ? 1 : 0.77 + direction * 0.45;
      tint
        .copy(base)
        .multiplyScalar(lit)
        .toArray(values, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    this.parts.push(geometry);
  }

  box(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    length: number,
    color: Color,
  ) {
    this.add(new THREE.BoxGeometry(width, height, length), x, y, z, color);
  }

  axial(z: number, back: number, front: number, length: number, color: Color, y = 0) {
    const shell = new THREE.CylinderGeometry(front, back, length, 8);
    shell.rotateX(-Math.PI / 2);
    this.add(shell, 0, y, z, color);
  }

  teeth(z: number, count: number, radius: number, width: number, length: number, angle: number) {
    for (let i = 0; i < count; i++) {
      const phase = angle + (i * Math.PI * 2) / count;
      const tooth = new THREE.BoxGeometry(width, 0.16, length);
      tooth.rotateY(-0.38).rotateZ(phase);
      this.add(
        tooth,
        -Math.sin(phase) * radius,
        Math.cos(phase) * radius,
        z,
        i % 2 ? "edge" : "steel",
      );
    }
  }

  mount(parent: THREE.Object3D) {
    parent.add(new THREE.Mesh(mergeGeometries(this.parts), material));
    for (const part of this.parts) part.dispose();
  }
}

function buildHull(root: THREE.Group): void {
  const hull = new Assembly();
  hull.box(0, 1.03, 0.08, 1.42, 0.7, 2.49, "frame");
  hull.box(0, 0.72, 0.14, 1.22, 0.27, 2.38, "dark");
  hull.box(0, 1.4, 0.03, 1.05, 0.13, 1.7, "steel");
  hull.box(0, 1.48, 0.59, 0.7, 0.2, 0.64, "leather");
  hull.box(0, 1.81, 0.86, 0.7, 0.65, 0.19, "dark");
  hull.box(0, 1.94, 0.744, 0.55, 0.42, 0.08, "leather");
  hull.box(0, 1.58, -0.72, 0.82, 0.32, 0.34, "copper");
  hull.box(0, 1.76, -0.63, 0.62, 0.09, 0.24, "frame");
  hull.box(0, 1.82, -0.61, 0.25, 0.03, 0.13, "cyan");

  hull.axial(-1.2, 0.73, 0.77, 0.31, "copper", DRILL_AXIS_HEIGHT);
  hull.axial(-1.39, 0.77, 0.76, 0.11, "brass", DRILL_AXIS_HEIGHT);
  hull.axial(1.41, 0.75, 0.66, 0.58, "frame", 1.17);
  hull.axial(1.62, 0.77, 0.74, 0.2, "copper", 1.17);
  hull.axial(1.82, 0.66, 0.63, 0.28, "dark", 1.17);
  hull.axial(1.98, 0.57, 0.54, 0.11, "cyan", 1.17);
  hull.axial(2.04, 0.39, 0.39, 0.05, "core", 1.17);

  for (const side of [-1, 1]) {
    hull.box(side * 0.7, 1.25, 0.13, 0.25, 0.44, 2.28, "copper");
    hull.box(side * 0.84, 1.39, -0.08, 0.07, 0.19, 1.51, "ochre");
    hull.box(side * 0.89, 1.37, -0.16, 0.045, 0.084, 0.71, "lamp");
    hull.box(side * 0.84, 1.07, 0.51, 0.14, 0.39, 0.58, "dark");
    hull.box(side * 0.85, 1.66, 0.75, 0.22, 0.33, 0.61, "copper");
    hull.box(side * 0.86, 1.83, 0.77, 0.25, 0.12, 0.57, "ochre");
    hull.box(side * 0.64, 1.21, -1.46, 0.23, 0.43, 0.32, "dark");
    hull.box(side * 0.64, 1.23, -1.64, 0.15, 0.19, 0.08, "lamp");
    hull.box(side * 0.55, 0.16, 0.1, 0.22, 0.22, 1.91, "dark");
    hull.box(side * 0.55, 0.35, -0.57, 0.13, 0.23, 0.15, "frame");
    for (const z of [-0.93, 0.32, 0.96]) {
      hull.box(side * 0.91, 1.32, z, 0.06, 0.09, 0.09, "edge");
    }
  }
  hull.mount(root);
}

function buildCutter(root: THREE.Group): void {
  const cutter = new Assembly();
  cutter.axial(-0.16, 0.66, 0.7, 0.29, "dark");
  cutter.axial(-0.38, 0.69, 0.59, 0.34, "steel");
  cutter.axial(-0.67, 0.59, 0.46, 0.38, "frame");
  cutter.axial(-1.02, 0.46, 0.34, 0.38, "steel");
  cutter.axial(-1.37, 0.35, 0.22, 0.35, "frame");
  cutter.axial(-1.65, 0.24, 0.1, 0.33, "steel");
  cutter.axial(-1.89, 0.12, 0.013, 0.22, "edge");
  for (let tier = 0; tier < 5; tier++) {
    cutter.teeth(
      -0.35 - tier * 0.31,
      5,
      0.635 - tier * 0.108,
      0.28 - tier * 0.031,
      0.28,
      tier * 0.51,
    );
  }
  cutter.mount(root);
}

function buildPilot(root: THREE.Group): void {
  const pilot = new Assembly();
  pilot.box(0, 1.8, 0.35, 0.5, 0.54, 0.39, "suit");
  pilot.box(0, 2.07, 0.32, 0.51, 0.13, 0.41, "scarf");
  pilot.box(-0.14, 1.99, 0.53, 0.22, 0.1, 0.23, "scarf");
  pilot.box(0, 2.33, 0.29, 0.44, 0.44, 0.44, "skin");
  pilot.box(0, 2.56, 0.31, 0.51, 0.17, 0.51, "leather");
  pilot.box(0, 2.56, 0.048, 0.54, 0.09, 0.05, "ochre");
  for (const side of [-1, 1]) {
    pilot.box(side * 0.205, 2.37, 0.42, 0.105, 0.28, 0.19, "leather");
    pilot.box(side * 0.12, 2.55, 0.011, 0.18, 0.14, 0.065, "brass");
    pilot.box(side * 0.12, 2.55, -0.025, 0.11, 0.079, 0.02, "cyan");
    pilot.box(side * 0.11, 2.32, 0.064, 0.05, 0.075, 0.02, "dark");
    pilot.box(side * 0.31, 1.88, 0.11, 0.19, 0.23, 0.44, "suit");
    pilot.box(side * 0.31, 1.82, -0.24, 0.17, 0.18, 0.23, "leather");
    pilot.box(side * 0.18, 1.52, -0.05, 0.21, 0.19, 0.62, "dark");
  }
  pilot.mount(root);
}

/** Original procedural model based on the approved concept sheet. */
export class FlyingDrillModel {
  private readonly root = new THREE.Group();
  private readonly cutter = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly pilot = new THREE.Group();
  private readonly exhaust = new THREE.Group();
  private readonly jets = new THREE.Group();
  private phase = 0;

  constructor(scene: THREE.Scene | null) {
    buildHull(this.root);
    buildCutter(this.rotor);
    this.cutter.position.y = DRILL_AXIS_HEIGHT;
    this.rotor.position.z = -1.48;
    this.cutter.add(this.rotor);
    buildPilot(this.pilot);

    const thrusters = new Assembly();
    const jets = new Assembly();
    for (const side of [-1, 1]) {
      thrusters.box(side * 0.65, 0.52, 0.58, 0.45, 0.34, 0.58, "dark");
      thrusters.box(side * 0.66, 0.39, 0.58, 0.44, 0.13, 0.57, "copper");
      thrusters.box(side * 0.66, 0.33, 0.58, 0.34, 0.066, 0.43, "lamp");
      jets.box(side * 0.66, -0.18, 0.58, 0.28, 0.38, 0.33, "cyan");
      jets.box(side * 0.66, -0.24, 0.58, 0.14, 0.52, 0.16, "core");
    }
    thrusters.mount(this.root);
    jets.mount(this.jets);
    this.jets.position.y = 0.31;

    const exhaust = new Assembly();
    exhaust.axial(0.14, 0.22, 0.38, 0.33, "cyan");
    exhaust.axial(0.39, 0.045, 0.23, 0.36, "core");
    exhaust.mount(this.exhaust);
    this.exhaust.position.set(0, 1.17, 2.04);
    this.root.add(this.cutter, this.pilot, this.jets, this.exhaust);
    this.root.visible = false;
    scene?.add(this.root);
  }

  get visibleModel(): THREE.Group | null {
    return this.root.visible ? this.root : null;
  }

  update(
    dt: number,
    drill: FlyingDrill,
    position: Vec3 | null,
    distance: number,
    mounted: boolean,
  ) {
    this.root.visible = position !== null && (mounted || distance < 62);
    if (!position || !this.root.visible) return;
    this.root.position.set(position.x, position.y, position.z);
    this.root.rotation.y = drill.yaw;
    this.cutter.rotation.x = mounted ? drill.pitch : 0;
    this.pilot.visible = mounted;
    this.exhaust.visible = this.jets.visible = drill.flying;
    this.phase += dt;
    if (drill.drilling) this.rotor.rotation.z += dt * 18;
    this.exhaust.scale.z =
      0.73 +
      Math.min(1.25, Math.hypot(drill.velocity.x, drill.velocity.z) / 10) +
      Math.sin(this.phase * 26) * 0.12;
    this.jets.scale.y = 0.85 + Math.sin(this.phase * 22) * 0.18;
  }
}
