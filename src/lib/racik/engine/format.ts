import { TAKAR } from "../data";
import type { SatuanMode, Unit } from "../types";
import { gramsFor, isCountable, isLiquid } from "./units";
import { NEGARA, unitWord, type Negara } from "../locale";
import { t } from "@/lib/racik/i18n";

/**
 * How finely a scaled countable may be split.
 *  - quarter: things you measure out of a larger pack (¼ gelas beras, ¼ papan tempe, ¼ ikat bayam)
 *  - half:    things you cut and keep the rest of (½ bawang bombay, ½ kaleng, ½ bungkus mie)
 *  - whole:   things nobody halves (a clove, a leaf, a chilli, a cracker)
 *  - ceil:    things that cannot be split at all (an egg, a whole fish) — round up, never down far
 */
export type Split = "quarter" | "half" | "whole" | "ceil";

const QUARTER_UNITS: Unit[] = ["gelas", "papan", "ikat"];
const HALF_UNITS: Unit[] = ["buah", "kaleng", "bungkus", "batang", "ruas", "kotak", "piring", "sachet"];
const CEIL_UNITS: Unit[] = ["butir", "ekor"];

/** Counted by the piece even though the unit is "buah": halving one makes no sense. */
const WHOLE_IDS = new Set([
  "cabai_rawit", "cabai_merah", "cabai_hijau", "cabai_kering", "cabai_jalapeno", "cabai_habanero",
  "cabai_chipotle", "cabai_kering_meksiko", "bunga_lawang", "bunga_telang", "belimbing_wuluh",
  "kerupuk_udang", "kerupuk_putih", "kerupuk_kulit", "bakso", "bakso_ikan", "nugget", "nugget_ikan",
  "siomay_ikan", "otak_otak", "pempek", "roti_burger", "roti_hotdog", "english_muffin", "pita_bread",
  "marshmallow", "kurma", "leci", "duku", "rambutan", "manggis", "salak", "tiram", "hati_ayam",
  "ampela", "ceker", "sosis", "kaldu_blok", "jeruk_limau", "markisa", "jambu_air", "gherkin",
]);

export function splitFor(unit: Unit, id?: string, seasoning = false): Split {
  if (id && WHOLE_IDS.has(id)) return "whole";
  if (QUARTER_UNITS.includes(unit)) return "quarter";
  if (HALF_UNITS.includes(unit)) return "half";
  // Kemiri, cengkeh and kapulaga are counted in butir but are seasoning: the nearest whole one.
  if (CEIL_UNITS.includes(unit)) return seasoning ? "whole" : "ceil";
  return "whole";
}

/**
 * Display rounding for a SCALED quantity. Never applied at the recipe's own
 * portion count — the authored amount is shown as written there.
 */
export function roundQty(v: number, unit: Unit, id?: string, precise = false, seasoning = false): number {
  if (unit === "gram") {
    if (precise) return v < 20 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5;
    if (v < 10) return Math.max(1, Math.round(v));
    if (v < 250) return Math.round(v / 5) * 5;
    if (v < 1000) return Math.round(v / 10) * 10;
    return Math.round(v / 50) * 50;
  }
  if (unit === "ml") {
    if (v < 20) return Math.max(precise ? 1 : 5, Math.round(v / (precise ? 1 : 5)) * (precise ? 1 : 5));
    if (v < 100) return Math.round(v / 5) * 5;
    if (v < 500) return Math.round(v / 10) * 10;
    return Math.round(v / 50) * 50;
  }
  if (isCountable(unit)) {
    switch (splitFor(unit, id, seasoning)) {
      case "quarter":
        if (v >= 2) return Math.round(v * 2) / 2;
        return Math.max(0.25, Math.round(v * 4) / 4);
      case "half":
        if (v >= 4) return Math.round(v);
        return Math.max(0.5, Math.round(v * 2) / 2);
      case "ceil":
        // 1.2 eggs is one egg; 1.3 is two. Nobody cracks a third of an egg.
        return Math.max(1, Math.ceil(v - 0.25));
      default:
        return Math.max(1, Math.round(v));
    }
  }
  // sdm, sdt: quarters, which the display draws as ¼ and ¾.
  if (v >= 4) return Math.round(v * 2) / 2;
  return Math.max(0.25, Math.round(v * 4) / 4);
}

const FRACTION: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾", "0.33": "⅓", "0.67": "⅔" };

/** Halves and quarters as glyphs, everything else with a comma decimal. */
export function fmtQty(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 100) / 100;
  const glyph = FRACTION[String(frac)];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  if (frac === 0) return String(whole);
  return String(rounded).replace(".", ",");
}

/** "40 g", "1,2 kg", "15 ml". Rounded to what a kitchen scale shows. */
export function fmtWeight(value: number, liquid = false): string {
  const u = liquid ? "ml" : "g";
  if (value >= 1000) return `${String(Math.round(value / 100) / 10).replace(".", ",")} ${liquid ? "liter" : "kg"}`;
  let r: number;
  if (value < 10) r = Math.max(1, Math.round(value));
  else if (value < 100) r = Math.round(value / 5) * 5;
  else r = Math.round(value / 10) * 10;
  return `${r} ${u}`;
}

