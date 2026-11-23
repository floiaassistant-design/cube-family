import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import modelUrl from "../../assets/3d/dragon-rouge/dragon_voxel_rouge_v03.glb.gz?url";
import {
  DRAGON_FOOT_OFFSET,
  DRAGON_SCALE,
  DRAGON_SEAT_HEIGHT,
  type DragonMount,
} from "../game/dragon";
import type { Vec3 } from "../player/physics";
import { ATMOSPHERE, OUTPUT } from "./shaders/common";
import type { UniformMap } from "./terrain-material";

const VERTEX = /* glsl */ `
  out vec3 vColor;
  out vec3 vWorldNormal;
  out vec3 vRelative;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vRelative = world.xyz - cameraPosition;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vColor = color.rgb;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbientSky;
  uniform vec3 uAmbientGround;
  ${ATMOSPHERE}
  ${OUTPUT}
  in vec3 vColor;
  in vec3 vWorldNormal;
  in vec3 vRelative;
  out vec4 fragColor;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 ambient = mix(uAmbientGround, uAmbientSky, normal.y * 0.5 + 0.5);
    float key = max(0.0, dot(normal, uLightDir));
    vec3 light = vec3(0.20) + ambient * 0.82 + uLightColor * (0.72 * key);
    vec3 color = vColor * mix(light, vec3(0.15), uCave);
    fragColor = outputColor(applyFog(color, vRelative), 1.0);
  }
`;

/** The player uses first-person controls on foot. The chase camera gives
 * them a simple voxel rider they can see on the saddle. */
function makeRider(material: THREE.Material): THREE.Mesh {
  const boxes: THREE.BufferGeometry[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    hex: number,
  ): void => {
    const geometry = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const color = new THREE.Color(hex);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    boxes.push(geometry);
  };
  box(0, 0.37, 0, 0.58, 0.64, 0.39, 0x4389a6);
  box(0, 0.89, -0.05, 0.43, 0.45, 0.41, 0xd39a69);
  box(0, 1.08, -0.03, 0.49, 0.2, 0.46, 0x443026);
  box(0, 0.47, 0.23, 0.39, 0.4, 0.2, 0x694831);
  for (const side of [-1, 1]) {
    box(side * 0.37, 0.42, -0.17, 0.19, 0.22, 0.46, 0x4389a6);
    box(side * 0.37, 0.41, -0.43, 0.16, 0.18, 0.17, 0xd39a69);
    box(side * 0.4, 0.02, -0.16, 0.24, 0.25, 0.48, 0x263b53);
    box(side * 0.47, -0.22, -0.28, 0.2, 0.42, 0.25, 0x263b53);
    box(side * 0.47, -0.44, -0.36, 0.23, 0.19, 0.38, 0x513729);
  }
  const geometry = mergeGeometries(boxes);
  for (const part of boxes) part.dispose();
  return new THREE.Mesh(geometry, material);
}

export class DragonModel {
  private readonly root = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly rider: THREE.Mesh;
  private wings: THREE.Object3D[] = [];
  private legs: THREE.Object3D[] = [];
  private tail: THREE.Object3D[] = [];
  private phase = 0;
  private wingFlex = 0;
  private stride = 0;
  private loading = false;
  ready = false;

