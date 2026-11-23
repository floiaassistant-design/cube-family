import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Every file under `dir`, as paths relative to it. */
function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

/** Cache this build's files only, independently of other apps on the same origin. */
function offlineServiceWorker(): Plugin {
  return {
    name: "offline-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const hash = createHash("sha256");
      const files = new Set<string>();
      const publicDir = path.resolve(import.meta.dirname, "public");
      for (const name of listFiles(publicDir).sort()) {
        files.add(name);
        hash.update(name).update(readFileSync(path.join(publicDir, name)));
      }
      for (const name of Object.keys(bundle).sort()) {
        const asset = bundle[name];
        if (name.endsWith(".map")) continue;
        files.add(name);
        hash.update(name).update(asset.type === "chunk" ? asset.code : asset.source);
      }
      const version = hash.digest("hex").slice(0, 16);
      const source = `// Generated at build time — see vite.config.ts.
const ROOT = self.registration.scope;
const INDEX = new URL("index.html", ROOT).href;
const PREFIX = "cube-family-pwa:" + ROOT + ":";
const LEGACY_PREFIX = "minecraft-family-pwa:" + ROOT + ":";
const CACHE = PREFIX + "${version}";
const FILES = new Set(${JSON.stringify(["./", ...files])}.map((file) => new URL(file, ROOT).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([...FILES])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => (key.startsWith(PREFIX) && key !== CACHE) || key.startsWith(LEGACY_PREFIX)).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    url.search = "";
    if (url.href !== ROOT && url.href !== INDEX) return;
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(ROOT)) ?? Response.error();
    }));
    return;
  }
  if (!FILES.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(request)) ?? fetch(request)));
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: process.env.GITHUB_PAGES ? "/minecraft-family/" : mode === "native" ? "./" : "/",
  plugins: mode === "native" ? [] : [offlineServiceWorker()],
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
