import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MINING_PICK } from "../game/items";
import { BlockId } from "../world/blocks";
import { HeldBlock } from "./held-block";

describe("the first-person item", () => {
  it("swaps a block for the pick, keeps the pick shader, and hides the hand on request", () => {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9);
    const hand = new HeldBlock(camera, {}, true);
    const group = camera.children[0];
    const meshes = group?.children.filter((child) => child instanceof THREE.Mesh) ?? [];
    const [cube, , pick] = meshes;
    if (!group || !cube || !pick || !(pick.material instanceof THREE.ShaderMaterial)) {
      throw new Error("Missing hand meshes");
    }

    const tick = (dt: number, visible: boolean): void => {
      hand.update(dt, { x: 0, y: 0 }, [1, 1, 1], visible);
    };
    hand.setItem(BlockId.DIRT);
    tick(0.01, true);
    expect(cube.visible).toBe(true);
    expect(pick.visible).toBe(false);

    hand.setItem(MINING_PICK);
    tick(0.25, true);
    expect(cube.visible).toBe(false);
    expect(pick.visible).toBe(true);
    const geometry: unknown = pick.geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) throw new Error("Missing pick geometry");
    const positions: unknown = geometry.getAttribute("position");
    const colors: unknown = geometry.getAttribute("pickColor");
    if (
      !(positions instanceof THREE.BufferAttribute) ||
      !(colors instanceof THREE.BufferAttribute)
    ) {
      throw new Error("Missing voxel attributes");
    }
    expect(positions.count).toBeGreaterThan(24);
    expect(colors.count).toBe(positions.count);

    hand.setDirect(false);
    expect(pick.material.defines).toEqual({ MINING_PICK: "" });
    hand.setItem(BlockId.DIRT);
    hand.setItem(MINING_PICK);
    tick(0.25, true);
    expect(pick.visible).toBe(true);
    hand.setItem(BlockId.DIRT);
    tick(0.25, true);
    expect(pick.visible).toBe(false);
    expect(cube.visible).toBe(true);
    tick(0.01, false);
    expect(group.visible).toBe(false);
  });
});
