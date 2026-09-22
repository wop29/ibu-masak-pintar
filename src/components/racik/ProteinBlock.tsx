import { useState } from "react";
import { ING } from "@/lib/racik/data";
import { fmtProtein, proteinParts, proteinPerPortion } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";

/** No macro charts, no scores. One number, one bar, and the word "perkiraan". */
export function ProteinBlock({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const grams = proteinPerPortion(recipe);
  const text = fmtProtein(grams);
  if (!text) return null;

  const parts = proteinParts(recipe)
    .filter((p) => p.grams > 0)
    .sort((a, b) => b.grams - a.grams);
  // 30 g per portion is a full plate of protein; the bar is a proportion, not a target.
  const pct = Math.min(100, Math.round((grams / 30) * 100));

  return (
    <>
      <button onClick={() => setOpen(true)} className="hairline-b block w-full py-4 text-left">
        <div className="flex items-baseline justify-between">
          <span className="text-body">
            Protein <span className="font-semibold">± {text}</span> per porsi
          </span>
          <span className="text-label text-ink-3">perkiraan ⓘ</span>
        </div>
        <div className="mt-2 h-[6px] w-full bg-rule">
          <div className="h-[6px] bg-mag-fill" style={{ width: `${pct}%` }} />
        </div>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Dari mana angkanya">
        <ul className="mb-4">
          {parts.map((p) => (
            <li key={p.id} className="hairline-b flex justify-between py-2 text-body">
              <span>{ING[p.id]?.name ?? p.id}</span>
              <span className="tabular-nums text-ink-2">
                {Math.round(p.grams * 10) / 10} g
              </span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-3">
          Hitungan ini perkiraan dari berat rata-rata bahan, bukan hasil uji lab. Angkanya
          dipakai untuk menjawab satu hal saja: masakan ini mengenyangkan atau belum.
        </p>
      </Sheet>
    </>
  );
}
