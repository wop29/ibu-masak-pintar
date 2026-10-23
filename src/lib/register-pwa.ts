const SW_PATH = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterRacikWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => new URL(registration.active?.scriptURL ?? SW_PATH, location.origin).pathname === SW_PATH)
      .map((registration) => registration.unregister()),
  );
}

/**
 * A new service worker is installed and waiting. Racik does not swap the code
 * under her silently (a reload mid-import loses the result, mid-cook it jumps
 * the screen); it asks, through UpdatePrompt in __root.tsx.
 */
export const UPDATE_EVENT = "racik:update-ready";

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let updateWaiting = false;

export function isUpdateWaiting() {
  return updateWaiting;
}

/** Activates the waiting worker and reloads onto the new version. */
export async function reloadToUpdate() {
  if (applyUpdate) await applyUpdate(true);
  else window.location.reload();
}

/**
 * After a deploy the old hashed chunks are gone from the server. A page still
 * running the old code fails to load a lazy route chunk; reload once onto the
 * new version instead of showing a broken screen. Guarded so a real outage
 * cannot cause a reload loop.
 */
function reloadOnStaleChunks() {
  window.addEventListener("vite:preloadError", (event) => {
    const KEY = "racik.preloadReload";
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {
      /* storage blocked */
    }
    if (Date.now() - last < 30_000) return;
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
    event.preventDefault();
    window.location.reload();
  });
}

export async function registerRacikPwa() {
  reloadOnStaleChunks();
  if (!("serviceWorker" in navigator)) return;

  const shouldRefuse =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(location.hostname) ||
    new URLSearchParams(location.search).get("sw") === "off";

  if (shouldRefuse) {
    await unregisterRacikWorkers();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateWaiting = true;
      window.dispatchEvent(new Event(UPDATE_EVENT));
    },
    onRegisteredSW(_url, registration) {
      // A phone left open for days still learns about a deploy.
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });
}
