// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const BUILD_ID = String(Date.now());

// The offline shell has dropped out of the build twice without anyone noticing.
// This makes that a hard build failure instead of a silent loss of offline mode.
const SHELL_FILE = "index.html";
const checkOfflineShell = () => {
  const clientDir = resolve(process.cwd(), "dist/client");
  const swPath = resolve(clientDir, "sw.js");
  const shellPath = resolve(clientDir, SHELL_FILE);
  if (!existsSync(swPath)) return "dist/client/sw.js was not emitted";
  if (!existsSync(shellPath)) return `dist/client/${SHELL_FILE} was not emitted`;
  if (statSync(shellPath).size < 512)
    return `dist/client/${SHELL_FILE} is too small to be a real document`;
  const sw = readFileSync(swPath, "utf8");
  const entry = new RegExp(
    `["'\`]?url["'\`]?\\s*:\\s*["'\`]/?${SHELL_FILE.replace(".", "\\.")}["'\`]`,
  );
  if (!entry.test(sw))
    return `/${SHELL_FILE} is missing from the service worker precache manifest`;
  return null;
};

const assertOfflineShell = () => {
  let armed = false;
  return {
    name: "racik-assert-offline-shell",
    apply: "build" as const,
    enforce: "post" as const,
    // The shell document is written by the prerender step, which runs after the
    // client bundle closes, so the check has to happen when the build process
    // is finished. A failure here sets a non-zero exit code: the build fails.
    closeBundle() {
      if (armed) return;
      armed = true;
      process.on("exit", (code) => {
        if (code !== 0) return;
        const why = checkOfflineShell();
        if (!why) {
          console.log(`[racik] offline shell OK: /${SHELL_FILE} is precached`);
          return;
        }
        console.error(
          `\n[racik] offline shell assertion failed: ${why}.\n` +
            `The app would ship without offline support, so this build is rejected.\n`,
        );
        process.exitCode = 1;
      });
    },
  };
};


export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // The deployed public directory is dist/client; a worker emitted to dist/
      // would never be served, and the app would silently lose offline support.
      outDir: "dist/client",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        // The server renders each online URL. This shell only answers when a
        // navigation cannot reach the server within the short timeout below.
        // The prerendered shell is written after this plugin globs the output
        // directory, so it is added to the precache list by hand.
        additionalManifestEntries: [{ url: "/index.html", revision: BUILD_ID }],
        // Navigations go through the NetworkFirst route below, which already
        // falls back to the precached shell, so no blanket fallback route here.
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && url.origin === self.location.origin,
            handler: "NetworkFirst",
            options: {
              cacheName: "racik-pages",
              networkTimeoutSeconds: 1.5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
              precacheFallback: { fallbackURL: "/index.html" },
            },
          },
          {
            // Photographs live on the CDN under this path. First view stores them,
            // every later view reads the cache, so a kitchen with no signal still
            // shows the picture it has already seen.
            urlPattern: ({ url }) => url.pathname.startsWith("/__l5e/assets-v1/"),
            handler: "CacheFirst",
            options: {
              cacheName: "racik-photos",
              expiration: { maxEntries: 220, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              ["script", "style", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "racik-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    assertOfflineShell(),
  ],
  tanstackStart: {
    // Keep normal SSR for link previews, and additionally prerender one route-
    // agnostic shell that Workbox can serve when a navigation is offline.
    pages: [{ path: "/", prerender: { enabled: true, crawlLinks: false } }],
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
