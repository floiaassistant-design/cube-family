import "./style.css";
import * as THREE from "three";
import { SoundEngine } from "./audio/sound";
import { GAME_NAME } from "./branding";
import { type DiscoveryId, Journal } from "./game/discoveries";
import { COW_HEIGHT, COW_WIDTH } from "./game/cows";
import { DragonMount } from "./game/dragon";
import { FlyingDrill } from "./game/flight-drill";
import { attackDamage } from "./game/equipment";
import { FirstNight, isFirstNightShelter } from "./game/first-night";
import { findWatchersRuin, WatchersRuin } from "./game/watchers-ruin";
import { createFortressBlueprint, FORTRESS_CENTER } from "./game/siege/fortress";
import { findFortressSite, FortressStore } from "./game/siege/fortress-store";
import { SiegeGateOverlay } from "./game/siege/gate-overlay";
import type { ArmoryPurchase } from "./game/siege/armory";
import { SiegeController, type SiegeReport, TITAN_TARGET_RADIUS } from "./game/siege/session";
import {
  Bag,
  COPPER_ARMOR,
  COPPER_AXE,
  COPPER_PICK,
  COPPER_SWORD,
  craft,
  digSeconds,
  dropFor,
  type HeldItem,
  type HandEquipment,
  isHandEquipment,
  isMiningPick,
  WOOD_SHIELD,
} from "./game/items";
import {
  creatureCenter,
  type Creature,
  MAX_HEALTH,
  nextMorning,
  timeIsNight,
  Wildlife,
} from "./game/wildlife";
import { createTranslator, resolveLocale, type Translator } from "./i18n";
import { GamepadInput } from "./input/gamepad";
import { ChunkMeshManager } from "./render/chunk-mesh-manager";
import { CreatureView } from "./render/creature-view";
import { CpuRenderer } from "./render/cpu-renderer";
import { DragonModel } from "./render/dragon-model";
import { drillHeadlamp, LAMP_GRID } from "./render/drill-headlamp";
import { FlyingDrillModel } from "./render/flight-drill-model";
import { environmentAt } from "./render/environment";
import { HeldBlock } from "./render/held-block";
import { renderEquipmentIcon } from "./render/mining-pick-art";
import { Particles } from "./render/particles";
import { Rain } from "./render/rain";
import { QUALITY_PROFILES, WorldRenderer } from "./render/renderer";
import { DAY_LENGTH_SECONDS, STARTUP_PHASE, skyStateAt } from "./render/sky";
import { createTextureAtlas } from "./render/texture-atlas";
import { applyWeather, type Weather, weatherAt } from "./render/weather";
import { PlayerController } from "./player/controller";
import { BlockInteraction } from "./player/interaction";
import { aabbFromFeetPosition, aabbIntersectsSolid, type Vec3 } from "./player/physics";
import { raycastVoxels } from "./player/raycast";
import { defaultSettings, type Settings, SettingsStore } from "./settings";
import { renderBlockIcon } from "./ui/block-icon";
import { FirstNightPanel } from "./ui/first-night-panel";
import { Hotbar, sanitizeHotbar } from "./ui/hotbar";
import { Hud } from "./ui/hud";
import { Inventory, type InventoryState } from "./ui/inventory";
import { Menu } from "./ui/menu";
import { SiegePanel } from "./ui/siege-panel";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";
import { BLOCKS, BlockId, isSolid } from "./world/blocks";
import { CHUNK_HEIGHT, type ChunkCoord, worldToChunk } from "./world/coords";
import { EditStore, type KeyValueStorage } from "./world/edit-store";
import { loadPlayerSave, storePlayerSave } from "./world/player-save";
import { WorldRegistry } from "./world/world-registry";
import { exportWorldArchive, importWorldArchive } from "./world/world-transfer";
import { findPleasantSpawn } from "./world/spawn";
import {
  type ChunkGenerator,
  ChunkStreamer,
  createSyncGenerator,
  createWorkerGenerator,
} from "./world/streamer";
import { Biome, createColumnSampler, SEA_LEVEL } from "./world/terrain";
import { World } from "./world/world";

const DEFAULT_SEED = 2026;
const LAST_SEED_KEY = "voxel-world:last-seed";
const STREAM_RADIUS_CPU = 4;
const WARMUP_RADIUS_CHUNKS = 2;
const SAVE_INTERVAL_MS = 4000;

// Debug handle for the end-to-end harness (scripts/visual-check.mjs): lets
// an automated browser assert on game state instead of guessing from
// pixels, and stage a shot (time of day, vantage point) for screenshots.
declare global {
  interface Window {
    /** Called by the Android shell's back button; true = handled here. */
    __nativeBack?: () => boolean;
    __mc?: {
      position: () => { x: number; y: number; z: number };
      blockAt: (x: number, y: number, z: number) => number;
      target: () => { x: number; y: number; z: number } | null;
      pitch: () => number;
      setLook: (yaw: number, pitch: number) => void;
      mode: () => string;
      renderer: () => "webgl" | "cpu";
      touch: () => boolean;
      loadedChunks: () => number;
      meshedChunks: () => number;
      pendingChunks: () => number;
      seed: number;
      /** Freezes the clock at a day phase (0..1); null lets it run again. */
      setTime: (phase: number | null) => void;
      setDrillLamp: (enabled: boolean) => void;
      setQuality: (level: string) => void;
      teleport: (x: number, y: number, z: number, yaw: number, pitch: number) => void;
      groundAt: (x: number, z: number) => number;
      locate: (biome: number, skip?: number) => { x: number; z: number; h: number } | null;
      stats: () => Record<string, number | undefined>;
      hotbar: () => number[];
      flying: () => boolean;
      drill: () => {
        position: { x: number; y: number; z: number } | null;
        exit: { x: number; y: number; z: number } | null;
        yaw: number;
        mounted: boolean;
        flying: boolean;
        drilling: boolean;
        size: number;
      };
      dragon: () => {
        position: { x: number; y: number; z: number } | null;
        renderedPosition: { x: number; y: number; z: number } | null;
        ready: boolean;
        mounted: boolean;
        flying: boolean;
        grounded: boolean;
      };
      inventoryOpen: () => boolean;
      gameMode: () => string;
      setMode: (mode: string) => void;
      /** What's in the Adventure bag, by block id. */
      bag: () => Record<string, number>;
      give: (block: number, amount: number) => void;
      creatures: () => readonly Creature[];
      discoveries: () => string[];
      digging: () => number;
      settings: () => Record<string, string | number | boolean>;
      /** Forces the weather (overcast, rain in 0..1); null returns to the forecast. */
      setWeather: (overcast: number | null, rain?: number) => void;
      /** Stages a test scene; pass record to persist the staged edit. */
      setBlock: (x: number, y: number, z: number, id: number, record?: boolean) => void;
      siege: () => SiegeReport | null;
    };
  }
}

/** A dead "Play" button is the worst failure mode a browser game can
 * have. If anything at all goes wrong during boot — and the WebGL and
 * worker paths already have their own fallbacks — say so, visibly, in the
 * menu the player is already looking at. */
function showFatalError(error: unknown, t: Translator): void {
  const content = document.querySelector("#overlay-content");
  if (!content) return;
  const message = error instanceof Error ? error.message : String(error);
  const screen = document.createElement("div");
  screen.className = "menu-screen";
  const title = document.createElement("h2");
  title.textContent = t("fatalTitle", { name: GAME_NAME });
  const detail = document.createElement("p");
  detail.textContent = message;
  const hint = document.createElement("p");
  hint.className = "panel-hint";
  hint.textContent = t("fatalHint");
  screen.append(title, detail, hint);
  content.replaceChildren(screen);
}

function getStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function boot(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app not found");
  const hotbarContainer = document.querySelector<HTMLDivElement>("#hotbar");
  if (!hotbarContainer) throw new Error("#hotbar not found");
  const menuRoot = document.querySelector<HTMLElement>("#overlay-content");
  if (!menuRoot) throw new Error("#overlay-content not found");

  // A shareable world: ?seed=1234 loads the same terrain for everyone.
  // Without one, return to the world played last.
  const params = new URLSearchParams(window.location.search);
  const parseSeed = (text: string | null): number =>
    text === null ? NaN : Number.parseInt(text, 10);
  const fromUrl = parseSeed(params.get("seed"));
  const storage = getStorage();
  const worldRegistry = new WorldRegistry(storage);
  let fromLast = NaN;
  try {
    fromLast = parseSeed(storage?.getItem(LAST_SEED_KEY) ?? null);
  } catch {
    // Storage may be blocked by browser or iframe policy.
  }
  const SEED = Number.isFinite(fromUrl)
    ? fromUrl
    : Number.isFinite(fromLast)
      ? fromLast
      : DEFAULT_SEED;
  try {
    storage?.setItem(LAST_SEED_KEY, SEED.toString());
  } catch {
    // Private browsing: the world just won't be remembered.
  }

  const touch = isTouchDevice();
  const cores = navigator.hardwareConcurrency || 4;
  const settings = new SettingsStore(storage, defaultSettings({ touch, cores }));
  // URL overrides, for benchmarks and the screenshot harness.
  const qualityParam = params.get("quality");
  if (
    qualityParam === "low" ||
    qualityParam === "medium" ||
    qualityParam === "high" ||
    qualityParam === "ultra"
  ) {
    settings.values.quality = qualityParam;
  }
  const langParam = params.get("lang");
  if (langParam === "en" || langParam === "fr") settings.values.language = langParam;
  const t = createTranslator(resolveLocale(settings.values.language, navigator.languages));
  document.documentElement.lang = t.locale;
  const viewParam = Number.parseInt(params.get("view") ?? "", 10);
  if (Number.isFinite(viewParam)) {
    settings.values.viewDistance = Math.max(2, Math.min(16, viewParam));
  }

  const world = new World(SEED);
  const atlas = createTextureAtlas(SEED);
  const sampleColumn = createColumnSampler(SEED);
  const sound = new SoundEngine();
  sound.setVolume(settings.values.volume);

  // The renderer: WebGL2 when the browser can, an in-house CPU raycaster
  // when it can't. Same world, same physics, same controls either way.
  let webgl: WorldRenderer | null = null;
  let cpu: CpuRenderer | null = null;
  let chunkMeshes: ChunkMeshManager | null = null;
  let particles: Particles | null = null;
  let heldBlock: HeldBlock | null = null;
  let dragonModel: DragonModel;
  let drillModel: FlyingDrillModel;
  let rain: Rain | null = null;
  let highlight: THREE.LineSegments | null = null;
  let digVeil: THREE.Mesh | null = null;
  try {
    const renderer = new WorldRenderer(
      app,
      SEED,
      settings.values.quality,
      settings.values.viewDistance,
    );
    const meshes = new ChunkMeshManager(
      renderer.scene,
      world,
      { terrain: renderer.terrainMaterial, water: renderer.waterMaterial },
      Math.max(1, Math.min(3, cores - 2)),
    );
    const directOutput = (): boolean =>
      !QUALITY_PROFILES[renderer.qualityLevel].post || !renderer.supportsPost;
    const sparks = new Particles(renderer.scene, SEED, directOutput());
    // The camera carries the held block, so it has to be part of the scene.
    renderer.scene.add(renderer.camera);
    const hand = new HeldBlock(renderer.camera, renderer.uniforms, directOutput());
    const dragonView = new DragonModel(renderer.scene, renderer.uniforms, directOutput());
    const drillView = new FlyingDrillModel(renderer.scene);
    const shower = new Rain(renderer.scene, directOutput());
    renderer.onMaterialsChanged = () => {
      meshes.setMaterials({ terrain: renderer.terrainMaterial, water: renderer.waterMaterial });
      sparks.setDirect(directOutput());
      hand.setDirect(directOutput());
      dragonView.setDirect(directOutput());
      shower.setDirect(directOutput());
    };
    heldBlock = hand;
    dragonModel = dragonView;
    drillModel = drillView;
    rain = shower;
    highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75 }),
    );
    highlight.visible = false;
    highlight.renderOrder = 15;
    renderer.scene.add(highlight);
    // A dark veil that thickens over a block as it's dug.
    digVeil = new THREE.Mesh(
      new THREE.BoxGeometry(1.006, 1.006, 1.006),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    digVeil.visible = false;
    digVeil.renderOrder = 14;
    renderer.scene.add(digVeil);
    if (params.has("fullres")) renderer.lockFullResolution();
    webgl = renderer;
    chunkMeshes = meshes;
    particles = sparks;
  } catch (webglError) {
    console.warn("WebGL2 unavailable, switching to the CPU raycaster:", webglError);
    cpu = new CpuRenderer(app, world, SEED);
    dragonModel = new DragonModel(null);
    drillModel = new FlyingDrillModel(null);
  }
  const view = webgl ?? cpu;
  if (!view) throw new Error("no renderer could be created");
  const { camera, domElement } = view;
  const cpuHand = cpu ? document.createElement("div") : null;
  let cpuHeldItem: HeldItem | null = null;
  if (cpuHand) {
    cpuHand.id = "held-item";
    cpuHand.setAttribute("aria-hidden", "true");
    cpuHand.hidden = true;
    app.appendChild(cpuHand);
  }

  const saved = loadPlayerSave(storage, SEED);
  const editStore = new EditStore(storage, SEED);
  const firstNight = new FirstNight(saved?.firstNight);
  const columnHeight = (x: number, z: number): number => sampleColumn(x, z).terrainHeight;
  let watchersRuin = firstNight.ruin ? new WatchersRuin(firstNight.ruin, columnHeight) : null;
  let gateOverlay: SiegeGateOverlay | null = null;
  const streamer = new ChunkStreamer(world, {
    // One extra ring of data beyond what's drawn: lighting a chunk reads
    // all eight of its neighbors.
    radius: webgl ? settings.values.viewDistance + 1 : STREAM_RADIUS_CPU,
    editStore,
    shape: webgl ? "disc" : "square",
    meshWhenSurrounded: webgl !== null,
    onLoad: (cx, cz) => {
      const chunk = world.getChunk(cx, cz);
      if (chunk) watchersRuin?.apply(chunk, editStore);
      gateOverlay?.applyToLoadedChunk(world, cx, cz);
      chunkMeshes?.chunkLoaded(cx, cz);
    },
    onUnload: (cx, cz) => {
      gateOverlay?.forgetChunk(cx, cz);
      chunkMeshes?.chunkUnloaded(cx, cz);
    },
  });
  const receive = (cx: number, cz: number, buffer: Uint8Array): void => {
    streamer.receive(cx, cz, buffer);
  };
  let generator: ChunkGenerator;
  try {
    if (typeof Worker === "undefined") throw new Error("workers unavailable");
    generator = createWorkerGenerator(SEED, receive, cores >= 6 ? 2 : 1);
  } catch {
    // No module workers? Generate on the main thread — slower on chunk
    // arrival, but the game works everywhere.
    generator = createSyncGenerator(SEED, receive);
  }
  streamer.attachGenerator(generator);

  // Start where the player left off, or somewhere pleasant.
  const spawn = findPleasantSpawn(SEED);
  const startX = saved?.x ?? spawn.x;
  const startZ = saved?.z ?? spawn.z;
  // Ground under the player's feet before the first frame; the rest streams in.
  streamer.warmUp(startX, startZ, WARMUP_RADIUS_CHUNKS);

  const player = new PlayerController(camera, domElement, world, startX, startZ, {
    sensitivity: settings.values.sensitivity,
    invertY: settings.values.invertY,
    autoJump: settings.values.autoJump,
    viewBob: settings.values.viewBob,
    fov: settings.values.fov,
  });
  if (saved) {
    // Only trust a saved position that isn't inside rock (the world
    // generator may have changed since it was written).
    const stuck = aabbIntersectsSolid(aabbFromFeetPosition(saved), (x, y, z) =>
      isSolid(world.getBlock(x, y, z)),
    );
    if (!stuck && saved.y > 0 && saved.y < CHUNK_HEIGHT + 64) player.restore(saved);
  }

  const dragon = new DragonMount(world);
  const dragonOrigin = saved?.dragon ?? { ...player.position };
  const terrainSurface = (x: number, z: number): number => sampleColumn(x, z).terrainHeight + 1;
  const spawnDragon = (): void => {
    const p = player.position;
    if (dragon.position || Math.hypot(p.x - dragonOrigin.x, p.z - dragonOrigin.z) > 35) {
      return;
    }
    dragon.spawn(dragonOrigin, terrainSurface, saved?.dragon);
  };
  spawnDragon();

  // ---- game mode: Creative (everything, unlimited) or Adventure ----
  const modeParam = params.get("mode");
  let mode: "creative" | "adventure" =
    modeParam === "adventure" || modeParam === "creative"
      ? modeParam
      : (saved?.mode ?? worldRegistry.get(SEED)?.mode ?? "creative");
  worldRegistry.visit(SEED, mode);

  // Per-world local parking; no change to the existing player save format.
  const drillStorageKey = "voxel-world:vehicle:flying-drill:v1:" + SEED.toString();
  const storedDrill = (() => {
    try {
      const raw = storage?.getItem(drillStorageKey);
      if (!raw) return undefined;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object") return undefined;
      const p = data as Record<string, unknown>;
      if (
        typeof p.x === "number" &&
        Number.isFinite(p.x) &&
        typeof p.y === "number" &&
        Number.isFinite(p.y) &&
        typeof p.z === "number" &&
        Number.isFinite(p.z) &&
        typeof p.yaw === "number" &&
        Number.isFinite(p.yaw) &&
        p.y > 0 &&
        p.y < CHUNK_HEIGHT + 48
      )
        return { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    } catch {
      // Invalid or blocked local storage must not prevent game launch.
    }
    return undefined;
  })();
  const drill = new FlyingDrill(world);
  const lampDepth = new Float32Array(LAMP_GRID * LAMP_GRID);
  let drillLampEnabled = true;
  const blocksDrillLight = (x: number, y: number, z: number): boolean =>
    !world.hasChunk(worldToChunk(x), worldToChunk(z)) || isSolid(world.getBlock(x, y, z));
  const drillOrigin = storedDrill ?? { x: startX + 6, z: startZ + 6 };
  const spawnDrill = (): void => {
    const p = player.position;
    if (mode !== "creative" || drill.position) return;
    const origin = Math.hypot(p.x - drillOrigin.x, p.z - drillOrigin.z) <= 35 ? drillOrigin : p;
    drill.spawn(origin, terrainSurface, origin === drillOrigin ? storedDrill : undefined);
  };
  spawnDrill();
  if (!saved && dragon.position) {
    const pose = player.pose();
    const yaw = Math.atan2(pose.x - dragon.position.x, pose.z - dragon.position.z);
    player.restore({ ...pose, yaw });
  }

  const hotbar = new Hotbar(hotbarContainer, atlas.canvas, sanitizeHotbar(saved?.hotbar), (name) =>
    t.block(name),
  );
  if (saved) hotbar.select(saved.slot);
  const inventory = new Inventory(app, atlas.canvas, t);

  const bag = new Bag(saved?.bag);
  const fortressStore = new FortressStore(storage, SEED);
  let fortress = fortressStore.read();
  const siegeZombieCap = cpu ? 14 : touch ? 24 : 44;
  let siege: SiegeController | null = fortress
    ? new SiegeController(
        fortress,
        (x, z) => sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight,
        siegeZombieCap,
      )
    : null;
  if (fortress) gateOverlay = new SiegeGateOverlay(fortress);

  const refreshChangedChunks = (modified: readonly ChunkCoord[]): void => {
    for (const { cx, cz } of modified) {
      chunkMeshes?.chunkLoaded(cx, cz);
      chunkMeshes?.updateChunk(cx, cz, true);
      // Light can travel across the chunk boundary.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) continue;
          if (world.hasChunk(cx + dx, cz + dz)) chunkMeshes?.updateChunk(cx + dx, cz + dz);
        }
      }
    }
  };
  // Door destruction belongs to the event only.
  const syncGateVisuals = (): void => {
    if (!gateOverlay) return;
    const report = siege?.report;
    const active = siege?.active ?? false;
    refreshChangedChunks(
      gateOverlay.sync(
        world,
        active && (report?.outerGate.health ?? 0) > 0,
        active && (report?.innerGate.health ?? 0) > 0,
      ),
    );
  };
  const standNear = (x: number, z: number, y: number, tall: boolean): number | null => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    if (!world.hasChunk(worldToChunk(bx), worldToChunk(bz))) return null;
    const origin = Math.floor(y + 0.001);
    for (const offset of [0, -1, 1]) {
      const by = origin + offset;
      if (by < 1 || by + 1 >= CHUNK_HEIGHT) continue;
      const base = world.getBlock(bx, by, bz);
      if (isSolid(base) || base === BlockId.WATER || !isSolid(world.getBlock(bx, by - 1, bz)))
        continue;
      if (tall && isSolid(world.getBlock(bx, by + 1, bz))) continue;
      return by + 0.015;
    }
    return null;
  };
  const clearSight = (from: Vec3, to: Vec3): boolean => {
    const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const range = Math.hypot(direction.x, direction.y, direction.z);
    return (
      raycastVoxels(from, direction, Math.max(0, range - 0.035), (x, y, z) =>
        isSolid(world.getBlock(x, y, z)),
      ) === null
    );
  };
  const cowStand = (x: number, z: number, y: number): number | null => {
    const floor = standNear(x, z, y, true);
    if (floor === null) return null;
    const body = aabbFromFeetPosition({ x, y: floor, z }, COW_WIDTH, COW_HEIGHT);
    return aabbIntersectsSolid(
      body,
      (x, y, z) =>
        !world.hasChunk(worldToChunk(x), worldToChunk(z)) || isSolid(world.getBlock(x, y, z)),
    )
      ? null
      : floor;
  };
  const wildlife = new Wildlife(
    SEED,
    {
      stand: standNear,
      surface: (x, z) => sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight + 1,
      clear: clearSight,
      cattle: {
        stand: cowStand,
        pasture: (x, z) => {
          const bx = Math.floor(x);
          const bz = Math.floor(z);
          const { terrainHeight, biome } = sampleColumn(bx, bz);
          if (biome !== Biome.PLAINS && biome !== Biome.FOREST && biome !== Biome.AUTUMN)
            return null;
          if (world.getBlock(bx, terrainHeight, bz) !== BlockId.GRASS) return null;
          return cowStand(x, z, terrainHeight + 1);
        },
      },
    },
    saved?.wildlife,
  );
  wildlife.spawnStarterCat(player.position, player.pose().yaw);
  const creatureView = new CreatureView(app, camera, clearSight, webgl?.scene ?? null);
  let nearbyCreatures: Creature[] = [];
  const forward = new THREE.Vector3();
  const sight = new THREE.Vector3();
  const findCreature = (range = 4): Creature | null => {
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    let closest: Creature | null = null;
    let best = range;
    for (const creature of nearbyCreatures) {
      const center = creatureCenter(creature);
      sight.copy(center).sub(camera.position);
      const distance = forward.dot(sight);
      if (distance <= 0 || distance >= best) continue;
      const radius =
        creature.kind === "roamer"
          ? 0.52
          : creature.kind === "siege-zombie"
            ? creature.variant === "boss"
              ? TITAN_TARGET_RADIUS
              : 0.52
            : creature.kind === "cow"
              ? COW_WIDTH * 0.56
              : creature.growsIn > 0
                ? 0.24
                : 0.38;
      if (sight.lengthSq() - distance * distance > radius * radius) continue;
      if (!clearSight(camera.position, center)) continue;
      closest = creature;
      best = distance;
    }
    return closest;
  };
  // Old saves only know pickInHand; new saves preserve the exact held tool.
  const previousEquipment = saved?.heldEquipment;
  let heldEquipment: HandEquipment | null =
    previousEquipment === undefined
      ? saved?.pickInHand === false
        ? null
        : bag.pick
      : previousEquipment !== null && bag.count(previousEquipment) > 0
        ? previousEquipment
        : null;
  const journal = new Journal(saved?.journal as { found?: unknown; placed?: unknown } | undefined);
  const inventoryState = (): InventoryState => ({
    bag: mode === "adventure" ? bag : null,
    journal,
    get pickInHand() {
      return pickEquipped();
    },
    get heldEquipment() {
      return mode === "adventure" ? heldEquipment : null;
    },
  });
  const celebrate = (found: DiscoveryId[]): void => {
    for (const id of found) {
      hud.announce(t("discovered", { name: t.discovery(id) }));
      sound.discover();
    }
  };
  const hud = new Hud(app, t("digProgress"));
  const firstNightPanel = new FirstNightPanel(app, t);
  hud.setStatsVisible(settings.values.showStats);
  const dragonHint = document.createElement("div");
  dragonHint.id = "dragon-hint";
  dragonHint.classList.toggle("touch", touch);
  dragonHint.hidden = true;
  app.append(dragonHint);

  const hasMiningPick = (): boolean => bag.pick !== null;
  const pickEquipped = (): boolean =>
    mode === "adventure" && heldEquipment !== null && isMiningPick(heldEquipment);
  const swingHand = (): void => {
    heldBlock?.use();
    if (
      cpuHand &&
      !cpuHand.hidden &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      for (const motion of cpuHand.getAnimations()) motion.cancel();
      cpuHand.animate(
        [
          { transform: "rotate(0)" },
          { transform: "rotate(-22deg) translate(-10%, 5%)" },
          { transform: "rotate(0)" },
        ],
        { duration: 220, easing: "ease-in-out" },
      );
    }
  };
  const interaction = new BlockInteraction(
    camera,
    domElement,
    world,
    chunkMeshes ?? { blockChanged: () => undefined },
    hotbar,
    player,
  );
  interaction.onEdit = (edit) => {
    editStore.record(edit.x, edit.y, edit.z, edit.id);
    swingHand();
    if (edit.id === BlockId.AIR) {
      sound.breakBlock(edit.previous);
      particles?.burst(edit.x, edit.y, edit.z, edit.previous);
      if (mode === "adventure") {
        // What was dug goes in the bag — and onto the hotbar if it's new.
        const drop = dropFor(edit.previous);
        if (drop !== BlockId.AIR && bag.add(drop) > 0 && !hotbar.contents.includes(drop)) {
          const free = hotbar.contents.findIndex((block) => bag.count(block) === 0);
          if (free >= 0) hotbar.setSlot(free, drop);
        }
      }
      celebrate(journal.dug(edit.previous));
    } else {
      sound.placeBlock(edit.id);
      if (mode === "adventure") bag.remove(edit.id);
      celebrate(journal.built(edit.id));
    }
  };
  interaction.occupiedByEntity = (x, y, z) =>
    wildlife.cowOccupies(x, y, z) ||
    dragon.occupiesBlock(x, y, z) ||
    (mode === "creative" && drill.occupiesBlock(x, y, z));
  drill.onExcavate = (edits) => {
    if (mode !== "creative" || siege?.active || edits.length === 0) return;
    editStore.recordMany(edits);
    for (const [index, edit] of edits.entries()) {
      const previous = world.getBlock(edit.x, edit.y, edit.z);
      world.setBlock(edit.x, edit.y, edit.z, BlockId.AIR);
      chunkMeshes?.blockChanged(edit.x, edit.y, edit.z, BlockId.AIR);
      if (index === 0 && previous !== BlockId.AIR) {
        particles?.burst(edit.x, edit.y, edit.z, previous);
      }
    }
    sound.breakBlock(BlockId.STONE);
  };
  interaction.onDigTick = (block) => {
    sound.step(block);
    if (heldEquipment !== null) swingHand();
  };
  bag.onChange = () => {
    hotbar.refresh();
    inventory.refresh();
  };
  const adventureDigSeconds = (block: BlockId): number =>
    digSeconds(block, hasMiningPick(), bag.pick === COPPER_PICK, heldEquipment === COPPER_AXE);
  const applyMode = (): void => {
    const adventure = mode === "adventure";
    interaction.digSeconds = adventure ? adventureDigSeconds : undefined;
    interaction.canBreak = () => !siege?.active;
    interaction.canPlace = (block) => !siege?.active && (!adventure || bag.count(block) > 0);
    hotbar.setCounts(adventure ? (block) => bag.count(block) : null);
    player.setFlightAllowed(!adventure);
    if (adventure) {
      drill.stopDrilling();
      if (player.currentMount === drill) {
        drill.returnToParking();
        const exit = drill.safeExit() ?? drill.savedRiderPosition;
        if (exit) player.restore({ ...player.pose(), ...exit, flying: false });
        interaction.enabled = true;
        app.classList.remove("riding");
      }
    }
  };
  interaction.onPick = (id) => {
    hotbar.pick(id);
  };

  /** Photo mode: everything but the world is hidden. */
  let hudHidden = false;
  let wantScreenshot = false;
  const gamepad = new GamepadInput();
  let padDriving = false;

  // ---- time of day ----
  let gameTime = saved?.time ?? STARTUP_PHASE * DAY_LENGTH_SECONDS;
  let frozenTime: number | null = null;
  let forcedWeather: Weather | null = null;
  /** Lightning: a flash that decays, and when the next strike is due. */
  let flash = 0;
  let nextStrike = 20;

  const persist = (): void => {
    if (player.currentMount === dragon) dragon.recordParking();
    if (player.currentMount === drill) drill.recordParking();
    const parking = drill.parking;
    if (parking) {
      try {
        storage?.setItem(drillStorageKey, JSON.stringify(parking));
      } catch {
        // Storage may be unavailable; gameplay remains in memory.
      }
    }
    const pose = player.pose();
    const safeReturn =
      player.currentMount === dragon
        ? dragon.savedRiderPosition
        : player.currentMount === drill
          ? drill.savedRiderPosition
          : undefined;
    storePlayerSave(storage, SEED, {
      ...pose,
      ...(safeReturn ? { ...safeReturn, flying: false } : {}),
      dragon: dragon.parking ?? saved?.dragon,
      // Absolute, not wrapped to a day: the weather is a function of it.
      time: gameTime,
      hotbar: [...hotbar.contents],
      slot: hotbar.selectedSlot,
      pickInHand: pickEquipped(),
      heldEquipment,
      mode,
      bag: bag.toJSON(),
      journal: journal.toJSON(),
      firstNight: firstNight.toJSON() ?? undefined,
      wildlife: wildlife.save(),
    });
  };

  const shelterSolid = (x: number, y: number, z: number): boolean => {
    const block = world.getBlock(x, y, z);
    return block !== BlockId.CAMP_BED && BLOCKS[block].sway !== "leaves" && isSolid(block);
  };
  const chooseRuin = () =>
    findWatchersRuin(player.position, spawn, columnHeight, (...bounds) =>
      editStore.hasEditsInRect(...bounds),
    );
  const updateFirstNight = (visible: boolean, night: boolean): void => {
    if (mode !== "adventure" || !visible || player.riding || document.hidden) {
      firstNightPanel.update(null);
      return;
    }
    const step = firstNight.step;
    const sheltered =
      (step === "shelter" || step === "night") &&
      isFirstNightShelter(player.position, shelterSolid, (x, y, z) => editStore.hasEdit(x, y, z));
    if (firstNight.advance(bag, sheltered, night, player.position, chooseRuin)) {
      const site = firstNight.ruin;
      if (site && !watchersRuin) {
        watchersRuin = new WatchersRuin(site, columnHeight);
        for (const { cx, cz } of watchersRuin.chunks) {
          const chunk = world.getChunk(cx, cz);
          if (chunk) watchersRuin.apply(chunk, editStore);
        }
        refreshChangedChunks(watchersRuin.chunks);
        hud.announce(t("watchersMapFound"));
        sound.discover();
      } else if (firstNight.step === "visited") {
        hud.announce(t("watchersRuinFound"));
        sound.discover();
      }
      persist();
    }
    const site = firstNight.step === "map" ? firstNight.ruin : null;
    const dx = site ? site.x + 0.5 - player.position.x : 0;
    const dz = site ? site.z + 0.5 - player.position.z : 0;
    firstNightPanel.update(
      firstNight.objective(bag, sheltered),
      site
        ? {
            angle: ((player.eyeYaw - Math.atan2(-dx, -dz)) * 180) / Math.PI,
            distance: Math.hypot(dx, dz),
          }
        : undefined,
    );
  };

  interaction.onAttack = () => {
    const creature = findCreature();
    if (!creature) return false;
    // Companion and passive animals are friendly.
    if (creature.kind === "cat" || creature.kind === "cow") return true;
    if (creature.kind === "siege-zombie") {
      if (
        siege?.melee(
          creature,
          attackDamage(siege.active ? COPPER_SWORD : heldEquipment),
          performance.now() / 1000,
        )
      ) {
        swingHand();
        sound.breakBlock(BlockId.STONE);
      }
      return true;
    }
    const result = wildlife.strike(creature, attackDamage(heldEquipment));
    if (result !== "recovering") {
      swingHand();
      sound.breakBlock(BlockId.STONE);
    }
    if (result === "struck")
      hud.announce(t(creature.variant === "miner" ? "minerStruck" : "roamerStruck"));
    if (result === "defeated") {
      bag.add(BlockId.COAL_ORE);
      nearbyCreatures = wildlife.nearby(player.position);
      hud.announce(t(creature.variant === "miner" ? "minerFell" : "roamerFell"));
      persist();
    }
    return true;
  };
  interaction.onUse = (hit) => {
    const creature = findCreature();
    if (creature?.kind === "cow") {
      hud.announce(t("cowPat"));
      sound.select();
      return true;
    }
    if (creature?.kind === "cat") {
      const feedback = {
        adopted: "catAdopted",
        purr: "catPurr",
        kitten: "catBorn",
        full: "catFull",
        resting: "catResting",
      } as const;
      const result = wildlife.useCat(creature);
      hud.announce(t(feedback[result]));
      sound.select();
      if (result === "adopted" || result === "kitten") persist();
      return true;
    }
    if (
      mode !== "adventure" ||
      !hit ||
      world.getBlock(hit.blockX, hit.blockY, hit.blockZ) !== BlockId.CAMP_BED
    )
      return false;
    const now = frozenTime ?? gameTime;
    if (timeIsNight(now)) {
      gameTime = nextMorning(Math.max(gameTime, now));
      frozenTime = null;
      wildlife.rest();
      nearbyCreatures = wildlife.nearby(player.position);
      hud.announce(t("campDawn"));
      sound.select();
      persist();
    } else {
      hud.announce(t("campDay"));
    }
    return true;
  };
  hotbar.onSelect = () => {
    heldEquipment = null;
  };
  hotbar.onChange = () => {
    hud.announce(t.block(BLOCKS[hotbar.selectedBlock].name));
    sound.select();
  };

  // ---- inventory ----
  const setInventory = (open: boolean): void => {
    if (open === inventory.isOpen) return;
    if (open && !player.isActive) return;
    if (open) inventory.show(inventoryState());
    else inventory.hide();
    interaction.enabled = !open && !player.riding;
    if (open) player.openUi();
    else player.closeUi();
    sound.click();
  };
  const nameEquipment = (item: HandEquipment): string =>
    t(
      item === COPPER_SWORD
        ? "copperSword"
        : item === COPPER_AXE
          ? "copperAxe"
          : item === WOOD_SHIELD
            ? "woodShield"
            : item === COPPER_PICK
              ? "copperPick"
              : "miningPick",
    );
  inventory.onChoose = (item) => {
    if (isHandEquipment(item)) {
      if (mode !== "adventure" || bag.count(item) === 0) return;
      heldEquipment = item;
      hud.announce(t("equipmentSelected", { name: nameEquipment(item) }));
    } else if (typeof item === "number") {
      hotbar.assign(item);
    }
    setInventory(false);
  };
  inventory.onCraft = (recipe) => {
    if (mode !== "adventure" || !craft(bag, recipe)) return;
    const output = recipe.output;
    if (isHandEquipment(output)) {
      heldEquipment = output;
      sound.select();
      hud.announce(t("equipmentSelected", { name: nameEquipment(output) }));
    } else if (output === COPPER_ARMOR) {
      sound.select();
      hud.announce(t("copperArmorReady"));
    } else {
      sound.placeBlock(output);
      hud.announce(t("crafted", { amount: recipe.amount, name: t.block(BLOCKS[output].name) }));
      if (!hotbar.contents.includes(output)) {
        const free = hotbar.contents.findIndex((block) => bag.count(block) === 0);
        if (free >= 0) hotbar.setSlot(free, output);
      }
    }
    celebrate(journal.crafted());
    persist();
  };
  inventory.onClose = () => {
    setInventory(false);
  };

  const canMountDragon = (): boolean => dragonModel.ready && dragon.canMount(player.position);
  const canMountDrill = (): boolean => mode === "creative" && drill.canMount(player.position);

  // Each mount has an explicit action. The historic dragon button must never
  // silently mount the new vehicle when both are in reach.
  const toggleRide = (mount: DragonMount): boolean => {
    if (!player.isActive || player.isUiOpen || inventory.isOpen) return false;
    if (player.riding) {
      if (player.currentMount !== mount) return false;
      drill.stopDrilling();
      if (player.dismount()) {
        interaction.enabled = true;
        app.classList.remove("riding");
        persist();
      } else {
        hud.announce(t(mount.grounded ? "dragonExitBlocked" : "dragonLandingRequired"));
      }
      return true;
    }
    if (mount === drill ? !canMountDrill() : !canMountDragon()) return false;
    if (!player.mount(mount)) return false;
    interaction.enabled = false;
    app.classList.add("riding");
    return true;
  };
  const toggleDragonRide = (): boolean => toggleRide(dragon);
  const toggleDrillRide = (): boolean => {
    if (mode !== "creative" || !player.isActive || player.isUiOpen || inventory.isOpen)
      return false;
    if (player.riding || canMountDrill()) return toggleRide(drill);
    spawnDrill();
    const parking = drill.position;
    if (parking) streamer.warmUp(parking.x, parking.z, 1);
    const exit = drill.safeExit();
    if (exit) {
      player.restore({ ...player.pose(), ...exit, flying: false });
      toggleRide(drill);
    } else {
      hud.announce(
        t.locale === "fr"
          ? "Cherche un terrain dégagé pour rejoindre la foreuse."
          : "Find open ground to reach the drill.",
      );
    }
    return true;
  };
  const toggleDrillCut = (): void => {
    if (siege?.active) {
      hud.announce(
        t.locale === "fr"
          ? "Forage suspendu pendant le siège."
          : "Drilling is paused during the siege.",
      );
      return;
    }
    drill.toggleDrilling();
  };
  const toggleCurrentRide = (): boolean =>
    toggleRide(player.currentMount ?? (canMountDragon() ? dragon : drill));

  // ---- on-screen controls for touch devices ----
  const touchControls = touch
    ? new TouchControls(app, {
        isActive: () => player.isActive && !inventory.isOpen,
        onInput: (input) => {
          player.setExternalInput(input);
        },
        onLook: (dx, dy) => {
          player.lookBy(dx, dy);
        },
        onBreak: () => {
          interaction.breakTargetedBlock();
        },
        onPlace: () => interaction.placeTargetedBlock(),
        onPause: () => {
          player.releaseControl();
        },
        onInventory: () => {
          setInventory(true);
        },
        onToggleFly: () => {
          player.toggleFlight();
        },
        onRide: toggleDragonRide,
        onDrillRide: toggleDrillRide,
        onToggleDrill: () => {
          if (player.currentMount === drill) toggleDrillCut();
        },
        onCycleDrill: () => {
          if (player.currentMount === drill) drill.cycleSize();
        },
      })
    : null;
  let touchVisible = false;
  touchControls?.setFlying(player.isFlying);
  applyMode();

  // ---- reusable mini-game: player-triggered fortress, never a new world ----
  const visitFortress = (): void => {
    if (!fortress || player.riding) {
      hud.announce(
        t.locale === "fr" ? "Descends du dragon avant d'entrer." : "Dismount before entering.",
      );
      return;
    }
    const x = fortress.x + FORTRESS_CENTER + 0.5;
    const z = fortress.z + 26.5;
    streamer.warmUp(x, z, WARMUP_RADIUS_CHUNKS);
    player.restore({ ...player.pose(), x, y: fortress.y + 1.02, z, flying: false });
    persist();
  };
  const buildFortress = (): void => {
    if (mode !== "creative" || fortress || !player.isActive || player.riding) return;
    const site = findFortressSite(
      player.position.x,
      player.position.z,
      sampleColumn,
      (minX, maxX, minZ, maxZ) => editStore.hasEditsInRect(minX, maxX, minZ, maxZ),
    );
    if (!site) {
      hud.announce(
        t.locale === "fr" ? "Aucun terrain plat libre à proximité." : "No empty level site nearby.",
      );
      return;
    }
    const agree = window.confirm(
      t.locale === "fr"
        ? "Construire la forteresse de 96 × 96 blocs sur un terrain vierge voisin ?"
        : "Build the 96 × 96 fortress on a nearby unedited site?",
    );
    if (!agree) return;
    const edits = createFortressBlueprint(site);
    editStore.recordMany(edits);
    const loaded = new Set<string>();
    // Keep already loaded chunks in sync; unloaded ones get the edit overlay on arrival.
    for (const edit of edits) {
      const cx = worldToChunk(edit.x);
      const cz = worldToChunk(edit.z);
      if (!world.hasChunk(cx, cz)) continue;
      world.setBlock(edit.x, edit.y, edit.z, edit.id);
      loaded.add(`${cx.toString()},${cz.toString()}`);
    }
    for (const key of loaded) {
      const [rawCx, rawCz] = key.split(",");
      if (rawCx === undefined || rawCz === undefined) continue;
      const cx = Number(rawCx);
      const cz = Number(rawCz);
      chunkMeshes?.chunkLoaded(cx, cz);
      chunkMeshes?.updateChunk(cx, cz, true);
    }
    fortress = site;
    fortressStore.write(site);
    siege = new SiegeController(
      site,
      (x, z) => sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight,
      siegeZombieCap,
    );
    gateOverlay = new SiegeGateOverlay(site);
    visitFortress();
    hud.announce(
      t.locale === "fr" ? "Forteresse construite et enregistrée." : "Fortress built and saved.",
    );
  };
  const shootSiege = (): void => {
    if (!siege || !player.isActive || inventory.isOpen) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    if (siege.shoot(camera.position, forward, performance.now() / 1000, clearSight)) {
      sound.breakBlock(BlockId.WOOD);
    }
  };
  const startSiege = (): void => {
    if (!siege || !player.isActive || player.riding || siege.active || !fortress) return;
    const distance = Math.hypot(
      player.position.x - (fortress.x + FORTRESS_CENTER),
      player.position.z - (fortress.z + FORTRESS_CENTER),
    );
    if (distance > 72) return;
    siege.start();
    syncGateVisuals();
    hud.announce(
      t.locale === "fr"
        ? "Prépare-toi : attaque dans 20 secondes !"
        : "Get ready: attack in 20 seconds!",
    );
  };
  const repairSiege = (): void => {
    if (siege?.repair()) hud.announce(t.locale === "fr" ? "Cristal réparé !" : "Crystal repaired!");
  };
  const buySiege = (item: ArmoryPurchase): void => {
    if (!siege || !fortress || !player.isActive || inventory.isOpen || player.riding) return;
    const distance = Math.hypot(
      player.position.x - (fortress.x + FORTRESS_CENTER),
      player.position.z - (fortress.z + FORTRESS_CENTER),
    );
    if (distance > 72 || !siege.buy(item)) return;
    hud.announce(
      t.locale === "fr" ? "Achat effectué dans l’armurerie." : "Armory purchase complete.",
    );
  };
  const siegePanel = new SiegePanel(
    app,
    {
      build: buildFortress,
      visit: visitFortress,
      start: startSiege,
      stop: () => siege?.stop(),
      shoot: shootSiege,
      repair: repairSiege,
      buy: buySiege,
    },
    t.locale === "fr",
  );

  // ---- menu and settings ----
  const menu = new Menu(menuRoot, settings, {
    seed: SEED,
    touch,
    t,
    listWorlds: () => worldRegistry.list(),
    onCreateWorld: (name, chosenMode, chosenSeed) => {
      const entry = worldRegistry.create(name, chosenMode, chosenSeed);
      if (!entry) return false;
      persist();
      const url = new URL(window.location.href);
      url.searchParams.set("seed", entry.seed.toString());
      window.location.href = url.toString();
      return true;
    },
    onRenameWorld: (seed, name) => worldRegistry.rename(seed, name),
    onDeleteWorld: (seed) => worldRegistry.remove(seed, SEED),
    onExportWorld: (seed) => {
      if (seed === SEED) persist();
      return exportWorldArchive(storage, worldRegistry.get(seed));
    },
    onImportWorld: (contents) => importWorldArchive(storage, worldRegistry, contents),
    onLanguageChange: () => {
      persist();
      window.location.reload();
    },
    mode,
    onModeChange: (next) => {
      mode = next;
      worldRegistry.setMode(SEED, next);
      applyMode();
      persist();
    },
    canUsePost: webgl?.supportsPost ?? false,
    onClick: () => {
      sound.unlock();
      sound.click();
    },
    onOpenWorld: (seed) => {
      persist();
      const url = new URL(window.location.href);
      url.searchParams.set("seed", seed.toString());
      url.searchParams.delete("mode");
      window.location.href = url.toString();
    },
    onResetWorld: () => {
      editStore.clear();
      fortressStore.clear();
      window.location.reload();
    },
  });

  const applySetting = (values: Settings, key: keyof Settings): void => {
    switch (key) {
      case "quality":
        webgl?.setQuality(values.quality);
        break;
      case "viewDistance":
        webgl?.setViewDistance(values.viewDistance);
        if (webgl) streamer.setRadius(values.viewDistance + 1);
        break;
      case "fov":
        player.options.fov = values.fov;
        break;
      case "sensitivity":
        player.options.sensitivity = values.sensitivity;
        break;
      case "invertY":
        player.options.invertY = values.invertY;
        break;
      case "autoJump":
        player.options.autoJump = values.autoJump;
        break;
      case "viewBob":
        player.options.viewBob = values.viewBob;
        break;
      case "volume":
        sound.setVolume(values.volume);
        break;
      case "showStats":
        hud.setStatsVisible(values.showStats);
        break;
      case "language":
        break; // applied by a reload (see the menu's onLanguageChange)
    }
  };
  settings.onChange(applySetting);

  player.onResume = () => {
    sound.unlock();
    sound.setPaused(false);
    menu.markStarted();
  };
  player.onPause = () => {
    drill.stopDrilling();
    inventory.hide();
    interaction.enabled = !player.riding;
    menu.show("main");
    sound.setPaused(true);
    persist();
  };
  player.onFlightChange = (flying) => {
    hud.announce(t(flying ? "flying" : "walking"));
    touchControls?.setFlying(flying);
  };
  player.events = {
    onStep: (block) => {
      sound.step(block);
    },
    onJump: () => {
      sound.jump();
    },
    onLand: (fallSpeed, block) => {
      sound.land(fallSpeed, block);
    },
    onSplash: (entering) => {
      sound.splash(entering);
      const p = player.position;
      if (entering) particles?.splash(p.x, Math.floor(p.y) + 0.9, p.z);
    },
  };

  // Android's back button: close what's open, then pause; only from the
  // menu does it leave the app (the shell sends it to the background).
  window.__nativeBack = () => {
    if (inventory.isOpen) {
      setInventory(false);
      return true;
    }
    if (player.isActive) {
      player.releaseControl();
      return true;
    }
    return false;
  };

  document.addEventListener("mousedown", (event) => {
    if (
      event.button === 0 &&
      player.mode === "pointer" &&
      !player.isUiOpen &&
      !inventory.isOpen &&
      !siege?.active &&
      player.currentMount === drill
    )
      drill.triggerHeld = true;
  });
  document.addEventListener("mouseup", (event) => {
    if (event.button === 0) drill.triggerHeld = false;
  });
  window.addEventListener("blur", () => {
    drill.stopDrilling();
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (player.isActive && !player.isUiOpen && !inventory.isOpen && player.currentMount === drill) {
      if (e.code === "KeyT") {
        drill.cycleSize();
        e.preventDefault();
        return;
      }
      if (e.code === "KeyJ") {
        toggleDrillCut();
        e.preventDefault();
        return;
      }
    }
    if (e.code === "KeyP" && !player.riding && toggleDrillRide()) {
      e.preventDefault();
      return;
    }
    // A desktop pointer-lock player can open the mini-game panel with M.
    // F is reserved for flying in PlayerController; G fires event arrows.
    if (e.code === "KeyM" && player.isActive && !inventory.isOpen && mode === "creative") {
      e.preventDefault();
      if (player.isUiOpen) player.closeUi();
      else {
        drill.stopDrilling();
        player.openUi();
      }
      return;
    }
    if (player.isActive && !inventory.isOpen && mode === "creative") {
      if (e.code === "KeyB") buildFortress();
      else if (e.code === "KeyV") visitFortress();
      else if (e.code === "KeyN") startSiege();
      else if (e.code === "KeyX") siege?.stop();
      else if (e.code === "KeyH") repairSiege();
      else if (e.code === "KeyG") shootSiege();
      if (["KeyB", "KeyV", "KeyN", "KeyX", "KeyH", "KeyG"].includes(e.code)) {
        e.preventDefault();
        return;
      }
    }
    if (e.code === "KeyR" && !e.altKey && !e.ctrlKey && !e.metaKey && toggleCurrentRide()) {
      e.preventDefault();
    } else if (e.code === "KeyY" && !e.altKey && !e.ctrlKey && !e.metaKey && toggleDrillRide()) {
      e.preventDefault();
    } else if (e.code === "KeyE") {
      setInventory(!inventory.isOpen);
    } else if (e.code === "Escape" && inventory.isOpen) {
      // Escape already released the pointer; leave play cleanly.
      player.releaseControl();
    } else if (e.code === "F3") {
      e.preventDefault();
      settings.set("showStats", !settings.values.showStats);
    } else if (e.code === "F1") {
      // Photo mode: nothing on screen but the world.
      e.preventDefault();
      hudHidden = !hudHidden;
      app.classList.toggle("hud-hidden", hudHidden);
    } else if (e.code === "F2") {
      e.preventDefault();
      wantScreenshot = true;
    }
  });

  window.addEventListener("resize", () => {
    webgl?.resize(window.innerWidth, window.innerHeight);
    cpu?.resize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      drill.stopDrilling();
      persist();
      sound.setPaused(true);
    } else if (player.isActive) {
      sound.setPaused(false);
    }
  });
  window.addEventListener("pagehide", persist);

  // ---- how far underground is the camera? ----
  let caveFactor = 0;
  let caveColumnKey = "";
  let caveColumnHeight = 0;
  const caveTarget = (): number => {
    const c = camera.position;
    const bx = Math.floor(c.x);
    const bz = Math.floor(c.z);
    const key = `${bx.toString()},${bz.toString()}`;
    if (key !== caveColumnKey) {
      caveColumnKey = key;
      caveColumnHeight = sampleColumn(bx, bz).terrainHeight;
    }
    if (c.y > caveColumnHeight - 5) return 0;
    // Under the natural surface: a cave only if there's a roof overhead.
    const from = Math.floor(c.y) + 1;
    for (let y = from; y < Math.min(CHUNK_HEIGHT, from + 48); y++) {
      if (isSolid(world.getBlock(bx, y, bz))) return 1;
    }
    return 0;
  };

  /** Where fireflies may appear: over grass, on dry land. */
  const fireflyGround = (x: number, z: number): number => {
    const profile = sampleColumn(Math.floor(x), Math.floor(z));
    const meadow =
      profile.biome === Biome.PLAINS ||
      profile.biome === Biome.FOREST ||
      profile.biome === Biome.AUTUMN;
    return meadow && profile.terrainHeight > SEA_LEVEL ? profile.terrainHeight : -1;
  };

  if (import.meta.env.DEV || import.meta.env.MODE === "e2e") {
    window.__mc = {
      position: () => ({ ...player.position }),
      blockAt: (x, y, z) => world.getBlock(x, y, z),
      target: () => {
        camera.updateMatrixWorld();
        const hit =
          player.currentMount === drill
            ? raycastVoxels(
                camera.position,
                camera.getWorldDirection(forward),
                18,
                blocksDrillLight,
              )
            : interaction.raycastFromCamera();
        return hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null;
      },
      pitch: () => player.eyePitch,
      setLook: (yaw, pitch) => {
        player.restore({ ...player.pose(), yaw, pitch });
      },
      mode: () => player.mode,
      renderer: () => (webgl ? "webgl" : "cpu"),
      touch: () => touchControls !== null,
      loadedChunks: () => world.loadedChunkCount,
      meshedChunks: () => chunkMeshes?.meshedChunkCount ?? world.loadedChunkCount,
      pendingChunks: () => streamer.pendingCount,
      seed: SEED,
      setTime: (phase) => {
        frozenTime = phase === null ? null : phase * DAY_LENGTH_SECONDS;
      },
      setDrillLamp: (enabled) => {
        drillLampEnabled = enabled;
      },
      setQuality: (level) => {
        if (level === "low" || level === "medium" || level === "high" || level === "ultra") {
          settings.set("quality", level);
        }
      },
      teleport: (x, y, z, yaw, pitch) => {
        player.restore({ x, y, z, yaw, pitch, flying: true });
      },
      groundAt: (x, z) => sampleColumn(x, z).terrainHeight,
      locate: (biome, skip = 0) => {
        let found = 0;
        for (let radius = 0; radius < 4000; radius += 24) {
          for (let i = -radius; i <= radius; i += 24) {
            for (const [x, z] of [
              [i, -radius],
              [i, radius],
              [-radius, i],
              [radius, i],
            ] as const) {
              const p = sampleColumn(x, z);
              if (p.biome === biome && found++ >= skip) return { x, z, h: p.terrainHeight };
            }
          }
        }
        return null;
      },
      stats: () => ({
        ...webgl?.stats(),
        quads: chunkMeshes?.quadTotal,
        queued: chunkMeshes?.queuedCount,
        scale: webgl?.renderScale,
        fps: hud.fps,
      }),
      hotbar: () => [...hotbar.contents],
      flying: () => player.isFlying,
      dragon: () => ({
        position: dragon.position,
        renderedPosition: dragonModel.visibleModel?.position ?? null,
        ready: dragonModel.ready,
        mounted: player.currentMount === dragon,
        flying: dragon.flying,
        grounded: dragon.grounded,
      }),
      drill: () => ({
        position: drill.position,
        exit: drill.safeExit(),
        yaw: drill.yaw,
        mounted: player.currentMount === drill,
        flying: drill.flying,
        drilling: drill.drilling,
        size: drill.size,
      }),
      inventoryOpen: () => inventory.isOpen,
      gameMode: () => mode,
      setMode: (next) => {
        if (next !== "creative" && next !== "adventure") return;
        mode = next;
        applyMode();
      },
      bag: () => bag.toJSON(),
      give: (block, amount) => {
        bag.add(block as BlockId, amount);
      },
      creatures: () =>
        nearbyCreatures.map((entity) => ({ ...entity, position: { ...entity.position } })),
      discoveries: () => journal.toJSON().found,
      digging: () => interaction.digProgress?.fraction ?? 0,
      siege: () => siege?.report ?? null,
      settings: () => ({ ...settings.values }),
      setWeather: (overcast, amount = 0) => {
        forcedWeather = overcast === null ? null : { overcast, rain: amount };
      },
      setBlock: (x, y, z, id, record = false) => {
        if (!(id in BLOCKS) || y < 1 || y >= CHUNK_HEIGHT) return;
        world.setBlock(x, y, z, id as BlockId);
        chunkMeshes?.blockChanged(x, y, z, id);
        if (record) editStore.record(x, y, z, id as BlockId);
      },
    };
  }

  // Offline access is enabled for the standalone web build only.
  if (
    import.meta.env.PROD &&
    import.meta.env.MODE !== "native" &&
    import.meta.env.MODE !== "private-site" &&
    "serviceWorker" in navigator
  ) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }

  let lastTime = performance.now();
  let lastSave = lastTime;
  let lastLook = lastTime;
  let nextDragonSpawnTry = lastTime;
  const frame = (time: number): void => {
    const frameDelta = time - lastTime;
    const dt = Math.min(frameDelta / 1000, 0.1); // clamp to avoid a huge step after a tab switch
    lastTime = time;
    gameTime += dt;
    const clock = siege?.active
      ? (Math.floor(gameTime / DAY_LENGTH_SECONDS) + 0.86) * DAY_LENGTH_SECONDS
      : (frozenTime ?? gameTime);

    // Adaptive quality: feed the real frame cadence so the renderer can
    // trade resolution for a fluid frame rate on weaker (mobile) hardware.
    webgl?.tickAdaptive(frameDelta);

    const controlsVisible = player.isActive && !inventory.isOpen;
    if (touchControls && controlsVisible !== touchVisible) {
      touchVisible = controlsVisible;
      touchControls.setVisible(touchVisible);
    }
    hotbar.enabled = player.isActive && !inventory.isOpen;

    const pad = gamepad.poll(dt);
    if (!pad && padDriving) {
      padDriving = false;
      player.setExternalInput(null);
    }
    if (pad) {
      if (pad.pause) {
        if (player.isActive) player.releaseControl();
        else player.requestControl();
      }
      if (player.isActive) {
        if (pad.inventory) setInventory(!inventory.isOpen);
        if (!inventory.isOpen) {
          // Only take over movement while the pad is actually in use, so
          // it never fights the keyboard or the touch joystick.
          if (pad.active || padDriving) {
            padDriving = pad.active;
            player.setExternalInput(
              pad.active
                ? {
                    forward: pad.forward,
                    right: pad.right,
                    jump: pad.jump,
                    sprint: pad.sprint,
                    descend: pad.descend,
                  }
                : null,
            );
          }
          if (pad.lookX !== 0 || pad.lookY !== 0) player.lookBy(pad.lookX, pad.lookY);
          if (pad.breakBlock) {
            if (player.currentMount === drill) toggleDrillCut();
            else interaction.breakTargetedBlock();
          }
          if (pad.placeBlock) {
            if (player.currentMount === drill) drill.cycleSize();
            else interaction.placeTargetedBlock();
          }
          if (pad.hotbarStep !== 0) hotbar.cycle(pad.hotbarStep);
          if (pad.toggleFlight && !toggleCurrentRide()) player.toggleFlight();
        }
      }
    }

    streamer.update(player.position.x, player.position.z);
    if (time >= nextDragonSpawnTry) {
      spawnDragon();
      spawnDrill();
      nextDragonSpawnTry = time + 1000;
    }
    player.update(dt);
    const dragonPosition = player.mountRenderPosition(dragon);
    const { x, z } = player.position;
    const dragonDistance = dragonPosition
      ? Math.hypot(x - dragonPosition.x, z - dragonPosition.z)
      : Infinity;
    if (dragonPosition) {
      if (!player.riding && player.isActive && dragonDistance < 25)
        dragon.step(Math.min(dt, 1 / 30), null);
      dragonModel.setArmored(bag.count(COPPER_ARMOR) > 0);
      dragonModel.update(
        player.isActive ? dt : 0,
        dragon,
        dragonPosition,
        dragonDistance,
        player.currentMount === dragon,
      );
    }
    const drillPosition = player.mountRenderPosition(drill);
    const pilotingDrill = player.currentMount === drill;
    app.classList.toggle("drill-aim", pilotingDrill && controlsVisible && !player.isUiOpen);
    const drillDistance = drillPosition
      ? Math.hypot(x - drillPosition.x, z - drillPosition.z)
      : Infinity;
    drillModel.update(
      player.isActive ? dt : 0,
      drill,
      mode === "creative" ? drillPosition : null,
      drillDistance,
      pilotingDrill,
    );
    const dragonAvailable =
      controlsVisible && (player.currentMount === dragon || (!player.riding && canMountDragon()));
    const drillAvailable =
      controlsVisible && (player.currentMount === drill || (!player.riding && canMountDrill()));
    const rideAvailable = dragonAvailable || drillAvailable;
    if (touchControls) {
      touchControls.setRide(
        dragonAvailable ? t(player.currentMount === dragon ? "dragonDismount" : "dragonMount") : "",
        player.riding,
        player.flightAllowed,
      );
      const drillRideLabel =
        player.currentMount === drill
          ? t("drillLeave")
          : drillAvailable
            ? t("drillBoard")
            : t("drillFind");
      touchControls.setDrillRide(
        controlsVisible && mode === "creative" && (!player.riding || player.currentMount === drill)
          ? drillRideLabel
          : "",
      );
      touchControls.setDrill(
        player.currentMount === drill,
        drill.drilling,
        drill.size,
        t.locale === "fr",
      );
      touchControls.setFlying(
        player.riding ? (player.currentMount?.flying ?? false) : player.isFlying,
      );
    }
    let hint = "";
    if (drillAvailable && !touch) {
      hint =
        player.currentMount === drill
          ? t(player.mode === "pointer" ? "drillPointerHint" : "drillDragHint", {
              size: drill.size,
              status: t(drill.drilling ? "drillOn" : "drillOff"),
            })
          : `[Y] ${t("drillBoard")}`;
    } else if (
      controlsVisible &&
      !touch &&
      mode === "creative" &&
      !player.riding &&
      !dragonAvailable
    ) {
      hint = `[Y] ${t("drillFind")}`;
    } else if (controlsVisible && !rideAvailable && dragonModel.ready && dragonDistance < 18) {
      hint = t("dragonApproachHint");
    } else if (dragonAvailable && (!touch || player.riding)) {
      hint = touch
        ? t(dragon.flying ? "dragonTouchFlyingHint" : "dragonTouchTakeoffHint")
        : player.riding
          ? t(dragon.flying ? "dragonFlyingHint" : "dragonTakeoffHint")
          : `[R] ${t("dragonMount")}`;
    }
    if (dragonHint.textContent !== hint) dragonHint.textContent = hint;
    dragonHint.hidden = hint === "";

    if (chunkMeshes) {
      chunkMeshes.setFocus(player.position.x, player.position.z);
      for (const { cx, cz } of streamer.drainDirty(64)) chunkMeshes.updateChunk(cx, cz);
      chunkMeshes.pump();
    }

    const adventure = mode === "adventure";
    const night = timeIsNight(clock);
    const beforeSiegeUpdate = siege?.report;
    if (player.isActive && !inventory.isOpen && !document.hidden) siege?.update(dt);
    if (siege && fortress && beforeSiegeUpdate) {
      const report = siege.report;
      if (beforeSiegeUpdate.outerGate.health > 0 && report.outerGate.health === 0) {
        sound.breakBlock(BlockId.PLANKS);
        particles?.burst(fortress.x + 47, fortress.y + 3, fortress.z + 2, BlockId.WOOD);
        hud.announce(t.locale === "fr" ? "Porte extérieure détruite !" : "Outer gate destroyed!");
      }
      if (beforeSiegeUpdate.innerGate.health > 0 && report.innerGate.health === 0) {
        sound.breakBlock(BlockId.PLANKS);
        particles?.burst(fortress.x + 47, fortress.y + 3, fortress.z + 15, BlockId.WOOD);
        hud.announce(t.locale === "fr" ? "Porte intérieure détruite !" : "Inner gate destroyed!");
      }
    }
    syncGateVisuals();
    if (siege?.active) drill.stopDrilling();
    const nearbySiege =
      siege?.zombies.filter(
        (enemy) =>
          Math.hypot(player.position.x - enemy.position.x, player.position.z - enemy.position.z) <
          68,
      ) ?? [];
    const distanceToFortress = fortress
      ? Math.hypot(
          player.position.x - (fortress.x + FORTRESS_CENTER),
          player.position.z - (fortress.z + FORTRESS_CENTER),
        )
      : Infinity;
    siegePanel.update({
      creative: mode === "creative",
      playing: player.isActive && !inventory.isOpen,
      hasFortress: fortress !== null,
      nearby: distanceToFortress < 72,
      report: siege?.report ?? null,
    });
    const wildlifeEvent = wildlife.update(
      dt,
      player.position,
      adventure ? night : null,
      controlsVisible,
      bag.count(COPPER_ARMOR) > 0,
      heldEquipment === WOOD_SHIELD && bag.count(WOOD_SHIELD) > 0,
      !night,
    );
    nearbyCreatures = [...wildlife.nearby(player.position), ...nearbySiege];
    if (wildlifeEvent === "hurt") hud.announce(t("playerHurt"));
    if (wildlifeEvent === "blocked") hud.announce(t("shieldBlocked"));
    if (wildlifeEvent === "retreat") {
      if (player.riding) {
        dragon.returnToParking();
        interaction.enabled = true;
        app.classList.remove("riding");
      }
      streamer.warmUp(spawn.x, spawn.z, WARMUP_RADIUS_CHUNKS);
      const y = sampleColumn(Math.floor(spawn.x), Math.floor(spawn.z)).terrainHeight + 1;
      const floor = standNear(spawn.x, spawn.z, y, true);
      player.restore({
        ...player.pose(),
        x: spawn.x,
        y: floor ?? y + 2,
        z: spawn.z,
        flying: false,
      });
      hud.announce(t("playerRetreat"));
      persist();
    }

    interaction.update(dt);
    updateFirstNight(controlsVisible, night);
    const digging = interaction.digProgress;
    if (digVeil) {
      digVeil.visible = digging !== null;
      if (digging) {
        digVeil.position.set(digging.x + 0.5, digging.y + 0.5, digging.z + 0.5);
        (digVeil.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.5 * digging.fraction;
      }
    }

    const hit = player.isActive && !inventory.isOpen ? interaction.raycastFromCamera() : null;
    const aimedCreature = controlsVisible && !player.riding && !digging ? findCreature() : null;
    const targetedCreature = adventure || aimedCreature?.kind === "cow" ? aimedCreature : null;
    let digHint = "";
    const use = t(padDriving ? "usePad" : touch && !player.isLocked ? "useTouch" : "useMouse");
    if (targetedCreature?.kind === "cow") {
      digHint = t("cowHint", { use });
    } else if (targetedCreature?.kind === "cat") {
      digHint = t(
        targetedCreature.growsIn > 0
          ? "catKitten"
          : targetedCreature.owned
            ? "catBreed"
            : "catAdopt",
        { use },
      );
    } else if (targetedCreature?.kind === "siege-zombie") {
      digHint = `${t.locale === "fr" ? "Zombie" : "Zombie"} · ${targetedCreature.health.toString()} PV · ${t.locale === "fr" ? "Attaquer ou tirer (G)" : "Attack or fire (G)"}`;
    } else if (targetedCreature?.kind === "roamer") {
      const attack = t(
        padDriving ? "attackPad" : touch && !player.isLocked ? "attackTouch" : "attackMouse",
      );
      digHint = `${t(targetedCreature.variant === "miner" ? "miner" : "roamer", { life: targetedCreature.health })} · ${attack}`;
    } else if (adventure && hit && !digging) {
      const target = world.getBlock(hit.blockX, hit.blockY, hit.blockZ);
      if (target === BlockId.CAMP_BED) digHint = t(night ? "campSleep" : "campDay", { use });
      else if (BLOCKS[target].breakable) {
        if (!Number.isFinite(adventureDigSeconds(target))) digHint = t("miningPickRequired");
        else if (padDriving) digHint = t("digPad");
        else if (player.isLocked) digHint = t("digHold");
        else digHint = t(touch ? "digTouch" : "digClick");
      }
    }
    hud.setDigging(digging?.fraction ?? null, digHint);
    const pets = wildlife.petCount;
    hud.setAdventureStatus(
      adventure && controlsVisible
        ? [
            t(night ? "adventNight" : "adventDay"),
            t("healthStatus", { life: wildlife.health, max: MAX_HEALTH }),
            ...(pets > 0 ? [t("petStatus", { count: pets })] : []),
          ].join(" · ")
        : "",
    );
    if (highlight) {
      highlight.visible = hit !== null;
      if (hit) highlight.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
    }
    cpu?.setHighlight(hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null);

    caveFactor += (caveTarget() - caveFactor) * (1 - Math.exp(-dt * 1.6));
    const underwater = player.eyeInWater;

    // Weather follows the game clock, not the (possibly frozen) time of day.
    const weather = forcedWeather ?? weatherAt(SEED, gameTime);
    flash = Math.max(0, flash - dt * 5);
    if (weather.rain > 0.75) {
      nextStrike -= dt;
      if (nextStrike <= 0) {
        flash = 1;
        nextStrike = 9 + Math.random() * 22;
        if (caveFactor < 0.5) sound.thunder();
      }
    }
    const environment = applyWeather(environmentAt(clock), weather, flash * (1 - caveFactor));
    const sheltered = rain?.sheltered(camera.position) ?? false;

    sound.update({
      night: environment.night,
      underwater,
      cave: caveFactor,
      speed: Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z),
      rain: weather.rain,
      sheltered,
    });

    // The journal looks around about once a second.
    if (player.isActive && time - lastLook > 1000) {
      lastLook = time;
      const here = sampleColumn(Math.floor(player.position.x), Math.floor(player.position.z));
      celebrate(
        journal.observe({
          biome: here.biome,
          y: player.position.y,
          underground: caveFactor > 0.5,
          swimming: underwater,
          flying: player.isFlying,
          night: environment.night,
          rain: weather.rain,
          snowing: here.frozen || here.isSnowy,
        }),
      );
    }

    if (time - lastSave > SAVE_INTERVAL_MS && player.isActive) {
      lastSave = time;
      persist();
    }

    hud.frame(time, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      chunks: world.loadedChunkCount,
      seed: SEED,
      note: webgl
        ? `${webgl.qualityLevel} ${Math.round(webgl.renderScale * 100).toString()}%`
        : `cpu ${(cpu?.internalWidth ?? 0).toString()}p`,
    });

    const handVisible = controlsVisible && !hudHidden && !player.riding;
    const heldItem =
      (siege?.active ? COPPER_SWORD : null) ??
      (mode === "adventure" && heldEquipment && bag.count(heldEquipment) > 0
        ? heldEquipment
        : null) ??
      hotbar.selectedBlock;
    if (cpuHand) {
      const hideHand = !handVisible || (mode !== "adventure" && !siege?.active);
      if (cpuHand.hidden !== hideHand) cpuHand.hidden = hideHand;
      if (!hideHand && cpuHeldItem !== heldItem) {
        const showEquipment = typeof heldItem === "string";
        const icon = showEquipment
          ? renderEquipmentIcon(64, heldItem)
          : renderBlockIcon(atlas.canvas, heldItem, 64);
        cpuHand.classList.toggle("holding-pick", showEquipment);
        cpuHand.replaceChildren(icon);
        cpuHeldItem = heldItem;
      }
    }
    creatureView.render(
      nearbyCreatures,
      time / 1000,
      dt,
      1 - 0.64 * Math.max(environment.night, caveFactor * 0.85),
    );
    const headlamp =
      pilotingDrill && drillPosition && drillLampEnabled
        ? drillHeadlamp(drillPosition, drill.yaw, drill.pitch, blocksDrillLight, lampDepth)
        : null;
    if (webgl) {
      webgl.setDrillHeadlamp(headlamp);
      const open = 1 - caveFactor;
      heldBlock?.setItem(heldItem);
      heldBlock?.update(
        dt,
        player.bob,
        [
          environment.ambientSky[0] * open + environment.lightColor[0] * 0.45 * open + 0.16,
          environment.ambientSky[1] * open + environment.lightColor[1] * 0.45 * open + 0.15,
          environment.ambientSky[2] * open + environment.lightColor[2] * 0.45 * open + 0.13,
        ],
        handVisible,
      );
      particles?.update(
        dt,
        player.position,
        environment.night * open,
        [
          environment.ambientSky[0] * open + environment.lightColor[0] * 0.5 * open + 0.02,
          environment.ambientSky[1] * open + environment.lightColor[1] * 0.5 * open + 0.02,
          environment.ambientSky[2] * open + environment.lightColor[2] * 0.5 * open + 0.02,
        ],
        window.innerHeight * webgl.renderer.getPixelRatio(),
        camera.fov,
        environment.exposure,
        fireflyGround,
      );
      // Cold places get snow instead of rain.
      const here = sampleColumn(Math.floor(camera.position.x), Math.floor(camera.position.z));
      rain?.update(
        dt,
        camera,
        world,
        underwater ? 0 : weather.rain * open,
        here.frozen || here.isSnowy,
        [
          environment.ambientSky[0] + environment.lightColor[0] * 0.3,
          environment.ambientSky[1] + environment.lightColor[1] * 0.3,
          environment.ambientSky[2] + environment.lightColor[2] * 0.3,
        ],
        environment.exposure,
      );
      webgl.setWeather(weather.overcast, weather.rain);
      webgl.setCaveFactor(caveFactor);
      webgl.setEnvironment(environment, time / 1000, underwater);
      webgl.render();
      if (wantScreenshot) {
        // The drawing buffer is only readable in the task that drew it.
        wantScreenshot = false;
        webgl.domElement.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${GAME_NAME.toLowerCase()}-${Date.now().toString()}.png`;
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
          }, 5000);
        }, "image/png");
        hud.announce(t("screenshotSaved"));
      }
    } else if (cpu) {
      cpu.applySky(skyStateAt(clock));
      cpu.render(
        clock,
        player.currentMount === drill
          ? drillModel.visibleModel
          : player.currentMount === dragon
            ? dragonModel.visibleModel
            : drillModel.visibleModel && drillDistance < dragonDistance
              ? drillModel.visibleModel
              : dragonModel.visibleModel,
        headlamp,
      );
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (error) {
  console.error(error);
  showFatalError(error, createTranslator(resolveLocale("auto", navigator.languages)));
}
