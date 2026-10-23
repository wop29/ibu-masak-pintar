import { Link } from "@tanstack/react-router";
import { REG } from "@/lib/racik/data";
import { fmtTime } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { IncompleteBadge } from "./IncompleteBadge";
import { nutritionLine } from "./NutritionBlock";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photo = recipe.photoUrl ?? PHOTO[recipe.id];
  const gizi = nutritionLine(recipe);
  return (
    <Link
      to="/resep/$id"
      params={{ id: recipe.id }}
      className="hairline-b block bg-card"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-tint">
        <RecipePhoto src={photo} glyph={recipe.glyph} alt={recipe.title} />
      </div>
      <div className="px-5 py-4">
        <p className="text-caption font-bold text-primary">{REG[recipe.region]?.name ?? recipe.region}</p>
        <h3 className="font-display text-head mt-1 leading-snug">{recipe.title}</h3>
        {recipe.incomplete ? <p className="mt-2"><IncompleteBadge recipe={recipe} /></p> : null}
        <p className="text-14 text-ink-3 mt-1">
          {fmtTime(recipe.time)} · {recipe.diff}
        </p>
        {gizi ? <p className="text-14 text-ink-3 mt-0.5">Perkiraan per porsi: {gizi}</p> : null}
      </div>
    </Link>
  );
}
