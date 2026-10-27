import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { PHOTO, previewPhotoOf } from "@/components/racik/photos";
import { ProfileHeader } from "@/components/racik/share/ProfileHeader";
import { OpenInRacik } from "@/components/racik/share/OpenInRacik";
import { byId } from "@/lib/racik/data";
import { cardTime } from "@/components/racik/share/cardModel";
import { requestOrigin } from "@/lib/racik/origin";
import { useRacik } from "@/lib/racik/state";
import {
  publicLink,
  recordEvent,
  recordOpen,
  rememberRef,
  storageUrl,
  type PublicLink,
} from "@/lib/racik/backend/share";
import { t } from "@/lib/racik/i18n";

/**
 * racik.online/r/<code> — where a share card's link and QR land.
 *
 * The person who shared it on top (handle only, never a private name), the
 * shared recipe pinned under it, one tap to the full recipe. The visit is
 * counted from the browser, not the loader, so WhatsApp's and Instagram's
 * preview crawlers (which run no JavaScript) are never counted as opens.
 */
export const Route = createFileRoute("/r/$code")({
  loader: async ({ params }) => {
    const link = await publicLink(params.code);
    return { link, origin: requestOrigin() };
  },
  head: ({ loaderData }) => {
    const link = loaderData?.link ?? null;
    const recipe = link?.kind === "catalogue" ? byId(link.ref) : undefined;
    const title = link ? `${recipe?.title ?? link.title ?? t("resep_5")} — Racik` : "Racik";
    const by = link?.owner ? `Dimasak oleh @${link.owner.handle}. ` : "";
    const desc = link
      ? `${by}Resep rumahan dengan takaran yang ikut jumlah porsi. Buka di Racik.`
      : "Resep rumahan dengan takaran yang ikut jumlah porsi.";
    const image =
      storageUrl(link?.photo_path) ??
      (link?.kind === "catalogue" ? previewPhotoOf(link.ref, loaderData?.origin ?? "") : undefined);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "Racik" },
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
  component: SharedLink,
});

/** The device-side id a recipe from this link gets, so saves and cooks can be credited. */
function recipeKey(link: PublicLink): string | null {
  if (link.kind === "catalogue") return link.ref;
  if (link.kind === "user") return `import-u-${link.ref}`;
  return null;
}

