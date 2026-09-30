import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/racik/i18n";
import { enabledProviders, saveName, sendEmailLink, signInWithGoogle, signOut, type Providers } from "@/lib/racik/backend/auth";
import { useAccount } from "@/lib/racik/backend/useAccount";

export const Route = createFileRoute("/masuk")({
  head: () => ({ meta: [{ title: "Masuk — Racik" }, { name: "robots", content: "noindex" }] }),
  component: Masuk,
});

function Masuk() {
  const t = useT();
  const navigate = useNavigate();
  const { account, ready, available, refresh } = useAccount();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => { enabledProviders().then(setProviders); }, []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account?.name) setName(account.name);
  }, [account?.name]);

  // Signed in and named: nothing left to do here.
  useEffect(() => {
    if (ready && account && account.name) navigate({ to: "/tulis" });
  }, [ready, account, navigate]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12">
      <header className="flex items-center gap-3 py-5">
        <Button asChild variant="ghost" size="icon">
          <Link to="/" aria-label={t("back")}><ArrowLeft /></Link>
        </Button>
        <h1 className="text-title font-bold">{t("sign_in_title")}</h1>
      </header>

      <p className="read-line text-ink-2">{t("sign_in_why")}</p>

      {!available ? (
        <p className="mt-8 rounded-2xl border border-rule bg-notice p-4 read-line">{t("not_connected")}</p>
      ) : !ready ? null : !account ? (
        <section className="mt-8">
          {providers?.google ? (
            <>
              <Button
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  const err = await signInWithGoogle(`${window.location.origin}/masuk`);
                  setBusy(false);
                  if (err) setError(err);
                }}
              >
                {t("continue_google")}
              </Button>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-rule" />
                <span className="text-14 text-muted-foreground">{t("or")}</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
            </>
          ) : null}

          {sent ? (
            <p className="rounded-2xl border border-rule bg-notice p-4 read-line">{t("link_sent")}</p>
          ) : (
            <>
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
                variant="outline"
                size="lg"
                className="mt-3 w-full"
                disabled={busy || !/.+@.+\..+/.test(email)}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  const err = await sendEmailLink(email, `${window.location.origin}/masuk`);
                  setBusy(false);
                  if (err) setError(err);
                  else setSent(true);
                }}
              >
                {t("send_link")}
              </Button>
            </>
          )}
        </section>
      ) : (
        <section className="mt-8">
          <label className="text-body font-semibold" htmlFor="nama">{t("your_name")}</label>
          <p className="mt-1 text-14 text-muted-foreground">{t("your_name_detail")}</p>
          <input
            id="nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-3 h-12 w-full rounded-xl border border-border bg-card px-4 text-body"
          />
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={busy || name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              const err = await saveName(name);
              setBusy(false);
              if (err) return setError(err);
              refresh();
              navigate({ to: "/tulis" });
            }}
          >
            {t("save")}
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            onClick={async () => { await signOut(); refresh(); }}
          >
            {t("sign_out")}
          </Button>
        </section>
      )}

      {error ? <p className="mt-4 text-14 text-destructive">{error}</p> : null}
    </main>
  );
}
