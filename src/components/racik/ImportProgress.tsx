import { useEffect, useState } from "react";
import { BrandIcon } from "./BrandIcon";
import { t, type Key } from "@/lib/racik/i18n";
import type { ImportSource } from "@/lib/racik/import-quota";
import illustration from "@/assets/brand/ilustrasi/ilustrasi-meracik.webp";

/**
 * The "Sedang meracik resepmu" screen while a recipe is being made
 * (redesigned 29 Okt 2026 from Octavia's mock, Ahead-style stacked rows).
 *
 * The server reports nothing until it is done, so the rows move on the usual
 * timing for each source: a perceived-progress story, agreed with Octavia.
 * Two rules keep it honest: no percentages, and the current row never fills
 * past 90%, so it waits instead of claiming to be finished. The sheet switches
 * to the result the moment the recipe arrives.
 */
type Plan = { first: Key; head: Key; detail: Key; steps: Key; starts: number[]; slow: boolean };

const PLANS: Record<ImportSource, Plan> = {
  link: { first: "prog_first_link", head: "prog_head_link", detail: "prog_det_link", steps: "prog_det_langkah_video", starts: [0, 8, 22, 40], slow: false },
  suara: { first: "prog_first_suara", head: "prog_head_suara", detail: "prog_det_suara", steps: "prog_det_langkah_video", starts: [0, 45, 60, 78], slow: true },
  berkas: { first: "prog_first_link", head: "prog_head_link", detail: "prog_det_suara", steps: "prog_det_langkah_video", starts: [0, 40, 58, 80], slow: true },
  teks: { first: "prog_first_teks", head: "prog_head_teks", detail: "prog_det_teks", steps: "prog_det_langkah_teks", starts: [0, 5, 14, 28], slow: false },
  foto: { first: "prog_first_foto", head: "prog_head_foto", detail: "prog_det_foto", steps: "prog_det_langkah_foto", starts: [0, 7, 17, 30], slow: false },
};

/** How long the last row takes to creep to its 90% resting point. */
const LAST_SPAN = 30;
/** Past the last start plus this, say kindly that this one takes longer. */
const LATE_AFTER = 30;

export function ImportProgress({ source }: { source: ImportSource }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, [source]);

  const plan = PLANS[source];
  const { starts } = plan;
  let current = 0;
  starts.forEach((at, i) => {
    if (seconds >= at) current = i;
  });
  const labels: Key[] = [plan.first, "prog_bahan", "prog_langkah", "prog_rapikan"];
  const heads: Key[] = [plan.head, "prog_head_bahan", "prog_head_langkah", "prog_head_rapikan"];
  const details: Key[] = [plan.detail, "prog_det_bahan", plan.steps, "prog_det_rapikan"];
  const late = seconds > starts[starts.length - 1]! + LATE_AFTER;

  const fill = (i: number) => {
    if (i < current) return 100;
    if (i > current) return 0;
    const span = i < starts.length - 1 ? starts[i + 1]! - starts[i]! : LAST_SPAN;
    return Math.max(4, Math.min(90, ((seconds - starts[i]!) / span) * 100));
  };

  return (
    <div className="pb-2">
      <img
        src={illustration}
        alt=""
        aria-hidden
        width={1106}
        height={970}
        className="mx-auto -mt-1 w-full max-w-[260px]"
      />

      <div className="mt-2 text-center" aria-live="polite">
        <p key={current} className="animate-fade-in font-display text-[calc(23px*var(--teks-h,1))] font-extrabold leading-tight text-ink-strong">
          {t(heads[current]!)}
        </p>
        <p className="mt-1 text-14 leading-snug text-ink-2">{t(late ? "prog_det_lama" : details[current]!)}</p>
      </div>

      <ol className="mt-5 space-y-3.5">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label}>
              <div className="flex items-center gap-2.5">
                {done ? (
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
                    <svg viewBox="0 0 24 24" className="size-3.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                ) : active ? (
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border-[2.5px] border-primary-strong bg-card">
                    <span className="size-2.5 animate-pulse rounded-full bg-primary" />
                  </span>
                ) : (
                  <span aria-hidden className="size-6 shrink-0 rounded-full border-2 border-rule-strong bg-card" />
                )}
                <span className={`min-w-0 flex-1 text-15 ${active ? "font-extrabold text-ink-strong" : done ? "font-bold text-ink-2" : "font-semibold text-ink-3"}`}>
                  {t(label)}
                </span>
                {done ? (
                  <span className="text-caption font-semibold text-ink-3">{t("prog_done")}</span>
                ) : active ? (
                  <span className="text-caption font-extrabold text-primary-strong">{t("prog_now")}</span>
                ) : null}
              </div>
              <div aria-hidden className="mt-1.5 ml-[34px] h-1.5 overflow-hidden rounded-full bg-primary-track">
                <div
                  className={`h-full rounded-full bg-primary transition-[width] duration-300 ease-linear ${active ? "rk-sheen" : ""}`}
                  style={{ width: `${fill(i)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-tint px-3.5 py-3">
        <BrandIcon name="timer" className="size-10" />
        <p className="min-w-0 text-14 leading-snug text-ink-2">
          <b className="block text-15 font-extrabold text-ink-strong">
            {t(plan.slow ? "prog_time_head_suara" : "prog_time_head")}
          </b>
          {source === "link" || plan.slow ? t(plan.slow ? "prog_time_body_suara" : "prog_time_body") : null}
        </p>
      </div>

      <p className="mt-4 border-t border-rule pt-4 text-center text-14 leading-relaxed text-ink-3">{t("prog_note")}</p>
    </div>
  );
}
