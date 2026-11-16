import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Heart, Shuffle, X } from "lucide-react";
import { fmtTime } from "@/lib/racik/engine";
import { REG } from "@/lib/racik/data";
import { diffLabel, t } from "@/lib/racik/i18n";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { useSnackbar } from "./Snackbar";
import { Sparks } from "./motion";

const BAHAN = import.meta.glob<string>("../../assets/brand/bahan/*.webp", { eager: true, query: "?url", import: "default" });
const bahan = (name: string): string => BAHAN[`../../assets/brand/bahan/${name}.webp`] ?? "";
const TOSS = ["cabai", "bawang-merah", "bawang-putih", "daun-jeruk", "tomat", "serai"];
const TOSS_ANGLES = [-70, -40, -12, 14, 42, 72];

/** Card position by depth in the stack: [translateY px, scale, rotate deg]. */
const STACK: [number, number, number][] = [
  [0, 1, 0],
  [14, 0.95, -3],
  [28, 0.9, 3],
];

/**
 * Masak Apa as a small deck of dishes (motion prototype, 16 Nov 2026).
 * Lewati or a swipe sends the top card away, Kocok menu reshuffles the
 * suggestions, the heart saves to Koleksi. One red button opens the recipe.
 */
export function DishDeck({ recipes, onShuffle }: { recipes: Recipe[]; onShuffle: () => void }) {
  const { state, toggleSaved } = useRacik();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const n = recipes.length;
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const [drag, setDrag] = useState(0);
  const [shake, setShake] = useState(0);
  const [heartKey, setHeartKey] = useState(0);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  // A new set of suggestions (filters, Kocok, meal) starts from the top.
  const ids = recipes.map((r) => r.id).join("|");
  useEffect(() => {
    setIdx(0);
    setLeaving(null);
  }, [ids]);

  if (n === 0) return null;
  const cur = recipes[idx % n]!;
  const saved = state.saved.includes(cur.id);

  const skip = (dir: 1 | -1 = -1) => {
    if (leaving) return;
    const i = idx % n;
    setLeaving({ i, dir });
    setDrag(0);
    timers.current.push(
      window.setTimeout(() => {
        setIdx((v) => (v + 1) % n);
        setLeaving(null);
      }, 280),
    );
  };
  const shuffle = () => {
    setShake((v) => v + 1);
    timers.current.push(window.setTimeout(onShuffle, 200));
  };
  const save = () => {
    toggleSaved(cur.id);
    if (saved) return;
    setHeartKey((v) => v + 1);
    snackbar.show({
      message: t("deck_tersimpan"),
      actionLabel: t("deck_buka_koleksi"),
      onAction: () => void navigate({ to: "/buku" }),
    });
  };

  const onDown = (e: PointerEvent) => {
    start.current = e.clientX;
    moved.current = false;
  };
  const onMove = (e: PointerEvent) => {
    if (start.current == null) return;
    const dx = e.clientX - start.current;
    if (Math.abs(dx) > 8) moved.current = true;
    setDrag(dx);
  };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (Math.abs(drag) > 90) skip(drag > 0 ? 1 : -1);
    else setDrag(0);
  };

  return (
    <div>
      <div className="relative mx-3 h-[372px]">
        <div key={shake} className={shake ? "rk-shake absolute inset-0" : "absolute inset-0"}>
          {recipes.map((r, i) => {
            const depth = (i - (idx % n) + n) % n;
            let transform: string;
            let opacity = 1;
            let z = 5 - depth;
            if (leaving?.i === i) {
              transform = `translate(${leaving.dir * 430}px, 40px) rotate(${leaving.dir * 24}deg)`;
              opacity = 0;
              z = 10;
            } else if (depth === 0 && drag) {
              transform = `translateX(${drag}px) rotate(${drag / 18}deg)`;
            } else if (depth < STACK.length) {
              const [y, s, rot] = STACK[depth]!;
              transform = `translateY(${y}px) scale(${s}) rotate(${rot}deg)`;
            } else {
              transform = "translateY(40px) scale(0.85)";
              opacity = 0;
              z = 0;
            }
            const top = depth === 0;
            const style: CSSProperties = { transform, opacity, zIndex: z };
            return (
              <article
                key={r.id}
                aria-hidden={!top}
                className={`rk-deck-card absolute inset-x-0 top-0 h-[340px] overflow-hidden rounded-[28px] bg-card shadow-raised ${top && drag ? "rk-dragging" : ""}`}
                style={{ ...style, touchAction: "pan-y" }}
                onPointerDown={top ? onDown : undefined}
                onPointerMove={top ? onMove : undefined}
                onPointerUp={top ? onUp : undefined}
                onPointerCancel={top ? onUp : undefined}
              >
                <Link
                  to="/resep/$id"
                  params={{ id: r.id }}
                  tabIndex={top ? 0 : -1}
                  draggable={false}
                  onClickCapture={(e) => {
                    if (moved.current) e.preventDefault();
                  }}
                  className="block h-full"
                >
                  <div className="relative h-[246px] bg-tint">
                    <RecipePhoto src={r.photoUrl ?? PHOTO[r.id]} alt={r.title} title={r.title} />
                    <span className="absolute top-3 left-3 rounded-full bg-ground/95 px-3 py-1.5 text-caption font-extrabold text-primary-deep">
                      {REG[r.region]?.name ?? r.region}
                    </span>
                  </div>
                  <div className="px-[18px] py-3">
                    <h3 className="line-clamp-1 text-head font-extrabold leading-snug text-ink-strong">{r.title}</h3>
                    <p className="mt-0.5 text-14 font-bold text-ink-3">
                      {fmtTime(r.time)} · {diffLabel(r.diff)}
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
        {shake ? (
          <span key={`toss-${shake}`} aria-hidden className="pointer-events-none absolute inset-0 z-20">
            {TOSS.map((name, i) => (
              <img
                key={name}
                src={bahan(name)}
                alt=""
                className="rk-toss"
                style={{ "--a": `${TOSS_ANGLES[i]}deg` } as CSSProperties}
              />
            ))}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-1 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => skip(-1)}
          aria-label={t("deck_lewati")}
          className="rk-press flex size-14 items-center justify-center rounded-full border-2 border-rule bg-card text-ink-2"
        >
          <X className="size-6" strokeWidth={2.6} />
        </button>
        <button
          type="button"
          onClick={shuffle}
          className="rk-press flex h-14 items-center gap-2.5 rounded-full bg-primary px-6 text-15 font-extrabold text-primary-foreground"
        >
          <Shuffle className="size-5" strokeWidth={2.4} />
          {t("deck_kocok")}
        </button>
        <button
          type="button"
          onClick={save}
          aria-pressed={saved}
          aria-label={saved ? t("hapus_dari_favorit_2") : t("simpan_ke_favorit")}
          className="rk-press relative flex size-14 items-center justify-center rounded-full border-2 border-rule bg-card text-cabai"
        >
          <Heart
            key={heartKey}
            className={`size-6 ${heartKey ? "rk-heart" : ""}`}
            strokeWidth={2.4}
            fill={saved ? "currentColor" : "none"}
          />
          {heartKey ? <Sparks key={`s-${heartKey}`} /> : null}
        </button>
      </div>

      <Link
        to="/resep/$id"
        params={{ id: cur.id }}
        className="rk-press mt-4 flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-cta px-5 text-17 font-extrabold text-cta-foreground shadow-glow-cta"
      >
        <span className="truncate">{t("deck_masak", { title: cur.title })}</span>
        <ArrowRight className="size-5 shrink-0" strokeWidth={2.6} />
      </Link>
      <p className="mt-2 text-center text-caption font-bold text-ink-3" aria-live="polite">
        {t("deck_posisi", { i: (idx % n) + 1, n })}
      </p>
    </div>
  );
}
