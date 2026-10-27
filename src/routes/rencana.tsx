import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { AppTabs } from "@/components/racik/AppTabs";
import { RencanaView } from "@/components/racik/RencanaView";
import { t } from "@/lib/racik/i18n";

// ?hari=<recipeId> opens the day picker for that recipe ("Pilih hari" in the add-to-plan snackbar).
const searchSchema = z.object({ hari: z.string().min(1).max(120).optional().catch(undefined) });

export const Route = createFileRoute("/rencana")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Rencana Masak — Racik" }, { name: "description", content: "Rencana masak seminggu dan daftar belanja yang bahannya sudah digabung." }] }),
  component: Rencana,
});

function Rencana() {
  const { hari } = Route.useSearch();
  const navigate = Route.useNavigate();
  const handled = useCallback(() => {
    navigate({ search: {}, replace: true });
  }, [navigate]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24">
      <header className="border-b border-rule-soft bg-card px-5 pb-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <h1 className="text-hero font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">{t("tab_plan")}</h1>
          <Link to="/pengaturan" aria-label={t("settings")} className="mt-1 size-11 overflow-hidden rounded-2xl shadow-chip"><BrandIcon name="pengaturan" className="size-11 rounded-2xl" /></Link>
        </div>
      </header>
      <div className="flex-1"><RencanaView pickDayFor={hari} onPickDayHandled={handled} /></div>
      <AppTabs />
    </main>
  );
}
