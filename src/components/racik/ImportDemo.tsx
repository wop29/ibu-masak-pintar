import { useRef, useState } from "react";
import { Clipboard, Link2, Upload, Volume2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { importRecipeFromUpload, importRecipeFromVideo, MIN_CAPTION_CHARS } from "@/lib/racik/import-recipe.functions";
import type { ImportResult } from "@/lib/racik/import-recipe.functions";
import { useRacik } from "@/lib/racik/state";
import { Sheet } from "./Sheet";

type Tab = "tautan" | "keterangan";

export function ImportDemo({ compact = false, onImported }: { compact?: boolean; onImported?: () => void }) {
  const { state, update } = useRacik();
  const importRecipe = useServerFn(importRecipeFromVideo);
  const importUpload = useServerFn(importRecipeFromUpload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tautan");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<"form" | "working" | "listening" | "done" | "kosong">("form");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [needCaption, setNeedCaption] = useState(false);
  const valid = /https?:\/\/(www\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\//i.test(url);
  const captionReady = caption.trim().length > 0;

  const handle = (result: ImportResult) => {
    if (result.ok) {
      update((current) => ({ imported: [result.recipe, ...current.imported] }));
      setTitle(result.recipe.title);
      setUnmatched(result.unmatched);
      setCaption("");
      setNeedCaption(false);
      setStage("done");
      onImported?.();
      return;
    }
    if ("needCaption" in result) {
      setNeedCaption(true);
      setTab("keterangan");
      if (result.partial) setCaption(result.partial);
      setError("Keterangan video ini terlalu pendek untuk disusun jadi resep. Tempel keterangan lengkapnya di bawah.");
      setStage("form");
      return;
    }
    setStage("kosong");
  };

  const fail = (caught: unknown) => {
    const raw = caught instanceof Error ? caught.message : "";
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline || /failed to fetch|networkerror|load failed/i.test(raw)) {
      setError("Tautan butuh internet. Resep yang sudah tersimpan tetap bisa dibuka tanpa internet.");
    } else {
      setError(raw || "Resep belum bisa diambil dari tautan ini.");
    }
    setStage("form");
  };

  const submitLink = async (listen = false) => {
    if (!valid) return;
    const duplicate = state.imported.find((recipe) => recipe.sourceUrl === url.trim());
    if (duplicate) {
      setTitle(duplicate.title);
      setStage("done");
      return;
    }
    setError("");
    setStage(listen ? "listening" : "working");
    try {
      handle(await importRecipe({ data: { url: url.trim(), listen } }));
    } catch (caught) {
      fail(caught);
    }
  };

  const submitCaption = async () => {
    if (!captionReady) return;
    setError("");
    setStage("working");
    try {
      handle(await importRecipe({ data: { caption: caption.trim(), url: valid ? url.trim() : undefined } }));
    } catch (caught) {
      fail(caught);
    }
  };

  const submitFile = async (file: File) => {
    setError("");
    setStage("listening");
    try {
      const form = new FormData();
      if (valid) form.append("url", url.trim());
      form.append("file", file);
      handle(await importUpload({ data: form }));
    } catch (caught) {
      fail(caught);
    }
  };

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(value); setError(""); }}
      className={`h-12 flex-1 rounded-xl text-body font-bold ${tab === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
    >
      {label}
    </button>
  );

  return <>
    <section className={`rounded-2xl bg-primary text-primary-foreground ${compact ? "p-4" : "p-5"}`}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><Link2 /></span>
        <div>
          <h2 className="text-body font-bold">Ada resep enak di TikTok atau IG?</h2>
          <p className="mt-1 text-secondary text-primary-foreground/80">Tempel tautannya, atau tempel keterangan videonya. Racik merapikan bahan dan langkahnya.</p>
        </div>
      </div>
      <Button variant="secondary" className="mt-4 w-full" onClick={() => { setOpen(true); setStage("form"); setError(""); }}>Ambil resep</Button>
    </section>
    <input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void submitFile(file); }} />
    <Sheet open={open} onClose={() => setOpen(false)} title="Ambil Resep dari Video">

      {stage === "form" ? <>
        <div className="flex gap-2">{tabButton("tautan", "Tempel tautan")}{tabButton("keterangan", "Tempel keterangan")}</div>
        {tab === "tautan" ? <>
          <p className="mt-4 text-body text-muted-foreground">TikTok · Instagram Reels · YouTube Shorts</p>
          <label className="mt-3 block">
            <span className="sr-only">Tautan video</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Tempel tautan videonya di sini…" className="h-14 w-full rounded-xl border border-border bg-secondary px-4 text-body outline-none focus:border-primary" />
          </label>
          {url && !valid ? <p className="mt-2 text-secondary text-destructive">Gunakan tautan TikTok, Instagram, atau YouTube.</p> : null}
          {error ? <p role="alert" className="mt-3 text-body text-destructive">{error}</p> : null}
          <Button variant="outline" className="mt-3 w-full" onClick={async () => { try { setUrl(await navigator.clipboard.readText()); } catch { setError("Clipboard tidak bisa dibaca. Tempel tautan langsung di kolom."); } }}><Clipboard /> Tempel dari clipboard</Button>
          <Button className="mt-3 w-full" disabled={!valid} onClick={() => void submitLink(false)}>Ambil resepnya</Button>
        </> : <>
          <label className="mt-4 block">
            <span className="sr-only">Keterangan video</span>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={9} placeholder="Tempel keterangan videonya di sini…" className="w-full rounded-xl border border-border bg-secondary p-4 text-body leading-relaxed outline-none focus:border-primary" />
          </label>
          <p className="mt-2 text-secondary text-muted-foreground">Buka videonya, tahan keterangannya, lalu Salin. Tempel di sini.</p>
          {error ? <p role="alert" className="mt-3 text-body text-destructive">{error}</p> : null}
          <Button variant="outline" className="mt-3 w-full" onClick={async () => { try { setCaption(await navigator.clipboard.readText()); } catch { setError("Clipboard tidak bisa dibaca. Tempel keterangannya langsung di kolom."); } }}><Clipboard /> Tempel dari clipboard</Button>
          <Button className="mt-3 w-full" disabled={!captionReady} onClick={() => void submitCaption()}>Rapikan</Button>
          {caption.trim().length > 0 && caption.trim().length < MIN_CAPTION_CHARS ? <p className="mt-2 text-secondary text-muted-foreground">Keterangan sependek ini biasanya belum memuat bahan dan langkah.</p> : null}
          {needCaption ? <>
            <Button variant="outline" className="mt-5 w-full" disabled={!valid} onClick={() => void submitLink(true)}><Volume2 /> Coba baca suaranya</Button>
            <p className="mt-2 text-secondary text-muted-foreground">Racik mendengarkan suara videonya. Bisa sampai satu menit.</p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()}><Upload /> Unggah videonya</Button>
            <p className="mt-2 text-secondary text-muted-foreground">Maksimal 24 MB.</p>
          </> : null}

        </>}
        <p className="mt-4 text-secondary text-muted-foreground">Hanya video publik yang bisa dibaca dari tautan. Racik tidak menebak bagian yang tidak disebut.</p>
      </> : stage === "working" ? <div className="py-10 text-center">
        <p className="text-title font-bold">Menyusun resep</p>
        <p className="mt-2 text-body text-muted-foreground">Membaca keterangan · menyusun bahan · merapikan langkah</p>
      </div> : stage === "listening" ? <div className="py-10 text-center">
        <p className="text-title font-bold">Mendengarkan videonya</p>
        <p className="mt-2 text-body text-muted-foreground">Bisa sampai satu menit. Biarkan layar ini terbuka.</p>
      </div> : stage === "kosong" ? <div className="py-5">
        <p className="eyebrow">TIDAK ADA RESEP</p>
        <h3 className="mt-2 text-title font-bold">Videonya tidak berisi resep</h3>
        <p className="mt-3 text-body text-muted-foreground">Bahan dan langkahnya tidak disebut di teks yang masuk. Racik tidak menebak bagian yang tidak ada.</p>
        <Button className="mt-5 w-full" disabled={!valid} onClick={() => void submitLink(true)}><Volume2 /> Coba baca suaranya</Button>
        <p className="mt-2 text-secondary text-muted-foreground">Racik mendengarkan suara videonya. Bisa sampai satu menit.</p>
        <Button variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()}><Upload /> Unggah videonya</Button>
        <p className="mt-2 text-secondary text-muted-foreground">Maksimal 24 MB.</p>
        <button type="button" className="mt-5 w-full text-body text-muted-foreground underline" onClick={() => { setStage("form"); setTab("keterangan"); }}>Tempel keterangan lagi</button>
      </div> : <div className="py-5">

        <p className="eyebrow">RESEP TERSIMPAN</p>
        <h3 className="mt-2 text-title font-bold">{title}</h3>
        <p className="mt-3 text-body text-muted-foreground">Bahan dan langkahnya sudah masuk ke tab Diambil. Periksa kembali takaran sebelum mulai memasak.</p>
        {unmatched.length ? <div className="mt-4 rounded-xl border border-border bg-notice p-4"><p className="text-label uppercase">Ada yang tidak terbaca</p><p className="mt-2 text-body">Bahan ini disebut di videonya tapi belum ada di daftar Racik: {unmatched.join(", ")}. Silakan tambahkan sendiri waktu memasak.</p></div> : null}
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>Lihat di Buku Resep</Button>
      </div>}
    </Sheet>
  </>;
}
