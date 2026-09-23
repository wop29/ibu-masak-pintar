import { INGREDIENTS, ING } from "./data";
import { normalise } from "./engine/search";
import type { ImportedRecipe, IngLine, Step, Unit } from "./types";

/** Every phrase that can name an ontology ingredient, longest first, names before aliases. */
const PHRASES: { phrase: string; id: string; canonical: boolean }[] = INGREDIENTS.flatMap((ing) => [
  { phrase: normalise(ing.name), id: ing.id, canonical: true },
  ...ing.aliases.map((phrase) => ({ phrase: normalise(phrase), id: ing.id, canonical: false })),
])
  .filter((entry) => entry.phrase.length > 2)
  .sort((a, b) => b.phrase.length - a.phrase.length || Number(b.canonical) - Number(a.canonical));

/** Canonical names handed to the extractor so it speaks the ontology's words. */
export const ONTOLOGY_NAMES: string[] = INGREDIENTS.map((ing) => ing.name);

/**
 * A bare head word names a family, not an ingredient. Only the readings a
 * home cook means by default are listed; anything ambiguous stays unmatched.
 */
const HEAD_DEFAULTS: Record<string, string> = {
  gula: "gula_pasir",
  tepung: "tepung_terigu",
  kecap: "kecap_manis",
  santan: "santan",
};

/**
 * The model never supplies an id. Names are resolved here against the
 * ontology, so an imported line either is a real ingredient or is surfaced
 * to the reader as unmatched.
 */
export function matchIngredient(raw: string): string | null {
  const exact = normalise(raw);
  // An exact name beats a longer phrase that merely contains this one.
  for (const { phrase, id, canonical } of PHRASES) {
    if (canonical && phrase === exact) return id;
  }
  for (const { phrase, id } of PHRASES) {
    if (phrase === exact) return id;
  }
  const text = ` ${exact} `;
  for (const { phrase, id } of PHRASES) {
    if (text.includes(` ${phrase} `)) return id;
  }
  const head = HEAD_DEFAULTS[exact] ?? HEAD_DEFAULTS[exact.split(" ")[0] ?? ""];
  if (head && ING[head]) return head;
  return null;
}

/** Things a dish is eaten with are not things it is cooked with. */
const SERVING_HINT = /(paling enak (pakai|sama|dengan)|temen(nya|an)?\b|cocok (sama|dengan)|pelengkap|pendamping|disajikan|sajikan|untuk cocolan|buat cocolan)/i;



/**
 * A recipe whose method leans on a bumbu the video only showed on screen
 * cannot be cooked from what was captured. Say so instead of hiding the gap.
 */
const ON_SCREEN =
  /((hanya|cuma|sekadar)[^.]{0,40}(di|pada) ?(layar|video))|(ter)?tulis[a-z]* di (layar|video)|tampil[a-z]* di (layar|video)|tidak (terbaca|terlihat|tertulis|disebut)/i;
const BUMBU_COMPONENT = /bumbu\s+(ungkep|halus|hitam|dasar|marinasi|rendam|kuning|merah|rempah|racik)/gi;

function namesBumbuWithoutContents(ings: IngLine[], steps: Step[]): boolean {
  const preps = normalise(ings.map((line) => line[2] ?? "").join(" "));
  const method = steps.map((step) => step[0]).join(" . ");
  for (const match of method.matchAll(BUMBU_COMPONENT)) {
    const word = normalise(match[1] ?? "").slice(0, 5);
    if (word && !preps.includes(word)) return true;
  }
  return false;
}

const UNIT_ALIAS: Record<string, { unit: Unit; factor: number }> = {
  gram: { unit: "gram", factor: 1 },
  gr: { unit: "gram", factor: 1 },
  g: { unit: "gram", factor: 1 },
  ons: { unit: "gram", factor: 100 },
  kg: { unit: "gram", factor: 1000 },
  kilogram: { unit: "gram", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  mililiter: { unit: "ml", factor: 1 },
  cc: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  liter: { unit: "ml", factor: 1000 },
  sdm: { unit: "sdm", factor: 1 },
  "sendok makan": { unit: "sdm", factor: 1 },
  sendok: { unit: "sdm", factor: 1 },
  sdt: { unit: "sdt", factor: 1 },
  "sendok teh": { unit: "sdt", factor: 1 },
  siung: { unit: "siung", factor: 1 },
  buah: { unit: "buah", factor: 1 },
  biji: { unit: "buah", factor: 1 },
  bh: { unit: "buah", factor: 1 },
  butir: { unit: "butir", factor: 1 },
  ruas: { unit: "ruas", factor: 1 },
  batang: { unit: "batang", factor: 1 },
  lembar: { unit: "lembar", factor: 1 },
  lbr: { unit: "lembar", factor: 1 },
  helai: { unit: "lembar", factor: 1 },
  ikat: { unit: "ikat", factor: 1 },
  papan: { unit: "papan", factor: 1 },
  kotak: { unit: "papan", factor: 1 },
  potong: { unit: "potong", factor: 1 },
  ptg: { unit: "potong", factor: 1 },
  ekor: { unit: "ekor", factor: 1 },
  bungkus: { unit: "bungkus", factor: 1 },
  bks: { unit: "bungkus", factor: 1 },
  sachet: { unit: "bungkus", factor: 1 },
  saset: { unit: "bungkus", factor: 1 },
  piring: { unit: "piring", factor: 1 },
  gelas: { unit: "gelas", factor: 1 },
  gls: { unit: "gelas", factor: 1 },
  cup: { unit: "gelas", factor: 1 },
  kuntum: { unit: "kuntum", factor: 1 },
  kantong: { unit: "kantong", factor: 1 },
};

export function parseUnit(raw: string | null): { unit: Unit; factor: number } | null {
  if (!raw) return null;
  const text = normalise(raw);
  return UNIT_ALIAS[text] ?? UNIT_ALIAS[text.split(" ")[0] ?? ""] ?? null;
}

export interface RawImported {
  title: string;
  creator: string | null;
  servings: number | null;
  timeMinutes: number | null;
  difficulty: "gampang" | "sedang" | "agak ribet" | null;
  note: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null; preparation: string | null }[];
  steps: { text: string; seconds: number | null }[];
}

