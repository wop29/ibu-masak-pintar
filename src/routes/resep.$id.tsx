import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { HalalChip } from "@/components/racik/HalalChip";
import { IncompleteBadge } from "@/components/racik/IncompleteBadge";
import { IngredientList } from "@/components/racik/IngredientList";
import { PHOTO, previewPhotoOf } from "@/components/racik/photos";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { ProteinBlock } from "@/components/racik/ProteinBlock";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarPlus, ExternalLink, Heart, Minus, Plus } from "lucide-react";
import { byId, findRecipe, REG } from "@/lib/racik/data";
import { planIsFull } from "@/lib/racik/plan";
import { PLAN_MAX } from "@/lib/racik/store";
import { requestOrigin } from "@/lib/racik/origin";
import { fmtSeconds, fmtTime } from "@/lib/racik/engine";
import { useRacik, useRequireAccountForSave } from "@/lib/racik/state";

export const Route = createFileRoute("/resep/$id")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    // Imported recipes live on the device, so they resolve in the component.
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe, origin: requestOrigin() };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.recipe;
    const title = r ? `${r.title} — Racik` : "Resep — Racik";
    const desc = r ? r.note : "Resep rumahan dengan takaran yang ikut jumlah porsi.";
    const image = r ? previewPhotoOf(r.id, loaderData?.origin ?? "") : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [
          { property: "og:image", content: image },
          { name: "twitter:image", content: image },
        ] : []),
      ],
    };
  },
  component: DetailResep,
});