  constructor(scene: THREE.Scene | null, shared: UniformMap = {}, direct = true) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: shared,
      defines: direct ? { DIRECT_OUTPUT: "" } : {},
      vertexColors: true,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.rider = makeRider(this.material);
    this.rider.visible = false;
    this.root.add(this.rider);
    this.root.visible = false;
    scene?.add(this.root);
  }

  get visibleModel(): THREE.Group | null {
    return this.root.visible ? this.root : null;
  }

  setDirect(direct: boolean): void {
    this.material.defines = direct ? { DIRECT_OUTPUT: "" } : {};
    this.material.needsUpdate = true;
  }

  private async load(): Promise<void> {
    const [{ GLTFLoader }, response] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      fetch(modelUrl),
    ]);
    if (!response.ok) throw new Error(`Dragon model: HTTP ${response.status.toString()}`);
    const bytes = await response.arrayBuffer();
    const compressed = new Uint8Array(bytes, 0, 2);
    const glb =
      compressed[0] === 0x1f && compressed[1] === 0x8b
        ? await new Response(
            new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer()
        : bytes;
    const { scene } = await new GLTFLoader().parseAsync(glb, "");
    scene.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
      ),
    );
    scene.scale.setScalar(DRAGON_SCALE);
    scene.position.y = -DRAGON_FOOT_OFFSET * DRAGON_SCALE;
    const part = (name: string): THREE.Object3D => {
      const node = scene.getObjectByName(name);
      if (!node) throw new Error(`Missing dragon node: ${name}`);
      return node;
    };
    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry = node.geometry as THREE.BufferGeometry;
      geometry.computeVertexNormals();
      node.material = this.material;
    });
    this.wings = ["Gauche", "Droite"].map((side) => part(`07_Aile_${side}`));
    this.legs = ["Avant_Gauche", "Avant_Droite", "Arriere_Droite", "Arriere_Gauche"].map((leg) =>
      part(`02_Patte_${leg}`),
    );
    this.tail = Array.from({ length: 6 }, (_, i) => part(`05_Queue_0${(i + 1).toString()}`));
    this.tail.push(part("06_Queue_Flamme"));
    for (let i = this.tail.length - 1; i > 0; i--) {
      const section = this.tail[i];
      if (section) this.tail[i - 1]?.attach(section);
    }
    const seat = part("SeatAnchor");
    scene.updateMatrixWorld(true);
    seat.getWorldPosition(this.rider.position);
    if (Math.abs(this.rider.position.y - DRAGON_SEAT_HEIGHT) > 0.001) {
      throw new Error("Dragon saddle height does not match the mount");
    }
    this.root.add(scene);
    this.ready = true;
  }

  update(dt: number, mount: DragonMount, position: Vec3, distance: number, mounted: boolean): void {
    if (!this.loading && distance < 56) {
      this.loading = true;
      void this.load().catch((error: unknown) => {
        console.warn("Dragon model unavailable:", error);
      });
    }
    this.root.visible = this.ready && (mounted || distance < 62);
    if (!this.root.visible) return;
    this.root.position.set(position.x, position.y, position.z);
    this.root.rotation.y = mount.yaw;
    this.rider.visible = mounted;
    if (distance > 40) return;

    const speed = Math.hypot(mount.velocity.x, mount.velocity.z);
    const climbing = mount.velocity.y > 0.5;
    const gliding = mount.flying && !climbing && speed > 6;
    const amplitude = mount.flying ? (gliding ? 0.08 : 0.43) : 0.045;
    this.phase = (this.phase + dt * (mount.flying ? (gliding ? 3.2 : 8.5) : 2.1)) % (Math.PI * 2);
    this.wingFlex += (amplitude - this.wingFlex) * (1 - Math.exp(-dt * 6));
    const flap = Math.sin(this.phase) * this.wingFlex - (mount.flying ? 0.24 : 0);
    this.wings.forEach((wing, i) => {
      wing.rotation.x = i === 0 ? -flap : flap;
    });

    const gait = mount.flying ? 0 : Math.min(1, speed / 4);
    this.stride = (this.stride + speed * dt * 1.75) % (Math.PI * 2);
    this.legs.forEach((leg, i) => {
      leg.rotation.y = mount.flying
        ? 0.22
        : Math.sin(this.stride + (i < 2 ? 0 : Math.PI)) * gait * 0.32;
    });
    this.tail.forEach((section, i) => {
      section.rotation.z = Math.sin(this.phase * 0.55 - i * 0.49) * (mount.flying ? 0.035 : 0.06);
    });
  }
}
