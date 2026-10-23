import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Flag, Share2, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IngredientList } from "@/components/racik/IngredientList";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { OpenInRacik } from "@/components/racik/share/OpenInRacik";
import { ShareSheet } from "@/components/racik/share/ShareSheet";
import { Sheet } from "@/components/racik/Sheet";
import { fmtSeconds, fmtTime } from "@/lib/racik/engine";
import { publicRecipe, report } from "@/lib/racik/backend/recipes";
import { PUBLIC_ORIGIN, recordEvent } from "@/lib/racik/backend/share";
import type { UserRecipe } from "@/lib/racik/backend/types";
import { useRacik } from "@/lib/racik/state";
import type { ImportedRecipe } from "@/lib/racik/types";

/**
 * A recipe someone wrote and published, readable by anyone with the link.
 *
 * Deliberately different from a catalogue recipe page: no halal chip (nobody
 * verified it), no protein estimate when lines are unresolved, and the
 * author's handle, never a private name.
 */
export const Route = createFileRoute("/tulisan/$id")({
  loader: async ({ params }) => ({ recipe: await publicRecipe(params.id) }),
  head: ({ loaderData }) => {
    const r = loaderData?.recipe;
    const title = r ? `${r.title} — Racik` : "Resep — Racik";
    const by = r?.authorHandle ? `Resep @${r.authorHandle}. ` : "";
    const desc = r
      ? `${by}${r.serv} porsi, takarannya ikut jumlah porsi.`
      : "Resep rumahan di Racik.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: r?.photoUrl ? "summary_large_image" : "summary" },
        ...(r?.photoUrl ? [{ property: "og:image", content: r.photoUrl }] : []),
      ],
    };
  },
  component: Tulisan,
});

/** The id a saved copy gets on the device: cook mode and Koleksi already understand "import-" ids. */
const localIdOf = (id: string) => `import-u-${id}`;

function toLocal(r: UserRecipe): ImportedRecipe {
  return {
    id: localIdOf(r.id),
    title: r.title,
    region: "impor",
    slots: ["lauk"],
    serv: r.serv,
    time: r.time || 30,
    diff: "sedang",
    spice: 0,
    glyph: r.glyph,
    photoUrl: r.photoUrl,
    note: [r.note, r.sourceCreator ? `Diadaptasi dari ${r.sourceCreator}.` : ""]
      .filter(Boolean)
      .join(" "),
    ings: r.ings,
    steps: r.steps,
    precise: false,
    imported: true,
    ...(r.authorHandle ? { creator: `@${r.authorHandle}` } : {}),
    sourceUrl: `${PUBLIC_ORIGIN}/tulisan/${r.id}`,
    importedAt: Date.now(),
    unmatched: r.unmatched,
    servAssumed: false,
  };
}

const REASONS = [
  "Bukan resep",
  "Isinya menyinggung atau kasar",
  "Menyalin resep orang lain",
  "Lainnya",
];

