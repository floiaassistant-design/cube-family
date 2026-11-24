import * as THREE from "three";
import type { FlyingDrill } from "../game/flight-drill";
import type { Vec3 } from "../player/physics";

/** Original, procedural voxel model: no network asset or extra dependency. */
export class FlyingDrillModel {
  private readonly root = new THREE.Group();
  private readonly cutter = new THREE.Group();
  private readonly rider = new THREE.Group();
  private readonly jets: THREE.Group[] = [];
  private phase = 0;
  ready = true;

  constructor(scene: THREE.Scene | null) {
    const orange = new THREE.MeshBasicMaterial({ color: 0xc77a27 });
    const gold = new THREE.MeshBasicMaterial({ color: 0xffb83f });
    const steel = new THREE.MeshBasicMaterial({ color: 0x939fab });
    const pale = new THREE.MeshBasicMaterial({ color: 0xdce2dc });
    const dark = new THREE.MeshBasicMaterial({ color: 0x2b333f });
    const blue = new THREE.MeshBasicMaterial({ color: 0x47dfff });
    const skin = new THREE.MeshBasicMaterial({ color: 0xe6af85 });
    const cloth = new THREE.MeshBasicMaterial({ color: 0x3976a6 });

    // CPU fallback uses vertex colors, not material.color, for its triangle rasteriser.
    const paint = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const count = geometry.getAttribute("position").count;
      const tint = material instanceof THREE.MeshBasicMaterial ? material.color : new THREE.Color();
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) tint.toArray(colors, i * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return geometry;
    };

    const box = (
      parent: THREE.Group,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      material: THREE.Material,
    ): void => {
      const mesh = new THREE.Mesh(paint(new THREE.BoxGeometry(sx, sy, sz), material), material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };
    const ring = (
      parent: THREE.Group,
      z: number,
      radius: number,
      depth: number,
      material: THREE.Material,
    ): void => {
      const mesh = new THREE.Mesh(
        paint(new THREE.CylinderGeometry(radius, radius, depth, 8), material),
        material,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = z;
      parent.add(mesh);
    };

    box(this.root, 0, 1.15, 0, 1.75, 0.84, 2.95, orange);
    box(this.root, 0, 1.1, -0.4, 1.89, 0.66, 1.24, steel);
    box(this.root, 0, 1.72, 0.18, 1.4, 0.25, 1.75, gold);
    box(this.root, 0, 0.83, 0.36, 1.57, 0.22, 1.65, dark);
    // Reinforced cockpit, visible handles, suspended landing skids.
    for (const side of [-1, 1]) {
      box(this.root, side * 0.73, 1.63, 0.24, 0.18, 0.64, 1.42, steel);
      box(this.root, side * 0.92, 1.24, -0.3, 0.22, 0.42, 0.85, gold);
      box(this.root, side * 0.76, 0.39, 0.45, 0.21, 0.18, 2.1, dark);
      box(this.root, side * 0.76, 0.55, 0.45, 0.14, 0.41, 0.14, steel);
      box(this.root, side * 0.32, 1.94, -0.25, 0.1, 0.12, 0.64, dark);
      // Downward stabilising thrusters.
      const jet = new THREE.Group();
      box(jet, 0, 0, 0, 0.48, 0.27, 0.48, steel);
      box(jet, 0, -0.18, 0, 0.34, 0.25, 0.34, blue);
      jet.position.set(side * 0.67, 0.45, -0.7);
      this.root.add(jet);
      this.jets.push(jet);
    }
    // Axial rotating cutting head, copper rings and eight jagged teeth.
    this.cutter.position.set(0, 1.18, -1.65);
    ring(this.cutter, -0.12, 0.78, 0.42, dark);
    ring(this.cutter, -0.33, 0.72, 0.23, gold);
    ring(this.cutter, -0.55, 0.64, 0.25, steel);
    ring(this.cutter, -0.75, 0.49, 0.25, pale);
    ring(this.cutter, -0.96, 0.34, 0.22, steel);
    ring(this.cutter, -1.18, 0.17, 0.3, pale);
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const tooth = new THREE.Mesh(paint(new THREE.BoxGeometry(0.19, 0.23, 0.43), steel), steel);
      tooth.position.set(Math.sin(angle) * 0.68, Math.cos(angle) * 0.68, -0.49);
      tooth.rotation.z = -angle;
      this.cutter.add(tooth);
    }
    this.root.add(this.cutter);
    // Rear jet with animated luminous core.
    ring(this.root, 1.5, 0.74, 0.32, dark);
    ring(this.root, 1.68, 0.57, 0.23, steel);
    ring(this.root, 1.84, 0.44, 0.17, blue);
    box(this.root, 0, 1.42, 2.02, 0.55, 0.55, 0.34, blue);
    // Pilot: head, goggles, torso, arms, hands and boots, visible in chase camera.
    box(this.rider, 0, 0, 0, 0.58, 0.56, 0.43, cloth);
    box(this.rider, 0, 0.51, 0, 0.46, 0.46, 0.43, skin);
    box(this.rider, 0, 0.79, 0.015, 0.5, 0.19, 0.46, dark);
    for (const side of [-1, 1]) {
      box(this.rider, side * 0.15, 0.59, -0.23, 0.18, 0.17, 0.12, blue);
      box(this.rider, side * 0.4, -0.09, -0.19, 0.2, 0.5, 0.2, cloth);
      box(this.rider, side * 0.4, -0.3, -0.39, 0.21, 0.18, 0.34, skin);
      box(this.rider, side * 0.23, -0.51, 0.18, 0.27, 0.22, 0.55, dark);
    }
    this.rider.position.set(0, 2.22, 0.33);
    this.root.add(this.rider);
    this.rider.visible = false;
    this.root.visible = false;
    scene?.add(this.root);
  }

  get visibleModel(): THREE.Group | null {
    return this.root.visible ? this.root : null;
  }

  update(dt: number, drill: FlyingDrill, position: Vec3, distance: number, mounted: boolean): void {
    this.root.visible = mounted || distance < 62;
    if (!this.root.visible) return;
    this.root.position.set(position.x, position.y, position.z);
    this.root.rotation.y = drill.yaw;
    this.root.rotation.x = mounted ? -drill.pitch * 0.65 : 0;
    this.rider.visible = mounted;
    this.phase += dt;
    if (drill.drilling) this.cutter.rotation.z += dt * 17;
    for (const jet of this.jets) {
      jet.scale.y = drill.flying ? 1 + Math.sin(this.phase * 20) * 0.16 : 0.6;
    }
  }
}
