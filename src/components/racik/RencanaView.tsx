import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Home, Minus, Plus, Undo2, X } from "lucide-react";
import { BrandIcon } from "./BrandIcon";
import { thumbOf } from "./photos";
import { RecipePhoto } from "./RecipePhoto";
import { Sheet } from "./Sheet";
import { useSnackbar } from "./Snackbar";
import { findRecipe, REG, suggestionPool } from "@/lib/racik/data";
import { liveChecked, resolvedPlan, shoppingList, shoppingText, type PlannedRecipe } from "@/lib/racik/plan";
import { clampPortions, PLAN_MAX, type PlanDay, type PlanEntry } from "@/lib/racik/store";
import { suggest } from "@/lib/racik/recommend";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";

/** The week's cooking plan and the merged shopping list. Lives on its own tab (/rencana). */
const GROUPS = [
  { cat: "daging", get label() { return t("group_protein"); } },
  { cat: "sayur", get label() { return t("group_veg"); } },
  { cat: "bumbu", get label() { return t("group_spice"); } },
  { cat: "sembako", get label() { return t("group_pantry"); } },
  { cat: "lain", get label() { return t("group_other"); } },
];

const DAY_KEYS = ["day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat", "day_sun"] as const;
/** Monday-first day name in the interface language. */
export const dayName = (d: number) => t(DAY_KEYS[d] ?? "day_mon");
const DAYS: PlanDay[] = [0, 1, 2, 3, 4, 5, 6];

/** Today as a plan day (0 = Senin). */
function todayPlanDay(): PlanDay {
  return ((new Date().getDay() + 6) % 7) as PlanDay;
}

/** Put an entry back at its old position (or the end), never past the cap, never twice. */
function reinsert(plan: PlanEntry[], entry: PlanEntry, at: number): PlanEntry[] {
  if (plan.some((p) => p.id === entry.id) || plan.length >= PLAN_MAX) return plan;
  const next = [...plan];
  next.splice(Math.min(Math.max(0, at), next.length), 0, entry);
  return next;
}

