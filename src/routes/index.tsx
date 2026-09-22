import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { Onboarding } from "@/components/racik/Onboarding";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { SearchField } from "@/components/racik/SearchField";
import { Button } from "@/components/ui/button";
import { RECIPES } from "@/lib/racik/data";
import { buildIndex, search } from "@/lib/racik/engine";
import { currentSlot, matchesFilter, suggest } from "@/lib/racik/recommend";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasakApa,
});

const CATS = [
  { id: "makan_siang", label: "Siang", icon: "☀️" }, { id: "makan_malam", label: "Malam", icon: "🌙" },
  { id: "sarapan", label: "Sarapan", icon: "🌅" }, { id: "sayur", label: "Sayur", icon: "🥬" },
  { id: "lauk", label: "Lauk", icon: "🍖" }, { id: "sambal", label: "Sambal", icon: "🌶️" }, { id: "jajan", label: "Jajan", icon: "🧁" },
] as const;
const FILTERS = [{ id: "cepat", label: "< 30 menit" }, { id: "gampang", label: "Gampang" }, { id: "protein", label: "Protein tinggi" }, { id: "anak", label: "Tidak pedas" }, { id: "banyak", label: "Sekali masak banyak" }];

function greeting(hour: number) {
  if (hour < 10) return ["SELAMAT PAGI,", "Sarapan apa hari ini?"];
  if (hour < 15) return ["SELAMAT SIANG,", "Masak apa siang ini?"];
  if (hour < 18) return ["SELAMAT SORE,", "Masak apa malam ini?"];
  return ["SELAMAT MALAM,", "Masak apa malam ini?"];
}

function MasakApa() {
  const { state, ready, update } = useRacik();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [hour, setHour] = useState(12);
  const index = useMemo(() => buildIndex(RECIPES), []);
  useEffect(() => setHour(new Date().getHours()), []);
  const words = greeting(hour);

  const list = useMemo(() => {
    const base = query.trim() ? search(index, query) : suggest(RECIPES, state, hour);
    const byCat = cat ? base.filter((r) => r.slots.includes(cat as never)) : base;
    const withoutCompanion = cat ? byCat : byCat.filter((r) => !r.slots.includes("pendamping") && !r.precise);
    return withoutCompanion.filter((r) => matchesFilter(r, filter)).slice(0, 6);
  }, [query, cat, filter, index, state, hour]);

  if (ready && !state.intro) return <Onboarding />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-24">
      <header className="px-5 pb-5 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <p className="eyebrow">{words[0]}</p>
        <h1 className="mt-1 text-display font-extrabold leading-[1.08]">{words[1]}</h1>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><p className="min-w-0 text-body text-muted-foreground">Untuk {state.household} orang</p><div className="shrink-0"><PortionStepper value={state.household} onChange={(v) => update({ household: v })} /></div></div>
        <div className="mt-5"><SearchField value={query} onChange={setQuery} placeholder="Cari resep atau bahan…" /></div>
      </header>
      <div className="hairline-t hairline-b no-scrollbar flex gap-3 overflow-x-auto px-5 py-5">
        {CATS.map((c) => (
          <Button variant="outline" key={c.id} onClick={() => setCat(cat === c.id ? "" : c.id)} className={`h-24 w-24 shrink-0 flex-col gap-2 rounded-2xl px-2 ${cat === c.id ? "border-primary bg-secondary text-primary" : ""}`}><span className="text-title" aria-hidden>{c.icon}</span><span className="text-secondary">{c.label}</span></Button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4">{FILTERS.map((f) => <Button key={f.id} variant="outline" size="sm" onClick={() => setFilter(filter === f.id ? "" : f.id)} className={filter === f.id ? "border-primary bg-secondary text-primary" : ""}>{f.label}</Button>)}</div>
      <section className="px-5 pt-3">
        <div className="flex items-center justify-between"><h2 className="eyebrow-ink">SARAN UNTUKMU</h2><Button variant="ghost" size="sm" className="px-2 text-primary" onClick={() => update({ suggestionSeed: state.suggestionSeed + 1 })}><RotateCcw /> Ganti</Button></div>
      {list.length === 0 ? (
        <div className="py-12 text-center"><p className="text-body text-muted-foreground">Tidak ada resep yang cocok.</p><Button variant="outline" className="mt-4" onClick={() => { setFilter(""); setCat(""); setQuery(""); }}>Hapus filter</Button></div>
      ) : <div>{list.map((r) => <CompactRecipe key={r.id} recipe={r} />)}</div>}
      </section>
      <AppTabs />
    </main>
  );
}
