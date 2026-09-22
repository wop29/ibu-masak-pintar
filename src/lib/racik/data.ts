import ingredientsRaw from "@/data/ingredients.json";
import recipesRaw from "@/data/recipes.json";
import regionsRaw from "@/data/regions.json";
import tablesRaw from "@/data/tables.json";
import type { Ingredient, Recipe, Region } from "./types";

export const INGREDIENTS = ingredientsRaw as Ingredient[];
export const RECIPES = recipesRaw as unknown as Recipe[];
export const REGIONS = regionsRaw as Region[];

export const ING: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export const REG: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

const tables = tablesRaw as {
  TAKAR: Record<string, [number, string]>;
  BERAT: Record<string, number>;
  PROT100: Record<string, number>;
  SUBS: Record<string, string>;
  SUBS_LN: Record<string, string>;
  ALAT: Record<string, string>;
  CREATORS: Record<string, { handle: string; name: string; stats: string }>;
};

export const TAKAR = tables.TAKAR;
export const BERAT = tables.BERAT;
export const PROT100 = tables.PROT100;
export const SUBS = tables.SUBS;
export const SUBS_LN = tables.SUBS_LN;
export const ALAT = tables.ALAT;
export const CREATORS = tables.CREATORS;

export const byId = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);

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

export const SPICE_WORD = [
  "tidak pedas",
  "sedikit pedas",
  "agak pedas",
  "pedas",
  "pedas sekali",
] as const;
