import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bookmark, CalendarDays, CookingPot, Plus, Search, type LucideIcon } from "lucide-react";
import { ImportSheet } from "./ImportDemo";
import { LanguageToggle } from "./LanguageSwitch";
import { HERO_LINK_ID } from "./WideHome";
import { t } from "@/lib/racik/i18n";
import { useRacik } from "@/lib/racik/state";
import { useAccount } from "@/lib/racik/backend/useAccount";

type Place = "/" | "/cari" | "/rencana" | "/buku";

/** Full-screen moments keep the whole screen on every width. */
const NO_BAR = [/\/masak$/, /^\/masuk/, /\/selesai$/];

/**
 * The tablet and desktop navigation: the same four places as the phone's
 * bottom tabs, as pills in a top bar. Hidden below 768 px, where the bottom
 * tab bar stays exactly as it was; AppTabs hides itself from 768 px up, so the
 * two never show together.
 */
export function TopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state, ready } = useRacik();
  const { account } = useAccount();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  if (!ready || !state.intro || NO_BAR.some((re) => re.test(path))) return null;

  const place = (to: Place, label: string, Icon: LucideIcon) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link
        key={to}
        to={to}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-15 font-bold transition-colors ${
          active ? "bg-primary-soft text-primary-deep" : "text-ink-strong hover:bg-tint"
        }`}
      >
        <Icon aria-hidden className="size-5" strokeWidth={2.2} />
        {/* Narrow iPad: icons only, so the bar never wraps. */}
        <span className="max-[960px]:sr-only">{label}</span>
      </Link>
    );
  };

  // On the home it jumps to the add-recipe panel; elsewhere it opens the import sheet.
  const addRecipe = () => {
    const field = path === "/" ? document.getElementById(HERO_LINK_ID) : null;
    if (field) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      field.focus({ preventScroll: true });
    } else setImportOpen(true);
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    void navigate({ to: "/cari", search: value ? { q: value } : {} });
  };

  return (
    <header className="sticky top-0 z-40 hidden border-b border-rule bg-card tab:block">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-4 px-6 desk:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t("racik")}>
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-[9px]" />
          <span className="font-display text-xl font-extrabold text-primary-deep">
            {t("racik")}
          </span>
        </Link>
        <nav aria-label={t("menu_utama")} className="flex flex-1 items-center gap-0.5">
          {place("/", t("tab_home"), CookingPot)}
          {place("/cari", t("tab_search"), Search)}
          <button
            type="button"
            onClick={addRecipe}
            aria-label={t("tab_import")}
            className="mx-1 inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-cta px-4 text-15 font-bold text-cta-foreground transition-colors hover:bg-cta-hover"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
            <span className="max-[960px]:sr-only">{t("tab_import")}</span>
          </button>
          {place("/rencana", t("tab_plan"), CalendarDays)}
          {place("/buku", t("tab_book"), Bookmark)}
        </nav>
        <form role="search" onSubmit={search} className="hidden w-full min-w-[200px] max-w-[320px] desk:block">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rule bg-ground px-3.5 focus-within:border-primary">
            <Search aria-hidden className="size-[18px] shrink-0 text-ink-3" />
            <span className="sr-only">{t("cari_resep_atau_bahan")}</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder={t("search_placeholder_wide")}
              className="min-w-0 flex-1 bg-transparent text-15 outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
        <LanguageToggle />
        {account ? (
          <Link
            to="/pengaturan"
            aria-label={t("settings")}
            className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-display text-17 font-extrabold text-primary-deep"
          >
            {account.photoUrl ? (
              <img src={account.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              (account.name || "R").trim().charAt(0).toUpperCase()
            )}
          </Link>
        ) : (
          <Link
            to="/masuk"
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-primary-line bg-card px-4 text-15 font-bold text-primary-deep hover:bg-primary-soft"
          >
            {t("sign_in")}
          </Link>
        )}
      </div>
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </header>
  );
}
