import { Link } from "@tanstack/react-router";
import { REG } from "@/lib/racik/data";
import { fmtProtein, fmtTime, proteinPerPortion } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { IncompleteBadge } from "./IncompleteBadge";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photo = PHOTO[recipe.id];
  const protein = fmtProtein(proteinPerPortion(recipe));
  return (
    <Link
      to="/resep/$id"
      params={{ id: recipe.id }}
      className="hairline-b block bg-card"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary-deep">
        <RecipePhoto src={photo} glyph={recipe.glyph} alt={recipe.title} />
      </div>
      <div className="px-5 py-4">
        <p className="eyebrow">{REG[recipe.region]?.name ?? recipe.region}</p>
        <h3 className="font-display text-head mt-1 leading-snug">{recipe.title}</h3>
        {recipe.incomplete ? <p className="mt-2"><IncompleteBadge recipe={recipe} /></p> : null}
        <p className="text-secondary text-ink-3 mt-1">
          {fmtTime(recipe.time)} · {recipe.diff}
          {protein ? ` · perkiraan ${protein} protein` : ""}
        </p>
      </div>
    </Link>
  );
}