/** The weight of a household quantity, or null when Racik cannot weigh it. */
export function weightLabel(id: string, qty: number, unit: Unit): string | null {
  if (unit === "gram" || unit === "ml") return null;
  let grams = gramsFor(id, qty, unit);
  // A spoon of something without a table weight still has a volume.
  if (!grams && (unit === "sdm" || unit === "sdt")) grams = qty * (unit === "sdm" ? 15 : 5);
  if (!grams || grams < 0.5) return null;
  return fmtWeight(grams, isLiquid(id) && (unit === "sdm" || unit === "sdt" || unit === "gelas"));
}

/** Quarters: the display draws ¼, ½ and ¾. */
const quarter = (v: number) => Math.round(v * 4) / 4;

/**
 * A household measure for a gram/ml line, in the person's country.
 *  - cup lines ("gelas belimbing" in TAKAR) are recomputed from millilitres
 *    with the country's cup: gelas belimbing 200 ml, cawan 250 ml, tasa 240 ml.
 *  - weight lines ("ons") become ons (ID), kati of 600 g (MY, from 150 g) or
 *    kilo (PH, from 125 g); below that the gram amount already says it.
 *  - a handful is "genggam" (ID, MY) or "dakot" (PH).
 */
function householdHint(id: string, qty: number, negara: Negara): string | null {
  const entry = TAKAR[id];
  if (!entry) return null;
  const [per, label] = entry;
  const count = qty / per;
  if (label === "gelas belimbing") {
    const cup = NEGARA[negara].cup;
    const value = quarter((count * 200) / cup.ml);
    return value < 0.25 ? null : `± ${fmtQty(value)} ${cup.label}`;
  }
  if (label === "ons") {
    const grams = count * 100;
    if (negara === "MY") return grams >= 150 ? `± ${fmtQty(quarter(grams / 600))} kati` : null;
    if (negara === "PH") return grams >= 125 ? `± ${fmtQty(quarter(grams / 1000))} kilo` : null;
  }
  // Quarters, not halves. Rounding 1.25 ons up to 1½ overstates the meat by
  // 20%, and the display already knows how to draw ¼ and ¾.
  const value = quarter(count);
  if (value < 0.25) return null;
  if (label.startsWith("genggam")) return `± ${fmtQty(value)} ${label.replace("genggam", NEGARA[negara].handful)}`;
  // Other labels ("kol sedang", "butir kelapa") are Indonesian words; Malay
  // readers share them, Filipino readers would not.
  if (negara === "PH" && label !== "ons") return null;
  return `± ${fmtQty(value)} ${label}`;
}

/**
 * The hint printed after the quantity.
 *  - rumah: "± 4 gelas belimbing" for gram/ml lines that have a household measure.
 *  - gram:  "± 40 g" for household units (siung, sdm, buah, ikat…) that Racik can weigh.
 */
export function takaran(
  id: string,
  qty: number,
  unit: Unit,
  satuan: SatuanMode = "rumah",
  negara: Negara = "ID",
): string | null {
  if (satuan === "gram") {
    const w = weightLabel(id, qty, unit);
    return w ? `± ${w}` : null;
  }
  if (unit !== "gram" && unit !== "ml") return null;
  return householdHint(id, qty, negara);
}

/**
 * Everything a list row needs to print a quantity, honouring the satuan
 * setting and the country. In gram mode the weight leads and the household
 * amount follows: "40 g" + "(5 siung)". Lines Racik cannot weigh stay in
 * their own unit. Outside Indonesia the unit word is local ("2 sudu besar",
 * "2 kutsara") and a "gelas" (gelas belimbing, 200 ml) is recounted in the
 * local cup: "2 gelas" beras → "1½ cawan" (± 400 ml).
 */
export function qtyDisplay(
  id: string,
  qty: number | null,
  unit: Unit,
  satuan: SatuanMode = "rumah",
  negara: Negara = "ID",
): { main: string; hint: string | null } {
  if (qty == null) return { main: "secukupnya", hint: null };
  const own = `${fmtQty(qty)} ${unitWord(unit, negara)}`;
  if (satuan === "gram") {
    const w = weightLabel(id, qty, unit);
    if (w) return { main: w, hint: `(${own})` };
    return { main: own, hint: null };
  }
  if (unit === "gelas" && negara !== "ID") {
    const cup = NEGARA[negara].cup;
    const value = Math.max(0.25, quarter((qty * 200) / cup.ml));
    return { main: `${fmtQty(value)} ${cup.label}`, hint: `(± ${Math.round(qty * 200)} ml)` };
  }
  return { main: own, hint: takaran(id, qty, unit, "rumah", negara) };
}

export function fmtTime(minutes: number): string {
  if (minutes < 60) return t("fmt_min", { minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t("fmt_h", { h }) : t("fmt_h_min", { h, m });
}

export function fmtSeconds(seconds: number): string {
  if (seconds < 60) return t("fmt_sec", { seconds });
  const m = Math.round(seconds / 60);
  if (m < 60) return t("fmt_minutes", { m });
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? t("fmt_h", { h }) : t("fmt_h_minutes", { h, rest });
}