/** Hostname of a saved source link; a corrupt value must not take the page down. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "sumber asli";
  }
}

const MAX_PORTIONS = 20;

function DetailResep() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, ready, update, setServings, toggleSaved } = useRacik();
  // Signed out: the first heart (and every few after) offers to keep favourites in an account.
  const askAccount = useRequireAccountForSave();
  const [tab, setTab] = useState<"bahan" | "langkah">("bahan");
  const imported = state.imported.find((item) => item.id === id);
  const recipe = shipped ?? imported;
  if (!recipe && !ready) {
    // Imported recipes live in IndexedDB: wait for it before saying "not here".
    return <main aria-busy="true" className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground"><div className="h-[292px] animate-pulse bg-[#e8eee7]" /></main>;
  }
  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16">
        <p className="read-line">Resep ini tidak ada di perangkat ini.</p>
        <Button asChild className="mt-5 min-h-12 w-full"><Link to="/buku">Buka Koleksi</Link></Button>
      </main>
    );
  }
  const servings = state.servings[recipe.id] ?? state.household;
  const photo = recipe.photoUrl ?? PHOTO[recipe.id];
  const saved = state.saved.includes(recipe.id);
  const planned = state.plan.some((p) => p.id === recipe.id);
  // Counts only plan entries that still open a recipe, so a deleted import does not keep a slot.
  const planFull = planIsFull(state);
  const creator = imported?.creator ?? recipe.creator;
  const step = (v: number) => setServings(recipe.id, Math.min(MAX_PORTIONS, Math.max(1, v)));
  const toggleHeart = () => {
    toggleSaved(recipe.id);
    if (!saved) askAccount("save");
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div className="relative h-[292px] bg-[#e8eee7]">
        <RecipePhoto src={photo} glyph={recipe.glyph} alt={recipe.title} glyphClass="text-[64px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),transparent_40%,rgba(0,0,0,0.12))]" />
        <Link to="/" aria-label="Kembali" onClick={(e) => { if (window.history.length > 1) { e.preventDefault(); window.history.back(); } }} className="absolute top-[calc(3rem+env(safe-area-inset-top))] left-5 flex size-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)]"><ArrowLeft className="size-5" strokeWidth={2.4} /></Link>
        <button type="button" onClick={toggleHeart} aria-pressed={saved} aria-label={saved ? "Hapus dari Favorit" : "Simpan ke Favorit"} className={`absolute top-[calc(3rem+env(safe-area-inset-top))] right-5 flex size-11 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${saved ? "bg-primary text-primary-foreground" : "bg-white/95 text-ink"}`}><Heart className={`size-[21px] ${saved ? "fill-current" : ""}`} /></button>
      </div>

      <div className="relative -mt-[22px] px-5">
        <div className="rounded-3xl border border-rule bg-card px-5 pt-6 pb-5 shadow-[0_10px_30px_rgba(18,23,18,0.07)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-2.5 py-[5px] text-micro font-extrabold tracking-[0.05em] text-primary-deep">{(REG[recipe.region]?.name ?? recipe.region).toUpperCase()}</span>
            <HalalChip recipe={recipe} />
            {recipe.leftover ? <span className="rounded-full bg-tint px-2.5 py-[5px] text-micro font-extrabold tracking-[0.05em] text-ink-2">SISA BISA DIPAKAI</span> : null}
          </div>
          <h1 className="mt-3 text-[clamp(28px,8vw,36px)] font-extrabold leading-[1.08] tracking-[-0.04em] [overflow-wrap:anywhere]">{recipe.title}</h1>

          {imported?.sourceUrl ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary-line bg-[#f7faf6] px-3 py-[11px]">
              <div className="min-w-0">
                <p className="text-micro text-ink-3">DARI LUAR</p>
                <p className="mt-0.5 truncate text-caption font-extrabold text-primary-deep">{creator ?? hostOf(imported.sourceUrl)}</p>
              </div>
              <a href={imported.sourceUrl} target="_blank" rel="noreferrer" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-label font-extrabold text-primary-foreground">Buka sumber <ExternalLink className="size-3.5" /></a>
            </div>
          ) : null}

          {recipe.incomplete ? (
            <div className="mt-3 rounded-xl bg-notice p-3 text-[#66551c]">
              <IncompleteBadge recipe={recipe} />
              <p className="mt-2 text-caption leading-normal">Takaran bumbunya cuma ditulis di layar videonya, jadi Racik belum bisa membacanya. Buka videonya untuk melihat takarannya.</p>
            </div>
          ) : null}

          <p className="mt-3 text-15 leading-[1.65] text-ink-2 [overflow-wrap:anywhere]">{recipe.note}</p>
          {imported?.servAssumed ? <p className="mt-2 text-label text-ink-3">Jumlah porsi tidak disebut di videonya. Racik memakai {imported.serv} porsi sebagai dasar hitungan.</p> : null}

          <div className="mt-5 grid grid-cols-2 border-t border-rule pt-[18px]">
            <div>
              <p className="text-15 font-extrabold">{fmtTime(recipe.time)}</p>
              <p className="mt-0.5 text-micro text-ink-3">WAKTU</p>
            </div>
            <div className="border-l border-rule pl-3.5">
              <p className="text-15 font-extrabold">{recipe.diff}</p>
              <p className="mt-0.5 text-micro text-ink-3">TINGKAT</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4">
            <div>
              <p className="text-micro text-ink-3">PORSI</p>
              <p className="text-15 font-extrabold tabular-nums">{servings} porsi</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => step(servings - 1)} disabled={servings <= 1} aria-label="Kurangi porsi" className="flex size-11 items-center justify-center rounded-xl border border-rule bg-card text-primary disabled:text-ink-3"><Minus className="size-5" /></button>
              <button type="button" onClick={() => step(servings + 1)} disabled={servings >= MAX_PORTIONS} aria-label="Tambah porsi" className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Plus className="size-5" /></button>
            </div>
          </div>
          {recipe.precise ? null : <p className="mt-2 text-micro leading-normal text-ink-3">Bumbu tidak dikali lurus — porsi dua kali lipat tidak berarti cabainya dua kali.</p>}

          <ProteinBlock recipe={recipe} />

          <button type="button" disabled={recipe.incomplete || planned || planFull} onClick={() => update((s) => ({ plan: [...s.plan.filter((p) => findRecipe(p.id, s.imported)), { id: recipe.id, servings }] }))} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rule text-14 font-bold text-primary disabled:text-ink-3">
            <CalendarPlus className="size-4" />{recipe.incomplete ? "Belum bisa masuk rencana" : planned ? "Sudah ada di rencana" : planFull ? `Rencana sudah penuh (${PLAN_MAX} resep)` : "Tambah ke rencana"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 border-b border-rule">
          {(["bahan", "langkah"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`min-h-[52px] border-b-[3px] text-14 font-extrabold ${tab === t ? "border-primary text-primary" : "border-transparent text-ink-3"}`}>
              {t === "bahan" ? `Bahan · ${recipe.ings.length}` : `Langkah · ${recipe.steps.length}`}
            </button>
          ))}
        </div>

        {tab === "bahan" ? (
          <div className="pt-2 pb-7">
            <p className="pt-3 pb-1 text-caption text-ink-3">Takaran untuk {servings} porsi</p>
            <IngredientList recipe={recipe} servings={servings} satuan={state.satuan} negara={state.negara} />
            {recipe.alat?.length ? <p className="py-4 text-caption text-ink-3">Alat: {recipe.alat.join(", ")}{recipe.suhu ? ` · ${recipe.suhu}` : ""}</p> : null}
            {recipe.timbang ? <p className="pb-4 text-caption text-ink-3">Resep ini perlu timbangan. Takaran gelas tidak cukup tepat untuk kue.</p> : null}
          </div>
        ) : (
          <ol className="pt-2 pb-7">
            {recipe.steps.map(([text, seconds], i) => (
              <li key={i} className="flex items-start gap-4 border-b border-rule py-[18px]">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-14 font-extrabold text-primary-foreground">{i + 1}</span>
                <div>
                  <p className="text-lg leading-[1.6] [overflow-wrap:anywhere]">{text}</p>
                  {seconds ? <p className="mt-2 text-caption font-extrabold text-primary">{fmtSeconds(seconds)}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-rule bg-white/95 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-md">
        <Button asChild className="min-h-[54px] w-full rounded-xl text-body font-extrabold shadow-glow"><Link to="/resep/$id/masak" params={{ id: recipe.id }}>Mulai masak · {servings} porsi</Link></Button>
      </div>
    </main>
  );
}
