export type Cat = "bumbu" | "sayur" | "daging" | "sembako" | "lain";
export type HalalFlag = "halal" | "cert";

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
  | "kantong";

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
}

/** Same shape as a shipped recipe, plus where it came from. */
export interface ImportedRecipe extends Recipe {
  sourceUrl: string;
  importedAt: number;
  /** Named in the video but absent from the ontology. Never dropped. */
  unmatched: string[];
  /** The video never said the portion count, so serv is Racik's assumption. */
  servAssumed: boolean;
}

export type SatuanMode = "rumah" | "gram";
