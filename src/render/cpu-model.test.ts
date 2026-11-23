import * as THREE from "three";
import { expect, it } from "vitest";
import { CpuModelRenderer } from "./cpu-model";

it("draws a colored mesh only where it is in front of the terrain", () => {
  const renderer = new CpuModelRenderer();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 30);
  camera.position.z = 4;
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) colors[i] = 1;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry));
  const width = 40;
  const image: ImageData = {
    width,
    height: width,
    data: new Uint8ClampedArray(width * width * 4),
    colorSpace: "srgb",
  };
  const depth = new Float32Array(width * width).fill(30);
  const occluded = 20 * width + 18;
  const visible = 20 * width + 22;
  depth[occluded] = 1.5;

  expect(renderer.prepare(camera, root)).toBe(true);
  renderer.draw(root, image, depth, 1);
  expect(image.data[visible * 4]).toBeGreaterThan(100);
  expect(depth[visible]).toBeCloseTo(3);
  expect(image.data[occluded * 4]).toBe(0);
  expect(depth[occluded]).toBe(1.5);
});
