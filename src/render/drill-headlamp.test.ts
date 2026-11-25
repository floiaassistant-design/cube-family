import { expect, it } from "vitest";
import { drillHeadlamp, headlampAt, LAMP_GRID } from "./drill-headlamp";

it("illuminates the surface in front of the drill and leaves the wall's shadow dark", () => {
  const depth = new Float32Array(LAMP_GRID * LAMP_GRID);
  const mount = { x: 10.5, y: 10, z: 10.5 };
  const lamp = drillHeadlamp(mount, 0, 0, (_x, _y, z) => z === 5, depth);
  expect(headlampAt(lamp, 10.5, 11.24, 6, 2, -1)).toBeGreaterThan(0.45);
  expect(headlampAt(lamp, 10.5, 11.24, 4, 2, -1)).toBe(0);
  expect(headlampAt(lamp, 10.5, 11.24, 13, 2, 1)).toBe(0);
  expect(headlampAt(lamp, 15, 11.24, 6, 2, -1)).toBe(0);

  const turned = drillHeadlamp(mount, -Math.PI / 2, 0, () => false, depth);
  expect(headlampAt(turned, 15, 11.24, 10.5, 0, 1)).toBeGreaterThan(0.45);
  expect(headlampAt(turned, 10.5, 11.24, 6, 2, -1)).toBe(0);
});
