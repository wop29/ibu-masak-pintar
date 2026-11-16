import type { CSSProperties } from "react";

const BAHAN = import.meta.glob<string>("../../assets/brand/bahan/*.webp", { eager: true, query: "?url", import: "default" });
/** URL of a painted ingredient cutout, e.g. bahan("cabai"). Used only at celebration moments. */
export const bahan = (name: string): string => BAHAN[`../../assets/brand/bahan/${name}.webp`] ?? "";

/**
 * Small pieces of the motion layer (16 Nov 2026). The animations live in
 * styles.css (rk-*); every one is switched off by prefers-reduced-motion.
 */

const SPARK_COLOURS = ["#D64E3B", "#E6B44C", "#1F3D2E", "#7FA98A"];

/** A short ring of dots around a heart. Re-key it to play again. */
export function Sparks({ distance = 34 }: { distance?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="rk-spark"
          style={
            {
              "--a": `${i * 45}deg`,
              "--d": `-${distance}px`,
              background: SPARK_COLOURS[i % SPARK_COLOURS.length],
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** A round tick that springs in and draws its check mark. */
export function CheckDot({ on, size = 22, square = false }: { on: boolean; size?: number; square?: boolean }) {
  const r = square ? "rounded-md" : "rounded-full";
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 ${r} border-2 border-control-line ${on ? "rk-on" : ""}`}
      style={{ width: size, height: size }}
    >
      <span className={`rk-check-bg absolute -inset-[2px] ${r} bg-primary`} />
      <svg
        className="absolute inset-0 m-auto"
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="rk-check-path text-primary-foreground" stroke="var(--color-primary-foreground, #fff)" d="M3 8.5l3.2 3L13 4.8" />
      </svg>
    </span>
  );
}

/** Rolls a number or short text in from below whenever it changes. */
export function Roll({ value, className = "" }: { value: string | number; className?: string }) {
  return (
    <span className={`inline-block overflow-hidden align-bottom ${className}`}>
      <span key={String(value)} className="rk-roll">
        {value}
      </span>
    </span>
  );
}
