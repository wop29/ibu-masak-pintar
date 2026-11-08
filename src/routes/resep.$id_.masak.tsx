import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Check,
  Pause,
  Play,
  RotateCcw,
  Timer as TimerIcon,
} from "lucide-react";
import { Sheet } from "@/components/racik/Sheet";
import { byId, ING } from "@/lib/racik/data";
import { cookPlan, qtyDisplay, scaledQty, unitOf } from "@/lib/racik/engine";
import { localName, type Negara } from "@/lib/racik/locale";
import { useRacik } from "@/lib/racik/state";
import type { CookTimer } from "@/lib/racik/store";
import type { IngLine, Recipe, SatuanMode } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";

export const Route = createFileRoute("/resep/$id_/masak")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.recipe
      ? `Masak ${loaderData.recipe.title} — Racik`
      : "Mode masak — Racik";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Satu langkah dalam satu layar, huruf besar, penghitung waktu di tempat. Dibuat untuk dibaca sambil tangan berminyak.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Satu langkah dalam satu layar, dengan bahan yang perlu disiapkan dulu.",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ModeMasak,
});

/** How long a finished timer keeps ringing before it goes quiet (it stays marked on screen). */
const RING_FOR_MS = 2 * 60 * 1000;

type TimerState = "idle" | "running" | "paused" | "ringing";

function timerState(t: CookTimer | undefined, now: number): TimerState {
  if (!t) return "idle";
  if (t.endsAt != null) return t.endsAt <= now ? "ringing" : "running";
  return t.left != null ? "paused" : "idle";
}

/** Seconds left. Always from the wall clock while running, so a phone that slept cannot make it wrong. */
function secondsLeft(t: CookTimer | undefined, fallback: number, now: number): number {
  if (!t) return fallback;
  if (t.endsAt != null) return Math.max(0, Math.ceil((t.endsAt - now) / 1000));
  return t.left ?? fallback;
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A clock that only ticks while something is counting. Background tabs may tick slowly; the numbers stay right. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active]);
  return now;
}

/** Keep the screen on while cooking. Browsers drop the lock when the tab hides, so take it again on return. */
function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const take = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else void next.release().catch(() => {});
      } catch {
        // Battery saver, an iframe, or no permission: the screen may sleep. Nothing to tell her.
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void take();
    };
    void take();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, []);
}

/** A short three-note beep made on the spot, so there is no sound file to download or cache. */
function beep(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  for (let k = 0; k < 3; k++) {
    const at = t0 + k * 0.28;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = k === 2 ? 1175 : 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.24);
  }
}

/**
 * Sound and vibration while any timer is ringing. Browsers only allow audio
 * after a tap, so the audio context is opened on her first tap in cook mode
 * (starting the timer is one) and kept for the alarm.
 */
function useAlarm(ringing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctxRef.current ??= new AC();
        if (ctxRef.current.state === "suspended") void ctxRef.current.resume().catch(() => {});
      } catch {
        // No audio here; vibration and the red screen still work.
      }
    };
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      beep(ctxRef.current);
      try {
        navigator.vibrate?.([400, 160, 400, 160, 400]);
      } catch {
        // Not supported (iOS): the sound and the screen carry it.
      }
    };
    ring();
    const t = setInterval(ring, 3000);
    return () => {
      clearInterval(t);
      try {
        navigator.vibrate?.(0);
      } catch {
        // ignore
      }
    };
  }, [ringing]);
}

