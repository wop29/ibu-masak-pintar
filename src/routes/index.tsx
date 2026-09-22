import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/racik/RecipeCard";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { RECIPES, SLOT_LABEL } from "@/lib/racik/data";
import { buildIndex, search } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Racik — resep rumahan dengan takaran yang benar" },
      {
        name: "description",
        content:
          "Resep masakan Indonesia yang takarannya ikut jumlah porsi di rumah, pakai ukuran dapur biasa: gelas belimbing, sendok makan, ons.",
      },
      { property: "og:title", content: "Racik — resep rumahan dengan takaran yang benar" },
      {
        property: "og:description",
        content:
          "Ubah jumlah porsi, semua takaran ikut berubah. Tanpa akun, bisa dibuka tanpa sinyal.",
      },
    ],
  }),
  component: MasakApa;
});

const CATS: { id: string; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "lauk", label: SLOT_LABEL.lauk },
  { id: "sayur", label: SLOT_LABEL.sayur },
  { id: "sambal", label: SLOT_LABEL.sambal },
  { id: "camilan", label: SLOT_LABEL.camilan },
  { id: "minuman", label: SLOT_LABEL.minuman },
  { id: "kue", label: SLOT_LABEL.kue },
];

function greeting(hour: number): string {
  if (hour < 10) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function MasakApa() {
  const { state, update } = useRacik();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("semua");
  const index = useMemo(() => buildIndex(RECIPES), []);

  const list = useMemo(() => {
    const base = query.trim() ? search(index, query) : RECIPES;
    // Category filter runs first; only then does the accompaniment rule apply.
    const byCat = cat === "semua" ? base : base.filter((r) => r.slots.includes(cat as never));
    if (cat !== "semua") return byCat;
    return byCat.filter((r) => !r.slots.includes("pendamping") && !r.precise);
  }, [query, cat, index]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] pb-16">
      <header className="hairline-b px-5 pt-8 pb-5">
        <p className="eyebrow-ink">{greeting(new Date().getHours())}</p>
        <h1 className="font-display text-34 mt-1 leading-[1.1]">Masak apa hari ini</h1>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-secondary text-ink-3 flex-1">
            Takaran di setiap resep ikut jumlah porsi ini.
          </p>
          <PortionStepper
            value={state.household}
            onChange={(v) => update({ household: v })}
          />
        </div>
      </header>

      <div className="hairline-b px-5 py-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari resep atau bahan"
          className="text-body w-full border border-rule bg-card px-4 py-3 outline-none placeholder:text-ink-3 focus:border-mag-fill"
        />
      </div>

      <div className="hairline-b no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`text-label shrink-0 border px-3 py-2 uppercase tracking-[0.12em] ${
              cat === c.id
                ? "border-mag-fill bg-mag-fill text-white"
                : "border-rule bg-card text-ink-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-body text-ink-3 px-5 py-10">
          Tidak ada resep yang cocok dengan kata itu. Coba nama bahannya saja, misalnya ayam
          atau tempe.
        </p>
      ) : (
        <div>
          {list.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      <p className="text-caption text-ink-3 px-5 py-6">
        Ini versi awal dengan {RECIPES.length} resep contoh. Semuanya tersimpan di perangkat,
        jadi tetap terbuka tanpa sinyal.
      </p>
    </main>
  );
}
