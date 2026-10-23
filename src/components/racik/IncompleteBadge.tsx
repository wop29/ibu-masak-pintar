import type { Recipe } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";

/** An import whose bumbu was never captured says so wherever it appears. */
export function IncompleteBadge({ recipe }: { recipe: Recipe }) {
  if (!recipe.incomplete) return null;
  return (
    <span className="text-caption border border-rule bg-notice px-2 py-0.5 font-bold text-ink">
      
      {t("belum_lengkap")}
    </span>
  );
}
