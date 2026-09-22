import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { defaultState, loadState, saveState, type RacikState } from "./store";

interface Ctx {
  state: RacikState;
  ready: boolean;
  update: (patch: Partial<RacikState> | ((s: RacikState) => Partial<RacikState>)) => void;
  toggleSaved: (id: string) => void;
  setServings: (id: string, servings: number) => void;
  logCooked: (id: string) => void;
  rate: (id: string, verdict: "gampang" | "pas" | "susah") => void;
}

const RacikContext = createContext<Ctx | null>(null);

export function RacikProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RacikState>(defaultState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    loadState().then((s) => {
      if (!alive) return;
      loaded.current = true;
      setState(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    let alive = true;
    saveState(state).then((written) => {
      if (alive && written.photoFull && !state.photoFull) setState(written);
    });
    return () => {
      alive = false;
    };
  }, [state]);

  const update = useCallback<Ctx["update"]>((patch) => {
    setState((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      saved: prev.saved.includes(id) ? prev.saved.filter((s) => s !== id) : [id, ...prev.saved],
    }));
  }, []);

  const setServings = useCallback((id: string, servings: number) => {
    setState((prev) => ({ ...prev, servings: { ...prev.servings, [id]: servings } }));
  }, []);

  const logCooked = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      log: [{ id, at: Date.now() }, ...prev.log.filter((l) => l.id !== id)].slice(0, 50),
    }));
  }, []);

  const rate = useCallback((id: string, verdict: "gampang" | "pas" | "susah") => {
    setState((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [id]: [...(prev.ratings[id] ?? []), verdict] },
    }));
  }, []);

  const value = useMemo(
    () => ({ state, ready, update, toggleSaved, setServings, logCooked, rate }),
    [state, ready, update, toggleSaved, setServings, logCooked, rate],
  );

  return (
    <RacikContext.Provider value={value}>
      <div className={state.teks === "besar" ? "[font-size:17px]" : state.teks === "paling_besar" ? "[font-size:18px]" : ""}>{children}</div>
    </RacikContext.Provider>
  );
}

export function useRacik(): Ctx {
  const ctx = useContext(RacikContext);
  if (!ctx) throw new Error("useRacik must be used inside RacikProvider");
  return ctx;
}
