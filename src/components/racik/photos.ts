import photosRaw from "@/data/photos.json";
import rendang from "@/assets/resep/rendang_daging.jpg";
import gado from "@/assets/resep/gado_gado.jpg";
import soto from "@/assets/resep/soto_ayam_lamongan.jpg";
import mendoan from "@/assets/resep/tempe_mendoan.jpg";
import cendol from "@/assets/resep/es_cendol.jpg";
import woku from "@/assets/resep/ayam_woku.jpg";
import ayamLengkuas from "@/assets/resep/ayam_goreng_lengkuas.jpg";
import bolu from "@/assets/resep/bolu_kukus_pandan.jpg";
import nasiGoreng from "@/assets/resep/nasi_goreng_kampung.jpg";
import sayurAsem from "@/assets/resep/sayur_asem.jpg";
import tinutuan from "@/assets/resep/tinutuan.jpg";
import pindang from "@/assets/resep/pindang_ikan.jpg";
import rawon from "@/assets/resep/rawon_daging.jpg";
import semur from "@/assets/resep/semur_daging_betawi.jpg";
import sambal from "@/assets/resep/sambal_terasi.jpg";

/** CDN-hosted photographs keyed by recipe: nothing binary enters the bundle. */
const REMOTE = photosRaw as Record<string, string[]>;
const PUBLIC_ASSET_ORIGIN = "https://project--404aa9e3-8685-40d9-ad45-482865bd6804-dev.lovable.app";

/**
 * Photographs bundled with the app. These are the offline floor: they are
 * precached with the app shell, so they show even on the first run with no
 * signal, whatever the CDN does.
 */
const LOCAL: Record<string, string> = {
  rendang: rendang,
  gado_gado: gado,
  soto_ayam_lamongan: soto,
  tempe_mendoan: mendoan,
  es_cendol: cendol,
  ayam_woku: woku,
  nasi_goreng_kampung: nasiGoreng,
  sayur_asem: sayurAsem,
  tinutuan,
  pindang_patin: pindang,
  rawon: rawon,
  semur_daging: semur,
  sambal_terasi: sambal,
};

/** Bundled artwork used by the interface itself, not tied to one recipe. */
export const ART = { rendang, mendoan, gado, woku, bolu, ayamLengkuas } as const;

/** Every photograph for one recipe, hero first. */
export const photosOf = (id: string): string[] => {
  const remote = REMOTE[id] ?? [];
  const local = LOCAL[id];
  return remote.length > 0 ? remote : local ? [local] : [];
};

/**
 * Absolute image URL for external link preview crawlers. The origin is the one
 * serving this request, so previews keep working on any domain.
 */
export const previewPhotoOf = (id: string, origin: string): string | undefined => {
  const photo = REMOTE[id]?.[0];
  if (!photo || !origin) return undefined;
  return new URL(photo, origin).href;
};

/** Photographs are the primary visual material. Everything else falls back to a warm ground. */
export const PHOTO: Record<string, string> = Object.fromEntries(
  [...new Set([...Object.keys(REMOTE), ...Object.keys(LOCAL)])]
    .map((id) => [id, photosOf(id)[0]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
);
