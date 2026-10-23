import { ING } from "../data";
import { normalise } from "../engine/search";
import { matchIngredient, parseUnit } from "../import-normalise";
import type { IngLine, Step } from "../types";

/**
 * What a cook types on one ingredient line, turned into the engine's format.
 *
 * "250 gram daging sapi, potong dadu" → ["daging_sapi", 250, "potong dadu", …].
 * The name is resolved against the ontology with the same matcher the video
 * import uses, so a written recipe and an imported one scale the same way. A
 * line Racik does not recognise is kept word for word, never dropped, and the
 * engine leaves its quantity alone.
 */
export interface ParsedLine {
  raw: string;
  /** Ontology id, or null when Racik does not know this ingredient. */
  id: string | null;
  qty: number | null;
  unit: string | null;
  name: string;
  prep: string | null;
  /** "secukupnya", "sejumput", or no number at all. */
  toTaste: boolean;
  /** Engine line. Unknown ingredients use the "_" id and keep the raw text in slot 2. */
  line: IngLine;
}

/** The id the database rows use for a line Racik could not resolve. */
export const UNMATCHED_ID = "_";

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};
const WORD_QTY: Record<string, number> = {
  setengah: 0.5,
  seperempat: 0.25,
  sepertiga: 1 / 3,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  sebuah: 1,
  sebutir: 1,
  sesiung: 1,
  selembar: 1,
  sebatang: 1,
  seruas: 1,
  segenggam: 1,
};
/** A "se-" word carries its own unit: "sesiung bawang putih" is 1 siung. */
const WORD_UNIT: Record<string, string> = {
  sebutir: "butir",
  sesiung: "siung",
  selembar: "lembar",
  sebatang: "batang",
  seruas: "ruas",
};
const TO_TASTE = /\b(secukupnya|sejumput|sedikit|seperlunya|scukupnya|sckp)\b/i;

