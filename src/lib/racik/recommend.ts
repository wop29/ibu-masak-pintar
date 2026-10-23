import { passesHalalMode, proteinPerPortion } from "./engine";
import { INGREDIENTS } from "./data";
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
    .filter((r) => passesHalalMode(r, state.halalMode))
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
  // "≤ 30 menit", the same rule as the Eksplor shelf.
  if (filter === "cepat") return recipe.time <= 30;
  if (filter === "gampang") return recipe.diff === "gampang";
  if (filter === "protein") return proteinPerPortion(recipe) >= 15;
  if (filter === "banyak") return Boolean(recipe.leftover);
  // Not spicy and not fussy: the closest honest proxy the data has for "anak suka".
  if (filter === "anak") return recipe.spice === 0 && recipe.diff !== "agak ribet";
  return true;
}
const SEAFOOD = ["udang", "udang_galah", "ebi", "cumi", "cumi_asin", "kepiting", "kerang_hijau", "kerang_dara", "tiram", "gurita", "lobster", "belut", "cakalang_fufu", "tuna_kaleng", "sarden"];
const existing = (ids: string[]) => ids.filter((id) => INGREDIENTS.some((i) => i.id === id));

/** Ingredient ids behind each onboarding protein choice. Built from the ontology, so a fish added later counts. */
export const PROTEIN_IDS: Record<string, string[]> = {
  ayam: existing(["ayam", "ayam_utuh", "hati_ayam", "ampela", "ceker", "kalkun"]),
  ikan: [...INGREDIENTS.filter((i) => i.id.startsWith("ikan_")).map((i) => i.id), ...existing(SEAFOOD)],
  telur: existing(["telur", "telur_puyuh", "telur_bebek", "telur_asin"]),
  tahu_tempe: existing(["tahu", "tahu_sutra", "tempe", "tempe_gembus", "oncom"]),
  daging: existing(["daging_sapi", "daging_kambing", "daging_giling", "iga_sapi", "buntut_sapi", "babat"]),
  sayur: [],
};

/** Moves recipes that use a protein she cooks often to the front, keeping the order otherwise. */
export function preferProteins(recipes: Recipe[], proteins: string[]): Recipe[] {
  if (!proteins.length) return recipes;
  const ids = new Set(proteins.flatMap((p) => PROTEIN_IDS[p] ?? []));
  const wantsSayur = proteins.includes("sayur");
  const hit = (r: Recipe) => r.ings.some((l) => ids.has(l[0])) || (wantsSayur && r.slots.includes("sayur"));
  return [...recipes.filter(hit), ...recipes.filter((r) => !hit(r))];
}
