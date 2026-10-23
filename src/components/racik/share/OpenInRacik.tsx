import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/racik/i18n";

/**
 * For someone who arrived from a shared link and has never used Racik. On a
 * phone with the app installed, the same link already opens inside it.
 */
export function OpenInRacik() {
  return (
    <aside className="mx-5 mt-10 rounded-3xl border border-primary-line bg-primary-soft p-5">
      <p className="text-head font-extrabold text-primary-deep">{t("takarannya_jelas")}</p>
      <p className="mt-1 read-line text-ink-2">
        
        {t("racik_menghitung_ulang_takaran_resep")}
      </p>
      <Button asChild size="lg" className="mt-4 w-full">
        <Link to="/">{t("buka_di_racik")}</Link>
      </Button>
    </aside>
  );
}
