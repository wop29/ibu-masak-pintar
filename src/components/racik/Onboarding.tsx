import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { useRacik } from "@/lib/racik/state";
import { SignInOffer } from "@/components/racik/SignInOffer";
import { BrandIcon } from "@/components/racik/BrandIcon";
import { Splash, WelcomeSlides } from "@/components/racik/WelcomeIntro";
import { t } from "@/lib/racik/i18n";
import protAyam from "@/assets/brand/onboarding/protein-ayam.webp";
import protIkan from "@/assets/brand/onboarding/protein-ikan.webp";
import protTelur from "@/assets/brand/onboarding/protein-telur.webp";
import protTahu from "@/assets/brand/onboarding/protein-tahu-tempe.webp";
import protDaging from "@/assets/brand/onboarding/protein-daging.webp";

/*
 * First run: splash → four welcome slides → four short questions → account
 * offer. Restyled 6 Nov 2026 after SideChef's onboarding (Mobbin): light
 * cream pages, centred titles, icon tiles that get a green outline and a
 * check when chosen, pastel illustration tiles for proteins.
 */

const WHO = [
  { v: "harian", icon: "menu-harian", get label() { return t("sehari_hari_di_rumah"); }, get hint() { return t("makan_sendiri_atau_bersama_keluarga"); }, n: null },
  { v: "bekal", icon: "rantang", get label() { return t("bekal_meal_prep"); }, get hint() { return t("masak_sekali_untuk_beberapa_hari"); }, n: null },
  { v: "acara", icon: "tumpeng", get label() { return t("acara_tamu"); }, get hint() { return t("arisan_syukuran_kumpul_keluarga"); }, n: 10 },
  { v: "jualan", icon: "warung", get label() { return t("untuk_dijual"); }, get hint() { return t("katering_atau_jualan_kecil_kecilan"); }, n: 10 },
] as const;
const PRIORITIES = [
  { v: "kurang_30_menit", icon: "timer", get label() { return t("prio_kurang_30_menit"); } },
  { v: "gampang", icon: "langkah", get label() { return t("prio_gampang"); } },
  { v: "protein_tinggi", icon: "protein-tinggi", get label() { return t("prio_protein_tinggi"); } },
  { v: "anak_suka", icon: "anak-suka", get label() { return t("prio_anak_suka"); } },
  { v: "sekali_masak_banyak", icon: "masak-banyak", get label() { return t("prio_sekali_masak_banyak"); } },
] as const;
const PROTEINS = [
  { v: "ayam", art: protAyam, get label() { return t("protein_pick_ayam"); } },
  { v: "ikan", art: protIkan, get label() { return t("protein_pick_ikan"); } },
  { v: "telur", art: protTelur, get label() { return t("protein_pick_telur"); } },
  { v: "tahu_tempe", art: protTahu, get label() { return t("protein_pick_tahu_tempe"); } },
  { v: "daging", art: protDaging, get label() { return t("protein_pick_daging"); } },
] as const;
const QUESTIONS = [
  { get title() { return t("biasanya_masak_untuk_apa"); }, get body() { return t("pilih_yang_paling_sering_porsinya"); } },
  { get title() { return t("biasanya_masak_untuk_berapa_orang"); }, get body() { return t("takaran_bahan_akan_langsung_menyesuaikan"); } },
  { get title() { return t("apa_yang_paling_penting_saat"); }, get body() { return t("pilih_satu_atau_beberapa_agar"); } },
  { get title() { return t("protein_apa_yang_paling_sering"); }, get body() { return t("racik_akan_menampilkan_lebih_banyak"); } },
];

/** A survey tile: cream card, soft shadow; chosen = green outline and a check badge. */
function tileClass(on: boolean) {
  return `relative w-full rounded-[20px] bg-card text-center transition-[transform,box-shadow] active:scale-[0.97] ${
    on ? "border-2 border-primary shadow-[0_8px_20px_rgba(31,61,46,0.14)]" : "border-2 border-transparent shadow-[0_2px_10px_rgba(31,61,46,0.07)]"
  }`;
}
function Tick({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="absolute right-2 top-2 flex size-[22px] items-center justify-center rounded-full bg-primary" aria-hidden>
      <Check className="size-3 text-primary-foreground" strokeWidth={3.4} />
    </span>
  );
}
function Person({ on }: { on: boolean }) {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden className={on ? "text-primary" : "text-[#B9C7B6]"}>
      <circle cx="8" cy="5" r="4" fill="currentColor" />
      <path d="M1 18c0-4.4 3.1-7 7-7s7 2.6 7 7z" fill="currentColor" />
    </svg>
  );
}