function StepTimer({
  seconds,
  timer,
  now,
  onChange,
}: {
  seconds: number;
  timer: CookTimer | undefined;
  now: number;
  onChange: (next: CookTimer | null) => void;
}) {
  const state = timerState(timer, now);
  const left = secondsLeft(timer, seconds, now);
  const total = timer?.total ?? seconds;
  const start = (from: number) => onChange({ total, endsAt: Date.now() + from * 1000 });
  const pct =
    state === "idle" ? 0 : Math.min(100, Math.max(0, ((total - left) / Math.max(1, total)) * 100));

  if (state === "ringing") {
    return (
      <div role="alert" className="mt-6 rounded-3xl border-2 border-time bg-time-soft p-5">
        <p className="flex items-center gap-2 text-14 font-bold text-time-ink">
          <BellRing className="size-5 animate-pulse" /> {t("waktunya_habis")}
        </p>
        <p className="mt-1 text-timer font-extrabold leading-none tabular-nums text-time-ink">
          00:00
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-time text-body font-extrabold text-primary-foreground"
          >
            <Check className="size-5" /> {t("sudah")}
          </button>
          <button
            type="button"
            onClick={() => onChange({ total: total + 60, endsAt: Date.now() + 60_000 })}
            className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border border-time bg-card text-body font-extrabold text-time-ink"
          >
            {t("n1_menit")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-6 rounded-3xl border bg-card p-5 shadow-card ${state === "running" ? "border-time" : "border-rule"}`}
    >
      <p className="flex items-center gap-1.5 text-14 font-bold text-ink-3">
        <TimerIcon className="size-3.5" />
        {state === "running"
          ? t("sedang_berjalan")
          : state === "paused"
            ? t("dijeda")
            : t("waktu_langkah_ini")}
      </p>
      <p
        className={`mt-1 text-timer font-extrabold leading-none tracking-[-0.02em] tabular-nums ${state === "running" ? "text-time" : "text-ink"}`}
      >
        {clock(left)}
      </p>
      {state !== "idle" ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-tint" aria-hidden>
          <div
            className="h-full rounded-full bg-time transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      <div className="mt-4 flex gap-3">
        {state === "running" ? (
          <button
            type="button"
            onClick={() => onChange({ total, left })}
            className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-xl border border-rule bg-card px-4 text-body font-extrabold text-ink"
          >
            <Pause className="size-5" /> {t("jeda")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => start(left > 0 ? left : seconds)}
            className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-body font-extrabold text-primary-foreground shadow-glow"
          >
            <Play className="size-5" /> {state === "paused" ? t("lanjutkan") : t("mulai_hitung")}
          </button>
        )}
        {state !== "idle" ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-rule bg-card px-4 text-body font-bold text-ink-2"
          >
            <RotateCcw className="size-4" /> {t("ulangi")}
          </button>
        ) : null}
      </div>
      {state === "running" ? (
        <p className="mt-3 text-caption text-ink-3">{t("tetap_berjalan_walau_pindah_langkah")}</p>
      ) : null}
    </div>
  );
}

/** One ingredient row with its tick. 44 px tall at least: she taps it with a wet thumb. */
function PrepRow({
  line,
  recipe,
  servings,
  satuan,
  negara,
  on,
  onToggle,
}: {
  line: IngLine;
  recipe: Recipe;
  servings: number;
  satuan: SatuanMode;
  negara: Negara;
  on: boolean;
  onToggle: () => void;
}) {
  const ing = ING[line[0]];
  if (!ing) return null;
  const unit = unitOf(line);
  const qty = scaledQty(line, recipe, servings);
  const { main, hint: rumah } = qtyDisplay(line[0], qty, unit, satuan, negara);
  const local = localName(line[0], negara);
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className="read-line flex min-h-12 w-full items-start gap-3 py-2 text-left"
      >
        <span
          aria-hidden
          className={`mt-px flex size-[26px] shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "border-2 border-control-line"}`}
        >
          {on ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
        <span
          className={`min-w-0 [overflow-wrap:anywhere] ${on ? "text-ink-3 line-through" : "text-ink"}`}
        >
          {qty == null ? (
            <span className="text-ink-3">{t("secukupnya")} </span>
          ) : (
            <span className="font-extrabold tabular-nums">{main} </span>
          )}
          {ing.name}
          {local ? <span className="text-ink-3"> · {local}</span> : null}
          {line[2] ? <span className="text-ink-3">, {line[2]}</span> : null}
          {rumah ? <span className="text-primary"> {rumah}</span> : null}
        </span>
      </button>
    </li>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-ground px-5 pb-16">
      <div className="rounded-3xl border border-rule bg-card px-5 pt-6 pb-5 shadow-raised">
        <h1 className="text-title font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
        <p className="read-line mt-2 text-ink-2">{body}</p>
        <div className="mt-5 flex flex-col gap-3">{children}</div>
      </div>
    </main>
  );
}

const primaryBtn =
  "flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-body font-extrabold text-primary-foreground shadow-glow";
const outlineBtn =
  "flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-rule bg-card px-4 text-body font-extrabold text-ink";

function ModeMasak() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, ready, logCooked, cookProgress, setCookProgress, clearCookProgress } = useRacik();
  const navigate = useNavigate();
  const router = useRouter();
  const recipe: Recipe | undefined = shipped ?? state.imported.find((item) => item.id === id);
  const [i, setI] = useState(0);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const stepCount = recipe?.steps.length ?? 0;

  useWakeLock();

  // The store loads from IndexedDB asynchronously, so on a cold start — which
  // is exactly what a phone evicting the page looks like — it is still empty
  // at first render. Restore once, after it has actually loaded, and never
  // again, so a later write cannot move her mid-step.
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current || !stepCount) return;
    restored.current = true;
    const saved = cookProgress(id)?.step;
    if (saved != null && saved > 0) {
      const at = Math.min(saved, stepCount - 1);
      setI(at);
      setResumedAt(at);
    }
  }, [ready, id, cookProgress, stepCount]);

  const progress = cookProgress(id);
  const timers = progress?.timers ?? {};
  const anyActive = Object.values(timers).some((t) => t.endsAt != null);
  const now = useNow(anyActive);
  const ringing = Object.values(timers).some(
    (t) => t.endsAt != null && t.endsAt <= now && now - t.endsAt < RING_FOR_MS,
  );
  useAlarm(ringing);

  const goto = useCallback(
    (next: number) => {
      setI(next);
      setResumedAt(null);
      setCookProgress(id, { step: next });
      window.scrollTo({ top: 0 });
    },
    [id, setCookProgress],
  );
  const setTimer = (step: number, next: CookTimer | null) => {
    const all = { ...(cookProgress(id)?.timers ?? {}) };
    if (next) all[String(step)] = next;
    else delete all[String(step)];
    setCookProgress(id, { timers: all });
  };

  // Leave to the recipe page without stacking another copy of it: cook mode is
  // only opened from there, so going back is going to it. Opened from a link
  // with no history, replace this entry instead, so Back does not return here.
  const leave = () => {
    if (router.history.canGoBack()) router.history.back();
    else navigate({ to: "/resep/$id", params: { id }, replace: true });
  };

  // Back with a timer counting asks first; the timers are wall-clock, so they keep running either way.
  const tryLeave = () => {
    const running = Object.values(cookProgress(id)?.timers ?? {}).some(
      (t) => t.endsAt != null && t.endsAt > Date.now(),
    );
    if (running) setLeaveOpen(true);
    else leave();
  };

  // Keyboard (iPad keyboard or computer): → or Space next, ← back, Esc leaves.
  // Off while a sheet is open (it has its own Esc) or a control would take the key.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (
      e.defaultPrevented ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      leaveOpen ||
      allOpen ||
      !stepCount
    )
      return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "ArrowRight" || (e.key === " " && !el?.closest("button, a"))) {
      e.preventDefault();
      if (i < stepCount - 1) goto(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (i > 0) goto(i - 1);
    } else if (e.key === "Escape") {
      tryLeave();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const plan = useMemo(() => (recipe ? cookPlan(recipe) : { perStep: [], rest: [] }), [recipe]);
  const servings = recipe ? (state.servings[recipe.id] ?? state.household) : state.household;

  if (!recipe) {
    if (!ready) {
      return <main aria-busy="true" className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground" />;
    }
    return (
      <Notice title={t("resepnya_tidak_ketemu")} body={t("resep_ini_tidak_ada_di_2")}>
        <Link to="/buku" replace className={primaryBtn}>
          {t("buka_koleksi")}
        </Link>
        <Link to="/" replace className={outlineBtn}>
          {t("ke_beranda")}
        </Link>
      </Notice>
    );
  }

  if (!stepCount) {
    return (
      <Notice title={t("belum_ada_langkahnya")} body={t("resep_ini_belum_punya_cara")}>
        <button type="button" onClick={leave} className={primaryBtn}>
          {t("lihat_bahan")}
        </button>
        <Link to="/buku" replace className={outlineBtn}>
          {t("buka_koleksi")}
        </Link>
      </Notice>
    );
  }

  const step = recipe.steps[i] ?? recipe.steps[0]!;
  const needed = plan.perStep[i] ?? [];
  const last = i === stepCount - 1;
  const extras = [...plan.rest];
  const unmatched = (recipe as Recipe & { unmatched?: string[] }).unmatched ?? [];

  const checked = progress?.checked ?? [];
  const keyOf = (line: IngLine) => `l:${recipe.ings.indexOf(line)}`;
  // Older saves ticked by ingredient id; keep honouring those ticks.
  const isOn = (line: IngLine) => checked.includes(keyOf(line)) || checked.includes(line[0]);
  const toggle = (line: IngLine) => {
    const nowChecked = cookProgress(recipe.id)?.checked ?? [];
    const key = keyOf(line);
    const on = nowChecked.includes(key) || nowChecked.includes(line[0]);
    setCookProgress(recipe.id, {
      checked: on ? nowChecked.filter((x) => x !== key && x !== line[0]) : [...nowChecked, key],
    });
  };
  const row = (line: IngLine) => (
    <PrepRow
      key={keyOf(line)}
      line={line}
      recipe={recipe}
      servings={servings}
      satuan={state.satuan}
      negara={state.negara}
      on={isOn(line)}
      onToggle={() => toggle(line)}
    />
  );

  const otherTimers = Object.entries(timers)
    .map(([k, t]) => ({ step: Number(k), t }))
    .filter(({ step: s }) => s !== i && s < stepCount)
    // A ringing timer always makes the two visible rows; then by step.
    .sort(
      (a, b) =>
        Number(timerState(b.t, now) === "ringing") - Number(timerState(a.t, now) === "ringing") ||
        a.step - b.step,
    );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground text-ink tab:max-w-[720px]">
      <header className="sticky top-0 z-20 border-b border-rule bg-ground/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={tryLeave}
            aria-label={t("keluar_dari_mode_masak")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-rule bg-card text-ink"
          >
            <ArrowLeft className="size-5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-15 font-bold text-ink-2">
              {t("step_n_of", { n: i + 1, total: stepCount })}
            </p>
            <h1 className="line-clamp-2 text-15 font-extrabold leading-tight">{recipe.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-rule bg-card px-4 text-14 font-extrabold text-primary"
          >
            <BrandIcon name="bahan" className="size-6 rounded-md" /> {t("bahan")}
          </button>
        </div>
        <div className="h-1 bg-rule" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${((i + 1) / stepCount) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex-1 px-5 pt-6 pb-8">
        {resumedAt != null ? (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-primary-soft px-4 py-2">
            <p className="text-14 text-primary-deep">
              {t("melanjutkan_dari_langkah")} {resumedAt + 1}.
            </p>
            <button
              type="button"
              onClick={() => goto(0)}
              className="-mr-2 min-h-11 shrink-0 px-2 text-14 font-extrabold text-primary"
            >
              {t("mulai_dari_awal")}
            </button>
          </div>
        ) : null}

        {i === 0 && recipe.alat?.length ? (
          <p className="mb-4 text-14 text-ink-3">
            {t("yang_dibutuhkan")} {recipe.alat.join(", ")}
            {recipe.suhu ? ` · ${recipe.suhu}` : ""}
          </p>
        ) : null}

        <p className="text-28 font-bold leading-[1.42] tracking-[-0.015em] [overflow-wrap:anywhere]">
          {step[0]}
        </p>

        {step[1] ? (
          <StepTimer
            seconds={step[1]}
            timer={timers[String(i)]}
            now={now}
            onChange={(t) => setTimer(i, t)}
          />
        ) : null}

        {needed.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-rule bg-card px-4 pt-4 pb-2 shadow-card">
            <h2 className="text-15 font-extrabold">{t("siapkan_dulu")}</h2>
            <p className="text-caption text-ink-3">{t("ketuk_kalau_sudah_siap")}</p>
            <ul className="mt-1 divide-y divide-rule">{needed.map(row)}</ul>
          </section>
        ) : null}

        {i === 0 && (extras.length > 0 || unmatched.length > 0) ? (
          <section className="mt-4 rounded-3xl border border-rule bg-card px-4 pt-4 pb-2 shadow-card">
            <h2 className="text-15 font-extrabold">{t("bahan_lain_di_resep_ini")}</h2>
            <p className="text-caption text-ink-3">{t("tidak_disebut_di_langkah_mana")}</p>
            <ul className="mt-1 divide-y divide-rule">
              {extras.map(row)}
              {unmatched.map((txt, k) => (
                <li
                  key={`u${k}`}
                  className="read-line flex min-h-12 items-start gap-3 py-2 [overflow-wrap:anywhere]"
                >
                  <span
                    aria-hidden
                    className="mt-px size-[26px] shrink-0 rounded-full border-2 border-dashed border-control-line"
                  />
                  <span>{txt}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-rule bg-card/95 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-md">
        {otherTimers.length > 0 ? (
          <div
            className="mb-3 flex flex-col gap-2"
            role="group"
            aria-label={t("penghitung_waktu_yang_berjalan")}
          >
            {(trayOpen ? otherTimers : otherTimers.slice(0, 2)).map(({ step: s, t: timer }) => {
              const st = timerState(timer, now);
              const label = recipe.steps[s]?.[0] ?? "";
              const cls =
                st === "ringing"
                  ? "border-2 border-time bg-time-soft text-time-ink"
                  : st === "running"
                    ? "border-time bg-card text-time-ink"
                    : "border-rule bg-card text-ink-2";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => goto(s)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left ${cls}`}
                >
                  {st === "ringing" ? (
                    <BellRing className="size-4 shrink-0 animate-pulse" />
                  ) : st === "paused" ? (
                    <Pause className="size-4 shrink-0" />
                  ) : (
                    <TimerIcon className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-14">
                    <strong className="font-extrabold">{t("step_n", { n: s + 1 })}</strong> ·{" "}
                    {label}
                  </span>
                  <span className="shrink-0 text-15 font-extrabold tabular-nums">
                    {st === "ringing"
                      ? t("waktunya")
                      : st === "paused"
                        ? t("dijeda_2", { v1: clock(secondsLeft(timer, 0, now)) })
                        : clock(secondsLeft(timer, 0, now))}
                  </span>
                </button>
              );
            })}
            {otherTimers.length > 2 ? (
              <button
                type="button"
                onClick={() => setTrayOpen((v) => !v)}
                aria-expanded={trayOpen}
                className="min-h-11 self-start px-1 text-14 font-bold text-primary"
              >
                {trayOpen
                  ? t("tampilkan_lebih_sedikit")
                  : t("lainnya_2", { v1: otherTimers.length - 2 })}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => goto(Math.max(0, i - 1))}
            disabled={i === 0}
            className="flex min-h-[54px] flex-1 items-center justify-center rounded-xl border border-rule bg-card text-body font-extrabold text-ink disabled:border-dashed disabled:text-ink-3"
          >
            {t("sebelumnya")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (last) {
                logCooked(recipe.id);
                clearCookProgress(recipe.id);
                // Replace, so Back from the finish screen goes to the recipe, not to the last step again.
                navigate({ to: "/resep/$id/selesai", params: { id: recipe.id }, replace: true });
              } else {
                goto(i + 1);
              }
            }}
            className="flex min-h-[54px] flex-[1.4] items-center justify-center rounded-xl bg-primary text-body font-extrabold text-primary-foreground shadow-glow"
          >
            {last ? t("done") : t("continue_")}
          </button>
        </div>
      </div>

      <Sheet
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t("timer_masih_berjalan")}
        subtitle={t("keluar_dari_mode_masak_2")}
      >
        <p className="read-line text-ink-2">{t("timer_tetap_berjalan_walau_kamu")}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={() => setLeaveOpen(false)} className={primaryBtn}>
            {t("tetap_di_sini")}
          </button>
          <button
            type="button"
            onClick={() => {
              setLeaveOpen(false);
              leave();
            }}
            className={outlineBtn}
          >
            {t("leave")}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={t("semua_bahan")}
        subtitle={t("takaran_untuk_porsi", { servings })}
      >
        <ul className="divide-y divide-rule">
          {recipe.ings.map(row)}
          {unmatched.map((txt, k) => (
            <li
              key={`su${k}`}
              className="read-line flex min-h-12 items-start gap-3 py-2 [overflow-wrap:anywhere]"
            >
              <span
                aria-hidden
                className="mt-px size-[26px] shrink-0 rounded-full border-2 border-dashed border-control-line"
              />
              <span>{txt}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  );
}
