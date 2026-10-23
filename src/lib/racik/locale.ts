import locale from "@/data/locale.json";
import type { Unit } from "./types";

/**
 * The country layer. Racik's recipe text stays in Bahasa Indonesia; the
 * country changes the measure words, the household-measure hints, local
 * ingredient names, local swaps and how the shopping list rounds to what can
 * actually be bought there.
 */
export type Negara = "ID" | "MY" | "PH";
export const NEGARA_LIST: Negara[] = ["ID", "MY", "PH"];

interface NegaraMeta {
  name: string;
  flag: string;
  /** The everyday measuring cup: gelas belimbing 200 ml, cawan 250 ml, tasa 240 ml. */
  cup: { label: string; ml: number };
  handful: string;
}

const DATA = locale as unknown as {
  negara: Record<Negara, NegaraMeta>;
  units: Partial<Record<Negara, Partial<Record<Unit, string>>>>;
  names: Partial<Record<Negara, Record<string, string>>>;
  subs: Partial<Record<Negara, Record<string, string>>>;
};

export const NEGARA: Record<Negara, NegaraMeta> = DATA.negara;

export function isNegara(v: unknown): v is Negara {
  return v === "ID" || v === "MY" || v === "PH";
}

/** "sdm" → "sudu besar" (MY) / "kutsara" (PH). Indonesia keeps Racik's own words. */
export function unitWord(unit: Unit, negara: Negara = "ID"): string {
  return DATA.units[negara]?.[unit] ?? unit;
}

/** The name people in that country use, when it differs: belacan, bagoong alamang. */
export function localName(id: string, negara: Negara = "ID"): string | null {
  if (negara === "ID") return null;
  return DATA.names[negara]?.[id] ?? null;
}

/** A swap for an ingredient that is hard to find in that country. */
export function localSub(id: string, negara: Negara = "ID"): string | null {
  if (negara === "ID") return null;
  return DATA.subs[negara]?.[id] ?? null;
}

/* ---------------- detection ---------------- */

/** Cloudflare's country for this visitor, set as a cookie by src/server.ts. */
export const COUNTRY_COOKIE = "racik_cc";

const FROM_COUNTRY: Record<string, Negara> = { ID: "ID", MY: "MY", PH: "PH", SG: "MY", BN: "MY", TL: "ID" };

const FROM_TIMEZONE: Record<string, Negara> = {
  "Asia/Jakarta": "ID",
  "Asia/Pontianak": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Singapore": "MY",
  "Asia/Brunei": "MY",
  "Asia/Manila": "PH",
};

export interface DetectInput {
  cookie?: string | null;
  timeZone?: string | null;
  languages?: readonly string[] | null;
}

/**
 * Where the person probably is, without asking for location permission:
 * 1. the country Cloudflare saw the request come from (IP-based, no GPS),
 * 2. the phone's time zone,
 * 3. the phone's languages.
 * Indonesia when nothing matches. Always overridable in Pengaturan.
 */
export function detectNegara(input: DetectInput): Negara {
  const cc = input.cookie?.match(new RegExp(`(?:^|;\\s*)${COUNTRY_COOKIE}=([A-Za-z]{2})`))?.[1]?.toUpperCase();
  if (cc && FROM_COUNTRY[cc]) return FROM_COUNTRY[cc]!;
  const tz = input.timeZone ? FROM_TIMEZONE[input.timeZone] : undefined;
  if (tz) return tz;
  for (const raw of input.languages ?? []) {
    const lang = raw.toLowerCase();
    if (lang.startsWith("id") || lang.startsWith("jv") || lang.startsWith("su")) return "ID";
    if (lang.startsWith("ms")) return "MY";
    if (lang.startsWith("fil") || lang.startsWith("tl") || lang === "en-ph") return "PH";
  }
  return "ID";
}

/** Browser-side wrapper. Safe on the server (returns Indonesia). */
export function detectNegaraHere(): Negara {
  if (typeof window === "undefined") return "ID";
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timeZone = null;
  }
  return detectNegara({
    cookie: typeof document !== "undefined" ? document.cookie : null,
    timeZone,
    languages: typeof navigator !== "undefined" ? navigator.languages : null,
  });
}
