/**
 * Brand icon tiles sliced from Octavia's icon sheet (26 Okt 2026): a rounded
 * mint/cream tile with a deep-green glyph. Decorative, so always aria-hidden;
 * put the meaning in text next to the tile, never in the tile alone.
 *
 * The filename IS the name — src/assets/brand/icons/import-link.png is
 * <BrandIcon name="import-link" />. Drop a new PNG in that folder to add one.
 */
const TILES = import.meta.glob<string>("../../assets/brand/icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});
const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(TILES)) {
  byName[path.slice(path.lastIndexOf("/") + 1, -".png".length)] = url;
}

export const hasBrandIcon = (name: string): boolean => name in byName;

export function BrandIcon({ name, className = "size-10" }: { name: string; className?: string }) {
  const src = byName[name];
  if (!src) return null;
  return <img src={src} alt="" aria-hidden className={`${className} shrink-0 rounded-xl object-contain`} />;
}
