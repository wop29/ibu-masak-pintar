import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { z } from "zod";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { ImportDemo } from "@/components/racik/ImportDemo";
import { findRecipe } from "@/lib/racik/data";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";

const searchSchema = z.object({ tab: z.enum(["diambil", "disimpan", "rencana"]).optional().catch("diambil") });
export const Route = createFileRoute("/buku")({
  validateSearch: searchSchema,
  // The plan moved to its own tab (/rencana); old links to ?tab=rencana still land there.
  beforeLoad: ({ search }) => { if (search.tab === "rencana") throw redirect({ to: "/rencana", replace: true }); },
  head: () => ({ meta: [{ title: "Koleksi Saya — Racik" }, { name: "description", content: "Resep dari luar dan resep favorit dalam satu tempat." }, { property: "og:title", content: "Koleksi Saya — Racik" }, { property: "og:description", content: "Simpan resep dari luar dan resep favoritmu." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Koleksi,
});

type SubTab = "diambil" | "disimpan";

function Koleksi() {
  const { state, update } = useRacik();
  const navigate = Route.useNavigate();
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<SubTab>(initialTab === "disimpan" ? "disimpan" : "diambil");
  const saved = state.saved.map((id) => findRecipe(id, state.imported)).filter((x): x is Recipe => x != null);
  const setCurrentTab = (next: SubTab) => { setTab(next); navigate({ search: { tab: next }, replace: true }); };
  const tabs: { id: SubTab; label: string; n: string }[] = [
    { id: "diambil", label: "Dari luar", n: String(state.imported.length) },
    { id: "disimpan", label: "Favorit", n: String(saved.length) },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24">
      <header className="border-b border-rule-soft bg-card px-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <p className="eyebrow mb-0.5">MILIKMU</p>
            <h1 className="text-[clamp(24px,7vw,30px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">Koleksi Saya</h1>
          </div>
          <Link to="/pengaturan" aria-label="Pengaturan" className="mt-1 flex size-[38px] items-center justify-center rounded-full border border-rule-strong bg-tint text-icon-muted"><Settings className="size-4" /></Link>
        </div>
        <div className="mt-4 flex">
          {tabs.map((x) => {
            const on = tab === x.id;
            return (
              <button key={x.id} type="button" onClick={() => setCurrentTab(x.id)} className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 pt-1 pb-3 text-caption font-bold transition-colors ${on ? "border-primary text-primary" : "border-transparent text-ink-3"}`}>
                {x.label}
                <span className={`rounded-full px-1.5 py-0.5 text-micro font-bold ${on ? "bg-primary text-primary-foreground" : "bg-rule-strong text-ink-3"}`}>{x.n}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1">
        {tab === "diambil" ? (
          <div>
            <div className="mx-5 mt-5"><ImportDemo /></div>
            {state.imported.length === 0 ? (
              <p className="mt-8 px-5 text-center text-14 leading-relaxed text-ink-3">Belum ada resep dari luar.<br />Tambahkan dari link video, teks, atau foto.</p>
            ) : (
              <div className="mt-5 px-5">
                <p className="mb-3 text-caption leading-normal text-ink-3">Resep yang Racik susun dari video, teks, atau foto.</p>
                <p className="section-label mb-1 text-ink-strong">RESEP DARI LUAR</p>
                {state.imported.map((recipe) => (
                  <div key={recipe.id} className="flex items-center gap-1 border-b border-rule-soft last:border-b-0">
                    <div className="min-w-0 flex-1 [&>a]:border-b-0"><CompactRecipe recipe={recipe} creator={recipe.creator} /></div>
                    <button type="button" aria-label={`Hapus ${recipe.title}`} onClick={() => update((s) => ({ imported: s.imported.filter((item) => item.id !== recipe.id) }))} className="flex size-10 shrink-0 items-center justify-center text-ink-3"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "disimpan" ? (
          <div className="px-5 pt-4">
            {saved.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <p className="text-center text-14 leading-relaxed text-ink-3">Belum ada resep yang disimpan.<br />Ketuk tanda ♡ di resep mana pun untuk menyimpannya.</p>
                <Link to="/cari" className="rounded-full border-[1.5px] border-primary px-5 py-2.5 text-caption font-bold text-primary">Cari resep</Link>
              </div>
            ) : (
              <>
                <p className="mb-3 text-caption leading-normal text-ink-3">Resep yang ditandai untuk dibuka lagi.</p>
                <p className="section-label mb-1 text-ink-strong">RESEP FAVORIT</p>
                {saved.map((r) => <CompactRecipe key={r.id} recipe={r} />)}
              </>
            )}
          </div>
        ) : null}

      </div>
      <AppTabs />
    </main>
  );
}
