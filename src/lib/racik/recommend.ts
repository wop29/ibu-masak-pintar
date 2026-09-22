import { analyseHalal, proteinPerPortion } from "./engine";
import type { Recipe, Slot } from "./types";
import type { RacikState } from "./store";

export function currentSlot(hour: number): Slot {
  if (hour < 10) return "sarapan";
  if (hour < 15) return "makan_siang";
  return "makan_malam";
}

function jitter(id: string, seed: number) {
  let value = seed;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) % 997;
  return value % 15;
}

export function suggest(recipes: Recipe[], state: RacikState, hour: number) {
  const slot = currentSlot(hour);
  return recipes
    .filter((r) => !r.precise && !r.slots.includes("pendamping") && !state.disliked.includes(r.id))
    .filter((r) => !state.halalMode || analyseHalal(r).status === "halal")
    .map((recipe) => {
      const cooked = state.log.some((l) => l.id === recipe.id);
      const recency = cooked ? 0 : 55;
      const time = Math.max(0, 28 - Math.round(recipe.time / 8));
      const slotScore = recipe.slots.includes(slot) ? 17 : 0;
      return { recipe, score: recency + time + slotScore + jitter(recipe.id, state.suggestionSeed) };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.recipe);
}

export function matchesFilter(recipe: Recipe, filter: string) {
  if (filter === "cepat") return recipe.time < 30;
  if (filter === "gampang") return recipe.diff === "gampang";
  if (filter === "protein") return proteinPerPortion(recipe) >= 15;
  if (filter === "banyak") return Boolean(recipe.leftover);
  if (filter === "anak") return recipe.spice === 0;
  return true;
}