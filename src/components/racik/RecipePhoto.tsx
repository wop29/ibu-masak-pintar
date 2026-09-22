import { useCallback, useState } from "react";

/**
 * A photograph that never breaks the page. The box around it owns the
 * dimensions, so a missing or unreachable file swaps to the ingredient glyph
 * without a broken-image icon and without moving anything.
 */
export function RecipePhoto({
  src,
  glyph,
  alt = "",
  glyphClass = "text-[44px]",
}: {
  src: string | undefined;
  glyph: string;
  alt?: string;
  glyphClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  // A photo that already failed during server-rendered markup never fires
  // onError again, so the finished-but-empty case is checked on mount too.
  const check = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  if (!src || failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center bg-primary-deep ${glyphClass}`}
        aria-hidden
      >
        {glyph}
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
