import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopNav } from "@/components/racik/TopNav";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { RacikProvider, useRacik } from "@/lib/racik/state";
import { effectiveLang, t } from "@/lib/racik/i18n";
import { SnackbarProvider } from "@/components/racik/Snackbar";
import { Button } from "@/components/ui/button";
import {
  isUpdateWaiting,
  registerRacikPwa,
  reloadToUpdate,
  UPDATE_EVENT,
} from "@/lib/register-pwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {t("halaman_tidak_ditemukan")}
        </h2>
        <p className="mt-2 text-body text-muted-foreground">{t("alamat_ini_tidak_ada_atau")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("kembali_ke_beranda")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("halaman_tidak_bisa_dibuka")}
        </h1>
        <p className="mt-2 text-body text-muted-foreground">
          {t("ada_gangguan_saat_membuka_halaman")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-primary text-primary-foreground"
          >
            {t("coba_lagi")}
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("ke_beranda")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Racik" },
      {
        name: "description",
        content:
          "Resep rumahan Indonesia dengan takaran yang ikut jumlah porsi di rumah. Tanpa akun, bisa dibuka tanpa sinyal.",
      },
      { name: "theme-color", content: "#F8F4EA" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Racik" },
      { property: "og:title", content: "Racik" },
      {
        property: "og:description",
        content: "Resep rumahan Indonesia dengan takaran yang ikut jumlah porsi di rumah.",
      },
      { property: "og:type", content: "website" },
      // Default link preview (WhatsApp, social). Recipe pages set their own photo.
      { property: "og:image", content: "https://racik.online/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://racik.online/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    void registerRacikPwa();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RacikProvider>
        <TextSize />
        <LangTree />
        <UpdatePrompt />
      </RacikProvider>
    </QueryClientProvider>
  );
}

/**
 * Pengaturan › Ukuran tulisan. Every text size in styles.css is multiplied by
 * --teks, which this class on <html> sets, so the whole app grows — not only
 * the few elements that inherited a font-size from a wrapper.
 */
function TextSize() {
  const { state } = useRacik();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("teks-besar", "teks-paling_besar");
    if (state.teks !== "normal") root.classList.add(`teks-${state.teks}`);
  }, [state.teks]);
  return null;
}

/** "Versi baru tersedia" — never over cook mode, where a reload would jump the screen. */
function UpdatePrompt() {
  const [waiting, setWaiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setWaiting(isUpdateWaiting());
    const on = () => setWaiting(true);
    window.addEventListener(UPDATE_EVENT, on);
    return () => window.removeEventListener(UPDATE_EVENT, on);
  }, []);
  if (!waiting || dismissed || path.endsWith("/masak")) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 mx-auto w-[calc(100%-32px)] max-w-[398px] rounded-2xl bg-dark px-4 py-3 text-white shadow-toast tab:bottom-6"
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-14 font-semibold">{t("versi_baru_racik_tersedia")}</p>
        <button
          type="button"
          onClick={() => void reloadToUpdate()}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-4 text-14 font-bold"
        >
          {t("muat_ulang")}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("offer_later")}
          className="flex size-11 shrink-0 items-center justify-center text-white/70"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Everything under here re-renders from scratch when the interface language
 * changes: t() is a plain function, so the language switch is a remount.
 */
function LangTree() {
  const { state } = useRacik();
  const lang = effectiveLang(state.lang);
  return (
    <SnackbarProvider key={lang}>
      {/* iPad and desktop only; the phone keeps its bottom tabs. */}
      <TopNav />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </SnackbarProvider>
  );
}
