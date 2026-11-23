/**
 * Drives the real game in a headless Chromium (SwiftShader software WebGL —
 * works on machines with no GPU at all) and verifies it end to end: every
 * graphics tier compiles and renders, the world is playable with mouse and
 * keyboard, with a blocked pointer lock, with no WebGL at all, and on a
 * touchscreen; progress survives a reload; the installed build boots
 * offline. Use --no-screenshots to skip saving screenshots while keeping the
 * assertions that sample rendered pixels.
 *
 *   npm run build && npm run build:e2e
 *   bash scripts/run-browser-check.sh [out-dir] [--no-screenshots]
 *
 * Set PUPPETEER_EXECUTABLE_PATH to use an already-installed Chromium.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const BASE_URL = argValue("--url", "http://127.0.0.1:4173/");
const PRODUCTION_URL = argValue("--production-url", "http://127.0.0.1:4174/");
const allowedOrigins = new Set([new URL(BASE_URL).origin, new URL(PRODUCTION_URL).origin]);
const OUT_DIR = argValue("--out", "visual-check");
mkdirSync(OUT_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  if (args.includes("--no-screenshots")) return;
  await page.screenshot({ path: path.join(OUT_DIR, filename) });
}

/** Each scenario plays in its own world (seed), so the edits and the saved
 * position of one never leak into the next. The light tier keeps software
 * rendering fast enough for real-time input tests. */
const pageUrl = (seed, extra = "quality=low&view=5") =>
  `${BASE_URL}?seed=${seed.toString()}&lang=en&${extra}`;

/** Blocks that aren't a solid cube to stand a new block on. */
const NOT_GROUND = [0, 5, 10, 11, 12, 13, 31, 33];

const results = [];
function report(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  pipe: true,
  args: [
    "--no-sandbox",
    "--proxy-server=http://127.0.0.1:9",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--window-size=1280,720",
  ],
});

