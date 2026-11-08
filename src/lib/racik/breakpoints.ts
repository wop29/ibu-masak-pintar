import { useSyncExternalStore } from "react";

/**
 * Screen widths for the desktop and iPad pass (Engineer Brief, 30 Okt 2026).
 * The same numbers live in styles.css as Tailwind breakpoints, so classes read
 * `tab:` (iPad, 768 px and up) and `desk:` (desktop, 1180 px and up). Phone is
 * everything below 768 px and must look exactly as before.
 */
export const TAB_MIN_PX = 768;
export const DESK_MIN_PX = 1180;
/** Content column on wide screens. */
export const PAGE_MAX_PX = 1280;

/**
 * Importing from a video link is a phone and iPad job (Octavia, 30 Okt 2026):
 * a laptop with a mouse is asked to use the app instead. Decided by the kind
 * of pointer, not the browser's name, so an iPad in landscape (wide, but
 * touch) still imports.
 */
export const DESKTOP_POINTER_QUERY = `(min-width: ${DESK_MIN_PX}px) and (pointer: fine)`;

export function isDesktopPointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DESKTOP_POINTER_QUERY).matches;
}

/** True on a laptop or desktop with a mouse; false on phones, iPads and during server render. */
export function useDesktopPointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(DESKTOP_POINTER_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    isDesktopPointer,
    () => false,
  );
}
