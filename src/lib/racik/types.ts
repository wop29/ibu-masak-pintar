export type Cat = "bumbu" | "sayur" | "daging" | "sembako" | "lain";
export type HalalFlag = "halal" | "cert" | "haram";

export type Unit =
  | "gram"
  | "ml"
  | "sdm"
  | "sdt"
  | "siung"
  | "buah"
  | "butir"
  | "ruas"
  | "batang"
  | "lembar"
  | "ikat"
  | "papan"
  | "potong"
  | "ekor"
  | "bungkus"
  | "piring"
  | "gelas"
  | "kuntum"
  | "kantong"
  | "kaleng"
  | "kotak"
  | "sachet";

export interface Ingredient {
  id: string;
  name: string;
  cat: Cat;
  halal: HalalFlag;
  unit: Unit;
  staple: 0 | 1;
  aliases: string[];
  em: string;
}

export interface Region {
  id: string;
  name: string;
  desc: string;
}

/** [ingredientId, qty|null, prep|null, fallback|null, hidden|null, unitOverride|null] */
export type IngLine = [
  string,
  number | null,
  string | null,
  string | null,
  number | null,
  string | null,
];

/** [text, seconds|null] */
export type Step = [string, number | null];

export type Slot =
  | "sarapan"
  | "makan_siang"
  | "makan_malam"
  | "lauk"
  | "sayur"
  | "sambal"
  | "camilan"
  | "pendamping"
  | "jajan"
  | "minuman"
  | "kue";

export interface Recipe {
  id: string;
  title: string;
  region: string;
  slots: Slot[];
  serv: number;
  time: number;
  diff: "gampang" | "sedang" | "agak ribet";
  spice: 0 | 1 | 2 | 3 | 4;
  glyph: string;
  photoUrl?: string | null;
  note: string;
  ings: IngLine[];
  steps: Step[];
  precise: boolean;
  leftover?: string;
  imported: boolean;
  /** The method names a bumbu whose contents the video never showed. Not cookable as saved. */
  incomplete?: boolean;
  creator?: string;
  alat?: string[];
  suhu?: string;
  hasil?: string;
  satuan?: string;
  timbang?: boolean;
  /** Shelf group for the Western recipes (e.g. "Pasta", "Sarapan"). */
  kategori?: string;
  /**
   * Work that must start well before cooking and is not part of `time`, e.g.
   * "Rendam kedelai semalaman." Shown up front; never a cook-mode countdown.
   */
  persiapan?: string;
}

/** Same shape as a shipped recipe, plus where it came from. */
export interface ImportedRecipe extends Recipe {
  sourceUrl: string;
  importedAt: number;
  /** Named in the video but absent from the ontology. Never dropped. */
  unmatched: string[];
  /** The video never said the portion count, so serv is Racik's assumption. */
  servAssumed: boolean;
  /** serv is Racik's estimate from the ingredient amounts, not the fixed default. */
  servEstimated?: boolean;
  /** Language the source was in (e.g. "Inggris", "Tagalog") when not Bahasa Indonesia. */
  bahasaAsal?: string | null;
  /**
   * Local swaps the importer suggested for ingredients that are hard to find
   * where the person lives, keyed by ingredient id (or by the unmatched line's text).
   */
  swaps?: Record<string, string>;
}

export type SatuanMode = "rumah" | "gram";
