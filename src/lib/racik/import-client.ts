/**
 * Browser-side helpers for Tambah Resep: who is asking (device id + session
 * token), shrinking photos before upload, timeouts, and keeping an import
 * alive across a reload (in-flight marker + the result stashed the moment it
 * arrives).
 */
import { backend } from "./backend/client";
import type { ImportSource } from "./import-quota";
import type { ImportErrorCode } from "./import-messages";
import type { ImportedRecipe } from "./types";

// ---- Storage, always guarded (private mode, blocked storage, previews) ----

function lsGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the import still works, it just cannot resume */
  }
}
function lsDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---- Identity -------------------------------------------------------------

const DEVICE_KEY = "racik.deviceId";

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(
      0,
      32,
    );
  }
}

/** A random id this phone keeps, so signed-out imports have their own monthly allowance. */
export function deviceId(): string {
  const existing = lsGet(DEVICE_KEY);
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomId();
  lsSet(DEVICE_KEY, id);
  return id;
}

/** The signed-in session's access token, if any. The server verifies it. */
export async function accessToken(): Promise<string | undefined> {
  try {
    const db = backend();
    if (!db) return undefined;
    const { data } = await db.auth.getSession();
    return data.session?.access_token ?? undefined;
  } catch {
    return undefined;
  }
}

export async function identity(): Promise<{ deviceId: string; token?: string }> {
  const token = await accessToken();
  return { deviceId: deviceId(), ...(token ? { token } : {}) };
}

// ---- Sizes ----------------------------------------------------------------

/** Same numbers as the server. */
export const CLIENT_MAX_VIDEO_BYTES = 14_000_000;
export const CLIENT_MAX_PHOTO_BYTES = 4_000_000;
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;

/** Long edge to `max`, never upscaled. */
export function fitWithin(
  width: number,
  height: number,
  max = PHOTO_MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Shrinks a recipe photo to ~1600 px JPEG q0.8 (a few hundred KB). Drawing to
 * a canvas also drops the EXIF block, including the location. When the
 * browser cannot decode the photo (HEIC on Android Chrome), a small original
 * is sent as it is; a large one is refused with a plain message.
 */
export async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY),
    );
    if (!blob) throw new Error("no blob");
    return new File([blob], (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    if (file.type.startsWith("image/") && file.size <= CLIENT_MAX_PHOTO_BYTES) return file;
    throw new ImportClientError("photo_unreadable");
  }
}

export class ImportClientError extends Error {
  constructor(public code: ImportErrorCode) {
    super(code);
    this.name = "ImportClientError";
  }
}

/** Checked before uploading, so a 40 MB video is refused at once instead of after a long upload. */
export function videoFileProblem(file: {
  size: number;
  type: string;
  name: string;
}): ImportErrorCode | null {
  if (file.size === 0) return "file_missing";
  if (file.size > CLIENT_MAX_VIDEO_BYTES) return "file_too_big";
  const type = file.type.toLowerCase();
  if (type && !/^(video|audio)\//.test(type) && type !== "application/octet-stream")
    return "file_type";
  if (!type && !/\.(mp4|m4v|mov|webm|3gp|m4a|mp3|aac|ogg|opus|wav)$/i.test(file.name))
    return "file_type";
  return null;
}

// ---- Timeouts -------------------------------------------------------------

/** The server gives up first (55–105 s); this only catches a connection that never answers. */
export const CLIENT_TIMEOUT_MS: Record<ImportSource, number> = {
  teks: 70_000,
  link: 75_000,
  foto: 80_000,
  suara: 120_000,
  berkas: 150_000,
};

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("timeout");
      error.name = "TimeoutError";
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// ---- Surviving a reload ---------------------------------------------------

const INFLIGHT_KEY = "racik.importInFlight";
const STASH_KEY = "racik.importResult";
/** Older than this, a marker is a leftover, not an import still running. */
export const INFLIGHT_MAX_AGE_MS = 4 * 60 * 1000;

export interface InFlight {
  requestId: string;
  source: ImportSource;
  startedAt: number;
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const h = randomId().padEnd(32, "0").slice(0, 32);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }
}