const consoleErrors = [];
const externalRequests = new Set();
const localRequests = new Set();
function watch(page, label) {
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (allowedOrigins.has(url.origin)) localRequests.add(`${request.method()} ${url.pathname}`);
    else externalRequests.add(url.origin);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text().slice(0, 400)}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] ${String(err).slice(0, 400)}`));
}

/** Opens a scenario in its own browser context — separate storage and
 * service workers — the way a different player on a different device
 * would arrive. */
async function openPage(label, url, viewport = { width: 1280, height: 720 }, before) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  watch(page, label);
  if (before) await page.evaluateOnNewDocument(before);
  const bootStart = process.hrtime.bigint();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  page.bootStart = bootStart;
  return page;
}

const waitForWorld = (page, chunks, counter = "meshedChunks") =>
  page.waitForFunction(
    (n, fn) => window.__mc && window.__mc[fn]() >= n,
    {
      timeout: 180_000,
      polling: 500,
    },
    chunks,
    counter,
  );

const elapsedMs = (start) => Number(process.hrtime.bigint() - start) / 1_000_000;

async function measureProfile(page, label, readyMs) {
  const client = await page.createCDPSession();
  await client.send("Performance.enable");
  const sample = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let first;
        let previous;
        const frame = (time) => {
          first ??= time;
          if (previous !== undefined) deltas.push(time - previous);
          previous = time;
          if (time - first < 3500) window.requestAnimationFrame(frame);
          else {
            deltas.sort((a, b) => a - b);
            resolve({
              fps: (1000 * deltas.length) / (time - first),
              p95Ms: deltas[Math.floor((deltas.length - 1) * 0.95)],
              renderer: window.__mc.renderer(),
              chunks: window.__mc.loadedChunks(),
              scale: window.__mc.stats().scale,
              quality: window.__mc.settings().quality,
            });
          }
        };
        window.requestAnimationFrame(frame);
      }),
  );
  const { metrics } = await client.send("Performance.getMetrics");
  await client.detach();
  const heap = metrics.find(({ name }) => name === "JSHeapUsedSize")?.value;
  console.log(
    `METRIC ${label} ${JSON.stringify({ ...sample, readyMs, jsHeapMiB: heap / 1048576 })}`,
  );
}

/** How many distinct (quantized) colors a screenshot holds — a blank or
 * single-color frame scores in the single digits. */
async function colorVariety(page) {
  const b64 = await page.screenshot({ encoding: "base64" });
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const probe = document.createElement("canvas");
    probe.width = img.width;
    probe.height = img.height;
    const ctx = probe.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4 * 97) {
      colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
    }
    return colors.size;
  }, b64);
}

/** Software rendering can be slow, and the game simulates in real time —
 * so instead of sleeping a fixed time and hoping enough frames ran, wait
 * for the thing itself, with a generous ceiling. */
async function until(page, predicate, arg, timeout = 25_000) {
  return page
    .waitForFunction(predicate, { timeout, polling: 100 }, arg)
    .then(() => true)
    .catch(() => false);
}

/** Holds forward (and jump, to hop ledges) until the player has covered
 * some ground, and reports the distance. */
async function walk(page) {
  const before = await page.evaluate(() => window.__mc.position());
  await page.keyboard.down("KeyW");
  await page.keyboard.down("Space");
  await until(
    page,
    (start) => {
      const p = window.__mc.position();
      return Math.hypot(p.x - start.x, p.z - start.z) > 1.5;
    },
    before,
  );
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => window.__mc.position());
  return Math.hypot(after.x - before.x, after.z - before.z);
}

/** Keep both taps inside the game's timing window even on a slow renderer. */
async function doubleTapJump(page) {
  return page.evaluate(() => {
    const options = { code: "Space", key: " ", bubbles: true, cancelable: true };
    for (let tap = 0; tap < 2; tap += 1) {
      document.dispatchEvent(new window.KeyboardEvent("keydown", options));
      document.dispatchEvent(new window.KeyboardEvent("keyup", options));
    }
    return window.__mc.flying();
  });
}

try {
  // =====================================================================
  // 1. Desktop, WebGL, pointer lock
  // =====================================================================
  const page = await openPage("desktop", pageUrl(2026));
  await waitForWorld(page, 40);
  const desktopReadyMs = elapsedMs(page.bootStart);
  const worldInfo = await page.evaluate(() => ({
    meshed: window.__mc.meshedChunks(),
    position: window.__mc.position(),
    renderer: window.__mc.renderer(),
  }));
  report(
    "world generates and meshes (WebGL2)",
    worldInfo.meshed >= 40 && worldInfo.renderer === "webgl",
    `${worldInfo.meshed} chunks meshed, player at y=${worldInfo.position.y.toFixed(1)}`,
  );

  const grounded = await page.evaluate(() => {
    const p = window.__mc.position();
    const below = window.__mc.blockAt(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z));
    return { below, y: p.y };
  });
  report(
    "player rests on solid ground",
    !NOT_GROUND.includes(grounded.below) && grounded.y > 1,
    `y=${grounded.y.toFixed(2)}, block below=${grounded.below}`,
  );

  await saveScreenshot(page, "01-menu.png");
  const menuText = await page.evaluate(() => ({
    title: document.querySelector(".title")?.textContent ?? "",
    play: document.querySelector("#play-button")?.textContent ?? "",
  }));
  report(
    "the title menu shows the game's name and a play button",
    menuText.title.length > 0 && menuText.play === "Play",
    JSON.stringify(menuText),
  );

  // The world must be visible behind the menu, not a flat sky-only frame.
  await page.evaluate(() => document.querySelector("#overlay")?.classList.add("hidden"));
  await sleep(1500);
  await saveScreenshot(page, "02-world.png");
  const variety = await colorVariety(page);
  await page.evaluate(() => document.querySelector("#overlay")?.classList.remove("hidden"));
  report(
    "render shows real variety (terrain, not a blank frame)",
    variety > 12,
    `${variety} distinct quantized colors sampled`,
  );

  await page.click("#play-button");
  await sleep(800);
  const locked = await page.evaluate(() => document.pointerLockElement !== null);
  report("pointer lock engages from the play button", locked);
  await measureProfile(page, "desktop", desktopReadyMs);

  if (locked) {
    // ---- placing, on a solid neighboring column the test picks itself ----
    // Aiming at the top face of an adjacent column's surface block makes the
    // place cell sit outside the player's own body (placing into yourself is
    // correctly rejected). The neighbor is chosen by inspecting the world,
    // so the test doesn't depend on which way the terrain slopes.
    const neighbor = await page.evaluate((notGround) => {
      const p = window.__mc.position();
      const bx = Math.floor(p.x);
      const by = Math.floor(p.y);
      const bz = Math.floor(p.z);
      const candidates = [
        { dx: 1, dz: 0, yaw: -Math.PI / 2 }, // +X
        { dx: -1, dz: 0, yaw: Math.PI / 2 }, // -X
        { dx: 0, dz: -1, yaw: 0 }, // -Z (default facing)
        { dx: 0, dz: 1, yaw: Math.PI }, // +Z
      ];
      for (const c of candidates) {
        const surface = window.__mc.blockAt(bx + c.dx, by - 1, bz + c.dz);
        const above = window.__mc.blockAt(bx + c.dx, by, bz + c.dz);
        const higher = window.__mc.blockAt(bx + c.dx, by + 1, bz + c.dz);
        // A tuft of grass on top is fine: aiming at it replaces it, which
        // puts the new block in the very same cell.
        const clear = above === 0 || (above >= 10 && above <= 13);
        if (!notGround.includes(surface) && clear && higher === 0) {
          return { ...c, x: bx + c.dx, y: by - 1, z: bz + c.dz };
        }
      }
      return null;
    }, NOT_GROUND);
    report(
      "a flat neighboring column exists to place against",
      neighbor !== null,
      JSON.stringify(neighbor),
    );

    if (neighbor) {
      // Stage the camera at an absolute angle. A fixed sleep after a mouse
      // movement can read the previous camera frame on software WebGL.
      await page.evaluate((n) => window.__mc.setLook(n.yaw, (-55 * Math.PI) / 180), neighbor);
      const aimed = await until(
        page,
        (n) => {
          const hit = window.__mc.target();
          return hit?.x === n.x && hit.z === n.z && (hit.y === n.y || hit.y === n.y + 1);
        },
        neighbor,
        10000,
      );
      const placeTarget = await page.evaluate(() => window.__mc.target());
      const slotBlock = await page.evaluate(() => window.__mc.hotbar()[0]);
      if (aimed) {
        await page.mouse.down({ button: "right" });
        await page.mouse.up({ button: "right" });
      }
      const placed = await page.evaluate((n) => window.__mc.blockAt(n.x, n.y + 1, n.z), neighbor);
      report(
        "right click places the selected block on the neighbor's top face",
        aimed && placed === slotBlock,
        `aimed ${JSON.stringify(placeTarget)}, selected ${slotBlock}, cell above is now id ${placed}`,
      );
    }

    // The lane west of the seed 2026 spawn is flat and clear of the placed block.
    await page.evaluate(() => window.__mc.setLook(Math.PI / 2, 0));
    const walked = await walk(page);
    report(
      "walking forward moves the player through the world",
      walked > 1,
      `moved ${walked.toFixed(1)} blocks`,
    );

    // ---- breaking, straight down at the block under the player's feet ----
    await page.evaluate(() => window.__mc.setLook(0, -Math.PI / 2));
    await until(page, () => window.__mc.target() !== null, undefined, 10000);
    const target = await page.evaluate(() => window.__mc.target());
    report("crosshair targets a block when looking down", target !== null, JSON.stringify(target));
    if (target) {
      await page.mouse.down({ button: "left" });
      await page.mouse.up({ button: "left" });
      await sleep(600);
      const afterBreak = await page.evaluate((t) => window.__mc.blockAt(t.x, t.y, t.z), target);
      report(
        "left click breaks the targeted block",
        afterBreak === 0,
        `block ${JSON.stringify(target)} is now id ${afterBreak}`,
      );
    }

    // ---- creative inventory: E opens it, a click fills the hotbar slot ----
    const hotbarBefore = await page.evaluate(() => window.__mc.hotbar());
    await page.keyboard.press("KeyE");
    await sleep(400);
    const opened = await page.evaluate(() => window.__mc.inventoryOpen());
    report("E opens the block inventory", opened);
    if (opened) {
      await saveScreenshot(page, "03-inventory.png");
      // Pick a block that isn't in the selected slot yet (bricks, id 29).
      await page.click('.inventory-cell[data-block="29"]');
      await sleep(500);
      const state = await page.evaluate(() => ({
        hotbar: window.__mc.hotbar(),
        open: window.__mc.inventoryOpen(),
        mode: window.__mc.mode(),
      }));
      report(
        "choosing a block fills the selected slot and returns to the game",
        state.hotbar[0] === 29 && hotbarBefore[0] !== 29 && !state.open && state.mode !== "idle",
        `slot 1: ${hotbarBefore[0]} -> ${state.hotbar[0]}, open=${state.open}, mode=${state.mode}`,
      );
    }

    // ---- flight: double-tap jump takes off; then free movement up and down ----
    const tookOff = await doubleTapJump(page);
    report("double-tapping jump takes off", tookOff === true);

    // Move to open sky (trees may roof the spawn) and fly there.
    await page.evaluate(() => {
      const p = window.__mc.position();
      window.__mc.teleport(
        p.x,
        window.__mc.groundAt(Math.floor(p.x), Math.floor(p.z)) + 30,
        p.z,
        0,
        0,
      );
    });
    await sleep(300);
    const y0 = (await page.evaluate(() => window.__mc.position())).y;
    await page.keyboard.down("Space");
    await until(page, (from) => window.__mc.position().y > from + 4, y0);
    await page.keyboard.up("Space");
    const y1 = (await page.evaluate(() => window.__mc.position())).y;
    await page.keyboard.down("KeyC");
    await until(page, (from) => window.__mc.position().y < from - 4, y1);
    await page.keyboard.up("KeyC");
    const y2 = (await page.evaluate(() => window.__mc.position())).y;
    report(
      "in flight, jump climbs and C descends",
      y1 > y0 + 3 && y2 < y1 - 3,
      `y ${y0.toFixed(1)} -> ${y1.toFixed(1)} -> ${y2.toFixed(1)}`,
    );
    await saveScreenshot(page, "04-flying.png");

    // ---- pause, change a setting, reload: both are remembered ----
    await page.evaluate(() => document.exitPointerLock());
    await sleep(500);
    const paused = await page.evaluate(() => ({
      mode: window.__mc.mode(),
      play: document.querySelector("#play-button")?.textContent ?? "",
    }));
    report(
      "leaving pointer lock pauses to the menu, which now offers to resume",
      paused.mode === "idle" && paused.play === "Resume",
      JSON.stringify(paused),
    );
    await page.click("#settings-button");
    await sleep(200);
    await saveScreenshot(page, "05-settings.png");
    const fovBefore = (await page.evaluate(() => window.__mc.settings())).fov;
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('[data-screen="settings"] input[type="range"]');
      const fov = sliders[1]; // view distance, then field of view
      fov.value = "88";
      fov.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const fovAfter = (await page.evaluate(() => window.__mc.settings())).fov;
    report(
      "the settings panel changes a setting live",
      fovAfter === 88 && fovBefore !== 88,
      `fov ${fovBefore} -> ${fovAfter}`,
    );

    const posBefore = await page.evaluate(() => window.__mc.position());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForWorld(page, 9);
    const restored = await page.evaluate(() => ({
      position: window.__mc.position(),
      fov: window.__mc.settings().fov,
      hotbar: window.__mc.hotbar(),
      flying: window.__mc.flying(),
    }));
    const drift = Math.hypot(
      restored.position.x - posBefore.x,
      restored.position.y - posBefore.y,
      restored.position.z - posBefore.z,
    );
    report(
      "a reload restores the player's position, hotbar and settings",
      drift < 1.5 && restored.fov === 88 && restored.hotbar[0] === 29 && restored.flying,
      `moved ${drift.toFixed(2)} blocks, fov=${restored.fov}, slot 1=${restored.hotbar[0]}, flying=${restored.flying}`,
    );
    const edited = target
      ? await page.evaluate((t) => window.__mc.blockAt(t.x, t.y, t.z), target)
      : -1;
    report("the reload also keeps the world edits", edited === 0, `broken block is id ${edited}`);
  }
  await page.close();

  // ---- the interface speaks French when asked to ----
  const frenchPage = await openPage("french", `${BASE_URL}?seed=2026&lang=fr&quality=low&view=3`);
  await waitForWorld(frenchPage, 5);
  const french = await frenchPage.evaluate(() => ({
    lang: document.documentElement.lang,
    play: document.querySelector("#play-button")?.textContent?.trim() ?? "",
    settings: document.querySelector("#settings-button")?.textContent?.trim() ?? "",
    slot: document.querySelector(".hotbar-slot")?.getAttribute("title") ?? "",
  }));
  report(
    "the interface is available in French (menu and block names)",
    french.lang === "fr" &&
      french.play === "Jouer" &&
      french.settings === "Réglages" &&
      french.slot === "herbe",
    JSON.stringify(french),
  );
  await saveScreenshot(frenchPage, "05b-french.png");
  await frenchPage.close();

  // =====================================================================
  // 2. Every graphics tier compiles its shaders and draws a real frame
  // =====================================================================
  for (const tier of ["medium", "high", "ultra"]) {
    const before = consoleErrors.length;
    const tierPage = await openPage(tier, pageUrl(7, `quality=${tier}&view=3&fullres=1`), {
      width: 640,
      height: 360,
    });
    await waitForWorld(tierPage, 5);
    await tierPage.evaluate(() => document.querySelector("#overlay")?.classList.add("hidden"));
    await sleep(4000);
    const tierVariety = await colorVariety(tierPage);
    await saveScreenshot(tierPage, `06-tier-${tier}.png`);
    const errors = consoleErrors.length - before;
    report(
      `the ${tier} tier compiles and renders`,
      tierVariety > 12 && errors === 0,
      `${tierVariety} colors, ${errors} console errors`,
    );
    await tierPage.close();
  }

  // =====================================================================
  // 3. Pointer lock refused -> drag-look fallback
  // =====================================================================
  // Simulates browsers/extensions that silently refuse pointer lock — the
  // exact "I click play and nothing happens" failure. The game must fall
  // back to drag-look and still be fully playable.
  const fallbackPage = await openPage("drag", pageUrl(303), undefined, () => {
    Element.prototype.requestPointerLock = () => Promise.reject(new Error("blocked by test"));
  });
  await waitForWorld(fallbackPage, 25);
  await fallbackPage.click("#play-button");
  await sleep(1200); // watchdog is 600ms
  const fallback = await fallbackPage.evaluate(() => ({
    mode: window.__mc.mode(),
    overlayHidden: document.querySelector("#overlay")?.classList.contains("hidden") ?? false,
  }));
  report(
    "pointer lock blocked -> drag-look fallback engages",
    fallback.mode === "drag" && fallback.overlayHidden,
    `mode=${fallback.mode}, overlay hidden=${String(fallback.overlayHidden)}`,
  );

  if (fallback.mode === "drag") {
    const dist = await walk(fallbackPage);
    report("movement works in drag-look mode", dist > 1, `moved ${dist.toFixed(1)} blocks`);

    // Drag with the left button must rotate the camera.
    const pitchBefore = await fallbackPage.evaluate(() => window.__mc.pitch());
    await fallbackPage.mouse.move(640, 360);
    await fallbackPage.mouse.down({ button: "left" });
    await fallbackPage.mouse.move(640, 500, { steps: 5 });
    await fallbackPage.mouse.up({ button: "left" });
    await sleep(400);
    const pitchAfter = await fallbackPage.evaluate(() => window.__mc.pitch());
    report(
      "left-drag looks around in fallback mode",
      Math.abs(pitchAfter - pitchBefore) > 0.05,
      `pitch ${pitchBefore.toFixed(2)} -> ${pitchAfter.toFixed(2)}`,
    );

    // A quick tap (no drag) must break the block under the crosshair.
    // Steepen the view with a real drag first (synthetic mousemoves are
    // ignored in drag mode unless the button is down — by design).
    await fallbackPage.mouse.move(640, 300);
    await fallbackPage.mouse.down({ button: "left" });
    await fallbackPage.mouse.move(640, 700, { steps: 8 });
    await fallbackPage.mouse.up({ button: "left" });
    await sleep(400);
    const tapTarget = await fallbackPage.evaluate(() => window.__mc.target());
    if (tapTarget) {
      await fallbackPage.mouse.move(640, 360);
      await fallbackPage.mouse.down({ button: "left" });
      await fallbackPage.mouse.up({ button: "left" });
      await sleep(500);
      const afterTap = await fallbackPage.evaluate(
        (t) => window.__mc.blockAt(t.x, t.y, t.z),
        tapTarget,
      );
      report("tap breaks a block in fallback mode", afterTap === 0, `block is now id ${afterTap}`);
    } else {
      report("tap breaks a block in fallback mode", false, "no target under crosshair");
    }
    await saveScreenshot(fallbackPage, "07-fallback-mode.png");
  }
  await fallbackPage.close();

  // =====================================================================
  // 4. No WebGL at all -> CPU raycaster
  // =====================================================================
  // Simulates machines where WebGL is unavailable entirely — a real player
  // hit exactly this. The game must boot into the CPU raycaster and be
  // fully playable: render, move, break.
  const cpuPage = await openPage("cpu", pageUrl(404), undefined, () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(type, ...rest) {
      if (String(type).startsWith("webgl")) return null;
      return original.call(this, type, ...rest);
    };
  });
  await waitForWorld(cpuPage, 25, "loadedChunks");
  const cpuMode = await cpuPage.evaluate(() => window.__mc.renderer());
  report("no WebGL at all -> CPU raycaster engages", cpuMode === "cpu", `renderer=${cpuMode}`);

  if (cpuMode === "cpu") {
    await sleep(1500); // a few frames of rendering
    await cpuPage.evaluate(() => document.querySelector("#overlay")?.classList.add("hidden"));
    await sleep(800);
    await saveScreenshot(cpuPage, "08-cpu-renderer.png");
    const cpuVariety = await colorVariety(cpuPage);
    await cpuPage.evaluate(() => document.querySelector("#overlay")?.classList.remove("hidden"));
    report(
      "CPU render shows real variety (terrain, not a blank frame)",
      cpuVariety > 12,
      `${cpuVariety} distinct quantized colors sampled`,
    );

    await cpuPage.click("#play-button");
    await sleep(1000);
    const cpuDist = await walk(cpuPage);
    report("movement works on the CPU renderer", cpuDist > 1, `moved ${cpuDist.toFixed(1)} blocks`);

    await cpuPage.evaluate(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 2000 }));
    });
    await sleep(500);
    const cpuTarget = await cpuPage.evaluate(() => window.__mc.target());
    if (cpuTarget) {
      await cpuPage.mouse.down({ button: "left" });
      await cpuPage.mouse.up({ button: "left" });
      await sleep(500);
      const afterCpuBreak = await cpuPage.evaluate(
        (t) => window.__mc.blockAt(t.x, t.y, t.z),
        cpuTarget,
      );
      report(
        "breaking works on the CPU renderer",
        afterCpuBreak === 0,
        `block is now id ${afterCpuBreak}`,
      );
    } else {
      report("breaking works on the CPU renderer", false, "no target under crosshair");
    }
    await saveScreenshot(cpuPage, "09-cpu-playing.png");
  }
  await cpuPage.close();

  // =====================================================================
  // 5. Phone: touchscreen only
  // =====================================================================
  // Proves the game detects a touch device, shows on-screen controls, and
  // is fully playable with thumb + drag + tap — no keyboard, no mouse.
  const mobilePage = await openPage("mobile", `${BASE_URL}?seed=505&view=4&lang=en`, {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const touch = (type, x, y, id = 1) =>
    mobilePage.evaluate(
      (a) => {
        const target = document.elementFromPoint(a.x, a.y) ?? document.body;
        target.dispatchEvent(
          new PointerEvent(a.type, {
            pointerId: a.id,
            pointerType: "touch",
            clientX: a.x,
            clientY: a.y,
            bubbles: true,
            cancelable: true,
            isPrimary: true,
          }),
        );
      },
      { type, x, y, id },
    );
  /** A finger pressed on one of the on-screen buttons, found by class. */
  const press = (selector, type = "pointerdown") =>
    mobilePage.evaluate(
      (a) => {
        document.querySelector(a.selector)?.dispatchEvent(
          new PointerEvent(a.type, {
            pointerId: 9,
            pointerType: "touch",
            bubbles: true,
            cancelable: true,
            isPrimary: true,
          }),
        );
      },
      { selector, type },
    );

  await waitForWorld(mobilePage, 9);
  const phoneReadyMs = elapsedMs(mobilePage.bootStart);
  const phone = await mobilePage.evaluate(() => ({
    touch: window.__mc.touch(),
    quality: window.__mc.settings().quality,
    autoJump: window.__mc.settings().autoJump,
  }));
  report(
    "touch device is detected and gets phone-sized defaults",
    phone.touch === true && phone.quality !== "ultra" && phone.autoJump === true,
    JSON.stringify(phone),
  );
  await saveScreenshot(mobilePage, "10-mobile-menu.png");

  await mobilePage.click("#play-button");
  await mobilePage
    .waitForFunction(() => window.__mc.mode() !== "idle", { timeout: 5_000, polling: 100 })
    .catch(() => undefined);
  const active = await mobilePage.evaluate(() => window.__mc.mode());
  report("tapping play starts the game (drag mode) on touch", active === "drag", `mode=${active}`);
  await measureProfile(mobilePage, "phone", phoneReadyMs);

  await until(mobilePage, () => {
    const buttons = document.querySelector(".touch-buttons");
    return buttons !== null && getComputedStyle(buttons).display !== "none";
  });
  const controlsShown = await mobilePage.evaluate(() => {
    const shown = (selector) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).display !== "none" : false;
    };
    return {
      actions: shown(".touch-buttons"),
      top: shown(".touch-top"),
      jump: shown(".touch-jump"),
      place: shown(".touch-place"),
      pause: shown(".touch-pause"),
    };
  });
  report(
    "on-screen jump, place, inventory and pause buttons are shown",
    Object.values(controlsShown).every(Boolean),
    JSON.stringify(controlsShown),
  );

  // A fortress is an in-world activity: its panel must be reachable
  // without stealing the phone's right-side aiming and top ride controls.
  const siegeMobile = await mobilePage.evaluate(() => {
    const panel = document.querySelector("#siege-panel");
    const controls = document.querySelector(".touch-top");
    const build = [...(panel?.querySelectorAll("button") ?? [])].find((button) =>
      button.textContent?.includes("Build"),
    );
    if (!panel || !controls) return { visible: false, build: false, overlap: true };
    const a = panel.getBoundingClientRect();
    const b = controls.getBoundingClientRect();
    return {
      visible: !panel.hidden && a.width > 0 && a.height > 0,
      build: !!build && !build.hidden,
      overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
    };
  });
  report(
    "fortress is offered inside Creative without covering phone controls",
    siegeMobile.visible && siegeMobile.build && !siegeMobile.overlap,
    JSON.stringify(siegeMobile),
  );

  // Joystick: press bottom-left, push up (forward), hold, release.
  const beforeMove = await mobilePage.evaluate(() => window.__mc.position());
  await touch("pointerdown", 110, 560, 1);
  await touch("pointermove", 110, 500, 1);
  await touch("pointermove", 110, 485, 1);
  await until(
    mobilePage,
    (start) => {
      const p = window.__mc.position();
      return Math.hypot(p.x - start.x, p.z - start.z) > 1.5;
    },
    beforeMove,
  );
  await touch("pointerup", 110, 485, 1);
  const afterMove = await mobilePage.evaluate(() => window.__mc.position());
  const moved = Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z);
  report("the joystick moves the player", moved > 1, `moved ${moved.toFixed(1)} blocks`);

  // Look straight down with a long right-side drag (the pitch clamps), so
  // the crosshair lands on whatever the player is standing on, then tap.
  for (let step = 0; step < 9; step++) {
    await touch(step === 0 ? "pointerdown" : "pointermove", 300, 120 + step * 60, 2);
  }
  await touch("pointerup", 300, 600, 2);
  await until(mobilePage, () => window.__mc.target() !== null, undefined, 8_000);
  const mobileTarget = await mobilePage.evaluate(() => window.__mc.target());
  if (mobileTarget) {
    // A genuine quick tap: down and up in one round trip, so the in-page
    // elapsed time stays inside the tap window (separate evaluate calls can
    // drift past it and be correctly treated as a drag, not a tap).
    await mobilePage.evaluate(
      (a) => {
        const target = document.elementFromPoint(a.x, a.y) ?? document.body;
        const opts = {
          pointerType: "touch",
          pointerId: a.id,
          clientX: a.x,
          clientY: a.y,
          bubbles: true,
          cancelable: true,
          isPrimary: true,
        };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
      },
      { x: 300, y: 300, id: 3 },
    );
    await sleep(400);
    const afterTap = await mobilePage.evaluate(
      (t) => window.__mc.blockAt(t.x, t.y, t.z),
      mobileTarget,
    );
    report("tap breaks the targeted block on touch", afterTap === 0, `block is now id ${afterTap}`);
  } else {
    report("tap breaks the targeted block on touch", false, "no target under crosshair");
  }
  await saveScreenshot(mobilePage, "11-mobile-playing.png");

  await press(".touch-fly");
  await sleep(200);
  const mobileFlying = await mobilePage.evaluate(() => window.__mc.flying());
  report("the fly button toggles flight on touch", mobileFlying === true);

  await press(".touch-inventory");
  await sleep(300);
  const mobileInventory = await mobilePage.evaluate(() => window.__mc.inventoryOpen());
  report("the inventory button opens the block panel on touch", mobileInventory === true);
  await saveScreenshot(mobilePage, "12-mobile-inventory.png");
  await mobilePage.click('.inventory-cell[data-block="18"]'); // a lantern
  await sleep(300);

  await press(".touch-pause");
  await sleep(300);
  const mobilePaused = await mobilePage.evaluate(() => ({
    mode: window.__mc.mode(),
    hotbar: window.__mc.hotbar(),
  }));
  report(
    "the pause button returns to the menu on touch",
    mobilePaused.mode === "idle" && mobilePaused.hotbar.includes(18),
    `mode=${mobilePaused.mode}`,
  );
  await mobilePage.close();

  const dragonPhone = await openPage(
    "mobile dragon",
    pageUrl(2026, "mode=creative&quality=low&view=3"),
    { width: 390, height: 844, isMobile: true, hasTouch: true },
  );
  await waitForWorld(dragonPhone, 9);
  await dragonPhone.tap("#play-button");
  const catsVisible = await until(dragonPhone, () => {
    const position = window.__mc.position();
    return window.__mc
      .creatures()
      .some(
        (creature) =>
          creature.kind === "cat" &&
          creature.coat === 0 &&
          Math.hypot(creature.position.x - position.x, creature.position.z - position.z) < 9,
      );
  });
  report("the orange cat is near the player in Creative mode", catsVisible);
  const approach = await dragonPhone.touchscreen.touchStart(95, 445);
  await approach.move(95, 394);
  const rideVisible = await until(dragonPhone, () => {
    const button = document.querySelector(".touch-ride");
    return window.__mc.dragon().ready && button?.getBoundingClientRect().width > 0;
  });
  await approach.end();
  report("the dragon mount button is available on a phone", rideVisible);
  if (rideVisible) {
    await dragonPhone.tap(".touch-ride");
    const mounted = await until(dragonPhone, () => window.__mc.dragon().mounted);
    report("tapping the dragon button puts the player in the saddle", mounted);
    if (mounted) {
      const onGround = await dragonPhone.evaluate(() => window.__mc.dragon().position.y);
      const holdFlight = async (button) => {
        const rect = await (await dragonPhone.$(button)).boundingBox();
        return dragonPhone.touchscreen.touchStart(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
      };
      const ascend = await holdFlight(".touch-jump");
      const airborne = await until(
        dragonPhone,
        (ground) => {
          const dragon = window.__mc.dragon();
          return dragon.flying && dragon.position.y > ground + 2;
        },
        onGround,
      );
      await ascend.end();
      report("holding ascent takes the dragon into the air", airborne);
      if (airborne) {
        const descend = await holdFlight(".touch-descend");
        const landed = await until(
          dragonPhone,
          () => window.__mc.dragon().grounded && !window.__mc.dragon().flying,
        );
        await descend.end();
        report("holding descent lands the dragon", landed);
        if (landed) {
          await dragonPhone.tap(".touch-ride");
          report(
            "the rider can dismount after landing on a phone",
            await until(dragonPhone, () => !window.__mc.dragon().mounted),
          );
        }
      }
    }
  }
  await dragonPhone.browserContext().close();

  // =====================================================================
  // 6. Installed build: boots with the network gone
  // =====================================================================
  const tablet = await openPage("tablet", pageUrl(505, "view=4"), {
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await waitForWorld(tablet, 9);
  const tabletReadyMs = elapsedMs(tablet.bootStart);
  await tablet.tap("#play-button");
  const tabletReady = await until(tablet, () => window.__mc.mode() === "drag", undefined);
  report("tablet starts via a touchscreen tap", tabletReady);
  await measureProfile(tablet, "tablet", tabletReadyMs);
  await tablet.browserContext().close();

  const offlinePage = await openPage("offline", new URL("privacy.html", BASE_URL).href);
  await offlinePage.evaluate(async () => {
    await window.caches.open("other-app-regression-cache");
  });
  await offlinePage.goto(pageUrl(606), { waitUntil: "domcontentloaded" });
  await waitForWorld(offlinePage, 5);
  const controlled = await offlinePage
    .evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      await navigator.serviceWorker.ready;
      // The first load isn't controlled until the worker claims the page.
      for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return navigator.serviceWorker.controller !== null;
    })
    .catch(() => false);
  report("the service worker installs and takes control", controlled === true);
  if (controlled) {
    const unrelatedCache = await offlinePage.evaluate(() =>
      window.caches.has("other-app-regression-cache"),
    );
    report("the service worker preserves unrelated origin caches", unrelatedCache);
    await offlinePage.setOfflineMode(true);
    await offlinePage.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    const offlineOk = await waitForWorld(offlinePage, 5)
      .then(() => true)
      .catch(() => false);
    report("the game boots and builds the world with no network", offlineOk);
    await offlinePage.setOfflineMode(false);
  }
  await offlinePage.close();

  // =====================================================================
  // 7. Adventure mode: dig for blocks, craft, keep a journal
  // =====================================================================
  const adventure = await openPage("adventure", `${pageUrl(707)}&mode=adventure`);
  await waitForWorld(adventure, 25);
  await adventure.click("#play-button");
  await sleep(800);
  const startMode = await adventure.evaluate(() => ({
    mode: window.__mc.gameMode(),
    bag: window.__mc.bag(),
    counts: document.querySelectorAll(".hotbar-count").length,
  }));
  report(
    "Adventure starts with an empty bag and counted hotbar slots",
    startMode.mode === "adventure" &&
      Object.keys(startMode.bag).length === 0 &&
      startMode.counts === 9,
    JSON.stringify(startMode),
  );

  await adventure.evaluate(() => window.__mc.setLook(0, -Math.PI / 2));
  report(
    "Adventure explains the held mouse button when aiming at a block",
    await until(adventure, () => {
      const hint = document.querySelector("#dig-hint");
      return !hint?.hidden && hint?.textContent === "Hold left click to dig";
    }),
  );

  // Headless pointer lock can recenter the synthetic mouse. Hold the button
  // from inside the page so a CDP mouse move cannot shift this exact target.
  const ground = await adventure.evaluate(() => {
    const canvas = document.pointerLockElement;
    if (!canvas) return null;
    window.__mc.setLook(0, -Math.PI / 2);
    const target = window.__mc.target();
    if (!target) return null;
    const { x, y, z } = target;
    const id = window.__mc.blockAt(x, y, z);
    canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true }));
    return { ...target, id, partWay: window.__mc.blockAt(x, y, z) };
  });
  const progressSeen = await until(adventure, () => {
    const bar = document.querySelector("#dig-progress");
    return !bar?.hidden && bar?.value > 0 && bar.value < 1;
  });
  const dug =
    ground !== null &&
    (await until(adventure, (g) => window.__mc.blockAt(g.x, g.y, g.z) === 0, ground));
  await adventure.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
  });
  const afterDig = await adventure.evaluate(() => window.__mc.bag());
  const gathered = Object.values(afterDig).reduce((a, b) => a + b, 0);
  report(
    "a visible progress bar advances while digging and hides on release",
    progressSeen &&
      (await until(adventure, () => document.querySelector("#dig-progress")?.hidden === true)),
  );
  report(
    "holding the button digs through the ground, and the blocks land in the bag",
    ground !== null &&
      !NOT_GROUND.includes(ground.id) &&
      ground.partWay === ground.id &&
      dug &&
      gathered >= 1,
    `target ${JSON.stringify(ground)}, dug=${dug}, bag ${JSON.stringify(afterDig)}`,
  );

  // Flight is a Creative thing.
  const tookFlight = await doubleTapJump(adventure);
  report("double-tapping jump does not take off in Adventure", tookFlight === false);

  const ore = await adventure.evaluate(() => {
    window.__mc.setLook(0, -Math.PI / 2);
    const target = window.__mc.target();
    if (target) window.__mc.setBlock(target.x, target.y, target.z, 20);
    return target;
  });
  const needsPick = await until(adventure, () =>
    document.querySelector("#dig-hint")?.textContent?.includes("Craft a shard pick"),
  );
  await adventure.evaluate(() => {
    document.pointerLockElement?.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true }),
    );
  });
  await sleep(2000);
  const oreStillIntact = await adventure.evaluate((target) => {
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
    return target !== null && window.__mc.blockAt(target.x, target.y, target.z) === 20;
  }, ore);
  report("gold stays intact without a pick and the game explains why", needsPick && oreStillIntact);

  // Crafting: two logs in the bag, one becomes four planks.
  const aimingPitch = await adventure.evaluate(() => window.__mc.pitch());
  await adventure.evaluate(() => window.__mc.give(6, 2));
  await adventure.keyboard.press("KeyE");
  await sleep(400);
  await adventure.click('.tab[data-tab="craft"]');
  await sleep(200);
  await saveScreenshot(adventure, "13-crafting.png");
  const disabledBefore = await adventure.evaluate(
    () => document.querySelector('.recipe[data-recipe="lantern"]')?.disabled ?? null,
  );
  await adventure.click('.recipe[data-recipe="planks-oak"]');
  await sleep(300);
  const afterCraft = await adventure.evaluate(() => window.__mc.bag());
  report(
    "a recipe turns one log into four planks, and unaffordable recipes are disabled",
    afterCraft["6"] === 1 && afterCraft["14"] === 4 && disabledBefore === true,
    JSON.stringify(afterCraft),
  );

  await adventure.evaluate(() => window.__mc.give(15, 2));
  await adventure.click('.recipe[data-recipe="mining-pick"]');
  const tool = await adventure.evaluate(() => ({
    bag: window.__mc.bag(),
    disabled: document.querySelector('.recipe[data-recipe="mining-pick"]')?.disabled,
  }));
  report(
    "the pick recipe uses two planks and two stones and equips one pick",
    tool.bag["mining-pick"] === 1 &&
      tool.bag["14"] === 2 &&
      tool.bag["15"] === undefined &&
      tool.disabled === true,
    JSON.stringify(tool),
  );

  await adventure.click('.tab[data-tab="journal"]');
  await sleep(200);
  await saveScreenshot(adventure, "14-journal.png");
  const found = await adventure.evaluate(() => ({
    list: window.__mc.discoveries(),
    shown: document.querySelectorAll(".journal-entry.found").length,
  }));
  const inventoryPitch = await adventure.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mousemove", { movementY: 120, bubbles: true }));
    return window.__mc.pitch();
  });
  report("moving the mouse in the inventory keeps the mining aim", inventoryPitch === aimingPitch);
  report(
    "the journal records the first dig and the first craft",
    found.list.includes("first-dig") && found.list.includes("craft") && found.shown >= 2,
    JSON.stringify(found.list),
  );

  await adventure.keyboard.press("KeyE");
  await sleep(300);
  const relocked = await until(adventure, () => document.pointerLockElement !== null);
  await adventure.evaluate(() => {
    document.pointerLockElement?.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, buttons: 1, bubbles: true }),
    );
  });
  const minedGold = relocked && (await until(adventure, () => window.__mc.bag()["20"] === 1));
  await adventure.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
  });
  report("the equipped pick lets the player mine and collect the gold", minedGold);

  await adventure.evaluate(() => document.exitPointerLock());
  await sleep(400);
  await adventure.reload({ waitUntil: "domcontentloaded" });
  await waitForWorld(adventure, 9);
  const kept = await adventure.evaluate(() => ({
    bag: window.__mc.bag(),
    found: window.__mc.discoveries().length,
  }));
  report(
    "the bag, equipped pick, and journal survive a reload",
    kept.bag["14"] === 2 &&
      kept.bag["mining-pick"] === 1 &&
      kept.bag["20"] === 1 &&
      kept.found >= 2,
    JSON.stringify(kept),
  );
  await adventure.close();

  // A real in-world fortress smoke test: place it through the same button
  // as a player, verify the crystal voxel, reload, then launch the first wave.
  // Distinct from tests of the menu or the pure siege state machine.
  const fortressPage = await openPage(
    "fortress",
    `${BASE_URL}?seed=2026&quality=low&view=3&lang=en`,
  );
  await waitForWorld(fortressPage, 9);
  await fortressPage.click("#play-button");
  await until(fortressPage, () => document.querySelector("#siege-panel")?.hidden === false);
  await fortressPage.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("#siege-panel button")?.click();
  });
  const created = await until(
    fortressPage,
    () =>
      window.__mc.siege() !== null &&
      window.localStorage.getItem("voxel-world:fortress:v1:2026") !== null,
    undefined,
    30000,
  );
  report("fortress can be built from Creative within the existing world", created);
  if (created) {
    const crystalReady = await until(
      fortressPage,
      () => {
        const raw = window.localStorage.getItem("voxel-world:fortress:v1:2026");
        if (!raw) return false;
        const site = JSON.parse(raw);
        return window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 47) === 21;
      },
      undefined,
      60000,
    );
    report("the generated fortress has a physical central crystal block", crystalReady);
    await fortressPage.reload({ waitUntil: "domcontentloaded" });
    await waitForWorld(fortressPage, 9);
    const persisted = await until(
      fortressPage,
      () => {
        const raw = window.localStorage.getItem("voxel-world:fortress:v1:2026");
        if (!raw || window.__mc.siege() === null) return false;
        const site = JSON.parse(raw);
        return window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 47) === 21;
      },
      undefined,
      60000,
    );
    report("the fortress survives a reload in the same free world", persisted);
    await fortressPage.click("#play-button");
    await until(fortressPage, () => window.__mc.mode() !== "idle", undefined, 10000);
    // Desktop uses pointer lock for camera steering. Press M to free the
    // cursor before interacting with the siege panel.
    await fortressPage.keyboard.press("KeyM");
    const pointerUnlocked = await until(
      fortressPage,
      () => document.pointerLockElement === null && window.__mc.mode() !== "idle",
      undefined,
      10000,
    );
    const canStart = await until(
      fortressPage,
      () =>
        window.__mc.mode() !== "idle" &&
        document.querySelector("#siege-panel button:nth-of-type(3)")?.hidden === false,
      undefined,
      10000,
    );
    if (pointerUnlocked && canStart) await fortressPage.click("#siege-panel button:nth-of-type(3)");
    const siegeStarted = await until(
      fortressPage,
      () => window.__mc.siege()?.phase === "preparation",
      undefined,
      6000,
    );
    const siegeDebug = await fortressPage.evaluate(() => {
      const raw = window.localStorage.getItem("voxel-world:fortress:v1:2026");
      const site = raw ? JSON.parse(raw) : null;
      const position = window.__mc.position();
      const start = document.querySelector("#siege-panel button:nth-of-type(3)");
      return {
        mode: window.__mc.mode(),
        phase: window.__mc.siege()?.phase,
        distance: site ? Math.hypot(position.x - (site.x + 47), position.z - (site.z + 47)) : null,
        startHidden: start?.hidden,
        pointerUnlocked: document.pointerLockElement === null,
        panelHidden: document.querySelector("#siege-panel")?.hidden,
      };
    });
    report(
      "players launch zombie waves from inside their free world",
      siegeStarted,
      JSON.stringify(siegeDebug),
    );
    if (siegeStarted) {
      const closedSiegeGates = await until(
        fortressPage,
        () => {
          const raw = window.localStorage.getItem("voxel-world:fortress:v1:2026");
          if (!raw) return false;
          const site = JSON.parse(raw);
          return (
            window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 2) === 14 &&
            window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 15) === 14 &&
            window.__mc.siege()?.front === "south"
          );
        },
        undefined,
        10000,
      );
      report("south gatehouse and inner door are solid only during the siege", closedSiegeGates);
      await fortressPage.click('#siege-panel button[aria-controls="siege-armory"]');
      const shopVisible = await until(
        fortressPage,
        () =>
          document.querySelector("#siege-armory")?.hidden === false &&
          document.querySelectorAll("#siege-armory [data-offer]").length === 5 &&
          window.__mc.siege()?.armory.coins === 100,
      );
      report("fortress armory is available during preparation with starting coins", shopVisible);
      if (shopVisible) {
        await fortressPage.click('#siege-armory [data-offer="sword"]');
        const purchased = await until(
          fortressPage,
          () =>
            window.__mc.siege()?.armory.swordTier === 1 && window.__mc.siege()?.armory.coins === 0,
        );
        report("buying a siege sword spends coins and increases its rank", purchased);
      }
      await fortressPage.keyboard.press("KeyX");
      const stopped = await until(fortressPage, () => window.__mc.siege()?.phase === "idle");
      const restoredGate = await until(
        fortressPage,
        () => {
          const raw = window.localStorage.getItem("voxel-world:fortress:v1:2026");
          if (!raw) return false;
          const site = JSON.parse(raw);
          return (
            window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 2) === 0 &&
            window.__mc.blockAt(site.x + 47, site.y + 3, site.z + 15) === 0
          );
        },
      );
      report("stopping the siege restores both doors without permanent damage", restoredGate);
      await fortressPage.keyboard.press("KeyN");
      const restarted = await until(
        fortressPage,
        () => window.__mc.siege()?.phase === "preparation",
      );
      report("keyboard controls can stop and restart the fortress waves", stopped && restarted);
      const freshShop = await fortressPage.evaluate(() => {
        const report = window.__mc.siege();
        return report?.armory.coins === 100 && report?.armory.swordTier === 0;
      });
      report("a new siege run resets only temporary shop purchases", freshShop);
    }
  }
  await fortressPage.browserContext().close();

  // Boot the real production build with local storage denied by the browser.
  // Only the test build should expose the debug API used above.
  const production = await openPage(
    "production",
    `${PRODUCTION_URL}?seed=606&quality=low&view=4`,
    { width: 800, height: 600, hasTouch: true, isMobile: true },
    () => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("Storage blocked by test");
        },
      });
    },
  );
  await production.tap("#play-button");
  const productionStarted = await until(
    production,
    () => document.querySelector("#overlay")?.classList.contains("hidden") === true,
    undefined,
    10000,
  );
  const hasDebug = await production.evaluate(() => "__mc" in window);
  report("production is playable with local storage denied", productionStarted);
  report("production does not expose the debug API", !hasDebug);
  await production.browserContext().close();

  report(
    "no external HTTP(S) requests observed by the game pages",
    externalRequests.size === 0,
    `${localRequests.size} distinct local paths/methods; external=${[...externalRequests].join(",") || "none"}`,
  );
  // ---- console stayed clean ----
  const realErrors = consoleErrors.filter((e) => !e.includes("favicon"));
  report("no console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await browser.close();
}
