import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/racik/i18n";
import { useRacik } from "@/lib/racik/state";
import { backendConfigured } from "@/lib/racik/backend/client";
import { useAccount } from "@/lib/racik/backend/useAccount";

/**
 * The account offer. Shown once, on the home screen, and always skippable.
 *
 * It is NOT a wall. Racik's promise is 199 recipes on the device with no
 * account and no signal, and a sign-up form in front of that would cost more
 * installs than the accounts are worth — the person opening this app wants to
 * know how much santan goes in, not to register.
 *
 * Every line here is something signing in actually does today. Nothing about
 * recipes following her to a new phone, because that is not built yet.
 */
export function SignInOffer() {
  const t = useT();
  const { state, update } = useRacik();
  const { account, ready } = useAccount();

  if (!backendConfigured || state.authAsked || !ready || account) return null;

  return (
    <section className="mx-5 mt-5 rounded-2xl border border-rule bg-tint p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-head font-bold leading-snug">{t("offer_title")}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("offer_later")}
          className="-mr-2 -mt-2 shrink-0 text-muted-foreground"
          onClick={() => update({ authAsked: true })}
        >
          <X />
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {(["offer_write", "offer_share", "offer_seen"] as const).map((key) => (
          <li key={key} className="flex gap-3 text-14 leading-relaxed">
            <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-14 text-muted-foreground">{t("offer_not_needed")}</p>

      <div className="mt-4 flex gap-2">
        <Button asChild className="flex-1">
          <Link to="/masuk" onClick={() => update({ authAsked: true })}>{t("sign_in")}</Link>
        </Button>
        <Button variant="ghost" onClick={() => update({ authAsked: true })}>
          {t("offer_later")}
        </Button>
      </div>
    </section>
  );
}
