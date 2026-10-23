import { ING } from "../data";
import type { IngLine } from "../types";
import { backend } from "./client";
import { publicGet, publicRpc, storageUrl as storagePublicUrl } from "./share";
import type { AuthorCard, RecipeRow, UserRecipe } from "./types";

// Profiles are no longer publicly readable (migration 0008), so the byline
// comes from `author_cards()`, which returns handles only, never real names.
const SELECT = "*";
const BUCKET = "resep";

/** Handles for a set of authors. Empty on a database without migration 0008. */
async function authorCards(ids: string[]): Promise<Record<string, AuthorCard>> {
  const db = backend();
  const unique = [...new Set(ids)].slice(0, 100);
  if (!db || unique.length === 0) return {};
  try {
    const { data, error } = await db.rpc("author_cards", { ids: unique });
    if (error || !Array.isArray(data)) return {};
    return Object.fromEntries((data as AuthorCard[]).map((a) => [a.id, a]));
  } catch {
    return {};
  }
}

async function withAuthors(rows: RecipeRow[]): Promise<UserRecipe[]> {
  const cards = await authorCards(rows.map((r) => r.author_id));
  return rows.map((r) => toRecipe(r, cards[r.author_id]));
}

/** Public URL for a stored photo. Null when the recipe has none. */
function photoUrl(path: string | null): string | null {
  const db = backend();
  if (!db || !path) return null;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * A database row in the shape the rest of Racik already renders.
 *
 * Lines whose ingredient id is not in the ontology are pulled out into
 * `unmatched`: the engine cannot weigh or scale them, so it must not pretend
 * to. They are still shown to the cook, plainly labelled — the same honest
 * treatment the TikTok import already uses.
 */
export function toRecipe(row: RecipeRow, author?: AuthorCard | null): UserRecipe {
  const known: IngLine[] = [];
  const unmatched: string[] = [];
  for (const line of row.ings ?? []) {
    if (ING[line[0]]) known.push(line);
    else unmatched.push(String(line[2] ?? line[0]));
  }
  return {
    id: row.id,
    title: row.title,
    region: row.region ?? "lainnya",
    slots: [],
    serv: row.serv,
    time: row.time_min ?? 0,
    diff: "sedang",
    spice: 0,
    glyph: "\u{1F372}",
    note: row.note ?? "",
    ings: known,
    steps: row.steps ?? [],
    // A user recipe is never "precise" — that flag means the measurements were
    // written for a scale, which is a claim only the curated recipes can make.
    precise: false,
    imported: false,
    authorId: row.author_id,
    authorName: author ? author.public_name || `@${author.handle}` : "",
    authorHandle: author?.handle ?? null,
    sourceCreator: row.source_creator ?? null,
    sourceUrl: row.source_url ?? null,
    status: row.status,
    hiddenReason: row.hidden_reason,
    photoUrl: photoUrl(row.photo_path),
    cookedCount: row.cooked_count,
    savedCount: row.saved_count,
    unmatched,
  };
}

export async function liveRecipes(limit = 30, before?: string): Promise<UserRecipe[]> {
  const db = backend();
  if (!db) return [];
  let q = db
    .from("recipes")
    .select(SELECT)
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("published_at", before);
  const { data, error } = await q;
  if (error || !data) return [];
  return withAuthors(data as RecipeRow[]);
}

export async function recipeById(id: string): Promise<UserRecipe | null> {
  const db = backend();
  if (!db) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { data } = await db.from("recipes").select(SELECT).eq("id", id).maybeSingle();
    if (!data) return null;
    const [recipe] = await withAuthors([data as RecipeRow]);
    return recipe ?? null;
  } catch {
    return null;
  }
}

/**
 * One published recipe for its public page, over plain fetch so it also
 * works in the server-rendered link preview. Null for drafts, hidden
 * recipes, suspended authors, offline, or no backend.
 */
export async function publicRecipe(id: string): Promise<UserRecipe | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await publicGet<RecipeRow[]>(`recipes?id=eq.${id}&status=eq.live&select=*`);
  const row = rows?.[0];
  if (!row) return null;
  const cards = await publicRpc<AuthorCard[]>("author_cards", { ids: [row.author_id] });
  const recipe = toRecipe(row, cards?.[0] ?? null);
  // photoUrl from toRecipe needs a client; build it from the path instead.
  return { ...recipe, photoUrl: row.photo_path ? storagePublicUrl(row.photo_path) : null };
}

export async function myRecipes(): Promise<UserRecipe[]> {
  const db = backend();
  if (!db) return [];
  try {
    const { data } = await db.auth.getUser();
    if (!data.user) return [];
    const { data: rows } = await db
      .from("recipes")
      .select(SELECT)
      .eq("author_id", data.user.id)
      .order("updated_at", { ascending: false });
    return rows ? withAuthors(rows as RecipeRow[]) : [];
  } catch {
    return [];
  }
}

