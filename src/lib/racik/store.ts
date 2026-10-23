import type { ImportedRecipe } from "./types";
import { isNegara, type Negara } from "./locale";

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
  /** What they usually cook for — set at onboarding. Old answers (keluarga/sendiri/kos) read as "harian". */
  cookingFor?: "harian" | "bekal" | "acara" | "jualan";
  /** What she most wants from Racik — weights what the home screen leads with. */
  priority?: "cepat" | "sehat" | "hemat" | "daerah";
  /** Onboarding: what matters when choosing a recipe (multi). The first one becomes the opening home filter. */
  priorities: string[];
  /** Onboarding: proteins cooked most often (multi). Leads the home suggestions. */
  proteins: string[];
  /**
   * When each library entry was last added or removed, in ms, keyed
   * `saved:<id>`, `disliked:<id>`, `imported:<id>`, `plan:<id>`, `checked:<key>`.
   * A key here whose entry is absent from its list is a tombstone: it is how a
   * removal on one phone reaches the others instead of being unioned back.
   * Written centrally by stampChanges (backend/sync.ts), never by screens.
   */
  stamps: Record<string, number>;
  /**
   * The account this device's library belongs to. Null while signed out
   * (the library is "on this phone only"). Lets sign-in tell her own
   * anonymous library (ask before merging) from another account's (never merge).
   */
  owner: string | null;
  /** The gentle "simpan ke akun" nudge: when it last showed and how many saves since. Device only. */
  nudge: { at: number; adds: number };
  /**
   * Country for measures, local names and shopping rounding. Detected on first
   * run (Cloudflare country → time zone → languages); `negaraAuto` stays true
   * until the person picks one in Pengaturan, so detection may refresh it.
   */
  negara: Negara;
  negaraAuto: boolean;
  /** Ingredient ids already at home for the current shopping plan ("sudah ada di rumah"). */
  pantryHave: string[];
}

/** One portion range everywhere: home, settings, recipe page, plan. */
export const PORTION_MIN = 1;
export const PORTION_MAX = 20;
export const clampPortions = (v: unknown, fallback = 4): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(PORTION_MAX, Math.max(PORTION_MIN, n));
};
/** Recipes in the week's cooking plan at once (decided 22 Oct 2026: 15 a week). */
export const PLAN_MAX = 15;

/** One step's countdown. Several can run at once (rice on step 2, sambal on step 5). */
export interface CookTimer {
  /** Full length in seconds, for "Ulangi". */
  total: number;
  /** Wall-clock ms when it finishes. Absent when paused. At or past now = ringing until dismissed. */
  endsAt?: number | undefined;
  /** Seconds remaining while paused. Absent when running. */
  left?: number | undefined;
}

export interface CookProgress {
  step: number;
  at: number;
  /** Timers by step index (as a string key). Absent entries are idle. */
  timers?: Record<string, CookTimer> | undefined;
  /** Mise-en-place ticks: `l:<line index>` (older saves hold ingredient ids), remembered across steps and interruptions. */
  checked?: string[] | undefined;
  /** @deprecated Single-timer shape before Oct 2026; folded into `timers` on load. */
  timerStep?: number | undefined;
  /** @deprecated See timerStep. */
  endsAt?: number | undefined;
  /** @deprecated See timerStep. */
  left?: number | undefined;
}

/** Come back to a recipe a day later and you are starting it again, not resuming. */
export const COOK_RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validate one saved cook session and move the old single timer into `timers`. Null when unusable. */
export function normaliseCook(v: unknown): CookProgress | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<CookProgress>;
  if (!num(p.step) || p.step < 0 || !num(p.at)) return null;
  const timers: Record<string, CookTimer> = {};
  const raw = p.timers && typeof p.timers === "object" ? p.timers : {};
  for (const [k, t] of Object.entries(raw)) {
    if (!/^\d+$/.test(k) || !t || typeof t !== "object" || !num(t.total) || t.total <= 0) continue;
    if (num(t.endsAt)) timers[k] = { total: t.total, endsAt: t.endsAt };
    else if (num(t.left) && t.left >= 0) timers[k] = { total: t.total, left: t.left };
  }
  if (num(p.timerStep) && p.timerStep >= 0 && !timers[String(p.timerStep)]) {
    // The old shape did not keep the full length; the step's own seconds fill it in on screen.
    const total = Math.max(1, Math.round(num(p.left) ? p.left : num(p.endsAt) ? (p.endsAt - p.at) / 1000 : 0));
    if (num(p.endsAt)) timers[String(p.timerStep)] = { total, endsAt: p.endsAt };
    else if (num(p.left) && p.left > 0) timers[String(p.timerStep)] = { total, left: p.left };
  }
  const checked = Array.isArray(p.checked) ? p.checked.filter((x): x is string => typeof x === "string") : [];
  return { step: Math.floor(p.step), at: p.at, timers, checked };
}

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
  priorities: [],
  proteins: [],
  stamps: {},
  owner: null,
  nudge: { at: 0, adds: 0 },
  negara: "ID",
  negaraAuto: true,
  pantryHave: [],
};

