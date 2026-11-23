import { COPPER_ARMOR, COPPER_PICK, type ItemId } from "../game/items";

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
