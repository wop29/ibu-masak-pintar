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

/**
 * Perkiraan gizi: kalori, protein, karbo, lemak, serat — for everyone, always
 * with "±", never a score or a colour. A value Racik cannot compute honestly
 * says "belum bisa dihitung" instead of a dash or a zero.
 */

type Key = "kcal" | "protein" | "carb" | "fat" | "fiber";
const LABEL: Record<Key, string> = { kcal: "kkal", protein: "protein", carb: "karbo", fat: "lemak", fiber: "serat" };
const ORDER: Key[] = ["kcal", "protein", "carb", "fat", "fiber"];

/** "±420 kkal" / "±34 g", or null when there is nothing honest to print. */
function valueText(key: Key, n: Nutrition, factor = 1): string | null {
  const v = n[key];
  if (v == null) return null;
  const t = key === "kcal" ? fmtKcal(v * factor) : fmtGrams(v * factor);
  return t ? `±${t}` : null;
}

/** The one-line summary on recipe cards: "±420 kkal · 34 g protein · …". Unknown values are left out. */
export function nutritionLine(recipe: Recipe): string | null {
  if (proteinUncertain(recipe)) return null;
  const n = nutritionPerPortion(recipe);
  const parts: string[] = [];
  for (const key of ORDER) {
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
  protein: "Dari berat rata-rata bahan, bukan hasil uji lab. Dipakai untuk menjawab satu hal: masakan ini mengenyangkan atau belum.",
  carb: "Nasi, tepung, gula, dan umbi paling banyak menyumbang. Bukan hasil uji lab.",
  fat: "Minyak, santan, kelapa, dan daging berlemak paling banyak menyumbang. Minyak yang tertinggal di wajan ikut terhitung, jadi angka aslinya bisa lebih rendah.",
  fiber: "Dari sayur, kacang, dan buah di resep. Bahan yang belum ada di daftar Racik tidak ikut dihitung, jadi serat aslinya bisa lebih tinggi.",
};

export function NutritionBlock({ recipe, servings }: { recipe: Recipe; servings: number }) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const [focus, setFocus] = useState<Exclude<Key, "kcal">>("protein");

  if (proteinUncertain(recipe)) {
    return (
      <div className="rounded-2xl border border-primary-line bg-primary-wash p-3.5">
        <h2 className="heading-sm">Perkiraan gizi per porsi</h2>
        <p className="mt-1.5 text-14 text-ink-2">Perkiraan gizi belum bisa dihitung — resepnya belum lengkap.</p>
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
      <h2 className="heading-sm">Perkiraan gizi per porsi</h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Lihat rincian perkiraan gizi"
        className="mt-3 grid w-full grid-cols-[repeat(auto-fit,minmax(calc(52px*var(--teks,1)),1fr))] gap-x-1.5 gap-y-3 text-left"
      >
        {ORDER.map((key) => {
          const t = valueText(key, n);
          return (
            <span key={key} className="min-w-0">
              {t ? (
                <span className="block text-17 font-extrabold leading-tight text-primary-deep tabular-nums">{t.replace(/ (kkal)$/, "")}</span>
              ) : (
                <span className="block text-caption leading-tight text-ink-3">belum bisa dihitung</span>
              )}
              <span className="mt-0.5 block text-caption font-bold text-ink">{LABEL[key]}</span>
            </span>
          );
        })}
      </button>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex min-h-11 items-center gap-1 text-14 font-bold text-primary">
        Lihat rincian <ChevronRight aria-hidden className="size-4" />
      </button>
      <p className="border-t border-primary-line pt-2.5 text-caption leading-normal text-ink-3">
        Perkiraan dari bahan standar. Hasil sebenarnya dapat berbeda menurut merek dan cara memasak.
      </p>

      <Sheet open={open} onClose={() => setOpen(false)} title="Dari mana angka gizinya">
        <div role="radiogroup" aria-label="Tampilkan gizi" className="flex gap-1 rounded-xl bg-tint p-1">
          {([false, true] as const).map((w) => (
            <button
              key={String(w)}
              type="button"
              role="radio"
              aria-checked={whole === w}
              onClick={() => setWhole(w)}
              className={`min-h-11 flex-1 rounded-lg text-14 font-bold ${whole === w ? "bg-card text-ink shadow-card" : "text-ink-2"}`}
            >
              {w ? "Seluruh resep" : "Per porsi"}
            </button>
          ))}
        </div>

        <p className="mt-2 text-caption text-ink-3">{whole ? `Untuk ${servings} porsi, sesuai jumlah porsi di halaman resep.` : "Untuk satu porsi."}</p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4">
          {ORDER.map((key) => (
            <div key={key} className="contents">
              <dt className="hairline-b py-2 text-body capitalize">{key === "kcal" ? "Kalori" : LABEL[key]}</dt>
              <dd className={`hairline-b py-2 text-right text-body tabular-nums ${valueText(key, n) ? "font-bold" : "text-ink-3"}`}>
                {valueText(key, n, factor) ?? "belum bisa dihitung"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-ink-3">
          Dihitung dari {n.coverage.counted} dari {n.coverage.total} bahan yang ada takarannya.
          {" "}Kalori = 4 × protein + 4 × karbo + 9 × lemak, dan hanya dihitung kalau semua bahan itu dikenal Racik.
        </p>

        <p className="mt-5 text-14 font-bold">Bahan penyumbang terbesar</p>
        <div role="radiogroup" aria-label="Pilih zat gizi" className="mt-2 flex flex-wrap gap-2">
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
          <p className="mt-2 text-14 text-ink-3">Belum bisa dihitung untuk resep ini.</p>
        )}
        <p className="mt-3 text-caption text-ink-3">{NOTE[focus]}</p>
      </Sheet>
    </div>
  );
}
