import { INGREDIENTS, ING } from "./data";
import { normalise } from "./engine/search";
import type { ImportedRecipe, IngLine, Step, Unit } from "./types";

/**
 * Malay and Tagalog kitchen words the extractor sometimes leaves untranslated.
 * Only words with one clear meaning: bare "bawang" (garlic in Tagalog, any
 * allium in Indonesian), "suka" and "asin" are left out on purpose.
 */
const FOREIGN_NAMES: Record<string, string> = {
  // Malay
  "kicap manis": "kecap_manis",
  "kicap masin": "kecap_asin",
  belacan: "terasi",
  "cili padi": "cabai_rawit",
  "cili merah": "cabai_merah",
  "bawang besar": "bawang_bombay",
  "lada sulah": "merica",
  "buah keras": "kemiri",
  tauhu: "tahu",
  kubis: "kol",
  "ubi kentang": "kentang",
  "lobak merah": "wortel",
  "ikan bilis": "ikan_teri",
  "udang kering": "ebi",
  "gula melaka": "gula_merah",
  "tepung gandum": "tepung_terigu",
  "limau nipis": "jeruk_nipis",
  "limau kasturi": "jeruk_limau",
  "daun limau purut": "daun_jeruk",
  taugeh: "tauge",
  terung: "terong",
  // Tagalog / Filipino
  toyo: "kecap_asin",
  gata: "santan",
  sibuyas: "bawang_bombay",
  "sibuyas tagalog": "bawang_merah",
  luya: "jahe",
  "luyang dilaw": "kunyit",
  "siling labuyo": "cabai_rawit",
  kamatis: "tomat",
  tokwa: "tahu",
  kangkong: "kangkung",
  sitaw: "kacang_panjang",
  talong: "terong",
  itlog: "telur",
  manok: "ayam",
  asukal: "gula_pasir",
  paminta: "merica",
  mantika: "minyak_goreng",
  tanglad: "serai",
  sampalok: "asam_jawa",
  dilis: "ikan_teri",
  hipon: "udang",
  repolyo: "kol",
  patatas: "kentang",
  pipino: "timun",
  sayote: "labu_siam",
  kalamansi: "jeruk_limau",
  dayap: "jeruk_nipis",
  malunggay: "daun_kelor",
  bihon: "bihun",
  harina: "tepung_terigu",
  gawgaw: "tepung_maizena",
};

/** Every phrase that can name an ontology ingredient, longest first, names before aliases. */
const PHRASES: { phrase: string; id: string; canonical: boolean }[] = [
  ...INGREDIENTS.flatMap((ing) => [
    { phrase: normalise(ing.name), id: ing.id, canonical: true },
    ...ing.aliases.map((phrase) => ({ phrase: normalise(phrase), id: ing.id, canonical: false })),
  ]),
  ...Object.entries(FOREIGN_NAMES)
    .filter(([, id]) => ING[id])
    .map(([phrase, id]) => ({ phrase: normalise(phrase), id, canonical: false })),
]
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
const SERVING_HINT =
  /(paling enak (pakai|sama|dengan)|temen(nya|an)?\b|cocok (sama|dengan)|pelengkap|pendamping|disajikan|sajikan|untuk cocolan|buat cocolan)/i;

/**
 * A recipe whose method leans on a bumbu the video only showed on screen
 * cannot be cooked from what was captured. Say so instead of hiding the gap.
 */
const ON_SCREEN =
  /((hanya|cuma|sekadar)[^.]{0,40}(di|pada) ?(layar|video))|(ter)?tulis[a-z]* di (layar|video)|tampil[a-z]* di (layar|video)|tidak (terbaca|terlihat|tertulis|disebut)/i;
