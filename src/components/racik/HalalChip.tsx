import { useState } from "react";
import { ING } from "@/lib/racik/data";
import { analyseHalal, HALAL_FOOTNOTE, HALAL_ROWS } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";

/**
 * Only risk states get a coloured label. A recipe whose ingredients are all
 * plain gets nothing — no green tick, because Racik cannot certify a kitchen.
 * On the recipe page (not in lists), a recipe with meat or poultry gets a
 * quiet grey "cek sembelihan" note: the ingredient is halal, the slaughter
 * is something no list can show. The label opens a sheet naming the
 * ingredients behind it.
 */
export function HalalChip({ recipe, static: isStatic = false }: { recipe: Recipe; static?: boolean }) {
  const [open, setOpen] = useState(false);
  const { status, certIds, haramIds, meatIds } = analyseHalal(recipe);
  const meatOnly = status === "halal" && meatIds.length > 0;
  if (status === "halal" && (isStatic || !meatOnly)) return null;
  const haram = status === "haram";
  const name = (id: string) => ING[id]?.name ?? id;
  const cls = `inline-flex min-h-[26px] items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-extrabold uppercase tracking-[0.05em] ${
    haram
      ? "border-danger-line bg-danger-soft text-danger-ink"
      : meatOnly
        ? "border-rule bg-tint text-ink-2"
        : "border-notice-line bg-notice text-notice-ink"
  }`;
  const text = haram ? "Mengandung nonhalal" : meatOnly ? "Cek sembelihan" : "Perlu cek bahan";

  if (isStatic) return <span className={cls}>{text}</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${cls} relative after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']`}>
        {text} <span aria-hidden>ⓘ</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Soal halal">
        <ul className="mb-4">
          {HALAL_ROWS(status, certIds.map(name), haramIds.map(name), meatIds.map(name)).map((row) => (
            <li key={row} className="hairline-b py-3 text-body">
              {row}
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-3">{HALAL_FOOTNOTE}</p>
      </Sheet>
    </>
  );
}
