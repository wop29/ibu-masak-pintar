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
