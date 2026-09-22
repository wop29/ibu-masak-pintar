import { ING } from "../data";
import type { IngLine, Recipe } from "../types";
import { roundQty } from "./format";
import { unitOf } from "./units";

const FORCED_SEASONINGS = new Set([
  "garam",
  "gula_pasir",
  "gula_merah",
  "merica",
  "minyak_goreng",
]);

export function isSeasoning(id: string): boolean {
  return ING[id]?.cat === "bumbu" || FORCED_SEASONINGS.has(id);
}

/**
 * Aromatics do not scale with volume. Tripling a rendang triples the beef but
 * not the chillies. Baking is chemistry, so it stays linear.
 */
export function scaleFactor(id: string, ratio: number, recipe: Recipe): number {
  if (recipe.precise) return ratio;
  if (!isSeasoning(id)) return ratio;
  if (ratio < 1) return ratio ** 0.6;
  return ratio ** 0.75;
}

export function ratioFor(recipe: Recipe, servings: number): number {
  return servings / recipe.serv;
}

/** Unrounded scaled quantity. */
export function rawQty(line: IngLine, recipe: Recipe, servings: number): number {
  const qty = line[1];
  if (qty == null) return 0;
  return qty * scaleFactor(line[0], ratioFor(recipe, servings), recipe);
}

/** Rounded, display-ready quantity. */
export function scaledQty(line: IngLine, recipe: Recipe, servings: number): number | null {
  if (line[1] == null) return null;
  return roundQty(rawQty(line, recipe, servings), unitOf(line));
}

/** Whole animals that cannot be cut down any further. */
export function undividable(recipe: Recipe, servings: number): IngLine[] {
  return recipe.ings.filter(
    (l) =>
      unitOf(l) === "ekor" &&
      rawQty(l, recipe, servings) < 0.7 &&
      scaledQty(l, recipe, servings) === 1,
  );
}
