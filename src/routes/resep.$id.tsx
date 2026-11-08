import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HalalChip } from "@/components/racik/HalalChip";
import { IncompleteBadge } from "@/components/racik/IncompleteBadge";
import { IngredientList } from "@/components/racik/IngredientList";
import { PHOTO, previewPhotoOf } from "@/components/racik/photos";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { useSnackbar } from "@/components/racik/Snackbar";
import { BrandIcon } from "@/components/racik/BrandIcon";
import { NutritionBlock } from "@/components/racik/NutritionBlock";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Minus, Play, Plus } from "lucide-react";
import { OpenOnPhone } from "@/components/racik/OpenOnPhone";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { useDesktopPointer } from "@/lib/racik/breakpoints";
import { byId, findRecipe, REG } from "@/lib/racik/data";
import { planIsFull } from "@/lib/racik/plan";
import { PLAN_MAX } from "@/lib/racik/store";
import { requestOrigin } from "@/lib/racik/origin";
import { fmtSeconds, fmtTime } from "@/lib/racik/engine";
import { useRacik, useRequireAccountForSave } from "@/lib/racik/state";
import { diffLabel, t } from "@/lib/racik/i18n";

export const Route = createFileRoute("/resep/$id")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    // Imported recipes live on the device, so they resolve in the component.
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe, origin: requestOrigin() };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.recipe;
    const title = r ? `${r.title} — Racik` : "Resep — Racik";
    const desc = r ? r.note : "Resep rumahan dengan takaran yang ikut jumlah porsi.";
    const image = r ? previewPhotoOf(r.id, loaderData?.origin ?? "") : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: DetailResep,
});

