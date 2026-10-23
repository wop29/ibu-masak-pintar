/**
 * Every message the Tambah Resep sheet can show, chosen by what went wrong AND
 * where the recipe came from. A pasted text that holds no recipe must never be
 * told "the video has no recipe", and must never be offered video buttons.
 *
 * Plain Bahasa only. Technical details go to the console and server logs.
 */
import type { ImportSource } from "./import-quota";
import { t } from "@/lib/racik/i18n";

/** Machine-readable failure codes the server returns instead of raw errors. */
export type ImportErrorCode =
  | "disabled" // IMPORT_DISABLED kill switch
  | "quota" // monthly allowance used up
  | "rate" // too many attempts in a short time
  | "busy" // Racik-wide daily ceiling, or Gemini overloaded, or the quota store is down
  | "timeout" // took too long (server deadline or client timeout)
  | "offline" // the phone has no connection
  | "bad_link" // not a TikTok / Instagram / YouTube https link
  | "text_empty"
  | "text_too_long"
  | "file_missing"
  | "file_too_big"
  | "file_type"
  | "too_many_photos"
  | "photo_unreadable"
  | "audio_unreadable"
  | "not_configured"
  | "failed";

/** What the sheet maps the four input routes to. `suara` = Racik listened to the video. */
export type SheetSource = ImportSource;

export type ImportAction =
  | "listen" // Racik listens to the linked video
  | "upload" // pick a video or voice recording
  | "paste" // switch to Teks resep
  | "edit_text" // back to the text she pasted
  | "photo_again" // pick another photo
  | "retry" // same request again
  | "write"; // write it yourself (/tulis)

export interface ImportMessage {
  title: string;
  body: string;
  actions: ImportAction[];
}

const SOURCE_NOUN: Record<SheetSource, string> = {
  get link() { return t("noun_link"); },
  get suara() { return t("noun_suara"); },
  get berkas() { return t("noun_berkas"); },
  get teks() { return t("noun_teks"); },
  get foto() { return t("noun_foto"); },
};

/** The "nothing to cook from" screen, per source. */
export function noRecipeMessage(source: SheetSource): ImportMessage {
  switch (source) {
    case "link":
      return {
        title: t("resepnya_belum_tertulis_di_keterangan"),
        body: t("bahan_dan_langkahnya_tidak_ada"),
        actions: ["listen", "upload", "paste"],
      };
    case "suara":
    case "berkas":
      return {
        title: t("resepnya_tidak_terdengar_di_video"),
        body: t("racik_sudah_mendengarkan_videonya_tapi"),
        actions: ["paste", "upload"],
      };
    case "teks":
      return {
        title: t("belum_ada_resep_di_teks"),
        body: t("racik_butuh_daftar_bahan_dan"),
        actions: ["edit_text"],
      };
    case "foto":
      return {
        title: t("belum_ada_resep_di_foto"),
        body: t("bahan_dan_langkahnya_belum_terbaca"),
        actions: ["photo_again"],
      };
  }
}

/** A failure, per code and source. Never includes raw server text. */
export function errorMessage(code: ImportErrorCode, source: SheetSource): ImportMessage {
  const noun = SOURCE_NOUN[source];
  switch (code) {
    case "disabled":
      return {
        title: t("tambah_resep_sedang_istirahat"),
        body: t("import_sedang_istirahat_sebentar_resep"),
        actions: ["write"],
      };
    case "quota":
      return {
        title: t("jatah_bulan_ini_sudah_habis"),
        body: t("kamu_sudah_memakai_semua_jatah"),
        actions: ["write"],
      };
    case "rate":
      return {
        title: t("pelan_pelan_dulu_ya"),
        body: t("terlalu_banyak_permintaan_dalam_waktu"),
        actions: ["retry"],
      };
    case "busy":
      return {
        title: t("racik_sedang_ramai"),
        body: t("coba_lagi_sebentar_lagi_resep"),
        actions: ["retry"],
      };
    case "timeout":
      return {
        title: t("prosesnya_terlalu_lama"),
        body: t("racik_belum_selesai_menyusun_resepnya"),
        actions: ["retry"],
      };
    case "offline":
      return {
        title: t("tidak_ada_internet"),
        body: t("tambah_resep_butuh_internet_resep"),
        actions: ["retry"],
      };
    case "bad_link":
      return {
        title: t("link_nya_belum_bisa_dipakai"),
        body: t("gunakan_link_tiktok_instagram_reels"),
        actions: [],
      };
    case "text_empty":
      return {
        title: t("teksnya_masih_kosong"),
        body: t("tempel_bahan_dan_cara_memasaknya"),
        actions: [],
      };
    case "text_too_long":
      return {
        title: t("teksnya_terlalu_panjang"),
        body: t("tempel_bagian_bahan_dan_cara"),
        actions: ["edit_text"],
      };
    case "file_missing":
      return source === "foto"
        ? {
            title: t("fotonya_belum_terkirim"),
            body: t("pilih_atau_ambil_foto_resepnya"),
            actions: ["photo_again"],
          }
        : {
            title: t("berkasnya_belum_terkirim"),
            body: t("pilih_video_atau_rekaman_suaranya"),
            actions: ["upload"],
          };
    case "file_too_big":
      return source === "foto"
        ? {
            title: t("fotonya_terlalu_besar"),
            body: t("coba_foto_lain_atau_kirim"),
            actions: ["photo_again"],
          }
        : {
            title: t("videonya_terlalu_besar"),
            body: t("paling_besar_14_mb_pakai"),
            actions: ["upload", "paste"],
          };
    case "file_type":
      return source === "foto"
        ? {
            title: t("berkas_ini_bukan_foto"),
            body: t("pilih_foto_resep_jpg_atau"),
            actions: ["photo_again"],
          }
        : {
            title: t("berkas_ini_bukan_video"),
            body: t("pilih_video_atau_rekaman_suara"),
            actions: ["upload"],
          };
    case "too_many_photos":
      return {
        title: t("fotonya_kebanyakan"),
        body: t("paling_banyak_4_foto_sekaligus"),
        actions: ["photo_again"],
      };
    case "photo_unreadable":
      return {
        title: t("foto_ini_belum_bisa_dibaca"),
        body: t("coba_foto_lain"),
        actions: ["photo_again"],
      };
    case "audio_unreadable":
      return {
        title: t("suaranya_tidak_terbaca"),
        body: t("suara_di_berkas_itu_tidak"),
        actions: ["upload", "paste"],
      };
    case "not_configured":
      return {
        title: t("tambah_resep_belum_tersambung"),
        body: t("coba_lagi_nanti_resep_yang"),
        actions: ["write"],
      };
    case "failed":
    default:
      return {
        title: t("resep_belum_bisa_disusun_dari", { noun }),
        body: t("coba_lagi_sebentar_lagi"),
        actions: ["retry"],
      };
  }
}

/** Errors that are worth an automatic "Coba lagi" button. */
export function isRetryable(code: ImportErrorCode): boolean {
  return (
    code === "busy" ||
    code === "timeout" ||
    code === "offline" ||
    code === "failed" ||
    code === "rate"
  );
}

/** A thrown client-side error (network, timeout) → a code. Raw text never reaches the screen; log it to the console instead. */
export function codeFromThrown(caught: unknown, online: boolean): ImportErrorCode {
  if (!online) return "offline";
  const raw = caught instanceof Error ? `${caught.name} ${caught.message}` : String(caught ?? "");
  if (/timeout|timed out|aborterror/i.test(raw)) return "timeout";
  // A network error while the phone says it is online is usually a blip, not "no internet".
  return "failed";
}
