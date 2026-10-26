import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ING } from "@/lib/racik/data";
import {
  carbParts,
  fatParts,
  fiberParts,
  fmtGrams,
  fmtKcal,
  nutritionPerPortion,
  proteinParts,
  proteinUncertain,
  type Nutrition,
  type ProteinPart,
} from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";
import { t } from "@/lib/racik/i18n";

/**
 * Perkiraan gizi: kalori, protein, karbo, lemak, serat — for everyone, always
 * with "±", never a score or a colour. A value Racik cannot compute honestly
 * says "belum bisa dihitung" instead of a dash or a zero.
 */

type Key = "kcal" | "protein" | "carb" | "fat" | "fiber";
const LABEL: Record<Key, string> = {
  get kcal() { return t("nutr_kcal"); },
  get protein() { return t("nutr_protein"); },
  get carb() { return t("nutr_carb"); },
  get fat() { return t("nutr_fat"); },
  get fiber() { return t("nutr_fiber"); },
};
const ORDER: Key[] = ["kcal", "protein", "carb", "fat", "fiber"];

/** "±420 kkal" / "±34 g", or null when there is nothing honest to print. */
function valueText(key: Key, n: Nutrition, factor = 1): string | null {
  const v = n[key];
  if (v == null) return null;
  const t = key === "kcal" ? fmtKcal(v * factor) : fmtGrams(v * factor);
  return t ? `±${t}` : null;
}

/** The one-line summary on recipe cards: "±420 kkal · 34 g protein · …". Unknown values are left out. */
/** Recipe cards show only kalori and protein (decided 25 Oct 2026); the recipe page shows all five. */
export const CARD_KEYS: Key[] = ["kcal", "protein"];

export function nutritionLine(recipe: Recipe, keys: Key[] = ORDER): string | null {
  if (proteinUncertain(recipe)) return null;
  const n = nutritionPerPortion(recipe);
  const parts: string[] = [];
  for (const key of ORDER.filter((k) => keys.includes(k))) {
    const v = n[key];
    if (v == null) continue;
    const t = key === "kcal" ? fmtKcal(v) : fmtGrams(v);
    if (!t) continue;
    parts.push(key === "kcal" ? t : `${t} ${LABEL[key]}`);
  }
  if (!parts.length) return null;
  return `±${parts.join(" · ")}`;
}

const PARTS: Record<Exclude<Key, "kcal">, (r: Recipe) => ProteinPart[]> = {
  protein: proteinParts,
  carb: carbParts,
  fat: fatParts,
  fiber: fiberParts,
};

const NOTE: Record<Exclude<Key, "kcal">, string> = {
  get protein() { return t("nutr_note_protein"); },
  get carb() { return t("nutr_note_carb"); },
  get fat() { return t("nutr_note_fat"); },
  get fiber() { return t("nutr_note_fiber"); },
};

