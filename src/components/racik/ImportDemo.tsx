import { useRef, useState } from "react";
import { Clipboard, Link2, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CAPTION_NEEDED, importRecipeFromUpload, importRecipeFromVideo } from "@/lib/racik/import-recipe.functions";
import { useRacik } from "@/lib/racik/state";
import { Sheet } from "./Sheet";

export function ImportDemo({ compact = false, onImported }: { compact?: boolean; onImported?: () => void }) {
  const { state, update } = useRacik();
  const importRecipe = useServerFn(importRecipeFromVideo);
  const importUpload = useServerFn(importRecipeFromUpload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<"form" | "working" | "done">("form");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [needCaption, setNeedCaption] = useState(false);
  const valid = /https?:\/\/(www\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\//i.test(url);
  const submit = async () => {
    if (!valid) return;
    const duplicate = state.imported.find((recipe) => recipe.sourceUrl === url.trim());
    if (duplicate) {
      setTitle(duplicate.title);
      setStage("done");
      return;
    }
    setError("");
    setStage("working");
    try {
      const recipe = await importRecipe({ data: { url: url.trim(), caption: caption.trim() || undefined } });
      if ("needCaption" in recipe) {
        setNeedCaption(true);
        setError("Suara dan keterangan video ini tidak bisa dibaca dari luar aplikasinya. Unggah videonya, atau tempel keterangannya di bawah.");
        setStage("form");
        return;
      }
      update((current) => ({ imported: [recipe, ...current.imported] }));
      setTitle(recipe.title);
      setStage("done");
      setCaption("");
      setNeedCaption(false);
      onImported?.();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Resep belum bisa diambil dari tautan ini.";
      if (message.includes(CAPTION_NEEDED)) {
        setNeedCaption(true);
        setError("Suara dan keterangan video ini tidak bisa dibaca dari luar aplikasinya. Unggah videonya, atau tempel keterangannya di bawah.");
      } else {
        setError(message);
      }
      setStage("form");
    }
  };
  const submitFile = async (file: File) => {
    setError("");
    setStage("working");
    try {
      const form = new FormData();
      form.append("url", url.trim());
      form.append("file", file);
      const recipe = await importUpload({ data: form });
      if ("needCaption" in recipe) {
        setError("Suara di berkas itu belum memuat bahan dan langkah. Tempel keterangan videonya di bawah.");
        setNeedCaption(true);
        setStage("form");
        return;
      }
      update((current) => ({ imported: [recipe, ...current.imported] }));
      setTitle(recipe.title);
      setStage("done");
      setCaption("");
      setNeedCaption(false);
      onImported?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replace(CAPTION_NEEDED, "Suara di berkas itu belum memuat bahan dan langkah.") : "Berkas itu belum bisa dibaca.");
      setStage("form");
    }
  };
  return <>
    <section className={`rounded-2xl bg-primary text-primary-foreground ${compact ? "p-4" : "p-5"}`}><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><Link2 /></span><div><h2 className="text-body font-bold">Ada resep enak di TikTok atau IG?</h2><p className="mt-1 text-secondary text-primary-foreground/80">Tempel tautannya. Racik mendengarkan videonya dan menyusun bahan serta langkahnya.</p></div></div><Button variant="secondary" className="mt-4 w-full" onClick={() => { setOpen(true); setStage("form"); setError(""); }}>Ambil resep</Button></section>
    <Sheet open={open} onClose={() => setOpen(false)} title="Ambil Resep dari Video">
      {stage === "form" ? <><p className="text-body text-muted-foreground">TikTok · Instagram Reels · YouTube Shorts</p><label className="mt-4 block"><span className="sr-only">Tautan video</span><input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://www.tiktok.com/@…" className="h-14 w-full rounded-xl border border-border bg-secondary px-4 text-body outline-none focus:border-primary" /></label>{url && !valid ? <p className="mt-2 text-secondary text-destructive">Gunakan tautan TikTok, Instagram, atau YouTube.</p> : null}{error ? <p role="alert" className="mt-3 text-body text-destructive">{error}</p> : null}{needCaption ? <><Button variant="outline" className="mt-3 w-full" disabled={!valid} onClick={()=>fileRef.current?.click()}><Upload /> Unggah videonya</Button><input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e)=>{const file=e.target.files?.[0]; e.target.value=""; if(file) void submitFile(file);}} /><p className="mt-2 text-secondary text-muted-foreground">Racik mendengarkan suara video itu dan menulis bahan serta langkahnya. Maksimal 24 MB.</p><label className="mt-4 block"><span className="eyebrow">ATAU TEMPEL KETERANGAN VIDEO</span><textarea value={caption} onChange={(e)=>setCaption(e.target.value)} rows={6} placeholder="Tempel keterangan video: bahan dan langkahnya" className="mt-2 w-full rounded-xl border border-border bg-secondary p-4 text-body leading-relaxed outline-none focus:border-primary" /></label></> : null}<Button variant="outline" className="mt-3 w-full" onClick={async()=>{try{setUrl(await navigator.clipboard.readText())}catch{setError("Clipboard tidak bisa dibaca. Tempel tautan langsung di kolom.")}}}><Clipboard /> Tempel dari clipboard</Button><Button className="mt-3 w-full" disabled={!valid || (needCaption && caption.trim().length < 20)} onClick={submit}>{needCaption ? "Susun dari keterangan" : "Ambil resepnya"}</Button><p className="mt-4 text-secondary text-muted-foreground">Hanya video publik yang bisa dibaca dari tautan. Racik tidak menebak bagian yang tidak disebut.</p></> : stage === "working" ? <div className="py-10 text-center"><p className="text-title font-bold">Menyusun resep</p><p className="mt-2 text-body text-muted-foreground">Mendengarkan video · menyusun bahan · merapikan langkah</p></div> : <div className="py-5"><p className="eyebrow">RESEP TERSIMPAN</p><h3 className="mt-2 text-title font-bold">{title}</h3><p className="mt-3 text-body text-muted-foreground">Bahan dan langkahnya sudah masuk ke tab Diambil. Periksa kembali takaran sebelum mulai memasak.</p><Button className="mt-5 w-full" onClick={()=>setOpen(false)}>Lihat di Buku Resep</Button></div>}
    </Sheet>
  </>;
}