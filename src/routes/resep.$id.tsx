import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { HalalChip } from "@/components/racik/HalalChip";
import { IngredientList } from "@/components/racik/IngredientList";
import { PHOTO } from "@/components/racik/photos";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { ProteinBlock } from "@/components/racik/ProteinBlock";
import { byId, REG, SPICE_WORD } from "@/lib/racik/data";
import { fmtSeconds, fmtTime } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";

export const Route = createFileRoute("/resep/$id")({
  loader: ({ params }) => {
    const recipe = byId(params.id);
    if (!recipe) throw notFound();
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
      ],
    };
  },
  component: DetailResep,
});

function DetailResep() {
  const { recipe } = Route.useLoaderData();
  const { state, setServings, toggleSaved } = useRacik();
  const [tab, setTab] = useState<"bahan" | "langkah">("bahan");
  const servings = state.servings[recipe.id] ?? state.household;
  const photo = PHOTO[recipe.id];
  const saved = state.saved.includes(recipe.id);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] pb-28">
      <div className="relative aspect-[4/3] w-full bg-mag-deep">
        {photo ? (
          <img
            src={photo}
            alt={recipe.title}
            width={1024}
            height={704}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mag-deep to-onb text-[64px]">
            <span aria-hidden>{recipe.glyph}</span>
          </div>
        )}
        <Link
          to="/"
          className="text-label absolute left-4 top-4 bg-ground px-3 py-2 uppercase tracking-[0.12em]"
        >
          Kembali
        </Link>
        <button
          onClick={() => toggleSaved(recipe.id)}
          className="text-label absolute right-4 top-4 bg-ground px-3 py-2 uppercase tracking-[0.12em]"
        >
          {saved ? "Tersimpan" : "Simpan"}
        </button>
      </div>

      <div className="px-5 pt-5">
        <p className="eyebrow">{REG[recipe.region]?.name ?? recipe.region}</p>
        <h1 className="font-display text-28 mt-1 leading-[1.15]">{recipe.title}</h1>
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

        <p className="read-line mt-4 font-serif text-ink-2">{recipe.note}</p>
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
            <p className="text-micro text-ink-3 uppercase tracking-[0.14em]">{cell.k}</p>
            <p className="text-body mt-1 font-semibold">{cell.v}</p>
          </div>
        ))}
      </div>

      <div className="px-5">
        <ProteinBlock recipe={recipe} />

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
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-label pb-2 uppercase tracking-[0.14em] ${
                tab === t
                  ? "border-b-2 border-mag-fill text-mag-text"
                  : "border-b-2 border-transparent text-ink-3"
              }`}
            >
              {t === "bahan" ? "Bahan" : "Langkah"}
            </button>
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
                <span className="text-label text-mag-text w-6 shrink-0 pt-1 tabular-nums">
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
        <Link
          to="/resep/$id/masak"
          params={{ id: recipe.id }}
          className="text-body block w-full bg-mag-fill py-4 text-center font-semibold text-white"
        >
          Mulai masak · {servings} porsi
        </Link>
      </div>
    </main>
  );
}
