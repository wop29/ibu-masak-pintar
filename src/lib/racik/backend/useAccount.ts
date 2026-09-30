import { useCallback, useEffect, useState } from "react";
import { backend, backendConfigured } from "./client";
import { currentAccount, type Account } from "./auth";

export interface AccountState {
  account: Account | null;
  ready: boolean;
  /** False when no backend is configured — the rest of Racik still works. */
  available: boolean;
  refresh: () => void;
}

export function useAccount(): AccountState {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(!backendConfigured);

  const refresh = useCallback(() => {
    if (!backendConfigured) return;
    currentAccount()
      .then(setAccount)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    refresh();
    const db = backend();
    if (!db) return;
    const { data } = db.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return { account, ready, available: backendConfigured, refresh };
}
