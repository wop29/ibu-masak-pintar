import { findRecipe, ING } from "./data";
import { PLAN_MAX, type RacikState } from "./store";
import { scaledQty, unitOf } from "./engine";
import type { Negara } from "./locale";
import { buyHint, fmtNeed, mergeNeeds, shopName, type Need } from "./shopping";
import type { Recipe, Unit } from "./types";

export interface ShoppingItem {
  key: string;
  id: string;
  /** Racik's name, with the local name after a dot in MY/PH ("Terasi · belacan"). */
  name: string;
  qty: number | null;
  unit: Unit;
  /** The need as printed: "4 siung", "350 g", "1,25 kg", "2 kutsara". */
  qtyText: string;
  /** One recipe also said "secukupnya" for this ingredient. */
  plusTaste: boolean;
  /** What to ask for at the market, or null when the need is already buyable. */
  buy: string | null;
  /** A pantry good usually already in the kitchen (garam, gula, minyak, merica). */
  staple: boolean;
  recipes: string[];
  cat: string;
}

/**
 * One row per ingredient wherever the units can be reconciled: amounts are
 * converted to one unit before they are added (2 siung + 10 g bawang putih =
 * 4 siung; 100 g + 0,25 kg = 350 g). Each row carries a buy hint rounded to
 * what the market sells in the person's country.
 */
export function shoppingList(plan: { recipe: Recipe; servings: number }[], negara: Negara = "ID"): ShoppingItem[] {
  const needs = new Map<string, Need[]>();
  for (const { recipe, servings } of plan) {
    // A recipe with an uncaptured bumbu would make the list wrong, so it is left out.
    if (recipe.incomplete) continue;
    for (const line of recipe.ings.filter((x) => !x[4])) {
      if (!ING[line[0]]) continue;
      const list = needs.get(line[0]) ?? [];
      list.push({ qty: scaledQty(line, recipe, servings), unit: unitOf(line), recipe: recipe.title });
      needs.set(line[0], list);
    }
  }
  const items: ShoppingItem[] = [];
  for (const [id, list] of needs) {
    const ingredient = ING[id]!;
    for (const row of mergeNeeds(id, list)) {
      items.push({
        key: `${id}|${row.unit}`,
        id,
        name: shopName(id, negara),
        qty: row.qty,
        unit: row.unit,
        qtyText: fmtNeed(row.qty, row.unit, negara),
        plusTaste: row.plusTaste,
        buy: buyHint(id, row.qty, row.unit, negara),
        // Only pantry goods: fresh staples like tauge or telur still need buying.
        staple: ingredient.staple === 1 && (ingredient.cat === "sembako" || ingredient.cat === "lain" || row.unit === "sdt" || row.unit === "sdm"),
        recipes: row.recipes,
        cat: ingredient.cat,
      });
    }
  }
  return items;
}

export function shoppingText(items: ShoppingItem[]) {
  return items
    .map((item) => {
      const need = `${item.qtyText}${item.plusTaste ? " (+ secukupnya)" : ""}`;
      return `☐ ${need} ${item.name}${item.buy ? ` — beli: ${item.buy}` : ""}`;
    })
    .join("\n");
}
/* ---- keeping the plan honest ---- */

/** Plan entries that point at a recipe that still exists (shipped or imported). */
export function resolvedPlan(state: Pick<RacikState, "plan" | "imported">): { recipe: Recipe; servings: number }[] {
  return state.plan
    .map((p) => {
      const recipe = findRecipe(p.id, state.imported);
      return recipe ? { recipe, servings: p.servings } : null;
    })
    .filter((x): x is { recipe: Recipe; servings: number } => x != null);
}

/** Use this, not `plan.length >= 3`, to decide "Rencana sudah penuh". */
export function planIsFull(state: Pick<RacikState, "plan" | "imported">): boolean {
  return resolvedPlan(state).length >= PLAN_MAX;
}

/** Ticked shopping items that still belong to a recipe in the plan. */
export function liveChecked(state: Pick<RacikState, "plan" | "imported" | "planChecked">): string[] {
  if (state.planChecked.length === 0) return state.planChecked;
  const keys = new Set(shoppingList(resolvedPlan(state)).map((i) => i.key));
  const kept = state.planChecked.filter((k) => keys.has(k));
  return kept.length === state.planChecked.length ? state.planChecked : kept;
}

/**
 * Remove everything that points at recipes which no longer exist.
 *
 * `removedImports` are imported recipes that were just deleted: they leave the
 * plan, favourites, servings, cook progress and photos. Without it, only plan
 * entries that resolve to nothing are dropped (a ghost slot made the plan look
 * full: "Rencana sudah penuh" with one recipe in it). Favourites are left
 * alone here because a saved id may be a community recipe this device has not
 * loaded yet.
 */
export function pruneDangling(state: RacikState, removedImports: string[] = []): RacikState {
  const gone = new Set(removedImports);
  const plan = state.plan.filter((p) => !gone.has(p.id) && findRecipe(p.id, state.imported) != null);
  const saved = gone.size ? state.saved.filter((id) => !gone.has(id)) : state.saved;
  const drop = <T,>(o: Record<string, T>): Record<string, T> =>
    gone.size && Object.keys(o).some((k) => gone.has(k)) ? Object.fromEntries(Object.entries(o).filter(([k]) => !gone.has(k))) : o;
  const planChanged = plan.length !== state.plan.length;
  const next: RacikState = {
    ...state,
    plan: planChanged ? plan : state.plan,
    saved: saved.length !== state.saved.length ? saved : state.saved,
    servings: drop(state.servings),
    cooking: drop(state.cooking),
    photos: drop(state.photos),
  };
  if (planChanged) next.planChecked = plan.length ? liveChecked(next) : [];
  const same = (["plan", "saved", "servings", "cooking", "photos", "planChecked"] as const).every((k) => next[k] === state[k]);
  return same ? state : next;
}