export function RencanaView({ pickDayFor, onPickDayHandled }: { pickDayFor?: string | undefined; onPickDayHandled?: () => void } = {}) {
  const { state, ready, update, setServings } = useRacik();
  const snackbar = useSnackbar();
  const saved = state.saved.map((id) => findRecipe(id, state.imported)).filter((x): x is Recipe => x != null);
  const [picker, setPicker] = useState(false);
  const [showHave, setShowHave] = useState(false);
  const [dayFor, setDayFor] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const planned = resolvedPlan(state);
  const all = shoppingList(planned, state.negara);
  // "Sudah ada di rumah" is remembered per ingredient, so it survives portion changes.
  const atHome = all.filter((i) => state.pantryHave.includes(i.id));
  const list = all.filter((i) => !state.pantryHave.includes(i.id));
  const done = list.filter((i) => state.planChecked.includes(i.key)).length;
  const toggleHave = (id: string) => update((s) => ({ pantryHave: s.pantryHave.includes(id) ? s.pantryHave.filter((x) => x !== id) : [...s.pantryHave, id] }));
  const inPlan = new Set(state.plan.map((p) => p.id));
  const candidates = [...saved, ...state.imported, ...suggest(suggestionPool(state.negara), state, 12).slice(0, 12)].filter((r, i, all) => !inPlan.has(r.id) && !r.incomplete && all.findIndex((x) => x.id === r.id) === i).slice(0, 15);
  const today = todayPlanDay();

  // "Pilih hari" from the "Ditambahkan ke rencana" snackbar lands here with ?hari=<id>.
  // Wait until the saved plan has loaded, or a cold start would never find the recipe.
  useEffect(() => {
    if (!pickDayFor || !ready) return;
    if (state.plan.some((p) => p.id === pickDayFor)) setDayFor(pickDayFor);
    onPickDayHandled?.();
  }, [pickDayFor, ready, state.plan, onPickDayHandled]);

  const changePortions = (id: string, v: number) => {
    const next = clampPortions(v);
    setServings(id, next);
    update((s) => ({ plan: s.plan.map((p) => (p.id === id ? { ...p, servings: next } : p)) }));
  };
  const setDay = (id: string, day: PlanDay | null) => {
    update((s) => ({
      plan: s.plan.map((p) => {
        if (p.id !== id) return p;
        const { day: _old, ...rest } = p;
        return day == null ? rest : { ...rest, day };
      }),
    }));
    setDayFor(null);
  };
  // Count only entries that still resolve, so a deleted recipe can never leave the plan "full".
  const add = (r: Recipe) => {
    update((s) => {
      const live = s.plan.filter((p) => findRecipe(p.id, s.imported) != null);
      return { plan: live.length >= PLAN_MAX || live.some((p) => p.id === r.id) ? live : [...live, { id: r.id, servings: s.servings[r.id] ?? s.household }] };
    });
    setPicker(false);
  };
  const remove = (recipe: Recipe) => {
    const at = state.plan.findIndex((p) => p.id === recipe.id);
    const entry = state.plan[at];
    if (!entry) return;
    const checkedBefore = state.planChecked;
    update((s) => {
      const plan = s.plan.filter((p) => p.id !== recipe.id);
      return { plan, planChecked: liveChecked({ ...s, plan }) };
    });
    snackbar.show({
      message: t("dihapus_dari_rencana"),
      actionLabel: t("urungkan"),
      onAction: () =>
        update((s) => {
          const plan = reinsert(s.plan, entry, at);
          // Ticks that belonged to it come back too, as long as they still match the list.
          const planChecked = liveChecked({ ...s, plan, planChecked: [...new Set([...s.planChecked, ...checkedBefore])] });
          return { plan, planChecked };
        }),
    });
  };
  const clearAll = () => {
    update({ plan: [], planChecked: [], pantryHave: [] });
    setConfirmClear(false);
  };
  const send = () => {
    const toBuy = list.filter((i) => !state.planChecked.includes(i.key));
    const home = atHome.length ? t("wa_at_home", { names: atHome.map((i) => i.name).join(", ") }) : "";
    const text = `${t("wa_header", { titles: planned.map((p) => p.recipe.title).join(", ") })}\n\n${shoppingText(toBuy.length ? toBuy : list)}${home}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const sections: { key: string; title: string; today?: boolean; rows: PlannedRecipe[] }[] = [
    { key: "none", title: t("belum_dijadwalkan"), rows: planned.filter((p) => p.day == null) },
    ...DAYS.map((d) => ({ key: `d${d}`, title: dayName(d), today: d === today, rows: planned.filter((p) => p.day === d) })),
  ].filter((s) => s.rows.length > 0);

  const dayEntry = dayFor ? state.plan.find((p) => p.id === dayFor) : undefined;
  const dayRecipe = dayFor ? findRecipe(dayFor, state.imported) : undefined;

  const row = ({ recipe, servings, day }: PlannedRecipe) => (
    <div key={recipe.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-rule-strong bg-card p-3">
      <Link to="/resep/$id" params={{ id: recipe.id }} className="size-12 shrink-0 overflow-hidden rounded-xl bg-tint" aria-label={recipe.title}><RecipePhoto src={recipe.photoUrl ?? thumbOf(recipe.id)} title={recipe.title} /></Link>
      <Link to="/resep/$id" params={{ id: recipe.id }} className="min-w-[8.5rem] flex-1">
        <p className="text-14 font-bold leading-tight tracking-[-0.01em] text-ink-strong">{recipe.title}</p>
        <p className="text-caption text-ink-3">{REG[recipe.region]?.name ?? recipe.region} · {recipe.time} {" "}{t("mnt")}</p>
      </Link>
      {/* Day, portions and remove stay together; on large text they wrap under the title. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {/* The accessible name starts with the visible word (WCAG 2.5.3, label in name). */}
        <button type="button" onClick={() => setDayFor(recipe.id)} aria-label={t("pilih_hari_untuk", { day: day == null ? t("hari") : dayName(day), title: recipe.title })} className="flex min-h-11 items-center gap-1.5 rounded-full border border-rule-strong bg-card px-3 text-caption font-bold text-ink-2">
          <CalendarDays className="size-4" aria-hidden /> {day == null ? t("hari") : dayName(day)}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changePortions(recipe.id, servings - 1)} aria-label={t("kurangi_porsi_2", { title: recipe.title })} className="flex size-11 items-center justify-center rounded-full bg-tint text-icon-muted"><Minus className="size-4" /></button>
          <span className="min-w-5 text-center text-14 font-bold tabular-nums" aria-label={t("porsi_2", { servings })}>{servings}</span>
          <button type="button" onClick={() => changePortions(recipe.id, servings + 1)} aria-label={t("tambah_porsi_2", { title: recipe.title })} className="flex size-11 items-center justify-center rounded-full bg-tint text-icon-muted"><Plus className="size-4" /></button>
        </div>
        <button type="button" onClick={() => remove(recipe)} aria-label={t("hapus_dari_rencana", { title: recipe.title })} className="flex size-11 items-center justify-center rounded-full text-ink-3"><X className="size-4" /></button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-17 font-extrabold">{t("rencana_masak")}</h2>
            <p className="mt-0.5 text-caption leading-normal text-ink-3">{t("plan_count_line", { n: planned.length, max: PLAN_MAX })}</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1.5 text-caption font-extrabold text-primary">{planned.length}/{PLAN_MAX}</span>
        </div>

        {sections.map((sec) => (
          <section key={sec.key} aria-label={sec.title} className="flex flex-col gap-2">
            <h3 className="mt-1 flex items-center gap-2 text-15 font-bold text-ink-strong">
              {sec.title}
              {sec.today ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-bold text-primary-deep">{t("hari_ini")}</span> : null}
            </h3>
            {sec.rows.map(row)}
          </section>
        ))}

        {planned.length < PLAN_MAX ? (
          <button type="button" onClick={() => setPicker((v) => !v)} aria-expanded={picker} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary-line bg-primary-wash text-14 font-extrabold text-primary">
            <Plus className="size-5" /> {" "}{t("tambah_resep_ke_rencana")}
          </button>
        ) : null}

        {picker ? (
          <div className="rounded-2xl border border-rule bg-card p-3 shadow-raised">
            <p className="px-0.5 pt-0.5 pb-2.5 text-caption font-extrabold text-ink-3">{t("pilih_resep")}</p>
            {candidates.map((r) => (
              <button key={r.id} type="button" onClick={() => add(r)} className="flex min-h-16 w-full items-center gap-3 border-t border-rule px-0.5 py-2 text-left">
                <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-tint"><RecipePhoto src={r.photoUrl ?? thumbOf(r.id)} title={r.title} /></span>
                <span className="flex-1 text-14 font-bold">{r.title}</span>
                <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary"><Plus className="size-4" /></span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {planned.length ? (
        <>
          <div className="mx-5 mt-5 rounded-2xl border border-rule-strong bg-card p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-17 font-extrabold">{planned.length} {" "}{t("resep_3")}{" "}{list.length} {" "}{t("bahan_3")}</p>
                <p className="mt-0.5 text-caption text-ink-3">{done} {" "}{t("sudah_dibeli")}</p>
              </div>
              <p className="text-caption font-extrabold text-primary">{done}/{list.length}</p>
            </div>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-primary-track" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
            </div>
          </div>
          <p className="mt-4 px-5 text-caption leading-normal text-ink-3">{t("bahan_yang_sama_dari_beberapa")}</p>

          <div className="mt-5 px-5">
            <div className="mb-3 flex items-center gap-2.5"><BrandIcon name="daftar-belanja" className="size-8" /><h2 className="heading-sm">{t("daftar_belanja")}</h2></div>
            {GROUPS.map(({ cat, label }) => {
              const rows = list.filter((x) => x.cat === cat);
              if (!rows.length) return null;
              return (
                <div key={cat} className="mb-5">
                  <h3 className="meta-label mb-2">{label}</h3>
                  <div className="overflow-hidden rounded-2xl border border-rule-strong bg-card">
                    {rows.map((item) => {
                      const on = state.planChecked.includes(item.key);
                      return (
                        <div key={item.key} className="flex items-start gap-1 border-b border-rule-soft px-4 py-3 last:border-b-0">
                          <button type="button" aria-pressed={on} onClick={() => update((s) => ({ planChecked: on ? s.planChecked.filter((x) => x !== item.key) : [...s.planChecked, item.key] }))} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 py-0.5 text-left">
                            <span aria-hidden className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full ${on ? "bg-primary" : "border-2 border-control-line"}`}>{on ? <Check className="size-3 text-primary-foreground" strokeWidth={3} /> : null}</span>
                            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                              <span className={`block text-15 ${on ? "text-ink-3 line-through" : "text-ink-strong"}`}><b>{item.qtyText}</b>{item.plusTaste ? <span className="text-ink-3"> {" "}{t("secukupnya_2")}</span> : null} {item.name}</span>
                              {on ? <span className="mt-0.5 block text-caption font-bold text-ink-3">{t("sudah_dibeli_2")}</span> : null}
                              {item.buy && !on ? <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-micro font-bold text-primary-deep">{t("beli")}{" "}{item.buy}</span> : null}
                              {item.staple && !on ? <span className="mt-0.5 block text-micro text-ink-3">{t("biasanya_sudah_ada_cek_dapur")}</span> : null}
                              <span className="mt-0.5 block text-micro text-primary">{t("untuk_2")}{" "}{item.recipes.join(", ")}</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => toggleHave(item.id)} aria-label={t("sudah_ada_di_rumah", { name: item.name })} className="-mr-2 flex min-h-11 shrink-0 flex-col items-center justify-center px-2 text-caption font-bold leading-tight text-ink-3">
                            <Home className="mb-0.5 size-4" strokeWidth={2.2} aria-hidden />
                            
                            {t("ada_di_rumah")}
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
                <button type="button" onClick={() => setShowHave((v) => !v)} aria-expanded={showHave} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-rule-strong bg-card px-4 text-left">
                  <span className="text-14 font-extrabold">{t("sudah_ada_di_rumah_2")}{atHome.length})</span>
                  <ChevronDown aria-hidden className={`size-4 text-ink-3 transition-transform ${showHave ? "rotate-180" : ""}`} />
                </button>
                {showHave ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-rule-strong bg-card">
                    {atHome.map((item) => (
                      <div key={item.key} className="flex items-center gap-3 border-b border-rule-soft px-4 py-2.5 last:border-b-0">
                        <span className="min-w-0 flex-1 text-14 text-ink-3"><b>{item.qtyText}</b> {item.name}</span>
                        <button type="button" onClick={() => toggleHave(item.id)} className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-caption font-bold text-primary">
                          <Undo2 className="size-3.5" aria-hidden /> {" "}{t("perlu_dibeli")}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 pb-8">
              <button type="button" onClick={send} className="min-h-[52px] w-full rounded-full bg-primary text-15 font-bold text-primary-foreground shadow-glow">{t("bagikan_daftar_belanja")}</button>
              <button type="button" onClick={() => setConfirmClear(true)} className="min-h-[46px] w-full rounded-full border-[1.5px] border-rule text-14 font-bold text-ink-3">{t("kosongkan_rencana")}</button>
            </div>
          </div>
        </>
      ) : (
        <div className="mx-5 mt-5 rounded-2xl border border-rule bg-card px-5 py-8 text-center">
          <p className="text-17 font-extrabold">{t("belum_ada_rencana_masak")}</p>
          <p className="mt-1.5 text-14 leading-normal text-ink-3">{t("tambahkan_resep_untuk_membuat_daftar")}</p>
        </div>
      )}

      <Sheet open={Boolean(dayFor && dayEntry)} onClose={() => setDayFor(null)} title={t("pilih_hari")} {...(dayRecipe ? { subtitle: dayRecipe.title } : {})}>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("hari_masak")}>
          {[...DAYS.map((d) => ({ value: d as PlanDay | null, label: dayName(d) + (d === today ? t("today_suffix") : "") })), { value: null as PlanDay | null, label: t("belum_dijadwalkan") }].map(({ value, label }) => {
            const on = (dayEntry?.day ?? null) === value;
            return (
              <button key={label} type="button" role="radio" aria-checked={on} onClick={() => dayFor && setDay(dayFor, value)} className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-15 font-bold ${on ? "border-2 border-primary bg-primary-soft text-primary-deep" : "border border-rule bg-card text-ink"}`}>
                {label}
                {on ? <Check className="size-5" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t("kosongkan_rencana_2")}>
        <p className="read-line text-ink-2">{t("semua_resep_centang_belanja_dan")}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={() => setConfirmClear(false)} className="min-h-[52px] w-full rounded-xl border border-rule bg-card text-body font-extrabold text-ink">{t("batal")}</button>
          <button type="button" onClick={clearAll} className="min-h-[52px] w-full rounded-xl bg-destructive text-body font-extrabold text-destructive-foreground">{t("kosongkan")}</button>
        </div>
      </Sheet>
    </div>
  );
}
