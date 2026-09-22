// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

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
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg}"],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "racik-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
    // A prerendered, route-agnostic shell. When the phone has no signal and the
    // requested page was never visited, the worker serves this shell and the app
    // renders the recipe from the dataset already on the device.
    spa: { enabled: true, prerender: { enabled: true, outputPath: "/_shell", crawlLinks: true } },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
