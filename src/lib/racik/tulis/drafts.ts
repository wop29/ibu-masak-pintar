import type { RecipeStatus } from "../backend/types";

/**
 * Recipes she is writing, kept on this device until she publishes. Writing
 * needs no account and no connection; only publishing does.
 */
export interface TulisDraft {
  id: string;
  /** Set once the recipe exists on the server. */
  remoteId?: string;
  status?: RecipeStatus;
  hiddenReason?: string | null;
  title: string;
  serv: number;
  /** Minutes, or null when not filled in. */
  time: number | null;
  note: string;
  ings: string[];
  steps: string[];
  /** Canvas re-encoded JPEG data URL: no EXIF, no location. */
  photo: string | null;
  photoPath?: string | null;
  sourceCreator?: string | undefined;
  sourceUrl?: string | undefined;
  updatedAt: number;
}

const KEY = "racik.tulis.drafts";

export function emptyDraft(): TulisDraft {
  return {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    serv: 4,
    time: null,
    note: "",
    ings: ["", "", ""],
    steps: ["", ""],
    photo: null,
    updatedAt: Date.now(),
  };
}

export function loadDrafts(): TulisDraft[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as TulisDraft[]) : [];
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/** False when the device refused (storage full, private mode). */
export function saveDraftLocal(draft: TulisDraft): boolean {
  const list = loadDrafts().filter((d) => d.id !== draft.id);
  const next = [{ ...draft, updatedAt: Date.now() }, ...list];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    // Photos are the heavy part: keep the words, drop the picture.
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(next.map((d) => (d.id === draft.id ? { ...d, photo: null } : d))),
      );
    } catch {
      return false;
    }
    return false;
  }
}

export function deleteDraftLocal(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadDrafts().filter((d) => d.id !== id)));
  } catch {
    /* nothing to do */
  }
}

export function draftById(id: string): TulisDraft | null {
  return loadDrafts().find((d) => d.id === id || d.remoteId === id) ?? null;
}
