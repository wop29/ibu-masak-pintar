import { CANNED100, CARB100, EDIBLE, FIBER100, PROT100 } from "../data";
import type { IngLine, Recipe } from "../types";
import { gramsOfLine, unitOf } from "./units";

/** Sold by weight with the bone still in. Everything else bought by weight is taken as trimmed. */
const BONE_IN_BY_WEIGHT = new Set(["iga_sapi", "buntut_sapi"]);

export interface ProteinPart {
  id: string;
  grams: number;
}

type Nutrient = "P" | "C" | "F";
const TABLE: Record<Nutrient, Record<string, number>> = { P: PROT100, C: CARB100, F: FIBER100 };

/** "kalengan, tiriskan dan bilas", "matang": the beans are already cooked. */
const COOKED = /kalengan|kaleng|tiriskan|matang/;

/**
 * Per-100 g value for this line. Canned or cooked legumes use their cooked
 * figures — 250 g of drained chickpeas is not 250 g of dry chickpeas.
 */
function per100(line: IngLine, n: Nutrient): number | undefined {
  const canned = CANNED100[line[0]];
  if (canned && COOKED.test(line[2] ?? "")) return canned[n];
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