const BUMBU_COMPONENT =
  /bumbu\s+(ungkep|halus|hitam|dasar|marinasi|rendam|kuning|merah|rempah|racik)/gi;

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
  // Malay: "7 ketul ayam" is seven pieces; "2 tangkai daun kari" is two sprigs.
  ketul: { unit: "potong", factor: 1 },
  keping: { unit: "potong", factor: 1 },
  tangkai: { unit: "batang", factor: 1 },
  ikat: { unit: "ikat", factor: 1 },
  papan: { unit: "papan", factor: 1 },
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
  // Racik's gelas is a gelas belimbing (200 ml). A US cup and a tasa are
  // 240 ml, a Malaysian cawan 250 ml: convert, never relabel.
  cup: { unit: "gelas", factor: 1.2 },
  cups: { unit: "gelas", factor: 1.2 },
  tasa: { unit: "gelas", factor: 1.2 },
  tasang: { unit: "gelas", factor: 1.2 },
  cawan: { unit: "gelas", factor: 1.25 },
  cangkir: { unit: "gelas", factor: 1 },
  kuntum: { unit: "kuntum", factor: 1 },
  kantong: { unit: "kantong", factor: 1 },
  kaleng: { unit: "kaleng", factor: 1 },
  klg: { unit: "kaleng", factor: 1 },
  kotak: { unit: "kotak", factor: 1 },
  pak: { unit: "bungkus", factor: 1 },
  pack: { unit: "bungkus", factor: 1 },
  pcs: { unit: "buah", factor: 1 },
  btr: { unit: "butir", factor: 1 },
  btg: { unit: "batang", factor: 1 },
  ekr: { unit: "ekor", factor: 1 },
  kilo: { unit: "gram", factor: 1000 },
  // English, Malay and Tagalog measures.
  tbsp: { unit: "sdm", factor: 1 },
  tbs: { unit: "sdm", factor: 1 },
  tablespoon: { unit: "sdm", factor: 1 },
  tablespoons: { unit: "sdm", factor: 1 },
  "sudu besar": { unit: "sdm", factor: 1 },
  kutsara: { unit: "sdm", factor: 1 },
  kutsarang: { unit: "sdm", factor: 1 },
  tsp: { unit: "sdt", factor: 1 },
  teaspoon: { unit: "sdt", factor: 1 },
  teaspoons: { unit: "sdt", factor: 1 },
  "sudu kecil": { unit: "sdt", factor: 1 },
  "sudu teh": { unit: "sdt", factor: 1 },
  kutsarita: { unit: "sdt", factor: 1 },
  kutsaritang: { unit: "sdt", factor: 1 },
  oz: { unit: "gram", factor: 28.35 },
  ounce: { unit: "gram", factor: 28.35 },
  ounces: { unit: "gram", factor: 28.35 },
  lb: { unit: "gram", factor: 453.6 },
  lbs: { unit: "gram", factor: 453.6 },
  pound: { unit: "gram", factor: 453.6 },
  pounds: { unit: "gram", factor: 453.6 },
  kati: { unit: "gram", factor: 600 },
  tahil: { unit: "gram", factor: 37.8 },
  "fl oz": { unit: "ml", factor: 29.6 },
  litro: { unit: "ml", factor: 1000 },
  litre: { unit: "ml", factor: 1000 },
  liters: { unit: "ml", factor: 1000 },
  clove: { unit: "siung", factor: 1 },
  cloves: { unit: "siung", factor: 1 },
  ulas: { unit: "siung", factor: 1 },
  butil: { unit: "siung", factor: 1 },
  piece: { unit: "buah", factor: 1 },
  pieces: { unit: "buah", factor: 1 },
  pc: { unit: "buah", factor: 1 },
  piraso: { unit: "buah", factor: 1 },
  bunch: { unit: "ikat", factor: 1 },
  bunches: { unit: "ikat", factor: 1 },
  tali: { unit: "ikat", factor: 1 },
  leaf: { unit: "lembar", factor: 1 },
  leaves: { unit: "lembar", factor: 1 },
  dahon: { unit: "lembar", factor: 1 },
  stalk: { unit: "batang", factor: 1 },
  stalks: { unit: "batang", factor: 1 },
  tangkay: { unit: "batang", factor: 1 },
  can: { unit: "kaleng", factor: 1 },
  cans: { unit: "kaleng", factor: 1 },
  tin: { unit: "kaleng", factor: 1 },
  lata: { unit: "kaleng", factor: 1 },
  packet: { unit: "bungkus", factor: 1 },
  pakete: { unit: "bungkus", factor: 1 },
  inch: { unit: "ruas", factor: 1 },
  inches: { unit: "ruas", factor: 1 },
  inci: { unit: "ruas", factor: 1 },
};

