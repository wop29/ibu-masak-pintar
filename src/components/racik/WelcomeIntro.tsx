import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { byId, ING } from "@/lib/racik/data";
import { fmtKcal, fmtProtein, isSeasoning, kcalPerPortion, proteinPerPortion, qtyDisplay, scaledQty, unitOf } from "@/lib/racik/engine";
import { photosOf, thumbOf } from "@/components/racik/photos";
import { t } from "@/lib/racik/i18n";
import wordmark from "@/assets/brand/wordmark/racik-wordmark.svg";

/**
 * First run, in the style of SideChef's onboarding (Mobbin reference, 6 Nov
 * 2026): a splash where ingredients fall in, then four light slides with big
 * tilted cards over a soft sage shape, a centred headline, and "Masuk", dots
 * and a pill button along the bottom.
 *
 * The cards are real Racik screens in miniature. Every number on them comes
 * from the engine and the recipe data, so they stay true when the data moves.
 */

const BAHAN = import.meta.glob<string>("../../assets/brand/bahan/*.webp", { eager: true, query: "?url", import: "default" });
const bahan = (name: string): string => BAHAN[`../../assets/brand/bahan/${name}.webp`] ?? "";
const photo = (id: string): string => photosOf(id)[0] ?? thumbOf(id) ?? "";

/** Scales a fixed-size stage to fit the room it gets, so the composed cards keep their layout on every phone. */
function useFit(w: number, h: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / w, el.clientHeight / h, 1.15));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);
  return { ref, scale };
}

/* ---------------------------------------------------------------- splash */

const FALL: { name: string; r: number; style: CSSProperties }[] = [
  { name: "cabai", r: -18, style: { left: "4%", top: "5%", width: "31%" } },
  { name: "bawang-putih", r: 8, style: { left: "43%", top: "8%", width: "24%" } },
  { name: "tomat", r: -6, style: { right: "5%", top: "4%", width: "25%" } },
  { name: "daun-jeruk", r: 22, style: { left: "16%", top: "21%", width: "25%" } },
  { name: "kunyit", r: -12, style: { right: "12%", top: "21%", width: "28%" } },
  { name: "bawang-merah", r: 10, style: { left: "49%", top: "26%", width: "16%" } },
  { name: "cabai-rawit", r: -30, style: { left: "2%", top: "35%", width: "24%" } },
  { name: "jeruk-nipis", r: 14, style: { right: "-3%", top: "37%", width: "23%" } },
  { name: "tempe", r: -8, style: { left: "6%", bottom: "14%", width: "30%" } },
  { name: "serai", r: 28, style: { left: "40%", bottom: "18%", width: "25%" } },
  { name: "telur", r: -14, style: { right: "8%", bottom: "16%", width: "18%" } },
  { name: "kemiri", r: 6, style: { left: "27%", bottom: "4%", width: "20%" } },
  { name: "cabai", r: 40, style: { right: "16%", bottom: "3%", width: "26%" } },
];

export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <main
      role="button"
      tabIndex={0}
      aria-label={t("wl_splash_aria")}
      onClick={onDone}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDone(); }}
      className="relative mx-auto h-dvh w-full max-w-[430px] select-none overflow-hidden bg-ground"
    >
      {FALL.map((f, i) => (
        <img
          key={i}
          src={bahan(f.name)}
          alt=""
          aria-hidden
          draggable={false}
          className="rk-drop pointer-events-none absolute h-auto"
          style={{ ...f.style, ["--r" as string]: `${f.r}deg`, animationDelay: `${i * 0.06}s, ${0.8 + (i % 5) * 0.2}s` }}
        />
      ))}
      <div className="rk-pop absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
        <img src={wordmark} alt={t("racik")} className="mx-auto h-[54px] w-auto" />
        <p className="mx-auto mt-3.5 max-w-[280px] font-display text-[22px] font-bold leading-[1.15] text-primary">{t("wl_splash_line")}</p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- slides */

