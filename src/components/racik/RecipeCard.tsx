import { Link } from "@tanstack/react-router";
import { fmtTime } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { IncompleteBadge } from "./IncompleteBadge";
import { CARD_KEYS, nutritionLine } from "./NutritionBlock";
import { t } from "@/lib/racik/i18n";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photo = recipe.photoUrl ?? PHOTO[recipe.id];
  const gizi = nutritionLine(recipe, CARD_KEYS);
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
        <h3 className="font-display text-head mt-1 leading-snug">{recipe.title}</h3>
        {recipe.incomplete ? <p className="mt-2"><IncompleteBadge recipe={recipe} /></p> : null}
        <p className="text-14 text-ink-3 mt-1">
          {fmtTime(recipe.time)}
        </p>
        {gizi ? <p className="text-14 text-ink-3 mt-0.5">{t("perkiraan_per_porsi")}{" "}{gizi}</p> : null}
      </div>
    </Link>
  );
}
