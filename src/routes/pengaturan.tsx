import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { clearAll, defaultState } from "@/lib/racik/store";
import { useRacik } from "@/lib/racik/state";

export const Route = createFileRoute("/pengaturan")({ head: () => ({ meta: [{ title: "Pengaturan — Racik" }, { name: "description", content: "Atur jumlah porsi, satuan, ukuran tulisan, dan pilihan resep di Racik." }, { property: "og:title", content: "Pengaturan — Racik" }, { property: "og:description", content: "Pengaturan memasak dan penyimpanan di perangkat." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Pengaturan });

function Row({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) { return <div className="border-b border-border py-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0 flex-1"><h2 className="text-body font-bold">{title}</h2>{detail ? <p className="mt-1 text-secondary text-muted-foreground">{detail}</p> : null}</div>{children}</div></div>; }
function Pengaturan() {
  const { state, update } = useRacik(); const navigate = useNavigate();
  return <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12"><header className="flex items-center gap-3 py-5"><Button asChild variant="ghost" size="icon"><Link to="/buku" aria-label="Kembali"><ArrowLeft /></Link></Button><div><p className="eyebrow">RACIK</p><h1 className="text-title font-bold">Pengaturan</h1></div></header>
    <Row title="Porsi biasa" detail="Dipakai saat membuka resep pertama kali."><PortionStepper value={state.household} onChange={(v)=>update({household:v})} /></Row>
    <Row title="Satuan takaran"><div className="flex gap-1 rounded-xl bg-secondary p-1">{(["rumah","gram"] as const).map((x)=><Button key={x} size="sm" variant={state.satuan===x?"default":"ghost"} onClick={()=>update({satuan:x})}>{x==="rumah"?"Rumah":"Gram"}</Button>)}</div></Row>
    <Row title="Ukuran tulisan"><select value={state.teks} onChange={(e)=>update({teks:e.target.value as typeof state.teks})} className="h-11 rounded-xl border border-border bg-card px-3 text-body"><option value="normal">Normal</option><option value="besar">Besar</option><option value="paling_besar">Paling besar</option></select></Row>
    <Row title="Sembunyikan resep yang perlu dicek" detail="Penyaring ini berdasarkan daftar bahan. Racik bukan lembaga sertifikasi halal."><input aria-label="Sembunyikan resep yang perlu dicek" type="checkbox" checked={state.halalMode} onChange={(e)=>update({halalMode:e.target.checked})} className="h-6 w-6 accent-primary" /></Row>
    <section className="py-6"><h2 className="eyebrow-ink">TENTANG RACIK</h2><p className="mt-3 text-body text-muted-foreground">Racik berisi 199 resep yang tersimpan di perangkat. Takaran rumah dan perkiraan protein punya batas; baca catatan pada setiap resep.</p></section>
    <Button variant="outline" className="w-full text-destructive" onClick={async()=>{await clearAll();update(defaultState);navigate({to:"/"})}}>Hapus semua data</Button>
  </main>;
}