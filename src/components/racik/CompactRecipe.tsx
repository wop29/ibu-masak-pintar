import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { thumbOf } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { IncompleteBadge } from "./IncompleteBadge";
import { HalalChip } from "./HalalChip";
import { REG } from "@/lib/racik/data";
import { fmtProtein, proteinPerPortion, proteinUncertain } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";

function shortTime(minutes: number) {
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} jam ${m} mnt` : `${h} jam`;
}

/**
 * The list row used everywhere: square photo, title, the two lines a cook
 * decides on (time · difficulty, region · protein), and a label only when an
 * ingredient needs a halal check. `boxed` wraps it in a white card for the
 * home feed.
 */
export function CompactRecipe({ recipe, boxed = false, creator }: { recipe: Recipe; boxed?: boolean; creator?: string | undefined }) {
  const photo = recipe.photoUrl ?? thumbOf(recipe.id);
  const protein = proteinUncertain(recipe) ? null : fmtProtein(proteinPerPortion(recipe));
  const region = REG[recipe.region]?.name ?? recipe.region;
  return (
    <Link
      to="/resep/$id"
      params={{ id: recipe.id }}
      className={`flex items-center gap-4 py-3.5 ${boxed ? "rounded-2xl border border-rule bg-card px-3.5 shadow-card" : "border-b border-rule-soft last:border-b-0"}`}
    >
      <div className="size-[76px] shrink-0 overflow-hidden rounded-xl bg-primary-deep">
        <RecipePhoto src={photo} glyph={recipe.glyph} alt={recipe.title} glyphClass="text-28" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 text-body font-bold leading-tight tracking-[-0.02em] text-ink-strong [overflow-wrap:anywhere]">{recipe.title}</h3>
        <p className="text-label leading-snug text-ink-3">{shortTime(recipe.time)} · {recipe.diff}</p>
        <p className="mt-0.5 text-label leading-snug text-ink-3">{region}{protein ? ` · ±${protein} protein/porsi` : ""}</p>
        {recipe.incomplete ? <p className="mt-1.5"><IncompleteBadge recipe={recipe} /></p> : null}
        <span className="mt-1.5 block empty:hidden"><HalalChip recipe={recipe} static /></span>
        {creator ? <p className="mt-0.5 text-micro text-primary">Dari luar · {creator}</p> : null}
      </div>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
    </Link>
  );
}