/** Words that mean "no fixed amount". The line keeps its ingredient, without a quantity. */
const VAGUE = new Set([
  "secukupnya",
  "secukup nya",
  "sckp",
  "sesuai selera",
  "selera",
  "sedikit",
  "sejumput",
  "seujung sendok",
  "to taste",
  "pinch",
  "a pinch",
  "dash",
  "a dash",
  "as needed",
  "secubit",
  "secukup rasa",
  "kurot",
  "konti",
  "ayon sa panlasa",
]);

/**
 * Units whose first word is shared with a different, real unit ("sendok sayur"
 * is not a sdm; "sudu" alone is ambiguous; "fl" is only half of "fl oz").
 */
const NO_HEAD_FALLBACK = new Set(["sendok", "sudu", "fl"]);

export type ParsedUnit =
  | { kind: "none" }
  | { kind: "vague"; word: string }
  | { kind: "unit"; unit: Unit; factor: number }
  | { kind: "unknown"; word: string };

/**
 * What the model's unit text means. An unknown unit (genggam, panci, cm,
 * sendok sayur) is reported as unknown, never quietly swapped for the
 * ingredient's own unit: "2 genggam bayam" must not become "2 ikat bayam".
 */
export function readUnit(raw: string | null): ParsedUnit {
  if (!raw || !raw.trim()) return { kind: "none" };
  const text = normalise(raw);
  if (!text) return { kind: "none" };
  if (VAGUE.has(text)) return { kind: "vague", word: raw.trim() };
  const exact = UNIT_ALIAS[text];
  if (exact) return { kind: "unit", ...exact };
  const head = text.split(" ")[0] ?? "";
  // "sdm munjung", "gram (kurang lebih)": the head word is the unit.
  if (!NO_HEAD_FALLBACK.has(head) && UNIT_ALIAS[head])
    return { kind: "unit", ...UNIT_ALIAS[head]! };
  return { kind: "unknown", word: raw.trim() };
}

/** Known unit → Racik unit and factor; anything else → null. */
export function parseUnit(raw: string | null): { unit: Unit; factor: number } | null {
  const parsed = readUnit(raw);
  return parsed.kind === "unit" ? { unit: parsed.unit, factor: parsed.factor } : null;
}

export interface RawImported {
  title: string;
  creator: string | null;
  servings: number | null;
  /** Racik's estimate from the amounts (or plates seen) when the source never says. */
  servingsEstimate?: number | null | undefined;
  timeMinutes: number | null;
  difficulty: "gampang" | "sedang" | "agak ribet" | null;
  note: string | null;
  /** Source language in Indonesian ("Inggris", "Tagalog"); null for Bahasa Indonesia. */
  bahasaAsal?: string | null | undefined;
  ingredients: {
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
    /** A swap sold where the person lives, only for hard-to-find ingredients. */
    pengganti?: string | null | undefined;
  }[];
  steps: { text: string; seconds: number | null }[];
}

const DEFAULT_SERV = 4;
/** Racik's gelas: a gelas belimbing, 200 ml. */
const GELAS_ML = 200;
const SPICY = new Set(["cabai_rawit", "cabai_merah"]);

function writtenAs(item: RawImported["ingredients"][number]) {
  const qty = item.quantity == null ? "" : `${String(item.quantity).replace(".", ",")} `;
  return `${qty}${item.unit ? `${item.unit} ` : ""}${item.name}`.trim();
}

