import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, ChevronRight, PenLine } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { myRecipes } from "@/lib/racik/backend/recipes";
import type { UserRecipe } from "@/lib/racik/backend/types";
import { loadDrafts, type TulisDraft } from "@/lib/racik/tulis/drafts";

export const Route = createFileRoute("/tulis")({
  head: () => ({
    meta: [
      { title: "Tulis Resep — Racik" },
      {
        name: "description",
        content: "Tulis resep andalanmu dengan takaran yang jelas, lalu bagikan.",
      },
    ],
  }),
  component: Tulis,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  live: "Terbit",
  hidden: "Disembunyikan moderator",
  removed: "Dihapus moderator",
  local: "Draf di HP ini",
};

interface Row {
  key: string;
  title: string;
  status: string;
  /** Local draft id or server recipe id: the editor accepts either. */
  open: string;
  updated: number;
}

function Tulis() {
  const { account, ready, available } = useAccount();
  const [drafts, setDrafts] = useState<TulisDraft[]>([]);
  const [mine, setMine] = useState<UserRecipe[]>([]);

  useEffect(() => setDrafts(loadDrafts()), []);
  useEffect(() => {
    if (account) myRecipes().then(setMine);
  }, [account]);

  // One list: drafts on this device, and anything already on the server.
  const rows: Row[] = [];
  const seenRemote = new Set<string>();
  for (const d of drafts) {
    if (d.remoteId) seenRemote.add(d.remoteId);
    rows.push({
      key: d.id,
      title: d.title.trim() || "Tanpa judul",
      status: d.remoteId
        ? (mine.find((m) => m.id === d.remoteId)?.status ?? d.status ?? "draft")
        : "local",
      open: d.id,
      updated: d.updatedAt,
    });
  }
  for (const m of mine) {
    if (seenRemote.has(m.id)) continue;
    rows.push({ key: m.id, title: m.title, status: m.status, open: m.id, updated: 0 });
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-28">
      <header className="px-5 pb-5 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <p className="eyebrow">RACIK</p>
        <h1 className="mt-1 text-display font-extrabold leading-[1.08]">
          Resep andalanmu, takarannya jelas
        </h1>
        <p className="mt-3 read-line text-ink-2">
          Tulis resep yang biasa kamu masak di rumah. Racik membaca takarannya, jadi orang lain bisa
          memasaknya untuk berapa porsi pun. Draf tersimpan di HP ini; untuk menerbitkan, kamu perlu
          masuk.
        </p>
      </header>

      <div className="px-5">
        <Button asChild size="lg" className="w-full">
          <Link to="/tulis/baru">
            <PenLine /> Tulis resep baru
          </Link>
        </Button>

        {available && ready && account ? (
          <Link
            to="/resepku"
            className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-rule px-4 text-body font-bold"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> Resepku: siapa yang memasaknya
            </span>
            <ChevronRight className="size-4 text-ink-3" />
          </Link>
        ) : null}

        {rows.length ? (
          <section className="mt-8">
            <h2 className="eyebrow-ink">RESEP YANG KAMU TULIS</h2>
            <ul className="mt-2">
              {rows.map((r) => (
                <li key={r.key}>
                  <Link
                    to="/tulis/baru"
                    search={{ d: r.open }}
                    className="flex min-h-14 items-center justify-between gap-3 border-b border-border py-4"
                  >
                    <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                    <span className="shrink-0 text-14 text-muted-foreground">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {available && ready && !account ? (
          <p className="mt-6 text-14 text-ink-3">
            Sudah punya akun?{" "}
            <Link to="/masuk" className="font-bold text-primary">
              Masuk
            </Link>{" "}
            untuk melihat resep yang pernah kamu terbitkan.
          </p>
        ) : null}
      </div>

      <AppTabs />
    </main>
  );
}
