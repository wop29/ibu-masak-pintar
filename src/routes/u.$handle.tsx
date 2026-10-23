import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { OpenInRacik } from "@/components/racik/share/OpenInRacik";
import { ProfileHeader } from "@/components/racik/share/ProfileHeader";
import { profileByHandle, storageUrl } from "@/lib/racik/backend/share";
import { fmtTime } from "@/lib/racik/engine";

/**
 * A public profile: only people who chose a handle have one, and it lists
 * only what they published. There is no follower count and no feed.
 */
export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params }) => ({ profile: await profileByHandle(params.handle) }),
  head: ({ loaderData, params }) => {
    const p = loaderData?.profile;
    const title = p ? `@${p.handle} — Racik` : `@${params.handle} — Racik`;
    const desc = p
      ? `${p.recipes.length} resep rumahan dari @${p.handle}, dengan takaran yang ikut jumlah porsi.`
      : "Resep rumahan dengan takaran yang ikut jumlah porsi.";
    const image = storageUrl(p?.recipes[0]?.photo_path);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ property: "og:image", content: image }] : []),
      ],
    };
  },
  component: Profile,
});

function Profile() {
  const { profile } = Route.useLoaderData();
  const { handle } = Route.useParams();

  if (!profile) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-16 pb-16">
        <p className="eyebrow">RACIK</p>
        <h1 className="mt-2 text-28 font-extrabold leading-tight">@{handle} belum ada di Racik</h1>
        <p className="mt-3 read-line text-ink-2">
          Periksa ejaannya, atau mungkin kamu sedang offline.
        </p>
        <OpenInRacik />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-ground pb-16">
      <ProfileHeader
        handle={profile.handle}
        publicName={profile.public_name}
        photo={storageUrl(profile.photo_path)}
        count={profile.recipes.length}
        linked={false}
      />
      <ul className="px-5">
        {profile.recipes.map((r) => (
          <li key={r.id}>
            <Link
              to="/tulisan/$id"
              params={{ id: r.id }}
              className="flex min-h-16 items-center gap-3 border-b border-rule py-3"
            >
              <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#e8eee7]">
                <RecipePhoto
                  src={storageUrl(r.photo_path) ?? undefined}
                  glyph={"\u{1F372}"}
                  alt=""
                  glyphClass="text-[26px]"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold">{r.title}</span>
                <span className="block text-caption text-ink-3">
                  {[
                    `${r.serv} porsi`,
                    r.time_min ? fmtTime(r.time_min) : null,
                    `${r.steps} langkah`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {r.source_creator ? ` · dari ${r.source_creator}` : ""}
                </span>
              </span>
              <ArrowRight aria-hidden className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
      <OpenInRacik />
    </main>
  );
}
