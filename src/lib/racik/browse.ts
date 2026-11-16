import { INGREDIENTS, NUSANTARA } from "./data";
import { passesHalalMode } from "./engine";
import type { Recipe } from "./types";
import { t } from "./i18n";

/**
 * Browse groups shared by Cari and the tablet/desktop home, so a card on the
 * home and the Cari list it opens always show the same count.
 */

/** "≤ N menit" groups on the wide home (Octavia's desktop mockup, 8 Nov 2026). */
export const TIME_BUCKETS = [15, 20, 30, 45, 60, 90] as const;

const FISH = new Set([
  "udang",
  "udang_galah",
  "cumi",
  "cumi_asin",
  "kepiting",
  "kerang_hijau",
  "kerang_dara",
  "tiram",
  "gurita",
  "lobster",
  "cakalang_fufu",
  "belut",
  "tuna_kaleng",
  "sarden",
]);
const MEAT = new Set([
  "daging_sapi",
  "daging_kambing",
  "daging_giling",
  "buntut_sapi",
  "iga_sapi",
  "babat",
  "kikil_sapi",
  "paru_sapi",
  "cingur_sapi",
  "kaki_kambing",
  "kornet",
  "smoked_beef",
  "bakso",
  "daging_babi",
  "babi_cincang",
  "perut_babi",
  "kaki_babi",
  "daging_rusa",
  "daging_kelinci",
]);

export type MainId = "ayam" | "ikan" | "telur" | "tahu_tempe" | "daging" | "sayur";

/**
 * Main-ingredient groups. A recipe belongs to a group when any measured line
 * uses one of its ingredients. Ikan & Udang covers every fish and seafood
 * (not ebi, which is a seasoning); Daging covers beef, goat, offal and pork.
 */
export const MAIN_GROUPS: { id: MainId; label: () => string; ids: Set<string> }[] = [
  {
    id: "ayam",
    label: () => t("ayam"),
    ids: new Set(["ayam", "ayam_utuh", "ceker", "ampela", "hati_ayam", "usus_ayam"]),
  },
  {
    id: "ikan",
    label: () => t("ikan_udang"),
    ids: new Set([
      ...INGREDIENTS.filter((i) => i.id.startsWith("ikan_")).map((i) => i.id),
      ...FISH,
    ]),
  },
  {
    id: "telur",
    label: () => t("telur"),
    ids: new Set(["telur", "telur_bebek", "telur_puyuh", "telur_asin"]),
  },
  {
    id: "tahu_tempe",
    label: () => t("tahu_tempe"),
    ids: new Set(["tahu", "tempe", "tahu_sutra", "tempe_gembus", "oncom"]),
  },
  { id: "daging", label: () => t("daging"), ids: MEAT },
  {
    id: "sayur",
    label: () => t("sayur"),
    ids: new Set(INGREDIENTS.filter((i) => i.cat === "sayur").map((i) => i.id)),
  },
];

export const usesAny = (r: Recipe, ids: Set<string>) => r.ings.some((l) => ids.has(l[0]));

/** The Nusantara recipes Cari's shelves count from, after the halal setting. */
export const browsePool = (halalMode: boolean): Recipe[] =>
  NUSANTARA.filter((r) => passesHalalMode(r, halalMode));

export const timeKey = (n: number) => `waktu.${n}`;
export const mainKey = (id: MainId) => `bahan-utama.${id}`;

/** A home card's Cari filter (`?t=waktu.20`, `?t=bahan-utama.ikan`), or null. */
export function browseTile(
  key: string,
  pool: Recipe[],
): { label: string; recipes: Recipe[] } | null {
  const [kind, value] = key.split(".");
  if (kind === "waktu") {
    const n = Number(value);
    if (!TIME_BUCKETS.includes(n as (typeof TIME_BUCKETS)[number])) return null;
    return { label: t("menit", { n }), recipes: pool.filter((r) => r.time <= n) };
  }
  if (kind === "bahan-utama") {
    const g = MAIN_GROUPS.find((x) => x.id === value);
    return g ? { label: g.label(), recipes: pool.filter((r) => usesAny(r, g.ids)) } : null;
  }
  return null;
}
