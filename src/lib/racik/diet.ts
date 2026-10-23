import { ING } from "./data";
import { proteinPerPortion } from "./engine";
import type { Recipe } from "./types";
import { t } from "@/lib/racik/i18n";

/**
 * Which recipes a vegetarian or a vegan can actually eat.
 *
 * This is a claim about somebody's food, so it is an explicit list rather than
 * a rule over the `cat` field — and it has to be, because that field fails in
 * BOTH directions here:
 *
 *   · terasi sits in `bumbu`, saus tiram and kerupuk udang in `sembako`. A
 *     "nothing from the daging category" rule calls Karedok vegetarian. It is
 *     not: the peanut sauce has shrimp paste in it, and a vegetarian who
 *     trusted that label would be right to delete the app.
 *   · tempe, tahu and oncom sit in `daging`, because that column groups
 *     protein sources, not animals. The same rule would throw out most of the
 *     vegan recipes Racik has.
 *
 * Anything genuinely ambiguous fails the stricter claim rather than passing
 * it. Margarine and cooking chocolate are usually made with milk, so they
 * block vegan while leaving vegetarian alone. Stock powder is chicken or beef
 * unless a packet says otherwise, so it blocks both.
 */
const MEAT_AND_FISH_EXTRA = new Set([
  // hiding outside the daging category
  "terasi", "saus_tiram", "kerupuk_udang", "kecap_ikan", "kecap_inggris", "petis", "ebi",
  "dashi", "gelatin", "pate_hati",
  // stock is chicken or beef unless a packet says otherwise
  "kaldu_bubuk", "kaldu_blok", "kaldu_ayam_cair", "sup_krim_ayam_kalengan",
  "bumbu_gulai_instan", "bumbu_rendang_instan", "bumbu_soto_instan", "bumbu_nasi_goreng_instan",
]);

/** In the daging column because they are protein, not because they are animals. */
const PLANT_OR_EGG_PROTEIN = new Set([
  "tempe", "tempe_gembus", "tahu", "tahu_sutra", "oncom", "daging_nabati",
  "telur", "telur_asin", "telur_bebek", "telur_puyuh",
]);

/** Animal flesh, whatever column it sits in. */
const isMeatOrFish = (id: string) =>
  MEAT_AND_FISH_EXTRA.has(id) || (ING[id]?.cat === "daging" && !PLANT_OR_EGG_PROTEIN.has(id));

const DAIRY_AND_EGG_EXTRA = new Set([
  "mie_telur", "mentega", "margarin", "ghee", "heavy_cream", "cream_cheese", "mayones", "madu",
  "dark_cooking_chocolate", "coklat_batang", "coklat_chip", "coklat_putih", "creamer_kopi_bubuk",
  "sup_krim_jamur_kalengan", "saus_keju", "paneer", "custard_powder", "selai_coklat_hazelnut",
  "susu_coklat_malt_bubuk", "graham_cracker", "biskuit_marie", "roti_tawar", "puff_pastry",
]);
const PLANT_MILK = new Set(["susu_kedelai", "susu_almond", "susu_oat"]);

const isDairyOrEgg = (id: string) =>
  DAIRY_AND_EGG_EXTRA.has(id) ||
  /^(telur|keju_|yogurt)/.test(id) ||
  (id.startsWith("susu_") && !PLANT_MILK.has(id));

const idsOf = (r: Recipe) => new Set(r.ings.map((l) => l[0]));

export const isVegetarian = (r: Recipe) => ![...idsOf(r)].some(isMeatOrFish);
export const isVegan = (r: Recipe) => isVegetarian(r) && ![...idsOf(r)].some(isDairyOrEgg);
export const hasNoSantan = (r: Recipe) => !idsOf(r).has("santan");

/** Half or more of the non-staple ingredients are vegetables. */
export function isVegetableForward(r: Recipe): boolean {
  const lines = r.ings.map((l) => l[0]).filter((id) => !ING[id]?.staple);
  if (!lines.length) return false;
  const veg = lines.filter((id) => ING[id]?.cat === "sayur").length;
  return veg / lines.length >= 0.5;
}

/** Roughly a fifth of an adult's daily protein in one portion. */
export const isHighProtein = (r: Recipe) => proteinPerPortion(r) >= 15;

/**
 * No number in the label. The gram figure is a per-portion estimate that
 * shifts with the ingredients, and printing it on a shelf invited people to
 * read it as a guarantee.
 */
export const DIET_SHELVES = [
  { get label() { return t("diet_high_protein"); }, match: isHighProtein },
  { get label() { return t("diet_vegetarian"); }, match: isVegetarian },
  { get label() { return t("diet_vegan"); }, match: isVegan },
  { get label() { return t("diet_veg_forward"); }, match: isVegetableForward },
  { get label() { return t("diet_no_santan"); }, match: hasNoSantan },
] as const;
