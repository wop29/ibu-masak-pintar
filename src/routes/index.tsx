import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { ImportButton } from "@/components/racik/ImportDemo";
import { Onboarding } from "@/components/racik/Onboarding";
import { NUSANTARA } from "@/lib/racik/data";
import { currentSlot, matchesFilter, preferProteins, suggest } from "@/lib/racik/recommend";
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
  { id: "makan_siang", label: "Siang", emoji: "☀️" },
  { id: "makan_malam", label: "Malam", emoji: "🌙" },
  { id: "sarapan", label: "Sarapan", emoji: "🌅" },
  { id: "sayur", label: "Sayur", emoji: "🥬" },
  { id: "lauk", label: "Lauk", emoji: "🍖" },
  { id: "sambal", label: "Sambal", emoji: "🌶️" },
  { id: "jajan", label: "Jajan", emoji: "🧁" },
] as const;

const FILTERS = [
  { id: "cepat", key: "filter_quick" },
  { id: "gampang", key: "filter_easy" },
  { id: "protein", key: "filter_protein" },
  { id: "anak", key: "filter_kids" },
  { id: "banyak", key: "filter_batch" },
] as const;

/** Onboarding priority → the home filter it opens on. */
const PRIORITY_FILTER: Record<string, string> = {
  kurang_30_menit: "cepat",
  gampang: "gampang",
  protein_tinggi: "protein",
  anak_suka: "anak",
  sekali_masak_banyak: "banyak",
  // older single-choice answers
  cepat: "cepat",
  sehat: "protein",
  hemat: "gampang",
};

const MAX_PORTIONS = 20;

