import { Link, useRouterState } from "@tanstack/react-router";
import { t } from "@/lib/racik/i18n";
import { BrandIcon } from "./BrandIcon";

type TabPath = "/" | "/cari" | "/rencana" | "/buku";

/**
 * Four places, equal size (decided 22 Oct 2026): Masak, Cari, Rencana, Koleksi.
 * Adding a recipe is an action, not a place, so it lives as a button on Masak,
 * Cari and Koleksi, and as the Android share target (/ambil).
 */
export function AppTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const item = "flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-micro tracking-[0.02em]";
  const tab = (to: TabPath, label: string, icon: string) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${item} ${active ? "font-bold text-primary-deep" : "font-medium text-ink-3"}`}>
        <BrandIcon name={icon} className={`size-8 rounded-lg ${active ? "" : "opacity-55 grayscale"}`} />
        <span className="w-full px-0.5 text-center leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("menu_utama")}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[430px] border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] shadow-bar"
    >
      {tab("/", t("tab_home"), "nav-home-aktif")}
      {tab("/cari", t("tab_search"), "cari")}
      {tab("/rencana", t("tab_plan"), "nav-rencana")}
      {tab("/buku", t("tab_book"), "koleksi-saya")}
    </nav>
  );
}
