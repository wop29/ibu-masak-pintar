import type { Recipe } from "@/lib/racik/types";

/** An import whose bumbu was never captured says so wherever it appears. */
export function IncompleteBadge({ recipe }: { recipe: Recipe }) {
  if (!recipe.incomplete) return null;
  return (
    <span className="text-micro border border-rule bg-notice px-2 py-0.5 font-bold uppercase tracking-[0.1em] text-ink">
      BELUM LENGKAP
    </span>
  );
}
