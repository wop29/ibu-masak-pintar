/**
 * Every message the Tambah Resep sheet can show, chosen by what went wrong AND
 * where the recipe came from. A pasted text that holds no recipe must never be
 * told "the video has no recipe", and must never be offered video buttons.
 *
 * Plain Bahasa only. Technical details go to the console and server logs.
 */
import type { ImportSource } from "./import-quota";

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
  link: "link ini",
  suara: "video ini",
  berkas: "berkas ini",
  teks: "teks ini",
  foto: "foto ini",
};

/** The "nothing to cook from" screen, per source. */
export function noRecipeMessage(source: SheetSource): ImportMessage {
  switch (source) {
    case "link":
      return {
        title: "Resepnya belum tertulis di keterangan video",
        body: "Bahan dan langkahnya tidak ada di keterangan video. Racik bisa mendengarkan suara videonya, atau kamu bisa tempel teks resepnya.",
        actions: ["listen", "upload", "paste"],
      };
    case "suara":
    case "berkas":
      return {
        title: "Resepnya tidak terdengar di video ini",
        body: "Racik sudah mendengarkan videonya, tapi bahan dan langkahnya tidak disebut. Kalau resepnya ada di layar atau di keterangan, tempel teksnya.",
        actions: ["paste", "upload"],
      };
    case "teks":
      return {
        title: "Belum ada resep di teks ini",
        body: "Racik butuh daftar bahan dan langkah memasak. Tempel teks yang memuat keduanya.",
        actions: ["edit_text"],
      };
    case "foto":
      return {
        title: "Belum ada resep di foto ini",
        body: "Bahan dan langkahnya belum terbaca. Coba foto yang lebih terang dan dekat, atau beberapa foto sekaligus.",
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
        title: "Tambah Resep sedang istirahat",
        body: "Import sedang istirahat sebentar. Resep yang sudah tersimpan tetap bisa dibuka. Coba lagi nanti, atau tulis resepnya sendiri.",
        actions: ["write"],
      };
    case "quota":
      return {
        title: "Jatah bulan ini sudah habis",
        body: "Kamu sudah memakai semua jatah Tambah Resep bulan ini. Resep yang sudah tersimpan tetap bisa dimasak, dan kamu tetap bisa menulis resep sendiri.",
        actions: ["write"],
      };
    case "rate":
      return {
        title: "Pelan-pelan dulu, ya",
        body: "Terlalu banyak permintaan dalam waktu singkat. Tunggu beberapa menit, lalu coba lagi.",
        actions: ["retry"],
      };
    case "busy":
      return {
        title: "Racik sedang ramai",
        body: "Coba lagi sebentar lagi. Resep yang sudah tersimpan tetap bisa dibuka.",
        actions: ["retry"],
      };
    case "timeout":
      return {
        title: "Prosesnya terlalu lama",
        body: "Racik belum selesai menyusun resepnya. Coba lagi sebentar lagi.",
        actions: ["retry"],
      };
    case "offline":
      return {
        title: "Tidak ada internet",
        body: "Tambah Resep butuh internet. Resep yang sudah tersimpan tetap bisa dibuka tanpa internet.",
        actions: ["retry"],
      };
    case "bad_link":
      return {
        title: "Link-nya belum bisa dipakai",
        body: "Gunakan link TikTok, Instagram Reels, atau YouTube.",
        actions: [],
      };
    case "text_empty":
      return {
        title: "Teksnya masih kosong",
        body: "Tempel bahan dan cara memasaknya dulu.",
        actions: [],
      };
    case "text_too_long":
      return {
        title: "Teksnya terlalu panjang",
        body: "Tempel bagian bahan dan cara memasaknya saja, paling banyak 20.000 huruf.",
        actions: ["edit_text"],
      };
    case "file_missing":
      return source === "foto"
        ? {
            title: "Fotonya belum terkirim",
            body: "Pilih atau ambil foto resepnya dulu.",
            actions: ["photo_again"],
          }
        : {
            title: "Berkasnya belum terkirim",
            body: "Pilih video atau rekaman suaranya dulu.",
            actions: ["upload"],
          };
    case "file_too_big":
      return source === "foto"
        ? {
            title: "Fotonya terlalu besar",
            body: "Coba foto lain, atau kirim lebih sedikit foto sekaligus.",
            actions: ["photo_again"],
          }
        : {
            title: "Videonya terlalu besar",
            body: "Paling besar 14 MB. Pakai video yang lebih pendek atau rekaman suaranya saja, atau tempel teks resepnya.",
            actions: ["upload", "paste"],
          };
    case "file_type":
      return source === "foto"
        ? {
            title: "Berkas ini bukan foto",
            body: "Pilih foto resep (JPG atau PNG).",
            actions: ["photo_again"],
          }
        : {
            title: "Berkas ini bukan video",
            body: "Pilih video atau rekaman suara.",
            actions: ["upload"],
          };
    case "too_many_photos":
      return {
        title: "Fotonya kebanyakan",
        body: "Paling banyak 4 foto sekaligus.",
        actions: ["photo_again"],
      };
    case "photo_unreadable":
      return {
        title: "Foto ini belum bisa dibaca",
        body: "Coba foto lain.",
        actions: ["photo_again"],
      };
    case "audio_unreadable":
      return {
        title: "Suaranya tidak terbaca",
        body: "Suara di berkas itu tidak terbaca. Coba berkas lain, atau tempel teks resepnya.",
        actions: ["upload", "paste"],
      };
    case "not_configured":
      return {
        title: "Tambah Resep belum tersambung",
        body: "Coba lagi nanti. Resep yang sudah tersimpan tetap bisa dibuka.",
        actions: ["write"],
      };
    case "failed":
    default:
      return {
        title: `Resep belum bisa disusun dari ${noun}`,
        body: "Coba lagi sebentar lagi.",
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
