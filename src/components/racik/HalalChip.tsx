import { useState } from "react";
import { ING } from "@/lib/racik/data";
import { analyseHalal, HALAL_FOOTNOTE, HALAL_ROWS } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";

/** Never a green tick. A word, and a sheet that admits what cannot be checked. */
export function HalalChip({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const { status, label, certIds } = analyseHalal(recipe);
  const names = certIds.map((id) => ING[id]?.name ?? id);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-label border border-rule bg-card px-3 py-1.5 uppercase tracking-[0.12em] text-ink-2"
      >
        {label} <span className="text-mag-text">ⓘ</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Soal halal">
        <ul className="mb-4">
          {HALAL_ROWS(status, names).map((row) => (
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