/** "1,5" "1.5" "1/2" "1 1/2" "½" "1½" "2-3" → a number (ranges take the larger). */
export function parseQty(text: string): { qty: number; rest: string } | null {
  const t = text.trim();
  const m = t.match(
    /^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?(?:\s+(\d+)\s*\/\s*(\d+)|\s*\/\s*(\d+))?(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?(?=\s|$|[a-zA-Z])/,
  );
  if (!m || (!m[1] && !m[2])) {
    const word = t.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (word in WORD_QTY) {
      const unit = WORD_UNIT[word];
      return {
        qty: WORD_QTY[word]!,
        rest: `${unit ? `${unit} ` : ""}${t.slice(word.length)}`.trim(),
      };
    }
    return null;
  }
  let qty = m[1] ? Number(m[1].replace(",", ".")) : 0;
  if (m[2]) qty += FRACTIONS[m[2]] ?? 0;
  if (m[3] && m[4]) qty += Number(m[3]) / Number(m[4]);
  if (m[5]) qty = Number(m[1] ?? 1) / Number(m[5]);
  if (m[6]) qty = Math.max(qty, Number(m[6].replace(",", ".")));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return { qty: Math.round(qty * 1000) / 1000, rest: t.slice(m[0].length).trim() };
}

/** Longest unit phrase at the start of `text`: "sendok makan", then single words. */
function takeUnit(
  text: string,
): { unit: string; factorUnit: ReturnType<typeof parseUnit>; rest: string } | null {
  const words = text.split(/\s+/);
  for (const n of [2, 1]) {
    if (words.length < n) continue;
    const phrase = words.slice(0, n).join(" ").replace(/[.,]$/, "");
    const parsed = parseUnit(phrase);
    // A two-word phrase only counts when both words are a unit ("sendok teh"),
    // not "sendok" followed by an ingredient.
    if (parsed && (n === 1 || /^sendok (makan|teh)$/i.test(phrase))) {
      return { unit: phrase.toLowerCase(), factorUnit: parsed, rest: words.slice(n).join(" ") };
    }
  }
  return null;
}

/**
 * The import matcher, then the ontology id itself: a cook writes "telur" for
 * the ingredient whose display name is "Telur ayam" and whose id is `telur`.
 */
function resolve(name: string): string | null {
  const hit = matchIngredient(name);
  if (hit) return hit;
  const asId = normalise(name).replace(/ /g, "_");
  return ING[asId] ? asId : null;
}

export function parseIngredientLine(rawInput: string): ParsedLine | null {
  const raw = rawInput
    .replace(/^\s*[-•*·]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return null;
  const toTaste = TO_TASTE.test(raw);
  let body = raw.replace(TO_TASTE, " ").replace(/\s+/g, " ").trim();

  // Split preparation: "daging sapi, potong dadu" / "bawang merah (haluskan)".
  let prep: string | null = null;
  const paren = body.match(/\(([^)]+)\)/);
  if (paren) {
    prep = paren[1]!.trim();
    body = body.replace(paren[0], " ").replace(/\s+/g, " ").trim();
  }
  // A comma between two digits ("1,5 kg") is a decimal, not a split.
  const comma = body.search(/(?<!\d),|,(?!\d)/);
  if (comma > 0) {
    const after = body.slice(comma + 1).trim();
    prep = [after, prep].filter(Boolean).join(", ") || null;
    body = body.slice(0, comma).trim();
  }

  let qty: number | null = null;
  let unitText: string | null = null;
  let name = body;
  const lead = parseQty(body);
  if (lead) {
    qty = lead.qty;
    const unit = takeUnit(lead.rest);
    if (unit) {
      unitText = unit.unit;
      name = unit.rest;
    } else {
      name = lead.rest;
    }
  } else {
    // "garam 1 sdt", "daging sapi 500 gram"
    const tail = body.match(/^(.*?)\s+(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*([a-zA-Z ]{0,14})$/);
    if (tail && tail[1]) {
      const q = parseQty(tail[2]!);
      const unit = tail[3]?.trim() ? takeUnit(tail[3].trim()) : null;
      if (q && (!tail[3]?.trim() || (unit && !unit.rest))) {
        qty = q.qty;
        unitText = unit?.unit ?? null;
        name = tail[1];
      }
    }
  }
  name = name.replace(/^(of|dari)\s+/i, "").trim();
  if (toTaste) qty = null;

  const id = name ? resolve(name) : null;
  if (!id) {
    return {
      raw,
      id: null,
      qty,
      unit: unitText,
      name: name || raw,
      prep,
      toTaste,
      line: [UNMATCHED_ID, null, raw, null, null, null],
    };
  }
  const parsed = parseUnit(unitText);
  const scaled = qty == null ? null : Math.round(qty * (parsed?.factor ?? 1) * 1000) / 1000;
  const override = parsed && parsed.unit !== ING[id]?.unit ? parsed.unit : null;
  return {
    raw,
    id,
    qty: scaled,
    unit: parsed?.unit ?? null,
    name,
    prep,
    toTaste,
    line: [id, scaled, prep, null, null, override],
  };
}

/**
 * Seconds a step asks the cook to wait, read from the text: "rebus 20 menit",
 * "masak selama 1 jam", "diamkan 30 detik". Null when the step names none.
 * Only the last duration counts: "aduk 2 menit lalu masak 15 menit" is 15.
 */
export function stepSeconds(text: string): number | null {
  const re = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(jam|menit|mnt|detik)\b/gi;
  let found: number | null = null;
  for (const m of text.matchAll(re)) {
    const n = Number((m[2] ?? m[1]!).replace(",", "."));
    const unit = m[3]!.toLowerCase();
    found = Math.round(unit === "jam" ? n * 3600 : unit === "detik" ? n : n * 60);
  }
  return found && found > 0 && found <= 24 * 3600 ? found : null;
}

export function parseSteps(lines: string[]): Step[] {
  return lines
    .map((text) =>
      text
        .replace(/^\s*\d+[.)]\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .map((text) => [text, stepSeconds(text)]);
}
