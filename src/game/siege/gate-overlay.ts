import { BlockId } from "../../world/blocks";
import { worldToChunk } from "../../world/coords";
import type { World } from "../../world/world";
import { siegeGateVoxels, type SiegeGateId } from "./assault";
import type { FortressLocation } from "./fortress";

export interface UpdatedGateChunk {
  readonly cx: number;
  readonly cz: number;
}

/** Volatile door overlay for the south-facing siege. No edit-store writes.
 * This deliberately leaves the player's block/saving format untouched.
 * Old fortresses (with open passages) gain the doors during a siege too. */
export class SiegeGateOverlay {
  private readonly blocks: Record<SiegeGateId, ReturnType<typeof siegeGateVoxels>>;
  private readonly owned = new Set<string>();
  private readonly closed: Record<SiegeGateId, boolean> = { outer: false, inner: false };

  constructor(site: FortressLocation) {
    this.blocks = {
      outer: siegeGateVoxels(site, "outer"),
      inner: siegeGateVoxels(site, "inner"),
    };
  }

  /** Called before a newly generated chunk is forwarded to mesh workers.
   * Its owner set is cleared for that chunk, because chunks are volatile. */
  applyToLoadedChunk(world: World, cx: number, cz: number): void {
    if (!world.hasChunk(cx, cz)) return;
    for (const gate of ["outer", "inner"] as const) {
      for (const block of this.blocks[gate]) {
        if (worldToChunk(block.x) !== cx || worldToChunk(block.z) !== cz) continue;
        this.owned.delete(this.key(block.x, block.y, block.z));
        if (this.closed[gate]) this.put(world, block.x, block.y, block.z, true);
      }
    }
  }

  /** Once per structural change, not on every animation frame. */
  sync(world: World, closedOuter: boolean, closedInner: boolean): UpdatedGateChunk[] {
    if (this.closed.outer === closedOuter && this.closed.inner === closedInner) return [];
    this.closed.outer = closedOuter;
    this.closed.inner = closedInner;
    const changed = new Map<string, UpdatedGateChunk>();
    for (const gate of ["outer", "inner"] as const) {
      for (const block of this.blocks[gate]) {
        if (!world.hasChunk(worldToChunk(block.x), worldToChunk(block.z))) continue;
        if (!this.put(world, block.x, block.y, block.z, this.closed[gate])) continue;
        const cx = worldToChunk(block.x);
        const cz = worldToChunk(block.z);
        changed.set(`${cx},${cz}`, { cx, cz });
      }
    }
    return [...changed.values()];
  }

  /** Remove bookkeeping for unloaded chunks: the streaming system will
   * reconstruct the correct door state when they come back. */
  forgetChunk(cx: number, cz: number): void {
    for (const gate of ["outer", "inner"] as const) {
      for (const block of this.blocks[gate]) {
        if (worldToChunk(block.x) === cx && worldToChunk(block.z) === cz)
          this.owned.delete(this.key(block.x, block.y, block.z));
      }
    }
  }

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private put(world: World, x: number, y: number, z: number, closed: boolean): boolean {
    const key = this.key(x, y, z);
    if (closed) {
      if (world.getBlock(x, y, z) !== BlockId.AIR) return false;
      world.setBlock(x, y, z, BlockId.PLANKS);
      this.owned.add(key);
      return true;
    }
    if (!this.owned.delete(key)) return false;
    // Only erase our own temporary planks, never arbitrary user blocks.
    if (world.getBlock(x, y, z) !== BlockId.PLANKS) return false;
    world.setBlock(x, y, z, BlockId.AIR);
    return true;
  }
}
