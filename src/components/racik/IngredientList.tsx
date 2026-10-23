import { useState } from "react";
import { ING, SUBS, SUBS_LN } from "@/lib/racik/data";
import { qtyDisplay, scaledQty, undividable, unitOf } from "@/lib/racik/engine";
import type { IngLine, Recipe, SatuanMode } from "@/lib/racik/types";
import { NEGARA, localName, localSub, type Negara } from "@/lib/racik/locale";
import { Sheet } from "./Sheet";
import { Check } from "lucide-react";

function QtyText({
  line,
  recipe,
  servings,
  satuan,
  negara,
}: {
  line: IngLine;
  recipe: Recipe;
  servings: number;
  satuan: SatuanMode;
  negara: Negara;
}) {
  const qty = scaledQty(line, recipe, servings);
  if (qty == null) return <span className="text-ink-3">secukupnya</span>;
  // Pengaturan › Satuan takaran: in gram mode the weight leads, "40 g (8 siung)".
  const { main, hint } = qtyDisplay(line[0], qty, unitOf(line), satuan, negara);
  return (
    <span>
      <span className="font-bold tabular-nums">{main}</span>
      {hint ? <span className="text-primary"> {hint}</span> : null}
    </span>
  );
}

export function IngredientList({
  recipe,
  servings,
  satuan,
  negara = "ID",
}: {
  recipe: Recipe;
  servings: number;
  satuan: SatuanMode;
  /** Pengaturan › Negara: measure words, local names and local swaps. */
  negara?: Negara;
}) {
  const [sub, setSub] = useState<IngLine | null>(null);
  // An unmatched imported line ("2 cups heavy cream") with an importer swap.
  const [extraSub, setExtraSub] = useState<string | null>(null);
  const swaps = (recipe as Recipe & { swaps?: Record<string, string> }).swaps ?? {};
  // Ticking off what is already on the counter. Session-only; cook mode keeps its own.
  // Keyed by line index: a recipe can list the same ingredient twice (cabai
  // haluskan + cabai iris), and ticking one must not tick both.
  const [ticked, setTicked] = useState<number[]>([]);
  const cantSplit = undividable(recipe, servings);
  const subIng = sub ? ING[sub[0]] : null;

  return (
    <div>
      <ul>
        {recipe.ings.map((line, i) => {
          const ing = ING[line[0]];
          if (!ing) return null;
          const hasSub = Boolean(line[3] ?? SUBS[line[0]] ?? localSub(line[0], negara) ?? swaps[line[0]]);
          const local = localName(line[0], negara);
          const on = ticked.includes(i);
          return (
            <li key={`${line[0]}-${i}`} data-ingredient-line className="border-b border-rule py-[15px]">
              <div className="flex items-start gap-3 text-17 leading-normal">
                <button
                  type="button"
                  aria-label={`Tandai ${ing.name}`}
                  aria-pressed={on}
                  onClick={() => setTicked((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))}
                  className="-m-[11px] mt-[-9px] shrink-0 p-[11px]"
                >
                  <span className={`flex size-[22px] items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "border-2 border-control-line"}`}>
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                </button>
                <div className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${on ? "text-ink-3 line-through" : ""}`}>
                  <QtyText line={line} recipe={recipe} servings={servings} satuan={satuan} negara={negara} />{" "}
                  <span>{ing.name}</span>
                  {local ? <span className="text-ink-3"> · {local}</span> : null}
                  {line[2] ? <span className="text-ink-3">, {line[2]}</span> : null}
                </div>
                {hasSub ? (
                  <button type="button" onClick={() => setSub(line)} className="-my-2.5 min-h-11 shrink-0 px-2 text-14 font-bold text-primary">
                    Ganti
                  </button>
                ) : null}
              </div>
              {cantSplit.includes(line) ? (
                <p className="mt-1 pl-[34px] text-caption text-ink-3">Tidak bisa dibagi lebih kecil.</p>
              ) : null}
            </li>
          );
        })}
        {((recipe as Recipe & { unmatched?: string[] }).unmatched ?? []).map((txt, idx) => (
          <li key={`extra-${idx}`} data-ingredient-line className="border-b border-rule py-[15px]">
            <div className="flex items-start gap-3 text-17 leading-normal">
              <span aria-hidden className="mt-0.5 size-[22px] shrink-0 rounded-full border-2 border-control-line" />
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span>{txt}</span>
              </div>
              {swaps[txt] ? (
                <button type="button" onClick={() => setExtraSub(txt)} className="-my-2.5 min-h-11 shrink-0 px-2 text-14 font-bold text-primary">
                  Ganti
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Sheet
        open={Boolean(sub)}
        onClose={() => setSub(null)}
        title={subIng ? `Pengganti ${subIng.name}` : "Pengganti"}
      >
        {sub && subIng ? (
          <div className="space-y-4">
            {sub[3] ?? SUBS[sub[0]] ? <p className="read-line">{sub[3] ?? SUBS[sub[0]]}</p> : null}
            {SUBS_LN[sub[0]] ? (
              <p className="text-body text-ink-2">{SUBS_LN[sub[0]]}</p>
            ) : null}
            {localSub(sub[0], negara) ? (
              <div>
                <p className="text-caption font-bold text-primary">Di {NEGARA[negara].name}</p>
                <p className="read-line mt-1">{localSub(sub[0], negara)}</p>
              </div>
            ) : null}
            {swaps[sub[0]] ? (
              <div>
                <p className="text-caption font-bold text-primary">Saran saat impor</p>
                <p className="read-line mt-1">{swaps[sub[0]]}</p>
              </div>
            ) : null}
            <p className="text-caption text-ink-3">
              Rasanya tidak persis sama. Penggantinya cukup dekat untuk sekali masak.
            </p>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={extraSub != null} onClose={() => setExtraSub(null)} title="Pengganti">
        {extraSub ? (
          <div className="space-y-4">
            <p className="text-caption text-ink-3">{extraSub}</p>
            <p className="read-line">{swaps[extraSub]}</p>
            <p className="text-caption text-ink-3">Saran dari Racik saat impor. Rasanya tidak persis sama.</p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
