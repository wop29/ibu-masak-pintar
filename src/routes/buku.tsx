import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Settings, Trash2 } from "lucide-react";
import { z } from "zod";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { ImportDemo } from "@/components/racik/ImportDemo";
import { useSnackbar } from "@/components/racik/Snackbar";
import { findRecipe } from "@/lib/racik/data";
import { useRacik } from "@/lib/racik/state";
import { PLAN_MAX } from "@/lib/racik/store";
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

/** Put `item` back into `list` at `at` (or the end) unless it is already there. */
function putBack<T>(list: T[], item: T, at: number, same: (x: T) => boolean): T[] {
  if (at < 0 || list.some(same)) return list;
  const next = [...list];
  next.splice(Math.min(at, next.length), 0, item);
  return next;
}

function Koleksi() {
  const { state, update } = useRacik();
  const snackbar = useSnackbar();

  // Removing a favourite only drops the id; Urungkan puts it back in the same place.
  const unsave = (id: string) => {
    const at = state.saved.indexOf(id);
    if (at < 0) return;
    update((s) => ({ saved: s.saved.filter((x) => x !== id) }));
    snackbar.show({
      message: "Dihapus dari favorit",
      actionLabel: "Urungkan",
      onAction: () => update((s) => ({ saved: putBack(s.saved, id, at, (x) => x === id) })),
    });
  };

  // Deleting an imported recipe also drops it from the plan, favourites,
  // portions, cook progress and photos (pruneDangling). Keep a copy of all of
  // it in memory so Urungkan brings back the identical recipe.
  const removeImported = (id: string) => {
    const at = state.imported.findIndex((r) => r.id === id);
    const recipe = state.imported[at];
    if (!recipe) return;
    const copy = {
      recipe,
      at,
      savedAt: state.saved.indexOf(id),
      planAt: state.plan.findIndex((p) => p.id === id),
      plan: state.plan.find((p) => p.id === id),
      servings: state.servings[id],
      cooking: state.cooking[id],
      photo: state.photos[id],
    };
    update((s) => ({ imported: s.imported.filter((item) => item.id !== id) }));
    snackbar.show({
      message: `${recipe.title} dihapus`,
      actionLabel: "Urungkan",
      onAction: () =>
        update((s) => ({
          imported: putBack(s.imported, copy.recipe, copy.at, (r) => r.id === id),
          saved: putBack(s.saved, id, copy.savedAt, (x) => x === id),
          plan: copy.plan && s.plan.length < PLAN_MAX ? putBack(s.plan, copy.plan, copy.planAt, (p) => p.id === id) : s.plan,
          servings: copy.servings != null ? { ...s.servings, [id]: copy.servings } : s.servings,
          cooking: copy.cooking ? { ...s.cooking, [id]: copy.cooking } : s.cooking,
          photos: copy.photo ? { ...s.photos, [id]: copy.photo } : s.photos,
        })),
    });
  };
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
            <h1 className="text-hero font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">Koleksi Saya</h1>
          </div>
          <Link to="/pengaturan" aria-label="Pengaturan" className="mt-1 flex size-11 items-center justify-center rounded-full border border-rule-strong bg-tint text-icon-muted"><Settings className="size-4" /></Link>
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
                <p className="heading-sm mb-1">Resep dari luar</p>
                {state.imported.map((recipe) => (
                  <div key={recipe.id} className="flex items-center gap-1 border-b border-rule-soft last:border-b-0">
                    <div className="min-w-0 flex-1 [&>a]:border-b-0"><CompactRecipe recipe={recipe} creator={recipe.creator} /></div>
                    <button type="button" aria-label={`Hapus ${recipe.title}`} onClick={() => removeImported(recipe.id)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-3"><Trash2 className="size-4" /></button>
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
                <p className="heading-sm mb-1">Resep favorit</p>
                {saved.map((r) => (
                  <div key={r.id} className="flex items-center gap-1 border-b border-rule-soft last:border-b-0">
                    <div className="min-w-0 flex-1 [&>a]:border-b-0"><CompactRecipe recipe={r} /></div>
                    <button type="button" aria-label={`Hapus ${r.title} dari favorit`} onClick={() => unsave(r.id)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary">
                      <Heart className="size-5 fill-current" aria-hidden />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : null}

      </div>
      <AppTabs />
    </main>
  );
}
