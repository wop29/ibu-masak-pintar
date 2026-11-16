import { useRacik } from "@/lib/racik/state";
import { ENGLISH_ENABLED, t } from "@/lib/racik/i18n";

/**
 * The interface language switch (Pengaturan, Akun, Resepku). Recipe content
 * stays Indonesian either way. Language names are written in their own
 * language, so they are never translated.
 */
export function LanguageSwitch() {
  const { state, update } = useRacik();
  if (!ENGLISH_ENABLED) return null;
  const options = [
    ["id", "Bahasa Indonesia"], // i18n-ok: language name in its own language
    ["en", "English"], // i18n-ok: language name in its own language
  ] as const;
  return (
    <div role="radiogroup" aria-label={t("language")} className="flex flex-wrap gap-1 rounded-xl bg-secondary p-1">
      {options.map(([code, label]) => {
        const on = state.lang === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={code}
            onClick={() => update({ lang: code })}
            className={`min-h-11 rounded-lg px-3.5 text-14 font-bold ${on ? "bg-primary text-primary-foreground" : "text-ink-2"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The small "ID | EN" toggle that is there from the first screen: the welcome
 * slides, the onboarding questions and the tablet/desktop top bar
 * (Octavia, 9 Nov 2026). Same setting as the switch in Pengaturan.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { state, update } = useRacik();
  if (!ENGLISH_ENABLED) return null;
  const options = [
    ["id", "ID", "Bahasa Indonesia"], // i18n-ok: language codes and names in their own language
    ["en", "EN", "English"], // i18n-ok: language codes and names in their own language
  ] as const;
  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className={`inline-flex shrink-0 items-center rounded-full border border-rule bg-card p-0.5 ${className}`}
    >
      {options.map(([code, short, name]) => {
        const on = (state.lang === "en" ? "en" : "id") === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name}
            lang={code}
            onClick={() => update({ lang: code })}
            className={`min-h-10 min-w-11 rounded-full px-2.5 text-caption font-extrabold transition-colors ${on ? "bg-primary text-primary-foreground" : "text-ink-2 hover:text-ink"}`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
