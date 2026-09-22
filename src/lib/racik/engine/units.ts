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

/** Resolves a line to grams (santan counted as 1 g per ml). 0 when unknown. */
export function gramsOfLine(line: IngLine): number {
  const qty = line[1];
  if (qty == null) return 0;
  const u = unitOf(line);
  if (u === "gram" || u === "ml") return qty;
  const per = BERAT[line[0]];
  if (per == null) return 0;
  return qty * per;
}
