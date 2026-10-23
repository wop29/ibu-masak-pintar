import rendang from "@/assets/resep/rendang_daging.jpg";
import gado from "@/assets/resep/gado_gado.jpg";
import mendoan from "@/assets/resep/tempe_mendoan.jpg";
import woku from "@/assets/resep/ayam_woku.jpg";
import ayamLengkuas from "@/assets/resep/ayam_goreng_lengkuas.jpg";
import bolu from "@/assets/resep/bolu_kukus_pandan.jpg";

/**
 * Every photograph in src/assets/resep/*.webp, keyed by recipe id.
 *
 * The filename IS the recipe id — `rendang.webp` serves `rendang`. Adding a
 * photograph means dropping a correctly named file into that folder; nothing
 * else in the codebase has to be touched.
 *
 * These used to be CDN paths under /__l5e/assets-v1/ read from a JSON file.
 * That path is served by Lovable's infrastructure only, so every photograph
 * would have 404'd the moment the app moved to another host. They are now
 * part of the build: whatever serves the app serves the photographs.
 */
const BUNDLED = import.meta.glob<string>("../../assets/resep/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(BUNDLED)) {
  const id = path.slice(path.lastIndexOf("/") + 1, -".webp".length);
  byId[id] = url;
}

/**
 * 400px thumbnails (scripts/make-thumbs.py), ~16 KB instead of ~110 KB. Use
 * for tiles and list rows; the hero on the recipe page keeps the full photo.
 */
const THUMBS = import.meta.glob<string>("../../assets/resep/thumb/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const thumbById: Record<string, string> = {};
for (const [path, url] of Object.entries(THUMBS)) {
  thumbById[path.slice(path.lastIndexOf("/") + 1, -".webp".length)] = url;
}

/** Small photo for a list row or tile; falls back to the full photo if no thumbnail was generated. */
export const thumbOf = (id: string): string | undefined => thumbById[id] ?? byId[id];

/** Bundled artwork used by the interface itself, not tied to one recipe. */
export const ART = { rendang, mendoan, gado, woku, bolu, ayamLengkuas } as const;

/** Every photograph for one recipe, hero first. */
export const photosOf = (id: string): string[] => {
  const photo = byId[id];
  return photo ? [photo] : [];
};

/**
 * Absolute image URL for external link preview crawlers. The origin is the one
 * serving this request, so previews keep working on any domain.
 */
export const previewPhotoOf = (id: string, origin: string): string | undefined => {
  const photo = byId[id];
  if (!photo || !origin) return undefined;
  return new URL(photo, origin).href;
};

/** Photographs are the primary visual material. Everything else falls back to a warm ground. */
export const PHOTO: Record<string, string> = byId;
