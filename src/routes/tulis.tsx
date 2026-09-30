import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/racik/i18n";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { myRecipes } from "@/lib/racik/backend/recipes";
import type { UserRecipe } from "@/lib/racik/backend/types";

export const Route = createFileRoute("/tulis")({
  head: () => ({
    meta: [
      { title: "Tulis Resep — Racik" },
      { name: "description", content: "Tulis resepmu sendiri dan bagikan ke pengguna Racik lain." },
    ],
  }),
  component: Tulis,
});

const STATUS_KEY = { draft: "draft", live: "live", hidden: "hidden", removed: "hidden" } as const;

function Tulis() {
  const t = useT();
  const { account, ready, available } = useAccount();
  const [mine, setMine] = useState<UserRecipe[]>([]);

  useEffect(() => {
    if (account) myRecipes().then(setMine);
  }, [account]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-28">
      <header className="px-5 pb-5 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <p className="eyebrow">RACIK</p>
        <h1 className="mt-1 text-display font-extrabold leading-[1.08]">{t("write_hook")}</h1>
        <p className="mt-3 read-line text-ink-2">{t("write_intro")}</p>
      </header>

      <div className="px-5">
        {!available ? (
          <p className="rounded-2xl border border-rule bg-notice p-4 read-line">{t("not_connected")}</p>
        ) : !ready ? null : !account || !account.name ? (
          <Button asChild size="lg" className="w-full">
            <Link to="/masuk">{t("sign_in")}</Link>
          </Button>
        ) : (
          <>
            <p className="text-14 text-muted-foreground">{t("signed_in_as", { name: account.name })}</p>
            <Button size="lg" className="mt-3 w-full">
              <PenLine /> {t("write_recipe")}
            </Button>

            {mine.length ? (
              <section className="mt-8">
                <h2 className="eyebrow-ink">{t("my_recipes")}</h2>
                <ul className="mt-3">
                  {mine.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border py-4">
                      <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                      <span className="shrink-0 text-14 text-muted-foreground">
                        {t(STATUS_KEY[r.status])}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <AppTabs />
    </main>
  );
}
