import { Link, useRouterState } from "@tanstack/react-router";
import { BookHeart, House, Search } from "lucide-react";

const tabs = [
  { to: "/", label: "Masak Apa", icon: House },
  { to: "/cari", label: "Cari Resep", icon: Search },
  { to: "/buku", label: "Buku Resep", icon: BookHeart },
] as const;

export function AppTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(76px+env(safe-area-inset-bottom))] w-full max-w-[430px] border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link key={to} to={to} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-label font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
            <Icon aria-hidden strokeWidth={active ? 2.4 : 1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}