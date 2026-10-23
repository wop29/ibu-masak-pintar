import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { detectNegaraHere } from "./locale";
import { effectiveLang, setCurrentLang } from "./i18n";
import { importSheetOpen, onImportSheetChange } from "./import-client";
import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  COOK_RESUME_WINDOW_MS,
  clearAll,
  clearLibrary,
  createStateWriter,
  defaultState,
  libraryRecipeCount,
  loadState,
  type CookProgress,
  type RacikState,
} from "./store";
import { useAccount } from "./backend/useAccount";
import { backendConfigured } from "./backend/client";
import { cloudDataForExport, deleteMyAccount, signOut } from "./backend/auth";
import { LibrarySync, pullLibrary, pushLibrary, sameSlice, sliceOf, stampChanges, type SyncStatus } from "./backend/sync";
import { pruneDangling } from "./plan";
import { MergeLibrarySheet, SaveSignInSheet } from "@/components/racik/account/AccountSheets";
import { t } from "@/lib/racik/i18n";

export type SaveKind = "save" | "import";

interface Ctx {
  state: RacikState;
  ready: boolean;
  update: (patch: Partial<RacikState> | ((s: RacikState) => Partial<RacikState>)) => void;
  toggleSaved: (id: string) => void;
  setServings: (id: string, servings: number) => void;
  logCooked: (id: string) => void;
  rate: (id: string, verdict: "gampang" | "pas" | "susah") => void;
  cookProgress: (id: string) => CookProgress | null;
  setCookProgress: (id: string, patch: Partial<CookProgress>) => void;
  clearCookProgress: (id: string) => void;

  /* ---- account & sync ---- */
  /** Signed in (and the account check has finished). */
  signedIn: boolean;
  /** "off" while signed out; "error" means the last try failed and it will retry by itself. */
  syncStatus: SyncStatus;
  /**
   * Ask her to keep her recipes in an account. Throttled: shows on the first
   * save/import while signed out, then again only after a few more saves and a
   * few days. No-op when signed in or when no backend is configured. The
   * provider already calls this by itself when `saved` or `imported` grows
   * while signed out, so most screens never need to.
   */
  promptSaveSignIn: (kind: SaveKind, opts?: { force?: boolean }) => void;
  /**
   * Sign out and clear her library from this phone (device preferences stay).
   * Returns "unsynced" — and does nothing — when recent changes could not be
   * saved to the account first; call again with { force: true } to go anyway.
   */
  signOutAndClear: (opts?: { force?: boolean }) => Promise<"done" | "unsynced">;
  /** "Hapus semua data": wipe this device completely (and sign out of it). The account is untouched. */
  eraseDevice: () => Promise<void>;
  /** Delete the account and everything in it, then clear this phone. Returns an error to show, or null. */
  deleteAccount: () => Promise<string | null>;
  /** "Unduh dataku": a JSON file of everything Racik holds about her. */
  exportData: () => Promise<void>;
}

const RacikContext = createContext<Ctx | null>(null);

/** Nudge again only after this many new saves AND this long since the last nudge. */
const NUDGE_EVERY_ADDS = 3;
const NUDGE_EVERY_MS = 3 * 24 * 60 * 60 * 1000;

