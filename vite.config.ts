// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

const BUILD_ID = String(Date.now());


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
