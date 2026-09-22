import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Settings, Trash2 } from "lucide-react";
import { z } from "zod";
import { AppTabs } from "@/components/racik/AppTabs";
import { CompactRecipe } from "@/components/racik/CompactRecipe";
import { ImportDemo } from "@/components/racik/ImportDemo";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { Button } from "@/components/ui/button";
import { findRecipe } from "@/lib/racik/data";
import { fmtQty } from "@/lib/racik/engine";
import { shoppingList, shoppingText } from "@/lib/racik/plan";
import { useRacik } from "@/lib/racik/state";

const searchSchema = z.object({ tab: z.enum(["diambil","disimpan","rencana"]).optional().catch("diambil") });
export const Route = createFileRoute("/buku")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Buku Resep — Racik" }, { name: "description", content: "Resep tersimpan, contoh hasil ambil dari video, dan rencana belanja dalam satu tempat." }, { property: "og:title", content: "Buku Resep — Racik" }, { property: "og:description", content: "Simpan resep dan gabungkan bahan untuk rencana masak." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Buku,
});

const groupNames: Record<string,string> = { sayur:"SAYUR & BUAH", daging:"DAGING, IKAN & TELUR", bumbu:"BUMBU", sembako:"SEMBAKO & KERING", lain:"LAIN-LAIN" };
function Buku() {
  const { state, update, setServings } = useRacik();
  const navigate = Route.useNavigate();
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState(initialTab ?? "diambil");
  const saved = state.saved.map((id) => findRecipe(id, state.imported)).filter((x) => x != null);
  const planned = state.plan.map((p) => { const recipe = findRecipe(p.id, state.imported); return recipe ? { recipe, servings:p.servings } : null; }).filter((x) => x != null);
  const list = shoppingList(planned);
  const totalTime = planned.reduce((sum,p)=>sum+p.recipe.time,0);
  const setCurrentTab = (next: typeof tab) => { setTab(next); navigate({ search: { tab: next }, replace: true }); };
  const send = () => { const text = `Daftar belanja Racik\n\n${shoppingText(list)}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer"); };
  return <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-28"><header className="px-5 pt-8"><div className="flex items-center"><div className="flex-1"><p className="eyebrow">KOLEKSI</p><h1 className="text-28 font-extrabold">Buku Resep</h1></div><Button asChild variant="secondary" size="icon"><Link to="/pengaturan" aria-label="Pengaturan"><Settings /></Link></Button></div><div className="mt-5 flex border-b border-border">{([{id:"diambil",label:"Diambil",n:state.imported.length},{id:"disimpan",label:"Disimpan",n:saved.length},{id:"rencana",label:"Rencana",n:`${planned.length}/3`} ] as const).map((x)=><Button key={x.id} variant="ghost" onClick={()=>setCurrentTab(x.id)} className={`h-12 flex-1 rounded-none border-b-2 px-1 text-label ${tab===x.id?"border-primary text-primary":"border-transparent text-muted-foreground"}`}>{x.label} <span className="rounded-full bg-secondary px-2 py-0.5">{x.n}</span></Button>)}</div></header>
    <div className="px-5 pt-5"><ImportDemo compact onImported={() => setCurrentTab("diambil")} />
    {tab === "diambil" ? <div className="py-8"><h2 className="eyebrow-ink">RESEP YANG DIAMBIL</h2>{state.imported.length ? <div className="mt-3">{state.imported.map((recipe) => <div key={recipe.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border py-4"><Link to="/resep/$id" params={{id:recipe.id}} className="min-w-0"><b className="block truncate text-body">{recipe.title}</b><small className="mt-1 block truncate text-label text-muted-foreground">{recipe.creator ? `Dari ${recipe.creator} · ` : ""}{recipe.ings.length} bahan · {recipe.steps.length} langkah{recipe.unmatched.length ? ` · ${recipe.unmatched.length} belum terbaca` : ""}</small></Link><Button variant="ghost" size="icon" aria-label={`Hapus ${recipe.title}`} onClick={() => update((s) => ({ imported: s.imported.filter((item) => item.id !== recipe.id) }))}><Trash2 /></Button><ChevronRight className="shrink-0 text-border" /></div>)}</div> : <p className="mt-4 text-body text-muted-foreground">Belum ada resep yang diambil. Tempel tautan video publik di atas.</p>}</div> : null}
    {tab === "disimpan" ? <div className="pt-6"><h2 className="eyebrow-ink">RESEP TERSIMPAN</h2>{saved.length ? saved.map((r)=><CompactRecipe key={r.id} recipe={r} />) : <p className="py-8 text-body text-muted-foreground">Belum ada resep tersimpan.</p>}</div> : null}
    {tab === "rencana" ? <div className="pt-6">{planned.length ? <><div className="grid grid-cols-3 rounded-2xl bg-secondary p-4 text-center"><div><b className="block text-head">{totalTime}</b><span className="text-micro font-bold">TOTAL MENIT</span></div><div><b className="block text-head">{planned.length}</b><span className="text-micro font-bold">RESEP</span></div><div><b className="block text-head">{list.length}</b><span className="text-micro font-bold">BAHAN</span></div></div><p className="mt-5 text-body text-muted-foreground">Bahan dari semua resep digabung jadi satu daftar belanja. Yang dipakai di lebih dari satu resep cukup dibeli sekali.</p>{planned.map(({recipe,servings})=><div key={recipe.id} className="flex items-center gap-3 border-b border-border py-4"><Link to="/resep/$id" params={{id:recipe.id}} className="min-w-0 flex-1 text-body font-bold">{recipe.title}</Link><PortionStepper value={servings} max={12} onChange={(v)=>{setServings(recipe.id,v);update((s)=>({plan:s.plan.map((p)=>p.id===recipe.id?{...p,servings:v}:p)}))}} /><Button variant="ghost" size="icon" aria-label={`Hapus ${recipe.title}`} onClick={()=>update((s)=>({plan:s.plan.filter((p)=>p.id!==recipe.id)}))}>×</Button></div>)}{Object.keys(groupNames).map((cat)=>{const rows=list.filter((x)=>x.cat===cat);return rows.length?<section key={cat} className="mt-7"><h3 className="eyebrow-ink">{groupNames[cat]}</h3>{rows.map((item)=><label key={item.key} className="flex gap-3 border-b border-border py-3 text-body"><input type="checkbox" checked={state.planChecked.includes(item.key)} onChange={()=>update((s)=>({planChecked:s.planChecked.includes(item.key)?s.planChecked.filter((x)=>x!==item.key):[...s.planChecked,item.key]}))} /><span><b>{item.qty==null?"secukupnya":`${fmtQty(item.qty)} ${item.unit}`}</b> {item.name}<small className="mt-1 block text-label text-primary">{item.recipes.join(" · ")}</small></span></label>)}</section>:null})}<Button className="mt-7 w-full" onClick={send}>Kirim ke WhatsApp</Button><Button variant="ghost" className="mt-2 w-full text-destructive" onClick={()=>update({plan:[],planChecked:[]})}>Kosongkan rencana</Button></> : <p className="py-8 text-body text-muted-foreground">Belum ada rencana. Tambahkan hingga tiga resep dari halaman resep.</p>}</div> : null}</div>
    <AppTabs /></main>;
}