import {
  COPPER_ARMOR,
  COPPER_AXE,
  COPPER_PICK,
  COPPER_SWORD,
  type ItemId,
  WOOD_SHIELD,
} from "../game/items";

// A shared voxel silhouette for the inventory, the WebGL prop and the CPU view.
const PIXELS = [
  "................",
  "....ssssss......",
  "..sshhhhhhss....",
  ".shhccchhhcgs...",
  ".shhsssshhccgs..",
  ".ss.....shsccgs.",
  ".......wws.sccs.",
  "......wbbw..sgs.",
  ".....wbbw....ss.",
  "....wbbw........",
  "...wbbw.........",
  "..wbbw..........",
  ".wbbw...........",
  ".wbw............",
  "..w.............",
  "................",
];
const PALETTE: Readonly<Record<string, { color: string; depth: number }>> = {
  s: { color: "#293849", depth: 0.18 },
  h: { color: "#7e9aa8", depth: 0.24 },
  c: { color: "#b3e7d6", depth: 0.25 },
  g: { color: "#63b1a7", depth: 0.24 },
  w: { color: "#653c28", depth: 0.15 },
  b: { color: "#bf8751", depth: 0.17 },
};
export const MINING_PICK_GRID_SIZE = 16;

export function drawMiningPickParts(
  draw: (x: number, y: number, color: string, depth: number) => void,
): void {
  PIXELS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const pixel = PALETTE[row.charAt(x)];
      if (pixel) draw(x, y, pixel.color, pixel.depth);
    }
  });
}

const COPPER_SHADES: Readonly<Record<string, string>> = {
  "#293849": "#4f3029",
  "#7e9aa8": "#ad633f",
  "#b3e7d6": "#f5c08d",
  "#63b1a7": "#dc8458",
};

export function renderEquipmentIcon(
  size: number,
  item: Exclude<ItemId, number>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable");
  const cell = size / MINING_PICK_GRID_SIZE;
  if (item === COPPER_SWORD || item === COPPER_AXE || item === WOOD_SHIELD) {
    const square = (x: number, y: number, w: number, h: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
    };
    if (item === COPPER_SWORD) {
      square(6, 10, 4, 2, "#7a4933");
      square(7, 11, 2, 5, "#52372b");
      square(4, 9, 8, 2, "#bc7548");
      square(7, 2, 2, 8, "#e6a56a");
      square(7, 1, 2, 2, "#f5c38b");
      square(7, 3, 1, 5, "#58a6a7");
    } else if (item === COPPER_AXE) {
      square(6, 4, 2, 11, "#986f49");
      square(5, 3, 6, 5, "#bf7548");
      square(9, 4, 3, 3, "#e5a16a");
      square(11, 5, 1, 2, "#f5c38b");
      square(6, 7, 2, 1, "#58a6a7");
    } else {
      square(3, 3, 10, 11, "#8d673f");
      square(3, 3, 2, 11, "#d99a63");
      square(11, 3, 2, 11, "#d99a63");
      square(3, 3, 10, 2, "#e5a16a");
      square(3, 12, 10, 2, "#bc7548");
      square(7, 5, 2, 7, "#593d2b");
      square(5, 7, 6, 2, "#593d2b");
      square(6, 5, 4, 3, "#58a6a7");
    }
    return canvas;
  }
  if (item === COPPER_ARMOR) {
    ctx.fillStyle = "#55302a";
    ctx.fillRect(cell, cell * 3, cell * 14, cell * 6);
    ctx.fillRect(cell * 4, cell * 4, cell * 8, cell * 11);
    ctx.fillStyle = "#e39861";
    ctx.fillRect(cell * 2, cell * 4, cell * 12, cell * 4);
    ctx.fillRect(cell * 5, cell * 6, cell * 6, cell * 8);
    ctx.fillStyle = "#f5cb97";
    ctx.fillRect(cell * 5, cell * 8, cell * 6, cell * 2);
    ctx.fillStyle = "#55302a";
    ctx.fillRect(cell * 6, cell * 3, cell * 4, cell * 3);
    return canvas;
  }
  drawMiningPickParts((x, y, color) => {
    ctx.fillStyle = item === COPPER_PICK ? (COPPER_SHADES[color] ?? color) : color;
    ctx.fillRect(x * cell, y * cell, cell, cell);
  });
  return canvas;
}
