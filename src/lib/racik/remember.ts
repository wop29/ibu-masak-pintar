import { useCallback, useState } from "react";

/**
 * State that survives the app re-mounting when the interface language changes
 * (LangTree is keyed by language). Onboarding uses it, so switching ID/EN on
 * the welcome slides or the questions keeps her on the same screen and step.
 */
const memory = new Map<string, unknown>();

export function useRemembered<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        memory.set(key, v);
        return v;
      }),
    [key],
  );
  return [value, set] as const;
}

/** Onboarding finished: the next one (after "reset app") starts from the splash again. */
export function forgetOnboarding() {
  for (const key of [...memory.keys()]) if (key.startsWith("onboarding.")) memory.delete(key);
}