/**
 * Fields that belong to the person (her library) rather than to the device.
 * Cleared on sign-out so the next person on a shared phone starts clean.
 */
export const LIBRARY_KEYS = [
  "saved",
  "disliked",
  "log",
  "imported",
  "servings",
  "plan",
  "planChecked",
  "pantryHave",
  "ratings",
  "photos",
  "photoFull",
  "cooking",
  "stamps",
] as const satisfies readonly (keyof RacikState)[];

/** Everything of hers goes; device comfort (text size, units, household, language, onboarding) stays. */
export function clearLibrary(s: RacikState): RacikState {
  const next: RacikState = { ...s, owner: null, nudge: { at: 0, adds: 0 } };
  for (const k of LIBRARY_KEYS) (next as unknown as Record<string, unknown>)[k] = structuredCloneDefault(k);
  return next;
}
function structuredCloneDefault(k: (typeof LIBRARY_KEYS)[number]): unknown {
  const v = defaultState[k];
  return Array.isArray(v) ? [] : v && typeof v === "object" ? {} : v;
}

/** How many recipes her library holds (saved, imported or planned) — used to ask before merging. */
export function libraryRecipeCount(s: Pick<RacikState, "saved" | "imported" | "plan">): number {
  return new Set([...s.saved, ...s.imported.map((r) => r.id), ...s.plan.map((p) => p.id)]).size;
}

const safeUrl = (v: unknown): string => {
  if (typeof v !== "string" || !v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? v : "";
  } catch {
    return "";
  }
};

/** A stale payload must never crash the app. Guard every field. */
export function normaliseState(raw: unknown): RacikState {
  const s = (raw ?? {}) as Partial<RacikState>;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const obj = <T>(v: unknown): Record<string, T> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {};
  const strings = (v: unknown): string[] => [...new Set(arr<unknown>(v).filter((x): x is string => typeof x === "string" && x.length > 0))];
  const household = clampPortions(s.household, 4);
  const seenPlan = new Set<string>();
  const seenImport = new Set<string>();
  return {
    household,
    halalMode: s.halalMode === true,
    saved: strings(s.saved),
    disliked: strings(s.disliked),
    log: arr<{ id: string; at: number }>(s.log)
      .filter((l) => l && typeof l.id === "string")
      .map((l) => ({ id: l.id, at: typeof l.at === "number" && Number.isFinite(l.at) ? l.at : 0 })),
    imported: arr<ImportedRecipe>(s.imported)
      .filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.ings) && Array.isArray(item.steps))
      .filter((item) => !seenImport.has(item.id) && Boolean(seenImport.add(item.id)))
      .map((item) => ({
        ...item,
        unmatched: Array.isArray(item.unmatched) ? item.unmatched.filter((u) => typeof u === "string") : [],
        serv: clampPortions(item.serv, 4),
        sourceUrl: safeUrl(item.sourceUrl),
        importedAt: typeof item.importedAt === "number" && Number.isFinite(item.importedAt) ? item.importedAt : 0,
        bahasaAsal: typeof item.bahasaAsal === "string" && item.bahasaAsal ? item.bahasaAsal.slice(0, 40) : null,
        swaps: Object.fromEntries(
          Object.entries(obj<unknown>(item.swaps)).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0),
        ),
        ...(typeof item.photoUrl === "string" && !item.photoUrl.startsWith("data:image/") && !safeUrl(item.photoUrl) ? { photoUrl: null } : {}),
      })),
    servings: Object.fromEntries(
      Object.entries(obj<unknown>(s.servings))
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => [k, clampPortions(v)]),
    ),
    intro: s.intro === true,
    plan: arr<{ id: string; servings: number }>(s.plan)
      .filter((p) => p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0)
      .filter((p) => !seenPlan.has(p.id) && Boolean(seenPlan.add(p.id)))
      .map((p) => ({ id: p.id, servings: clampPortions(p.servings, household) }))
      .slice(0, PLAN_MAX),
    planChecked: strings(s.planChecked),
    pantryHave: strings(s.pantryHave),
    negara: isNegara(s.negara) ? s.negara : "ID",
    negaraAuto: s.negaraAuto !== false,
    ratings: Object.fromEntries(
      Object.entries(obj<unknown>(s.ratings))
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, (v as unknown[]).filter((x): x is "gampang" | "pas" | "susah" => x === "gampang" || x === "pas" || x === "susah")]),
    ),
    stamps: Object.fromEntries(
      Object.entries(obj<unknown>(s.stamps)).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
    ) as Record<string, number>,
    owner: typeof s.owner === "string" && s.owner ? s.owner : null,
    nudge: {
      at: typeof s.nudge?.at === "number" ? s.nudge.at : 0,
      adds: typeof s.nudge?.adds === "number" ? s.nudge.adds : 0,
    },
    photos: Object.fromEntries(Object.entries(obj<unknown>(s.photos)).filter(([, v]) => typeof v === "string")) as Record<string, string>,
    photoFull: s.photoFull === true,
    satuan: s.satuan === "gram" ? "gram" : "rumah",
    teks: s.teks === "besar" || s.teks === "paling_besar" ? s.teks : "normal",
    cooking: Object.fromEntries(
      Object.entries(obj<unknown>(s.cooking)).flatMap(([k, v]) => {
        const p = normaliseCook(v);
        return p ? [[k, p] as const] : [];
      }),
    ),
    lang: s.lang === "en" ? "en" : "id",
    authAsked: s.authAsked === true,
    suggestionSeed: typeof s.suggestionSeed === "number" ? s.suggestionSeed : 1,
    priorities: arr<string>(s.priorities).filter((x) => typeof x === "string"),
    proteins: arr<string>(s.proteins).filter((x) => typeof x === "string"),
    ...((["harian", "bekal", "acara", "jualan"] as const).includes(s.cookingFor as never)
      ? { cookingFor: s.cookingFor }
      : (["keluarga", "sendiri", "kos"] as const).includes(s.cookingFor as never)
        ? { cookingFor: "harian" as const }
        : {}),
    ...((["cepat", "sehat", "hemat", "daerah"] as const).includes(s.priority as never) ? { priority: s.priority } : {}),
  };
}

