import { useState } from "react";
import { ING, SUBS, SUBS_LN } from "@/lib/racik/data";
import { fmtQty, scaledQty, takaran, undividable, unitOf } from "@/lib/racik/engine";
import type { IngLine, Recipe, SatuanMode } from "@/lib/racik/types";
import { Sheet } from "./Sheet";
import { Button } from "@/components/ui/button";

function QtyText({
  line,
  recipe,
  servings,
  satuan,
}: {
  line: IngLine;
  recipe: Recipe;
  servings: number;
  satuan: SatuanMode;
}) {
  const unit = unitOf(line);
  const qty = scaledQty(line, recipe, servings);
  if (qty == null) return <span className="text-ink-3">secukupnya</span>;
  const rumah = takaran(line[0], qty, unit, satuan);
  return (
    <span>
      <span className="font-semibold tabular-nums">
        {fmtQty(qty)} {unit}
      </span>
      {rumah ? <span className="text-primary"> {rumah}</span> : null}
    </span>
  );
}

export function IngredientList({
  recipe,
  servings,
  satuan,
}: {
  recipe: Recipe;
  servings: number;
  satuan: SatuanMode;
}) {
  const [sub, setSub] = useState<IngLine | null>(null);
  const cantSplit = undividable(recipe, servings);
  const visible = recipe.ings.filter((l) => !l[4]);
  const subIng = sub ? ING[sub[0]] : null;

  return (
    <div>
      <ul>
        {visible.map((line) => {
          const ing = ING[line[0]];
          if (!ing) return null;
          const hasSub = Boolean(line[3] ?? SUBS[line[0]]);
          return (
            <li key={line[0]} className="hairline-b py-3">
              <div className="read-line flex items-start gap-3">
                <span aria-hidden className="w-6 shrink-0">
                  {ing.em}
                </span>
                <div className="flex-1">
                  <QtyText line={line} recipe={recipe} servings={servings} satuan={satuan} />{" "}
                  <span>{ing.name}</span>
                  {line[2] ? <span className="text-ink-3">, {line[2]}</span> : null}
                </div>
                {hasSub ? (
                  <Button variant="ghost" size="sm"
                    onClick={() => setSub(line)}
                    className="shrink-0 px-2 text-label uppercase tracking-[0.1em] text-primary"
                  >
                    Ganti
                  </Button>
                ) : null}
              </div>
              {cantSplit.includes(line) ? (
                <p className="text-caption text-ink-3 mt-1 pl-9">
                  Tidak bisa dibagi lebih kecil.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet
        open={Boolean(sub)}
        onClose={() => setSub(null)}
        title={subIng ? `Pengganti ${subIng.name}` : "Pengganti"}
      >
        {sub && subIng ? (
          <div className="space-y-4">
            <p className="read-line">{sub[3] ?? SUBS[sub[0]]}</p>
            {SUBS_LN[sub[0]] ? (
              <p className="text-body text-ink-2">{SUBS_LN[sub[0]]}</p>
            ) : null}
            <p className="text-caption text-ink-3">
              Rasanya tidak persis sama. Penggantinya cukup dekat untuk sekali masak.
            </p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