export function markInFlight(entry: InFlight) {
  lsSet(INFLIGHT_KEY, JSON.stringify(entry));
}

export function clearInFlight(requestId?: string) {
  if (requestId) {
    const current = readInFlight();
    if (current && current.requestId !== requestId) return;
  }
  lsDel(INFLIGHT_KEY);
}

export function readInFlight(now = Date.now()): InFlight | null {
  const raw = lsGet(INFLIGHT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InFlight>;
    if (
      typeof parsed.requestId !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.source !== "string"
    )
      return null;
    if (now - parsed.startedAt > INFLIGHT_MAX_AGE_MS) return null;
    return parsed as InFlight;
  } catch {
    return null;
  }
}

/**
 * True while an import is running on this device. The update prompt can use
 * this to wait: `import { importInFlight } from "@/lib/racik/import-client"`.
 */
export function importInFlight(): boolean {
  return readInFlight() != null;
}

/** Written the moment a result arrives, before any UI, so a reload cannot lose it. */
export function stashResult(recipe: ImportedRecipe, notice: string | null) {
  lsSet(STASH_KEY, JSON.stringify({ recipe, notice, at: Date.now() }));
}

export function takeStashed(): { recipe: ImportedRecipe; notice: string | null } | null {
  const raw = lsGet(STASH_KEY);
  if (!raw) return null;
  lsDel(STASH_KEY);
  try {
    const parsed = JSON.parse(raw) as {
      recipe?: ImportedRecipe;
      notice?: string | null;
      at?: number;
    };
    if (!parsed.recipe || typeof parsed.recipe.id !== "string") return null;
    // Only a bridge over a reload: an old stash may be a recipe she has since deleted.
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > 10 * 60 * 1000) return null;
    return { recipe: parsed.recipe, notice: parsed.notice ?? null };
  } catch {
    return null;
  }
}

export function clearStash() {
  lsDel(STASH_KEY);
}

/** Several sheets can be mounted at once (tab bar, Koleksi, /ambil). Only one recovers. */
let recoveryClaimed = false;
export function claimRecovery(): boolean {
  if (recoveryClaimed) return false;
  recoveryClaimed = true;
  return true;
}

// ---- Account integration --------------------------------------------------

type SavedSignedOutListener = (recipe: ImportedRecipe) => void;
const savedSignedOutListeners = new Set<SavedSignedOutListener>();

/**
 * Integration point for the sign-in-on-save prompt. Called after an import is
 * saved on this device while nobody is signed in:
 *
 *   useEffect(() => onSavedSignedOut((recipe) => offerSignIn(recipe)), []);
 *
 * Returns the unsubscribe function.
 */
export function onSavedSignedOut(listener: SavedSignedOutListener): () => void {
  savedSignedOutListeners.add(listener);
  return () => {
    savedSignedOutListeners.delete(listener);
  };
}

export function notifySavedSignedOut(recipe: ImportedRecipe) {
  for (const listener of savedSignedOutListeners) {
    try {
      listener(recipe);
    } catch (error) {
      console.error("[racik-import] onSavedSignedOut listener failed", error);
    }
  }
}

/**
 * Whether an import sheet is on screen. The account nudge ("Simpan resepmu ke
 * akun") waits until it closes, so it never stacks on top of "Resep tersimpan".
 */
let sheetsOpen = 0;
const sheetListeners = new Set<() => void>();
export function setImportSheetOpen(open: boolean) {
  sheetsOpen = Math.max(0, sheetsOpen + (open ? 1 : -1));
  sheetListeners.forEach((fn) => fn());
}
export function importSheetOpen(): boolean {
  return sheetsOpen > 0;
}
export function onImportSheetChange(fn: () => void): () => void {
  sheetListeners.add(fn);
  return () => sheetListeners.delete(fn);
}
