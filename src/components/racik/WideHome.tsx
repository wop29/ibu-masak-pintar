import { useMemo, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  Clock,
  FileText,
  Heart,
  ImagePlus,
  Link2,
  List,
  Minus,
  Plus,
  Timer,
  Video,
} from "lucide-react";
import { ImportSheet, findVideoLink, type Tab } from "./ImportDemo";
import { PHOTO, thumbOf } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { CARD_KEYS, nutritionLine } from "./NutritionBlock";
import { Button } from "@/components/ui/button";
import {
  browsePool,
  mainKey,
  MAIN_GROUPS,
  timeKey,
  TIME_BUCKETS,
  usesAny,
  type MainId,
} from "@/lib/racik/browse";
import { fmtTime } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";
import illustration from "@/assets/brand/ilustrasi/ilustrasi-meracik-lepas.webp";
import cabai from "@/assets/brand/bahan/cabai.webp";
import bawangPutih from "@/assets/brand/bahan/bawang-putih.webp";
import daunJeruk from "@/assets/brand/bahan/daun-jeruk.webp";
import protAyam from "@/assets/brand/onboarding/protein-ayam.webp";
import protIkan from "@/assets/brand/onboarding/protein-ikan.webp";
import protTelur from "@/assets/brand/onboarding/protein-telur.webp";
import protTahu from "@/assets/brand/onboarding/protein-tahu-tempe.webp";
import protDaging from "@/assets/brand/onboarding/protein-daging.webp";
import protSayur from "@/assets/brand/onboarding/protein-sayur.webp";

/** The field the top bar's "Tambah Resep" jumps to on the home. */
export const HERO_LINK_ID = "racik-hero-link";

const ART: Record<MainId, string> = {
  ayam: protAyam,
  ikan: protIkan,
  telur: protTelur,
  tahu_tempe: protTahu,
  daging: protDaging,
  sayur: protSayur,
};

const MAX_PORTIONS = 20;

type Start = { n: number; url?: string; text?: string; tab?: Tab; pick?: "video" | "foto" };

/**
 * The home on tablet and computer, built from Octavia's desktop mockup
 * (8 Nov 2026): the add-recipe panel first, then Saran untukmu, Cepat &
 * gampang and Bahan utama. The phone home is untouched; this only renders
 * from 768 px up.
 */
