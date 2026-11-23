import "./style.css";
import * as THREE from "three";
import { SoundEngine } from "./audio/sound";
import { GAME_NAME } from "./branding";
import { type DiscoveryId, Journal } from "./game/discoveries";
import { DragonMount } from "./game/dragon";
import { attackDamage } from "./game/equipment";
import { createFortressBlueprint, FORTRESS_CENTER } from "./game/siege/fortress";
import { findFortressSite, FortressStore } from "./game/siege/fortress-store";
import { SiegeController, type SiegeReport } from "./game/siege/session";
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
import { Hotbar, sanitizeHotbar } from "./ui/hotbar";
import { Hud } from "./ui/hud";
import { Inventory, type InventoryState } from "./ui/inventory";
import { Menu } from "./ui/menu";
import { SiegePanel } from "./ui/siege-panel";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";
import { BLOCKS, BlockId, isSolid } from "./world/blocks";
import { CHUNK_HEIGHT, worldToChunk } from "./world/coords";
import { EditStore, type KeyValueStorage } from "./world/edit-store";
import { loadPlayerSave, storePlayerSave } from "./world/player-save";
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
      setQuality: (level: string) => void;
      teleport: (x: number, y: number, z: number, yaw: number, pitch: number) => void;
      groundAt: (x: number, z: number) => number;
      locate: (biome: number, skip?: number) => { x: number; z: number; h: number } | null;
      stats: () => Record<string, number | undefined>;
      hotbar: () => number[];
      flying: () => boolean;
      dragon: () => {
        position: { x: number; y: number; z: number } | null;
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
      /** Stages a scene for screenshots; not recorded as a player edit. */
      setBlock: (x: number, y: number, z: number, id: number) => void;
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

  const editStore = new EditStore(storage, SEED);
  const streamer = new ChunkStreamer(world, {
    // One extra ring of data beyond what's drawn: lighting a chunk reads
    // all eight of its neighbors.
    radius: webgl ? settings.values.viewDistance + 1 : STREAM_RADIUS_CPU,
    editStore,
    shape: webgl ? "disc" : "square",
    meshWhenSurrounded: webgl !== null,
    onLoad: (cx, cz) => {
      chunkMeshes?.chunkLoaded(cx, cz);
    },
    onUnload: (cx, cz) => {
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
  const saved = loadPlayerSave(storage, SEED);
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

  // ---- game mode: Creative (everything, unlimited) or Adventure ----
  const modeParam = params.get("mode");
  let mode: "creative" | "adventure" =
    modeParam === "adventure" || modeParam === "creative" ? modeParam : (saved?.mode ?? "creative");
  const bag = new Bag(saved?.bag);
  const fortressStore = new FortressStore(storage, SEED);
  let fortress = fortressStore.read();
  let siege: SiegeController | null = fortress
    ? new SiegeController(fortress, (x, z) =>
        sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight,
      )
    : null;
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
  const wildlife = new Wildlife(
    SEED,
    {
      stand: standNear,
      surface: (x, z) => sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight + 1,
      clear: clearSight,
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
      const radius = creature.kind === "roamer" ? 0.52 :
        creature.kind === "siege-zombie" ? (creature.variant === "boss" ? 0.86 : 0.52) :
          creature.growsIn > 0 ? 0.24 : 0.38;
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
  interaction.occupiedByEntity = (x, y, z) => dragon.occupiesBlock(x, y, z);
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
    if (player.riding) dragon.recordParking();
    const pose = player.pose();
    const safeReturn = player.riding ? dragon.savedRiderPosition : undefined;
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
      wildlife: wildlife.save(),
    });
  };

  interaction.onAttack = () => {
    const creature = findCreature();
    if (!creature) return false;
    // Cats and kittens are companions and never take damage.
    if (creature.kind === "cat") return true;
    if (creature.kind === "siege-zombie") {
      if (siege?.melee(creature, attackDamage(siege.active ? COPPER_SWORD : heldEquipment), performance.now() / 1000)) {
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
    if (result === "struck") hud.announce(t("roamerStruck"));
    if (result === "defeated") {
      bag.add(BlockId.COAL_ORE);
      nearbyCreatures = wildlife.nearby(player.position);
      hud.announce(t("roamerFell"));
      persist();
    }
    return true;
  };
  interaction.onUse = (hit) => {
    const creature = findCreature();
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

  const toggleRide = (): boolean => {
    if (!player.isActive || inventory.isOpen) return false;
    if (player.riding) {
      if (player.dismount()) {
        interaction.enabled = true;
        app.classList.remove("riding");
        persist();
      } else {
        hud.announce(t(dragon.grounded ? "dragonExitBlocked" : "dragonLandingRequired"));
      }
      return true;
    }
    if (!dragonModel.ready || !player.mount(dragon)) return false;
    interaction.enabled = false;
    app.classList.add("riding");
    return true;
  };

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
        onPlace: () => {
          interaction.placeTargetedBlock();
        },
        onPause: () => {
          player.releaseControl();
        },
        onInventory: () => {
          setInventory(true);
        },
        onToggleFly: () => {
          player.toggleFlight();
        },
        onRide: toggleRide,
      })
    : null;
  let touchVisible = false;
  touchControls?.setFlying(player.isFlying);
  applyMode();

  // ---- reusable mini-game: player-triggered fortress, never a new world ----
  const visitFortress = (): void => {
    if (!fortress || player.riding) {
      hud.announce(t.locale === "fr" ? "Descends du dragon avant d'entrer." : "Dismount before entering.");
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
      hud.announce(t.locale === "fr" ? "Aucun terrain plat libre à proximité." : "No empty level site nearby.");
      return;
    }
    const agree = window.confirm(t.locale === "fr"
      ? "Construire la forteresse de 96 × 96 blocs sur un terrain vierge voisin ?"
      : "Build the 96 × 96 fortress on a nearby unedited site?");
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
      const [cx, cz] = key.split(",").map(Number);
      chunkMeshes?.chunkLoaded(cx, cz);
      chunkMeshes?.updateChunk(cx, cz, true);
    }
    fortress = site;
    fortressStore.write(site);
    siege = new SiegeController(site, (x, z) => sampleColumn(Math.floor(x), Math.floor(z)).terrainHeight);
    visitFortress();
    hud.announce(t.locale === "fr" ? "Forteresse construite et enregistrée." : "Fortress built and saved.");
  };
  const shootSiege = (): void => {
    if (!siege || !player.isActive || inventory.isOpen) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    if (siege.shoot(camera.position, forward, performance.now() / 1000, clearSight)) {
      sound.breakBlock(BlockId.WOOD);
    }
  };
  const siegePanel = new SiegePanel(app, {
    build: buildFortress,
    visit: visitFortress,
    start: () => {
      if (!siege || !player.isActive) return;
      siege.start();
      hud.announce(t.locale === "fr" ? "Prépare-toi : attaque dans 20 secondes !" : "Get ready: attack in 20 seconds!");
    },
    stop: () => siege?.stop(),
    shoot: shootSiege,
    repair: () => {
      if (siege?.repair()) hud.announce(t.locale === "fr" ? "Cristal réparé !" : "Crystal repaired!");
    },
  }, t.locale === "fr");

  // ---- menu and settings ----
  const menu = new Menu(menuRoot, settings, {
    seed: SEED,
    touch,
    t,
    onLanguageChange: () => {
      persist();
      window.location.reload();
    },
    mode,
    onModeChange: (next) => {
      mode = next;
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

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "KeyF" && siege?.active && player.isActive && !inventory.isOpen) {
      e.preventDefault();
      shootSiege();
      return;
    }
    if (e.code === "KeyR" && !e.altKey && !e.ctrlKey && !e.metaKey && toggleRide()) {
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
        const hit = interaction.raycastFromCamera();
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
        ready: dragonModel.ready,
        mounted: player.riding,
        flying: dragon.flying,
        grounded: dragon.grounded,
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
      setBlock: (x, y, z, id) => {
        if (!(id in BLOCKS) || y < 1 || y >= CHUNK_HEIGHT) return;
        world.setBlock(x, y, z, id as BlockId);
        chunkMeshes?.blockChanged(x, y, z, id);
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
      : frozenTime ?? gameTime;

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
          if (pad.breakBlock) interaction.breakTargetedBlock();
          if (pad.placeBlock) interaction.placeTargetedBlock();
          if (pad.hotbarStep !== 0) hotbar.cycle(pad.hotbarStep);
          if (pad.toggleFlight && !toggleRide()) player.toggleFlight();
        }
      }
    }

    streamer.update(player.position.x, player.position.z);
    if (time >= nextDragonSpawnTry) {
      spawnDragon();
      nextDragonSpawnTry = time + 1000;
    }
    player.update(dt);
    const dragonPosition = player.dragonRenderPosition ?? dragon.position;
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
        player.riding,
      );
    }
    const rideAvailable = controlsVisible && (player.riding || canMountDragon());
    if (touchControls) {
      touchControls.setRide(
        rideAvailable ? t(player.riding ? "dragonDismount" : "dragonMount") : "",
        player.riding,
        player.flightAllowed,
      );
      touchControls.setFlying(player.riding ? dragon.flying : player.isFlying);
    }
    let hint = "";
    if (controlsVisible && !rideAvailable && dragonModel.ready && dragonDistance < 18) {
      hint = t("dragonApproachHint");
    } else if (rideAvailable && (!touch || player.riding)) {
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
    if (player.isActive && !inventory.isOpen && !document.hidden) siege?.update(dt);
    const nearbySiege = siege?.zombies.filter((enemy) =>
      Math.hypot(player.position.x - enemy.position.x, player.position.z - enemy.position.z) < 24,
    ) ?? [];
    const distanceToFortress = fortress
      ? Math.hypot(player.position.x - (fortress.x + FORTRESS_CENTER), player.position.z - (fortress.z + FORTRESS_CENTER))
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
    const digging = interaction.digProgress;
    if (digVeil) {
      digVeil.visible = digging !== null;
      if (digging) {
        digVeil.position.set(digging.x + 0.5, digging.y + 0.5, digging.z + 0.5);
        (digVeil.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.5 * digging.fraction;
      }
    }

    const hit = player.isActive && !inventory.isOpen ? interaction.raycastFromCamera() : null;
    const targetedCreature =
      adventure && controlsVisible && !player.riding && !digging ? findCreature() : null;
    let digHint = "";
    const use = t(padDriving ? "usePad" : touch && !player.isLocked ? "useTouch" : "useMouse");
    if (targetedCreature?.kind === "cat") {
      digHint = t(
        targetedCreature.growsIn > 0
          ? "catKitten"
          : targetedCreature.owned
            ? "catBreed"
            : "catAdopt",
        { use },
      );
    } else if (targetedCreature?.kind === "siege-zombie") {
      digHint = `${t.locale === "fr" ? "Zombie" : "Zombie"} · ${targetedCreature.health.toString()} PV · ${t.locale === "fr" ? "Attaquer ou tirer (F)" : "Attack or fire (F)"}`;
    } else if (targetedCreature?.kind === "roamer") {
      const attack = t(
        padDriving ? "attackPad" : touch && !player.isLocked ? "attackTouch" : "attackMouse",
      );
      digHint = `${t("roamer", { life: targetedCreature.health })} · ${attack}`;
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
        : null) ?? hotbar.selectedBlock;
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
    if (webgl) {
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
      cpu.render(clock, dragonModel.visibleModel);
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
