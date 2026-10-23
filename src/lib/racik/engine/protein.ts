import { CANNED100, CARB100, EDIBLE, FAT100, FIBER100, PROT100 } from "../data";
import type { IngLine, Recipe } from "../types";
import { gramsOfLine, unitOf } from "./units";

/** Sold by weight with the bone still in. Everything else bought by weight is taken as trimmed. */
const BONE_IN_BY_WEIGHT = new Set(["iga_sapi", "buntut_sapi"]);

export interface ProteinPart {
  id: string;
  grams: number;
}

/**
 * P protein, C karbohidrat, F serat (fibre), L lemak (fat). "F" stays fibre
 * because CANNED100 already uses it that way; fat is "L" for lemak.
 */
type Nutrient = "P" | "C" | "F" | "L";
const TABLE: Record<Nutrient, Record<string, number>> = { P: PROT100, C: CARB100, F: FIBER100, L: FAT100 };

/** "kalengan, tiriskan dan bilas", "matang": the beans are already cooked. */
const COOKED = /kalengan|kaleng|tiriskan|matang/;

/**
 * Per-100 g value for this line. Canned or cooked legumes use their cooked
 * figures — 250 g of drained chickpeas is not 250 g of dry chickpeas.
 */
function per100(line: IngLine, n: Nutrient): number | undefined {
  const canned = CANNED100[line[0]];
  if (canned && COOKED.test(line[2] ?? "")) return canned[n] ?? TABLE[n][line[0]];
  return TABLE[n][line[0]];
}

/**
 * Bought weight times the share that is eaten. A whole fish is bought with its
 * head and bones; prawns "sisakan kepala" keep their heads on the plate.
 */
export function edibleGrams(line: IngLine): number {
  const grams = gramsOfLine(line);
  const prep = line[2] ?? "";
  const unit = unitOf(line);
  const byWeight = unit === "gram" || unit === "ml";
  let factor = byWeight && !BONE_IN_BY_WEIGHT.has(line[0]) ? 1 : (EDIBLE[line[0]] ?? 1);
  if (line[0] === "udang" && /kepala/.test(prep)) factor = 0.7;
  return grams * factor;
}

/**
 * Grams of each nutrient per portion, from the ingredients Racik can weigh,
 * computed from the recipe's base quantities so the number does not wobble
 * when the portion stepper moves. An ingredient with no entry is skipped,
 * never guessed — so the figure only ever reflects what the ontology knows.
 */
function nutrientParts(recipe: Recipe, n: Nutrient): ProteinPart[] {
  return recipe.ings
    .map((l) => {
      const per = per100(l, n);
      if (per == null) return null;
      const grams = (edibleGrams(l) * per) / 100 / recipe.serv;
      if (grams <= 0) return null;
      return { id: l[0], grams };
    })
    .filter((p): p is ProteinPart => p !== null)
    .sort((a, b) => b.grams - a.grams);
}

export function proteinParts(recipe: Recipe): ProteinPart[] {
  return nutrientParts(recipe, "P");
}
export function proteinPerPortion(recipe: Recipe): number {
  return proteinParts(recipe).reduce((sum, p) => sum + p.grams, 0);
}
export function carbParts(recipe: Recipe): ProteinPart[] {
  return nutrientParts(recipe, "C");
}
export function carbPerPortion(recipe: Recipe): number {
  return carbParts(recipe).reduce((sum, p) => sum + p.grams, 0);
}
export function fiberParts(recipe: Recipe): ProteinPart[] {
  return nutrientParts(recipe, "F");
}
export function fiberPerPortion(recipe: Recipe): number {
  return fiberParts(recipe).reduce((sum, p) => sum + p.grams, 0);
}
export function fatParts(recipe: Recipe): ProteinPart[] {
  return nutrientParts(recipe, "L");
}
export function fatPerPortion(recipe: Recipe): number {
  return fatParts(recipe).reduce((sum, p) => sum + p.grams, 0);
}

/**
 * Lines that should count toward a nutrition estimate: everything with an
 * amount, except pantry water. "Secukupnya" lines have no amount and are
 * left out, so they never block an estimate (and never inflate one).
 */
