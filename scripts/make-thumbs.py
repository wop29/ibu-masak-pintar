#!/usr/bin/env python3
"""Small list/tile thumbnails for every recipe photo.

Eksplor tiles are 132x108 CSS px and list rows 76x76, but they loaded the
1200px hero (~110 KB each, ~2 MB for one scroll of Eksplor). This writes
src/assets/resep/thumb/<id>.webp at 400px wide (enough for a 3x screen),
which photos.ts serves through thumbOf().

Run after adding or replacing a photo:  python3 scripts/make-thumbs.py
Only rewrites a thumbnail whose source is newer. Needs Pillow with WebP.
"""
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "resep"
OUT = SRC / "thumb"
WIDTH = 400
QUALITY = 68


def main() -> int:
    OUT.mkdir(exist_ok=True)
    made = skipped = 0
    total = 0
    for src in sorted(SRC.glob("*.webp")):
        dst = OUT / src.name
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            total += dst.stat().st_size
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            if im.width > WIDTH:
                im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=QUALITY, method=6)
        made += 1
        total += dst.stat().st_size
    # Thumbnails whose photo was deleted.
    for dst in OUT.glob("*.webp"):
        if not (SRC / dst.name).exists():
            os.remove(dst)
    count = made + skipped
    print(f"thumbs: {made} written, {skipped} up to date, avg {total // max(count, 1) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