function Preferences({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { state, update } = useRacik();
  const [step, setStep] = useState(0);
  const q = QUESTIONS[step] ?? QUESTIONS[0]!;
  const last = step === QUESTIONS.length - 1;
  const toggle = (key: "priorities" | "proteins", v: string) =>
    update((s) => ({ [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));
  const back = () => (step === 0 ? onBack() : setStep((v) => v - 1));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground">
      <div className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={back} aria-label={t("back")} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink">
          <ArrowLeft className="size-5" strokeWidth={2.2} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
        <button type="button" onClick={onDone} className="min-h-11 px-1 text-caption font-extrabold text-ink-2 underline underline-offset-[3px]">{t("skip")}</button>
      </div>

      <div key={step} className="flex-1 px-[18px] pt-6">
        <div className="animate-fade-in px-1 text-center">
          <h1 className="font-display text-28 font-extrabold leading-[1.08] text-primary">{q.title}</h1>
          <p className="mx-auto mt-2 max-w-[320px] text-14 leading-snug text-ink-2">{q.body}</p>
        </div>

        {step === 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {WHO.map((o, k) => {
              const on = state.cookingFor === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update(o.n === null ? { cookingFor: o.v } : { cookingFor: o.v, household: Math.max(state.household, o.n) })}
                  className={`animate-fade-in px-3 pb-4 pt-[18px] ${tileClass(on)}`}
                  style={{ animationDelay: `${k * 40}ms` }}
                >
                  <BrandIcon name={o.icon} className="mx-auto size-16 rounded-2xl" />
                  <span className="mt-2.5 block text-15 font-extrabold text-ink">{o.label}</span>
                  <span className="mt-0.5 block text-caption font-semibold leading-snug text-ink-3">{o.hint}</span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((n, k) => {
              const on = n === 6 ? state.household >= 6 : state.household === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ household: n === 6 && state.household > 6 ? state.household : n })}
                  className={`animate-fade-in px-1.5 pb-3.5 pt-4 ${tileClass(on)}`}
                  style={{ animationDelay: `${k * 30}ms` }}
                >
                  <span className="flex min-h-10 flex-wrap content-center justify-center gap-0.5 px-1.5">
                    {Array.from({ length: n }, (_, i) => <Person key={i} on={on} />)}
                  </span>
                  <span className="mt-2 block font-display text-2xl font-extrabold leading-none text-primary">
                    {n === 6 && state.household > 6 ? state.household : n}{n === 6 && state.household <= 6 ? "+" : ""}
                  </span>
                  <span className="mt-0.5 block text-caption font-bold text-ink-3">{t("orang")}</span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {PRIORITIES.map(({ v, icon, label }, k) => {
              const on = state.priorities.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("priorities", v)}
                  className={`animate-fade-in px-2.5 pb-4 pt-[18px] ${tileClass(on)}`}
                  style={{ animationDelay: `${k * 40}ms` }}
                >
                  <BrandIcon name={icon} className="mx-auto size-14 rounded-[14px]" />
                  <span className="mt-2.5 block text-14 font-extrabold text-ink">{label}</span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {PROTEINS.map(({ v, art, label }, k) => {
              const on = state.proteins.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("proteins", v)}
                  className={`animate-fade-in px-2 pb-3 pt-2.5 ${tileClass(on)}`}
                  style={{ animationDelay: `${k * 40}ms` }}
                >
                  <img src={art} alt="" aria-hidden width={320} height={320} className="aspect-square w-full rounded-2xl object-cover" />
                  <span className="mt-2 block text-[13.5px] font-extrabold leading-tight text-ink">{label}</span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-4">
        <p className="mb-2.5 text-center text-caption font-extrabold text-ink-2">{t("step_n_of", { n: step + 1, total: QUESTIONS.length })}</p>
        <button type="button" onClick={last ? onDone : () => setStep((v) => v + 1)} className="min-h-14 w-full rounded-full bg-cta text-body font-extrabold text-cta-foreground shadow-glow-cta">
          {last ? t("simpan_dan_mulai") : t("continue_")}
        </button>
      </div>
    </main>
  );
}

export function Onboarding() {
  const { update } = useRacik();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"splash" | "slides" | "questions" | "signin">("splash");
  const finish = () => update({ intro: true });
  const toSlides = useCallback(() => setPhase((p) => (p === "splash" ? "slides" : p)), []);
  const signIn = () => { finish(); navigate({ to: "/masuk" }); };

  if (phase === "splash") return <Splash onDone={toSlides} />;
  if (phase === "signin") return <SignInOffer onDone={finish} onBack={() => setPhase("questions")} />;
  if (phase === "questions") return <Preferences onBack={() => setPhase("slides")} onDone={() => setPhase("signin")} />;
  return <WelcomeSlides onStart={() => setPhase("questions")} onSignIn={signIn} />;
}