/**
 * An imported recipe has to be the same shape as a shipped one, or the portion
 * stepper, the protein estimate, the shopping list and cook mode all skip it.
 */
/**
 * A fitting food emoji for an imported recipe, so its tile reads as a dish
 * rather than a blank. Title first (most specific), then the main matched
 * ingredient, then a neutral plate.
 */
function pickGlyph(title: string, ings: IngLine[]): string {
  const t = ` ${title.toLowerCase()} `;
  const byTitle: [RegExp, string][] = [
    [/es |jus|teh|kopi|minuman|wedang|smoothie|boba/, "\u{1F964}"],
    [/bolu|kue|cake|brownies|puding|pudding|donat|roti|pancake|martabak manis/, "\u{1F9C1}"],
    [/sambal/, "\u{1F336}\uFE0F"],
    [/mie |\bmi |bakmi|ramen|pasta|spaghetti|spageti/, "\u{1F35C}"],
    [/soto|\bsop|\bsup|bakso|rawon|gulai|kari/, "\u{1F372}"],
    [/nasi|bubur/, "\u{1F35A}"],
    [/sate|satay/, "\u{1F362}"],
    [/ayam|chicken|bebek/, "\u{1F357}"],
    [/ikan|lele|nila|tuna|kembung|cakalang|fish/, "\u{1F41F}"],
    [/udang|cumi|kerang|seafood/, "\u{1F990}"],
    [/sapi|daging|rendang|beef|empal|semur|iga/, "\u{1F969}"],
    [/telur|telor|\begg/, "\u{1F95A}"],
    [/sayur|tumis|\bcah|capcay|urap|gado|lalap|lotek|pecel/, "\u{1F96C}"],
  ];
  for (const [re, em] of byTitle) if (re.test(t)) return em;
  const byIng: Record<string, string> = {
    ayam_utuh: "\u{1F357}",
    ayam: "\u{1F357}",
    ikan_kembung: "\u{1F41F}",
    ikan_cakalang: "\u{1F41F}",
    udang: "\u{1F990}",
    daging_sapi: "\u{1F969}",
    telur: "\u{1F95A}",
  };
  for (const line of ings) {
    const em = byIng[line[0]];
    if (em) return em;
  }
  return "\u{1F37D}\uFE0F";
}

/** Names Racik's dictionary does not know (for the missing-ingredient to-do list). Lines kept only for their unit are not included. */
export function unknownIngredientNames(raw: Pick<RawImported, "ingredients">): string[] {
  return raw.ingredients
    .filter(
      (item) =>
        !SERVING_HINT.test(`${item.name} ${item.preparation ?? ""}`) && !matchIngredient(item.name),
    )
    .map((item) => item.name.trim())
    .filter(Boolean);
}