function Tulisan() {
  const { recipe } = Route.useLoaderData();
  const { state, update } = useRacik();
  const navigate = useNavigate();
  const [servings, setServings] = useState(recipe?.serv ?? 2);
  const [sharing, setSharing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  if (!recipe) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16 pb-16">
        <p className="eyebrow">RACIK</p>
        <h1 className="mt-2 text-28 font-extrabold leading-tight">Resep ini belum bisa dibuka</h1>
        <p className="mt-3 read-line text-ink-2">
          Mungkin penulisnya sudah menariknya, atau kamu sedang offline.
        </p>
        <OpenInRacik />
      </main>
    );
  }

  const localId = localIdOf(recipe.id);
  const saved = state.imported.some((r) => r.id === localId);
  const cook = () => {
    if (!saved) {
      update((s) => ({
        imported: [toLocal(recipe), ...s.imported.filter((r) => r.id !== localId)],
      }));
      void recordEvent(localId, "save");
    }
    navigate({ to: "/resep/$id", params: { id: localId } });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground pb-16">
      <div className="relative h-[260px] bg-primary-track">
        <RecipePhoto
          src={recipe.photoUrl ?? undefined}
          glyph={recipe.glyph}
          alt={recipe.title}
          glyphClass="text-[64px]"
        />
        <Link
          to="/"
          aria-label="Kembali"
          className="absolute top-[calc(3rem+env(safe-area-inset-top))] left-5 flex size-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-float"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="relative -mt-[22px] px-5">
        <div className="rounded-3xl border border-rule bg-card px-5 pt-6 pb-5 shadow-raised">
          {recipe.authorHandle ? (
            <Link
              to="/u/$handle"
              params={{ handle: recipe.authorHandle }}
              className="text-14 font-bold text-primary"
            >
              Resep @{recipe.authorHandle}
            </Link>
          ) : (
            <p className="text-14 font-bold text-primary">Resep tulisan pengguna Racik</p>
          )}
          <h1 className="mt-1 text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em]">
            {recipe.title}
          </h1>
          {recipe.sourceCreator ? (
            <p className="mt-1 text-14 text-ink-2">
              Diadaptasi dari{" "}
              {recipe.sourceUrl ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-bold underline"
                >
                  {recipe.sourceCreator}
                </a>
              ) : (
                recipe.sourceCreator
              )}
            </p>
          ) : null}
          <p className="mt-2 text-14 text-ink-3">
            {[recipe.time ? fmtTime(recipe.time) : null, `${recipe.steps.length} langkah`]
              .filter(Boolean)
              .join(" · ")}
            {recipe.cookedCount > 0 ? ` · dimasak ${recipe.cookedCount} orang lewat Racik` : ""}
          </p>
          {recipe.note ? <p className="mt-3 read-line text-ink-2">{recipe.note}</p> : null}
          <p className="mt-3 text-caption text-ink-3">
            Resep tulisan pengguna tidak diberi label halal. Periksa sendiri bahan-bahannya.
          </p>

          <div className="mt-5 grid gap-2">
            <Button size="lg" className="w-full" onClick={cook}>
              <ChefHat /> {saved ? "Buka di Koleksi" : "Simpan & masak"}
            </Button>
            <Button variant="outline" className="min-h-11 w-full" onClick={() => setSharing(true)}>
              <Share2 /> Bagikan resep
            </Button>
          </div>
        </div>
      </div>

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-head font-extrabold">Bahan</h2>
          <PortionStepper value={servings} onChange={setServings} />
        </div>
        <IngredientList recipe={recipe} servings={servings} satuan={state.satuan} negara={state.negara} />
        {recipe.unmatched.length ? (
          <div className="mt-3 rounded-2xl border border-rule bg-card p-4">
            <p className="text-caption text-ink-3">
              Racik belum kenal bahan berikut, jadi takarannya ditulis apa adanya dan tidak ikut
              berubah dengan porsi:
            </p>
            <ul className="mt-2 list-disc pl-5 text-body">
              {recipe.unmatched.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8 px-5">
        <h2 className="text-head font-extrabold">Cara memasak</h2>
        <ol className="mt-3">
          {recipe.steps.map(([text, secs], i) => (
            <li key={i} className="flex gap-3 border-b border-rule py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-14 font-extrabold text-primary-deep">
                {i + 1}
              </span>
              <span className="read-line">
                {text}
                {secs ? (
                  <span className="ml-1 text-14 font-bold text-primary">({fmtSeconds(secs)})</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 px-5">
        <Button variant="ghost" className="min-h-11 text-ink-3" onClick={() => setReporting(true)}>
          <Flag /> Laporkan resep ini
        </Button>
      </div>

      <OpenInRacik />

      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        target={{
          kind: "user",
          ref: recipe.id,
          title: recipe.title,
          sourceCreator: recipe.sourceCreator,
          sourceUrl: recipe.sourceUrl,
        }}
        card={{
          recipe,
          kind: "user",
          authorHandle: recipe.authorHandle,
          myPhoto: state.photos[localId] ?? null,
          recipePhoto: recipe.photoUrl,
          servings,
        }}
      />

      <Sheet
        open={reporting}
        onClose={() => setReporting(false)}
        title="Laporkan resep"
        subtitle="Moderator Racik akan memeriksanya."
      >
        {reportMsg ? (
          <p role="status" className="read-line">
            {reportMsg}
          </p>
        ) : (
          <ul>
            {REASONS.map((reason) => (
              <li key={reason}>
                <button
                  type="button"
                  className="min-h-12 w-full border-b border-rule py-3 text-left text-body"
                  onClick={async () => {
                    const err = await report({ recipeId: recipe.id, reason });
                    setReportMsg(err ?? "Terima kasih. Laporanmu sudah kami terima.");
                  }}
                >
                  {reason}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </main>
  );
}