function Splash() {
  return (
    <main aria-busy="true" className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-ground">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2C6.5 2 3 6.5 3 12c0 3.5 1.8 6.6 4.5 8.4L12 22l4.5-1.6C19.2 18.6 21 15.5 21 12c0-5.5-3.5-10-9-10z" fill="white" opacity="0.9" />
          <path d="M12 6v16" stroke="#2e7d32" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      </span>
      <span className="sr-only">Memuat Racik…</span>
    </main>
  );
}

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
  const [cat, setCat] = useState<string>("");
  const [filters, setFilters] = useState<string[]>([]);
  // Land the feed on what she said matters most, once; after that it is hers to change.
  const priorityApplied = useRef(false);
  useEffect(() => {
    if (!ready || !state.intro || priorityApplied.current) return;
    priorityApplied.current = true;
    const first = state.priorities[0] ?? state.priority;
    const f = first ? PRIORITY_FILTER[first] : undefined;
    if (f) setFilters([f]);
  }, [ready, state.intro, state.priorities, state.priority]);
  const [hour, setHour] = useState(12);
  useEffect(() => setHour(new Date().getHours()), []);
  const t = useT();
  const lang = useLang();
  const words = greeting(hour, lang);
  void currentSlot;

  const list = useMemo(() => {
    const base = preferProteins(suggest(NUSANTARA, state, hour), state.proteins);
    const byCat = cat ? base.filter((r) => r.slots.includes(cat as never)) : base;
    const withoutCompanion = cat ? byCat : byCat.filter((r) => !r.slots.includes("pendamping") && !r.precise);
    return withoutCompanion.filter((r) => filters.every((f) => matchesFilter(r, f))).slice(0, 6);
  }, [cat, filters, state, hour]);

  // Until the saved state is read, nobody knows whether she is new: show a
  // neutral splash, not the home screen (which then flashed away into
  // onboarding on a first visit) and not onboarding (which would flash for
  // everyone else). The server and the offline shell render this too.
  if (!ready) return <Splash />;
  if (!state.intro) return <Onboarding />;

  const toggle = (id: string) => setFilters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  // Same 1–20 range as Pengaturan and the recipe page; "+" never lowers the number.
  const setHousehold = (v: number) => update({ household: Math.min(MAX_PORTIONS, Math.max(1, v)) });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24">
      <header className="border-b border-rule-soft bg-card px-5 pb-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <p className="eyebrow mb-0.5">{words[0]}</p>
        <h1 className="mb-1 text-[clamp(26px,7vw,32px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">{words[1]}</h1>
        <div className="mt-3 mb-[18px] flex items-center justify-between">
          <div>
            <p className="text-label text-ink-3">Masak untuk</p>
            <p className="mt-0.5 text-14 font-bold">{t("for_people", { n: state.household })}</p>
          </div>
          <div className="flex items-center rounded-xl border border-rule bg-ground p-[3px]">
            <button type="button" onClick={() => setHousehold(state.household - 1)} aria-label="Kurangi porsi" className="flex size-11 items-center justify-center rounded-lg bg-card text-primary disabled:text-ink-3" disabled={state.household <= 1}><Minus className="size-5" /></button>
            <span className="w-[42px] text-center text-15 font-extrabold tabular-nums">{state.household}</span>
            <button type="button" onClick={() => setHousehold(state.household + 1)} aria-label="Tambah porsi" className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" disabled={state.household >= MAX_PORTIONS}><Plus className="size-5" /></button>
          </div>
        </div>
        <p className="-mt-2.5 mb-4 text-label text-ink-3">Takaran resep akan disesuaikan dengan jumlah ini.</p>
        <Link to="/cari" className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rule-strong bg-tint px-3.5 py-3">
          <Search aria-hidden className="size-4 text-ink-faint" />
          <span className="text-15 text-ink-3">{t("search_placeholder")}</span>
        </Link>
        <div className="mt-3"><ImportButton /></div>
      </header>

      <div className="pt-5 pb-1">
        <p className="mb-2.5 px-5 text-micro font-bold tracking-[0.1em] text-ink-2">WAKTU MAKAN</p>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
          {CATS.map((c) => {
            const active = cat === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setCat(active ? "" : c.id)} className={`flex size-[72px] shrink-0 flex-col items-center justify-center rounded-2xl transition-colors ${active ? "bg-primary" : "border border-rule-strong bg-card"}`}>
                <span aria-hidden className="mb-1 text-[22px] leading-none">{c.emoji}</span>
                <span className={`text-micro font-semibold ${active ? "text-primary-foreground" : "text-icon-muted"}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="py-3">
        <div className="mb-2.5 flex items-center justify-between px-5">
          <p className="text-micro font-bold tracking-[0.1em] text-ink-2">SESUAIKAN SARAN</p>
          {filters.length ? <button type="button" onClick={() => setFilters([])} className="-my-3 min-h-11 px-1 text-label font-bold text-primary">Hapus semua</button> : null}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5">
          {FILTERS.map((f) => {
            const active = filters.includes(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 text-label font-semibold tracking-[0.02em] transition-colors ${active ? "bg-primary text-primary-foreground" : "border border-rule bg-card text-icon-muted"}`}>
                {t(f.key)}
              </button>
            );
          })}
        </div>
      </div>

      <section className="flex-1 px-5">
        <div className="flex items-center justify-between py-3">
          <h2 className="section-label text-ink-strong">{t("suggestions")}</h2>
          <button type="button" onClick={() => update({ suggestionSeed: state.suggestionSeed + 1 })} className="-my-2 flex min-h-11 items-center gap-1.5 px-1 text-micro font-bold tracking-[0.06em] text-primary">
            <RotateCcw className="size-3" strokeWidth={2.5} /> {t("shuffle")}
          </button>
        </div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-center text-15 text-ink-3">{t("no_match")}</p>
            <button type="button" onClick={() => { setFilters([]); setCat(""); }} className="rounded-full border-[1.5px] border-primary px-5 py-2.5 text-caption font-bold text-primary">{t("clear_filters")}</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-5">{list.map((r) => <CompactRecipe key={r.id} recipe={r} boxed />)}</div>
        )}
      </section>
      <AppTabs />
    </main>
  );
}
