import { backend } from "./client";

/**
 * Share links, open counting and attribution (migration 0008).
 *
 * Everything here degrades to "no link, no count" when the backend is not
 * configured, the device is offline, or the migration has not been run yet:
 * the card still renders and shares, it just carries the plain recipe URL.
 */

/** The short host printed on cards. Overridable for staging. */
export const PUBLIC_ORIGIN = (
  (import.meta.env["VITE_PUBLIC_ORIGIN"] as string | undefined) ?? "https://racik.online"
).replace(/\/$/, "");
export const PUBLIC_HOST = PUBLIC_ORIGIN.replace(/^https?:\/\//, "");

export type CardFormat = "story" | "feed";
export type LinkKind = "catalogue" | "user" | "import";

const URL_ = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

/**
 * Anonymous RPC over plain fetch. Used by route loaders, which also run on the
 * server for link previews, where no session and no localStorage exist.
 */
export async function publicRpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  if (!URL_ || !KEY) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Anonymous REST read, e.g. `recipes?id=eq.…`. Row Level Security decides what comes back. */
export async function publicGet<T>(path: string): Promise<T | null> {
  if (!URL_ || !KEY) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Public URL of a photo in the recipe bucket. Works without a client. */
export function storageUrl(path: string | null | undefined): string | null {
  if (!path || !URL_) return null;
  return `${URL_}/storage/v1/object/public/resep/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// ------------------------------------------------------------- device

const DEVICE_KEY = "racik.device";
let deviceCache: string | null = null;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A random id that never leaves the device; only its SHA-256 is sent, so the
 * server can count "one device once a day" without knowing who it is.
 */
export async function deviceHash(): Promise<string | null> {
  if (deviceCache) return deviceCache;
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  let id: string | null = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id = crypto.randomUUID();
  }
  deviceCache = await sha256(`racik:${id}`);
  return deviceCache;
}

// ------------------------------------------------------------- local memory

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: counting is best effort */
  }
}

const MINE_KEY = "racik.share.mine";
const REF_KEY = "racik.share.ref";
const SENT_KEY = "racik.share.sent";
const REF_DAYS = 30;

/** Links this device created, so her own taps are never sent at all. */
export function isMine(code: string): boolean {
  return readJson<string[]>(MINE_KEY, []).includes(code);
}
function markMine(code: string): void {
  const mine = readJson<string[]>(MINE_KEY, []);
  if (!mine.includes(code)) writeJson(MINE_KEY, [code, ...mine].slice(0, 200));
}

/**
 * She arrived at a recipe through someone's link. Remembered for 30 days, so
 * a save or a finished cook later on can be credited to that link.
 */
export function rememberRef(recipeId: string, code: string): void {
  if (isMine(code)) return;
  const refs = readJson<Record<string, { code: string; at: number }>>(REF_KEY, {});
  refs[recipeId] = { code, at: Date.now() };
  writeJson(REF_KEY, refs);
}
export function refFor(recipeId: string): string | null {
  const ref = readJson<Record<string, { code: string; at: number }>>(REF_KEY, {})[recipeId];
  if (!ref || Date.now() - ref.at > REF_DAYS * 864e5) return null;
  return ref.code;
}

// ------------------------------------------------------------- counting

/** Fire-and-forget. The server dedupes per device per day and ignores the owner. */
export async function recordOpen(code: string): Promise<void> {
  if (isMine(code)) return;
  const db = backend();
  const hash = await deviceHash();
  if (!db || !hash) return;
  try {
    await db.rpc("record_link_open", { link_code: code, device_hash: hash });
  } catch {
    /* offline: an uncounted open is fine */
  }
}

/** A save or a finished cook of a recipe she reached through a link. Once per kind. */
export async function recordEvent(recipeId: string, kind: "save" | "cook"): Promise<void> {
  const code = refFor(recipeId);
  if (!code) return;
  const sent = readJson<string[]>(SENT_KEY, []);
  const key = `${code}:${kind}`;
  if (sent.includes(key)) return;
  const db = backend();
  const hash = await deviceHash();
  if (!db || !hash) return;
  try {
    const { error } = await db.rpc("record_link_event", {
      link_code: code,
      kind,
      device_hash: hash,
    });
    if (!error) writeJson(SENT_KEY, [key, ...sent].slice(0, 500));
  } catch {
    /* try again next time */
  }
}

// ------------------------------------------------------------- creating links

export interface ShareTarget {
  kind: LinkKind;
  /** Catalogue id, user recipe uuid, or the imported recipe's local id. */
  ref: string;
  title: string;
  sourceCreator?: string | null;
  sourceUrl?: string | null;
}

/** The plain link used when no short link can be made (signed out, offline). */
export function fallbackUrl(target: ShareTarget): string {
  if (target.kind === "catalogue") return `${PUBLIC_ORIGIN}/resep/${target.ref}`;
  if (target.kind === "user") return `${PUBLIC_ORIGIN}/tulisan/${target.ref}`;
  return target.sourceUrl || PUBLIC_ORIGIN;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head?.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bin = atob(body ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * The dish photo for link previews. It is already a canvas re-encode (no
 * EXIF, no location), named by its own hash so sharing twice uploads once.
 */
async function uploadDishPhoto(dataUrl: string, uid: string): Promise<string | null> {
  const db = backend();
  if (!db || !dataUrl.startsWith("data:image/")) return null;
  const path = `${uid}/share/${(await sha256(dataUrl)).slice(0, 24)}.jpg`;
  const { error } = await db.storage
    .from("resep")
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/jpeg" });
  return error ? null : path;
}

/**
 * A short link for this recipe and card format, reused on every share.
 * Null when signed out, offline, or the backend lacks migration 0008.
 */
export async function createShareLink(
  target: ShareTarget,
  format: CardFormat,
  dishPhoto?: string | null,
): Promise<{ code: string; url: string } | null> {
  const db = backend();
  if (!db) return null;
  try {
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return null;
    const photoPath = dishPhoto ? await uploadDishPhoto(dishPhoto, auth.user.id) : null;
    const { data, error } = await db.rpc("create_share_link", {
      kind: target.kind,
      ref: target.ref,
      fmt: format,
      title: target.title.slice(0, 80),
      source_creator: target.sourceCreator ?? null,
      source_url: target.sourceUrl ?? null,
      photo_path: photoPath,
    });
    if (error || typeof data !== "string" || !data) return null;
    markMine(data);
    return { code: data, url: `${PUBLIC_ORIGIN}/r/${data}` };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- public reads

export interface PublicOwner {
  handle: string;
  public_name: string | null;
  photo_path: string | null;
  recipes: { id: string; title: string; photo_path: string | null }[];
}

export interface PublicLink {
  code: string;
  kind: LinkKind;
  ref: string;
  title: string | null;
  source_creator: string | null;
  source_url: string | null;
  photo_path: string | null;
  format: CardFormat;
  serv: number | null;
  time_min: number | null;
  steps: number | null;
  recipe_live: boolean;
  author_handle: string | null;
  owner: PublicOwner | null;
}

export function publicLink(code: string): Promise<PublicLink | null> {
  if (!/^[a-z0-9]{4,12}$/i.test(code)) return Promise.resolve(null);
  return publicRpc<PublicLink | null>("share_link_public", { link_code: code });
}

export interface PublicProfile {
  handle: string;
  public_name: string | null;
  photo_path: string | null;
  recipes: {
    id: string;
    title: string;
    photo_path: string | null;
    serv: number;
    time_min: number | null;
    steps: number;
    cooked_count: number;
    source_creator: string | null;
  }[];
}

export function profileByHandle(handle: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9_.]{3,24}$/i.test(handle)) return Promise.resolve(null);
  return publicRpc<PublicProfile | null>("profile_by_handle", { h: handle.toLowerCase() });
}

// ------------------------------------------------------------- handle

export const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;

export async function myHandle(): Promise<{
  handle: string | null;
  publicName: string | null;
} | null> {
  const db = backend();
  if (!db) return null;
  try {
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await db
      .from("profiles")
      .select("handle, public_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error) return { handle: null, publicName: null };
    const row = data as { handle?: string | null; public_name?: string | null } | null;
    return { handle: row?.handle ?? null, publicName: row?.public_name ?? null };
  } catch {
    return null;
  }
}

/** Null on success, otherwise a message she can act on. */
export async function saveHandle(
  handle: string,
  publicName: string | null,
): Promise<string | null> {
  const h = handle.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_RE.test(h))
    return "Nama pengguna 3–24 huruf kecil, angka, titik atau garis bawah. Tanpa spasi.";
  const name = publicName?.trim() || null;
  if (name && (name.length < 2 || name.length > 40))
    return "Nama tampilan 2–40 huruf, atau kosongkan saja.";
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return "Kamu belum masuk.";
  const { error } = await db
    .from("profiles")
    .update({ handle: h, public_name: name })
    .eq("id", auth.user.id);
  if (!error) return null;
  if (error.code === "23505") return `@${h} sudah dipakai orang lain. Coba yang lain.`;
  if (error.code === "23514") return "Nama pengguna itu tidak bisa dipakai. Coba yang lain.";
  if (error.code === "42703" || error.code === "PGRST204")
    return "Server Racik belum siap untuk nama pengguna. Coba lagi nanti.";
  return "Nama penggunanya belum tersimpan. Coba lagi.";
}

// ------------------------------------------------------------- stats

export interface LinkStat {
  code: string;
  recipe_kind: LinkKind;
  recipe_ref: string;
  title: string | null;
  format: CardFormat;
  created_at: string;
  opens: number;
  saves: number;
  cooks: number;
}

/** Null when the stats cannot be read right now (offline, signed out, no migration). */
export async function myShareStats(): Promise<LinkStat[] | null> {
  const db = backend();
  if (!db) return null;
  try {
    const { data, error } = await db.rpc("my_share_stats");
    if (error || !Array.isArray(data)) return null;
    return (data as LinkStat[]).map((r) => ({
      ...r,
      opens: Number(r.opens) || 0,
      saves: Number(r.saves) || 0,
      cooks: Number(r.cooks) || 0,
    }));
  } catch {
    return null;
  }
}

export interface StatsSummary {
  opens: number;
  saves: number;
  cooks: number;
  top: { key: string; title: string; opens: number; cooks: number } | null;
  byFormat: Record<CardFormat, number>;
  recipes: {
    key: string;
    kind: LinkKind;
    ref: string;
    title: string;
    opens: number;
    saves: number;
    cooks: number;
  }[];
}

/** Totals per recipe (both card formats together), the top recipe, and opens per format. */
export function summarise(
  rows: LinkStat[],
  titleOf: (kind: LinkKind, ref: string) => string | null,
): StatsSummary {
  const byRecipe = new Map<string, StatsSummary["recipes"][number]>();
  const byFormat: Record<CardFormat, number> = { story: 0, feed: 0 };
  for (const r of rows) {
    const key = `${r.recipe_kind}:${r.recipe_ref}`;
    const entry = byRecipe.get(key) ?? {
      key,
      kind: r.recipe_kind,
      ref: r.recipe_ref,
      title: titleOf(r.recipe_kind, r.recipe_ref) ?? r.title ?? "Resep",
      opens: 0,
      saves: 0,
      cooks: 0,
    };
    entry.opens += r.opens;
    entry.saves += r.saves;
    entry.cooks += r.cooks;
    byRecipe.set(key, entry);
    byFormat[r.format] += r.opens;
  }
  const recipes = [...byRecipe.values()].sort((a, b) => b.cooks - a.cooks || b.opens - a.opens);
  const top = recipes[0] && (recipes[0].opens > 0 || recipes[0].cooks > 0) ? recipes[0] : null;
  return {
    opens: recipes.reduce((s, r) => s + r.opens, 0),
    saves: recipes.reduce((s, r) => s + r.saves, 0),
    cooks: recipes.reduce((s, r) => s + r.cooks, 0),
    top: top ? { key: top.key, title: top.title, opens: top.opens, cooks: top.cooks } : null,
    byFormat,
    recipes,
  };
}
