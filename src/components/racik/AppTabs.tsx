import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { t } from "@/lib/racik/i18n";
import { useRacik } from "@/lib/racik/state";
import { BrandIcon } from "./BrandIcon";

type TabPath = "/" | "/cari" | "/rencana" | "/buku";
const TABS: TabPath[] = ["/", "/cari", "/rencana", "/buku"];

/**
 * Four places, equal size (decided 22 Oct 2026): Masak, Cari, Rencana, Koleksi.
 * Adding a recipe is an action, not a place, so it lives as a button on Masak,
 * Cari and Koleksi, and as the Android share target (/ambil).
 *
 * Motion (16 Nov 2026): a soft pill slides behind the active tab, and Koleksi
 * shows a short "+1" when a recipe is saved anywhere.
 */
export function AppTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state, ready } = useRacik();
  const activeIndex = TABS.findIndex((to) => (to === "/" ? path === "/" : path.startsWith(to)));

  // Slide from where the pill was last time (the tab bar remounts on every page).
  const [shown, setShown] = useState(() => lastIndex ?? activeIndex);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(activeIndex));
    lastIndex = activeIndex;
    return () => cancelAnimationFrame(id);
  }, [activeIndex]);

  // "+1" on Koleksi only when the saved count grows during this visit.
  const savedCount = state.saved.length;
  const prevSaved = useRef(savedCount);
  const [bump, setBump] = useState(0);
  const wasReady = useRef(ready);
  useEffect(() => {
    // The first read of saved state is not a save; only count growth after that.
    if (ready && wasReady.current && savedCount > prevSaved.current) setBump((b) => b + 1);
    prevSaved.current = savedCount;
    wasReady.current = ready;
  }, [savedCount, ready]);

  const item =
    "relative flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-micro tracking-[0.02em]";
  const tab = (to: TabPath, label: string, aktif: string, diam: string) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link
        key={to}
        to={to}
        aria-current={active ? "page" : undefined}
        className={`${item} ${active ? "font-bold text-primary-deep" : "font-medium text-ink-3"}`}
      >
        <span className="relative">
          <BrandIcon
            name={active ? aktif : diam}
            className={`size-8 rounded-lg ${!active && aktif === diam ? "opacity-55 grayscale" : ""}`}
          />
          {to === "/buku" && bump > 0 ? (
            <span
              key={bump}
              aria-hidden
              className="rk-bump absolute -top-2 -right-4 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-cta px-1 text-[11px] font-extrabold text-cta-foreground"
            >
              +1
            </span>
          ) : null}
        </span>
        <span className="w-full px-0.5 text-center leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("menu_utama")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[430px] border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] shadow-bar tab:hidden"
    >
      {shown >= 0 ? (
        <span
          aria-hidden
          className="rk-tab-ind pointer-events-none absolute top-[9px] left-0 flex w-1/4 justify-center"
          style={{ transform: `translateX(${shown * 100}%)` }}
        >
          <span className="h-10 w-16 rounded-full bg-primary-soft" />
        </span>
      ) : null}
      {tab("/", t("tab_home"), "nav-home-aktif", "nav-home")}
      {tab("/cari", t("tab_search"), "nav-cari-aktif", "nav-cari")}
      {tab("/rencana", t("tab_plan"), "nav-rencana-aktif", "nav-rencana")}
      {tab("/buku", t("tab_book"), "nav-koleksi-aktif", "nav-koleksi")}
    </nav>
  );
}

let lastIndex: number | null = null;
