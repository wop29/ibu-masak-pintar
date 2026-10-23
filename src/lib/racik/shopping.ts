import { BERAT, ING } from "./data";
import { fmtQty, roundQty } from "./engine/format";
import { gramsFor, isCountable, isLiquid } from "./engine/units";
import { localName, unitWord, type Negara } from "./locale";
import type { Unit } from "./types";

/**
 * Shopping-list arithmetic, kept pure so it can be tested per country.
 *
 * 1. Merge: amounts of one ingredient are added only after they are in the
 *    same unit. Mixed units (2 siung + 10 g) meet in grams (ml for liquids)
 *    and come back out in the ingredient's own countable unit when Racik
 *    knows its weight, so the list says "4 siung", not "20 g".
 * 2. Buy: a separate hint rounds the need to what a market actually sells
 *    in that country (1 ons / ¼ kg in Indonesia, 250 g and kati in Malaysia,
 *    tingi, ¼ kilo and tali in the Philippines).
 */

export interface Need {
  qty: number | null;
  unit: Unit;
  recipe: string;
}

export interface MergedRow {
  id: string;
  qty: number | null;
  unit: Unit;
  /** One recipe said "secukupnya" for this ingredient as well as an amount. */
  plusTaste: boolean;
  recipes: string[];
}

const uniq = (xs: string[]) => [...new Set(xs)];

/** Round a merged gram or ml total to what a kitchen scale or jug shows. */
function roundMetric(v: number): number {
  if (v < 10) return Math.max(1, Math.round(v));
  if (v < 250) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}

export function mergeNeeds(id: string, needs: Need[]): MergedRow[] {
  const numeric = needs.filter((n) => n.qty != null);
  const taste = needs.filter((n) => n.qty == null);
  const own = ING[id]?.unit ?? needs[0]?.unit ?? "buah";
  if (!numeric.length) {
    return [{ id, qty: null, unit: needs[0]?.unit ?? own, plusTaste: false, recipes: uniq(needs.map((n) => n.recipe)) }];
  }

  // Sum within each unit first.
  const byUnit = new Map<Unit, { qty: number; recipes: string[] }>();
  for (const n of numeric) {
    const g = byUnit.get(n.unit) ?? { qty: 0, recipes: [] };
    g.qty += n.qty!;
    g.recipes.push(n.recipe);
    byUnit.set(n.unit, g);
  }

  const rows: MergedRow[] = [];
  if (byUnit.size === 1) {
    const [unit, g] = [...byUnit.entries()][0]!;
    rows.push({ id, qty: g.qty, unit, plusTaste: false, recipes: uniq(g.recipes) });
  } else {
    // Different units: meet in grams wherever Racik can weigh both sides.
    let grams = 0;
    const merged: string[] = [];
    const units: Unit[] = [];
    for (const [unit, g] of byUnit) {
      const w = gramsFor(id, g.qty, unit);
      if (w > 0) {
        grams += w;
        merged.push(...g.recipes);
        units.push(unit);
      } else {
        rows.push({ id, qty: g.qty, unit, plusTaste: false, recipes: uniq(g.recipes) });
      }
    }
    if (units.length === 1) {
      // Only one convertible group: keep it in its own unit.
      const unit = units[0]!;
      rows.unshift({ id, qty: byUnit.get(unit)!.qty, unit, plusTaste: false, recipes: uniq(merged) });
    } else if (units.length > 1) {
      const per = BERAT[id];
      if (isCountable(own) && per) {
        rows.unshift({ id, qty: roundQty(grams / per, own, id), unit: own, plusTaste: false, recipes: uniq(merged) });
      } else {
        rows.unshift({ id, qty: roundMetric(grams), unit: isLiquid(id) ? "ml" : "gram", plusTaste: false, recipes: uniq(merged) });
      }
    }
  }
  if (taste.length) {
    rows[0]!.plusTaste = true;
    rows[0]!.recipes = uniq([...rows[0]!.recipes, ...taste.map((n) => n.recipe)]);
  }
  return rows;
}

/** "350 g", "1,25 kg", "750 ml", "1,5 liter", "4 siung", "2 kutsara". */
export function fmtNeed(qty: number | null, unit: Unit, negara: Negara = "ID"): string {
  if (qty == null) return "secukupnya";
  if (unit === "gram" || unit === "ml") {
    const big = unit === "gram" ? "kg" : "liter";
    if (qty >= 1000) return `${String(Math.round(qty / 10) / 100).replace(".", ",")} ${big}`;
    return `${Math.round(qty)} ${unit === "gram" ? "g" : "ml"}`;
  }
  return `${fmtQty(qty)} ${unitWord(unit, negara)}`;
}

