import ingredientsRaw from "@/data/ingredients.json";
import recipesRaw from "@/data/recipes.json";
import regionsRaw from "@/data/regions.json";
import tablesRaw from "@/data/tables.json";
import type { Ingredient, Recipe, Region } from "./types";

export const INGREDIENTS = ingredientsRaw as Ingredient[];
export const RECIPES = recipesRaw as unknown as Recipe[];
/** Region id of the public-domain Western recipes. They live on their own shelf and in search, not on the Nusantara shelves or the home suggestions. */
export const BARAT = "barat";
export const NUSANTARA = RECIPES.filter((r) => r.region !== BARAT);
export const WESTERN = RECIPES.filter((r) => r.region === BARAT);
export const REGIONS = regionsRaw as Region[];

export const ING: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export const REG: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

const tables = tablesRaw as unknown as {
  TAKAR: Record<string, [number, string]>;
  BERAT: Record<string, number>;
  PROT100: Record<string, number>;
  CARB100: Record<string, number>;
  FIBER100: Record<string, number>;
  FAT100: Record<string, number>;
  EDIBLE: Record<string, number>;
  CANNED100: Record<string, { P: number; C: number; F: number; L?: number }>;
  SUBS: Record<string, string>;
  SUBS_LN: Record<string, string>;
  ALAT: Record<string, string>;
  CREATORS: Record<string, { handle: string; name: string; stats: string }>;
};

export const TAKAR = tables.TAKAR;
export const BERAT = tables.BERAT;
export const PROT100 = tables.PROT100;
export const CARB100 = tables.CARB100;
export const FIBER100 = tables.FIBER100;
/**
 * Grams of fat (lemak) per 100 g of the edible part. Sources per id in
 * src/data/fat-sources.json (USDA FoodData Central SR Legacy and TKPI);
 * built by scripts/build-fat.py. Also the marker that an ingredient has a
 * full macro profile: kalori is only computed for lines that have it.
 */
export const FAT100 = tables.FAT100;
/** Share of the bought weight that is eaten (bone, shell, head and skin removed). Missing = 1. */
export const EDIBLE = tables.EDIBLE;
/** Per-100 g values for legumes bought canned or cooked, not dry. */
export const CANNED100 = tables.CANNED100;
export const SUBS = tables.SUBS;
export const SUBS_LN = tables.SUBS_LN;
export const ALAT = tables.ALAT;
export const CREATORS = tables.CREATORS;

export const byId = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);

/** Shipped recipes and imported ones answer to the same lookup. */
export const findRecipe = (id: string, imported: Recipe[] = []): Recipe | undefined =>
  byId(id) ?? imported.find((r) => r.id === id);

export const SLOT_LABEL: Record<string, string> = {
  sarapan: "Sarapan",
  makan_siang: "Makan siang",
  makan_malam: "Makan malam",
  lauk: "Lauk",
  sayur: "Sayur",
  sambal: "Sambal",
  camilan: "Camilan",
  pendamping: "Pendamping",
  jajan: "Jajan",
  minuman: "Minuman",
  kue: "Kue",
};
