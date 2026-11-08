import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AppTabs } from "@/components/racik/AppTabs";
import { ImportDemo, ImportSheet } from "@/components/racik/ImportDemo";
import { t } from "@/lib/racik/i18n";

/** The Android share sheet (Web Share Target in the manifest) opens /ambil?url=…&text=…&title=… */
const shareSchema = z.object({
  url: z.string().max(2000).optional().catch(undefined),
  text: z.string().max(20000).optional().catch(undefined),
  title: z.string().max(500).optional().catch(undefined),
});

export const Route = createFileRoute("/ambil")({
  validateSearch: shareSchema,
  head: () => ({
    meta: [
      { title: "Tambah Resep — Racik" },
      {
        name: "description",
        content:
          "Tempel link TikTok, Instagram Reels, atau YouTube, teks resep, atau foto resep. Racik menyusun bahan, takaran, dan langkahnya.",
      },
    ],
  }),
  component: Ambil,
});

/** A shared link to /ambil lands here with the import sheet already open; a link shared from TikTok/Reels/Shorts starts importing straight away. */
function Ambil() {
  const [open, setOpen] = useState(false);
  const { url, text, title } = Route.useSearch();
  const shared =
    url || text || title
      ? { url: url ?? "", text: [title, text].filter(Boolean).join(" ") }
      : undefined;
  useEffect(() => setOpen(true), []);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24 tab:max-w-[1280px] tab:px-6 tab:pb-12 desk:px-8">
      <header className="border-b border-rule-soft bg-card px-5 pb-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <h1 className="text-hero font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">
          
          {t("ubah_jadi_resep")}
        </h1>
        <p className="mt-2 text-14 leading-normal text-ink-3">
          
          {t("dari_link_video_teks_resep")}
        </p>
      </header>
      <div className="px-5 pt-5">
        <ImportDemo />
        <Link to="/tulis" className="mt-6 block text-center text-14 font-bold text-primary">
          
          {t("atau_tulis_resep_sendiri")}
        </Link>
      </div>
      <ImportSheet open={open} onClose={() => setOpen(false)} shared={shared} />
      <AppTabs />
    </main>
  );
}
