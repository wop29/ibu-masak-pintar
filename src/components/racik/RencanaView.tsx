import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown, Home, Minus, Plus, Undo2, X } from "lucide-react";
import { thumbOf } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { findRecipe, NUSANTARA, REG } from "@/lib/racik/data";
import { liveChecked, resolvedPlan, shoppingList, shoppingText } from "@/lib/racik/plan";
import { clampPortions, PLAN_MAX } from "@/lib/racik/store";
import { suggest } from "@/lib/racik/recommend";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";

/** The week's cooking plan and the merged shopping list. Lives on its own tab (/rencana). */
const GROUPS: [string, string][] = [["daging", "DAGING, IKAN, TAHU & TELUR"], ["sayur", "SAYUR & BUAH"], ["bumbu", "BUMBU SEGAR"], ["sembako", "SEMBAKO & LAINNYA"], ["lain", "LAIN-LAIN"]];

export function RencanaView() {
  const { state, update, setServings } = useRacik();
  const saved = state.saved.map((id) => findRecipe(id, state.imported)).filter((x): x is Recipe => x != null);
  const [picker, setPicker] = useState(false);
  const [showHave, setShowHave] = useState(false);
  const planned = resolvedPlan(state);
  const all = shoppingList(planned, state.negara);
  // "Sudah ada di rumah" is remembered per ingredient, so it survives portion changes.
  const atHome = all.filter((i) => state.pantryHave.includes(i.id));
  const list = all.filter((i) => !state.pantryHave.includes(i.id));
  const done = list.filter((i) => state.planChecked.includes(i.key)).length;
  const toggleHave = (id: string) => update((s) => ({ pantryHave: s.pantryHave.includes(id) ? s.pantryHave.filter((x) => x !== id) : [...s.pantryHave, id] }));
  const inPlan = new Set(state.plan.map((p) => p.id));
  const candidates = [...saved, ...state.imported, ...suggest(NUSANTARA, state, 12).slice(0, 12)].filter((r, i, all) => !inPlan.has(r.id) && !r.incomplete && all.findIndex((x) => x.id === r.id) === i).slice(0, 15);
  const changePortions = (id: string, v: number) => {
    const next = clampPortions(v);
    setServings(id, next);
    update((s) => ({ plan: s.plan.map((p) => (p.id === id ? { ...p, servings: next } : p)) }));
  };
  // Count only entries that still resolve, so a deleted recipe can never leave the plan "full".
  const add = (r: Recipe) => { update((s) => { const live = resolvedPlan(s).map(({ recipe, servings }) => ({ id: recipe.id, servings })); return { plan: live.length >= PLAN_MAX || live.some((p) => p.id === r.id) ? live : [...live, { id: r.id, servings: s.servings[r.id] ?? s.household }] }; }); setPicker(false); };
  const remove = (id: string) => update((s) => { const plan = s.plan.filter((p) => p.id !== id); return { plan, planChecked: liveChecked({ ...s, plan }) }; });
  const send = () => {
    const toBuy = list.filter((i) => !state.planChecked.includes(i.key));
    const home = atHome.length ? `\n\nSudah ada di rumah: ${atHome.map((i) => i.name).join(", ")}` : "";
    const text = `Daftar belanja Racik\nUntuk: ${planned.map((p) => p.recipe.title).join(", ")}\n\n${shoppingText(toBuy.length ? toBuy : list)}${home}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold">Rencana masak</p>
            <p className="mt-0.5 text-caption leading-normal text-ink-3">Pilih hingga {PLAN_MAX} resep untuk seminggu. Daftar belanja dibuat otomatis dari bahan yang dibutuhkan.</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1.5 text-label font-extrabold text-primary">{planned.length}/{PLAN_MAX}</span>
        </div>

        {planned.map(({ recipe, servings }) => (
          <div key={recipe.id} className="flex items-center gap-3 rounded-2xl border border-[#e8e8e4] bg-card p-3">
            <Link to="/resep/$id" params={{ id: recipe.id }} className="size-12 shrink-0 overflow-hidden rounded-xl bg-primary-deep"><RecipePhoto src={recipe.photoUrl ?? thumbOf(recipe.id)} glyph={recipe.glyph} glyphClass="text-xl" /></Link>
            <Link to="/resep/$id" params={{ id: recipe.id }} className="min-w-0 flex-1">
              <p className="line-clamp-2 text-14 font-bold leading-tight tracking-[-0.01em] text-[#111]">{recipe.title}</p>
              <p className="text-label text-[#9ca3af]">{REG[recipe.region]?.name ?? recipe.region} · {recipe.time} mnt</p>
            </Link>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => changePortions(recipe.id, servings - 1)} aria-label={`Kurangi porsi ${recipe.title}`} className="flex size-10 items-center justify-center rounded-full bg-tint text-[#555]"><Minus className="size-4" /></button>
              <span className="min-w-4 text-center text-14 font-bold tabular-nums">{servings}</span>
              <button type="button" onClick={() => changePortions(recipe.id, servings + 1)} aria-label={`Tambah porsi ${recipe.title}`} className="flex size-10 items-center justify-center rounded-full bg-tint text-[#555]"><Plus className="size-4" /></button>
            </div>
            <button type="button" onClick={() => remove(recipe.id)} aria-label={`Hapus ${recipe.title} dari rencana`} className="flex size-10 items-center justify-center text-[#8b8f88]"><X className="size-3.5" /></button>
          </div>
        ))}

        {planned.length < PLAN_MAX ? (
          <button type="button" onClick={() => setPicker((v) => !v)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#b8c8b8] bg-[#f7faf6] text-14 font-extrabold text-primary">
            <Plus className="size-5" /> Tambah resep ke rencana
          </button>
        ) : null}

        {picker ? (
          <div className="rounded-2xl border border-rule bg-card p-3 shadow-[0_10px_28px_rgba(18,23,18,0.08)]">
            <p className="px-0.5 pt-0.5 pb-2.5 text-label font-extrabold text-ink-3">PILIH RESEP</p>
            {candidates.map((r) => (
              <button key={r.id} type="button" onClick={() => add(r)} className="flex min-h-16 w-full items-center gap-3 border-t border-rule px-0.5 py-2 text-left">
                <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-primary-deep"><RecipePhoto src={r.photoUrl ?? thumbOf(r.id)} glyph={r.glyph} glyphClass="text-lg" /></span>
                <span className="flex-1 text-14 font-bold">{r.title}</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary"><Plus className="size-4" /></span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {planned.length ? (
        <>
          <div className="mx-5 mt-5 rounded-2xl border border-[#e8e8e4] bg-card p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[17px] font-extrabold">{planned.length} resep · {list.length} bahan</p>
                <p className="mt-0.5 text-caption text-ink-3">{done} sudah dibeli</p>
              </div>
              <p className="text-caption font-extrabold text-primary">{done}/{list.length}</p>
            </div>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#e8eee7]">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
            </div>
          </div>
          <p className="mt-4 px-5 text-caption leading-normal text-ink-3">Bahan yang sama dari beberapa resep sudah dijumlahkan, walau satuannya berbeda (misalnya siung dan gram). "Beli" menunjukkan jumlah yang biasa dijual di pasar. Tandai "Ada di rumah" untuk bahan yang tidak perlu dibeli.</p>

          <div className="mt-5 px-5">
            <p className="section-label mb-3 text-[#111]">DAFTAR BELANJA</p>
            {GROUPS.map(([cat, label]) => {
              const rows = list.filter((x) => x.cat === cat);
              if (!rows.length) return null;
              return (
                <div key={cat} className="mb-5">
                  <p className="mb-2 text-micro font-bold tracking-[0.08em] text-[#6b6b6b]">{label}</p>
                  <div className="overflow-hidden rounded-2xl border border-[#e8e8e4] bg-card">
                    {rows.map((item) => {
                      const on = state.planChecked.includes(item.key);
                      return (
                        <div key={item.key} className="flex items-start gap-1 border-b border-[#f0f0ed] px-4 py-3 last:border-b-0">
                          <button type="button" aria-pressed={on} onClick={() => update((s) => ({ planChecked: on ? s.planChecked.filter((x) => x !== item.key) : [...s.planChecked, item.key] }))} className="flex min-w-0 flex-1 items-start gap-3 py-0.5 text-left">
                            <span className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full ${on ? "bg-primary" : "border-2 border-[#bfc5bc]"}`}>{on ? <Check className="size-3 text-primary-foreground" strokeWidth={3} /> : null}</span>
                            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                              <span className={`block text-15 ${on ? "text-[#81877f] line-through" : "text-[#111]"}`}><b>{item.qtyText}</b>{item.plusTaste ? <span className="text-ink-3"> (+ secukupnya)</span> : null} {item.name}</span>
                              {item.buy && !on ? <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-micro font-bold text-primary-deep">Beli: {item.buy}</span> : null}
                              {item.staple && !on ? <span className="mt-0.5 block text-micro text-ink-3">Biasanya sudah ada — cek dapur</span> : null}
                              <span className="mt-0.5 block text-micro text-primary">Untuk: {item.recipes.join(", ")}</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => toggleHave(item.id)} aria-label={`${item.name} sudah ada di rumah`} className="-mr-2 flex min-h-11 shrink-0 flex-col items-center justify-center px-2 text-[10px] font-bold leading-tight text-[#747a72]">
                            <Home className="mb-0.5 size-4" strokeWidth={2.2} />
                            Ada di rumah
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {atHome.length ? (
              <div className="mb-5">
                <button type="button" onClick={() => setShowHave((v) => !v)} aria-expanded={showHave} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-[#e8e8e4] bg-card px-4 text-left">
                  <span className="text-14 font-extrabold">Sudah ada di rumah ({atHome.length})</span>
                  <ChevronDown className={`size-4 text-ink-3 transition-transform ${showHave ? "rotate-180" : ""}`} />
                </button>
                {showHave ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[#e8e8e4] bg-card">
                    {atHome.map((item) => (
                      <div key={item.key} className="flex items-center gap-3 border-b border-[#f0f0ed] px-4 py-2.5 last:border-b-0">
                        <span className="min-w-0 flex-1 text-14 text-ink-3"><b>{item.qtyText}</b> {item.name}</span>
                        <button type="button" onClick={() => toggleHave(item.id)} className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-caption font-bold text-primary">
                          <Undo2 className="size-3.5" /> Perlu dibeli
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 pb-8">
              <button type="button" onClick={send} className="min-h-[52px] w-full rounded-full bg-primary text-15 font-bold text-primary-foreground shadow-glow">Bagikan daftar belanja</button>
              <button type="button" onClick={() => update({ plan: [], planChecked: [], pantryHave: [] })} className="min-h-[46px] w-full rounded-full border-[1.5px] border-[#e0e0db] text-14 font-bold text-[#747a72]">Kosongkan rencana</button>
            </div>
          </div>
        </>
      ) : (
        <div className="mx-5 mt-5 rounded-2xl border border-rule bg-card px-5 py-8 text-center">
          <p className="text-[17px] font-extrabold">Belum ada rencana masak</p>
          <p className="mt-1.5 text-14 leading-normal text-ink-3">Tambahkan resep untuk membuat daftar belanja otomatis.</p>
        </div>
      )}
    </div>
  );
}
