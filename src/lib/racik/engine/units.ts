import { BERAT, ING } from "../data";
import type { IngLine, Unit } from "../types";

export const COUNTABLE: Unit[] = [
  "siung",
  "buah",
  "butir",
  "ruas",
  "batang",
  "lembar",
  "ikat",
  "papan",
  "potong",
  "ekor",
  "bungkus",
  "piring",
  "gelas",
  "kaleng",
  "kotak",
  "sachet",
  "kuntum",
  "kantong",
];

/**
 * The only place a unit is resolved. Slot 5 overrides the ontology unit for
 * this line — cakes write flour in grams even though the ontology says sdm.
 */
export function unitOf(line: IngLine): Unit {
  return (line[5] as Unit | null) ?? ING[line[0]]?.unit ?? "buah";
}

export function isCountable(unit: Unit): boolean {
  return COUNTABLE.includes(unit);
}

/**
 * Grams for a quantity of one ingredient in a given unit (santan counted as
 * 1 g per ml). 0 when Racik cannot weigh it — never a guess.
 */
export function gramsFor(id: string, qty: number, u: Unit): number {
  if (u === "gram" || u === "ml") return qty;
  // A spoon override on something the ontology counts another way (a sdm of
  // chopped herbs, a sdt of lemon juice): weigh the spoon, not the bunch.
  const own = ING[id]?.unit;
  if ((u === "sdm" || u === "sdt") && own !== "sdm" && own !== "sdt") return qty * (u === "sdm" ? 15 : 5);
  const per = BERAT[id];
  if (per == null) return 0;
  // A teaspoon of something the ontology measures in tablespoons, or back.
  if (u === "sdt" && own === "sdm") return (qty * per) / 3;
  if (u === "sdm" && own === "sdt") return qty * per * 3;
  return qty * per;
}

/** Resolves a line to grams (santan counted as 1 g per ml). 0 when unknown. */
export function gramsOfLine(line: IngLine): number {
  const qty = line[1];
  if (qty == null) return 0;
  return gramsFor(line[0], qty, unitOf(line));
}

/** Pourable things whose spoonful reads better in ml than in grams. */
const LIQUID = /^(air|minyak|cuka|kecap|sirup|santan|susu_cair|susu_evaporasi|kaldu_.*cair|anggur_masak|mirin|sake_masak|vanila_cair|jus_)/;

export function isLiquid(id: string): boolean {
  return LIQUID.test(id);
}
