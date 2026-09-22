import { TAKAR } from "../data";
import type { SatuanMode, Unit } from "../types";
import { isCountable } from "./units";

export function roundQty(v: number, unit: Unit): number {
  if (unit === "gram") {
    return v >= 100 ? Math.round(v / 25) * 25 : Math.max(5, Math.round(v / 5) * 5);
  }
  if (unit === "ml") {
    if (v >= 500) return Math.round(v / 100) * 100;
    if (v >= 200) return Math.round(v / 50) * 50;
    return Math.max(10, Math.round(v / 10) * 10);
  }
  if (isCountable(unit)) {
    return Math.max(1, Math.ceil(v - 0.15));
  }
  return Math.max(0.5, Math.round(v * 2) / 2);
}

const FRACTION: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

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

/** "± 4 gelas belimbing". Silent unless the unit is gram or ml. */
export function takaran(
  id: string,
  qty: number,
  unit: Unit,
  satuan: SatuanMode = "rumah",
): string | null {
  if (satuan !== "rumah") return null;
  if (unit !== "gram" && unit !== "ml") return null;
  const entry = TAKAR[id];
  if (!entry) return null;
  const [per, label] = entry;
  const value = Math.round((qty / per) * 2) / 2;
  if (value < 0.5) return null;
  return `± ${fmtQty(value)} ${label}`;
}

export function fmtTime(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
}

export function fmtSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} jam` : `${h} jam ${rest} menit`;
}
