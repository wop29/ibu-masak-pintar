import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PHOTO } from "./photos";
import { REG } from "@/lib/racik/data";
import { fmtProtein, fmtTime, proteinPerPortion } from "@/lib/racik/engine";
import type { Recipe } from "@/lib/racik/types";

export function CompactRecipe({ recipe }: { recipe: Recipe }) {
  const photo = PHOTO[recipe.id];
  const protein = fmtProtein(proteinPerPortion(recipe));
  return (
    <Link to="/resep/$id" params={{ id: recipe.id }} className="flex min-h-28 items-center gap-4 border-b border-border py-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-primary-deep">
        {photo ? <img src={photo} alt="" loading="lazy" width={1024} height={704} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-28" aria-hidden>{recipe.glyph}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-head font-bold leading-snug">{recipe.title}</h3>
        <p className="mt-1 text-label leading-relaxed text-muted-foreground">{REG[recipe.region]?.name ?? recipe.region} · {fmtTime(recipe.time)} · {recipe.diff}{protein ? ` · perkiraan ${protein} protein` : ""}</p>
      </div>
      <ChevronRight aria-hidden className="shrink-0 text-border" />
    </Link>
  );
}