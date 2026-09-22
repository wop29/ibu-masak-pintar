import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Heart, ShoppingBasket, X } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { SearchField } from "@/components/racik/SearchField";
import { Sheet } from "@/components/racik/Sheet";
import { Button } from "@/components/ui/button";
import { INGREDIENTS, RECIPES, REG } from "@/lib/racik/data";
import { buildIndex, proteinPerPortion, search } from "@/lib/racik/engine";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO } from "@/components/racik/photos";
import { RecipePhoto } from "@/components/racik/RecipePhoto";

export const Route = createFileRoute("/cari")({
  head: () => ({ meta: [{ title: "Cari Resep Nusantara — Racik" }, { name: "description", content: "Cari resep dari waktu, bahan utama, cara masak, protein, atau daerah." }, { property: "og:title", content: "Cari Resep Nusantara — Racik" }, { property: "og:description", content: "Cari resep Indonesia dengan kata dan nama bahan yang biasa dipakai di rumah." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CariResep,
});

function Shelf({ title, items, onPick }: { title: string; items: { label: string; recipes: Recipe[] }[]; onPick: (label: string, recipes: Recipe[]) => void }) {
  const populated = items.filter((item) => item.recipes.length > 0);
  if (!populated.length) return null;
  return <section className="mt-8"><h2 className="eyebrow-ink px-5">{title}</h2><div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5">{populated.map((item) => { const recipe = item.recipes[0]; const photo = recipe ? PHOTO[recipe.id] : undefined; return <Button key={item.label} variant="ghost" onClick={() => onPick(item.label, item.recipes)} className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl bg-primary-deep p-0 text-primary-foreground"><span className="absolute inset-0"><RecipePhoto src={photo} glyph={recipe?.glyph ?? "\u{1F372}"} /></span><span className="absolute inset-0 bg-dark/45" /><span className="relative mt-auto w-full px-3 pb-3 text-left"><b className="block text-body">{item.label}</b><small className="text-label font-normal">{item.recipes.length} resep</small></span></Button>; })}</div></section>;
}

function CariResep() {
  const { state } = useRacik();
  const [query, setQuery] = useState("");
  const [ingredients, setIngredients] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ label: string; recipes: Recipe[] } | null>(null);
  const index = useMemo(() => buildIndex(RECIPES), []);
  const found = query.trim() ? search(index, query) : [];
  const ingredientRecipes = RECIPES.filter((r) => selected.every((id) => r.ings.some((line) => line[0] === id)));
  const methods = [{ label: "Goreng", word: "goreng" }, { label: "Tumis", word: "tumis" }, { label: "Kukus", word: "kukus" }, { label: "Rebus", word: "rebus" }, { label: "Bakar", word: "bakar" }];
  const pick = (label: string, recipes: Recipe[]) => setResult({ label, recipes });
  if (result) return <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-24"><header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-5 py-4"><Button variant="ghost" size="icon" onClick={() => setResult(null)} aria-label="Tutup"><X /></Button><div><p className="eyebrow">HASIL</p><h1 className="text-title font-bold">{result.label}</h1></div></header><div className="px-5">{result.recipes.length ? result.recipes.map((r) => <Link key={r.id} to="/resep/$id" params={{ id: r.id }} className="flex items-center gap-3 border-b border-border py-4"><span className="text-title">{r.glyph}</span><span className="flex-1 text-body font-bold">{r.title}</span><ChevronRight className="text-border" /></Link>) : <p className="py-12 text-body text-muted-foreground">Belum ada resep dalam kelompok ini.</p>}</div><AppTabs /></main>;
  return <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-28">
    <header className="border-b border-border px-5 pb-5 pt-[calc(2.5rem+env(safe-area-inset-top))]"><p className="eyebrow">CARI RESEP</p><h1 className="mt-1 text-display font-extrabold leading-tight">Masakan Nusantara</h1><div className="mt-4"><SearchField value={query} onChange={setQuery} placeholder="Cari resep atau bahan — coba 'brambang'" /></div></header>
    {query.trim() ? <section className="px-5 pt-3"><p className="eyebrow-ink py-3">HASIL PENCARIAN</p>{found.map((r) => <Link key={r.id} to="/resep/$id" params={{ id: r.id }} className="flex items-center border-b border-border py-4 text-body font-bold">{r.title}<ChevronRight className="ml-auto text-border" /></Link>)}{!found.length ? <p className="py-8 text-body text-muted-foreground">Tidak ada resep yang cocok.</p> : null}</section> : <>
      <div className="mx-5 mt-5 overflow-hidden rounded-2xl border border-border"><Button variant="ghost" className="h-20 w-full justify-start rounded-none px-5" onClick={() => setIngredients(true)}><ShoppingBasket className="text-primary" /><span className="flex-1 text-left">Cari dari bahan yang ada di dapur</span><ChevronRight className="text-border" /></Button><Link to="/buku" search={{ tab: "disimpan" }} className="flex h-20 items-center gap-3 border-t border-border px-5 text-body font-semibold"><Heart /><span className="flex-1">Resep yang disimpan</span><b className="text-primary">{state.saved.length}</b><ChevronRight className="text-border" /></Link></div>
      <Shelf title="CEPAT & GAMPANG" onPick={pick} items={[20,30,45].map((n) => ({ label: `≤ ${n} menit`, recipes: RECIPES.filter((r) => r.time <= n) }))} />
      <Shelf title="BAHAN UTAMA" onPick={pick} items={[{ label: "Ayam", ids: ["ayam_utuh","ayam"] },{ label:"Ikan & Udang",ids:["ikan_kembung","ikan_cakalang","udang"]},{label:"Telur",ids:["telur"]},{label:"Tahu & Tempe",ids:["tahu","tempe"]},{label:"Daging",ids:["daging_sapi"]},{label:"Sayur",ids:INGREDIENTS.filter((i)=>i.cat==="sayur").map((i)=>i.id)}].map((x)=>({label:x.label,recipes:RECIPES.filter((r)=>r.ings.some((l)=>x.ids.includes(l[0])))}))} />
      <Shelf title="CARA MASAK" onPick={pick} items={methods.map((m)=>({label:m.label,recipes:RECIPES.filter((r)=>r.steps.some((s)=>s[0].toLowerCase().includes(m.word)))}))} />
      <Shelf title="PROTEIN TINGGI" onPick={pick} items={[15,20,25].map((n)=>({label:`≥ ${n} g`,recipes:RECIPES.filter((r)=>proteinPerPortion(r)>=n)}))} />
      <Shelf title="DAERAH" onPick={pick} items={Object.values(REG).map((reg)=>({label:reg.name,recipes:RECIPES.filter((r)=>r.region===reg.id)}))} />
    </>}
    <Sheet open={ingredients} onClose={() => setIngredients(false)} title="Bahan di dapur"><p className="mb-4 text-body text-muted-foreground">Pilih bahan utama. Hasil berubah setiap kali pilihan ditambah.</p><div className="flex flex-wrap gap-2">{INGREDIENTS.filter((i)=>!i.staple).slice(0,30).map((ing)=><Button key={ing.id} size="sm" variant={selected.includes(ing.id)?"default":"outline"} onClick={()=>setSelected((s)=>s.includes(ing.id)?s.filter((x)=>x!==ing.id):[...s,ing.id])}>{ing.emoji} {ing.name}</Button>)}</div><p className="mt-5 text-body font-semibold">{ingredientRecipes.length} resep cocok</p><Button className="mt-3 w-full" disabled={!selected.length} onClick={()=>{setIngredients(false);pick("Bahan di dapur",ingredientRecipes)}}>Lihat resep</Button></Sheet>
    <AppTabs />
  </main>;
}