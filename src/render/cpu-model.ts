import * as THREE from "three";

/** Depth-tested triangles from a Three.js model, drawn into the raycaster's
 * existing image. No WebGL context or second model is required. */
export class CpuModelRenderer {
  private readonly viewProjection = new THREE.Matrix4();
  private readonly clipMatrix = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private readonly bounds = new THREE.Sphere(new THREE.Vector3(), 7);
  private readonly vertex = new THREE.Vector4();
  private readonly tint = new THREE.Color();
  private readonly faceColors = new WeakMap<THREE.BufferGeometry, Uint32Array>();
  private projected = new Float32Array(0);

  prepare(camera: THREE.PerspectiveCamera, root: THREE.Object3D): boolean {
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    this.bounds.center.copy(root.position);
    this.bounds.center.y += 2;
    return (
      camera.position.distanceToSquared(this.bounds.center) < 32 ** 2 &&
      this.frustum.intersectsSphere(this.bounds)
    );
  }

  draw(root: THREE.Object3D, image: ImageData, depth: Float32Array, light: number): void {
    root.updateMatrixWorld();
    root.traverseVisible((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      this.drawMesh(node, node.geometry as THREE.BufferGeometry, image, depth, light);
    });
  }

  private colors(geometry: THREE.BufferGeometry): Uint32Array {
    const cached = this.faceColors.get(geometry);
    if (cached) return cached;
    const indices = geometry.getIndex();
    const color = geometry.getAttribute("color");
    const normal = geometry.getAttribute("normal");
    const faces = new Uint32Array(Math.floor((indices?.count ?? 0) / 3));
    if (!indices || !geometry.hasAttribute("color") || !geometry.hasAttribute("normal"))
      return faces;
    for (let face = 0; face < faces.length; face++) {
      const vertex = indices.getX(face * 3);
      // Most faces are planar voxel faces. A fixed fill keeps the
      // six sides legible independently of the raycaster's sky lighting.
      const shade =
        0.62 +
        0.17 * Math.abs(normal.getX(vertex)) +
        0.12 * Math.max(0, normal.getY(vertex), normal.getZ(vertex));
      this.tint
        .setRGB(color.getX(vertex), color.getY(vertex), color.getZ(vertex))
        .multiplyScalar(shade);
      faces[face] = this.tint.getHex();
    }
    this.faceColors.set(geometry, faces);
    return faces;
  }

  private drawMesh(
    mesh: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    image: ImageData,
    depth: Float32Array,
    light: number,
  ): void {
    const indices = geometry.getIndex();
    const vertices = geometry.getAttribute("position");
    if (!indices || !geometry.hasAttribute("position")) return;
    if (this.projected.length < vertices.count * 3) {
      this.projected = new Float32Array(vertices.count * 3);
    }
    const projected = this.projected;
    this.clipMatrix.multiplyMatrices(this.viewProjection, mesh.matrixWorld);
    const { width, height, data } = image;
    for (let i = 0; i < vertices.count; i++) {
      const point = this.vertex
        .set(vertices.getX(i), vertices.getY(i), vertices.getZ(i), 1)
        .applyMatrix4(this.clipMatrix);
      const invZ = point.w >= 0.14 ? 1 / point.w : 0;
      projected[i * 3] = (point.x * invZ + 1) * width * 0.5;
      projected[i * 3 + 1] = (1 - point.y * invZ) * height * 0.5;
      projected[i * 3 + 2] = invZ;
    }

    const colors = this.colors(geometry);
    for (let face = 0; face < colors.length; face++) {
      const ai = indices.getX(face * 3) * 3;
      const bi = indices.getX(face * 3 + 1) * 3;
      const ci = indices.getX(face * 3 + 2) * 3;
      const az = projected[ai + 2] ?? 0;
      const bz = projected[bi + 2] ?? 0;
      const cz = projected[ci + 2] ?? 0;
      if (az === 0 || bz === 0 || cz === 0) continue;
      const ax = projected[ai] ?? 0;
      const ay = projected[ai + 1] ?? 0;
      const bx = projected[bi] ?? 0;
      const by = projected[bi + 1] ?? 0;
      const cx = projected[ci] ?? 0;
      const cy = projected[ci + 1] ?? 0;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (area >= -0.001) continue;
      const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const right = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx)));
      const bottom = Math.min(height - 1, Math.floor(Math.max(ay, by, cy)));
      if (left > right || top > bottom) continue;

      const weightAX = (by - cy) / area;
      const weightAY = (cx - bx) / area;
      const weightBX = (cy - ay) / area;
      const weightBY = (ax - cx) / area;
      const rgb = colors[face] ?? 0;
      const red = (rgb >> 16) * light;
      const green = ((rgb >> 8) & 255) * light;
      const blue = (rgb & 255) * light;
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          const wa = weightAX * (x + 0.5 - bx) + weightAY * (y + 0.5 - by);
          const wb = weightBX * (x + 0.5 - cx) + weightBY * (y + 0.5 - cy);
          const wc = 1 - wa - wb;
          if (Math.min(wa, wb, wc) < -0.00001) continue;
          const z = 1 / (wa * az + wb * bz + wc * cz);
          const pixel = y * width + x;
          if (z >= (depth[pixel] ?? 0)) continue;
          depth[pixel] = z;
          data[pixel * 4] = red;
          data[pixel * 4 + 1] = green;
          data[pixel * 4 + 2] = blue;
        }
      }
    }
  }
}
