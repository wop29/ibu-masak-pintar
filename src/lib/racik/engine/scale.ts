import { ING } from "../data";
import type { IngLine, Recipe } from "../types";
import { roundQty, splitFor } from "./format";
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

/**
 * Display-ready quantity. At the recipe's own portion count this is the
 * authored amount, untouched: ¼ sdt stays ¼ sdt and 165 g stays 165 g.
 * Rounding only happens once the cook has scaled the recipe.
 */
export function scaledQty(line: IngLine, recipe: Recipe, servings: number): number | null {
  if (line[1] == null) return null;
  if (servings === recipe.serv) return line[1];
  return roundQty(rawQty(line, recipe, servings), unitOf(line), line[0], recipe.precise, isSeasoning(line[0]));
}

/**
 * Lines that had to be rounded up to one whole piece because they cannot be
 * split: a whole chicken, a fish, an egg. Shown as "Tidak bisa dibagi lebih kecil".
 * Seasonings and things that can be halved (½ papan tempe, ¼ gelas beras) never appear.
 */
export function undividable(recipe: Recipe, servings: number): IngLine[] {
  if (servings >= recipe.serv) return [];
  return recipe.ings.filter((l) => {
    if (l[1] == null || isSeasoning(l[0])) return false;
    const unit = unitOf(l);
    if (unit !== "ekor" && unit !== "butir" && unit !== "potong") return false;
    if (splitFor(unit, l[0]) === "whole" && unit !== "potong") return false;
    return rawQty(l, recipe, servings) < 0.7 && scaledQty(l, recipe, servings) === 1;
  });
}
