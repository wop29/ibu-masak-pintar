import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * One shared undo bar (design plan task 9). One message at a time, above the
 * tab bar, 6 seconds, one action. Never shown in cook mode.
 */
export interface SnackbarMessage {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SnackbarApi {
  show: (m: SnackbarMessage) => void;
  hide: () => void;
}

const Ctx = createContext<SnackbarApi>({ show: () => {}, hide: () => {} });

export const SNACKBAR_MS = 6000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarMessage & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inCookMode = /\/masak\/?$/.test(pathname);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const show = useCallback((m: SnackbarMessage) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent({ ...m, key: Date.now() });
    timer.current = setTimeout(() => setCurrent(null), SNACKBAR_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 mx-auto w-full max-w-[430px] px-4"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        {current && !inCookMode ? (
          <div
            key={current.key}
            className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl bg-dark px-4 py-2 text-15 text-primary-foreground shadow-toast"
          >
            <span className="min-w-0 flex-1">{current.message}</span>
            {current.actionLabel && current.onAction ? (
              <button
                type="button"
                onClick={() => { const act = current.onAction; hide(); act?.(); }}
                className="-my-1 min-h-11 shrink-0 rounded-xl px-3 text-15 font-bold text-primary-soft"
              >
                {current.actionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

export function useSnackbar(): SnackbarApi {
  return useContext(Ctx);
}