/** A TikTok, Instagram or YouTube link: the recipe came from a video. */
function isVideoLink(url: string): boolean {
  try {
    return /(^|\.)(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Hostname of a saved source link; a corrupt value must not take the page down. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return t("source_original");
  }
}

const MAX_PORTIONS = 20;

function DetailResep() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, ready, update, setServings, toggleSaved, promptSaveSignIn } = useRacik();
  const { account } = useAccount();
  const desktop = useDesktopPointer();
  // Signed out: the first heart (and every few after) offers to keep favourites in an account.
  const askAccount = useRequireAccountForSave();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const imported = state.imported.find((item) => item.id === id);
  const recipe = shipped ?? imported;
  if (!recipe && !ready) {
    // Imported recipes live in IndexedDB: wait for it before saying "not here".
    return (
      <main aria-busy="true" className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground">
        <div className="h-[292px] animate-pulse bg-primary-track" />
      </main>
    );
  }
  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16">
        <p className="read-line">{t("resep_ini_tidak_ada_di")}</p>
        <Button asChild className="mt-5 min-h-12 w-full">
          <Link to="/buku">{t("buka_koleksi")}</Link>
        </Button>
      </main>
    );
  }
  const servings = state.servings[recipe.id] ?? state.household;
  const photo = recipe.photoUrl ?? PHOTO[recipe.id];
  const saved = state.saved.includes(recipe.id);
  const planned = state.plan.some((p) => p.id === recipe.id);
  // Counts only plan entries that still open a recipe, so a deleted import does not keep a slot.
  const planFull = planIsFull(state);
  const creator = imported?.creator ?? recipe.creator;
  const step = (v: number) => setServings(recipe.id, Math.min(MAX_PORTIONS, Math.max(1, v)));
  const toggleHeart = () => {
    if (saved) {
      // Remember where it sat in Favorit so Urungkan puts it back in the same place.
      const at = state.saved.indexOf(recipe.id);
      toggleSaved(recipe.id);
      snackbar.show({
        message: t("dihapus_dari_favorit"),
        actionLabel: t("urungkan"),
        onAction: () =>
          update((s) => {
            if (s.saved.includes(recipe.id)) return {};
            const next = [...s.saved];
            next.splice(Math.min(Math.max(at, 0), next.length), 0, recipe.id);
            return { saved: next };
          }),
      });
      return;
    }
    toggleSaved(recipe.id);
    // Computer: every Simpan while signed out shows the short sign-in pitch.
    if (desktop) promptSaveSignIn("save", { force: true });
    else askAccount("save");
  };
  // "Tonton" on the floating bar: only for recipes that came from a video.
  const videoUrl =
    imported?.sourceUrl && isVideoLink(imported.sourceUrl) ? imported.sourceUrl : null;
  const addToPlan = () => {
    update((s) => ({
      plan: [...s.plan.filter((p) => findRecipe(p.id, s.imported)), { id: recipe.id, servings }],
    }));
    snackbar.show({
      message: t("ditambahkan_ke_rencana"),
      actionLabel: t("pilih_hari"),
      onAction: () => void navigate({ to: "/rencana", search: { hari: recipe.id } as never }),
    });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground pb-[calc(7rem+env(safe-area-inset-bottom))] tab:max-w-[1180px] tab:px-6 tab:pt-6 desk:max-w-[1280px] desk:px-8">
      <div className="relative h-[292px] bg-primary-track tab:h-[360px] tab:overflow-hidden tab:rounded-3xl desk:h-[420px]">
        <RecipePhoto src={photo} glyph={recipe.glyph} alt={recipe.title} glyphClass="text-[64px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),transparent_40%,rgba(0,0,0,0.12))]" />
        <Link
          to="/"
          aria-label={t("back")}
          onClick={(e) => {
            if (window.history.length > 1) {
              e.preventDefault();
              window.history.back();
            }
          }}
          className="absolute top-[calc(3rem+env(safe-area-inset-top))] left-5 flex size-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-float tab:top-5"
        >
          <ArrowLeft className="size-5" strokeWidth={2.4} />
        </Link>
        <button
          type="button"
          onClick={toggleHeart}
          aria-pressed={saved}
          aria-label={saved ? t("hapus_dari_favorit_2") : t("simpan_ke_favorit")}
          className="absolute top-[calc(3rem+env(safe-area-inset-top))] right-5 size-11 overflow-hidden rounded-2xl shadow-float tab:top-5"
        >
          <BrandIcon name={saved ? "disukai" : "favorit"} className="size-11 rounded-2xl" />
        </button>
      </div>

      <div className="relative -mt-[22px] px-5 tab:px-8 desk:px-10">
        <div className="rounded-3xl border border-rule bg-card px-5 pt-6 pb-5 shadow-raised">
          {/* Tablet and computer: the "Buka di HP" QR sits in the card's corner. */}
          <div className="tab:flex tab:items-start tab:gap-6">
            <div className="tab:min-w-0 tab:flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2.5 py-[5px] text-caption font-bold text-primary-deep">
                  {REG[recipe.region]?.name ?? recipe.region}
                </span>
                <HalalChip recipe={recipe} />
                {recipe.leftover ? (
                  <span className="rounded-full bg-tint px-2.5 py-[5px] text-caption font-bold text-ink-2">
                    {t("sisa_bisa_dipakai")}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-hero font-extrabold leading-[1.08] tracking-[-0.04em] [overflow-wrap:anywhere]">
                {recipe.title}
              </h1>

              {imported?.sourceUrl ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary-line bg-primary-wash px-3 py-[11px]">
                  <div className="min-w-0">
                    <p className="meta-label">{t("dari_luar")}</p>
                    <p className="mt-0.5 truncate text-caption font-extrabold text-primary-deep">
                      {creator ?? hostOf(imported.sourceUrl)}
                    </p>
                  </div>
                  <a
                    href={imported.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-label font-extrabold text-primary-foreground"
                  >
                    {t("buka_sumber")} <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ) : null}

              {recipe.incomplete ? (
                <div className="mt-3 rounded-xl bg-notice p-3 text-notice-ink">
                  <IncompleteBadge recipe={recipe} />
                  <p className="mt-2 text-caption leading-normal">
                    {t("takaran_bumbunya_cuma_ditulis_di")}
                  </p>
                </div>
              ) : null}

              <p className="mt-3 text-15 leading-[1.65] text-ink-2 [overflow-wrap:anywhere]">
                {recipe.note}
              </p>
              {imported?.servAssumed ? (
                <p className="mt-2 text-label text-ink-3">
                  {imported.servEstimated ? (
                    t("porsi_diperkirakan_dari_bahan", { n: imported.serv })
                  ) : (
                    <>
                      {t("jumlah_porsi_tidak_disebut_di")} {imported.serv}{" "}
                      {t("porsi_sebagai_dasar_hitungan")}
                    </>
                  )}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 border-t border-rule pt-[18px]">
                <div className="flex items-center gap-2.5">
                  <BrandIcon name="timer" className="size-9" />
                  <div>
                    <p className="text-15 font-extrabold">{fmtTime(recipe.time)}</p>
                    <p className="meta-label mt-0.5">{t("waktu")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 border-l border-rule pl-3.5">
                  <BrandIcon name="tingkat" className="size-9" />
                  <div>
                    <p className="text-15 font-extrabold">{diffLabel(recipe.diff)}</p>
                    <p className="meta-label mt-0.5">{t("tingkat")}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={recipe.incomplete || planned || planFull}
                onClick={addToPlan}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rule text-14 font-bold text-primary disabled:text-ink-3"
              >
                <BrandIcon name="tambah-rencana" className="size-6 rounded-md" />
                {recipe.incomplete
                  ? t("belum_bisa_masuk_rencana")
                  : planned
                    ? t("sudah_ada_di_rencana")
                    : planFull
                      ? t("rencana_sudah_penuh_resep", { plan_max: PLAN_MAX })
                      : t("tambah_ke_rencana")}
              </button>
            </div>
            {shipped ? (
              <div className="hidden shrink-0 tab:block">
                <OpenOnPhone recipeId={recipe.id} savedInAccount={Boolean(account) && saved} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="desk:hidden">
          <JumpBar ings={recipe.ings.length} steps={recipe.steps.length} />
        </div>

        {/* Desktop: ingredients (sticky) left, steps right. Phone and iPad: one column. */}
        <div className="desk:grid desk:grid-cols-[minmax(0,460px)_minmax(0,1fr)] desk:items-start desk:gap-12 desk:pt-6">
          <div className="desk:sticky desk:top-20 desk:max-h-[calc(100dvh-6rem)] desk:overflow-y-auto desk:pr-2">
            <section
              id="bahan"
              aria-labelledby="judul-bahan"
              className="scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] pt-5 pb-2"
            >
              <div className="flex items-center gap-2.5">
                <BrandIcon name="bahan" className="size-8" />
                <h2 id="judul-bahan" className="heading-sm">
                  {t("bahan")}
                </h2>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4">
                <p className="flex items-center gap-2 text-15 tabular-nums">
                  <BrandIcon name="porsi-orang" className="size-7" />
                  {t("untuk")} <b className="font-extrabold">{servings}</b> {t("portions")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => step(servings - 1)}
                    disabled={servings <= 1}
                    aria-label={t("kurangi_porsi")}
                    className="flex size-11 items-center justify-center rounded-xl border border-rule bg-card text-primary disabled:border-dashed disabled:text-ink-3"
                  >
                    <Minus className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(servings + 1)}
                    disabled={servings >= MAX_PORTIONS}
                    aria-label={t("tambah_porsi")}
                    className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:bg-tint disabled:text-ink-3"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              </div>
              {servings !== recipe.serv ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-1 text-caption text-ink-3">
                  {t("resep_asli")} {recipe.serv} {t("porsi")}
                  <button
                    type="button"
                    onClick={() => step(recipe.serv)}
                    className="-my-2 min-h-11 px-1 font-bold text-primary underline underline-offset-2"
                  >
                    {t("kembalikan")}
                  </button>
                </p>
              ) : null}
              {recipe.precise ? null : (
                <p className="mt-2 text-caption leading-normal text-ink-3">
                  {t("bumbu_tidak_dikali_lurus_porsi")}
                </p>
              )}
              <IngredientList
                recipe={recipe}
                servings={servings}
                satuan={state.satuan}
                negara={state.negara}
              />
              {recipe.alat?.length ? (
                <p className="py-4 text-caption text-ink-3">
                  {t("alat")} {recipe.alat.join(", ")}
                  {recipe.suhu ? ` · ${recipe.suhu}` : ""}
                </p>
              ) : null}
              {recipe.timbang ? (
                <p className="pb-4 text-caption text-ink-3">
                  {t("resep_ini_perlu_timbangan_takaran")}
                </p>
              ) : null}
            </section>

            <section id="gizi" aria-label={t("perkiraan_gizi")} className="pt-3 pb-2">
              <NutritionBlock recipe={recipe} servings={servings} />
            </section>
          </div>

          <section
            id="langkah"
            aria-labelledby="judul-langkah"
            className="scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] pt-6 pb-7"
          >
            <div className="flex items-center gap-2.5">
              <BrandIcon name="langkah" className="size-8" />
              <h2 id="judul-langkah" className="heading-sm">
                {t("langkah")}
              </h2>
            </div>
            <ol className="pt-1">
              {recipe.steps.map(([text, seconds], i) => (
                <li key={i} className="flex items-start gap-4 border-b border-rule py-[18px]">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-14 font-extrabold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-lg leading-[1.6] [overflow-wrap:anywhere]">{text}</p>
                    {seconds ? (
                      <p className="mt-2 text-caption font-extrabold text-primary">
                        {fmtSeconds(seconds)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-rule bg-white/95 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-md tab:bottom-4 tab:max-w-[720px] tab:rounded-2xl tab:border tab:pb-3 tab:shadow-raised">
        {/* Tablet and computer: porsi, Simpan and Tonton join Mulai masak. The phone keeps one button. */}
        <div className="tab:flex tab:items-center tab:gap-3">
          <div
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-tint p-1 tab:flex"
            role="group"
            aria-label={t("porsi_2", { servings })}
          >
            <button
              type="button"
              onClick={() => step(servings - 1)}
              disabled={servings <= 1}
              aria-label={t("kurangi_porsi")}
              className="flex size-11 items-center justify-center rounded-lg bg-card text-primary disabled:text-ink-3"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-6 text-center text-15 font-extrabold tabular-nums">
              {servings}
            </span>
            <button
              type="button"
              onClick={() => step(servings + 1)}
              disabled={servings >= MAX_PORTIONS}
              aria-label={t("tambah_porsi")}
              className="flex size-11 items-center justify-center rounded-lg bg-card text-primary disabled:text-ink-3"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleHeart}
            aria-pressed={saved}
            className="hidden min-h-[54px] shrink-0 items-center gap-2 rounded-xl border border-rule bg-card px-4 text-14 font-extrabold text-ink-strong tab:flex"
          >
            <BrandIcon name={saved ? "disukai" : "favorit"} className="size-7 rounded-lg" />
            {saved ? t("tersimpan") : t("simpan")}
          </button>
          {videoUrl ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t("tonton_video_asli")}
              className="hidden min-h-[54px] shrink-0 items-center gap-2 rounded-xl border border-rule bg-card px-4 text-14 font-extrabold text-ink-strong tab:flex"
            >
              <Play className="size-4" aria-hidden />
              {t("tonton")}
            </a>
          ) : null}
          <Button
            asChild
            variant="cta"
            className="min-h-[54px] w-full rounded-xl text-body font-extrabold tab:w-auto tab:flex-1"
          >
            <Link to="/resep/$id/masak" params={{ id: recipe.id }}>
              {t("mulai_masak")} {servings} {t("portions")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

/**
 * Sticks under the top of the screen and jumps to Bahan or Langkah. Not tabs:
 * both sections are always on the page. The section in view is highlighted.
 */
function JumpBar({ ings, steps }: { ings: number; steps: number }) {
  const [active, setActive] = useState<"bahan" | "langkah">("bahan");
  useEffect(() => {
    const onScroll = () => {
      const langkah = document.getElementById("langkah");
      if (!langkah) return;
      // "Langkah" counts as in view once its heading passes the upper third.
      setActive(langkah.getBoundingClientRect().top < window.innerHeight / 3 ? "langkah" : "bahan");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const go = (id: "bahan" | "langkah") => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const item = (id: "bahan" | "langkah", label: string) => (
    <button
      type="button"
      onClick={() => go(id)}
      aria-current={active === id ? "true" : undefined}
      className={`min-h-11 flex-1 rounded-xl text-14 font-extrabold ${active === id ? "bg-primary-soft text-primary-deep" : "text-ink-2"}`}
    >
      {label}
    </button>
  );
  return (
    <nav
      aria-label={t("lompat_ke_bagian")}
      className="sticky top-0 z-20 -mx-5 mt-4 border-b border-rule bg-ground/95 px-5 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-md"
    >
      <div className="flex gap-2">
        {item("bahan", t("jump_bahan", { ings }))}
        {item("langkah", t("jump_langkah", { steps }))}
      </div>
    </nav>
  );
}
