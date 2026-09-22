import photosRaw from "@/data/photos.json";
import rendang from "@/assets/resep/rendang_daging.jpg";
import gado from "@/assets/resep/gado_gado.jpg";
import soto from "@/assets/resep/soto_ayam_lamongan.jpg";
import mendoan from "@/assets/resep/tempe_mendoan.jpg";
import cendol from "@/assets/resep/es_cendol.jpg";
import woku from "@/assets/resep/ayam_woku.jpg";
import ayamLengkuas from "@/assets/resep/ayam_goreng_lengkuas.jpg";
import boluPandan from "@/assets/resep/bolu_kukus_pandan.jpg";
import nasiGoreng from "@/assets/resep/nasi_goreng_kampung.jpg";
import sayurAsem from "@/assets/resep/sayur_asem.jpg";
import tinutuan from "@/assets/resep/tinutuan.jpg";
import pindang from "@/assets/resep/pindang_ikan.jpg";
import rawon from "@/assets/resep/rawon_daging.jpg";
import semur from "@/assets/resep/semur_daging_betawi.jpg";
import sambal from "@/assets/resep/sambal_terasi.jpg";

/** CDN-hosted photographs keyed by recipe: nothing binary enters the bundle. */
const REMOTE = photosRaw as Record<string, string[]>;

/** Photographs that still ship with the app from the first sample set. */
const LOCAL: Record<string, string> = {
  rendang_daging: rendang,
  gado_gado: gado,
  soto_ayam_lamongan: soto,
  tempe_mendoan: mendoan,
  es_cendol: cendol,
  ayam_woku: woku,
  ayam_goreng_lengkuas: ayamLengkuas,
  bolu_kukus_pandan: boluPandan,
  nasi_goreng_kampung: nasiGoreng,
  sayur_asem: sayurAsem,
  tinutuan,
  pindang_ikan: pindang,
  rawon_daging: rawon,
  semur_daging_betawi: semur,
  sambal_terasi: sambal,
};

/** Every photograph for one recipe, hero first. */
export const photosOf = (id: string): string[] => {
  const remote = REMOTE[id] ?? [];
  const local = LOCAL[id];
  return remote.length > 0 ? remote : local ? [local] : [];
};

/** Photographs are the primary visual material. Everything else falls back to a warm ground. */
export const PHOTO: Record<string, string> = Object.fromEntries(
  [...new Set([...Object.keys(REMOTE), ...Object.keys(LOCAL)])]
    .map((id) => [id, photosOf(id)[0]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
);
