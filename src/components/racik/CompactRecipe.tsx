import { Link } from "@tanstack/react-router";
import { thumbOf } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { IncompleteBadge } from "./IncompleteBadge";
import { HalalChip } from "./HalalChip";
import { CARD_KEYS, nutritionLine } from "./NutritionBlock";
import type { Recipe } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";

function shortTime(minutes: number) {
  if (minutes < 60) return t("fmt_min", { minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t("fmt_h_min", { h, m }) : t("fmt_h", { h });
}

const Clock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export type CardVariant = "foto" | "baris" | "grid";

/**
 * A recipe in a list, in one of three looks she can switch between (decided
 * 25 Oct 2026): "foto" (wide photo, title under it), "baris" (photo left, info
 * chips right) and "grid" (square photo with the time on it, for two columns).
 * Every look shows only the title, time, kalori and protein; difficulty, region
 * and the other nutrients live on the recipe page. A label only when an
 * ingredient needs a halal check.
 */
export function CompactRecipe({ recipe, variant = "baris", creator }: { recipe: Recipe; variant?: CardVariant; boxed?: boolean; creator?: string | undefined }) {
  const photo = recipe.photoUrl ?? thumbOf(recipe.id);
  const gizi = nutritionLine(recipe, CARD_KEYS);
  const time = shortTime(recipe.time);
  const extras = (
    <>
      {recipe.incomplete ? <span className="block"><IncompleteBadge recipe={recipe} /></span> : null}
      <span className="block empty:hidden"><HalalChip recipe={recipe} static /></span>
      {creator ? <span className="block text-caption text-primary">{t("dari_luar_2")}{" "}{creator}</span> : null}
    </>
  );

  if (variant === "foto") {
    return (
      <Link to="/resep/$id" params={{ id: recipe.id }} className="flex flex-col gap-3">
        <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl bg-tint">
          <RecipePhoto src={photo} alt={recipe.title} title={recipe.title} />
        </div>
        <div className="flex flex-col gap-1.5 px-0.5">
          <h3 className="text-head font-extrabold leading-tight tracking-[-0.025em] text-ink-strong [overflow-wrap:anywhere]">{recipe.title}</h3>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-14 text-ink-2">
            <span className="inline-flex items-center gap-1.5"><Clock />{time}</span>
            {gizi ? <span>{gizi}</span> : null}
          </p>
          {extras}
        </div>
      </Link>
    );
  }

  if (variant === "grid") {
    return (
      <Link to="/resep/$id" params={{ id: recipe.id }} className="flex min-w-0 flex-col gap-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-tint">
          <RecipePhoto src={photo} alt={recipe.title} title={recipe.title} />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-caption font-bold text-ink">
            <Clock />{time}
          </span>
        </div>
        <h3 className="text-body font-bold leading-tight tracking-[-0.02em] text-ink-strong [overflow-wrap:anywhere]">{recipe.title}</h3>
        {gizi ? <p className="-mt-1 text-caption leading-snug text-ink-2">{gizi}</p> : null}
        {extras}
      </Link>
    );
  }

  return (
    <Link to="/resep/$id" params={{ id: recipe.id }} className="flex items-center gap-4 border-b border-rule py-3.5 last:border-b-0">
      <div className="size-24 shrink-0 overflow-hidden rounded-[14px] bg-tint">
        <RecipePhoto src={photo} alt={recipe.title} title={recipe.title} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-17 font-bold leading-tight tracking-[-0.02em] text-ink-strong [overflow-wrap:anywhere]">{recipe.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-tint px-2.5 py-1 text-caption font-semibold text-ink-2"><Clock />{time}</span>
          {gizi ? <span className="inline-flex items-center rounded-lg bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary-deep">{gizi}</span> : null}
        </div>
        {extras}
      </div>
    </Link>
  );
}
