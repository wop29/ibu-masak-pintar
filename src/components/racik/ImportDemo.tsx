import { useState } from "react";
import { Clipboard, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "./Sheet";

export function ImportDemo({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<"form" | "working" | "done">("form");
  const valid = /https?:\/\/(www\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\//i.test(url);
  const submit = () => { if (!valid) return; setStage("working"); window.setTimeout(() => setStage("done"), 900); };
  return <>
    <section className={`rounded-2xl bg-primary text-primary-foreground ${compact ? "p-4" : "p-5"}`}><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><Link2 /></span><div><h2 className="text-body font-bold">Nemu resep enak di TikTok atau IG?</h2><p className="mt-1 text-secondary text-primary-foreground/80">Lihat demo alur video menjadi resep yang bisa diikuti.</p></div></div><Button variant="secondary" className="mt-4 w-full" onClick={() => { setOpen(true); setStage("form"); }}>Ambil resep</Button><div className="mt-3 flex flex-wrap gap-2 text-label text-primary-foreground/75"><span>@dapurmamaay</span><span>@koki.harian</span><span>@rasaminang</span></div></section>
    <Sheet open={open} onClose={() => setOpen(false)} title="Ambil Resep dari Video">
      {stage === "form" ? <><p className="text-body text-muted-foreground">TikTok · Instagram Reels · YouTube Shorts</p><label className="mt-4 block"><span className="sr-only">Tautan video</span><input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://www.tiktok.com/@…" className="h-14 w-full rounded-xl border border-border bg-secondary px-4 text-body outline-none focus:border-primary" /></label>{url && !valid ? <p className="mt-2 text-secondary text-destructive">Gunakan tautan TikTok, Instagram, atau YouTube.</p> : null}<Button variant="outline" className="mt-3 w-full" onClick={async()=>{try{setUrl(await navigator.clipboard.readText())}catch{setUrl("")}}}><Clipboard /> Tempel dari clipboard</Button><Button className="mt-3 w-full" disabled={!valid} onClick={submit}>Ambil resepnya</Button><p className="mt-4 text-secondary text-muted-foreground">Ini demo. Tautan tidak dikirim atau diproses.</p></> : stage === "working" ? <div className="py-10 text-center"><p className="text-title font-bold">Menyusun demo resep</p><p className="mt-2 text-body text-muted-foreground">Membaca suara · mengenali tulisan · mencocokkan bahan</p></div> : <div className="py-5"><p className="eyebrow">DEMO SELESAI</p><h3 className="mt-2 text-title font-bold">Alur contoh sudah selesai</h3><p className="mt-3 text-body text-muted-foreground">Versi lengkap akan menampilkan langkah, bahan, dan kredit pembuat. Resep yang sudah ada akan dibuka langsung, bukan dibuat dua kali.</p><Button className="mt-5 w-full" onClick={()=>setOpen(false)}>Tutup demo</Button></div>}
    </Sheet>
  </>;
}