import { useCallback, useState } from "react";

/** "OA" for Opor Ayam: the first letter of the first two words. */
export function initialsOf(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("id-ID"))
    .join("");
}

/**
 * A photograph that never breaks the page. The box around it owns the
 * dimensions, so a missing or unreachable file swaps to a quiet tile with the
 * dish's initials, without a broken-image icon and without moving anything.
 * No emoji and no dark green: a recipe without a photo should not look like a
 * different kind of thing (design plan task 8).
 */
export function RecipePhoto({
  src,
  glyph: _glyph,
  alt = "",
  title,
  glyphClass: _glyphClass,
}: {
  src: string | undefined;
  /** Kept for callers; no longer drawn. */
  glyph?: string;
  alt?: string;
  /** The dish name for the initials when there is no photo. Falls back to `alt`. */
  title?: string;
  /** Kept for callers; no longer used. */
  glyphClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  // A photo that already failed during server-rendered markup never fires
  // onError again, so the finished-but-empty case is checked on mount too.
  const check = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  if (!src || failed) {
    const name = title ?? alt;
    return (
      <span className="flex h-full w-full items-center justify-center bg-tint text-head font-bold text-ink-2" aria-hidden>
        {name ? initialsOf(name) : null}
      </span>
    );
  }
  return (
    <img
      ref={check}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={1024}
      height={704}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}
