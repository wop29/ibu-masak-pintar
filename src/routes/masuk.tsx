import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/racik/i18n";
import {
  authErrorFromUrl,
  confirmEmailCode,
  EMAIL_RESEND_SECONDS,
  enabledProviders,
  OTP_MAX,
  OTP_MIN,
  saveProfile,
  sendEmailCode,
  signInWith,
  signInWithPassword,
  type OAuthProvider,
  type Providers,
} from "@/lib/racik/backend/auth";
import { useRacik } from "@/lib/racik/state";
import { uploadPhoto } from "@/lib/racik/backend/recipes";
import { useAccount } from "@/lib/racik/backend/useAccount";

/** Where to go after signing in. Only same-site paths, never "//evil.com". */
const safeNext = (v: unknown): string | undefined =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/masuk") ? v : undefined;

const NEXT_KEY = "racik.masuk.next";

/**
 * The Google Play review account. Typing this address on /masuk shows a
 * password field instead of sending a code, because reviewers cannot receive
 * our emails. The account is created by hand in Supabase with a password.
 */
const REVIEW_EMAIL = "peninjau@racik.online";

export const Route = createFileRoute("/masuk")({
  validateSearch: z.object({
    next: z.string().optional().catch(undefined),
    // Play review account only; not linked anywhere in the app.
    metode: z.enum(["sandi"]).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Masuk — Racik" }, { name: "robots", content: "noindex" }] }),
  component: Masuk,
});

/**
 * Three steps, in the shape Luma uses:
 *
 *  1. One identity field. No "daftar" / "masuk" fork — the same button does
 *     both, because a person does not know or care which they are doing.
 *  2. A six-digit code typed HERE, not a link that throws her into her mail
 *     app and hopes she finds her way back. She never leaves Racik.
 *  3. One profile screen, and it can be skipped.
 *
 * What Racik does NOT ask: a bio. Luma needs one because strangers size each
 * other up before an event. Nobody reads a bio to decide whether to cook
 * someone's rendang — the recipe speaks for itself. Household size is asked
 * during first-run onboarding instead, where it needs no account and actually
 * changes what every recipe shows.
 */
type Step = "id" | "code" | "profile";

function Masuk() {

  const router = useRouter();
  const { account, ready, available, refresh } = useAccount();
  const { signOutAndClear } = useRacik();
  const search = Route.useSearch();

  const [step, setStep] = useState<Step>("id");
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const usePassword = search.metode === "sandi" || email.trim().toLowerCase() === REVIEW_EMAIL;
  const [name, setName] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checkingLink, setCheckingLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { enabledProviders().then(setProviders); }, []);

  // Remember where she came from across the email-link round trip (the link
  // lands on plain /masuk, which is what the Supabase redirect allow-list holds).
  useEffect(() => {
    const n = safeNext(search.next);
    try { if (n) sessionStorage.setItem(NEXT_KEY, n); } catch { /* private mode */ }
  }, [search.next]);
  const nextPath = (): string => {
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(NEXT_KEY); } catch { /* ignore */ }
    return safeNext(search.next) ?? safeNext(stored) ?? "/";
  };
  const leave = () => {
    const to = nextPath();
    try { sessionStorage.removeItem(NEXT_KEY); } catch { /* ignore */ }
    window.history.replaceState(null, "", window.location.pathname);
    router.history.replace(to);
  };

  // Landing from the email link (or Google): the client reads the session out
  // of the URL by itself. Show that it is happening, and say in Bahasa when
  // the link was expired or already used.
  useEffect(() => {
    const err = authErrorFromUrl(window.location.href);
    if (err) {
      setError(err);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (/access_token=|[?&]code=|token_hash=/.test(window.location.href)) {
      setCheckingLink(true);
      const timer = setTimeout(() => {
        setCheckingLink(false);
        setError(t("err_link_not_ready"));
      }, 12000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Signed in already: straight to the profile step, or back where she was.
  useEffect(() => {
    if (!ready || !account) return;
    setCheckingLink(false);
    if (account.name) leave();
    else { setStep("profile"); setPhotoPreview(account.photoUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account]);

  const sendCode = async () => {
    setBusy(true); setError("");
    const err = await sendEmailCode(email, `${window.location.origin}/masuk`);
    setBusy(false);
    if (err) return setError(err);
    setCode("");
    setCooldown(EMAIL_RESEND_SECONDS);
    setStep("code");
  };

  const social: { id: OAuthProvider; label: string }[] = [
    ...(providers?.google ? [{ id: "google" as const, label: t("continue_google") }] : []),
    ...(providers?.facebook ? [{ id: "facebook" as const, label: t("continue_facebook") }] : []),
    ...(providers?.apple ? [{ id: "apple" as const, label: t("continue_apple") }] : []),
  ];

  const back = () => {
    setError("");
    if (step === "code") return setStep("id");
    leave();
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12">
      <header className="flex items-center justify-between py-5">
        <Button variant="ghost" size="icon" aria-label={t("back")} onClick={back}>
          <ArrowLeft />
        </Button>
        {step === "profile" ? (
          <Button variant="ghost" className="text-muted-foreground" onClick={leave}>
            {t("skip")}
          </Button>
        ) : null}
      </header>

      {!available ? (
        <p className="rounded-2xl border border-rule bg-notice p-4 read-line">{t("not_connected")}</p>
      ) : checkingLink ? (
        <p className="mt-8 read-line text-ink-2" role="status">{t("sebentar_sedang_masuk")}</p>
      ) : step === "id" ? (
        <>
          <h1 className="text-title font-bold">{t("sign_in_title")}</h1>
          <p className="mt-2 read-line text-ink-2">{t("sign_in_why")}</p>

          {social.length ? (
            <div className="mt-8">
              {social.map(({ id, label }) => (
                <Button
                  key={id}
                  size="lg"
                  variant={id === "google" ? "default" : "outline"}
                  className="mb-2 w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true); setError("");
                    const err = await signInWith(id, `${window.location.origin}/masuk`);
                    setBusy(false);
                    if (err) setError(err);
                  }}
                >
                  {label}
                </Button>
              ))}
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-rule" />
                <span className="text-14 text-muted-foreground">{t("or")}</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
            </div>
          ) : <div className="mt-8" />}

          <label className="text-body font-semibold" htmlFor="email">{t("email_label")}</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body"
          />
          {usePassword ? (
            <>
              <label className="mt-4 block text-body font-semibold" htmlFor="sandi">{t("password_label")}</label>
              <input
                id="sandi"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body"
              />
              <Button
                size="lg"
                className="mt-3 w-full"
                disabled={busy || !/.+@.+\..+/.test(email.trim()) || password.length < 6}
                onClick={async () => {
                  setBusy(true); setError("");
                  const err = await signInWithPassword(email, password);
                  setBusy(false);
                  if (err) return setError(err);
                  setPassword("");
                  refresh();
                }}
              >
                {t("password_signin")}
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              variant={social.length ? "outline" : "default"}
              className="mt-3 w-full"
              disabled={busy || !/.+@.+\..+/.test(email.trim())}
              onClick={sendCode}
            >
              {t("continue_")}
            </Button>
          )}
          <p className="mt-6 text-label leading-relaxed text-ink-3">
            
            {t("dengan_masuk_kamu_setuju_dengan")}{" "}<a href="/privasi" className="font-semibold text-primary underline">{t("kebijakan_privasi")}</a> {" "}{t("racik_akun_gratis_dipakai_untuk")}
          </p>
        </>
      ) : step === "code" ? (
        <>
          <h1 className="text-title font-bold">{t("code_title")}</h1>
          <p className="mt-2 read-line text-ink-2">{t("code_sent_to", { email })}</p>
          <p className="mt-2 text-14 leading-relaxed text-ink-3">{t("kalau_yang_datang_berupa_tautan")}</p>
          <input
            aria-label={t("code_title")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_MAX}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))}
            className="mt-8 h-16 w-full rounded-xl border border-border bg-card text-center text-34 font-bold tracking-[0.3em] tabular-nums"
          />
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={busy || code.length < OTP_MIN}
            onClick={async () => {
              setBusy(true); setError("");
              const err = await confirmEmailCode(email, code);
              setBusy(false);
              if (err) return setError(err);
              refresh();
            }}
          >
            {t("continue_")}
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            disabled={busy || cooldown > 0}
            onClick={sendCode}
          >
            {cooldown > 0 ? t("kirim_ulang_dalam_detik", { cooldown }) : t("code_resend")}
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-title font-bold">{t("profile_title")}</h1>
          <p className="mt-2 read-line text-ink-2">{t("profile_why")}</p>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-6 flex items-center gap-4"
          >
            <span className="relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-tint">
              {photoPreview
                ? <img src={photoPreview} alt="" className="size-full object-cover" />
                : <Camera aria-hidden className="size-7 text-muted-foreground" />}
            </span>
            <span className="text-body font-semibold text-primary">{t("add_photo")}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPhotoPreview(URL.createObjectURL(file));
              setBusy(true);
              const res = await uploadPhoto(file);
              setBusy(false);
              if ("error" in res) { setError(res.error); setPhotoPreview(null); return; }
              setPhotoPath(res.path);
            }}
          />

          <label className="mt-6 block text-body font-semibold" htmlFor="nama">{t("your_name")}</label>
          <input
            id="nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body"
          />

          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              setBusy(true); setError("");
              const err = await saveProfile(name, photoPath);
              setBusy(false);
              if (err) return setError(err);
              refresh();
              leave();
            }}
          >
            {t("done")}
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            onClick={async () => { await signOutAndClear({ force: true }); refresh(); setStep("id"); }}
          >
            {t("sign_out")}
          </Button>
        </>
      )}

      {error ? <p className="mt-4 text-14 text-danger-ink">{error}</p> : null}

      {step === "id" && !available ? (
        <Button asChild variant="ghost" className="mt-4 w-full"><Link to="/">{t("back")}</Link></Button>
      ) : null}
    </main>
  );
}