export function WideHome({ suggestions }: { suggestions: Recipe[] }) {
  const { state, update } = useRacik();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<Start | undefined>(undefined);
  const [link, setLink] = useState("");

  const begin = (s: Omit<Start, "n">) => {
    setStart((cur) => ({ ...s, n: (cur?.n ?? 0) + 1 }));
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = link.trim();
    if (!value) {
      document.getElementById(HERO_LINK_ID)?.focus();
      return;
    }
    const found = findVideoLink(value);
    if (found) begin({ url: found });
    // Not a link: a pasted recipe text goes to the text import.
    else if (!/^https?:\/\//i.test(value) && value.length > 40)
      begin({ tab: "keterangan", text: value });
    else begin({ url: value });
    setLink("");
  };

  // Pasting a video link starts the import straight away; the button is the backup.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const found = findVideoLink(e.clipboardData.getData("text"));
    if (!found) return;
    e.preventDefault();
    setLink("");
    begin({ url: found });
  };

  const pool = useMemo(() => browsePool(state.halalMode), [state.halalMode]);

  const timeCards = useMemo(() => {
    const used = new Set<string>();
    return TIME_BUCKETS.map((n, i) => {
      const recipes = pool.filter((r) => r.time <= n);
      const lower = i === 0 ? 0 : TIME_BUCKETS[i - 1]!;
      // A different photo on every card, from the recipes this card adds where possible.
      const cover =
        recipes.find((r) => r.time > lower && PHOTO[r.id] && !used.has(r.id)) ??
        recipes.find((r) => PHOTO[r.id] && !used.has(r.id)) ??
        recipes[0];
      if (cover) used.add(cover.id);
      return { n, count: recipes.length, cover };
    }).filter((c) => c.count > 0);
  }, [pool]);

  const mainCards = useMemo(
    () =>
      MAIN_GROUPS.map((g) => ({
        id: g.id,
        // The mockup says "Sayuran"; Cari's shelf keeps its shorter "Sayur".
        label: g.id === "sayur" ? t("sayuran") : g.label(),
        count: pool.filter((r) => usesAny(r, g.ids)).length,
      })),
    [pool],
  );

  const setHousehold = (v: number) => update({ household: Math.min(MAX_PORTIONS, Math.max(1, v)) });

  return (
    <div className="flex flex-col gap-10 pt-6">
      {/* Add-recipe panel */}
      <section
        aria-labelledby="judul-tambah"
        className="relative overflow-hidden rounded-3xl bg-hero-peach px-7 py-7 desk:grid desk:grid-cols-[minmax(0,32fr)_minmax(0,44fr)_minmax(0,24fr)] desk:items-center desk:gap-8 desk:px-9"
      >
        <div className="relative desk:self-stretch desk:pb-28">
          <p className="text-14 font-extrabold uppercase tracking-[0.06em] text-cta-hover">
            {t("tambah_resep")}
          </p>
          <h2
            id="judul-tambah"
            className="mt-1 font-display text-[2.5rem] font-extrabold leading-[1.05] text-ink-strong desk:text-[clamp(1.5rem,1.95vw,2.1rem)]"
          >
            {t("punya_resep_dari_luar")}
          </h2>
          <p className="mt-3 max-w-[32ch] text-17 leading-relaxed text-ink-2">
            {t("hero_tambah_isi")}
          </p>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 hidden h-24 w-full desk:block"
          >
            <img src={cabai} alt="" className="absolute bottom-0 left-2 h-24 w-auto -rotate-12 object-contain" />
            <img src={bawangPutih} alt="" className="absolute bottom-0 left-28 h-16 w-auto object-contain" />
            <img src={daunJeruk} alt="" className="absolute bottom-1 left-48 h-16 w-auto rotate-12 object-contain" />
          </div>
        </div>

        <div className="mt-6 desk:mt-0">
          <form onSubmit={submit} className="flex gap-3">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-rule-strong bg-card px-4 focus-within:border-primary">
              <Link2 aria-hidden className="size-5 shrink-0 text-ink-3" />
              <span className="sr-only">{t("link_video")}</span>
              <input
                id={HERO_LINK_ID}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onPaste={onPaste}
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder={t("tempel_link_di_sini_2")}
                className="min-w-0 flex-1 bg-transparent text-15 outline-none placeholder:text-ink-3"
              />
            </label>
            <Button
              type="submit"
              variant="cta"
              className="min-h-12 shrink-0 gap-2 rounded-xl px-5 text-15 font-extrabold"
            >
              <ArrowRight aria-hidden className="size-5" strokeWidth={2.4} />
              {t("import_resep")}
            </Button>
          </form>
          <p className="mt-2 text-caption text-ink-2">{t("bisa_dari_video")}</p>
          <div className="my-3 flex items-center gap-4 text-15 text-ink-2" aria-hidden>
            <span className="h-px flex-1 bg-rule-strong" />
            {t("offer2_or")}
            <span className="h-px flex-1 bg-rule-strong" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  icon: FileText,
                  title: t("opsi_teks"),
                  sub: t("opsi_teks_isi"),
                  go: () => begin({ tab: "keterangan" }),
                },
                {
                  icon: ImagePlus,
                  title: t("opsi_foto"),
                  sub: t("opsi_foto_isi"),
                  go: () => begin({ tab: "foto", pick: "foto" }),
                },
                {
                  icon: Video,
                  title: t("opsi_video"),
                  sub: t("opsi_video_isi"),
                  go: () => begin({ pick: "video" }),
                },
              ] as const
            ).map(({ icon: Icon, title, sub, go }) => (
              <button
                key={title}
                type="button"
                onClick={go}
                className="flex min-h-[104px] flex-col items-center justify-start gap-1 rounded-2xl border border-rule bg-card px-3 py-3.5 text-center transition-colors hover:bg-tint"
              >
                <Icon aria-hidden className="size-7 text-cta" strokeWidth={2} />
                <span className="mt-1 text-15 font-extrabold leading-tight text-ink-strong desk:text-14">
                  {title}
                </span>
                <span className="text-caption leading-snug text-ink-2">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        <img
          src={illustration}
          alt=""
          aria-hidden
          className="hidden w-full max-w-[300px] justify-self-center desk:block"
        />
      </section>

      {/* Saran untukmu */}
      <section aria-labelledby="judul-saran">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2
            id="judul-saran"
            className="font-display text-[1.75rem] font-extrabold leading-tight text-ink-strong"
          >
            {t("suggestions")}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-15 text-ink-2">
              {t("masak_untuk_n_orang", { n: state.household })}
            </span>
            <div className="flex items-center rounded-xl border border-rule-strong bg-card">
              <button
                type="button"
                onClick={() => setHousehold(state.household - 1)}
                disabled={state.household <= 1}
                aria-label={t("kurangi_jumlah_orang")}
                className="flex size-11 items-center justify-center text-ink-strong disabled:text-ink-3"
              >
                <Minus className="size-4" />
              </button>
              <span
                aria-live="polite"
                className="w-10 border-x border-rule text-center text-15 font-extrabold leading-[44px] tabular-nums"
              >
                {state.household}
              </span>
              <button
                type="button"
                onClick={() => setHousehold(state.household + 1)}
                disabled={state.household >= MAX_PORTIONS}
                aria-label={t("tambah_jumlah_orang")}
                className="flex size-11 items-center justify-center text-ink-strong disabled:text-ink-3"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>
        {suggestions.length ? (
          <div className="grid grid-cols-2 gap-5 min-[900px]:grid-cols-4">
            {suggestions.slice(0, 4).map((r) => (
              <SuggestionCard key={r.id} recipe={r} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-15 text-ink-3">{t("no_match")}</p>
        )}
      </section>

      {/* Cepat & gampang */}
      <section aria-labelledby="judul-cepat">
        <SectionHead id="judul-cepat" icon={Timer} title={t("shelf_cepat")} sub={t("cepat_isi")} />
        <div className="grid grid-cols-3 gap-4 desk:grid-cols-6">
          {timeCards.map(({ n, count, cover }) => (
            <Link
              key={n}
              to="/cari"
              search={{ t: timeKey(n) }}
              aria-label={t("kartu_waktu_label", { n, count })}
              className="overflow-hidden rounded-2xl border border-rule bg-card transition-colors hover:bg-tint"
            >
              <div className="relative aspect-[16/10] bg-tint">
                <RecipePhoto
                  src={cover ? (cover.photoUrl ?? thumbOf(cover.id)) : undefined}
                  alt=""
                  title={t("menit", { n })}
                />
                {/* As drawn in the mockup; the whole card opens the list. */}
                <span aria-hidden className="absolute right-2 top-2 flex gap-1.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-card/95 text-ink-strong">
                    <Heart className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-card/95 text-ink-strong">
                    <Bookmark className="size-4" strokeWidth={2.2} />
                  </span>
                </span>
              </div>
              <p className="px-3 py-2.5 text-14 text-ink-2">
                {t("menit", { n })} · {count} {t("resep")}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Bahan utama */}
      <section aria-labelledby="judul-bahan-utama">
        <SectionHead
          id="judul-bahan-utama"
          icon={List}
          title={t("shelf_bahan")}
          sub={t("bahan_utama_isi")}
        />
        <div className="grid grid-cols-3 gap-4 desk:grid-cols-6">
          {mainCards.map(({ id, label, count }) => (
            <Link
              key={id}
              to="/cari"
              search={{ t: mainKey(id) }}
              aria-label={t("kartu_bahan_label", { label, count })}
              className="flex min-h-[92px] items-center justify-between gap-2 rounded-2xl border border-rule bg-card py-2 pl-4 pr-2 transition-colors hover:bg-tint"
            >
              <span className="font-display text-[1.2rem] font-extrabold leading-tight text-ink-strong">
                {label}
              </span>
              <img
                src={ART[id]}
                alt=""
                aria-hidden
                className="size-[72px] shrink-0 rounded-xl object-cover"
              />
            </Link>
          ))}
        </div>
      </section>

      <ImportSheet open={open} onClose={() => setOpen(false)} start={start} />
    </div>
  );
}

function SectionHead({
  id,
  icon: Icon,
  title,
  sub,
}: {
  id: string;
  icon: typeof Timer;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2
          id={id}
          className="flex items-center gap-2.5 font-display text-[1.75rem] font-extrabold leading-tight text-ink-strong"
        >
          <Icon aria-hidden className="size-7 text-ink-strong" strokeWidth={2.2} />
          {title}
        </h2>
        <p className="mt-0.5 pl-[38px] text-15 text-ink-2">{sub}</p>
      </div>
      <Link
        to="/cari"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-15 font-bold text-primary-deep hover:underline"
      >
        {t("lihat_semua")}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

function SuggestionCard({ recipe }: { recipe: Recipe }) {
  const { state, toggleSaved } = useRacik();
  const saved = state.saved.includes(recipe.id);
  const gizi = nutritionLine(recipe, CARD_KEYS);
  return (
    <article className="relative overflow-hidden rounded-2xl border border-rule bg-card transition-colors hover:bg-tint">
      <Link to="/resep/$id" params={{ id: recipe.id }} className="block">
        <div className="aspect-[16/10] bg-tint">
          <RecipePhoto
            src={recipe.photoUrl ?? thumbOf(recipe.id)}
            alt={recipe.title}
            title={recipe.title}
          />
        </div>
        <div className="px-4 pb-3.5 pt-3">
          <h3 className="font-display text-[1.2rem] font-extrabold leading-tight text-ink-strong [overflow-wrap:anywhere]">
            {recipe.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-14 text-ink-2">
            <Clock aria-hidden className="size-4" strokeWidth={2.2} />
            {fmtTime(recipe.time)}
          </p>
          {gizi ? <p className="mt-0.5 text-14 text-ink-2">{gizi}</p> : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggleSaved(recipe.id)}
        aria-pressed={saved}
        aria-label={saved ? t("hapus_dari_favorit_2") : t("simpan_ke_favorit")}
        className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-card/95 text-ink-strong shadow-chip"
      >
        <Heart className={`size-5 ${saved ? "fill-cta text-cta" : ""}`} strokeWidth={2.2} />
      </button>
    </article>
  );
}
