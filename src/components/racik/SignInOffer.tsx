import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/racik/i18n";
import { backendConfigured } from "@/lib/racik/backend/client";
import { RECIPES } from "@/lib/racik/data";

/**
 * The account offer, as the last screen of onboarding.
 *
 * It is a screen, not a wall: Lewati is always there, and taking it costs her
 * nothing. Racik's promise is every shipped recipe on the device with no account and no
 * signal, and a form standing in front of that would lose more installs than
 * the accounts are worth.
 *
 * Every benefit line is something an account does TODAY. There is deliberately
 * no "your recipes follow you to a new phone" — nothing syncs yet, and the
 * first person who changed handsets would find out we lied.
 */
export function SignInOffer({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {

  const navigate = useNavigate();

  // Nowhere to sign in to: don't show a screen that cannot deliver.
  if (!backendConfigured) {
    onDone();
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-card px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t("back")} onClick={onBack}><ArrowLeft /></Button>
        {/* Six dots, all filled: she is at the end, not stuck in a new flow. */}
        <div className="flex flex-1 gap-2">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-1 flex-1 rounded-full bg-primary" />)}
        </div>
        <Button variant="ghost" className="px-2 text-label text-muted-foreground" onClick={onDone}>
          {t("offer_later")}
        </Button>
      </div>

      <div className="mt-auto">
        <p className="text-15 font-bold text-primary">{t("akun_racik")}</p>
        <h1 className="mt-2 text-34 font-extrabold leading-[1.1]">{t("offer_title")}</h1>

        <ul className="mt-6 space-y-4">
          {(["offer_write", "offer_share", "offer_seen"] as const).map((key) => (
            <li key={key} className="flex gap-3 read-line">
              <Check aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-2xl bg-tint p-4 text-14 leading-relaxed text-ink-2">
          {t("offer_not_needed", { n: RECIPES.length })}
        </p>

        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => { onDone(); navigate({ to: "/masuk" }); }}
        >
          {t("sign_in")}
        </Button>
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={onDone}>
          {t("offer_later")}
        </Button>
        <p className="mt-3 text-center text-label text-ink-3">
          
          {t("baca_dulu")}{" "}
          <Link to="/privasi" target="_blank" className="font-semibold text-primary underline underline-offset-2">{t("kebijakan_privasi")}</Link>
          {" "}{t("apa_yang_disimpan_saat_kamu")}
        </p>
      </div>
    </main>
  );
}