const card = "rounded-[22px] bg-card shadow-[0_18px_40px_rgba(31,61,46,0.16),0_2px_6px_rgba(31,61,46,0.08)]";
const tag = "inline-block whitespace-nowrap rounded-full bg-card px-2.5 py-[5px] text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-primary shadow-[0_4px_12px_rgba(31,61,46,0.15)]";
const tilt = (r: number, delay = 0): CSSProperties => ({ ["--r" as string]: `${r}deg`, animationDelay: `${delay}s` });

function Line({ name, value, last, children }: { name: string; value: string; last?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex items-baseline gap-2 py-[7px] text-[13px] ${last ? "" : "border-b border-rule-soft"}`}>
      <span className="truncate">{name}</span>
      {children}
      <b className="ml-auto whitespace-nowrap font-extrabold text-primary">{value}</b>
    </div>
  );
}

/** Lines of a recipe at a portion count, through the same engine the recipe page uses. */
function lines(recipeId: string, ids: string[], servings: number) {
  const r = byId(recipeId);
  if (!r) return [];
  return ids.flatMap((id) => {
    const l = r.ings.find((x) => x[0] === id);
    if (!l) return [];
    const d = qtyDisplay(id, scaledQty(l, r, servings), unitOf(l), "rumah", "ID");
    return [{ id, name: ING[id]?.name ?? id, value: d.main, seasoning: isSeasoning(id) }];
  });
}

function gizi(recipeId: string) {
  const r = byId(recipeId);
  if (!r) return { kcal: null, protein: null };
  const k = kcalPerPortion(r);
  return { kcal: k == null ? null : fmtKcal(k), protein: fmtProtein(proteinPerPortion(r)) };
}

function SlideVideo() {
  const rica = useMemo(() => lines("ayam_rica_rica", ["ayam", "cabai_rawit", "bawang_merah", "garam"], 4), []);
  const g = useMemo(() => gizi("ayam_rica_rica"), []);
  return (
    <>
      <div className={`rk-card-in absolute left-[34px] top-[44px] h-[300px] w-[196px] overflow-hidden bg-dark ${card}`} style={tilt(-7)}>
        <img src={photo("ayam_rica_rica")} alt="" className="h-full w-full object-cover opacity-90" />
        <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(28,38,32,0.8),rgba(28,38,32,0)_55%)]" />
        <span className={`${tag} absolute left-3 top-3`}>{t("wl_tag_tiktok")}</span>
        <span className="absolute left-1/2 top-[40%] flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card/95">
          <svg width="16" height="18" viewBox="0 0 12 14" fill="currentColor" className="text-primary" aria-hidden><path d="M1 1l10 6-10 6V1z" /></svg>
        </span>
        <p className="absolute inset-x-3 bottom-3.5 text-[12.5px] font-bold leading-[1.35] text-white">{t("wl1_quote")}</p>
      </div>
      <svg className="animate-fade-in absolute left-[200px] top-[40px] text-primary" width="70" height="60" viewBox="0 0 70 60" aria-hidden style={{ animationDelay: "0.35s" }}>
        <path d="M6 50 C20 14 44 6 62 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="4 5" strokeLinecap="round" />
        <path d="M54 5 L63 12 L54 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className={`rk-card-in absolute right-[26px] top-[138px] w-[214px] px-3.5 pb-3 pt-3.5 ${card}`} style={tilt(5, 0.2)}>
        <span className="absolute right-3 top-3 flex size-[30px] items-center justify-center rounded-full bg-primary">
          <svg width="13" height="15" viewBox="0 0 12 14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M1.5 1.5h9v11L6 9.5l-4.5 3z" /></svg>
        </span>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-2">{t("wl_jadi_resep")}</p>
        <p className="mb-1.5 mt-0.5 font-display text-[19px] font-extrabold leading-[1.1] text-primary">{byId("ayam_rica_rica")?.title}</p>
        {rica.map((l, i) => <Line key={l.id} name={l.name} value={l.value} last={i === rica.length - 1} />)}
        {g.kcal && g.protein ? (
          <span className="mt-1.5 inline-block rounded-[10px] bg-notice px-2 py-[5px] text-[11.5px] font-extrabold text-notice-ink">± {g.kcal} · ± {g.protein} {t("protein").toLowerCase()}</span>
        ) : null}
      </div>
      <img src={bahan("cabai")} alt="" aria-hidden className="rk-bob absolute left-[26px] top-[362px] w-[70px]" />
      <img src={bahan("daun-jeruk")} alt="" aria-hidden className="rk-bob absolute left-[96px] top-[400px] w-[56px]" style={{ animationDelay: "0.6s" }} />
    </>
  );
}

const TILES: { id: string; tag?: () => string }[] = [
  { id: "ayam_taliwang" }, { id: "w_pasta_with_chickpeas", tag: () => t("wl_tag_english") }, { id: "sayur_asem" }, { id: "gulai_kambing" },
  { id: "gado_gado" }, { id: "sate_ayam_madura", tag: () => t("wl_tag_tiktok") }, { id: "telur_balado" }, { id: "adobong_manok", tag: () => t("wl_tag_tagalog") },
  { id: "sinigang_na_hipon", tag: () => t("wl_tag_reels") }, { id: "ikan_bakar_bumbu" }, { id: "tempe_mendoan", tag: () => t("wl_tag_foto") }, { id: "opor_ayam" },
];

function SlideSources() {
  return (
    <>
      <div className="absolute left-[-40px] top-[10px] grid w-[470px] rotate-[-9deg] grid-cols-[repeat(4,104px)] gap-3.5">
        {TILES.map((tile, k) => (
          <div
            key={tile.id}
            className={`animate-fade-in relative ${tile.tag ? "drop-shadow-[0_10px_18px_rgba(31,61,46,0.22)]" : "opacity-35"}`}
            style={{ animationDelay: `${k * 0.04}s` }}
          >
            <img src={thumbOf(tile.id) ?? ""} alt="" className="size-[104px] rounded-[22px] object-cover" />
            {tile.tag ? <span className={`${tag} absolute -top-3 left-1/2 -translate-x-1/2`}>{tile.tag()}</span> : null}
          </div>
        ))}
      </div>
      <img src={bahan("tangan-tunjuk")} alt="" aria-hidden className="rk-bob absolute left-[250px] top-[120px] z-10 w-[150px]" />
      <div className={`rk-card-in absolute left-[40px] top-[300px] w-[250px] px-4 py-3.5 ${card}`} style={tilt(3, 0.25)}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-2">{t("wl_jadi_bahasa")}</p>
        <div className="border-b border-rule-soft py-[7px] text-[13px] text-ink-3 line-through">{t("wl2_from")}</div>
        <Line name={t("wl2_to_name")} value={t("wl2_to_qty")} last />
        <p className="text-[11.5px] text-ink-3">{t("wl2_to_hint")}</p>
      </div>
    </>
  );
}

function SlidePortions() {
  const [n, setN] = useState(4);
  const rows = useMemo(() => lines("rendang", ["daging_sapi", "santan", "cabai_merah", "garam"], n), [n]);
  return (
    <>
      <div className={`absolute left-12 top-[30px] h-[330px] w-[250px] rotate-[-8deg] overflow-hidden opacity-55 ${card}`}>
        <img src={photo("opor_ayam")} alt="" className="h-[140px] w-full object-cover" />
      </div>
      <div className={`rk-card-in absolute left-[70px] top-[46px] w-[266px] overflow-hidden ${card}`} style={tilt(4)}>
        <img src={photo("rendang")} alt="" className="h-[118px] w-full object-cover" />
        <div className="px-3.5 py-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-[19px] font-extrabold text-primary">{byId("rendang")?.title}</p>
            <span className="text-[11.5px] font-extrabold text-ink-2">{t("wl3_untuk")}</span>
          </div>
          <div role="group" aria-label={t("biasanya_masak_untuk_berapa_orang")} className="mt-1.5 flex gap-1.5">
            {[2, 4, 8].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={n === v}
                onClick={() => setN(v)}
                className={`min-h-[34px] flex-1 rounded-full text-[13px] ${n === v ? "bg-primary font-extrabold text-primary-foreground" : "border border-rule-strong bg-card font-bold text-ink"}`}
              >
                {v} {t("orang")}
              </button>
            ))}
          </div>
          <div className="mt-1">
            {rows.map((l, i) => (
              <Line key={l.id} name={l.name} value={l.value} last={i === rows.length - 1}>
                {l.seasoning ? <span className="rounded-full bg-notice px-[7px] py-0.5 text-[10.5px] font-extrabold text-notice-ink">{t("wl3_pelan")}</span> : null}
              </Line>
            ))}
          </div>
        </div>
      </div>
      <span className={`${tag} rk-bob absolute left-[30px] top-[400px] bg-primary text-primary-foreground`}>{t("wl3_tap")}</span>
      <img src={bahan("bawang-merah")} alt="" aria-hidden className="rk-bob absolute left-3.5 top-[270px] w-[62px]" />
      <img src={bahan("cabai-rawit")} alt="" aria-hidden className="rk-bob absolute right-[18px] top-[380px] w-[74px]" style={{ animationDelay: "0.5s" }} />
    </>
  );
}

function SlideGizi({ icon }: { icon: string }) {
  const g = useMemo(() => gizi("rendang"), []);
  return (
    <>
      <div className="animate-fade-in absolute left-[65px] top-[62px] size-[260px] overflow-hidden rounded-full border-8 border-card shadow-[0_20px_44px_rgba(31,61,46,0.2)]">
        <img src={photo("rendang")} alt="" className="h-full w-full scale-125 object-cover" />
      </div>
      {g.kcal ? (
        <div className="rk-card-in absolute left-[22px] top-[66px] rounded-[18px] bg-primary px-3.5 py-2.5 text-primary-foreground shadow-[0_12px_26px_rgba(31,61,46,0.25)]" style={tilt(-6, 0.2)}>
          <p className="font-display text-2xl font-extrabold leading-none">± {g.kcal}</p>
          <p className="mt-0.5 text-xs font-bold opacity-85">{t("per_porsi")}</p>
        </div>
      ) : null}
      {g.protein ? (
        <div className="rk-card-in absolute right-[22px] top-[250px] rounded-[18px] bg-notice px-3.5 py-2.5 text-notice-ink shadow-[0_12px_26px_rgba(31,61,46,0.18)]" style={tilt(5, 0.35)}>
          <p className="font-display text-2xl font-extrabold leading-none">± {g.protein}</p>
          <p className="mt-0.5 text-xs font-bold">{t("wl4_protein_unit")}</p>
        </div>
      ) : null}
      <img src={bahan("telur")} alt="" aria-hidden className="rk-bob absolute left-[34px] top-[270px] w-[50px]" />
      <img src={bahan("serai")} alt="" aria-hidden className="rk-bob absolute right-6 top-[90px] w-[70px]" style={{ animationDelay: "0.5s" }} />
      <span className={`${tag} animate-fade-in absolute left-1/2 top-[342px] -translate-x-1/2`} style={{ animationDelay: "0.5s" }}>{t("wl4_tag")}</span>
      <img src={icon} alt="" aria-hidden className="absolute left-1/2 top-[396px] size-16 -translate-x-1/2 rounded-2xl shadow-[0_8px_20px_rgba(31,61,46,0.18)]" />
    </>
  );
}

const SLIDES = [
  { get title() { return t("wl1_title"); }, get body() { return t("wl1_body"); } },
  { get title() { return t("wl2_title"); }, get body() { return t("wl2_body"); } },
  { get title() { return t("wl3_title"); }, get body() { return t("wl3_body"); } },
  { get title() { return t("wl4_title"); }, get body() { return t("wl4_body"); } },
];

export function WelcomeSlides({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const stage = useFit(390, 470);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i] ?? SLIDES[0]!;
  const next = () => (last ? onStart() : setI(i + 1));

  return (
    <main
      className="relative mx-auto flex h-dvh w-full max-w-[430px] select-none flex-col overflow-hidden bg-ground"
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const d = touchX.current - (e.changedTouches[0]?.clientX ?? touchX.current);
        if (d > 50 && !last) setI(i + 1);
        else if (d < -50 && i > 0) setI(i - 1);
        touchX.current = null;
      }}
    >
      {/* the soft organic backdrop */}
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-[66%] w-full" viewBox="0 0 390 560" preserveAspectRatio="none" aria-hidden>
        <path d="M250 0 C330 40 410 120 390 230 C372 330 300 360 300 430 C300 500 360 540 390 560 L390 0 Z" fill="var(--color-tint)" />
        <path d="M0 120 C60 90 140 110 170 170 C200 230 150 290 70 300 C30 305 10 320 0 330 Z" fill="#F1EBDD" />
      </svg>

      <div className="relative z-10 flex shrink-0 justify-end px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={() => setI(SLIDES.length - 1)} className={`min-h-10 rounded-full bg-card/90 px-3.5 text-14 font-extrabold text-ink-2 ${last ? "invisible" : ""}`}>{t("skip")}</button>
      </div>

      <div ref={stage.ref} className="relative min-h-0 flex-1">
        <div key={i} className="absolute left-1/2 top-1/2 h-[470px] w-[390px]" style={{ transform: `translate(-50%, -50%) scale(${stage.scale})` }}>
          {i === 0 ? <SlideVideo /> : null}
          {i === 1 ? <SlideSources /> : null}
          {i === 2 ? <SlidePortions /> : null}
          {i === 3 ? <SlideGizi icon="/icons/icon-192.png" /> : null}
        </div>
      </div>

      <div key={`t${i}`} className="relative shrink-0 px-7 pt-2 text-center">
        <h1 className="animate-slide-up font-display text-[29px] font-extrabold leading-[1.08] text-primary [@media(max-height:700px)]:text-[25px]">{s.title}</h1>
        <p className="animate-slide-up-2 mx-auto mt-2.5 max-w-[330px] text-15 leading-normal text-ink-2">{s.body}</p>
      </div>

      <div className="relative shrink-0 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
        {last ? (
          <>
            <button type="button" onClick={onStart} className="min-h-14 w-full rounded-full bg-cta text-body font-extrabold text-cta-foreground shadow-glow-cta">{t("wl_start")}</button>
            <p className="mt-2.5 text-center text-14 text-ink-2">
              {t("sudah_punya_akun")}{" "}
              <button type="button" onClick={onSignIn} className="min-h-11 font-extrabold text-primary underline underline-offset-[3px]">{t("wl_masuk")}</button>
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <button type="button" onClick={onSignIn} className="min-h-11 px-1 text-14 font-extrabold text-primary underline underline-offset-4">{t("wl_masuk")}</button>
            <div className="flex gap-[7px]">
              {SLIDES.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={t("wl_slide_n", { n: k + 1 })}
                  aria-current={k === i}
                  onClick={() => setI(k)}
                  className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-[22px] bg-primary" : "w-2 bg-rule-strong"}`}
                />
              ))}
            </div>
            <button type="button" onClick={next} className="min-h-[50px] rounded-full bg-primary px-6 text-15 font-extrabold text-primary-foreground">{t("continue_")}</button>
          </div>
        )}
      </div>
    </main>
  );
}