export interface RecipeDraft {
  id?: string;
  title: string;
  serv: number;
  note?: string;
  region?: string;
  photoPath?: string | null;
  ings: IngLine[];
  steps: [string, number | null][];
  timeMin?: number | null;
  /** Credit for a recipe adapted from someone's video. */
  sourceCreator?: string | null;
  sourceUrl?: string | null;
}

/** Saves a draft or updates one. Never publishes — publishing is explicit. */
export async function saveDraft(draft: RecipeDraft): Promise<{ id: string } | { error: string }> {
  const db = backend();
  if (!db) return { error: "Racik belum tersambung ke server." };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "Kamu belum masuk." };
  const row = {
    ...(draft.id ? { id: draft.id } : {}),
    author_id: auth.user.id,
    title: draft.title.trim(),
    serv: draft.serv,
    note: draft.note?.trim() || null,
    region: draft.region || null,
    // Leave the stored photo alone unless a new one was uploaded.
    ...(draft.photoPath !== undefined ? { photo_path: draft.photoPath } : {}),
    ings: draft.ings,
    steps: draft.steps,
    // Columns from migration 0008. Sent only when set, so saving still works
    // against a database that has not run it yet.
    ...(draft.timeMin ? { time_min: draft.timeMin } : {}),
    ...(draft.sourceCreator ? { source_creator: draft.sourceCreator.slice(0, 60) } : {}),
    ...(draft.sourceUrl ? { source_url: draft.sourceUrl.slice(0, 300) } : {}),
  };
  const { data, error } = await db.from("recipes").upsert(row).select("id").single();
  if (error || !data) {
    console.warn("[racik] saveDraft failed:", error?.code, error?.message);
    return { error: "Resepnya belum tersimpan. Coba lagi." };
  }
  return { id: (data as { id: string }).id };
}

/**
 * Publishing goes through `publish_recipe()` (migration 0008): the server
 * stamps the date, and refuses a recipe a moderator hid or a missing handle.
 */
export async function publish(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data, error } = await db.rpc("publish_recipe", { recipe_id: id });
  if (error) return "Resepnya belum bisa diterbitkan. Coba lagi.";
  switch (data) {
    case "ok":
      return null;
    case "hidden":
      return "Resep ini sedang disembunyikan oleh moderator, jadi belum bisa diterbitkan lagi.";
    case "no_handle":
      return "Pilih nama pengguna dulu, supaya resepnya ada namamu.";
    case "suspended":
      return "Akunmu sedang dibatasi, jadi belum bisa menerbitkan resep.";
    default:
      return "Resepnya belum bisa diterbitkan. Coba lagi.";
  }
}

export async function unpublish(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.rpc("unpublish_recipe", { recipe_id: id });
  return error ? "Belum berhasil. Coba lagi." : null;
}

export async function removeRecipe(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.from("recipes").delete().eq("id", id);
  return error ? "Belum terhapus. Coba lagi." : null;
}

/**
 * Redraws the photo on a canvas and re-encodes it as JPEG. That drops every
 * byte of EXIF, including the GPS position phones write into kitchen photos,
 * before anything leaves the device. Also caps the size.
 */
export async function stripPhoto(file: Blob, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82),
  );
}

export async function uploadPhoto(file: Blob): Promise<{ path: string } | { error: string }> {
  const db = backend();
  if (!db) return { error: "Racik belum tersambung ke server." };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "Kamu belum masuk." };
  let clean: Blob;
  try {
    clean = await stripPhoto(file);
  } catch {
    return { error: "Foto ini belum bisa dibaca. Coba foto lain." };
  }
  const path = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, clean, { upsert: false, contentType: "image/jpeg" });
  if (error) return { error: "Fotonya belum terkirim. Coba lagi." };
  return { path };
}

/* ---- Google Play requires reporting of content AND users, plus blocking ---- */

export async function report(input: {
  recipeId?: string;
  subjectId?: string;
  reason: string;
  detail?: string;
}): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return "Kamu belum masuk.";
  const { error } = await db.from("reports").insert({
    reporter_id: auth.user.id,
    recipe_id: input.recipeId ?? null,
    subject_id: input.subjectId ?? null,
    reason: input.reason,
    detail: input.detail ?? null,
  });
  return error ? "Laporannya belum terkirim. Coba lagi." : null;
}

export async function blockAuthor(authorId: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return "Kamu belum masuk.";
  const { error } = await db
    .from("blocks")
    .insert({ blocker_id: auth.user.id, blocked_id: authorId });
  return error ? "Belum berhasil. Coba lagi." : null;
}

export async function unblockAuthor(authorId: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return "Kamu belum masuk.";
  const { error } = await db
    .from("blocks")
    .delete()
    .eq("blocker_id", auth.user.id)
    .eq("blocked_id", authorId);
  return error ? "Belum berhasil. Coba lagi." : null;
}
