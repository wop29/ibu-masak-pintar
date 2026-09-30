import { ING } from "../data";
import type { IngLine } from "../types";
import { backend } from "./client";
import type { RecipeRow, UserRecipe } from "./types";

const SELECT = "*, profiles(name)";
const BUCKET = "resep";

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
export function toRecipe(row: RecipeRow): UserRecipe {
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
    time: 0,
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
    authorName: row.profiles?.name ?? "",
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
  let q = db.from("recipes").select(SELECT).eq("status", "live")
    .order("published_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("published_at", before);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as RecipeRow[]).map(toRecipe);
}

export async function recipeById(id: string): Promise<UserRecipe | null> {
  const db = backend();
  if (!db) return null;
  const { data } = await db.from("recipes").select(SELECT).eq("id", id).maybeSingle();
  return data ? toRecipe(data as RecipeRow) : null;
}

export async function myRecipes(): Promise<UserRecipe[]> {
  const db = backend();
  if (!db) return [];
  const { data } = await db.auth.getUser();
  if (!data.user) return [];
  const { data: rows } = await db.from("recipes").select(SELECT)
    .eq("author_id", data.user.id).order("updated_at", { ascending: false });
  return rows ? (rows as RecipeRow[]).map(toRecipe) : [];
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
    photo_path: draft.photoPath ?? null,
    ings: draft.ings,
    steps: draft.steps,
  };
  const { data, error } = await db.from("recipes").upsert(row).select("id").single();
  if (error || !data) return { error: "Resepnya belum tersimpan. Coba lagi." };
  return { id: (data as { id: string }).id };
}

export async function publish(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.from("recipes")
    .update({ status: "live", published_at: new Date().toISOString() }).eq("id", id);
  return error ? "Resepnya belum bisa ditayangkan. Coba lagi." : null;
}

export async function unpublish(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.from("recipes").update({ status: "draft" }).eq("id", id);
  return error ? "Belum berhasil. Coba lagi." : null;
}

export async function removeRecipe(id: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.from("recipes").delete().eq("id", id);
  return error ? "Belum terhapus. Coba lagi." : null;
}

export async function uploadPhoto(file: File): Promise<{ path: string } | { error: string }> {
  const db = backend();
  if (!db) return { error: "Racik belum tersambung ke server." };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "Kamu belum masuk." };
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) return { error: "Fotonya belum terkirim. Coba lagi." };
  return { path };
}

/* ---- Google Play requires reporting of content AND users, plus blocking ---- */

export async function report(
  input: { recipeId?: string; subjectId?: string; reason: string; detail?: string },
): Promise<string | null> {
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
  const { error } = await db.from("blocks")
    .insert({ blocker_id: auth.user.id, blocked_id: authorId });
  return error ? "Belum berhasil. Coba lagi." : null;
}

export async function unblockAuthor(authorId: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return "Kamu belum masuk.";
  const { error } = await db.from("blocks").delete()
    .eq("blocker_id", auth.user.id).eq("blocked_id", authorId);
  return error ? "Belum berhasil. Coba lagi." : null;
}