/** "Terasi · belacan" in Malaysia, plain "Terasi" in Indonesia. */
export function shopName(id: string, negara: Negara = "ID"): string {
  const name = ING[id]?.name ?? id;
  const local = localName(id, negara);
  return local && local.toLowerCase() !== name.toLowerCase() ? `${name} · ${local}` : name;
}

const CONDIMENT = /^(kecap|saus|cuka|minyak|santan|kaldu|terasi|asam_jawa)/;
/** Units that are bought as whole packs or pieces: ½ ikat still means buying 1 ikat. */
const WHOLE_BUY: Unit[] = ["ikat", "papan", "buah", "kaleng", "bungkus", "batang", "kotak", "sachet", "butir", "ekor", "potong", "kantong"];
const FRESH = new Set(["daging", "sayur", "bumbu"]);
/** Herbs counted per batang in recipes but sold as an ikat (about 6 stalks). */
const BUNCHED = new Set(["daun_bawang", "seledri", "daun_ketumbar", "kemangi"]);

/** Fresh things bought by weight even when the recipe counts them. */
function boughtByWeight(id: string, unit: Unit): boolean {
  const cat = ING[id]?.cat;
  if (!cat || !FRESH.has(cat) || isLiquid(id)) return false;
  if (unit === "gram") return true;
  if (!BERAT[id]) return false;
  if (unit === "siung" || unit === "ruas") return true;
  if (unit === "buah" && id.startsWith("cabai")) return true;
  if (unit === "potong" && /^(ayam|daging|ikan|iga|bebek)/.test(id)) return true;
  return false;
}

function quarters(v: number) {
  return Math.ceil(v * 4 - 1e-9) / 4;
}

/** What to ask for at the market, by weight. */
export function buyByWeight(grams: number, negara: Negara): string {
  if (negara === "MY") {
    let buy: number;
    if (grams <= 100) buy = 100;
    else if (grams <= 250) buy = 250;
    else if (grams <= 500) buy = 500;
    else if (grams <= 1000) buy = 1000;
    else buy = Math.ceil(grams / 500) * 500;
    const label = buy >= 1000 ? `${String(buy / 1000).replace(".", ",")} kg` : `${buy} g`;
    if (buy < 300) return label;
    const kati = Math.round((buy / 600) * 4) / 4;
    return `${label} (± ${fmtQty(kati)} kati)`;
  }
  if (negara === "PH") {
    if (grams < 60) return "tingi (eceran)";
    return `${fmtQty(quarters(grams / 1000))} kilo`;
  }
  if (grams < 40) return "beli eceran";
  if (grams <= 100) return "1 ons";
  return `${fmtQty(quarters(grams / 1000))} kg`;
}

/**
 * The "Beli:" hint for one merged row, or null when the need is already a
 * buyable amount (3 butir telur, 2 ikat bayam).
 */
export function buyHint(id: string, qty: number | null, unit: Unit, negara: Negara = "ID"): string | null {
  if (qty == null || qty <= 0) return null;
  const cat = ING[id]?.cat;

  if (CONDIMENT.test(id)) {
    const amount = gramsFor(id, qty, unit) || (unit === "sdm" ? qty * 15 : unit === "sdt" ? qty * 5 : 0);
    if (!amount) return null;
    if (negara === "PH") {
      if (amount <= 100) return "1 sachet (tingi)";
      // Gata comes in 400 ml cans/packs when it is not squeezed fresh at the palengke.
      return id === "santan" ? `${Math.ceil(amount / 400)} lata (400 ml)` : null;
    }
    if (id === "santan") {
      if (amount <= 65) return "1 bungkus kecil (65 ml)";
      const boxes = Math.ceil(amount / 200);
      return `${boxes} kotak (200 ml)`;
    }
    return null;
  }

  if (boughtByWeight(id, unit)) {
    const grams = gramsFor(id, qty, unit);
    if (grams > 0) return buyByWeight(grams, negara);
  }

  // Small dry spices in the Philippines come in sachets.
  if (negara === "PH" && cat === "bumbu" && (unit === "sdt" || unit === "sdm")) return "1 sachet (tingi)";

  // Spring onion and celery are counted by the stalk but sold by the bunch.
  if (unit === "batang" && BUNCHED.has(id)) {
    const bunches = Math.max(1, Math.ceil(qty / 6 - 1e-9));
    return `${bunches} ${unitWord("ikat", negara)}`;
  }

  if (WHOLE_BUY.includes(unit)) {
    const whole = Math.ceil(qty - 1e-9);
    if (whole !== qty) return `${whole} ${unitWord(unit, negara)}`;
    // Leafy bundles keep their count but read as "tali" in the Philippines.
    return null;
  }
  return null;
}
