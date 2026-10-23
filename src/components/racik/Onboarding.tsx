import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Link2 } from "lucide-react";
import { useRacik } from "@/lib/racik/state";
import { ART } from "@/components/racik/photos";
import { SignInOffer } from "@/components/racik/SignInOffer";
import { byId } from "@/lib/racik/data";
import { carbPerPortion, fiberPerPortion, fmtGrams, fmtProtein, proteinPerPortion } from "@/lib/racik/engine";

const SLIDES = [
  {
    photo: ART.woku,
    label: "Tambah resep dari luar",
    headline: "Simpan resep tanpa memutar ulang video",
    body: "Masukkan link video, teks, atau foto. Racik akan menyusun bahan, takaran, dan langkah memasaknya.",
    cta: "Mulai",
  },
  {
    photo: ART.mendoan,
    label: "Takaran yang familiar",
    headline: "Gunakan takaran yang mudah dipakai",
    body: "Lihat bahan dalam gram, sendok, gelas, atau ukuran rumahan lain yang lebih praktis di dapur.",
    cta: "Lanjut",
  },
  {
    photo: ART.rendang,
    label: "Masakan Nusantara",
    headline: "Ratusan resep dari berbagai daerah",
    body: "Dari rendang Minang sampai papeda Papua, temukan resep dengan bahan, takaran, dan langkah yang jelas.",
    cta: "Lanjut",
  },
  {
    photo: ART.gado,
    label: "Gizi lebih mudah dipahami",
    headline: "Lihat perkiraan protein per porsi",
    body: "Setiap resep menampilkan perkiraan protein berdasarkan bahan dan jumlah porsinya.",
    cta: "Ayo Mulai Masak",
  },
] as const;

/** Slide 1: a phone playing a cooking video, and the one action Racik asks for. */
function VideoOverlay() {
  return (
    <div className="pointer-events-none flex h-full max-h-[280px] flex-col items-center justify-center">
      <div className="relative min-h-[130px] w-[150px] flex-1 overflow-hidden [@container(max-height:175px)]:hidden rounded-[20px] border-2 border-white/25 bg-black/45 shadow-deep backdrop-blur-[2px]">
        <div className="absolute inset-0 flex items-center justify-center pb-[60px]">
          <span className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-white/40 bg-white/15">
            <svg width="12" height="14" viewBox="0 0 12 14" fill="white" aria-hidden><path d="M1 1l10 6-10 6V1z" /></svg>
          </span>
        </div>
        <div className="absolute right-10 bottom-14 left-3 text-white">
          <p className="mb-1.5 flex items-center gap-1.5 text-micro font-bold"><span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-caption">👩‍🍳</span>@dapur_rumahan</p>
          <p className="text-micro leading-snug text-white/85">Rendang empuk tanpa panci presto 🔥</p>
        </div>
        <div className="absolute right-3 bottom-6 left-3">
          <div className="h-0.5 rounded bg-white/25"><div className="h-full w-[62%] rounded bg-white" /></div>
        </div>
      </div>
      <div className="relative -mt-4 flex shrink-0 [@container(max-height:175px)]:mt-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 shadow-[0_4px_20px_var(--glow)]">
        <Link2 className="size-3.5 text-white" strokeWidth={2.5} />
        <span className="text-label font-bold text-white">Tempel link di sini</span>
      </div>
    </div>
  );
}