function measuredLines(recipe: Recipe): IngLine[] {
  return recipe.ings.filter((l) => l[1] != null && !l[4]);
}

/** A line Racik can turn into grams and that has a full macro profile (FAT100 is the marker). */
function resolved(line: IngLine): boolean {
  if (!(edibleGrams(line) > 0)) return false;
  return FAT100[line[0]] != null || CANNED100[line[0]]?.L != null;
}

/** "Dihitung dari 9 dari 10 bahan": measured lines that the estimate could use. */
export function coverage(recipe: Recipe): { counted: number; total: number } {
  const lines = measuredLines(recipe);
  return { counted: lines.filter(resolved).length, total: lines.length };
}

/**
 * Kalori per porsi with the Atwater general factors: 4 kcal per gram of
 * protein, 4 per gram of carbohydrate, 9 per gram of fat (fibre is not
 * counted separately).
 *
 * Only when every measured line resolves: an estimate missing one ingredient
 * would quietly read low, so it is "belum bisa dihitung" instead (null).
 * A resolved line without a PROT100 or CARB100 entry contributes 0 of that
 * macro: those tables only omit ingredients where it is negligible (oil has
 * no protein, sugar no protein, meat no carbohydrate, herbs next to nothing).
 */
export function kcalPerPortion(recipe: Recipe): number | null {
  if (proteinUncertain(recipe)) return null;
  const lines = measuredLines(recipe);
  if (!lines.length || !lines.every(resolved)) return null;
  return 4 * proteinPerPortion(recipe) + 4 * carbPerPortion(recipe) + 9 * fatPerPortion(recipe);
}

export interface Nutrition {
  /** null = "belum bisa dihitung". Never 0 standing in for "unknown". */
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  fiber: number | null;
  coverage: { counted: number; total: number };
}

/**
 * Everything the nutrition block needs, per portion of the recipe as written
 * (independent of the portion stepper). A macro is null when the estimate is
 * not worth printing: the recipe is two guesses deep (proteinUncertain), or
 * no measured line has a value for it. Kalori follows the stricter rule in
 * kcalPerPortion.
 */
export function nutritionPerPortion(recipe: Recipe): Nutrition {
  const cov = coverage(recipe);
  if (proteinUncertain(recipe)) {
    return { kcal: null, protein: null, carb: null, fat: null, fiber: null, coverage: cov };
  }
  const known = (n: Nutrient) => measuredLines(recipe).some((l) => per100(l, n) != null && edibleGrams(l) > 0);
  const sum = (n: Nutrient) => (known(n) ? nutrientParts(recipe, n).reduce((a, p) => a + p.grams, 0) : null);
  return {
    kcal: kcalPerPortion(recipe),
    protein: sum("P"),
    carb: sum("C"),
    fat: sum("L"),
    fiber: sum("F"),
    coverage: cov,
  };
}

/** "420 kkal": to the nearest 10 from 100 kcal, nearest 5 below. Null under 5 kcal. */
export function fmtKcal(kcal: number): string | null {
  if (kcal < 5) return null;
  const step = kcal >= 100 ? 10 : 5;
  return `${Math.round(kcal / step) * step} kkal`;
}

/** Grams to a short label: "< 10 g to the nearest half, >= 10 g whole, nothing below 0.5 g." */
export function fmtGrams(grams: number): string | null {
  if (grams < 0.5) return null;
  if (grams < 10) {
    const half = Math.round(grams * 2) / 2;
    return `${String(half).replace(".", ",")} g`;
  }
  return `${Math.round(grams)} g`;
}

/**
 * Two guesses stacked on top of each other — an assumed portion count and a
 * partial ingredient list — is not an estimate worth printing.
 */
export function proteinUncertain(recipe: Recipe): boolean {
  return recipe.incomplete === true && (recipe as Recipe & { servAssumed?: boolean }).servAssumed === true;
}

/** "< 10 g to the nearest half, >= 10 g as a whole number, nothing below 1 g." */
export function fmtProtein(grams: number): string | null {
  if (grams < 1) return null;
  if (grams < 10) {
    const half = Math.round(grams * 2) / 2;
    return `${String(half).replace(".", ",")} g`;
  }
  return `${Math.round(grams)} g`;
}
