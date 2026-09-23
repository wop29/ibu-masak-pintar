import { PROT100 } from "../data";
import type { Recipe } from "../types";
import { gramsOfLine } from "./units";

export interface ProteinPart {
  id: string;
  grams: number;
}

/**
 * Computed from the recipe's base quantities so the number does not wobble
 * when the portion stepper moves.
 */
export function proteinParts(recipe: Recipe): ProteinPart[] {
  return recipe.ings
    .map((l) => {
      const per = PROT100[l[0]];
      if (per == null) return null;
      const grams = (gramsOfLine(l) * per) / 100 / recipe.serv;
      if (grams <= 0) return null;
      return { id: l[0], grams };
    })
    .filter((p): p is ProteinPart => p !== null)
    .sort((a, b) => b.grams - a.grams);
}

export function proteinPerPortion(recipe: Recipe): number {
  return proteinParts(recipe).reduce((sum, p) => sum + p.grams, 0);
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