/** Slide 2: the household measures Racik writes next to grams. */
function MeasureOverlay() {
  const rows = [
    { label: "1 sdm", value: "± 15 ml", icon: "🥄" },
    { label: "1 sdt", value: "± 5 ml", icon: "🥄" },
    { label: "1 gelas belimbing", value: "200 ml", icon: "🥛" },
    { label: "1 ons", value: "100 g", icon: "⚖️" },
  ];
  return (
    <div className="pointer-events-none flex w-full justify-center [@container(max-height:215px)]:hidden">
      <div className="mx-6 w-[80%] max-w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-black/60 backdrop-blur-md">
        <p className="border-b border-white/10 px-4 py-3 text-micro font-bold uppercase tracking-[0.1em] text-white/50">Konversi takaran</p>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 last:border-b-0">
            <span className="flex items-center gap-2 text-14 font-semibold text-white"><span aria-hidden>{r.icon}</span>{r.label}</span>
            <span className="rounded-full bg-primary px-3 py-0.5 text-caption font-bold text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Slide 4: a real recipe's real estimates — the same numbers its page shows. */
function NutritionOverlay() {
  const recipe = byId("ayam_taliwang") ?? byId("rendang");
  const stats = useMemo(() => {
    if (!recipe) return null;
    const p = proteinPerPortion(recipe);
    return { p, protein: fmtProtein(p), carb: fmtGrams(carbPerPortion(recipe)), fiber: fmtGrams(fiberPerPortion(recipe)) };
  }, [recipe]);
  if (!recipe || !stats) return null;
  return (
    <div className="pointer-events-none flex w-full flex-col items-center [@container(max-height:250px)]:hidden">
      <div className="mx-5 w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,10,10,0.7)] backdrop-blur-md">
        <div className="border-b border-white/[0.08] px-4 pt-4 pb-3">
          <p className="mb-1 text-micro font-semibold uppercase tracking-[0.08em] text-white/45">{recipe.title} · per porsi</p>
          <p className="text-caption text-white/70">Perkiraan gizi per porsi</p>
        </div>
        <div className="border-b border-white/[0.08] px-4 py-3">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-label font-semibold text-white/50">PROTEIN</span>
            <span className="text-head font-extrabold tracking-[-0.02em] text-white">{stats.protein}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((stats.p / 30) * 100))}%` }} /></div>
          <p className="mt-1 text-micro text-white/55">Perkiraan berdasarkan bahan dan porsi</p>
        </div>
        <div className="flex gap-3 px-4 py-3">
          {[{ name: "Karbo", v: stats.carb }, { name: "Serat", v: stats.fiber }].map((m) => (
            <div key={m.name} className="flex-1">
              <p className="mb-1 text-micro font-semibold uppercase tracking-[0.04em] text-white/55">{m.name}</p>
              <p className="text-15 font-extrabold text-white">{m.v ?? "–"}</p>
            </div>
          ))}
        </div>
        <p className="px-4 pb-3 text-micro italic text-white/55">* Perkiraan dari bahan standar. Nilai sebenarnya bisa berbeda.</p>
      </div>
    </div>
  );
}

const WHO = [
  { v: "harian", label: "Sehari-hari di rumah", hint: "Makan sendiri atau bersama keluarga", n: null },
  { v: "bekal", label: "Bekal / meal prep", hint: "Masak sekali untuk beberapa hari", n: null },
  { v: "acara", label: "Acara & tamu", hint: "Arisan, syukuran, kumpul keluarga", n: 10 },
  { v: "jualan", label: "Untuk dijual", hint: "Katering atau jualan kecil-kecilan", n: 10 },
] as const;
const PRIORITIES = [
  ["kurang_30_menit", "Cepat dimasak"],
  ["gampang", "Mudah diikuti"],
  ["protein_tinggi", "Protein tinggi"],
  ["anak_suka", "Anak suka"],
  ["sekali_masak_banyak", "Sekali masak banyak"],
] as const;
const PROTEINS = [
  ["ayam", "Ayam"],
  ["ikan", "Ikan & udang"],
  ["telur", "Telur"],
  ["tahu_tempe", "Tahu & tempe"],
  ["daging", "Daging"],
  ["sayur", "Lebih banyak sayur"],
] as const;
const QUESTIONS = [
  { title: "Biasanya masak untuk apa?", body: "Pilih yang paling sering. Porsinya bisa diatur di langkah berikutnya." },
  { title: "Biasanya masak untuk berapa orang?", body: "Takaran bahan akan langsung menyesuaikan jumlah ini." },
  { title: "Apa yang paling penting saat memilih resep?", body: "Pilih satu atau beberapa agar saran lebih sesuai." },
  { title: "Protein apa yang paling sering dimasak?", body: "Racik akan menampilkan lebih banyak pilihan yang relevan." },
];

function Preferences({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { state, update } = useRacik();
  const [step, setStep] = useState(0);
  const q = QUESTIONS[step] ?? QUESTIONS[0]!;
  const last = step === QUESTIONS.length - 1;
  const toggle = (key: "priorities" | "proteins", v: string) =>
    update((s) => ({ [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));
  const back = () => (step === 0 ? onBack() : setStep((v) => v - 1));
  const card = (on: boolean) => `${on ? "border-2 border-primary bg-primary-soft text-primary-deep" : "border border-rule bg-card text-ink"}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground">
      <div className="flex items-center gap-4 px-5 pt-[calc(3rem+env(safe-area-inset-top))]">
        <button type="button" onClick={back} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-rule bg-card"><ArrowLeft className="size-[19px]" strokeWidth={2.3} /></button>
        <div className="flex flex-1 gap-2">{QUESTIONS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-rule"}`} />)}</div>
        <button type="button" onClick={onDone} className="min-h-11 px-1 text-caption font-bold text-ink-3">Lewati</button>
      </div>

      <div className="flex-1 px-6 pt-[54px]">
        <p className="text-micro font-extrabold tracking-[0.12em] text-primary">LANGKAH {step + 1} DARI {QUESTIONS.length}</p>
        <h1 className="mt-2 max-w-[340px] text-hero font-extrabold leading-[1.12] tracking-[-0.04em]">{q.title}</h1>
        <p className="mt-3 max-w-[340px] text-15 leading-relaxed text-ink-3">{q.body}</p>

        {step === 0 ? (
          <div className="mt-9 grid grid-cols-1 gap-3">
            {WHO.map((o) => (
              <button key={o.v} type="button" aria-pressed={state.cookingFor === o.v} onClick={() => update(o.n === null ? { cookingFor: o.v } : { cookingFor: o.v, household: Math.max(state.household, o.n) })} className={`flex min-h-[68px] flex-col justify-center rounded-2xl px-4 text-left ${card(state.cookingFor === o.v)}`}>
                <span className="text-14 font-extrabold">{o.label}</span>
                <span className="mt-0.5 text-micro font-semibold text-ink-3">{o.hint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-9 grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const on = n === 6 ? state.household >= 6 : state.household === n;
              return (
                <button key={n} type="button" onClick={() => update({ household: n === 6 && state.household > 6 ? state.household : n })} className={`min-h-[72px] rounded-2xl text-xl font-extrabold ${card(on)}`}>
                  {n === 6 && state.household > 6 ? state.household : n}{n === 6 && state.household <= 6 ? "+" : ""}
                  <span className="mt-0.5 block text-micro font-semibold text-ink-3">orang</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-9 flex flex-wrap gap-3">
            {PRIORITIES.map(([v, label]) => {
              const on = state.priorities.includes(v);
              return <button key={v} type="button" onClick={() => toggle("priorities", v)} className={`min-h-12 rounded-full px-[17px] text-14 font-bold ${on ? "border border-primary bg-primary text-primary-foreground" : "border border-rule bg-card text-ink"}`}>{label}</button>;
            })}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-9 grid grid-cols-2 gap-3">
            {PROTEINS.map(([v, label]) => (
              <button key={v} type="button" onClick={() => toggle("proteins", v)} className={`min-h-[62px] rounded-2xl px-4 text-left text-14 font-extrabold ${card(state.proteins.includes(v))}`}>{label}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-6 pt-4 pb-[max(28px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={last ? onDone : () => setStep((v) => v + 1)} className="min-h-14 w-full rounded-full bg-primary text-body font-extrabold text-primary-foreground shadow-glow">
          {last ? "Simpan dan mulai" : "Lanjut"}
        </button>
      </div>
    </main>
  );
}

export function Onboarding() {
  const { update } = useRacik();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"slides" | "questions" | "signin">("slides");
  const [animKey, setAnimKey] = useState(0);
  const touchX = useRef<number | null>(null);
  const slide = SLIDES[index] ?? SLIDES[0];
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;
  const finish = () => update({ intro: true });

  const go = (to: number) => { setIndex(to); setAnimKey((k) => k + 1); };
  const advance = () => (isLast ? setPhase("questions") : go(index + 1));
  const back = () => { if (!isFirst) go(index - 1); };

  if (phase === "signin") return <SignInOffer onDone={finish} onBack={() => setPhase("questions")} />;
  if (phase === "questions") return <Preferences onBack={() => setPhase("slides")} onDone={() => setPhase("signin")} />;

  return (
    <main
      className="relative mx-auto flex h-dvh w-full max-w-[430px] select-none flex-col overflow-hidden bg-dark"
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const delta = touchX.current - (e.changedTouches[0]?.clientX ?? touchX.current);
        if (delta > 50) advance();
        else if (delta < -50) back();
        touchX.current = null;
      }}
    >
      <img key={`${index}-${animKey}`} src={slide.photo} alt="" draggable={false} className={`onboarding-cinematic onboarding-cinematic-${index + 1} absolute inset-0 h-full w-full object-cover`} />
      <div className="onboarding-light-drift pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.52)_45%,rgba(0,0,0,0.12)_100%)]" />

      <div className="relative z-20 shrink-0 px-5 pt-[calc(3rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={back} aria-label="Kembali" tabIndex={isFirst ? -1 : 0} className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur-sm transition-opacity ${isFirst ? "pointer-events-none opacity-0" : "opacity-100"}`}>
            <ArrowLeft className="size-4 text-white" strokeWidth={2.5} />
          </button>
          <div className="flex flex-1 gap-1.5">
            {SLIDES.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-[width] duration-400" style={{ width: i <= index ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
          <button type="button" onClick={finish} className="min-h-11 shrink-0 px-1 text-14 font-semibold text-white/70">Lewati</button>
        </div>
        {isFirst ? (
          <div className="mt-5 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2C6.5 2 3 6.5 3 12c0 3.5 1.8 6.6 4.5 8.4L12 22l4.5-1.6C19.2 18.6 21 15.5 21 12c0-5.5-3.5-10-9-10z" fill="white" opacity="0.9" />
                <path d="M12 6v16" stroke="#2e7d32" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
            <span className="text-xl font-extrabold tracking-[-0.02em] text-white">Racik</span>
          </div>
        ) : null}
      </div>

      {/* The illustration gets whatever room is left between the top bar and the
          text, so it can never sit on top of the headline on short screens. */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-4 [container-type:size]">
        {index === 0 ? <VideoOverlay /> : null}
        {index === 1 ? <MeasureOverlay /> : null}
        {index === 3 ? <NutritionOverlay /> : null}
      </div>

      <div key={animKey} className="relative z-20 shrink-0 px-6 pb-[max(40px,env(safe-area-inset-bottom))] [@media(max-height:720px)]:pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="animate-slide-up mb-5 inline-flex [@media(max-height:720px)]:mb-3 items-center rounded-full border border-white/15 bg-white/10 px-3 py-[5px] backdrop-blur-sm">
          <span className="text-label font-semibold tracking-[0.04em] text-white/70">{slide.label}</span>
        </div>
        <h1 className="animate-slide-up-2 mb-3.5 text-display [@media(max-height:720px)]:mb-2 [@media(max-height:720px)]:text-28 font-extrabold leading-[1.08] tracking-[-0.03em] text-white">{slide.headline}</h1>
        <p className="animate-slide-up-2 mb-7 text-body leading-[1.65] [@media(max-height:720px)]:mb-5 [@media(max-height:720px)]:leading-[1.5] text-white/70">{slide.body}</p>
        <button type="button" onClick={advance} className="animate-slide-up-3 flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-primary text-body font-bold tracking-[-0.01em] text-white shadow-[0_8px_32px_var(--glow)]">
          {slide.cta}{!isLast ? <ArrowRight className="size-[18px]" strokeWidth={2.5} /> : null}
        </button>
        <div className="mt-5 flex justify-center gap-2">
          {SLIDES.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/25"}`} />)}
        </div>
      </div>
    </main>
  );
}