function SharedLink() {
  const { link } = Route.useLoaderData();
  const { code } = Route.useParams();
  const { state, toggleSaved } = useRacik();

  useEffect(() => {
    if (!link) return;
    void recordOpen(link.code);
    const key = recipeKey(link);
    if (key) rememberRef(key, link.code);
  }, [link]);

  if (!link) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16 pb-16">
        <p className="text-15 font-bold text-primary">{t("racik")}</p>
        <h1 className="mt-2 text-28 font-extrabold leading-tight">{t("tautan_ini_belum_bisa_dibuka")}</h1>
        <p className="mt-3 read-line text-ink-2">
          
          {t("mungkin_tautannya_salah_ketik_sudah")}{" "}{code}
        </p>
        <OpenInRacik />
      </main>
    );
  }

  const catalogue = link.kind === "catalogue" ? byId(link.ref) : undefined;
  const title = catalogue?.title ?? link.title ?? t("resep_5");
  const photo = storageUrl(link.photo_path) ?? (catalogue ? PHOTO[catalogue.id] : undefined);
  const serv = catalogue?.serv ?? link.serv;
  const time = catalogue?.time ?? link.time_min;
  const steps = catalogue?.steps.length ?? link.steps;
  const saved = catalogue ? state.saved.includes(catalogue.id) : false;
  const credit = link.source_creator
    ? t("card_recipe_by", { who: link.source_creator.startsWith("@") ? link.source_creator : `@${link.source_creator}` })
    : link.kind === "user" && link.author_handle
      ? t("recipe_by_handle", { handle: link.author_handle })
      : link.kind === "catalogue"
        ? t("resep_racik")
        : null;
  const cookedBy =
    link.owner && (link.kind !== "user" || link.author_handle !== link.owner.handle)
      ? t("cooked_by_handle", { handle: link.owner.handle })
      : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground pb-16">
      {link.owner ? (
        <ProfileHeader
          handle={link.owner.handle}
          publicName={link.owner.public_name}
          photo={storageUrl(link.owner.photo_path)}
          count={link.owner.recipes.length}
        />
      ) : (
        <header className="px-5 pt-[calc(2.5rem+env(safe-area-inset-top))]">
          <p className="text-15 font-bold text-primary">{t("racik")}</p>
        </header>
      )}

      <section aria-label={t("resep_yang_dibagikan")} className="px-5">
        <p className="meta-label mt-2">{t("dibagikan")}</p>
        <article className="mt-3 overflow-hidden rounded-3xl border border-rule bg-card shadow-raised">
          <div className="relative aspect-[4/3] bg-primary-track">
            <RecipePhoto
              src={photo}
              glyph={catalogue?.glyph ?? "\u{1F372}"}
              alt={title}
              glyphClass="text-[64px]"
            />
          </div>
          <div className="px-5 pt-5 pb-5">
            {credit ? <p className="text-14 font-bold text-primary">{credit}</p> : null}
            <h1 className="mt-1 text-28 font-extrabold leading-[1.15] tracking-[-0.02em]">
              {title}
            </h1>
            {cookedBy ? <p className="mt-1 text-14 text-ink-2">{cookedBy}</p> : null}
            {serv || time || steps ? (
              <div className="mt-4 grid grid-cols-3 rounded-2xl bg-primary-soft py-3 text-center">
                {[
                  serv ? [String(serv), t("portions")] : null,
                  time ? [cardTime(time), t("stat_cook_time")] : null,
                  steps ? [String(steps), t("stat_steps")] : null,
                ]
                  .filter((x): x is string[] => x !== null)
                  .map(([v, l], i) => (
                    <div key={l} className={i > 0 ? "border-l border-primary-line" : ""}>
                      <p className="text-lg font-extrabold text-primary-deep">{v}</p>
                      <p className="text-micro text-ink-3">{l}</p>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-2">
              {catalogue ? (
                <>
                  <Button asChild size="lg" className="w-full">
                    <Link to="/resep/$id" params={{ id: catalogue.id }}>
                      
                      {t("lihat_resep_lengkap")}{" "}<ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => {
                      if (!saved) void recordEvent(catalogue.id, "save");
                      toggleSaved(catalogue.id);
                    }}
                  >
                    <BrandIcon name={saved ? "disukai" : "favorit"} className="size-6 rounded-md" />
                    {saved ? t("tersimpan_di_koleksi") : t("simpan_ke_koleksi")}
                  </Button>
                </>
              ) : link.kind === "user" && link.recipe_live ? (
                <Button asChild size="lg" className="w-full">
                  <Link to="/tulisan/$id" params={{ id: link.ref }}>
                    
                    {t("lihat_resep_lengkap")}{" "}<ArrowRight />
                  </Link>
                </Button>
              ) : link.kind === "user" ? (
                <p className="text-14 text-ink-3">{t("resep_ini_sudah_tidak_diterbitkan")}</p>
              ) : link.source_url ? (
                <>
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <a href={link.source_url} target="_blank" rel="noopener noreferrer nofollow">
                      
                      {t("tonton_video_aslinya")}{" "}<ExternalLink />
                    </a>
                  </Button>
                  <p className="text-caption text-ink-3">
                    
                    {t("resep_ini_disusun_dari_video")}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </article>
      </section>

      {link.owner && link.owner.recipes.length ? (
        <section className="mt-8 px-5">
          <h2 className="text-head font-extrabold">{t("resep_lain_dari")}{link.owner.handle}</h2>
          <ul className="mt-2">
            {link.owner.recipes
              .filter((r) => !(link.kind === "user" && r.id === link.ref))
              .map((r) => (
                <li key={r.id}>
                  <Link
                    to="/tulisan/$id"
                    params={{ id: r.id }}
                    className="flex min-h-14 items-center gap-3 border-b border-rule py-3"
                  >
                    <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-primary-track">
                      <RecipePhoto
                        src={storageUrl(r.photo_path) ?? undefined}
                        glyph={"\u{1F372}"}
                        alt=""
                        title={r.title}
                      />
                    </span>
                    <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                    <ArrowRight aria-hidden className="size-4 text-ink-3" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <OpenInRacik />
    </main>
  );
}
