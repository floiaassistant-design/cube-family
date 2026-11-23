import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ROAMER_MAX_HEALTH, type Cat, type NightCreature } from "../game/wildlife";
import { CreatureModelView } from "./creature-model-view";

function setup() {
  const scene = new THREE.Scene();
  const view = new CreatureModelView(scene);
  const camera = new THREE.PerspectiveCamera(60, 1);
  camera.position.set(1_000_000, 64, 1_000_000);
  const cat: Cat = {
    id: "k:1",
    kind: "cat",
    owned: true,
    coat: 2,
    position: { x: camera.position.x + 2, y: camera.position.y, z: camera.position.z },
    rest: 0,
    growsIn: 0,
    moving: false,
  };
  // The WebGL mesh is independent of the overlay canvas.
  const canvas = {} as CanvasRenderingContext2D;
  const mesh = scene.getObjectByName("creature-models");
  if (!(mesh instanceof THREE.InstancedMesh)) throw new Error("Cat instances missing");
  const draw = (time: number): void => {
    view.beginFrame(camera, new Set([cat.id]));
    view.draw(canvas, cat, time, 0.09, 1);
    view.endFrame();
  };
  const transform = (index: number): THREE.Matrix4 => {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    return matrix;
  };
  return { mesh, cat, draw, transform, view, camera };
}

describe("3D cat rendering", () => {
  it("keeps the world orientation across camera angles and animates walking", () => {
    const { mesh, cat, draw, transform, camera } = setup();
    draw(0);
    expect(mesh.visible).toBe(true);
    const torso = transform(0);
    expect(new THREE.Vector3().setFromMatrixScale(torso).z).toBeCloseTo(0.64);
    camera.rotation.y = Math.PI;
    draw(0);
    expect(transform(0).equals(torso)).toBe(true);

    const before = transform(10);
    cat.position = { x: 1_000_002, y: 64, z: 1_000_000.1 };
    cat.moving = true;
    draw(0.25);
    expect(transform(10).equals(before)).toBe(false);
    const walking = transform(10);
    draw(0.7);
    expect(transform(10).equals(walking)).toBe(false);
  });

  it("scales kittens, only shows collars on adopted cats, and removes stale instances", () => {
    const { mesh, cat, draw, transform, view, camera } = setup();
    draw(0);
    const adultCount = mesh.count;
    const adultLength = new THREE.Vector3().setFromMatrixScale(transform(0)).z;
    cat.growsIn = 225;
    draw(0);
    const kittenLength = new THREE.Vector3().setFromMatrixScale(transform(0)).z;
    expect(kittenLength / adultLength).toBeCloseTo(0.64);
    expect(mesh.count).toBe(adultCount);
    cat.owned = false;
    draw(0);
    expect(mesh.count).toBe(adultCount - 2);
    view.beginFrame(camera, new Set());
    view.endFrame();
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);
  });
});

describe("3D slate roamer rendering", () => {
  it("renders with the cat, animates and clears when the enemy leaves the frame", () => {
    const { mesh, cat, view, camera, transform } = setup();
    const roamer: NightCreature = {
      id: "roamer:0",
      kind: "roamer",
      health: ROAMER_MAX_HEALTH,
      position: { x: 1_000_003, y: 64, z: 1_000_002 },
      moving: true,
    };
    const canvas = {} as CanvasRenderingContext2D;
    const ids = new Set([cat.id, roamer.id]);
    const draw = (time: number, creatures = [roamer, cat]): void => {
      view.beginFrame(camera, ids);
      for (const creature of creatures) view.draw(canvas, creature, time, 0.09, 0.36);
      view.endFrame();
    };
    draw(0);
    const both = mesh.count;
    const leg = transform(17);
    const color = new THREE.Color();
    mesh.getColorAt(11, color);
    expect(color.g).toBeGreaterThan(0.85);
    draw(0.25);
    expect(transform(17).equals(leg)).toBe(false);
    ids.delete(roamer.id);
    draw(0.25, [cat]);
    expect(mesh.count).toBeLessThan(both);
    expect(mesh.visible).toBe(true);
  });
});
