import { useState } from "react";
import { ING } from "@/lib/racik/data";
import { analyseHalal, HALAL_ROWS } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";
import { t } from "@/lib/racik/i18n";

/**
 * Only risk states get a coloured label. A recipe whose ingredients are all
 * plain gets nothing — no green tick, because Racik cannot certify a kitchen.
 * Meat or poultry alone gets no label either (Octavia, 29 Okt 2026: the old
 * "cek sembelihan" note said nothing useful). The label opens a sheet naming
 * the ingredients behind it.
 */
export function HalalChip({
  recipe,
  static: isStatic = false,
}: {
  recipe: Recipe;
  static?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { status, certIds, haramIds, meatIds } = analyseHalal(recipe);
  if (status === "halal") return null;
  const haram = status === "haram";
  const name = (id: string) => ING[id]?.name ?? id;
  const cls = `inline-flex min-h-[26px] items-center gap-1 rounded-full border px-2.5 py-1 text-caption font-bold ${
    haram
      ? "border-danger-line bg-danger-soft text-danger-ink"
      : "border-notice-line bg-notice text-notice-ink"
  }`;
  const text = haram ? t("halal_chip_haram") : t("halal_chip_check");

  if (isStatic) return <span className={cls}>{text}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${cls} relative after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']`}
      >
        {text} <span aria-hidden>ⓘ</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("soal_halal")}>
        <ul className="mb-4">
          {HALAL_ROWS(status, certIds.map(name), haramIds.map(name), meatIds.map(name)).map(
            (row) => (
              <li key={row} className="hairline-b py-3 text-body">
                {row}
              </li>
            ),
          )}
        </ul>
        <p className="text-caption text-ink-3">{t("halal_footnote")}</p>
      </Sheet>
    </>
  );
}
