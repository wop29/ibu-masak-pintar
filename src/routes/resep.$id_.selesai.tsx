import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { byId } from "@/lib/racik/data";
import { useRacik } from "@/lib/racik/state";
import { shrinkPhoto } from "@/lib/racik/store";
import { Button } from "@/components/ui/button";
import { PHOTO } from "@/components/racik/photos";
import { ShareSheet } from "@/components/racik/share/ShareSheet";
import { recordEvent } from "@/lib/racik/backend/share";
import { shareTargetOf } from "@/components/racik/share/target";
import { t } from "@/lib/racik/i18n";

export const Route = createFileRoute("/resep/$id_/selesai")({
  loader: ({ params }) => {
    const recipe = byId(params.id) ?? null;
    if (!recipe && !params.id.startsWith("import-")) throw notFound();
    return { recipe };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.recipe
      ? `Sudah dimasak: ${loaderData.recipe.title} — Racik`
      : "Sudah dimasak — Racik";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Simpan foto hasil masakan dan catat tingkat kesulitannya, supaya keterangan resepnya makin jujur.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Catat hasilnya sekali, lain kali resepnya sudah lebih jujur.",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Selesai,
});

const VERDICTS = [
  { id: "gampang", get label() { return t("lebih_gampang_dari_perkiraan"); } },
  { id: "pas", get label() { return t("pas_seperti_keterangannya"); } },
  { id: "susah", get label() { return t("lebih_ribet_dari_perkiraan"); } },
] as const;

function Selesai() {
  const { recipe: shipped } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { state, update, rate } = useRacik();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const recipe = shipped ?? state.imported.find((item) => item.id === id);

  // She came here through someone's share link and finished the dish: credit
  // that link once ("dimasak 12 orang"). A no-op for everyone else.
  useEffect(() => {
    if (!recipe) return;
    void recordEvent(recipe.id, "cook");
    if (state.saved.includes(recipe.id)) void recordEvent(recipe.id, "save");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16">
        <p className="read-line">{t("resep_ini_tidak_ada_di")}</p>
      </main>
    );
  }
  const photo = state.photos[recipe.id];
  const ratings = state.ratings[recipe.id] ?? [];

  const tally = VERDICTS.map((v) => ({
    ...v,
    n: ratings.filter((r) => r === v.id).length,
  }));
  const top = [...tally].sort((a, b) => b.n - a.n)[0];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pb-16 pt-10">
      <p className="text-15 font-bold text-primary">{t("sudah_dimasak")}</p>
      <h1 className="font-display text-28 mt-1 leading-[1.15]">{recipe.title}</h1>

      <h2 className="mt-6 text-head font-extrabold">{t("foto_hasil_masakanmu")}</h2>
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        className="mt-3 aspect-[4/3] h-auto w-full overflow-hidden p-0"
      >
        {photo ? (
          <img src={photo} alt={t("hasil_masakan")} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-body text-ink-3">
            <BrandIcon name="dari-foto" className="size-9" />
            
            {t("ambil_atau_pilih_foto")}
          </span>
        )}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPhotoError(null);
          try {
            // Redrawn on a canvas: the stored copy has no EXIF and no location.
            const data = await shrinkPhoto(file);
            update((s) => ({ photos: { ...s.photos, [recipe.id]: data } }));
          } catch {
            setPhotoError(t("photo_unreadable_retake"));
          }
        }}
      />
      {photoError ? (
        <p role="alert" className="mt-2 text-14 text-danger-ink">
          {photoError}
        </p>
      ) : null}

      <Button size="lg" className="mt-4 w-full" onClick={() => setSharing(true)}>
        <BrandIcon name="bagikan" className="size-6 rounded-md" /> {" "}{t("bagikan")}
      </Button>
      <p className="mt-2 text-caption text-ink-3">
        {photo
          ? t("kartunya_memakai_fotomu_lengkap_dengan")
          : t("tanpa_foto_pun_bisa_kartunya")}
      </p>
      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        target={shareTargetOf(recipe)}
        card={{
          recipe,
          kind: shareTargetOf(recipe).kind,
          myPhoto: photo ?? null,
          recipePhoto: recipe.photoUrl ?? PHOTO[recipe.id] ?? null,
          servings: state.servings[recipe.id] ?? state.household,
        }}
      />
      {state.photoFull ? (
        <p className="text-caption text-ink-3 mt-2">
          
          {t("penyimpanan_hp_sudah_penuh_jadi")}
        </p>
      ) : null}

      <h2 className="heading-sm mt-8">{t("tadi_seberapa_ribet")}</h2>
      <div className="mt-3">
        {tally.map((v) => (
          <Button
            variant="ghost"
            key={v.id}
            onClick={() => rate(recipe.id, v.id)}
            className="hairline-b h-auto w-full justify-between rounded-none px-0 py-4 text-left"
          >
            <span className="text-body">{v.label}</span>
            <span className="text-label text-ink-3 tabular-nums">{v.n > 0 ? v.n : ""}</span>
          </Button>
        ))}
      </div>

      {ratings.length >= 3 && top ? (
        <p className="text-body text-ink-2 mt-4">
          
          {t("dari_2")}{" "}{ratings.length} {" "}{t("catatan")}{" "}{top.label.toLowerCase()}.
        </p>
      ) : (
        <p className="text-caption text-ink-3 mt-4">
          
          {t("keterangan_tingkat_kesulitan_muncul_setelah")}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          to="/resep/$id"
          params={{ id: recipe.id }}
          replace
          className="text-body flex-1 rounded-md border border-rule py-4 text-center"
        >
          
          {t("lihat_resep")}
        </Link>
        <Button asChild variant="outline" className="h-auto flex-1 py-4">
          <Link to="/" replace>
            
            {t("done")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
