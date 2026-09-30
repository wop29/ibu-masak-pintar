import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { Onboarding } from "@/components/racik/Onboarding";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { SearchField } from "@/components/racik/SearchField";
import { SignInOffer } from "@/components/racik/SignInOffer";
import { ART, PHOTO } from "@/components/racik/photos";
import { Button } from "@/components/ui/button";
import { RECIPES } from "@/lib/racik/data";
import { buildIndex, search } from "@/lib/racik/engine";
import { currentSlot, matchesFilter, suggest } from "@/lib/racik/recommend";
import { useRacik } from "@/lib/racik/state";
import { translate, useLang, useT, type Lang } from "@/lib/racik/i18n";

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
  { id: "makan_siang", label: "Siang", photo: PHOTO["gado_gado"] },
  { id: "makan_malam", label: "Malam", photo: PHOTO["rendang"] },
  { id: "sarapan", label: "Sarapan", photo: PHOTO["nasi_goreng_kampung"] },
  { id: "sayur", label: "Sayur", photo: PHOTO["sayur_asem"] },
  { id: "lauk", label: "Lauk", photo: ART.ayamLengkuas },
  { id: "sambal", label: "Sambal", photo: PHOTO["sambal_terasi"] },
  { id: "jajan", label: "Jajan", photo: ART.bolu },
] as const;

const FILTERS = [{ id: "cepat", key: "filter_quick" }, { id: "gampang", key: "filter_easy" }, { id: "protein", key: "filter_protein" }, { id: "banyak", key: "filter_batch" }] as const;

function greeting(hour: number, lang: Lang) {
  const say = (a: Parameters<typeof translate>[1], b: Parameters<typeof translate>[1]) =>
    [translate(lang, a), translate(lang, b)];
  if (hour < 10) return say("greeting_morning", "ask_breakfast");
  if (hour < 15) return say("greeting_midday", "ask_lunch");
  if (hour < 18) return say("greeting_evening", "ask_dinner");
  return say("greeting_night", "ask_dinner");
}

function MasakApa() {
  const { state, ready, update } = useRacik();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [hour, setHour] = useState(12);
  const index = useMemo(() => buildIndex(RECIPES), []);
  useEffect(() => setHour(new Date().getHours()), []);
  const t = useT();
  const lang = useLang();
  const words = greeting(hour, lang);

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
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><p className="min-w-0 text-body text-muted-foreground">{t("for_people", { n: state.household })}</p><div className="shrink-0"><PortionStepper value={state.household} onChange={(v) => update({ household: v })} /></div></div>
        <div className="mt-5"><SearchField value={query} onChange={setQuery} placeholder={t("search_placeholder")} /></div>
      </header>
      <SignInOffer />
      <div className="hairline-t hairline-b no-scrollbar flex gap-3 overflow-x-auto px-5 py-5">
        {CATS.map((c) => (
          <Button variant="outline" key={c.id} onClick={() => setCat(cat === c.id ? "" : c.id)} className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 p-0 ${cat === c.id ? "border-primary" : "border-transparent"}`}>
            <img src={c.photo} alt="" loading="lazy" width={1024} height={704} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-dark/30" />
            {/* The label sits on a photograph we do not control. The gradient
                is what makes "Sayur" readable over a pale soup. */}
            <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-dark/90 to-transparent" />
            <span className="relative mt-auto w-full px-2 pb-2 text-left text-14 font-bold text-primary-foreground">{c.label}</span>
          </Button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4">{FILTERS.map((f) => <Button key={f.id} variant="outline" size="sm" onClick={() => setFilter(filter === f.id ? "" : f.id)} className={filter === f.id ? "border-2 border-primary bg-secondary font-bold text-primary" : "border-rule text-ink"}>{t(f.key)}</Button>)}</div>
      <section className="px-5 pt-3">
        <div className="flex items-center justify-between"><h2 className="eyebrow-ink">{t("suggestions")}</h2><Button variant="ghost" size="sm" className="px-2 text-primary" onClick={() => update({ suggestionSeed: state.suggestionSeed + 1 })}><RotateCcw /> {t("shuffle")}</Button></div>
      {list.length === 0 ? (
        <div className="py-12 text-center"><p className="text-body text-muted-foreground">{t("no_match")}</p><Button variant="outline" className="mt-4" onClick={() => { setFilter(""); setCat(""); setQuery(""); }}>{t("clear_filters")}</Button></div>
      ) : <div>{list.map((r) => <CompactRecipe key={r.id} recipe={r} />)}</div>}
      </section>
      <AppTabs />
    </main>
  );
}
