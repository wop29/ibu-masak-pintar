import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet } from "@/components/racik/Sheet";
import { Button } from "@/components/ui/button";
import {
  createShareLink,
  fallbackUrl,
  myHandle,
  PUBLIC_HOST,
  type CardFormat,
  type ShareTarget,
} from "@/lib/racik/backend/share";
import { backendConfigured } from "@/lib/racik/backend/client";
import { buildCard, type CardContext } from "./cardModel";
import { canvasToBlob, renderCard } from "./renderCard";

const FORMATS: { id: CardFormat; label: string; hint: string }[] = [
  { id: "story", label: "Story / Status", hint: "9:16" },
  { id: "feed", label: "Feed", hint: "1:1" },
];

interface Rendered {
  blob: Blob;
  preview: string;
  url: string;
  tracked: boolean;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "resep";

/**
 * "Bagikan": a card like a run result, rendered on the phone, shared as a
 * PNG through the system share sheet (WhatsApp Status, Instagram Story, …),
 * or saved when the browser cannot share files.
 */
export function ShareSheet({
  open,
  onClose,
  target,
  card,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget;
  card: Omit<CardContext, "myHandle">;
}) {
  const [format, setFormat] = useState<CardFormat>("story");
  const [handle, setHandle] = useState<string | null | undefined>(undefined);
  const [done, setDone] = useState<Partial<Record<CardFormat, Rendered>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previews = useRef<string[]>([]);

  // Whose card it is: her handle, if she has one. Never her account name.
  useEffect(() => {
    if (!open || handle !== undefined) return;
    if (!backendConfigured) {
      setHandle(null);
      return;
    }
    withTimeout(myHandle(), 4000, null).then((h) => setHandle(h?.handle ?? null));
  }, [open, handle]);

  const model = useMemo(
    () => (handle === undefined ? null : buildCard({ ...card, myHandle: handle })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handle, card.myPhoto, card.recipePhoto, card.servings, card.recipe.id, card.kind],
  );

  // A new photo or portion count means a new card.
  useEffect(() => setDone({}), [model]);

  useEffect(() => {
    if (!open || !model || done[format]) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    (async () => {
      const link = await withTimeout(createShareLink(target, format, card.myPhoto), 6000, null);
      const url = link?.url ?? fallbackUrl(target);
      const canvas = await renderCard({
        model,
        format,
        url,
        urlLabel: url.replace(/^https?:\/\//, "").replace(/^www\./, ""),
      });
      const blob = await canvasToBlob(canvas);
      if (cancelled) return;
      const preview = URL.createObjectURL(blob);
      previews.current.push(preview);
      setDone((d) => ({ ...d, [format]: { blob, preview, url, tracked: Boolean(link) } }));
    })()
      .catch((e) => {
        console.warn("[racik] share card failed", e);
        if (!cancelled) setError("Kartunya belum bisa dibuat. Coba lagi.");
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, model, format]);

  useEffect(
    () => () => {
      for (const p of previews.current) URL.revokeObjectURL(p);
    },
    [],
  );

  const current = done[format];
  const fileName = `racik-${slug(target.title)}-${format === "story" ? "9x16" : "1x1"}.png`;
  const text = current ? `${target.title}, takarannya jelas di Racik: ${current.url}` : "";

  const download = () => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.preview;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNotice("Gambar tersimpan. Unggah dari galeri ke Story atau Status.");
  };

  const share = async () => {
    if (!current) return;
    const file = new File([current.blob], fileName, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: target.title });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    // The browser cannot share files: save the picture, and copy the link.
    download();
    try {
      await navigator.clipboard?.writeText(current.url);
      setNotice("Gambar tersimpan dan tautannya sudah disalin. Tempel di keterangan postinganmu.");
    } catch {
      /* the notice from download() stands */
    }
  };

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.url);
      setNotice("Tautan disalin.");
    } catch {
      setNotice(current.url);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bagikan"
      subtitle="Kartu hasil masakanmu, siap untuk Story, Status, atau feed."
    >
      <div role="radiogroup" aria-label="Ukuran kartu" className="mb-4 grid grid-cols-2 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={format === f.id}
            onClick={() => setFormat(f.id)}
            className={`min-h-12 rounded-xl border px-3 py-2 text-left ${
              format === f.id
                ? "border-primary bg-primary-soft text-primary-deep"
                : "border-rule bg-card text-ink-2"
            }`}
          >
            <span className="block text-14 font-bold">{f.label}</span>
            <span className="block text-micro text-ink-3">{f.hint}</span>
          </button>
        ))}
      </div>

      <div
        className={`mx-auto overflow-hidden rounded-2xl border border-rule bg-ground ${
          format === "story" ? "aspect-[9/16] w-[62%]" : "aspect-square w-[86%]"
        }`}
      >
        {current ? (
          <img
            src={current.preview}
            alt={`Kartu ${target.title}`}
            className="h-full w-full object-cover"
            data-share-card={format}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-14 text-ink-3">
            {error ?? (busy ? "Menyiapkan kartu…" : "")}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-2">
        <Button size="lg" className="w-full" disabled={!current} onClick={share}>
          <Share2 /> Bagikan
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="min-h-11" disabled={!current} onClick={download}>
            <Download /> Simpan gambar
          </Button>
          <Button variant="outline" className="min-h-11" disabled={!current} onClick={copy}>
            <Link2 /> Salin tautan
          </Button>
        </div>
      </div>

      {notice ? (
        <p role="status" className="mt-3 break-words text-14 text-primary-deep">
          {notice}
        </p>
      ) : null}

      {current && !current.tracked && backendConfigured ? (
        <p className="mt-4 text-caption text-ink-3">
          {handle === null ? (
            <>
              Mau tahu berapa orang yang membuka dan memasaknya?{" "}
              <Link to="/resepku" className="font-bold text-primary">
                Masuk dan pilih nama pengguna
              </Link>
              .
            </>
          ) : (
            <>
              Tautan pendek {PUBLIC_HOST}/r/… belum bisa dibuat sekarang, jadi kartu ini memakai
              tautan resep biasa.
            </>
          )}
        </p>
      ) : null}
    </Sheet>
  );
}
