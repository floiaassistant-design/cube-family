/**
 * Lightweight touch-display checks reused by the browser end-to-end run.
 * These emulate CSS viewports and touch input in Chromium; they do not
 * certify real iOS, Android, tablet GPUs, frame rate or native wrappers.
 */
const TOUCH_VIEWPORTS = [
  { name: "phone portrait", width: 390, height: 844, scale: 2 },
  { name: "phone landscape", width: 844, height: 390, scale: 2 },
  { name: "tablet portrait", width: 768, height: 1024, scale: 2 },
  { name: "tablet landscape", width: 1024, height: 768, scale: 2 },
];

async function measureMenu(page, selector) {
  return page.evaluate((screenSelector) => {
    const screen = document.querySelector(screenSelector);
    if (!screen || screen.hidden) {
      return { fits: false, controlsFit: false, verticallyReachable: false };
    }
    const horizontalBounds = (element) => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.left >= -2 && r.right <= window.innerWidth + 2;
    };
    const controls = [...screen.querySelectorAll("button, input, select")].filter(
      (element) => element.getClientRects().length > 0,
    );
    const overlay = document.querySelector("#overlay");
    const screenScroll = getComputedStyle(screen).overflowY;
    const overlayScroll = overlay && getComputedStyle(overlay).overflowY;
    const verticallyReachable =
      screen.scrollHeight <= screen.clientHeight + 2 ||
      screenScroll === "auto" ||
      screenScroll === "scroll" ||
      overlayScroll === "auto" ||
      overlayScroll === "scroll";
    return {
      fits:
        horizontalBounds(screen) &&
        screen.scrollWidth <= screen.clientWidth + 2 &&
        document.documentElement.scrollWidth <= window.innerWidth + 2,
      controlsFit: controls.every(horizontalBounds),
      verticallyReachable,
    };
  }, selector);
}

async function measureTouchHud(page) {
  return page.evaluate(() => {
    const fits = (selector) => {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === "none") return false;
      const box = element.getBoundingClientRect();
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.left >= -2 &&
        box.top >= -2 &&
        box.right <= window.innerWidth + 2 &&
        box.bottom <= window.innerHeight + 2
      );
    };
    return {
      hotbar: fits("#hotbar"),
      actions: fits(".touch-buttons"),
      pauseAndBag: fits(".touch-top"),
    };
  });
}

/** Runs on the same phone browser context as the gameplay touch test. */
export async function auditTouchViewports(page, report, until) {
  for (const device of TOUCH_VIEWPORTS) {
    await page.setViewport({
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.scale,
      hasTouch: true,
      isMobile: true,
    });

    await page.click("#world-button");
    const worlds = await measureMenu(page, '.menu-screen[data-screen="world"]');
    report(
      `responsive ${device.name}: worlds, import and buttons fit without horizontal clipping`,
      worlds.fits && worlds.controlsFit && worlds.verticallyReachable,
      JSON.stringify(worlds),
    );
    await page.click('.menu-screen[data-screen="world"] > .btn:last-child');

    await page.click("#settings-button");
    const settings = await measureMenu(page, '.menu-screen[data-screen="settings"]');
    report(
      `responsive ${device.name}: settings controls and back navigation remain reachable`,
      settings.fits && settings.controlsFit && settings.verticallyReachable,
      JSON.stringify(settings),
    );
    await page.click('.menu-screen[data-screen="settings"] > .btn:last-child');

    await page.click("#play-button");
    const active = await until(page, () => window.__mc?.mode() === "drag", undefined, 10_000);
    const hud = await measureTouchHud(page);
    report(
      `responsive ${device.name}: play, hotbar, touch actions and pause fit the viewport`,
      active && Object.values(hud).every(Boolean),
      JSON.stringify(hud),
    );
    await page.evaluate(() => {
      const pause = document.querySelector(".touch-pause");
      if (!pause) return;
      const properties = {
        pointerId: 71,
        pointerType: "touch",
        bubbles: true,
        cancelable: true,
      };
      pause.dispatchEvent(new PointerEvent("pointerdown", properties));
      pause.dispatchEvent(new PointerEvent("pointerup", properties));
    });
    const paused = await until(page, () => window.__mc?.mode() === "idle", undefined, 10_000);
    report(`responsive ${device.name}: touch pause returns to the menu`, paused);
    if (!paused) break;
  }
}
