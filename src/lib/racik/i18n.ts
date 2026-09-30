import { useRacik } from "./state";

export type Lang = "id" | "en";

/**
 * Interface copy only. Recipe content — titles, ingredient names, steps,
 * notes — stays in Bahasa Indonesia whichever language is chosen, because it
 * is data written by cooks, not chrome. Translating 199 recipes is a writing
 * project; this is the switch for everything around them.
 *
 * Indonesian is the source. English is the translation, never the reverse:
 * the app is for Indonesian home cooks and the Indonesian wording is the one
 * that gets argued over.
 */
const DICT = {
  // bottom tabs
  tab_home: ["Masak Apa", "What to Cook"],
  tab_search: ["Cari Resep", "Find a Recipe"],
  tab_write: ["Tulis", "Write"],
  tab_book: ["Buku Resep", "My Book"],

  // home
  greeting_morning: ["SELAMAT PAGI,", "GOOD MORNING,"],
  greeting_midday: ["SELAMAT SIANG,", "GOOD AFTERNOON,"],
  greeting_evening: ["SELAMAT SORE,", "GOOD EVENING,"],
  greeting_night: ["SELAMAT MALAM,", "GOOD EVENING,"],
  ask_breakfast: ["Sarapan apa hari ini?", "What's for breakfast?"],
  ask_lunch: ["Masak apa siang ini?", "What's for lunch?"],
  ask_dinner: ["Masak apa malam ini?", "What's for dinner?"],
  for_people: ["Untuk {n} orang", "For {n} people"],
  search_placeholder: ["Cari resep atau bahan…", "Search recipes or ingredients…"],
  suggestions: ["SARAN UNTUKMU", "SUGGESTED FOR YOU"],
  shuffle: ["Ganti", "Shuffle"],
  no_match: ["Tidak ada resep yang cocok.", "No recipes match."],
  clear_filters: ["Hapus filter", "Clear filters"],
  portions: ["porsi", "portions"],

  // filters
  filter_quick: ["< 30 menit", "Under 30 min"],
  filter_easy: ["Gampang", "Easy"],
  filter_protein: ["Protein tinggi", "High protein"],
  filter_batch: ["Sekali masak banyak", "Cooks a lot at once"],

  // settings
  settings: ["Pengaturan", "Settings"],
  back: ["Kembali", "Back"],
  usual_portions: ["Porsi biasa", "Usual portions"],
  usual_portions_detail: ["Dipakai saat membuka resep pertama kali.", "Used when you first open a recipe."],
  measures: ["Satuan takaran", "Measurements"],
  measures_home: ["Rumah", "Kitchen"],
  measures_gram: ["Gram", "Grams"],
  text_size: ["Ukuran tulisan", "Text size"],
  text_normal: ["Normal", "Normal"],
  text_large: ["Besar", "Large"],
  text_largest: ["Paling besar", "Largest"],
  language: ["Bahasa", "Language"],
  hide_check: ["Sembunyikan resep yang perlu dicek", "Hide recipes that need checking"],
  hide_check_detail: [
    "Penyaring ini berdasarkan daftar bahan. Racik bukan lembaga sertifikasi halal.",
    "This filter reads the ingredient list. Racik is not a halal certification body.",
  ],
  about: ["TENTANG RACIK", "ABOUT RACIK"],
  about_body: [
    "Racik berisi 199 resep yang tersimpan di perangkat. Takaran rumah dan perkiraan protein punya batas; baca catatan pada setiap resep.",
    "Racik holds 199 recipes stored on your device. Kitchen measures and protein estimates have limits — read the note on each recipe.",
  ],
  erase_all: ["Hapus semua data", "Erase all data"],

  // account
  sign_in: ["Masuk", "Sign in"],
  sign_out: ["Keluar", "Sign out"],
  sign_in_title: ["Masuk ke Racik", "Sign in to Racik"],
  sign_in_why: [
    "Kamu hanya perlu masuk kalau mau menulis resep sendiri. Memasak, menyimpan, dan mengambil resep dari video tetap bisa tanpa akun.",
    "You only need an account to write your own recipes. Cooking, saving and importing from videos all work without one.",
  ],
  continue_google: ["Lanjut dengan Google", "Continue with Google"],
  email_label: ["Alamat email", "Email address"],
  continue_: ["Lanjut", "Next"],
  code_title: ["Masukkan kodenya", "Enter the code"],
  code_sent_to: [
    "Kami kirim enam angka ke {email}.",
    "We sent six digits to {email}.",
  ],
  code_resend: ["Kirim ulang kodenya", "Send the code again"],
  profile_title: ["Kenalan dulu", "Let's meet"],
  profile_why: [
    "Nama ini yang muncul di resep yang kamu tulis. Fotonya boleh dilewati.",
    "This name appears on the recipes you write. The photo is optional.",
  ],
  add_photo: ["Tambah foto", "Add a photo"],
  skip: ["Lewati", "Skip"],
  done: ["Selesai", "Done"],
  send_link: ["Kirim tautan masuk", "Send sign-in link"],
  link_sent: [
    "Tautannya sudah dikirim. Buka emailmu, lalu ketuk tautannya untuk masuk.",
    "The link is on its way. Open your email and tap it to sign in.",
  ],
  or: ["atau", "or"],
  your_name: ["Namamu", "Your name"],
  your_name_detail: [
    "Nama ini yang muncul di resep yang kamu tulis.",
    "This name appears on the recipes you write.",
  ],
  save: ["Simpan", "Save"],
  signed_in_as: ["Masuk sebagai {name}", "Signed in as {name}"],
  not_connected: ["Racik belum tersambung ke server.", "Racik is not connected to the server."],

  // the sign-in offer — shown once, always skippable
  offer_title: ["Mau punya akun Racik?", "Want a Racik account?"],
  offer_write: [
    "Menulis resepmu sendiri, lengkap dengan takaran yang ikut jumlah porsi.",
    "Write your own recipes, with measurements that follow the portion count.",
  ],
  offer_share: [
    "Membagikannya ke teman lewat WhatsApp — mereka bisa membukanya tanpa memasang Racik.",
    "Share them on WhatsApp — friends can open them without installing Racik.",
  ],
  offer_seen: [
    "Melihat berapa orang memasak resepmu.",
    "See how many people cooked your recipe.",
  ],
  offer_not_needed: [
    "Tanpa akun pun 199 resep, takaran, dan mode masak tetap jalan — termasuk tanpa sinyal.",
    "Without an account you still get all 199 recipes, the measurements and cook mode — signal or no signal.",
  ],
  offer_later: ["Nanti saja", "Maybe later"],

  continue_facebook: ["Lanjut dengan Facebook", "Continue with Facebook"],
  continue_apple: ["Lanjut dengan Apple", "Continue with Apple"],

  // writing
  write_recipe: ["Tulis resep sendiri", "Write your own recipe"],
  write_intro: [
    "Resepmu akan bisa dilihat pengguna Racik lain.",
    "Your recipe will be visible to other Racik users.",
  ],
  my_recipes: ["RESEP YANG KAMU TULIS", "RECIPES YOU WROTE"],
  draft: ["Draf", "Draft"],
  live: ["Sudah tayang", "Published"],
  hidden: ["Disembunyikan", "Hidden"],
  report: ["Laporkan", "Report"],
  block_author: ["Blokir penulis ini", "Block this author"],
} as const;

export type Key = keyof typeof DICT;

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const pair = DICT[key];
  let out: string = lang === "en" ? pair[1] : pair[0];
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}

/** `const t = useT(); t("tab_home")` */
export function useT() {
  const { state } = useRacik();
  const lang: Lang = state.lang === "en" ? "en" : "id";
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

export function useLang(): Lang {
  const { state } = useRacik();
  return state.lang === "en" ? "en" : "id";
}
