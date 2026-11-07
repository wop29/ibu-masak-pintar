import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/racik/i18n";
import { backendConfigured } from "@/lib/racik/backend/client";
import { enabledProviders, signInWith } from "@/lib/racik/backend/auth";
import { RECIPES } from "@/lib/racik/data";
import { BrandIcon } from "@/components/racik/BrandIcon";
import hero from "@/assets/brand/onboarding/hero-masuk.webp";
import wordmark from "@/assets/brand/wordmark/racik-wordmark.svg";

/**
 * The account offer, as the last screen of onboarding. Restyled 6 Nov 2026
 * after SideChef's sign-up screen: a full-bleed dish fading into the page, the
 * wordmark, three benefits as an icon row, Google and Email as pill buttons.
 *
 * It is a screen, not a wall: "Nanti saja" sits top right and under the
 * buttons, and taking it costs her nothing. Every recipe, the measurements and
 * cook mode work without an account, and the screen says so.
 *
 * Every benefit line is something an account does today: library sync
 * (user_library), Tulis resep sharing with cook counts, and opening the same
 * collection on another device.
 */
const BENEFITS = [
  { id: "save", icon: "koleksi-saya", get title() { return t("offer2_save_t"); }, get body() { return t("offer2_save_b"); } },
  { id: "share", icon: "edit", get title() { return t("offer2_share_short"); }, get body() { return t("offer2_share_b"); } },
  { id: "sync", icon: "sinkron", get title() { return t("offer2_sync_t"); }, get body() { return t("offer2_sync_b"); } },
];

/** Google's "G" mark, in its own colours, on the white button Google's sign-in guidelines ask for. */
export function GoogleMark() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}

export function SignInOffer({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const navigate = useNavigate();
  const [google, setGoogle] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    enabledProviders().then((p) => { if (live) setGoogle(p.google); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Nowhere to sign in to: don't show a screen that cannot deliver.
  if (!backendConfigured) {
    onDone();
    return null;
  }

  const toEmail = () => { onDone(); navigate({ to: "/masuk" }); };
  const toGoogle = async () => {
    setBusy(true);
    // Mark onboarding done first: Google sends her back to /masuk, then home,
    // and she should not land in the questions again.
    onDone();
    const err = await signInWith("google", `${window.location.origin}/masuk`);
    if (err) navigate({ to: "/masuk" });
  };

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-[max(24px,env(safe-area-inset-bottom))]">
      {/* Full-bleed dish fading into the page, SideChef's "Cook with Confidence" screen in Racik's light. */}
      <div className="relative h-[42dvh] max-h-[380px] min-h-[260px] shrink-0 overflow-hidden">
        <img src={hero} alt="" aria-hidden width={780} height={1170} className="rk-settle h-full w-full object-cover object-top" />
        <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(248_244_234/0)_58%,var(--color-ground)_100%)]" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label={t("back")}
            onClick={onBack}
            className="flex size-11 items-center justify-center rounded-full bg-dark/45 text-white backdrop-blur-sm"
          >
            <ArrowLeft className="size-5" strokeWidth={2.4} />
          </button>
          <button type="button" onClick={onDone} className="min-h-11 rounded-full bg-dark/45 px-4 text-14 font-extrabold text-white backdrop-blur-sm">
            {t("offer_later")}
          </button>
        </div>
      </div>

      <div className="relative -mt-10 flex flex-1 flex-col px-5 text-center">
        <span className="animate-fade-in mx-auto inline-flex items-center gap-2 rounded-full bg-card py-2 pl-2 pr-3.5 shadow-[0_8px_22px_rgba(31,61,46,0.14)]">
          <img src="/icons/icon-192.png" alt="" aria-hidden className="size-[30px] rounded-lg" />
          <img src={wordmark} alt={t("akun_racik")} className="h-[22px] w-auto" />
        </span>
        <h1 className="animate-slide-up mx-auto mt-3.5 max-w-[330px] font-display text-28 font-extrabold leading-[1.06] text-primary">
          {t("offer2_title")}
        </h1>
        <p className="sr-only">{t("offer2_body")}</p>

        <ul className="animate-slide-up-2 mt-4 grid grid-cols-3 gap-2.5">
          {BENEFITS.map(({ id, icon, title, body }) => (
            <li key={id} className="flex flex-col items-center gap-1.5">
              <BrandIcon name={icon} className="size-[52px] rounded-[14px]" />
              <span className="text-caption font-extrabold leading-tight text-ink">{title}</span>
              <span className="sr-only">{body}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-2.5 pt-6">
          {google ? (
            <Button size="lg" variant="outline" className="h-14 w-full gap-3 rounded-full border-[1.5px] border-rule-strong bg-white text-body font-extrabold text-ink-strong" disabled={busy} onClick={toGoogle}>
              <GoogleMark />
              {t("continue_google")}
            </Button>
          ) : null}
          <Button size="lg" variant="cta" className="h-14 w-full gap-3 rounded-full text-body font-extrabold" disabled={busy} onClick={toEmail}>
            <Mail className="size-5" strokeWidth={2.2} aria-hidden />
            {t("offer2_email")}
          </Button>
        </div>
        <p className="mt-3 text-caption leading-snug text-ink-2">{t("offer2_free_note", { n: RECIPES.length })}</p>
        <p className="mt-2 text-micro leading-relaxed text-ink-3">
          {t("offer2_terms_pre")}{" "}
          <Link to="/privasi" target="_blank" className="font-bold text-primary-strong underline underline-offset-2">{t("kebijakan_privasi")}</Link>
          {" "}{t("offer2_terms_and")}{" "}
          <Link to="/syarat" target="_blank" className="font-bold text-primary-strong underline underline-offset-2">{t("syarat_penggunaan")}</Link>
          {t("offer2_terms_post")}
        </p>
      </div>
    </main>
  );
}
