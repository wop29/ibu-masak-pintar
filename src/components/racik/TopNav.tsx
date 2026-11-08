import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
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

  if (!ready || !state.intro || NO_BAR.some((re) => re.test(path))) return null;

  const place = (to: Place, label: string) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link
        key={to}
        to={to}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-full px-4 text-15 font-bold transition-colors ${
          active ? "bg-primary-soft text-primary-deep" : "text-ink-3 hover:bg-tint hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    void navigate({ to: "/cari", search: value ? { q: value } : {} });
  };

  return (
    <header className="sticky top-0 z-40 hidden border-b border-rule bg-card tab:block">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-6 px-6 desk:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t("racik")}>
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-[9px]" />
          <span className="font-display text-xl font-extrabold text-primary-deep">{t("racik")}</span>
        </Link>
        <nav aria-label={t("menu_utama")} className="flex flex-1 items-center gap-1">
          {place("/", t("tab_home"))}
          {place("/cari", t("tab_search"))}
          {place("/rencana", t("tab_plan"))}
          {place("/buku", t("tab_book"))}
        </nav>
        <form role="search" onSubmit={search} className="hidden w-full max-w-[320px] desk:block">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-rule bg-ground px-3.5 focus-within:border-primary">
            <Search aria-hidden className="size-[18px] shrink-0 text-ink-3" />
            <span className="sr-only">{t("cari_resep_atau_bahan")}</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder={t("search_placeholder")}
              className="min-w-0 flex-1 bg-transparent text-15 outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
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
    </header>
  );
}
