import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/racik/i18n";
import { backendConfigured } from "@/lib/racik/backend/client";
import { enabledProviders, signInWith } from "@/lib/racik/backend/auth";
import { RECIPES } from "@/lib/racik/data";
import hero from "@/assets/brand/onboarding/onboarding-akun.webp";
import tileSave from "@/assets/brand/onboarding/ikon-simpan-link.png";
import tileWrite from "@/assets/brand/onboarding/ikon-tulis-resep.png";
import tileSync from "@/assets/brand/onboarding/ikon-perangkat.png";

/**
 * The account offer, as the last screen of onboarding (redesigned 29 Okt 2026
 * from Octavia's mock: illustration, three benefits, Google first).
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
  { id: "save", tile: tileSave, get title() { return t("offer2_save_t"); }, get body() { return t("offer2_save_b"); } },
  { id: "share", tile: tileWrite, get title() { return t("offer2_share_t"); }, get body() { return t("offer2_share_b"); } },
  { id: "sync", tile: tileSync, get title() { return t("offer2_sync_t"); }, get body() { return t("offer2_sync_b"); } },
];

/** Google's "G" mark, in its own colours, as Google's sign-in guidelines ask. */
function GoogleMark() {
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("back")}
          onClick={onBack}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-primary-deep"
        >
          <ArrowLeft className="size-5" strokeWidth={2.4} />
        </button>
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 5 ? "bg-primary" : "bg-rule-strong"}`} />
          ))}
        </div>
        <Button variant="ghost" className="min-h-11 px-2 text-15 font-bold text-ink-2" onClick={onDone}>
          {t("offer_later")}
        </Button>
      </div>

      <img
        src={hero}
        alt=""
        aria-hidden
        width={712}
        height={513}
        className="mx-auto mt-3 w-full max-w-[400px] [mask-image:radial-gradient(ellipse_75%_70%_at_50%_50%,#000_72%,transparent_100%)]"
      />

      <p className="mt-2 text-15 font-extrabold text-primary-strong">{t("akun_racik")}</p>
      <h1 className="mt-1 font-display text-34 font-extrabold leading-[1.05] tracking-[-0.01em] text-ink-strong">
        {t("offer2_title")}
      </h1>
      <p className="mt-2 read-line text-ink-2">{t("offer2_body")}</p>

      <ul className="mt-5 space-y-3">
        {BENEFITS.map(({ id, tile, title, body }) => (
          <li key={id} className="flex items-center gap-4">
            <img src={tile} alt="" aria-hidden className="size-16 shrink-0 rounded-2xl object-cover" />
            <span className="min-w-0">
              <span className="block text-17 font-extrabold text-ink-strong">{title}</span>
              <span className="mt-0.5 block text-14 leading-snug text-ink-2">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        {google ? (
          <Button size="lg" className="h-14 w-full gap-3 rounded-2xl text-body font-extrabold" disabled={busy} onClick={toGoogle}>
            <GoogleMark />
            {t("continue_google")}
          </Button>
        ) : null}
        <Button
          size="lg"
          variant={google ? "outline" : "default"}
          className="h-14 w-full gap-3 rounded-2xl text-body font-extrabold"
          disabled={busy}
          onClick={toEmail}
        >
          <Mail className="size-5" strokeWidth={2.2} aria-hidden />
          {t("offer2_email")}
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3 text-14 text-ink-3" aria-hidden>
        <span className="h-px flex-1 bg-rule" />
        {t("offer2_or")}
        <span className="h-px flex-1 bg-rule" />
      </div>
      <Button variant="ghost" className="mt-1 min-h-11 w-full text-body font-extrabold text-ink-2" onClick={onDone}>
        {t("offer_later")}
      </Button>
      <p className="mt-1 text-center text-caption text-ink-3">{t("offer2_free_note", { n: RECIPES.length })}</p>

      <p className="mt-5 text-center text-caption leading-relaxed text-ink-3">
        {t("offer2_terms_pre")}{" "}
        <Link to="/privasi" target="_blank" className="font-bold text-primary-strong underline underline-offset-2">{t("kebijakan_privasi")}</Link>
        {" "}{t("offer2_terms_and")}{" "}
        <Link to="/syarat" target="_blank" className="font-bold text-primary-strong underline underline-offset-2">{t("syarat_penggunaan")}</Link>
        {t("offer2_terms_post")}
      </p>
    </main>
  );
}