export function normaliseImported(
  raw: RawImported,
  sourceUrl: string,
  id: string,
  photoUrl?: string,
): ImportedRecipe {
  const ings: IngLine[] = [];
  const unmatched: string[] = [];
  const serving: string[] = [];
  /** A named-twice ingredient (dish and acar) folds into one line; it is not unknown. */
  let merged = 0;
  /** Local swaps from the extractor, keyed by ingredient id or by the unmatched line as shown. */
  const swaps: Record<string, string> = {};
  const swapFor = (item: RawImported["ingredients"][number], key: string) => {
    const text = item.pengganti?.replace(/\s+/g, " ").trim();
    if (text && text.length <= 300 && !swaps[key]) swaps[key] = text;
  };

  for (const item of raw.ingredients) {
    if (SERVING_HINT.test(`${item.name} ${item.preparation ?? ""}`)) {
      serving.push(item.name.trim());
      continue;
    }
    const matchedId = matchIngredient(item.name);
    if (!matchedId) {
      unmatched.push(writtenAs(item));
      swapFor(item, writtenAs(item));
      continue;
    }
    const unitRead = readUnit(item.unit);
    const quantity =
      item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0
        ? item.quantity
        : null;
    // A quantity in a unit Racik does not know cannot be scaled honestly. Keep
    // the line exactly as written, as a plain text line that is not scaled.
    if (unitRead.kind === "unknown" && quantity != null) {
      unmatched.push(writtenAs(item));
      swapFor(item, writtenAs(item));
      continue;
    }
    let parsed = unitRead.kind === "unit" ? unitRead : null;
    // A cup of something poured (cream, milk, stock) reads better in ml than in
    // gelas belimbing: 1 cup = 1.2 gelas = 240 ml.
    if (parsed?.unit === "gelas" && ING[matchedId]?.unit === "ml")
      parsed = { kind: "unit", unit: "ml", factor: parsed.factor * GELAS_ML };
    const qty =
      quantity == null || unitRead.kind === "vague" ? null : quantity * (parsed?.factor ?? 1);
    const override = parsed && parsed.unit !== ING[matchedId]?.unit ? parsed.unit : null;
    const vagueNote =
      unitRead.kind === "vague" && !/^secukup|^sckp|selera/i.test(unitRead.word)
        ? unitRead.word
        : null;
    const prep =
      [vagueNote, item.preparation].filter((p): p is string => Boolean(p)).join(", ") || null;
    const existing = ings.find((line) => line[0] === matchedId);
    if (existing) {
      merged += 1;
      if (existing[1] == null && existing[5] == null) {
        existing[1] = qty;
        existing[5] = override;
      } else if (qty != null && existing[1] != null && existing[5] === override) {
        existing[1] += qty;
      } else if (qty != null) {
        // A second amount in another unit ("3 siung" and "1 sdt bubuk") is not
        // addable. Keep it visible as its own line instead of dropping it.
        unmatched.push(writtenAs(item));
        swapFor(item, writtenAs(item));
        merged -= 1;
        continue;
      }
      swapFor(item, matchedId);
      const preps = [existing[2], prep].filter((p): p is string => Boolean(p));
      existing[2] = preps.length ? [...new Set(preps)].join(", ") : null;
      continue;
    }
    ings.push([matchedId, qty, prep, null, null, override]);
    swapFor(item, matchedId);
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
      if (
        !(id && accounted.has(id)) &&
        !accounted.has(writtenAs(item)) &&
        !accounted.has(item.name.trim())
      ) {
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
    serv: raw.servings ?? raw.servingsEstimate ?? DEFAULT_SERV,
    servAssumed: raw.servings == null,
    ...(raw.servings == null && raw.servingsEstimate != null ? { servEstimated: true } : {}),
    time: raw.timeMinutes ?? (fromSteps > 0 ? Math.max(10, fromSteps) : 30),
    diff: raw.difficulty ?? "sedang",
    spice: spiceLines >= 2 ? 3 : spiceLines === 1 ? 2 : 0,
    glyph: pickGlyph(raw.title, ings),
    note: [
      raw.note ??
        "Resep ini disusun dari keterangan videonya. Periksa takarannya dengan video aslinya.",
      serving.length ? `Enak dimakan dengan ${serving.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

    ings,
    steps,
    precise: false,
    imported: true,
    ...(incomplete ? { incomplete: true } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    sourceUrl,
    importedAt: Date.now(),
    unmatched,
    ...(raw.creator ? { creator: raw.creator } : {}),
    ...(sourceLanguage(raw.bahasaAsal) ? { bahasaAsal: sourceLanguage(raw.bahasaAsal) } : {}),
    ...(Object.keys(swaps).length ? { swaps } : {}),
  };
}

/** "Inggris", "Tagalog"… Null for Indonesian or anything that is not a short language name. */
export function sourceLanguage(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text || text.length > 40) return null;
  if (/^(bahasa )?indonesia$/i.test(text) || /^(id|indonesian|bahasa)$/i.test(text)) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
