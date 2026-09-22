import { useState } from "react";
import { ING } from "@/lib/racik/data";
import { analyseHalal, HALAL_FOOTNOTE, HALAL_ROWS } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";
import { Button } from "@/components/ui/button";

/** Never a green tick. A word, and a sheet that admits what cannot be checked. */
export function HalalChip({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const { status, label, certIds } = analyseHalal(recipe);
  const names = certIds.map((id) => ING[id]?.name ?? id);

  return (
    <>
      <Button variant="outline" size="sm"
        onClick={() => setOpen(true)}
        className="text-label uppercase tracking-[0.1em] text-ink-2"
      >
        {label} <span className="text-primary">ⓘ</span>
      </Button>

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
