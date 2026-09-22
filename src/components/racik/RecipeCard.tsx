import { Link } from "@tanstack/react-router";
import { REG, SPICE_WORD } from "@/lib/racik/data";
import { fmtProtein, fmtTime, proteinPerPortion } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "./photos";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photo = PHOTO[recipe.id];
  const protein = fmtProtein(proteinPerPortion(recipe));
  return (
    <Link
      to="/resep/$id"
      params={{ id: recipe.id }}
      className="hairline-b block bg-card"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-mag-deep">
        {photo ? (
          <img
            src={photo}
            alt={recipe.title}
            loading="lazy"
            width={1024}
            height={704}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mag-deep to-onb text-[44px]">
            <span aria-hidden>{recipe.glyph}</span>
          </div>
        )}
      </div>
      <div className="px-5 py-4">
        <p className="eyebrow">{REG[recipe.region]?.name ?? recipe.region}</p>
        <h3 className="font-display text-head mt-1 leading-snug">{recipe.title}</h3>
        <p className="text-secondary text-ink-3 mt-1">
          {fmtTime(recipe.time)} · {recipe.diff} · {SPICE_WORD[recipe.spice]}
          {protein ? ` · protein ± ${protein}` : ""}
        </p>
      </div>
    </Link>
  );
}
