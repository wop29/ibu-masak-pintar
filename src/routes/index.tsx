import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { ImportButton } from "@/components/racik/ImportDemo";
import { Onboarding } from "@/components/racik/Onboarding";
import { Sheet } from "@/components/racik/Sheet";
import { suggestionPool } from "@/lib/racik/data";
import { currentSlot, matchesFilter, preferProteins, suggest } from "@/lib/racik/recommend";
import { useRacik } from "@/lib/racik/state";
import { t, translate, type Lang, useLang } from "@/lib/racik/i18n";

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

/** The meal the title asks about. Tapping the phrase in the title changes it. */
const SLOTS = [
  { id: "sarapan", get phrase() { return t("slot_phrase_sarapan"); }, get label() { return t("sarapan"); } },
  { id: "makan_siang", get phrase() { return t("slot_phrase_makan_siang"); }, get label() { return t("makan_siang"); } },
  { id: "makan_malam", get phrase() { return t("slot_phrase_makan_malam"); }, get label() { return t("makan_malam"); } },
  { id: "camilan", get phrase() { return t("slot_phrase_camilan"); }, get label() { return t("camilan"); } },
] as const;
type SlotId = (typeof SLOTS)[number]["id"];

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
      <span className="sr-only">{t("memuat_racik")}</span>
    </main>
  );
}

function greeting(hour: number, lang: Lang) {
  if (hour < 10) return translate(lang, "greeting_morning");
  if (hour < 15) return translate(lang, "greeting_midday");
  if (hour < 18) return translate(lang, "greeting_evening");
  return translate(lang, "greeting_night");
}

function MasakApa() {
  const { state, ready, update } = useRacik();
  // null = follow the clock; a value = the person picked a meal in the title.
  const [picked, setPicked] = useState<SlotId | null>(null);
  const [slotSheet, setSlotSheet] = useState(false);
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

  const lang = useLang();
  const hello = greeting(hour, lang);
  const slot: SlotId = picked ?? (currentSlot(hour) as SlotId);
  const slotInfo = SLOTS.find((x) => x.id === slot) ?? SLOTS[2];

  const list = useMemo(() => {
    const base = preferProteins(suggest(suggestionPool(state.negara), state, hour, slot), state.proteins);
    // A meal picked in the title narrows the list; the clock only reorders it.
    const inSlot = (r: (typeof base)[number]) =>
      slot === "camilan" ? r.slots.includes("camilan") || r.slots.includes("jajan") : r.slots.includes(slot);
    const bySlot = picked ? base.filter(inSlot) : base.filter((r) => !r.slots.includes("pendamping") && !r.precise);
    return bySlot.filter((r) => filters.every((f) => matchesFilter(r, f))).slice(0, 6);
  }, [picked, slot, filters, state, hour]);

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
      <header className="border-b border-rule-soft bg-card px-5 pb-4 pt-[calc(2.75rem+env(safe-area-inset-top))]">
        <p className="mb-0.5 text-15 font-bold text-primary">{hello}</p>
        <h1 className="mb-1 text-hero font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">
          {t("masak_apa")}
          <button
            type="button"
            onClick={() => setSlotSheet(true)}
            aria-haspopup="dialog"
            aria-label={t("ganti_waktu_makan_sekarang", { label: slotInfo.label })}
            className="inline-flex items-baseline gap-1 rounded-lg text-primary underline decoration-2 underline-offset-4"
          >
            {slotInfo.phrase}
            <ChevronDown aria-hidden className="size-6 self-center" strokeWidth={2.6} />
          </button>
          ?
        </h1>
        <div className="mt-3 mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-14 font-bold">{t("masak_untuk")}{t("for_people", { n: state.household })}</p>
            <p className="text-caption leading-snug text-ink-3">{t("takaran_resep_ikut_jumlah_ini")}</p>
          </div>
          <div className="flex shrink-0 items-center rounded-xl border border-rule bg-ground p-[3px]">
            <button type="button" onClick={() => setHousehold(state.household - 1)} aria-label={t("kurangi_jumlah_orang")} className="flex size-11 items-center justify-center rounded-lg bg-card text-primary disabled:text-ink-3" disabled={state.household <= 1}><Minus className="size-5" /></button>
            <span aria-live="polite" className="w-[42px] text-center text-15 font-extrabold tabular-nums">{state.household}</span>
            <button type="button" onClick={() => setHousehold(state.household + 1)} aria-label={t("tambah_jumlah_orang")} className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:bg-tint disabled:text-ink-3" disabled={state.household >= MAX_PORTIONS}><Plus className="size-5" /></button>
          </div>
        </div>
        <Link to="/cari" className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rule-strong bg-tint px-3.5 py-3">
          <Search aria-hidden className="size-4 text-ink-faint" />
          <span className="text-15 text-ink-2">{t("search_placeholder")}</span>
        </Link>
        <div className="mt-3"><ImportButton /></div>
      </header>

      <div className="pt-4">
        <div role="group" aria-label={t("sesuaikan_saran")} className="no-scrollbar flex gap-2 overflow-x-auto px-5">
          {FILTERS.map((f) => {
            const active = filters.includes(f.id);
            return (
              <button key={f.id} type="button" aria-pressed={active} onClick={() => toggle(f.id)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 text-label font-semibold transition-colors ${active ? "bg-primary text-primary-foreground" : "border border-rule bg-card text-icon-muted"}`}>
                {active ? <Check aria-hidden className="mr-1 inline size-4 align-[-3px]" strokeWidth={2.6} /> : null}
                {t(f.key)}
              </button>
            );
          })}
          {filters.length ? <button type="button" onClick={() => setFilters([])} className="min-h-11 shrink-0 whitespace-nowrap px-2 text-label font-bold text-primary">{t("hapus_semua")}</button> : null}
        </div>
      </div>

      <section className="flex-1 px-5">
        <div className="flex items-center justify-between py-3">
          <h2 className="heading-sm">{t("suggestions")}</h2>
          <button type="button" onClick={() => update({ suggestionSeed: state.suggestionSeed + 1 })} className="-my-2 flex min-h-11 items-center gap-1.5 px-1 text-14 font-bold text-primary">
            <RotateCcw className="size-3" strokeWidth={2.5} /> {t("shuffle")}
          </button>
        </div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-center text-15 text-ink-3">{t("no_match")}</p>
            <button type="button" onClick={() => { setFilters([]); setPicked(null); }} className="rounded-full border-[1.5px] border-primary px-5 py-2.5 text-caption font-bold text-primary">{t("clear_filters")}</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-5">{list.map((r) => <CompactRecipe key={r.id} recipe={r} boxed />)}</div>
        )}
      </section>
      <Sheet open={slotSheet} onClose={() => setSlotSheet(false)} title={t("masak_untuk_kapan")}>
        <div role="radiogroup" aria-label={t("waktu_makan")} className="grid grid-cols-2 gap-2.5">
          {SLOTS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={slot === x.id}
              onClick={() => { setPicked(x.id); setSlotSheet(false); }}
              className={`min-h-14 rounded-2xl px-4 text-left text-15 font-bold ${slot === x.id ? "border-2 border-primary bg-primary-soft text-primary-deep" : "border border-rule bg-card text-ink"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        {picked ? (
          <button type="button" onClick={() => { setPicked(null); setSlotSheet(false); }} className="mt-3 min-h-11 text-14 font-bold text-primary">
            
            {t("ikuti_jam_sekarang")}
          </button>
        ) : null}
      </Sheet>
      <AppTabs />
    </main>
  );
}
