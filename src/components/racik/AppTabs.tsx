import { Link, useRouterState } from "@tanstack/react-router";
import { BookHeart, House, PenLine, Search } from "lucide-react";
import { useT } from "@/lib/racik/i18n";

export function AppTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const tabs = [
    { to: "/", label: t("tab_home"), icon: House },
    { to: "/cari", label: t("tab_search"), icon: Search },
    // Writing sits in the bar rather than buried in a menu, and is drawn as
    // an action rather than a destination: it is the one thing here that
    // makes something instead of finding something.
    { to: "/tulis", label: t("tab_write"), icon: PenLine, action: true },
    { to: "/buku", label: t("tab_book"), icon: BookHeart },
  ] as const;

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(76px+env(safe-area-inset-bottom))] w-full max-w-[430px] border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((tab) => {
        const { to, label, icon: Icon } = tab;
        const active = to === "/" ? path === "/" : path.startsWith(to);
        const action = "action" in tab && tab.action;
        return (
          <Link
            key={to}
            to={to}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-label font-semibold ${
              active ? "text-primary" : action ? "text-ink" : "text-muted-foreground"
            }`}
          >
            {action ? (
              <span
                aria-hidden
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                }`}
              >
                <Icon strokeWidth={2.2} />
              </span>
            ) : (
              <Icon aria-hidden strokeWidth={active ? 2.4 : 1.7} />
            )}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
