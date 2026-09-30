import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/racik/i18n";
import {
  confirmEmailCode,
  enabledProviders,
  saveProfile,
  sendEmailCode,
  signInWith,
  signOut,
  type OAuthProvider,
  type Providers,
} from "@/lib/racik/backend/auth";
import { uploadPhoto } from "@/lib/racik/backend/recipes";
import { useAccount } from "@/lib/racik/backend/useAccount";

export const Route = createFileRoute("/masuk")({
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
  const t = useT();
  const navigate = useNavigate();
  const { account, ready, available, refresh } = useAccount();

  const [step, setStep] = useState<Step>("id");
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { enabledProviders().then(setProviders); }, []);

  // Signed in already: straight to the profile step, or out of here if done.
  useEffect(() => {
    if (!ready || !account) return;
    if (account.name) navigate({ to: "/tulis" });
    else { setStep("profile"); setPhotoPreview(account.photoUrl); }
  }, [ready, account, navigate]);

  const social: { id: OAuthProvider; label: string }[] = [
    ...(providers?.google ? [{ id: "google" as const, label: t("continue_google") }] : []),
    ...(providers?.facebook ? [{ id: "facebook" as const, label: t("continue_facebook") }] : []),
    ...(providers?.apple ? [{ id: "apple" as const, label: t("continue_apple") }] : []),
  ];

  const back = () => {
    setError("");
    if (step === "code") return setStep("id");
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12">
      <header className="flex items-center justify-between py-5">
        <Button variant="ghost" size="icon" aria-label={t("back")} onClick={back}>
          <ArrowLeft />
        </Button>
        {step === "profile" ? (
          <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate({ to: "/" })}>
            {t("skip")}
          </Button>
        ) : null}
      </header>

      {!available ? (
        <p className="rounded-2xl border border-rule bg-notice p-4 read-line">{t("not_connected")}</p>
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
          <Button
            size="lg"
            variant={social.length ? "outline" : "default"}
            className="mt-3 w-full"
            disabled={busy || !/.+@.+\..+/.test(email)}
            onClick={async () => {
              setBusy(true); setError("");
              const err = await sendEmailCode(email);
              setBusy(false);
              if (err) return setError(err);
              setStep("code");
            }}
          >
            {t("continue_")}
          </Button>
        </>
      ) : step === "code" ? (
        <>
          <h1 className="text-title font-bold">{t("code_title")}</h1>
          <p className="mt-2 read-line text-ink-2">{t("code_sent_to", { email })}</p>
          <input
            aria-label={t("code_title")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-8 h-16 w-full rounded-xl border border-border bg-card text-center text-34 font-bold tracking-[0.3em] tabular-nums"
          />
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={busy || code.length < 6}
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
            disabled={busy}
            onClick={async () => { setBusy(true); setError(""); const e = await sendEmailCode(email); setBusy(false); if (e) setError(e); }}
          >
            {t("code_resend")}
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
              navigate({ to: "/tulis" });
            }}
          >
            {t("done")}
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            onClick={async () => { await signOut(); refresh(); setStep("id"); }}
          >
            {t("sign_out")}
          </Button>
        </>
      )}

      {error ? <p className="mt-4 text-14 text-destructive">{error}</p> : null}

      {step === "id" && !available ? (
        <Button asChild variant="ghost" className="mt-4 w-full"><Link to="/">{t("back")}</Link></Button>
      ) : null}
    </main>
  );
}