const PHOTO_KEY = "photos";
const LS_PHOTO_KEY = "racik.photos";

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
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
  // A failed open is retried next time rather than cached forever.
  void dbPromise.then((db) => {
    if (!db) dbPromise = null;
  });
  return dbPromise;
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise<unknown>((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Photos live under their own key. They are the only large thing in the
 * state, and writing them again on every tap (a cook-mode step, a ticked
 * ingredient) made each tap re-serialise every photo she ever took.
 */
export async function loadState(): Promise<RacikState> {
  const db = await openDb();
  if (db) {
    const value = await idbGet(db, KEY);
    if (value) {
      const photos = await idbGet(db, PHOTO_KEY);
      const s = normaliseState(value);
      // Older builds kept photos inside the main record; keep those if the split key is empty.
      if (photos && typeof photos === "object") s.photos = normaliseState({ photos }).photos;
      return s;
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = normaliseState(JSON.parse(raw));
      const photos = localStorage.getItem(LS_PHOTO_KEY);
      if (photos) s.photos = normaliseState({ photos: JSON.parse(photos) }).photos;
      return s;
    }
  } catch {
    /* ignore */
  }
  return { ...defaultState };
}

async function put(key: "main" | "photos", value: unknown): Promise<boolean> {
  const db = await openDb();
  if (db && (await idbPut(db, key === "main" ? KEY : PHOTO_KEY, value))) return true;
  try {
    localStorage.setItem(key === "main" ? LS_KEY : LS_PHOTO_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let lastPhotos: Record<string, string> | null = null;

/**
 * Write the state. Photos are written only when they changed.
 * On a storage failure the photos go first: recipes and the plan stay.
 * Returns the state actually written, so the caller can show the notice.
 */
export async function saveState(state: RacikState): Promise<RacikState> {
  const { photos, ...main } = state;
  const okMain = await put("main", { ...main, photos: {} });
  let okPhotos = true;
  if (photos !== lastPhotos) {
    okPhotos = await put("photos", photos);
    if (okPhotos) lastPhotos = photos;
  }
  if (okMain && okPhotos) return state;
  const trimmed: RacikState = { ...state, photos: {}, photoFull: true };
  await put("photos", {});
  lastPhotos = trimmed.photos;
  await put("main", { ...trimmed, photos: {} });
  return trimmed;
}

/**
 * A debounced writer: taps update memory at once and the disk a moment later,
 * coalesced. `flush()` writes now (call it when the page is being hidden).
 */
export function createStateWriter(onWritten: (written: RacikState, requested: RacikState) => void, delayMs = 400) {
  let pending: RacikState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const run = () => {
    timer = null;
    const s = pending;
    pending = null;
    if (!s) return chain;
    chain = chain.then(async () => {
      const written = await saveState(s);
      onWritten(written, s);
    });
    return chain;
  };
  return {
    schedule(s: RacikState) {
      pending = s;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush(): Promise<void> {
      if (timer) clearTimeout(timer);
      return run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

export async function clearAll(): Promise<void> {
  lastPhotos = null;
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.objectStore(STORE).delete(PHOTO_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_PHOTO_KEY);
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