const DEFAULT_SERV = 4;
const SPICY = new Set(["cabai_rawit", "cabai_merah"]);

function writtenAs(item: RawImported["ingredients"][number]) {
  const qty = item.quantity == null ? "" : `${String(item.quantity).replace(".", ",")} `;
  return `${qty}${item.unit ? `${item.unit} ` : ""}${item.name}`.trim();
}

/**
 * An imported recipe has to be the same shape as a shipped one, or the portion
 * stepper, the protein estimate, the shopping list and cook mode all skip it.
 */
export function normaliseImported(raw: RawImported, sourceUrl: string, id: string): ImportedRecipe {
  const ings: IngLine[] = [];
  const unmatched: string[] = [];
  const serving: string[] = [];
  /** A named-twice ingredient (dish and acar) folds into one line; it is not unknown. */
  let merged = 0;

  for (const item of raw.ingredients) {
    if (SERVING_HINT.test(`${item.name} ${item.preparation ?? ""}`)) {
      serving.push(item.name.trim());
      continue;
    }
    const matchedId = matchIngredient(item.name);
    if (!matchedId) {
      unmatched.push(writtenAs(item));
      continue;
    }
    const parsed = parseUnit(item.unit);
    const qty = item.quantity == null ? null : item.quantity * (parsed?.factor ?? 1);
    const override = parsed && parsed.unit !== ING[matchedId]?.unit ? parsed.unit : null;
    const existing = ings.find((line) => line[0] === matchedId);
    if (existing) {
      merged += 1;
      if (existing[1] == null) {
        existing[1] = qty;
        existing[5] = override;
      } else if (qty != null && existing[5] === override) {
        existing[1] += qty;
      }
      const preps = [existing[2], item.preparation].filter((prep): prep is string => Boolean(prep));
      existing[2] = preps.length ? [...new Set(preps)].join(", ") : null;
      continue;
    }
    ings.push([matchedId, qty, item.preparation, null, null, override]);
  }

  // Invariant: every line the model returned is either a recipe ingredient, a
  // serving suggestion in the note, or shown as unmatched. Nothing is dropped.
  if (ings.length + merged + unmatched.length + serving.length !== raw.ingredients.length) {
    console.error(
      `[racik] import lost ingredients: model ${raw.ingredients.length}, ings ${ings.length}, merged ${merged}, unmatched ${unmatched.length}, sajian ${serving.length}`,
      raw.ingredients.map((item) => item.name),
    );
    const accounted = new Set([...ings.map((line) => line[0]), ...unmatched, ...serving]);
    for (const item of raw.ingredients) {
      const id = matchIngredient(item.name);
      if (!(id && accounted.has(id)) && !accounted.has(writtenAs(item)) && !accounted.has(item.name.trim())) {
        unmatched.push(writtenAs(item));
      }
    }
  }


  const steps: Step[] = raw.steps.map((step) => [step.text, step.seconds]);
  const fromSteps = Math.round(raw.steps.reduce((sum, s) => sum + (s.seconds ?? 0), 0) / 60);
  const spiceLines = ings.filter((line) => SPICY.has(line[0])).length;
  const incomplete = ON_SCREEN.test(raw.note ?? "") || namesBumbuWithoutContents(ings, steps);


  return {
    id,
    title: raw.title,
    region: "impor",
    slots: ["lauk"],
    serv: raw.servings ?? DEFAULT_SERV,
    servAssumed: raw.servings == null,
    time: raw.timeMinutes ?? (fromSteps > 0 ? Math.max(10, fromSteps) : 30),
    diff: raw.difficulty ?? "sedang",
    spice: spiceLines >= 2 ? 3 : spiceLines === 1 ? 2 : 0,
    glyph: "🍳",
    note: [
      raw.note ?? "Resep ini disusun dari keterangan videonya. Periksa takarannya dengan video aslinya.",
      serving.length ? `Enak dimakan dengan ${serving.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

    ings,
    steps,
    precise: false,
    imported: true,
    ...(incomplete ? { incomplete: true } : {}),
    sourceUrl,
    importedAt: Date.now(),
    unmatched,
    ...(raw.creator ? { creator: raw.creator } : {}),
  };
}
