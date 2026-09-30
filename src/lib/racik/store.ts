import type { ImportedRecipe } from "./types";

const DB_NAME = "racik";
const STORE = "state";
const KEY = "app";
const LS_KEY = "racik.state";

export interface RacikState {
  household: number;
  halalMode: boolean;
  saved: string[];
  disliked: string[];
  log: { id: string; at: number }[];
  imported: ImportedRecipe[];
  servings: Record<string, number>;
  intro: boolean;
  plan: { id: string; servings: number }[];
  planChecked: string[];
  ratings: Record<string, ("gampang" | "pas" | "susah")[]>;
  photos: Record<string, string>;
  photoFull: boolean;
  satuan: "rumah" | "gram";
  teks: "normal" | "besar" | "paling_besar";
  /**
   * Where she is in each recipe's cook mode, and any timer she started.
   *
   * Cooking is interrupted constantly — a phone call, a child, the screen
   * sleeping. Holding the step in component state meant coming back to step 1
   * of a fourteen-step rendang. `endsAt` is a wall-clock instant, not a
   * countdown, so a timer is still right after the app has been away: mobile
   * browsers throttle timers in the background and a decrementing counter
   * comes back showing more time left than has actually passed.
   */
  cooking: Record<string, CookProgress>;
  /** Interface language. Recipe content stays Indonesian either way. */
  lang: "id" | "en";
  /** She has seen the sign-in offer and answered it, either way. */
  authAsked: boolean;
  suggestionSeed: number;
}

export interface CookProgress {
  step: number;
  at: number;
  timerStep?: number | undefined;
  /** Wall-clock ms when the running timer finishes. Absent when paused. */
  endsAt?: number | undefined;
  /** Seconds remaining on a paused timer. Absent when running. */
  left?: number | undefined;
}

/** Come back to a recipe a day later and you are starting it again, not resuming. */
export const COOK_RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

export const defaultState: RacikState = {
  household: 4,
  halalMode: false,
  saved: [],
  disliked: [],
  log: [],
  imported: [],
  servings: {},
  intro: false,
  plan: [],
  planChecked: [],
  ratings: {},
  photos: {},
  photoFull: false,
  satuan: "rumah",
  teks: "normal",
  cooking: {},
  lang: "id",
  authAsked: false,
  suggestionSeed: 1,
};

/** A stale payload must never crash the app. Guard every field. */
export function normaliseState(raw: unknown): RacikState {
  const s = (raw ?? {}) as Partial<RacikState>;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const obj = <T>(v: unknown): Record<string, T> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {};
  return {
    household: typeof s.household === "number" ? s.household : 4,
    halalMode: s.halalMode === true,
    saved: arr<string>(s.saved),
    disliked: arr<string>(s.disliked),
    log: arr<{ id: string; at: number }>(s.log).filter((l) => l && typeof l.id === "string"),
    imported: arr<ImportedRecipe>(s.imported)
      .filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.ings) && Array.isArray(item.steps))
      .map((item) => ({ ...item, unmatched: Array.isArray(item.unmatched) ? item.unmatched : [], serv: typeof item.serv === "number" && item.serv > 0 ? item.serv : 4 })),
    servings: obj<number>(s.servings),
    intro: s.intro === true,
    plan: arr<{ id: string; servings: number }>(s.plan).slice(0, 3),
    planChecked: arr<string>(s.planChecked),
    ratings: obj<("gampang" | "pas" | "susah")[]>(s.ratings),
    photos: obj<string>(s.photos),
    photoFull: s.photoFull === true,
    satuan: s.satuan === "gram" ? "gram" : "rumah",
    teks: s.teks === "besar" || s.teks === "paling_besar" ? s.teks : "normal",
    cooking: Object.fromEntries(
      Object.entries(obj<CookProgress>(s.cooking)).filter(
        ([, v]) => v && typeof v.step === "number" && v.step >= 0 && typeof v.at === "number",
      ),
    ),
    lang: s.lang === "en" ? "en" : "id",
    authAsked: s.authAsked === true,
    suggestionSeed: typeof s.suggestionSeed === "number" ? s.suggestionSeed : 1,
  };
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadState(): Promise<RacikState> {
  const db = await openDb();
  if (db) {
    const value = await new Promise<unknown>((resolve) => {
      try {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
    if (value) return normaliseState(value);
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normaliseState(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...defaultState };
}

async function put(state: RacikState): Promise<boolean> {
  const db = await openDb();
  if (db) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    if (ok) return true;
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * On a storage failure the photos go first: recipes and the plan stay.
 * Returns the state actually written, so the caller can show the notice.
 */
export async function saveState(state: RacikState): Promise<RacikState> {
  if (await put(state)) return state;
  const trimmed: RacikState = { ...state, photos: {}, photoFull: true };
  await put(trimmed);
  return trimmed;
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Downscale to 640px and store as JPEG q0.6 before saving. */
export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}
