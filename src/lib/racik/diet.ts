import { ING } from "./data";
import { proteinPerPortion } from "./engine";
import type { Recipe } from "./types";

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
const MEAT_AND_FISH = new Set([
  "ayam", "ayam_utuh", "bebek", "daging_sapi", "daging_kambing", "daging_giling",
  "buntut_sapi", "iga_sapi", "babat", "bakso",
  "ikan_teri", "ikan_kembung", "ikan_patin", "ikan_mas", "ikan_tongkol", "ikan_tenggiri",
  "ikan_bandeng", "ikan_gurami", "ikan_gabus", "ikan_kakap", "ikan_nike", "ikan_cakalang",
  "ikan_roa", "ikan_asin", "cakalang_fufu",
  "udang", "ebi", "cumi", "cumi_asin", "kepiting",
  // the three that hide outside the daging category
  "terasi", "saus_tiram", "kerupuk_udang",
  "kaldu_bubuk",
]);

const DAIRY_AND_EGG = new Set([
  "telur", "telur_asin", "mie_telur",
  "susu_cair", "susu_kental_manis", "susu_bubuk", "keju_cheddar", "mentega",
  "margarin", "dark_cooking_chocolate",
]);

const idsOf = (r: Recipe) => new Set(r.ings.map((l) => l[0]));
const has = (set: Set<string>, against: Set<string>) => [...set].some((id) => against.has(id));

export const isVegetarian = (r: Recipe) => !has(idsOf(r), MEAT_AND_FISH);
export const isVegan = (r: Recipe) => isVegetarian(r) && !has(idsOf(r), DAIRY_AND_EGG);
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
  { label: "Protein tinggi", match: isHighProtein },
  { label: "Vegetarian", match: isVegetarian },
  { label: "Vegan", match: isVegan },
  { label: "Banyak sayur", match: isVegetableForward },
  { label: "Tanpa santan", match: hasNoSantan },
] as const;
