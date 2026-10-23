import { ING } from "../data";
import type { Recipe } from "../types";
import { t } from "@/lib/racik/i18n";

export type HalalStatus = "halal" | "syubhat" | "haram";

/**
 * Founder decision, 19 Oct 2026: "perlu cek" is NARROW.
 *
 * The ingredient data marks ~130 items `halal: "cert"` (anything bottled or
 * packed). Flagging all of them put the yellow chip on kecap manis, cuka,
 * ragi and tuna kaleng — half the app — and a label on everything means
 * nothing. Only these carry a real, common non-halal risk:
 *   - gelatin (and what is made of it),
 *   - processed meat and animal-based stock (sosis, kornet, bakso jadi,
 *     kaldu blok/kaldu ayam kemasan), which may use non-halal meat or fat,
 *   - animal fat (Japanese curry roux uses beef fat or lard),
 *   - alcohol-derived seasonings (mirin, teriyaki made with mirin/sake,
 *     vanilla extract, which is alcohol-based).
 * Every other `cert` item counts as ordinary: local bottled sauces are
 * widely MUI-certified, and the halal sheet's footnote tells her to check the
 * logo on packaging anyway. `haram` items (pork, sake, angciu/shaoxing) stay
 * haram whatever this list says.
 */
export const CHECK_IDS: ReadonlySet<string> = new Set([
  // gelatin
  "gelatin",
  "marshmallow",
  // processed animal products
  "sosis",
  "kornet",
  "smoked_beef",
  "luncheon_meat",
  "nugget",
  "nugget_ikan",
  "bakso",
  "bakso_ikan",
  "pate_hati",
  "kaldu_blok",
  "kaldu_ayam_cair",
  "sup_krim_ayam_kalengan",
  // animal fat
  "kari_blok",
  // alcohol-derived
  "mirin",
  "saus_teriyaki",
  "vanila_cair",
]);

/**
 * Meat and poultry: the ingredient itself is halal, but how it was
 * slaughtered (sembelihan) is something no ingredient list can show. This is
 * a quiet note on the recipe page, not the yellow chip and not the filter —
 * otherwise every ayam recipe would be hidden from the people who cook ayam
 * most.
 */
export const MEAT_IDS: ReadonlySet<string> = new Set([
  "ayam",
  "ayam_utuh",
  "hati_ayam",
  "ampela",
  "ceker",
  "bebek",
  "angsa",
  "kalkun",
  "burung_puyuh",
  "daging_sapi",
  "daging_giling",
  "buntut_sapi",
  "iga_sapi",
  "babat",
  "daging_kambing",
  "daging_rusa",
  "daging_kelinci",
]);

export function analyseHalal(recipe: Pick<Recipe, "ings">): {
  status: HalalStatus;
  label: string;
  certIds: string[];
  haramIds: string[];
  meatIds: string[];
} {
  const ids = Array.from(new Set(recipe.ings.map((l) => l[0])));
  const haramIds = ids.filter((id) => ING[id]?.halal === "haram");
  const certIds = ids.filter((id) => CHECK_IDS.has(id) && ING[id]?.halal !== "haram");
  const meatIds = ids.filter((id) => MEAT_IDS.has(id));
  const status: HalalStatus = haramIds.length > 0 ? "haram" : certIds.length > 0 ? "syubhat" : "halal";
  return {
    status,
    label: status === "haram" ? t("halal_label_haram") : status === "syubhat" ? t("halal_label_check") : t("halal_label_ok"),
    certIds,
    haramIds,
    meatIds,
  };
}

/** Halal-mode filter: hides "perlu dicek" and "tidak halal", never plain meat recipes. */
export const passesHalalMode = (recipe: Pick<Recipe, "ings">, halalMode: boolean): boolean =>
  !halalMode || analyseHalal(recipe).status === "halal";

/**
 * The rows of the "Soal halal" sheet. One idea per row, no row contradicting
 * another, and nothing that reads as a certificate.
 */
export const HALAL_ROWS = (
  status: HalalStatus,
  certNames: string[],
  haramNames: string[] = [],
  meatNames: string[] = [],
): string[] => {
  const rows: string[] = [];
  if (status === "haram") rows.push(t("halal_row_haram", { names: haramNames.join(", ") }));
  if (certNames.length)
    rows.push(
      t("halal_row_check", { names: certNames.join(", ") }),
    );
  if (meatNames.length)
    rows.push(
      t("halal_row_meat", { names: meatNames.join(", ") }),
    );
  if (status === "halal" && !meatNames.length) rows.push(t("halal_row_none"));
  rows.push(t("halal_row_kitchen"));
  return rows;
};

export const HALAL_FOOTNOTE =
  "Racik bukan lembaga sertifikasi halal. Keterangan ini hanya membaca daftar bahan resep — untuk bahan kemasan seperti kecap atau saus, tetap cek logo halal di kemasannya.";