export function NutritionBlock({ recipe, servings }: { recipe: Recipe; servings: number }) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const [focus, setFocus] = useState<Exclude<Key, "kcal">>("protein");

  if (proteinUncertain(recipe)) {
    return (
      <div className="rounded-2xl border border-primary-line bg-primary-wash p-3.5">
        <h2 className="heading-sm">{t("perkiraan_gizi_per_porsi")}</h2>
        <p className="mt-1.5 text-14 text-ink-2">{t("perkiraan_gizi_belum_bisa_dihitung")}</p>
      </div>
    );
  }

  const n = nutritionPerPortion(recipe);
  // Seluruh resep = per porsi × the portions currently on screen.
  const factor = whole ? servings : 1;
  const parts = PARTS[focus](recipe)
    .filter((p) => p.grams > 0)
    .sort((a, b) => b.grams - a.grams);

  return (
    <div className="rounded-2xl border border-primary-line bg-primary-wash p-3.5">
      <h2 className="heading-sm">{t("perkiraan_gizi_per_porsi")}</h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("lihat_rincian_perkiraan_gizi")}
        className="mt-3 grid w-full grid-cols-[repeat(auto-fit,minmax(calc(52px*var(--teks,1)),1fr))] gap-x-1.5 gap-y-3 text-left"
      >
        {ORDER.map((key) => {
          const shown = valueText(key, n);
          return (
            <span key={key} className="min-w-0">
              {shown ? (
                <span className="block text-17 font-extrabold leading-tight text-primary-deep tabular-nums">{shown.replace(/ (kkal|kcal)$/, "")}</span>
              ) : (
                <span className="block text-caption leading-tight text-ink-3">{t("belum_bisa_dihitung")}</span>
              )}
              <span className="mt-0.5 block text-caption font-bold text-ink">{LABEL[key]}</span>
            </span>
          );
        })}
      </button>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex min-h-11 items-center gap-1 text-14 font-bold text-primary">
        
        {t("lihat_rincian")}{" "}<ChevronRight aria-hidden className="size-4" />
      </button>
      <p className="border-t border-primary-line pt-2.5 text-caption leading-normal text-ink-3">
        
        {t("perkiraan_dari_bahan_standar_hasil")}
      </p>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("dari_mana_angka_gizinya")}>
        <div role="radiogroup" aria-label={t("tampilkan_gizi")} className="flex gap-1 rounded-xl bg-tint p-1">
          {([false, true] as const).map((w) => (
            <button
              key={String(w)}
              type="button"
              role="radio"
              aria-checked={whole === w}
              onClick={() => setWhole(w)}
              className={`min-h-11 flex-1 rounded-lg text-14 font-bold ${whole === w ? "bg-card text-ink shadow-card" : "text-ink-2"}`}
            >
              {w ? t("seluruh_resep") : t("per_porsi_2")}
            </button>
          ))}
        </div>

        <p className="mt-2 text-caption text-ink-3">{whole ? t("untuk_porsi_sesuai_jumlah_porsi", { servings }) : t("untuk_satu_porsi")}</p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4">
          {ORDER.map((key) => (
            <div key={key} className="contents">
              <dt className="hairline-b py-2 text-body capitalize">{key === "kcal" ? t("kalori") : LABEL[key]}</dt>
              <dd className={`hairline-b py-2 text-right text-body tabular-nums ${valueText(key, n) ? "font-bold" : "text-ink-3"}`}>
                {valueText(key, n, factor) ?? t("belum_bisa_dihitung")}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-ink-3">
          
          {t("coverage_line", { counted: n.coverage.counted, total: n.coverage.total })}
          {" "}{t("kalori_4_protein_4_karbo")}
        </p>

        <p className="mt-5 text-14 font-bold">{t("bahan_penyumbang_terbesar")}</p>
        <div role="radiogroup" aria-label={t("pilih_zat_gizi")} className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(PARTS) as Exclude<Key, "kcal">[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={focus === k}
              onClick={() => setFocus(k)}
              className={`min-h-11 rounded-full border px-4 text-14 font-bold capitalize ${focus === k ? "border-primary bg-primary-soft text-primary-deep" : "border-rule bg-card text-ink-2"}`}
            >
              {LABEL[k]}
            </button>
          ))}
        </div>
        {parts.length ? (
          <ul className="mt-2">
            {parts.slice(0, 8).map((p) => (
              <li key={p.id} className="hairline-b flex justify-between gap-3 py-2 text-body">
                <span className="min-w-0">{ING[p.id]?.name ?? p.id}</span>
                <span className="shrink-0 tabular-nums text-ink-2">±{fmtGrams(p.grams * factor) ?? "<0,5 g"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-14 text-ink-3">{t("belum_bisa_dihitung_untuk_resep")}</p>
        )}
        <p className="mt-3 text-caption text-ink-3">{NOTE[focus]}</p>
      </Sheet>
    </div>
  );
}
