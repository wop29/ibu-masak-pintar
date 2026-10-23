import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, House, Search } from "lucide-react";
import { useT } from "@/lib/racik/i18n";

type TabPath = "/" | "/cari" | "/rencana" | "/buku";

/**
 * Four places, equal size (decided 22 Oct 2026): Masak, Cari, Rencana, Koleksi.
 * Adding a recipe is an action, not a place, so it lives as a button on Masak,
 * Cari and Koleksi, and as the Android share target (/ambil).
 */
export function AppTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const item = "flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-micro tracking-[0.02em]";
  const tab = (to: TabPath, label: string, Icon: typeof House) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${item} ${active ? "font-bold text-primary" : "font-medium text-ink-3"}`}>
        <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2 : 1.5} />
        <span className="w-full px-0.5 text-center leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[430px] border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(18,23,18,0.05)]"
    >
      {tab("/", t("tab_home"), House)}
      {tab("/cari", t("tab_search"), Search)}
      {tab("/rencana", t("tab_plan"), CalendarDays)}
      {tab("/buku", t("tab_book"), BookOpen)}
    </nav>
  );
}
