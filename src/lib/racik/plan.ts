import { ING } from "./data";
import { fmtQty, scaledQty, unitOf } from "./engine";
import type { Recipe } from "./types";

export interface ShoppingItem { key: string; id: string; name: string; qty: number | null; unit: string; recipes: string[]; cat: string }

export function shoppingList(plan: { recipe: Recipe; servings: number }[]): ShoppingItem[] {
  const rows = new Map<string, ShoppingItem>();
  for (const { recipe, servings } of plan) {
    for (const line of recipe.ings.filter((x) => !x[4])) {
      const ingredient = ING[line[0]];
      if (!ingredient) continue;
      const unit = unitOf(line);
      const key = `${line[0]}|${unit}`;
      const qty = scaledQty(line, recipe, servings);
      const existing = rows.get(key);
      if (existing) {
        existing.qty = existing.qty == null || qty == null ? null : existing.qty + qty;
        if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
      } else rows.set(key, { key, id: line[0], name: ingredient.name, qty, unit, recipes: [recipe.title], cat: ingredient.cat });
    }
  }
  return [...rows.values()];
}

export function shoppingText(items: ShoppingItem[]) {
  return items.map((item) => `☐ ${item.qty == null ? "secukupnya" : `${fmtQty(item.qty)} ${item.unit}`} ${item.name}`).join("\n");
}