export function RacikProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RacikState>(defaultState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef<RacikState>(defaultState);
  const loaded = useRef(false);
  const { account, ready: accountReady } = useAccount();
  const accountId = accountReady ? (account?.id ?? null) : undefined;
  const accountRef = useRef<string | null | undefined>(undefined);
  accountRef.current = accountId;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const syncRef = useRef<LibrarySync | null>(null);
  const [mergeAsk, setMergeAsk] = useState<{ userId: string; count: number } | null>(null);
  const postponedMerge = useRef<string | null>(null);
  const [nudge, setNudge] = useState<SaveKind | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.href });

  /* ---------------------------------------------------------------- persistence */

  const writer = useRef<ReturnType<typeof createStateWriter> | null>(null);
  if (!writer.current) {
    writer.current = createStateWriter((written, requested) => {
      // Storage was full: photos were dropped to keep the recipes. Show that.
      if (written.photoFull && !requested.photoFull && stateRef.current.photos === requested.photos) {
        stateRef.current = { ...stateRef.current, photos: {}, photoFull: true };
        setState(stateRef.current);
      }
    });
  }

  /**
   * The ONE way state changes. Local edits (raw = false) are stamped for sync
   * (a removal becomes a tombstone), and deleting an imported recipe also
   * removes it from the plan, favourites and servings. `raw` is for sync merges
   * and resets, which must not look like fresh local edits.
   */
  const commit = useCallback((fn: (s: RacikState) => RacikState, raw = false) => {
    const prev = stateRef.current;
    let next = fn(prev);
    if (next === prev) return;
    if (!raw) {
      if (next.imported !== prev.imported) {
        const after = new Set(next.imported.map((r) => r.id));
        const removed = prev.imported.filter((r) => !after.has(r.id)).map((r) => r.id);
        if (removed.length) next = pruneDangling(next, removed);
      }
      if (next.plan !== prev.plan && next.plan.length === 0 && next.planChecked.length) next = { ...next, planChecked: [] };
      next = stampChanges(prev, next, Date.now());
      next = maybeNudge(prev, next);
    }
    stateRef.current = next;
    setState(next);
    if (loaded.current) writer.current?.schedule(next);
    // maybeNudge only reads refs and calls setNudge; stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function maybeNudge(prev: RacikState, next: RacikState): RacikState {
    if (!backendConfigured || !loaded.current || accountRef.current !== null) return next;
    const prevSaved = new Set(prev.saved);
    const prevImp = new Set(prev.imported.map((r) => r.id));
    const addedSave = next.saved.some((id) => !prevSaved.has(id));
    const addedImport = next.imported.some((r) => !prevImp.has(r.id));
    if (!addedSave && !addedImport) return next;
    const kind: SaveKind = addedImport ? "import" : "save";
    const now = Date.now();
    const n = next.nudge;
    const due = n.at === 0 || (n.adds + 1 >= NUDGE_EVERY_ADDS && now - n.at >= NUDGE_EVERY_MS);
    if (!due) return { ...next, nudge: { at: n.at, adds: n.adds + 1 } };
    setNudge(kind);
    return { ...next, nudge: { at: now, adds: 0 } };
  }

  useEffect(() => {
    let alive = true;
    loadState().then((s) => {
      if (!alive) return;
      loaded.current = true;
      // A plan slot pointing at a recipe that no longer exists made the plan
      // look full ("Rencana sudah penuh") with nothing in it.
      let clean = pruneDangling(s);
      // Country for measures: detected (connection country → time zone →
      // languages, never GPS) until the person picks one in Pengaturan.
      if (clean.negaraAuto) {
        const negara = detectNegaraHere();
        if (negara !== clean.negara) clean = { ...clean, negara };
      }
      stateRef.current = clean;
      setState(clean);
      if (clean !== s) writer.current?.schedule(clean);
      setReady(true);
    });
    const flush = () => {
      if (document.visibilityState === "hidden") void writer.current?.flush();
    };
    const flushNow = () => void writer.current?.flush();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushNow);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushNow);
    };
  }, []);

  /* ---------------------------------------------------------------- sync */

  const stopSync = useCallback(() => {
    syncRef.current?.stop();
    syncRef.current = null;
    setSyncStatus("off");
  }, []);

  const startSync = useCallback(
    (userId: string) => {
      stopSync();
      // From here this phone's library belongs to this account.
      if (stateRef.current.owner !== userId) commit((s) => ({ ...s, owner: userId }), true);
      const sync = new LibrarySync(userId, {
        pull: (id) => pullLibrary(id),
        push: (id, slice) => pushLibrary(id, slice),
        get: () => stateRef.current,
        set: (next) => commit(() => next, true),
        onStatus: setSyncStatus,
      });
      syncRef.current = sync;
      void sync.sync();
    },
    [commit, stopSync],
  );

  // Account changes: decide whose library this is before anything syncs.
  useEffect(() => {
    if (!ready || accountId === undefined) return;
    if (syncRef.current && syncRef.current.userId !== accountId) stopSync();
    if (accountId === null) {
      setMergeAsk(null);
      return;
    }
    setNudge(null);
    if (syncRef.current) return;
    const s = stateRef.current;
    if (s.owner === accountId) return startSync(accountId);
    if (s.owner && s.owner !== accountId) {
      // Another account's library (its session ended without "Keluar"): never merge it into this one.
      commit((x) => clearLibrary(x), true);
      return startSync(accountId);
    }
    const count = libraryRecipeCount(s);
    if (count === 0) return startSync(accountId);
    if (postponedMerge.current === accountId) return;
    setMergeAsk({ userId: accountId, count });
  }, [ready, accountId, commit, startSync, stopSync]);

  // Push later changes, debounced. Never before the first successful pull+merge.
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync || !sync.ready) return;
    if (sameSlice(sync.lastSynced, sliceOf(state))) return;
    const t = setTimeout(() => void sync.sync(), 1500);
    return () => clearTimeout(t);
  }, [state]);

  // Coming back online or back to the app: pick up what other phones changed.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void syncRef.current?.sync();
    };
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, []);

  useEffect(() => () => syncRef.current?.stop(), []);

  /* ---------------------------------------------------------------- account actions */

  const promptSaveSignIn = useCallback<Ctx["promptSaveSignIn"]>(
    (kind, opts) => {
      if (!backendConfigured || accountRef.current !== null) return;
      if (opts?.force) {
        setNudge(kind);
        return;
      }
      commit((s) => {
        const n = s.nudge;
        const now = Date.now();
        if (n.at === 0 || (n.adds >= NUDGE_EVERY_ADDS && now - n.at >= NUDGE_EVERY_MS)) {
          setNudge(kind);
          return { ...s, nudge: { at: now, adds: 0 } };
        }
        return s;
      }, true);
    },
    [commit],
  );

  const resetLocal = useCallback(
    async (full: boolean) => {
      writer.current?.cancel();
      const next = full ? { ...defaultState } : clearLibrary(stateRef.current);
      stateRef.current = next;
      setState(next);
      if (full) await clearAll();
      await writer.current?.flush();
      writer.current?.schedule(next);
      await writer.current?.flush();
    },
    [],
  );

  const signOutAndClear = useCallback<Ctx["signOutAndClear"]>(
    async (opts) => {
      const sync = syncRef.current;
      if (!opts?.force) {
        if (sync) {
          if (!sync.ready || sync.hasUnsynced()) {
            const ok = await Promise.race([sync.sync(), new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
            if (!ok) return "unsynced";
          }
        } else if (stateRef.current.owner === null && libraryRecipeCount(stateRef.current) > 0) {
          // Signed in but she has not yet said whether to merge: these recipes are only on this phone.
          return "unsynced";
        }
      }
      stopSync();
      setMergeAsk(null);
      await signOut();
      await resetLocal(false);
      return "done";
    },
    [resetLocal, stopSync],
  );

  const eraseDevice = useCallback(async () => {
    // Stop sync FIRST, so the emptied library can never be pushed over the account.
    stopSync();
    setMergeAsk(null);
    if (accountRef.current) await signOut();
    await resetLocal(true);
  }, [resetLocal, stopSync]);

  const deleteAccount = useCallback(async () => {
    const sync = syncRef.current;
    sync?.stop();
    const err = await deleteMyAccount();
    if (err) {
      // Not deleted: carry on syncing as before.
      if (sync && accountRef.current) startSync(sync.userId);
      return err;
    }
    syncRef.current = null;
    setSyncStatus("off");
    setMergeAsk(null);
    await resetLocal(false);
    return null;
  }, [resetLocal, startSync]);

  const exportData = useCallback(async () => {
    const s = stateRef.current;
    const cloud = accountRef.current ? await cloudDataForExport() : null;
    const { photos, ...device } = s;
    const payload = {
      app: "Racik",
      format: 1,
      exportedAt: new Date().toISOString(),
      note: t("export_note"),
      device: { ...device, photos: Object.keys(photos) },
      devicePhotos: photos,
      account: cloud,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `racik-dataku-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);

  /* ---------------------------------------------------------------- everyday edits */

  const update = useCallback<Ctx["update"]>(
    (patch) => commit((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) })),
    [commit],
  );

  const toggleSaved = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        saved: prev.saved.includes(id) ? prev.saved.filter((s) => s !== id) : [id, ...prev.saved],
      }));
    },
    [commit],
  );

  const setServings = useCallback(
    (id: string, servings: number) => {
      commit((prev) => ({ ...prev, servings: { ...prev.servings, [id]: servings } }));
    },
    [commit],
  );

  const logCooked = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        log: [{ id, at: Date.now() }, ...prev.log.filter((l) => l.id !== id)].slice(0, 50),
      }));
    },
    [commit],
  );

  const rate = useCallback(
    (id: string, verdict: "gampang" | "pas" | "susah") => {
      commit((prev) => ({
        ...prev,
        ratings: { ...prev.ratings, [id]: [...(prev.ratings[id] ?? []), verdict] },
      }));
    },
    [commit],
  );

  /** Only resumes a session she was in recently — see COOK_RESUME_WINDOW_MS. */
  const cookProgress = useCallback(
    (id: string) => {
      const p = state.cooking[id];
      if (!p) return null;
      return Date.now() - p.at > COOK_RESUME_WINDOW_MS ? null : p;
    },
    [state.cooking],
  );

  const setCookProgress = useCallback(
    (id: string, patch: Partial<CookProgress>) => {
      commit((prev) => {
        const current = prev.cooking[id] ?? { step: 0, at: Date.now() };
        return { ...prev, cooking: { ...prev.cooking, [id]: { ...current, ...patch, at: Date.now() } } };
      });
    },
    [commit],
  );

  const clearCookProgress = useCallback(
    (id: string) => {
      commit((prev) => {
        if (!(id in prev.cooking)) return prev;
        const next = { ...prev.cooking };
        delete next[id];
        return { ...prev, cooking: next };
      });
    },
    [commit],
  );

  const signedIn = accountId != null;
  const value = useMemo(
    () => ({
      state,
      ready,
      update,
      toggleSaved,
      setServings,
      logCooked,
      rate,
      cookProgress,
      setCookProgress,
      clearCookProgress,
      signedIn,
      syncStatus,
      promptSaveSignIn,
      signOutAndClear,
      eraseDevice,
      deleteAccount,
      exportData,
    }),
    [state, ready, update, toggleSaved, setServings, logCooked, rate, cookProgress, setCookProgress, clearCookProgress, signedIn, syncStatus, promptSaveSignIn, signOutAndClear, eraseDevice, deleteAccount, exportData],
  );

  const onMasuk = pathname.startsWith("/masuk");
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => onImportSheetChange(() => setImportOpen(importSheetOpen())), []);

  // The interface language for everything rendered below this provider (t() reads it).
  const uiLang = effectiveLang(state.lang);
  setCurrentLang(uiLang);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = uiLang;
  }, [uiLang]);

  return (
    <RacikContext.Provider value={value}>
      <div>
        {children}
        <SaveSignInSheet
          open={nudge !== null && !onMasuk && !importOpen}
          kind={nudge ?? "save"}
          onLater={() => setNudge(null)}
          onSignIn={() => {
            setNudge(null);
            void navigate({ to: "/masuk", search: { next: pathname } });
          }}
        />
        <MergeLibrarySheet
          open={mergeAsk !== null}
          count={mergeAsk?.count ?? 0}
          onMerge={() => {
            const ask = mergeAsk;
            setMergeAsk(null);
            if (ask && accountRef.current === ask.userId) startSync(ask.userId);
          }}
          onReplace={() => {
            const ask = mergeAsk;
            setMergeAsk(null);
            if (ask && accountRef.current === ask.userId) {
              commit((x) => clearLibrary(x), true);
              startSync(ask.userId);
            }
          }}
          onLater={() => {
            // Asked again next time the app opens; nothing syncs until she answers.
            postponedMerge.current = mergeAsk?.userId ?? null;
            setMergeAsk(null);
          }}
        />
      </div>
    </RacikContext.Provider>
  );
}

export function useRacik(): Ctx {
  const ctx = useContext(RacikContext);
  if (!ctx) throw new Error("useRacik must be used inside RacikProvider");
  return ctx;
}

/**
 * For screens that save or import: call the returned function right after
 * the save. It shows "Simpan resepmu ke akun" when she is signed out (throttled,
 * never every tap). The provider already does this by itself whenever
 * `saved` or `imported` grows, so calling it is only needed for other kinds
 * of "keep" actions.
 */
export function useRequireAccountForSave(): (kind?: SaveKind) => void {
  const { promptSaveSignIn } = useRacik();
  return useCallback((kind: SaveKind = "save") => promptSaveSignIn(kind), [promptSaveSignIn]);
}
