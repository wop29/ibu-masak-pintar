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

export async function registerRacikPwa() {
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
  registerSW({ immediate: true });
}