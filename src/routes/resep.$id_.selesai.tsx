import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRef } from "react";
import { byId } from "@/lib/racik/data";
import { useRacik } from "@/lib/racik/state";
import { shrinkPhoto } from "@/lib/racik/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/resep/$id_/selesai")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.recipe
      ? `Sudah dimasak: ${loaderData.recipe.title} — Racik`
      : "Sudah dimasak — Racik";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Simpan foto hasil masakan dan catat tingkat kesulitannya, supaya keterangan resepnya makin jujur.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Catat hasilnya sekali, lain kali resepnya sudah lebih jujur.",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Selesai,
});

const VERDICTS = [
  { id: "gampang", label: "Lebih gampang dari perkiraan" },
  { id: "pas", label: "Pas seperti keterangannya" },
  { id: "susah", label: "Lebih ribet dari perkiraan" },
] as const;

function Selesai() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, update, rate } = useRacik();
  const fileRef = useRef<HTMLInputElement>(null);
  const recipe = shipped ?? state.imported.find((item) => item.id === id);
  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16">
        <p className="read-line">Resep ini tidak ada di perangkat ini.</p>
      </main>
    );
  }
  const photo = state.photos[recipe.id];
  const ratings = state.ratings[recipe.id] ?? [];

  const tally = VERDICTS.map((v) => ({
    ...v,
    n: ratings.filter((r) => r === v.id).length,
  }));
  const top = [...tally].sort((a, b) => b.n - a.n)[0];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pb-16 pt-10">
      <p className="eyebrow">Sudah dimasak</p>
      <h1 className="font-display text-28 mt-1 leading-[1.15]">{recipe.title}</h1>

      <Button variant="outline"
        onClick={() => fileRef.current?.click()}
        className="mt-6 aspect-[4/3] h-auto w-full overflow-hidden p-0"
      >
        {photo ? (
          <img src={photo} alt="Hasil masakan" className="h-full w-full object-cover" />
        ) : (
          <span className="text-body text-ink-3">Simpan foto hasilnya</span>
        )}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const data = await shrinkPhoto(file);
          update((s) => ({ photos: { ...s.photos, [recipe.id]: data } }));
        }}
      />
      {state.photoFull ? (
        <p className="text-caption text-ink-3 mt-2">
          Penyimpanan di perangkat sudah penuh, jadi foto tidak bisa disimpan. Resep dan
          rencana masak tetap aman.
        </p>
      ) : null}

      <h2 className="eyebrow-ink mt-8">Tadi seberapa ribet</h2>
      <div className="mt-3">
        {tally.map((v) => (
          <Button variant="ghost"
            key={v.id}
            onClick={() => rate(recipe.id, v.id)}
            className="hairline-b h-auto w-full justify-between rounded-none px-0 py-4 text-left"
          >
            <span className="text-body">{v.label}</span>
            <span className="text-label text-ink-3 tabular-nums">{v.n > 0 ? v.n : ""}</span>
          </Button>
        ))}
      </div>

      {ratings.length >= 3 && top ? (
        <p className="text-body text-ink-2 mt-4">
          Dari {ratings.length} catatan: {top.label.toLowerCase()}.
        </p>
      ) : (
        <p className="text-caption text-ink-3 mt-4">
          Keterangan tingkat kesulitan muncul setelah tiga kali dicatat. Sebelum itu
          angkanya belum berarti apa-apa.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          to="/resep/$id"
          params={{ id: recipe.id }}
          className="text-body flex-1 border border-rule py-4 text-center"
        >
          Lihat resep
        </Link>
        <Button asChild className="flex-1"><Link to="/">Selesai</Link></Button>
      </div>
    </main>
  );
}
