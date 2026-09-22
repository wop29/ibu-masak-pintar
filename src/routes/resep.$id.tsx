import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { HalalChip } from "@/components/racik/HalalChip";
import { IngredientList } from "@/components/racik/IngredientList";
import { PHOTO } from "@/components/racik/photos";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { ProteinBlock } from "@/components/racik/ProteinBlock";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bookmark, CalendarPlus } from "lucide-react";
import { byId, REG, SPICE_WORD } from "@/lib/racik/data";
import { fmtSeconds, fmtTime } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";

export const Route = createFileRoute("/resep/$id")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    // Imported recipes live on the device, so they resolve in the component.
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.recipe;
    const title = r ? `${r.title} — Racik` : "Resep — Racik";
    const desc = r ? r.note : "Resep rumahan dengan takaran yang ikut jumlah porsi.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DetailResep,
});

function DetailResep() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, update, setServings, toggleSaved } = useRacik();
  const [tab, setTab] = useState<"bahan" | "langkah">("bahan");
  const imported = state.imported.find((item) => item.id === id);
  const recipe = shipped ?? imported;
  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16">
        <p className="read-line">Resep ini tidak ada di perangkat ini.</p>
        <Button asChild className="mt-5 w-full"><Link to="/buku">Buka Buku Resep</Link></Button>
      </main>
    );
  }
  const servings = state.servings[recipe.id] ?? state.household;
  const photo = PHOTO[recipe.id];
  const saved = state.saved.includes(recipe.id);
  const planned = state.plan.some((p) => p.id === recipe.id);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] pb-28">
      <div className="relative aspect-[4/3] w-full bg-primary-deep">
        {photo ? (
          <img
            src={photo}
            alt={recipe.title}
            width={1024}
            height={704}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-deep text-[64px]">
            <span aria-hidden>{recipe.glyph}</span>
          </div>
        )}
        <Button asChild variant="secondary" size="icon" className="absolute left-4 top-4"><Link to="/" aria-label="Kembali"><ArrowLeft /></Link></Button>
        <Button variant="secondary" size="icon" onClick={() => toggleSaved(recipe.id)} className="absolute right-4 top-4" aria-label={saved ? "Hapus dari simpanan" : "Simpan resep"}><Bookmark className={saved ? "fill-primary text-primary" : ""} /></Button>
      </div>

      <div className="px-5 pt-5">
        <p className="eyebrow">{REG[recipe.region]?.name ?? recipe.region}</p>
        <h1 className="font-display text-28 mt-1 font-extrabold leading-[1.15]">{recipe.title}</h1>
        <p className="text-caption text-ink-3 mt-2">
          {REG[recipe.region]?.desc}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <HalalChip recipe={recipe} />
          <span className="text-label border border-rule bg-card px-3 py-1.5 uppercase tracking-[0.12em] text-ink-2">
            {SPICE_WORD[recipe.spice]}
          </span>
          {recipe.leftover ? (
            <span className="text-label border border-rule bg-card px-3 py-1.5 uppercase tracking-[0.12em] text-ink-2">
              sisa bisa dipakai
            </span>
          ) : null}
        </div>

        <p className="read-line mt-4 font-medium text-ink-2">{recipe.note}</p>

        {imported ? (
          <>
            {imported.unmatched.length ? (
              <div className="mt-4 border border-rule bg-notice p-4">
                <p className="text-label uppercase tracking-[0.1em] text-ink">Ada yang tidak terbaca</p>
                <p className="read-line mt-2 text-ink-2">
                  Bahan ini disebut di videonya tapi belum ada di daftar Racik: {imported.unmatched.join(", ")}. Silakan tambahkan sendiri waktu memasak.
                </p>
              </div>
            ) : null}
            {imported.servAssumed ? (
              <p className="text-caption text-ink-3 mt-3">
                Jumlah porsi tidak disebut di videonya. Racik memakai {imported.serv} porsi sebagai dasar hitungan.
              </p>
            ) : null}
            {imported.sourceUrl ? (
              <a href={imported.sourceUrl} target="_blank" rel="noreferrer" className="text-body mt-3 inline-block font-bold text-primary">
                Buka video aslinya
              </a>
            ) : null}
          </>
        ) : null}
      </div>


      <div className="hairline-t hairline-b mt-5 flex">
        {[
          { k: "Waktu", v: fmtTime(recipe.time) },
          { k: "Tingkat", v: recipe.diff },
          { k: "Porsi asli", v: `${recipe.serv} porsi` },
        ].map((cell, i) => (
          <div
            key={cell.k}
            className={`flex-1 px-4 py-4 ${i < 2 ? "border-r border-rule" : ""}`}
          >
            <p className="text-micro text-ink-3 uppercase tracking-[0.1em]">{cell.k}</p>
            <p className="text-body mt-1 font-semibold">{cell.v}</p>
          </div>
        ))}
      </div>

      <div className="px-5">
        <ProteinBlock recipe={recipe} />

        <Button variant="outline" className="mt-4 w-full" disabled={planned || state.plan.length >= 3} onClick={() => update((s) => ({ plan: [...s.plan, { id: recipe.id, servings }] }))}><CalendarPlus />{planned ? "Sudah dalam rencana" : state.plan.length >= 3 ? "Rencana sudah penuh" : "Tambahkan ke rencana"}</Button>

        <div className="hairline-b flex items-center justify-between gap-3 py-4">
          <div>
            <p className="text-body font-semibold">Masak untuk berapa orang</p>
            <p className="text-caption text-ink-3 mt-0.5">
              Bumbu tidak dikali lurus. Porsi dua kali lipat tidak berarti cabainya dua kali.
            </p>
          </div>
          <PortionStepper
            value={servings}
            onChange={(v) => setServings(recipe.id, v)}
          />
        </div>

        <div className="flex gap-6 pt-4">
          {(["bahan", "langkah"] as const).map((t) => (
            <Button variant="ghost"
              key={t}
              onClick={() => setTab(t)}
              className={`h-auto rounded-none border-b-2 px-0 pb-2 text-label uppercase tracking-[0.1em] ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-3"
              }`}
            >
              {t === "bahan" ? "Bahan" : "Langkah"}
            </Button>
          ))}
        </div>

        {tab === "bahan" ? (
          <div className="pt-2">
            <IngredientList recipe={recipe} servings={servings} satuan={state.satuan} />
            {recipe.alat?.length ? (
              <p className="text-caption text-ink-3 py-4">
                Alat: {recipe.alat.join(", ")}
                {recipe.suhu ? ` · ${recipe.suhu}` : ""}
              </p>
            ) : null}
            {recipe.timbang ? (
              <p className="text-caption text-ink-3 pb-4">
                Resep ini perlu timbangan. Takaran gelas tidak cukup tepat untuk kue.
              </p>
            ) : null}
          </div>
        ) : (
          <ol className="pt-2">
            {recipe.steps.map(([text, seconds], i) => (
              <li key={i} className="hairline-b flex gap-4 py-4">
                <span className="w-6 shrink-0 pt-1 text-label text-primary tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="read-line">{text}</p>
                  {seconds ? (
                    <p className="text-caption text-ink-3 mt-1">{fmtSeconds(seconds)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-rule bg-ground px-5 py-3">
        <Button asChild size="lg" className="w-full"><Link to="/resep/$id/masak" params={{ id: recipe.id }}>Mulai masak · {servings} porsi</Link></Button>
      </div>
    </main>
  );
}
