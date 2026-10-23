import { useState } from "react";
import { ING } from "@/lib/racik/data";
import {
  carbParts,
  carbPerPortion,
  fiberParts,
  fiberPerPortion,
  fmtGrams,
  fmtProtein,
  proteinParts,
  proteinPerPortion,
  proteinUncertain,
  type ProteinPart,
} from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";

type Row = {
  key: string;
  label: string;
  grams: number;
  text: string | null;
  parts: ProteinPart[];
  ref: number;
  note: string;
};

/** One column of the nutrition panel. Tapping it opens where the number comes from. */
function NutrientCell({ row, first }: { row: Row; first: boolean }) {
  const [open, setOpen] = useState(false);
  const parts = row.parts.filter((p) => p.grams > 0).sort((a, b) => b.grams - a.grams);
  return (
    <>
      <button
        type="button"
        onClick={() => row.text && setOpen(true)}
        className={`text-left ${first ? "" : "border-l border-primary-line pl-3.5"}`}
      >
        <p className="text-xl font-extrabold text-primary-deep">{row.text ? `±${row.text}` : "–"}</p>
        <p className="mt-0.5 text-micro text-ink-3">per porsi</p>
        <p className="mt-1 text-label font-bold text-ink">{row.label} <span aria-hidden className="text-primary">ⓘ</span></p>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Dari mana angka ${row.label.toLowerCase()}`}>
        <ul className="mb-4">
          {parts.map((p) => (
            <li key={p.id} className="hairline-b flex justify-between py-2 text-body">
              <span>{ING[p.id]?.name ?? p.id}</span>
              <span className="tabular-nums text-ink-2">{Math.round(p.grams * 10) / 10} g</span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-3">{row.note}</p>
      </Sheet>
    </>
  );
}

export function ProteinBlock({ recipe }: { recipe: Recipe }) {
  if (proteinUncertain(recipe)) {
    return (
      <p className="mt-[18px] rounded-2xl border border-primary-line bg-[#f7faf6] p-3.5 text-14 text-ink-2">
        Perkiraan gizi belum bisa dihitung — resepnya belum lengkap.
      </p>
    );
  }

  const protein = proteinPerPortion(recipe);
  const carb = carbPerPortion(recipe);
  const fiber = fiberPerPortion(recipe);

  const rows: Row[] = [
    {
      key: "protein",
      label: "Protein",
      grams: protein,
      text: fmtProtein(protein),
      parts: proteinParts(recipe),
      ref: 30,
      note: "Perkiraan dari berat rata-rata bahan, bukan hasil uji lab. Dipakai untuk menjawab satu hal: masakan ini mengenyangkan atau belum.",
    },
    {
      key: "karbo",
      label: "Karbo",
      grams: carb,
      text: fmtGrams(carb),
      parts: carbParts(recipe),
      ref: 75,
      note: "Perkiraan dari bahan yang Racik kenal — nasi, tepung, gula, dan umbi paling banyak menyumbang. Bukan hasil uji lab.",
    },
    {
      key: "serat",
      label: "Serat",
      grams: fiber,
      text: fmtGrams(fiber),
      parts: fiberParts(recipe),
      ref: 25,
      note: "Perkiraan dari sayur, kacang, dan buah di resep. Bahan yang belum ada di daftar Racik tidak ikut dihitung, jadi serat aslinya bisa lebih tinggi.",
    },
  ];

  if (!rows.some((r) => r.text)) return null;

  return (
    <div className="mt-[18px] rounded-2xl border border-primary-line bg-[#f7faf6] p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-label font-extrabold text-primary-deep">PERKIRAAN GIZI PER PORSI</p>
        <span className="text-micro font-bold text-ink-3">ESTIMASI</span>
      </div>
      <div className="mt-3 grid grid-cols-3">
        {rows.map((r, i) => <NutrientCell key={r.key} row={r} first={i === 0} />)}
      </div>
      <p className="mt-3 border-t border-primary-line pt-2.5 text-micro leading-normal text-ink-3">
        Nilai dihitung dari bahan standar. Hasil sebenarnya dapat berbeda menurut merek dan cara memasak.
      </p>
    </div>
  );
}
