import { BrandIcon } from "./BrandIcon";
import { CompactRecipe } from "./CompactRecipe";
import { useRacik } from "@/lib/racik/state";
import { TAMPILAN, type Tampilan } from "@/lib/racik/store";
import { t } from "@/lib/racik/i18n";
import type { Recipe } from "@/lib/racik/types";

const ICON = {
  foto: "tampilan-foto-besar",
  baris: "tampilan-list",
  grid: "tampilan-grid",
} as const;

/** The view switch above recipe lists, like a shop's list/grid toggle. Her choice is remembered. */
export function ViewToggle() {
  const { state, update } = useRacik();
  return (
    <div
      role="radiogroup"
      aria-label={t("tampilan")}
      className="flex shrink-0 gap-0.5 rounded-xl bg-tint p-0.5"
    >
      {TAMPILAN.map((v) => {
        const on = state.tampilan === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(`tampilan_${v}` as "tampilan_foto")}
            onClick={() => update({ tampilan: v })}
            className={`flex size-11 items-center justify-center rounded-[10px] ${on ? "bg-card text-primary shadow-card" : "text-ink-3"}`}
          >
            <BrandIcon
              name={ICON[v]}
              className={`size-8 rounded-lg ${on ? "" : "opacity-60 grayscale"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** A list of recipes in the look she picked with ViewToggle. */
export function RecipeList({ recipes, view }: { recipes: Recipe[]; view?: Tampilan }) {
  const { state } = useRacik();
  const v = view ?? state.tampilan;
  if (v === "grid") {
    return (
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 pb-5 tab:grid-cols-3 tab:gap-x-6 tab:gap-y-8 desk:grid-cols-4">
        {recipes.map((r) => (
          <CompactRecipe key={r.id} recipe={r} variant="grid" />
        ))}
      </div>
    );
  }
  if (v === "foto") {
    return (
      <div className="flex flex-col gap-7 pb-5 tab:grid tab:grid-cols-3 tab:gap-x-6 tab:gap-y-8 desk:grid-cols-4">
        {recipes.map((r) => (
          <CompactRecipe key={r.id} recipe={r} variant="foto" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col pb-5 tab:grid tab:grid-cols-2 tab:gap-x-8 desk:grid-cols-3">
      {recipes.map((r) => (
        <CompactRecipe key={r.id} recipe={r} variant="baris" />
      ))}
    </div>
  );
}
